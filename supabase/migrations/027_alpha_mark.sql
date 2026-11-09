-- Fangleaf · migration 027 : l'espèce d'Alpha marquée (barre d'essence dans le HUD), -1 : aucune.

alter table public.progress add column if not exists alpha_mark integer not null default -1;
