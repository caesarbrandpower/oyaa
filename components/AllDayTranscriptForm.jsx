'use client';

import { useState, useRef } from 'react';
import OutputCard from '@/components/OutputCard';
import { isAudioFile, useAudioTranscription, supportsScreenAudio } from '@/lib/use-audio';

const ALLDAY_TYPES = [
  { key: 'allday-samenvatting', label: 'Samenvatting', desc: 'De kern van het gesprek, direct helder' },
  { key: 'allday-briefing', label: 'Briefing', desc: 'Een heldere opdracht om mee aan de slag te gaan' },
  { key: 'allday-debrief', label: 'Debrief', desc: 'Een nette terugkoppeling, klaar om te delen' },
];

const RECIPIENTS = [
  { key: 'team', label: 'Team' },
  { key: 'klant', label: 'Klant' },
  { key: 'leverancier', label: 'Leverancier' },
  { key: 'directie', label: 'Directie' },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function AllDayTranscriptForm() {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState('team');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [copyTranscriptLabel, setCopyTranscriptLabel] = useState('Kopieer transcript');
  const toolRef = useRef(null);

  const {
    transcribing,
    recording,
    paused,
    elapsed,
    lastRecordingUrl,
    lastRecordingFilename,
    screenRecording,
    screenElapsed,
    transcribeFile,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
    startScreenRecording,
    stopScreenRecording,
  } = useAudioTranscription({
    onTranscript: (text) => setTranscript(text),
    onStatus: (msg) => msg ? setFileStatus({ msg, type: 'success' }) : setFileStatus(null),
    onError: (msg) => setFileStatus({ msg, type: 'error' }),
  });

  function handleReset() {
    setTranscript('');
    setSelectedType(null);
    setSelectedRecipient('team');
    setResult(null);
    setError(null);
    setFileStatus(null);
  }

  function selectAndScroll(key) {
    setSelectedType(key);
    setTimeout(() => {
      toolRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  async function handleGenerate() {
    if (!transcript.trim() || !selectedType) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, outputType: selectedType, recipient: selectedRecipient }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult({
          result: data.result,
          output_type: selectedType,
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      setError('Er is een fout opgetreden. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  function handleFile(file) {
    if (!file) return;
    if (isAudioFile(file)) {
      setFileStatus({ msg: 'Je opname wordt verwerkt...', type: 'loading' });
      transcribeFile(file);
      return;
    }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const supported = ['.txt', '.pdf', '.doc', '.docx'];
    if (!supported.includes(ext)) {
      setFileStatus({ msg: `"${ext}" wordt niet ondersteund.`, type: 'error' });
      return;
    }
    setFileStatus({ msg: 'Bestand wordt ingelezen...', type: 'loading' });
    if (ext === '.txt') readTxt(file);
    else if (ext === '.pdf') readPdf(file);
    else readDocx(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function readTxt(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTranscript(ev.target.result);
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    };
    reader.onerror = () => setFileStatus({ msg: 'Fout bij inlezen.', type: 'error' });
    reader.readAsText(file);
  }

  async function readPdf(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      setTranscript(text.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen (${pdf.numPages} pagina's).`, type: 'success' });
    } catch (err) {
      console.error('PDF parse error:', err);
      setFileStatus({ msg: 'Fout bij het uitlezen van de PDF.', type: 'error' });
    }
  }

  async function readDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const r = await mammoth.extractRawText({ arrayBuffer });
      setTranscript(r.value.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van het Word-bestand.', type: 'error' });
    }
  }

  return (
    <>
      {/* Privacy badge */}
      <div className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-5">
          <div className="inline-flex items-center gap-2.5 text-[13px] text-white/40 font-[family-name:var(--font-outfit)]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-orange/70 shrink-0">
              <rect x="2" y="7" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>
              Klantgegevens worden geanonimiseerd voor verwerking.
              <span className="text-white/25 ml-1">Veilig voor vertrouwelijke bureauinformatie.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Output type showcase */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-14">
          <p className="text-[13px] text-white/30 font-[family-name:var(--font-outfit)] mb-5">
            Wat wil je vandaag maken?
          </p>
          <div className="grid grid-cols-3 gap-4 max-[580px]:grid-cols-1">
            {ALLDAY_TYPES.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => selectAndScroll(key)}
                className={`group text-left rounded-xl p-6 transition-all duration-200 cursor-pointer border ${
                  selectedType === key
                    ? 'bg-orange/10 border-orange/40 shadow-[0_0_24px_rgba(255,72,0,0.1)]'
                    : 'bg-dark-card border-dark-border hover:border-orange/30 hover:bg-orange/[0.04]'
                }`}
              >
                <span className={`block text-[17px] font-semibold mb-2 transition-colors font-[family-name:var(--font-outfit)] ${
                  selectedType === key ? 'text-orange' : 'text-white/85 group-hover:text-white'
                }`}>
                  {label}
                </span>
                <span className="block text-[13px] text-white/30 leading-snug font-[family-name:var(--font-outfit)]">
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tool */}
      <section ref={toolRef} className="bg-warm scroll-mt-4 border-t border-dark-border" id="tool">
        <div className="max-w-[900px] mx-auto px-8 py-16">
          <div className="border border-border rounded-2xl p-8 max-[480px]:p-5 bg-white shadow-sm">
            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Jouw input
            </h2>
            <p className="text-[15px] text-text-sec mb-5 font-[family-name:var(--font-outfit)]">
              Plak je aantekeningen, neem een gesprek op of sleep een bestand.
            </p>

            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
              onDrop={handleDrop}
              placeholder="Plak je aantekeningen, typ wat je hebt opgeschreven, of sleep een bestand hierin."
              spellCheck={false}
              className={`w-full min-h-[200px] border-[1.5px] rounded-xl px-5 py-4 text-sm text-text leading-[1.75] resize-y outline-none transition-all font-[family-name:var(--font-outfit)] ${
                dragOver
                  ? 'border-orange border-dashed bg-orange-light shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
                  : 'border-border bg-warm focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.08)]'
              }`}
            />

            {/* Screen recording UI */}
            {screenRecording && (
              <div className="mt-4 border border-red-200 bg-red-50/60 rounded-xl px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-[14px] font-semibold text-red-600 font-[family-name:var(--font-outfit)]">
                    Bezig met opnemen — video-call
                  </span>
                  <span className="text-[15px] font-mono font-semibold text-red-500 tabular-nums">
                    {formatTime(screenElapsed)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopScreenRecording}
                  className="h-9 px-4 bg-red-500 text-white rounded-lg text-[13px] font-semibold transition-all hover:bg-red-600 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                >
                  Stoppen
                </button>
              </div>
            )}

            {/* Mic recording UI */}
            {recording ? (
              <div className="mt-4 border border-red-200 bg-red-50/60 rounded-xl px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-[14px] font-semibold text-red-600 font-[family-name:var(--font-outfit)]">
                    {paused ? 'Opname gepauzeerd' : 'Opname bezig...'}
                  </span>
                  <span className="text-[15px] font-mono font-semibold text-red-500 tabular-nums">
                    {formatTime(elapsed)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={paused ? resumeRecording : pauseRecording}
                    className="h-9 px-4 border border-red-200 rounded-lg text-[13px] font-medium text-red-600 bg-white transition-all hover:bg-red-50 hover:border-red-300 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    {paused ? 'Hervatten' : 'Pauzeren'}
                  </button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="h-9 px-4 bg-red-500 text-white rounded-lg text-[13px] font-semibold transition-all hover:bg-red-600 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    Stoppen
                  </button>
                  <button
                    type="button"
                    onClick={discardRecording}
                    className="h-9 px-4 border border-border rounded-lg text-[13px] font-medium text-text-muted transition-all hover:border-red-200 hover:text-red-500 active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-[13px] text-text-sec hover:text-orange transition-colors cursor-pointer font-[family-name:var(--font-outfit)]">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 10v2.667A1.334 1.334 0 0 1 12.667 14H3.333A1.334 1.334 0 0 1 2 12.667V10" />
                        <polyline points="5,6 8,3 11,6" />
                        <line x1="8" y1="3" x2="8" y2="10" />
                      </svg>
                      Upload bestand
                      <input
                        type="file"
                        accept=".txt,.pdf,.doc,.docx,.mp3,.m4a,.mp4,.wav,.ogg,.webm"
                        className="hidden"
                        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ''; }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={startRecording}
                      disabled={transcribing || screenRecording}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec hover:text-orange transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-outfit)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <rect x="5" y="1" width="6" height="10" rx="3" />
                        <path d="M13 7a5 5 0 0 1-10 0" />
                        <line x1="8" y1="12" x2="8" y2="15" />
                        <line x1="5.5" y1="15" x2="10.5" y2="15" />
                      </svg>
                      Opnemen
                    </button>

                    <button
                      type="button"
                      onClick={startScreenRecording}
                      disabled={transcribing || recording || screenRecording}
                      title={supportsScreenAudio() ? 'Open je Zoom/Teams/Meet in een browser-tabblad, klik hier en selecteer dat tabblad' : 'Gebruik Chrome of Edge voor video-call opname'}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec hover:text-orange transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-outfit)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14" />
                        <rect x="2" y="7" width="13" height="10" rx="2" />
                      </svg>
                      Video-call opnemen
                    </button>

                  {transcript.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(transcript).then(() => {
                            setCopyTranscriptLabel('Gekopieerd \u2713');
                            setTimeout(() => setCopyTranscriptLabel('Kopieer transcript'), 2200);
                          });
                        }}
                        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-sec hover:text-orange transition-all cursor-pointer font-[family-name:var(--font-outfit)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <rect x="6" y="6" width="8" height="8" rx="1.5" />
                          <path d="M10 6V3.5A1.5 1.5 0 0 0 8.5 2h-5A1.5 1.5 0 0 0 2 3.5v5A1.5 1.5 0 0 0 3.5 10H6" />
                        </svg>
                        {copyTranscriptLabel}
                      </button>
                    )}

                    {fileStatus && (
                      <span className={`text-xs font-[family-name:var(--font-outfit)] ${
                        fileStatus.type === 'error' ? 'text-red-500' :
                        fileStatus.type === 'success' ? 'text-emerald-600' : 'text-text-muted'
                      }`}>
                        {fileStatus.msg}
                        {fileStatus.type === 'success' && lastRecordingUrl && (
                          <a
                            href={lastRecordingUrl}
                            download={lastRecordingFilename || 'opname.m4a'}
                            className="inline-flex items-center gap-1 ml-2 text-orange hover:text-orange-hover transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 10v2.667A1.334 1.334 0 0 1 12.667 14H3.333A1.334 1.334 0 0 1 2 12.667V10" />
                              <polyline points="5,10 8,13 11,10" />
                              <line x1="8" y1="13" x2="8" y2="3" />
                            </svg>
                            Download audio
                          </a>
                        )}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text transition-all cursor-pointer shrink-0 font-[family-name:var(--font-outfit)]"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                    </svg>
                    Nieuw bestand
                  </button>
                </div>

                <p className="text-[11px] text-text-muted mt-2 font-[family-name:var(--font-outfit)]">
                  Upload tekst, Word, PDF of een audiobestand.
                </p>
              </>
            )}

            <div className="h-px bg-border my-7" />

            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Wat wil je maken?
            </h2>
            <p className="text-[15px] text-text-sec mb-4 font-[family-name:var(--font-outfit)]">
              Kies een type en een ontvanger.
            </p>

            {/* Output type selector in form */}
            <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
              {ALLDAY_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`text-left border-[1.5px] rounded-lg p-3 text-[14px] font-semibold leading-[1.4] transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] ${
                    selectedType === key
                      ? 'border-orange text-orange bg-orange-light shadow-[0_0_0_1px_#FF4800]'
                      : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Recipient selector */}
            <div className="mt-5">
              <span className="text-[12px] text-text-muted font-[family-name:var(--font-outfit)] block mb-2">
                Voor wie?
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {RECIPIENTS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRecipient(key)}
                    className={`h-8 px-4 rounded-lg text-[13px] font-medium transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] ${
                      selectedRecipient === key
                        ? 'bg-orange text-white shadow-[0_2px_8px_rgba(255,72,0,0.25)]'
                        : 'border-[1.5px] border-border text-text-sec hover:border-orange hover:text-orange'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {selectedType && (
              <div className="mt-7 flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !transcript.trim()}
                  className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-orange hover:shadow-[0_6px_24px_rgba(255,72,0,0.3)] active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer font-[family-name:var(--font-outfit)]"
                >
                  {loading ? 'Bezig met verwerken...' : 'Verwerk \u2192'}
                </button>
                <button
                  onClick={handleReset}
                  className="h-12 px-5 border-[1.5px] border-border text-text-sec rounded-lg text-sm font-medium transition-all hover:border-text-muted hover:text-text active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)]"
                >
                  Nieuw bestand
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4 font-[family-name:var(--font-outfit)]">
                {error}
              </div>
            )}
          </div>
        </div>
      </section>

      {result && (
        <section className="bg-warm pb-16">
          <div className="max-w-[900px] mx-auto px-8">
            <OutputCard output={result} transcript={transcript} onReset={handleReset} />
          </div>
        </section>
      )}
    </>
  );
}
