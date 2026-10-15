// Grottes selon le biome (zone 1 à 5) : leur entrée sur la carte et les décors de leur intérieur.

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

// ───────────────────────── Intérieurs selon le biome ─────────────────────────

/** Sol, paroi et décor d'un intérieur de grotte, par zone. */
export const INSIDE = [
  { floor: '#5A5A40', wall: '#3A3F33', prop: 'roots' },
  { floor: '#3E3A2C', wall: '#2E2A20', prop: 'mush' },
  { floor: '#6A5238', wall: '#4A3826', prop: 'bones' },
  { floor: '#3A4A42', wall: '#2A3430', prop: 'runes' },
  { floor: '#2E4448', wall: '#1E2C30', prop: 'water' },
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
