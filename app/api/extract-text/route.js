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
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '';
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const pdf = await loadingTask.promise;
      const pageTexts = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pageTexts.push(content.items.map((item) => item.str).join(' '));
      }
      text = pageTexts.join('\n\n');
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth');
      const result = await mammoth.default.extractRawText({ buffer });
      text = result.value;
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
    return Response.json({ error: 'Kon bestand niet uitlezen.' }, { status: 500 });
  }
}
