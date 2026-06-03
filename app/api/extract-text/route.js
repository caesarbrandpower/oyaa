// app/api/extract-text/route.js
export const runtime = 'nodejs';

const MAX_CHARS = 12000;

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'Geen bestand.' }, { status: 400 });

  const filename = file.name;
  const ext = filename.split('.').pop().toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    let text = '';

    if (ext === 'pdf') {
      const { extractTextItems } = await import('unpdf');
      const result = await extractTextItems(new Uint8Array(buffer));
      const ROW_TOLERANCE = 3;
      const pageTexts = result.items.map((pageItems) => {
        if (!pageItems.length) return '';
        // Sorteer top-naar-onder (y daalt), dan links-naar-rechts binnen een rij
        const sorted = [...pageItems]
          .filter(item => item.str.trim())
          .sort((a, b) => b.y - a.y || a.x - b.x);
        const rows = [];
        let currentRow = [];
        let currentY = null;
        for (const item of sorted) {
          if (currentY === null || Math.abs(item.y - currentY) <= ROW_TOLERANCE) {
            currentRow.push(item);
            if (currentY === null) currentY = item.y;
          } else {
            rows.push(currentRow);
            currentRow = [item];
            currentY = item.y;
          }
        }
        if (currentRow.length) rows.push(currentRow);
        return rows.map(row => row.map(item => item.str).join(' ')).join('\n');
      });
      text = pageTexts.filter(Boolean).join('\n\n');
      console.log('[extract-text] raw PDF text:\n', text);
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ buffer });
      text = result.value;
    } else if (ext === 'doc') {
      return Response.json({ error: 'Oudere .doc-bestanden worden niet ondersteund. Sla het bestand op als .docx en probeer opnieuw.' }, { status: 400 });
    } else if (ext === 'pptx') {
      const JSZip = await import('jszip');
      const zip = await JSZip.default.loadAsync(buffer);
      const slideFiles = Object.keys(zip.files)
        .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)?.[0] || '0');
          const nb = parseInt(b.match(/\d+/)?.[0] || '0');
          return na - nb;
        });
      const slideTexts = [];
      for (const slideFile of slideFiles) {
        const xml = await zip.files[slideFile].async('string');
        const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        const slideText = matches.map(m => m.replace(/<[^>]+>/g, '')).filter(Boolean).join(' ');
        if (slideText.trim()) slideTexts.push(slideText.trim());
      }
      text = slideTexts.join('\n\n');
    } else if (ext === 'ppt') {
      return Response.json({ error: 'Oudere .ppt-bestanden worden niet ondersteund. Sla het bestand op als .pptx en probeer opnieuw.' }, { status: 400 });
    } else if (ext === 'txt') {
      text = buffer.toString('utf-8');
    } else if (ext === 'eml') {
      const raw = buffer.toString('utf-8');
      const sep = raw.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
      const bodyStart = raw.indexOf(sep);
      text = bodyStart !== -1 ? raw.slice(bodyStart + sep.length) : raw;
      text = text.replace(/--[a-zA-Z0-9_\-=]+/g, '').trim();
    } else {
      return Response.json({ error: 'Bestandstype niet ondersteund.' }, { status: 400 });
    }

    if (text.length > MAX_CHARS) {
      text = text.slice(0, MAX_CHARS) + '\n\n[Tekst afgekapt na 12.000 tekens]';
    }

    return Response.json({ text: text.trim(), filename });
  } catch (err) {
    console.error('[extract-text] error:', err);
    return Response.json({ error: `Fout bij uitlezen: ${err?.message ?? String(err)}` }, { status: 500 });
  }
}
