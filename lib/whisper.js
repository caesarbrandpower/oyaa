import { AzureOpenAI } from 'openai';

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

function createClient() {
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2024-05-01-preview',
    deployment: process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper',
  });
}

export async function transcribeAudio(file) {
  const client = createClient();
  const deployment = process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT ?? 'whisper';
  const result = await client.audio.transcriptions.create({
    file,
    model: deployment,
    language: 'nl',
  });
  return filterHallucinations(result.text);
}
