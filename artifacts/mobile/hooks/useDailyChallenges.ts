import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId, EMPIRE_IDS } from '@/constants/empires';

export interface Challenge {
  id: string;
  description: string;
  xpReward: number;
  masteryReward: number;
  target: number;
  progress: number;
  completed: boolean;
  type: ChallengeType;
  empire?: EmpireId;
}

type ChallengeType =
  | 'win_as_empire'
  | 'capture_barracks'
  | 'win_domination'
  | 'win_fast'
  | 'win_no_ability'
  | 'capture_capital'
  | 'win_75_only'
  | 'win_streak';

interface ChallengeTemplate {
  type: ChallengeType;
  description: string | ((empire: EmpireId) => string);
  xpReward: number;
  masteryReward: number;
  target: number;
  needsEmpire?: boolean;
}

const CHALLENGE_POOL: ChallengeTemplate[] = [
  { type: 'win_as_empire', description: (e) => `Win 2 games as ${e.charAt(0).toUpperCase() + e.slice(1)}`, xpReward: 200, masteryReward: 50, target: 2, needsEmpire: true },
  { type: 'capture_barracks', description: 'Capture 5 Barracks nodes in one game', xpReward: 150, masteryReward: 0, target: 5 },
  { type: 'win_domination', description: 'Win a Domination map', xpReward: 300, masteryReward: 0, target: 1 },
  { type: 'win_fast', description: 'Win in under 4 minutes', xpReward: 250, masteryReward: 0, target: 1 },
  { type: 'win_no_ability', description: 'Win without using your ability', xpReward: 200, masteryReward: 0, target: 1 },
  { type: 'capture_capital', description: 'Capture the enemy Capital', xpReward: 200, masteryReward: 0, target: 1 },
  { type: 'win_75_only', description: 'Win with 75% army setting only', xpReward: 150, masteryReward: 0, target: 1 },
  { type: 'win_streak', description: 'Win 3 games in a row', xpReward: 400, masteryReward: 0, target: 3 },
];

const STORAGE_KEY = '@thraxon_dailies';

interface DailyChallengeData {
  date: string; // YYYY-MM-DD
  challenges: Challenge[];
  streakCount: number;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime();
}

function generateDailyChallenges(): Challenge[] {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, 3);
  return picked.map((t, i) => {
    const empire = t.needsEmpire ? EMPIRE_IDS[Math.floor(Math.random() * EMPIRE_IDS.length)] : undefined;
    return {
      id: `daily_${i}_${t.type}`,
      description: typeof t.description === 'function' ? t.description(empire!) : t.description,
      xpReward: t.xpReward,
      masteryReward: t.masteryReward,
      target: t.target,
      progress: 0,
      completed: false,
      type: t.type,
      empire,
    };
  });
}

export function useDailyChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [completedNow, setCompletedNow] = useState<string | null>(null);
  const [streakCount, setStreakCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const today = todayStr();
        if (raw) {
          const parsed: DailyChallengeData = JSON.parse(raw);
          if (parsed.date === today) {
            setChallenges(parsed.challenges);
            setStreakCount(parsed.streakCount || 0);
            setLoaded(true);
            return;
          }
        }
        // New day — generate fresh challenges
        const newChallenges = generateDailyChallenges();
        const data: DailyChallengeData = { date: today, challenges: newChallenges, streakCount: 0 };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setChallenges(newChallenges);
        setStreakCount(0);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (chals: Challenge[], streak: number) => {
    setChallenges(chals);
    setStreakCount(streak);
    const data: DailyChallengeData = { date: todayStr(), challenges: chals, streakCount: streak };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, []);

  const checkGameResult = useCallback((
    won: boolean,
    empireId: EmpireId,
    mapSize: 'small' | 'medium' | 'large',
    elapsedMs: number,
    abilityUsed: boolean,
    barracksCaptures: number,
    capitalCaptured: boolean,
    usedOnly75: boolean,
  ): { xpEarned: number; masteryEarned: number; completedIds: string[] } => {
    let xpEarned = 0;
    let masteryEarned = 0;
    const completedIds: string[] = [];
    const newStreak = won ? streakCount + 1 : 0;

    const updated = challenges.map(c => {
      if (c.completed) return c;
      let newProgress = c.progress;

      switch (c.type) {
        case 'win_as_empire':
          if (won && empireId === c.empire) newProgress++;
          break;
        case 'capture_barracks':
          newProgress = Math.max(c.progress, barracksCaptures);
          break;
        case 'win_domination':
          if (won && mapSize === 'large') newProgress = 1;
          break;
        case 'win_fast':
          if (won && elapsedMs < 4 * 60 * 1000) newProgress = 1;
          break;
        case 'win_no_ability':
          if (won && !abilityUsed) newProgress = 1;
          break;
        case 'capture_capital':
          if (capitalCaptured) newProgress = 1;
          break;
        case 'win_75_only':
          if (won && usedOnly75) newProgress = 1;
          break;
        case 'win_streak':
          newProgress = newStreak;
          break;
      }

      const nowComplete = newProgress >= c.target && !c.completed;
      if (nowComplete) {
        xpEarned += c.xpReward;
        masteryEarned += c.masteryReward;
        completedIds.push(c.id);
        setCompletedNow(c.description);
      }

      return { ...c, progress: newProgress, completed: newProgress >= c.target };
    });

    save(updated, newStreak);
    return { xpEarned, masteryEarned, completedIds };
  }, [challenges, streakCount, save]);

  const clearCompletedNotif = useCallback(() => setCompletedNow(null), []);

  return {
    challenges, loaded, completedNow, streakCount,
    msUntilMidnight: msUntilMidnight(),
    checkGameResult, clearCompletedNotif,
  };
}
