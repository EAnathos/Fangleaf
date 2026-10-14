// Point d'entrée : HTTP (build statique en prod) + WebSocket /ws + boucle de simulation.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { TICK_HZ } from '../shared/config.ts';
import type { ClientMsg, ServerMsg } from '../shared/protocol.ts';
import { createVillage, deleteProgress, deleteVillage, findVillage, initPersistence, loadProgress, persistenceEnabled, saveProgress, saveVillage, verifyToken, type Profile } from './persist.ts';
import { makeCode, Room, type Player } from './room.ts';

try {
  process.loadEnvFile();
} catch { /* pas de .env */ }
initPersistence();

const PORT = Number(process.env.PORT ?? 3001);
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

const http = createServer((req, res) => {
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Serveur Fangleaf actif. En dev, ouvre le client Vite (http://localhost:5173).');
    return;
  }
  const url = new URL(req.url ?? '/', 'http://x');
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

const rooms = new Map<string, Room>();
const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 4096 });

const cleanName = (n: unknown) =>
  (typeof n === 'string' ? n : '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Dompteur';

const activeUsers = new Set<string>(); // un compte ne peut être connecté qu'une fois

/**
 * Repartir de zéro : le fondateur supprime le village (et la progression de tous ses membres),
 * un autre membre efface seulement sa propre progression dans ce village.
 */
async function reset(r: Room, p: Player) {
  if (r.deleted || p.wiped) return;
  if (r.isFounder(p)) {
    r.deleted = true; // plus aucune sauvegarde, même à la déconnexion
    rooms.delete(r.code);
    await deleteVillage(r.code);
    for (const q of r.players.values()) {
      q.send({ t: 'closed', msg: q === p ? `Village ${r.code} supprimé. Tu repars de zéro.` : `${p.name} a supprimé le village ${r.code}.` });
    }
    console.log(`[${r.code}] supprimé par ${p.name}`);
  } else {
    p.wiped = true;
    if (p.userId) await deleteProgress(p.userId, r.code);
    p.send({ t: 'closed', msg: `Ta progression dans le village ${r.code} a été effacée.` });
    console.log(`[${r.code}] progression de ${p.name} effacée`);
  }
}

async function save(room: Room, p: Player) {
  if (!p.userId || p.wiped || room.deleted) return;
  p.dirty = false;
  await saveProgress(p.userId, room.code, room.profileOf(p));
}

wss.on('connection', (ws: WebSocket) => {
  let room: Room | undefined;
  let player: Player | undefined;
  let joining = false;
  let userId: string | null = null;
  const send = (m: ServerMsg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
  };

  async function enter(msg: Extract<ClientMsg, { t: 'create' | 'join' }>) {
    // Compte Google obligatoire (ALLOW_GUESTS=1 n'existe que pour les tests automatisés).
    let user: { userId: string; name: string } | null = null;
    let name = cleanName(msg.name);
    if (msg.token && persistenceEnabled()) {
      user = await verifyToken(msg.token);
      if (!user) return send({ t: 'error', msg: 'Session expirée : reconnecte-toi.' });
      if (activeUsers.has(user.userId)) return send({ t: 'error', msg: 'Ce compte est déjà en jeu.' });
      if (!msg.name && user.name) name = cleanName(user.name);
    } else if (process.env.ALLOW_GUESTS !== '1') {
      return send({ t: 'error', msg: persistenceEnabled() ? 'Connecte-toi avec Google pour jouer.' : 'Serveur sans Supabase : connexion impossible.' });
    }

    // Village : un nouveau, un village déjà ouvert, ou un village enregistré qu'on rouvre (même carte).
    let r: Room;
    if (msg.t === 'create') {
      let code = makeCode();
      while (rooms.has(code) || (await findVillage(code)) !== null) code = makeCode();
      r = new Room(code);
      r.founder = user?.userId ?? null;
      await createVillage(code, r.seed, user?.userId ?? null);
    } else {
      const code = String(msg.code ?? '').toUpperCase().trim();
      const live = rooms.get(code);
      if (live) r = live;
      else {
        const saved = await findVillage(code);
        if (saved === null) return send({ t: 'error', msg: `Aucun village avec le code ${code || '…'}.` });
        r = rooms.get(code) ?? Object.assign(new Room(code, saved.seed, saved), { founder: saved.founder }); // un autre joueur a pu le rouvrir pendant l'attente
      }
      if (r.isBanned(user?.userId)) return send({ t: 'error', msg: 'Tu as été expulsé de ce village.' });
      if (r.full) return send({ t: 'error', msg: 'Ce village est complet (3 dompteurs max).' });
    }

    // Progression propre à ce compte DANS ce village : ailleurs, on repart de zéro.
    const profile = user ? await loadProgress(user.userId, r.code) : null;
    if (ws.readyState !== ws.OPEN) return;
    if (user && activeUsers.has(user.userId)) return send({ t: 'error', msg: 'Ce compte est déjà en jeu.' });
    rooms.set(r.code, r);
    r.onVillage ??= (v) => void saveVillage(r.code, v);
    room = r;
    if (user) {
      activeUsers.add(user.userId);
      userId = user.userId;
    }
    player = r.addPlayer(name, send, user ? { userId: user.userId, profile } : undefined);
    player.close = () => ws.close();
    if (user && !profile) void save(r, player); // le village apparaît tout de suite dans « Ton village »
    console.log(`[${r.code}] ${player.name} ${msg.t === 'create' ? 'a fondé le village' : 'a rejoint'} (${r.players.size}/3)${user ? (profile ? ' · progression chargée' : ' · nouvelle progression') : ''}`);
  }

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.t === 'ping') return send({ t: 'pong', ts: msg.ts });

    if (!player) {
      if ((msg.t === 'create' || msg.t === 'join') && !joining) {
        joining = true;
        enter(msg)
          .catch((e) => {
            console.error(e);
            const schema = String(e?.message ?? '').includes('schema cache'); // tables Supabase manquantes
            send({ t: 'error', msg: schema ? 'Base de données incomplète : lance « npm run db:migrate » sur le serveur.' : 'Erreur serveur, réessaie.' });
          })
          .finally(() => (joining = false));
      }
      return;
    }

    if (!room) return;
    if (msg.t === 'pos') room.onPos(player, +msg.x, +msg.y, +msg.fx, +msg.fy);
    else if (msg.t === 'upgrade') room.onUpgrade(player, msg.what);
    else if (msg.t === 'alphaUp') room.onAlphaUp(player, +msg.s);
    else if (msg.t === 'alphaEquip') room.onAlphaEquip(player, +msg.s, !!msg.equip);
    else if (msg.t === 'alphaCreate') room.onAlphaCreate(player, +msg.s);
    else if (msg.t === 'mount') room.onMount(player, +msg.id);
    else if (msg.t === 'cave') room.onCave(player, +msg.id, !!msg.enter);
    else if (msg.t === 'challenge') room.onChallenge(player, +msg.cave);
    else if (msg.t === 'chest') room.onChest(player, +msg.id);
    else if (msg.t === 'establish') room.onEstablish(player, +msg.site);
    else if (msg.t === 'travel') room.onTravel(player, +msg.to);
    else if (msg.t === 'build') room.onBuild(player, msg.b);
    else if (msg.t === 'hall') room.onHall(player);
    else if (msg.t === 'deposit') room.onDeposit(player);
    else if (msg.t === 'kick') room.onKick(player, +msg.id);
    else if (msg.t === 'unban') room.onUnban(player, String(msg.user));
    else if (msg.t === 'mode') room.onMode(player, !!msg.manual);
    else if (msg.t === 'attack') room.onAttack(player, +msg.x, +msg.y);
    else if (msg.t === 'pick') room.onPick(player);
    else if (msg.t === 'hold') room.onHold(player, !!msg.on);
    else if (msg.t === 'unlock') room.onUnlock(player, +msg.cave);
    else if (msg.t === 'sell') room.onSell(player, +msg.id);
    else if (msg.t === 'buy') room.onBuy(player, +msg.s);
    else if (msg.t === 'legend') room.onLegend(player, +msg.s);
    else if (msg.t === 'class') room.onClass(player, msg.cls);
    else if (msg.t === 'help') room.onHelp(player, !!msg.on);
    else if (msg.t === 'reset') {
      reset(room, player).catch((e) => {
        console.error(e);
        send({ t: 'error', msg: 'Suppression impossible, réessaie.' });
      });
    }
    else if (msg.t === 'cheat' && process.env.NODE_ENV !== 'production') room.onCheat(player);
  });

  ws.on('close', () => {
    if (room && player) {
      const r = room, p = player;
      save(r, p).finally(() => {
        if (userId) activeUsers.delete(userId);
      });
      r.removePlayer(p.id);
      if (r.players.size === 0) {
        rooms.delete(r.code);
        console.log(`[${r.code}] fermé (vide)`);
      }
    } else if (userId) activeUsers.delete(userId);
  });
});

setInterval(() => {
  for (const r of rooms.values()) r.step();
}, 1000 / TICK_HZ);

// Sauvegarde périodique des progressions modifiées.
setInterval(() => {
  for (const r of rooms.values()) for (const p of r.players.values()) if (p.dirty) void save(r, p);
}, 15_000);

// Arrêt (pm2 restart, systemctl stop, Ctrl+C) : on sauvegarde tout le monde avant de quitter.
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  await Promise.allSettled([...rooms.values()].flatMap((r) => [...r.players.values()].map((p) => save(r, p))));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

http.listen(PORT, () =>console.log(`Fangleaf sur http://localhost:${PORT} (ws: /ws)`));
