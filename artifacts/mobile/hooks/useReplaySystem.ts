import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId, MapSize } from '@/constants/empires';

export type ReplayEventType = 'NODE_CAPTURED' | 'FLEET_DISPATCHED' | 'ABILITY_USED' | 'GAME_END';

export interface ReplayEvent {
  t: number; // ms from game start
  type: ReplayEventType;
  data: any;
}

export interface ReplayMeta {
  id: string;
  date: number;
  empire: EmpireId;
  aiEmpire: EmpireId;
  mapSize: MapSize;
  won: boolean;
  durationMs: number;
  nodesCaptures: number;
  events: ReplayEvent[];
}

const STORAGE_KEY = '@thraxon_replays';
const MAX_REPLAYS = 5;

export function useReplaySystem() {
  const [replays, setReplays] = useState<ReplayMeta[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<ReplayEvent[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setReplays(JSON.parse(raw));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const startRecording = useCallback(() => {
    setCurrentRecording([]);
    setRecordingStartTime(Date.now());
  }, []);

  const recordEvent = useCallback((type: ReplayEventType, data: any) => {
    if (recordingStartTime === 0) return;
    const event: ReplayEvent = {
      t: Date.now() - recordingStartTime,
      type,
      data,
    };
    setCurrentRecording(prev => {
      const next = [...prev, event];
      // Cap at reasonable size
      if (next.length > 500) return next.slice(-500);
      return next;
    });
  }, [recordingStartTime]);

  const finishRecording = useCallback(async (
    empire: EmpireId,
    aiEmpire: EmpireId,
    mapSize: MapSize,
    won: boolean,
    durationMs: number,
    nodesCaptures: number,
  ) => {
    const replay: ReplayMeta = {
      id: `replay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      date: Date.now(),
      empire,
      aiEmpire,
      mapSize,
      won,
      durationMs,
      nodesCaptures,
      events: currentRecording,
    };

    const updated = [replay, ...replays].slice(0, MAX_REPLAYS);
    setReplays(updated);
    setCurrentRecording([]);
    setRecordingStartTime(0);

    // Trim to fit 50KB per replay
    const json = JSON.stringify(updated);
    if (json.length > 250000) {
      // Reduce event counts
      const trimmed = updated.map(r => ({
        ...r,
        events: r.events.filter((_, i) => i % 2 === 0), // Keep every other event
      }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)).catch(() => {});
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, json).catch(() => {});
    }

    return replay;
  }, [currentRecording, replays]);

  const getShareText = useCallback((replay: ReplayMeta): string => {
    const mins = Math.floor(replay.durationMs / 60000);
    const secs = Math.floor((replay.durationMs % 60000) / 1000);
    const result = replay.won ? 'conquered' : 'fell in';
    const empireName = replay.empire.charAt(0).toUpperCase() + replay.empire.slice(1);
    return `I ${result} ${replay.nodesCaptures} nodes as ${empireName} in ${mins}:${String(secs).padStart(2, '0')}! Play THRAXON`;
  }, []);

  return {
    replays, loaded, startRecording, recordEvent,
    finishRecording, getShareText,
  };
}
