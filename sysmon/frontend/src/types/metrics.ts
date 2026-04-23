// Type definitions mirroring backend Pydantic models exactly.

export interface CPUMetrics {
  overall_percent: number;
  per_core: number[];
}

export interface RAMMetrics {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  percent: number;
}

export interface DiskMetrics {
  read_mbps: number;
  write_mbps: number;
  read_count: number;
  write_count: number;
}

export interface NetworkMetrics {
  upload_mbps: number;
  download_mbps: number;
  packets_sent: number;
  packets_recv: number;
  packets_loss_pct: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

export interface SystemSnapshot {
  timestamp: string;
  cpu: CPUMetrics;
  ram: RAMMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
  top_processes: ProcessInfo[];
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyAlert {
  id: string;
  timestamp: string;
  metric: string;
  description: string;
  severity: SeverityLevel;
  value: number;
  threshold: number;
  acknowledged: boolean;
}

export interface WebSocketMessage {
  type: 'snapshot' | 'init';
  data?: SystemSnapshot;
  alerts: AnomalyAlert[];
}
