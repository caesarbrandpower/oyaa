'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function AuthForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = isRegister
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 font-[family-name:var(--font-outfit)]">
          E-mailadres
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-[1.5px] border-dark-border bg-dark-card rounded-lg px-4 py-3 text-sm text-white outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)] placeholder:text-white/20 font-[family-name:var(--font-outfit)]"
          placeholder="naam@bureau.nl"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 font-[family-name:var(--font-outfit)]">
          Wachtwoord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border-[1.5px] border-dark-border bg-dark-card rounded-lg px-4 py-3 text-sm text-white outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)] placeholder:text-white/20 font-[family-name:var(--font-outfit)]"
          placeholder="Minimaal 6 tekens"
        />
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 font-[family-name:var(--font-outfit)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)] disabled:bg-white/10 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer font-[family-name:var(--font-outfit)]"
      >
        {loading ? 'Even geduld...' : isRegister ? 'Account aanmaken' : 'Inloggen'}
      </button>

      <p className="text-center text-sm text-white/35 font-[family-name:var(--font-outfit)]">
        {isRegister ? 'Al een account?' : 'Nog geen account?'}{' '}
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          className="text-orange font-medium hover:underline cursor-pointer"
        >
          {isRegister ? 'Inloggen' : 'Registreren'}
        </button>
      </p>
    </form>
  );
}
