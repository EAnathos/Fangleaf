// Envoi différentiel des snapshots : le serveur n'envoie que les unités et filons qui ont changé (plus la liste
// des unités sorties de la vue) ; le client reconstitue l'état complet. Même règle des deux côtés.

import type { PlayerState, Snapshot, UnitTuple } from './protocol.ts';

const MOVE_EPS = 2; // px : en deçà, un petit déplacement n'est pas renvoyé
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Côté serveur, par spectateur : ce qu'il a déjà reçu, pour n'envoyer que la différence. */
export class SnapshotDiff {
  private units = new Map<number, UnitTuple>();
  private ores = new Map<number, number>();
  private players = new Map<number, Record<string, string>>(); // par dompteur : chaque champ déjà envoyé (en JSON)

  /** Dompteurs : pour chacun, son id et seulement les champs qui ont changé (une liste d'essences, une meute…). */
  diffPlayers(now: PlayerState[]): PlayerState[] {
    const out = now.map((p) => {
      const old = this.players.get(p.id) ?? {}, part: Record<string, unknown> = { id: p.id }, sent: Record<string, string> = {};
      for (const [k, v] of Object.entries(p)) {
        const json = JSON.stringify(v);
        sent[k] = json;
        if (old[k] !== json) part[k] = v;
      }
      this.players.set(p.id, sent);
      return part as unknown as PlayerState;
    });
    for (const id of this.players.keys()) if (!now.some((p) => p.id === id)) this.players.delete(id);
    return out;
  }

  /** Unités visibles maintenant → [nouvelles ou changées, ids sortis de la vue]. */
  diffUnits(now: UnitTuple[]): [UnitTuple[], number[]] {
    const changed: UnitTuple[] = [], seen = new Set<number>();
    for (const u of now) {
      seen.add(u[0]);
      const old = this.units.get(u[0]);
      // inchangée, ou seulement déplacée de moins de 2 px (l'interpolation du client n'y verra rien)
      if (old && same([old[1], old[2], old[5], old[6]], [u[1], u[2], u[5], u[6]]) && Math.abs(old[3] - u[3]) < MOVE_EPS && Math.abs(old[4] - u[4]) < MOVE_EPS) continue;
      this.units.set(u[0], u);
      changed.push(u);
    }
    const gone: number[] = [];
    for (const id of this.units.keys()) {
      if (seen.has(id)) continue;
      gone.push(id);
      this.units.delete(id);
    }
    return [changed, gone];
  }

  /** Filons visibles → ceux dont l'état a changé (un filon hors de vue reste connu du client tel quel). */
  diffOres(now: [number, number][]): [number, number][] {
    return now.filter(([id, hp]) => {
      if (this.ores.get(id) === hp) return false;
      this.ores.set(id, hp);
      return true;
    });
  }
}

/** Côté client : état complet reconstitué à partir des snapshots différentiels. */
export class SnapshotState {
  private units = new Map<number, UnitTuple>();
  private ores = new Map<number, number>();
  private players = new Map<number, PlayerState>();

  /** Applique un snapshot reçu et le complète : units et ores contiennent alors tout l'état visible. */
  apply(s: Snapshot): Snapshot {
    for (const id of s.gone ?? []) this.units.delete(id);
    for (const u of s.units) this.units.set(u[0], u);
    for (const [id, hp] of s.ores) this.ores.set(id, hp);
    // dompteurs : chacun complété par ses champs précédents ; ceux qui ne sont plus listés sont partis
    const players = s.players.map((part) => {
      const full = { ...this.players.get(part.id), ...part } as PlayerState;
      this.players.set(part.id, full);
      return full;
    });
    for (const id of this.players.keys()) if (!s.players.some((p) => p.id === id)) this.players.delete(id);
    return { ...s, players, units: [...this.units.values()], ores: [...this.ores] };
  }
}
