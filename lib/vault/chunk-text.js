// lib/vault/chunk-text.js
// Chunkt tekst op alineagrenzen tot ~maxTokens, met overlap uit de staart
// van de vorige chunk. Tokenschatting: 1 token is ongeveer 4 tekens (geen
// tokenizer-dependency nodig; embeddings zijn niet gevoelig voor een ruwe schatting).

const CHARS_PER_TOKEN = 4;

export function chunkText(text, { maxTokens = 800, overlapTokens = 100 } = {}) {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  // Normaliseer naar alinea's; hak te lange alinea's eerst op zinsgrens kapot
  const parts = [];
  for (const para of (text ?? '').split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (trimmed.length <= maxChars) {
      parts.push(trimmed);
      continue;
    }
    let rest = trimmed;
    while (rest.length > maxChars) {
      const slice = rest.slice(0, maxChars);
      const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
      const end = cut > maxChars / 2 ? cut + 1 : maxChars;
      parts.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trim();
    }
    if (rest) parts.push(rest);
  }

  // Stapel alinea's tot chunks; nieuwe chunk begint met de staart van de vorige
  const chunks = [];
  let current = '';
  for (const part of parts) {
    if (current && current.length + 2 + part.length > maxChars) {
      chunks.push(current);
      current = `${current.slice(-overlapChars)}\n\n${part}`;
    } else {
      current = current ? `${current}\n\n${part}` : part;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((content, index) => ({
    index,
    content,
    tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN),
  }));
}
