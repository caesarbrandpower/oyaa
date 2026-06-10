-- supabase/migrations/014_vault.sql
-- De kluis: kennisbank per tenant met semantisch zoeken (pgvector).
-- Opslag is ruw (consistent met de messages-tabel); anonimisering gebeurt
-- aan de providergrens, niet bij opslag.

create extension if not exists vector;

create table public.vault_documents (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  thread_id uuid references public.threads(id) on delete set null,
  title text not null,
  source_type text not null check (source_type in ('upload', 'generated')),
  output_type text,
  client text,
  project text,
  file_path text,
  content_hash text not null,
  raw_content text not null,
  created_at timestamptz default now() not null,
  unique (tenant_id, content_hash)
);

create table public.vault_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid not null references public.vault_documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536) not null,
  token_count int,
  created_at timestamptz default now() not null
);

create index vault_documents_tenant_idx on public.vault_documents (tenant_id);
create index vault_chunks_tenant_idx on public.vault_chunks (tenant_id);
create index vault_chunks_document_idx on public.vault_chunks (document_id);
create index vault_chunks_embedding_idx on public.vault_chunks
  using hnsw (embedding vector_cosine_ops);

alter table public.vault_documents enable row level security;
alter table public.vault_chunks enable row level security;

-- Lezen: alleen leden van de tenant. Schrijven: alleen service role (geen policies).
create policy "Tenant members read vault documents"
  on public.vault_documents for select
  using (tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid()));

create policy "Tenant members read vault chunks"
  on public.vault_chunks for select
  using (tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid()));

-- Semantisch zoeken: chunks gejoind met document-metadata, altijd binnen 1 tenant.
create or replace function public.match_vault_chunks(
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
as $$
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
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Private bucket voor kluis-uploads (binaries). Service role only.
insert into storage.buckets (id, name, public)
values ('vault', 'vault', false)
on conflict (id) do nothing;
