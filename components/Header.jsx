'use client';

import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function Header() {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-white">
      <div className="max-w-[800px] mx-auto px-8 h-14 flex items-center justify-between">
        <a href="/projects" className="font-[family-name:var(--font-lexend)] text-xl font-bold text-text">
          Oyaa<span className="text-orange">.</span>
        </a>
        <button
          onClick={handleLogout}
          className="text-sm text-text-muted hover:text-text transition-colors"
        >
          Uitloggen
        </button>
      </div>
    </header>
  );
}
