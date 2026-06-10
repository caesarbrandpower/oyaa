// lib/vault/embeddings.js
// OpenAI text-embedding-3-small (1536 dim, $0,02 per miljoen tokens).
// OpenAI is al sub-processor via Whisper; embedding-input is gestript van
// contact-PII door de aanroeper (zie strip-contact-pii.js).

import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;

export async function embedTexts(texts) {
  if (!texts.length) return [];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embeddings = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    const ordered = [...resp.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map((d) => d.embedding));
  }
  return embeddings;
}
