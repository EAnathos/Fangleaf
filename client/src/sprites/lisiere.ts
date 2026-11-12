// Créatures de la Lisière : gluant, sporelin, escargot.

import { TAU, eyes, ink, type Ctx, type UnitLook } from './outils.ts';

export function slime(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const w = Math.sin(u.t * 5 + u.seed) * 0.07;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 1.15 * (1 + w), r * 0.88 * (1 - w), 0, Math.PI, 0);
  ctx.ellipse(0, r * 0.1, r * 1.15 * (1 + w), r * 0.55, 0, 0, Math.PI);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, -r * 0.35, r * 0.22, r * 0.13, -0.5, 0, TAU);
  ctx.fill();
  eyes(ctx, r * 0.12, -r * 0.05, r * 0.32, r * 0.14, '#10181A', u.wild);
}

// ───────────────────────── Deuxième espèce de chaque zone ─────────────────────────

/** Sporelin : petit champignon sauteur des sous-bois (zone 1). */
export function sporelin(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const hop = Math.max(0, Math.sin(u.t * 7 + u.seed)) * r * 0.25;
  ctx.translate(0, -hop);
  const stem = u.flash ? '#FFFFFF' : '#EADFC6';
  // pieds
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#B9A98A';
  ctx.beginPath();
  ctx.ellipse(-0.3 * r, 0.75 * r, 0.22 * r, 0.12 * r, 0, 0, TAU);
  ctx.ellipse(0.3 * r, 0.75 * r, 0.22 * r, 0.12 * r, 0, 0, TAU);
  ctx.fill();
  // pied du champignon (le corps)
  ctx.fillStyle = stem;
  ctx.beginPath();
  ctx.roundRect(-0.45 * r, -0.15 * r, 0.9 * r, 0.9 * r, 0.3 * r);
  ctx.fill();
  ink(ctx, r);
  eyes(ctx, 0.08 * r, 0.25 * r, 0.2 * r, 0.09 * r, '#10181A', u.wild);
  // chapeau
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-1.0 * r, 0.0);
  ctx.quadraticCurveTo(-0.95 * r, -1.05 * r, 0, -1.05 * r);
  ctx.quadraticCurveTo(0.95 * r, -1.05 * r, 1.0 * r, 0.0);
  ctx.quadraticCurveTo(0, 0.18 * r, -1.0 * r, 0.0);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#F1E8D2';
  for (const [sx, sy, sr] of [[-0.45, -0.45, 0.16], [0.15, -0.72, 0.13], [0.55, -0.3, 0.11], [-0.1, -0.3, 0.08]] as const) {
    ctx.beginPath();
    ctx.arc(sx * r, sy * r, sr * r, 0, TAU);
    ctx.fill();
  }
  // spores qui s'échappent
  ctx.fillStyle = 'rgba(241,232,210,0.6)';
  for (let i = 0; i < 3; i++) {
    const k = (u.t * 0.6 + i / 3 + u.seed) % 1;
    ctx.beginPath();
    ctx.arc((i - 1) * 0.4 * r, (-1.1 - k * 0.8) * r, r * 0.06 * (1 - k), 0, TAU);
    ctx.fill();
  }
}

/** Escargot des mousses : coquille en spirale, corps qui ondule doucement, cornes à yeux (gibier passif). */
export function snail(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const crawl = Math.sin(u.t * 3 + u.seed) * 0.05;
  const body = u.flash ? '#FFFFFF' : '#C9B79A';
  if (u.shell) {
    // rentré dans sa coquille : elle repose au sol, un peu plus bas
    ctx.save();
    ctx.translate(0.2 * r, 0.3 * r);
    shellOf(ctx, r, fill, u);
    ctx.restore();
    return;
  }
  // corps (pied) allongé
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-1.0 * r, 0.6 * r);
  ctx.quadraticCurveTo(-0.2 * r, (0.35 + crawl) * r, 0.75 * r, 0.25 * r);
  ctx.quadraticCurveTo(1.15 * r, 0.1 * r, 1.05 * r, 0.6 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  // tête et cornes oculaires
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0.85 * r, 0.25 * r, 0.3 * r, 0.25 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.08 * r;
  ctx.lineCap = 'round';
  const raise = u.shout ? Math.sin(Math.min(1, u.shout * 1.3) * Math.PI) * 0.3 : 0; // cornes dressées
  for (const [ex, ey0] of [[0.95, -0.35], [1.2, -0.25]]) {
    const ey = ey0 - raise;
    ctx.beginPath();
    ctx.moveTo(0.9 * r, 0.1 * r);
    ctx.lineTo((ex + crawl) * r, ey * r);
    ctx.stroke();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.arc((ex + crawl) * r, ey * r, 0.08 * r, 0, TAU);
    ctx.fill();
  }
  shellOf(ctx, r, fill, u);
  if (u.shout) {
    // carapace dressée : la coquille s'illumine d'un éclat bleu qui pulse puis s'éteint
    const k = u.shout, a = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.75;
    ctx.strokeStyle = `rgba(127,200,232,${a})`;
    ctx.lineWidth = 0.12 * r;
    ctx.beginPath();
    ctx.arc(-0.2 * r, -0.05 * r, (0.7 + k * 0.25) * r, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(190,232,250,${a * 0.35})`;
    ctx.beginPath();
    ctx.arc(-0.2 * r, -0.05 * r, 0.62 * r, 0, TAU);
    ctx.fill();
  }
}

/** Coquille en spirale de l'escargot. */
function shellOf(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(-0.2 * r, -0.05 * r, 0.62 * r, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = u.flash ? '#FFFFFF' : '#8A5E33';
  ctx.lineWidth = 0.09 * r;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.2) {
    const rr = 0.52 * r * (1 - a / (Math.PI * 4.4));
    const px = -0.2 * r + Math.cos(a) * rr, py = -0.05 * r + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-0.42 * r, -0.4 * r, 0.16 * r, 0.09 * r, -0.6, 0, TAU);
  ctx.fill();
}
