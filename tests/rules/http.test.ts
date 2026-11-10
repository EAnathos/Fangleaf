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
    for (const bad of ['/%', '/%E0%A4%A', '/a%', '/%zz', '/assets/%']) check(staticFile(dist, bad) === null, `${bad} : URL malformée, pas d'exception`);
    check(staticFile(dist, '/assets/a.js') === join(dist, 'assets', 'a.js'), 'un fichier du build est servi');
    check(staticFile(dist, '/assets%2Fa.js') === join(dist, 'assets', 'a.js'), 'chemin encodé : décodé');
    check(staticFile(dist, '/village/ABCD') === index, 'route inconnue : index.html');
    check(staticFile(dist, '/assets/') === index, 'dossier : index.html');
    check(staticFile(dist, '/..%2F..%2Fpackage.json') === index && staticFile(dist, '/%2e%2e/dist-secret/x.txt') === index, 'rien en dehors de dist/ (ni un dossier voisin)');
    check(staticFile(dist, '/a%00.js') === null, 'octet nul refusé');
  });
});
