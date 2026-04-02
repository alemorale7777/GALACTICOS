import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EmpireConfig, EmpireId, EMPIRE_CONFIG, EMPIRE_IDS } from '@/constants/empires';

interface Props {
  onSelect: (empireId: EmpireId) => void;
  empireMastery?: Record<EmpireId, number>;
  empireXP?: Record<EmpireId, number>;
}

// ── Empire emblem SVG shapes ─────────────────────────────────────────────────

function EgyptEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const peak = cy - r;
  const base = cy + r * 0.45;
  const gL = cx - r * 0.22, gR = cx + r * 0.22, gTop = base - r * 0.38;
  const d = [
    `M${(cx - r).toFixed(1)},${base.toFixed(1)}`,
    `L${cx.toFixed(1)},${peak.toFixed(1)}`,
    `L${(cx + r).toFixed(1)},${base.toFixed(1)}`,
    `L${gR.toFixed(1)},${base.toFixed(1)}`,
    `L${gR.toFixed(1)},${gTop.toFixed(1)}`,
    `Q${cx.toFixed(1)},${(gTop - r * 0.12).toFixed(1)} ${gL.toFixed(1)},${gTop.toFixed(1)}`,
    `L${gL.toFixed(1)},${base.toFixed(1)} Z`,
  ].join(' ');
  const band1 = peak + (base - peak) * 0.33;
  const band2 = peak + (base - peak) * 0.62;
  const bandW1 = (r * 2) * 0.33;
  const bandW2 = (r * 2) * 0.62;
  return (
    <Svg width={size} height={size}>
      <Path d={d} fill={color} opacity={0.9} />
      <Line x1={cx - bandW1 / 2} y1={band1} x2={cx + bandW1 / 2} y2={band1}
        stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <Line x1={cx - bandW2 / 2} y1={band2} x2={cx + bandW2 / 2} y2={band2}
        stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <Circle cx={cx} cy={peak} r={size * 0.04} fill="#FFE066" />
    </Svg>
  );
}

function RomeEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const bot = cy + r * 0.48, top = cy - r * 0.58;
  const wL = cx - r, wR = cx + r;
  const n = 3, segW = (2 * r) / n;
  const pad = r * 0.1;
  const archW = segW - 2 * pad;
  const archMid = cy - r * 0.08;
  const archPeak = cy - r * 0.52;
  let d = `M${wL.toFixed(1)},${bot.toFixed(1)} L${wL.toFixed(1)},${top.toFixed(1)} L${wR.toFixed(1)},${top.toFixed(1)} L${wR.toFixed(1)},${bot.toFixed(1)} Z`;
  for (let i = 0; i < n; i++) {
    const ax = wL + i * segW + pad;
    const ax2 = ax + archW;
    const amx = (ax + ax2) / 2;
    d += ` M${ax.toFixed(1)},${bot.toFixed(1)} L${ax.toFixed(1)},${archMid.toFixed(1)} Q${amx.toFixed(1)},${archPeak.toFixed(1)} ${ax2.toFixed(1)},${archMid.toFixed(1)} L${ax2.toFixed(1)},${bot.toFixed(1)} Z`;
  }
  return (
    <Svg width={size} height={size}>
      <Path d={d} fill={color} fillRule="evenodd" opacity={0.9} />
      <Line x1={wL} y1={top + (bot - top) * 0.22} x2={wR} y2={top + (bot - top) * 0.22}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1.2} />
    </Svg>
  );
}

function MongolsEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.42;
  const peak = cy - r * 0.95, domeBase = cy - r * 0.05, wallBot = cy + r * 0.48;
  const wallW = r * 0.9;
  const d = [
    `M${(cx - wallW).toFixed(1)},${wallBot.toFixed(1)}`,
    `L${(cx - wallW).toFixed(1)},${domeBase.toFixed(1)}`,
    `C${(cx - wallW).toFixed(1)},${(peak + r * 0.3).toFixed(1)} ${(cx - r * 0.12).toFixed(1)},${peak.toFixed(1)} ${cx.toFixed(1)},${peak.toFixed(1)}`,
    `C${(cx + r * 0.12).toFixed(1)},${peak.toFixed(1)} ${(cx + wallW).toFixed(1)},${(peak + r * 0.3).toFixed(1)} ${(cx + wallW).toFixed(1)},${domeBase.toFixed(1)}`,
    `L${(cx + wallW).toFixed(1)},${wallBot.toFixed(1)} Z`,
  ].join(' ');
  const bandY = domeBase + r * 0.08;
  return (
    <Svg width={size} height={size}>
      <Path d={d} fill={color} opacity={0.9} />
      <Line x1={cx - wallW} y1={bandY} x2={cx + wallW} y2={bandY}
        stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      <Line x1={cx} y1={domeBase} x2={cx} y2={peak + r * 0.08}
        stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <Circle cx={cx} cy={peak} r={size * 0.04} fill="#FFCC44" />
    </Svg>
  );
}

function PtolemiacEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const nemTop = cy - r * 0.85, nemW = r * 0.8;
  const flapsY = cy + r * 0.1, flapsW = r;
  const beardBot = cy + r * 0.48, faceW = r * 0.48;
  const d = [
    `M${(cx - nemW).toFixed(1)},${nemTop.toFixed(1)}`,
    `L${(cx + nemW).toFixed(1)},${nemTop.toFixed(1)}`,
    `L${(cx + flapsW).toFixed(1)},${flapsY.toFixed(1)}`,
    `L${(cx + faceW).toFixed(1)},${flapsY.toFixed(1)}`,
    `L${cx.toFixed(1)},${beardBot.toFixed(1)}`,
    `L${(cx - faceW).toFixed(1)},${flapsY.toFixed(1)}`,
    `L${(cx - flapsW).toFixed(1)},${flapsY.toFixed(1)} Z`,
  ].join(' ');
  const eyeY = cy - r * 0.2;
  return (
    <Svg width={size} height={size}>
      <Path d={d} fill={color} opacity={0.9} />
      <Line x1={cx - nemW} y1={nemTop + (flapsY - nemTop) * 0.25}
        x2={cx + nemW} y2={nemTop + (flapsY - nemTop) * 0.25}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
      <Circle cx={cx - r * 0.18} cy={eyeY} r={size * 0.035} fill="rgba(255,255,255,0.4)" />
      <Circle cx={cx + r * 0.18} cy={eyeY} r={size * 0.035} fill="rgba(255,255,255,0.4)" />
    </Svg>
  );
}

function JapanEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const pillarW = r * 0.12;
  const gateW = r * 0.7;
  const topY = cy - r * 0.6;
  const midY = cy - r * 0.15;
  const botY = cy + r * 0.5;
  return (
    <Svg width={size} height={size}>
      {/* Pillars */}
      <Rect x={cx - gateW - pillarW / 2} y={midY} width={pillarW} height={botY - midY} fill={color} opacity={0.9} />
      <Rect x={cx + gateW - pillarW / 2} y={midY} width={pillarW} height={botY - midY} fill={color} opacity={0.9} />
      {/* Top beam */}
      <Path d={`M${cx - gateW - r * 0.15},${topY + r * 0.08} Q${cx},${topY - r * 0.08} ${cx + gateW + r * 0.15},${topY + r * 0.08} L${cx + gateW + r * 0.15},${topY + r * 0.16} Q${cx},${topY + r * 0.02} ${cx - gateW - r * 0.15},${topY + r * 0.16} Z`}
        fill={color} opacity={0.9} />
      {/* Middle beam */}
      <Rect x={cx - gateW} y={midY} width={gateW * 2} height={r * 0.08} fill={color} opacity={0.7} />
      {/* Sun circle */}
      <Circle cx={cx} cy={cy + r * 0.05} r={r * 0.2} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
    </Svg>
  );
}

function VikingsEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const baseL = cx - r * 0.85, baseR = cx + r * 0.85;
  const wallBot = cy + r * 0.5, wallTop = cy - r * 0.1;
  const roofPeak = cy - r * 0.85;
  const doorW = r * 0.2, doorH = r * 0.35;
  return (
    <Svg width={size} height={size}>
      {/* Rectangular base */}
      <Rect x={baseL} y={wallTop} width={baseR - baseL} height={wallBot - wallTop}
        fill={color} opacity={0.9} />
      {/* Curved dome roof */}
      <Path d={`M${baseL.toFixed(1)},${wallTop.toFixed(1)} Q${cx.toFixed(1)},${roofPeak.toFixed(1)} ${baseR.toFixed(1)},${wallTop.toFixed(1)} Z`}
        fill={color} opacity={0.9} />
      {/* Door */}
      <Rect x={cx - doorW} y={wallBot - doorH} width={doorW * 2} height={doorH}
        fill="rgba(0,0,0,0.35)" />
      {/* Crossed lines on front */}
      <Line x1={baseL + r * 0.15} y1={wallTop + r * 0.05} x2={baseR - r * 0.15} y2={wallBot - r * 0.05}
        stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <Line x1={baseR - r * 0.15} y1={wallTop + r * 0.05} x2={baseL + r * 0.15} y2={wallBot - r * 0.05}
        stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      {/* Ridge line */}
      <Line x1={cx} y1={roofPeak + r * 0.08} x2={cx} y2={wallTop}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
    </Svg>
  );
}

function AztecEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const bot = cy + r * 0.5, top = cy - r * 0.7;
  const baseW = r * 0.95, topW = r * 0.3;
  const templeH = r * 0.18;
  const steps = 4;
  // Build step pyramid path
  let d = `M${(cx - baseW).toFixed(1)},${bot.toFixed(1)}`;
  for (let i = 0; i < steps; i++) {
    const frac = i / steps;
    const nextFrac = (i + 1) / steps;
    const w = baseW - (baseW - topW) * frac;
    const nextW = baseW - (baseW - topW) * nextFrac;
    const y = bot - (bot - top) * frac;
    const nextY = bot - (bot - top) * nextFrac;
    if (i === 0) {
      d += ` L${(cx - w).toFixed(1)},${nextY.toFixed(1)}`;
    } else {
      d += ` L${(cx - w).toFixed(1)},${y.toFixed(1)} L${(cx - w).toFixed(1)},${nextY.toFixed(1)}`;
    }
  }
  // Flat top
  d += ` L${(cx - topW).toFixed(1)},${top.toFixed(1)} L${(cx + topW).toFixed(1)},${top.toFixed(1)}`;
  // Right side steps (mirror)
  for (let i = steps - 1; i >= 0; i--) {
    const frac = i / steps;
    const w = baseW - (baseW - topW) * frac;
    const y = bot - (bot - top) * frac;
    const nextFrac = (i + 1) / steps;
    const nextY = bot - (bot - top) * nextFrac;
    d += ` L${(cx + w).toFixed(1)},${nextY.toFixed(1)} L${(cx + w).toFixed(1)},${y.toFixed(1)}`;
  }
  d += ' Z';
  return (
    <Svg width={size} height={size}>
      <Path d={d} fill={color} opacity={0.9} />
      {/* Temple block on top */}
      <Rect x={cx - topW * 0.6} y={top - templeH} width={topW * 1.2} height={templeH}
        fill={color} opacity={0.85} />
      {/* Step lines */}
      {[0.25, 0.5, 0.75].map((f, i) => {
        const y = bot - (bot - top) * f;
        const w = baseW - (baseW - topW) * f;
        return <Line key={i} x1={cx - w} y1={y} x2={cx + w} y2={y}
          stroke="rgba(255,255,255,0.22)" strokeWidth={1} />;
      })}
    </Svg>
  );
}

function PersianEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const baseBot = cy + r * 0.5, baseTop = cy - r * 0.35;
  const baseW = r * 0.85;
  const colW = r * 0.12;
  const archTop = cy - r * 0.2;
  const domeR = r * 0.2;
  const domeY = baseTop - domeR * 0.3;
  return (
    <Svg width={size} height={size}>
      {/* Base rectangle */}
      <Rect x={cx - baseW} y={baseTop} width={baseW * 2} height={baseBot - baseTop}
        fill={color} opacity={0.9} />
      {/* Left column */}
      <Rect x={cx - baseW + colW * 0.5} y={baseTop + r * 0.05}
        width={colW} height={(baseBot - baseTop) * 0.85}
        fill="rgba(255,255,255,0.15)" />
      {/* Right column */}
      <Rect x={cx + baseW - colW * 1.5} y={baseTop + r * 0.05}
        width={colW} height={(baseBot - baseTop) * 0.85}
        fill="rgba(255,255,255,0.15)" />
      {/* Pointed arch doorway */}
      <Path d={`M${(cx - r * 0.25).toFixed(1)},${baseBot.toFixed(1)} L${(cx - r * 0.25).toFixed(1)},${archTop.toFixed(1)} Q${cx.toFixed(1)},${(archTop - r * 0.25).toFixed(1)} ${(cx + r * 0.25).toFixed(1)},${archTop.toFixed(1)} L${(cx + r * 0.25).toFixed(1)},${baseBot.toFixed(1)} Z`}
        fill="rgba(0,0,0,0.3)" />
      {/* Small dome on top */}
      <Circle cx={cx} cy={domeY} r={domeR} fill={color} opacity={0.85} />
      {/* Dome highlight */}
      <Path d={`M${(cx - domeR * 0.7).toFixed(1)},${domeY.toFixed(1)} Q${cx.toFixed(1)},${(domeY - domeR * 0.8).toFixed(1)} ${(cx + domeR * 0.7).toFixed(1)},${domeY.toFixed(1)}`}
        stroke="rgba(255,255,255,0.25)" strokeWidth={1} fill="none" />
    </Svg>
  );
}

function OttomanEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const domeR = r * 0.55;
  const domeY = cy - r * 0.05;
  const baseBot = cy + r * 0.5;
  const baseW = r * 0.7;
  const minaretW = r * 0.08;
  const minaretX = r * 0.75;
  const minaretTop = cy - r * 0.75;
  const crescentY = domeY - domeR - r * 0.08;
  return (
    <Svg width={size} height={size}>
      {/* Base */}
      <Rect x={cx - baseW} y={domeY} width={baseW * 2} height={baseBot - domeY}
        fill={color} opacity={0.9} />
      {/* Large dome */}
      <Circle cx={cx} cy={domeY} r={domeR} fill={color} opacity={0.9} />
      {/* Left minaret */}
      <Rect x={cx - minaretX - minaretW / 2} y={minaretTop}
        width={minaretW} height={baseBot - minaretTop}
        fill={color} opacity={0.85} />
      {/* Right minaret */}
      <Rect x={cx + minaretX - minaretW / 2} y={minaretTop}
        width={minaretW} height={baseBot - minaretTop}
        fill={color} opacity={0.85} />
      {/* Minaret caps */}
      <Circle cx={cx - minaretX} cy={minaretTop} r={minaretW * 0.8} fill={color} opacity={0.85} />
      <Circle cx={cx + minaretX} cy={minaretTop} r={minaretW * 0.8} fill={color} opacity={0.85} />
      {/* Crescent on dome top */}
      <Path d={`M${(cx + r * 0.05).toFixed(1)},${(crescentY - r * 0.1).toFixed(1)} A${(r * 0.08).toFixed(1)},${(r * 0.08).toFixed(1)} 0 1 1 ${(cx + r * 0.05).toFixed(1)},${(crescentY + r * 0.1).toFixed(1)} A${(r * 0.06).toFixed(1)},${(r * 0.06).toFixed(1)} 0 1 0 ${(cx + r * 0.05).toFixed(1)},${(crescentY - r * 0.1).toFixed(1)}`}
        fill="rgba(255,255,255,0.5)" />
      {/* Dome highlight arc */}
      <Path d={`M${(cx - domeR * 0.6).toFixed(1)},${(domeY - domeR * 0.15).toFixed(1)} Q${cx.toFixed(1)},${(domeY - domeR * 0.95).toFixed(1)} ${(cx + domeR * 0.6).toFixed(1)},${(domeY - domeR * 0.15).toFixed(1)}`}
        stroke="rgba(255,255,255,0.2)" strokeWidth={1} fill="none" />
    </Svg>
  );
}

function HanEmblem({ size, color }: { size: number; color: string }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const bot = cy + r * 0.5;
  const colW = r * 0.1;
  const tiers = 3;
  const totalH = r * 1.4;
  const tierH = totalH / tiers;
  const baseRoofW = r * 0.85;
  const roofOverhang = r * 0.2;
  const upturn = r * 0.1;

  return (
    <Svg width={size} height={size}>
      {/* Central column */}
      <Rect x={cx - colW / 2} y={bot - totalH} width={colW} height={totalH}
        fill={color} opacity={0.7} />
      {/* Tiered roofs */}
      {Array.from({ length: tiers }).map((_, i) => {
        const tierBot = bot - i * tierH;
        const tierTop = tierBot - tierH * 0.35;
        const roofW = baseRoofW * (1 - i * 0.25);
        const ovr = roofOverhang * (1 - i * 0.15);
        // Roof shape with upturned corners
        const d = [
          `M${(cx - roofW - ovr).toFixed(1)},${(tierBot - tierH * 0.2 - upturn).toFixed(1)}`,
          `L${(cx - roofW).toFixed(1)},${(tierBot - tierH * 0.2).toFixed(1)}`,
          `L${cx.toFixed(1)},${tierTop.toFixed(1)}`,
          `L${(cx + roofW).toFixed(1)},${(tierBot - tierH * 0.2).toFixed(1)}`,
          `L${(cx + roofW + ovr).toFixed(1)},${(tierBot - tierH * 0.2 - upturn).toFixed(1)}`,
        ].join(' ');
        return (
          <G key={i}>
            {/* Tier body */}
            <Rect x={cx - roofW * 0.6} y={tierBot - tierH * 0.2}
              width={roofW * 1.2} height={tierH * 0.2}
              fill={color} opacity={0.85} />
            {/* Roof */}
            <Path d={d} fill={color} opacity={0.9} stroke="none" />
            {/* Accent line under roof */}
            <Line x1={cx - roofW * 0.5} y1={tierBot - tierH * 0.18}
              x2={cx + roofW * 0.5} y2={tierBot - tierH * 0.18}
              stroke="rgba(255,255,255,0.25)" strokeWidth={0.8} />
          </G>
        );
      })}
    </Svg>
  );
}

const EMBLEM_RENDERERS: Record<EmpireId, (s: number, c: string) => React.ReactElement> = {
  egypt: (s, c) => <EgyptEmblem size={s} color={c} />,
  rome: (s, c) => <RomeEmblem size={s} color={c} />,
  mongols: (s, c) => <MongolsEmblem size={s} color={c} />,
  ptolemaic: (s, c) => <PtolemiacEmblem size={s} color={c} />,
  japan: (s, c) => <JapanEmblem size={s} color={c} />,
  vikings: (s, c) => <VikingsEmblem size={s} color={c} />,
  aztec: (s, c) => <AztecEmblem size={s} color={c} />,
  persian: (s, c) => <PersianEmblem size={s} color={c} />,
  ottoman: (s, c) => <OttomanEmblem size={s} color={c} />,
  han: (s, c) => <HanEmblem size={s} color={c} />,
};

// ── Leader card ───────────────────────────────────────────────────────────────
function LeaderCard({
  empire,
  anim,
  onSelect,
  masteryLevel,
}: {
  empire: EmpireConfig;
  anim: Animated.Value;
  onSelect: () => void;
  masteryLevel?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onSelect());
  };

  return (
    <Animated.View style={[
      styles.card,
      { borderColor: empire.cardAccent + '66' },
      {
        opacity: anim,
        transform: [
          { scale: Animated.multiply(scale, anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] })) },
        ],
      },
    ]}>
      <View style={[styles.cardColorBar, { backgroundColor: empire.cardAccent }]} />

      {/* Emblem */}
      <View style={[styles.emblemWrap, { backgroundColor: empire.cardAccent + '18' }]}>
        {EMBLEM_RENDERERS[empire.id](72, empire.cardAccent)}
      </View>

      {/* Names */}
      <Text style={[styles.empireName, { color: empire.cardAccent }]} numberOfLines={1}>
        {empire.empire.toUpperCase()}
      </Text>
      <Text style={styles.leaderName} numberOfLines={1}>{empire.leader}</Text>

      {/* Mastery level */}
      {masteryLevel !== undefined && masteryLevel > 1 && (
        <View style={styles.masteryRow}>
          <Text style={[styles.masteryLvl, { color: empire.cardAccent }]}>Lv {masteryLevel}</Text>
          {masteryLevel >= 5 && <Text style={styles.masteryStar}>{'\u2605'}</Text>}
          {masteryLevel >= 10 && <Text style={styles.masteryStar}>{'\u2605'}</Text>}
          {masteryLevel >= 25 && <Text style={styles.masteryStar}>{'\u2605'}</Text>}
          {masteryLevel >= 50 && <Text style={[styles.masteryStar, { color: '#FF2D55' }]}>{'\u2605'}</Text>}
        </View>
      )}

      {/* Select button */}
      <TouchableOpacity
        style={[styles.selectBtn, { borderColor: empire.cardAccent, backgroundColor: empire.cardAccent + '22' }]}
        onPress={handlePress}
        activeOpacity={0.8}>
        <Text style={[styles.selectText, { color: empire.cardAccent }]}>SELECT</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function LeaderSelect({ onSelect, empireMastery }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(EMPIRE_IDS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    EMPIRE_IDS.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1, duration: 420, delay: 260 + i * 110, useNativeDriver: true,
      }).start();
    });
  }, []);

  return (
    <View style={[styles.root, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      {/* Header */}
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }]}>
        <Text style={styles.headerSub}>CHOOSE YOUR</Text>
        <Text style={styles.headerTitle}>EMPIRE</Text>
        <View style={styles.headerAccent} />
        <Text style={styles.headerHint}>Your opponent will be randomly assigned</Text>
      </Animated.View>

      {/* 2×2 grid */}
      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}>
        {EMPIRE_IDS.map((id, i) => (
          <LeaderCard
            key={id}
            empire={EMPIRE_CONFIG[id]}
            anim={cardAnims[i]}
            onSelect={() => onSelect(id)}
            masteryLevel={empireMastery?.[id]}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080E08',
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  headerSub: {
    fontSize: 10, letterSpacing: 4,
    color: 'rgba(255,200,60,0.45)',
    fontFamily: 'Inter_500Medium',
  },
  headerTitle: {
    fontSize: 38, fontFamily: 'Inter_700Bold',
    color: '#FFF5D6', letterSpacing: 6,
  },
  headerAccent: {
    width: 52, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,200,60,0.5)',
    marginTop: 2,
  },
  headerHint: {
    fontSize: 11, color: 'rgba(255,210,120,0.28)',
    fontFamily: 'Inter_400Regular', marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, borderWidth: 1.5,
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', gap: 8,
    overflow: 'hidden',
  },
  cardColorBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.9,
  },
  emblemWrap: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  empireName: {
    fontSize: 12, fontFamily: 'Inter_700Bold',
    letterSpacing: 2, textAlign: 'center',
  },
  leaderName: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,230,160,0.75)', textAlign: 'center',
  },
  selectBtn: {
    marginTop: 6, width: '92%',
    paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  selectText: {
    fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2.5,
  },
  masteryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  masteryLvl: {
    fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5,
  },
  masteryStar: {
    fontSize: 10, color: '#FFD700',
  },
});
