'use client';
// app/(admin)/admin/components/InviteUserForm.jsx

import { useState } from 'react';

export default function InviteUserForm({ hostname }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // null | 'sending' | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('sending');
    setErrorMsg('');

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), hostname }),
    });

    if (res.ok) {
      setStatus('ok');
      setEmail('');
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMsg(data.error || 'Onbekende fout.');
      setStatus('error');
    }
  }

  return (
    <section className="mt-8 pt-6 border-t border-white/10">
      <h2 className="text-sm font-semibold mb-3 text-white/60">Gebruiker uitnodigen</h2>
      <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-sm">
        <input
          type="email"
          required
          placeholder="e-mailadres"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus(null); }}
          disabled={status === 'sending'}
          className="flex-1 bg-white/[0.05] border border-white/[0.10] rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          className="h-9 px-4 rounded-lg bg-orange text-white text-[13px] font-semibold hover:bg-[#e03d00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {status === 'sending' ? 'Versturen...' : 'Uitnodigen'}
        </button>
      </form>
      {status === 'ok' && (
        <p className="mt-2 text-[12px] text-green-400/80">
          Uitnodiging verstuurd naar {hostname}.
        </p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-[12px] text-red-400/80">{errorMsg}</p>
      )}
    </section>
  );
}
