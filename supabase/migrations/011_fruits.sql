-- Fangleaf · migration 011 : baies cueillies aux buissons (pour apprivoiser), dans le sac du dompteur.

alter table public.progress add column if not exists fruits integer not null default 0;
