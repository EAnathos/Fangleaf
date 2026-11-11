// Tests de règles, tous ou par thème (un thème = un fichier de tests/rules/).
//
//   npm run test:rules                                   tous les thèmes (la CI)
//   npm run test:rules -- volcan meute                   seulement tests/rules/volcan.test.ts et meute.test.ts
//   npm run test:rules -- geants --test-name-pattern=Marché   les options de node:test passent telles quelles (avec =)
//   npm run test:rules -- --list                         la liste des thèmes
//   npm run test:rules -- monde geants --seeds=1,42,777   thèmes ciblés, sur plusieurs graines

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const DIR = 'tests/rules';
const themes = readdirSync(DIR).filter((f) => f.endsWith('.test.ts')).map((f) => f.slice(0, -'.test.ts'.length)).sort();
const args = process.argv.slice(2);
if (args.includes('--list')) {
  console.log(themes.join('\n'));
  process.exit(0);
}
const asked = args.filter((a) => !a.startsWith('-'));
const seedOption = args.find((a) => a.startsWith('--seeds='));
const flags = args.filter((a) => a.startsWith('-') && a !== seedOption);
const seeds = seedOption ? seedOption.slice('--seeds='.length).split(',') : [process.env.TEST_SEED];
if (seeds.some((seed) => seed !== undefined && (!/^\\d+$/.test(seed) || !Number.isSafeInteger(Number(seed))))) {
  console.error('--seeds attend une liste de graines entières positives, séparées par des virgules');
  process.exit(2);
}
const unknown = asked.filter((t) => !themes.includes(t.replace(/\.test\.ts$/, '')));
if (unknown.length) {
  console.error(`Thème inconnu : ${unknown.join(', ')}\nThèmes : ${themes.join(', ')}`);
  process.exit(2);
}
const files = (asked.length ? asked.map((t) => t.replace(/\.test\.ts$/, '')) : themes).map((t) => `${DIR}/${t}.test.ts`);
let status = 0;
for (const seed of seeds) {
  if (seed !== undefined) console.log(`\\nTests avec TEST_SEED=${seed}`);
  const env = seed === undefined ? process.env : { ...process.env, TEST_SEED: seed };
  const run = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...flags, ...files], { stdio: 'inherit', env });
  if (run.status !== 0) status = run.status ?? 1;
}
process.exit(status);
