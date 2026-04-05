'use client';

import { useState, useEffect } from 'react';

export default function InstallPWA() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [standalone, setStandalone] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setStandalone(true);
      setReady(true);
      return;
    }

    function handler(e) {
      e.preventDefault();
      setInstallPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setStandalone(true));

    // Give the browser a moment to fire beforeinstallprompt
    const timer = setTimeout(() => setReady(true), 1000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  if (standalone || !ready) return null;

  async function install() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setStandalone(true);
  }

  return (
    <div className="text-center mt-8">
      {installPrompt ? (
        <button
          onClick={install}
          className="h-9 px-5 border-[1.5px] border-white/15 rounded-lg text-xs font-medium text-white/40 hover:border-orange/40 hover:text-orange transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
        >
          &darr; Installeer als app
        </button>
      ) : (
        <p className="text-xs text-white/30 font-[family-name:var(--font-outfit)]">
          &darr; Installeer via Chrome, Edge of Safari
        </p>
      )}
      <p className="text-xs text-[#666] mt-2 font-[family-name:var(--font-outfit)]">
        Werkt in Chrome, Edge en Safari
      </p>
    </div>
  );
}
