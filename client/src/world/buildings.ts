// Bâtiments : le village (palissade, portes, pont, place), ses bâtiments (Hôtel de ville, forge, Tanière, marché,
// entrepôt, tableau), le camp avancé et l'école, les pierres de passage, l'épave.

import { BUILDINGS, DEN_OFFSET, FORGE_OFFSET, BOARD_OFFSET, HALL_OFFSET, MARKET_OFFSET, STORE_OFFSET, VILLAGE_R, campName } from '../../../shared/config.ts';
import { hash2 } from '../../../shared/math.ts';
import { atVillageGate, BRIDGE_W, VILLAGE_GATES, villageEdge, type WorldMap } from '../../../shared/worldmap.ts';
import { TAU, rgba } from './outils.ts';
import { PATH_PASSES } from './terrain.ts';

/** 75 → « 1:15 », 3700 → « 1:01:40 ». */
const clockOf = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = String(Math.floor(sec % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
};
// Emprise au sol de chaque bâtiment (décalage depuis le centre du village), pour dessiner son chantier.
type Plot = 'forge' | 'den' | 'market';
const PLOTS: Record<Plot, { x0: number; y0: number; x1: number; y1: number }> = {
  forge: { x0: FORGE_OFFSET.x - 80, y0: FORGE_OFFSET.y - 40, x1: FORGE_OFFSET.x + 62, y1: FORGE_OFFSET.y + 44 },
  den: { x0: DEN_OFFSET.x - 84, y0: DEN_OFFSET.y - 50, x1: DEN_OFFSET.x + 84, y1: DEN_OFFSET.y + 34 },
  market: { x0: MARKET_OFFSET.x - 58, y0: MARKET_OFFSET.y - 12, x1: MARKET_OFFSET.x + 58, y1: MARKET_OFFSET.y + 46 },
};

// ── Échoppe du marché : petits éléments dessinés, en aplats sans contour (comme les autres bâtiments) ──

function stallBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 2) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Cage d'un monstre à vendre (un gluant), posée sur le comptoir. */
function stallCage(ctx: CanvasRenderingContext2D, x: number, y: number) {
  stallBox(ctx, x - 16, y - 24, 32, 24, 'rgba(40,30,20,0.35)', 3);
  ctx.fillStyle = '#7FCB5B';
  ctx.beginPath();
  ctx.ellipse(x, y - 7, 9, 7, 0, Math.PI, 0);
  ctx.lineTo(x + 9, y - 2);
  ctx.lineTo(x - 9, y - 2);
  ctx.fill();
  ctx.fillStyle = '#10181A';
  ctx.beginPath();
  ctx.arc(x - 3, y - 8, 1.4, 0, TAU);
  ctx.arc(x + 3, y - 8, 1.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3A2819';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let k = -12; k <= 12; k += 6) {
    ctx.moveTo(x + k, y - 24);
    ctx.lineTo(x + k, y);
  }
  ctx.stroke();
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x - 18, y - 27, 36, 4);
  ctx.strokeStyle = '#C9A24A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y - 30, 4, Math.PI, 0);
  ctx.stroke();
}

/** Panier d'essences lumineuses. */
function stallEssences(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(180,140,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y - 8, 14, 9, 0, 0, TAU);
  ctx.fill();
  for (const [ox, oy, c] of [[-6, -9, '#B48CFF'], [1, -12, '#E2D3FF'], [7, -8, '#9C70F0'], [-1, -6, '#C9A8FF']] as const) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, 3.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#B98B5A';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 7);
  ctx.lineTo(x + 12, y - 7);
  ctx.lineTo(x + 9, y + 1);
  ctx.lineTo(x - 9, y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,30,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 10, y - 3);
  ctx.lineTo(x + 10, y - 3);
  ctx.stroke();
}

/** Petite pile de pièces d'or. */
function stallCoins(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#F0B64A';
  ctx.strokeStyle = '#7A5418';
  ctx.lineWidth = 1;
  for (const [ox, oy] of [[0, 0], [5, -2], [2, -4], [-4, -1]]) {
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, 3.5, 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

/** Lanterne suspendue, avec son halo. */
function stallLantern(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = '#3A2819';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,200,100,0.25)';
  ctx.beginPath();
  ctx.arc(x, y + 6, 9, 0, TAU);
  ctx.fill();
  stallBox(ctx, x - 3.5, y, 7, 10, '#F7C766', 2);
}

// ── Épave coupée en deux (bout de l'île) : poupe à gauche, proue à droite, en coordonnées locales ──
export const SHIP_WOOD = '#6B4A33', SHIP_DARK = '#4A3322', SHIP_LIGHT = '#8A6446', SHIP_DECK = '#9A7448', SHIP_HOLE = '#24180F';

export function shipPlank(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, l: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.fillRect(-l / 2 + 2, -2, l, 7);
  ctx.fillStyle = SHIP_LIGHT;
  ctx.fillRect(-l / 2, -4, l, 6);
  ctx.restore();
}

export function shipBarrel(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 5, 10, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7A5A3A';
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 11, 0.3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4A4E52';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 11, 0.3, -0.9, 0.9);
  ctx.stroke();
}

/**
 * Épave coupée en deux, un peu délabrée : la poupe et la proue séparées par une bande de sable, membrures à nu aux
 * cassures, beaupré cassé ; entre les deux, des planches et un tonneau ; à côté, un bout de mât et sa voile déchirée.
 */
/**
 * Pont de bois entre l'île et l'îlot du village (coordonnées du monde) : son ombre sur l'eau, les pieux qui plongent,
 * des planches en travers, un peu irrégulières (une plus sombre, une décalée), et un garde-corps de chaque côté.
 * Cassé (au début) : il ne reste que des bouts de tablier aux deux rives, des pieux penchés ou brisés au milieu, une corde
 * qui pend, et des planches qui flottent au fil de l'eau.
 */
export function drawBridge(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, seed: number, built: boolean, t: number) {
  const l = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x), half = BRIDGE_W / 2;
  const kept = (x: number) => built || x < l * 0.2 || x > l * 0.82 || (x > l * 0.46 && x < l * 0.52); // planches restées en place
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(ang);
  // ombre portée sur l'eau, là où il y a un tablier
  ctx.fillStyle = 'rgba(10,30,40,0.35)';
  if (built) ctx.fillRect(4, -half + 8, l, BRIDGE_W);
  else {
    ctx.fillRect(4, -half + 8, l * 0.2, BRIDGE_W);
    ctx.fillRect(l * 0.82 + 4, -half + 8, l * 0.18, BRIDGE_W);
  }
  // pieux, et remous autour ; cassé : certains penchent, d'autres sont brisés au ras de l'eau
  for (let x = 30, k = 0; x < l - 10; x += 70, k++) {
    for (const s of [-1, 1]) {
      const h = hash2(k, s, seed + 83), broken = !built && x > l * 0.2 && x < l * 0.82 && h < 0.45;
      const ripple = (Math.sin(t * 2 + k + s) + 1) * 0.5;
      ctx.strokeStyle = `rgba(226,240,236,${0.3 + ripple * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, s * (half - 3) + 10, 9 + ripple * 3, 3.5 + ripple, 0, 0, TAU);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, s * (half - 3) + 10);
      if (!built && !broken && x > l * 0.2 && x < l * 0.82) ctx.rotate((h - 0.5) * 0.7); // il penche
      ctx.fillStyle = '#3E2A1C';
      ctx.fillRect(-4, broken ? -5 : -12, 8, broken ? 5 : 12);
      if (broken) {
        ctx.fillStyle = '#6B4A33'; // l'éclat du bois cassé
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(-1, -9);
        ctx.lineTo(2, -6);
        ctx.lineTo(4, -8);
        ctx.lineTo(4, -5);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // longerons (seulement sous le tablier qui reste), puis planches en travers
  ctx.fillStyle = '#4A3322';
  if (built) ctx.fillRect(-6, -half + 2, l + 12, BRIDGE_W - 4);
  else {
    ctx.fillRect(-6, -half + 2, l * 0.2 + 6, BRIDGE_W - 4);
    ctx.fillRect(l * 0.82, -half + 2, l * 0.18 + 6, BRIDGE_W - 4);
    ctx.fillRect(l * 0.2, -half + 4, l * 0.1, 6); // un longeron qui dépasse dans le vide
  }
  for (let x = -4, k = 0; x < l + 4; x += 12, k++) {
    if (!kept(x)) continue;
    const h = hash2(k, 7, seed + 81), w = 10 + h * 1.5, dy = (hash2(k, 9, seed + 82) - 0.5) * 3;
    const loose = !built && x > l * 0.4 && x < l * 0.6; // une planche seule au milieu, de travers sur un pieu
    ctx.save();
    if (loose) {
      ctx.translate(x, 0);
      ctx.rotate(0.5);
      ctx.translate(-x, 0);
    }
    ctx.fillStyle = h < 0.15 || !built ? '#6B4A33' : h < 0.6 ? '#8B6A47' : '#9C7A52';
    ctx.fillRect(x, -half + 3 + dy, w, BRIDGE_W - 6);
    ctx.fillStyle = 'rgba(255,230,190,0.12)';
    ctx.fillRect(x, -half + 3 + dy, w, 2);
    ctx.fillStyle = 'rgba(20,12,8,0.35)';
    ctx.fillRect(x + w - 1, -half + 3 + dy, 1, BRIDGE_W - 6);
    ctx.restore();
  }
  if (!built) {
    // planches qui flottent et dérivent doucement à côté
    for (let k = 0; k < 5; k++) {
      const fx = l * (0.28 + hash2(k, 3, seed + 84) * 0.5) + Math.sin(t * 0.6 + k) * 6, fy = (k % 2 ? 1 : -1) * (half + 16 + hash2(k, 4, seed + 84) * 40);
      ctx.save();
      ctx.translate(fx, fy + Math.sin(t * 1.3 + k * 2) * 2);
      ctx.rotate(hash2(k, 5, seed + 84) * Math.PI);
      ctx.fillStyle = 'rgba(10,30,40,0.3)';
      ctx.fillRect(-15, -3, 32, 9);
      ctx.fillStyle = '#7A5A3A';
      ctx.fillRect(-16, -5, 32, 9);
      ctx.restore();
    }
  }
  // garde-corps : une main courante et ses poteaux de chaque côté ; cassé, une corde qui pend dans le vide d'un côté
  for (const s of [-1, 1]) {
    const y = s * (half - 2);
    const spans: [number, number][] = built ? [[-4, l + 4]] : [[-4, l * 0.2], [l * 0.82, l + 4]];
    for (const [x0, x1] of spans) {
      ctx.strokeStyle = '#3E2A1C';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.strokeStyle = '#7A5A3A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y - 1);
      ctx.lineTo(x1, y - 1);
      ctx.stroke();
      for (let x = Math.ceil(x0 / 35) * 35; x <= x1; x += 35) {
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }
    if (!built && s < 0) {
      ctx.strokeStyle = '#B8A27A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(l * 0.2, y);
      ctx.quadraticCurveTo(l * 0.5, y + 34 + Math.sin(t * 1.2) * 3, l * 0.82, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawShipwreck(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(8,14,12,0.28)';
  ctx.beginPath();
  ctx.ellipse(8, 14, 140, 32, 0, 0, TAU);
  ctx.fill();
  // poupe, cassée à droite
  ctx.save();
  ctx.translate(-55, 0);
  ctx.rotate(0.08);
  ctx.beginPath();
  ctx.moveTo(-70, -26);
  ctx.quadraticCurveTo(-10, -36, 40, -30);
  ctx.lineTo(34, -18);
  ctx.lineTo(44, -8);
  ctx.lineTo(36, 4);
  ctx.lineTo(46, 14);
  ctx.lineTo(38, 30);
  ctx.quadraticCurveTo(-10, 36, -70, 26);
  ctx.quadraticCurveTo(-78, 0, -70, -26);
  ctx.closePath();
  ctx.fillStyle = SHIP_WOOD;
  ctx.fill();
  ctx.fillStyle = SHIP_DECK;
  ctx.fillRect(-60, -20, 86, 38);
  ctx.strokeStyle = 'rgba(74,51,34,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = -48; k < 26; k += 12) {
    ctx.moveTo(k, -20);
    ctx.lineTo(k, 18);
  }
  ctx.stroke();
  ctx.fillStyle = SHIP_LIGHT; // château arrière
  ctx.fillRect(-64, -18, 26, 34);
  ctx.fillStyle = SHIP_DARK;
  ctx.fillRect(-60, -14, 18, 26);
  ctx.fillStyle = SHIP_HOLE; // la cale, ouverte à la cassure
  ctx.fillRect(10, -16, 22, 30);
  ctx.strokeStyle = SHIP_LIGHT; // membrures à nu
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const k of [-12, -2, 8]) {
    ctx.moveTo(14, k - 10);
    ctx.quadraticCurveTo(28, k, 14, k + 10);
  }
  ctx.stroke();
  ctx.restore();
  // proue, cassée à gauche, un peu tournée
  ctx.save();
  ctx.translate(80, 6);
  ctx.rotate(-0.22);
  ctx.beginPath();
  ctx.moveTo(-36, -28);
  ctx.quadraticCurveTo(20, -32, 64, 0);
  ctx.quadraticCurveTo(20, 32, -36, 28);
  ctx.lineTo(-30, 16);
  ctx.lineTo(-40, 6);
  ctx.lineTo(-32, -6);
  ctx.lineTo(-42, -16);
  ctx.closePath();
  ctx.fillStyle = SHIP_WOOD;
  ctx.fill();
  ctx.fillStyle = SHIP_DECK;
  ctx.beginPath();
  ctx.moveTo(-28, -20);
  ctx.quadraticCurveTo(16, -22, 50, 0);
  ctx.quadraticCurveTo(16, 22, -28, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = SHIP_HOLE;
  ctx.fillRect(-28, -14, 16, 26);
  ctx.fillStyle = SHIP_LIGHT; // beaupré cassé
  ctx.save();
  ctx.translate(60, 0);
  ctx.rotate(0.1);
  ctx.fillRect(0, -3, 26, 6);
  ctx.restore();
  ctx.restore();
  // entre les deux morceaux : sable amassé, planches, tonneau
  ctx.fillStyle = 'rgba(214,190,138,0.9)';
  ctx.beginPath();
  ctx.ellipse(8, 6, 18, 24, 0, 0, TAU);
  ctx.fill();
  shipPlank(ctx, 4, -10, 1.2, 26);
  shipPlank(ctx, 16, 18, 0.4, 22);
  shipBarrel(ctx, -4, 34);
  // bout de mât couché, voile déchirée
  ctx.save();
  ctx.translate(-70, -40);
  ctx.rotate(-0.25);
  ctx.fillStyle = 'rgba(8,14,12,0.25)';
  ctx.fillRect(6, 5, 70, 6);
  ctx.fillStyle = SHIP_LIGHT;
  ctx.fillRect(0, -4, 70, 8);
  ctx.fillStyle = SHIP_DARK;
  ctx.beginPath();
  ctx.moveTo(70, -4);
  ctx.lineTo(75, -2);
  ctx.lineTo(72, 0);
  ctx.lineTo(76, 3);
  ctx.lineTo(70, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-40, -62);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#D9CCAE';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(38, 4);
  ctx.lineTo(34, 16);
  ctx.lineTo(27, 13);
  ctx.lineTo(23, 23);
  ctx.lineTo(13, 18);
  ctx.lineTo(4, 25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(120,100,70,0.35)';
  ctx.beginPath();
  ctx.ellipse(18, 9, 4.5, 2.7, 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Les bâtiments du village et des camps (images préparées du village et du camp, palissade, dessins à la demande). */
export class Buildings {
  village: HTMLCanvasElement;
  readonly villageSize = (VILLAGE_R * 1.3 + 120) * 2;
  camp: HTMLCanvasElement;
  readonly campSize = 420;
  /** Pieux de la palissade (coordonnées du monde), de hauteur un peu irrégulière ; poteaux des 4 portes. */
  readonly stakes: { x: number; y: number; h: number; next?: { x: number; y: number } }[] = [];
  readonly gatePosts: { x: number; y: number; side: number; s: number }[] = [];

  readonly seed: number;

  constructor(readonly map: WorldMap) {
    this.seed = map.seed;
    const v = map.village;
    const at = (a: number) => ({ x: v.x + Math.cos(a) * villageEdge(a), y: v.y + Math.sin(a) * villageEdge(a) });
    // un pieu tous les 18 px environ le long de la palissade (elle n'est pas ronde : on suit son contour)
    const marks: number[] = [];
    for (let a = 0, prev = at(0); a < TAU; a += 0.002) {
      const p = at(a);
      if (!marks.length || Math.hypot(p.x - prev.x, p.y - prev.y) >= 18) {
        marks.push(a);
        prev = p;
      }
    }
    marks.forEach((a, i) => {
      if (atVillageGate(a)) return;
      // traverse jusqu'au pieu suivant, sauf devant une porte
      const b = marks[(i + 1) % marks.length];
      this.stakes.push({ ...at(a), h: 20 + ((i * 7) % 5) * 1.6, next: atVillageGate(b) ? undefined : at(b) });
    });
    // poteaux de chaque porte, de part et d'autre de son ouverture
    VILLAGE_GATES.forEach((g, side) => {
      for (const s of [-1, 1]) {
        let a = g;
        while (atVillageGate(a) && Math.abs(a - g) < 1) a += s * 0.002;
        this.gatePosts.push({ ...at(a), side: (side + 4) % 4, s });
      }
    });
    this.village = this.drawVillage();
    this.camp = this.drawCamp();
  }

  drawVillage() {
    const size = this.villageSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);

    // Herbe du village : celle du sol (groundColor), qui se fond dans le biome autour de la palissade.

    // Routes : celle de la porte côté plage rejoint le chemin de cailloux ;
    // les trois autres s'estompent doucement dans l'herbe au lieu de s'arrêter net.
    const v = this.map.village;
    const sideOf = (g: { x: number; y: number }) => (Math.round(Math.atan2(g.y - v.y, g.x - v.x) / (Math.PI / 2)) + 4) % 4;
    const linked = [sideOf(this.map.gate)]; // porte où arrive le chemin de la plage
    ctx.lineCap = 'round';
    PATH_PASSES.forEach((pass, k) => {
      for (const side of [0, 1, 2, 3]) {
        const ang = (side * Math.PI) / 2, cx = Math.cos(ang), cy = Math.sin(ang);
        const toGate = linked.includes(side), edge = villageEdge(ang);
        const end = toGate ? edge + 60 : edge + 85;
        const from = k === 2 ? 112 : 0; // la trace claire ne traverse pas la place
        if (toGate) ctx.strokeStyle = rgba(pass);
        else {
          const grad = ctx.createLinearGradient(0, 0, cx * end, cy * end);
          grad.addColorStop(0, rgba(pass));
          grad.addColorStop((edge - 10) / end, rgba(pass));
          grad.addColorStop(1, rgba(pass, 0));
          ctx.strokeStyle = grad;
        }
        ctx.lineWidth = pass[4];
        ctx.lineCap = toGate ? 'butt' : 'round';
        ctx.beginPath();
        ctx.moveTo(cx * from, cy * from);
        ctx.lineTo(cx * end, cy * end);
        ctx.stroke();
      }
      // place centrale, dans le même style
      if (k < 2) {
        ctx.fillStyle = rgba(pass);
        ctx.beginPath();
        ctx.arc(0, 0, k === 0 ? 125 : 120, 0, TAU);
        ctx.fill();
      }
    });
    ctx.strokeStyle = 'rgba(140,124,88,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);


    return c;
  }

  /** Un pieu taillé en pointe (coordonnées du monde), avec sa part de traverse vers le pieu suivant, et son ombre. */
  drawStake(ctx: CanvasRenderingContext2D, k: number) {
    const { x, y, h, next } = this.stakes[k];
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 7, 3, 0, 0, TAU);
    ctx.fill();
    if (next) {
      ctx.strokeStyle = '#4A3322';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(next.x, next.y - 10);
      ctx.stroke();
    }
    ctx.fillStyle = k % 2 ? '#6B4A33' : '#7A5A3A';
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 5, y - h);
    ctx.lineTo(x, y - h - 7);
    ctx.lineTo(x + 5, y - h);
    ctx.lineTo(x + 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.18)';
    ctx.fillRect(x - 5, y - h, 2, h);
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(x + 3, y - h, 2, h);
  }

  /** Le pont, cassé ou réparé ; cassé, son nom au-dessus du pied (le prix : dans le panneau de construction). */
  drawBridge(ctx: CanvasRenderingContext2D, built: boolean, t: number) {
    const { a, b } = this.map.bridge;
    drawBridge(ctx, a, b, this.seed, built, t);
    if (built) return;
    const label = `${BUILDINGS.bridge.name} · cassé`;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, a.x, a.y - 60);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, a.x, a.y - 60);
  }

  /** Palissade pas encore construite : un piquet de repère de loin en loin, et la corde tendue entre eux. */
  drawPalisadePlan(ctx: CanvasRenderingContext2D) {
    const v = this.map.village;
    ctx.strokeStyle = 'rgba(232,220,192,0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, r = villageEdge(a);
      if (i) ctx.lineTo(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r);
      else ctx.moveTo(v.x + r, v.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < this.stakes.length; k += 8) {
      const { x, y } = this.stakes[k];
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(x - 2, y - 14, 4, 16);
      ctx.fillStyle = '#E8DCC0';
      ctx.fillRect(x - 2, y - 14, 4, 4);
    }
    const label = BUILDINGS.palisade.name; // le prix : dans le panneau de construction
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, v.x, v.y - 70);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, v.x, v.y - 70);
  }

  /** Poteau de porte (coordonnées du monde) : plus haut, coiffé d'un fanion ; au nord et au sud, linteau et bannière. */
  drawGatePost(ctx: CanvasRenderingContext2D, k: number, t: number) {
    const { x, y, side, s } = this.gatePosts[k];
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 3, 8, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 5, y - 38, 10, 40);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x - 5, y - 38, 10, 4);
    if (side % 2 === 1 && s === 1) {
      // nord ou sud : linteau d'un poteau à l'autre, bannière au milieu
      const o = this.gatePosts[k - 1];
      ctx.fillStyle = '#4A3322';
      const l = Math.min(x, o.x), r = Math.max(x, o.x);
      ctx.fillRect(l - 7, y - 42, r - l + 14, 6);
      const cx = (x + o.x) / 2, sway = Math.sin(t * 1.6 + side) * 1.5;
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.moveTo(cx - 10, y - 36);
      ctx.lineTo(cx + 10, y - 36);
      ctx.lineTo(cx + 10 + sway, y - 18);
      ctx.lineTo(cx + sway, y - 23);
      ctx.lineTo(cx - 10 + sway, y - 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#EFE3C4';
      ctx.beginPath();
      ctx.arc(cx + sway * 0.5, y - 29, 2.5, 0, TAU);
      ctx.fill();
    } else if (side % 2 === 0) {
      // est ou ouest : un fanion sur chaque poteau
      const sway = Math.sin(t * 2 + k) * 2;
      ctx.fillStyle = '#3A2A1E';
      ctx.fillRect(x - 1, y - 52, 2, 14);
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 52);
      ctx.lineTo(x + 13, y - 48 + sway);
      ctx.lineTo(x + 1, y - 44);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Panneau du village (coordonnées du village) : planche sur deux poteaux, couverte de petites affiches. */
  drawBoard(ctx: CanvasRenderingContext2D) {
    const x = BOARD_OFFSET.x, y = BOARD_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, 26, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 20, y - 34, 5, 38);
    ctx.fillRect(x + 15, y - 34, 5, 38);
    // planche et son cadre
    ctx.fillStyle = '#4A3322';
    ctx.fillRect(x - 25, y - 44, 50, 30);
    ctx.fillStyle = '#9A7448';
    ctx.fillRect(x - 22, y - 41, 44, 24);
    // affiches épinglées
    const notes: [number, number, number, number, string][] = [[-18, -38, 13, 15, '#EFE3C4'], [-2, -39, 11, 9, '#E9D6A8'], [11, -37, 9, 13, '#F2E8CF'], [-1, -28, 12, 9, '#E4CFA0']];
    for (const [nx, ny, w, h, c] of notes) {
      ctx.fillStyle = c;
      ctx.fillRect(x + nx, y + ny, w, h);
      ctx.fillStyle = 'rgba(90,70,50,0.55)';
      for (let l = 3; l < h - 2; l += 3) ctx.fillRect(x + nx + 2, y + ny + l, w - 4, 1);
      ctx.fillStyle = '#B8432E';
      ctx.beginPath();
      ctx.arc(x + nx + w / 2, y + ny + 1.5, 1.4, 0, TAU);
      ctx.fill();
    }
    // petit toit
    ctx.fillStyle = '#6B4A33';
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 43);
    ctx.lineTo(x, y - 54);
    ctx.lineTo(x + 30, y - 43);
    ctx.closePath();
    ctx.fill();
  }

  /** Entrepôt (coordonnées du village) : sous son auvent, rondins et tas de pierres, qui grossissent avec la réserve. */
  drawStore(ctx: CanvasRenderingContext2D, stock: [number, number]) {
    const x = STORE_OFFSET.x, y = STORE_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(x - 38, y + 8, 80, 12);
    // auvent sur poteaux
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 38, y - 34, 5, 46);
    ctx.fillRect(x + 33, y - 34, 5, 46);
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x - 44, y - 40, 88, 9);
    // rondins empilés (plus ou moins selon le bois en réserve)
    const logs = Math.min(6, Math.ceil(stock[0] / 40));
    for (let i = 0; i < logs; i++) {
      const lx = x - 30 + (i % 3) * 13 + (i >= 3 ? 6 : 0), ly = y + 4 - (i >= 3 ? 11 : 0);
      ctx.fillStyle = '#6B4A33';
      ctx.beginPath();
      ctx.arc(lx, ly, 6, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#C9A27A';
      ctx.beginPath();
      ctx.arc(lx, ly, 3.2, 0, TAU);
      ctx.fill();
    }
    // tas de pierres
    const stones = Math.min(6, Math.ceil(stock[1] / 40));
    for (let i = 0; i < stones; i++) {
      ctx.fillStyle = i % 2 ? '#7C8681' : '#5E6763';
      ctx.beginPath();
      ctx.ellipse(x + 12 + (i % 3) * 8, y + 6 - Math.floor(i / 3) * 7, 6, 4.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = `Entrepôt · ${stock[0]} bois · ${stock[1]} pierre`;
    ctx.strokeText(label, x, y - 50);
    ctx.fillStyle = '#D2A06A';
    ctx.fillText(label, x, y - 50);
  }

  /**
   * Hôtel de ville (coordonnées du village) : en ruine au niveau 0, puis de plus en plus belle.
   * Un fanion par niveau sur le toit, une cheminée qui fume à partir du niveau 3.
   */
  drawHall(ctx: CanvasRenderingContext2D, lvl: number, t: number) {
    const x = HALL_OFFSET.x, y = HALL_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.fillRect(x - 50, y + 8, 110, 46);
    ctx.fillStyle = lvl >= 4 ? '#6B4A33' : '#5B3F2C';
    ctx.fillRect(x - 52, y - 10, 104, 56);
    if (lvl >= 2) {
      // colombages
      ctx.strokeStyle = '#3A2819';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 50, y - 8, 100, 52);
      ctx.beginPath();
      ctx.moveTo(x - 50, y + 12);
      ctx.lineTo(x + 50, y + 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#3A2819';
    ctx.fillRect(x - 10, y + 18, 20, 28);
    if (lvl >= 1) {
      // fenêtres éclairées
      ctx.fillStyle = '#F0B64A';
      ctx.fillRect(x - 38, y + 18, 14, 12);
      ctx.fillRect(x + 24, y + 18, 14, 12);
    }
    if (lvl >= 3) {
      // cheminée et sa fumée
      ctx.fillStyle = '#5E6763';
      ctx.fillRect(x + 26, y - 50, 12, 30);
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        ctx.fillStyle = `rgba(200,205,200,${0.4 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(x + 32 + k * 14, y - 56 - k * 40, 5 + k * 8, 0, TAU);
        ctx.fill();
      }
    }
    const roof = ['#6B5A44', '#8A4B32', '#9C5236', '#A85A3A', '#3F6E8A', '#4F7FA0', '#B8863A'][Math.min(lvl, 6)];
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 64, y - 4);
    ctx.lineTo(x, y - 56);
    ctx.lineTo(x + 64, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.25)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 64 + i * 16, y - 4 - i * 13);
      ctx.lineTo(x + 64 - i * 16, y - 4 - i * 13);
      ctx.stroke();
    }
    if (lvl === 0) {
      // toit éventré et planches en attente : il faut la remettre en état
      ctx.fillStyle = '#2A1F17';
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 40);
      ctx.lineTo(x + 26, y - 22);
      ctx.lineTo(x + 8, y - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7A5A3A';
      ctx.fillRect(x - 70, y + 40, 40, 6);
      ctx.fillRect(x - 66, y + 47, 40, 6);
    }
    // un fanion par niveau le long du toit
    for (let i = 0; i < lvl; i++) {
      const fx = x - 48 + i * 19, fy = y - 8 - (1 - Math.abs(i * 19 - 48) / 64) * 46;
      const wave = Math.sin(t * 3 + i) * 2;
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(fx - 1, fy - 18, 2, 18);
      ctx.fillStyle = i % 2 ? '#5CC8B8' : '#F0B64A';
      ctx.beginPath();
      ctx.moveTo(fx + 1, fy - 18);
      ctx.lineTo(fx + 12, fy - 14 + wave);
      ctx.lineTo(fx + 1, fy - 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = lvl ? `Hôtel de ville · niv. ${lvl}` : 'Hôtel de ville · en ruine';
    ctx.strokeText(label, x, y - 74);
    ctx.fillStyle = '#F0B64A';
    ctx.fillText(label, x, y - 74);
  }

  /** Panneau à la lisière d'une brume, au-dessus de tout : la zone, et ce qui manque pour la lever. */
  drawGateLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, sub: string) {
    const c = { x, y: y + 60 };
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, c.x, c.y - 74);
    ctx.fillStyle = '#EEE7D7';
    ctx.fillText(label, c.x, c.y - 74);
    if (!sub) return;
    ctx.font = '600 13px Outfit, sans-serif';
    ctx.strokeText(sub, c.x, c.y - 56);
    ctx.fillStyle = '#FF9B78';
    ctx.fillText(sub, c.x, c.y - 56);
  }

  /** Bâtiment construit, ou son chantier (piquets, corde et prix) : dessiné en coordonnées du village (ctx centré dessus). */
  drawBuilding(ctx: CanvasRenderingContext2D, b: Plot, built: boolean, hall: number, cleared = true, grand = false) {
    if (!cleared) return this.drawWildPlot(ctx, b);
    if (!built) return this.drawPlot(ctx, b, hall);
    if (b === 'forge') this.drawForge(ctx, grand);
    else if (b === 'den') this.drawDen(ctx);
    else this.drawMarket(ctx);
  }

  /** Emplacement pas encore défriché : broussailles, souches et cailloux, et ce que coûte le défrichage. */
  private drawWildPlot(ctx: CanvasRenderingContext2D, b: Plot) {
    const { x0, y0, x1, y1 } = PLOTS[b], w = x1 - x0, h = y1 - y0;
    for (let k = 0; k < 14; k++) {
      const px = x0 + hash2(k, 1, this.seed + b.length) * w, py = y0 + hash2(k, 2, this.seed + b.length) * h, v = hash2(k, 3, this.seed);
      if (v < 0.45) {
        // touffe de broussailles
        for (const [dx, dy, r, c] of [[-6, 0, 9, '#2E4A2C'], [6, 0, 9, '#2E4A2C'], [0, -6, 10, '#3C6236']] as const) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(px + dx, py + dy, r, 0, TAU);
          ctx.fill();
        }
      } else if (v < 0.7) {
        ctx.fillStyle = '#6E726C'; // caillou
        ctx.beginPath();
        ctx.ellipse(px, py, 8, 6, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.ellipse(px - 2, py - 2, 4, 2.5, 0, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = '#5B3F2C'; // souche
        ctx.beginPath();
        ctx.ellipse(px, py, 8, 5, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#9C7A52';
        ctx.beginPath();
        ctx.ellipse(px, py - 2, 6, 3.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    const p = `plot_${b}` as const;
    const label = BUILDINGS[p].name;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, (x0 + x1) / 2, y0 - 22);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, (x0 + x1) / 2, y0 - 22);
  }

  private drawPlot(ctx: CanvasRenderingContext2D, b: Plot, hall: number) {
    const { x0, y0, x1, y1 } = PLOTS[b];
    ctx.fillStyle = 'rgba(110,97,66,0.55)'; // terre retournée
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // corde tendue entre les piquets
    ctx.strokeStyle = '#C9B48A';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]]) {
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(px - 2, py - 14, 4, 18);
      ctx.fillStyle = '#E8DCC0';
      ctx.fillRect(px - 2, py - 14, 4, 4);
    }
    // quelques planches et pierres en attente
    ctx.fillStyle = '#7A5A3A';
    ctx.fillRect(x0 + 14, y1 - 22, 46, 7);
    ctx.fillRect(x0 + 18, y1 - 14, 46, 7);
    ctx.fillStyle = '#6E726C';
    ctx.beginPath();
    ctx.ellipse(x1 - 26, y1 - 16, 10, 7, 0, 0, TAU);
    ctx.fill();
    const need = BUILDINGS[b].hall; // pas encore constructible : le nom en grisé
    const label = BUILDINGS[b].name; // le prix et le niveau d'Hôtel de ville requis : dans le panneau de construction
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, (x0 + x1) / 2, y0 - 22);
    ctx.fillStyle = hall < need ? '#A9B3A6' : '#C9CFC2';
    ctx.fillText(label, (x0 + x1) / 2, y0 - 22);
  }

  /**
   * Tanière : loge de rondins (même style que l'Hôtel de ville et la forge), toit d'ardoise violette,
   * cornes croisées aux pignons, grande porte en arche griffée, blason à la patte et fanion violet.
   */
  private drawDen(ctx: CanvasRenderingContext2D) {
    const x = DEN_OFFSET.x, y = DEN_OFFSET.y;
    // ombre portée, comme les autres bâtiments
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.fillRect(x - 66, y + 14, 146, 24);
    // murs en rondins empilés
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x - 72, y - 14, 144, 46);
    ctx.strokeStyle = 'rgba(16,24,26,0.3)';
    ctx.lineWidth = 2;
    for (let ly = y - 4; ly < y + 32; ly += 9) {
      ctx.beginPath();
      ctx.moveTo(x - 72, ly);
      ctx.lineTo(x + 72, ly);
      ctx.stroke();
    }
    // bouts de rondins aux angles
    ctx.fillStyle = '#7A5A3A';
    for (const sx of [-74, 74]) {
      for (let ly = y - 10; ly < y + 32; ly += 9) {
        ctx.beginPath();
        ctx.arc(x + sx, ly, 4.5, 0, TAU);
        ctx.fill();
      }
    }
    // toit en croupe, ardoise violette, rangs de bardeaux
    ctx.fillStyle = '#4E3F7A';
    ctx.beginPath();
    ctx.moveTo(x - 86, y - 8);
    ctx.lineTo(x - 54, y - 56);
    ctx.lineTo(x + 54, y - 56);
    ctx.lineTo(x + 86, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.28)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const ry = y - 8 - i * 12, inset = i * 8;
      ctx.beginPath();
      ctx.moveTo(x - 86 + inset, ry);
      ctx.lineTo(x + 86 - inset, ry);
      ctx.stroke();
    }
    ctx.fillStyle = '#6A579E';
    ctx.fillRect(x - 56, y - 60, 112, 6); // faîtage
    // cornes croisées aux deux pignons
    for (const sx of [-1, 1]) {
      const hx = x + sx * 56, hy = y - 58;
      ctx.strokeStyle = '#E9DFC8';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + sx * 6, hy - 16, hx + sx * 16, hy - 20);
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx - sx * 4, hy - 14, hx - sx * 2, hy - 24);
      ctx.stroke();
    }
    // grande porte en arche, sombre, encadrée de rideaux violets et griffée
    ctx.fillStyle = '#3A2819';
    ctx.beginPath();
    ctx.moveTo(x - 24, y + 32);
    ctx.lineTo(x - 24, y + 2);
    ctx.arc(x, y + 2, 24, Math.PI, 0);
    ctx.lineTo(x + 24, y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10181A';
    ctx.beginPath();
    ctx.moveTo(x - 19, y + 32);
    ctx.lineTo(x - 19, y + 4);
    ctx.arc(x, y + 4, 19, Math.PI, 0);
    ctx.lineTo(x + 19, y + 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7D68B8';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 19, y - 12);
      ctx.quadraticCurveTo(x + sx * 9, y + 6, x + sx * 14, y + 32);
      ctx.lineTo(x + sx * 19, y + 32);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(233,223,200,0.55)'; // griffures sur le linteau
    ctx.lineWidth = 1.5;
    for (const k of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(x - 40 + k, y - 8);
      ctx.lineTo(x - 34 + k, y + 8);
      ctx.stroke();
    }
    // blason à la patte, au-dessus de la porte
    ctx.fillStyle = '#7A5A3A';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 30);
    ctx.lineTo(x + 12, y - 30);
    ctx.lineTo(x + 12, y - 18);
    ctx.quadraticCurveTo(x, y - 8, x - 12, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#B48CFF';
    ctx.beginPath();
    ctx.ellipse(x, y - 19, 4, 3.5, 0, 0, TAU);
    for (const [px, py] of [[-5, -25], [-1.7, -27], [1.7, -27], [5, -25]]) {
      ctx.moveTo(x + px + 1.8, y + py);
      ctx.arc(x + px, y + py, 1.8, 0, TAU);
    }
    ctx.fill();
    // fanion violet
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(x + 78, y - 70, 5, 100);
    ctx.fillStyle = '#B48CFF';
    ctx.beginPath();
    ctx.moveTo(x + 83, y - 68);
    ctx.lineTo(x + 112, y - 58);
    ctx.lineTo(x + 83, y - 46);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#B48CFF';
    ctx.fillText('Tanière', x, y - 86);
  }

  /** grand : la Grande forge (cheminée de pierre, braises plus vives, bannière dorée). */
  private drawForge(ctx: CanvasRenderingContext2D, grand = false) {
    const fx = FORGE_OFFSET.x, fy = FORGE_OFFSET.y;
    if (grand) {
      // cheminée de pierre au-dessus du toit, avec ses braises
      ctx.fillStyle = '#6E7570';
      ctx.fillRect(fx - 20, fy - 66, 18, 30);
      ctx.fillStyle = '#5A5F66';
      ctx.fillRect(fx - 23, fy - 70, 24, 6);
      ctx.fillStyle = 'rgba(232,105,63,0.8)';
      ctx.fillRect(fx - 16, fy - 74, 10, 4);
    }
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(fx - 66, fy + 40, 76, 10);
    ctx.fillStyle = '#4B4F55';
    ctx.fillRect(fx - 74, fy - 40, 76, 80);
    ctx.fillStyle = '#3C3F44';
    ctx.fillRect(fx - 74, fy - 40, 76, 14);
    ctx.fillStyle = '#E8693F';
    ctx.fillRect(fx - 56, fy - 10, 40, 22);
    ctx.fillStyle = grand ? '#FFE08A' : '#F0B64A';
    ctx.fillRect(fx - 48, fy - 2, 24, 10);
    if (grand) {
      // bannière dorée sur la façade
      ctx.fillStyle = '#F0B64A';
      ctx.beginPath();
      ctx.moveTo(fx - 68, fy - 24);
      ctx.lineTo(fx - 60, fy - 24);
      ctx.lineTo(fx - 60, fy - 2);
      ctx.lineTo(fx - 64, fy - 6);
      ctx.lineTo(fx - 68, fy - 2);
      ctx.closePath();
      ctx.fill();
    }
    // enclume
    ctx.fillStyle = '#2D3035';
    ctx.fillRect(fx + 22, fy + 22, 16, 18);
    ctx.fillStyle = '#5A5F66';
    ctx.beginPath();
    ctx.moveTo(fx + 6, fy + 10);
    ctx.lineTo(fx + 58, fy + 10);
    ctx.lineTo(fx + 48, fy + 24);
    ctx.lineTo(fx + 14, fy + 24);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F0B64A';
    ctx.fillText(grand ? 'Grande armurerie' : 'Armurerie', fx - 36, grand ? fy - 78 : fy - 50);
  }

  /**
   * Marché : une échoppe sous un auvent rayé en pente (bord festonné), comptoir en planches, deux lanternes ;
   * sur le comptoir, un panier d'essences, des pièces d'or et la cage d'un monstre à vendre.
   */
  private drawMarket(ctx: CanvasRenderingContext2D) {
    const mx = MARKET_OFFSET.x, my = MARKET_OFFSET.y;
    ctx.fillStyle = 'rgba(8,14,12,0.28)';
    ctx.beginPath();
    ctx.ellipse(mx + 4, my + 40, 66, 10, 0, 0, TAU);
    ctx.fill();
    // poteaux, comptoir en planches et son plateau
    stallBox(ctx, mx - 54, my - 36, 7, 76, '#5B3F2C', 1);
    stallBox(ctx, mx + 47, my - 36, 7, 76, '#5B3F2C', 1);
    stallBox(ctx, mx - 58, my + 8, 116, 32, '#7A5A3A', 3);
    ctx.strokeStyle = 'rgba(40,26,14,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const k of [-30, 0, 30]) {
      ctx.moveTo(mx + k, my + 16);
      ctx.lineTo(mx + k, my + 40);
    }
    ctx.stroke();
    stallBox(ctx, mx - 60, my + 6, 120, 8, '#A9845A', 2);
    // marchandises
    stallEssences(ctx, mx - 32, my + 7);
    stallCoins(ctx, mx - 8, my + 4);
    stallCage(ctx, mx + 26, my + 7);
    // auvent : bandes teal et crème en pente, bord festonné, ombre portée sur l'échoppe
    ctx.fillStyle = 'rgba(8,14,12,0.25)';
    ctx.fillRect(mx - 54, my - 22, 108, 8);
    const n = 7, w = 132 / n;
    for (let k = 0; k < n; k++) {
      const x0 = mx - 66 + k * w;
      ctx.fillStyle = k % 2 ? '#EEE7D7' : '#4FB8A9';
      ctx.beginPath();
      ctx.moveTo(x0 + 4, my - 46);
      ctx.lineTo(x0 + w + 4, my - 46);
      ctx.lineTo(x0 + w, my - 24);
      ctx.quadraticCurveTo(x0 + w / 2, my - 14, x0, my - 24);
      ctx.closePath();
      ctx.fill();
    }
    stallBox(ctx, mx - 64, my - 50, 136, 6, '#2F7F75', 2);
    stallLantern(ctx, mx - 44, my - 18);
    stallLantern(ctx, mx + 44, my - 18);
    // une caisse au pied du comptoir
    stallBox(ctx, mx - 73, my + 28, 14, 14, '#9C7A52', 2);
    ctx.strokeStyle = 'rgba(60,40,24,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(mx - 71, my + 30);
    ctx.lineTo(mx - 61, my + 40);
    ctx.moveTo(mx - 73, my + 35);
    ctx.lineTo(mx - 59, my + 35);
    ctx.stroke();
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5CC8B8';
    ctx.fillText('Marché', mx, my - 60);
  }

  /** Plage d'arrivée : épave, planches, caisses, et panneau qui indique le village. */
  drawCamp() {
    const size = this.campSize;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.translate(size / 2, size / 2);
    // Plage d'arrivée : une barque échouée, des planches et des caisses rejetées par la mer.
    const { boat, out, planks } = this.map.wreck;
    for (const pl of planks) {
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(pl.a);
      ctx.fillStyle = 'rgba(8,14,12,0.25)';
      ctx.fillRect(-pl.l / 2 + 2, -3, pl.l, 8);
      ctx.fillStyle = '#8A6A45';
      ctx.fillRect(-pl.l / 2, -4, pl.l, 7);
      ctx.fillStyle = 'rgba(255,240,210,0.18)';
      ctx.fillRect(-pl.l / 2, -4, pl.l, 2);
      ctx.fillStyle = '#3A2A1E'; // clous
      ctx.fillRect(-pl.l / 2 + 3, -1, 2, 2);
      ctx.fillRect(pl.l / 2 - 5, -1, 2, 2);
      ctx.restore();
    }
    // barque retournée à moitié, coque fendue
    ctx.save();
    ctx.translate(boat.x, boat.y);
    ctx.rotate(out + Math.PI / 2 + 0.3);
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 50, 20, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6B4A33';
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.quadraticCurveTo(-30, -22, 0, -22);
    ctx.quadraticCurveTo(34, -22, 48, -4);
    ctx.quadraticCurveTo(34, 18, 0, 18);
    ctx.quadraticCurveTo(-30, 18, -48, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4A3322';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const k of [-10, 0, 10]) {
      ctx.moveTo(-40, k);
      ctx.quadraticCurveTo(0, k - 4, 42, k * 0.8);
    }
    ctx.stroke();
    ctx.fillStyle = '#2A1F17'; // trou dans la coque
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.lineTo(24, -4);
    ctx.lineTo(16, 8);
    ctx.lineTo(6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // caisse et tonneau
    const cx = -Math.cos(out) * 60 + Math.sin(out) * 80, cy = -Math.sin(out) * 60 - Math.cos(out) * 80;
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.fillRect(cx - 14, cy + 4, 32, 10);
    ctx.fillStyle = '#9A7448';
    ctx.fillRect(cx - 16, cy - 16, 30, 26);
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cx - 16, cy - 16, 30, 26);
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy - 16);
    ctx.lineTo(cx + 14, cy + 10);
    ctx.stroke();
    ctx.fillStyle = '#7A5A3A';
    ctx.beginPath();
    ctx.ellipse(cx + 30, cy + 2, 11, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4A4E52';
    ctx.beginPath();
    ctx.moveTo(cx + 19, cy - 4);
    ctx.lineTo(cx + 41, cy - 4);
    ctx.moveTo(cx + 19, cy + 8);
    ctx.lineTo(cx + 41, cy + 8);
    ctx.stroke();
    // panneau orienté vers le village
    const ang = Math.atan2(this.map.village.y - this.map.spawn.y, this.map.village.x - this.map.spawn.x);
    const sx = Math.cos(ang) * 70, sy = Math.sin(ang) * 70 + 10;
    ctx.fillStyle = '#5B3F2C';
    ctx.fillRect(sx - 3, sy - 30, 6, 40);
    ctx.save();
    ctx.translate(sx, sy - 34);
    ctx.rotate(ang); // la flèche pointe exactement vers le village
    ctx.fillStyle = '#8A6A45';
    ctx.beginPath();
    ctx.moveTo(-34, -10);
    ctx.lineTo(24, -10);
    ctx.lineTo(36, 0);
    ctx.lineTo(24, 10);
    ctx.lineTo(-34, 10);
    ctx.closePath();
    ctx.fill();
    if (Math.cos(ang) < 0) ctx.rotate(Math.PI); // texte jamais à l'envers
    ctx.fillStyle = '#EEE7D7';
    ctx.font = '700 12px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Village', 0, 4);
    ctx.restore();
    // titre du côté opposé au panneau
    const ty = Math.sin(ang) < -0.3 ? 120 : -92;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F0B64A';
    ctx.fillText('Plage du naufrage', 0, ty);
    return c;
  }

  /** Feu de camp animé au centre du village. */
  /** Emplacement de camp : cercle de pierres froid et piquets ; une fois établi, tentes, fanion et feu allumé. */
  drawSite(ctx: CanvasRenderingContext2D, i: number, established: boolean, t: number) {
    const { x, y } = this.map.sites[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(110,97,66,0.55)'; // terre battue
    ctx.beginPath();
    ctx.ellipse(0, 10, 150, 110, 0, 0, TAU);
    ctx.fill();
    if (established) {
      const lay = this.map.siteLayout[i];
      for (const [k, { x: tx, y: ty }] of lay.tents.entries()) {
        const col = k ? '#A8743F' : '#7F6A48';
        ctx.fillStyle = 'rgba(8,14,12,0.3)';
        ctx.beginPath();
        ctx.ellipse(tx + 6, ty + 30, 40, 11, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(tx - 38, ty + 28);
        ctx.lineTo(tx, ty - 26);
        ctx.lineTo(tx + 38, ty + 28);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#2A1F17';
        ctx.beginPath();
        ctx.moveTo(tx - 11, ty + 28);
        ctx.lineTo(tx, ty + 4);
        ctx.lineTo(tx + 11, ty + 28);
        ctx.closePath();
        ctx.fill();
      }
      // fanion du village
      const { x: fx, y: fy } = lay.flag;
      ctx.fillStyle = '#5B3F2C';
      ctx.fillRect(fx - 2, fy - 50, 4, 58);
      const wave = Math.sin(t * 3) * 3;
      ctx.fillStyle = '#5CC8B8';
      ctx.beginPath();
      ctx.moveTo(fx + 2, fy - 48);
      ctx.lineTo(fx + 36, fy - 40 + wave);
      ctx.lineTo(fx + 2, fy - 30);
      ctx.closePath();
      ctx.fill();
    } else {
      // piquets qui délimitent l'emplacement
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + 0.2, px = Math.cos(a) * 130, py = Math.sin(a) * 95 + 10;
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(px - 2, py - 16, 4, 18);
        ctx.fillStyle = '#E8DCC0';
        ctx.fillRect(px - 2, py - 16, 4, 4);
      }
    }
    // cercle de pierres du feu
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU;
      ctx.fillStyle = k % 2 ? '#6E726C' : '#5E625C';
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 24, Math.sin(a) * 16 + 2, 7, 5, 0, 0, TAU);
      ctx.fill();
    }
    if (established) this.drawCampfire(ctx, t);
    else {
      ctx.fillStyle = '#2A1F17';
      ctx.beginPath();
      ctx.ellipse(0, 2, 14, 9, 0, 0, TAU);
      ctx.fill();
    }
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const label = established ? campName(i) : 'Emplacement de camp';
    ctx.strokeText(label, 0, -170);
    ctx.fillStyle = established ? '#F0B64A' : '#C9CFC2';
    ctx.fillText(label, 0, -170);
    ctx.restore();
  }

  /**
   * École des dompteurs, au village : un terrain en friche tant que son plan n'est pas trouvé (au Camp avancé), le terrain
   * piqueté une fois le plan rapporté, le chantier d'Aubin (échafaudage, compte à rebours), puis la maison au grand livre.
   */
  drawSchool(ctx: CanvasRenderingContext2D, state: 'none' | 'plan' | 'building' | 'built', left: number, t: number) {
    const built = state === 'built', camp = state !== 'none';
    const { x, y } = this.map.school;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(8,14,12,0.3)';
    ctx.beginPath();
    ctx.ellipse(4, 8, 58, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6E726C'; // estrade
    ctx.fillRect(-50, -6, 100, 12);
    ctx.fillStyle = '#5E625C';
    for (let k = -50; k < 50; k += 20) ctx.fillRect(k + 1, 2, 18, 3);
    if (built) {
      ctx.fillStyle = '#E2D3B0'; // murs
      ctx.fillRect(-40, -54, 80, 50);
      ctx.fillStyle = '#5B3F2C'; // colombages
      for (const k of [-40, -14, 12, 37]) ctx.fillRect(k, -54, 3, 50);
      ctx.fillRect(-40, -32, 80, 3);
      ctx.fillStyle = '#3E5A6E'; // toit d'ardoise
      ctx.beginPath();
      ctx.moveTo(-50, -52);
      ctx.lineTo(0, -88);
      ctx.lineTo(50, -52);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2E4352';
      ctx.fillRect(-50, -54, 100, 4);
      ctx.fillStyle = '#2A1F17'; // porte
      ctx.fillRect(-9, -26, 18, 22);
      // fenêtres éclairées (elles vacillent : quelqu'un lit)
      const glow = 0.75 + 0.25 * Math.sin(t * 2.3);
      ctx.fillStyle = `rgba(240,182,74,${glow})`;
      ctx.fillRect(-32, -26, 12, 10);
      ctx.fillRect(20, -26, 12, 10);
      // grand livre ouvert, enseigne au-dessus de la porte
      ctx.fillStyle = '#8A3B2E';
      ctx.fillRect(-15, -50, 30, 15);
      ctx.fillStyle = '#F2E8CF';
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.quadraticCurveTo(-7, -50, -13, -47);
      ctx.lineTo(-13, -37);
      ctx.quadraticCurveTo(-7, -40, 0, -37);
      ctx.quadraticCurveTo(7, -40, 13, -37);
      ctx.lineTo(13, -47);
      ctx.quadraticCurveTo(7, -50, 0, -46);
      ctx.fill();
      ctx.strokeStyle = '#8B7E64';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(0, -37);
      ctx.stroke();
    } else if (camp) {
      // chantier : quatre piquets aux coins et une pile de planches
      for (const [px, py] of [[-40, -4], [40, -4], [-34, -40], [34, -40]]) {
        ctx.fillStyle = '#5B3F2C';
        ctx.fillRect(px - 2, py - 16, 4, 18);
        ctx.fillStyle = '#E8DCC0';
        ctx.fillRect(px - 2, py - 16, 4, 4);
      }
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? '#A8743F' : '#8E6136';
        ctx.fillRect(-22 + k * 3, -12 - k * 5, 44, 5);
      }
    }
    if (state === 'building') {
      // échafaudage d'Aubin : deux montants, une traverse, et les murs qui montent avec le temps
      ctx.fillStyle = '#E2D3B0';
      ctx.fillRect(-36, -26, 72, 22);
      ctx.strokeStyle = '#7A5A3A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const px of [-44, 44]) {
        ctx.moveTo(px, -2);
        ctx.lineTo(px, -70);
      }
      ctx.moveTo(-48, -46);
      ctx.lineTo(48, -46);
      ctx.moveTo(-44, -6);
      ctx.lineTo(44, -66);
      ctx.stroke();
      const swing = Math.sin(t * 6) * 0.5;
      ctx.fillStyle = '#C9CFC2'; // le marteau qui va et vient
      ctx.save();
      ctx.translate(30, -46);
      ctx.rotate(swing);
      ctx.fillRect(-1.5, -14, 3, 14);
      ctx.fillRect(-5, -17, 10, 5);
      ctx.restore();
    }
    if (state === 'none') {
      // terrain en friche : quelques broussailles et cailloux à la place de l'estrade
      for (let k = 0; k < 7; k++) {
        const px = -44 + hash2(k, 11, this.seed) * 88, py = -16 + hash2(k, 12, this.seed) * 22;
        ctx.fillStyle = k % 2 ? '#2E4A2C' : '#6E726C';
        ctx.beginPath();
        ctx.ellipse(px, py, k % 2 ? 10 : 7, k % 2 ? 8 : 5, 0, 0, TAU);
        ctx.fill();
      }
    }
    const label = built ? 'École des dompteurs' : state === 'building' ? `Chantier de l'école · ${clockOf(left)}` : 'École des dompteurs';
    const sub = state === 'none' ? 'son plan : au Camp avancé' : state === 'plan' ? 'Aubin peut la bâtir' : '';
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    const ly = built ? -104 : state === 'building' ? -84 : -40;
    ctx.strokeText(label, 0, ly);
    ctx.fillStyle = built ? '#F0B64A' : state === 'none' ? '#A9B3A6' : '#C9CFC2';
    ctx.fillText(label, 0, ly);
    if (sub) {
      ctx.font = '600 13px Outfit, sans-serif';
      ctx.strokeText(sub, 0, ly + 17);
      ctx.fillStyle = '#C9CFC2';
      ctx.fillText(sub, 0, ly + 17);
    }
    ctx.restore();
  }

  /** Pierre de passage : un menhir gravé, dont la rune luit quand elle est reliée. */
  drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, t: number, label?: string) {
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 4, y + 6, 24, 8, 0, 0, TAU);
    ctx.fill();
    if (active) {
      const pulse = 0.5 + Math.sin(t * 2.4) * 0.15;
      const glow = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 70);
      glow.addColorStop(0, `rgba(92,200,184,${0.4 * pulse})`);
      glow.addColorStop(1, 'rgba(92,200,184,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y - 30, 70, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#5E6662';
    ctx.beginPath();
    ctx.moveTo(x - 18, y + 4);
    ctx.lineTo(x - 15, y - 48);
    ctx.quadraticCurveTo(x - 2, y - 66, x + 13, y - 50);
    ctx.lineTo(x + 18, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#737C77';
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 48);
    ctx.quadraticCurveTo(x - 2, y - 66, x + 13, y - 50);
    ctx.lineTo(x + 4, y - 44);
    ctx.lineTo(x - 8, y - 42);
    ctx.closePath();
    ctx.fill();
    // rune
    ctx.strokeStyle = active ? '#9FF5E6' : '#3E4542';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 38);
    ctx.lineTo(x, y - 10);
    ctx.moveTo(x - 7, y - 30);
    ctx.lineTo(x, y - 22);
    ctx.lineTo(x + 7, y - 30);
    ctx.moveTo(x - 6, y - 14);
    ctx.lineTo(x + 6, y - 14);
    ctx.stroke();
    if (!label) return;
    ctx.font = '700 15px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(16,24,26,0.85)';
    ctx.strokeText(label, x, y - 78);
    ctx.fillStyle = '#C9CFC2';
    ctx.fillText(label, x, y - 78);
  }

  drawCampfire(ctx: CanvasRenderingContext2D, t: number) {
    ctx.fillStyle = '#4A3424';
    ctx.save();
    for (const a of [0.4, -0.4, Math.PI / 2]) {
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(-18, -4, 36, 8);
      ctx.restore();
    }
    ctx.restore();
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    const glow = ctx.createRadialGradient(0, -4, 2, 0, -4, 90);
    glow.addColorStop(0, 'rgba(240,182,74,0.35)');
    glow.addColorStop(1, 'rgba(240,182,74,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -4, 90, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#E8693F';
    ctx.beginPath();
    ctx.ellipse(0, -8 * f, 13, 20 * f, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#F0B64A';
    ctx.beginPath();
    ctx.ellipse(0, -4 * f, 7, 12 * f, 0, 0, TAU);
    ctx.fill();
  }
}
