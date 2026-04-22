'use client';

import { useState } from 'react';
import { marked } from 'marked';
import { OUTPUT_TITLES } from '@/lib/prompts';

marked.setOptions({ gfm: true, breaks: true });

function parseInlineRuns(text, size, docx) {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter((p) => p.length > 0)
    .map((p) =>
      p.startsWith('**') && p.endsWith('**')
        ? new docx.TextRun({ text: p.slice(2, -2), bold: true, size })
        : new docx.TextRun({ text: p.replace(/\*/g, ''), size })
    );
}

export default function OutputCard({ output, transcript, onReset, recordingDuration }) {
  const [copyLabel, setCopyLabel] = useState('Kopiëren');
  const [copyTranscriptLabel, setCopyTranscriptLabel] = useState('Kopieer transcript');
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

  function copyTranscript() {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript).then(() => {
      setCopyTranscriptLabel('Gekopieerd \u2713');
      setTimeout(() => setCopyTranscriptLabel('Kopieer transcript'), 2200);
    });
  }

  function downloadTranscript() {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    anchor.download = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}_waybetter-transcript.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPDF() {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 20;
    const maxWidth = 210 - margin * 2;
    let y = 20;

    const addPage = () => { doc.addPage(); y = 20; };
    const checkY = (needed) => { if (y + needed > 280) addPage(); };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(title, margin, y);
    y += 10;
    doc.setFontSize(10);

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') { y += 3; continue; }

      const headingMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (headingMatch) {
        const boldPart = headingMatch[1];
        const restPart = headingMatch[2].replace(/^[\s—]+/, '');
        checkY(8); y += 2;
        doc.setFont('helvetica', 'bold');
        const bw = doc.splitTextToSize(boldPart + (restPart ? ' — ' + restPart : ''), maxWidth);
        doc.text(bw, margin, y); y += bw.length * 5.5;
        doc.setFont('helvetica', 'normal');
        continue;
      }

      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const text = listMatch[1].replace(/\*\*/g, '').replace(/\*/g, '');
        const wrapped = doc.splitTextToSize('• ' + text, maxWidth - 4);
        checkY(wrapped.length * 5);
        doc.text(wrapped, margin + 4, y); y += wrapped.length * 5;
        continue;
      }

      const text = line.replace(/\*\*/g, '').replace(/\*/g, '');
      const wrapped = doc.splitTextToSize(text, maxWidth);
      checkY(wrapped.length * 5);
      doc.text(wrapped, margin, y); y += wrapped.length * 5;
    }

    doc.save(title.toLowerCase().replace(/[\s/]+/g, '-') + '.pdf');
  }

  async function downloadWord() {
    const docx = await import('docx');
    const paragraphs = [];

    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: title, bold: true, size: 28 })],
      spacing: { after: 280 },
    }));

    for (const raw of result.split('\n')) {
      const line = raw.trim();
      if (line === '') {
        paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } }));
        continue;
      }

      const headingMatch = line.match(/^\*\*(.+?)\*\*(.*)$/);
      if (headingMatch) {
        const boldText = headingMatch[1];
        const rest = headingMatch[2].replace(/^[\s—]+/, '');
        const runs = [new docx.TextRun({ text: boldText, bold: true, size: 22 })];
        if (rest) runs.push(new docx.TextRun({ text: ' — ' + rest, size: 22 }));
        paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } }));
        continue;
      }

      const listMatch = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
      if (listMatch) {
        const runs = parseInlineRuns(listMatch[1], 20, docx);
        paragraphs.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: '• ', size: 20 }), ...runs],
          indent: { left: 360 },
          spacing: { after: 60 },
        }));
        continue;
      }

      paragraphs.push(new docx.Paragraph({
        children: parseInlineRuns(line, 20, docx),
        spacing: { after: 100 },
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
          {transcript && (
            <>
              <button onClick={copyTranscript} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors cursor-pointer">
                {copyTranscriptLabel}
              </button>
              <button onClick={downloadTranscript} className="border-[1.5px] border-orange rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-orange hover:bg-orange hover:text-white transition-colors cursor-pointer">
                Download transcript
              </button>
            </>
          )}
          {onReset && (
            <button onClick={onReset} className="border-[1.5px] border-border rounded-[7px] px-3.5 py-[7px] text-xs font-semibold text-text-muted hover:border-text-muted hover:text-text transition-colors cursor-pointer">
              Nieuw bestand
            </button>
          )}
        </div>
      </div>

      <div
        className="prose-oyaa text-sm leading-[1.8] text-text bg-[#FAFAFA] border border-border rounded-lg p-7 [&_h1]:font-[family-name:var(--font-lexend)] [&_h1]:text-[13px] [&_h1]:font-semibold [&_h1]:uppercase [&_h1]:tracking-wide [&_h1]:mt-6 [&_h1]:mb-2 [&_h2]:font-[family-name:var(--font-lexend)] [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-[family-name:var(--font-lexend)] [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1.5 [&_strong]:font-semibold [&_hr]:border-border [&_hr]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_table]:text-[13px] [&_th]:border [&_th]:border-border [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:bg-orange-light [&_th]:font-semibold [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_td]:border [&_td]:border-border [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:text-left"
        dangerouslySetInnerHTML={{ __html: marked.parse(result) }}
      />
    </div>
  );
}
