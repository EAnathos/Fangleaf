-- Fangleaf · migration 020 : spécialisation retenue pour chaque classe (on la retrouve en revenant à la classe).

alter table public.progress add column if not exists specs jsonb not null default '{}'::jsonb;
