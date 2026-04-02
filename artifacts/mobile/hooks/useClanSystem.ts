import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = '@thraxon_clan';

export interface ClanData {
  name: string;
  bannerColor: string;
  initials: string;
  inviteCode: string;
  weeklyXP: number;
  weekStart: number;
  memberCount: number;
  founded: number;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function encodeClan(clan: ClanData): string {
  // Simple encoding: base64 of JSON subset
  const payload = { n: clan.name, c: clan.bannerColor, i: clan.initials };
  try {
    return btoa(JSON.stringify(payload));
  } catch {
    return clan.inviteCode;
  }
}

function decodeClan(code: string): { name: string; bannerColor: string; initials: string } | null {
  try {
    const json = atob(code);
    const parsed = JSON.parse(json);
    if (parsed.n && parsed.c && parsed.i) {
      return { name: parsed.n, bannerColor: parsed.c, initials: parsed.i };
    }
  } catch {}
  return null;
}

export function useClanSystem() {
  const [clan, setClan] = useState<ClanData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: ClanData = JSON.parse(raw);
          // Weekly reset check
          const weekMs = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - parsed.weekStart > weekMs) {
            parsed.weeklyXP = 0;
            parsed.weekStart = Date.now();
          }
          setClan(parsed);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (data: ClanData) => {
    setClan(data);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, []);

  const createClan = useCallback(async (name: string, bannerColor: string) => {
    const trimmed = name.trim().slice(0, 16);
    if (!trimmed) return;
    const initials = trimmed.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();
    const newClan: ClanData = {
      name: trimmed,
      bannerColor,
      initials,
      inviteCode: generateCode(),
      weeklyXP: 0,
      weekStart: Date.now(),
      memberCount: 1,
      founded: Date.now(),
    };
    await save(newClan);
    return newClan;
  }, [save]);

  const joinClan = useCallback(async (code: string) => {
    const decoded = decodeClan(code);
    if (!decoded) return false;
    const newClan: ClanData = {
      name: decoded.name,
      bannerColor: decoded.bannerColor,
      initials: decoded.initials,
      inviteCode: code,
      weeklyXP: 0,
      weekStart: Date.now(),
      memberCount: 2,
      founded: Date.now(),
    };
    await save(newClan);
    return true;
  }, [save]);

  const leaveClan = useCallback(async () => {
    setClan(null);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const addClanXP = useCallback(async (amount: number) => {
    if (!clan) return;
    const next = { ...clan, weeklyXP: clan.weeklyXP + amount };
    await save(next);
  }, [clan, save]);

  const getShareCode = useCallback((): string => {
    if (!clan) return '';
    return encodeClan(clan);
  }, [clan]);

  return { clan, loaded, createClan, joinClan, leaveClan, addClanXP, getShareCode };
}
