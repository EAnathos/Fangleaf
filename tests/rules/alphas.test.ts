// Alphas de la Tanière. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { ALPHA_SHOUT_CD, ALPHA_SHOUT_R, ALPHA_SHOUT_S, alphaPerk, alphaCreateCost, ARMY_CAP, PLAYER_RESPAWN_S, armorMaxHp, SPECIES, alphaAwakenS, alphaStats, alphaUpCost, ALPHA_MULT } from '../../shared/config.ts';

describe('Alphas de la Tanière', () => {
  rule('Tanière : éveiller un Alpha avec des essences, le renforcer (de plus en plus cher), sauvegarde du profil.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.den.x;
    p.y = r.map.den.y;
    p.essences[1] = alphaCreateCost(1) - 1;
    r.onAlphaCreate(p, 1);
    check(p.army.length === 0, 'pas assez d\'essences : pas d\'éveil');
    p.essences[1] = alphaCreateCost(1) * 2;
    r.onAlphaCreate(p, 1);
    r.onAlphaCreate(p, 1);
    check(p.army.length === 0 && p.awakening.has(1) && p.essences[1] === alphaCreateCost(1), `éveil lancé, pas encore là (${alphaAwakenS(1)} s pour un Loup)`);
    r.step();
    check(p.army.length === 0, 'toujours en éveil au tick suivant');
    p.awakening.set(1, Date.now() - 1); // le temps est écoulé
    p.x = r.map.den.x; // (rester sur place)
    r.step();
    check(p.army.length === 1 && r.units.get(p.army[0]).alpha, 'Alpha Loup éveillé, un seul par espèce');
    const a = r.units.get(p.army[0]);
    const hp0 = a.maxHp;
    check(a.maxHp === Math.round(SPECIES[1].hp * ALPHA_MULT.hp * 1.05) && a.dmg === Math.round(SPECIES[1].dmg * ALPHA_MULT.dmg * 1.05), `Alpha niv. 0 = ${ALPHA_MULT.hp}× le Loup, +5 % de collection (PV ${a.maxHp}, dégâts ${a.dmg})`);
    p.essences[1] = alphaUpCost(1, 0);
    r.onAlphaUp(p, a.s);
    check(a.level === 1 && a.maxHp > hp0 && p.essences[1] === 0, `Alpha renforcé (PV ${hp0} → ${a.maxHp})`);
    r.onAlphaUp(p, a.s);
    check(a.level === 1, 'pas assez d\'essences : refusé');
    check(alphaUpCost(0, 1) > alphaUpCost(0, 0) && alphaUpCost(0, 5) > 3 * alphaUpCost(0, 1), `coûts croissants : ${[0, 1, 2, 3, 4, 5].map((l) => alphaUpCost(0, l)).join(', ')}…`);
    const jackal = SPECIES.findIndex((sp) => sp.key === 'jackal');
    check(alphaUpCost(1, 0) > alphaUpCost(0, 0) && alphaUpCost(jackal, 0) > alphaUpCost(1, 0), `un peu plus cher à chaque zone (niv. 0 : ${alphaUpCost(0, 0)}, ${alphaUpCost(1, 0)}, ${alphaUpCost(jackal, 0)})`);

    // Les Alphas ne comptent pas dans la limite de meute.
    for (let i = 0; i < ARMY_CAP; i++) {
      const u = r.createUnit(0, false, 600, 0);
      u.owner = p.id;
      p.army.push(u.id);
    }
    check(r.armySize(p) === ARMY_CAP, 'limite de meute hors Alphas');

    p.essences[2] = alphaCreateCost(2);
    r.onAlphaCreate(p, 2);
    const prof = r.profileOf(p);
    check(prof.alphas.some((a: { s: number; wakeAt?: number }) => a.s === 2 && a.wakeAt), 'éveil en cours sauvegardé dans le profil');
    check(prof.alphas.filter((x: { wakeAt?: number }) => !x.wakeAt).length === 1 && prof.alphas[0].lvl === 1, 'le profil ne garde que les Alphas (pas la meute ordinaire)');
    const r2 = room();
    const p2 = r2.addPlayer('a', noop, { userId: 'u1', profile: prof });
    const back = r2.units.get(p2.army[0]);
    check(back?.alpha && back.level === 1 && back.maxHp === a.maxHp, 'profil rechargé : Alpha recréé au bon niveau');
    check(p2.awakening.has(2) && p2.army.filter((id: number) => r2.units.get(id)?.alpha).length === 1, 'profil rechargé : l\'éveil du Sanglier continue');
  });

  rule('Aucun Alpha sauvage, même après beaucoup de kills.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    for (let i = 0; i < 40; i++) {
      const w = [...r.units.values()].find((u: { owner: number }) => !u.owner);
      if (w) r.killUnit(w, p);
    }
    check(![...r.units.values()].some((u: { owner: number; alpha: boolean }) => !u.owner && u.alpha), 'aucun Alpha sauvage après 40 kills');
  });

  rule('5 Alphas équipés au maximum ; les autres se reposent à la Tanière et comptent pour la collection.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.den.x, r.map.den.y];
    const kinds = [0, 1, 2, 3, 4, 5, 6];
    for (const s of kinds) {
      p.essences[s] = alphaCreateCost(s);
      r.onAlphaCreate(p, s);
    }
    r.onCheat(p);
    r.step();
    const field = () => p.army.filter((id: number) => r.units.get(id)?.alpha).length;
    check(field() === 5 && p.resting.length === 2, `7 Alphas éveillés : ${field()} équipés, ${p.resting.length} au repos`);
    const any = r.units.get(p.army.find((id: number) => r.units.get(id)?.alpha));
    check(any.maxHp === alphaStats(any.s, 0, 7).hp, 'le bonus de collection compte aussi les Alphas au repos (+35 %)');
    const restS = p.resting[0].s;
    r.onAlphaEquip(p, restS, true);
    check(field() === 5, 'impossible d\'en équiper un 6e');
    r.onAlphaEquip(p, any.s, false);
    r.onAlphaEquip(p, restS, true);
    check(field() === 5 && p.resting.some((x: { s: number }) => x.s === any.s) && !p.resting.some((x: { s: number }) => x.s === restS), 'ranger un Alpha libère une place pour un autre');
    p.essences[restS] = 999;
    const restLvl = p.resting.find((x: { s: number }) => x.s === any.s);
    p.essences[any.s] = 999;
    r.onAlphaUp(p, any.s);
    check(restLvl.lvl === 1, 'on peut renforcer un Alpha au repos');
    const prof = r.profileOf(p);
    const r2 = room();
    const p2 = r2.addPlayer('a', noop, { userId: 'u3', profile: prof });
    check(p2.army.filter((id: number) => r2.units.get(id)?.alpha).length === 5 && p2.resting.length === 2, 'équipés et rangés sont sauvegardés');
  });

  rule('Bonus de collection : +5 % par Alpha éveillé, pour tous (3 Alphas = +15 %).', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.den.x, r.map.den.y];
    for (const s of [0, 1, 2]) {
      p.essences[s] = alphaCreateCost(s);
      r.onAlphaCreate(p, s);
    }
    r.onCheat(p);
    r.step();
    const wolf = p.army.map((id: number) => r.units.get(id)).find((u: { s: number }) => u.s === 1);
    check(p.army.length === 3 && wolf.maxHp === alphaStats(1, 0, 3).hp && wolf.maxHp === Math.round(SPECIES[1].hp * ALPHA_MULT.hp * 1.15),
      `3 Alphas : +15 % chacun (Alpha Loup ${Math.round(SPECIES[1].hp * 2.5)} → ${wolf.maxHp} PV)`);
  });

  rule('Un Alpha tombé ne revient pas pendant un combat de géant : il attend la fin du combat.', () => {
    const r = room();
    const c = r.map.caves[0];
    const boss = r.units.get(r.caveBoss[c.id]);
    boss.dormant = false;
    boss.moveCd = boss.moveCd.map(() => 99);
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [c.exit.x, c.exit.y - 50];
    const a = r.createUnit(1, false, p.x, p.y);
    Object.assign(a, { owner: p.id, alpha: true, reviveAt: r.time + 0.01, hp: 0 });
    p.army.push(a.id);
    for (let i = 0; i < 5; i++) r.step();
    check(a.reviveAt > 0, 'géant réveillé : l\'Alpha attend');
    r.units.delete(boss.id); // combat fini
    for (let i = 0; i < 5; i++) r.step();
    check(a.reviveAt === 0 && a.hp === a.maxHp, 'combat fini : l\'Alpha revient aussitôt');
  });

  rule('Alpha tombé pendant que son dompteur est à terre : il attend que le dompteur soit debout.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    const wolf = r.spawnAlpha(p, 1, 0, false);
    const foe = r.createUnit(1, false, p.x + 30, p.y);
    r.killUnit(wolf, foe);
    r.killPlayer(p);
    check(p.respawnAt - r.time === PLAYER_RESPAWN_S, 'seul au village : retour au camp après le délai normal');
    r.time = Math.max(wolf.reviveAt, p.respawnAt) - 0.01;
    r.updateRespawns();
    check(wolf.reviveAt > 0, 'dompteur à terre : l\'Alpha ne ressuscite pas près du corps');
    r.time += 1;
    r.updateRespawns();
    check(!p.dead && !wolf.reviveAt && Math.hypot(wolf.x - p.x, wolf.y - p.y) < 200, 'dompteur debout : l\'Alpha revient à ses côtés');
  });

  rule('Alpha légendaire : il lance seul l\'attaque spéciale de son géant, qui ne touche que les sauvages.', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const moves: string[] = [];
    let friendlyFire = 0, bearId = 0, foeId = 0, foeHits = 0;
    const p = r.addPlayer('a', (m: { t: string; ev?: { e: string; id?: number; kind?: string; a?: number; b?: number }[] }) => {
      for (const e of m.ev ?? []) {
        if (e.e === 'move') moves.push(e.kind!);
        if (e.e === 'hit' && e.a === bearId && e.b === p.id) friendlyFire++;
        if (e.e === 'hit' && e.b === foeId) foeHits++;
      }
    });
    [p.x, p.y] = [r.map.spawn.x, r.map.spawn.y + 80];
    p.hp = p.maxHp = 9999;
    const bear = r.spawnAlpha(p, 6, 3, true); // Ours légendaire : Onde de choc et Rage du Colosse
    bearId = bear.id;
    [bear.x, bear.y] = [p.x + 40, p.y];
    const foe = r.createUnit(3, false, p.x + 120, p.y);
    foe.hp = foe.maxHp = 99999;
    foeId = foe.id;
    p.atkCd = 9999;
    for (let i = 0; i < 20 * 12; i++) {
      r.step();
      p.atkCd = 9999;
      p.hp = Math.max(p.hp, 9000);
    }
    check(moves.includes('slam'), `Ours légendaire : ${[...new Set(moves)].join(', ') || 'aucune'} attaque spéciale lancée`);
    // (on compte les coups : le sauvage récupère vite ses PV quand on ne le frappe plus)
    check(foeHits > 0 && friendlyFire === 0, `elle frappe le sauvage (${foeHits} coups) sans toucher son dompteur`);
  });

  rule('Champignon légendaire : un seul nuage de spores, sur sa cible (pas un par monstre autour).', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.spawn.x, r.map.spawn.y + 80];
    const shroom = r.spawnAlpha(p, 4, 0, true);
    const foes = [0, 1, 2].map((k: number) => r.createUnit(3, false, p.x + 100 + k * 40, p.y));
    r.grid.clear();
    for (const e of [p, shroom, ...foes]) r.grid.insert(e);
    r.castMove(shroom, { kind: 'spores', cd: 5 }, foes[0]);
    check(r.hazards.filter((h: { kind: number }) => h.kind === 2).length === 1, 'Champignon légendaire : une seule zone de spores');
  });

  rule('Alpha lièvre : il soigne un peu son dompteur, et sa meute proche.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.spawn.x;
    p.y = r.map.spawn.y;
    const hareS = SPECIES.findIndex((s) => s.key === 'hare');
    const hare = r.spawnAlpha(p, hareS, 0, false);
    [hare.x, hare.y] = [p.x + 50, p.y];
    const ally = r.createUnit(0, false, p.x - 60, p.y);
    r.makeTamed(ally, p);
    ally.hp = 1;
    const max = Math.round(armorMaxHp(0));
    p.hp = 10;
    const evs: { e: string; n?: number }[] = [];
    for (let i = 0; i < 20 * 3; i++) {
      r.tick++;
      r.events = [];
      r.alphaHeals();
      evs.push(...r.events.filter((e: { e: string }) => e.e === 'heal'));
    }
    check(evs.length === 1 && p.hp === 10 + Math.round(max * 0.03) && ally.hp > 1, `lièvre : +${evs[0]?.n} PV en 3 s pour son dompteur (${max} PV max), et la meute proche est soignée`);
  });

  rule('Cri du suricate, carapace de l\'escargot : au combat, tous les alliés proches en profitent un moment, puis la compétence se recharge.', () => {
    const r = room();
    const key = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // le champ de bataille, sans témoin
    const p = r.addPlayer('chef', noop), q = r.addPlayer('ami', noop);
    const at = r.map.spineAt(r.map.zoneFrom(2) + 600);
    [p.x, p.y, q.x, q.y] = [at.x, at.y, at.x + 90, at.y];
    const meerkat = r.spawnAlpha(p, key('meerkat'), 2, false);
    [meerkat.x, meerkat.y] = [at.x + 20, at.y + 20];
    const pet = r.createUnit(key('wolf'), false, at.x - 60, at.y);
    r.makeTamed(pet, q);
    const far = r.createUnit(key('wolf'), false, at.x + ALPHA_SHOUT_R + 200, at.y);
    r.makeTamed(far, q);
    [far.x, far.y] = [at.x + ALPHA_SHOUT_R + 200, at.y];
    const sync = () => {
      r.grid.clear();
      for (const e of [p, q, ...r.units.values()]) r.grid.insert(e);
      r.tick = 5;
      r.alphaShouts();
    };
    sync();
    check(r.buffOf(p, 'rally') === 0, 'pas d\'ennemi en vue : il ne crie pas');
    const wolf = r.createUnit(key('wolf'), false, at.x + 150, at.y);
    sync();
    const v = alphaPerk(key('meerkat'), 2)!.value;
    check(r.events.some((e: { e: string; kind?: string }) => e.e === 'shout' && e.kind === 'rally'), 'un ennemi approche : le suricate se dresse et crie');
    check(Math.abs(r.buffOf(p, 'rally') - v) < 1e-9 && r.buffOf(q, 'rally') === v && r.buffOf(pet, 'rally') === v, `son dompteur, l'autre dompteur et sa meute : +${Math.round(v * 100)} % de dégâts`);
    check(r.buffOf(far, 'rally') === 0 && r.buffOf(wolf, 'rally') === 0, 'trop loin, ou ennemi : rien');
    const hp = wolf.hp;
    r.damage(wolf, 10, pet);
    check(Math.abs(hp - wolf.hp - 10 * (1 + v)) < 1e-6, `le loup de l'ami frappe plus fort (${(hp - wolf.hp).toFixed(1)} au lieu de 10)`);
    r.time += ALPHA_SHOUT_S + 0.1;
    check(r.buffOf(p, 'rally') === 0, `au bout de ${ALPHA_SHOUT_S} s, l'effet retombe`);
    sync();
    check(r.buffOf(p, 'rally') === 0, `recharge : ${ALPHA_SHOUT_CD} s, un peu plus que l'effet`);
    r.time += ALPHA_SHOUT_CD - ALPHA_SHOUT_S;
    sync();
    check(r.buffOf(p, 'rally') > 0, 'rechargé : il crie à nouveau');

    // L'escargot de l'ami : sa carapace abrite aussi le dompteur d'à côté et les meutes.
    const snail = r.spawnAlpha(q, key('snail'), 0, false);
    [snail.x, snail.y] = [at.x + 60, at.y - 20];
    sync();
    const g = alphaPerk(key('snail'), 0)!.value, before = pet.hp;
    check(r.buffOf(p, 'guard') === g && r.buffOf(meerkat, 'guard') === g, `carapace : −${Math.round(g * 100)} % de dégâts reçus pour tous les alliés proches`);
    r.damage(pet, 20, wolf);
    check(Math.abs(before - pet.hp - 20 * (1 - g)) < 1e-6, `un coup de 20 sur la meute : ${(before - pet.hp).toFixed(1)}`);
    const st = r.players.get(p.id), flags = r.buffOf(st, 'guard') && r.buffOf(st, 'rally');
    check(flags, 'les deux effets se cumulent');
  });
});
