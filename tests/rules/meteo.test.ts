// Météo qui compte et affinités. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { affinity, AFFINITY_STRONG, AFFINITY_WEAK, elementOf, SPECIES } from '../../shared/config.ts';
import { sky } from '../../shared/weather.ts';

const S = (key: string) => SPECIES.findIndex((sp) => sp.key === key);

describe('Météo et affinités', () => {
  rule('Affinités : le feu brûle la plante, l\'eau éteint le feu ; les dompteurs n\'ont pas d\'élément.', () => {
    check(elementOf(S('golem')) === 'plante' && elementOf(S('salamander')) === 'feu' && elementOf(S('serpent')) === 'eau' && elementOf(S('wolf')) === undefined, 'golem plante, salamandre feu, serpent eau, loup neutre');
    check(elementOf(S('salamander_queen')) === 'feu', 'un géant a l\'élément de son espèce');
    check(affinity(S('wisp'), S('golem')) === AFFINITY_STRONG && affinity(S('golem'), S('wisp')) === AFFINITY_WEAK && affinity(S('serpent'), S('salamander')) === AFFINITY_STRONG && affinity(S('wolf'), S('golem')) === 1,
      'feu > plante, eau > feu, neutre : rien');
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop), fire = r.createUnit(S('wisp'), false, p.x, p.y), moss = r.createUnit(S('golem'), false, p.x + 40, p.y), wolf = r.createUnit(S('wolf'), false, p.x - 40, p.y);
    moss.maxHp = moss.hp = 1e6;
    r.damage(moss, 100, fire);
    const burned = 1e6 - moss.hp;
    moss.hp = 1e6;
    r.damage(moss, 100, wolf);
    check(Math.abs(burned - 125) < 0.01 && Math.abs(1e6 - moss.hp - 100) < 0.01, `le feu follet brûle le golem (${burned} au lieu de 100)`);
  });

  rule('L\'hiver, les mares des premières zones gèlent : on marche dessus ; au dégel, on regagne la rive.', () => {
    const r = room(), m = r.map;
    let pond: { x: number; y: number } | null = null;
    for (let i = 0; i < 20000 && !pond; i++) {
      const s = m.spineAt(Math.random() * m.length), x = s.x + (Math.random() - 0.5) * 3000, y = s.y + (Math.random() - 0.5) * 3000;
      if (m.isWater(x, y) && !m.isSea(x, y) && m.freezes(x, y) && m.freezes(x + 20, y) && m.freezes(x - 20, y)) pond = { x, y };
    }
    check(!!pond, 'une mare qui gèle');
    m.frozen = false;
    check(m.blocked(pond!.x, pond!.y), 'en été : de l\'eau');
    m.frozen = true;
    check(!m.blocked(pond!.x, pond!.y) && m.isIce(pond!.x, pond!.y), 'en hiver : de la glace, on y marche');
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [pond!.x, pond!.y];
    m.frozen = false;
    r.thaw();
    check(!m.blocked(p.x, p.y), 'au dégel, il regagne la rive');
    // les Lacs brumeux, eux, ne gèlent pas
    let lakes = 0, iced = 0;
    for (let i = 0; i < 20000; i++) {
      const s = m.spineAt(Math.random() * m.length), x = s.x + (Math.random() - 0.5) * 3000, y = s.y + (Math.random() - 0.5) * 3000;
      if (!m.isWater(x, y) || m.isSea(x, y) || m.zoneAt(x, y) !== 5) continue;
      lakes++;
      if (m.freezes(x, y)) iced++;
    }
    check(lakes > 100 && iced / lakes < 0.01, `les lacs des Lacs brumeux ne gèlent pas (${iced}/${lakes}, à la frontière)`);
  });

  rule('Orage : la foudre vise un arbre isolé près d\'un dompteur ; annoncée, elle l\'abat et blesse autour.', () => {
    const realNow = Date.now, t0 = realNow();
    let at = 0;
    for (let t = t0; t < t0 + 24 * 3600_000 && !at; t += 30_000) if (sky(room().seed, t).thunder > 0.9) at = t;
    check(at > 0, 'des orages éclatent de temps en temps');
    const r = room();
    Date.now = () => at;
    r.updateSpawns();
    Date.now = realNow;
    const p = r.addPlayer('a', noop);
    // un arbre seul, loin du village
    const tree = r.map.decor.findIndex((d: { kind: number; x: number; y: number }, i: number) => {
      if (d.kind !== 0 || r.map.zoneAt(d.x, d.y) > 3 || r.map.inVillage(d.x, d.y, 400)) return false;
      const t = r.map.trunkOf(d);
      return !r.map.treesNear(t.x, t.y, 170).some((j: number) => j !== i);
    });
    check(tree >= 0, 'un arbre isolé');
    const t = r.map.trunkOf(r.map.decor[tree]);
    [p.x, p.y] = [t.x + 60, t.y];
    p.hp = 1e4;
    r.thunder = 1;
    for (let i = 0; i < 40 && !r.bolts.length; i++) {
      r.nextBolt = 0;
      r.updateBolts();
    }
    check(r.bolts.length === 1, 'la foudre s\'annonce');
    const b = r.bolts[0];
    r.grid.clear();
    r.grid.insert(p);
    r.time = b.at;
    r.updateBolts();
    check(r.map.treeDown.has(b.tree) && r.events.some((e: { e: string }) => e.e === 'thunder'), 'elle tombe : l\'arbre est abattu');
    check(Math.hypot(p.x - b.x, p.y - b.y) > 110 + p.r || p.hp < 1e4, 'ceux qui étaient tout près sont touchés');
  });


  rule('Sous la pluie, abattre un arbre attire parfois la foudre sur le bûcheron : étourdi, jamais achevé.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const d = r.map.decor.find((x: { kind: number; x: number; y: number }) => x.kind === 0 && r.map.zoneAt(x.x, x.y) === 1 && !r.map.caveAt(x.x, x.y));
    const t = r.map.trunkOf(d);
    [p.x, p.y] = [t.x + 30, t.y];
    p.hp = 3;
    r.rain = 1;
    r.snowing = false;
    const rand = Math.random;
    Math.random = () => 0; // la foudre tombe à coup sûr
    r.treeHp.set(d.id, 0.001);
    r.chop(p, d.id);
    Math.random = rand;
    check(r.events.some((e: { e: string; id: number }) => e.e === 'struck' && e.id === p.id), 'la foudre tombe sur lui');
    check(r.rooted(p) && p.hp >= 1 && !p.dead, 'il est étourdi, mais jamais achevé');
    r.events.length = 0;
    r.rain = 0;
    r.map.treeDown.delete(d.id);
    r.treeHp.set(d.id, 0.001);
    Math.random = () => 0;
    r.chop(p, d.id);
    Math.random = rand;
    check(!r.events.some((e: { e: string }) => e.e === 'struck'), 'par temps sec, jamais');
  });

  rule("Tempêtes de sable : chacune a son vent, d'un côté ou de l'autre selon la tempête ; il ne tourne pas pendant qu'elle souffle, et c'est le même pour tout le village.", () => {
    const seed = room().seed, SLOT = 5 * 60_000, t0 = Date.parse('2026-01-01T00:00:00Z');
    // le cœur des tranches de tempête (au milieu de la tranche : pas de fondu)
    const storms: number[] = [];
    for (let k = 0; storms.length < 24 && k < 4000; k++) {
      const t = Math.floor(t0 / SLOT) * SLOT + k * SLOT + SLOT / 2;
      if (sky(seed, t).storm > 0.7) storms.push(t);
    }
    check(storms.length === 24, `${storms.length} tempêtes trouvées`);
    const winds = storms.map((t) => sky(seed, t).wind);
    check(winds.every((w) => Math.abs(Math.hypot(w.x, w.y) - 1) < 1e-9), 'le vent est une direction (vecteur unité)');
    const sides = new Set(winds.map((w) => (Math.abs(w.x) > Math.abs(w.y) ? (w.x > 0 ? 'vers l\'est' : 'vers l\'ouest') : w.y > 0 ? 'vers le sud' : 'vers le nord')));
    check(sides.size === 4, `sur 24 tempêtes, le vent souffle ${[...sides].join(', ')}`);
    const steady = storms.every((t) => {
      const a = sky(seed, t - 90_000).wind, b = sky(seed, t + 90_000).wind;
      return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
    });
    check(steady, 'pendant une tempête (3 minutes au cœur de sa tranche), le vent garde son sens');
    const again = sky(seed, storms[0]).wind;
    check(again.x === winds[0].x && again.y === winds[0].y, 'même graine, même heure : même vent (tous les joueurs du village le voient pareil)');
  });
});
