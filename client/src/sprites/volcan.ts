// Créatures des Entrailles du volcan : salamandre (et sa queue), chauve-souris de cendre, tortue-volcan.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, fineInk, gait, ink, jagged, type Ctx, type UnitLook } from './outils.ts';

// ───────────────────────── Entrailles du volcan ─────────────────────────

/** Lueur de lave qui bat doucement (0,65 à 1), décalée d'une bête à l'autre. */
const lavaPulse = (u: UnitLook, speed = 2.2) => 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(u.t * speed + u.seed));

/** Point de lave incandescent : halo, cœur clair. */
export const ember = (ctx: Ctx, x: number, y: number, rr: number, glow: number, flash: boolean) => {
  if (flash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
    return;
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.9);
  g.addColorStop(0, `rgba(255,236,170,${glow})`);
  g.addColorStop(0.35, `rgba(255,150,70,${glow})`);
  g.addColorStop(1, 'rgba(232,90,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr * 1.9, 0, TAU);
  ctx.fill();
};

/** Œil qui luit (violet pour un Alpha) avec sa pupille, sourcil froncé chez le sauvage. slit : pupille fendue. */
const lavaEye = (ctx: Ctx, u: UnitLook, ex: number, ey: number, es: number, iris: string, slit: boolean) => {
  const c = u.alpha ? '#B48CFF' : iris;
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = es * 4;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  if (slit) ctx.ellipse(ex + es * 0.15, ey, es * 0.22, es * 0.85, 0, 0, TAU);
  else ctx.arc(ex + es * 0.2, ey, es * 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(ex - es * 0.35, ey - es * 0.35, es * 0.22, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.7);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.6, ey - es * 1.9);
    ctx.lineTo(ex + es * 1.4, ey - es * 0.9);
    ctx.stroke();
  }
};

const SALAMANDER = { shade: '#3E2C27', dark: '#241916', belly: '#9A7460', light: '#7E5E50' };

/**
 * Salamandre de braise : long lézard au ras du sol. Queue effilée qui ondule (d'un seul tenant avec le corps), pattes
 * articulées à trois griffes qui trottinent (celles du fond plus sombres), écailles, ventre clair, une fissure de lave le
 * long de l'échine ponctuée de taches incandescentes, collerette épineuse, œil jaune fendu qui luit. La Salamandre-Mère
 * porte une crête de flammes vives d'où montent des braises.
 */
export function salamander(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash;
  const skin = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : SALAMANDER.shade, dark = f ? '#FFFFFF' : SALAMANDER.dark;
  const glow = lavaPulse(u, 3), boss = !!SPECIES[u.species]?.boss;
  const wig = (k: number) => Math.sin(u.t * 6 + u.seed - k * 1.6) * 0.22 * r * k; // ondulation, plus forte vers le bout
  const g = gait(u, 12);
  // queue : une bande effilée, de la croupe à la pointe
  const tail: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    tail.push([-0.55 * r - k * 1.35 * r, 0.12 * r - Math.sin(k * Math.PI) * 0.12 * r + wig(k), (0.24 - 0.21 * k) * r]);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  tail.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w) : ctx.moveTo(x, y - w)));
  for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] + tail[i][2]);
  ctx.closePath();
  ctx.fill();
  fineInk(ctx, r, 0.8);
  // dessous de la queue dans l'ombre
  ctx.fillStyle = shade;
  ctx.beginPath();
  tail.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y + w * 0.2) : ctx.moveTo(x, y + w * 0.2)));
  for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] + tail[i][2] * 0.95);
  ctx.closePath();
  ctx.fill();
  // une patte : cuisse, jambe, trois griffes
  const leg = (hx: number, hy: number, sw: number, col: string) => {
    const kx = hx + sw * 0.12 * r, ky = hy + 0.18 * r, fx = hx + sw * 0.22 * r + 0.06 * r, fy = hy + 0.36 * r;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.16 * r;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx - 0.08 * r, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.strokeStyle = f ? '#FFFFFF' : '#140E0C';
    ctx.lineWidth = Math.max(1, 0.045 * r);
    ctx.beginPath();
    for (const d of [-0.07, 0, 0.07]) {
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 0.1 * r + d * r, fy + 0.04 * r + Math.abs(d) * r * 0.3);
    }
    ctx.stroke();
  };
  leg(0.42 * r, 0.12 * r, g[1].a, dark);
  leg(-0.42 * r, 0.14 * r, g[0].a, dark);
  // corps, ventre clair, ombre, reflet d'échine
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-0.05 * r, 0.06 * r, 0.82 * r, 0.38 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = SALAMANDER.belly;
    ctx.beginPath();
    ctx.ellipse(0.02 * r, 0.3 * r, 0.62 * r, 0.11 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, 0.2 * r, 0.7 * r, 0.06 * r, 0, 0, TAU);
    ctx.fill();
    // écailles : de petits croissants sombres en quinconce
    ctx.strokeStyle = 'rgba(20,12,10,0.45)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const x = (-0.65 + i * 0.16) * r, y = (i % 2 ? 0.0 : 0.1) * r;
      ctx.moveTo(x - 0.05 * r, y);
      ctx.quadraticCurveTo(x, y + 0.05 * r, x + 0.05 * r, y);
    }
    ctx.stroke();
  }
  // fissure de lave le long de l'échine, et ses taches incandescentes (jusque sur la queue)
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(232,105,63,${0.8 * glow})`;
  ctx.lineWidth = Math.max(1.2, 0.05 * r);
  ctx.beginPath();
  ctx.moveTo(tail[6][0], tail[6][1] - tail[6][2] * 0.3);
  for (let i = 5; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] - tail[i][2] * 0.4);
  ctx.quadraticCurveTo(-0.2 * r, -0.36 * r, 0.5 * r, -0.22 * r);
  ctx.stroke();
  for (const [x, y, rr] of [[-0.45, -0.24, 0.09], [-0.15, -0.3, 0.11], [0.15, -0.28, 0.1], [0.42, -0.2, 0.07]]) ember(ctx, x * r, y * r, rr * r, glow, f);
  for (const i of [2, 4, 7]) ember(ctx, tail[i][0], tail[i][1] - tail[i][2] * 0.35, tail[i][2] * 0.4, glow, f);
  if (!f) ember(ctx, tail[10][0], tail[10][1], 0.07 * r, glow, false); // le bout de la queue rougeoie
  // pattes de devant
  leg(0.5 * r, 0.18 * r, g[3].a, skin);
  leg(-0.32 * r, 0.2 * r, g[2].a, skin);
  // crête de flammes de la Mère
  if (boss) {
    for (let k = 0; k < 7; k++) {
      const x = (-0.7 + k * 0.22) * r, base = -0.28 * r - Math.sin((k / 6) * Math.PI) * 0.08 * r, h = (0.3 + 0.12 * Math.sin(u.t * 9 + k * 1.3)) * r;
      ctx.fillStyle = f ? '#FFFFFF' : '#C2401E';
      ctx.beginPath();
      ctx.moveTo(x - 0.1 * r, base + 0.04 * r);
      ctx.quadraticCurveTo(x - 0.06 * r, base - h * 0.6, x + Math.sin(u.t * 7 + k) * 0.04 * r, base - h);
      ctx.quadraticCurveTo(x + 0.08 * r, base - h * 0.5, x + 0.1 * r, base + 0.04 * r);
      ctx.closePath();
      ctx.fill();
      if (!f) {
        ctx.fillStyle = '#FFB25C';
        ctx.beginPath();
        ctx.moveTo(x - 0.05 * r, base);
        ctx.quadraticCurveTo(x - 0.02 * r, base - h * 0.45, x, base - h * 0.7);
        ctx.quadraticCurveTo(x + 0.04 * r, base - h * 0.4, x + 0.05 * r, base);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (let k = 0; k < 4; k++) {
      const g = (u.t * 0.7 + k / 4) % 1;
      ctx.fillStyle = `rgba(255,190,100,${0.9 * (1 - g)})`;
      ctx.beginPath();
      ctx.arc((-0.5 + k * 0.3 + Math.sin(u.t * 3 + k) * 0.05) * r, (-0.6 - g * 0.6) * r, 0.035 * r, 0, TAU);
      ctx.fill();
    }
  }
  // cou et tête : un museau plat en coin, mâchoire, narine, collerette épineuse
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.55 * r, -0.26 * r);
  ctx.quadraticCurveTo(0.95 * r, -0.36 * r, 1.25 * r, -0.12 * r);
  ctx.quadraticCurveTo(1.42 * r, 0.0 * r, 1.3 * r, 0.08 * r);
  ctx.quadraticCurveTo(0.95 * r, 0.22 * r, 0.6 * r, 0.2 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(20,12,10,0.6)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    ctx.moveTo(0.9 * r, 0.06 * r);
    ctx.quadraticCurveTo(1.12 * r, 0.06 * r, 1.32 * r, 0.03 * r); // la bouche
    ctx.stroke();
    ctx.fillStyle = SALAMANDER.light;
    ctx.beginPath();
    ctx.ellipse(0.98 * r, -0.2 * r, 0.22 * r, 0.05 * r, -0.1, 0, TAU); // reflet du crâne
    ctx.fill();
  }
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(1.3 * r, -0.08 * r, 0.025 * r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shade;
  for (const [sx, sy, a] of [[0.62, -0.28, -2.3], [0.66, -0.06, -2.9], [0.64, 0.14, 2.6]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx * r, sy * r);
    ctx.lineTo(sx * r + Math.cos(a) * 0.2 * r, sy * r + Math.sin(a) * 0.2 * r);
    ctx.lineTo(sx * r + 0.05 * r, sy * r + 0.08 * r);
    ctx.closePath();
    ctx.fill();
  }
  lavaEye(ctx, u, 1.0 * r, -0.14 * r, 0.075 * r, '#FFD27A', true);
  // la langue fourchue, de temps en temps
  if (Math.sin(u.t * 2 + u.seed * 3) > 0.85) {
    ctx.strokeStyle = f ? '#FFFFFF' : '#E8693F';
    ctx.lineWidth = Math.max(1, 0.04 * r);
    ctx.beginPath();
    ctx.moveTo(1.32 * r, 0.04 * r);
    ctx.lineTo(1.55 * r, 0.03 * r);
    ctx.lineTo(1.64 * r, -0.04 * r);
    ctx.moveTo(1.55 * r, 0.03 * r);
    ctx.lineTo(1.64 * r, 0.09 * r);
    ctx.stroke();
  }
}

/**
 * Chauve-souris de cendre : ailes à doigts osseux, membrane plus sombre près du corps, trouée de brûlures dont le bord
 * rougeoie ; corps de fourrure en touffes, poitrail de cendre claire, grandes oreilles au creux rouge, feuille nasale,
 * gueule ouverte et crocs, yeux de braise, griffes des pieds ; elle sème des étincelles et des flocons de cendre.
 */
export function ashBat(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, glow = lavaPulse(u, 4), boss = !!SPECIES[u.species]?.boss;
  const fur = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : '#2E292D', bone = f ? '#FFFFFF' : '#1E1A1E';
  const flap = Math.sin(u.t * 14 + u.seed);
  // étincelles et flocons de cendre qui tombent
  for (let k = 0; k < 6; k++) {
    const g = (u.t * 0.9 + k / 6 + u.seed * 0.13) % 1, x = (Math.sin(k * 2.7 + u.seed) * 0.7 - 0.15) * r, y = (0.55 + g * 1.4) * r;
    if (k % 2) {
      ctx.fillStyle = `rgba(255,170,80,${0.85 * (1 - g)})`;
      ctx.beginPath();
      ctx.arc(x, y, (0.065 - g * 0.04) * r, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(150,140,140,${0.6 * (1 - g)})`;
      ctx.fillRect(x, y, 0.06 * r, 0.03 * r);
    }
  }
  // ailes : le bras, trois doigts, la membrane festonnée entre eux
  for (const sd of [-1, 1]) {
    const lift = flap * 0.5 * r;
    const shoulder = [sd * 0.25 * r, -0.12 * r], elbow = [sd * 0.75 * r, -0.5 * r - lift * 0.5];
    const tips = [[sd * 1.6 * r, -0.55 * r - lift], [sd * 1.45 * r, 0.05 * r - lift * 0.5], [sd * 1.0 * r, 0.35 * r - lift * 0.2]];
    const hip = [sd * 0.3 * r, 0.3 * r];
    // membrane
    const mem = ctx.createLinearGradient(0, 0, sd * 1.6 * r, 0);
    mem.addColorStop(0, f ? '#FFFFFF' : '#1E1A1E');
    mem.addColorStop(1, f ? '#FFFFFF' : shade);
    ctx.fillStyle = mem;
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1]);
    ctx.lineTo(elbow[0], elbow[1]);
    ctx.lineTo(tips[0][0], tips[0][1]);
    const pts = [tips[0], tips[1], tips[2], hip];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      ctx.quadraticCurveTo((ax + bx) / 2 - sd * 0.1 * r, (ay + by) / 2 - 0.12 * r, bx, by); // feston vers l'intérieur
    }
    ctx.closePath();
    ctx.fill();
    fineInk(ctx, r, 0.9);
    // bord des festons qui rougeoie
    ctx.save();
    if (!f) {
      ctx.shadowColor = '#FF6A2A';
      ctx.shadowBlur = r * 0.4;
    }
    ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${0.8 * glow})`;
    ctx.lineWidth = Math.max(1.2, 0.06 * r);
    ctx.beginPath();
    ctx.moveTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      ctx.quadraticCurveTo((ax + bx) / 2 - sd * 0.1 * r, (ay + by) / 2 - 0.12 * r, bx, by);
    }
    ctx.stroke();
    ctx.restore();
    // trous de brûlure (le géant a les ailes en lambeaux)
    for (const [hx, hy, hr] of boss ? [[0.95, -0.15, 0.1], [1.25, -0.3, 0.07], [0.7, 0.05, 0.06]] : [[1.05, -0.2, 0.06]]) {
      const x = sd * hx * r, y = hy * r - lift * 0.5;
      ctx.fillStyle = f ? '#FFFFFF' : `rgba(255,150,70,${0.7 * glow})`;
      ctx.beginPath();
      ctx.arc(x, y, hr * r * 1.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,14,12,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, hr * r, 0, TAU);
      ctx.fill();
    }
    // os du bras et des doigts, griffe du pouce
    ctx.strokeStyle = bone;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.09 * r;
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1]);
    ctx.lineTo(elbow[0], elbow[1]);
    ctx.stroke();
    ctx.lineWidth = 0.045 * r;
    ctx.beginPath();
    for (const [tx, ty] of tips) {
      ctx.moveTo(elbow[0], elbow[1]);
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.fillStyle = f ? '#FFFFFF' : '#D8CFC0';
    ctx.beginPath();
    ctx.moveTo(elbow[0], elbow[1] - 0.02 * r);
    ctx.lineTo(elbow[0] + sd * 0.04 * r, elbow[1] - 0.16 * r);
    ctx.lineTo(elbow[0] + sd * 0.08 * r, elbow[1] - 0.02 * r);
    ctx.fill();
  }
  // griffes des pieds, repliées sous le corps
  ctx.strokeStyle = f ? '#FFFFFF' : '#D8CFC0';
  ctx.lineWidth = Math.max(1, 0.04 * r);
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    ctx.moveTo(sd * 0.14 * r, 0.48 * r);
    ctx.quadraticCurveTo(sd * 0.2 * r, 0.62 * r, sd * 0.1 * r, 0.64 * r);
  }
  ctx.stroke();
  // oreilles au creux rougeoyant
  for (const sd of [-1, 1]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(sd * 0.08 * r, -0.36 * r);
    ctx.quadraticCurveTo(sd * 0.2 * r, -0.95 * r, sd * 0.36 * r, -0.82 * r);
    ctx.quadraticCurveTo(sd * 0.4 * r, -0.5 * r, sd * 0.34 * r, -0.28 * r);
    ctx.closePath();
    ctx.fill();
    fineInk(ctx, r);
    if (!f) {
      ctx.fillStyle = `rgba(200,80,50,${0.6 + 0.3 * glow})`;
      ctx.beginPath();
      ctx.moveTo(sd * 0.15 * r, -0.4 * r);
      ctx.quadraticCurveTo(sd * 0.23 * r, -0.8 * r, sd * 0.31 * r, -0.72 * r);
      ctx.quadraticCurveTo(sd * 0.32 * r, -0.5 * r, sd * 0.28 * r, -0.36 * r);
      ctx.closePath();
      ctx.fill();
    }
  }
  // corps en touffes, poitrail clair, crinière de braises pour le géant
  ctx.fillStyle = fur;
  jagged(ctx, 0, 0.04 * r, 0.42 * r, 0.5 * r, 10);
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = 'rgba(176,166,166,0.5)';
    jagged(ctx, 0, 0.2 * r, 0.22 * r, 0.24 * r, 7, 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,16,18,0.4)';
    ctx.beginPath();
    ctx.ellipse(0.18 * r, 0.12 * r, 0.16 * r, 0.32 * r, 0.2, 0, TAU); // ombre du flanc
    ctx.fill();
  }
  if (boss) for (let k = 0; k < 6; k++) ember(ctx, Math.cos(-Math.PI + (k / 5) * Math.PI) * 0.4 * r, -0.3 * r + Math.sin(-Math.PI + (k / 5) * Math.PI) * 0.18 * r, 0.06 * r, glow, f);
  // yeux de braise, feuille nasale, gueule ouverte, crocs
  lavaEye(ctx, u, -0.15 * r, -0.14 * r, 0.075 * r, '#FF6A2A', false);
  lavaEye(ctx, u, 0.15 * r, -0.14 * r, 0.075 * r, '#FF6A2A', false);
  ctx.fillStyle = f ? '#FFFFFF' : '#5A4E52';
  ctx.beginPath();
  ctx.moveTo(-0.06 * r, -0.04 * r);
  ctx.lineTo(0, -0.14 * r);
  ctx.lineTo(0.06 * r, -0.04 * r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2A0E0C';
  ctx.beginPath();
  ctx.ellipse(0, 0.08 * r, 0.12 * r, 0.07 * r + Math.max(0, flap) * 0.02 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F2E8CF';
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    ctx.moveTo(sd * 0.1 * r, 0.03 * r);
    ctx.lineTo(sd * 0.065 * r, 0.16 * r);
    ctx.lineTo(sd * 0.03 * r, 0.04 * r);
  }
  ctx.fill();
}

const TORTOISE = { skin: '#7A6452', skinDark: '#4E3E32', rim: '#2A221E', top: '#6A584C' };

/**
 * Tortue-volcan : pattes d'éléphant écailleuses à grosses griffes, tête à bec et cou ridé, carapace d'écailles de
 * basalte (chacune ombrée, plus claire en haut) jointes par des fissures de lave qui luisent, rebord d'écailles
 * marginales ; sur le dos, un petit volcan rocheux à arêtes, sa coulée, sa fumée. Quand elle charge son tir, le
 * cratère s'embrase et crache des étincelles.
 */
export function lavaTortoise(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash;
  const shell = f ? '#FFFFFF' : fill, skin = f ? '#FFFFFF' : TORTOISE.skin, skinDark = f ? '#FFFFFF' : TORTOISE.skinDark, rim = f ? '#FFFFFF' : TORTOISE.rim;
  const charge = u.charge ?? 0, glow = Math.min(1, lavaPulse(u, 1.6) + charge * 0.6), g = gait(u, 5), step = u.moving ? Math.sin(u.t * 10 + u.seed) * 0.03 * r : 0;
  // une patte trapue : écailles en travers, trois griffes
  const leg = (lx: number, ly: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(lx - 0.17 * r, ly, 0.34 * r, 0.38 * r, [0.1 * r, 0.1 * r, 0.06 * r, 0.06 * r]);
    ctx.fill();
    fineInk(ctx, r, 0.7);
    if (!f) {
      ctx.strokeStyle = 'rgba(20,14,10,0.4)';
      ctx.lineWidth = Math.max(1, 0.03 * r);
      ctx.beginPath();
      for (const k of [0.12, 0.22]) {
        ctx.moveTo(lx - 0.14 * r, ly + k * r);
        ctx.quadraticCurveTo(lx, ly + (k + 0.04) * r, lx + 0.14 * r, ly + k * r);
      }
      ctx.stroke();
    }
    ctx.fillStyle = f ? '#FFFFFF' : '#E3D6BC';
    for (const d of [-0.1, 0, 0.1]) {
      ctx.beginPath();
      ctx.ellipse(lx + d * r, ly + 0.38 * r, 0.045 * r, 0.035 * r, 0, 0, TAU);
      ctx.fill();
    }
  };
  // en toupie (rentrée dans sa carapace) : ni pattes ni tête, la carapace tourne sur elle-même, des traînées autour
  const spin = !!u.shell;
  if (spin) {
    ctx.save();
    ctx.translate(0, 0.3 * r);
    ctx.rotate(Math.sin(u.t * 9) * 0.12);
    ctx.scale(0.86 + 0.14 * Math.cos(u.t * 18), 1);
    ctx.translate(0, -0.3 * r);
  } else {
    leg(0.55 * r + g[3].a * 0.05 * r, 0.26 * r - g[3].lift * 0.06 * r, skinDark);
    leg(-0.6 * r + g[2].a * 0.05 * r, 0.26 * r - g[2].lift * 0.06 * r, skinDark);
  }
  // cou ridé et tête à bec
  const hy = 0.12 * r + step * 0.5;
  if (!spin) {
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.7 * r, -0.02 * r);
  ctx.quadraticCurveTo(1.0 * r, hy - 0.22 * r, 1.25 * r, hy - 0.16 * r);
  ctx.quadraticCurveTo(1.46 * r, hy - 0.08 * r, 1.42 * r, hy + 0.06 * r);
  ctx.lineTo(1.3 * r, hy + 0.14 * r);
  ctx.quadraticCurveTo(1.0 * r, hy + 0.2 * r, 0.72 * r, 0.3 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(30,20,14,0.45)';
    ctx.lineWidth = Math.max(1, 0.03 * r);
    ctx.beginPath();
    for (const x of [0.82, 0.92]) {
      ctx.moveTo(x * r, hy - 0.1 * r);
      ctx.quadraticCurveTo((x + 0.04) * r, hy + 0.02 * r, x * r, hy + 0.14 * r);
    }
    ctx.moveTo(1.26 * r, hy + 0.04 * r);
    ctx.lineTo(1.42 * r, hy + 0.04 * r); // la fente du bec
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(1.15 * r, hy - 0.12 * r, 0.14 * r, 0.04 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  lavaEye(ctx, u, 1.18 * r, hy - 0.06 * r, 0.06 * r, '#FF8A3D', false);
  }
  // rebord de la carapace : écailles marginales
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(0, 0.3 * r, 1.02 * r, 0.25 * r, 0, 0, TAU);
  ctx.fill();
  fineInk(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(70,58,50,0.9)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    for (let k = -4; k <= 4; k++) {
      const x = k * 0.22 * r;
      ctx.moveTo(x, 0.34 * r);
      ctx.lineTo(x * 1.04, 0.52 * r);
    }
    ctx.stroke();
  }
  // dôme : chaque écaille, plus claire en haut ; les fissures de lave entre elles
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(0, 0.28 * r, 0.92 * r, 0.82 * r, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  const plates: [number, number][][] = [
    [[-0.88, 0.2], [-0.82, -0.12], [-0.5, -0.06], [-0.45, 0.24]],
    [[-0.82, -0.12], [-0.6, -0.42], [-0.32, -0.36], [-0.5, -0.06]],
    [[-0.45, 0.24], [-0.5, -0.06], [0.0, 0.02], [0.02, 0.26]],
    [[-0.5, -0.06], [-0.32, -0.36], [0.32, -0.36], [0.5, -0.06], [0.0, 0.02]],
    [[0.02, 0.26], [0.0, 0.02], [0.5, -0.06], [0.45, 0.24]],
    [[0.5, -0.06], [0.32, -0.36], [0.6, -0.42], [0.82, -0.12]],
    [[0.45, 0.24], [0.5, -0.06], [0.82, -0.12], [0.88, 0.2]],
  ];
  for (const [i, p] of plates.entries()) {
    const cy = p.reduce((a, q) => a + q[1], 0) / p.length;
    ctx.fillStyle = f ? '#FFFFFF' : cy < -0.15 ? TORTOISE.top : i % 2 ? shell : '#45382F';
    ctx.beginPath();
    p.forEach(([x, y], k) => (k ? ctx.lineTo(x * r * 0.92, y * r) : ctx.moveTo(x * r * 0.92, y * r)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  if (!f) {
    ctx.shadowColor = '#FF6A2A';
    ctx.shadowBlur = r * 0.35 * glow;
  }
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${glow})`;
  ctx.lineWidth = Math.max(1.5, 0.06 * r);
  ctx.lineJoin = 'round';
  for (const p of plates) {
    ctx.beginPath();
    p.forEach(([x, y], k) => (k ? ctx.lineTo(x * r * 0.92, y * r) : ctx.moveTo(x * r * 0.92, y * r)));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  // le petit volcan du dos : flancs rocheux à arêtes, cratère, coulée
  const vy = -0.4 * r;
  ctx.fillStyle = f ? '#FFFFFF' : '#2E2420';
  ctx.beginPath();
  ctx.moveTo(-0.4 * r, vy + 0.04 * r);
  ctx.lineTo(-0.2 * r, vy - 0.48 * r);
  ctx.quadraticCurveTo(0, vy - 0.56 * r, 0.2 * r, vy - 0.48 * r);
  ctx.lineTo(0.4 * r, vy + 0.04 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = '#463830';
    ctx.beginPath();
    ctx.moveTo(-0.38 * r, vy + 0.03 * r);
    ctx.lineTo(-0.19 * r, vy - 0.47 * r);
    ctx.lineTo(-0.08 * r, vy - 0.5 * r);
    ctx.lineTo(-0.16 * r, vy + 0.03 * r);
    ctx.closePath();
    ctx.fill(); // flanc éclairé
    ctx.strokeStyle = 'rgba(16,10,8,0.55)';
    ctx.lineWidth = Math.max(1, 0.03 * r);
    ctx.beginPath();
    for (const x of [-0.25, 0.05, 0.25]) {
      ctx.moveTo(x * 0.5 * r, vy - 0.48 * r);
      ctx.lineTo(x * r, vy + 0.02 * r);
    }
    ctx.stroke();
  }
  // coulée qui descend le flanc
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${glow})`;
  ctx.lineWidth = Math.max(1.2, 0.07 * r);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.06 * r, vy - 0.48 * r);
  ctx.quadraticCurveTo(0.16 * r, vy - 0.3 * r, 0.12 * r, vy - 0.12 * r);
  ctx.quadraticCurveTo(0.1 * r, vy, 0.24 * r, vy + 0.06 * r);
  ctx.stroke();
  // cratère : plus il charge, plus il brille
  const cg = ctx.createRadialGradient(0, vy - 0.5 * r, 0, 0, vy - 0.5 * r, (0.2 + charge * 0.25) * r);
  cg.addColorStop(0, f ? '#FFFFFF' : `rgba(255,240,180,${glow})`);
  cg.addColorStop(0.5, f ? '#FFFFFF' : `rgba(255,140,60,${glow})`);
  cg.addColorStop(1, 'rgba(232,90,40,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, vy - 0.5 * r, (0.2 + charge * 0.25) * r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = f ? '#FFFFFF' : '#1A120E';
  ctx.beginPath();
  ctx.ellipse(0, vy - 0.5 * r, 0.16 * r, 0.05 * r, 0, Math.PI, 0);
  ctx.fill();
  // fumée, et des étincelles quand le tir se prépare
  for (let k = 0; k < 3; k++) {
    const g = (u.t * (0.5 + charge) + k / 3 + u.seed * 0.1) % 1;
    ctx.fillStyle = `rgba(90,84,80,${0.5 * (1 - g)})`;
    ctx.beginPath();
    ctx.arc(Math.sin(k * 2 + u.t) * 0.08 * r + g * 0.15 * r, vy - (0.6 + g * 0.7) * r, (0.08 + g * 0.14) * r, 0, TAU);
    ctx.fill();
  }
  if (charge > 0) {
    for (let k = 0; k < 5; k++) {
      const g = (u.t * 2.2 + k / 5) % 1, a = -Math.PI / 2 + (k - 2) * 0.35;
      ctx.fillStyle = `rgba(255,210,120,${1 - g})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * g * 0.6 * r, vy - 0.5 * r + Math.sin(a) * g * 0.6 * r, 0.04 * r, 0, TAU);
      ctx.fill();
    }
  }
  if (spin) {
    ctx.restore();
    if (!f) {
      // traînées de vitesse et étincelles de lave qui gicle
      ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const a = u.t * 14 + (k * TAU) / 4;
        ctx.strokeStyle = `rgba(255,${150 + k * 20},80,0.55)`;
        ctx.lineWidth = Math.max(1.5, 0.06 * r);
        ctx.beginPath();
        ctx.ellipse(0, 0.1 * r, 1.15 * r, 0.75 * r, 0, a, a + 0.9);
        ctx.stroke();
      }
    }
    return;
  }
  // pattes de devant
  leg(0.65 * r, 0.34 * r + step, skin);
  leg(-0.5 * r, 0.34 * r - step, skin);
}

/**
 * Queue de salamandre tombée (renfort de la Salamandre-Mère) : elle se tortille seule, sa fissure de lave luisante, le
 * bout tranché qui brûle encore.
 */
export function salamanderTail(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, t = u.t + u.seed, skin = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : SALAMANDER.shade, glow = lavaPulse(u, 4);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    pts.push([0.9 * r - k * 2.4 * r, 0.3 * r + Math.sin(t * 9 - k * 5) * 0.28 * r * (0.3 + k), (0.42 - 0.36 * k) * r]);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w) : ctx.moveTo(x, y - w)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2]);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = shade;
  ctx.beginPath();
  pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y + w * 0.25) : ctx.moveTo(x, y + w * 0.25)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + pts[i][2] * 0.95);
  ctx.closePath();
  ctx.fill();
  if (f) return;
  // fissure de lave le long du dessus, taches incandescentes
  ctx.strokeStyle = `rgba(255,${Math.round(120 + 80 * glow)},60,${0.7 + 0.3 * glow})`;
  ctx.lineWidth = Math.max(1, 0.07 * r);
  ctx.beginPath();
  pts.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w * 0.45) : ctx.moveTo(x, y - w * 0.45)));
  ctx.stroke();
  for (let i = 2; i < 12; i += 3) {
    const [x, y, w] = pts[i];
    ctx.fillStyle = `rgba(255,200,90,${0.6 * glow})`;
    ctx.beginPath();
    ctx.ellipse(x, y - w * 0.1, w * 0.25, w * 0.18, 0, 0, TAU);
    ctx.fill();
  }
  // le bout tranché : une plaie de braise, et des flammèches
  const [cx, cy, cw] = pts[0];
  ctx.fillStyle = '#FFB347';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw * 0.35, cw * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFF0B0';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw * 0.15, cw * 0.5, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.6 + i / 3) % 1;
    ctx.fillStyle = `rgba(255,${Math.round(200 - 120 * k)},60,${0.8 * (1 - k)})`;
    ctx.beginPath();
    ctx.ellipse(cx + 0.1 * r + k * 0.15 * r, cy - k * 0.7 * r, (1 - k) * 0.12 * r, (1 - k) * 0.2 * r, 0, 0, TAU);
    ctx.fill();
  }
}
