// lib/doc-export.js
// Gedeelde export-functies voor Word en PDF downloads

// ── Image helpers ─────────────────────────────────────────────────────────────

export async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function fetchImageAsBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

async function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 120, h: 40 });
    img.src = dataUrl;
  });
}

function getImageFormat(dataUrl) {
  if (!dataUrl) return 'PNG';
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
  return 'PNG';
}

// ── Filename builder ──────────────────────────────────────────────────────────

function toFilePart(str) {
  return str
    .replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '')
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

export function buildFilename(outputTypeLabel, client, docTitle, extension) {
  const parts = [outputTypeLabel, client, docTitle].filter(Boolean).map(toFilePart);
  const name = parts.join('-').replace(/-+/g, '-').slice(0, 60);
  return (name || 'document') + '.' + extension;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

// Show only the keyword (before colon) in document body — full text stays in sidebar only
function labelKeyword(label) {
  return label.split(':')[0].trim();
}

// ── Inline runs helper for Word export ────────────────────────────────────────

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]*(?::[^\]]*)?])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]*(?::[^\]]*)?)\]$/);
    if (lm) {
      return [new docx.TextRun({ text: `[${labelKeyword(lm[1])}]`, bold: true, size })];
    }
    return [new docx.TextRun({ text: p.replace(/\*/g, ''), size })];
  });
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function downloadPdfDoc(content, title, logos = {}, extras = null, filename = null) {
  if (!content?.trim()) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const LOGO_H = 10;
  let y = margin;

  // ── Logo header ──────────────────────────────────────────────────────────
  if (logos.chaseBase64 || logos.clientBase64) {
    doc.setFillColor(248, 248, 247);
    doc.rect(0, 0, pageWidth, LOGO_H + 8, 'F');
    if (logos.chaseBase64) {
      try {
        const dims = await getImageDimensions(logos.chaseBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 60);
        doc.addImage(logos.chaseBase64, getImageFormat(logos.chaseBase64), margin, 4, w, LOGO_H);
      } catch { /* skip SVG or unsupported */ }
    }
    if (logos.clientBase64) {
      try {
        const dims = await getImageDimensions(logos.clientBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 60);
        doc.addImage(logos.clientBase64, getImageFormat(logos.clientBase64), pageWidth - margin - w, 4, w, LOGO_H);
      } catch { /* skip */ }
    }
    y = LOGO_H + 14;
  }

  function splitSegments(text) {
    const segs = [];
    const re = /(\[[A-Z][A-Z\s]*(:[^\]]*)?])/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
      segs.push({ text: `[${labelKeyword(m[1].slice(1, -1))}]`, bold: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), bold: false });
    return segs;
  }

  function renderInlineSegments(segs, fontSize, indentX) {
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.45 + 1 + 2;
    let cx = indentX;
    for (const seg of segs) {
      if (!seg.text) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      const sw = doc.getTextWidth(seg.text);
      if (cx + sw > pageWidth - margin + 1) {
        y += lineH;
        checkPage(lineH);
        cx = indentX;
        const wrapped = doc.splitTextToSize(seg.text, maxWidth);
        for (let i = 0; i < wrapped.length; i++) {
          if (i > 0) { y += lineH; checkPage(lineH); cx = indentX; }
          doc.text(wrapped[i], cx, y);
          cx += doc.getTextWidth(wrapped[i]);
        }
      } else {
        doc.text(seg.text, cx, y);
        cx += sw;
      }
    }
    return lineH;
  }

  function checkPage(needed) {
    if (y + (needed || 8) > 277) { doc.addPage(); y = margin; }
  }

  // ── Title (once only) ───────────────────────────────────────────────────
  const cleanTitle = title.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const wrappedTitle = doc.splitTextToSize(cleanTitle, maxWidth);
  checkPage(wrappedTitle.length * 8 + 10);
  doc.text(wrappedTitle, margin, y);
  y += wrappedTitle.length * 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Skip the first H1 heading (same text as title) to avoid duplication
  let skipFirstH1 = true;

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    checkPage();
    if (line === '') { y += 4; continue; }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstH1) { skipFirstH1 = false; continue; }
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
        checkPage(wrapped.length * 5 + 2);
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

  // ── Bijlagen (extras) ───────────────────────────────────────────────────
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
            const ph = 60;
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
        const lbl = link.label || link.url;
        const wrapped = doc.splitTextToSize(lbl, maxWidth);
        doc.text(wrapped, margin, y); y += wrapped.length * 5 + 2;
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  doc.save(filename || toFilePart(cleanTitle) + '.pdf');
}

// ── Word export ────────────────────────────────────────────────────────────────

export async function downloadWordDoc(content, title, logos = {}, extras = null, filename = null) {
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
  const cleanTitle = title.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();
  paragraphs.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: cleanTitle, bold: true, size: 28 })],
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
        children: [new docx.TextRun({ text: h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 28 })],
        spacing: { before: 240, after: 200 },
        border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      })); continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase(), bold: true, size: 22, color: '111111' })],
        spacing: { before: 360, after: 120 },
        border: { bottom: { color: 'EEEEEE', space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
      })); continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 20, color: '444444' })],
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

  // ── Bijlagen (extras) ───────────────────────────────────────────────────
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
              children: [new docx.ImageRun({ data: buf, transformation: { width: 400, height: 267 }, type: 'png' })],
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
        const lbl = link.label || link.url;
        try {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.ExternalHyperlink({ link: link.url, children: [new docx.TextRun({ text: lbl, style: 'Hyperlink', size: 20 })] })],
            spacing: { after: 80 },
          }));
        } catch {
          paragraphs.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: lbl + ' — ' + link.url, size: 20 })],
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
  a.href = url;
  a.download = filename || toFilePart(cleanTitle) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Share document ─────────────────────────────────────────────────────────────

export async function shareDocument(content, title, client = null) {
  const res = await fetch('/api/share-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, outputType: null, title, client }),
  });
  const data = await res.json();
  return data.token ? `${window.location.origin}/doc/${data.token}` : null;
}
