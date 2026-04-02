'use client';

import { useState, useEffect } from 'react';

export default function ChaseBadge() {
  const [isChase, setIsChase] = useState(false);

  useEffect(() => {
    setIsChase(window.location.hostname === 'chase.waybetter.nl');
  }, []);

  if (!isChase) return null;

  return (
    <div className="w-full bg-[#111111] border-b border-white/[0.06]" style={{ height: '44px' }}>
      <div className="max-w-[900px] mx-auto px-8 h-full flex items-center justify-between">
        <img
          src="https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg"
          alt="Chase"
          className="h-auto opacity-80"
          style={{ maxWidth: '80px' }}
        />
        <span className="text-[11px] tracking-[0.15em] uppercase text-white/25 font-[family-name:var(--font-outfit)]">
          Powered by Waybetter
        </span>
      </div>
    </div>
  );
}
