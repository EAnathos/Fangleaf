// Ciel du village : jour, nuit et averses découlent de l'heure du serveur et de la graine du village.
// Aucun message réseau : tous les joueurs d'un village voient la même nuit et la même averse au même moment.
// Affichage seulement pour l'instant (les règles du jeu n'en dépendent pas).

import { clamp, hash2 } from './math.ts';

export const DAY_MS = 20 * 60_000; // un cycle jour + nuit
const NIGHT = 0.22; // part de la nuit noire : plus courte que le jour (un peu moins de 4 min 30)
const TWILIGHT = 0.05; // crépuscule et aube, de part et d'autre de la nuit (1 min chacun)
const DAY = 1 - NIGHT - 2 * TWILIGHT;

const RAIN_SLOT = 6 * 60_000; // le temps est tiré au sort par tranches de 6 min…
const RAIN_CHANCE = 0.1; // … une sur dix est pluvieuse : une averse toutes les heures environ
const RAIN_FADE = 50_000; // la pluie arrive et s'en va en 50 s

// Tempêtes de sable (Mer de sable seulement) : tirées au sort à part, un peu plus souvent que la pluie.
const STORM_SLOT = 5 * 60_000;
const STORM_CHANCE = 0.14; // environ une toutes les 35 min
const STORM_FADE = 40_000; // elle se lève et retombe en 40 s

const smooth = (u: number) => u * u * (3 - 2 * u);

export interface Sky {
  light: number; // 1 = plein jour, 0 = nuit noire
  dusk: number; // 0 à 1 : teinte chaude du crépuscule et de l'aube (au milieu de la transition)
  rain: number; // 0 = sec, 1 = grosse averse
  storm: number; // tempête de sable (Mer de sable seulement) : 0 = calme, 1 = en plein dedans
}

/** Force de la pluie d'une tranche (0 si elle est sèche). */
function slotRain(seed: number, k: number) {
  return hash2(k, 7, seed + 91) < RAIN_CHANCE ? 0.6 + hash2(k, 8, seed + 92) * 0.4 : 0;
}

/** Force d'une tempête de sable dans une tranche (0 : calme). */
function slotStorm(seed: number, k: number) {
  return hash2(k, 11, seed + 93) < STORM_CHANCE ? 0.75 + hash2(k, 12, seed + 94) * 0.25 : 0;
}

/** Valeur d'un tirage par tranches, en fondu enchaîné d'une tranche à l'autre (centré sur la frontière). */
function slotted(now: number, len: number, fade: number, at: (k: number) => number) {
  const k = Math.floor(now / len), u = now - k * len, cur = at(k);
  if (u < fade / 2) return at(k - 1) + (cur - at(k - 1)) * smooth(u / fade + 0.5);
  if (u > len - fade / 2) return cur + (at(k + 1) - cur) * smooth((u - len) / fade + 0.5);
  return cur;
}

export function sky(seed: number, now: number): Sky {
  // chaque village a son propre décalage : on n'y fait pas tous nuit en même temps
  const p = (now / DAY_MS + hash2(3, 5, seed + 90)) % 1;
  let light = 1;
  if (p >= DAY && p < DAY + TWILIGHT) light = 1 - smooth((p - DAY) / TWILIGHT);
  else if (p >= DAY + TWILIGHT && p < 1 - TWILIGHT) light = 0;
  else if (p >= 1 - TWILIGHT) light = smooth((p - (1 - TWILIGHT)) / TWILIGHT);
  const dusk = light > 0 && light < 1 ? 1 - Math.abs(light * 2 - 1) : 0;

  const rain = slotted(now, RAIN_SLOT, RAIN_FADE, (k) => slotRain(seed, k));
  const storm = slotted(now, STORM_SLOT, STORM_FADE, (k) => slotStorm(seed, k));
  return { light, dusk, rain: clamp(rain, 0, 1), storm: clamp(storm, 0, 1) };
}
