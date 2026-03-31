import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import GameCanvas from '@/components/GameCanvas';
import GameOverlay from '@/components/GameOverlay';
import { BottomHUD, TopHUD } from '@/components/HUD';
import LeaderSelect from '@/components/LeaderSelect';
import StarField from '@/components/StarField';
import StartScreen from '@/components/StartScreen';
import TutorialOverlay from '@/components/TutorialOverlay';
import { Colors } from '@/constants/colors';
import { EmpireConfig, EmpireId, EMPIRE_CONFIG, randomEmpireExcluding } from '@/constants/empires';
import { Difficulty, FleetPercent, GameProvider, useGame } from '@/context/GameContext';
import { useGameStorage } from '@/hooks/useGameStorage';

type AppScreen = 'start' | 'leader' | 'tutorial' | 'game';

// ─── Inner game view (needs GameProvider in tree) ──────────────────────────
interface GameViewProps {
  onMenu: () => void;
  playerEmpire: EmpireConfig | null;
  aiEmpire: EmpireConfig | null;
}

const COMBO_LABELS = ['', 'CONQUISTA!', 'DOUBLE RAID!', 'TRIPLE STRIKE!', 'UNSTOPPABLE!', 'GODLIKE!'];
const AI_TAUNTS = [
  'Your walls crumble!',
  'Bow before my armies!',
  'The realm will be mine!',
  'Resistance is futile!',
  'Your kingdom falls!',
  'None can stop my advance!',
];

function GameView({ onMenu, playerEmpire, aiEmpire }: GameViewProps) {
  const { state, sendFleet, sendFleetFromAll, useAbility, resetGame, setFleetPercent, setDimensions } = useGame();
  const { stats, recordWin, recordLoss } = useGameStorage();

  const [selectedPlanetId, setSelectedPlanetId] = useState<number | null>(null);
  const [allSelected, setAllSelected] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [playAreaSize, setPlayAreaSize] = useState({ width: 375, height: 500 });
  const [comboLabel, setComboLabel] = useState('');
  const [tauntText, setTauntText] = useState('');

  const resultRecordedRef = useRef(false);
  const prevBestRef = useRef<number | null>(null);
  const warCryFlashAnim = useRef(new Animated.Value(0)).current;

  const comboOpacity  = useRef(new Animated.Value(0)).current;
  const comboTransY   = useRef(new Animated.Value(0)).current;
  const comboScale    = useRef(new Animated.Value(1)).current;
  const tauntOpacity  = useRef(new Animated.Value(0)).current;
  const tauntTransY   = useRef(new Animated.Value(0)).current;
  const atmTintAnim   = useRef(new Animated.Value(0)).current;

  const comboDataRef = useRef({ count: 0, lastTime: 0 });

  const handleAbility = useCallback(() => {
    useAbility();
    warCryFlashAnim.setValue(1);
    Animated.timing(warCryFlashAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  }, [useAbility]);

  useEffect(() => {
    const total = state.playerConquestTotal;
    if (total === 0) return;
    const now = Date.now();
    const combo = comboDataRef.current;
    if (now - combo.lastTime < 4200) {
      combo.count = Math.min(combo.count + 1, COMBO_LABELS.length - 1);
    } else {
      combo.count = 1;
    }
    combo.lastTime = now;
    const label = COMBO_LABELS[combo.count];
    if (label) {
      setComboLabel(label);
      comboOpacity.setValue(0);
      comboTransY.setValue(0);
      comboScale.setValue(1.5);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(comboOpacity, { toValue: 1, duration: 90, useNativeDriver: false }),
          Animated.delay(900),
          Animated.timing(comboOpacity, { toValue: 0, duration: 700, useNativeDriver: false }),
        ]),
        Animated.timing(comboTransY, { toValue: -50, duration: 1700, useNativeDriver: false }),
        Animated.spring(comboScale, { toValue: 1, tension: 240, friction: 6, useNativeDriver: false }),
      ]).start();
    }
  }, [state.playerConquestTotal]);

  useEffect(() => {
    const total = state.enemyConquestTotal;
    if (total === 0) return;
    const taunts = aiEmpire?.warCry
      ? [...AI_TAUNTS, aiEmpire.warCry]
      : AI_TAUNTS;
    const picked = taunts[Math.floor(Math.random() * taunts.length)];
    setTauntText(picked);
    tauntOpacity.setValue(0);
    tauntTransY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(tauntOpacity, { toValue: 0.88, duration: 200, useNativeDriver: false }),
        Animated.delay(1400),
        Animated.timing(tauntOpacity, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]),
      Animated.timing(tauntTransY, { toValue: -18, duration: 2400, useNativeDriver: false }),
    ]).start();
  }, [state.enemyConquestTotal]);

  const playerPlanets = state.planets.filter(p => p.owner === 1).length;
  const enemyPlanets  = state.planets.filter(p => p.owner === 2).length;

  useEffect(() => {
    const dominance = state.planets.length > 0
      ? state.planets.filter(p => p.owner === 1).length / state.planets.length
      : 0.5;
    const target = dominance > 0.65 ? 0.05 : dominance < 0.35 ? 0 : 0;
    Animated.timing(atmTintAnim, { toValue: target, duration: 1800, useNativeDriver: false }).start();
  }, [playerPlanets]);

  useEffect(() => {
    if (state.phase === 'won' && !resultRecordedRef.current) {
      resultRecordedRef.current = true;
      prevBestRef.current = stats.bestTimeMs;
      const elapsed = state.gameEndTime
        ? state.gameEndTime - state.gameStartTime
        : 0;
      recordWin(elapsed);
    } else if (state.phase === 'lost' && !resultRecordedRef.current) {
      resultRecordedRef.current = true;
      recordLoss();
    }
  }, [state.phase]);

  const handleLayout = useCallback(
    (w: number, h: number) => {
      if (w !== playAreaSize.width || h !== playAreaSize.height) {
        setPlayAreaSize({ width: w, height: h });
        setDimensions(w, h);
      }
    },
    [playAreaSize.width, playAreaSize.height, setDimensions]
  );

  const handleReset = useCallback(() => {
    resultRecordedRef.current = false;
    comboDataRef.current = { count: 0, lastTime: 0 };
    setComboLabel('');
    setTauntText('');
    setSelectedPlanetId(null);
    setAllSelected(false);
    resetGame(state.difficulty, playAreaSize.width, playAreaSize.height);
  }, [resetGame, state.difficulty, playAreaSize]);

  const handleMenu = useCallback(() => {
    resultRecordedRef.current = false;
    onMenu();
  }, [onMenu]);

  const elapsedMs =
    state.gameEndTime !== null
      ? state.gameEndTime - state.gameStartTime
      : Date.now() - state.gameStartTime;

  return (
    <View style={styles.root}>
      <StarField />

      <TopHUD
        playerPlanets={playerPlanets}
        enemyPlanets={enemyPlanets}
        totalPlanets={state.planets.length}
        difficulty={state.difficulty}
        elapsedMs={elapsedMs}
        onReset={handleReset}
      />

      <View
        style={styles.playArea}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          handleLayout(width, height);
        }}
      >
        <GameCanvas
          width={playAreaSize.width}
          height={playAreaSize.height}
          onSelectPlanet={id => { setSelectedPlanetId(id); if (id !== null) setAllSelected(false); }}
          onSendFleet={sendFleet}
          onSendFleetFromAll={sendFleetFromAll}
          onClearAll={() => setAllSelected(false)}
          selectedPlanetId={selectedPlanetId}
          allSelected={allSelected}
          pointerPos={pointerPos}
          onPointerMove={(x, y) => setPointerPos({ x, y })}
          playerEmpire={playerEmpire}
          aiEmpire={aiEmpire}
        />

        {/* Battlefield atmosphere tint — glows empire color when dominating */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, {
            backgroundColor: playerEmpire?.nodeColor ?? '#44EE66',
            opacity: atmTintAnim,
          }]}
        />

        {/* Combo text burst */}
        {comboLabel !== '' && (
          <Animated.Text
            pointerEvents="none"
            style={[styles.comboText, {
              color: playerEmpire?.nodeColor ?? '#44EE66',
              opacity: comboOpacity,
              transform: [{ translateY: comboTransY }, { scale: comboScale }],
              top: playAreaSize.height * 0.30,
            }]}>
            {comboLabel}
          </Animated.Text>
        )}

        {/* AI enemy taunt */}
        {tauntText !== '' && (
          <Animated.Text
            pointerEvents="none"
            style={[styles.tauntText, {
              color: aiEmpire?.nodeColor ?? '#EE3344',
              opacity: tauntOpacity,
              transform: [{ translateY: tauntTransY }],
            }]}>
            ⚔ {tauntText}
          </Animated.Text>
        )}
      </View>

      {/* War Cry full-screen empire color flash */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          backgroundColor: playerEmpire?.nodeColor ?? '#FFAA22',
          opacity: warCryFlashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
        }]}
      />

      <BottomHUD
        abilityCooldown={state.abilityCooldown}
        fleetPercent={state.fleetPercent}
        onAbility={handleAbility}
        onSetFleetPercent={(pct: FleetPercent) => setFleetPercent(pct)}
        selectedPlanetId={selectedPlanetId}
        allSelected={allSelected}
        onToggleAll={() => { setAllSelected(a => !a); setSelectedPlanetId(null); }}
        playerEmpire={playerEmpire}
      />

      <GameOverlay
        phase={state.phase}
        onReset={handleReset}
        onMenu={handleMenu}
        elapsedMs={elapsedMs}
        stats={stats}
        prevBestTimeMs={prevBestRef.current}
      />
    </View>
  );
}

// ─── Root app shell ────────────────────────────────────────────────────────
export default function GameApp() {
  const [screen, setScreen] = useState<AppScreen>('start');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [playerEmpire, setPlayerEmpire] = useState<EmpireConfig | null>(null);
  const [aiEmpire, setAiEmpire] = useState<EmpireConfig | null>(null);
  const { stats, tutorialSeen, loaded, markTutorialSeen } = useGameStorage();

  const goToGame = () => setScreen('game');
  const goToMenu = () => setScreen('start');

  const handleStart = (d: Difficulty) => {
    setDifficulty(d);
    setScreen('leader');
  };

  const handleSelectEmpire = (empireId: EmpireId) => {
    const pEmpire = EMPIRE_CONFIG[empireId];
    const aiId = randomEmpireExcluding(empireId);
    const aEmpire = EMPIRE_CONFIG[aiId];
    setPlayerEmpire(pEmpire);
    setAiEmpire(aEmpire);
    if (!tutorialSeen) {
      setScreen('tutorial');
    } else {
      goToGame();
    }
  };

  const handleTutorialDone = () => {
    markTutorialSeen();
    goToGame();
  };

  if (!loaded) {
    return <View style={styles.root} />;
  }

  if (screen === 'start') {
    return (
      <View style={styles.root}>
        <StarField />
        <StartScreen
          onStart={handleStart}
          onShowTutorial={() => setScreen('tutorial')}
          stats={stats}
        />
      </View>
    );
  }

  if (screen === 'leader') {
    return (
      <View style={styles.root}>
        <StarField />
        <LeaderSelect onSelect={handleSelectEmpire} />
      </View>
    );
  }

  if (screen === 'tutorial') {
    return (
      <View style={styles.root}>
        <StarField />
        <TutorialOverlay onDone={handleTutorialDone} />
      </View>
    );
  }

  // Game screen
  return (
    <GameProvider key={difficulty} initialDifficulty={difficulty}>
      <GameView onMenu={goToMenu} playerEmpire={playerEmpire} aiEmpire={aiEmpire} />
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  playArea: {
    flex: 1,
    overflow: 'hidden',
  },
  comboText: {
    position: 'absolute',
    left: 0, right: 0,
    textAlign: 'center',
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 4,
  } as any,
  tauntText: {
    position: 'absolute',
    top: 14,
    left: 16, right: 16,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
  } as any,
});
