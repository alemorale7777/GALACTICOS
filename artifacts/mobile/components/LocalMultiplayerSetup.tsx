import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { EmpireId, EMPIRE_CONFIG, EMPIRE_IDS, MapSize, MAP_SIZE_CONFIG } from '@/constants/empires';

interface Props {
  onStart: (p1Empire: EmpireId, p2Empire: EmpireId, mapSize: MapSize) => void;
  onBack: () => void;
}

export default function LocalMultiplayerSetup({ onStart, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const [p1Empire, setP1Empire] = useState<EmpireId>('egypt');
  const [p2Empire, setP2Empire] = useState<EmpireId>('rome');
  const [mapSize, setMapSize] = useState<MapSize>('medium');

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="rgba(255,220,100,0.5)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LOCAL 2 PLAYER</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Player 1 empire */}
        <Text style={styles.sectionLabel}>PLAYER 1 (LEFT)</Text>
        <View style={styles.empireRow}>
          {EMPIRE_IDS.map(id => {
            const ec = EMPIRE_CONFIG[id];
            const active = id === p1Empire;
            return (
              <TouchableOpacity key={id}
                style={[styles.empBtn, active && { borderColor: ec.nodeColor, backgroundColor: ec.nodeColor + '22' }]}
                onPress={() => setP1Empire(id)}>
                <Text style={[styles.empBtnText, { color: active ? ec.nodeColor : 'rgba(255,210,100,0.3)' }]}>
                  {ec.empire.slice(0, 4).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Player 2 empire */}
        <Text style={styles.sectionLabel}>PLAYER 2 (RIGHT)</Text>
        <View style={styles.empireRow}>
          {EMPIRE_IDS.map(id => {
            const ec = EMPIRE_CONFIG[id];
            const active = id === p2Empire;
            return (
              <TouchableOpacity key={id}
                style={[styles.empBtn, active && { borderColor: ec.nodeColor, backgroundColor: ec.nodeColor + '22' }]}
                onPress={() => setP2Empire(id)}>
                <Text style={[styles.empBtnText, { color: active ? ec.nodeColor : 'rgba(255,210,100,0.3)' }]}>
                  {ec.empire.slice(0, 4).toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Map size */}
        <Text style={styles.sectionLabel}>MAP SIZE</Text>
        <View style={styles.empireRow}>
          {(['small', 'medium', 'large'] as MapSize[]).map(size => {
            const active = size === mapSize;
            return (
              <TouchableOpacity key={size}
                style={[styles.empBtn, active && { borderColor: '#FFAA22', backgroundColor: 'rgba(255,170,34,0.15)' }]}
                onPress={() => setMapSize(size)}>
                <Text style={[styles.empBtnText, active && { color: '#FFAA22' }]}>
                  {MAP_SIZE_CONFIG[size].label.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>P1: left side controls | P2: right side controls</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.startBtn}
          onPress={() => onStart(p1Empire, p2Empire, mapSize)} activeOpacity={0.8}>
          <Feather name="play" size={20} color="#000" />
          <Text style={styles.startBtnText}>START MATCH</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080E08' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontFamily: 'Inter_700Bold', color: '#FFF5D6', letterSpacing: 3 },
  content: { padding: 24, gap: 16 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', color: 'rgba(255,200,60,0.35)', letterSpacing: 2 },
  empireRow: { flexDirection: 'row', gap: 8 },
  empBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,200,60,0.08)',
  },
  empBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,210,100,0.3)', letterSpacing: 1 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,200,60,0.06)' },
  dividerText: { fontSize: 9, color: 'rgba(255,210,100,0.2)', fontFamily: 'Inter_400Regular' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    height: 52, borderRadius: 26, backgroundColor: '#FFAA22',
  },
  startBtnText: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 2 },
});
