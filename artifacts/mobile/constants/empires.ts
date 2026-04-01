export type EmpireId = 'egypt' | 'rome' | 'mongols' | 'ptolemaic' | 'japan';
export type NodeShape = 'pyramid' | 'colosseum' | 'yurt' | 'sphinx' | 'torii';
export type UnitShape = 'scarab' | 'shield' | 'horse' | 'ankh' | 'katana';
export type AbilityId = 'eye_of_ra' | 'testudo' | 'blitz_ride' | 'mirage' | 'bushido';
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
};

export const EMPIRE_IDS: EmpireId[] = ['egypt', 'rome', 'mongols', 'ptolemaic', 'japan'];

export const MAP_SIZE_CONFIG: Record<MapSize, { label: string; desc: string; nodeCount: number; minDist: number }> = {
  small:  { label: 'Skirmish',    desc: 'Fast games, 2-4 min',         nodeCount: 10, minDist: 120 },
  medium: { label: 'Conquest',    desc: 'Balanced gameplay, 4-8 min',  nodeCount: 16, minDist: 100 },
  large:  { label: 'Domination',  desc: 'Epic games, 8-15 min',        nodeCount: 24, minDist: 85  },
};

export function randomEmpireExcluding(exclude: EmpireId): EmpireId {
  const pool = EMPIRE_IDS.filter(id => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
