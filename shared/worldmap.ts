// Carte générée à partir d'une graine : même graine = même carte côté serveur et côté client.
//
// - Le monde est un long couloir sinueux (la « colonne ») qui part d'un bord de la carte (haut, droite ou bas)
//   et serpente sur PATH_LEN px ; autour, une forêt infranchissable.
// - Camp de départ au début du couloir, village (la base) un peu plus loin : il faut le trouver.
// - Zones de danger : ZONES tronçons successifs le long du couloir, frontières déformées par du bruit ;
//   la zone 5 (Lacs brumeux) est criblée de lacs, où nagent les Serpents des brumes ; la 6 (Mer de sable) n'a que de rares oasis.
// - Au bout de la zone 4 : un emplacement de camp, que le village peut établir contre de l'or
//   (feu qui soigne, point de réapparition, Pierre de passage pour voyager entre camps).
// - Lacs infranchissables dans le couloir, en laissant toujours libre une voie centrale.
// - Une grotte par espèce (deux ou trois par zone), gardée par la version géante de l'espèce (entrée sur la carte, intérieur hors du monde).
// - Des filons d'or éparpillés, plus riches dans les zones dangereuses.
// - Arbres, rochers, palissade, bâtiments : obstacles solides (même grille : 1 = eau, 2 = solide, 3 = forêt hors du couloir).

import { CAVE_RX, CAVE_RY, BOARD_OFFSET, DEN_OFFSET, FORGE_OFFSET, HALL_OFFSET, MARKET_OFFSET, STORE_OFFSET, PATH_LEN, SPECIES, VILLAGE_R, VILLAGE_STONE_OFFSET, WORLD_HALF, ZONES, type Resource } from './config.ts';
import { clamp, dist2, fbm, hash2, rng } from './math.ts';

export const MAP_CELL = 16; // résolution de la grille d'obstacles
const N = (WORLD_HALF * 2) / MAP_CELL;
const LAKE_THRESHOLD = 0.64;
const LAKE_THRESHOLD_LAKES = 0.54; // zone 5 (Lacs brumeux) : bien plus d'eau
const LAKE_THRESHOLD_DESERT = 0.8; // zone 6 (Mer de sable) : de rares oasis
const SPINE_STEP = 100;
const ZONE_LEN = PATH_LEN / ZONES;
const LAKES_FROM = 4 * ZONE_LEN; // début de la zone des lacs
const DESERT_FROM = 5 * ZONE_LEN; // début de la Mer de sable
const DENS = 7; // tanières de suricates
const ZONE_BLEND = 900; // largeur de la transition (affichage) entre deux zones
const STAMP_R = 1300; // au-delà, forêt profonde : on ne calcule plus la distance au couloir
const LANE = 230; // voie centrale jamais inondée
const CAVE_GAP = 4000; // > VIEW_R + 2 × CAVE_RX + la demi-largeur de l'écran
const VILLAGE_ARC = 1550; // abscisse du village le long du couloir

export interface Pt {
  x: number;
  y: number;
}

export interface Cave {
  id: number;
  zone: number;
  boss: number; // index de l'espèce du mini-boss
  entrance: Pt; // sur la carte
  inside: Pt; // centre de l'intérieur (hors du monde)
  exit: Pt; // sortie, en bas de l'intérieur
}

export interface Ore {
  id: number;
  x: number;
  y: number;
  zone: number;
  res: Resource; // filon d'or, rocher (pierre) ou bois mort
}

export interface Bush {
  id: number;
  x: number;
  y: number;
  zone: number;
}

export interface Decor {
  kind: 0 | 1; // arbre, rocher
  x: number;
  y: number;
  zone: number;
}

/**
 * Bord de l'intérieur d'une grotte dans la direction a, en part de l'ellipse CAVE_RX × CAVE_RY (de 0,82 à 1,08) :
 * une paroi rocheuse irrégulière plutôt qu'un ovale parfait. Même forme pour le jeu (caveAt) et le dessin.
 */
export function caveEdge(c: Cave, a: number) {
  const k = c.id * 1.7;
  const n = Math.sin(a * 3 + k) * 0.06 + Math.sin(a * 5 + k * 2.3) * 0.045 + Math.sin(a * 9 + k * 0.7) * 0.025 + Math.sin(a * 14 + k * 1.3) * 0.015;
  return 0.95 + n;
}

const DECO_CELL = 96;
const BUCKET = 256;

/** Colonne du couloir : marche aléatoire depuis un bord, qui évite les bords et ses propres boucles. */
function makeSpine(seed: number): Pt[] {
  const rand = rng(seed ^ 0x1234567);
  const MARGIN = 1100, SEP = 2100;
  let best: Pt[] = [];
  for (let attempt = 0; attempt < 60; attempt++) {
    const side = Math.floor(rand() * 3); // 0 : haut, 1 : droite, 2 : bas
    const r = (rand() - 0.5) * 2 * (WORLD_HALF - 2500);
    let p = side === 0 ? { x: r, y: -WORLD_HALF + 200 } : side === 1 ? { x: WORLD_HALF - 200, y: r } : { x: r, y: WORLD_HALF - 200 };
    let h = side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : -Math.PI / 2;
    const pts = [p];
    let turn = 0, ok = true;
    while ((pts.length - 1) * SPINE_STEP < PATH_LEN) {
      const n = pts.length;
      let steer = 0;
      if (n > 14) {
        turn = (turn + (rand() - 0.5) * 0.05) * 0.93;
        // on regarde 900 px devant : trop près d'un bord, on tourne vers le centre ; trop près du couloir déjà tracé, on s'en écarte
        const ax = p.x + Math.cos(h) * 900, ay = p.y + Math.sin(h) * 900;
        if (Math.abs(ax) > WORLD_HALF - MARGIN || Math.abs(ay) > WORLD_HALF - MARGIN) {
          let d = Math.atan2(-p.y, -p.x) - h;
          while (d > Math.PI) d -= 2 * Math.PI;
          while (d < -Math.PI) d += 2 * Math.PI;
          steer += Math.sign(d) * 0.06;
        }
        for (let i = 0; i < n - 30; i += 3) {
          const q = pts[i];
          if (dist2(q.x, q.y, ax, ay) < (SEP + 500) ** 2) {
            steer -= Math.sign(Math.cos(h) * (q.y - p.y) - Math.sin(h) * (q.x - p.x)) * 0.05;
            break;
          }
        }
      }
      h += clamp(turn + steer, -0.09, 0.09);
      p = { x: p.x + Math.cos(h) * SPINE_STEP, y: p.y + Math.sin(h) * SPINE_STEP };
      if (n > 14 && (Math.abs(p.x) > WORLD_HALF - 700 || Math.abs(p.y) > WORLD_HALF - 700)) ok = false;
      for (let i = 0; ok && i < n - 30; i++) if (dist2(pts[i].x, pts[i].y, p.x, p.y) < SEP * SEP) ok = false;
      if (!ok) break;
      pts.push(p);
    }
    if (ok) return pts;
    if (pts.length > best.length) best = pts;
  }
  return best;
}

export class WorldMap {
  readonly spine: Pt[];
  readonly length: number; // longueur réelle de la colonne
  readonly spawn: Pt;
  readonly village: Pt;
  readonly gate: Pt; // porte du village côté camp de départ, où arrive le chemin
  trailGate!: Pt; // porte d'où part la piste vers le bout du couloir
  readonly forge: Pt;
  readonly den: Pt;
  readonly market: Pt;
  readonly hall: Pt; // Hôtel de ville
  readonly store: Pt; // entrepôt (réserve commune de bois et de pierre)
  readonly board: Pt; // panneau du village (tableau des exploits)
  readonly gates: number[] = []; // portes : abscisse le long du couloir ([0] sortie du village, puis début de chaque zone)
  readonly tents: Pt[] = []; // tentes du camp de départ (décalage depuis son feu), à l'opposé du chemin
  readonly sites: Pt[] = []; // emplacements de camp (un au bout de chaque série de 4 zones)
  private siteArcs: number[] = []; // abscisse de chaque emplacement le long du couloir
  readonly siteLayout: { tents: Pt[]; flag: Pt }[] = []; // décalages depuis le feu, à l'écart de la piste qui arrive
  readonly stones: Pt[] = []; // Pierres de passage : [0] au village, puis une par emplacement de camp
  readonly caves: Cave[] = [];
  readonly ores: Ore[] = [];
  readonly decor: Decor[] = [];
  readonly bushes: Bush[] = []; // buissons à fruits (décor franchissable : le gibier vient y manger)
  readonly dens: Pt[] = []; // tanières de suricates (Mer de sable) : buttes percées de trous, franchissables
  readonly path: [number, number][] = []; // chemin de terre du camp à la porte du village
  readonly trails: [number, number][][] = []; // piste du village au bout du couloir, coupée à la traversée des camps
  private buckets = new Map<number, number[]>(); // décor par case de 256 px
  readonly deepWater: number[][] = []; // par zone : x, y à la suite de points en eau profonde
  private segs = new Map<number, number[]>(); // segments de chemin par case de 256 px (ax, ay, bx, by à la suite)
  private water = new Uint8Array(N * N); // 0 libre, 1 eau, 2 solide, 3 forêt, 4 filon ou tas à récolter (voir oreCell)
  private oreCell = new Int32Array(N * N).fill(-1); // case occupée par un filon ou un tas : son index dans ores
  readonly oreDown = new Set<number>(); // filons et tas épuisés : ils ont disparu (on passe à travers) jusqu'à leur retour
  private cdist = new Float32Array(N * N).fill(1e9); // distance à la colonne
  private arc = new Float32Array(N * N); // abscisse (le long de la colonne) du point de colonne le plus proche

  constructor(readonly seed: number) {
    const rand = rng(seed ^ 0x5f3759df);
    this.spine = makeSpine(seed);
    this.length = (this.spine.length - 1) * SPINE_STEP;
    this.stampCorridor();

    this.spawn = this.spineAt(450);
    const village = (this.village = this.spineAt(VILLAGE_ARC));
    this.gate = this.gateToward(this.spawn);
    const away = Math.atan2(this.spawn.y - this.gate.y, this.spawn.x - this.gate.x);
    for (const k of [-1, 1]) this.tents.push({ x: Math.cos(away + k * 1.1) * 100, y: Math.sin(away + k * 1.1) * 100 - 20 });
    this.forge = { x: village.x + FORGE_OFFSET.x, y: village.y + FORGE_OFFSET.y };
    this.den = { x: village.x + DEN_OFFSET.x, y: village.y + DEN_OFFSET.y };
    this.market = { x: village.x + MARKET_OFFSET.x, y: village.y + MARKET_OFFSET.y };
    this.hall = { x: village.x + HALL_OFFSET.x, y: village.y + HALL_OFFSET.y };
    this.store = { x: village.x + STORE_OFFSET.x, y: village.y + STORE_OFFSET.y };
    this.board = { x: village.x + BOARD_OFFSET.x, y: village.y + BOARD_OFFSET.y };
    for (const s of [VILLAGE_ARC + VILLAGE_R + 200, ...Array.from({ length: ZONES - 1 }, (_, k) => (k + 1) * ZONE_LEN)]) if (s < this.length - 300) this.gates.push(s);
    this.stones.push({ x: village.x + VILLAGE_STONE_OFFSET.x, y: village.y + VILLAGE_STONE_OFFSET.y });
    for (let s = 4 * ZONE_LEN; s <= this.length + 1; s += 4 * ZONE_LEN) {
      const at = Math.min(s, this.length) - 650, site = this.spineAt(at), from = this.spineAt(at - 300);
      const a = Math.atan2(from.y - site.y, from.x - site.x); // direction d'où arrive la piste
      const off = (ang: number, d: number) => ({ x: Math.cos(ang) * d, y: Math.sin(ang) * d });
      this.sites.push(site);
      this.siteArcs.push(at);
      this.siteLayout.push({ tents: [off(a + Math.PI - 0.75, 105), off(a + Math.PI + 0.75, 105)], flag: off(a - 1.7, 115) });
      const st = off(a + 1.6, 125);
      this.stones.push({ x: site.x + st.x, y: site.y + st.y });
    }

    this.buildPath();
    this.buildTrail();
    this.indexPaths();

    // Lacs : seulement dans le couloir, hors de la voie centrale, du camp, du village et des emplacements de camp.
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (this.water[k] !== 0 || this.cdist[k] < LANE) continue;
        const p = { x: -WORLD_HALF + (i + 0.5) * MAP_CELL, y: -WORLD_HALF + (j + 0.5) * MAP_CELL };
        if (dist2(p.x, p.y, village.x, village.y) < (VILLAGE_R + 160) ** 2) continue;
        if (dist2(p.x, p.y, this.spawn.x, this.spawn.y) < 320 ** 2) continue;
        if (this.sites.some((c) => dist2(p.x, p.y, c.x, c.y) < 380 ** 2)) continue;
        const threshold = this.arc[k] > DESERT_FROM ? LAKE_THRESHOLD_DESERT : this.arc[k] > LAKES_FROM ? LAKE_THRESHOLD_LAKES : LAKE_THRESHOLD;
        if (this.lakeNoise(p.x, p.y) > threshold && this.pathDist(p.x, p.y) >= 130) this.water[k] = 1;
      }
    }

    // Grottes : deux par zone, dans le tronçon de la zone, sur les côtés du couloir, l'ouverture accessible.
    const free = (x: number, y: number, r: number) => {
      for (let a = 0; a < 8; a++) if (this.blocked(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
      return !this.blocked(x, y);
    };
    const bosses = SPECIES.map((sp, i) => (sp.boss ? i : -1)).filter((i) => i >= 0).sort((x, y) => SPECIES[x].zone - SPECIES[y].zone || x - y);
    for (const boss of bosses) {
      const z = SPECIES[boss].zone;
      const lo = (z - 1) * ZONE_LEN + (z === 1 ? 2300 : 700), hi = z * ZONE_LEN - 700;
      // Écart entre grottes assoupli si la zone est trop encombrée (lacs, camp) : jamais de géant manquant.
      // Le premier passage est inchangé : les cartes qui y arrivent restent identiques.
      for (const gap of [1000, 750, 500, 350]) {
        if (this.caves.some((c) => c.boss === boss)) break;
        for (let tries = 0; tries < 800; tries++) {
          const s = lo + rand() * (hi - lo);
          const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
          const off = (rand() < 0.5 ? -1 : 1) * (300 + rand() * Math.max(0, this.halfWidth(s) - 520));
          const x = sx + n.x * off, y = sy + n.y * off;
          if (this.zoneAt(x, y) !== z || !free(x, y, 120) || !free(x, y + 70, 40)) continue;
          if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < gap ** 2)) continue;
          if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 700 ** 2)) continue; // pas au pied d'un camp
          if (!this.findPath(sx, sy, x, y + 70, 20000)) continue;
          const id = this.caves.length;
          // intérieurs alignés hors du monde, assez espacés pour qu'aucun ne soit visible (ni ses monstres envoyés) depuis un autre
          const inside = { x: WORLD_HALF + 1400 + id * CAVE_GAP, y: 0 };
          this.caves.push({ id, zone: z, boss, entrance: { x, y }, inside, exit: { x: inside.x, y: inside.y + CAVE_RY - 90 } });
          break;
        }
      }
    }

    // Filons d'or : éparpillés le long du couloir, hors de l'eau, du village, des camps et des chemins.
    for (let tries = 0; tries < 8000 && this.ores.length < 120; tries++) {
      const s = 500 + rand() * (this.length - 500);
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 90);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (!free(x, y, 40) || this.inVillage(x, y, 200) || dist2(x, y, this.spawn.x, this.spawn.y) < 300 ** 2) continue;
      if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 350 ** 2)) continue;
      if (this.ores.some((o) => dist2(x, y, o.x, o.y) < 480 ** 2)) continue;
      if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 250 ** 2)) continue;
      if (this.pathDist(x, y) < 60) continue;
      this.ores.push({ id: this.ores.length, x, y, zone: this.zoneAt(x, y), res: 'gold' });
    }

    this.buildDecor();
    this.buildSolids();
    this.buildBushes();
    this.buildHarvest();
    this.buildDens();
    // Eau profonde (pas une berge) par zone : là où peuvent apparaître les créatures aquatiques.
    for (let z = 0; z <= ZONES; z++) this.deepWater.push([]);
    for (let j = 2; j < N - 2; j += 2) {
      for (let i = 2; i < N - 2; i += 2) {
        const x = -WORLD_HALF + (i + 0.5) * MAP_CELL, y = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if (this.isWater(x, y) && this.isWater(x + 40, y) && this.isWater(x - 40, y) && this.isWater(x, y + 40) && this.isWater(x, y - 40)) {
          this.deepWater[this.zoneAt(x, y)].push(x, y);
        }
      }
    }
  }

  // ── Couloir ──

  /** Point de la colonne à l'abscisse s (bornée). */
  spineAt(s: number): Pt {
    const t = clamp(s, 0, this.length) / SPINE_STEP, i = Math.min(Math.floor(t), this.spine.length - 2), f = t - i;
    const a = this.spine[i], b = this.spine[i + 1];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /** Normale (unitaire) de la colonne à l'abscisse s. */
  normalAt(s: number): Pt {
    const a = this.spineAt(s - 150), b = this.spineAt(s + 150), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  }

  /** Demi-largeur du couloir à l'abscisse s : de 600 à 900 px, jusqu'à 250 px de plus dans la zone des lacs. */
  halfWidth(s: number) {
    const lakes = clamp((s - LAKES_FROM + 400) / 1200, 0, 1) * 250;
    return clamp(700 + (fbm(s / 1600, 0.5, this.seed + 91, 2) - 0.5) * 700, 600, 900) + lakes;
  }

  /** Distance et abscisse de la colonne pour chaque case, puis forêt (3) hors du couloir. */
  private stampCorridor() {
    const cells = Math.ceil(STAMP_R / MAP_CELL);
    for (let k = 1; k < this.spine.length; k++) {
      const a = this.spine[k - 1], b = this.spine[k];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) + WORLD_HALF) / MAP_CELL) - cells), i1 = Math.min(N - 1, Math.floor((Math.max(a.x, b.x) + WORLD_HALF) / MAP_CELL) + cells);
      const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) + WORLD_HALF) / MAP_CELL) - cells), j1 = Math.min(N - 1, Math.floor((Math.max(a.y, b.y) + WORLD_HALF) / MAP_CELL) + cells);
      for (let j = j0; j <= j1; j++) {
        const py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        for (let i = i0; i <= i1; i++) {
          const px = -WORLD_HALF + (i + 0.5) * MAP_CELL;
          let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = px - a.x - t * dx, ey = py - a.y - t * dy, d2 = ex * ex + ey * ey, c = j * N + i;
          if (d2 < this.cdist[c] * this.cdist[c]) {
            this.cdist[c] = Math.sqrt(d2);
            this.arc[c] = (k - 1 + t) * SPINE_STEP;
          }
        }
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const c = j * N + i, px = -WORLD_HALF + (i + 0.5) * MAP_CELL, py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        const edge = this.halfWidth(this.arc[c]) + (fbm(px / 260, py / 260, this.seed + 93, 2) - 0.5) * 240;
        if (this.cdist[c] > edge) this.water[c] = 3;
      }
    }
  }

  private cellOf(x: number, y: number) {
    const i = clamp(Math.floor((x + WORLD_HALF) / MAP_CELL), 0, N - 1), j = clamp(Math.floor((y + WORLD_HALF) / MAP_CELL), 0, N - 1);
    return j * N + i;
  }

  /** Abscisse le long du couloir du point de colonne le plus proche (0 au bord de départ). */
  arcAt(x: number, y: number): number {
    const cave = this.caveAt(x, y);
    if (cave) return this.arcAt(cave.entrance.x, cave.entrance.y);
    return this.arc[this.cellOf(x, y)];
  }

  /** Forêt profonde hors du couloir (ou hors du monde) : infranchissable, dessinée en sous-bois sombre. */
  isForest(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return !this.caveAt(x, y);
    return this.water[this.cellOf(x, y)] === 3;
  }

  /** Porte du village (aux 4 points cardinaux) la plus proche de la direction de p. */
  private gateToward(p: Pt, not?: Pt) {
    const v = this.village;
    const gates = [0, 1, 2, 3].map((g) => ({ x: v.x + Math.cos((g * Math.PI) / 2) * (VILLAGE_R + 60), y: v.y + Math.sin((g * Math.PI) / 2) * (VILLAGE_R + 60) }));
    return gates
      .filter((g) => !not || dist2(g.x, g.y, not.x, not.y) > 1)
      .sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y))[0];
  }

  /** Chemin : il serpente depuis le camp puis se redresse pour arriver dans l'axe de la porte. */
  private buildPath() {
    const { spawn: a, gate: g, village: v } = this;
    this.path.push(...this.approach(a, g, v, true));
  }

  /** Segment d'approche d'une porte : ondulation légère, puis alignement dans l'axe de la porte. */
  private approach(a: Pt, g: Pt, v: Pt, wobble: boolean): [number, number][] {
    const out: [number, number][] = [];
    const ox = (g.x - v.x) / Math.hypot(g.x - v.x, g.y - v.y), oy = (g.y - v.y) / Math.hypot(g.x - v.x, g.y - v.y);
    const b = { x: g.x + ox * 170, y: g.y + oy * 170 };
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, w = wobble ? Math.sin(t * Math.PI * 3 + this.seed) * 45 * Math.sin(t * Math.PI) : 0;
      out.push([a.x + dx * t + (-dy / len) * w, a.y + dy * t + (dx / len) * w]);
    }
    const c = { x: g.x + ox * 90, y: g.y + oy * 90 };
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, m = 1 - t;
      out.push([m * m * b.x + 2 * m * t * c.x + t * t * g.x, m * m * b.y + 2 * m * t * c.y + t * t * g.y]);
    }
    return out;
  }

  /** Piste : d'une autre porte du village, le long de la colonne, jusqu'au bout ; elle s'interrompt dans chaque camp. */
  private buildTrail() {
    const s0 = 1550 + VILLAGE_R + 420;
    const join = this.spineAt(s0);
    const g = (this.trailGate = this.gateToward(join, this.gate));
    const along = (from: number, to: number) => {
      const out: [number, number][] = [];
      for (let s = from; s < to; s += SPINE_STEP / 2) {
        const p = this.spineAt(s);
        out.push([p.x, p.y]);
      }
      const last = this.spineAt(to);
      out.push([last.x, last.y]);
      return out;
    };
    const cuts = this.siteArcs.flatMap((s) => [s - 150, s + 150]); // bord du sol de chaque camp
    const bounds = [s0, ...cuts, this.length - 200];
    for (let k = 0; k + 1 < bounds.length; k += 2) {
      const seg = along(bounds[k] + (k ? 0 : SPINE_STEP), bounds[k + 1]);
      this.trails.push(k ? seg : [...this.approach(join, g, this.village, false).reverse(), ...seg]);
    }
  }

  /** Range les segments du chemin et de la piste par case de 256 px (marge de 260 px) pour pathDist. */
  private indexPaths() {
    for (const line of [this.path, ...this.trails]) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1], [bx, by] = line[i];
        for (let gx = Math.floor((Math.min(ax, bx) - 260) / BUCKET); gx <= Math.floor((Math.max(ax, bx) + 260) / BUCKET); gx++) {
          for (let gy = Math.floor((Math.min(ay, by) - 260) / BUCKET); gy <= Math.floor((Math.max(ay, by) + 260) / BUCKET); gy++) {
            const key = gx * 100000 + gy;
            let b = this.segs.get(key);
            if (!b) this.segs.set(key, (b = []));
            b.push(ax, ay, bx, by);
          }
        }
      }
    }
  }

  /** Distance au bord du chemin ou de la piste (négative : dessus), plafonnée à 240 au-delà. */
  pathDist(x: number, y: number) {
    const b = this.segs.get(Math.floor(x / BUCKET) * 100000 + Math.floor(y / BUCKET));
    let best = 260;
    if (b) {
      for (let i = 0; i < b.length; i += 4) {
        const ax = b[i], ay = b[i + 1], dx = b[i + 2] - ax, dy = b[i + 3] - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
      }
    }
    return best - 20;
  }

  /** Arbres et rochers (mêmes règles que l'ancien décor : forêts denses, clairières, abords dégagés). */
  private buildDecor() {
    const n = Math.ceil(WORLD_HALF / DECO_CELL);
    for (let gy = -n; gy < n; gy++) {
      for (let gx = -n; gx < n; gx++) {
        const h = hash2(gx, gy, this.seed + 3);
        const x = (gx + 0.2 + hash2(gx, gy, this.seed + 4) * 0.6) * DECO_CELL;
        const y = (gy + 0.2 + hash2(gx, gy, this.seed + 5) * 0.6) * DECO_CELL;
        if (Math.abs(x) > WORLD_HALF - 20 || Math.abs(y) > WORLD_HALF - 20 || this.isForest(x, y)) continue;
        if (this.inVillage(x, y, 80) || Math.hypot(x - this.spawn.x, y - this.spawn.y) < 230) continue;
        if (this.sites.some((c) => Math.hypot(x - c.x, y - c.y) < 300)) continue;
        if (this.isWater(x, y) || this.isWater(x + 24, y) || this.isWater(x - 24, y) || this.isWater(x, y + 24)) continue;
        if (this.caves.some((c) => Math.hypot(x - c.entrance.x, y - c.entrance.y) < 190)) continue;
        if (this.ores.some((o) => Math.hypot(x - o.x, y - o.y) < 50)) continue;
        const z = this.zoneAt(x, y);
        const f = fbm(x / 700, y / 700, this.seed + 55, 3);
        const c = this.cellOf(x, y), edge = this.cdist[c] > this.halfWidth(this.arc[c]) - 170; // lisière : plus dense
        const forest = (f > 0.56 ? 4.5 : f > 0.48 ? 1.2 : 0.15) * (edge ? 3 : 1);
        const treeP = [0, 0.1, 0.2, 0.09, 0.05, 0.07, 0.025][z] * forest; // désert : de rares cactus
        if (h >= treeP) continue; // les rochers ronds d'autrefois ont disparu : la pierre vient des rochers à casser
        if (this.pathDist(x, y) < 30) continue;
        const d: Decor = { kind: 0, x, y, zone: z };
        const key = Math.floor(x / BUCKET) * 100000 + Math.floor(y / BUCKET);
        let b = this.buckets.get(key);
        if (!b) this.buckets.set(key, (b = []));
        b.push(this.decor.length);
        this.decor.push(d);
      }
    }
  }

  /**
   * Buissons à fruits, surtout dans les premières zones (hasard à part : les cartes existantes ne changent pas).
   * Franchissables, hors de l'eau, des chemins, du village et des camps.
   */
  private buildBushes() {
    const rand = rng(this.seed ^ 0xb0551e5);
    for (let tries = 0; tries < 6000 && this.bushes.length < 110; tries++) {
      const s = 600 + Math.pow(rand(), 1.25) * (this.length - 600); // un peu plus nombreux près du départ
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 80);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (this.blocked(x, y) || this.blocked(x + 20, y) || this.blocked(x - 20, y) || this.inVillage(x, y, 120)) continue;
      if (dist2(x, y, this.spawn.x, this.spawn.y) < 260 ** 2 || this.sites.some((c) => dist2(x, y, c.x, c.y) < 320 ** 2)) continue;
      if (this.pathDist(x, y) < 40 || this.bushes.some((b) => dist2(x, y, b.x, b.y) < 300 ** 2)) continue;
      if (this.ores.some((o) => dist2(x, y, o.x, o.y) < 90 ** 2) || this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 220 ** 2)) continue;
      this.bushes.push({ id: this.bushes.length, x, y, zone: this.zoneAt(x, y) });
    }
  }

  /**
   * Bois mort et rochers à casser, à la suite des filons (hasard à part : le reste de la carte ne change pas).
   * Quelques-uns entre le camp de départ et le village, pour construire avant même de passer la porte.
   */
  private buildHarvest() {
    const rand = rng(this.seed ^ 0x5707e);
    const free = (x: number, y: number) => {
      for (let a = 0; a < 8; a++) if (this.blocked(x + Math.cos(a) * 36, y + Math.sin(a) * 36)) return false;
      return !this.blocked(x, y);
    };
    for (const res of ['wood', 'stone'] as const) {
      let early = 0, total = 0;
      for (let tries = 0; tries < 8000 && total < 70; tries++) {
        // les 4 premiers entre le camp et le village, les autres tout le long du couloir
        const first = early < 4 && tries < 2000;
        const s = first ? 650 + rand() * (VILLAGE_ARC - VILLAGE_R - 750) : 650 + rand() * (this.length - 900);
        const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
        const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 90);
        const x = sx + n.x * off, y = sy + n.y * off;
        if (!free(x, y) || this.inVillage(x, y, 150) || dist2(x, y, this.spawn.x, this.spawn.y) < 260 ** 2) continue;
        if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 350 ** 2) || this.pathDist(x, y) < 50) continue;
        if (this.ores.some((o) => dist2(x, y, o.x, o.y) < (first ? 160 : 300) ** 2) || this.bushes.some((b) => dist2(x, y, b.x, b.y) < 70 ** 2)) continue;
        if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 250 ** 2)) continue;
        this.ores.push({ id: this.ores.length, x, y, zone: this.zoneAt(x, y), res });
        this.solidOre(this.ores[this.ores.length - 1]);
        total++;
        if (s < VILLAGE_ARC) early++;
      }
    }
  }

  /** Tanières de suricates dans la Mer de sable (hasard à part), loin des chemins, de l'eau et les unes des autres. */
  private buildDens() {
    const rand = rng(this.seed ^ 0xde75);
    const lo = 5 * ZONE_LEN + 400, hi = this.length - 400;
    for (let tries = 0; tries < 3000 && this.dens.length < DENS && hi > lo; tries++) {
      const s = lo + rand() * (hi - lo);
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 140);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (this.zoneAt(x, y) !== 6 || this.blocked(x, y) || this.blocked(x + 40, y) || this.blocked(x - 40, y) || this.blocked(x, y + 30)) continue;
      if (this.pathDist(x, y) < 90 || this.dens.some((d) => dist2(x, y, d.x, d.y) < 900 ** 2)) continue;
      if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 400 ** 2) || this.ores.some((o) => dist2(x, y, o.x, o.y) < 120 ** 2)) continue;
      if (this.bushes.some((b) => dist2(x, y, b.x, b.y) < 100 ** 2)) continue;
      this.dens.push({ x, y });
    }
  }

  /** Tanière la plus proche d'un point (-1 s'il n'y en a pas). */
  denNear(x: number, y: number) {
    let best = -1, bd = Infinity;
    this.dens.forEach((d, i) => {
      const k = dist2(x, y, d.x, d.y);
      if (k < bd) [bd, best] = [k, i];
    });
    return best;
  }

  /** Porte (index) que franchit en avançant le déplacement de a vers b, ou -1. */
  gateCrossed(ax: number, ay: number, bx: number, by: number) {
    if (this.caveAt(ax, ay) || this.caveAt(bx, by)) return -1;
    const sa = this.arcAt(ax, ay), sb = this.arcAt(bx, by);
    return sb > sa ? this.gates.findIndex((g) => sa <= g && sb > g) : -1;
  }

  /** Taille d'un arbre ou d'un rocher (même hasard que le dessin). */
  decorSize(d: Decor) {
    return d.kind === 0 ? 26 + hash2(d.x | 0, d.y | 0, this.seed) * 16 : 12 + hash2(d.x | 0, d.y | 0, this.seed + 1) * 14;
  }

  /** Décor dont le centre est dans le rectangle donné. */
  decorIn(x0: number, y0: number, x1: number, y1: number) {
    const out: Decor[] = [];
    for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
      for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) {
        for (const i of this.buckets.get(bx * 100000 + by) ?? []) {
          const d = this.decor[i];
          if (d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1) out.push(d);
        }
      }
    }
    return out;
  }

  // ── Obstacles solides, inscrits dans la grille (valeur 2) ──

  private solidDisc(x: number, y: number, r: number) {
    for (let j = Math.floor((y - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((y + r + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((x - r + WORLD_HALF) / MAP_CELL); i <= Math.floor((x + r + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const cx = -WORLD_HALF + (i + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r && this.water[j * N + i] === 0) this.water[j * N + i] = 2;
      }
    }
  }

  /** Filon ou tas à récolter : solide tant qu'il n'est pas épuisé (voir oreDown). */
  private solidOre(o: Ore) {
    const r = 18 + o.zone * 2;
    for (let j = Math.floor((o.y - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((o.y + r + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((o.x - r + WORLD_HALF) / MAP_CELL); i <= Math.floor((o.x + r + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const cx = -WORLD_HALF + (i + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL, k = j * N + i;
        if ((cx - o.x) ** 2 + (cy - o.y) ** 2 <= r * r && this.water[k] === 0) {
          this.water[k] = 4;
          this.oreCell[k] = o.id;
        }
      }
    }
  }

  /** Case infranchissable (un filon épuisé ne l'est plus). */
  private solid(k: number) {
    const v = this.water[k];
    return v !== 0 && !(v === 4 && this.oreDown.has(this.oreCell[k]));
  }

  private solidRect(x0: number, y0: number, x1: number, y1: number) {
    for (let j = Math.floor((y0 + WORLD_HALF) / MAP_CELL); j <= Math.floor((y1 + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((x0 + WORLD_HALF) / MAP_CELL); i <= Math.floor((x1 + WORLD_HALF) / MAP_CELL); i++) {
        if (i >= 0 && j >= 0 && i < N && j < N && this.water[j * N + i] === 0) this.water[j * N + i] = 2;
      }
    }
  }

  private buildSolids() {
    // arbres (tronc et bas du feuillage) et rochers
    for (const d of this.decor) {
      const s = this.decorSize(d);
      if (d.kind === 0) this.solidDisc(d.x, d.y + s * 0.15, s * 0.45);
      else this.solidDisc(d.x, d.y, s * 0.85);
    }
    for (const o of this.ores) this.solidOre(o);
    // palissade du village, avec ses 4 portes
    const v = this.village;
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      const nearGate = [0, 1, 2, 3, 4].some((g) => Math.abs(a - (g * Math.PI) / 2) < 0.1);
      if (!nearGate) this.solidDisc(v.x + Math.cos(a) * VILLAGE_R, v.y + Math.sin(a) * VILLAGE_R, 13);
    }
    // bâtiments (construits ou non, leur emplacement est clos) : hutte, marché, forge (et son enclume), tanière, feu de camp
    for (const [hx, hy] of [[MARKET_OFFSET.x, MARKET_OFFSET.y], [HALL_OFFSET.x, HALL_OFFSET.y]]) this.solidRect(v.x + hx - 52, v.y + hy - 6, v.x + hx + 52, v.y + hy + 40);
    this.solidRect(v.x + FORGE_OFFSET.x - 74, v.y + FORGE_OFFSET.y - 30, v.x + FORGE_OFFSET.x + 2, v.y + FORGE_OFFSET.y + 38);
    this.solidRect(v.x + FORGE_OFFSET.x + 10, v.y + FORGE_OFFSET.y + 12, v.x + FORGE_OFFSET.x + 54, v.y + FORGE_OFFSET.y + 38);
    for (const k of [-1, 0, 1]) this.solidDisc(v.x + DEN_OFFSET.x + k * 46, v.y + DEN_OFFSET.y - 6, 38);
    this.solidDisc(v.x, v.y, 20);
    this.solidRect(v.x + STORE_OFFSET.x - 36, v.y + STORE_OFFSET.y - 14, v.x + STORE_OFFSET.x + 36, v.y + STORE_OFFSET.y + 14); // entrepôt
    this.solidRect(v.x + BOARD_OFFSET.x - 18, v.y + BOARD_OFFSET.y - 2, v.x + BOARD_OFFSET.x + 18, v.y + BOARD_OFFSET.y + 4); // panneau
    // camp de départ : tentes et cercle de pierres
    const sp = this.spawn;
    for (const t of this.tents) this.solidRect(sp.x + t.x - 36, sp.y + t.y - 6, sp.x + t.x + 36, sp.y + t.y + 26);
    this.solidDisc(sp.x, sp.y, 26);
    // emplacements de camp : cercle de pierres du feu ; Pierres de passage
    for (const c of this.sites) this.solidDisc(c.x, c.y, 26);
    for (const st of this.stones) this.solidDisc(st.x, st.y, 18);
    // butte rocheuse des grottes (l'ouverture, devant, reste libre)
    for (const c of this.caves) {
      const { x, y } = c.entrance;
      this.solidDisc(x - 68, y - 20, 42);
      this.solidDisc(x + 68, y - 20, 42);
      this.solidRect(x - 60, y - 88, x + 60, y - 42);
    }
  }

  /** Grotte dont l'intérieur contient ce point, s'il y en a une. */
  caveAt(x: number, y: number) {
    if (x < WORLD_HALF) return undefined;
    return this.caves.find((c) => {
      const nx = (x - c.inside.x) / CAVE_RX, ny = (y - c.inside.y) / CAVE_RY;
      return nx * nx + ny * ny < caveEdge(c, Math.atan2(ny, nx)) ** 2;
    });
  }

  /** Bruit des lacs : coordonnées tournées et déformées pour des rives organiques, pas alignées sur la grille. */
  private lakeNoise(x: number, y: number) {
    const rx = x * 0.8 - y * 0.6, ry = x * 0.6 + y * 0.8;
    const wx = (fbm(x / 900, y / 900, this.seed + 13, 2) - 0.5) * 700;
    const wy = (fbm(x / 900, y / 900, this.seed + 17, 2) - 0.5) * 700;
    return fbm((rx + wx) / 620, (ry + wy) / 620, this.seed + 77, 4);
  }

  /** Infranchissable : eau, obstacle solide (arbre, rocher, mur) ou hors du monde. */
  blocked(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return !this.caveAt(x, y);
    return this.solid(Math.floor((y + WORLD_HALF) / MAP_CELL) * N + Math.floor((x + WORLD_HALF) / MAP_CELL));
  }

  isWater(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return false;
    return this.water[Math.floor((y + WORLD_HALF) / MAP_CELL) * N + Math.floor((x + WORLD_HALF) / MAP_CELL)] === 1;
  }

  /** Zone de danger (1 à 4) d'un point : tronçon du couloir, frontière déformée par du bruit. */
  zoneAt(x: number, y: number) {
    const cave = this.caveAt(x, y);
    if (cave) return cave.zone;
    return clamp(Math.floor(this.zonePos(x, y)), 1, ZONES);
  }

  /** Position continue le long des zones : 1,5 = milieu de la zone 1, 2,0 = frontière entre les zones 1 et 2. */
  private zonePos(x: number, y: number) {
    const warp = (fbm(x / 1400, y / 1400, this.seed + 31, 2) - 0.5) * 1000;
    return 1 + (this.arcAt(x, y) + warp) / ZONE_LEN;
  }

  /**
   * Affichage seulement (les règles suivent zoneAt) : près d'une frontière, les deux zones voisines se mélangent sur
   * une bande de ZONE_BLEND px. z0 → z1, t de 0 (tout z0) à 1 (tout z1) en traversant la bande ; ailleurs t = 0.
   */
  zoneMix(x: number, y: number) {
    const cave = this.caveAt(x, y);
    if (cave) return { z0: cave.zone, z1: cave.zone, t: 0 };
    const p = this.zonePos(x, y), k = Math.round(p), half = ZONE_BLEND / 2 / ZONE_LEN, d = p - k;
    if (k <= 1 || k > ZONES || Math.abs(d) >= half) {
      const z = clamp(Math.floor(p), 1, ZONES);
      return { z0: z, z1: z, t: 0 };
    }
    const u = (d + half) / (2 * half);
    return { z0: k - 1, z1: k, t: u * u * (3 - 2 * u) };
  }

  /** Zone dont un élément du décor (arbre, buisson, herbe) prend le style : dans la bande de transition, par plaques. */
  styleZone(x: number, y: number) {
    const m = this.zoneMix(x, y);
    if (!m.t) return m.z0;
    return fbm(x / 300, y / 300, this.seed + 71, 2) * 0.7 + hash2(x | 0, y | 0, this.seed + 72) * 0.3 < m.t ? m.z1 : m.z0;
  }

  /** Où l'on réapparaît après une mort en (x, y) : le camp établi le plus avancé qui n'est pas plus loin sur le couloir (-1 : village). */
  respawnSite(x: number, y: number, camps: number[]) {
    const s = this.arcAt(x, y);
    let best = -1, bestS = -1;
    for (const c of camps) {
      const site = this.sites[c];
      if (!site) continue;
      const cs = this.arcAt(site.x, site.y);
      if (cs <= s + 300 && cs > bestS) [best, bestS] = [c, cs];
    }
    return best;
  }

  /** Emplacement de camp (index) dont le rayon contient ce point, ou -1. */
  siteAt(x: number, y: number, r: number) {
    return this.sites.findIndex((c) => dist2(x, y, c.x, c.y) < r * r);
  }

  inVillage(x: number, y: number, margin = 0) {
    return dist2(x, y, this.village.x, this.village.y) < (VILLAGE_R + margin) ** 2;
  }

  /** Ligne droite praticable entre deux points (échantillonnée tous les 8 px). */
  clearLine(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 8);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  /**
   * Chemin qui contourne les obstacles (A* sur la grille de 16 px, 8 directions, sans couper les coins),
   * puis lissé : on ne garde que les points nécessaires. null si rien de trouvé (ou hors du monde).
   */
  findPath(ax: number, ay: number, bx: number, by: number, maxNodes = 5000): Pt[] | null {
    const cell = (v: number) => Math.floor((v + WORLD_HALF) / MAP_CELL);
    const si = cell(ax), sj = cell(ay);
    let gi = cell(bx), gj = cell(by);
    const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
    if (!inside(si, sj) || !inside(gi, gj)) return null;
    if (this.solid(gj * N + gi)) {
      const f = this.freeNear(bx, by);
      [gi, gj] = [cell(f.x), cell(f.y)];
    }
    const goal = gj * N + gi, start = sj * N + si;
    const g = new Map<number, number>([[start, 0]]);
    const from = new Map<number, number>();
    const heap: [number, number][] = [[0, start]]; // [f, index]
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi), dy = Math.abs(j - gj);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const push = (f: number, k: number) => {
      heap.push([f, k]);
      for (let c = heap.length - 1; c > 0; ) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let c = 0; ; ) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    let found = false, expanded = 0;
    while (heap.length && expanded++ < maxNodes) {
      const [, k] = pop();
      if (k === goal) {
        found = true;
        break;
      }
      const ci = k % N, cj = (k - ci) / N, gk = g.get(k)!;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!inside(ni, nj) || this.solid(nj * N + ni)) continue;
          if (di && dj && (this.solid(cj * N + ni) || this.solid(nj * N + ci))) continue; // pas de coin coupé
          const nk = nj * N + ni, ng = gk + (di && dj ? 1.414 : 1);
          if (ng >= (g.get(nk) ?? Infinity)) continue;
          g.set(nk, ng);
          from.set(nk, k);
          push(ng + h(ni, nj), nk);
        }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    for (let k: number | undefined = goal; k !== undefined && k !== start; k = from.get(k)) {
      const i = k % N, j = (k - i) / N;
      cells.push({ x: -WORLD_HALF + (i + 0.5) * MAP_CELL, y: -WORLD_HALF + (j + 0.5) * MAP_CELL });
    }
    cells.reverse();
    // Lissage : depuis chaque point, on saute au plus loin visible en ligne droite.
    const out: Pt[] = [];
    let cur = { x: ax, y: ay }, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(cur.x, cur.y, cells[j].x, cells[j].y)) j--;
      out.push(cells[j]);
      cur = cells[j];
      i = j + 1;
    }
    return out;
  }

  /** Point libre (hors de l'eau) le plus proche autour de (x, y), en spirale. */
  freeNear(x: number, y: number) {
    if (!this.blocked(x, y)) return { x, y };
    for (let r = MAP_CELL; r < 600; r += MAP_CELL) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!this.blocked(px, py)) return { x: px, y: py };
      }
    }
    return { x: this.village.x, y: this.village.y };
  }

  /** Point le plus proche, à moins de maxR, qui vérifie ok (en spirale, de plus en plus loin), ou null. */
  private nearestWhere(x: number, y: number, maxR: number, ok: (x: number, y: number) => boolean) {
    if (ok(x, y)) return { x, y };
    for (let r = MAP_CELL / 2; r <= maxR; r += MAP_CELL / 2) {
      const n = Math.max(12, Math.ceil((r * Math.PI * 2) / MAP_CELL));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  /** Eau navigable la plus proche (pas une flaque en bord de rive : de l'eau tout autour), ou null. */
  waterNear(x: number, y: number, maxR: number) {
    const d = MAP_CELL * 0.6;
    return this.nearestWhere(x, y, maxR, (px, py) => this.isWater(px, py) && this.isWater(px + d, py) && this.isWater(px - d, py) && this.isWater(px, py + d) && this.isWater(px, py - d));
  }

  /** Terre ferme la plus proche (où l'on peut marcher), ou null. */
  landNear(x: number, y: number, maxR: number) {
    return this.nearestWhere(x, y, maxR, (px, py) => !this.blocked(px, py));
  }

  /** Où l'on peut aller : à pied, tout sauf l'eau et les obstacles ; sur une monture nageuse, seulement l'eau. */
  passable(x: number, y: number, swimming: boolean, flying = false) {
    if (flying) return this.caveAt(x, y) ? !this.blocked(x, y) : !this.isForest(x, y); // en vol : tout sauf la forêt du bord
    return swimming ? this.isWater(x, y) : !this.blocked(x, y);
  }
}
