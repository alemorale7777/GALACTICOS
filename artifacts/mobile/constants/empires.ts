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
    nodeColor: '#00BFFF',
    unitColor: '#00BFFF',
    glowRgb: '0,191,255',
    glowDarkRgb: '0,50,80',
    accentColor: '#FFD700',
    warCry: 'By the power of Ra!',
    cardAccent: '#00BFFF',
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
    nodeColor: '#CC2222',
    unitColor: '#DD3333',
    glowRgb: '204,34,34',
    glowDarkRgb: '80,8,8',
    accentColor: '#881818',
    warCry: 'For the Republic!',
    cardAccent: '#CC2222',
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
    nodeColor: '#CC7722',
    unitColor: '#FF9933',
    glowRgb: '204,119,34',
    glowDarkRgb: '80,45,5',
    accentColor: '#885511',
    warCry: 'Ride them down!',
    cardAccent: '#CC7722',
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
    nodeColor: '#22AAAA',
    unitColor: '#22DDCC',
    glowRgb: '34,170,170',
    glowDarkRgb: '5,60,60',
    accentColor: '#116666',
    warCry: 'Glory to the Nile!',
    cardAccent: '#22AAAA',
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
    nodeColor: '#DC143C',
    unitColor: '#FF2244',
    glowRgb: '220,20,60',
    glowDarkRgb: '80,5,20',
    accentColor: '#FFFFFF',
    warCry: 'Honor or death!',
    cardAccent: '#DC143C',
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
    nodeColor: '#4FC3F7',
    unitColor: '#81D4FA',
    glowRgb: '79,195,247',
    glowDarkRgb: '20,50,65',
    accentColor: '#E0E0E0',
    warCry: 'To Valhalla!',
    cardAccent: '#4FC3F7',
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
    nodeColor: '#4CAF50',
    unitColor: '#66BB6A',
    glowRgb: '76,175,80',
    glowDarkRgb: '20,50,20',
    accentColor: '#C62828',
    warCry: 'For the Fifth Sun!',
    cardAccent: '#4CAF50',
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
    nodeColor: '#7B1FA2',
    unitColor: '#9C27B0',
    glowRgb: '123,31,162',
    glowDarkRgb: '35,8,50',
    accentColor: '#FFD700',
    warCry: 'By the grace of Ahura Mazda!',
    cardAccent: '#7B1FA2',
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
    nodeColor: '#B71C1C',
    unitColor: '#E53935',
    glowRgb: '183,28,28',
    glowDarkRgb: '60,8,8',
    accentColor: '#00BCD4',
    warCry: 'For the Sublime Porte!',
    cardAccent: '#B71C1C',
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
    nodeColor: '#D32F2F',
    unitColor: '#EF5350',
    glowRgb: '211,47,47',
    glowDarkRgb: '65,12,12',
    accentColor: '#FDD835',
    warCry: 'The Mandate of Heaven!',
    cardAccent: '#D32F2F',
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
