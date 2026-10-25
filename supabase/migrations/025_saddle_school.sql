-- Fangleaf · migration 025 : la selle, achetée à la forge (niveau 0 : aucune, on ne monte pas sur ses Alphas),
-- et l'École des dompteurs, désormais au village : son plan, trouvé dans un coffre du Camp avancé, puis bâtie par Aubin
-- (fin du chantier en cours, horodatage ms ; 0 : aucun).

alter table public.progress add column if not exists saddle integer not null default 0;
alter table public.villages add column if not exists school_plan boolean not null default false;
alter table public.villages add column if not exists school_at bigint not null default 0;
