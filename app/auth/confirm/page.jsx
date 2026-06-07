'use client';

// app/auth/confirm/page.jsx
// Publieke pagina — buiten (custom) en (authenticated) layouts, geen auth-guard.
// Verwerkt Supabase invite-tokens: wisselt token_hash uit voor een sessie
// en toont een formulier om een wachtwoord in te stellen.

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

export default function AuthConfirmPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // Stap: 'verifying' | 'set-password' | 'saving' | 'done' | 'error'
  const [step, setStep] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    if (!token_hash || !type) {
      setErrorMsg('Ongeldige uitnodigingslink. Vraag een nieuwe link aan bij je beheerder.');
      setStep('error');
      return;
    }

    supabase.auth
      .verifyOtp({ token_hash, type })
      .then(({ error }) => {
        if (error) {
          setErrorMsg(
            error.message === 'Token has expired or is invalid'
              ? 'Deze uitnodigingslink is verlopen of al gebruikt. Vraag een nieuwe aan bij je beheerder.'
              : error.message
          );
          setStep('error');
        } else {
          setStep('set-password');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSetPassword(e) {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Wachtwoorden komen niet overeen.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Wachtwoord moet minimaal 6 tekens zijn.');
      return;
    }

    setStep('saving');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordError(error.message);
      setStep('set-password');
    } else {
      setStep('done');
      setTimeout(() => router.push('/app'), 1500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] px-6">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[10%] left-[20%] w-[400px] h-[400px] rounded-full bg-orange/[0.04] blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] w-[300px] h-[300px] rounded-full bg-orange/[0.03] blur-[100px]" />
      </div>

      <div className="relative w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-10 text-center">
          <h1 className="font-[family-name:var(--font-lexend)] text-3xl tracking-[0.15em] font-bold text-orange uppercase mb-3">
            Waybetter
          </h1>
          <p className="text-[15px] text-white/40 font-[family-name:var(--font-outfit)]">
            Jouw bureau cockpit
          </p>
        </div>

        <div className="bg-[#161616] border border-white/[0.08] rounded-2xl p-6">
          {step === 'verifying' && (
            <p className="text-[14px] text-white/50 text-center py-4">
              Uitnodiging verifiëren...
            </p>
          )}

          {step === 'error' && (
            <>
              <p className="text-[13px] font-semibold text-white mb-1">Uitnodiging niet geldig</p>
              <p className="text-[13px] text-white/50">{errorMsg}</p>
            </>
          )}

          {(step === 'set-password' || step === 'saving') && (
            <>
              <p className="text-[14px] font-semibold text-white mb-1">Stel je wachtwoord in</p>
              <p className="text-[12px] text-white/40 mb-5">
                Kies een wachtwoord om je account te activeren.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-3">
                <input
                  type="password"
                  placeholder="Nieuw wachtwoord"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={step === 'saving'}
                  className="w-full border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                />
                <input
                  type="password"
                  placeholder="Bevestig wachtwoord"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  disabled={step === 'saving'}
                  className="w-full border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                />
                {passwordError && (
                  <p className="text-[12px] text-red-400/80">{passwordError}</p>
                )}
                <button
                  type="submit"
                  disabled={step === 'saving' || !newPassword || !confirmPassword}
                  className="w-full h-11 bg-orange text-white rounded-xl text-[14px] font-semibold transition-all hover:bg-[#e03d00] shadow-[0_2px_8px_rgba(255,72,0,0.32)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {step === 'saving' ? 'Opslaan...' : 'Account activeren'}
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <p className="text-[14px] text-white/70 text-center py-4">
              Wachtwoord ingesteld. Je wordt doorgestuurd...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
