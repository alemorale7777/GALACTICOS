import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const STORAGE_KEY = '@thraxon_sound';

interface SoundSettings {
  enabled: boolean;
  masterVolume: number; // 0-1
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
};

// Only use Web Audio on web platform
const isWeb = Platform.OS === 'web';

function getAudioContext(): AudioContext | null {
  if (!isWeb) return null;
  try {
    const W = globalThis as any;
    const AC = W.AudioContext || W.webkitAudioContext;
    if (AC) return new AC();
  } catch {}
  return null;
}

export function useSoundEngine() {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS);
  const ctxRef = useRef<AudioContext | null>(null);
  const initRef = useRef(false);
  const ambientRef = useRef<{ gain: GainNode; osc: AudioNode } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      } catch {}
    })();
  }, []);

  const ensureContext = useCallback(() => {
    if (!isWeb) return null;
    if (!ctxRef.current) {
      ctxRef.current = getAudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }, []);

  const vol = useCallback(() => {
    return settings.enabled ? settings.masterVolume * settings.sfxVolume : 0;
  }, [settings]);

  // Simple tone player
  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled) return;
    const v = vol() * volume;
    if (v <= 0) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(v, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }, [ensureContext, settings, vol]);

  const playNoise = useCallback((duration: number, volume = 0.2) => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled) return;
    const v = vol() * volume;
    if (v <= 0) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(v, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }, [ensureContext, settings, vol]);

  const playSequence = useCallback((notes: number[], duration: number, type: OscillatorType = 'sine', volume = 0.3) => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled) return;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const v = vol() * volume;
      const start = ctx.currentTime + i * duration;
      gain.gain.setValueAtTime(v, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration * 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    });
  }, [ensureContext, settings, vol]);

  // ── Sound debounce (prevent audio thread overload) ──────────────────────
  const lastSfxTime = useRef<Record<string, number>>({});
  const debounced = useCallback((key: string, minMs: number, fn: () => void) => {
    const now = Date.now();
    if (now - (lastSfxTime.current[key] || 0) < minMs) return;
    lastSfxTime.current[key] = now;
    fn();
  }, []);

  // ── Sound effects ──────────────────────────────────────────────────────────

  const sfxDispatch = useCallback(() => {
    debounced('dispatch', 50, () => {
      playNoise(0.05, 0.15);
      playTone(600, 0.08, 'sawtooth', 0.1);
    });
  }, [playNoise, playTone, debounced]);

  const sfxCapture = useCallback(() => {
    debounced('capture', 80, () => {
      playTone(523, 0.3, 'sine', 0.25);
      playTone(659, 0.3, 'sine', 0.2);
      playTone(784, 0.3, 'sine', 0.15);
    });
  }, [playTone, debounced]);

  const sfxAbility = useCallback(() => {
    debounced('ability', 200, () => {
      playTone(120, 0.2, 'sine', 0.4);
      playTone(240, 0.15, 'sine', 0.2);
    });
  }, [playTone, debounced]);

  const sfxImpact = useCallback(() => {
    debounced('impact', 50, () => {
      playNoise(0.03, 0.2);
      playTone(200, 0.08, 'square', 0.15);
    });
  }, [playNoise, playTone, debounced]);

  const sfxVictory = useCallback(() => {
    playSequence([523, 587, 659, 698, 784, 880, 988, 1047], 0.1, 'sine', 0.3);
  }, [playSequence]);

  const sfxDefeat = useCallback(() => {
    playSequence([523, 494, 466, 440, 392, 349], 0.2, 'sine', 0.2);
  }, [playSequence]);

  const sfxRankUp = useCallback(() => {
    playSequence([523, 659, 784, 1047, 1319], 0.2, 'square', 0.2);
  }, [playSequence]);

  const sfxChallengeComplete = useCallback(() => {
    playSequence([880, 1047, 1319], 0.12, 'sine', 0.25);
  }, [playSequence]);

  // Empire motifs
  const playEmpireMotif = useCallback((empireId: string) => {
    switch (empireId) {
      case 'egypt':
        playSequence([440, 550, 660, 880], 0.15, 'triangle', 0.2);
        break;
      case 'rome':
        playSequence([261, 329, 392, 523], 0.18, 'square', 0.15);
        break;
      case 'mongols':
        playTone(80, 0.15, 'sine', 0.3);
        setTimeout(() => playSequence([880, 1047, 880], 0.08, 'sine', 0.15), 200);
        break;
      case 'ptolemaic':
        playSequence([523, 659, 784, 1047], 0.2, 'sine', 0.2);
        break;
    }
  }, [playSequence, playTone]);

  // Ambient battlefield hum
  const startAmbient = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled || ambientRef.current) return;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08 * vol(), ctx.currentTime + 2);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    ambientRef.current = { gain, osc: source };
  }, [ensureContext, settings, vol]);

  const stopAmbient = useCallback(() => {
    if (!ambientRef.current) return;
    const ctx = ctxRef.current;
    if (ctx) {
      ambientRef.current.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    }
    setTimeout(() => {
      try { (ambientRef.current?.osc as any)?.stop?.(); } catch {}
      ambientRef.current = null;
    }, 1200);
  }, []);

  // Settings
  const updateSettings = useCallback(async (partial: Partial<SoundSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  return {
    settings, toggleSound, updateSettings,
    sfxDispatch, sfxCapture, sfxAbility, sfxImpact,
    sfxVictory, sfxDefeat, sfxRankUp, sfxChallengeComplete,
    playEmpireMotif, startAmbient, stopAmbient,
    ensureContext,
  };
}
