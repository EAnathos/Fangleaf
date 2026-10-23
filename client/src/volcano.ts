// Le volcan de la Mer de sable (sur la carte) et ses entrailles (la salle de lave, hors du monde) : le cœur volcanique
// sur son autel, scellé par une flamme par géant du volcan encore debout.

import { HALL_RX, HALL_RY, VOLCANO_R, VOLCANO_RY } from '../../shared/config.ts';
import { hash2 } from '../../shared/math.ts';
import { caveEdge, type WorldMap } from '../../shared/worldmap.ts';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const label = (ctx: Ctx, text: string, x: number, y: number, color: string, size = 15) => {
  ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(16,24,26,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
};

/** Hauteur du cône à l'écran (le sommet est dessiné au-dessus de la base, vue de trois quarts). */
export const VOLCANO_H = VOLCANO_R * 0.8;

/**
 * Le volcan, sur l'île : un grand cône de roche sombre, son cratère rougeoyant, des coulées et de la fumée, et à son
 * pied la bouche qui descend dans ses entrailles (fermée par une croûte d'obsidienne tant que le volcan est scellé).
 */
export function drawVolcano(ctx: Ctx, map: WorldMap, t: number, open: boolean) {
  const { x, y } = map.volcano, R = VOLCANO_R, RY = R * VOLCANO_RY, H = VOLCANO_H, rim = R * 0.27, k = R / 760; // k : tailles dessinées pour un volcan de 760
  ctx.save();
  ctx.translate(x, y);
  // ombre et éboulis au pied
  ctx.fillStyle = 'rgba(8,10,8,0.3)';
  ctx.beginPath();
  ctx.ellipse(30, 20, R * 1.05, RY * 1.05, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5A4334';
  ctx.beginPath();
  ctx.ellipse(0, 0, R, RY, 0, 0, TAU);
  ctx.fill();
  // le cône : plus clair à gauche (la lumière vient de là), plus sombre à droite
  const g = ctx.createLinearGradient(-R, 0, R, 0);
  g.addColorStop(0, '#6E5444');
  g.addColorStop(0.45, '#4C3A30');
  g.addColorStop(1, '#2C211C');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-R, 0);
  ctx.bezierCurveTo(-R * 0.7, -H * 0.25, -rim * 1.4, -H * 0.85, -rim, -H);
  ctx.lineTo(rim, -H);
  ctx.bezierCurveTo(rim * 1.4, -H * 0.85, R * 0.7, -H * 0.25, R, 0);
  ctx.ellipse(0, 0, R, RY, 0, 0, Math.PI); // le devant de la base
  ctx.closePath();
  ctx.fill();
  // arêtes de roche, du cratère jusqu'au pied
  ctx.strokeStyle = 'rgba(20,14,10,0.35)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const f = (i + 0.5) / 9 - 0.5, bx = f * 2 * R * 0.92, by = Math.sqrt(Math.max(0, 1 - (bx / R) ** 2)) * RY * 0.9;
    ctx.beginPath();
    ctx.moveTo(f * 2 * rim, -H + 8);
    ctx.quadraticCurveTo(f * R * 0.9, -H * 0.4, bx, by);
    ctx.stroke();
  }
  // coulées de lave, qui rougeoient au rythme du cratère
  const pulse = 0.75 + 0.25 * Math.sin(t * 1.6);
  for (const [f, len, w0] of [[-0.35, 0.55, 14], [0.12, 0.8, 18], [0.45, 0.4, 11]] as const) {
    const w = w0 * Math.max(0.7, k);
    const sx = f * rim * 2, ex = f * R * 0.75, ey = -H + H * len;
    ctx.strokeStyle = `rgba(232,105,63,${0.85 * pulse})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(sx, -H + 6);
    ctx.bezierCurveTo(sx + f * 60, -H * 0.8, ex - f * 90, ey - H * 0.15, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,122,${0.7 * pulse})`;
    ctx.lineWidth = w * 0.35;
    ctx.stroke();
  }
  // cratère
  ctx.fillStyle = '#1E1410';
  ctx.beginPath();
  ctx.ellipse(0, -H, rim, rim * 0.3, 0, 0, TAU);
  ctx.fill();
  const lava = ctx.createRadialGradient(0, -H, 4, 0, -H, rim * 0.9);
  lava.addColorStop(0, `rgba(255,226,140,${pulse})`);
  lava.addColorStop(0.5, 'rgba(240,110,50,0.9)');
  lava.addColorStop(1, 'rgba(120,30,10,0)');
  ctx.fillStyle = lava;
  ctx.beginPath();
  ctx.ellipse(0, -H + 2, rim * 0.85, rim * 0.22, 0, 0, TAU);
  ctx.fill();
  // fumée qui monte du cratère
  for (let i = 0; i < 7; i++) {
    const u = (t * 0.12 + i / 7) % 1, sx = (Math.sin(i * 2.3 + t * 0.3) * 40 + u * 90) * k, sy = -H - 30 - u * 520 * k, sr = (50 + u * 150) * k;
    ctx.fillStyle = `rgba(70,64,60,${0.38 * (1 - u)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, TAU);
    ctx.fill();
  }
  // la bouche, au pied (devant)
  const my = RY + 60 - 60; // juste au-dessus de son point d'entrée (map.volcanoMouth, à RY + 60)
  ctx.fillStyle = '#241812';
  ctx.beginPath();
  ctx.moveTo(-120, my + 40);
  ctx.quadraticCurveTo(-130, my - 120, 0, my - 150);
  ctx.quadraticCurveTo(130, my - 120, 120, my + 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0A0604';
  ctx.beginPath();
  ctx.moveTo(-74, my + 36);
  ctx.quadraticCurveTo(-82, my - 92, 0, my - 108);
  ctx.quadraticCurveTo(82, my - 92, 74, my + 36);
  ctx.closePath();
  ctx.fill();
  if (open) {
    const glow = ctx.createRadialGradient(0, my - 10, 6, 0, my - 10, 110);
    glow.addColorStop(0, `rgba(255,170,80,${0.75 * pulse})`);
    glow.addColorStop(1, 'rgba(232,105,63,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, my - 10, 110, 0, TAU);
    ctx.fill();
  } else {
    // croûte d'obsidienne : la bouche est scellée, des fissures à peine rougeoyantes
    ctx.fillStyle = '#17121A';
    ctx.beginPath();
    ctx.moveTo(-70, my + 34);
    ctx.quadraticCurveTo(-78, my - 88, 0, my - 104);
    ctx.quadraticCurveTo(78, my - 88, 70, my + 34);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(232,105,63,${0.35 + 0.2 * Math.sin(t * 2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, my + 30);
    ctx.lineTo(-12, my - 30);
    ctx.lineTo(-30, my - 70);
    ctx.moveTo(-12, my - 30);
    ctx.lineTo(26, my - 52);
    ctx.lineTo(44, my + 20);
    ctx.stroke();
  }
  // colonnes de basalte de part et d'autre
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#2C221E';
    ctx.fillRect(sx * 150 - 16, my - 70, 32, 110);
    ctx.fillStyle = '#3E302A';
    ctx.fillRect(sx * 150 - 20, my - 78, 40, 12);
  }
  label(ctx, open ? 'Bouche du volcan' : 'Bouche du volcan · scellée', 0, my - 172, open ? '#FF9B78' : '#C9CFC2');
  ctx.restore();
}

/**
 * Les entrailles du volcan (dessinées à chaque image : la lave bouge) : paroi irrégulière, sol de basalte fissuré
 * de lave, mares de lave, la sortie et, au centre, l'autel du cœur et ses sceaux (une flamme par géant encore debout).
 * sealed[i] : le géant de l'antre i n'est pas encore vaincu. taken : le cœur a déjà été emporté.
 */
export function drawDepths(ctx: Ctx, map: WorldMap, t: number, sealed: boolean[], taken: boolean) {
  const c = map.depths, { x: cx, y: cy } = c.inside;
  ctx.save();
  ctx.translate(cx, cy);
  const outline = (k: number, jag = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * TAU, e = caveEdge(c, a) * k + (jag ? (hash2(i, 7, map.seed + 5) - 0.5) * jag : 0);
      const px = Math.cos(a) * HALL_RX * e, py = Math.sin(a) * HALL_RY * e;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  ctx.fillStyle = '#0E0907';
  ctx.fillRect(-HALL_RX * 1.6, -HALL_RY * 1.6, HALL_RX * 3.2, HALL_RY * 3.2);
  ctx.fillStyle = '#2A1A14';
  outline(1.14, 0.04);
  ctx.fill();
  ctx.fillStyle = '#3A2620';
  outline(1.05, 0.03);
  ctx.fill();
  const floor = ctx.createRadialGradient(0, 0, 60, 0, 0, HALL_RX);
  floor.addColorStop(0, '#5A3424');
  floor.addColorStop(0.6, '#3A2620');
  floor.addColorStop(1, '#22160F');
  ctx.fillStyle = floor;
  outline(1);
  ctx.fill();
  // fissures de lave dans le sol
  const pulse = 0.6 + 0.4 * Math.sin(t * 1.4);
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const a = hash2(i, 1, map.seed) * TAU, k = 0.15 + hash2(i, 2, map.seed) * 0.75;
    let px = Math.cos(a) * HALL_RX * k, py = Math.sin(a) * HALL_RY * k;
    ctx.strokeStyle = `rgba(240,110,50,${0.35 + 0.3 * pulse * hash2(i, 3, map.seed)})`;
    ctx.lineWidth = 2 + hash2(i, 4, map.seed) * 3;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let s = 0; s < 4; s++) {
      px += (hash2(i, 10 + s, map.seed) - 0.5) * 90;
      py += (hash2(i, 20 + s, map.seed) - 0.5) * 60;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  // orgues de basalte le long de la paroi
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + hash2(i, 5, map.seed) * 0.15, k = 0.93 * caveEdge(c, a);
    const px = Math.cos(a) * HALL_RX * k, py = Math.sin(a) * HALL_RY * k;
    if (py > HALL_RY - 260 && Math.abs(px) < 200) continue; // la sortie reste dégagée
    for (let j = 0; j < 3; j++) {
      const h = 40 + hash2(i, 30 + j, map.seed) * 50;
      ctx.fillStyle = j % 2 ? '#2C201C' : '#3C2C26';
      ctx.fillRect(px + (j - 1) * 16 - 7, py - h, 14, h + 6);
    }
  }
  // mares de lave
  for (const [k, p] of map.lavaPools.entries()) {
    const x = p.x - cx, y = p.y - cy;
    ctx.fillStyle = '#1E120E';
    ctx.beginPath();
    ctx.ellipse(x, y, p.r + 16, p.r * 0.78 + 12, 0, 0, TAU);
    ctx.fill();
    const lv = ctx.createRadialGradient(x, y, 4, x, y, p.r);
    lv.addColorStop(0, '#FFE08A');
    lv.addColorStop(0.45, '#F08A3A');
    lv.addColorStop(1, '#9A2E12');
    ctx.fillStyle = lv;
    ctx.beginPath();
    ctx.ellipse(x, y, p.r, p.r * 0.78, 0, 0, TAU);
    ctx.fill();
    for (let b = 0; b < 3; b++) {
      const u = (t * 0.5 + b / 3 + k * 0.17) % 1, bx = x + Math.cos(b * 2.1 + k) * p.r * 0.5, by = y + Math.sin(b * 2.1 + k) * p.r * 0.35;
      ctx.strokeStyle = `rgba(255,236,170,${0.7 * (1 - u)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, 4 + u * 14, 0, TAU);
      ctx.stroke();
    }
  }
  // la sortie : un rai de lumière du jour
  const ex = c.exit.x - cx, ey = c.exit.y - cy;
  const day = ctx.createRadialGradient(ex, ey + 30, 10, ex, ey + 30, 140);
  day.addColorStop(0, 'rgba(240,226,180,0.5)');
  day.addColorStop(1, 'rgba(240,226,180,0)');
  ctx.fillStyle = day;
  ctx.beginPath();
  ctx.arc(ex, ey + 30, 140, 0, TAU);
  ctx.fill();
  label(ctx, 'Sortie', ex, ey + 56, '#EEE7D7');
  drawAltar(ctx, map, t, sealed, taken);
  ctx.restore();
}

/** L'autel du cœur, au centre de la salle (coordonnées relatives à son centre). */
function drawAltar(ctx: Ctx, map: WorldMap, t: number, sealed: boolean[], taken: boolean) {
  // dalle hexagonale et ses marches
  for (const [r, col] of [[120, '#2A1E1A'], [92, '#44342C'], [62, '#55423A']] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos((k / 6) * TAU) * r, Math.sin((k / 6) * TAU) * r * 0.62 + 10);
    ctx.closePath();
    ctx.fill();
  }
  // les sceaux : une vasque par géant du volcan, du côté de son antre ; la flamme brûle tant qu'il est debout
  // (à gauche, devant et à droite de la dalle, dans l'ordre des antres de gauche à droite : rien ne cache le cœur)
  const lairs = map.caves.filter((c) => c.zone === map.depths.zone);
  const order = lairs.map((c, i) => i).sort((a, b) => lairs[a].entrance.x - lairs[b].entrance.x);
  const spots = lairs.length === 3 ? [[-150, 10], [0, 78], [150, 10]] : lairs.map((_, k) => [Math.cos(Math.PI * (1 - k / Math.max(1, lairs.length - 1))) * 150, 40]);
  lairs.forEach((c, i) => {
    const [x, y] = spots[order.indexOf(i)];
    ctx.fillStyle = '#2C221E';
    ctx.fillRect(x - 10, y - 26, 20, 30);
    ctx.fillStyle = '#4A3A32';
    ctx.fillRect(x - 16, y - 32, 32, 8);
    if (sealed[i]) {
      const f = 1 + Math.sin(t * 10 + i) * 0.12;
      ctx.fillStyle = '#E8693F';
      ctx.beginPath();
      ctx.ellipse(x, y - 44 * f, 10, 16 * f, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFD27A';
      ctx.beginPath();
      ctx.ellipse(x, y - 40 * f, 5, 8 * f, 0, 0, TAU);
      ctx.fill();
    } else {
      // éteinte : un filet de fumée
      for (let k = 0; k < 3; k++) {
        const u = (t * 0.4 + k / 3) % 1;
        ctx.fillStyle = `rgba(120,112,104,${0.4 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(u * 6 + i) * 5, y - 36 - u * 50, 5 + u * 8, 0, TAU);
        ctx.fill();
      }
    }
  });
  const free = sealed.every((s) => !s);
  // colonne de l'autel
  ctx.fillStyle = '#2C221E';
  ctx.fillRect(-22, -40, 44, 50);
  ctx.fillStyle = '#4A3A32';
  ctx.fillRect(-30, -48, 60, 10);
  if (!taken) {
    // le cœur : un cristal de magma qui bat ; tant qu'il est scellé, une gangue de roche le retient
    const beat = 1 + Math.max(0, Math.sin(t * 3.2)) ** 6 * 0.18;
    const glow = ctx.createRadialGradient(0, -86, 4, 0, -86, 90 * beat);
    glow.addColorStop(0, free ? 'rgba(255,190,110,0.85)' : 'rgba(232,105,63,0.45)');
    glow.addColorStop(1, 'rgba(232,105,63,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -86, 90 * beat, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.translate(0, -86);
    ctx.scale(beat * 1.5, beat * 1.5);
    ctx.fillStyle = '#B8321E';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(18, -8);
    ctx.lineTo(12, 22);
    ctx.lineTo(-12, 22);
    ctx.lineTo(-18, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FF8A3D';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(10, -6);
    ctx.lineTo(6, 14);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFE3A0';
    ctx.fillRect(-2, -14, 5, 9);
    ctx.restore();
    if (!free) {
      // gangue de roche : des éclats de basalte refermés sur le cœur
      for (const [sx, sy, rot] of [[-30, -70, -0.5], [30, -70, 0.5], [-24, -112, 0.6], [24, -112, -0.6], [0, -126, 0]] as const) {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = '#2A201C';
        ctx.beginPath();
        ctx.moveTo(-12, 14);
        ctx.lineTo(-6, -16);
        ctx.lineTo(8, -12);
        ctx.lineTo(13, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  const left = sealed.filter(Boolean).length;
  label(ctx, taken ? 'Autel du cœur · vide' : free ? 'Cœur volcanique' : `Cœur volcanique · scellé (${left} géant${left > 1 ? 's' : ''})`, 0, -150, free && !taken ? '#FFD27A' : '#C9CFC2');
}

/** Le cœur volcanique installé dans le bateau : il bat au milieu de la coque, et sa lueur se voit de loin. */
export function drawBoatHeart(ctx: Ctx, x: number, y: number, t: number) {
  const beat = 1 + Math.max(0, Math.sin(t * 3.2)) ** 6 * 0.2;
  const glow = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 110 * beat);
  glow.addColorStop(0, 'rgba(255,190,110,0.7)');
  glow.addColorStop(1, 'rgba(232,105,63,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 20, 110 * beat, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 24);
  ctx.scale(beat, beat);
  ctx.fillStyle = '#B8321E';
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(12, -5);
  ctx.lineTo(8, 15);
  ctx.lineTo(-8, 15);
  ctx.lineTo(-12, -5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FF8A3D';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(7, -4);
  ctx.lineTo(4, 9);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
