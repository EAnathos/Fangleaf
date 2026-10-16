-- Fangleaf · migration 014 : le lobby montre, pour chacun de ses villages, combien de zones sont découvertes.
-- Un joueur peut lire, des seuls villages où il a une progression, le niveau de l'Hôtel de ville et les géants
-- vaincus (de quoi savoir quelles portes de zone sont ouvertes). Rien d'autre (graine, bannis…) n'est lisible.

revoke select on public.villages from anon, authenticated;
grant select (code, hall, beaten) on public.villages to authenticated;

drop policy if exists "lecture de ses villages" on public.villages;
create policy "lecture de ses villages" on public.villages
  for select to authenticated
  using (exists (select 1 from public.progress p where p.village_code = villages.code and p.user_id = auth.uid()));
