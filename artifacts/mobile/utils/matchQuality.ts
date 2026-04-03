/**
 * F12: Match Quality & Playstyle Analysis
 * Calculates post-game metrics for the victory/defeat screen.
 */

export interface MatchQualityResult {
  stars: number; // 0-5
  playstyle: {
    label: string;
    desc: string;
  };
}

export function calculateMatchQuality(
  leadChanges: number,
  playerConquestTotal: number,
  enemyConquestTotal: number,
  elapsedMs: number,
  playerMaxCombo: number,
  playerWon: boolean,
  totalNodes: number,
): number {
  let score = 0;

  // Lead changes (competitive game?)
  if (leadChanges >= 4) score += 3;
  else if (leadChanges >= 2) score += 2;
  else if (leadChanges >= 1) score += 1;

  // Close margin
  const totalCaptures = playerConquestTotal + enemyConquestTotal;
  if (totalCaptures > 0) {
    const margin = Math.abs(playerConquestTotal - enemyConquestTotal) / totalCaptures;
    if (margin < 0.2) score += 1;
  }

  // Reasonable game duration (60s-300s sweet spot)
  const seconds = elapsedMs / 1000;
  if (seconds > 60 && seconds < 300) score += 1;

  // Combo achieved
  if (playerMaxCombo >= 3) score += 0.5;

  // High capture activity
  if (playerConquestTotal >= totalNodes * 0.5) score += 0.5;

  return Math.min(5, Math.round(score));
}

export function getPlaystyle(
  playerFleetsLaunched: number,
  elapsedMs: number,
  playerWon: boolean,
  leadChanges: number,
  playerMaxCombo: number,
): { label: string; desc: string } {
  const seconds = Math.max(1, elapsedMs / 1000);
  const fleetsPerSecond = playerFleetsLaunched / seconds;

  if (fleetsPerSecond > 0.1) {
    return { label: 'AGGRESSIVE', desc: 'You strike fast and hard' };
  }
  if (fleetsPerSecond < 0.03 && playerWon) {
    return { label: 'DEFENSIVE', desc: 'You build strength first' };
  }
  if (leadChanges >= 3 && playerWon) {
    return { label: 'STRATEGIC', desc: 'You adapted to every challenge' };
  }
  if (playerMaxCombo >= 4) {
    return { label: 'RELENTLESS', desc: 'You chain conquests without mercy' };
  }
  return { label: 'BALANCED', desc: 'You adapt to the situation' };
}
