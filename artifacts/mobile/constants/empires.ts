// ── EMPIRE BALANCE (v2.0 — 10 empires) ──────────────────────────────────
// Egypt:     Eye of Ra       — 18s CD, 8s dur  — +60% generation (sustained)
// Rome:      Testudo         — 15s CD, 6s dur  — -50% fleet casualties (defensive)
// Mongols:   Blitz Ride      — 12s CD, 5s dur  — 3x speed (mobility)
// Ptolemaic: Mirage          — 20s CD, 10s dur — fake unit counts (deception)
// Japan:     Bushido         — 16s CD, 7s dur  — +40% fleet damage (offensive)
// Vikings:   Berserker Rage  — 14s CD, 7s dur  — 2x damage, -40% gen (burst)
// Aztec:     Blood Sacrifice — 25s CD, 12s dur — -30% units, 3x gen (risky)
// Persian:   Immortal Legion — 22s CD, 10s dur — invulnerable transit (raid)
// Ottoman:   Grand Bazaar    — 18s CD, 8s dur  — harvest neutrals (map control)
// Han:       Great Wall      — 20s CD, 12s dur — 1 node invulnerable (fortress)

export type EmpireId = 'egypt' | 'rome' | 'mongols' | 'ptolemaic' | 'japan' | 'vikings' | 'aztec' | 'persian' | 'ottoman' | 'han';
export type NodeShape = 'pyramid' | 'colosseum' | 'yurt' | 'sphinx' | 'torii' | 'longhouse' | 'step_pyramid' | 'palace' | 'mosque' | 'pagoda';
export type UnitShape = 'scarab' | 'shield' | 'horse' | 'ankh' | 'katana' | 'viking_ship' | 'warrior' | 'immortal' | 'janissary' | 'han_soldier';
export type AbilityId = 'eye_of_ra' | 'testudo' | 'blitz_ride' | 'mirage' | 'bushido' | 'berserker_rage' | 'blood_sacrifice' | 'immortal_legion' | 'grand_bazaar' | 'great_wall';
export type MapSize = 'small' | 'medium' | 'large';
export type GameMode = 'conquest' | 'regicide';

export interface AbilityConfig {
  id: AbilityId;
  name: string;
  cooldown: number;
  duration: number;
  description: string;
}

export interface EmpireConfig {
  id: EmpireId;
  leader: string;
  empire: string;
  nodeShape: NodeShape;
  unitShape: UnitShape;
  nodeColor: string;
  unitColor: string;
  glowRgb: string;
  glowDarkRgb: string;
  accentColor: string;
  warCry: string;
  cardAccent: string;
  ability: AbilityConfig;
}

export const EMPIRE_CONFIG: Record<EmpireId, EmpireConfig> = {
  egypt: {
    id: 'egypt',
    leader: 'Ramesses II',
    empire: 'Egypt',
    nodeShape: 'pyramid',
    unitShape: 'scarab',
    nodeColor: '#00B0FF',
    unitColor: '#00B0FF',
    glowRgb: '0,176,255',
    glowDarkRgb: '0,44,64',
    accentColor: '#FFD700',
    warCry: 'By the power of Ra!',
    cardAccent: '#00B0FF',
    ability: {
      id: 'eye_of_ra',
      name: 'Eye of Ra',
      cooldown: 18,
      duration: 8,
      description: 'All nodes generate +60% units for 8s',
    },
  },
  rome: {
    id: 'rome',
    leader: 'Julius Caesar',
    empire: 'Rome',
    nodeShape: 'colosseum',
    unitShape: 'shield',
    nodeColor: '#FF1744',
    unitColor: '#FF1744',
    glowRgb: '255,23,68',
    glowDarkRgb: '80,6,17',
    accentColor: '#C0C0C0',
    warCry: 'For the Republic!',
    cardAccent: '#FF1744',
    ability: {
      id: 'testudo',
      name: 'Testudo',
      cooldown: 15,
      duration: 6,
      description: 'Fleets take 50% reduced casualties for 6s',
    },
  },
  mongols: {
    id: 'mongols',
    leader: 'Genghis Khan',
    empire: 'Mongols',
    nodeShape: 'yurt',
    unitShape: 'horse',
    nodeColor: '#FF6D00',
    unitColor: '#FF6D00',
    glowRgb: '255,109,0',
    glowDarkRgb: '80,34,0',
    accentColor: '#8D4E00',
    warCry: 'Ride them down!',
    cardAccent: '#FF6D00',
    ability: {
      id: 'blitz_ride',
      name: 'Blitz Ride',
      cooldown: 12,
      duration: 5,
      description: 'Unit travel speed tripled for 5s',
    },
  },
  ptolemaic: {
    id: 'ptolemaic',
    leader: 'Cleopatra',
    empire: 'Ptolemaic Egypt',
    nodeShape: 'sphinx',
    unitShape: 'ankh',
    nodeColor: '#18FFFF',
    unitColor: '#18FFFF',
    glowRgb: '24,255,255',
    glowDarkRgb: '6,64,64',
    accentColor: '#FFD700',
    warCry: 'Glory to the Nile!',
    cardAccent: '#18FFFF',
    ability: {
      id: 'mirage',
      name: 'Mirage',
      cooldown: 20,
      duration: 10,
      description: 'Enemy sees fake unit counts on your nodes for 10s',
    },
  },
  japan: {
    id: 'japan',
    leader: 'Tokugawa Ieyasu',
    empire: 'Japan',
    nodeShape: 'torii',
    unitShape: 'katana',
    nodeColor: '#E040FB',
    unitColor: '#E040FB',
    glowRgb: '224,64,251',
    glowDarkRgb: '56,16,63',
    accentColor: '#FFFFFF',
    warCry: 'Honor or death!',
    cardAccent: '#E040FB',
    ability: {
      id: 'bushido',
      name: 'Bushido',
      cooldown: 16,
      duration: 7,
      description: 'All fleets deal +40% damage for 7s',
    },
  },
  vikings: {
    id: 'vikings',
    leader: 'Ragnar Lothbrok',
    empire: 'Vikings',
    nodeShape: 'longhouse',
    unitShape: 'viking_ship',
    nodeColor: '#80D8FF',
    unitColor: '#80D8FF',
    glowRgb: '128,216,255',
    glowDarkRgb: '32,54,64',
    accentColor: '#E0E0E0',
    warCry: 'To Valhalla!',
    cardAccent: '#80D8FF',
    ability: {
      id: 'berserker_rage',
      name: 'Berserker Rage',
      cooldown: 14,
      duration: 7,
      description: 'Units deal 2x damage but nodes generate 40% fewer units for 7s',
    },
  },
  aztec: {
    id: 'aztec',
    leader: 'Moctezuma II',
    empire: 'Aztec Empire',
    nodeShape: 'step_pyramid',
    unitShape: 'warrior',
    nodeColor: '#69F0AE',
    unitColor: '#69F0AE',
    glowRgb: '105,240,174',
    glowDarkRgb: '26,60,44',
    accentColor: '#B71C1C',
    warCry: 'For the Fifth Sun!',
    cardAccent: '#69F0AE',
    ability: {
      id: 'blood_sacrifice',
      name: 'Blood Sacrifice',
      cooldown: 25,
      duration: 12,
      description: 'Sacrifice 30% units, remaining generate at 3x rate for 12s',
    },
  },
  persian: {
    id: 'persian',
    leader: 'Cyrus the Great',
    empire: 'Persian Empire',
    nodeShape: 'palace',
    unitShape: 'immortal',
    nodeColor: '#CE93D8',
    unitColor: '#CE93D8',
    glowRgb: '206,147,216',
    glowDarkRgb: '52,37,54',
    accentColor: '#FFD700',
    warCry: 'By the grace of Ahura Mazda!',
    cardAccent: '#CE93D8',
    ability: {
      id: 'immortal_legion',
      name: 'Immortal Legion',
      cooldown: 22,
      duration: 10,
      description: 'Units cannot be destroyed during transit for 10s',
    },
  },
  ottoman: {
    id: 'ottoman',
    leader: 'Suleiman the Magnificent',
    empire: 'Ottoman Empire',
    nodeShape: 'mosque',
    unitShape: 'janissary',
    nodeColor: '#FF4081',
    unitColor: '#FF4081',
    glowRgb: '255,64,129',
    glowDarkRgb: '64,16,32',
    accentColor: '#00BCD4',
    warCry: 'For the Sublime Porte!',
    cardAccent: '#FF4081',
    ability: {
      id: 'grand_bazaar',
      name: 'Grand Bazaar',
      cooldown: 18,
      duration: 8,
      description: 'Neutral nodes generate units for you for 8s',
    },
  },
  han: {
    id: 'han',
    leader: 'Emperor Wu',
    empire: 'Han Dynasty',
    nodeShape: 'pagoda',
    unitShape: 'han_soldier',
    nodeColor: '#FFEB3B',
    unitColor: '#FFEB3B',
    glowRgb: '255,235,59',
    glowDarkRgb: '64,59,15',
    accentColor: '#D32F2F',
    warCry: 'The Mandate of Heaven!',
    cardAccent: '#FFEB3B',
    ability: {
      id: 'great_wall',
      name: 'Great Wall',
      cooldown: 20,
      duration: 12,
      description: 'One selected node takes zero damage for 12s',
    },
  },
};

export const EMPIRE_IDS: EmpireId[] = ['egypt', 'rome', 'mongols', 'ptolemaic', 'japan', 'vikings', 'aztec', 'persian', 'ottoman', 'han'];

export const MAP_SIZE_CONFIG: Record<MapSize, { label: string; desc: string; nodeCount: number; minDist: number }> = {
  small:  { label: 'Skirmish',    desc: 'Fast games, 2-4 min',         nodeCount: 10, minDist: 120 },
  medium: { label: 'Conquest',    desc: 'Balanced gameplay, 4-8 min',  nodeCount: 16, minDist: 100 },
  large:  { label: 'Domination',  desc: 'Epic games, 8-15 min',        nodeCount: 24, minDist: 85  },
};

export function randomEmpireExcluding(exclude: EmpireId): EmpireId {
  const pool = EMPIRE_IDS.filter(id => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
