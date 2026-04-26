'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAudioFile, useAudioTranscription } from '@/lib/use-audio';

const OUTPUT_TYPES = [
  { key: 'summary-actions', label: 'Samenvatting met actiepunten', num: '01' },
  { key: 'internal-briefing', label: 'Interne briefing', num: '02' },
  { key: 'external-debrief', label: 'Externe debrief naar klant', num: '03' },
  { key: 'internal-actions', label: 'Actiepunten intern', num: '04' },
  { key: 'external-actions', label: 'Actiepunten extern', num: '05' },
  { key: 'project-planning', label: 'Projectplanning aanzet', num: '06' },
];

export default function TranscriptForm({ projectId, onResult }) {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading) return;
    setDots(1);
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, [loading]);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const { transcribing, recording, transcribeFile, toggleRecording } = useAudioTranscription({
    onTranscript: (text) => setTranscript(text),
    onStatus: (msg) => setFileStatus({ msg, type: 'success' }),
    onError: (msg) => setFileStatus({ msg, type: 'error' }),
  });

  async function handleGenerate() {
    if (!transcript.trim() || !selectedType) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          outputType: selectedType,
          projectId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onResult?.(data.result, selectedType);
        router.refresh();
      }
    } catch {
      setError('Er is een fout opgetreden. Controleer je verbinding en probeer het opnieuw.');
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
      setFileStatus({ msg: `Bestandstype "${ext}" wordt niet ondersteund.`, type: 'error' });
      return;
    }

    setFileStatus({ msg: 'Bestand wordt ingelezen...', type: 'loading' });

    if (ext === '.txt') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTranscript(ev.target.result);
        setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
      };
      reader.onerror = () => setFileStatus({ msg: 'Fout bij inlezen.', type: 'error' });
      reader.readAsText(file);
    } else if (ext === '.pdf') {
      readPdf(file);
    } else {
      readDocx(file);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleFileInput(e) {
    handleFile(e.target.files[0]);
    e.target.value = '';
  }

  async function readPdf(file) {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      setTranscript(text.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen (${pdf.numPages} pagina's).`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van de PDF.', type: 'error' });
    }
  }

  async function readDocx(file) {
    try {
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      setTranscript(result.value.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van het Word-bestand.', type: 'error' });
    }
  }

  const statusColor = fileStatus?.type === 'error' ? 'text-red-600' : fileStatus?.type === 'success' ? 'text-green-600' : 'text-text-muted';

  return (
    <div className="border border-border rounded-xl p-9 shadow-sm">
      <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">Jouw notities</h2>
      <p className="text-[15px] text-text-sec mb-5">Zet je notities neer of sleep een bestand. Wij doen de rest.</p>

      <textarea
        ref={textareaRef}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
        onDrop={handleDrop}
        placeholder="Sleep een bestand hierin, of typ je aantekeningen."
        spellCheck={false}
        className={`w-full min-h-[220px] border-[1.5px] rounded-lg px-[18px] py-4 text-sm text-text leading-[1.7] resize-y outline-none transition-all ${
          dragOver
            ? 'border-orange border-dashed bg-orange-light shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
            : 'border-border bg-white focus:border-orange focus:shadow-[0_0_0_3px_rgba(255,72,0,0.1)]'
        }`}
      />

      {fileStatus && <p className={`text-xs mt-2 ${statusColor}`}>{fileStatus.msg}</p>}

      {/* Upload + Record buttons */}
      <div className="flex items-center gap-3 mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.doc,.docx,.mp3,.m4a,.mp4,.wav,.ogg,.webm"
          onChange={handleFileInput}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={transcribing}
          className="h-9 px-4 border border-border rounded-lg text-xs font-medium text-text-sec transition-all hover:border-orange hover:text-orange hover:bg-orange-light active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="mr-1.5">📎</span>
          Upload bestand
        </button>

        <button
          type="button"
          onClick={toggleRecording}
          disabled={transcribing}
          className={`h-9 px-4 border rounded-lg text-xs font-medium transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            recording
              ? 'border-red-400 text-red-600 bg-red-50 animate-pulse'
              : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
          }`}
        >
          <span className="mr-1.5">{recording ? '⏹️' : '🎙️'}</span>
          {recording ? 'Stop opname' : 'Opnemen'}
        </button>
      </div>

      <p className="text-[11px] text-text-muted mt-2">
        Upload tekst, Word, PDF of een audiobestand — wij doen de rest.
      </p>

      <div className="h-px bg-border my-8" />

      <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">Wat wil je maken?</h2>
      <p className="text-[15px] text-text-sec mb-5">Kies een outputtype en klik op Verwerk.</p>

      <label className="block text-[11px] font-semibold text-text-muted mb-2.5 uppercase tracking-wider">
        Kies een type
      </label>

      <div className="grid grid-cols-3 gap-2.5 max-[580px]:grid-cols-2 max-[380px]:grid-cols-1">
        {OUTPUT_TYPES.map(({ key, label, num }) => (
          <button
            key={key}
            onClick={() => setSelectedType(key)}
            className={`text-left border-[1.5px] rounded-lg p-3.5 text-[15px] font-medium leading-[1.4] transition-all active:scale-[0.98] cursor-pointer ${
              selectedType === key
                ? 'border-orange text-orange bg-orange-light shadow-[0_0_0_1px_#FF4800]'
                : 'border-border text-text-sec hover:border-orange hover:text-orange hover:bg-orange-light'
            }`}
          >
            <span className={`block text-xs font-semibold mb-1.5 tracking-wide ${
              selectedType === key ? 'text-orange-mid' : 'text-border'
            }`}>
              {num}
            </span>
            {label}
          </button>
        ))}
      </div>

      {selectedType && (
        <div className="mt-7">
          <button
            onClick={handleGenerate}
            disabled={loading || !transcript.trim()}
            className="h-12 px-8 bg-orange text-white rounded-lg text-sm font-semibold transition-all hover:bg-orange-hover shadow-[0_2px_8px_rgba(255,72,0,0.32)] hover:shadow-[0_4px_14px_rgba(255,72,0,0.38)] active:scale-[0.98] disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  {'Bezig met verwerken' + '.'.repeat(dots)}
                </span>
              ) : 'Verwerk →'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4">
          {error}
        </div>
      )}
    </div>
  );
}
