// La haute mer : le bateau d'Aubin au large (la « grotte » du voyage, hors de l'île), la mer autour, et le Kraken
// quand il est sous l'eau (avant de surgir, ou entre deux phases).

import { DECK_RX, DECK_RY } from '../../shared/config.ts';
import type { Cave } from '../../shared/worldmap.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/** Bord du pont : même forme que WorldMap.onDeck (proue pointue à droite), en demi-hauteur pour dx de -1 à 1. */
const halfHeight = (dx: number) => {
  const taper = dx > 0 ? 1 - dx * dx * dx * 0.75 : 1;
  return taper * Math.sqrt(Math.max(0, 1 - Math.abs(dx) ** 2.6));
};

/** Contour du pont, agrandi de grow px (la coque déborde un peu). */
const hullPath = (ctx: Ctx, grow: number) => {
  ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const dx = -1 + (2 * i) / n;
    ctx.lineTo(dx * (DECK_RX + grow), -(halfHeight(dx) * DECK_RY + grow));
  }
  for (let i = n; i >= 0; i--) {
    const dx = -1 + (2 * i) / n;
    ctx.lineTo(dx * (DECK_RX + grow), halfHeight(dx) * DECK_RY + grow);
  }
  ctx.closePath();
};

/**
 * Le large : la mer qui ondule tout autour de la vue, l'écume contre la coque, le bateau vu de dessus (coque, pont en
 * planches, bastingage, mât et grande voile aux couleurs du village, gouvernail à la poupe), et la sortie (« Retour au
 * port ») à la poupe.
 */
export function drawVoyage(ctx: Ctx, c: Cave, t: number, camX: number, camY: number, hw: number, hh: number) {
  // la mer, sur toute la vue
  const sea = ctx.createLinearGradient(0, camY - hh, 0, camY + hh);
  sea.addColorStop(0, '#163E5A');
  sea.addColorStop(1, '#0E2C44');
  ctx.fillStyle = sea;
  ctx.fillRect(camX - hw - 10, camY - hh - 10, hw * 2 + 20, hh * 2 + 20);
  ctx.strokeStyle = 'rgba(160,210,235,0.18)';
  ctx.lineWidth = 3;
  const step = 70, y0 = Math.floor((camY - hh) / step) * step;
  for (let y = y0; y < camY + hh + step; y += step) {
    ctx.beginPath();
    for (let x = camX - hw - 40; x < camX + hw + 40; x += 24) {
      const wy = y + Math.sin(x / 90 + t * 1.3 + y * 0.05) * 8;
      if (x === camX - hw - 40) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(c.inside.x, c.inside.y);
  const roll = Math.sin(t * 0.9) * 2; // le bateau tangue un peu
  ctx.translate(0, roll);
  // écume contre la coque, sillage à la poupe
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(235,248,255,${0.45 - k * 0.12})`;
    ctx.lineWidth = 5 - k;
    ctx.setLineDash([8 + k * 6, 18 + k * 10]);
    ctx.lineDashOffset = -t * (40 - k * 8) - k * 23;
    hullPath(ctx, 28 + k * 16 + Math.sin(t * 1.5 + k) * 3);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  ctx.setLineDash([]);
  for (let k = 0; k < 5; k++) {
    const f = (t * 0.4 + k / 5) % 1;
    ctx.fillStyle = `rgba(235,248,255,${0.35 * (1 - f)})`;
    ctx.beginPath();
    ctx.ellipse(-DECK_RX - 40 - f * 260, Math.sin(k * 2.1) * 40 * f, 30 + f * 40, 10 + f * 8, 0, 0, TAU);
    ctx.fill();
  }
  // coque, puis pont en planches
  ctx.fillStyle = '#3E2716';
  hullPath(ctx, 22);
  ctx.fill();
  ctx.fillStyle = '#6E4626';
  hullPath(ctx, 12);
  ctx.fill();
  ctx.fillStyle = '#B07E4E';
  hullPath(ctx, 0);
  ctx.fill();
  ctx.save();
  hullPath(ctx, 0);
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,42,22,0.45)';
  ctx.lineWidth = 2;
  for (let y = -DECK_RY; y <= DECK_RY; y += 22) {
    ctx.beginPath();
    ctx.moveTo(-DECK_RX, y);
    ctx.lineTo(DECK_RX, y);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,42,22,0.35)'; // joints décalés des planches
  for (let y = -DECK_RY; y <= DECK_RY; y += 22) {
    for (let x = -DECK_RX + ((y / 22) % 2 ? 60 : 0); x < DECK_RX; x += 120) ctx.fillRect(x, y, 2, 22);
  }
  ctx.restore();
  // bastingage : la lisse et ses poteaux
  ctx.strokeStyle = '#4A2E1A';
  ctx.lineWidth = 7;
  hullPath(ctx, 6);
  ctx.stroke();
  ctx.fillStyle = '#5B3A22';
  for (let i = 1; i < 24; i++) {
    const dx = -1 + i / 12;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(dx * (DECK_RX + 6), sd * (halfHeight(dx) * DECK_RY + 6), 5, 0, TAU);
      ctx.fill();
    }
  }
  // beaupré à la proue
  ctx.strokeStyle = '#4A2E1A';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(DECK_RX - 20, 0);
  ctx.lineTo(DECK_RX + 120, -8);
  ctx.stroke();
  // gouvernail à la poupe
  const wx = -DECK_RX + 190, wy = -20;
  ctx.strokeStyle = '#4A2E1A';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(wx, wy, 22, 0, TAU);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + Math.sin(t * 0.7) * 0.3;
    ctx.moveTo(wx + Math.cos(a) * 8, wy + Math.sin(a) * 8);
    ctx.lineTo(wx + Math.cos(a) * 32, wy + Math.sin(a) * 32);
  }
  ctx.stroke();
  // mât et grande voile, gonflée par le vent, aux couleurs du village
  const mx = 40;
  ctx.strokeStyle = 'rgba(40,26,14,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [ax, ay] of [[-DECK_RX + 40, -DECK_RY * 0.6], [-DECK_RX + 40, DECK_RY * 0.6], [DECK_RX + 110, -8]]) {
    ctx.moveTo(mx, -10);
    ctx.lineTo(ax, ay);
  }
  ctx.stroke();
  const bulge = 26 + Math.sin(t * 1.4) * 6;
  ctx.fillStyle = '#EDE3C8';
  ctx.beginPath();
  ctx.moveTo(mx - 14, -DECK_RY * 0.95);
  ctx.quadraticCurveTo(mx + bulge, 0, mx - 14, DECK_RY * 0.95);
  ctx.lineTo(mx - 24, DECK_RY * 0.95);
  ctx.quadraticCurveTo(mx + bulge - 16, 0, mx - 24, -DECK_RY * 0.95);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5CC8B8';
  ctx.fillRect(mx - 22, -DECK_RY * 0.3, 10 + bulge * 0.7, 18);
  ctx.fillStyle = '#4A2E1A';
  ctx.fillRect(mx - 22, -DECK_RY * 0.98, 8, DECK_RY * 1.96); // la vergue
  ctx.beginPath();
  ctx.arc(mx, 0, 24, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6E4626';
  ctx.beginPath();
  ctx.arc(mx, 0, 16, 0, TAU);
  ctx.fill();
  // la sortie, à la poupe
  const ex = c.exit.x - c.inside.x, ey = c.exit.y - c.inside.y;
  ctx.font = '700 15px "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText('Retour au port', ex, ey + 44);
  ctx.fillStyle = '#EEE7D7';
  ctx.fillText('Retour au port', ex, ey + 44);
  ctx.restore();
}

/** Le Kraken sous l'eau : une ombre immense, des remous ; il plonge (diving) ou attend le bateau, des bulles remontent. */
export function drawSubmerged(ctx: Ctx, x: number, y: number, r: number, t: number, diving: boolean) {
  ctx.fillStyle = 'rgba(8,16,28,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.3, r * 0.75, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    const f = (t * (diving ? 0.9 : 0.4) + k / 3) % 1;
    ctx.strokeStyle = `rgba(200,235,250,${0.45 * (1 - f)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.5 + f), r * (0.3 + f * 0.6), 0, 0, TAU);
    ctx.stroke();
  }
  for (let k = 0; k < (diving ? 8 : 4); k++) {
    const f = (t * 0.8 + k / 8) % 1;
    ctx.fillStyle = `rgba(220,245,255,${0.7 * (1 - f)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 2.4) * r * 0.7, y - f * r * 0.5, 4 + f * 4, 0, TAU);
    ctx.fill();
  }
}
