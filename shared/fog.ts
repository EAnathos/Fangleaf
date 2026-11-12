// Carte explorée d'un village : une grille de cases de FOG_CELL px, dévoilées autour des dompteurs.
// Le serveur la tient pour tout le village et la sauvegarde avec lui ; chaque client la dessine (client/src/fog.ts).
// Même règle des deux côtés : une case est dévoilée quand son centre est à moins de REVEAL_R d'un dompteur.

import { DEPTHS_REVEAL_R, WORLD_HALF } from './config.ts';

export const FOG_CELL = 48; // doit diviser la taille du monde (34560 / 48 = 720) : sinon les rangées se décalent
export const REVEAL_R = 650;
export const FOG_N = (WORLD_HALF * 2) / FOG_CELL;
if (!Number.isInteger(FOG_N)) throw new Error(`FOG_CELL (${FOG_CELL}) doit diviser la taille du monde`);

/** Dévoile les cases du disque de rayon r autour de (x, y) ; renvoie le nombre de cases nouvellement dévoilées. */
export function revealCells(cells: Uint8Array, x: number, y: number, r = REVEAL_R) {
  const ci = (x + WORLD_HALF) / FOG_CELL, cj = (y + WORLD_HALF) / FOG_CELL, cr = r / FOG_CELL;
  let n = 0;
  for (let j = Math.max(0, Math.floor(cj - cr)); j <= Math.min(FOG_N - 1, Math.ceil(cj + cr)); j++) {
    for (let i = Math.max(0, Math.floor(ci - cr)); i <= Math.min(FOG_N - 1, Math.ceil(ci + cr)); i++) {
      if (cells[j * FOG_N + i]) continue;
      if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > cr * cr) continue;
      cells[j * FOG_N + i] = 1;
      n++;
    }
  }
  return n;
}

/**
 * En texte, pour la base et le réseau : « 1: » puis la longueur de chaque plage de cases (inexplorées d'abord, puis
 * explorées, et ainsi de suite), en base 36, séparées par des virgules. Une carte explorée par grandes taches tient en
 * quelques kilo-octets au lieu de 65 Ko.
 */
export function packFog(cells: Uint8Array) {
  const runs: string[] = [];
  let cur = 0, len = 0;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i] ? 1 : 0;
    if (v === cur) len++;
    else {
      runs.push(len.toString(36));
      cur = v;
      len = 1;
    }
  }
  runs.push(len.toString(36));
  return `1:${runs.join(',')}`;
}

/** Relit packFog dans cells (FOG_N² cases). false si le texte est illisible ou d'une autre taille : cells n'est alors pas sûr. */
export function unpackFog(text: unknown, cells: Uint8Array) {
  if (typeof text !== 'string' || !text.startsWith('1:')) return false;
  let at = 0, v = 0;
  for (const part of text.slice(2).split(',')) {
    const len = parseInt(part, 36);
    if (!/^[0-9a-z]+$/.test(part) || !Number.isSafeInteger(len) || at + len > cells.length) return false;
    cells.fill(v, at, at + len);
    at += len;
    v ^= 1;
  }
  return at === cells.length;
}

/**
 * Le donjon du volcan est hors de la grille de l'île : sa carte retient les salles découvertes (leur index), dévoilées
 * quand un dompteur passe près de leur bord. Même règle sur le serveur (qui les garde pour le village) et le client.
 * Renvoie le nombre de salles nouvellement découvertes.
 */
export function revealRooms(seen: Set<number>, rooms: readonly { x: number; y: number; rx: number; ry: number }[], x: number, y: number) {
  let n = 0;
  rooms.forEach((r, i) => {
    if (seen.has(i) || Math.hypot(r.x - x, r.y - y) >= Math.max(r.rx, r.ry) + DEPTHS_REVEAL_R) return;
    seen.add(i);
    n++;
  });
  return n;
}
