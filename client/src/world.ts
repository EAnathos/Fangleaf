// Terrain procédural par morceaux (chunks) mis en cache, village et plage d'arrivée pré-rendus.
// Tout découle de la WorldMap partagée : zones, lacs, chemin du camp au village.

import { BUILDINGS, buildingCost, costText, CAMP_COST, CAVE_RX, CAVE_RY, DEN_OFFSET, FORGE_OFFSET, BOARD_OFFSET, HALL_OFFSET, MARKET_OFFSET, STORE_OFFSET, SPECIES, VILLAGE_R, campName, type BuildingId } from '../../shared/config.ts';
import { fbm, hash2 } from '../../shared/math.ts';
import { BEACH, caveEdge, MAP_CELL, SEA_SHALLOW, type Cave, type WorldMap } from '../../shared/worldmap.ts';
import { maxDpr, settings } from './settings.ts';
import { drawCocoon, drawEntrance, drawWeb, INSIDE, insideProp } from './caves.ts';

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
const MOUTH = 280; // à moins de ça de la côte, l'eau d'un lac se fond dans celle de la mer
export const ZONE_GROUND = [[74, 94, 62], [63, 106, 59], [52, 88, 57], [72, 82, 48], [44, 69, 66], [56, 82, 76], [204, 172, 114], [86, 132, 72]];
const STEPPE = [124, 140, 78]; // lisière verte entre le sable du désert et la mer
const COAST_GREEN = 700; // largeur de cette lisière
const PATH = [110, 97, 66];
const VILLAGE_GROUND = [79, 101, 63]; // herbe de la place, tondue

// Style commun à tous les chemins de terre : liseré sombre, terre, trace claire au centre. [r, g, b, alpha, largeur]
const PATH_PASSES: [number, number, number, number, number][] = [[60, 50, 32, 0.35, 50], [110, 97, 66, 1, 40], [140, 124, 88, 0.35, 14]];
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
  const d = Math.hypot(x - map.village.x, y - map.village.y) - VILLAGE_R;
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
  return v ? lerp3(col, VILLAGE_GROUND, v) : col;
}

/**
 * Lisière verte de la Mer de sable : au bord de l'eau (mer ou lac), le sable laisse place à une steppe (palmiers),
 * pour que le désert ne touche jamais l'eau directement. 0 ailleurs, 1 au bord de l'eau, au bord irrégulier.
 */
export function coastGreen(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y), d = (m.z0 === 6 ? 1 - m.t : 0) + (m.z1 === 6 ? m.t : 0);
  if (!d) return 0;
  // distance à l'eau la plus proche : la mer, ou un lac (les lacs des Lacs brumeux voisins s'ouvrent sur l'océan)
  let near = -map.shoreAt(x, y);
  for (const r of [160, 320, 520]) {
    if (r >= near) break;
    for (let k = 0; k < 8; k++) {
      if (map.isWater(x + Math.cos(k * 0.785) * r, y + Math.sin(k * 0.785) * r)) {
        near = r;
        break;
      }
    }
  }
  const u = Math.min(1, Math.max(0, 1 - near / COAST_GREEN + (fbm(x / 300, y / 300, map.seed + 76, 2) - 0.5) * 0.5));
  return d * u * u * (3 - 2 * u);
}

/** Part de Mer de sable en un point (0 ailleurs, 1 en plein désert, en fondu à la frontière). */
export function desertMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === 6 ? 1 - m.t : 0) + (m.z1 === 6 ? m.t : 0);
}

/** Couleur de la mer : claire le long de la côte, de plus en plus sombre vers le large. */
export function seaColor(map: WorldMap, x: number, y: number, surf = true) {
  const sh = map.shoreAt(x, y), col = lerp3(SEA_SHALLOW_COL, SEA_DEEP, Math.min(1, Math.max(0, sh) / (SEA_SHALLOW + 500)));
  const foam = surf ? Math.max(0, 1 - sh / 70) : 0; // écume au bord, fondue (pas de chapelet de bulles)
  return foam ? lerp3(col, FOAM, foam * foam * 0.75) : col;
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
  const k = 1 + Math.max(-0.22, Math.min(0.22, slope)) + (h - 0.5) * 0.08;
  return [col[0] * k, col[1] * k, col[2] * k];
}

const rgb = (c: number[], k: number) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;

export class World {
  private chunks = new Map<string, HTMLCanvasElement>();
  readonly village: HTMLCanvasElement;
  readonly villageSize = (VILLAGE_R + 90) * 2;
  readonly camp: HTMLCanvasElement;
  readonly campSize = 420;
  readonly seed: number;

  /** Pieux de la palissade (coordonnées du monde), de hauteur un peu irrégulière ; poteaux des 4 portes. */
  readonly stakes: { x: number; y: number; h: number; next?: { x: number; y: number } }[] = [];
  readonly gatePosts: { x: number; y: number; side: number; s: number }[] = [];

  constructor(readonly map: WorldMap) {
    this.seed = map.seed;
    const v = map.village, n = 160;
    const at = (a: number) => ({ x: v.x + Math.cos(a) * VILLAGE_R, y: v.y + Math.sin(a) * VILLAGE_R });
    const open = (a: number) => [0, 1, 2, 3, 4].some((g) => Math.abs(a - (g * Math.PI) / 2) < 0.085);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (open(a)) continue;
      // traverse jusqu'au pieu suivant, sauf devant une porte
      const b = ((i + 1) / n) * TAU;
      this.stakes.push({ ...at(a), h: 20 + ((i * 7) % 5) * 1.6, next: open(b) ? undefined : at(b) });
    }
    for (let side = 0; side < 4; side++) for (const s of [-1, 1]) this.gatePosts.push({ ...at((side * Math.PI) / 2 + s * 0.1), side, s });
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
        // mer au débouché d'un lac : ni écume ni sable, l'eau continue
        const mouth = sea && sh < 90 && [40, 80].some((r) => [0, 1, 2, 3, 4, 5, 6, 7].some((a) => {
          const qx = px + Math.cos(a * 0.785) * r, qy = py + Math.sin(a * 0.785) * r;
          return map.isWater(qx, qy) && !map.isSea(qx, qy);
        }));
        let col = mouth ? seaColor(map, px, py, false) : sea ? seaColor(map, px, py) : landColor(map, px, py);
        if (!sea && sh > -MOUTH && map.isWater(px, py)) {
          // lac ou bras d'eau près de la côte : il passe peu à peu au bleu de la mer (embouchure sans couture)
          const k = Math.min(1, Math.max(0, (sh + MOUTH) / (MOUTH - 20)));
          const deep = [1, -1].every((d) => map.isWater(px + d * 2 * TILE, py) && map.isWater(px, py + d * 2 * TILE)); // comme les disques des lacs
          col = lerp3(deep ? LAKE_DEEP : LAKE_WATER, SEA_SHALLOW_COL, k * k * (3 - 2 * k));
        } else if (!mouth && Math.abs(sh) < 32) {
          // au bord de l'eau, la mer et le sable se fondent : la côte est continue une fois agrandie (pas de marches)
          const k = (sh + 32) / 64, f = k * k * (3 - 2 * k);
          col = lerp3(sea ? landColor(map, px, py) : col, sea ? col : seaColor(map, px, py), f);
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

    // Petit chemin de la plage au village : sable tassé, bordé de petits cailloux.
    // Bouts droits : le raccord avec la route du village, dans le même axe, est invisible.
    ctx.strokeStyle = 'rgba(214,196,150,0.9)';
    ctx.lineWidth = 26;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    map.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,140,100,0.35)';
    ctx.lineWidth = 8;
    ctx.stroke();
    for (let i = 1; i < map.path.length; i++) {
      const [ax, ay] = map.path[i - 1], [bx, by] = map.path[i], l = Math.hypot(bx - ax, by - ay) || 1;
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

    // Lacs (pas la mer) : disques par case pour des berges arrondies (berge, puis eau, puis eau profonde).
    const water: [number, number, boolean, boolean][] = []; // x, y, profonde, près de l'embouchure (pas de berge)
    for (let ty = oy - TILE; ty < oy + CHUNK + TILE; ty += TILE) {
      for (let tx = ox - TILE; tx < ox + CHUNK + TILE; tx += TILE) {
        const px = tx + TILE / 2, py = ty + TILE / 2;
        if (!map.isWater(px, py) || map.isSea(px, py) || map.shoreAt(px, py) > -MOUTH) continue; // près de la côte : peint avec le sol (fondu vers la mer)
        const deep = map.isWater(px + 2 * TILE, py) && map.isWater(px - 2 * TILE, py) && map.isWater(px, py + 2 * TILE) && map.isWater(px, py - 2 * TILE);
        water.push([px, py, deep, map.shoreAt(px, py) > -MOUTH - 70]);
      }
    }
    if (water.length) {
      for (const [color, rad, onlyDeep] of [['#5E6B49', 17, false], ['#3D7F8C', 13.5, false], ['#2E6574', 14, true]] as const) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const [px, py, deep, mouth] of water) {
          if ((onlyDeep && !deep) || (mouth && color === '#5E6B49')) continue; // pas de berge en bordure de l'embouchure
          // un peu de désordre : des berges arrondies et irrégulières, pas des bords au cordeau
          const jx = (hash2(px, py, this.seed + 31) - 0.5) * 6, jy = (hash2(py, px, this.seed + 32) - 0.5) * 6, r = rad + (hash2(px, py, this.seed + 33) - 0.5) * 5;
          ctx.moveTo(px + jx + r, py + jy);
          ctx.arc(px + jx, py + jy, r, 0, TAU);
        }
        ctx.fill();
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
      if (z === 6 && coastGreen(this.map, x, y) < 0.45) {
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
      } else if (h < (z === 7 ? 0.7 : 0.62) && (z === 1 || z === 0 || z === 7)) {
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

  /** Taille d'un arbre (même hasard que WorldMap.decorSize). */
  treeSize(x: number, y: number) {
    return 26 + hash2(x | 0, y | 0, this.seed) * 16;
  }

  /** Ombre portée d'un arbre, au sol (dessinée avant les créatures). */
  treeShadow(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const s = this.treeSize(x, y);
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
    const s = this.treeSize(x, y), h = hash2(x | 0, y | 0, this.seed + 9);
    const v = Math.floor(hash2(x | 0, y | 0, this.seed + 13) * TREE_VARIANTS);
    if (z === 6) {
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
    const pine = (z === 2 && h < 0.55) || (z === 3 && h < 0.35);
    const fruit = !pine && (z <= 2 || z === 7) && h > (z === 7 ? 0.55 : 0.8); // le Havre paisible est en fleurs
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
      ctx.fillStyle = z === 1 ? '#E8A43C' : z === 7 ? '#F4B6CF' : '#D886C9';
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
        const toGate = linked.includes(side);
        const end = toGate ? VILLAGE_R + 60 : VILLAGE_R + 85;
        const from = k === 2 ? 112 : 0; // la trace claire ne traverse pas la place
        if (toGate) ctx.strokeStyle = rgba(pass);
        else {
          const grad = ctx.createLinearGradient(0, 0, cx * end, cy * end);
          grad.addColorStop(0, rgba(pass));
          grad.addColorStop((VILLAGE_R - 10) / end, rgba(pass));
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

  /** Palissade pas encore construite : un piquet de repère de loin en loin, et la corde tendue entre eux. */
  drawPalisadePlan(ctx: CanvasRenderingContext2D) {
    const v = this.map.village;
    ctx.strokeStyle = 'rgba(232,220,192,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(v.x, v.y, VILLAGE_R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < this.stakes.length; k += 8) {
      const { x, y } = this.stakes[k];
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(x - 2, y - 14, 4, 16);
      ctx.fillStyle = '#E8DCC0';
      ctx.fillRect(x - 2, y - 14, 4, 4);
    }
    const label = `${BUILDINGS.palisade.name} · ${costText(buildingCost('palisade'))}`;
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

  /** Entrepôt (coordonnées du village) : caisses, rondins et tas de pierres, qui grossissent avec la réserve. */
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
    // caisse
    ctx.fillStyle = '#8B5A33';
    ctx.fillRect(x - 8, y - 14, 16, 16);
    ctx.strokeStyle = '#3A2819';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 8, y - 14, 16, 16);
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 14);
    ctx.lineTo(x + 8, y + 2);
    ctx.stroke();
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
  drawBuilding(ctx: CanvasRenderingContext2D, b: Plot, built: boolean, hall: number, cleared = true) {
    if (!cleared) return this.drawWildPlot(ctx, b);
    if (!built) return this.drawPlot(ctx, b, hall);
    if (b === 'forge') this.drawForge(ctx);
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
    const label = `${BUILDINGS[p].name} · ${costText(buildingCost(p))}`;
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
    const need = BUILDINGS[b].hall;
    const label = `${BUILDINGS[b].name} · ${hall < need ? `Hôtel de ville niv. ${need}` : costText(buildingCost(b))}`;
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

  private drawForge(ctx: CanvasRenderingContext2D) {
    const fx = FORGE_OFFSET.x, fy = FORGE_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(fx - 66, fy + 40, 76, 10);
    ctx.fillStyle = '#4B4F55';
    ctx.fillRect(fx - 74, fy - 40, 76, 80);
    ctx.fillStyle = '#3C3F44';
    ctx.fillRect(fx - 74, fy - 40, 76, 14);
    ctx.fillStyle = '#E8693F';
    ctx.fillRect(fx - 56, fy - 10, 40, 22);
    ctx.fillStyle = '#F0B64A';
    ctx.fillRect(fx - 48, fy - 2, 24, 10);
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
    ctx.fillText('Forge', fx - 36, fy - 50);
  }

  /** Marché : étal sous un auvent rayé, caisses et cage d'un monstre à vendre. */
  private drawMarket(ctx: CanvasRenderingContext2D) {
    const mx = MARKET_OFFSET.x, my = MARKET_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(mx - 52, my + 34, 112, 14);
    // poteaux et comptoir
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(mx - 52, my - 40, 6, 80);
    ctx.fillRect(mx + 46, my - 40, 6, 80);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(mx - 54, my + 8, 108, 30);
    ctx.fillStyle = '#9C7A52';
    ctx.fillRect(mx - 54, my + 8, 108, 6);
    // auvent rayé
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#EEE7D7' : '#5CC8B8';
      ctx.beginPath();
      ctx.moveTo(mx - 62 + k * 21, my - 34);
      ctx.lineTo(mx - 41 + k * 21, my - 34);
      ctx.lineTo(mx - 41 + k * 21, my - 18);
      ctx.quadraticCurveTo(mx - 51.5 + k * 21, my - 10, mx - 62 + k * 21, my - 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#3F8F84';
    ctx.fillRect(mx - 62, my - 40, 126, 7);
    // marchandises : un panier d'essences et une petite cage
    ctx.fillStyle = '#B48CFF';
    for (const [ox, oy] of [[-34, 2], [-26, -1], [-18, 3]]) {
      ctx.beginPath();
      ctx.arc(mx + ox, my + oy, 4, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#3A2819';
    ctx.lineWidth = 2;
    ctx.strokeRect(mx + 8, my - 12, 30, 22);
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(mx + 8 + k * 7.5, my - 12);
      ctx.lineTo(mx + 8 + k * 7.5, my + 10);
      ctx.stroke();
    }
    ctx.fillStyle = '#7FCB5B';
    ctx.beginPath();
    ctx.ellipse(mx + 23, my + 4, 8, 6, 0, 0, TAU);
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5CC8B8';
    ctx.fillText('Marché', mx, my - 50);
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
    const label = established ? campName(i) : `Emplacement de camp · ${CAMP_COST} or`;
    ctx.strokeText(label, 0, -170);
    ctx.fillStyle = established ? '#F0B64A' : '#C9CFC2';
    ctx.fillText(label, 0, -170);
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
