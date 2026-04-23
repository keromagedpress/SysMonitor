"""
AnomalyDetector — uses scikit-learn Isolation Forest to detect anomalies
in system performance metrics in real time.
"""
import uuid
import numpy as np
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from sklearn.ensemble import IsolationForest

from models import SystemSnapshot, AnomalyAlert


# Human-readable feature names matching the 9-element feature vector
FEATURE_NAMES = [
    "CPU Usage",
    "RAM Usage",
    "Disk Read Speed",
    "Disk Write Speed",
    "Network Upload Speed",
    "Network Download Speed",
    "Top Process CPU",
    "Top Process Memory",
    "Active Process Count",
]


class AnomalyDetector:
    """
    Real-time anomaly detector using Isolation Forest.
    Maintains a rolling buffer of feature vectors and retrains periodically.
    """

    def __init__(self) -> None:
        self.model: IsolationForest = IsolationForest(
            contamination=0.05,
            random_state=42,
            n_estimators=100,
        )
        self.feature_buffer: deque = deque(maxlen=500)
        self.is_trained: bool = False
        self.min_samples: int = 50
        # { feature_name: (mean, std) }
        self.baselines: dict[str, tuple[float, float]] = {}

    # ─────────────────────────────────────────────────────────────────────────
    def _extract_features(self, snapshot: SystemSnapshot) -> np.ndarray:
        """Extract a 9-element feature vector from a SystemSnapshot."""
        top_proc_cpu_max = max((p.cpu_percent for p in snapshot.top_processes), default=0.0)
        top_proc_mem_max = max((p.memory_percent for p in snapshot.top_processes), default=0.0)
        process_count = float(len(snapshot.top_processes))

        return np.array([
            snapshot.cpu.overall_percent,
            snapshot.ram.percent,
            snapshot.disk.read_mbps,
            snapshot.disk.write_mbps,
            snapshot.network.upload_mbps,
            snapshot.network.download_mbps,
            top_proc_cpu_max,
            top_proc_mem_max,
            process_count,
        ], dtype=np.float64)

    # ─────────────────────────────────────────────────────────────────────────
    def _maybe_retrain(self) -> None:
        """
        Retrain the Isolation Forest when enough samples have accumulated.
        Also recomputes per-feature baseline statistics.
        """
        buf_len = len(self.feature_buffer)
        if buf_len < self.min_samples:
            return
        if not (buf_len % 50 == 0 or not self.is_trained):
            return

        X = np.array(list(self.feature_buffer), dtype=np.float64)
        self.model.fit(X)

        # Compute baselines
        means = X.mean(axis=0)
        stds = X.std(axis=0)
        for i, name in enumerate(FEATURE_NAMES):
            self.baselines[name] = (float(means[i]), float(stds[i]))

        self.is_trained = True

    # ─────────────────────────────────────────────────────────────────────────
    def _severity_from_zscore(self, abs_z: float) -> str:
        """Map absolute z-score to severity label."""
        if abs_z > 5.0:
            return "critical"
        if abs_z > 4.0:
            return "high"
        if abs_z > 3.0:
            return "medium"
        return "low"

    # ─────────────────────────────────────────────────────────────────────────
    def detect(self, snapshot: SystemSnapshot) -> list[AnomalyAlert]:
        """
        Run anomaly detection on a new snapshot.
        Returns a list of AnomalyAlert objects (may be empty).
        """
        features = self._extract_features(snapshot)
        self.feature_buffer.append(features.copy())
        self._maybe_retrain()

        if not self.is_trained:
            return []

        prediction = self.model.predict(features.reshape(1, -1))[0]
        if prediction != -1:
            # Not an anomaly
            return []

        # Identify which features deviate most from baseline
        alerts: list[AnomalyAlert] = []
        ts = datetime.now(timezone.utc).isoformat()

        deviating: list[tuple[float, int]] = []  # (abs_z, feature_index)
        for i, name in enumerate(FEATURE_NAMES):
            if name not in self.baselines:
                continue
            mean, std = self.baselines[name]
            if std < 1e-9:
                continue
            abs_z = abs(features[i] - mean) / std
            if abs_z > 2.5:
                deviating.append((abs_z, i))

        if not deviating:
            # Isolation Forest flagged it but no single feature is a clear outlier
            # — emit one generic alert for the combination
            alerts.append(AnomalyAlert(
                id=str(uuid.uuid4()),
                timestamp=ts,
                metric="Combined Metrics",
                description=(
                    "Unusual combination of system metrics detected. "
                    "No single metric exceeded threshold individually."
                ),
                severity="low",
                value=0.0,
                threshold=0.0,
                acknowledged=False,
            ))
            return alerts

        for abs_z, idx in deviating:
            name = FEATURE_NAMES[idx]
            mean, std = self.baselines[name]
            current_val = float(features[idx])
            threshold = mean + 2.5 * std
            severity = self._severity_from_zscore(abs_z)

            description = (
                f"Anomaly in {name}: {current_val:.2f} "
                f"(normal: {mean:.2f} ± {std:.2f}, z={abs_z:.1f})"
            )

            alerts.append(AnomalyAlert(
                id=str(uuid.uuid4()),
                timestamp=ts,
                metric=name,
                description=description,
                severity=severity,
                value=round(current_val, 4),
                threshold=round(threshold, 4),
                acknowledged=False,
            ))

        return alerts
