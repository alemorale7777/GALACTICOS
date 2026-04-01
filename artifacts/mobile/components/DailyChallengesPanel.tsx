import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Challenge } from '@/hooks/useDailyChallenges';

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

interface Props {
  challenges: Challenge[];
  msUntilReset: number;
}

export default function DailyChallengesPanel({ challenges, msUntilReset }: Props) {
  if (challenges.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>DAILY CHALLENGES</Text>
        <Text style={styles.timer}>Resets in {formatCountdown(msUntilReset)}</Text>
      </View>
      {challenges.map(c => (
        <View key={c.id} style={[styles.card, c.completed && styles.cardDone]}>
          <View style={styles.cardLeft}>
            {c.completed ? (
              <Feather name="check-circle" size={18} color="#44BB66" />
            ) : (
              <Feather name="circle" size={18} color="rgba(255,210,100,0.3)" />
            )}
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.desc, c.completed && styles.descDone]}>{c.description}</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {
                  width: `${Math.min(100, (c.progress / c.target) * 100)}%`,
                  backgroundColor: c.completed ? '#44BB66' : '#FFAA22',
                }]} />
              </View>
              <Text style={styles.progressText}>{Math.min(c.progress, c.target)}/{c.target}</Text>
            </View>
          </View>
          <View style={styles.reward}>
            <Text style={styles.rewardText}>+{c.xpReward}</Text>
            <Text style={styles.rewardLabel}>XP</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  title: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'rgba(255,200,60,0.4)', letterSpacing: 2 },
  timer: { fontSize: 9, fontFamily: 'Inter_400Regular', color: 'rgba(255,210,100,0.25)' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,200,60,0.08)',
    paddingVertical: 10, paddingHorizontal: 12,
  },
  cardDone: { borderColor: 'rgba(68,187,102,0.2)', backgroundColor: 'rgba(68,187,102,0.04)' },
  cardLeft: { width: 24, alignItems: 'center' },
  cardContent: { flex: 1, gap: 4 },
  desc: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,240,200,0.7)' },
  descDone: { color: 'rgba(255,240,200,0.35)', textDecorationLine: 'line-through' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progressBar: {
    flex: 1, height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,220,100,0.08)', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 9, fontFamily: 'Inter_500Medium', color: 'rgba(255,210,100,0.3)' },
  reward: { alignItems: 'center', minWidth: 40 },
  rewardText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFAA22' },
  rewardLabel: { fontSize: 8, fontFamily: 'Inter_500Medium', color: 'rgba(255,210,100,0.3)' },
});
