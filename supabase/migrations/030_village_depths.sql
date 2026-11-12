-- Fangleaf · migration 030 : salles découvertes du donjon du volcan, partagées par tous les membres du village
-- (index des salles, shared/fog.ts revealRooms). Avant, chaque joueur les oubliait en rechargeant la page.
-- Seul le serveur la lit et l'écrit (clé service_role) : pas de droit de lecture pour les comptes.

alter table public.villages add column if not exists depths jsonb not null default '[]'::jsonb;
