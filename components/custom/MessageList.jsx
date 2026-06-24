// components/custom/MessageList.jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Image as ImageIcon, FileText, Mic2, X, Copy, Check, Plus, Link, Trash2 } from 'lucide-react';
import DocumentCard from './DocumentCard';

function TranscriptModal({ filename, content, onClose }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-xl bg-[#1a1a1a] border border-white/[0.10] rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-white/40" strokeWidth={1.75} />
            <span className="text-[13px] font-medium text-white/80 truncate">{filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <><Check className="w-3 h-3" strokeWidth={2} /> Gekopieerd</> : <><Copy className="w-3 h-3" strokeWidth={1.75} /> Kopieer</>}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-[13px] text-white/60 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

marked.setOptions({ breaks: true });

// Inline-only markdown voor de streaming fase — geen block-level parsing om layout-shifts te voorkomen
function renderStreamInline(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/gs, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function ExtrasSection({ messageId, extras, onExtrasChange, outputType, fotoVoor, fotoMidden, fotoAchter, onFotoChange }) {
  const { photos = [], links = [] } = extras || {};
  const [linkDraft, setLinkDraft] = useState({ label: '', url: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadedFeedback, setUploadedFeedback] = useState(false);
  const fileInputRef = useRef(null);

  async function handlePhotoSelect(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('messageId', messageId);
      files.forEach(f => formData.append('files', f));
      const res = await fetch('/api/upload-briefing-media', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Foto upload fout:', err.error ?? res.status);
        return;
      }
      const { photos: newPhotos } = await res.json();
      if (newPhotos?.length > 0) {
        onExtrasChange(messageId, { photos: [...photos, ...newPhotos], links });
        setUploadedFeedback(true);
        setTimeout(() => setUploadedFeedback(false), 3000);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function removePhoto(idx) {
    onExtrasChange(messageId, { photos: photos.filter((_, i) => i !== idx), links });
  }

  function addLink() {
    if (!linkDraft.url.trim()) return;
    onExtrasChange(messageId, {
      photos,
      links: [...links, { label: linkDraft.label.trim(), url: linkDraft.url.trim() }],
    });
    setLinkDraft({ label: '', url: '' });
  }

  function removeLink(idx) {
    onExtrasChange(messageId, { photos, links: links.filter((_, i) => i !== idx) });
  }

  return (
    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="font-[family-name:var(--font-lexend)] text-[11px] font-semibold tracking-[0.08em] uppercase text-white/30 mb-3">
        Bijlagen toevoegen
      </p>

      {/* Foto grid */}
      {photos.length > 0 && (
        <div className={`grid gap-2 mb-3 ${photos.length <= 1 ? 'grid-cols-1' : photos.length <= 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {photos.map((photo, i) => (
            <div key={i} className="relative group/photo">
              <img src={photo.url} alt={photo.name} className="rounded-lg object-cover w-full aspect-video" />
              <div className="absolute top-1 left-1 w-5 h-5 bg-green-500/90 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
              </div>
              <button
                onClick={() => removePhoto(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-white/70" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload knop(pen) */}
      {outputType === 'evaluation' ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Voorblad foto', field: 'foto_voor',   state: fotoVoor   },
            { label: 'Actiefoto',     field: 'foto_midden', state: fotoMidden  },
            { label: 'Afsluitfoto',   field: 'foto_achter', state: fotoAchter  },
          ].map(({ label, field, state }) => (
            <div key={field} className="relative group/photo">
              {state ? (
                <>
                  <img src={state.data64} alt={state.name} className="rounded-lg object-cover w-full aspect-video" />
                  <div className="absolute top-1 left-1 w-5 h-5 bg-green-500/90 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </div>
                  <button
                    onClick={() => onFotoChange?.(field, null)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-white/70" strokeWidth={2} />
                  </button>
                  <p className="text-[10px] text-white/30 mt-1 truncate px-0.5">{label}</p>
                </>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 text-[11px] text-white/40 hover:text-white/70 border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer w-full aspect-video">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const data64 = await fileToBase64(file);
                      onFotoChange?.(field, { name: file.name, data64 });
                      e.target.value = '';
                    }}
                  />
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {label}
                </label>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 border border-white/[0.08] rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
            >
              <Plus className="w-3 h-3" strokeWidth={2} />
              {uploading ? 'Uploaden...' : 'Foto toevoegen'}
            </button>
            {uploadedFeedback && (
              <span className="flex items-center gap-1 text-[11px] text-green-400/80">
                <Check className="w-3 h-3" strokeWidth={2.5} />
                Opgeslagen
              </span>
            )}
          </div>
        </>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="space-y-1 mb-3">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2 group/link">
              <Link className="w-3 h-3 text-white/25 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 text-[12px] text-orange truncate">{link.label || link.url}</span>
              <button
                onClick={() => removeLink(i)}
                className="opacity-0 group-hover/link:opacity-100 w-5 h-5 flex items-center justify-center text-white/30 hover:text-white/60 transition-all"
              >
                <Trash2 className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link invoer */}
      <div className="flex gap-1.5">
        <input
          value={linkDraft.label}
          onChange={e => setLinkDraft(d => ({ ...d, label: e.target.value }))}
          placeholder="Label (optioneel)"
          className="w-28 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder-white/20 outline-none focus:border-white/[0.20] transition-colors"
        />
        <input
          value={linkDraft.url}
          onChange={e => setLinkDraft(d => ({ ...d, url: e.target.value }))}
          onKeyDown={e => { if (e.key === 'Enter') addLink(); }}
          placeholder="https://..."
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white placeholder-white/20 outline-none focus:border-white/[0.20] transition-colors"
        />
        <button
          onClick={addLink}
          disabled={!linkDraft.url.trim()}
          className="px-3 py-1.5 bg-white/[0.06] rounded-lg text-[11px] text-white/50 hover:text-white hover:bg-white/[0.10] transition-colors disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function stripDocMarkers(text) {
  return text.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '...');
}

function DocumentPreview({ content, onOpen, messageId, extras, onExtrasChange, tenant, client, project, outputType, outputTypeLabel, onDelete, threadId }) {
  const [fotoVoor, setFotoVoor] = useState(null);
  const [fotoMidden, setFotoMidden] = useState(null);
  const [fotoAchter, setFotoAchter] = useState(null);

  function handleFotoChange(field, value) {
    if (field === 'foto_voor') setFotoVoor(value);
    else if (field === 'foto_midden') setFotoMidden(value);
    else if (field === 'foto_achter') setFotoAchter(value);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bijlagen sectie — voor alle documenttypes, boven de DocumentCard */}
      {onExtrasChange && (
        <ExtrasSection
          messageId={messageId}
          extras={extras}
          onExtrasChange={onExtrasChange}
          outputType={outputType}
          fotoVoor={fotoVoor}
          fotoMidden={fotoMidden}
          fotoAchter={fotoAchter}
          onFotoChange={handleFotoChange}
        />
      )}
      <DocumentCard
        content={content}
        onOpen={onOpen}
        tenant={tenant}
        client={client}
        project={project}
        extras={extras}
        outputType={outputType}
        outputTypeLabel={outputTypeLabel}
        messageId={messageId}
        onDelete={onDelete}
        fotoVoor={fotoVoor}
        fotoMidden={fotoMidden}
        fotoAchter={fotoAchter}
        threadId={threadId}
      />
    </div>
  );
}

export default function MessageList({ messages, sending, onOpenDocument, briefingExtras = {}, onExtrasChange, onMessageDelete, tenant = null, threadClient = null, threadProject = null, outputTypes = [], threadId = null }) {
  const bottomRef = useRef(null);
  const [openTranscript, setOpenTranscript] = useState(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const lastMsg = messages[messages.length - 1];
  const isStreaming = lastMsg?.streaming === true;

  return (
    <>
    {openTranscript && (
      <TranscriptModal
        filename={openTranscript.filename}
        content={openTranscript.content}
        onClose={() => setOpenTranscript(null)}
      />
    )}
    <div className="flex flex-col gap-6 py-8 px-4 md:px-8 max-w-3xl mx-auto w-full">
      {messages.filter(msg => !(msg.role === 'user' && msg.content === 'Aanvullende informatie ontvangen.')).map((msg) => {
        const msgOutputTypeLabel = outputTypes.find(t => t.id === msg.output_type)?.label ?? null;
        return (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-start gap-3'}`}
        >
          {msg.role === 'assistant' && (
            <img
              src="/icons/waybetter-icon.svg"
              alt=""
              aria-hidden="true"
              className="w-6 h-6 rounded-md shrink-0 mt-1 opacity-70"
            />
          )}

          <div
            className={
              msg.role === 'user'
                ? 'max-w-[75%] bg-white/[0.07] border border-white/[0.08] rounded-2xl px-4 py-3 text-[14px] text-white/90 leading-relaxed'
                : `flex-1${!msg.streaming && msg.bufferedStream ? ' animate-fade-in' : ''}`
            }
          >
            {msg.role === 'user' ? (
              <>
                {msg.pastedTranscript ? (
                  <button
                    onClick={() => setOpenTranscript({ filename: 'Geplakt transcript', content: msg.content })}
                    className="inline-flex items-center gap-1.5 text-[11px] text-white/55 border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] hover:text-white/80 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    <FileText className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                    Transcript — geplakt
                  </button>
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {msg.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.attachments.map((att, i) =>
                      att.type === 'transcript' ? (
                        <button
                          key={i}
                          onClick={() => setOpenTranscript({ filename: att.filename, content: att.content })}
                          className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-lg text-[11px] font-medium border bg-white/[0.06] border-white/[0.12] text-white/65 hover:bg-white/[0.10] hover:text-white/85 transition-colors"
                        >
                          <Mic2 className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                          {att.filename}
                        </button>
                      ) : att.type === 'image' ? (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-lg text-[11px] font-medium border bg-white/[0.06] border-white/[0.12] text-white/65"
                        >
                          <ImageIcon className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                          {att.filename}
                        </span>
                      ) : (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-lg text-[11px] font-medium border bg-white/[0.06] border-white/[0.12] text-white/65"
                        >
                          <FileText className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                          {att.filename}
                        </span>
                      )
                    )}
                  </div>
                )}
              </>
            ) : msg.streaming ? (
              (msg.isDocument || msg.bufferedStream) ? (
                <p className="text-[13px] text-white/35 leading-relaxed animate-pulse">
                  {msg.isDocument ? `Waybetter maakt je ${{ 'meeting-summary': 'samenvatting', 'project-briefing': 'projectbriefing', 'evaluation': 'evaluatie', 'external-debrief': 'evaluatie', 'account-to-pm': 'briefing', 'field-briefing': 'ambassadorsbriefing', 'account-to-creation': 'briefing naar creatie' }[msg.output_type] ?? 'document'}...` : 'Aan het lezen...'}
                </p>
              ) : msg.streamContent ? (
                <p
                  className="text-[14px] text-white/80 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: renderStreamInline(msg.streamContent) }}
                />
              ) : (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/25 animate-bounce [animation-delay:300ms]" />
                </div>
              )
            ) : msg.isDocument ? (
              <DocumentPreview
                content={msg.content}
                onOpen={() => onOpenDocument?.(msg)}
                messageId={msg.id}
                extras={briefingExtras[msg.id]}
                onExtrasChange={onExtrasChange}
                tenant={tenant}
                client={threadClient}
                project={threadProject}
                outputType={msg.output_type}
                outputTypeLabel={msgOutputTypeLabel}
                onDelete={onMessageDelete ? () => onMessageDelete(msg.id) : undefined}
                threadId={threadId}
              />
            ) : msg.type === 'followup' ? (
              /* Vervolgzin na document — visueel prominent */
              <div className="mt-1 rounded-xl border border-orange/[0.15] bg-orange/[0.04] px-4 py-3">
                <p className="text-[13px] text-white/70 leading-relaxed">{msg.content}</p>
              </div>
            ) : (
              <div
                className="custom-prose prose-chat text-[14px]"
                dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }}
              />
            )}
            {msg.role === 'assistant' && !msg.streaming && msg.sources?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {msg.sources.map((s) => (
                  <span
                    key={s.n}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] text-white/40"
                    title={s.createdAt ? new Date(s.createdAt).toLocaleDateString('nl-NL') : undefined}
                  >
                    <span className="text-white/60 font-medium">Bron {s.n}</span>
                    {s.title}{s.client ? ` · ${s.client}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        );
      })}


      <div ref={bottomRef} />
    </div>
    </>
  );
}
