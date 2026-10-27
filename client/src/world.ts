// Terrain procédural par morceaux (chunks) mis en cache, village et plage d'arrivée pré-rendus.
// Tout découle de la WorldMap partagée : zones, lacs, chemin du camp au village.

import { BUILDINGS, CAVE_RX, CAVE_RY, JUNGLE_ZONE, DESERT_ZONE, LAKES_ZONE, DEN_OFFSET, FORGE_OFFSET, BOARD_OFFSET, HALL_OFFSET, MARKET_OFFSET, STORE_OFFSET, SPECIES, VILLAGE_R, campName } from '../../shared/config.ts';
import { fbm, hash2 } from '../../shared/math.ts';
import { atVillageGate, BEACH, BRIDGE_W, caveEdge, coastGreen, MAP_CELL, MOUTH_FADE, SEA_SHALLOW, VILLAGE_GATES, villageEdge, type Cave, type WorldMap } from '../../shared/worldmap.ts';
import { maxDpr, settings } from './settings.ts';
import { drawCocoon, drawEntrance, drawWeb, INSIDE, insideProp, liana } from './caves.ts';

const CHUNK = 512;
const TILE = MAP_CELL;
const DECO_CELL = 96;
const TAU = Math.PI * 2;

// Couleur du sol : 0 = village, 1 à 6 = zones de danger. Mer : peu profonde le long de la côte, sombre au large ; plage de sable.
export const SEA_DEEP = [24, 64, 92];
const SEA_SHALLOW_COL = [52, 138, 156];
const BEACH_SAND = [222, 202, 150];
const FOAM = [226, 240, 236];
const LAKE_WATER = [61, 127, 140]; // mêmes bleus que l'eau des lacs (#3D7F8C, #2E6574)
const LAKE_DEEP = [46, 101, 116];
const LAKE_BANK = [94, 107, 73]; // berge des lacs (#5E6B49)
const MOUTH_SURF = 150; // en mer, l'écume et le sable s'effacent à l'approche d'une embouchure
export const ZONE_GROUND = [[74, 94, 62], [63, 106, 59], [52, 88, 57], [72, 82, 48], [44, 69, 66], [56, 82, 76], [40, 74, 40], [204, 172, 114]]; // 0 village, 1 à 7 les zones (6 : jungle)
const STEPPE = [124, 140, 78]; // lisière verte entre le sable du désert et la mer
const PATH = [110, 97, 66];
const VILLAGE_GROUND = [79, 101, 63]; // herbe de la place, tondue

// Style commun à tous les chemins de terre : liseré sombre, terre, trace claire au centre. [r, g, b, alpha, largeur]
const PATH_PASSES: [number, number, number, number, number][] = [[60, 50, 32, 0.35, 50], [110, 97, 66, 1, 40], [140, 124, 88, 0.35, 14]];
/** 75 → « 1:15 », 3700 → « 1:01:40 ». */
const clockOf = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = String(Math.floor(sec % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
const rgba = (p: number[], a = p[3]) => `rgba(${p[0]},${p[1]},${p[2]},${a})`;

// Emprise au sol de chaque bâtiment (décalage depuis le centre du village), pour dessiner son chantier.
type Plot = 'forge' | 'den' | 'market';
const PLOTS: Record<Plot, { x0: number; y0: number; x1: number; y1: number }> = {
  forge: { x0: FORGE_OFFSET.x - 80, y0: FORGE_OFFSET.y - 40, x1: FORGE_OFFSET.x + 62, y1: FORGE_OFFSET.y + 44 },
  den: { x0: DEN_OFFSET.x - 84, y0: DEN_OFFSET.y - 50, x1: DEN_OFFSET.x + 84, y1: DEN_OFFSET.y + 34 },
  market: { x0: MARKET_OFFSET.x - 58, y0: MARKET_OFFSET.y - 12, x1: MARKET_OFFSET.x + 58, y1: MARKET_OFFSET.y + 46 },
};

// Arbres : formes pré-dessinées à la taille de référence (le plus grand arbre), puis réduites à la taille de chacun.
const TREE_REF = 42;
const TREE_VARIANTS = 6;
const TREE_BOX = { l: TREE_REF * 1.3 + 6, t: TREE_REF * 1.95 + 6, w: (TREE_REF * 1.3 + 6) * 2, h: TREE_REF * 2.55 + 12 }; // autour du pied

const lerp3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Herbe du village fondue dans celle du biome : pleine jusqu'à la palissade, puis s'efface sur VILLAGE_BLEND px.
const VILLAGE_BLEND = 240;

/** Part du village dans le sol d'un point : 1 jusqu'à la palissade, puis 0 au bout du fondu, au bord irrégulier. */
export function villageMix(map: WorldMap, x: number, y: number) {
  const d = Math.hypot(x - map.village.x, y - map.village.y) - villageEdge(Math.atan2(y - map.village.y, x - map.village.x));
  if (d <= 0) return 1;
  if (d >= VILLAGE_BLEND * 1.25) return 0;
  const u = Math.min(1, Math.max(0, d / VILLAGE_BLEND + (fbm(x / 160, y / 160, map.seed + 74, 2) - 0.5) * 0.5));
  return 1 - u * u * (3 - 2 * u);
}

/**
 * Couleur du sol d'un point (hors sous-bois) : celle de sa zone, ou près d'une frontière un fondu entre les deux
 * zones, au bord irrégulier (un peu de bruit sur le mélange). Autour du village, l'herbe du village s'y fond.
 */
export function groundColor(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  let col = ZONE_GROUND[m.z0];
  if (m.t) col = lerp3(col, ZONE_GROUND[m.z1], Math.min(1, Math.max(0, m.t + (fbm(x / 240, y / 240, map.seed + 73, 2) - 0.5) * 0.45)));
  const g = coastGreen(map, x, y);
  if (g) col = lerp3(col, STEPPE, g);
  const v = villageMix(map, x, y);
  if (v) col = lerp3(col, VILLAGE_GROUND, v);
  // sous la canopée de la jungle : de grandes ombres de feuillage, et des taches de soleil là où il perce
  const j = jungleMix(map, x, y);
  if (j) {
    const sh = fbm(x / 210, y / 210, map.seed + 141, 3), k = 1 - j * (0.32 * smooth((sh - 0.35) / 0.3) - 0.14 * smooth((0.3 - sh) / 0.12));
    col = [col[0] * k, col[1] * k, col[2] * k];
  }
  return col;
}

/** Part de jungle en un point (0 ailleurs, 1 en pleine jungle, en fondu à la frontière). */
export function jungleMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === JUNGLE_ZONE ? 1 - m.t : 0) + (m.z1 === JUNGLE_ZONE ? m.t : 0);
}

/** Part de Lacs brumeux en un point (pour la brume légère qui y flotte). */
export function lakesMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === LAKES_ZONE ? 1 - m.t : 0) + (m.z1 === LAKES_ZONE ? m.t : 0);
}

/** Part de Mer de sable en un point (0 ailleurs, 1 en plein désert, en fondu à la frontière). */
export function desertMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === DESERT_ZONE ? 1 - m.t : 0) + (m.z1 === DESERT_ZONE ? m.t : 0);
}

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** En mer, part du rivage (écume, sable) : 1 loin des embouchures, 0 face à l'eau d'un lac qui s'y jette. */
export const surfAt = (map: WorldMap, x: number, y: number) => smooth(map.mouthAt(x, y) / MOUTH_SURF);

/** Dans un lac, part de la mer : 1 à l'embouchure, 0 à MOUTH_FADE (à travers l'eau) et dans les lacs fermés. */
export const mouthMix = (map: WorldMap, x: number, y: number) => 1 - smooth(map.mouthAt(x, y) / MOUTH_FADE);

/** Couleur de la mer : claire le long de la côte, de plus en plus sombre vers le large. */
export function seaColor(map: WorldMap, x: number, y: number, surf = true) {
  const sh = map.shoreAt(x, y), col = lerp3(SEA_SHALLOW_COL, SEA_DEEP, Math.min(1, Math.max(0, sh) / (SEA_SHALLOW + 500)));
  const foam = surf ? Math.max(0, 1 - sh / 70) * surfAt(map, x, y) : 0; // écume au bord, fondue (pas de chapelet de bulles)
  return foam ? lerp3(col, FOAM, foam * foam * 0.75) : col;
}

/** Eau d'un lac (profonde ou non), qui passe au bleu de la mer près d'une embouchure. */
export function lakeColor(map: WorldMap, x: number, y: number, deep: boolean, base = deep ? LAKE_DEEP : LAKE_WATER) {
  const k = mouthMix(map, x, y);
  return k ? lerp3(base, SEA_SHALLOW_COL, k) : base;
}

// Relief en paliers (affichage seulement : on passe partout) : les collines sont découpées en TERRACES niveaux ; au bord
// de chaque palier tourné vers le bas de l'écran, une petite falaise (CLIFF_H px) avec ses strates et son ombre portée.
const TERRACES = 7;
const CLIFF_H = 28;
const CLIFF_G = 6; // résolution des falaises (px)
/** Palier d'un point (0 : au niveau de la mer) ; le bord des paliers ondule un peu. */
export function terraceAt(map: WorldMap, x: number, y: number) {
  const h = map.height(x, y);
  if (h <= 0) return 0;
  return Math.max(0, Math.min(TERRACES - 1, Math.floor((h + (fbm(x / 140, y / 140, map.seed + 410, 2) - 0.5) * 0.06) * TERRACES)));
}

/**
 * Couleur d'un point de l'île vu d'en haut : son sol, la plage au bord de la mer, et le relief (versants
 * éclairés au nord-ouest, à l'ombre au sud-est ; sommets un peu plus clairs).
 */
export function landColor(map: WorldMap, x: number, y: number) {
  let col = groundColor(map, x, y);
  const sh = map.shoreAt(x, y);
  if (sh > -BEACH) col = lerp3(col, BEACH_SAND, Math.min(1, (sh + BEACH) / (BEACH * 0.7)));
  const e = 24, h = map.height(x, y);
  const slope = (map.height(x - e, y - e) - map.height(x + e, y + e)) * 9;
  // chaque palier un peu plus clair que celui du dessous
  const k = 1 + Math.max(-0.22, Math.min(0.22, slope)) * 0.6 + (h - 0.5) * 0.04 + (terraceAt(map, x, y) - 3) * 0.028;
  return [col[0] * k, col[1] * k, col[2] * k];
}

const rgb = (c: number[], k: number) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;

export class World {
  private chunks = new Map<string, HTMLCanvasElement>();
  readonly village: HTMLCanvasElement;
  readonly villageSize = (VILLAGE_R * 1.3 + 120) * 2;
  readonly camp: HTMLCanvasElement;
  readonly campSize = 420;
  readonly seed: number;

  /** Pieux de la palissade (coordonnées du monde), de hauteur un peu irrégulière ; poteaux des 4 portes. */
  readonly stakes: { x: number; y: number; h: number; next?: { x: number; y: number } }[] = [];
  readonly gatePosts: { x: number; y: number; side: number; s: number }[] = [];

  constructor(readonly map: WorldMap) {
    this.seed = map.seed;
    const v = map.village;
    const at = (a: number) => ({ x: v.x + Math.cos(a) * villageEdge(a), y: v.y + Math.sin(a) * villageEdge(a) });
    // un pieu tous les 18 px environ le long de la palissade (elle n'est pas ronde : on suit son contour)
    const marks: number[] = [];
    for (let a = 0, prev = at(0); a < TAU; a += 0.002) {
      const p = at(a);
      if (!marks.length || Math.hypot(p.x - prev.x, p.y - prev.y) >= 18) {
        marks.push(a);
        prev = p;
      }
    }
    marks.forEach((a, i) => {
      if (atVillageGate(a)) return;
      // traverse jusqu'au pieu suivant, sauf devant une porte
      const b = marks[(i + 1) % marks.length];
      this.stakes.push({ ...at(a), h: 20 + ((i * 7) % 5) * 1.6, next: atVillageGate(b) ? undefined : at(b) });
    });
    // poteaux de chaque porte, de part et d'autre de son ouverture
    VILLAGE_GATES.forEach((g, side) => {
      for (const s of [-1, 1]) {
        let a = g;
        while (atVillageGate(a) && Math.abs(a - g) < 1) a += s * 0.002;
        this.gatePosts.push({ ...at(a), side: (side + 4) % 4, s });
      }
    });
    this.village = this.drawVillage();
    this.camp = this.drawCamp();
  }

  /** Zone d'un point pour l'affichage (0 si dans le village) : près d'une frontière, l'une ou l'autre par plaques. */
  zone(x: number, y: number) {
    const v = villageMix(this.map, x, y);
    return v && hash2(x | 0, y | 0, this.seed + 75) < v ? 0 : this.map.styleZone(x, y);
  }


  /** Dessine les chunks visibles du rectangle monde [x0,x1]×[y0,y1]. */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const cx0 = Math.floor(x0 / CHUNK), cx1 = Math.floor(x1 / CHUNK);
    const cy0 = Math.floor(y0 / CHUNK), cy1 = Math.floor(y1 / CHUNK);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK + 1.5, CHUNK + 1.5); // léger recouvrement : pas de couture
      }
    }
    // Cache LRU : on oublie le morceau affiché il y a le plus longtemps (jamais un morceau à l'écran).
    // 40 morceaux de 1 Mo suffisent largement (une dizaine à l'écran au plus) et ménagent la mémoire des mobiles.
    // (moins en qualité basse ou moyenne : 16 ou 28 morceaux)
    const keep = ({ low: 16, medium: 28, high: 40 } as const)[settings.display.quality];
    while (this.chunks.size > keep) this.chunks.delete(this.chunks.keys().next().value!);
  }

  private chunk(cx: number, cy: number) {
    const k = `${cx},${cy}`;
    let c = this.chunks.get(k);
    if (c) {
      this.chunks.delete(k); // remis en fin de file : récemment affiché
      this.chunks.set(k, c);
      return c;
    }
    c = document.createElement('canvas');
    c.width = c.height = CHUNK;
    const ctx = c.getContext('2d')!;
    const ox = cx * CHUNK, oy = cy * CHUNK;
    ctx.translate(-ox, -oy);
    const { map } = this;

    // Sol : une couleur par case (teinte de zone, plage, mer, relief, prairies plus claires), puis agrandie avec
    // lissage : pas de marches d'escalier entre le sable et l'herbe, ni de relief en pavés. Une case de marge tout autour
    // (les morceaux voisins ont les mêmes au bord : pas de couture).
    const T = CHUNK / TILE + 2, ground = this.groundTiles(T);
    for (let j = 0; j < T; j++) {
      for (let i = 0; i < T; i++) {
        const px = ox + (i - 1) * TILE + TILE / 2, py = oy + (j - 1) * TILE + TILE / 2;
        const sea = map.isSea(px, py), sh = map.caveAt(px, py) ? -1e9 : map.shoreAt(px, py);
        const meadow = fbm(px / 420, py / 420, this.seed + 3, 2);
        const v = sea ? 0.97 + meadow * 0.06 : 0.93 + meadow * 0.12;
        let col = sea ? seaColor(map, px, py) : landColor(map, px, py);
        // Près d'une embouchure, l'eau du lac est peinte avec le sol (les disques s'y effacent, voir plus bas) ; son bord
        // est adouci comme celui de la côte : part d'eau parmi les cases voisines (pondérées), pas de marches.
        let wet = 0, mouth = false;
        const water = [0, 0, 0];
        if (!sea) {
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const qx = px + di * TILE, qy = py + dj * TILE, inSea = map.isSea(qx, qy);
              if (!inSea && (!map.isWater(qx, qy) || map.mouthAt(qx, qy) >= MOUTH_FADE)) continue;
              mouth ||= !inSea;
              const wt = (di ? 1 : 2) * (dj ? 1 : 2), deep = [1, -1].every((d) => map.isWater(qx + d * 2 * TILE, qy) && map.isWater(qx, qy + d * 2 * TILE)); // comme les disques des lacs
              const c = inSea ? seaColor(map, qx, qy, false) : lakeColor(map, qx, qy, deep);
              for (let n = 0; n < 3; n++) water[n] += c[n] * wt;
              wet += wt;
            }
          }
        }
        if (mouth) {
          const u = wet / 16;
          col = lerp3(col, water.map((c) => c / wet), u * u * (3 - 2 * u));
        } else if (Math.abs(sh) < 32) {
          // au bord de l'eau, la mer et le sable se fondent : la côte est continue une fois agrandie (pas de marches) ;
          // face à une embouchure, la mer reste de l'eau (pas de sable sous l'eau du lac qui s'y jette)
          const k = (sh + 32) / 64, f = k * k * (3 - 2 * k), s = sea ? surfAt(map, px, py) : 1;
          if (s) col = lerp3(col, lerp3(sea ? landColor(map, px, py) : col, sea ? col : seaColor(map, px, py), f), s);
        }
        const o = (j * T + i) * 4;
        ground.img.data[o] = col[0] * v;
        ground.img.data[o + 1] = col[1] * v;
        ground.img.data[o + 2] = col[2] * v;
        ground.img.data[o + 3] = 255;
      }
    }
    ground.ctx.putImageData(ground.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ground.canvas, ox - TILE, oy - TILE, T * TILE, T * TILE);
    this.drawCliffs(ctx, ox, oy);

    // Quelques vagues au large (l'écume du bord est dans la couleur de la mer : voir seaColor).
    ctx.strokeStyle = 'rgba(220,240,245,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let gy = Math.floor(oy / 64); gy <= (oy + CHUNK) / 64; gy++) {
      for (let gx = Math.floor(ox / 64); gx <= (ox + CHUNK) / 64; gx++) {
        if (hash2(gx, gy, this.seed + 61) > 0.12) continue;
        const x = (gx + hash2(gy, gx, this.seed + 62)) * 64, y = (gy + hash2(gx, gy, this.seed + 63)) * 64;
        if (!map.isSea(x, y) || map.shoreAt(x, y) < 90) continue;
        ctx.moveTo(x - 10, y);
        ctx.quadraticCurveTo(x - 3, y - 5, x + 4, y);
        ctx.quadraticCurveTo(x + 9, y + 3, x + 14, y - 1);
      }
    }
    ctx.stroke();

    // Petits chemins (de la plage au pont, du pont au village) : sable tassé, bordé de petits cailloux.
    // Bouts droits : le raccord avec le pont et la route du village, dans le même axe, est invisible.
    for (const path of map.paths) {
      ctx.strokeStyle = 'rgba(214,196,150,0.9)';
      ctx.lineWidth = 26;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(160,140,100,0.35)';
      ctx.lineWidth = 8;
      ctx.stroke();
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = path[i - 1], [bx, by] = path[i], l = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / l, ny = (bx - ax) / l;
        for (let d = 0; d < l; d += 12) {
          const x = ax + ((bx - ax) * d) / l, y = ay + ((by - ay) * d) / l, h = hash2(Math.round(x), Math.round(y), this.seed + 64);
          if (x < ox - 20 || x > ox + CHUNK + 20 || y < oy - 20 || y > oy + CHUNK + 20) continue;
          for (const side of [-1, 1]) {
            const off = side * (13 + h * 4), r = 2.5 + hash2(Math.round(y), side, this.seed + 65) * 2.5;
            ctx.fillStyle = side > 0 ? '#8C8F88' : '#A3A69E';
            ctx.beginPath();
            ctx.ellipse(x + nx * off, y + ny * off, r, r * 0.75, h * 3, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    // Lacs (pas la mer) : disques par case pour des berges arrondies (berge, puis eau, puis eau profonde).
    // Près d'une embouchure, ils passent par paliers au bleu de la mer et s'effacent : l'eau peinte avec le sol prend le relais.
    const STEPS = 12;
    const water: [number, number, boolean, number][] = []; // x, y, profonde, palier vers la mer (0 : lac)
    for (let ty = oy - TILE; ty < oy + CHUNK + TILE; ty += TILE) {
      for (let tx = ox - TILE; tx < ox + CHUNK + TILE; tx += TILE) {
        const px = tx + TILE / 2, py = ty + TILE / 2;
        if (!map.isWater(px, py) || map.isSea(px, py)) continue;
        const deep = map.isWater(px + 2 * TILE, py) && map.isWater(px - 2 * TILE, py) && map.isWater(px, py + 2 * TILE) && map.isWater(px, py - 2 * TILE);
        water.push([px, py, deep, Math.round(mouthMix(map, px, py) * STEPS)]);
      }
    }
    if (water.length) {
      for (const [base, rad, onlyDeep] of [[LAKE_BANK, 17, false], [LAKE_WATER, 13.5, false], [LAKE_DEEP, 14, true]] as const) {
        for (let step = 0; step < STEPS; step++) {
          ctx.fillStyle = rgb(lerp3(base, SEA_SHALLOW_COL, step / STEPS), 1);
          ctx.globalAlpha = 1 - step / STEPS;
          ctx.beginPath();
          let any = false;
          for (const [px, py, deep, s] of water) {
            if (s !== step || (onlyDeep && !deep)) continue;
            // un peu de désordre : des berges arrondies et irrégulières, pas des bords au cordeau
            const jx = (hash2(px, py, this.seed + 31) - 0.5) * 6, jy = (hash2(py, px, this.seed + 32) - 0.5) * 6, r = rad + (hash2(px, py, this.seed + 33) - 0.5) * 5;
            ctx.moveTo(px + jx + r, py + jy);
            ctx.arc(px + jx, py + jy, r, 0, TAU);
            any = true;
          }
          if (any) ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // marigots de la jungle : une eau verte et trouble, par paliers selon la part de jungle
      const swamp: [number, number, number][] = [];
      for (const [px, py] of water) {
        const j = jungleMix(map, px, py);
        if (j > 0.05) swamp.push([px, py, Math.min(3, Math.floor(j * 4))]);
      }
      for (let step = 0; step < 4; step++) {
        ctx.fillStyle = `rgba(52,82,44,${0.14 * (step + 1)})`;
        ctx.beginPath();
        let any = false;
        for (const [px, py, s] of swamp) {
          if (s !== step) continue;
          ctx.moveTo(px + 13.5, py);
          ctx.arc(px, py, 13.5, 0, TAU);
          any = true;
        }
        if (any) ctx.fill();
      }
      // reflets
      ctx.strokeStyle = 'rgba(200,235,240,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [px, py, deep] of water) {
        if (!deep || hash2(px, py, this.seed + 21) > 0.08) continue;
        ctx.moveTo(px - 7, py);
        ctx.lineTo(px + 7, py);
      }
      ctx.stroke();
    }

    // Épave du bout de l'île, couchée sur le sable (dessinée avec le sol : elle ne bouge pas).
    const sw = map.shipwreck;
    if (sw.x > ox - 220 && sw.x < ox + CHUNK + 220 && sw.y > oy - 220 && sw.y < oy + CHUNK + 220) {
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(sw.a);
      drawShipwreck(ctx);
      ctx.restore();
    }

    // Tanières de suricates : butte de sable percée de trous.
    for (const d of map.dens) {
      if (d.x < ox - 80 || d.x > ox + CHUNK + 80 || d.y < oy - 80 || d.y > oy + CHUNK + 80) continue;
      ctx.fillStyle = 'rgba(120,88,52,0.35)';
      ctx.beginPath();
      ctx.ellipse(d.x + 4, d.y + 6, 62, 26, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#D6B27A';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, 58, 24, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#E3C38E';
      ctx.beginPath();
      ctx.ellipse(d.x - 10, d.y - 6, 34, 11, 0, 0, TAU);
      ctx.fill();
      for (const [hx, hy, hr] of [[-30, 2, 9], [-4, -8, 10], [22, 4, 9], [40, -6, 7]] as const) {
        ctx.fillStyle = '#B08A55';
        ctx.beginPath();
        ctx.ellipse(d.x + hx, d.y + hy + 2, hr + 3, hr * 0.55 + 2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#2E2016';
        ctx.beginPath();
        ctx.ellipse(d.x + hx, d.y + hy + 1, hr, hr * 0.5, 0, 0, TAU);
        ctx.fill();
      }
    }

    // Décor : on inclut une marge de cellules pour que les arbres à cheval soient complets.
    const m = 1;
    const gx0 = Math.floor(ox / DECO_CELL) - m, gx1 = Math.floor((ox + CHUNK) / DECO_CELL) + m;
    const gy0 = Math.floor(oy / DECO_CELL) - m, gy1 = Math.floor((oy + CHUNK) / DECO_CELL) + m;
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) this.smallDeco(ctx, gx, gy);
    this.chunks.set(k, c);
    return c;
  }

  /**
   * Falaise possible ici (0 à 1) : sur la terre ferme, et qui s'efface en douceur à l'approche de l'eau, du village, des
   * camps, des grottes et de l'épave (pas de paroi coupée net).
   */
  private cliffFade(x: number, y: number) {
    const m = this.map;
    if (m.caveAt(x, y) || m.isWater(x, y)) return 0;
    const fade = (d: number, r: number) => Math.max(0, Math.min(1, (d - r) / 140));
    let f = fade(-m.shoreAt(x, y), 90);
    f = Math.min(f, fade(Math.hypot(x - m.village.x, y - m.village.y), VILLAGE_R * 1.3 + 120));
    f = Math.min(f, fade(Math.hypot(x - m.shipwreck.x, y - m.shipwreck.y), 360));
    for (const c of m.sites) f = Math.min(f, fade(Math.hypot(x - c.x, y - c.y), 380));
    for (const c of m.caves) if (f > 0 && Math.abs(x - c.entrance.x) < 400 && Math.abs(y - c.entrance.y) < 400) f = Math.min(f, fade(Math.hypot(x - c.entrance.x, y - c.entrance.y), 170));
    return f;
  }

  /**
   * Falaises des paliers, peintes sur le sol d'un morceau : sous chaque bord tourné vers le bas de l'écran, la paroi
   * (strates, plus sombre en bas) et son ombre sur le palier inférieur ; un liseré clair sur l'arête ; les autres bords,
   * un simple trait d'ombre.
   */
  private drawCliffs(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
    const G = CLIFF_G, UP = Math.ceil(CLIFF_H / G) + 3; // rangées au-dessus du morceau (une falaise peut y commencer)
    const W = Math.ceil(CHUNK / G) + 2, H = Math.ceil(CHUNK / G) + 2, gh = H + UP + 1;
    const x0 = ox - G, y0 = oy - G - UP * G;
    const lv = new Int8Array(W * gh), fd = new Float32Array(W * gh);
    let any = false;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < W; i++) {
        const x = x0 + i * G + G / 2, y = y0 + j * G + G / 2;
        const f = this.cliffFade(x, y), good = f > 0;
        fd[j * W + i] = f;
        lv[j * W + i] = good ? terraceAt(this.map, x, y) : -1;
        if (good && i && lv[j * W + i] !== lv[j * W + i - 1] && lv[j * W + i - 1] >= 0) any = true;
        if (good && j && lv[j * W + i] !== lv[(j - 1) * W + i] && lv[(j - 1) * W + i] >= 0) any = true;
      }
    }
    if (!any) return;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c2 = canvas.getContext('2d')!, img = c2.createImageData(W, H);
    const L = (i: number, j: number) => lv[j * W + i];
    const put = (i: number, j: number, col: number[], a: number) => {
      a *= fd[j * W + i];
      const o = ((j - UP - 1) * W + i) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = a * 255;
    };
    const steps = Math.round(CLIFF_H / G);
    for (let j = UP + 1; j < gh; j++) {
      for (let i = 0; i < W; i++) {
        const me = L(i, j);
        if (me < 0) continue;
        // paroi : un palier plus haut juste au-dessus (à moins de CLIFF_H) dont l'arête est au-dessus de nous
        let d = 0;
        for (let k = 1; k <= steps; k++) {
          const up = L(i, j - k);
          if (up > me) {
            d = k;
            break;
          }
          if (up < me) break;
        }
        const x = x0 + i * G + G / 2, y = y0 + j * G + G / 2;
        if (d) {
          // paroi : la roche prend la teinte du sol (grès clair dans le désert, terre et pierre ailleurs)
          const base = groundColor(this.map, x, y), light = (base[0] + base[1] + base[2]) / 3 > 150;
          const rock = light ? lerp3(base, [196, 150, 100], 0.4) : lerp3(base, [128, 106, 84], 0.55);
          const t = d / steps, strata = Math.floor((y + hash2(Math.floor(x / 30), 0, this.seed + 412) * 8) / 7) % 2 ? 0.88 : 1;
          const shade = (light ? 0.92 - t * 0.3 : 0.8 - t * 0.38) * strata; // claire sous l'arête, sombre au pied
          put(i, j, [rock[0] * shade, rock[1] * shade, rock[2] * shade], 1);
          continue;
        }
        // ombre portée au pied de la paroi
        const s1 = L(i, j - steps - 1), s2 = L(i, j - steps - 2);
        if (s1 > me || s2 > me) {
          put(i, j, [10, 16, 14], s1 > me ? 0.3 : 0.15);
          continue;
        }
        // arête éclairée : le palier du dessous commence juste en dessous
        const below = j + 1 < gh ? L(i, j + 1) : me;
        if (below >= 0 && below < me) {
          put(i, j, [255, 250, 225], 0.22);
          continue;
        }
        // bord tourné vers le haut de l'écran ou sur le côté : un trait d'ombre discret
        const n = L(i, j - 1), l = i ? L(i - 1, j) : me, r = i + 1 < W ? L(i + 1, j) : me;
        if ((n >= 0 && n < me) || (l >= 0 && l !== me) || (r >= 0 && r !== me)) put(i, j, [10, 16, 14], 0.16);
      }
    }
    c2.putImageData(img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, ox - G, oy - G, W * G, H * G);
    ctx.restore();
  }

  private ground?: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData };
  /** Petite image (une case du sol par pixel) réutilisée pour chaque morceau. */
  private groundTiles(T: number) {
    if (!this.ground) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = T;
      const ctx = canvas.getContext('2d')!;
      this.ground = { canvas, ctx, img: ctx.createImageData(T, T) };
    }
    return this.ground;
  }

  private smallDeco(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
    for (let i = 0; i < 4; i++) {
      const h = hash2(gx * 7 + i, gy * 13 - i, this.seed + 11);
      const x = (gx + hash2(gx, gy * 3 + i, this.seed + 12)) * DECO_CELL;
      const y = (gy + hash2(gx * 5 + i, gy, this.seed + 13)) * DECO_CELL;
      if (this.map.isWater(x, y) && !this.map.isSea(x, y) && h < 0.16 && jungleMix(this.map, x, y) > 0.5) {
        // nénuphars sur les marigots de la jungle, parfois en fleur
        ctx.fillStyle = 'rgba(10,30,20,0.35)';
        ctx.beginPath();
        ctx.ellipse(x + 2, y + 2, 9, 5.5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = h < 0.08 ? '#4E8A3A' : '#5E9A44';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.ellipse(x, y, 9, 5.5, 0, 0.35, TAU - 0.05);
        ctx.closePath();
        ctx.fill();
        if (h < 0.05) {
          ctx.fillStyle = '#F2C4D8';
          for (let k = 0; k < 5; k++) {
            ctx.beginPath();
            ctx.ellipse(x - 2 + Math.cos(k * 1.26) * 3, y - 2 + Math.sin(k * 1.26) * 1.8, 2.4, 1.4, k * 1.26, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#F0D060';
          ctx.beginPath();
          ctx.arc(x - 2, y - 2, 1.4, 0, TAU);
          ctx.fill();
        }
        continue;
      }
      if (this.map.isForest(x, y) || this.map.isWater(x, y)) continue;
      if (this.map.shoreAt(x, y) > -BEACH) {
        // plage : coquillages, bois flotté, étoile de mer
        if (h < 0.18) {
          ctx.fillStyle = ['#F2E6D8', '#E8C9B8', '#F4EDE0'][Math.floor(h * 100) % 3];
          ctx.beginPath();
          ctx.ellipse(x, y, 3.5, 2.5, h * 9, 0, TAU);
          ctx.fill();
        } else if (h < 0.24) {
          ctx.strokeStyle = '#9C8462';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x - 9, y + 2);
          ctx.lineTo(x + 9, y - 2);
          ctx.stroke();
        } else if (h < 0.26) {
          ctx.fillStyle = '#E8693F';
          ctx.beginPath();
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * TAU, r = k % 2 ? 2 : 5;
            if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            else ctx.moveTo(x + r, y);
          }
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      const z = this.zone(x, y);
      if (z === JUNGLE_ZONE) {
        this.jungleDeco(ctx, x, y, h, gx * 7 + i);
        continue;
      }
      if (z === DESERT_ZONE && coastGreen(this.map, x, y) < 0.45) {
        // Mer de sable : rides du vent, cailloux, touffes sèches, de rares ossements
        if (h < 0.35) {
          ctx.strokeStyle = 'rgba(150,112,64,0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.quadraticCurveTo(x, y - 5, x + 14, y);
          ctx.stroke();
        } else if (h < 0.5) {
          ctx.fillStyle = 'rgba(120,90,60,0.45)';
          ctx.beginPath();
          ctx.ellipse(x, y, 3.5, 2.5, 0, 0, TAU);
          ctx.fill();
        } else if (h < 0.6) {
          ctx.strokeStyle = 'rgba(150,130,60,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (const dx of [-5, -2, 2, 5]) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + dx * 1.4, y - 7 - Math.abs(dx) * 0.4);
          }
          ctx.stroke();
        } else if (h < 0.62) {
          ctx.fillStyle = '#EDE3CC';
          ctx.beginPath();
          ctx.ellipse(x, y, 5, 3.5, 0.3, 0, TAU);
          ctx.ellipse(x + 8, y + 1, 4, 1.4, 0.2, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#3A2A1C';
          ctx.beginPath();
          ctx.arc(x - 1.5, y - 0.5, 1, 0, TAU);
          ctx.arc(x + 1.5, y - 0.5, 1, 0, TAU);
          ctx.fill();
        }
        continue;
      }
      if (z === 5 && h < 0.3) {
        // roseaux et massettes des Lacs brumeux
        ctx.strokeStyle = 'rgba(150,190,140,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const dx of [-4, 0, 4]) {
          ctx.moveTo(x + dx, y);
          ctx.lineTo(x + dx * 1.6, y - 14 - Math.abs(dx));
        }
        ctx.stroke();
        ctx.fillStyle = '#6B4A33';
        ctx.beginPath();
        ctx.ellipse(x, y - 15, 2, 4.5, 0, 0, TAU);
        ctx.fill();
      } else if (h < 0.5) {
        // touffe d'herbe
        ctx.strokeStyle = z >= 4 ? 'rgba(120,170,150,0.35)' : 'rgba(150,200,110,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x - 6, y - 7);
        ctx.moveTo(x, y); ctx.lineTo(x, y - 9);
        ctx.moveTo(x + 4, y); ctx.lineTo(x + 6, y - 7);
        ctx.stroke();
      } else if (h < 0.62 && (z === 1 || z === 0)) {
        ctx.fillStyle = ['#F0B64A', '#EEE7D7', '#D886C9'][Math.floor(h * 100) % 3];
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, TAU);
        ctx.fill();
      } else if (h < 0.7) {
        ctx.fillStyle = 'rgba(16,24,26,0.18)';
        ctx.beginPath();
        ctx.ellipse(x, y, 4, 3, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  /**
   * Sous-bois de la jungle : fougères en gerbe, grandes feuilles tombées, orchidées, champignons, racines et feuilles
   * mortes ; dense, pour qu'on sente qu'il y a de la vie à chaque pas.
   */
  private jungleDeco(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, seed: number) {
    if (h < 0.3) {
      // fougère : des frondes arquées, leurs folioles de part et d'autre
      const n = 5 + Math.floor(h * 10);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.42, len = 13 + hash2(k, seed, 151) * 7;
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.75 + 4;
        ctx.strokeStyle = k % 2 ? '#2E6A30' : '#3A7A38';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y + 2);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.75 - 4, ex, ey);
        ctx.stroke();
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let f = 1; f < 5; f++) {
          const t = f / 5, px = x + (ex - x) * t, py = y + 2 + (ey - y - 2) * t - Math.sin(t * Math.PI) * 4;
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.sin(a) * 3.5, py + Math.cos(a) * 3.5 - 1);
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.sin(a) * 3.5, py - Math.cos(a) * 3.5 - 1);
        }
        ctx.stroke();
      }
    } else if (h < 0.42) {
      // grande feuille tombée, nervurée
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(h * 40);
      ctx.fillStyle = h < 0.36 ? 'rgba(60,110,50,0.8)' : 'rgba(140,110,50,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5.5, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,20,0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      for (const dx of [-5, 0, 5]) {
        ctx.moveTo(dx, 0);
        ctx.lineTo(dx + 3, -4);
        ctx.moveTo(dx, 0);
        ctx.lineTo(dx + 3, 4);
      }
      ctx.stroke();
      ctx.restore();
    } else if (h < 0.48) {
      // orchidée : deux feuilles, une hampe, des fleurs roses ou violettes
      ctx.fillStyle = '#3A7A38';
      ctx.beginPath();
      ctx.ellipse(x - 4, y, 6, 2.4, -0.3, 0, TAU);
      ctx.ellipse(x + 4, y, 6, 2.4, 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#4E7A30';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - 10, x + 7, y - 13);
      ctx.stroke();
      ctx.fillStyle = h < 0.45 ? '#D886C9' : '#B47AE0';
      for (const [fx, fy] of [[2, -9], [5, -12], [8, -12]]) {
        ctx.beginPath();
        ctx.arc(x + fx, y + fy, 2.2, 0, TAU);
        ctx.fill();
      }
    } else if (h < 0.53) {
      // champignons orangés
      for (const [dx, dy, r] of [[0, 0, 3.4], [5, 2, 2.4], [-4, 3, 2]]) {
        ctx.fillStyle = '#EADFC6';
        ctx.fillRect(x + dx - 0.8, y + dy - r, 1.6, r);
        ctx.fillStyle = '#E8833A';
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy - r, r, r * 0.65, 0, Math.PI, 0);
        ctx.fill();
      }
    } else if (h < 0.68) {
      // feuilles mortes éparses
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = ['rgba(120,90,40,0.55)', 'rgba(150,120,50,0.5)', 'rgba(90,70,30,0.5)'][k];
        ctx.beginPath();
        ctx.ellipse(x + (hash2(k, seed, 152) - 0.5) * 16, y + (hash2(seed, k, 153) - 0.5) * 10, 3.2, 1.6, k * 1.3 + h * 9, 0, TAU);
        ctx.fill();
      }
    } else if (h < 0.75) {
      // racine qui affleure
      ctx.strokeStyle = 'rgba(70,52,34,0.75)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 2);
      ctx.quadraticCurveTo(x - 2, y - 5, x + 12, y + 1);
      ctx.stroke();
    }
  }

  /**
   * Taille d'un arbre (même hasard que WorldMap.decorSize) ; dans la jungle (z), les géants sont bien plus grands et
   * les bambous un peu (le tronc, lui, garde sa taille : seul le dessin grandit).
   */
  treeSize(x: number, y: number, z = 0) {
    const s = 26 + hash2(x | 0, y | 0, this.seed) * 16;
    return z === JUNGLE_ZONE ? s * (this.isBamboo(x, y) ? 1.15 : 1.42) : s;
  }

  /** Arbre de la jungle qui est un bouquet de bambous (sinon, un géant à contreforts). */
  isBamboo(x: number, y: number) {
    return hash2(x | 0, y | 0, this.seed + 9) < 0.34;
  }

  /** Ombre portée d'un arbre, au sol (dessinée avant les créatures). */
  treeShadow(ctx: CanvasRenderingContext2D, x: number, y: number, z = 0) {
    const s = this.treeSize(x, y, z);
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + s * 0.55, s * 1.05, s * 0.45, 0, 0, TAU);
    ctx.fill();
  }

  /**
   * Arbre : tronc à racines puis feuillage ; fade < 1 rend le feuillage transparent (quelqu'un passe dessous).
   * Feuillus en touffes, sapins étagés dans les Bois profonds et les Landes, saules pleureurs aux Lacs brumeux.
   * Chaque forme (zone, sapin ou feuillu, fruits, une variante sur TREE_VARIANTS) est dessinée une fois dans une image,
   * puis collée à la taille de l'arbre : plus aucun tracé vectoriel à chaque image.
   */
  tree(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, fade = 1, shade = true) {
    const s = this.treeSize(x, y, z), h = hash2(x | 0, y | 0, this.seed + 9);
    const v = Math.floor(hash2(x | 0, y | 0, this.seed + 13) * TREE_VARIANTS);
    if (z === JUNGLE_ZONE) {
      // Jungle : géants à contreforts et lianes, ou bouquets de bambous
      if (shade) this.treeShadow(ctx, x, y, z);
      const k = s / TREE_REF, bamboo = this.isBamboo(x, y);
      if (!bamboo) ctx.drawImage(this.treeLayer(`jtrunk|${v}`, () => (g) => this.drawJungleTrunk(g, v)), x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
      const img = bamboo ? this.treeLayer(`bamboo|${v}`, () => (g) => this.drawBamboo(g, v)) : this.treeLayer(`jleaves|${v}`, () => (g) => this.drawJungleCanopy(g, v));
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * fade;
      ctx.drawImage(img, x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
      ctx.globalAlpha = a;
      return;
    }
    if (z === DESERT_ZONE) {
      // Mer de sable : cactus, palmiers sur la lisière verte de la côte
      if (shade) this.treeShadow(ctx, x, y);
      const palm = coastGreen(this.map, x, y) > 0.45;
      const k = s / TREE_REF, img = palm ? this.treeLayer(`palm|${v}`, () => (g) => this.drawPalm(g, v)) : this.treeLayer(`cactus|${v}`, () => (g) => this.drawCactus(g, v));
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * fade;
      ctx.drawImage(img, x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
      ctx.globalAlpha = a;
      return;
    }
    const pine = z === 2 || (z === 3 && h < 0.35); // Bois profonds : rien que des sapins
    const fruit = !pine && z <= 2 && h > 0.8;
    if (shade) this.treeShadow(ctx, x, y);
    const k = s / TREE_REF;
    const trunk = this.treeLayer('trunk', () => this.drawTrunk);
    ctx.drawImage(trunk, x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
    const leaves = this.treeLayer(`${z}|${pine ? 1 : 0}|${fruit ? 1 : 0}|${v}`, () => (g) => this.drawLeaves(g, z, pine, fruit, v));
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * fade;
    ctx.drawImage(leaves, x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
    ctx.globalAlpha = a;
  }

  private treeSprites = new Map<string, HTMLCanvasElement>();
  /** Image d'une forme d'arbre (taille TREE_REF, centrée sur le pied), à la finesse de la qualité choisie. */
  private treeLayer(key: string, paint: () => (g: CanvasRenderingContext2D) => void) {
    const res = 1.25 * maxDpr(); // le zoom maximal du jeu, en pixels de l'appareil
    const full = `${key}|${res}`;
    let c = this.treeSprites.get(full);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = Math.ceil(TREE_BOX.w * res);
    c.height = Math.ceil(TREE_BOX.h * res);
    const g = c.getContext('2d')!;
    g.setTransform(res, 0, 0, res, TREE_BOX.l * res, TREE_BOX.t * res);
    paint()(g);
    this.treeSprites.set(full, c);
    return c;
  }

  /** Cactus-cierge (Mer de sable) : colonne côtelée, un ou deux bras, pied en (0, 0), taille TREE_REF. */
  private drawCactus(ctx: CanvasRenderingContext2D, v: number) {
    const s = TREE_REF, w = s * 0.24;
    const arm = (side: number, at: number, len: number) => {
      ctx.beginPath();
      ctx.moveTo(side * w * 0.6, -at);
      ctx.lineTo(side * (w + s * 0.28), -at);
      ctx.lineTo(side * (w + s * 0.28), -at - len);
      ctx.stroke();
    };
    for (const [col, lw] of [['rgba(10,18,14,0.6)', w * 0.95], ['#4E7A3E', w * 0.75]] as const) {
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lw;
      if (v % 3 !== 2) arm(-1, s * (0.45 + (v % 2) * 0.15), s * 0.42);
      if (v % 3 !== 1) arm(1, s * (0.65 + (v % 2) * 0.1), s * 0.38);
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.lineTo(0, -s * 1.45);
      ctx.stroke();
    }
    // côtes et reflet
    ctx.strokeStyle = 'rgba(30,60,30,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const dx of [-w * 0.35, w * 0.35]) {
      ctx.moveTo(dx, s * 0.35);
      ctx.lineTo(dx, -s * 1.42);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,230,150,0.35)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, s * 0.2);
    ctx.lineTo(-w * 0.2, -s * 1.3);
    ctx.stroke();
    if (v % 2 === 0) {
      // fleur au sommet
      ctx.fillStyle = '#E86F8A';
      ctx.beginPath();
      ctx.arc(0, -s * 1.5, 4, 0, TAU);
      ctx.fill();
    }
  }

  /** Palmier (lisière de la Mer de sable) : stipe courbe annelé, couronne de palmes, quelques dattes. Pied en (0, 0). */
  private drawPalm(ctx: CanvasRenderingContext2D, v: number) {
    const s = TREE_REF, lean = (v % 2 ? 1 : -1) * s * (0.25 + (v % 3) * 0.08), top = { x: lean, y: -s * 1.6 };
    ctx.strokeStyle = '#7A5A3A';
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.4);
    ctx.quadraticCurveTo(lean * 0.1, -s * 0.6, top.x, top.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,25,15,0.45)'; // anneaux du stipe
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 1; k < 8; k++) {
      const t = k / 8, px = lean * 0.1 * 2 * t * (1 - t) + top.x * t * t, py = s * 0.4 * (1 - t) * (1 - t) + -s * 0.6 * 2 * t * (1 - t) + top.y * t * t;
      ctx.moveTo(px - s * 0.08, py);
      ctx.lineTo(px + s * 0.08, py);
    }
    ctx.stroke();
    // palmes : arcs feuillus qui retombent
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.55, len = s * (0.95 + (k % 2) * 0.2);
      const ex = top.x + Math.cos(a) * len, ey = top.y + Math.sin(a) * len * 0.55 + len * 0.45;
      const mx = top.x + Math.cos(a) * len * 0.55, my = top.y + Math.sin(a) * len * 0.5 - s * 0.15;
      for (const [col, w] of [['#1E3A22', 9], [k % 2 ? '#3E7A3C' : '#4E8A44', 6]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#B8742E'; // dattes
    for (const [dx, dy] of [[-4, 4], [3, 6], [0, 9]]) {
      ctx.beginPath();
      ctx.arc(top.x + dx, top.y + dy, 3, 0, TAU);
      ctx.fill();
    }
  }

  /**
   * Tronc d'un géant de la jungle, pied en (0, 0), à la taille TREE_REF : de grands contreforts qui s'évasent en
   * planches, une écorce à côtes claires, de la mousse, et une liane qui s'y enroule.
   */
  private drawJungleTrunk(ctx: CanvasRenderingContext2D, v: number) {
    const s = TREE_REF;
    // contreforts : des lames de bois qui partent du tronc et plongent dans le sol
    for (const [dx, w, col] of [[-1, 0.62, '#3E2E20'], [1, 0.58, '#3E2E20'], [-0.45, 0.4, '#54402C'], [0.5, 0.42, '#54402C']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(dx * 3, -s * 0.4);
      ctx.quadraticCurveTo(dx * s * 0.12, s * 0.2, dx * s * w, s * 0.5);
      ctx.lineTo(dx * s * w * 0.55, s * 0.52);
      ctx.quadraticCurveTo(dx * s * 0.04, s * 0.3, 0, -s * 0.2);
      ctx.fill();
    }
    // tronc
    ctx.fillStyle = '#4A3826';
    ctx.beginPath();
    ctx.moveTo(-s * 0.13, s * 0.42);
    ctx.lineTo(-s * 0.09, -s * 1.15);
    ctx.lineTo(s * 0.09, -s * 1.15);
    ctx.lineTo(s * 0.13, s * 0.42);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,130,95,0.35)'; // côtes de l'écorce
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const dx of [-0.06, 0, 0.055]) {
      ctx.moveTo(dx * s, s * 0.4);
      ctx.lineTo(dx * s * 0.8, -s * 1.1);
    }
    ctx.stroke();
    ctx.fillStyle = '#4E7A3A'; // mousse
    for (const [mx, my, mr] of [[-0.08, -0.3, 0.07], [0.06, -0.7, 0.05], [-0.4, 0.35, 0.08], [0.42, 0.4, 0.07]]) {
      ctx.beginPath();
      ctx.ellipse(mx * s, my * s, mr * s, mr * s * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    // liane qui s'enroule autour du tronc
    ctx.strokeStyle = '#3E6A2E';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, yy = s * 0.35 - t * s * 1.45, xx = Math.sin(t * Math.PI * 3 + v) * s * 0.12;
      if (k) ctx.lineTo(xx, yy);
      else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }

  /**
   * Canopée d'un géant de la jungle, pied en (0, 0) : une large couronne en étages (ombre, feuillage, lumière sur le
   * dessus), de grandes feuilles découpées qui débordent, des broméliacées en fleur, et des lianes qui pendent.
   */
  private drawJungleCanopy(ctx: CanvasRenderingContext2D, v: number) {
    const s = TREE_REF, cy = -s * 1.32;
    const lumps: [number, number, number][] = [];
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + v * 0.7, d = s * (0.62 + hash2(k, v, 131) * 0.2);
      lumps.push([Math.cos(a) * d * 1.05, cy + Math.sin(a) * d * 0.45, s * (0.36 + hash2(v, k, 132) * 0.12)]);
    }
    lumps.push([0, cy, s * 0.6], [-s * 0.35, cy - s * 0.05, s * 0.45], [s * 0.38, cy + s * 0.02, s * 0.42]);
    const blob = (dx: number, dy: number, grow: number) => {
      ctx.beginPath();
      for (const [lx, ly, lr] of lumps) {
        ctx.moveTo(lx + dx + lr + grow, ly + dy);
        ctx.arc(lx + dx, ly + dy, Math.max(1, lr + grow), 0, TAU);
      }
    };
    // lianes qui pendent sous la couronne (derrière le feuillage)
    for (let k = 0; k < 5; k++) liana(ctx, (k - 2) * s * 0.33 + (hash2(k, v, 133) - 0.5) * 8, cy + s * 0.2, s * (0.55 + hash2(v, k, 134) * 0.5), 0, k + v);
    ctx.fillStyle = 'rgba(8,16,10,0.6)';
    blob(0, 3, 3);
    ctx.fill();
    ctx.fillStyle = '#16351E';
    blob(0, 0, 0);
    ctx.fill();
    ctx.fillStyle = '#21482A';
    blob(-s * 0.06, -s * 0.08, -s * 0.1);
    ctx.fill();
    // grandes feuilles découpées qui débordent sur le pourtour
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU + v * 1.3 + 0.2, lx = Math.cos(a) * s * 0.95, ly = cy + Math.sin(a) * s * 0.42, len = s * (0.32 + hash2(k, v, 135) * 0.12);
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(a + Math.PI / 2 * 0);
      ctx.fillStyle = k % 2 ? '#2E6A34' : '#3A7A3A';
      ctx.beginPath();
      ctx.ellipse(len * 0.5, 0, len * 0.55, len * 0.26, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,210,120,0.45)'; // nervure, entailles
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      for (let n = 1; n < 4; n++) {
        ctx.moveTo((len * n) / 4, 0);
        ctx.lineTo((len * n) / 4 + 3, -len * 0.22);
      }
      ctx.stroke();
      ctx.restore();
    }
    // lumière sur le dessus de la couronne
    ctx.fillStyle = '#3E7A3A';
    for (const [lx, ly, lr] of lumps) {
      if (ly > cy + 2) continue;
      ctx.beginPath();
      ctx.arc(lx - lr * 0.2, ly - lr * 0.35, lr * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(150,210,110,0.35)';
    for (const [lx, ly, lr] of lumps.slice(0, 5)) {
      ctx.beginPath();
      ctx.arc(lx - lr * 0.35, ly - lr * 0.5, lr * 0.2, 0, TAU);
      ctx.fill();
    }
    // broméliacées en fleur, posées dans les branches
    for (let k = 0; k < 3; k++) {
      const fx = (hash2(k, v, 136) - 0.5) * s * 1.4, fy = cy + (hash2(v, k, 137) - 0.3) * s * 0.5;
      ctx.fillStyle = '#3E7A3A';
      for (const a of [-0.6, 0, 0.6]) {
        ctx.beginPath();
        ctx.ellipse(fx + Math.sin(a) * 4, fy - 3, 1.8, 5, a, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = k % 2 ? '#C8382E' : '#D8602A';
      for (const a of [-0.35, 0, 0.35]) {
        ctx.beginPath();
        ctx.ellipse(fx + Math.sin(a) * 3, fy - 7, 0.9, 2.6, a, 0, TAU);
        ctx.fill();
      }
    }
  }

  /**
   * Bouquet de bambous, pied en (0, 0) : des tiges un peu penchées, nœuds sombres et reflet clair, et des gerbes de
   * feuilles fines vers le haut.
   */
  private drawBamboo(ctx: CanvasRenderingContext2D, v: number) {
    const s = TREE_REF, n = 6 + (v % 3);
    ctx.fillStyle = 'rgba(8,16,10,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.42, s * 0.42, s * 0.12, 0, 0, TAU);
    ctx.fill();
    const stalks = Array.from({ length: n }, (_, k) => {
      const bx = (k / (n - 1) - 0.5) * s * 0.6 + (hash2(k, v, 141) - 0.5) * 6, h = s * (1.45 + hash2(v, k, 142) * 0.55), lean = (bx / s) * 0.5 + (hash2(k, k, v) - 0.5) * 0.25;
      return { bx, h, lean, tone: hash2(k, v, 143) };
    }).sort((a, b) => a.tone - b.tone);
    for (const st of stalks) {
      const tx = st.bx + st.lean * st.h, ty = s * 0.4 - st.h;
      ctx.strokeStyle = st.tone < 0.4 ? '#5E8A34' : '#7FA846';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(st.bx, s * 0.4);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,240,160,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(st.bx - 1, s * 0.38);
      ctx.lineTo(tx - 1, ty + 4);
      ctx.stroke();
      // nœuds
      ctx.strokeStyle = '#3E5E22';
      ctx.lineWidth = 1.6;
      for (let k = 1; k * 9 < st.h; k++) {
        const t = (k * 9) / st.h, nx = st.bx + (tx - st.bx) * t, ny = s * 0.4 + (ty - s * 0.4) * t;
        ctx.beginPath();
        ctx.moveTo(nx - 2.4, ny);
        ctx.lineTo(nx + 2.4, ny);
        ctx.stroke();
      }
      // gerbes de feuilles fines, vers le haut de la tige
      for (let k = 0; k < 4; k++) {
        const t = 0.62 + k * 0.12, nx = st.bx + (tx - st.bx) * t, ny = s * 0.4 + (ty - s * 0.4) * t, side = k % 2 ? 1 : -1;
        for (let f = 0; f < 3; f++) {
          const a = side * (0.5 + f * 0.35) - Math.PI / 2 * 0.2, len = 9 + f * 2;
          ctx.fillStyle = f === 1 ? '#6EA040' : '#4E8A34';
          ctx.save();
          ctx.translate(nx, ny);
          ctx.rotate(a + (side > 0 ? 0 : Math.PI));
          ctx.beginPath();
          ctx.ellipse(len * 0.5, 0, len * 0.55, 1.7, 0.15 * side, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  /** Tronc évasé et ses racines (le même pour tous les arbres), pied en (0, 0). */
  private drawTrunk = (ctx: CanvasRenderingContext2D) => {
    const s = TREE_REF;
    ctx.fillStyle = '#4A3424';
    ctx.beginPath();
    ctx.moveTo(-5, -s * 0.5);
    ctx.lineTo(-6, s * 0.38);
    ctx.quadraticCurveTo(-12, s * 0.5, -15, s * 0.52);
    ctx.lineTo(15, s * 0.52);
    ctx.quadraticCurveTo(11, s * 0.48, 6, s * 0.38);
    ctx.lineTo(5, -s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,0.12)';
    ctx.fillRect(-3, 0, 2, s * 0.4);
  };

  /** Feuillage d'une forme d'arbre, pied en (0, 0), à la taille TREE_REF. */
  private drawLeaves(ctx: CanvasRenderingContext2D, z: number, pine: boolean, fruit: boolean, v: number) {
    const s = TREE_REF, x = 0, y = 0;
    const dark = z === 5 ? '#23403F' : z === 4 ? '#1E3634' : z === 3 ? '#2E3A22' : '#1C3324';
    const mid = z === 5 ? '#36605A' : z === 4 ? '#2B4A45' : z === 3 ? '#425230' : '#28472F';
    const light = z === 5 ? '#5A8A80' : z === 4 ? '#3C625A' : z === 3 ? '#5A6B3C' : '#386240';
    const ink = 'rgba(10,18,14,0.55)';
    if (pine) {
      // sapin : trois étages, le bas de chacun dentelé
      for (let k = 0; k < 3; k++) {
        const w = s * (1.15 - k * 0.3), base = y + s * (0.12 - k * 0.5), top = base - s * (0.95 - k * 0.12);
        for (const [col, dy] of [[ink, 2.5], [k === 0 ? dark : k === 1 ? mid : light, 0]] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(x, top + dy);
          ctx.lineTo(x + w, base + dy);
          for (let t = 1; t < 6; t++) ctx.lineTo(x + w - (2 * w * t) / 6, base + dy - (t % 2 ? s * 0.1 : 0));
          ctx.lineTo(x - w, base + dy);
          ctx.closePath();
          ctx.fill();
        }
      }
      return;
    }
    // feuillu : touffes en couronne, ombrées en bas, éclaircies en haut à gauche
    const cy = y - s * 0.62, n = 7; // assez haut pour laisser voir le tronc
    const lumps: [number, number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + v * 0.9, d = s * (0.42 + hash2(k, v, 77) * 0.12);
      lumps.push([x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, s * (0.38 + hash2(v, k, 78) * 0.14)]);
    }
    lumps.push([x, cy, s * 0.62]);
    const blob = (dx: number, dy: number, grow: number) => {
      ctx.beginPath();
      for (const [lx, ly, lr] of lumps) {
        ctx.moveTo(lx + dx + lr + grow, ly + dy);
        ctx.arc(lx + dx, ly + dy, lr + grow, 0, TAU);
      }
    };
    ctx.fillStyle = ink;
    blob(0, 2, 2.5);
    ctx.fill();
    ctx.fillStyle = dark;
    blob(0, 0, 0);
    ctx.fill();
    ctx.fillStyle = mid;
    blob(-s * 0.08, -s * 0.1, -s * 0.12);
    ctx.fill();
    ctx.fillStyle = light;
    for (const [lx, ly, lr] of lumps) {
      if (ly > cy || lx > x + s * 0.2) continue; // seulement les touffes du haut, côté lumière
      ctx.beginPath();
      ctx.arc(lx - lr * 0.25, ly - lr * 0.3, lr * 0.42, 0, TAU);
      ctx.fill();
    }
    if (z === 5) {
      // saule : longues branches qui retombent
      ctx.strokeStyle = mid;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const px = x - s * 0.9 + (k / 8) * s * 1.8, py = cy + s * 0.2 + Math.abs(k - 4) * -2;
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 3, py + s * 0.4, px - 2, py + s * 0.75);
      }
      ctx.stroke();
    } else if (fruit) {
      // quelques fruits ou fleurs sur certains arbres de la Lisière
      ctx.fillStyle = z === 1 ? '#E8A43C' : '#D886C9';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(x + (hash2(k, 3, v) - 0.5) * s * 1.2, cy + (hash2(k, 7, v) - 0.5) * s * 0.9, 2.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  private drawVillage() {
    const size = this.villageSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);

    // Herbe du village : celle du sol (groundColor), qui se fond dans le biome autour de la palissade.

    // Routes : celle de la porte côté plage rejoint le chemin de cailloux ;
    // les trois autres s'estompent doucement dans l'herbe au lieu de s'arrêter net.
    const v = this.map.village;
    const sideOf = (g: { x: number; y: number }) => (Math.round(Math.atan2(g.y - v.y, g.x - v.x) / (Math.PI / 2)) + 4) % 4;
    const linked = [sideOf(this.map.gate)]; // porte où arrive le chemin de la plage
    ctx.lineCap = 'round';
    PATH_PASSES.forEach((pass, k) => {
      for (const side of [0, 1, 2, 3]) {
        const ang = (side * Math.PI) / 2, cx = Math.cos(ang), cy = Math.sin(ang);
        const toGate = linked.includes(side), edge = villageEdge(ang);
        const end = toGate ? edge + 60 : edge + 85;
        const from = k === 2 ? 112 : 0; // la trace claire ne traverse pas la place
        if (toGate) ctx.strokeStyle = rgba(pass);
        else {
          const grad = ctx.createLinearGradient(0, 0, cx * end, cy * end);
          grad.addColorStop(0, rgba(pass));
          grad.addColorStop((edge - 10) / end, rgba(pass));
          grad.addColorStop(1, rgba(pass, 0));
          ctx.strokeStyle = grad;
        }
        ctx.lineWidth = pass[4];
        ctx.lineCap = toGate ? 'butt' : 'round';
        ctx.beginPath();
        ctx.moveTo(cx * from, cy * from);
        ctx.lineTo(cx * end, cy * end);
        ctx.stroke();
      }
      // place centrale, dans le même style
      if (k < 2) {
        ctx.fillStyle = rgba(pass);
        ctx.beginPath();
        ctx.arc(0, 0, k === 0 ? 125 : 120, 0, TAU);
        ctx.fill();
      }
    });
    ctx.strokeStyle = 'rgba(140,124,88,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);


    return c;
  }

  /** Un pieu taillé en pointe (coordonnées du monde), avec sa part de traverse vers le pieu suivant, et son ombre. */
  drawStake(ctx: CanvasRenderingContext2D, k: number) {
    const { x, y, h, next } = this.stakes[k];
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 7, 3, 0, 0, TAU);
    ctx.fill();
    if (next) {
      ctx.strokeStyle = '#4A3322';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(next.x, next.y - 10);
      ctx.stroke();
    }
    ctx.fillStyle = k % 2 ? '#6B4A33' : '#7A5A3A';
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 5, y - h);
    ctx.lineTo(x, y - h - 7);
    ctx.lineTo(x + 5, y - h);
    ctx.lineTo(x + 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.18)';
    ctx.fillRect(x - 5, y - h, 2, h);
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(x + 3, y - h, 2, h);
  }

  /** Le pont, cassé ou réparé ; cassé, son nom au-dessus du pied (le prix : dans le panneau de construction). */
  drawBridge(ctx: CanvasRenderingContext2D, built: boolean, t: number) {
    const { a, b } = this.map.bridge;
    drawBridge(ctx, a, b, this.seed, built, t);
    if (built) return;
    const label = `${BUILDINGS.bridge.name} · cassé`;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, a.x, a.y - 60);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, a.x, a.y - 60);
  }

  /** Palissade pas encore construite : un piquet de repère de loin en loin, et la corde tendue entre eux. */
  drawPalisadePlan(ctx: CanvasRenderingContext2D) {
    const v = this.map.village;
    ctx.strokeStyle = 'rgba(232,220,192,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, r = villageEdge(a);
      if (i) ctx.lineTo(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r);
      else ctx.moveTo(v.x + r, v.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < this.stakes.length; k += 8) {
      const { x, y } = this.stakes[k];
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(x - 2, y - 14, 4, 16);
      ctx.fillStyle = '#E8DCC0';
      ctx.fillRect(x - 2, y - 14, 4, 4);
    }
    const label = BUILDINGS.palisade.name; // le prix : dans le panneau de construction
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, v.x, v.y - 70);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, v.x, v.y - 70);
  }

  /** Poteau de porte (coordonnées du monde) : plus haut, coiffé d'un fanion ; au nord et au sud, linteau et bannière. */
  drawGatePost(ctx: CanvasRenderingContext2D, k: number, t: number) {
    const { x, y, side, s } = this.gatePosts[k];
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 8, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 5, y - 38, 10, 40);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x - 5, y - 38, 10, 4);
    if (side % 2 === 1 && s === 1) {
      // nord ou sud : linteau d'un poteau à l'autre, bannière au milieu
      const o = this.gatePosts[k - 1];
      ctx.fillStyle = '#4A3322';
      const l = Math.min(x, o.x), r = Math.max(x, o.x);
      ctx.fillRect(l - 7, y - 42, r - l + 14, 6);
      const cx = (x + o.x) / 2, sway = Math.sin(t * 1.6 + side) * 1.5;
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.moveTo(cx - 10, y - 36);
      ctx.lineTo(cx + 10, y - 36);
      ctx.lineTo(cx + 10 + sway, y - 18);
      ctx.lineTo(cx + sway, y - 23);
      ctx.lineTo(cx - 10 + sway, y - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EFE3C4';
      ctx.beginPath();
      ctx.arc(cx + sway * 0.5, y - 29, 2.5, 0, TAU);
      ctx.fill();
    } else if (side % 2 === 0) {
      // est ou ouest : un fanion sur chaque poteau
      const sway = Math.sin(t * 2 + k) * 2;
      ctx.fillStyle = '#3A2A1E';
      ctx.fillRect(x - 1, y - 52, 2, 14);
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 52);
      ctx.lineTo(x + 13, y - 48 + sway);
      ctx.lineTo(x + 1, y - 44);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Panneau du village (coordonnées du village) : planche sur deux poteaux, couverte de petites affiches. */
  drawBoard(ctx: CanvasRenderingContext2D) {
    const x = BOARD_OFFSET.x, y = BOARD_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 26, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 20, y - 34, 5, 38);
    ctx.fillRect(x + 15, y - 34, 5, 38);
    // planche et son cadre
    ctx.fillStyle = '#4A3322';
    ctx.fillRect(x - 25, y - 44, 50, 30);
    ctx.fillStyle = '#9A7448';
    ctx.fillRect(x - 22, y - 41, 44, 24);
    // affiches épinglées
    const notes: [number, number, number, number, string][] = [[-18, -38, 13, 15, '#EFE3C4'], [-2, -39, 11, 9, '#E9D6A8'], [11, -37, 9, 13, '#F2E8CF'], [-1, -28, 12, 9, '#E4CFA0']];
    for (const [nx, ny, w, h, c] of notes) {
      ctx.fillStyle = c;
      ctx.fillRect(x + nx, y + ny, w, h);
      ctx.fillStyle = 'rgba(90,70,50,0.55)';
      for (let l = 3; l < h - 2; l += 3) ctx.fillRect(x + nx + 2, y + ny + l, w - 4, 1);
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.arc(x + nx + w / 2, y + ny + 1.5, 1.4, 0, TAU);
      ctx.fill();
    }
    // petit toit
    ctx.fillStyle = '#6B4A33';
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 43);
    ctx.lineTo(x, y - 54);
    ctx.lineTo(x + 30, y - 43);
    ctx.closePath();
    ctx.fill();
  }

  /** Entrepôt (coordonnées du village) : sous son auvent, rondins et tas de pierres, qui grossissent avec la réserve. */
  drawStore(ctx: CanvasRenderingContext2D, stock: [number, number]) {
    const x = STORE_OFFSET.x, y = STORE_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(x - 38, y + 8, 80, 12);
    // auvent sur poteaux
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 38, y - 34, 5, 46);
    ctx.fillRect(x + 33, y - 34, 5, 46);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x - 44, y - 40, 88, 9);
    // rondins empilés (plus ou moins selon le bois en réserve)
    const logs = Math.min(6, Math.ceil(stock[0] / 40));
    for (let i = 0; i < logs; i++) {
      const lx = x - 30 + (i % 3) * 13 + (i >= 3 ? 6 : 0), ly = y + 4 - (i >= 3 ? 11 : 0);
      ctx.fillStyle = '#6B4A33';
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#C9A27A';
      ctx.beginPath();
      ctx.arc(lx, ly, 3.2, 0, TAU);
      ctx.fill();
    }
    // tas de pierres
    const stones = Math.min(6, Math.ceil(stock[1] / 40));
    for (let i = 0; i < stones; i++) {
      ctx.fillStyle = i % 2 ? '#7C8681' : '#5E6763';
      ctx.beginPath();
      ctx.ellipse(x + 12 + (i % 3) * 8, y + 6 - Math.floor(i / 3) * 7, 6, 4.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = `Entrepôt · ${stock[0]} bois · ${stock[1]} pierre`;
    ctx.strokeText(label, x, y - 50);
    ctx.fillStyle = '#D2A06A';
    ctx.fillText(label, x, y - 50);
  }

  /**
   * Hôtel de ville (coordonnées du village) : en ruine au niveau 0, puis de plus en plus belle.
   * Un fanion par niveau sur le toit, une cheminée qui fume à partir du niveau 3.
   */
  drawHall(ctx: CanvasRenderingContext2D, lvl: number, t: number) {
    const x = HALL_OFFSET.x, y = HALL_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.fillRect(x - 50, y + 8, 110, 46);
    ctx.fillStyle = lvl >= 4 ? '#6B4A33' : '#5B3F2C';
    ctx.fillRect(x - 52, y - 10, 104, 56);
    if (lvl >= 2) {
      // colombages
      ctx.strokeStyle = '#3A2819';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 50, y - 8, 100, 52);
      ctx.beginPath();
      ctx.moveTo(x - 50, y + 12);
      ctx.lineTo(x + 50, y + 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#3A2819';
    ctx.fillRect(x - 10, y + 18, 20, 28);
    if (lvl >= 1) {
      // fenêtres éclairées
      ctx.fillStyle = '#F0B64A';
      ctx.fillRect(x - 38, y + 18, 14, 12);
      ctx.fillRect(x + 24, y + 18, 14, 12);
    }
    if (lvl >= 3) {
      // cheminée et sa fumée
      ctx.fillStyle = '#5E6763';
      ctx.fillRect(x + 26, y - 50, 12, 30);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        ctx.fillStyle = `rgba(200,205,200,${0.4 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(x + 32 + k * 14, y - 56 - k * 40, 5 + k * 8, 0, TAU);
        ctx.fill();
      }
    }
    const roof = ['#6B5A44', '#8A4B32', '#9C5236', '#A85A3A', '#3F6E8A', '#4F7FA0', '#B8863A'][Math.min(lvl, 6)];
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 64, y - 4);
    ctx.lineTo(x, y - 56);
    ctx.lineTo(x + 64, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 64 + i * 16, y - 4 - i * 13);
      ctx.lineTo(x + 64 - i * 16, y - 4 - i * 13);
      ctx.stroke();
    }
    if (lvl === 0) {
      // toit éventré et planches en attente : il faut la remettre en état
      ctx.fillStyle = '#2A1F17';
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 40);
      ctx.lineTo(x + 26, y - 22);
      ctx.lineTo(x + 8, y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7A5A3A';
      ctx.fillRect(x - 70, y + 40, 40, 6);
      ctx.fillRect(x - 66, y + 47, 40, 6);
    }
    // un fanion par niveau le long du toit
    for (let i = 0; i < lvl; i++) {
      const fx = x - 48 + i * 19, fy = y - 8 - (1 - Math.abs(i * 19 - 48) / 64) * 46;
      const wave = Math.sin(t * 3 + i) * 2;
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(fx - 1, fy - 18, 2, 18);
      ctx.fillStyle = i % 2 ? '#5CC8B8' : '#F0B64A';
      ctx.beginPath();
      ctx.moveTo(fx + 1, fy - 18);
      ctx.lineTo(fx + 12, fy - 14 + wave);
      ctx.lineTo(fx + 1, fy - 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = lvl ? `Hôtel de ville · niv. ${lvl}` : 'Hôtel de ville · en ruine';
    ctx.strokeText(label, x, y - 74);
    ctx.fillStyle = '#F0B64A';
    ctx.fillText(label, x, y - 74);
  }

  /** Panneau à la lisière d'une brume, au-dessus de tout : la zone, et ce qui manque pour la lever. */
  drawGateLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, sub: string) {
    const c = { x, y: y + 60 };
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, c.x, c.y - 74);
    ctx.fillStyle = '#EEE7D7';
    ctx.fillText(label, c.x, c.y - 74);
    if (!sub) return;
    ctx.font = '600 13px Outfit, sans-serif';
    ctx.strokeText(sub, c.x, c.y - 56);
    ctx.fillStyle = '#FF9B78';
    ctx.fillText(sub, c.x, c.y - 56);
  }

  /** Bâtiment construit, ou son chantier (piquets, corde et prix) : dessiné en coordonnées du village (ctx centré dessus). */
  drawBuilding(ctx: CanvasRenderingContext2D, b: Plot, built: boolean, hall: number, cleared = true, grand = false) {
    if (!cleared) return this.drawWildPlot(ctx, b);
    if (!built) return this.drawPlot(ctx, b, hall);
    if (b === 'forge') this.drawForge(ctx, grand);
    else if (b === 'den') this.drawDen(ctx);
    else this.drawMarket(ctx);
  }

  /** Emplacement pas encore défriché : broussailles, souches et cailloux, et ce que coûte le défrichage. */
  private drawWildPlot(ctx: CanvasRenderingContext2D, b: Plot) {
    const { x0, y0, x1, y1 } = PLOTS[b], w = x1 - x0, h = y1 - y0;
    for (let k = 0; k < 14; k++) {
      const px = x0 + hash2(k, 1, this.seed + b.length) * w, py = y0 + hash2(k, 2, this.seed + b.length) * h, v = hash2(k, 3, this.seed);
      if (v < 0.45) {
        // touffe de broussailles
        for (const [dx, dy, r, c] of [[-6, 0, 9, '#2E4A2C'], [6, 0, 9, '#2E4A2C'], [0, -6, 10, '#3C6236']] as const) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, r, 0, TAU);
          ctx.fill();
        }
      } else if (v < 0.7) {
        ctx.fillStyle = '#6E726C'; // caillou
        ctx.beginPath();
        ctx.ellipse(px, py, 8, 6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.ellipse(px - 2, py - 2, 4, 2.5, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#5B3F2C'; // souche
        ctx.beginPath();
        ctx.ellipse(px, py, 8, 5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#9C7A52';
        ctx.beginPath();
        ctx.ellipse(px, py - 2, 6, 3.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    const p = `plot_${b}` as const;
    const label = BUILDINGS[p].name;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, (x0 + x1) / 2, y0 - 22);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, (x0 + x1) / 2, y0 - 22);
  }

  private drawPlot(ctx: CanvasRenderingContext2D, b: Plot, hall: number) {
    const { x0, y0, x1, y1 } = PLOTS[b];
    ctx.fillStyle = 'rgba(110,97,66,0.55)'; // terre retournée
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // corde tendue entre les piquets
    ctx.strokeStyle = '#C9B48A';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]]) {
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(px - 2, py - 14, 4, 18);
      ctx.fillStyle = '#E8DCC0';
      ctx.fillRect(px - 2, py - 14, 4, 4);
    }
    // quelques planches et pierres en attente
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x0 + 14, y1 - 22, 46, 7);
    ctx.fillRect(x0 + 18, y1 - 14, 46, 7);
    ctx.fillStyle = '#6E726C';
    ctx.beginPath();
    ctx.ellipse(x1 - 26, y1 - 16, 10, 7, 0, 0, TAU);
    ctx.fill();
    const need = BUILDINGS[b].hall; // pas encore constructible : le nom en grisé
    const label = BUILDINGS[b].name; // le prix et le niveau d'Hôtel de ville requis : dans le panneau de construction
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, (x0 + x1) / 2, y0 - 22);
    ctx.fillStyle = hall < need ? '#A9B3A6' : '#C9CFC2';
    ctx.fillText(label, (x0 + x1) / 2, y0 - 22);
  }

  /**
   * Tanière : loge de rondins (même style que l'Hôtel de ville et la forge), toit d'ardoise violette,
   * cornes croisées aux pignons, grande porte en arche griffée, blason à la patte et fanion violet.
   */
  private drawDen(ctx: CanvasRenderingContext2D) {
    const x = DEN_OFFSET.x, y = DEN_OFFSET.y;
    // ombre portée, comme les autres bâtiments
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.fillRect(x - 66, y + 14, 146, 24);
    // murs en rondins empilés
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 72, y - 14, 144, 46);
    ctx.strokeStyle = 'rgba(16,24,26,0.3)';
    ctx.lineWidth = 2;
    for (let ly = y - 4; ly < y + 32; ly += 9) {
      ctx.beginPath();
      ctx.moveTo(x - 72, ly);
      ctx.lineTo(x + 72, ly);
      ctx.stroke();
    }
    // bouts de rondins aux angles
    ctx.fillStyle = '#7A5A3A';
    for (const sx of [-74, 74]) {
      for (let ly = y - 10; ly < y + 32; ly += 9) {
        ctx.beginPath();
        ctx.arc(x + sx, ly, 4.5, 0, TAU);
        ctx.fill();
      }
    }
    // toit en croupe, ardoise violette, rangs de bardeaux
    ctx.fillStyle = '#4E3F7A';
    ctx.beginPath();
    ctx.moveTo(x - 86, y - 8);
    ctx.lineTo(x - 54, y - 56);
    ctx.lineTo(x + 54, y - 56);
    ctx.lineTo(x + 86, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.28)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const ry = y - 8 - i * 12, inset = i * 8;
      ctx.beginPath();
      ctx.moveTo(x - 86 + inset, ry);
      ctx.lineTo(x + 86 - inset, ry);
      ctx.stroke();
    }
    ctx.fillStyle = '#6A579E';
    ctx.fillRect(x - 56, y - 60, 112, 6); // faîtage
    // cornes croisées aux deux pignons
    for (const sx of [-1, 1]) {
      const hx = x + sx * 56, hy = y - 58;
      ctx.strokeStyle = '#E9DFC8';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + sx * 6, hy - 16, hx + sx * 16, hy - 20);
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx - sx * 4, hy - 14, hx - sx * 2, hy - 24);
      ctx.stroke();
    }
    // grande porte en arche, sombre, encadrée de rideaux violets et griffée
    ctx.fillStyle = '#3A2819';
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 32);
    ctx.lineTo(x - 24, y + 2);
    ctx.arc(x, y + 2, 24, Math.PI, 0);
    ctx.lineTo(x + 24, y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.moveTo(x - 19, y + 32);
    ctx.lineTo(x - 19, y + 4);
    ctx.arc(x, y + 4, 19, Math.PI, 0);
    ctx.lineTo(x + 19, y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7D68B8';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 19, y - 12);
      ctx.quadraticCurveTo(x + sx * 9, y + 6, x + sx * 14, y + 32);
      ctx.lineTo(x + sx * 19, y + 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(233,223,200,0.55)'; // griffures sur le linteau
    ctx.lineWidth = 1.5;
    for (const k of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(x - 40 + k, y - 8);
      ctx.lineTo(x - 34 + k, y + 8);
      ctx.stroke();
    }
    // blason à la patte, au-dessus de la porte
    ctx.fillStyle = '#7A5A3A';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 30);
    ctx.lineTo(x + 12, y - 30);
    ctx.lineTo(x + 12, y - 18);
    ctx.quadraticCurveTo(x, y - 8, x - 12, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#B48CFF';
    ctx.beginPath();
    ctx.ellipse(x, y - 19, 4, 3.5, 0, 0, TAU);
    for (const [px, py] of [[-5, -25], [-1.7, -27], [1.7, -27], [5, -25]]) {
      ctx.moveTo(x + px + 1.8, y + py);
      ctx.arc(x + px, y + py, 1.8, 0, TAU);
    }
    ctx.fill();
    // fanion violet
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x + 78, y - 70, 5, 100);
    ctx.fillStyle = '#B48CFF';
    ctx.beginPath();
    ctx.moveTo(x + 83, y - 68);
    ctx.lineTo(x + 112, y - 58);
    ctx.lineTo(x + 83, y - 46);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B48CFF';
    ctx.fillText('Tanière', x, y - 86);
  }

  /** grand : la Grande forge (cheminée de pierre, braises plus vives, bannière dorée). */
  private drawForge(ctx: CanvasRenderingContext2D, grand = false) {
    const fx = FORGE_OFFSET.x, fy = FORGE_OFFSET.y;
    if (grand) {
      // cheminée de pierre au-dessus du toit, avec ses braises
      ctx.fillStyle = '#6E7570';
      ctx.fillRect(fx - 20, fy - 66, 18, 30);
      ctx.fillStyle = '#5A5F66';
      ctx.fillRect(fx - 23, fy - 70, 24, 6);
      ctx.fillStyle = 'rgba(232,105,63,0.8)';
      ctx.fillRect(fx - 16, fy - 74, 10, 4);
    }
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(fx - 66, fy + 40, 76, 10);
    ctx.fillStyle = '#4B4F55';
    ctx.fillRect(fx - 74, fy - 40, 76, 80);
    ctx.fillStyle = '#3C3F44';
    ctx.fillRect(fx - 74, fy - 40, 76, 14);
    ctx.fillStyle = '#E8693F';
    ctx.fillRect(fx - 56, fy - 10, 40, 22);
    ctx.fillStyle = grand ? '#FFE08A' : '#F0B64A';
    ctx.fillRect(fx - 48, fy - 2, 24, 10);
    if (grand) {
      // bannière dorée sur la façade
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.moveTo(fx - 68, fy - 24);
      ctx.lineTo(fx - 60, fy - 24);
      ctx.lineTo(fx - 60, fy - 2);
      ctx.lineTo(fx - 64, fy - 6);
      ctx.lineTo(fx - 68, fy - 2);
      ctx.closePath();
      ctx.fill();
    }
    // enclume
    ctx.fillStyle = '#2D3035';
    ctx.fillRect(fx + 22, fy + 22, 16, 18);
    ctx.fillStyle = '#5A5F66';
    ctx.beginPath();
    ctx.moveTo(fx + 6, fy + 10);
    ctx.lineTo(fx + 58, fy + 10);
    ctx.lineTo(fx + 48, fy + 24);
    ctx.lineTo(fx + 14, fy + 24);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F0B64A';
    ctx.fillText(grand ? 'Grande forge' : 'Forge', fx - 36, grand ? fy - 78 : fy - 50);
  }

  /**
   * Marché : une échoppe sous un auvent rayé en pente (bord festonné), comptoir en planches, deux lanternes ;
   * sur le comptoir, un panier d'essences, des pièces d'or et la cage d'un monstre à vendre.
   */
  private drawMarket(ctx: CanvasRenderingContext2D) {
    const mx = MARKET_OFFSET.x, my = MARKET_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.28)';
    ctx.beginPath();
    ctx.ellipse(mx + 4, my + 40, 66, 10, 0, 0, TAU);
    ctx.fill();
    // poteaux, comptoir en planches et son plateau
    stallBox(ctx, mx - 54, my - 36, 7, 76, '#5B3F2C', 1);
    stallBox(ctx, mx + 47, my - 36, 7, 76, '#5B3F2C', 1);
    stallBox(ctx, mx - 58, my + 8, 116, 32, '#7A5A3A', 3);
    ctx.strokeStyle = 'rgba(40,26,14,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const k of [-30, 0, 30]) {
      ctx.moveTo(mx + k, my + 16);
      ctx.lineTo(mx + k, my + 40);
    }
    ctx.stroke();
    stallBox(ctx, mx - 60, my + 6, 120, 8, '#A9845A', 2);
    // marchandises
    stallEssences(ctx, mx - 32, my + 7);
    stallCoins(ctx, mx - 8, my + 4);
    stallCage(ctx, mx + 26, my + 7);
    // auvent : bandes teal et crème en pente, bord festonné, ombre portée sur l'échoppe
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(mx - 54, my - 22, 108, 8);
    const n = 7, w = 132 / n;
    for (let k = 0; k < n; k++) {
      const x0 = mx - 66 + k * w;
      ctx.fillStyle = k % 2 ? '#EEE7D7' : '#4FB8A9';
      ctx.beginPath();
      ctx.moveTo(x0 + 4, my - 46);
      ctx.lineTo(x0 + w + 4, my - 46);
      ctx.lineTo(x0 + w, my - 24);
      ctx.quadraticCurveTo(x0 + w / 2, my - 14, x0, my - 24);
      ctx.closePath();
      ctx.fill();
    }
    stallBox(ctx, mx - 64, my - 50, 136, 6, '#2F7F75', 2);
    stallLantern(ctx, mx - 44, my - 18);
    stallLantern(ctx, mx + 44, my - 18);
    // une caisse au pied du comptoir
    stallBox(ctx, mx - 73, my + 28, 14, 14, '#9C7A52', 2);
    ctx.strokeStyle = 'rgba(60,40,24,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx - 71, my + 30);
    ctx.lineTo(mx - 61, my + 40);
    ctx.moveTo(mx - 73, my + 35);
    ctx.lineTo(mx - 59, my + 35);
    ctx.stroke();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5CC8B8';
    ctx.fillText('Marché', mx, my - 60);
  }

  /** Plage d'arrivée : épave, planches, caisses, et panneau qui indique le village. */
  private drawCamp() {
    const size = this.campSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);
    // Plage d'arrivée : une barque échouée, des planches et des caisses rejetées par la mer.
    const { boat, out, planks } = this.map.wreck;
    for (const pl of planks) {
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.a);
      ctx.fillStyle = 'rgba(8,14,12,0.25)';
      ctx.fillRect(-pl.l / 2 + 2, -3, pl.l, 8);
      ctx.fillStyle = '#8A6A45';
      ctx.fillRect(-pl.l / 2, -4, pl.l, 7);
      ctx.fillStyle = 'rgba(255,240,210,0.18)';
      ctx.fillRect(-pl.l / 2, -4, pl.l, 2);
      ctx.fillStyle = '#3A2A1E'; // clous
      ctx.fillRect(-pl.l / 2 + 3, -1, 2, 2);
      ctx.fillRect(pl.l / 2 - 5, -1, 2, 2);
      ctx.restore();
    }
    // barque retournée à moitié, coque fendue
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(out + Math.PI / 2 + 0.3);
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 50, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6B4A33';
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.quadraticCurveTo(-30, -22, 0, -22);
    ctx.quadraticCurveTo(34, -22, 48, -4);
    ctx.quadraticCurveTo(34, 18, 0, 18);
    ctx.quadraticCurveTo(-30, 18, -48, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4A3322';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const k of [-10, 0, 10]) {
      ctx.moveTo(-40, k);
      ctx.quadraticCurveTo(0, k - 4, 42, k * 0.8);
    }
    ctx.stroke();
    ctx.fillStyle = '#2A1F17'; // trou dans la coque
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.lineTo(24, -4);
    ctx.lineTo(16, 8);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // caisse et tonneau
    const cx = -Math.cos(out) * 60 + Math.sin(out) * 80, cy = -Math.sin(out) * 60 - Math.cos(out) * 80;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(cx - 14, cy + 4, 32, 10);
    ctx.fillStyle = '#9A7448';
    ctx.fillRect(cx - 16, cy - 16, 30, 26);
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 16, cy - 16, 30, 26);
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 16);
    ctx.lineTo(cx + 14, cy + 10);
    ctx.stroke();
    ctx.fillStyle = '#7A5A3A';
    ctx.beginPath();
    ctx.ellipse(cx + 30, cy + 2, 11, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4A4E52';
    ctx.beginPath();
    ctx.moveTo(cx + 19, cy - 4);
    ctx.lineTo(cx + 41, cy - 4);
    ctx.moveTo(cx + 19, cy + 8);
    ctx.lineTo(cx + 41, cy + 8);
    ctx.stroke();
    // panneau orienté vers le village
    const ang = Math.atan2(this.map.village.y - this.map.spawn.y, this.map.village.x - this.map.spawn.x);
    const sx = Math.cos(ang) * 70, sy = Math.sin(ang) * 70 + 10;
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(sx - 3, sy - 30, 6, 40);
    ctx.save();
    ctx.translate(sx, sy - 34);
    ctx.rotate(ang); // la flèche pointe exactement vers le village
    ctx.fillStyle = '#8A6A45';
    ctx.beginPath();
    ctx.moveTo(-34, -10);
    ctx.lineTo(24, -10);
    ctx.lineTo(36, 0);
    ctx.lineTo(24, 10);
    ctx.lineTo(-34, 10);
    ctx.closePath();
    ctx.fill();
    if (Math.cos(ang) < 0) ctx.rotate(Math.PI); // texte jamais à l'envers
    ctx.fillStyle = '#EEE7D7';
    ctx.font = '700 12px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Village', 0, 4);
    ctx.restore();
    // titre du côté opposé au panneau
    const ty = Math.sin(ang) < -0.3 ? 120 : -92;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F0B64A';
    ctx.fillText('Plage du naufrage', 0, ty);
    return c;
  }

  private caveCanvas = new Map<number, HTMLCanvasElement>();
  readonly caveW = (CAVE_RX + 160) * 2;
  readonly caveH = (CAVE_RY + 160) * 2;

  /** Entrée d'une grotte sur la carte, selon son biome (voir caves.ts), et son nom. */
  drawCaveEntrance(ctx: CanvasRenderingContext2D, c: Cave, t: number, bossHere: boolean) {
    const { x, y } = c.entrance;
    drawEntrance(ctx, x, y, c.zone, t, bossHere);
    if (SPECIES[c.boss].key === 'weaver') {
      // l'antre de la Tisseuse se reconnaît de loin : toiles tendues aux coins de l'entrée
      drawWeb(ctx, x - 92, y - 46, 70, -0.2, 1.4, c.id, 0.6);
      drawWeb(ctx, x + 92, y - 50, 64, Math.PI - 1.4, Math.PI + 0.2, c.id + 1, 0.6);
      drawWeb(ctx, x + 2, y - 76, 40, 0.3, Math.PI - 0.3, c.id + 2, 0.45);
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = SPECIES[c.boss].title ?? SPECIES[c.boss].name; // le nom du géant qui l'habite
    ctx.strokeText(label, x, y - 128);
    ctx.fillStyle = bossHere ? '#FF9B78' : '#C9CFC2';
    ctx.fillText(label, x, y - 128);
  }

  /** Intérieur d'une grotte (pré-rendu) : sol et parois aux couleurs du biome, éboulis, décors du biome, sortie lumineuse. */
  caveInterior(c: Cave) {
    let cv = this.caveCanvas.get(c.id);
    if (cv) return cv;
    this.caveCanvas.clear(); // ~6 Mo chacun : on ne garde que la grotte où l'on est
    cv = document.createElement('canvas');
    cv.width = this.caveW;
    cv.height = this.caveH;
    const ctx = cv.getContext('2d')!;
    ctx.translate(this.caveW / 2, this.caveH / 2);
    ctx.fillStyle = '#0C1012';
    ctx.fillRect(-this.caveW / 2, -this.caveH / 2, this.caveW, this.caveH);
    // Contour rocheux irrégulier (le même que celui du jeu : caveEdge), à l'échelle k de l'ellipse.
    const outline = (k: number, jag = 0) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const a = (i / 120) * TAU, e = caveEdge(c, a) * k + (jag ? (hash2(i, c.id, this.seed + 5) - 0.5) * jag : 0);
        const px = Math.cos(a) * CAVE_RX * e, py = Math.sin(a) * CAVE_RY * e;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    // parois : deux épaisseurs de roche anguleuse
    const style = INSIDE[c.zone - 1];
    ctx.fillStyle = style.wall;
    outline(1.16, 0.05);
    ctx.fill();
    ctx.fillStyle = '#353A38';
    outline(1.06, 0.035);
    ctx.fill();
    // sol
    const g = ctx.createRadialGradient(0, -40, 40, 0, 0, CAVE_RX);
    const tint = style.floor;
    g.addColorStop(0, tint);
    g.addColorStop(1, '#1E2220');
    ctx.fillStyle = g;
    outline(1);
    ctx.fill();
    if (c.zone === JUNGLE_ZONE) this.templeFloor(ctx, c, outline);
    // éboulis et rochers le long des parois
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + hash2(i, c.id, this.seed) * 0.2, k = (0.9 + hash2(c.id, i, this.seed) * 0.12) * caveEdge(c, a);
      const rx = Math.cos(a) * CAVE_RX * k, ry = Math.sin(a) * CAVE_RY * k, rr = 16 + hash2(i, i, this.seed + c.id) * 22;
      ctx.fillStyle = i % 3 ? '#3A3F3C' : '#4A504C';
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.7, a, 0, TAU);
      ctx.fill();
    }
    // décors du biome au pied des parois : racines, champignons, ossements, stèles à runes, flaques
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + hash2(i, c.id + 7, this.seed) * 0.25, k = 0.8 * caveEdge(c, a);
      const px = Math.cos(a) * CAVE_RX * k, py = Math.sin(a) * CAVE_RY * k;
      if (py > CAVE_RY - 220 && Math.abs(px) < 150) continue; // pas devant la sortie
      insideProp(ctx, c.zone, px, py, a, i);
    }
    if (SPECIES[c.boss].key === 'weaver') this.weaverWebs(ctx, c);
    // sortie : rai de lumière du jour
    const ex = c.exit.x - c.inside.x, ey = c.exit.y - c.inside.y;
    const light = ctx.createRadialGradient(ex, ey + 30, 10, ex, ey + 30, 120);
    light.addColorStop(0, 'rgba(240,226,180,0.55)');
    light.addColorStop(1, 'rgba(240,226,180,0)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(ex, ey + 30, 120, 0, TAU);
    ctx.fill();
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#EEE7D7';
    ctx.fillText('Sortie', ex, ey + 54);
    this.caveCanvas.set(c.id, cv);
    return cv;
  }

  /**
   * Sol d'un temple de la jungle : de grandes dalles de pierre (certaines fendues, d'autres mangées de mousse, des racines
   * qui passent entre), un chemin de dalles claires de la sortie à l'autel, et l'autel rond du géant, gravé d'un soleil.
   */
  private templeFloor(ctx: CanvasRenderingContext2D, c: Cave, outline: (k: number, jag?: number) => void) {
    const h = (i: number, j: number, k: number) => hash2(i * 31 + k, j * 17 + c.id, this.seed + 140);
    ctx.save();
    outline(0.98);
    ctx.clip();
    const S = 56;
    for (let gy = -Math.ceil(CAVE_RY / S); gy <= Math.ceil(CAVE_RY / S); gy++) {
      for (let gx = -Math.ceil(CAVE_RX / S) - 1; gx <= Math.ceil(CAVE_RX / S); gx++) {
        const x = gx * S + (gy % 2 ? S / 2 : 0), y = gy * S * 0.62, w = S - 3, hh = S * 0.62 - 3, r = h(gx, gy, 1);
        const lane = Math.abs(x + w / 2) < S * 0.9; // le chemin de l'autel : dalles plus claires
        ctx.fillStyle = lane ? (r < 0.5 ? '#8A907A' : '#848A74') : r < 0.33 ? '#6A7060' : r < 0.66 ? '#646A5A' : '#5C6252';
        ctx.fillRect(x, y, w, hh);
        ctx.fillStyle = 'rgba(255,255,240,0.07)';
        ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = 'rgba(10,14,8,0.3)';
        ctx.fillRect(x, y + hh - 2, w, 2);
        if (h(gx, gy, 2) < 0.18) {
          // fissure
          ctx.strokeStyle = 'rgba(20,24,18,0.55)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.2, y + 2);
          ctx.lineTo(x + w * 0.45, y + hh * 0.5);
          ctx.lineTo(x + w * 0.35, y + hh - 2);
          ctx.stroke();
        }
        if (!lane && h(gx, gy, 3) < 0.25) {
          // mousse qui a envahi la dalle
          ctx.fillStyle = 'rgba(78,122,58,0.55)';
          ctx.beginPath();
          ctx.ellipse(x + w * (0.3 + h(gx, gy, 4) * 0.4), y + hh * 0.5, w * 0.35, hh * 0.4, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    // racines qui serpentent entre les dalles
    ctx.strokeStyle = 'rgba(74,58,38,0.8)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = h(k, 0, 5) * TAU, x0 = Math.cos(a) * CAVE_RX, y0 = Math.sin(a) * CAVE_RY;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 * 0.7 + (h(k, 1, 6) - 0.5) * 120, y0 * 0.7, x0 * 0.45, y0 * 0.45);
      ctx.stroke();
    }
    ctx.restore();
    // l'autel rond du géant, gravé d'un soleil, au fond
    const ay = -CAVE_RY * 0.3;
    ctx.fillStyle = 'rgba(8,12,8,0.35)';
    ctx.beginPath();
    ctx.ellipse(6, ay + 10, 128, 54, 0, 0, TAU);
    ctx.fill();
    for (const [rx, ry, col] of [[124, 52, '#5E6454'], [112, 46, '#8A907A'], [80, 33, '#7C8370']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, ay, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,66,50,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, ay, 24, 10, 0, 0, TAU);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      ctx.moveTo(Math.cos(a) * 30, ay + Math.sin(a) * 12.5);
      ctx.lineTo(Math.cos(a) * 70, ay + Math.sin(a) * 29);
    }
    ctx.stroke();
  }

  /** Antre de la Mère Tisseuse : grandes toiles d'angle sur les parois, toiles au sol et cocons de proies. */
  private weaverWebs(ctx: CanvasRenderingContext2D, c: Cave) {
    const h = (i: number, k: number) => hash2(i, c.id + k, this.seed + 91);
    // toiles d'angle accrochées à la paroi, ouvertes vers le centre de la grotte
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * TAU + h(i, 1) * 0.3, k = 0.97 * caveEdge(c, a);
      const px = Math.cos(a) * CAVE_RX * k, py = Math.sin(a) * CAVE_RY * k;
      if (py > CAVE_RY - 240 && Math.abs(px) < 170) continue; // la sortie reste dégagée
      const inward = Math.atan2(-py, -px), spread = 0.9 + h(i, 2) * 0.5;
      drawWeb(ctx, px, py, 110 + h(i, 3) * 70, inward - spread, inward + spread, i * 2.3 + c.id);
    }
    // toiles posées au sol, à l'écart du centre (là où dort la Tisseuse)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + h(i, 4) * 0.6, d = 0.45 + h(i, 5) * 0.25;
      const px = Math.cos(a) * CAVE_RX * d, py = Math.sin(a) * CAVE_RY * d;
      if (py > CAVE_RY - 260 && Math.abs(px) < 170) continue;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(1, 0.55); // à plat sur le sol
      drawWeb(ctx, 0, 0, 60 + h(i, 6) * 40, 0, TAU, i * 1.9 + c.id, 0.32);
      ctx.restore();
    }
    // cocons pendus le long de la paroi du fond
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.32 + h(i, 7) * 0.1, k = 0.82 * caveEdge(c, a);
      drawCocoon(ctx, Math.cos(a) * CAVE_RX * k, Math.sin(a) * CAVE_RY * k + 20, 11 + h(i, 8) * 6);
    }
  }

  /** Feu de camp animé au centre du village. */
  /** Emplacement de camp : cercle de pierres froid et piquets ; une fois établi, tentes, fanion et feu allumé. */
  drawSite(ctx: CanvasRenderingContext2D, i: number, established: boolean, t: number) {
    const { x, y } = this.map.sites[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(110,97,66,0.55)'; // terre battue
    ctx.beginPath();
    ctx.ellipse(0, 10, 150, 110, 0, 0, TAU);
    ctx.fill();
    if (established) {
      const lay = this.map.siteLayout[i];
      for (const [k, { x: tx, y: ty }] of lay.tents.entries()) {
        const col = k ? '#A8743F' : '#7F6A48';
        ctx.fillStyle = 'rgba(8,14,12,0.3)';
        ctx.beginPath();
        ctx.ellipse(tx + 6, ty + 30, 40, 11, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(tx - 38, ty + 28);
        ctx.lineTo(tx, ty - 26);
        ctx.lineTo(tx + 38, ty + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2A1F17';
        ctx.beginPath();
        ctx.moveTo(tx - 11, ty + 28);
        ctx.lineTo(tx, ty + 4);
        ctx.lineTo(tx + 11, ty + 28);
        ctx.closePath();
        ctx.fill();
      }
      // fanion du village
      const { x: fx, y: fy } = lay.flag;
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(fx - 2, fy - 50, 4, 58);
      const wave = Math.sin(t * 3) * 3;
      ctx.fillStyle = '#5CC8B8';
      ctx.beginPath();
      ctx.moveTo(fx + 2, fy - 48);
      ctx.lineTo(fx + 36, fy - 40 + wave);
      ctx.lineTo(fx + 2, fy - 30);
      ctx.closePath();
      ctx.fill();
    } else {
      // piquets qui délimitent l'emplacement
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.2, px = Math.cos(a) * 130, py = Math.sin(a) * 95 + 10;
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(px - 2, py - 16, 4, 18);
        ctx.fillStyle = '#E8DCC0';
        ctx.fillRect(px - 2, py - 16, 4, 4);
      }
    }
    // cercle de pierres du feu
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      ctx.fillStyle = k % 2 ? '#6E726C' : '#5E625C';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 24, Math.sin(a) * 16 + 2, 7, 5, 0, 0, TAU);
      ctx.fill();
    }
    if (established) this.drawCampfire(ctx, t);
    else {
      ctx.fillStyle = '#2A1F17';
      ctx.beginPath();
      ctx.ellipse(0, 2, 14, 9, 0, 0, TAU);
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = established ? campName(i) : 'Emplacement de camp';
    ctx.strokeText(label, 0, -170);
    ctx.fillStyle = established ? '#F0B64A' : '#C9CFC2';
    ctx.fillText(label, 0, -170);
    ctx.restore();
  }

  /**
   * École des dompteurs, au village : un terrain en friche tant que son plan n'est pas trouvé (au Camp avancé), le terrain
   * piqueté une fois le plan rapporté, le chantier d'Aubin (échafaudage, compte à rebours), puis la maison au grand livre.
   */
  drawSchool(ctx: CanvasRenderingContext2D, state: 'none' | 'plan' | 'building' | 'built', left: number, t: number) {
    const built = state === 'built', camp = state !== 'none';
    const { x, y } = this.map.school;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 8, 58, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6E726C'; // estrade
    ctx.fillRect(-50, -6, 100, 12);
    ctx.fillStyle = '#5E625C';
    for (let k = -50; k < 50; k += 20) ctx.fillRect(k + 1, 2, 18, 3);
    if (built) {
      ctx.fillStyle = '#E2D3B0'; // murs
      ctx.fillRect(-40, -54, 80, 50);
      ctx.fillStyle = '#5B3F2C'; // colombages
      for (const k of [-40, -14, 12, 37]) ctx.fillRect(k, -54, 3, 50);
      ctx.fillRect(-40, -32, 80, 3);
      ctx.fillStyle = '#3E5A6E'; // toit d'ardoise
      ctx.beginPath();
      ctx.moveTo(-50, -52);
      ctx.lineTo(0, -88);
      ctx.lineTo(50, -52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2E4352';
      ctx.fillRect(-50, -54, 100, 4);
      ctx.fillStyle = '#2A1F17'; // porte
      ctx.fillRect(-9, -26, 18, 22);
      // fenêtres éclairées (elles vacillent : quelqu'un lit)
      const glow = 0.75 + 0.25 * Math.sin(t * 2.3);
      ctx.fillStyle = `rgba(240,182,74,${glow})`;
      ctx.fillRect(-32, -26, 12, 10);
      ctx.fillRect(20, -26, 12, 10);
      // grand livre ouvert, enseigne au-dessus de la porte
      ctx.fillStyle = '#8A3B2E';
      ctx.fillRect(-15, -50, 30, 15);
      ctx.fillStyle = '#F2E8CF';
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.quadraticCurveTo(-7, -50, -13, -47);
      ctx.lineTo(-13, -37);
      ctx.quadraticCurveTo(-7, -40, 0, -37);
      ctx.quadraticCurveTo(7, -40, 13, -37);
      ctx.lineTo(13, -47);
      ctx.quadraticCurveTo(7, -50, 0, -46);
      ctx.fill();
      ctx.strokeStyle = '#8B7E64';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(0, -37);
      ctx.stroke();
    } else if (camp) {
      // chantier : quatre piquets aux coins et une pile de planches
      for (const [px, py] of [[-40, -4], [40, -4], [-34, -40], [34, -40]]) {
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(px - 2, py - 16, 4, 18);
        ctx.fillStyle = '#E8DCC0';
        ctx.fillRect(px - 2, py - 16, 4, 4);
      }
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? '#A8743F' : '#8E6136';
        ctx.fillRect(-22 + k * 3, -12 - k * 5, 44, 5);
      }
    }
    if (state === 'building') {
      // échafaudage d'Aubin : deux montants, une traverse, et les murs qui montent avec le temps
      ctx.fillStyle = '#E2D3B0';
      ctx.fillRect(-36, -26, 72, 22);
      ctx.strokeStyle = '#7A5A3A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const px of [-44, 44]) {
        ctx.moveTo(px, -2);
        ctx.lineTo(px, -70);
      }
      ctx.moveTo(-48, -46);
      ctx.lineTo(48, -46);
      ctx.moveTo(-44, -6);
      ctx.lineTo(44, -66);
      ctx.stroke();
      const swing = Math.sin(t * 6) * 0.5;
      ctx.fillStyle = '#C9CFC2'; // le marteau qui va et vient
      ctx.save();
      ctx.translate(30, -46);
      ctx.rotate(swing);
      ctx.fillRect(-1.5, -14, 3, 14);
      ctx.fillRect(-5, -17, 10, 5);
      ctx.restore();
    }
    if (state === 'none') {
      // terrain en friche : quelques broussailles et cailloux à la place de l'estrade
      for (let k = 0; k < 7; k++) {
        const px = -44 + hash2(k, 11, this.seed) * 88, py = -16 + hash2(k, 12, this.seed) * 22;
        ctx.fillStyle = k % 2 ? '#2E4A2C' : '#6E726C';
        ctx.beginPath();
        ctx.ellipse(px, py, k % 2 ? 10 : 7, k % 2 ? 8 : 5, 0, 0, TAU);
        ctx.fill();
      }
    }
    const label = built ? 'École des dompteurs' : state === 'building' ? `Chantier de l'école · ${clockOf(left)}` : 'École des dompteurs';
    const sub = state === 'none' ? 'son plan : au Camp avancé' : state === 'plan' ? 'Aubin peut la bâtir' : '';
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const ly = built ? -104 : state === 'building' ? -84 : -40;
    ctx.strokeText(label, 0, ly);
    ctx.fillStyle = built ? '#F0B64A' : state === 'none' ? '#A9B3A6' : '#C9CFC2';
    ctx.fillText(label, 0, ly);
    if (sub) {
      ctx.font = '600 13px Outfit, sans-serif';
      ctx.strokeText(sub, 0, ly + 17);
      ctx.fillStyle = '#C9CFC2';
      ctx.fillText(sub, 0, ly + 17);
    }
    ctx.restore();
  }

  /** Pierre de passage : un menhir gravé, dont la rune luit quand elle est reliée. */
  drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, t: number, label?: string) {
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 6, 24, 8, 0, 0, TAU);
    ctx.fill();
    if (active) {
      const pulse = 0.5 + Math.sin(t * 2.4) * 0.15;
      const glow = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 70);
      glow.addColorStop(0, `rgba(92,200,184,${0.4 * pulse})`);
      glow.addColorStop(1, 'rgba(92,200,184,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y - 30, 70, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#5E6662';
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 4);
    ctx.lineTo(x - 15, y - 48);
    ctx.quadraticCurveTo(x - 2, y - 66, x + 13, y - 50);
    ctx.lineTo(x + 18, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#737C77';
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 48);
    ctx.quadraticCurveTo(x - 2, y - 66, x + 13, y - 50);
    ctx.lineTo(x + 4, y - 44);
    ctx.lineTo(x - 8, y - 42);
    ctx.closePath();
    ctx.fill();
    // rune
    ctx.strokeStyle = active ? '#9FF5E6' : '#3E4542';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 38);
    ctx.lineTo(x, y - 10);
    ctx.moveTo(x - 7, y - 30);
    ctx.lineTo(x, y - 22);
    ctx.lineTo(x + 7, y - 30);
    ctx.moveTo(x - 6, y - 14);
    ctx.lineTo(x + 6, y - 14);
    ctx.stroke();
    if (!label) return;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, x, y - 78);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, x, y - 78);
  }

  drawCampfire(ctx: CanvasRenderingContext2D, t: number) {
    ctx.fillStyle = '#4A3424';
    ctx.save();
    for (const a of [0.4, -0.4, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(-18, -4, 36, 8);
      ctx.restore();
    }
    ctx.restore();
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 90);
    glow.addColorStop(0, 'rgba(240,182,74,0.35)');
    glow.addColorStop(1, 'rgba(240,182,74,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -4, 90, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#E8693F';
    ctx.beginPath();
    ctx.ellipse(0, -8 * f, 13, 20 * f, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    ctx.ellipse(0, -4 * f, 7, 12 * f, 0, 0, TAU);
    ctx.fill();
  }
}

// ── Échoppe du marché : petits éléments dessinés, en aplats sans contour (comme les autres bâtiments) ──

function stallBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 2) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Cage d'un monstre à vendre (un gluant), posée sur le comptoir. */
function stallCage(ctx: CanvasRenderingContext2D, x: number, y: number) {
  stallBox(ctx, x - 16, y - 24, 32, 24, 'rgba(40,30,20,0.35)', 3);
  ctx.fillStyle = '#7FCB5B';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 9, 7, 0, Math.PI, 0);
  ctx.lineTo(x + 9, y - 2);
  ctx.lineTo(x - 9, y - 2);
  ctx.fill();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(x - 3, y - 8, 1.4, 0, TAU);
  ctx.arc(x + 3, y - 8, 1.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3A2819';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = -12; k <= 12; k += 6) {
    ctx.moveTo(x + k, y - 24);
    ctx.lineTo(x + k, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x - 18, y - 27, 36, 4);
  ctx.strokeStyle = '#C9A24A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 30, 4, Math.PI, 0);
  ctx.stroke();
}

/** Panier d'essences lumineuses. */
function stallEssences(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(180,140,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 14, 9, 0, 0, TAU);
  ctx.fill();
  for (const [ox, oy, c] of [[-6, -9, '#B48CFF'], [1, -12, '#E2D3FF'], [7, -8, '#9C70F0'], [-1, -6, '#C9A8FF']] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, 3.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#B98B5A';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 7);
  ctx.lineTo(x + 12, y - 7);
  ctx.lineTo(x + 9, y + 1);
  ctx.lineTo(x - 9, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,30,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 3);
  ctx.lineTo(x + 10, y - 3);
  ctx.stroke();
}

/** Petite pile de pièces d'or. */
function stallCoins(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#F0B64A';
  ctx.strokeStyle = '#7A5418';
  ctx.lineWidth = 1;
  for (const [ox, oy] of [[0, 0], [5, -2], [2, -4], [-4, -1]]) {
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, 3.5, 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

/** Lanterne suspendue, avec son halo. */
function stallLantern(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#3A2819';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,100,0.25)';
  ctx.beginPath();
  ctx.arc(x, y + 6, 9, 0, TAU);
  ctx.fill();
  stallBox(ctx, x - 3.5, y, 7, 10, '#F7C766', 2);
}

// ── Épave coupée en deux (bout de l'île) : poupe à gauche, proue à droite, en coordonnées locales ──
const SHIP_WOOD = '#6B4A33', SHIP_DARK = '#4A3322', SHIP_LIGHT = '#8A6446', SHIP_DECK = '#9A7448', SHIP_HOLE = '#24180F';

function shipPlank(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, l: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.fillRect(-l / 2 + 2, -2, l, 7);
  ctx.fillStyle = SHIP_LIGHT;
  ctx.fillRect(-l / 2, -4, l, 6);
  ctx.restore();
}

function shipBarrel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, 10, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7A5A3A';
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 11, 0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4A4E52';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 11, 0.3, -0.9, 0.9);
  ctx.stroke();
}

/**
 * Épave coupée en deux, un peu délabrée : la poupe et la proue séparées par une bande de sable, membrures à nu aux
 * cassures, beaupré cassé ; entre les deux, des planches et un tonneau ; à côté, un bout de mât et sa voile déchirée.
 */
/**
 * Pont de bois entre l'île et l'îlot du village (coordonnées du monde) : son ombre sur l'eau, les pieux qui plongent,
 * des planches en travers, un peu irrégulières (une plus sombre, une décalée), et un garde-corps de chaque côté.
 * Cassé (au début) : il ne reste que des bouts de tablier aux deux rives, des pieux penchés ou brisés au milieu, une corde
 * qui pend, et des planches qui flottent au fil de l'eau.
 */
export function drawBridge(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, seed: number, built: boolean, t: number) {
  const l = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x), half = BRIDGE_W / 2;
  const kept = (x: number) => built || x < l * 0.2 || x > l * 0.82 || (x > l * 0.46 && x < l * 0.52); // planches restées en place
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(ang);
  // ombre portée sur l'eau, là où il y a un tablier
  ctx.fillStyle = 'rgba(10,30,40,0.35)';
  if (built) ctx.fillRect(4, -half + 8, l, BRIDGE_W);
  else {
    ctx.fillRect(4, -half + 8, l * 0.2, BRIDGE_W);
    ctx.fillRect(l * 0.82 + 4, -half + 8, l * 0.18, BRIDGE_W);
  }
  // pieux, et remous autour ; cassé : certains penchent, d'autres sont brisés au ras de l'eau
  for (let x = 30, k = 0; x < l - 10; x += 70, k++) {
    for (const s of [-1, 1]) {
      const h = hash2(k, s, seed + 83), broken = !built && x > l * 0.2 && x < l * 0.82 && h < 0.45;
      const ripple = (Math.sin(t * 2 + k + s) + 1) * 0.5;
      ctx.strokeStyle = `rgba(226,240,236,${0.3 + ripple * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, s * (half - 3) + 10, 9 + ripple * 3, 3.5 + ripple, 0, 0, TAU);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, s * (half - 3) + 10);
      if (!built && !broken && x > l * 0.2 && x < l * 0.82) ctx.rotate((h - 0.5) * 0.7); // il penche
      ctx.fillStyle = '#3E2A1C';
      ctx.fillRect(-4, broken ? -5 : -12, 8, broken ? 5 : 12);
      if (broken) {
        ctx.fillStyle = '#6B4A33'; // l'éclat du bois cassé
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(-1, -9);
        ctx.lineTo(2, -6);
        ctx.lineTo(4, -8);
        ctx.lineTo(4, -5);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // longerons (seulement sous le tablier qui reste), puis planches en travers
  ctx.fillStyle = '#4A3322';
  if (built) ctx.fillRect(-6, -half + 2, l + 12, BRIDGE_W - 4);
  else {
    ctx.fillRect(-6, -half + 2, l * 0.2 + 6, BRIDGE_W - 4);
    ctx.fillRect(l * 0.82, -half + 2, l * 0.18 + 6, BRIDGE_W - 4);
    ctx.fillRect(l * 0.2, -half + 4, l * 0.1, 6); // un longeron qui dépasse dans le vide
  }
  for (let x = -4, k = 0; x < l + 4; x += 12, k++) {
    if (!kept(x)) continue;
    const h = hash2(k, 7, seed + 81), w = 10 + h * 1.5, dy = (hash2(k, 9, seed + 82) - 0.5) * 3;
    const loose = !built && x > l * 0.4 && x < l * 0.6; // une planche seule au milieu, de travers sur un pieu
    ctx.save();
    if (loose) {
      ctx.translate(x, 0);
      ctx.rotate(0.5);
      ctx.translate(-x, 0);
    }
    ctx.fillStyle = h < 0.15 || !built ? '#6B4A33' : h < 0.6 ? '#8B6A47' : '#9C7A52';
    ctx.fillRect(x, -half + 3 + dy, w, BRIDGE_W - 6);
    ctx.fillStyle = 'rgba(255,230,190,0.12)';
    ctx.fillRect(x, -half + 3 + dy, w, 2);
    ctx.fillStyle = 'rgba(20,12,8,0.35)';
    ctx.fillRect(x + w - 1, -half + 3 + dy, 1, BRIDGE_W - 6);
    ctx.restore();
  }
  if (!built) {
    // planches qui flottent et dérivent doucement à côté
    for (let k = 0; k < 5; k++) {
      const fx = l * (0.28 + hash2(k, 3, seed + 84) * 0.5) + Math.sin(t * 0.6 + k) * 6, fy = (k % 2 ? 1 : -1) * (half + 16 + hash2(k, 4, seed + 84) * 40);
      ctx.save();
      ctx.translate(fx, fy + Math.sin(t * 1.3 + k * 2) * 2);
      ctx.rotate(hash2(k, 5, seed + 84) * Math.PI);
      ctx.fillStyle = 'rgba(10,30,40,0.3)';
      ctx.fillRect(-15, -3, 32, 9);
      ctx.fillStyle = '#7A5A3A';
      ctx.fillRect(-16, -5, 32, 9);
      ctx.restore();
    }
  }
  // garde-corps : une main courante et ses poteaux de chaque côté ; cassé, une corde qui pend dans le vide d'un côté
  for (const s of [-1, 1]) {
    const y = s * (half - 2);
    const spans: [number, number][] = built ? [[-4, l + 4]] : [[-4, l * 0.2], [l * 0.82, l + 4]];
    for (const [x0, x1] of spans) {
      ctx.strokeStyle = '#3E2A1C';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.strokeStyle = '#7A5A3A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y - 1);
      ctx.lineTo(x1, y - 1);
      ctx.stroke();
      for (let x = Math.ceil(x0 / 35) * 35; x <= x1; x += 35) {
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    if (!built && s < 0) {
      ctx.strokeStyle = '#B8A27A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l * 0.2, y);
      ctx.quadraticCurveTo(l * 0.5, y + 34 + Math.sin(t * 1.2) * 3, l * 0.82, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawShipwreck(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(8,14,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(8, 14, 140, 32, 0, 0, TAU);
  ctx.fill();
  // poupe, cassée à droite
  ctx.save();
  ctx.translate(-55, 0);
  ctx.rotate(0.08);
  ctx.beginPath();
  ctx.moveTo(-70, -26);
  ctx.quadraticCurveTo(-10, -36, 40, -30);
  ctx.lineTo(34, -18);
  ctx.lineTo(44, -8);
  ctx.lineTo(36, 4);
  ctx.lineTo(46, 14);
  ctx.lineTo(38, 30);
  ctx.quadraticCurveTo(-10, 36, -70, 26);
  ctx.quadraticCurveTo(-78, 0, -70, -26);
  ctx.closePath();
  ctx.fillStyle = SHIP_WOOD;
  ctx.fill();
  ctx.fillStyle = SHIP_DECK;
  ctx.fillRect(-60, -20, 86, 38);
  ctx.strokeStyle = 'rgba(74,51,34,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = -48; k < 26; k += 12) {
    ctx.moveTo(k, -20);
    ctx.lineTo(k, 18);
  }
  ctx.stroke();
  ctx.fillStyle = SHIP_LIGHT; // château arrière
  ctx.fillRect(-64, -18, 26, 34);
  ctx.fillStyle = SHIP_DARK;
  ctx.fillRect(-60, -14, 18, 26);
  ctx.fillStyle = SHIP_HOLE; // la cale, ouverte à la cassure
  ctx.fillRect(10, -16, 22, 30);
  ctx.strokeStyle = SHIP_LIGHT; // membrures à nu
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const k of [-12, -2, 8]) {
    ctx.moveTo(14, k - 10);
    ctx.quadraticCurveTo(28, k, 14, k + 10);
  }
  ctx.stroke();
  ctx.restore();
  // proue, cassée à gauche, un peu tournée
  ctx.save();
  ctx.translate(80, 6);
  ctx.rotate(-0.22);
  ctx.beginPath();
  ctx.moveTo(-36, -28);
  ctx.quadraticCurveTo(20, -32, 64, 0);
  ctx.quadraticCurveTo(20, 32, -36, 28);
  ctx.lineTo(-30, 16);
  ctx.lineTo(-40, 6);
  ctx.lineTo(-32, -6);
  ctx.lineTo(-42, -16);
  ctx.closePath();
  ctx.fillStyle = SHIP_WOOD;
  ctx.fill();
  ctx.fillStyle = SHIP_DECK;
  ctx.beginPath();
  ctx.moveTo(-28, -20);
  ctx.quadraticCurveTo(16, -22, 50, 0);
  ctx.quadraticCurveTo(16, 22, -28, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SHIP_HOLE;
  ctx.fillRect(-28, -14, 16, 26);
  ctx.fillStyle = SHIP_LIGHT; // beaupré cassé
  ctx.save();
  ctx.translate(60, 0);
  ctx.rotate(0.1);
  ctx.fillRect(0, -3, 26, 6);
  ctx.restore();
  ctx.restore();
  // entre les deux morceaux : sable amassé, planches, tonneau
  ctx.fillStyle = 'rgba(214,190,138,0.9)';
  ctx.beginPath();
  ctx.ellipse(8, 6, 18, 24, 0, 0, TAU);
  ctx.fill();
  shipPlank(ctx, 4, -10, 1.2, 26);
  shipPlank(ctx, 16, 18, 0.4, 22);
  shipBarrel(ctx, -4, 34);
  // bout de mât couché, voile déchirée
  ctx.save();
  ctx.translate(-70, -40);
  ctx.rotate(-0.25);
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.fillRect(6, 5, 70, 6);
  ctx.fillStyle = SHIP_LIGHT;
  ctx.fillRect(0, -4, 70, 8);
  ctx.fillStyle = SHIP_DARK;
  ctx.beginPath();
  ctx.moveTo(70, -4);
  ctx.lineTo(75, -2);
  ctx.lineTo(72, 0);
  ctx.lineTo(76, 3);
  ctx.lineTo(70, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-40, -62);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#D9CCAE';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(38, 4);
  ctx.lineTo(34, 16);
  ctx.lineTo(27, 13);
  ctx.lineTo(23, 23);
  ctx.lineTo(13, 18);
  ctx.lineTo(4, 25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(120,100,70,0.35)';
  ctx.beginPath();
  ctx.ellipse(18, 9, 4.5, 2.7, 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}
