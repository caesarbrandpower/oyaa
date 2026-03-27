-- Projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  client_name text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.projects enable row level security;

-- Users can only see their own projects
create policy "Users can view own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Outputs table
create table public.outputs (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  output_type text not null,
  input_transcript text not null,
  result text not null,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.outputs enable row level security;

-- Users can only see outputs of their own projects
create policy "Users can view own outputs"
  on public.outputs for select
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Users can insert outputs to own projects"
  on public.outputs for insert
  with check (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );
