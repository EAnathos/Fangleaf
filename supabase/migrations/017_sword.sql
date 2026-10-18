-- Fangleaf · migration 017 : à l'arrivée sur l'île, l'épée est plantée dans le sable et il faut la déterrer.
-- Les dompteurs déjà enregistrés l'ont (true) ; le serveur crée les nouveaux sans (false).

alter table public.progress add column if not exists armed boolean not null default true;
