-- Fangleaf · migration 023 : le cœur volcanique, au centre des entrailles du volcan (Mer de sable).
-- Une fois vaincus les trois géants qui y vivent, on le prend (1), puis on l'installe dans le bateau rebâti (2) :
-- dernière étape avant de prendre la mer. Une fois pour tout le village.

alter table public.villages add column if not exists heart smallint not null default 0;
