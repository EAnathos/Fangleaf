// Fichiers du build statique servis par le serveur HTTP (en prod).

import { existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/** Réponse à une URL : un fichier de dist/ à servir, une URL malformée (400) ou un fichier du build absent (404). */
export type StaticResult = { file: string; cache: string } | { status: 400 | 404 };

// Les fichiers de /assets/ portent l'empreinte de leur contenu : un nom donné ne change jamais, il se garde un an.
const IMMUTABLE = 'public, max-age=31536000, immutable';
// Le reste (index.html, sw.js, manifeste, icônes) garde un nom fixe d'une version à l'autre : toujours revalider,
// sinon une page d'avant le déploiement réclame des fichiers qui n'existent plus.
const REVALIDATE = 'no-cache';

/**
 * Ce que le serveur répond à ce chemin d'URL. Tout ce qui sort de dist/ ou n'existe pas renvoie à index.html (routes
 * du client), sauf sous /assets/ : y renvoyer la page en 200 laisserait un cache (Cloudflare, service worker) la
 * garder sous le nom d'un script, et le jeu ne démarrerait plus chez personne jusqu'à l'expiration de ce cache.
 * Cela arrive pendant un déploiement, quand l'ancien conteneur reçoit la demande d'un fichier du nouveau build.
 */
export function staticFile(dist: string, rawUrl: string): StaticResult {
  let path: string;
  try {
    path = decodeURIComponent(new URL(rawUrl, 'http://x').pathname);
  } catch {
    return { status: 400 }; // « /% », « /%E0 »… : decodeURIComponent lève une erreur
  }
  if (path.includes('\0')) return { status: 400 };
  const file = normalize(join(dist, path));
  const found = (file === dist || file.startsWith(dist + sep)) && existsSync(file) && !statSync(file).isDirectory();
  if (path.startsWith('/assets/')) return found ? { file, cache: IMMUTABLE } : { status: 404 };
  return { file: found ? file : join(dist, 'index.html'), cache: REVALIDATE };
}
