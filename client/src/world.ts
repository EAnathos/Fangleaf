// Terrain procédural par morceaux (chunks) mis en cache, village et plage d'arrivée pré-rendus.
// Tout découle de la WorldMap partagée : zones, lacs, chemin du camp au village.
// Le terrain (couleurs du sol), le décor et les bâtiments sont dans client/src/world/ ; ce module assemble les tuiles
// de l'île et dessine les grottes.

import { CAVE_RX, CAVE_RY, JUNGLE_ZONE, SPECIES } from '../../shared/config.ts';
import { fbm, hash2 } from '../../shared/math.ts';
import { caveEdge, MAP_CELL, MOUTH_FADE, type Cave, type WorldMap } from '../../shared/worldmap.ts';
import { settings } from './settings.ts';
import { SUMMER, WINTER } from '../../shared/weather.ts';
import { drawCocoon, drawEntrance, drawWeb, INSIDE, insideProp } from './caves.ts';
import { DECO_CELL, TAU, rgba } from './world/outils.ts';
import { LAKE_BANK, LAKE_DEEP, LAKE_WATER, SEA_SHALLOW_COL, jungleMix, lakeColor, lakesMix, landColor, lerp3, mouthMix, seaColor, surfAt, villageMix } from './world/terrain.ts';
import { Decor } from './world/decor.ts';
import { Buildings } from './world/buildings.ts';
export { SEA_DEEP, ZONE_GROUND, desertMix, groundColor, jungleMix, lakeColor, lakesMix, landColor, mouthMix, seaColor, surfAt, villageMix } from './world/terrain.ts';
export { SHIP_DARK, SHIP_DECK, SHIP_HOLE, SHIP_LIGHT, SHIP_WOOD, drawBridge, drawShipwreck, shipBarrel, shipPlank } from './world/buildings.ts';

const CHUNK = 512;
const TILE = MAP_CELL;
const rgb = (c: number[], k: number) => `rgb(${(c[0] * k) | 0},${(c[1] * k) | 0},${(c[2] * k) | 0})`;

export class World {
  private chunks = new Map<string, HTMLCanvasElement>();
  readonly seed: number;

  readonly decor: Decor;
  readonly buildings: Buildings;

  constructor(readonly map: WorldMap) {
    this.seed = map.seed;
    this.decor = new Decor(this);
    this.buildings = new Buildings(map);
  }

  /** Zone d'un point pour l'affichage (0 si dans le village) : près d'une frontière, l'une ou l'autre par plaques. */
  zone(x: number, y: number) {
    const v = villageMix(this.map, x, y);
    return v && hash2(x | 0, y | 0, this.seed + 75) < v ? 0 : this.map.styleZone(x, y);
  }


  /** Saison affichée (0 printemps … 3 hiver) : le sol et les arbres en changent. */
  season = SUMMER;
  /**
   * Mare gelée : un rebord enneigé, la glace d'un bleu pâle (plus sombre là où c'était profond), des fissures blanches
   * et quelques reflets qui brillent.
   */
  private drawIce(ctx: CanvasRenderingContext2D, ice: [number, number, boolean, number][]) {
    if (!ice.length) return;
    for (const [col, rad, onlyDeep] of [['#DCE6EA', 17, false], ['#B8D4E0', 13.5, false], ['#9DC0D2', 13, true]] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const [px, py, deep] of ice) {
        if (onlyDeep && !deep) continue;
        const jx = (hash2(px, py, this.seed + 31) - 0.5) * 6, jy = (hash2(py, px, this.seed + 32) - 0.5) * 6, r = rad + (hash2(px, py, this.seed + 33) - 0.5) * 5;
        ctx.moveTo(px + jx + r, py + jy);
        ctx.arc(px + jx, py + jy, r, 0, TAU);
      }
      ctx.fill();
    }
    // fissures et reflets, ici et là
    ctx.lineCap = 'round';
    for (const [px, py, deep] of ice) {
      const h = hash2(px, py, this.seed + 71);
      if (deep && h < 0.18) {
        ctx.strokeStyle = 'rgba(245,250,255,0.75)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const a = h * 40;
        ctx.moveTo(px - Math.cos(a) * 14, py - Math.sin(a) * 9);
        ctx.lineTo(px + Math.cos(a + 0.6) * 4, py + Math.sin(a + 0.6) * 3);
        ctx.lineTo(px + Math.cos(a) * 15, py + Math.sin(a) * 10);
        ctx.stroke();
      } else if (h > 0.93) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.ellipse(px, py, 6, 1.6, -0.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  /**
   * Repeint tout ce qui est gardé en images (le navigateur d'un téléphone les vide quand le jeu passe en arrière-plan :
   * sans ça, on revient sur un monde noir) : le sol, les arbres, le village, la plage, les grottes.
   */
  flushCaches() {
    this.chunks.clear();
    this.decor.treeSprites.clear();
    this.caveCanvas.clear();
    this.ground = undefined;
    this.buildings.village = this.buildings.drawVillage();
    this.buildings.camp = this.buildings.drawCamp();
  }

  snow = 0; // neige au sol, par dixièmes (le sol n'est repeint qu'à chaque dixième de plus ou de moins)

  setSeason(season: number, snow: number) {
    const level = Math.round(snow * 10) / 10;
    if (season === this.season && level === this.snow) return;
    this.season = season;
    this.snow = level;
    this.chunks.clear(); // le sol est à repeindre ; les arbres ont une image par saison
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
        let col = sea ? seaColor(map, px, py) : landColor(map, px, py, this.season, this.snow);
        // Près d'une embouchure (et dans les Lacs brumeux), l'eau du lac est peinte avec le sol (les disques s'y effacent, voir plus bas) ; son bord
        // est adouci comme celui de la côte : part d'eau parmi les cases voisines (pondérées), pas de marches.
        let wet = 0, mouth = false;
        const water = [0, 0, 0];
        if (!sea) {
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const qx = px + di * TILE, qy = py + dj * TILE, inSea = map.isSea(qx, qy);
              if (!inSea && (!map.isWater(qx, qy) || (map.mouthAt(qx, qy) >= MOUTH_FADE && lakesMix(map, qx, qy) <= 0))) continue;
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
          if (s) col = lerp3(col, lerp3(sea ? landColor(map, px, py, this.season, this.snow) : col, sea ? col : seaColor(map, px, py), f), s);
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
    // Près d'une embouchure, et dans les Lacs brumeux, ils passent par paliers au bleu de la mer et s'effacent : l'eau
    // peinte avec le sol prend le relais (pas de frontière marquée entre les lacs et la mer).
    const STEPS = 12;
    const water: [number, number, boolean, number][] = []; // x, y, profonde, palier vers la mer (0 : lac)
    for (let ty = oy - TILE; ty < oy + CHUNK + TILE; ty += TILE) {
      for (let tx = ox - TILE; tx < ox + CHUNK + TILE; tx += TILE) {
        const px = tx + TILE / 2, py = ty + TILE / 2;
        if (!map.isWater(px, py) || map.isSea(px, py)) continue;
        const deep = map.isWater(px + 2 * TILE, py) && map.isWater(px - 2 * TILE, py) && map.isWater(px, py + 2 * TILE) && map.isWater(px, py - 2 * TILE);
        water.push([px, py, deep, Math.round(Math.max(mouthMix(map, px, py), lakesMix(map, px, py)) * STEPS)]);
      }
    }
    // l'hiver, les mares des premières zones gèlent : on les peint en glace, à part
    const winter = this.season === WINTER, ice = winter ? water.filter(([px, py]) => map.freezes(px, py)) : [];
    if (ice.length) {
      const frozen = new Set(ice);
      for (let i = water.length - 1; i >= 0; i--) if (frozen.has(water[i])) water.splice(i, 1);
      if (!water.length) this.drawIce(ctx, ice);
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
      this.drawIce(ctx, ice);
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

    // (l'épave du bout de l'île, puis le bateau qu'Aubin y rebâtit : dessinés à chaque image, voir boat.ts)

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
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) this.decor.smallDeco(ctx, gx, gy);
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
    const label = SPECIES[c.boss].name; // le nom du géant qui l'habite
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

}

/**
 * Sables mouvants (Mer de sable) : une mare de sable mouillé, plus sombre, aux remous en spirale. open (0 → 1) : il
 * s'ouvre depuis son centre, puis se referme (le sable sec reprend le dessus) ; t : secondes, les remous tournent.
 */
export function drawQuicksand(ctx: CanvasRenderingContext2D, q: { x: number; y: number; r: number }, open: number, t: number) {
  if (open <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, open * 1.5);
  q = { x: q.x, y: q.y, r: q.r * (0.25 + 0.75 * open) };
  const ry = q.r * 0.6, wob = (a: number, k: number) => 1 + Math.sin(a * 5 + q.x * 0.01) * 0.05 * k + Math.sin(a * 3 + q.y * 0.01) * 0.04 * k;
  const blobAt = (k: number, grow: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU, w = wob(a, 1);
      const px = q.x + Math.cos(a) * (q.r * k + grow) * w, py = q.y + Math.sin(a) * (ry * k + grow * 0.6) * w;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(214,186,128,0.8)'; // bourrelet de sable sec autour
  blobAt(1, 8);
  ctx.fill();
  ctx.fillStyle = '#A88A58';
  blobAt(1, 0);
  ctx.fill();
  ctx.fillStyle = '#937648';
  blobAt(0.72, 0);
  ctx.fill();
  ctx.fillStyle = '#7E6439';
  blobAt(0.38, 0);
  ctx.fill();
  // remous : une spirale vers le centre
  ctx.strokeStyle = 'rgba(70,54,30,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const u = i / 80, a = u * TAU * 2.6 + q.x + t * 1.4, k = 0.92 - u * 0.85; // il tourne et aspire
    const px = q.x + Math.cos(a) * q.r * k, py = q.y + Math.sin(a) * ry * k;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,206,150,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const u = i / 80, a = u * TAU * 2.6 + q.x + 0.5 + t * 1.4, k = 0.9 - u * 0.85;
    const px = q.x + Math.cos(a) * q.r * k, py = q.y - 1.5 + Math.sin(a) * ry * k;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  // quelques bulles crevées
  for (let i = 0; i < 4; i++) {
    const a = hash2(i, q.x | 0, 31) * TAU, k = 0.2 + hash2(i, q.y | 0, 32) * 0.6;
    ctx.strokeStyle = 'rgba(60,46,26,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(q.x + Math.cos(a) * q.r * k, q.y + Math.sin(a) * ry * k, 3, 1.6, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
