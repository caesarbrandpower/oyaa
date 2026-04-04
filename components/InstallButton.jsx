'use client';

import { useState, useEffect } from 'react';

export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!prompt) return null;

  async function install() {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setPrompt(null);
  }

  return (
    <div className="text-center mt-8">
      <button
        onClick={install}
        className="h-10 px-6 border-[1.5px] border-white/15 rounded-lg text-[13px] font-medium text-white/50 hover:border-orange/40 hover:text-orange transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
      >
        Installeer de app
      </button>
      <p className="text-[11px] text-white/20 mt-2.5 font-[family-name:var(--font-outfit)]">
        Voeg Waybetter toe aan je bureaublad voor snelle toegang.
      </p>
    </div>
  );
}
