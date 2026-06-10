// lib/vault/ingest.js
// Schrijft een document de kluis in: dedup op content-hash, chunken,
// contact-PII strippen voor de embedding-input, embedden, bulk insert.
// Draait altijd via de service role; tenant_id-discipline is hier verplicht.

import { createHash } from 'node:crypto';
import { createServiceClient } from '../supabase-server';
import { chunkText } from './chunk-text';
import { stripContactPii } from './strip-contact-pii';
import { embedTexts } from './embeddings';

export async function ingestDocument({
  tenantId,
  userId = null,
  threadId = null,
  title,
  sourceType,
  outputType = null,
  client = null,
  project = null,
  filePath = null,
  rawContent,
}) {
  if (!tenantId) throw new Error('ingestDocument: tenantId is verplicht');
  const content = (rawContent ?? '').trim();
  if (!content) return { documentId: null, skipped: true, reason: 'leeg' };

  const supabase = createServiceClient();
  const contentHash = createHash('sha256').update(content).digest('hex');

  // Dedup: hetzelfde bestand komt via de chat meerdere keren binnen
  // (analyse-pass plus generatie-pass, en PDF-bijlagen worden per beurt herstuurd)
  const { data: existing } = await supabase
    .from('vault_documents')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('content_hash', contentHash)
    .maybeSingle();
  if (existing) return { documentId: existing.id, skipped: true, reason: 'duplicaat' };

  const { data: doc, error: docError } = await supabase
    .from('vault_documents')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      thread_id: threadId,
      title,
      source_type: sourceType,
      output_type: outputType,
      client,
      project,
      file_path: filePath,
      content_hash: contentHash,
      raw_content: content,
    })
    .select('id')
    .single();
  if (docError) throw new Error(`vault_documents insert mislukt: ${docError.message}`);

  const chunks = chunkText(content);
  const embeddings = await embedTexts(chunks.map((c) => stripContactPii(c.content)));

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    tenant_id: tenantId,
    chunk_index: c.index,
    content: c.content,
    embedding: embeddings[i],
    token_count: c.tokenCount,
  }));
  const { error: chunkError } = await supabase.from('vault_chunks').insert(rows);
  if (chunkError) {
    // Geen halve documenten in de kluis: document terugdraaien als chunks falen
    await supabase.from('vault_documents').delete().eq('id', doc.id);
    throw new Error(`vault_chunks insert mislukt: ${chunkError.message}`);
  }

  return { documentId: doc.id, skipped: false, chunkCount: rows.length };
}
