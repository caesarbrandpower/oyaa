// lib/vault/retrieve.js
// Semantisch zoeken in de kluis. Geeft expliciet found: false terug bij geen
// resultaten zodat de chat eerlijk kan zeggen dat de kluis niets heeft.

import { createServiceClient } from '../supabase-server';
import { stripContactPii } from './strip-contact-pii';
import { embedTexts } from './embeddings';

export async function retrieveVaultContext({
  tenantId,
  query,
  matchCount = 8,
  matchThreshold = 0.3,
  maxPerDocument = 2,
}) {
  const trimmed = (query ?? '').trim();
  if (!tenantId || !trimmed) return { found: false, sources: [] };

  const [embedding] = await embedTexts([stripContactPii(trimmed)]);

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('match_vault_chunks', {
    query_embedding: embedding,
    match_tenant_id: tenantId,
    match_count: matchCount,
    match_threshold: matchThreshold,
  });
  if (error) throw new Error(`match_vault_chunks mislukt: ${error.message}`);
  if (!data?.length) return { found: false, sources: [] };

  // Max N chunks per document, relevantievolgorde behouden
  const perDoc = {};
  const selected = [];
  for (const row of data) {
    perDoc[row.document_id] = (perDoc[row.document_id] || 0) + 1;
    if (perDoc[row.document_id] <= maxPerDocument) selected.push(row);
  }

  return {
    found: true,
    sources: selected.map((row, i) => ({
      n: i + 1,
      documentId: row.document_id,
      title: row.title,
      sourceType: row.source_type,
      client: row.client,
      project: row.project,
      createdAt: row.created_at,
      content: row.content,
      similarity: row.similarity,
    })),
  };
}

// Bouwt het genummerde bronnenblok voor de system prompt.
// Let op: aanroeper geeft de GEANONIMISEERDE sources door (gedeelde request-map).
export function formatVaultBlock(sources) {
  return sources
    .map((s) => {
      const meta = [
        s.client,
        s.project,
        s.createdAt ? new Date(s.createdAt).toLocaleDateString('nl-NL') : null,
      ].filter(Boolean).join(', ');
      return `[Bron ${s.n}] ${s.title}${meta ? ` (${meta})` : ''}\n${s.content}`;
    })
    .join('\n\n');
}
