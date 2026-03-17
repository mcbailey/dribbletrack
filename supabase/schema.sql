create extension if not exists pgcrypto;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  practiced_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (player_id, practiced_on)
);

alter table public.players enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "Public can read players" on public.players;
create policy "Public can read players"
  on public.players
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can add players" on public.players;
create policy "Public can add players"
  on public.players
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can read sessions" on public.sessions;
create policy "Public can read sessions"
  on public.sessions
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can add sessions" on public.sessions;
create policy "Public can add sessions"
  on public.sessions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can update sessions" on public.sessions;
create policy "Public can update sessions"
  on public.sessions
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "Public can delete sessions" on public.sessions;
create policy "Public can delete sessions"
  on public.sessions
  for delete
  to anon, authenticated
  using (true);
