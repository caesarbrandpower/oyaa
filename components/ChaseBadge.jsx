'use client';

import { useState, useEffect } from 'react';

export default function ChaseBadge() {
  const [isChase, setIsChase] = useState(false);

  useEffect(() => {
    setIsChase(window.location.hostname === 'chase.waybetter.nl');
  }, []);

  if (!isChase) return null;

  return (
    <img
      src="https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg"
      alt="Chase"
      className="h-auto opacity-60"
      style={{ maxWidth: '60px' }}
    />
  );
}
