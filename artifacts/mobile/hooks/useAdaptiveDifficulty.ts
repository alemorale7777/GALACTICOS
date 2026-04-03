import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = '@thraxon_ai_calibration';

export function useAdaptiveDifficulty() {
  const [calibration, setCalibration] = useState(1.0);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const val = parseFloat(raw);
          if (!isNaN(val)) setCalibration(Math.max(0.7, Math.min(1.3, val)));
        }
        loadedRef.current = true;
      } catch {}
    })();
  }, []);

  const recordResult = useCallback((playerWon: boolean, margin: number) => {
    setCalibration(prev => {
      let adjustment = 0;
      if (playerWon && margin > 0.4) adjustment = 0.05;
      else if (playerWon && margin > 0.2) adjustment = 0.03;
      else if (!playerWon && margin > 0.4) adjustment = -0.05;
      else if (!playerWon && margin > 0.2) adjustment = -0.03;
      // Tight games: no adjustment

      const next = Math.max(0.7, Math.min(1.3, prev + adjustment));
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

  const getDifficultyLabel = useCallback(() => {
    if (calibration > 1.15) return 'VETERAN';
    if (calibration < 0.85) return 'NOVICE';
    return null;
  }, [calibration]);

  return { calibration, recordResult, getDifficultyLabel };
}
