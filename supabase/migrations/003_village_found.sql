-- Fangleaf · migration 003 : se souvenir que le joueur a découvert son village.
-- Une fois découvert, rejoindre le village fait apparaître directement au village (et plus au camp de départ).

alter table public.progress add column if not exists village_found boolean not null default false;
