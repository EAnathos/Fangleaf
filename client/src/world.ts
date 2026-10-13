// Terrain procédural par morceaux (chunks) mis en cache, village et camp de départ pré-rendus.
// Tout découle de la WorldMap partagée : zones, lacs, chemin du camp au village.

import { BUILDINGS, CAMP_COST, CAVE_RX, CAVE_RY, DEN_OFFSET, FORGE_OFFSET, MARKET_OFFSET, SPECIES, VILLAGE_R, campName, type BuildingId } from '../../shared/config.ts';
import { fbm, hash2 } from '../../shared/math.ts';
import { MAP_CELL, type Cave, type WorldMap } from '../../shared/worldmap.ts';

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
    if (this.chunks.size > 80) {
      const first = this.chunks.keys().next().value!;
      this.chunks.delete(first);
    }
  }

  private chunk(cx: number, cy: number) {
    const k = `${cx},${cy}`;
    let c = this.chunks.get(k);
    if (c) return c;
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
    // Arbres et rochers du monde : ceux de la carte partagée (ce sont aussi des obstacles côté serveur).
    const big: [number, number, number, number][] = map
      .decorIn(gx0 * DECO_CELL, gy0 * DECO_CELL, (gx1 + 1) * DECO_CELL, (gy1 + 1) * DECO_CELL)
      .map((d) => [d.kind, d.x, d.y, d.zone]);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        this.smallDeco(ctx, gx, gy);
        // hors du couloir : forêt infranchissable, dessinée seulement (la grille la bloque déjà)
        const x = (gx + 0.2 + hash2(gx, gy, this.seed + 4) * 0.6) * DECO_CELL;
        const y = (gy + 0.2 + hash2(gx, gy, this.seed + 5) * 0.6) * DECO_CELL;
        if (map.isForest(x, y) && hash2(gx, gy, this.seed + 3) < 0.9) big.push([0, x, y, map.zoneAt(x, y)]);
        // deuxième rangée décalée : un mur de feuillage sans trou
        const x2 = (gx + 0.7 + (hash2(gx, gy, this.seed + 6) - 0.5) * 0.3) * DECO_CELL, y2 = (gy + 0.7 + (hash2(gx, gy, this.seed + 7) - 0.5) * 0.3) * DECO_CELL;
        if (map.isForest(x2, y2) && map.isForest(x2, y2 + 30)) big.push([0, x2, y2, map.zoneAt(x2, y2)]);
      }
    }
    big.sort((a, b) => a[2] - b[2]);
    for (const [kind, x, y, z] of big) {
      if (kind === 0) this.tree(ctx, x, y, z);
      else this.rock(ctx, x, y, z);
    }
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

  private tree(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
    const s = 26 + hash2(x | 0, y | 0, this.seed) * 16;
    // zone 5 (Lacs brumeux) : saules bleutés
    const dark = z === 5 ? '#23403F' : z === 4 ? '#1E3634' : z === 3 ? '#2E3A22' : '#1C3324';
    const mid = z === 5 ? '#36605A' : z === 4 ? '#2B4A45' : z === 3 ? '#425230' : '#28472F';
    const light = z === 5 ? '#5A8A80' : z === 4 ? '#3C625A' : z === 3 ? '#5A6B3C' : '#386240';
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 8, y + s * 0.55, s * 1.05, s * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A3424';
    ctx.fillRect(x - 4, y, 8, s * 0.5);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.2, s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.arc(x - s * 0.15, y - s * 0.35, s * 0.72, 0, TAU);
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(x - s * 0.3, y - s * 0.5, s * 0.35, 0, TAU);
    ctx.fill();
  }

  private rock(ctx: CanvasRenderingContext2D, x: number, y: number, z: number) {
    const s = 12 + hash2(x | 0, y | 0, this.seed + 1) * 14;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + s * 0.5, s * 1.1, s * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5E6763';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7C8681';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.25, y - s * 0.25, s * 0.5, s * 0.35, 0, 0, TAU);
    ctx.fill();
    if (z === 4) {
      ctx.fillStyle = '#5E8F55';
      ctx.beginPath();
      ctx.ellipse(x + s * 0.2, y - s * 0.5, s * 0.5, s * 0.2, 0, 0, TAU);
      ctx.fill();
    }
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

    // Huttes.
    const hut = (x: number, y: number, roof: string) => {
      ctx.fillStyle = 'rgba(8,14,12,0.35)';
      ctx.fillRect(x - 50, y + 8, 110, 46);
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(x - 52, y - 10, 104, 56);
      ctx.fillStyle = '#3A2819';
      ctx.fillRect(x - 10, y + 18, 20, 28);
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
    };
    hut(185, 150, '#8A4B32');

    return c;
  }

  /** Bâtiment construit, ou son chantier (piquets, corde et prix) : dessiné en coordonnées du village (ctx centré dessus). */
  drawBuilding(ctx: CanvasRenderingContext2D, b: Exclude<BuildingId, 'stone'>, built: boolean) {
    if (!built) return this.drawPlot(ctx, b);
    if (b === 'forge') this.drawForge(ctx);
    else if (b === 'den') this.drawDen(ctx);
    else this.drawMarket(ctx);
  }

  private drawPlot(ctx: CanvasRenderingContext2D, b: Exclude<BuildingId, 'stone'>) {
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
    const label = `${BUILDINGS[b].name} · ${BUILDINGS[b].cost} or`;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, (x0 + x1) / 2, y0 - 22);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, (x0 + x1) / 2, y0 - 22);
  }

  /** Tanière : butte de pierre, entrée sombre, bannière violette. */
  private drawDen(ctx: CanvasRenderingContext2D) {
    const dx = DEN_OFFSET.x, dy = DEN_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(dx + 8, dy + 34, 82, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5E6763';
    ctx.beginPath();
    ctx.ellipse(dx, dy, 78, 52, 0, Math.PI, 0);
    ctx.lineTo(dx + 78, dy + 30);
    ctx.lineTo(dx - 78, dy + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7C8681';
    ctx.beginPath();
    ctx.ellipse(dx - 22, dy - 30, 30, 12, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5E8F55';
    ctx.beginPath();
    ctx.ellipse(dx + 26, dy - 42, 26, 9, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.ellipse(dx, dy + 14, 26, 24, 0, Math.PI, 0);
    ctx.lineTo(dx + 26, dy + 30);
    ctx.lineTo(dx - 26, dy + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(dx + 62, dy - 64, 6, 90);
    ctx.fillStyle = '#B48CFF';
    ctx.beginPath();
    ctx.moveTo(dx + 68, dy - 62);
    ctx.lineTo(dx + 104, dy - 50);
    ctx.lineTo(dx + 68, dy - 36);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B48CFF';
    ctx.fillText('Tanière', dx, dy - 64);
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

  /** Entrée d'une grotte sur la carte : butte rocheuse, ouverture sombre, deux torches. */
  drawCaveEntrance(ctx: CanvasRenderingContext2D, c: Cave, t: number, bossHere: boolean) {
    const { x, y } = c.entrance;
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 40, 110, 26, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A4F4C';
    ctx.beginPath();
    ctx.moveTo(x - 105, y + 38);
    ctx.quadraticCurveTo(x - 110, y - 50, x - 30, y - 78);
    ctx.quadraticCurveTo(x + 40, y - 96, x + 95, y - 40);
    ctx.quadraticCurveTo(x + 118, y + 6, x + 105, y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#616864';
    ctx.beginPath();
    ctx.ellipse(x - 40, y - 52, 38, 16, -0.3, 0, TAU);
    ctx.ellipse(x + 48, y - 46, 26, 12, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4E7A49';
    ctx.beginPath();
    ctx.ellipse(x + 8, y - 78, 34, 10, 0.1, 0, TAU);
    ctx.fill();
    // ouverture
    ctx.fillStyle = '#07090A';
    ctx.beginPath();
    ctx.moveTo(x - 40, y + 38);
    ctx.quadraticCurveTo(x - 44, y - 30, x, y - 36);
    ctx.quadraticCurveTo(x + 44, y - 30, x + 40, y + 38);
    ctx.closePath();
    ctx.fill();
    if (bossHere) {
      // deux yeux qui luisent au fond quand le mini-boss est là
      const blink = Math.sin(t * 1.3 + c.id) > 0.92 ? 0.2 : 1;
      ctx.fillStyle = `rgba(232,105,63,${0.8 * blink})`;
      ctx.beginPath();
      ctx.arc(x - 9, y - 4, 3, 0, TAU);
      ctx.arc(x + 9, y - 4, 3, 0, TAU);
      ctx.fill();
    }
    for (const side of [-1, 1]) {
      const tx = x + side * 60, ty = y + 10;
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(tx - 3, ty - 26, 6, 30);
      const f = 1 + Math.sin(t * 11 + side * 2 + c.id) * 0.12;
      ctx.fillStyle = '#E8693F';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 32 * f, 6, 10 * f, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.ellipse(tx, ty - 30 * f, 3, 5 * f, 0, 0, TAU);
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = `Grotte · ${SPECIES[c.boss].name}`;
    ctx.strokeText(label, x, y - 104);
    ctx.fillStyle = bossHere ? '#FF9B78' : '#C9CFC2';
    ctx.fillText(label, x, y - 104);
  }

  /** Intérieur d'une grotte (pré-rendu) : sol de roche, parois, cristaux, sortie lumineuse. */
  caveInterior(c: Cave) {
    let cv = this.caveCanvas.get(c.id);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = this.caveW;
    cv.height = this.caveH;
    const ctx = cv.getContext('2d')!;
    ctx.translate(this.caveW / 2, this.caveH / 2);
    ctx.fillStyle = '#0C1012';
    ctx.fillRect(-this.caveW / 2, -this.caveH / 2, this.caveW, this.caveH);
    // parois
    ctx.fillStyle = '#2A2E2D';
    ctx.beginPath();
    ctx.ellipse(0, 0, CAVE_RX + 70, CAVE_RY + 70, 0, 0, TAU);
    ctx.fill();
    // sol
    const g = ctx.createRadialGradient(0, -40, 40, 0, 0, CAVE_RX);
    const tint = ['#4A4636', '#3C4046', '#4A3B30', '#33443C', '#2F4447'][c.zone - 1];
    g.addColorStop(0, tint);
    g.addColorStop(1, '#1E2220');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, CAVE_RX, CAVE_RY, 0, 0, TAU);
    ctx.fill();
    // éboulis et rochers le long des parois
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + hash2(i, c.id, this.seed) * 0.2, k = 0.9 + hash2(c.id, i, this.seed) * 0.12;
      const rx = Math.cos(a) * CAVE_RX * k, ry = Math.sin(a) * CAVE_RY * k, rr = 16 + hash2(i, i, this.seed + c.id) * 22;
      ctx.fillStyle = i % 3 ? '#3A3F3C' : '#4A504C';
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr, rr * 0.7, a, 0, TAU);
      ctx.fill();
    }
    // cristaux lumineux
    for (let i = 0; i < 9; i++) {
      const a = hash2(i, c.id + 7, this.seed) * TAU, d = 0.55 + hash2(c.id, i + 3, this.seed) * 0.3;
      const cx = Math.cos(a) * CAVE_RX * d, cy = Math.sin(a) * CAVE_RY * d;
      if (cy > CAVE_RY - 200 && Math.abs(cx) < 140) continue; // pas devant la sortie
      ctx.fillStyle = 'rgba(111,183,255,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7FC6FF';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 6);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.fill();
    }
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
