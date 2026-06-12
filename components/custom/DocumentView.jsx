// components/custom/DocumentView.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Marked } from 'marked';
import { ArrowLeft, ChevronLeft, Copy, Download, MoreHorizontal, Paperclip, Share2, Mic, Square, ArrowUp, Undo2, X } from 'lucide-react';
import { useAudioTranscription } from '@/lib/use-audio';
import {
  fetchImageAsBase64,
  fetchImageAsBuffer,
  fetchLogoBase64,
  fetchLogoBuffer,
  downloadPdfDoc as sharedDownloadPdf,
  downloadWordDoc as sharedDownloadWord,
  buildFilename,
} from '@/lib/doc-export';

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
    const displayLabel = label.split(':')[0].trim();
    const numbered = `${currentIdx + 1} · ${displayLabel}`;
    if (isRedLabel(label)) {
      return `<span data-marker-idx="${currentIdx}" style="${baseStyle};background:#CC2200;color:#fff">${numbered}</span>`;
    }
    return `<span data-marker-idx="${currentIdx}" style="${baseStyle};background:#F59E0B;color:#7C4A00">${numbered}</span>`;
  });
}

function annotateParaIdx(html) {
  let idx = 0;
  return html.replace(/<(h[1-6]|p|ul|ol|blockquote|pre)(\s|>)/g, (_, tag, rest) => {
    return `<${tag} data-para-idx="${idx++}"${rest}`;
  });
}

function extractTitle(markdown) {
  const m = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (m) return m[1].trim().replace(/→/g, 'naar');
  const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || '';
  return firstLine.replace(/[#*_`]/g, '').replace(/→/g, 'naar').trim().slice(0, 80) || 'Document';
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

// Vindt de paragraaf (gescheiden door \n\n) die de nth marker-occurrence bevat.
// Geeft { text, start, end } terug of null als niet gevonden.
function extractParagraph(content, markerIdx) {
  const seps = [...content.matchAll(/\n\n+/g)];
  const paras = [];
  let start = 0;
  for (const sep of seps) {
    paras.push({ start, end: sep.index });
    start = sep.index + sep[0].length;
  }
  paras.push({ start, end: content.length });

  const labelRe = new RegExp(LABEL_REGEX.source, 'g');
  let count = 0;
  for (const para of paras) {
    const text = content.slice(para.start, para.end);
    if (!text.trim()) continue;
    const matches = [...text.matchAll(labelRe)];
    if (count + matches.length > markerIdx) {
      return { text, start: para.start, end: para.end };
    }
    count += matches.length;
  }
  return null;
}

// ── PDF export (lokale versie vervangen door gedeelde — zie lib/doc-export.js) ─

async function downloadPdfDoc(content, title, logos = {}, extras = null, filename = null, outputType = null, client = null, project = null) {
  return sharedDownloadPdf(content, title, logos, extras, filename, outputType, client, project);
}

// ── Word export (lokale versie vervangen door gedeelde — zie lib/doc-export.js)

async function downloadWordDoc(content, title, logos = {}, extras = null, filename = null, outputType = null, client = null, project = null) {
  return sharedDownloadWord(content, title, logos, extras, filename, outputType, client, project);
}

// ── (legacy PDF en Word functies verwijderd — zie lib/doc-export.js) ──────────

async function _unused(content, title, logos = {}, extras = null) {
  if (!content?.trim()) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const LOGO_H = 10; // mm
  let y = margin;

  // ── Logo header ──────────────────────────────────────────────────────────
  // Note: SVG check removed — try/catch inside handles unsupported formats
  if (logos.chaseBase64 || logos.clientBase64) {
    doc.setFillColor(248, 248, 247);
    doc.rect(0, 0, pageWidth, LOGO_H + 8, 'F');

    if (logos.chaseBase64) {
      try {
        const dims = await getImageDimensions(logos.chaseBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 60);
        doc.addImage(logos.chaseBase64, getImageFormat(logos.chaseBase64), margin, 4, w, LOGO_H);
      } catch { /* skip SVG or unsupported format */ }
    }
    if (logos.clientBase64) {
      try {
        const dims = await getImageDimensions(logos.clientBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 60);
        doc.addImage(logos.clientBase64, getImageFormat(logos.clientBase64), pageWidth - margin - w, 4, w, LOGO_H);
      } catch { /* skip SVG or unsupported format */ }
    }
    y = LOGO_H + 14;
  }

  // ── Collect labels for summary ──────────────────────────────────────────
  const allLabels = [];
  const seenLabels = new Set();
  for (const m of content.matchAll(/\[([A-Z][A-Z\s]*(:[^\]]*)?)\]/g)) {
    if (!seenLabels.has(m[1])) {
      seenLabels.add(m[1]);
      allLabels.push(m[1]);
    }
  }

  function splitSegments(text) {
    const segs = [];
    const re = /(\[[A-Z][A-Z\s]*(:[^\]]*)?])/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
      segs.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), bold: false });
    return segs;
  }

  function renderInlineSegments(segs, fontSize, indentX) {
    doc.setFontSize(fontSize);
    let cx = indentX;
    for (const seg of segs) {
      if (!seg.text) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      doc.text(seg.text, cx, y);
      cx += doc.getTextWidth(seg.text);
    }
    return fontSize * 0.45 + 1 + 2;
  }

  function checkPage(needed) {
    if (y + (needed || 8) > 277) { doc.addPage(); y = margin; }
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, margin, y);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    checkPage();
    if (line === '') { y += 4; continue; }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      const wrapped = doc.splitTextToSize(h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), maxWidth);
      checkPage(wrapped.length * 7 + 4);
      doc.text(wrapped, margin, y); y += wrapped.length * 7 + 4; continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      const wrapped = doc.splitTextToSize(h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase(), maxWidth);
      checkPage(wrapped.length * 6 + 4);
      doc.text(wrapped, margin, y); y += wrapped.length * 6 + 4; continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), maxWidth);
      checkPage(wrapped.length * 6 + 3);
      doc.text(wrapped, margin, y); y += wrapped.length * 6 + 3; continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      doc.setFontSize(10);
      const segs = splitSegments(listItem[1].replace(/\*\*/g, ''));
      checkPage(7);
      if (segs.some(s => s.bold)) {
        doc.setFont('helvetica', 'normal');
        doc.text('• ', margin + 5, y);
        const bw = doc.getTextWidth('• ');
        let cx = margin + 5 + bw;
        for (const seg of segs) {
          if (!seg.text) continue;
          doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
          doc.text(seg.text, cx, y); cx += doc.getTextWidth(seg.text);
        }
        y += 7;
      } else {
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize('• ' + segs.map(s => s.text).join('').trim(), maxWidth - 5);
        doc.text(wrapped, margin + 5, y); y += wrapped.length * 5 + 2;
      }
      continue;
    }
    doc.setFontSize(10);
    const segs = splitSegments(line.replace(/\*\*/g, ''));
    if (!segs.some(s => s.bold)) {
      const text = segs.map(s => s.text).join('').trim();
      if (!text) { y += 3; continue; }
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkPage(wrapped.length * 5 + 3);
      doc.text(wrapped, margin, y); y += wrapped.length * 5 + 3;
    } else {
      checkPage(7);
      y += renderInlineSegments(segs, 10, margin);
    }
  }

  // ── Openstaande punten ─────────────────────────────────────────────────
  if (allLabels.length > 0) {
    y += 10; checkPage(20);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y); y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Openstaande punten', margin, y); y += 8;
    allLabels.forEach((label, i) => {
      checkPage(8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(`${i + 1}. ${label}`, maxWidth);
      doc.text(wrapped, margin, y); y += wrapped.length * 5 + 3;
    });
  }

  // ── Extras (veldbriefing) ──────────────────────────────────────────────
  if (extras && (extras.photos?.length > 0 || extras.links?.length > 0)) {
    y += 10; checkPage(20);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y); y += 8;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Bijlagen', margin, y); y += 10;

    if (extras.photos?.length > 0) {
      for (const photo of extras.photos) {
        if (!photo.url) continue;
        try {
          const b64 = await fetchImageAsBase64(photo.url);
          if (b64 && !b64.startsWith('data:image/svg')) {
            const dims = await getImageDimensions(b64);
            const ph = 60; // mm
            const pw = Math.min((dims.w / dims.h) * ph, maxWidth);
            checkPage(ph + 8);
            doc.addImage(b64, getImageFormat(b64), margin, y, pw, ph);
            y += ph + 5;
            if (photo.name) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
              doc.setTextColor(150, 150, 150);
              doc.text(photo.name, margin, y); y += 6;
              doc.setTextColor(0, 0, 0);
            }
          }
        } catch { /* skip broken photo */ }
      }
    }

    if (extras.links?.length > 0) {
      checkPage(10);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Links', margin, y); y += 7;
      for (const link of extras.links) {
        if (!link.url) continue;
        checkPage(7);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
        doc.setTextColor(0, 87, 255);
        const label = link.label || link.url;
        const wrapped = doc.splitTextToSize(label, maxWidth);
        doc.text(wrapped, margin, y); y += wrapped.length * 5 + 2;
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
}

// ── Word export (legacy — vervangen door proxy hierboven) ─────────────────────

async function _unusedWordDoc(content, title, logos = {}, extras = null) {
  if (!content?.trim()) return;
  const docx = await import('docx');
  const paragraphs = [];

  // ── Logo header table ──────────────────────────────────────────────────
  if (logos.chaseBuffer || logos.clientBuffer) {
    const makeLogoCell = (buffer, align) => {
      const children = [];
      if (buffer) {
        try {
          children.push(new docx.ImageRun({
            data: buffer,
            transformation: { width: 120, height: 40 },
            type: 'png',
          }));
        } catch { /* skip */ }
      }
      return new docx.TableCell({
        width: { size: 50, type: docx.WidthType.PERCENTAGE },
        borders: {
          top: { style: docx.BorderStyle.NONE, size: 0 },
          bottom: { style: docx.BorderStyle.NONE, size: 0 },
          left: { style: docx.BorderStyle.NONE, size: 0 },
          right: { style: docx.BorderStyle.NONE, size: 0 },
        },
        children: [new docx.Paragraph({ alignment: align, children })],
      });
    };
    const logoTable = new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: {
        top: { style: docx.BorderStyle.NONE, size: 0 },
        bottom: { style: docx.BorderStyle.NONE, size: 0 },
        left: { style: docx.BorderStyle.NONE, size: 0 },
        right: { style: docx.BorderStyle.NONE, size: 0 },
        insideHorizontal: { style: docx.BorderStyle.NONE, size: 0 },
        insideVertical: { style: docx.BorderStyle.NONE, size: 0 },
      },
      rows: [new docx.TableRow({
        children: [
          makeLogoCell(logos.chaseBuffer, docx.AlignmentType.LEFT),
          makeLogoCell(logos.clientBuffer, docx.AlignmentType.RIGHT),
        ],
      })],
    });
    paragraphs.push(logoTable);
    paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 120 } }));
  }

  // ── Title ──────────────────────────────────────────────────────────────
  paragraphs.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: title, bold: true, size: 28 })],
    spacing: { after: 320 },
    border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
  }));

  let skipFirstH1 = true;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (line === '') { paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } })); continue; }
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstH1) { skipFirstH1 = false; continue; }
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h1[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim(), bold: true, size: 28 })],
        spacing: { before: 240, after: 200 },
        border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      })); continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h2[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim().toUpperCase(), bold: true, size: 22, color: '111111' })],
        spacing: { before: 360, after: 120 },
        border: { bottom: { color: 'EEEEEE', space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
      })); continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h3[1].replace(/\[([A-Z][A-Z\s]+)\]/g, '').trim(), bold: true, size: 20, color: '444444' })],
        spacing: { before: 200, after: 80 },
      })); continue;
    }
    const heading = line.match(/^\*\*(.+?)\*\*(.*)$/);
    if (heading) {
      const rest = heading[2].replace(/^[\s\-\u2013\u2014]+/, '');
      const labelText = heading[1].replace(/:$/, '');
      const runs = [new docx.TextRun({ text: labelText, bold: true, size: 22 })];
      if (rest) runs.push(new docx.TextRun({ text: ': ' + rest, size: 22 }));
      paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } })); continue;
    }
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: '• ', size: 20 }), ...parseInlineRuns(listItem[1], 20, docx)],
        indent: { left: 360 },
        spacing: { after: 80 },
      })); continue;
    }
    paragraphs.push(new docx.Paragraph({ children: parseInlineRuns(line, 20, docx), spacing: { after: 120 } }));
  }

  // ── Extras (veldbriefing) ──────────────────────────────────────────────
  if (extras && (extras.photos?.length > 0 || extras.links?.length > 0)) {
    paragraphs.push(new docx.Paragraph({
      children: [],
      border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      spacing: { before: 360, after: 240 },
    }));
    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Bijlagen', bold: true, size: 26 })],
      spacing: { after: 200 },
    }));

    if (extras.photos?.length > 0) {
      for (const photo of extras.photos) {
        if (!photo.url) continue;
        try {
          const buf = await fetchImageAsBuffer(photo.url);
          if (buf) {
            paragraphs.push(new docx.Paragraph({
              children: [new docx.ImageRun({
                data: buf,
                transformation: { width: 400, height: 267 },
                type: 'png',
              })],
              spacing: { after: 120 },
            }));
            if (photo.name) {
              paragraphs.push(new docx.Paragraph({
                children: [new docx.TextRun({ text: photo.name, size: 16, color: '888888' })],
                spacing: { after: 160 },
              }));
            }
          }
        } catch { /* skip */ }
      }
    }

    if (extras.links?.length > 0) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: 'Links', bold: true, size: 22 })],
        spacing: { before: 160, after: 120 },
      }));
      for (const link of extras.links) {
        if (!link.url) continue;
        const label = link.label || link.url;
        try {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.ExternalHyperlink({
              link: link.url,
              children: [new docx.TextRun({ text: label, style: 'Hyperlink', size: 20 })],
            })],
            spacing: { after: 80 },
          }));
        } catch {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: label + ' — ' + link.url, size: 20 })],
            spacing: { after: 80 },
          }));
        }
      }
    }
  }

  const wordDoc = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await docx.Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = title.toLowerCase().replace(/[\s/]+/g, '-') + '.docx'; a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentView({ content, onClose, onImprove, client = null, project = null, tenant = null, extras = null, outputType = null, outputTypeLabel = null, savedToken = null, messageId = null }) {
  const [localContent, setLocalContent] = useState(content);
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [freeEditParaIdx, setFreeEditParaIdx] = useState(null);
  const [freeEditValue, setFreeEditValue] = useState('');
  const [freeEditRect, setFreeEditRect] = useState(null);
  const [chatFile, setChatFile] = useState(null);
  const [contentHistory, setContentHistory] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [applying, setApplying] = useState(false);
  const chatInputRef = useRef(null);
  const docBodyRef = useRef(null);
  const fileInputRef = useRef(null);
  const onTranscriptRef = useRef((text) => setChatInput(prev => prev ? prev + ' ' + text : text));

  const { transcribing, recording, toggleRecording } = useAudioTranscription({
    onTranscript: (text) => onTranscriptRef.current(text),
    onStatus: () => {},
    onError: () => {},
  });

  const title = extractTitle(localContent);
  const markeringen = parseMarkeringen(localContent);
  const bodyHtml = annotateParaIdx(injectLabelHtml(md.parse(localContent)));

  const chaseLogoUrl = tenant?.logo_url ?? null;

  // Resolve client logo URL: try PNG first, then SVG
  const [clientLogoUrl, setClientLogoUrl] = useState(null);
  useEffect(() => {
    if (!client || !process.env.NEXT_PUBLIC_SUPABASE_URL) { setClientLogoUrl(null); return; }
    const slug = client.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}`;
    const img = new Image();
    img.onload = () => setClientLogoUrl(base + '.png');
    img.onerror = () => {
      const svg = new Image();
      svg.onload = () => setClientLogoUrl(base + '.svg');
      svg.onerror = () => setClientLogoUrl(null);
      svg.src = base + '.svg';
    };
    img.src = base + '.png';
  }, [client]);

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
    console.log('[DEBUG DOWNLOAD] Word DocumentView', { client, project, outputType, title });
    setDownloading(true);
    try {
      const [chaseBuffer, clientBuffer] = await Promise.all([
        fetchImageAsBuffer(chaseLogoUrl),
        fetchLogoBuffer(clientLogoUrl),
      ]);
      const filename = buildFilename(outputType, client, project, 'docx');
      await downloadWordDoc(localContent, title, { chaseBuffer, clientBuffer }, extras, filename, outputType, client, project);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPdf() {
    console.log('[DEBUG DOWNLOAD] PDF DocumentView', { client, project, outputType, title, clientLogoUrl });
    setDownloadingPdf(true);
    try {
      const [chaseBase64, clientBase64] = await Promise.all([
        fetchImageAsBase64(chaseLogoUrl),
        fetchLogoBase64(clientLogoUrl),
      ]);
      const filename = buildFilename(outputType, client, project, 'pdf');
      await downloadPdfDoc(localContent, title, { chaseBase64, clientBase64 }, extras, filename, outputType, client, project);
    } finally {
      setDownloadingPdf(false);
    }
  }

  function buildShareContent() {
    let c = localContent;
    if (extras?.photos?.length > 0 || extras?.links?.length > 0) {
      c += '\n\n---\n\n## Bijlagen\n\n';
      if (extras.photos?.length > 0) {
        for (const photo of extras.photos) {
          c += `![${photo.name || 'foto'}](${photo.url})\n\n`;
        }
      }
      if (extras.links?.length > 0) {
        for (const link of extras.links) {
          c += `[${link.label || link.url}](${link.url})\n\n`;
        }
      }
    }
    return c;
  }

  async function handleShare() {
    setSharing(true);
    try {
      const shareContent = buildShareContent();
      const res = await fetch('/api/share-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: shareContent, outputType, title, client }),
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

  function pushHistory(current) {
    setContentHistory(prev => [...prev.slice(-9), current]);
  }

  function handleUndo() {
    if (contentHistory.length === 0) return;
    const previous = contentHistory[contentHistory.length - 1];
    setContentHistory(prev => prev.slice(0, -1));
    setLocalContent(previous);
    persistContent(previous);
  }

  function handleFreeEditSave() {
    if (freeEditParaIdx === null) return;
    const rawParas = localContent.split(/\n\n+/);
    const trimmed = freeEditValue.trim();
    if (!trimmed || trimmed === rawParas[freeEditParaIdx]?.trim()) {
      setFreeEditParaIdx(null);
      setFreeEditValue('');
      setFreeEditRect(null);
      return;
    }
    pushHistory(localContent);
    const newParas = [...rawParas];
    newParas[freeEditParaIdx] = freeEditValue;
    const newContent = newParas.join('\n\n');
    setLocalContent(newContent);
    persistContent(newContent);
    setFreeEditParaIdx(null);
    setFreeEditValue('');
    setFreeEditRect(null);
  }

  function handleFileAttach(file) {
    if (!file) return;
    const isText = file.type.startsWith('text/') || ['application/json', 'application/csv'].includes(file.type) || /\.(txt|md|csv|json)$/i.test(file.name);
    if (!isText) return;
    const reader = new FileReader();
    reader.onload = (e) => setChatFile({ name: file.name, content: e.target.result });
    reader.readAsText(file);
  }

  async function handleFreeTextApply(text) {
    const trimmed = text.trim();
    if (!trimmed || applying) return;
    setApplying(true);
    try {
      const res = await fetch('/api/apply-to-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          freeText: trimmed,
          fullDocument: localContent,
          outputType,
          markings: parseMarkeringen(localContent),
          fileContent: chatFile?.content ?? null,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.updates) && data.updates.length > 0) {
        setLocalContent(prev => {
          pushHistory(prev);
          let updated = prev;
          for (const u of data.updates) {
            if (u.original && u.updated && updated.includes(u.original)) {
              updated = updated.replace(u.original, u.updated);
            }
          }
          persistContent(updated);
          return updated;
        });
        setChatFile(null);
      }
    } catch {
      // stil falen — document ongewijzigd
    } finally {
      setApplying(false);
    }
  }

  function persistContent(newContent) {
    if (savedToken) {
      fetch(`/api/share-document?token=${savedToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      }).catch(() => {});
    }
    if (messageId) {
      fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      }).catch(() => {});
    }
  }

  async function handleSaveEdit(label, idx) {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditingIdx(null);
      return;
    }

    setRewriting(true);
    let success = false;

    try {
      const para = extractParagraph(localContent, idx);
      if (para) {
        const res = await fetch('/api/rewrite-marker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paragraph: para.text, label, value: trimmed, outputType, fullDocument: localContent }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.rewritten) {
            pushHistory(localContent);
            setLocalContent(prev => {
              const freshPara = extractParagraph(prev, idx);
              let newContent = freshPara
                ? prev.slice(0, freshPara.start) + data.rewritten + prev.slice(freshPara.end)
                : replaceOccurrence(prev, LABEL_REGEX, idx, trimmed);
              // Propageer aanverwante secties atomair
              if (Array.isArray(data.otherUpdates)) {
                for (const u of data.otherUpdates) {
                  if (u.original && u.updated && newContent.includes(u.original)) {
                    newContent = newContent.replace(u.original, u.updated);
                  }
                }
              }
              persistContent(newContent);
              return newContent;
            });
            success = true;
          }
        }
      }
    } catch (e) {
      console.error('[rewrite-marker]', e);
    } finally {
      setRewriting(false);
    }

    if (!success) {
      // Fallback: gewone token-replace
      pushHistory(localContent);
      setLocalContent(prev => {
        const newContent = replaceOccurrence(prev, LABEL_REGEX, idx, trimmed);
        persistContent(newContent);
        return newContent;
      });
    }

    setEditingIdx(null);
    setEditValue('');
  }

  function handleConfirm(idx) {
    setLocalContent(prev => replaceOccurrence(prev, LABEL_REGEX, idx, ''));
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
            onClick={handleUndo}
            disabled={contentHistory.length === 0}
            title="Ongedaan maken"
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3 h-3" strokeWidth={2} />
            Ongedaan
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
              setEditingIdx(idx);
              setEditValue('');
              onTranscriptRef.current = (text) => setEditValue(prev => prev ? prev + ' ' + text : text);
            }}
            onDoubleClick={(e) => {
              if (e.target.closest('[data-marker-idx]')) return;
              const block = e.target.closest('[data-para-idx]');
              if (!block) return;
              const paraIdx = parseInt(block.getAttribute('data-para-idx'), 10);
              const rawParas = localContent.split(/\n\n+/);
              if (paraIdx >= rawParas.length) return;
              setFreeEditParaIdx(paraIdx);
              setFreeEditValue(rawParas[paraIdx]);
              setFreeEditRect(block.getBoundingClientRect());
            }}
          />

          {/* Extras section (veldbriefing bijlagen) */}
          {extras && (extras.photos?.length > 0 || extras.links?.length > 0) && (
            <div className="max-w-2xl mx-auto mt-8 pt-6 border-t border-white/[0.08]">
              <h2 className="font-[family-name:var(--font-lexend)] text-[11px] font-bold tracking-[0.1em] uppercase text-white/30 mb-4">
                Bijlagen
              </h2>
              {extras.photos?.length > 0 && (
                <div className={`grid gap-2 mb-6 ${
                  extras.photos.length === 1 ? 'grid-cols-1' :
                  extras.photos.length <= 3 ? 'grid-cols-2' : 'grid-cols-3'
                }`}>
                  {extras.photos.map((photo, i) => (
                    <img
                      key={i}
                      src={photo.url}
                      alt={photo.name || `Foto ${i + 1}`}
                      className="rounded-lg object-cover w-full aspect-video"
                    />
                  ))}
                </div>
              )}
              {extras.links?.length > 0 && (
                <ul className="space-y-2">
                  {extras.links.map((link, i) => (
                    <li key={i}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-orange hover:text-orange/80 transition-colors"
                      >
                        {link.label || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Vrij bewerken overlay (dubbelklik op tekst) */}
        {freeEditParaIdx !== null && freeEditRect && (
          <>
            <div
              className="fixed inset-0 z-[98]"
              onClick={() => { setFreeEditParaIdx(null); setFreeEditValue(''); setFreeEditRect(null); }}
            />
            <textarea
              autoFocus
              value={freeEditValue}
              onChange={e => setFreeEditValue(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'Enter' && e.metaKey) || (e.key === 'Enter' && e.ctrlKey)) {
                  e.preventDefault();
                  handleFreeEditSave();
                }
                if (e.key === 'Escape') { setFreeEditParaIdx(null); setFreeEditValue(''); setFreeEditRect(null); }
              }}
              style={{
                position: 'fixed',
                top: freeEditRect.top,
                left: freeEditRect.left,
                width: freeEditRect.width,
                minHeight: Math.max(freeEditRect.height + 16, 48),
                zIndex: 99,
              }}
              className="bg-[#0d0d0d]/95 border border-orange/50 rounded-md px-3 py-2 text-[13px] text-white/90 resize-y outline-none leading-relaxed"
              title="Cmd+Enter om op te slaan, Escape om te annuleren"
            />
          </>
        )}

        <aside className="hidden md:flex w-[360px] shrink-0 flex-col border-l border-white/[0.06]">
            {/* Bovenste sectie: edit-mode of teller */}
            {editingIdx !== null ? (
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingIdx(null);
                      setEditValue('');
                      onTranscriptRef.current = (text) => setChatInput(prev => prev ? prev + ' ' + text : text);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <p className="text-[10px] text-white/35 uppercase font-bold tracking-wider truncate flex-1">
                    {markeringen[editingIdx]}
                  </p>
                </div>
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  disabled={rewriting}
                  placeholder="Typ de aanvullende informatie..."
                  rows={5}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (editValue.trim() && !rewriting) handleSaveEdit(markeringen[editingIdx], editingIdx);
                    }
                    if (e.key === 'Escape') {
                      setEditingIdx(null);
                      setEditValue('');
                      onTranscriptRef.current = (text) => setChatInput(prev => prev ? prev + ' ' + text : text);
                    }
                  }}
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg px-3 py-2.5 text-[12px] text-white placeholder-white/25 resize-none outline-none leading-relaxed focus:border-white/[0.25] transition-colors disabled:opacity-50"
                />
                {rewriting ? (
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-orange rounded-full animate-spin shrink-0" />
                    <span className="text-[11px] text-white/40">Herschrijven...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onTranscriptRef.current = (text) => setEditValue(prev => prev ? prev + ' ' + text : text);
                        toggleRecording();
                      }}
                      disabled={transcribing}
                      title={recording ? 'Stop dicteren' : 'Dicteren'}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 shrink-0 ${
                        recording ? 'text-red-400 bg-red-950/30' : 'text-white/30 hover:text-white/70 hover:bg-white/[0.06] border border-white/[0.08]'
                      }`}
                    >
                      {recording ? <Square className="w-3 h-3" strokeWidth={2} /> : <Mic className="w-3.5 h-3.5" strokeWidth={1.75} />}
                    </button>
                    <button
                      onClick={() => handleSaveEdit(markeringen[editingIdx], editingIdx)}
                      disabled={!editValue.trim()}
                      className="flex-1 h-8 rounded-lg bg-orange text-white text-[12px] font-semibold hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Opslaan
                    </button>
                    <button
                      onClick={() => {
                        setEditingIdx(null);
                        setEditValue('');
                        onTranscriptRef.current = (text) => setChatInput(prev => prev ? prev + ' ' + text : text);
                      }}
                      className="h-8 px-3 rounded-lg text-[12px] text-white/40 hover:text-white border border-white/[0.08] hover:bg-white/[0.06] transition-colors"
                    >
                      Annuleer
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
                  {markeringen.length === 0 ? (
                    <p className="font-[family-name:var(--font-lexend)] text-[13px] font-semibold text-white/40 italic">Alle punten afgehandeld</p>
                  ) : (
                    <p className="font-[family-name:var(--font-lexend)] text-[13px] font-semibold text-white/80">
                      <span className="text-orange">{markeringen.length}</span> {markeringen.length === 1 ? 'markering open' : 'markeringen open'}
                    </p>
                  )}
                  <p className="text-[11px] text-white/30 mt-1.5 leading-relaxed">
                    Klik op een markering om aan te vullen. Dubbelklik op tekst om vrij te bewerken.
                  </p>
                </div>
                <div className="flex-1" />
              </div>
            )}

            {/* Bestandsbijlage chip */}
            {chatFile && (
              <div className="px-3 pt-2 shrink-0">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.10]">
                  <Paperclip className="w-3 h-3 text-white/40 shrink-0" strokeWidth={2} />
                  <span className="text-[11px] text-white/60 truncate flex-1">{chatFile.name}</span>
                  <button
                    onClick={() => setChatFile(null)}
                    className="w-4 h-4 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json"
              className="hidden"
              onChange={e => { handleFileAttach(e.target.files?.[0]); e.target.value = ''; }}
            />

            {/* Mini chat-input */}
            <div
              className="px-3 py-3 border-t border-white/[0.06] shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileAttach(e.dataTransfer.files?.[0]); }}
            >
              <div className={`flex items-end gap-1.5 rounded-xl px-3 py-2 border transition-colors ${
                applying ? 'border-orange/30 bg-orange/[0.03]' : 'border-white/[0.10] bg-white/[0.03] focus-within:border-white/[0.20]'
              }`}>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if ((chatInput.trim() || chatFile) && !applying && !transcribing) {
                        handleFreeTextApply(chatInput);
                        setChatInput('');
                      }
                    }
                  }}
                  disabled={applying || transcribing}
                  placeholder={transcribing ? 'Transcriberen...' : recording ? 'Aan het dicteren...' : 'Vul aan: "Het hotlinenummer is..."'}
                  rows={2}
                  className="flex-1 bg-transparent text-[12px] text-white placeholder-white/20 resize-none outline-none leading-relaxed"
                />
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={applying}
                    title="Bestand bijvoegen"
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
                      chatFile ? 'text-orange' : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
                    }`}
                  >
                    <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => {
                      onTranscriptRef.current = (text) => setChatInput(prev => prev ? prev + ' ' + text : text);
                      toggleRecording();
                    }}
                    disabled={applying || transcribing}
                    title={recording ? 'Stop dicteren' : 'Dicteren'}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-30 ${
                      recording ? 'text-red-400 bg-red-950/30' : 'text-white/25 hover:text-white/60 hover:bg-white/[0.06]'
                    }`}
                  >
                    {recording ? <Square className="w-3 h-3" strokeWidth={2} /> : <Mic className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  </button>
                  <button
                    onClick={() => {
                      if ((chatInput.trim() || chatFile) && !applying && !transcribing) {
                        handleFreeTextApply(chatInput);
                        setChatInput('');
                      }
                    }}
                    disabled={(!chatInput.trim() && !chatFile) || applying || transcribing}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange text-white hover:bg-[#e03d00] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {applying
                      ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Verbeteren knop */}
            <div className="px-4 pb-4 shrink-0">
              <button
                onClick={() => onImprove?.({ prefillText: 'Ik wil dit document verbeteren. Aanvullende informatie: ', isImprove: true })}
                className="w-full h-9 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-[12px] text-white/60 hover:text-white transition-colors"
              >
                Verbeteren met info
              </button>
            </div>
          </aside>
      </div>
    </div>
  );
}
