import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

type Change = { bump: 'patch' | 'minor' | 'major'; date: string; title: string; items: string[] };
type Entry = { version: string; date: string; title: string; items: string[] };

const dir = '.changes';
const files = (await readdir(dir).catch(() => []))
  .filter((name) => name.endsWith('.json'))
  .sort();
if (!files.length) {
  console.log('Aucun changement à versionner.');
  process.exit(0);
}

const changes: Change[] = [];
for (const file of files) changes.push(JSON.parse(await readFile(join(dir, file), 'utf8')) as Change);

const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) throw new Error(`Version SemVer invalide dans package.json : ${pkg.version}`);
let [major, minor, patch] = match.slice(1).map(Number);
const bump = changes.some((c) => c.bump === 'major') ? 'major'
  : changes.some((c) => c.bump === 'minor') ? 'minor' : 'patch';
if (bump === 'major') { major++; minor = 0; patch = 0; }
else if (bump === 'minor') { minor++; patch = 0; }
else patch++;
const version = `${major}.${minor}.${patch}`;

const entries = JSON.parse(await readFile('client/src/changelog.json', 'utf8')) as Entry[];
const date = changes.map((c) => c.date).sort().at(-1)!;
const titles = changes.map((c) => c.title.trim());
const title = titles.length === 1 ? titles[0] : `Nouveautés : ${titles.join(' · ')}`;
const items = changes.flatMap((c) => c.items.map((item) => changes.length === 1 ? item : `${c.title} — ${item}`));
entries.unshift({ version, date, title, items });

pkg.version = version;
const lock = JSON.parse(await readFile('package-lock.json', 'utf8')) as { version: string; packages: Record<string, { version?: string }> };
lock.version = version;
if (lock.packages['']) lock.packages[''].version = version;
await writeFile('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
await writeFile('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
await writeFile('client/src/changelog.json', `${JSON.stringify(entries, null, 2)}\n`);
for (const file of files) await unlink(join(dir, file));
console.log(`Version ${version} générée à partir de ${files.length} changement(s).`);
