import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface StatusBarProps {
  isConnected: boolean;
  alertCount: number;
  snapshotCount: number;
}

function StatusBar({ isConnected, alertCount, snapshotCount }: StatusBarProps) {
  const [currentTime, setCurrentTime] = useState<string>(format(new Date(), 'HH:mm:ss'));
  const isTrained = snapshotCount >= 50;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: '12px 24px',
        background: 'linear-gradient(90deg, #0d0d1a 0%, #111128 50%, #0d0d1a 100%)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* App title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isConnected ? '#00ff88' : '#ff4444',
            boxShadow: isConnected ? '0 0 8px #00ff88' : '0 0 8px #ff4444',
            display: 'inline-block',
            animation: isConnected ? 'pulse 2s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: '18px',
            fontWeight: 800,
            background: 'linear-gradient(90deg, #00d4ff, #7c4dff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em',
          }}
        >
          SysMonitor AI
        </span>
      </div>

      {/* Divider */}
      <span style={{ color: 'var(--border)', fontSize: '18px' }}>|</span>

      {/* Connection status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {isConnected ? 'Connected to backend' : 'Disconnected — reconnecting…'}
        </span>
      </div>

      {/* AI training status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {isTrained ? (
          <>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#00d4ff',
                boxShadow: '0 0 6px #00d4ff',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '12px', color: '#00d4ff', fontWeight: 600 }}>
              AI Active ✓
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid #ffaa22',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ fontSize: '12px', color: '#ffaa22', fontWeight: 600 }}>
              AI Training… ({snapshotCount}/50)
            </span>
          </>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Alert count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Alerts:</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: alertCount > 0 ? '#ff6622' : '#00ff88',
          }}
        >
          {alertCount}
        </span>
      </div>

      {/* Divider */}
      <span style={{ color: 'var(--border)', fontSize: '18px' }}>|</span>

      {/* Clock */}
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: 'monospace',
        }}
      >
        {currentTime}
      </span>
    </div>
  );
}

export default React.memo(StatusBar);
