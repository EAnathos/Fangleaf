// Connexion Google via Supabase (optionnelle).
// Sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, la connexion est impossible (et le module n'est pas chargé).

import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Dernier village où ce compte a joué (sa progression y est rattachée), ou null. */
export async function lastVillage(): Promise<string | null> {
  if (!authEnabled) return null;
  const { data, error } = await (await sb())
    .from('progress')
    .select('village_code')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return error || !data ? null : String(data.village_code);
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
