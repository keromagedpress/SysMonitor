import { useState, useCallback } from 'react';
import type { SystemSnapshot } from '../types/metrics';

export interface MetricsHistory {
  cpuHistory: number[];
  ramHistory: number[];
  diskReadHistory: number[];
  diskWriteHistory: number[];
  netUpHistory: number[];
  netDownHistory: number[];
  addSnapshot: (snap: SystemSnapshot) => void;
}

function cappedPush(arr: number[], value: number, max: number): number[] {
  const next = [...arr, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function useMetricsHistory(maxPoints: number = 60): MetricsHistory {
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [diskReadHistory, setDiskReadHistory] = useState<number[]>([]);
  const [diskWriteHistory, setDiskWriteHistory] = useState<number[]>([]);
  const [netUpHistory, setNetUpHistory] = useState<number[]>([]);
  const [netDownHistory, setNetDownHistory] = useState<number[]>([]);

  const addSnapshot = useCallback((snap: SystemSnapshot) => {
    setCpuHistory(prev => cappedPush(prev, snap.cpu.overall_percent, maxPoints));
    setRamHistory(prev => cappedPush(prev, snap.ram.percent, maxPoints));
    setDiskReadHistory(prev => cappedPush(prev, snap.disk.read_mbps, maxPoints));
    setDiskWriteHistory(prev => cappedPush(prev, snap.disk.write_mbps, maxPoints));
    setNetUpHistory(prev => cappedPush(prev, snap.network.upload_mbps, maxPoints));
    setNetDownHistory(prev => cappedPush(prev, snap.network.download_mbps, maxPoints));
  }, [maxPoints]);

  return {
    cpuHistory,
    ramHistory,
    diskReadHistory,
    diskWriteHistory,
    netUpHistory,
    netDownHistory,
    addSnapshot,
  };
}
