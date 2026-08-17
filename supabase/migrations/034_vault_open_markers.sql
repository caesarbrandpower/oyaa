-- supabase/migrations/034_vault_open_markers.sql
-- Voegt open_markers_count toe aan vault_documents en filtert de match-RPC.
-- Documenten met openstaande markeringen ([UITZOEKEN INTERN], [AFSTEMMEN MET KLANT],
-- [CIJFERS TOEVOEGEN], [CHECK: ...]) worden als geheel uitgesloten van retrieval,
-- ook chunks die zelf geen markering bevatten.

ALTER TABLE public.vault_documents
  ADD COLUMN IF NOT EXISTS open_markers_count integer NOT NULL DEFAULT 0;

-- Herschrijf match_vault_chunks met filter op open documenten.
-- Identical aan de definitie in 018_vault.sql, met toevoeging van
-- AND d.open_markers_count = 0 in de inner query.
CREATE OR REPLACE FUNCTION public.match_vault_chunks(
  query_embedding vector(1536),
  match_tenant_id uuid,
  match_count int default 8,
  match_threshold float default 0.3
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  source_type text,
  client text,
  project text,
  created_at timestamptz,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
set search_path = public
as $$
  select * from (
    select
      c.id as chunk_id,
      d.id as document_id,
      d.title,
      d.source_type,
      d.client,
      d.project,
      d.created_at,
      c.chunk_index,
      c.content,
      1 - (c.embedding <=> query_embedding) as similarity
    from public.vault_chunks c
    join public.vault_documents d on d.id = c.document_id
    where c.tenant_id = match_tenant_id
      and d.open_markers_count = 0
    order by c.embedding <=> query_embedding
    limit match_count
  ) ranked
  where ranked.similarity > match_threshold;
$$;

-- Eenmalige backfill: tel openstaande markeringen in bestaande documenten.
UPDATE public.vault_documents
SET open_markers_count = (
  SELECT COUNT(*)
  FROM regexp_matches(
    COALESCE(raw_content, ''),
    '\[(UITZOEKEN INTERN|AFSTEMMEN MET KLANT|CIJFERS TOEVOEGEN|CHECK:[^\]]*)\]',
    'g'
  )
);
