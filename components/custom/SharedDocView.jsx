// components/custom/SharedDocView.jsx
'use client';

import { useState } from 'react';
import { Marked } from 'marked';

const md = new Marked({ breaks: true });

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

export default function SharedDocView({ content, title: propTitle, expiresAt, chaseLogoUrl = null, clientLogoUrl = null }) {
  const title = propTitle || extractTitle(content);
  const bodyHtml = injectLabelHtml(md.parse(content));

  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Logo-balk: Chase links, klant rechts */}
      {(chaseLogoUrl || clientLogoUrl) && (
        <div className="shrink-0 h-14 flex items-center px-4 md:px-8 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex-1">
            {chaseLogoUrl && (
              <img src={chaseLogoUrl} alt="" aria-hidden="true" className="h-8 max-w-[140px] object-contain" />
            )}
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
                  // Probeer SVG-variant als PNG mislukt
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
      )}
      {/* Header */}
      <header className="shrink-0 h-14 flex items-center px-4 md:px-6 border-b border-white/[0.06] gap-3">
        <h1 className="flex-1 font-[family-name:var(--font-lexend)] text-[14px] font-semibold text-white truncate">
          {title}
        </h1>
        {expiryDate && (
          <span className="text-[11px] text-white/30 shrink-0">
            Geldig t/m {expiryDate}
          </span>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-16 py-10">
        <div
          className="max-w-2xl mx-auto doc-prose"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </div>
  );
}
