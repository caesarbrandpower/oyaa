'use client';

import { useState, useCallback } from 'react';

export function useSoundToggle() {
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('waybetter-sounds') !== 'off';
  });

  const toggleSounds = useCallback(() => {
    setSoundsEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('waybetter-sounds', next ? 'on' : 'off');
      return next;
    });
  }, []);

  return { soundsEnabled, toggleSounds };
}
