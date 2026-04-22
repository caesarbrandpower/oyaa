import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase-server';

export const maxDuration = 300;

const HALLUCINATION_PATTERNS = [
  // Amara.org ondertitels
  /ondertiteld door de amara\.org[- ]gemeenschap/i,
  /ondertitels ingediend door/i,
  /subtitles by the amara\.org community/i,
  // YouTube engagement
  /thanks for watching/i,
  /like and subscribe/i,
  /please subscribe/i,
  // ESO / vertaaldiensten
  /transcription by eso\.?\s*translated by/i,
  /dutch subtitles by/i,
  // Nederlandse regionale en publieke omroepen
  /tv\s*gelderland/i,
  /omroep\s*gelderland/i,
  /nos\s*journaal/i,
  // NPO ondertiteling
  /ondertiteling\s*[:\-]?\s*npo/i,
  /ondertiteld\s*door/i,
  /ondertitels\s*door/i,
  // Generieke credits
  /vertaald\s*door/i,
  /redactie\s*nederland/i,
  /made\s*by\s*[:\-]?\s*tv/i,
];

// Normalize a line for comparison: lowercase, collapse whitespace, strip punctuation
function normalizeLine(line) {
  return line.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function filterHallucinations(text) {
  if (!text) return text;

  const rawLines = text.split('\n');
  const filtered = [];

  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (!t) continue;

    // Pattern-based filter
    if (HALLUCINATION_PATTERNS.some((re) => re.test(t))) continue;

    // Repetition filter: skip if this line appeared in the previous non-empty line
    const norm = normalizeLine(t);
    if (filtered.length > 0) {
      const prevNorm = normalizeLine(filtered[filtered.length - 1]);
      if (norm === prevNorm) continue;
    }

    filtered.push(t);
  }

  // Second pass: remove any line that appears 2+ consecutive times in the result
  const deduped = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i > 0 && normalizeLine(filtered[i]) === normalizeLine(filtered[i - 1])) continue;
    deduped.push(filtered[i]);
  }

  return deduped.join('\n').trim();
}

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
  'audio/x-m4a', 'audio/wav', 'audio/wave', 'audio/ogg',
  'audio/webm', 'video/mp4', 'video/webm',
];
const ALLOWED_EXTS = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.webm'];
const MAX_DIRECT_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return handleStoragePath(request);
  }
  return handleDirectUpload(request);
}

// ── Storage path (chunked file uploads) ────────────────────────────────────

async function handleStoragePath(request) {
  let storagePath;
  try {
    const body = await request.json();
    storagePath = body.storagePath;
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!storagePath || typeof storagePath !== 'string') {
    return Response.json({ error: 'Geen storagePath ontvangen.' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Download chunk from Supabase Storage
  let fileBlob;
  try {
    const { data, error } = await supabase.storage
      .from('audio-temp')
      .download(storagePath);
    if (error) throw error;
    fileBlob = data;
  } catch (err) {
    console.error('Storage download error:', err);
    return Response.json(
      { error: 'Kon het audiobestand niet ophalen. Probeer opnieuw.' },
      { status: 502 }
    );
  }

  // Send to Whisper
  let transcript;
  try {
    const file = new File([fileBlob], 'chunk.wav', { type: 'audio/wav' });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'nl',
    });
    transcript = filterHallucinations(result.text);
  } catch (err) {
    console.error('Whisper error:', err);
    // Best-effort cleanup before returning error
    await supabase.storage.from('audio-temp').remove([storagePath]).catch(() => {});
    return Response.json(
      { error: 'Er is een fout bij OpenAI. Probeer het opnieuw.' },
      { status: 502 }
    );
  }

  // Clean up temp file
  await supabase.storage.from('audio-temp').remove([storagePath]).catch((err) => {
    console.error('Storage cleanup error (non-fatal):', err);
  });

  return Response.json({ transcript });
}

// ── Direct upload (fast path for live recordings) ──────────────────────────

async function handleDirectUpload(request) {
  let file;
  try {
    const formData = await request.formData();
    file = formData.get('file');
  } catch {
    return Response.json({ error: 'Ongeldig verzoek.' }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: 'Geen audiobestand ontvangen.' }, { status: 400 });
  }

  if (file.size > MAX_DIRECT_SIZE) {
    return Response.json(
      { error: 'Bestand is te groot. Maximum is 25MB voor directe upload.' },
      { status: 400 }
    );
  }

  const name = file.name?.toLowerCase() || '';
  const ext = name.slice(name.lastIndexOf('.'));
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) {
    return Response.json(
      { error: `Bestandstype "${ext || file.type}" wordt niet ondersteund.` },
      { status: 400 }
    );
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'nl',
    });
    return Response.json({ transcript: filterHallucinations(result.text) });
  } catch (err) {
    console.error('Whisper error (direct upload):', err);
    return Response.json(
      { error: 'Er is een fout bij OpenAI. Probeer het opnieuw.' },
      { status: 502 }
    );
  }
}
