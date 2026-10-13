-- Fangleaf · migration 004 : classe du dompteur (guerrier, archer, mage), choisie à la forge, par village.

alter table public.progress add column if not exists class text;
