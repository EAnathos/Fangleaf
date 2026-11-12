// Faux worker de génération pour tests/rules/monde.test.ts : il répond vite, ou tombe en panne exprès selon la graine.
//   13 : le worker plante (le process du worker s'arrête)
//   14 : il ne répond jamais (bloqué)
//   15 : la génération échoue (erreur renvoyée)
//   autre : une « île » minuscule, aussitôt

import { parentPort } from 'node:worker_threads';

parentPort!.on('message', ({ seed }: { seed: number }) => {
  if (seed === 13) process.exit(1);
  if (seed === 14) return;
  if (seed === 15) return parentPort!.postMessage({ seed, error: 'graine maudite' });
  parentPort!.postMessage({ seed, fields: { seed, cells: new Uint8Array([1, 2, 3]) } });
});
