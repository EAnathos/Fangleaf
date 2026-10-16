// Effets visuels éphémères : particules, textes flottants, coups, anneaux.

import { particleRate } from './settings.ts';

const TAU = Math.PI * 2;
const MAX_FLOATERS = 140; // grosse mêlée : les plus anciens chiffres s'effacent

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
interface Slash { x: number; y: number; ang: number; life: number }
interface Essence { x: number; y: number; color: string; life: number; max: number; label: string }
interface Shot { x: number; y: number; tx: number; ty: number; life: number; max: number; kind: string }
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string }

export class Fx {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private slashes: Slash[] = [];
  private rings: Ring[] = [];
  private essences: Essence[] = [];
  private shots: Shot[] = [];

  burst(x: number, y: number, color: string, n = 12, speed = 120) {
    n = Math.round(n * particleRate()); // qualité réglée dans les paramètres
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
      const max = 0.4 + Math.random() * 0.4;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: max, max, color, size: 2 + Math.random() * 3 });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 15, life = 1.1) {
    this.floaters.push({ x: x + (Math.random() - 0.5) * 12, y, text, color, life, max: life, size });
    if (this.floaters.length > MAX_FLOATERS) this.floaters.shift();
  }

  slash(x: number, y: number, ang: number) {
    this.slashes.push({ x, y, ang, life: 0.18 });
  }

  ring(x: number, y: number, color: string, r0 = 10, r1 = 60, life = 0.6) {
    this.rings.push({ x, y, r0, r1, life, max: life, color });
  }

  /** Essence lâchée : un cristal de la couleur de l'espèce qui jaillit, tourne et s'élève avec « +1 ». */
  essence(x: number, y: number, color: string, label = '+1') {
    this.essences.push({ x, y, color, life: label === '+1' ? 1.6 : 2.2, max: label === '+1' ? 1.6 : 2.2, label });
    this.burst(x, y + 10, '#B48CFF', 8, 70);
  }

  /** Flèche (archer) ou orbe (mage) qui file vers sa cible ; l'orbe explose à l'arrivée. */
  shot(x: number, y: number, tx: number, ty: number, kind: string) {
    const max = Math.min(0.28, Math.hypot(tx - x, ty - y) / 1400 + 0.06);
    this.shots.push({ x, y, tx, ty, life: max, max, kind });
  }

  update(dt: number) {
    for (const s of this.shots) {
      s.life -= dt;
      if (s.life <= 0 && s.kind === 'mage') {
        this.ring(s.tx, s.ty, '#B48CFF', 10, 80, 0.35);
        this.burst(s.tx, s.ty, '#D9C6FF', 10, 120);
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    for (const e of this.essences) e.life -= dt;
    this.essences = this.essences.filter((e) => e.life > 0);
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      p.vx *= 0.96;
    }
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 34 * dt;
    }
    for (const s of this.slashes) s.life -= dt;
    for (const r of this.rings) r.life -= dt;
    this.particles = this.particles.filter((p) => p.life > 0);
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU);
      ctx.stroke();
    }
    for (const s of this.slashes) {
      ctx.globalAlpha = s.life / 0.18;
      ctx.strokeStyle = '#EEE7D7';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 34, s.ang - 0.9, s.ang + 0.9);
      ctx.stroke();
    }
    for (const s of this.shots) {
      const k = 1 - s.life / s.max, x = s.x + (s.tx - s.x) * k, y = s.y - 10 + (s.ty - s.y + 10) * k;
      ctx.globalAlpha = 1;
      if (s.kind === 'mage') {
        ctx.fillStyle = 'rgba(180,140,255,0.4)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#E8DCFF';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, TAU);
        ctx.fill();
      } else {
        const a = Math.atan2(s.ty - s.y, s.tx - s.x);
        ctx.strokeStyle = '#EEE7D7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 16, y - Math.sin(a) * 16);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = '#C9CFC2';
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
        ctx.lineTo(x + Math.cos(a + 2.5) * 5, y + Math.sin(a + 2.5) * 5);
        ctx.lineTo(x + Math.cos(a - 2.5) * 5, y + Math.sin(a - 2.5) * 5);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (const e of this.essences) {
      const k = 1 - e.life / e.max; // 0 → 1
      const pop = k < 0.15 ? k / 0.15 : 1; // apparition en « pop »
      const y = e.y - 46 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const spin = Math.cos(k * Math.PI * 4); // le cristal tourne sur lui-même
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(e.x - 10, y);
      ctx.scale(Math.max(0.2, Math.abs(spin)) * pop * 1.15, pop * 1.15);
      // lueur : un losange plus grand et translucide (pas de shadowBlur, très lent sous Firefox)
      ctx.fillStyle = 'rgba(180,140,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, -17);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 17);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = e.color;
      ctx.strokeStyle = '#EEE7D7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.font = `700 ${Math.round(17 * pop)}px "Pixelify Sans", sans-serif`;
      ctx.textAlign = 'left';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(16,24,26,0.85)';
      ctx.strokeText(e.label, e.x + 2, y + 6);
      ctx.fillStyle = '#B48CFF';
      ctx.fillText(e.label, e.x + 2, y + 6);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    let size = 0;
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
      if (f.size !== size) ctx.font = `700 ${(size = f.size)}px "Pixelify Sans", sans-serif`; // changer de police coûte cher
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}
