// Outils de dessin communs aux créatures : ombre au sol, yeux, encre des contours, apparence d'une unité.

import type { Wings } from '../anim.ts';

export type Ctx = CanvasRenderingContext2D;
export const TAU = Math.PI * 2;

export function shadow(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(8, 14, 12, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.75, r * 1.05, r * 0.42, 0, 0, TAU);
  ctx.fill();
}

export function eyes(ctx: Ctx, x: number, y: number, gap: number, size: number, color: string, angry: boolean) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - gap, y, size, 0, TAU);
  ctx.arc(x + gap, y, size, 0, TAU);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, size * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - gap - size * 1.4, y - size * 2.1);
    ctx.lineTo(x - gap + size * 0.9, y - size * 1.1);
    ctx.moveTo(x + gap + size * 1.4, y - size * 2.1);
    ctx.lineTo(x + gap - size * 0.9, y - size * 1.1);
    ctx.stroke();
  }
}

export interface UnitLook {
  x: number;
  y: number;
  r: number;
  species: number;
  alpha: boolean;
  wild: boolean;
  ownerColor?: string;
  face: number; // -1 gauche, 1 droite
  t: number; // secondes, pour l'animation
  seed: number;
  flash: boolean;
  key?: string; // apparence à utiliser (par défaut celle de l'espèce)
  legend?: boolean; // Alpha légendaire : aura et couronne dorées
  color?: string;
  charge?: number; // tireur : avancement de la charge du tir (0 à 1)
  inWater?: boolean; // serpent : nage (seuls la tête et les anneaux dépassent) ; crabe, crapaud : à moitié dans l'eau, avec des remous
  moving?: boolean; // il se déplace (gluants, crapauds et lièvres avancent par bonds)
  air?: number; // hauteur au-dessus du sol (bond d'un géant) : le corps monte, l'ombre reste au sol et rétrécit
  squash?: number; // écrasement vertical (> 1 : étiré, < 1 : aplati), pour l'élan et l'atterrissage
  shell?: boolean; // escargot rentré dans sa coquille : seule la coquille, posée au sol
  shout?: number; // Alpha suricate qui crie, escargot qui dresse sa carapace : avancement de 0 à 1 (0 : rien)
  leap?: Leap; // en plein bond (rempli par drawUnit) : de quoi poser les pattes
  lids?: number; // Kraken : ouverture des yeux (1 : ouverts ; moins : la paupière couvre l'œil, pour sa cinématique)
  wings?: Wings; // wyverne en pleine attaque (bond, charge) : ailes déployées, rabattues, battantes
  flying?: boolean; // wyverne, dragonnet en vol : pattes repliées sous le ventre (elles ne marchent pas dans le vide)
}

/** Pose d'un bond : ext (0 → 1) pattes arrière détendues, reach (0 → 1) pattes avant tendues vers le sol, crouch (0 → 1) ramassé. */
export interface Leap { ext: number; reach: number; crouch: number }

/** Contour sombre du corps (chemin courant) pour détacher le sprite du sol. */
export function ink(ctx: Ctx, r: number) {
  ctx.strokeStyle = 'rgba(12,18,16,0.75)';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.stroke();
}

// ───────────────────────── Aides de dessin ─────────────────────────

/** Trait courbe (Bézier cubique) qui s'affine de w0 à w1 : défenses, pattes, crocs. */
export function taper(ctx: Ctx, r: number, pts: number[], w0: number, w1: number, color: string, outline = true) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = pts.map((v) => v * r);
  const at = (t: number) => {
    const m = 1 - t;
    return [
      m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3,
      m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3,
    ];
  };
  ctx.lineCap = 'round';
  const passes: [string, number][] = outline ? [['rgba(12,18,16,0.8)', 0.08], [color, 0]] : [[color, 0]];
  for (const [c, extra] of passes) {
    ctx.strokeStyle = c;
    let [px, py] = at(0);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, [nx, ny] = at(t);
      ctx.lineWidth = Math.max(1, r * (w0 + (w1 - w0) * t + extra));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      [px, py] = [nx, ny];
    }
  }
}

/**
 * Allure d'un quadrupède au pas, comme un vrai : les pattes partent l'une après l'autre, à un quart de cycle d'écart
 * (arrière gauche, avant gauche, arrière droite, avant droite), jamais toutes ensemble dans le même sens. Pour chaque
 * patte, dans l'ordre [arrière du fond, avant du fond, arrière de devant, avant de devant] : a, de −1 (en arrière) à 1
 * (en avant), et lift, de 0 à 1, le pied levé pendant qu'il revient vers l'avant. Immobile : tout à 0.
 */
export const gait = (u: UnitLook, rate: number) => [0, 0.25, 0.5, 0.75].map((k) => {
  if (u.flying) return { a: -0.7, lift: 1 }; // en vol : pattes ramenées en arrière et repliées, immobiles
  if (!u.moving) return { a: 0, lift: 0 };
  const p = u.t * rate + u.seed - k * TAU;
  return { a: Math.sin(p), lift: Math.max(0, Math.cos(p)) };
});

export const blot = (ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
};
/** Œil : lueur douce (sans shadowBlur), iris, pupille, reflet, et sourcil froncé chez le sauvage. */
export const glowEye = (ctx: Ctx, x: number, y: number, s: number, iris: string, angry: boolean, glow = false) => {
  if (glow) {
    ctx.globalAlpha *= 0.35;
    blot(ctx, x, y, s * 2.4, s * 2, iris);
    ctx.globalAlpha /= 0.35;
  }
  blot(ctx, x, y, s * 1.15, s, iris);
  blot(ctx, x + s * 0.2, y, s * 0.5, s * 0.75, '#10181A');
  blot(ctx, x - s * 0.25, y - s * 0.35, s * 0.25, s * 0.2, 'rgba(255,255,255,0.8)');
  if (angry) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, s * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 1.6, y - s * 1.9);
    ctx.lineTo(x + s * 1.3, y - s * 1.0);
    ctx.stroke();
  }
};
export const whiteIf = (u: UnitLook, c: string) => (u.flash ? '#FFFFFF' : c);

/** Contour sombre du chemin courant, plus fin que ink (détails : pattes, griffes, plaques). */
export const fineInk = (ctx: Ctx, r: number, k = 0.6) => {
  ctx.strokeStyle = 'rgba(12,10,10,0.7)';
  ctx.lineWidth = Math.max(1, r * 0.11 * k);
  ctx.lineJoin = 'round';
  ctx.stroke();
};

/** Ellipse au bord dentelé (fourrure, cendre) : n pointes. */
export const jagged = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, depth = 0.16) => {
  ctx.beginPath();
  for (let k = 0; k <= n * 2; k++) {
    const a = (k / (n * 2)) * TAU, d = k % 2 ? 1 - depth * 0.4 : 1 + depth;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};
