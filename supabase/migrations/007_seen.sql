-- Fangleaf · migration 007 : bestiaire de la Tanière — espèces déjà croisées par ce compte dans ce village.
-- Liste d'index d'espèces : [0, 4, 1, …] (les géants n'y figurent pas).

alter table public.progress add column if not exists seen jsonb not null default '[]'::jsonb;
