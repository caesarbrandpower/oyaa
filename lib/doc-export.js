// lib/doc-export.js
// Gedeelde export-functies voor Word en PDF downloads

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]*(?::[^\]]*)?])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]*(?::[^\]]*)?)\]$/);
    if (lm) {
      return [new docx.TextRun({ text: `[${lm[1]}]`, bold: true, size })];
    }
    return [new docx.TextRun({ text: p.replace(/\*/g, ''), size })];
  });
}

export async function downloadPdfDoc(content, title) {
  if (!content?.trim()) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

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

  doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
}

export async function downloadWordDoc(content, title) {
  if (!content?.trim()) return;
  const docx = await import('docx');
  const paragraphs = [];

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

  const wordDoc = new docx.Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await docx.Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = title.toLowerCase().replace(/[\s/]+/g, '-') + '.docx'; a.click();
  URL.revokeObjectURL(url);
}

export async function shareDocument(content, title) {
  const res = await fetch('/api/share-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, outputType: null, title }),
  });
  const data = await res.json();
  return data.token ? `${window.location.origin}/doc/${data.token}` : null;
}
