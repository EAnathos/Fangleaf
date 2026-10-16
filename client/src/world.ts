// Terrain procédural par morceaux (chunks) mis en cache, village et camp de départ pré-rendus.
// Tout découle de la WorldMap partagée : zones, lacs, chemin du camp au village.

import { BUILDINGS, buildingCost, costText, CAMP_COST, CAVE_RX, CAVE_RY, DEN_OFFSET, FORGE_OFFSET, BOARD_OFFSET, HALL_OFFSET, MARKET_OFFSET, STORE_OFFSET, SPECIES, VILLAGE_R, campName, type BuildingId } from '../../shared/config.ts';
import { fbm, hash2 } from '../../shared/math.ts';
import { caveEdge, MAP_CELL, type Cave, type WorldMap } from '../../shared/worldmap.ts';
import { settings } from './settings.ts';
import { drawCocoon, drawEntrance, drawWeb, INSIDE, insideProp } from './caves.ts';

const CHUNK = 512;
const TILE = MAP_CELL;
const DECO_CELL = 96;
const TAU = Math.PI * 2;

// Couleur du sol : 0 = village, 1 à 4 = zones de danger ; FOREST : sous-bois hors du couloir.
export const FOREST_GROUND = [26, 42, 33];
export const ZONE_GROUND = [[74, 94, 62], [63, 106, 59], [52, 88, 57], [72, 82, 48], [44, 69, 66], [56, 82, 76]];
const PATH = [110, 97, 66];
// Style commun à tous les chemins de terre : liseré sombre, terre, trace claire au centre. [r, g, b, alpha, largeur]
const PATH_PASSES: [number, number, number, number, number][] = [[60, 50, 32, 0.35, 50], [110, 97, 66, 1, 40], [140, 124, 88, 0.35, 14]];
const rgba = (p: number[], a = p[3]) => `rgba(${p[0]},${p[1]},${p[2]},${a})`;

// Emprise au sol de chaque bâtiment (décalage depuis le centre du village), pour dessiner son chantier.
const PLOTS: Record<Exclude<BuildingId, 'stone'>, { x0: number; y0: number; x1: number; y1: number }> = {
  forge: { x0: FORGE_OFFSET.x - 80, y0: FORGE_OFFSET.y - 40, x1: FORGE_OFFSET.x + 62, y1: FORGE_OFFSET.y + 44 },
  den: { x0: DEN_OFFSET.x - 84, y0: DEN_OFFSET.y - 50, x1: DEN_OFFSET.x + 84, y1: DEN_OFFSET.y + 34 },
  market: { x0: MARKET_OFFSET.x - 58, y0: MARKET_OFFSET.y - 12, x1: MARKET_OFFSET.x + 58, y1: MARKET_OFFSET.y + 46 },
};

const rgb = (c: number[], k: number) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;

export class World {
  private chunks = new Map<string, HTMLCanvasElement>();
  readonly village: HTMLCanvasElement;
  readonly villageSize = (VILLAGE_R + 90) * 2;
  readonly camp: HTMLCanvasElement;
  readonly campSize = 420;
  readonly seed: number;

  constructor(readonly map: WorldMap) {
    this.seed = map.seed;
    this.village = this.drawVillage();
    this.camp = this.drawCamp();
  }

  /** Zone d'un point pour l'affichage (0 si dans le village). */
  zone(x: number, y: number) {
    return this.map.inVillage(x, y, 30) ? 0 : this.map.zoneAt(x, y);
  }

  /** Chemin du camp au village, puis piste du village au bout du couloir (calculés par la carte partagée). */
  private pathLines() {
    return [this.map.path, ...this.map.trails];
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

    // Sol par tuiles : teinte de zone, prairies plus claires, chemin de terre.
    for (let ty = oy; ty < oy + CHUNK; ty += TILE) {
      for (let tx = ox; tx < ox + CHUNK; tx += TILE) {
        const px = tx + TILE / 2, py = ty + TILE / 2;
        const forest = map.isForest(px, py);
        const meadow = fbm(px / 420, py / 420, this.seed + 3, 2);
        const v = 0.93 + meadow * 0.12 + hash2(tx / TILE, ty / TILE, this.seed) * 0.015;
        let col = forest ? FOREST_GROUND : ZONE_GROUND[this.zone(px, py)];
        ctx.fillStyle = rgb(col, v);
        ctx.fillRect(tx, ty, TILE, TILE);
      }
    }

    // Chemin de terre du camp au village : une courbe lisse, bordée d'un liseré plus sombre.
    // Bouts droits : le raccord avec la route du village, dans le même axe, est invisible.
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    for (const pass of PATH_PASSES) {
      ctx.strokeStyle = rgba(pass);
      ctx.lineWidth = pass[4];
      ctx.lineCap = pass[3] === 1 ? 'round' : 'butt'; // la terre opaque déborde sous la route du village : pas de couture
      ctx.beginPath();
      for (const line of this.pathLines()) line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }

    // Lacs : disques par case pour des berges arrondies (berge, puis eau, puis eau profonde).
    const water: [number, number, boolean][] = [];
    for (let ty = oy - TILE; ty < oy + CHUNK + TILE; ty += TILE) {
      for (let tx = ox - TILE; tx < ox + CHUNK + TILE; tx += TILE) {
        const px = tx + TILE / 2, py = ty + TILE / 2;
        if (!map.isWater(px, py)) continue;
        const deep = map.isWater(px + 2 * TILE, py) && map.isWater(px - 2 * TILE, py) && map.isWater(px, py + 2 * TILE) && map.isWater(px, py - 2 * TILE);
        water.push([px, py, deep]);
      }
    }
    if (water.length) {
      for (const [color, rad, onlyDeep] of [['#5E6B49', 17, false], ['#3D7F8C', 13.5, false], ['#2E6574', 14, true]] as const) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (const [px, py, deep] of water) {
          if (onlyDeep && !deep) continue;
          ctx.moveTo(px + rad, py);
          ctx.arc(px, py, rad, 0, TAU);
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

    // Décor : on inclut une marge de cellules pour que les arbres à cheval soient complets.
    const m = 1;
    const gx0 = Math.floor(ox / DECO_CELL) - m, gx1 = Math.floor((ox + CHUNK) / DECO_CELL) + m;
    const gy0 = Math.floor(oy / DECO_CELL) - m, gy1 = Math.floor((oy + CHUNK) / DECO_CELL) + m;
    // Forêt hors du couloir (les arbres de la carte, eux, sont dessinés à chaque image avec les créatures).
    const big: [number, number, number][] = [];
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        this.smallDeco(ctx, gx, gy);
        // hors du couloir : forêt infranchissable, dessinée seulement (la grille la bloque déjà)
        const x = (gx + 0.2 + hash2(gx, gy, this.seed + 4) * 0.6) * DECO_CELL;
        const y = (gy + 0.2 + hash2(gx, gy, this.seed + 5) * 0.6) * DECO_CELL;
        if (map.isForest(x, y) && hash2(gx, gy, this.seed + 3) < 0.9) big.push([x, y, map.zoneAt(x, y)]);
        // deuxième rangée décalée : un mur de feuillage sans trou
        const x2 = (gx + 0.7 + (hash2(gx, gy, this.seed + 6) - 0.5) * 0.3) * DECO_CELL, y2 = (gy + 0.7 + (hash2(gx, gy, this.seed + 7) - 0.5) * 0.3) * DECO_CELL;
        if (map.isForest(x2, y2) && map.isForest(x2, y2 + 30)) big.push([x2, y2, map.zoneAt(x2, y2)]);
      }
    }
    big.sort((a, b) => a[1] - b[1]);
    for (const [x, y, z] of big) this.tree(ctx, x, y, z);
    this.chunks.set(k, c);
    return c;
  }

  private smallDeco(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
    for (let i = 0; i < 4; i++) {
      const h = hash2(gx * 7 + i, gy * 13 - i, this.seed + 11);
      const x = (gx + hash2(gx, gy * 3 + i, this.seed + 12)) * DECO_CELL;
      const y = (gy + hash2(gx * 5 + i, gy, this.seed + 13)) * DECO_CELL;
      if (this.map.isForest(x, y) || this.map.isWater(x, y)) continue;
      const z = this.zone(x, y);
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
   */
  tree(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, fade = 1, shade = true) {
    const s = this.treeSize(x, y), h = hash2(x | 0, y | 0, this.seed + 9);
    const dark = z === 5 ? '#23403F' : z === 4 ? '#1E3634' : z === 3 ? '#2E3A22' : '#1C3324';
    const mid = z === 5 ? '#36605A' : z === 4 ? '#2B4A45' : z === 3 ? '#425230' : '#28472F';
    const light = z === 5 ? '#5A8A80' : z === 4 ? '#3C625A' : z === 3 ? '#5A6B3C' : '#386240';
    const ink = 'rgba(10,18,14,0.55)';
    if (shade) this.treeShadow(ctx, x, y);
    // tronc évasé et ses racines
    ctx.fillStyle = '#4A3424';
    ctx.beginPath();
    ctx.moveTo(x - 5, y - s * 0.5);
    ctx.lineTo(x - 6, y + s * 0.38);
    ctx.quadraticCurveTo(x - 12, y + s * 0.5, x - 15, y + s * 0.52);
    ctx.lineTo(x + 15, y + s * 0.52);
    ctx.quadraticCurveTo(x + 11, y + s * 0.48, x + 6, y + s * 0.38);
    ctx.lineTo(x + 5, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,200,0.12)';
    ctx.fillRect(x - 3, y, 2, s * 0.4);
    ctx.save();
    ctx.globalAlpha *= fade;
    const pine = (z === 2 && h < 0.55) || (z === 3 && h < 0.35);
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
      ctx.restore();
      return;
    }
    // feuillu : touffes en couronne, ombrées en bas, éclaircies en haut à gauche
    const cy = y - s * 0.62, n = 7; // assez haut pour laisser voir le tronc
    const lumps: [number, number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + h * 3, d = s * (0.42 + hash2(k, x | 0, this.seed) * 0.12);
      lumps.push([x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, s * (0.38 + hash2(y | 0, k, this.seed) * 0.14)]);
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
    } else if (z <= 2 && h > 0.8) {
      // quelques fruits ou fleurs sur certains arbres de la Lisière
      ctx.fillStyle = z === 1 ? '#E8A43C' : '#D886C9';
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(x + (hash2(k, 3, x | 0) - 0.5) * s * 1.2, cy + (hash2(k, 7, y | 0) - 0.5) * s * 0.9, 2.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawVillage() {
    const size = this.villageSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);

    // Herbe du village.
    ctx.fillStyle = '#4F653F';
    ctx.beginPath();
    ctx.arc(0, 0, VILLAGE_R, 0, TAU);
    ctx.fill();

    // Routes : même style que le chemin du camp. Celle de la porte du camp rejoint ce chemin ;
    // les trois autres s'estompent doucement dans l'herbe au lieu de s'arrêter net.
    const v = this.map.village;
    const sideOf = (g: { x: number; y: number }) => (Math.round(Math.atan2(g.y - v.y, g.x - v.x) / (Math.PI / 2)) + 4) % 4;
    const linked = [sideOf(this.map.gate), sideOf(this.map.trailGate)]; // portes où arrivent le chemin et la piste
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

    // Palissade avec 4 portes.
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * TAU;
      const nearGate = [0, 1, 2, 3, 4].some((g) => Math.abs(a - (g * Math.PI) / 2) < 0.09);
      if (nearGate) continue;
      const x = Math.cos(a) * VILLAGE_R, y = Math.sin(a) * VILLAGE_R;
      ctx.fillStyle = 'rgba(8,14,12,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 7, 9, 4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = i % 2 ? '#6B4A33' : '#7A5A3A';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#9C7A52';
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, 4, 0, TAU);
      ctx.fill();
    }

    return c;
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
  drawBuilding(ctx: CanvasRenderingContext2D, b: Exclude<BuildingId, 'stone'>, built: boolean, hall: number) {
    if (!built) return this.drawPlot(ctx, b, hall);
    if (b === 'forge') this.drawForge(ctx);
    else if (b === 'den') this.drawDen(ctx);
    else this.drawMarket(ctx);
  }

  private drawPlot(ctx: CanvasRenderingContext2D, b: Exclude<BuildingId, 'stone'>, hall: number) {
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

  /** Camp de départ : clairière, tentes, cercle de pierres et panneau qui indique le village. */
  private drawCamp() {
    const size = this.campSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);
    const g = ctx.createRadialGradient(0, 0, 40, 0, 0, 190);
    g.addColorStop(0, 'rgba(110,97,66,0.75)');
    g.addColorStop(1, 'rgba(110,97,66,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 190, 0, TAU);
    ctx.fill();
    // cercle de pierres et cendres
    ctx.fillStyle = '#3B3A35';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ctx.fillStyle = i % 2 ? '#7C8681' : '#5E6763';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 24, Math.sin(a) * 18, 7, 5, 0, 0, TAU);
      ctx.fill();
    }
    // tentes
    const tent = (x: number, y: number, col: string) => {
      ctx.fillStyle = 'rgba(8,14,12,0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 30, 44, 12, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(x - 42, y + 28);
      ctx.lineTo(x, y - 30);
      ctx.lineTo(x + 42, y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2A1F17';
      ctx.beginPath();
      ctx.moveTo(x - 12, y + 28);
      ctx.lineTo(x, y + 2);
      ctx.lineTo(x + 12, y + 28);
      ctx.closePath();
      ctx.fill();
    };
    this.map.tents.forEach((t, i) => tent(t.x, t.y, i ? '#7F6A48' : '#A8743F'));
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
    ctx.fillText('Camp de départ', 0, ty);
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
