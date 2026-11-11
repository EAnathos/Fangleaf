// Banc de performance de la simulation : un village simulé sans réseau, hasard et horloge figés.
// Mesure le temps d'un tick serveur (boucle à TICK_HZ) et le volume des snapshots envoyés à chaque joueur.
// Procédure, scénarios et seuils : docs/PERFORMANCE.md
//
//   npm run bench                                 mesure et affiche
//   npm run bench -- --save bench/avant.json      mesure et enregistre (référence, sur dev avant le changement)
//   npm run bench -- --against bench/avant.json   mesure et compare : code de sortie 1 au-delà des seuils
//   npm run bench -- --only bataille --ticks 600  un seul scénario, plus court

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { ARMY_CAP, BOSS_MOVES, BUILDING_IDS, DT, HALL_MAX, SPECIES, SWORD_PULLS, TICK_HZ } from '../shared/config.ts';
import { Room } from '../server/room.ts';
import { WorldMap } from '../shared/worldmap.ts';

const { values: args } = parseArgs({
  options: {
    save: { type: 'string' },
    against: { type: 'string' },
    only: { type: 'string' },
    ticks: { type: 'string' },
    seed: { type: 'string' },
  },
});

/** Seuils de régression (voir docs/PERFORMANCE.md). Le temps dépend de la machine, le volume non. */
const THRESHOLDS = {
  tickP95: 1.25, // p95 du tick : +25 % au plus par rapport à la référence…
  tickFloorMs: 0.5, // …et un écart de moins de 0,5 ms n'est jamais une régression (bruit de mesure)
  bytes: 1.1, // octets de snapshot par joueur et par seconde : +10 % au plus (mesure déterministe)
  budgetMs: 1000 / TICK_HZ / 2, // p99 au-delà de la moitié du budget d'un tick : alerte, quelle que soit la référence
  mapFloorMs: 100, // génération de l'île : même règle que le p95 (+25 %), avec un plancher de 100 ms
};

const SEED = Number(args.seed ?? 1);
const TICKS = Number(args.ticks ?? 1200); // une minute de jeu à 20 ticks/s
const WARMUP = 100;

// Même hasard reproductible que tests/helpers.ts (mulberry32) et horloge figée à midi : pas de nuit ni d'orage surprise.
let rng = SEED >>> 0;
Math.random = () => {
  rng = (rng + 0x6d2b79f5) >>> 0;
  let t = rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const NOW = Date.parse('2026-01-01T12:00:00Z');
Date.now = () => NOW;

const ALL_CAVES = Array.from({ length: 64 }, (_, i) => i);
const ALL_BOSSES = SPECIES.map((sp, i) => (sp.boss ? i : -1)).filter((i) => i >= 0);
const COMMON = SPECIES.map((sp, i) => (sp.boss ? -1 : i)).filter((i) => i >= 0).slice(0, 6);

type Scenario = { key: string; label: string; players: number; packs: boolean; wild: number; spread: boolean; boss?: boolean };
const SCENARIOS: Scenario[] = [
  { key: 'solo', label: '1 joueur seul, sans meute, sur la plage', players: 1, packs: false, wild: 0, spread: false },
  { key: 'coop', label: '4 joueurs dispersés sur l\'île, meutes pleines', players: 4, packs: true, wild: 0, spread: true },
  { key: 'bataille', label: '4 joueurs au même endroit, meutes pleines, 60 monstres sauvages', players: 4, packs: true, wild: 60, spread: false },
  { key: 'geant', label: '4 joueurs et leurs meutes dans une grotte, combat contre un géant', players: 4, packs: true, wild: 0, spread: false, boss: true },
];

type Result = { key: string; ticks: number; meanMs: number; p95Ms: number; p99Ms: number; maxMs: number; bytesPerPlayerS: number; units: number };

function run(sc: Scenario): Result {
  rng = SEED >>> 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = new Room('BENCH', SEED, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX, beaten: ALL_BOSSES, told: ALL_BOSSES });
  let bytes = 0;
  // comme server/index.ts : chaque message part sérialisé en JSON
  const send = (m: unknown) => { bytes += JSON.stringify(m).length; };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const players: any[] = [];
  for (let i = 0; i < sc.players; i++) {
    const p = r.addPlayer(`bench${i}`, send);
    p.sword = SWORD_PULLS;
    p.saddle = 1;
    const at = sc.spread ? r.map.spineAt(1200 + i * 1800) : r.map.spineAt(2600);
    [p.x, p.y] = [at.x + (sc.spread ? 0 : i * 40), at.y];
    players.push({ p, cx: p.x, cy: p.y, phase: i });
    if (sc.packs) {
      for (let k = 0; k < ARMY_CAP; k++) {
        const u = r.createUnit(COMMON[k % COMMON.length], false, p.x + 20 + k * 6, p.y + 20);
        u.owner = p.id;
        p.army.push(u.id);
      }
    }
  }
  const anchor = players[0].p;
  for (let k = 0; k < sc.wild; k++) {
    const a = (k / sc.wild) * Math.PI * 2, d = 350 + (k % 5) * 60;
    r.createUnit(COMMON[k % COMMON.length], false, anchor.x + Math.cos(a) * d, anchor.y + Math.sin(a) * d);
  }

  // Le scénario dédié place le groupe dans une grotte et réveille un vrai géant : son IA lance ses attaques,
  // pose des effets persistants et appelle des renforts pendant que le groupe lui inflige des dégâts.
  const cave = sc.boss ? r.map.caves.find((cv) => BOSS_MOVES[SPECIES[cv.boss].key]?.some((move) => move.kind === 'summon')) : undefined;
  const boss = cave ? r.units.get(r.caveBoss[cave.id]) : undefined;
  if (sc.boss && (!cave || !boss)) throw new Error('Aucun géant avec renforts disponible pour le scénario geant');
  if (cave && boss) {
    players.forEach((q, i) => {
      const a = i * Math.PI / 2;
      [q.p.x, q.p.y] = [boss.x + Math.cos(a) * 90, boss.y + Math.sin(a) * 90];
      for (const id of q.p.army) {
        const u = r.units.get(id);
        if (u) [u.x, u.y] = [q.p.x + Math.cos(a + 0.5) * 70, q.p.y + Math.sin(a + 0.5) * 70];
      }
    });
    r.onChallenge(players[0].p, cave.id);
    if (boss.dormant) throw new Error('Le géant du scénario geant ne s’est pas réveillé');
  }

  const times: number[] = [];
  let measured = 0;
  for (let t = 0; t < WARMUP + TICKS; t++) {
    // les joueurs tournent lentement autour de leur point de départ (vue qui bouge, comme en jeu) et ne meurent pas
    for (const q of players) {
      const a = q.phase + t * DT * 0.5;
      const x = q.cx + Math.cos(a) * 200, y = q.cy + Math.sin(a) * 200;
      if (!sc.boss && !r.map.blocked(x, y)) [q.p.x, q.p.y] = [x, y];
      q.p.hp = 1e9;
      q.p.dead = false;
    }
    if (t === WARMUP) { bytes = 0; measured = 0; }
    if (boss && t >= WARMUP && t % 20 === 0 && r.units.has(boss.id)) {
      r.damage(boss, boss.maxHp * 0.0001, players[Math.floor(t / 20) % players.length].p);
    }
    const t0 = performance.now();
    r.step();
    const dt = performance.now() - t0;
    if (t >= WARMUP) { times.push(dt); measured++; }
  }
  times.sort((a, b) => a - b);
  const pct = (q: number) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return {
    key: sc.key,
    ticks: measured,
    meanMs: round(times.reduce((s, x) => s + x, 0) / times.length),
    p95Ms: round(pct(0.95)),
    p99Ms: round(pct(0.99)),
    maxMs: round(times[times.length - 1]),
    bytesPerPlayerS: Math.round(bytes / sc.players / (measured * DT)),
    units: r.units.size,
  };
}

const chosen = SCENARIOS.filter((s) => !args.only || args.only.split(',').includes(s.key));
if (!chosen.length) {
  console.error(`Scénario inconnu : ${args.only}. Disponibles : ${SCENARIOS.map((s) => s.key).join(', ')}`);
  process.exit(2);
}
// Génération de l'île : elle bloque tout le process (donc tous les villages) quand un village est chargé.
const mapMs = Math.round(Math.min(...[0, 1].map(() => {
  const t0 = performance.now();
  new WorldMap(SEED, false);
  return performance.now() - t0;
})));
console.log(`carte     génération de l'île côté serveur : ${mapMs} ms (bloque la boucle de tous les villages)`);
const results = chosen.map((sc) => {
  const res = run(sc);
  console.log(`${sc.key.padEnd(9)} ${sc.label}`);
  console.log(`          tick moyen ${res.meanMs} ms · p95 ${res.p95Ms} ms · p99 ${res.p99Ms} ms · max ${res.maxMs} ms · ` +
    `${(res.bytesPerPlayerS / 1024).toFixed(1)} Ko/s par joueur · ${res.units} unités`);
  return res;
});

const report = { node: process.version, platform: `${process.platform}-${process.arch}`, seed: SEED, ticks: TICKS, mapMs, results };
if (args.save) {
  await mkdir(dirname(args.save), { recursive: true });
  await writeFile(args.save, JSON.stringify(report, null, 2) + '\n');
  console.log(`\nRéférence enregistrée dans ${args.save}`);
}

let failed = false;
for (const res of results) {
  if (res.p99Ms > THRESHOLDS.budgetMs) {
    console.log(`⚠ ${res.key} : p99 ${res.p99Ms} ms, plus de la moitié du budget d'un tick (${THRESHOLDS.budgetMs} ms)`);
    failed = true;
  }
}
if (args.against) {
  const base = JSON.parse(await readFile(args.against, 'utf8')) as typeof report;
  if (base.seed !== SEED || base.ticks !== TICKS) console.log(`\n⚠ référence mesurée avec une autre graine ou durée (graine ${base.seed}, ${base.ticks} ticks)`);
  if (base.platform !== report.platform || base.node !== report.node) console.log(`⚠ référence mesurée sur ${base.platform}, Node ${base.node} : les temps ne sont pas comparables`);
  console.log(`\nComparaison avec ${args.against}`);
  if (base.mapMs) {
    const slowMap = mapMs > base.mapMs * THRESHOLDS.tickP95 && mapMs - base.mapMs > THRESHOLDS.mapFloorMs;
    console.log(`  ${slowMap ? '✘' : '✔'} carte     génération ${base.mapMs} → ${mapMs} ms`);
    failed ||= slowMap;
  }
  for (const res of results) {
    const b = base.results.find((x) => x.key === res.key);
    if (!b) { console.log(`  ${res.key} : absent de la référence`); continue; }
    const slow = res.p95Ms > b.p95Ms * THRESHOLDS.tickP95 && res.p95Ms - b.p95Ms > THRESHOLDS.tickFloorMs;
    const heavy = res.bytesPerPlayerS > b.bytesPerPlayerS * THRESHOLDS.bytes;
    const pc = (a: number, z: number) => `${a >= z ? '+' : ''}${Math.round(((a - z) / (z || 1)) * 100)} %`;
    console.log(`  ${slow || heavy ? '✘' : '✔'} ${res.key.padEnd(9)} p95 ${b.p95Ms} → ${res.p95Ms} ms (${pc(res.p95Ms, b.p95Ms)}) · ` +
      `snapshots ${b.bytesPerPlayerS} → ${res.bytesPerPlayerS} o/s (${pc(res.bytesPerPlayerS, b.bytesPerPlayerS)})`);
    failed ||= slow || heavy;
  }
}
if (failed) process.exitCode = 1;
