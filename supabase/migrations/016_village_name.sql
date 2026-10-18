-- Fangleaf · migration 016 : nom du village, choisi en construisant l'Hôtel de ville (affiché dans « Mes villages »).

alter table public.villages add column if not exists name text not null default '';
grant select (name) on public.villages to authenticated;
