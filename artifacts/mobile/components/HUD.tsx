import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Difficulty, FleetPercent } from '@/context/GameContext';
import { EmpireConfig } from '@/constants/empires';

const CD_R = 17;
const CD_CIRCUM = 2 * Math.PI * CD_R;

const PCT_OPTIONS: FleetPercent[] = [25, 50, 75];

function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

interface TopHUDProps {
  playerPlanets: number;
  enemyPlanets: number;
  totalPlanets: number;
  difficulty: Difficulty;
  elapsedMs: number;
  onReset: () => void;
  abilityActive?: boolean;
  playerEmpire?: EmpireConfig | null;
  aiEmpire?: EmpireConfig | null;
}

export function TopHUD({ playerPlanets, enemyPlanets, totalPlanets, difficulty, elapsedMs, onReset, abilityActive, playerEmpire, aiEmpire }: TopHUDProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const diffColor =
    difficulty === 'easy' ? '#44BB66' : difficulty === 'medium' ? '#EEAA22' : '#EE3344';
  const diffLabel = difficulty === 'easy' ? 'SQUIRE' : difficulty === 'medium' ? 'KNIGHT' : 'GALACTICO';

  const neutral = totalPlanets - playerPlanets - enemyPlanets;
  const total = Math.max(totalPlanets, 1);
  const playerPct = (playerPlanets / total) * 100;
  const enemyPct = (enemyPlanets / total) * 100;
  const isPlayerWinning = playerPct > 60;
  const isTied = Math.abs(playerPct - enemyPct) < 3 && playerPct > 0 && enemyPct > 0;

  const playerColor = playerEmpire?.nodeColor ?? Colors.playerPlanet;
  const enemyColor = aiEmpire?.nodeColor ?? Colors.enemyPlanet;

  const barPulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isPlayerWinning || isTied) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(barPulseAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(barPulseAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]));
      loop.start();
      return () => loop.stop();
    } else {
      barPulseAnim.setValue(0);
    }
  }, [isPlayerWinning, isTied]);

  const barPlayerBg: any = isPlayerWinning
    ? barPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [playerColor, '#88FFB0'] })
    : isTied
      ? barPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [playerColor, '#FFFFFF'] })
      : playerColor;

  // Animated widths for smooth territory bar transitions
  const playerWidthAnim = useRef(new Animated.Value(playerPct)).current;
  const enemyWidthAnim = useRef(new Animated.Value(enemyPct)).current;

  useEffect(() => {
    Animated.timing(playerWidthAnim, {
      toValue: playerPct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [playerPct]);

  useEffect(() => {
    Animated.timing(enemyWidthAnim, {
      toValue: enemyPct,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [enemyPct]);

  const playerBarWidth = playerWidthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  const enemyBarWidth = enemyWidthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.topBar, { paddingTop: topInset + 4 }]}>
      <View style={styles.sideBlock}>
        <View style={[styles.ownerDot, { backgroundColor: playerColor }]} />
        <Text style={[styles.planetCount, { color: playerColor }]}>{playerPlanets}</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.timerRow}>
          <View style={styles.timerPill}>
            <Feather name="clock" size={10} color="rgba(255,255,255,0.35)" />
            <Text style={styles.timer}>{formatTimer(elapsedMs)}</Text>
          </View>
          <View style={[styles.diffBadge, { borderColor: diffColor + '66', backgroundColor: diffColor + '1A' }]}>
            <Text style={[styles.diffText, { color: diffColor }]}>{diffLabel}</Text>
          </View>
        </View>
        {/* Territory bar */}
        <View style={styles.bar}>
          <Animated.View style={[styles.barPlayer, { width: playerBarWidth, backgroundColor: barPlayerBg }]} />
          <View style={[styles.barNeutral, { flex: neutral }]} />
          <Animated.View style={[styles.barEnemy, { width: enemyBarWidth, backgroundColor: enemyColor }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={[styles.barLabel, { color: playerColor + 'BB' }]}>{Math.round(playerPct)}%</Text>
          <Text style={[styles.barLabel, { color: enemyColor + 'BB' }]}>{Math.round(enemyPct)}%</Text>
        </View>

        {/* Ability active indicator */}
        {abilityActive && playerEmpire && (
          <View style={[styles.abilityActiveBadge, { backgroundColor: playerEmpire.nodeColor + '33', borderColor: playerEmpire.nodeColor + '66' }]}>
            <Text style={[styles.abilityActiveText, { color: playerEmpire.nodeColor }]}>
              {playerEmpire.ability.name.toUpperCase()} ACTIVE
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.sideBlock, styles.sideRight]}>
        <Text style={[styles.planetCount, { color: enemyColor }]}>{enemyPlanets}</Text>
        <View style={[styles.ownerDot, { backgroundColor: enemyColor }]} />
      </View>

      <TouchableOpacity style={styles.resetBtn}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReset(); }}
        activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Feather name="refresh-cw" size={14} color="rgba(255,220,120,0.3)" />
      </TouchableOpacity>
    </View>
  );
}

interface BottomHUDProps {
  abilityCooldown: number;
  abilityMaxCooldown: number;
  fleetPercent: FleetPercent;
  onAbility: () => void;
  onSetFleetPercent: (pct: FleetPercent) => void;
  selectedPlanetId: number | null;
  allSelected: boolean;
  onToggleAll: () => void;
  playerEmpire?: EmpireConfig | null;
  abilityActive?: boolean;
}

export function BottomHUD({ abilityCooldown, abilityMaxCooldown, fleetPercent, onAbility, onSetFleetPercent, selectedPlanetId, allSelected, onToggleAll, playerEmpire, abilityActive }: BottomHUDProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const isReady = abilityCooldown <= 0;
  const cooldownFraction = Math.max(0, abilityCooldown) / Math.max(1, abilityMaxCooldown);

  const abilityName = playerEmpire?.ability?.name ?? 'WAR CRY';
  const abilityColor = playerEmpire?.nodeColor ?? '#FFAA22';

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const tapAnim = useRef(new Animated.Value(1)).current;
  const pctGlowAnims = useRef(PCT_OPTIONS.map(() => new Animated.Value(0))).current;
  const [warCryText, setWarCryText] = useState('');
  const warCryOpacity = useRef(new Animated.Value(0)).current;
  const warCryTransY = useRef(new Animated.Value(0)).current;
  const warCryTransX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReady) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.035, duration: 750, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: false }),
      ]));
      const glow = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 900, useNativeDriver: false }),
      ]));
      pulse.start(); glow.start();
      return () => { pulse.stop(); glow.stop(); };
    } else {
      pulseAnim.setValue(1); glowAnim.setValue(0);
    }
  }, [isReady]);

  const fireAbility = () => {
    if (!isReady) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(tapAnim, { toValue: 0.91, duration: 60, useNativeDriver: false }),
      Animated.spring(tapAnim, { toValue: 1, tension: 260, friction: 8, useNativeDriver: false }),
    ]).start();
    onAbility();
    if (playerEmpire?.warCry) {
      setWarCryText(playerEmpire.warCry);
      warCryOpacity.setValue(0);
      warCryTransY.setValue(0);
      warCryTransX.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(warCryOpacity, { toValue: 1, duration: 100, useNativeDriver: false }),
          Animated.delay(500),
          Animated.timing(warCryOpacity, { toValue: 0, duration: 900, useNativeDriver: false }),
        ]),
        Animated.timing(warCryTransY, { toValue: -40, duration: 1500, useNativeDriver: false }),
        // Horizontal sway (sin wave)
        Animated.loop(
          Animated.sequence([
            Animated.timing(warCryTransX, { toValue: 6, duration: 400, useNativeDriver: false }),
            Animated.timing(warCryTransX, { toValue: -6, duration: 800, useNativeDriver: false }),
            Animated.timing(warCryTransX, { toValue: 0, duration: 400, useNativeDriver: false }),
          ]),
          { iterations: 2 }
        ),
      ]).start();
    }
  };

  const pctScaleAnims = useRef(PCT_OPTIONS.map(() => new Animated.Value(1))).current;
  const allScaleAnim = useRef(new Animated.Value(1)).current;

  const tapPct = (idx: number, pct: FleetPercent) => {
    Haptics.selectionAsync();
    onSetFleetPercent(pct);
    // Bouncy scale: 0.92 -> 1.05 -> 1.0
    Animated.sequence([
      Animated.timing(pctScaleAnims[idx], { toValue: 0.92, duration: 50, useNativeDriver: false }),
      Animated.spring(pctScaleAnims[idx], { toValue: 1, tension: 300, friction: 8, useNativeDriver: false }),
    ]).start();
    Animated.sequence([
      Animated.timing(pctGlowAnims[idx], { toValue: 1, duration: 80, useNativeDriver: false }),
      Animated.timing(pctGlowAnims[idx], { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  };

  const tapAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(allScaleAnim, { toValue: 0.92, duration: 50, useNativeDriver: false }),
      Animated.spring(allScaleAnim, { toValue: 1, tension: 300, friction: 8, useNativeDriver: false }),
    ]).start();
    onToggleAll();
  };

  const abilityBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(180,130,20,0.3)', abilityColor],
  });

  const hint = allSelected ? '-> march to target' : selectedPlanetId !== null ? '-> march to target' : 'tap a castle';

  // Cooldown arc stroke color uses empire color
  const cdStrokeColor = abilityColor;

  const empireColor = playerEmpire?.nodeColor ?? '#FFCC22';

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {/* Army size row */}
      <View style={styles.fleetRow}>
        <Text style={styles.fleetLabel}>ARMY</Text>
        <View style={styles.pctGroup}>
          {PCT_OPTIONS.map((pct, idx) => {
            const active = pct === fleetPercent;
            const glowBorder = pctGlowAnims[idx].interpolate({
              inputRange: [0, 1],
              outputRange: [active ? empireColor : 'rgba(255,255,255,0.08)', empireColor],
            });
            return (
              <Animated.View
                key={pct}
                style={[
                  styles.pctBtn,
                  {
                    borderColor: glowBorder,
                    backgroundColor: active ? empireColor : '#1A1A2E',
                    transform: [{ scale: pctScaleAnims[idx] }],
                  },
                  !active && { borderColor: empireColor + '55' },
                ]}
              >
                <TouchableOpacity
                  onPress={() => tapPct(idx, pct)}
                  activeOpacity={0.75}
                  style={styles.pctBtnInner}
                >
                  <Text style={[
                    styles.pctText,
                    active
                      ? { color: '#FFFFFF', fontFamily: 'Inter_700Bold' }
                      : { color: empireColor + 'AA' },
                  ]}>{pct}%</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.rowDivider} />

        <Animated.View style={{ transform: [{ scale: allScaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.allBtn,
              {
                borderColor: allSelected ? empireColor : empireColor + '44',
                backgroundColor: allSelected ? empireColor + '22' : '#1A1A2E',
              },
            ]}
            onPress={tapAll}
            activeOpacity={0.75}
          >
            <Feather name="layers" size={13} color={allSelected ? empireColor : empireColor + '55'} />
            <Text style={[
              styles.allText,
              allSelected ? { color: empireColor } : { color: empireColor + '66' },
            ]}>ALL</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.dragHint} numberOfLines={1}>{hint}</Text>
      </View>

      {/* Ability flavor text */}
      <Animated.Text style={[styles.warCryFlash, {
        opacity: warCryOpacity,
        transform: [{ translateY: warCryTransY }, { translateX: warCryTransX }],
        color: abilityColor,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
      } as any]} numberOfLines={1}>
        {'\u201C'}{warCryText}{'\u201D'}
      </Animated.Text>

      {/* Ability button */}
      <Animated.View style={[styles.abilityWrap, { transform: [{ scale: Animated.multiply(pulseAnim, tapAnim) }] }]}>
        <Animated.View style={[
          styles.abilityGlowBorder,
          isReady && { borderColor: abilityBorderColor },
          !isReady && { borderColor: 'rgba(255,255,255,0.06)' },
          abilityActive && { borderColor: abilityColor },
        ]}>
          <TouchableOpacity
            style={[
              styles.abilityBtn,
              !isReady && styles.abilityBtnOff,
              isReady && { backgroundColor: abilityColor },
              abilityActive && { backgroundColor: abilityColor },
            ]}
            onPress={fireAbility}
            activeOpacity={isReady ? 0.88 : 1}
            disabled={!isReady}>
            {!isReady && (
              <View style={[styles.cooldownFill, { width: `${(1 - cooldownFraction) * 100}%`, backgroundColor: abilityColor + '44' }]} />
            )}

            {/* Cooldown progress ring */}
            <View style={styles.zapWrap}>
              {!isReady && (
                <Svg width={38} height={38} style={styles.cdRingSvg} pointerEvents="none">
                  <SvgCircle cx={19} cy={19} r={CD_R}
                    fill="none" stroke="rgba(255,200,50,0.14)" strokeWidth={2.5} />
                  <SvgCircle cx={19} cy={19} r={CD_R}
                    fill="none" stroke={cdStrokeColor} strokeWidth={2.5}
                    strokeDasharray={`${((1 - cooldownFraction) * CD_CIRCUM).toFixed(1)} ${CD_CIRCUM.toFixed(1)}`}
                    strokeDashoffset={(CD_CIRCUM * 0.25).toFixed(1)}
                    strokeLinecap="round" opacity={0.9} />
                </Svg>
              )}
              <Feather name="zap" size={18} color={isReady ? '#1A0C00' : 'rgba(255,200,80,0.28)'} />
            </View>

            <Text style={[styles.abilityText, !isReady && styles.abilityTextOff]}>
              {abilityName.toUpperCase()}
            </Text>
            {!isReady && (
              <View style={styles.cooldownPill}>
                <Text style={styles.cooldownLabel}>{Math.ceil(abilityCooldown)}s</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // -- Top bar --
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  sideBlock: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44 },
  sideRight: { justifyContent: 'flex-end' },
  ownerDot: { width: 9, height: 9, borderRadius: 5 },
  planetCount: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  center: { flex: 1, alignItems: 'center', gap: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  timer: {
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  diffText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  bar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  barPlayer: { height: '100%', borderRadius: 4 },
  barNeutral: { height: '100%', backgroundColor: 'rgba(187,153,85,0.15)' },
  barEnemy: { height: '100%', borderRadius: 4 },
  barLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 2 },
  barLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  resetBtn: { padding: 6 },
  abilityActiveBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, marginTop: 2,
  },
  abilityActiveText: { fontSize: 7, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },

  // -- Bottom bar --
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fleetLabel: { fontSize: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  pctGroup: { flexDirection: 'row', gap: 6 },
  pctBtn: {
    width: 64,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pctBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  rowDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.06)' },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    width: 78,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  allText: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  dragHint: { flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.15)', fontFamily: 'Inter_400Regular', textAlign: 'right' },
  warCryFlash: {
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  abilityWrap: { width: '100%' },
  abilityGlowBorder: { borderRadius: 12, borderWidth: 1.5, overflow: 'hidden' },
  abilityBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFAA22',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    overflow: 'hidden',
  },
  abilityBtnOff: { backgroundColor: 'rgba(28,28,40,0.95)' },
  cooldownFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
  },
  zapWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  cdRingSvg: { position: 'absolute', top: 0, left: 0 },
  abilityText: { color: '#1A0C00', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, zIndex: 1 },
  abilityTextOff: { color: 'rgba(255,200,80,0.28)' },
  cooldownPill: { backgroundColor: 'rgba(180,130,10,0.22)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, zIndex: 1 },
  cooldownLabel: { color: 'rgba(255,200,60,0.85)', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
