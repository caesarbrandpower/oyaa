// components/custom/RecordingsPage.jsx
'use client';

import { useState, useRef } from 'react';
import { Mic, Play, Pause, Trash2, ExternalLink, MessageSquarePlus, Download, Pencil, Check, X } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  if (status === 'done')       return { text: 'Transcript klaar',    color: 'text-green-400' };
  if (status === 'queued')     return { text: 'In wachtrij',         color: 'text-white/40' };
  if (status === 'processing') return { text: 'Wordt verwerkt',      color: 'text-orange-400' };
  if (status === 'failed')     return { text: 'Transcriptie mislukt', color: 'text-red-400' };
  return { text: status, color: 'text-white/30' };
}

export default function RecordingsPage({ initialRecordings }) {
  const [recordings, setRecordings] = useState(initialRecordings);
  const [playingId, setPlayingId] = useState(null);
  const [audioTime, setAudioTime] = useState({});
  const [audioDuration, setAudioDuration] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [startingThreadId, setStartingThreadId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const audioRefs = useRef({});

  function getAudioRef(id) {
    if (!audioRefs.current[id]) audioRefs.current[id] = { current: null };
    return audioRefs.current[id];
  }

  function togglePlay(rec) {
    const el = audioRefs.current[rec.id]?.current;
    if (!el) return;
    if (playingId === rec.id) {
      el.pause();
      setPlayingId(null);
    } else {
      // Pauzeer andere speler
      if (playingId && audioRefs.current[playingId]?.current) {
        audioRefs.current[playingId].current.pause();
      }
      el.play();
      setPlayingId(rec.id);
    }
  }

  async function handleStartThread(id) {
    setStartingThreadId(id);
    try {
      const res = await fetch(`/api/recordings/${id}/start-thread`, { method: 'POST' });
      const { threadId } = await res.json();
      if (threadId) window.location.href = `/app?thread=${threadId}`;
    } finally {
      setStartingThreadId(null);
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRecordings(prev => prev.filter(r => r.id !== id));
      setDeleteConfirmId(null);
    }
  }

  async function handleRename(id) {
    const title = editTitle.trim();
    if (!title) { setEditingId(null); return; }
    const res = await fetch(`/api/recordings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setRecordings(prev => prev.map(r => r.id === id ? { ...r, title } : r));
    }
    setEditingId(null);
  }

  if (recordings.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <Mic className="w-8 h-8 text-white/20 mx-auto mb-4" strokeWidth={1.5} />
          <p className="text-[15px] font-medium text-white/50 mb-2">Nog geen opnames</p>
          <p className="text-[12px] text-white/30">Opnames die je maakt verschijnen hier automatisch.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">
      <h1 className="text-[18px] font-semibold text-white/80 mb-6">Opnames</h1>
      <div className="flex flex-col gap-3">
        {recordings.map(rec => {
          const ref = { current: null };
          audioRefs.current[rec.id] = ref;
          const dur = audioDuration[rec.id] ?? rec.duration_seconds;
          const cur = audioTime[rec.id] ?? 0;
          const isPlaying = playingId === rec.id;
          const { text: statusText, color: statusColor } = statusLabel(rec.transcript_status);

          return (
            <div key={rec.id} className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4">
              {/* Titel + acties */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  {editingId === rec.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="bg-white/[0.08] border border-white/[0.12] rounded-lg px-2 py-1 text-[13px] text-white flex-1 min-w-0 outline-none focus:border-orange/50"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(rec.id); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                      />
                      <button onClick={() => handleRename(rec.id)} className="text-white/50 hover:text-white"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button
                      className="text-[13px] font-medium text-white/80 hover:text-white text-left truncate block max-w-full"
                      onClick={() => { setEditingId(rec.id); setEditTitle(rec.title || ''); }}
                    >
                      {rec.title || 'Naamloze opname'}
                      <Pencil className="w-3 h-3 inline ml-1.5 opacity-30" />
                    </button>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] text-white/30">{formatDate(rec.created_at)}</span>
                    {rec.client && <span className="text-[11px] text-white/40">· {rec.client}</span>}
                    {dur && <span className="text-[11px] text-white/30">· {formatTime(dur)}</span>}
                    <span className={`text-[11px] ${statusColor}`}>· {statusText}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Download */}
                  {rec.audio_url && (
                    <a
                      href={rec.audio_url}
                      download
                      className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
                      title="Download opname"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {/* Open bestaand gesprek */}
                  {rec.thread_id && (
                    <a
                      href={`/app?thread=${rec.thread_id}`}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06]"
                      title="Open gesprek"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {/* Start nieuw gesprek (alleen als er nog geen thread aan hangt) */}
                  {!rec.thread_id && (
                    <button
                      className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                      title="Start gesprek"
                      disabled={startingThreadId === rec.id}
                      onClick={() => handleStartThread(rec.id)}
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {deleteConfirmId === rec.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        className="px-2 py-1 text-[11px] rounded-lg bg-red-600/80 hover:bg-red-600 text-white"
                        onClick={() => handleDelete(rec.id)}
                      >Verwijder</button>
                      <button
                        className="px-2 py-1 text-[11px] rounded-lg bg-white/[0.06] text-white/50"
                        onClick={() => setDeleteConfirmId(null)}
                      >Annuleer</button>
                    </div>
                  ) : (
                    <button
                      className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-white/[0.06]"
                      onClick={() => setDeleteConfirmId(rec.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Audiospeler */}
              {rec.audio_url && (
                <div>
                  <audio
                    ref={el => { audioRefs.current[rec.id] = { current: el }; }}
                    src={rec.audio_url}
                    onTimeUpdate={e => setAudioTime(p => ({ ...p, [rec.id]: e.target.currentTime }))}
                    onLoadedMetadata={e => setAudioDuration(p => ({ ...p, [rec.id]: e.target.duration }))}
                    onEnded={() => setPlayingId(null)}
                  />
                  <div className="flex items-center gap-3 h-9 px-3 bg-white/[0.04] border border-white/[0.06] rounded-xl">
                    <button
                      onClick={() => togglePlay(rec)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-orange/15 hover:bg-orange/25"
                    >
                      {isPlaying
                        ? <Pause className="w-3 h-3 text-orange" strokeWidth={2} />
                        : <Play  className="w-3 h-3 text-orange ml-0.5" strokeWidth={2} />}
                    </button>
                    <div
                      className="flex-1 h-1 bg-white/[0.10] rounded-full cursor-pointer relative"
                      onClick={e => {
                        const el = audioRefs.current[rec.id]?.current;
                        if (!el) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        el.currentTime = ((e.clientX - rect.left) / rect.width) * (audioDuration[rec.id] ?? 0);
                      }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-orange rounded-full"
                        style={{ width: dur ? `${(cur / dur) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] text-white/30 tabular-nums">
                      {formatTime(cur)}{dur ? ` / ${formatTime(dur)}` : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
