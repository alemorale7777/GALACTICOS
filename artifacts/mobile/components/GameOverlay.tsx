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
import { EmpireConfig, GameMode } from '@/constants/empires';

interface Props {
  phase: GamePhase;
  onReset: () => void;
  onMenu: () => void;
  onChangeEmpire?: () => void;
  elapsedMs: number;
  stats: GameStats;
  prevBestTimeMs: number | null;
  playerEmpire?: EmpireConfig | null;
  nodesCaptures?: number;
  gameMode?: GameMode;
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
  xFrac: Math.random(),
  size: 5 + Math.random() * 8,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  driftX: (Math.random() - 0.5) * 120,
  delay: Math.random() * 1400,
  duration: 2000 + Math.random() * 1800,
  spin: Math.random() > 0.5 ? 3 : -3,
  rect: Math.random() > 0.5,
}));

// Pre-generate random jitter offsets for defeat shake animation
const JITTER_FRAMES = 12;
const jitterOffsets = Array.from({ length: JITTER_FRAMES }, () => ({
  x: (Math.random() - 0.5) * 4,
  y: (Math.random() - 0.5) * 4,
}));

export default function GameOverlay({
  phase, onReset, onMenu, onChangeEmpire, elapsedMs, stats, prevBestTimeMs,
  playerEmpire, nodesCaptures, gameMode = 'conquest',
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(40)).current;
  const starScales = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;

  // Victory title scale (spring entrance)
  const titleScale = useRef(new Animated.Value(0)).current;

  // Defeat title jitter
  const defeatJitterX = useRef(new Animated.Value(0)).current;
  const defeatJitterY = useRef(new Animated.Value(0)).current;

  // Stat row stagger reveals (4 stats max)
  const statAnims = useRef([0, 1, 2, 3].map(() => ({
    translateY: new Animated.Value(30),
    opacity: new Animated.Value(0),
  }))).current;

  // Victory: empire color fill from center
  const victoryFill = useRef(new Animated.Value(0)).current;
  // Defeat: desaturation
  const defeatGrey = useRef(new Animated.Value(0)).current;

  // Icon glow pulse
  const iconGlow = useRef(new Animated.Value(0)).current;

  const confettiAnims = useRef(
    confettiMeta.map(() => ({
      y: new Animated.Value(-60),
      xDrift: new Animated.Value(0),
      opacity: new Animated.Value(1),
      rotate: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (phase !== 'playing') {
      Haptics.notificationAsync(
        phase === 'won' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
      );
      starScales.forEach(s => s.setValue(0));
      iconScale.setValue(0.4);
      victoryFill.setValue(0);
      defeatGrey.setValue(0);
      titleScale.setValue(0);
      defeatJitterX.setValue(0);
      defeatJitterY.setValue(0);
      iconGlow.setValue(0);
      statAnims.forEach(a => {
        a.translateY.setValue(30);
        a.opacity.setValue(0);
      });

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: false }),
        Animated.spring(iconScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: false }),
      ]).start();

      // Icon glow pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconGlow, { toValue: 1, duration: 1200, useNativeDriver: false }),
          Animated.timing(iconGlow, { toValue: 0.3, duration: 1200, useNativeDriver: false }),
        ])
      ).start();

      // Stat stagger reveal
      statAnims.forEach((a, i) => {
        Animated.sequence([
          Animated.delay(500 + i * 300),
          Animated.parallel([
            Animated.spring(a.translateY, { toValue: 0, tension: 120, friction: 10, useNativeDriver: false }),
            Animated.timing(a.opacity, { toValue: 1, duration: 250, useNativeDriver: false }),
          ]),
        ]).start();
      });

      if (phase === 'won') {
        // Victory title spring scale: 0 -> 1.1 -> 1.0
        Animated.sequence([
          Animated.delay(200),
          Animated.spring(titleScale, { toValue: 1.1, tension: 180, friction: 8, useNativeDriver: false }),
          Animated.spring(titleScale, { toValue: 1.0, tension: 120, friction: 10, useNativeDriver: false }),
        ]).start();

        // Victory fill animation
        Animated.timing(victoryFill, { toValue: 1, duration: 2000, useNativeDriver: false }).start();

        const numStars = getStars(elapsedMs);
        [0, 1, 2].forEach(i => {
          Animated.sequence([
            Animated.delay(600 + i * 180),
            Animated.spring(starScales[i], { toValue: i < numStars ? 1.3 : 0.7, tension: 200, friction: 5, useNativeDriver: false }),
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
              Animated.timing(anim.y, { toValue: SCREEN_H + 80, duration: meta.duration, useNativeDriver: false }),
              Animated.timing(anim.xDrift, { toValue: meta.driftX, duration: meta.duration, useNativeDriver: false }),
              Animated.timing(anim.rotate, { toValue: meta.spin, duration: meta.duration, useNativeDriver: false }),
              Animated.sequence([
                Animated.delay(meta.duration * 0.62),
                Animated.timing(anim.opacity, { toValue: 0, duration: meta.duration * 0.38, useNativeDriver: false }),
              ]),
            ]),
          ]).start();
        });
      } else {
        // Defeat title: jitter shake for 300ms then settle
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(titleScale, { toValue: 1, duration: 100, useNativeDriver: false }),
        ]).start();

        // Create a rapid jitter sequence
        const jitterDuration = 300 / JITTER_FRAMES;
        const jitterSequenceX: Animated.CompositeAnimation[] = [];
        const jitterSequenceY: Animated.CompositeAnimation[] = [];
        jitterOffsets.forEach((offset) => {
          jitterSequenceX.push(
            Animated.timing(defeatJitterX, { toValue: offset.x, duration: jitterDuration, useNativeDriver: false })
          );
          jitterSequenceY.push(
            Animated.timing(defeatJitterY, { toValue: offset.y, duration: jitterDuration, useNativeDriver: false })
          );
        });
        // Settle to 0
        jitterSequenceX.push(Animated.timing(defeatJitterX, { toValue: 0, duration: 80, useNativeDriver: false }));
        jitterSequenceY.push(Animated.timing(defeatJitterY, { toValue: 0, duration: 80, useNativeDriver: false }));

        Animated.parallel([
          Animated.sequence(jitterSequenceX),
          Animated.sequence(jitterSequenceY),
        ]).start();

        // Defeat desaturation
        Animated.timing(defeatGrey, { toValue: 0.6, duration: 1500, useNativeDriver: false }).start();
      }
    } else {
      opacity.setValue(0);
      translateY.setValue(40);
      starScales.forEach(s => s.setValue(0));
      iconScale.setValue(0.4);
      victoryFill.setValue(0);
      defeatGrey.setValue(0);
      titleScale.setValue(0);
      defeatJitterX.setValue(0);
      defeatJitterY.setValue(0);
      iconGlow.setValue(0);
      statAnims.forEach(a => {
        a.translateY.setValue(30);
        a.opacity.setValue(0);
      });
    }
  }, [phase]);

  if (phase === 'playing') return null;

  const isWin = phase === 'won';
  const empireColor = playerEmpire?.nodeColor;
  const accentColor = isWin ? (empireColor ?? Colors.playerPlanet) : Colors.enemyPlanet;
  const isBestTime = isWin && (prevBestTimeMs === null || elapsedMs < prevBestTimeMs);
  const stars = isWin ? getStars(elapsedMs) : 0;

  const empireName = isWin
    ? (playerEmpire?.empire ?? 'Your Kingdom')
    : 'The Enemy';

  // Count how many stat columns we have for stagger indexing
  let statIndex = 0;

  return (
    <Animated.View style={[
      styles.container,
      { opacity },
      !isWin && { backgroundColor: 'rgba(0,0,0,0.88)' },
    ]}>
      {/* Victory: empire color fills screen from center */}
      {isWin && (
        <Animated.View style={[StyleSheet.absoluteFill, {
          backgroundColor: accentColor,
          opacity: victoryFill.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.12, 0] }),
        }]} pointerEvents="none" />
      )}

      {/* Defeat: grey overlay */}
      {!isWin && (
        <Animated.View style={[StyleSheet.absoluteFill, {
          backgroundColor: '#333333',
          opacity: defeatGrey,
        }]} pointerEvents="none" />
      )}

      {isWin && confettiAnims.map((anim, i) => {
        const meta = confettiMeta[i];
        const left = meta.xFrac * (SCREEN_W - meta.size);
        return (
          <Animated.View
            key={`conf${i}`}
            pointerEvents="none"
            style={{
              position: 'absolute', left, top: 0,
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

      <Animated.View style={[
        styles.card,
        {
          transform: [{ translateY }],
          borderColor: isWin
            ? (accentColor + '4D')  // 30% opacity
            : 'rgba(102,102,102,0.30)',
        },
      ]}>
        <View style={[styles.topAccentLine, { backgroundColor: accentColor }]} />

        {/* Icon area with glow circle */}
        <View style={styles.iconContainer}>
          {isWin && (
            <Animated.View style={[styles.iconGlowCircle, {
              backgroundColor: accentColor,
              opacity: iconGlow.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
              transform: [{ scale: iconGlow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
            }]} />
          )}
          <Animated.View style={[
            styles.iconRing,
            {
              borderColor: isWin ? (accentColor + '55') : 'rgba(102,102,102,0.35)',
              transform: [{ scale: iconScale }],
            },
          ]}>
            <Feather
              name={isWin ? 'award' : 'x-circle'}
              size={44}
              color={isWin ? accentColor : '#666666'}
            />
          </Animated.View>
        </View>

        {/* Title with animated entrance */}
        <Animated.View style={{
          transform: [
            { scale: titleScale },
            { translateX: isWin ? 0 : defeatJitterX as unknown as number },
            { translateY: isWin ? 0 : defeatJitterY as unknown as number },
          ],
        }}>
          <Text style={[
            styles.result,
            isWin
              ? {
                  color: '#FFD700',
                  textShadowColor: 'rgba(255,215,0,0.6)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 20,
                }
              : {
                  color: '#666666',
                },
          ]}>
            {isWin
              ? (gameMode === 'regicide' ? 'REGICIDE!' : 'CONQUEST COMPLETE')
              : (gameMode === 'regicide' ? 'YOUR KING HAS FALLEN' : 'CONQUERED')}
          </Text>
        </Animated.View>

        <Text style={[
          styles.resultSub,
          !isWin && { color: 'rgba(150,150,150,0.5)' },
        ]}>
          {isWin
            ? (gameMode === 'regicide' ? `The enemy King falls to ${empireName}!` : `${empireName} conquers all!`)
            : (gameMode === 'regicide' ? 'Your King has been struck down.' : 'Your empire has fallen.')}
        </Text>

        {isWin && (
          <View style={styles.starsRow}>
            {[0, 1, 2].map(i => (
              <Animated.Text key={i}
                style={[styles.star, {
                  color: i < stars ? '#FFD700' : 'rgba(255,210,80,0.1)',
                  transform: [{ scale: starScales[i] }],
                  ...(i < stars ? {
                    textShadowColor: 'rgba(255,215,0,0.5)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10,
                  } : {}),
                }]}>
                {i < stars ? '\u2605' : '\u2606'}
              </Animated.Text>
            ))}
          </View>
        )}

        <View style={[
          styles.statsRow,
          !isWin && {
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderColor: 'rgba(100,100,100,0.12)',
          },
        ]}>
          {/* TIME stat */}
          <Animated.View style={[styles.statBox, {
            opacity: statAnims[0].opacity,
            transform: [{ translateY: statAnims[0].translateY }],
          }]}>
            <Text style={[styles.statVal, !isWin && { color: '#999999' }]}>{formatTime(elapsedMs)}</Text>
            <Text style={[styles.statLbl, !isWin && { color: 'rgba(150,150,150,0.35)' }]}>TIME</Text>
            {isBestTime && <Text style={styles.bestBadge}>NEW BEST</Text>}
          </Animated.View>

          <View style={styles.statDivider} />

          {/* WINS stat */}
          <Animated.View style={[styles.statBox, {
            opacity: statAnims[1].opacity,
            transform: [{ translateY: statAnims[1].translateY }],
          }]}>
            <Text style={[styles.statVal, { color: isWin ? Colors.playerPlanet : 'rgba(68,238,102,0.5)' }]}>{stats.wins}</Text>
            <Text style={[styles.statLbl, !isWin && { color: 'rgba(150,150,150,0.35)' }]}>WINS</Text>
          </Animated.View>

          <View style={styles.statDivider} />

          {/* LOSSES stat */}
          <Animated.View style={[styles.statBox, {
            opacity: statAnims[2].opacity,
            transform: [{ translateY: statAnims[2].translateY }],
          }]}>
            <Text style={[styles.statVal, { color: isWin ? Colors.enemyPlanet : 'rgba(238,51,68,0.5)' }]}>{stats.losses}</Text>
            <Text style={[styles.statLbl, !isWin && { color: 'rgba(150,150,150,0.35)' }]}>LOSSES</Text>
          </Animated.View>

          {nodesCaptures !== undefined && nodesCaptures > 0 && (
            <>
              <View style={styles.statDivider} />
              <Animated.View style={[styles.statBox, {
                opacity: statAnims[3].opacity,
                transform: [{ translateY: statAnims[3].translateY }],
              }]}>
                <Text style={[styles.statVal, { color: isWin ? '#FFD700' : 'rgba(255,215,0,0.5)' }]}>{nodesCaptures}</Text>
                <Text style={[styles.statLbl, !isWin && { color: 'rgba(150,150,150,0.35)' }]}>CAPTURED</Text>
              </Animated.View>
            </>
          )}
        </View>

        {/* Streak indicator */}
        {stats.streak > 1 && isWin && (
          <View style={[styles.streakBadge, { borderColor: accentColor + '44' }]}>
            <Feather name="zap" size={14} color="#FFD700" />
            <Text style={styles.streakText}>{stats.streak} WIN STREAK</Text>
            {stats.streak >= 3 && <Text style={styles.streakBonus}>+{Math.min(15, stats.streak * 5)}% growth bonus</Text>}
          </View>
        )}

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              isWin
                ? { backgroundColor: '#C8A84B' }
                : { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
            ]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReset(); }}
            activeOpacity={0.8}>
            <Feather name="refresh-cw" size={18} color={isWin ? '#1A1408' : '#AAAAAA'} />
            <Text style={[
              styles.primaryText,
              isWin
                ? { color: '#1A1408' }
                : { color: '#AAAAAA' },
            ]}>REMATCH</Text>
          </TouchableOpacity>
          {onChangeEmpire && (
            <TouchableOpacity style={styles.glassBtn} onPress={onChangeEmpire} activeOpacity={0.7}>
              <Feather name="users" size={18} color="rgba(255,210,100,0.5)" />
              <Text style={styles.glassBtnText}>CHANGE EMPIRE</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.glassBtn} onPress={onMenu} activeOpacity={0.7}>
            <Feather name="home" size={18} color="rgba(255,210,100,0.5)" />
            <Text style={styles.glassBtnText}>MAIN MENU</Text>
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
    backgroundColor: 'rgba(12,8,4,0.98)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(180,140,40,0.30)',
    marginHorizontal: 28,
    width: '87%',
    overflow: 'hidden',
  },
  topAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.7,
  },
  iconContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlowCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  result: {
    fontSize: 42,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 4,
  },
  resultSub: {
    fontSize: 13,
    color: 'rgba(255,220,140,0.5)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  star: {
    fontSize: 38,
    lineHeight: 42,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 14,
    paddingVertical: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(180,140,40,0.12)',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
    gap: 3,
  },
  statVal: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: '#FFF8E8',
  },
  statLbl: {
    fontSize: 9,
    color: 'rgba(255,210,100,0.35)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 2,
  },
  bestBadge: {
    fontSize: 8,
    color: '#FFD700',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(180,140,40,0.15)',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1,
  },
  streakText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 1.5,
  },
  streakBonus: {
    fontSize: 9,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,215,0,0.6)',
  },
  buttons: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  glassBtn: {
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassBtnText: {
    color: 'rgba(255,210,100,0.5)',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
  },
});
