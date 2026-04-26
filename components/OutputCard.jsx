'use client';

import { useState } from 'react';
import { marked } from 'marked';
import { OUTPUT_TITLES } from '@/lib/prompts';

marked.setOptions({ gfm: true, breaks: true });

const LABEL_REGEX = /\[([A-Z][A-Z\s?]+)\]/g;

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function injectLabelHtml(text) {
  return text.replace(LABEL_REGEX, (_, label) => {
    if (isRedLabel(label)) {
      return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#CC2200;color:#fff;margin-right:4px;font-family:var(--font-outfit)">${label}</span>`;
    }
    return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#F59E0B;color:#7C4A00;margin-right:4px;font-family:var(--font-outfit)">${label}</span>`;
  });
}

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s?]+\])/);
  return parts
    .filter((p) => p.length > 0)
    .flatMap((p) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size })];
      }
      const labelMatch = p.match(/^\[([A-Z][A-Z\s?]+)\]$/);
      if (labelMatch) {
        const label = labelMatch[1];
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

export default function OutputCard({ output, transcript, onReset, recordingDuration }) {
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const title = OUTPUT_TITLES[output.output_type] || 'Output';
  const result = output.result;
  const date = output.created_at
    ? new Date(output.created_at).toLocaleDateString('nl-NL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const durationLabel = recordingDuration > 0
    ? (() => {
        const m = Math.floor(recordingDuration / 60);
        const s = recordingDuration % 60;
        return m > 0 ? `${m} min ${s > 0 ? s + ' sec' : ''}opgenomen`.trim() : `${s} sec opgenomen`;
      })()
    : null;

  function copyOutput() {
    navigator.clipboard.writeText(result).then(() => {
      setCopyLabel('Gekopieerd');
      setTimeout(() => setCopyLabel('Kopiëren'), 2200);
    });
  }

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 20;
    const pageWidth = 210;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const addPage = () => { doc.addPage(); y = 20; };
    const checkY = (needed) => { if (y + needed > 280) addPage(); };

    function safeWrap(text, width) {
      return doc.splitTextToSize(text, width);
    }

    function drawLabel(label, x, currentY) {
      const red = isRedLabel(label);
      const pad = 3;
      doc.setFontSize(8.5);
      const labelWidth = doc.getTextWidth(` ${label} `) + pad * 2;
      if (red) {
        doc.setFillColor(204, 34, 0);
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(245, 158, 11);
        doc.setTextColor(124, 74, 0);
      }
      doc.roundedRect(x, currentY - 4, labelWidth, 5.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text(` ${label} `, x + pad, currentY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      return labelWidth + 2;
    }

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, margin, y);
    y += 10;

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') { y += 3; continue; }

      // H1: # Title
      const h1Match = line.match(/^#\s+(.+)$/);
      if (h1Match) {
        const text = h1Match[1].replace(LABEL_REGEX, '').trim();
        checkY(10); y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        const wrapped = safeWrap(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 6.5 + 2;
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, margin + maxWidth, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        continue;
      }

      // H2: ## Section
      const h2Match = line.match(/^##\s+(.+)$/);
      if (h2Match) {
        const text = h2Match[1].replace(LABEL_REGEX, '').trim();
        checkY(10); y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const wrapped = safeWrap(text.toUpperCase(), maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5.5 + 1;
        doc.setLineWidth(0.2);
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, margin + maxWidth, y);
        y += 3;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        continue;
      }

      // H3: ### Subheading
      const h3Match = line.match(/^###\s+(.+)$/);
      if (h3Match) {
        const text = h3Match[1].replace(LABEL_REGEX, '').trim();
        checkY(8); y += 3;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const wrapped = safeWrap(text, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5 + 1;
        doc.setFont('helvetica', 'normal');
        continue;
      }

      // **Bold** heading (legacy support)
      const boldMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (boldMatch) {
        const boldPart = boldMatch[1];
        const restPart = boldMatch[2].replace(/^[\s\-\u2013\u2014]+/, '');
        checkY(8); y += 2;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const combined = boldPart + (restPart ? ': ' + restPart : '');
        const wrapped = safeWrap(combined, maxWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 5.5;
        doc.setFont('helvetica', 'normal');
        continue;
      }

      // List item
      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const itemText = listMatch[1];
        const labelMatches = [...itemText.matchAll(new RegExp(LABEL_REGEX.source, 'g'))];
        const cleanText = itemText.replace(LABEL_REGEX, '').trim();
        const wrapped = safeWrap('• ' + cleanText, maxWidth - 4);
        checkY(wrapped.length * 5 + (labelMatches.length > 0 ? 7 : 0));

        if (labelMatches.length > 0) {
          let lx = margin + 4;
          for (const lm of labelMatches) {
            checkY(8);
            lx += drawLabel(lm[1], lx, y);
          }
          y += 6;
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(wrapped, margin + 4, y);
        y += wrapped.length * 5;
        continue;
      }

      // Regular text — check for labels
      const labelMatches = [...line.matchAll(new RegExp(LABEL_REGEX.source, 'g'))];
      const cleanText = line.replace(LABEL_REGEX, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();

      if (labelMatches.length > 0) {
        checkY(14);
        let lx = margin;
        for (const lm of labelMatches) {
          lx += drawLabel(lm[1], lx, y);
        }
        y += 6;
        if (cleanText) {
          const wrapped = safeWrap(cleanText, maxWidth);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          checkY(wrapped.length * 5);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 5;
        }
        continue;
      }

      // Plain text
      if (!cleanText) continue;
      const wrapped = safeWrap(cleanText, maxWidth);
      checkY(wrapped.length * 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5;
    }

    doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
  }

  async function downloadWord() {
    const docx = await import('docx');
    const paragraphs = [];

    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: title, bold: true, size: 28 })],
      spacing: { after: 320 },
      border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
    }));

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') {
        paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } }));
        continue;
      }

      // H1: # Title
      const h1Match = line.match(/^#\s+(.+)$/);
      if (h1Match) {
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: h1Match[1].replace(LABEL_REGEX, '').trim(), bold: true, size: 28 })],
          spacing: { before: 240, after: 200 },
          border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
        }));
        continue;
      }

      // H2: ## Section
      const h2Match = line.match(/^##\s+(.+)$/);
      if (h2Match) {
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: h2Match[1].replace(LABEL_REGEX, '').trim().toUpperCase(), bold: true, size: 22, color: '111111' })],
          spacing: { before: 360, after: 120 },
          border: { bottom: { color: 'EEEEEE', space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
        }));
        continue;
      }

      // H3: ### Subheading
      const h3Match = line.match(/^###\s+(.+)$/);
      if (h3Match) {
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: h3Match[1].replace(LABEL_REGEX, '').trim(), bold: true, size: 20, color: '444444' })],
          spacing: { before: 200, after: 80 },
        }));
        continue;
      }

      // **Bold** heading (legacy)
      const headingMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (headingMatch) {
        const boldText = headingMatch[1];
        const rest = headingMatch[2].replace(/^[\s\-\u2013\u2014]+/, '');
        const runs = [new docx.TextRun({ text: boldText, bold: true, size: 22 })];
        if (rest) runs.push(new docx.TextRun({ text: ': ' + rest, size: 22 }));
        paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } }));
        continue;
      }

      // List item
      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const runs = parseInlineRuns(listMatch[1], 20, docx);
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: '• ', size: 20 }), ...runs],
          indent: { left: 360 },
          spacing: { after: 80 },
        }));
        continue;
      }

      // Regular paragraph
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = title.toLowerCase().replace(/[\s/]+/g, '-') + '.docx';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="border border-border border-l-[3px] border-l-orange rounded-xl p-9 shadow-sm">
      <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
        <div>
          <span className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-text">{title}</span>
          {date && <span className="text-xs text-text-muted ml-3">{date}</span>}
          {durationLabel && <span className="text-xs text-text-muted ml-2">&middot; {durationLabel}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyOutput} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors cursor-pointer">
            {copyLabel}
          </button>
          <button onClick={downloadPDF} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors cursor-pointer">
            PDF
          </button>
          <button onClick={downloadWord} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors cursor-pointer">
            Word
          </button>
          {onReset && (
            <button onClick={onReset} className="border-[1.5px] border-border rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-text-muted hover:border-text-muted hover:text-text transition-colors cursor-pointer">
              Nieuw bestand
            </button>
          )}
        </div>
      </div>

      <div
        className="prose-oyaa text-sm leading-[1.8] text-text bg-[#FAFAFA] border border-border rounded-lg p-7 [&_h1]:font-[family-name:var(--font-lexend)] [&_h1]:text-[18px] [&_h1]:font-bold [&_h1]:text-text [&_h1]:mt-2 [&_h1]:mb-4 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-border [&_h2]:font-[family-name:var(--font-lexend)] [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-wider [&_h2]:text-text [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-border [&_h3]:font-[family-name:var(--font-lexend)] [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-text-sec [&_h3]:mt-5 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:pl-5 [&_ul]:mb-4 [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-2 [&_li]:leading-[1.7] [&_strong]:font-semibold [&_hr]:border-border [&_hr]:my-6 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_table]:text-[13px] [&_th]:border [&_th]:border-border [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:bg-orange-light [&_th]:font-semibold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_td]:border [&_td]:border-border [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-left"
        dangerouslySetInnerHTML={{ __html: injectLabelHtml(marked.parse(result)) }}
      />
    </div>
  );
}
