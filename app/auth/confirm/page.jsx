'use client';

// app/auth/confirm/page.jsx
// Publieke pagina — buiten (custom) en (authenticated) layouts, geen auth-guard.
// Verwerkt Supabase invite-tokens: wisselt token_hash uit voor een sessie
// en toont een formulier om een wachtwoord in te stellen.

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <p className="text-[14px] text-white/40">Laden...</p>
      </div>
    }>
      <AuthConfirmInner />
    </Suspense>
  );
}

function AuthConfirmInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  // Stap: 'verifying' | 'set-password' | 'saving' | 'done' | 'error'
  const [step, setStep] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashType = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    console.log('[auth/confirm] query token_hash:', token_hash ? token_hash.slice(0, 20) + '…' : 'null');
    console.log('[auth/confirm] query type:', type);
    console.log('[auth/confirm] hash type:', hashType);
    console.log('[auth/confirm] hash access_token aanwezig:', !!accessToken);
    console.log('[auth/confirm] volledige URL:', window.location.href);

    if (token_hash && type) {
      // PKCE flow: token_hash via query params
      console.log('[auth/confirm] flow: PKCE → verifyOtp aanroepen');
      supabase.auth
        .verifyOtp({ token_hash, type })
        .then(({ data, error }) => {
          console.log('[auth/confirm] verifyOtp resultaat:', { session: !!data?.session, user: data?.user?.id ?? null, error: error?.message ?? null });
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
      return;
    }

    // Implicit (legacy) flow: access_token in URL hash (#access_token=...&type=invite)
    if (hashType === 'invite' && accessToken) {
      // @supabase/ssr verwerkt de hash NIET automatisch via getSession().
      // Gebruik setSession() om de tokens expliciet in te stellen.
      const refreshToken = hashParams.get('refresh_token') ?? '';
      console.log('[auth/confirm] flow: implicit → setSession aanroepen');
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session }, error }) => {
          console.log('[auth/confirm] setSession resultaat:', { session: !!session, userId: session?.user?.id ?? null, error: error?.message ?? null });
          if (error || !session) {
            setErrorMsg('Uitnodigingslink kon niet worden verwerkt. Vraag een nieuwe aan bij je beheerder.');
            setStep('error');
          } else {
            setStep('set-password');
          }
        });
      return;
    }

    console.log('[auth/confirm] geen geldige token gevonden — beide flows falen');
    setErrorMsg('Ongeldige uitnodigingslink. Vraag een nieuwe link aan bij je beheerder.');
    setStep('error');
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
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      },
    });
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
              <p className="text-[14px] font-semibold text-white mb-1">Activeer je account</p>
              <p className="text-[12px] text-white/40 mb-5">
                Vul je naam in en kies een wachtwoord.
              </p>
              <form onSubmit={handleSetPassword} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    placeholder="Voornaam"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    required
                    disabled={step === 'saving'}
                    className="w-1/2 border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                  />
                  <input
                    placeholder="Achternaam"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    required
                    disabled={step === 'saving'}
                    className="w-1/2 border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    placeholder="Nieuw wachtwoord"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={step === 'saving'}
                    className="w-full border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 pr-11 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showNew ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Bevestig wachtwoord"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    disabled={step === 'saving'}
                    className="w-full border border-white/[0.10] bg-white/[0.04] rounded-xl px-4 py-3 pr-11 text-[14px] text-white placeholder-white/25 outline-none focus:border-orange/60 transition-colors disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.75} /> : <Eye className="w-4 h-4" strokeWidth={1.75} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-[12px] text-red-400/80">{passwordError}</p>
                )}
                <button
                  type="submit"
                  disabled={step === 'saving' || !firstName.trim() || !newPassword || !confirmPassword}
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
