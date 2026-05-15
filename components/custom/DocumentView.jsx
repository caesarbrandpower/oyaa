// components/custom/DocumentView.jsx
'use client';

import { useState, useEffect } from 'react';
import { Marked } from 'marked';
import { ArrowLeft, Copy, Download, MoreHorizontal } from 'lucide-react';

const md = new Marked({ breaks: true });

const LABEL_REGEX = /\[([A-Z][A-Z\s]+)\]/g;

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function injectLabelHtml(html) {
  return html.replace(/\[([A-Z][A-Z\s]+)\]/g, (_, label) => {
    if (isRedLabel(label)) {
      return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#CC2200;color:#fff;margin:0 2px;font-family:var(--font-lexend)">${label}</span>`;
    }
    return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#F59E0B;color:#7C4A00;margin:0 2px;font-family:var(--font-lexend)">${label}</span>`;
  });
}

function extractTitle(markdown) {
  const m = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (m) return m[1].trim();
  const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || '';
  return firstLine.replace(/[#*_`]/g, '').trim().slice(0, 80) || 'Document';
}

function parseMarkeringen(content) {
  const matches = [...content.matchAll(new RegExp(LABEL_REGEX.source, 'g'))];
  const seen = new Set();
  return matches.map(m => m[1]).filter(label => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]+\])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]+)\]$/);
    if (lm) {
      const label = lm[1];
      const red = isRedLabel(label);
      return [
        new docx.TextRun({
          text: ` ${label} `,
          bold: true,
          size: Math.max(16, size - 2),
          color: red ? 'FFFFFF' : '7C4A00',
          shading: { type: docx.ShadingType.SOLID, color: red ? 'CC2200' : 'F59E0B', fill: red ? 'CC2200' : 'F59E0B' },
        }),
        new docx.TextRun({ text: ' ', size }),
      ];
    }
    return [new docx.TextRun({ text: p.replace(/\*/g, ''), size })];
  });
}

async function downloadWordDoc(content, title) {
  if (!content?.trim()) return;
  const docx = await import('docx');
  const paragraphs = [];

  paragraphs.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: title, bold: true, size: 28 })],
    spacing: { after: 320 },
    border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
  }));

  // Skip the first h1 — it's already rendered as the title paragraph above
  let skipFirstH1 = true;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '') {
      paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } }));
      continue;
    }
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstH1) { skipFirstH1 = false; continue; }
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h1[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim(), bold: true, size: 28 })],
        spacing: { before: 240, after: 200 },
        border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      }));
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h2[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim().toUpperCase(), bold: true, size: 22, color: '111111' })],
        spacing: { before: 360, after: 120 },
        border: { bottom: { color: 'EEEEEE', space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
      }));
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h3[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim(), bold: true, size: 20, color: '444444' })],
        spacing: { before: 200, after: 80 },
      }));
      continue;
    }
    const heading = line.match(/^\*\*(.+?)\*\*(.*)$/);
    if (heading) {
      const rest = heading[2].replace(/^[\s\-\u2013\u2014]+/, '');
      // Strip trailing colon to prevent "Klant:: Coca-Cola" when appending ': '
      const labelText = heading[1].replace(/:$/, '');
      const runs = [new docx.TextRun({ text: labelText, bold: true, size: 22 })];
      if (rest) runs.push(new docx.TextRun({ text: ': ' + rest, size: 22 }));
      paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } }));
      continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: '• ', size: 20 }), ...parseInlineRuns(listItem[1], 20, docx)],
        indent: { left: 360 },
        spacing: { after: 80 },
      }));
      continue;
    }
    paragraphs.push(new docx.Paragraph({
      children: parseInlineRuns(line, 20, docx),
      spacing: { after: 120 },
    }));
  }

  const wordDoc = new docx.Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const blob = await docx.Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = title.toLowerCase().replace(/[\s/]+/g, '-') + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentView({ content, onClose, onImprove }) {
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const [downloading, setDownloading] = useState(false);

  const title = extractTitle(content);
  const markeringen = parseMarkeringen(content);
  const bodyHtml = injectLabelHtml(md.parse(content));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopyLabel('Gekopieerd');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    }).catch(() => {
      setCopyLabel('Mislukt');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    });
  }

  async function handleDownloadWord() {
    setDownloading(true);
    try {
      await downloadWordDoc(content, title);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex flex-col">
      {/* Header */}
      <header className="shrink-0 h-14 flex items-center px-4 md:px-6 border-b border-white/[0.06] gap-3">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          aria-label="Sluiten"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>
        <h1 className="flex-1 font-[family-name:var(--font-lexend)] text-[14px] font-semibold text-white truncate">
          {title}
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
          >
            <Copy className="w-3 h-3" strokeWidth={2} />
            {copyLabel}
          </button>
          <button
            onClick={handleDownloadWord}
            disabled={downloading}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" strokeWidth={2} />
            {downloading ? 'Bezig...' : 'Word'}
          </button>
          <button
            className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            aria-label="Meer opties"
          >
            <MoreHorizontal className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-16 py-10">
          <div
            className="max-w-2xl mx-auto doc-prose"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>

        {markeringen.length > 0 && (
          <aside className="hidden md:flex w-[280px] shrink-0 flex-col border-l border-white/[0.06]">
            {/* Header */}
            <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
              <span className="font-[family-name:var(--font-lexend)] text-[11px] font-semibold tracking-[0.1em] uppercase text-white/30">
                Markeringen
              </span>
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.06] text-[10px] font-bold text-white/50">
                {markeringen.length}
              </span>
            </div>

            {/* Markeringen lijst */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {markeringen.map((label) => {
                const isRed = isRedLabel(label);
                return (
                  <div
                    key={label}
                    className="rounded-lg border border-white/[0.06] p-3 bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          isRed
                            ? 'bg-red-950/60 text-red-400 border border-red-800/40'
                            : 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/40'
                        }`}
                      >
                        {isRed ? 'Ontbreekt' : 'Check'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/55 leading-relaxed font-medium">
                      {label}
                    </p>
                    <button
                      onClick={() => onImprove?.(`Aanvullende info voor [${label}]: `)}
                      className="mt-2 text-[11px] text-orange hover:text-orange/80 font-semibold transition-colors"
                    >
                      {isRed ? '+ Aanvullen' : '✓ Bevestigen'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Verbeteren knop */}
            <div className="px-4 py-4 border-t border-white/[0.06] shrink-0">
              <button
                onClick={() => onImprove?.('Ik wil dit document verbeteren. Aanvullende informatie: ')}
                className="w-full h-9 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white transition-colors"
              >
                Verbeteren met info
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
