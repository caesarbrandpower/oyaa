'use client';

import { useState, useEffect } from 'react';

export default function ChaseBadge() {
  const [isChase, setIsChase] = useState(false);

  useEffect(() => {
    setIsChase(window.location.hostname === 'chase.waybetter.nl');
  }, []);

  if (!isChase) return null;

  return (
    <div className="flex items-center gap-3 mb-6 animate-hero-1">
      <img
        src="https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg"
        alt="Chase"
        className="h-auto opacity-40"
        style={{ maxWidth: '80px' }}
      />
      <span className="text-[11px] tracking-[0.15em] text-white/25 uppercase font-[family-name:var(--font-outfit)]">
        powered by Waybetter
      </span>
    </div>
  );
}
