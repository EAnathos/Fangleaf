-- Fangleaf : table des profils joueurs (ancienne version, remplacée par migrations/002_villages.sql).
-- Appliquée par « npm run db:migrate ». Idempotente.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  gold        integer not null default 0,
  weapon      integer not null default 0,
  armor       integer not null default 0,
  essences    integer[] not null default '{}', -- une case par espèce (index de SPECIES)
  alphas      jsonb not null default '[]'::jsonb, -- [{ "s": espèce, "lvl": niveau }]
  updated_at  timestamptz not null default now()
);

-- Seul le serveur de jeu (clé service_role, qui contourne RLS) écrit.
-- Un joueur connecté peut seulement lire son propre profil.
alter table public.profiles enable row level security;

drop policy if exists "lecture de son profil" on public.profiles;
create policy "lecture de son profil" on public.profiles
  for select using (auth.uid() = id);
