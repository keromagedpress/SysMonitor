import React, { useEffect, useRef } from 'react';
import type { AnomalyAlert, SeverityLevel } from '../types/metrics';
import { format, parseISO } from 'date-fns';

interface AlertCardProps {
  alert: AnomalyAlert;
  onAcknowledge: (id: string) => void;
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#ff2222',
  high: '#ff6622',
  medium: '#ffaa22',
  low: '#22aaff',
};

const SEVERITY_BG: Record<SeverityLevel, string> = {
  critical: 'rgba(255,34,34,0.08)',
  high: 'rgba(255,102,34,0.08)',
  medium: 'rgba(255,170,34,0.08)',
  low: 'rgba(34,170,255,0.08)',
};

function formatTimestamp(ts: string): string {
  try {
    return format(parseISO(ts), 'HH:mm:ss dd/MM/yyyy');
  } catch {
    return ts;
  }
}

function AlertCard({ alert, onAcknowledge }: AlertCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const color = SEVERITY_COLORS[alert.severity] ?? '#888';
  const bg = SEVERITY_BG[alert.severity] ?? 'rgba(128,128,128,0.08)';

  useEffect(() => {
    const el = cardRef.current;
    if (el) {
      el.style.animation = 'none';
      void el.offsetHeight; // trigger reflow
      el.style.animation = 'fadeIn 0.35s ease forwards';
    }
  }, [alert.id]);

  return (
    <div
      ref={cardRef}
      className="alert-card"
      style={{
        borderLeft: `4px solid ${color}`,
        background: bg,
        opacity: alert.acknowledged ? 0.5 : 1,
        transition: 'opacity 0.3s ease',
        padding: '12px 16px',
        borderRadius: '0 8px 8px 0',
        marginBottom: '8px',
        animation: 'fadeIn 0.35s ease forwards',
        position: 'relative',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        {/* Severity badge */}
        <span
          style={{
            background: color,
            color: '#fff',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {alert.severity}
        </span>

        {/* Metric name */}
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '14px' }}>
          {alert.metric}
        </span>

        {/* Timestamp pushed right */}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)' }}>
          {formatTimestamp(alert.timestamp)}
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {alert.description}
      </p>

      {/* Value / threshold row */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <span>Value: <strong style={{ color }}>{alert.value.toFixed(2)}</strong></span>
        <span>Threshold: <strong style={{ color: 'var(--text-primary)' }}>{alert.threshold.toFixed(2)}</strong></span>
      </div>

      {/* Acknowledge button */}
      {!alert.acknowledged && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            border: `1px solid ${color}`,
            color: color,
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = color + '22'; }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'transparent'; }}
        >
          Acknowledge
        </button>
      )}

      {alert.acknowledged && (
        <span
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
          }}
        >
          ✓ Acknowledged
        </span>
      )}
    </div>
  );
}

export default React.memo(AlertCard);
