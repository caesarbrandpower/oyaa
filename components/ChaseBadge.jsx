'use client';

import { useState, useEffect } from 'react';

export default function ChaseBadge() {
  const [isChase, setIsChase] = useState(false);

  useEffect(() => {
    setIsChase(window.location.hostname === 'chase.waybetter.nl');
  }, []);

  if (!isChase) return null;

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-white/[0.08]" style={{ height: '44px' }}>
      <div className="w-full px-8 h-full flex items-center justify-between">
        <img
          src="https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg"
          alt="Chase"
          className="h-auto"
          style={{ maxWidth: '90px' }}
        />
        <span className="text-[10px] tracking-[0.15em] uppercase text-white/20 font-[family-name:var(--font-outfit)]">
          Powered by Waybetter
        </span>
      </div>
    </div>
  );
}
