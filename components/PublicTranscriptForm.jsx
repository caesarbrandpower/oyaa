'use client';

import { useState, useRef } from 'react';
import OutputCard from '@/components/OutputCard';
import { isAudioFile, useAudioTranscription } from '@/lib/use-audio';

const OUTPUT_TYPES = [
  { key: 'summary-actions', label: 'Samenvatting', desc: 'De kern van het gesprek in een oogopslag', num: '01' },
  { key: 'internal-briefing', label: 'Interne briefing', desc: 'Alles wat je team moet weten om te beginnen', num: '02' },
  { key: 'external-debrief', label: 'Externe debrief', desc: 'Een nette terugkoppeling voor je klant', num: '03' },
  { key: 'internal-actions', label: 'Actiepunten intern', desc: 'Wie doet wat, en wanneer', num: '04' },
  { key: 'external-actions', label: 'Actiepunten extern', desc: 'Wat de klant van jullie kan verwachten', num: '05' },
  { key: 'project-planning', label: 'Projectplanning', desc: 'Van gesprek naar overzichtelijke planning', num: '06' },
  { key: 'supplier-briefing', label: 'Leveranciersbriefing', desc: 'Voor wie je iets uitbesteedt', num: '07' },
  { key: 'staff-planning', label: 'Personeelsplanning', desc: 'Wie wordt waar ingepland', num: '08' },
  { key: 'client-status', label: 'Statusupdate klant', desc: 'Korte update over voortgang', num: '09' },
];

const STEPS = [
  {
    num: '01',
    title: 'Gooi er alles in',
    desc: 'Aantekeningen, een opgenomen gesprek, een e-mail of een bestand. Alles werkt.',
  },
  {
    num: '02',
    title: 'Kies wat je nodig hebt',
    desc: 'Briefing, samenvatting, actiepunten. Jij bepaalt het resultaat.',
  },
  {
    num: '03',
    title: 'Klaar voor gebruik',
    desc: 'Direct bruikbaar voor je team of klant. Kopieer, download of stuur door.',
  },
];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function PublicTranscriptForm() {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const toolRef = useRef(null);

  const {
    transcribing,
    recording,
    paused,
    elapsed,
    lastRecordingUrl,
    transcribeFile,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    discardRecording,
  } = useAudioTranscription({
    onTranscript: (text) => setTranscript(text),
    onStatus: (msg) => msg ? setFileStatus({ msg, type: 'success' }) : setFileStatus(null),
    onError: (msg) => setFileStatus({ msg, type: 'error' }),
  });

  function handleReset() {
    setTranscript('');
    setSelectedType(null);
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
        body: JSON.stringify({ transcript, outputType: selectedType }),
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

    // Audio files go to Whisper
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

      {/* Alles op één plek */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-16">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-orange uppercase mb-5 font-[family-name:var(--font-outfit)]">
            Alles op één plek
          </p>
          <p className="text-[17px] text-white/50 leading-[1.7] max-w-[560px] font-[family-name:var(--font-outfit)]">
            Van het eerste gesprek met een klant tot de definitieve briefing.{' '}
            Waybetter brengt alles samen — opnemen, verwerken, documenteren.{' '}
            Zonder tools te wisselen, zonder bestanden te kopiëren.
          </p>
        </div>
      </section>

      {/* Output types showcase */}
      <section className="bg-dark border-t border-dark-border animate-hero-4">
        <div className="max-w-[900px] mx-auto px-8 py-14">
          <p className="text-[13px] text-white/30 font-[family-name:var(--font-outfit)] mb-5">Wat wil je vandaag maken?</p>
          <div className="grid grid-cols-3 gap-3 max-[680px]:grid-cols-2 max-[420px]:grid-cols-1">
            {OUTPUT_TYPES.map(({ key, label, desc, num }) => (
              <button
                key={key}
                onClick={() => selectAndScroll(key)}
                className={`group text-left rounded-xl p-5 transition-all duration-200 cursor-pointer border ${
                  selectedType === key
                    ? 'bg-orange/10 border-orange/40 shadow-[0_0_24px_rgba(255,72,0,0.1)]'
                    : 'bg-dark-card border-dark-border hover:border-orange/30 hover:bg-orange/[0.04]'
                }`}
              >
                <span className={`block text-[11px] font-semibold tracking-[0.15em] mb-2 transition-colors font-[family-name:var(--font-outfit)] ${
                  selectedType === key ? 'text-orange' : 'text-white/20 group-hover:text-orange/50'
                }`}>
                  {num}
                </span>
                <span className={`block text-[15px] font-semibold mb-1 transition-colors font-[family-name:var(--font-outfit)] ${
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

      {/* How it works */}
      <section className="bg-dark border-t border-dark-border">
        <div className="max-w-[900px] mx-auto px-8 py-16">
          <div className="grid grid-cols-3 gap-8 max-[680px]:grid-cols-1 max-[680px]:gap-10">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-orange mb-3 font-[family-name:var(--font-outfit)]">
                  {num}
                </div>
                <h3 className="font-[family-name:var(--font-lexend)] text-[17px] font-semibold text-white/90 mb-2">
                  {title}
                </h3>
                <p className="text-[14px] text-white/35 leading-[1.6] font-[family-name:var(--font-outfit)]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tool section */}
      <section ref={toolRef} className="bg-warm scroll-mt-4" id="tool">
        <div className="max-w-[900px] mx-auto px-8 py-16">
          <div className="border border-border rounded-2xl p-8 max-[480px]:p-5 bg-white shadow-sm">
            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Jouw notities
            </h2>
            <p className="text-[15px] text-text-sec mb-5 font-[family-name:var(--font-outfit)]">
              Plak tekst, typ je aantekeningen of sleep een bestand.
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

            {/* Recording UI */}
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
                {/* File upload + record + status */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
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
                    disabled={transcribing}
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

                  {fileStatus && (
                    <span className={`text-xs font-[family-name:var(--font-outfit)] ${
                      fileStatus.type === 'error' ? 'text-red-500' :
                      fileStatus.type === 'success' ? 'text-emerald-600' : 'text-text-muted'
                    }`}>
                      {fileStatus.msg}
                      {fileStatus.type === 'success' && lastRecordingUrl && (
                        <a
                          href={lastRecordingUrl}
                          download="opname.webm"
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

                <p className="text-[11px] text-text-muted mt-2 font-[family-name:var(--font-outfit)]">
                  Upload tekst, Word, PDF of een audiobestand — wij doen de rest.
                </p>
              </>
            )}

            <div className="h-px bg-border my-7" />

            <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">
              Wat wil je maken?
            </h2>
            <p className="text-[15px] text-text-sec mb-4 font-[family-name:var(--font-outfit)]">
              Kies een type en klik op Verwerk.
            </p>

            <div className="grid grid-cols-3 gap-2 max-[580px]:grid-cols-2 max-[380px]:grid-cols-1">
              {OUTPUT_TYPES.map(({ key, label, num }) => (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`text-left border-[1.5px] rounded-lg p-3 text-[14px] font-medium leading-[1.4] transition-all active:scale-[0.98] cursor-pointer font-[family-name:var(--font-outfit)] ${
                    selectedType === key
                      ? 'border-orange text-orange bg-orange-light shadow-[0_0_0_1px_#FF4800]'
                      : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
                  }`}
                >
                  <span className={`block text-[10px] font-semibold mb-1 tracking-wider ${
                    selectedType === key ? 'text-orange/50' : 'text-border'
                  }`}>
                    {num}
                  </span>
                  {label}
                </button>
              ))}
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
            <OutputCard output={result} transcript={transcript} />
          </div>
        </section>
      )}
    </>
  );
}
