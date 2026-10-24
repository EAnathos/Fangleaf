// Sprites procéduraux (Canvas 2D) : aucune image à charger.

import { SPECIES, type Resource } from '../../shared/config.ts';
import { HAZARD_STYLES } from '../../shared/protocol.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export function shadow(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(8, 14, 12, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.75, r * 1.05, r * 0.42, 0, 0, TAU);
  ctx.fill();
}

function eyes(ctx: Ctx, x: number, y: number, gap: number, size: number, color: string, angry: boolean) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - gap, y, size, 0, TAU);
  ctx.arc(x + gap, y, size, 0, TAU);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, size * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - gap - size * 1.4, y - size * 2.1);
    ctx.lineTo(x - gap + size * 0.9, y - size * 1.1);
    ctx.moveTo(x + gap + size * 1.4, y - size * 2.1);
    ctx.lineTo(x + gap - size * 0.9, y - size * 1.1);
    ctx.stroke();
  }
}

export interface UnitLook {
  x: number;
  y: number;
  r: number;
  species: number;
  alpha: boolean;
  wild: boolean;
  ownerColor?: string;
  face: number; // -1 gauche, 1 droite
  t: number; // secondes, pour l'animation
  seed: number;
  flash: boolean;
  key?: string; // apparence à utiliser (par défaut celle de l'espèce)
  legend?: boolean; // Alpha légendaire : aura et couronne dorées
  color?: string;
  charge?: number; // tireur : avancement de la charge du tir (0 à 1)
  inWater?: boolean; // serpent : nage (seuls la tête et les anneaux dépassent)
  moving?: boolean; // il se déplace (les gluants avancent par bonds)
  air?: number; // hauteur au-dessus du sol (bond d'un géant) : le corps monte, l'ombre reste au sol et rétrécit
  squash?: number; // écrasement vertical (> 1 : étiré, < 1 : aplati), pour l'élan et l'atterrissage
  shell?: boolean; // escargot rentré dans sa coquille : seule la coquille, posée au sol
}

/** Décalage de la couronne (Alpha, géant) vers la tête, en rayons, pour les espèces dont la tête est loin devant. */
const CROWN_X: Record<string, number> = { bear: 0.8, boar: 0.9, firefly: 0.5, sandworm: 0.5, vulture: 0.55, jackal: 0.85, meerkat: 0.08, salamander: 0.95, lava_tortoise: 1.05 };
/** … et vers le bas, en rayons, pour celles dont la tête est plus basse que le haut du corps. */
const CROWN_Y: Record<string, number> = { kraken: -0.6, crab: -0.05, boar: 0.45, firefly: 0.1, sandworm: -0.45, vulture: 0.0, jackal: 0.0, meerkat: -0.45, salamander: 0.55, lava_tortoise: 0.55, ash_bat: 0.15 };

export function drawUnit(ctx: Ctx, u: UnitLook) {
  const { x, r } = u;
  const key = u.key ?? SPECIES[u.species].sprite ?? SPECIES[u.species].key;
  const floating = key === 'wisp' || key === 'firefly' || key === 'ash_bat';
  // Gluant en marche : il avance par bonds (élan aplati, saut étiré, atterrissage écrasé).
  const hop = key === 'slime' && u.moving ? slimeHop(u) : null;
  const air = (u.air ?? 0) + (hop?.lift ?? 0);
  const bob = floating ? Math.sin(u.t * 2.5 + u.seed) * r * 0.18 - r * 0.55 : hop ? 0 : Math.sin(u.t * 6 + u.seed) * r * 0.06;
  const y = u.y + bob - air;
  const squash = (u.squash ?? 1) * (hop?.squash ?? 1);

  const lifted = Math.max(0.35, 1 - air / (r * 6)); // l'ombre rétrécit quand il monte
  if (floating) shadow(ctx, x, u.y, r * (0.75 - Math.sin(u.t * 2.5 + u.seed) * 0.08));
  else if (!u.inWater) shadow(ctx, x, u.y, r * lifted);

  if (u.legend) {
    // Halo doré qui pulse sous l'Alpha légendaire.
    const pulse = 0.75 + Math.sin(u.t * 3 + u.seed) * 0.25;
    const g = ctx.createRadialGradient(x, u.y, r * 0.3, x, u.y, r * 2.1);
    g.addColorStop(0, `rgba(240,182,74,${0.35 * pulse})`);
    g.addColorStop(1, 'rgba(240,182,74,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, u.y, r * 2.1, 0, TAU);
    ctx.fill();
  }
  if (u.wild) {
    // Ennemi : anneau braise au sol, reconnaissable même au milieu de la mêlée (gibier passif : anneau paille).
    ctx.strokeStyle = SPECIES[u.species]?.passive ? 'rgba(232,220,170,0.7)' : 'rgba(232,105,63,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, u.y + r * 0.72, r * 0.95, r * 0.36, 0, 0, TAU);
    ctx.stroke();
  }
  if (u.ownerColor) {
    ctx.strokeStyle = u.ownerColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, u.y + r * 0.72, r * 0.95, r * 0.36, 0, 0, TAU);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(x, y + r * 0.75); // écrasement depuis les pieds : il reste posé au sol
  ctx.scale(u.face / Math.sqrt(squash), squash);
  ctx.translate(0, -r * 0.75);
  const base = u.color ?? SPECIES[u.species].color;
  const fill = u.flash ? '#FFFFFF' : base;
  (DRAWERS[key] ?? golem)(ctx, r, fill, u);
  if (SPECIES[u.species]?.boss && !u.key) {
    // Mini-boss : grande couronne dorée.
    ctx.fillStyle = '#F0B64A';
    ctx.strokeStyle = 'rgba(12,18,16,0.8)';
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    const bx = (CROWN_X[key] ?? 0) * r;
    ctx.beginPath();
    ctx.moveTo(bx - r * 0.42, -r * 0.8);
    ctx.lineTo(bx - r * 0.46, -r * 1.3);
    ctx.lineTo(bx - r * 0.2, -r * 1.05);
    ctx.lineTo(bx, -r * 1.42);
    ctx.lineTo(bx + r * 0.2, -r * 1.05);
    ctx.lineTo(bx + r * 0.46, -r * 1.3);
    ctx.lineTo(bx + r * 0.42, -r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (u.alpha) {
    const cx = (CROWN_X[key] ?? 0) * r; // posée sur la tête quand elle est loin devant (ours, sanglier)
    ctx.translate(0, (CROWN_Y[key] ?? 0) * r);
    ctx.fillStyle = u.legend ? '#F0B64A' : '#B48CFF';
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.35, -r * 0.82);
    ctx.lineTo(cx - r * 0.22, -r * 1.35);
    ctx.lineTo(cx, -r * 1.0);
    ctx.lineTo(cx + r * 0.22, -r * 1.35);
    ctx.lineTo(cx + r * 0.35, -r * 0.82);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Bond d'un gluant qui avance : environ deux sauts par seconde. Il s'aplatit pour prendre son élan, s'étire en l'air,
 * puis s'écrase en retombant.
 */
function slimeHop(u: UnitLook) {
  const ph = (u.t * 2.1 + u.seed * 0.37) % 1;
  if (ph < 0.18) return { lift: 0, squash: 1 - 0.28 * Math.sin((ph / 0.18) * Math.PI) }; // élan
  if (ph > 0.86) return { lift: 0, squash: 1 - 0.32 * Math.sin(((ph - 0.86) / 0.14) * Math.PI) }; // atterrissage
  const k = (ph - 0.18) / 0.68;
  return { lift: Math.sin(k * Math.PI) * u.r * 0.85, squash: 1 + 0.18 * Math.cos(k * Math.PI) }; // étiré en montant, rond au sommet
}

/** Contour sombre du corps (chemin courant) pour détacher le sprite du sol. */
function ink(ctx: Ctx, r: number) {
  ctx.strokeStyle = 'rgba(12,18,16,0.75)';
  ctx.lineWidth = Math.max(1.5, r * 0.11);
  ctx.stroke();
}

function slime(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const w = Math.sin(u.t * 5 + u.seed) * 0.07;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 1.15 * (1 + w), r * 0.88 * (1 - w), 0, Math.PI, 0);
  ctx.ellipse(0, r * 0.1, r * 1.15 * (1 + w), r * 0.55, 0, 0, Math.PI);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, -r * 0.35, r * 0.22, r * 0.13, -0.5, 0, TAU);
  ctx.fill();
  eyes(ctx, r * 0.12, -r * 0.05, r * 0.32, r * 0.14, '#10181A', u.wild);
}

/**
 * Loup cendré : fourrure épaisse en touffes (contours dentelés), gris charbon, reflet clair le long de l'échine,
 * poitrail et museau plus clairs, regard ambre qui luit. Le géant (Grisecroc) porte la même robe, plus sombre.
 */
const WOLF_COAT = { fur: '#5C6066', shade: '#3E4247', dark: '#2C2F33', light: '#8E949C', eye: '#F0B64A' };
const SHADOW_WOLF_COAT = { fur: '#44474F', shade: '#2E3036', dark: '#1F2125', light: '#6E747E', eye: '#E8693F' };

function wolf(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const coat = SPECIES[u.species]?.boss ? SHADOW_WOLF_COAT : WOLF_COAT;
  const fur = u.flash ? '#FFFFFF' : coat.fur, shade = u.flash ? '#FFFFFF' : coat.shade, dark = u.flash ? '#FFFFFF' : coat.dark;
  const line = (rr: number) => {
    ctx.strokeStyle = 'rgba(12,18,16,0.6)';
    ctx.lineWidth = Math.max(1.5, rr * 0.1);
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  // touffes : une ellipse au contour dentelé
  const tufts = (cx: number, cy: number, rx: number, ry: number, n: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let k = 0; k <= n * 2; k++) {
      const a = (k / (n * 2)) * TAU, d = k % 2 ? 1 : 1.18;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  const leg = (x: number, y: number, w: number, h: number, sw: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x - w / 2 + sw, y, w, h, w * 0.4);
    ctx.fill();
  };
  const step = Math.sin(u.t * 9 + u.seed) * r * 0.08;
  // queue touffue qui balance
  ctx.save();
  ctx.translate(-0.85 * r, -0.05 * r);
  ctx.rotate(-0.45 + Math.sin(u.t * 6 + u.seed) * 0.15);
  tufts(-0.38 * r, 0, 0.42 * r, 0.2 * r, 7, shade);
  line(r);
  ctx.restore();
  for (const [x, sw] of [[-0.6, step], [0.42, -step]] as const) leg(x * r, 0.3 * r, 0.2 * r, 0.5 * r, sw, dark);
  // corps, ventre dans l'ombre, reflet le long de l'échine
  tufts(-0.12 * r, -0.02 * r, 0.82 * r, 0.42 * r, 11, fur);
  line(r);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(-0.12 * r, 0.24 * r, 0.6 * r, 0.13 * r, 0, 0, TAU);
  ctx.fill();
  if (!u.flash) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    tufts(-0.15 * r, -0.3 * r, 0.6 * r, 0.1 * r, 8, coat.light);
    ctx.restore();
  }
  for (const [x, sw] of [[-0.4, -step], [0.46, step]] as const) leg(x * r, 0.28 * r, 0.22 * r, 0.54 * r, sw, shade);
  // grosse fourrure du cou, poitrail clair, puis la tête
  tufts(0.55 * r, -0.08 * r, 0.36 * r, 0.38 * r, 8, fur);
  line(r);
  if (!u.flash) tufts(0.62 * r, 0.06 * r, 0.16 * r, 0.2 * r, 5, coat.light);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(0.5 * r, -0.42 * r);
  ctx.quadraticCurveTo(0.8 * r, -0.6 * r, 1.0 * r, -0.3 * r);
  ctx.lineTo(1.32 * r, -0.14 * r);
  ctx.quadraticCurveTo(1.38 * r, 0.02 * r, 1.22 * r, 0.06 * r);
  ctx.quadraticCurveTo(0.9 * r, 0.14 * r, 0.62 * r, 0.04 * r);
  ctx.closePath();
  ctx.fill();
  line(r);
  for (const ox of [0.58, 0.76]) {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(ox * r, -0.44 * r);
    ctx.lineTo((ox + 0.05) * r, -0.78 * r);
    ctx.lineTo((ox + 0.17) * r, -0.42 * r);
    ctx.closePath();
    ctx.fill();
    line(r * 0.5);
  }
  if (!u.flash) {
    ctx.fillStyle = coat.light; // museau plus clair
    ctx.beginPath();
    ctx.ellipse(1.12 * r, -0.03 * r, 0.18 * r, 0.07 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(1.33 * r, -0.12 * r, 0.07 * r, 0.055 * r, 0, 0, TAU);
  ctx.fill();
  // œil qui luit (violet pour un Alpha), sourcil froncé chez le sauvage
  const iris = u.alpha ? '#B48CFF' : coat.eye, ex = 0.92 * r, ey = -0.27 * r, es = 0.08 * r;
  ctx.save();
  ctx.shadowColor = iris;
  ctx.shadowBlur = r * 0.35;
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(ex + es * 0.2, ey, es * 0.45, es * 0.8, 0, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.7);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.6, ey - es * 1.9);
    ctx.lineTo(ex + es * 1.3, ey - es * 0.9);
    ctx.stroke();
  }
}

function golem(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4A5F47';
  ctx.beginPath();
  ctx.roundRect(-r * 1.25, -r * 0.1, r * 0.45, r * 0.75, r * 0.15);
  ctx.roundRect(r * 0.8, -r * 0.1, r * 0.45, r * 0.75, r * 0.15);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-r * 0.9, -r * 0.75, r * 1.8, r * 1.5, r * 0.4);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#7FCB5B';
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, -r * 0.72, r * 0.55, r * 0.22, 0, 0, TAU);
  ctx.ellipse(r * 0.35, -r * 0.68, r * 0.3, r * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,24,26,0.25)';
  ctx.beginPath();
  ctx.arc(-r * 0.4, r * 0.35, r * 0.14, 0, TAU);
  ctx.arc(r * 0.45, r * 0.45, r * 0.1, 0, TAU);
  ctx.fill();
  eyes(ctx, r * 0.05, -r * 0.15, r * 0.32, r * 0.13, u.alpha ? '#B48CFF' : '#5CC8B8', u.wild);
}

/**
 * Armure portée sur le corps. Tunique : lin ceinturé d'une cordelette (le mage porte une robe à capuche) ;
 * Cuir : brun, bandoulière cousue (Cuir clouté : rivets) ; au-delà, le liseré métal de armorColor.
 */
function armorLook(ctx: Ctx, x: number, cy: number, r: number, armor: number, cls: string | null) {
  const ring = (color: string, w: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.stroke();
  };
  if (armor === 0 && cls === 'mage') {
    // robe violette : pan du bas, capuche rabattue sur le haut du crâne
    ctx.fillStyle = '#4E3F7A';
    ctx.beginPath();
    ctx.arc(x, cy, r, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ring('#7D68B8', 3);
    ctx.strokeStyle = '#5E4C94';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, cy, r - 1.5, 1.12 * Math.PI, 1.88 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#F0B64A'; // fermoir
    ctx.beginPath();
    ctx.arc(x, cy + r * 0.3, 2.2, 0, TAU);
    ctx.fill();
    return;
  }
  if (armor === 0) {
    ring('#D8C7A0', 3);
    ctx.strokeStyle = '#8B6A47'; // cordelette nouée à la taille
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.92, cy + r * 0.38);
    ctx.quadraticCurveTo(x, cy + r * 0.52, x + r * 0.92, cy + r * 0.38);
    ctx.moveTo(x + r * 0.25, cy + r * 0.47);
    ctx.lineTo(x + r * 0.15, cy + r * 0.85);
    ctx.stroke();
    return;
  }
  if (armor <= 2) {
    ring('#6E4526', 4);
    // bandoulière de cuir, couture claire
    ctx.strokeStyle = '#7A4E2D';
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.68, cy - r * 0.72);
    ctx.lineTo(x + r * 0.72, cy + r * 0.68);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,210,170,0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (armor === 2) {
      ctx.fillStyle = '#C9CFC2'; // rivets
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6, 0, TAU);
        ctx.fill();
      }
    }
    return;
  }
  ring(armorColor(armor), 3 + Math.min(3, armor * 0.3));
}

export function armorColor(lvl: number) {
  if (lvl >= 9) return '#F0B64A';
  if (lvl >= 6) return '#DCE2E8';
  if (lvl >= 3) return '#A2AEB9';
  return '#8B6A47';
}

export function drawPlayer(
  ctx: Ctx, x: number, y: number, color: string, fx: number, fy: number, armor: number, name: string,
  t: number, moving: boolean, flash: boolean, isMe: boolean, riding = false, cls: string | null = null, tool: Tool | null = null, weapon = 0, armed = true,
) {
  const r = 16;
  const bob = moving ? Math.abs(Math.sin(t * (riding ? 16 : 12))) * 2 : 0;
  if (!riding) shadow(ctx, x, y, r);
  if (isMe && !riding) {
    ctx.strokeStyle = 'rgba(238,231,215,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 1.5, r * 0.6, 0, 0, TAU);
    ctx.stroke();
  }
  const cy = y - bob;
  // arme (ou outil de récolte, tourné vers le filon)
  const ang = tool ? tool.ang : Math.atan2(fy, fx);
  ctx.save();
  ctx.translate(x, cy);
  ctx.rotate(ang);
  if (tool) drawTool(ctx, r, tool);
  else if (cls === 'archer') {
    // arc tendu
    ctx.strokeStyle = '#8B6A47';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r - 2, 0, 13, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(238,231,215,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r - 2 + Math.cos(-1.2) * 13, Math.sin(-1.2) * 13);
    ctx.lineTo(r - 2 + Math.cos(1.2) * 13, Math.sin(1.2) * 13);
    ctx.stroke();
  } else if (cls === 'mage') {
    // bâton surmonté d'un orbe lumineux
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r - 4, 6);
    ctx.lineTo(r + 14, -6);
    ctx.stroke();
    const glow = 0.7 + Math.sin(t * 5) * 0.3;
    ctx.fillStyle = `rgba(180,140,255,${0.35 * glow})`;
    ctx.beginPath();
    ctx.arc(r + 16, -8, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#D9C6FF';
    ctx.beginPath();
    ctx.arc(r + 16, -8, 4, 0, TAU);
    ctx.fill();
  } else if (armed) drawSword(ctx, r, weapon); // pas encore d'arme : l'épée est plantée sur la plage
  ctx.restore();
  // corps
  ctx.fillStyle = flash ? '#FFFFFF' : color;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,24,26,0.22)';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  armorLook(ctx, x, cy, r, armor, cls);
  // yeux dans la direction du regard
  ctx.fillStyle = '#10181A';
  const ex = x + fx * 5, ey = cy + fy * 4 - 2;
  ctx.beginPath();
  ctx.arc(ex - 4.5, ey, 2.4, 0, TAU);
  ctx.arc(ex + 4.5, ey, 2.4, 0, TAU);
  ctx.fill();
  // nom
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText(name, x, cy - r - 10);
  ctx.fillStyle = '#EEE7D7';
  ctx.fillText(name, x, cy - r - 10);
}

/**
 * Le vieil homme du village : un dompteur comme les autres (une simple boule), en plus vieux. Canne à la main,
 * barbe et sourcils blancs, lunettes rondes ; il respire doucement et regarde vers (lx, ly) (direction unitaire).
 */
export function drawElder(ctx: Ctx, x: number, y: number, t: number, lx = 1, ly = 0, name = 'Vieil homme') {
  const r = 16, cy = y - Math.sin(t * 1.6) * 0.8; // la respiration
  shadow(ctx, x, y, r);
  // canne, posée à côté de lui
  ctx.strokeStyle = '#5B3F2C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 13);
  ctx.lineTo(x + 22, cy - 14);
  ctx.arc(x + 17, cy - 14, 5, 0, Math.PI, true);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // corps : une boule, comme les dompteurs
  ctx.fillStyle = '#B7A88F';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,24,26,0.22)';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  // crâne dégarni qui brille, touffes blanches sur les côtés
  ctx.fillStyle = 'rgba(255,250,235,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - 4, cy - 10, 5, 2.6, -0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#EEEAE2';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * 13.5, cy - 3, 4.2, 0, TAU);
    ctx.arc(x + s * 14.5, cy + 1.5, 3.4, 0, TAU);
    ctx.fill();
  }
  // barbe blanche, ronde, qui couvre le bas du visage
  const ex = x + lx * 4, ey = cy + ly * 3 - 3;
  ctx.fillStyle = '#F1EDE5';
  ctx.strokeStyle = 'rgba(120,110,95,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 12, cy + 1);
  ctx.quadraticCurveTo(x - 11, cy + 16, x, cy + 19);
  ctx.quadraticCurveTo(x + 11, cy + 16, x + 12, cy + 1);
  ctx.quadraticCurveTo(x, cy + 6, x - 12, cy + 1);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,140,125,0.55)';
  ctx.beginPath();
  ctx.moveTo(x - 4, cy + 8);
  ctx.quadraticCurveTo(x - 3, cy + 13, x - 1, cy + 16);
  ctx.moveTo(x + 4, cy + 8);
  ctx.quadraticCurveTo(x + 3, cy + 13, x + 1, cy + 16);
  ctx.stroke();
  // moustache
  ctx.fillStyle = '#E6E1D8';
  ctx.beginPath();
  ctx.ellipse(ex - 3.5, ey + 6, 4, 2, 0.25, 0, TAU);
  ctx.ellipse(ex + 3.5, ey + 6, 4, 2, -0.25, 0, TAU);
  ctx.fill();
  // yeux, derrière des lunettes rondes, sous de gros sourcils blancs
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(ex - 4.5, ey, 2, 0, TAU);
  ctx.arc(ex + 4.5, ey, 2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#C9A24A';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ex - 4.5, ey, 3.8, 0, TAU);
  ctx.moveTo(ex + 8.3, ey);
  ctx.arc(ex + 4.5, ey, 3.8, 0, TAU);
  ctx.moveTo(ex - 0.7, ey - 0.5);
  ctx.lineTo(ex + 0.7, ey - 0.5);
  ctx.stroke();
  ctx.fillStyle = '#F4F1EA';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ex + s * 5, ey - 5.2, 3.6, 1.6, s * 0.2, 0, TAU);
    ctx.fill();
  }
  if (!name) return;
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText(name, x, cy - r - 10);
  ctx.fillStyle = '#E8DCC2';
  ctx.fillText(name, x, cy - r - 10);
}

/** Point d'exclamation doré au-dessus d'un personnage qui a quelque chose à nous dire : il flotte doucement. */
export function drawQuestMark(ctx: Ctx, x: number, y: number, t: number) {
  const by = y + Math.sin(t * 3) * 3;
  ctx.save();
  ctx.font = '800 30px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(16,24,26,0.9)';
  ctx.strokeText('!', x, by);
  ctx.shadowColor = 'rgba(246,210,122,0.8)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#F6D27A';
  ctx.fillText('!', x, by);
  ctx.restore();
}

/** Épée du guerrier : pommeau, poignée gainée, garde recourbée, lame à gouttière ; elle s'orne avec le niveau d'arme. */
function drawSword(ctx: Ctx, r: number, lvl: number) {
  const steel = lvl >= 9 ? '#F6D27A' : lvl >= 6 ? '#E6ECF2' : '#D4DAE0', edge = lvl >= 9 ? '#FFF1C4' : '#FFFFFF';
  const x0 = r + 3; // pommeau, juste hors du corps
  const L = 24 + Math.min(6, lvl * 0.6); // la lame s'allonge avec le niveau
  ctx.lineJoin = 'round';
  // lame : large à la garde, effilée en pointe
  ctx.fillStyle = steel;
  ctx.strokeStyle = 'rgba(12,18,16,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0 + 9, -3.2);
  ctx.lineTo(x0 + 9 + L * 0.82, -2.4);
  ctx.lineTo(x0 + 9 + L, 0);
  ctx.lineTo(x0 + 9 + L * 0.82, 2.4);
  ctx.lineTo(x0 + 9, 3.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // gouttière et fil lumineux
  ctx.strokeStyle = 'rgba(90,100,110,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 + 11, 0);
  ctx.lineTo(x0 + 9 + L * 0.7, 0);
  ctx.stroke();
  ctx.strokeStyle = edge;
  ctx.beginPath();
  ctx.moveTo(x0 + 10, -2.3);
  ctx.lineTo(x0 + 9 + L * 0.8, -1.7);
  ctx.stroke();
  // garde recourbée
  ctx.strokeStyle = 'rgba(12,18,16,0.85)';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0 + 6, -8);
  ctx.quadraticCurveTo(x0 + 10, 0, x0 + 6, 8);
  ctx.stroke();
  ctx.strokeStyle = lvl >= 3 ? '#F0B64A' : '#A2AEB9';
  ctx.lineWidth = 2.6;
  ctx.stroke();
  // poignée gainée de cuir
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x0, -1.8, 6, 3.6);
  ctx.strokeStyle = '#8B6A47';
  ctx.lineWidth = 1;
  for (const k of [1.5, 3.5]) {
    ctx.beginPath();
    ctx.moveTo(x0 + k, -1.8);
    ctx.lineTo(x0 + k + 1.5, 1.8);
    ctx.stroke();
  }
  // pommeau, avec une gemme à partir du niveau 6
  ctx.fillStyle = lvl >= 3 ? '#F0B64A' : '#A2AEB9';
  ctx.beginPath();
  ctx.arc(x0 - 1, 0, 2.8, 0, TAU);
  ctx.fill();
  if (lvl >= 6) {
    ctx.fillStyle = '#E8693F';
    ctx.beginPath();
    ctx.arc(x0 + 7.5, 0, 1.6, 0, TAU);
    ctx.fill();
  }
}

/** Outil en main pendant la récolte : pioche (filons, pierre) ou hache (bois), qui s'abat à chaque coup. */
export interface Tool {
  kind: 'pick' | 'axe' | 'fruit'; // fruit : baies tendues à bout de bras
  ang: number; // direction de la cible
  k: number; // temps depuis le dernier coup, de 0 (outil abattu) à 1 (relevé pour le suivant)
}

function drawTool(ctx: Ctx, r: number, tool: Tool) {
  if (tool.kind === 'fruit') {
    // main tendue et sa grappe de baies
    ctx.fillStyle = '#E8C9A0';
    ctx.beginPath();
    ctx.arc(r + 4, 0, 4, 0, TAU);
    ctx.fill();
    for (const [bx, by] of [[r + 9, -3], [r + 12, 2], [r + 7, 3], [r + 11, -6]]) {
      ctx.fillStyle = '#C8323C';
      ctx.beginPath();
      ctx.arc(bx, by, 3.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,220,0.85)';
      ctx.beginPath();
      ctx.arc(bx - 1, by - 1, 1, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#4F7C45';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r + 10, -8);
    ctx.lineTo(r + 13, -12);
    ctx.stroke();
    return;
  }
  // abattu à l'impact, puis relevé peu à peu jusqu'au coup suivant
  const swing = 0.5 - 1.6 * (1 - (1 - tool.k) ** 2);
  ctx.rotate(swing);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(12,18,16,0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(r - 6, 0);
  ctx.lineTo(r + 20, 0);
  ctx.stroke();
  ctx.strokeStyle = '#8B6A47';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  ctx.fillStyle = '#C9CFC2';
  ctx.strokeStyle = 'rgba(12,18,16,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (tool.kind === 'pick') {
    // fer de pioche : deux pointes recourbées
    ctx.moveTo(r + 18, -2);
    ctx.quadraticCurveTo(r + 24, -10, r + 16, -17);
    ctx.lineTo(r + 21, -2);
    ctx.lineTo(r + 21, 2);
    ctx.lineTo(r + 16, 17);
    ctx.quadraticCurveTo(r + 24, 10, r + 18, 2);
    ctx.closePath();
  } else {
    // fer de hache : lame large d'un seul côté
    ctx.moveTo(r + 14, -3);
    ctx.lineTo(r + 23, -3);
    ctx.quadraticCurveTo(r + 30, 4, r + 26, 13);
    ctx.quadraticCurveTo(r + 18, 10, r + 14, 3);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
}

export function hpBar(ctx: Ctx, x: number, y: number, w: number, pct: number, color: string) {
  ctx.fillStyle = 'rgba(16,24,26,0.85)';
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, (w * Math.max(0, pct)) / 100, 4);
}

// ───────────────────────── Aides de dessin ─────────────────────────

/** Trait courbe (Bézier cubique) qui s'affine de w0 à w1 : défenses, pattes, crocs. */
function taper(ctx: Ctx, r: number, pts: number[], w0: number, w1: number, color: string, outline = true) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = pts.map((v) => v * r);
  const at = (t: number) => {
    const m = 1 - t;
    return [
      m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3,
      m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3,
    ];
  };
  ctx.lineCap = 'round';
  const passes: [string, number][] = outline ? [['rgba(12,18,16,0.8)', 0.08], [color, 0]] : [[color, 0]];
  for (const [c, extra] of passes) {
    ctx.strokeStyle = c;
    let [px, py] = at(0);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, [nx, ny] = at(t);
      ctx.lineWidth = Math.max(1, r * (w0 + (w1 - w0) * t + extra));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      [px, py] = [nx, ny];
    }
  }
}

// ───────────────────────── Sanglier ─────────────────────────

/** Chemin fermé à partir de points [x, y] (en rayons), lissé par des courbes passant par les milieux. */
const boarPath = (ctx: Ctx, r: number, pts: number[][]) => {
  ctx.beginPath();
  const n = pts.length, mid = (i: number) => [((pts[i % n][0] + pts[(i + 1) % n][0]) / 2) * r, ((pts[i % n][1] + pts[(i + 1) % n][1]) / 2) * r];
  const [sx, sy] = mid(n - 1);
  ctx.moveTo(sx, sy);
  for (let i = 0; i < n; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[i][0] * r, pts[i][1] * r, mx, my);
  }
  ctx.closePath();
};
/** Patte fine de suidé : jarret, puis sabot fendu sombre. swing : angle du pas. */
const hoofLeg = (ctx: Ctx, r: number, x: number, y: number, w: number, h: number, swing: number, col: string, hoof: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-w * 0.6, 0);
  ctx.lineTo(w * 0.6, 0);
  ctx.lineTo(w * 0.42, h * 0.82);
  ctx.lineTo(-w * 0.42, h * 0.82);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.06);
  ctx.fillStyle = hoof;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, h * 0.8);
  ctx.lineTo(w * 0.55, h * 0.8);
  ctx.lineTo(w * 0.6, h);
  ctx.lineTo(-w * 0.55, h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.82);
  ctx.lineTo(w * 0.05, h);
  ctx.stroke();
  ctx.restore();
};
/** Défense d'ivoire qui part de la gueule et remonte en croissant. */
const ivoryTusk = (ctx: Ctx, r: number, x: number, y: number, len: number, col: string, broken = false) => {
  const l = broken ? len * 0.45 : len;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 0.05 * r, y);
  ctx.quadraticCurveTo(x + l * 0.75, y + l * 0.05, x + l * 0.62, y - l * 0.85);
  if (broken) ctx.lineTo(x + l * 0.46, y - l * 0.8);
  ctx.quadraticCurveTo(x + l * 0.42, y - l * 0.15, x - 0.05 * r, y - 0.09 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.04);
};
/** Crête de soies dentelée le long de l'échine : de (x0, y0) à (x1, y1), plus haute au garrot. */
const bristles = (ctx: Ctx, r: number, x0: number, y0: number, x1: number, y1: number, h: number, n: number, col: string) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x0 * r, y0 * r + 0.06 * r);
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const lift = (i % 2 ? 1 : 0.35) * h * (0.45 + Math.sin(k * Math.PI * 0.9 + 0.3) * 0.75);
    ctx.lineTo((x - 0.02) * r, (y - lift) * r);
  }
  ctx.lineTo(x1 * r, y1 * r + 0.08 * r);
  ctx.closePath();
  ctx.fill();
};
/** Groin : disque au bout du museau, deux narines. */
const pigSnout = (ctx: Ctx, r: number, x: number, y: number, rx: number, ry: number, col: string) => {
  blot(ctx, x, y, rx, ry, col);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  furLine(ctx, r, 0.04);
  blot(ctx, x + rx * 0.15, y - ry * 0.35, rx * 0.22, ry * 0.18, '#10181A');
  blot(ctx, x + rx * 0.15, y + ry * 0.35, rx * 0.22, ry * 0.18, '#10181A');
};
/** Trot : pattes en diagonale (avant gauche avec arrière droite). */
const trot = (u: UnitLook, speed = 9) => Math.sin(u.t * speed + u.seed) * 0.32;

/**
 * Sanglier (zone 3), « sanglier de bruyère » : plus rond et trapu, robe roux sombre à la livrée rayée crème (comme un marcassin qui
 * aurait grandi sans la perdre), brins de bruyère violette pris dans la crête, gros groin, petites défenses.
 * Le géant : rayures délavées, bruyère sèche, défenses énormes.
 */
function boar(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const fur = whiteIf(u, boss ? '#5A3A26' : '#8B5A36'), shade = whiteIf(u, boss ? '#3E2819' : '#633F25'), dark = whiteIf(u, '#2E1E13');
  const stripe = boss ? 'rgba(226,205,166,0.35)' : 'rgba(236,214,170,0.75)', heather = boss ? '#8E7A86' : '#B46FC2';
  const ivory = whiteIf(u, '#F1E8D2'), disk = whiteIf(u, '#D79A7E');
  const s = trot(u, 10), bob = Math.abs(Math.sin(u.t * 10 + u.seed)) * r * 0.035;
  hoofLeg(ctx, r, -0.52 * r, 0.18 * r, 0.22 * r, 0.6 * r, -s, shade, dark);
  hoofLeg(ctx, r, 0.32 * r, 0.16 * r, 0.22 * r, 0.62 * r, s, shade, dark);
  hoofLeg(ctx, r, -0.32 * r, 0.2 * r, 0.23 * r, 0.58 * r, s, fur, dark);
  hoofLeg(ctx, r, 0.52 * r, 0.18 * r, 0.23 * r, 0.6 * r, -s, fur, dark);
  ctx.save();
  ctx.translate(0, -bob);
  // queue en tire-bouchon
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(-0.98 * r, -0.12 * r, 0.08 * r, -0.5 + Math.sin(u.t * 8 + u.seed) * 0.4, 4);
  ctx.stroke();
  // corps en tonneau
  ctx.fillStyle = fur;
  boarPath(ctx, r, [[-0.95, 0.02], [-0.78, -0.42], [0.0, -0.6], [0.55, -0.46], [0.72, 0.1], [0.45, 0.46], [-0.45, 0.46], [-0.9, 0.3]]);
  ctx.fill();
  furLine(ctx, r);
  blot(ctx, -0.1 * r, 0.35 * r, 0.6 * r, 0.11 * r, shade);
  if (!u.flash) {
    // livrée rayée le long du corps
    ctx.save();
    boarPath(ctx, r, [[-0.95, 0.02], [-0.78, -0.42], [0.0, -0.6], [0.55, -0.46], [0.72, 0.1], [0.45, 0.46], [-0.45, 0.46], [-0.9, 0.3]]);
    ctx.clip();
    ctx.strokeStyle = stripe;
    ctx.lineWidth = r * 0.07;
    for (const y of [-0.36, -0.16, 0.04]) {
      ctx.beginPath();
      ctx.moveTo(-1.0 * r, (y + 0.06) * r);
      ctx.quadraticCurveTo(-0.1 * r, (y - 0.08) * r, 0.75 * r, (y + 0.02) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
  bristles(ctx, r, -0.72, -0.4, 0.5, -0.5, 0.2, 12, dark);
  if (!u.flash) {
    // brins de bruyère plantés dans la crête : tige et grappe de clochettes
    for (const [x, y, a] of [[-0.42, -0.6, -0.3], [-0.05, -0.72, 0.1], [0.28, -0.66, 0.35]]) {
      ctx.save();
      ctx.translate(x * r, y * r);
      ctx.rotate(a + Math.sin(u.t * 3 + x * 5) * 0.08);
      ctx.strokeStyle = boss ? '#6E5A3E' : '#4F7840';
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, 0.12 * r);
      ctx.lineTo(0, -0.14 * r);
      ctx.stroke();
      for (let k = 0; k < 4; k++) blot(ctx, (k % 2 ? 0.04 : -0.04) * r, (-0.12 + k * 0.06) * r, 0.035 * r, 0.04 * r, heather);
      ctx.restore();
    }
  }
  // tête ronde et gros groin
  ctx.fillStyle = fur;
  boarPath(ctx, r, [[0.4, -0.44], [0.82, -0.36], [1.18, 0.0], [1.16, 0.3], [0.8, 0.42], [0.42, 0.34], [0.34, -0.06]]);
  ctx.fill();
  furLine(ctx, r);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(0.5 * r, -0.36 * r);
  ctx.quadraticCurveTo(0.42 * r, -0.66 * r, 0.56 * r, -0.72 * r);
  ctx.quadraticCurveTo(0.72 * r, -0.56 * r, 0.74 * r, -0.36 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.05);
  pigSnout(ctx, r, 1.18 * r, 0.15 * r, 0.13 * r, 0.18 * r, disk);
  ivoryTusk(ctx, r, 0.98 * r, 0.32 * r, (boss ? 0.4 : 0.2) * r, ivory);
  glowEye(ctx, 0.78 * r, -0.08 * r, 0.065 * r, u.alpha ? '#B48CFF' : boss ? '#E8693F' : '#2A1A10', u.wild, u.alpha || boss);
  ctx.restore();
}

// ───────────────────────── Deuxième espèce de chaque zone ─────────────────────────

/** Sporelin : petit champignon sauteur des sous-bois (zone 1). */
function sporelin(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const hop = Math.max(0, Math.sin(u.t * 7 + u.seed)) * r * 0.25;
  ctx.translate(0, -hop);
  const stem = u.flash ? '#FFFFFF' : '#EADFC6';
  // pieds
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#B9A98A';
  ctx.beginPath();
  ctx.ellipse(-0.3 * r, 0.75 * r, 0.22 * r, 0.12 * r, 0, 0, TAU);
  ctx.ellipse(0.3 * r, 0.75 * r, 0.22 * r, 0.12 * r, 0, 0, TAU);
  ctx.fill();
  // pied du champignon (le corps)
  ctx.fillStyle = stem;
  ctx.beginPath();
  ctx.roundRect(-0.45 * r, -0.15 * r, 0.9 * r, 0.9 * r, 0.3 * r);
  ctx.fill();
  ink(ctx, r);
  eyes(ctx, 0.08 * r, 0.25 * r, 0.2 * r, 0.09 * r, '#10181A', u.wild);
  // chapeau
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-1.0 * r, 0.0);
  ctx.quadraticCurveTo(-0.95 * r, -1.05 * r, 0, -1.05 * r);
  ctx.quadraticCurveTo(0.95 * r, -1.05 * r, 1.0 * r, 0.0);
  ctx.quadraticCurveTo(0, 0.18 * r, -1.0 * r, 0.0);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#F1E8D2';
  for (const [sx, sy, sr] of [[-0.45, -0.45, 0.16], [0.15, -0.72, 0.13], [0.55, -0.3, 0.11], [-0.1, -0.3, 0.08]] as const) {
    ctx.beginPath();
    ctx.arc(sx * r, sy * r, sr * r, 0, TAU);
    ctx.fill();
  }
  // spores qui s'échappent
  ctx.fillStyle = 'rgba(241,232,210,0.6)';
  for (let i = 0; i < 3; i++) {
    const k = (u.t * 0.6 + i / 3 + u.seed) % 1;
    ctx.beginPath();
    ctx.arc((i - 1) * 0.4 * r, (-1.1 - k * 0.8) * r, r * 0.06 * (1 - k), 0, TAU);
    ctx.fill();
  }
}

/** Araignée sylvestre : rapide et venimeuse (zone 2). */
function spider(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const legC = u.flash ? '#FFFFFF' : '#8A6FA3';
  // 4 pattes par côté, articulées (hanche → genou → pied), qui alternent en marchant
  const leg = (hx: number, hy: number, kx: number, ky: number, fx: number, fy: number) => {
    for (const [c, w] of [['rgba(12,18,16,0.85)', 0.16], [legC, 0.09]] as const) {
      ctx.strokeStyle = c;
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
  const spread = [0.75, 0.3, -0.25, -0.75];
  const legsSide = (side: number) => {
    for (let i = 0; i < 4; i++) {
      const walk = Math.sin(u.t * 12 + u.seed + i * 1.7 + (side > 0 ? Math.PI : 0)) * 0.1;
      const hx = 0.35 - i * 0.12, d = spread[i] + walk;
      if (side < 0) leg(hx, -0.1, hx + d * 0.9, -0.85, hx + d * 1.6, 0.25); // pattes du fond
      else leg(hx, 0.2, hx + d * 0.9, 0.55, hx + d * 1.5, 0.85); // pattes du devant
    }
  };
  legsSide(-1);
  // abdomen
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(-0.42 * r, 0.0, 0.7 * r, 0.58 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  // motif sablier ambre
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#F0B64A';
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, -0.22 * r);
  ctx.lineTo(-0.22 * r, -0.22 * r);
  ctx.lineTo(-0.42 * r, 0.0);
  ctx.lineTo(-0.22 * r, 0.22 * r);
  ctx.lineTo(-0.62 * r, 0.22 * r);
  ctx.lineTo(-0.42 * r, 0.0);
  ctx.closePath();
  ctx.fill();
  // céphalothorax
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0.42 * r, 0.06 * r, 0.42 * r, 0.36 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  legsSide(1);
  // crochets
  taper(ctx, r, [0.78, 0.22, 0.95, 0.3, 0.95, 0.45, 0.85, 0.5], 0.07, 0.03, u.flash ? '#FFFFFF' : '#D9CFB8');
  // grappe d'yeux
  ctx.fillStyle = u.alpha ? '#B48CFF' : '#E8693F';
  for (const [ex, ey, er] of [[0.55, -0.05, 0.08], [0.72, -0.02, 0.08], [0.5, 0.1, 0.05], [0.68, 0.12, 0.05]] as const) {
    ctx.beginPath();
    ctx.moveTo(ex * r + er * r, ey * r);
    ctx.arc(ex * r, ey * r, er * r, 0, TAU);
    ctx.fill();
  }
}

// ───────────────────────── Ours (grizzly des fourrés) ─────────────────────────

/** Contour sombre du chemin courant (fourrure). */
const furLine = (ctx: Ctx, r: number, k = 0.1) => {
  ctx.strokeStyle = 'rgba(12,18,16,0.7)';
  ctx.lineWidth = Math.max(1.5, r * k);
  ctx.lineJoin = 'round';
  ctx.stroke();
};
/** Ellipse au contour en touffes de poils (pointes vers l'extérieur). */
const furTufts = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, col: string, jag = 1.14, rot = 0) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let k = 0; k <= n * 2; k++) {
    const a = (k / (n * 2)) * TAU + rot, d = k % 2 ? 1 : jag;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
};
const blot = (ctx: Ctx, x: number, y: number, rx: number, ry: number, col: string, rot = 0) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
};
/** Patte épaisse qui avance et recule (pas lourd), griffes claires au bout. */
const heavyPaw = (ctx: Ctx, r: number, x: number, y: number, w: number, h: number, swing: number, col: string, claw: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(swing);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(-w / 2, 0, w, h, [w * 0.35, w * 0.35, w * 0.45, w * 0.45]);
  ctx.fill();
  furLine(ctx, r, 0.07);
  ctx.strokeStyle = claw;
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const k of [-0.25, 0.05, 0.35]) {
    ctx.moveTo(w * k + w * 0.1, h - r * 0.02);
    ctx.lineTo(w * k + w * 0.22, h + r * 0.07);
  }
  ctx.stroke();
  ctx.restore();
};
/** Œil : lueur douce (sans shadowBlur), iris, pupille, reflet, et sourcil froncé chez le sauvage. */
const glowEye = (ctx: Ctx, x: number, y: number, s: number, iris: string, angry: boolean, glow = false) => {
  if (glow) {
    ctx.globalAlpha *= 0.35;
    blot(ctx, x, y, s * 2.4, s * 2, iris);
    ctx.globalAlpha /= 0.35;
  }
  blot(ctx, x, y, s * 1.15, s, iris);
  blot(ctx, x + s * 0.2, y, s * 0.5, s * 0.75, '#10181A');
  blot(ctx, x - s * 0.25, y - s * 0.35, s * 0.25, s * 0.2, 'rgba(255,255,255,0.8)');
  if (angry) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, s * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s * 1.6, y - s * 1.9);
    ctx.lineTo(x + s * 1.3, y - s * 1.0);
    ctx.stroke();
  }
};
const whiteIf = (u: UnitLook, c: string) => (u.flash ? '#FFFFFF' : c);

function bear(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const boss = !!SPECIES[u.species]?.boss;
  const fur = whiteIf(u, boss ? '#3F2A1D' : '#6B4A33'), shade = whiteIf(u, boss ? '#2A1C14' : '#4E3424'), dark = whiteIf(u, boss ? '#1C130E' : '#33221A');
  const light = boss ? '#7A5A3E' : '#A7804F', muzzle = whiteIf(u, boss ? '#8C6E52' : '#C9A27A');
  const sway = Math.sin(u.t * 6 + u.seed), swing = sway * 0.22;
  // les quatre pattes d'abord (le corps couvre leur haut) : celles du fond plus sombres
  heavyPaw(ctx, r, -0.62 * r, 0.12 * r, 0.3 * r, 0.62 * r, -swing, dark, '#E9DFC8');
  heavyPaw(ctx, r, 0.4 * r, 0.08 * r, 0.32 * r, 0.66 * r, swing, dark, '#E9DFC8');
  heavyPaw(ctx, r, -0.34 * r, 0.16 * r, 0.32 * r, 0.62 * r, swing, shade, '#F2E8D2');
  heavyPaw(ctx, r, 0.62 * r, 0.1 * r, 0.34 * r, 0.66 * r, -swing, shade, '#F2E8D2');
  // croupe basse et ronde, bosse d'épaule haute
  furTufts(ctx, -0.45 * r, 0.05 * r, 0.55 * r, 0.5 * r, 9, fur);
  furLine(ctx, r);
  furTufts(ctx, 0.1 * r, -0.12 * r + sway * r * 0.02, 0.62 * r, 0.62 * r, 11, fur, 1.12, 0.3);
  furLine(ctx, r);
  furTufts(ctx, -0.25 * r, 0.1 * r, 0.75 * r, 0.42 * r, 12, fur, 1.06);
  // ventre dans l'ombre, reflet doré sur l'échine et la bosse
  blot(ctx, -0.2 * r, 0.38 * r, 0.62 * r, 0.12 * r, shade);
  if (!u.flash) {
    // pointes de poils dorées sur la bosse (grizzly : « poil argenté »), en fines mèches
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = -2.5 + k * 0.17, x = 0.1 * r + Math.cos(a) * 0.6 * r, y = -0.12 * r + Math.sin(a) * 0.62 * r;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * -0.16 * r, y + Math.sin(a) * -0.16 * r);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // tête lourde, portée bas devant l'épaule
  const hx = 0.82 * r, hy = 0.0 * r + sway * r * 0.025;
  furTufts(ctx, hx, hy, 0.4 * r, 0.36 * r, 9, fur, 1.1);
  furLine(ctx, r);
  for (const ox of [-0.18, 0.12]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.arc(hx + ox * r, hy - 0.34 * r, 0.12 * r, 0, TAU);
    ctx.fill();
    furLine(ctx, r, 0.06);
    blot(ctx, hx + ox * r, hy - 0.33 * r, 0.06 * r, 0.055 * r, whiteIf(u, '#3A2618'));
  }
  // long museau clair, truffe, gueule
  ctx.fillStyle = muzzle;
  ctx.beginPath();
  ctx.moveTo(hx + 0.12 * r, hy - 0.08 * r);
  ctx.quadraticCurveTo(hx + 0.5 * r, hy - 0.14 * r, hx + 0.6 * r, hy + 0.04 * r);
  ctx.quadraticCurveTo(hx + 0.56 * r, hy + 0.2 * r, hx + 0.16 * r, hy + 0.2 * r);
  ctx.closePath();
  ctx.fill();
  furLine(ctx, r, 0.06);
  blot(ctx, hx + 0.58 * r, hy - 0.02 * r, 0.08 * r, 0.065 * r, '#10181A');
  ctx.strokeStyle = 'rgba(16,24,26,0.6)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.moveTo(hx + 0.52 * r, hy + 0.12 * r);
  ctx.quadraticCurveTo(hx + 0.4 * r, hy + 0.17 * r, hx + 0.28 * r, hy + 0.13 * r);
  ctx.stroke();
  if (boss && !u.flash) {
    // cicatrices de combat sur l'épaule et le museau
    ctx.strokeStyle = '#C98B6A';
    ctx.lineWidth = Math.max(1.2, r * 0.03);
    ctx.beginPath();
    for (const [x, y] of [[0.05, -0.38], [0.16, -0.42], [0.27, -0.46]]) {
      ctx.moveTo(x * r, y * r);
      ctx.lineTo((x + 0.1) * r, (y + 0.24) * r);
    }
    ctx.moveTo(hx + 0.2 * r, hy - 0.12 * r);
    ctx.lineTo(hx + 0.32 * r, hy + 0.04 * r);
    ctx.stroke();
  }
  glowEye(ctx, hx + 0.12 * r, hy - 0.1 * r, 0.06 * r, u.alpha ? '#B48CFF' : boss ? '#E8693F' : '#F0B64A', u.wild, u.alpha || boss);
}

/** Feu follet : flamme froide qui flotte au-dessus des ruines (zone 4). */
function wisp(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = (k: number) => Math.sin(u.t * 9 + u.seed + k) * 0.08;
  const flame = (scale: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-0.7 * r * scale, 0.2 * r * scale);
    ctx.quadraticCurveTo(-0.8 * r * scale, -0.5 * r * scale, (-0.25 + f(1)) * r * scale, -1.0 * r * scale);
    ctx.quadraticCurveTo(-0.15 * r * scale, -0.55 * r * scale, (0.05 + f(2)) * r * scale, -1.3 * r * scale);
    ctx.quadraticCurveTo(0.3 * r * scale, -0.6 * r * scale, (0.45 + f(3)) * r * scale, -0.95 * r * scale);
    ctx.quadraticCurveTo(0.85 * r * scale, -0.4 * r * scale, 0.7 * r * scale, 0.2 * r * scale);
    ctx.quadraticCurveTo(0.6 * r * scale, 0.75 * r * scale, 0, 0.75 * r * scale);
    ctx.quadraticCurveTo(-0.6 * r * scale, 0.75 * r * scale, -0.7 * r * scale, 0.2 * r * scale);
    ctx.closePath();
    ctx.fill();
  };
  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = r * 0.9;
  flame(1.0, u.flash ? '#FFFFFF' : fill);
  ctx.restore();
  flame(0.72, u.flash ? '#FFFFFF' : '#BFE3FF');
  flame(0.42, '#FFFFFF');
  // traînée d'étincelles sous lui
  ctx.fillStyle = 'rgba(191,227,255,0.7)';
  for (let i = 0; i < 3; i++) {
    const k = (u.t * 0.8 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc((i - 1) * 0.25 * r, (0.8 + k * 0.5) * r, r * 0.07 * (1 - k), 0, TAU);
    ctx.fill();
  }
  eyes(ctx, 0.05 * r, 0.1 * r, 0.22 * r, 0.1 * r, '#1A2A44', u.wild);
}

/** Luciole : gibier de nuit des Bois profonds ; abdomen lumineux qui pulse, ailes qui battent (elle flotte). */
function firefly(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const pulse = 0.65 + Math.sin(u.t * 3.2 + u.seed) * 0.35, flap = Math.sin(u.t * 30 + u.seed) * 0.5 + 0.5;
  // halo de l'abdomen
  const g = ctx.createRadialGradient(-0.45 * r, 0.2 * r, 0, -0.45 * r, 0.2 * r, 1.4 * r);
  g.addColorStop(0, `rgba(228,240,122,${0.55 * pulse})`);
  g.addColorStop(1, 'rgba(228,240,122,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(-0.45 * r, 0.2 * r, 1.4 * r, 0, TAU);
  ctx.fill();
  // ailes arrière (translucides), battement rapide
  ctx.fillStyle = 'rgba(220,235,255,0.45)';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, -0.35 * r, 0.62 * r, (0.18 + 0.2 * flap) * r, k * 0.5 - 0.3, 0, TAU);
    ctx.fill();
  }
  // abdomen lumineux
  ctx.fillStyle = u.flash ? '#FFFFFF' : `rgb(${200 + 28 * pulse | 0},${215 + 25 * pulse | 0},${90 + 40 * pulse | 0})`;
  ctx.beginPath();
  ctx.ellipse(-0.45 * r, 0.2 * r, 0.5 * r, 0.36 * r, -0.25, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,230,0.8)';
  ctx.beginPath();
  ctx.ellipse(-0.55 * r, 0.24 * r, 0.22 * r, 0.15 * r, -0.25, 0, TAU);
  ctx.fill();
  // thorax et tête sombres
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#3B3326';
  ctx.beginPath();
  ctx.ellipse(0.15 * r, 0, 0.36 * r, 0.3 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#C8553D';
  ctx.beginPath();
  ctx.arc(0.52 * r, -0.05 * r, 0.24 * r, 0, TAU);
  ctx.fill();
  // antennes
  ctx.strokeStyle = '#3B3326';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0.6 * r, -0.22 * r);
  ctx.quadraticCurveTo(0.75 * r, -0.6 * r, 0.95 * r, -0.62 * r);
  ctx.moveTo(0.5 * r, -0.24 * r);
  ctx.quadraticCurveTo(0.55 * r, -0.65 * r, 0.72 * r, -0.75 * r);
  ctx.stroke();
  // ailes avant, par-dessus
  ctx.fillStyle = 'rgba(235,245,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(0.0, -0.42 * r, 0.55 * r, (0.14 + 0.18 * (1 - flap)) * r, -0.5, 0, TAU);
  ctx.fill();
  eyes(ctx, 0.6 * r, -0.08 * r, 0.12 * r, 0.06 * r, '#1A1A10', false); // gibier paisible : jamais de sourcils froncés
}

/** Guetteur runique : sentinelle de pierre moussue ; son œil se charge avant le trait runique (zone 4, tireur). */
function watcher(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const ch = u.charge ?? 0;
  const step = Math.sin(u.t * 3 + u.seed) * 0.04 * r;
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4A4F4C';
  ctx.beginPath();
  ctx.roundRect(-0.45 * r, 0.45 * r + step, 0.3 * r, 0.35 * r, 0.08 * r);
  ctx.roundRect(0.15 * r, 0.45 * r - step, 0.3 * r, 0.35 * r, 0.08 * r);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-0.6 * r, 0.55 * r);
  ctx.lineTo(-0.5 * r, -0.85 * r);
  ctx.quadraticCurveTo(0, -1.15 * r, 0.5 * r, -0.85 * r);
  ctx.lineTo(0.6 * r, 0.55 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4E7A49';
  ctx.beginPath();
  ctx.ellipse(-0.05 * r, -0.92 * r, 0.55 * r, 0.2 * r, -0.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#5E8A55';
  ctx.beginPath();
  ctx.ellipse(-0.45 * r, -0.4 * r, 0.14 * r, 0.3 * r, 0.2, 0, TAU);
  ctx.fill();
  // rune gravée, qui s'allume avec la charge
  ctx.strokeStyle = `rgba(143,227,214,${0.35 + ch * 0.5})`;
  ctx.lineWidth = 0.06 * r;
  ctx.beginPath();
  ctx.moveTo(-0.2 * r, 0.1 * r);
  ctx.lineTo(0, 0.35 * r);
  ctx.lineTo(0.2 * r, 0.1 * r);
  ctx.stroke();
  // œil
  const g = 0.22 * r * (1 + ch * 0.3);
  ctx.fillStyle = `rgba(143,227,214,${0.25 + ch * 0.35})`;
  ctx.beginPath();
  ctx.arc(0.05 * r, -0.35 * r, g * 1.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(0.05 * r, -0.35 * r, g * 1.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ch > 0.3 ? '#C9FFF5' : '#8FE3D6';
  ctx.beginPath();
  ctx.arc(0.1 * r, -0.35 * r, g * 0.6, 0, TAU);
  ctx.fill();
}

// Tout en couleurs pleines, contour compris : une peau translucide se fondait dans la vase des Lacs brumeux.
const TOAD = {
  shade: '#4A6532', dark: '#33481F', wart: '#9DBB66', wartShade: '#56723A', wartLight: '#D6E6A8', blotch: '#3E5628',
  belly: '#E8DCA0', bellyShade: '#C9BC80', light: '#8DAA5C', crease: '#3A5226', web: '#2A3C1A', line: '#16200F', slime: '#7FA060',
};

/**
 * Crapaud-mortier (zone 5, tireur) : assis, cuisses repliées et pieds palmés, bras fins aux doigts ronds ; peau
 * verruqueuse (verrues en relief, taches sombres, glandes derrière les yeux), ventre crème, large bouche, narines,
 * yeux globuleux à pupille horizontale. Avant de tirer, il gonfle son sac vocal (tendu, luisant) et un filet de vase
 * perle au coin de la bouche. Le Crapaud-Roi porte une cape de nénuphar et une fleur d'eau.
 */
function toad(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, puff = u.charge ?? 0, boss = !!SPECIES[u.species]?.boss;
  const skin = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : TOAD.shade, dark = f ? '#FFFFFF' : TOAD.dark;
  const breath = Math.sin(u.t * 4 + u.seed) * 0.03;
  const outline = (k = 1) => {
    ctx.strokeStyle = f ? '#FFFFFF' : TOAD.line;
    ctx.lineWidth = Math.max(1.5, r * 0.1 * k);
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  // pied palmé : trois orteils écartés, une palmure entre eux
  const foot = (x: number, y: number, s: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.04 * r);
    for (const a of [-0.5, 0, 0.5]) {
      const tx = x + Math.cos(a) * 0.3 * r * s, ty = y + 0.06 * r + Math.sin(a) * 0.1 * r * s;
      ctx.lineTo(tx, ty);
      ctx.arc(tx, ty, 0.04 * r * s, 0, TAU);
      ctx.moveTo(x, y);
    }
    ctx.fill();
    ctx.fillStyle = f ? '#FFFFFF' : TOAD.web;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.03 * r);
    ctx.lineTo(x + Math.cos(-0.5) * 0.28 * r * s, y + 0.06 * r + Math.sin(-0.5) * 0.1 * r * s);
    ctx.lineTo(x + Math.cos(0.5) * 0.28 * r * s, y + 0.06 * r + Math.sin(0.5) * 0.1 * r * s);
    ctx.closePath();
    ctx.fill();
  };
  // patte arrière du fond, puis le corps
  foot(-0.62 * r, 0.62 * r, 0.9, dark);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-0.95 * r, 0.5 * r);
  ctx.quadraticCurveTo(-1.08 * r * (1 + breath), -0.35 * r, -0.4 * r, -0.62 * r * (1 - breath));
  ctx.quadraticCurveTo(0.25 * r, -0.8 * r, 0.75 * r, -0.42 * r);
  ctx.quadraticCurveTo(1.1 * r, -0.2 * r, 1.05 * r, 0.12 * r);
  ctx.quadraticCurveTo(1.0 * r, 0.5 * r, 0.5 * r, 0.62 * r);
  ctx.lineTo(-0.6 * r, 0.64 * r);
  ctx.closePath();
  ctx.fill();
  outline();
  // ventre crème, ombre du flanc
  if (!f) {
    ctx.fillStyle = TOAD.belly;
    ctx.beginPath();
    ctx.ellipse(0.2 * r, 0.42 * r, 0.62 * r, 0.2 * r, -0.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TOAD.bellyShade;
    ctx.beginPath();
    ctx.ellipse(0.1 * r, 0.54 * r, 0.5 * r, 0.07 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-0.35 * r, 0.25 * r, 0.5 * r, 0.12 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  // cuisse repliée du premier plan (son pli dessiné en creux), et son pied
  if (!f) {
    ctx.strokeStyle = TOAD.crease;
    ctx.lineWidth = Math.max(1.2, 0.05 * r);
    ctx.beginPath();
    ctx.moveTo(-0.92 * r, 0.3 * r);
    ctx.quadraticCurveTo(-0.7 * r, -0.02 * r, -0.3 * r, 0.12 * r); // dessus de la cuisse
    ctx.quadraticCurveTo(-0.05 * r, 0.25 * r, -0.12 * r, 0.5 * r);
    ctx.stroke();
    ctx.fillStyle = TOAD.light;
    ctx.beginPath();
    ctx.ellipse(-0.55 * r, 0.16 * r, 0.22 * r, 0.05 * r, -0.35, 0, TAU);
    ctx.fill();
  }
  foot(-0.38 * r, 0.66 * r, 1, skin);
  // taches sombres et verrues en relief
  if (!f) {
    ctx.fillStyle = TOAD.blotch;
    for (const [x, y, rx, ry] of [[-0.55, -0.25, 0.16, 0.1], [-0.1, -0.5, 0.12, 0.07], [-0.75, 0.05, 0.1, 0.12], [-0.6, 0.3, 0.1, 0.07]]) {
      ctx.beginPath();
      ctx.ellipse(x * r, y * r, rx * r, ry * r, 0.3, 0, TAU);
      ctx.fill();
    }
    for (const [x, y, s] of [[-0.45, -0.4, 0.07], [-0.2, -0.3, 0.06], [-0.7, -0.15, 0.06], [-0.35, -0.05, 0.05], [0.0, -0.52, 0.05], [-0.65, 0.4, 0.05], [-0.3, 0.25, 0.045], [0.15, -0.35, 0.04]]) {
      ctx.fillStyle = TOAD.wart;
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = TOAD.wartShade;
      ctx.beginPath();
      ctx.arc(x * r + s * r * 0.3, y * r + s * r * 0.3, s * r * 0.6, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = TOAD.wartLight;
      ctx.beginPath();
      ctx.arc(x * r - s * r * 0.3, y * r - s * r * 0.3, s * r * 0.3, 0, TAU);
      ctx.fill();
    }
  }
  // bras fin et doigts aux bouts ronds
  ctx.strokeStyle = skin;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.13 * r;
  ctx.beginPath();
  ctx.moveTo(0.3 * r, 0.3 * r);
  ctx.quadraticCurveTo(0.42 * r, 0.52 * r, 0.36 * r, 0.66 * r);
  ctx.stroke();
  ctx.fillStyle = skin;
  for (const d of [-0.12, 0, 0.12]) {
    ctx.beginPath();
    ctx.arc(0.36 * r + d * r, 0.7 * r, 0.045 * r, 0, TAU);
    ctx.fill();
  }
  // sac vocal : il gonfle, se tend et luit avant le tir
  const sx = 0.68 * r, sy = 0.16 * r, srx = (0.26 + puff * 0.32) * r, sry = (0.18 + puff * 0.24) * r;
  ctx.fillStyle = f ? '#FFFFFF' : puff > 0.1 ? '#F2E6B0' : TOAD.belly;
  ctx.beginPath();
  ctx.ellipse(sx, sy, srx, sry, 0, 0, TAU);
  ctx.fill();
  outline(0.7);
  if (!f && puff > 0.1) {
    ctx.strokeStyle = '#BFAE70';
    ctx.lineWidth = Math.max(1, 0.025 * r);
    ctx.beginPath();
    for (const k of [-0.5, 0, 0.5]) {
      ctx.moveTo(sx - srx * 0.7, sy + k * sry * 0.6);
      ctx.quadraticCurveTo(sx, sy + k * sry * 0.9, sx + srx * 0.7, sy + k * sry * 0.6);
    }
    ctx.stroke();
    ctx.fillStyle = '#FFFBEA';
    ctx.beginPath();
    ctx.ellipse(sx - srx * 0.35, sy - sry * 0.45, srx * 0.25, sry * 0.15, -0.4, 0, TAU);
    ctx.fill();
  }
  // glande derrière l'œil, large bouche, narines, filet de vase quand il charge
  ctx.fillStyle = f ? '#FFFFFF' : TOAD.wart;
  ctx.beginPath();
  ctx.ellipse(0.12 * r, -0.48 * r, 0.16 * r, 0.07 * r, -0.3, 0, TAU);
  ctx.fill();
  outline(0.45);
  ctx.strokeStyle = f ? '#FFFFFF' : '#22301A';
  ctx.lineWidth = Math.max(1.2, 0.05 * r);
  ctx.beginPath();
  ctx.moveTo(0.3 * r, -0.04 * r);
  ctx.quadraticCurveTo(0.7 * r, 0.06 * r, 1.04 * r, -0.08 * r);
  ctx.stroke();
  ctx.fillStyle = '#22301A';
  for (const x of [0.88, 0.96]) {
    ctx.beginPath();
    ctx.arc(x * r, -0.3 * r, 0.022 * r, 0, TAU);
    ctx.fill();
  }
  if (puff > 0.3 && !f) {
    ctx.fillStyle = TOAD.slime;
    ctx.beginPath();
    ctx.ellipse(1.06 * r, 0.0 + puff * 0.08 * r, 0.04 * r, 0.07 * r * puff, 0, 0, TAU);
    ctx.fill();
  }
  // yeux globuleux : dôme, iris doré, pupille horizontale, paupière
  for (const x of [0.38, 0.72]) {
    const ex = x * r, ey = -0.58 * r, es = 0.15 * r;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ex, ey + 0.03 * r, es * 1.35, 0, TAU);
    ctx.fill();
    outline(0.75);
    ctx.fillStyle = u.alpha ? '#B48CFF' : '#E8B23C';
    ctx.beginPath();
    ctx.arc(ex, ey, es, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#9A6A24';
    ctx.lineWidth = Math.max(1, 0.02 * r);
    ctx.beginPath();
    ctx.arc(ex, ey, es * 0.7, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.ellipse(ex + es * 0.1, ey, es * 0.75, es * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - es * 0.4, ey - es * 0.4, es * 0.22, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade; // paupière
    ctx.beginPath();
    ctx.arc(ex, ey, es * 1.05, Math.PI * 1.08, Math.PI * 1.92);
    ctx.closePath();
    ctx.fill();
    if (u.wild) {
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = Math.max(1.5, es * 0.3);
      ctx.beginPath();
      ctx.moveTo(ex - es * 1.1, ey - es * 1.25);
      ctx.lineTo(ex + es * 1.0, ey - es * 0.85);
      ctx.stroke();
    }
  }
  // le roi : une feuille de nénuphar posée sur le dos comme une cape, sa fleur d'eau dessus
  if (boss) {
    const px = -0.42 * r, py = -0.42 * r;
    ctx.fillStyle = f ? '#FFFFFF' : '#3F7A3A';
    ctx.beginPath();
    ctx.ellipse(px, py, 0.5 * r, 0.24 * r, -0.25, 0.25, TAU - 0.05);
    ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    outline(0.7);
    if (!f) {
      ctx.strokeStyle = '#7FB060';
      ctx.lineWidth = Math.max(1, 0.025 * r);
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = 0.5 + k * 0.85;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * 0.45 * r, py + Math.sin(a) * 0.2 * r);
      }
      ctx.stroke();
    }
  }
  if (boss && !f) {
    const fx = -0.5 * r, fy = -0.5 * r;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI + (k / 6) * Math.PI;
      ctx.fillStyle = k % 2 ? '#F2B8D0' : '#E68AB0';
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * 0.1 * r, fy + Math.sin(a) * 0.08 * r, 0.1 * r, 0.04 * r, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#F0D060';
    ctx.beginPath();
    ctx.arc(fx, fy - 0.02 * r, 0.04 * r, 0, TAU);
    ctx.fill();
  }
}

/**
 * Serpent des brumes, en dragon des lacs : tête à cornes et barbillons, crinière d'algues, anneaux écailleux
 * à ventre clair. Dans l'eau, seuls ses anneaux affleurent (une pointe de crinière sur chacun) ; il se dresse
 * pour cracher son jet. Sa version géante (l'Hydre des brumes) porte la même apparence.
 */
function serpent(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const scale = u.flash ? '#FFFFFF' : fill, belly = u.flash ? '#FFFFFF' : '#E8D9A8', mane = u.flash ? '#FFFFFF' : '#4F7C45';
  const rise = u.charge ?? 0;
  const pts: [number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    pts.push([(0.1 - k * 1.7) * r, (0.38 + Math.sin(k * 7 - u.t * 4 + u.seed) * 0.12) * r]);
  }
  const ripple = (x: number, y: number, w: number) => {
    ctx.strokeStyle = 'rgba(200,235,240,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, w * (1 + Math.sin(u.t * 3) * 0.06), w * 0.25, 0, 0, TAU);
    ctx.stroke();
  };
  if (!u.inWater) {
    // corps en S, plus fin vers la queue, et écailles du ventre
    for (const [c, extra] of [['rgba(12,18,16,0.75)', 3], [scale, 0]] as const) {
      ctx.strokeStyle = c;
      ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        ctx.lineWidth = 0.44 * r + (0.14 * r - 0.44 * r) * (i / (pts.length - 1)) + extra;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
        ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.fillStyle = belly;
    for (let i = 1; i < 12; i++) {
      ctx.beginPath();
      ctx.ellipse(pts[i][0], pts[i][1] + 0.1 * r, 0.06 * r, 0.04 * r, 0, 0, TAU);
      ctx.fill();
    }
  } else {
    for (const [x, y] of [pts[3], pts[7], pts[11]]) {
      ctx.fillStyle = scale;
      ctx.beginPath();
      ctx.ellipse(x, y, 0.26 * r, 0.2 * r, 0, Math.PI, 0);
      ctx.fill();
      ink(ctx, r);
      ctx.fillStyle = mane;
      ctx.beginPath();
      ctx.moveTo(x - 0.08 * r, y - 0.16 * r);
      ctx.lineTo(x, y - 0.34 * r);
      ctx.lineTo(x + 0.08 * r, y - 0.16 * r);
      ctx.fill();
      ripple(x, y, 0.38 * r);
    }
  }
  // cou dressé (plus haut quand il charge son jet)
  const hy = -(0.38 + rise * 0.5) * r;
  for (const [c, w] of [['rgba(12,18,16,0.75)', 0.44 * r + 3], [scale, 0.44 * r]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.1 * r, 0.38 * r);
    ctx.quadraticCurveTo(0, hy * 0.3, 0.3 * r, hy);
    ctx.stroke();
  }
  // crinière d'algues le long du cou
  ctx.strokeStyle = mane;
  ctx.lineWidth = 0.08 * r;
  for (let k = 0; k < 5; k++) {
    const y0 = 0.3 * r + (hy - 0.3 * r) * (k / 5), x0 = -0.05 * r + k * 0.06 * r;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 - 0.2 * r, y0 - 0.05 * r, x0 - 0.3 * r + Math.sin(u.t * 4 + k) * 0.04 * r, y0 + 0.08 * r);
    ctx.stroke();
  }
  // tête : museau long, cornes, barbillons
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.moveTo(0.15 * r, hy - 0.18 * r);
  ctx.quadraticCurveTo(0.6 * r, hy - 0.3 * r, 1.0 * r, hy - 0.05 * r);
  ctx.lineTo(1.02 * r, hy + 0.08 * r);
  ctx.quadraticCurveTo(0.6 * r, hy + 0.22 * r, 0.15 * r, hy + 0.14 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = belly;
  ctx.lineWidth = 0.07 * r;
  ctx.beginPath();
  ctx.moveTo(0.3 * r, hy - 0.2 * r);
  ctx.quadraticCurveTo(0.15 * r, hy - 0.5 * r, -0.05 * r, hy - 0.55 * r);
  ctx.moveTo(0.42 * r, hy - 0.22 * r);
  ctx.quadraticCurveTo(0.34 * r, hy - 0.5 * r, 0.18 * r, hy - 0.6 * r);
  ctx.stroke();
  ctx.strokeStyle = mane;
  ctx.lineWidth = 0.04 * r;
  ctx.beginPath();
  ctx.moveTo(0.95 * r, hy + 0.06 * r);
  ctx.quadraticCurveTo(1.15 * r, hy + 0.2 * r, 1.05 * r, hy + 0.4 * r);
  ctx.moveTo(0.85 * r, hy + 0.1 * r);
  ctx.quadraticCurveTo(0.95 * r, hy + 0.3 * r, 0.82 * r, hy + 0.45 * r);
  ctx.stroke();
  // œil de reptile qui luit (violet pour un Alpha)
  const iris = u.alpha ? '#B48CFF' : '#F0B64A', ex = 0.58 * r, ey = hy - 0.08 * r, es = 0.075 * r;
  ctx.save();
  ctx.shadowColor = iris;
  ctx.shadowBlur = es * 5;
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.ellipse(ex + es * 0.15, ey, es * 0.3, es * 0.85, 0, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.6);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.5, ey - es * 1.7);
    ctx.lineTo(ex + es * 1.3, ey - es * 0.8);
    ctx.stroke();
  }
  if (u.inWater) ripple(0.1 * r, 0.42 * r, 0.5 * r);
}

const CRAB = { shade: '#9A4228', dark: '#6E2C1A', light: '#F09A6E', belly: '#F2D9B8', tip: '#2A1A14' };

/**
 * Crabe des berges (zone 5, mêlée) : carapace large et plate à bord épineux, marbrée, plus claire au sommet, rebord sombre et
 * dessous crème ; quatre paires de pattes articulées qui trottinent de côté ; pinces à deux doigts (dents, pointes
 * noires) portées par des bras articulés, qui claquent ; yeux noirs luisants sur pédoncules, pièces buccales, et une
 * bulle d'écume de temps en temps. Le Crabe Titan a une pince énorme, des balanes et des algues sur le dos.
 */
function crab(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, boss = !!SPECIES[u.species]?.boss;
  const shell = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : CRAB.shade, dark = f ? '#FFFFFF' : CRAB.dark;
  const snap = Math.max(0, Math.sin(u.t * 3 + u.seed)); // les pinces s'ouvrent et claquent
  ctx.translate(0, 0.12 * r); // plat et haut sur pattes : on le pose sur son ombre
  // pattes : trois segments, pointe sombre ; elles trottinent par paires alternées
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const lift = Math.sin(u.t * 10 + i * 1.7 + (sd > 0 ? Math.PI : 0) + u.seed) * 0.07 * r;
      const bx = sd * (0.4 + i * 0.12) * r, by = (0.08 + i * 0.03) * r;
      const kx = sd * (0.98 + i * 0.1) * r, ky = (-0.24 + i * 0.1) * r + lift;
      const fx = sd * (1.25 + i * 0.07) * r, fy = (0.48 + i * 0.05) * r;
      ctx.strokeStyle = i % 2 ? shade : dark;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 0.075 * r;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy - 0.1 * r);
      ctx.stroke();
      ctx.strokeStyle = f ? '#FFFFFF' : CRAB.tip;
      ctx.lineWidth = 0.045 * r;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 0.1 * r);
      ctx.lineTo(fx + sd * 0.04 * r, fy + 0.02 * r);
      ctx.stroke();
    }
  }
  // dessous crème et rebord sombre, puis la carapace bombée à bord épineux
  ctx.fillStyle = f ? '#FFFFFF' : CRAB.belly;
  ctx.beginPath();
  ctx.ellipse(0, 0.2 * r, 0.7 * r, 0.11 * r, 0, 0, TAU);
  ctx.fill();
  fineInk(ctx, r, 0.6);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(0, 0.12 * r, 1.0 * r, 0.16 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shell;
  ctx.beginPath();
  const spikes = 5;
  ctx.moveTo(-1.02 * r, 0.06 * r);
  for (let k = 0; k <= spikes * 2; k++) {
    // bord avant : une rangée d'épines pointues, de gauche à droite en passant par le front
    const a = Math.PI + (k / (spikes * 2)) * Math.PI, d = k % 2 ? 1.13 : 0.97;
    ctx.lineTo(Math.cos(a) * 1.02 * r * d, 0.02 * r + Math.sin(a) * 0.44 * r * d);
  }
  ctx.quadraticCurveTo(0.9 * r, 0.18 * r, 0, 0.2 * r);
  ctx.quadraticCurveTo(-0.9 * r, 0.18 * r, -1.02 * r, 0.06 * r);
  ctx.closePath();
  ctx.fill();
  fineInk(ctx, r, 0.9);
  if (!f) {
    // sommet plus clair, marbrures, sillons de la carapace
    ctx.fillStyle = 'rgba(255,190,150,0.4)';
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, -0.2 * r, 0.6 * r, 0.12 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(110,40,20,0.35)';
    for (const [x, y, s] of [[-0.6, -0.08, 0.08], [0.55, -0.12, 0.07], [0.22, 0.04, 0.05], [-0.25, 0.05, 0.05], [0.72, 0.02, 0.04]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(90,30,15,0.5)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    ctx.moveTo(-0.32 * r, -0.36 * r);
    ctx.quadraticCurveTo(-0.22 * r, -0.12 * r, -0.42 * r, 0.1 * r);
    ctx.moveTo(0.32 * r, -0.36 * r);
    ctx.quadraticCurveTo(0.22 * r, -0.12 * r, 0.42 * r, 0.1 * r);
    ctx.moveTo(-0.2 * r, -0.02 * r);
    ctx.quadraticCurveTo(0, 0.04 * r, 0.2 * r, -0.02 * r);
    ctx.stroke();
  }
  // balanes et algues du Titan
  if (boss && !f) {
    // balanes : de petits cônes de calcaire, ouverts au sommet
    for (const [x, y, s] of [[-0.62, -0.1, 0.08], [-0.45, -0.26, 0.06], [0.52, -0.2, 0.07], [0.7, -0.04, 0.05], [-0.05, -0.34, 0.05]]) {
      ctx.fillStyle = '#D8D0BC';
      ctx.beginPath();
      ctx.moveTo(x * r - s * r, y * r + s * r * 0.6);
      ctx.lineTo(x * r - s * r * 0.45, y * r - s * r * 0.6);
      ctx.lineTo(x * r + s * r * 0.45, y * r - s * r * 0.6);
      ctx.lineTo(x * r + s * r, y * r + s * r * 0.6);
      ctx.closePath();
      ctx.fill();
      fineInk(ctx, r, 0.35);
      ctx.fillStyle = 'rgba(120,110,95,0.7)';
      ctx.fillRect(x * r - s * r * 0.35, y * r - s * r * 0.15, s * r * 0.7, s * r * 0.18);
      ctx.fillStyle = '#4A443C';
      ctx.beginPath();
      ctx.ellipse(x * r, y * r - s * r * 0.6, s * r * 0.4, s * r * 0.14, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#4F7C45';
    ctx.lineWidth = Math.max(1.5, 0.05 * r);
    ctx.beginPath();
    for (const [x, sd] of [[-0.7, -1], [0.75, 1], [-0.15, -1]]) {
      ctx.moveTo(x * r, -0.15 * r);
      ctx.quadraticCurveTo((x + sd * 0.1) * r, 0.1 * r + Math.sin(u.t * 2 + x) * 0.04 * r, (x + sd * 0.05) * r, 0.32 * r);
    }
    ctx.stroke();
  }
  // bras articulés et pinces (celle du Titan, à droite, est énorme)
  for (const sd of [-1, 1]) {
    const big = boss && sd > 0 ? 1.45 : 1;
    const sx = sd * 0.6 * r, sy = -0.22 * r, ex = sd * 0.92 * r, ey = -0.46 * r;
    ctx.strokeStyle = shell;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.1 * r;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const cx = sd * (1.1 + (big - 1) * 0.2) * r, cy = (-0.52 - (big - 1) * 0.15) * r;
    const open = (1 - snap) * 0.45;
    // repère de la pince : vers l'extérieur et le haut
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sd * big, big);
    ctx.rotate(-0.6);
    // un doigt : fuselé, pointe noire, dents sur son bord intérieur (in : +1 vers le bas, -1 vers le haut)
    const finger = (bx: number, by: number, rot: number, len: number, inner: number, col: string) => {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -0.045 * r);
      ctx.quadraticCurveTo(len * 0.55, -0.075 * r, len, 0);
      ctx.quadraticCurveTo(len * 0.55, 0.035 * r, 0, 0.045 * r);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      fineInk(ctx, r / big, 0.6);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = f ? '#FFFFFF' : CRAB.tip;
      ctx.fillRect(len * 0.72, -0.12 * r, len * 0.3, 0.24 * r); // pointe noire
      if (!f) {
        ctx.fillStyle = CRAB.belly;
        for (const k of [0.2, 0.36, 0.52]) {
          ctx.beginPath();
          ctx.moveTo(k * len, inner * 0.05 * r);
          ctx.lineTo((k + 0.05) * len, inner * 0.015 * r);
          ctx.lineTo((k + 0.1) * len, inner * 0.05 * r);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.restore();
    };
    finger(0.24 * r, 0.03 * r, 0.1, 0.5 * r, -1, shell); // doigt fixe, dans l'axe
    finger(0.22 * r, -0.05 * r, -0.08 - open, 0.48 * r, 1, shade); // doigt mobile, qui s'ouvre
    // la paume, bombée, par-dessus la base des doigts
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0.02 * r, 0, 0.3 * r, 0.12 * r, 0, 0, TAU);
    ctx.fill();
    fineInk(ctx, r / big, 0.8);
    if (!f) {
      ctx.fillStyle = 'rgba(255,200,160,0.45)';
      ctx.beginPath();
      ctx.ellipse(-0.02 * r, -0.05 * r, 0.16 * r, 0.035 * r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(110,40,20,0.35)';
      for (const [x, y] of [[0.08, 0.04], [-0.1, 0.05], [0.16, -0.02]]) {
        ctx.beginPath();
        ctx.arc(x * r, y * r, 0.025 * r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  // pièces buccales, pédoncules et yeux noirs luisants
  if (!f) {
    ctx.fillStyle = CRAB.belly;
    ctx.beginPath();
    ctx.ellipse(0, -0.3 * r, 0.12 * r, 0.06 * r, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,70,40,0.6)';
    ctx.lineWidth = Math.max(1, 0.02 * r);
    ctx.beginPath();
    ctx.moveTo(0, -0.36 * r);
    ctx.lineTo(0, -0.24 * r);
    ctx.stroke();
  }
  for (const sd of [-1, 1]) {
    const tx = sd * 0.24 * r, ty = -0.6 * r + Math.sin(u.t * 2 + sd + u.seed) * 0.03 * r;
    ctx.strokeStyle = shade;
    ctx.lineWidth = 0.05 * r;
    ctx.beginPath();
    ctx.moveTo(sd * 0.14 * r, -0.36 * r);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = u.alpha ? '#B48CFF' : '#10181A';
    ctx.beginPath();
    ctx.arc(tx, ty, 0.085 * r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(tx - 0.03 * r, ty - 0.03 * r, 0.03 * r, 0, TAU);
    ctx.fill();
    if (u.wild) {
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = Math.max(1.5, 0.04 * r);
      ctx.beginPath();
      ctx.moveTo(tx - sd * 0.14 * r, ty - 0.16 * r);
      ctx.lineTo(tx + sd * 0.08 * r, ty - 0.1 * r);
      ctx.stroke();
    }
  }
  // une bulle d'écume, de temps en temps
  const b = (u.t * 0.6 + u.seed * 0.37) % 1;
  if (!f && b < 0.6) {
    ctx.strokeStyle = `rgba(230,245,250,${0.8 * (1 - b / 0.6)})`;
    ctx.lineWidth = Math.max(1, 0.025 * r);
    ctx.beginPath();
    ctx.arc(0.08 * r + b * 0.1 * r, -0.34 * r - b * 0.35 * r, (0.04 + b * 0.05) * r, 0, TAU);
    ctx.stroke();
  }
  ctx.translate(0, -0.12 * r);
}

/**
 * Projectile de tireur. Trait runique : orbe turquoise ; jet : trait d'eau ; cloche : boule qui monte puis
 * retombe sur un cercle annoncé au sol (dessiné dès le départ pour pouvoir l'esquiver).
 */
/** owner : couleur du dompteur d'un tireur de la meute (ou d'un légendaire) ; absente : un sauvage, en rouge. */
export function drawShot(ctx: Ctx, kind: number, x: number, y: number, a: number, b: number, prog: number, t: number, owner?: string) {
  const col = owner ? rgbOf(owner) : '232,105,63';
  if (kind === 1) {
    const p = prog / 100, splash = 52;
    ctx.fillStyle = `rgba(${col},${0.12 + p * 0.22})`;
    ctx.strokeStyle = `rgba(${col},0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(a, b, splash, splash * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const bx = x + (a - x) * p, by = y + (b - y) * p - Math.sin(p * Math.PI) * 120;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + (a - x) * p, y + (b - y) * p, 8, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#B9D86A';
    ctx.strokeStyle = 'rgba(12,18,16,0.6)';
    ctx.beginPath();
    ctx.arc(bx, by, 9, 0, TAU);
    ctx.fill();
    ctx.stroke();
    return;
  }
  const ang = Math.atan2(b, a);
  if (owner) {
    // tir allié : halo à la couleur de son dompteur
    ctx.fillStyle = `rgba(${col},0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, TAU);
    ctx.fill();
  }
  if (kind === 0) {
    ctx.fillStyle = 'rgba(143,227,214,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 13 + Math.sin(t * 20) * 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#C9FFF5';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(189,235,242,0.9)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * 36, y - Math.sin(ang) * 36);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * 18, y - Math.sin(ang) * 18);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}

/** Lièvre des ronces, en lapin boule : tout rond et duveteux, petites oreilles, grands yeux brillants, joues roses (gibier passif). */
function hare(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const fur = u.flash ? '#FFFFFF' : '#D8C7A8', shade = u.flash ? '#FFFFFF' : '#B9A57E', pale = u.flash ? '#FFFFFF' : '#F4ECDC';
  const ell = (x: number, y: number, rx: number, ry: number, rot: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  };
  ctx.translate(0, -Math.max(0, Math.sin(u.t * 8 + u.seed)) * r * 0.16); // il sautille
  const flick = Math.sin(u.t * 3 + u.seed) * 0.08;
  ell(-0.35 * r, 0.62 * r, 0.22 * r, 0.12 * r, 0, shade);
  ell(0.3 * r, 0.62 * r, 0.22 * r, 0.12 * r, 0, shade);
  // boule de poils au contour duveteux
  ctx.fillStyle = fur;
  ctx.beginPath();
  for (let k = 0; k <= 28; k++) {
    const a = (k / 28) * TAU, d = k % 2 ? 1 : 1.06;
    const x = Math.cos(a) * 0.78 * r * d, y = 0.1 * r + Math.sin(a) * 0.62 * r * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(12,18,16,0.55)';
  ctx.lineWidth = Math.max(1.3, r * 0.09);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ell(0.05 * r, 0.32 * r, 0.42 * r, 0.24 * r, 0, pale);
  ell(-0.82 * r, 0.05 * r, 0.16 * r, 0.15 * r, 0, '#FFFFFF'); // queue
  for (const [ox, rot] of [[0.1, -0.3 + flick], [0.42, 0.25 - flick]] as const) {
    ctx.save();
    ctx.translate(ox * r, -0.42 * r);
    ctx.rotate(rot);
    ell(0, -0.28 * r, 0.13 * r, 0.32 * r, 0, fur);
    ink(ctx, r * 0.5);
    ell(0, -0.26 * r, 0.06 * r, 0.2 * r, 0, u.flash ? '#FFFFFF' : '#F2B8B0');
    ctx.restore();
  }
  // grands yeux doux (violets pour un Alpha), reflet blanc
  for (const ex of [0.2, 0.52]) {
    ell(ex * r, -0.08 * r, 0.11 * r, 0.13 * r, 0, u.alpha ? '#B48CFF' : '#10181A');
    ell((ex - 0.035) * r, -0.12 * r, 0.04 * r, 0.04 * r, 0, '#FFFFFF');
  }
  ell(0.08 * r, 0.08 * r, 0.08 * r, 0.05 * r, 0, 'rgba(240,140,140,0.6)');
  ell(0.64 * r, 0.08 * r, 0.08 * r, 0.05 * r, 0, 'rgba(240,140,140,0.6)');
  ell(0.37 * r, 0.04 * r, 0.05 * r, 0.035 * r, 0, '#D8706A');
}

/** Escargot des mousses : coquille en spirale, corps qui ondule doucement, cornes à yeux (gibier passif). */
function snail(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const crawl = Math.sin(u.t * 3 + u.seed) * 0.05;
  const body = u.flash ? '#FFFFFF' : '#C9B79A';
  if (u.shell) {
    // rentré dans sa coquille : elle repose au sol, un peu plus bas
    ctx.save();
    ctx.translate(0.2 * r, 0.3 * r);
    shellOf(ctx, r, fill, u);
    ctx.restore();
    return;
  }
  // corps (pied) allongé
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-1.0 * r, 0.6 * r);
  ctx.quadraticCurveTo(-0.2 * r, (0.35 + crawl) * r, 0.75 * r, 0.25 * r);
  ctx.quadraticCurveTo(1.15 * r, 0.1 * r, 1.05 * r, 0.6 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  // tête et cornes oculaires
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0.85 * r, 0.25 * r, 0.3 * r, 0.25 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.7);
  ctx.strokeStyle = body;
  ctx.lineWidth = 0.08 * r;
  ctx.lineCap = 'round';
  for (const [ex, ey] of [[0.95, -0.35], [1.2, -0.25]]) {
    ctx.beginPath();
    ctx.moveTo(0.9 * r, 0.1 * r);
    ctx.lineTo((ex + crawl) * r, ey * r);
    ctx.stroke();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.arc((ex + crawl) * r, ey * r, 0.08 * r, 0, TAU);
    ctx.fill();
  }
  shellOf(ctx, r, fill, u);
}

/** Coquille en spirale de l'escargot. */
function shellOf(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(-0.2 * r, -0.05 * r, 0.62 * r, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = u.flash ? '#FFFFFF' : '#8A5E33';
  ctx.lineWidth = 0.09 * r;
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 4; a += 0.2) {
    const rr = 0.52 * r * (1 - a / (Math.PI * 4.4));
    const px = -0.2 * r + Math.cos(a) * rr, py = -0.05 * r + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.ellipse(-0.42 * r, -0.4 * r, 0.16 * r, 0.09 * r, -0.6, 0, TAU);
  ctx.fill();
}

// ───────────────────────── Mer de sable (zone 6) ─────────────────────────

/**
 * Suricate : élancé, dressé sur ses pattes arrière en sentinelle ; dos rayé, ventre crème,
 * grandes « lunettes » noires autour des yeux, queue fine à bout noir (gibier craintif).
 */
function meerkat(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const fur = W('#C49A62'), shade = W('#8E6A3E'), belly = W('#EFD9AC'), mask = W('#2E2016');
  const look = Math.sin(u.t * 1.7 + u.seed) * 0.12, sway = Math.sin(u.t * 2.3 + u.seed) * 0.03; // il guette, en équilibre
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
  ell(-0.24 * r, -0.13 * r, 0.08 * r, 0.08 * r, 0, mask); // oreille
  for (const ex of [-0.02, 0.17]) {
    ell(ex * r, -0.04 * r, 0.11 * r, 0.1 * r, 0, mask); // grandes lunettes noires
    ell(ex * r + 0.01 * r, -0.05 * r, 0.045 * r, 0.045 * r, 0, u.alpha ? '#B48CFF' : '#1A120C');
    ell(ex * r - 0.005 * r, -0.07 * r, 0.018 * r, 0.018 * r, 0, '#FFFFFF');
  }
  ctx.restore();
}

/**
 * Chacal fantôme : décharné, côtes apparentes, échine saillante, queue maigre ; oreilles pointues bien plantées
 * à l'arrière du crâne ; yeux de braise qui rougeoient dans la nuit.
 */
function jackal(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
  const W = (c: string) => (u.flash ? '#FFFFFF' : c);
  const boss = !!SPECIES[u.species]?.boss;
  const fur = W(boss ? '#C8BDA4' : '#A89A80'), shade = W(boss ? '#9A8E76' : '#7E7260'), bone = W('#5E5344'), head = W(boss ? '#D8CDB6' : '#BFB49C');
  const step = u.moving ? Math.sin(u.t * 14 + u.seed) * 0.16 : 0;
  // pattes maigres, au trot
  ctx.strokeStyle = shade;
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [lx, k] of [[-0.5, 1], [-0.32, -1], [0.38, -1], [0.55, 1]] as const) {
    ctx.moveTo(lx * r, 0.1 * r);
    ctx.lineTo((lx + step * k * 0.6) * r, 0.42 * r);
    ctx.lineTo((lx + step * k) * r, 0.72 * r);
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
function sandworm(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
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
function vulture(ctx: Ctx, r: number, _fill: string, u: UnitLook) {
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
export function drawSoaring(ctx: Ctx, x: number, y: number, r: number, t: number, seed: number, height = 4.2) {
  const flap = Math.sin(t * 2.2 + seed) * 0.12, h = r * height + Math.sin(t * 1.3 + seed) * r * 0.3;
  const span = r * 2.1, tilt = Math.sin(t * 0.9 + seed) * 0.08; // il penche dans les virages
  ctx.save();
  ctx.translate(x, y - h);
  ctx.rotate(tilt);
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
 * Tréant (la sentinelle des sapins) : trois étages de sapin en capuche, le visage dans leur ombre (deux yeux verts
 * qui luisent), des bras-branches hérissés d'aiguilles, du lichen sur le tronc et des pattes-racines qui marchent.
 */
function treant(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const t = u.t + u.seed, sway = Math.sin(t * 2) * r * 0.08, white = u.flash ? '#FFFFFF' : null;
  // pattes-racines (avec une radicelle chacune)
  ctx.strokeStyle = white ?? '#3E2C1C';
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const s = -1 + (2 * i) / 3, lift = Math.max(0, Math.sin(t * 6 + i * 2)) * (u.moving ? 0.12 : 0.03) * r;
    ctx.lineWidth = r * (0.2 - Math.abs(s) * 0.04);
    ctx.beginPath();
    ctx.moveTo(s * r * 0.4, r * 0.35);
    ctx.quadraticCurveTo(s * r * 0.75, r * 0.55 - lift, s * r, r * 0.8 - lift);
    ctx.stroke();
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(s * r * 0.85, r * 0.72 - lift);
    ctx.lineTo(s * r * 1.15 + 2, r * 0.68 - lift);
    ctx.stroke();
  }
  // bras-branches hérissés d'aiguilles
  for (const s of [-1, 1]) {
    ctx.strokeStyle = white ?? '#3E2C1C';
    ctx.lineWidth = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * r * 0.5, r * 0.05);
    ctx.quadraticCurveTo(s * r * 1.05, 0, s * r * 1.25, -r * 0.3 + sway * s);
    ctx.stroke();
    ctx.strokeStyle = white ?? '#2F5A3A';
    ctx.lineWidth = r * 0.05;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = 0.35 + k * 0.12, bx = s * r * (0.5 + 0.75 * a), by = r * 0.05 - r * 0.35 * a * a + sway * s * a;
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + s * r * 0.08, by - r * 0.16);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + s * r * 0.1, by + r * 0.1);
    }
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // tronc, ses sillons d'écorce et son lichen
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(-r * 0.55, -r * 0.45, r * 1.1, r * 1.05, r * 0.25);
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = 'rgba(30,20,10,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = -r * 0.45 + (r * 0.9 * (i + 0.5)) / 4, w = Math.sin(i * 2.7) * r * 0.08;
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.2 + Math.abs(Math.sin(i)) * r * 0.15);
    ctx.bezierCurveTo(x + w, r * 0.06, x - w, r * 0.29, x + w * 0.5, r * 0.55);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.fillStyle = white ?? 'rgba(170,200,150,0.55)';
  for (const [lx, ly] of [[-0.38, 0.3], [-0.3, 0.38], [0.4, 0.05]]) {
    ctx.beginPath();
    ctx.arc(lx * r, ly * r, r * 0.06, 0, TAU);
    ctx.fill();
  }
  // capuche de sapin : un étage, le visage dans son ombre, puis les deux autres
  const tier = (y: number, w: number, h: number, dark: string, light: string) => {
    ctx.fillStyle = white ?? dark;
    ctx.beginPath();
    ctx.moveTo(-w, y);
    ctx.lineTo(0, y - h);
    ctx.lineTo(w, y);
    for (let i = 4; i >= 0; i--) ctx.lineTo(-w + (2 * w * i) / 4, y + (i % 2 ? r * 0.08 : 0));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = white ?? light;
    ctx.beginPath();
    ctx.moveTo(-w * 0.15, y - h * 0.75);
    ctx.lineTo(0, y - h);
    ctx.lineTo(-w * 0.55, y - h * 0.1);
    ctx.closePath();
    ctx.fill();
  };
  tier(-r * 0.15, r * 0.95, r * 0.75, '#23462E', '#3B6B47');
  ctx.fillStyle = 'rgba(10,16,12,0.55)';
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.18, r * 0.5, r * 0.18, 0, 0, Math.PI);
  ctx.fill();
  // yeux qui luisent (violets pour un Alpha)
  const eye = u.alpha ? '#B48CFF' : '#96E678', glow = 0.25 + Math.sin(t * 4) * 0.1;
  for (const s of [-1, 1]) {
    ctx.globalAlpha = glow;
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(s * r * 0.2, -r * 0.06, r * 0.18, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(s * r * 0.2, -r * 0.06, r * 0.07, 0, TAU);
    ctx.fill();
  }
  tier(-r * 0.6 + sway * 0.3, r * 0.75, r * 0.7, '#2A5236', '#447A50');
  tier(-r * 1.05 + sway * 0.6, r * 0.52, r * 0.65, '#2F5A3A', '#4E8A5A');
  // une pomme de pin accrochée
  ctx.fillStyle = white ?? '#7A5230';
  ctx.beginPath();
  ctx.ellipse(r * 0.55, -r * 0.2, r * 0.07, r * 0.1, 0.3, 0, TAU);
  ctx.fill();
}

// ───────────────────────── Entrailles du volcan ─────────────────────────

/** Lueur de lave qui bat doucement (0,65 à 1), décalée d'une bête à l'autre. */
const lavaPulse = (u: UnitLook, speed = 2.2) => 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(u.t * speed + u.seed));

/** Contour sombre du chemin courant, plus fin que ink (détails : pattes, griffes, plaques). */
const fineInk = (ctx: Ctx, r: number, k = 0.6) => {
  ctx.strokeStyle = 'rgba(12,10,10,0.7)';
  ctx.lineWidth = Math.max(1, r * 0.11 * k);
  ctx.lineJoin = 'round';
  ctx.stroke();
};

/** Ellipse au bord dentelé (fourrure, cendre) : n pointes. */
const jagged = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, depth = 0.16) => {
  ctx.beginPath();
  for (let k = 0; k <= n * 2; k++) {
    const a = (k / (n * 2)) * TAU, d = k % 2 ? 1 - depth * 0.4 : 1 + depth;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
};

/** Point de lave incandescent : halo, cœur clair. */
const ember = (ctx: Ctx, x: number, y: number, rr: number, glow: number, flash: boolean) => {
  if (flash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.fill();
    return;
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, rr * 1.9);
  g.addColorStop(0, `rgba(255,236,170,${glow})`);
  g.addColorStop(0.35, `rgba(255,150,70,${glow})`);
  g.addColorStop(1, 'rgba(232,90,40,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rr * 1.9, 0, TAU);
  ctx.fill();
};

/** Œil qui luit (violet pour un Alpha) avec sa pupille, sourcil froncé chez le sauvage. slit : pupille fendue. */
const lavaEye = (ctx: Ctx, u: UnitLook, ex: number, ey: number, es: number, iris: string, slit: boolean) => {
  const c = u.alpha ? '#B48CFF' : iris;
  ctx.save();
  ctx.shadowColor = c;
  ctx.shadowBlur = es * 4;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(ex, ey, es * 1.2, es, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  if (slit) ctx.ellipse(ex + es * 0.15, ey, es * 0.22, es * 0.85, 0, 0, TAU);
  else ctx.arc(ex + es * 0.2, ey, es * 0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(ex - es * 0.35, ey - es * 0.35, es * 0.22, 0, TAU);
  ctx.fill();
  if (u.wild) {
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1.5, es * 0.7);
    ctx.beginPath();
    ctx.moveTo(ex - es * 1.6, ey - es * 1.9);
    ctx.lineTo(ex + es * 1.4, ey - es * 0.9);
    ctx.stroke();
  }
};

const SALAMANDER = { shade: '#3E2C27', dark: '#241916', belly: '#9A7460', light: '#7E5E50' };

/**
 * Salamandre de braise : long lézard au ras du sol. Queue effilée qui ondule (d'un seul tenant avec le corps), pattes
 * articulées à trois griffes qui trottinent (celles du fond plus sombres), écailles, ventre clair, une fissure de lave le
 * long de l'échine ponctuée de taches incandescentes, collerette épineuse, œil jaune fendu qui luit. La Salamandre-Mère
 * porte une crête de flammes vives d'où montent des braises.
 */
function salamander(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash;
  const skin = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : SALAMANDER.shade, dark = f ? '#FFFFFF' : SALAMANDER.dark;
  const glow = lavaPulse(u, 3), boss = !!SPECIES[u.species]?.boss;
  const wig = (k: number) => Math.sin(u.t * 6 + u.seed - k * 1.6) * 0.22 * r * k; // ondulation, plus forte vers le bout
  const step = Math.sin(u.t * 12 + u.seed);
  // queue : une bande effilée, de la croupe à la pointe
  const tail: [number, number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    tail.push([-0.55 * r - k * 1.35 * r, 0.12 * r - Math.sin(k * Math.PI) * 0.12 * r + wig(k), (0.24 - 0.21 * k) * r]);
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  tail.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y - w) : ctx.moveTo(x, y - w)));
  for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] + tail[i][2]);
  ctx.closePath();
  ctx.fill();
  fineInk(ctx, r, 0.8);
  // dessous de la queue dans l'ombre
  ctx.fillStyle = shade;
  ctx.beginPath();
  tail.forEach(([x, y, w], i) => (i ? ctx.lineTo(x, y + w * 0.2) : ctx.moveTo(x, y + w * 0.2)));
  for (let i = tail.length - 1; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] + tail[i][2] * 0.95);
  ctx.closePath();
  ctx.fill();
  // une patte : cuisse, jambe, trois griffes
  const leg = (hx: number, hy: number, sw: number, col: string) => {
    const kx = hx + sw * 0.12 * r, ky = hy + 0.18 * r, fx = hx + sw * 0.22 * r + 0.06 * r, fy = hy + 0.36 * r;
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.16 * r;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(kx - 0.08 * r, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.strokeStyle = f ? '#FFFFFF' : '#140E0C';
    ctx.lineWidth = Math.max(1, 0.045 * r);
    ctx.beginPath();
    for (const d of [-0.07, 0, 0.07]) {
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + 0.1 * r + d * r, fy + 0.04 * r + Math.abs(d) * r * 0.3);
    }
    ctx.stroke();
  };
  leg(0.42 * r, 0.12 * r, -step, dark);
  leg(-0.42 * r, 0.14 * r, step, dark);
  // corps, ventre clair, ombre, reflet d'échine
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(-0.05 * r, 0.06 * r, 0.82 * r, 0.38 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = SALAMANDER.belly;
    ctx.beginPath();
    ctx.ellipse(0.02 * r, 0.3 * r, 0.62 * r, 0.11 * r, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(-0.1 * r, 0.2 * r, 0.7 * r, 0.06 * r, 0, 0, TAU);
    ctx.fill();
    // écailles : de petits croissants sombres en quinconce
    ctx.strokeStyle = 'rgba(20,12,10,0.45)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const x = (-0.65 + i * 0.16) * r, y = (i % 2 ? 0.0 : 0.1) * r;
      ctx.moveTo(x - 0.05 * r, y);
      ctx.quadraticCurveTo(x, y + 0.05 * r, x + 0.05 * r, y);
    }
    ctx.stroke();
  }
  // fissure de lave le long de l'échine, et ses taches incandescentes (jusque sur la queue)
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(232,105,63,${0.8 * glow})`;
  ctx.lineWidth = Math.max(1.2, 0.05 * r);
  ctx.beginPath();
  ctx.moveTo(tail[6][0], tail[6][1] - tail[6][2] * 0.3);
  for (let i = 5; i >= 0; i--) ctx.lineTo(tail[i][0], tail[i][1] - tail[i][2] * 0.4);
  ctx.quadraticCurveTo(-0.2 * r, -0.36 * r, 0.5 * r, -0.22 * r);
  ctx.stroke();
  for (const [x, y, rr] of [[-0.45, -0.24, 0.09], [-0.15, -0.3, 0.11], [0.15, -0.28, 0.1], [0.42, -0.2, 0.07]]) ember(ctx, x * r, y * r, rr * r, glow, f);
  for (const i of [2, 4, 7]) ember(ctx, tail[i][0], tail[i][1] - tail[i][2] * 0.35, tail[i][2] * 0.4, glow, f);
  if (!f) ember(ctx, tail[10][0], tail[10][1], 0.07 * r, glow, false); // le bout de la queue rougeoie
  // pattes de devant
  leg(0.5 * r, 0.18 * r, step, skin);
  leg(-0.32 * r, 0.2 * r, -step, skin);
  // crête de flammes de la Mère
  if (boss) {
    for (let k = 0; k < 7; k++) {
      const x = (-0.7 + k * 0.22) * r, base = -0.28 * r - Math.sin((k / 6) * Math.PI) * 0.08 * r, h = (0.3 + 0.12 * Math.sin(u.t * 9 + k * 1.3)) * r;
      ctx.fillStyle = f ? '#FFFFFF' : '#C2401E';
      ctx.beginPath();
      ctx.moveTo(x - 0.1 * r, base + 0.04 * r);
      ctx.quadraticCurveTo(x - 0.06 * r, base - h * 0.6, x + Math.sin(u.t * 7 + k) * 0.04 * r, base - h);
      ctx.quadraticCurveTo(x + 0.08 * r, base - h * 0.5, x + 0.1 * r, base + 0.04 * r);
      ctx.closePath();
      ctx.fill();
      if (!f) {
        ctx.fillStyle = '#FFB25C';
        ctx.beginPath();
        ctx.moveTo(x - 0.05 * r, base);
        ctx.quadraticCurveTo(x - 0.02 * r, base - h * 0.45, x, base - h * 0.7);
        ctx.quadraticCurveTo(x + 0.04 * r, base - h * 0.4, x + 0.05 * r, base);
        ctx.closePath();
        ctx.fill();
      }
    }
    for (let k = 0; k < 4; k++) {
      const g = (u.t * 0.7 + k / 4) % 1;
      ctx.fillStyle = `rgba(255,190,100,${0.9 * (1 - g)})`;
      ctx.beginPath();
      ctx.arc((-0.5 + k * 0.3 + Math.sin(u.t * 3 + k) * 0.05) * r, (-0.6 - g * 0.6) * r, 0.035 * r, 0, TAU);
      ctx.fill();
    }
  }
  // cou et tête : un museau plat en coin, mâchoire, narine, collerette épineuse
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.55 * r, -0.26 * r);
  ctx.quadraticCurveTo(0.95 * r, -0.36 * r, 1.25 * r, -0.12 * r);
  ctx.quadraticCurveTo(1.42 * r, 0.0 * r, 1.3 * r, 0.08 * r);
  ctx.quadraticCurveTo(0.95 * r, 0.22 * r, 0.6 * r, 0.2 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(20,12,10,0.6)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    ctx.moveTo(0.9 * r, 0.06 * r);
    ctx.quadraticCurveTo(1.12 * r, 0.06 * r, 1.32 * r, 0.03 * r); // la bouche
    ctx.stroke();
    ctx.fillStyle = SALAMANDER.light;
    ctx.beginPath();
    ctx.ellipse(0.98 * r, -0.2 * r, 0.22 * r, 0.05 * r, -0.1, 0, TAU); // reflet du crâne
    ctx.fill();
  }
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(1.3 * r, -0.08 * r, 0.025 * r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = shade;
  for (const [sx, sy, a] of [[0.62, -0.28, -2.3], [0.66, -0.06, -2.9], [0.64, 0.14, 2.6]] as const) {
    ctx.beginPath();
    ctx.moveTo(sx * r, sy * r);
    ctx.lineTo(sx * r + Math.cos(a) * 0.2 * r, sy * r + Math.sin(a) * 0.2 * r);
    ctx.lineTo(sx * r + 0.05 * r, sy * r + 0.08 * r);
    ctx.closePath();
    ctx.fill();
  }
  lavaEye(ctx, u, 1.0 * r, -0.14 * r, 0.075 * r, '#FFD27A', true);
  // la langue fourchue, de temps en temps
  if (Math.sin(u.t * 2 + u.seed * 3) > 0.85) {
    ctx.strokeStyle = f ? '#FFFFFF' : '#E8693F';
    ctx.lineWidth = Math.max(1, 0.04 * r);
    ctx.beginPath();
    ctx.moveTo(1.32 * r, 0.04 * r);
    ctx.lineTo(1.55 * r, 0.03 * r);
    ctx.lineTo(1.64 * r, -0.04 * r);
    ctx.moveTo(1.55 * r, 0.03 * r);
    ctx.lineTo(1.64 * r, 0.09 * r);
    ctx.stroke();
  }
}

/**
 * Chauve-souris de cendre : ailes à doigts osseux, membrane plus sombre près du corps, trouée de brûlures dont le bord
 * rougeoie ; corps de fourrure en touffes, poitrail de cendre claire, grandes oreilles au creux rouge, feuille nasale,
 * gueule ouverte et crocs, yeux de braise, griffes des pieds ; elle sème des étincelles et des flocons de cendre.
 */
function ashBat(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, glow = lavaPulse(u, 4), boss = !!SPECIES[u.species]?.boss;
  const fur = f ? '#FFFFFF' : fill, shade = f ? '#FFFFFF' : '#2E292D', bone = f ? '#FFFFFF' : '#1E1A1E';
  const flap = Math.sin(u.t * 14 + u.seed);
  // étincelles et flocons de cendre qui tombent
  for (let k = 0; k < 6; k++) {
    const g = (u.t * 0.9 + k / 6 + u.seed * 0.13) % 1, x = (Math.sin(k * 2.7 + u.seed) * 0.7 - 0.15) * r, y = (0.55 + g * 1.4) * r;
    if (k % 2) {
      ctx.fillStyle = `rgba(255,170,80,${0.85 * (1 - g)})`;
      ctx.beginPath();
      ctx.arc(x, y, (0.065 - g * 0.04) * r, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(150,140,140,${0.6 * (1 - g)})`;
      ctx.fillRect(x, y, 0.06 * r, 0.03 * r);
    }
  }
  // ailes : le bras, trois doigts, la membrane festonnée entre eux
  for (const sd of [-1, 1]) {
    const lift = flap * 0.5 * r;
    const shoulder = [sd * 0.25 * r, -0.12 * r], elbow = [sd * 0.75 * r, -0.5 * r - lift * 0.5];
    const tips = [[sd * 1.6 * r, -0.55 * r - lift], [sd * 1.45 * r, 0.05 * r - lift * 0.5], [sd * 1.0 * r, 0.35 * r - lift * 0.2]];
    const hip = [sd * 0.3 * r, 0.3 * r];
    // membrane
    const mem = ctx.createLinearGradient(0, 0, sd * 1.6 * r, 0);
    mem.addColorStop(0, f ? '#FFFFFF' : '#1E1A1E');
    mem.addColorStop(1, f ? '#FFFFFF' : shade);
    ctx.fillStyle = mem;
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1]);
    ctx.lineTo(elbow[0], elbow[1]);
    ctx.lineTo(tips[0][0], tips[0][1]);
    const pts = [tips[0], tips[1], tips[2], hip];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      ctx.quadraticCurveTo((ax + bx) / 2 - sd * 0.1 * r, (ay + by) / 2 - 0.12 * r, bx, by); // feston vers l'intérieur
    }
    ctx.closePath();
    ctx.fill();
    fineInk(ctx, r, 0.9);
    // bord des festons qui rougeoie
    ctx.save();
    if (!f) {
      ctx.shadowColor = '#FF6A2A';
      ctx.shadowBlur = r * 0.4;
    }
    ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${0.8 * glow})`;
    ctx.lineWidth = Math.max(1.2, 0.06 * r);
    ctx.beginPath();
    ctx.moveTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      ctx.quadraticCurveTo((ax + bx) / 2 - sd * 0.1 * r, (ay + by) / 2 - 0.12 * r, bx, by);
    }
    ctx.stroke();
    ctx.restore();
    // trous de brûlure (le géant a les ailes en lambeaux)
    for (const [hx, hy, hr] of boss ? [[0.95, -0.15, 0.1], [1.25, -0.3, 0.07], [0.7, 0.05, 0.06]] : [[1.05, -0.2, 0.06]]) {
      const x = sd * hx * r, y = hy * r - lift * 0.5;
      ctx.fillStyle = f ? '#FFFFFF' : `rgba(255,150,70,${0.7 * glow})`;
      ctx.beginPath();
      ctx.arc(x, y, hr * r * 1.35, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,14,12,0.95)';
      ctx.beginPath();
      ctx.arc(x, y, hr * r, 0, TAU);
      ctx.fill();
    }
    // os du bras et des doigts, griffe du pouce
    ctx.strokeStyle = bone;
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.09 * r;
    ctx.beginPath();
    ctx.moveTo(shoulder[0], shoulder[1]);
    ctx.lineTo(elbow[0], elbow[1]);
    ctx.stroke();
    ctx.lineWidth = 0.045 * r;
    ctx.beginPath();
    for (const [tx, ty] of tips) {
      ctx.moveTo(elbow[0], elbow[1]);
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.fillStyle = f ? '#FFFFFF' : '#D8CFC0';
    ctx.beginPath();
    ctx.moveTo(elbow[0], elbow[1] - 0.02 * r);
    ctx.lineTo(elbow[0] + sd * 0.04 * r, elbow[1] - 0.16 * r);
    ctx.lineTo(elbow[0] + sd * 0.08 * r, elbow[1] - 0.02 * r);
    ctx.fill();
  }
  // griffes des pieds, repliées sous le corps
  ctx.strokeStyle = f ? '#FFFFFF' : '#D8CFC0';
  ctx.lineWidth = Math.max(1, 0.04 * r);
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    ctx.moveTo(sd * 0.14 * r, 0.48 * r);
    ctx.quadraticCurveTo(sd * 0.2 * r, 0.62 * r, sd * 0.1 * r, 0.64 * r);
  }
  ctx.stroke();
  // oreilles au creux rougeoyant
  for (const sd of [-1, 1]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(sd * 0.08 * r, -0.36 * r);
    ctx.quadraticCurveTo(sd * 0.2 * r, -0.95 * r, sd * 0.36 * r, -0.82 * r);
    ctx.quadraticCurveTo(sd * 0.4 * r, -0.5 * r, sd * 0.34 * r, -0.28 * r);
    ctx.closePath();
    ctx.fill();
    fineInk(ctx, r);
    if (!f) {
      ctx.fillStyle = `rgba(200,80,50,${0.6 + 0.3 * glow})`;
      ctx.beginPath();
      ctx.moveTo(sd * 0.15 * r, -0.4 * r);
      ctx.quadraticCurveTo(sd * 0.23 * r, -0.8 * r, sd * 0.31 * r, -0.72 * r);
      ctx.quadraticCurveTo(sd * 0.32 * r, -0.5 * r, sd * 0.28 * r, -0.36 * r);
      ctx.closePath();
      ctx.fill();
    }
  }
  // corps en touffes, poitrail clair, crinière de braises pour le géant
  ctx.fillStyle = fur;
  jagged(ctx, 0, 0.04 * r, 0.42 * r, 0.5 * r, 10);
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = 'rgba(176,166,166,0.5)';
    jagged(ctx, 0, 0.2 * r, 0.22 * r, 0.24 * r, 7, 0.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,16,18,0.4)';
    ctx.beginPath();
    ctx.ellipse(0.18 * r, 0.12 * r, 0.16 * r, 0.32 * r, 0.2, 0, TAU); // ombre du flanc
    ctx.fill();
  }
  if (boss) for (let k = 0; k < 6; k++) ember(ctx, Math.cos(-Math.PI + (k / 5) * Math.PI) * 0.4 * r, -0.3 * r + Math.sin(-Math.PI + (k / 5) * Math.PI) * 0.18 * r, 0.06 * r, glow, f);
  // yeux de braise, feuille nasale, gueule ouverte, crocs
  lavaEye(ctx, u, -0.15 * r, -0.14 * r, 0.075 * r, '#FF6A2A', false);
  lavaEye(ctx, u, 0.15 * r, -0.14 * r, 0.075 * r, '#FF6A2A', false);
  ctx.fillStyle = f ? '#FFFFFF' : '#5A4E52';
  ctx.beginPath();
  ctx.moveTo(-0.06 * r, -0.04 * r);
  ctx.lineTo(0, -0.14 * r);
  ctx.lineTo(0.06 * r, -0.04 * r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2A0E0C';
  ctx.beginPath();
  ctx.ellipse(0, 0.08 * r, 0.12 * r, 0.07 * r + Math.max(0, flap) * 0.02 * r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F2E8CF';
  ctx.beginPath();
  for (const sd of [-1, 1]) {
    ctx.moveTo(sd * 0.1 * r, 0.03 * r);
    ctx.lineTo(sd * 0.065 * r, 0.16 * r);
    ctx.lineTo(sd * 0.03 * r, 0.04 * r);
  }
  ctx.fill();
}

const TORTOISE = { skin: '#7A6452', skinDark: '#4E3E32', rim: '#2A221E', top: '#6A584C' };

/**
 * Tortue-volcan : pattes d'éléphant écailleuses à grosses griffes, tête à bec et cou ridé, carapace d'écailles de
 * basalte (chacune ombrée, plus claire en haut) jointes par des fissures de lave qui luisent, rebord d'écailles
 * marginales ; sur le dos, un petit volcan rocheux à arêtes, sa coulée, sa fumée. Quand elle charge son tir, le
 * cratère s'embrase et crache des étincelles.
 */
function lavaTortoise(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash;
  const shell = f ? '#FFFFFF' : fill, skin = f ? '#FFFFFF' : TORTOISE.skin, skinDark = f ? '#FFFFFF' : TORTOISE.skinDark, rim = f ? '#FFFFFF' : TORTOISE.rim;
  const charge = u.charge ?? 0, glow = Math.min(1, lavaPulse(u, 1.6) + charge * 0.6), step = Math.sin(u.t * 5 + u.seed) * 0.05 * r;
  // une patte trapue : écailles en travers, trois griffes
  const leg = (lx: number, ly: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(lx - 0.17 * r, ly, 0.34 * r, 0.38 * r, [0.1 * r, 0.1 * r, 0.06 * r, 0.06 * r]);
    ctx.fill();
    fineInk(ctx, r, 0.7);
    if (!f) {
      ctx.strokeStyle = 'rgba(20,14,10,0.4)';
      ctx.lineWidth = Math.max(1, 0.03 * r);
      ctx.beginPath();
      for (const k of [0.12, 0.22]) {
        ctx.moveTo(lx - 0.14 * r, ly + k * r);
        ctx.quadraticCurveTo(lx, ly + (k + 0.04) * r, lx + 0.14 * r, ly + k * r);
      }
      ctx.stroke();
    }
    ctx.fillStyle = f ? '#FFFFFF' : '#E3D6BC';
    for (const d of [-0.1, 0, 0.1]) {
      ctx.beginPath();
      ctx.ellipse(lx + d * r, ly + 0.38 * r, 0.045 * r, 0.035 * r, 0, 0, TAU);
      ctx.fill();
    }
  };
  leg(0.55 * r, 0.26 * r - step, skinDark);
  leg(-0.6 * r, 0.26 * r + step, skinDark);
  // cou ridé et tête à bec
  const hy = 0.12 * r + step * 0.5;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(0.7 * r, -0.02 * r);
  ctx.quadraticCurveTo(1.0 * r, hy - 0.22 * r, 1.25 * r, hy - 0.16 * r);
  ctx.quadraticCurveTo(1.46 * r, hy - 0.08 * r, 1.42 * r, hy + 0.06 * r);
  ctx.lineTo(1.3 * r, hy + 0.14 * r);
  ctx.quadraticCurveTo(1.0 * r, hy + 0.2 * r, 0.72 * r, 0.3 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(30,20,14,0.45)';
    ctx.lineWidth = Math.max(1, 0.03 * r);
    ctx.beginPath();
    for (const x of [0.82, 0.92]) {
      ctx.moveTo(x * r, hy - 0.1 * r);
      ctx.quadraticCurveTo((x + 0.04) * r, hy + 0.02 * r, x * r, hy + 0.14 * r);
    }
    ctx.moveTo(1.26 * r, hy + 0.04 * r);
    ctx.lineTo(1.42 * r, hy + 0.04 * r); // la fente du bec
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(1.15 * r, hy - 0.12 * r, 0.14 * r, 0.04 * r, -0.2, 0, TAU);
    ctx.fill();
  }
  lavaEye(ctx, u, 1.18 * r, hy - 0.06 * r, 0.06 * r, '#FF8A3D', false);
  // rebord de la carapace : écailles marginales
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(0, 0.3 * r, 1.02 * r, 0.25 * r, 0, 0, TAU);
  ctx.fill();
  fineInk(ctx, r);
  if (!f) {
    ctx.strokeStyle = 'rgba(70,58,50,0.9)';
    ctx.lineWidth = Math.max(1, 0.035 * r);
    ctx.beginPath();
    for (let k = -4; k <= 4; k++) {
      const x = k * 0.22 * r;
      ctx.moveTo(x, 0.34 * r);
      ctx.lineTo(x * 1.04, 0.52 * r);
    }
    ctx.stroke();
  }
  // dôme : chaque écaille, plus claire en haut ; les fissures de lave entre elles
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.ellipse(0, 0.28 * r, 0.92 * r, 0.82 * r, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  const plates: [number, number][][] = [
    [[-0.88, 0.2], [-0.82, -0.12], [-0.5, -0.06], [-0.45, 0.24]],
    [[-0.82, -0.12], [-0.6, -0.42], [-0.32, -0.36], [-0.5, -0.06]],
    [[-0.45, 0.24], [-0.5, -0.06], [0.0, 0.02], [0.02, 0.26]],
    [[-0.5, -0.06], [-0.32, -0.36], [0.32, -0.36], [0.5, -0.06], [0.0, 0.02]],
    [[0.02, 0.26], [0.0, 0.02], [0.5, -0.06], [0.45, 0.24]],
    [[0.5, -0.06], [0.32, -0.36], [0.6, -0.42], [0.82, -0.12]],
    [[0.45, 0.24], [0.5, -0.06], [0.82, -0.12], [0.88, 0.2]],
  ];
  for (const [i, p] of plates.entries()) {
    const cy = p.reduce((a, q) => a + q[1], 0) / p.length;
    ctx.fillStyle = f ? '#FFFFFF' : cy < -0.15 ? TORTOISE.top : i % 2 ? shell : '#45382F';
    ctx.beginPath();
    p.forEach(([x, y], k) => (k ? ctx.lineTo(x * r * 0.92, y * r) : ctx.moveTo(x * r * 0.92, y * r)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  if (!f) {
    ctx.shadowColor = '#FF6A2A';
    ctx.shadowBlur = r * 0.35 * glow;
  }
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${glow})`;
  ctx.lineWidth = Math.max(1.5, 0.06 * r);
  ctx.lineJoin = 'round';
  for (const p of plates) {
    ctx.beginPath();
    p.forEach(([x, y], k) => (k ? ctx.lineTo(x * r * 0.92, y * r) : ctx.moveTo(x * r * 0.92, y * r)));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  // le petit volcan du dos : flancs rocheux à arêtes, cratère, coulée
  const vy = -0.4 * r;
  ctx.fillStyle = f ? '#FFFFFF' : '#2E2420';
  ctx.beginPath();
  ctx.moveTo(-0.4 * r, vy + 0.04 * r);
  ctx.lineTo(-0.2 * r, vy - 0.48 * r);
  ctx.quadraticCurveTo(0, vy - 0.56 * r, 0.2 * r, vy - 0.48 * r);
  ctx.lineTo(0.4 * r, vy + 0.04 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = '#463830';
    ctx.beginPath();
    ctx.moveTo(-0.38 * r, vy + 0.03 * r);
    ctx.lineTo(-0.19 * r, vy - 0.47 * r);
    ctx.lineTo(-0.08 * r, vy - 0.5 * r);
    ctx.lineTo(-0.16 * r, vy + 0.03 * r);
    ctx.closePath();
    ctx.fill(); // flanc éclairé
    ctx.strokeStyle = 'rgba(16,10,8,0.55)';
    ctx.lineWidth = Math.max(1, 0.03 * r);
    ctx.beginPath();
    for (const x of [-0.25, 0.05, 0.25]) {
      ctx.moveTo(x * 0.5 * r, vy - 0.48 * r);
      ctx.lineTo(x * r, vy + 0.02 * r);
    }
    ctx.stroke();
  }
  // coulée qui descend le flanc
  ctx.strokeStyle = f ? '#FFFFFF' : `rgba(255,138,61,${glow})`;
  ctx.lineWidth = Math.max(1.2, 0.07 * r);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.06 * r, vy - 0.48 * r);
  ctx.quadraticCurveTo(0.16 * r, vy - 0.3 * r, 0.12 * r, vy - 0.12 * r);
  ctx.quadraticCurveTo(0.1 * r, vy, 0.24 * r, vy + 0.06 * r);
  ctx.stroke();
  // cratère : plus il charge, plus il brille
  const cg = ctx.createRadialGradient(0, vy - 0.5 * r, 0, 0, vy - 0.5 * r, (0.2 + charge * 0.25) * r);
  cg.addColorStop(0, f ? '#FFFFFF' : `rgba(255,240,180,${glow})`);
  cg.addColorStop(0.5, f ? '#FFFFFF' : `rgba(255,140,60,${glow})`);
  cg.addColorStop(1, 'rgba(232,90,40,0)');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, vy - 0.5 * r, (0.2 + charge * 0.25) * r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = f ? '#FFFFFF' : '#1A120E';
  ctx.beginPath();
  ctx.ellipse(0, vy - 0.5 * r, 0.16 * r, 0.05 * r, 0, Math.PI, 0);
  ctx.fill();
  // fumée, et des étincelles quand le tir se prépare
  for (let k = 0; k < 3; k++) {
    const g = (u.t * (0.5 + charge) + k / 3 + u.seed * 0.1) % 1;
    ctx.fillStyle = `rgba(90,84,80,${0.5 * (1 - g)})`;
    ctx.beginPath();
    ctx.arc(Math.sin(k * 2 + u.t) * 0.08 * r + g * 0.15 * r, vy - (0.6 + g * 0.7) * r, (0.08 + g * 0.14) * r, 0, TAU);
    ctx.fill();
  }
  if (charge > 0) {
    for (let k = 0; k < 5; k++) {
      const g = (u.t * 2.2 + k / 5) % 1, a = -Math.PI / 2 + (k - 2) * 0.35;
      ctx.fillStyle = `rgba(255,210,120,${1 - g})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * g * 0.6 * r, vy - 0.5 * r + Math.sin(a) * g * 0.6 * r, 0.04 * r, 0, TAU);
      ctx.fill();
    }
  }
  // pattes de devant
  leg(0.65 * r, 0.34 * r + step, skin);
  leg(-0.5 * r, 0.34 * r - step, skin);
}

// ───────────────────────── Haute mer ─────────────────────────

/** Un tentacule : une bande effilée le long d'une courbe (base → pointe), ventouses claires sur son bord intérieur. */
function tentacleStroke(ctx: Ctx, pts: [number, number][], w0: number, w1: number, col: string, sucker: string, flash: boolean) {
  const n = pts.length - 1, left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = pts[i], [px, py] = pts[Math.max(0, i - 1)], [nx, ny] = pts[Math.min(n, i + 1)];
    const dx = nx - px, dy = ny - py, l = Math.hypot(dx, dy) || 1, w = w0 + (w1 - w0) * (i / n);
    left.push([x - (dy / l) * w, y + (dx / l) * w]);
    right.push([x + (dy / l) * w, y - (dx / l) * w]);
  }
  ctx.fillStyle = flash ? '#FFFFFF' : col;
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = n; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,24,0.75)';
  ctx.lineWidth = Math.max(1.2, w0 * 0.18);
  ctx.lineJoin = 'round';
  ctx.stroke();
  if (flash) return;
  ctx.fillStyle = sucker;
  for (let i = 1; i < n; i += 1) {
    const [x, y] = left[i], rr = (w0 + (w1 - w0) * (i / n)) * 0.42;
    const [cx, cy] = pts[i];
    ctx.beginPath();
    ctx.arc(x + (cx - x) * 0.35, y + (cy - y) * 0.35, rr, 0, TAU);
    ctx.fill();
  }
}

const KRAKEN = { dark: '#3E2350', light: '#9A6AAE', spot: '#4A2A5E', sucker: '#E8C8D8', eye: '#F0D060' };

/**
 * Le Kraken : une tête immense qui émerge de la mer contre le bateau, manteau violet tacheté (plus clair à la lumière),
 * deux yeux jaunes à pupille fendue, un bec ; six tentacules à ventouses sortent de l'eau autour de lui et ondulent,
 * et l'eau bouillonne à sa base.
 */
function kraken(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const f = u.flash, body = f ? '#FFFFFF' : fill;
  // tentacules du fond
  const arm = (k: number, front: boolean) => {
    const side = k % 2 ? 1 : -1, base = (0.35 + Math.floor(k / 2) * 0.32) * side;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8, wave = Math.sin(u.t * 2.2 + k * 1.3 - s * 3) * 0.35 * s;
      pts.push([(base + side * (0.35 + 0.55 * s) + wave * 0.6) * r, (0.55 - s * (front ? 1.1 : 1.6) + Math.abs(wave) * 0.4) * r]);
    }
    tentacleStroke(ctx, pts, 0.16 * r, 0.03 * r, front ? body : KRAKEN.dark, KRAKEN.sucker, f);
  };
  for (const k of [2, 3, 4, 5]) arm(k, false);
  // eau qui bouillonne à sa base
  if (!f) {
    ctx.fillStyle = 'rgba(20,50,80,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 1.25 * r, 0.3 * r, 0, 0, TAU);
    ctx.fill();
  }
  // manteau (la tête), taches, reflet
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-0.62 * r, 0.6 * r);
  ctx.bezierCurveTo(-0.95 * r, -0.2 * r, -0.6 * r, -1.35 * r, 0, -1.35 * r);
  ctx.bezierCurveTo(0.6 * r, -1.35 * r, 0.95 * r, -0.2 * r, 0.62 * r, 0.6 * r);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  if (!f) {
    ctx.fillStyle = 'rgba(30,14,40,0.3)';
    ctx.beginPath();
    ctx.ellipse(0.32 * r, -0.4 * r, 0.32 * r, 0.8 * r, 0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = KRAKEN.light;
    ctx.beginPath();
    ctx.ellipse(-0.3 * r, -0.85 * r, 0.16 * r, 0.32 * r, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = KRAKEN.spot;
    for (const [x, y, s] of [[-0.35, -0.4, 0.09], [0.1, -0.95, 0.07], [0.35, -0.65, 0.08], [-0.1, -0.2, 0.06], [0.42, -0.1, 0.06], [-0.48, -0.05, 0.05]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
    }
  }
  // yeux jaunes à pupille fendue, paupière lourde, bec
  for (const sd of [-1, 1]) {
    const ex = sd * 0.34 * r, ey = 0.02 * r, es = 0.17 * r;
    ctx.fillStyle = f ? '#FFFFFF' : KRAKEN.dark;
    ctx.beginPath();
    ctx.ellipse(ex, ey, es * 1.3, es * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.save();
    if (!f) {
      ctx.shadowColor = u.alpha ? '#B48CFF' : KRAKEN.eye;
      ctx.shadowBlur = es;
    }
    ctx.fillStyle = u.alpha ? '#B48CFF' : KRAKEN.eye;
    ctx.beginPath();
    ctx.ellipse(ex, ey, es, es * 0.85, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.ellipse(ex, ey, es * 0.2, es * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body; // paupière
    ctx.beginPath();
    ctx.ellipse(ex, ey - es * 0.55, es * 1.1, es * 0.45, sd * 0.25, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = f ? '#FFFFFF' : '#2A1A14';
  ctx.beginPath();
  ctx.moveTo(-0.1 * r, 0.3 * r);
  ctx.lineTo(0, 0.48 * r);
  ctx.lineTo(0.1 * r, 0.3 * r);
  ctx.closePath();
  ctx.fill();
  // tentacules de devant
  for (const k of [0, 1]) arm(k, true);
  // écume tout autour
  if (!f) {
    ctx.strokeStyle = 'rgba(230,248,255,0.7)';
    ctx.lineWidth = Math.max(2, 0.04 * r);
    ctx.setLineDash([0.12 * r, 0.08 * r]);
    ctx.lineDashOffset = -u.t * 30;
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 1.25 * r, 0.3 * r, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Tentacule du Kraken accroché au pont : il sort de la mer par-dessus le bastingage et se balance, ventouses en dedans. */
function krakenTentacle(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 9; i++) {
    const s = i / 9, sway = Math.sin(u.t * 2.6 + u.seed - s * 2.5) * 0.45 * s;
    // il monte, puis la pointe s'enroule
    const curl = s > 0.7 ? (s - 0.7) / 0.3 : 0;
    pts.push([(sway + Math.sin(curl * 2.4) * 0.5) * r, (0.6 - s * 2.1 + (1 - Math.cos(curl * 2.4)) * 0.3) * r]);
  }
  if (!u.flash) {
    // éclats de bois et eau à l'endroit où il s'agrippe
    ctx.fillStyle = 'rgba(200,235,250,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0.62 * r, 0.75 * r, 0.22 * r, 0, 0, TAU);
    ctx.fill();
  }
  tentacleStroke(ctx, pts, 0.36 * r, 0.07 * r, u.flash ? '#FFFFFF' : fill, KRAKEN.sucker, u.flash);
}

const DRAWERS: Record<string, (ctx: Ctx, r: number, fill: string, u: UnitLook) => void> = {
  slime, wolf, boar, golem, treant,
  sporelin, spider, bear, wisp,
  watcher, toad, serpent, crab,
  hare, snail, firefly,
  meerkat, sandworm, vulture, jackal,
  salamander, ash_bat: ashBat, lava_tortoise: lavaTortoise,
  kraken, kraken_tentacle: krakenTentacle,
};

// ───────────────────────── Buissons à fruits ─────────────────────────

/** Buisson rond ; garni, il porte des baies rouges (le gibier vient les manger, elles repoussent). */
export function drawBush(ctx: Ctx, x: number, y: number, fruit: boolean, seed: number, zone: number) {
  if (zone === 6) return drawPricklyPear(ctx, x, y, fruit, seed);
  const dark = zone >= 4 ? '#24423E' : '#2D4A2A', mid = zone >= 4 ? '#33584F' : '#3C6236', light = zone >= 4 ? '#467468' : '#4F7C45';
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 6, 26, 9, 0, 0, TAU);
  ctx.fill();
  for (const [dx, dy, rr, c] of [[-12, -6, 14, dark], [12, -6, 14, dark], [0, -12, 16, mid], [-6, -4, 11, mid], [8, -15, 8, light]] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, rr, 0, TAU);
    ctx.fill();
  }
  if (!fruit) return;
  for (let i = 0; i < 6; i++) {
    const a = ((seed * 7 + i * 2.3) % TAU), d = 6 + ((seed + i * 5) % 9);
    const bx = x + Math.cos(a) * d * 1.3, by = y - 10 + Math.sin(a) * d * 0.8;
    ctx.fillStyle = '#C8323C';
    ctx.beginPath();
    ctx.arc(bx, by, 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,220,0.8)';
    ctx.beginPath();
    ctx.arc(bx - 1, by - 1, 1, 0, TAU);
    ctx.fill();
  }
}

/** Figuier de Barbarie (Mer de sable) : raquettes épineuses, figues roses quand il est garni. */
function drawPricklyPear(ctx: Ctx, x: number, y: number, fruit: boolean, seed: number) {
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 6, 24, 8, 0, 0, TAU);
  ctx.fill();
  const pads: [number, number, number, number, number][] = [[-10, -8, 9, 13, -0.4], [10, -9, 9, 13, 0.35], [0, -20, 10, 14, 0], [-14, -24, 7, 10, -0.6], [13, -27, 7, 10, 0.5]];
  for (const [dx, dy, rx, ry, rot] of pads) {
    ctx.fillStyle = '#4E7A3E';
    ctx.beginPath();
    ctx.ellipse(x + dx, y + dy, rx, ry, rot, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,18,14,0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(240,235,200,0.75)'; // épines
    for (let k = 0; k < 3; k++) ctx.fillRect(x + dx + (k - 1) * rx * 0.45, y + dy - ry * 0.2 + (k % 2) * ry * 0.4, 1.2, 1.2);
  }
  if (!fruit) return;
  for (let i = 0; i < 5; i++) {
    const [dx, dy, , ry] = pads[(seed + i) % pads.length];
    ctx.fillStyle = '#D9446A';
    ctx.beginPath();
    ctx.ellipse(x + dx + ((i % 3) - 1) * 4, y + dy - ry + 1, 3, 3.8, 0, 0, TAU);
    ctx.fill();
  }
}

// ───────────────────────── Filons d'or ─────────────────────────

/** Filon d'or : rocher veiné d'or qui scintille (épuisé, il a disparu : rien à dessiner). Bois mort et rochers : voir plus bas. */
export function drawOre(ctx: Ctx, x: number, y: number, zone: number, hpPct: number, t: number, seed: number, res: Resource = 'gold') {
  if (hpPct <= 0) return;
  if (res === 'wood') return drawDeadwood(ctx, x, y, zone, hpPct, t, seed);
  const r = 18 + zone * 3;
  // ombre posée sous la base du rocher (pas décollée : il ne doit pas avoir l'air de voler)
  ctx.fillStyle = 'rgba(8, 14, 12, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + r * 0.45, r * 1.05, r * 0.3, 0, 0, TAU);
  ctx.fill();
  const shake = hpPct < 100 ? Math.sin(t * 40 + seed) * 0.6 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  if (res === 'stone') {
    // rocher à casser : bloc à trois faces, coussin de mousse sur le dessus, une fissure, des cailloux autour
    facetRock(ctx, r, '#A3A9A3', '#828882', '#626863');
    ctx.fillStyle = '#5E8A4E';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.55, r * 0.35, r * 0.16, -0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#76A35E';
    ctx.beginPath();
    ctx.ellipse(-r * 0.27, -r * 0.6, r * 0.2, r * 0.08, -0.25, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,46,42,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, r * 0.3);
    ctx.lineTo(-r * 0.25, r * 0.05);
    ctx.lineTo(-r * 0.3, -r * 0.05);
    ctx.stroke();
    ctx.fillStyle = '#8A908A';
    for (const [nx, ny, nr] of [[-1.05, 0.5, 0.12], [0.95, 0.5, 0.1], [0.6, 0.65, 0.08]] as const) {
      ctx.beginPath();
      ctx.ellipse(nx * r, ny * r, nr * r * 1.3, nr * r, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (hpPct < 100) hpBar(ctx, x, y - r - 10, 28, hpPct, '#B9C2BC');
    return;
  }
  // filon d'or : bloc gris d'où jaillissent des cristaux dorés, dans un léger halo qui pulse
  ctx.fillStyle = `rgba(247,199,102,${0.14 + 0.06 * Math.sin(t * 2 + seed)})`;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.45, r * 0.85, r * 0.65, 0, 0, TAU);
  ctx.fill();
  facetRock(ctx, r, '#8F958F', '#727873', '#575D58');
  const crystal = (bx: number, by: number, h: number, w: number, a: number) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(a);
    fillPoly(ctx, [[-w, 0], [-w * 0.7, -h * 0.75], [0, -h], [0, 0]], '#F7C766'); // face éclairée
    fillPoly(ctx, [[0, 0], [0, -h], [w * 0.7, -h * 0.75], [w, 0]], '#C9922F'); // face à l'ombre
    ctx.restore();
  };
  crystal(-r * 0.3, -r * 0.35, r * 0.75, r * 0.16, -0.35);
  crystal(r * 0.05, -r * 0.45, r, r * 0.2, 0.05);
  crystal(r * 0.35, -r * 0.3, r * 0.6, r * 0.14, 0.45);
  crystal(-r * 0.6, r * 0.05, r * 0.4, r * 0.11, -0.7);
  // éclat qui scintille à la pointe du grand cristal
  const tw = (Math.sin(t * 3 + seed) + 1) / 2;
  if (tw > 0.6) {
    const k = (tw - 0.6) * 2.5, sx = r * 0.05, sy = -r * 1.2;
    ctx.strokeStyle = `rgba(255,244,210,${k})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx - 5 * k, sy);
    ctx.lineTo(sx + 5 * k, sy);
    ctx.moveTo(sx, sy - 5 * k);
    ctx.lineTo(sx, sy + 5 * k);
    ctx.stroke();
  }
  ctx.restore();
  if (hpPct < 100) hpBar(ctx, x, y - r * 1.3 - 10, 28, hpPct, '#F0B64A');
}

function fillPoly(ctx: Ctx, pts: readonly (readonly [number, number] | number[])[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

/** Rocher à trois faces : le dessus clair, la face avant moyenne, le flanc droit sombre (lumière en haut à gauche). */
function facetRock(ctx: Ctx, r: number, light: string, mid: string, dark: string) {
  fillPoly(ctx, [[-r, r * 0.4], [-r * 0.85, -r * 0.2], [-r * 0.45, -r * 0.05], [r * 0.15, -r * 0.15], [r * 0.45, r * 0.55]], mid);
  fillPoly(ctx, [[r * 0.15, -r * 0.15], [r * 0.4, -r * 0.7], [r, -r * 0.05], [r * 0.85, r * 0.45], [r * 0.45, r * 0.55]], dark);
  fillPoly(ctx, [[-r * 0.85, -r * 0.2], [-r * 0.35, -r * 0.8], [r * 0.4, -r * 0.7], [r * 0.15, -r * 0.15], [-r * 0.45, -r * 0.05]], light);
}

// ───────────────────────── Coffre des géants ─────────────────────────

/** Coffre royal : bois rouge, coins et cerclages dorés, gemme sur la serrure. lid : 0 fermé → 1 grand ouvert ; drop : hauteur de chute. */
/**
 * Épée plantée dans le sable, pointe en bas. out : part déjà sortie (0 : enfoncée jusqu'à la garde, 1 : presque libre) ;
 * wiggle : secousse du dernier coup (1 juste après, puis 0). Un éclat passe sur la lame de temps en temps.
 */
export function drawPlantedSword(ctx: Ctx, x: number, y: number, out: number, t: number, wiggle = 0) {
  const show = 10 + out * 26; // longueur de lame visible au-dessus du sable
  // sable soulevé autour de la lame
  ctx.fillStyle = 'rgba(8,14,12,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 2, 17, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#D9C391';
  ctx.beginPath();
  ctx.ellipse(x, y, 15, 5.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,96,64,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y - 0.5, 4.5 + out * 2, 2, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.12 + Math.sin(t * 38) * 0.16 * wiggle);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(12,18,16,0.85)';
  ctx.lineWidth = 1.5;
  // lame (vers le bas, enfoncée dans le sable)
  ctx.fillStyle = '#D4DAE0';
  ctx.beginPath();
  ctx.moveTo(-3.2, -show);
  ctx.lineTo(3.2, -show);
  ctx.lineTo(2.6, 0);
  ctx.lineTo(-2.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,100,110,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -show + 2);
  ctx.lineTo(0, -1);
  ctx.stroke();
  // garde, poignée, pommeau
  const g = -show;
  ctx.strokeStyle = 'rgba(12,18,16,0.85)';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#B8863B';
  ctx.beginPath();
  ctx.moveTo(-10, g - 1);
  ctx.quadraticCurveTo(0, g - 5, 10, g - 1);
  ctx.lineTo(10, g + 2);
  ctx.quadraticCurveTo(0, g - 1, -10, g + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(-2.5, g - 13, 5, 10);
  ctx.strokeRect(-2.5, g - 13, 5, 10);
  ctx.strokeStyle = 'rgba(255,230,190,0.35)';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    ctx.moveTo(-2.5, g - 11 + k * 3);
    ctx.lineTo(2.5, g - 9 + k * 3);
  }
  ctx.stroke();
  ctx.fillStyle = '#E0B24E';
  ctx.strokeStyle = 'rgba(12,18,16,0.85)';
  ctx.beginPath();
  ctx.arc(0, g - 15, 3.5, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // éclat qui file le long de la lame (toutes les 2,5 s) : ça brille, il faut aller voir
  const k = (t % 2.5) / 0.5;
  if (k < 1) {
    const sy = g + 2 + k * (show - 4), a = Math.sin(k * Math.PI);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.beginPath();
    ctx.moveTo(0, sy - 6);
    ctx.lineTo(1.4, sy);
    ctx.lineTo(0, sy + 6);
    ctx.lineTo(-1.4, sy);
    ctx.closePath();
    ctx.moveTo(-5, sy);
    ctx.lineTo(0, sy - 1.2);
    ctx.lineTo(5, sy);
    ctx.lineTo(0, sy + 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Parchemin laissé par un géant au fond de sa grotte : un rouleau de papier jauni noué d'un ruban rouge, qui flotte
 * un peu au-dessus du sol dans une lueur dorée (il faut le remarquer).
 */
export function drawScroll(ctx: Ctx, x: number, y: number, t: number, seed: number) {
  const bob = Math.sin(t * 2 + seed) * 2.5, glow = 0.14 + 0.08 * Math.sin(t * 3 + seed);
  ctx.fillStyle = 'rgba(8,14,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 15, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(247,214,140,${glow})`;
  ctx.beginPath();
  ctx.arc(x, y - 10 + bob, 19, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 10 + bob);
  ctx.rotate(-0.25);
  // papier déroulé un peu au milieu, rouleaux aux deux bouts
  ctx.fillStyle = '#EADBB4';
  ctx.fillRect(-12, -7, 24, 14);
  ctx.fillStyle = 'rgba(150,120,80,0.45)'; // lignes d'écriture
  for (const ly of [-3, 0, 3]) ctx.fillRect(-8, ly - 0.6, 16 - (ly === 3 ? 6 : 0), 1.2);
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#D9C69A';
    ctx.beginPath();
    ctx.ellipse(sx * 13, 0, 3.5, 8.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#B9A274';
    ctx.beginPath();
    ctx.ellipse(sx * 13 + sx * 1.5, 0, 1.6, 6.5, 0, 0, TAU);
    ctx.fill();
  }
  // ruban rouge et son sceau
  ctx.fillStyle = '#B8323C';
  ctx.fillRect(-2, -8, 4, 16);
  ctx.beginPath();
  ctx.moveTo(-1, 7);
  ctx.lineTo(-5, 13);
  ctx.lineTo(-1, 11);
  ctx.moveTo(1, 7);
  ctx.lineTo(5, 13);
  ctx.lineTo(1, 11);
  ctx.fill();
  ctx.fillStyle = '#8E1F28';
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Œuf de dompteur pas encore éclos, au village : il tremble par à-coups, de petites fissures sur la coquille. */
export function drawWholeEgg(ctx: Ctx, x: number, y: number, t: number, seed: number) {
  const k = (t * 0.8 + seed * 0.37) % 3, shake = k < 0.5 ? Math.sin(k * 40) * 0.12 * (1 - k * 2) : 0; // un frisson toutes les 3 s
  ctx.fillStyle = 'rgba(8,14,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 2, 12, 4.5, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(shake);
  ctx.fillStyle = '#F1E7D0';
  ctx.beginPath();
  ctx.ellipse(0, -13, 11, 14, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#CDBE9E'; // flanc à l'ombre
  ctx.beginPath();
  ctx.ellipse(4, -11, 6, 11, 0, -1.2, 1.6);
  ctx.fill();
  ctx.fillStyle = '#9FB58A';
  for (const [px, py, r] of [[-5, -18, 2], [2, -8, 1.6], [-3, -5, 1.3], [5, -20, 1.2]] as const) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(90,75,50,0.7)'; // fissures
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -22);
  ctx.lineTo(-3, -19);
  ctx.lineTo(-5, -16);
  ctx.lineTo(-1, -14);
  ctx.moveTo(3, -24);
  ctx.lineTo(5, -21);
  ctx.stroke();
  ctx.restore();
}

/**
 * Nouveau-né sorti d'un œuf du village : un dompteur comme nous (une boule de sa couleur), un bout de coquille encore
 * sur la tête, à côté des restes de son œuf. Il regarde vers (lx, ly).
 */
export function drawHatchling(ctx: Ctx, x: number, y: number, color: string, t: number, lx = 0, ly = 1, name = '') {
  const r = 16, cy = y - Math.abs(Math.sin(t * 1.3 + x)) * 1.2;
  drawBrokenEgg(ctx, x + 26, y + 6);
  shadow(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,24,26,0.22)';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.fill();
  const ex = x + lx * 5, ey = cy + ly * 4 - 2;
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(ex - 4.5, ey, 2.4, 0, TAU);
  ctx.arc(ex + 4.5, ey, 2.4, 0, TAU);
  ctx.fill();
  // bout de coquille posé de travers sur la tête, bord en dents de scie
  ctx.save();
  ctx.translate(x - 2, cy - r + 3);
  ctx.rotate(-0.25);
  ctx.fillStyle = '#F1E7D0';
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.quadraticCurveTo(-9, -9, 0, -10);
  ctx.quadraticCurveTo(9, -9, 10, 2);
  for (const [px, py] of [[7, -1], [4, 3], [1, -1], [-2, 3], [-5, -1], [-8, 3]]) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9FB58A';
  ctx.beginPath();
  ctx.arc(-3, -5, 1.6, 0, TAU);
  ctx.arc(4, -6, 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (!name) return;
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText(name, x, cy - r - 14);
  ctx.fillStyle = '#EEE7D7';
  ctx.fillText(name, x, cy - r - 14);
}

/** Œuf brisé, posé dans le sable : le bas de la coquille aux bords en dents de scie, et des éclats autour. */
export function drawBrokenEgg(ctx: Ctx, x: number, y: number) {
  const shell = '#F1E7D0', shade = '#CDBE9E', spot = '#9FB58A';
  // éclats de coquille éparpillés
  for (const [dx, dy, a, s] of [[-22, 6, 0.6, 1], [19, 9, -0.9, 0.8], [-12, 14, 2.1, 0.7], [27, -3, 1.3, 0.6], [6, 16, -2.4, 0.9]]) {
    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.rotate(a);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(8,14,12,0.2)';
    ctx.beginPath();
    ctx.moveTo(-5, 2);
    ctx.lineTo(1, -3);
    ctx.lineTo(6, 1);
    ctx.lineTo(1, 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, -5);
    ctx.lineTo(6, -1);
    ctx.lineTo(2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = spot;
    ctx.beginPath();
    ctx.arc(0, -1, 1.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // ombre, puis le bas de l'œuf, ouvert sur le dessus
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 10, 15, 5, 0, 0, TAU);
  ctx.fill();
  const rim = [[-13, -2], [-9, -9], [-5, -3], [-1, -11], [3, -4], [7, -10], [10, -3], [13, -6]];
  ctx.fillStyle = shell;
  ctx.strokeStyle = 'rgba(70,60,40,0.7)';
  ctx.lineWidth = 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.bezierCurveTo(-15, 8, -8, 13, 0, 13);
  ctx.bezierCurveTo(8, 13, 15, 8, 13, -6);
  for (let i = rim.length - 1; i >= 0; i--) ctx.lineTo(rim[i][0], rim[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // intérieur sombre de la coquille, vu par l'ouverture
  ctx.fillStyle = '#6E6450';
  ctx.beginPath();
  ctx.moveTo(-11, -2);
  for (const [px, py] of rim.slice(1, -1)) ctx.lineTo(px * 0.85, py * 0.55 + 1);
  ctx.lineTo(11, -4);
  ctx.quadraticCurveTo(0, 3, -11, -2);
  ctx.fill();
  // ombre du flanc et taches
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(4, 12.5);
  ctx.bezierCurveTo(10, 11, 14, 6, 13, -2);
  ctx.bezierCurveTo(11, 6, 8, 10, 4, 12.5);
  ctx.fill();
  ctx.fillStyle = spot;
  for (const [px, py, r] of [[-7, 4, 2], [-2, 8, 1.4], [5, 3, 1.7], [-9, -3, 1.1]]) {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function drawChest(ctx: Ctx, x: number, y: number, lid: number, t: number, drop = 0) {
  const sk = 1 - Math.min(0.5, drop / 160); // l'ombre rétrécit pendant la chute
  ctx.fillStyle = 'rgba(8, 14, 12, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 30 * sk, 8 * sk, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - drop);
  const w = 50, h = 24, open = lid > 0;
  const box = (bx: number, by: number, bw: number, bh: number, r: number, fill: string, line = true) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();
    if (line) ink(ctx, 18);
  };
  const coin = (cx: number, cy: number) => {
    ctx.fillStyle = '#C98A2A';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 0.8, 3.2, 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#FFD86A';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 3.2, 2.4, 0, 0, TAU);
    ctx.fill();
  };
  const glow = (gy: number, r: number, rgb: string, a: number) => {
    const g = ctx.createRadialGradient(0, gy, 2, 0, gy, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, gy, r, 0, TAU);
    ctx.fill();
  };
  const sparkle = (sx: number, sy: number, r: number) => {
    ctx.fillStyle = '#FFF3C4';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, d = i % 2 ? r * 0.3 : r;
      ctx.lineTo(sx + Math.cos(a) * d, sy + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  };
  // halo doré qui pulse tant qu'il est fermé : il attire l'œil
  if (lid < 1) glow(-24, 62, '240,182,74', (0.22 + Math.sin(t * 4) * 0.06) * (1 - lid));
  if (open) {
    // couvercle relevé derrière (sa face intérieure), qui se redresse pendant l'ouverture
    const lh = 22 * lid;
    box(-w / 2, -h - 14 - lh, w, lh, Math.min(5, lh / 2), '#5A1E1E');
    if (lh > 10) box(-w / 2 + 4, -h - 10 - lh, w - 8, lh - 7, 3, '#7E2A2A', false);
    ctx.fillStyle = '#F0B64A';
    ctx.fillRect(-w / 2, -h - 14 - lh, 5, lh);
    ctx.fillRect(w / 2 - 5, -h - 14 - lh, 5, lh);
    // ouverture : velours sombre rempli d'or, et la gemme
    box(-w / 2, -h - 14, w, 16, 3, '#3A1414');
    glow(-h - 8, 40, '255,214,110', 0.55 * lid);
    for (const [cx, cy] of [[-14, -7], [-6, -10], [3, -8], [12, -6], [-9, -3], [8, -3], [0, -4]]) coin(cx, -h + cy);
    ctx.fillStyle = '#5CC8E8';
    ctx.beginPath();
    ctx.moveTo(-1, -h - 15);
    ctx.lineTo(4, -h - 11);
    ctx.lineTo(-1, -h - 7);
    ctx.lineTo(-6, -h - 11);
    ctx.closePath();
    ctx.fill();
    sparkle(14, -h - 20 + Math.sin(t * 3) * 2, 4 * lid);
    sparkle(-16, -h - 16 + Math.cos(t * 2.6) * 2, 3 * lid);
  }
  // caisse
  box(-w / 2, -h, w, h, 4, '#8E3326');
  ctx.fillStyle = '#6E2419';
  ctx.fillRect(-w / 2 + 3, -h + 12, w - 6, 2);
  // coins dorés
  ctx.fillStyle = '#F0B64A';
  for (const sx of [-1, 1]) {
    for (const [y0, y1] of [[-h, -h + 9], [0, -9]]) {
      ctx.beginPath();
      ctx.moveTo((sx * w) / 2, y0);
      ctx.lineTo(sx * (w / 2 - 9), y0);
      ctx.lineTo((sx * w) / 2, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillRect(-w / 2, -h, w, 3);
  if (!open) {
    // couvercle bombé, cerclé d'or
    ctx.fillStyle = '#A43E2E';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h);
    ctx.lineTo(-w / 2, -h - 8);
    ctx.bezierCurveTo(-w / 2, -h - 22, w / 2, -h - 22, w / 2, -h - 8);
    ctx.lineTo(w / 2, -h);
    ctx.closePath();
    ctx.fill();
    ink(ctx, 18);
    ctx.fillStyle = '#F0B64A';
    for (const k of [-0.3, 0.3]) ctx.fillRect(k * w - 2.5, -h - 18, 5, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-w / 2 + 6, -h - 13, w - 12, 2);
    // serrure et sa gemme
    box(-6, -h - 5, 12, 13, 3, '#F0B64A');
    ctx.fillStyle = '#5CC8E8';
    ctx.beginPath();
    ctx.arc(0, -h + 0.5, 2.6, 0, TAU);
    ctx.fill();
  } else box(-6, -h + 1, 12, 7, 2, '#F0B64A');
  ctx.restore();
}

/** Bois mort : tronc couché et sa souche ; épuisé, il ne reste que des copeaux. */
function drawDeadwood(ctx: Ctx, x: number, y: number, zone: number, hpPct: number, t: number, seed: number) {
  const r = 18 + zone * 3;
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 6, r * 1.3, r * 0.4, 0, 0, TAU);
  ctx.fill();
  const shake = hpPct < 100 ? Math.sin(t * 40 + seed) * 0.6 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  ctx.rotate(((seed % 7) - 3) * 0.05);
  // tronc couché
  ctx.fillStyle = '#6B4A33';
  ctx.beginPath();
  ctx.roundRect(-r * 1.2, -r * 0.45, r * 2.1, r * 0.7, r * 0.3);
  ctx.fill();
  ink(ctx, r);
  ctx.strokeStyle = 'rgba(16,24,26,0.35)';
  ctx.lineWidth = 1.5;
  for (const k of [-0.7, -0.2, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(k * r, -r * 0.4);
    ctx.lineTo((k + 0.25) * r, r * 0.2);
    ctx.stroke();
  }
  // bout coupé : cernes du bois
  ctx.fillStyle = '#C9A27A';
  ctx.beginPath();
  ctx.ellipse(r * 0.9, -r * 0.1, r * 0.22, r * 0.35, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r * 0.6);
  ctx.strokeStyle = '#8B6A47';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(r * 0.9, -r * 0.1, r * 0.1, r * 0.17, 0, 0, TAU);
  ctx.stroke();
  // mousse
  ctx.fillStyle = '#5E8F55';
  ctx.beginPath();
  ctx.ellipse(-r * 0.5, -r * 0.42, r * 0.35, r * 0.12, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (hpPct < 100) hpBar(ctx, x, y - r - 6, 28, hpPct, '#D2A06A');
}

// ───────────────────────── Attaques spéciales au sol ─────────────────────────

/** Zone d'attaque d'un mini-boss : annonce (bord + remplissage qui progresse), puis effet. */
/** « #5CC8B8 » → « 92,200,184 » (pour composer des rgba). */
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0).join(',');

/** owner : couleur du dompteur dont l'Alpha légendaire a lancé l'attaque (absente : un sauvage). */
export function drawHazard(ctx: Ctx, h: number[], t: number, owner?: string) {
  const [kind, x, y, r, x2, y2, prog, ally] = h;
  // rouge : attaque d'un géant (à esquiver) ; couleur du dompteur : attaque de son Alpha légendaire (elle ne touche que les sauvages)
  const ember = ally ? rgbOf(owner ?? '#F0B64A') : '232,105,63';
  const k = prog / 100;
  const active = prog >= 100;
  const style = HAZARD_STYLES[h[8]];
  if (style === 'lava') return drawLavaPool(ctx, x, y, r, active, t, ember, !!ally);
  if (style === 'flame') return drawFlameJet(ctx, x, y, x2, y2, r, k, active, t, ember, !!ally);
  if (style === 'laser') return drawLaserBeam(ctx, x, y, x2, y2, r, k, active, t, ember, ally ? rgbOf(owner ?? '#F0B64A') : '143,227,214');
  if (style === 'tentacle' && active) {
    // le tentacule s'abat de tout son long sur le pont
    const n = 8, pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      pts.push([x + (x2 - x) * f + Math.sin(f * 6) * r * 0.15, y + (y2 - y) * f + Math.cos(f * 6) * r * 0.15]);
    }
    tentacleStroke(ctx, pts, r * 0.95, r * 0.25, '#6A3E7E', KRAKEN.sucker, false);
    return;
  }
  if (style === 'ink' && active) {
    // nuage d'encre qui s'étale sur le pont
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * 0.3, d = r * (0.2 + 0.55 * ((i * 37) % 10) / 10);
      ctx.fillStyle = `rgba(24,12,34,${0.42 + 0.1 * Math.sin(t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.45, 0, TAU);
      ctx.fill();
    }
    return;
  }
  if (kind === 1) {
    // couloir de charge
    const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = `rgba(${ember},0.18)`;
    ctx.fillRect(0, -r, len, r * 2);
    ctx.fillStyle = active ? 'rgba(255,200,160,0.55)' : `rgba(${ember},0.4)`;
    ctx.fillRect(0, -r, len * k, r * 2);
    ctx.strokeStyle = `rgba(${ember},0.9)`;
    ctx.lineWidth = 3;
    ctx.strokeRect(0, -r, len, r * 2);
    ctx.restore();
    return;
  }
  if (kind === 2 && active) {
    // nuage de spores qui stagne
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + t * 0.4, d = r * (0.25 + 0.55 * ((i * 37) % 10) / 10);
      ctx.fillStyle = `rgba(160,190,90,${0.18 + 0.08 * Math.sin(t * 2 + i)})`;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(230,240,190,0.7)';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.8 + i * 1.7;
      ctx.fillRect(x + Math.cos(a) * r * 0.6, y + Math.sin(a * 1.3) * r * 0.4 - ((t * 20 + i * 9) % 30), 2, 2);
    }
    return;
  }
  if (kind === 3 && active) {
    // toile collante
    ctx.strokeStyle = 'rgba(238,231,215,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75);
    }
    for (const f of [0.35, 0.65, 0.95]) ctx.ellipse(x, y, r * f, r * f * 0.75, 0, 0, TAU);
    ctx.stroke();
    return;
  }
  // annonce circulaire : bord net, remplissage qui grossit jusqu'à l'impact
  const color = style === 'ink' ? '120,80,160' : kind === 2 ? '160,200,90' : kind === 3 ? '238,231,215' : ember;
  ctx.fillStyle = `rgba(${color},0.14)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = active ? 'rgba(255,220,180,0.55)' : `rgba(${color},0.38)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * k, r * k * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${color},0.95)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.stroke();
}

/** Flaque de lave d'une traînée : elle se forme (tache sombre), puis bouillonne dans sa croûte noire. */
function drawLavaPool(ctx: Ctx, x: number, y: number, r: number, active: boolean, t: number, ember: string, ally: boolean) {
  const seed = (x * 7 + y * 13) % 10;
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.35)`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.7, r * 0.5, 0, 0, TAU);
    ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(30,16,10,0.85)'; // croûte
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * TAU, d = r * (1 + 0.12 * Math.sin(a * 3 + seed));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.72;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x, y, 2, x, y, r * 0.85);
  g.addColorStop(0, ally ? `rgba(${ember},0.95)` : 'rgba(255,236,160,0.95)');
  g.addColorStop(0.45, `rgba(${ally ? ember : '255,138,61'},0.9)`);
  g.addColorStop(1, 'rgba(150,40,15,0.75)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.82, r * 0.58, 0, 0, TAU);
  ctx.fill();
  for (let b = 0; b < 3; b++) {
    const f = (t * 0.7 + b / 3 + seed * 0.1) % 1, bx = x + Math.cos(b * 2.2 + seed) * r * 0.4, by = y + Math.sin(b * 2.2 + seed) * r * 0.25;
    ctx.strokeStyle = `rgba(255,240,190,${0.8 * (1 - f)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, 2 + f * 7, 0, TAU);
    ctx.stroke();
  }
}

/**
 * Jet de flammes d'un tourbillon : annoncé, c'est un couloir rouge qui tourne et se remplit ; embrasé, une langue de
 * feu qui part du lanceur, jaune au cœur, qui vacille et s'effiloche au bout, avec des étincelles.
 */
function drawFlameJet(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, t: number, ember: string, ally: boolean) {
  const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.16)`;
    ctx.fillRect(0, -r, len, r * 2);
    ctx.fillStyle = `rgba(${ember},0.38)`;
    ctx.fillRect(0, -r, len * k, r * 2);
    ctx.strokeStyle = `rgba(${ember},0.9)`;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(0, -r, len, r * 2);
    ctx.restore();
    return;
  }
  // langue de feu : trois couches, de la plus large (rouge) au cœur (blanc-jaune), bords qui ondulent
  const layers: [number, string][] = ally
    ? [[1.7, `rgba(${ember},0.4)`], [1.15, `rgba(${ember},0.7)`], [0.55, 'rgba(255,250,230,0.9)']]
    : [[1.7, 'rgba(200,50,20,0.5)'], [1.15, 'rgba(255,140,50,0.85)'], [0.55, 'rgba(255,240,170,0.95)']];
  for (const [w, col] of layers) {
    ctx.fillStyle = col;
    ctx.beginPath();
    // bords en courbes douces qui ondulent lentement, bout arrondi qui lèche l'air
    const n = 6, edge = (i: number, sd: number) => {
      const f = i / n, wob = Math.sin(t * 9 + i * 1.3 + (sd > 0 ? 1.1 : 0)) * r * 0.1 * (0.4 + f);
      return [len * f, sd * (r * w * (1 - f * 0.3) + wob)];
    };
    ctx.moveTo(0, -r * w * 0.6);
    for (let i = 1; i <= n; i++) {
      const [ax, ay] = edge(i - 1, -1), [bx, by] = edge(i, -1);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    const [tx, ty] = edge(n, -1);
    ctx.quadraticCurveTo(len + r * w * 0.6, 0, tx, -ty);
    for (let i = n; i >= 1; i--) {
      const [ax, ay] = edge(i, 1), [bx, by] = edge(i - 1, 1);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.lineTo(0, r * w * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 6; i++) {
    const f = (t * 1.6 + i / 6) % 1;
    ctx.fillStyle = `rgba(255,220,140,${1 - f})`;
    ctx.beginPath();
    ctx.arc(len * (0.3 + f * 0.75), Math.sin(i * 2.1 + t * 5) * r * (0.4 + f), 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Rayon runique de l'Œil des Ruines : annoncé par un couloir pointillé qui se remplit, puis un faisceau couleur de ses runes
 * (halo, rayon, cœur blanc qui vibre) avec des étincelles qui filent le long et un éclat là où il s'arrête.
 */
function drawLaserBeam(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, t: number, ember: string, glow: string) {
  const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.14)`;
    ctx.fillRect(0, -r, len, r * 2);
    ctx.fillStyle = `rgba(${ember},0.34)`;
    ctx.fillRect(0, -r * k, len, r * 2 * k);
    ctx.strokeStyle = `rgba(${ember},0.9)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const buzz = 1 + Math.sin(t * 40) * 0.08;
  for (const [w, col] of [[1.6, `rgba(${glow},0.22)`], [1, `rgba(${glow},0.6)`], [0.42, 'rgba(255,255,255,0.95)']] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -r * w * 0.5 * buzz);
    ctx.lineTo(len, -r * w * buzz);
    ctx.arc(len, 0, r * w * buzz, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, r * w * 0.5 * buzz);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 8; i++) {
    const f = (t * 2.2 + i / 8) % 1;
    ctx.fillStyle = `rgba(255,255,255,${1 - f})`;
    ctx.beginPath();
    ctx.arc(len * f, Math.sin(i * 2.7 + t * 9) * r * 0.7, 2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(${glow},${0.45 + Math.sin(t * 25) * 0.15})`;
  ctx.beginPath();
  ctx.arc(len, 0, r * 1.9, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Toile accrochée au dompteur ralenti. */
export function drawWebbed(ctx: Ctx, x: number, y: number, t: number) {
  ctx.strokeStyle = 'rgba(238,231,215,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.sin(t) * 0.1;
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + Math.cos(a) * 24, y - 4 + Math.sin(a) * 20);
  }
  ctx.ellipse(x, y - 4, 14, 11, 0, 0, TAU);
  ctx.stroke();
}

/** Torche (niv. 1-2) ou lanterne (niv. 3 et plus) tenue de l'autre main, la nuit ; pied du manche en (x, y). */
export function drawTorch(ctx: Ctx, x: number, y: number, lvl: number, t: number) {
  const flick = Math.sin(t * 13 + x) * 0.8 + Math.sin(t * 29) * 0.5;
  if (lvl <= 2) {
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 16);
    ctx.stroke();
    ctx.fillStyle = lvl === 2 ? '#3A2A1E' : '#7A5A3A'; // résine : tête plus sombre
    ctx.fillRect(x - 2.5, y - 19, 5, 4);
    ctx.fillStyle = 'rgba(232,105,63,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y - 23 - flick * 0.4, 4, 6.5 + flick, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#F7D774';
    ctx.beginPath();
    ctx.ellipse(x, y - 22, 2, 3.5 + flick * 0.5, 0, 0, TAU);
    ctx.fill();
    return;
  }
  // lanterne à anse : cuivre au niveau 4, runique (lueur bleutée) au niveau 5
  const frame = lvl === 4 ? '#B87333' : lvl >= 5 ? '#6E7570' : '#4A4E52', glow = lvl >= 5 ? '#BDF2FF' : '#F7D774';
  ctx.strokeStyle = frame;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y - 17, 4, Math.PI, TAU);
  ctx.stroke();
  ctx.fillStyle = frame;
  ctx.fillRect(x - 5, y - 15, 10, 2.5);
  ctx.fillRect(x - 5, y - 4, 10, 2.5);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.85 + flick * 0.05;
  ctx.fillRect(x - 4, y - 12.5, 8, 8.5);
  ctx.globalAlpha = 1;
  ctx.fillStyle = frame;
  ctx.fillRect(x - 0.6, y - 12.5, 1.2, 8.5);
}

/** Souche d'un arbre abattu : il repoussera. */
export function drawStump(ctx: Ctx, x: number, y: number, r: number) {
  const w = Math.max(9, r * 0.9);
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x - w, y - w * 0.55, w * 2, w * 0.6);
  ctx.beginPath();
  ctx.ellipse(x, y + 0.05 * w, w, w * 0.4, 0, 0, TAU);
  ctx.fill();
  // le dessus, coupé net, et ses cernes
  ctx.fillStyle = '#C9A36E';
  ctx.beginPath();
  ctx.ellipse(x, y - w * 0.55, w, w * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,75,45,0.7)';
  ctx.lineWidth = 1;
  for (const k of [0.65, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(x, y - w * 0.55, w * k, w * 0.4 * k, 0, 0, TAU);
    ctx.stroke();
  }
}
