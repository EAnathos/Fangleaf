// Premier réveil sur l'île : le noir, des sensations confuses, des paupières qui papillonnent, puis la plage
// qui se fait nette. Canvas 2D par-dessus le jeu, qui tourne déjà derrière (flou, rapproché, délavé).
// Rien n'explique ce qu'on fait là. Un toucher ou une touche abrège l'animation.

import { sound } from './audio.ts';

const LINES: { text: string; from: number; to: number; low?: boolean }[] = [
  { text: 'J\'ai chaud…', from: 1.1, to: 3.5 },
  { text: 'Un grondement. Il s\'en va… et il revient.', from: 3.8, to: 6.6 },
  { text: 'Où suis-je ?', from: 10.4, to: 13.2, low: true }, // les yeux ouverts : en bas, sur la plage
];
const END = 13.8;
const CHAR_DELAY = 0.045; // apparition des lettres, une à une
const SKIP_FADE = 0.55;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const u = clamp01(v);
  return u * u * (3 - 2 * u);
};
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 3;

/** Ouverture des yeux (0 : fermés, 1 : grands ouverts) : deux battements de paupières, puis on les ouvre pour de bon. */
function openness(t: number) {
  const blink = (t0: number, peak: number, dur: number) => {
    const k = (t - t0) / dur;
    return k <= 0 || k >= 1 ? 0 : peak * Math.sin(k * Math.PI) ** 0.7;
  };
  return Math.max(blink(6.6, 0.18, 0.7), blink(7.5, 0.45, 0.8), smooth((t - 8.5) / 1.7));
}

/** Contour d'un œil (deux arcs) de demi-largeur w et de demi-hauteur h, centré en (cx, cy). */
function eye(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(cx - w, cy);
  ctx.quadraticCurveTo(cx, cy - 2 * h, cx + w, cy);
  ctx.quadraticCurveTo(cx, cy + 2 * h, cx - w, cy);
  ctx.closePath();
}

/** Joue le réveil par-dessus le canvas du jeu, puis appelle done. */
export function playWakeUp(game: HTMLCanvasElement, done: () => void) {
  const c = document.createElement('canvas');
  c.className = 'intro';
  c.setAttribute('aria-hidden', 'true');
  document.body.append(c);
  document.body.classList.add('waking');
  const ctx = c.getContext('2d')!;
  const font = getComputedStyle(document.body).getPropertyValue('--display').trim() || 'serif';
  let W = 0, H = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    [W, H] = [innerWidth, innerHeight];
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
  };
  resize();
  addEventListener('resize', resize);

  const start = performance.now();
  let skipAt = -1, chimed = false, raf = 0;
  const skip = () => {
    const t = (performance.now() - start) / 1000;
    if (skipAt < 0 && t > 0.8) skipAt = t;
  };
  addEventListener('pointerdown', skip);
  addEventListener('keydown', skip);

  const finish = () => {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    removeEventListener('pointerdown', skip);
    removeEventListener('keydown', skip);
    game.style.filter = game.style.transform = '';
    c.remove();
    document.body.classList.remove('waking');
    done();
  };

  const frame = () => {
    const t = (performance.now() - start) / 1000;
    const fade = skipAt < 0 ? 1 : 1 - (t - skipAt) / SKIP_FADE; // tout s'efface d'un coup si on abrège
    if (t >= END || fade <= 0) return finish();
    raf = requestAnimationFrame(frame);

    // Le jeu derrière : flou, rapproché, penché et délavé, puis net à mesure que le regard se pose.
    const open = skipAt < 0 ? openness(t) : 1 - fade * (1 - openness(t));
    const focus = skipAt < 0 ? easeOut((t - 8.6) / 3) : 1 - fade * (1 - easeOut((t - 8.6) / 3));
    const blur = (1 - focus) * 14 + (1 - open) * 6;
    game.style.filter = `blur(${blur.toFixed(1)}px) saturate(${(0.35 + 0.65 * focus).toFixed(2)}) brightness(${(1.25 - 0.25 * focus).toFixed(2)})`;
    game.style.transform = `scale(${(1 + 0.32 * (1 - focus)).toFixed(3)}) rotate(${(-4 * (1 - focus)).toFixed(2)}deg)`;
    if (!chimed && t > 8.9) {
      chimed = true;
      sound.play('chime', 0.35);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = clamp01(fade);
    const cx = W / 2, cy = H * 0.47;

    // Paupières : le noir, chaud quand la lumière passe au travers, percé d'un œil au bord doux.
    if (open < 0.999) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#050302';
      ctx.fillRect(0, 0, W, H);
      const glow = clamp01((t - 1.5) / 5) * (0.55 + 0.25 * Math.sin(t * 1.4)) * (1 - open);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      g.addColorStop(0, `rgba(150,52,30,${0.55 * glow})`);
      g.addColorStop(0.5, `rgba(80,22,14,${0.35 * glow})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      if (open > 0.001) {
        // l'ouverture, en couches de plus en plus franches vers le centre : un bord flou, pas un trait
        ctx.globalCompositeOperation = 'destination-out';
        const w = W * 0.75, h = open * H * 0.62;
        for (let i = 0; i < 10; i++) {
          ctx.globalAlpha = 0.22 * clamp01(fade);
          eye(ctx, cx, cy, w * (1.12 - i * 0.045), h * (1.1 - i * 0.06));
          ctx.fill();
        }
        ctx.globalAlpha = clamp01(fade);
        eye(ctx, cx, cy, w * 0.6, h * 0.45);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    // Vignette qui se dissipe une fois les yeux ouverts.
    const vig = (1 - smooth((t - 9.2) / 3.2)) * clamp01(fade);
    if (vig > 0.01) {
      const v = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.hypot(W, H) * 0.6);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${0.8 * vig})`);
      ctx.globalAlpha = 1;
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }

    // Les mots, lettre à lettre, qui montent un peu en apparaissant puis s'effacent.
    const size = Math.round(Math.min(34, Math.max(22, W / 26)));
    ctx.font = `italic 600 ${size}px ${font}`;
    ctx.textBaseline = 'middle';
    for (const l of LINES) {
      if (t < l.from || t > l.to) continue;
      const out = 1 - smooth((t - (l.to - 0.7)) / 0.7);
      // coupée en lignes qui tiennent dans l'écran (téléphone en hauteur)
      const rows: string[] = [];
      for (const word of l.text.split(' ')) {
        const last = rows.length ? `${rows[rows.length - 1]} ${word}` : word;
        if (rows.length && ctx.measureText(last).width <= W - 48) rows[rows.length - 1] = last;
        else rows.push(word);
      }
      let n = 0; // rang de la lettre dans la phrase : elles apparaissent à la suite, d'une ligne à l'autre
      rows.forEach((row, r) => {
        const chars = [...row];
        let x = cx - ctx.measureText(row).width / 2;
        const y = (l.low ? H * 0.8 : cy) + (r - (rows.length - 1) / 2) * size * 1.4;
        for (const ch of chars) {
          const k = easeOut((t - l.from - n++ * CHAR_DELAY) / 0.5);
          ctx.globalAlpha = k * out * clamp01(fade);
          ctx.fillStyle = l.low ? '#FFF6E2' : '#E9D9C2';
          if (l.low) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 12;
          }
          ctx.fillText(ch, x, y + (1 - k) * 8);
          ctx.shadowBlur = 0;
          x += ctx.measureText(ch).width;
        }
        n++; // l'espace de la coupure
      });
    }
    // De quoi passer, discrètement.
    if (skipAt < 0 && t > 1.5) {
      ctx.globalAlpha = 0.35 * smooth((t - 1.5) / 1) * (1 - smooth((t - 11) / 1));
      ctx.font = `500 13px ${font}`;
      ctx.fillStyle = '#E9D9C2';
      ctx.textAlign = 'right';
      ctx.fillText('toucher pour passer', W - 20, H - 24);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  };
  raf = requestAnimationFrame(frame);
}
