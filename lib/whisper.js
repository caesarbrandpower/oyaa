import { BatchClient } from '@speechmatics/batch-client';
import { createServiceClient } from '@/lib/supabase-server';

// EU-endpoint — data wordt verwerkt in de EU
const EU_ENDPOINT = 'https://eu1.asr.api.speechmatics.com';

// Speechmatics-batchjob mag 4,5 minuten duren — binnen de 300s Vercel-limiet
const TIMEOUT_MS = 270_000;

// ── Hallucination filter (zelfde patronen als voorheen, vangnet) ────────────

const HALLUCINATION_PATTERNS = [
  /ondertiteld door de amara\.org[- ]gemeenschap/i,
  /ondertitels ingediend door/i,
  /subtitles by the amara\.org community/i,
  /thanks for watching/i,
  /like and subscribe/i,
  /please subscribe/i,
  /transcription by eso\.?\s*translated by/i,
  /dutch subtitles by/i,
  /tv\s*gelderland/i,
  /omroep\s*gelderland/i,
  /nos\s*journaal/i,
  /ondertiteling\s*[:\-]?\s*npo/i,
  /ondertiteld\s*door/i,
  /ondertitels\s*door/i,
  /vertaald\s*door/i,
  /redactie\s*nederland/i,
  /made\s*by\s*[:\-]?\s*tv/i,
];

function normalizeLine(line) {
  return line.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function filterHallucinations(text) {
  if (!text) return text;
  const rawLines = text.split('\n');
  const filtered = [];
  for (const line of rawLines) {
    const t = line.trim();
    if (!t) continue;
    if (HALLUCINATION_PATTERNS.some((re) => re.test(t))) continue;
    const norm = normalizeLine(t);
    if (filtered.length > 0 && norm === normalizeLine(filtered[filtered.length - 1])) continue;
    filtered.push(t);
  }
  const deduped = [];
  for (let i = 0; i < filtered.length; i++) {
    if (i > 0 && normalizeLine(filtered[i]) === normalizeLine(filtered[i - 1])) continue;
    deduped.push(filtered[i]);
  }
  return deduped.join('\n').trim();
}

// ── Transcript formattering met sprekerscheiding ───────────────────────────

function formatTranscript(results) {
  if (!results?.length) return '';

  const segments = [];
  let current = null;

  for (const item of results) {
    const alt = item.alternatives?.[0];
    if (!alt) continue;

    if (item.type === 'word') {
      const speaker = alt.speaker || 'UU';
      if (!current || current.speaker !== speaker) {
        current = { speaker, parts: [] };
        segments.push(current);
      }
      current.parts.push({ text: alt.content, punct: false });
    } else if (item.type === 'punctuation' && current) {
      // Punctuatie wordt aan het laatste woord vastgeplakt (geen spatie)
      current.parts.push({ text: alt.content, punct: true });
    }
  }

  return segments
    .map(({ speaker, parts }) => {
      let line = '';
      for (const { text, punct } of parts) {
        line += punct ? text : (line ? ' ' : '') + text;
      }
      return `${speaker}: ${line.trim()}`;
    })
    .join('\n\n');
}

// ── Custom vocabulary: locaties uit DB + tenant-specifieke termen ──────────

export async function buildVocabList(tenantId) {
  if (!tenantId) return [];

  const supabase = createServiceClient();

  const [locResult, tenantResult] = await Promise.all([
    supabase.from('locations').select('naam').eq('tenant_id', tenantId),
    supabase.from('tenants').select('tenant_config').eq('id', tenantId).single(),
  ]);

  const locationNames = (locResult.data || []).map((l) => ({ content: l.naam }));

  const configVocab = (tenantResult.data?.tenant_config?.transcription_vocab || []).map(
    (term) => ({ content: term })
  );

  // Dedupliceer op inhoud
  const seen = new Set();
  return [...locationNames, ...configVocab].filter(({ content }) => {
    if (seen.has(content)) return false;
    seen.add(content);
    return true;
  });
}

// ── Speechmatics (primair) ──────────────────────────────────────────────────

export async function transcribeAudio(file, { tenantId } = {}) {
  const client = new BatchClient({
    apiKey: process.env.SM_API_KEY,
    apiUrl: EU_ENDPOINT,
  });

  const additionalVocab = await buildVocabList(tenantId);

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await client.transcribe(
    { data: buffer, fileName: file.name || 'recording.m4a' },
    {
      transcription_config: {
        language: 'nl',
        model: 'enhanced',
        diarization: 'speaker',
        ...(additionalVocab.length > 0 ? { additional_vocab: additionalVocab } : {}),
      },
    },
    'json-v2',
    TIMEOUT_MS
  );

  return filterHallucinations(formatTranscript(result.results));
}

// ── OpenAI Whisper (vergelijkingstool — niet voor productie) ───────────────
// Gebruik: POST /api/compare-transcription met audiobestand

export async function transcribeAudioOpenAI(file) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const result = await client.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'nl',
  });
  return filterHallucinations(result.text);
}
