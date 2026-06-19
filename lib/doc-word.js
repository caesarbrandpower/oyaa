// lib/doc-word.js
// Server-safe Word document builder — gebruikt voor Drive uploads.
// Geen browser-API's (geen canvas, geen DOM, geen FileReader).

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  BorderStyle, ShadingType, WidthType,
} from 'docx';

function labelKeyword(label) {
  return label.split(':')[0].trim();
}

function parseInlineRuns(text, size) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]*(?::[^\]]*)?])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new TextRun({ text: p.slice(2, -2), bold: true, size, font: 'Arial' })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]*(?::[^\]]*)?)\]$/);
    if (lm) {
      return [new TextRun({ text: `[${labelKeyword(lm[1])}]`, bold: true, size, font: 'Arial', color: 'CC0000' })];
    }
    return [new TextRun({ text: p.replace(/\*/g, ''), size, font: 'Arial' })];
  });
}

export async function buildWordBuffer(content, { outputType = null, clientName = null, project = null, typeLabel = null } = {}) {
  if (!content?.trim()) return null;

  const paragraphs = [];

  // ── Zwarte header balk met witte tekst (vervangt canvas-gerenderd PNG) ────
  const docTypeLabel = typeLabel ?? null;
  const headerText = [docTypeLabel, clientName].filter(Boolean).join('  —  ');
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };

  // columnWidths MOET meegegeven worden — zonder dit gebruikt docx default 100 DXA
  // per kolom, wat conflicteert met de cel-breedtes en de tabel kapot maakt.
  paragraphs.push(new Table({
    columnWidths: [9100],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9100, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({
            text: headerText || ' ',
            bold: true,
            color: 'FFFFFF',
            size: 22,
            font: 'Arial',
          })],
          spacing: { before: 200, after: 200 },
          indent: { left: 400 },
        })],
        shading: { fill: '111111', type: ShadingType.CLEAR, color: 'auto' },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      })],
    })],
    width: { size: 9100, type: WidthType.DXA },
    borders: {
      top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
  }));

  // ── Titel en client/project (zelfde layout als browser Word export) ────────
  const wordMainTitle = docTypeLabel || '';
  const wordCpLabel = [clientName, project].filter(Boolean).join(' ');

  paragraphs.push(new Paragraph({
    children: [new TextRun({ text: wordMainTitle, bold: true, size: 32, font: 'Arial' })],
    spacing: { after: wordCpLabel ? 80 : 320 },
    border: wordCpLabel ? undefined : { bottom: { color: 'DDDDDD', space: 1, style: BorderStyle.SINGLE, size: 6 } },
  }));

  if (wordCpLabel) {
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: wordCpLabel, size: 22, font: 'Arial', color: '666666' })],
      spacing: { after: 320 },
      border: { bottom: { color: 'DDDDDD', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    }));
  }

  // ── Body content parser (zelfde logica als downloadWordDoc) ──────────────
  let skipFirstHeading = true;
  const titleNorm = wordMainTitle.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);

  let pendingTableRows = [];

  function flushWordTable() {
    if (!pendingTableRows.length) return;
    const maxCols = Math.max(...pendingTableRows.map(r => r.length));
    if (maxCols === 0) { pendingTableRows = []; return; }
    const colWidth = Math.floor(9000 / maxCols);
    const borderStyle = { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
    paragraphs.push(new Table({
      columnWidths: Array(maxCols).fill(colWidth),
      rows: pendingTableRows.map((cells, rowIdx) => new TableRow({
        children: Array.from({ length: maxCols }, (_, i) => {
          const cellText = cells[i] ?? '';
          const isHeaderRow = rowIdx === 0;
          return new TableCell({
            width: { size: colWidth, type: WidthType.DXA },
            children: [new Paragraph({
              children: parseInlineRuns(cellText, 18),
              spacing: { before: 60, after: 60 },
            })],
            shading: isHeaderRow ? { fill: 'F5F5F5', type: ShadingType.CLEAR, color: 'auto' } : undefined,
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
          });
        }),
      })),
      borders: {
        top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle,
        insideHorizontal: borderStyle, insideVertical: borderStyle,
      },
      width: { size: 9000, type: WidthType.DXA },
    }));
    paragraphs.push(new Paragraph({ children: [], spacing: { after: 120 } }));
    pendingTableRows = [];
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (pendingTableRows.length > 0 && !(line.startsWith('|') && line.endsWith('|'))) {
      flushWordTable();
    }
    if (line === '') { paragraphs.push(new Paragraph({ text: '', spacing: { after: 60 } })); continue; }
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) continue;

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstHeading) { skipFirstHeading = false; continue; }
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 28, font: 'Arial' })],
        spacing: { before: 240, after: 200 },
        border: { bottom: { color: 'DDDDDD', space: 1, style: BorderStyle.SINGLE, size: 6 } },
      })); continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      skipFirstHeading = false;
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase(), bold: true, size: 22, color: '111111', font: 'Arial' })],
        spacing: { before: 360, after: 120 },
        border: { bottom: { color: 'EEEEEE', space: 1, style: BorderStyle.SINGLE, size: 4 } },
      })); continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      skipFirstHeading = false;
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 20, color: '444444', font: 'Arial' })],
        spacing: { before: 200, after: 80 },
      })); continue;
    }
    const boldSection = line.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (boldSection) {
      const boldText = boldSection[1].replace(/:$/, '').trim();
      if (skipFirstHeading) {
        const boldNorm = boldText.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
        const rest2 = boldSection[2].replace(/^[\s\-–—:]+/, '').trim();
        if (boldNorm === titleNorm || !rest2) { skipFirstHeading = false; continue; }
      }
      skipFirstHeading = false;
      const rest = boldSection[2].replace(/^[\s\-–—:]+/, '');
      const runs = [new TextRun({ text: boldText, bold: true, size: 22, font: 'Arial' })];
      if (rest) runs.push(...parseInlineRuns(': ' + rest, 22));
      paragraphs.push(new Paragraph({ children: runs, spacing: { before: 200, after: 80 } })); continue;
    }
    skipFirstHeading = false;
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '• ', size: 20, font: 'Arial' }), ...parseInlineRuns(listItem[1], 20)],
        indent: { left: 360 },
        spacing: { after: 80 },
      })); continue;
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim()).filter(c => !c.match(/^[-:]+$/));
      if (cells.length > 0) pendingTableRows.push(cells);
      continue;
    }
    paragraphs.push(new Paragraph({ children: parseInlineRuns(line, 20), spacing: { after: 120 } }));
  }
  flushWordTable();

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  return Packer.toBuffer(doc);
}
