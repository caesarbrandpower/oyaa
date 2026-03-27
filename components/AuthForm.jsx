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

    router.push('/projects');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          E-mailadres
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
          placeholder="naam@bureau.nl"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Wachtwoord
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 font-[family-name:var(--font-inter)] text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
          placeholder="Minimaal 6 tekens"
        />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed"
      >
        {loading ? 'Even geduld...' : isRegister ? 'Account aanmaken' : 'Inloggen'}
      </button>

      <p className="text-center text-sm text-text-sec">
        {isRegister ? 'Al een account?' : 'Nog geen account?'}{' '}
        <button
          type="button"
          onClick={() => { setIsRegister(!isRegister); setError(null); }}
          className="text-orange font-medium hover:underline"
        >
          {isRegister ? 'Inloggen' : 'Registreren'}
        </button>
      </p>
    </form>
  );
}
