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
import { EmpireId, EMPIRE_CONFIG, EMPIRE_IDS } from '@/constants/empires';
import { CampaignProgress, CAMPAIGNS, CampaignMap } from '@/hooks/useCampaign';

interface Props {
  progress: Record<EmpireId, CampaignProgress>;
  onSelectMap: (empireId: EmpireId, mapIndex: number) => void;
  onBack: () => void;
}

function StarDisplay({ count }: { count: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map(i => (
        <Text key={i} style={[styles.star, i < count ? styles.starEarned : styles.starEmpty]}>
          {i < count ? '\u2605' : '\u2606'}
        </Text>
      ))}
    </View>
  );
}

export default function CampaignScreen({ progress, onSelectMap, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedEmpire, setSelectedEmpire] = React.useState<EmpireId>('egypt');

  const campaign = CAMPAIGNS[selectedEmpire];
  const empProgress = progress[selectedEmpire] || { unlocked: 0, stars: new Array(12).fill(0) };
  const empConfig = EMPIRE_CONFIG[selectedEmpire];
  const totalStars = empProgress.stars.reduce((a: number, b: number) => a + b, 0);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>CAMPAIGN</Text>
          <Text style={[styles.headerTitle, { color: empConfig.nodeColor }]}>
            {campaign.title.toUpperCase()}
          </Text>
        </View>
        <View style={styles.totalStars}>
          <Text style={styles.totalStarsNum}>{totalStars}</Text>
          <Text style={styles.totalStarIcon}>{'\u2605'}</Text>
        </View>
      </View>

      {/* Empire tabs */}
      <View style={styles.tabs}>
        {EMPIRE_IDS.map(id => {
          const ec = EMPIRE_CONFIG[id];
          const active = id === selectedEmpire;
          return (
            <TouchableOpacity key={id}
              style={[styles.tab, active && { borderBottomColor: ec.nodeColor, borderBottomWidth: 2 }]}
              onPress={() => setSelectedEmpire(id)} activeOpacity={0.7}>
              <Text style={[styles.tabText, active && { color: ec.nodeColor }]}>
                {ec.empire.toUpperCase().slice(0, 4)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Map list */}
      <ScrollView contentContainerStyle={styles.mapList} showsVerticalScrollIndicator={false}>
        {campaign.maps.map((map, i) => {
          const isUnlocked = i <= empProgress.unlocked;
          const starCount = empProgress.stars[i] || 0;
          return (
            <TouchableOpacity key={i}
              style={[styles.mapCard, !isUnlocked && styles.mapLocked,
                { borderLeftColor: isUnlocked ? empConfig.nodeColor : 'rgba(255,200,60,0.06)', borderLeftWidth: 3 }]}
              onPress={() => isUnlocked && onSelectMap(selectedEmpire, i)}
              activeOpacity={isUnlocked ? 0.8 : 1} disabled={!isUnlocked}>
              <View style={styles.mapNum}>
                <Text style={[styles.mapNumText, !isUnlocked && styles.mapLockedText]}>
                  {isUnlocked ? String(i + 1) : '?'}
                </Text>
              </View>
              <View style={styles.mapInfo}>
                <Text style={[styles.mapName, !isUnlocked && styles.mapLockedText]}>
                  {isUnlocked ? map.name : 'Locked'}
                </Text>
                {isUnlocked && (
                  <Text style={styles.mapNodes}>{map.nodeCount} nodes</Text>
                )}
              </View>
              {isUnlocked && <StarDisplay count={starCount} />}
              {!isUnlocked && <Feather name="lock" size={16} color="rgba(255,210,100,0.15)" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerSub: { fontSize: 9, letterSpacing: 3, color: 'rgba(255,200,60,0.35)', fontFamily: 'Inter_500Medium' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  totalStars: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 40 },
  totalStarsNum: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFD700' },
  totalStarIcon: { fontSize: 14, color: '#FFD700' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: 'rgba(255,200,60,0.06)' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,210,100,0.25)', letterSpacing: 1.5 },
  mapList: { padding: 16, gap: 8, paddingBottom: 40 },
  mapCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(255,220,80,0.04)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,200,60,0.06)',
    paddingVertical: 12, paddingHorizontal: 12, overflow: 'hidden',
  },
  mapLocked: { opacity: 0.4 },
  mapNum: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,220,80,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapNumText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#FFF8E8' },
  mapLockedText: { color: 'rgba(255,210,100,0.2)' },
  mapInfo: { flex: 1, gap: 2 },
  mapName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,240,200,0.8)' },
  mapNodes: { fontSize: 10, color: 'rgba(255,210,100,0.3)', fontFamily: 'Inter_400Regular' },
  stars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 16 },
  starEarned: { color: '#FFD700' },
  starEmpty: { color: 'rgba(255,210,100,0.15)' },
});
