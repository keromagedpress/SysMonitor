import React, { useEffect, useRef } from 'react';

interface MetricGaugeProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
}

const SIZE = 140;
const STROKE_WIDTH = 12;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
// Arc spans 270° starting from bottom-left (225°) to bottom-right (315° via 0°)
const ARC_ANGLE = 270;
const START_ANGLE_DEG = 135; // in standard math coords (clockwise from right)

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function MetricGauge({ value, max, label, unit, color }: MetricGaugeProps) {
  const animValueRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const textRef = useRef<SVGTextElement>(null);

  useEffect(() => {
    const target = Math.min(Math.max(value, 0), max);

    const animate = () => {
      animValueRef.current += (target - animValueRef.current) * 0.1;
      const pct = animValueRef.current / max;
      const sweepAngle = pct * ARC_ANGLE;
      const endAngle = START_ANGLE_DEG + sweepAngle;

      if (pathRef.current) {
        pathRef.current.setAttribute(
          'd',
          describeArc(CENTER, CENTER, RADIUS, START_ANGLE_DEG, endAngle)
        );
      }
      if (textRef.current) {
        textRef.current.textContent = `${animValueRef.current.toFixed(1)}`;
      }

      if (Math.abs(target - animValueRef.current) > 0.05) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, max]);

  // Track arc (background)
  const trackPath = describeArc(CENTER, CENTER, RADIUS, START_ANGLE_DEG, START_ANGLE_DEG + ARC_ANGLE);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--surface)',
        borderRadius: '12px',
        padding: '16px 12px',
        border: '1px solid var(--border)',
        minWidth: '160px',
        flex: 1,
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Glow filter */}
        <defs>
          <filter id={`glow-${label.replace(/\s/g, '')}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Animated value arc */}
        <path
          ref={pathRef}
          d={trackPath}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          filter={`url(#glow-${label.replace(/\s/g, '')})`}
          style={{ transition: 'stroke 0.3s ease' }}
        />

        {/* Center value */}
        <text
          ref={textRef}
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontSize="22"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
        >
          {value.toFixed(1)}
        </text>

        {/* Unit */}
        <text
          x={CENTER}
          y={CENTER + 18}
          textAnchor="middle"
          fill="var(--text-secondary)"
          fontSize="11"
          fontFamily="Inter, sans-serif"
        >
          {unit}
        </text>
      </svg>

      {/* Label below */}
      <div
        style={{
          marginTop: '4px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default React.memo(MetricGauge);
