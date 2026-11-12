// Créatures des Landes : sanglier, ours, lièvre.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, blot, gait, glowEye, ink, whiteIf, type Ctx, type UnitLook } from './outils.ts';

// ───────────────────────── Sanglier ─────────────────────────

/** Chemin fermé à partir de points [x, y] (en rayons), lissé par des courbes passant par les milieux. */
const boarPath = (ctx: Ctx, r: number, pts: number[][]) => {
  ctx.beginPath();
  const n = pts.length, mid = (i: number) => [((pts[i % n][0] + pts[(i + 1) % n][0]) / 2) * r, ((pts[i % n][1] + pts[(i + 1) % n][1]) / 2) * r];
  const [sx, sy] = mid(n - 1);
  ctx.moveTo(sx, sy);
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[i][0] * r, pts[i][1] * r, mx, my);
  }
  ctx.closePath();
};
/** Patte fine de suidé : jarret, puis sabot fendu sombre. swing : angle du pas. */
const hoofLeg = (ctx: Ctx, r: number, x: number, y: number, w: number, h: number, swing: number, col: string, hoof: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-w * 0.6, 0);
  ctx.lineTo(w * 0.6, 0);
  ctx.lineTo(w * 0.42, h * 0.82);
  ctx.lineTo(-w * 0.42, h * 0.82);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.06);
  ctx.fillStyle = hoof;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.8);
  ctx.lineTo(w * 0.55, h * 0.8);
  ctx.lineTo(w * 0.6, h);
  ctx.lineTo(-w * 0.55, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.82);
  ctx.lineTo(w * 0.05, h);
  ctx.stroke();
  ctx.restore();
};
/** Défense d'ivoire qui part de la gueule et remonte en croissant. */
const ivoryTusk = (ctx: Ctx, r: number, x: number, y: number, len: number, col: string, broken = false) => {
  const l = broken ? len * 0.45 : len;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 0.05 * r, y);
  ctx.quadraticCurveTo(x + l * 0.75, y + l * 0.05, x + l * 0.62, y - l * 0.85);
  if (broken) ctx.lineTo(x + l * 0.46, y - l * 0.8);
  ctx.quadraticCurveTo(x + l * 0.42, y - l * 0.15, x - 0.05 * r, y - 0.09 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.04);
};
/** Crête de soies dentelée le long de l'échine : de (x0, y0) à (x1, y1), plus haute au garrot. */
const bristles = (ctx: Ctx, r: number, x0: number, y0: number, x1: number, y1: number, h: number, n: number, col: string) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0 * r, y0 * r + 0.06 * r);
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const lift = (i % 2 ? 1 : 0.35) * h * (0.45 + Math.sin(k * Math.PI * 0.9 + 0.3) * 0.75);
    ctx.lineTo((x - 0.02) * r, (y - lift) * r);
  }
  ctx.lineTo(x1 * r, y1 * r + 0.08 * r);
  ctx.closePath();
  ctx.fill();
};
/** Groin : disque au bout du museau, deux narines. */
const pigSnout = (ctx: Ctx, r: number, x: number, y: number, rx: number, ry: number, col: string) => {
  blot(ctx, x, y, rx, ry, col);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  furLine(ctx, r, 0.04);
  blot(ctx, x + rx * 0.15, y - ry * 0.35, rx * 0.22, ry * 0.18, '#10181A');
  blot(ctx, x + rx * 0.15, y + ry * 0.35, rx * 0.22, ry * 0.18, '#10181A');
};
/** Trot : pattes en diagonale (avant gauche avec arrière droite). */
const trot = (u: UnitLook, speed = 9) => Math.sin(u.t * speed + u.seed) * 0.32;
/**
 * Sanglier (zone 3), « sanglier de bruyère » : plus rond et trapu, robe roux sombre à la livrée rayée crème (comme un marcassin qui
 * aurait grandi sans la perdre), brins de bruyère violette pris dans la crête, gros groin, petites défenses.
 * Le géant : rayures délavées, bruyère sèche, défenses énormes.
 */
export function boar(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const fur = whiteIf(u, boss ? '#5A3A26' : '#8B5A36'), shade = whiteIf(u, boss ? '#3E2819' : '#633F25'), dark = whiteIf(u, '#2E1E13');
  const stripe = boss ? 'rgba(226,205,166,0.35)' : 'rgba(236,214,170,0.75)', heather = boss ? '#8E7A86' : '#B46FC2';
  const ivory = whiteIf(u, '#F1E8D2'), disk = whiteIf(u, '#D79A7E');
  const g = gait(u, 10), bob = u.moving ? Math.abs(Math.sin(u.t * 20 + u.seed)) * r * 0.035 : 0;
  const hoof = (i: number, x: number, y: number, w: number, h: number, col: string) => hoofLeg(ctx, r, x, y - g[i].lift * 0.06 * r, w, h, -g[i].a * 0.32, col, dark);
  hoof(0, -0.52 * r, 0.18 * r, 0.22 * r, 0.6 * r, shade);
  hoof(1, 0.32 * r, 0.16 * r, 0.22 * r, 0.62 * r, shade);
  hoof(2, -0.32 * r, 0.2 * r, 0.23 * r, 0.58 * r, fur);
  hoof(3, 0.52 * r, 0.18 * r, 0.23 * r, 0.6 * r, fur);
  ctx.save();
  ctx.translate(0, -bob);
  // queue en tire-bouchon
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-0.98 * r, -0.12 * r, 0.08 * r, -0.5 + Math.sin(u.t * 8 + u.seed) * 0.4, 4);
  ctx.stroke();
  // corps en tonneau
  ctx.fillStyle = fur;
  boarPath(ctx, r, [[-0.95, 0.02], [-0.78, -0.42], [0.0, -0.6], [0.55, -0.46], [0.72, 0.1], [0.45, 0.46], [-0.45, 0.46], [-0.9, 0.3]]);
  ctx.fill();
  furLine(ctx, r);
  blot(ctx, -0.1 * r, 0.35 * r, 0.6 * r, 0.11 * r, shade);
  if (!u.flash) {
    // livrée rayée le long du corps
    ctx.save();
    boarPath(ctx, r, [[-0.95, 0.02], [-0.78, -0.42], [0.0, -0.6], [0.55, -0.46], [0.72, 0.1], [0.45, 0.46], [-0.45, 0.46], [-0.9, 0.3]]);
    ctx.clip();
    ctx.strokeStyle = stripe;
    ctx.lineWidth = r * 0.07;
    for (const y of [-0.36, -0.16, 0.04]) {
      ctx.beginPath();
      ctx.moveTo(-1.0 * r, (y + 0.06) * r);
      ctx.quadraticCurveTo(-0.1 * r, (y - 0.08) * r, 0.75 * r, (y + 0.02) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
  bristles(ctx, r, -0.72, -0.4, 0.5, -0.5, 0.2, 12, dark);
  if (!u.flash) {
    // brins de bruyère plantés dans la crête : tige et grappe de clochettes
    for (const [x, y, a] of [[-0.42, -0.6, -0.3], [-0.05, -0.72, 0.1], [0.28, -0.66, 0.35]]) {
      ctx.save();
      ctx.translate(x * r, y * r);
      ctx.rotate(a + Math.sin(u.t * 3 + x * 5) * 0.08);
      ctx.strokeStyle = boss ? '#6E5A3E' : '#4F7840';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, 0.12 * r);
      ctx.lineTo(0, -0.14 * r);
      ctx.stroke();
      for (let k = 0; k < 4; k++) blot(ctx, (k % 2 ? 0.04 : -0.04) * r, (-0.12 + k * 0.06) * r, 0.035 * r, 0.04 * r, heather);
      ctx.restore();
    }
  }
  // tête ronde et gros groin
  ctx.fillStyle = fur;
  boarPath(ctx, r, [[0.4, -0.44], [0.82, -0.36], [1.18, 0.0], [1.16, 0.3], [0.8, 0.42], [0.42, 0.34], [0.34, -0.06]]);
  ctx.fill();
  furLine(ctx, r);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0.5 * r, -0.36 * r);
  ctx.quadraticCurveTo(0.42 * r, -0.66 * r, 0.56 * r, -0.72 * r);
  ctx.quadraticCurveTo(0.72 * r, -0.56 * r, 0.74 * r, -0.36 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.05);
  pigSnout(ctx, r, 1.18 * r, 0.15 * r, 0.13 * r, 0.18 * r, disk);
  ivoryTusk(ctx, r, 0.98 * r, 0.32 * r, (boss ? 0.4 : 0.2) * r, ivory);
  glowEye(ctx, 0.78 * r, -0.08 * r, 0.065 * r, u.alpha ? '#B48CFF' : boss ? '#E8693F' : '#2A1A10', u.wild, u.alpha || boss);
  ctx.restore();
}

// ───────────────────────── Ours (grizzly des fourrés) ─────────────────────────

/** Contour sombre du chemin courant (fourrure). */
const furLine = (ctx: Ctx, r: number, k = 0.1) => {
  ctx.strokeStyle = 'rgba(12,18,16,0.7)';
  ctx.lineWidth = Math.max(1.5, r * k);
  ctx.lineJoin = 'round';
  ctx.stroke();
};
/** Ellipse au contour en touffes de poils (pointes vers l'extérieur). */
const furTufts = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, col: string, jag = 1.14, rot = 0) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let k = 0; k <= n * 2; k++) {
    const a = (k / (n * 2)) * TAU + rot, d = k % 2 ? 1 : jag;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
};
/** Patte épaisse qui avance et recule (pas lourd), griffes claires au bout. */
const heavyPaw = (ctx: Ctx, r: number, x: number, y: number, w: number, h: number, swing: number, col: string, claw: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(-w / 2, 0, w, h, [w * 0.35, w * 0.35, w * 0.45, w * 0.45]);
  ctx.fill();
  furLine(ctx, r, 0.07);
  ctx.strokeStyle = claw;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const k of [-0.25, 0.05, 0.35]) {
    ctx.moveTo(w * k + w * 0.1, h - r * 0.02);
    ctx.lineTo(w * k + w * 0.22, h + r * 0.07);
  }
  ctx.stroke();
  ctx.restore();
};
export function bear(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const fur = whiteIf(u, boss ? '#3F2A1D' : '#6B4A33'), shade = whiteIf(u, boss ? '#2A1C14' : '#4E3424'), dark = whiteIf(u, boss ? '#1C130E' : '#33221A');
  const light = boss ? '#7A5A3E' : '#A7804F', muzzle = whiteIf(u, boss ? '#8C6E52' : '#C9A27A');
  // pas lourd et chaloupé : les épaules roulent au rythme des pattes ; immobile, il respire à peine
  const g = gait(u, 6), sway = u.moving ? Math.sin(u.t * 12 + u.seed) : Math.sin(u.t * 1.5 + u.seed) * 0.3;
  const paw = (i: number) => ({ swing: -g[i].a * 0.26, y: -g[i].lift * 0.07 * r });
  // les quatre pattes d'abord (le corps couvre leur haut) : celles du fond plus sombres
  heavyPaw(ctx, r, -0.62 * r, 0.12 * r + paw(0).y, 0.3 * r, 0.62 * r, paw(0).swing, dark, '#E9DFC8');
  heavyPaw(ctx, r, 0.4 * r, 0.08 * r + paw(1).y, 0.32 * r, 0.66 * r, paw(1).swing, dark, '#E9DFC8');
  heavyPaw(ctx, r, -0.34 * r, 0.16 * r + paw(2).y, 0.32 * r, 0.62 * r, paw(2).swing, shade, '#F2E8D2');
  heavyPaw(ctx, r, 0.62 * r, 0.1 * r + paw(3).y, 0.34 * r, 0.66 * r, paw(3).swing, shade, '#F2E8D2');
  // croupe basse et ronde, bosse d'épaule haute
  furTufts(ctx, -0.45 * r, 0.05 * r, 0.55 * r, 0.5 * r, 9, fur);
  furLine(ctx, r);
  furTufts(ctx, 0.1 * r, -0.12 * r + sway * r * 0.02, 0.62 * r, 0.62 * r, 11, fur, 1.12, 0.3);
  furLine(ctx, r);
  furTufts(ctx, -0.25 * r, 0.1 * r, 0.75 * r, 0.42 * r, 12, fur, 1.06);
  // ventre dans l'ombre, reflet doré sur l'échine et la bosse
  blot(ctx, -0.2 * r, 0.38 * r, 0.62 * r, 0.12 * r, shade);
  if (!u.flash) {
    // pointes de poils dorées sur la bosse (grizzly : « poil argenté »), en fines mèches
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = -2.5 + k * 0.17, x = 0.1 * r + Math.cos(a) * 0.6 * r, y = -0.12 * r + Math.sin(a) * 0.62 * r;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * -0.16 * r, y + Math.sin(a) * -0.16 * r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // tête lourde, portée bas devant l'épaule
  const hx = 0.82 * r, hy = 0.0 * r + sway * r * 0.025;
  furTufts(ctx, hx, hy, 0.4 * r, 0.36 * r, 9, fur, 1.1);
  furLine(ctx, r);
  for (const ox of [-0.18, 0.12]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(hx + ox * r, hy - 0.34 * r, 0.12 * r, 0, TAU);
    ctx.fill();
    furLine(ctx, r, 0.06);
    blot(ctx, hx + ox * r, hy - 0.33 * r, 0.06 * r, 0.055 * r, whiteIf(u, '#3A2618'));
  }
  // long museau clair, truffe, gueule
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.moveTo(hx + 0.12 * r, hy - 0.08 * r);
  ctx.quadraticCurveTo(hx + 0.5 * r, hy - 0.14 * r, hx + 0.6 * r, hy + 0.04 * r);
  ctx.quadraticCurveTo(hx + 0.56 * r, hy + 0.2 * r, hx + 0.16 * r, hy + 0.2 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.06);
  blot(ctx, hx + 0.58 * r, hy - 0.02 * r, 0.08 * r, 0.065 * r, '#10181A');
  ctx.strokeStyle = 'rgba(16,24,26,0.6)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.moveTo(hx + 0.52 * r, hy + 0.12 * r);
  ctx.quadraticCurveTo(hx + 0.4 * r, hy + 0.17 * r, hx + 0.28 * r, hy + 0.13 * r);
  ctx.stroke();
  if (boss && !u.flash) {
    // cicatrices de combat sur l'épaule et le museau
    ctx.strokeStyle = '#C98B6A';
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.beginPath();
    for (const [x, y] of [[0.05, -0.38], [0.16, -0.42], [0.27, -0.46]]) {
      ctx.moveTo(x * r, y * r);
      ctx.lineTo((x + 0.1) * r, (y + 0.24) * r);
    }
    ctx.moveTo(hx + 0.2 * r, hy - 0.12 * r);
    ctx.lineTo(hx + 0.32 * r, hy + 0.04 * r);
    ctx.stroke();
  }
  glowEye(ctx, hx + 0.12 * r, hy - 0.1 * r, 0.06 * r, u.alpha ? '#B48CFF' : boss ? '#E8693F' : '#F0B64A', u.wild, u.alpha || boss);
}

/** Lièvre des ronces, en lapin boule : tout rond et duveteux, petites oreilles, grands yeux brillants, joues roses (gibier passif). */
export function hare(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const fur = u.flash ? '#FFFFFF' : '#D8C7A8', shade = u.flash ? '#FFFFFF' : '#B9A57E', pale = u.flash ? '#FFFFFF' : '#F4ECDC';
  const ell = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  };
  const flick = Math.sin(u.t * 3 + u.seed) * 0.08, lp = u.leap ?? { ext: 0, reach: 0, crouch: 0 };
  // pattes arrière : posées et ramassées, ou détendues loin derrière pendant la poussée
  ell(-0.35 * r - lp.ext * 0.26 * r, 0.62 * r + lp.ext * 0.14 * r, 0.22 * r + lp.ext * 0.16 * r, 0.12 * r, lp.ext * 0.35, shade);
  // pattes avant : sous le corps, rentrées en l'air, tendues vers le sol pour se recevoir
  const tuck = lp.ext * (1 - lp.reach);
  ell(0.3 * r + lp.reach * 0.32 * r - tuck * 0.1 * r, 0.62 * r + lp.reach * 0.1 * r - tuck * 0.12 * r, 0.22 * r - tuck * 0.06 * r, 0.12 * r, -lp.reach * 0.6, shade);
  // boule de poils au contour duveteux
  ctx.fillStyle = fur;
  ctx.beginPath();
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * TAU, d = k % 2 ? 1 : 1.06;
    const x = Math.cos(a) * 0.78 * r * d, y = 0.1 * r + Math.sin(a) * 0.62 * r * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,18,16,0.55)';
  ctx.lineWidth = Math.max(1.3, r * 0.09);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ell(0.05 * r, 0.32 * r, 0.42 * r, 0.24 * r, 0, pale);
  ell(-0.82 * r, 0.05 * r, 0.16 * r, 0.15 * r, 0, '#FFFFFF'); // queue
  const back = Math.max(lp.ext, lp.reach * 0.6) * 0.9 - lp.crouch * 0.15; // oreilles couchées par le vent du saut
  for (const [ox, rot] of [[0.1, -0.3 + flick - back], [0.42, 0.25 - flick - back * 1.2]] as const) {
    ctx.save();
    ctx.translate(ox * r, -0.42 * r);
    ctx.rotate(rot);
    ell(0, -0.28 * r, 0.13 * r, 0.32 * r, 0, fur);
    ink(ctx, r * 0.5);
    ell(0, -0.26 * r, 0.06 * r, 0.2 * r, 0, u.flash ? '#FFFFFF' : '#F2B8B0');
    ctx.restore();
  }
  // grands yeux doux (violets pour un Alpha), reflet blanc
  for (const ex of [0.2, 0.52]) {
    ell(ex * r, -0.08 * r, 0.11 * r, 0.13 * r, 0, u.alpha ? '#B48CFF' : '#10181A');
    ell((ex - 0.035) * r, -0.12 * r, 0.04 * r, 0.04 * r, 0, '#FFFFFF');
  }
  ell(0.08 * r, 0.08 * r, 0.08 * r, 0.05 * r, 0, 'rgba(240,140,140,0.6)');
  ell(0.64 * r, 0.08 * r, 0.08 * r, 0.05 * r, 0, 'rgba(240,140,140,0.6)');
  ell(0.37 * r, 0.04 * r, 0.05 * r, 0.035 * r, 0, '#D8706A');
}
