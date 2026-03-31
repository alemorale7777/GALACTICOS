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
}

export function TopHUD({ playerPlanets, enemyPlanets, totalPlanets, difficulty, elapsedMs, onReset }: TopHUDProps) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const diffColor =
    difficulty === 'easy' ? '#44BB66' : difficulty === 'medium' ? '#EEAA22' : '#EE3344';
  const diffLabel = difficulty === 'easy' ? 'SQUIRE' : difficulty === 'medium' ? 'KNIGHT' : 'GALÁCTICO';

  const neutral = totalPlanets - playerPlanets - enemyPlanets;
  const total = Math.max(totalPlanets, 1);
  const playerPct = (playerPlanets / total) * 100;
  const enemyPct = (enemyPlanets / total) * 100;
  const isPlayerWinning = playerPct > 60;
  const isTied = Math.abs(playerPct - enemyPct) < 3 && playerPct > 0 && enemyPct > 0;

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
    ? barPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.playerPlanet, '#88FFB0'] })
    : isTied
      ? barPulseAnim.interpolate({ inputRange: [0, 1], outputRange: [Colors.playerPlanet, '#FFFFFF'] })
      : Colors.playerPlanet;

  return (
    <View style={[styles.topBar, { paddingTop: topInset + 4 }]}>
      <View style={styles.sideBlock}>
        <View style={[styles.ownerDot, { backgroundColor: Colors.playerPlanet }]} />
        <Text style={[styles.planetCount, { color: Colors.playerPlanet }]}>{playerPlanets}</Text>
      </View>

      <View style={styles.center}>
        <View style={styles.timerRow}>
          <Feather name="clock" size={10} color="rgba(255,220,120,0.35)" />
          <Text style={styles.timer}>{formatTimer(elapsedMs)}</Text>
          <View style={[styles.diffBadge, { borderColor: diffColor + '66', backgroundColor: diffColor + '1A' }]}>
            <Text style={[styles.diffText, { color: diffColor }]}>{diffLabel}</Text>
          </View>
        </View>
        {/* Territory bar */}
        <View style={styles.bar}>
          <Animated.View style={[styles.barPlayer, { width: `${playerPct}%`, backgroundColor: barPlayerBg }]} />
          <View style={[styles.barNeutral, { flex: neutral }]} />
          <View style={[styles.barEnemy, { width: `${enemyPct}%` }]} />
        </View>
        <View style={styles.barLabels}>
          <Text style={[styles.barLabel, { color: Colors.playerPlanet + 'BB' }]}>{Math.round(playerPct)}%</Text>
          <Text style={[styles.barLabel, { color: Colors.enemyPlanet + 'BB' }]}>{Math.round(enemyPct)}%</Text>
        </View>
      </View>

      <View style={[styles.sideBlock, styles.sideRight]}>
        <Text style={[styles.planetCount, { color: Colors.enemyPlanet }]}>{enemyPlanets}</Text>
        <View style={[styles.ownerDot, { backgroundColor: Colors.enemyPlanet }]} />
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
  fleetPercent: FleetPercent;
  onAbility: () => void;
  onSetFleetPercent: (pct: FleetPercent) => void;
  selectedPlanetId: number | null;
  allSelected: boolean;
  onToggleAll: () => void;
  playerEmpire?: EmpireConfig | null;
}

export function BottomHUD({ abilityCooldown, fleetPercent, onAbility, onSetFleetPercent, selectedPlanetId, allSelected, onToggleAll, playerEmpire }: BottomHUDProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const isReady = abilityCooldown <= 0;
  const cooldownFraction = Math.max(0, abilityCooldown) / 22;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const tapAnim = useRef(new Animated.Value(1)).current;
  const pctGlowAnims = useRef(PCT_OPTIONS.map(() => new Animated.Value(0))).current;
  // War Cry flavor text
  const [warCryText, setWarCryText] = useState('');
  const warCryOpacity = useRef(new Animated.Value(0)).current;
  const warCryTransY = useRef(new Animated.Value(0)).current;

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
    // Empire-specific war cry — float up while fading over 1.5s
    if (playerEmpire?.warCry) {
      setWarCryText(playerEmpire.warCry);
      warCryOpacity.setValue(0);
      warCryTransY.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(warCryOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
          Animated.delay(300),
          Animated.timing(warCryOpacity, { toValue: 0, duration: 1200, useNativeDriver: false }),
        ]),
        Animated.timing(warCryTransY, { toValue: -30, duration: 1500, useNativeDriver: false }),
      ]).start();
    }
  };

  const tapPct = (idx: number, pct: FleetPercent) => {
    Haptics.selectionAsync();
    onSetFleetPercent(pct);
    Animated.sequence([
      Animated.timing(pctGlowAnims[idx], { toValue: 1, duration: 80, useNativeDriver: false }),
      Animated.timing(pctGlowAnims[idx], { toValue: 0, duration: 280, useNativeDriver: false }),
    ]).start();
  };

  const abilityBorderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(180,130,20,0.3)', 'rgba(255,200,40,0.95)'],
  });

  const hint = allSelected ? '→ march to target' : selectedPlanetId !== null ? '→ march to target' : 'tap a castle';

  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {/* Army size row */}
      <View style={styles.fleetRow}>
        <Text style={styles.fleetLabel}>ARMY</Text>
        <View style={styles.pctGroup}>
          {PCT_OPTIONS.map((pct, idx) => {
            const active = pct === fleetPercent;
            const empireColor = playerEmpire?.nodeColor ?? '#FFCC22';
            const glowBorder = pctGlowAnims[idx].interpolate({
              inputRange: [0, 1],
              outputRange: [
                active ? empireColor : 'rgba(255,220,100,0.12)',
                empireColor,
              ],
            });
            const glowBg = pctGlowAnims[idx].interpolate({
              inputRange: [0, 1],
              outputRange: [
                active ? 'rgba(255,200,30,0.18)' : 'rgba(255,220,100,0.06)',
                'rgba(255,210,60,0.36)',
              ],
            });
            return (
              <Animated.View key={pct} style={[
                styles.pctBtn,
                { borderColor: glowBorder, backgroundColor: glowBg },
              ]}>
                <TouchableOpacity
                  onPress={() => tapPct(idx, pct)}
                  activeOpacity={0.75}>
                  <Text style={[styles.pctText, active && styles.pctTextActive]}>{pct}%</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <View style={styles.rowDivider} />

        {/* SELECT ALL toggle */}
        <TouchableOpacity
          style={[styles.allBtn, allSelected && styles.allBtnActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggleAll(); }}
          activeOpacity={0.75}>
          <Feather name="layers" size={12} color={allSelected ? '#FFCC22' : 'rgba(255,220,120,0.35)'} />
          <Text style={[styles.allText, allSelected && styles.allTextActive]}>ALL</Text>
        </TouchableOpacity>

        <Text style={styles.dragHint} numberOfLines={1}>{hint}</Text>
      </View>

      {/* War Cry flavor text — floats up while fading */}
      <Animated.Text style={[styles.warCryFlash, {
        opacity: warCryOpacity,
        transform: [{ translateY: warCryTransY }],
      }]} numberOfLines={1}>
        "{warCryText}"
      </Animated.Text>

      {/* War Cry button */}
      <Animated.View style={[styles.abilityWrap, { transform: [{ scale: Animated.multiply(pulseAnim, tapAnim) }] }]}>
        <Animated.View style={[
          styles.abilityGlowBorder,
          isReady && { borderColor: abilityBorderColor },
          !isReady && { borderColor: 'rgba(120,80,10,0.2)' },
        ]}>
          <TouchableOpacity
            style={[styles.abilityBtn, !isReady && styles.abilityBtnOff]}
            onPress={fireAbility}
            activeOpacity={isReady ? 0.88 : 1}
            disabled={!isReady}>
            {!isReady && (
              <View style={[styles.cooldownFill, { width: `${(1 - cooldownFraction) * 100}%` }]} />
            )}

            {/* Zap icon + cooldown progress ring overlay */}
            <View style={styles.zapWrap}>
              {!isReady && (
                <Svg width={38} height={38} style={styles.cdRingSvg} pointerEvents="none">
                  <SvgCircle cx={19} cy={19} r={CD_R}
                    fill="none" stroke="rgba(255,200,50,0.14)" strokeWidth={2.5} />
                  <SvgCircle cx={19} cy={19} r={CD_R}
                    fill="none" stroke="rgba(255,210,60,0.90)" strokeWidth={2.5}
                    strokeDasharray={`${((1 - cooldownFraction) * CD_CIRCUM).toFixed(1)} ${CD_CIRCUM.toFixed(1)}`}
                    strokeDashoffset={(CD_CIRCUM * 0.25).toFixed(1)}
                    strokeLinecap="round" />
                </Svg>
              )}
              <Feather name="zap" size={18} color={isReady ? '#1A0C00' : 'rgba(255,200,80,0.28)'} />
            </View>

            <Text style={[styles.abilityText, !isReady && styles.abilityTextOff]}>WAR CRY</Text>
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
  // ── Top bar ────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 10,
    backgroundColor: Colors.hud,
    borderBottomWidth: 1, borderBottomColor: Colors.hudBorder,
    gap: 8,
  },
  sideBlock: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 44 },
  sideRight: { justifyContent: 'flex-end' },
  ownerDot: { width: 9, height: 9, borderRadius: 5 },
  planetCount: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  center: { flex: 1, alignItems: 'center', gap: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timer: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,230,160,0.65)', letterSpacing: 1.2 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  diffText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  bar: {
    width: '100%', height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,220,100,0.06)',
    flexDirection: 'row', overflow: 'hidden',
  },
  barPlayer: { height: '100%', backgroundColor: Colors.playerPlanet, borderRadius: 3 },
  barNeutral: { height: '100%', backgroundColor: 'rgba(187,153,85,0.2)' },
  barEnemy: { height: '100%', backgroundColor: Colors.enemyPlanet, borderRadius: 3 },
  barLabels: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', paddingHorizontal: 2 },
  barLabel: { fontSize: 8, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  resetBtn: { padding: 6 },

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: Colors.hud,
    borderTopWidth: 1, borderTopColor: Colors.hudBorder,
    paddingTop: 10, paddingHorizontal: 16, gap: 10,
  },
  fleetRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fleetLabel: { fontSize: 8, color: 'rgba(255,220,100,0.28)', fontFamily: 'Inter_600SemiBold', letterSpacing: 2 },
  pctGroup: { flexDirection: 'row', gap: 5 },
  pctBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: 'rgba(255,220,100,0.06)',
    borderWidth: 1.5, borderColor: 'rgba(255,220,100,0.12)',
  },
  pctBtnActive: { backgroundColor: 'rgba(255,200,30,0.18)', borderColor: '#FFCC22' },
  pctText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,220,100,0.35)' },
  pctTextActive: { color: '#FFDD44' },
  rowDivider: { width: 1, height: 22, backgroundColor: 'rgba(255,220,100,0.08)' },
  allBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,220,100,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,220,100,0.1)',
  },
  allBtnActive: { backgroundColor: 'rgba(255,200,30,0.16)', borderColor: '#FFCC22' },
  allText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,220,100,0.35)', letterSpacing: 0.5 },
  allTextActive: { color: '#FFDD44' },
  dragHint: { flex: 1, fontSize: 10, color: 'rgba(255,210,100,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'right' },

  // War Cry flavor text flash
  warCryFlash: {
    textAlign: 'center', fontSize: 20, fontFamily: 'Inter_700Bold',
    color: '#FFDD88', letterSpacing: 0.6, marginBottom: 2,
  },

  // War Cry button
  abilityWrap: { width: '100%' },
  abilityGlowBorder: { borderRadius: 26, borderWidth: 1.5, overflow: 'hidden' },
  abilityBtn: {
    height: 50, borderRadius: 25,
    backgroundColor: '#FFAA22',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 9, overflow: 'hidden',
  },
  abilityBtnOff: { backgroundColor: 'rgba(30,18,4,0.95)' },
  cooldownFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(180,120,10,0.28)',
  },
  zapWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  cdRingSvg: { position: 'absolute', top: 0, left: 0 },
  abilityText: { color: '#1A0C00', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 2.5, zIndex: 1 },
  abilityTextOff: { color: 'rgba(255,200,80,0.28)' },
  cooldownPill: { backgroundColor: 'rgba(180,130,10,0.22)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, zIndex: 1 },
  cooldownLabel: { color: 'rgba(255,200,60,0.85)', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
