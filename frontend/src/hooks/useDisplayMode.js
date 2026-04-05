import { useEffect, useState } from 'react';
import { DISPLAY_MODE } from '../utils/formatters.js';

const STORAGE_KEY = 'neowatch-display-mode';

export function useDisplayMode() {
  const [mode, setMode] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === DISPLAY_MODE.HUMAN ? DISPLAY_MODE.HUMAN : DISPLAY_MODE.NERD;
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((current) => current === DISPLAY_MODE.HUMAN ? DISPLAY_MODE.NERD : DISPLAY_MODE.HUMAN);
  };

  return {
    mode,
    isHumanMode: mode === DISPLAY_MODE.HUMAN,
    toggleMode,
    setMode,
  };
}
