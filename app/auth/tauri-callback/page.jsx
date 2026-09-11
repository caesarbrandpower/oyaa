'use client';

// app/auth/tauri-callback/page.jsx
// Publieke pagina — buiten auth-guard. Verwerkt sessietokens die de Tauri-shell
// via een URL-hash meestuurt. Hash wordt nooit naar de server gestuurd.
// Na setSession() heeft de webapp een geldig cookie en gaan we naar /app.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function TauriCallbackPage() {
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=missing_tokens');
      return;
    }

    import('@/lib/supabase-browser').then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            router.replace('/login?error=session_failed');
          } else {
            router.replace('/app');
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
      <div className="flex gap-[7px] items-center">
        <span className="w-[5px] h-[5px] rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-[5px] h-[5px] rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '200ms' }} />
        <span className="w-[5px] h-[5px] rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
