'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-browser';
import Link from 'next/link';

export default function AuthNav() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoaded(true);
    });
  }, [supabase.auth]);

  if (!loaded) return null;

  if (user) {
    return (
      <div className="absolute top-6 right-8 z-10 flex items-center gap-4 max-[640px]:top-4 max-[640px]:right-4">
        <span className="text-[13px] text-white/30 font-[family-name:var(--font-outfit)] max-[480px]:hidden">
          {user.email}
        </span>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.reload();
          }}
          className="text-[13px] text-white/40 hover:text-orange transition-colors font-[family-name:var(--font-outfit)] cursor-pointer"
        >
          Uitloggen
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="absolute top-6 right-8 z-10 text-[13px] text-white/35 hover:text-orange transition-colors font-[family-name:var(--font-outfit)] no-underline max-[640px]:top-4 max-[640px]:right-4"
    >
      Inloggen
    </Link>
  );
}
