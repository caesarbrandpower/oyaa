-- supabase/migrations/004_threads_messages.sql

-- Threads tabel
create table public.threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  title text not null default 'Nieuw gesprek',
  output_type text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.threads enable row level security;

create policy "Users see own threads"
  on public.threads for select
  using (auth.uid() = user_id);

create policy "Users insert own threads"
  on public.threads for insert
  with check (auth.uid() = user_id);

create policy "Users update own threads"
  on public.threads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Messages tabel
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid not null references public.threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz default now() not null
);

alter table public.messages enable row level security;

create policy "Users see messages of own threads"
  on public.messages for select
  using (
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );

create policy "Users insert messages in own threads"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );

-- Indexes voor performance
create index on public.threads (user_id);
create index on public.messages (thread_id);

-- Chase tenant: enabled_output_types updaten naar object-formaat voor Custom
update public.tenants
set
  enabled_output_types = '[
    {"id": "meeting-summary", "label": "Vat een meeting samen", "icon": "file-text", "group": "documents"},
    {"id": "project-briefing", "label": "Maak een projectbriefing", "icon": "clipboard-list", "group": "documents"},
    {"id": "account-pm-briefing", "label": "Brief account naar PM", "icon": "pen-line", "group": "documents"},
    {"id": "evaluation", "label": "Schrijf een evaluatie", "icon": "bar-chart-2", "group": "documents"},
    {"id": "location-search", "label": "Zoek een locatie", "icon": "map-pin", "group": "search"},
    {"id": "supplier-search", "label": "Vraag de leverancierslijst op", "icon": "building-2", "group": "search"}
  ]'::jsonb
where hostname = 'chase.waybetter.nl';
