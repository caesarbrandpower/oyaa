-- supabase/migrations/012_user_tenants.sql
-- Koppeltabel user <-> tenant. Basis voor harde RLS op de kluis.
-- Beheer (insert/update/delete) loopt uitsluitend via de service role.

create table public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (user_id, tenant_id)
);

alter table public.user_tenants enable row level security;

create policy "Users see own tenant memberships"
  on public.user_tenants for select
  using (auth.uid() = user_id);

-- Bewust geen insert/update/delete policies: alleen service role schrijft.
