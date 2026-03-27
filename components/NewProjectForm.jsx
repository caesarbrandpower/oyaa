'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';

export default function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('projects').insert({
      name: name.trim(),
      client_name: clientName.trim() || null,
      user_id: user.id,
    });

    setName('');
    setClientName('');
    setOpen(false);
    setLoading(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-12 px-6 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)]"
      >
        + Nieuw project
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl p-6 space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Projectnaam
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          placeholder="Bijv. Zomercampagne 2026"
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Klant <span className="font-normal">(optioneel)</span>
        </label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Bijv. Nike"
          className="w-full border-[1.5px] border-border rounded-lg px-4 py-3 text-sm text-text outline-none transition-all focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-5 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Aanmaken...' : 'Aanmaken'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-10 px-5 text-sm text-text-sec hover:text-text transition-colors"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
