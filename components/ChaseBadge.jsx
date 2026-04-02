'use client';

import { useState, useEffect } from 'react';

export default function ChaseBadge() {
  const [isChase, setIsChase] = useState(false);

  useEffect(() => {
    setIsChase(window.location.hostname === 'chase.waybetter.nl');
  }, []);

  if (!isChase) return null;

  return (
    <div className="w-full bg-white/[0.03] border-b border-white/[0.06]" style={{ height: '52px' }}>
      <div className="max-w-[900px] mx-auto px-8 h-full flex items-center justify-between">
        <img
          src="https://www.chase.amsterdam/content/themes/chase/images/chase-brand-activation-white.svg"
          alt="Chase"
          style={{ height: '20px', width: 'auto' }}
        />
        <span className="text-[10px] tracking-[0.1em] uppercase text-white/40 font-[family-name:var(--font-outfit)]">
          Powered by Waybetter
        </span>
      </div>
    </div>
  );
}
