-- Fangleaf · migration 009 : bois et pierre des dompteurs ; Maison commune et géants vaincus du village.
-- hall : niveau de la Maison commune (elle ouvre les portes des zones et autorise certains bâtiments).
-- beaten : espèces des géants déjà vaincus par le village (tous ceux d'une zone ouvrent la porte de la suivante).
-- Les villages existants démarrent au niveau 2 : porte du village ouverte, Tanière autorisée.

alter table public.progress add column if not exists wood integer not null default 0;
alter table public.progress add column if not exists stone integer not null default 0;

alter table public.villages add column if not exists hall integer;
update public.villages set hall = 2 where hall is null;
alter table public.villages alter column hall set default 0;
alter table public.villages alter column hall set not null;

alter table public.villages add column if not exists beaten jsonb not null default '[]'::jsonb;
