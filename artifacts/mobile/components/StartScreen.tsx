import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  ScrollView,
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
import { RankTier } from '@/hooks/useRankedSeason';
import { getRankProgress } from '@/hooks/useRankedSeason';
import { Challenge } from '@/hooks/useDailyChallenges';
import { ClanData } from '@/hooks/useClanSystem';
import DailyChallengesPanel from './DailyChallengesPanel';

interface Props {
  onStart: (difficulty: Difficulty) => void;
  onShowTutorial: () => void;
  onCampaign: () => void;
  onTournament: () => void;
  onWorldMap: () => void;
  onClan: () => void;
  onReplays: () => void;
  onLocalMultiplayer: () => void;
  stats: GameStats;
  rank: RankTier;
  xp: number;
  seasonDaysLeft: number;
  challenges: Challenge[];
  msUntilChallengeReset: number;
  clan: ClanData | null;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; color: string; icon: any }[] = [
  { key: 'easy', label: 'SQUIRE', desc: 'Slow enemy AI, learn the game', color: '#44BB66', icon: 'shield' },
  { key: 'medium', label: 'KNIGHT', desc: 'Balanced — a worthy challenge', color: '#EEAA22', icon: 'target' },
  { key: 'hard', label: 'GALACTICO', desc: 'Ruthless AI — fight for the realm', color: '#EE3344', icon: 'zap' },
];

const RANK_COLORS: Record<RankTier, string> = {
  Squire: '#8B7355',
  Knight: '#C0C0C0',
  Warlord: '#FFD700',
  Galactico: '#FF6B35',
  Legend: '#FF2D55',
};

const SECONDARY_BUTTONS: { label: string; icon: any; color: string; action: keyof Props }[] = [
  { label: 'Campaign', icon: 'book-open', color: '#FFD700', action: 'onCampaign' },
  { label: 'Tournament', icon: 'flag', color: '#FF6B35', action: 'onTournament' },
  { label: '2 Player', icon: 'users', color: '#44BB66', action: 'onLocalMultiplayer' },
  { label: 'World Map', icon: 'globe', color: '#22AAAA', action: 'onWorldMap' },
  { label: 'Replays', icon: 'film', color: '#AA88FF', action: 'onReplays' },
  { label: 'Clans', icon: 'shield', color: '#FF5588', action: 'onClan' },
];

function formatBestTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function StartScreen({
  onStart, onShowTutorial, onCampaign, onTournament, onWorldMap,
  onClan, onReplays, onLocalMultiplayer,
  stats, rank, xp, seasonDaysLeft, challenges, msUntilChallengeReset,
  clan, soundEnabled, onToggleSound,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [showStats, setShowStats] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(DIFFICULTIES.map(() => new Animated.Value(0))).current;
  const scales = useRef(DIFFICULTIES.map(() => new Animated.Value(1))).current;
  const scanAnim = useRef(new Animated.Value(-1)).current;
  const rankBarAnim = useRef(new Animated.Value(0)).current;
  const playBtnAnim = useRef(new Animated.Value(0)).current;

  const progress = getRankProgress(xp);
  const rankColor = RANK_COLORS[rank];

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(playBtnAnim, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
    DIFFICULTIES.forEach((_, i) => {
      Animated.timing(listAnim[i], { toValue: 1, duration: 420, delay: 320 + i * 130, useNativeDriver: true }).start();
    });
    Animated.timing(rankBarAnim, { toValue: progress.fraction, duration: 900, delay: 400, useNativeDriver: false }).start();
    const scan = Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 3400, useNativeDriver: true })
    );
    scan.start();
    return () => scan.stop();
  }, []);

  useEffect(() => {
    Animated.timing(rankBarAnim, { toValue: progress.fraction, duration: 800, useNativeDriver: false }).start();
  }, [progress.fraction]);

  const handlePress = (key: Difficulty, i: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scales[i], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scales[i], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onStart(key));
  };

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart('medium');
  };

  const callbackMap: Record<string, () => void> = {
    onCampaign, onTournament, onLocalMultiplayer, onWorldMap, onReplays, onClan,
  };

  const scanTranslate = scanAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-120%', '120%'] });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.container, { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 }]}
      showsVerticalScrollIndicator={false}>

      {/* ── Title ── */}
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
      }]}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>THRAXON</Text>
          <Animated.View
            style={[styles.scanLine, { transform: [{ translateX: scanTranslate }] }, { pointerEvents: 'none' } as any]}
          />
        </View>
        <Text style={styles.subtitle}>EMPIRE CONQUEST</Text>

        {/* Clan badge */}
        {clan && (
          <TouchableOpacity style={[styles.clanBadge, { borderColor: clan.bannerColor + '44' }]} onPress={onClan}>
            <View style={[styles.clanDot, { backgroundColor: clan.bannerColor }]} />
            <Text style={[styles.clanText, { color: clan.bannerColor }]}>{clan.name}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Rank Display ── */}
      <View style={styles.rankSection}>
        <Text style={[styles.rankName, { color: rankColor }]}>{rank.toUpperCase()}</Text>
        <View style={styles.rankBarOuter}>
          <Animated.View style={[styles.rankBarFill, {
            width: rankBarAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        <View style={styles.rankXpRow}>
          <Text style={styles.rankXpText}>{xp} XP</Text>
          {progress.fraction < 1 && (
            <Text style={styles.rankXpNext}>{progress.current}/{progress.next}</Text>
          )}
          <Text style={styles.rankSeason}>{seasonDaysLeft}d left</Text>
        </View>
      </View>

      {/* ── Daily Challenges ── */}
      <DailyChallengesPanel challenges={challenges} msUntilReset={msUntilChallengeReset} />

      {/* ── Play Button ── */}
      <Animated.View style={{
        opacity: playBtnAnim,
        transform: [{ translateY: playBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
      }}>
        <TouchableOpacity style={styles.playBtn} onPress={handlePlayPress} activeOpacity={0.8}>
          <Text style={styles.playBtnText}>PLAY GAME</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Difficulty selection ── */}
      <View style={styles.difficultySection}>
        <Text style={styles.sectionLabel}>QUICK PLAY</Text>
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

      {/* ── Secondary Buttons Grid ── */}
      <View style={styles.modesSection}>
        <Text style={styles.sectionLabel}>MORE MODES</Text>
        <View style={styles.modesGrid}>
          {SECONDARY_BUTTONS.map((btn) => (
            <TouchableOpacity
              key={btn.label}
              style={styles.modeBtn}
              onPress={() => callbackMap[btn.action]?.()}
              activeOpacity={0.7}
            >
              <Feather name={btn.icon} size={18} color={btn.color} />
              <Text style={styles.modeBtnText}>{btn.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Bottom ── */}
      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.bottomIconBtn} onPress={onToggleSound} activeOpacity={0.7}>
          <Feather name={soundEnabled ? 'volume-2' : 'volume-x'} size={20} color="rgba(255,215,0,0.35)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIconBtn} onPress={onShowTutorial} activeOpacity={0.7}>
          <Feather name="help-circle" size={20} color="rgba(255,215,0,0.35)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomIconBtn} onPress={() => setShowStats(true)} activeOpacity={0.7}>
          <Feather name="bar-chart-2" size={20} color="rgba(255,215,0,0.35)" />
        </TouchableOpacity>
      </View>

      {/* ── Stats Modal ── */}
      <Modal visible={showStats} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>YOUR STATS</Text>
            <View style={styles.modalAccent} />
            <View style={styles.modalStats}>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Total Games</Text>
                <Text style={styles.modalStatVal}>{stats.wins + stats.losses}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Victories</Text>
                <Text style={[styles.modalStatVal, { color: Colors.playerPlanet }]}>{stats.wins}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Defeats</Text>
                <Text style={[styles.modalStatVal, { color: Colors.enemyPlanet }]}>{stats.losses}</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Win Rate</Text>
                <Text style={styles.modalStatVal}>
                  {stats.wins + stats.losses > 0 ? Math.round(stats.wins / (stats.wins + stats.losses) * 100) : 0}%
                </Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text style={styles.modalStatLabel}>Current Streak</Text>
                <Text style={[styles.modalStatVal, { color: '#FFD700' }]}>{stats.streak}</Text>
              </View>
              {stats.bestTimeMs !== null && (
                <View style={styles.modalStatRow}>
                  <Text style={styles.modalStatLabel}>Best Time</Text>
                  <Text style={[styles.modalStatVal, { color: '#FFCC44' }]}>{formatBestTime(stats.bestTimeMs)}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowStats(false)} activeOpacity={0.8}>
              <Text style={styles.modalCloseText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    gap: 12,
  },

  /* ── Header / Title ── */
  header: { alignItems: 'center', gap: 4 },
  titleWrap: { overflow: 'hidden', borderRadius: 4 },
  title: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 6,
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    fontSize: 12,
    letterSpacing: 5,
    color: 'rgba(255,215,0,0.4)',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  scanLine: {
    position: 'absolute', top: 0, bottom: 0, width: '55%',
    backgroundColor: 'rgba(255,215,0,0.06)',
    transform: [{ skewX: '-15deg' }],
  },
  clanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(255,220,80,0.03)', marginTop: 6,
  },
  clanDot: { width: 8, height: 8, borderRadius: 4 },
  clanText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },

  /* ── Rank Display ── */
  rankSection: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  rankName: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  rankBarOuter: {
    width: 200, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,215,0,0.1)', overflow: 'hidden',
  },
  rankBarFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  rankXpRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rankXpText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFF8E8' },
  rankXpNext: { fontSize: 10, color: 'rgba(255,215,0,0.35)', fontFamily: 'Inter_400Regular' },
  rankSeason: { fontSize: 9, color: 'rgba(255,215,0,0.25)', fontFamily: 'Inter_400Regular', letterSpacing: 1 },

  /* ── Play Button ── */
  playBtn: {
    width: '100%', height: 56, borderRadius: 14,
    backgroundColor: '#C8A84B',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  playBtnText: {
    fontSize: 17, fontFamily: 'Inter_700Bold', color: '#1A0F00', letterSpacing: 2,
  },

  /* ── Difficulty Section ── */
  difficultySection: { gap: 10 },
  sectionLabel: {
    fontSize: 9, letterSpacing: 2.5, color: 'rgba(255,215,0,0.25)',
    fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginBottom: 2,
  },
  diffBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 14, gap: 14, overflow: 'hidden',
  },
  diffColorBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, opacity: 0.8 },
  diffIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  diffTextGroup: { flex: 1, gap: 3 },
  diffLabel: { fontSize: 15, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  diffDesc: { fontSize: 12, color: 'rgba(255,220,140,0.38)', fontFamily: 'Inter_400Regular' },

  /* ── Secondary Buttons Grid ── */
  modesSection: { gap: 10 },
  modesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  modeBtn: {
    width: '48%', height: 48, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  modeBtnText: {
    fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFFFFF', letterSpacing: 1,
  },

  /* ── Bottom Row ── */
  bottomRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 8,
  },
  bottomIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  /* ── Stats Modal ── */
  modalBg: {
    flex: 1, backgroundColor: 'rgba(6,10,4,0.88)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: 'rgba(16,10,4,0.98)',
    borderRadius: 24, padding: 28, width: '85%',
    alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: 'rgba(180,140,40,0.22)',
  },
  modalTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 3 },
  modalAccent: { width: 40, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,200,60,0.5)' },
  modalStats: { width: '100%', gap: 12 },
  modalStatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8 },
  modalStatLabel: { fontSize: 14, color: 'rgba(255,220,140,0.5)', fontFamily: 'Inter_400Regular' },
  modalStatVal: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#FFF8E8' },
  modalClose: {
    marginTop: 8, paddingVertical: 12, paddingHorizontal: 40,
    borderRadius: 20, backgroundColor: 'rgba(255,200,60,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.2)',
  },
  modalCloseText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: 'rgba(255,210,100,0.6)', letterSpacing: 1.5 },
});
