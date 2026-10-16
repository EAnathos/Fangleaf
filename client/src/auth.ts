// Connexion Google via Supabase (optionnelle).
// Sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, la connexion est impossible (et le module n'est pas chargé).

import type { SupabaseClient } from '@supabase/supabase-js';
import { zonesOpen } from '../../shared/config.ts';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const authEnabled = !!(URL && KEY);
let client: Promise<SupabaseClient> | null = null;

function sb() {
  if (!authEnabled) throw new Error('Supabase non configuré');
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL!, KEY!));
  return client;
}

export interface Account {
  name: string;
  token: string;
}

/** Session courante (rafraîchie si besoin), ou null si non connecté. */
export async function currentAccount(): Promise<Account | null> {
  if (!authEnabled) return null;
  const { data } = await (await sb()).auth.getSession();
  const s = data.session;
  if (!s) return null;
  const meta = s.user.user_metadata ?? {};
  return { name: String(meta.full_name ?? meta.name ?? s.user.email ?? ''), token: s.access_token };
}

/** Un village où ce compte a une progression. */
export interface MyVillage {
  code: string;
  name: string; // nom du dompteur dans ce village
  zones: number; // zones découvertes par le village (1 à ZONES)
  updated: Date; // dernière partie
}

/** Villages où ce compte a joué (sa progression y est rattachée), du plus récent au plus ancien. */
export async function myVillages(): Promise<MyVillage[]> {
  if (!authEnabled) return [];
  const { data, error } = await (await sb())
    .from('progress')
    .select('village_code, name, updated_at, villages(hall, beaten)')
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return data.map((d) => {
    const v = (Array.isArray(d.villages) ? d.villages[0] : d.villages) as { hall?: number; beaten?: number[] } | null;
    return { code: String(d.village_code), name: String(d.name ?? ''), zones: zonesOpen(Number(v?.hall ?? 0), (v?.beaten ?? []).map(Number)), updated: new Date(d.updated_at) };
  });
}

export async function signInWithGoogle() {
  // Revient sur la même page (garde ?v=CODE d'une invitation).
  await (await sb()).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname + location.search },
  });
}

export async function signOut() {
  await (await sb()).auth.signOut();
}
