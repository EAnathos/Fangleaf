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
  onMessage: (m: ServerMsg) => void = () => {};
  onClose: () => void = () => {};

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onmessage = (ev) => {
      let m = JSON.parse(ev.data) as ServerMsg;
      if (m.t === 's') this.push((m = this.state.apply(m)));
      else if (m.t === 'pong') this.ping = Math.round(performance.now() - m.ts);
      this.onMessage(m);
    };
    this.ws.onclose = () => this.onClose();
    const ping = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 2000);
    this.ws.addEventListener('close', () => clearInterval(ping));
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

    const prev = new Map<number, UnitTuple>();
    for (const u of a.units) prev.set(u[0], u);
    const units = b.units.map((u): UnitTuple => {
      const p = prev.get(u[0]);
      if (!p || p[6] !== u[6]) return u; // nouvelle unité ou changement de camp : pas d'interpolation
      return [u[0], u[1], u[2], p[3] + (u[3] - p[3]) * t, p[4] + (u[4] - p[4]) * t, u[5], u[6]];
    });
    const prevP = new Map(a.players.map((p) => [p.id, p]));
    const players = b.players.map((p) => {
      const q = prevP.get(p.id);
      if (!q || q.dead !== p.dead) return p;
      return { ...p, x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t };
    });
    return { units, players };
  }
}
