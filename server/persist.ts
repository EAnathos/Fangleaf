// Sauvegarde dans Supabase : villages (code + graine de la carte) et progression par (compte, village).
// Sans SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, personne ne peut se connecter (sauf ALLOW_GUESTS=1 en test)
// et les villages ne vivent qu'en mémoire.
//
// Le serveur est le seul à écrire (clé service_role) : le client ne peut pas modifier sa progression.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BuildingId } from '../shared/config.ts';

export interface Profile {
  name: string;
  gold: number;
  wood: number;
  stone: number;
  weapon: number;
  armor: number;
  essences: number[];
  alphas: { s: number; lvl: number; wakeAt?: number; legend?: boolean; rest?: boolean }[]; // rest : rangé à la Tanière // wakeAt : éveil en cours (horodatage ms)
  village_found: boolean; // village déjà découvert : on y apparaît directement
  class: string | null; // classe choisie à la forge
  pack: number[]; // meute ordinaire : espèce de chaque monstre apprivoisé
  seen: number[]; // espèces déjà croisées (bestiaire)
}

let db: SupabaseClient | null = null;

export function initPersistence() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, ''), key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Supabase non configuré : aucune connexion possible, villages en mémoire seulement.');
    return;
  }
  db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log('Supabase configuré : villages et progressions sauvegardés.');
}

export const persistenceEnabled = () => db !== null;

/** Vérifie le jeton de session envoyé par le client et renvoie l'utilisateur. */
export async function verifyToken(token: string): Promise<{ userId: string; name: string } | null> {
  if (!db || !token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  const meta = data.user.user_metadata ?? {};
  const name = String(meta.full_name ?? meta.name ?? data.user.email?.split('@')[0] ?? '');
  return { userId: data.user.id, name };
}

/** Biens communs d'un village : camps établis, bâtiments construits, grottes débloquées, Maison commune, géants vaincus. */
export interface VillageSave {
  camps: number[];
  buildings: BuildingId[];
  unlocked: number[];
  hall: number;
  beaten: number[];
  wood: number; // réserve commune
  stone: number;
}

/** Graine et biens communs d'un village enregistré, ou null s'il n'existe pas. */
export async function findVillage(code: string): Promise<({ seed: number; founder: string | null } & VillageSave) | null> {
  if (!db) return null;
  const { data, error } = await db.from('villages').select('seed, camps, buildings, caves, hall, beaten, wood, stone, created_by').eq('code', code).maybeSingle();
  if (error) throw new Error(`Lecture du village impossible : ${error.message}`);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return data
    ? {
      seed: Number(data.seed), camps: list(data.camps).map(Number), buildings: list(data.buildings), unlocked: list(data.caves).map(Number),
      hall: Number(data.hall ?? 0), beaten: list(data.beaten).map(Number), wood: Number(data.wood ?? 0), stone: Number(data.stone ?? 0),
      founder: data.created_by ?? null,
    }
    : null;
}

/** Supprime un village : la progression de tous ses membres part avec (on delete cascade). */
export async function deleteVillage(code: string) {
  if (!db) return;
  const { error } = await db.from('villages').delete().eq('code', code);
  if (error) throw new Error(`Suppression du village impossible : ${error.message}`);
}

/** Efface la progression d'un compte dans un village. */
export async function deleteProgress(userId: string, code: string) {
  if (!db) return;
  const { error } = await db.from('progress').delete().eq('user_id', userId).eq('village_code', code);
  if (error) throw new Error(`Effacement de la progression impossible : ${error.message}`);
}

/** Biens communs du village (partagés par tous ses membres). */
export async function saveVillage(code: string, v: VillageSave) {
  if (!db) return;
  const { error } = await db.from('villages').update({ camps: v.camps, buildings: v.buildings, caves: v.unlocked, hall: v.hall, beaten: v.beaten, wood: v.wood, stone: v.stone }).eq('code', code);
  if (error) console.error('Sauvegarde du village impossible :', error.message);
}

export async function createVillage(code: string, seed: number, userId: string | null) {
  if (!db) return;
  const { error } = await db.from('villages').insert({ code, seed, created_by: userId });
  if (error) throw new Error(`Création du village impossible : ${error.message}`);
}

export async function loadProgress(userId: string, code: string): Promise<Profile | null> {
  if (!db) return null;
  const { data, error } = await db
    .from('progress')
    .select('name, gold, wood, stone, weapon, armor, essences, alphas, village_found, class, pack, seen')
    .eq('user_id', userId)
    .eq('village_code', code)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la progression impossible : ${error.message}`);
  return data as Profile | null;
}

export async function saveProgress(userId: string, code: string, p: Profile) {
  if (!db) return;
  const { error } = await db
    .from('progress')
    .upsert({ user_id: userId, village_code: code, ...p, updated_at: new Date().toISOString() });
  if (error) console.error('Sauvegarde de la progression impossible :', error.message);
}
