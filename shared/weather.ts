// Ciel du village : jour, nuit et averses découlent de l'heure du serveur et de la graine du village.
// Aucun message réseau : tous les joueurs d'un village voient la même nuit et la même averse au même moment.
// La saison aussi (certaines bêtes ne sortent qu'en hiver).

import { clamp, hash2 } from './math.ts';

export const DAY_MS = 14 * 60_000; // un cycle jour + nuit, raccourci de 30 %
const NIGHT = 0.22; // part de la nuit noire : plus courte que le jour (un peu plus de 3 min)
const TWILIGHT = 0.05; // crépuscule et aube, de part et d'autre de la nuit (42 s chacun)
const DAY = 1 - NIGHT - 2 * TWILIGHT;

const RAIN_SLOT = 6 * 60_000; // le temps est tiré au sort par tranches de 6 min…
const RAIN_CHANCE = 0.1; // … une sur dix est pluvieuse : une averse toutes les heures environ
const RAIN_FADE = 50_000; // la pluie arrive et s'en va en 50 s

// Tempêtes de sable (Mer de sable seulement) : tirées au sort à part, un peu plus souvent que la pluie.
const STORM_SLOT = 5 * 60_000;
const STORM_CHANCE = 0.14; // environ une toutes les 35 min
const STORM_FADE = 40_000; // elle se lève et retombe en 40 s

// Brouillard (Lacs brumeux seulement) : tiré au sort à part ; épais, il ne laisse voir qu'autour de soi.
const FOG_SLOT = 7 * 60_000;
const FOG_CHANCE = 0.3;
const FOG_FADE = 60_000;
// Orage : une partie des averses (pas l'hiver, il neige) ; la foudre tombe sur les arbres isolés.
const THUNDER_CHANCE = 0.4;
export const SNOWFALL = 0.15; // assez de neige au sol : il fait froid, la pluie tombe en flocons (et plus d'orage)

// Le calendrier de l'île : quatre saisons, découpées en douze périodes de LUNE_DAYS jours (un jour = un cycle jour +
// nuit, il commence au lever du soleil), chaque village à son propre moment de l'année. La neige s'installe peu à peu
// à la fin de l'automne, couvre l'île tout l'hiver, et fond au début du printemps.
export const LUNE_DAYS = 2;
export const SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3;
export const SEASON_NAMES = ['Printemps', 'Été', 'Automne', 'Hiver'];
export const SEASON_EMBLEMS = ['🌸', '☀️', '🍂', '❄️'];
export interface Lune { name: string; emblem: string; season: number; about: string }
export const LUNES: Lune[] = [
  { name: 'Début du printemps', emblem: '💧', season: SPRING, about: 'La neige fond peu à peu, les mares dégèlent.' },
  { name: 'Printemps', emblem: '🌱', season: SPRING, about: 'Les arbres reverdissent.' },
  { name: 'Fin du printemps', emblem: '🌸', season: SPRING, about: 'Les arbres sont en fleurs.' },
  { name: 'Début de l\'été', emblem: '☀️', season: SUMMER, about: 'Il fait beau et chaud.' },
  { name: 'Orages d\'été', emblem: '⛈️', season: SUMMER, about: 'Chaleur lourde : presque toutes les averses tournent à l\'orage.' },
  { name: 'Plein été', emblem: '🌾', season: SUMMER, about: 'L\'été bat son plein.' },
  { name: 'Fin de l\'été', emblem: '🔥', season: SUMMER, about: 'Les derniers jours brûlants de l\'été.' },
  { name: 'Début de l\'automne', emblem: '🌫️', season: AUTUMN, about: 'Les feuilles roussissent.' },
  { name: 'Automne', emblem: '🍂', season: AUTUMN, about: 'Les arbres se dégarnissent.' },
  { name: 'Fin de l\'automne', emblem: '❄️', season: AUTUMN, about: 'Les premières neiges s\'installent peu à peu sur l\'île (jamais sur la jungle ni le désert).' },
  { name: 'Début de l\'hiver', emblem: '☃️', season: WINTER, about: 'Tout est blanc, les mares gèlent, des Bigfoots rôdent dans les Bois profonds.' },
  { name: 'Fin de l\'hiver', emblem: '🌙', season: WINTER, about: 'Les derniers jours de l\'année, au plus froid.' },
];
export const YEAR_DAYS = LUNES.length * LUNE_DAYS;
export const YEAR_MS = YEAR_DAYS * DAY_MS;
export const SEASON_MS = YEAR_MS / 4; // un quart d'année
const EPOCH_DAY = Math.floor(Date.UTC(2026, 0, 1) / DAY_MS); // pour numéroter les années
const STORM_LUNE = 4; // les Orages d'été
const STORM_LUNE_THUNDER = 0.85;

/** Date du village : année (depuis 1), jour de l'année (0…), lune (0…11), jour de la lune (1…), et t, le jour de l'année avec sa part écoulée. */
export interface CalendarDate { year: number; day: number; lune: number; dayOfLune: number; t: number }
export function calendar(seed: number, now: number): CalendarDate {
  // même décalage que le jour et la nuit : le jour change au lever du soleil
  const u = now / DAY_MS + hash2(3, 5, seed + 90) + Math.floor(hash2(4, 6, seed + 95) * YEAR_DAYS) - EPOCH_DAY;
  const d = Math.floor(u), day = ((d % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS, lune = Math.floor(day / LUNE_DAYS);
  return { year: Math.floor(d / YEAR_DAYS) + 1, day, lune, dayOfLune: (day % LUNE_DAYS) + 1, t: day + (u - d) };
}

/** Saison du calendrier (0 printemps … 3 hiver) d'une date, et le jour de cette saison (à partir de 1) sur combien. */
export function seasonDay(date: CalendarDate) {
  const s = LUNES[date.lune].season, first = LUNES.findIndex((l) => l.season === s);
  return { season: s, day: date.day - first * LUNE_DAYS + 1, days: LUNES.filter((l) => l.season === s).length * LUNE_DAYS };
}

/** Neige au sol (0 à 1) à ce moment de l'année : elle monte à la fin de l'automne, reste tout l'hiver, puis fond au début du printemps. */
export function snowAt(t: number) {
  const first = 9 * LUNE_DAYS, thaw = LUNE_DAYS;
  if (t >= first + LUNE_DAYS) return 1;
  if (t >= first) return smooth((t - first) / LUNE_DAYS);
  if (t < thaw) return 1 - smooth(t / thaw);
  return 0;
}

/** Saison du village à cet instant (0 printemps … 3 hiver) : l'hiver, c'est quand la neige couvre plus de la moitié du sol. */
export function season(seed: number, now: number) {
  const c = calendar(seed, now);
  return snowAt(c.t) >= 0.5 ? WINTER : LUNES[c.lune].season === WINTER ? AUTUMN : LUNES[c.lune].season;
}

const smooth = (u: number) => u * u * (3 - 2 * u);

export interface Sky {
  light: number; // 1 = plein jour, 0 = nuit noire
  dusk: number; // 0 à 1 : teinte chaude du crépuscule et de l'aube (au milieu de la transition)
  rain: number; // 0 = sec, 1 = grosse averse
  storm: number; // tempête de sable (Mer de sable seulement) : 0 = calme, 1 = en plein dedans
  wind: { x: number; y: number }; // sens du vent de la tempête (vecteur unité) : chaque tempête a le sien
  fog: number; // brouillard (Lacs brumeux seulement) : 0 = clair, 1 = on n'y voit plus qu'autour de soi
  thunder: number; // orage (avec la pluie, pas l'hiver) : 0 = non, 1 = la foudre tombe
  season: number; // 0 printemps, 1 été, 2 automne, 3 hiver (la neige couvre plus de la moitié du sol : les mares gèlent)
  snow: number; // neige au sol, 0 à 1 (elle s'installe et fond peu à peu) ; au-delà de SNOWFALL, la pluie tombe en neige
  date: CalendarDate;
}

/** Force de la pluie d'une tranche (0 si elle est sèche). */
function slotRain(seed: number, k: number) {
  return hash2(k, 7, seed + 91) < RAIN_CHANCE ? 0.6 + hash2(k, 8, seed + 92) * 0.4 : 0;
}

/** Brouillard d'une tranche (0 : clair). */
function slotFog(seed: number, k: number) {
  return hash2(k, 14, seed + 97) < FOG_CHANCE ? 0.6 + hash2(k, 15, seed + 98) * 0.4 : 0;
}

/** Une averse d'orage (dans cette tranche de pluie) : 1, sinon 0. Pendant les Orages d'été, presque toutes. */
function slotThunder(seed: number, k: number) {
  const storms = calendar(seed, (k + 0.5) * RAIN_SLOT).lune === STORM_LUNE;
  return slotRain(seed, k) && hash2(k, 13, seed + 96) < (storms ? STORM_LUNE_THUNDER : THUNDER_CHANCE) ? 1 : 0;
}

/** Force d'une tempête de sable dans une tranche (0 : calme). */
function slotStorm(seed: number, k: number) {
  return hash2(k, 11, seed + 93) < STORM_CHANCE ? 0.75 + hash2(k, 12, seed + 94) * 0.25 : 0;
}

/** Sens du vent d'une tranche de tempête (vecteur unité) : une tempête peut venir de n'importe quel côté. */
function slotWind(seed: number, k: number) {
  const a = hash2(k, 16, seed + 99) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/**
 * Vent du moment : celui de la tempête de la tranche ; pendant le fondu entre deux tranches, les deux vents se mêlent à
 * proportion de leur tempête (le vent tourne pendant qu'une tempête retombe et que la suivante se lève).
 */
function stormWind(seed: number, now: number) {
  const k = Math.floor(now / STORM_SLOT), u = now - k * STORM_SLOT;
  const n = u < STORM_FADE / 2 ? k - 1 : u > STORM_SLOT - STORM_FADE / 2 ? k + 1 : k;
  const here = slotWind(seed, k);
  if (n === k) return here;
  const wn = n < k ? 1 - smooth(u / STORM_FADE + 0.5) : smooth((u - STORM_SLOT) / STORM_FADE + 0.5);
  const a = (1 - wn) * slotStorm(seed, k), b = wn * slotStorm(seed, n), there = slotWind(seed, n);
  const x = a * here.x + b * there.x, y = a * here.y + b * there.y, l = Math.hypot(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : a >= b ? here : there;
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
  const fog = slotted(now, FOG_SLOT, FOG_FADE, (k) => slotFog(seed, k)), sea = season(seed, now);
  const date = calendar(seed, now), snow = snowAt(date.t);
  const thunder = snow >= SNOWFALL ? 0 : slotted(now, RAIN_SLOT, RAIN_FADE, (k) => slotThunder(seed, k));
  return { light, dusk, rain: clamp(rain, 0, 1), storm: clamp(storm, 0, 1), wind: stormWind(seed, now), fog: clamp(fog, 0, 1), thunder: clamp(thunder, 0, 1), season: sea, snow, date };
}
