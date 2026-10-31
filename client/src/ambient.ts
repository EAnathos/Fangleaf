// Faune d'ambiance, pour un monde plus vivant (rien à combattre, rien sur le réseau : chacun voit la sienne) :
// des oiseaux qui picorent et s'envolent quand on approche, des poissons qui tournent dans les lacs et sautent,
// des papillons le jour à la belle saison, des mouettes qui planent au-dessus de la mer près des côtes.
// Tout est tiré de la graine du village, par cases de la carte : on retrouve les mêmes au même endroit.

import { hash2 } from '../../shared/math.ts';
import { DESERT_ZONE, JUNGLE_ZONE } from '../../shared/config.ts';
import type { WorldMap } from '../../shared/worldmap.ts';
import { AUTUMN, WINTER } from '../../shared/weather.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const CELL = 380; // une case de la carte : au plus un groupe de bêtes
const SCARE_R = 170; // un dompteur à cette distance fait s'envoler les oiseaux
const BIRD_AWAY_S = 45; // envolés, ils reviennent se poser au bout de ce temps

interface Bird { x: number; y: number; ox: number; oy: number; hop: number; face: number; flying: number; vx: number; vy: number; z: number; col: string }
interface Group {
  kind: 'birds' | 'fish' | 'butterflies' | 'gulls';
  x: number;
  y: number;
  seed: number;
  birds: Bird[];
  gone: number; // envolés jusqu'à ce temps
  seen: number; // dernière fois qu'il était près de l'écran (on oublie les cases lointaines)
}

const BIRD_COLORS = ['#6B5440', '#5A5A60', '#8A6A4A', '#4A4038'];
const WING_COLORS = ['#F2C14E', '#F4F1E8', '#E8875A', '#B9A3F0', '#7FCFE0'];

export class Ambient {
  private groups = new Map<string, Group>();
  private time = 0;

  constructor(private map: WorldMap, private seed: number) {}

  /** Ce qu'abrite une case : rien, des oiseaux, des poissons, des papillons ou des mouettes (selon le terrain, l'heure, la saison). */
  private groupAt(cx: number, cy: number, light: number, season: number): Group | null {
    const key = `${cx},${cy}`;
    let g = this.groups.get(key);
    if (g) return g;
    const h = hash2(cx, cy, this.seed + 401), x = (cx + 0.2 + hash2(cy, cx, this.seed + 402) * 0.6) * CELL, y = (cy + 0.2 + hash2(cx + 7, cy, this.seed + 403) * 0.6) * CELL;
    const m = this.map;
    let kind: Group['kind'] | null = null;
    if (m.caveAt(x, y) || m.inVillage(x, y, 40)) kind = null;
    else if (m.isSea(x, y)) kind = h < 0.12 && m.shoreAt(x, y) < 500 ? 'gulls' : null;
    else if (m.isWater(x, y)) kind = h < 0.55 && !m.isIce(x, y) ? 'fish' : null;
    else if (!m.blocked(x, y)) {
      const zone = m.zoneAt(x, y);
      if (h < 0.22 && zone !== DESERT_ZONE) kind = 'birds';
      else if (h < 0.4 && zone !== DESERT_ZONE && season !== WINTER && season !== AUTUMN) kind = 'butterflies';
      void light;
    }
    g = { kind: kind ?? 'birds', x, y, seed: h * 1000, birds: [], gone: kind ? 0 : Infinity, seen: this.time };
    if (kind) {
      const n = kind === 'birds' ? 3 + Math.floor(h * 13) % 3 : kind === 'fish' ? 2 + Math.floor(h * 17) % 2 : 2;
      const jungle = m.zoneAt(x, y) === JUNGLE_ZONE;
      for (let i = 0; i < n; i++) {
        const a = hash2(i, cx * 31 + cy, this.seed + 404) * TAU, d = 12 + hash2(cy, i, this.seed + 405) * 34;
        const col = kind === 'butterflies' ? (jungle ? '#3A8FE0' : WING_COLORS[Math.floor(hash2(i, cy, this.seed + 406) * WING_COLORS.length)]) : BIRD_COLORS[Math.floor(hash2(i, cx, this.seed + 407) * BIRD_COLORS.length)];
        g.birds.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, ox: Math.cos(a) * d, oy: Math.sin(a) * d * 0.7, hop: hash2(i, i, this.seed + 408) * 10, face: Math.cos(a) > 0 ? 1 : -1, flying: 0, vx: 0, vy: 0, z: 0, col });
      }
    }
    this.groups.set(key, g);
    return g;
  }

  /**
   * Avance d'un pas : les groupes autour de l'écran, les oiseaux qui s'envolent devant les dompteurs (scarers), et les
   * cases lointaines oubliées.
   */
  update(dt: number, camX: number, camY: number, hw: number, hh: number, scarers: { x: number; y: number }[], light: number, season: number) {
    this.time += dt;
    const x0 = Math.floor((camX - hw - CELL) / CELL), x1 = Math.floor((camX + hw + CELL) / CELL);
    const y0 = Math.floor((camY - hh - CELL) / CELL), y1 = Math.floor((camY + hh + CELL) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const g = this.groupAt(cx, cy, light, season);
        if (!g || g.gone === Infinity) continue;
        g.seen = this.time;
        if (g.kind === 'birds') this.updateBirds(g, dt, scarers);
      }
    }
    if (this.groups.size > 400) for (const [k, g] of this.groups) if (this.time - g.seen > 30) this.groups.delete(k);
  }

  private updateBirds(g: Group, dt: number, scarers: { x: number; y: number }[]) {
    if (g.gone > this.time) {
      // en vol : ils s'éloignent en montant, puis disparaissent
      for (const b of g.birds) {
        b.flying += dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += (60 + b.flying * 40) * dt;
      }
      return;
    }
    if (g.birds.some((b) => b.flying)) {
      // revenus se poser
      for (const b of g.birds) Object.assign(b, { x: g.x + b.ox, y: g.y + b.oy, flying: 0, z: 0 });
    }
    const scare = scarers.find((p) => Math.hypot(p.x - g.x, p.y - g.y) < SCARE_R);
    if (!scare) return;
    g.gone = this.time + BIRD_AWAY_S;
    for (const b of g.birds) {
      const a = Math.atan2(b.y - scare.y, b.x - scare.x) + (hash2(b.hop, g.seed, 9) - 0.5) * 0.9, v = 160 + hash2(g.seed, b.hop, 10) * 80;
      [b.vx, b.vy, b.face] = [Math.cos(a) * v, Math.sin(a) * v * 0.7, Math.cos(a) > 0 ? 1 : -1];
    }
  }

  /** Au ras de l'eau, sous les créatures : les poissons. */
  drawGround(ctx: Ctx, inView: (x: number, y: number, m: number) => boolean) {
    for (const g of this.groups.values()) {
      if (g.kind !== 'fish' || g.gone === Infinity || !inView(g.x, g.y, 120) || this.map.isIce(g.x, g.y)) continue;
      g.birds.forEach((f, i) => {
        const sp = 0.5 + (i % 3) * 0.15, a = this.time * sp + i * 2.1 + g.seed, r = 22 + i * 9;
        const x = g.x + Math.cos(a) * r, y = g.y + Math.sin(a) * r * 0.6, ang = a + Math.PI / 2;
        // de temps en temps, l'un saute hors de l'eau
        const cyc = (this.time * 0.18 + i * 0.37 + g.seed * 0.01) % 1, jump = cyc > 0.94 ? (cyc - 0.94) / 0.06 : 0;
        if (jump) {
          const z = Math.sin(jump * Math.PI) * 26;
          ctx.strokeStyle = `rgba(230,245,250,${0.6 * (1 - jump)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(x, y, 6 + jump * 14, 3 + jump * 6, 0, 0, TAU);
          ctx.stroke();
          ctx.save();
          ctx.translate(x + Math.cos(ang) * jump * 10, y - z);
          ctx.rotate(-Math.PI / 2 + jump * Math.PI);
          ctx.fillStyle = '#9AB8C0';
          ctx.beginPath();
          ctx.ellipse(0, 0, 7, 3, 0, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-6, 0);
          ctx.lineTo(-10, -3);
          ctx.lineTo(-10, 3);
          ctx.fill();
          ctx.restore();
          return;
        }
        // sinon, son ombre qui ondule sous la surface
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(20,46,56,0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 3, 0, 0, TAU);
        ctx.fill();
        const wag = Math.sin(this.time * 9 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(-7, 0);
        ctx.lineTo(-11, -3 + wag);
        ctx.lineTo(-11, 3 + wag);
        ctx.fill();
        ctx.restore();
      });
    }
  }

  /** Au-dessus du sol : oiseaux (posés ou envolés), papillons, mouettes. */
  drawAir(ctx: Ctx, inView: (x: number, y: number, m: number) => boolean, light: number) {
    for (const g of this.groups.values()) {
      if (g.gone === Infinity || !inView(g.x, g.y, 300)) continue;
      if (g.kind === 'birds') this.drawBirds(ctx, g);
      else if (g.kind === 'butterflies' && light > 0.4) this.drawButterflies(ctx, g);
      else if (g.kind === 'gulls' && light > 0.3) this.drawGulls(ctx, g);
    }
  }

  private drawBirds(ctx: Ctx, g: Group) {
    const flying = g.gone > this.time;
    for (const b of g.birds) {
      if (flying) {
        if (b.flying > 2.5) continue;
        const fade = Math.max(0, 1 - b.flying / 2.5), flap = Math.sin(this.time * 26 + b.hop) * 5;
        ctx.globalAlpha = fade;
        ctx.fillStyle = 'rgba(8,14,12,0.2)';
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, 4, 1.6, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = b.col;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x - 6, b.y - b.z - flap);
        ctx.quadraticCurveTo(b.x - 2, b.y - b.z - 2, b.x, b.y - b.z);
        ctx.quadraticCurveTo(b.x + 2, b.y - b.z - 2, b.x + 6, b.y - b.z - flap);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }
      // posé : il sautille, picore, se retourne
      const t = this.time + b.hop, hopK = Math.max(0, Math.sin(t * 2.3)) ** 6, peck = Math.max(0, Math.sin(t * 3.7 + 1)) ** 8;
      const face = Math.sin(t * 0.37) > 0 ? b.face : -b.face, x = b.x + Math.sin(t * 0.21) * 6, y = b.y - hopK * 4;
      ctx.fillStyle = 'rgba(8,14,12,0.2)';
      ctx.beginPath();
      ctx.ellipse(x, b.y + 2, 4.5, 1.6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.col;
      ctx.beginPath();
      ctx.ellipse(x, y - 3, 4.5, 3.2, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + face * 3.5, y - 5.5 + peck * 3, 2.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#E8B04A';
      ctx.beginPath();
      ctx.moveTo(x + face * 5.5, y - 6 + peck * 3);
      ctx.lineTo(x + face * 7.5, y - 5.3 + peck * 3.5);
      ctx.lineTo(x + face * 5.5, y - 4.8 + peck * 3);
      ctx.fill();
      ctx.fillStyle = '#10181A';
      ctx.fillRect(x + face * 4 - 0.6, y - 6.4 + peck * 3, 1.2, 1.2);
    }
  }

  private drawButterflies(ctx: Ctx, g: Group) {
    g.birds.forEach((b, i) => {
      const t = this.time + b.hop, x = g.x + Math.sin(t * 0.7 + i) * 40 + Math.sin(t * 1.9) * 8, y = g.y + Math.cos(t * 0.5 + i * 2) * 26, z = 18 + Math.sin(t * 2.1) * 6;
      const open = Math.abs(Math.sin(t * 14)), w = 5 * (0.25 + 0.75 * open);
      ctx.fillStyle = 'rgba(8,14,12,0.12)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3, 1.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = b.col;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(x + sd * w * 0.6, y - z - 1, w, 4, sd * 0.4, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + sd * w * 0.5, y - z + 3, w * 0.7, 2.6, -sd * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#2A2018';
      ctx.fillRect(x - 0.7, y - z - 4, 1.4, 8);
    });
  }

  private drawGulls(ctx: Ctx, g: Group) {
    g.birds.forEach((b, i) => {
      const a = this.time * (0.35 + i * 0.08) + i * 3 + g.seed, x = g.x + Math.cos(a) * (90 + i * 30), y = g.y + Math.sin(a) * (50 + i * 16), z = 70 + i * 14;
      const flap = Math.sin(this.time * 3 + i) > 0.6 ? Math.sin(this.time * 18) * 3 : 1;
      ctx.fillStyle = 'rgba(8,24,30,0.15)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#F4F1E8';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 11, y - z - flap - 2);
      ctx.quadraticCurveTo(x - 4, y - z - 5, x, y - z);
      ctx.quadraticCurveTo(x + 4, y - z - 5, x + 11, y - z - flap - 2);
      ctx.stroke();
    });
  }
}
