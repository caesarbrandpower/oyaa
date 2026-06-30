// lib/vault/retrieve.js
// Semantisch zoeken in de kluis. Geeft expliciet found: false terug bij geen
// resultaten zodat de chat eerlijk kan zeggen dat de kluis niets heeft.

import { createServiceClient } from '../supabase-server';
import { stripContactPii } from './strip-contact-pii';
import { embedTexts } from './embeddings';

// Hoofdletterwoorden die geen merken of eigennamen zijn.
const NL_STOP_CAPS = new Set([
  'Wat', 'Hoe', 'Voor', 'Welk', 'Welke', 'Wanneer', 'Waar', 'Wie', 'Waarom',
  'Zijn', 'Was', 'Waren', 'Heeft', 'Had', 'Het', 'Een', 'Die', 'Dat', 'Dit',
  'Met', 'Van', 'Aan', 'Bij', 'Tot', 'Als', 'Ook', 'Niet', 'Meer', 'Wel',
  'Kan', 'Kun', 'Mag', 'Moet', 'Zou', 'Zal', 'Ons', 'Onze', 'Mijn', 'Jouw',
  'Door', 'Naar', 'Over', 'Uit', 'Per', 'Nog', 'Geen', 'Alle', 'Elke',
  'Toon', 'Geef', 'Maak', 'Zoek', 'Vind', 'Check', 'Test', 'Is', 'Den',
  'Der', 'Des', 'Ter', 'Ten', 'Deze', 'Hier', 'Daar', 'Mee', 'Dan', 'Nog',
  'Wil', 'Weet', 'Heb', 'Doe', 'Kom', 'Ga', 'Zie', 'Leg', 'Zet', 'Haal',
  'Wat', 'Graag', 'Even', 'Snel', 'Goed', 'Best', 'Heel', 'Veel',
]);

// Extraheert potentiële merknamen/eigennamen uit de query: woorden die
// met een hoofdletter beginnen (2+ tekens totaal) en niet in de stoplijst staan.
function extractQueryNames(query) {
  const matches = query.match(/\b[A-Z][a-zA-Z]{1,}\b/g) ?? [];
  return matches.filter(w => !NL_STOP_CAPS.has(w));
}

// Geeft true als een van de query-namen letterlijk (case-insensitief) in de
// documenttitel voorkomt.
function titleMatchesQuery(title, queryNames) {
  const lower = title.toLowerCase();
  return queryNames.some(n => lower.includes(n.toLowerCase()));
}

export async function retrieveVaultContext({
  tenantId,
  query,
  matchCount = 6,
  // RPC-drempel laag genoeg om naam-gematchte docs met iets lagere score
  // toch op te halen; post-filter beslist definitief over inclusie.
  matchThreshold = 0.45,
  maxPerDocument = 2,
  maxDocuments = null,
  broadQuery = false,
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

  // Naam-gebaseerde post-filter voor schaalbaarheid.
  // Brede meervoudsvragen (broadQuery=true): skip naam-filter, alle RPC-resultaten
  // komen door (matchThreshold al verlaagd door aanroeper).
  // Met een naam in de vraag: naam-gematchte docs bij ≥ 0.45; de rest bij ≥ 0.55.
  // Zonder naam (brede vraag zonder meervoud): semantische fallback bij ≥ 0.50.
  const queryNames = extractQueryNames(trimmed);
  const hasNameQuery = queryNames.length > 0;

  const THRESHOLD_NAMED_MATCH = 0.45;
  const THRESHOLD_NO_NAME_MATCH = 0.55;
  const THRESHOLD_FALLBACK = 0.50;

  const filtered = broadQuery
    ? data  // matchThreshold al verlaagd in RPC-aanroep; geen extra naam-filter
    : data.filter(row => {
        if (hasNameQuery) {
          return titleMatchesQuery(row.title, queryNames)
            ? row.similarity >= THRESHOLD_NAMED_MATCH
            : row.similarity >= THRESHOLD_NO_NAME_MATCH;
        }
        return row.similarity >= THRESHOLD_FALLBACK;
      });

  if (!filtered.length) return { found: false, sources: [] };

  // Max N chunks per document, max M unieke documenten, relevantievolgorde behouden
  const perDoc = {};
  const selected = [];
  for (const row of filtered) {
    const docCount = Object.keys(perDoc).length;
    const isNewDoc = !perDoc[row.document_id];
    if (maxDocuments && isNewDoc && docCount >= maxDocuments) continue;
    perDoc[row.document_id] = (perDoc[row.document_id] || 0) + 1;
    if (perDoc[row.document_id] <= maxPerDocument) selected.push(row);
  }

  return {
    found: selected.length > 0,
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
