// components/custom/DocumentCard.jsx
'use client';

import { FileText } from 'lucide-react';

// Extraheer de titel uit markdown (eerste ## of # heading, of eerste zin)
function extractTitle(markdown) {
  const headingMatch = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  // Fallback: eerste niet-lege regel, gestript van markdown
  const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || '';
  return firstLine.replace(/[#*_`]/g, '').trim().slice(0, 80);
}

// Extraheer een korte preview: strip markdown, pak eerste ~150 tekens platte tekst
function extractPreview(markdown) {
  const stripped = markdown
    .replace(/^#{1,6}\s+.+$/gm, '')   // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')      // italic
    .replace(/`(.+?)`/g, '$1')        // inline code
    .replace(/^\s*[-*+]\s+/gm, '')    // list bullets
    .replace(/\n{2,}/g, '\n')         // meerdere newlines
    .trim();
  return stripped.slice(0, 150) + (stripped.length > 150 ? '...' : '');
}

export default function DocumentCard({ content }) {
  const title = extractTitle(content);
  const preview = extractPreview(content);

  return (
    <div className="mt-2 border border-white/[0.10] rounded-xl p-4 bg-white/[0.03] max-w-lg">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-orange/10 border border-orange/20 flex items-center justify-center mt-0.5">
          <FileText className="w-4 h-4 text-orange" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-lexend)] text-[13px] font-semibold text-white leading-snug mb-1 truncate">
            {title}
          </p>
          <p className="text-[12px] text-white/45 leading-relaxed line-clamp-2">
            {preview}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-[11px] text-white/25">Document</span>
        <button
          disabled
          className="text-[12px] text-white/30 cursor-not-allowed"
          title="Binnenkort beschikbaar"
        >
          Openen
        </button>
      </div>
    </div>
  );
}
