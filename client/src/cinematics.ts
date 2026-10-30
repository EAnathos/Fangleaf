// Cinématiques du bateau, vues de côté, en plein écran par-dessus le jeu (avec des bandes noires, comme au cinéma) :
// - l'embarquement : le dompteur et sa meute montent à bord par la passerelle, les voiles se déploient, la corne sonne,
//   le bateau quitte l'île dans le soleil ;
// - le Kraken (tant qu'il n'est pas vaincu) : au large, la mer se tait, le ciel noircit, une ombre immense passe sous la
//   coque, puis il surgit, son œil s'ouvre, ses tentacules s'abattent sur le pont, et son nom s'inscrit à l'écran.
// Tout est dessiné (Canvas 2D) dans un espace virtuel de 1280 × 720, centré, à l'échelle de l'écran. Un toucher ou une
// touche abrège la scène (fondu au noir). Entre deux scènes, l'écran reste noir (le rideau) le temps que le jeu suive.

import { sound } from './audio.ts';
import { drawKraken, drawPlayer, drawUnit, KRAKEN_COLORS as KC } from './sprites.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const u = clamp01(v);
  return u * u * (3 - 2 * u);
};
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;
const easeIn = (v: number) => clamp01(v) ** 3;
/** Fenêtre de temps : 0 avant a, 1 après b, en douceur entre les deux. */
const win = (t: number, a: number, b: number) => smooth((t - a) / (b - a));

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: string, b: string, k: number, alpha = 1) => {
  const x = hex(a), y = hex(b);
  return `rgba(${Math.round(x[0] + (y[0] - x[0]) * k)},${Math.round(x[1] + (y[1] - x[1]) * k)},${Math.round(x[2] + (y[2] - x[2]) * k)},${alpha})`;
};

const HORIZON = 30; // ligne d'horizon (espace virtuel, origine au centre de l'écran)
const WATER = 150; // ligne de flottaison du bateau
const TEAL = '#5CC8B8';

/** Un dompteur qui monte à bord (sa couleur, son armure, sa classe, son chapeau) et l'Alpha qui l'accompagne (au hasard). */
export interface Mate {
  color: string;
  armor: number;
  cls: string | null;
  hat: number;
  pet?: { species: number; legend: boolean };
}
/** L'équipage : tous les dompteurs qui prennent la mer ensemble (le premier : soi). */
export type Crew = Mate[];

interface Scene {
  dur: number;
  draw: (ctx: Ctx, t: number, hv: number, hw: number) => void; // hv, hw : demi-hauteur et demi-largeur visibles
  cues: { at: number; run: () => void; done?: boolean }[];
}

/** Le rideau et les scènes : un seul canvas par-dessus tout, tant qu'une scène joue ou que l'écran reste noir. */
export class Cinema {
  private c: HTMLCanvasElement | null = null;
  private ctx: Ctx | null = null;
  private scene: Scene | null = null;
  private start = 0;
  private skipAt = -1;
  private onDone: (() => void) | null = null;
  private lifting = -1; // le rideau se lève (fondu du noir vers le jeu) depuis ce moment
  private raf = 0;
  private shake = 0;

  /** Une scène joue, ou l'écran est noir : le jeu ne prend plus les commandes. */
  get busy() {
    return !!this.c;
  }

  /** Joue une scène ; à la fin (ou abrégée), l'écran reste noir et done est appelé. */
  private play(scene: Scene, done: () => void) {
    this.mount();
    this.scene = scene;
    this.start = performance.now();
    this.skipAt = -1;
    this.lifting = -1;
    this.onDone = done;
  }

  /** Lève le rideau noir : fondu vers le jeu, puis le canvas s'en va. */
  lift() {
    if (!this.c || this.scene) return;
    if (this.lifting < 0) this.lifting = performance.now();
  }

  /** L'embarquement, puis done (l'écran reste noir : au jeu de lever le rideau, ou d'enchaîner sur le Kraken). */
  boarding(crew: Crew, done: () => void) {
    this.play(boardingScene(crew, (k) => (this.shake = Math.max(this.shake, k))), done);
  }

  /** Le Kraken qui surgit, puis done (écran noir). */
  kraken(title: string, sub: string, crew: Crew, done: () => void) {
    this.play(krakenScene(title, sub, crew, (k) => (this.shake = Math.max(this.shake, k))), done);
  }

  private mount() {
    if (this.c) return;
    const c = document.createElement('canvas');
    c.className = 'cinema';
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    this.c = c;
    this.ctx = c.getContext('2d')!;
    addEventListener('pointerdown', this.skip);
    addEventListener('keydown', this.skip);
    const frame = () => {
      if (!this.c) return;
      this.raf = requestAnimationFrame(frame);
      this.frame();
    };
    this.raf = requestAnimationFrame(frame);
  }

  private unmount() {
    cancelAnimationFrame(this.raf);
    removeEventListener('pointerdown', this.skip);
    removeEventListener('keydown', this.skip);
    this.c?.remove();
    this.c = this.ctx = null;
  }

  private skip = (e: Event) => {
    if (!this.scene) return;
    e.preventDefault();
    e.stopPropagation();
    const t = (performance.now() - this.start) / 1000;
    if (this.skipAt < 0 && t > 0.8) this.skipAt = t;
  };

  private frame() {
    const c = this.c!, ctx = this.ctx!, dpr = Math.min(2, devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.scene) {
      // le rideau : noir, puis fondu vers le jeu quand on le lève
      ctx.clearRect(0, 0, c.width, c.height);
      const k = this.lifting < 0 ? 1 : 1 - (performance.now() - this.lifting) / 700;
      if (k <= 0) return this.unmount();
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, c.width, c.height);
      return;
    }
    const s = this.scene, t = (performance.now() - this.start) / 1000;
    const fade = this.skipAt < 0 ? 1 : 1 - (t - this.skipAt) / 0.45;
    if (t >= s.dur || fade <= 0) {
      this.scene = null;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      const done = this.onDone;
      this.onDone = null;
      done?.();
      return;
    }
    if (this.skipAt < 0) for (const q of s.cues) if (!q.done && t >= q.at) {
      q.done = true;
      q.run();
    }
    // l'espace virtuel : 1280 × 720 au moins en hauteur, et jamais moins de 620 de large (téléphone en hauteur)
    const k = Math.min(Math.max(W / 1280, H / 720), W / 620);
    this.shake *= 0.9;
    const sx = (Math.random() - 0.5) * this.shake * 18, sy = (Math.random() - 0.5) * this.shake * 14;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (W / 2 + sx), dpr * (H / 2 + sy));
    const hv = H / 2 / k, hw = W / 2 / k;
    s.draw(ctx, t, hv, hw);
    // bandes noires, qui glissent en place au début
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bar = H * 0.1 * easeOut(t / 0.8);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
    // fondu au noir : au début, à la fin, ou quand on abrège
    const black = Math.max(1 - t / 0.7, win(t, s.dur - 0.8, s.dur), 1 - fade);
    if (black > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp01(black)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t > 1.2 && this.skipAt < 0) {
      ctx.globalAlpha = 0.4 * win(t, 1.2, 2) * (1 - win(t, s.dur - 1.5, s.dur - 1));
      ctx.font = `500 13px ${font()}`;
      ctx.fillStyle = '#EEE7D7';
      ctx.textAlign = 'right';
      ctx.fillText('toucher pour passer', W - 18, H - bar / 2 + 4);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
}

const font = () => getComputedStyle(document.body).getPropertyValue('--display').trim() || 'serif';

// ───────────────────────── Décor : ciel, soleil, mer, mouettes ─────────────────────────

interface SkyLook { top: string; mid: string; low: string; sun: number; storm: number }

function sky(ctx: Ctx, hv: number, hw: number, look: SkyLook, t: number) {
  const g = ctx.createLinearGradient(0, -hv, 0, HORIZON);
  g.addColorStop(0, look.top);
  g.addColorStop(0.6, look.mid);
  g.addColorStop(1, look.low);
  ctx.fillStyle = g;
  ctx.fillRect(-hw - 40, -hv - 40, hw * 2 + 80, HORIZON + hv + 41);
  if (look.sun > 0) {
    // le soleil bas sur l'horizon, son halo, des rayons qui tournent doucement
    const sx = 360, sy = HORIZON - 46;
    const halo = ctx.createRadialGradient(sx, sy, 10, sx, sy, 420);
    halo.addColorStop(0, `rgba(255,214,140,${0.55 * look.sun})`);
    halo.addColorStop(0.3, `rgba(255,150,90,${0.22 * look.sun})`);
    halo.addColorStop(1, 'rgba(255,120,80,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(-hw - 40, -hv - 40, hw * 2 + 80, HORIZON + hv + 40);
    ctx.save();
    ctx.globalAlpha = 0.08 * look.sun;
    ctx.fillStyle = '#FFE2A8';
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU + t * 0.03;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 900, a, a + 0.12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = `rgba(255,236,190,${look.sun})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 46, 0, TAU);
    ctx.fill();
  }
  // nuages en bandes, qui dérivent ; noirs et bas quand l'orage arrive
  for (let k = 0; k < 7; k++) {
    const y = -hv * (0.55 - k * 0.07) + look.storm * 40, w = 260 + (k % 3) * 120;
    const x = (((k * 397 + t * (12 + k * 3)) % (hw * 2 + w * 2)) - hw - w);
    ctx.fillStyle = look.storm > 0.05 ? mix('#FFD9B0', '#1E1A26', look.storm, 0.35 + look.storm * 0.55) : 'rgba(255,217,176,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, w, 16 + (k % 2) * 8 + look.storm * 30, 0, 0, TAU);
    ctx.fill();
  }
}

/** La mer : un dégradé, des vagues en lignes de plus en plus espacées vers le bas (perspective), le reflet du soleil. */
function sea(ctx: Ctx, hv: number, hw: number, t: number, camX: number, look: SkyLook, rough: number) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, hv);
  g.addColorStop(0, mix('#3E7F9C', '#1C2A36', look.storm));
  g.addColorStop(1, mix('#0E2C44', '#05090E', look.storm));
  ctx.fillStyle = g;
  ctx.fillRect(-hw - 40, HORIZON, hw * 2 + 80, hv - HORIZON + 40);
  if (look.sun > 0) {
    // le chemin de lumière du soleil sur l'eau, qui scintille
    for (let j = 0; j < 26; j++) {
      const y = HORIZON + 4 + j * j * 0.75, w = 30 + j * 6;
      ctx.fillStyle = `rgba(255,214,150,${0.5 * look.sun * (1 - j / 30)})`;
      for (let i = 0; i < 3; i++) {
        const x = 360 + Math.sin(t * 2 + j * 1.7 + i * 2) * w * 0.8;
        ctx.fillRect(x - w * 0.25, y, w * (0.2 + 0.15 * Math.sin(t * 3 + j + i)), 2 + j * 0.15);
      }
    }
  }
  ctx.lineWidth = 2;
  for (let j = 1; j < 24; j++) {
    const y = HORIZON + j * j * 0.95, amp = (1 + j * 0.35) * (1 + rough * 2.5), par = 0.2 + j * 0.04;
    ctx.strokeStyle = `rgba(${look.storm > 0.5 ? '170,190,210' : '200,232,245'},${0.1 + j * 0.008})`;
    ctx.beginPath();
    for (let x = -hw - 40; x <= hw + 40; x += 18) {
      const wy = y + Math.sin((x + camX * par) / (40 + j * 6) + t * (1.2 + rough) + j) * amp;
      if (x === -hw - 40) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
}

/** Mouettes : des « v » qui battent des ailes en traversant le ciel. */
function gulls(ctx: Ctx, t: number, hw: number, n: number, flee = 0) {
  ctx.strokeStyle = 'rgba(30,26,30,0.7)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const x = ((k * 211 + t * (40 + k * 7)) % (hw * 2 + 200)) - hw - 100, y = -170 + k * 26 + Math.sin(t + k) * 10 - flee * 300;
    const f = Math.sin(t * 8 + k * 2) * 6, s = 0.7 + (k % 3) * 0.2;
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, y - f * s);
    ctx.quadraticCurveTo(x - 5 * s, y - 4 * s, x, y);
    ctx.quadraticCurveTo(x + 5 * s, y - 4 * s, x + 10 * s, y - f * s);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

// ───────────────────────── Le bateau, vu de côté ─────────────────────────

/**
 * Le bateau d'Aubin, de côté, proue à droite : coque à bandes, sabords qui luisent du cœur volcanique, château arrière,
 * trois mâts et leurs voiles (sails : 0 ferlées, 1 déployées), foc, fanion. (x, y) : le milieu de la ligne de flottaison.
 */
/** Hauteur du pont à l'abscisse lx (repère du bateau) : la tonture, qui remonte vers la proue. */
const deckAt = (lx: number) => {
  const u = clamp01((lx + 210) / 415);
  return -72 + 2 * u * (1 - u) * 16 - u * u * 12;
};

function ship(ctx: Ctx, x: number, y: number, t: number, sails: number, roll: number, glow = 1, onDeck?: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(roll);
  const deck = -72;
  // gréement : étais et haubans, derrière les voiles
  ctx.strokeStyle = 'rgba(30,20,12,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-100, deck - 255);
  ctx.lineTo(-205, deck - 30);
  ctx.moveTo(10, deck - 320);
  ctx.lineTo(-100, deck - 255);
  ctx.moveTo(10, deck - 320);
  ctx.lineTo(115, deck - 250);
  ctx.moveTo(115, deck - 250);
  ctx.lineTo(300, deck - 42);
  ctx.stroke();
  // mâts
  for (const [mx, h] of [[-100, 255], [10, 320], [115, 250]] as const) {
    ctx.fillStyle = '#3A2414';
    ctx.fillRect(mx - 5, deck - h, 10, h);
    ctx.fillStyle = 'rgba(255,230,190,0.18)';
    ctx.fillRect(mx - 5, deck - h, 3, h);
    ctx.fillStyle = '#2A1A0E';
    ctx.fillRect(mx - 14, deck - h * 0.62, 28, 6); // hune
  }
  // voiles carrées : deux étages par mât, gonflées vers l'avant
  for (const [mx, h, w] of [[-100, 255, 74], [10, 320, 92], [115, 250, 70]] as const) {
    for (const [a, b, ww] of [[0.95, 0.66, 0.78], [0.6, 0.24, 1]] as const) {
      const top = deck - h * a, full = h * (a - b) - 8, drop = full * easeOut(sails), half = w * ww;
      ctx.fillStyle = '#2A1A0E';
      ctx.fillRect(mx - half - 4, top - 3, half * 2 + 8, 5); // vergue
      if (drop < 4) {
        ctx.fillStyle = '#CFC2A0';
        ctx.fillRect(mx - half, top, half * 2, 6); // ferlée
        continue;
      }
      const billow = (14 + Math.sin(t * 1.6 + mx) * 4) * sails;
      const g = ctx.createLinearGradient(mx - half, 0, mx + half + billow, 0);
      g.addColorStop(0, '#BFB08C');
      g.addColorStop(0.55, '#F2E9D2');
      g.addColorStop(1, '#D8CBA8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(mx - half, top);
      ctx.quadraticCurveTo(mx + billow * 0.4, top - 6, mx + half, top);
      ctx.quadraticCurveTo(mx + half + billow, top + drop * 0.5, mx + half - 4, top + drop);
      ctx.quadraticCurveTo(mx + billow * 0.5, top + drop + 10 * sails, mx - half + 4, top + drop);
      ctx.quadraticCurveTo(mx - half + billow * 0.5, top + drop * 0.5, mx - half, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,100,70,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (b < 0.3) {
        ctx.fillStyle = TEAL; // la bande aux couleurs du village, sur la grand-voile
        ctx.fillRect(mx - half + 6, top + drop * 0.42, half * 2 - 12 + billow * 0.5, Math.max(2, drop * 0.14));
      }
    }
  }
  // foc, du mât de misaine au beaupré
  if (sails > 0.05) {
    const s = easeOut(sails);
    ctx.fillStyle = '#EDE3C8';
    ctx.beginPath();
    ctx.moveTo(122, deck - 235);
    ctx.lineTo(122 + 170 * s, deck - 40 - 10 * s);
    ctx.quadraticCurveTo(150, deck - 60, 124, deck - 52);
    ctx.closePath();
    ctx.fill();
  }
  // fanion au sommet du grand mât, qui claque vers l'arrière
  ctx.fillStyle = TEAL;
  ctx.beginPath();
  ctx.moveTo(8, deck - 322);
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    ctx.lineTo(8 - u * 70, deck - 322 + u * 6 + Math.sin(t * 7 - u * 6) * 5 * u);
  }
  for (let i = 10; i >= 0; i--) {
    const u = i / 10;
    ctx.lineTo(8 - u * 70, deck - 306 - u * 6 + Math.sin(t * 7 - u * 6) * 5 * u);
  }
  ctx.closePath();
  ctx.fill();
  // beaupré
  ctx.strokeStyle = '#3A2414';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(190, deck - 6);
  ctx.lineTo(305, deck - 44);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // château arrière
  ctx.fillStyle = '#4A2E1A';
  ctx.fillRect(-205, deck - 34, 92, 40);
  ctx.fillStyle = '#5E3C22';
  ctx.fillRect(-205, deck - 34, 92, 8);
  for (const wx of [-190, -164, -138]) {
    ctx.fillStyle = `rgba(255,170,80,${0.55 + 0.25 * glow * Math.sin(t * 5 + wx)})`;
    ctx.fillRect(wx, deck - 20, 12, 12);
  }
  // l'équipage, sur le pont (repère du bateau) : derrière le bastingage, il en dépasse à mi-corps
  onDeck?.();
  // la coque : tonture qui remonte à la proue, tableau arrière droit, quille sous l'eau
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-210, deck);
    ctx.quadraticCurveTo(0, deck + 16, 205, deck - 12);
    ctx.quadraticCurveTo(200, 10, 150, 26);
    ctx.quadraticCurveTo(0, 48, -175, 30);
    ctx.lineTo(-210, deck);
    ctx.closePath();
  };
  const hg = ctx.createLinearGradient(0, deck, 0, 40);
  hg.addColorStop(0, '#6E4626');
  hg.addColorStop(1, '#2E1C10');
  ctx.fillStyle = hg;
  hull();
  ctx.fill();
  ctx.save();
  hull();
  ctx.clip();
  ctx.strokeStyle = 'rgba(30,18,10,0.45)'; // bordages
  ctx.lineWidth = 1.5;
  for (let k = 1; k < 7; k++) {
    ctx.beginPath();
    ctx.moveTo(-215, deck + k * 13);
    ctx.quadraticCurveTo(0, deck + 16 + k * 13, 215, deck - 12 + k * 13);
    ctx.stroke();
  }
  ctx.fillStyle = TEAL; // la bande du village, le long de la coque
  ctx.beginPath();
  ctx.moveTo(-215, deck + 16);
  ctx.quadraticCurveTo(0, deck + 32, 215, deck + 4);
  ctx.lineTo(215, deck + 14);
  ctx.quadraticCurveTo(0, deck + 42, -215, deck + 26);
  ctx.closePath();
  ctx.fill();
  // sabords, qui luisent du cœur volcanique
  for (let k = 0; k < 7; k++) {
    const px = -150 + k * 46, py = deck + 46 + Math.sin((px / 205) * 1.4) * -4 - (px > 100 ? (px - 100) * 0.12 : 0);
    ctx.fillStyle = '#1A0F08';
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255,${140 + Math.round(40 * Math.sin(t * 4 + k))},70,${0.85 * glow})`;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // lisse du bastingage
  ctx.strokeStyle = '#2A1A0E';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-210, deck);
  ctx.quadraticCurveTo(0, deck + 16, 205, deck - 12);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const px = -200 + k * 26, py = deck + 8 * (1 - ((px / 205) ** 2)) - (px > 0 ? px * 0.06 : 0);
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 12);
  }
  ctx.moveTo(-210, deck - 12);
  ctx.quadraticCurveTo(0, deck + 4, 205, deck - 24);
  ctx.stroke();
  ctx.restore();
}

/** L'eau devant la coque : une bande de vagues par-dessus le bas du bateau, l'écume à la proue, le sillage. */
function waterline(ctx: Ctx, x: number, t: number, hw: number, speed: number, rough: number, storm = 0) {
  ctx.fillStyle = mix('#2E6F8C', '#121C26', storm, 0.92);
  ctx.beginPath();
  ctx.moveTo(-hw - 40, WATER + 40);
  for (let px = -hw - 40; px <= hw + 40; px += 14) ctx.lineTo(px, WATER + 8 + Math.sin(px / 38 + t * (2 + rough)) * (4 + rough * 8));
  ctx.lineTo(hw + 40, WATER + 400);
  ctx.lineTo(-hw - 40, WATER + 400);
  ctx.closePath();
  ctx.fill();
  // écume le long de la coque et à la proue (plus forte quand il file)
  ctx.fillStyle = `rgba(235,248,255,${0.55 + speed * 0.3})`;
  for (let k = 0; k < 14; k++) {
    const f = (t * (0.6 + speed) + k / 14) % 1, px = x + 190 - f * (380 + speed * 300), py = WATER + 8 + Math.sin(k * 3 + t * 4) * 3;
    ctx.beginPath();
    ctx.ellipse(px, py, 10 + f * 16 + speed * 10, 3 + f * 2, 0, 0, TAU);
    ctx.fill();
  }
  if (speed > 0.05) {
    ctx.strokeStyle = `rgba(235,248,255,${0.4 * speed})`;
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      const y = WATER + 16 + k * 10;
      ctx.moveTo(x - 210, y);
      ctx.quadraticCurveTo(x - 380 - k * 60, y + 6, x - 620 - k * 90, y + k * 6);
      ctx.stroke();
    }
  }
}

/**
 * Un membre de l'équipage, les pieds posés en (x, y) (le centre de son ombre) : un dompteur, ou un Alpha (avec sa
 * couronne). hop : petit saut (quand le bateau est frappé).
 */
function crewman(ctx: Ctx, w: Walker, x: number, y: number, t: number, moving: boolean, face = 1) {
  const S = 1.35;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(S * face, S);
  if (w.mate) drawPlayer(ctx, 0, -12, w.mate.color, 1, 0, w.mate.armor, '', t, moving, false, false, false, w.mate.cls, null, 0, true, w.mate.hat);
  else if (w.pet) {
    const r = 15;
    drawUnit(ctx, { x: 0, y: -r * 0.75, r, species: w.pet.species, alpha: true, legend: w.pet.legend, wild: false, face: 1, t, seed: w.i * 3.1, flash: false, moving });
  }
  ctx.restore();
}
interface Walker { i: number; mate?: Mate; pet?: Mate['pet'] }
/** Dompteurs et Alphas à la file (chacun suivi du sien). */
const walkersOf = (crew: Crew): Walker[] => crew.slice(0, 4).flatMap((m) => [{ mate: m }, ...(m.pet ? [{ pet: m.pet }] : [])]).map((w, i) => ({ ...w, i }));
/** Places sur le pont, de la proue vers l'arrière (le premier monté va le plus loin), devant le château arrière. */
const deckSpot = (i: number, n: number) => 165 - i * Math.min(48, 265 / Math.max(1, n - 1));

// ───────────────────────── L'embarquement ─────────────────────────

/** L'île, de côté : la plage, des dunes, des palmiers, et au loin le volcan qui fume. */
function island(ctx: Ctx, camX: number, t: number) {
  // loin : le volcan
  ctx.save();
  ctx.translate(-camX * 0.35, 0);
  ctx.fillStyle = '#5A3A3A';
  ctx.beginPath();
  ctx.moveTo(-900, HORIZON + 2);
  ctx.lineTo(-560, HORIZON - 170);
  ctx.lineTo(-500, HORIZON - 175);
  ctx.lineTo(-170, HORIZON + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,150,80,0.35)';
  ctx.beginPath();
  ctx.ellipse(-530, HORIZON - 172, 30, 7, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.12 + k / 6) % 1;
    ctx.fillStyle = `rgba(90,80,80,${0.4 * (1 - f)})`;
    ctx.beginPath();
    ctx.arc(-530 + f * 120, HORIZON - 190 - f * 140, 18 + f * 50, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // près : la plage et ses dunes
  ctx.save();
  ctx.translate(-camX, 0);
  ctx.fillStyle = '#C9A46A';
  ctx.beginPath();
  ctx.moveTo(-2400, HORIZON - 30);
  ctx.quadraticCurveTo(-900, HORIZON - 70, -560, HORIZON - 10);
  ctx.quadraticCurveTo(-420, WATER - 20, -250, WATER + 14);
  ctx.lineTo(-2400, WATER + 300);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#E2C890';
  ctx.beginPath();
  ctx.moveTo(-2400, WATER - 2);
  ctx.quadraticCurveTo(-800, WATER - 30, -560, WATER - 6);
  ctx.quadraticCurveTo(-400, WATER + 2, -250, WATER + 14);
  ctx.lineTo(-2400, WATER + 300);
  ctx.closePath();
  ctx.fill();
  for (const [px, h, lean] of [[-760, 150, -0.15], [-680, 120, 0.12], [-1040, 170, -0.08]] as const) {
    // palmiers en ombres chinoises
    ctx.strokeStyle = '#3A2A20';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(px, HORIZON + 10);
    ctx.quadraticCurveTo(px + lean * 200, HORIZON - h * 0.5, px + lean * h, HORIZON - h);
    ctx.stroke();
    ctx.fillStyle = '#2E4A2A';
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.55 + Math.sin(t * 1.5 + k) * 0.05;
      ctx.beginPath();
      ctx.ellipse(px + lean * h + Math.cos(a) * 34, HORIZON - h + Math.sin(a) * 18 + 10, 40, 8, a, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Le large, vu de la plage : le sable au premier plan, des palmiers en ombres chinoises, Aubin qui fait signe. */
function shore(ctx: Ctx, hv: number, hw: number, t: number) {
  ctx.fillStyle = '#B8935A';
  ctx.beginPath();
  ctx.moveTo(-hw - 40, hv * 0.62);
  ctx.quadraticCurveTo(-hw * 0.2, hv * 0.5, hw * 0.3, hv * 0.72);
  ctx.quadraticCurveTo(hw * 0.7, hv * 0.82, hw + 40, hv * 0.78);
  ctx.lineTo(hw + 40, hv + 40);
  ctx.lineTo(-hw - 40, hv + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(240,214,160,0.5)'; // l'écume qui lèche le sable
  ctx.beginPath();
  for (let x = -hw - 40; x <= hw + 40; x += 20) {
    const y = (x < hw * 0.3 ? hv * 0.62 + ((x + hw + 40) / (hw * 1.3 + 40)) * (-hv * 0.02) : hv * 0.74) - 4 + Math.sin(x / 50 + t * 2) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(hw + 40, hv * 0.7);
  ctx.lineTo(-hw - 40, hv * 0.55);
  ctx.closePath();
  ctx.fill();
  // palmiers, tout près, en ombres chinoises
  for (const [px, h, lean] of [[-hw + 30, hv * 0.8, 0.22], [-hw + 130, hv * 0.62, 0.1]] as const) {
    const base = hv * 0.9;
    ctx.strokeStyle = '#1E1612';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px + lean * h * 0.6, base - h * 0.5, px + lean * h, base - h);
    ctx.stroke();
    ctx.fillStyle = '#16201A';
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.5 + Math.sin(t * 1.2 + k) * 0.06;
      ctx.beginPath();
      ctx.ellipse(px + lean * h + Math.cos(a) * 52, base - h + Math.sin(a) * 26 + 16, 62, 12, a, 0, TAU);
      ctx.fill();
    }
  }
}

/** Aubin, resté sur la plage, qui agite le bras (de dos : on voit son crâne, ses touffes blanches et sa canne). */
function aubinWaving(ctx: Ctx, x: number, y: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2.2, 2.2);
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 14, 17, 6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5B3F2C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-20, 14);
  ctx.lineTo(-21, -14);
  ctx.stroke();
  const wave = Math.sin(t * 7) * 0.5;
  ctx.strokeStyle = '#A8997F';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(10, -6);
  ctx.lineTo(10 + Math.sin(-0.6 + wave) * 18, -6 - Math.cos(-0.6 + wave) * 18);
  ctx.stroke();
  ctx.fillStyle = '#B7A88F';
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,250,235,0.4)';
  ctx.beginPath();
  ctx.ellipse(-3, -9, 6, 3, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#EEEAE2';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sd * 13.5, -2, 4.2, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'butt';
  ctx.restore();
}

/** Le bateau au loin : petit (k), coupé à la ligne de flottaison, son écume et son sillage. */
function farShip(ctx: Ctx, x: number, y: number, k: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, -500, 800, 506);
  ctx.clip();
  ship(ctx, 0, 0, t, 1, Math.sin(t * 1.3) * 0.015);
  ctx.restore();
  ctx.fillStyle = 'rgba(235,248,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 230, 10, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(235,248,255,0.45)';
  ctx.lineWidth = 6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-200, 6);
    ctx.quadraticCurveTo(-500, 10 + s * 20, -900, 14 + s * 60);
    ctx.stroke();
  }
  ctx.restore();
}

const CUT = 8.6; // fin du premier plan (on suit le bateau), début du second (depuis la plage, il s'éloigne)

function boardingScene(crew: Crew, shake: (k: number) => void): Scene {
  const START = 60; // le bateau, à quai, contre la plage
  const LEAVE = 4.4; // il largue les amarres
  const shipX = (t: number) => START + Math.max(0, t - LEAVE) ** 2 * 30;
  const look: SkyLook = { top: '#2A2E5A', mid: '#C86A5A', low: '#FFC98A', sun: 1, storm: 0 };
  const walkers = walkersOf(crew), n = walkers.length;
  const PLANK_BOTTOM = -300, PLANK_TOP = -95; // la passerelle, de la plage au pont (repère du bateau)
  /** Où en est le marcheur i à l'instant t : sur la plage ou la passerelle (dehors), ou à sa place sur le pont. */
  const walk = (i: number, t: number) => {
    const spot = deckSpot(i, n), t0 = 0.1 + i * 0.18, d = Math.max(0, t - t0) * 240;
    const legs: [number, number][] = [[-380 - i * 26, WATER - 8], [PLANK_BOTTOM, WATER - 8], [PLANK_TOP, WATER + deckAt(PLANK_TOP) - 4], [spot, WATER + deckAt(spot) + 2]];
    let left = d;
    for (let k = 0; k < 3; k++) {
      const [ax, ay] = legs[k], [bx, by] = legs[k + 1], l = Math.hypot(bx - ax, by - ay);
      if (left <= l) return { x: ax + ((bx - ax) * left) / l, y: ay + ((by - ay) * left) / l, deck: k === 2, moving: true };
      left -= l;
    }
    return { x: spot, y: WATER + deckAt(spot) + 2, deck: true, moving: false };
  };
  return {
    dur: 14.4,
    cues: [
      { at: 0.2, run: () => sound.play('waves', 0.6) },
      { at: 3.6, run: () => sound.play('shiphorn', 0.9) },
      { at: LEAVE, run: () => shake(0.15) },
      { at: 5.6, run: () => sound.play('fanfare', 0.7) },
      { at: CUT + 0.3, run: () => sound.play('waves', 0.5) },
    ],
    draw(ctx, t, hv, hw) {
      sky(ctx, hv, hw, look, t);
      if (t >= CUT) {
        // second plan, depuis la plage : le bateau file vers le soleil et rapetisse jusqu'à l'horizon
        gulls(ctx, t, hw, 3);
        sea(ctx, hv, hw, t, 0, look, 0.08);
        // il part tout près, en grand, et rapetisse peu à peu en filant vers le soleil (la perspective : sa taille suit sa
        // hauteur au-dessus de l'horizon)
        const p = clamp01((t - CUT) / 5.6), u = 1 - (1 - p) ** 1.5, y = WATER + 40 - (WATER + 40 - HORIZON - 2) * u;
        const k = 0.75 * ((y - HORIZON) / (WATER + 40 - HORIZON)) + 0.015;
        farShip(ctx, -40 + 400 * u, y, k, t);
        shore(ctx, hv, hw, t);
        aubinWaving(ctx, -hw * 0.55, hv * 0.6, t);
        caption(ctx, t, CUT + 0.8, 13.6, 'L’île s’éloigne… cap sur le large.', hv, -hv * 0.62);
        // fondu enchaîné depuis le premier plan
        const cut = 1 - win(t, CUT, CUT + 0.35);
        if (cut > 0) {
          ctx.fillStyle = `rgba(0,0,0,${cut})`;
          ctx.fillRect(-hw - 40, -hv - 40, hw * 2 + 80, hv * 2 + 80);
        }
        return;
      }
      const x = shipX(t), camX = Math.max(0, x - START) * 0.9, speed = clamp01((t - LEAVE) / 3);
      gulls(ctx, t, hw, 5);
      sea(ctx, hv, hw, t, camX, look, 0.1);
      island(ctx, camX, t);
      const sx = x - camX, roll = Math.sin(t * 1.3) * 0.012 + Math.sin(t * 0.7) * 0.008;
      // la passerelle, de la plage au pont (retirée une fois tout le monde à bord)
      const plank = 1 - win(t, 3.4, 3.8);
      if (plank > 0) {
        ctx.save();
        ctx.globalAlpha = plank;
        ctx.strokeStyle = '#7A5232';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(sx + PLANK_BOTTOM, WATER - 4);
        ctx.lineTo(sx + PLANK_TOP, WATER + deckAt(PLANK_TOP));
        ctx.stroke();
        ctx.restore();
      }
      const pos = walkers.map((w) => walk(w.i, t));
      // à bord : sur le pont, derrière le bastingage, ils tanguent avec le bateau
      ship(ctx, sx, WATER, t, win(t, 3.7, 5.0), roll, 1, () => {
        walkers.forEach((w, i) => pos[i].deck && crewman(ctx, w, pos[i].x, pos[i].y - WATER, t, pos[i].moving));
      });
      // sur la plage et la passerelle : devant la coque
      walkers.forEach((w, i) => !pos[i].deck && crewman(ctx, w, sx + pos[i].x, pos[i].y, t, pos[i].moving));
      waterline(ctx, sx, t, hw, speed, 0.1);
      title(ctx, t, 5.6, CUT, 'Cap sur le large', 'Le bateau d’Aubin quitte l’île', hv, '#FFE2A8', '#7A3A20');
      const out = win(t, CUT - 0.35, CUT); // fondu vers le second plan
      if (out > 0) {
        ctx.fillStyle = `rgba(0,0,0,${out})`;
        ctx.fillRect(-hw - 40, -hv - 40, hw * 2 + 80, hv * 2 + 80);
      }
    },
  };
}

// ───────────────────────── Le Kraken ─────────────────────────

/** Un tentacule qui sort de l'eau en (bx, WATER) : rise de 0 à 1, curl l'enroule, lean le penche vers le bateau. */
function tentacle(ctx: Ctx, bx: number, len: number, rise: number, curl: number, lean: number, t: number, w: number) {
  if (rise <= 0) return;
  const n = 26, pts: [number, number, number][] = [];
  let x = bx, y = WATER + 20, a = -Math.PI / 2 + lean;
  const seg = (len * easeOut(rise)) / n;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([x, y, a]);
    a += (curl * u * u * 0.32 + Math.sin(t * 2.4 + i * 0.4 + bx) * 0.035) * (0.4 + rise * 0.6);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
  }
  const width = (i: number) => w * (1 - (i / n) * 0.9);
  const side = (s: number) => pts.map(([px, py, pa], i) => [px + Math.cos(pa + Math.PI / 2) * width(i) * s, py + Math.sin(pa + Math.PI / 2) * width(i) * s] as const);
  const l = side(1), r = side(-1);
  ctx.beginPath();
  l.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  for (let i = r.length - 1; i >= 0; i--) ctx.lineTo(r[i][0], r[i][1]);
  ctx.closePath();
  // mêmes couleurs que le Kraken du jeu : violet, plus sombre sur les bords, ventouses rosées, cerné d'encre
  const g = ctx.createLinearGradient(bx - w, 0, bx + w, 0);
  g.addColorStop(0, KC.dark);
  g.addColorStop(0.5, '#6A3E7E');
  g.addColorStop(1, KC.dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,18,16,0.75)';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = KC.sucker;
  for (let i = 2; i < n - 2; i += 2) {
    const [px, py] = r[i], ww = width(i) * 0.32;
    ctx.beginPath();
    ctx.ellipse(px + (pts[i][0] - px) * 0.25, py + (pts[i][1] - py) * 0.25, ww, ww * 0.75, pts[i][2], 0, TAU);
    ctx.fill();
  }
  // de l'eau qui ruisselle le long, tant qu'il sort
  if (rise < 1) {
    ctx.fillStyle = 'rgba(220,240,255,0.6)';
    for (let k = 0; k < 8; k++) {
      const i = Math.floor((k / 8) * n), f = (t * 2 + k / 8) % 1;
      ctx.beginPath();
      ctx.arc(pts[i][0] + Math.sin(k) * w * 0.6, pts[i][1] + f * 40, 2.5, 0, TAU);
      ctx.fill();
    }
  }
}

function krakenScene(name: string, sub: string, crew: Crew, shake: (k: number) => void): Scene {
  const X = -60; // le bateau, au milieu
  const walkers = walkersOf(crew), n = walkers.length;
  const spray: { x: number; y: number; vx: number; vy: number; at: number }[] = [];
  const burst = (x: number, n: number, at: number) => {
    for (let k = 0; k < n; k++) spray.push({ x, y: WATER - 70, vx: (Math.random() - 0.5) * 420, vy: -200 - Math.random() * 420, at });
  };
  return {
    dur: 9.6,
    cues: [
      { at: 0.2, run: () => sound.play('waves', 0.5) },
      { at: 2.6, run: () => sound.play('waves', 0.8) },
      { at: 4.4, run: () => { sound.play('boom', 1); sound.play('kraken', 1); shake(1); } },
      { at: 5.7, run: () => { sound.play('splash', 1); shake(0.8); burst(X - 80, 26, 5.7); } },
      { at: 6.1, run: () => { sound.play('splash', 1); shake(0.8); burst(X + 120, 26, 6.1); } },
      { at: 6.6, run: () => { sound.play('roar', 1); shake(0.6); } },
    ],
    draw(ctx, t, hv, hw) {
      const storm = win(t, 2.2, 4.2), rough = 0.15 + storm * 0.8;
      const look: SkyLook = { top: hexOf(mix('#1E3050', '#08060E', storm)), mid: hexOf(mix('#B86A62', '#22182E', storm)), low: hexOf(mix('#F2B080', '#3A2A40', storm)), sun: 0.6 * (1 - storm), storm };
      sky(ctx, hv, hw, look, t);
      gulls(ctx, t, hw, 4, win(t, 2.4, 3.6));
      sea(ctx, hv, hw, t, t * 30, look, rough);
      // éclair : le ciel blanchit d'un coup, un trait zébré
      const flash = Math.max(0, 1 - Math.abs(t - 4.45) / 0.18) + Math.max(0, 1 - Math.abs(t - 7.1) / 0.12) * 0.6;
      if (flash > 0) {
        ctx.strokeStyle = `rgba(240,240,255,${flash})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        let lx = -380, ly = -hv;
        ctx.moveTo(lx, ly);
        while (ly < HORIZON) {
          lx += (Math.sin(ly * 13.7) * 0.5) * 70;
          ly += 46;
          ctx.lineTo(lx, ly);
        }
        ctx.stroke();
      }
      // le Kraken, tel qu'en jeu, qui sort de l'eau derrière le bateau ; ses deux yeux s'ouvrent, ils luisent
      const head = easeOut((t - 4.4) / 1.4);
      if (head > 0) {
        const R = 170, hx = Math.min(X + 340, hw - R * 0.6), hy = WATER - R + (1 - head) * R * 2.6; // les yeux bien au-dessus du bastingage
        ctx.save();
        ctx.beginPath();
        ctx.rect(-hw - 40, -hv - 40, hw * 2 + 80, WATER + 30 + hv);
        ctx.clip();
        const open = easeOut((t - 5.0) / 0.6);
        if (open > 0) {
          const glow = ctx.createRadialGradient(hx, hy, 10, hx, hy, R * 0.9);
          glow.addColorStop(0, `rgba(240,208,96,${0.35 * open})`);
          glow.addColorStop(1, 'rgba(240,208,96,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(hx - R, hy - R, R * 2, R * 2);
        }
        drawKraken(ctx, hx, hy, R, t, open);
        // l'eau qui ruisselle de sa tête
        ctx.strokeStyle = 'rgba(210,235,250,0.6)';
        ctx.lineWidth = 3;
        for (let k = 0; k < 9; k++) {
          const dx = (-0.8 + (k / 8) * 1.6) * R * 0.75, f = (t * 1.4 + k * 0.37) % 1, top = hy - R * 1.3 * Math.sqrt(Math.max(0, 1 - (dx / (R * 0.8)) ** 2));
          ctx.beginPath();
          ctx.moveTo(hx + dx, top + f * 80);
          ctx.lineTo(hx + dx, top + f * 80 + 26);
          ctx.stroke();
        }
        ctx.restore();
      }
      // le bateau, qui tangue de plus en plus, et penche quand les tentacules s'abattent
      const hitRoll = -Math.max(0, 1 - Math.abs(t - 5.8) / 0.5) * 0.08 + Math.max(0, 1 - Math.abs(t - 6.2) / 0.5) * 0.06;
      const roll = Math.sin(t * (1.2 + storm)) * (0.012 + storm * 0.03) + hitRoll;
      // tentacules derrière le bateau
      tentacle(ctx, X - 330, 380, easeOut((t - 4.9) / 0.9), 1.4, 0.25, t, 30);
      tentacle(ctx, X + 640, 420, easeOut((t - 5.1) / 0.9), -1.2, -0.25, t, 34);
      // l'équipage, sur le pont : il sursaute quand le Kraken surgit et quand les tentacules frappent, puis fait face
      const jump = (at: number) => Math.max(0, Math.sin(clamp01((t - at) / 0.35) * Math.PI)) * 14;
      ship(ctx, X, WATER + Math.sin(t * 1.8) * (2 + storm * 6), t, 1, roll, 1 - storm * 0.4, () => {
        walkers.forEach((w) => {
          const lx = deckSpot(w.i, n), hop = Math.max(jump(4.45 + w.i * 0.04), jump(5.7), jump(6.1));
          crewman(ctx, w, lx, deckAt(lx) + 2 - hop, t, false, t > 4.6 ? 1 : (w.i % 2 ? -1 : 1));
        });
      });
      // ceux qui s'abattent sur le pont, et ceux qui jaillissent devant
      const slam = (at: number) => (t < at ? easeIn((t - (at - 0.5)) / 0.5) * 0.9 : 1);
      tentacle(ctx, X - 250, 330, easeOut((t - 5.0) / 0.6), 3.4 * slam(5.7), 0.5, t, 32);
      tentacle(ctx, X + 230, 330, easeOut((t - 5.3) / 0.6), -3.6 * slam(6.1), -0.45, t, 32);
      tentacle(ctx, X + 780, 300, easeOut((t - 6.0) / 0.8), -1.0, -0.1, t, 26);
      tentacle(ctx, X - 600, 260, easeOut((t - 6.2) / 0.8), 1.1, 0.15, t, 24);
      waterline(ctx, X, t, hw, 0.2, rough, storm);
      // l'ombre immense qui passe sous la coque, et les bulles qui remontent
      const shadow = win(t, 3.0, 4.4) * (1 - win(t, 4.6, 5.4) * 0.5);
      if (shadow > 0) {
        ctx.fillStyle = `rgba(4,6,12,${0.55 * shadow})`;
        ctx.beginPath();
        ctx.ellipse(X + 60 + Math.sin(t) * 30, WATER + 120, 520 * shadow, 110 * shadow, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(210,240,255,0.7)';
        for (let k = 0; k < 18; k++) {
          const f = (t * 0.9 + k / 18) % 1;
          ctx.beginPath();
          ctx.arc(X - 300 + ((k * 137) % 640), WATER + 140 - f * 130, 2 + f * 4, 0, TAU);
          ctx.fill();
        }
      }
      // gerbes d'eau
      ctx.fillStyle = 'rgba(225,242,255,0.85)';
      for (const d of spray) {
        const k = t - d.at;
        if (k < 0 || k > 1.4) continue;
        const px = d.x + d.vx * k, py = d.y + d.vy * k + 520 * k * k;
        ctx.beginPath();
        ctx.arc(px, py, 3 + (1 - k) * 4, 0, TAU);
        ctx.fill();
      }
      // vent : des traits qui filent, avec l'orage
      if (storm > 0) {
        ctx.strokeStyle = `rgba(200,210,230,${0.25 * storm})`;
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 24; k++) {
          const f = (t * 1.6 + k / 24) % 1, y = -hv + ((k * 97) % (hv * 2));
          const x = hw - f * (hw * 2 + 200);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 60, y - 6);
          ctx.stroke();
        }
      }
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
        ctx.fillRect(-hw - 40, -hv - 40, hw * 2 + 80, hv * 2 + 80);
      }
      // les mots, puis son nom
      caption(ctx, t, 0.9, 2.7, 'Au large, la mer est calme…', hv);
      caption(ctx, t, 2.9, 4.2, '… trop calme.', hv);
      title(ctx, t, 6.5, 9.2, name, sub, hv, '#FF8A5C', '#3A0E10', true);
    },
  };
}

const hexOf = (rgba: string) => {
  const m = rgba.match(/\d+/g)!.map(Number);
  return `#${m.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// ───────────────────────── Textes ─────────────────────────

/** Une phrase en bas de l'écran, en italique, qui apparaît puis s'efface. */
function caption(ctx: Ctx, t: number, a: number, b: number, text: string, hv: number, y = hv * 0.72) {
  const k = win(t, a, a + 0.5) * (1 - win(t, b - 0.5, b));
  if (k <= 0) return;
  ctx.globalAlpha = k;
  ctx.font = `italic 600 30px ${font()}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#EEE7D7';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 12;
  ctx.fillText(text, 0, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** Un grand titre, lettre à lettre (chaque lettre tombe et rebondit), et son sous-titre. menace : il tremble, rouge. */
function title(ctx: Ctx, t: number, a: number, b: number, text: string, sub: string, hv: number, fill: string, edge: string, threat = false) {
  const out = 1 - win(t, b - 0.6, b);
  if (t < a || out <= 0) return;
  const size = threat ? 92 : 76, y = -hv * 0.42;
  ctx.font = `700 ${size}px ${font()}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const chars = [...(threat ? text.toUpperCase() : text)], wTot = ctx.measureText(chars.join('')).width;
  // un voile sombre derrière, pour qu'il se lise sur n'importe quel fond
  ctx.save();
  ctx.translate(0, y + size * 0.4);
  ctx.scale(wTot / (size * 1.2), 1);
  const veil = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.2);
  veil.addColorStop(0, `rgba(0,0,0,${0.55 * win(t, a, a + 0.4) * out})`);
  veil.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = veil;
  ctx.fillRect(-size * 1.2, -size * 1.2, size * 2.4, size * 2.4);
  ctx.restore();
  let x = -wTot / 2;
  chars.forEach((ch, i) => {
    const k = (t - a - i * 0.045) / 0.4;
    const w = ctx.measureText(ch).width;
    if (k > 0) {
      const drop = (1 - easeOut(k)) * -60, bounce = Math.sin(clamp01(k) * Math.PI) * 6;
      const jx = threat ? (Math.random() - 0.5) * 3 : 0, jy = threat ? (Math.random() - 0.5) * 3 : 0;
      ctx.globalAlpha = clamp01(k * 2) * out;
      ctx.lineWidth = 10;
      ctx.strokeStyle = edge;
      ctx.lineJoin = 'round';
      ctx.strokeText(ch, x + jx, y + drop - bounce + jy);
      ctx.fillStyle = fill;
      ctx.fillText(ch, x + jx, y + drop - bounce + jy);
    }
    x += w;
  });
  // un trait sous le titre, qui s'étire
  const line = easeOut((t - a - 0.4) / 0.8);
  ctx.globalAlpha = out;
  ctx.fillStyle = fill;
  ctx.fillRect(-wTot / 2 * line, y + size * 0.55, wTot * line, 4);
  // le sous-titre
  const s = win(t, a + 0.7, a + 1.3);
  ctx.globalAlpha = s * out;
  ctx.font = `600 ${threat ? 30 : 28}px ${font()}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F4ECD8';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillText(sub, 0, y + size * 0.55 + 38);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}
