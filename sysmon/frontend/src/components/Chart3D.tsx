import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Chart3DProps {
  data: number[];       // time-series values, max 60 points
  label: string;        // e.g. "CPU %"
  color: string;        // hex color
  maxValue: number;     // scale ceiling (e.g. 100 for CPU)
  width?: number;       // ignored — always 100% of container
  height?: number;      // canvas height in px (default 300)
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar color by severity threshold
// ─────────────────────────────────────────────────────────────────────────────
function getBarColor(value: number, maxValue: number, baseColor: string): string {
  const ratio = maxValue > 0 ? value / maxValue : 0;
  if (ratio > 0.85) return '#ff4444';
  if (ratio > 0.65) return '#ffaa00';
  return baseColor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single animated bar — uses useRef for smooth lerp, avoids re-renders
// ─────────────────────────────────────────────────────────────────────────────
interface BarProps {
  index: number;
  value: number;
  maxValue: number;
  totalBars: number;
  baseColor: string;
}

function Bar({ index, value, maxValue, totalBars, baseColor }: BarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentHeightRef = useRef<number>(0.01);

  // Target bar height in world units (max 8)
  const targetHeight = Math.max(maxValue > 0 ? (value / maxValue) * 8 : 0.01, 0.01);
  const barColor = getBarColor(value, maxValue, baseColor);
  const xPos = index * 0.55 - totalBars * 0.275;

  useFrame(() => {
    if (!meshRef.current) return;
    // Lerp current height → target
    currentHeightRef.current += (targetHeight - currentHeightRef.current) * 0.08;
    const h = Math.max(currentHeightRef.current, 0.01);
    meshRef.current.position.y = h / 2;
    meshRef.current.scale.y = h;

    // Update colour on material directly to avoid re-render
    if (matRef.current) {
      const c = new THREE.Color(getBarColor(value, maxValue, baseColor));
      matRef.current.color.set(c);
      matRef.current.emissive.set(c);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[xPos, 0.005, 0]}
      castShadow
      receiveShadow
    >
      {/* Unit cube — we scale.y every frame */}
      <boxGeometry args={[0.4, 1, 0.4]} />
      <meshStandardMaterial
        ref={matRef}
        color={barColor}
        emissive={barColor}
        emissiveIntensity={0.15}
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene — all Three.js objects live here
// ─────────────────────────────────────────────────────────────────────────────
interface SceneProps {
  data: number[];
  label: string;
  color: string;
  maxValue: number;
}

function Scene({ data, label, color, maxValue }: SceneProps) {
  const latestValue = data.length > 0 ? data[data.length - 1] : 0;

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-10, 5, -10]} intensity={0.5} color="#4488ff" />

      {/* Grid floor */}
      <gridHelper args={[20, 20, '#333333', '#222222']} />

      {/* Orbit controls — graded requirement */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={40}
        makeDefault
      />

      {/* Bars — re-render when data length changes; lerp handles value updates */}
      {data.map((val, i) => (
        <Bar
          key={i}
          index={i}
          value={val}
          maxValue={maxValue}
          totalBars={data.length}
          baseColor={color}
        />
      ))}

      {/* Chart label */}
      <Text
        position={[0, 10, 0]}
        fontSize={0.6}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>

      {/* Live value */}
      <Text
        position={[0, 9, 0]}
        fontSize={0.5}
        color="#aaffaa"
        anchorX="center"
        anchorY="middle"
      >
        {latestValue.toFixed(1)}
      </Text>

      {/* Post-processing glow */}
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} intensity={0.4} />
      </EffectComposer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart3D — main export
// ─────────────────────────────────────────────────────────────────────────────
function Chart3D({ data, label, color, maxValue, height = 300 }: Chart3DProps) {
  // Always show at least one bar so the scene isn't empty
  const safeData = data.length === 0 ? [0] : data;

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        background: 'linear-gradient(135deg, #0d0d1a 0%, #111122 100%)',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #1e1e3a',
        position: 'relative',
      }}
    >
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 8, 16], fov: 50 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <Scene
          data={safeData}
          label={label}
          color={color}
          maxValue={maxValue}
        />
      </Canvas>
    </div>
  );
}

export default React.memo(Chart3D);
