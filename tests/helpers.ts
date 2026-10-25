// Outils partagés des tests de règles (simulation sans réseau).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BUILDING_IDS, HALL_MAX, SPECIES, SWORD_PULLS } from '../shared/config.ts';
import { Room } from '../server/room.ts';

// Hasard reproductible : même graine à chaque exécution, donc même résultat en local et en CI.
// TEST_SEED=… npm run test:rules pour en essayer une autre. Chaque test repart de la graine : il ne dépend pas des autres.
export const TEST_SEED = Number(process.env.TEST_SEED ?? 1);
let rng = TEST_SEED >>> 0;
const random = () => {
  // mulberry32
  rng = (rng + 0x6d2b79f5) >>> 0;
  let t = rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// Horloge figée aussi : le jour, la nuit et la météo suivent l'heure réelle, et un test lancé au crépuscule
// ou sous l'averse pouvait échouer en CI et passer en local. Les tests qui veulent un ciel précis avancent Date.now eux-mêmes.
export const TEST_NOW = Number(process.env.TEST_NOW ?? Date.parse('2026-01-01T12:00:00Z'));

/** Un test de règle : hasard et horloge remis à zéro avant, pour qu'il donne le même résultat seul ou avec les autres. */
export const rule = (name: string, fn: () => void) =>
  test(name, () => {
    rng = TEST_SEED >>> 0;
    Math.random = random;
    Date.now = () => TEST_NOW;
    fn();
  });

/** Vérification nommée : le libellé dit ce qui est attendu (et ce qui a été mesuré) quand elle échoue. */
export const check = (ok: unknown, label: string) => assert.ok(ok, label);

export const noop = () => {};

// Village de test : tous les bâtiments construits et toutes les grottes débloquées (sauf mention contraire).
export const ALL_CAVES = Array.from({ length: 64 }, (_, i) => i);
export const ALL_BOSSES = SPECIES.map((sp, i) => (sp.boss ? i : -1)).filter((i) => i >= 0);
// (toutes les portes ouvertes : Hôtel de ville au maximum, tous les géants vaincus et leurs parchemins rapportés)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const room = (): any => new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX, beaten: ALL_BOSSES, told: ALL_BOSSES });

// Un dompteur sans compte arrive sans arme (l'épée est plantée sur la plage) et sans selle : les tests le veulent armé et en
// selle, sauf ceux de l'épée et de la selle.
/** L'arrivée d'origine, sans arme (pour les tests de l'épée). */
export const unarmedAdd = Room.prototype.addPlayer;
Room.prototype.addPlayer = function (this: Room, ...args: Parameters<Room['addPlayer']>) {
  const p = unarmedAdd.apply(this, args);
  p.sword = SWORD_PULLS;
  p.saddle = 1;
  return p;
};
