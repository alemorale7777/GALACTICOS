import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface GameStats {
  wins: number;
  losses: number;
  bestTimeMs: number | null;
  streak: number;
}

const STORAGE_KEY = '@thraxon_stats';

const DEFAULT_STATS: GameStats = {
  wins: 0,
  losses: 0,
  bestTimeMs: null,
  streak: 0,
};

export function useGameStorage() {
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const [tutorialSeen, setTutorialSeenState] = useState<boolean>(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [statsRaw, tutRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem('@thraxon_tutorial'),
        ]);
        if (statsRaw) setStats(JSON.parse(statsRaw));
        setTutorialSeenState(tutRaw === 'true');
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const recordWin = useCallback(async (elapsedMs: number) => {
    setStats(prev => {
      const next: GameStats = {
        wins: prev.wins + 1,
        losses: prev.losses,
        bestTimeMs:
          prev.bestTimeMs === null ? elapsedMs : Math.min(prev.bestTimeMs, elapsedMs),
        streak: prev.streak + 1,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const recordLoss = useCallback(async () => {
    setStats(prev => {
      const next: GameStats = {
        wins: prev.wins,
        losses: prev.losses + 1,
        bestTimeMs: prev.bestTimeMs,
        streak: 0,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const markTutorialSeen = useCallback(async () => {
    setTutorialSeenState(true);
    await AsyncStorage.setItem('@thraxon_tutorial', 'true').catch(() => {});
  }, []);

  return { stats, tutorialSeen, loaded, recordWin, recordLoss, markTutorialSeen };
}
