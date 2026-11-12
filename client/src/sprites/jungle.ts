// Créatures de la Jungle : gorille (et ses bananes), crocodile, petit masqué et son totem.

import { SPECIES } from '../../../shared/config.ts';
import { TAU, blot, eyes, fineInk, gait, ink, jagged, whiteIf, type Ctx, type UnitLook } from './outils.ts';

// ───────────────────────── Jungle (zone 6) ─────────────────────────

/**
 * Gorille des cimes : une masse de muscles qui marche sur ses phalanges ; dos argenté, crête sur le crâne, arcades
 * saillantes, mufle sombre. Ses longs bras avancent l'un après l'autre avec ses jambes courtes ; immobile, il se frappe
 * parfois la poitrine. Le géant : tout le dos argenté, des cicatrices, une crête plus haute.
 */
export function gorilla(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const fur = whiteIf(u, boss ? '#2C2826' : '#3E3A38'), shade = whiteIf(u, boss ? '#1E1B1A' : '#2A2624'), skin = whiteIf(u, '#26201C');
  const silver = whiteIf(u, boss ? '#B8B6B0' : '#8E8C86'), chest = whiteIf(u, '#3A3230');
  const g = gait(u, 7);
  // se frappe la poitrine de temps en temps, à l'arrêt
  const beat = !u.moving && (u.t + u.seed) % 7 < 1.2 ? Math.sin(((u.t + u.seed) % 7) * Math.PI * 6) : 0;
  const breath = Math.sin(u.t * 2 + u.seed) * r * 0.015;
  // une jambe courte et épaisse (arrière)
  const leg = (i: number, x: number, col: string) => {
    ctx.save();
    ctx.translate(x, 0.12 * r);
    ctx.rotate(-g[i].a * 0.3);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(-0.14 * r, -0.05 * r - g[i].lift * 0.06 * r, 0.28 * r, 0.62 * r, 0.1 * r);
    ctx.fill();
    blot(ctx, 0.04 * r, 0.56 * r - g[i].lift * 0.06 * r, 0.17 * r, 0.07 * r, skin);
    ctx.restore();
  };
  // un long bras jusqu'au sol, sur les phalanges (ou levé, pour se frapper la poitrine)
  const arm = (i: number, sx: number, col: string, up: number) => {
    const hx = sx + (up ? 0.12 * r : g[i].a * 0.2 * r), hy = up ? -0.05 * r - up * 0.12 * r : 0.68 * r - g[i].lift * 0.08 * r;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.3 * r;
    ctx.beginPath();
    ctx.moveTo(sx - 0.05 * r, -0.25 * r);
    ctx.quadraticCurveTo(sx + 0.2 * r, 0.2 * r, hx, hy);
    ctx.stroke();
    ctx.lineWidth = 0.2 * r;
    ctx.strokeStyle = shade;
    ctx.beginPath();
    ctx.moveTo(sx + 0.05 * r, 0.15 * r);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    blot(ctx, hx + 0.04 * r, hy, 0.15 * r, 0.1 * r, skin); // poing
  };
  leg(0, -0.42 * r, shade);
  arm(1, 0.28 * r, shade, beat > 0 ? beat : 0);
  // le corps : croupe basse, dos qui monte vers des épaules énormes
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-0.18 * r, 0.02 * r, 0.52 * r, 0.42 * r, 0.25, 0, TAU);
  ctx.ellipse(0.15 * r, -0.22 * r + breath, 0.58 * r, 0.52 * r, -0.15, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-0.18 * r, 0.02 * r, 0.5 * r, 0.4 * r, 0.25, 0, TAU);
  ctx.ellipse(0.15 * r, -0.22 * r + breath, 0.56 * r, 0.5 * r, -0.15, 0, TAU);
  ctx.fill();
  // dos argenté (selle), mèches
  blot(ctx, -0.2 * r, -0.2 * r, boss ? 0.45 * r : 0.34 * r, 0.18 * r, silver, 0.25);
  if (!u.flash) {
    ctx.strokeStyle = 'rgba(220,220,214,0.35)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const x = -0.45 * r + k * 0.1 * r;
      ctx.moveTo(x, -0.26 * r);
      ctx.lineTo(x - 0.04 * r, -0.14 * r);
    }
    ctx.stroke();
    if (boss) {
      ctx.strokeStyle = 'rgba(200,170,160,0.6)'; // vieilles cicatrices
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.moveTo(0.05 * r, -0.5 * r);
      ctx.lineTo(0.25 * r, -0.3 * r);
      ctx.moveTo(0.12 * r, -0.52 * r);
      ctx.lineTo(0.3 * r, -0.36 * r);
      ctx.stroke();
    }
  }
  // poils hérissés en crête le long de l'échine, mousse et liane qui ont poussé sur ses épaules
  ctx.fillStyle = shade;
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    const a = -2.8 + k * 0.17, rr = (k % 2 ? 0.52 : 0.68) * r, x = 0.15 * r + Math.cos(a) * rr * 1.04, y = -0.22 * r + breath + Math.sin(a) * rr * 0.9;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  for (let k = 10; k >= 0; k--) {
    const a = -2.8 + k * 0.17;
    ctx.lineTo(0.15 * r + Math.cos(a) * 0.46 * r, -0.22 * r + breath + Math.sin(a) * 0.42 * r);
  }
  ctx.fill();
  blot(ctx, 0.05 * r, -0.66 * r + breath, 0.2 * r, 0.07 * r, whiteIf(u, '#4E7A3A'), -0.2);
  blot(ctx, 0.3 * r, -0.62 * r + breath, 0.12 * r, 0.05 * r, whiteIf(u, '#5E9A44'), 0.3);
  if (!u.flash) {
    ctx.strokeStyle = '#3E6A2E';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.moveTo(0.0, -0.66 * r + breath);
    ctx.quadraticCurveTo(-0.15 * r, -0.3 * r, -0.05 * r, 0.05 * r);
    ctx.stroke();
    for (const [lx, ly] of [[-0.1, -0.45], [-0.08, -0.2]]) blot(ctx, lx * r, ly * r, 0.06 * r, 0.03 * r, '#5E9A44', 0.6);
  }
  // poitrail nu, plus sombre, et un collier de crocs
  blot(ctx, 0.42 * r, -0.05 * r, 0.2 * r, 0.26 * r, chest);
  ctx.strokeStyle = whiteIf(u, '#6B4A33');
  ctx.lineWidth = Math.max(1, r * 0.025);
  ctx.beginPath();
  ctx.arc(0.55 * r, -0.32 * r + breath, 0.22 * r, 0.6, 2.4);
  ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const a = 0.7 + k * 0.38, x = 0.55 * r + Math.cos(a) * 0.22 * r, y = -0.32 * r + breath + Math.sin(a) * 0.22 * r;
    ctx.fillStyle = whiteIf(u, '#EFE6D0');
    ctx.beginPath();
    ctx.moveTo(x - 0.02 * r, y);
    ctx.lineTo(x, y + 0.08 * r);
    ctx.lineTo(x + 0.02 * r, y);
    ctx.fill();
  }
  leg(2, -0.22 * r, fur);
  arm(3, 0.5 * r, fur, beat < 0 ? -beat : 0);
  // la tête, basse et en avant : crête, arcades, mufle
  const hx = 0.72 * r, hy = -0.32 * r + breath;
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(hx - 0.02 * r, hy - 0.08 * r, 0.27 * r, 0.3 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  ctx.fillStyle = fur;
  ctx.beginPath(); // crête sagittale
  ctx.moveTo(hx - 0.2 * r, hy - 0.2 * r);
  ctx.quadraticCurveTo(hx - 0.05 * r, hy - (boss ? 0.62 : 0.5) * r, hx + 0.12 * r, hy - 0.26 * r);
  ctx.fill();
  blot(ctx, hx + 0.1 * r, hy + 0.02 * r, 0.2 * r, 0.2 * r, skin); // face nue
  blot(ctx, hx + 0.1 * r, hy - 0.1 * r, 0.21 * r, 0.06 * r, shade); // arcades
  blot(ctx, hx + 0.16 * r, hy + 0.12 * r, 0.13 * r, 0.09 * r, whiteIf(u, '#3A302A')); // mufle
  ctx.fillStyle = '#0A0806';
  for (const dx of [0.12, 0.2]) {
    ctx.beginPath();
    ctx.arc(hx + dx * r, hy + 0.08 * r, 0.025 * r, 0, TAU);
    ctx.fill();
  }
  // peintures de guerre blanches sur les joues
  if (!u.flash) {
    ctx.strokeStyle = 'rgba(236,228,210,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    for (const k of [0, 1]) {
      ctx.moveTo(hx - 0.06 * r, hy + (0.02 + k * 0.06) * r);
      ctx.lineTo(hx + 0.04 * r, hy + (0.04 + k * 0.06) * r);
    }
    ctx.stroke();
  }
  // gueule qui gronde : babines retroussées sur de gros crocs
  const snarl = u.wild ? 0.07 + Math.max(0, Math.sin(u.t * 2.5 + u.seed)) * 0.04 : 0.04;
  blot(ctx, hx + 0.16 * r, hy + 0.22 * r, 0.12 * r, snarl * r, '#3A0E0A');
  ctx.fillStyle = whiteIf(u, '#F2EBD8');
  for (const dx of [0.07, 0.24]) {
    ctx.beginPath();
    ctx.moveTo(hx + (dx - 0.025) * r, hy + 0.2 * r - snarl * r * 0.6);
    ctx.lineTo(hx + dx * r, hy + 0.2 * r + snarl * r * 0.9);
    ctx.lineTo(hx + (dx + 0.025) * r, hy + 0.2 * r - snarl * r * 0.6);
    ctx.fill();
  }
  // yeux enfoncés sous les arcades, qui luisent (rouge chez le sauvage)
  for (const dx of [0.03, 0.17]) {
    const col = u.alpha ? '#B48CFF' : u.wild ? '#FF5A2A' : '#E8A43C';
    if (u.wild && !u.flash) blot(ctx, hx + dx * r, hy - 0.04 * r, 0.07 * r, 0.05 * r, 'rgba(255,90,40,0.35)');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(hx + dx * r, hy - 0.04 * r, 0.035 * r, 0, TAU);
    ctx.fill();
  }
}

/**
 * Crocodile des marais : long et plat, dos hérissé d'écailles en crête, queue dentelée qui ondule, pattes courtes
 * et écartées qui avancent l'une après l'autre, long museau aux dents qui dépassent, yeux jaunes à pupille fendue.
 * Dans l'eau, on ne voit que le haut de sa tête (ses yeux, ses narines) et son sillage : le reste est sous la surface.
 */
export function croc(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const skin = whiteIf(u, boss ? '#3F5A30' : '#56703F'), dark = whiteIf(u, boss ? '#2A3E20' : '#3A5028'), belly = whiteIf(u, '#C9C08A');
  const eye = u.alpha ? '#B48CFF' : '#E8D04A';
  const sw = Math.sin(u.t * 3 + u.seed);
  const eyes = (hx: number, hy: number, k: number) => {
    for (const dx of [-0.08, 0.06]) {
      blot(ctx, hx + dx * r, hy, 0.09 * r * k, 0.07 * r * k, dark);
      blot(ctx, hx + dx * r, hy - 0.01 * r, 0.055 * r * k, 0.045 * r * k, eye);
      ctx.fillStyle = '#10140C';
      ctx.fillRect(hx + dx * r - 0.008 * r, hy - 0.045 * r * k, 0.016 * r, 0.07 * r * k); // pupille fendue
    }
  };
  if (u.inWater) {
    // Tapi dans l'eau : le corps n'est qu'une ombre sous la surface, la queue ondule ; la tête affleure, coupée par la
    // ligne d'eau (dessus du museau, bosses des yeux, narines au bout), dans un cerne de remous ; sillage en V quand il nage,
    // quelques bulles sinon.
    ctx.save();
    ctx.translate(-0.45 * r, 0); // la tête au-dessus de son anneau, le corps derrière
    const bob = Math.sin(u.t * 1.6 + u.seed) * r * 0.025, wl = 0.5 * r + bob; // ligne d'eau (posé sur son anneau)
    // ombre du corps et de la queue sous l'eau
    ctx.fillStyle = 'rgba(14,38,30,0.42)';
    ctx.beginPath();
    ctx.ellipse(-0.15 * r, wl + 0.06 * r, 0.75 * r, 0.2 * r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(14,38,30,0.42)';
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.18 * r;
    ctx.beginPath();
    ctx.moveTo(-0.8 * r, wl + 0.06 * r);
    for (let k = 1; k <= 8; k++) {
      const f = k / 8;
      ctx.lineTo(-0.8 * r - f * 0.9 * r, wl + 0.06 * r + Math.sin(u.t * 3 + u.seed - f * 3) * 0.12 * r * f);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(14,38,30,0.35)'; // pattes repliées, à peine visibles
    for (const x of [-0.45, 0.3]) blot(ctx, x * r, wl + 0.2 * r, 0.12 * r, 0.05 * r, 'rgba(14,38,30,0.35)');
    // sillage en V quand il nage
    if (u.moving) {
      ctx.strokeStyle = 'rgba(220,240,245,0.55)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(1.1 * r, wl + s * 0.04 * r);
        ctx.quadraticCurveTo(0.4 * r, wl + s * 0.14 * r, -0.4 * r, wl + s * 0.3 * r);
        ctx.stroke();
      }
    }
    // la tête, vue de trois quarts : le dessus du crâne et du museau, en fuseau, qui dépasse de l'eau
    const hy = wl - 0.05 * r, head = (grow: number) => {
      ctx.beginPath();
      ctx.moveTo(0.02 * r - grow, hy);
      ctx.bezierCurveTo(0.05 * r - grow, hy - 0.3 * r - grow, 0.55 * r, hy - 0.26 * r - grow, 0.85 * r, hy - 0.15 * r - grow);
      ctx.bezierCurveTo(1.15 * r, hy - 0.11 * r - grow, 1.4 * r + grow, hy - 0.1 * r, 1.4 * r + grow, hy - 0.02 * r);
      ctx.bezierCurveTo(1.4 * r + grow, hy + 0.06 * r + grow, 1.15 * r, hy + 0.08 * r + grow, 0.85 * r, hy + 0.08 * r + grow);
      ctx.bezierCurveTo(0.55 * r, hy + 0.12 * r + grow, 0.05 * r - grow, hy + 0.12 * r + grow, 0.02 * r - grow, hy);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(12,10,10,0.7)';
    head(0.03 * r);
    ctx.fill();
    ctx.fillStyle = skin;
    head(0);
    ctx.fill();
    // l'eau lèche le bas de la tête
    ctx.fillStyle = 'rgba(46,101,116,0.55)';
    ctx.beginPath();
    ctx.ellipse(0.7 * r, hy + 0.1 * r, 0.75 * r, 0.06 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,230,150,0.25)'; // reflet mouillé sur le dessus du museau
    ctx.beginPath();
    ctx.ellipse(0.85 * r, hy - 0.1 * r, 0.35 * r, 0.03 * r, -0.05, 0, TAU);
    ctx.fill();
    // écailles en relief, en rangées, sur le crâne et le museau
    for (let k = 0; k < 6; k++) for (const dy of [-0.08, 0.02]) blot(ctx, (0.32 + k * 0.15) * r, hy + (dy + k * 0.012) * r, 0.04 * r, 0.022 * r, dark);
    // crocs qui dépassent sur le bord de la gueule
    ctx.fillStyle = whiteIf(u, '#F2EBD8');
    for (const x of [0.6, 0.8, 0.98, 1.15, 1.3]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.025) * r, hy + 0.06 * r);
      ctx.lineTo(x * r, hy + 0.13 * r);
      ctx.lineTo((x + 0.025) * r, hy + 0.06 * r);
      ctx.fill();
    }
    // bosse des narines au bout, deux trous
    blot(ctx, 1.28 * r, hy - 0.06 * r, 0.09 * r, 0.06 * r, skin);
    ctx.fillStyle = '#10140C';
    ctx.beginPath();
    ctx.arc(1.25 * r, hy - 0.075 * r, 0.018 * r, 0, TAU);
    ctx.arc(1.32 * r, hy - 0.07 * r, 0.018 * r, 0, TAU);
    ctx.fill();
    // bosses des yeux, hautes, arcades cornues, yeux jaunes à pupille fendue (qui luisent chez le sauvage)
    for (const dx of [0.18, 0.36]) {
      blot(ctx, dx * r, hy - 0.2 * r, 0.11 * r, 0.1 * r, skin);
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(dx * r - 0.1 * r, hy - 0.22 * r);
      ctx.lineTo(dx * r - 0.06 * r, hy - 0.36 * r);
      ctx.lineTo(dx * r + 0.08 * r, hy - 0.26 * r);
      ctx.fill();
      if (u.wild && !u.flash) blot(ctx, dx * r, hy - 0.21 * r, 0.1 * r, 0.07 * r, 'rgba(232,208,74,0.3)');
      blot(ctx, dx * r, hy - 0.21 * r, 0.065 * r, 0.05 * r, eye);
      ctx.fillStyle = '#10140C';
      ctx.fillRect(dx * r - 0.01 * r, hy - 0.255 * r, 0.02 * r, 0.09 * r);
      blot(ctx, dx * r - 0.022 * r, hy - 0.235 * r, 0.013 * r, 0.011 * r, '#FFFFFF');
    }
    // l'eau autour de la tête : un cerne clair, des remous qui s'écartent, un peu d'écume au bout du museau
    ctx.strokeStyle = 'rgba(220,240,245,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.ellipse(0.7 * r, wl, 0.74 * r, 0.1 * r, 0, 0, TAU);
    ctx.stroke();
    for (let k = 0; k < 2; k++) {
      const p = (u.t * (u.moving ? 1.2 : 0.5) + k / 2 + u.seed * 0.1) % 1;
      ctx.strokeStyle = `rgba(220,240,245,${0.45 * (1 - p)})`;
      ctx.beginPath();
      ctx.ellipse(0.7 * r, wl, (0.78 + p * 0.5) * r, (0.12 + p * 0.1) * r, 0, 0, TAU);
      ctx.stroke();
    }
    blot(ctx, 1.42 * r, wl, 0.08 * r, 0.03 * r, 'rgba(235,245,245,0.7)');
    if (!u.moving) {
      // bulles qui remontent derrière la tête
      for (let k = 0; k < 3; k++) {
        const p = (u.t * 0.7 + k / 3 + u.seed * 0.3) % 1;
        ctx.strokeStyle = `rgba(220,240,245,${0.6 * (1 - p)})`;
        ctx.lineWidth = Math.max(1, r * 0.02);
        ctx.beginPath();
        ctx.arc((-0.2 - k * 0.18) * r, wl + 0.02 * r, (0.02 + p * 0.03) * r, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }
  const g = gait(u, 9);
  ctx.save();
  ctx.translate(0, 0.16 * r); // posé sur son anneau : il est bas sur pattes
  ctx.scale(1.08, 1.25); // plus massif
  const legAt = (i: number, x: number, col: string) => {
    const a = g[i].a, up = g[i].lift;
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.15 * r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, 0.25 * r);
    ctx.lineTo(x + a * 0.12 * r - 0.06 * r, 0.42 * r - up * 0.05 * r);
    ctx.lineTo(x + a * 0.18 * r, 0.55 * r - up * 0.06 * r);
    ctx.stroke();
    blot(ctx, x + a * 0.18 * r + 0.04 * r, 0.56 * r - up * 0.06 * r, 0.08 * r, 0.035 * r, col);
  };
  legAt(0, -0.45 * r, dark);
  legAt(1, 0.4 * r, dark);
  // queue : une bande effilée qui ondule, dentelée sur le dessus
  const tail: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    tail.push([-0.62 * r - k * 0.95 * r, 0.24 * r + Math.sin(u.t * 4 + u.seed - k * 2.2) * 0.1 * r * k, (0.2 - 0.17 * k) * r]);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  tail.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w) : ctx.moveTo(x, y - w)));
  for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] + tail[i][2]);
  ctx.closePath();
  ctx.fill();
  fineInk(ctx, r, 0.8);
  ctx.fillStyle = dark;
  for (let i = 1; i < 10; i += 1) {
    const [x, y, w] = tail[i];
    ctx.beginPath();
    ctx.moveTo(x - 0.04 * r, y - w);
    ctx.lineTo(x, y - w - 0.07 * r * (1 - i / 12));
    ctx.lineTo(x + 0.04 * r, y - w);
    ctx.fill();
  }
  // corps long et plat
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0.24 * r, 0.72 * r, 0.24 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, 0.24 * r, 0.7 * r, 0.22 * r, 0, 0, TAU);
  ctx.fill();
  blot(ctx, 0.05 * r, 0.38 * r, 0.6 * r, 0.06 * r, belly);
  // crête d'écailles en double rangée, et de grandes plaques d'os en pointe le long de l'échine
  for (let k = 0; k < 7; k++) {
    const x = -0.58 * r + k * 0.18 * r;
    for (const dy of [-0.02, 0.06]) blot(ctx, x, 0.06 * r + dy * r, 0.06 * r, 0.035 * r, dark);
  }
  for (let k = 0; k < 6; k++) {
    const x = -0.5 * r + k * 0.19 * r, h = (boss ? 0.24 : 0.17) * r * (1 - Math.abs(k - 2.5) / 5);
    ctx.fillStyle = whiteIf(u, '#C9BC9C');
    ctx.beginPath();
    ctx.moveTo(x - 0.06 * r, 0.05 * r);
    ctx.lineTo(x + 0.02 * r, 0.05 * r - h);
    ctx.lineTo(x + 0.07 * r, 0.05 * r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,10,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.02);
    ctx.stroke();
  }
  // algues et mousse accrochées au dos
  if (!u.flash) for (const [ax, len] of [[-0.3, 0.16], [0.2, 0.12], [-0.05, 0.1]]) {
    ctx.strokeStyle = 'rgba(70,110,50,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(ax * r, 0.12 * r);
    ctx.quadraticCurveTo((ax + 0.03) * r, (0.2 + len) * r, (ax - 0.02) * r, (0.28 + len) * r);
    ctx.stroke();
  }
  // tête : long museau plat, mâchoires et dents
  const open = 0.03 * r + Math.max(0, sw) * 0.04 * r * (u.wild ? 1 : 0.4);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.55 * r, 0.1 * r);
  ctx.quadraticCurveTo(0.9 * r, 0.08 * r, 1.32 * r, 0.2 * r);
  ctx.lineTo(1.32 * r, 0.25 * r);
  ctx.lineTo(0.6 * r, 0.3 * r);
  ctx.fill();
  ctx.beginPath(); // mâchoire du bas, un peu ouverte
  ctx.moveTo(0.6 * r, 0.32 * r);
  ctx.lineTo(1.28 * r, 0.27 * r + open);
  ctx.lineTo(1.25 * r, 0.33 * r + open);
  ctx.quadraticCurveTo(0.9 * r, 0.42 * r + open, 0.58 * r, 0.4 * r);
  ctx.fill();
  ctx.fillStyle = '#5A2A22';
  ctx.beginPath();
  ctx.moveTo(0.7 * r, 0.3 * r);
  ctx.lineTo(1.28 * r, 0.25 * r);
  ctx.lineTo(1.26 * r, 0.27 * r + open);
  ctx.lineTo(0.7 * r, 0.33 * r);
  ctx.fill();
  ctx.fillStyle = '#F2EBD8'; // dents en zigzag
  for (let k = 0; k < 7; k++) {
    const x = 0.72 * r + k * 0.08 * r;
    ctx.beginPath();
    ctx.moveTo(x, 0.26 * r);
    ctx.lineTo(x + 0.025 * r, 0.3 * r);
    ctx.lineTo(x + 0.05 * r, 0.26 * r);
    ctx.fill();
  }
  blot(ctx, 1.25 * r, 0.17 * r, 0.06 * r, 0.04 * r, dark); // narines
  // gros crocs qui dépassent de la mâchoire fermée, et des algues qui pendent de la gueule
  ctx.fillStyle = whiteIf(u, '#F2EBD8');
  for (const x of [0.78, 1.0, 1.18]) {
    ctx.beginPath();
    ctx.moveTo(x * r - 0.025 * r, 0.27 * r);
    ctx.lineTo(x * r, 0.38 * r + open);
    ctx.lineTo(x * r + 0.025 * r, 0.27 * r);
    ctx.fill();
  }
  if (!u.flash) {
    ctx.strokeStyle = 'rgba(70,110,50,0.8)';
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.beginPath();
    ctx.moveTo(0.9 * r, 0.36 * r + open);
    ctx.quadraticCurveTo(0.93 * r, 0.5 * r, 0.88 * r, 0.56 * r + Math.sin(u.t * 3 + u.seed) * 0.02 * r);
    ctx.stroke();
  }
  // arcades cornues au-dessus des yeux, qui luisent
  ctx.fillStyle = dark;
  for (const dx of [-0.08, 0.06]) {
    ctx.beginPath();
    ctx.moveTo(0.62 * r + (dx - 0.07) * r, 0.04 * r);
    ctx.lineTo(0.62 * r + (dx - 0.04) * r, -0.08 * r);
    ctx.lineTo(0.62 * r + (dx + 0.06) * r, 0.02 * r);
    ctx.fill();
  }
  if (u.wild && !u.flash) for (const dx of [-0.08, 0.06]) blot(ctx, 0.62 * r + dx * r, 0.05 * r, 0.1 * r, 0.07 * r, 'rgba(232,208,74,0.25)');
  eyes(0.62 * r, 0.06 * r, 1);
  legAt(2, -0.32 * r, skin);
  legAt(3, 0.5 * r, skin);
  ctx.restore();
}

/**
 * Petit Masqué : une boule de poils noirs hirsutes, montée sur des membres décharnés cerclés d'anneaux d'os, un pagne de
 * paille, et devant, un grand masque tiki de bois vert : crête, cornes rouges, peintures de guerre, un œil blanc
 * écarquillé et l'autre noir, une bouche immense aux dents carrées. Il chasse à la sarbacane taillée dans un os, qu'il
 * porte au masque pour tirer. Le Grand Masque : plus hirsute, cornes et plumes dorées, un gros os en massue.
 */
export function masked(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss, W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const fur = W('#1E1A1E'), furHi = W('#3A3438'), limb = W('#8A7A66'), limbDark = W('#5E5244'), bone = W('#EFE6D0'), boneShade = W('#C9BC9C');
  const wood = W(boss ? '#8AA03A' : '#7A9A3E'), woodDark = W(boss ? '#56702A' : '#4E6A2A'), woodHi = W('#B4C86A'), red = W('#C8302A');
  const step = u.moving ? Math.sin(u.t * 11 + u.seed) : 0, aim = u.charge ?? 0;
  const hop = u.moving ? Math.abs(Math.cos(u.t * 11 + u.seed)) * r * 0.12 : Math.sin(u.t * 2.2 + u.seed) * r * 0.03;
  const shake = Math.sin(u.t * 7 + u.seed) * 0.04; // il se dandine
  // jambes décharnées, genoux saillants, anneaux d'os aux chevilles, grands pieds
  for (const s of [-1, 1]) {
    const fx = s * 0.28 * r + step * s * 0.18 * r, lift = Math.max(0, step * s) * 0.12 * r;
    ctx.strokeStyle = limbDark;
    ctx.lineWidth = 0.15 * r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.18 * r, 0.25 * r - hop);
    ctx.lineTo(s * 0.36 * r + step * s * 0.06 * r, 0.5 * r - lift - hop * 0.5);
    ctx.lineTo(fx, 0.75 * r - lift);
    ctx.stroke();
    blot(ctx, fx + 0.06 * r, 0.78 * r - lift, 0.14 * r, 0.06 * r, limb);
    ctx.strokeStyle = bone;
    ctx.lineWidth = 0.06 * r;
    ctx.beginPath();
    ctx.ellipse(fx, 0.68 * r - lift, 0.09 * r, 0.035 * r, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(0, -hop);
  ctx.rotate(shake);
  // pagne de paille qui dépasse sous les poils
  ctx.fillStyle = W('#C9A83A');
  ctx.beginPath();
  ctx.moveTo(-0.5 * r, 0.12 * r);
  for (let k = 0; k <= 10; k++) ctx.lineTo(-0.5 * r + k * 0.1 * r, 0.42 * r + (k % 2) * 0.08 * r + Math.sin(u.t * 6 + k) * 0.02 * r);
  ctx.lineTo(0.5 * r, 0.12 * r);
  ctx.fill();
  ctx.strokeStyle = W('#8A6A22');
  ctx.lineWidth = Math.max(1, 0.03 * r);
  ctx.beginPath();
  for (let k = 0; k < 9; k++) {
    ctx.moveTo(-0.42 * r + k * 0.1 * r, 0.16 * r);
    ctx.lineTo(-0.44 * r + k * 0.1 * r, 0.42 * r);
  }
  ctx.stroke();
  // la boule de poils : contour hérissé, mèches plus claires
  const R = (boss ? 0.92 : 0.82) * r;
  jagged(ctx, 0, -0.18 * r, R, R * 0.9, 16, 0.2);
  ctx.fillStyle = 'rgba(8,6,8,0.85)';
  ctx.fill();
  jagged(ctx, 0, -0.2 * r, R * 0.95, R * 0.86, 16, 0.18);
  ctx.fillStyle = fur;
  ctx.fill();
  if (!u.flash) {
    ctx.strokeStyle = furHi;
    ctx.lineWidth = Math.max(1, 0.05 * r);
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = -2.6 + k * 0.42, x = Math.cos(a) * R * 0.75, y = -0.2 * r + Math.sin(a) * R * 0.7;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * R * 0.22, y + Math.sin(a) * R * 0.22);
    }
    ctx.stroke();
  }
  // bras maigres qui sortent des poils, bracelets d'os ; la main gauche agrippe le bord du masque
  const arm = (s: number, hx: number, hy: number) => {
    ctx.strokeStyle = limbDark;
    ctx.lineWidth = 0.13 * r;
    ctx.beginPath();
    ctx.moveTo(s * R * 0.75, -0.1 * r);
    ctx.quadraticCurveTo(s * R * 1.05, 0.05 * r, hx, hy);
    ctx.stroke();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 0.05 * r;
    ctx.beginPath();
    ctx.ellipse(s * R * 0.95, 0.0, 0.07 * r, 0.1 * r, 0.3 * s, 0, TAU);
    ctx.stroke();
    // main à trois doigts griffus
    ctx.strokeStyle = limb;
    ctx.lineWidth = 0.06 * r;
    ctx.beginPath();
    for (const d of [-0.5, 0, 0.5]) {
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(d + (s > 0 ? -0.6 : Math.PI + 0.6)) * 0.13 * r, hy + Math.sin(d - 0.6) * 0.13 * r);
    }
    ctx.stroke();
  };
  arm(-1, -R * 1.02, 0.2 * r);
  // l'arme : sarbacane d'os (au masque pour tirer), ou grosse massue d'os (Grand Masque)
  if (boss) {
    ctx.save();
    ctx.translate(R * 0.95, -0.05 * r);
    ctx.rotate(-0.7 + Math.sin(u.t * 3 + u.seed) * 0.1);
    ctx.strokeStyle = boneShade;
    ctx.lineWidth = 0.16 * r;
    ctx.beginPath();
    ctx.moveTo(0, 0.25 * r);
    ctx.lineTo(0, -0.95 * r);
    ctx.stroke();
    for (const s of [-1, 1]) blot(ctx, s * 0.11 * r, -1.0 * r, 0.12 * r, 0.12 * r, bone); // les deux bosses de l'os
    for (const s of [-1, 1]) blot(ctx, s * 0.09 * r, 0.3 * r, 0.09 * r, 0.09 * r, bone);
    ctx.strokeStyle = red; // un ruban rouge noué
    ctx.lineWidth = 0.05 * r;
    ctx.beginPath();
    ctx.moveTo(-0.08 * r, -0.5 * r);
    ctx.lineTo(0.1 * r, -0.42 * r);
    ctx.lineTo(0.2 * r, -0.2 * r);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(aim ? 0.15 * r : R * 0.9, aim ? -0.45 * r : 0.05 * r);
    ctx.rotate(aim ? -0.05 : -1.0);
    ctx.strokeStyle = boneShade;
    ctx.lineWidth = 0.1 * r;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1.15 * r, 0);
    ctx.stroke();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 0.05 * r;
    ctx.beginPath();
    ctx.moveTo(0.05 * r, -0.02 * r);
    ctx.lineTo(1.1 * r, -0.02 * r);
    ctx.stroke();
    for (const x of [0, 1.15]) blot(ctx, x * r, 0, 0.07 * r, 0.07 * r, bone);
    ctx.strokeStyle = red;
    ctx.lineWidth = 0.04 * r;
    ctx.beginPath();
    for (const x of [0.35, 0.75]) {
      ctx.moveTo(x * r, -0.06 * r);
      ctx.lineTo(x * r, 0.06 * r);
    }
    ctx.stroke();
    ctx.restore();
  }
  arm(1, aim ? 0.25 * r : R * 0.95, aim ? -0.4 * r : 0.1 * r);
  // le masque tiki : grand rectangle arrondi de bois vert, plus large en haut
  const mx = 0.04 * r, top = -1.32 * r, bot = -0.02 * r, mw = (boss ? 0.56 : 0.5) * r;
  // cornes rouges recourbées, et plumes (dorées pour le Grand Masque)
  for (const s of [-1, 1]) {
    ctx.fillStyle = red;
    ctx.beginPath();
    ctx.moveTo(mx + s * mw * 0.55, top + 0.12 * r);
    ctx.quadraticCurveTo(mx + s * mw * 1.25, top - 0.15 * r, mx + s * mw * 1.05, top - 0.55 * r);
    ctx.quadraticCurveTo(mx + s * mw * 0.95, top - 0.1 * r, mx + s * mw * 0.3, top + 0.12 * r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,10,0.6)';
    ctx.lineWidth = Math.max(1, 0.03 * r);
    ctx.stroke();
  }
  for (let k = 0; k < (boss ? 5 : 3); k++) {
    const a = (k - (boss ? 2 : 1)) * 0.32 + Math.sin(u.t * 3 + k) * 0.05;
    ctx.save();
    ctx.translate(mx, top + 0.05 * r);
    ctx.rotate(a);
    ctx.fillStyle = boss ? W(k % 2 ? '#F0B64A' : '#E8463A') : W(k % 2 ? '#C8302A' : '#E8643A');
    ctx.beginPath();
    ctx.ellipse(0, -0.32 * r, 0.06 * r, 0.3 * r, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(12,10,10,0.7)';
  ctx.beginPath();
  ctx.roundRect(mx - mw - 0.04 * r, top - 0.03 * r, mw * 2 + 0.08 * r, bot - top + 0.08 * r, 0.16 * r);
  ctx.fill();
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(mx - mw, top, mw * 2, bot - top, 0.14 * r);
  ctx.fill();
  // crête bombée du front, veines du bois
  ctx.fillStyle = woodHi;
  ctx.beginPath();
  ctx.roundRect(mx - mw * 0.55, top - 0.1 * r, mw * 1.1, 0.24 * r, 0.1 * r);
  ctx.fill();
  ctx.fillStyle = woodDark;
  ctx.beginPath();
  ctx.roundRect(mx - mw * 0.35, top - 0.05 * r, mw * 0.7, 0.12 * r, 0.06 * r);
  ctx.fill();
  if (!u.flash) {
    ctx.strokeStyle = 'rgba(60,80,30,0.5)';
    ctx.lineWidth = Math.max(1, 0.025 * r);
    ctx.beginPath();
    for (const x of [-0.7, 0.75]) {
      ctx.moveTo(mx + x * mw, top + 0.2 * r);
      ctx.quadraticCurveTo(mx + x * mw * 1.08, top + 0.6 * r, mx + x * mw, bot - 0.1 * r);
    }
    ctx.stroke();
  }
  // arcades sculptées, peintures de guerre rouges en zigzag au-dessus des yeux
  const ey = top + 0.5 * r;
  ctx.strokeStyle = red;
  ctx.lineWidth = Math.max(1, 0.05 * r);
  ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    for (let k = 0; k <= 4; k++) ctx.lineTo(mx + s * mw * (0.15 + k * 0.17), ey - 0.2 * r - (k % 2) * 0.06 * r);
    ctx.stroke();
  }
  // un œil blanc écarquillé, l'autre noir et creux ; une cheville d'os entre les deux
  blot(ctx, mx - mw * 0.48, ey, 0.17 * r, 0.16 * r, woodDark);
  blot(ctx, mx - mw * 0.48, ey, 0.13 * r, 0.12 * r, bone);
  blot(ctx, mx - mw * 0.46, ey + 0.01 * r, 0.05 * r, 0.05 * r, u.alpha ? '#B48CFF' : '#10140C');
  blot(ctx, mx + mw * 0.48, ey, 0.17 * r, 0.16 * r, woodDark);
  blot(ctx, mx + mw * 0.48, ey, 0.12 * r, 0.11 * r, '#0A0806');
  if (u.wild && !u.flash) blot(ctx, mx + mw * 0.48, ey, 0.04 * r, 0.04 * r, `rgba(255,${120 + Math.sin(u.t * 4) * 60},40,0.9)`); // une braise au fond
  ctx.fillStyle = woodDark;
  ctx.fillRect(mx - 0.05 * r, ey - 0.12 * r, 0.1 * r, 0.3 * r);
  ctx.fillStyle = bone;
  ctx.fillRect(mx - 0.09 * r, ey + 0.08 * r, 0.18 * r, 0.05 * r);
  // la bouche immense : lèvres rouges, dents carrées en haut et en bas
  const my = bot - 0.3 * r, bw = mw * 0.85, bh = 0.2 * r;
  ctx.fillStyle = red;
  ctx.beginPath();
  ctx.roundRect(mx - bw - 0.04 * r, my - bh / 2 - 0.04 * r, bw * 2 + 0.08 * r, bh + 0.08 * r, 0.1 * r);
  ctx.fill();
  ctx.fillStyle = '#1A0A08';
  ctx.beginPath();
  ctx.roundRect(mx - bw, my - bh / 2, bw * 2, bh, 0.08 * r);
  ctx.fill();
  ctx.fillStyle = bone;
  const teeth = boss ? 7 : 6, tw = (bw * 2) / teeth;
  for (let k = 0; k < teeth; k++) {
    ctx.fillRect(mx - bw + k * tw + tw * 0.12, my - bh / 2, tw * 0.76, bh * 0.36);
    ctx.fillRect(mx - bw + k * tw + tw * 0.12, my + bh / 2 - bh * 0.32, tw * 0.76, bh * 0.32);
  }
  // les anneaux d'os qui pendent aux bords du masque
  ctx.strokeStyle = bone;
  ctx.lineWidth = Math.max(1, 0.045 * r);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(mx + s * (mw + 0.05 * r), bot - 0.55 * r + Math.sin(u.t * 5 + s) * 0.02 * r, 0.09 * r, 0, TAU);
    ctx.stroke();
  }
  if (boss) {
    // dorures : un disque solaire au front
    blot(ctx, mx, top + 0.02 * r, 0.12 * r, 0.12 * r, W('#F7D774'));
    blot(ctx, mx, top + 0.02 * r, 0.06 * r, 0.06 * r, W('#C8962A'));
  }
  ctx.restore();
}

/** Banane lancée par un gorille : elle tourne sur elle-même en vol. */
export function drawBanana(ctx: Ctx, x: number, y: number, t: number, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 12);
  ctx.scale(size, size);
  ctx.strokeStyle = 'rgba(12,18,16,0.7)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 6, 11, -Math.PI * 0.85, -Math.PI * 0.15);
  ctx.stroke();
  ctx.strokeStyle = '#F2D040';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,200,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 6, 9.5, -Math.PI * 0.75, -Math.PI * 0.35);
  ctx.stroke();
  ctx.fillStyle = '#5E4422'; // les bouts
  for (const a of [-Math.PI * 0.85, -Math.PI * 0.15]) {
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 11, 6 + Math.sin(a) * 11, 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Totem masqué (renfort du Grand Masque) : un poteau sculpté, trois masques empilés (rouge, turquoise, ocre), des plumes
 * au sommet ; ses yeux luisent d'un vert qui pulse quand il soigne, et une aura monte de sa base.
 */
export function maskTotem(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const f = u.flash, t = u.t + u.seed, pulse = 0.5 + 0.5 * Math.sin(t * 3);
  const wood = f ? '#FFFFFF' : '#7A5030', woodDark = f ? '#FFFFFF' : '#4E321E';
  if (!f) {
    // aura de soin à la base
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i / 3) % 1;
      ctx.strokeStyle = `rgba(140,230,120,${0.45 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0.62 * r, r * (0.6 + 1.2 * k), r * (0.25 + 0.5 * k), 0, 0, TAU);
      ctx.stroke();
    }
  }
  // poteau
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(-0.42 * r, -2.6 * r, 0.84 * r, 3.3 * r, 0.12 * r);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = woodDark;
  ctx.fillRect(-0.42 * r, -2.6 * r, 0.16 * r, 3.3 * r);
  // trois masques, du bas vers le haut
  const masks: [number, string, string][] = [[0.15, '#B8402E', '#F0D9A0'], [-0.85, '#2E8A80', '#F6EEDD'], [-1.85, '#C88A2E', '#2A1A12']];
  masks.forEach(([my, col, paint], i) => {
    ctx.fillStyle = f ? '#FFFFFF' : col;
    ctx.beginPath();
    ctx.moveTo(-0.62 * r, my * r - 0.38 * r);
    ctx.quadraticCurveTo(0, my * r - 0.62 * r, 0.62 * r, my * r - 0.38 * r);
    ctx.quadraticCurveTo(0.6 * r, my * r + 0.35 * r, 0, my * r + 0.5 * r);
    ctx.quadraticCurveTo(-0.6 * r, my * r + 0.35 * r, -0.62 * r, my * r - 0.38 * r);
    ctx.closePath();
    ctx.fill();
    ink(ctx, r * 0.8);
    if (f) return;
    // peintures : chevrons, bouche
    ctx.strokeStyle = paint;
    ctx.lineWidth = Math.max(1, 0.07 * r);
    ctx.beginPath();
    ctx.moveTo(-0.45 * r, my * r + 0.18 * r);
    ctx.lineTo(-0.2 * r, my * r + 0.3 * r);
    ctx.lineTo(0, my * r + 0.18 * r);
    ctx.lineTo(0.2 * r, my * r + 0.3 * r);
    ctx.lineTo(0.45 * r, my * r + 0.18 * r);
    ctx.stroke();
    // yeux qui luisent (le masque du haut plus fort)
    for (const sd of [-1, 1]) {
      const glow = (i === 2 ? 1 : 0.7) * (0.5 + 0.5 * pulse);
      ctx.fillStyle = `rgba(160,255,130,${glow})`;
      ctx.beginPath();
      ctx.ellipse(sd * 0.25 * r, my * r - 0.12 * r, 0.12 * r, 0.07 * r, sd * 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(160,255,130,${0.18 * glow})`;
      ctx.beginPath();
      ctx.arc(sd * 0.25 * r, my * r - 0.12 * r, 0.3 * r, 0, TAU);
      ctx.fill();
    }
  });
  // plumes au sommet, qui frémissent
  const fcol = f ? ['#FFFFFF', '#FFFFFF', '#FFFFFF'] : ['#C8382E', '#F0B64A', '#2E8A80'];
  [-0.5, 0, 0.5].forEach((a, i) => {
    ctx.save();
    ctx.translate(0, -2.55 * r);
    ctx.rotate(a + Math.sin(t * 4 + i) * 0.06);
    ctx.fillStyle = fcol[i];
    ctx.beginPath();
    ctx.ellipse(0, -0.55 * r, 0.14 * r, 0.6 * r, 0, 0, TAU);
    ctx.fill();
    ink(ctx, r * 0.5);
    ctx.restore();
  });
}

/** Crocodile en embuscade : seuls ses yeux dépassent, des rides d'eau s'élargissent autour et derrière lui. */
export function drawLurkEyes(ctx: Ctx, x: number, y: number, r: number, t: number, seed: number) {
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3 + seed * 0.13) % 1;
    ctx.strokeStyle = `rgba(190,225,230,${0.55 * (1 - k)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.4 + 0.9 * k), r * (0.2 + 0.45 * k), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(40,70,60,0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.55, r * 0.22, 0, 0, TAU);
  ctx.fill();
  for (const sd of [-1, 1]) {
    const ex = x + sd * r * 0.22, ey = y - 3 + Math.sin(t * 2 + seed) * 1.5;
    ctx.fillStyle = '#3F5A30';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 7, 5, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#F0C040';
    ctx.beginPath();
    ctx.ellipse(ex, ey - 2, 3.4, 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10181A';
    ctx.fillRect(ex - 0.6, ey - 4, 1.2, 4);
  }
}
