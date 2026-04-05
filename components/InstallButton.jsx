'use client';

import { useState, useEffect } from 'react';

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
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

    return () => window.removeEventListener('beforeinstallprompt', handler);
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
      {installPrompt ? (
        <button
          onClick={install}
          className="h-10 px-6 border-[1.5px] border-white/15 rounded-lg text-[13px] font-medium text-white/50 hover:border-orange/40 hover:text-orange transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
        >
          Installeer de app
        </button>
      ) : (
        <p className="text-[11px] text-white/25 font-[family-name:var(--font-outfit)] leading-relaxed">
          Installeer Waybetter als app via je browser:<br />
          <span className="text-white/35">Chrome/Edge:</span> klik op het installatie-icoon in de adresbalk<br />
          <span className="text-white/35">Safari:</span> tik op Deel &gt; Zet op beginscherm
        </p>
      )}
      <p className="text-[11px] text-white/20 mt-2.5 font-[family-name:var(--font-outfit)]">
        Voeg Waybetter toe aan je bureaublad voor snelle toegang.
      </p>
      <p className="text-xs text-white/20 mt-2 font-[family-name:var(--font-outfit)]">
        Werkt in Chrome, Edge en Safari.<br />
        Openen in een andere browser? Gebruik de webversie gewoon via waybetter.nl
      </p>
    </div>
  );
}
