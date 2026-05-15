// components/custom/DocumentView.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Marked } from 'marked';
import { ArrowLeft, Copy, Download, MoreHorizontal, Share2 } from 'lucide-react';

const md = new Marked({ breaks: true });

const LABEL_REGEX = /\[([A-Z][A-Z\s]*(:[^\]]*)?)\]/g;

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function injectLabelHtml(html) {
  let idx = 0;
  const baseStyle = 'display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;margin:0 2px;cursor:pointer;font-family:var(--font-lexend)';
  return html.replace(/\[([A-Z][A-Z\s]*(:[^\]]*)?)\]/g, (_, label) => {
    const currentIdx = idx++;
    if (isRedLabel(label)) {
      return `<span data-marker-idx="${currentIdx}" style="${baseStyle};background:#CC2200;color:#fff">${label}</span>`;
    }
    return `<span data-marker-idx="${currentIdx}" style="${baseStyle};background:#F59E0B;color:#7C4A00">${label}</span>`;
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
  return matches.map(m => m[1]);
}

function replaceOccurrence(text, labelPattern, occurrenceIndex, replacement) {
  let count = 0;
  return text.replace(new RegExp(labelPattern.source, 'g'), (match) => {
    if (count === occurrenceIndex) {
      count++;
      return replacement;
    }
    count++;
    return match;
  });
}

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]*(?::[^\]]*)?])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]*(?::[^\]]*)?)\]$/);
    if (lm) {
      const label = lm[1];
      const red = isRedLabel(label);
      return [
        new docx.TextRun({ text: `[${label}]`, bold: true, size }),
      ];
    }
    return [new docx.TextRun({ text: p.replace(/\*/g, ''), size })];
  });
}

async function downloadPdfDoc(content, title) {
  if (!content?.trim()) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Collect all unique labels for the summary at the end
  const allLabels = [];
  const seenLabels = new Set();
  for (const m of content.matchAll(/\[([A-Z][A-Z\s]*(:[^\]]*)?)\]/g)) {
    if (!seenLabels.has(m[1])) {
      seenLabels.add(m[1]);
      allLabels.push(m[1]);
    }
  }

  // Split text into normal/bold segments based on label pattern
  function splitSegments(text) {
    const segs = [];
    const re = /(\[[A-Z][A-Z\s]*(:[^\]]*)?])/g;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
      segs.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), bold: false });
    return segs;
  }

  // Render segments inline at current y, return height consumed
  function renderInlineSegments(segs, fontSize, indentX) {
    doc.setFontSize(fontSize);
    let cx = indentX;
    for (const seg of segs) {
      if (!seg.text) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      doc.text(seg.text, cx, y);
      cx += doc.getTextWidth(seg.text);
    }
    const lineH = fontSize * 0.45 + 1;
    return lineH + 2;
  }

  function checkPage(needed) {
    if (y + (needed || 8) > 277) {
      doc.addPage();
      y = margin;
    }
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 10;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    checkPage();

    if (line === '') {
      y += 4;
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const text = h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkPage(wrapped.length * 7 + 4);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 7 + 4;
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const text = h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase();
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkPage(wrapped.length * 6 + 4);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 6 + 4;
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      const text = h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkPage(wrapped.length * 6 + 3);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 6 + 3;
      continue;
    }

    // List items
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      doc.setFontSize(10);
      const segs = splitSegments(listItem[1].replace(/\*\*/g, ''));
      const hasLabel = segs.some(s => s.bold);
      checkPage(7);
      if (hasLabel) {
        doc.setFont('helvetica', 'normal');
        doc.text('• ', margin + 5, y);
        const bulletWidth = doc.getTextWidth('• ');
        const indentX = margin + 5 + bulletWidth;
        let cx = indentX;
        for (const seg of segs) {
          if (!seg.text) continue;
          doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
          doc.text(seg.text, cx, y);
          cx += doc.getTextWidth(seg.text);
        }
        y += 5 + 2;
      } else {
        doc.setFont('helvetica', 'normal');
        const text = segs.map(s => s.text).join('').trim();
        const wrapped = doc.splitTextToSize('• ' + text, maxWidth - 5);
        doc.text(wrapped, margin + 5, y);
        y += wrapped.length * 5 + 2;
      }
      continue;
    }

    // Regular paragraph
    doc.setFontSize(10);
    const cleanLine = line.replace(/\*\*/g, '');
    const segs = splitSegments(cleanLine);
    const hasLabel = segs.some(s => s.bold);
    if (!hasLabel) {
      const text = segs.map(s => s.text).join('').trim();
      if (!text) { y += 3; continue; }
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkPage(wrapped.length * 5 + 3);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 3;
    } else {
      checkPage(7);
      y += renderInlineSegments(segs, 10, margin);
    }
  }

  // Openstaande punten section
  if (allLabels.length > 0) {
    y += 10;
    checkPage(20);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Openstaande punten', margin, y);
    y += 8;
    allLabels.forEach((label, i) => {
      checkPage(8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const text = `${i + 1}. ${label}`;
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 3;
    });
  }

  doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
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
  const [localContent, setLocalContent] = useState(content);
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [highlightedCardIdx, setHighlightedCardIdx] = useState(null);
  const docBodyRef = useRef(null);
  const sidebarRef = useRef(null);

  const title = extractTitle(localContent);
  const markeringen = parseMarkeringen(localContent);
  const bodyHtml = injectLabelHtml(md.parse(localContent));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleCopy() {
    navigator.clipboard.writeText(localContent).then(() => {
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
      await downloadWordDoc(localContent, title);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      await downloadPdfDoc(localContent, title);
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch('/api/share-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: localContent, outputType: null, title }),
      });
      const data = await res.json();
      if (data.token) {
        const url = `${window.location.origin}/doc/${data.token}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url).catch(() => {});
      }
    } finally {
      setSharing(false);
    }
  }

  function handleSaveEdit(label, idx) {
    if (!editValue.trim()) {
      setEditingIdx(null);
      return;
    }
    setLocalContent(prev => replaceOccurrence(prev, LABEL_REGEX, idx, editValue.trim()));
    setEditingIdx(null);
    setEditValue('');
  }

  useEffect(() => {
    if (highlightedCardIdx === null) return;
    const t = setTimeout(() => setHighlightedCardIdx(null), 2000);
    return () => clearTimeout(t);
  }, [highlightedCardIdx]);

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
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors disabled:opacity-40"
          >
            <Download className="w-3 h-3" strokeWidth={2} />
            {downloadingPdf ? 'Bezig...' : 'PDF'}
          </button>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors disabled:opacity-40"
          >
            <Share2 className="w-3 h-3" strokeWidth={2} />
            {sharing ? 'Bezig...' : shareUrl ? 'Link gekopieerd!' : 'Deel als link'}
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
            ref={docBodyRef}
            className="max-w-2xl mx-auto doc-prose"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            onClick={(e) => {
              const markerEl = e.target.closest('[data-marker-idx]');
              if (!markerEl) return;
              const idx = parseInt(markerEl.getAttribute('data-marker-idx'), 10);
              setHighlightedCardIdx(idx);
              if (sidebarRef.current) {
                const card = sidebarRef.current.querySelector(`[data-card-idx="${idx}"]`);
                card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
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

            {/* Markeringen lijst — click card -> scroll doc pill; click pill -> highlight card */}
            <div ref={sidebarRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {markeringen.map((label, idx) => {
                const isRed = isRedLabel(label);
                const isEditing = editingIdx === idx;
                return (
                  <div
                    key={idx}
                    data-card-idx={idx}
                    className={`rounded-lg border p-3 bg-white/[0.02] transition-colors cursor-pointer ${
                      highlightedCardIdx === idx
                        ? 'border-orange/60 bg-orange/[0.04]'
                        : 'border-white/[0.06]'
                    }`}
                    onClick={(e) => {
                      if (e.target.closest('button, textarea')) return;
                      if (docBodyRef.current) {
                        const pill = docBodyRef.current.querySelector(`[data-marker-idx="${idx}"]`);
                        if (pill) {
                          pill.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          pill.style.outline = '2px solid #FF4800';
                          pill.style.outlineOffset = '2px';
                          setTimeout(() => {
                            pill.style.outline = '';
                            pill.style.outlineOffset = '';
                          }, 1500);
                        }
                      }
                    }}
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
                    <p className="text-[11px] text-white/55 leading-relaxed font-medium">{label}</p>
                    {isEditing ? (
                      <div className="mt-2">
                        <textarea
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          placeholder="Typ de aanvullende informatie..."
                          rows={3}
                          className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2 text-[11px] text-white placeholder-white/25 resize-none outline-none leading-relaxed focus:border-white/[0.25] transition-colors"
                        />
                        <div className="flex gap-2 mt-1.5">
                          <button
                            onClick={() => handleSaveEdit(label, idx)}
                            disabled={!editValue.trim()}
                            className="flex-1 h-7 rounded-lg bg-orange text-white text-[11px] font-semibold hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            Opslaan
                          </button>
                          <button
                            onClick={() => { setEditingIdx(null); setEditValue(''); }}
                            className="h-7 px-3 rounded-lg text-[11px] text-white/40 hover:text-white border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
                          >
                            Annuleer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingIdx(idx); setEditValue(''); }}
                        className="mt-2 text-[11px] text-orange hover:text-orange/80 font-semibold transition-colors"
                      >
                        {isRed ? '+ Aanvullen' : '✓ Bevestigen'}
                      </button>
                    )}
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
