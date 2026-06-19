// lib/extract-file-text.js
// Tekstextractie uit uploads. Gedeeld door /api/extract-text (chat, met cap)
// en de kluis-ingest (zonder cap). Throwt Error met NL-boodschap bij
// niet-ondersteunde bestandstypen.

export async function extractFileText(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase();

  if (ext === 'pdf') {
    const { extractTextItems } = await import('unpdf');
    const result = await extractTextItems(new Uint8Array(buffer));
    const ROW_TOLERANCE = 3;
    const pageTexts = result.items.map((pageItems) => {
      if (!pageItems.length) return '';
      // Sorteer top-naar-onder (y daalt), dan links-naar-rechts binnen een rij
      const sorted = [...pageItems]
        .filter((item) => item.str.trim())
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
      return rows.map((row) => row.map((item) => item.str).join(' ')).join('\n');
    });
    return pageTexts.filter(Boolean).join('\n\n');
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer });
    return result.value;
  }

  if (ext === 'doc') {
    throw new Error('Oudere .doc-bestanden worden niet ondersteund. Sla het bestand op als .docx en probeer opnieuw.');
  }

  if (ext === 'pptx') {
    const JSZip = await import('jszip');
    const zip = await JSZip.default.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] || '0');
        const nb = parseInt(b.match(/\d+/)?.[0] || '0');
        return na - nb;
      });
    const slideTexts = [];
    for (const slideFile of slideFiles) {
      const xml = await zip.files[slideFile].async('string');
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const slideText = matches.map((m) => m.replace(/<[^>]+>/g, '')).filter(Boolean).join(' ');
      if (slideText.trim()) slideTexts.push(slideText.trim());
    }
    return slideTexts.join('\n\n');
  }

  if (ext === 'ppt') {
    throw new Error('Oudere .ppt-bestanden worden niet ondersteund. Sla het bestand op als .pptx en probeer opnieuw.');
  }

  if (ext === 'csv') {
    return buffer.toString('utf-8');
  }

  if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.default.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      return `[${name}]\n` + XLSX.default.utils.sheet_to_csv(sheet);
    });
    return sheets.join('\n\n');
  }

  if (ext === 'txt') {
    return buffer.toString('utf-8');
  }

  if (ext === 'eml') {
    const raw = buffer.toString('utf-8');
    const sep = raw.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n';
    const bodyStart = raw.indexOf(sep);
    let text = bodyStart !== -1 ? raw.slice(bodyStart + sep.length) : raw;
    return text.replace(/--[a-zA-Z0-9_\-=]+/g, '').trim();
  }

  throw new Error('Bestandstype niet ondersteund.');
}
