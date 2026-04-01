import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { EMPIRE_CONFIG } from '@/constants/empires';
import { TournamentData, TournamentMatch } from '@/hooks/useTournament';

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

interface Props {
  data: TournamentData | null;
  isTournamentTime: boolean;
  msUntilNext: number;
  onStart: () => void;
  onPlayMatch: () => void;
  onCollectReward: () => void;
  onBack: () => void;
}

function MatchCard({ match, roundLabel }: { match: TournamentMatch; roundLabel: string }) {
  const c1 = match.competitor1;
  const c2 = match.competitor2;
  const c1Color = c1 ? EMPIRE_CONFIG[c1.empire].nodeColor : '#555';
  const c2Color = c2 ? EMPIRE_CONFIG[c2.empire].nodeColor : '#555';
  const c1Won = match.winner === 'c1';
  const c2Won = match.winner === 'c2';

  return (
    <View style={styles.matchCard}>
      <View style={[styles.matchSide, c1Won && styles.matchWinner, { borderLeftColor: c1Color, borderLeftWidth: 3 }]}>
        <Text style={[styles.matchName, c1?.isPlayer && styles.matchPlayer,
          match.winner && !c1Won && styles.matchLoser]}>
          {c1?.name ?? 'TBD'}
        </Text>
        {c1 && <Text style={[styles.matchEmpire, { color: c1Color }]}>{c1.empire}</Text>}
      </View>
      <Text style={styles.matchVs}>vs</Text>
      <View style={[styles.matchSide, c2Won && styles.matchWinner, { borderRightColor: c2Color, borderRightWidth: 3 }]}>
        <Text style={[styles.matchName, c2?.isPlayer && styles.matchPlayer,
          match.winner && !c2Won && styles.matchLoser]}>
          {c2?.name ?? 'TBD'}
        </Text>
        {c2 && <Text style={[styles.matchEmpire, { color: c2Color }]}>{c2.empire}</Text>}
      </View>
      {match.score && <Text style={styles.matchScore}>{match.score}</Text>}
    </View>
  );
}

export default function TournamentScreen({ data, isTournamentTime, msUntilNext, onStart, onPlayMatch, onCollectReward, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const placementLabels: Record<number, string> = { 1: 'CHAMPION', 2: 'FINALIST', 3: '3RD PLACE', 4: '4TH PLACE', 5: 'QUARTERFINALIST', 6: 'QUARTERFINALIST', 7: 'QUARTERFINALIST', 8: 'QUARTERFINALIST' };
  const rewardXP: Record<number, number> = { 1: 1000, 2: 500, 3: 250, 4: 250, 5: 100, 6: 100, 7: 100, 8: 100 };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>WEEKEND</Text>
          <Text style={styles.headerTitle}>TOURNAMENT</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!data?.active && !isTournamentTime && (
          <View style={styles.countdownCard}>
            <Feather name="clock" size={32} color="rgba(255,210,100,0.3)" />
            <Text style={styles.countdownLabel}>Next tournament in</Text>
            <Text style={styles.countdownTime}>{formatCountdown(msUntilNext)}</Text>
            <Text style={styles.countdownSub}>Available Friday 6pm - Sunday midnight</Text>
          </View>
        )}

        {!data?.active && isTournamentTime && (
          <View style={styles.startCard}>
            <Feather name="flag" size={40} color="#FFD700" />
            <Text style={styles.startLabel}>Tournament Open!</Text>
            <Text style={styles.startSub}>8-player single elimination bracket</Text>
            <TouchableOpacity style={styles.startBtn} onPress={onStart} activeOpacity={0.8}>
              <Text style={styles.startBtnText}>ENTER TOURNAMENT</Text>
            </TouchableOpacity>
          </View>
        )}

        {data?.active && (
          <>
            {/* Bracket display */}
            {[0, 1, 2].map(round => {
              const roundNames = ['QUARTERFINALS', 'SEMIFINALS', 'FINAL'];
              const matches = data.bracket.filter(m => m.round === round);
              return (
                <View key={round} style={styles.roundSection}>
                  <Text style={styles.roundLabel}>{roundNames[round]}</Text>
                  {matches.map((m, i) => (
                    <MatchCard key={`${round}-${i}`} match={m} roundLabel={roundNames[round]} />
                  ))}
                </View>
              );
            })}

            {/* Play next match button */}
            {!data.completed && !data.playerEliminated && (
              <TouchableOpacity style={styles.playBtn} onPress={onPlayMatch} activeOpacity={0.8}>
                <Feather name="play" size={20} color="#000" />
                <Text style={styles.playBtnText}>PLAY NEXT MATCH</Text>
              </TouchableOpacity>
            )}

            {/* Results */}
            {(data.completed || data.playerEliminated) && data.placement && (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>{placementLabels[data.placement] || `#${data.placement}`}</Text>
                <Text style={styles.resultReward}>+{rewardXP[data.placement] || 100} XP</Text>
                {!data.rewarded && (
                  <TouchableOpacity style={styles.claimBtn} onPress={onCollectReward} activeOpacity={0.8}>
                    <Text style={styles.claimBtnText}>CLAIM REWARD</Text>
                  </TouchableOpacity>
                )}
                {data.rewarded && <Text style={styles.claimedText}>Reward claimed!</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSub: { fontSize: 9, letterSpacing: 3, color: 'rgba(255,200,60,0.4)', fontFamily: 'Inter_500Medium' },
  headerTitle: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 4 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  countdownCard: {
    alignItems: 'center', gap: 8, padding: 32,
    backgroundColor: 'rgba(255,220,80,0.03)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.08)',
  },
  countdownLabel: { fontSize: 13, color: 'rgba(255,210,100,0.4)', fontFamily: 'Inter_400Regular' },
  countdownTime: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#FFF5D6' },
  countdownSub: { fontSize: 11, color: 'rgba(255,210,100,0.25)', fontFamily: 'Inter_400Regular' },
  startCard: {
    alignItems: 'center', gap: 12, padding: 28,
    backgroundColor: 'rgba(255,215,0,0.04)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)',
  },
  startLabel: { fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFD700', letterSpacing: 2 },
  startSub: { fontSize: 12, color: 'rgba(255,210,100,0.4)', fontFamily: 'Inter_400Regular' },
  startBtn: {
    marginTop: 8, paddingVertical: 14, paddingHorizontal: 36, borderRadius: 22,
    backgroundColor: '#FFD700',
  },
  startBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 2 },
  roundSection: { gap: 8 },
  roundLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'rgba(255,200,60,0.35)', letterSpacing: 2, textAlign: 'center' },
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.06)', overflow: 'hidden',
  },
  matchSide: { flex: 1, padding: 10, gap: 2 },
  matchWinner: { backgroundColor: 'rgba(68,187,102,0.06)' },
  matchVs: { fontSize: 10, color: 'rgba(255,210,100,0.2)', fontFamily: 'Inter_700Bold', paddingHorizontal: 4 },
  matchName: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,240,200,0.7)' },
  matchPlayer: { color: '#FFDD44', fontFamily: 'Inter_700Bold' },
  matchLoser: { color: 'rgba(255,240,200,0.25)' },
  matchEmpire: { fontSize: 9, fontFamily: 'Inter_500Medium', letterSpacing: 1 },
  matchScore: { fontSize: 8, color: 'rgba(255,210,100,0.25)', fontFamily: 'Inter_400Regular', position: 'absolute', bottom: 2, right: 8 },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, borderRadius: 26, backgroundColor: '#FFAA22',
  },
  playBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 2 },
  resultCard: {
    alignItems: 'center', gap: 10, padding: 24,
    backgroundColor: 'rgba(255,215,0,0.04)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.12)',
  },
  resultLabel: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#FFD700', letterSpacing: 3 },
  resultReward: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#FFF8E8' },
  claimBtn: {
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 20, backgroundColor: '#FFD700',
  },
  claimBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 1.5 },
  claimedText: { fontSize: 12, color: 'rgba(68,187,102,0.6)', fontFamily: 'Inter_500Medium' },
});
