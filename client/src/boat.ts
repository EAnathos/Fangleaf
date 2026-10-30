// Le bateau du bout de l'île : l'épave, puis le bateau qu'Aubin rebâtit étape par étape (la quille, la coque, le pont et
// les mâts, les voiles). Tant qu'une étape est en chantier, on la voit avancer (progress de 0 à 1), entourée de
// l'échafaudage, des piles de bois et des outils, et Aubin y tape du marteau.
// La coque est vue de dessus, posée au sol (tournée comme l'épave, le long du rivage) ; les mâts et les voiles se dressent
// vers le haut de l'écran, comme les arbres.

import type { WorldMap } from '../../shared/worldmap.ts';
import { drawElder } from './sprites.ts';
import { drawShipwreck, shipBarrel, shipPlank, SHIP_DARK, SHIP_DECK, SHIP_HOLE, SHIP_LIGHT, SHIP_WOOD } from './world.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const L = 140; // demi-longueur de la coque (poupe à -L, proue à +L)
const B = 36; // demi-largeur au maître-couple
const SAIL = '#EDE3C8', SAIL_SHADE = '#CFC2A0', BAND = '#5CC8B8';
const MASTS = [{ x: -62, h: 150 }, { x: 14, h: 182 }, { x: 84, h: 138 }]; // artimon, grand mât, misaine

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number) => {
  const u = clamp01(v);
  return u * u * (3 - 2 * u);
};

/** Demi-largeur de la coque à l'abscisse x : pointue à la proue, tableau arrière un peu plus étroit. */
const beam = (x: number) => {
  const u = x / L;
  return u >= 0 ? B * Math.sqrt(Math.max(0, 1 - u ** 2.4)) : B * (1 - 0.3 * (-u) ** 4);
};

/** Contour de la coque, agrandi de grow px (négatif : rétréci), de x0 à x1. */
function hullPath(ctx: Ctx, grow: number, x0 = -L, x1 = L) {
  ctx.beginPath();
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    ctx.lineTo(x + (x >= L - 1 ? grow : 0), -(beam(x) + grow));
  }
  for (let i = n; i >= 0; i--) {
    const x = x0 + ((x1 - x0) * i) / n;
    ctx.lineTo(x + (x >= L - 1 ? grow : 0), beam(x) + grow);
  }
  ctx.closePath();
}

/** Ber : des tréteaux en travers sous la coque, sur lesquels elle repose pendant la construction. */
function cradle(ctx: Ctx) {
  for (const x of [-112, -62, -12, 38, 88]) {
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(x - 3, -B - 12, 12, (B + 14) * 2);
    ctx.fillStyle = SHIP_DARK;
    ctx.fillRect(x - 5, -B - 16, 10, (B + 16) * 2);
    ctx.fillStyle = 'rgba(255,230,200,0.12)';
    ctx.fillRect(x - 5, -B - 16, 3, (B + 16) * 2);
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#3A281A';
      ctx.fillRect(x - 7, s * (B + 12) - 4, 14, 8); // les pieds du tréteau
    }
  }
}

/** La quille (longue poutre, étrave et étambot), posée sur le ber, sur une longueur k (0 à 1, depuis la poupe). */
function keel(ctx: Ctx, k: number) {
  if (k <= 0) return;
  const x1 = -L + 6 + (2 * L - 6) * k;
  ctx.fillStyle = 'rgba(8,14,12,0.3)';
  ctx.fillRect(-L + 8, 3, x1 + L - 6, 9);
  ctx.fillStyle = '#5A3C26';
  ctx.fillRect(-L + 4, -6, x1 + L - 4, 12);
  ctx.fillStyle = SHIP_LIGHT;
  ctx.fillRect(-L + 4, -6, x1 + L - 4, 4);
  ctx.fillStyle = SHIP_DARK; // étambot à la poupe
  ctx.fillRect(-L - 2, -10, 10, 20);
  if (k >= 1) {
    // étrave, recourbée vers l'avant
    ctx.strokeStyle = '#5A3C26';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L - 20, 0);
    ctx.quadraticCurveTo(L + 6, 0, L + 14, -6);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

/** Les membrures : des côtes de bois clair en travers de la quille, de la poupe jusqu'à x1. */
function ribs(ctx: Ctx, x1 = L) {
  for (let x = -L + 14; x < Math.min(x1, L - 16); x += 19) {
    const w = beam(x) + 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(8,14,12,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x + 2, -w + 3);
    ctx.quadraticCurveTo(x + 9, 3, x + 2, w + 3);
    ctx.stroke();
    ctx.strokeStyle = '#A07650';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, -w);
    ctx.quadraticCurveTo(x + 7, 0, x, w);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,205,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, -w + 1);
    ctx.quadraticCurveTo(x + 5, 0, x - 1.5, w - 1);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** Les bordages de la coque (son flanc, avec ses lignes de planches) et la cale ouverte, de la poupe jusqu'à x1. */
function planking(ctx: Ctx, x1 = L) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-L - 20, -B - 30, x1 + L + 20, (B + 30) * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(8,14,12,0.35)';
  ctx.save();
  ctx.translate(6, 8);
  hullPath(ctx, 4);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#3E2716';
  hullPath(ctx, 5);
  ctx.fill();
  ctx.fillStyle = SHIP_WOOD;
  hullPath(ctx, 2);
  ctx.fill();
  // lignes des bordages, le long des flancs
  ctx.strokeStyle = 'rgba(40,24,12,0.5)';
  ctx.lineWidth = 1.2;
  for (const k of [0.94, 0.86]) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      for (let x = -L; x <= L; x += 8) ctx.lineTo(x, s * beam(x) * k);
      ctx.stroke();
    }
  }
  // la cale, ouverte : on voit les membrures à l'intérieur
  ctx.fillStyle = '#3A2818';
  hullPath(ctx, -8);
  ctx.fill();
  ctx.save();
  hullPath(ctx, -8);
  ctx.clip();
  ribs(ctx);
  ctx.fillStyle = SHIP_HOLE; // la carlingue, sur la quille
  ctx.fillRect(-L, -4, 2 * L, 8);
  ctx.restore();
  // la préceinte : une bande plus claire en haut du flanc
  ctx.strokeStyle = SHIP_LIGHT;
  ctx.lineWidth = 2.5;
  hullPath(ctx, -1);
  ctx.stroke();
  ctx.restore();
}

/** Le pont en planches, son bastingage, ses écoutilles, le cabestan et la barre, de la poupe jusqu'à x1. */
function deck(ctx: Ctx, x1 = L) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(-L - 20, -B - 30, x1 + L + 20, (B + 30) * 2);
  ctx.clip();
  ctx.fillStyle = SHIP_DECK;
  hullPath(ctx, -4);
  ctx.fill();
  ctx.save();
  hullPath(ctx, -4);
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,42,22,0.4)';
  ctx.lineWidth = 1.2;
  for (let y = -B; y <= B; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-L, y);
    ctx.lineTo(L, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,42,22,0.3)';
  for (let y = -B; y <= B; y += 8) for (let x = -L + (((y + B) / 8) % 2 ? 18 : 0); x < L; x += 36) ctx.fillRect(x, y, 1.5, 8);
  // dunette à la poupe, un peu plus haute (plus claire)
  ctx.fillStyle = 'rgba(255,236,205,0.12)';
  ctx.fillRect(-L, -B, 44, 2 * B);
  ctx.restore();
  // écoutilles
  for (const [hx, hw] of [[-30, 22], [48, 18]] as const) {
    ctx.fillStyle = SHIP_DARK;
    ctx.fillRect(hx - hw / 2 - 2, -12, hw + 4, 24);
    ctx.fillStyle = '#5A3C26';
    ctx.fillRect(hx - hw / 2, -10, hw, 20);
    ctx.strokeStyle = 'rgba(30,18,10,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 4; k++) {
      ctx.moveTo(hx - hw / 2, -10 + k * 5);
      ctx.lineTo(hx + hw / 2, -10 + k * 5);
    }
    ctx.stroke();
  }
  // la barre à roue, sur la dunette
  ctx.strokeStyle = '#3A2818';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-L + 22, 0, 8, 0, TAU);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    ctx.moveTo(-L + 22 + Math.cos(a) * 3, Math.sin(a) * 3);
    ctx.lineTo(-L + 22 + Math.cos(a) * 12, Math.sin(a) * 12);
  }
  ctx.stroke();
  // le bastingage : une lisse sombre tout autour, ses poteaux
  ctx.strokeStyle = '#3E2716';
  ctx.lineWidth = 3.5;
  hullPath(ctx, -2);
  ctx.stroke();
  ctx.fillStyle = '#2E1C10';
  for (let x = -L + 10; x < L - 12; x += 16) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x, s * (beam(x) - 2), 2, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  if (x1 >= L) {
    // beaupré
    ctx.strokeStyle = '#4A2E1A';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L - 16, 0);
    ctx.lineTo(L + 52, -3);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
}

/** Chantier, autour de la coque : échafaudage, piles de bois, pierres, tréteau, pot de goudron qui fume. */
function yard(ctx: Ctx, stage: number, t: number) {
  // échafaudage le long des deux flancs : poteaux et planches de passerelle
  for (const s of [-1, 1]) {
    const y = s * (B + 20);
    for (const x of [-118, -70, -22, 26, 74]) {
      ctx.fillStyle = 'rgba(8,14,12,0.3)';
      ctx.fillRect(x + 1, y - 2, 8, 8);
    }
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(-120, y + 1, 200, 8);
    ctx.fillStyle = '#9C7A52';
    ctx.fillRect(-122, y - 4, 200, 8);
    ctx.strokeStyle = 'rgba(70,46,26,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -122; x < 78; x += 25) {
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
    }
    ctx.stroke();
    for (const x of [-118, -70, -22, 26, 74]) {
      ctx.fillStyle = '#5A3C26';
      ctx.fillRect(x - 3, y - 5, 7, 10);
    }
  }
  // échelle posée contre le flanc, côté terre
  ctx.save();
  ctx.translate(-40, B + 34);
  ctx.rotate(0.15);
  ctx.strokeStyle = '#7A5A3A';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.lineTo(-6, 22);
  ctx.moveTo(6, -16);
  ctx.lineTo(6, 22);
  for (let k = -12; k < 22; k += 7) {
    ctx.moveTo(-6, k);
    ctx.lineTo(6, k);
  }
  ctx.stroke();
  ctx.restore();
  // pile de rondins, côté terre
  for (let k = 0; k < 5; k++) {
    const x = -112 + (k % 3) * 2, y = B + 66 + k * 9 - (k > 2 ? 22 : 0), dx = k > 2 ? 5 : 0;
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(x + dx + 2, y + 2, 64, 9);
    ctx.fillStyle = '#7A5232';
    ctx.fillRect(x + dx, y - 4, 60, 9);
    ctx.fillStyle = '#C9A06A';
    ctx.beginPath();
    ctx.ellipse(x + dx + 60, y + 0.5, 3.5, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8A6440';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x + dx + 60, y + 0.5, 1.8, 0, TAU);
    ctx.stroke();
  }
  // quelques pierres taillées
  for (const [x, y] of [[-10, B + 92], [6, B + 96], [-2, B + 82]] as const) {
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(x - 6, y - 2, 14, 9);
    ctx.fillStyle = '#9AA39D';
    ctx.fillRect(x - 8, y - 6, 14, 10);
    ctx.fillStyle = '#C3CAC5';
    ctx.fillRect(x - 8, y - 6, 14, 3);
  }
  // tréteau de scieur, une planche dessus, de la sciure dessous
  ctx.fillStyle = 'rgba(214,190,138,0.8)';
  ctx.beginPath();
  ctx.ellipse(40, B + 82, 18, 6, 0, 0, TAU);
  ctx.fill();
  shipPlank(ctx, 40, B + 74, 0.08, 46);
  ctx.fillStyle = '#4A3322';
  for (const s of [-1, 1]) ctx.fillRect(40 + s * 14 - 2, B + 70, 4, 14);
  // pot de goudron, sur un petit feu, qui fume
  const px = -150, py = B + 40;
  ctx.fillStyle = '#E8693F';
  ctx.beginPath();
  ctx.ellipse(px, py + 6, 9 + Math.sin(t * 13) * 1.5, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.ellipse(px, py, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0E0A08';
  ctx.beginPath();
  ctx.ellipse(px, py - 3, 7, 3.5, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.35 + k / 4) % 1;
    ctx.fillStyle = `rgba(70,64,60,${0.4 * (1 - f)})`;
    ctx.beginPath();
    ctx.arc(px - f * 14, py - 8 - f * 34, 4 + f * 9, 0, TAU);
    ctx.fill();
  }
  shipBarrel(ctx, -146, B + 72);
  // ce qui attend son tour, selon l'étape
  if (stage === 2) {
    // un mât couché sur deux tréteaux, qu'on finit de dégrossir
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(-60, B + 118, 170, 9);
    ctx.fillStyle = '#8A6440';
    ctx.beginPath();
    ctx.moveTo(-64, B + 108);
    ctx.lineTo(108, B + 111);
    ctx.lineTo(108, B + 117);
    ctx.lineTo(-64, B + 122);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,236,205,0.25)';
    ctx.fillRect(-64, B + 108, 172, 3);
    for (const x of [-40, 80]) {
      ctx.fillStyle = '#4A3322';
      ctx.fillRect(x - 3, B + 104, 6, 22);
    }
  } else if (stage === 3) {
    // les voiles, pliées au sol, et un rouleau de cordage
    for (const [x, y, w] of [[-60, B + 112, 46], [-8, B + 116, 40], [40, B + 110, 50]] as const) {
      ctx.fillStyle = 'rgba(8,14,12,0.2)';
      ctx.fillRect(x - w / 2 + 3, y - 6, w, 16);
      ctx.fillStyle = SAIL;
      ctx.fillRect(x - w / 2, y - 9, w, 15);
      ctx.fillStyle = SAIL_SHADE;
      ctx.fillRect(x - w / 2, y + 1, w, 5);
      ctx.fillStyle = BAND;
      ctx.fillRect(x - 4, y - 9, 8, 15);
    }
    ctx.strokeStyle = '#B8975E';
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(96, B + 112, 12 - k * 2.5, 7 - k * 1.5, 0, 0, TAU);
      ctx.stroke();
    }
  }
}

/** Point d'un mât sur la coque, à l'écran (coordonnées du monde), à partir du point de la coque (lx, ly). */
const at = (map: WorldMap, lx: number, ly: number) => map.boatPoint(lx, ly);

/** Les mâts, debout (vers le haut de l'écran), chacun à sa hauteur (0 à 1), avec leurs vergues et leurs haubans. */
function masts(ctx: Ctx, map: WorldMap, rise: number[], sails: number, t: number) {
  MASTS.forEach((m, k) => {
    const up = ease(rise[k]);
    if (up <= 0) return;
    const base = at(map, m.x, 0), h = m.h * up, top = base.y - h;
    // haubans : du haut du mât jusqu'aux deux flancs
    if (up > 0.5) {
      ctx.strokeStyle = 'rgba(40,26,14,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of [-1, 1]) {
        for (const dx of [-12, 0, 12]) {
          const side = at(map, m.x + dx, s * (beam(m.x + dx) - 2));
          ctx.moveTo(base.x, top + 6);
          ctx.lineTo(side.x, side.y);
        }
      }
      ctx.stroke();
    }
    // le mât
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(base.x - 1, top + 2, 9, h);
    ctx.fillStyle = '#5A3C26';
    ctx.fillRect(base.x - 4, top, 8, h);
    ctx.fillStyle = 'rgba(255,236,205,0.25)';
    ctx.fillRect(base.x - 4, top, 2.5, h);
    // hune (plateforme) aux deux tiers
    if (up > 0.7) {
      ctx.fillStyle = '#4A2E1A';
      ctx.fillRect(base.x - 11, top + h * 0.3, 22, 5);
    }
    // vergues et voiles : deux étages par mât
    for (const [yk, w] of [[0.2, 0.55], [0.55, 0.72]] as const) {
      if (up < 0.85) continue;
      const vy = top + h * yk, half = m.h * w * 0.42, drop = h * 0.3 * ease(sails * 1.4 - k * 0.15 - (yk > 0.3 ? 0.25 : 0));
      if (drop > 1) {
        // voile carrée, gonflée par la brise, aux couleurs du village sur la plus grande
        const billow = Math.sin(t * 1.3 + k + yk * 4) * 3 + 8;
        ctx.fillStyle = 'rgba(8,14,12,0.22)';
        ctx.beginPath();
        ctx.moveTo(base.x - half + 5, vy + 4);
        ctx.lineTo(base.x + half + 5, vy + 4);
        ctx.quadraticCurveTo(base.x + half + billow * 0.3 + 5, vy + drop * 0.6, base.x + half * 0.9 + 5, vy + drop + 4);
        ctx.lineTo(base.x - half * 0.9 + 5, vy + drop + 4);
        ctx.closePath();
        ctx.fill();
        const g = ctx.createLinearGradient(base.x - half, 0, base.x + half, 0);
        g.addColorStop(0, SAIL_SHADE);
        g.addColorStop(0.45, SAIL);
        g.addColorStop(1, SAIL_SHADE);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(base.x - half, vy);
        ctx.lineTo(base.x + half, vy);
        ctx.quadraticCurveTo(base.x + half + billow * 0.3, vy + drop * 0.6, base.x + half * 0.9, vy + drop);
        ctx.quadraticCurveTo(base.x, vy + drop + billow, base.x - half * 0.9, vy + drop);
        ctx.quadraticCurveTo(base.x - half - billow * 0.3, vy + drop * 0.6, base.x - half, vy);
        ctx.closePath();
        ctx.fill();
        if (yk > 0.3) {
          ctx.fillStyle = BAND;
          ctx.fillRect(base.x - half * 0.92, vy + drop * 0.42, half * 1.84, Math.max(2, drop * 0.16));
        }
        ctx.strokeStyle = 'rgba(120,100,70,0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(base.x, vy + 2);
        ctx.lineTo(base.x, vy + drop + billow * 0.7);
        ctx.stroke();
      } else if (sails > 0) {
        // voile encore ferlée sur sa vergue
        ctx.fillStyle = SAIL_SHADE;
        ctx.fillRect(base.x - half * 0.9, vy - 1, half * 1.8, 5);
      }
      ctx.fillStyle = '#4A2E1A';
      ctx.fillRect(base.x - half, vy - 3, half * 2, 4); // la vergue
    }
    // fanion en haut du grand mât, aux couleurs du village, qui claque au vent
    if (k === 1 && sails >= 1) {
      ctx.fillStyle = BAND;
      ctx.beginPath();
      ctx.moveTo(base.x + 3, top + 2);
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        ctx.lineTo(base.x + 3 + u * 34, top + 2 + u * 4 + Math.sin(t * 6 - u * 5) * 3 * u);
      }
      for (let i = 8; i >= 0; i--) {
        const u = i / 8;
        ctx.lineTo(base.x + 3 + u * 34, top + 12 - u * 4 + Math.sin(t * 6 - u * 5) * 3 * u);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
}

/**
 * Le bateau, dans l'état où il est : stage = étapes achevées (0 : l'épave), progress = avancement de l'étape en chantier
 * (de 0 à 1 ; négatif : pas de chantier). Coordonnées du monde.
 */
export function drawBoat(ctx: Ctx, map: WorldMap, stage: number, progress: number, t: number) {
  const sw = map.shipwreck, building = progress >= 0, p = clamp01(progress);
  ctx.save();
  ctx.translate(sw.x, sw.y);
  ctx.rotate(sw.a);
  if (stage === 0) {
    // l'épave, qu'on démonte pour poser la quille à sa place
    if (!building) drawShipwreck(ctx);
    else {
      ctx.save();
      ctx.globalAlpha = 1 - ease(p * 1.6);
      drawShipwreck(ctx);
      ctx.restore();
      yard(ctx, 0, t);
      if (p > 0.25) {
        cradle(ctx);
        keel(ctx, (p - 0.25) / 0.75);
      }
      // les débris de l'épave, tirés à terre, en tas
      for (let k = 0; k < Math.floor(p * 6); k++) shipPlank(ctx, 175 + (k % 3) * 10, B + 24 + k * 6, 0.3 + k * 0.4, 30);
    }
  } else {
    if (building) yard(ctx, stage, t);
    cradle(ctx);
    keel(ctx, 1);
    if (stage === 1) {
      ribs(ctx);
      if (building) planking(ctx, -L + 2 * L * p);
    } else {
      planking(ctx);
      if (stage >= 3 || (stage === 2 && building)) deck(ctx, stage >= 3 ? L : -L + 2 * L * p);
    }
  }
  ctx.restore();
  // mâts et voiles, debout
  if (stage >= 3) masts(ctx, map, [1, 1, 1], stage >= 4 ? 1 : building ? p : 0, t);
  else if (stage === 2 && building) masts(ctx, map, MASTS.map((_, k) => p * 2.2 - k * 0.45), 0, t);
}

/** Libellé du chantier au-dessus du bateau : l'étape en cours et le temps qu'il reste. */
export function drawBoatLabel(ctx: Ctx, map: WorldMap, name: string, left: string) {
  const c = map.boatPoint(0, 0);
  ctx.font = '700 15px "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  const y = c.y - 215;
  ctx.strokeText(`Chantier · ${name}`, c.x, y);
  ctx.fillStyle = '#F0B64A';
  ctx.fillText(`Chantier · ${name}`, c.x, y);
  ctx.font = '600 13px Outfit, sans-serif';
  ctx.strokeText(left, c.x, y + 17);
  ctx.fillStyle = '#EEE7D7';
  ctx.fillText(left, c.x, y + 17);
}

/**
 * Aubin au travail, le marteau à la main : il le lève lentement et l'abat d'un coup sec, des copeaux volent.
 * Rend vrai à l'image où le marteau frappe (pour le bruit).
 */
export function drawAubinAtWork(ctx: Ctx, x: number, y: number, t: number, lx: number, ly: number, name: string) {
  const cycle = 0.85, ph = (t % cycle) / cycle; // 0 → 0,75 : il lève ; 0,75 → 1 : il frappe
  const ang = ph < 0.75 ? -0.3 - ease(ph / 0.75) * 1.5 : -1.8 + ease((ph - 0.75) / 0.25) * 1.5;
  drawElder(ctx, x, y, t, lx, ly, name);
  const side = lx >= 0 ? 1 : -1, sx = x + side * 10, sy = y - 2;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(side, 1);
  ctx.rotate(ang);
  ctx.fillStyle = '#B7A88F'; // le bras
  ctx.beginPath();
  ctx.ellipse(6, 0, 7, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6B4A33'; // le manche
  ctx.fillRect(10, -2, 20, 4);
  ctx.fillStyle = '#5A6066'; // la tête du marteau
  ctx.fillRect(27, -7, 7, 14);
  ctx.fillStyle = '#9AA3AA';
  ctx.fillRect(27, -7, 7, 3);
  ctx.restore();
  // au moment du coup : des copeaux qui sautent, un « toc »
  const since = ph >= 0.95 ? (ph - 0.95) * cycle : ph < 0.3 ? (ph + 0.05) * cycle : -1;
  if (since >= 0 && since < 0.3) {
    const k = since / 0.3, hx = x + side * 40, hy = y + 4;
    ctx.fillStyle = `rgba(214,176,120,${1 - k})`;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      ctx.fillRect(hx + Math.cos(a) * k * 22, hy + Math.sin(a) * k * 18 + k * k * 14, 3, 2);
    }
    ctx.font = '700 12px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(238,231,215,${1 - k})`;
    ctx.fillText('toc', hx + side * 8, hy - 18 - k * 10);
  }
  return ph >= 0.95;
}
