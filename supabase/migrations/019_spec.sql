-- Fangleaf · migration 019 : spécialisation de l'arme (choisie à la Grande forge, au-delà du niveau 10), par village.

alter table public.progress add column if not exists spec text;
