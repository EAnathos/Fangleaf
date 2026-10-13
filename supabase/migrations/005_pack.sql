-- Fangleaf · migration 005 : la meute ordinaire (monstres apprivoisés) est sauvegardée avec la progression.
-- Liste des espèces : [0, 0, 5, …]. Elle se vide à la mort du dompteur (la meute se disperse).

alter table public.progress add column if not exists pack jsonb not null default '[]'::jsonb;
