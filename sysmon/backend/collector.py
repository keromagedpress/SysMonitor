"""
MetricsCollector — gathers real-time system metrics via psutil.
Uses delta-based calculations for I/O and Network throughput.
"""
import time
import psutil
from datetime import datetime, timezone
from typing import Optional

from models import (
    CPUMetrics, RAMMetrics, DiskMetrics, NetworkMetrics,
    ProcessInfo, SystemSnapshot
)


class MetricsCollector:
    """
    Collects system performance metrics using psutil.
    Maintains previous counters to compute per-interval rates.
    """

    def __init__(self) -> None:
        self._prev_disk_counters: Optional[psutil._common.sdiskio] = None
        self._prev_net_counters: Optional[psutil._common.snetio] = None
        self._prev_time: float = time.monotonic()

        # Prime CPU measurement (first call always returns 0.0)
        psutil.cpu_percent(percpu=True)

    def collect(self) -> SystemSnapshot:
        """
        Collect a full system snapshot. Returns a SystemSnapshot instance.
        I/O and Network values are computed as delta since last call.
        """
        now = time.monotonic()
        elapsed = now - self._prev_time
        if elapsed <= 0:
            elapsed = 1.0

        # ── CPU ──────────────────────────────────────────────────────────────
        per_core: list[float] = psutil.cpu_percent(percpu=True)
        overall_percent: float = sum(per_core) / len(per_core) if per_core else 0.0
        cpu_metrics = CPUMetrics(
            overall_percent=round(overall_percent, 2),
            per_core=[round(c, 2) for c in per_core],
        )

        # ── RAM ──────────────────────────────────────────────────────────────
        vm = psutil.virtual_memory()
        ram_metrics = RAMMetrics(
            total_gb=round(vm.total / 1_073_741_824, 2),
            used_gb=round(vm.used / 1_073_741_824, 2),
            available_gb=round(vm.available / 1_073_741_824, 2),
            percent=round(vm.percent, 2),
        )

        # ── Disk I/O ─────────────────────────────────────────────────────────
        current_disk = psutil.disk_io_counters()
        if self._prev_disk_counters is None or current_disk is None:
            read_mbps = write_mbps = 0.0
            read_count = write_count = 0
        else:
            read_bytes_delta = max(0, current_disk.read_bytes - self._prev_disk_counters.read_bytes)
            write_bytes_delta = max(0, current_disk.write_bytes - self._prev_disk_counters.write_bytes)
            read_mbps = round(read_bytes_delta / elapsed / 1_048_576, 4)
            write_mbps = round(write_bytes_delta / elapsed / 1_048_576, 4)
            read_count = max(0, current_disk.read_count - self._prev_disk_counters.read_count)
            write_count = max(0, current_disk.write_count - self._prev_disk_counters.write_count)

        if current_disk is not None:
            self._prev_disk_counters = current_disk

        disk_metrics = DiskMetrics(
            read_mbps=read_mbps,
            write_mbps=write_mbps,
            read_count=read_count,
            write_count=write_count,
        )

        # ── Network ──────────────────────────────────────────────────────────
        current_net = psutil.net_io_counters()
        if self._prev_net_counters is None or current_net is None:
            upload_mbps = download_mbps = 0.0
            packets_sent = packets_recv = 0
            packets_loss_pct = 0.0
        else:
            sent_bytes_delta = max(0, current_net.bytes_sent - self._prev_net_counters.bytes_sent)
            recv_bytes_delta = max(0, current_net.bytes_recv - self._prev_net_counters.bytes_recv)
            upload_mbps = round(sent_bytes_delta / elapsed / 1_048_576, 4)
            download_mbps = round(recv_bytes_delta / elapsed / 1_048_576, 4)
            packets_sent = max(0, current_net.packets_sent - self._prev_net_counters.packets_sent)
            packets_recv = max(0, current_net.packets_recv - self._prev_net_counters.packets_recv)

            dropin = getattr(current_net, 'dropin', 0) or 0
            prev_dropin = getattr(self._prev_net_counters, 'dropin', 0) or 0
            dropout = getattr(current_net, 'dropout', 0) or 0
            prev_dropout = getattr(self._prev_net_counters, 'dropout', 0) or 0
            total_drops = max(0, (dropin - prev_dropin) + (dropout - prev_dropout))
            total_packets = packets_sent + packets_recv
            packets_loss_pct = round((total_drops / total_packets * 100) if total_packets > 0 else 0.0, 4)

        if current_net is not None:
            self._prev_net_counters = current_net

        net_metrics = NetworkMetrics(
            upload_mbps=upload_mbps,
            download_mbps=download_mbps,
            packets_sent=packets_sent,
            packets_recv=packets_recv,
            packets_loss_pct=packets_loss_pct,
        )

        # ── Processes ─────────────────────────────────────────────────────────
        processes: list[ProcessInfo] = []
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                info = proc.info
                processes.append(ProcessInfo(
                    pid=info['pid'],
                    name=info['name'] or 'unknown',
                    cpu_percent=round(float(info.get('cpu_percent') or 0.0), 2),
                    memory_percent=round(float(info.get('memory_percent') or 0.0), 4),
                ))
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

        top_processes = sorted(processes, key=lambda p: p.cpu_percent, reverse=True)[:5]

        # ── Update timing ─────────────────────────────────────────────────────
        self._prev_time = now

        return SystemSnapshot(
            timestamp=datetime.now(timezone.utc).isoformat(),
            cpu=cpu_metrics,
            ram=ram_metrics,
            disk=disk_metrics,
            network=net_metrics,
            top_processes=top_processes,
        )
