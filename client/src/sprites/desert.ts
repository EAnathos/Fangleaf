// Créatures de la Mer de sable : suricate, ver des sables, vautour (au sol et en vol), chacal, scorpion.

import { SPECIES } from '../../../shared/config.ts';
import { withTint } from '../tint.ts';
import { TAU, gait, glowEye, ink, type Ctx, type UnitLook } from './outils.ts';

// ───────────────────────── Mer de sable (zone 6) ─────────────────────────

/**
 * Suricate : élancé, dressé sur ses pattes arrière en sentinelle ; dos rayé, ventre crème,
 * grandes « lunettes » noires autour des yeux, queue fine à bout noir (gibier craintif).
 */
export function meerkat(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const fur = W('#C49A62'), shade = W('#8E6A3E'), belly = W('#EFD9AC'), mask = W('#2E2016');
  // cri : il se hisse sur la pointe des pattes, tête renversée en arrière, gueule grande ouverte
  const cry = u.shout ? Math.sin(Math.min(1, u.shout * 1.25) * Math.PI) : 0;
  const look = cry ? -0.55 * cry : Math.sin(u.t * 1.7 + u.seed) * 0.12, sway = cry ? 0 : Math.sin(u.t * 2.3 + u.seed) * 0.03; // il guette, en équilibre
  const ell = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  };
  // queue fine qui sert d'appui, bout noir
  ctx.strokeStyle = shade;
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.1 * r, 0.62 * r);
  ctx.quadraticCurveTo(-0.85 * r, 0.78 * r, -1.05 * r, 0.3 * r);
  ctx.stroke();
  ctx.strokeStyle = mask;
  ctx.beginPath();
  ctx.moveTo(-1.0 * r, 0.42 * r);
  ctx.lineTo(-1.05 * r, 0.3 * r);
  ctx.stroke();
  // pattes arrière
  ell(-0.14 * r, 0.7 * r, 0.2 * r, 0.09 * r, 0, shade);
  ell(0.2 * r, 0.7 * r, 0.2 * r, 0.09 * r, 0, shade);
  ctx.save();
  ctx.rotate(sway);
  if (cry) {
    // étiré vers le haut depuis les pattes
    ctx.translate(0, 0.7 * r);
    ctx.scale(1 - cry * 0.08, 1 + cry * 0.3);
    ctx.translate(0, -0.7 * r);
  }
  // corps élancé
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0.02 * r, 0.05 * r, 0.36 * r, 0.82 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  // rayures sombres du dos
  ctx.strokeStyle = 'rgba(90,60,30,0.6)';
  ctx.lineWidth = r * 0.06;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const y = (-0.45 + k * 0.2) * r;
    ctx.moveTo(-0.32 * r, y);
    ctx.lineTo(-0.15 * r, y + 0.04 * r);
  }
  ctx.stroke();
  ell(0.1 * r, 0.12 * r, 0.18 * r, 0.6 * r, 0, belly);
  // pattes avant repliées, griffes
  ctx.strokeStyle = shade;
  ctx.lineWidth = r * 0.13;
  ctx.beginPath();
  ctx.moveTo(0.2 * r, -0.4 * r);
  ctx.lineTo(0.3 * r, -0.18 * r);
  ctx.moveTo(0.04 * r, -0.4 * r);
  ctx.lineTo(0.14 * r, -0.18 * r);
  ctx.stroke();
  ctx.fillStyle = mask;
  for (const px of [0.3, 0.14]) ctx.fillRect((px - 0.03) * r, -0.17 * r, 0.06 * r, 0.05 * r);
  // tête, plus fine, qui tourne pour guetter
  ctx.translate(0.07 * r, -1.0 * r);
  ctx.rotate(look);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.32 * r, 0.26 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.6);
  ell(0.28 * r, 0.07 * r, 0.17 * r, 0.1 * r, 0.1, belly); // museau pointu
  ell(0.44 * r, 0.05 * r, 0.05 * r, 0.04 * r, 0, mask); // truffe
  if (cry) ell(0.3 * r, 0.16 * r, 0.12 * r, 0.07 * r * cry + 0.01 * r, 0.15, '#5A1E1A'); // gueule ouverte
  ell(-0.24 * r, -0.13 * r, 0.08 * r, 0.08 * r, 0, mask); // oreille
  for (const ex of [-0.02, 0.17]) {
    ell(ex * r, -0.04 * r, 0.11 * r, 0.1 * r, 0, mask); // grandes lunettes noires
    ell(ex * r + 0.01 * r, -0.05 * r, 0.045 * r, 0.045 * r, 0, u.alpha ? '#B48CFF' : '#1A120C');
    ell(ex * r - 0.005 * r, -0.07 * r, 0.018 * r, 0.018 * r, 0, '#FFFFFF');
  }
  ctx.restore();
  if (cry) {
    // le cri : des arcs qui partent de sa gueule
    ctx.strokeStyle = `rgba(240,182,74,${0.8 * cry})`;
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const rr = (0.35 + k * 0.28 + (u.shout ?? 0) * 0.3) * r;
      ctx.beginPath();
      ctx.arc(0.45 * r, -1.25 * r, rr, -1.2, -0.1);
      ctx.stroke();
    }
  }
}

/**
 * Chacal fantôme : décharné, côtes apparentes, échine saillante, queue maigre ; oreilles pointues bien plantées
 * à l'arrière du crâne ; yeux de braise qui rougeoient dans la nuit.
 */
export function jackal(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const boss = !!SPECIES[u.species]?.boss;
  const fur = W(boss ? '#C8BDA4' : '#A89A80'), shade = W(boss ? '#9A8E76' : '#7E7260'), bone = W('#5E5344'), head = W(boss ? '#D8CDB6' : '#BFB49C');
  const gt = gait(u, 14), step = u.moving ? Math.sin(u.t * 14 + u.seed) * 0.16 : 0;
  // pattes maigres, l'une après l'autre (pied levé quand elle revient vers l'avant)
  ctx.strokeStyle = shade;
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [lx, i] of [[-0.5, 0], [-0.32, 2], [0.38, 1], [0.55, 3]] as const) {
    const k = gt[i].a * 0.16, up = gt[i].lift * 0.08;
    ctx.moveTo(lx * r, 0.1 * r);
    ctx.lineTo((lx + k * 0.6 + up * 0.5) * r, (0.42 - up) * r);
    ctx.lineTo((lx + k) * r, (0.72 - up) * r);
  }
  ctx.stroke();
  // queue maigre, touffe au bout
  ctx.strokeStyle = fur;
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.6 * r, -0.12 * r);
  ctx.quadraticCurveTo(-1.0 * r, -0.05 * r, -1.15 * r, 0.25 * r + step * r * 0.2);
  ctx.stroke();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(-1.15 * r, 0.3 * r + step * r * 0.2, 0.08 * r, 0.12 * r, 0.3, 0, TAU);
  ctx.fill();
  // corps efflanqué : poitrail profond, ventre rentré
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-0.65 * r, -0.12 * r);
  ctx.quadraticCurveTo(-0.1 * r, -0.42 * r, 0.55 * r, -0.28 * r);
  ctx.quadraticCurveTo(0.72 * r, 0.05 * r, 0.45 * r, 0.25 * r);
  ctx.quadraticCurveTo(0.0 * r, 0.05 * r, -0.4 * r, 0.18 * r);
  ctx.quadraticCurveTo(-0.7 * r, 0.12 * r, -0.65 * r, -0.12 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.6);
  // côtes et échine qui saillent
  ctx.strokeStyle = bone;
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const x = (-0.05 + k * 0.11) * r;
    ctx.moveTo(x, -0.3 * r);
    ctx.quadraticCurveTo(x + 0.06 * r, -0.08 * r, x - 0.02 * r, 0.12 * r);
  }
  for (let k = 0; k < 6; k++) {
    const x = (-0.55 + k * 0.12) * r;
    ctx.moveTo(x, -0.18 * r - Math.sin((k / 5) * Math.PI) * 0.12 * r);
    ctx.lineTo(x + 0.04 * r, -0.22 * r - Math.sin((k / 5) * Math.PI) * 0.12 * r);
  }
  ctx.stroke();
  // cou et tête étroite au long museau
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0.6 * r, -0.3 * r, 0.18 * r, 0.24 * r, 0.6, 0, TAU);
  ctx.fill();
  const hx = 0.82 * r, hy = -0.48 * r;
  // oreilles d'abord, plantées dans le crâne (la tête les recouvre à la base)
  ctx.fillStyle = shade;
  for (const [ox, tip, inner] of [[-0.12, -0.2, false], [0.03, -0.02, true]] as const) {
    ctx.fillStyle = inner ? head : shade;
    ctx.beginPath();
    ctx.moveTo(hx + (ox - 0.1) * r, hy - 0.02 * r);
    ctx.quadraticCurveTo(hx + (ox - 0.08) * r, hy - 0.4 * r, hx + (ox + tip) * r, hy - 0.66 * r);
    ctx.quadraticCurveTo(hx + (ox + 0.1) * r, hy - 0.35 * r, hx + (ox + 0.13) * r, hy - 0.04 * r);
    ctx.closePath();
    ctx.fill();
    ink(ctx, r * 0.35);
    if (inner) {
      ctx.fillStyle = W('#6B5040'); // intérieur de l'oreille
      ctx.beginPath();
      ctx.moveTo(hx + (ox - 0.04) * r, hy - 0.1 * r);
      ctx.quadraticCurveTo(hx + (ox - 0.03) * r, hy - 0.36 * r, hx + (ox + tip) * r, hy - 0.56 * r);
      ctx.quadraticCurveTo(hx + (ox + 0.06) * r, hy - 0.32 * r, hx + (ox + 0.08) * r, hy - 0.1 * r);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.24 * r, 0.18 * r, 0.1, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.55);
  // museau effilé et truffe
  ctx.fillStyle = W('#D8CDB6');
  ctx.beginPath();
  ctx.moveTo(hx + 0.12 * r, hy - 0.08 * r);
  ctx.quadraticCurveTo(hx + 0.42 * r, hy - 0.02 * r, hx + 0.46 * r, hy + 0.06 * r);
  ctx.quadraticCurveTo(hx + 0.3 * r, hy + 0.14 * r, hx + 0.1 * r, hy + 0.1 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.4);
  ctx.fillStyle = '#1A120C';
  ctx.beginPath();
  ctx.ellipse(hx + 0.45 * r, hy + 0.04 * r, 0.04 * r, 0.035 * r, 0, 0, TAU);
  ctx.fill();
  // yeux de braise : orbite sombre, braise qui pulse, halo
  const g = 0.65 + 0.35 * Math.sin(u.t * 5 + u.seed);
  const ex = hx + 0.06 * r, ey = hy - 0.05 * r;
  ctx.fillStyle = `rgba(255,140,60,${0.28 * g})`;
  ctx.beginPath();
  ctx.arc(ex, ey, 0.16 * r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1A120C';
  ctx.beginPath();
  ctx.ellipse(ex, ey, 0.07 * r, 0.06 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = u.alpha ? '#B48CFF' : `rgb(255,${(110 + 70 * g) | 0},60)`;
  ctx.beginPath();
  ctx.arc(ex + 0.01 * r, ey, 0.04 * r, 0, TAU);
  ctx.fill();
  if (u.wild) {
    // arcade froncée
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.2, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(ex - 0.08 * r, ey - 0.1 * r);
    ctx.lineTo(ex + 0.08 * r, ey - 0.05 * r);
    ctx.stroke();
  }
}

/** Ver des sables, sorti de terre : corps annelé qui jaillit d'un cratère, gueule ronde pleine de dents. */
export function sandworm(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const skin = u.flash ? '#FFFFFF' : '#B98A5A', ring = u.flash ? '#FFFFFF' : '#8A6239', pale = u.flash ? '#FFFFFF' : '#D9B486';
  const sway = Math.sin(u.t * 2.4 + u.seed) * 0.08;
  // cratère de sable
  ctx.fillStyle = '#C8A46E';
  ctx.beginPath();
  ctx.ellipse(0, 0.62 * r, 1.0 * r, 0.32 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7A5A35';
  ctx.beginPath();
  ctx.ellipse(0, 0.6 * r, 0.6 * r, 0.18 * r, 0, 0, TAU);
  ctx.fill();
  // anneaux, du sol vers la tête
  const seg = [[0, 0.5, 0.48], [0.08, 0.15, 0.46], [0.2, -0.2, 0.43], [0.34, -0.52, 0.4]];
  for (const [i, [sx, sy, sr]] of seg.entries()) {
    const x = (sx + sway * i) * r, y = sy * r;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(x, y, sr * r, sr * r * 0.85, 0, 0, TAU);
    ctx.fill();
    ink(ctx, r * 0.8);
    ctx.strokeStyle = ring;
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.ellipse(x, y + sr * r * 0.25, sr * r * 0.9, sr * r * 0.35, 0, 0, Math.PI);
    ctx.stroke();
  }
  // tête : gueule ronde tournée vers l'avant, couronne de dents
  const hx = (0.5 + sway * 4) * r, hy = -0.82 * r;
  ctx.fillStyle = pale;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 0.42 * r, 0.38 * r, -0.3, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.8);
  ctx.fillStyle = '#3A1E14';
  ctx.beginPath();
  ctx.ellipse(hx + 0.1 * r, hy, 0.26 * r, 0.24 * r, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F1E8D2';
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, cx = hx + 0.1 * r + Math.cos(a) * 0.24 * r, cy = hy + Math.sin(a) * 0.22 * r;
    const ix = hx + 0.1 * r + Math.cos(a) * 0.13 * r, iy = hy + Math.sin(a) * 0.12 * r;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a + 1.6) * 0.05 * r, cy + Math.sin(a + 1.6) * 0.05 * r);
    ctx.lineTo(cx - Math.cos(a + 1.6) * 0.05 * r, cy - Math.sin(a + 1.6) * 0.05 * r);
    ctx.lineTo(ix, iy);
    ctx.closePath();
    ctx.fill();
  }
  if (u.alpha) glowEye(ctx, hx - 0.18 * r, hy - 0.22 * r, 0.06 * r, '#B48CFF', false, true);
}

/**
 * Vautour posé : dos voûté, ailes repliées aux plumes écaillées et rémiges sombres, collerette duveteuse,
 * cou nu et tête chauve rose ridée, bec crochu à pointe sombre, serres.
 */
export function vulture(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const wing = W('#3E3029'), cover = W('#4E3D33'), dark = W('#221A16'), edge = W('#6A5444'), ruff = W('#EDE3CC'), ruffShade = W('#C9BC9E');
  const skin = W('#D98A7E'), skinDark = W('#B9665C'), beak = W('#E8D9B0');
  const hop = u.moving ? Math.abs(Math.sin(u.t * 9 + u.seed)) * r * 0.08 : 0;
  const breathe = Math.sin(u.t * 2 + u.seed) * 0.02;
  ctx.translate(0, -hop);
  // pattes écailleuses et serres
  ctx.strokeStyle = W('#B9A68A');
  ctx.lineWidth = r * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const lx of [-0.15, 0.15]) {
    ctx.moveTo(lx * r, 0.4 * r);
    ctx.lineTo((lx - 0.04) * r, 0.74 * r);
  }
  ctx.stroke();
  ctx.strokeStyle = W('#2A201B');
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  for (const lx of [-0.19, 0.11]) for (const dx of [-0.09, 0, 0.1]) {
    ctx.moveTo(lx * r, 0.74 * r);
    ctx.lineTo((lx + dx) * r, 0.8 * r);
  }
  ctx.stroke();
  // queue en éventail : plumes séparées
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k % 2 ? dark : wing;
    ctx.beginPath();
    ctx.moveTo(-0.45 * r, 0.25 * r);
    ctx.lineTo((-1.02 + k * 0.06) * r, (0.48 + k * 0.07) * r);
    ctx.lineTo((-0.95 + k * 0.06) * r, (0.58 + k * 0.07) * r);
    ctx.lineTo(-0.38 * r, 0.42 * r);
    ctx.closePath();
    ctx.fill();
  }
  // corps : aile repliée
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.ellipse(-0.05 * r, 0.05 * r, 0.62 * r * (1 + breathe), 0.52 * r * (1 + breathe), -0.15, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  // rémiges sombres qui dépassent vers l'arrière, liseré clair
  for (let k = 0; k < 5; k++) {
    const bx = (-0.2 - k * 0.09) * r, by = (0.08 + k * 0.06) * r;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(bx - 0.18 * r, by + 0.12 * r, 0.3 * r, 0.07 * r, 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = r * 0.025;
    ctx.stroke();
  }
  // couvertures écaillées sur le haut de l'aile
  ctx.fillStyle = cover;
  ctx.strokeStyle = edge;
  ctx.lineWidth = r * 0.03;
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4 - row; k++) {
      const cx = (-0.32 + k * 0.17 + row * 0.08) * r, cy = (-0.22 + row * 0.15) * r;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.1 * r, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
  // poitrail plus clair, strié
  ctx.fillStyle = W('#5A4638');
  ctx.beginPath();
  ctx.ellipse(0.3 * r, 0.08 * r, 0.2 * r, 0.3 * r, -0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = W('#7A6250');
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    ctx.moveTo((0.22 + k * 0.05) * r, -0.05 * r);
    ctx.lineTo((0.2 + k * 0.05) * r, 0.25 * r);
  }
  ctx.stroke();
  // collerette duveteuse en houppettes
  for (let k = 0; k < 8; k++) {
    const a = Math.PI * 0.9 + (k / 7) * Math.PI * 1.2;
    const fx = 0.36 * r + Math.cos(a) * 0.24 * r, fy = -0.32 * r + Math.sin(a) * 0.13 * r;
    ctx.fillStyle = k % 2 ? ruffShade : ruff;
    ctx.beginPath();
    ctx.arc(fx, fy, 0.1 * r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = ruff;
  ctx.beginPath();
  ctx.ellipse(0.38 * r, -0.33 * r, 0.2 * r, 0.12 * r, 0.3, 0, TAU);
  ctx.fill();
  // cou nu et tête chauve, ridée
  ctx.fillStyle = skinDark;
  ctx.beginPath();
  ctx.ellipse(0.47 * r, -0.47 * r, 0.09 * r, 0.14 * r, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0.56 * r, -0.62 * r, 0.22 * r, 0.19 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.5);
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  for (const [wx, wy] of [[0.42, -0.66], [0.46, -0.56], [0.5, -0.74]]) {
    ctx.moveTo(wx * r, wy * r);
    ctx.quadraticCurveTo((wx + 0.05) * r, (wy - 0.03) * r, (wx + 0.1) * r, wy * r);
  }
  ctx.stroke();
  // bec crochu : cire, narine, pointe sombre
  ctx.fillStyle = W('#C9A27A');
  ctx.beginPath();
  ctx.ellipse(0.74 * r, -0.63 * r, 0.06 * r, 0.06 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = beak;
  ctx.beginPath();
  ctx.moveTo(0.74 * r, -0.69 * r);
  ctx.quadraticCurveTo(1.0 * r, -0.68 * r, 0.94 * r, -0.47 * r);
  ctx.lineTo(0.76 * r, -0.56 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.35);
  ctx.fillStyle = W('#4A3A30');
  ctx.beginPath();
  ctx.moveTo(0.93 * r, -0.57 * r);
  ctx.quadraticCurveTo(0.97 * r, -0.53 * r, 0.94 * r, -0.47 * r);
  ctx.lineTo(0.89 * r, -0.53 * r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = W('#4A3A30');
  ctx.beginPath();
  ctx.ellipse(0.8 * r, -0.64 * r, 0.025 * r, 0.015 * r, 0, 0, TAU);
  ctx.fill();
  // œil perçant, arcade sombre
  glowEye(ctx, 0.6 * r, -0.67 * r, 0.055 * r, u.alpha ? '#B48CFF' : '#7A3A1A', u.wild, !!u.alpha);
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = r * 0.035;
  ctx.beginPath();
  ctx.moveTo(0.52 * r, -0.74 * r);
  ctx.lineTo(0.68 * r, -0.72 * r);
  ctx.stroke();
}

/**
 * Vautour en vol (hors d'atteinte), vu de dessus : grandes ailes ouvertes, couvertures brunes, rémiges sombres
 * en doigts écartés, queue en éventail, collerette et tête rose ; haut au-dessus de son ombre.
 */
export function drawSoaring(ctx: Ctx, x: number, y: number, r: number, t: number, seed: number, height = 4.2, beat = 0, heading?: number, tint = '') {
  // tint : robe de l'Alpha (voir variantFilter), appliquée aux couleurs pendant le dessin (voir tint.ts)
  if (tint) withTint(ctx, tint, () => soaring(ctx, x, y, r, t, seed, height, beat, heading));
  else soaring(ctx, x, y, r, t, seed, height, beat, heading);
}
function soaring(ctx: Ctx, x: number, y: number, r: number, t: number, seed: number, height: number, beat: number, heading: number | undefined) {
  // il plane, et de temps en temps (ou au décollage et à l'atterrissage : beat) il bat franchement des ailes
  const cyc = (t * 0.23 + seed * 0.37) % 1, burst = Math.max(beat, cyc < 0.18 ? Math.sin((cyc / 0.18) * Math.PI) : 0);
  const flap = Math.sin(t * 2.2 + seed) * 0.12 + Math.sin(t * 11 + seed) * 0.5 * burst, h = r * height + Math.sin(t * 1.3 + seed) * r * 0.3;
  const span = r * 2.1 * (1 - 0.12 * burst * Math.abs(Math.sin(t * 11 + seed))), tilt = Math.sin(t * 0.9 + seed) * 0.08; // il penche dans les virages
  ctx.save();
  ctx.translate(x, y - h);
  ctx.rotate(tilt + (heading === undefined ? 0 : heading + Math.PI / 2)); // la tête vers où il va
  // queue en éventail
  ctx.fillStyle = '#2A201B';
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, r * 0.5);
  ctx.lineTo(-r * 0.32, r * 1.05);
  ctx.quadraticCurveTo(0, r * 1.18, r * 0.32, r * 1.05);
  ctx.lineTo(r * 0.2, r * 0.5);
  ctx.closePath();
  ctx.fill();
  for (const side of [-1, 1]) {
    const f = -r * flap;
    // aile : couvertures brunes devant, rémiges sombres derrière
    ctx.fillStyle = '#2A201B';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.05);
    ctx.quadraticCurveTo(side * span * 0.5, -r * 0.45 + f, side * span, -r * 0.1 + f);
    for (let k = 0; k < 5; k++) {
      const fx = side * (span - k * r * 0.16), fy = r * (0.18 + k * 0.05) + f;
      ctx.lineTo(fx + side * r * 0.06, fy);
      ctx.lineTo(fx - side * r * 0.04, fy - r * 0.12);
    }
    ctx.quadraticCurveTo(side * span * 0.35, r * 0.55, 0, r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4E3D33';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.05);
    ctx.quadraticCurveTo(side * span * 0.5, -r * 0.45 + f, side * span * 0.85, -r * 0.15 + f);
    ctx.quadraticCurveTo(side * span * 0.45, r * 0.05 + f * 0.5, 0, r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(237,227,204,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 5; k++) {
      const px = side * span * (k / 5.5);
      ctx.moveTo(px, -r * 0.3 + f * (k / 5) + r * 0.05 * k * 0.3);
      ctx.lineTo(px + side * r * 0.08, r * 0.2 + f * (k / 5));
    }
    ctx.stroke();
  }
  // corps, collerette, tête
  ctx.fillStyle = '#3E3029';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.26, r * 0.55, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = k % 2 ? '#C9BC9E' : '#EDE3CC';
    ctx.beginPath();
    ctx.arc(Math.cos((k / 6) * TAU) * r * 0.16, -r * 0.33 + Math.sin((k / 6) * TAU) * r * 0.08, r * 0.1, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#D98A7E';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.58, r * 0.13, r * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E8D9B0';
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, -r * 0.7);
  ctx.lineTo(0, -r * 0.86);
  ctx.lineTo(r * 0.05, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Ombre au sol d'un vautour qui plane : c'est là qu'il fondra. */
export function drawSoaringShadow(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(8,14,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.5, r * 1.6, r * 0.45, 0, 0, TAU);
  ctx.fill();
}

/**
 * Sous le sable (UNIT_FLAG_HIDDEN) : le ver n'est qu'une rangée de trois bosses fissurées qui ondulent en vague
 * (son corps juste dessous), d'où retombe du sable ; le suricate, rien (il est dans sa tanière, dessinée avec le sol).
 */
export function drawBurrow(ctx: Ctx, x: number, y: number, r: number, worm: boolean, t: number, seed: number) {
  if (!worm) return; // suricate : caché dans sa tanière
  const gy = y + r * 0.35; // le sol, sous le ver
  ctx.fillStyle = 'rgba(8,14,12,0.14)';
  ctx.beginPath();
  ctx.ellipse(x + 2, gy + r * 0.12, r * 1.3, r * 0.2, 0, 0, TAU);
  ctx.fill();
  for (let k = 2; k >= 0; k--) {
    const ph = t * 4 + seed - k * 1.1, bx = x - r * 0.78 + k * r * 0.78, lift = 0.75 + Math.sin(ph) * 0.25;
    const rr = r * (0.46 + (k === 1 ? 0.16 : 0)); // la bosse du milieu, plus grosse
    ctx.fillStyle = k % 2 ? '#C8A46E' : '#C29C64';
    ctx.beginPath();
    ctx.ellipse(bx, gy, rr, rr * 1.05 * lift, 0, Math.PI, 0);
    ctx.lineTo(bx + rr, gy + rr * 0.2);
    ctx.lineTo(bx - rr, gy + rr * 0.2);
    ctx.fill();
    ctx.fillStyle = '#DDBE88';
    ctx.beginPath();
    ctx.ellipse(bx - rr * 0.25, gy - rr * 0.45 * lift, rr * 0.45, rr * 0.16, -0.2, 0, TAU);
    ctx.fill();
    // fissure au sommet
    ctx.strokeStyle = 'rgba(120,88,48,0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(bx - rr * 0.35, gy - rr * 0.55 * lift);
    ctx.lineTo(bx - rr * 0.05, gy - rr * 0.68 * lift);
    ctx.lineTo(bx + rr * 0.3, gy - rr * 0.5 * lift);
    ctx.stroke();
  }
  // sable qui retombe des sommets
  ctx.fillStyle = 'rgba(221,190,136,0.9)';
  for (let k = 0; k < 6; k++) {
    const ph = (t * 1.6 + k / 6 + seed * 0.1) % 1, side = k > 2 ? 1 : -1, bx = x - r * 0.78 + (k % 3) * r * 0.78 + side * 4;
    ctx.beginPath();
    ctx.arc(bx + ph * 6 * side, gy - r * 0.45 + ph * r * 0.5, 1.6 * (1 - ph * 0.5), 0, TAU);
    ctx.fill();
  }
}

/**
 * Scorpion des dunes (Mer de sable, de jour) : carapace ambrée en plaques, quatre paires de pattes articulées qui
 * trottinent, deux grosses pinces en avant, et la queue segmentée dressée en arc par-dessus le dos, dard pointé vers
 * l'avant (il se balance, prêt à piquer).
 */
export function scorpion(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const boss = !!SPECIES[u.species]?.boss; // le Scorpion Empereur : carapace rouge sang et noire, dard doré
  const shell = W(boss ? '#7A2E22' : '#C8913E'), plate = W(boss ? '#4E1C16' : '#A8752E'), dark = W(boss ? '#2A100C' : '#6E4A1E');
  const light = W(boss ? '#B8584A' : '#E8B866'), sting = W(boss ? '#F0B64A' : '#3A2614');
  const t = u.t + u.seed;
  // pattes : 4 par côté, articulées ; celles du fond d'abord, plus sombres
  const leg = (hx: number, hy: number, kx: number, ky: number, fx: number, fy: number, c: string) => {
    for (const [col, w] of [['rgba(12,18,16,0.85)', 0.13], [c, 0.07]] as const) {
      ctx.strokeStyle = col;
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
  const legs = (back: boolean) => {
    // éventail : les pattes de devant pointent vers l'avant, celles de derrière vers l'arrière, genoux relevés
    for (let i = 0; i < 4; i++) {
      const walk = u.moving ? Math.sin(t * 16 + i * 1.6 + (back ? Math.PI : 0)) * 0.08 : 0;
      const hx = 0.22 - i * 0.17, dir = (1.5 - i) * 0.22 + walk, lift = u.moving ? Math.max(0, Math.sin(t * 16 + i * 1.6 + (back ? Math.PI : 0))) * 0.06 : 0;
      if (back) leg(hx, -0.05, hx + dir * 0.9 - 0.04, -0.34, hx + dir * 1.9, 0.34 - lift, dark);
      else leg(hx, 0.15, hx + dir * 0.9 + 0.04, -0.12, hx + dir * 2.0, 0.5 - lift, plate);
    }
  };
  legs(true);
  // queue : un arc de cinq anneaux qui monte au-dessus du dos (d'abord le trait, puis les anneaux), qui se balance
  const sway = Math.sin(t * 2.4) * 0.06, poised = u.moving ? 0 : Math.sin(t * 5) * 0.03;
  const seg: [number, number][] = [[-0.55, -0.08], [-0.82, -0.32], [-0.92, -0.62], [-0.8, -0.92], [-0.52 + sway, -1.1 + poised]];
  ctx.strokeStyle = 'rgba(12,18,16,0.8)';
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  seg.forEach(([x, y], k) => (k ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
  ctx.stroke();
  ctx.strokeStyle = plate;
  ctx.lineWidth = r * 0.2;
  ctx.stroke();
  seg.forEach(([x, y], k) => {
    ctx.fillStyle = k % 2 ? plate : shell;
    ctx.beginPath();
    ctx.ellipse(x * r, y * r, (0.15 - k * 0.01) * r, (0.13 - k * 0.008) * r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,18,16,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.stroke();
  });
  // dard : bulbe à venin et crochet noir, pointé vers l'avant et le bas
  const [bx, by] = seg[4];
  ctx.fillStyle = W(boss ? '#A8402E' : '#D9A04A');
  ctx.beginPath();
  ctx.ellipse((bx + 0.2) * r, (by + 0.02) * r, 0.14 * r, 0.11 * r, 0.3, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.35);
  ctx.fillStyle = sting;
  ctx.beginPath();
  ctx.moveTo((bx + 0.3) * r, (by - 0.04) * r);
  ctx.quadraticCurveTo((bx + 0.5) * r, (by + 0.02) * r, (bx + 0.44) * r, (by + 0.24) * r);
  ctx.lineTo((bx + 0.3) * r, (by + 0.08) * r);
  ctx.closePath();
  ctx.fill();
  // corps : carapace allongée, basse, en plaques
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(-0.1 * r, 0.05 * r, 0.62 * r, 0.32 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  ctx.strokeStyle = dark;
  ctx.lineWidth = r * 0.035;
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const x = (-0.5 + k * 0.18) * r;
    ctx.moveTo(x, -0.2 * r);
    ctx.quadraticCurveTo(x + 0.05 * r, 0.05 * r, x, 0.3 * r);
  }
  ctx.stroke();
  ctx.fillStyle = light; // reflet du soleil sur la carapace
  ctx.beginPath();
  ctx.ellipse(-0.15 * r, -0.12 * r, 0.32 * r, 0.06 * r, -0.05, 0, TAU);
  ctx.fill();
  legs(false);
  // pinces : bras courbé puis grosse pince ouverte, qui claque de temps en temps
  const snap = Math.max(0, Math.sin(t * 3.1)) ** 8;
  for (const [side, c] of [[-1, plate], [1, shell]] as const) {
    const ax = 0.45, ay = 0.05 + side * 0.08, ex = 0.75, ey = 0.1 + side * 0.18, px = 1.0, py = 0.02 + side * 0.16;
    ctx.strokeStyle = 'rgba(12,18,16,0.85)';
    ctx.lineWidth = r * 0.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax * r, ay * r);
    ctx.lineTo(ex * r, ey * r);
    ctx.lineTo(px * r, py * r);
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = r * 0.09;
    ctx.stroke();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse((px + 0.05) * r, py * r, 0.17 * r, 0.12 * r, 0, 0, TAU);
    ctx.fill();
    ink(ctx, r * 0.4);
    // les deux mâchoires de la pince
    const open = 0.35 * (1 - snap);
    for (const j of [-1, 1]) {
      ctx.fillStyle = j < 0 ? c : dark;
      ctx.beginPath();
      ctx.moveTo((px + 0.15) * r, (py + j * 0.03) * r);
      ctx.quadraticCurveTo((px + 0.32) * r, (py + j * (0.06 + open * 0.3)) * r, (px + 0.42) * r, (py + j * open * 0.25) * r);
      ctx.lineTo((px + 0.2) * r, (py + j * 0.01) * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.25);
    }
  }
  // tête basse, petits yeux noirs groupés sur le dessus
  ctx.fillStyle = plate;
  ctx.beginPath();
  ctx.ellipse(0.45 * r, 0.02 * r, 0.18 * r, 0.16 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.4);
  glowEye(ctx, 0.5 * r, -0.07 * r, 0.045 * r, u.alpha ? '#B48CFF' : '#1A1008', u.wild, !!u.alpha);
  glowEye(ctx, 0.41 * r, -0.09 * r, 0.035 * r, u.alpha ? '#B48CFF' : '#1A1008', u.wild, !!u.alpha);
}

// ───────────────────────── Dragons des îlots du large ─────────────────────────
// Trois cousins, du plus petit au plus grand (cf. le bestiaire) : le drake (pas d'ailes, quatre pattes), la wyverne
// (deux ailes, deux pattes : elle marche sur ses poignets d'ailes) et le dragon (deux ailes, quatre pattes). Dessinés
// de profil, tournés vers la droite, en unités de r ; silhouettes d'un seul tenant, membres effilés.
