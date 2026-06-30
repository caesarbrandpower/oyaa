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
  // Gekalibreerd op text-embedding-3-small: relevante NL-queries scoren ~0.6,
  // irrelevante zakelijke tekst ~0.37-0.40. 0.3 liet alles door.
  matchThreshold = 0.45,
  maxPerDocument = 2,
  maxDocuments = null,
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

  console.log('[VAULT-SCORES]', data.map(c => ({ doc: c.title, score: c.similarity?.toFixed(3) })));

  // Max N chunks per document, max M unieke documenten, relevantievolgorde behouden
  const perDoc = {};
  const selected = [];
  for (const row of data) {
    const docCount = Object.keys(perDoc).length;
    const isNewDoc = !perDoc[row.document_id];
    if (maxDocuments && isNewDoc && docCount >= maxDocuments) continue;
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

// Haalt alle chunks van één document op, gesorteerd op chunk_index.
// Gebruik dit als de gebruiker een volledige samenvatting vraagt.
export async function retrieveFullDocument({ tenantId, documentId }) {
  const supabase = createServiceClient();

  const { data: doc, error: docError } = await supabase
    .from('vault_documents')
    .select('id, title, source_type, client, project, created_at')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .single();
  if (docError) throw new Error(`volledig document ophalen mislukt: ${docError.message}`);
  if (!doc) return null;

  const { data: chunks, error: chunksError } = await supabase
    .from('vault_chunks')
    .select('chunk_index, content')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .order('chunk_index', { ascending: true });
  if (chunksError) throw new Error(`chunks ophalen mislukt: ${chunksError.message}`);
  if (!chunks?.length) return null;

  return {
    found: true,
    sources: chunks.map((c, i) => ({
      n: i + 1,
      documentId: doc.id,
      title: doc.title,
      sourceType: doc.source_type,
      client: doc.client,
      project: doc.project,
      createdAt: doc.created_at,
      content: c.content,
      similarity: 1.0,
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
