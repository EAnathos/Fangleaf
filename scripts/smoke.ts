// Test de fumée : lance le serveur, connecte 4 bots, vérifie salons, snapshots, combat et forge.
// Usage : npm run smoke

import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import type { ServerMsg, Snapshot } from '../shared/protocol.ts';
import { WorldMap } from '../shared/worldmap.ts';
import { SPECIES } from '../shared/config.ts';

const PORT = 3999;
const server = spawn('npx', ['tsx', 'server/index.ts'], { env: { ...process.env, PORT: String(PORT), ALLOW_GUESTS: '1', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: 'pipe' }); // jamais la vraie base
server.stderr.on('data', (d) => process.stderr.write(d));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) failed = true;
};

class Bot {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  last?: Snapshot;
  id = 0;
  code = '';
  seed = 0;
  constructor() {
    this.ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    this.ws.on('message', (raw) => {
      const m = JSON.parse(String(raw)) as ServerMsg;
      this.msgs.push(m);
      if (m.t === 's') this.last = m;
      if (m.t === 'welcome') {
        this.id = m.id;
        this.code = m.code;
        this.seed = m.seed;
      }
    });
  }
  open() {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise<void>((r) => this.ws.once('open', () => r()));
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  me() {
    return this.last?.players.find((p) => p.id === this.id);
  }
}

async function main() {
  await sleep(1500);
  const host = new Bot();
  await host.open();
  host.send({ t: 'create', name: 'Hôte' });
  for (let i = 0; i < 100 && !host.code; i++) await sleep(50); // la génération de la carte prend quelques centaines de ms
  check(host.code.length === 6, `village créé (code ${host.code})`);

  const guests = [new Bot(), new Bot(), new Bot()];
  for (const g of guests) {
    await g.open();
    g.send({ t: 'join', code: host.code.toLowerCase(), name: 'Invité' });
    await sleep(150);
  }
  check(guests[0].id > 0 && guests[1].id > 0, '2 invités acceptés (code insensible à la casse)');
  check(guests[2].msgs.some((m) => m.t === 'error'), '4e joueur refusé (village complet)');

  await sleep(300);
  check(host.last?.players.length === 3, `snapshot contient 3 joueurs (${host.last?.players.length})`);

  const map = new WorldMap(host.seed);
  let x = host.me()!.x, y = host.me()!.y;
  check(Math.hypot(x - map.spawn.x, y - map.spawn.y) < 150 && !map.inVillage(x, y), 'arrivée au camp de départ, loin du village');
  // Pas de 10 px vers une cible, en glissant le long de l'eau comme le client.
  // Loin de la cible, on suit le chemin de la carte : en ligne droite, le bot resterait coincé contre un arbre.
  let route: { x: number; y: number }[] = [], routeGoal = { x: NaN, y: NaN };
  const stepTo = (gx: number, gy: number, stop = 0) => {
    let tx = gx, ty = gy;
    if (Math.hypot(gx - x, gy - y) > 120) {
      if (Math.hypot(gx - routeGoal.x, gy - routeGoal.y) > 80 || !route.length) {
        route = map.findPath(x, y, gx, gy, 60000) ?? [];
        routeGoal = { x: gx, y: gy };
      }
      while (route.length > 1 && Math.hypot(route[0].x - x, route[0].y - y) < 24) route.shift();
      if (route.length > 1) [tx, ty, stop] = [route[0].x, route[0].y, 0];
    }
    const d = Math.hypot(tx - x, ty - y);
    if (d <= stop + 1) return true;
    const s = Math.min(d - stop, 10), nx = x + ((tx - x) / d) * s, ny = y + ((ty - y) / d) * s;
    if (!map.blocked(nx, ny)) [x, y] = [nx, ny];
    else if (!map.blocked(nx, y)) x = nx;
    else if (!map.blocked(x, ny)) y = ny;
    host.send({ t: 'pos', x, y, fx: 1, fy: 0 });
    return false;
  };

  // Le bot hôte chasse le Gluant sauvage le plus proche jusqu'à avoir de quoi s'équiper.
  const t0 = Date.now();
  let sawUnits = 0;
  while (Date.now() - t0 < 90_000) {
    sawUnits = Math.max(sawUnits, host.last?.units.filter((u) => u[6] === 0).length ?? 0);
    const me = host.me();
    if (!me || me.dead || me.gold >= 25) break;
    let best: [number, number] | undefined, bd = Infinity;
    for (const u of host.last!.units) {
      // toute proie de la zone 1 (hors géants), en deçà de la porte du village (fermée : Maison commune niv. 0)
      if (u[6] !== 0 || SPECIES[u[1]].zone !== 1 || SPECIES[u[1]].boss || map.arcAt(u[3], u[4]) > map.gates[0] - 40) continue;
      const d = Math.hypot(u[3] - x, u[4] - y);
      if (d < bd) [bd, best] = [d, [u[3], u[4]]];
    }
    if (best) stepTo(best[0], best[1], 50);
    else {
      // rien en vue : allers-retours entre le camp et la porte du village
      const at = map.spineAt(Math.floor((Date.now() - t0) / 15000) % 2 ? 700 : map.gates[0] - 150);
      stepTo(at.x, at.y);
    }
    await sleep(50);
  }
  console.log(`  (chasse : ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(sawUnits > 0, `des monstres sont visibles en avançant dans le couloir (${sawUnits})`);
  const me = host.me()!;
  console.log(`  → or ${me.gold}, meute ${me.army.length}, essences ${me.essences.join('/')}, PV ${me.hp}/${me.maxHp}, mort=${me.dead}`);
  check(me.gold > 0, 'des kills ont rapporté de l\'or');
  console.log(`  (essences obtenues : ${me.essences.reduce((x, y) => x + y, 0)} — taux de drop vérifié dans test:rules)`);
  check(!host.last!.units.some((u) => u[6] === 0 && u[2] & 1), 'aucun Alpha sauvage sur la carte');
  check(host.msgs.some((m) => m.t === 's' && m.ev.some((e) => e.e === 'hit')), 'des coups ont été échangés');

  // Aller près d'un point, vu du serveur : les monstres bousculent le bot en chemin, alors on repart
  // de la position du serveur (et on recalcule l'itinéraire) tant qu'on n'y est pas.
  const reach = async (gx: number, gy: number, r: number) => {
    for (let k = 0; k < 6 && !host.me()!.dead; k++) {
      [x, y] = [host.me()!.x, host.me()!.y];
      route = [];
      for (let i = 0; i < 400 && !stepTo(gx, gy); i++) await sleep(50);
      await sleep(150);
      if (Math.hypot(host.me()!.x - gx, host.me()!.y - gy) <= r) return true;
    }
    return false;
  };

  // Forge : du bois, dépôt à l'entrepôt, construction (10 or, 5 bois de la réserve) puis amélioration si assez d'or.
  if (me.gold >= 10 && !me.dead) {
    // D'abord du bois : le bois mort le plus proche entre le camp et le village (la forge en demande 5).
    const wood = map.ores.filter((o) => o.res === 'wood' && map.arcAt(o.x, o.y) < 1550).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    // (les monstres qui passent sont combattus d'abord : on retente)
    for (let k = 0; k < 4 && host.me()!.wood < 5 && !host.me()!.dead; k++) {
      await reach(wood.x + 45, wood.y, 60);
      for (let i = 0; i < 200 && host.me()!.wood < 5; i++) await sleep(50);
    }
    console.log(`  (bois récolté : ${host.me()!.wood})`);
  }
  if (me.gold >= 10 && !host.me()!.dead && host.me()!.wood >= 5) {
    // Le bois du sac va dans la réserve du village (entrepôt) : c'est elle qui paie les constructions.
    await reach(map.village.x, map.village.y + 60, 80);
    await reach(map.store.x, map.store.y + 50, 60);
    host.send({ t: 'deposit' });
    await sleep(200);
    check((host.last?.stock[0] ?? 0) >= 5, `bois déposé à l'entrepôt (réserve : ${host.last?.stock[0]})`);
    await reach(map.forge.x + 20, map.forge.y + 75, 60);
    host.send({ t: 'build', b: 'forge' });
    await sleep(200);
    const at = host.me()!;
    check(!!host.last?.buildings.includes('forge'), `forge construite pour le village (or ${at.gold}, réserve ${host.last?.stock.join('/')}, à ${Math.round(Math.hypot(at.x - map.forge.x, at.y - map.forge.y))} px de la forge)`);
    if (host.me()!.gold >= 20) {
      host.send({ t: 'upgrade', what: 'armor' });
      await sleep(200);
      check(host.me()!.armor === 1, `armure améliorée (niv. ${host.me()!.armor}, or ${host.me()!.gold})`);
    } else console.log('  (pas assez d\'or : amélioration d\'armure ignorée)');
  } else {
    console.log('  (pas assez d\'or ou de bois, ou mort : test de forge ignoré)');
  }

  // Anti-téléportation.
  const before = host.me()!;
  host.send({ t: 'pos', x: before.x + 2000, y: before.y, fx: 1, fy: 0 });
  await sleep(150);
  check(Math.abs(host.me()!.x - before.x) < 200, 'déplacement borné par la vitesse max');

  guests[0].ws.close();
  await sleep(300);
  check(host.last?.players.length === 2, 'départ d\'un joueur pris en compte');

  // Suppression du village : tout le monde revient au lobby, le code n'existe plus.
  host.send({ t: 'reset' });
  await sleep(300);
  check([host, guests[1]].every((b) => b.msgs.some((m) => m.t === 'closed')), 'village supprimé : les joueurs présents sont renvoyés au lobby');
  const late = new Bot();
  await late.open();
  late.send({ t: 'join', code: host.code, name: 'Tard' });
  await sleep(300);
  check(late.msgs.some((m) => m.t === 'error'), 'village supprimé : on ne peut plus le rejoindre');

  for (const b of [host, ...guests, late]) b.ws.close();
  server.kill();
  console.log(failed ? '\nÉCHEC' : '\nOK');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  server.kill();
  process.exit(1);
});
