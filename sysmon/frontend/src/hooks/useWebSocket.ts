import { useState, useEffect, useRef, useCallback } from 'react';
import type { SystemSnapshot, AnomalyAlert, WebSocketMessage } from '../types/metrics';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const MAX_ALERTS = 200;

interface UseWebSocketReturn {
  isConnected: boolean;
  lastSnapshot: SystemSnapshot | null;
  allAlerts: AnomalyAlert[];
  acknowledgeAlert: (id: string) => void;
  snapshotCount: number;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<SystemSnapshot | null>(null);
  const [allAlerts, setAllAlerts] = useState<AnomalyAlert[]>([]);
  const [snapshotCount, setSnapshotCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef<number>(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        reconnectDelayRef.current = 1000; // reset backoff
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const msg: WebSocketMessage = JSON.parse(event.data as string);

          if (msg.type === 'init' && Array.isArray(msg.alerts)) {
            setAllAlerts(msg.alerts.slice(-MAX_ALERTS));
          } else if (msg.type === 'snapshot') {
            if (msg.data) {
              setLastSnapshot(msg.data);
              setSnapshotCount(prev => prev + 1);
            }
            if (Array.isArray(msg.alerts) && msg.alerts.length > 0) {
              setAllAlerts(prev => {
                const updated = [...msg.alerts, ...prev];
                return updated.slice(0, MAX_ALERTS);
              });
            }
          }
        } catch (err) {
          console.error('[useWebSocket] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;

        // Exponential backoff reconnect (1s → 2s → 4s → … → 30s max)
        const delay = Math.min(reconnectDelayRef.current, 30000);
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
        console.info(`[useWebSocket] Reconnecting in ${delay}ms…`);
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = (err) => {
        console.error('[useWebSocket] WebSocket error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('[useWebSocket] Failed to create WebSocket:', err);
      const delay = Math.min(reconnectDelayRef.current, 30000);
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
      reconnectTimerRef.current = setTimeout(connect, delay);
    }
  }, [url]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  const acknowledgeAlert = useCallback((id: string) => {
    fetch(`${API_URL}/alerts/${id}/acknowledge`, { method: 'POST' })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setAllAlerts(prev =>
          prev.map(a => (a.id === id ? { ...a, acknowledged: true } : a))
        );
      })
      .catch(err => {
        console.error('[useWebSocket] Failed to acknowledge alert:', err);
      });
  }, []);

  return { isConnected, lastSnapshot, allAlerts, acknowledgeAlert, snapshotCount };
}
