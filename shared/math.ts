export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const dist2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) ** 2 + (ay - by) ** 2;

/**
 * Au plus `cap` éléments de `wanted`, tirés au hasard parmi tous. La sélection est stable : ceux de `current` qui sont encore
 * voulus restent, et seuls les arrivées, départs et dépassements du plafond provoquent un tirage (pas un nouveau à chaque appel).
 */
export function pickCapped(wanted: readonly string[], current: Iterable<string>, cap: number, rand: () => number = Math.random): Set<string> {
  const want = new Set(wanted);
  if (want.size <= cap) return want; // rien à départager : aucun tirage (le hasard du jeu reste celui d'avant)
  const keep = [...current].filter((k) => want.has(k));
  const shuffle = (a: string[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  if (keep.length >= cap) return new Set(keep.length === cap ? keep : shuffle(keep).slice(0, Math.max(0, cap)));
  const kept = new Set(keep);
  return new Set([...keep, ...shuffle(wanted.filter((k) => !kept.has(k))).slice(0, cap - keep.length)]); // want.size > cap : il y a toujours à départager
}

/** PRNG déterministe (mulberry32) : même graine → même carte chez tous les joueurs. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash entier 2D → [0, 1), pour du bruit stable par case. */
export function hash2(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Bruit de valeur 2D lissé, dans [0, 1). */
export function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal (plusieurs octaves de valueNoise), dans [0, 1). */
export function fbm(x: number, y: number, seed: number, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
