// Worker de server/mapgen.ts : il génère l'île d'une graine, hors du fil principal, et renvoie ses champs.
// Tous les champs d'une WorldMap sont des données (WorldMap.clone en dépend aussi) : ils passent tels quels par
// postMessage. Les tableaux typés sont transférés, pas copiés : le fil principal n'a presque rien à recopier.

import { parentPort } from 'node:worker_threads';
import { WorldMap } from '../shared/worldmap.ts';

parentPort!.on('message', ({ seed }: { seed: number }) => {
  try {
    const fields: Record<string, unknown> = { ...new WorldMap(seed, false) }; // sans ce qui ne sert qu'au dessin
    const buffers = new Set<ArrayBuffer>();
    for (const v of Object.values(fields)) if (ArrayBuffer.isView(v) && v.buffer instanceof ArrayBuffer) buffers.add(v.buffer);
    parentPort!.postMessage({ seed, fields }, [...buffers]);
  } catch (e) {
    parentPort!.postMessage({ seed, error: e instanceof Error ? e.message : String(e) });
  }
});
