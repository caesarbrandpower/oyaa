'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Train, ShoppingBag, Tent, Music, Store,
  Download, Search, ChevronDown, ChevronUp,
} from 'lucide-react';

const CHANNEL_ICONS = {
  'Centrumlocatie': MapPin,
  'Treinstation': Train,
  'Winkelcentrum': ShoppingBag,
  'Outdoor': Tent,
  'Event': Music,
  'Markt': Store,
};

function VergunningBadge({ status }) {
  const config = {
    aanwezig: { cls: 'bg-green-500/15 text-green-400', label: 'Vergunning aanwezig' },
    verlopen:  { cls: 'bg-orange/15 text-orange',       label: 'Vergunning verlopen' },
    geen:      { cls: 'bg-white/10 text-white/35',      label: 'Geen vergunning' },
  };
  const c = config[status] ?? config.geen;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${c.cls}`}>
      {c.label}
    </span>
  );
}

function Detail({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[11px] text-white/35 mb-0.5 uppercase tracking-wide">{label}</p>
      <p className="text-[13px] text-white/80 leading-snug">{value}</p>
    </div>
  );
}

export default function LocationsPage({ tenant, locations: initialLocations }) {
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterDoelgroep, setFilterDoelgroep] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const channels = useMemo(
    () => [...new Set(initialLocations.map(l => l.channel).filter(Boolean))].sort(),
    [initialLocations]
  );
  const doelgroepen = useMemo(
    () => [...new Set(initialLocations.map(l => l.doelgroep).filter(Boolean))].sort(),
    [initialLocations]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return initialLocations.filter(l => {
      const matchSearch = !q
        || l.naam?.toLowerCase().includes(q)
        || l.stad?.toLowerCase().includes(q);
      const matchChannel = !filterChannel || l.channel === filterChannel;
      const matchDoelgroep = !filterDoelgroep || l.doelgroep === filterDoelgroep;
      return matchSearch && matchChannel && matchDoelgroep;
    });
  }, [initialLocations, search, filterChannel, filterDoelgroep]);

  function exportCSV() {
    const cols = ['naam', 'stad', 'channel', 'doelgroep', 'parkeren', 'laden_lossen',
      'vergunning_status', 'vergunning_vervaldatum', 'bijzonderheden'];
    const escape = v => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
    const rows = filtered.map(l => cols.map(c => escape(l[c])).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `locaties-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
            Terug naar chat
          </Link>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            Exporteren
          </button>
        </div>

        <h1 className="text-xl font-semibold mb-1">Locatiedatabase</h1>
        <p className="text-[13px] text-white/50 mb-8">
          Alle veldlocaties van {tenant?.name ?? 'het bureau'}.
        </p>

        {/* Zoeken + filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam of stad..."
              className="w-full h-9 pl-8 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white/70 focus:outline-none focus:border-white/20"
          >
            <option value="">Alle channels</option>
            {channels.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterDoelgroep}
            onChange={e => setFilterDoelgroep(e.target.value)}
            className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white/70 focus:outline-none focus:border-white/20"
          >
            <option value="">Alle doelgroepen</option>
            {doelgroepen.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <p className="text-[11px] text-white/30 uppercase tracking-wide mb-3">
          {filtered.length} locatie{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Locatiekaarten */}
        <div className="space-y-2">
          {filtered.map(loc => {
            const Icon = CHANNEL_ICONS[loc.channel] ?? MapPin;
            const isExpanded = expandedId === loc.id;
            return (
              <div
                key={loc.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-orange/70" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-white">{loc.naam}</span>
                      {loc.stad && (
                        <span className="text-[12px] text-white/40">{loc.stad}</span>
                      )}
                      <VergunningBadge status={loc.vergunning_status} />
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {loc.channel && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50">
                          {loc.channel}
                        </span>
                      )}
                      {loc.doelgroep && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50">
                          {loc.doelgroep}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-1 text-white/30" strokeWidth={1.75} />
                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-1 text-white/30" strokeWidth={1.75} />
                  }
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-3">
                      {loc.parkeren && (
                        <Detail label="Parkeren" value={loc.parkeren} />
                      )}
                      {loc.laden_lossen && (
                        <Detail label="Laden & lossen" value={loc.laden_lossen} />
                      )}
                      {loc.vergunning_vervaldatum && (
                        <Detail
                          label="Vergunning vervalt"
                          value={new Date(loc.vergunning_vervaldatum).toLocaleDateString('nl-NL')}
                        />
                      )}
                      {loc.bijzonderheden && (
                        <Detail label="Bijzonderheden" value={loc.bijzonderheden} wide />
                      )}
                    </div>

                    {Array.isArray(loc.bijlagen) && loc.bijlagen.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1.5">
                          Bijlagen
                        </p>
                        <div className="flex gap-3 flex-wrap">
                          {loc.bijlagen.map((b, i) => (
                            <a
                              key={i}
                              href={b.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] text-orange underline-offset-2 hover:underline"
                            >
                              {b.naam ?? `Bijlage ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-[13px] text-white/35 py-6">Geen locaties gevonden.</p>
          )}
        </div>
      </div>
    </div>
  );
}
