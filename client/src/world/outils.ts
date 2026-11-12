// Petits outils de dessin partagés par les tuiles de l'île (world.ts), le décor et les bâtiments.

export const DECO_CELL = 96;
export const TAU = Math.PI * 2;

export const rgba = (p: number[], a = p[3]) => `rgba(${p[0]},${p[1]},${p[2]},${a})`;
