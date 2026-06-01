// components/custom/DocumentCard.jsx
'use client';

import { useState } from 'react';
import { FileText, Copy, ExternalLink, Download, Share2 } from 'lucide-react';
import {
  downloadWordDoc,
  downloadPdfDoc,
  shareDocument,
  fetchImageAsBase64,
  fetchImageAsBuffer,
  buildFilename,
} from '@/lib/doc-export';

function extractTitle(markdown) {
  const headingMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || '';
  return firstLine.replace(/[#*_`]/g, '').trim().slice(0, 80);
}

function extractPreview(markdown) {
  const stripped = markdown
    .replace(/^#{1,6}\s+.+$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\[([A-Z][A-Z\s?]+)\]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return stripped.slice(0, 150) + (stripped.length > 150 ? '...' : '');
}

function buildClientLogoUrl(client) {
  if (!client || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const slug = client.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}.png`;
}

export default function DocumentCard({
  content,
  onOpen,
  tenant = null,
  client = null,
  extras = null,
  outputType = null,
  outputTypeLabel = null,
}) {
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const [wordLoading, setWordLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLabel, setShareLabel] = useState('Deel als link');
  const docTitle = extractTitle(content);
  const preview = extractPreview(content);

  const chaseLogoUrl = tenant?.logo_url ?? null;
  const clientLogoUrl = buildClientLogoUrl(client);

  function getFilename(ext) {
    return buildFilename(outputTypeLabel, client, docTitle, ext);
  }

  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      setCopyLabel('Gekopieerd');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    }).catch(() => {
      setCopyLabel('Mislukt');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    });
  }

  async function handleWord(e) {
    e.stopPropagation();
    setWordLoading(true);
    try {
      const [chaseBuffer, clientBuffer] = await Promise.all([
        fetchImageAsBuffer(chaseLogoUrl),
        fetchImageAsBuffer(clientLogoUrl),
      ]);
      await downloadWordDoc(content, docTitle, { chaseBuffer, clientBuffer }, extras, getFilename('docx'));
    } finally {
      setWordLoading(false);
    }
  }

  async function handlePdf(e) {
    e.stopPropagation();
    setPdfLoading(true);
    try {
      const [chaseBase64, clientBase64] = await Promise.all([
        fetchImageAsBase64(chaseLogoUrl),
        fetchImageAsBase64(clientLogoUrl),
      ]);
      await downloadPdfDoc(content, docTitle, { chaseBase64, clientBase64 }, extras, getFilename('pdf'));
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleShare(e) {
    e.stopPropagation();
    setShareLoading(true);
    try {
      const url = await shareDocument(content, docTitle, client);
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
        setShareLabel('Link gekopieerd!');
        setTimeout(() => setShareLabel('Deel als link'), 3000);
      }
    } finally {
      setShareLoading(false);
    }
  }

  return (
    <div className="mt-2 border border-white/[0.10] rounded-xl p-4 bg-white/[0.03] max-w-lg">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-orange/10 border border-orange/20 flex items-center justify-center mt-0.5">
          <FileText className="w-4 h-4 text-orange" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-lexend)] text-[13px] font-semibold text-white leading-snug mb-1 truncate">
            {docTitle}
          </p>
          <p className="text-[12px] text-white/45 leading-relaxed line-clamp-2">
            {preview}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex flex-wrap items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
          className="flex items-center gap-1.5 h-8 px-3 bg-orange text-white rounded-lg text-[12px] font-semibold hover:bg-[#e03d00] transition-colors"
        >
          <ExternalLink className="w-3 h-3" strokeWidth={2} />
          Aanvullen
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 h-8 px-3 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors"
        >
          <Copy className="w-3 h-3" strokeWidth={2} />
          {copyLabel}
        </button>
        <button
          onClick={handleWord}
          disabled={wordLoading}
          className="flex items-center gap-1.5 h-8 px-3 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40"
        >
          <Download className="w-3 h-3" strokeWidth={2} />
          {wordLoading ? 'Bezig...' : 'Word'}
        </button>
        <button
          onClick={handlePdf}
          disabled={pdfLoading}
          className="flex items-center gap-1.5 h-8 px-3 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40"
        >
          <Download className="w-3 h-3" strokeWidth={2} />
          {pdfLoading ? 'Bezig...' : 'PDF'}
        </button>
        <button
          onClick={handleShare}
          disabled={shareLoading}
          className="flex items-center gap-1.5 h-8 px-3 bg-white/[0.06] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.09] transition-colors disabled:opacity-40"
        >
          <Share2 className="w-3 h-3" strokeWidth={2} />
          {shareLoading ? 'Bezig...' : shareLabel}
        </button>
      </div>
    </div>
  );
}
