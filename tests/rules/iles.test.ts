// Îlots du large : géants et leurs tomes, créatures. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { maxHpOf } from '../../server/room.ts';
import { bookIndex, DISCIPLINES, LESSON_KINDS, SPECIES, WILD_REGEN_DELAY, zoneBosses } from '../../shared/config.ts';

describe('Îlots du large', () => {
  rule('Trois îlots dans la mer peu profonde, chacun gardé par un géant (à l\'air libre).', () => {
    const r = room(), m = r.map;
    const bosses = m.islets.filter((t: { boss: number }) => t.boss >= 0);
    check(m.islets.length === 3 && bosses.length === 3, `${m.islets.length} îlots, ${bosses.length} géants`);
    check(bosses.every((t: { cave: number; boss: number }) => m.caves[t.cave]?.boss === t.boss && SPECIES[t.boss].isle && SPECIES[t.boss].optional),
      'chaque géant se tient sur son îlot, et il est facultatif');
    check([1, 2, 3, 4, 5, 6, 7].every((z) => zoneBosses(z).every((b) => !SPECIES[b].isle)), 'ni porte, ni parchemin ne dépendent des géants des îlots');
    for (const t of m.islets) {
      check(!m.isWater(t.x, t.y) && !m.isSea(t.x, t.y) && m.isletAt(t.x, t.y) === t, `îlot de la zone ${t.zone} : de la terre au milieu`);
      // vers la côte la plus proche : que de la terre ou de la mer peu profonde (le serpent y nage), jamais le large
      let best = { d: Infinity, x: 0, y: 0 };
      for (let a = 0; a < 64; a++) {
        const ang = (a / 64) * Math.PI * 2;
        for (let d = t.r + 40; d < t.r + 1200; d += 16) {
          const x = t.x + Math.cos(ang) * d, y = t.y + Math.sin(ang) * d;
          if (m.shoreAt(x, y) < 0 && !m.isletAt(x, y, 60)) {
            if (d < best.d) best = { d, x, y };
            break;
          }
        }
      }
      let ok = best.d < Infinity;
      for (let k = 0; k <= 50 && ok; k++) {
        const x = t.x + ((best.x - t.x) * k) / 50, y = t.y + ((best.y - t.y) * k) / 50;
        if (m.blocked(x, y) && !m.isWater(x, y) && m.shoreAt(x, y) > 0) ok = false; // mer profonde
      }
      check(ok, `îlot de la zone ${t.zone} : on le rejoint depuis la côte à la nage (${Math.round(best.d - t.r)} px de mer)`);
    }
  });

  rule('Géant d\'îlot à l\'air libre : on lui parle sur son îlot ; le combat tient au-dessus de l\'eau toute proche, sans qu\'il guérisse ; il se rendort quand plus personne n\'est là.', () => {
    const r = room();
    const t = r.map.islets.find((q: { boss: number }) => q.boss >= 0), c = r.map.caves[t.cave];
    const boss = r.units.get(r.caveBoss[c.id]);
    check(c.open !== undefined && !r.map.caveAt(boss.x, boss.y) && r.map.isletAt(boss.x, boss.y) === t && boss.dormant, `${SPECIES[t.boss].name} : debout sur son îlot, endormi`);
    const p = r.addPlayer('a', noop);
    p.hp = 1e6;
    [p.x, p.y] = [boss.x + boss.r + 40, boss.y];
    r.onChallenge(p, c.id);
    check(!boss.dormant, 'on lui parle sur l\'îlot : le combat commence');
    boss.hp = boss.maxHp / 2;
    [p.x, p.y] = [t.x + t.r * 1.6 + 300, t.y]; // au-dessus de l'eau, tout près (à dos de vautour ou de serpent)
    r.time += WILD_REGEN_DELAY + 1;
    for (let i = 0; i < 40; i++) r.step();
    check(!boss.dormant && boss.hp === boss.maxHp / 2, 'au-dessus de l\'eau, tout près : le combat continue, et il ne reprend pas de forces');
    [p.x, p.y] = [t.x + t.r * 1.6 + 1500, t.y]; // reparti au large
    for (let i = 0; i < 10; i++) r.step();
    check(boss.dormant && boss.hp === boss.maxHp, 'plus personne sur l\'îlot : il se rendort, guéri');
  });

  rule('Chaque géant d\'îlot garde un tome d\'Endurance (I, II, III, du plus faible au plus fort) : il passe en premier dans son coffre.', () => {
    const isle = LESSON_KINDS.filter((k) => DISCIPLINES[k].isle), kept = SPECIES.filter((sp) => sp.tome).sort((a, b) => a.zone - b.zone);
    check(isle.join(',') === 'vigor' && DISCIPLINES.vigor.tomes.length === 3, 'une discipline des îlots, l\'Endurance, en trois tomes');
    check(kept.length === 3 && kept.every((sp, i) => sp.boss && sp.isle && sp.tome![0] === 'vigor' && sp.tome![1] === i), `${kept.map((sp) => sp.name).join(', ')} : les tomes I, II et III`);
    const r = room();
    const t = r.map.islets.find((q: { boss: number }) => q.boss >= 0 && SPECIES[q.boss].tome?.[1] === 1);
    const c = r.map.caves[t.cave], boss = r.units.get(r.caveBoss[c.id]);
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
    r.damage(boss, boss.hp, p);
    const ch = r.chests.find((q: { cave: number }) => q.cave === c.id);
    [p.x, p.y] = [ch.x + 30, ch.y];
    const random = Math.random;
    Math.random = () => 0; // le livre tombe à coup sûr
    r.onChest(p, ch.id);
    Math.random = random;
    const k = LESSON_KINDS.indexOf('vigor');
    check(p.tomes[bookIndex(k, 1)] === 1, `${SPECIES[t.boss].name} : ${DISCIPLINES.vigor.tomes[1]} dans son coffre`);
    // et ce tome-là ne tombe jamais d'un autre géant
    const c0 = r.map.caves[0], b0 = r.units.get(r.caveBoss[c0.id]), q = r.addPlayer('b', noop);
    [q.x, q.y] = [b0.x + b0.r + 20, b0.y];
    r.damage(b0, b0.hp, q);
    const ch0 = r.chests.find((x: { cave: number }) => x.cave === c0.id);
    [q.x, q.y] = [ch0.x + 30, ch0.y];
    Math.random = () => 0;
    r.onChest(q, ch0.id);
    Math.random = random;
    check(LESSON_KINDS.every((kind, i) => !DISCIPLINES[kind].isle || [0, 1, 2].every((n) => !q.tomes[bookIndex(i, n)])), 'un géant de l\'île ne lâche pas les tomes des îlots');
  });

  rule('Les créatures des îlots vivent sur l\'îlot de leur géant.', () => {
    const r = room();
    for (const key of ['drake', 'wyvern', 'dragon']) {
      const s = SPECIES.findIndex((sp) => sp.key === key), t = r.map.islets.find((q: { boss: number }) => q.boss >= 0 && SPECIES[q.boss].base === key);
      const here = [...r.units.values()].filter((u: { s: number; owner: number }) => u.s === s && !u.owner);
      check(here.length > 0 && here.every((u: { x: number; y: number }) => r.map.isletAt(u.x, u.y) === t), `${SPECIES[s].name} : ${here.length} sur son îlot`);
    }
  });

  rule('Effet de l\'Endurance : +10 % de PV max par tome lu.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    const hp0 = maxHpOf(p), k = LESSON_KINDS.indexOf('vigor');
    p.learned[k] = 1;
    check(maxHpOf(p) === Math.round(hp0 * 1.1), `Endurance I : +10 % de PV max (${hp0} → ${maxHpOf(p)})`);
    p.learned[k] = 3;
    check(maxHpOf(p) === Math.round(hp0 * 1.3), `les trois tomes : +30 % (${maxHpOf(p)})`);
  });
});
