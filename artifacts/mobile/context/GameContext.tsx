import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GamePhase = 'playing' | 'won' | 'lost';
export type FleetPercent = 25 | 50 | 75;

export interface Planet {
  id: number;
  x: number;
  y: number;
  owner: 0 | 1 | 2;
  units: number;
  radius: number;
}

export interface Fleet {
  id: number;
  fromId: number;
  toId: number;
  units: number;
  owner: 1 | 2;
  progress: number;
  speed: number;
  arc: number;  // perpendicular mid-point offset for curved path
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  owner: 0 | 1 | 2;
}

export interface ConquestFlash {
  id: number;
  x: number;
  y: number;
  t: number;       // 0 → 1 progress
  color: string;   // ring color
  owner: 1 | 2;
}

export interface ImpactFlash {
  id: number;
  x: number;
  y: number;
  t: number;       // 0 → 1 (completes ~280ms)
}

export interface GameState {
  planets: Planet[];
  fleets: Fleet[];
  particles: Particle[];
  conquestFlashes: ConquestFlash[];
  impactFlashes: ImpactFlash[];
  phase: GamePhase;
  abilityCooldown: number;
  gameStartTime: number;
  gameEndTime: number | null;
  difficulty: Difficulty;
  fleetPercent: FleetPercent;
  playerConquestTotal: number;
  enemyConquestTotal: number;
}

let _uid = 0;
function uid(): number {
  return ++_uid;
}

function rng(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function generatePlanets(w: number, h: number): Planet[] {
  const planets: Planet[] = [];
  const positions: { x: number; y: number }[] = [];
  const count = 14;
  const margin = 24;
  const minDist = 78;

  const place = (xMin: number, xMax: number, yMin: number, yMax: number) => {
    let x = 0, y = 0, attempts = 0;
    do {
      x = rng(xMin, xMax);
      y = rng(yMin, yMax);
      attempts++;
    } while (positions.some(p => dist(p.x, p.y, x, y) < minDist) && attempts < 300);
    positions.push({ x, y });
    return { x, y };
  };

  // Player starts bottom-left area
  const playerPos = place(margin, w * 0.45, h * 0.6, h - margin);
  planets.push({ id: 0, ...playerPos, owner: 1, units: 15, radius: 26 });

  // AI starts top-right area
  const aiPos = place(w * 0.55, w - margin, margin, h * 0.4);
  planets.push({ id: 1, ...aiPos, owner: 2, units: 15, radius: 26 });

  // Neutral planets — 3 distinct tiers for visual hierarchy and strategic variety
  // Small (5): quick to capture, low growth
  // Medium (5): moderate                              
  // Large (2): high units, fast growth — powerful prizes
  const tiers = [
    ...Array(5).fill({ rMin: 14, rMax: 17, uMin: 4,  uMax: 9  }),
    ...Array(5).fill({ rMin: 20, rMax: 23, uMin: 9,  uMax: 15 }),
    ...Array(2).fill({ rMin: 27, rMax: 31, uMin: 16, uMax: 24 }),
  ];
  for (let i = 2; i < count; i++) {
    const tier = tiers[i - 2];
    const pos = place(margin, w - margin, margin, h - margin);
    const radius = tier.rMin + Math.random() * (tier.rMax - tier.rMin);
    const units = tier.uMin + Math.floor(Math.random() * (tier.uMax - tier.uMin));
    planets.push({ id: i, ...pos, owner: 0, units, radius });
  }

  return planets;
}

function createState(difficulty: Difficulty, w: number, h: number): GameState {
  return {
    planets: generatePlanets(w, h),
    fleets: [],
    particles: [],
    conquestFlashes: [],
    impactFlashes: [],
    phase: 'playing',
    abilityCooldown: 0,
    gameStartTime: Date.now(),
    gameEndTime: null,
    difficulty,
    fleetPercent: 50,
    playerConquestTotal: 0,
    enemyConquestTotal: 0,
  };
}

function spawnParticles(
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 3.5,
  owner: 0 | 1 | 2 = 0
): Particle[] {
  return Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    return {
      id: uid(),
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      alpha: 0.85 + Math.random() * 0.15,
      color,
      owner,
    };
  });
}

function spawnExplosion(
  x: number, y: number,
  attackColor: string, defenseColor: string,
  attackOwner: 1 | 2
): Particle[] {
  const defOwner: 0 | 1 | 2 = attackOwner === 1 ? 2 : 1;
  return [
    ...spawnParticles(x, y, attackColor, 22, 6.0, attackOwner),
    ...spawnParticles(x, y, defenseColor, 14, 4.2, defOwner),
    ...spawnParticles(x, y, '255,255,255', 10, 7.5, 0),
  ];
}

function resolveCombat(fleet: Fleet, planets: Planet[]): Planet[] {
  return planets.map(p => {
    if (p.id !== fleet.toId) return p;
    if (fleet.owner === p.owner) {
      return { ...p, units: p.units + fleet.units };
    }
    if (fleet.units > p.units) {
      return { ...p, owner: fleet.owner as 0 | 1 | 2, units: fleet.units - p.units };
    }
    return { ...p, units: p.units - fleet.units };
  });
}

function launchFleet(
  state: GameState,
  sourceId: number,
  targetId: number,
  owner: 1 | 2,
  pct = 0.6
): void {
  const src = state.planets.find(p => p.id === sourceId);
  if (!src) return;
  const sendUnits = Math.max(1, Math.floor(src.units * pct));
  if (sendUnits < 1) return;
  state.fleets.push({
    id: uid(),
    fromId: sourceId,
    toId: targetId,
    units: sendUnits,
    owner,
    progress: 0,
    speed: 0.0059 + Math.random() * 0.0016,
    arc: (Math.random() - 0.5) * 130,
  });
  src.units -= sendUnits;
}

function aiTick(state: GameState, dt: number): void {
  const { difficulty } = state;

  const fireProb = difficulty === 'easy' ? 0.0065 : difficulty === 'medium' ? 0.0156 : 0.0312;
  const threshold = difficulty === 'easy' ? 22 : difficulty === 'medium' ? 14 : 8;

  if (Math.random() > fireProb * dt * 60) return;

  const aiPlanets = state.planets.filter(p => p.owner === 2 && p.units > threshold);
  if (aiPlanets.length === 0) return;

  if (difficulty === 'easy') {
    // Random planet → random non-AI target
    const source = aiPlanets[Math.floor(Math.random() * aiPlanets.length)];
    const validTargets = state.planets.filter(p => p.owner !== 2);
    if (validTargets.length === 0) return;
    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
    launchFleet(state, source.id, target.id, 2, 0.6);

  } else if (difficulty === 'medium') {
    // Strongest planet → weakest player or neutral
    const source = aiPlanets.reduce((best, p) => p.units > best.units ? p : best, aiPlanets[0]);
    const playerPlanets = state.planets.filter(p => p.owner === 1);
    const neutralPlanets = state.planets.filter(p => p.owner === 0);
    const pool = playerPlanets.length > 0 && Math.random() < 0.7
      ? playerPlanets
      : neutralPlanets.length > 0 ? neutralPlanets : playerPlanets;
    if (pool.length === 0) return;
    const target = pool.reduce((weakest, p) => p.units < weakest.units ? p : weakest, pool[0]);
    if (target.id === source.id) return;
    launchFleet(state, source.id, target.id, 2, 0.65);

  } else {
    // Hard: coordinate top-2 planets, attack aggressively
    const sorted = [...aiPlanets].sort((a, b) => b.units - a.units);
    const playerPlanets = state.planets.filter(p => p.owner === 1);
    const neutralPlanets = state.planets.filter(p => p.owner === 0);

    // Primary source: strongest planet
    const primary = sorted[0];

    let target: Planet | undefined;

    if (playerPlanets.length > 0) {
      // Prefer attackable player planets (>1.2x advantage)
      const attackable = playerPlanets.filter(p => primary.units > p.units * 1.2);
      if (attackable.length > 0) {
        // Pick the closest attackable planet to primary (saves travel time)
        target = attackable.reduce((best, p) => {
          const dBest = dist(primary.x, primary.y, best.x, best.y);
          const dP = dist(primary.x, primary.y, p.x, p.y);
          return dP < dBest ? p : best;
        }, attackable[0]);
      } else {
        // Target weakest player planet regardless
        target = playerPlanets.reduce((t, p) => p.units < t.units ? p : t, playerPlanets[0]);
      }
    } else if (neutralPlanets.length > 0) {
      // Mop up neutrals — pick the closest one to primary
      target = neutralPlanets.reduce((best, p) => {
        const dBest = dist(primary.x, primary.y, best.x, best.y);
        const dP = dist(primary.x, primary.y, p.x, p.y);
        return dP < dBest ? p : best;
      }, neutralPlanets[0]);
    }

    if (!target || target.id === primary.id) return;
    launchFleet(state, primary.id, target.id, 2, 0.7);

    // Secondary attack: second-strongest planet targets a different weak player/neutral
    if (sorted.length >= 2 && Math.random() < 0.55) {
      const secondary = sorted[1];
      const otherTargets = state.planets.filter(
        p => p.owner !== 2 && p.id !== target!.id && secondary.units > p.units * 1.1
      );
      if (otherTargets.length > 0) {
        const secTarget = otherTargets.reduce((t, p) => p.units < t.units ? p : t, otherTargets[0]);
        if (secTarget.id !== secondary.id) {
          launchFleet(state, secondary.id, secTarget.id, 2, 0.65);
        }
      }
    }

    // Also: occasionally reinforce a weak AI planet from a strong one
    if (Math.random() < 0.25) {
      const weakAI = state.planets.filter(
        p => p.owner === 2 && p.units < 12 && p.id !== primary.id
      );
      if (weakAI.length > 0 && primary.units > 30) {
        const reinforceTarget = weakAI[Math.floor(Math.random() * weakAI.length)];
        launchFleet(state, primary.id, reinforceTarget.id, 2, 0.35);
      }
    }
  }
}

function tick(state: GameState, dt: number): void {
  if (state.phase !== 'playing') return;

  // Planet growth
  for (const p of state.planets) {
    if (p.owner !== 0) {
      const growthRate = (0.018 + (30 - Math.min(p.radius, 30)) * 0.0008) * 1.2;
      p.units = Math.min(p.units + growthRate * dt * 60, 999);
    }
  }

  // Move fleets (with ease-in: 70% → 100% speed over first 0.3s of travel)
  const arrived: Fleet[] = [];
  const remaining: Fleet[] = [];
  for (const f of state.fleets) {
    const accel = Math.min(1.0, 0.70 + f.progress / 0.30 * 0.30);
    const newProgress = f.progress + f.speed * accel * dt * 60;
    if (newProgress >= 1) {
      arrived.push(f);
    } else {
      f.progress = newProgress;
      remaining.push(f);
    }
  }
  state.fleets = remaining;

  // Resolve arrivals
  for (const fleet of arrived) {
    const targetBefore = state.planets.find(p => p.id === fleet.toId);
    state.planets = resolveCombat(fleet, state.planets);
    const targetAfter = state.planets.find(p => p.id === fleet.toId);

    if (targetAfter && targetBefore) {
      // Fantasy palette: emerald green / crimson / parchment
      const attackColor = fleet.owner === 1 ? '68,238,102' : '238,51,68';
      const defColor =
        targetBefore.owner === 0 ? '187,153,85'
        : targetBefore.owner === 1 ? '68,238,102'
        : '238,51,68';

      const wasConquest = targetBefore.owner !== fleet.owner;
      if (wasConquest) {
        if (fleet.owner === 1) state.playerConquestTotal++;
        else state.enemyConquestTotal++;
        state.particles.push(...spawnExplosion(targetAfter.x, targetAfter.y, attackColor, defColor, fleet.owner));
        // Large conquest flash ring
        state.conquestFlashes.push({
          id: uid(),
          x: targetAfter.x,
          y: targetAfter.y,
          t: 0,
          color: fleet.owner === 1 ? '#44EE66' : '#EE3344',
          owner: fleet.owner,
        });
      } else {
        // Non-capture hit: particles + quick impact ring
        state.particles.push(...spawnParticles(targetAfter.x, targetAfter.y, attackColor, 10, 2.5, fleet.owner));
        state.impactFlashes.push({ id: uid(), x: targetAfter.x, y: targetAfter.y, t: 0 });
      }
    }
  }

  // AI
  aiTick(state, dt);

  // Cooldown
  if (state.abilityCooldown > 0) {
    state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);
  }

  // Particles
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.022;
    p.vx *= 0.97;
    p.vy *= 0.97;
  }
  state.particles = state.particles.filter(p => p.alpha > 0);
  if (state.particles.length > 130) state.particles = state.particles.slice(-130);

  // Conquest flashes (expand over ~600ms)
  for (const cf of state.conquestFlashes) {
    cf.t += dt * 1.6;
  }
  state.conquestFlashes = state.conquestFlashes.filter(cf => cf.t < 1);

  // Impact flashes (quick hit ring, completes ~280ms)
  for (const inf of state.impactFlashes) {
    inf.t += dt * 3.6;
  }
  state.impactFlashes = state.impactFlashes.filter(inf => inf.t < 1);

  // Win/loss check
  const playerPlanets = state.planets.filter(p => p.owner === 1).length;
  const enemyPlanets = state.planets.filter(p => p.owner === 2).length;
  const playerFleets = state.fleets.filter(f => f.owner === 1).length;
  const enemyFleets = state.fleets.filter(f => f.owner === 2).length;

  if (playerPlanets === 0 && playerFleets === 0) {
    state.phase = 'lost';
    state.gameEndTime = Date.now();
  } else if (enemyPlanets === 0 && enemyFleets === 0) {
    state.phase = 'won';
    state.gameEndTime = Date.now();
  }
}

interface GameContextType {
  state: GameState;
  sendFleet: (fromId: number, toId: number) => void;
  sendFleetFromAll: (toId: number) => void;
  useAbility: () => void;
  resetGame: (difficulty?: Difficulty, w?: number, h?: number) => void;
  setFleetPercent: (pct: FleetPercent) => void;
  setDimensions: (w: number, h: number) => void;
}

const GameContext = createContext<GameContextType | null>(null);

interface GameProviderProps {
  children: React.ReactNode;
  initialDifficulty?: Difficulty;
  playWidth?: number;
  playHeight?: number;
}

export function GameProvider({
  children,
  initialDifficulty = 'medium',
  playWidth = 375,
  playHeight = 600,
}: GameProviderProps) {
  const gameRef = useRef<GameState>(createState(initialDifficulty, playWidth, playHeight));
  const [, forceRender] = useReducer(x => x + 1, 0);
  const dimensionsRef = useRef({ w: playWidth, h: playHeight });

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);

  const startLoop = useCallback(() => {
    const loop = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      tick(gameRef.current, dt);
      forceRender();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    startLoop();
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [startLoop]);

  const sendFleet = useCallback((fromId: number, toId: number) => {
    const state = gameRef.current;
    if (state.phase !== 'playing') return;
    const from = state.planets.find(p => p.id === fromId);
    if (!from || from.owner !== 1 || from.units < 2) return;
    const sendUnits = Math.max(1, Math.floor(from.units * (state.fleetPercent / 100)));
    state.fleets.push({
      id: uid(),
      fromId,
      toId,
      units: sendUnits,
      owner: 1,
      progress: 0,
      speed: 0.00756,
      arc: (Math.random() - 0.5) * 110,
    });
    from.units -= sendUnits;
    forceRender();
  }, []);

  const sendFleetFromAll = useCallback((toId: number) => {
    const state = gameRef.current;
    if (state.phase !== 'playing') return;
    const playerPlanets = state.planets.filter(
      p => p.owner === 1 && p.units >= 2 && p.id !== toId
    );
    if (playerPlanets.length === 0) return;
    for (const planet of playerPlanets) {
      const sendUnits = Math.max(1, Math.floor(planet.units * (state.fleetPercent / 100)));
      state.fleets.push({
        id: uid(),
        fromId: planet.id,
        toId,
        units: sendUnits,
        owner: 1,
        progress: 0,
        speed: 0.00756,
        arc: (Math.random() - 0.5) * 110,
      });
      planet.units -= sendUnits;
    }
    forceRender();
  }, []);

  const useAbility = useCallback(() => {
    const state = gameRef.current;
    if (state.phase !== 'playing' || state.abilityCooldown > 0) return;
    for (const p of state.planets) {
      if (p.owner === 1) {
        p.units = Math.min(p.units * 2, 999);
        state.particles.push(
          ...spawnParticles(p.x, p.y, '0,255,176', 20, 6),
          ...spawnParticles(p.x, p.y, '0,200,255', 14, 4),
          ...spawnParticles(p.x, p.y, '255,255,255', 8, 7),
        );
      }
    }
    state.abilityCooldown = 22;
    forceRender();
  }, []);

  const dimensionsSetRef = useRef(false);

  const resetGame = useCallback((difficulty?: Difficulty, w?: number, h?: number) => {
    const d = difficulty ?? gameRef.current.difficulty;
    const useW = w ?? dimensionsRef.current.w;
    const useH = h ?? dimensionsRef.current.h;
    cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = null;
    dimensionsSetRef.current = false;
    gameRef.current = createState(d, useW, useH);
    // Re-generate with actual dimensions immediately
    if (useW !== 375 || useH !== 600) {
      dimensionsSetRef.current = true;
      gameRef.current.planets = generatePlanets(useW, useH);
    }
    forceRender();
    startLoop();
  }, [startLoop]);

  const setFleetPercent = useCallback((pct: FleetPercent) => {
    gameRef.current.fleetPercent = pct;
    forceRender();
  }, []);

  const setDimensions = useCallback((w: number, h: number) => {
    dimensionsRef.current = { w, h };
    if (!dimensionsSetRef.current && gameRef.current.phase === 'playing') {
      dimensionsSetRef.current = true;
      gameRef.current.planets = generatePlanets(w, h);
      forceRender();
    }
  }, []);

  const ctx: GameContextType = {
    state: gameRef.current,
    sendFleet,
    sendFleetFromAll,
    useAbility,
    resetGame,
    setFleetPercent,
    setDimensions,
  };

  return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
