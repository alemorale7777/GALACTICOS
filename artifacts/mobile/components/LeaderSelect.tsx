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

const EMBLEM_RENDERERS: Record<EmpireId, (s: number, c: string) => React.ReactElement> = {
  egypt: (s, c) => <EgyptEmblem size={s} color={c} />,
  rome: (s, c) => <RomeEmblem size={s} color={c} />,
  mongols: (s, c) => <MongolsEmblem size={s} color={c} />,
  ptolemaic: (s, c) => <PtolemiacEmblem size={s} color={c} />,
};

// ── Leader card ───────────────────────────────────────────────────────────────
function LeaderCard({
  empire,
  anim,
  onSelect,
}: {
  empire: EmpireConfig;
  anim: Animated.Value;
  onSelect: () => void;
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
export default function LeaderSelect({ onSelect }: Props) {
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
    backgroundColor: 'rgba(255,220,80,0.03)',
    borderRadius: 18, borderWidth: 1,
    paddingVertical: 18, paddingHorizontal: 12,
    alignItems: 'center', gap: 8,
    overflow: 'hidden',
  },
  cardColorBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, opacity: 0.8,
  },
  emblemWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  empireName: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5, textAlign: 'center',
  },
  leaderName: {
    fontSize: 13, fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,230,160,0.75)', textAlign: 'center',
  },
  selectBtn: {
    marginTop: 6, width: '90%',
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, alignItems: 'center',
  },
  selectText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2,
  },
});
