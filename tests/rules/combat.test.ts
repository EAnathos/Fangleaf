// Combat des dompteurs. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { alphaCreateCost, DT, REVIVE_HOLD_S, REVIVE_R, REVIVE_WINDOW_S, armorMaxHp, DEATH_GOLD_LOSS, SPECIES } from '../../shared/config.ts';

describe('Combat des dompteurs', () => {
  rule('Mort : la meute se disperse, les Alphas restent.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.den.x;
    p.y = r.map.den.y;
    p.essences[1] = alphaCreateCost(1);
    r.onAlphaCreate(p, 1);
    r.onCheat(p);
    r.step();
    for (let i = 0; i < 3; i++) {
      const u = r.createUnit(0, false, 600, 0);
      u.owner = p.id;
      p.army.push(u.id);
    }
    check(p.army.length === 4, 'meute de 3 + 1 Alpha');
    r.killPlayer(p);
    check(p.army.length === 1 && r.units.get(p.army[0]).alpha, 'à la mort, seul l\'Alpha reste');
  });

  rule('Pas de régénération hors du village, régénération au village.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.spawn.x;
    p.y = r.map.spawn.y;
    p.hp = 20;
    for (let i = 0; i < 40; i++) r.regen();
    check(p.hp === 20, 'aucune régénération hors du village');
    p.x = r.map.village.x;
    p.y = r.map.village.y;
    for (let i = 0; i < 40; i++) r.regen();
    check(p.hp > 20, 'régénération au village');
  });

  rule('Monstres sauvages : récupération progressive quand on cesse de les frapper.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    const w = [...r.units.values()].find((u: { owner: number }) => !u.owner);
    r.damage(w, w.maxHp / 2, p);
    const hit = w.hp;
    for (let i = 0; i < 20 * 3; i++) r.regen(), (r.time += 1 / 20); // 3 s : encore « en combat »
    check(w.hp === hit, 'pas de récupération juste après un coup');
    for (let i = 0; i < 20 * 3; i++) r.regen(), (r.time += 1 / 20); // puis 3 s de calme
    check(w.hp > hit && w.hp < w.maxHp, `récupération progressive ensuite (${Math.round(hit)} → ${Math.round(w.hp)} / ${w.maxHp})`);
  });

  rule('Les monstres sauvages attaquent en priorité le plus proche (dompteur ou monstre de meute).', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const spot = r.map.freeNear(r.map.spawn.x + 500, r.map.spawn.y);
    [p.x, p.y] = [spot.x + 150, spot.y];
    const w = r.createUnit(1, false, spot.x, spot.y);
    const f = r.createUnit(0, false, spot.x + 50, spot.y);
    r.makeTamed(f, p);
    r.grid.clear();
    for (const e of [p, w, f]) r.grid.insert(e);
    r.wildAI(w);
    check(w.target === f.id, 'le monstre de meute plus proche est attaqué en premier');
    [f.x, f.y] = [spot.x + 400, spot.y + 300];
    r.grid.clear();
    for (const e of [p, w, f]) r.grid.insert(e);
    r.wildAI(w);
    check(w.target === p.id, 'puis le dompteur quand il devient le plus proche');
  });

  rule('Classes : choix à la forge, premier gratuit, changement payant ; portée et PV selon la classe.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.forge.x, r.map.forge.y];
    p.gold = 100;
    r.onClass(p, 'archer');
    check(p.cls === 'archer' && p.gold === 100, 'première classe gratuite (archer)');
    r.onClass(p, 'mage');
    check(p.cls === 'mage' && p.gold === 50, 'changer de classe coûte 50 or');
    p.gold = 10;
    r.onClass(p, 'warrior');
    check(p.cls === 'mage', 'pas assez d\'or : on garde sa classe');
    check(r.profileOf(p).class === 'mage', 'classe sauvegardée');

    // Portée : un archer touche de loin, un guerrier non.
    r.units.clear();
    const shoot = (cls: string) => {
      p.cls = cls;
      p.atkCd = 0;
      const w = r.createUnit(0, false, p.x + 200, p.y);
      w.maxHp = w.hp = 999;
      r.grid.clear();
      r.grid.insert(w);
      r.playerAttack(p);
      const hit = w.hp < 999;
      r.units.delete(w.id);
      return hit;
    };
    check(shoot('archer') && !shoot('warrior'), 'à 200 px : l\'archer touche, le guerrier non');
    // Mage : l'orbe touche tous les monstres autour de la cible.
    p.cls = 'mage';
    p.atkCd = 0;
    const a = r.createUnit(0, false, p.x + 150, p.y), b = r.createUnit(0, false, p.x + 190, p.y + 20);
    a.maxHp = a.hp = b.maxHp = b.hp = 999;
    r.grid.clear();
    r.grid.insert(a);
    r.grid.insert(b);
    r.playerAttack(p);
    check(a.hp < 999 && b.hp < 999, 'l\'orbe du mage touche deux monstres d\'un coup');
  });

  rule('Relever un coéquipier : R maintenu 5 s près du corps, dans les 10 s.', () => {
    const r = room();
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    q.x = p.x + 40;
    q.y = p.y;
    const body = { x: p.x, y: p.y };
    r.killPlayer(p);
    check(p.respawnAt - r.time === REVIVE_WINDOW_S, `un coéquipier connecté : ${REVIVE_WINDOW_S} s pour être relevé`);
    r.onHelp(q, true);
    for (let i = 0; i < Math.round((REVIVE_HOLD_S / 2) / DT); i++) r.updateRevives();
    r.onHelp(q, false);
    r.updateRevives();
    check(p.dead && p.reviveT === 0, 'R relâché : la réanimation repart de zéro');
    r.onHelp(q, true);
    q.x = p.x + REVIVE_R + 50;
    for (let i = 0; i < Math.round(REVIVE_HOLD_S / DT) + 2; i++) r.updateRevives();
    check(p.dead, 'trop loin du corps : pas de réanimation');
    q.x = p.x + 40;
    for (let i = 0; i < Math.round(REVIVE_HOLD_S / DT) + 2; i++) r.updateRevives();
    check(!p.dead && p.x === body.x && p.y === body.y, 'relevé sur place après 5 s');
    check(p.hp > 0 && p.hp < armorMaxHp(p.armor), `relevé avec une partie de ses PV (${p.hp}/${armorMaxHp(p.armor)})`);
    // Réanimation en cours au moment où la fenêtre se ferme : on attend qu'elle aboutisse.
    r.killPlayer(p);
    r.time = p.respawnAt - 1;
    for (let i = 0; i < Math.round(3 / DT); i++) {
      r.time += DT;
      r.updateRevives();
      r.updateRespawns();
    }
    check(p.dead && p.reviveT > 0, 'réanimation en cours : le retour au camp attend');
    for (let i = 0; i < Math.round(REVIVE_HOLD_S / DT); i++) r.updateRevives();
    check(!p.dead && p.x === body.x, 'puis le dompteur est relevé sur place');
  });

  rule('Mort : une part de l\'or est perdue ; mage : dégâts dégressifs loin du point d\'impact ; meute en promenade au village.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.gold = 105;
    r.killPlayer(p);
    check(p.gold === 105 - Math.floor(105 * DEATH_GOLD_LOSS), `mort : ${Math.floor(105 * DEATH_GOLD_LOSS)} or perdus sur 105`);
    r.time = p.respawnAt + 1;
    r.updateRespawns();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    p.cls = 'mage';
    p.atkCd = 0;
    [p.x, p.y] = [r.map.spawn.x, r.map.spawn.y];
    const a = r.createUnit(3, false, p.x + 150, p.y), b = r.createUnit(3, false, p.x + 150, p.y + 70);
    r.grid.clear();
    for (const e of [p, a, b]) r.grid.insert(e);
    r.playerAttack(p);
    const da = a.maxHp - a.hp, db = b.maxHp - b.hp;
    check(da > 0 && db > 0 && db < da * 0.75, `orbe du mage : ${da.toFixed(1)} au point d'impact, ${db.toFixed(1)} à 70 px`);
    // Au village, la meute flâne sur la place au lieu de rester en formation.
    [p.x, p.y] = [r.map.village.x, r.map.village.y + 40];
    const f = r.createUnit(1, false, p.x + 30, p.y);
    r.makeTamed(f, p);
    const spots = new Set<string>();
    for (let i = 0; i < 20 * 30; i++) {
      r.step();
      if (i % 20 === 0) spots.add(`${Math.round(f.x / 60)},${Math.round(f.y / 60)}`);
    }
    check(spots.size >= 4 && r.map.inVillage(f.x, f.y), `au village, le Loup de la meute se promène (${spots.size} coins visités)`);
  });

  rule('Attaque au clic (PC) : rien sans ordre, puis on frappe le monstre visé.', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.spawn.x, r.map.spawn.y];
    const foe = r.createUnit(3, false, p.x + 40, p.y);
    foe.hp = foe.maxHp = 9999;
    foe.dmg = 0; // il ne tue pas le dompteur pendant le test
    r.onMode(p, true);
    for (let i = 0; i < 20 * 2; i++) r.step();
    check(foe.hp === 9999, 'attaque au clic : sans clic, pas de coup');
    r.onAttack(p, foe.x, foe.y);
    for (let i = 0; i < 4; i++) r.step();
    check(foe.hp < 9999, 'un clic sur le monstre : il est frappé');
    // dans le vide : le coup part quand même, mais un gibier passif n'est jamais touché
    const hare = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'snail'), false, p.x - 30, p.y);
    const before = foe.hp;
    p.atkCd = 0;
    r.onAttack(p, p.x - 200, p.y);
    for (let i = 0; i < 3; i++) r.step();
    check(foe.hp === before && hare.hp === hare.maxHp, 'clic vers l\'escargot : ni lui (gibier passif) ni le golem derrière ne sont touchés');
    p.cls = 'archer';
    p.atkCd = 0;
    const far = r.createUnit(3, false, p.x, p.y - 250);
    far.dmg = 0;
    r.onAttack(p, p.x, p.y - 400);
    for (let i = 0; i < 3; i++) r.step();
    check(far.hp < far.maxHp, 'archer : la flèche part vers le haut et touche le premier monstre sur sa route');
    p.cls = null;
    r.onMode(p, false);
    const hp = foe.hp;
    for (let i = 0; i < 20 * 2; i++) r.step();
    check(foe.hp < hp, 'retour à l\'attaque automatique');
  });

  rule('Arrivée au village : tous ses PV, classe comprise (nouveau dompteur : 75/75, pas 60/75).', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    check(p.hp === Math.round(armorMaxHp(0) * 1.25), `nouveau dompteur : ${p.hp} PV à l'arrivée, le maximum`);
  });
});
