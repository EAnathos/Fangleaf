// Coati roux : à quatre pattes, la queue annelée dressée, le museau en l'air. Il regarde vers la droite ; r est le rayon
// de l'espèce (17). Mêmes conventions que les autres bêtes : contour encre, éclair blanc quand on le frappe, yeux violets
// pour un Alpha, animation par u.t (respiration, queue, clignement) et u.moving (pattes).
import type { UnitLook } from './sprites.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

interface Pal {
  fur: string; dark: string; light: string; cream: string; ring: string; nose: string; ink: string; leaf: string; leafLight: string; berry: string; eye: string; white: boolean;
}
const palette = (u: UnitLook): Pal => {
  const w = u.flash;
  const c = (col: string) => (w ? '#FFFFFF' : col);
  return {
    fur: c('#B5562B'), dark: c('#6E2F16'), light: c('#DB8A4C'), cream: c('#F3E2BE'), ring: c('#3E2013'), nose: c('#241512'),
    ink: 'rgba(12,18,16,0.75)', leaf: c('#3C6A36'), leafLight: c('#6FA050'), berry: c('#C8323C'), eye: u.alpha ? '#B48CFF' : '#10181A', white: w,
  };
};

const ell = (ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, col: string, line = 0) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  ctx.fillStyle = col;
  ctx.fill();
  if (line) {
    ctx.strokeStyle = 'rgba(12,18,16,0.75)';
    ctx.lineWidth = line;
    ctx.stroke();
  }
};
const quad = (a: number, c: number, b: number, t: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;

/** Queue annelée : une chaîne de disques le long d'une courbe, anneaux sombres et roux en alternance, bout sombre, reflet. */
function ringedTail(ctx: Ctx, r: number, P: Pal, p0: [number, number], c: [number, number], p1: [number, number], w0: number, w1: number, rings: number, bulge = 0.05) {
  const N = 30, line = Math.max(1.4, r * 0.1);
  const at = (i: number) => {
    const t = i / N, w = (w0 + (w1 - w0) * t + Math.sin(Math.PI * t) * bulge * r);
    return [quad(p0[0], c[0], p1[0], t), quad(p0[1], c[1], p1[1], t), w, t] as const;
  };
  ctx.fillStyle = P.ink;
  for (let i = 0; i <= N; i++) {
    const [x, y, w] = at(i);
    ctx.beginPath();
    ctx.arc(x, y, w + line * 0.6, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i <= N; i++) {
    const [x, y, w, t] = at(i);
    const band = Math.floor(t * rings) % 2;
    ctx.fillStyle = t > 0.93 ? P.ring : band ? P.ring : P.light;
    ctx.beginPath();
    ctx.arc(x, y, w, 0, TAU);
    ctx.fill();
  }
  if (!P.white) {
    ctx.strokeStyle = 'rgba(255,225,185,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 2; i < N - 3; i++) {
      const [x, y, w] = at(i);
      if (i === 2) ctx.moveTo(x - w * 0.3, y - w * 0.35);
      else ctx.lineTo(x - w * 0.3, y - w * 0.35);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

/** Petites mèches de poils le long d'une ligne (contour hérissé). */
function tufts(ctx: Ctx, r: number, col: string, pts: [number, number, number][]) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x, y, a] of pts) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.14, y + Math.sin(a) * r * 0.14);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Une patte : épaule, pied qui avance et se lève en marche, chaussette sombre, trois griffes. */
function leg(ctx: Ctx, r: number, P: Pal, x: number, y0: number, ph: number, mv: number, col: string, len = 0.46) {
  const sw = Math.sin(ph) * 0.2 * r * mv, lift = Math.max(0, Math.cos(ph)) * 0.13 * r * mv;
  const fx = x + sw, fy = y0 + len * r - lift;
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = r * 0.3;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.moveTo(x + (fx - x) * 0.55, y0 + (fy - y0) * 0.55);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = P.cream;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    ctx.moveTo(fx + r * 0.08 + k * r * 0.05, fy + r * 0.07);
    ctx.lineTo(fx + r * 0.2 + k * r * 0.03, fy + r * 0.1 + k * r * 0.03);
  }
  ctx.stroke();
}

/** Œil dans son masque sombre, avec les deux taches claires (au-dessus et en dessous) et un clignement de temps en temps. */
function maskedEye(ctx: Ctx, r: number, P: Pal, x: number, y: number, t: number, size = 1, rot = -0.2) {
  ell(ctx, x - 0.02 * r, y + 0.01 * r, 0.2 * r * size, 0.15 * r * size, rot, P.ring);
  ell(ctx, x + 0.05 * r * size, y - 0.17 * r * size, 0.07 * r * size, 0.045 * r * size, 0.3, P.cream);
  ell(ctx, x + 0.0 * r, y + 0.17 * r * size, 0.06 * r * size, 0.04 * r * size, 0, P.cream);
  const blink = Math.sin(t * 0.9) > 0.985 ? 0.12 : 1;
  ell(ctx, x, y, 0.085 * r * size, 0.105 * r * size * blink, 0, P.eye);
  if (blink === 1 && !P.white) ell(ctx, x - 0.025 * r, y - 0.04 * r * size, 0.03 * r * size, 0.03 * r * size, 0, '#FFFFFF');
}

/** Oreille ronde au bord crème. */
function ear(ctx: Ctx, r: number, P: Pal, x: number, y: number, rot: number, size = 1) {
  ell(ctx, x, y, 0.13 * r * size, 0.15 * r * size, rot, P.fur, Math.max(1.2, r * 0.08));
  ell(ctx, x + 0.01 * r, y + 0.015 * r * size, 0.07 * r * size, 0.085 * r * size, rot, P.cream);
}

function coati(ctx: Ctx, r: number, u: UnitLook, P: Pal) {
  const t = u.t + u.seed, mv = u.moving ? 1 : 0, ph = t * 11, breathe = Math.sin(t * 2.2) * 0.015 * r, bob = mv * -Math.abs(Math.sin(ph)) * 0.04 * r;
  ctx.save();
  ctx.translate(0, bob);
  // queue : s'élève derrière la croupe, puis se recourbe en avant, et se balance
  const sw = Math.sin(t * 1.8) * 0.12 * r;
  ringedTail(ctx, r, P, [-0.66 * r, 0.05 * r], [-1.7 * r, -0.2 * r], [-0.55 * r + sw, -1.55 * r], 0.2 * r, 0.14 * r, 10, 0.07);
  // pattes de l'autre côté
  leg(ctx, r, P, -0.5 * r, 0.3 * r, ph + Math.PI, mv, P.dark);
  leg(ctx, r, P, 0.5 * r, 0.3 * r, ph, mv, P.dark);
  // corps : dos sombre, ventre clair, mèches
  ell(ctx, 0, 0.13 * r + breathe, 0.88 * r, 0.5 * r + breathe, 0, P.fur, Math.max(1.5, r * 0.1));
  ell(ctx, 0.02 * r, -0.08 * r, 0.7 * r, 0.26 * r, 0, P.dark);
  ell(ctx, 0.05 * r, 0.36 * r, 0.62 * r, 0.2 * r, 0, P.light);
  ell(ctx, 0.55 * r, 0.22 * r, 0.3 * r, 0.24 * r, 0.3, P.cream); // bavette
  tufts(ctx, r, P.dark, [[-0.5, -0.38, -2.2], [-0.25, -0.46, -1.9], [0.05, -0.47, -1.6], [0.35, -0.42, -1.2], [-0.78, -0.1, 3.6], [-0.82, 0.12, 3.4]].map(([x, y, a]) => [x * r, y * r, a] as [number, number, number]));
  // pattes du bon côté
  leg(ctx, r, P, -0.4 * r, 0.32 * r, ph, mv, P.fur);
  leg(ctx, r, P, 0.58 * r, 0.3 * r, ph + Math.PI, mv, P.fur);
  // tête relevée : crâne, long museau, nez
  const hx = 0.9 * r, hy = -0.22 * r + breathe, nose = Math.sin(t * 7) * 0.025 * r;
  ear(ctx, r, P, hx - 0.18 * r, hy - 0.28 * r, -0.3);
  ell(ctx, hx, hy, 0.38 * r, 0.32 * r, 0, P.fur, Math.max(1.5, r * 0.1));
  ell(ctx, hx + 0.34 * r, hy + 0.08 * r, 0.42 * r, 0.17 * r, -0.28, P.light, Math.max(1.4, r * 0.09));
  ell(ctx, hx + 0.62 * r, hy + 0.0 * r + nose, 0.2 * r, 0.11 * r, -0.28, P.cream);
  ell(ctx, hx + 0.84 * r, hy - 0.07 * r + nose, 0.1 * r, 0.085 * r, 0, P.nose);
  if (!P.white) ell(ctx, hx + 0.82 * r, hy - 0.1 * r + nose, 0.03 * r, 0.025 * r, 0, 'rgba(255,255,255,0.7)');
  ctx.strokeStyle = P.dark;
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.moveTo(hx + 0.4 * r, hy + 0.17 * r);
  ctx.quadraticCurveTo(hx + 0.62 * r, hy + 0.15 * r, hx + 0.74 * r, hy + 0.06 * r);
  ctx.stroke();
  maskedEye(ctx, r, P, hx + 0.12 * r, hy - 0.06 * r, t);
  ctx.restore();
}

export function drawCoati(ctx: Ctx, r: number, u: UnitLook) {
  coati(ctx, r, u, palette(u));
}
