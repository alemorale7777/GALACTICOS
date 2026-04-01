import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { RankTier, getRankProgress } from '@/hooks/useRankedSeason';

const RANK_ICONS: Record<RankTier, { icon: any; color: string }> = {
  Squire: { icon: 'shield', color: '#8B7355' },
  Knight: { icon: 'award', color: '#C0C0C0' },
  Warlord: { icon: 'target', color: '#FFD700' },
  Galactico: { icon: 'star', color: '#FF6B35' },
  Legend: { icon: 'sun', color: '#FF2D55' },
};

interface Props {
  rank: RankTier;
  xp: number;
  seasonDaysLeft: number;
  compact?: boolean;
}

export default function RankBadge({ rank, xp, seasonDaysLeft, compact }: Props) {
  const progress = getRankProgress(xp);
  const { icon, color } = RANK_ICONS[rank];
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(barAnim, { toValue: progress.fraction, duration: 800, useNativeDriver: false }).start();
  }, [progress.fraction]);

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <Feather name={icon} size={14} color={color} />
        <Text style={[styles.compactRank, { color }]}>{rank}</Text>
        <Text style={styles.compactXP}>{xp} XP</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconRing, { borderColor: color + '66' }]}>
        <Feather name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.rankName, { color }]}>{rank.toUpperCase()}</Text>
      <View style={styles.barContainer}>
        <Animated.View style={[styles.barFill, {
          width: barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: color,
        }]} />
      </View>
      <View style={styles.xpRow}>
        <Text style={styles.xpText}>{xp} XP</Text>
        {progress.fraction < 1 && (
          <Text style={styles.xpNext}>{progress.current}/{progress.next} to next</Text>
        )}
      </View>
      <Text style={styles.season}>Season: {seasonDaysLeft}d left</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  iconRing: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.04)',
  },
  rankName: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  barContainer: {
    width: '80%', height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,220,100,0.08)', overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  xpRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  xpText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#FFF8E8' },
  xpNext: { fontSize: 10, color: 'rgba(255,210,100,0.35)', fontFamily: 'Inter_400Regular' },
  season: { fontSize: 9, color: 'rgba(255,210,100,0.25)', fontFamily: 'Inter_400Regular', letterSpacing: 1 },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactRank: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  compactXP: { fontSize: 10, color: 'rgba(255,210,100,0.4)', fontFamily: 'Inter_400Regular' },
});
