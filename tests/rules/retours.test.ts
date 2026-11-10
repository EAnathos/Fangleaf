// Essences des géants, noms des Alphas, combats signalés aux alliés. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { ALPHA_NAME_MAX, alphaName, BOSS_ESSENCE_MAX, bossEssence, SPECIES } from '../../shared/config.ts';

const KRAKEN = SPECIES.findIndex((sp) => sp.key === 'kraken');

describe('Retours : essences des géants, noms des Alphas, combats signalés', () => {
  rule('Géant vaincu : des essences de son espèce à ceux qui l\'ont combattu, un peu plus à chaque victoire, plafonnées.', () => {
    const r = room();
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop), idle = r.addPlayer('c', noop);
    const c = r.map.caves[0], base = SPECIES.findIndex((sp) => !sp.boss && sp.key === SPECIES[c.boss].base);
    check(base >= 0, 'le géant de la première grotte a une espèce de base');
    check(bossEssence(c.boss, 1) === 2 && bossEssence(c.boss, 3) === 3 && bossEssence(c.boss, 9) === BOSS_ESSENCE_MAX && bossEssence(c.boss, 50) === BOSS_ESSENCE_MAX,
      'Lisière : 2 essences la 1re fois, 3 à la 3e, 6 au plus dès la 9e');
    check(bossEssence(KRAKEN, 1) === 0, 'le Kraken n\'a pas d\'espèce de base : pas d\'essence');
    const far = SPECIES.findIndex((sp) => sp.boss && sp.zone === 8);
    check(bossEssence(far, 1) > bossEssence(c.boss, 1), 'un géant d\'une zone lointaine en donne un peu plus');
    const got: number[] = [];
    for (let k = 0; k < 12; k++) {
      const b = r.units.get(r.caveBoss[c.id]) ?? r.units.get(r.spawnBoss(c.id));
      r.caveBoss[c.id] = b.id;
      [b.x, b.y] = [p.x + 30, p.y];
      b.hitters.add(p.id);
      b.hitters.add(q.id);
      const before = p.essences[base];
      r.killUnit(b, p);
      got.push(p.essences[base] - before);
    }
    check(got.every((n, i) => n === bossEssence(c.boss, i + 1)), `essences de chaque victoire : ${got.join(', ')}`);
    check(got[0] < got[got.length - 1], 'elles augmentent avec les victoires');
    check(p.bossWins[c.boss] === 12 && q.bossWins[c.boss] === 12, 'chaque participant compte ses victoires');
    check(idle.bossWins[c.boss] === 0 && idle.essences[base] === 0, 'qui n\'a pas combattu n\'a rien');
    const ev = r.events.filter((e: { e: string; to: number; boss?: number }) => e.e === 'essence' && e.to === p.id && e.boss === c.boss);
    check(ev.length === 12 && ev[11].wins === 12 && ev[11].n === got[11], 'un événement par victoire, avec le nombre d\'essences et la victoire');
    const saved = r.profileOf(p);
    check(saved.boss_wins[c.boss] === 12, 'les victoires sont sauvegardées');
    const back = room().addPlayer('a', noop, { userId: 'u', profile: saved });
    check(back.bossWins[c.boss] === 12, 'et relues au retour');
  });

  rule('Nommer un Alpha : nom nettoyé, seulement pour un Alpha possédé, vu de tous, sauvegardé.', () => {
    check(alphaName('  Croc\u0007  <b>Blanc</b>  ') === 'Croc bBlanc/b', 'caractères de contrôle et chevrons retirés, espaces réduits');
    check(alphaName('x'.repeat(40)).length === ALPHA_NAME_MAX, `${ALPHA_NAME_MAX} caractères au plus`);
    const r = room();
    const p = r.addPlayer('a', noop), other = r.addPlayer('b', noop);
    const wolf = SPECIES.findIndex((sp) => sp.key === 'wolf');
    r.onAlphaName(p, wolf, 'Rex');
    check(!p.alphaNames.has(wolf), 'pas d\'Alpha loup : pas de nom');
    r.spawnAlpha(p, wolf, 0, false);
    r.onAlphaName(p, wolf, '  Rex  ');
    check(p.alphaNames.get(wolf) === 'Rex', 'son Alpha loup s\'appelle Rex');
    const sent: { t: string; players?: { id: number; names?: [number, string][] }[] }[] = [];
    other.send = (m: (typeof sent)[number]) => sent.push(m);
    r.broadcast();
    const seen = sent.find((m) => m.t === 's')?.players?.find((x) => x.id === p.id);
    check(seen?.names?.some(([s, n]) => s === wolf && n === 'Rex'), 'les autres dompteurs voient le nom');
    const saved = r.profileOf(p);
    check(saved.alphas.find((a: { s: number }) => a.s === wolf)?.name === 'Rex', 'le nom est sauvegardé avec l\'Alpha');
    const back = room().addPlayer('a', noop, { userId: 'u', profile: saved });
    check(back.alphaNames.get(wolf) === 'Rex', 'et relu au retour');
    r.onAlphaName(p, wolf, '   ');
    check(!p.alphaNames.has(wolf), 'un nom vide le lui retire');
  });

  rule('Combat de géant engagé : les autres dompteurs savent où il se passe, jusqu\'à sa fin.', () => {
    const r = room();
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    const c = r.map.caves[0];
    const sent: { t: string; fights?: [number, number][] }[] = [];
    q.send = (m: (typeof sent)[number]) => sent.push(m);
    const fights = () => {
      sent.length = 0;
      r.broadcast();
      return sent.find((m) => m.t === 's')?.fights ?? [];
    };
    check(fights().length === 0, 'aucun combat en cours');
    [p.x, p.y] = [c.entrance.x, c.entrance.y + 20];
    r.onCave(p, c.id, true);
    const b = r.units.get(r.caveBoss[c.id]);
    [p.x, p.y] = [b.x, b.y + b.r + 40];
    r.onChallenge(p, c.id);
    check(r.events.some((e: { e: string; by: number }) => e.e === 'challenge' && e.by === p.id), 'le réveil est annoncé à tout le village');
    const now = fights();
    check(now.length === 1 && now[0][0] === c.id && now[0][1] === p.id, `le combat est signalé : grotte et dompteur (${JSON.stringify(now)})`);
    r.killUnit(b, p);
    check(fights().length === 0, 'géant vaincu : plus de combat signalé');
  });
});
