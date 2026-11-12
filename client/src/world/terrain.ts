// Couleurs du sol de l'île : herbe de chaque zone, sable, eau des lacs et de la mer, saisons et neige, mélangées
// aux frontières (même calcul pour les tuiles du monde et pour la carte du HUD).

import { JUNGLE_ZONE, DESERT_ZONE, LAKES_ZONE } from '../../../shared/config.ts';
import { fbm } from '../../../shared/math.ts';
import { BEACH, coastGreen, MOUTH_FADE, SEA_SHALLOW, villageEdge, type WorldMap } from '../../../shared/worldmap.ts';
import { AUTUMN, SPRING, SUMMER, WINTER } from '../../../shared/weather.ts';

// Couleur du sol : 0 = village, 1 à 6 = zones de danger. Mer : peu profonde le long de la côte, sombre au large ; plage de sable.
export const SEA_DEEP = [24, 64, 92];
export const SEA_SHALLOW_COL = [52, 138, 156];
const BEACH_SAND = [222, 202, 150];
const FOAM = [226, 240, 236];
export const LAKE_WATER = [61, 127, 140]; // mêmes bleus que l'eau des lacs (#3D7F8C, #2E6574)
export const LAKE_DEEP = [46, 101, 116];
export const LAKE_BANK = [94, 107, 73]; // berge des lacs (#5E6B49)
const MOUTH_SURF = 150; // en mer, l'écume et le sable s'effacent à l'approche d'une embouchure
export const ZONE_GROUND = [[74, 94, 62], [63, 106, 59], [52, 88, 57], [72, 82, 48], [44, 69, 66], [56, 82, 76], [40, 74, 40], [204, 172, 114]]; // 0 village, 1 à 7 les zones (6 : jungle)
const STEPPE = [124, 140, 78]; // lisière verte entre le sable du désert et la mer
const PATH = [110, 97, 66];
const VILLAGE_GROUND = [79, 101, 63]; // herbe de la place, tondue

// Style commun à tous les chemins de terre : liseré sombre, terre, trace claire au centre. [r, g, b, alpha, largeur]
export const PATH_PASSES: [number, number, number, number, number][] = [[60, 50, 32, 0.35, 50], [110, 97, 66, 1, 40], [140, 124, 88, 0.35, 14]];
export const lerp3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Herbe du village fondue dans celle du biome : pleine jusqu'à la palissade, puis s'efface sur VILLAGE_BLEND px.
const VILLAGE_BLEND = 240;

/** Part du village dans le sol d'un point : 1 jusqu'à la palissade, puis 0 au bout du fondu, au bord irrégulier. */
export function villageMix(map: WorldMap, x: number, y: number) {
  const d = Math.hypot(x - map.village.x, y - map.village.y) - villageEdge(Math.atan2(y - map.village.y, x - map.village.x));
  if (d <= 0) return 1;
  if (d >= VILLAGE_BLEND * 1.25) return 0;
  const u = Math.min(1, Math.max(0, d / VILLAGE_BLEND + (fbm(x / 160, y / 160, map.seed + 74, 2) - 0.5) * 0.5));
  return 1 - u * u * (3 - 2 * u);
}

/**
 * Couleur du sol d'un point (hors sous-bois) : celle de sa zone, ou près d'une frontière un fondu entre les deux
 * zones, au bord irrégulier (un peu de bruit sur le mélange). Autour du village, l'herbe du village s'y fond.
 */
export function groundColor(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  let col = ZONE_GROUND[m.z0];
  if (m.t) col = lerp3(col, ZONE_GROUND[m.z1], Math.min(1, Math.max(0, m.t + (fbm(x / 240, y / 240, map.seed + 73, 2) - 0.5) * 0.45)));
  const g = coastGreen(map, x, y);
  if (g) col = lerp3(col, STEPPE, g);
  const v = villageMix(map, x, y);
  if (v) col = lerp3(col, VILLAGE_GROUND, v);
  // sous la canopée de la jungle : de grandes ombres de feuillage, et des taches de soleil là où il perce
  const j = jungleMix(map, x, y);
  if (j) {
    const sh = fbm(x / 210, y / 210, map.seed + 141, 3), k = 1 - j * (0.32 * smooth((sh - 0.35) / 0.3) - 0.14 * smooth((0.3 - sh) / 0.12));
    col = [col[0] * k, col[1] * k, col[2] * k];
  }
  return col;
}

/** Part de jungle en un point (0 ailleurs, 1 en pleine jungle, en fondu à la frontière). */
export function jungleMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === JUNGLE_ZONE ? 1 - m.t : 0) + (m.z1 === JUNGLE_ZONE ? m.t : 0);
}

/** Part de Lacs brumeux en un point (pour la brume légère qui y flotte). */
export function lakesMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === LAKES_ZONE ? 1 - m.t : 0) + (m.z1 === LAKES_ZONE ? m.t : 0);
}

/** Part de Mer de sable en un point (0 ailleurs, 1 en plein désert, en fondu à la frontière). */
export function desertMix(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y);
  return (m.z0 === DESERT_ZONE ? 1 - m.t : 0) + (m.z1 === DESERT_ZONE ? m.t : 0);
}

const smooth = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** En mer, part du rivage (écume, sable) : 1 loin des embouchures, 0 face à l'eau d'un lac qui s'y jette. */
export const surfAt = (map: WorldMap, x: number, y: number) => smooth(map.mouthAt(x, y) / MOUTH_SURF);

/** Dans un lac, part de la mer : 1 à l'embouchure, 0 à MOUTH_FADE (à travers l'eau) et dans les lacs fermés. */
export const mouthMix = (map: WorldMap, x: number, y: number) => 1 - smooth(map.mouthAt(x, y) / MOUTH_FADE);

/** Couleur de la mer : claire le long de la côte, de plus en plus sombre vers le large. */
export function seaColor(map: WorldMap, x: number, y: number, surf = true) {
  const sh = map.shoreAt(x, y), col = lerp3(SEA_SHALLOW_COL, SEA_DEEP, Math.min(1, Math.max(0, sh) / (SEA_SHALLOW + 500)));
  const foam = surf ? Math.max(0, 1 - sh / 70) * surfAt(map, x, y) : 0; // écume au bord, fondue (pas de chapelet de bulles)
  return foam ? lerp3(col, FOAM, foam * foam * 0.75) : col;
}

/**
 * Eau d'un lac (profonde ou non), qui passe au bleu de la mer près d'une embouchure. Dans les Lacs brumeux, les lacs ont
 * le bleu de la mer : leur eau s'y jette de partout, sans frontière entre les deux.
 */
export function lakeColor(map: WorldMap, x: number, y: number, deep: boolean, base = deep ? LAKE_DEEP : LAKE_WATER) {
  const k = Math.max(mouthMix(map, x, y), lakesMix(map, x, y));
  return k ? lerp3(base, SEA_SHALLOW_COL, k) : base;
}

const SNOW = [226, 233, 240];
const AUTUMN_GROUND = [150, 112, 56];
const SPRING_GROUND = [96, 146, 66];

/**
 * Le sol selon la saison (ni le désert ni la jungle n'en changent) : l'automne, l'herbe roussie ; le printemps, un vert
 * plus tendre ; l'été, rien. Par-dessus, la neige (snow, 0 à 1) : elle s'installe par plaques, d'abord dans les creux
 * du bruit, jusqu'à tout couvrir, et fond de même.
 */
function seasonGround(map: WorldMap, col: number[], x: number, y: number, season: number, snow: number) {
  if (season === SUMMER && snow <= 0) return col;
  const k = 1 - Math.max(desertMix(map, x, y), jungleMix(map, x, y) * 0.8);
  if (k <= 0) return col;
  const n = fbm(x / 190, y / 190, map.seed + 201, 3);
  if (season === AUTUMN || season === WINTER) col = lerp3(col, AUTUMN_GROUND, (0.22 + n * 0.3) * k);
  else if (season === SPRING) col = lerp3(col, SPRING_GROUND, (0.12 + n * 0.12) * k);
  if (snow <= 0) return col;
  const cover = smooth(Math.min(1, Math.max(0, (snow * 1.5 - n) / 0.25)));
  return lerp3(col, SNOW, (0.55 + smooth((n - 0.3) / 0.3) * 0.38) * k * cover);
}

/**
 * Couleur d'un point de l'île vu d'en haut : son sol (selon la saison), la plage au bord de la mer, et le relief (versants
 * éclairés au nord-ouest, à l'ombre au sud-est ; sommets un peu plus clairs).
 */
export function landColor(map: WorldMap, x: number, y: number, season = SUMMER, snow = 0) {
  let col = seasonGround(map, groundColor(map, x, y), x, y, season, snow);
  const sh = map.shoreAt(x, y);
  if (sh > -BEACH) col = lerp3(col, BEACH_SAND, Math.min(1, (sh + BEACH) / (BEACH * 0.7)));
  const e = 24, h = map.height(x, y);
  const slope = (map.height(x - e, y - e) - map.height(x + e, y + e)) * 9;
  const k = 1 + Math.max(-0.22, Math.min(0.22, slope)) + (h - 0.5) * 0.08;
  return [col[0] * k, col[1] * k, col[2] * k];
}
