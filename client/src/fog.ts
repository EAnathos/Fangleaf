// Brouillard de guerre : la carte se dévoile autour des dompteurs du village au fil de l'exploration.
// Logique : grille de cases de 48 px (exploré ou non). Affichage : un canvas au 1/24 où chaque
// découverte « gomme » un disque à bord fondu, pour des contours ronds et doux.

import { WORLD_HALF } from '../../shared/config.ts';

export const FOG_CELL = 48; // doit diviser la taille du monde (34560 / 48 = 720) : sinon les rangées se décalent
export const REVEAL_R = 650;
const N = (WORLD_HALF * 2) / FOG_CELL;
if (!Number.isInteger(N)) throw new Error(`FOG_CELL (${FOG_CELL}) doit diviser la taille du monde`);
const PX = 24; // 1 pixel du canvas d'affichage = 24 px du monde (1440² pixels : 8 Mo, au lieu de 19 Mo à 16 px)
const M = (WORLD_HALF * 2) / PX;

export class Fog {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private explored = new Uint8Array(N * N);
  private dirty = false;
  private saveTimer = 0;
  private last = new Map<number, [number, number]>(); // dernière position gommée, par dompteur

  private counted = new Uint8Array(N * N); // cases qui comptent dans la progression (le couloir, pas la forêt)
  private total = 0;

  /**
   * key : identifiant de la carte (graine), pour retrouver l'exploration après un rechargement.
   * walkable : les cases où l'on peut aller, seules comptées dans le pourcentage exploré.
   */
  constructor(private key: string, walkable: (x: number, y: number) => boolean = () => true) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (!walkable(-WORLD_HALF + (i + 0.5) * FOG_CELL, -WORLD_HALF + (j + 0.5) * FOG_CELL)) continue;
        this.counted[j * N + i] = 1;
        this.total++;
      }
    }
    this.canvas.width = this.canvas.height = M;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = '#0B1210';
    this.ctx.fillRect(0, 0, M, M);
    try {
      // une seule carte à la fois : on oublie l'exploration des anciens villages
      for (const k of Object.keys(localStorage)) if (k.startsWith('fangleaf.fog.') && k !== key) localStorage.removeItem(k);
      const saved = localStorage.getItem(key);
      if (saved) {
        const bytes = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
        // On dégage chaque case explorée en entier (des disques fondus laissaient des rayures entre les rangées),
        // puis on adoucit seulement les bords de la zone découverte avec un léger flou.
        const k = FOG_CELL / PX;
        for (let i = 0; i < N * N; i++) {
          if (!(bytes[i >> 3] & (1 << (i & 7)))) continue;
          this.explored[i] = 1;
          this.ctx.clearRect((i % N) * k - 0.5, Math.floor(i / N) * k - 0.5, k + 1, k + 1);
        }
        const copy = document.createElement('canvas');
        copy.width = copy.height = M;
        copy.getContext('2d')!.drawImage(this.canvas, 0, 0);
        this.ctx.clearRect(0, 0, M, M);
        this.ctx.filter = 'blur(2px)';
        this.ctx.drawImage(copy, 0, 0);
        this.ctx.filter = 'none';
      }
    } catch { /* stockage indisponible : on repart d'une carte vierge */ }
  }

  /** Gomme un disque à bord fondu dans le canvas d'affichage. */
  private erase(x: number, y: number, r: number) {
    const cx = (x + WORLD_HALF) / PX, cy = (y + WORLD_HALF) / PX, cr = r / PX;
    const g = this.ctx.createRadialGradient(cx, cy, cr * 0.55, cx, cy, cr);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.globalCompositeOperation = 'source-over';
  }

  /** Dévoile un disque autour de (x, y). */
  reveal(x: number, y: number, who = 0, r = REVEAL_R) {
    // Affichage : un disque tous les 40 px parcourus par ce dompteur (sans repasser sur place, le bord reste doux).
    const [lx, ly] = this.last.get(who) ?? [Infinity, Infinity];
    if ((x - lx) ** 2 + (y - ly) ** 2 > 40 * 40) {
      this.erase(x, y, r);
      this.last.set(who, [x, y]);
    }
    const ci = (x + WORLD_HALF) / FOG_CELL, cj = (y + WORLD_HALF) / FOG_CELL, cr = r / FOG_CELL;
    for (let j = Math.max(0, Math.floor(cj - cr)); j <= Math.min(N - 1, Math.ceil(cj + cr)); j++) {
      for (let i = Math.max(0, Math.floor(ci - cr)); i <= Math.min(N - 1, Math.ceil(ci + cr)); i++) {
        if (this.explored[j * N + i]) continue;
        if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > cr * cr) continue;
        this.explored[j * N + i] = 1;
        this.dirty = true;
      }
    }
  }

  isExplored(x: number, y: number) {
    const i = Math.floor((x + WORLD_HALF) / FOG_CELL), j = Math.floor((y + WORLD_HALF) / FOG_CELL);
    return i >= 0 && j >= 0 && i < N && j < N && this.explored[j * N + i] === 1;
  }

  /** Part du couloir explorée, de 0 à 1. */
  get progress() {
    let n = 0;
    for (let i = 0; i < this.explored.length; i++) n += this.explored[i] & this.counted[i];
    return n / Math.max(1, this.total);
  }

  /** Sauvegarde locale, au plus toutes les 3 s. */
  tick(dt: number) {
    this.saveTimer -= dt;
    if (!this.dirty || this.saveTimer > 0) return;
    this.saveTimer = 3;
    this.dirty = false;
    try {
      const bytes = new Uint8Array(Math.ceil((N * N) / 8));
      for (let i = 0; i < N * N; i++) if (this.explored[i]) bytes[i >> 3] |= 1 << (i & 7);
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      localStorage.setItem(this.key, btoa(bin));
    } catch { /* ignore */ }
  }

  /** Dessine le brouillard sur un rectangle (monde entier → x, y, w, h). */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.9) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, x, y, w, h);
    ctx.restore();
  }
}
