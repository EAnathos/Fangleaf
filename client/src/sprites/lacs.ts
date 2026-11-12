// Créatures des Lacs brumeux : crapaud, serpent, crabe.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, fineInk, ink, type Ctx, type UnitLook } from './outils.ts';

// Tout en couleurs pleines, contour compris : une peau translucide se fondait dans la vase des Lacs brumeux.
const TOAD = {
  shade: '#4A6532', dark: '#33481F', wart: '#9DBB66', wartShade: '#56723A', wartLight: '#D6E6A8', blotch: '#3E5628',
  belly: '#E8DCA0', bellyShade: '#C9BC80', light: '#8DAA5C', crease: '#3A5226', web: '#2A3C1A', line: '#16200F', slime: '#7FA060',
};

/**
 * Crapaud-mortier (zone 5, tireur) : assis, cuisses repliées et pieds palmés, bras fins aux doigts ronds ; peau
 * verruqueuse (verrues en relief, taches sombres, glandes derrière les yeux), ventre crème, large bouche, narines,
 * yeux globuleux à pupille horizontale. Avant de tirer, il gonfle son sac vocal (tendu, luisant) et un filet de vase
 * perle au coin de la bouche. Le Crapaud-Roi porte une cape de nénuphar et une fleur d'eau.
 */
export function toad(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, puff = u.charge ?? 0, boss = !!SPECIES[u.species]?.boss;
  const skin = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : TOAD.shade, dark = f ? '#FFFFFF' : TOAD.dark;
  const breath = Math.sin(u.t * 4 + u.seed) * 0.03;
  const outline = (k = 1) => {
    ctx.strokeStyle = f ? '#FFFFFF' : TOAD.line;
    ctx.lineWidth = Math.max(1.5, r * 0.1 * k);
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  // pied palmé : trois orteils écartés, une palmure entre eux
  const foot = (x: number, y: number, s: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.04 * r);
    for (const a of [-0.5, 0, 0.5]) {
      const tx = x + Math.cos(a) * 0.3 * r * s, ty = y + 0.06 * r + Math.sin(a) * 0.1 * r * s;
      ctx.lineTo(tx, ty);
      ctx.arc(tx, ty, 0.04 * r * s, 0, TAU);
      ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.fillStyle = f ? '#FFFFFF' : TOAD.web;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.03 * r);
    ctx.lineTo(x + Math.cos(-0.5) * 0.28 * r * s, y + 0.06 * r + Math.sin(-0.5) * 0.1 * r * s);
    ctx.lineTo(x + Math.cos(0.5) * 0.28 * r * s, y + 0.06 * r + Math.sin(0.5) * 0.1 * r * s);
    ctx.closePath();
    ctx.fill();
  };
  const lp = u.leap ?? { ext: 0, reach: 0, crouch: 0 };
  // en plein bond : les deux longues pattes arrière se déplient loin derrière (cuisse, jambe, pied palmé)
  const leg = (hipX: number, hipY: number, s: number, col: string) => {
    if (lp.ext < 0.05) return;
    const e = lp.ext, kx = hipX - 0.35 * r * s * e, ky = hipY + 0.32 * r * e, fx = hipX - 0.95 * r * s * e, fy = hipY + 0.42 * r * e;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.26 * r * s;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kx, ky);
    ctx.stroke();
    ctx.lineWidth = 0.18 * r * s;
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    foot(fx, fy - 0.04 * r, s * 0.9, col);
  };
  leg(-0.55 * r, 0.3 * r, 0.9, dark);
  // patte arrière du fond, puis le corps
  if (lp.ext < 0.05) foot(-0.62 * r, 0.62 * r, 0.9, dark);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-0.95 * r, 0.5 * r);
  ctx.quadraticCurveTo(-1.08 * r * (1 + breath), -0.35 * r, -0.4 * r, -0.62 * r * (1 - breath));
  ctx.quadraticCurveTo(0.25 * r, -0.8 * r, 0.75 * r, -0.42 * r);
  ctx.quadraticCurveTo(1.1 * r, -0.2 * r, 1.05 * r, 0.12 * r);
  ctx.quadraticCurveTo(1.0 * r, 0.5 * r, 0.5 * r, 0.62 * r);
  ctx.lineTo(-0.6 * r, 0.64 * r);
  ctx.closePath();
  ctx.fill();
  outline();
  // ventre crème, ombre du flanc
  if (!f) {
    ctx.fillStyle = TOAD.belly;
    ctx.beginPath();
    ctx.ellipse(0.2 * r, 0.42 * r, 0.62 * r, 0.2 * r, -0.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TOAD.bellyShade;
    ctx.beginPath();
    ctx.ellipse(0.1 * r, 0.54 * r, 0.5 * r, 0.07 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-0.35 * r, 0.25 * r, 0.5 * r, 0.12 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  // cuisse repliée du premier plan (son pli dessiné en creux), et son pied
  if (!f) {
    ctx.strokeStyle = TOAD.crease;
    ctx.lineWidth = Math.max(1.2, 0.05 * r);
    ctx.beginPath();
    ctx.moveTo(-0.92 * r, 0.3 * r);
    ctx.quadraticCurveTo(-0.7 * r, -0.02 * r, -0.3 * r, 0.12 * r); // dessus de la cuisse
    ctx.quadraticCurveTo(-0.05 * r, 0.25 * r, -0.12 * r, 0.5 * r);
    ctx.stroke();
    ctx.fillStyle = TOAD.light;
    ctx.beginPath();
    ctx.ellipse(-0.55 * r, 0.16 * r, 0.22 * r, 0.05 * r, -0.35, 0, TAU);
    ctx.fill();
  }
  if (lp.ext < 0.05) foot(-0.38 * r, 0.66 * r, 1, skin);
  else leg(-0.4 * r, 0.38 * r, 1, skin);
  if (lp.reach > 0.05) {
    // bras tendus vers le sol pour se recevoir
    ctx.strokeStyle = skin;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.15 * r;
    ctx.beginPath();
    ctx.moveTo(0.55 * r, 0.45 * r);
    ctx.lineTo(0.55 * r + 0.32 * r * lp.reach, 0.45 * r + 0.32 * r * lp.reach);
    ctx.stroke();
    foot(0.55 * r + 0.32 * r * lp.reach, 0.45 * r + 0.3 * r * lp.reach, 0.6, skin);
  }
  // taches sombres et verrues en relief
  if (!f) {
    ctx.fillStyle = TOAD.blotch;
    for (const [x, y, rx, ry] of [[-0.55, -0.25, 0.16, 0.1], [-0.1, -0.5, 0.12, 0.07], [-0.75, 0.05, 0.1, 0.12], [-0.6, 0.3, 0.1, 0.07]]) {
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, rx * r, ry * r, 0.3, 0, TAU);
      ctx.fill();
    }
    for (const [x, y, s] of [[-0.45, -0.4, 0.07], [-0.2, -0.3, 0.06], [-0.7, -0.15, 0.06], [-0.35, -0.05, 0.05], [0.0, -0.52, 0.05], [-0.65, 0.4, 0.05], [-0.3, 0.25, 0.045], [0.15, -0.35, 0.04]]) {
      ctx.fillStyle = TOAD.wart;
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = TOAD.wartShade;
      ctx.beginPath();
      ctx.arc(x * r + s * r * 0.3, y * r + s * r * 0.3, s * r * 0.6, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = TOAD.wartLight;
      ctx.beginPath();
      ctx.arc(x * r - s * r * 0.3, y * r - s * r * 0.3, s * r * 0.3, 0, TAU);
      ctx.fill();
    }
  }
  // bras fin et doigts aux bouts ronds
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.13 * r;
  ctx.beginPath();
  ctx.moveTo(0.3 * r, 0.3 * r);
  ctx.quadraticCurveTo(0.42 * r, 0.52 * r, 0.36 * r, 0.66 * r);
  ctx.stroke();
  ctx.fillStyle = skin;
  for (const d of [-0.12, 0, 0.12]) {
    ctx.beginPath();
    ctx.arc(0.36 * r + d * r, 0.7 * r, 0.045 * r, 0, TAU);
    ctx.fill();
  }
  // sac vocal : il gonfle, se tend et luit avant le tir
  const sx = 0.68 * r, sy = 0.16 * r, srx = (0.26 + puff * 0.32) * r, sry = (0.18 + puff * 0.24) * r;
  ctx.fillStyle = f ? '#FFFFFF' : puff > 0.1 ? '#F2E6B0' : TOAD.belly;
  ctx.beginPath();
  ctx.ellipse(sx, sy, srx, sry, 0, 0, TAU);
  ctx.fill();
  outline(0.7);
  if (!f && puff > 0.1) {
    ctx.strokeStyle = '#BFAE70';
    ctx.lineWidth = Math.max(1, 0.025 * r);
    ctx.beginPath();
    for (const k of [-0.5, 0, 0.5]) {
      ctx.moveTo(sx - srx * 0.7, sy + k * sry * 0.6);
      ctx.quadraticCurveTo(sx, sy + k * sry * 0.9, sx + srx * 0.7, sy + k * sry * 0.6);
    }
    ctx.stroke();
    ctx.fillStyle = '#FFFBEA';
    ctx.beginPath();
    ctx.ellipse(sx - srx * 0.35, sy - sry * 0.45, srx * 0.25, sry * 0.15, -0.4, 0, TAU);
    ctx.fill();
  }
  // glande derrière l'œil, large bouche, narines, filet de vase quand il charge
  ctx.fillStyle = f ? '#FFFFFF' : TOAD.wart;
  ctx.beginPath();
  ctx.ellipse(0.12 * r, -0.48 * r, 0.16 * r, 0.07 * r, -0.3, 0, TAU);
  ctx.fill();
  outline(0.45);
  ctx.strokeStyle = f ? '#FFFFFF' : '#22301A';
  ctx.lineWidth = Math.max(1.2, 0.05 * r);
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.04 * r);
  ctx.quadraticCurveTo(0.7 * r, 0.06 * r, 1.04 * r, -0.08 * r);
  ctx.stroke();
  ctx.fillStyle = '#22301A';
  for (const x of [0.88, 0.96]) {
    ctx.beginPath();
    ctx.arc(x * r, -0.3 * r, 0.022 * r, 0, TAU);
    ctx.fill();
  }
  if (puff > 0.3 && !f) {
    ctx.fillStyle = TOAD.slime;
    ctx.beginPath();
    ctx.ellipse(1.06 * r, 0.0 + puff * 0.08 * r, 0.04 * r, 0.07 * r * puff, 0, 0, TAU);
    ctx.fill();
  }
  // yeux globuleux : dôme, iris doré, pupille horizontale, paupière
  for (const x of [0.38, 0.72]) {
    const ex = x * r, ey = -0.58 * r, es = 0.15 * r;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ex, ey + 0.03 * r, es * 1.35, 0, TAU);
    ctx.fill();
    outline(0.75);
    ctx.fillStyle = u.alpha ? '#B48CFF' : '#E8B23C';
    ctx.beginPath();
    ctx.arc(ex, ey, es, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9A6A24';
    ctx.lineWidth = Math.max(1, 0.02 * r);
    ctx.beginPath();
    ctx.arc(ex, ey, es * 0.7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.ellipse(ex + es * 0.1, ey, es * 0.75, es * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - es * 0.4, ey - es * 0.4, es * 0.22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade; // paupière
    ctx.beginPath();
    ctx.arc(ex, ey, es * 1.05, Math.PI * 1.08, Math.PI * 1.92);
    ctx.closePath();
    ctx.fill();
    if (u.wild) {
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = Math.max(1.5, es * 0.3);
      ctx.beginPath();
      ctx.moveTo(ex - es * 1.1, ey - es * 1.25);
      ctx.lineTo(ex + es * 1.0, ey - es * 0.85);
      ctx.stroke();
    }
  }
  // le roi : une feuille de nénuphar posée sur le dos comme une cape, sa fleur d'eau dessus
  if (boss) {
    const px = -0.42 * r, py = -0.42 * r;
    ctx.fillStyle = f ? '#FFFFFF' : '#3F7A3A';
    ctx.beginPath();
    ctx.ellipse(px, py, 0.5 * r, 0.24 * r, -0.25, 0.25, TAU - 0.05);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    outline(0.7);
    if (!f) {
      ctx.strokeStyle = '#7FB060';
      ctx.lineWidth = Math.max(1, 0.025 * r);
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = 0.5 + k * 0.85;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * 0.45 * r, py + Math.sin(a) * 0.2 * r);
      }
      ctx.stroke();
    }
  }
  if (boss && !f) {
    const fx = -0.5 * r, fy = -0.5 * r;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI;
      ctx.fillStyle = k % 2 ? '#F2B8D0' : '#E68AB0';
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * 0.1 * r, fy + Math.sin(a) * 0.08 * r, 0.1 * r, 0.04 * r, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#F0D060';
    ctx.beginPath();
    ctx.arc(fx, fy - 0.02 * r, 0.04 * r, 0, TAU);
    ctx.fill();
  }
}

/**
 * Serpent des brumes, en dragon des lacs : tête à cornes et barbillons, crinière d'algues, anneaux écailleux
 * à ventre clair. Dans l'eau, seuls ses anneaux affleurent (une pointe de crinière sur chacun) ; il se dresse
 * pour cracher son jet. Sa version géante (l'Hydre des brumes) porte la même apparence.
 */
export function serpent(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const scale = u.flash ? '#FFFFFF' : fill, belly = u.flash ? '#FFFFFF' : '#E8D9A8', mane = u.flash ? '#FFFFFF' : '#4F7C45';
  const rise = u.charge ?? 0;
  const pts: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    pts.push([(0.1 - k * 1.7) * r, (0.38 + Math.sin(k * 7 - u.t * 4 + u.seed) * 0.12) * r]);
  }
  const ripple = (x: number, y: number, w: number) => {
    ctx.strokeStyle = 'rgba(200,235,240,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, w * (1 + Math.sin(u.t * 3) * 0.06), w * 0.25, 0, 0, TAU);
    ctx.stroke();
  };
  if (!u.inWater) {
    // corps en S, plus fin vers la queue, et écailles du ventre
    for (const [c, extra] of [['rgba(12,18,16,0.75)', 3], [scale, 0]] as const) {
      ctx.strokeStyle = c;
      ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        ctx.lineWidth = 0.44 * r + (0.14 * r - 0.44 * r) * (i / (pts.length - 1)) + extra;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
        ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.fillStyle = belly;
    for (let i = 1; i < 12; i++) {
      ctx.beginPath();
      ctx.ellipse(pts[i][0], pts[i][1] + 0.1 * r, 0.06 * r, 0.04 * r, 0, 0, TAU);
      ctx.fill();
    }
  } else {
    for (const [x, y] of [pts[3], pts[7], pts[11]]) {
      ctx.fillStyle = scale;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.26 * r, 0.2 * r, 0, Math.PI, 0);
      ctx.fill();
      ink(ctx, r);
      ctx.fillStyle = mane;
      ctx.beginPath();
      ctx.moveTo(x - 0.08 * r, y - 0.16 * r);
      ctx.lineTo(x, y - 0.34 * r);
      ctx.lineTo(x + 0.08 * r, y - 0.16 * r);
      ctx.fill();
      ripple(x, y, 0.38 * r);
    }
  }
  // cou dressé (plus haut quand il charge son jet)
  const hy = -(0.38 + rise * 0.5) * r;
  for (const [c, w] of [['rgba(12,18,16,0.75)', 0.44 * r + 3], [scale, 0.44 * r]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.1 * r, 0.38 * r);
    ctx.quadraticCurveTo(0, hy * 0.3, 0.3 * r, hy);
    ctx.stroke();
  }
  // crinière d'algues le long du cou
  ctx.strokeStyle = mane;
  ctx.lineWidth = 0.08 * r;
  for (let k = 0; k < 5; k++) {
    const y0 = 0.3 * r + (hy - 0.3 * r) * (k / 5), x0 = -0.05 * r + k * 0.06 * r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 - 0.2 * r, y0 - 0.05 * r, x0 - 0.3 * r + Math.sin(u.t * 4 + k) * 0.04 * r, y0 + 0.08 * r);
    ctx.stroke();
  }
  // tête : museau long, cornes, barbillons
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.moveTo(0.15 * r, hy - 0.18 * r);
  ctx.quadraticCurveTo(0.6 * r, hy - 0.3 * r, 1.0 * r, hy - 0.05 * r);
  ctx.lineTo(1.02 * r, hy + 0.08 * r);
  ctx.quadraticCurveTo(0.6 * r, hy + 0.22 * r, 0.15 * r, hy + 0.14 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = belly;
  ctx.lineWidth = 0.07 * r;
  ctx.beginPath();
  ctx.moveTo(0.3 * r, hy - 0.2 * r);
  ctx.quadraticCurveTo(0.15 * r, hy - 0.5 * r, -0.05 * r, hy - 0.55 * r);
  ctx.moveTo(0.42 * r, hy - 0.22 * r);
  ctx.quadraticCurveTo(0.34 * r, hy - 0.5 * r, 0.18 * r, hy - 0.6 * r);
  ctx.stroke();
  ctx.strokeStyle = mane;
  ctx.lineWidth = 0.04 * r;
  ctx.beginPath();
  ctx.moveTo(0.95 * r, hy + 0.06 * r);
  ctx.quadraticCurveTo(1.15 * r, hy + 0.2 * r, 1.05 * r, hy + 0.4 * r);
  ctx.moveTo(0.85 * r, hy + 0.1 * r);
  ctx.quadraticCurveTo(0.95 * r, hy + 0.3 * r, 0.82 * r, hy + 0.45 * r);
  ctx.stroke();
  // œil de reptile qui luit (violet pour un Alpha)
  const iris = u.alpha ? '#B48CFF' : '#F0B64A', ex = 0.58 * r, ey = hy - 0.08 * r, es = 0.075 * r;
  ctx.save();
  ctx.shadowColor = iris;
  ctx.shadowBlur = es * 5;
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(ex + es * 0.15, ey, es * 0.3, es * 0.85, 0, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.6);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.5, ey - es * 1.7);
    ctx.lineTo(ex + es * 1.3, ey - es * 0.8);
    ctx.stroke();
  }
  if (u.inWater) ripple(0.1 * r, 0.42 * r, 0.5 * r);
}

const CRAB = { shade: '#9A4228', dark: '#6E2C1A', light: '#F09A6E', belly: '#F2D9B8', tip: '#2A1A14' };

/**
 * Crabe des berges (zone 5, mêlée) : carapace large et plate à bord épineux, marbrée, plus claire au sommet, rebord sombre et
 * dessous crème ; quatre paires de pattes articulées qui trottinent de côté ; pinces à deux doigts (dents, pointes
 * noires) portées par des bras articulés, qui claquent ; yeux noirs luisants sur pédoncules, pièces buccales, et une
 * bulle d'écume de temps en temps. Le Crabe Titan a une pince énorme, des balanes et des algues sur le dos.
 */
export function crab(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, boss = !!SPECIES[u.species]?.boss;
  const shell = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : CRAB.shade, dark = f ? '#FFFFFF' : CRAB.dark;
  const snap = Math.max(0, Math.sin(u.t * 3 + u.seed)); // les pinces s'ouvrent et claquent
  ctx.translate(0, 0.12 * r); // plat et haut sur pattes : on le pose sur son ombre
  // pattes : trois segments, pointe sombre ; elles trottinent par paires alternées
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const lift = Math.sin(u.t * 10 + i * 1.7 + (sd > 0 ? Math.PI : 0) + u.seed) * 0.07 * r;
      const bx = sd * (0.4 + i * 0.12) * r, by = (0.08 + i * 0.03) * r;
      const kx = sd * (0.98 + i * 0.1) * r, ky = (-0.24 + i * 0.1) * r + lift;
      const fx = sd * (1.25 + i * 0.07) * r, fy = (0.48 + i * 0.05) * r;
      ctx.strokeStyle = i % 2 ? shade : dark;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.075 * r;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy - 0.1 * r);
      ctx.stroke();
      ctx.strokeStyle = f ? '#FFFFFF' : CRAB.tip;
      ctx.lineWidth = 0.045 * r;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 0.1 * r);
      ctx.lineTo(fx + sd * 0.04 * r, fy + 0.02 * r);
      ctx.stroke();
    }
  }
  // dessous crème et rebord sombre, puis la carapace bombée à bord épineux
  ctx.fillStyle = f ? '#FFFFFF' : CRAB.belly;
  ctx.beginPath();
  ctx.ellipse(0, 0.2 * r, 0.7 * r, 0.11 * r, 0, 0, TAU);
  ctx.fill();
  fineInk(ctx, r, 0.6);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(0, 0.12 * r, 1.0 * r, 0.16 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath();
  const spikes = 5;
  ctx.moveTo(-1.02 * r, 0.06 * r);
  for (let k = 0; k <= spikes * 2; k++) {
    // bord avant : une rangée d'épines pointues, de gauche à droite en passant par le front
    const a = Math.PI + (k / (spikes * 2)) * Math.PI, d = k % 2 ? 1.13 : 0.97;
    ctx.lineTo(Math.cos(a) * 1.02 * r * d, 0.02 * r + Math.sin(a) * 0.44 * r * d);
  }
  ctx.quadraticCurveTo(0.9 * r, 0.18 * r, 0, 0.2 * r);
  ctx.quadraticCurveTo(-0.9 * r, 0.18 * r, -1.02 * r, 0.06 * r);
  ctx.closePath();
  ctx.fill();
  fineInk(ctx, r, 0.9);
  if (!f) {
    // sommet plus clair, marbrures, sillons de la carapace
    ctx.fillStyle = 'rgba(255,190,150,0.4)';
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, -0.2 * r, 0.6 * r, 0.12 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(110,40,20,0.35)';
    for (const [x, y, s] of [[-0.6, -0.08, 0.08], [0.55, -0.12, 0.07], [0.22, 0.04, 0.05], [-0.25, 0.05, 0.05], [0.72, 0.02, 0.04]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,30,15,0.5)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    ctx.moveTo(-0.32 * r, -0.36 * r);
    ctx.quadraticCurveTo(-0.22 * r, -0.12 * r, -0.42 * r, 0.1 * r);
    ctx.moveTo(0.32 * r, -0.36 * r);
    ctx.quadraticCurveTo(0.22 * r, -0.12 * r, 0.42 * r, 0.1 * r);
    ctx.moveTo(-0.2 * r, -0.02 * r);
    ctx.quadraticCurveTo(0, 0.04 * r, 0.2 * r, -0.02 * r);
    ctx.stroke();
  }
  // balanes et algues du Titan
  if (boss && !f) {
    // balanes : de petits cônes de calcaire, ouverts au sommet
    for (const [x, y, s] of [[-0.62, -0.1, 0.08], [-0.45, -0.26, 0.06], [0.52, -0.2, 0.07], [0.7, -0.04, 0.05], [-0.05, -0.34, 0.05]]) {
      ctx.fillStyle = '#D8D0BC';
      ctx.beginPath();
      ctx.moveTo(x * r - s * r, y * r + s * r * 0.6);
      ctx.lineTo(x * r - s * r * 0.45, y * r - s * r * 0.6);
      ctx.lineTo(x * r + s * r * 0.45, y * r - s * r * 0.6);
      ctx.lineTo(x * r + s * r, y * r + s * r * 0.6);
      ctx.closePath();
      ctx.fill();
      fineInk(ctx, r, 0.35);
      ctx.fillStyle = 'rgba(120,110,95,0.7)';
      ctx.fillRect(x * r - s * r * 0.35, y * r - s * r * 0.15, s * r * 0.7, s * r * 0.18);
      ctx.fillStyle = '#4A443C';
      ctx.beginPath();
      ctx.ellipse(x * r, y * r - s * r * 0.6, s * r * 0.4, s * r * 0.14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#4F7C45';
    ctx.lineWidth = Math.max(1.5, 0.05 * r);
    ctx.beginPath();
    for (const [x, sd] of [[-0.7, -1], [0.75, 1], [-0.15, -1]]) {
      ctx.moveTo(x * r, -0.15 * r);
      ctx.quadraticCurveTo((x + sd * 0.1) * r, 0.1 * r + Math.sin(u.t * 2 + x) * 0.04 * r, (x + sd * 0.05) * r, 0.32 * r);
    }
    ctx.stroke();
  }
  // bras articulés et pinces (celle du Titan, à droite, est énorme)
  for (const sd of [-1, 1]) {
    const big = boss && sd > 0 ? 1.45 : 1;
    const sx = sd * 0.6 * r, sy = -0.22 * r, ex = sd * 0.92 * r, ey = -0.46 * r;
    ctx.strokeStyle = shell;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.1 * r;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const cx = sd * (1.1 + (big - 1) * 0.2) * r, cy = (-0.52 - (big - 1) * 0.15) * r;
    const open = (1 - snap) * 0.45;
    // repère de la pince : vers l'extérieur et le haut
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sd * big, big);
    ctx.rotate(-0.6);
    // un doigt : fuselé, pointe noire, dents sur son bord intérieur (in : +1 vers le bas, -1 vers le haut)
    const finger = (bx: number, by: number, rot: number, len: number, inner: number, col: string) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -0.045 * r);
      ctx.quadraticCurveTo(len * 0.55, -0.075 * r, len, 0);
      ctx.quadraticCurveTo(len * 0.55, 0.035 * r, 0, 0.045 * r);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      fineInk(ctx, r / big, 0.6);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = f ? '#FFFFFF' : CRAB.tip;
      ctx.fillRect(len * 0.72, -0.12 * r, len * 0.3, 0.24 * r); // pointe noire
      if (!f) {
        ctx.fillStyle = CRAB.belly;
        for (const k of [0.2, 0.36, 0.52]) {
          ctx.beginPath();
          ctx.moveTo(k * len, inner * 0.05 * r);
          ctx.lineTo((k + 0.05) * len, inner * 0.015 * r);
          ctx.lineTo((k + 0.1) * len, inner * 0.05 * r);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.restore();
    };
    finger(0.24 * r, 0.03 * r, 0.1, 0.5 * r, -1, shell); // doigt fixe, dans l'axe
    finger(0.22 * r, -0.05 * r, -0.08 - open, 0.48 * r, 1, shade); // doigt mobile, qui s'ouvre
    // la paume, bombée, par-dessus la base des doigts
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0.02 * r, 0, 0.3 * r, 0.12 * r, 0, 0, TAU);
    ctx.fill();
    fineInk(ctx, r / big, 0.8);
    if (!f) {
      ctx.fillStyle = 'rgba(255,200,160,0.45)';
      ctx.beginPath();
      ctx.ellipse(-0.02 * r, -0.05 * r, 0.16 * r, 0.035 * r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(110,40,20,0.35)';
      for (const [x, y] of [[0.08, 0.04], [-0.1, 0.05], [0.16, -0.02]]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, 0.025 * r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // pièces buccales, pédoncules et yeux noirs luisants
  if (!f) {
    ctx.fillStyle = CRAB.belly;
    ctx.beginPath();
    ctx.ellipse(0, -0.3 * r, 0.12 * r, 0.06 * r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,40,0.6)';
    ctx.lineWidth = Math.max(1, 0.02 * r);
    ctx.beginPath();
    ctx.moveTo(0, -0.36 * r);
    ctx.lineTo(0, -0.24 * r);
    ctx.stroke();
  }
  for (const sd of [-1, 1]) {
    const tx = sd * 0.24 * r, ty = -0.6 * r + Math.sin(u.t * 2 + sd + u.seed) * 0.03 * r;
    ctx.strokeStyle = shade;
    ctx.lineWidth = 0.05 * r;
    ctx.beginPath();
    ctx.moveTo(sd * 0.14 * r, -0.36 * r);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = u.alpha ? '#B48CFF' : '#10181A';
    ctx.beginPath();
    ctx.arc(tx, ty, 0.085 * r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(tx - 0.03 * r, ty - 0.03 * r, 0.03 * r, 0, TAU);
    ctx.fill();
    if (u.wild) {
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = Math.max(1.5, 0.04 * r);
      ctx.beginPath();
      ctx.moveTo(tx - sd * 0.14 * r, ty - 0.16 * r);
      ctx.lineTo(tx + sd * 0.08 * r, ty - 0.1 * r);
      ctx.stroke();
    }
  }
  // une bulle d'écume, de temps en temps
  const b = (u.t * 0.6 + u.seed * 0.37) % 1;
  if (!f && b < 0.6) {
    ctx.strokeStyle = `rgba(230,245,250,${0.8 * (1 - b / 0.6)})`;
    ctx.lineWidth = Math.max(1, 0.025 * r);
    ctx.beginPath();
    ctx.arc(0.08 * r + b * 0.1 * r, -0.34 * r - b * 0.35 * r, (0.04 + b * 0.05) * r, 0, TAU);
    ctx.stroke();
  }
  ctx.translate(0, -0.12 * r);
}
