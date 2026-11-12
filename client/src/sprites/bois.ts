// Créatures des Bois profonds : loup, araignée, luciole, tréant, bigfoot.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, blot, eyes, gait, ink, taper, whiteIf, type Ctx, type UnitLook } from './outils.ts';

/**
 * Loup cendré : fourrure épaisse en touffes (contours dentelés), gris charbon, reflet clair le long de l'échine,
 * poitrail et museau plus clairs, regard ambre qui luit. Le géant (Grisecroc) porte la même robe, plus sombre.
 */
const WOLF_COAT = { fur: '#5C6066', shade: '#3E4247', dark: '#2C2F33', light: '#8E949C', eye: '#F0B64A' };
const SHADOW_WOLF_COAT = { fur: '#44474F', shade: '#2E3036', dark: '#1F2125', light: '#6E747E', eye: '#E8693F' };

export function wolf(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const coat = SPECIES[u.species]?.boss ? SHADOW_WOLF_COAT : WOLF_COAT;
  const fur = u.flash ? '#FFFFFF' : coat.fur, shade = u.flash ? '#FFFFFF' : coat.shade, dark = u.flash ? '#FFFFFF' : coat.dark;
  const line = (rr: number) => {
    ctx.strokeStyle = 'rgba(12,18,16,0.6)';
    ctx.lineWidth = Math.max(1.5, rr * 0.1);
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  // touffes : une ellipse au contour dentelé
  const tufts = (cx: number, cy: number, rx: number, ry: number, n: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let k = 0; k <= n * 2; k++) {
      const a = (k / (n * 2)) * TAU, d = k % 2 ? 1 : 1.18;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  const leg = (x: number, y: number, w: number, h: number, sw: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + sw, y, w, h, w * 0.4);
    ctx.fill();
  };
  const g = gait(u, 9), step = (i: number) => -g[i].a * r * 0.09;
  // queue touffue qui balance
  ctx.save();
  ctx.translate(-0.85 * r, -0.05 * r);
  ctx.rotate(-0.45 + Math.sin(u.t * 6 + u.seed) * 0.15);
  tufts(-0.38 * r, 0, 0.42 * r, 0.2 * r, 7, shade);
  line(r);
  ctx.restore();
  for (const [x, i] of [[-0.6, 0], [0.42, 1]] as const) leg(x * r, 0.3 * r - g[i].lift * 0.05 * r, 0.2 * r, 0.5 * r, step(i), dark);
  // corps, ventre dans l'ombre, reflet le long de l'échine
  tufts(-0.12 * r, -0.02 * r, 0.82 * r, 0.42 * r, 11, fur);
  line(r);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(-0.12 * r, 0.24 * r, 0.6 * r, 0.13 * r, 0, 0, TAU);
  ctx.fill();
  if (!u.flash) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    tufts(-0.15 * r, -0.3 * r, 0.6 * r, 0.1 * r, 8, coat.light);
    ctx.restore();
  }
  for (const [x, i] of [[-0.4, 2], [0.46, 3]] as const) leg(x * r, 0.28 * r - g[i].lift * 0.05 * r, 0.22 * r, 0.54 * r, step(i), shade);
  // grosse fourrure du cou, poitrail clair, puis la tête
  tufts(0.55 * r, -0.08 * r, 0.36 * r, 0.38 * r, 8, fur);
  line(r);
  if (!u.flash) tufts(0.62 * r, 0.06 * r, 0.16 * r, 0.2 * r, 5, coat.light);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(0.5 * r, -0.42 * r);
  ctx.quadraticCurveTo(0.8 * r, -0.6 * r, 1.0 * r, -0.3 * r);
  ctx.lineTo(1.32 * r, -0.14 * r);
  ctx.quadraticCurveTo(1.38 * r, 0.02 * r, 1.22 * r, 0.06 * r);
  ctx.quadraticCurveTo(0.9 * r, 0.14 * r, 0.62 * r, 0.04 * r);
  ctx.closePath();
  ctx.fill();
  line(r);
  for (const ox of [0.58, 0.76]) {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(ox * r, -0.44 * r);
    ctx.lineTo((ox + 0.05) * r, -0.78 * r);
    ctx.lineTo((ox + 0.17) * r, -0.42 * r);
    ctx.closePath();
    ctx.fill();
    line(r * 0.5);
  }
  if (!u.flash) {
    ctx.fillStyle = coat.light; // museau plus clair
    ctx.beginPath();
    ctx.ellipse(1.12 * r, -0.03 * r, 0.18 * r, 0.07 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(1.33 * r, -0.12 * r, 0.07 * r, 0.055 * r, 0, 0, TAU);
  ctx.fill();
  // œil qui luit (violet pour un Alpha), sourcil froncé chez le sauvage
  const iris = u.alpha ? '#B48CFF' : coat.eye, ex = 0.92 * r, ey = -0.27 * r, es = 0.08 * r;
  ctx.save();
  ctx.shadowColor = iris;
  ctx.shadowBlur = r * 0.35;
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(ex + es * 0.2, ey, es * 0.45, es * 0.8, 0, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.7);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.6, ey - es * 1.9);
    ctx.lineTo(ex + es * 1.3, ey - es * 0.9);
    ctx.stroke();
  }
}

/** Araignée sylvestre : rapide et venimeuse (zone 2). */
export function spider(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const legC = u.flash ? '#FFFFFF' : '#8A6FA3';
  // 4 pattes par côté, articulées (hanche → genou → pied), qui alternent en marchant
  const leg = (hx: number, hy: number, kx: number, ky: number, fx: number, fy: number) => {
    for (const [c, w] of [['rgba(12,18,16,0.85)', 0.16], [legC, 0.09]] as const) {
      ctx.strokeStyle = c;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = r * w;
      ctx.beginPath();
      ctx.moveTo(hx * r, hy * r);
      ctx.lineTo(kx * r, ky * r);
      ctx.lineTo(fx * r, fy * r);
      ctx.stroke();
    }
  };
  const spread = [0.75, 0.3, -0.25, -0.75];
  const legsSide = (side: number) => {
    for (let i = 0; i < 4; i++) {
      const walk = Math.sin(u.t * 12 + u.seed + i * 1.7 + (side > 0 ? Math.PI : 0)) * 0.1;
      const hx = 0.35 - i * 0.12, d = spread[i] + walk;
      if (side < 0) leg(hx, -0.1, hx + d * 0.9, -0.85, hx + d * 1.6, 0.25); // pattes du fond
      else leg(hx, 0.2, hx + d * 0.9, 0.55, hx + d * 1.5, 0.85); // pattes du devant
    }
  };
  legsSide(-1);
  // abdomen
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(-0.42 * r, 0.0, 0.7 * r, 0.58 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  // motif sablier ambre
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#F0B64A';
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, -0.22 * r);
  ctx.lineTo(-0.22 * r, -0.22 * r);
  ctx.lineTo(-0.42 * r, 0.0);
  ctx.lineTo(-0.22 * r, 0.22 * r);
  ctx.lineTo(-0.62 * r, 0.22 * r);
  ctx.lineTo(-0.42 * r, 0.0);
  ctx.closePath();
  ctx.fill();
  // céphalothorax
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0.42 * r, 0.06 * r, 0.42 * r, 0.36 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  legsSide(1);
  // crochets
  taper(ctx, r, [0.78, 0.22, 0.95, 0.3, 0.95, 0.45, 0.85, 0.5], 0.07, 0.03, u.flash ? '#FFFFFF' : '#D9CFB8');
  // grappe d'yeux
  ctx.fillStyle = u.alpha ? '#B48CFF' : '#E8693F';
  for (const [ex, ey, er] of [[0.55, -0.05, 0.08], [0.72, -0.02, 0.08], [0.5, 0.1, 0.05], [0.68, 0.12, 0.05]] as const) {
    ctx.beginPath();
    ctx.moveTo(ex * r + er * r, ey * r);
    ctx.arc(ex * r, ey * r, er * r, 0, TAU);
    ctx.fill();
  }
}

/** Luciole : gibier de nuit des Bois profonds ; abdomen lumineux qui pulse, ailes qui battent (elle flotte). */
export function firefly(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const pulse = 0.65 + Math.sin(u.t * 3.2 + u.seed) * 0.35, flap = Math.sin(u.t * 30 + u.seed) * 0.5 + 0.5;
  // halo de l'abdomen
  const g = ctx.createRadialGradient(-0.45 * r, 0.2 * r, 0, -0.45 * r, 0.2 * r, 1.4 * r);
  g.addColorStop(0, `rgba(228,240,122,${0.55 * pulse})`);
  g.addColorStop(1, 'rgba(228,240,122,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(-0.45 * r, 0.2 * r, 1.4 * r, 0, TAU);
  ctx.fill();
  // ailes arrière (translucides), battement rapide
  ctx.fillStyle = 'rgba(220,235,255,0.45)';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, -0.35 * r, 0.62 * r, (0.18 + 0.2 * flap) * r, k * 0.5 - 0.3, 0, TAU);
    ctx.fill();
  }
  // abdomen lumineux
  ctx.fillStyle = u.flash ? '#FFFFFF' : `rgb(${200 + 28 * pulse | 0},${215 + 25 * pulse | 0},${90 + 40 * pulse | 0})`;
  ctx.beginPath();
  ctx.ellipse(-0.45 * r, 0.2 * r, 0.5 * r, 0.36 * r, -0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,230,0.8)';
  ctx.beginPath();
  ctx.ellipse(-0.55 * r, 0.24 * r, 0.22 * r, 0.15 * r, -0.25, 0, TAU);
  ctx.fill();
  // thorax et tête sombres
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#3B3326';
  ctx.beginPath();
  ctx.ellipse(0.15 * r, 0, 0.36 * r, 0.3 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#C8553D';
  ctx.beginPath();
  ctx.arc(0.52 * r, -0.05 * r, 0.24 * r, 0, TAU);
  ctx.fill();
  // antennes
  ctx.strokeStyle = '#3B3326';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0.6 * r, -0.22 * r);
  ctx.quadraticCurveTo(0.75 * r, -0.6 * r, 0.95 * r, -0.62 * r);
  ctx.moveTo(0.5 * r, -0.24 * r);
  ctx.quadraticCurveTo(0.55 * r, -0.65 * r, 0.72 * r, -0.75 * r);
  ctx.stroke();
  // ailes avant, par-dessus
  ctx.fillStyle = 'rgba(235,245,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(0.0, -0.42 * r, 0.55 * r, (0.14 + 0.18 * (1 - flap)) * r, -0.5, 0, TAU);
  ctx.fill();
  eyes(ctx, 0.6 * r, -0.08 * r, 0.12 * r, 0.06 * r, '#1A1A10', false); // gibier paisible : jamais de sourcils froncés
}

/**
 * Tréant (la sentinelle des sapins) : trois étages de sapin en capuche, le visage dans leur ombre (deux yeux verts
 * qui luisent), des bras-branches hérissés d'aiguilles, du lichen sur le tronc et des pattes-racines qui marchent.
 */
export function treant(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const t = u.t + u.seed, sway = Math.sin(t * 2) * r * 0.08, white = u.flash ? '#FFFFFF' : null;
  // pattes-racines (avec une radicelle chacune)
  ctx.strokeStyle = white ?? '#3E2C1C';
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const s = -1 + (2 * i) / 3, lift = Math.max(0, Math.sin(t * 6 + i * 2)) * (u.moving ? 0.12 : 0.03) * r;
    ctx.lineWidth = r * (0.2 - Math.abs(s) * 0.04);
    ctx.beginPath();
    ctx.moveTo(s * r * 0.4, r * 0.35);
    ctx.quadraticCurveTo(s * r * 0.75, r * 0.55 - lift, s * r, r * 0.8 - lift);
    ctx.stroke();
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(s * r * 0.85, r * 0.72 - lift);
    ctx.lineTo(s * r * 1.15 + 2, r * 0.68 - lift);
    ctx.stroke();
  }
  // bras-branches hérissés d'aiguilles
  for (const s of [-1, 1]) {
    ctx.strokeStyle = white ?? '#3E2C1C';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * r * 0.5, r * 0.05);
    ctx.quadraticCurveTo(s * r * 1.05, 0, s * r * 1.25, -r * 0.3 + sway * s);
    ctx.stroke();
    ctx.strokeStyle = white ?? '#2F5A3A';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = 0.35 + k * 0.12, bx = s * r * (0.5 + 0.75 * a), by = r * 0.05 - r * 0.35 * a * a + sway * s * a;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + s * r * 0.08, by - r * 0.16);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + s * r * 0.1, by + r * 0.1);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // tronc, ses sillons d'écorce et son lichen
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-r * 0.55, -r * 0.45, r * 1.1, r * 1.05, r * 0.25);
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = 'rgba(30,20,10,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = -r * 0.45 + (r * 0.9 * (i + 0.5)) / 4, w = Math.sin(i * 2.7) * r * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.2 + Math.abs(Math.sin(i)) * r * 0.15);
    ctx.bezierCurveTo(x + w, r * 0.06, x - w, r * 0.29, x + w * 0.5, r * 0.55);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = white ?? 'rgba(170,200,150,0.55)';
  for (const [lx, ly] of [[-0.38, 0.3], [-0.3, 0.38], [0.4, 0.05]]) {
    ctx.beginPath();
    ctx.arc(lx * r, ly * r, r * 0.06, 0, TAU);
    ctx.fill();
  }
  // capuche de sapin : un étage, le visage dans son ombre, puis les deux autres
  const tier = (y: number, w: number, h: number, dark: string, light: string) => {
    ctx.fillStyle = white ?? dark;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(0, y - h);
    ctx.lineTo(w, y);
    for (let i = 4; i >= 0; i--) ctx.lineTo(-w + (2 * w * i) / 4, y + (i % 2 ? r * 0.08 : 0));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = white ?? light;
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, y - h * 0.75);
    ctx.lineTo(0, y - h);
    ctx.lineTo(-w * 0.55, y - h * 0.1);
    ctx.closePath();
    ctx.fill();
  };
  tier(-r * 0.15, r * 0.95, r * 0.75, '#23462E', '#3B6B47');
  ctx.fillStyle = 'rgba(10,16,12,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.18, r * 0.5, r * 0.18, 0, 0, Math.PI);
  ctx.fill();
  // yeux qui luisent (violets pour un Alpha)
  const eye = u.alpha ? '#B48CFF' : '#96E678', glow = 0.25 + Math.sin(t * 4) * 0.1;
  for (const s of [-1, 1]) {
    ctx.globalAlpha = glow;
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(s * r * 0.2, -r * 0.06, r * 0.18, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(s * r * 0.2, -r * 0.06, r * 0.07, 0, TAU);
    ctx.fill();
  }
  tier(-r * 0.6 + sway * 0.3, r * 0.75, r * 0.7, '#2A5236', '#447A50');
  tier(-r * 1.05 + sway * 0.6, r * 0.52, r * 0.65, '#2F5A3A', '#4E8A5A');
  // une pomme de pin accrochée
  ctx.fillStyle = white ?? '#7A5230';
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.2, r * 0.07, r * 0.1, 0.3, 0, TAU);
  ctx.fill();
}

/**
 * Bigfoot (Bois profonds, l'hiver) : grand primate debout, à longs poils roux sombre en mèches, de très grands pieds nus,
 * de longs bras qui balancent, un crâne en pointe, le visage gris dans l'ombre des arcades ; de la neige sur la tête et
 * les épaules, et la buée de son souffle dans le froid.
 */
export function bigfoot(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => whiteIf(u, c);
  const fur = W('#7A5A44'), shade = W('#5A4030'), dark = W('#3E2C20'), skin = W('#4A403A'), light = W('#9A7A5C'), snow = W('#F2F6FA');
  const g = gait(u, 6), breath = Math.sin(u.t * 1.8 + u.seed) * r * 0.02, sway = u.moving ? Math.sin(u.t * 6 + u.seed) * 0.05 : 0;
  // jambes, la plus éloignée d'abord, et leurs grands pieds
  const leg = (i: number, x: number, col: string) => {
    const lift = g[i].lift * 0.1 * r, swing = g[i].a * 0.18 * r;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.3 * r;
    ctx.beginPath();
    ctx.moveTo(x, 0.15 * r);
    ctx.lineTo(x + swing, 0.62 * r - lift);
    ctx.stroke();
    blot(ctx, x + swing + 0.1 * r, 0.7 * r - lift, 0.24 * r, 0.09 * r, skin);
    blot(ctx, x + swing + 0.04 * r, 0.66 * r - lift, 0.16 * r, 0.06 * r, col);
  };
  // long bras qui balance, la main près du genou
  const arm = (i: number, sx: number, col: string) => {
    const hx = sx + g[i].a * 0.22 * r + 0.08 * r, hy = 0.3 * r - Math.abs(g[i].a) * 0.05 * r;
    ctx.lineCap = 'round';
    for (const [c, w] of [['rgba(12,18,16,0.75)', 0.34], [col, 0.24]] as const) { // cerné, pour qu'il se détache du corps
      ctx.strokeStyle = c;
      ctx.lineWidth = w * r;
      ctx.beginPath();
      ctx.moveTo(sx, -0.45 * r + breath);
      ctx.quadraticCurveTo(sx + 0.16 * r, -0.05 * r, hx, hy);
      ctx.stroke();
    }
    blot(ctx, hx + 0.03 * r, hy + 0.06 * r, 0.12 * r, 0.1 * r, skin);
  };
  leg(0, -0.18 * r, dark);
  arm(1, -0.36 * r, dark);
  leg(2, 0.16 * r, shade);
  ctx.save();
  ctx.rotate(sway);
  // corps hirsute : bord en mèches
  const body = (grow: number) => {
    ctx.beginPath();
    for (let k = 0; k <= 22; k++) {
      const a = (k / 22) * TAU, rr = 1 + (k % 2 ? 0.07 : -0.02);
      const x = Math.cos(a) * (0.5 * r + grow) * rr, y = -0.22 * r + breath + Math.sin(a) * (0.62 * r + grow) * rr;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  ctx.fillStyle = fur;
  body(0);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = fur;
  body(-1);
  ctx.fill();
  blot(ctx, 0.14 * r, -0.12 * r + breath, 0.26 * r, 0.36 * r, light, 0.1); // poitrail plus clair
  if (!u.flash) {
    ctx.strokeStyle = 'rgba(40,26,18,0.45)'; // mèches
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const x = -0.38 * r + k * 0.11 * r, y = -0.1 * r + (k % 3) * 0.12 * r;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 0.03 * r, y + 0.16 * r);
    }
    ctx.stroke();
  }
  // tête : crâne en pointe, visage gris, arcades lourdes
  const hx = 0.14 * r, hy = -0.92 * r + breath;
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(hx - 0.3 * r, hy + 0.1 * r);
  ctx.quadraticCurveTo(hx - 0.32 * r, hy - 0.3 * r, hx - 0.04 * r, hy - 0.42 * r);
  ctx.quadraticCurveTo(hx + 0.28 * r, hy - 0.3 * r, hx + 0.32 * r, hy + 0.08 * r);
  ctx.quadraticCurveTo(hx, hy + 0.32 * r, hx - 0.3 * r, hy + 0.1 * r);
  ctx.fill();
  ink(ctx, r);
  ctx.fill();
  blot(ctx, hx + 0.1 * r, hy + 0.04 * r, 0.2 * r, 0.17 * r, skin);
  blot(ctx, hx + 0.1 * r, hy - 0.08 * r, 0.22 * r, 0.06 * r, dark); // arcades
  if (!u.flash) {
    ctx.fillStyle = u.wild ? '#E8C25A' : '#F2EAD8';
    ctx.beginPath();
    ctx.arc(hx + 0.03 * r, hy - 0.01 * r, 0.035 * r, 0, TAU);
    ctx.arc(hx + 0.19 * r, hy - 0.01 * r, 0.035 * r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,10,0.8)'; // bouche
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(hx + 0.04 * r, hy + 0.13 * r);
    ctx.lineTo(hx + 0.2 * r, hy + 0.12 * r);
    ctx.stroke();
  }
  // neige sur le crâne et les épaules
  blot(ctx, hx - 0.06 * r, hy - 0.33 * r, 0.14 * r, 0.06 * r, snow, -0.4);
  blot(ctx, -0.28 * r, -0.72 * r + breath, 0.18 * r, 0.06 * r, snow, -0.5);
  blot(ctx, 0.36 * r, -0.62 * r + breath, 0.13 * r, 0.05 * r, snow, 0.5);
  ctx.restore();
  arm(3, 0.3 * r, shade);
  // buée du souffle dans le froid
  if (!u.flash) {
    // bleutée et cernée d'un trait clair-obscur : elle se voit aussi sur la neige
    for (let k = 0; k < 4; k++) {
      const p = (u.t * 0.6 + u.seed * 0.1 + k / 4) % 1, a = Math.sin(Math.min(1, p * 4) * Math.PI / 2) * (1 - p);
      const bx = hx + (0.42 + p * 0.6) * r, by = hy + (0.12 - p * 0.35) * r, rx = (0.08 + p * 0.16) * r, ry = (0.06 + p * 0.11) * r;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, 0, TAU);
      ctx.fillStyle = `rgba(214,228,242,${0.85 * a})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(110,135,160,${0.55 * a})`;
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.stroke();
    }
  }
}
