-- Fangleaf · migration 006 : camps établis par un village le long du couloir (index des emplacements de la carte), partagés par ses membres.
alter table public.villages add column if not exists camps jsonb not null default '[]'::jsonb;
