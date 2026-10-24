-- Fangleaf · migration 024 : la place de chaque membre dans son village (0 à 3), qui décide de sa couleur.
-- Elle ne dépend plus de qui est connecté : un dompteur garde sa couleur d'une partie à l'autre.

alter table public.progress add column if not exists seat integer;
