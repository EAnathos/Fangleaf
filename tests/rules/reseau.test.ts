// Réseau : envoi différentiel, événements, animations. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room } from '../helpers.ts';
import { SPECIES } from '../../shared/config.ts';
import { SnapshotState } from '../../shared/snapshot.ts';

describe('Réseau : envoi différentiel, événements, animations', () => {
  rule('Envoi différentiel : l\'état reconstitué par le client correspond à l\'état complet (à 2 px près).', () => {
    const r = room();
    let full: { units: number[][]; players: { id: number; gold: number; essences: number[] }[] } = { units: [], players: [] };
    const state = new SnapshotState();
    const p = r.addPlayer('a', (m: { t: string }) => m.t === 's' && (full = state.apply(m as never) as never));
    let raw: { units: number[][]; players: Record<string, unknown>[] } = { units: [], players: [] };
    r.addPlayer('b', (m: { t: string }) => m.t === 's' && (raw = m as never));
    const c = r.map.spineAt(2600);
    [p.x, p.y] = [c.x, c.y];
    p.hp = 1e9;
    let ok = true;
    for (let i = 0; i < 100; i++) {
      r.step();
      p.hp = 1e9;
      const truth = [...r.units.values()].filter((u: { x: number; y: number; reviveAt: number }) => !u.reviveAt && Math.hypot(u.x - p.x, u.y - p.y) <= 1250);
      const byId = new Map(full.units.map((u) => [u[0], u]));
      if (truth.length !== full.units.length || truth.some((u: { id: number; x: number; y: number }) => !byId.has(u.id) || Math.abs(byId.get(u.id)![3] - u.x) > 2.5 || Math.abs(byId.get(u.id)![4] - u.y) > 2.5)) ok = false;
    }
    p.gold = 1234;
    r.step();
    check(ok && full.players.find((x) => x.id === p.id)?.gold === 1234 && full.players.find((x) => x.id === p.id)!.essences.length === SPECIES.length,
      `état reconstitué fidèle (${full.units.length} unités, or et essences du dompteur à jour)`);
    check(Object.keys(raw.players.find((x) => x.id !== undefined && Object.keys(x).length < 6) ?? { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }).length < 6, 'un dompteur dont rien n\'a changé ne coûte presque rien (seulement son id et ses changements)');
  });

  rule('Événements : un coup porté loin d\'un dompteur ne lui est pas envoyé ; les annonces et ce qui lui est destiné, si.', () => {
    const r = room();
    const got = new Map<number, { e: string; to?: number }[]>();
    const spy = (id: () => number) => (m: { t: string; ev?: { e: string }[] }) => m.t === 's' && got.set(id(), [...(got.get(id()) ?? []), ...(m.ev ?? [])]);
    let ida = 0, idb = 0;
    const a = r.addPlayer('a', spy(() => ida));
    const b = r.addPlayer('b', spy(() => idb));
    [ida, idb] = [a.id, b.id];
    [a.x, a.y] = [r.map.spawn.x, r.map.spawn.y];
    [b.x, b.y] = [r.map.village.x + 4000, r.map.village.y];
    const foe = r.createUnit(0, false, a.x + 30, a.y);
    r.events = [];
    r.damage(foe, 1, a);
    r.events.push({ e: 'gold', to: a.id, n: 2, x: a.x, y: a.y }, { e: 'info', text: 'annonce' });
    r.broadcast();
    const ea = (got.get(a.id) ?? []).map((e) => e.e).join(), eb = (got.get(b.id) ?? []).map((e) => e.e).join();
    check(ea.includes('hit') && ea.includes('gold') && eb === 'info', `événements filtrés : proche « ${ea} », loin « ${eb} »`);
  });

  rule('Animations : chaque zone d\'attaque dit au client d\'où elle vient (style, lanceur, durée), les coups au corps à corps sont marqués.', () => {
    const r = room();
    const got: { ev: { e: string; m?: number }[]; hazards: number[][] }[] = [];
    const p = r.addPlayer('a', (m: { t: string }) => m.t === 's' && got.push(m as never));
    const boss = r.units.get(r.caveBoss.find((id: number) => r.units.get(id) && SPECIES[r.units.get(id).s].key === 'colossus'));
    [p.x, p.y] = [boss.x + 30, boss.y];
    r.castMove(boss, { kind: 'slam', cd: 6 }, p);
    r.broadcast();
    const h = got.at(-1)!.hazards[0];
    check(!!h && h[8] === 2 && h[9] === boss.id && h[10] === 110, `onde de choc annoncée avec son style, son lanceur et sa durée (${h?.slice(8).join(', ')})`);
    const wolf = r.createUnit(1, false, p.x + 20, p.y);
    r.events = [];
    r.tryAttack(Object.assign(wolf, { atkCd: 0 }), p);
    const hit = r.events.find((e: { e: string }) => e.e === 'hit');
    r.events = [];
    r.damage(p, 3, wolf);
    const plain = r.events.find((e: { e: string }) => e.e === 'hit');
    check(hit?.m === 1 && plain && !plain.m, 'coup au corps à corps marqué (m : 1), dégâts d\'une zone non');
  });
});
