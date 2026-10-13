-- Fangleaf · migration 008 : bâtiments du village (achetés avec de l'or) et grottes débloquées, partagés par ses membres.
-- buildings : ["forge", "den", "market", "stone"] ; caves : index des grottes débloquées [0, 3, …].
-- Les villages existants gardent la forge, la tanière et la Pierre de passage qu'ils avaient déjà (le marché est nouveau).

alter table public.villages add column if not exists buildings jsonb;
update public.villages set buildings = '["forge", "den", "stone"]'::jsonb where buildings is null;
alter table public.villages alter column buildings set default '[]'::jsonb;
alter table public.villages alter column buildings set not null;

alter table public.villages add column if not exists caves jsonb not null default '[]'::jsonb;
