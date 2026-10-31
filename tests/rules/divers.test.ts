// Petites règles : gibier apprivoisé, baies, lave du volcan, embarquement, brûlure. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { armyCap, BOAT_STAGES, HEART_IN_BOAT, SPECIES } from '../../shared/config.ts';

const S = (key: string) => SPECIES.findIndex((sp) => sp.key === key);

describe('Petites règles', () => {
  rule('Un lièvre apprivoisé pendant son sommeil se réveille.', () => {
    const r = room();
    const p = r.addPlayer('a', noop), u = r.createUnit(S('hare'), false, p.x + 30, p.y);
    u.asleep = true;
    r.makeTamed(u, p);
    check(!u.asleep, 'il ne dort plus : il suit sa meute');
  });

  rule('Meute pleine : on peut encore donner des baies au gibier passif (il ne la rejoint pas).', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop), u = r.createUnit(S('hare'), false, p.x + 20, p.y);
    for (let i = 0; i < armyCap(p.learned); i++) r.makeTamed(r.createUnit(S('slime'), false, p.x - 200, p.y), p);
    p.fruits = 5;
    r.grid.clear();
    for (const e of [p, ...r.units.values()]) r.grid.insert(e);
    const random = Math.random;
    Math.random = () => 0; // il se laisserait apprivoiser à coup sûr
    r.feed(p);
    Math.random = random;
    check(p.fruits === 4 && !u.owner && r.events.some((e: { e: string }) => e.e === 'full'), 'la baie est mangée, la meute reste pleine');
  });

  rule('Sous le volcan, à dos de vautour, on survole les mares de lave.', () => {
    const m = room().map, pool = m.lavaPools[0];
    check(!!pool && m.blocked(pool.x, pool.y) && !m.passable(pool.x, pool.y, false) && m.passable(pool.x, pool.y, false, true), 'à pied non, en vol oui');
  });

  rule('Le bateau prêt : c\'est en parlant à Aubin, au bateau, qu\'on prend la mer.', () => {
    const r = room(), m = r.map;
    const p = r.addPlayer('a', noop);
    r.told = m.caves.map((c: { boss: number }) => c.boss);
    r.boat = BOAT_STAGES.length;
    r.heart = HEART_IN_BOAT;
    const yard = r.elderPos();
    [p.x, p.y] = [yard.x + 20, yard.y];
    r.time += 5;
    r.onCave(p, m.voyage.id, true);
    check(m.caveAt(p.x, p.y)?.id === m.voyage.id, 'à bord');
  });

  rule('Le feu brûle : une boule de feu met le feu (il ronge un moment), l\'eau l\'éteint.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop), d = r.createUnit(S('dragon'), false, p.x + 200, p.y);
    p.hp = 1e5;
    r.burnOf(p, 100, d);
    check(!!p.burn, 'il brûle');
    const hp0 = p.hp;
    r.tick = 0;
    r.updatePoison();
    check(p.hp < hp0, 'la brûlure ronge');
    const lake = r.map.waterNear(p.x, p.y, 3000);
    if (lake) {
      [p.x, p.y] = [lake.x, lake.y];
      r.updatePoison();
      check(!p.burn, 'dans l\'eau, elle s\'éteint');
    }
  });
});
