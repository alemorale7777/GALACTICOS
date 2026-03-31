import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GamePhase } from '@/context/GameContext';
import { Colors } from '@/constants/colors';
import { GameStats } from '@/hooks/useGameStorage';

interface Props {
  phase: GamePhase;
  onReset: () => void;
  onMenu: () => void;
  elapsedMs: number;
  stats: GameStats;
  prevBestTimeMs: number | null;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function getStars(ms: number): number {
  const s = ms / 1000;
  if (s < 60) return 3;
  if (s < 180) return 2;
  return 1;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B35', '#44EE66', '#CC2233',
  '#FFB347', '#FFFFFF', '#CC7700', '#22CCDD',
  '#FF88CC', '#AAFFAA', '#FFCC44', '#FF4488',
];
const CONFETTI_COUNT = 36;

const confettiMeta = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  xFrac:    Math.random(),
  size:     5 + Math.random() * 8,
  color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  driftX:   (Math.random() - 0.5) * 120,
  delay:    Math.random() * 1400,
  duration: 2000 + Math.random() * 1800,
  spin:     Math.random() > 0.5 ? 3 : -3,
  rect:     Math.random() > 0.5,
}));

export default function GameOverlay({ phase, onReset, onMenu, elapsedMs, stats, prevBestTimeMs }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const starScales = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;

  const confettiAnims = useRef(
    confettiMeta.map(() => ({
      y:       new Animated.Value(-60),
      xDrift:  new Animated.Value(0),
      opacity: new Animated.Value(1),
      rotate:  new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (phase !== 'playing') {
      Haptics.notificationAsync(
        phase === 'won' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
      starScales.forEach(s => s.setValue(0));
      iconScale.setValue(0.4);

      Animated.parallel([
        Animated.timing(opacity,     { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.spring(translateY,  { toValue: 0, tension: 80, friction: 10, useNativeDriver: false }),
        Animated.spring(iconScale,   { toValue: 1, tension: 100, friction: 8, useNativeDriver: false }),
      ]).start();

      if (phase === 'won') {
        const numStars = getStars(elapsedMs);
        [0, 1, 2].forEach(i => {
          Animated.sequence([
            Animated.delay(350 + i * 120),
            Animated.spring(starScales[i], { toValue: i < numStars ? 1.2 : 0.7, tension: 180, friction: 6, useNativeDriver: false }),
            Animated.spring(starScales[i], { toValue: 1, tension: 120, friction: 8, useNativeDriver: false }),
          ]).start();
        });

        confettiAnims.forEach((anim, i) => {
          const meta = confettiMeta[i];
          anim.y.setValue(-60);
          anim.xDrift.setValue(0);
          anim.opacity.setValue(1);
          anim.rotate.setValue(0);
          Animated.sequence([
            Animated.delay(meta.delay),
            Animated.parallel([
              Animated.timing(anim.y,      { toValue: SCREEN_H + 80, duration: meta.duration, useNativeDriver: false }),
              Animated.timing(anim.xDrift, { toValue: meta.driftX,   duration: meta.duration, useNativeDriver: false }),
              Animated.timing(anim.rotate, { toValue: meta.spin,     duration: meta.duration, useNativeDriver: false }),
              Animated.sequence([
                Animated.delay(meta.duration * 0.62),
                Animated.timing(anim.opacity, { toValue: 0, duration: meta.duration * 0.38, useNativeDriver: false }),
              ]),
            ]),
          ]).start();
        });
      }
    } else {
      opacity.setValue(0);
      translateY.setValue(40);
      starScales.forEach(s => s.setValue(0));
      iconScale.setValue(0.4);
    }
  }, [phase]);

  if (phase === 'playing') return null;

  const isWin = phase === 'won';
  const accentColor = isWin ? Colors.playerPlanet : Colors.enemyPlanet;
  const isBestTime = isWin && (prevBestTimeMs === null || elapsedMs < prevBestTimeMs);
  const stars = isWin ? getStars(elapsedMs) : 0;

  return (
    <Animated.View style={[styles.container, { opacity }]}>

      {isWin && confettiAnims.map((anim, i) => {
        const meta = confettiMeta[i];
        const left = meta.xFrac * (SCREEN_W - meta.size);
        return (
          <Animated.View
            key={`conf${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left,
              top: 0,
              width: meta.size,
              height: meta.rect ? meta.size * 0.45 : meta.size,
              borderRadius: meta.rect ? 2 : meta.size / 2,
              backgroundColor: meta.color,
              opacity: anim.opacity,
              transform: [
                { translateY: anim.y },
                { translateX: anim.xDrift },
                { rotate: anim.rotate.interpolate({ inputRange: [-3, 3], outputRange: ['-1080deg', '1080deg'] }) },
              ],
            }}
          />
        );
      })}

      <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>

        <View style={[styles.topAccentLine, { backgroundColor: accentColor }]} />

        <Animated.View style={[styles.iconRing, { borderColor: accentColor + '55', transform: [{ scale: iconScale }] }]}>
          <Feather name={isWin ? 'award' : 'x-circle'} size={44} color={accentColor} />
        </Animated.View>

        <Text style={[styles.result, { color: accentColor }]}>
          {isWin ? 'VICTORY' : 'DEFEATED'}
        </Text>
        <Text style={styles.resultSub}>
          {isWin
            ? (stars === 3 ? 'The realm is yours!' : stars === 2 ? 'Your kingdom rises!' : 'Hard-fought glory.')
            : 'Your castle has fallen.'}
        </Text>

        {isWin && (
          <View style={styles.starsRow}>
            {[0, 1, 2].map(i => (
              <Animated.Text key={i}
                style={[styles.star, {
                  color: i < stars ? '#FFD700' : 'rgba(255,210,80,0.1)',
                  transform: [{ scale: starScales[i] }],
                }]}>
                ★
              </Animated.Text>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{formatTime(elapsedMs)}</Text>
            <Text style={styles.statLbl}>TIME</Text>
            {isBestTime && <Text style={styles.bestBadge}>NEW BEST</Text>}
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Colors.playerPlanet }]}>{stats.wins}</Text>
            <Text style={styles.statLbl}>WINS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Colors.enemyPlanet }]}>{stats.losses}</Text>
            <Text style={styles.statLbl}>LOSSES</Text>
          </View>
          {stats.streak >= 2 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#FFD700' }]}>{stats.streak}</Text>
                <Text style={styles.statLbl}>STREAK</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: accentColor }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReset(); }}
            activeOpacity={0.8}>
            <Feather name="refresh-cw" size={18} color="#000" />
            <Text style={styles.primaryText}>PLAY AGAIN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={onMenu} activeOpacity={0.7}>
            <Feather name="home" size={18} color="rgba(255,210,100,0.5)" />
            <Text style={styles.menuText}>MAIN MENU</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,4,0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: 'rgba(16,10,4,0.98)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(180,140,40,0.22)',
    marginHorizontal: 28,
    width: '87%',
    overflow: 'hidden',
  },
  topAccentLine: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    opacity: 0.7,
  },
  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  result: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  resultSub: { fontSize: 13, color: 'rgba(255,220,140,0.5)', fontFamily: 'Inter_400Regular', textAlign: 'center' },
  starsRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  star: { fontSize: 34, lineHeight: 38 },
  statsRow: {
    flexDirection: 'row', width: '100%',
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 14, paddingVertical: 14,
    justifyContent: 'space-around', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(180,140,40,0.12)',
  },
  statBox: { alignItems: 'center', flex: 1, gap: 3 },
  statVal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF8E8' },
  statLbl: { fontSize: 9, color: 'rgba(255,210,100,0.35)', fontFamily: 'Inter_500Medium', letterSpacing: 1.5 },
  bestBadge: { fontSize: 8, color: '#FFD700', fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(180,140,40,0.15)' },
  buttons: { width: '100%', gap: 10 },
  primaryBtn: {
    height: 50, borderRadius: 25,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  primaryText: { color: '#000', fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  menuBtn: {
    height: 46, borderRadius: 23,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,200,60,0.06)',
    borderWidth: 1, borderColor: 'rgba(180,140,40,0.18)',
  },
  menuText: { color: 'rgba(255,210,100,0.5)', fontSize: 14, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
});
