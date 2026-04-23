import React, { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useMetricsHistory } from './hooks/useMetricsHistory';
import StatusBar from './components/StatusBar';
import MetricGauge from './components/MetricGauge';
import Chart3D from './components/Chart3D';
import AlertPanel from './components/AlertPanel';
import './styles/global.css';

// Connect directly to the FastAPI backend WebSocket.
// Vite's own WebSocket (HMR) conflicts with proxied WebSockets on the same port,
// so we connect directly to port 8000. CORS is open on the backend.
const WS_URL =
  import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:8000/ws`;

function App() {
  const { isConnected, lastSnapshot, allAlerts, acknowledgeAlert, snapshotCount } =
    useWebSocket(WS_URL);

  const {
    cpuHistory,
    ramHistory,
    diskWriteHistory,
    netUpHistory,
    addSnapshot,
  } = useMetricsHistory(60);

  // Feed new snapshots into the rolling history buffers
  useEffect(() => {
    if (lastSnapshot) {
      addSnapshot(lastSnapshot);
    }
  }, [lastSnapshot, addSnapshot]);

  // Current metric values (fall back to 0 when no data yet)
  const cpuVal       = lastSnapshot?.cpu.overall_percent ?? 0;
  const ramVal       = lastSnapshot?.ram.percent         ?? 0;
  const diskWriteVal = lastSnapshot?.disk.write_mbps     ?? 0;
  const netUpVal     = lastSnapshot?.network.upload_mbps ?? 0;

  // Dynamic ceiling for disk / network gauges
  const diskMax = Math.max(100, Math.ceil((lastSnapshot?.disk.write_mbps ?? 0) * 2));
  const netMax  = Math.max(10,  Math.ceil((lastSnapshot?.network.upload_mbps ?? 0) * 2));

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text-primary)',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* ── Status Bar ─────────────────────────────────────────────────── */}
      <StatusBar
        isConnected={isConnected}
        alertCount={allAlerts.length}
        snapshotCount={snapshotCount}
      />

      {/* ── Gauges Row ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          padding: '16px 24px 8px',
          flexShrink: 0,
        }}
      >
        <MetricGauge value={cpuVal}       max={100}     label="CPU"        unit="%"     color="#00d4ff" />
        <MetricGauge value={ramVal}       max={100}     label="RAM"        unit="%"     color="#7c4dff" />
        <MetricGauge value={diskWriteVal} max={diskMax} label="Disk Write" unit="MB/s"  color="#ff6d00" />
        <MetricGauge value={netUpVal}     max={netMax}  label="Net Upload" unit="MB/s"  color="#00e676" />
      </div>

      {/* ── 3D Charts Row ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          padding: '8px 24px',
          flexShrink: 0,
        }}
      >
        {/* CPU */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="chart-label">CPU Usage %</span>
          <Chart3D
            data={cpuHistory}
            label="CPU %"
            color="#00d4ff"
            maxValue={100}
            height={280}
          />
        </div>

        {/* RAM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="chart-label">RAM Usage %</span>
          <Chart3D
            data={ramHistory}
            label="RAM %"
            color="#7c4dff"
            maxValue={100}
            height={280}
          />
        </div>

        {/* Disk Write */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="chart-label">Disk Write MB/s</span>
          <Chart3D
            data={diskWriteHistory}
            label="Disk Write"
            color="#ff6d00"
            maxValue={Math.max(50, diskMax)}
            height={280}
          />
        </div>

        {/* Net Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span className="chart-label">Net Upload MB/s</span>
          <Chart3D
            data={netUpHistory}
            label="Net Upload"
            color="#00e676"
            maxValue={Math.max(10, netMax)}
            height={280}
          />
        </div>
      </div>

      {/* ── Alert Panel ────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 24px 24px', flexShrink: 0 }}>
        <AlertPanel alerts={allAlerts} onAcknowledge={acknowledgeAlert} />
      </div>
    </div>
  );
}

export default App;
