// Scène animée du lobby : une clairière au crépuscule, le dompteur, son Alpha et sa meute face aux monstres.
// Dessinée avec les mêmes sprites que le jeu pour que le lobby ressemble à ce qu'on va jouer.

import { ALPHA_MULT, SPECIES } from '../../shared/config.ts';
import { clamp, rng } from '../../shared/math.ts';
import { drawPlayer, drawUnit } from './sprites.ts';

const TAU = Math.PI * 2;

interface Actor {
  x: number; // coordonnées « jeu », relatives au feu de camp
  y: number;
  species: number;
  alpha?: boolean;
  wild: boolean;
  face: number;
  seed: number;
}

const ACTORS: Actor[] = [
  // La meute du dompteur (à gauche du feu).
  { x: -132, y: -18, species: 1, wild: false, face: 1, seed: 1 },
  { x: -108, y: 34, species: 0, wild: false, face: 1, seed: 2 },
  { x: -168, y: 22, species: 0, wild: false, face: 1, seed: 3 },
  { x: -214, y: -14, species: 3, alpha: true, wild: false, face: 1, seed: 4 }, // l'Alpha du dompteur : un Golem de mousse
  // Les sauvages (à droite).
  { x: 150, y: 30, species: 5, wild: true, face: -1, seed: 5 }, // Araignée
  { x: 226, y: -2, species: 2, wild: true, face: -1, seed: 6 }, // Sanglier
  { x: 312, y: -34, species: 6, wild: true, face: -1, seed: 7 }, // Ours
  { x: 170, y: -44, species: 4, wild: true, face: -1, seed: 8 }, // Sporelin
  { x: 262, y: 44, species: 7, wild: true, face: -1, seed: 9 }, // Feu follet
];

interface Tree { x: number; h: number; w: number }
interface Mote { x: number; y: number; r: number; sp: number; ph: number }

export function startLobbyScene(canvas: HTMLCanvasElement, isActive: () => boolean) {
  const ctx = canvas.getContext('2d')!;
  const rand = rng(42);
  const layers: { color: string; trees: Tree[]; base: number }[] = [
    { color: '#132019', base: -70, trees: [] },
    { color: '#16261E', base: -40, trees: [] },
    { color: '#0E1814', base: 30, trees: [] },
  ];
  // Forêts en silhouette : clairière dégagée au centre.
  for (let i = 0; i < 70; i++) {
    const x = (rand() - 0.5) * 2.4;
    layers[0].trees.push({ x, h: 120 + rand() * 90, w: 34 + rand() * 18 });
  }
  for (let i = 0; i < 40; i++) {
    let x = (rand() - 0.5) * 2.4;
    if (Math.abs(x) < 0.32) x += Math.sign(x || 1) * 0.32;
    layers[1].trees.push({ x, h: 170 + rand() * 120, w: 46 + rand() * 22 });
  }
  for (let i = 0; i < 16; i++) {
    let x = (rand() - 0.5) * 2.6;
    if (Math.abs(x) < 0.62) x += Math.sign(x || 1) * 0.62;
    layers[2].trees.push({ x, h: 300 + rand() * 160, w: 80 + rand() * 30 });
  }
  layers.forEach((l) => l.trees.sort((a, b) => a.h - b.h));
  const motes: Mote[] = Array.from({ length: 46 }, () => ({
    x: rand(), y: rand(), r: 1 + rand() * 2.2, sp: 0.2 + rand() * 0.6, ph: rand() * TAU,
  }));
  const embers: { x: number; y: number; vy: number; life: number }[] = [];

  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    w = innerWidth;
    h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  };
  addEventListener('resize', resize);
  resize();

  const t0 = performance.now();
  let last = t0;
  const frame = (now: number) => {
    if (!isActive()) {
      removeEventListener('resize', resize);
      return;
    }
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const narrow = w < 960, phone = w < 600 && h > w; // téléphone en portrait : la clairière entre le titre et le panneau du bas
    const S = phone ? w / 620 : clamp(Math.min(h / 900, w / 1500), 0.4, 1.3) * 2.5; // échelle des personnages
    const groundY = h * (phone ? 0.3 : narrow ? 0.9 : 0.79);
    const cx = w / 2 - (phone ? 49 * S : 0); // en portrait : la meute et les monstres centrés

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Forêt en couches, de la plus lointaine à la plus proche.
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      for (const tr of layer.trees) {
        const x = cx + tr.x * w * 0.5;
        const by = groundY + layer.base * (S / 2.1);
        const th = tr.h * (S / 2.1), tw = tr.w * (S / 2.1);
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const y = by - th * (0.35 + k * 0.3), hw = tw * (1 - k * 0.22);
          ctx.moveTo(x - hw, y + th * 0.42);
          ctx.lineTo(x, y - th * 0.18);
          ctx.lineTo(x + hw, y + th * 0.42);
        }
        ctx.fill();
        ctx.fillRect(x - tw * 0.08, by - th * 0.1, tw * 0.16, th * 0.14);
      }
    }

    // Sol de la clairière.
    const g = ctx.createLinearGradient(0, groundY - 40 * S, 0, h);
    g.addColorStop(0, '#1D3326');
    g.addColorStop(1, '#101B16');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 40 * S, w * 0.75, 90 * S, 0, Math.PI, 0);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 110, 70, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 12 * S, 340 * S, 70 * S, 0, 0, TAU);
    ctx.fill();

    // Lueur du feu.
    const flick = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3) * 0.04;
    const glow = ctx.createRadialGradient(cx, groundY - 10 * S, 4, cx, groundY - 10 * S, 230 * S * flick);
    glow.addColorStop(0, 'rgba(240,182,74,0.34)');
    glow.addColorStop(0.5, 'rgba(232,105,63,0.10)');
    glow.addColorStop(1, 'rgba(232,105,63,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Personnages, en coordonnées « jeu » centrées sur le feu.
    ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * cx, dpr * groundY);
    type D = { y: number; draw: () => void };
    const list: D[] = ACTORS.map((a) => ({
      y: a.y,
      draw: () => {
        const sway = a.wild ? Math.sin(t * 0.8 + a.seed) * 3 : Math.sin(t * 1.1 + a.seed) * 2;
        drawUnit(ctx, {
          x: a.x + sway, y: a.y, r: Math.round(SPECIES[a.species].r * (a.alpha ? ALPHA_MULT.size : 1)),
          species: a.species, alpha: !!a.alpha, wild: a.wild, ownerColor: a.wild ? undefined : '#5CC8B8',
          face: a.face, t, seed: a.seed * 1.7, flash: false,
        });
      },
    }));
    list.push({ y: 4, draw: () => drawPlayer(ctx, -62, 4, '#5CC8B8', 1, 0.15, 3, '', t, false, false, false) });
    list.push({
      y: 0,
      draw: () => {
        // Feu de camp.
        ctx.fillStyle = '#4A3424';
        for (const ang of [0.4, -0.4]) {
          ctx.save();
          ctx.rotate(ang);
          ctx.fillRect(-18, -4, 36, 8);
          ctx.restore();
        }
        ctx.fillStyle = '#E8693F';
        ctx.beginPath();
        ctx.ellipse(0, -9 * flick, 13, 21 * flick, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#F0B64A';
        ctx.beginPath();
        ctx.ellipse(0, -5 * flick, 7, 12 * flick, 0, 0, TAU);
        ctx.fill();
      },
    });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    // Braises qui montent du feu.
    if (Math.random() < 0.35) embers.push({ x: (Math.random() - 0.5) * 14, y: -16, vy: -30 - Math.random() * 30, life: 1.4 });
    for (const e of embers) {
      e.life -= dt;
      e.y += e.vy * dt;
      e.x += Math.sin(e.y * 0.08) * 0.3;
    }
    for (let i = embers.length - 1; i >= 0; i--) if (embers[i].life <= 0) embers.splice(i, 1);
    for (const e of embers) {
      ctx.globalAlpha = Math.max(0, e.life / 1.4);
      ctx.fillStyle = '#F0B64A';
      ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Lucioles.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.shadowColor = '#F0B64A';
    ctx.shadowBlur = 8;
    for (const m of motes) {
      const x = (m.x * w + Math.sin(t * m.sp + m.ph) * 30) % w;
      const y = h * 0.25 + m.y * (groundY - h * 0.25) + Math.cos(t * m.sp * 0.8 + m.ph) * 18;
      ctx.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 * m.sp + m.ph));
      ctx.fillStyle = '#FFD58A';
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
