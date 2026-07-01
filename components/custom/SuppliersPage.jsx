'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Package, Utensils, Truck, Printer, Monitor, Warehouse,
  Download, Search, ChevronDown, ChevronUp, Paperclip, Loader2,
} from 'lucide-react';

const CATEGORY_ICONS = {
  materiaal: Package,
  catering:  Utensils,
  transport: Truck,
  drukwerk:  Printer,
  techniek:  Monitor,
  opslag:    Warehouse,
};

function BeoordelingBadge({ beoordeling }) {
  const config = {
    goed:               { cls: 'bg-green-500/15 text-green-400',  label: 'Goed' },
    neutraal:           { cls: 'bg-orange/15 text-orange',         label: 'Neutraal' },
    'niet meer gebruiken': { cls: 'bg-red-500/15 text-red-400',   label: 'Niet meer gebruiken' },
  };
  const c = config[beoordeling] ?? config.neutraal;
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

export default function SuppliersPage({ tenant, suppliers: initialSuppliers }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterRegio, setFilterRegio] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [uploadingForId, setUploadingForId] = useState(null);
  const [uploadError, setUploadError] = useState({});
  const fileInputRef = useRef(null);

  const categories = useMemo(
    () => [...new Set(suppliers.map(s => s.categorie).filter(Boolean))].sort(),
    [suppliers]
  );
  const regios = useMemo(
    () => [...new Set(suppliers.map(s => s.regio).filter(Boolean))].sort(),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter(s => {
      const matchSearch = !q
        || s.naam?.toLowerCase().includes(q)
        || s.contactpersoon?.toLowerCase().includes(q)
        || s.regio?.toLowerCase().includes(q);
      const matchCategorie = !filterCategorie || s.categorie === filterCategorie;
      const matchRegio = !filterRegio || s.regio === filterRegio;
      return matchSearch && matchCategorie && matchRegio;
    });
  }, [suppliers, search, filterCategorie, filterRegio]);

  function startUpload(supplierId) {
    setUploadError(prev => ({ ...prev, [supplierId]: null }));
    setUploadingForId(supplierId);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingForId) return;
    const id = uploadingForId;

    const form = new FormData();
    form.append('file', file);
    form.append('supplier_id', id);

    const res = await fetch('/api/suppliers/upload-bijlage', { method: 'POST', body: form });
    const json = await res.json();
    setUploadingForId(null);

    if (res.ok) {
      setSuppliers(prev => prev.map(s =>
        s.id === id
          ? { ...s, bijlagen: [...(Array.isArray(s.bijlagen) ? s.bijlagen : []), json.bijlage] }
          : s
      ));
    } else {
      setUploadError(prev => ({ ...prev, [id]: json.error ?? 'Upload mislukt' }));
    }
  }

  function exportCSV() {
    const cols = ['naam', 'categorie', 'contactpersoon', 'telefoon', 'email', 'website',
      'regio', 'levertijd', 'prijsindicatie', 'beoordeling', 'bijzonderheden'];
    const escape = v => `"${(v ?? '').toString().replace(/"/g, '""')}"`;
    const rows = filtered.map(s => cols.map(c => escape(s[c])).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leveranciers-${new Date().toISOString().slice(0, 10)}.csv`;
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

        <h1 className="text-xl font-semibold mb-1">Leveranciersdatabase</h1>
        <p className="text-[13px] text-white/50 mb-8">
          Alle leveranciers van {tenant?.name ?? 'het bureau'}.
        </p>

        {/* Zoeken + filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px] flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-white/30 pointer-events-none" strokeWidth={1.75} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam, contactpersoon of regio..."
              className="w-full h-9 pl-8 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
          </div>
          <select
            value={filterCategorie}
            onChange={e => setFilterCategorie(e.target.value)}
            className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white/70 focus:outline-none focus:border-white/20"
          >
            <option value="">Alle categorieën</option>
            {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
          <select
            value={filterRegio}
            onChange={e => setFilterRegio(e.target.value)}
            className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white/70 focus:outline-none focus:border-white/20"
          >
            <option value="">Alle regio's</option>
            {regios.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <p className="text-[11px] text-white/30 uppercase tracking-wide mb-3">
          {filtered.length} leverancier{filtered.length !== 1 ? 's' : ''}
        </p>

        {/* Leverancierskaarten */}
        <div className="space-y-2">
          {filtered.map(sup => {
            const Icon = CATEGORY_ICONS[sup.categorie] ?? Package;
            const isExpanded = expandedId === sup.id;
            return (
              <div
                key={sup.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : sup.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-orange/70" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-white">{sup.naam}</span>
                      {sup.regio && (
                        <span className="text-[12px] text-white/40">{sup.regio}</span>
                      )}
                      <BeoordelingBadge beoordeling={sup.beoordeling} />
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {sup.categorie && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50 capitalize">
                          {sup.categorie}
                        </span>
                      )}
                      {sup.levertijd && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-white/50">
                          {sup.levertijd}
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
                      {sup.contactpersoon && (
                        <Detail label="Contactpersoon" value={sup.contactpersoon} />
                      )}
                      {sup.telefoon && (
                        <Detail label="Telefoon" value={sup.telefoon} />
                      )}
                      {sup.email && (
                        <Detail label="E-mail" value={sup.email} />
                      )}
                      {sup.website && (
                        <Detail label="Website" value={sup.website} />
                      )}
                      {sup.levertijd && (
                        <Detail label="Levertijd" value={sup.levertijd} />
                      )}
                      {sup.prijsindicatie && (
                        <Detail label="Prijsindicatie" value={sup.prijsindicatie} />
                      )}
                      {sup.bijzonderheden && (
                        <Detail label="Bijzonderheden" value={sup.bijzonderheden} wide />
                      )}
                    </div>

                    <div className="mt-4">
                      {Array.isArray(sup.bijlagen) && sup.bijlagen.length > 0 && (
                        <>
                          <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1.5">
                            Bijlagen
                          </p>
                          <div className="flex gap-3 flex-wrap mb-3">
                            {sup.bijlagen.map((b, i) => (
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
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startUpload(sup.id)}
                          disabled={uploadingForId === sup.id}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] bg-white/[0.04] border border-white/[0.07] rounded-md text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-colors disabled:opacity-40"
                        >
                          {uploadingForId === sup.id
                            ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
                            : <Paperclip className="w-3 h-3" strokeWidth={1.75} />
                          }
                          {uploadingForId === sup.id ? 'Uploaden...' : 'Bijlage uploaden'}
                        </button>
                        {uploadError[sup.id] && (
                          <span className="text-[11px] text-red-400">{uploadError[sup.id]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-[13px] text-white/35 py-6">Geen leveranciers gevonden.</p>
          )}
        </div>
      </div>

      {/* Hidden file input — gedeeld door alle leverancierskaarten */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
