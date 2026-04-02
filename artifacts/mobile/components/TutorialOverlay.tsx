import React, { useRef, useState } from 'react';
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
import { Colors } from '@/constants/colors';

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    icon: 'shield' as const,
    title: 'Your Castles',
    body: 'Your castles train soldiers over time. The number shows your garrison. Capital castles (crown icon) generate units faster and are strategically valuable.',
    color: Colors.playerPlanet,
  },
  {
    icon: 'move' as const,
    title: 'March & Conquer',
    body: 'Touch your castle and drag to a target to send troops. Outnumber defenders to capture. Fortress nodes need extra troops, Barracks produce faster, and Ruins transform into Barracks once captured.',
    color: Colors.lineColor,
  },
  {
    icon: 'sliders' as const,
    title: 'Army Size & Select All',
    body: 'Choose 25%, 50%, or 75% of your garrison. Tap ALL to select every castle — then drag to march from all simultaneously.',
    color: '#FFAA00',
  },
  {
    icon: 'zap' as const,
    title: 'Empire Abilities',
    body: 'Each empire has a unique ability with its own cooldown. Egypt boosts production, Rome shields fleets, Mongols gain speed, Ptolemaic creates illusions. Time it right!',
    color: Colors.abilityReady,
  },
  {
    icon: 'flag' as const,
    title: 'Claim the Realm',
    body: 'In Conquest mode, capture all enemy castles to win. In Regicide mode, capture the enemy King for instant victory! Larger maps have fog of war — Watchtower nodes reveal more area.',
    color: '#FFD700',
  },
];

export default function TutorialOverlay({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Haptics.selectionAsync();
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.backdrop} />

      <View style={styles.card}>
        <View style={styles.stepDots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && { backgroundColor: current.color, width: 20 }]}
            />
          ))}
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={[styles.iconWrap, { backgroundColor: current.color + '22', borderColor: current.color + '44' }]}>
            <Feather name={current.icon} size={36} color={current.color} />
          </View>
          <Text style={[styles.title, { color: current.color }]}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
        </Animated.View>

        <View style={styles.actions}>
          {step > 0 && (
            <TouchableOpacity style={styles.backBtn} onPress={() => goTo(step - 1)} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color="rgba(255,220,140,0.5)" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: current.color, flex: 1 }]}
            onPress={() => {
              if (isLast) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDone();
              } else {
                goTo(step + 1);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>{isLast ? 'TO BATTLE' : 'NEXT'}</Text>
            <Feather name={isLast ? 'play' : 'arrow-right'} size={16} color="#000" />
          </TouchableOpacity>
        </View>

        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={onDone} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip tutorial</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,4,0.78)',
  },
  card: {
    backgroundColor: 'rgba(16,10,4,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(180,140,40,0.22)',
    padding: 28,
    gap: 20,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,220,100,0.15)',
  },
  content: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,240,200,0.65)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  backBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,220,100,0.08)',
  },
  nextBtn: {
    height: 50,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.5,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,220,100,0.3)',
    fontFamily: 'Inter_400Regular',
  },
});
