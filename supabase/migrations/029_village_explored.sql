-- Fangleaf · migration 029 : carte explorée par le village, partagée par tous ses membres (shared/fog.ts, packFog).
-- Seul le serveur la lit et l'écrit (clé service_role) : pas de droit de lecture pour les comptes.

alter table public.villages add column if not exists explored text not null default '';
