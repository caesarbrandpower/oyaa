'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Package, Utensils, Truck, Printer, Monitor, Warehouse,
  Download, Search, ChevronDown, ChevronUp, Paperclip, Loader2,
  Plus, X, Pencil, Check, Star, Copy,
} from 'lucide-react';

const CATEGORIES = ['materiaal', 'catering', 'transport', 'drukwerk', 'techniek', 'opslag'];
const BEOORDELINGEN = ['goed', 'neutraal', 'niet meer gebruiken'];

const CATEGORY_ICONS = {
  materiaal: Package,
  catering:  Utensils,
  transport: Truck,
  drukwerk:  Printer,
  techniek:  Monitor,
  opslag:    Warehouse,
};

function DetailLabel({ children }) {
  return <p className="text-[11px] text-white/35 mb-0.5 uppercase tracking-wide">{children}</p>;
}

function DetailItem({ label, children, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <DetailLabel>{label}</DetailLabel>
      <div className="text-[13px] text-white/80 leading-snug">{children}</div>
    </div>
  );
}

const INPUT_CLS = 'w-full h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20';
const SELECT_CLS = 'w-full h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white/70 focus:outline-none focus:border-white/20';
const LABEL_CLS = 'block text-[11px] text-white/40 uppercase tracking-wide mb-1';

const EMPTY_SUPPLIER = {
  naam: '', omschrijving: '', categorie: '', contactpersoon: '',
  telefoon: '', email: '', website: '', regio: '',
  levertijd: '', prijsindicatie: '', beoordeling: '', bijzonderheden: '',
};

function buildCopyText(sup) {
  const sections = [];

  sections.push([sup.naam, [sup.categorie, sup.regio].filter(Boolean).join(' · ')].filter(Boolean).join('\n'));

  if (sup.omschrijving) sections.push(sup.omschrijving);

  const contact = [
    sup.contactpersoon && `Contact: ${sup.contactpersoon}`,
    sup.telefoon && `📞 ${sup.telefoon}`,
    sup.email && `✉️ ${sup.email}`,
    sup.website && `🌐 ${sup.website}`,
  ].filter(Boolean);
  if (contact.length) sections.push(contact.join('\n'));

  const logistiek = [
    sup.levertijd && `Levertijd: ${sup.levertijd}`,
    sup.prijsindicatie && `Prijs: ${sup.prijsindicatie}`,
  ].filter(Boolean);
  if (logistiek.length) sections.push(logistiek.join('\n'));

  if (sup.bijzonderheden) sections.push(`Bijzonderheden:\n${sup.bijzonderheden}`);

  return sections.join('\n\n');
}

export default function SuppliersPage({ tenant, suppliers: initialSuppliers }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState('');
  const [filterCategorie, setFilterCategorie] = useState('');
  const [filterRegio, setFilterRegio] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [uploadingForId, setUploadingForId] = useState(null);
  const [uploadError, setUploadError] = useState({});
  const [editingBijz, setEditingBijz] = useState(null);
  const [savingBijz, setSavingBijz] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSupplier, setNewSupplier] = useState(EMPTY_SUPPLIER);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [formBijlagen, setFormBijlagen] = useState([]);
  const [uploadingForm, setUploadingForm] = useState(false);
  const fileInputRef = useRef(null);
  const formFileRef = useRef(null);

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
    const matches = suppliers.filter(s => {
      const matchSearch = !q
        || s.naam?.toLowerCase().includes(q)
        || s.contactpersoon?.toLowerCase().includes(q)
        || s.regio?.toLowerCase().includes(q)
        || s.omschrijving?.toLowerCase().includes(q);
      const matchCategorie = !filterCategorie || s.categorie === filterCategorie;
      const matchRegio = !filterRegio || s.regio === filterRegio;
      return matchSearch && matchCategorie && matchRegio;
    });
    // Favorieten bovenaan
    return [...matches].sort((a, b) => {
      if (a.favoriet && !b.favoriet) return -1;
      if (!a.favoriet && b.favoriet) return 1;
      return a.naam.localeCompare(b.naam, 'nl');
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

  async function saveBijzonderheden(id) {
    setSavingBijz(id);
    const res = await fetch('/api/suppliers/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: id, bijzonderheden: editingBijz.value }),
    });
    const json = await res.json();
    setSavingBijz(null);
    if (res.ok) {
      setSuppliers(prev => prev.map(s =>
        s.id === id ? { ...s, bijzonderheden: json.supplier.bijzonderheden } : s
      ));
      setEditingBijz(null);
    }
  }

  async function toggleFavoriet(id, current) {
    // Optimistische update
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, favoriet: !current } : s));
    const res = await fetch('/api/suppliers/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: id, favoriet: !current }),
    });
    if (!res.ok) {
      // Terugdraaien bij fout
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, favoriet: current } : s));
    }
  }

  function copyCard(sup) {
    navigator.clipboard.writeText(buildCopyText(sup));
    setCopiedId(sup.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleFormFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingForm(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/upload-bijlage-temp', { method: 'POST', body: form });
    const json = await res.json();
    setUploadingForm(false);
    if (res.ok) setFormBijlagen(prev => [...prev, json.bijlage]);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newSupplier.naam.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/suppliers/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newSupplier, bijlagen: formBijlagen }),
    });
    const json = await res.json();
    setCreating(false);
    if (res.ok) {
      setSuppliers(prev => [json.supplier, ...prev]);
      setNewSupplier(EMPTY_SUPPLIER);
      setFormBijlagen([]);
      setShowAddForm(false);
    } else {
      setCreateError(json.error ?? 'Opslaan mislukt');
    }
  }

  function exportCSV() {
    const cols = ['naam', 'omschrijving', 'categorie', 'contactpersoon', 'telefoon', 'email',
      'website', 'regio', 'levertijd', 'prijsindicatie', 'bijzonderheden'];
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

  function normalizeUrl(url) {
    if (!url) return null;
    return url.startsWith('http') ? url : `https://${url}`;
  }
  function displayUrl(url) {
    return url?.replace(/^https?:\/\//, '') ?? '';
  }

  return (
    // h-full overflow-y-auto: scrollt binnen de h-screen overflow-hidden layout
    <div className="h-full overflow-y-auto bg-[#0d0d0d] text-white">
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
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] bg-white/[0.05] border border-white/[0.08] rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
              Exporteren
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-[12px] bg-white/[0.08] border border-white/[0.12] rounded-lg text-white/80 hover:text-white hover:bg-white/[0.12] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
              Voeg toe
            </button>
          </div>
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
            {categories.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
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
            const isEditingBijz = editingBijz?.id === sup.id;
            return (
              <div
                key={sup.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
              >
                {/* Dichte kaart — div i.p.v. button zodat we knoppen kunnen nesten */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sup.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-orange/70" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-white">{sup.naam}</span>
                      {sup.regio && (
                        <span className="text-[12px] text-white/40">{sup.regio}</span>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
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
                    {sup.omschrijving && (
                      <p className="mt-1.5 text-[12px] text-white/45 leading-snug line-clamp-2">
                        {sup.omschrijving}
                      </p>
                    )}
                  </div>

                  {/* Actieknoppen — stoppen propagatie zodat kaart niet in-/uitklapt */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => copyCard(sup)}
                      title="Kopieer naar klembord"
                      className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    >
                      {copiedId === sup.id
                        ? <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={1.75} />
                        : <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      }
                    </button>
                    <button
                      onClick={() => toggleFavoriet(sup.id, sup.favoriet)}
                      title={sup.favoriet ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
                      className="p-1 transition-colors"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${sup.favoriet ? 'text-yellow-400' : 'text-white/20 hover:text-yellow-400/60'}`}
                        fill={sup.favoriet ? 'currentColor' : 'none'}
                        strokeWidth={1.75}
                      />
                    </button>
                  </div>

                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-1 text-white/30" strokeWidth={1.75} />
                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-1 text-white/30" strokeWidth={1.75} />
                  }
                </div>

                {/* Uitgevouwen detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-3">
                      {sup.contactpersoon && (
                        <DetailItem label="Contactpersoon">{sup.contactpersoon}</DetailItem>
                      )}
                      {sup.telefoon && (
                        <DetailItem label="Telefoon">
                          <a href={`tel:${sup.telefoon}`} className="text-orange underline-offset-2 hover:underline">
                            {sup.telefoon}
                          </a>
                        </DetailItem>
                      )}
                      {sup.email && (
                        <DetailItem label="E-mail">
                          <a href={`mailto:${sup.email}`} className="text-orange underline-offset-2 hover:underline">
                            {sup.email}
                          </a>
                        </DetailItem>
                      )}
                      {sup.website && (
                        <DetailItem label="Website">
                          <a href={normalizeUrl(sup.website)} target="_blank" rel="noopener noreferrer" className="text-orange underline-offset-2 hover:underline">
                            {displayUrl(sup.website)}
                          </a>
                        </DetailItem>
                      )}
                      {sup.levertijd && (
                        <DetailItem label="Levertijd">{sup.levertijd}</DetailItem>
                      )}
                      {sup.prijsindicatie && (
                        <DetailItem label="Prijsindicatie">{sup.prijsindicatie}</DetailItem>
                      )}

                      {/* Bijzonderheden — inline bewerkbaar */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <DetailLabel>Bijzonderheden</DetailLabel>
                          {!isEditingBijz && (
                            <button
                              onClick={() => setEditingBijz({ id: sup.id, value: sup.bijzonderheden ?? '' })}
                              className="text-white/25 hover:text-white/60 transition-colors"
                            >
                              <Pencil className="w-2.5 h-2.5" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                        {isEditingBijz ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingBijz.value}
                              onChange={e => setEditingBijz(prev => ({ ...prev, value: e.target.value }))}
                              rows={3}
                              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.12] rounded-lg text-[13px] text-white/80 leading-snug resize-none focus:outline-none focus:border-white/25"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveBijzonderheden(sup.id)}
                                disabled={savingBijz === sup.id}
                                className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] bg-white/[0.08] border border-white/[0.12] rounded-md text-white/80 hover:text-white disabled:opacity-40 transition-colors"
                              >
                                {savingBijz === sup.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
                                  : <Check className="w-3 h-3" strokeWidth={1.75} />
                                }
                                Opslaan
                              </button>
                              <button
                                onClick={() => setEditingBijz(null)}
                                className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                              >
                                Annuleren
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[13px] text-white/80 leading-snug">
                            {sup.bijzonderheden || (
                              <span className="text-white/25 italic">Geen bijzonderheden</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bijlagen */}
                    <div className="mt-4">
                      {Array.isArray(sup.bijlagen) && sup.bijlagen.length > 0 && (
                        <>
                          <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1.5">Bijlagen</p>
                          <div className="flex gap-3 flex-wrap mb-3">
                            {sup.bijlagen.map((b, i) => (
                              <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-orange underline-offset-2 hover:underline">
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

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />

      {/* Toevoegen modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/[0.08] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[15px] font-semibold">Nieuwe leverancier</h2>
              <button onClick={() => { setShowAddForm(false); setFormBijlagen([]); }} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className={LABEL_CLS}>Naam *</label>
                <input type="text" required value={newSupplier.naam} onChange={e => setNewSupplier(p => ({ ...p, naam: e.target.value }))} className={INPUT_CLS} placeholder="Naam van de leverancier" />
              </div>
              <div>
                <label className={LABEL_CLS}>Omschrijving</label>
                <textarea rows={2} value={newSupplier.omschrijving} onChange={e => setNewSupplier(p => ({ ...p, omschrijving: e.target.value }))} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none" placeholder="Korte beschrijving..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Categorie</label>
                  <select value={newSupplier.categorie} onChange={e => setNewSupplier(p => ({ ...p, categorie: e.target.value }))} className={SELECT_CLS}>
                    <option value="">Kies categorie</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Regio</label>
                  <input type="text" value={newSupplier.regio} onChange={e => setNewSupplier(p => ({ ...p, regio: e.target.value }))} className={INPUT_CLS} placeholder="bijv. Nationaal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Contactpersoon</label>
                  <input type="text" value={newSupplier.contactpersoon} onChange={e => setNewSupplier(p => ({ ...p, contactpersoon: e.target.value }))} className={INPUT_CLS} placeholder="Naam" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Telefoon</label>
                  <input type="tel" value={newSupplier.telefoon} onChange={e => setNewSupplier(p => ({ ...p, telefoon: e.target.value }))} className={INPUT_CLS} placeholder="020-000 0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>E-mail</label>
                  <input type="email" value={newSupplier.email} onChange={e => setNewSupplier(p => ({ ...p, email: e.target.value }))} className={INPUT_CLS} placeholder="naam@bedrijf.nl" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Website</label>
                  <input type="text" value={newSupplier.website} onChange={e => setNewSupplier(p => ({ ...p, website: e.target.value }))} className={INPUT_CLS} placeholder="bedrijf.nl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Levertijd</label>
                  <input type="text" value={newSupplier.levertijd} onChange={e => setNewSupplier(p => ({ ...p, levertijd: e.target.value }))} className={INPUT_CLS} placeholder="bijv. 5 werkdagen" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Prijsindicatie</label>
                  <input type="text" value={newSupplier.prijsindicatie} onChange={e => setNewSupplier(p => ({ ...p, prijsindicatie: e.target.value }))} className={INPUT_CLS} placeholder="bijv. €5 - €25 p.st." />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Bijzonderheden</label>
                <textarea rows={3} value={newSupplier.bijzonderheden} onChange={e => setNewSupplier(p => ({ ...p, bijzonderheden: e.target.value }))} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none" placeholder="Tips, afspraken, aandachtspunten..." />
              </div>
              {/* Bijlagen */}
              <div>
                <label className={LABEL_CLS}>Bijlagen</label>
                {formBijlagen.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {formBijlagen.map((b, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Paperclip className="w-3 h-3 text-orange shrink-0" strokeWidth={1.75} />
                        <span className="text-[12px] text-white/70 flex-1 truncate">{b.naam}</span>
                        <button type="button" onClick={() => setFormBijlagen(prev => prev.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400 transition-colors">
                          <X className="w-3 h-3" strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => formFileRef.current?.click()}
                  disabled={uploadingForm}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] bg-white/[0.04] border border-white/[0.07] rounded-md text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-colors disabled:opacity-40"
                >
                  {uploadingForm
                    ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
                    : <Paperclip className="w-3 h-3" strokeWidth={1.75} />
                  }
                  {uploadingForm ? 'Uploaden...' : 'Bijlage toevoegen (PDF)'}
                </button>
                <input ref={formFileRef} type="file" accept=".pdf" className="hidden" onChange={handleFormFileChange} />
              </div>

              {createError && <p className="text-[12px] text-red-400">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={creating || !newSupplier.naam.trim() || uploadingForm} className="flex-1 h-9 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[13px] text-white hover:bg-white/[0.12] disabled:opacity-40 transition-colors">
                  {creating ? 'Opslaan...' : 'Leverancier toevoegen'}
                </button>
                <button type="button" onClick={() => { setShowAddForm(false); setFormBijlagen([]); }} className="h-9 px-4 text-[13px] text-white/40 hover:text-white/70 transition-colors">
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
