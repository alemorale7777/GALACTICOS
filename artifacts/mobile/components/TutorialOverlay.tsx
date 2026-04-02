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
import { Colors } from '@/constants/colors';

interface Props {
  onDone: () => void;
}

const STEPS = [
  {
    icon: 'target' as const,
    title: 'Tap to Select',
    body: 'Tap one of your castles to select it. The number shows your garrison — soldiers training inside.',
    color: Colors.playerPlanet,
    hint: '👆 Tap your node',
  },
  {
    icon: 'move' as const,
    title: 'Drag to Attack',
    body: 'Drag from your castle to a target to send troops. Outnumber the defenders to capture it!',
    color: Colors.lineColor,
    hint: '↗ Drag to attack',
  },
  {
    icon: 'sliders' as const,
    title: 'Army Size',
    body: 'Choose 25%, 50%, or 75% of your garrison to send. Use ALL to select every castle at once.',
    color: '#FFAA00',
    hint: 'Choose your army size',
  },
  {
    icon: 'zap' as const,
    title: 'Empire Abilities',
    body: 'Each empire has a unique ability with a cooldown timer. Egypt boosts production, Rome shields fleets, Mongols gain speed. Time it right!',
    color: Colors.abilityReady,
    hint: '⚡ Tap when ready',
  },
  {
    icon: 'layers' as const,
    title: 'Double Tap = Select All',
    body: 'Double-tap anywhere to select ALL your castles at once. Then drag to send your entire army!',
    color: '#CE93D8',
    hint: '👆👆 Double tap',
  },
  {
    icon: 'shield' as const,
    title: 'Node Types',
    body: 'Fortress nodes are tough to capture. Barracks produce faster. Capital (crown) generates 1.5x units. Ruins transform into Barracks when captured.',
    color: '#80D8FF',
    hint: 'Know your terrain',
  },
  {
    icon: 'flag' as const,
    title: 'Claim the Realm',
    body: 'In Conquest mode, capture all enemy castles. In Regicide mode, capture the enemy King for instant victory! Fog of war hides distant nodes on large maps.',
    color: '#FFD700',
    hint: 'Victory awaits!',
  },
];

export default function TutorialOverlay({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const hintPulse = useRef(new Animated.Value(0.4)).current;
  const completeScale = useRef(new Animated.Value(0)).current;
  const completeOpacity = useRef(new Animated.Value(0)).current;

  // Hint pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(hintPulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const goTo = (next: number) => {
    Haptics.selectionAsync();
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setComplete(true);
    Animated.parallel([
      Animated.spring(completeScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(completeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.timing(completeOpacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onDone());
    }, 1500);
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  if (complete) {
    return (
      <Animated.View style={[styles.container, styles.completeContainer, { opacity: completeOpacity }]}>
        <Animated.Text style={[styles.completeText, { transform: [{ scale: completeScale }] }]}>
          YOU'RE READY, COMMANDER!
        </Animated.Text>
        <Animated.Text style={[styles.completeSubText, { transform: [{ scale: completeScale }] }]}>
          Go conquer the realm
        </Animated.Text>
      </Animated.View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
      <View style={styles.backdrop} />

      {/* Hint text floating above card */}
      <Animated.Text style={[styles.hintFloat, { opacity: hintPulse, color: current.color }]}>
        {current.hint}
      </Animated.Text>

      <View style={styles.card}>
        <View style={styles.stepDots}>
          {STEPS.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && { backgroundColor: current.color, width: 20 },
                i < step && { backgroundColor: 'rgba(255,255,255,0.5)' },
              ]}
            />
          ))}
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={[styles.iconWrap, { backgroundColor: current.color + '22', borderColor: current.color + '44' }]}>
            <Feather name={current.icon} size={36} color={current.color} />
          </View>
          <Text style={[styles.title, { color: current.color }]}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
          <Text style={styles.stepCounter}>{step + 1} / {STEPS.length}</Text>
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
              if (isLast) handleComplete();
              else goTo(step + 1);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.nextText}>{isLast ? 'TO BATTLE' : 'NEXT'}</Text>
            <Feather name={isLast ? 'play' : 'arrow-right'} size={16} color="#000" />
          </TouchableOpacity>
        </View>

        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => { Haptics.selectionAsync(); onDone(); }} activeOpacity={0.7}>
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
  completeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(6,10,4,0.88)',
  },
  completeText: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  } as any,
  completeSubText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,220,140,0.5)',
    letterSpacing: 2,
    marginTop: 8,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,4,0.78)',
  },
  hintFloat: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 16,
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
  stepCounter: {
    fontSize: 10,
    color: 'rgba(255,220,140,0.25)',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 2,
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
