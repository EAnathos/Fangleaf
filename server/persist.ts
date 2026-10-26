// Sauvegarde dans Supabase : villages (code + graine de la carte) et progression par (compte, village).
// Sans SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, personne ne peut se connecter (sauf ALLOW_GUESTS=1 en test)
// et les villages ne vivent qu'en mémoire.
//
// Le serveur est le seul à écrire (clé service_role) : le client ne peut pas modifier sa progression.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BuildingId } from '../shared/config.ts';
import type { Stats } from '../shared/protocol.ts';

export interface Profile {
  name: string;
  gold: number;
  wood: number;
  stone: number;
  fruits: number; // baies dans le sac
  weapon: number;
  armor: number;
  torch?: number; // 0 : pas de torche (absent dans les sauvegardes d'avant la migration 015)
  boots?: number;
  saddle?: number; // selle (0 : aucune, on ne monte pas sur ses Alphas) ; absente avant la migration 025
  scrolls?: number[]; // parchemins portés (géant de chacun), pas encore donnés au vieil homme
  armed?: boolean; // épée déterrée (absent dans les sauvegardes d'avant la migration 017 : armé)
  essences: number[];
  alphas: { s: number; lvl: number; wakeAt?: number; legend?: boolean; rest?: boolean }[]; // rest : rangé à la Tanière // wakeAt : éveil en cours (horodatage ms)
  village_found: boolean; // village déjà découvert : on y apparaît directement
  class: string | null; // classe choisie à la forge
  spec?: string | null; // spécialisation de l'arme (Grande forge ; absente avant la migration 019)
  specs?: Record<string, string>; // spécialisation déjà prise pour chaque classe (migration 020)
  pack: number[]; // meute ordinaire : espèce de chaque monstre apprivoisé
  seen: number[]; // espèces déjà croisées (bestiaire)
  stats?: Partial<Stats>; // tableau du village : géants battus, monstres apprivoisés, dons à l'entrepôt
  tomes?: number[]; // livres d'apprentissage dans le sac, par discipline et tome (migration 022)
  learned?: number[]; // leçons apprises à l'École des dompteurs, par discipline
  read_at?: number; // fin de la leçon en cours (horodatage ms ; 0 : aucune)
  read_kind?: number; // discipline de la leçon en cours
  seat?: number | null; // place dans le village (sa couleur, PLAYER_COLORS) ; absente avant la migration 024
  hat?: number; // chapeau porté (HATS) ; absent avant la migration 026
  hats?: number[]; // chapeaux achetés
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
  name: string; // nom donné en construisant l'Hôtel de ville ('' : pas encore nommé)
  told: number[]; // parchemins (géant de chacun) donnés au vieil homme, dans l'ordre : ses souvenirs retrouvés
  boat: number; // étapes du bateau achevées (0 à 4)
  boatAt: number; // fin de l'étape en cours (horodatage ms ; 0 : aucune)
  plan: boolean; // plan de l'École des dompteurs trouvé (migration 025)
  schoolAt: number; // fin du chantier de l'école par Aubin (horodatage ms ; 0 : aucun)
  beaten: number[];
  heart: number; // cœur volcanique : 0 sous le volcan, 1 pris, 2 installé dans le bateau (migration 023)
  wood: number; // réserve commune
  stone: number;
  banned: { id: string; name: string }[]; // comptes expulsés par le fondateur
}

/** Graine et biens communs d'un village enregistré, ou null s'il n'existe pas. */
export async function findVillage(code: string): Promise<({ seed: number; founder: string | null } & VillageSave) | null> {
  if (!db) return null;
  const { data, error } = await db.from('villages').select('seed, name, told, boat, boat_at, school_plan, school_at, camps, buildings, caves, hall, beaten, heart, wood, stone, banned, created_by').eq('code', code).maybeSingle();
  if (error) throw new Error(`Lecture du village impossible : ${error.message}`);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return data
    ? {
      seed: Number(data.seed), camps: list(data.camps).map(Number), buildings: list(data.buildings), unlocked: list(data.caves).map(Number),
      hall: Number(data.hall ?? 0), name: String(data.name ?? ''), told: list(data.told).map(Number), boat: Number(data.boat ?? 0), boatAt: Number(data.boat_at ?? 0), plan: !!data.school_plan, schoolAt: Number(data.school_at ?? 0), beaten: list(data.beaten).map(Number), heart: Number(data.heart ?? 0), wood: Number(data.wood ?? 0), stone: Number(data.stone ?? 0),
      banned: list(data.banned).filter((b) => b && typeof b.id === 'string').map((b) => ({ id: String(b.id), name: String(b.name ?? '') })),
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

/**
 * Quitter un village : sa progression y est effacée. S'il n'y reste personne, le village disparaît ; si c'était son
 * fondateur, le membre le plus récemment actif le devient. Renvoie ce qui s'est passé.
 */
export async function leaveVillage(userId: string, code: string): Promise<{ deleted: boolean; founder: string | null }> {
  if (!db) return { deleted: false, founder: null };
  await deleteProgress(userId, code);
  const { data, error } = await db.from('progress').select('user_id').eq('village_code', code).order('updated_at', { ascending: false });
  if (error) throw new Error(`Lecture des membres impossible : ${error.message}`);
  if (!data?.length) {
    await deleteVillage(code);
    return { deleted: true, founder: null };
  }
  const { data: v } = await db.from('villages').select('created_by').eq('code', code).maybeSingle();
  let founder: string | null = v?.created_by ?? null;
  if (founder === userId) {
    founder = String(data[0].user_id);
    const { error: e } = await db.from('villages').update({ created_by: founder }).eq('code', code);
    if (e) throw new Error(`Passation du village impossible : ${e.message}`);
  }
  return { deleted: false, founder };
}

/** Biens communs du village (partagés par tous ses membres). */
export async function saveVillage(code: string, v: VillageSave) {
  if (!db) return;
  const { error } = await db.from('villages').update({ camps: v.camps, buildings: v.buildings, caves: v.unlocked, hall: v.hall, name: v.name, told: v.told, boat: v.boat, boat_at: v.boatAt, school_plan: v.plan, school_at: v.schoolAt, beaten: v.beaten, heart: v.heart, wood: v.wood, stone: v.stone, banned: v.banned }).eq('code', code);
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
    .select('name, gold, wood, stone, fruits, weapon, armor, torch, boots, saddle, armed, scrolls, essences, alphas, village_found, class, spec, specs, pack, seen, stats, tomes, learned, read_at, read_kind, seat, hat, hats')
    .eq('user_id', userId)
    .eq('village_code', code)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la progression impossible : ${error.message}`);
  return data as Profile | null;
}

/** Nombre de villages où ce compte a une progression. */
export async function countVillages(userId: string): Promise<number> {
  if (!db) return 0;
  const { count, error } = await db.from('progress').select('village_code', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw new Error(`Lecture des villages impossible : ${error.message}`);
  return count ?? 0;
}

/** Membres enregistrés d'un village (pour les montrer endormis au village tant qu'ils sont déconnectés). */
export async function loadMembers(code: string): Promise<{ userId: string; profile: Pick<Profile, 'name' | 'armor' | 'class' | 'alphas' | 'pack' | 'stats' | 'learned' | 'tomes' | 'seat' | 'hat'> }[]> {
  if (!db) return [];
  const { data, error } = await db.from('progress').select('user_id, name, armor, class, alphas, pack, stats, learned, tomes, seat, hat').eq('village_code', code).order('user_id');
  if (error) throw new Error(`Lecture des membres impossible : ${error.message}`);
  return (data ?? []).map((d) => ({ userId: String(d.user_id), profile: { name: d.name, armor: d.armor, class: d.class, alphas: d.alphas ?? [], pack: d.pack ?? [], stats: d.stats ?? {}, learned: d.learned ?? [], tomes: d.tomes ?? [], seat: d.seat, hat: d.hat } }));
}

export async function saveProgress(userId: string, code: string, p: Profile) {
  if (!db) return;
  const { error } = await db
    .from('progress')
    .upsert({ user_id: userId, village_code: code, ...p, updated_at: new Date().toISOString() });
  if (error) console.error('Sauvegarde de la progression impossible :', error.message);
}
