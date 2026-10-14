-- Fangleaf · migration 012 : l'Hôtel de ville perd son niveau « Tanière » (6 → 5 niveaux), bannissements.
-- Les villages au-delà du niveau 1 descendent d'un niveau : ils gardent exactement les mêmes portes ouvertes.
-- banned : comptes expulsés par le fondateur ([{ "id": "<user id>", "name": "…" }]) ; leur progression reste en base.

update public.villages set hall = hall - 1 where hall >= 2;

alter table public.villages add column if not exists banned jsonb not null default '[]'::jsonb;
