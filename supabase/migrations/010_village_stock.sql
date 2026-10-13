-- Fangleaf · migration 010 : réserve commune de bois et de pierre (entrepôt du village).
-- Les dompteurs récoltent dans leur sac (progress.wood / progress.stone) puis déposent à l'entrepôt ;
-- constructions et Maison commune puisent dans cette réserve.

alter table public.villages add column if not exists wood integer not null default 0;
alter table public.villages add column if not exists stone integer not null default 0;
