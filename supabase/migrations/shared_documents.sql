create table if not exists shared_documents (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  content text not null,
  output_type text,
  title text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- Public read (no auth required for shared links)
alter table shared_documents enable row level security;

create policy "Public read shared documents" on shared_documents
  for select using (true);

create policy "Auth users can insert shared documents" on shared_documents
  for insert with check (auth.role() = 'authenticated');
