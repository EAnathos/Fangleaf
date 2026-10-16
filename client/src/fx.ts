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
/** Éclat de roche : tombe, rebondit au sol (z : hauteur), tourne sur lui-même. */
interface Chunk { x: number; y: number; z: number; vx: number; vy: number; vz: number; rot: number; spin: number; size: number; color: string; life: number; max: number; pts: number[] }
/** Bouffée de poussière qui gonfle et s'efface. */
interface Puff { x: number; y: number; vx: number; vy: number; r0: number; r1: number; life: number; max: number; color: string }
/** Fissures au sol, en étoile depuis l'impact : elles se dessinent vite puis s'estompent. */
interface Crack { x: number; y: number; r: number; life: number; max: number; lines: number[][] }
/** Traînée au sol (charge) : un sillon qui s'efface. */
interface Streak { x: number; y: number; x2: number; y2: number; w: number; life: number; max: number; color: string }
/** Impact d'un coup au corps à corps, selon l'arme du monstre (crocs, griffes, défenses…). */
export type ImpactKind = 'bite' | 'claw' | 'tusk' | 'smash' | 'splat' | 'burn' | 'pinch' | 'bump';
interface Impact { kind: ImpactKind; x: number; y: number; ang: number; size: number; color: string; life: number; max: number }

export class Fx {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private slashes: Slash[] = [];
  private rings: Ring[] = [];
  private essences: Essence[] = [];
  private shots: Shot[] = [];
  private chunks: Chunk[] = [];
  private puffs: Puff[] = [];
  private cracks: Crack[] = [];
  private streaks: Streak[] = [];
  private impacts: Impact[] = [];

  /** Éclats de roche (ou de terre) projetés : ils retombent, rebondissent et roulent un peu. */
  debris(x: number, y: number, colors: string[], n = 12, speed = 160, size = 6) {
    n = Math.max(3, Math.round(n * particleRate()));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = speed * (0.35 + Math.random() * 0.75), max = 0.9 + Math.random() * 0.6;
      const pts = Array.from({ length: 6 }, (_, k) => 0.65 + Math.random() * 0.5 + (k % 2 ? 0 : 0.1));
      this.chunks.push({
        x, y, z: 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6, vz: 140 + Math.random() * 220, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 14,
        size: size * (0.5 + Math.random() * 0.9), color: colors[i % colors.length], life: max, max, pts,
      });
    }
  }

  /** Nuage de poussière : n bouffées qui partent de (x, y) jusqu'au rayon r. */
  dust(x: number, y: number, r: number, n = 8, color = 'rgba(196,182,150,0.55)') {
    n = Math.max(3, Math.round(n * particleRate()));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + Math.random() * 0.5, sp = r * (0.8 + Math.random() * 0.6), max = 0.55 + Math.random() * 0.45;
      this.puffs.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, r0: r * 0.12, r1: r * (0.3 + Math.random() * 0.2), life: max, max, color });
    }
  }

  /** Fissures en étoile autour d'un impact (dessinées au sol). */
  crack(x: number, y: number, r: number, life = 1.6) {
    const lines: number[][] = [];
    const n = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      let a = (i / n) * TAU + Math.random() * 0.4, px = 0, py = 0;
      const pts = [0, 0], len = r * (0.55 + Math.random() * 0.45);
      for (let k = 1; k <= 4; k++) {
        a += (Math.random() - 0.5) * 0.7;
        px += Math.cos(a) * len / 4;
        py += Math.sin(a) * len / 4 * 0.7;
        pts.push(px, py);
      }
      lines.push(pts);
    }
    this.cracks.push({ x, y, r, life, max: life, lines });
  }

  /** Sillon au sol de (x, y) à (x2, y2) (une charge vient de passer). */
  streak(x: number, y: number, x2: number, y2: number, w: number, color = 'rgba(120,96,64,0.45)', life = 1.2) {
    this.streaks.push({ x, y, x2, y2, w, life, max: life, color });
  }

  /** Coup au corps à corps qui porte : crocs qui se referment, griffures, coup de défense, écrasement… */
  impact(kind: ImpactKind, x: number, y: number, ang: number, size: number, color: string) {
    const max = kind === 'claw' ? 0.32 : kind === 'smash' ? 0.45 : 0.3;
    this.impacts.push({ kind, x, y, ang, size, color, life: max, max });
    if (kind === 'splat') this.burst(x, y, color, 8, 90 + size * 2);
    else if (kind === 'smash') {
      this.dust(x, y + size * 0.3, size * 1.4, 5);
      this.debris(x, y, ['#7A6A55', '#5E5244'], 4, 90, size * 0.25);
    } else if (kind === 'burn') this.burst(x, y, '#BFE3FF', 8, 80);
  }

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
    for (const c of this.chunks) {
      c.life -= dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.vz -= 900 * dt;
      c.rot += c.spin * dt;
      if (c.z <= 0) { // rebond, de plus en plus faible, puis il roule
        c.z = 0;
        c.vz = Math.abs(c.vz) * 0.35 < 40 ? 0 : Math.abs(c.vz) * 0.35;
        c.vx *= 0.6;
        c.vy *= 0.6;
        c.spin *= 0.6;
      }
    }
    this.chunks = this.chunks.filter((c) => c.life > 0);
    for (const p of this.puffs) {
      p.life -= dt;
      const k = 1 - p.life / p.max, slow = 1 - k * 0.9;
      p.x += p.vx * dt * slow;
      p.y += p.vy * dt * slow - 8 * dt;
    }
    this.puffs = this.puffs.filter((p) => p.life > 0);
    for (const c of this.cracks) c.life -= dt;
    this.cracks = this.cracks.filter((c) => c.life > 0);
    for (const s of this.streaks) s.life -= dt;
    this.streaks = this.streaks.filter((s) => s.life > 0);
    for (const i of this.impacts) i.life -= dt;
    this.impacts = this.impacts.filter((i) => i.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.particles = this.particles.filter((p) => p.life > 0);
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  /** Effets posés au sol (fissures, sillons) : dessinés sous les créatures. */
  drawGround(ctx: CanvasRenderingContext2D) {
    ctx.lineCap = 'round';
    for (const s of this.streaks) {
      const k = s.life / s.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.lineJoin = 'round';
    for (const c of this.cracks) {
      const k = 1 - c.life / c.max, grow = Math.min(1, k * 8); // se dessinent en un éclair, puis s'effacent
      ctx.globalAlpha = Math.min(1, (c.life / c.max) * 1.6);
      for (const [w, col] of [[4, 'rgba(20,14,10,0.55)'], [1.5, 'rgba(255,190,120,0.35)']] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (const l of c.lines) {
          const n = Math.max(2, Math.round((l.length / 2) * grow));
          ctx.moveTo(c.x + l[0], c.y + l[1]);
          for (let i = 1; i < n; i++) ctx.lineTo(c.x + l[i * 2], c.y + l[i * 2 + 1]);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.puffs) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * Math.sqrt(k), 0, TAU);
      ctx.fill();
    }
    for (const c of this.chunks) {
      // ombre au sol, puis l'éclat en l'air
      ctx.globalAlpha = Math.min(1, (c.life / c.max) * 2) * 0.35;
      ctx.fillStyle = '#0A0F0D';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 2, c.size * 0.8, c.size * 0.35, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = Math.min(1, (c.life / c.max) * 2);
      ctx.save();
      ctx.translate(c.x, c.y - c.z);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.beginPath();
      c.pts.forEach((d, i) => {
        const a = (i / c.pts.length) * TAU;
        if (i) ctx.lineTo(Math.cos(a) * c.size * d, Math.sin(a) * c.size * d);
        else ctx.moveTo(Math.cos(a) * c.size * d, Math.sin(a) * c.size * d);
      });
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(12,18,16,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    }
    for (const i of this.impacts) this.drawImpact(ctx, i);
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

  private drawImpact(ctx: CanvasRenderingContext2D, i: Impact) {
    const k = 1 - i.life / i.max, s = i.size;
    ctx.save();
    ctx.translate(i.x, i.y);
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(1, (i.life / i.max) * 2.2);
    if (i.kind === 'bite' || i.kind === 'pinch') {
      // deux mâchoires (ou deux pinces) qui se referment sur la cible
      ctx.rotate(i.ang);
      const close = Math.min(1, k * 3.5), open = (1 - close) * 0.9 + 0.12;
      ctx.strokeStyle = '#F4EEDC';
      ctx.lineWidth = Math.max(2, s * 0.12);
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(-s * 0.3, 0, s * 0.75, sgn * open, sgn * (open + 0.9), sgn < 0);
        ctx.stroke();
        if (i.kind === 'bite') {
          // crocs
          ctx.fillStyle = '#F4EEDC';
          for (const f of [0.35, 0.65]) {
            const a = sgn * (open + 0.9 * f), px = -s * 0.3 + Math.cos(a) * s * 0.75, py = Math.sin(a) * s * 0.75;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - Math.cos(a) * s * 0.22, py - Math.sin(a) * s * 0.22);
            ctx.lineTo(px + Math.sin(a) * s * 0.08, py - Math.cos(a) * s * 0.08);
            ctx.fill();
          }
        }
      }
    } else if (i.kind === 'claw') {
      // trois griffures en diagonale, qui se tracent puis s'estompent
      ctx.rotate(i.ang + 0.9);
      const grow = Math.min(1, k * 4);
      for (const [w, col] of [[Math.max(3, s * 0.16), 'rgba(16,24,26,0.6)'], [Math.max(1.5, s * 0.08), '#FFF6E6']] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (const off of [-0.32, 0, 0.32]) {
          ctx.moveTo(-s * 0.7, off * s);
          ctx.quadraticCurveTo(0, off * s - s * 0.15, (-0.7 + 1.4 * grow) * s, off * s + s * 0.05);
        }
        ctx.stroke();
      }
    } else if (i.kind === 'tusk') {
      // coup de défense : un croc qui remonte en arc, et une étoile de choc
      ctx.rotate(i.ang);
      ctx.strokeStyle = '#F4EEDC';
      ctx.lineWidth = Math.max(2, s * 0.14);
      ctx.beginPath();
      ctx.arc(-s * 0.2, s * 0.25, s * 0.8, 0.9 - Math.min(1, k * 4) * 1.6, 0.9);
      ctx.stroke();
      star(ctx, s * 0.25, -s * 0.15, s * 0.45 * (0.6 + k), '#FFD27A');
    } else if (i.kind === 'smash') {
      // écrasement : anneau de choc aplati au sol
      ctx.strokeStyle = '#E8DCC4';
      ctx.lineWidth = Math.max(2, s * 0.14) * (1 - k);
      ctx.beginPath();
      ctx.ellipse(0, s * 0.3, s * (0.4 + k * 1.1), s * (0.2 + k * 0.5), 0, 0, TAU);
      ctx.stroke();
      star(ctx, 0, 0, s * 0.5 * (1 - k * 0.5), '#FFF0C8');
    } else if (i.kind === 'splat') {
      // éclaboussure de la couleur du monstre
      ctx.fillStyle = i.color;
      ctx.globalAlpha *= 0.8;
      for (let n = 0; n < 7; n++) {
        const a = (n / 7) * TAU + i.ang, d = s * (0.3 + k * 0.7);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.7, s * 0.14 * (1 - k * 0.6), 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.35 * (1 - k * 0.3), s * 0.25, 0, 0, TAU);
      ctx.fill();
    } else if (i.kind === 'burn') {
      // flamme froide qui lèche la cible
      for (let n = 0; n < 5; n++) {
        const a = -Math.PI / 2 + (n - 2) * 0.45, d = s * (0.2 + k * 0.6);
        ctx.fillStyle = n % 2 ? '#BFE3FF' : '#6FB7FF';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, s * 0.12, s * 0.28 * (1 - k * 0.5), a + Math.PI / 2, 0, TAU);
        ctx.fill();
      }
    } else star(ctx, 0, 0, s * 0.35 * (0.7 + k * 0.6), '#FFF0C8');
    ctx.restore();
  }
}

/** Petite étoile de choc à 4 branches. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2, d = i % 2 ? r * 0.3 : r;
    if (i) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}
