// Créatures des Ruines moussues : golem, feu follet, guetteur.

import { TAU, eyes, ink, type Ctx, type UnitLook } from './outils.ts';

export function golem(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4A5F47';
  ctx.beginPath();
  ctx.roundRect(-r * 1.25, -r * 0.1, r * 0.45, r * 0.75, r * 0.15);
  ctx.roundRect(r * 0.8, -r * 0.1, r * 0.45, r * 0.75, r * 0.15);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-r * 0.9, -r * 0.75, r * 1.8, r * 1.5, r * 0.4);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#7FCB5B';
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.72, r * 0.55, r * 0.22, 0, 0, TAU);
  ctx.ellipse(r * 0.35, -r * 0.68, r * 0.3, r * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,24,26,0.25)';
  ctx.beginPath();
  ctx.arc(-r * 0.4, r * 0.35, r * 0.14, 0, TAU);
  ctx.arc(r * 0.45, r * 0.45, r * 0.1, 0, TAU);
  ctx.fill();
  eyes(ctx, r * 0.05, -r * 0.15, r * 0.32, r * 0.13, u.alpha ? '#B48CFF' : '#5CC8B8', u.wild);
}

/** Feu follet : flamme froide qui flotte au-dessus des ruines (zone 4). */
export function wisp(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = (k: number) => Math.sin(u.t * 9 + u.seed + k) * 0.08;
  const flame = (scale: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-0.7 * r * scale, 0.2 * r * scale);
    ctx.quadraticCurveTo(-0.8 * r * scale, -0.5 * r * scale, (-0.25 + f(1)) * r * scale, -1.0 * r * scale);
    ctx.quadraticCurveTo(-0.15 * r * scale, -0.55 * r * scale, (0.05 + f(2)) * r * scale, -1.3 * r * scale);
    ctx.quadraticCurveTo(0.3 * r * scale, -0.6 * r * scale, (0.45 + f(3)) * r * scale, -0.95 * r * scale);
    ctx.quadraticCurveTo(0.85 * r * scale, -0.4 * r * scale, 0.7 * r * scale, 0.2 * r * scale);
    ctx.quadraticCurveTo(0.6 * r * scale, 0.75 * r * scale, 0, 0.75 * r * scale);
    ctx.quadraticCurveTo(-0.6 * r * scale, 0.75 * r * scale, -0.7 * r * scale, 0.2 * r * scale);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = r * 0.9;
  flame(1.0, u.flash ? '#FFFFFF' : fill);
  ctx.restore();
  flame(0.72, u.flash ? '#FFFFFF' : '#BFE3FF');
  flame(0.42, '#FFFFFF');
  // traînée d'étincelles sous lui
  ctx.fillStyle = 'rgba(191,227,255,0.7)';
  for (let i = 0; i < 3; i++) {
    const k = (u.t * 0.8 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc((i - 1) * 0.25 * r, (0.8 + k * 0.5) * r, r * 0.07 * (1 - k), 0, TAU);
    ctx.fill();
  }
  eyes(ctx, 0.05 * r, 0.1 * r, 0.22 * r, 0.1 * r, '#1A2A44', u.wild);
}

/** Guetteur runique : sentinelle de pierre moussue ; son œil se charge avant le trait runique (zone 4, tireur). */
export function watcher(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const ch = u.charge ?? 0;
  const step = Math.sin(u.t * 3 + u.seed) * 0.04 * r;
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4A4F4C';
  ctx.beginPath();
  ctx.roundRect(-0.45 * r, 0.45 * r + step, 0.3 * r, 0.35 * r, 0.08 * r);
  ctx.roundRect(0.15 * r, 0.45 * r - step, 0.3 * r, 0.35 * r, 0.08 * r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-0.6 * r, 0.55 * r);
  ctx.lineTo(-0.5 * r, -0.85 * r);
  ctx.quadraticCurveTo(0, -1.15 * r, 0.5 * r, -0.85 * r);
  ctx.lineTo(0.6 * r, 0.55 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4E7A49';
  ctx.beginPath();
  ctx.ellipse(-0.05 * r, -0.92 * r, 0.55 * r, 0.2 * r, -0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#5E8A55';
  ctx.beginPath();
  ctx.ellipse(-0.45 * r, -0.4 * r, 0.14 * r, 0.3 * r, 0.2, 0, TAU);
  ctx.fill();
  // rune gravée, qui s'allume avec la charge
  ctx.strokeStyle = `rgba(143,227,214,${0.35 + ch * 0.5})`;
  ctx.lineWidth = 0.06 * r;
  ctx.beginPath();
  ctx.moveTo(-0.2 * r, 0.1 * r);
  ctx.lineTo(0, 0.35 * r);
  ctx.lineTo(0.2 * r, 0.1 * r);
  ctx.stroke();
  // œil
  const g = 0.22 * r * (1 + ch * 0.3);
  ctx.fillStyle = `rgba(143,227,214,${0.25 + ch * 0.35})`;
  ctx.beginPath();
  ctx.arc(0.05 * r, -0.35 * r, g * 1.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(0.05 * r, -0.35 * r, g * 1.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ch > 0.3 ? '#C9FFF5' : '#8FE3D6';
  ctx.beginPath();
  ctx.arc(0.1 * r, -0.35 * r, g * 0.6, 0, TAU);
  ctx.fill();
}
