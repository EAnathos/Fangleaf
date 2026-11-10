-- Fangleaf · migration 028 : victoires de chaque dompteur sur chaque géant (par espèce), pour les essences qu'il donne.
-- Les noms donnés aux Alphas, eux, vivent dans la colonne alphas (jsonb) : pas de colonne à ajouter.

alter table public.progress add column if not exists boss_wins jsonb not null default '[]'::jsonb;
