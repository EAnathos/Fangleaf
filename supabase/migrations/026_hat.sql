-- Fangleaf · migration 026 : les chapeaux du profil (HATS), purement décoratifs : celui qu'on porte (0 : tête nue)
-- et ceux qu'on a achetés (en or, une fois pour toutes). La couleur, elle, reste dans progress.seat (index dans
-- PLAYER_COLORS), désormais au choix du dompteur.

alter table public.progress add column if not exists hat integer not null default 0;
alter table public.progress add column if not exists hats integer[] not null default '{}';
