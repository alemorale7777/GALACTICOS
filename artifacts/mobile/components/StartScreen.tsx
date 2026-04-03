import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
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
import { EmpireId, EMPIRE_CONFIG } from '@/constants/empires';
import { GameStats } from '@/hooks/useGameStorage';
import { RankTier } from '@/hooks/useRankedSeason';
import { getRankProgress } from '@/hooks/useRankedSeason';
import { Challenge } from '@/hooks/useDailyChallenges';
import { ClanData } from '@/hooks/useClanSystem';
import DailyChallengesPanel from './DailyChallengesPanel';

const { width: screenWidth } = Dimensions.get('window');

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
  lastEmpireId?: string | null;
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

const TITLE_LETTERS = ['T', 'H', 'R', 'A', 'X', 'O', 'N'];
const TITLE_FONT_SIZE = Math.min(screenWidth * 0.18, 72);

function formatBestTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

// ── Cinematic Title Component ───────────────────────────────────────────────
function CinematicTitle({ empireColor, empireName }: { empireColor?: string; empireName?: string }) {
  // Per-letter entrance animations
  const letterAnims = useRef(TITLE_LETTERS.map(() => new Animated.Value(0))).current;
  const letterScales = useRef(TITLE_LETTERS.map(() => new Animated.Value(0.3))).current;
  const titlePulse = useRef(new Animated.Value(1)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleBreath = useRef(new Animated.Value(0.5)).current;
  const glowIntensity = useRef(new Animated.Value(0.8)).current;
  const shimmerPos = useRef(new Animated.Value(-0.4)).current;

  useEffect(() => {
    // Staggered letter entrance
    const letterAnimations = TITLE_LETTERS.map((_, i) =>
      Animated.parallel([
        Animated.timing(letterAnims[i], {
          toValue: 1,
          duration: 400,
          delay: i * 80,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(letterScales[i], {
            toValue: 1.1,
            duration: 300,
            delay: i * 80,
            useNativeDriver: true,
          }),
          Animated.timing(letterScales[i], {
            toValue: 1.0,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    Animated.parallel(letterAnimations).start(() => {
      // After all letters land: pulse
      Animated.sequence([
        Animated.timing(titlePulse, { toValue: 1.04, duration: 150, useNativeDriver: true }),
        Animated.timing(titlePulse, { toValue: 1.0, duration: 150, useNativeDriver: true }),
      ]).start();

      // Subtitle fade in
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });

    // Continuous idle: glow pulse
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowIntensity, { toValue: 1.0, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowIntensity, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
      ])
    );
    glowLoop.start();

    // Subtitle breathing
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(subtitleBreath, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(subtitleBreath, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])
    );
    breathLoop.start();

    // Shimmer sweep every 3 seconds
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPos, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(shimmerPos, { toValue: -0.4, duration: 0, useNativeDriver: true }),
      ])
    );
    shimmerLoop.start();

    return () => {
      glowLoop.stop();
      breathLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  return (
    <View style={titleStyles.container}>
      {/* Title letters */}
      <Animated.View style={[titleStyles.lettersRow, { transform: [{ scale: titlePulse }] }]}>
        {TITLE_LETTERS.map((letter, i) => (
          <Animated.Text
            key={i}
            style={[
              titleStyles.letter,
              empireColor ? { color: empireColor, textShadowColor: empireColor } : {},
              {
                opacity: letterAnims[i],
                transform: [
                  { scale: letterScales[i] },
                  {
                    translateY: letterAnims[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </Animated.View>

      {/* Shimmer overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          titleStyles.shimmer,
          {
            transform: [
              {
                translateX: shimmerPos.interpolate({
                  inputRange: [-0.4, 1.4],
                  outputRange: [-TITLE_FONT_SIZE * 2, screenWidth],
                }),
              },
            ],
            opacity: shimmerPos.interpolate({
              inputRange: [-0.4, 0.2, 0.8, 1.4],
              outputRange: [0, 0.6, 0.6, 0],
            }),
          },
        ]}
      />

      {/* Subtitle */}
      <Animated.Text
        style={[
          titleStyles.subtitle,
          {
            opacity: Animated.multiply(subtitleOpacity, subtitleBreath),
          },
        ]}
      >
        {empireName ? `EMPIRE OF ${empireName.toUpperCase()}` : 'EMPIRE CONQUEST'}
      </Animated.Text>
    </View>
  );
}

const titleStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: 8,
  },
  lettersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: TITLE_FONT_SIZE,
    fontFamily: Platform.select({
      ios: 'AvenirNext-Heavy',
      android: 'sans-serif-black',
      default: 'Inter_700Bold',
    }),
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 12,
    textShadowColor: 'rgba(255,215,0,1.0)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
    marginHorizontal: 0,
  } as any,
  shimmer: {
    position: 'absolute',
    top: 0,
    width: TITLE_FONT_SIZE * 2.5,
    height: TITLE_FONT_SIZE + 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ skewX: '-15deg' }],
  } as any,
  subtitle: {
    fontSize: 13,
    letterSpacing: 7,
    color: 'rgba(255,215,0,0.55)',
    fontFamily: 'Inter_500Medium',
    marginTop: 18,
  },
});

// ── Play Button with glow ───────────────────────────────────────────────────
function PlayButton({ onPress }: { onPress: () => void }) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shinePos = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    // Subtle float
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -2, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 2, duration: 1500, useNativeDriver: true }),
      ])
    );
    floatLoop.start();

    // Shine sweep every 4 seconds
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shinePos, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.delay(3300),
        Animated.timing(shinePos, { toValue: -1, duration: 0, useNativeDriver: true }),
      ])
    );
    shineLoop.start();

    return () => { floatLoop.stop(); shineLoop.stop(); };
  }, []);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1.0, tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY: floatAnim }, { scale: scaleAnim }],
        width: '100%',
      }}
    >
      <TouchableOpacity style={playStyles.btn} onPress={handlePress} activeOpacity={0.85}>
        {/* Shine sweep */}
        <Animated.View
          pointerEvents="none"
          style={[
            playStyles.shine,
            {
              transform: [
                {
                  translateX: shinePos.interpolate({
                    inputRange: [-1, 1.5],
                    outputRange: [-100, screenWidth],
                  }),
                },
              ],
              opacity: shinePos.interpolate({
                inputRange: [-1, 0, 0.8, 1.5],
                outputRange: [0, 0.4, 0.4, 0],
              }),
            },
          ]}
        />
        <View style={playStyles.iconWrap}>
          <View style={playStyles.playTriangle} />
        </View>
        <Text style={playStyles.text}>PLAY</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const playStyles = StyleSheet.create({
  btn: {
    width: '100%',
    maxWidth: 310,
    height: 58,
    borderRadius: 14,
    backgroundColor: '#C8A84B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    overflow: 'hidden',
    // Glow via shadow
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 0px rgba(0,0,0,0.4), 0px 4px 20px rgba(255,165,0,0.50), 0px 0px 40px rgba(255,140,0,0.30), 0px 0px 70px rgba(255,100,0,0.15)',
      } as any,
      default: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
      },
    }),
  },
  shine: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ skewX: '-20deg' }],
  } as any,
  iconWrap: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#1A0F00',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  text: {
    fontSize: 19,
    fontFamily: 'Inter_700Bold',
    color: '#120A00',
    letterSpacing: 4,
  },
});

// ── Main Component ──────────────────────────────────────────────────────────
export default function StartScreen({
  onStart, onShowTutorial, onCampaign, onTournament, onWorldMap,
  onClan, onReplays, onLocalMultiplayer,
  stats, rank, xp, seasonDaysLeft, challenges, msUntilChallengeReset,
  clan, soundEnabled, onToggleSound, lastEmpireId,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Entrance animations
  const rankBarAnim = useRef(new Animated.Value(0)).current;
  const playBtnAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(DIFFICULTIES.map(() => new Animated.Value(0))).current;
  const scales = useRef(DIFFICULTIES.map(() => new Animated.Value(1))).current;
  const secondaryAnims = useRef(SECONDARY_BUTTONS.map(() => new Animated.Value(0))).current;

  const progress = getRankProgress(xp);
  const rankColor = RANK_COLORS[rank];

  useEffect(() => {
    // Play button entrance (after title completes ~600ms)
    Animated.timing(playBtnAnim, { toValue: 1, duration: 400, delay: 800, useNativeDriver: true }).start();

    // Difficulty buttons staggered
    DIFFICULTIES.forEach((_, i) => {
      Animated.timing(listAnim[i], { toValue: 1, duration: 420, delay: 900 + i * 130, useNativeDriver: true }).start();
    });

    // Secondary buttons staggered
    SECONDARY_BUTTONS.forEach((_, i) => {
      Animated.timing(secondaryAnims[i], { toValue: 1, duration: 350, delay: 1100 + i * 80, useNativeDriver: true }).start();
    });

    // Rank bar
    Animated.timing(rankBarAnim, { toValue: progress.fraction, duration: 900, delay: 400, useNativeDriver: false }).start();
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

  const handlePlayPress = () => onStart('medium');

  const callbackMap: Record<string, () => void> = {
    onCampaign, onTournament, onLocalMultiplayer, onWorldMap, onReplays, onClan,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={[styles.container, { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cinematic Title (tinted by last empire) ── */}
      <CinematicTitle
        empireColor={lastEmpireId ? EMPIRE_CONFIG[lastEmpireId as EmpireId]?.nodeColor : undefined}
        empireName={lastEmpireId ? EMPIRE_CONFIG[lastEmpireId as EmpireId]?.empire : undefined}
      />

      {/* Clan badge */}
      {clan && (
        <TouchableOpacity style={[styles.clanBadge, { borderColor: clan.bannerColor + '44' }]} onPress={onClan}>
          <View style={[styles.clanDot, { backgroundColor: clan.bannerColor }]} />
          <Text style={[styles.clanText, { color: clan.bannerColor }]}>{clan.name}</Text>
        </TouchableOpacity>
      )}

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

      {/* ── Play Button with War Map Constellation ── */}
      <Animated.View style={{
        opacity: playBtnAnim,
        transform: [{ translateY: playBtnAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        alignItems: 'center',
      }}>
        {/* War map constellation behind button */}
        <View style={{ position: 'absolute', width: 200, height: 100, top: -20 }} pointerEvents="none">
          {/* 5 pulsing nodes */}
          {[
            { x: 30, y: 20 }, { x: 100, y: 8 }, { x: 170, y: 25 },
            { x: 60, y: 65 }, { x: 140, y: 70 },
          ].map((pos, i) => {
            const empColor = lastEmpireId ? EMPIRE_CONFIG[lastEmpireId as EmpireId]?.nodeColor : '#FFD700';
            return (
              <Animated.View key={i} style={{
                position: 'absolute', left: pos.x - 4, top: pos.y - 4,
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: empColor || '#FFD700',
                opacity: 0.2,
                shadowColor: empColor || '#FFD700',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 6,
              }} />
            );
          })}
          {/* Connection lines */}
          {[
            [30, 20, 100, 8], [100, 8, 170, 25], [30, 20, 60, 65],
            [60, 65, 140, 70], [100, 8, 140, 70],
          ].map(([x1, y1, x2, y2], i) => (
            <View key={`l${i}`} style={{
              position: 'absolute',
              left: Math.min(x1, x2), top: Math.min(y1, y2),
              width: Math.abs(x2 - x1) || 1, height: Math.abs(y2 - y1) || 1,
              borderWidth: 0.5,
              borderColor: (lastEmpireId ? EMPIRE_CONFIG[lastEmpireId as EmpireId]?.nodeColor : '#FFD700') + '22',
            }} />
          ))}
        </View>
        <PlayButton onPress={handlePlayPress} />
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
          {SECONDARY_BUTTONS.map((btn, i) => (
            <Animated.View
              key={btn.label}
              style={{
                opacity: secondaryAnims[i],
                transform: [{
                  translateY: secondaryAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
                width: '48%',
              }}
            >
              <TouchableOpacity
                style={[styles.modeBtn, { borderColor: 'rgba(255,215,0,0.2)' }]}
                onPress={() => callbackMap[btn.action]?.()}
                activeOpacity={0.7}
              >
                <Feather name={btn.icon} size={18} color={btn.color} />
                <Text style={styles.modeBtnText}>{btn.label.toUpperCase()}</Text>
              </TouchableOpacity>
            </Animated.View>
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
        <TouchableOpacity style={styles.bottomIconBtn} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
          <Feather name="settings" size={20} color="rgba(255,215,0,0.35)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.versionText}>v1.0.0 · thraxon.app</Text>

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

      {/* ── Settings Modal ── */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SETTINGS</Text>
            <View style={styles.modalAccent} />
            <View style={styles.modalStats}>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Sound</Text>
                <TouchableOpacity
                  style={[styles.settingsToggle, soundEnabled && styles.settingsToggleOn]}
                  onPress={onToggleSound}>
                  <Text style={styles.settingsToggleText}>{soundEnabled ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Music</Text>
                <View style={[styles.settingsToggle, styles.settingsToggleDisabled]}>
                  <Text style={styles.settingsToggleTextDisabled}>SOON</Text>
                </View>
              </View>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Haptics</Text>
                <View style={[styles.settingsToggle, styles.settingsToggleOn]}>
                  <Text style={styles.settingsToggleText}>ON</Text>
                </View>
              </View>
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>Quality</Text>
                <View style={[styles.settingsToggle, styles.settingsToggleOn]}>
                  <Text style={styles.settingsToggleText}>AUTO</Text>
                </View>
              </View>
            </View>
            <View style={styles.aboutSection}>
              <Text style={styles.aboutTitle}>ABOUT</Text>
              <Text style={styles.aboutText}>THRAXON v1.0.0</Text>
              <Text style={styles.aboutText}>Empire Conquest — Forged in Battle</Text>
              <Text style={styles.aboutTextMuted}>Developed independently</Text>
              <Text style={styles.aboutTextMuted}>© 2026 THRAXON. All rights reserved.</Text>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowSettings(false)} activeOpacity={0.8}>
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
    alignItems: 'center',
  },

  /* ── Clan Badge ── */
  clanBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1,
    backgroundColor: 'rgba(255,220,80,0.03)',
  },
  clanDot: { width: 8, height: 8, borderRadius: 4 },
  clanText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },

  /* ── Rank Display ── */
  rankSection: { alignItems: 'center', gap: 4, paddingVertical: 4, width: '100%' },
  rankName: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  rankBarOuter: {
    width: 180, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.25)',
  },
  rankBarFill: {
    height: '100%', borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  rankXpRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rankXpText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#FFF8E8' },
  rankXpNext: { fontSize: 10, color: 'rgba(255,215,0,0.35)', fontFamily: 'Inter_400Regular' },
  rankSeason: { fontSize: 9, color: 'rgba(255,215,0,0.25)', fontFamily: 'Inter_400Regular', letterSpacing: 1 },

  /* ── Difficulty Section ── */
  difficultySection: { gap: 10, width: '100%' },
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
  modesSection: { gap: 10, width: '100%' },
  modesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  modeBtn: {
    width: '100%',
    height: 56,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.20)',
  },
  modeBtnText: {
    fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.82)', letterSpacing: 1,
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

  /* ── Version Text ── */
  versionText: {
    fontSize: 8, color: 'rgba(255,255,255,0.15)',
    fontFamily: 'Inter_400Regular', letterSpacing: 1.5,
    textAlign: 'center', marginTop: 4,
  },

  /* ── Settings Modal ── */
  settingsRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  settingsLabel: { fontSize: 14, color: 'rgba(255,220,140,0.5)', fontFamily: 'Inter_400Regular' },
  settingsToggle: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsToggleOn: { backgroundColor: 'rgba(255,215,0,0.12)', borderColor: 'rgba(255,215,0,0.3)' },
  settingsToggleDisabled: { opacity: 0.3 },
  settingsToggleText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#FFD700', letterSpacing: 1 },
  settingsToggleTextDisabled: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.3)', letterSpacing: 1 },
  aboutSection: { alignItems: 'center', gap: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,215,0,0.08)', width: '100%' },
  aboutTitle: { fontSize: 9, fontFamily: 'Inter_700Bold', color: 'rgba(255,215,0,0.3)', letterSpacing: 3, marginBottom: 4 },
  aboutText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,220,140,0.45)', textAlign: 'center' },
  aboutTextMuted: { fontSize: 10, fontFamily: 'Inter_400Regular', color: 'rgba(255,220,140,0.2)', textAlign: 'center' },
});
