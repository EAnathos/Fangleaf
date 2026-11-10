// Robe de l'Alpha / du légendaire sans filtre canvas : la chaîne de fonctions CSS (hue-rotate, saturate, brightness, contrast,
// grayscale, sepia) est appliquée à chaque couleur au moment où le dessin la choisit (fillStyle, strokeStyle, shadowColor,
// dégradés), au lieu de filtrer l'image finie. Même résultat à l'œil, sans calque ni ctx.filter (un filtre par monstre et par
// image, qui domine le temps d'une image quand il y a beaucoup d'Alphas à l'écran).

type Rgb = [number, number, number];
type Step = (c: Rgb) => Rgb;

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mat = (m: number[]): Step => ([r, g, b]) => [
  clamp(m[0] * r + m[1] * g + m[2] * b),
  clamp(m[3] * r + m[4] * g + m[5] * b),
  clamp(m[6] * r + m[7] * g + m[8] * b),
];

const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i;

/** Quantité d'un argument de filtre : « 1.5 » ou « 150% » ; vide : 1 ; null si illisible. */
function amount(s: string): number | null {
  if (!s) return 1;
  const m = NUM.exec(s);
  if (!m || (s.length > m[0].length && s.slice(m[0].length) !== '%')) return null;
  return s.endsWith('%') ? parseFloat(m[0]) / 100 : parseFloat(m[0]);
}

/** Angle en degrés : « 220 », « 220deg », « 1.2rad », « 250grad », « 0.5turn » ; vide : 0 ; null si illisible. */
function angle(s: string): number | null {
  if (!s) return 0;
  const m = NUM.exec(s);
  if (!m) return null;
  const v = parseFloat(m[0]), unit = s.slice(m[0].length).toLowerCase();
  switch (unit) {
    case '': case 'deg': return v;
    case 'rad': return (v * 180) / Math.PI;
    case 'grad': return v * 0.9;
    case 'turn': return v * 360;
    default: return null;
  }
}

function stepOf(name: string, arg: string): Step | null {
  const a = name === 'hue-rotate' ? angle(arg) : amount(arg);
  if (a === null) return null; // fonction connue mais argument illisible : « non gérée », pas une valeur devinée
  switch (name) {
    case 'brightness': return ([r, g, b]) => [clamp(r * a), clamp(g * a), clamp(b * a)];
    case 'contrast': return ([r, g, b]) => [clamp((r - 0.5) * a + 0.5), clamp((g - 0.5) * a + 0.5), clamp((b - 0.5) * a + 0.5)];
    case 'saturate': return mat([
      0.213 + 0.787 * a, 0.715 - 0.715 * a, 0.072 - 0.072 * a,
      0.213 - 0.213 * a, 0.715 + 0.285 * a, 0.072 - 0.072 * a,
      0.213 - 0.213 * a, 0.715 - 0.715 * a, 0.072 + 0.928 * a]);
    case 'hue-rotate': {
      const t = (a * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
      return mat([
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]);
    }
    case 'grayscale': {
      const k = 1 - Math.min(1, a);
      return mat([
        0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k,
        0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k]);
    }
    case 'sepia': {
      const k = 1 - Math.min(1, a);
      return mat([
        0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k,
        0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k,
        0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k]);
    }
    default: return null;
  }
}

/** Les fonctions d'une chaîne de filtre CSS, dans l'ordre. */
export function parseFilter(filter: string): { name: string; arg: string }[] {
  return [...filter.matchAll(/([a-z-]+)\(([^)]*)\)/g)].map((m) => ({ name: m[1], arg: m[2].trim() }));
}

interface Tint { steps: Step[]; colors: Map<string, string | null> }
const tints = new Map<string, Tint>();
function tintOf(filter: string): Tint {
  let t = tints.get(filter);
  if (!t) {
    const steps: Step[] = [];
    for (const { name, arg } of parseFilter(filter)) {
      const s = stepOf(name, arg);
      if (s) steps.push(s);
    }
    tints.set(filter, (t = { steps, colors: new Map() }));
  }
  return t;
}

let scratch: CanvasRenderingContext2D | null = null;
const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+(?:e[-+]?\d+)?%?))?\s*\)$/i;

/** Couleur CSS → [r, g, b, a] (r, g, b de 0 à 1) ; null si illisible. Les noms et hsl() passent par un canvas (une fois par couleur). */
function parse(css: string): [number, number, number, number] | null {
  let m = HEX.exec(css);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 6 || h.length === 8) {
      const n = parseInt(h.slice(0, 6), 16);
      return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1];
    }
    return null;
  }
  m = RGB.exec(css);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]];
  if (typeof document === 'undefined') return null;
  scratch ??= document.createElement('canvas').getContext('2d');
  if (!scratch) return null;
  // une couleur illisible est ignorée par le canvas, qui garde la précédente : deux valeurs de départ différentes la révèlent
  // (sans confondre avec un vrai noir)
  scratch.fillStyle = '#010203';
  scratch.fillStyle = css;
  const norm = scratch.fillStyle as string;
  scratch.fillStyle = '#fefdfc';
  scratch.fillStyle = css;
  if (scratch.fillStyle !== norm) return null;
  return norm === css ? null : parse(norm); // le canvas rend « #rrggbb » ou « rgba(r, g, b, a) » : repasse par les deux cas rapides
}

/**
 * Couleur d'une robe : la couleur d'origine passée dans la chaîne de filtres (mémorisée). Pour « rgba(r,g,b,a) » la mémoire
 * est indexée par « r,g,b » seul et l'opacité est recopiée telle quelle : une opacité qui varie d'une image à l'autre
 * (lueurs, pulsations) ne fait pas de nouvelle entrée.
 */
export function tintColor(css: string, filter: string): string {
  const t = tintOf(filter);
  if (css.startsWith('rgba(') && css.endsWith(')')) {
    const i = css.lastIndexOf(',');
    const rgb = css.slice(5, i).trim(), a = css.slice(i + 1, -1).trim();
    if (i > 5 && a && rgb.split(',').length === 3) {
      let o = t.colors.get(rgb);
      if (o === undefined) {
        const p = parse(`rgb(${rgb})`);
        o = p && t.steps.length ? rgbOf(p, t.steps) : null;
        remember(t, rgb, o);
      }
      return o === null ? css : `rgba(${o},${a})`;
    }
  }
  let out = t.colors.get(css);
  if (out !== undefined) return out ?? css;
  const p = parse(css);
  out = p && t.steps.length ? `rgba(${rgbOf(p, t.steps)},${p[3]})` : null;
  remember(t, css, out);
  return out ?? css;
}

/** « r,g,b » (0 à 255) d'une couleur passée dans les étapes du filtre. */
function rgbOf(p: [number, number, number, number], steps: Step[]) {
  let c: Rgb = [p[0], p[1], p[2]];
  for (const s of steps) c = s(c);
  return `${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)}`;
}
function remember(t: Tint, key: string, out: string | null) {
  if (t.colors.size > 4000) t.colors.clear();
  t.colors.set(key, out);
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const COLOR_PROPS = ['fillStyle', 'strokeStyle', 'shadowColor'] as const;
const GRADIENTS = ['createLinearGradient', 'createRadialGradient', 'createConicGradient'] as const;

/** Robe en cours sur un contexte (null : aucune, tout passe tel quel). */
interface State { filter: string | null }
const installed = new WeakMap<object, State | null>();

/**
 * Pose une fois pour toutes, sur le contexte, des accesseurs qui convertissent les couleurs tant qu'une robe est en cours
 * (rien à poser ni à retirer à chaque monstre). null si le navigateur n'expose pas les propriétés attendues : pas de robe.
 * Limite : seules ces propriétés et les dégradés sont convertis (ni motif, ni image) ; et lire fillStyle rend la couleur
 * déjà convertie, qu'un dessin ne doit donc pas réécrire.
 */
function install(ctx: Ctx): State | null {
  const known = installed.get(ctx);
  if (known !== undefined) return known;
  const proto = Object.getPrototypeOf(ctx) as Record<string, unknown>;
  const state: State = { filter: null };
  const base = COLOR_PROPS.map((k) => Object.getOwnPropertyDescriptor(proto, k));
  const makers = GRADIENTS.map((k) => proto[k]);
  if (base.some((d) => !d?.get || !d.set)) {
    installed.set(ctx, null);
    return null;
  }
  COLOR_PROPS.forEach((k, i) => {
    const { get, set } = base[i]!;
    Object.defineProperty(ctx, k, {
      configurable: true,
      get: () => get!.call(ctx),
      set: (v) => set!.call(ctx, state.filter !== null && typeof v === 'string' ? tintColor(v, state.filter) : v),
    });
  });
  GRADIENTS.forEach((k, i) => {
    const make = makers[i] as ((...a: number[]) => CanvasGradient) | undefined;
    if (typeof make !== 'function') return;
    Object.defineProperty(ctx, k, {
      configurable: true,
      value: (...a: number[]) => {
        const g = make.apply(ctx, a), f = state.filter;
        if (f !== null) {
          const add = g.addColorStop.bind(g);
          g.addColorStop = (offset: number, color: string) => add(offset, tintColor(color, f));
        }
        return g;
      },
    });
  });
  installed.set(ctx, state);
  return state;
}

/**
 * Exécute `draw` avec la robe `filter` : les couleurs choisies pendant le dessin (texte de style, dégradés compris) sont
 * celles de la robe. Peut s'imbriquer ; la robe précédente revient après coup, même si `draw` lève une exception.
 */
export function withTint(ctx: Ctx, filter: string, draw: () => void) {
  const state = install(ctx);
  if (!state) return draw();
  const prev = state.filter;
  state.filter = filter;
  try {
    draw();
  } finally {
    state.filter = prev;
  }
}

/** Fonctions d'un filtre CSS que ce module ne sait pas appliquer, ou dont l'argument est illisible (vide si tout est géré : voir tests/rules/tint.test.ts). */
export function unsupportedFilterFunctions(filter: string): string[] {
  return parseFilter(filter).filter(({ name, arg }) => !stepOf(name, arg)).map(({ name }) => name);
}
