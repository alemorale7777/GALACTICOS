import React, { useEffect, useRef, useState } from 'react';
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
import { GameMode, MapSize, MAP_SIZE_CONFIG } from '@/constants/empires';

interface Props {
  onSelect: (size: MapSize, gameMode: GameMode) => void;
}

const MAP_SIZES: { key: MapSize; icon: any; color: string; tag: string; time: string }[] = [
  { key: 'small',  icon: 'zap',        color: '#44BB66', tag: 'QUICK BATTLE', time: '~3 min' },
  { key: 'medium', icon: 'crosshair',  color: '#EEAA22', tag: 'STANDARD', time: '~6 min' },
  { key: 'large',  icon: 'shield',     color: '#EE5544', tag: 'EPIC BATTLE', time: '~12 min' },
];

export default function MapSizeSelect({ onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const [gameMode, setGameMode] = useState<GameMode>('conquest');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(MAP_SIZES.map(() => new Animated.Value(0))).current;
  const scales = useRef(MAP_SIZES.map(() => new Animated.Value(1))).current;
  const modeAnim = useRef(new Animated.Value(0)).current;
  const conquestScale = useRef(new Animated.Value(1)).current;
  const regicideScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    MAP_SIZES.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1, duration: 420, delay: 260 + i * 130, useNativeDriver: true,
      }).start();
    });
    Animated.timing(modeAnim, {
      toValue: 1, duration: 420, delay: 650, useNativeDriver: true,
    }).start();
  }, []);

  const handlePress = (key: MapSize, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scales[idx], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scales[idx], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onSelect(key, gameMode));
  };

  const handleModeSelect = (mode: GameMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGameMode(mode);
    const scaleRef = mode === 'conquest' ? conquestScale : regicideScale;
    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 0.93, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1, tension: 300, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const isConquest = gameMode === 'conquest';

  return (
    <View style={[styles.root, { paddingTop: topInset + 10, paddingBottom: bottomInset + 10 }]}>
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }]}>
        <Text style={styles.headerSub}>SELECT YOUR</Text>
        <Text style={styles.headerTitle}>BATTLEFIELD</Text>
        <View style={styles.headerAccent} />
      </Animated.View>

      <View style={styles.cardList}>
        {MAP_SIZES.map((ms, idx) => {
          const config = MAP_SIZE_CONFIG[ms.key];
          const isDefault = ms.key === 'medium';
          return (
            <Animated.View key={ms.key} style={{
              transform: [
                { scale: scales[idx] },
                { translateX: cardAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              ],
              opacity: cardAnims[idx],
            }}>
              <TouchableOpacity
                style={[styles.card, { borderColor: ms.color + '44' }]}
                onPress={() => handlePress(ms.key, idx)}
                activeOpacity={0.8}>
                <View style={[styles.cardColorBar, { backgroundColor: ms.color }]} />
                <View style={[styles.iconWrap, { backgroundColor: ms.color + '22' }]}>
                  <Feather name={ms.icon} size={28} color={ms.color} />
                </View>
                <View style={styles.textGroup}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.cardLabel, { color: ms.color }]}>
                      {config.label.toUpperCase()}
                    </Text>
                    {isDefault && (
                      <View style={[styles.defaultBadge, { borderColor: ms.color + '66' }]}>
                        <Text style={[styles.defaultText, { color: ms.color }]}>RECOMMENDED</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>{ms.tag} — {ms.time}</Text>
                  <Text style={styles.nodeCount}>{config.nodeCount} nodes • {config.desc}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={ms.color + '99'} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>

      {/* ── Game Mode Toggle ── */}
      <Animated.View style={[styles.modeSection, {
        opacity: modeAnim,
        transform: [{ translateY: modeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
      }]}>
        <Text style={styles.modeSectionLabel}>GAME MODE</Text>
        <View style={styles.modeRow}>
          <Animated.View style={{ flex: 1, transform: [{ scale: conquestScale }] }}>
            <TouchableOpacity
              style={[
                styles.modeCard,
                isConquest && styles.modeCardActive,
                isConquest && { borderColor: '#EEAA22' },
              ]}
              onPress={() => handleModeSelect('conquest')}
              activeOpacity={0.8}>
              <View style={styles.modeIconRow}>
                <Feather name="flag" size={20} color={isConquest ? '#EEAA22' : 'rgba(255,220,140,0.3)'} />
              </View>
              <Text style={[styles.modeTitle, isConquest && { color: '#EEAA22' }]}>CONQUEST</Text>
              <Text style={styles.modeDesc}>Capture all enemy nodes to claim victory</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ flex: 1, transform: [{ scale: regicideScale }] }}>
            <TouchableOpacity
              style={[
                styles.modeCard,
                !isConquest && styles.modeCardActive,
                !isConquest && { borderColor: '#EE3344' },
              ]}
              onPress={() => handleModeSelect('regicide')}
              activeOpacity={0.8}>
              <View style={styles.modeIconRow}>
                <Text style={{ fontSize: 18 }}>👑</Text>
                {!isConquest && (
                  <View style={styles.intenseBadge}>
                    <Text style={styles.intenseText}>INTENSE</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.modeTitle, !isConquest && { color: '#EE3344' }]}>REGICIDE</Text>
              <Text style={styles.modeDesc}>Strike down the enemy King for instant victory</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080E08',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 28,
    gap: 4,
  },
  headerSub: {
    fontSize: 10, letterSpacing: 4,
    color: 'rgba(255,200,60,0.45)',
    fontFamily: 'Inter_500Medium',
  },
  headerTitle: {
    fontSize: 34, fontFamily: 'Inter_700Bold',
    color: '#FFF5D6', letterSpacing: 5,
  },
  headerAccent: {
    width: 52, height: 2, borderRadius: 1,
    backgroundColor: 'rgba(255,200,60,0.5)',
    marginTop: 4,
  },
  cardList: {
    gap: 12,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,220,80,0.04)',
    borderRadius: 16, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 14, gap: 14, overflow: 'hidden',
  },
  cardColorBar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2, opacity: 0.8,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
  },
  textGroup: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLabel: { fontSize: 16, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  cardDesc: { fontSize: 12, color: 'rgba(255,220,140,0.38)', fontFamily: 'Inter_400Regular' },
  nodeCount: { fontSize: 10, color: 'rgba(255,220,140,0.25)', fontFamily: 'Inter_500Medium', letterSpacing: 1 },
  defaultBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1,
  },
  defaultText: { fontSize: 7, fontFamily: 'Inter_700Bold', letterSpacing: 1 },

  // ── Game Mode ──
  modeSection: {
    marginTop: 20,
    gap: 8,
  },
  modeSectionLabel: {
    fontSize: 9, letterSpacing: 3,
    color: 'rgba(255,200,60,0.4)',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
  },
  modeCardActive: {
    backgroundColor: 'rgba(255,220,80,0.06)',
    borderWidth: 1.5,
  },
  modeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeTitle: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
    color: 'rgba(255,220,140,0.35)',
  },
  modeDesc: {
    fontSize: 10,
    color: 'rgba(255,220,140,0.3)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 14,
  },
  intenseBadge: {
    backgroundColor: 'rgba(238,51,68,0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(238,51,68,0.4)',
  },
  intenseText: {
    fontSize: 7,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    color: '#EE3344',
  },
});
