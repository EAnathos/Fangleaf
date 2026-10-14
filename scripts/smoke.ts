// Test de fumée : lance le serveur, connecte 4 bots, vérifie salons, snapshots, combat et forge.
// Il vérifie le réseau de bout en bout, vite : l'économie (récolte, prix, éveils…) est couverte par test:rules,
// alors après un premier combat le bot prend ses ressources par la triche de dev au lieu de chasser et récolter.
// Usage : npm run smoke

import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import type { ServerMsg, Snapshot } from '../shared/protocol.ts';
import { WorldMap } from '../shared/worldmap.ts';
import { SPECIES } from '../shared/config.ts';

const PORT = 3999;
const server = spawn('npx', ['tsx', 'server/index.ts'], { env: { ...process.env, PORT: String(PORT), ALLOW_GUESTS: '1', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }, stdio: 'pipe' }); // jamais la vraie base
server.stderr.on('data', (d) => process.stderr.write(d));
let ready = false; // le serveur écoute (il l'annonce sur sa sortie)
server.stdout.on('data', (d) => (ready ||= String(d).includes('Fangleaf sur')));

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
  for (let i = 0; i < 200 && !ready; i++) await sleep(50);
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
  // Pas de 16 px vers une cible (320 px/s, juste sous la vitesse tolérée par le serveur), en glissant le long de l'eau comme le client.
  // On suit toujours un itinéraire calculé : en ligne droite, le bot resterait coincé contre un arbre ou une palissade.
  let route: { x: number; y: number }[] = [], routeGoal = { x: NaN, y: NaN };
  const stepTo = (gx: number, gy: number, stop = 0) => {
    let tx = gx, ty = gy;
    if (Math.hypot(gx - x, gy - y) > 30) {
      if (Math.hypot(gx - routeGoal.x, gy - routeGoal.y) > 80 || !route.length) {
        route = map.findPath(x, y, gx, gy, 400_000) ?? [];
        routeGoal = { x: gx, y: gy };
      }
      while (route.length > 1 && Math.hypot(route[0].x - x, route[0].y - y) < 24) route.shift();
      if (route.length > 1) [tx, ty, stop] = [route[0].x, route[0].y, 0];
    }
    const d = Math.hypot(tx - x, ty - y);
    if (d <= stop + 1) return true;
    const s = Math.min(d - stop, 16), nx = x + ((tx - x) / d) * s, ny = y + ((ty - y) / d) * s;
    if (!map.blocked(nx, ny)) [x, y] = [nx, ny];
    else if (!map.blocked(nx, y)) x = nx;
    else if (!map.blocked(x, ny)) y = ny;
    host.send({ t: 'pos', x, y, fx: 1, fy: 0 });
    return false;
  };

  // Le bot hôte chasse la proie la plus proche jusqu'à son premier kill (combat et or vérifiés de bout en bout).
  const t0 = Date.now();
  let sawUnits = 0;
  while (Date.now() - t0 < 45_000) {
    sawUnits = Math.max(sawUnits, host.last?.units.filter((u) => u[6] === 0).length ?? 0);
    const me = host.me();
    if (!me || me.dead || me.gold > 0) break;
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
  // Budget de 25 s : au-delà, on note où le bot est resté coincé.
  const reach = async (gx: number, gy: number, r: number) => {
    const end = Date.now() + 25_000;
    while (Date.now() < end) {
      const m = host.me()!;
      if (m.dead) {
        await sleep(200); // tombé en chemin : il réapparaît au village
        continue;
      }
      [x, y] = [m.x, m.y];
      route = [];
      for (let i = 0; i < 120 && !stepTo(gx, gy); i++) await sleep(50);
      await sleep(150);
      if (Math.hypot(host.me()!.x - gx, host.me()!.y - gy) <= r) return true;
      if (Math.hypot(host.me()!.x - m.x, host.me()!.y - m.y) < 8) {
        // n'a pas bougé de toute la tentative (coincé dans l'ouverture d'une palissade) : quelques pas de côté
        const a = Math.random() * Math.PI * 2;
        for (let i = 0; i < 6; i++) {
          const nx = host.me()!.x + Math.cos(a) * 14, ny = host.me()!.y + Math.sin(a) * 14;
          if (!map.blocked(nx, ny)) host.send({ t: 'pos', x: nx, y: ny, fx: 1, fy: 0 });
          await sleep(60);
        }
      }
    }
    const m = host.me()!;
    const p = map.findPath(m.x, m.y, gx, gy, 400_000);
    console.log(`  (graine ${host.seed}) (coincé à ${Math.round(Math.hypot(m.x - gx, m.y - gy))} px du but, en (${Math.round(m.x)}, ${Math.round(m.y)}), mort=${m.dead}, abscisse ${Math.round(map.arcAt(m.x, m.y))} / porte ${Math.round(map.gates[0])}, chemin ${p ? p.length + ' étapes' : 'introuvable'}, local (${Math.round(x)}, ${Math.round(y)}) ${map.blocked(x, y) ? 'bloqué' : 'libre'})`);
    return false;
  };

  // Forge : ressources de dev, dépôt à l'entrepôt, construction (or du dompteur, bois de la réserve) puis amélioration.
  [x, y] = [host.me()!.x, host.me()!.y];
  host.send({ t: 'cheat' }); // +300 or, +100 bois, +100 pierre
  await sleep(150);
  check(host.me()!.wood >= 100, `ressources de dev reçues (or ${host.me()!.gold}, bois ${host.me()!.wood})`);
  await reach(map.store.x, map.store.y + 50, 60);
  host.send({ t: 'deposit' });
  await sleep(150);
  check((host.last?.stock[0] ?? 0) >= 100 && host.me()!.wood === 0, `sac vidé à l'entrepôt (réserve : ${host.last?.stock.join(' bois, ')} pierre)`);
  await reach(map.forge.x + 20, map.forge.y + 75, 60);
  host.send({ t: 'build', b: 'forge' });
  await sleep(150);
  const at = host.me()!;
  check(!!host.last?.buildings.includes('forge'), `forge construite pour le village (or ${at.gold}, réserve ${host.last?.stock.join('/')}, à ${Math.round(Math.hypot(at.x - map.forge.x, at.y - map.forge.y))} px de la forge)`);
  host.send({ t: 'upgrade', what: 'armor' });
  await sleep(150);
  check(host.me()!.armor === 1, `armure améliorée (niv. ${host.me()!.armor}, or ${host.me()!.gold})`);

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
