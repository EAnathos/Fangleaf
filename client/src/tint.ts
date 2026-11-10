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

/** Valeur d'un argument de filtre : « 1.5 », « 150% » ou « 220deg » (les degrés sont rendus tels quels). */
const num = (s: string) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

function stepOf(name: string, arg: string): Step | null {
  const a = num(arg || '1');
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

interface Tint { steps: Step[]; colors: Map<string, string> }
const tints = new Map<string, Tint>();
function tintOf(filter: string): Tint {
  let t = tints.get(filter);
  if (!t) {
    const steps: Step[] = [];
    for (const [, name, arg] of filter.matchAll(/([a-z-]+)\(([^)]*)\)/g)) {
      const s = stepOf(name, arg.trim());
      if (s) steps.push(s);
    }
    tints.set(filter, (t = { steps, colors: new Map() }));
  }
  return t;
}

let scratch: CanvasRenderingContext2D | null = null;
const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i;

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
  scratch.fillStyle = '#000';
  scratch.fillStyle = css; // une couleur invalide laisse noir : on la distingue ci-dessous
  const norm = scratch.fillStyle as string;
  if (norm === '#000000' && !/^(black|#0{3,6}|rgba?\(\s*0\s*,\s*0\s*,\s*0)/i.test(css.trim())) return null;
  return norm === css ? null : parse(norm); // le canvas rend « #rrggbb » ou « rgba(r, g, b, a) » : repasse par les deux cas rapides
}

/** Couleur d'une robe : la couleur d'origine passée dans la chaîne de filtres (mémorisée). */
export function tintColor(css: string, filter: string): string {
  const t = tintOf(filter);
  let out = t.colors.get(css);
  if (out !== undefined) return out;
  const p = parse(css);
  if (!p || !t.steps.length) out = css;
  else {
    let c: Rgb = [p[0], p[1], p[2]];
    for (const s of t.steps) c = s(c);
    out = `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${p[3]})`;
  }
  if (t.colors.size > 4000) t.colors.clear();
  t.colors.set(css, out);
  return out;
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const COLOR_PROPS = ['fillStyle', 'strokeStyle', 'shadowColor'] as const;
const GRADIENTS = ['createLinearGradient', 'createRadialGradient', 'createConicGradient'] as const;
const descs = new Map<object, Map<string, PropertyDescriptor>>();
function protoDescs(ctx: Ctx) {
  const proto = Object.getPrototypeOf(ctx) as object;
  let d = descs.get(proto);
  if (!d) {
    d = new Map();
    for (const k of COLOR_PROPS) d.set(k, Object.getOwnPropertyDescriptor(proto, k)!);
    descs.set(proto, d);
  }
  return d;
}

/**
 * Exécute `draw` avec la robe `filter` : les couleurs choisies pendant le dessin (texte de style, dégradés compris) sont
 * celles de la robe. Rien ne reste sur le contexte après coup, même si `draw` lève une exception.
 */
export function withTint(ctx: Ctx, filter: string, draw: () => void) {
  const d = protoDescs(ctx);
  const map = (v: unknown) => (typeof v === 'string' ? tintColor(v, filter) : v);
  for (const k of COLOR_PROPS) {
    const base = d.get(k)!;
    Object.defineProperty(ctx, k, { configurable: true, get: () => base.get!.call(ctx), set: (v) => base.set!.call(ctx, map(v)) });
  }
  const proto = Object.getPrototypeOf(ctx) as Record<string, (...a: number[]) => CanvasGradient>;
  for (const k of GRADIENTS) {
    const make = proto[k];
    if (typeof make !== 'function') continue;
    Object.defineProperty(ctx, k, {
      configurable: true,
      value: (...a: number[]) => {
        const g = make.apply(ctx, a);
        const add = g.addColorStop.bind(g);
        g.addColorStop = (offset: number, color: string) => add(offset, tintColor(color, filter));
        return g;
      },
    });
  }
  try {
    draw();
  } finally {
    for (const k of COLOR_PROPS) delete (ctx as unknown as Record<string, unknown>)[k];
    for (const k of GRADIENTS) delete (ctx as unknown as Record<string, unknown>)[k];
  }
}

/** Fonctions d'un filtre CSS que ce module ne sait pas appliquer (vide si tout est géré : voir tests/rules/tint.test.ts). */
export function unsupportedFilterFunctions(filter: string): string[] {
  return [...filter.matchAll(/([a-z-]+)\(([^)]*)\)/g)].filter(([, name, arg]) => !stepOf(name, arg.trim())).map(([, name]) => name);
}
