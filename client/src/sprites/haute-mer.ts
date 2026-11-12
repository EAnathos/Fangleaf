// Créatures de la Haute mer : le Kraken et ses tentacules.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, ink, type Ctx, type UnitLook } from './outils.ts';

// ───────────────────────── Haute mer ─────────────────────────

/** Un tentacule : une bande effilée le long d'une courbe (base → pointe), ventouses claires sur son bord intérieur. */
export function tentacleStroke(ctx: Ctx, pts: [number, number][], w0: number, w1: number, col: string, sucker: string, flash: boolean) {
  const n = pts.length - 1, left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = pts[i], [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(n, i + 1)];
    const dx = nx - px, dy = ny - py, l = Math.hypot(dx, dy) || 1, w = w0 + (w1 - w0) * (i / n);
    left.push([x - (dy / l) * w, y + (dx / l) * w]);
    right.push([x + (dy / l) * w, y - (dx / l) * w]);
  }
  ctx.fillStyle = flash ? '#FFFFFF' : col;
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,24,0.75)';
  ctx.lineWidth = Math.max(1.2, w0 * 0.18);
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (flash) return;
  ctx.fillStyle = sucker;
  for (let i = 1; i < n; i += 1) {
    const [x, y] = left[i], rr = (w0 + (w1 - w0) * (i / n)) * 0.42;
    const [cx, cy] = pts[i];
    ctx.beginPath();
    ctx.arc(x + (cx - x) * 0.35, y + (cy - y) * 0.35, rr, 0, TAU);
    ctx.fill();
  }
}

export const KRAKEN = { dark: '#3E2350', light: '#9A6AAE', spot: '#4A2A5E', sucker: '#E8C8D8', eye: '#F0D060' };

/**
 * Le Kraken : une tête immense qui émerge de la mer contre le bateau, manteau violet tacheté (plus clair à la lumière),
 * deux yeux jaunes à pupille fendue, un bec ; six tentacules à ventouses sortent de l'eau autour de lui et ondulent,
 * et l'eau bouillonne à sa base.
 */
export function kraken(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, body = f ? '#FFFFFF' : fill;
  // tentacules du fond
  const arm = (k: number, front: boolean) => {
    const side = k % 2 ? 1 : -1, base = (0.35 + Math.floor(k / 2) * 0.32) * side;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8, wave = Math.sin(u.t * 2.2 + k * 1.3 - s * 3) * 0.35 * s;
      pts.push([(base + side * (0.35 + 0.55 * s) + wave * 0.6) * r, (0.55 - s * (front ? 1.1 : 1.6) + Math.abs(wave) * 0.4) * r]);
    }
    tentacleStroke(ctx, pts, 0.16 * r, 0.03 * r, front ? body : KRAKEN.dark, KRAKEN.sucker, f);
  };
  for (const k of [2, 3, 4, 5]) arm(k, false);
  // eau qui bouillonne à sa base
  if (!f) {
    ctx.fillStyle = 'rgba(20,50,80,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 1.25 * r, 0.3 * r, 0, 0, TAU);
    ctx.fill();
  }
  // manteau (la tête), taches, reflet
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, 0.6 * r);
  ctx.bezierCurveTo(-0.95 * r, -0.2 * r, -0.6 * r, -1.35 * r, 0, -1.35 * r);
  ctx.bezierCurveTo(0.6 * r, -1.35 * r, 0.95 * r, -0.2 * r, 0.62 * r, 0.6 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = 'rgba(30,14,40,0.3)';
    ctx.beginPath();
    ctx.ellipse(0.32 * r, -0.4 * r, 0.32 * r, 0.8 * r, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = KRAKEN.light;
    ctx.beginPath();
    ctx.ellipse(-0.3 * r, -0.85 * r, 0.16 * r, 0.32 * r, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = KRAKEN.spot;
    for (const [x, y, s] of [[-0.35, -0.4, 0.09], [0.1, -0.95, 0.07], [0.35, -0.65, 0.08], [-0.1, -0.2, 0.06], [0.42, -0.1, 0.06], [-0.48, -0.05, 0.05]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
    }
  }
  // yeux jaunes à pupille fendue, paupière lourde, bec
  for (const sd of [-1, 1]) {
    const ex = sd * 0.34 * r, ey = 0.02 * r, es = 0.17 * r;
    ctx.fillStyle = f ? '#FFFFFF' : KRAKEN.dark;
    ctx.beginPath();
    ctx.ellipse(ex, ey, es * 1.3, es * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    if (!f) {
      ctx.shadowColor = u.alpha ? '#B48CFF' : KRAKEN.eye;
      ctx.shadowBlur = es;
    }
    ctx.fillStyle = u.alpha ? '#B48CFF' : KRAKEN.eye;
    ctx.beginPath();
    ctx.ellipse(ex, ey, es, es * 0.85, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.ellipse(ex, ey, es * 0.2, es * 0.75, 0, 0, TAU);
    ctx.fill();
    const lids = u.lids ?? 1;
    if (lids < 1) {
      // l'œil encore fermé (cinématique : il s'ouvre)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, es * 1.32, es * 1.12, 0, 0, TAU);
      ctx.clip();
      ctx.fillStyle = body;
      ctx.fillRect(ex - es * 1.4, ey - es * 1.2, es * 2.8, es * 2.3 * (1 - lids));
      ctx.restore();
    }
    ctx.fillStyle = body; // paupière
    ctx.beginPath();
    ctx.ellipse(ex, ey - es * 0.55, es * 1.1, es * 0.45, sd * 0.25, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = f ? '#FFFFFF' : '#2A1A14';
  ctx.beginPath();
  ctx.moveTo(-0.1 * r, 0.3 * r);
  ctx.lineTo(0, 0.48 * r);
  ctx.lineTo(0.1 * r, 0.3 * r);
  ctx.closePath();
  ctx.fill();
  // tentacules de devant
  for (const k of [0, 1]) arm(k, true);
  // écume tout autour
  if (!f) {
    ctx.strokeStyle = 'rgba(230,248,255,0.7)';
    ctx.lineWidth = Math.max(2, 0.04 * r);
    ctx.setLineDash([0.12 * r, 0.08 * r]);
    ctx.lineDashOffset = -u.t * 30;
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 1.25 * r, 0.3 * r, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Le Kraken tel qu'en jeu (sans anneau ni couronne), centré en (x, y), pour sa cinématique : lids ouvre ses yeux. */
export function drawKraken(ctx: Ctx, x: number, y: number, r: number, t: number, lids = 1) {
  const s = SPECIES.findIndex((sp) => sp.key === 'kraken');
  ctx.save();
  ctx.translate(x, y);
  kraken(ctx, r, SPECIES[s].color, { x, y, r, species: s, alpha: false, wild: true, face: 1, t, seed: 0, flash: false, lids });
  ctx.restore();
}
export { KRAKEN as KRAKEN_COLORS };

/** Tentacule du Kraken accroché au pont : il sort de la mer par-dessus le bastingage et se balance, ventouses en dedans. */
export function krakenTentacle(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 9; i++) {
    const s = i / 9, sway = Math.sin(u.t * 2.6 + u.seed - s * 2.5) * 0.45 * s;
    // il monte, puis la pointe s'enroule
    const curl = s > 0.7 ? (s - 0.7) / 0.3 : 0;
    pts.push([(sway + Math.sin(curl * 2.4) * 0.5) * r, (0.6 - s * 2.1 + (1 - Math.cos(curl * 2.4)) * 0.3) * r]);
  }
  if (!u.flash) {
    // éclats de bois et eau à l'endroit où il s'agrippe
    ctx.fillStyle = 'rgba(200,235,250,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 0.75 * r, 0.22 * r, 0, 0, TAU);
    ctx.fill();
  }
  tentacleStroke(ctx, pts, 0.36 * r, 0.07 * r, u.flash ? '#FFFFFF' : fill, KRAKEN.sucker, u.flash);
}
