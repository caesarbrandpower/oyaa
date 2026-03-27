'use client';

import { useState } from 'react';
import OutputCard from '@/components/OutputCard';

const OUTPUT_TYPES = [
  { key: 'summary-actions', label: 'Samenvatting met actiepunten', num: '01' },
  { key: 'internal-briefing', label: 'Interne briefing', num: '02' },
  { key: 'external-debrief', label: 'Externe debrief naar klant', num: '03' },
  { key: 'internal-actions', label: 'Actiepunten intern', num: '04' },
  { key: 'external-actions', label: 'Actiepunten extern', num: '05' },
  { key: 'project-planning', label: 'Projectplanning aanzet', num: '06' },
];

export default function PublicTranscriptForm() {
  const [transcript, setTranscript] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);

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
        }),
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
      setError('Er is een fout opgetreden. Controleer je verbinding en probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

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
      const r = await mammoth.extractRawText({ arrayBuffer });
      setTranscript(r.value.trim());
      setFileStatus({ msg: `"${file.name}" ingeladen.`, type: 'success' });
    } catch {
      setFileStatus({ msg: 'Fout bij het uitlezen van het Word-bestand.', type: 'error' });
    }
  }

  const statusColor = fileStatus?.type === 'error' ? 'text-red-600' : fileStatus?.type === 'success' ? 'text-green-600' : 'text-text-muted';

  return (
    <>
      <div className="border border-border rounded-xl p-9 shadow-sm">
        <h2 className="font-[family-name:var(--font-lexend)] text-lg font-semibold text-text mb-1">Jouw notities</h2>
        <p className="text-[15px] text-text-sec mb-5">Zet je notities neer of sleep een bestand. Wij doen de rest.</p>

        <textarea
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
              {loading ? 'Bezig met verwerken...' : 'Verwerk →'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-5 py-4">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="mt-6">
          <OutputCard output={result} />
        </div>
      )}
    </>
  );
}
