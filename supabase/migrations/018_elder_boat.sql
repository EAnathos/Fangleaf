-- Fangleaf · migration 018 : les souvenirs du vieil homme et son bateau.
-- Chaque géant vaincu pour la première fois laisse un parchemin ; ramené au vieil homme, il lui rend un souvenir.
-- progress.scrolls : parchemins portés par le dompteur (géant de chacun), pas encore donnés.
-- villages.told : parchemins donnés, dans l'ordre ; boat : étapes du bateau achevées ; boat_at : fin de l'étape en cours (ms).

alter table public.progress add column if not exists scrolls integer[] not null default '{}';
alter table public.villages add column if not exists told jsonb not null default '[]'::jsonb;
alter table public.villages add column if not exists boat integer not null default 0;
alter table public.villages add column if not exists boat_at bigint not null default 0;
