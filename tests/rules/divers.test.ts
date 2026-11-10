// Petites règles : gibier apprivoisé, baies, lave du volcan, embarquement, brûlure, vautour et tempête, récolte, chapeaux. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { armyCap, BOAT_STAGES, DESERT_ZONE, HEART_IN_BOAT, HAT_WEAPON_BONUS, RANGED_GATHER, SPECIES, STORM_HARM, TICK_HZ, treeHp } from '../../shared/config.ts';

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

  rule('À dos de vautour, le dard du scorpion ne nous atteint pas (ni coup, ni poison).', () => {
    const r = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const lane = m.spineAt(m.zoneFrom(1) + 400);
    [p.x, p.y] = [lane.x, lane.y];
    const mount = r.spawnAlpha(p, S('vulture'), 0, false);
    [mount.x, mount.y] = [p.x, p.y];
    r.onMount(p, mount.id);
    const sc = r.createUnit(S('scorpion'), false, p.x + 30, p.y), hp0 = p.hp, mhp0 = mount.hp;
    sc.atkCd = 0;
    r.tryAttack(sc, p);
    check(p.hp === hp0 && mount.hp === mhp0 && !p.poison, 'ni blessé, ni empoisonné');
  });

  rule('Wyvernes et dragonnets volent par-dessus l\'eau (le drake, sans ailes, non).', () => {
    const r = room(), m = r.map;
    r.units.clear();
    const lake = m.deepWater.find((pool: number[]) => pool.length);
    const [wx, wy] = [lake[0], lake[1]];
    check(m.isWater(wx, wy), 'un point d\'eau');
    const wy0 = r.createUnit(S('wyvern'), false, wx, wy), dr = r.createUnit(S('drake'), false, wx, wy);
    check(!r.blockedFor(wy0, wx, wy) && r.blockedFor(dr, wx, wy), 'la wyverne survole l\'eau, pas le drake');
    check(!!SPECIES[S('dragon')].wings && !SPECIES[S('drake')].wings, 'le dragonnet a des ailes, le drake non');
  });

  rule('Tempête de sable : on ne monte pas son vautour, et un cavalier qui y entre met pied à terre.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const at = m.spineAt(m.zoneFrom(DESERT_ZONE) + 900);
    [p.x, p.y] = [at.x, at.y];
    const vul = r.spawnAlpha(p, S('vulture'), 0, false);
    [vul.x, vul.y] = [p.x + 20, p.y];
    r.storm = 1;
    r.onMount(p, vul.id);
    check(p.mount === 0, 'en pleine tempête : il refuse de décoller');
    r.storm = 0;
    r.onMount(p, vul.id);
    check(p.mount === vul.id, 'le calme revenu : en selle');
    r.storm = STORM_HARM + 0.1;
    r.tick = TICK_HZ * 10;
    r.stormDamage();
    check(p.mount === 0, 'la tempête se lève : il met pied à terre');
  });

  rule('Un vautour posé près de sa proie redécolle quand on le monte : on vole au-dessus de l\'eau sans se bloquer.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const vul = r.spawnAlpha(p, S('vulture'), 0, false);
    [vul.x, vul.y] = [p.x + 20, p.y];
    vul.perched = true;
    r.onMount(p, vul.id);
    check(r.airborne(p) && r.airborne(vul), 'cavalier et monture volent ensemble (le client ne le voit plus « posé »)');
    // perdu au-dessus de l'eau sans monture (elle est tombée) : il est reposé sur la terre ferme au lieu de rester coincé
    const w = m.deepWater.find((a: number[]) => a?.length);
    [p.x, p.y] = [w[0], w[1]];
    p.mount = 0;
    p.lastPosMs = Date.now() - 100;
    r.onPos(p, p.x + 10, p.y, 1, 0);
    check(!m.blocked(p.x, p.y), 'coincé dans l\'eau : remis à terre');
  });

  rule('Archers et mages récoltent 30 % moins vite que les guerriers.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    const i = m.decor.findIndex((d: { kind: number; zone: number }) => d.kind === 0 && d.zone === 1);
    const d = m.decor[i], full = treeHp(d.zone) * m.treeScale(d);
    const hit = (cls: string | null) => {
      const p = r.addPlayer(cls ?? 'g', noop);
      p.cls = cls;
      r.treeHp.delete(i);
      r.chop(p, i);
      r.removePlayer(p.id);
      return full - r.treeHp.get(i);
    };
    const war = hit('warrior');
    check(Math.abs(hit('archer') - war * RANGED_GATHER) < 1e-6 && Math.abs(hit('mage') - war * RANGED_GATHER) < 1e-6, `archer et mage : ${RANGED_GATHER * 100} % des coups d'un guerrier`);
  });

  rule('Chaque chapeau débloqué renforce l\'arme de 10 %.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    p.cls = 'warrior';
    const hit = (hats: number[]) => {
      p.hats = hats;
      const u = r.createUnit(S('slime'), false, p.x + 30, p.y);
      u.hp = u.maxHp = 1e6;
      r.grid.clear();
      r.grid.insert(p);
      r.grid.insert(u);
      p.atkCd = 0;
      r.playerAttack(p);
      r.units.delete(u.id);
      return 1e6 - u.hp;
    };
    const bare = hit([]), two = hit([1, 2]);
    check(bare > 0 && Math.abs(two / bare - (1 + 2 * HAT_WEAPON_BONUS)) < 0.02, `deux chapeaux : ×${(two / bare).toFixed(2)}`);
  });

  rule('Touche de récolte : le Tréant de la meute abat les arbres même avec des monstres autour.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const tree = m.decor.find((d: { kind: number; zone: number; id: number }) => d.kind === 0 && d.zone === 1 && !m.treeDown.has(d.id));
    const t = m.trunkOf(tree);
    [p.x, p.y] = [t.x + 120, t.y];
    const tr = r.createUnit(S('treant'), false, t.x + 60, t.y);
    r.makeTamed(tr, p);
    const foe = r.createUnit(S('slime'), false, p.x + 60, p.y);
    foe.hp = foe.maxHp = 1e6;
    r.onHarvest(p, true);
    for (let i = 0; i < TICK_HZ * 6; i++) {
      p.hp = 1e6;
      r.step();
    }
    check(r.treeHp.has(m.decor.indexOf(tree)) || m.treeDown.has(m.decor.indexOf(tree)), 'il s\'occupe de l\'arbre');
    check(tr.target === 0, '… sans prendre le monstre pour cible');
  });
});
