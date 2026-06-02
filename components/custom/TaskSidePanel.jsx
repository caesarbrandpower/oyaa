// components/custom/TaskSidePanel.jsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Mic, Square, Paperclip, Copy, Check, Image as ImageIcon } from 'lucide-react';
import { useAudioTranscription, isAudioFile } from '@/lib/use-audio';
import { fuzzyMatchClient } from '@/lib/client-utils';

// Search tasks use a 2-step flow (description + confirm) and a simpler prompt.
// These IDs correspond to task.id values from tenant.enabled_output_types.
// Add new search-type task IDs here when they are added to the system.
const SEARCH_TASK_IDS = new Set(['location-search', 'supplier-search']);

function ProgressBar({ step, total }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < step ? 'bg-orange' : 'bg-white/[0.10]'
          }`}
        />
      ))}
    </div>
  );
}

export default function TaskSidePanel({ task, onClose, onGenerate }) {
  const isSearch = SEARCH_TASK_IDS.has(task.id);
  const totalSteps = isSearch ? 2 : 3;

  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [project, setProject] = useState('');
  const [background, setBackground] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('');
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [imageAttachments, setImageAttachments] = useState([]);
  const [clientSuggestion, setClientSuggestion] = useState(null);
  // clientSuggestion: null | string — bekende klant die lijkt op invoer (fuzzy match)
  const [newClientConfirm, setNewClientConfirm] = useState(false);
  // newClientConfirm: true als ingevoerde naam geen match heeft — vraag bevestiging schrijfwijze
  const [knownClients, setKnownClients] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    async function fetchKnownClients() {
      const { createClient } = await import('@/lib/supabase-browser');
      const supabase = createClient();
      const { data } = await supabase
        .from('threads')
        .select('client')
        .not('client', 'is', null)
        .order('client');
      if (data) {
        const clients = [...new Set(data.map(r => r.client).filter(Boolean))];
        console.log('[DEBUG CLIENTS] TaskSidePanel loaded', { count: clients.length, clients });
        setKnownClients(clients);
      }
    }
    fetchKnownClients();
  }, []);
  const imageInputRef = useRef(null);

  const handleTranscript = useCallback((text) => {
    setTranscript((prev) => prev ? prev + ' ' + text : text);
  }, []);
  const handleStatus = useCallback((s) => setTranscriptStatus(s ?? ''), []);
  const handleError = useCallback((err) => setTranscriptStatus('Fout: ' + err), []);

  const { recording, transcribing, toggleRecording, transcribeFile, cancelTranscription, transcribeProgress } = useAudioTranscription({
    onTranscript: handleTranscript,
    onStatus: handleStatus,
    onError: handleError,
  });

  const STEP_LABELS = isSearch
    ? ['Omschrijving', 'Bevestigen']
    : ['Omschrijving & Klant', 'Bronnen', 'Bevestigen'];

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFilename(file.name);
    e.target.value = '';
    if (isAudioFile(file)) transcribeFile(file, false);
  }

  function handleImageChange(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    e.target.value = '';
    const newAttachments = files.map(f => ({ filename: f.name, file: f }));
    setImageAttachments(prev => [...prev, ...newAttachments]);
  }

  async function handleGenerate() {
    let prompt;
    let displayText;
    if (isSearch) {
      prompt = `${task.label}: ${description.trim()}`;
      displayText = prompt;
    } else {
      const parts = [`Maak een ${task.label} voor het volgende:\n\nContext: ${description.trim()}`];
      if (project.trim()) parts.push(`Project/klant: ${project.trim()}`);
      if (background.trim()) parts.push(`Achtergrond of extra info:\n${background.trim()}`);
      if (transcript.trim()) parts.push(`Aanvullende bronnen/transcriptie:\n${transcript.trim()}`);
      prompt = parts.join('\n\n');
      displayText = project.trim()
        ? `${task.label} voor ${project.trim()}`
        : task.label;
    }
    // Convert File objects to base64 — File cannot be JSON-serialized
    const processedAttachments = await Promise.all(
      imageAttachments.map((att) => {
        if (!att.file) return Promise.resolve(att);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            filename: att.filename,
            data: reader.result.split(',')[1],
            mediaType: att.file.type || 'image/jpeg',
          });
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(att.file);
        });
      })
    );
    const validAttachments = processedAttachments.filter(Boolean).filter(a => a.data);
    onGenerate(prompt, task.id, task.label, displayText, project.trim() || null, validAttachments);
  }

  function handleDirectChat() {
    onClose(description.trim() || null);
  }

  const isLastStep = step === totalSteps;

  function handleNext() {
    // Fuzzy check op klantnaam bij stap 1 → stap 2
    if (step === 1 && !isSearch && project.trim()) {
      const input = project.trim();
      const match = fuzzyMatchClient(input, knownClients);
      console.log('[DEBUG FUZZY] TaskSidePanel', { input, knownClientsCount: knownClients.length, match, isNewClient: !match });
      if (match && !match.confirmed) {
        // Typo van bekende klant
        setClientSuggestion(match.suggestion);
        return;
      }
      if (!match) {
        // Geen match — nieuwe klant (ook als lijst leeg is)
        setNewClientConfirm(true);
        return;
      }
    }
    setStep((s) => s + 1);
  }

  function confirmClientSuggestion() {
    setProject(clientSuggestion);
    setClientSuggestion(null);
    setStep((s) => s + 1);
  }

  function rejectClientSuggestion() {
    setClientSuggestion(null);
    // Terug naar stap 1 zodat gebruiker naam kan corrigeren
  }

  function confirmNewClient() {
    setNewClientConfirm(false);
    setStep((s) => s + 1);
  }

  function rejectNewClient() {
    setNewClientConfirm(false);
    // Terug naar stap 1 — project input blijft staan zodat gebruiker kan aanpassen
  }

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onClose(null)}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[360px] bg-[#111111] border-l border-white/[0.08] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-white">
              {task.label}
            </h2>
            <button
              onClick={() => onClose(null)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <ProgressBar step={step} total={totalSteps} />
          <p className="text-[11px] text-white/35 mt-2">
            Stap {step} van {totalSteps} — {STEP_LABELS[step - 1]}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === 1 && clientSuggestion && (
            <div className="space-y-5">
              <div className="rounded-xl border border-orange/30 bg-orange/[0.06] px-4 py-4">
                <p className="text-[13px] text-white/80 leading-relaxed mb-1">
                  Bedoel je <span className="font-semibold text-white">{clientSuggestion}</span>?
                </p>
                <p className="text-[11px] text-white/35">
                  We herkenden een bekende klantnaam die lijkt op jouw invoer.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={confirmClientSuggestion}
                  className="w-full h-10 rounded-xl bg-orange text-white text-[13px] font-semibold hover:bg-[#e03d00] transition-colors"
                >
                  Ja, gebruik {clientSuggestion}
                </button>
                <button
                  onClick={rejectClientSuggestion}
                  className="w-full h-10 rounded-xl border border-white/[0.12] text-white/60 text-[13px] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Nee, aanpassen
                </button>
              </div>
            </div>
          )}

          {step === 1 && newClientConfirm && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/[0.12] bg-white/[0.03] px-4 py-4">
                <p className="text-[13px] text-white/80 leading-relaxed mb-1">
                  We slaan <span className="font-semibold text-white">&ldquo;{project}&rdquo;</span> op als nieuwe klantnaam. Klopt de schrijfwijze?
                </p>
                <p className="text-[11px] text-white/35">
                  Controleer hoofdletters, koppeltekens en spelling.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={confirmNewClient}
                  className="w-full h-10 rounded-xl bg-orange text-white text-[13px] font-semibold hover:bg-[#e03d00] transition-colors"
                >
                  Ja, sla op
                </button>
                <button
                  onClick={rejectNewClient}
                  className="w-full h-10 rounded-xl border border-white/[0.12] text-white/60 text-[13px] hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Nee, aanpassen
                </button>
              </div>
            </div>
          )}

          {step === 1 && !clientSuggestion && !newClientConfirm && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-white/60 mb-2">
                  {isSearch ? 'Wat ben je op zoek naar?' : 'Korte omschrijving van de opdracht'}
                </label>
                <textarea
                  autoFocus
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isSearch
                      ? 'Bijv. "Locatie voor een teamdag in Amsterdam voor 20 personen"'
                      : 'Bijv. "Notulen van het kickoff-gesprek met Heineken over de rebrand"'
                  }
                  rows={5}
                  className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 resize-none outline-none leading-relaxed focus:border-white/[0.20] transition-colors"
                />
              </div>
              {!isSearch && (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold text-white/60 mb-2">
                      Klant of project
                    </label>
                    <textarea
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                      placeholder='Bijv. "Coca-Cola HHZH" — optioneel'
                      rows={2}
                      className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 resize-none outline-none leading-relaxed focus:border-white/[0.20] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-white/60 mb-2">
                      Achtergrond of extra info
                    </label>
                    <textarea
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder='Bijv. gevoelig project, specifieke toon, eerder gemaakte afspraken... — optioneel'
                      rows={3}
                      className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-[13px] text-white placeholder-white/25 resize-none outline-none leading-relaxed focus:border-white/[0.20] transition-colors"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && !isSearch && (
            <div>
              <label className="block text-[12px] font-semibold text-white/60 mb-2">
                Bronnen toevoegen
              </label>
              <p className="text-[12px] text-white/35 mb-4 leading-relaxed">
                Upload een audio-opname, gebruik de microfoon, of voeg foto's en bestanden toe als extra context.
              </p>

              {/* Foto-upload */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex items-center gap-2 h-9 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors mb-2"
              >
                <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                Foto toevoegen
              </button>
              {imageAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {imageAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1 bg-white/[0.06] rounded-lg px-2.5 py-1">
                      <ImageIcon className="w-3 h-3 text-orange/70" strokeWidth={1.75} />
                      <span className="text-[11px] text-white/50 truncate max-w-[100px]">{att.filename}</span>
                      <button
                        onClick={() => setImageAttachments(prev => prev.filter((_, j) => j !== i))}
                        className="text-white/25 hover:text-white/60 ml-0.5"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={transcribing || recording}
                  className="flex items-center gap-2 h-9 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-30"
                >
                  <Paperclip className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Bestand kiezen
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm,audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={transcribing}
                  className={`flex items-center gap-2 h-9 px-4 rounded-lg text-[12px] border transition-colors disabled:opacity-30 ${
                    recording
                      ? 'bg-orange/80 border-orange text-white hover:bg-orange'
                      : 'bg-white/[0.05] border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.09]'
                  }`}
                >
                  {recording ? (
                    <><Square className="w-3 h-3" strokeWidth={2} /> Stop</>
                  ) : (
                    <><Mic className="w-3.5 h-3.5" strokeWidth={1.75} /> Opnemen</>
                  )}
                </button>
                {transcribing && (
                  <button
                    type="button"
                    onClick={cancelTranscription}
                    className="flex items-center gap-2 h-9 px-4 bg-white/[0.05] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors"
                  >
                    Annuleer
                  </button>
                )}
              </div>
              {transcribing && transcribeProgress && (
                <div className="mb-3">
                  <p className="text-[11px] text-white/50 mb-1.5 truncate">{transcribeProgress.filename || uploadedFilename}</p>
                  <div className="w-full bg-white/[0.08] rounded-full h-1.5">
                    <div
                      className="bg-orange h-1.5 rounded-full transition-all"
                      style={{ width: `${transcribeProgress.total > 0 ? Math.round((transcribeProgress.current / transcribeProgress.total) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">
                    {transcribeProgress.total > 0 ? `${Math.round((transcribeProgress.current / transcribeProgress.total) * 100)}%` : 'Transcriberen...'}
                  </p>
                </div>
              )}
              {transcriptStatus && !transcribeProgress && (
                <p className="text-[11px] text-white/40 mb-3">{transcriptStatus}</p>
              )}
              {transcript && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-white/40">
                      Transcriptie
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript).then(() => {
                          setTranscriptCopied(true);
                          setTimeout(() => setTranscriptCopied(false), 2000);
                        });
                      }}
                      className="flex items-center gap-1 h-6 px-2 rounded text-[10px] text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                    >
                      {transcriptCopied ? (
                        <><Check className="w-3 h-3" strokeWidth={2} /> Gekopieerd</>
                      ) : (
                        <><Copy className="w-3 h-3" strokeWidth={1.75} /> Kopieer</>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={6}
                    className="w-full bg-white/[0.04] border border-white/[0.10] rounded-xl px-4 py-3 text-[12px] text-white/70 resize-none outline-none leading-relaxed focus:border-white/[0.20] transition-colors"
                  />
                </div>
              )}
              {!transcript && !transcribing && !recording && (
                <p className="text-[12px] text-white/25 italic">
                  Nog geen bronnen toegevoegd — je kunt ook overslaan.
                </p>
              )}
            </div>
          )}

          {(step === 3 || (isSearch && step === 2)) && (
            <div>
              <label className="block text-[12px] font-semibold text-white/60 mb-3">
                Overzicht
              </label>
              <div className="space-y-3">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">
                    {isSearch ? 'Zoekopdracht' : 'Opdracht'}
                  </p>
                  <p className="text-[13px] text-white/75 leading-relaxed">
                    {description || <span className="text-white/30 italic">Niet ingevuld</span>}
                  </p>
                </div>
                {!isSearch && project.trim() && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">Klant/project</p>
                    <p className="text-[13px] text-white/75">{project}</p>
                  </div>
                )}
                {!isSearch && background.trim() && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">Achtergrond</p>
                    <p className="text-[12px] text-white/50 line-clamp-3">{background}</p>
                  </div>
                )}
                {!isSearch && transcript && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">Bronnen</p>
                    <p className="text-[12px] text-white/50 line-clamp-3">{transcript}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — verborgen tijdens client-bevestigingsstappen */}
        <div className="px-5 py-4 border-t border-white/[0.06] shrink-0 space-y-2">
          {!clientSuggestion && !newClientConfirm && (
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="h-10 px-4 rounded-xl text-[13px] text-white/60 hover:text-white border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
              >
                Terug
              </button>
            )}
            {!isLastStep ? (
              <button
                onClick={handleNext}
                disabled={step === 1 && !description.trim()}
                className="flex-1 h-10 rounded-xl bg-orange text-white text-[13px] font-semibold hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Volgende
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={!description.trim()}
                className="flex-1 h-10 rounded-xl bg-orange text-white text-[13px] font-semibold hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Genereren
              </button>
            )}
          </div>
          )}
          <button
            onClick={handleDirectChat}
            className="w-full text-center text-[11px] text-white/30 hover:text-white/60 transition-colors py-1"
          >
            Liever direct in chat?
          </button>
        </div>
      </div>
    </>
  );
}
