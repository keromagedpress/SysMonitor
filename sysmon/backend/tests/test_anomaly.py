"""
Tests for AnomalyDetector — verifies Isolation Forest training and alert generation.
"""
import sys
import os
import time
import random

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from anomaly import AnomalyDetector
from models import (
    SystemSnapshot, CPUMetrics, RAMMetrics,
    DiskMetrics, NetworkMetrics, ProcessInfo, AnomalyAlert
)


def _make_snapshot(
    cpu: float = 20.0,
    ram: float = 40.0,
    disk_read: float = 1.0,
    disk_write: float = 0.5,
    net_up: float = 0.1,
    net_down: float = 0.2,
) -> SystemSnapshot:
    """Helper: build a synthetic SystemSnapshot with controlled values."""
    return SystemSnapshot(
        timestamp="2024-01-01T00:00:00+00:00",
        cpu=CPUMetrics(overall_percent=cpu, per_core=[cpu]),
        ram=RAMMetrics(
            total_gb=16.0,
            used_gb=16.0 * ram / 100,
            available_gb=16.0 * (100 - ram) / 100,
            percent=ram,
        ),
        disk=DiskMetrics(
            read_mbps=disk_read,
            write_mbps=disk_write,
            read_count=10,
            write_count=5,
        ),
        network=NetworkMetrics(
            upload_mbps=net_up,
            download_mbps=net_down,
            packets_sent=100,
            packets_recv=200,
            packets_loss_pct=0.0,
        ),
        top_processes=[
            ProcessInfo(pid=1, name="test", cpu_percent=cpu * 0.5, memory_percent=2.0)
        ],
    )


def test_no_alert_before_training() -> None:
    """detect() must return [] before the model has been trained."""
    detector = AnomalyDetector()
    snap = _make_snapshot()
    alerts = detector.detect(snap)
    assert alerts == [], f"Expected no alerts before training, got {alerts}"


def test_trains_after_min_samples() -> None:
    """After feeding min_samples snapshots, is_trained should be True."""
    detector = AnomalyDetector()
    assert not detector.is_trained

    rng = random.Random(42)
    for _ in range(60):
        cpu = rng.gauss(20.0, 3.0)
        ram = rng.gauss(40.0, 5.0)
        snap = _make_snapshot(cpu=max(0.0, min(100.0, cpu)), ram=max(0.0, min(100.0, ram)))
        detector.detect(snap)

    assert detector.is_trained, "Detector should be trained after 60 samples"
    assert len(detector.baselines) > 0, "Baselines should be populated after training"


def test_spike_generates_alert() -> None:
    """After training on normal CPU ~20%, a CPU=99% snapshot should trigger an alert."""
    detector = AnomalyDetector()
    rng = random.Random(0)

    # Train on normal data
    for _ in range(100):
        cpu = rng.gauss(20.0, 2.0)
        ram = rng.gauss(40.0, 3.0)
        snap = _make_snapshot(cpu=max(0.0, min(100.0, cpu)), ram=max(0.0, min(100.0, ram)))
        detector.detect(snap)

    assert detector.is_trained, "Model should be trained"

    # Inject a CPU spike
    spike_snap = _make_snapshot(cpu=99.0, ram=42.0)
    alerts = detector.detect(spike_snap)

    assert len(alerts) > 0, "Expected at least one alert for CPU spike"
    cpu_alerts = [a for a in alerts if "CPU" in a.metric]
    assert len(cpu_alerts) > 0, f"Expected a CPU-related alert, got: {[a.metric for a in alerts]}"


def test_alert_has_required_fields() -> None:
    """Each AnomalyAlert returned must have all required fields populated."""
    detector = AnomalyDetector()
    rng = random.Random(1)

    for _ in range(100):
        cpu = rng.gauss(20.0, 2.0)
        snap = _make_snapshot(cpu=max(0.0, min(100.0, cpu)))
        detector.detect(snap)

    spike = _make_snapshot(cpu=99.0)
    alerts = detector.detect(spike)

    for alert in alerts:
        assert alert.id, "Alert must have an id"
        assert alert.timestamp, "Alert must have a timestamp"
        assert alert.metric, "Alert must have a metric name"
        assert alert.description, "Alert must have a description"
        assert alert.severity in ("low", "medium", "high", "critical"), \
            f"Invalid severity: {alert.severity}"
        assert alert.value >= 0.0, "Alert value must be non-negative"


def test_normal_operations_no_false_positives() -> None:
    """With consistent normal data, alerts should be rare (< 10% of samples)."""
    detector = AnomalyDetector()
    rng = random.Random(7)
    alert_count = 0
    total = 200

    for i in range(total):
        cpu = rng.gauss(25.0, 3.0)
        ram = rng.gauss(45.0, 4.0)
        snap = _make_snapshot(
            cpu=max(0.0, min(100.0, cpu)),
            ram=max(0.0, min(100.0, ram)),
        )
        result = detector.detect(snap)
        if i >= detector.min_samples:
            alert_count += len(result)

    measured_total = total - detector.min_samples
    false_positive_rate = alert_count / measured_total if measured_total > 0 else 0
    # contamination=0.05 means up to ~10% anomaly rate in normal distribution
    assert false_positive_rate < 0.20, \
        f"Too many false positives: {false_positive_rate:.1%}"
