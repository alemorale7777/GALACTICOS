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
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';
import { EmpireId, EMPIRE_CONFIG } from '@/constants/empires';
import { WorldMapData, TERRITORY_POSITIONS } from '@/hooks/useWorldMap';

interface Props {
  data: WorldMapData;
  onBack: () => void;
}

const MAP_W = 360;
const MAP_H = 280;

export default function WorldMapScreen({ data, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;

  const counts: Record<string, number> = { egypt: 0, rome: 0, mongols: 0, ptolemaic: 0, neutral: 0 };
  data.territories.forEach(t => { if (t) counts[t]++; else counts.neutral++; });

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>WORLD MAP</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Map */}
        <View style={styles.mapWrap}>
          <Svg width={MAP_W} height={MAP_H}>
            <Rect x={0} y={0} width={MAP_W} height={MAP_H} fill="rgba(10,20,10,0.8)" rx={12} />
            {TERRITORY_POSITIONS.map((pos, i) => {
              const owner = data.territories[i];
              const color = owner ? EMPIRE_CONFIG[owner].nodeColor : 'rgba(255,210,100,0.12)';
              const x = (pos.x / 100) * MAP_W;
              const y = (pos.y / 100) * MAP_H;
              return (
                <React.Fragment key={i}>
                  <Circle cx={x} cy={y} r={owner ? 5 : 3} fill={color} opacity={owner ? 0.9 : 0.4} />
                  {owner && <Circle cx={x} cy={y} r={8} fill={color} opacity={0.15} />}
                </React.Fragment>
              );
            })}
          </Svg>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {(['egypt', 'rome', 'mongols', 'ptolemaic'] as EmpireId[]).map(id => {
            const ec = EMPIRE_CONFIG[id];
            const count = counts[id] || 0;
            return (
              <View key={id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: ec.nodeColor }]} />
                <Text style={styles.legendName}>{ec.empire}</Text>
                <Text style={[styles.legendCount, { color: ec.nodeColor }]}>{count}</Text>
              </View>
            );
          })}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(255,210,100,0.2)' }]} />
            <Text style={styles.legendName}>Unclaimed</Text>
            <Text style={styles.legendCount}>{counts.neutral}</Text>
          </View>
        </View>

        {/* Bonuses */}
        <View style={styles.bonusSection}>
          <Text style={styles.bonusTitle}>TERRITORY BONUSES</Text>
          <View style={styles.bonusRow}>
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusThreshold}>10+</Text>
              <Text style={styles.bonusDesc}>+5% gen</Text>
            </View>
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusThreshold}>20+</Text>
              <Text style={styles.bonusDesc}>-10% CD</Text>
            </View>
            <View style={styles.bonusBadge}>
              <Text style={styles.bonusThreshold}>30+</Text>
              <Text style={styles.bonusDesc}>+5% speed</Text>
            </View>
          </View>
        </View>

        {/* Territory list */}
        <View style={styles.terrList}>
          {TERRITORY_POSITIONS.map((pos, i) => {
            const owner = data.territories[i];
            const color = owner ? EMPIRE_CONFIG[owner].nodeColor : 'rgba(255,210,100,0.15)';
            return (
              <View key={i} style={styles.terrItem}>
                <View style={[styles.terrDot, { backgroundColor: color }]} />
                <Text style={styles.terrName}>{pos.name}</Text>
                <Text style={[styles.terrContinent, { color: 'rgba(255,210,100,0.2)' }]}>{pos.continent}</Text>
              </View>
            );
          }).slice(0, 20)}
          <Text style={styles.terrMore}>...and {TERRITORY_POSITIONS.length - 20} more territories</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 4 },
  content: { padding: 16, gap: 20, paddingBottom: 40 },
  mapWrap: {
    alignItems: 'center', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.08)',
  },
  legend: { gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: 'rgba(255,240,200,0.6)' },
  legendCount: { fontSize: 16, fontFamily: 'Inter_700Bold', color: 'rgba(255,210,100,0.4)' },
  bonusSection: { gap: 8 },
  bonusTitle: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'rgba(255,200,60,0.3)', letterSpacing: 2 },
  bonusRow: { flexDirection: 'row', gap: 8 },
  bonusBadge: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(255,220,80,0.04)', borderWidth: 1, borderColor: 'rgba(255,200,60,0.06)',
  },
  bonusThreshold: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  bonusDesc: { fontSize: 10, color: 'rgba(255,210,100,0.35)', fontFamily: 'Inter_400Regular' },
  terrList: { gap: 4 },
  terrItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  terrDot: { width: 6, height: 6, borderRadius: 3 },
  terrName: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,240,200,0.5)' },
  terrContinent: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  terrMore: { fontSize: 11, color: 'rgba(255,210,100,0.2)', fontFamily: 'Inter_400Regular', textAlign: 'center', paddingTop: 4 },
});
