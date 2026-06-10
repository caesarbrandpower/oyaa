'use client';

// components/custom/VaultPage.jsx
// Simpele kluis-UI: bestanden uploaden en de inhoud van de kluis zien.

import { useState, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, Sparkles, Loader2 } from 'lucide-react';

const ACCEPT = '.pdf,.docx,.pptx,.txt,.eml';

export default function VaultPage({ tenant, documents: initialDocuments }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const inputRef = useRef(null);

  async function handleFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setBusy(true);
    for (const file of files) {
      setStatus(`Bezig met ${file.name}...`);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/vault/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok) {
          setStatus(`${file.name}: ${json.error ?? 'uploaden mislukt'}`);
        } else if (json.skipped) {
          setStatus(`${file.name}: stond al in de kluis`);
        } else {
          setStatus(`${file.name}: toegevoegd (${json.chunkCount} fragmenten)`);
          setDocuments((prev) => [
            {
              id: json.documentId,
              title: file.name,
              source_type: 'upload',
              output_type: null,
              client: null,
              project: null,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]);
        }
      } catch {
        setStatus(`${file.name}: uploaden mislukt`);
      }
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
          Terug naar chat
        </Link>

        <h1 className="text-xl font-semibold mb-1">Kluis</h1>
        <p className="text-[13px] text-white/50 mb-8">
          De kennisbank van {tenant?.name ?? 'het bureau'}. Alles wat hier staat kan
          Waybetter terugvinden in gesprekken.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-6 mb-3 rounded-xl border border-dashed border-white/[0.15] text-[13px] text-white/60 hover:text-white/90 hover:border-white/[0.3] hover:bg-white/[0.03] transition-colors disabled:opacity-50"
        >
          {busy
            ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
            : <Upload className="w-4 h-4" strokeWidth={1.75} />}
          {busy ? 'Bezig met verwerken...' : 'Upload een bestand (PDF, Word, PowerPoint, tekst)'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {status && <p className="text-[12px] text-white/50 mb-6">{status}</p>}

        <h2 className="text-[12px] font-medium text-white/40 uppercase tracking-wide mt-10 mb-3">
          In de kluis ({documents.length})
        </h2>
        {documents.length === 0 ? (
          <p className="text-[13px] text-white/35">
            Nog leeg. Upload een bestand of werk met Waybetter; documenten komen hier vanzelf in.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                {doc.source_type === 'generated'
                  ? <Sparkles className="w-4 h-4 shrink-0 text-white/40" strokeWidth={1.75} />
                  : <FileText className="w-4 h-4 shrink-0 text-white/40" strokeWidth={1.75} />}
                <div className="min-w-0">
                  <p className="text-[13px] text-white/80 truncate">{doc.title}</p>
                  <p className="text-[11px] text-white/35">
                    {[
                      doc.client,
                      doc.project,
                      new Date(doc.created_at).toLocaleDateString('nl-NL'),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
