import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = '.changes';
const files = (await readdir(directory).catch(() => []))
  .filter((name) => name.endsWith('.json'))
  .sort();

const errors: string[] = [];
const names = new Set<string>();
for (const file of files) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(file) || names.has(file)) {
    errors.push(`${file}: nom de fichier invalide ou dupliqué`);
    continue;
  }
  names.add(file);
  try {
    const value: unknown = JSON.parse(await readFile(join(directory, file), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('doit être un objet JSON');
    const entry = value as Record<string, unknown>;
    if (!['patch', 'minor', 'major'].includes(String(entry.bump))) errors.push(`${file}: bump doit être patch, minor ou major`);
    if (typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || Number.isNaN(Date.parse(entry.date))) errors.push(`${file}: date doit être au format AAAA-MM-JJ`);
    if (typeof entry.title !== 'string' || !entry.title.trim()) errors.push(`${file}: title est obligatoire`);
    if (!Array.isArray(entry.items) || entry.items.length === 0 || entry.items.some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${file}: items doit contenir au moins une chaîne non vide`);
    if (Object.keys(entry).some((key) => !['bump', 'date', 'title', 'items'].includes(key))) errors.push(`${file}: propriété inconnue`);
  } catch (error) {
    errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`${files.length} fichier(s) de changement valide(s).`);
}
