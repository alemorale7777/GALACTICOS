import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EmpireId } from '@/constants/empires';

const STORAGE_KEY = '@thraxon_campaign';

export interface CampaignMap {
  id: number;
  name: string;
  lore: string;
  nodeCount: number;
  timeLimit: number; // seconds for star 2
  difficulty: number; // 0.0 (easiest) to 1.0 (hardest)
}

export interface CampaignProgress {
  unlocked: number; // highest unlocked map index (0-based)
  stars: number[]; // stars earned per map (0-3)
}

// 12 maps per empire
const EGYPT_CAMPAIGN: CampaignMap[] = [
  { id: 0, name: 'The Nile Awakens', lore: 'The great river stirs. Unite the scattered villages along its banks to forge the first Egyptian kingdom.', nodeCount: 8, timeLimit: 240, difficulty: 0.1 },
  { id: 1, name: 'Sands of Sinai', lore: 'Cross the harsh desert peninsula. The nomadic tribes here resist outsiders fiercely.', nodeCount: 10, timeLimit: 300, difficulty: 0.2 },
  { id: 2, name: 'Memphis Rising', lore: 'The ancient capital must be reclaimed from rival warlords who desecrate its sacred temples.', nodeCount: 10, timeLimit: 280, difficulty: 0.25 },
  { id: 3, name: 'Oasis Wars', lore: 'Control the desert oases and you control all trade. Three factions vie for water supremacy.', nodeCount: 12, timeLimit: 300, difficulty: 0.3 },
  { id: 4, name: 'Delta Conquest', lore: 'The fertile Nile Delta is the breadbasket of the empire. Secure it or face famine.', nodeCount: 12, timeLimit: 320, difficulty: 0.4 },
  { id: 5, name: 'Theban Glory', lore: 'Thebes, city of Amun, calls for a champion. Prove your worth in the shadow of Karnak.', nodeCount: 14, timeLimit: 360, difficulty: 0.45 },
  { id: 6, name: 'Nubian Front', lore: 'The Nubian kingdom to the south grows bold. Push them back beyond the cataracts.', nodeCount: 14, timeLimit: 360, difficulty: 0.5 },
  { id: 7, name: 'Sea Peoples Storm', lore: 'Invaders from the sea threaten the coast. Every fortress must hold or the empire crumbles.', nodeCount: 16, timeLimit: 420, difficulty: 0.6 },
  { id: 8, name: 'Kadesh Reborn', lore: 'The legendary battlefield calls once more. Face the Hittite war machine head-on.', nodeCount: 16, timeLimit: 420, difficulty: 0.65 },
  { id: 9, name: 'Pharaoh\'s Wrath', lore: 'The gods demand total victory. Unleash the full might of Ra upon all who oppose you.', nodeCount: 18, timeLimit: 480, difficulty: 0.75 },
  { id: 10, name: 'Valley of Kings', lore: 'Defend the sacred burial grounds from tomb raiders and rival dynasties.', nodeCount: 18, timeLimit: 480, difficulty: 0.85 },
  { id: 11, name: 'Gates of Babylon', lore: 'The final march east. Babylon\'s mighty walls await — break them and claim eternal glory.', nodeCount: 20, timeLimit: 540, difficulty: 1.0 },
];

const ROME_CAMPAIGN: CampaignMap[] = [
  { id: 0, name: 'Roman Roads', lore: 'Build the foundation of empire. Connect the seven hills and establish order from chaos.', nodeCount: 8, timeLimit: 240, difficulty: 0.1 },
  { id: 1, name: 'Etruscan Dawn', lore: 'The Etruscan league challenges Rome\'s expansion. Show them the meaning of Roman discipline.', nodeCount: 10, timeLimit: 300, difficulty: 0.2 },
  { id: 2, name: 'Samnite Wars', lore: 'The mountain warriors of Samnium are fierce but disorganized. Unity is your advantage.', nodeCount: 10, timeLimit: 280, difficulty: 0.25 },
  { id: 3, name: 'Pyrrhic Victory', lore: 'King Pyrrhus brings war elephants from Epirus. Win, but at what cost?', nodeCount: 12, timeLimit: 300, difficulty: 0.3 },
  { id: 4, name: 'Punic Dawn', lore: 'Carthage controls the western seas. Sicily will be the first battleground.', nodeCount: 12, timeLimit: 320, difficulty: 0.4 },
  { id: 5, name: 'Crossing the Alps', lore: 'Hannibal\'s ghost haunts these passes. Prove that Rome can conquer any terrain.', nodeCount: 14, timeLimit: 360, difficulty: 0.45 },
  { id: 6, name: 'Gallic Thunder', lore: 'The Gauls rage against Roman expansion. Caesar\'s legions march through endless forests.', nodeCount: 14, timeLimit: 360, difficulty: 0.5 },
  { id: 7, name: 'Mare Nostrum', lore: 'Control the Mediterranean and you control the world. Pirate fleets must be destroyed.', nodeCount: 16, timeLimit: 420, difficulty: 0.6 },
  { id: 8, name: 'Rubicon Crossing', lore: 'The die is cast. March on Rome itself and seize destiny with both hands.', nodeCount: 16, timeLimit: 420, difficulty: 0.65 },
  { id: 9, name: 'Eastern Campaign', lore: 'The riches of the East beckon. Parthia and its horse archers await.', nodeCount: 18, timeLimit: 480, difficulty: 0.75 },
  { id: 10, name: 'Pax Romana', lore: 'Enforce peace through strength across the entire empire. Rebellion brews everywhere.', nodeCount: 18, timeLimit: 480, difficulty: 0.85 },
  { id: 11, name: 'All Roads Lead to Rome', lore: 'The ultimate test. Every nation rises against Rome. Stand alone against the world.', nodeCount: 20, timeLimit: 540, difficulty: 1.0 },
];

const MONGOLS_CAMPAIGN: CampaignMap[] = [
  { id: 0, name: 'Steppe Riders', lore: 'Unite the scattered clans of the steppe. Only the strongest khan can lead them all.', nodeCount: 8, timeLimit: 240, difficulty: 0.1 },
  { id: 1, name: 'Merkit Vengeance', lore: 'The Merkits stole what is ours. Ride hard and strike without mercy.', nodeCount: 10, timeLimit: 300, difficulty: 0.2 },
  { id: 2, name: 'Tangut Siege', lore: 'The Xi Xia kingdom hides behind walls. Mongol arrows will find every gap.', nodeCount: 10, timeLimit: 280, difficulty: 0.25 },
  { id: 3, name: 'Silk Road Raiders', lore: 'Control the trade routes and the wealth of nations flows to your ger.', nodeCount: 12, timeLimit: 300, difficulty: 0.3 },
  { id: 4, name: 'Great Wall Breach', lore: 'The Jin Dynasty\'s greatest defense falls before Mongol determination.', nodeCount: 12, timeLimit: 320, difficulty: 0.4 },
  { id: 5, name: 'Khwarezm Falls', lore: 'The Shah insulted the Khan. Now his empire will cease to exist.', nodeCount: 14, timeLimit: 360, difficulty: 0.45 },
  { id: 6, name: 'Persian Conquest', lore: 'The ancient land of Persia bows before the unstoppable horde.', nodeCount: 14, timeLimit: 360, difficulty: 0.5 },
  { id: 7, name: 'River of Blood', lore: 'Baghdad\'s libraries burn. The Tigris runs red. Nothing stops the Mongol advance.', nodeCount: 16, timeLimit: 420, difficulty: 0.6 },
  { id: 8, name: 'European Front', lore: 'Hungary and Poland tremble. The western kingdoms have never seen such fury.', nodeCount: 16, timeLimit: 420, difficulty: 0.65 },
  { id: 9, name: 'Song Dynasty', lore: 'Southern China\'s rice paddies and rivers slow the cavalry. Adapt or fail.', nodeCount: 18, timeLimit: 480, difficulty: 0.75 },
  { id: 10, name: 'Divine Wind', lore: 'Japan\'s samurai and sea storms challenge even the Great Khan\'s reach.', nodeCount: 18, timeLimit: 480, difficulty: 0.85 },
  { id: 11, name: 'The Golden Horde', lore: 'Rule the largest empire the world has ever seen. From sea to sea, all is yours.', nodeCount: 20, timeLimit: 540, difficulty: 1.0 },
];

const PTOLEMAIC_CAMPAIGN: CampaignMap[] = [
  { id: 0, name: 'Alexandria Rising', lore: 'Found the great city. The lighthouse will guide ships — and your ambitions — to shore.', nodeCount: 8, timeLimit: 240, difficulty: 0.1 },
  { id: 1, name: 'Library Wars', lore: 'Scholars and spies compete for knowledge. Control the Library, control the world\'s wisdom.', nodeCount: 10, timeLimit: 300, difficulty: 0.2 },
  { id: 2, name: 'Nile Commerce', lore: 'The river trade routes are contested by merchants turned warlords. Restore order.', nodeCount: 10, timeLimit: 280, difficulty: 0.25 },
  { id: 3, name: 'Desert Intrigue', lore: 'Ptolemaic agents weave webs of deception across the desert kingdoms.', nodeCount: 12, timeLimit: 300, difficulty: 0.3 },
  { id: 4, name: 'Seleucid Border', lore: 'The Seleucid Empire presses from the east. Diplomacy has failed — war begins.', nodeCount: 12, timeLimit: 320, difficulty: 0.4 },
  { id: 5, name: 'Cyprus Campaign', lore: 'The island fortress of Cyprus must fall to secure the eastern Mediterranean.', nodeCount: 14, timeLimit: 360, difficulty: 0.45 },
  { id: 6, name: 'Judean Conflicts', lore: 'The Holy Land is a powder keg. Navigate its politics with wisdom and force.', nodeCount: 14, timeLimit: 360, difficulty: 0.5 },
  { id: 7, name: 'Cleopatra\'s Gambit', lore: 'Rome grows powerful. Only cunning and charisma can preserve Ptolemaic independence.', nodeCount: 16, timeLimit: 420, difficulty: 0.6 },
  { id: 8, name: 'Battle of Actium', lore: 'The naval battle that decides the fate of empires. Victory or annihilation.', nodeCount: 16, timeLimit: 420, difficulty: 0.65 },
  { id: 9, name: 'Pharos Defense', lore: 'The lighthouse must not fall. Defend Alexandria from all who covet its treasures.', nodeCount: 18, timeLimit: 480, difficulty: 0.75 },
  { id: 10, name: 'African Expedition', lore: 'Send expeditions south along the Nile to discover and conquer new lands.', nodeCount: 18, timeLimit: 480, difficulty: 0.85 },
  { id: 11, name: 'Queen of the World', lore: 'All the Mediterranean bows to Ptolemaic wisdom. Claim your place as ruler of the known world.', nodeCount: 20, timeLimit: 540, difficulty: 1.0 },
];

const JAPAN_CAMPAIGN: CampaignMap[] = [
  { id: 0, name: 'Yamato Dawn', lore: 'Unite the warring clans of Yamato. The age of the samurai begins here.', nodeCount: 8, timeLimit: 240, difficulty: 0.1 },
  { id: 1, name: 'Shrine Wars', lore: 'Sacred shrines hold strategic power. Control them and the people follow.', nodeCount: 10, timeLimit: 300, difficulty: 0.2 },
  { id: 2, name: 'Sengoku Storm', lore: 'The warring states period erupts. Every daimyo fights for supremacy.', nodeCount: 10, timeLimit: 280, difficulty: 0.25 },
  { id: 3, name: 'Ninja Shadow', lore: 'Espionage and subterfuge. Strike from the shadows before they know you are there.', nodeCount: 12, timeLimit: 300, difficulty: 0.3 },
  { id: 4, name: 'Castle Siege', lore: 'Osaka Castle stands defiant. Break through its legendary defenses.', nodeCount: 12, timeLimit: 320, difficulty: 0.4 },
  { id: 5, name: 'Ronin Rising', lore: 'Masterless warriors band together. Their code: victory or death.', nodeCount: 14, timeLimit: 360, difficulty: 0.45 },
  { id: 6, name: 'Sea of Japan', lore: 'Naval supremacy determines who controls the islands. Dominate the waves.', nodeCount: 14, timeLimit: 360, difficulty: 0.5 },
  { id: 7, name: 'Mongol Invasion', lore: 'The Great Khan sends his fleet. Only the divine wind can save Japan.', nodeCount: 16, timeLimit: 420, difficulty: 0.6 },
  { id: 8, name: 'Kyoto Burns', lore: 'The imperial capital is under siege. Defend the Emperor at all costs.', nodeCount: 16, timeLimit: 420, difficulty: 0.65 },
  { id: 9, name: 'Tokugawa Unification', lore: 'Three great unifiers paved the way. Now finish what they started.', nodeCount: 18, timeLimit: 480, difficulty: 0.75 },
  { id: 10, name: 'Sakoku Decree', lore: 'Close the borders and purge all foreign influence from the islands.', nodeCount: 18, timeLimit: 480, difficulty: 0.85 },
  { id: 11, name: 'Emperor of the Sun', lore: 'From the Land of the Rising Sun, extend your rule across all of Asia.', nodeCount: 20, timeLimit: 540, difficulty: 1.0 },
];

export const CAMPAIGNS: Record<EmpireId, { title: string; maps: CampaignMap[] }> = {
  egypt: { title: 'The March to Babylon', maps: EGYPT_CAMPAIGN },
  rome: { title: 'The Gallic Wars', maps: ROME_CAMPAIGN },
  mongols: { title: 'Ride to the West', maps: MONGOLS_CAMPAIGN },
  ptolemaic: { title: 'Nile to Mediterranean', maps: PTOLEMAIC_CAMPAIGN },
  japan: { title: 'Way of the Samurai', maps: JAPAN_CAMPAIGN },
};

type AllProgress = Record<EmpireId, CampaignProgress>;

const DEFAULT_PROGRESS: CampaignProgress = {
  unlocked: 0,
  stars: new Array(12).fill(0),
};

export function useCampaign() {
  const [progress, setProgress] = useState<AllProgress>({
    egypt: { ...DEFAULT_PROGRESS, stars: [...DEFAULT_PROGRESS.stars] },
    rome: { ...DEFAULT_PROGRESS, stars: [...DEFAULT_PROGRESS.stars] },
    mongols: { ...DEFAULT_PROGRESS, stars: [...DEFAULT_PROGRESS.stars] },
    ptolemaic: { ...DEFAULT_PROGRESS, stars: [...DEFAULT_PROGRESS.stars] },
    japan: { ...DEFAULT_PROGRESS, stars: [...DEFAULT_PROGRESS.stars] },
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setProgress(JSON.parse(raw));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const completeMap = useCallback(async (
    empireId: EmpireId,
    mapIndex: number,
    won: boolean,
    elapsedMs: number,
    abilityUsed: boolean,
  ): Promise<number> => {
    if (!won) return 0;

    let starsEarned = 1; // Star 1: win
    const campaign = CAMPAIGNS[empireId];
    const map = campaign.maps[mapIndex];
    if (elapsedMs / 1000 < map.timeLimit) starsEarned = 2; // Star 2: fast
    if (!abilityUsed) starsEarned = 3; // Star 3: no ability

    setProgress(prev => {
      const next = { ...prev };
      const empProgress = { ...next[empireId], stars: [...next[empireId].stars] };
      empProgress.stars[mapIndex] = Math.max(empProgress.stars[mapIndex], starsEarned);
      if (mapIndex >= empProgress.unlocked) {
        empProgress.unlocked = Math.min(mapIndex + 1, 12);
      }
      next[empireId] = empProgress;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    return starsEarned;
  }, []);

  const getProgress = useCallback((empireId: EmpireId): CampaignProgress => {
    return progress[empireId] || DEFAULT_PROGRESS;
  }, [progress]);

  const getTotalStars = useCallback((empireId: EmpireId): number => {
    return (progress[empireId]?.stars || []).reduce((a, b) => a + b, 0);
  }, [progress]);

  return { progress, loaded, completeMap, getProgress, getTotalStars };
}
