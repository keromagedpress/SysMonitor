"""
Pydantic data models for SysMonitor AI.
All models are shared between collector, anomaly detector, and FastAPI endpoints.
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CPUMetrics(BaseModel):
    overall_percent: float
    per_core: list[float]


class RAMMetrics(BaseModel):
    total_gb: float
    used_gb: float
    available_gb: float
    percent: float


class DiskMetrics(BaseModel):
    read_mbps: float
    write_mbps: float
    read_count: int
    write_count: int


class NetworkMetrics(BaseModel):
    upload_mbps: float
    download_mbps: float
    packets_sent: int
    packets_recv: int
    packets_loss_pct: float


class ProcessInfo(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float


class SystemSnapshot(BaseModel):
    timestamp: str
    cpu: CPUMetrics
    ram: RAMMetrics
    disk: DiskMetrics
    network: NetworkMetrics
    top_processes: list[ProcessInfo]


class AnomalyAlert(BaseModel):
    id: str
    timestamp: str
    metric: str
    description: str
    severity: str  # "low", "medium", "high", "critical"
    value: float
    threshold: float
    acknowledged: bool = False
