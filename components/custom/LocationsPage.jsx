'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Train, ShoppingBag, Tent, Music, Store,
  Download, Search, ChevronDown, ChevronUp, Paperclip, Loader2,
  Plus, X, Pencil, Check, Copy, Star,
} from 'lucide-react';

const CHANNELS = ['Centrumlocatie', 'Treinstation', 'Winkelcentrum', 'Outdoor', 'Event', 'Markt'];
const VERGUNNING_STATUSSEN = ['aanwezig', 'verlopen', 'geen'];

const CHANNEL_ICONS = {
  Centrumlocatie: MapPin,
  Treinstation:   Train,
  Winkelcentrum:  ShoppingBag,
  Outdoor:        Tent,
  Event:          Music,
  Markt:          Store,
};

const VERGUNNING_CONFIG = {
  aanwezig: { cls: 'bg-green-500/15 text-green-400', label: 'Vergunning aanwezig' },
  verlopen: { cls: 'bg-orange/15 text-orange',        label: 'Vergunning verlopen' },
};

function VergunningBadge({ status }) {
  const c = VERGUNNING_CONFIG[status];
  if (!c) return null;
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${c.cls}`}>
      {c.label}
    </span>
  );
}

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

const EMPTY_LOCATION = {
  naam: '', omschrijving: '', stad: '', channel: '', doelgroep: '',
  telefoon: '', email: '', website: '',
  parkeren: '', laden_lossen: '', vergunning_status: 'geen',
  vergunning_vervaldatum: '', bijzonderheden: '',
};

function buildCopyText(loc) {
  const sections = [];

  sections.push([loc.naam, [loc.channel, loc.stad].filter(Boolean).join(' · ')].filter(Boolean).join('\n'));

  if (loc.omschrijving) sections.push(loc.omschrijving);

  const contact = [
    loc.telefoon && `📞 ${loc.telefoon}`,
    loc.email && `✉️ ${loc.email}`,
    loc.website && `🌐 ${loc.website}`,
  ].filter(Boolean);
  if (contact.length) sections.push(contact.join('\n'));

  const logistiek = [
    loc.parkeren && `Parkeren: ${loc.parkeren}`,
    loc.laden_lossen && `Laden & lossen: ${loc.laden_lossen}`,
    loc.vergunning_status && (
      loc.vergunning_vervaldatum
        ? `Vergunning: ${loc.vergunning_status} (geldig t/m ${new Date(loc.vergunning_vervaldatum).toLocaleDateString('nl-NL')})`
        : `Vergunning: ${loc.vergunning_status}`
    ),
  ].filter(Boolean);
  if (logistiek.length) sections.push(logistiek.join('\n'));

  if (loc.bijzonderheden) sections.push(`Bijzonderheden:\n${loc.bijzonderheden}`);

  return sections.join('\n\n');
}

export default function LocationsPage({ tenant, locations: initialLocations, initialFavorietIds = [] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [favorietIds, setFavorietIds] = useState(() => new Set(initialFavorietIds));
  const [search, setSearch] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterDoelgroep, setFilterDoelgroep] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [uploadingForId, setUploadingForId] = useState(null);
  const [uploadError, setUploadError] = useState({});
  const [editingBijz, setEditingBijz] = useState(null);
  const [savingBijz, setSavingBijz] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocation, setNewLocation] = useState(EMPTY_LOCATION);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [formBijlagen, setFormBijlagen] = useState([]);
  const [uploadingForm, setUploadingForm] = useState(false);
  const fileInputRef = useRef(null);
  const formFileRef = useRef(null);

  const channels = useMemo(
    () => [...new Set(locations.map(l => l.channel).filter(Boolean))].sort(),
    [locations]
  );
  const doelgroepen = useMemo(
    () => [...new Set(locations.map(l => l.doelgroep).filter(Boolean))].sort(),
    [locations]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const matches = locations.filter(l => {
      const matchSearch = !q
        || l.naam?.toLowerCase().includes(q)
        || l.stad?.toLowerCase().includes(q)
        || l.omschrijving?.toLowerCase().includes(q);
      const matchChannel = !filterChannel || l.channel === filterChannel;
      const matchDoelgroep = !filterDoelgroep || l.doelgroep === filterDoelgroep;
      return matchSearch && matchChannel && matchDoelgroep;
    });
    return [...matches].sort((a, b) => {
      const aFav = favorietIds.has(a.id);
      const bFav = favorietIds.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.naam.localeCompare(b.naam, 'nl');
    });
  }, [locations, search, filterChannel, filterDoelgroep, favorietIds]);

  function startUpload(locationId) {
    setUploadError(prev => ({ ...prev, [locationId]: null }));
    setUploadingForId(locationId);
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadingForId) return;
    const id = uploadingForId;
    const form = new FormData();
    form.append('file', file);
    form.append('location_id', id);
    const res = await fetch('/api/locations/upload-bijlage', { method: 'POST', body: form });
    const json = await res.json();
    setUploadingForId(null);
    if (res.ok) {
      setLocations(prev => prev.map(l =>
        l.id === id
          ? { ...l, bijlagen: [...(Array.isArray(l.bijlagen) ? l.bijlagen : []), json.bijlage] }
          : l
      ));
    } else {
      setUploadError(prev => ({ ...prev, [id]: json.error ?? 'Upload mislukt' }));
    }
  }

  async function saveBijzonderheden(id) {
    setSavingBijz(id);
    const res = await fetch('/api/locations/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: id, bijzonderheden: editingBijz.value }),
    });
    const json = await res.json();
    setSavingBijz(null);
    if (res.ok) {
      setLocations(prev => prev.map(l => l.id === id ? { ...l, bijzonderheden: json.location.bijzonderheden } : l));
      setEditingBijz(null);
    }
  }

  async function toggleFavoriet(id) {
    const wasFavoriet = favorietIds.has(id);
    setFavorietIds(prev => {
      const next = new Set(prev);
      wasFavoriet ? next.delete(id) : next.add(id);
      return next;
    });
    const res = await fetch('/api/locations/favoriet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: id }),
    });
    if (!res.ok) {
      setFavorietIds(prev => {
        const next = new Set(prev);
        wasFavoriet ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }

  function copyCard(loc) {
    navigator.clipboard.writeText(buildCopyText(loc));
    setCopiedId(loc.id);
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
    if (!newLocation.naam.trim()) return;
    setCreating(true);
    setCreateError(null);
    const res = await fetch('/api/locations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newLocation, bijlagen: formBijlagen }),
    });
    const json = await res.json();
    setCreating(false);
    if (res.ok) {
      setLocations(prev => [json.location, ...prev]);
      setNewLocation(EMPTY_LOCATION);
      setFormBijlagen([]);
      setShowAddForm(false);
    } else {
      setCreateError(json.error ?? 'Opslaan mislukt');
    }
  }

  function exportCSV() {
    const cols = ['naam', 'omschrijving', 'stad', 'channel', 'doelgroep', 'telefoon', 'email',
      'website', 'parkeren', 'laden_lossen', 'vergunning_status', 'vergunning_vervaldatum', 'bijzonderheden'];
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

        <h1 className="text-xl font-semibold mb-1">Locatiedatabase</h1>
        <p className="text-[13px] text-white/50 mb-8">
          Alle veldlocaties van {tenant?.name ?? 'het bureau'}.
        </p>

        {/* Zoeken + filters */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[180px] flex items-center">
            <Search className="absolute left-3 w-3.5 h-3.5 text-white/30 pointer-events-none" strokeWidth={1.75} />
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
            const isEditingBijz = editingBijz?.id === loc.id;
            return (
              <div
                key={loc.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
              >
                {/* Dichte kaart */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : loc.id)}
                  className="w-full flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
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
                    <div className="flex gap-1.5 mt-1 flex-wrap">
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
                    {loc.omschrijving && (
                      <p className="mt-1.5 text-[12px] text-white/45 leading-snug line-clamp-2">
                        {loc.omschrijving}
                      </p>
                    )}
                  </div>

                  {/* Actieknoppen */}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => copyCard(loc)}
                      title="Kopieer naar klembord"
                      className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    >
                      {copiedId === loc.id
                        ? <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={1.75} />
                        : <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                      }
                    </button>
                    <button
                      onClick={() => toggleFavoriet(loc.id)}
                      title={favorietIds.has(loc.id) ? 'Verwijder uit favorieten' : 'Voeg toe aan favorieten'}
                      className="p-1 transition-colors"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${favorietIds.has(loc.id) ? 'text-yellow-400' : 'text-white/20 hover:text-yellow-400/60'}`}
                        fill={favorietIds.has(loc.id) ? 'currentColor' : 'none'}
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
                {isExpanded && (() => {
                  const PLATTEGROND_RE = /\nPlattegrond: [^\n]+/g;
                  const plattegrondRefs = (loc.bijzonderheden?.match(PLATTEGROND_RE) ?? []).map(s => s.replace('\nPlattegrond: ', '').trim());
                  const bijzClean = loc.bijzonderheden?.replace(PLATTEGROND_RE, '').trim() || null;
                  const prijsLabel = loc.prijs != null
                    ? `€${Number(loc.prijs).toLocaleString('nl-NL')}${loc.prijssoort ? ` ${loc.prijssoort}` : ''}`
                    : null;
                  return (
                  <div className="px-4 pb-4 border-t border-white/[0.05]">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-3">
                      {loc.adres && (
                        <DetailItem label="Adres" wide>{loc.adres}</DetailItem>
                      )}
                      {prijsLabel && (
                        <DetailItem label="Kosten">{prijsLabel}</DetailItem>
                      )}
                      {loc.bereik != null && (
                        <DetailItem label="Bereik/dag">{Number(loc.bereik).toLocaleString('nl-NL')}</DetailItem>
                      )}
                      {loc.status && loc.status !== 'onbekend' && (
                        <DetailItem label="Status">{loc.status}</DetailItem>
                      )}
                      {loc.bron && (
                        <DetailItem label="Bron">{loc.bron}</DetailItem>
                      )}
                      {loc.telefoon && (
                        <DetailItem label="Telefoon">
                          <a href={`tel:${loc.telefoon}`} className="text-orange underline-offset-2 hover:underline">
                            {loc.telefoon}
                          </a>
                        </DetailItem>
                      )}
                      {loc.email && (
                        <DetailItem label="E-mail">
                          <a href={`mailto:${loc.email}`} className="text-orange underline-offset-2 hover:underline">
                            {loc.email}
                          </a>
                        </DetailItem>
                      )}
                      {loc.website && (
                        <DetailItem label="Website">
                          <a href={normalizeUrl(loc.website)} target="_blank" rel="noopener noreferrer" className="text-orange underline-offset-2 hover:underline">
                            {displayUrl(loc.website)}
                          </a>
                        </DetailItem>
                      )}
                      {loc.parkeren && (
                        <DetailItem label="Parkeren">{loc.parkeren}</DetailItem>
                      )}
                      {loc.laden_lossen && (
                        <DetailItem label="Laden en lossen">{loc.laden_lossen}</DetailItem>
                      )}
                      {loc.vergunning_vervaldatum && (
                        <DetailItem label="Vergunning vervalt">
                          {new Date(loc.vergunning_vervaldatum).toLocaleDateString('nl-NL')}
                        </DetailItem>
                      )}

                      {/* Bijzonderheden — inline bewerkbaar */}
                      <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <DetailLabel>Bijzonderheden</DetailLabel>
                          {!isEditingBijz && (
                            <button
                              onClick={() => setEditingBijz({ id: loc.id, value: loc.bijzonderheden ?? '' })}
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
                                onClick={() => saveBijzonderheden(loc.id)}
                                disabled={savingBijz === loc.id}
                                className="inline-flex items-center gap-1.5 h-7 px-3 text-[11px] bg-white/[0.08] border border-white/[0.12] rounded-md text-white/80 hover:text-white disabled:opacity-40 transition-colors"
                              >
                                {savingBijz === loc.id
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
                          <p className="text-[13px] text-white/80 leading-snug whitespace-pre-line">
                            {bijzClean || (
                              <span className="text-white/25 italic">Geen bijzonderheden</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Plattegrond-verwijzingen uit Ninox */}
                    {plattegrondRefs.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1">Plattegrond</p>
                        {plattegrondRefs.map((ref, i) => (
                          <p key={i} className="text-[12px] text-white/30 italic">{ref} (nog niet beschikbaar)</p>
                        ))}
                      </div>
                    )}

                    {/* Bijlagen */}
                    <div className="mt-4">
                      {Array.isArray(loc.bijlagen) && loc.bijlagen.length > 0 && (
                        <>
                          <p className="text-[11px] text-white/35 uppercase tracking-wide mb-1.5">Bijlagen</p>
                          <div className="flex gap-3 flex-wrap mb-3">
                            {loc.bijlagen.map((b, i) => (
                              <a key={i} href={b.url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-orange underline-offset-2 hover:underline">
                                {b.naam ?? `Bijlage ${i + 1}`}
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startUpload(loc.id)}
                          disabled={uploadingForId === loc.id}
                          className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] bg-white/[0.04] border border-white/[0.07] rounded-md text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-colors disabled:opacity-40"
                        >
                          {uploadingForId === loc.id
                            ? <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
                            : <Paperclip className="w-3 h-3" strokeWidth={1.75} />
                          }
                          {uploadingForId === loc.id ? 'Uploaden...' : 'Bijlage uploaden'}
                        </button>
                        {uploadError[loc.id] && (
                          <span className="text-[11px] text-red-400">{uploadError[loc.id]}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-[13px] text-white/35 py-6">Geen locaties gevonden.</p>
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
              <h2 className="text-[15px] font-semibold">Nieuwe locatie</h2>
              <button onClick={() => { setShowAddForm(false); setFormBijlagen([]); }} className="text-white/40 hover:text-white/80 transition-colors">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              <div>
                <label className={LABEL_CLS}>Naam *</label>
                <input type="text" required value={newLocation.naam} onChange={e => setNewLocation(p => ({ ...p, naam: e.target.value }))} className={INPUT_CLS} placeholder="Naam van de locatie" />
              </div>
              <div>
                <label className={LABEL_CLS}>Omschrijving</label>
                <textarea rows={2} value={newLocation.omschrijving} onChange={e => setNewLocation(p => ({ ...p, omschrijving: e.target.value }))} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none" placeholder="Korte beschrijving van de locatie..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Stad</label>
                  <input type="text" value={newLocation.stad} onChange={e => setNewLocation(p => ({ ...p, stad: e.target.value }))} className={INPUT_CLS} placeholder="Amsterdam" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Channel</label>
                  <select value={newLocation.channel} onChange={e => setNewLocation(p => ({ ...p, channel: e.target.value }))} className={SELECT_CLS}>
                    <option value="">Kies channel</option>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Doelgroep</label>
                <input type="text" value={newLocation.doelgroep} onChange={e => setNewLocation(p => ({ ...p, doelgroep: e.target.value }))} className={INPUT_CLS} placeholder="bijv. 18-35, Gezinnen" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Telefoon</label>
                  <input type="tel" value={newLocation.telefoon} onChange={e => setNewLocation(p => ({ ...p, telefoon: e.target.value }))} className={INPUT_CLS} placeholder="010-000 0000" />
                </div>
                <div>
                  <label className={LABEL_CLS}>E-mail</label>
                  <input type="email" value={newLocation.email} onChange={e => setNewLocation(p => ({ ...p, email: e.target.value }))} className={INPUT_CLS} placeholder="naam@locatie.nl" />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Website</label>
                <input type="text" value={newLocation.website} onChange={e => setNewLocation(p => ({ ...p, website: e.target.value }))} className={INPUT_CLS} placeholder="locatie.nl" />
              </div>
              <div>
                <label className={LABEL_CLS}>Parkeren</label>
                <input type="text" value={newLocation.parkeren} onChange={e => setNewLocation(p => ({ ...p, parkeren: e.target.value }))} className={INPUT_CLS} placeholder="Beschrijving parkeeropties" />
              </div>
              <div>
                <label className={LABEL_CLS}>Laden en lossen</label>
                <input type="text" value={newLocation.laden_lossen} onChange={e => setNewLocation(p => ({ ...p, laden_lossen: e.target.value }))} className={INPUT_CLS} placeholder="Instructies voor opbouw" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Vergunning status</label>
                  <select value={newLocation.vergunning_status} onChange={e => setNewLocation(p => ({ ...p, vergunning_status: e.target.value }))} className={SELECT_CLS}>
                    {VERGUNNING_STATUSSEN.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Vergunning vervaldatum</label>
                  <input type="date" value={newLocation.vergunning_vervaldatum} onChange={e => setNewLocation(p => ({ ...p, vergunning_vervaldatum: e.target.value }))} className={INPUT_CLS} />
                </div>
              </div>
              <div>
                <label className={LABEL_CLS}>Bijzonderheden</label>
                <textarea rows={3} value={newLocation.bijzonderheden} onChange={e => setNewLocation(p => ({ ...p, bijzonderheden: e.target.value }))} className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none" placeholder="Aandachtspunten, afspraken, tijdsloten..." />
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
                <button type="submit" disabled={creating || !newLocation.naam.trim() || uploadingForm} className="flex-1 h-9 bg-white/[0.08] border border-white/[0.12] rounded-lg text-[13px] text-white hover:bg-white/[0.12] disabled:opacity-40 transition-colors">
                  {creating ? 'Opslaan...' : 'Locatie toevoegen'}
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
