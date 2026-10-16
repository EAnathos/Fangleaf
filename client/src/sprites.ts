// Sprites procéduraux (Canvas 2D) : aucune image à charger.

import { SPECIES, type Resource } from '../../shared/config.ts';

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
}

/** Décalage de la couronne (Alpha, géant) vers la tête, en rayons, pour les espèces dont la tête est loin devant. */
const CROWN_X: Record<string, number> = { bear: 0.8, boar: 0.9 };
/** … et vers le bas, en rayons, pour celles dont la tête est plus basse que le haut du corps. */
const CROWN_Y: Record<string, number> = { boar: 0.45 };

export function drawUnit(ctx: Ctx, u: UnitLook) {
  const { x, r } = u;
  const key = u.key ?? SPECIES[u.species].sprite ?? SPECIES[u.species].key;
  const floating = key === 'wisp';
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
  t: number, moving: boolean, flash: boolean, isMe: boolean, riding = false, cls: string | null = null, tool: Tool | null = null, weapon = 0,
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
  } else drawSword(ctx, r, weapon);
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

/** Crapaud-mortier : gonfle sa gorge avant de cracher en cloche (zone 5, tireur). */
function toad(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const puff = u.charge ?? 0;
  const sq = Math.sin(u.t * 4 + u.seed) * 0.03;
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#4F6B3A';
  for (const k of [-0.7, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(k * r, 0.62 * r, 0.32 * r, 0.16 * r, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0.1 * r, 1.05 * r * (1 + sq), 0.72 * r * (1 - sq), 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#8FAE5C';
  for (const [x, y, sz] of [[-0.5, -0.15, 0.13], [-0.15, -0.4, 0.1], [0.25, -0.3, 0.09], [-0.65, 0.2, 0.08]] as const) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, sz * r, 0, TAU);
    ctx.fill();
  }
  // sac vocal
  ctx.fillStyle = u.flash ? '#FFFFFF' : '#E8DCA0';
  ctx.beginPath();
  ctx.ellipse(0.55 * r, 0.3 * r, (0.32 + puff * 0.28) * r, (0.24 + puff * 0.22) * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  for (const x of [0.25, 0.75]) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x * r, -0.55 * r, 0.22 * r, 0, TAU);
    ctx.fill();
    ink(ctx, r);
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    ctx.arc(x * r, -0.57 * r, 0.13 * r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#10181A';
    ctx.fillRect(x * r - 0.1 * r, -0.6 * r, 0.2 * r, 0.06 * r);
  }
  ctx.strokeStyle = '#2A3A20';
  ctx.lineWidth = 0.06 * r;
  ctx.beginPath();
  ctx.moveTo(0.15 * r, -0.12 * r);
  ctx.quadraticCurveTo(0.6 * r, 0.02 * r, 1.0 * r, -0.15 * r);
  ctx.stroke();
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

/** Crabe des berges : carapace épaisse, marche de côté, pince fort (zone 5, mêlée). */
function crab(ctx: Ctx, r: number, fill: string, u: UnitLook) {
  const pinch = Math.sin(u.t * 3 + u.seed) > 0.7;
  const leg = u.flash ? '#FFFFFF' : '#9A3E22';
  const claw = u.flash ? '#FFFFFF' : '#A8442C';
  ctx.strokeStyle = leg;
  ctx.lineWidth = 0.09 * r;
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const ox = sd * (0.4 + i * 0.18) * r, lf = Math.sin(u.t * 10 + i + sd + u.seed) * 0.08 * r;
      ctx.beginPath();
      ctx.moveTo(ox * 0.6, 0.3 * r);
      ctx.lineTo(ox, 0.5 * r + lf);
      ctx.lineTo(ox * 1.15, 0.8 * r);
      ctx.stroke();
    }
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(0, 0.1 * r, 0.95 * r, 0.6 * r, 0, 0, TAU);
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = u.flash ? '#FFFFFF' : 'rgba(255,190,150,0.45)';
  ctx.beginPath();
  ctx.ellipse(-0.1 * r, -0.1 * r, 0.55 * r, 0.25 * r, 0, 0, TAU);
  ctx.fill();
  for (const sd of [-1, 1]) {
    const cx = sd * 1.05 * r, cy = -0.25 * r;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 0.32 * r, 0.24 * r, sd * 0.4, 0, TAU);
    ctx.fill();
    ink(ctx, r);
    const o = pinch ? 0.05 : 0.35;
    ctx.fillStyle = claw;
    ctx.beginPath();
    ctx.moveTo(cx + sd * 0.15 * r, cy - 0.1 * r);
    ctx.lineTo(cx + sd * 0.55 * r, cy - (0.2 + o) * r);
    ctx.lineTo(cx + sd * 0.3 * r, cy - 0.05 * r);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + sd * 0.15 * r, cy + 0.05 * r);
    ctx.lineTo(cx + sd * 0.55 * r, cy + 0.05 * r + o * 0.4 * r);
    ctx.lineTo(cx + sd * 0.28 * r, cy + 0.12 * r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#10181A';
  ctx.lineWidth = 0.06 * r;
  for (const sd of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(sd * r, -0.3 * r);
    ctx.lineTo(sd * r * 1.2, -0.62 * r);
    ctx.stroke();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.arc(sd * r * 1.2, -0.66 * r, 0.08 * r, 0, TAU);
    ctx.fill();
  }
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
  // coquille en spirale
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

const DRAWERS: Record<string, (ctx: Ctx, r: number, fill: string, u: UnitLook) => void> = {
  slime, wolf, boar, golem,
  sporelin, spider, bear, wisp,
  watcher, toad, serpent, crab,
  hare, snail,
};

// ───────────────────────── Buissons à fruits ─────────────────────────

/** Buisson rond ; garni, il porte des baies rouges (le gibier vient les manger, elles repoussent). */
export function drawBush(ctx: Ctx, x: number, y: number, fruit: boolean, seed: number, zone: number) {
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

// ───────────────────────── Filons d'or ─────────────────────────

/** Filon d'or : rocher veiné d'or qui scintille (épuisé, il a disparu : rien à dessiner). Bois mort et rochers : voir plus bas. */
export function drawOre(ctx: Ctx, x: number, y: number, zone: number, hpPct: number, t: number, seed: number, res: Resource = 'gold') {
  if (hpPct <= 0) return;
  if (res === 'wood') return drawDeadwood(ctx, x, y, zone, hpPct, t, seed);
  const r = 18 + zone * 3;
  // ombre posée sous la base du rocher (pas décollée : il ne doit pas avoir l'air de voler)
  ctx.fillStyle = 'rgba(8, 14, 12, 0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + r * 0.42, r * 1.05, r * 0.32, 0, 0, TAU);
  ctx.fill();
  const shake = hpPct < 100 ? Math.sin(t * 40 + seed) * 0.6 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  ctx.fillStyle = '#6B706B';
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.4);
  ctx.lineTo(-r * 0.8, -r * 0.4);
  ctx.lineTo(-r * 0.2, -r * 0.85);
  ctx.lineTo(r * 0.55, -r * 0.6);
  ctx.lineTo(r, r * 0.1);
  ctx.lineTo(r * 0.7, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ink(ctx, r);
  ctx.fillStyle = '#8A908A';
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.35);
  ctx.lineTo(-r * 0.15, -r * 0.7);
  ctx.lineTo(r * 0.3, -r * 0.5);
  ctx.lineTo(-r * 0.1, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  if (res === 'stone') {
    // rocher à casser : fissures et éclats clairs, pas d'or
    ctx.strokeStyle = 'rgba(16,24,26,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.3);
    ctx.lineTo(-r * 0.1, 0);
    ctx.lineTo(-r * 0.2, -r * 0.3);
    ctx.moveTo(-r * 0.1, 0);
    ctx.lineTo(r * 0.45, r * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#A9B0AB';
    for (const [nx, ny, nr] of [[0.35, -0.25, 0.12], [-0.45, -0.05, 0.1], [0.15, 0.3, 0.09]] as const) {
      ctx.beginPath();
      ctx.arc(nx * r, ny * r, nr * r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (hpPct < 100) hpBar(ctx, x, y - r - 10, 28, hpPct, '#B9C2BC');
    return;
  }
  // veines et pépites d'or
  ctx.strokeStyle = '#C9922F';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.2);
  ctx.lineTo(-r * 0.1, -r * 0.1);
  ctx.lineTo(r * 0.5, r * 0.15);
  ctx.stroke();
  ctx.fillStyle = '#F0B64A';
  for (const [nx, ny, nr] of [[-0.45, 0.1, 0.16], [0.05, -0.15, 0.2], [0.45, 0.12, 0.14], [-0.1, 0.3, 0.1]] as const) {
    ctx.beginPath();
    ctx.arc(nx * r, ny * r, nr * r, 0, TAU);
    ctx.fill();
  }
  // éclat qui scintille
  const tw = (Math.sin(t * 3 + seed) + 1) / 2;
  if (tw > 0.75) {
    const k = (tw - 0.75) * 4, sx = r * 0.05, sy = -r * 0.15;
    ctx.strokeStyle = `rgba(255,240,200,${k})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 6 * k, sy);
    ctx.lineTo(sx + 6 * k, sy);
    ctx.moveTo(sx, sy - 6 * k);
    ctx.lineTo(sx, sy + 6 * k);
    ctx.stroke();
  }
  ctx.restore();
  if (hpPct < 100) hpBar(ctx, x, y - r - 10, 28, hpPct, '#F0B64A');
}

// ───────────────────────── Coffre des géants ─────────────────────────

/** Coffre royal : bois rouge, coins et cerclages dorés, gemme sur la serrure. lid : 0 fermé → 1 grand ouvert ; drop : hauteur de chute. */
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
  const color = kind === 2 ? '160,200,90' : kind === 3 ? '238,231,215' : ember;
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
