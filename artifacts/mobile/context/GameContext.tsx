import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { EmpireId, GameMode, MapSize, EMPIRE_CONFIG, MAP_SIZE_CONFIG } from '@/constants/empires';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GamePhase = 'playing' | 'won' | 'lost';
export type FleetPercent = 25 | 50 | 75;
export type NodeType = 'standard' | 'fortress' | 'barracks' | 'capital' | 'watchtower' | 'ruins';

// Growth rate multiplier per node type
const GROWTH_MULT: Record<NodeType, number> = {
  standard: 1.0,
  fortress: 0.6,
  barracks: 1.8,
  capital: 1.5,
  watchtower: 1.0,
  ruins: 0.3,
};

// Defense multiplier — attacker effective units divided by this
const DEFENSE_MULT: Record<NodeType, number> = {
  standard: 1.0,
  fortress: 1.5,
  barracks: 1.0,
  capital: 1.0,
  watchtower: 1.0,
  ruins: 0.5,
};

export interface Planet {
  id: number;
  x: number;
  y: number;
  owner: 0 | 1 | 2;
  units: number;
  radius: number;
  nodeType: NodeType;
  ruinsTimer: number; // seconds until ruins→barracks transform; 0 = inactive
}

export interface Fleet {
  id: number;
  fromId: number;
  toId: number;
  units: number;
  owner: 1 | 2;
  progress: number;
  speed: number; // progress per second
  arc: number;
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
  active: boolean;
}

export interface ConquestFlash {
  id: number;
  x: number;
  y: number;
  t: number;
  color: string;
  owner: 1 | 2;
}

export interface ImpactFlash {
  id: number;
  x: number;
  y: number;
  t: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  t: number; // 0→1 lifetime
  size: number; // font size
}

export interface NodeHit {
  id: number;
  nodeId: number;
  t: number; // 0→1
}

export interface GameState {
  planets: Planet[];
  fleets: Fleet[];
  particles: Particle[];
  conquestFlashes: ConquestFlash[];
  impactFlashes: ImpactFlash[];
  floatingTexts: FloatingText[];
  nodeHits: NodeHit[];
  phase: GamePhase;
  gameStartTime: number;
  gameEndTime: number | null;
  difficulty: Difficulty;
  fleetPercent: FleetPercent;
  playerConquestTotal: number;
  enemyConquestTotal: number;
  // New fields
  mapSize: MapSize;
  playerEmpireId: EmpireId | null;
  aiEmpireId: EmpireId | null;
  abilityCooldown: number;
  abilityActive: boolean;
  abilityActiveTimer: number;
  // AI ability (separate from player)
  aiAbilityCooldown: number;
  aiAbilityActive: boolean;
  aiAbilityActiveTimer: number;
  fogEnabled: boolean;
  mirageOffsets: Record<number, number>;
  playerStreak: number; // win streak bonus
  gameMode: GameMode;
  // Performance tracking
  _frameCount: number;
  _fps: number;
  _lastFpsTime: number;
  _activeParticleCount: number;
}

// ── Particle pool ─────────────────────────────────────────────────────────────
const PARTICLE_POOL_SIZE = 120; // increased for richer visual effects
let particlePool: Particle[] = [];

function initParticlePool(): Particle[] {
  particlePool = Array.from({ length: PARTICLE_POOL_SIZE }, (_, i) => ({
    id: i,
    x: 0, y: 0, vx: 0, vy: 0,
    alpha: 0, color: '', owner: 0 as 0 | 1 | 2,
    active: false,
  }));
  return particlePool;
}

function acquireParticle(
  x: number, y: number, vx: number, vy: number,
  alpha: number, color: string, owner: 0 | 1 | 2
): Particle | null {
  for (const p of particlePool) {
    if (!p.active) {
      p.active = true;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.alpha = alpha; p.color = color; p.owner = owner;
      return p;
    }
  }
  return null;
}

// ── Utilities ─────────────────────────────────────────────────────────────────
let _uid = 1000;
function uid(): number { return ++_uid; }

function rng(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

// ── Node type assignment ──────────────────────────────────────────────────────
function assignNodeTypes(neutralCount: number): NodeType[] {
  const types: NodeType[] = [];
  const fortress = Math.max(1, Math.round(neutralCount * 0.15));
  const barracks = Math.max(1, Math.round(neutralCount * 0.15));
  const watchtower = Math.max(1, Math.round(neutralCount * 0.10));
  const ruins = Math.max(1, Math.round(neutralCount * 0.10));
  const standard = neutralCount - fortress - barracks - watchtower - ruins;

  for (let i = 0; i < standard; i++) types.push('standard');
  for (let i = 0; i < fortress; i++) types.push('fortress');
  for (let i = 0; i < barracks; i++) types.push('barracks');
  for (let i = 0; i < watchtower; i++) types.push('watchtower');
  for (let i = 0; i < ruins; i++) types.push('ruins');

  // Shuffle
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

// ── Planet generation ─────────────────────────────────────────────────────────
function generatePlanets(w: number, h: number, mapSize: MapSize): Planet[] {
  const config = MAP_SIZE_CONFIG[mapSize];
  const count = config.nodeCount;
  const minDist = config.minDist;
  const margin = 40;

  const planets: Planet[] = [];
  const positions: { x: number; y: number }[] = [];

  const place = (xMin: number, xMax: number, yMin: number, yMax: number) => {
    let x = 0, y = 0, attempts = 0;
    do {
      x = rng(xMin, xMax);
      y = rng(yMin, yMax);
      attempts++;
    } while (positions.some(p => dist(p.x, p.y, x, y) < minDist) && attempts < 500);
    positions.push({ x, y });
    return { x, y };
  };

  // Randomize capital positions — pick opposing quadrants
  const quadrants = [
    { xMin: margin, xMax: w * 0.4, yMin: h * 0.6, yMax: h - margin },       // bottom-left
    { xMin: w * 0.6, xMax: w - margin, yMin: h * 0.6, yMax: h - margin },    // bottom-right
    { xMin: margin, xMax: w * 0.4, yMin: margin, yMax: h * 0.4 },            // top-left
    { xMin: w * 0.6, xMax: w - margin, yMin: margin, yMax: h * 0.4 },        // top-right
  ];
  // Opposing pairs: [0,3] (BL↔TR), [1,2] (BR↔TL)
  const pairs = [[0, 3], [1, 2]];
  const chosenPair = pairs[Math.floor(Math.random() * pairs.length)];
  // Randomly swap who gets which side
  const [pIdx, aIdx] = Math.random() < 0.5 ? [chosenPair[0], chosenPair[1]] : [chosenPair[1], chosenPair[0]];
  const pQ = quadrants[pIdx], aQ = quadrants[aIdx];

  const playerPos = place(pQ.xMin, pQ.xMax, pQ.yMin, pQ.yMax);
  planets.push({
    id: 0, ...playerPos, owner: 1, units: 15, radius: 26,
    nodeType: 'capital', ruinsTimer: 0,
  });

  const aiPos = place(aQ.xMin, aQ.xMax, aQ.yMin, aQ.yMax);
  planets.push({
    id: 1, ...aiPos, owner: 2, units: 15, radius: 26,
    nodeType: 'capital', ruinsTimer: 0,
  });

  // Neutral planets with node types
  const neutralCount = count - 2;
  const nodeTypes = assignNodeTypes(neutralCount);

  // Size tiers
  const smallCount = Math.ceil(neutralCount * 0.42);
  const mediumCount = Math.ceil(neutralCount * 0.42);
  const largeCount = neutralCount - smallCount - mediumCount;

  const tiers = [
    ...Array(smallCount).fill({ rMin: 14, rMax: 17, uMin: 4, uMax: 9 }),
    ...Array(mediumCount).fill({ rMin: 20, rMax: 23, uMin: 9, uMax: 15 }),
    ...Array(largeCount).fill({ rMin: 27, rMax: 31, uMin: 16, uMax: 24 }),
  ];

  for (let i = 0; i < neutralCount; i++) {
    const tier = tiers[i] || tiers[tiers.length - 1];
    const pos = place(margin, w - margin, margin, h - margin);
    const radius = tier.rMin + Math.random() * (tier.rMax - tier.rMin);
    let units = tier.uMin + Math.floor(Math.random() * (tier.uMax - tier.uMin));
    const nt = nodeTypes[i];

    // Fortress nodes start with more defense units
    if (nt === 'fortress') units = Math.round(units * 1.3);
    // Ruins start with very few
    if (nt === 'ruins') units = Math.max(2, Math.round(units * 0.4));

    planets.push({
      id: i + 2, ...pos, owner: 0, units, radius,
      nodeType: nt, ruinsTimer: 0,
    });
  }

  return planets;
}

// ── Particles (pooled) ────────────────────────────────────────────────────────
function spawnParticlesPooled(
  x: number, y: number, color: string, count: number,
  speed = 3.5, owner: 0 | 1 | 2 = 0
): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    acquireParticle(
      x + (Math.random() - 0.5) * 8,
      y + (Math.random() - 0.5) * 8,
      Math.cos(angle) * v,
      Math.sin(angle) * v,
      0.85 + Math.random() * 0.15,
      color, owner,
    );
  }
}

function spawnExplosionPooled(
  x: number, y: number,
  attackColor: string, defenseColor: string,
  attackOwner: 1 | 2
): void {
  const defOwner: 0 | 1 | 2 = attackOwner === 1 ? 2 : 1;
  spawnParticlesPooled(x, y, attackColor, 3, 6.0, attackOwner);
  spawnParticlesPooled(x, y, defenseColor, 2, 4.2, defOwner);
  spawnParticlesPooled(x, y, '255,255,255', 2, 7.5, 0);
}

// ── State creation ────────────────────────────────────────────────────────────
function createState(
  difficulty: Difficulty, w: number, h: number,
  mapSize: MapSize = 'medium',
  playerEmpireId: EmpireId | null = null,
  aiEmpireId: EmpireId | null = null,
  gameMode: GameMode = 'conquest',
): GameState {
  const pool = initParticlePool();
  return {
    planets: generatePlanets(w, h, mapSize),
    fleets: [],
    particles: pool,
    conquestFlashes: [],
    impactFlashes: [],
    floatingTexts: [],
    nodeHits: [],
    phase: 'playing',
    gameStartTime: Date.now(),
    gameEndTime: null,
    difficulty,
    fleetPercent: 50,
    playerConquestTotal: 0,
    enemyConquestTotal: 0,
    mapSize,
    playerEmpireId,
    aiEmpireId,
    abilityCooldown: 0,
    abilityActive: false,
    abilityActiveTimer: 0,
    aiAbilityCooldown: 0,
    aiAbilityActive: false,
    aiAbilityActiveTimer: 0,
    fogEnabled: mapSize === 'large',
    mirageOffsets: {},
    playerStreak: 0,
    gameMode,
    _frameCount: 0,
    _fps: 60,
    _lastFpsTime: Date.now(),
    _activeParticleCount: 0,
  };
}

// ── Combat resolution ─────────────────────────────────────────────────────────
function resolveCombat(fleet: Fleet, planets: Planet[], state: GameState): Planet[] {
  return planets.map(p => {
    if (p.id !== fleet.toId) return p;

    // Reinforcement
    if (fleet.owner === p.owner) {
      return { ...p, units: p.units + fleet.units };
    }

    let attackUnits = fleet.units;

    // Testudo: fleets take 50% less casualties when active
    if (state.abilityActive && state.playerEmpireId === 'rome' && fleet.owner === 1) {
      attackUnits = Math.round(fleet.units * 1.5);
    }
    if (state.aiAbilityActive && state.aiEmpireId === 'rome' && fleet.owner === 2) {
      attackUnits = Math.round(fleet.units * 1.5);
    }

    // Bushido: +40% attack damage
    if (state.abilityActive && state.playerEmpireId === 'japan' && fleet.owner === 1) {
      attackUnits = Math.round(fleet.units * 1.4);
    }
    if (state.aiAbilityActive && state.aiEmpireId === 'japan' && fleet.owner === 2) {
      attackUnits = Math.round(fleet.units * 1.4);
    }

    // Berserker Rage (Vikings): 2x damage
    if (state.abilityActive && state.playerEmpireId === 'vikings' && fleet.owner === 1) {
      attackUnits = Math.round(fleet.units * 2.0);
    }
    if (state.aiAbilityActive && state.aiEmpireId === 'vikings' && fleet.owner === 2) {
      attackUnits = Math.round(fleet.units * 2.0);
    }

    // Great Wall (Han): target node takes zero damage if fortified
    const isGreatWallPlayer = state.abilityActive && state.playerEmpireId === 'han' && p.owner === 1;
    const isGreatWallAI = state.aiAbilityActive && state.aiEmpireId === 'han' && p.owner === 2;
    if (isGreatWallPlayer || isGreatWallAI) {
      // Node is invulnerable — attacker does nothing, units are lost
      return p;
    }

    // Defense multiplier from node type
    const defMult = DEFENSE_MULT[p.nodeType];
    const effectiveDefense = Math.round(p.units * defMult);

    if (attackUnits > effectiveDefense) {
      const remainingAttack = attackUnits - effectiveDefense;
      // Ratio back to actual units
      const isTestudo = (state.abilityActive && state.playerEmpireId === 'rome' && fleet.owner === 1)
        || (state.aiAbilityActive && state.aiEmpireId === 'rome' && fleet.owner === 2);
      const isBushido = (state.abilityActive && state.playerEmpireId === 'japan' && fleet.owner === 1)
        || (state.aiAbilityActive && state.aiEmpireId === 'japan' && fleet.owner === 2);
      const isBerserker = (state.abilityActive && state.playerEmpireId === 'vikings' && fleet.owner === 1)
        || (state.aiAbilityActive && state.aiEmpireId === 'vikings' && fleet.owner === 2);
      const abilityMult = isTestudo ? 1.5 : isBushido ? 1.4 : isBerserker ? 2.0 : 1.0;
      const actualRemaining = abilityMult > 1 ? Math.round(remainingAttack / abilityMult) : remainingAttack;
      return { ...p, owner: fleet.owner as 0 | 1 | 2, units: Math.max(1, actualRemaining) };
    }

    // Immortal Legion (Persian): units survive transit — always capture with at least 1
    const isImmortalPlayer = state.abilityActive && state.playerEmpireId === 'persian' && fleet.owner === 1;
    const isImmortalAI = state.aiAbilityActive && state.aiEmpireId === 'persian' && fleet.owner === 2;
    if (isImmortalPlayer || isImmortalAI) {
      // Force capture: fleet always wins with at least 1 unit
      const reduced = Math.max(1, Math.round(p.units * 0.3)); // Keep 30% of defense as conquered units
      return { ...p, owner: fleet.owner as 0 | 1 | 2, units: Math.max(1, fleet.units - Math.floor(p.units * 0.5)) };
    }

    const remainingDefense = effectiveDefense - attackUnits;
    const actualRemainingDef = Math.round(remainingDefense / defMult);
    return { ...p, units: Math.max(0, actualRemainingDef) };
  });
}

// ── Fleet launch (distance-based speed) ──────────────────────────────────────
function launchFleet(
  state: GameState,
  sourceId: number,
  targetId: number,
  owner: 1 | 2,
  pct = 0.6
): void {
  const src = state.planets.find(p => p.id === sourceId);
  const tgt = state.planets.find(p => p.id === targetId);
  if (!src || !tgt) return;
  const sendUnits = Math.max(1, Math.floor(src.units * pct));
  if (sendUnits < 1) return;

  // Distance-based speed: nearby = faster feel, far = slightly slower
  const d = dist(src.x, src.y, tgt.x, tgt.y);
  const maxDist = 500;
  const distFrac = Math.min(1, d / maxDist);
  // Close nodes: 0.55 progress/s, far nodes: 0.35 progress/s
  const baseSpeed = 0.55 - distFrac * 0.20 + (Math.random() - 0.5) * 0.04;

  state.fleets.push({
    id: uid(),
    fromId: sourceId,
    toId: targetId,
    units: sendUnits,
    owner,
    progress: 0,
    speed: baseSpeed,
    arc: (Math.random() - 0.5) * 130,
  });
  src.units -= sendUnits;
}

// ── AI (upgraded: abilities, distance-weighted, border defense, expansion) ────
function aiUseAbility(state: GameState): void {
  if (state.aiAbilityCooldown > 0 || state.aiAbilityActive) return;
  const empireId = state.aiEmpireId;
  if (!empireId) return;

  const empCfg = EMPIRE_CONFIG[empireId];
  let shouldUse = false;

  if (empireId === 'egypt') {
    const aiCount = state.planets.filter(p => p.owner === 2).length;
    shouldUse = aiCount >= 3 && Math.random() < 0.3;
  } else if (empireId === 'rome') {
    const aiFleets = state.fleets.filter(f => f.owner === 2 && f.progress > 0.3);
    shouldUse = aiFleets.length >= 2;
  } else if (empireId === 'mongols') {
    const aiFleets = state.fleets.filter(f => f.owner === 2 && f.progress < 0.5);
    shouldUse = aiFleets.length >= 2;
  } else if (empireId === 'ptolemaic') {
    const incomingAttacks = state.fleets.filter(f => {
      if (f.owner !== 1) return false;
      const target = state.planets.find(p => p.id === f.toId);
      return target && target.owner === 2;
    });
    shouldUse = incomingAttacks.length >= 2;
  } else if (empireId === 'vikings') {
    // Berserker when attacking 2+ enemy nodes
    const attackFleets = state.fleets.filter(f => f.owner === 2 && f.progress < 0.6);
    shouldUse = attackFleets.length >= 2 && Math.random() < 0.4;
  } else if (empireId === 'aztec') {
    // Blood Sacrifice when owning 6+ nodes with 30+ units on majority
    const aiNodes = state.planets.filter(p => p.owner === 2);
    const strongNodes = aiNodes.filter(p => p.units >= 30);
    shouldUse = aiNodes.length >= 6 && strongNodes.length >= aiNodes.length * 0.5;
  } else if (empireId === 'persian') {
    // Immortal Legion for long-distance raids
    const aiFleets = state.fleets.filter(f => f.owner === 2 && f.progress < 0.3);
    shouldUse = aiFleets.length >= 1 && Math.random() < 0.35;
  } else if (empireId === 'ottoman') {
    // Grand Bazaar when neutral nodes exist
    const neutralCount = state.planets.filter(p => p.owner === 0).length;
    shouldUse = neutralCount >= 3 && Math.random() < 0.4;
  } else if (empireId === 'han') {
    // Great Wall on capital when under attack
    const aiCapital = state.planets.find(p => p.id === 1);
    const capitalThreat = state.fleets.filter(f => f.owner === 1 && f.toId === 1);
    shouldUse = aiCapital !== undefined && aiCapital.owner === 2 && capitalThreat.length > 0;
  }

  if (shouldUse) {
    state.aiAbilityActive = true;
    state.aiAbilityActiveTimer = empCfg.ability.duration;
    state.aiAbilityCooldown = empCfg.ability.cooldown;
    // Spawn visual particles for AI ability activation
    for (const p of state.planets) {
      if (p.owner === 2) {
        spawnParticlesPooled(p.x, p.y, empCfg.glowRgb, 3, 4);
      }
    }
  }
}

// Score a target by value/distance ratio (higher = better target)
function scoreTarget(src: Planet, tgt: Planet, perceived: number): number {
  const d = dist(src.x, src.y, tgt.x, tgt.y);
  const distPenalty = d / 200; // farther = worse
  const strengthRatio = src.units / Math.max(1, perceived);
  // Bonus for barracks (high growth), penalty for fortress (hard to take)
  const typeMult = tgt.nodeType === 'barracks' ? 1.4
    : tgt.nodeType === 'fortress' ? 0.6
    : tgt.nodeType === 'capital' ? 2.0
    : tgt.nodeType === 'watchtower' ? 1.2
    : 1.0;
  return (strengthRatio * typeMult) / (1 + distPenalty);
}

function aiTick(state: GameState, dt: number): void {
  const { difficulty } = state;
  const fireProb = difficulty === 'easy' ? 0.0065 : difficulty === 'medium' ? 0.0156 : 0.0312;
  const threshold = difficulty === 'easy' ? 22 : difficulty === 'medium' ? 14 : 8;

  // AI ability usage (medium+hard only)
  if (difficulty !== 'easy' && Math.random() < 0.005 * dt * 60) {
    aiUseAbility(state);
  }

  if (Math.random() > fireProb * dt * 60) return;

  const aiPlanets = state.planets.filter(p => p.owner === 2 && p.units > threshold);
  if (aiPlanets.length === 0) return;

  // Mirage effect: AI sees wrong unit counts on player nodes
  const mirageActive = state.abilityActive && state.playerEmpireId === 'ptolemaic';
  const getPerceivedUnits = (p: Planet): number => {
    if (mirageActive && p.owner === 1) {
      const offset = 0.6 + Math.random() * 0.8;
      return Math.round(p.units * offset);
    }
    return p.units;
  };

  if (difficulty === 'easy') {
    // Easy: mostly random but prefers nearby targets
    const source = aiPlanets[Math.floor(Math.random() * aiPlanets.length)];
    const validTargets = state.planets.filter(p => p.owner !== 2);
    if (validTargets.length === 0) return;
    // Weight by distance (closer = more likely)
    const weights = validTargets.map(t => 1 / (1 + dist(source.x, source.y, t.x, t.y) / 150));
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let target = validTargets[0];
    for (let i = 0; i < validTargets.length; i++) {
      r -= weights[i];
      if (r <= 0) { target = validTargets[i]; break; }
    }
    launchFleet(state, source.id, target.id, 2, 0.55);
  } else if (difficulty === 'medium') {
    // Medium: score-based targeting, sometimes expands to neutrals
    const source = aiPlanets.reduce((best, p) => p.units > best.units ? p : best, aiPlanets[0]);
    const targets = state.planets.filter(p => p.owner !== 2);
    if (targets.length === 0) return;
    // Score all targets
    let bestTarget = targets[0], bestScore = -Infinity;
    for (const t of targets) {
      const s = scoreTarget(source, t, getPerceivedUnits(t));
      if (s > bestScore) { bestScore = s; bestTarget = t; }
    }
    if (bestTarget.id === source.id) return;
    launchFleet(state, source.id, bestTarget.id, 2, 0.6);

    // Sometimes reinforce a border node
    if (Math.random() < 0.2) {
      const borderNodes = state.planets.filter(p => {
        if (p.owner !== 2 || p.units > 20) return false;
        return state.planets.some(q => q.owner === 1 && dist(p.x, p.y, q.x, q.y) < 180);
      });
      if (borderNodes.length > 0 && aiPlanets.length >= 2) {
        const reinforcer = aiPlanets.find(p => p.id !== source.id && p.units > 15);
        if (reinforcer) {
          const weakBorder = borderNodes.reduce((a, b) => a.units < b.units ? a : b, borderNodes[0]);
          launchFleet(state, reinforcer.id, weakBorder.id, 2, 0.3);
        }
      }
    }
  } else {
    // Hard: multi-pronged, score-weighted, defends capital, coordinates attacks
    const sorted = [...aiPlanets].sort((a, b) => b.units - a.units);
    const playerPlanets = state.planets.filter(p => p.owner === 1);
    const neutralPlanets = state.planets.filter(p => p.owner === 0);
    const targets = state.planets.filter(p => p.owner !== 2);
    if (targets.length === 0) return;

    const primary = sorted[0];

    // Defend capital if under threat
    const aiCapital = state.planets.find(p => p.id === 1);
    const capitalThreat = state.fleets.filter(f => f.owner === 1 && f.toId === 1);
    if (aiCapital && aiCapital.owner === 2 && capitalThreat.length > 0 && aiCapital.units < 20) {
      // Emergency reinforce capital
      const reinforcer = sorted.find(p => p.id !== 1 && p.units > 12);
      if (reinforcer) {
        launchFleet(state, reinforcer.id, 1, 2, 0.5);
        return; // Priority action, skip normal attack
      }
    }

    // Score all targets from primary
    let bestTarget = targets[0], bestScore = -Infinity;
    for (const t of targets) {
      const s = scoreTarget(primary, t, getPerceivedUnits(t));
      if (s > bestScore) { bestScore = s; bestTarget = t; }
    }
    if (bestTarget.id === primary.id) return;
    launchFleet(state, primary.id, bestTarget.id, 2, 0.65);

    // Coordinated attack: second planet attacks same or adjacent target
    if (sorted.length >= 2 && Math.random() < 0.5) {
      const secondary = sorted[1];
      // Find best target near the primary's target (pincer attack)
      const nearTargets = targets.filter(
        t => t.id !== bestTarget.id && secondary.units > getPerceivedUnits(t) * 1.1
          && dist(secondary.x, secondary.y, t.x, t.y) < 250
      );
      if (nearTargets.length > 0) {
        let secBest = nearTargets[0], secScore = -Infinity;
        for (const t of nearTargets) {
          const s = scoreTarget(secondary, t, getPerceivedUnits(t));
          if (s > secScore) { secScore = s; secBest = t; }
        }
        if (secBest.id !== secondary.id) {
          launchFleet(state, secondary.id, secBest.id, 2, 0.6);
        }
      } else if (Math.random() < 0.4) {
        // Pile on same target for overwhelming force
        launchFleet(state, secondary.id, bestTarget.id, 2, 0.5);
      }
    }

    // Third prong: reinforce weak border positions
    if (Math.random() < 0.3 && sorted.length >= 3) {
      const reinforcer = sorted[2];
      const weakBorder = state.planets.filter(
        p => p.owner === 2 && p.units < 10 && p.id !== primary.id
          && state.planets.some(q => q.owner === 1 && dist(p.x, p.y, q.x, q.y) < 180)
      );
      if (weakBorder.length > 0 && reinforcer.units > 15) {
        const target = weakBorder.reduce((a, b) => a.units < b.units ? a : b, weakBorder[0]);
        launchFleet(state, reinforcer.id, target.id, 2, 0.3);
      }
    }

    // Expansion: grab nearby neutrals with small forces
    if (neutralPlanets.length > 0 && Math.random() < 0.35) {
      for (const src of sorted) {
        if (src.units < 15) continue;
        const nearNeutral = neutralPlanets.filter(
          n => dist(src.x, src.y, n.x, n.y) < 200 && n.units < src.units * 0.6
        );
        if (nearNeutral.length > 0) {
          const closest = nearNeutral.reduce((a, b) =>
            dist(src.x, src.y, a.x, a.y) < dist(src.x, src.y, b.x, b.y) ? a : b, nearNeutral[0]);
          launchFleet(state, src.id, closest.id, 2, 0.4);
          break;
        }
      }
    }
  }
}

// ── Main tick ─────────────────────────────────────────────────────────────────
function tick(state: GameState, dt: number): void {
  if (state.phase !== 'playing') return;

  // Cap delta time at 33ms
  dt = Math.min(dt, 0.033);

  // ── Ability active timer ────────────────────────────────────────────────
  if (state.abilityActive) {
    state.abilityActiveTimer -= dt;
    if (state.abilityActiveTimer <= 0) {
      state.abilityActive = false;
      state.abilityActiveTimer = 0;
      state.mirageOffsets = {};
    }
  }

  // ── Ability cooldown ────────────────────────────────────────────────────
  if (state.abilityCooldown > 0) {
    state.abilityCooldown = Math.max(0, state.abilityCooldown - dt);
  }

  // ── AI ability timer + cooldown ────────────────────────────────────────
  if (state.aiAbilityActive) {
    state.aiAbilityActiveTimer -= dt;
    if (state.aiAbilityActiveTimer <= 0) {
      state.aiAbilityActive = false;
      state.aiAbilityActiveTimer = 0;
    }
  }
  if (state.aiAbilityCooldown > 0) {
    state.aiAbilityCooldown = Math.max(0, state.aiAbilityCooldown - dt);
  }

  // ── Count territories per owner (for growth momentum) ───────────────
  let playerTerritories = 0, aiTerritories = 0;
  for (let i = 0; i < state.planets.length; i++) {
    if (state.planets[i].owner === 1) playerTerritories++;
    else if (state.planets[i].owner === 2) aiTerritories++;
  }

  // ── Planet growth (with territory momentum + early game boost) ─────
  for (const p of state.planets) {
    if (p.owner !== 0) {
      const baseRate = (0.018 + (30 - Math.min(p.radius, 30)) * 0.0008) * 1.2;
      let rate = baseRate * GROWTH_MULT[p.nodeType];

      // Territory momentum: +3% growth per territory owned (caps at +30%)
      const territories = p.owner === 1 ? playerTerritories : aiTerritories;
      const opponentTerritories = p.owner === 1 ? aiTerritories : playerTerritories;
      const momentumBonus = Math.min(0.30, territories * 0.03);
      rate *= (1 + momentumBonus);

      // Comeback mechanic: underdog gets +25% growth when owning fewer territories
      if (territories > 0 && opponentTerritories > territories * 1.5) {
        rate *= 1.25;
      }

      // Early game boost: faster growth in first 30 seconds to reduce early waiting
      const gameAge = (Date.now() - state.gameStartTime) / 1000;
      if (gameAge < 30) {
        rate *= 1.3 + 0.3 * (1 - gameAge / 30); // 1.6x at start, decays to 1.3x
      }

      // Win streak bonus: +5% per streak, caps at +15%
      if (p.owner === 1 && state.playerStreak >= 3) {
        rate *= 1 + Math.min(0.15, state.playerStreak * 0.05);
      }

      // Eye of Ra: +60% generation while active
      if (state.abilityActive && state.playerEmpireId === 'egypt' && p.owner === 1) {
        rate *= 1.6;
      }
      if (state.aiAbilityActive && state.aiEmpireId === 'egypt' && p.owner === 2) {
        rate *= 1.6;
      }

      // Berserker Rage (Vikings): -40% generation during rage
      if (state.abilityActive && state.playerEmpireId === 'vikings' && p.owner === 1) {
        rate *= 0.6;
      }
      if (state.aiAbilityActive && state.aiEmpireId === 'vikings' && p.owner === 2) {
        rate *= 0.6;
      }

      // Blood Sacrifice (Aztec): 3x generation rate during ability
      if (state.abilityActive && state.playerEmpireId === 'aztec' && p.owner === 1) {
        rate *= 3.0;
      }
      if (state.aiAbilityActive && state.aiEmpireId === 'aztec' && p.owner === 2) {
        rate *= 3.0;
      }

      p.units = Math.min(p.units + rate * dt * 60, 999);
    }

    // Ruins timer: transform to barracks after 15s of ownership
    if (p.nodeType === 'ruins' && p.owner !== 0 && p.ruinsTimer > 0) {
      p.ruinsTimer -= dt;
      if (p.ruinsTimer <= 0) {
        p.nodeType = 'barracks';
        p.ruinsTimer = 0;
      }
    }
  }

  // ── Grand Bazaar: neutral nodes generate units for Ottoman player ────────
  const ottomanPlayerActive = state.abilityActive && state.playerEmpireId === 'ottoman';
  const ottomanAIActive = state.aiAbilityActive && state.aiEmpireId === 'ottoman';
  if (ottomanPlayerActive || ottomanAIActive) {
    const owner: 1 | 2 = ottomanPlayerActive ? 1 : 2;
    for (let i = 0; i < state.planets.length; i++) {
      const p = state.planets[i];
      if (p.owner !== 0) continue;
      // Find nearest owned node and add units to it
      let nearestDist = Infinity, nearestIdx = -1;
      for (let j = 0; j < state.planets.length; j++) {
        if (state.planets[j].owner !== owner) continue;
        const d = dist(p.x, p.y, state.planets[j].x, state.planets[j].y);
        if (d < nearestDist) { nearestDist = d; nearestIdx = j; }
      }
      if (nearestIdx >= 0) {
        state.planets[nearestIdx].units = Math.min(999, state.planets[nearestIdx].units + 0.3 * dt * 60);
      }
    }
  }

  // ── Move fleets with smooth easing (in-place, zero allocation) ──────────
  // Separate arrived fleets by swapping to end, then truncate
  let arrivedStart = state.fleets.length;
  for (let i = state.fleets.length - 1; i >= 0; i--) {
    const f = state.fleets[i];
    let speedMult = 1.0;

    if (f.progress < 0.2) {
      const t = f.progress / 0.2;
      speedMult = 0.3 + 0.7 * t * t;
    }
    if (f.progress > 0.85) {
      const t = (f.progress - 0.85) / 0.15;
      speedMult = 1.0 - 0.5 * t * t;
    }

    if (state.abilityActive && state.playerEmpireId === 'mongols' && f.owner === 1) {
      speedMult *= 3.0;
    }
    if (state.aiAbilityActive && state.aiEmpireId === 'mongols' && f.owner === 2) {
      speedMult *= 3.0;
    }

    const newProgress = f.progress + f.speed * speedMult * dt;
    if (newProgress >= 1) {
      // Swap to end for later processing
      arrivedStart--;
      const tmp = state.fleets[arrivedStart];
      state.fleets[arrivedStart] = f;
      state.fleets[i] = tmp;
    } else {
      f.progress = newProgress;
    }
  }
  // Process arrived fleets (from arrivedStart to end)
  const arrivedFleets = state.fleets.splice(arrivedStart);

  // ── Resolve fleet arrivals ──────────────────────────────────────────────
  for (const fleet of arrivedFleets) {
    const targetBefore = state.planets.find(p => p.id === fleet.toId);
    state.planets = resolveCombat(fleet, state.planets, state);
    const targetAfter = state.planets.find(p => p.id === fleet.toId);

    if (targetAfter && targetBefore) {
      const attackColor = fleet.owner === 1 ? '68,238,102' : '238,51,68';
      const defColor =
        targetBefore.owner === 0 ? '141,110,99'
        : targetBefore.owner === 1 ? '68,238,102'
        : '238,51,68';

      const wasConquest = targetBefore.owner !== fleet.owner && targetAfter.owner === fleet.owner;
      if (wasConquest) {
        if (fleet.owner === 1) state.playerConquestTotal++;
        else state.enemyConquestTotal++;
        // Enhanced capture burst: 12 particles outward (8 empire color + 4 white)
        spawnParticlesPooled(targetAfter.x, targetAfter.y, attackColor, 8, 6.0, fleet.owner);
        spawnParticlesPooled(targetAfter.x, targetAfter.y, '255,255,255', 4, 7.5, 0);
        // 3 staggered conquest flash rings
        for (let ring = 0; ring < 3; ring++) {
          state.conquestFlashes.push({
            id: uid(), x: targetAfter.x, y: targetAfter.y, t: -ring * 0.08,
            color: fleet.owner === 1 ? '#44EE66' : '#EE3344',
            owner: fleet.owner,
          });
        }

        // Floating capture text
        const gained = targetAfter.units;
        state.floatingTexts.push({
          id: uid(), x: targetAfter.x, y: targetAfter.y - targetAfter.radius - 8,
          text: `+${gained}`, color: fleet.owner === 1 ? '#66FF88' : '#FF6688',
          t: 0, size: Math.min(18, 11 + gained * 0.3),
        });

        // Start ruins timer if captured a ruins node
        if (targetAfter.nodeType === 'ruins') {
          targetAfter.ruinsTimer = 15;
        }
      } else {
        // Impact sparks: 5 particles in 120-degree arc toward node
        const angleToNode = Math.atan2(targetAfter.y - targetAfter.y, targetAfter.x - targetAfter.x);
        for (let sp = 0; sp < 5; sp++) {
          const a = angleToNode + (Math.random() - 0.5) * (Math.PI * 2 / 3);
          const v = 3.5 + Math.random() * 3;
          // Add perpendicular velocity for arc
          const perpV = (Math.random() - 0.5) * 2;
          acquireParticle(
            targetAfter.x + (Math.random() - 0.5) * 8,
            targetAfter.y + (Math.random() - 0.5) * 8,
            Math.cos(a) * v + Math.cos(a + Math.PI/2) * perpV,
            Math.sin(a) * v + Math.sin(a + Math.PI/2) * perpV,
            0.9, attackColor, fleet.owner
          );
        }
        state.impactFlashes.push({ id: uid(), x: targetAfter.x, y: targetAfter.y, t: 0 });
        // Node hit tracking for red flash
        state.nodeHits.push({ id: uid(), nodeId: targetAfter.id, t: 0 });

        // Floating combat text
        const delta = Math.floor(targetBefore.units) - Math.floor(targetAfter.units);
        if (delta > 0) {
          state.floatingTexts.push({
            id: uid(), x: targetAfter.x + (Math.random() - 0.5) * 16,
            y: targetAfter.y - targetAfter.radius - 4,
            text: `-${delta}`, color: '#FF4444',
            t: 0, size: Math.min(16, 10 + delta * 0.4),
          });
        }

        // Close battle detection: if within 3 units, add shake
        if (targetAfter.units <= 3 && targetAfter.owner !== 0) {
          state.impactFlashes.push({ id: uid(), x: targetAfter.x, y: targetAfter.y, t: 0 });
        }
      }
    }
  }

  // ── AI ──────────────────────────────────────────────────────────────────
  aiTick(state, dt);

  // ── Particles (pool-based) ──────────────────────────────────────────────
  for (const p of state.particles) {
    if (!p.active) continue;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.alpha -= 0.022 * dt * 60;
    p.vx *= Math.pow(0.97, dt * 60);
    p.vy *= Math.pow(0.97, dt * 60);
    if (p.alpha <= 0) {
      p.active = false;
    }
  }

  // ── Conquest flashes ────────────────────────────────────────────────────
  for (const cf of state.conquestFlashes) {
    cf.t += dt * 1.6;
  }
  state.conquestFlashes = state.conquestFlashes.filter(cf => cf.t < 1);

  // ── Impact flashes ──────────────────────────────────────────────────────
  for (const inf of state.impactFlashes) {
    inf.t += dt * 3.6;
  }
  state.impactFlashes = state.impactFlashes.filter(inf => inf.t < 1);

  // ── Floating texts ─────────────────────────────────────────────────────
  for (const ft of state.floatingTexts) {
    ft.t += dt * 1.67; // ~600ms lifetime
    ft.y -= dt * 33; // float upward ~20px over lifetime
  }
  state.floatingTexts = state.floatingTexts.filter(ft => ft.t < 1);

  // ── Node hits (red flash on number) ────────────────────────────────────
  for (const nh of state.nodeHits) {
    nh.t += dt * 12.5; // ~80ms lifetime
  }
  state.nodeHits = state.nodeHits.filter(nh => nh.t < 1);

  // ── Mirage offsets (regenerate while active) ────────────────────────────
  if (state.abilityActive && state.playerEmpireId === 'ptolemaic') {
    for (const p of state.planets) {
      if (p.owner === 1) {
        // Update mirage offset every few frames for shimmer effect
        if (!state.mirageOffsets[p.id] || Math.random() < 0.02) {
          state.mirageOffsets[p.id] = 0.6 + Math.random() * 0.8;
        }
      }
    }
  }

  // ── FPS tracking ────────────────────────────────────────────────────────
  state._frameCount++;
  let activeCount = 0;
  for (let i = 0; i < state.particles.length; i++) {
    if (state.particles[i].active) activeCount++;
  }
  state._activeParticleCount = activeCount;
  const fpsNow = Date.now();
  if (fpsNow - state._lastFpsTime >= 500) {
    state._fps = Math.round(state._frameCount / ((fpsNow - state._lastFpsTime) / 1000));
    state._frameCount = 0;
    state._lastFpsTime = fpsNow;
  }

  // ── Win/loss check ──────────────────────────────────────────────────────
  const playerPlanets = state.planets.filter(p => p.owner === 1);
  const enemyPlanets = state.planets.filter(p => p.owner === 2);
  const playerFleets = state.fleets.filter(f => f.owner === 1).length;
  const enemyFleets = state.fleets.filter(f => f.owner === 2).length;

  // Capital sudden death — only in Regicide mode
  if (state.gameMode === 'regicide') {
    const playerCapital = state.planets.find(p => p.id === 0);
    const aiCapital = state.planets.find(p => p.id === 1);

    if (playerCapital && playerCapital.owner === 2) {
      state.phase = 'lost';
      state.gameEndTime = Date.now();
      return;
    }
    if (aiCapital && aiCapital.owner === 1) {
      state.phase = 'won';
      state.gameEndTime = Date.now();
      return;
    }
  }

  // Standard elimination check
  if (playerPlanets.length === 0 && playerFleets === 0) {
    state.phase = 'lost';
    state.gameEndTime = Date.now();
  } else if (enemyPlanets.length === 0 && enemyFleets === 0) {
    state.phase = 'won';
    state.gameEndTime = Date.now();
  }
}

// ── Context ───────────────────────────────────────────────────────────────────
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
  mapSize?: MapSize;
  playerEmpireId?: EmpireId | null;
  aiEmpireId?: EmpireId | null;
  playerStreak?: number;
  gameMode?: GameMode;
}

export function GameProvider({
  children,
  initialDifficulty = 'medium',
  playWidth = 375,
  playHeight = 600,
  mapSize = 'medium',
  playerEmpireId = null,
  aiEmpireId = null,
  playerStreak = 0,
  gameMode = 'conquest',
}: GameProviderProps) {
  const initState = createState(initialDifficulty, playWidth, playHeight, mapSize, playerEmpireId, aiEmpireId, gameMode);
  initState.playerStreak = playerStreak;
  const gameRef = useRef<GameState>(
    initState
  );
  const [, forceRender] = useReducer(x => x + 1, 0);
  const dimensionsRef = useRef({ w: playWidth, h: playHeight });

  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number | null>(null);
  const lastRenderRef = useRef<number>(0);
  // Throttle React re-renders to ~30fps; game tick still runs at 60fps
  const RENDER_INTERVAL = 33; // ms (~30 re-renders/sec)

  const startLoop = useCallback(() => {
    const loop = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = now;
      tick(gameRef.current, dt);
      // Only trigger React re-render at throttled rate
      if (now - lastRenderRef.current >= RENDER_INTERVAL) {
        lastRenderRef.current = now;
        forceRender();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    startLoop();
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [startLoop]);

  const sendFleet = useCallback((fromId: number, toId: number) => {
    const state = gameRef.current;
    if (state.phase !== 'playing') return;
    const from = state.planets.find(p => p.id === fromId);
    if (!from || from.owner !== 1 || from.units < 2) return;
    const sendUnits = Math.max(1, Math.floor(from.units * (state.fleetPercent / 100)));
    const baseSpeed = 0.40 + Math.random() * 0.08;
    state.fleets.push({
      id: uid(), fromId, toId, units: sendUnits, owner: 1,
      progress: 0, speed: baseSpeed,
      arc: (Math.random() - 0.5) * 110,
    });
    from.units -= sendUnits;
    forceRender();
  }, []);

  const sendFleetFromAll = useCallback((toId: number) => {
    const state = gameRef.current;
    if (state.phase !== 'playing') return;
    const playerPlanets = state.planets.filter(p => p.owner === 1 && p.units >= 2 && p.id !== toId);
    if (playerPlanets.length === 0) return;
    for (const planet of playerPlanets) {
      const sendUnits = Math.max(1, Math.floor(planet.units * (state.fleetPercent / 100)));
      const baseSpeed = 0.40 + Math.random() * 0.08;
      state.fleets.push({
        id: uid(), fromId: planet.id, toId, units: sendUnits, owner: 1,
        progress: 0, speed: baseSpeed,
        arc: (Math.random() - 0.5) * 110,
      });
      planet.units -= sendUnits;
    }
    forceRender();
  }, []);

  const useAbility = useCallback(() => {
    const state = gameRef.current;
    if (state.phase !== 'playing' || state.abilityCooldown > 0) return;

    const empireId = state.playerEmpireId;
    if (!empireId) return;
    const empCfg = EMPIRE_CONFIG[empireId];

    state.abilityActive = true;
    state.abilityActiveTimer = empCfg.ability.duration;
    state.abilityCooldown = empCfg.ability.cooldown;

    // Spawn ability activation particles (reduced count for perf)
    for (const p of state.planets) {
      if (p.owner === 1) {
        spawnParticlesPooled(p.x, p.y, empCfg.glowRgb, 4, 5);
      }
    }

    // Mirage: generate initial fake offsets
    if (empireId === 'ptolemaic') {
      for (const p of state.planets) {
        if (p.owner === 1) {
          state.mirageOffsets[p.id] = 0.6 + Math.random() * 0.8;
        }
      }
    }

    // Blood Sacrifice (Aztec): sacrifice 30% of units on all owned nodes instantly
    if (empireId === 'aztec') {
      for (const p of state.planets) {
        if (p.owner === 1) {
          p.units = Math.max(1, Math.round(p.units * 0.7));
        }
      }
    }

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
    gameRef.current = createState(
      d, useW, useH,
      gameRef.current.mapSize,
      gameRef.current.playerEmpireId,
      gameRef.current.aiEmpireId,
      gameRef.current.gameMode,
    );
    if (useW !== 375 || useH !== 600) {
      dimensionsSetRef.current = true;
      gameRef.current.planets = generatePlanets(useW, useH, gameRef.current.mapSize);
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
      gameRef.current.planets = generatePlanets(w, h, gameRef.current.mapSize);
      forceRender();
    }
  }, []);

  const ctx: GameContextType = {
    state: gameRef.current,
    sendFleet, sendFleetFromAll, useAbility, resetGame, setFleetPercent, setDimensions,
  };

  return <GameContext.Provider value={ctx}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
