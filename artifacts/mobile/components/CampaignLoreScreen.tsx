import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CampaignMap } from '@/hooks/useCampaign';
import { EmpireConfig } from '@/constants/empires';

interface Props {
  map: CampaignMap;
  mapIndex: number;
  totalMaps: number;
  campaignTitle: string;
  empire: EmpireConfig;
  stars: number;
  onBegin: () => void;
  onBack: () => void;
}

export default function CampaignLoreScreen({
  map, mapIndex, totalMaps, campaignTitle, empire, stars, onBegin, onBack,
}: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const fadeIn = useRef(new Animated.Value(0)).current;
  const iconDrop = useRef(new Animated.Value(-30)).current;
  const nameScale = useRef(new Animated.Value(0.8)).current;
  const loreOpacity = useRef(new Animated.Value(0)).current;
  const obj1 = useRef(new Animated.Value(0)).current;
  const obj2 = useRef(new Animated.Value(0)).current;
  const obj3 = useRef(new Animated.Value(0)).current;
  const btnSlide = useRef(new Animated.Value(40)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.spring(iconDrop, { toValue: 0, tension: 80, friction: 10, delay: 100, useNativeDriver: true }).start();
    Animated.spring(nameScale, { toValue: 1, tension: 120, friction: 10, delay: 200, useNativeDriver: true }).start();
    Animated.timing(loreOpacity, { toValue: 1, duration: 400, delay: 500, useNativeDriver: true }).start();
    Animated.timing(obj1, { toValue: 1, duration: 300, delay: 600, useNativeDriver: true }).start();
    Animated.timing(obj2, { toValue: 1, duration: 300, delay: 700, useNativeDriver: true }).start();
    Animated.timing(obj3, { toValue: 1, duration: 300, delay: 800, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(btnSlide, { toValue: 0, duration: 400, delay: 900, useNativeDriver: true }),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, delay: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBegin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onBegin();
  };

  const timeStr = map.timeLimit < 60 ? `${map.timeLimit}s` : `${Math.floor(map.timeLimit / 60)} min`;
  const isRegicide = mapIndex >= 7;

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn, paddingTop: topInset + 16, paddingBottom: bottomInset + 16 }]}>
      {/* Empire glow */}
      <View style={[styles.glow, { backgroundColor: empire.nodeColor + '15' }]} />

      {/* Top: campaign info */}
      <Animated.View style={[styles.topSection, { transform: [{ translateY: iconDrop }] }]}>
        <Text style={[styles.campaignTitle, { color: empire.nodeColor + 'AA' }]}>{campaignTitle.toUpperCase()}</Text>
        <Text style={styles.missionNum}>MISSION {mapIndex + 1} OF {totalMaps}</Text>
        {isRegicide && (
          <View style={styles.regicideBadge}>
            <Text style={styles.regicideText}>👑 REGICIDE</Text>
          </View>
        )}
      </Animated.View>

      {/* Map name */}
      <Animated.View style={{ transform: [{ scale: nameScale }] }}>
        <Text style={[styles.mapName, { color: empire.nodeColor }]}>{map.name.toUpperCase()}</Text>
        <View style={[styles.divider, { backgroundColor: empire.nodeColor + '44' }]} />
      </Animated.View>

      {/* Lore */}
      <Animated.Text style={[styles.loreText, { opacity: loreOpacity }]}>
        {map.lore}
      </Animated.Text>

      {/* Objectives */}
      <View style={styles.objectivesSection}>
        <Text style={styles.objectivesTitle}>OBJECTIVES</Text>
        <Animated.View style={[styles.objectiveRow, { opacity: obj1 }]}>
          <Text style={styles.starIcon}>{stars >= 1 ? '★' : '☆'}</Text>
          <Text style={styles.objectiveText}>Win the battle</Text>
        </Animated.View>
        <Animated.View style={[styles.objectiveRow, { opacity: obj2 }]}>
          <Text style={styles.starIcon}>{stars >= 2 ? '★' : '☆'}</Text>
          <Text style={styles.objectiveText}>Win in under {timeStr}</Text>
        </Animated.View>
        <Animated.View style={[styles.objectiveRow, { opacity: obj3 }]}>
          <Text style={styles.starIcon}>{stars >= 3 ? '★' : '☆'}</Text>
          <Text style={styles.objectiveText}>Win without using your ability</Text>
        </Animated.View>
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonSection, { transform: [{ translateY: btnSlide }], opacity: btnOpacity }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.beginBtn, { backgroundColor: empire.nodeColor }]}
          onPress={handleBegin}
          activeOpacity={0.85}>
          <Feather name="play" size={20} color="#000" />
          <Text style={styles.beginText}>BEGIN</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080A10',
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '25%',
    alignSelf: 'center',
  },
  topSection: { alignItems: 'center', gap: 4 },
  campaignTitle: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 3 },
  missionNum: { fontSize: 12, fontFamily: 'Inter_500Medium', color: 'rgba(255,220,140,0.35)', letterSpacing: 2 },
  regicideBadge: {
    marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, borderWidth: 1,
    borderColor: 'rgba(238,51,68,0.4)',
    backgroundColor: 'rgba(238,51,68,0.1)',
  },
  regicideText: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#EE3344', letterSpacing: 1 },
  mapName: {
    fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 4, textAlign: 'center',
  },
  divider: { width: 60, height: 2, borderRadius: 1, marginTop: 8, alignSelf: 'center' },
  loreText: {
    fontSize: 15, fontFamily: 'Inter_400Regular', color: 'rgba(255,240,200,0.55)',
    textAlign: 'center', lineHeight: 24, fontStyle: 'italic',
    paddingHorizontal: 8,
  },
  objectivesSection: { gap: 8, width: '100%', paddingHorizontal: 12 },
  objectivesTitle: {
    fontSize: 9, fontFamily: 'Inter_700Bold', color: 'rgba(255,215,0,0.3)',
    letterSpacing: 3, textAlign: 'center', marginBottom: 4,
  },
  objectiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  starIcon: { fontSize: 18, color: '#FFD700' },
  objectiveText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,240,200,0.5)' },
  buttonSection: { width: '100%', gap: 12, alignItems: 'center', marginTop: 8 },
  backText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,220,140,0.35)', letterSpacing: 2 },
  beginBtn: {
    width: '100%', height: 54, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  beginText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#000', letterSpacing: 3 },
});
