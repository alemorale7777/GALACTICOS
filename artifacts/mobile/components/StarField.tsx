import React, { memo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

// Warm amber/gold fireflies instead of cold stars
const FIREFLY_COLORS = [
  'rgba(255,210,80,',
  'rgba(255,240,140,',
  'rgba(200,255,140,',
  'rgba(255,180,60,',
  'rgba(240,255,200,',
];

const fireflies = Array.from({ length: 220 }, (_, i) => ({
  id: i,
  x: Math.random() * W,
  y: Math.random() * H,
  r: 0.3 + Math.random() * 1.6,
  a: 0.06 + Math.random() * 0.62,
  color: FIREFLY_COLORS[i % FIREFLY_COLORS.length],
}));

// Bright spark fireflies with glow
const sparks = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  x: Math.random() * W,
  y: Math.random() * H,
  r: 1.4 + Math.random() * 1.4,
  flare: 12 + Math.random() * 16,
}));

// Fog/mist patches — earthy, misty, soft
const fogPatches = [
  { x: W * 0.08, y: H * 0.15, r: 200, color: '80,100,60',   a: 0.07  },
  { x: W * 0.82, y: H * 0.72, r: 230, color: '60,90,50',    a: 0.065 },
  { x: W * 0.45, y: H * 0.45, r: 170, color: '100,110,60',  a: 0.055 },
  { x: W * 0.22, y: H * 0.80, r: 140, color: '70,80,40',    a: 0.06  },
  { x: W * 0.70, y: H * 0.20, r: 120, color: '120,130,70',  a: 0.048 },
  { x: W * 0.92, y: H * 0.40, r: 90,  color: '160,140,60',  a: 0.040 },
];

// Dark forest clusters as blobs
const forestBlobs = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: (i % 4 < 2 ? Math.random() * W * 0.2 : W * 0.8 + Math.random() * W * 0.2),
  y: Math.random() * H,
  r: 20 + Math.random() * 35,
}));

export default memo(function StarField() {
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' } as any]}
      width={W}
      height={H}
    >
      <Defs>
        {fogPatches.map((n, i) => (
          <RadialGradient key={`fog${i}`} id={`fog${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor={`rgb(${n.color})`} stopOpacity={n.a} />
            <Stop offset="55%"  stopColor={`rgb(${n.color})`} stopOpacity={n.a * 0.35} />
            <Stop offset="100%" stopColor={`rgb(${n.color})`} stopOpacity="0" />
          </RadialGradient>
        ))}
        <RadialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="rgb(255,230,120)" stopOpacity="0.9" />
          <Stop offset="60%"  stopColor="rgb(255,200,60)"  stopOpacity="0.15" />
          <Stop offset="100%" stopColor="rgb(255,200,60)"  stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Dark forest edge blobs */}
      {forestBlobs.map(b => (
        <Circle key={`fb${b.id}`} cx={b.x} cy={b.y} r={b.r}
          fill="rgba(10,20,8,0.65)" />
      ))}

      {/* Fog/mist patches */}
      {fogPatches.map((n, i) => (
        <Circle key={`fog${i}`} cx={n.x} cy={n.y} r={n.r} fill={`url(#fog${i})`} />
      ))}

      {/* Firefly dots */}
      {fireflies.map(s => (
        <Circle key={s.id} cx={s.x} cy={s.y} r={s.r}
          fill={`${s.color}${s.a.toFixed(2)})`} />
      ))}

      {/* Bright spark fireflies with glow */}
      {sparks.map(s => (
        <G key={`sp${s.id}`}>
          <Circle cx={s.x} cy={s.y} r={s.r * 3.5} fill="url(#sparkGlow)" />
          {/* Small cross glimmer */}
          <Line x1={s.x - s.flare} y1={s.y} x2={s.x + s.flare} y2={s.y}
            stroke="rgba(255,220,80,0.14)" strokeWidth={0.8} />
          <Line x1={s.x} y1={s.y - s.flare} x2={s.x} y2={s.y + s.flare}
            stroke="rgba(255,220,80,0.14)" strokeWidth={0.8} />
          <Circle cx={s.x} cy={s.y} r={s.r} fill="rgba(255,240,160,0.95)" />
        </G>
      ))}
    </Svg>
  );
});
