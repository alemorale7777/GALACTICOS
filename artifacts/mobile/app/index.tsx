import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

import GameCanvas from '@/components/GameCanvas';
import GameOverlay from '@/components/GameOverlay';
import { BottomHUD, TopHUD } from '@/components/HUD';
import LeaderSelect from '@/components/LeaderSelect';
import MapSizeSelect from '@/components/MapSizeSelect';
import StarField from '@/components/StarField';
import StartScreen from '@/components/StartScreen';
import TutorialOverlay from '@/components/TutorialOverlay';
import TournamentScreen from '@/components/TournamentScreen';
import CampaignScreen from '@/components/CampaignScreen';
import WorldMapScreen from '@/components/WorldMapScreen';
import ClanScreen from '@/components/ClanScreen';
import ReplayScreen from '@/components/ReplayScreen';
import LocalMultiplayerSetup from '@/components/LocalMultiplayerSetup';
import CampaignLoreScreen from '@/components/CampaignLoreScreen';

import { Colors } from '@/constants/colors';
import { EmpireConfig, EmpireId, GameMode, MapSize, EMPIRE_CONFIG, randomEmpireExcluding } from '@/constants/empires';
import { CAMPAIGNS } from '@/hooks/useCampaign';
import { Difficulty, FleetPercent, GameProvider, useGame, GamePhase } from '@/context/GameContext';
import { useGameStorage } from '@/hooks/useGameStorage';
import { useRankedSeason } from '@/hooks/useRankedSeason';
import { useDailyChallenges } from '@/hooks/useDailyChallenges';
import { useSoundEngine } from '@/hooks/useSoundEngine';
import { useReplaySystem } from '@/hooks/useReplaySystem';
import { useWorldMap } from '@/hooks/useWorldMap';
import { useCampaign } from '@/hooks/useCampaign';
import { useTournament } from '@/hooks/useTournament';
import { useClanSystem } from '@/hooks/useClanSystem';

type AppScreen = 'start' | 'leader' | 'mapsize' | 'tutorial' | 'game'
  | 'tournament' | 'campaign' | 'campaignlore' | 'worldmap' | 'clan' | 'replays' | 'localmulti';

// ─── Inner game view ──────────────────────────────────────────────────────
interface GameViewProps {
  onMenu: () => void;
  onChangeEmpire: () => void;
  onGameEnd: (won: boolean, elapsedMs: number, nodesCaptures: number, abilityUsed: boolean) => void;
  playerEmpire: EmpireConfig | null;
  aiEmpire: EmpireConfig | null;
  gameMode: GameMode;
}

const COMBO_LABELS = ['', 'CONQUISTA!', 'DOUBLE RAID!', 'TRIPLE STRIKE!', 'UNSTOPPABLE!', 'GODLIKE!'];
const AI_TAUNTS = [
  'Your walls crumble!', 'Bow before my armies!', 'The realm will be mine!',
  'Resistance is futile!', 'Your kingdom falls!', 'None can stop my advance!',
];

function GameView({ onMenu, onChangeEmpire, onGameEnd, playerEmpire, aiEmpire, gameMode }: GameViewProps) {
  const { state, sendFleet, sendFleetFromAll, useAbility, resetGame, setFleetPercent, setDimensions } = useGame();
  const { stats, recordWin, recordLoss } = useGameStorage();
  const sound = useSoundEngine();

  const [selectedPlanetId, setSelectedPlanetId] = useState<number | null>(null);
  const [selectedPlanetIds, setSelectedPlanetIds] = useState<Set<number>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const lastPointerUpdateRef = useRef(0);
  const [playAreaSize, setPlayAreaSize] = useState({ width: 375, height: 500 });
  const [comboLabel, setComboLabel] = useState('');
  const [tauntText, setTauntText] = useState('');

  const resultRecordedRef = useRef(false);
  const prevBestRef = useRef<number | null>(null);
  const abilityUsedRef = useRef(false);
  const warCryFlashAnim = useRef(new Animated.Value(0)).current;

  const comboOpacity = useRef(new Animated.Value(0)).current;
  const comboTransY = useRef(new Animated.Value(0)).current;
  const comboScale = useRef(new Animated.Value(1)).current;
  const tauntOpacity = useRef(new Animated.Value(0)).current;
  const tauntTransY = useRef(new Animated.Value(0)).current;
  const atmTintAnim = useRef(new Animated.Value(0)).current;
  const comboDataRef = useRef({ count: 0, lastTime: 0 });

  // Start ambient on mount
  useEffect(() => { sound.startAmbient(); return () => sound.stopAmbient(); }, []);

  const handleAbility = useCallback(() => {
    useAbility();
    abilityUsedRef.current = true;
    sound.sfxAbility();
    // Haptic
    if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    warCryFlashAnim.setValue(1);
    Animated.timing(warCryFlashAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  }, [useAbility, sound]);

  const handleSendFleet = useCallback((fromId: number, toId: number) => {
    sendFleet(fromId, toId);
    sound.sfxDispatch();
    if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
  }, [sendFleet, sound]);

  const handleSendFleetFromAll = useCallback((toId: number) => {
    // If multi-select active, send from selected nodes
    if (selectedPlanetIds.size > 0) {
      let delay = 0;
      selectedPlanetIds.forEach(fromId => {
        setTimeout(() => sendFleet(fromId, toId), delay);
        delay += 40; // 40ms stagger
      });
      setSelectedPlanetIds(new Set());
      setSelectedPlanetId(null);
      sound.sfxDispatch();
      return;
    }
    sendFleetFromAll(toId);
    sound.sfxDispatch();
  }, [sendFleetFromAll, sendFleet, sound, selectedPlanetIds]);

  const handleDoubleTapSelectAll = useCallback(() => {
    setAllSelected(true);
    setSelectedPlanetId(null);
    setSelectedPlanetIds(new Set());
  }, []);

  const handleToggleMultiSelect = useCallback((id: number) => {
    setSelectedPlanetIds(prev => {
      const next = new Set(prev);
      // Also include current single selection
      if (selectedPlanetId !== null && !next.has(selectedPlanetId)) {
        next.add(selectedPlanetId);
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size > 0) setSelectedPlanetId(null);
      return next;
    });
    setAllSelected(false);
  }, [selectedPlanetId]);

  // Conquest combo
  useEffect(() => {
    const total = state.playerConquestTotal;
    if (total === 0) return;
    sound.sfxCapture();
    if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(30);
    const now = Date.now();
    const combo = comboDataRef.current;
    if (now - combo.lastTime < 4200) {
      combo.count = Math.min(combo.count + 1, COMBO_LABELS.length - 1);
    } else { combo.count = 1; }
    combo.lastTime = now;
    const label = COMBO_LABELS[combo.count];
    if (label) {
      setComboLabel(label);
      comboOpacity.setValue(0); comboTransY.setValue(0); comboScale.setValue(1.5);
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

  // Enemy conquest
  useEffect(() => {
    const total = state.enemyConquestTotal;
    if (total === 0) return;
    sound.sfxImpact();
    if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 10, 20]);
    const taunts = aiEmpire?.warCry ? [...AI_TAUNTS, aiEmpire.warCry] : AI_TAUNTS;
    const picked = taunts[Math.floor(Math.random() * taunts.length)];
    setTauntText(picked);
    tauntOpacity.setValue(0); tauntTransY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(tauntOpacity, { toValue: 0.88, duration: 200, useNativeDriver: false }),
        Animated.delay(1400),
        Animated.timing(tauntOpacity, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]),
      Animated.timing(tauntTransY, { toValue: -18, duration: 2400, useNativeDriver: false }),
    ]).start();
  }, [state.enemyConquestTotal]);

  // Use for-loop counts instead of .filter().length to avoid allocation
  let playerPlanets = 0, enemyPlanets = 0;
  for (let i = 0; i < state.planets.length; i++) {
    if (state.planets[i].owner === 1) playerPlanets++;
    else if (state.planets[i].owner === 2) enemyPlanets++;
  }

  useEffect(() => {
    const dominance = state.planets.length > 0
      ? state.planets.filter(p => p.owner === 1).length / state.planets.length : 0.5;
    const target = dominance > 0.65 ? 0.05 : 0;
    Animated.timing(atmTintAnim, { toValue: target, duration: 1800, useNativeDriver: false }).start();
  }, [playerPlanets]);

  // Game end handling
  useEffect(() => {
    if (state.phase === 'won' && !resultRecordedRef.current) {
      resultRecordedRef.current = true;
      prevBestRef.current = stats.bestTimeMs;
      const elapsed = state.gameEndTime ? state.gameEndTime - state.gameStartTime : 0;
      recordWin(elapsed);
      sound.sfxVictory();
      if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
      onGameEnd(true, elapsed, state.playerConquestTotal, abilityUsedRef.current);
    } else if (state.phase === 'lost' && !resultRecordedRef.current) {
      resultRecordedRef.current = true;
      recordLoss();
      sound.sfxDefeat();
      if (Platform.OS !== 'web' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(200);
      const elapsed = state.gameEndTime ? state.gameEndTime - state.gameStartTime : 0;
      onGameEnd(false, elapsed, state.playerConquestTotal, abilityUsedRef.current);
    }
  }, [state.phase]);

  const handleLayout = useCallback((w: number, h: number) => {
    if (w !== playAreaSize.width || h !== playAreaSize.height) {
      setPlayAreaSize({ width: w, height: h });
      setDimensions(w, h);
    }
  }, [playAreaSize.width, playAreaSize.height, setDimensions]);

  const handleReset = useCallback(() => {
    resultRecordedRef.current = false;
    abilityUsedRef.current = false;
    comboDataRef.current = { count: 0, lastTime: 0 };
    setComboLabel(''); setTauntText('');
    setSelectedPlanetId(null); setSelectedPlanetIds(new Set()); setAllSelected(false);
    resetGame(state.difficulty, playAreaSize.width, playAreaSize.height);
  }, [resetGame, state.difficulty, playAreaSize]);

  const handleMenu = useCallback(() => { resultRecordedRef.current = false; onMenu(); }, [onMenu]);
  const handleChangeEmpire = useCallback(() => { resultRecordedRef.current = false; onChangeEmpire(); }, [onChangeEmpire]);

  const elapsedMs = state.gameEndTime !== null
    ? state.gameEndTime - state.gameStartTime
    : Date.now() - state.gameStartTime;

  const abilityMaxCooldown = playerEmpire?.ability?.cooldown ?? 22;

  return (
    <View style={styles.root}>
      <StarField />
      <TopHUD playerPlanets={playerPlanets} enemyPlanets={enemyPlanets}
        totalPlanets={state.planets.length} difficulty={state.difficulty}
        elapsedMs={elapsedMs} onReset={handleReset}
        abilityActive={state.abilityActive} playerEmpire={playerEmpire} aiEmpire={aiEmpire}
        gameMode={gameMode} />

      <View style={styles.playArea} onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        handleLayout(width, height);
      }}>
        <GameCanvas width={playAreaSize.width} height={playAreaSize.height}
          onSelectPlanet={id => { setSelectedPlanetId(id); if (id !== null) { setAllSelected(false); setSelectedPlanetIds(new Set()); } }}
          onSendFleet={handleSendFleet} onSendFleetFromAll={handleSendFleetFromAll}
          onClearAll={() => { setAllSelected(false); setSelectedPlanetIds(new Set()); }}
          onDoubleTapSelectAll={handleDoubleTapSelectAll}
          onToggleMultiSelect={handleToggleMultiSelect}
          selectedPlanetId={selectedPlanetId} selectedPlanetIds={selectedPlanetIds} allSelected={allSelected}
          pointerPos={pointerPos} onPointerMove={(x, y) => {
            const now = Date.now();
            if (now - lastPointerUpdateRef.current < 33) return; // throttle to ~30/s
            lastPointerUpdateRef.current = now;
            setPointerPos({ x, y });
          }}
          playerEmpire={playerEmpire} aiEmpire={aiEmpire} />

        <Animated.View pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: playerEmpire?.nodeColor ?? '#44EE66', opacity: atmTintAnim }]} />

        {comboLabel !== '' && (
          <Animated.Text pointerEvents="none"
            style={[styles.comboText, {
              color: playerEmpire?.nodeColor ?? '#44EE66',
              opacity: comboOpacity, transform: [{ translateY: comboTransY }, { scale: comboScale }],
              top: playAreaSize.height * 0.30,
            }]}>{comboLabel}</Animated.Text>
        )}
        {tauntText !== '' && (
          <Animated.Text pointerEvents="none"
            style={[styles.tauntText, {
              color: aiEmpire?.nodeColor ?? '#EE3344',
              opacity: tauntOpacity, transform: [{ translateY: tauntTransY }],
            }]}>{tauntText}</Animated.Text>
        )}
      </View>

      <Animated.View pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          backgroundColor: playerEmpire?.nodeColor ?? '#FFAA22',
          opacity: warCryFlashAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.08] }),
        }]} />

      <BottomHUD abilityCooldown={state.abilityCooldown} abilityMaxCooldown={abilityMaxCooldown}
        fleetPercent={state.fleetPercent} onAbility={handleAbility}
        onSetFleetPercent={(pct: FleetPercent) => setFleetPercent(pct)}
        selectedPlanetId={selectedPlanetId} allSelected={allSelected}
        onToggleAll={() => { setAllSelected(a => !a); setSelectedPlanetId(null); }}
        playerEmpire={playerEmpire} abilityActive={state.abilityActive} />

      <GameOverlay phase={state.phase} onReset={handleReset} onMenu={handleMenu}
        onChangeEmpire={handleChangeEmpire} elapsedMs={elapsedMs}
        stats={stats} prevBestTimeMs={prevBestRef.current}
        playerEmpire={playerEmpire} nodesCaptures={state.playerConquestTotal}
        gameMode={gameMode} />
    </View>
  );
}

// ─── Root app shell ────────────────────────────────────────────────────────
type AppGameMode = 'quickplay' | 'campaign' | 'tournament' | 'localmulti';

export default function GameApp() {
  const [screen, setScreen] = useState<AppScreen>('start');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [mapSize, setMapSize] = useState<MapSize>('medium');
  const [playerEmpire, setPlayerEmpire] = useState<EmpireConfig | null>(null);
  const [aiEmpire, setAiEmpire] = useState<EmpireConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [appGameMode, setAppGameMode] = useState<AppGameMode>('quickplay');
  const [regicideMode, setRegicideMode] = useState<GameMode>('conquest');
  const [campaignMapIdx, setCampaignMapIdx] = useState<number>(0);
  const [campaignEmpireId, setCampaignEmpireId] = useState<EmpireId>('egypt');

  const { stats, tutorialSeen, loaded: statsLoaded, markTutorialSeen } = useGameStorage();
  const ranked = useRankedSeason();
  const dailies = useDailyChallenges();
  const sound = useSoundEngine();
  const replays = useReplaySystem();
  const worldMap = useWorldMap();
  const campaign = useCampaign();
  const tournament = useTournament();
  const clanSystem = useClanSystem();

  // ── Screen transition system ──
  const transitionOpacity = useRef(new Animated.Value(1)).current;
  const transitionTo = useCallback((nextScreen: AppScreen, duration = 250) => {
    Animated.timing(transitionOpacity, { toValue: 0, duration, useNativeDriver: true }).start(() => {
      setScreen(nextScreen);
      Animated.timing(transitionOpacity, { toValue: 1, duration, useNativeDriver: true }).start();
    });
  }, []);

  // ── Game intro state ──
  const [showGameIntro, setShowGameIntro] = useState(false);
  const introOpacity = useRef(new Animated.Value(1)).current;
  const introIconScale = useRef(new Animated.Value(0.5)).current;
  const introTextOpacity = useRef(new Animated.Value(0)).current;

  const playGameIntro = useCallback(() => {
    setShowGameIntro(true);
    introOpacity.setValue(1);
    introIconScale.setValue(0.5);
    introTextOpacity.setValue(0);
    // Icon entrance
    Animated.spring(introIconScale, { toValue: 1.2, tension: 80, friction: 8, useNativeDriver: true }).start();
    // "BATTLE BEGINS" text
    Animated.sequence([
      Animated.delay(1200),
      Animated.timing(introTextOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(introOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowGameIntro(false));
  }, []);

  const goToGame = (mode: AppGameMode = 'quickplay') => {
    setAppGameMode(mode);
    setGameKey(k => k + 1);
    setScreen('game');
    playGameIntro();
  };
  const goToMenu = () => transitionTo('start');

  const handleStart = (d: Difficulty) => {
    setDifficulty(d);
    transitionTo('leader');
  };

  const handleSelectEmpire = (empireId: EmpireId) => {
    const pEmpire = EMPIRE_CONFIG[empireId];
    const aiId = randomEmpireExcluding(empireId);
    const aEmpire = EMPIRE_CONFIG[aiId];
    setPlayerEmpire(pEmpire);
    setAiEmpire(aEmpire);
    sound.playEmpireMotif(empireId);
    transitionTo('mapsize');
  };

  const handleSelectMapSize = (size: MapSize, gm: GameMode = 'conquest') => {
    setMapSize(size);
    setRegicideMode(gm);
    if (!tutorialSeen) { setScreen('tutorial'); }
    else { goToGame('quickplay'); replays.startRecording(); }
  };

  const handleTutorialDone = () => {
    markTutorialSeen();
    goToGame('quickplay');
    replays.startRecording();
  };

  const handleGameEnd = useCallback(async (
    won: boolean, elapsedMs: number, nodesCaptures: number, abilityUsed: boolean
  ) => {
    if (!playerEmpire || !aiEmpire) return;

    // Ranked XP (all modes)
    await ranked.recordGameResult(won, playerEmpire.id, mapSize, elapsedMs, abilityUsed);

    // Daily challenges (all modes)
    const challengeResult = dailies.checkGameResult(
      won, playerEmpire.id, mapSize, elapsedMs, abilityUsed,
      nodesCaptures,
      won, // capital captured if won
      false, // usedOnly75 - simplified
    );
    if (challengeResult.xpEarned > 0) {
      await ranked.addXP(challengeResult.xpEarned);
      sound.sfxChallengeComplete();
    }
    if (challengeResult.masteryEarned > 0) {
      await ranked.addEmpireMasteryXP(playerEmpire.id, challengeResult.masteryEarned);
    }

    // World map territories (all modes)
    if (won) {
      const claim = mapSize === 'large' ? 3 : mapSize === 'medium' ? 2 : 1;
      await worldMap.claimTerritories(playerEmpire.id, claim);
    }

    // Clan XP (all modes)
    if (clanSystem.clan) {
      const clanXP = won ? 100 : 30;
      await clanSystem.addClanXP(clanXP);
    }

    // Replay (all modes)
    await replays.finishRecording(
      playerEmpire.id, aiEmpire.id, mapSize, won, elapsedMs, nodesCaptures
    );

    // ── MODE-SPECIFIC RESULTS ──

    // Campaign: record map completion
    if (appGameMode === 'campaign') {
      await campaign.completeMap(campaignEmpireId, campaignMapIdx, won, elapsedMs, abilityUsed);
    }

    // Tournament: resolve match
    if (appGameMode === 'tournament') {
      await tournament.resolveMatch(won, nodesCaptures);
    }
  }, [playerEmpire, aiEmpire, mapSize, appGameMode, campaignEmpireId, campaignMapIdx,
      ranked, dailies, worldMap, clanSystem, replays, sound, campaign, tournament]);

  const handleShareReplay = useCallback((replay: any) => {
    const text = replays.getShareText(replay);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
      (navigator as any).share({ text }).catch(() => {});
    } else if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [replays]);

  // Tournament handlers
  const handleStartTournament = useCallback(async () => {
    await tournament.startTournament();
  }, [tournament]);

  const handleTournamentPlay = useCallback(() => {
    const match = tournament.getPlayerMatch();
    if (!match) return;
    const pEmp = match.competitor1?.isPlayer ? match.competitor1 : match.competitor2;
    const aiComp = match.competitor1?.isPlayer ? match.competitor2 : match.competitor1;
    if (!pEmp || !aiComp) return;
    setPlayerEmpire(EMPIRE_CONFIG[pEmp.empire]);
    setAiEmpire(EMPIRE_CONFIG[aiComp.empire]);
    setDifficulty('medium');
    setMapSize('medium');
    // Semifinals (round 1) and Finals (round 2) use Regicide
    setRegicideMode(match.round >= 1 ? 'regicide' : 'conquest');
    goToGame('tournament');
  }, [tournament]);

  const handleTournamentReward = useCallback(async () => {
    const reward = tournament.getReward();
    if (reward > 0) {
      await ranked.addXP(reward);
      await tournament.markRewarded();
      sound.sfxRankUp();
    }
  }, [tournament, ranked, sound]);

  if (!statsLoaded || !ranked.loaded) {
    return <View style={styles.root} />;
  }

  // ── Screen routing ──────────────────────────────────────────────────────
  if (screen === 'start') {
    return (
      <View style={styles.root}>
        <StarField />
        <StartScreen
          onStart={handleStart}
          onShowTutorial={() => transitionTo('tutorial')}
          onCampaign={() => transitionTo('campaign')}
          onTournament={() => transitionTo('tournament')}
          onWorldMap={() => transitionTo('worldmap')}
          onClan={() => transitionTo('clan')}
          onReplays={() => transitionTo('replays')}
          onLocalMultiplayer={() => transitionTo('localmulti')}
          stats={stats}
          rank={ranked.data.rank}
          xp={ranked.data.currentXP}
          seasonDaysLeft={ranked.seasonDaysLeft}
          challenges={dailies.challenges}
          msUntilChallengeReset={dailies.msUntilMidnight}
          clan={clanSystem.clan}
          soundEnabled={sound.settings.enabled}
          onToggleSound={sound.toggleSound}
        />
      </View>
    );
  }

  if (screen === 'leader') {
    return (
      <View style={styles.root}>
        <StarField />
        <LeaderSelect
          onSelect={handleSelectEmpire}
          empireMastery={ranked.data.empireMastery}
          empireXP={ranked.data.empireXP}
        />
      </View>
    );
  }

  if (screen === 'mapsize') {
    return (
      <View style={styles.root}>
        <StarField />
        <MapSizeSelect onSelect={handleSelectMapSize} />
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

  if (screen === 'tournament') {
    return (
      <View style={styles.root}>
        <StarField />
        <TournamentScreen
          data={tournament.data}
          isTournamentTime={tournament.isTournamentTime}
          msUntilNext={tournament.msUntilNextTournament}
          onStart={handleStartTournament}
          onPlayMatch={handleTournamentPlay}
          onCollectReward={handleTournamentReward}
          onBack={goToMenu}
        />
      </View>
    );
  }

  if (screen === 'campaign') {
    return (
      <View style={styles.root}>
        <StarField />
        <CampaignScreen
          progress={campaign.progress}
          onSelectMap={(empireId, mapIdx) => {
            const map = CAMPAIGNS[empireId].maps[mapIdx];
            setCampaignEmpireId(empireId);
            setCampaignMapIdx(mapIdx);
            setPlayerEmpire(EMPIRE_CONFIG[empireId]);
            setAiEmpire(EMPIRE_CONFIG[randomEmpireExcluding(empireId)]);
            setDifficulty(map.difficulty < 0.4 ? 'easy' : map.difficulty < 0.7 ? 'medium' : 'hard');
            setMapSize(map.nodeCount <= 10 ? 'small' : map.nodeCount <= 16 ? 'medium' : 'large');
            setRegicideMode(mapIdx >= 7 ? 'regicide' : 'conquest');
            transitionTo('campaignlore');
          }}
          onBack={goToMenu}
        />
      </View>
    );
  }

  if (screen === 'campaignlore') {
    const campaignData = CAMPAIGNS[campaignEmpireId];
    const mapData = campaignData.maps[campaignMapIdx];
    const mapStars = campaign.getProgress(campaignEmpireId).stars[campaignMapIdx] || 0;
    return (
      <View style={styles.root}>
        <StarField />
        <CampaignLoreScreen
          map={mapData}
          mapIndex={campaignMapIdx}
          totalMaps={campaignData.maps.length}
          campaignTitle={campaignData.title}
          empire={EMPIRE_CONFIG[campaignEmpireId]}
          stars={mapStars}
          onBegin={() => goToGame('campaign')}
          onBack={() => transitionTo('campaign')}
        />
      </View>
    );
  }

  if (screen === 'worldmap') {
    return (
      <View style={styles.root}>
        <StarField />
        <WorldMapScreen data={worldMap.data} onBack={goToMenu} />
      </View>
    );
  }

  if (screen === 'clan') {
    return (
      <View style={styles.root}>
        <StarField />
        <ClanScreen
          clan={clanSystem.clan}
          onCreateClan={(name, color) => clanSystem.createClan(name, color)}
          onJoinClan={(code) => clanSystem.joinClan(code)}
          onLeaveClan={() => clanSystem.leaveClan()}
          onGetShareCode={() => clanSystem.getShareCode()}
          onBack={goToMenu}
        />
      </View>
    );
  }

  if (screen === 'replays') {
    return (
      <View style={styles.root}>
        <StarField />
        <ReplayScreen
          replays={replays.replays}
          onShare={handleShareReplay}
          onBack={goToMenu}
        />
      </View>
    );
  }

  if (screen === 'localmulti') {
    return (
      <View style={styles.root}>
        <StarField />
        <LocalMultiplayerSetup
          onStart={(p1Emp, p2Emp, ms) => {
            setPlayerEmpire(EMPIRE_CONFIG[p1Emp]);
            setAiEmpire(EMPIRE_CONFIG[p2Emp]);
            setMapSize(ms);
            setDifficulty('medium');
            goToGame('localmulti');
          }}
          onBack={goToMenu}
        />
      </View>
    );
  }

  // Game screen
  return (
    <View style={styles.root}>
      <GameProvider
        key={`${difficulty}-${mapSize}-${gameKey}-${regicideMode}`}
        initialDifficulty={difficulty}
        mapSize={mapSize}
        playerEmpireId={playerEmpire?.id ?? null}
        aiEmpireId={aiEmpire?.id ?? null}
        playerStreak={stats.streak}
        gameMode={regicideMode}
      >
        <GameView
          onMenu={goToMenu}
          onChangeEmpire={() => transitionTo('leader')}
          onGameEnd={handleGameEnd}
          playerEmpire={playerEmpire}
          aiEmpire={aiEmpire}
          gameMode={regicideMode}
        />
      </GameProvider>

      {/* Game intro overlay */}
      {showGameIntro && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.introOverlay, { opacity: introOpacity }]}>
          <Animated.Text style={[styles.introIcon, {
            transform: [{ scale: introIconScale }],
            color: playerEmpire?.nodeColor ?? '#FFD700',
          }]}>
            {regicideMode === 'regicide' ? '👑' : '⚔️'}
          </Animated.Text>
          <Animated.Text style={[styles.introText, { opacity: introTextOpacity }]}>
            {regicideMode === 'regicide' ? 'THE KING MUST FALL' : 'BATTLE BEGINS'}
          </Animated.Text>
          <Animated.Text style={[styles.introMode, { opacity: introTextOpacity, color: playerEmpire?.nodeColor ?? '#FFD700' }]}>
            {playerEmpire?.empire?.toUpperCase() ?? 'THRAXON'}
          </Animated.Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  playArea: { flex: 1, overflow: 'hidden' },
  comboText: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: 4,
  } as any,
  tauntText: {
    position: 'absolute', top: 14, left: 16, right: 16, textAlign: 'center',
    fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5,
  } as any,
  introOverlay: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    gap: 16,
  },
  introIcon: {
    fontSize: 64,
  },
  introText: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#FFD700',
    letterSpacing: 6,
    textShadowColor: 'rgba(255,215,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  } as any,
  introMode: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 4,
    opacity: 0.7,
  },
});
