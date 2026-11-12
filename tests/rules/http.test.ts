// Serveur HTTP : une URL malformée ou piégée ne fait pas tomber le serveur. Lancer : npm run test:rules

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { staticFile } from '../../server/static.ts';

describe('Serveur HTTP', () => {
  rule('Fichiers statiques : URL malformée refusée, rien hors de dist/, le reste renvoie à index.html.', () => {
    const root = mkdtempSync(join(tmpdir(), 'fangleaf-')), dist = join(root, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<title>Fangleaf</title>');
    writeFileSync(join(dist, 'assets', 'a.js'), '');
    mkdirSync(join(root, 'dist-secret'));
    writeFileSync(join(root, 'dist-secret', 'x.txt'), 'secret');
    const index = join(dist, 'index.html');
    const served = (url: string) => { const r = staticFile(dist, url); return 'file' in r ? r.file : r.status; };
    for (const bad of ['/%', '/%E0%A4%A', '/a%', '/%zz', '/assets/%']) check(served(bad) === 400, `${bad} : URL malformée, 400 sans exception (obtenu ${served(bad)})`);
    check(served('/assets/a.js') === join(dist, 'assets', 'a.js'), 'un fichier du build est servi');
    check(served('/assets%2Fa.js') === join(dist, 'assets', 'a.js'), 'chemin encodé : décodé');
    check(served('/village/ABCD') === index, 'route inconnue : index.html');
    check(served('/') === index, 'racine : index.html');
    check(served('/..%2F..%2Fpackage.json') === index && served('/%2e%2e/dist-secret/x.txt') === index, 'rien en dehors de dist/ (ni un dossier voisin)');
    check(served('/a%00.js') === 400, `octet nul refusé (obtenu ${served('/a%00.js')})`);
  });

  rule('Fichier du build absent : 404, jamais index.html (un cache le garderait sous le nom du script).', () => {
    const dist = join(mkdtempSync(join(tmpdir(), 'fangleaf-')), 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<title>Fangleaf</title>');
    for (const url of ['/assets/index-ANCIEN.js', '/assets/', '/assets/..%2F..%2Fpackage.json']) {
      const r = staticFile(dist, url);
      check('status' in r && r.status === 404, `${url} : 404 (obtenu ${JSON.stringify(r)})`);
    }
  });

  rule('Cache : /assets/ (empreinte dans le nom) se garde, le reste se revalide à chaque visite.', () => {
    const dist = join(mkdtempSync(join(tmpdir(), 'fangleaf-')), 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<title>Fangleaf</title>');
    writeFileSync(join(dist, 'assets', 'a.js'), '');
    writeFileSync(join(dist, 'sw.js'), '');
    const cache = (url: string) => { const r = staticFile(dist, url); return 'cache' in r ? r.cache : `status ${r.status}`; };
    check(cache('/assets/a.js').includes('immutable'), `script du build : immuable (obtenu ${cache('/assets/a.js')})`);
    for (const url of ['/', '/village/ABCD', '/sw.js']) check(cache(url) === 'no-cache', `${url} : revalidé (obtenu ${cache(url)})`);
  });
});
