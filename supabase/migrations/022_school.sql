-- Fangleaf · migration 022 : l'École des dompteurs, au Camp avancé.
-- Les coffres des géants lâchent parfois un livre d'apprentissage ; lu à l'école, il apprend une leçon de sa discipline.
-- progress.tomes : livres dans le sac (discipline × tome) ; learned : leçons apprises, par discipline ;
-- read_at : fin de la leçon en cours (ms, 0 : aucune) ; read_kind : sa discipline.

alter table public.progress add column if not exists tomes integer[] not null default '{}';
alter table public.progress add column if not exists learned integer[] not null default '{}';
alter table public.progress add column if not exists read_at bigint not null default 0;
alter table public.progress add column if not exists read_kind integer not null default 0;
