export type EmpireId = 'egypt' | 'rome' | 'mongols' | 'ptolemaic';
export type NodeShape = 'pyramid' | 'colosseum' | 'yurt' | 'sphinx';
export type UnitShape = 'scarab' | 'shield' | 'horse' | 'ankh';

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
  },
};

export const EMPIRE_IDS: EmpireId[] = ['egypt', 'rome', 'mongols', 'ptolemaic'];

export function randomEmpireExcluding(exclude: EmpireId): EmpireId {
  const pool = EMPIRE_IDS.filter(id => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}
