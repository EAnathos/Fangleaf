-- Fangleaf · migration 021 : les portes de zone s'ouvrent avec les parchemins rapportés à Aubin (told), plus avec
-- les seuls géants vaincus. Le lobby compte les zones découvertes à partir de told : il faut pouvoir le lire
-- (sinon la requête du lobby échoue et la liste « Tes villages » paraît vide).

grant select (told) on public.villages to authenticated;
