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
import { MapSize, MAP_SIZE_CONFIG } from '@/constants/empires';

interface Props {
  onSelect: (size: MapSize) => void;
}

const MAP_SIZES: { key: MapSize; icon: any; color: string }[] = [
  { key: 'small',  icon: 'minimize-2', color: '#44BB66' },
  { key: 'medium', icon: 'square',     color: '#EEAA22' },
  { key: 'large',  icon: 'maximize-2', color: '#EE5544' },
];

export default function MapSizeSelect({ onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef(MAP_SIZES.map(() => new Animated.Value(0))).current;
  const scales = useRef(MAP_SIZES.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    MAP_SIZES.forEach((_, i) => {
      Animated.timing(cardAnims[i], {
        toValue: 1, duration: 420, delay: 260 + i * 130, useNativeDriver: true,
      }).start();
    });
  }, []);

  const handlePress = (key: MapSize, idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Animated.sequence([
      Animated.timing(scales[idx], { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scales[idx], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => onSelect(key));
  };

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
                        <Text style={[styles.defaultText, { color: ms.color }]}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardDesc}>{config.desc}</Text>
                  <Text style={styles.nodeCount}>{config.nodeCount} nodes</Text>
                </View>
                <Feather name="chevron-right" size={18} color={ms.color + '99'} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
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
});
