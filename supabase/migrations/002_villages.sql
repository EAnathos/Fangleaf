-- Fangleaf · migration 002 : villages persistants et progression par (compte, village).
-- Appliquée par « npm run db:migrate » (ou à coller dans Supabase › SQL Editor, après 001).
--
-- Un village garde son code et sa graine (donc sa carte) : on peut y revenir plus tard.
-- La progression (or, équipement, essences, Alphas) appartient à un compte DANS un village :
-- rejoindre un autre village, c'est repartir de zéro là-bas.

create table if not exists public.villages (
  code        text primary key,
  seed        bigint not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  village_code  text not null references public.villages (code) on delete cascade,
  name          text not null default '',
  gold          integer not null default 0,
  weapon        integer not null default 0,
  armor         integer not null default 0,
  essences      integer[] not null default '{}',
  alphas        jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  primary key (user_id, village_code)
);

-- Seul le serveur de jeu (clé service_role) écrit. Un joueur peut lire sa propre progression
-- (le lobby s'en sert pour proposer de revenir dans son village).
alter table public.villages enable row level security;
alter table public.progress enable row level security;

drop policy if exists "lecture de sa progression" on public.progress;
create policy "lecture de sa progression" on public.progress
  for select using (auth.uid() = user_id);

-- L'ancienne table profiles (progression globale au compte) n'est plus utilisée.
