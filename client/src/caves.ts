// Grottes selon le biome (zone 1 à 8) : leur entrée sur la carte et les décors de leur intérieur.
// Dans la jungle, ce sont des temples à degrés, façon maya.

import { DESERT_ZONE, JUNGLE_ZONE, VOLCANO_ZONE } from '../../shared/config.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const shadowBase = (ctx: Ctx, x: number, y: number, w: number) => {
  ctx.fillStyle = 'rgba(8,14,12,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 40, w, 24, 0, 0, TAU);
  ctx.fill();
};
const mouth = (ctx: Ctx, x: number, y: number, w: number, h: number, eyes: boolean, t: number) => {
  ctx.fillStyle = '#07090A';
  ctx.beginPath();
  ctx.moveTo(x - w, y + 38);
  ctx.quadraticCurveTo(x - w - 4, y + 38 - h, x, y + 32 - h);
  ctx.quadraticCurveTo(x + w + 4, y + 38 - h, x + w, y + 38);
  ctx.closePath();
  ctx.fill();
  if (!eyes) return;
  const blink = Math.sin(t * 1.3) > 0.92 ? 0.2 : 1;
  ctx.fillStyle = `rgba(232,105,63,${0.85 * blink})`;
  ctx.beginPath();
  ctx.arc(x - 9, y - 4, 3, 0, TAU);
  ctx.arc(x + 9, y - 4, 3, 0, TAU);
  ctx.fill();
};
const torch = (ctx: Ctx, x: number, y: number, t: number, flame = '#E8693F', core = '#F0B64A') => {
  ctx.fillStyle = '#5B3F2C';
  ctx.fillRect(x - 3, y - 26, 6, 30);
  const f = 1 + Math.sin(t * 11 + x) * 0.12;
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.ellipse(x, y - 32 * f, 6, 10 * f, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(x, y - 30 * f, 3, 5 * f, 0, 0, TAU);
  ctx.fill();
};
const poly = (ctx: Ctx, x: number, y: number, pts: number[][], fill: string) => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.closePath();
  ctx.fill();
};

// ───────────────────────── Entrées ─────────────────────────

/**
 * Entrée d'une grotte selon son biome : butte moussue à racines (Lisière), souche géante creuse (Bois profonds),
 * éperon de grès et bruyère (Landes), arche en ruine à runes (Ruines moussues), roche noire et mare (Lacs brumeux).
 * boss : le géant est là (ses yeux luisent au fond).
 */
export function drawEntrance(ctx: Ctx, x: number, y: number, zone: number, t: number, boss: boolean) {
  shadowBase(ctx, x, y, 112);
  if (zone === 1) {
    // Lisière : butte moussue, racines qui l'enserrent, fleurs
    poly(ctx, x, y, [[-105, 38], [-108, -10], [-80, -55], [-30, -80], [30, -86], [80, -55], [108, -8], [105, 38]], '#5A6152');
    ctx.fillStyle = '#6E9A55';
    ctx.beginPath();
    ctx.ellipse(x - 10, y - 74, 70, 18, 0.05, 0, TAU);
    ctx.ellipse(x - 70, y - 40, 26, 12, -0.5, 0, TAU);
    ctx.ellipse(x + 72, y - 44, 28, 12, 0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 90, y + 30);
    ctx.quadraticCurveTo(x - 70, y - 30, x - 20, y - 60);
    ctx.moveTo(x + 95, y + 28);
    ctx.quadraticCurveTo(x + 60, y - 20, x + 30, y - 66);
    ctx.stroke();
    mouth(ctx, x, y, 38, 70, boss, t);
    for (const [fx, fy, c] of [[-60, -66, '#F0B64A'], [-30, -82, '#D886C9'], [40, -80, '#EEE7D7'], [70, -52, '#F0B64A']] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x + fx, y + fy, 3.5, 0, TAU);
      ctx.fill();
    }
    torch(ctx, x - 60, y + 14, t);
    torch(ctx, x + 60, y + 14, t);
  } else if (zone === 2) {
    // Bois profonds : souche géante creuse, champignons, lucioles
    ctx.fillStyle = '#4A3424';
    ctx.beginPath();
    ctx.moveTo(x - 100, y + 38);
    ctx.lineTo(x - 82, y - 70);
    ctx.lineTo(x - 60, y - 96);
    ctx.lineTo(x - 30, y - 80);
    ctx.lineTo(x - 5, y - 104);
    ctx.lineTo(x + 25, y - 82);
    ctx.lineTo(x + 58, y - 100);
    ctx.lineTo(x + 82, y - 68);
    ctx.lineTo(x + 100, y + 38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,26,0.35)';
    ctx.lineWidth = 3;
    for (const dx of [-62, -30, 30, 62]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y + 30);
      ctx.lineTo(x + dx * 0.9, y - 70);
      ctx.stroke();
    }
    ctx.fillStyle = '#6B4A33';
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 96, 58, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#C9A27A';
    ctx.beginPath();
    ctx.ellipse(x - 5, y - 96, 40, 7, 0, 0, TAU);
    ctx.fill();
    // racines au sol
    ctx.strokeStyle = '#4A3424';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 96, y + 34);
    ctx.quadraticCurveTo(x - 120, y + 42, x - 132, y + 30);
    ctx.moveTo(x + 96, y + 34);
    ctx.quadraticCurveTo(x + 122, y + 44, x + 136, y + 34);
    ctx.stroke();
    mouth(ctx, x, y, 34, 76, boss, t);
    for (const [mx, my, s] of [[-78, 20, 1], [-92, 32, 0.7], [84, 24, 0.9]] as const) {
      ctx.fillStyle = '#EADFC6';
      ctx.fillRect(x + mx - 2 * s, y + my - 8 * s, 4 * s, 9 * s);
      ctx.fillStyle = '#C8553D';
      ctx.beginPath();
      ctx.ellipse(x + mx, y + my - 9 * s, 9 * s, 6 * s, 0, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(240,226,140,0.9)';
    for (let k = 0; k < 5; k++) {
      const a = t * 0.8 + k * 1.3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * (60 + k * 8), y - 40 + Math.sin(a * 1.3) * 30, 2, 0, TAU);
      ctx.fill();
    }
  } else if (zone === 3) {
    // Landes : éperon de grès en strates, bruyère, crâne
    poly(ctx, x, y, [[-110, 38], [-104, -6], [-86, -30], [-60, -58], [-20, -70], [10, -96], [44, -78], [76, -60], [100, -20], [112, 38]], '#9A7A55');
    ctx.strokeStyle = 'rgba(90,60,30,0.45)';
    ctx.lineWidth = 3;
    for (const ly of [-50, -26, -2, 20]) {
      ctx.beginPath();
      ctx.moveTo(x - 100, y + ly + 4);
      ctx.lineTo(x + 100, y + ly);
      ctx.stroke();
    }
    ctx.fillStyle = '#B89468';
    poly(ctx, x, y, [[-20, -70], [10, -96], [44, -78], [16, -66]], '#B89468');
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 ? '#8A5A8A' : '#6E4A6E';
      ctx.beginPath();
      ctx.ellipse(x - 108 + k * 27, y + 34 - (k % 3) * 4, 12, 7, 0, 0, TAU);
      ctx.fill();
    }
    mouth(ctx, x, y, 36, 66, boss, t);
    ctx.fillStyle = '#E9DFC8'; // crâne de sanglier
    ctx.beginPath();
    ctx.ellipse(x + 2, y - 52, 11, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#E9DFC8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 52);
    ctx.quadraticCurveTo(x - 20, y - 58, x - 18, y - 70);
    ctx.moveTo(x + 12, y - 52);
    ctx.quadraticCurveTo(x + 24, y - 58, x + 22, y - 70);
    ctx.stroke();
    torch(ctx, x - 60, y + 14, t);
    torch(ctx, x + 60, y + 14, t);
  } else if (zone === 4) {
    // Ruines moussues : arche de pierres taillées, piliers brisés, runes qui luisent
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? '#6E7570' : '#5E6662';
        ctx.fillRect(x + sx * 56 - 16, y + 20 - k * 26, 32, 24);
      }
    }
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k / 6) * Math.PI, ax = x + Math.cos(a) * 58, ay = y - 70 + Math.sin(a) * 40;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = k % 2 ? '#737C77' : '#626A66';
      ctx.fillRect(-14, -12, 28, 24);
      ctx.restore();
    }
    ctx.fillStyle = '#07090A';
    ctx.fillRect(x - 40, y - 70, 80, 108);
    ctx.beginPath();
    ctx.arc(x, y - 70, 40, Math.PI, 0);
    ctx.fill();
    const glow = 0.55 + Math.sin(t * 2.4) * 0.2;
    ctx.fillStyle = `rgba(143,227,214,${glow})`;
    ctx.font = '700 16px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ᚱ', x - 56, y - 26);
    ctx.fillText('ᛟ', x + 56, y - 26);
    ctx.fillText('ᚦ', x, y - 106);
    ctx.fillStyle = '#4E7A49';
    ctx.beginPath();
    ctx.ellipse(x - 50, y - 108, 26, 9, -0.3, 0, TAU);
    ctx.ellipse(x + 62, y + 20, 20, 7, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5E6662'; // pilier brisé à côté
    ctx.fillRect(x + 96, y - 10, 22, 48);
    ctx.fillRect(x - 120, y + 6, 22, 32);
    if (boss) {
      const blink = Math.sin(t * 1.3) > 0.92 ? 0.2 : 1;
      ctx.fillStyle = `rgba(143,227,214,${0.85 * blink})`;
      ctx.beginPath();
      ctx.arc(x - 9, y - 10, 3, 0, TAU);
      ctx.arc(x + 9, y - 10, 3, 0, TAU);
      ctx.fill();
    }
  } else if (zone === JUNGLE_ZONE) {
    drawTemple(ctx, x, y, t, boss);
  } else if (zone === DESERT_ZONE) {
    // Mer de sable : falaise de grès à strates, deux colonnes taillées, dune au pied, braseros
    ctx.fillStyle = '#D9B47E';
    ctx.beginPath();
    ctx.ellipse(x, y + 44, 120, 22, 0, 0, TAU);
    ctx.fill();
    poly(ctx, x, y, [[-112, 40], [-104, -30], [-80, -78], [-30, -96], [30, -98], [82, -76], [106, -28], [112, 40]], '#A06E42');
    ctx.fillStyle = '#B98450';
    ctx.fillRect(x - 100, y - 40, 200, 14);
    ctx.fillRect(x - 86, y - 72, 172, 12);
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#C99A62';
      ctx.fillRect(x + sx * 56 - 11, y - 64, 22, 102);
      ctx.fillStyle = '#E0B87F';
      ctx.fillRect(x + sx * 56 - 15, y - 70, 30, 9);
      ctx.fillStyle = 'rgba(80,50,25,0.35)';
      ctx.fillRect(x + sx * 56 + 4, y - 61, 7, 99);
    }
    mouth(ctx, x, y, 38, 70, boss, t);
    torch(ctx, x - 86, y + 18, t, '#E8693F', '#F7D774');
    torch(ctx, x + 86, y + 18, t, '#E8693F', '#F7D774');
  } else if (zone === VOLCANO_ZONE) {
    // Entrailles du volcan : obsidienne veinée de lave, une coulée qui suinte du seuil, braseros
    poly(ctx, x, y, [[-110, 40], [-104, -24], [-74, -74], [-26, -94], [28, -96], [76, -72], [106, -22], [110, 40]], '#241A1C');
    ctx.strokeStyle = `rgba(232,105,63,${0.55 + 0.25 * Math.sin(t * 1.7)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 90, y + 30);
    ctx.lineTo(x - 64, y - 30);
    ctx.lineTo(x - 70, y - 62);
    ctx.moveTo(x + 86, y + 28);
    ctx.lineTo(x + 60, y - 20);
    ctx.lineTo(x + 40, y - 80);
    ctx.stroke();
    mouth(ctx, x, y, 38, 70, boss, t);
    ctx.fillStyle = `rgba(240,120,50,${0.7 + 0.2 * Math.sin(t * 2.3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 46, 46, 9, 0, 0, TAU);
    ctx.fill();
    torch(ctx, x - 80, y + 18, t, '#E8693F', '#FFD27A');
    torch(ctx, x + 80, y + 18, t, '#E8693F', '#FFD27A');
  } else {
    // Lacs brumeux : roche noire luisante, mare devant l'entrée, roseaux, lanternes bleues
    ctx.fillStyle = '#2E6574';
    ctx.beginPath();
    ctx.ellipse(x, y + 48, 70, 16, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,235,240,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y + 48, 40 + Math.sin(t * 2) * 6, 8, 0, 0, TAU);
    ctx.stroke();
    poly(ctx, x, y, [[-106, 38], [-100, -20], [-70, -64], [-28, -84], [24, -88], [70, -62], [102, -18], [106, 38]], '#2F3B40');
    ctx.fillStyle = 'rgba(160,200,210,0.25)';
    ctx.beginPath();
    ctx.ellipse(x - 40, y - 58, 34, 10, -0.3, 0, TAU);
    ctx.ellipse(x + 50, y - 50, 22, 8, 0.4, 0, TAU);
    ctx.fill();
    mouth(ctx, x, y, 38, 70, boss, t);
    ctx.strokeStyle = 'rgba(150,190,140,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const rx of [-96, -88, -80, 82, 90, 98]) {
      ctx.moveTo(x + rx, y + 40);
      ctx.lineTo(x + rx + (rx < 0 ? -4 : 4), y + 10);
    }
    ctx.stroke();
    torch(ctx, x - 62, y + 14, t, '#6FB7FF', '#C9F0FF');
    torch(ctx, x + 62, y + 14, t, '#6FB7FF', '#C9F0FF');
  }
}

// ───────────────────────── Temples de la jungle ─────────────────────────

/** Bloc de pierre taillée, éclairé en haut à gauche, joint sombre en bas à droite. */
const block = (ctx: Ctx, x: number, y: number, w: number, h: number, base: string, light: string, dark: string) => {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
};

/** Liane qui pend : une courbe qui ondule un peu au vent, des feuilles en cœur de loin en loin. */
export const liana = (ctx: Ctx, x: number, y: number, len: number, t: number, seed: number, col = '#3E6A2E', leaf = '#5E9A44') => {
  const sway = Math.sin(t * 0.9 + seed) * 4;
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + 6, y + len * 0.3, x - 6 + sway * 0.5, y + len * 0.65, x + sway, y + len);
  ctx.stroke();
  ctx.fillStyle = leaf;
  for (let k = 1; k <= Math.floor(len / 14); k++) {
    const f = (k * 14) / len, lx = x + sway * f * f + Math.sin(f * 6 + seed) * 4, ly = y + len * f, s = k % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(lx + s * 4, ly, 4.2, 2.4, s * 0.6, 0, TAU);
    ctx.fill();
  }
};

/**
 * Temple à degrés de la jungle (l'entrée d'une grotte) : quatre étages de pierre grise moussue, un grand escalier
 * central vers le sanctuaire du sommet, une porte basse sous un linteau sculpté de glyphes (l'entrée, où luisent les yeux
 * du géant), deux têtes de serpent à plumes au pied des rampes, des lianes qui pendent des corniches, des fougères
 * au pied, et deux braseros.
 */
function drawTemple(ctx: Ctx, x: number, y: number, t: number, boss: boolean) {
  const stone = '#7C8370', light = '#9EA38E', dark = '#4E5446', moss = '#4E7A3A';
  // étages, du bas vers le haut : de plus en plus étroits
  const tiers = [[-120, 8, 240, 32], [-100, -22, 200, 30], [-80, -50, 160, 28], [-60, -76, 120, 26]];
  for (const [tx, ty, tw, th] of tiers) {
    ctx.fillStyle = 'rgba(8,14,12,0.35)';
    ctx.fillRect(x + tx + 6, y + ty + th - 4, tw, 6);
    for (let bx = 0; bx < tw; bx += 20) for (let by = 0; by < th; by += 10) block(ctx, x + tx + bx + ((by / 10) % 2) * 6 - 3, y + ty + by, 20, 10, stone, light, dark);
    ctx.fillStyle = '#5E6454'; // corniche
    ctx.fillRect(x + tx - 4, y + ty - 4, tw + 8, 5);
  }
  // sanctuaire du sommet : petit toit à crête, porte sombre
  block(ctx, x - 34, y - 104, 68, 28, stone, light, dark);
  ctx.fillStyle = '#5E6454';
  ctx.beginPath();
  ctx.moveTo(x - 40, y - 104);
  ctx.lineTo(x - 22, y - 122);
  ctx.lineTo(x + 22, y - 122);
  ctx.lineTo(x + 40, y - 104);
  ctx.fill();
  for (let k = -2; k <= 2; k++) block(ctx, x + k * 10 - 3, y - 132, 6, 10, stone, light, dark); // crête ajourée
  ctx.fillStyle = '#0E1210';
  ctx.fillRect(x - 9, y - 98, 18, 22);
  // grand escalier central, ses marches
  ctx.fillStyle = '#6A7160';
  ctx.beginPath();
  ctx.moveTo(x - 30, y + 40);
  ctx.lineTo(x - 18, y - 76);
  ctx.lineTo(x + 18, y - 76);
  ctx.lineTo(x + 30, y + 40);
  ctx.fill();
  for (let k = 0; k < 22; k++) {
    const sy = y + 38 - k * 5.3, half = 30 - k * 0.55;
    ctx.fillStyle = k % 2 ? '#848A76' : '#767C68';
    ctx.fillRect(x - half, sy - 3, half * 2, 3);
    ctx.fillStyle = 'rgba(16,20,14,0.35)';
    ctx.fillRect(x - half, sy, half * 2, 1.5);
  }
  // rampes de part et d'autre, têtes de serpent à plumes au pied
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#5E6454';
    ctx.beginPath();
    ctx.moveTo(x + s * 30, y + 40);
    ctx.lineTo(x + s * 18, y - 76);
    ctx.lineTo(x + s * 24, y - 76);
    ctx.lineTo(x + s * 38, y + 40);
    ctx.fill();
    const hx = x + s * 40, hy = y + 30;
    ctx.fillStyle = '#8A907A';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 14, 11, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6A7060';
    ctx.beginPath(); // la gueule ouverte, crocs
    ctx.moveTo(hx + s * 4, hy + 2);
    ctx.lineTo(hx + s * 18, hy - 2);
    ctx.lineTo(hx + s * 18, hy + 8);
    ctx.fill();
    ctx.fillStyle = '#E9DFC8';
    ctx.fillRect(hx + s * 12 - 1, hy, 2, 4);
    ctx.fillStyle = '#1A1A14';
    ctx.beginPath();
    ctx.arc(hx + s * 2, hy - 4, 2.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3F8A6A'; // panache de plumes de jade
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(hx - s * (8 + k * 3), hy - 8 - k * 2, 3, 8, -s * (0.6 + k * 0.2), 0, TAU);
      ctx.fill();
    }
  }
  // porte basse au pied de l'escalier (l'entrée), sous un linteau de glyphes
  ctx.fillStyle = '#0B0E0C';
  ctx.beginPath();
  ctx.moveTo(x - 24, y + 40);
  ctx.lineTo(x - 24, y + 6);
  ctx.lineTo(x - 14, y - 6);
  ctx.lineTo(x + 14, y - 6);
  ctx.lineTo(x + 24, y + 6);
  ctx.lineTo(x + 24, y + 40);
  ctx.fill();
  block(ctx, x - 32, y - 16, 64, 11, '#8A907A', '#A8AD96', '#5E6454');
  ctx.strokeStyle = '#4A5040';
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 5; k++) {
    // glyphes : spirale, œil, marches, croix… un par case du linteau
    const gx = x - 26 + k * 13, gy = y - 10.5;
    ctx.beginPath();
    if (k % 3 === 0) ctx.arc(gx, gy, 3.2, 0, Math.PI * 1.6);
    else if (k % 3 === 1) {
      ctx.ellipse(gx, gy, 4, 2.4, 0, 0, TAU);
      ctx.moveTo(gx + 1, gy);
      ctx.arc(gx, gy, 1, 0, TAU);
    } else {
      ctx.moveTo(gx - 4, gy + 3);
      ctx.lineTo(gx - 4, gy);
      ctx.lineTo(gx, gy);
      ctx.lineTo(gx, gy - 3);
      ctx.lineTo(gx + 4, gy - 3);
    }
    ctx.stroke();
  }
  if (boss) {
    const blink = Math.sin(t * 1.3) > 0.92 ? 0.2 : 1;
    ctx.fillStyle = `rgba(240,182,74,${0.9 * blink})`;
    ctx.beginPath();
    ctx.arc(x - 8, y + 14, 3, 0, TAU);
    ctx.arc(x + 8, y + 14, 3, 0, TAU);
    ctx.fill();
  }
  // mousse sur les corniches, lianes qui pendent
  ctx.fillStyle = moss;
  for (const [mx, my, mw] of [[-118, 4, 40], [64, 4, 46], [-98, -26, 30], [70, -26, 26], [-78, -54, 24], [46, -80, 20], [-30, -108, 22]]) {
    ctx.beginPath();
    ctx.ellipse(x + mx + mw / 2, y + my, mw / 2, 4, 0, 0, TAU);
    ctx.fill();
  }
  for (const [lx, ly, len] of [[-112, 6, 26], [-92, -24, 34], [96, -24, 30], [110, 6, 22], [-70, -52, 22], [74, -52, 40], [-50, -78, 18]]) liana(ctx, x + lx, y + ly, len, t, lx);
  // fougères au pied, braseros
  for (const [fx, s] of [[-128, -1], [128, 1], [-60, -1], [62, 1]]) {
    ctx.strokeStyle = '#3F7A34';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.45 + s * 0.1;
      ctx.beginPath();
      ctx.moveTo(x + fx, y + 44);
      ctx.quadraticCurveTo(x + fx + Math.cos(a) * 14, y + 44 + Math.sin(a) * 18, x + fx + Math.cos(a) * 26, y + 44 + Math.sin(a) * 18 + 8);
      ctx.stroke();
    }
  }
  torch(ctx, x - 52, y + 38, t, '#E8693F', '#F7D774');
  torch(ctx, x + 52, y + 38, t, '#E8693F', '#F7D774');
}

/** Décor d'un temple, au pied des parois : piliers sculptés, braseros, statues à tête de jaguar, lianes. */
function templeProp(ctx: Ctx, px: number, py: number, a: number, i: number) {
  if (i % 4 === 0) {
    // pilier sculpté de glyphes, mousse à sa base
    block(ctx, px - 13, py - 62, 26, 64, '#7C8370', '#9EA38E', '#4E5446');
    ctx.strokeStyle = '#4A5040';
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(px, py - 50 + k * 18, 5, 0, Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#4E7A3A';
    ctx.beginPath();
    ctx.ellipse(px, py + 1, 18, 5, 0, 0, TAU);
    ctx.fill();
    liana(ctx, px - 8, py - 62, 40, 0, i);
  } else if (i % 4 === 1) {
    // brasero de pierre et son feu
    ctx.fillStyle = 'rgba(240,150,60,0.18)';
    ctx.beginPath();
    ctx.arc(px, py - 20, 34, 0, TAU);
    ctx.fill();
    block(ctx, px - 12, py - 16, 24, 18, '#6A7060', '#8A907A', '#3E443A');
    ctx.fillStyle = '#E8693F';
    ctx.beginPath();
    ctx.ellipse(px, py - 24, 9, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#F7D774';
    ctx.beginPath();
    ctx.ellipse(px, py - 21, 4, 6, 0, 0, TAU);
    ctx.fill();
  } else if (i % 4 === 2) {
    // statue à tête de jaguar
    block(ctx, px - 12, py - 22, 24, 24, '#6A7060', '#8A907A', '#3E443A');
    ctx.fillStyle = '#848A76';
    ctx.beginPath();
    ctx.ellipse(px, py - 34, 15, 13, 0, 0, TAU);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(px + s * 10, py - 45, 5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#2F8A6A'; // yeux de jade
    ctx.fillRect(px - 8, py - 37, 5, 3);
    ctx.fillRect(px + 3, py - 37, 5, 3);
    ctx.fillStyle = '#3E443A';
    ctx.fillRect(px - 6, py - 29, 12, 3);
  } else {
    // racines et lianes qui ont percé la paroi
    ctx.strokeStyle = '#4A3A26';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - Math.cos(a) * 26, py - Math.sin(a) * 10, px - Math.cos(a) * 46 + 8, py - Math.sin(a) * 24);
    ctx.stroke();
    liana(ctx, px + 6, py - 40, 36, 0, i * 3);
  }
}

// ───────────────────────── Intérieurs selon le biome ─────────────────────────

/** Sol, paroi et décor d'un intérieur de grotte, par zone. */
export const INSIDE = [
  { floor: '#5A5A40', wall: '#3A3F33', prop: 'roots' },
  { floor: '#3E3A2C', wall: '#2E2A20', prop: 'mush' },
  { floor: '#6A5238', wall: '#4A3826', prop: 'bones' },
  { floor: '#3A4A42', wall: '#2A3430', prop: 'runes' },
  { floor: '#2E4448', wall: '#1E2C30', prop: 'water' },
  { floor: '#5C6450', wall: '#2E3828', prop: 'temple' }, // Jungle : dalles de temple moussues, piliers sculptés, braseros
  { floor: '#8A6A42', wall: '#5E4428', prop: 'bones' }, // Mer de sable : grès et ossements
  { floor: '#4A2E22', wall: '#2A1A14', prop: 'lava' }, // Entrailles du volcan : basalte et lave
];

/** Décor du biome posé le long de la paroi d'un intérieur (i : rang du décor, a : angle). */
export function insideProp(ctx: Ctx, zone: number, px: number, py: number, a: number, i: number) {
  const prop = INSIDE[zone - 1].prop;
  if (prop === 'roots') {
    ctx.strokeStyle = '#5B3F2C';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - Math.cos(a) * 30, py - Math.sin(a) * 12, px - Math.cos(a) * 52 + 10, py - Math.sin(a) * 30);
    ctx.stroke();
  } else if (prop === 'mush') {
    ctx.fillStyle = 'rgba(160,220,120,0.22)';
    ctx.beginPath();
    ctx.arc(px, py - 8, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#EADFC6';
    ctx.fillRect(px - 3, py - 10, 6, 12);
    ctx.fillStyle = i % 2 ? '#9BE070' : '#C8553D';
    ctx.beginPath();
    ctx.ellipse(px, py - 10, 13, 9, 0, Math.PI, 0);
    ctx.fill();
  } else if (prop === 'bones') {
    ctx.strokeStyle = '#E9DFC8';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 14, py);
    ctx.lineTo(px + 14, py - 6);
    if (i % 3 === 0) {
      ctx.moveTo(px - 4, py + 8);
      ctx.lineTo(px + 10, py + 14);
    }
    ctx.stroke();
  } else if (prop === 'lava') {
    ctx.fillStyle = 'rgba(240,110,50,0.75)';
    ctx.beginPath();
    ctx.ellipse(px, py, 26, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,122,0.8)';
    ctx.beginPath();
    ctx.ellipse(px, py, 12, 4, 0, 0, TAU);
    ctx.fill();
    if (i % 2) {
      ctx.fillStyle = '#2C201C';
      ctx.fillRect(px + 20, py - 46, 14, 48);
      ctx.fillRect(px + 36, py - 30, 12, 32);
    }
  } else if (prop === 'temple') {
    templeProp(ctx, px, py, a, i);
  } else if (prop === 'runes') {
    if (i % 3) return;
    ctx.fillStyle = '#5E6662';
    ctx.fillRect(px - 12, py - 40, 24, 44);
    ctx.fillStyle = 'rgba(143,227,214,0.7)';
    ctx.fillRect(px - 3, py - 32, 6, 18);
  } else {
    ctx.fillStyle = 'rgba(70,140,160,0.55)';
    ctx.beginPath();
    ctx.ellipse(px, py, 32, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,235,240,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(px, py, 18, 6, 0, 0, TAU);
    ctx.stroke();
  }
}

// ───────────────────────── Toiles (antre de la Mère Tisseuse) ─────────────────────────

/**
 * Toile d'araignée : rayons partant de (x, y) entre les angles a0 et a1 (toile d'angle, accrochée à une paroi),
 * ou tout autour (a1 − a0 = 2π), reliés par des fils qui ploient un peu entre deux rayons.
 */
export function drawWeb(ctx: Ctx, x: number, y: number, r: number, a0: number, a1: number, seed: number, alpha = 0.55) {
  const full = a1 - a0 >= TAU - 0.01;
  const n = full ? 9 : 6, rings = 5;
  const spokes = Array.from({ length: n + (full ? 0 : 1) }, (_, i) => a0 + ((a1 - a0) * (i + (full ? 0.5 * Math.sin(seed + i) * 0.3 : 0))) / n);
  const len = (i: number) => r * (0.82 + 0.18 * Math.abs(Math.sin(seed * 3.1 + i * 1.7)));
  ctx.save();
  ctx.strokeStyle = `rgba(238,231,215,${alpha})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  spokes.forEach((a, i) => {
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len(i), y + Math.sin(a) * len(i));
  });
  ctx.stroke();
  ctx.lineWidth = 1.1;
  for (let k = 1; k <= rings; k++) {
    const f = k / (rings + 0.6);
    ctx.beginPath();
    const last = full ? spokes.length : spokes.length - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % spokes.length;
      const ax = x + Math.cos(spokes[i]) * len(i) * f, ay = y + Math.sin(spokes[i]) * len(i) * f;
      const bx = x + Math.cos(spokes[j]) * len(j) * f, by = y + Math.sin(spokes[j]) * len(j) * f;
      const mid = (spokes[i] + spokes[j] + (j < i ? TAU : 0)) / 2, sag = 0.86; // le fil ploie vers le centre
      const cx = x + Math.cos(mid) * ((len(i) + len(j)) / 2) * f * sag, cy = y + Math.sin(mid) * ((len(i) + len(j)) / 2) * f * sag;
      if (i === 0) ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, bx, by);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Cocon de soie (proie emmaillotée) accroché au plafond par un fil. */
export function drawCocoon(ctx: Ctx, x: number, y: number, s: number) {
  ctx.strokeStyle = 'rgba(238,231,215,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 3.2);
  ctx.lineTo(x, y - s);
  ctx.stroke();
  ctx.fillStyle = '#D8D0BE';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.62, s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,130,110,0.7)';
  ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.6, y + k * s * 0.32 - s * 0.12);
    ctx.lineTo(x + s * 0.6, y + k * s * 0.32 + s * 0.12);
    ctx.stroke();
  }
}
