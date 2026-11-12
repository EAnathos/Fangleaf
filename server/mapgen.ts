// Génération des îles hors du fil principal. Générer une île prend plusieurs secondes de calcul : sur le fil principal,
// tous les villages du process seraient figés pendant ce temps (docs/PERFORMANCE.md). Ici, un seul worker génère une
// île à la fois : processeur et mémoire restent bornés, quel que soit le nombre de villages qui se chargent ensemble.
// Chaque île rendue est un objet neuf : deux villages ne partagent jamais une carte (elle a un état qui change en jeu).

import { Worker } from 'node:worker_threads';
import { WorldMap } from '../shared/worldmap.ts';

const TIMEOUT_MS = 60_000; // une génération prend quelques secondes ; au-delà, le worker est bloqué : on le remplace

type Job = { seed: number; resolve: (map: WorldMap) => void; reject: (e: Error) => void };
type Reply = { seed: number; fields?: Record<string, unknown>; error?: string };

export class MapGenerator {
  private worker: Worker | null = null;
  private queue: Job[] = [];
  private current: Job | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** entry : le script du worker (les tests en passent un qui échoue ou se bloque exprès). */
  constructor(private entry = new URL('./mapgen-worker.ts', import.meta.url), private timeoutMs = TIMEOUT_MS) {}

  /** L'île de cette graine, identique à new WorldMap(seed, false), générée sans bloquer les villages. */
  generate(seed: number): Promise<WorldMap> {
    return new Promise((resolve, reject) => {
      this.queue.push({ seed, resolve, reject });
      this.next();
    });
  }

  /** Arrête le worker : la génération en cours et celles en attente sont annulées (leur promesse échoue). */
  close() {
    const jobs = [...(this.current ? [this.current] : []), ...this.queue];
    this.queue = [];
    this.settle();
    this.kill();
    for (const job of jobs) job.reject(new Error(`génération de l'île ${job.seed} annulée`));
  }

  private next() {
    if (this.current || !this.queue.length) return;
    const job = (this.current = this.queue.shift()!);
    // (ce minuteur garde aussi le process en vie le temps de la génération : le worker, lui, ne le retient pas)
    this.timer = setTimeout(() => this.fail(new Error(`génération de l'île ${job.seed} : pas de réponse après ${this.timeoutMs} ms`), true), this.timeoutMs);
    this.spawn().postMessage({ seed: job.seed });
  }

  private spawn() {
    if (this.worker) return this.worker;
    // Le chargeur de tsx ne passe pas aux workers : on l'y enregistre avant d'importer le script (TypeScript, comme le serveur).
    const tsx = import.meta.resolve('tsx/esm/api');
    const w = new Worker(`import(${JSON.stringify(tsx)}).then((t) => { t.register(); return import(${JSON.stringify(this.entry.href)}); })`, { eval: true });
    w.unref();
    w.on('message', (m: Reply) => {
      const job = this.current;
      if (!job || m.seed !== job.seed) return;
      this.settle();
      if (m.fields) job.resolve(Object.assign(Object.create(WorldMap.prototype), m.fields) as WorldMap);
      else job.reject(new Error(`génération de l'île ${job.seed} : ${m.error ?? 'réponse vide'}`));
      this.next();
    });
    w.on('error', (e) => this.fail(e instanceof Error ? e : new Error(String(e)), true));
    w.on('exit', (code) => {
      if (this.worker !== w) return; // remplacé exprès (bloqué, en erreur, arrêté)
      this.worker = null;
      this.fail(new Error(`le worker de génération s'est arrêté (code ${code})`), false);
    });
    return (this.worker = w);
  }

  private settle() {
    clearTimeout(this.timer);
    this.current = null;
  }

  private kill() {
    const w = this.worker;
    this.worker = null;
    void w?.terminate();
  }

  /** La génération en cours échoue (kill : le worker est remplacé) ; les suivantes continuent avec un worker neuf. */
  private fail(e: Error, kill: boolean) {
    const job = this.current;
    if (kill) this.kill();
    this.settle();
    job?.reject(e);
    this.next();
  }
}
