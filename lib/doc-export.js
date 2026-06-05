// lib/doc-export.js
// Gedeelde export-functies voor Word en PDF downloads

// ── SVG → PNG rasterizer (browser-side, via canvas) ─────────────────────────

async function svgDataUrlToPng(svgDataUrl) {
  if (typeof window === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const W = Math.max(img.naturalWidth || 400, 400);
      const H = Math.max(img.naturalHeight || 120, 120);
      const canvas = document.createElement('canvas');
      canvas.width = W * 2; canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W * 2, H * 2);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUrl;
  });
}

function isExternalUrl(url) {
  if (!url) return false;
  if (url.startsWith('/')) return false;
  if (typeof window !== 'undefined' && url.startsWith(window.location.origin)) return false;
  return /^https?:\/\//.test(url);
}

// ── Image helpers ─────────────────────────────────────────────────────────────

// Tries the given URL, then swaps .png↔.svg if the first attempt returns nothing
export async function fetchLogoBase64(url) {
  if (!url) return null;
  const r = await fetchImageAsBase64(url);
  if (r) return r;
  if (url.endsWith('.png')) return fetchImageAsBase64(url.replace(/\.png$/, '.svg'));
  if (url.endsWith('.svg')) return fetchImageAsBase64(url.replace(/\.svg$/, '.png'));
  return null;
}

export async function fetchLogoBuffer(url) {
  if (!url) return null;
  const r = await fetchImageAsBuffer(url);
  if (r) return r;
  if (url.endsWith('.png')) return fetchImageAsBuffer(url.replace(/\.png$/, '.svg'));
  if (url.endsWith('.svg')) return fetchImageAsBuffer(url.replace(/\.svg$/, '.png'));
  return null;
}

export async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    // Supabase public storage: directe fetch (CORS toegestaan, proxy niet nodig)
    // Andere externe URLs: via proxy (CORS-bypass)
    const supabaseStorageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
      : null;
    const isSupabasePublic = supabaseStorageBase && url.startsWith(supabaseStorageBase);

    // Supabase public storage: directe fetch — bucket is public, CORS toegestaan
    // Andere externe URLs: via proxy (CORS-bypass voor niet-Supabase)
    const fetchUrl = isSupabasePublic
      ? url
      : isExternalUrl(url)
        ? `/api/proxy-logo?url=${encodeURIComponent(url)}`
        : url;
    console.log('[LOGO DEBUG] fetchImageAsBase64 url:', url);
    console.log('[LOGO DEBUG] isSupabasePublic:', isSupabasePublic, 'fetchUrl:', fetchUrl);
    const res = await fetch(fetchUrl);
    console.log('[LOGO DEBUG] fetchImageAsBase64 status:', res.status, res.ok);
    if (!res.ok) return null;
    const blob = await res.blob();
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!base64) return null;
    // Convert SVG to PNG for PDF/Word compatibility
    if (base64.startsWith('data:image/svg')) {
      return svgDataUrlToPng(base64);
    }
    return base64;
  } catch {
    return null;
  }
}

export async function fetchImageAsBuffer(url) {
  if (!url) return null;
  try {
    const supabaseStorageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
      : null;
    const isSupabasePublic = supabaseStorageBase && url.startsWith(supabaseStorageBase);

    const fetchUrl = isSupabasePublic
      ? url
      : isExternalUrl(url)
        ? `/api/proxy-logo?url=${encodeURIComponent(url)}`
        : url;
    console.log('[LOGO DEBUG] fetchImageAsBuffer url:', url);
    console.log('[LOGO DEBUG] isSupabasePublic:', isSupabasePublic, 'fetchUrl:', fetchUrl);
    const res = await fetch(fetchUrl);
    console.log('[LOGO DEBUG] fetchImageAsBuffer status:', res.status, res.ok);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('svg')) {
      // Convert SVG to PNG via canvas, then to Uint8Array
      const blob = await res.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (!base64) return null;
      const pngDataUrl = await svgDataUrlToPng(base64);
      if (!pngDataUrl) return null;
      const b64Data = pngDataUrl.split(',')[1];
      const binary = atob(b64Data);
      const buf = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
      return buf;
    }
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
    .replace(/[→×—–]/g, '-')
    .replace(/[^\w\s\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

const FILENAME_TYPE_LABELS = {
  'account-to-pm': 'Briefing PM',
  'account-to-creation': 'Briefing Creatie',
  'field-briefing': 'Ambassadeursbriefing',
  'meeting-summary': 'Samenvatting',
  'external-debrief': 'Evaluatie',
};

// outputType: the document type key (e.g. 'account-to-pm')
export function buildFilename(outputType, client, project, extension) {
  function sanitizePart(s) {
    return s.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').replace(/[→×—–]/g, '-').replace(/[<>:"/\\|?*]/g, '').trim();
  }
  console.log('[FILENAME]', outputType, client, project);
  const typeLabel = FILENAME_TYPE_LABELS[outputType] || null;
  // Project weggooien als het null is of gelijk aan client — voorkomt dubbeling
  const effectiveProject = (project && project !== client) ? project : null;
  const cpPart = [client, effectiveProject].filter(Boolean).map(sanitizePart).filter(Boolean).join(' ');
  const parts = [typeLabel, cpPart].filter(Boolean);
  const name = parts.join(' - ').slice(0, 80);
  return (name || 'document') + '.' + extension;
}

// ── Chase document title ──────────────────────────────────────────────────────

export function buildChaseTitle(outputType, client, project) {
  const cp = [client, project].filter(Boolean).join(' ');
  switch (outputType) {
    case 'field-briefing':
      return cp ? `AMBASSADEURSBRIEFING — ${cp}` : 'AMBASSADEURSBRIEFING';
    case 'account-to-pm':
      return cp ? `BRIEFING NAAR PM — ${cp}` : 'BRIEFING NAAR PM';
    case 'account-to-creation':
      return cp ? `BRIEFING NAAR CREATIE — ${cp}` : 'BRIEFING NAAR CREATIE';
    case 'meeting-summary':
      return cp ? `SAMENVATTING — ${cp}` : 'SAMENVATTING';
    case 'external-debrief':
      return cp ? `EVALUATIE — ${cp}` : 'EVALUATIE';
    default:
      return null;
  }
}

// PDF-safe version: strip special chars not supported by helvetica
function buildChaseTitleForPdf(outputType, client, project) {
  const t = buildChaseTitle(outputType, client, project);
  if (!t) return null;
  return t.replace(/[→×—–]/g, '-');
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function isRedLabel(label) {
  return /^(AFSTEMMEN|UITZOEKEN|NAVRAGEN|CIJFERS|ACHTERGROND)/.test(label);
}

function labelKeyword(label) {
  return label.split(':')[0].trim();
}

// ── Inline runs helper for Word export ────────────────────────────────────────

function parseInlineRuns(text, size, docx) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[A-Z][A-Z\s]*(?::[^\]]*)?])/);
  return parts.filter(p => p.length > 0).flatMap(p => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return [new docx.TextRun({ text: p.slice(2, -2), bold: true, size, font: 'Arial' })];
    }
    const lm = p.match(/^\[([A-Z][A-Z\s]*(?::[^\]]*)?)\]$/);
    if (lm) {
      return [new docx.TextRun({ text: `[${labelKeyword(lm[1])}]`, bold: true, size, font: 'Arial', color: 'CC0000' })];
    }
    return [new docx.TextRun({ text: p.replace(/\*/g, ''), size, font: 'Arial' })];
  });
}

// ── Word header: render als canvas-afbeelding (immuun voor Word dark mode) ───

async function createHeaderImageBuffer(chaseBuffer, clientBuffer) {
  if (typeof window === 'undefined') return null;
  const CANVAS_W = 1240;
  const CANVAS_H = 112;
  const PADDING = 40;
  const MAX_LOGO_W = 320;
  const MAX_LOGO_H = 72;
  const MID_Y = CANVAS_H / 2;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  async function drawLogo(buf, leftEdge, rightEdge, alignRight) {
    if (!buf || !buf.length) return;
    const blob = new Blob([buf], { type: 'image/png' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = blobUrl;
      });
      let w = Math.min(MAX_LOGO_W, img.naturalWidth || MAX_LOGO_W);
      let h = img.naturalWidth ? (w * img.naturalHeight / img.naturalWidth) : MAX_LOGO_H;
      if (h > MAX_LOGO_H) { h = MAX_LOGO_H; w = img.naturalWidth ? (h * img.naturalWidth / img.naturalHeight) : w; }
      const x = alignRight ? rightEdge - w : leftEdge;
      ctx.drawImage(img, x, MID_Y - h / 2, w, h);
    } catch { /* logo niet beschikbaar */ } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  await drawLogo(chaseBuffer, PADDING, 0, false);
  await drawLogo(clientBuffer, 0, CANVAS_W - PADDING, true);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result.split(',')[1];
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        resolve(buf);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

// ── Document type label (without client/project) ──────────────────────────────

function buildDocTypeLabel(outputType) {
  switch (outputType) {
    case 'field-briefing': return 'AMBASSADEURSBRIEFING';
    case 'account-to-pm': return 'BRIEFING NAAR PM';
    case 'account-to-creation': return 'BRIEFING NAAR CREATIE';
    case 'meeting-summary': return 'SAMENVATTING';
    case 'external-debrief': return 'EVALUATIE';
    default: return null;
  }
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function downloadPdfDoc(content, title, logos = {}, extras = null, filename = null, outputType = null, client = null, project = null) {
  if (!content?.trim()) return;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  const LOGO_H = 6;
  let y = margin;

  // ── Klantlogo: directe fetch als fallback naast wat al is opgehaald ───────
  let effectiveClientBase64 = logos.clientBase64 ?? null;
  if (!effectiveClientBase64 && client && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const slug = client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const clientLogoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}.png`;
    console.log('[CLIENT LOGO] direct fetch PDF:', clientLogoUrl);
    try {
      const res = await fetch(clientLogoUrl);
      console.log('[CLIENT LOGO] status:', res.status, res.ok);
      if (res.ok) {
        const blob = await res.blob();
        effectiveClientBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
    } catch (e) {
      console.log('[CLIENT LOGO ERROR]', e.message);
    }
  }

  // ── Logo header ──────────────────────────────────────────────────────────
  if (logos.chaseBase64 || effectiveClientBase64) {
    const balkH = LOGO_H + 8;
    const logoY = Math.round((balkH - LOGO_H) / 2);
    doc.setFillColor(17, 17, 17);
    doc.rect(0, 0, pageWidth, balkH, 'F');
    if (logos.chaseBase64) {
      try {
        const dims = await getImageDimensions(logos.chaseBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 50);
        doc.addImage(logos.chaseBase64, getImageFormat(logos.chaseBase64), margin, logoY, w, LOGO_H);
      } catch { /* skip unsupported format */ }
    }
    if (effectiveClientBase64) {
      try {
        const dims = await getImageDimensions(effectiveClientBase64);
        const w = Math.min((dims.w / dims.h) * LOGO_H, 50);
        doc.addImage(effectiveClientBase64, getImageFormat(effectiveClientBase64), pageWidth - margin - w, logoY, w, LOGO_H);
      } catch { /* skip */ }
    }
    y = balkH + 12;
  }

  function splitSegments(text) {
    const segs = [];
    const re = /(\[[A-Z][A-Z\s]*(:[^\]]*)?])/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false });
      segs.push({ text: `[${labelKeyword(m[1].slice(1, -1))}]`, bold: true, red: true });
      last = m.index + m[0].length;
    }
    if (last < text.length) segs.push({ text: text.slice(last), bold: false });
    return segs;
  }

  function renderWrappedSegments(segs, fontSize, indentX) {
    doc.setFontSize(fontSize);
    const lineH = fontSize * 0.45 + 1 + 2;
    let cx = indentX;
    for (const seg of segs) {
      if (!seg.text) continue;
      doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
      if (seg.red) doc.setTextColor(204, 0, 0);
      else doc.setTextColor(0, 0, 0);
      // Labels ([UITZOEKEN INTERN] etc.) are treated as atomic units — never split across lines
      const words = seg.red ? [seg.text] : seg.text.split(' ').filter(w => w);
      for (let wi = 0; wi < words.length; wi++) {
        const word = seg.red ? seg.text : (wi < words.length - 1 ? words[wi] + ' ' : words[wi]);
        const sw = doc.getTextWidth(word);
        if (cx > indentX && cx + sw > pageWidth - margin) {
          y += lineH;
          checkPage(lineH);
          cx = indentX;
        }
        doc.text(word, cx, y);
        cx += sw;
      }
    }
    doc.setTextColor(0, 0, 0);
    return lineH;
  }

  function checkPage(needed) {
    if (y + (needed || 8) > 277) { doc.addPage(); y = margin; }
  }

  // ── Title (two levels: type label + client/project) ─────────────────────
  const pdfTypeLabel = buildDocTypeLabel(outputType);
  const pdfCpLabel = [client, project].filter(Boolean).join(' ');
  const pdfMainTitle = pdfTypeLabel
    || title.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').replace(/[→×—–]/g, '-').trim();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const wrappedTitle = doc.splitTextToSize(pdfMainTitle, maxWidth);
  checkPage(wrappedTitle.length * 9 + 16);
  doc.text(wrappedTitle, margin, y);
  y += wrappedTitle.length * 9;

  if (pdfCpLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(doc.splitTextToSize(pdfCpLabel, maxWidth), margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Skip first heading that duplicates the title
  let skipFirstHeading = true;
  const titleNorm = pdfMainTitle.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    checkPage();
    if (line === '') { y += 4; continue; }
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) continue;

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstHeading) { skipFirstHeading = false; continue; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
      const wrapped = doc.splitTextToSize(h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').replace(/[→×—–]/g, '-').trim(), maxWidth);
      checkPage(wrapped.length * 7 + 4);
      doc.text(wrapped, margin, y); y += wrapped.length * 7 + 4; continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      skipFirstHeading = false;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      const wrapped = doc.splitTextToSize(h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase(), maxWidth);
      checkPage(wrapped.length * 6 + 4);
      doc.text(wrapped, margin, y); y += wrapped.length * 6 + 4; continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      skipFirstHeading = false;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), maxWidth);
      checkPage(wrapped.length * 6 + 3);
      doc.text(wrapped, margin, y); y += wrapped.length * 6 + 3; continue;
    }

    // Bold section heading: **Header** - rest of text
    const boldSection = line.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (boldSection) {
      const boldText = boldSection[1].replace(/:$/, '').trim();
      const rest = boldSection[2].replace(/^[\s\-–—:]+/, '').trim();
      // Skip if this is the first heading and matches the document title
      if (skipFirstHeading) {
        const boldNorm = boldText.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
        if (boldNorm === titleNorm || !rest) {
          skipFirstHeading = false; continue;
        }
      }
      skipFirstHeading = false;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      const labelClean = boldText.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();
      const fullLine = rest ? labelClean + ': ' + rest.replace(/\*\*/g, '') : labelClean;
      const wrapped = doc.splitTextToSize(fullLine, maxWidth);
      checkPage(wrapped.length * 6 + 3);
      doc.text(wrapped[0], margin, y);
      if (wrapped.length > 1) {
        doc.setFont('helvetica', 'normal');
        for (let i = 1; i < wrapped.length; i++) { y += 6; doc.text(wrapped[i], margin, y); }
      }
      y += 6 + 3; continue;
    }

    skipFirstHeading = false;

    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      doc.setFontSize(10);
      const segs = splitSegments(listItem[1].replace(/\*\*/g, ''));
      const lineH = 10 * 0.45 + 1 + 2; // identiek aan renderWrappedSegments
      doc.setFont('helvetica', 'normal');
      const bw = doc.getTextWidth('• ');
      const bIndentX = margin + 5 + bw;
      // Schat werkelijke hoogte vóór rendering — voorkomt checkPage(7) als fixed waarde
      let estimatedLines = 1;
      let ecx = bIndentX;
      for (const seg of segs) {
        if (!seg.text) continue;
        doc.setFont('helvetica', seg.bold ? 'bold' : 'normal');
        const words = seg.red ? [seg.text] : seg.text.split(' ').filter(w => w);
        for (let wi = 0; wi < words.length; wi++) {
          const word = wi < words.length - 1 ? words[wi] + ' ' : words[wi];
          const sw = doc.getTextWidth(word);
          if (ecx > bIndentX && ecx + sw > pageWidth - margin) { estimatedLines++; ecx = bIndentX; }
          ecx += sw;
        }
      }
      // checkPage op basis van schatting, daarna bulletpunt renderen (niet eerder)
      checkPage(estimatedLines * lineH + 6);
      doc.setFont('helvetica', 'normal');
      doc.text('• ', margin + 5, y);
      y += renderWrappedSegments(segs, 10, bIndentX) - 1;
      y += 7; continue;
    }

    doc.setFontSize(10);

    // Table rows — supports any number of columns
    if (line.startsWith('|') && line.endsWith('|')) {
      const rawCells = line.slice(1, -1).split('|').map(c => c.trim()).filter(c => c && !c.match(/^[-:]+$/));
      if (rawCells.length >= 2) {
        const numCols = rawCells.length;
        const gap = 4;
        const colW = (maxWidth - gap * (numCols - 1)) / numCols;
        // Compute line count per column — ci=0 via splitTextToSize, ci>0 via render-simulatie
        const colLineCounts = rawCells.map((cell, ci) => {
          const cellText = cell.replace(/\*\*/g, '');
          if (ci === 0) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            const plainText = cellText.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '...').trim();
            return doc.splitTextToSize(plainText || ' ', colW).length;
          }
          // Simuleer de exacte render-loop zodat regel-breaks identiek zijn aan de werkelijke rendering
          const segs = splitSegments(cellText);
          let cx = 0; let lines = 1;
          for (const seg of segs) {
            if (!seg.text) continue;
            doc.setFont('helvetica', seg.bold ? 'bold' : 'normal'); doc.setFontSize(10);
            const words = seg.red ? [seg.text] : seg.text.split(' ').filter(w => w);
            for (let wi = 0; wi < words.length; wi++) {
              const word = wi < words.length - 1 ? words[wi] + ' ' : words[wi];
              const sw = doc.getTextWidth(word);
              if (cx > 0 && cx + sw > colW) { lines++; cx = 0; }
              cx += sw;
            }
          }
          return lines;
        });
        const rowH = Math.max(...colLineCounts) * 5 + 2;
        checkPage(rowH);
        rawCells.forEach((cell, ci) => {
          const colX = margin + ci * (colW + gap);
          const cellText = cell.replace(/\*\*/g, '');
          if (ci === 0) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(cellText.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), colW);
            doc.text(lines, colX, y);
          } else {
            const segs = splitSegments(cellText);
            let cx = colX; let lineOff = 0;
            for (const seg of segs) {
              if (!seg.text) continue;
              doc.setFont('helvetica', seg.bold ? 'bold' : 'normal'); doc.setFontSize(10);
              if (seg.red) doc.setTextColor(204, 0, 0); else doc.setTextColor(0, 0, 0);
              const words = seg.red ? [seg.text] : seg.text.split(' ').filter(w => w);
              for (let wi = 0; wi < words.length; wi++) {
                const word = wi < words.length - 1 ? words[wi] + ' ' : words[wi];
                const sw = doc.getTextWidth(word);
                if (cx > colX && cx + sw > colX + colW) { lineOff++; cx = colX; }
                doc.text(word, cx, y + lineOff * 5);
                cx += sw;
              }
            }
            doc.setTextColor(0, 0, 0);
          }
        });
        y += rowH;
      } else if (rawCells.length === 1) {
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(rawCells[0].replace(/\*\*/g, ''), maxWidth);
        checkPage(wrapped.length * 5 + 2);
        doc.text(wrapped, margin, y); y += wrapped.length * 5 + 2;
      }
      continue;
    }

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
      y += renderWrappedSegments(segs, 10, margin);
      y += 4;
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
      // Render photos 2 per row — preserve actual aspect ratio
      const gap = 5;
      const maxPhotoW = (maxWidth - gap) / 2;

      for (let pi = 0; pi < extras.photos.length; pi += 2) {
        const p1 = extras.photos[pi];
        const p2 = extras.photos[pi + 1];

        // Fetch both photos and get their actual dimensions
        const photoData = await Promise.all([p1, p2].map(async (photo) => {
          if (!photo?.url) return null;
          try {
            const b64 = await fetchImageAsBase64(photo.url);
            if (!b64 || b64.startsWith('data:image/svg')) return null;
            const dims = await getImageDimensions(b64);
            const ratio = dims.h / dims.w;
            const w = maxPhotoW;
            const h = Math.round(w * ratio);
            return { b64, w, h, name: photo.name };
          } catch { return null; }
        }));

        const rowH = Math.max(...photoData.map(d => d?.h ?? 0), 1);
        checkPage(rowH + 8);

        photoData.forEach((pd, col) => {
          if (!pd) return;
          const x = margin + col * (maxPhotoW + gap);
          doc.addImage(pd.b64, getImageFormat(pd.b64), x, y, pd.w, pd.h);
        });
        y += rowH + gap;

        // Filenames below
        let hasName = false;
        photoData.forEach((pd, col) => {
          if (pd?.name) {
            hasName = true;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const x = margin + col * (maxPhotoW + gap);
            doc.text(pd.name.slice(0, 30), x, y);
            doc.setTextColor(0, 0, 0);
          }
        });
        if (hasName) y += 5;
      }
      y += 3;
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
        doc.text(wrapped, margin, y);
        try { doc.link(margin, y - 4, Math.min(doc.getTextWidth(wrapped[0]), maxWidth), 6, { url: link.url }); } catch {}
        y += wrapped.length * 5 + 2;
        doc.setTextColor(0, 0, 0);
      }
    }
  }

  doc.save(filename || toFilePart(pdfMainTitle) + '.pdf');
}

// ── Word export ────────────────────────────────────────────────────────────────

export async function downloadWordDoc(content, title, logos = {}, extras = null, filename = null, outputType = null, client = null, project = null) {
  if (!content?.trim()) return;
  const docx = await import('docx');
  const paragraphs = [];

  // ── Klantlogo: directe fetch als fallback naast wat al is opgehaald ───────
  let effectiveClientBuffer = logos.clientBuffer ?? null;
  if (!effectiveClientBuffer && client && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const slug = client.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const clientLogoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/client-logos/${slug}.png`;
    console.log('[CLIENT LOGO] direct fetch Word:', clientLogoUrl);
    try {
      const res = await fetch(clientLogoUrl);
      console.log('[CLIENT LOGO] status:', res.status, res.ok);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        effectiveClientBuffer = new Uint8Array(ab);
      }
    } catch (e) {
      console.log('[CLIENT LOGO ERROR]', e.message);
    }
  }

  // ── Logo header als canvas-afbeelding (altijd zwart — immuun voor Word dark mode) ──
  if (logos.chaseBuffer || effectiveClientBuffer) {
    try {
      const headerBuf = await createHeaderImageBuffer(logos.chaseBuffer, effectiveClientBuffer);
      if (headerBuf) {
        // width: 620px = breedte tekstvak A4 bij 96dpi; height: proportioneel (112/1240 * 620 ≈ 56)
        paragraphs.push(new docx.Paragraph({
          children: [new docx.ImageRun({ data: headerBuf, transformation: { width: 620, height: 56 }, type: 'png' })],
          spacing: { before: 0, after: 200 },
        }));
      }
    } catch { /* geen header als canvas niet beschikbaar */ }
  }

  // ── Title (two levels: type label + client/project) ─────────────────────
  const wordTypeLabel = buildDocTypeLabel(outputType);
  const wordCpLabel = [client, project].filter(Boolean).join(' ');
  const wordMainTitle = wordTypeLabel || title.replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim();

  paragraphs.push(new docx.Paragraph({
    children: [new docx.TextRun({ text: wordMainTitle, bold: true, size: 32, font: 'Arial' })],
    spacing: { after: wordCpLabel ? 80 : 320 },
    border: wordCpLabel ? undefined : { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
  }));
  if (wordCpLabel) {
    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: wordCpLabel, size: 22, font: 'Arial', color: '666666' })],
      spacing: { after: 320 },
      border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
    }));
  }

  let skipFirstHeading = true;
  const titleNorm = wordMainTitle.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);

  let pendingTableRows = [];
  function flushWordTable() {
    if (!pendingTableRows.length) return;
    const maxCols = Math.max(...pendingTableRows.map(r => r.length));
    if (maxCols === 0) { pendingTableRows = []; return; }
    const colWidth = Math.floor(9000 / maxCols);
    const borderStyle = { style: docx.BorderStyle.SINGLE, size: 4, color: 'DDDDDD' };
    paragraphs.push(new docx.Table({
      rows: pendingTableRows.map((cells, rowIdx) => new docx.TableRow({
        children: Array.from({ length: maxCols }, (_, i) => {
          const cellText = cells[i] ?? '';
          const isHeaderRow = rowIdx === 0;
          return new docx.TableCell({
            children: [new docx.Paragraph({
              children: parseInlineRuns(cellText, 18, docx),
              spacing: { before: 60, after: 60 },
            })],
            width: { size: colWidth, type: docx.WidthType.DXA },
            shading: isHeaderRow ? { fill: 'F5F5F5', type: docx.ShadingType.CLEAR, color: 'auto' } : undefined,
            borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle },
          });
        }),
      })),
      borders: { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle, insideH: borderStyle, insideV: borderStyle },
      width: { size: 9000, type: docx.WidthType.DXA },
    }));
    paragraphs.push(new docx.Paragraph({ children: [], spacing: { after: 120 } }));
    pendingTableRows = [];
  }

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    // Flush pending table when transitioning to non-table content
    if (pendingTableRows.length > 0 && !(line.startsWith('|') && line.endsWith('|'))) {
      flushWordTable();
    }
    if (line === '') { paragraphs.push(new docx.Paragraph({ text: '', spacing: { after: 60 } })); continue; }
    if (/^-{3,}$/.test(line) || /^\*{3,}$/.test(line)) continue;
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (skipFirstHeading) { skipFirstHeading = false; continue; }
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h1[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 28, font: 'Arial' })],
        spacing: { before: 240, after: 200 },
        border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      })); continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      skipFirstHeading = false;
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h2[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim().toUpperCase(), bold: true, size: 22, color: '111111', font: 'Arial' })],
        spacing: { before: 360, after: 120 },
        border: { bottom: { color: 'EEEEEE', space: 1, style: docx.BorderStyle.SINGLE, size: 4 } },
      })); continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      skipFirstHeading = false;
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: h3[1].replace(/\[[A-Z][A-Z\s]*(:[^\]]*)?]/g, '').trim(), bold: true, size: 20, color: '444444', font: 'Arial' })],
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
      const runs = [new docx.TextRun({ text: boldText, bold: true, size: 22, font: 'Arial' })];
      if (rest) runs.push(...parseInlineRuns(': ' + rest, 22, docx));
      paragraphs.push(new docx.Paragraph({ children: runs, spacing: { before: 200, after: 80 } })); continue;
    }
    skipFirstHeading = false;
    const listItem = line.match(/^[-*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/);
    if (listItem) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: '• ', size: 20, font: 'Arial' }), ...parseInlineRuns(listItem[1], 20, docx)],
        indent: { left: 360 },
        spacing: { after: 80 },
      })); continue;
    }
    // Table row — buffer for real docx.Table rendering
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.slice(1, -1).split('|').map(c => c.trim()).filter(c => !c.match(/^[-:]+$/));
      if (cells.length > 0) pendingTableRows.push(cells);
      continue;
    }
    paragraphs.push(new docx.Paragraph({ children: parseInlineRuns(line, 20, docx), spacing: { after: 120 } }));
  }
  flushWordTable(); // flush any remaining table at end of content

  // ── Bijlagen (extras) ───────────────────────────────────────────────────
  if (extras && (extras.photos?.length > 0 || extras.links?.length > 0)) {
    paragraphs.push(new docx.Paragraph({
      children: [],
      border: { bottom: { color: 'DDDDDD', space: 1, style: docx.BorderStyle.SINGLE, size: 6 } },
      spacing: { before: 360, after: 240 },
    }));
    paragraphs.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: 'Bijlagen', bold: true, size: 26, font: 'Arial' })],
      spacing: { after: 200 },
    }));

    if (extras.photos?.length > 0) {
      for (const photo of extras.photos) {
        if (!photo.url) continue;
        try {
          // Fetch as base64 to get actual dimensions, then convert to buffer
          const b64 = await fetchImageAsBase64(photo.url);
          if (!b64) continue;
          const dims = await getImageDimensions(b64);
          const maxW = 400;
          const ratio = dims.h / dims.w;
          const photoH = Math.round(maxW * ratio);
          const raw = b64.split(',')[1];
          const binary = atob(raw);
          const buf = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
          const fmt = getImageFormat(b64).toLowerCase();
          paragraphs.push(new docx.Paragraph({
            children: [new docx.ImageRun({ data: buf, transformation: { width: maxW, height: photoH }, type: fmt === 'jpeg' ? 'jpg' : 'png' })],
            spacing: { after: 120 },
          }));
          if (photo.name) {
            paragraphs.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: photo.name, font: 'Arial', size: 16, color: '888888' })],
              spacing: { after: 160 },
            }));
          }
        } catch { /* skip */ }
      }
    }

    if (extras.links?.length > 0) {
      paragraphs.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: 'Links', bold: true, size: 22, font: 'Arial' })],
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

  const wordDoc = new docx.Document({
    styles: {
      default: {
        document: { run: { font: { name: 'Arial' }, size: 20 } },
      },
    },
    sections: [{ properties: {}, children: paragraphs }],
  });
  const blob = await docx.Packer.toBlob(wordDoc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || toFilePart(wordMainTitle) + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Share document ─────────────────────────────────────────────────────────────

export async function shareDocument(content, title, client = null, extras = null, outputType = null, project = null) {
  let shareContent = content;
  // Embed extras as HTML in content so they render on the shared link
  if (extras?.photos?.length > 0 || extras?.links?.length > 0) {
    shareContent += '\n\n---\n\n**Bijlagen**\n\n';
    if (extras.photos?.length > 0) {
      shareContent += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0">';
      for (const p of extras.photos) {
        shareContent += `<img src="${p.url}" alt="${(p.name || 'foto').replace(/"/g, '')}" style="width:100%;border-radius:8px;object-fit:cover;aspect-ratio:16/9" />`;
      }
      shareContent += '</div>\n\n';
    }
    if (extras.links?.length > 0) {
      for (const link of extras.links) {
        shareContent += `[${link.label || link.url}](${link.url})\n\n`;
      }
    }
  }
  const res = await fetch('/api/share-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: shareContent, outputType: outputType ?? null, title, client, project: project ?? null }),
  });
  const data = await res.json();
  return data.token ? `${window.location.origin}/doc/${data.token}` : null;
}
