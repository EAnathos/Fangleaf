// Le volcan de la Mer de sable (sur la carte) et ses entrailles (la salle de lave, hors du monde) : le cœur volcanique
// sur son autel, scellé par une flamme par géant du volcan encore debout.

import { CORRIDOR_R, DOOR_T, GEYSER_R, PLATE_R, VENT_R, VOLCANO_R, VOLCANO_RY } from '../../shared/config.ts';
import { hash2 } from '../../shared/math.ts';
import { type Door, type Room, type WorldMap } from '../../shared/worldmap.ts';

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
 * Les entrailles du volcan, un donjon (dessiné à chaque image : la lave bouge, les pièges s'animent ; seulement ce qui
 * est à l'écran) : roche sombre, salles de basalte fissuré de lave reliées par des couloirs, mares de lave, évents de
 * flammes et dalles piégées, la sortie et, au centre, l'autel du cœur et ses sceaux (une flamme par géant encore debout).
 * sealed[i] : le géant de l'antre i n'est pas encore vaincu. taken : le cœur a déjà été emporté.
 * traps : état des pièges proches ([index, état]…, voir le snapshot). view : le rectangle visible.
 * unlocked : grottes débloquées par le village (la herse d'un antre ne se lève qu'une fois son entrée payée).
 */
export function drawDepths(ctx: Ctx, map: WorldMap, t: number, sealed: boolean[], taken: boolean, traps: number[], view: { x0: number; y0: number; x1: number; y1: number }, unlocked: number[] = []) {
  const c = map.depths, { x: cx, y: cy } = c.inside;
  const seen = (x: number, y: number, m: number) => x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m;
  ctx.fillStyle = '#0E0907';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  const rooms = map.rooms.map((r, k) => ({ r, k })).filter(({ r }) => seen(r.x, r.y, Math.max(r.rx, r.ry) + 60));
  const links = map.links.filter(([a, b]) => {
    const A = map.rooms[a], B = map.rooms[b];
    return Math.min(A.x, B.x) < view.x1 + 200 && Math.max(A.x, B.x) > view.x0 - 200 && Math.min(A.y, B.y) < view.y1 + 200 && Math.max(A.y, B.y) > view.y0 - 200;
  });
  const roomPath = (r: Room, k: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU, e = map.roomEdge(r, a) * k;
      const px = r.x + Math.cos(a) * r.rx * e + (k > 1 ? Math.cos(a) * 14 : 0), py = r.y + Math.sin(a) * r.ry * e + (k > 1 ? Math.sin(a) * 14 : 0);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  };
  const corridors = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of links) {
      ctx.moveTo(map.rooms[a].x, map.rooms[a].y);
      ctx.lineTo(map.rooms[b].x, map.rooms[b].y);
    }
    ctx.stroke();
  };
  // la paroi (deux tons), puis le sol des couloirs et des salles
  corridors((CORRIDOR_R + 26) * 2, '#2A1A14');
  ctx.fillStyle = '#2A1A14';
  for (const { r } of rooms) {
    roomPath(r, 1.06);
    ctx.fill();
  }
  corridors((CORRIDOR_R + 10) * 2, '#3A2620');
  ctx.fillStyle = '#3A2620';
  for (const { r } of rooms) {
    roomPath(r, 1.02);
    ctx.fill();
  }
  corridors(CORRIDOR_R * 2, '#33211A');
  for (const { r } of rooms) {
    const floor = ctx.createRadialGradient(r.x, r.y, 30, r.x, r.y, Math.max(r.rx, r.ry));
    floor.addColorStop(0, r.kind === 'heart' ? '#5E3624' : '#4A2E22');
    floor.addColorStop(1, '#2A1A13');
    ctx.fillStyle = floor;
    roomPath(r, 1);
    ctx.fill();
  }
  // fissures de lave dans le sol des salles
  const pulse = 0.6 + 0.4 * Math.sin(t * 1.4);
  ctx.lineCap = 'round';
  for (const { r, k } of rooms) {
    for (let i = 0; i < 7; i++) {
      const a = hash2(i, k, map.seed) * TAU, f = 0.15 + hash2(i, k + 50, map.seed) * 0.55;
      let px = r.x + Math.cos(a) * r.rx * f, py = r.y + Math.sin(a) * r.ry * f;
      ctx.strokeStyle = `rgba(240,110,50,${0.3 + 0.3 * pulse * hash2(i, k + 90, map.seed)})`;
      ctx.lineWidth = 2 + hash2(i, k + 130, map.seed) * 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s2 = 0; s2 < 3; s2++) {
        px += (hash2(i, k * 7 + s2, map.seed + 3) - 0.5) * 80;
        py += (hash2(i, k * 7 + s2, map.seed + 4) - 0.5) * 55;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // orgues de basalte le long de la paroi (pas devant les couloirs)
    const doors = map.links.filter(([a, b]) => a === k || b === k).map(([a, b]) => {
      const o = map.rooms[a === k ? b : a];
      return Math.atan2((o.y - r.y) / r.ry, (o.x - r.x) / r.rx);
    });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + hash2(i, k, map.seed + 7) * 0.2;
      if (doors.some((d) => Math.abs(Math.atan2(Math.sin(a - d), Math.cos(a - d))) < 0.55)) continue;
      if (r.kind === 'entry' && Math.sin(a) > 0.5) continue; // la sortie reste dégagée
      const e = map.roomEdge(r, a) * 0.95, px = r.x + Math.cos(a) * r.rx * e, py = r.y + Math.sin(a) * r.ry * e;
      for (let j = 0; j < 3; j++) {
        const hh = 34 + hash2(i, 30 + j + k, map.seed) * 44;
        ctx.fillStyle = j % 2 ? '#2C201C' : '#3C2C26';
        ctx.fillRect(px + (j - 1) * 14 - 6, py - hh, 12, hh + 6);
      }
    }
  }
  // mares de lave
  for (const [k, p] of map.lavaPools.entries()) {
    if (!seen(p.x, p.y, p.r + 30)) continue;
    const { x, y } = p;
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
  // les pièges
  const state = new Map<number, number>();
  for (let i = 0; i + 1 < traps.length; i += 2) state.set(traps[i], traps[i + 1]);
  map.traps.forEach((tr, i) => {
    if (!seen(tr.x, tr.y, VENT_R + 40)) return;
    const st = state.get(i) ?? 0;
    if (tr.kind === 'vent') drawVent(ctx, tr.x, tr.y, st, t, i);
    else drawPlate(ctx, tr.x, tr.y, st, t);
  });
  // les herses, en travers des couloirs
  map.doors.forEach((d, i) => {
    if (seen(d.x, d.y, CORRIDOR_R + 60)) drawDoor(ctx, d, !!map.doorShut[i], d.lair >= 0 && !unlocked.includes(d.lair), t);
  });
  // la sortie : un rai de lumière du jour
  const ex = c.exit.x, ey = c.exit.y;
  if (seen(ex, ey, 200)) {
    const day = ctx.createRadialGradient(ex, ey + 30, 10, ex, ey + 30, 140);
    day.addColorStop(0, 'rgba(240,226,180,0.5)');
    day.addColorStop(1, 'rgba(240,226,180,0)');
    ctx.fillStyle = day;
    ctx.beginPath();
    ctx.arc(ex, ey + 30, 140, 0, TAU);
    ctx.fill();
    label(ctx, 'Sortie', ex, ey + 56, '#EEE7D7');
  }
  if (seen(cx, cy, 300)) {
    ctx.save();
    ctx.translate(cx, cy);
    drawAltar(ctx, map, t, sealed, taken);
    ctx.restore();
  }
}

/**
 * Herse de basalte en travers d'un couloir : baissée, des barreaux sombres veinés de lave ; levée, il n'en reste que les
 * deux montants contre la paroi. Celle d'un antre pas encore payé porte un sceau d'or (on paie l'entrée devant).
 */
function drawDoor(ctx: Ctx, d: Door, shut: boolean, paid: boolean, t: number) {
  const w = CORRIDOR_R + 14, px = d.uy, py = -d.ux; // en travers du couloir
  ctx.save();
  ctx.translate(d.x, d.y);
  // les deux montants, contre la paroi
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#2A1E1A';
    ctx.beginPath();
    ctx.arc(px * w * s, py * w * s, 15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4A3A32';
    ctx.beginPath();
    ctx.arc(px * w * s, py * w * s - 4, 11, 0, TAU);
    ctx.fill();
  }
  if (shut) {
    const glow = 0.55 + 0.45 * Math.sin(t * 2.2 + d.x * 0.01);
    ctx.lineCap = 'round';
    const bars = 7;
    for (let k = 0; k < bars; k++) {
      const f = ((k + 0.5) / bars) * 2 - 1, bx = px * w * f, by = py * w * f;
      ctx.strokeStyle = '#1C1412';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(bx - d.ux * DOOR_T, by - d.uy * DOOR_T - 34);
      ctx.lineTo(bx + d.ux * DOOR_T, by + d.uy * DOOR_T + 4);
      ctx.stroke();
      ctx.strokeStyle = `rgba(240,120,50,${0.35 + 0.4 * glow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx - d.ux * DOOR_T * 0.6, by - d.uy * DOOR_T * 0.6 - 26);
      ctx.lineTo(bx + d.ux * DOOR_T * 0.6, by + d.uy * DOOR_T * 0.6);
      ctx.stroke();
    }
    // la traverse
    ctx.strokeStyle = '#3A2A24';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-px * w, -py * w - 22);
    ctx.lineTo(px * w, py * w - 22);
    ctx.stroke();
    if (paid) {
      // le sceau d'or d'un antre : on paie l'entrée pour lever la herse
      ctx.fillStyle = '#F0B64A';
      ctx.strokeStyle = '#5A3A10';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -22, 14, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5A3A10';
      ctx.fillRect(-4, -26, 8, 10);
      ctx.beginPath();
      ctx.arc(0, -27, 4, Math.PI, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Évent de flammes, en travers d'un couloir : une grille de fer ; il rougeoit (st 1), puis crache une colonne de feu (st 2). */
function drawVent(ctx: Ctx, x: number, y: number, st: number, t: number, seed: number) {
  ctx.fillStyle = '#1A1210';
  ctx.beginPath();
  ctx.ellipse(x, y, 40, 28, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = st ? '#C8582A' : '#4A3A32';
  ctx.lineWidth = 4;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + k * 13, y - 22 + Math.abs(k) * 3);
    ctx.lineTo(x + k * 13, y + 22 - Math.abs(k) * 3);
    ctx.stroke();
  }
  if (st === 1) {
    // il va cracher : la zone rougeoit
    ctx.strokeStyle = `rgba(255,120,60,${0.5 + 0.4 * Math.sin(t * 20)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(x, y, VENT_R, VENT_R * 0.7, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (st === 2) {
    const g = ctx.createRadialGradient(x, y, 6, x, y, VENT_R);
    g.addColorStop(0, 'rgba(255,236,160,0.95)');
    g.addColorStop(0.5, 'rgba(255,130,50,0.75)');
    g.addColorStop(1, 'rgba(200,50,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, VENT_R, VENT_R * 0.7, 0, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 9; k++) {
      const u = (t * 2.4 + k / 9 + seed * 0.13) % 1, a = k * 2.4 + seed, d = (hash2(k, seed, 9) * 0.8) * VENT_R * 0.6;
      ctx.fillStyle = `rgba(255,${150 + Math.round(90 * (1 - u))},70,${0.85 * (1 - u)})`;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - u * 110, 12 * (1 - u) + 4, 20 * (1 - u) + 6, 0, 0, TAU);
      ctx.fill();
    }
  }
}

/** Dalle piégée : une dalle gravée d'une rune, un peu disjointe ; foulée, la rune s'allume (st 1 : le geyser arrive), puis reste enfoncée (st 2). */
function drawPlate(ctx: Ctx, x: number, y: number, st: number, t: number) {
  const s = PLATE_R;
  ctx.fillStyle = st === 2 ? '#2E201A' : '#4C3A30';
  ctx.strokeStyle = '#22160F';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * 0.6);
  ctx.lineTo(x + s, y - s * 0.6);
  ctx.lineTo(x + s * 0.9, y + s * 0.6);
  ctx.lineTo(x - s * 0.9, y + s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = st === 1 ? `rgba(255,170,80,${0.7 + 0.3 * Math.sin(t * 24)})` : 'rgba(120,90,70,0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, s * 0.35, 0, TAU);
  ctx.moveTo(x, y - s * 0.5);
  ctx.lineTo(x, y + s * 0.5);
  ctx.stroke();
  if (st === 1) {
    ctx.fillStyle = `rgba(255,90,40,${0.18 + 0.12 * Math.sin(t * 24)})`;
    ctx.strokeStyle = 'rgba(255,120,60,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, GEYSER_R, GEYSER_R * 0.72, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

/** L'autel du cœur, au centre de sa salle (coordonnées relatives à son centre). */
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
