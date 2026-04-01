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
import { ReplayMeta } from '@/hooks/useReplaySystem';

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface Props {
  replays: ReplayMeta[];
  onShare: (replay: ReplayMeta) => void;
  onBack: () => void;
}

export default function ReplayScreen({ replays, onShare, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REPLAYS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {replays.length === 0 && (
          <View style={styles.empty}>
            <Feather name="film" size={40} color="rgba(255,210,100,0.15)" />
            <Text style={styles.emptyText}>No replays yet</Text>
            <Text style={styles.emptySub}>Complete games to record replays</Text>
          </View>
        )}

        {replays.map(r => {
          const empConfig = EMPIRE_CONFIG[r.empire];
          const aiConfig = EMPIRE_CONFIG[r.aiEmpire];
          return (
            <View key={r.id} style={[styles.card, { borderLeftColor: empConfig.nodeColor, borderLeftWidth: 3 }]}>
              <View style={styles.cardTop}>
                <View style={styles.empireRow}>
                  <View style={[styles.empDot, { backgroundColor: empConfig.nodeColor }]} />
                  <Text style={[styles.empName, { color: empConfig.nodeColor }]}>{empConfig.empire}</Text>
                  <Text style={styles.vs}>vs</Text>
                  <View style={[styles.empDot, { backgroundColor: aiConfig.nodeColor }]} />
                  <Text style={[styles.empName, { color: aiConfig.nodeColor }]}>{aiConfig.empire}</Text>
                </View>
                <Text style={[styles.result, { color: r.won ? '#44BB66' : '#EE3344' }]}>
                  {r.won ? 'WIN' : 'LOSS'}
                </Text>
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.detail}>{formatDate(r.date)}</Text>
                <Text style={styles.detail}>{r.mapSize}</Text>
                <Text style={styles.detail}>{formatTime(r.durationMs)}</Text>
                <Text style={styles.detail}>{r.nodesCaptures} captures</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.shareBtn} onPress={() => onShare(r)} activeOpacity={0.7}>
                  <Feather name="share" size={14} color="rgba(255,210,100,0.5)" />
                  <Text style={styles.shareBtnText}>SHARE</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 4 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,210,100,0.3)' },
  emptySub: { fontSize: 12, color: 'rgba(255,210,100,0.15)', fontFamily: 'Inter_400Regular' },
  card: {
    backgroundColor: 'rgba(255,220,80,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.06)',
    padding: 14, gap: 8, overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empireRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empDot: { width: 8, height: 8, borderRadius: 4 },
  empName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  vs: { fontSize: 9, color: 'rgba(255,210,100,0.2)', fontFamily: 'Inter_400Regular' },
  result: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  cardBottom: { flexDirection: 'row', gap: 12 },
  detail: { fontSize: 10, color: 'rgba(255,210,100,0.3)', fontFamily: 'Inter_400Regular' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(255,200,60,0.06)', borderWidth: 1, borderColor: 'rgba(255,200,60,0.08)',
  },
  shareBtnText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,210,100,0.5)', letterSpacing: 1 },
});
