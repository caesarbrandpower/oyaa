// components/custom/SharedDocView.jsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Marked } from 'marked';

const md = new Marked({
  breaks: true,
  renderer: {
    link({ href, text }) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

const LABEL_REGEX = /\[([A-Z][A-Z\s]+)\]/g;

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function injectLabelHtml(html) {
  return html.replace(/\[([A-Z][A-Z\s]*(:[^\]]*)?)\]/g, (_, label) => {
    const displayLabel = label.split(':')[0].trim();
    if (isRedLabel(label)) {
      return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#CC2200;color:#fff;margin:0 2px;font-family:var(--font-lexend)">${displayLabel}</span>`;
    }
    return `<span style="display:inline-flex;align-items:center;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;background:#F59E0B;color:#7C4A00;margin:0 2px;font-family:var(--font-lexend)">${displayLabel}</span>`;
  });
}

function extractTitle(markdown) {
  const m = markdown.match(/^#{1,3}\s+(.+)$/m);
  if (m) return m[1].trim();
  const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || '';
  return firstLine.replace(/[#*_`]/g, '').trim().slice(0, 80) || 'Document';
}

const DOC_TYPE_PREFIX = {
  'account-to-pm': 'Briefing',
  'account-to-creation': 'Briefing',
  'field-briefing': 'Ambassadeursbriefing',
  'meeting-summary': 'Samenvatting',
  'external-debrief': 'Evaluatie',
};

export default function SharedDocView({ content, title: propTitle, expiresAt, chaseLogoUrl = null, clientLogoUrl = null, outputType = null }) {
  const rawTitle = propTitle || extractTitle(content);
  // Split "TYPE — Client Project" into two display levels
  const [titleMain, titleSub] = rawTitle && rawTitle.includes(' \u2014 ')
    ? rawTitle.split(' \u2014 ')
    : [rawTitle, null];
  const bodyHtml = injectLabelHtml(md.parse(content));
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    function onClick(e) {
      const img = e.target.closest('img');
      if (img) setLightboxSrc(img.src);
    }
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [bodyHtml]);

  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Logo-balk: Chase links, klant rechts — altijd zichtbaar */}
      <div className="shrink-0 h-14 flex items-center px-4 md:px-8 border-b border-white/[0.06] bg-[#111111]">
        <div className="flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={chaseLogoUrl || '/logos/chase-amsterdam.svg'} alt="" aria-hidden="true" className="h-8 max-w-[140px] object-contain" />
        </div>
        <div className="flex items-center justify-end">
          {clientLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clientLogoUrl}
              alt=""
              aria-hidden="true"
              className="h-8 max-w-[140px] object-contain"
              onError={(e) => {
                const src = e.currentTarget.src;
                if (src.endsWith('.png')) {
                  e.currentTarget.src = src.replace(/\.png$/, '.svg');
                } else {
                  e.currentTarget.style.display = 'none';
                }
              }}
            />
          )}
        </div>
      </div>
      {/* Header — alleen documenttype, geen klantnaam */}
      <header className="shrink-0 h-14 flex items-center px-4 md:px-6 border-b border-white/[0.06] gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-[family-name:var(--font-lexend)] text-[13px] font-semibold text-white truncate">
            {titleMain}
          </div>
        </div>
        {expiryDate && (
          <span className="text-[11px] text-white/30 shrink-0">
            Geldig t/m {expiryDate}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-16 py-10">
        <div className="max-w-2xl mx-auto">
          {/* Grote kop: documenttype prefix + klant + project */}
          {titleSub && (
            <h1 className="font-[family-name:var(--font-lexend)] text-2xl font-bold text-white mb-6">
              {outputType && DOC_TYPE_PREFIX[outputType]
                ? `${DOC_TYPE_PREFIX[outputType]} \u2014 ${titleSub}`
                : titleSub}
            </h1>
          )}
          <div
            ref={bodyRef}
            className="doc-prose"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
