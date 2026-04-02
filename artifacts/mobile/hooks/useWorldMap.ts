import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId } from '@/constants/empires';

const STORAGE_KEY = '@thraxon_worldmap';
const TERRITORY_COUNT = 50;
const MONTHLY_RESET_MS = 30 * 24 * 60 * 60 * 1000;

export interface WorldMapData {
  territories: (EmpireId | null)[]; // index = territory id, value = owner
  lastReset: number;
}

// Simplified continent-style territory positions (x%, y%, name)
export const TERRITORY_POSITIONS: { x: number; y: number; name: string; continent: string }[] = [
  // Europe (10)
  { x: 48, y: 22, name: 'Britannia', continent: 'Europe' },
  { x: 51, y: 28, name: 'Gaul', continent: 'Europe' },
  { x: 53, y: 32, name: 'Iberia', continent: 'Europe' },
  { x: 55, y: 25, name: 'Germania', continent: 'Europe' },
  { x: 54, y: 30, name: 'Italia', continent: 'Europe' },
  { x: 57, y: 28, name: 'Dacia', continent: 'Europe' },
  { x: 56, y: 33, name: 'Graecia', continent: 'Europe' },
  { x: 59, y: 26, name: 'Sarmatia', continent: 'Europe' },
  { x: 50, y: 26, name: 'Belgica', continent: 'Europe' },
  { x: 52, y: 24, name: 'Scandia', continent: 'Europe' },
  // Africa (10)
  { x: 52, y: 42, name: 'Carthage', continent: 'Africa' },
  { x: 55, y: 45, name: 'Cyrenaica', continent: 'Africa' },
  { x: 52, y: 50, name: 'Numidia', continent: 'Africa' },
  { x: 56, y: 52, name: 'Aegyptus', continent: 'Africa' },
  { x: 50, y: 55, name: 'Mauretania', continent: 'Africa' },
  { x: 54, y: 58, name: 'Kush', continent: 'Africa' },
  { x: 52, y: 62, name: 'Axum', continent: 'Africa' },
  { x: 48, y: 58, name: 'Ghana', continent: 'Africa' },
  { x: 56, y: 65, name: 'Punt', continent: 'Africa' },
  { x: 50, y: 48, name: 'Libya', continent: 'Africa' },
  // Asia (15)
  { x: 62, y: 30, name: 'Anatolia', continent: 'Asia' },
  { x: 65, y: 33, name: 'Syria', continent: 'Asia' },
  { x: 64, y: 37, name: 'Mesopotamia', continent: 'Asia' },
  { x: 67, y: 35, name: 'Persia', continent: 'Asia' },
  { x: 63, y: 40, name: 'Arabia', continent: 'Asia' },
  { x: 70, y: 30, name: 'Bactria', continent: 'Asia' },
  { x: 73, y: 35, name: 'Gandhara', continent: 'Asia' },
  { x: 76, y: 38, name: 'India', continent: 'Asia' },
  { x: 72, y: 25, name: 'Sogdiana', continent: 'Asia' },
  { x: 78, y: 28, name: 'Serica', continent: 'Asia' },
  { x: 80, y: 32, name: 'Cathay', continent: 'Asia' },
  { x: 75, y: 22, name: 'Mongolia', continent: 'Asia' },
  { x: 82, y: 36, name: 'Nippon', continent: 'Asia' },
  { x: 68, y: 28, name: 'Armenia', continent: 'Asia' },
  { x: 71, y: 40, name: 'Lanka', continent: 'Asia' },
  // Americas (10)
  { x: 25, y: 25, name: 'Vinland', continent: 'Americas' },
  { x: 22, y: 32, name: 'Great Plains', continent: 'Americas' },
  { x: 28, y: 35, name: 'Appalachia', continent: 'Americas' },
  { x: 20, y: 40, name: 'Aztlan', continent: 'Americas' },
  { x: 25, y: 45, name: 'Maya', continent: 'Americas' },
  { x: 30, y: 50, name: 'Caribbean', continent: 'Americas' },
  { x: 32, y: 58, name: 'Amazonia', continent: 'Americas' },
  { x: 30, y: 65, name: 'Inca', continent: 'Americas' },
  { x: 33, y: 72, name: 'Patagonia', continent: 'Americas' },
  { x: 28, y: 55, name: 'Muisca', continent: 'Americas' },
  // Oceania (5)
  { x: 82, y: 60, name: 'Terra Australis', continent: 'Oceania' },
  { x: 85, y: 55, name: 'Aotearoa', continent: 'Oceania' },
  { x: 80, y: 50, name: 'Majapahit', continent: 'Oceania' },
  { x: 78, y: 45, name: 'Siam', continent: 'Oceania' },
  { x: 84, y: 48, name: 'Polynesia', continent: 'Oceania' },
];

const DEFAULT_DATA: WorldMapData = {
  territories: new Array(TERRITORY_COUNT).fill(null),
  lastReset: Date.now(),
};

export function useWorldMap() {
  const [data, setData] = useState<WorldMapData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: WorldMapData = JSON.parse(raw);
          // Monthly reset check
          if (Date.now() - parsed.lastReset > MONTHLY_RESET_MS) {
            const reset = { ...DEFAULT_DATA, lastReset: Date.now() };
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
            setData(reset);
          } else {
            setData(parsed);
          }
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const claimTerritories = useCallback(async (empireId: EmpireId, count: number) => {
    setData(prev => {
      const next = { ...prev, territories: [...prev.territories] };
      // First try to claim unclaimed territories
      const unclaimed = next.territories
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t === null);
      // Then contest enemy territories
      const contested = next.territories
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => t !== null && t !== empireId);

      let remaining = count;
      // Shuffle and claim
      const pool = [...unclaimed, ...contested].sort(() => Math.random() - 0.5);
      for (const { i } of pool) {
        if (remaining <= 0) break;
        next.territories[i] = empireId;
        remaining--;
      }

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getTerritoryCounts = useCallback((): Record<EmpireId | 'neutral', number> => {
    const counts: Record<string, number> = { egypt: 0, rome: 0, mongols: 0, ptolemaic: 0, neutral: 0 };
    for (const t of data.territories) {
      if (t === null) counts.neutral++;
      else counts[t]++;
    }
    return counts as Record<EmpireId | 'neutral', number>;
  }, [data]);

  const getPlayerTerritoryCount = useCallback((empireId: EmpireId): number => {
    return data.territories.filter(t => t === empireId).length;
  }, [data]);

  // Passive bonuses
  const getBonuses = useCallback((empireId: EmpireId): { genBonus: number; cdReduction: number; speedBonus: number } => {
    const count = getPlayerTerritoryCount(empireId);
    return {
      genBonus: count >= 10 ? 0.05 : 0,
      cdReduction: count >= 20 ? 0.10 : 0,
      speedBonus: count >= 30 ? 0.05 : 0,
    };
  }, [getPlayerTerritoryCount]);

  return { data, loaded, claimTerritories, getTerritoryCounts, getPlayerTerritoryCount, getBonuses };
}
