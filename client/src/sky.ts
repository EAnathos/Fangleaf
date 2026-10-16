// Nuit et pluie, dessinées par-dessus la scène (le ciel lui-même vient de shared/weather.ts).
// - Nuit : une carte de lumière en basse résolution (couleur de la nuit, puis halos ajoutés : feux, dompteurs,
//   créatures lumineuses), appliquée sur l'image en « multiply ». Une seule copie plein écran par image.
// - Pluie : des traits obliques recyclés, accrochés au monde (ils défilent quand on bouge), et des éclaboussures.

import type { Sky } from '../../shared/weather.ts';
import { particleRate, settings } from './settings.ts';

const LIGHT_RES = 4; // la carte de lumière est 4 fois moins fine que l'écran : ses halos sont flous de toute façon
const NIGHT = [30, 38, 80]; // ce qui reste des couleurs en pleine nuit : sombre, la torche fait la différence
const DUSK = [255, 176, 128];
const MAX_DROPS = 520;
const MAX_SPLASH = 70;
const MAX_GRAINS = 420; // tempête de sable : traînées de sable

/** Créatures qui brillent la nuit : [rayon du halo en rayons de la créature, couleur, intensité]. */
export const GLOW: Record<string, [number, string, number]> = {
  wisp: [8, '70,120,255', 0.9], // plus bleu que le feu follet lui-même : ajouté au bleu de la nuit, il tournerait au vert
  old_flame: [5, '60,100,255', 1],
  sporelin: [4.5, '255,170,120', 0.4],
  spore_giant: [3, '255,170,120', 0.55],
  firefly: [7, '220,240,110', 0.7],
};

interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  a: number;
}

export class SkyFx {
  private map = document.createElement('canvas');
  private g = this.map.getContext('2d')!;
  private halos = new Map<string, HTMLCanvasElement>();
  private lights: Light[] = [];
  private count = 0;
  private drops = new Float32Array(MAX_DROPS * 4); // x, y, longueur, vitesse (pixels de l'écran)
  private splashes: { x: number; y: number; age: number }[] = [];
  private lastCam?: { x: number; y: number };
  private grains = new Float32Array(MAX_GRAINS * 4); // x, y, longueur, vitesse (pixels de l'écran)
  private gusts: { x: number; y: number; r: number; v: number }[] = []; // nuages de poussière qui passent
  private stormCam?: { x: number; y: number };

  /** À appeler au début de chaque image, avant d'ajouter les lumières. */
  begin() {
    this.count = 0;
  }

  /** Une source de lumière (coordonnées du monde, rayon du halo, couleur « r,g,b », intensité 0 à 1). */
  light(x: number, y: number, r: number, color: string, a: number) {
    const l = this.lights[this.count] ?? (this.lights[this.count] = { x: 0, y: 0, r: 0, color: '', a: 0 });
    l.x = x;
    l.y = y;
    l.r = r;
    l.color = color;
    l.a = a;
    this.count++;
  }

  /** Halo pré-dessiné d'une couleur : plein au centre, qui s'efface doucement. */
  private halo(color: string) {
    let c = this.halos.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${color},1)`);
    grad.addColorStop(0.35, `rgba(${color},0.55)`);
    grad.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.halos.set(color, c);
    return c;
  }

  /** Assombrit l'image selon l'heure et la pluie, en gardant la lumière des sources ajoutées. */
  shade(ctx: CanvasRenderingContext2D, scale: number, camX: number, camY: number, sky: Sky) {
    const dark = 1 - sky.light, wet = sky.rain * 0.16;
    if (dark < 0.01 && wet < 0.01) return;
    // couleur ambiante : blanc le jour (aucun effet), bleu nuit, teinte chaude au crépuscule, grisée sous la pluie
    const amb = [0, 1, 2].map((i) => {
      const v = 255 + (NIGHT[i] - 255) * dark;
      return (v + (DUSK[i] - v) * sky.dusk * 0.35) * (1 - wet * (i === 2 ? 0.6 : 1));
    });
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const w = Math.ceil(W / LIGHT_RES), h = Math.ceil(H / LIGHT_RES);
    if (this.map.width !== w || this.map.height !== h) [this.map.width, this.map.height] = [w, h];
    const g = this.g, k = scale / LIGHT_RES, glow = Math.max(dark, sky.rain * 0.25);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`;
    g.fillRect(0, 0, w, h);
    if (glow > 0.01) {
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.count; i++) {
        const l = this.lights[i], sx = (l.x - camX) * k + w / 2, sy = (l.y - camY) * k + h / 2, r = l.r * k;
        if (sx + r < 0 || sy + r < 0 || sx - r > w || sy - r > h) continue;
        g.globalAlpha = Math.min(1, l.a * glow);
        g.drawImage(this.halo(l.color), sx - r, sy - r, r * 2, r * 2);
      }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.map, 0, 0, W, H);
    ctx.restore();
  }

  /**
   * Tempête de sable (level : 0 à 1) : voile ocre, vue réduite (bords noyés dans le sable), traînées de sable
   * poussées par le vent et nuages de poussière qui traversent l'écran.
   */
  sandstorm(ctx: CanvasRenderingContext2D, scale: number, camX: number, camY: number, level: number, dt: number, dpr: number, light: number) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const dx = this.stormCam ? (camX - this.stormCam.x) * scale : 0, dy = this.stormCam ? (camY - this.stormCam.y) * scale : 0;
    this.stormCam = { x: camX, y: camY };
    if (level < 0.02) {
      this.gusts.length = 0;
      return;
    }
    const k = 0.45 + light * 0.55; // la nuit, le sable est plus sombre
    const sand = (a: number) => `rgba(${(214 * k) | 0},${(168 * k) | 0},${(104 * k) | 0},${a})`;
    const dust = (a: number) => `rgba(${(150 * k) | 0},${(104 * k) | 0},${(58 * k) | 0},${a})`; // sable épais, plus sombre
    const grain = (a: number) => `rgba(${(250 * k) | 0},${(232 * k) | 0},${(196 * k) | 0},${a})`; // grains qui accrochent la lumière
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = sand(0.32 * level);
    ctx.fillRect(0, 0, W, H);
    // nuages de poussière
    while (this.gusts.length < 7) this.gusts.push({ x: Math.random() * W - W * 0.3, y: Math.random() * H, r: (180 + Math.random() * 220) * dpr, v: (260 + Math.random() * 200) * dpr });
    for (const g of this.gusts) {
      g.x += g.v * dt - dx;
      g.y += g.v * 0.18 * dt - dy;
      if (g.x - g.r > W) [g.x, g.y] = [-g.r, Math.random() * H];
      if (g.y - g.r > H) g.y = -g.r;
      else if (g.y + g.r < 0) g.y = H + g.r;
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      grad.addColorStop(0, dust(0.32 * level));
      grad.addColorStop(1, dust(0));
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    // traînées de sable, presque à l'horizontale
    const n = Math.min(MAX_GRAINS, Math.round(MAX_GRAINS * level * particleRate() * Math.min(1, (W * H) / (1920 * 1080))));
    const d = this.grains, slope = 0.18;
    ctx.strokeStyle = grain(0.6);
    ctx.lineWidth = 1.8 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (d[o + 3] === 0) {
        d[o] = Math.random() * W;
        d[o + 1] = Math.random() * H;
        d[o + 2] = (18 + Math.random() * 40) * dpr;
        d[o + 3] = (900 + Math.random() * 700) * dpr;
      }
      const v = d[o + 3] * dt;
      d[o] += v - dx;
      d[o + 1] += v * slope - dy;
      if (d[o] > W + d[o + 2]) [d[o], d[o + 1]] = [-d[o + 2], Math.random() * H];
      else if (d[o] < -d[o + 2]) d[o] += W + d[o + 2];
      if (d[o + 1] > H) d[o + 1] -= H;
      else if (d[o + 1] < 0) d[o + 1] += H;
      ctx.moveTo(d[o], d[o + 1]);
      ctx.lineTo(d[o] - d[o + 2], d[o + 1] - d[o + 2] * slope);
    }
    ctx.stroke();
    // vue réduite : les bords se noient dans le sable
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.42 - 0.22 * level), W / 2, H / 2, Math.max(W, H) * 0.62);
    vg.addColorStop(0, dust(0));
    vg.addColorStop(0.55, dust(0.45 * level));
    vg.addColorStop(1, dust(0.92 * level));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** Pluie par-dessus tout (sauf l'interface), plus discrète la nuit. */
  rain(ctx: CanvasRenderingContext2D, scale: number, camX: number, camY: number, sky: Sky, dt: number, dpr: number) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    // les gouttes sont accrochées au monde : quand la caméra bouge, elles défilent avec le sol
    const dx = this.lastCam ? (camX - this.lastCam.x) * scale : 0, dy = this.lastCam ? (camY - this.lastCam.y) * scale : 0;
    this.lastCam = { x: camX, y: camY };
    if (!settings.display.weather || sky.rain < 0.02) {
      this.splashes.length = 0;
      return;
    }
    const n = Math.min(MAX_DROPS, Math.round(MAX_DROPS * sky.rain * particleRate() * Math.min(1, (W * H) / (1920 * 1080))));
    const d = this.drops, wind = -0.22;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.2 * dpr;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(200,214,236,${0.32 + sky.light * 0.12})`;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (d[o + 3] === 0) {
        // première fois : n'importe où sur l'écran
        d[o] = Math.random() * W;
        d[o + 1] = Math.random() * H;
        d[o + 2] = (14 + Math.random() * 12) * dpr;
        d[o + 3] = (900 + Math.random() * 500) * dpr;
      }
      const v = d[o + 3] * dt;
      d[o] += wind * v - dx;
      d[o + 1] += v - dy;
      if (d[o + 1] > H) {
        // tombée au sol : une éclaboussure de temps en temps, et elle repart d'en haut
        if (this.splashes.length < MAX_SPLASH * sky.rain && Math.random() < 0.5) this.splashes.push({ x: d[o], y: Math.random() * H, age: 0 });
        d[o + 1] -= H + d[o + 2];
        d[o] = Math.random() * W;
      } else if (d[o + 1] < -d[o + 2]) d[o + 1] += H + d[o + 2];
      if (d[o] < 0) d[o] += W;
      else if (d[o] > W) d[o] -= W;
      const len = d[o + 2];
      ctx.moveTo(d[o], d[o + 1]);
      ctx.lineTo(d[o] - wind * len, d[o + 1] - len);
    }
    ctx.stroke();
    // éclaboussures : petits anneaux qui s'élargissent et s'effacent
    ctx.lineWidth = 1 * dpr;
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.age += dt;
      s.x -= dx;
      s.y -= dy;
      if (s.age > 0.35) {
        this.splashes.splice(i, 1);
        continue;
      }
      const u = s.age / 0.35;
      ctx.strokeStyle = `rgba(210,222,240,${0.4 * (1 - u)})`;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, (2 + u * 7) * dpr, (1 + u * 2.5) * dpr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
