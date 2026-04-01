import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId, EMPIRE_IDS } from '@/constants/empires';

const STORAGE_KEY = '@galacticos_tournament';

export interface TournamentCompetitor {
  name: string;
  empire: EmpireId;
  isPlayer: boolean;
  difficultyMod: number; // AI speed modifier
}

export interface TournamentMatch {
  round: number; // 0=quarterfinals, 1=semis, 2=final
  index: number; // position in round
  competitor1: TournamentCompetitor | null;
  competitor2: TournamentCompetitor | null;
  winner: 'c1' | 'c2' | null;
  score?: string; // "12 nodes"
}

export interface TournamentData {
  active: boolean;
  startTime: number;
  bracket: TournamentMatch[];
  currentRound: number;
  currentMatch: number;
  playerEliminated: boolean;
  placement: number | null; // 1-8
  completed: boolean;
  rewarded: boolean;
}

const AI_NAMES = ['Hannibal', 'Alexander', 'Saladin', 'Attila', 'Sun Tzu', 'Napoleon', 'Shaka'];
const AI_DIFFICULTIES = [0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.3];

function isTournamentTime(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = now.getHours();
  if (day === 5 && hour >= 18) return true; // Friday 6pm+
  if (day === 6) return true; // All Saturday
  if (day === 0) return true; // All Sunday
  return false;
}

function msUntilNextTournament(): number {
  const now = new Date();
  const day = now.getDay();
  let daysUntilFriday = (5 - day + 7) % 7;
  // If it's Friday before 6pm, tournament starts today
  // If it's Friday after 6pm or weekend, next tournament is next Friday
  if (daysUntilFriday === 0) {
    if (now.getHours() >= 18) {
      // It's Friday 6pm+ (tournament active), next one is 7 days
      daysUntilFriday = 7;
    }
    // else it's Friday before 6pm, tournament starts today
  }
  // If it's Sat/Sun (tournament active), next is next Friday
  if (isTournamentTime() && daysUntilFriday < 5) {
    daysUntilFriday = (5 - day + 7) % 7;
    if (daysUntilFriday === 0) daysUntilFriday = 7;
  }
  const nextFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilFriday, 18, 0, 0);
  return Math.max(0, nextFriday.getTime() - now.getTime());
}

function generateBracket(): { competitors: TournamentCompetitor[]; bracket: TournamentMatch[] } {
  const empires = [...EMPIRE_IDS, ...EMPIRE_IDS].sort(() => Math.random() - 0.5).slice(0, 8);
  const playerIdx = Math.floor(Math.random() * 8);
  const competitors: TournamentCompetitor[] = [];
  let aiIdx = 0;

  for (let i = 0; i < 8; i++) {
    if (i === playerIdx) {
      competitors.push({ name: 'You', empire: empires[i], isPlayer: true, difficultyMod: 1.0 });
    } else {
      competitors.push({
        name: AI_NAMES[aiIdx],
        empire: empires[i],
        isPlayer: false,
        difficultyMod: AI_DIFFICULTIES[aiIdx],
      });
      aiIdx++;
    }
  }

  const bracket: TournamentMatch[] = [];
  // Quarterfinals (4 matches)
  for (let i = 0; i < 4; i++) {
    bracket.push({
      round: 0, index: i,
      competitor1: competitors[i * 2],
      competitor2: competitors[i * 2 + 1],
      winner: null,
    });
  }
  // Semifinals (2 matches)
  for (let i = 0; i < 2; i++) {
    bracket.push({ round: 1, index: i, competitor1: null, competitor2: null, winner: null });
  }
  // Final (1 match)
  bracket.push({ round: 2, index: 0, competitor1: null, competitor2: null, winner: null });

  return { competitors, bracket };
}

export function useTournament() {
  const [data, setData] = useState<TournamentData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: TournamentData = JSON.parse(raw);
          // Check if tournament time has passed
          if (parsed.active && !isTournamentTime() && !parsed.completed) {
            parsed.completed = true;
            parsed.playerEliminated = true;
          }
          setData(parsed);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (d: TournamentData) => {
    setData(d);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(d)).catch(() => {});
  }, []);

  const startTournament = useCallback(async () => {
    const { bracket } = generateBracket();
    const newData: TournamentData = {
      active: true,
      startTime: Date.now(),
      bracket,
      currentRound: 0,
      currentMatch: 0,
      playerEliminated: false,
      placement: null,
      completed: false,
      rewarded: false,
    };
    await save(newData);
    return newData;
  }, [save]);

  const getPlayerMatch = useCallback((): TournamentMatch | null => {
    if (!data || data.playerEliminated || data.completed) return null;
    return data.bracket.find(m =>
      m.round === data.currentRound && m.winner === null &&
      ((m.competitor1?.isPlayer) || (m.competitor2?.isPlayer))
    ) ?? null;
  }, [data]);

  const resolveMatch = useCallback(async (playerWon: boolean, nodesCaptures?: number) => {
    if (!data) return;
    const next = { ...data, bracket: data.bracket.map(m => ({ ...m })) };

    // Find player's current match
    const matchIdx = next.bracket.findIndex(m =>
      m.round === next.currentRound && m.winner === null &&
      ((m.competitor1?.isPlayer) || (m.competitor2?.isPlayer))
    );

    if (matchIdx === -1) return;
    const match = next.bracket[matchIdx];
    const playerIsC1 = match.competitor1?.isPlayer;

    match.winner = playerWon ? (playerIsC1 ? 'c1' : 'c2') : (playerIsC1 ? 'c2' : 'c1');
    match.score = nodesCaptures ? `${nodesCaptures} nodes` : undefined;

    if (!playerWon) {
      next.playerEliminated = true;
      // Determine placement
      if (next.currentRound === 0) next.placement = 5; // lost in quarters
      else if (next.currentRound === 1) next.placement = 3; // lost in semis
      else next.placement = 2; // lost in final
    }

    // Resolve AI-only matches in this round
    const roundMatches = next.bracket.filter(m => m.round === next.currentRound);
    for (const m of roundMatches) {
      if (m.winner === null && m.competitor1 && m.competitor2) {
        // Auto-resolve: higher difficulty modifier wins more often
        const c1Chance = m.competitor1.difficultyMod / (m.competitor1.difficultyMod + m.competitor2.difficultyMod);
        m.winner = Math.random() < c1Chance ? 'c1' : 'c2';
        m.score = `${Math.floor(8 + Math.random() * 8)} nodes`;
      }
    }

    // Advance winners to next round
    if (next.currentRound < 2) {
      const nextRound = next.currentRound + 1;
      const nextRoundMatches = next.bracket.filter(m => m.round === nextRound);
      const currentRoundMatches = next.bracket.filter(m => m.round === next.currentRound);

      for (let i = 0; i < nextRoundMatches.length; i++) {
        const m1 = currentRoundMatches[i * 2];
        const m2 = currentRoundMatches[i * 2 + 1];
        if (m1 && m1.winner) {
          nextRoundMatches[i].competitor1 = m1.winner === 'c1' ? m1.competitor1 : m1.competitor2;
        }
        if (m2 && m2.winner) {
          nextRoundMatches[i].competitor2 = m2.winner === 'c1' ? m2.competitor1 : m2.competitor2;
        }
      }

      next.currentRound = nextRound;
    } else {
      // Final completed
      next.completed = true;
      if (playerWon) next.placement = 1;
    }

    await save(next);
  }, [data, save]);

  const getReward = useCallback((): number => {
    if (!data || !data.placement) return 0;
    switch (data.placement) {
      case 1: return 1000;
      case 2: return 500;
      case 3: case 4: return 250;
      default: return 100;
    }
  }, [data]);

  const markRewarded = useCallback(async () => {
    if (!data) return;
    const next = { ...data, rewarded: true };
    await save(next);
  }, [data, save]);

  return {
    data, loaded, isTournamentTime: isTournamentTime(),
    msUntilNextTournament: msUntilNextTournament(),
    startTournament, getPlayerMatch, resolveMatch,
    getReward, markRewarded,
  };
}
