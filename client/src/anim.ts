// Animations de combat : pose des géants pendant leurs attaques spéciales (bond, onde de choc, clignement, charge),
// objets lancés (rochers, boules de toile) et coups au corps à corps des monstres.

import type { HazardStyle } from '../../shared/protocol.ts';
import type { ImpactKind } from './fx.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Déformation d'un monstre à l'écran : décalage, écrasement (depuis ses pieds), transparence, hauteur. */
export interface Pose {
  dx: number;
  dy: number;
  squash: number; // > 1 : étiré vers le haut, < 1 : aplati
  alpha: number;
  air: number; // hauteur au-dessus du sol (bond)
}
export const REST: Pose = { dx: 0, dy: 0, squash: 1, alpha: 1, air: 0 };

/** Attaque spéciale en cours d'un géant, d'après sa zone annoncée au sol. */
export interface Cast {
  style: HazardStyle;
  k: number; // avancement de l'annonce (0 → 1 à l'impact)
  since: number; // secondes depuis l'impact (0 avant)
  x: number; // zone visée (bond, clignement : point d'arrivée)
  y: number;
  x2: number; // charge : bout du couloir
  y2: number;
}

const ease = (k: number) => k * k * (3 - 2 * k);

/**
 * Pose d'un géant qui lance une attaque. ox, oy : sa position actuelle (le serveur ne le déplace qu'à l'impact).
 * - bond : il s'accroupit, décolle et vole en arc jusqu'à la zone, s'écrase à l'arrivée ;
 * - onde de choc : il se dresse, puis retombe de tout son poids ;
 * - clignement : il s'efface (il réapparaît en fondu au point d'arrivée, voir ghostOf) ;
 * - charge : il gratte le sol en tremblant, recule pour prendre son élan ;
 * - rochers, toile, spores : un sursaut au lancer.
 */
export function castPose(c: Cast, r: number, ox: number, oy: number, t: number): Pose {
  const p = { ...REST };
  const land = c.since > 0 ? Math.max(0, 1 - c.since / 0.3) : 0; // écrasement juste après l'impact
  switch (c.style) {
    case 'leap': {
      if (c.since > 0) return { ...p, squash: 1 - 0.3 * land };
      if (c.k < 0.2) return { ...p, squash: 1 - 0.3 * Math.sin((c.k / 0.2) * Math.PI * 0.5) }; // accroupi : il prend son élan
      const f = (c.k - 0.2) / 0.8, e = ease(f), h = Math.max(160, r * 3); // haut, mais pas hors de l'écran
      return {
        ...p, dx: (c.x - ox) * e, dy: (c.y - oy) * e, air: 4 * f * (1 - f) * h,
        squash: f < 0.5 ? 1.18 - f * 0.3 : 0.88 + (1 - f) * 0.3, // étiré au décollage, ramassé en retombant
      };
    }
    case 'slam': {
      if (c.since > 0) return { ...p, squash: 1 - 0.25 * land };
      if (c.k < 0.78) {
        const f = ease(c.k / 0.78);
        return { ...p, air: r * 0.45 * f, squash: 1 + 0.16 * f }; // il se dresse, de plus en plus haut
      }
      const f = (c.k - 0.78) / 0.22;
      return { ...p, air: r * 0.45 * (1 - f * f), squash: 1.16 - 0.36 * f }; // et retombe de tout son poids
    }
    case 'blink':
      return c.since > 0 ? { ...p, alpha: Math.min(1, c.since / 0.25) } : { ...p, alpha: Math.max(0, 1 - c.k * 1.15), squash: 1 + c.k * 0.25 };
    case 'charge': {
      if (c.since > 0) return p;
      const d = Math.hypot(c.x2 - ox, c.y2 - oy) || 1, ux = (c.x2 - ox) / d, uy = (c.y2 - oy) / d;
      const back = r * 0.28 * ease(Math.min(1, c.k * 1.4)), shiver = Math.sin(t * 55) * r * 0.05 * c.k;
      return { ...p, dx: -ux * back + shiver, dy: -uy * back * 0.7, squash: 1 - 0.1 * c.k };
    }
    default: {
      const f = c.k < 0.25 ? Math.sin((c.k / 0.25) * Math.PI) : 0; // sursaut au lancer
      return { ...p, air: r * 0.15 * f, squash: 1 + 0.08 * f };
    }
  }
}

/** Clignement : silhouette du géant qui se forme au point d'arrivée (transparence), ou 0. */
export const ghostOf = (c: Cast) => (c.style === 'blink' && c.since === 0 ? Math.min(0.75, c.k * 0.85) : 0);

/** Arc d'un objet lancé du géant vers la zone : position au sol et hauteur. */
export function lobbed(x0: number, y0: number, x1: number, y1: number, k: number, peak: number) {
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, z: 4 * k * (1 - k) * peak };
}

/** Rocher irrégulier qui tourne sur lui-même (moussu pour Cœur-de-Mousse). */
export function drawRock(ctx: Ctx, x: number, y: number, z: number, size: number, rot: number, seed: number, mossy: boolean) {
  // ombre au sol : plus grande et plus nette à mesure qu'il approche
  const near = Math.max(0.25, 1 - z / 500);
  ctx.fillStyle = `rgba(8,14,12,${0.2 + 0.35 * near})`;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, size * 1.2 * near, size * 0.5 * near, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - z - size * 0.4);
  ctx.rotate(rot);
  const pts = 9;
  const at = (i: number) => size * (0.82 + 0.22 * Math.sin(seed * 3.7 + i * 2.3));
  ctx.fillStyle = mossy ? '#6A7262' : '#8A8F8A';
  ctx.beginPath();
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * TAU, d = at(i);
    if (i) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,18,16,0.75)';
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.stroke();
  // face éclairée, fissure, mousse
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.25, -size * 0.3, size * 0.4, size * 0.22, -0.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,34,32,0.6)';
  ctx.lineWidth = Math.max(1, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(size * 0.1, -size * 0.5);
  ctx.lineTo(size * 0.2, -size * 0.05);
  ctx.lineTo(-size * 0.05, size * 0.35);
  ctx.stroke();
  if (mossy) {
    ctx.fillStyle = '#5E8A4A';
    ctx.beginPath();
    ctx.ellipse(size * 0.15, -size * 0.55, size * 0.45, size * 0.2, 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Boule de toile lancée par la Mère Tisseuse : pelote blanche et fils qui traînent. */
export function drawWebGlob(ctx: Ctx, x: number, y: number, z: number, size: number, t: number) {
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3, size, size * 0.4, 0, 0, TAU);
  ctx.fill();
  const cy = y - z - size * 0.4;
  ctx.strokeStyle = 'rgba(238,231,215,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 3;
    ctx.moveTo(x, cy);
    ctx.quadraticCurveTo(x + Math.cos(a) * size * 1.4, cy + Math.sin(a) * size * 1.4, x + Math.cos(a + 0.6) * size * 2, cy + Math.sin(a + 0.6) * size * 2);
  }
  ctx.stroke();
  ctx.fillStyle = '#EEE7D7';
  ctx.beginPath();
  ctx.arc(x, cy, size * 0.8, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,140,120,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, cy, size * 0.5, t * 4, t * 4 + 4);
  ctx.stroke();
}

/** Arme de chaque monstre au corps à corps (selon son apparence), pour l'effet à l'impact. */
const IMPACT: Record<string, ImpactKind> = {
  wolf: 'bite', spider: 'bite', serpent: 'bite', bear: 'claw', boar: 'tusk', golem: 'smash', watcher: 'smash',
  slime: 'splat', sporelin: 'splat', toad: 'splat', wisp: 'burn', crab: 'pinch', hare: 'bump', snail: 'bump', firefly: 'bump', meerkat: 'bump', sandworm: 'bite', vulture: 'bite', jackal: 'bite',
  salamander: 'burn', ash_bat: 'bite', lava_tortoise: 'smash',
};
export const impactOf = (spriteKey: string): ImpactKind => IMPACT[spriteKey] ?? 'bump';

/**
 * Coup au corps à corps : le monstre se fend vers sa cible (élan rapide, retour plus lent), un peu étiré.
 * dt : secondes depuis le coup ; ang : direction de la cible.
 */
export function lungePose(dt: number, r: number, ang: number): Pose | null {
  if (dt < 0 || dt > 0.32) return null;
  const f = dt < 0.08 ? ease(dt / 0.08) : 1 - ease((dt - 0.08) / 0.24);
  const d = Math.min(r * 0.6, 8 + r * 0.4) * f;
  return { dx: Math.cos(ang) * d, dy: Math.sin(ang) * d * 0.7, squash: 1 - 0.1 * f, alpha: 1, air: 0 };
}
