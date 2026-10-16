-- Fangleaf · migration 015 : torche et bottes achetées à la forge (niveau 0 : rien).

alter table public.progress add column if not exists torch integer not null default 0;
alter table public.progress add column if not exists boots integer not null default 0;
