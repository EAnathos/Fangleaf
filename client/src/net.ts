// Connexion WebSocket + tampon de snapshots pour l'interpolation.

import { TICK_HZ } from '../../shared/config.ts';
import type { ClientMsg, PlayerState, ServerMsg, Snapshot, UnitTuple } from '../../shared/protocol.ts';
import { SnapshotState } from '../../shared/snapshot.ts';

const INTERP_DELAY_TICKS = 2; // 100 ms

export interface View {
  units: UnitTuple[]; // positions interpolées
  players: PlayerState[];
}

export class Net {
  private ws: WebSocket;
  private snaps: Snapshot[] = [];
  private state = new SnapshotState(); // reconstitue l'état complet à partir des snapshots différentiels
  private renderTick = 0;
  ping = 0;
  private clock = 0; // écart entre l'heure du serveur et la nôtre (ms)
  onMessage: (m: ServerMsg) => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onmessage = (ev) => {
      let m = JSON.parse(ev.data) as ServerMsg;
      if (m.t === 's') this.push((m = this.state.apply(m)));
      else if (m.t === 'pong') {
        this.ping = Math.round(performance.now() - m.ts);
        if (m.now) this.clock = m.now + this.ping / 2 - Date.now();
      }
      this.onMessage(m);
    };
    this.ws.onclose = () => this.onClose();
    const ping = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
    this.ws.addEventListener('close', () => clearInterval(ping));
  }

  /** Heure du serveur (ms), à la latence près : le ciel est le même pour tout le village. */
  serverNow() {
    return Date.now() + this.clock;
  }

  ready() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.addEventListener('open', () => resolve(), { once: true });
      this.ws.addEventListener('error', () => reject(new Error('Serveur injoignable')), { once: true });
    });
  }

  close() {
    this.ws.onclose = null;
    this.ws.close();
  }

  send(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get latest(): Snapshot | undefined {
    return this.snaps[this.snaps.length - 1];
  }

  private out: UnitTuple[] = [];
  private pool = new Map<number, UnitTuple>(); // unité → son tableau interpolé, réutilisé
  private index = new WeakMap<Snapshot, Map<number, UnitTuple>>();
  /** Unités d'un snapshot par id (calculé une fois par snapshot). */
  byId(s: Snapshot) {
    let m = this.index.get(s);
    if (!m) this.index.set(s, (m = new Map(s.units.map((u) => [u[0], u]))));
    return m;
  }

  private push(s: Snapshot) {
    this.snaps.push(s);
    if (this.snaps.length > 30) this.snaps.shift();
  }

  /** Avance l'horloge de rendu (légèrement en retard sur le serveur) et interpole. */
  sample(dt: number): View | undefined {
    const last = this.latest;
    if (!last) return;
    const target = last.tick - INTERP_DELAY_TICKS;
    this.renderTick += dt * TICK_HZ;
    const drift = target - this.renderTick;
    if (Math.abs(drift) > 6) this.renderTick = target;
    else this.renderTick += drift * 0.08;

    let a = this.snaps[0], b = last;
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1].tick <= this.renderTick) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (this.renderTick - a.tick) / span)) : 1;

    // Unités interpolées : les tableaux de sortie sont réutilisés d'une image à l'autre (pas de déchets à ramasser).
    const prev = this.byId(a);
    const units = this.out;
    units.length = 0;
    const pool = this.pool;
    for (const u of b.units) {
      const p = prev.get(u[0]);
      if (!p || p[6] !== u[6]) { // nouvelle unité ou changement de camp : pas d'interpolation
        units.push(u);
        continue;
      }
      let o = pool.get(u[0]);
      if (!o) pool.set(u[0], (o = [0, 0, 0, 0, 0, 0, 0]));
      o[0] = u[0];
      o[1] = u[1];
      o[2] = u[2];
      o[3] = p[3] + (u[3] - p[3]) * t;
      o[4] = p[4] + (u[4] - p[4]) * t;
      o[5] = u[5];
      o[6] = u[6];
      units.push(o);
    }
    if (pool.size > units.length * 2 + 64) for (const id of pool.keys()) if (!this.byId(b).has(id)) pool.delete(id);
    const prevP = new Map(a.players.map((p) => [p.id, p]));
    const players = b.players.map((p) => {
      const q = prevP.get(p.id);
      if (!q || q.dead !== p.dead) return p;
      return { ...p, x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t };
    });
    return { units, players };
  }
}
