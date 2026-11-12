// Décor de l'île : arbres de chaque zone (feuillus, sapins, palmiers, cactus, jungle, bambous) et petits décors
// semés sur le sol. Les arbres sont peints une fois par variante et par saison, puis réutilisés.

import { JUNGLE_ZONE, DESERT_ZONE } from '../../../shared/config.ts';
import { hash2 } from '../../../shared/math.ts';
import { BEACH, coastGreen, type WorldMap } from '../../../shared/worldmap.ts';
import { maxDpr } from '../settings.ts';
import { AUTUMN, SPRING, SUMMER, WINTER } from '../../../shared/weather.ts';
import { liana } from '../caves.ts';
import { DECO_CELL, TAU } from './outils.ts';
import { jungleMix } from './terrain.ts';
import type { World } from '../world.ts';

// Arbres : formes pré-dessinées à la taille de référence (le plus grand arbre), puis réduites à la taille de chacun.
const TREE_REF = 42;
const TREE_VARIANTS = 6;
const TREE_BOX = { l: TREE_REF * 1.3 + 6, t: TREE_REF * 1.95 + 6, w: (TREE_REF * 1.3 + 6) * 2, h: TREE_REF * 2.55 + 12 }; // autour du pied

/** Arbres et petits décors de l'île (World s'en sert pour ses tuiles ; le jeu, pour les arbres au premier plan). */
export class Decor {
  readonly map: WorldMap;
  readonly seed: number;

  constructor(private readonly world: World) {
    this.map = world.map;
    this.seed = world.seed;
  }

  smallDeco(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
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
      const z = this.world.zone(x, y);
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
    const sn = this.world.season, leaves = this.treeLayer(`${z}|${pine ? 1 : 0}|${fruit ? 1 : 0}|${v}|${sn}`, () => (g) => this.drawLeaves(g, z, pine, fruit, v, sn));
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * fade;
    ctx.drawImage(leaves, x - TREE_BOX.l * k, y - TREE_BOX.t * k, TREE_BOX.w * k, TREE_BOX.h * k);
    ctx.globalAlpha = a;
  }

  treeSprites = new Map<string, HTMLCanvasElement>();
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
  private drawLeaves(ctx: CanvasRenderingContext2D, z: number, pine: boolean, fruit: boolean, v: number, season = SUMMER) {
    const s = TREE_REF, x = 0, y = 0;
    let dark = z === 5 ? '#23403F' : z === 4 ? '#1E3634' : z === 3 ? '#2E3A22' : '#1C3324';
    let mid = z === 5 ? '#36605A' : z === 4 ? '#2B4A45' : z === 3 ? '#425230' : '#28472F';
    let light = z === 5 ? '#5A8A80' : z === 4 ? '#3C625A' : z === 3 ? '#5A6B3C' : '#386240';
    const ink = 'rgba(10,18,14,0.55)';
    if (!pine && season === AUTUMN) {
      // feuillus roux, orangés ou jaunes selon l'arbre
      [dark, mid, light] = [['#6A2E18', '#9A4A22', '#C8743A'], ['#7A4A14', '#B07020', '#E0A040'], ['#5E3A1A', '#8A5A28', '#B88A3E']][v % 3];
    } else if (!pine && season === WINTER) [dark, mid, light] = ['#3A3430', '#56504A', '#6E6862']; // presque nus : branchages gris
    else if (!pine && season === SPRING) [mid, light] = [z === 5 ? '#3E7062' : '#30583A', z === 5 ? '#6AA090' : '#4E8452'];
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
        if (season === WINTER) {
          // neige sur l'étage : une coulée claire le long du flanc éclairé, un bourrelet sur le bord
          ctx.fillStyle = '#EEF3F8';
          ctx.beginPath();
          ctx.moveTo(x, top);
          ctx.lineTo(x - w * 0.82, base - s * 0.08);
          ctx.lineTo(x - w * 0.3, base - s * 0.16);
          ctx.lineTo(x + w * 0.1, base - s * 0.12);
          ctx.lineTo(x + w * 0.35, top + (base - top) * 0.55);
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
    if (season === WINTER) {
      // neige posée sur les touffes du haut
      ctx.fillStyle = '#EEF3F8';
      for (const [lx, ly, lr] of lumps) {
        if (ly > cy + s * 0.05) continue;
        ctx.beginPath();
        ctx.ellipse(lx - lr * 0.1, ly - lr * 0.55, lr * 0.62, lr * 0.3, 0, 0, TAU);
        ctx.fill();
      }
    } else if (season === SPRING && z !== 5) {
      // fleurs blanches et roses
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = k % 2 ? '#F4D2E4' : '#FBF4EE';
        ctx.beginPath();
        ctx.arc(x + (hash2(k, 5, v) - 0.5) * s * 1.3, cy + (hash2(k, 9, v) - 0.5) * s * 0.95, 2.2, 0, TAU);
        ctx.fill();
      }
    } else if (season === AUTUMN) {
      // feuilles tombées au pied
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? mid : light;
        ctx.beginPath();
        ctx.ellipse(x + (hash2(k, 11, v) - 0.5) * s * 1.4, y + s * 0.42 + hash2(k, 13, v) * s * 0.12, 2.6, 1.4, hash2(k, 17, v) * 3, 0, TAU);
        ctx.fill();
      }
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
}
