// Dragons des îlots du large : drake, wyverne, dragonnet, et ce qu'ils ont en commun (tête, ailes, écailles).

import { SPECIES } from '../../../shared/config.ts';
import type { Wings } from '../anim.ts';
import { TAU, blot, gait, glowEye, ink, type Ctx, type UnitLook } from './outils.ts';

export type P2 = [number, number];
const lerpP = (a: P2, b: P2, k: number): P2 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
/** Points d'une courbe de Bézier quadratique (en unités de r). */
export const bez = (a: P2, c: P2, b: P2, n = 10): P2[] => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
});
/**
 * Bande effilée le long d'une ligne (cou, queue, membre) : largeur w0 au départ, w1 au bout ; remplie, puis cernée.
 * shade : un dessous plus sombre, sur toute la longueur.
 */
export function band(ctx: Ctx, r: number, pts: P2[], w0: number, w1: number, col: string, shade?: string, outline = true) {
  const L: P2[] = [], R: P2[] = [];
  pts.forEach((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
    const dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * (i / (pts.length - 1))) / 2;
    L.push([p[0] - (dy / l) * w, p[1] + (dx / l) * w]);
    R.push([p[0] + (dy / l) * w, p[1] - (dx / l) * w]);
  });
  const path = (a: P2[], b: P2[]) => {
    ctx.beginPath();
    a.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i][0] * r, b[i][1] * r);
    ctx.closePath();
  };
  ctx.fillStyle = col;
  path(L, R);
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = 'rgba(12,18,16,0.8)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  if (shade) {
    // le dessous, un tiers de la largeur, plus sombre
    const mid = pts.map((p, i): P2 => [(p[0] * 2 + R[i][0]) / 3, (p[1] * 2 + R[i][1]) / 3]);
    ctx.fillStyle = shade;
    path(mid, R);
    ctx.fill();
  }
}
/** Patte griffue (cuisse, jambe, pied) : genou (k), cheville (a), orteils (f) ; trois griffes claires. */
function clawLeg(ctx: Ctx, r: number, hip: P2, k: P2, a: P2, f: P2, w: number, col: string, shade: string, claw: string) {
  // une seule bande, du haut de la cuisse aux orteils, qui passe en douceur par le genou et la cheville
  const pts = [...bez(hip, [(hip[0] + k[0]) / 2 + 0.05, (hip[1] + k[1]) / 2], k, 5), ...bez(k, [(k[0] + a[0]) / 2 - 0.02, (k[1] + a[1]) / 2], a, 4).slice(1), ...bez(a, [(a[0] + f[0]) / 2, (a[1] + f[1]) / 2 - 0.02], f, 3).slice(1)];
  band(ctx, r, pts, w, w * 0.3, col, shade);
  // la cuisse, bien musclée
  const ang = Math.atan2(k[1] - hip[1], k[0] - hip[0]) - Math.PI / 2, mx = hip[0] * 0.75 + k[0] * 0.25, my = hip[1] * 0.75 + k[1] * 0.25;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(mx * r, my * r, w * 0.55 * r, w * 0.72 * r, ang, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.35);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse((mx + w * 0.12) * r, (my + w * 0.18) * r, w * 0.25 * r, w * 0.42 * r, ang, 0, TAU);
  ctx.fill();
  ctx.fillStyle = claw;
  for (const d of [-0.06, 0, 0.06]) {
    ctx.beginPath();
    ctx.moveTo((f[0] + d - 0.02) * r, (f[1] - 0.02) * r);
    ctx.quadraticCurveTo((f[0] + d + 0.07) * r, (f[1] - 0.01) * r, (f[0] + d + 0.08) * r, (f[1] + 0.05) * r);
    ctx.lineTo((f[0] + d + 0.02) * r, (f[1] + 0.03) * r);
    ctx.closePath();
    ctx.fill();
  }
}
/** Écailles en rangées de petits arcs, dans une bande (x0 → x1) qui suit la ligne y(x) ; t : leur couleur. */
function scaleRows(ctx: Ctx, r: number, x0: number, x1: number, y: (x: number) => number, rows: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(0.8, r * 0.018);
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    for (let x = x0 + (row % 2) * 0.05; x < x1; x += 0.1) {
      const cy = y(x) + row * 0.08;
      ctx.moveTo((x - 0.05) * r, cy * r);
      ctx.quadraticCurveTo(x * r, (cy + 0.05) * r, (x + 0.05) * r, cy * r);
    }
  }
  ctx.stroke();
}
/** Rangée d'épines le long de pts (vers le haut de la courbe), de hauteur h. */
function spines(ctx: Ctx, r: number, pts: P2[], h: number, col: string) {
  ctx.fillStyle = col;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1], k = h * (1 - Math.abs(i / (pts.length - 1) - 0.4) * 0.9);
    ctx.beginPath();
    ctx.moveTo(((x + px) / 2) * r, ((y + py) / 2) * r);
    ctx.lineTo((x - 0.05) * r, (y - k) * r);
    ctx.lineTo(((x + nx) / 2) * r, ((y + ny) / 2) * r);
    ctx.closePath();
    ctx.fill();
    ink(ctx, r * 0.15);
  }
}
/** Tête de dragon (museau long, mâchoire, crocs, cornes vers l'arrière, œil qui luit) ; gape : gueule ouverte (0 à 1). */
function dragonHead(ctx: Ctx, r: number, hx: number, hy: number, s: number, o: {
  col: string; shade: string; horn: string; eye: string; gape: number; horns: number; teeth?: string; glow?: boolean; frill?: string;
}) {
  const X = (x: number) => (hx + x * s) * r, Y = (y: number) => (hy + y * s) * r, g = o.gape * 0.12;
  // cornes : deux grandes vers l'arrière, une petite
  ctx.fillStyle = o.horn;
  for (const [dx, k] of [[-0.12, 1], [0.02, 0.7]] as const) {
    // corne épaisse à la base, qui se courbe vers l'arrière puis remonte
    const tx = dx - 0.45 * k, ty = -0.22 - o.horns * 0.32 * k;
    ctx.beginPath();
    ctx.moveTo(X(dx - 0.07), Y(-0.08));
    ctx.quadraticCurveTo(X(dx - 0.3 * k), Y(-0.12), X(tx), Y(ty));
    ctx.quadraticCurveTo(X(dx - 0.18 * k), Y(-0.24 * k), X(dx + 0.08), Y(-0.12));
    ctx.closePath();
    ctx.fill();
    ink(ctx, r * 0.22 * s);
    ctx.strokeStyle = 'rgba(12,18,16,0.3)'; // anneaux de la corne
    ctx.lineWidth = Math.max(0.8, r * 0.012 * s);
    ctx.beginPath();
    for (const f of [0.3, 0.55]) {
      const cx = dx + (tx - dx) * f, cy = -0.1 + (ty + 0.1) * f;
      ctx.moveTo(X(cx - 0.02), Y(cy - 0.04));
      ctx.lineTo(X(cx + 0.03), Y(cy + 0.03));
    }
    ctx.stroke();
  }
  // collerette d'épines à la joue
  if (o.frill) {
    ctx.fillStyle = o.frill;
    ctx.beginPath();
    ctx.moveTo(X(-0.16), Y(-0.04));
    ctx.lineTo(X(-0.36), Y(-0.06));
    ctx.lineTo(X(-0.2), Y(0.04));
    ctx.lineTo(X(-0.34), Y(0.14));
    ctx.lineTo(X(-0.12), Y(0.1));
    ctx.closePath();
    ctx.fill();
    ink(ctx, r * 0.15 * s);
  }
  // gueule ouverte : le fond
  if (o.gape > 0.05) {
    ctx.fillStyle = o.glow ? '#FF8A3A' : '#3A0E0A';
    ctx.beginPath();
    ctx.moveTo(X(0.0), Y(0.04));
    ctx.lineTo(X(0.46), Y(0.02));
    ctx.lineTo(X(0.4), Y(0.1 + g * 2));
    ctx.closePath();
    ctx.fill();
  }
  // mâchoire du bas
  ctx.fillStyle = o.shade;
  ctx.beginPath();
  ctx.moveTo(X(-0.12), Y(0.06));
  ctx.quadraticCurveTo(X(0.2), Y(0.12 + g), X(0.42), Y(0.06 + g * 1.6));
  ctx.lineTo(X(0.4), Y(0.12 + g * 1.6));
  ctx.quadraticCurveTo(X(0.15), Y(0.2 + g), X(-0.12), Y(0.16));
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.3 * s);
  // crâne et museau : arcade marquée, narine
  ctx.fillStyle = o.col;
  ctx.beginPath();
  ctx.moveTo(X(-0.18), Y(0.1));
  ctx.quadraticCurveTo(X(-0.2), Y(-0.14), X(0.0), Y(-0.15));
  ctx.quadraticCurveTo(X(0.12), Y(-0.16), X(0.18), Y(-0.08));
  ctx.quadraticCurveTo(X(0.4), Y(-0.08), X(0.5), Y(-0.01));
  ctx.quadraticCurveTo(X(0.52), Y(0.04), X(0.46), Y(0.05));
  ctx.lineTo(X(0.0), Y(0.06));
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.35 * s);
  ctx.fillStyle = o.shade;
  ctx.beginPath();
  ctx.ellipse(X(0.04), Y(-0.07), 0.1 * s * r, 0.03 * s * r, -0.1, 0, TAU); // arcade
  ctx.fill();
  blot(ctx, X(0.44), Y(-0.02), 0.025 * s * r, 0.015 * s * r, '#1A0E08'); // narine
  // crocs (du haut, qui dépassent même gueule fermée)
  ctx.fillStyle = o.teeth ?? '#F2EBD8';
  for (const x of [0.12, 0.24, 0.36]) {
    ctx.beginPath();
    ctx.moveTo(X(x), Y(0.05));
    ctx.lineTo(X(x + 0.02), Y(0.11 + g * 0.5));
    ctx.lineTo(X(x + 0.045), Y(0.05));
    ctx.closePath();
    ctx.fill();
  }
  glowEye(ctx, X(0.03), Y(-0.03), 0.04 * s * r, o.eye, true, true);
}

/**
 * Drake des marées (îlots du large, le plus petit) : un dragon sans ailes, trapu, sur quatre pattes griffues ; une crête
 * de plaques osseuses du crâne au bout de la queue, des écailles en rangées, le ventre pâle annelé. Il crache de l'eau.
 * Son géant (Marégrave) : bleu d'orage, plaques plus hautes, l'écume crépite le long de sa crête.
 */
export function drake(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c), boss = !!SPECIES[u.species]?.boss;
  const col = W(boss ? '#245A68' : '#2F7E86'), shade = W(boss ? '#163A46' : '#1F5A60'), belly = W(boss ? '#A8C8C0' : '#C8E0D0');
  const plate = W(boss ? '#D8E8E8' : '#E8DCC0'), scaleLine = W(boss ? '#123038' : '#1A4A50');
  const g = gait(u, 9), t = u.t + u.seed, sway = Math.sin(t * 3) * 0.06, breathe = Math.sin(t * 2) * 0.01;
  const legPose = (i: number, hx: number, back: boolean) => {
    const k = g[i].a * 0.2, up = g[i].lift * 0.09;
    clawLeg(ctx, r, [hx, 0.05], [hx - 0.06 + k * 0.4, 0.34 - up * 0.5], [hx + 0.04 + k * 0.8, 0.56 - up], [hx + 0.1 + k, 0.7 - up], 0.26, back ? shade : col, shade, W('#F2EBD8'));
  };
  legPose(0, -0.45, true);
  legPose(1, 0.32, true);
  // la silhouette : queue → dos → cou, d'un seul tenant (bande effilée de la queue au garrot), puis le corps
  const tail = bez([-0.4, -0.05], [-1.0, 0.0 + sway], [-1.55, -0.25 + sway * 2], 14);
  band(ctx, r, tail, 0.42, 0.04, col, shade);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, -0.05 * r);
  ctx.quadraticCurveTo(-0.5 * r, (-0.46 + breathe) * r, 0.05 * r, (-0.44 + breathe) * r);
  ctx.quadraticCurveTo(0.45 * r, (-0.46 + breathe) * r, 0.62 * r, -0.2 * r);
  ctx.quadraticCurveTo(0.7 * r, 0.12 * r, 0.42 * r, 0.26 * r);
  ctx.quadraticCurveTo(-0.05 * r, 0.36 * r, -0.5 * r, 0.24 * r);
  ctx.quadraticCurveTo(-0.72 * r, 0.12 * r, -0.62 * r, -0.05 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  // ventre annelé
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(-0.45 * r, 0.16 * r);
  ctx.quadraticCurveTo(0.0, 0.32 * r, 0.48 * r, 0.14 * r);
  ctx.quadraticCurveTo(0.4 * r, 0.26 * r, 0.0, 0.31 * r);
  ctx.quadraticCurveTo(-0.35 * r, 0.3 * r, -0.45 * r, 0.16 * r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(0.8, r * 0.018);
  ctx.beginPath();
  for (let x = -0.35; x < 0.45; x += 0.1) {
    ctx.moveTo(x * r, (0.2 + Math.cos(x * 2) * 0.05) * r);
    ctx.lineTo((x + 0.01) * r, (0.3 - Math.abs(x) * 0.08) * r);
  }
  ctx.stroke();
  scaleRows(ctx, r, -0.5, 0.5, (x) => -0.34 + x * x * 0.25, 3, scaleLine);
  // crête de plaques osseuses : du garrot au bout de la queue
  spines(ctx, r, [...bez([0.55, -0.32], [0.1, -0.52 + breathe], [-0.55, -0.12], 6), ...tail.filter((_, i) => i >= 2 && i <= 12 && i % 2 === 0).map((p): P2 => [p[0], p[1] - 0.1])], boss ? 0.3 : 0.22, plate);
  // cou court et puissant, tête basse
  const hx = 0.86, hy = -0.36 + breathe;
  band(ctx, r, bez([0.45, -0.18], [0.62, -0.42], [hx - 0.08, hy + 0.02], 8), 0.4, 0.24, col, shade);
  dragonHead(ctx, r, hx, hy, 0.95, { col, shade, horn: plate, eye: u.alpha ? '#B48CFF' : boss ? '#9FE8FF' : '#F0D24A', gape: (u.charge ?? 0) + (u.wild ? Math.max(0, Math.sin(t * 1.6)) * 0.4 : 0), horns: boss ? 1 : 0.6, frill: plate });
  if ((u.charge ?? 0) > 0) blot(ctx, (hx + 0.5) * r, (hy + 0.06) * r, (0.04 + (u.charge ?? 0) * 0.08) * r, (0.03 + (u.charge ?? 0) * 0.05) * r, 'rgba(170,225,245,0.85)'); // l'eau monte dans sa gueule
  legPose(2, -0.32, false);
  legPose(3, 0.45, false);
  if (boss && !u.flash) {
    // l'écume crépite le long de la crête
    const z = Math.floor(t * 8) % 5, [sx, sy] = bez([0.55, -0.32], [0.1, -0.52], [-0.55, -0.12], 4)[z];
    ctx.strokeStyle = 'rgba(200,245,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    ctx.moveTo(sx * r, (sy - 0.3) * r);
    ctx.lineTo((sx + 0.05) * r, (sy - 0.4) * r);
    ctx.lineTo((sx - 0.02) * r, (sy - 0.46) * r);
    ctx.lineTo((sx + 0.05) * r, (sy - 0.58) * r);
    ctx.stroke();
  }
}

/** Aile de dragon (membrane tendue entre les doigts), de l'épaule s vers le poignet w ; spread : 0 repliée, 1 déployée. */
function dragonWing(ctx: Ctx, r: number, s: P2, w: P2, tips: P2[], bone: string, skin: string, edge: string) {
  // la membrane : de l'épaule au poignet, puis d'un bout de doigt à l'autre, en festons, jusqu'au flanc
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(s[0] * r, s[1] * r);
  ctx.lineTo(w[0] * r, w[1] * r);
  tips.forEach((tp, i) => {
    const prev = i ? tips[i - 1] : w;
    if (i) ctx.quadraticCurveTo(((prev[0] + tp[0]) / 2 + (w[0] - (prev[0] + tp[0]) / 2) * 0.25) * r, ((prev[1] + tp[1]) / 2 + (w[1] - (prev[1] + tp[1]) / 2) * 0.25) * r, tp[0] * r, tp[1] * r);
    else ctx.lineTo(tp[0] * r, tp[1] * r);
  });
  ctx.quadraticCurveTo(((tips[tips.length - 1][0] + s[0]) / 2) * r, ((tips[tips.length - 1][1] + s[1]) / 2 + 0.1) * r, (s[0] - 0.05) * r, (s[1] + 0.12) * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.4);
  // veines de la membrane, plus claires
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(0.8, r * 0.015);
  ctx.beginPath();
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1], b = tips[i];
    ctx.moveTo(w[0] * r, w[1] * r);
    ctx.quadraticCurveTo(((a[0] + b[0]) / 2) * r, ((a[1] + b[1]) / 2) * r, ((a[0] + b[0]) / 2 + (s[0] - (a[0] + b[0]) / 2) * 0.3) * r, ((a[1] + b[1]) / 2 + 0.05) * r);
  }
  ctx.stroke();
  // les os : bras (épaule → poignet), doigts (poignet → bouts), griffe au poignet
  band(ctx, r, [s, w], 0.1, 0.07, bone);
  for (const tp of tips) band(ctx, r, [w, tp], 0.05, 0.015, bone, undefined, false);
  ctx.fillStyle = '#F2EBD8';
  ctx.beginPath();
  ctx.moveTo(w[0] * r, w[1] * r);
  ctx.lineTo((w[0] + 0.05) * r, (w[1] - 0.12) * r);
  ctx.lineTo((w[0] + 0.07) * r, (w[1] - 0.01) * r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Wyverne des falaises (îlots du large) : deux pattes, deux ailes (ses bras), repliées en voile au-dessus du dos ; debout
 * sur ses pattes arrière, penchée en avant ; long cou, crête de cornes, queue fine terminée par un dard à venin.
 * Son géant (Vipéra, la Reine des Falaises) : écailles presque noires, membranes pourpres, dard et yeux d'un vert poison.
 */
export function wyvern(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c), boss = !!SPECIES[u.species]?.boss;
  const col = W(boss ? '#2E3826' : '#5A6A3A'), shade = W(boss ? '#1A2014' : '#3A4626'), belly = W(boss ? '#7A7A50' : '#B8B080');
  const skin = W(boss ? '#4A1E4E' : '#7A5A7E'), skinBack = W(boss ? '#341436' : '#5A425E'), vein = W(boss ? '#7A3A7E' : '#A88AA8');
  const bone = W(boss ? '#3A4430' : '#6A7A48'), horn = W('#D8D0B8'), venom = boss ? '#9FE84A' : '#C8E86A';
  const g = gait(u, 8), t = u.t + u.seed, flap = Math.sin(t * (u.moving ? 5 : 1.5)) * (u.moving ? 0.06 : 0.03);
  // ailes : repliées en voile au repos ; en attaque, déployées, rabattues vers le sol, ou qui battent (vers l'avant : la charge)
  // en vol (sans attaque en cours) : ailes déployées qui battent, au lieu d'être repliées en voile
  const soar: Wings | undefined = u.flying && !u.wings ? { spread: 0.85, down: 0, beat: Math.sin(t * 4.5), fwd: 0 } : undefined;
  const wing = (fold: P2[], open: P2[], low: P2[]): P2[] => {
    const w = u.wings ?? soar;
    if (!w) return fold;
    return fold.map((p, i) => {
      const mid = lerpP(p, open[i], w.spread), at = lerpP(mid, low[i], w.down), reach = i ? 1 : 0.4; // le poignet bouge moins que les bouts
      return [at[0] + w.beat * w.fwd * 0.3 * reach, at[1] + w.beat * 0.38 * reach * (1 - w.down)];
    });
  };
  const [bw, ...bt] = wing(
    [[0.32 + flap, -0.95], [-0.15, -1.28 - flap], [-0.55, -1.08 - flap], [-0.75, -0.62], [-0.55, -0.3]],
    [[0.05, -1.35], [-0.25, -2.2], [-0.95, -2.1], [-1.6, -1.5], [-1.15, -0.5]],
    [[0.62, -0.42], [0.98, 0.42], [0.52, 0.72], [0.02, 0.64], [-0.25, 0.22]],
  );
  const [fw, ...ft] = wing(
    [[0.42 + flap, -0.82], [0.0, -1.18 - flap], [-0.42, -1.0 - flap], [-0.62, -0.58], [-0.42, -0.22]],
    [[0.85, -1.2], [1.35, -1.95], [0.75, -2.2], [0.05, -1.95], [-0.3, -0.7]],
    [[0.78, -0.36], [1.18, 0.46], [0.72, 0.78], [0.16, 0.72], [-0.15, 0.26]],
  );
  // aile du fond (repliée, un peu plus haute), puis sa patte de poignet
  dragonWing(ctx, r, [0.1, -0.32], bw, bt, bone, skinBack, vein);
  // queue fine et longue, qui fouette ; le dard
  const sw = Math.sin(t * 2.4) * 0.12;
  const tail = bez([-0.3, -0.02], [-1.0, 0.25 + sw], [-1.45, -0.3 + sw], 14);
  band(ctx, r, tail, 0.3, 0.05, col, shade);
  const [tx, ty] = tail[tail.length - 1];
  ctx.fillStyle = horn;
  ctx.beginPath();
  ctx.moveTo(tx * r, (ty + 0.04) * r);
  ctx.quadraticCurveTo((tx - 0.18) * r, (ty - 0.02) * r, (tx - 0.28) * r, (ty - 0.2) * r);
  ctx.quadraticCurveTo((tx - 0.06) * r, (ty - 0.12) * r, (tx + 0.02) * r, (ty - 0.04) * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.2);
  if (!u.flash) blot(ctx, (tx - 0.28) * r, (ty - 0.16 + ((t * 0.8) % 1) * 0.3) * r, 0.025 * r, 0.04 * r, venom); // une goutte de venin
  // patte arrière du fond
  const leg = (i: number, hx: number, c: string) => {
    const k = g[i].a * 0.2, up = g[i].lift * 0.09;
    clawLeg(ctx, r, [hx, 0.0], [hx + 0.14 + k * 0.4, 0.26 - up * 0.5], [hx - 0.02 + k * 0.8, 0.52 - up], [hx + 0.06 + k, 0.7 - up], 0.3, c, shade, horn);
  };
  leg(0, -0.12, shade);
  // corps en poire, penché vers l'avant, ventre clair et rayé
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-0.45 * r, 0.02 * r);
  ctx.quadraticCurveTo(-0.4 * r, -0.38 * r, 0.05 * r, -0.4 * r);
  ctx.quadraticCurveTo(0.42 * r, -0.4 * r, 0.42 * r, -0.08 * r);
  ctx.quadraticCurveTo(0.38 * r, 0.24 * r, 0.0, 0.26 * r);
  ctx.quadraticCurveTo(-0.38 * r, 0.26 * r, -0.45 * r, 0.02 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(-0.25 * r, 0.18 * r);
  ctx.quadraticCurveTo(0.15 * r, 0.26 * r, 0.38 * r, -0.05 * r);
  ctx.quadraticCurveTo(0.34 * r, 0.18 * r, 0.0, 0.25 * r);
  ctx.closePath();
  ctx.fill();
  scaleRows(ctx, r, -0.35, 0.3, (x) => -0.3 + x * x * 0.4, 3, shade);
  spines(ctx, r, bez([0.3, -0.36], [-0.05, -0.48], [-0.4, -0.12], 6), 0.14, horn);
  leg(2, 0.04, col);
  // long cou en S et tête à crête
  const hx = 0.78, hy = -0.82 + Math.sin(t * 2) * 0.03;
  band(ctx, r, bez([0.25, -0.25], [0.35, -0.75], [hx - 0.1, hy + 0.04], 10), 0.3, 0.15, col, shade);
  dragonHead(ctx, r, hx, hy, 0.75, { col, shade, horn, eye: u.alpha ? '#B48CFF' : boss ? venom : '#F0B64A', gape: u.wild ? Math.max(0, Math.sin(t * 1.4)) * 0.5 : 0, horns: boss ? 1.1 : 0.8 });
  // aile du devant, repliée le long du flanc (ses ailes sont ses bras : la griffe du poignet pointe vers l'avant)
  dragonWing(ctx, r, [0.02, -0.28], fw, ft, bone, skin, vein);
  if (u.wings && u.wings.down > 0.85 && !u.flash) {
    // les ailes fracassent le sol : de la poussière jaillit sous leurs bouts
    const dust = `rgba(200,190,160,${(u.wings.down - 0.85) * 3})`;
    for (const [x, y] of [...bt.slice(0, 2), ...ft.slice(0, 2)]) blot(ctx, x * r, (y + 0.06) * r, 0.18 * r, 0.06 * r, dust);
  }
}

/**
 * Dragonnet de braise (îlots du large, le plus grand) : un vrai dragon, quatre pattes et deux grandes ailes déployées,
 * long cou, cornes, plaques dorées du ventre, épines du dos à la queue en fer de lance ; la braise rougeoie dans sa gueule
 * (il crache des boules de feu). Son géant (Pyrakhan, le Dragon Ancien) : pourpre sombre, cornes d'or, fumée aux naseaux.
 */
export function dragon(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c), boss = !!SPECIES[u.species]?.boss;
  const col = W(boss ? '#6E1E18' : '#B0442E'), shade = W(boss ? '#3E0E0A' : '#702818'), belly = W(boss ? '#D8A040' : '#E8C070');
  const plateLine = W(boss ? '#A06A20' : '#B88A48'), skin = W(boss ? '#8A2A1E' : '#D06A40'), skinBack = W(boss ? '#5A1812' : '#8E4024');
  const vein = W(boss ? '#C05A3A' : '#F0A070'), bone = W(boss ? '#4E1410' : '#7A2A1A'), horn = W(boss ? '#F0B64A' : '#E8DCC0');
  const g = gait(u, 7), t = u.t + u.seed, charge = u.charge ?? 0;
  const beat = Math.sin(t * (u.moving ? 4.5 : 1.4)) * (u.moving ? 0.12 : 0.05);
  // aile du fond, déployée
  dragonWing(ctx, r, [-0.05, -0.36], [0.1, -1.25 - beat], [[-0.35, -1.55 - beat * 1.4], [-0.85, -1.3 - beat], [-1.15, -0.85], [-0.95, -0.42]], bone, skinBack, vein);
  const leg = (i: number, hx: number, back: boolean) => {
    const k = g[i].a * 0.18, up = g[i].lift * 0.09;
    clawLeg(ctx, r, [hx, 0.06], [hx - 0.05 + k * 0.4, 0.36 - up * 0.5], [hx + 0.05 + k * 0.8, 0.56 - up], [hx + 0.11 + k, 0.7 - up], 0.27, back ? shade : col, shade, horn);
  };
  leg(0, -0.45, true);
  leg(1, 0.35, true);
  // queue épaisse en fer de lance
  const sw = Math.sin(t * 2.2) * 0.1;
  const tail = bez([-0.45, -0.05], [-1.05, 0.12 + sw], [-1.55, -0.18 + sw], 14);
  band(ctx, r, tail, 0.4, 0.06, col, shade);
  const [tx, ty] = tail[tail.length - 1];
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo((tx + 0.04) * r, (ty - 0.02) * r);
  ctx.lineTo((tx - 0.12) * r, (ty - 0.16) * r);
  ctx.lineTo((tx - 0.24) * r, (ty + 0.02) * r);
  ctx.lineTo((tx - 0.1) * r, (ty + 0.12) * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r * 0.25);
  // corps massif, poitrail bombé, plaques dorées du ventre
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, -0.08 * r);
  ctx.quadraticCurveTo(-0.5 * r, -0.48 * r, 0.05 * r, -0.46 * r);
  ctx.quadraticCurveTo(0.5 * r, -0.46 * r, 0.62 * r, -0.16 * r);
  ctx.quadraticCurveTo(0.7 * r, 0.16 * r, 0.42 * r, 0.28 * r);
  ctx.quadraticCurveTo(-0.05 * r, 0.38 * r, -0.5 * r, 0.24 * r);
  ctx.quadraticCurveTo(-0.72 * r, 0.1 * r, -0.62 * r, -0.08 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.moveTo(-0.45 * r, 0.14 * r);
  ctx.quadraticCurveTo(0.1 * r, 0.36 * r, 0.6 * r, -0.05 * r);
  ctx.quadraticCurveTo(0.55 * r, 0.24 * r, 0.05 * r, 0.33 * r);
  ctx.quadraticCurveTo(-0.35 * r, 0.32 * r, -0.45 * r, 0.14 * r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = plateLine;
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.beginPath();
  for (let x = -0.35; x < 0.55; x += 0.1) {
    ctx.moveTo(x * r, (0.17 + x * -0.12) * r);
    ctx.lineTo((x + 0.02) * r, (0.33 - Math.max(0, x) * 0.35) * r);
  }
  ctx.stroke();
  scaleRows(ctx, r, -0.5, 0.45, (x) => -0.36 + x * x * 0.25, 3, shade);
  spines(ctx, r, [...bez([0.5, -0.36], [0.0, -0.56], [-0.55, -0.16], 6), ...tail.filter((_, i) => i >= 2 && i <= 12 && i % 2 === 0).map((p): P2 => [p[0], p[1] - 0.12])], boss ? 0.26 : 0.2, horn);
  // long cou dressé, tête cornue ; la braise rougeoie entre ses crocs (plus vive quand il va cracher)
  const hx = 0.92, hy = -0.82 + Math.sin(t * 1.8) * 0.03;
  band(ctx, r, bez([0.4, -0.25], [0.5, -0.8], [hx - 0.08, hy + 0.04], 10), 0.4, 0.2, col, shade);
  // plaques dorées sous le cou
  ctx.strokeStyle = plateLine;
  ctx.lineWidth = Math.max(0.8, r * 0.02);
  ctx.beginPath();
  for (const [x, y] of bez([0.55, -0.15], [0.62, -0.55], [hx - 0.02, hy + 0.12], 6).slice(1, 6)) {
    ctx.moveTo((x - 0.04) * r, y * r);
    ctx.lineTo((x + 0.06) * r, (y - 0.02) * r);
  }
  ctx.stroke();
  dragonHead(ctx, r, hx, hy, 0.95, { col, shade, horn, eye: u.alpha ? '#B48CFF' : '#FFD84A', gape: Math.min(1, charge + 0.25 + Math.max(0, Math.sin(t * 1.5)) * 0.3), horns: boss ? 1.2 : 0.85, glow: true });
  if (!u.flash) {
    const fx = (hx + 0.5 * 0.95) * r, fy = (hy + 0.06) * r, fr = (0.12 + charge * 0.22 + Math.sin(t * 9) * 0.02) * r;
    const fire = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fire.addColorStop(0, 'rgba(255,240,150,0.9)');
    fire.addColorStop(0.5, 'rgba(255,140,40,0.55)');
    fire.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, TAU);
    ctx.fill();
    if (boss) {
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.7 + k / 3) % 1; // fumée qui s'échappe des naseaux
        blot(ctx, (hx + 0.4 + p * 0.3) * r, (hy - 0.05 - p * 0.5) * r, (0.04 + p * 0.09) * r, (0.04 + p * 0.09) * r, `rgba(80,70,70,${0.45 * (1 - p)})`);
      }
    }
  }
  leg(2, -0.32, false);
  leg(3, 0.48, false);
  // aile du devant, déployée
  dragonWing(ctx, r, [0.05, -0.32], [0.3, -1.15 - beat], [[-0.1, -1.6 - beat * 1.4], [-0.62, -1.42 - beat], [-0.98, -0.95], [-0.82, -0.4]], bone, skin, vein);
}
