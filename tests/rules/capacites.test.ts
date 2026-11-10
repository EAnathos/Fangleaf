// Capacités actives de spécialisation (les six voies). Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { abilityOf, ARMOR_MAX, FRENZY_VULN, RAMPART_GUARD, SPECIES, SWORD_PULLS, WEAPON_MAX, type ClassId, type SpecId } from '../../shared/config.ts';

const CLASS_OF: Record<SpecId, ClassId> = {
  berserker: 'warrior', guardian: 'warrior', sniper: 'archer', ranger: 'archer', pyromancer: 'mage', druid: 'mage',
};

/** Un point dégagé sur le chemin principal (la capacité peut s'y déployer et un sauvage s'y tenir). */
function openSpot(r: any): { x: number; y: number } {
  for (let s = r.map.gates[0] + 450; s < r.map.zoneTo(2); s += 120) {
    const c = r.map.spineAt(s);
    if (r.map.passable(c.x, c.y, false, false) && r.map.passable(c.x + 90, c.y, false, false)) return { x: c.x, y: c.y };
  }
  throw new Error('aucun point dégagé trouvé');
}

/** Dompteur spécialisé, armé, avec une arme, sur terrain dégagé. Option : un monstre sauvage hostile à portée (grille peuplée). */
function setup(r: any, spec: SpecId, withFoe = true) {
  const p = r.addPlayer('a', noop);
  p.cls = CLASS_OF[spec];
  p.spec = spec;
  p.weapon = 6;
  const spot = openSpot(r);
  p.x = spot.x;
  p.y = spot.y;
  p.fx = 1;
  p.fy = 0;
  let w: any;
  if (withFoe) {
    const s = SPECIES.findIndex((sp: any) => !sp.boss && !sp.passive && !sp.minion);
    w = r.createUnit(s, false, p.x + 70, p.y); // owner 0 : sauvage
    w.maxHp = w.hp = 100000; // assez robuste pour survivre au coup (on veut le voir marqué / brûlé, pas mort)
  }
  r.grid.clear();
  r.grid.insert(p);
  if (w) r.grid.insert(w);
  return { p, w };
}

describe('Capacités de spécialisation', () => {
  rule('Chaque voie a sa capacité ; sans spécialisation, aucune.', () => {
    check(abilityOf('berserker')?.name === 'Frénésie', 'Berserker → Frénésie');
    check(abilityOf('guardian')?.name === 'Rempart', 'Gardien → Rempart');
    check(abilityOf('sniper')?.name === 'Tir de rupture', 'Tireur d\'élite → Tir de rupture');
    check(abilityOf('ranger')?.name === 'Pluie de flèches', 'Rôdeur → Pluie de flèches');
    check(abilityOf('pyromancer')?.name === 'Météore', 'Pyromancien → Météore');
    check(abilityOf('druid')?.name === 'Floraison', 'Druide → Floraison');
    check(abilityOf(null) === undefined, 'pas de capacité avant la spécialisation');
  });

  rule('Pas de capacité tant qu\'on n\'est pas spécialisé.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.cls = 'warrior';
    p.spec = null;
    const [x0, y0] = [p.x, p.y];
    r.onAbility(p);
    check(p.x === x0 && p.y === y0 && !p.frenzy, 'un guerrier non spécialisé ne déclenche rien');
  });

  rule('Berserker — Frénésie : rage sur soi, et on encaisse plus.', () => {
    const r = room();
    const { p, w } = setup(r, 'berserker');
    r.onAbility(p);
    check((p.frenzy?.until ?? 0) > r.time, 'la frénésie est active');
    // on encaisse plus pendant la frénésie
    p.hp = p.maxHp = 1000;
    r.damage(p, 100, w);
    const hurtFrenzy = 1000 - p.hp;
    p.frenzy = undefined;
    p.hp = 1000;
    r.damage(p, 100, w);
    const hurtNormal = 1000 - p.hp;
    check(hurtFrenzy > hurtNormal, `plus de dégâts subis en frénésie (${hurtNormal} → ${hurtFrenzy}, ×${FRENZY_VULN})`);
  });

  rule('Gardien — Rempart : les alliés autour encaissent moins.', () => {
    const r = room();
    const { p } = setup(r, 'guardian', false);
    r.onAbility(p);
    check((p.guard?.until ?? 0) > r.time && p.guard.v === RAMPART_GUARD, 'le dompteur gagne la réduction du Rempart');
  });

  rule('Tireur d\'élite — Tir de rupture : la cible la plus proche est marquée (plus de dégâts subis).', () => {
    const r = room();
    const { p, w } = setup(r, 'sniper');
    r.onAbility(p);
    check((w.curseUntil ?? 0) > r.time, 'le monstre le plus proche est marqué');
  });

  rule('Rôdeur — Pluie de flèches : la zone autour de la cible est arrosée (sans téléporter le dompteur).', () => {
    const r = room();
    const { p, w } = setup(r, 'ranger');
    const [x0, y0] = [p.x, p.y];
    r.onAbility(p);
    check(p.x === x0 && p.y === y0, 'le dompteur ne bouge pas (plus de téléport)');
    check(w.hp < w.maxHp, 'le monstre dans la zone est touché par la pluie');
  });

  rule('Pyromancien — Météore : impact sur la cible proche, puis un brasier qui ronge.', () => {
    const r = room();
    const { p, w } = setup(r, 'pyromancer');
    r.onAbility(p);
    check(w.hp < w.maxHp, 'l\'impact a touché');
    check((w.scorch?.until ?? 0) > r.time, 'le brasier ronge la cible');
  });

  rule('Druide — Floraison : les alliés blessés proches regagnent des PV.', () => {
    const r = room();
    const { p } = setup(r, 'druid', false);
    p.hp = 10; // blessé
    const before = p.hp;
    r.onAbility(p);
    check(p.hp > before, `le dompteur blessé est soigné (${before} → ${p.hp})`);
    check((p.bloom?.until ?? 0) > r.time, 'la régénération est en cours');
  });

  rule('Tir de rupture : sans cible à marquer, la recharge n\'est pas consommée.', () => {
    const r = room();
    const { p } = setup(r, 'sniper', false); // aucune cible
    r.onAbility(p);
    check(r.time - p.abilityAt > 1000 || p.abilityAt === -Infinity, 'pas de recharge entamée sans cible');
  });

  rule('Dev : s\'équiper d\'un coup pose la spé et débloque la capacité.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.sword = 0;
    r.onCheatGear(p, 'mage', 'pyromancer');
    check(p.cls === 'mage' && p.spec === 'pyromancer', 'classe et spécialisation posées');
    check(p.weapon === WEAPON_MAX && p.armor === ARMOR_MAX && p.sword === SWORD_PULLS, 'arme et armure au max, armé');
    check(abilityOf(p.spec)?.name === 'Météore', 'la capacité de la spé est débloquée');
  });
});
