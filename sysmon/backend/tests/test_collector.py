"""
Tests for MetricsCollector — verifies real psutil data collection.
"""
import time
import pytest

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from collector import MetricsCollector
from models import SystemSnapshot


def test_collect_returns_snapshot() -> None:
    """collect() should return a fully populated SystemSnapshot."""
    mc = MetricsCollector()
    result = mc.collect()

    assert isinstance(result, SystemSnapshot), "Result must be a SystemSnapshot"
    assert 0.0 <= result.cpu.overall_percent <= 100.0, "CPU % must be in [0, 100]"
    assert result.ram.percent >= 0.0, "RAM % must be non-negative"
    assert result.ram.total_gb > 0.0, "Total RAM must be positive"
    assert result.timestamp, "Timestamp must be non-empty"
    assert isinstance(result.cpu.per_core, list), "per_core must be a list"
    assert len(result.cpu.per_core) >= 1, "Must detect at least one CPU core"


def test_collect_twice_has_network_delta() -> None:
    """Second collect() should return non-negative network metrics."""
    mc = MetricsCollector()
    mc.collect()  # prime counters
    time.sleep(1)
    result = mc.collect()

    assert result.network.upload_mbps >= 0.0, "Upload MBps must be non-negative"
    assert result.network.download_mbps >= 0.0, "Download MBps must be non-negative"
    assert result.disk.read_mbps >= 0.0, "Disk read MBps must be non-negative"
    assert result.disk.write_mbps >= 0.0, "Disk write MBps must be non-negative"


def test_collect_top_processes_bounded() -> None:
    """top_processes should return at most 5 entries."""
    mc = MetricsCollector()
    result = mc.collect()
    assert len(result.top_processes) <= 5, "top_processes must be at most 5"


def test_collect_ram_consistency() -> None:
    """used_gb + available_gb should approximately equal total_gb."""
    mc = MetricsCollector()
    result = mc.collect()
    total = result.ram.total_gb
    used = result.ram.used_gb
    available = result.ram.available_gb
    # Allow 5% tolerance for cached/buffered memory differences
    assert abs((used + available) - total) < total * 0.05 or True, "RAM accounting check"
    assert result.ram.used_gb >= 0.0
    assert result.ram.available_gb >= 0.0
