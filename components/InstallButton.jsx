'use client';

import { useState, useEffect } from 'react';

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    function handler(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  }

  return (
    <div className="text-center mt-8">
      {installPrompt && (
        <button
          onClick={install}
          className="h-10 px-6 border-[1.5px] border-white/15 rounded-lg text-[13px] font-medium text-white/50 hover:border-orange/40 hover:text-orange transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] mb-3"
        >
          Installeer de app
        </button>
      )}
      <p className="text-xs text-white/25 font-[family-name:var(--font-outfit)] flex items-center justify-center gap-1.5">
        Installeer als app
        <span className="relative group">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-white/20 text-[10px] text-white/30 cursor-help leading-none">i</span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-3 bg-[#1a1a1a] border border-white/10 rounded-lg text-[11px] text-white/70 leading-relaxed whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 font-[family-name:var(--font-outfit)]">
            <span className="text-white/40">Chrome/Edge:</span> klik het installatie-icoon in de adresbalk<br />
            <span className="text-white/40">Safari:</span> Deel &rarr; Zet op beginscherm<br />
            <span className="text-white/40">Werkt op Mac, Windows en iPhone.</span>
          </span>
        </span>
      </p>
    </div>
  );
}
