// Fichiers du build statique servis par le serveur HTTP (en prod).

import { existsSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';

/**
 * Fichier du build demandé par ce chemin d'URL, ou null si l'URL est malformée (« /% », « /%E0 »… : decodeURIComponent
 * lève une erreur). Tout ce qui sort de dist/ ou n'existe pas renvoie à index.html.
 */
export function staticFile(dist: string, rawUrl: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(rawUrl, 'http://x').pathname);
  } catch {
    return null;
  }
  if (path.includes('\0')) return null;
  const file = normalize(join(dist, path));
  if ((file !== dist && !file.startsWith(dist + sep)) || !existsSync(file) || statSync(file).isDirectory()) return join(dist, 'index.html');
  return file;
}
