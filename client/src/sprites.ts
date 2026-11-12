// Sprites procéduraux (Canvas 2D) : aucune image à charger.
// Les créatures sont dessinées dans client/src/sprites/ (un module par famille) ; ce fichier les assemble (drawUnit)
// et garde le reste : dompteurs, objets, tirs, attaques au sol, robes des Alphas.

import { DESERT_ZONE, DRUM_GAP, HAZARD_FLAT, LOG_SPEED, PINCER_HALF, RING_SPEED, RING_W, SPECIES, SPLASH_FLAT, type Resource } from '../../shared/config.ts';
import { withTint } from './tint.ts';
import { HAZARD_STYLES, UNIT_FLAG_BURN, UNIT_FLAG_CURSE, UNIT_FLAG_GUARD, UNIT_FLAG_POISON, UNIT_FLAG_RALLY } from '../../shared/protocol.ts';
import { hash2 } from '../../shared/math.ts';
import { textScale } from './settings.ts';
import { drawCoati } from './coati.ts';
import { TAU, blot, gait, ink, shadow, type Ctx, type UnitLook } from './sprites/outils.ts';
import { slime, snail, sporelin } from './sprites/lisiere.ts';
import { bigfoot, firefly, spider, treant, wolf } from './sprites/bois.ts';
import { bear, boar, hare } from './sprites/landes.ts';
import { golem, watcher, wisp } from './sprites/ruines.ts';
import { crab, serpent, toad } from './sprites/lacs.ts';
import { jackal, meerkat, sandworm, scorpion, vulture } from './sprites/desert.ts';
import { ashBat, ember, lavaTortoise, salamander, salamanderTail } from './sprites/volcan.ts';
import { KRAKEN, kraken, krakenTentacle, tentacleStroke } from './sprites/haute-mer.ts';
import { croc, drawBanana, gorilla, maskTotem, masked } from './sprites/jungle.ts';
import { band, bez, dragon, drake, wyvern, type P2 } from './sprites/dragons.ts';
export { shadow } from './sprites/outils.ts';
export type { Leap, UnitLook } from './sprites/outils.ts';
export { drawBurrow, drawSoaring, drawSoaringShadow } from './sprites/desert.ts';
export { KRAKEN_COLORS, drawKraken } from './sprites/haute-mer.ts';
export { drawLurkEyes } from './sprites/jungle.ts';

/** Grande couronne d'un géant : décalage vertical, en rayons, pour ceux dont la tête est bien plus basse (ou plus haute). */
const BOSS_CROWN_Y: Record<string, number> = { drake: -0.12, wyvern: -0.55, dragon: -0.45, croc: 0.75, masked: -1.05 };
/** Décalage de la couronne (Alpha, géant) vers la tête, en rayons, pour les espèces dont la tête est loin devant. */
const CROWN_X: Record<string, number> = { drake: 0.7, wyvern: 0.7, dragon: 0.8, scorpion: 0.45, gorilla: 0.7, croc: 0.6, masked: 0.02, bear: 0.8, boar: 0.9, firefly: 0.5, sandworm: 0.5, vulture: 0.55, jackal: 0.85, meerkat: 0.08, rufous_coati: 0.9, bigfoot: 0.12, salamander: 0.95, lava_tortoise: 1.05 };
/** … et vers le bas, en rayons, pour celles dont la tête est plus basse que le haut du corps. */
const CROWN_Y: Record<string, number> = { drake: -0.15, wyvern: -0.55, dragon: -0.35, scorpion: 0.05, gorilla: 0.25, croc: 0.82, masked: -0.95, kraken: -0.6, crab: -0.05, boar: 0.45, firefly: 0.1, sandworm: -0.45, vulture: 0.0, jackal: 0.0, meerkat: -0.45, rufous_coati: 0.2, bigfoot: -0.35, salamander: 0.55, lava_tortoise: 0.55, ash_bat: 0.15 };

/** Filtre CSS de la robe de l'Alpha (et du légendaire, qui a la même), ou '' pour la forme de base. Une espèce sans entrée n'a pas de robe (voir tests/rules/sprites.test.ts). */
export const variantFilter = (key: string, alpha: boolean) => (alpha ? (VARIANT_FILTERS[key] ?? '') : '');

export function drawUnit(ctx: Ctx, u: UnitLook) {
  const { x, r } = u;
  const key = u.key ?? SPECIES[u.species].sprite ?? SPECIES[u.species].key;
  const floating = key === 'wisp' || key === 'firefly' || key === 'ash_bat';
  // Gluant, crapaud, lièvre en marche : ils avancent par bonds (élan aplati, saut étiré, atterrissage écrasé).
  const hop = u.moving && HOPS[key] ? hopOf(u, HOPS[key]) : null;
  if (hop) u = { ...u, leap: hop.leap };
  const air = (u.air ?? 0) + (hop?.lift ?? 0);
  const bob = floating ? Math.sin(u.t * 2.5 + u.seed) * r * 0.18 - r * 0.55 : hop ? 0 : Math.sin(u.t * 6 + u.seed) * r * 0.06;
  // crabe, crapaud qui pataugent : ils s'enfoncent à mi-corps, le bas caché sous la ligne d'eau
  const wade = !!u.inWater && !SPECIES[u.species].swim && !floating && air <= 0;
  const sink = wade ? r * (key === 'crab' ? 0.16 : 0.3) : 0, waterline = u.y + r * 0.45;
  const y = u.y + bob - air + sink;
  const squash = (u.squash ?? 1) * (hop?.squash ?? 1);

  const lifted = Math.max(0.35, 1 - air / (r * 6)); // l'ombre rétrécit quand il monte
  if (floating) shadow(ctx, x, u.y, r * (0.75 - Math.sin(u.t * 2.5 + u.seed) * 0.08));
  else if (!u.inWater) shadow(ctx, x, u.y, r * lifted);
  if (hop?.dust) {
    // petites bouffées de poussière qui s'écartent sous les pattes quand il retombe
    const d = hop.dust;
    ctx.fillStyle = `rgba(196,182,150,${0.5 * (1 - d)})`;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + s * r * (0.55 + d * 0.6), u.y + r * 0.7, r * (0.16 + d * 0.14), r * (0.08 + d * 0.06), 0, 0, TAU);
      ctx.fill();
    }
  }

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

  if (wade) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - r * 4, u.y - r * 5, r * 8, waterline - (u.y - r * 5));
    ctx.clip();
  }
  ctx.save();
  ctx.translate(x, y + r * 0.75); // écrasement depuis les pieds : il reste posé au sol
  ctx.scale(u.face / Math.sqrt(squash), squash);
  ctx.translate(0, -r * 0.75);
  if (hop?.tilt) ctx.rotate(hop.tilt); // museau vers le haut au décollage, vers le sol à l'arrivée
  const base = u.color ?? SPECIES[u.species].color;
  const fill = u.flash ? '#FFFFFF' : base;
  const tint = u.flash || u.key || SPECIES[u.species]?.boss ? '' : variantFilter(key, u.alpha || !!u.legend);
  const effects = u.legend && !u.flash; // légendaire : des effets propres à l'espèce, qui ne prennent pas la teinte du corps
  if (effects) LEGEND_BACK[key]?.(ctx, r, u);
  // Alpha et légendaire : robe d'une autre couleur que la forme de base, appliquée aux couleurs du corps pendant qu'il se dessine
  // (voir tint.ts : pas de ctx.filter, qui coûtait bien plus cher que le dessin lui-même)
  if (tint) withTint(ctx, tint, () => (DRAWERS[key] ?? golem)(ctx, r, fill, u));
  else (DRAWERS[key] ?? golem)(ctx, r, fill, u);
  if (effects) LEGEND_FRONT[key]?.(ctx, r, u);
  if (SPECIES[u.species]?.boss && !u.key) {
    // Mini-boss : grande couronne dorée.
    ctx.fillStyle = '#F0B64A';
    ctx.strokeStyle = 'rgba(12,18,16,0.8)';
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    const bx = (CROWN_X[key] ?? 0) * r;
    ctx.translate(0, (BOSS_CROWN_Y[key] ?? 0) * r);
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
  if (wade) {
    ctx.restore();
    // l'eau autour de lui : une nappe un peu sombre, des remous qui s'écartent, des éclaboussures s'il avance
    ctx.fillStyle = 'rgba(46,101,116,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, waterline, r * 1.05, r * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    for (let k = 0; k < 2; k++) {
      const p = (u.t * (u.moving ? 1.4 : 0.6) + k / 2 + u.seed * 0.1) % 1;
      ctx.strokeStyle = `rgba(220,240,245,${0.55 * (1 - p)})`;
      ctx.beginPath();
      ctx.ellipse(x, waterline, r * (0.95 + p * 0.7), r * (0.22 + p * 0.16), 0, 0, TAU);
      ctx.stroke();
    }
    if (u.moving) {
      ctx.fillStyle = 'rgba(226,240,236,0.7)';
      for (let k = 0; k < 4; k++) {
        const p = (u.t * 3 + k / 4) % 1, a = k * 1.7 + u.seed;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * (0.7 + p * 0.4), waterline - Math.sin(p * Math.PI) * r * 0.35, r * 0.05 * (1 - p) + 0.5, 0, TAU);
        ctx.fill();
      }
    }
  }
}

/**
 * Bond d'un gluant qui avance : environ deux sauts par seconde. Il s'aplatit pour prendre son élan, s'étire en l'air,
 * puis s'écrase en retombant.
 */
/** Bonds par seconde, hauteur (en rayons), écrasement à l'élan et à l'atterrissage, étirement en l'air, bascule du corps (rad). */
interface Hop { rate: number; height: number; crouch: number; land: number; stretch: number; tilt: number }
const HOPS: Record<string, Hop> = {
  slime: { rate: 2.1, height: 0.85, crouch: 0.28, land: 0.32, stretch: 0.18, tilt: 0 }, // gros bonds mous
  toad: { rate: 1.4, height: 0.75, crouch: 0.24, land: 0.26, stretch: 0.1, tilt: 0.32 }, // sauts lourds et longs, pattes détendues
  hare: { rate: 2.6, height: 0.7, crouch: 0.18, land: 0.2, stretch: 0.12, tilt: 0.38 }, // bonds vifs, oreilles couchées
};
/** Espèces (apparence) qui avancent par bonds : le jeu les redessine à chaque image pendant qu'elles sautent. */
export const hops = (key: string) => key in HOPS;

const smoothstep = (a: number, b: number, v: number) => {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * Un bond, découpé en temps : élan (ramassé, museau qui plonge), détente (pattes arrière qui se déplient d'un coup,
 * museau en l'air), vol (pattes qui se replient, le corps bascule), réception (pattes avant tendues vers le sol, écrasement,
 * poussière).
 */
function hopOf(u: UnitLook, h: Hop) {
  const ph = (u.t * h.rate + u.seed * 0.37) % 1;
  if (ph < 0.18) {
    const c = Math.sin((ph / 0.18) * Math.PI * 0.5);
    return { lift: 0, squash: 1 - h.crouch * c, tilt: h.tilt * 0.35 * c, leap: { ext: 0, reach: 0, crouch: c }, dust: 0 }; // élan
  }
  if (ph > 0.86) {
    const k = (ph - 0.86) / 0.14;
    return { lift: 0, squash: 1 - h.land * Math.sin(k * Math.PI), tilt: h.tilt * 0.5 * (1 - k), leap: { ext: 0, reach: 1 - k, crouch: Math.sin(k * Math.PI) * 0.8 }, dust: k }; // réception
  }
  const k = (ph - 0.18) / 0.68;
  const ext = smoothstep(0, 0.12, k) * (1 - smoothstep(0.35, 0.7, k)), reach = smoothstep(0.5, 0.85, k);
  return {
    lift: Math.sin(k * Math.PI) * u.r * h.height,
    squash: 1 + h.stretch * Math.cos(k * Math.PI), // étiré en montant, rond au sommet
    tilt: -h.tilt * Math.cos(k * Math.PI), // museau en l'air au départ, vers le sol à l'arrivée
    leap: { ext, reach, crouch: 0 },
    dust: 0,
  };
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
  t: number, moving: boolean, flash: boolean, isMe: boolean, riding = false, cls: string | null = null, tool: Tool | null = null, weapon = 0, armed = true, hat = 0,
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
  drawHat(ctx, x, cy, r, hat, fx, t);
  // nom (au-dessus du chapeau)
  if (!name) return;
  const ny = cy - r - 10 - (HAT_H[hat] ?? 0);
  ctx.font = `600 ${Math.round(13 * textScale())}px Outfit, sans-serif`; // (taille : réglage)
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText(name, x, ny);
  ctx.fillStyle = '#EEE7D7';
  ctx.fillText(name, x, ny);
}

/** Hauteur de chaque chapeau au-dessus du crâne (le nom passe au-dessus). */
const HAT_H = [0, 4, 5, 3, 7, 22, 17, 4, 11];

/**
 * Chapeau du profil (HATS), posé sur le haut de la boule : purement décoratif. fx : sens du regard (visière, plume).
 */
export function drawHat(ctx: Ctx, x: number, cy: number, r: number, hat: number, fx: number, t: number) {
  if (!hat) return;
  const top = cy - r, side = fx < -0.1 ? -1 : 1;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const outline = (w = 1.5) => {
    ctx.strokeStyle = 'rgba(16,24,26,0.8)';
    ctx.lineWidth = w;
    ctx.stroke();
  };
  if (hat === 1) {
    // chapeau de paille : large bord, calotte ronde, ruban rouge
    ctx.fillStyle = '#E2C06A';
    ctx.beginPath();
    ctx.ellipse(x, top + 6, r * 1.3, 4.5, 0, 0, TAU);
    ctx.fill();
    outline();
    ctx.fillStyle = '#EED089';
    ctx.beginPath();
    ctx.ellipse(x, top + 3, r * 0.68, 7, 0, Math.PI, TAU);
    ctx.fill();
    outline();
    ctx.fillStyle = '#C8323C';
    ctx.fillRect(x - r * 0.66, top + 1.5, r * 1.32, 2.8);
    ctx.strokeStyle = 'rgba(150,110,40,0.6)'; // la paille tressée
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      ctx.moveTo(x + k * 6, top + 3);
      ctx.lineTo(x + k * 7.5, top + 9);
    }
    ctx.stroke();
  } else if (hat === 2) {
    // bonnet de laine : côtes, revers, pompon
    ctx.fillStyle = '#3F7FC0';
    ctx.beginPath();
    ctx.ellipse(x, top + 6, r * 0.92, 11, 0, Math.PI, TAU);
    ctx.fill();
    outline();
    ctx.strokeStyle = 'rgba(16,40,70,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(x + k * 5, top + 5);
      ctx.quadraticCurveTo(x + k * 3.5, top - 2, x + k * 1.5, top - 4);
    }
    ctx.stroke();
    ctx.fillStyle = '#2F649C';
    ctx.beginPath();
    ctx.roundRect(x - r * 0.95, top + 2, r * 1.9, 5.5, 2.5);
    ctx.fill();
    outline();
    ctx.fillStyle = '#F2F0E6';
    ctx.beginPath();
    ctx.arc(x, top - 6, 4, 0, TAU);
    ctx.fill();
    outline(1.2);
  } else if (hat === 3) {
    // couronne de fleurs : brindilles et petites fleurs de toutes les couleurs
    ctx.strokeStyle = '#4E7A34';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(x, top + 4, r * 0.9, 4, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    const petals = ['#F2F0E6', '#E890B0', '#E8D45C', '#B48CFF', '#E8695C'];
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (1.1 + k * 0.2), fx2 = x + Math.cos(a) * r * 0.9, fy2 = top + 4 + Math.sin(a) * 4;
      ctx.fillStyle = petals[k];
      for (let j = 0; j < 5; j++) {
        const b = (j / 5) * TAU + k;
        ctx.beginPath();
        ctx.arc(fx2 + Math.cos(b) * 2.2, fy2 + Math.sin(b) * 2.2, 1.9, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.arc(fx2, fy2, 1.3, 0, TAU);
      ctx.fill();
    }
  } else if (hat === 4) {
    // tricorne de pirate : feutre noir, galon doré, plume
    ctx.fillStyle = '#26221F';
    ctx.beginPath();
    ctx.moveTo(x - r * 1.15, top + 3);
    ctx.quadraticCurveTo(x - r * 0.5, top - 2, x, top - 9);
    ctx.quadraticCurveTo(x + r * 0.5, top - 2, x + r * 1.15, top + 3);
    ctx.quadraticCurveTo(x, top + 9, x - r * 1.15, top + 3);
    ctx.closePath();
    ctx.fill();
    outline();
    ctx.strokeStyle = '#F0B64A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - r * 1.05, top + 3);
    ctx.quadraticCurveTo(x, top + 7.5, x + r * 1.05, top + 3);
    ctx.stroke();
    ctx.strokeStyle = '#C8323C';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x - side * 4, top - 3);
    ctx.quadraticCurveTo(x - side * 12, top - 14 + Math.sin(t * 3) * 1.2, x - side * 20, top - 9);
    ctx.stroke();
  } else if (hat === 5) {
    // chapeau de sorcier : grand cône violet à la pointe tombante, étoile dorée
    ctx.fillStyle = '#4E3F7A';
    ctx.beginPath();
    ctx.ellipse(x, top + 5, r * 1.15, 4, 0, 0, TAU);
    ctx.fill();
    outline();
    ctx.fillStyle = '#5E4C94';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7, top + 4);
    ctx.quadraticCurveTo(x - 3, top - 14, x + side * 3, top - 22);
    ctx.quadraticCurveTo(x + side * 10, top - 22, x + side * 13, top - 15);
    ctx.quadraticCurveTo(x + side * 6, top - 16, x + side * 4, top - 12);
    ctx.quadraticCurveTo(x + 5, top - 4, x + r * 0.7, top + 4);
    ctx.closePath();
    ctx.fill();
    outline();
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? 1.6 : 3.8;
      ctx.lineTo(x - side * 1 + Math.cos(a) * rr, top - 4 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (hat === 6) {
    // haut-de-forme : cylindre noir, ruban
    ctx.fillStyle = '#1E1C1C';
    ctx.beginPath();
    ctx.ellipse(x, top + 5, r * 1.05, 3.5, 0, 0, TAU);
    ctx.fill();
    outline();
    ctx.beginPath();
    ctx.roundRect(x - r * 0.6, top - 16, r * 1.2, 21, 2);
    ctx.fill();
    outline();
    ctx.fillStyle = '#8A2A30';
    ctx.fillRect(x - r * 0.6, top - 1, r * 1.2, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; // reflet de la soie
    ctx.fillRect(x - r * 0.4, top - 14, 2.5, 12);
  } else if (hat === 7) {
    // casquette : calotte, visière tournée vers le regard, bouton
    ctx.fillStyle = '#C8323C';
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.75, top + 5, r * 0.62, 3, 0, 0, TAU);
    ctx.fill();
    outline();
    ctx.beginPath();
    ctx.ellipse(x, top + 5, r * 0.82, 9.5, 0, Math.PI, TAU);
    ctx.fill();
    outline();
    ctx.fillStyle = '#F2F0E6';
    ctx.beginPath();
    ctx.arc(x, top - 4, 1.8, 0, TAU);
    ctx.fill();
  } else if (hat === 8) {
    // grande feuille posée sur la tête, sa tige dressée ; elle se balance un peu
    const sway = Math.sin(t * 2.4) * 0.12;
    ctx.translate(x, top + 2);
    ctx.rotate(sway - side * 0.25);
    ctx.fillStyle = '#5FA845';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-11, -6, 0, -13);
    ctx.quadraticCurveTo(11, -6, 0, 0);
    ctx.fill();
    outline();
    ctx.strokeStyle = '#3E7A2C';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 1);
    ctx.lineTo(0, -12);
    for (const k of [-4, -8]) {
      ctx.moveTo(0, k);
      ctx.lineTo(-4, k - 3);
      ctx.moveTo(0, k);
      ctx.lineTo(4, k - 3);
    }
    ctx.stroke();
  }
  ctx.restore();
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
  ctx.font = `600 ${Math.round(13 * textScale())}px Outfit, sans-serif`; // (taille : réglage)
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

/**
 * Projectile de tireur. Trait runique : orbe turquoise ; jet : trait d'eau ; boule de feu ; décharge électrique ;
 * cloche : boule qui monte puis retombe sur un cercle annoncé au sol (dessiné dès le départ pour pouvoir l'esquiver).
 */
/** owner : couleur du dompteur d'un tireur de la meute (ou d'un légendaire) ; absente : un sauvage, en rouge. */
/** Éclair d'une décharge qui rebondit d'une cible à l'autre (pts : x, y de chacune) ; k : 1 au départ, 0 quand il s'éteint. */
export function drawZap(ctx: Ctx, pts: number[], k: number, seed: number, owner?: string) {
  const glow = owner ? `rgba(${rgbOf(owner)},${0.45 * k})` : `rgba(140,210,255,${0.5 * k})`;
  for (const [col, w] of [[glow, 7], [`rgba(235,248,255,${k})`, 2]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1] - 14, x1 = pts[i], y1 = pts[i + 1] - 14, n = 6;
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
      ctx.moveTo(x0, y0);
      for (let j = 1; j < n; j++) {
        const f = j / n, off = (Math.sin(seed * 13.7 + i * 5.1 + j * 2.9) * 0.5 + Math.sin(seed * 7.3 + j * 11.3) * 0.5) * 14;
        ctx.lineTo(x0 + (x1 - x0) * f + (nx / l) * off, y0 + (y1 - y0) * f + (ny / l) * off);
      }
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  }
}

export function drawShot(ctx: Ctx, kind: number, x: number, y: number, a: number, b: number, prog: number, t: number, owner?: string) {
  const col = owner ? rgbOf(owner) : '232,105,63';
  if (kind === 1 || kind === 3 || kind === 7) {
    const p = prog / 100, splash = kind === 3 ? 46 : kind === 7 ? 60 : 52;
    ctx.fillStyle = `rgba(${col},${0.12 + p * 0.22})`;
    ctx.strokeStyle = `rgba(${col},0.85)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(a, b, splash, splash * SPLASH_FLAT, 0, 0, TAU); // (la même ellipse que le serveur)
    ctx.fill();
    ctx.stroke();
    const bx = x + (a - x) * p, by = y + (b - y) * p - Math.sin(p * Math.PI) * 120;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + (a - x) * p, y + (b - y) * p, 8, 4, 0, 0, TAU);
    ctx.fill();
    if (kind === 3) return drawBanana(ctx, bx, by, t); // banane du gorille
    if (kind === 7) return drawMagma(ctx, bx, by, t, x + (a - x) * p, y + (b - y) * p, p); // roche en fusion des tortues
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
  if (kind === 4) {
    // fléchette de sarbacane : fine pointe sombre, empennage de plumes rouge et jaune
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(-12, 0);
    ctx.stroke();
    ctx.strokeStyle = '#2A2018';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
    ctx.fillStyle = '#C8382E';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-17, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-17, 4);
    ctx.fill();
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    ctx.arc(-11, 0, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else if (kind === 5) {
    // boule de feu du dragonnet, en ligne droite : cœur jaune, flammes qui traînent derrière elle
    const bx = -Math.cos(ang), by = -Math.sin(ang);
    for (let k = 4; k >= 0; k--) {
      const d = k * 7, fl = Math.sin(t * 30 + k * 1.7) * 2;
      ctx.fillStyle = k > 2 ? `rgba(200,60,30,${0.5 - k * 0.08})` : k > 0 ? 'rgba(240,120,40,0.75)' : '#FFB347';
      ctx.beginPath();
      ctx.arc(x + bx * d - by * fl, y + by * d + bx * fl, 10 - k * 1.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#FFF2B0';
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, TAU);
    ctx.fill();
  } else if (kind === 6) {
    // décharge du Grand Drake : une boule d'électricité qui crépite, des arcs autour
    ctx.fillStyle = 'rgba(140,210,255,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, 14 + Math.sin(t * 40) * 2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#DDF4FF';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a0 = t * 23 + k * 2.1 + Math.sin(t * 57 + k) * 0.8;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a0) * 9, y + Math.sin(a0) * 9);
      ctx.lineTo(x + Math.cos(a0 + 0.5) * 15, y + Math.sin(a0 + 0.5) * 15);
    }
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fill();
  } else if (kind === 0) {
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

const DRAWERS: Record<string, (ctx: Ctx, r: number, fill: string, u: UnitLook) => void> = {
  slime, wolf, boar, golem, treant,
  sporelin, spider, bear, wisp,
  watcher, toad, serpent, crab,
  hare, snail, firefly,
  meerkat, sandworm, vulture, jackal,
  salamander, ash_bat: ashBat, lava_tortoise: lavaTortoise,
  kraken, kraken_tentacle: krakenTentacle,
  gorilla, croc, masked,
  scorpion, drake, wyvern, dragon,
  bigfoot,
  rufous_coati: (ctx, r, _fill, u) => drawCoati(ctx, r, u),
  mask_totem: maskTotem, salamander_tail: salamanderTail,
};

// ───────────────────────── Buissons à fruits ─────────────────────────

/** Buisson rond ; garni, il porte des baies rouges (le gibier vient les manger, elles repoussent). */
export function drawBush(ctx: Ctx, x: number, y: number, fruit: boolean, seed: number, zone: number) {
  if (zone === DESERT_ZONE) return drawPricklyPear(ctx, x, y, fruit, seed);
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
export function drawOre(ctx: Ctx, x: number, y: number, zone: number, hpPct: number, t: number, seed: number, res: Resource = 'gold', size = 1) {
  if (hpPct <= 0) return;
  if (res === 'wood') return drawDeadwood(ctx, x, y, zone, hpPct, t, seed);
  const r = (18 + zone * 3) * size; // petit, moyen ou gros rocher
  // ombre posée sous la base du rocher (pas décollée : il ne doit pas avoir l'air de voler)
  ctx.fillStyle = 'rgba(8, 14, 12, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + r * 0.45, r * 1.05, r * 0.3, 0, 0, TAU);
  ctx.fill();
  const shake = hpPct < 100 ? Math.sin(t * 40 + seed) * 0.6 : 0;
  ctx.save();
  ctx.translate(x + shake, y);
  if (res === 'stone') {
    // rocher à casser : sa forme suit sa taille (galet, bloc, éperon), coussin de mousse sur le dessus, une fissure, des cailloux autour
    const top = rockBody(ctx, r, size, seed, '#A3A9A3', '#828882', '#626863');
    ctx.fillStyle = '#5E8A4E';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y + r * 0.05, r * 0.35 * top.k, r * 0.16 * top.k, -0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#76A35E';
    ctx.beginPath();
    ctx.ellipse(top.x - r * 0.07 * top.k, top.y, r * 0.2 * top.k, r * 0.08 * top.k, -0.25, 0, TAU);
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
    if (hpPct < 100) hpBar(ctx, x, y - r * (size > 1.2 ? 1.5 : 1) - 10, 28, hpPct, '#B9C2BC');
    return;
  }
  // filon d'or : bloc gris d'où jaillissent des cristaux dorés, dans un léger halo qui pulse
  ctx.fillStyle = `rgba(247,199,102,${0.14 + 0.06 * Math.sin(t * 2 + seed)})`;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.45, r * 0.85, r * 0.65, 0, 0, TAU);
  ctx.fill();
  rockBody(ctx, r, size, seed, '#8F958F', '#727873', '#575D58');
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

/**
 * Corps d'un rocher selon sa taille : petit, un galet arrondi et un caillou à côté ; moyen, un bloc à trois faces ;
 * gros, un éperon pointu qui se dresse derrière un bloc. Rend le milieu du dessus (pour la mousse) et l'échelle de ce dessus.
 */
function rockBody(ctx: Ctx, r: number, size: number, seed: number, light: string, mid: string, dark: string) {
  const flip = hash2(seed, 3, 11) < 0.5 ? -1 : 1; // pas tous tournés du même côté
  if (size < 0.85) {
    blot(ctx, r * 0.95 * flip, r * 0.42, r * 0.3, r * 0.2, dark);
    blot(ctx, r * 0.9 * flip, r * 0.37, r * 0.24, r * 0.15, mid);
    blot(ctx, r * 0.1, r * 0.06, r * 0.95, r * 0.6, dark);
    blot(ctx, -r * 0.04, -r * 0.04, r * 0.88, r * 0.55, mid);
    blot(ctx, -r * 0.25, -r * 0.24, r * 0.5, r * 0.26, light, -0.25);
    blot(ctx, -r * 0.4, -r * 0.33, r * 0.14, r * 0.06, 'rgba(255,255,255,0.25)', -0.25);
    return { x: -r * 0.1, y: -r * 0.42, k: 0.75 };
  }
  if (size <= 1.2) {
    facetRock(ctx, r, light, mid, dark);
    return { x: -r * 0.2, y: -r * 0.6, k: 1 };
  }
  // éperon : une aiguille de roche derrière, penchée, puis le bloc devant (un peu plus petit, décalé)
  const lean = (hash2(seed, 5, 11) - 0.5) * 0.3;
  ctx.save();
  ctx.scale(flip, 1);
  fillPoly(ctx, [[r * 0.05, r * 0.1], [r * (0.25 + lean), -r * 1.45], [r * (0.42 + lean), -r * 1.3], [r * 0.4, r * 0.2]], light);
  fillPoly(ctx, [[r * 0.4, r * 0.2], [r * (0.42 + lean), -r * 1.3], [r * (0.62 + lean), -r * 1.05], [r * 0.9, -r * 0.1], [r * 0.85, r * 0.3]], dark);
  ctx.strokeStyle = 'rgba(40,46,42,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(r * (0.3 + lean * 0.5), -r * 0.9);
  ctx.lineTo(r * 0.28, -r * 0.5);
  ctx.moveTo(r * (0.36 + lean * 0.7), -r * 1.1);
  ctx.lineTo(r * 0.4, -r * 0.75);
  ctx.stroke();
  ctx.translate(-r * 0.22, r * 0.12);
  facetRock(ctx, r * 0.85, light, mid, dark);
  // un petit bloc tombé de l'éperon, à son pied
  ctx.translate(r * 1.1, r * 0.25);
  facetRock(ctx, r * 0.3, light, mid, dark);
  ctx.restore();
  return { x: (-r * 0.22 - r * 0.17) * flip, y: r * 0.12 - r * 0.51, k: 0.85 };
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
  ctx.font = `600 ${Math.round(13 * textScale())}px Outfit, sans-serif`; // (taille : réglage)
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
export const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0).join(',');

/** owner : couleur du dompteur dont l'Alpha légendaire a lancé l'attaque (absente : un sauvage). */
export function drawHazard(ctx: Ctx, h: number[], t: number, owner?: string, since = 0) {
  const [kind, x, y, r, x2, y2, prog, ally] = h;
  // rouge : attaque d'un géant (à esquiver) ; couleur du dompteur : attaque de son Alpha légendaire (elle ne touche que les sauvages)
  const ember = ally ? rgbOf(owner ?? '#F0B64A') : '232,105,63';
  const k = prog / 100;
  const active = prog >= 100;
  const style = HAZARD_STYLES[h[8]];
  if (style && drawBossHazard(ctx, style, h, t, k, active, since, ember)) return;
  if (style === 'lava') return drawLavaPool(ctx, x, y, r, active, t, ember, !!ally);
  if (style === 'flame') return drawFlameJet(ctx, x, y, x2, y2, r, k, active, t, ember, !!ally);
  if (style === 'breath') return drawFlameJet(ctx, x, y, x2, y2, r, k, active, t, ally ? ember : '80,170,220', !!ally, WATER_JET);
  if (style === 'pincer') return drawPincerArc(ctx, x, y, x2, y2, r, k, active, ember);
  if (style === 'bubble') return drawBubble(ctx, x, y, r, k, active, t, ember, !!ally);
  if (style === 'tongue') return drawTongue(ctx, x, y, x2, y2, r, k, active, t, ember);
  if (style === 'geyser') return drawGeyser(ctx, x, y, r, k, active, t, ember, !!ally);
  if (style === 'crater') return drawFireCrater(ctx, x, y, r, active, t, ally ? ember : '79,139,255', !!ally);
  if (style === 'tornado' && active) return; // la tornade elle-même passe au-dessus des créatures (drawTornado)
  if (style === 'pound' && active) return; // le sol fissuré suffit (fx)
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
  // annonce circulaire : bord net, remplissage qui grossit jusqu'à l'impact (la même ellipse que le serveur, HAZARD_FLAT)
  const color = style === 'ink' ? '120,80,160' : kind === 2 ? '160,200,90' : kind === 3 ? '238,231,215' : ember;
  ctx.fillStyle = `rgba(${color},0.14)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * HAZARD_FLAT, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = active ? 'rgba(255,220,180,0.55)' : `rgba(${color},0.38)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * k, r * k * HAZARD_FLAT, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${color},0.95)`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * HAZARD_FLAT, 0, 0, TAU);
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
/** Couleurs d'un jet : du bord (le plus large) au cœur, puis les étincelles (ou gouttes). */
interface JetLook {
  layers: [number, string][];
  ally: (ember: string) => [number, string][];
  spark: string; // « r,g,b »
}
const FLAME_JET: JetLook = {
  layers: [[1.7, 'rgba(200,50,20,0.5)'], [1.15, 'rgba(255,140,50,0.85)'], [0.55, 'rgba(255,240,170,0.95)']],
  ally: (e) => [[1.7, `rgba(${e},0.4)`], [1.15, `rgba(${e},0.7)`], [0.55, 'rgba(255,250,230,0.9)']],
  spark: '255,220,140',
};
/** Souffle de l'hydre : un jet d'eau sous pression, écume blanche au cœur. */
const WATER_JET: JetLook = {
  layers: [[1.6, 'rgba(40,110,160,0.45)'], [1.1, 'rgba(90,180,225,0.8)'], [0.5, 'rgba(235,250,255,0.95)']],
  ally: (e) => [[1.6, `rgba(${e},0.4)`], [1.1, 'rgba(120,200,235,0.7)'], [0.5, 'rgba(240,252,255,0.92)']],
  spark: '220,245,255',
};

function drawFlameJet(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, t: number, ember: string, ally: boolean, look = FLAME_JET) {
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
  const layers = ally ? look.ally(ember) : look.layers;
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
    ctx.fillStyle = `rgba(${look.spark},${1 - f})`;
    ctx.beginPath();
    ctx.arc(len * (0.3 + f * 0.75), Math.sin(i * 2.1 + t * 5) * r * (0.4 + f), 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Rayon runique en cours : son œil (ox, oy), le bout au sol (tx, ty) et la base du couloir au sol (gx, gy). */
export interface Laser {
  ox: number; oy: number; tx: number; ty: number; gx: number; gy: number;
  r: number; // demi-largeur de la zone qui brûle
  k: number; // annonce : 0 → 1
  since: number; // secondes depuis l'allumage (0 : pas encore allumé)
  fade: number; // 1, puis vers 0 quand il s'éteint
  glow: string; // « r,g,b » du faisceau (runes du géant, ou couleur du dompteur pour un Alpha légendaire)
  ember: string; // « r,g,b » de l'annonce au sol
}

/**
 * Rayon runique de l'Œil des Ruines.
 * Annonce : couloir au sol qui se remplit, viseur qui grésille de l'œil jusqu'au sol, énergie aspirée dans l'œil.
 * Tir : le faisceau jaillit jusqu'au sol, éclair à l'œil ; puis il pulse (cœur blanc, halo, ondes d'énergie qui filent
 * vers le bout, spirales autour), et là où il touche le sol, une gerbe de lumière.
 */
export function drawLaser(ctx: Ctx, l: Laser, t: number) {
  const { ox, oy, r, glow } = l;
  ctx.save();
  ctx.globalAlpha = l.fade;
  if (!l.since) {
    // couloir au sol (zone qui va brûler)
    const ga = Math.atan2(l.ty - l.gy, l.tx - l.gx), glen = Math.hypot(l.tx - l.gx, l.ty - l.gy);
    ctx.save();
    ctx.translate(l.gx, l.gy);
    ctx.rotate(ga);
    ctx.fillStyle = `rgba(${l.ember},0.12)`;
    ctx.fillRect(0, -r, glen, r * 2);
    ctx.fillStyle = `rgba(${l.ember},0.28)`;
    ctx.fillRect(0, -r, glen * l.k, r * 2);
    ctx.restore();
    // viseur : un fil rouge qui grésille, de plus en plus net
    const flick = 0.55 + 0.45 * Math.abs(Math.sin(t * 37)) * (0.4 + 0.6 * l.k);
    ctx.strokeStyle = `rgba(255,90,70,${(0.25 + 0.6 * l.k) * flick})`;
    ctx.lineWidth = 1 + l.k * 1.5;
    ctx.setLineDash([12, 7]);
    ctx.lineDashOffset = -t * 120;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(l.tx, l.ty);
    ctx.stroke();
    ctx.setLineDash([]);
    // point de visée au sol
    ctx.strokeStyle = `rgba(255,90,70,${0.4 + 0.5 * l.k})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(l.tx, l.ty, r * (1.4 - 0.5 * l.k), r * (0.8 - 0.3 * l.k), 0, 0, TAU);
    ctx.stroke();
    // l'œil aspire la lumière : étincelles qui convergent, boule qui grossit
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const f = (t * 1.8 + i / 10) % 1, a = i * 2.4 + t * 0.7, d = (1 - f) * (40 + r * 2);
      ctx.fillStyle = `rgba(${glow},${f * (0.4 + 0.6 * l.k)})`;
      ctx.beginPath();
      ctx.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d * 0.8, 1.5 + f * 2, 0, TAU);
      ctx.fill();
    }
    const orb = r * (0.25 + 0.65 * l.k) * (1 + Math.sin(t * 30) * 0.08);
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, `rgba(${glow},0.7)`);
    g.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ox, oy, orb * 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  // le faisceau jaillit en 0,12 s, puis reste tendu jusqu'au sol
  const grow = Math.min(1, l.since / 0.12);
  const ex = ox + (l.tx - ox) * grow, ey = oy + (l.ty - oy) * grow;
  const ang = Math.atan2(ey - oy, ex - ox), len = Math.hypot(ex - ox, ey - oy);
  const pulse = 1 + Math.sin(t * 38) * 0.1 + Math.sin(t * 71) * 0.05, flash = Math.max(0, 1 - l.since / 0.25);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.translate(ox, oy);
  ctx.rotate(ang);
  // halo, rayon, cœur
  for (const [w, col] of [[2.8, `rgba(${glow},0.14)`], [1.7, `rgba(${glow},0.28)`], [1, `rgba(${glow},0.55)`], [0.3, 'rgba(255,255,255,0.85)']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = r * w * pulse * (1 + flash * 0.8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
  }
  // ondes d'énergie qui filent de l'œil vers le sol
  for (let i = 0; i < 6; i++) {
    const f = (t * 2.6 + i / 6) % 1;
    ctx.fillStyle = `rgba(${glow},${0.5 * Math.sin(f * Math.PI)})`;
    ctx.beginPath();
    ctx.ellipse(len * f, 0, r * 1.1, r * 0.6 * pulse, 0, 0, TAU);
    ctx.fill();
  }
  // deux spirales qui s'enroulent autour du faisceau
  ctx.lineWidth = 2;
  for (const ph of [0, Math.PI]) {
    ctx.strokeStyle = `rgba(${glow},0.55)`;
    ctx.beginPath();
    for (let x = 0; x <= len; x += 6) {
      const y = Math.sin(x / 16 - t * 22 + ph) * r * 0.85 * pulse;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // éclats qui s'échappent sur les côtés
  for (let i = 0; i < 10; i++) {
    const f = (t * 1.7 + i * 0.137) % 1, side = i % 2 ? 1 : -1;
    ctx.fillStyle = `rgba(255,255,255,${1 - f})`;
    ctx.beginPath();
    ctx.arc(len * ((i * 0.31 + t * 0.5) % 1), side * (r * 0.5 + f * r * 1.8), 1.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // à l'œil : éclat et rayons qui tournent
  ctx.save();
  ctx.globalAlpha = l.fade;
  ctx.globalCompositeOperation = 'lighter';
  const eye = r * (0.9 + flash * 1.6) * pulse;
  const ge = ctx.createRadialGradient(ox, oy, 0, ox, oy, eye * 2);
  ge.addColorStop(0, 'rgba(255,255,255,1)');
  ge.addColorStop(0.4, `rgba(${glow},0.7)`);
  ge.addColorStop(1, `rgba(${glow},0)`);
  ctx.fillStyle = ge;
  ctx.beginPath();
  ctx.arc(ox, oy, eye * 2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${glow},0.6)`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = t * 3 + (i * TAU) / 4;
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(a) * eye * 0.6, oy + Math.sin(a) * eye * 0.6);
    ctx.lineTo(ox + Math.cos(a) * eye * 2.4, oy + Math.sin(a) * eye * 2.4);
    ctx.stroke();
  }
  // au sol, là où il frappe : gerbe de lumière aplatie et anneau qui s'élargit
  if (grow >= 1) {
    const hit = r * (1.6 + Math.sin(t * 29) * 0.25);
    const gh = ctx.createRadialGradient(ex, ey, 0, ex, ey, hit * 2);
    gh.addColorStop(0, 'rgba(255,255,255,0.95)');
    gh.addColorStop(0.3, `rgba(${glow},0.65)`);
    gh.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = gh;
    ctx.beginPath();
    ctx.ellipse(ex, ey, hit * 2, hit * 1.2, 0, 0, TAU);
    ctx.fill();
    const f = (t * 3) % 1;
    ctx.strokeStyle = `rgba(${glow},${0.8 * (1 - f)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(ex, ey, hit * (0.6 + f * 1.8), hit * (0.35 + f * 1.05), 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** Toile accrochée au dompteur ralenti. */
/**
 * Compétences d'Alpha en cours sur un allié, au-dessus de sa tête : une épée et deux flèches qui montent (cri du suricate :
 * il frappe plus fort), un bouclier et sa flèche (carapace de l'escargot : il encaisse moins).
 */
/**
 * Grande pince du Crabe Titan. Annonce : l'arc devant lui se remplit depuis sa carapace ; coup : une énorme entaille
 * blanche en croissant, qui balaie l'arc d'un bord à l'autre et s'efface.
 */
function drawPincerArc(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, ember: string) {
  const ang = Math.atan2(y2 - y, x2 - x), a0 = ang - PINCER_HALF, a1 = ang + PINCER_HALF;
  const wedge = (rr: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, rr, a0, a1);
    ctx.closePath();
  };
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.14)`;
    wedge(r);
    ctx.fill();
    ctx.fillStyle = `rgba(${ember},0.36)`;
    wedge(r * k);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ember},0.95)`;
    ctx.lineWidth = 3;
    wedge(r);
    ctx.stroke();
    // deux dents de pince qui se referment au bout de l'arc, à mesure que le coup approche
    ctx.strokeStyle = `rgba(${ember},0.8)`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const sd of [-1, 1]) {
      const a = ang + sd * PINCER_HALF * (1 - 0.7 * k);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
    return;
  }
  // l'entaille : trois croissants, du plus large (pâle) au plus fin (blanc)
  ctx.save();
  ctx.lineCap = 'round';
  for (const [w, col, f] of [[22, 'rgba(255,190,150,0.35)', 0.92], [12, 'rgba(255,235,215,0.8)', 0.8], [4, 'rgba(255,255,255,1)', 0.68]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(x, y, r * f, a0, a1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Bulle d'écume du Crabe Titan : elle gonfle sous sa cible, irisée, et tremble avant d'éclater. */
function drawBubble(ctx: Ctx, x: number, y: number, r: number, k: number, active: boolean, t: number, ember: string, ally: boolean) {
  if (active) return; // elle a éclaté : l'éclaboussure (fx) prend le relais
  ctx.strokeStyle = `rgba(${ember},0.75)`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  const rr = r * (0.25 + 0.75 * k) * (1 + Math.sin(t * 30) * 0.03 * k), cy = y - rr * 0.85;
  const g = ctx.createRadialGradient(x - rr * 0.35, cy - rr * 0.35, rr * 0.1, x, cy, rr);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, ally ? `rgba(${ember},0.18)` : 'rgba(170,225,240,0.18)');
  g.addColorStop(1, ally ? `rgba(${ember},0.5)` : 'rgba(200,170,240,0.45)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, cy, rr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,250,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // reflet, et l'écume au pied de la bulle
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(x - rr * 0.4, cy - rr * 0.45, rr * 0.18, rr * 0.1, -0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(240,248,250,0.75)';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + t * 0.8;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * rr * 0.25, 2 + (i % 3), 0, TAU);
    ctx.fill();
  }
}

/** Langue du Crapaud-Roi. Annonce : un couloir rose ; coup : la langue jaillit, bout gluant, et se rétracte. */
function drawTongue(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, t: number, ember: string) {
  const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.14)`;
    ctx.fillRect(0, -r, len, r * 2);
    ctx.fillStyle = 'rgba(232,110,150,0.32)';
    ctx.fillRect(0, -r, len * k, r * 2);
    ctx.strokeStyle = `rgba(${ember},0.9)`;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(0, -r, len, r * 2);
    ctx.restore();
    return;
  }
  // la langue, un peu ondulée, plus épaisse au bout
  const wob = (f: number) => Math.sin(f * 7 + t * 20) * r * 0.12 * f;
  ctx.lineCap = 'round';
  for (const [w, col] of [[r * 0.75, '#8E2F4A'], [r * 0.5, '#E0708F']] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const f = i / 10;
      if (i) ctx.lineTo(len * f, wob(f));
      else ctx.moveTo(0, 0);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#E0708F';
  ctx.beginPath();
  ctx.ellipse(len, wob(1), r * 0.7, r * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,220,230,0.7)';
  ctx.beginPath();
  ctx.ellipse(len - r * 0.15, wob(1) - r * 0.2, r * 0.25, r * 0.14, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Geyser de l'hydre : le sol se gorge d'eau et bouillonne, puis une colonne d'eau jaillit d'un coup. */
function drawGeyser(ctx: Ctx, x: number, y: number, r: number, k: number, active: boolean, t: number, ember: string, ally: boolean) {
  const water = ally ? ember : '90,180,225';
  if (!active) {
    ctx.fillStyle = `rgba(${water},${0.12 + 0.25 * k})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.5 + 0.5 * k), r * (0.5 + 0.5 * k) * 0.75, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ember},0.9)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
    ctx.stroke();
    // bulles qui remontent, de plus en plus nombreuses
    ctx.fillStyle = 'rgba(230,248,255,0.85)';
    const n = 3 + Math.round(9 * k);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4 + Math.floor(t * 6 + i) * 0.7, d = r * 0.6 * ((i * 37) % 10) / 10;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 2 + ((t * 8 + i) % 3), 0, TAU);
      ctx.fill();
    }
    return;
  }
  // la colonne : un fût d'eau haut, écume au sommet, gerbe au pied
  const h = r * 3.4, w = r * 0.55;
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, `rgba(${water},0.55)`);
  g.addColorStop(0.5, 'rgba(240,252,255,0.95)');
  g.addColorStop(1, `rgba(${water},0.55)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.7 + Math.sin(t * 25) * 3, y - h * 0.5, x - w * 0.9, y - h);
  ctx.lineTo(x + w * 0.9, y - h);
  ctx.quadraticCurveTo(x + w * 0.7 + Math.cos(t * 25) * 3, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(245,252,255,0.9)';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + t * 3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * w * 1.1, y - h + Math.sin(a) * w * 0.4, w * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(${water},0.4)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.fill();
}

/**
 * Cratère de feu laissé par Lueur à l'arrivée de sa téléportation : un sol creusé et noirci, au bord rougeoyant,
 * où dansent des flammes bleues (la couleur du dompteur pour un Alpha légendaire).
 */
function drawFireCrater(ctx: Ctx, x: number, y: number, r: number, active: boolean, t: number, flame: string, ally: boolean) {
  if (!active) return; // il n'existe qu'après l'arrivée
  const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  g.addColorStop(0, `rgba(${flame},0.55)`);
  g.addColorStop(0.35, 'rgba(24,18,22,0.9)');
  g.addColorStop(0.8, 'rgba(40,28,26,0.85)');
  g.addColorStop(1, 'rgba(40,28,26,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, 0, 0, TAU);
  ctx.fill();
  // bord rougeoyant, fendillé
  ctx.strokeStyle = `rgba(${flame},${0.6 + 0.2 * Math.sin(t * 5)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 18; i++) {
    const a = (i / 18) * TAU, d = r * (0.78 + 0.06 * Math.sin(a * 5 + x));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.72;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.stroke();
  // flammes qui lèchent le bord et le fond
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + x * 0.01, d = r * (i % 3 === 0 ? 0.3 : 0.75), fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.72;
    const h = r * (0.28 + 0.16 * Math.sin(t * 9 + i * 1.7)), w = r * 0.09;
    ctx.fillStyle = `rgba(${flame},0.75)`;
    ctx.beginPath();
    ctx.moveTo(fx - w, fy);
    ctx.quadraticCurveTo(fx - w * 0.6, fy - h * 0.6, fx + Math.sin(t * 7 + i) * w, fy - h);
    ctx.quadraticCurveTo(fx + w * 0.6, fy - h * 0.6, fx + w, fy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ally ? 'rgba(255,250,235,0.7)' : 'rgba(220,240,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(fx, fy - h * 0.25, w * 0.4, h * 0.22, 0, 0, TAU);
    ctx.fill();
  }
}

/**
 * Tornade du Roi-Vautour : un entonnoir de vent et de sable qui tourne, étroit au sol et large en haut, avec un
 * anneau de poussière à sa base et des débris qui tournoient (dessiné au-dessus des créatures).
 */
export function drawTornado(ctx: Ctx, x: number, y: number, r: number, t: number, dust: string, fade = 1) {
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = `rgba(${dust},0.25)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.4, r * 0.55, 0, 0, TAU);
  ctx.fill();
  const H = r * 3.6, n = 9;
  // le corps de l'entonnoir : un voile de sable, plus dense en bas
  const body = ctx.createLinearGradient(0, y, 0, y - H);
  body.addColorStop(0, `rgba(${dust},0.5)`);
  body.addColorStop(1, `rgba(${dust},0.12)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const f = i / 12, w = r * (0.25 + 1.05 * f * f + 0.15 * f), sway = Math.sin(t * 2.2 + f * 3) * r * 0.25 * f;
    ctx.lineTo(x + sway - w, y - f * H);
  }
  for (let i = 12; i >= 0; i--) {
    const f = i / 12, w = r * (0.25 + 1.05 * f * f + 0.15 * f), sway = Math.sin(t * 2.2 + f * 3) * r * 0.25 * f;
    ctx.lineTo(x + sway + w, y - f * H);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), cy = y - f * H, w = r * (0.25 + 1.05 * f * f + 0.15 * f), sway = Math.sin(t * 2.2 + f * 3) * r * 0.25 * f;
    ctx.strokeStyle = `rgba(${dust},${0.75 - 0.4 * f})`;
    ctx.lineWidth = 3 + 4 * (1 - f);
    ctx.beginPath();
    const a0 = t * 7 + i * 0.9;
    ctx.ellipse(x + sway, cy, w, w * 0.32, 0, a0, a0 + Math.PI * 1.4);
    ctx.stroke();
  }
  // filets de vent clairs qui montent en spirale
  ctx.strokeStyle = 'rgba(250,245,235,0.55)';
  ctx.lineWidth = 1.5;
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const f = i / 20, a = t * 6 + f * 9 + s * 2.1, w = r * (0.25 + 1.05 * f * f);
      const px = x + Math.sin(t * 2.2 + f * 3) * r * 0.25 * f + Math.cos(a) * w, py = y - f * H + Math.sin(a) * w * 0.32;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  // débris et plumes qui tournoient
  ctx.fillStyle = 'rgba(70,56,44,0.85)';
  for (let i = 0; i < 8; i++) {
    const f = ((t * 0.35 + i / 8) % 1), a = t * 5 + i * 2.3, w = r * (0.3 + 1.0 * f * f);
    ctx.fillRect(x + Math.cos(a) * w - 2, y - f * H + Math.sin(a) * w * 0.32 - 2, 4, 3);
  }
  ctx.restore();
}

export function drawBuffs(ctx: Ctx, x: number, y: number, flags: number, t: number, seed: number) {
  const icons = [flags & UNIT_FLAG_RALLY ? 'rally' : '', flags & UNIT_FLAG_GUARD ? 'guard' : '', flags & UNIT_FLAG_POISON ? 'poison' : '', flags & UNIT_FLAG_CURSE ? 'curse' : '', flags & UNIT_FLAG_BURN ? 'burn' : ''].filter(Boolean);
  const bob = Math.sin(t * 4 + seed) * 1.5;
  icons.forEach((kind, i) => {
    const cx = x + (i - (icons.length - 1) / 2) * 20, cy = y + bob;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(16,24,26,0.65)';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, TAU);
    ctx.fill();
    const col = kind === 'rally' ? '#F0B64A' : kind === 'poison' ? '#8FD14A' : kind === 'curse' ? '#C890F0' : '#7FC8E8';
    if (kind === 'burn') {
      // il brûle : une flamme qui danse
      const f = Math.sin(t * 14 + seed) * 0.8;
      ctx.fillStyle = '#FF6A2A';
      ctx.beginPath();
      ctx.moveTo(0, -7 + f);
      ctx.quadraticCurveTo(5.5, -1, 3.5, 4);
      ctx.quadraticCurveTo(0, 6.5, -3.5, 4);
      ctx.quadraticCurveTo(-5.5, -1, 0, -7 + f);
      ctx.fill();
      ctx.fillStyle = '#FFD27A';
      ctx.beginPath();
      ctx.moveTo(0, -2 + f * 0.5);
      ctx.quadraticCurveTo(2.5, 1.5, 1.5, 3.8);
      ctx.quadraticCurveTo(0, 4.8, -1.5, 3.8);
      ctx.quadraticCurveTo(-2.5, 1.5, 0, -2 + f * 0.5);
      ctx.fill();
      ctx.restore();
      return;
    }
    if (kind === 'curse') {
      // maudit : un petit masque violet qui palpite
      drawCurseMask(ctx, 0, 0.5, 5.5 + Math.sin(t * 6 + seed) * 0.6, col);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'rally') {
      // épée : lame, garde, pommeau
      ctx.beginPath();
      ctx.moveTo(-2, 5);
      ctx.lineTo(-2, -5);
      ctx.moveTo(-5, 2.5);
      ctx.lineTo(1, 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3.3, -4.5);
      ctx.lineTo(-2, -7);
      ctx.lineTo(-0.7, -4.5);
      ctx.fill();
    } else if (kind === 'poison') {
      // goutte de poison, et des bulles qui montent
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(5, 1, 0, 5);
      ctx.quadraticCurveTo(-5, 1, 0, -6);
      ctx.fill();
      const b = (t * 1.5 + seed * 0.3) % 1;
      ctx.globalAlpha = 1 - b;
      ctx.beginPath();
      ctx.arc(5, 2 - b * 8, 1.6, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-5, 4 - ((b + 0.5) % 1) * 8, 1.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    } else {
      // bouclier
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(1, -5);
      ctx.lineTo(1, 0);
      ctx.quadraticCurveTo(1, 4, -2.5, 6);
      ctx.quadraticCurveTo(-6, 4, -6, 0);
      ctx.closePath();
      ctx.stroke();
    }
    // flèches vers le haut, qui montent en boucle
    const k = (t * 1.2 + seed * 0.37) % 1;
    for (const [ax, dy] of kind === 'rally' ? [[4, 0], [6.5, -4]] : [[5, -1]]) {
      const ay = 3 - k * 3 + dy;
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 3);
      ctx.lineTo(ax, ay - 3);
      ctx.moveTo(ax - 2.2, ay - 0.8);
      ctx.lineTo(ax, ay - 3);
      ctx.lineTo(ax + 2.2, ay - 0.8);
      ctx.stroke();
    }
    ctx.restore();
  });
}

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

/**
 * Souche d'un arbre abattu (il repoussera), posée au pied (x, y) de l'arbre dessiné et à sa taille s (celle du dessin :
 * un géant de la jungle laisse une grosse souche) : le tronc coupé net, ses racines évasées (flare : leur portée, en s).
 */
export function drawStump(ctx: Ctx, x: number, y: number, s: number, flare = 0.36) {
  const w = Math.max(6, s * 0.2), h = s * 0.3, top = y - h, root = s * flare;
  // les racines, qui s'étalent au sol
  ctx.fillStyle = '#4A3424';
  ctx.beginPath();
  ctx.moveTo(x - w, top + h * 0.3);
  ctx.quadraticCurveTo(x - w * 1.1, y - h * 0.15, x - root, y + 1);
  ctx.lineTo(x + root, y + 1);
  ctx.quadraticCurveTo(x + w * 1.1, y - h * 0.15, x + w, top + h * 0.3);
  ctx.closePath();
  ctx.fill();
  // le tronc coupé
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x - w, top, w * 2, h * 0.85);
  ctx.fillStyle = 'rgba(255,230,200,0.12)';
  ctx.fillRect(x - w * 0.55, top + w * 0.3, w * 0.25, h * 0.55);
  // le dessus, coupé net, et ses cernes
  ctx.fillStyle = '#C9A36E';
  ctx.beginPath();
  ctx.ellipse(x, top, w, w * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,75,45,0.7)';
  ctx.lineWidth = 1;
  for (const k of [0.65, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(x, top, w * k, w * 0.42 * k, 0, 0, TAU);
    ctx.stroke();
  }
}

/**
 * Goutte de sueur d'un géant apeuré, sur son front (x, y) : elle perle, coule le long de sa tempe, puis tombe et
 * s'efface ; une nouvelle perle aussitôt. size : sa taille (selon celle du géant).
 */
export function drawSweat(ctx: Ctx, x: number, y: number, size: number, t: number, seed = 0) {
  const k = ((t + seed) % 1.3) / 1.3;
  const grow = Math.min(1, k / 0.3), slide = k < 0.3 ? 0 : (k - 0.3) / 0.7;
  const dy = slide * slide * size * 7, a = slide > 0.75 ? 1 - (slide - 0.75) / 0.25 : 1, w = size * (0.55 + 0.45 * grow);
  const cx = x + slide * size * 0.8, cy = y + dy;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = '#9ED8FF';
  ctx.strokeStyle = 'rgba(30,60,90,0.8)';
  ctx.lineWidth = Math.max(1, size * 0.14);
  ctx.beginPath(); // goutte : pointe en haut, ventre rond en bas
  ctx.moveTo(cx, cy - w * 1.6);
  ctx.quadraticCurveTo(cx + w * 1.05, cy - w * 0.2, cx + w * 0.8, cy + w * 0.35);
  ctx.arc(cx, cy + w * 0.35, w * 0.8, 0, Math.PI);
  ctx.quadraticCurveTo(cx - w * 1.05, cy - w * 0.2, cx, cy - w * 1.6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.3, cy + w * 0.1, w * 0.18, w * 0.32, -0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ───────────────────────── Foudre sur le bûcheron ─────────────────────────

export const STRUCK_S = 3.4; // durée de l'animation d'un dompteur foudroyé (l'étourdissement, lui, dure moins)

/**
 * Éclair qui tombe du ciel sur (x, y) : un tronc brisé et ses fourches, qui scintille en trois ou quatre décharges de
 * plus en plus faibles (le tracé change à chaque décharge), et un halo aveuglant au point d'impact.
 */
export function drawSkyBolt(ctx: Ctx, x: number, y: number, age: number, seed: number) {
  const pulses: [number, number, number][] = [[0, 0.09, 1], [0.13, 0.22, 0.8], [0.27, 0.34, 0.55], [0.39, 0.45, 0.3]];
  const p = pulses.find(([a, b]) => age >= a && age < b);
  if (!p) return;
  const k = p[2], frame = pulses.indexOf(p) * 7 + Math.floor(age * 40), top = y - 1000, n = 18;
  // le tronc : une marche au hasard qui revient sur sa cible en bas
  const pts: [number, number][] = [];
  let walk = 0;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    walk += (hash2(i, frame, seed) - 0.5) * 70;
    pts.push([x + walk * (1 - f) ** 0.8 * (i < n ? 1 : 0), top + (y - top) * f]);
  }
  // les fourches : elles partent du tronc, filent de biais vers le bas et s'affinent
  const forks: [number, number][][] = [];
  for (let b = 0; b < 4; b++) {
    const from = 3 + Math.floor(hash2(b, frame, seed + 1) * (n - 7)), side = hash2(frame, b, seed + 2) < 0.5 ? -1 : 1;
    let [fx, fy] = pts[from];
    const fork: [number, number][] = [[fx, fy]];
    for (let j = 0; j < 5; j++) {
      fx += side * (14 + hash2(j, b + frame, seed + 3) * 26);
      fy += 22 + hash2(b, j + frame, seed + 4) * 26;
      fork.push([fx, fy]);
    }
    forks.push(fork);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const line = (path: [number, number][], w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    path.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  };
  for (const [w, col] of [[26, `rgba(110,140,255,${0.22 * k})`], [11, `rgba(180,205,255,${0.55 * k})`], [4, `rgba(255,255,255,${k})`]] as const) {
    line(pts, w, col);
    for (const f of forks) line(f, w * 0.45, col);
  }
  // halo d'impact
  const g = ctx.createRadialGradient(x, y, 0, x, y, 150);
  g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
  g.addColorStop(0.25, `rgba(190,210,255,${0.5 * k})`);
  g.addColorStop(1, 'rgba(120,150,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, 150, 110, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Dompteur foudroyé, dessiné par-dessus lui (corps rond de rayon 16 centré en x, y) : d'abord la « radiographie » de
 * dessin animé (son crâne apparaît en clignotant), puis des arcs électriques qui crépitent autour de lui, le visage
 * noirci de suie où ne restent que deux yeux ronds, et de la fumée qui monte de sa tête.
 */
export function drawStruck(ctx: Ctx, x: number, y: number, age: number, t: number, seed: number) {
  const R = 16;
  // fumée : des bouffées grises qui montent et se dissipent
  for (let i = 0; i < 7; i++) {
    const born = 0.3 + i * 0.32, k = (age - born) / 1.6;
    if (k <= 0 || k >= 1) continue;
    const px = x + Math.sin(i * 2.1 + seed) * 6 + Math.sin(k * 5 + i) * 5 + k * 10, py = y - R - 4 - k * 52;
    ctx.fillStyle = `rgba(74,72,76,${0.5 * (1 - k) * Math.min(1, k * 6)})`;
    ctx.beginPath();
    ctx.arc(px, py, 4 + 10 * k, 0, TAU);
    ctx.fill();
  }
  const xray = age < 0.8 && Math.floor(age * 16) % 2 === 0;
  if (xray) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(140,180,255,0.55)';
    ctx.beginPath();
    ctx.arc(x, y, R + 8, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#1B2A5E'; // le corps, sombre et bleuté
    ctx.strokeStyle = '#BFD4FF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, R + 1, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // le crâne
    ctx.fillStyle = '#F4F7FF';
    ctx.beginPath();
    ctx.ellipse(x, y - 2.5, 11, 9.5, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x - 6.5, y + 3, 13, 7, 2.5);
    ctx.fill();
    ctx.fillStyle = '#1B2A5E';
    ctx.beginPath();
    ctx.ellipse(x - 4.3, y - 2, 3.1, 3.6, 0, 0, TAU);
    ctx.ellipse(x + 4.3, y - 2, 3.1, 3.6, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x - 1.6, y + 3.6);
    ctx.lineTo(x + 1.6, y + 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1B2A5E';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(x + i * 2.4, y + 5.5);
      ctx.lineTo(x + i * 2.4, y + 9.5);
    }
    ctx.stroke();
  } else if (age < 3) {
    // de la suie sur tout le corps, et deux yeux ronds écarquillés qui clignent
    const fade = age < 2.2 ? 1 : 1 - (age - 2.2) / 0.8;
    ctx.fillStyle = `rgba(24,20,18,${0.62 * fade})`;
    ctx.beginPath();
    ctx.arc(x, y, R + 0.5, 0, TAU);
    ctx.fill();
    const blink = Math.sin(t * 3 + seed) > 0.96 ? 0.25 : 1;
    ctx.fillStyle = `rgba(255,255,255,${fade})`;
    ctx.beginPath();
    ctx.ellipse(x - 4.5, y - 2, 3.2, 3.4 * blink, 0, 0, TAU);
    ctx.ellipse(x + 4.5, y - 2, 3.2, 3.4 * blink, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(16,24,26,${fade})`;
    ctx.beginPath();
    ctx.arc(x - 4.5, y - 2, 1.3 * blink, 0, TAU);
    ctx.arc(x + 4.5, y - 2, 1.3 * blink, 0, TAU);
    ctx.fill();
  }
  // arcs électriques qui crépitent autour de lui (le tracé change vingt fois par seconde)
  const zap = 1 - age / 1.8;
  if (zap > 0) {
    const frame = Math.floor(t * 20);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      if (hash2(frame, i, seed + 7) < 0.25) continue; // un arc s'éteint parfois une image
      const a0 = hash2(frame, i, seed) * TAU, sweep = 0.9 + hash2(i, frame, seed + 5) * 0.9, pts: [number, number][] = [];
      for (let j = 0; j <= 6; j++) {
        const a = a0 + (sweep * j) / 6, rr = R + 3 + hash2(j, frame + i, seed + 6) * 9;
        pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9]);
      }
      for (const [w, col] of [[4.5, `rgba(110,160,255,${0.55 * zap})`], [1.6, `rgba(240,248,255,${zap})`]] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/** Bouquet de bambous coupé : des tiges vertes tranchées en biseau, à des hauteurs différentes, creuses au cœur. */
export function drawBambooStump(ctx: Ctx, x: number, y: number, r: number, seed: number) {
  const n = 5, span = Math.max(14, r * 1.3);
  ctx.fillStyle = 'rgba(8,16,10,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, span * 0.85, span * 0.3, 0, 0, TAU);
  ctx.fill();
  const stalks = Array.from({ length: n }, (_, k) => ({
    bx: x + (k / (n - 1) - 0.5) * span * 1.1 + (hash2(k, seed, 151) - 0.5) * 4,
    by: y + (hash2(seed, k, 152) - 0.5) * 6,
    h: 7 + hash2(k, seed, 153) * 11,
    tone: hash2(seed, k, 154),
  })).sort((a, b) => a.by - b.by); // de l'arrière vers l'avant
  for (const st of stalks) {
    const w = 3.2, top = st.by - st.h, cut = 3; // biseau : le côté droit plus haut que le gauche
    ctx.fillStyle = st.tone < 0.45 ? '#5E8A34' : '#7FA846';
    ctx.strokeStyle = 'rgba(30,48,16,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(st.bx - w, st.by);
    ctx.lineTo(st.bx - w, top + cut);
    ctx.lineTo(st.bx + w, top - cut);
    ctx.lineTo(st.bx + w, st.by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,240,160,0.45)'; // reflet
    ctx.beginPath();
    ctx.moveTo(st.bx - w + 1.2, st.by - 1);
    ctx.lineTo(st.bx - w + 1.2, top + cut + 1);
    ctx.stroke();
    if (st.h > 12) {
      ctx.strokeStyle = '#3E5E22'; // un nœud
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(st.bx - w, st.by - 6);
      ctx.lineTo(st.bx + w, st.by - 6);
      ctx.stroke();
    }
    // la coupe : un ovale clair, creux au milieu
    ctx.save();
    ctx.translate(st.bx, top);
    ctx.rotate(-Math.atan2(cut * 2, w * 2));
    ctx.fillStyle = '#D9E6A6';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 1.15, 1.9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6C7E3A';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.6, 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ───────────────────────── Nouvelles attaques des géants ─────────────────────────

const easeIO = (k: number) => k * k * (3 - 2 * k);
/** Contour d'une annonce au sol (ellipse) : bord net et remplissage qui grossit, comme les autres. */
function warnRing(ctx: Ctx, x: number, y: number, r: number, k: number, col: string, dash = false) {
  ctx.fillStyle = `rgba(${col},0.12)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(${col},0.3)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * k, r * k * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(${col},0.95)`;
  ctx.lineWidth = 3;
  if (dash) ctx.setLineDash([12, 9]);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}
/** Couloir annoncé (ligne), avec des chevrons qui filent vers son bout. */
function warnLane(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, col: string, t: number, chevrons = true) {
  const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = `rgba(${col},0.14)`;
  ctx.fillRect(0, -r, len, r * 2);
  ctx.fillStyle = `rgba(${col},0.32)`;
  ctx.fillRect(0, -r, len * k, r * 2);
  ctx.strokeStyle = `rgba(${col},0.9)`;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, -r, len, r * 2);
  if (chevrons) {
    ctx.strokeStyle = `rgba(255,240,220,${0.25 + 0.35 * k})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const gap = 46, off = (t * 160) % gap;
    for (let d = off; d < len - 10; d += gap) {
      ctx.beginPath();
      ctx.moveTo(d - r * 0.35, -r * 0.5);
      ctx.lineTo(d, 0);
      ctx.lineTo(d - r * 0.35, r * 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Traque : une flaque d'ombre se creuse là où il va ressortir ; deux yeux rouges s'y ouvrent. */
function drawShadowPool(ctx: Ctx, x: number, y: number, r: number, k: number, t: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember, true);
  const g = ctx.createRadialGradient(x, y, 2, x, y, r * (0.4 + 0.6 * k));
  g.addColorStop(0, 'rgba(8,4,16,0.9)');
  g.addColorStop(0.6, 'rgba(30,16,46,0.55)');
  g.addColorStop(1, 'rgba(30,16,46,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (0.4 + 0.6 * k), r * (0.3 + 0.45 * k), 0, 0, TAU);
  ctx.fill();
  // fumerolles d'ombre qui montent en tournant
  for (let i = 0; i < 6; i++) {
    const f = (t * 0.8 + i / 6) % 1, a = i * 1.7 + t * 0.6;
    ctx.fillStyle = `rgba(24,12,38,${0.45 * (1 - f) * k})`;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.25 - f * 46, 8 + f * 10, 0, TAU);
    ctx.fill();
  }
  if (k > 0.55) {
    const open = Math.min(1, (k - 0.55) / 0.2), blink = Math.sin(t * 3) > 0.92 ? 0.15 : 1;
    for (const sd of [-1, 1]) {
      ctx.fillStyle = `rgba(255,70,50,${0.9 * open})`;
      ctx.beginPath();
      ctx.ellipse(x + sd * 11, y - 6, 5, 2.6 * open * blink, sd * 0.25, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,140,110,${0.3 * open})`;
      ctx.beginPath();
      ctx.arc(x + sd * 11, y - 6, 10, 0, TAU);
      ctx.fill();
    }
  }
}

/** Ombre qui file au ras du sol (le géant qui traque), avec ses yeux. */
export function drawShadowRun(ctx: Ctx, x: number, y: number, r: number, ang: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  for (let i = 4; i >= 0; i--) {
    ctx.fillStyle = `rgba(14,8,24,${0.18 + 0.12 * (4 - i)})`;
    ctx.beginPath();
    ctx.ellipse(-i * r * 0.32, Math.sin(t * 12 + i) * 3, r * (0.9 - i * 0.12), r * 0.32, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  for (const sd of [-1, 1]) {
    ctx.fillStyle = 'rgba(255,70,50,0.95)';
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(ang) * r * 0.5 + sd * 8, y + Math.sin(ang) * r * 0.25 - 6, 4, 2, 0, 0, TAU);
    ctx.fill();
  }
}

/** Hurlement : des ondes sonores pâles qui partent du loup, jusqu'au bord de la zone. */
function drawHowl(ctx: Ctx, x: number, y: number, r: number, k: number, t: number, ember: string) {
  warnRing(ctx, x, y, r, k * 0.4, ember, true);
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const f = (t * 1.6 + i / 4) % 1, rr = r * f;
    ctx.strokeStyle = `rgba(200,225,255,${0.55 * (1 - f) * (0.4 + 0.6 * k)})`;
    ctx.lineWidth = 3 + 4 * (1 - f);
    for (let a = 0; a < 6; a++) {
      const a0 = (a / 6) * TAU + i * 0.4;
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * 0.75, 0, a0, a0 + 0.6);
      ctx.stroke();
    }
  }
}

/** Flaque de boue : brune, luisante, des bulles qui crèvent. */
function drawMud(ctx: Ctx, x: number, y: number, r: number, active: boolean, k: number, t: number, ember: string) {
  if (!active) {
    warnRing(ctx, x, y, r, k, ember);
    return;
  }
  const seed = (x * 3 + y * 7) % 11;
  ctx.fillStyle = 'rgba(70,48,28,0.9)';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU, d = r * (0.92 + 0.1 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 5 + seed * 2));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // des éclaboussures autour
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + seed, d = r * (1.05 + 0.12 * ((i * 5) % 3));
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 4 + (i % 3) * 2, 3 + (i % 2), a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(104,76,46,0.9)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.1, y - r * 0.05, r * 0.65, r * 0.42, 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,210,0.22)'; // reflet
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.22, r * 0.28, r * 0.08, -0.3, 0, TAU);
  ctx.fill();
  for (let b = 0; b < 4; b++) {
    const f = (t * 0.9 + b / 4 + seed * 0.07) % 1, bx = x + Math.cos(b * 2.1 + seed) * r * 0.5, by = y + Math.sin(b * 2.1 + seed) * r * 0.3;
    ctx.strokeStyle = `rgba(40,26,14,${0.7 * (1 - f)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(bx, by, 2 + f * 7, 1 + f * 4, 0, 0, TAU);
    ctx.stroke();
  }
}

/** Étreinte annoncée : des griffes qui se referment sur la zone. */
function drawHugWarn(ctx: Ctx, x: number, y: number, r: number, k: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember);
  ctx.strokeStyle = `rgba(${ember},0.95)`;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4, d = r * (1.35 - 0.45 * easeIO(k));
    ctx.beginPath();
    ctx.ellipse(x, y, d, d * 0.75, 0, a - 0.35, a + 0.35);
    ctx.stroke();
  }
}

/** Proie saisie : des anneaux qui serrent, et des étoiles qui tournent. */
function drawSqueeze(ctx: Ctx, x: number, y: number, r: number, t: number, ember: string) {
  for (let i = 0; i < 2; i++) {
    const p = 0.75 + 0.18 * Math.sin(t * 12 + i * Math.PI);
    ctx.strokeStyle = `rgba(${ember},${0.75 - i * 0.25})`;
    ctx.lineWidth = 4 - i;
    ctx.beginPath();
    ctx.ellipse(x, y - 8, r * p, r * p * 0.55, 0, 0, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i * TAU) / 3, sx = x + Math.cos(a) * r * 0.7, sy = y - 44 + Math.sin(a) * 8;
    star(ctx, sx, sy, 5, '#FFE7A0');
  }
}
function star(ctx: Ctx, x: number, y: number, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? s * 0.42 : s;
    if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
/** Étourdi : des étoiles qui tournent au-dessus de sa tête. */
export function drawDizzy(ctx: Ctx, x: number, y: number, t: number) {
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * TAU) / 3;
    star(ctx, x + Math.cos(a) * 14, y + Math.sin(a) * 4, 4.5, '#FFE7A0');
  }
}

/**
 * Champignon de la champignonnière : il sort de terre (k), se balance, puis, sa mèche allumée (fuse), gonfle en
 * clignotant ; un halo de spores montre jusqu'où il éclatera.
 */
function drawShroom(ctx: Ctx, x: number, y: number, r: number, k: number, active: boolean, fuse: number, t: number, ember: string) {
  const grow = active ? 1 : easeIO(Math.min(1, k * 1.2)), f = fuse / 100;
  // la terre se fend sous lui
  ctx.strokeStyle = 'rgba(60,40,24,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3 + x * 0.01;
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + Math.cos(a) * r * 0.55 * grow, y + 2 + Math.sin(a) * r * 0.3 * grow);
  }
  ctx.stroke();
  if (active) {
    ctx.strokeStyle = `rgba(${ember},${0.2 + 0.6 * f})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 2.4 * (0.5 + 0.5 * Math.max(f, 0.35)), r * 1.8 * (0.5 + 0.5 * Math.max(f, 0.35)), 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const sway = Math.sin(t * 2.2 + x) * 0.08 * grow, swell = 1 + 0.45 * f, flash = f > 0 && Math.sin(t * (18 + 30 * f)) > 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  ctx.scale(grow * swell, grow * swell);
  ctx.fillStyle = '#EDE3CC'; // pied
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(-5, -14, -6, -22);
  ctx.lineTo(6, -22);
  ctx.quadraticCurveTo(5, -14, 7, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,24,26,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = flash ? '#FFF2E8' : '#C8402E'; // chapeau
  ctx.beginPath();
  ctx.ellipse(0, -24, 20, 13, 0, Math.PI, 0);
  ctx.quadraticCurveTo(0, -18, -20, -24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#F6EEDD';
  for (const [dx, dy, s] of [[-9, -29, 3.2], [3, -33, 2.6], [11, -27, 2.4], [-2, -26, 2]] as const) {
    ctx.beginPath();
    ctx.arc(dx, dy, s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (active && !f) {
    // quelques spores qui flottent autour
    ctx.fillStyle = 'rgba(220,235,170,0.7)';
    for (let i = 0; i < 4; i++) {
      const a = t * 0.9 + i * 1.6, ff = (t * 0.5 + i * 0.25) % 1;
      ctx.fillRect(x + Math.cos(a) * r * 0.6, y - 20 - ff * 26, 2, 2);
    }
  }
}

/** Lueurs trompeuses : des flammes bleues tourbillonnent et se rassemblent là où un feu follet va paraître. */
function drawWisps(ctx: Ctx, x: number, y: number, r: number, k: number, t: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember, true);
  for (let i = 0; i < 9; i++) {
    const a = t * 3 + (i * TAU) / 9, d = r * (1.1 - 0.9 * k) * (0.6 + 0.4 * ((i * 7) % 3) / 2);
    const px = x + Math.cos(a) * d, py = y - 20 * k + Math.sin(a) * d * 0.6;
    ctx.fillStyle = `rgba(111,183,255,${0.35 + 0.5 * k})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + 3 * k, 0, TAU);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(x, y - 20, 1, x, y - 20, 30 + 20 * k);
  g.addColorStop(0, `rgba(214,238,255,${0.7 * k})`);
  g.addColorStop(1, 'rgba(79,139,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - 20, 30 + 20 * k, 0, TAU);
  ctx.fill();
}

/** Piqué venimeux : l'ombre de la wyverne grandit sur sa cible, de plus en plus nette. */
function drawDiveShadow(ctx: Ctx, x: number, y: number, r: number, k: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember);
  const s = 0.3 + 0.7 * k * k;
  ctx.fillStyle = `rgba(10,16,8,${0.15 + 0.4 * k})`;
  ctx.beginPath(); // ailes ouvertes vues d'en dessous
  ctx.moveTo(x, y - r * 0.12 * s);
  ctx.quadraticCurveTo(x - r * 0.5 * s, y - r * 0.35 * s, x - r * 0.95 * s, y - r * 0.05 * s);
  ctx.quadraticCurveTo(x - r * 0.45 * s, y + r * 0.05 * s, x, y + r * 0.2 * s);
  ctx.quadraticCurveTo(x + r * 0.45 * s, y + r * 0.05 * s, x + r * 0.95 * s, y - r * 0.05 * s);
  ctx.quadraticCurveTo(x + r * 0.5 * s, y - r * 0.35 * s, x, y - r * 0.12 * s);
  ctx.fill();
}

/** Mare de venin : verte, épaisse, des bulles et des vapeurs. */
function drawVenom(ctx: Ctx, x: number, y: number, r: number, active: boolean, t: number) {
  if (!active) return;
  const seed = (x * 5 + y * 3) % 9;
  const g = ctx.createRadialGradient(x, y, 4, x, y, r);
  g.addColorStop(0, 'rgba(190,255,90,0.75)');
  g.addColorStop(0.55, 'rgba(110,190,40,0.6)');
  g.addColorStop(1, 'rgba(60,110,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * TAU, d = r * (1 + 0.1 * Math.sin(a * 4 + seed + t * 0.6));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  for (let b = 0; b < 6; b++) {
    const f = (t * 1.1 + b / 6 + seed * 0.1) % 1, bx = x + Math.cos(b * 1.9 + seed) * r * 0.55, by = y + Math.sin(b * 1.9 + seed) * r * 0.35;
    ctx.strokeStyle = `rgba(220,255,150,${0.8 * (1 - f)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by - f * 4, 2 + f * 5, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = `rgba(160,220,90,${0.25 * (1 - f)})`; // vapeurs
    ctx.beginPath();
    ctx.arc(bx, by - 10 - f * 40, 6 + f * 10, 0, TAU);
    ctx.fill();
  }
}

/**
 * Anneau du tambour (ou de l'écho) : avant, le cercle qu'il atteindra et ses brèches ; parti, une onde qui s'élargit
 * (terre et poussière pour le gorille, ondes violettes pour la chauve-souris), interrompue aux brèches.
 */
function drawRing(ctx: Ctx, x: number, y: number, R: number, k: number, active: boolean, since: number, gap: number, echo: boolean, t: number, ember: string) {
  const col = echo ? '190,140,255' : ember;
  const arcs = (rr: number, from: number, to: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rr, rr * 0.75, 0, from, to);
    ctx.stroke();
  };
  const each = (rr: number) => {
    if (gap < 0) return arcs(rr, 0, TAU);
    for (const g0 of [gap, gap + Math.PI]) arcs(rr, g0 + DRUM_GAP, g0 + Math.PI - DRUM_GAP);
  };
  if (!active) {
    ctx.strokeStyle = `rgba(${col},${0.3 + 0.5 * k})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 10]);
    each(R);
    ctx.setLineDash([]);
    if (gap >= 0) {
      // les brèches : deux couloirs clairs, du géant jusqu'au bord, qui montrent où se glisser
      for (const g0 of [gap, gap + Math.PI]) {
        const grad = ctx.createRadialGradient(x, y, R * 0.15, x, y, R);
        grad.addColorStop(0, 'rgba(210,255,200,0)');
        grad.addColorStop(1, `rgba(210,255,200,${0.12 + 0.22 * k})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.ellipse(x, y, R, R * 0.75, 0, g0 - DRUM_GAP, g0 + DRUM_GAP);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = `rgba(210,255,200,${0.3 + 0.4 * k})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    return;
  }
  const rr = since * RING_SPEED;
  if (rr > R + RING_W) return;
  const fade = Math.min(1, (R + RING_W - rr) / 80);
  ctx.lineCap = 'round';
  if (echo) {
    for (const [w, a] of [[RING_W * 1.6, 0.18], [RING_W * 0.8, 0.35], [4, 0.9]] as const) {
      ctx.strokeStyle = `rgba(${col},${a * fade})`;
      ctx.lineWidth = w;
      each(rr);
    }
    ctx.strokeStyle = `rgba(240,225,255,${0.6 * fade})`;
    ctx.lineWidth = 2;
    for (const d of [-10, 10]) each(Math.max(1, rr + d + Math.sin(t * 30) * 2));
    return;
  }
  for (const [w, c] of [[RING_W * 2, `rgba(150,120,80,${0.3 * fade})`], [RING_W, `rgba(200,170,120,${0.55 * fade})`], [5, `rgba(255,235,200,${0.9 * fade})`]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    each(rr);
  }
}

/** Tronc lancé par le Roi Gorille : il roule le long de son couloir (vu de dessus, l'écorce défile). */
function drawLog(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, active: boolean, since: number, t: number, ember: string) {
  if (!active) return warnLane(ctx, x, y, x2, y2, r, k, ember, t);
  const len = Math.hypot(x2 - x, y2 - y), f = Math.min(1, (since * LOG_SPEED) / Math.max(1, len));
  if (since * LOG_SPEED > len + 60) return;
  const ang = Math.atan2(y2 - y, x2 - x), px = x + (x2 - x) * f, py = y + (y2 - y) * f, roll = since * 14;
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.beginPath();
  ctx.ellipse(px, py + 8, r * 0.9, r * 1.6, ang, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(px, py - r * 0.4);
  ctx.rotate(ang);
  const L = r * 2.8, W = r * 0.95; // le tronc couché en travers du couloir
  ctx.fillStyle = '#6B4A30';
  ctx.beginPath();
  ctx.roundRect(-W / 2, -L / 2, W, L, W * 0.45);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,24,26,0.8)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#4A321F'; // écorce qui défile
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const u = ((roll / TAU + i / 4) % 1) * W - W / 2;
    ctx.beginPath();
    ctx.moveTo(u, -L / 2 + 4);
    ctx.lineTo(u, L / 2 - 4);
    ctx.stroke();
  }
  for (const sd of [-1, 1]) { // les bouts, cernes du bois
    ctx.fillStyle = '#C49A68';
    ctx.beginPath();
    ctx.ellipse(0, (sd * L) / 2, W * 0.45, W * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8A6440';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, (sd * L) / 2, W * 0.25, W * 0.1, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** Coup de queue : un large éventail qui se remplit ; il fouette : un grand croissant de vent. */
function drawTailSweep(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, half: number, k: number, active: boolean, ember: string) {
  const ang = Math.atan2(y2 - y, x2 - x), a0 = ang - half, a1 = ang + half;
  const wedge = (rr: number, from = a0, to = a1) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.ellipse(x, y, rr, rr * 0.75, 0, from, to);
    ctx.closePath();
  };
  if (!active) {
    ctx.fillStyle = `rgba(${ember},0.13)`;
    wedge(r);
    ctx.fill();
    // le balayage se remplit d'un bord à l'autre, comme la queue qui va passer
    ctx.fillStyle = `rgba(${ember},0.34)`;
    wedge(r, a0, a0 + (a1 - a0) * k);
    ctx.fill();
    ctx.strokeStyle = `rgba(${ember},0.95)`;
    ctx.lineWidth = 3;
    wedge(r);
    ctx.stroke();
    return;
  }
  ctx.lineCap = 'round';
  for (const [w, col, f] of [[26, 'rgba(240,230,200,0.3)', 0.85], [12, 'rgba(255,250,235,0.75)', 0.72]] as const) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(x, y, r * f, r * f * 0.75, 0, a0, a1);
    ctx.stroke();
  }
}

/** Embuscade : le sol frémit là où il va surgir (des fissures, de petites mottes qui sautent). */
function drawAmbushWarn(ctx: Ctx, x: number, y: number, r: number, k: number, t: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember);
  ctx.strokeStyle = `rgba(50,34,20,${0.3 + 0.5 * k})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + x * 0.003;
    ctx.moveTo(x + Math.cos(a) * r * 0.1, y + Math.sin(a) * r * 0.08);
    ctx.lineTo(x + Math.cos(a + 0.2) * r * 0.5 * k, y + Math.sin(a + 0.2) * r * 0.38 * k);
  }
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const hop = Math.abs(Math.sin(t * (9 + i) + i)) * 10 * k, a = i * 1.3;
    ctx.fillStyle = 'rgba(110,86,58,0.9)';
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.3 - hop, 3, 0, TAU);
    ctx.fill();
  }
}

/** Glyphe vert d'un totem qu'on plante (pas une attaque) : des runes qui tournent. */
function drawTotemGlyph(ctx: Ctx, x: number, y: number, r: number, k: number, t: number) {
  ctx.strokeStyle = `rgba(140,230,120,${0.35 + 0.5 * k})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = t * 1.2 + (i * TAU) / 6, gx = x + Math.cos(a) * r * 0.75, gy = y + Math.sin(a) * r * 0.56;
    ctx.beginPath();
    ctx.moveTo(gx - 4, gy - 4);
    ctx.lineTo(gx + 4, gy);
    ctx.lineTo(gx - 4, gy + 4);
    ctx.stroke();
  }
}

/** Malédiction : un cercle de runes violettes qui tourne, un masque au centre qui se dessine. */
function drawCurseMark(ctx: Ctx, x: number, y: number, r: number, k: number, t: number) {
  const col = '170,90,220';
  warnRing(ctx, x, y, r, k, col);
  ctx.strokeStyle = `rgba(${col},0.9)`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = -t * 1.5 + (i * TAU) / 8, gx = x + Math.cos(a) * r * 0.82, gy = y + Math.sin(a) * r * 0.62;
    ctx.beginPath();
    ctx.moveTo(gx, gy - 5);
    ctx.lineTo(gx + 3, gy);
    ctx.lineTo(gx, gy + 5);
    ctx.lineTo(gx - 3, gy);
    ctx.closePath();
    ctx.stroke();
  }
  drawCurseMask(ctx, x, y - 8, 14 * (0.5 + 0.5 * k), `rgba(${col},${0.4 + 0.6 * k})`);
}
/** Le masque de la malédiction : un visage taillé, les yeux vides. */
export function drawCurseMask(ctx: Ctx, x: number, y: number, s: number, col: string) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.8);
  ctx.quadraticCurveTo(x, y - s * 1.3, x + s, y - s * 0.8);
  ctx.quadraticCurveTo(x + s * 0.95, y + s * 0.6, x, y + s * 1.1);
  ctx.quadraticCurveTo(x - s * 0.95, y + s * 0.6, x - s, y - s * 0.8);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,8,24,0.9)';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + sd * s * 0.4, y - s * 0.15, s * 0.22, s * 0.14, sd * 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.5, s * 0.25, s * 0.1, 0, 0, TAU);
  ctx.fill();
}

/**
 * Gueule des dunes : le sable se fend et s'affaisse ; ouverte, elle tourbillonne vers son centre où pointe un cercle de
 * crocs, qui se referment d'un coup à la fin.
 */
function drawMaw(ctx: Ctx, x: number, y: number, r: number, k: number, active: boolean, since: number, t: number, ember: string) {
  if (!active) {
    warnRing(ctx, x, y, r, k, ember);
    ctx.fillStyle = `rgba(120,90,50,${0.45 * k})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.7 * k, r * 0.5 * k, 0, 0, TAU);
    ctx.fill();
    return;
  }
  const life = 4, open = Math.min(1, since / 0.4), shut = Math.max(0, (since - (life - 0.35)) / 0.35);
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, 'rgba(40,24,12,0.95)');
  g.addColorStop(0.45, 'rgba(120,88,50,0.85)');
  g.addColorStop(1, 'rgba(190,150,96,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * open, r * 0.72 * open, 0, 0, TAU);
  ctx.fill();
  // bras de sable qui tournent vers le centre
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    ctx.strokeStyle = 'rgba(214,182,128,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, a = t * 2.4 + (arm * TAU) / 4 + u * 4, d = r * open * (1 - u) * 0.95;
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.72;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  // les crocs, en cercle : ils pointent, puis se referment
  const n = 12, teeth = r * 0.42 * open * (1 - shut * 0.85);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.4, bx = x + Math.cos(a) * teeth, by = y + Math.sin(a) * teeth * 0.72;
    const tx = x + Math.cos(a) * teeth * (0.45 - 0.4 * shut), ty = y + Math.sin(a) * teeth * 0.72 * (0.45 - 0.4 * shut);
    const w = 0.16;
    ctx.fillStyle = '#EFE4CC';
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - w) * teeth, y + Math.sin(a - w) * teeth * 0.72);
    ctx.lineTo(tx, ty);
    ctx.lineTo(x + Math.cos(a + w) * teeth, y + Math.sin(a + w) * teeth * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,24,12,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    void bx;
    void by;
  }
}

/** Dard empaleur : la queue segmentée jaillit jusqu'au bout du couloir, puis revient. */
export function drawStinger(ctx: Ctx, x: number, y: number, x2: number, y2: number, ext: number, boss: boolean) {
  const ang = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y) * ext, n = 9;
  ctx.save();
  ctx.translate(x, y - 20);
  ctx.rotate(ang);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), px = f * len, w = 13 - 6 * f;
    ctx.fillStyle = boss ? (i % 2 ? '#5A1E16' : '#7A2E22') : i % 2 ? '#A06A28' : '#C8913E';
    ctx.beginPath();
    ctx.ellipse(px, Math.sin(f * 3) * 4 * (1 - ext), w, w * 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = '#EDE3CC'; // le dard
  ctx.beginPath();
  ctx.moveTo(len + 4, -8);
  ctx.quadraticCurveTo(len + 30, -4, len + 34, 6);
  ctx.quadraticCurveTo(len + 18, 2, len + 2, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(160,230,80,0.9)';
  ctx.beginPath();
  ctx.arc(len + 34, 9, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Braise qui tombe du plafond sur sa zone (vue d'en haut : elle grossit en approchant), et son cercle. */
function drawCinderWarn(ctx: Ctx, x: number, y: number, r: number, k: number, t: number, ember: string) {
  warnRing(ctx, x, y, r, k, ember);
  const z = (1 - k) * 420, s = 6 + 10 * k;
  ctx.fillStyle = `rgba(8,14,12,${0.15 + 0.35 * k})`;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 1.2, s * 0.5, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createRadialGradient(x, y - z, 1, x, y - z, s * 2);
  g.addColorStop(0, 'rgba(255,240,180,1)');
  g.addColorStop(0.4, 'rgba(255,140,50,0.9)');
  g.addColorStop(1, 'rgba(160,40,10,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y - z, s * 2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - z - s);
  ctx.lineTo(x + Math.sin(t * 20) * 2, y - z - s - 30);
  ctx.stroke();
}

/** Reflets de lune : couloir d'un bleu pâle, en pointillés lumineux. */
function drawMirageLane(ctx: Ctx, x: number, y: number, x2: number, y2: number, r: number, k: number, t: number, ember: string) {
  warnLane(ctx, x, y, x2, y2, r, k, ember, t);
  ctx.strokeStyle = `rgba(200,220,255,${0.3 + 0.5 * k})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 10]);
  ctx.lineDashOffset = -t * 60;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

/** Les nouvelles attaques : renvoie vrai si elle a été dessinée. */
function drawBossHazard(ctx: Ctx, style: string, h: number[], t: number, k: number, active: boolean, since: number, ember: string): boolean {
  const [, x, y, r, x2, y2] = h, extra = h[11] ?? 0;
  switch (style) {
    case 'stalk': if (!active) drawShadowPool(ctx, x, y, r, k, t, ember); return true;
    case 'howl': if (!active) drawHowl(ctx, x, y, r, k, t, ember); return true;
    case 'rampage': case 'roll': case 'impale': if (!active) warnLane(ctx, x, y, x2, y2, r, k, style === 'impale' ? '150,210,60' : ember, t); return true;
    case 'mud': drawMud(ctx, x, y, r, active, k, t, ember); return true;
    case 'hug': if (!active) drawHugWarn(ctx, x, y, r, k, ember); return true;
    case 'squeeze': if (active) drawSqueeze(ctx, x, y, r, t, ember); return true;
    case 'shroom': drawShroom(ctx, x, y, r, k, active, extra, t, ember); return true;
    case 'wisps': if (!active) drawWisps(ctx, x, y, r, k, t, ember); return true;
    case 'venomdive': if (!active) drawDiveShadow(ctx, x, y, r, k, ember); return true;
    case 'venom': drawVenom(ctx, x, y, r, active, t); return true;
    case 'drum': case 'echo': drawRing(ctx, x, y, r, k, active, since, style === 'echo' ? -1 : extra / 100, style === 'echo', t, ember); return true;
    case 'log': drawLog(ctx, x, y, x2, y2, r, k, active, since, t, ember); return true;
    case 'tail': if (!active || since < 0.25) drawTailSweep(ctx, x, y, x2, y2, r, extra / 100 || 1, k, active, ember); return true;
    case 'ambush': if (!active) drawAmbushWarn(ctx, x, y, r, k, t, ember); return true;
    case 'totem': if (!active) drawTotemGlyph(ctx, x, y, r, k, t); return true;
    case 'curse': if (!active) drawCurseMark(ctx, x, y, r, k, t); return true;
    case 'maw': drawMaw(ctx, x, y, r, k, active, since, t, ember); return true;
    case 'mirage': if (!active) drawMirageLane(ctx, x, y, x2, y2, r, k, t, '170,200,255'); return true;
    case 'husk': if (!active) warnRing(ctx, x, y, r, k, ember); return true;
    case 'cinder': if (!active) drawCinderWarn(ctx, x, y, r, k, t, ember); return true;
    case 'shellspin': if (!active) warnRing(ctx, x, y, r, k, ember, true); return true;
    case 'eclipse': case 'roost': return true; // la nuit tombe (voir le jeu) ; au plafond : rien au sol
  }
  return false;
}

/**
 * Roche en fusion lancée par une tortue du volcan : un bloc de basalte sombre fendu de lave qui luit, qui tourne sur
 * lui-même et laisse une traînée de fumée et d'étincelles.
 */
function drawMagma(ctx: Ctx, x: number, y: number, t: number, gx: number, gy: number, p: number) {
  for (let i = 1; i <= 4; i++) {
    const k = i / 4, sx = x - (x - gx) * 0 + Math.sin(t * 5 + i) * 3, sy = y + i * 9 * (1 - p);
    ctx.fillStyle = `rgba(80,70,66,${0.35 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 5 + i * 2.5, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 6);
  const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 26);
  glow.addColorStop(0, 'rgba(255,170,70,0.55)');
  glow.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2E2420';
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU, d = 14 * (0.8 + 0.25 * Math.sin(i * 2.7));
    if (i) ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    else ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(255,${150 + Math.round(60 * Math.sin(t * 9))},60,0.95)`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(0, 1);
  ctx.lineTo(7, -6);
  ctx.moveTo(0, 1);
  ctx.lineTo(3, 9);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,210,120,0.9)';
  for (let i = 0; i < 3; i++) {
    const k = (t * 3 + i / 3) % 1;
    ctx.fillRect(x + Math.sin(i * 4 + t * 3) * 8, y + k * 18, 2, 2);
  }
}

// ───────────── Robe de l'Alpha et du légendaire (double éveil) ─────────────
// Alpha et légendaire partagent la même robe (VARIANT_FILTERS, un filtre de couleur sur le corps de l'espèce). Le légendaire y
// ajoute des effets visuels propres à l'espèce, dessinés derrière (LEGEND_BACK) ou devant (LEGEND_FRONT) le corps, sans filtre.
// Les espèces sans géant n'ont pas de légendaire : seule leur robe d'Alpha est définie ici.
export const VARIANT_FILTERS: Record<string, string> = {
  // espèces sans géant (pas de légendaire) : hare … rufous_coati ; puis slime, wolf, spider, drake, qui ont un géant (effets plus bas)
  hare: 'hue-rotate(220deg) saturate(1.5) brightness(1.05)',
  snail: 'hue-rotate(100deg) saturate(1.3) brightness(1.15)',
  firefly: 'hue-rotate(120deg)',
  meerkat: 'hue-rotate(80deg) saturate(1.3) brightness(1.15)',
  treant: 'hue-rotate(170deg) saturate(1.2) brightness(1.2)',
  bigfoot: 'hue-rotate(160deg) saturate(0.3) brightness(1.6)',
  rufous_coati: 'hue-rotate(160deg) saturate(1.1) brightness(1.15)',
  slime: 'hue-rotate(-75deg) saturate(1.5) brightness(1.1)',
  wolf: 'saturate(2.2) hue-rotate(-15deg) brightness(0.5) contrast(1.25)',
  spider: 'hue-rotate(80deg) saturate(1.5) brightness(0.65)',
  drake: 'hue-rotate(95deg) saturate(1.3) brightness(0.7)',
};
const glowOn = (ctx: Ctx, col: string, blur: number) => { ctx.shadowColor = col; ctx.shadowBlur = blur; };
const glowOff = (ctx: Ctx) => { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; };
const spike = (ctx: Ctx, x: number, y: number, w: number, h: number, ang: number, col: string, edge = 'rgba(12,18,16,0.6)', lw = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(0, -h);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.restore();
};
const pulseOf = (u: UnitLook, sp = 3) => 0.65 + 0.35 * Math.sin(u.t * sp + u.seed);

const LEGEND_BACK: Record<string, (ctx: Ctx, r: number, u: UnitLook) => void> = {
  wolf: (ctx, r, u) => {
    // crinière spectrale : une grande collerette de givre derrière le cou, qui frémit
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (const [cx, cy, rx, ry, col] of [[0.48, -0.1, 0.62, 0.72, '#7FC8E0'], [0.54, -0.08, 0.5, 0.58, '#D8F2FF']] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      const n = 10;
      for (let k = 0; k <= n * 2; k++) {
        const a = (k / (n * 2)) * TAU, d = k % 2 ? 1 : 1.2 + Math.sin(u.t * 4 + k) * 0.04;
        const x = cx * r + Math.cos(a) * rx * r * d, y = cy * r + Math.sin(a) * ry * r * d;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.5);
    }
    ctx.restore();
  },
};

export const LEGEND_FRONT: Record<string, (ctx: Ctx, r: number, u: UnitLook) => void> = {
  slime: (ctx, r, u) => {
    const p = pulseOf(u);
    // noyau d'or qui bat au fond du corps
    const g = ctx.createRadialGradient(0, 0.3 * r, 0, 0, 0.3 * r, 0.5 * r);
    g.addColorStop(0, `rgba(255,245,190,${0.95 * p})`);
    g.addColorStop(0.45, `rgba(255,200,60,${0.8 * p})`);
    g.addColorStop(1, 'rgba(255,170,30,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0.3 * r, 0.5 * r, 0, TAU);
    ctx.fill();
    // gouttes d'or en orbite et pièces collées à la surface
    glowOn(ctx, '#FFD34A', r * 0.3);
    ctx.fillStyle = '#FFE27A';
    for (let k = 0; k < 5; k++) {
      const a = u.t * 1.4 + (k / 5) * TAU, rx = 1.45 * r, ry = 0.6 * r;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * rx, -0.05 * r + Math.sin(a) * ry, r * 0.07, r * 0.09, 0, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    for (const [x, y] of [[0.62, 0.28], [-0.7, 0.18], [0.1, 0.52]] as const) {
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.1, 0, TAU);
      ctx.fill();
      ink(ctx, r * 0.18);
      ctx.fillStyle = '#FFF1B0';
      ctx.beginPath();
      ctx.arc((x - 0.03) * r, (y - 0.03) * r, r * 0.035, 0, TAU);
      ctx.fill();
    }
    // trois pointes de gelée dorée sur le dessus
    for (const [x, h] of [[-0.35, 0.3], [0.05, 0.4], [0.42, 0.28]] as const) spike(ctx, x * r, -0.78 * r, 0.2 * r, h * r, (x) * 0.4, '#FFD34A', 'rgba(12,18,16,0.7)', Math.max(1, r * 0.04));
  },
  wolf: (ctx, r, u) => {
    const p = pulseOf(u);
    // cristaux de glace le long de l'échine
    glowOn(ctx, '#7FE8FF', r * 0.2);
    for (const [x, h, a] of [[-0.62, 0.22, -0.5], [-0.42, 0.3, -0.3], [-0.2, 0.34, -0.1], [0.02, 0.3, 0.1], [0.22, 0.24, 0.25]] as const) {
      spike(ctx, x * r, -0.4 * r, 0.14 * r, h * r, a, '#BFF4FF', 'rgba(20,60,80,0.7)', Math.max(1, r * 0.03));
    }
    glowOff(ctx);
    // runes lumineuses sur le flanc
    ctx.save();
    ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.5 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.lineCap = 'round';
    glowOn(ctx, '#7FE8FF', r * 0.3);
    for (const [x, dy] of [[-0.45, 0], [-0.18, 0.04], [0.1, 0]] as const) {
      ctx.beginPath();
      ctx.moveTo(x * r, (-0.18 + dy) * r);
      ctx.lineTo((x + 0.08) * r, (-0.02 + dy) * r);
      ctx.lineTo((x - 0.02) * r, (0.06 + dy) * r);
      ctx.lineTo((x + 0.08) * r, (0.16 + dy) * r);
      ctx.stroke();
    }
    // œil de glace
    ctx.fillStyle = '#E8FCFF';
    ctx.beginPath();
    ctx.ellipse(0.92 * r, -0.27 * r, 0.1 * r, 0.075 * r, 0, 0, TAU);
    ctx.fill();
    // flamme de givre au bout de la queue
    for (let k = 0; k < 3; k++) {
      const f = (u.t * 2 + k / 3) % 1;
      ctx.fillStyle = `rgba(160,235,255,${0.8 * (1 - f)})`;
      ctx.beginPath();
      ctx.ellipse((-1.28 - f * 0.18) * r, (-0.38 - f * 0.4) * r, 0.1 * r * (1 - f * 0.5), 0.14 * r * (1 - f * 0.4), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    glowOff(ctx);
  },
  spider: (ctx, r, u) => {
    const p = pulseOf(u, 4);
    // pointes dorsales sur l'abdomen
    for (let k = 0; k < 5; k++) {
      const x = -0.92 + k * 0.18, y = -0.58 * Math.sqrt(Math.max(0, 1 - ((x + 0.42) / 0.7) ** 2));
      spike(ctx, x * r, y * r + 0.04 * r, 0.14 * r, (0.2 + (k === 2 ? 0.1 : 0)) * r, (x + 0.42) * 0.7, '#2A0C12', 'rgba(12,18,16,0.8)', Math.max(1, r * 0.03));
    }
    // sablier qui brûle
    glowOn(ctx, '#FF4A2A', r * 0.4 * p);
    ctx.fillStyle = `rgba(255,${(150 + 80 * p) | 0},70,1)`;
    ctx.beginPath();
    ctx.moveTo(-0.62 * r, -0.22 * r);
    ctx.lineTo(-0.22 * r, -0.22 * r);
    ctx.lineTo(-0.42 * r, 0);
    ctx.lineTo(-0.22 * r, 0.22 * r);
    ctx.lineTo(-0.62 * r, 0.22 * r);
    ctx.lineTo(-0.42 * r, 0);
    ctx.closePath();
    ctx.fill();
    // quatre yeux de plus, en couronne
    ctx.fillStyle = '#FFD34A';
    for (const [ex, ey, er] of [[0.4, -0.16, 0.05], [0.58, -0.2, 0.05], [0.76, -0.14, 0.04], [0.82, 0.04, 0.04]] as const) {
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, er * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    // venin qui goutte des crochets
    for (let k = 0; k < 2; k++) {
      const f = (u.t * 1.2 + k * 0.5) % 1;
      ctx.fillStyle = `rgba(120,255,90,${1 - f})`;
      ctx.beginPath();
      ctx.ellipse((0.92 + k * 0.02) * r, (0.5 + f * 0.35) * r, 0.04 * r, 0.06 * r, 0, 0, TAU);
      ctx.fill();
    }
  },
  drake: (ctx, r, u) => {
    const p = pulseOf(u, 2.5), t = u.t + u.seed, breathe = Math.sin(t * 2) * 0.01, sway = Math.sin(t * 3) * 0.06;
    // crête de nageoires lumineuses (aigue-marine), du garrot au bout de la queue
    const tail = bez([-0.4, -0.05], [-1.0, 0.0 + sway], [-1.55, -0.25 + sway * 2], 14);
    const pts: P2[] = [...bez([0.55, -0.32], [0.1, -0.52 + breathe], [-0.55, -0.12], 6), ...tail.filter((_, i) => i >= 2 && i <= 12 && i % 2 === 0).map((q): P2 => [q[0], q[1] - 0.1])];
    glowOn(ctx, '#5CF0E0', r * 0.35 * p);
    ctx.fillStyle = 'rgba(120,255,235,0.9)';
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [px, py] = pts[i - 1], [nx, ny] = pts[i + 1], k = 0.42 * (1 - Math.abs(i / (pts.length - 1) - 0.4) * 0.7);
      ctx.beginPath();
      ctx.moveTo(((x + px) / 2) * r, ((y + py) / 2) * r);
      ctx.quadraticCurveTo((x - 0.12) * r, (y - k * 0.6) * r, (x - 0.1) * r, (y - k) * r);
      ctx.lineTo(((x + nx) / 2) * r, ((y + ny) / 2) * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.12);
    }
    // nageoire de queue en éventail
    const [tx, ty] = tail[14];
    ctx.fillStyle = 'rgba(130,255,235,0.85)';
    ctx.beginPath();
    ctx.moveTo((tx + 0.12) * r, (ty + 0.02) * r);
    ctx.quadraticCurveTo((tx - 0.1) * r, (ty - 0.5) * r, (tx - 0.4) * r, (ty - 0.36) * r);
    ctx.quadraticCurveTo((tx - 0.22) * r, (ty - 0.1) * r, (tx - 0.42) * r, (ty + 0.08) * r);
    ctx.quadraticCurveTo((tx - 0.2) * r, (ty + 0.22) * r, (tx - 0.36) * r, (ty + 0.42) * r);
    ctx.quadraticCurveTo((tx - 0.05) * r, (ty + 0.3) * r, (tx + 0.12) * r, (ty + 0.02) * r);
    ctx.fill();
    ink(ctx, r * 0.12);
    glowOff(ctx);
    // grandes cornes d'or recourbées sur la tête
    const hx = 0.86, hy = -0.36 + breathe;
    for (const [dx, k] of [[-0.12, 1], [0.0, 0.72]] as const) {
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.moveTo((hx + dx - 0.07) * r, (hy - 0.1) * r);
      ctx.quadraticCurveTo((hx + dx - 0.5 * k) * r, (hy - 0.2) * r, (hx + dx - 0.78 * k) * r, (hy - 0.72 * k) * r);
      ctx.quadraticCurveTo((hx + dx - 0.3 * k) * r, (hy - 0.42 * k) * r, (hx + dx + 0.07) * r, (hy - 0.12) * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.2);
    }
    // perles d'or sur l'épaule
    for (const [x, y] of [[0.3, -0.2], [0.42, -0.08], [0.18, -0.06]] as const) {
      ctx.fillStyle = '#FFE27A';
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.05, 0, TAU);
      ctx.fill();
      ink(ctx, r * 0.1);
    }
  },
};

// ───────── Groupe A : sanglier, golem, sporelin, ours, feu follet, guetteur, crapaud ─────────
const legAHash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** Éclair en zigzag de (x0,y0) à (x1,y1) (unités de r), qui scintille par paliers de temps. */
const legABolt = (ctx: Ctx, r: number, x0: number, y0: number, x1: number, y1: number, seed: number, t: number, col: string, core: string) => {
  const step = Math.floor(t * 9), n = 7;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n, j = i === 0 || i === n ? 0 : (legAHash(seed * 13 + i + step * 7) - 0.5) * 0.2;
    pts.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + j - Math.sin(k * Math.PI) * 0.14]);
  }
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  glowOn(ctx, col, r * 0.3);
  for (const [c, w] of [[col, 0.07], [core, 0.03]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = Math.max(1, r * w);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
    ctx.stroke();
  }
  ctx.restore();
  glowOff(ctx);
};
/** Petite flamme en goutte (pointe vers le haut), centrée en (x,y). */
const legAFlame = (ctx: Ctx, x: number, y: number, w: number, h: number, col: string, sway = 0) => {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - w, y + h * 0.3);
  ctx.quadraticCurveTo(x - w * 1.1, y - h * 0.3, x + sway, y - h);
  ctx.quadraticCurveTo(x + w * 1.1, y - h * 0.3, x + w, y + h * 0.3);
  ctx.quadraticCurveTo(x, y + h * 0.9, x - w, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
};

Object.assign(VARIANT_FILTERS, {
  boar: 'hue-rotate(195deg) saturate(1.7) brightness(0.5) contrast(1.2)', // pelage bleu nuit d'orage
  golem: 'hue-rotate(-105deg) saturate(1.8) brightness(0.42) contrast(1.15)', // obsidienne brun-rouge sombre
  sporelin: 'hue-rotate(275deg) saturate(1.5) brightness(0.85)', // chapeau violet
  bear: 'hue-rotate(110deg) saturate(1.5) brightness(0.75)', // vert forêt profond
  wisp: 'hue-rotate(105deg) saturate(1.5) brightness(0.95)', // flamme magenta
  watcher: 'sepia(1) saturate(2.6) hue-rotate(-8deg) brightness(0.8)', // pierre bronze / or ancien
  toad: 'hue-rotate(85deg) saturate(1.5) brightness(0.6)', // abysses sarcelle
});

Object.assign(LEGEND_BACK, {
  golem: (ctx: Ctx, r: number, u: UnitLook) => {
    // éclats d'obsidienne qui dépassent derrière les épaules et le dos
    const sway = Math.sin(u.t * 1.5 + u.seed) * 0.02;
    for (const [x, y, w, h, a] of [[-0.78, -0.6, 0.34, 0.8, -0.5], [0.78, -0.6, 0.34, 0.8, 0.5], [-0.38, -0.7, 0.28, 0.6, -0.18], [0.4, -0.7, 0.28, 0.6, 0.18], [-1.0, -0.2, 0.26, 0.5, -1.1], [1.0, -0.2, 0.26, 0.5, 1.1]] as const) {
      spike(ctx, x * r, y * r, w * r, (h + sway) * r, a, '#2B1A22', 'rgba(8,6,10,0.9)', Math.max(1.5, r * 0.05));
      spike(ctx, (x + Math.sin(a) * 0.1) * r, y * r, w * 0.4 * r, h * 0.7 * r, a, '#5A3342', 'rgba(0,0,0,0)', 0);
    }
  },
  wisp: (ctx: Ctx, r: number, u: UnitLook) => {
    // grandes ailes de flamme qui battent derrière le feu follet
    const flap = Math.sin(u.t * 5 + u.seed) * 0.12;
    for (const s of [-1, 1]) {
      for (const [sc, col] of [[1, 'rgba(210,60,190,0.75)'], [0.66, 'rgba(255,160,230,0.85)']] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(s * 0.35 * r, -0.1 * r);
        ctx.quadraticCurveTo(s * 1.0 * r * sc, (-0.45 - flap) * r * sc, s * 1.55 * r * sc, (-1.05 - flap * 2) * r * sc);
        ctx.quadraticCurveTo(s * 1.45 * r * sc, (-0.35 - flap) * r * sc, s * 1.85 * r * sc, (-0.45 - flap) * r * sc);
        ctx.quadraticCurveTo(s * 1.3 * r * sc, (-0.05) * r * sc, s * 1.55 * r * sc, (0.35 + flap) * r * sc);
        ctx.quadraticCurveTo(s * 0.9 * r * sc, (0.15) * r * sc, s * 0.4 * r, 0.3 * r);
        ctx.closePath();
        ctx.fill();
      }
    }
  },
  watcher: (ctx: Ctx, r: number, u: UnitLook) => {
    // anneau runique doré qui tourne dans le dos de la sentinelle
    const cx = 0, cy = -0.15 * r, p = pulseOf(u, 2);
    ctx.save();
    ctx.translate(cx, cy);
    glowOn(ctx, '#FFC84A', r * 0.3 * p);
    ctx.strokeStyle = `rgba(255,200,80,${0.55 + 0.3 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.05 * r, 1.1 * r, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.88 * r, 0.93 * r, 0, 0, TAU);
    ctx.stroke();
    ctx.rotate(u.t * 0.5);
    ctx.lineWidth = Math.max(2, r * 0.07);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU, d = k % 3 === 0 ? 0.14 : 0.07;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.95 * r, Math.sin(a) * 1.0 * r);
      ctx.lineTo(Math.cos(a) * (0.95 + d) * r, Math.sin(a) * (1.0 + d) * r);
      ctx.stroke();
    }
    ctx.restore();
    glowOff(ctx);
  },
});

Object.assign(LEGEND_FRONT, {
  boar: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 5);
    // lueur électrique dans les rayures du flanc
    ctx.save();
    ctx.strokeStyle = `rgba(150,235,255,${0.35 + 0.35 * p})`;
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.lineCap = 'round';
    glowOn(ctx, '#58C8FF', r * 0.2);
    for (const y of [-0.36, -0.16, 0.04]) {
      ctx.beginPath();
      ctx.moveTo(-0.9 * r, (y + 0.06) * r);
      ctx.quadraticCurveTo(-0.1 * r, (y - 0.08) * r, 0.65 * r, (y + 0.02) * r);
      ctx.stroke();
    }
    ctx.restore();
    // arcs de foudre qui sautent d'un point à l'autre de l'échine
    legABolt(ctx, r, -0.78, -0.42, -0.3, -0.62, 1, u.t + u.seed, '#58C8FF', '#F0FFFF');
    legABolt(ctx, r, -0.3, -0.62, 0.18, -0.64, 2, u.t + u.seed, '#58C8FF', '#F0FFFF');
    legABolt(ctx, r, 0.18, -0.64, 0.58, -0.46, 3, u.t + u.seed, '#58C8FF', '#F0FFFF');
    // défense électrique, œil d'éclair
    glowOn(ctx, '#9AEBFF', r * 0.3 * p);
    ctx.strokeStyle = '#D8FAFF';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.98 * r, 0.34 * r);
    ctx.quadraticCurveTo(1.08 * r, 0.24 * r, 1.04 * r, 0.1 * r);
    ctx.stroke();
    ctx.fillStyle = '#FFF6B0';
    ctx.beginPath();
    ctx.arc(0.78 * r, -0.08 * r, 0.05 * r, 0, TAU);
    ctx.fill();
    glowOff(ctx);
    // étincelles qui jaillissent des sabots
    for (let k = 0; k < 6; k++) {
      const f = (u.t * 2.2 + k * 0.37) % 1, x = [-0.52, -0.32, 0.32, 0.52, 0.8, -0.7][k];
      ctx.fillStyle = `rgba(180,240,255,${1 - f})`;
      ctx.fillRect((x + Math.sin(k * 5 + u.t * 6) * 0.1) * r, (0.8 - f * 0.4) * r, Math.max(1.5, r * 0.035), Math.max(1.5, r * 0.035));
    }
  },
  golem: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2.5);
    // fissures de lave sur le corps et les bras
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const cracks: [number, number][][] = [
      [[-0.78, -0.5], [-0.6, -0.34], [-0.7, -0.14], [-0.5, 0.02], [-0.6, 0.22]],
      [[0.8, -0.45], [0.62, -0.3], [0.72, -0.08], [0.55, 0.12], [0.66, 0.32]],
      [[-0.2, 0.3], [-0.1, 0.5], [-0.25, 0.66]],
      [[0.2, 0.28], [0.3, 0.46], [0.18, 0.7]],
      [[-1.2, 0.05], [-1.0, 0.2], [-1.1, 0.4]],
      [[1.2, 0.05], [1.0, 0.22], [1.1, 0.42]],
    ];
    glowOn(ctx, '#FF7A1A', r * 0.3 * p);
    for (const [c, w] of [['rgba(255,110,20,1)', 0.075], [`rgba(255,${(215 + 40 * p) | 0},120,1)`, 0.03]] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(1, r * w);
      for (const pl of cracks) {
        ctx.beginPath();
        pl.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r)));
        ctx.stroke();
      }
    }
    ctx.restore();
    glowOff(ctx);
    // la chaleur de la braise dans les yeux
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const g = ctx.createRadialGradient(s * 0.27 * r, -0.15 * r, 0, s * 0.27 * r, -0.15 * r, 0.3 * r);
      g.addColorStop(0, `rgba(255,140,40,${0.55 * p})`);
      g.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s * 0.27 * r, -0.15 * r, 0.3 * r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // braises et cendres qui montent du sommet
    for (let k = 0; k < 6; k++) {
      const f = (u.t * 0.7 + k / 6 + u.seed) % 1, x = -0.7 + (k % 3) * 0.7 + Math.sin(k * 3 + u.t * 2) * 0.1;
      ctx.fillStyle = `rgba(255,${(120 + 100 * f) | 0},40,${1 - f})`;
      ctx.beginPath();
      ctx.arc(x * r, (-0.7 - f * 0.9) * r, r * 0.045 * (1 - f * 0.5), 0, TAU);
      ctx.fill();
    }
    // lave qui goutte du poing
    for (const s of [-1, 1]) {
      const f = (u.t * 0.8 + (s > 0 ? 0.5 : 0)) % 1;
      ctx.fillStyle = `rgba(255,140,30,${1 - f * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(s * 1.02 * r, (0.65 + f * 0.15) * r, r * 0.035, r * 0.055, 0, 0, TAU);
      ctx.fill();
    }
  },
  sporelin: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 3);
    ctx.save();
    // (le drawer du sporelin laisse son translate de saut actif : les extras sautent déjà avec le champignon)
    // lueur bioluminescente : halo sur les taches du chapeau
    glowOn(ctx, '#8DFFE0', r * 0.4 * p);
    ctx.fillStyle = `rgba(150,255,225,${0.55 + 0.35 * p})`;
    for (const [sx, sy, sr] of [[-0.45, -0.45, 0.16], [0.15, -0.72, 0.13], [0.55, -0.3, 0.11], [-0.1, -0.3, 0.08]] as const) {
      ctx.beginPath();
      ctx.arc(sx * r, sy * r, sr * r, 0, TAU);
      ctx.fill();
    }
    // lamelles lumineuses sous le bord du chapeau
    ctx.strokeStyle = `rgba(160,255,230,${0.5 + 0.3 * p})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.lineCap = 'round';
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 0.2 * r, (0.06 - Math.abs(k) * 0.005) * r);
      ctx.lineTo(k * 0.14 * r, 0.14 * r);
      ctx.stroke();
    }
    glowOff(ctx);
    // petits champignons qui poussent sur le chapeau, de part et d'autre
    for (const [x, y, a, s, ph] of [[-0.78, -0.42, -0.6, 1, 0], [0.8, -0.28, 0.6, 0.85, 1.7], [-0.62, -0.78, -0.3, 0.6, 3.1]] as const) {
      ctx.save();
      ctx.translate(x * r, y * r);
      ctx.rotate(a + Math.sin(u.t * 2 + ph) * 0.05);
      ctx.fillStyle = '#E8DCF0';
      ctx.beginPath();
      ctx.roundRect(-0.045 * r * s, -0.2 * r * s, 0.09 * r * s, 0.22 * r * s, 0.03 * r);
      ctx.fill();
      ctx.fillStyle = '#B04CE8';
      ctx.beginPath();
      ctx.ellipse(0, -0.22 * r * s, 0.2 * r * s, 0.13 * r * s, 0, Math.PI, TAU);
      ctx.fill();
      ink(ctx, r * 0.5 * s);
      ctx.fillStyle = '#F6E8FF';
      ctx.beginPath();
      ctx.arc(-0.06 * r * s, -0.27 * r * s, 0.03 * r * s, 0, TAU);
      ctx.arc(0.06 * r * s, -0.25 * r * s, 0.025 * r * s, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // nuée de spores lumineuses en orbite (non liée au saut)
    glowOn(ctx, '#8DFFE0', r * 0.25);
    for (let k = 0; k < 7; k++) {
      const a = u.t * 0.9 + (k / 7) * TAU, rx = 1.25 * r, ry = 0.35 * r;
      ctx.fillStyle = `rgba(170,255,235,${0.5 + 0.4 * Math.sin(u.t * 3 + k)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rx, -0.2 * r + Math.sin(a) * ry, r * 0.045, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
  },
  bear: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2.5), sway = u.moving ? Math.sin(u.t * 12 + u.seed) : Math.sin(u.t * 1.5 + u.seed) * 0.3;
    const top = (x: number) => Math.min(-0.12 - Math.sqrt(Math.max(0, 0.62 ** 2 - (x - 0.1) ** 2)), 0.05 - Math.sqrt(Math.max(0, 0.55 ** 2 - (x + 0.45) ** 2)));
    // cristaux d'ambre plantés dans l'échine
    glowOn(ctx, '#FFB030', r * 0.3 * p);
    for (const [x, h, w] of [[-0.62, 0.3, 0.15], [-0.42, 0.42, 0.18], [-0.2, 0.5, 0.2], [0.02, 0.62, 0.22], [0.22, 0.48, 0.19], [0.4, 0.34, 0.15]] as const) {
      const a = (x - 0.05) * 0.5;
      spike(ctx, x * r, (top(x) + 0.08 + sway * 0.01) * r, w * r, (h + Math.sin(u.t * 2 + x * 6) * 0.015) * r, a, '#FFB838', 'rgba(60,30,0,0.85)', Math.max(1.2, r * 0.04));
      spike(ctx, (x - 0.02) * r, (top(x) + 0.06) * r, w * 0.35 * r, h * 0.65 * r, a, '#FFEBA8', 'rgba(0,0,0,0)', 0);
    }
    glowOff(ctx);
    // rune d'ambre qui brille sur l'épaule
    ctx.save();
    glowOn(ctx, '#FFB030', r * 0.3);
    ctx.strokeStyle = `rgba(255,205,90,${0.5 + 0.5 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.02 * r, 0.04 * r);
    ctx.lineTo(0.12 * r, -0.14 * r);
    ctx.lineTo(0.28 * r, 0.04 * r);
    ctx.moveTo(0.12 * r, -0.14 * r);
    ctx.lineTo(0.12 * r, 0.22 * r);
    ctx.stroke();
    // œil d'ambre ardent
    ctx.fillStyle = '#FFF0B0';
    ctx.beginPath();
    ctx.arc(0.94 * r, -0.1 * r + sway * r * 0.025, 0.05 * r, 0, TAU);
    ctx.fill();
    // griffes incandescentes
    ctx.strokeStyle = `rgba(255,190,70,${0.5 + 0.4 * p})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    for (const x of [-0.7, -0.4, 0.35, 0.65]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.08) * r, 0.78 * r);
      ctx.lineTo((x - 0.1) * r, 0.84 * r);
      ctx.moveTo((x + 0.04) * r, 0.78 * r);
      ctx.lineTo((x + 0.02) * r, 0.85 * r);
      ctx.stroke();
    }
    ctx.restore();
    glowOff(ctx);
    // lucioles d'ambre autour de la bête
    for (let k = 0; k < 4; k++) {
      const a = u.t * 0.8 + (k / 4) * TAU;
      ctx.fillStyle = `rgba(255,210,100,${0.5 + 0.4 * Math.sin(u.t * 4 + k * 2)})`;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 1.35 * r, -0.2 * r + Math.sin(a * 1.3) * 0.5 * r, r * 0.04, 0, TAU);
      ctx.fill();
    }
  },
  wisp: (ctx: Ctx, r: number, u: UnitLook) => {
    // trois petits feux follets qui tournent autour du grand (derrière / devant selon la phase)
    for (let k = 0; k < 3; k++) {
      const a = u.t * 1.6 + (k / 3) * TAU, x = Math.cos(a) * 1.15 * r, y = (-0.05 + Math.sin(a) * 0.3) * r;
      const s = 1.35 + 0.35 * Math.sin(a), sw = Math.sin(u.t * 9 + k) * 0.04 * r;
      glowOn(ctx, '#FF7AE0', r * 0.4);
      legAFlame(ctx, x, y, 0.1 * r * s, 0.26 * r * s, 'rgba(255,100,215,0.95)', sw);
      glowOff(ctx);
      legAFlame(ctx, x, y + 0.03 * r, 0.05 * r * s, 0.13 * r * s, '#FFFFFF', sw * 0.5);
    }
    // anneau de braises runiques autour de la base
    const p = pulseOf(u, 3);
    ctx.strokeStyle = `rgba(255,150,230,${0.4 + 0.3 * p})`;
    ctx.lineWidth = Math.max(1, r * 0.03);
    ctx.setLineDash([r * 0.12, r * 0.1]);
    ctx.lineDashOffset = -u.t * r * 0.3;
    ctx.beginPath();
    ctx.ellipse(0, 0.72 * r, 0.8 * r, 0.16 * r, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  watcher: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2), ch = u.charge ?? 0;
    // runes dorées supplémentaires sur le fût
    ctx.save();
    glowOn(ctx, '#FFC84A', r * 0.25);
    ctx.strokeStyle = `rgba(255,214,110,${0.45 + 0.35 * p + ch * 0.2})`;
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.42 * r, 0.1 * r);
    ctx.lineTo(-0.34 * r, 0.4 * r);
    ctx.moveTo(-0.46 * r, 0.24 * r);
    ctx.lineTo(-0.28 * r, 0.24 * r);
    ctx.moveTo(0.34 * r, 0.1 * r);
    ctx.lineTo(0.46 * r, 0.22 * r);
    ctx.lineTo(0.34 * r, 0.4 * r);
    ctx.moveTo(-0.45 * r, -0.62 * r);
    ctx.lineTo(-0.3 * r, -0.5 * r);
    ctx.moveTo(0.35 * r, -0.62 * r);
    ctx.lineTo(0.4 * r, -0.48 * r);
    ctx.stroke();
    // anneau doré autour de l'œil
    ctx.lineWidth = Math.max(1.5, r * 0.045);
    ctx.beginPath();
    ctx.arc(0.05 * r, -0.35 * r, 0.33 * r * (1 + ch * 0.3), 0, TAU);
    ctx.stroke();
    ctx.restore();
    glowOff(ctx);
    // quatre pierres runiques flottantes en orbite
    for (let k = 0; k < 4; k++) {
      const a = u.t * 1.1 + (k / 4) * TAU, x = Math.cos(a) * 0.95 * r, y = (-0.2 + Math.sin(a) * 0.25 + Math.sin(u.t * 2 + k) * 0.05) * r, s = 1.35 + 0.35 * Math.sin(a);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(u.t * 0.8 + k);
      glowOn(ctx, '#FFC84A', r * 0.25);
      ctx.fillStyle = '#5A4A2A';
      ctx.beginPath();
      ctx.moveTo(0, -0.17 * r * s);
      ctx.lineTo(0.1 * r * s, 0);
      ctx.lineTo(0, 0.17 * r * s);
      ctx.lineTo(-0.1 * r * s, 0);
      ctx.closePath();
      ctx.fill();
      glowOff(ctx);
      ink(ctx, r * 0.3 * s);
      ctx.strokeStyle = `rgba(255,220,120,${0.6 + 0.4 * p})`;
      ctx.lineWidth = Math.max(1, r * 0.03);
      ctx.beginPath();
      ctx.moveTo(0, -0.08 * r * s);
      ctx.lineTo(0, 0.08 * r * s);
      ctx.moveTo(-0.04 * r * s, 0);
      ctx.lineTo(0.04 * r * s, 0);
      ctx.stroke();
      ctx.restore();
    }
  },
  toad: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 3);
    // crête de pointes venimeuses le long du dos
    glowOn(ctx, '#38F0D0', r * 0.2 * p);
    for (const [x, y, h, a] of [[-0.72, -0.5, 0.2, -0.7], [-0.52, -0.6, 0.27, -0.45], [-0.3, -0.66, 0.31, -0.2], [-0.08, -0.69, 0.3, 0.05], [0.14, -0.67, 0.26, 0.25]] as const) {
      spike(ctx, x * r, (y + 0.05) * r, 0.14 * r, h * r, a, '#3CE8C8', 'rgba(8,40,40,0.9)', Math.max(1.2, r * 0.04));
    }
    glowOff(ctx);
    // verrues et glandes qui luisent sur le dos et le flanc
    glowOn(ctx, '#38F0D0', r * 0.3 * p);
    for (const [x, y, s] of [[-0.55, -0.22, 0.06], [-0.2, -0.38, 0.07], [0.12, -0.42, 0.055], [-0.75, 0.02, 0.05], [0.3, -0.2, 0.05], [0.55, -0.12, 0.045], [-0.4, 0.05, 0.045]] as const) {
      ctx.fillStyle = `rgba(150,255,235,${0.55 + 0.4 * Math.sin(u.t * 3 + x * 7 + u.seed)})`;
      ctx.beginPath();
      ctx.arc(x * r, y * r, s * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    // bulles toxiques qui montent, et filet de venin au coin de la gueule
    for (let k = 0; k < 4; k++) {
      const f = (u.t * 0.6 + k / 4 + u.seed) % 1, x = -0.3 + k * 0.28 + Math.sin(u.t * 3 + k * 2) * 0.05;
      ctx.strokeStyle = `rgba(150,255,235,${0.8 * (1 - f)})`;
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.beginPath();
      ctx.arc(x * r, (-0.78 - f * 0.55) * r, r * (0.04 + 0.04 * f), 0, TAU);
      ctx.stroke();
    }
    const f = (u.t * 0.9 + u.seed) % 1;
    ctx.fillStyle = `rgba(90,255,215,${1 - f})`;
    ctx.beginPath();
    ctx.ellipse(0.93 * r, (0.28 + f * 0.4) * r, r * 0.035, r * 0.06, 0, 0, TAU);
    ctx.fill();
  },
});


// ───────── Groupe B : serpent, crabe, ver des sables, vautour, chacal, salamandre, chauve-souris ─────────
const legBFlame = (ctx: Ctx, x: number, y: number, w: number, h: number, t: number, outer: string, inner: string, ph = 0) => {
  const sw = Math.sin(t * 7 + ph) * w * 0.35, hh = h * (0.88 + 0.12 * Math.sin(t * 9 + ph * 2));
  for (const [k, col] of [[1, outer], [0.55, inner]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w * k, y);
    ctx.quadraticCurveTo(x - w * 0.9 * k, y - hh * 0.55 * k, x + sw * k, y - hh * k);
    ctx.quadraticCurveTo(x + w * 0.9 * k, y - hh * 0.5 * k, x + w * k, y);
    ctx.closePath();
    ctx.fill();
  }
};

Object.assign(VARIANT_FILTERS, {
  serpent: 'hue-rotate(85deg) saturate(1.7) brightness(0.62) contrast(1.15)', // violet d'orage
  sandworm: 'hue-rotate(-28deg) saturate(2.2) brightness(0.5) contrast(1.2)', // basalte rouge sombre
  vulture: 'sepia(0.45) saturate(0.8) brightness(1.75) contrast(0.95)', // plumes d'os et d'or
  jackal: 'grayscale(1) brightness(0.3) contrast(1.5)', // noir d'Anubis
  salamander: 'hue-rotate(190deg) saturate(1.5) brightness(0.95)', // flamme bleue
  ash_bat: 'hue-rotate(125deg) saturate(1.4) brightness(1.05)', // spectre vert
});

Object.assign(LEGEND_BACK, {
  vulture: (ctx: Ctx, r: number, u: UnitLook) => {
    // disque solaire à rayons dorés qui tourne doucement derrière le dos
    const p = pulseOf(u, 2), cx = 0.0 * r, cy = -0.05 * r;
    ctx.save();
    glowOn(ctx, '#FFC94A', r * 0.35);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU + u.t * 0.4, l = (k % 2 ? 1.0 : 1.2) * r * (0.95 + 0.05 * p);
      ctx.fillStyle = k % 2 ? '#E8A93A' : '#FFE08A';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.1) * 0.78 * r, cy + Math.sin(a - 0.1) * 0.78 * r);
      ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      ctx.lineTo(cx + Math.cos(a + 0.1) * 0.78 * r, cy + Math.sin(a + 0.1) * 0.78 * r);
      ctx.closePath();
      ctx.fill();
    }
    glowOff(ctx);
    ctx.strokeStyle = 'rgba(255,214,110,0.9)';
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, 0.8 * r, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
  ash_bat: (ctx: Ctx, r: number, u: UnitLook) => {
    // anneau runique spectral derrière la chauve-souris
    const p = pulseOf(u, 3);
    ctx.save();
    glowOn(ctx, '#5CFFB0', r * 0.4);
    ctx.strokeStyle = `rgba(120,255,190,${0.5 + 0.4 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.beginPath();
    ctx.arc(0, -0.05 * r, 0.82 * r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.03);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + u.t * 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 0.74 * r, -0.05 * r + Math.sin(a) * 0.74 * r);
      ctx.lineTo(Math.cos(a + 0.12) * 0.9 * r, -0.05 * r + Math.sin(a + 0.12) * 0.9 * r);
      ctx.stroke();
    }
    ctx.restore();
    glowOff(ctx);
  },
});

Object.assign(LEGEND_FRONT, {
  serpent: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 5), rise = u.charge ?? 0, hy = -(0.38 + rise * 0.5) * r;
    const pts: [number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const k = i / 13;
      pts.push([(0.1 - k * 1.7) * r, (0.38 + Math.sin(k * 7 - u.t * 4 + u.seed) * 0.12) * r]);
    }
    // nageoire dorsale dorée, le long du corps puis du cou
    glowOn(ctx, '#FFD34A', r * 0.2);
    for (let i = 1; i < 13 && !u.inWater; i++) { // à l'eau, le corps est sous la surface : pas de nageoire
      const [x, y] = pts[i], hgt = (0.34 - i * 0.018) * r;
      spike(ctx, x, y - (0.22 - i * 0.012) * r, 0.16 * r, hgt, -0.25, i % 2 ? '#FFD34A' : '#F0B64A', 'rgba(30,10,50,0.8)', Math.max(1, r * 0.03));
    }
    glowOff(ctx);
    // grandes cornes d'or rabattues vers l'arrière
    for (const [dx, k] of [[0.34, 1], [0.46, 0.7]] as const) {
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.moveTo((dx - 0.06) * r, hy - 0.2 * r);
      ctx.quadraticCurveTo((dx - 0.3 * k) * r, hy - 0.46 * k * r, (dx - 0.62 * k) * r, hy - 0.34 * k * r);
      ctx.quadraticCurveTo((dx - 0.3 * k) * r, hy - 0.3 * k * r, (dx + 0.06) * r, hy - 0.16 * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.2);
    }
    // arcs électriques qui crépitent autour du cou
    ctx.save();
    ctx.strokeStyle = `rgba(190,230,255,${0.55 + 0.45 * p})`;
    ctx.lineWidth = Math.max(1.2, r * 0.035);
    ctx.lineJoin = 'round';
    glowOn(ctx, '#7FC8FF', r * 0.3);
    for (let b = 0; b < 3; b++) {
      const ph = Math.floor(u.t * 8 + b * 3) * 1.7 + b, x0 = (-0.1 + b * 0.05) * r, y0 = hy + (0.7 + b * 0.2) * r * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let s = 1; s <= 4; s++) ctx.lineTo(x0 + (s * 0.1 + Math.sin(ph + s * 2.3) * 0.07 + b * 0.04) * r, y0 - s * 0.14 * r + Math.cos(ph * 1.3 + s) * 0.05 * r);
      ctx.stroke();
    }
    ctx.restore();
    // œil qui rougeoie plus fort
    glowOn(ctx, '#7FE0FF', r * 0.35 * p);
    ctx.fillStyle = '#E8FAFF';
    ctx.beginPath();
    ctx.ellipse(0.58 * r, hy - 0.08 * r, 0.04 * r, 0.04 * r, 0, 0, TAU);
    ctx.fill();
    glowOff(ctx);
  },
  sandworm: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 3), sway = Math.sin(u.t * 2.4 + u.seed) * 0.08;
    const seg = [[0, 0.5, 0.48], [0.08, 0.15, 0.46], [0.2, -0.2, 0.43], [0.34, -0.52, 0.4]];
    // cristaux d'ambre autour du cratère
    for (const [x, h, a] of [[-0.95, 0.4, -0.5], [-0.78, 0.3, -0.3], [0.8, 0.34, 0.4], [0.98, 0.26, 0.6]] as const) {
      glowOn(ctx, '#FF8A2A', r * 0.15);
      spike(ctx, x * r, 0.66 * r, 0.16 * r, h * r, a, '#FFB84A', 'rgba(40,10,5,0.8)', Math.max(1, r * 0.03));
    }
    glowOff(ctx);
    for (const [i, [sx, sy, sr]] of seg.entries()) {
      const x = (sx + sway * i) * r, y = sy * r;
      // plaques osseuses en pointes sur le dos (côté gauche, loin du visage)
      for (const [da, k] of [[-2.5, 1], [-2.05, 0.8]] as const) {
        const bx = x + Math.cos(da) * sr * r * 0.85, by = y + Math.sin(da) * sr * r * 0.8;
        spike(ctx, bx, by, 0.16 * r, 0.3 * k * r, da + Math.PI / 2, '#E8DCC0', 'rgba(30,10,5,0.8)', Math.max(1, r * 0.03));
      }
      // lave entre les anneaux
      ctx.strokeStyle = `rgba(255,${(110 + 80 * p) | 0},40,${0.55 + 0.4 * p})`;
      ctx.lineWidth = Math.max(1.5, r * 0.05);
      ctx.beginPath();
      ctx.ellipse(x, y + sr * r * 0.62, sr * r * 0.78, sr * r * 0.16, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    // grosses braises qui s'envolent du cratère
    for (let k = 0; k < 5; k++) {
      const f = (u.t * 0.6 + k / 5) % 1;
      ctx.fillStyle = `rgba(255,170,60,${0.9 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc((-0.9 + k * 0.45 + Math.sin(f * 5 + k) * 0.08) * r, (0.55 - f * 1.1) * r, 0.045 * r * (1 - f * 0.5), 0, TAU);
      ctx.fill();
    }
  },
  vulture: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 4), t = u.t;
    ctx.save(); // (le drawer du vautour laisse son translate de saut actif : les extras sautent déjà avec lui)
    // flammes d'or au bout des rémiges et de la queue
    glowOn(ctx, '#FFB02A', r * 0.3);
    for (let k = 0; k < 5; k++) legBFlame(ctx, (-0.62 - k * 0.09) * r, (0.3 + k * 0.06) * r, 0.1 * r, 0.45 * r, t, 'rgba(255,170,40,0.9)', 'rgba(255,240,170,0.95)', k * 1.3);
    for (const [x, y] of [[-1.0, 0.5], [-0.9, 0.62]] as const) legBFlame(ctx, x * r, y * r, 0.06 * r, 0.24 * r, t, 'rgba(255,150,30,0.9)', 'rgba(255,235,150,0.95)', x * 7);
    glowOff(ctx);
    // collier d'or
    ctx.strokeStyle = '#F0B64A';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0.4 * r, -0.4 * r, 0.2 * r, 0.09 * r, 0.3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,20,5,0.7)';
    ctx.lineWidth = r * 0.02;
    ctx.stroke();
    glowOn(ctx, '#FFE08A', r * 0.2 * p);
    ctx.fillStyle = '#FF6A4A';
    ctx.beginPath();
    ctx.arc(0.43 * r, -0.31 * r, 0.04 * r, 0, TAU);
    ctx.fill();
    // œil d'or
    ctx.fillStyle = '#FFE08A';
    ctx.beginPath();
    ctx.arc(0.6 * r, -0.67 * r, 0.04 * r, 0, TAU);
    ctx.fill();
    glowOff(ctx);
    // plumes de lumière qui montent
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.5 + k / 4) % 1;
      ctx.fillStyle = `rgba(255,225,130,${0.8 * (1 - f)})`;
      ctx.beginPath();
      ctx.ellipse((-0.5 + k * 0.35) * r, (-0.4 - f * 0.7) * r, 0.025 * r, 0.06 * r, 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },
  jackal: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 3), gt = gait(u, 14), t = u.t;
    const step = u.moving ? Math.sin(u.t * 14 + u.seed) * 0.16 : 0;
    const hx = 0.82 * r, hy = -0.48 * r;
    // bracelets d'or aux pattes
    ctx.strokeStyle = '#F0B64A';
    ctx.lineWidth = r * 0.13;
    ctx.lineCap = 'butt';
    for (const [lx, i] of [[-0.5, 0], [-0.32, 2], [0.38, 1], [0.55, 3]] as const) {
      const k = gt[i].a * 0.16, up = gt[i].lift * 0.08;
      const fx = lx + k, fy = 0.72 - up, kx = lx + k * 0.6 + up * 0.5, ky = 0.42 - up;
      const x = kx + (fx - kx) * 0.62, y = ky + (fy - ky) * 0.62;
      ctx.beginPath();
      ctx.moveTo((x - 0.045) * r, y * r);
      ctx.lineTo((x + 0.045) * r, y * r);
      ctx.stroke();
    }
    // collier usekh : large arc d'or, perles turquoise
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    ctx.ellipse(0.62 * r, -0.2 * r, 0.26 * r, 0.14 * r, 0.55, 0.15, Math.PI - 0.1);
    ctx.ellipse(0.62 * r, -0.2 * r, 0.14 * r, 0.06 * r, 0.55, Math.PI - 0.1, 0.15, true);
    ctx.fill();
    ink(ctx, r * 0.35);
    ctx.fillStyle = '#3FE0C8';
    for (let k = 0; k < 4; k++) {
      const a = 0.5 + k * 0.7;
      ctx.beginPath();
      ctx.arc(0.62 * r + Math.cos(a + 0.55) * 0.2 * r * 0.9 - 0.02 * r, -0.2 * r + Math.sin(a) * 0.1 * r + 0.04 * r, 0.025 * r, 0, TAU);
      ctx.fill();
    }
    // pointes d'or sur les oreilles
    for (const [ox, tip] of [[-0.12, -0.2], [0.03, -0.02]] as const) spike(ctx, hx + (ox + tip) * r, hy - 0.5 * r, 0.1 * r, 0.18 * r, 0, '#F0B64A', 'rgba(30,15,5,0.8)', Math.max(1, r * 0.03));
    // khôl doré qui prolonge l'œil
    glowOn(ctx, '#FFD34A', r * 0.15);
    ctx.strokeStyle = '#FFD34A';
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + 0.12 * r, hy - 0.04 * r);
    ctx.quadraticCurveTo(hx + 0.3 * r, hy - 0.02 * r, hx + 0.34 * r, hy + 0.08 * r);
    ctx.stroke();
    // ankh lumineux sur le flanc
    ctx.strokeStyle = `rgba(255,214,90,${0.55 + 0.45 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.045);
    glowOn(ctx, '#FFC93A', r * 0.3);
    ctx.beginPath();
    ctx.ellipse(-0.3 * r, -0.14 * r, 0.06 * r, 0.075 * r, 0, 0, TAU);
    ctx.moveTo(-0.3 * r, -0.065 * r);
    ctx.lineTo(-0.3 * r, 0.12 * r);
    ctx.moveTo(-0.38 * r, -0.01 * r);
    ctx.lineTo(-0.22 * r, -0.01 * r);
    ctx.stroke();
    // flamme spectrale turquoise au bout de la queue
    legBFlame(ctx, -1.15 * r, (0.3 + step * 0.2) * r, 0.1 * r, 0.42 * r, t, 'rgba(60,230,210,0.85)', 'rgba(210,255,250,0.95)', 1);
    glowOff(ctx);
  },
  salamander: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 4), t = u.t;
    glowOn(ctx, '#4AB8FF', r * 0.35);
    // crête de flammes bleues le long de l'échine
    for (let k = 0; k < 8; k++) {
      const x = -0.65 + k * 0.17, by = 0.06 - 0.38 * Math.sqrt(Math.max(0, 1 - ((x + 0.05) / 0.82) ** 2)) + 0.03;
      legBFlame(ctx, x * r, by * r, 0.075 * r, (0.3 + 0.06 * Math.sin(k * 1.3)) * r, t, 'rgba(60,150,255,0.9)', 'rgba(200,245,255,0.95)', k * 1.1);
    }
    // flamme de queue
    const wig = Math.sin(u.t * 6 + u.seed - 1.6) * 0.22;
    legBFlame(ctx, -1.9 * r, (0.12 + wig) * r, 0.1 * r, 0.42 * r, t, 'rgba(60,150,255,0.9)', 'rgba(200,245,255,0.95)', 2);
    glowOff(ctx);
    // cornes de basalte recourbées vers l'arrière, pointes bleues
    for (const [x, y, k] of [[0.68, -0.3, 1], [0.8, -0.3, 0.75]] as const) {
      ctx.fillStyle = '#2A2230';
      ctx.beginPath();
      ctx.moveTo((x - 0.06) * r, y * r + 0.04 * r);
      ctx.quadraticCurveTo((x - 0.1) * r, (y - 0.3 * k) * r, (x - 0.4 * k) * r, (y - 0.34 * k) * r);
      ctx.quadraticCurveTo((x - 0.16) * r, (y - 0.12 * k) * r, (x + 0.07) * r, y * r + 0.04 * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.25);
      glowOn(ctx, '#7FD0FF', r * 0.2);
      ctx.fillStyle = '#B8ECFF';
      ctx.beginPath();
      ctx.arc((x - 0.4 * k) * r, (y - 0.34 * k) * r, 0.03 * r, 0, TAU);
      ctx.fill();
      glowOff(ctx);
    }
    // fissures de gel-feu sur le flanc
    ctx.strokeStyle = `rgba(150,225,255,${0.4 + 0.5 * p})`;
    ctx.lineWidth = Math.max(1.2, r * 0.035);
    glowOn(ctx, '#4AB8FF', r * 0.2);
    ctx.beginPath();
    ctx.moveTo(-0.5 * r, 0.02 * r);
    ctx.lineTo(-0.38 * r, 0.12 * r);
    ctx.lineTo(-0.26 * r, 0.04 * r);
    ctx.moveTo(0.05 * r, 0.04 * r);
    ctx.lineTo(0.18 * r, 0.14 * r);
    ctx.lineTo(0.3 * r, 0.06 * r);
    ctx.stroke();
    glowOff(ctx);
  },
  ash_bat: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 4), t = u.t, lift = Math.sin(u.t * 14 + u.seed) * 0.5 * r;
    glowOn(ctx, '#5CFFB0', r * 0.35);
    // flammes spectrales au bout des doigts d'aile
    for (const sd of [-1, 1]) {
      const tips = [[1.6, -0.55 * r - lift], [1.45, 0.05 * r - lift * 0.5], [1.0, 0.35 * r - lift * 0.2]];
      tips.forEach(([tx, ty], i) => legBFlame(ctx, sd * tx * r, ty, 0.07 * r, (i ? 0.2 : 0.32) * r, t, 'rgba(70,255,170,0.85)', 'rgba(220,255,240,0.95)', i * 1.7 + sd));
    }
    // sigil sur le poitrail
    ctx.strokeStyle = `rgba(170,255,215,${0.5 + 0.5 * p})`;
    ctx.lineWidth = Math.max(1.2, r * 0.035);
    ctx.beginPath();
    ctx.moveTo(-0.08 * r, 0.2 * r);
    ctx.lineTo(0, 0.1 * r);
    ctx.lineTo(0.08 * r, 0.2 * r);
    ctx.lineTo(0, 0.3 * r);
    ctx.closePath();
    ctx.stroke();
    // halo autour des yeux
    ctx.fillStyle = `rgba(150,255,210,${0.35 * p})`;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sd * 0.15 * r, -0.14 * r, 0.13 * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    // grandes cornes d'os entre les oreilles
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#E8F5E0';
      ctx.beginPath();
      ctx.moveTo(sd * 0.04 * r, -0.4 * r);
      ctx.quadraticCurveTo(sd * 0.1 * r, -0.7 * r, sd * 0.2 * r, -0.62 * r);
      ctx.quadraticCurveTo(sd * 0.12 * r, -0.55 * r, sd * 0.13 * r, -0.38 * r);
      ctx.closePath();
      ctx.fill();
      ink(ctx, r * 0.2);
    }
    // âmes qui s'échappent vers le bas
    for (let k = 0; k < 3; k++) {
      const f = (t * 0.5 + k / 3) % 1;
      ctx.fillStyle = `rgba(150,255,210,${0.7 * (1 - f)})`;
      ctx.beginPath();
      ctx.ellipse((-0.3 + k * 0.3) * r, (0.55 + f * 0.6) * r, 0.04 * r, 0.07 * r, 0, 0, TAU);
      ctx.fill();
    }
  },
});

// ───────────── Légendaires du groupe C : tortue-volcan, gorille, croc, masqué, scorpion, wyverne, dragon ─────────────
/** Une flamme (goutte qui danse) : base centrée en (x, y), hauteur h vers le haut ; c0 l'extérieur, c1 le cœur. */
const legCFlame = (ctx: Ctx, x: number, y: number, w: number, h: number, t: number, ph: number, c0: string, c1: string) => {
  const hh = h * (0.8 + 0.2 * Math.sin(t * 9 + ph)), sw = Math.sin(t * 6 + ph) * w * 0.35;
  for (const [k, col] of [[1, c0], [0.5, c1]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - (w / 2) * k, y);
    ctx.quadraticCurveTo(x - w * 0.6 * k, y - hh * 0.5 * k, x + sw * k, y - hh * k);
    ctx.quadraticCurveTo(x + w * 0.6 * k, y - hh * 0.5 * k, x + (w / 2) * k, y);
    ctx.closePath();
    ctx.fill();
  }
};
/** Éclair en dents de scie de (x0, y0) à (x1, y1), qui scintille (nouvelle forme ~10 fois par seconde). */
const legCBolt = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, t: number, seed: number, col: string, lw: number, jit: number) => {
  const n = 6, fr = Math.floor(t * 10), dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < n; i++) {
    const k = i / n, o = Math.sin((fr + seed) * 12.9898 + i * 78.233) * jit;
    ctx.lineTo(x0 + dx * k - (dy / l) * o, y0 + dy * k + (dx / l) * o);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
};
/** Pointe de cristal sombre à arête lumineuse (obsidienne, cristaux) : pointe vers le haut, tournée de ang. */
const legCShard = (ctx: Ctx, x: number, y: number, w: number, h: number, ang: number, fill: string, edge: string, glow: string, r: number) => {
  glowOn(ctx, glow, r * 0.18);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w * 0.12, -h * 0.82);
  ctx.lineTo(0, -h);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  ctx.restore();
  glowOff(ctx);
};

Object.assign(VARIANT_FILTERS, {
  lava_tortoise: 'hue-rotate(185deg) saturate(1.3) brightness(1.0)', // magma → plasma bleu
  gorilla: 'grayscale(1) brightness(2.5) contrast(0.8)', // dos d'argent complet : pelage blanc
  masked: 'hue-rotate(165deg) saturate(1.15) brightness(0.9)', // masque violet, cornes et plumes turquoise
  scorpion: 'saturate(0.45) brightness(0.42) contrast(1.4)', // obsidienne
  wyvern: 'hue-rotate(-35deg) saturate(1.3) brightness(1.0)', // corps d'or, ailes bleues
  dragon: 'hue-rotate(255deg) saturate(1.1) brightness(0.62)', // violet du néant
});

Object.assign(LEGEND_BACK, {
  lava_tortoise: (ctx: Ctx, r: number, u: UnitLook) => {
    // halo de chaleur bleu-blanc derrière la carapace
    const p = pulseOf(u, 2.2), g = ctx.createRadialGradient(0, 0, 0.2 * r, 0, -0.05 * r, 1.45 * r);
    g.addColorStop(0, `rgba(150,230,255,${0.55 * p})`);
    g.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -0.05 * r, 1.45 * r, 1.25 * r, 0, 0, TAU);
    ctx.fill();
  },
  gorilla: (ctx: Ctx, r: number, u: UnitLook) => {
    // grande grappe de cristaux de glace plantée dans le dos, derrière les épaules
    const p = pulseOf(u, 2);
    for (const [x, y, h, a] of [[-0.3, -0.35, 0.7, -0.5], [-0.05, -0.55, 0.95, -0.2], [0.22, -0.62, 0.8, 0.08], [-0.55, -0.1, 0.5, -0.8]] as const) {
      legCShard(ctx, x * r, y * r, 0.26 * r, h * r * (0.97 + 0.03 * p), a, '#BDEBFF', 'rgba(30,70,110,0.75)', '#8FE0FF', r);
    }
  },
  masked: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2), t = u.t + u.seed;
    // aura d'esprit derrière le masque
    const g = ctx.createRadialGradient(0.04 * r, -0.75 * r, 0.2 * r, 0.04 * r, -0.75 * r, 1.35 * r);
    g.addColorStop(0, `rgba(120,255,220,${0.35 * p})`);
    g.addColorStop(1, 'rgba(60,200,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0.04 * r, -0.75 * r, 1.35 * r, 0, TAU);
    ctx.fill();
    // bois d'os spectraux : une grande ramure de chaque côté du masque
    glowOn(ctx, '#7FFFD8', r * 0.15);
    for (const s of [-1, 1]) {
      const sway = Math.sin(t * 1.8 + s) * 0.03;
      const beam = bez([s * 0.3 + 0.04, -1.2], [s * 1.1, -1.25], [s * 0.85 + sway + 0.04, -1.8], 10);
      band(ctx, r, beam, 0.15, 0.05, '#EDE6CE', '#BFB495');
      for (const [i, len, dir] of [[3, 0.42, 1], [6, 0.38, 1], [8, 0.28, -1]] as const) {
        const [bx, by] = beam[i];
        band(ctx, r, bez([bx, by], [bx + s * dir * 0.2, by - 0.1], [bx + s * dir * 0.34, by - len], 4), 0.09, 0.03, '#EDE6CE', '#BFB495');
      }
    }
    glowOff(ctx);
  },
  scorpion: (ctx: Ctx, r: number, u: UnitLook) => {
    // brume de venin qui rampe au sol
    const p = pulseOf(u, 1.6), g = ctx.createRadialGradient(0, 0.45 * r, 0.1 * r, 0, 0.45 * r, 1.4 * r);
    g.addColorStop(0, `rgba(90,255,120,${0.3 * p})`);
    g.addColorStop(1, 'rgba(60,200,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0.45 * r, 1.4 * r, 0.45 * r, 0, 0, TAU);
    ctx.fill();
  },
  wyvern: (ctx: Ctx, r: number, u: UnitLook) => {
    // nuage d'orage : halo électrique derrière la bête
    const p = pulseOf(u, 3), g = ctx.createRadialGradient(0, -0.5 * r, 0.1 * r, 0, -0.5 * r, 1.6 * r);
    g.addColorStop(0, `rgba(120,190,255,${0.3 * p})`);
    g.addColorStop(1, 'rgba(60,110,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -0.5 * r, 1.6 * r, 0, TAU);
    ctx.fill();
  },
  dragon: (ctx: Ctx, r: number, u: UnitLook) => {
    // brasier du néant : une grande lueur violette derrière les ailes
    const p = pulseOf(u, 2), g = ctx.createRadialGradient(-0.1 * r, -0.7 * r, 0.2 * r, -0.1 * r, -0.7 * r, 1.9 * r);
    g.addColorStop(0, `rgba(170,110,255,${0.4 * p})`);
    g.addColorStop(1, 'rgba(90,40,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(-0.1 * r, -0.7 * r, 1.9 * r, 0, TAU);
    ctx.fill();
  },
});

Object.assign(LEGEND_FRONT, {
  lava_tortoise: (ctx: Ctx, r: number, u: UnitLook) => {
    if (u.shell) return; // en toupie, la carapace tourne : pas d'effets calés sur la forme debout
    const t = u.t + u.seed, p = pulseOf(u, 3);
    // pointes d'obsidienne à arête de plasma tout autour du dôme
    for (const [a, h] of [[-2.85, 0.28], [-2.5, 0.36], [-2.15, 0.3], [-1.0, 0.3], [-0.7, 0.38], [-0.4, 0.28]] as const) {
      const x = 0.92 * Math.cos(a) * r, y = (0.28 + 0.82 * Math.sin(a)) * r;
      legCShard(ctx, x, y + 0.04 * r, 0.2 * r, h * r, a + Math.PI / 2, '#101828', `rgba(140,235,255,${0.6 + 0.4 * p})`, '#5CD8FF', r);
    }
    // flammes de plasma qui jaillissent du cratère
    glowOn(ctx, '#6CD8FF', r * 0.35);
    for (const [dx, w, h, ph] of [[-0.12, 0.2, 0.42, 0], [0.12, 0.2, 0.46, 2], [0, 0.24, 0.62, 4]] as const) {
      legCFlame(ctx, dx * r, -0.92 * r, w * r, h * r, t, ph, 'rgba(90,200,255,0.85)', 'rgba(235,252,255,0.95)');
    }
    glowOff(ctx);
    // braises bleues qui montent
    ctx.fillStyle = 'rgba(190,240,255,0.9)';
    for (let k = 0; k < 6; k++) {
      const f = (t * 0.6 + k / 6) % 1;
      ctx.fillRect((Math.sin(k * 2.7) * 0.8 + Math.sin(t * 2 + k) * 0.05) * r, (-0.5 - f * 1.1) * r, r * 0.035, r * 0.035);
    }
    // gouttes de plasma qui perlent du rebord
    for (const [x, ph] of [[-0.55, 0], [0.3, 1.7]] as const) {
      const f = (t * 0.8 + ph) % 1;
      ctx.fillStyle = `rgba(120,225,255,${1 - f})`;
      ctx.beginPath();
      ctx.ellipse(x * r, (0.5 + f * 0.25) * r, 0.03 * r, 0.05 * r, 0, 0, TAU);
      ctx.fill();
    }
  },
  gorilla: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 3), breath = Math.sin(u.t * 2 + u.seed) * r * 0.015;
    // cristaux le long de l'échine, au-dessus de la crête de poils
    for (const [a, h] of [[-2.65, 0.22], [-2.35, 0.3], [-2.05, 0.36], [-1.75, 0.34], [-1.45, 0.28]] as const) {
      const x = 0.15 * r + Math.cos(a) * 0.62 * r, y = -0.22 * r + breath + Math.sin(a) * 0.54 * r;
      legCShard(ctx, x, y + 0.03 * r, 0.14 * r, h * r, a + Math.PI / 2, '#CFF2FF', 'rgba(30,80,120,0.7)', '#8FE0FF', r);
    }
    // rune de glace luisante sur la poitrine
    ctx.save();
    ctx.translate(0.46 * r, -0.04 * r + breath);
    glowOn(ctx, '#7FE8FF', r * 0.3 * p);
    ctx.strokeStyle = `rgba(150,240,255,${0.5 + 0.5 * p})`;
    ctx.lineWidth = Math.max(1.5, r * 0.04);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -0.12 * r);
    ctx.lineTo(0.08 * r, 0);
    ctx.lineTo(0, 0.12 * r);
    ctx.lineTo(-0.08 * r, 0);
    ctx.closePath();
    ctx.moveTo(0, -0.12 * r);
    ctx.lineTo(0, 0.12 * r);
    ctx.stroke();
    glowOff(ctx);
    ctx.restore();
    // yeux de glace
    glowOn(ctx, '#8FE8FF', r * 0.2);
    ctx.fillStyle = '#E4FBFF';
    for (const dx of [0.03, 0.17]) {
      ctx.beginPath();
      ctx.arc(0.72 * r + dx * r, -0.32 * r + breath - 0.04 * r, 0.04 * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    // givre qui tombe des poings
    ctx.fillStyle = 'rgba(210,245,255,0.9)';
    for (let k = 0; k < 6; k++) {
      const f = (u.t * 0.5 + k / 6) % 1;
      ctx.fillRect((-0.5 + k * 0.28 + Math.sin(u.t * 2 + k) * 0.05) * r, (-0.7 + f * 1.4) * r, r * 0.03, r * 0.03);
    }
  },
  masked: (ctx: Ctx, r: number, u: UnitLook) => {
    const t = u.t + u.seed, p = pulseOf(u, 3);
    // braise d'esprit dans l'orbite noire du masque
    glowOn(ctx, '#7FFFD8', r * 0.3);
    ctx.fillStyle = `rgba(190,255,235,${0.6 + 0.4 * p})`;
    ctx.beginPath();
    ctx.arc(0.28 * r, -0.82 * r, 0.05 * r, 0, TAU);
    ctx.fill();
    // trois feux follets d'esprit qui tournent autour de lui
    for (let k = 0; k < 3; k++) {
      const a = t * 1.3 + (k / 3) * TAU, x = Math.cos(a) * 1.0 * r, y = (-0.5 + Math.sin(a) * 0.35) * r;
      glowOn(ctx, '#5CFFC8', r * 0.3);
      legCFlame(ctx, x, y + 0.1 * r, 0.16 * r, 0.3 * r, t, k * 2, 'rgba(70,240,190,0.85)', 'rgba(230,255,245,0.95)');
    }
    glowOff(ctx);
    // anneaux d'os spectraux aux poignets : petites lueurs sur les cornes
    ctx.fillStyle = `rgba(160,255,230,${0.5 + 0.4 * p})`;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 0.6 * r + 0.04 * r, -1.62 * r, 0.035 * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
  },
  scorpion: (ctx: Ctx, r: number, u: UnitLook) => {
    const t = u.t + u.seed, p = pulseOf(u, 4);
    const sway = Math.sin(t * 2.4) * 0.06, poised = u.moving ? 0 : Math.sin(t * 5) * 0.03;
    // cristaux d'émeraude plantés sur la carapace
    for (let k = 0; k < 5; k++) {
      const x = -0.55 + k * 0.17, y = 0.05 - 0.32 * Math.sqrt(Math.max(0, 1 - ((x + 0.1) / 0.62) ** 2));
      legCShard(ctx, x * r, (y + 0.03) * r, 0.14 * r, (0.2 + (k % 2) * 0.1) * r, (x + 0.1) * 0.5, '#0C2A18', `rgba(110,255,140,${0.6 + 0.4 * p})`, '#5CFF8C', r);
    }
    // veines de venin le long de la queue, qui battent
    const seg: [number, number][] = [[-0.55, -0.08], [-0.82, -0.32], [-0.92, -0.62], [-0.8, -0.92], [-0.52 + sway, -1.1 + poised]];
    glowOn(ctx, '#5CFF8C', r * 0.25);
    ctx.fillStyle = `rgba(120,255,150,${0.55 + 0.45 * p})`;
    for (const [x, y] of seg) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, 0.05 * r, 0, TAU);
      ctx.fill();
    }
    // le dard vire au vert vif ; une goutte de venin tombe de sa pointe
    const [bx, by] = seg[4];
    ctx.fillStyle = `rgba(110,255,130,${0.7 + 0.3 * p})`;
    ctx.beginPath();
    ctx.ellipse((bx + 0.2) * r, (by + 0.02) * r, 0.09 * r, 0.07 * r, 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo((bx + 0.3) * r, (by - 0.04) * r);
    ctx.quadraticCurveTo((bx + 0.5) * r, (by + 0.02) * r, (bx + 0.44) * r, (by + 0.24) * r);
    ctx.lineTo((bx + 0.3) * r, (by + 0.08) * r);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 2; k++) {
      const f = (t * 1.1 + k * 0.5) % 1;
      ctx.fillStyle = `rgba(140,255,120,${1 - f})`;
      ctx.beginPath();
      ctx.ellipse((bx + 0.44) * r, (by + 0.3 + f * 0.5) * r, 0.03 * r, 0.05 * r, 0, 0, TAU);
      ctx.fill();
    }
    // yeux d'émeraude
    ctx.fillStyle = '#C8FFD0';
    for (const [ex, ey] of [[0.5, -0.07], [0.41, -0.09]] as const) {
      ctx.beginPath();
      ctx.arc(ex * r, ey * r, 0.03 * r, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
  },
  wyvern: (ctx: Ctx, r: number, u: UnitLook) => {
    const t = u.t + u.seed, p = pulseOf(u, 5), sw = Math.sin(t * 2.4) * 0.12;
    const hy = -0.82 + Math.sin(t * 2) * 0.03;
    // crête de cristaux électriques le long du cou
    const neck = bez([0.25, -0.25], [0.35, -0.75], [0.68, hy + 0.04], 8);
    for (let i = 4; i < neck.length - 1; i += 1) {
      const [x, y] = neck[i];
      legCShard(ctx, (x - 0.1) * r, (y - 0.02) * r, 0.1 * r, (0.22 + (i % 2) * 0.08) * r, -0.8, '#CFE8FF', 'rgba(20,50,120,0.7)', '#6CB4FF', r);
    }
    // lames de foudre le long de la queue
    const tl = bez([-0.3, -0.02], [-1.0, 0.25 + sw], [-1.45, -0.3 + sw], 14);
    for (let i = 3; i <= 11; i += 2) legCShard(ctx, tl[i][0] * r, (tl[i][1] - 0.1 * (1 - i / 14)) * r, 0.1 * r, (0.2 - i * 0.008) * r, -0.5, '#CFE8FF', 'rgba(20,50,120,0.7)', '#6CB4FF', r);
    // éclairs qui courent sur l'aile repliée (seulement ailes au repos)
    const folded = !u.flying && (!u.wings || u.wings.spread < 0.2);
    glowOn(ctx, '#8CC8FF', r * 0.3);
    if (folded) {
      legCBolt(ctx, -0.42 * r, -1.0 * r, 0.05 * r, -0.55 * r, t, 1, `rgba(200,235,255,${0.55 + 0.45 * p})`, Math.max(1.5, r * 0.04), r * 0.12);
      legCBolt(ctx, 0.0 * r, -1.15 * r, -0.35 * r, -0.4 * r, t, 7, `rgba(255,255,255,${0.4 + 0.5 * p})`, Math.max(1, r * 0.03), r * 0.1);
    }
    // orbe de foudre au bout de la queue
    const [tx, ty] = tl[14];
    const g = ctx.createRadialGradient(tx * r, ty * r, 0, tx * r, ty * r, 0.22 * r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, `rgba(120,190,255,${0.6 + 0.3 * p})`);
    g.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tx * r, ty * r, 0.22 * r, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      const a = t * 3 + k * 2.1;
      legCBolt(ctx, tx * r, ty * r, (tx + Math.cos(a) * 0.25) * r, (ty + Math.sin(a) * 0.25) * r, t, k * 3, 'rgba(210,240,255,0.9)', Math.max(1, r * 0.025), r * 0.05);
    }
    // œil d'orage
    ctx.fillStyle = '#E8F6FF';
    ctx.beginPath();
    ctx.arc(0.87 * r, (hy - 0.04) * r, 0.03 * r, 0, TAU);
    ctx.fill();
    glowOff(ctx);
  },
  dragon: (ctx: Ctx, r: number, u: UnitLook) => {
    const t = u.t + u.seed, p = pulseOf(u, 3);
    const beat = Math.sin(t * (u.moving ? 4.5 : 1.4)) * (u.moving ? 0.12 : 0.05), sw = Math.sin(t * 2.2) * 0.1;
    // flammes du néant sur l'échine et la queue
    const tail = bez([-0.45, -0.05], [-1.05, 0.12 + sw], [-1.55, -0.18 + sw], 14);
    const ridge: P2[] = [...bez([0.5, -0.36], [0.0, -0.56], [-0.55, -0.16], 6), ...tail.filter((_, i) => i >= 2 && i <= 12 && i % 2 === 0).map((q): P2 => [q[0], q[1] - 0.12])];
    glowOn(ctx, '#A060FF', r * 0.4);
    ridge.forEach(([x, y], i) => legCFlame(ctx, x * r, (y - 0.04) * r, 0.17 * r, (0.34 - i * 0.012) * r, t, i * 1.3, 'rgba(160,90,255,0.8)', 'rgba(240,225,255,0.95)'));
    // flammes aux pointes des deux ailes
    for (const [x, y] of [[0.3, -1.15 - beat], [-0.1, -1.6 - beat * 1.4], [-0.62, -1.42 - beat], [-0.98, -0.95], [-0.35, -1.55 - beat * 1.4], [-0.85, -1.3 - beat]] as const) {
      legCFlame(ctx, x * r, y * r + 0.04 * r, 0.2 * r, 0.36 * r, t, x * 5 + y * 3, 'rgba(150,80,255,0.75)', 'rgba(235,215,255,0.9)');
    }
    // œil de néant
    ctx.fillStyle = `rgba(230,210,255,${0.7 + 0.3 * p})`;
    ctx.beginPath();
    ctx.arc(1.03 * r, (-0.88 + Math.sin(t * 1.8) * 0.03) * r, 0.04 * r, 0, TAU);
    ctx.fill();
    glowOff(ctx);
    // cendres violettes qui s'élèvent
    ctx.fillStyle = 'rgba(200,160,255,0.9)';
    for (let k = 0; k < 7; k++) {
      const f = (t * 0.5 + k / 7) % 1;
      ctx.fillRect((-1.2 + k * 0.38 + Math.sin(t * 2 + k) * 0.05) * r, (-0.4 - f * 1.4) * r, r * 0.035, r * 0.035);
    }
  },
});


// ───────── Reprise : crabe-conque et crocodile aux nénuphars ─────────
const legRLotus = (ctx: Ctx, x: number, y: number, s: number, p: number, hue: [string, string]) => {
  // fleur de lotus lumineuse : cinq pétales en éventail
  glowOn(ctx, hue[0], s * 0.8 * p);
  for (const [a, k] of [[-0.95, 0.8], [0.95, 0.8], [-0.45, 1], [0.45, 1], [0, 1.1]] as const) {
    ctx.fillStyle = k > 0.9 ? hue[1] : hue[0];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.sin(a) * s * 0.9, y - s * 0.4, x + Math.sin(a) * s * 0.7, y - s * k);
    ctx.quadraticCurveTo(x + Math.sin(a) * s * 0.2, y - s * 0.55 * k, x, y);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,10,40,0.55)';
    ctx.lineWidth = Math.max(0.8, s * 0.08);
    ctx.stroke();
  }
  glowOff(ctx);
  ctx.fillStyle = '#FFE27A';
  ctx.beginPath();
  ctx.arc(x, y - s * 0.12, s * 0.12, 0, TAU);
  ctx.fill();
};

Object.assign(VARIANT_FILTERS, {
  croc: 'hue-rotate(40deg) saturate(1.3) brightness(0.6)', // vert-noir des eaux stagnantes
  crab: 'hue-rotate(205deg) saturate(1.4) brightness(0.68)',
});
const legRCoral = (ctx: Ctx, x: number, y: number, len: number, ang: number, depth: number, w: number, col: string, tip: string, r: number, t: number) => {
  // branche de corail : un trait qui se divise en deux, bout lumineux
  const sway = Math.sin(t * 1.5 + x * 0.01 + depth) * 0.05;
  const ex = x + Math.sin(ang + sway) * len, ey = y - Math.cos(ang + sway) * len;
  ctx.strokeStyle = 'rgba(12,18,16,0.75)';
  ctx.lineWidth = w + Math.max(1.5, r * 0.04);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.stroke();
  if (depth > 0) {
    legRCoral(ctx, ex, ey, len * 0.72, ang - 0.55, depth - 1, w * 0.72, col, tip, r, t);
    legRCoral(ctx, ex, ey, len * 0.72, ang + 0.5, depth - 1, w * 0.72, col, tip, r, t);
  } else {
    glowOn(ctx, tip, r * 0.2);
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.arc(ex, ey, w * 0.65, 0, TAU);
    ctx.fill();
    glowOff(ctx);
  }
};

Object.assign(LEGEND_FRONT, {
  croc: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2.5), t = u.t + u.seed;
    // même repère que le corps (translation et étirement du drawer) : tout s'accroche à la ligne du dos
    if (!u.inWater) { // à l'eau, le corps n'est qu'une ombre : ni plaques ni nénuphars
    ctx.save();
    ctx.translate(0, 0.16 * r);
    ctx.scale(1.08, 1.25);
    const top = (x: number) => (0.24 - 0.24 * Math.sqrt(Math.max(0, 1 - (x / 0.72) ** 2))) * r; // dessus du corps
    // grandes plaques d'os dorées plantées dans le dos
    for (let k = 0; k < 6; k++) {
      const x = -0.5 + k * 0.19;
      spike(ctx, x * r, top(x) + 0.02 * r, 0.17 * r, (0.2 + (k % 2) * 0.05) * r, -0.12, '#E8C660', 'rgba(30,20,5,0.8)', Math.max(1, r * 0.03));
    }
    // et sur la queue, de plus en plus petites
    for (let i = 1; i <= 8; i++) {
      const k = i / 10, x = -0.62 * r - k * 0.95 * r;
      const y = 0.24 * r + Math.sin(u.t * 4 + u.seed - k * 2.2) * 0.1 * r * k - (0.2 - 0.17 * k) * r;
      spike(ctx, x, y + 0.02 * r, 0.12 * r * (1 - k * 0.4), 0.17 * r * (1 - k * 0.7), -0.3, '#E8C660', 'rgba(30,20,5,0.8)', Math.max(1, r * 0.025));
    }
    // nénuphars posés sur le dos, au ras de la ligne du dos
    for (const [x, w] of [[-0.42, 0.3], [-0.02, 0.26]] as const) {
      const y = top(x) - 0.01 * r;
      ctx.fillStyle = '#3E8A4A';
      ctx.beginPath();
      ctx.ellipse(x * r, y, w * r, w * 0.26 * r, 0, 0.3, TAU - 0.05);
      ctx.lineTo(x * r, y);
      ctx.fill();
      ink(ctx, r * 0.3);
      ctx.fillStyle = 'rgba(170,240,160,0.4)';
      ctx.beginPath();
      ctx.ellipse((x - 0.04) * r, y - 0.015 * r, w * 0.55 * r, w * 0.08 * r, 0, 0, TAU);
      ctx.fill();
      // lotus : redressé à l'échelle normale, planté dans le nénuphar
      ctx.save();
      ctx.translate(x * r, y - 0.02 * r);
      ctx.scale(1 / 1.08, 1 / 1.25);
      legRLotus(ctx, 0, 0, w * 1.1 * r, p, x < -0.2 ? ['#FF8AD2', '#FFD6F0'] : ['#9AE8FF', '#E4FAFF']);
      ctx.restore();
    }
    // yeux d'ambre : un halo sur les bosses des yeux
    for (const dx of [0.18, 0.36]) {
      glowOn(ctx, '#FFC040', r * 0.35);
      ctx.fillStyle = `rgba(255,224,110,${0.55 + 0.4 * p})`;
      ctx.beginPath();
      ctx.ellipse(dx * r, -0.15 * r, 0.075 * r, 0.058 * r, 0, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    ctx.restore();
    }
    // lucioles des marais
    for (let k = 0; k < 5; k++) {
      const a = t * 0.9 + k * 1.3, x = (-0.4 + Math.cos(a) * 0.9) * r, y = (-0.5 + Math.sin(a * 1.3) * 0.25) * r;
      glowOn(ctx, '#D8FF6A', r * 0.25);
      ctx.fillStyle = `rgba(220,255,120,${0.5 + 0.5 * Math.sin(t * 4 + k * 2)})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.035, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
  },
  crab: (ctx: Ctx, r: number, u: UnitLook) => {
    const p = pulseOf(u, 2.2), t = u.t;
    ctx.save();
    ctx.translate(0, 0.12 * r); // le corps est décalé dans le drawer
    // anneaux de marée sous les pattes
    for (let k = 0; k < 2; k++) {
      const f = (t * 0.4 + k * 0.5) % 1;
      ctx.strokeStyle = `rgba(140,235,255,${0.5 * (1 - f)})`;
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath();
      ctx.ellipse(0, 0.45 * r, (1.1 + f * 0.5) * r, (0.2 + f * 0.1) * r, 0, 0, TAU);
      ctx.stroke();
    }
    // deux massifs de corail plantés sur les épaules (loin des yeux, au centre)
    legRCoral(ctx, -0.62 * r, -0.22 * r, 0.34 * r, -0.35, 2, r * 0.09, '#FF6FB5', '#FFE0F2', r, t);
    legRCoral(ctx, -0.8 * r, -0.12 * r, 0.24 * r, -0.9, 1, r * 0.07, '#FF9A6F', '#FFE9C0', r, t + 1);
    legRCoral(ctx, 0.62 * r, -0.22 * r, 0.34 * r, 0.35, 2, r * 0.09, '#46D8E8', '#E0FDFF', r, t + 2);
    legRCoral(ctx, 0.8 * r, -0.12 * r, 0.24 * r, 0.9, 1, r * 0.07, '#7FA8FF', '#E4ECFF', r, t + 3);
    // perles de nacre le long du bord de la carapace
    for (const [x, y] of [[-0.35, -0.3], [-0.12, -0.36], [0.12, -0.36], [0.35, -0.3], [-0.9, 0.0], [0.9, 0.0]] as const) {
      ctx.fillStyle = '#FFF6EA';
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.045, 0, TAU);
      ctx.fill();
      ink(ctx, r * 0.09);
    }
    // les yeux luisent : halo cyan et reflet vif sur chaque pédoncule
    for (const sd of [-1, 1]) {
      const tx = sd * 0.24 * r, ty = -0.6 * r + Math.sin(u.t * 2 + sd + u.seed) * 0.03 * r;
      glowOn(ctx, '#7FEFFF', r * 0.45 * p);
      ctx.strokeStyle = `rgba(150,245,255,${0.6 + 0.4 * p})`;
      ctx.lineWidth = Math.max(1.2, r * 0.04);
      ctx.beginPath();
      ctx.arc(tx, ty, 0.12 * r, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#E8FDFF';
      ctx.beginPath();
      ctx.arc(tx + sd * 0.025 * r, ty + 0.01 * r, 0.03 * r, 0, TAU);
      ctx.fill();
    }
    // billes d'eau lumineuses entre les doigts des pinces
    for (const sd of [-1, 1]) {
      glowOn(ctx, '#7FEFFF', r * 0.4 * p);
      ctx.fillStyle = `rgba(160,245,255,${0.55 + 0.4 * p})`;
      ctx.beginPath();
      ctx.arc(sd * 1.22 * r, -0.82 * r + Math.sin(t * 2 + sd) * 0.04 * r, r * 0.09, 0, TAU);
      ctx.fill();
    }
    glowOff(ctx);
    ctx.restore();
  },
});
