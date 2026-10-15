-- Fangleaf · migration 013 : statistiques de chaque dompteur dans son village (tableau du village).
-- stats : { "bosses": géants vaincus, "tamed": monstres apprivoisés, "given": bois et pierre donnés à l'entrepôt }.

alter table public.progress add column if not exists stats jsonb not null default '{}'::jsonb;
