import React, { useState, useMemo } from 'react';
import type { AnomalyAlert, SeverityLevel } from '../types/metrics';
import AlertCard from './AlertCard';

interface AlertPanelProps {
  alerts: AnomalyAlert[];
  onAcknowledge: (id: string) => void;
}

type FilterLevel = 'all' | SeverityLevel;

const FILTERS: FilterLevel[] = ['all', 'critical', 'high', 'medium', 'low'];

const FILTER_COLORS: Record<FilterLevel, string> = {
  all: '#00d4ff',
  critical: '#ff2222',
  high: '#ff6622',
  medium: '#ffaa22',
  low: '#22aaff',
};

function AlertPanel({ alerts, onAcknowledge }: AlertPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterLevel>('all');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return alerts;
    return alerts.filter(a => a.severity === activeFilter);
  }, [alerts, activeFilter]);

  const hasUrgent = alerts.some(
    a => !a.acknowledged && (a.severity === 'critical' || a.severity === 'high')
  );
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  const handleAcknowledgeAll = () => {
    alerts.forEach(a => {
      if (!a.acknowledged) {
        onAcknowledge(a.id);
      }
    });
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: '350px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
          background: 'rgba(0,212,255,0.03)',
        }}
      >
        {/* Pulsing dot for urgent alerts */}
        {hasUrgent && (
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ff2222',
              display: 'inline-block',
              animation: 'pulse 1.2s ease-in-out infinite',
              flexShrink: 0,
            }}
          />
        )}

        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
          AI Anomaly Alerts
        </h2>

        {/* Count badge */}
        <span
          style={{
            background: alerts.length > 0 ? '#00d4ff22' : '#ffffff11',
            color: alerts.length > 0 ? '#00d4ff' : 'var(--text-secondary)',
            border: `1px solid ${alerts.length > 0 ? '#00d4ff44' : '#ffffff22'}`,
            borderRadius: '999px',
            padding: '1px 8px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {alerts.length}
        </span>

        {unacknowledgedCount > 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            ({unacknowledgedCount} unacknowledged)
          </span>
        )}

        {/* Acknowledge all button */}
        {unacknowledgedCount > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid #00d4ff44',
              color: '#00d4ff',
              fontSize: '12px',
              padding: '4px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#00d4ff11'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent'; }}
          >
            Acknowledge All
          </button>
        )}
      </div>

      {/* Filter row */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '10px 18px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          const col = FILTER_COLORS[f];
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                background: isActive ? col + '22' : 'transparent',
                border: `1px solid ${isActive ? col : '#ffffff22'}`,
                color: isActive ? col : 'var(--text-secondary)',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 400,
                padding: '3px 10px',
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Scrollable list */}
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          padding: '10px 18px',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>✓</span>
            <span>No anomalies detected — system is healthy ✓</span>
          </div>
        ) : (
          filtered.map(alert => (
            <AlertCard key={alert.id} alert={alert} onAcknowledge={onAcknowledge} />
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(AlertPanel);
