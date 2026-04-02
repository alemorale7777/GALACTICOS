import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId } from '@/constants/empires';

export type RankTier = 'Squire' | 'Knight' | 'Warlord' | 'Galactico' | 'Legend';

export const RANK_THRESHOLDS: { tier: RankTier; min: number; max: number }[] = [
  { tier: 'Squire',    min: 0,    max: 499  },
  { tier: 'Knight',    min: 500,  max: 1499 },
  { tier: 'Warlord',   min: 1500, max: 3499 },
  { tier: 'Galactico', min: 3500, max: 6999 },
  { tier: 'Legend',     min: 7000, max: Infinity },
];

export function getRank(xp: number): RankTier {
  for (const r of RANK_THRESHOLDS) {
    if (xp >= r.min && xp <= r.max) return r.tier;
  }
  return 'Legend';
}

export function getRankProgress(xp: number): { current: number; next: number; fraction: number } {
  const rank = getRank(xp);
  const tier = RANK_THRESHOLDS.find(r => r.tier === rank)!;
  const nextTier = RANK_THRESHOLDS[RANK_THRESHOLDS.indexOf(tier) + 1];
  if (!nextTier) return { current: xp, next: xp, fraction: 1 };
  const current = xp - tier.min;
  const next = nextTier.min - tier.min;
  return { current, next, fraction: Math.min(1, current / next) };
}

export function getMasteryLevel(xp: number): number {
  let level = 1;
  let required = 100;
  let total = 0;
  while (total + required <= xp && level < 50) {
    total += required;
    level++;
    required = level * 100;
  }
  return level;
}

export function getMasteryProgress(xp: number): { level: number; current: number; next: number; fraction: number } {
  let level = 1;
  let required = 100;
  let total = 0;
  while (total + required <= xp && level < 50) {
    total += required;
    level++;
    required = level * 100;
  }
  if (level >= 50) return { level: 50, current: 0, next: 1, fraction: 1 };
  const current = xp - total;
  const next = (level + 1) * 100;
  return { level, current, next, fraction: Math.min(1, current / next) };
}

export function getMasteryTitle(empireId: EmpireId, level: number): string | null {
  const names: Record<EmpireId, string> = {
    egypt: 'Egypt', rome: 'Rome', mongols: 'the Mongols', ptolemaic: 'Ptolemaic', japan: 'Japan',
    vikings: 'the Vikings', aztec: 'the Aztecs', persian: 'Persia', ottoman: 'the Ottomans', han: 'the Han',
  };
  if (level >= 50) return `Prestige Master of ${names[empireId]}`;
  if (level >= 25) return `Champion of ${names[empireId]}`;
  if (level >= 10) return `Veteran of ${names[empireId]}`;
  if (level >= 5) return `Apprentice of ${names[empireId]}`;
  return null;
}

export interface RankedData {
  currentXP: number;
  rank: RankTier;
  seasonStart: number;
  lastSeasonRank: RankTier | null;
  empireXP: Record<EmpireId, number>;
  empireMastery: Record<EmpireId, number>;
  totalGames: number;
  totalWins: number;
  bestTime: number | null;
}

const STORAGE_KEY = '@thraxon_ranked';
const SEASON_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

const DEFAULT_DATA: RankedData = {
  currentXP: 0,
  rank: 'Squire',
  seasonStart: Date.now(),
  lastSeasonRank: null,
  empireXP: { egypt: 0, rome: 0, mongols: 0, ptolemaic: 0, japan: 0, vikings: 0, aztec: 0, persian: 0, ottoman: 0, han: 0 },
  empireMastery: { egypt: 1, rome: 1, mongols: 1, ptolemaic: 1, japan: 1, vikings: 1, aztec: 1, persian: 1, ottoman: 1, han: 1 },
  totalGames: 0,
  totalWins: 0,
  bestTime: null,
};

export function useRankedSeason() {
  const [data, setData] = useState<RankedData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [xpGained, setXpGained] = useState<number | null>(null);
  const [rankedUp, setRankedUp] = useState<RankTier | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = { ...DEFAULT_DATA, ...JSON.parse(raw) };
          // Check season reset
          if (Date.now() - parsed.seasonStart > SEASON_DURATION) {
            parsed.lastSeasonRank = parsed.rank;
            parsed.currentXP = 0;
            parsed.rank = 'Squire';
            parsed.seasonStart = Date.now();
          }
          parsed.rank = getRank(parsed.currentXP);
          // Ensure mastery fields exist
          if (!parsed.empireXP) parsed.empireXP = { egypt: 0, rome: 0, mongols: 0, ptolemaic: 0, japan: 0 };
          if (!parsed.empireMastery) parsed.empireMastery = { egypt: 1, rome: 1, mongols: 1, ptolemaic: 1, japan: 1 };
          // Migrate: add japan if missing from saved data
          if (!parsed.empireXP.japan) parsed.empireXP.japan = 0;
          if (!parsed.empireMastery.japan) parsed.empireMastery.japan = 1;
          setData(parsed);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (next: RankedData) => {
    setData(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const recordGameResult = useCallback(async (
    won: boolean,
    empireId: EmpireId,
    mapSize: 'small' | 'medium' | 'large',
    elapsedMs: number,
    abilityUsed: boolean,
  ) => {
    setData(prev => {
      const next = { ...prev };
      next.totalGames++;
      let xp = 0;

      if (won) {
        next.totalWins++;
        xp = mapSize === 'large' ? 150 : 100;
        if (elapsedMs < 3 * 60 * 1000) xp += 50; // under 3 min bonus
        if (next.bestTime === null || elapsedMs < next.bestTime) {
          next.bestTime = elapsedMs;
        }
      } else {
        xp = -25;
      }

      const oldRank = getRank(next.currentXP);
      const oldRankMin = RANK_THRESHOLDS.find(r => r.tier === oldRank)!.min;
      next.currentXP = Math.max(oldRankMin, next.currentXP + xp); // never drop below rank floor
      if (next.currentXP < 0) next.currentXP = 0;
      const newRank = getRank(next.currentXP);
      next.rank = newRank;

      // Empire mastery XP (always positive)
      const masteryGain = won ? 80 : 30;
      next.empireXP = { ...next.empireXP };
      next.empireXP[empireId] = (next.empireXP[empireId] || 0) + masteryGain;
      next.empireMastery = { ...next.empireMastery };
      next.empireMastery[empireId] = getMasteryLevel(next.empireXP[empireId]);

      setXpGained(Math.abs(xp));
      if (newRank !== oldRank && RANK_THRESHOLDS.findIndex(r => r.tier === newRank) >
          RANK_THRESHOLDS.findIndex(r => r.tier === oldRank)) {
        setRankedUp(newRank);
      } else {
        setRankedUp(null);
      }

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addXP = useCallback(async (amount: number) => {
    setData(prev => {
      const next = { ...prev };
      next.currentXP = Math.max(0, next.currentXP + amount);
      next.rank = getRank(next.currentXP);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addEmpireMasteryXP = useCallback(async (empireId: EmpireId, amount: number) => {
    setData(prev => {
      const next = { ...prev };
      next.empireXP = { ...next.empireXP };
      next.empireXP[empireId] = (next.empireXP[empireId] || 0) + amount;
      next.empireMastery = { ...next.empireMastery };
      next.empireMastery[empireId] = getMasteryLevel(next.empireXP[empireId]);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRankUpNotif = useCallback(() => setRankedUp(null), []);
  const clearXpGained = useCallback(() => setXpGained(null), []);

  const seasonDaysLeft = Math.max(0, Math.ceil((data.seasonStart + SEASON_DURATION - Date.now()) / (24 * 60 * 60 * 1000)));

  return {
    data, loaded, xpGained, rankedUp, seasonDaysLeft,
    recordGameResult, addXP, addEmpireMasteryXP,
    clearRankUpNotif, clearXpGained,
  };
}
