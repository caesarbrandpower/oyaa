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

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed || !installPrompt) return null;

  async function install() {
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
  }

  return (
    <div className="text-center mt-8">
      <button
        onClick={install}
        className="h-9 px-5 border-[1.5px] border-white/15 rounded-lg text-xs font-medium text-white/40 hover:border-orange/40 hover:text-orange transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
      >
        &darr; Installeer als app
      </button>
      <p className="text-xs text-[#666] mt-2 font-[family-name:var(--font-outfit)]">
        Werkt in Chrome, Edge en Safari
      </p>
    </div>
  );
}
