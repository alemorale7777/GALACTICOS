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

  // iOS audio unlock: resume AudioContext on first user interaction
  const audioUnlockedRef = useRef(false);
  useEffect(() => {
    if (!isWeb) return;
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      if (!ctxRef.current) {
        ctxRef.current = getAudioContext();
      }
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          audioUnlockedRef.current = true;
          // Play silent buffer to fully unlock iOS audio
          const buf = ctx.createBuffer(1, 1, 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(ctx.destination);
          src.start(0);
        }).catch(() => {});
      } else if (ctx) {
        audioUnlockedRef.current = true;
      }
    };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('touchend', unlock, { passive: true });
    document.addEventListener('mousedown', unlock, { passive: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('touchend', unlock);
      document.removeEventListener('mousedown', unlock);
    };
  }, []);

  // Pause/resume audio on visibility change (background/foreground)
  useEffect(() => {
    if (!isWeb) return;
    const handleVisibility = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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

  // ── UI sounds ──────────────────────────────────────────────────────────────

  const sfxTap = useCallback(() => {
    debounced('tap', 30, () => {
      playTone(900, 0.04, 'sine', 0.08);
    });
  }, [playTone, debounced]);

  const sfxSelect = useCallback(() => {
    debounced('select', 80, () => {
      playTone(660, 0.08, 'sine', 0.15);
      playTone(880, 0.12, 'sine', 0.1);
    });
  }, [playTone, debounced]);

  // ── Game sound effects ────────────────────────────────────────────────────

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

  // Empire motifs (all 10 empires)
  const playEmpireMotif = useCallback((empireId: string) => {
    switch (empireId) {
      case 'egypt':
        playSequence([440, 550, 660, 880], 0.15, 'triangle', 0.2); break;
      case 'rome':
        playSequence([261, 329, 392, 523], 0.18, 'square', 0.15); break;
      case 'mongols':
        playTone(80, 0.15, 'sine', 0.3);
        setTimeout(() => playSequence([880, 1047, 880], 0.08, 'sine', 0.15), 200); break;
      case 'ptolemaic':
        playSequence([523, 659, 784, 1047], 0.2, 'sine', 0.2); break;
      case 'japan':
        playSequence([440, 523, 659, 784], 0.12, 'triangle', 0.2); break;
      case 'vikings':
        playTone(100, 0.25, 'sine', 0.35);
        setTimeout(() => playSequence([329, 392, 440], 0.15, 'triangle', 0.2), 300); break;
      case 'aztec':
        playSequence([220, 261, 329, 220], 0.14, 'square', 0.15); break;
      case 'persian':
        playSequence([349, 440, 523, 659], 0.18, 'sine', 0.2); break;
      case 'ottoman':
        playSequence([523, 440, 349, 261], 0.16, 'triangle', 0.18); break;
      case 'han':
        playTone(180, 0.8, 'sine', 0.3); break;
    }
  }, [playSequence, playTone]);

  // ── F11: Empire-specific ability sounds ────────────────────────────────────
  const sfxEmpireAbility = useCallback((empireId: string) => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled) return;
    const v = vol();
    if (v <= 0) return;
    const now = ctx.currentTime;
    switch (empireId) {
      case 'egypt': {
        // Bell-like 440Hz + harmonic
        const o1 = ctx.createOscillator(); const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o1.frequency.value = 440; o1.type = 'sine';
        o2.frequency.value = 880; o2.type = 'sine';
        g.gain.setValueAtTime(v * 0.3, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        o1.connect(g); o2.connect(g); g.connect(ctx.destination);
        o1.start(now); o2.start(now); o1.stop(now + 0.8); o2.stop(now + 0.8);
        break;
      }
      case 'rome': {
        // Brass fanfare chord
        [261, 329, 392].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = freq; o.type = 'square';
          g.gain.setValueAtTime(0, now + i * 0.04);
          g.gain.linearRampToValueAtTime(v * 0.12, now + i * 0.04 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          o.connect(g); g.connect(ctx.destination);
          o.start(now); o.stop(now + 0.5);
        });
        break;
      }
      case 'mongols': {
        // Rumble + high whistle
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(120, now);
        o.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        o.type = 'sine';
        g.gain.setValueAtTime(v * 0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.2);
        const w = ctx.createOscillator(); const wg = ctx.createGain();
        w.frequency.setValueAtTime(1200, now + 0.1);
        w.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        w.type = 'sine';
        wg.gain.setValueAtTime(v * 0.15, now + 0.1);
        wg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        w.connect(wg); wg.connect(ctx.destination); w.start(now + 0.1); w.stop(now + 0.35);
        break;
      }
      case 'ptolemaic': {
        // Ethereal harp arpeggio
        [523, 659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = freq; o.type = 'sine';
          const t = now + i * 0.1;
          g.gain.setValueAtTime(v * 0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.4);
        });
        break;
      }
      case 'japan': {
        // Sword slash sweep
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(800, now);
        o.frequency.exponentialRampToValueAtTime(200, now + 0.15);
        o.type = 'sawtooth';
        g.gain.setValueAtTime(v * 0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.2);
        break;
      }
      case 'vikings': {
        // Deep war drum + frost shimmer
        const d = ctx.createOscillator(); const dg = ctx.createGain();
        d.frequency.setValueAtTime(120, now);
        d.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        d.type = 'sine';
        dg.gain.setValueAtTime(v * 0.5, now);
        dg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        d.connect(dg); dg.connect(ctx.destination); d.start(now); d.stop(now + 0.25);
        const s = ctx.createOscillator(); const sg = ctx.createGain();
        s.frequency.value = 2000; s.type = 'triangle';
        sg.gain.setValueAtTime(v * 0.06, now + 0.1);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        s.connect(sg); sg.connect(ctx.destination); s.start(now + 0.1); s.stop(now + 0.5);
        break;
      }
      case 'aztec': {
        // Ritual drum pattern
        [0, 0.08, 0.16].forEach(offset => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.setValueAtTime(100, now + offset);
          o.frequency.exponentialRampToValueAtTime(50, now + offset + 0.1);
          o.type = 'sine';
          g.gain.setValueAtTime(v * 0.4, now + offset);
          g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
          o.connect(g); g.connect(ctx.destination);
          o.start(now + offset); o.stop(now + offset + 0.15);
        });
        break;
      }
      case 'persian': {
        // Mystical rising tone
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(200, now);
        o.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        o.type = 'sine';
        g.gain.setValueAtTime(v * 0.2, now);
        g.gain.setValueAtTime(v * 0.2, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 0.6);
        break;
      }
      case 'ottoman': {
        // Resonant call: 3 descending tones
        [523, 440, 349].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.frequency.value = freq; o.type = 'triangle';
          const t = now + i * 0.12;
          g.gain.setValueAtTime(v * 0.18, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.3);
        });
        break;
      }
      case 'han': {
        // Imperial gong
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.setValueAtTime(180, now);
        o.frequency.exponentialRampToValueAtTime(160, now + 1.0);
        o.type = 'sine';
        g.gain.setValueAtTime(v * 0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now + 1.2);
        break;
      }
    }
  }, [ensureContext, settings, vol]);

  // ── F10: Adaptive music system ─────────────────────────────────────────────
  const musicRef = useRef<{
    baseDrone: OscillatorNode | null;
    baseDroneGain: GainNode | null;
    tensionDrone: OscillatorNode | null;
    tensionGain: GainNode | null;
    victoryHarmonic: OscillatorNode | null;
    victoryGain: GainNode | null;
    running: boolean;
  }>({ baseDrone: null, baseDroneGain: null, tensionDrone: null, tensionGain: null, victoryHarmonic: null, victoryGain: null, running: false });

  const startMusic = useCallback(() => {
    const ctx = ensureContext();
    if (!ctx || !settings.enabled || musicRef.current.running) return;
    const mv = vol() * 0.15;
    // Base drone 55Hz
    const bd = ctx.createOscillator(); const bdg = ctx.createGain();
    bd.frequency.value = 55; bd.type = 'sine';
    bdg.gain.value = mv * 0.8;
    bd.connect(bdg); bdg.connect(ctx.destination); bd.start();
    // Tension 82Hz
    const td = ctx.createOscillator(); const tg = ctx.createGain();
    td.frequency.value = 82; td.type = 'triangle';
    tg.gain.value = 0;
    td.connect(tg); tg.connect(ctx.destination); td.start();
    // Victory 220Hz
    const vh = ctx.createOscillator(); const vg = ctx.createGain();
    vh.frequency.value = 220; vh.type = 'sine';
    vg.gain.value = 0;
    vh.connect(vg); vg.connect(ctx.destination); vh.start();

    musicRef.current = { baseDrone: bd, baseDroneGain: bdg, tensionDrone: td, tensionGain: tg, victoryHarmonic: vh, victoryGain: vg, running: true };
  }, [ensureContext, settings, vol]);

  const updateMusic = useCallback((playerPercent: number, activeCombat: boolean) => {
    const m = musicRef.current;
    if (!m.running) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    const mv = vol() * 0.15;
    // Tension builds when losing
    const tensionLevel = playerPercent < 0.40 ? (0.40 - playerPercent) / 0.40 * mv * 0.8 : 0;
    m.tensionGain?.gain.linearRampToValueAtTime(tensionLevel, now + 3);
    // Victory builds when winning
    const victoryLevel = playerPercent > 0.65 ? (playerPercent - 0.65) / 0.35 * mv * 0.6 : 0;
    m.victoryGain?.gain.linearRampToValueAtTime(victoryLevel, now + 3);
    // Beat pulse during combat
    const baseLevel = activeCombat ? mv * 1.2 : mv * 0.8;
    m.baseDroneGain?.gain.linearRampToValueAtTime(baseLevel, now + 1);
  }, [vol]);

  const stopMusic = useCallback(() => {
    const m = musicRef.current;
    if (!m.running) return;
    try { m.baseDrone?.stop(); } catch {}
    try { m.tensionDrone?.stop(); } catch {}
    try { m.victoryHarmonic?.stop(); } catch {}
    musicRef.current.running = false;
  }, []);

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
    sfxTap, sfxSelect,
    sfxDispatch, sfxCapture, sfxAbility, sfxImpact,
    sfxVictory, sfxDefeat, sfxRankUp, sfxChallengeComplete,
    playEmpireMotif, sfxEmpireAbility,
    startAmbient, stopAmbient,
    startMusic, updateMusic, stopMusic,
    ensureContext,
  };
}
