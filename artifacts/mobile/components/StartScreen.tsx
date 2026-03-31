import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Difficulty } from '@/context/GameContext';
import { Colors } from '@/constants/colors';
import { GameStats } from '@/hooks/useGameStorage';

interface Props {
  onStart: (difficulty: Difficulty) => void;
  onShowTutorial: () => void;
  stats: GameStats;
}

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; color: string; icon: any }[] = [
  { key: 'easy',   label: 'SQUIRE',    desc: 'Slow enemy AI, learn the game',   color: '#44BB66', icon: 'shield' },
  { key: 'medium', label: 'KNIGHT',    desc: 'Balanced — a worthy challenge',    color: '#EEAA22', icon: 'target' },
  { key: 'hard',   label: 'GALÁCTICO', desc: 'Ruthless AI — fight for the realm', color: '#EE3344', icon: 'zap' },
];

function formatBestTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function StartScreen({ onStart, onShowTutorial, stats }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(DIFFICULTIES.map(() => new Animated.Value(0))).current;
  const scales = useRef(DIFFICULTIES.map(() => new Animated.Value(1))).current;
  const scanAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    DIFFICULTIES.forEach((_, i) => {
      Animated.timing(listAnim[i], { toValue: 1, duration: 420, delay: 320 + i * 130, useNativeDriver: true }).start();
    });
    const scan = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 3400, useNativeDriver: true })
    );
    scan.start();
    return () => scan.stop();
  }, []);

  const handlePress = (key: Difficulty, i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scales[i], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onStart(key));
  };

  const scanTranslate = scanAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-120%', '120%'] });
  const hasStats = stats.wins > 0 || stats.losses > 0;

  return (
    <View style={[styles.container, { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 }]}>
      {/* Header */}
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }]}>
        <Text style={styles.subtitle}>REALM CONQUEST</Text>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>GALÁCTICOS</Text>
          <Animated.View
            style={[styles.scanLine, { transform: [{ translateX: scanTranslate }] }, { pointerEvents: 'none' } as any]}
          />
        </View>
        <View style={styles.titleAccent} />
        <Text style={styles.tagline}>Forge your kingdom. Crush your enemies.</Text>
      </Animated.View>

      {/* Stats row */}
      {hasStats && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.playerPlanet }]}>{stats.wins}</Text>
            <Text style={styles.statLabel}>VICTORIES</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNum, { color: Colors.enemyPlanet }]}>{stats.losses}</Text>
            <Text style={styles.statLabel}>DEFEATS</Text>
          </View>
          {stats.streak >= 2 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: '#FFD700' }]}>{stats.streak}</Text>
                <Text style={styles.statLabel}>STREAK 🔥</Text>
              </View>
            </>
          )}
          {stats.bestTimeMs !== null && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNum, { color: '#FFCC44' }]}>{formatBestTime(stats.bestTimeMs)}</Text>
                <Text style={styles.statLabel}>BEST</Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Difficulty selection */}
      <View style={styles.difficultySection}>
        <Text style={styles.sectionLabel}>— CHOOSE YOUR CHALLENGE —</Text>
        {DIFFICULTIES.map((d, i) => (
          <Animated.View key={d.key} style={{
            transform: [
              { scale: scales[i] },
              { translateX: listAnim[i].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
            ],
            opacity: listAnim[i],
          }}>
            <TouchableOpacity
              style={[styles.diffBtn, { borderColor: d.color + '44' }]}
              onPress={() => handlePress(d.key, i)}
              activeOpacity={0.8}>
              <View style={[styles.diffColorBar, { backgroundColor: d.color }]} />
              <View style={[styles.diffIcon, { backgroundColor: d.color + '22' }]}>
                <Feather name={d.icon} size={22} color={d.color} />
              </View>
              <View style={styles.diffTextGroup}>
                <Text style={[styles.diffLabel, { color: d.color }]}>{d.label}</Text>
                <Text style={styles.diffDesc}>{d.desc}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={d.color + '99'} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Tutorial link */}
      <TouchableOpacity style={styles.tutorialBtn} onPress={onShowTutorial} activeOpacity={0.7}>
        <Feather name="help-circle" size={16} color="rgba(255,220,100,0.35)" />
        <Text style={styles.tutorialText}>How to play</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', gap: 8 },
  subtitle: { fontSize: 10, letterSpacing: 5, color: 'rgba(255,200,60,0.55)', fontFamily: 'Inter_500Medium' },
  titleWrap: { overflow: 'hidden', borderRadius: 4 },
  title: { fontSize: 46, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 5 },
  scanLine: {
    position: 'absolute', top: 0, bottom: 0, width: '55%',
    backgroundColor: 'rgba(255,220,100,0.06)',
    transform: [{ skewX: '-15deg' }],
  },
  titleAccent: { width: 60, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,200,60,0.55)' },
  tagline: { fontSize: 13, color: 'rgba(255,220,140,0.38)', fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 2 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,200,60,0.1)',
    paddingVertical: 14, paddingHorizontal: 8,
  },
  statItem: { alignItems: 'center', flex: 1, gap: 3 },
  statNum: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 8, color: 'rgba(255,210,100,0.32)', fontFamily: 'Inter_500Medium', letterSpacing: 1.5 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,200,60,0.1)' },
  difficultySection: { gap: 10 },
  sectionLabel: { fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,200,60,0.25)', fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 2 },
  diffBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 14, gap: 14, overflow: 'hidden',
  },
  diffColorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, opacity: 0.8 },
  diffIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  diffTextGroup: { flex: 1, gap: 3 },
  diffLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  diffDesc: { fontSize: 12, color: 'rgba(255,220,140,0.38)', fontFamily: 'Inter_400Regular' },
  tutorialBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  tutorialText: { fontSize: 13, color: 'rgba(255,200,80,0.32)', fontFamily: 'Inter_400Regular' },
});
