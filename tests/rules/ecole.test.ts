// École des dompteurs : livres d'apprentissage des coffres de géants (plusieurs disciplines), leçons de 30 minutes. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { ALPHA_EQUIP_MAX, alphaEquipMax, ARMY_CAP, armyCap, VOLCANO_ZONE, BOOKS, bookIndex, BUILDING_IDS, DISCIPLINES, HALL_MAX, LESSON_KINDS, LESSON_MS, LESSONS, lessonBonus, SPECIES, tomeOfZone, TOMES, BUILDINGS, buildingCost, costText, SCHOOL_BUILD_MS, type BuildingId } from '../../shared/config.ts';
import { Room } from '../../server/room.ts';

describe('École des dompteurs', () => {
  rule('L\'école est au village : son plan attend dans un coffre du Camp avancé, puis Aubin la bâtit (comme le bateau).', () => {
    let saved: { plan: boolean; schoolAt: number; buildings: BuildingId[] } = { plan: false, schoolAt: 0, buildings: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new Room('TEST', undefined, { buildings: BUILDING_IDS.filter((b) => b !== 'school'), hall: HALL_MAX });
    r.onVillage = (v: typeof saved) => (saved = v);
    const p = r.addPlayer('maçon', noop), m = r.map;
    p.gold = 1e6;
    Object.assign(r.stock, { wood: 1e5, stone: 1e5 });
    check(m.inVillage(m.school.x, m.school.y), 'l\'école est dans le village');
    check(Math.hypot(m.planChest.x - m.sites[0].x, m.planChest.y - m.sites[0].y) < 200 && m.pathDist(m.planChest.x, m.planChest.y) > 30, 'son plan : dans un coffre du Camp avancé, près du feu, hors de la piste');
    [p.x, p.y] = [m.school.x, m.school.y + 50];
    r.onBuild(p, 'school');
    check(!r.buildings.includes('school'), 'on ne la construit pas soi-même');
    [p.x, p.y] = [m.planChest.x, m.planChest.y + 30];
    r.onPlan(p);
    check(!r.plan, 'camp pas encore établi : le coffre reste fermé');
    r.camps.push(0);
    r.onPlan(p);
    check(r.plan && saved.plan, 'camp établi : le plan est trouvé, pour tout le village (sauvegardé)');
    [p.x, p.y] = [m.elder.x + 40, m.elder.y];
    const gold = p.gold;
    r.hall = BUILDINGS.school.hall - 1;
    r.onSchool(p);
    check(!r.schoolAt, `Hôtel de ville trop bas (niv. ${BUILDINGS.school.hall} requis) : Aubin attend`);
    r.hall = HALL_MAX;
    r.onSchool(p);
    check(r.schoolAt > Date.now() && p.gold === gold - BUILDINGS.school.cost && saved.schoolAt === r.schoolAt && !r.buildings.includes('school'), `Aubin commence le chantier (${costText(buildingCost('school'))}, ${SCHOOL_BUILD_MS / 60000} min)`);
    r.onSchool(p);
    check(p.gold === gold - BUILDINGS.school.cost, 'un seul chantier à la fois');
    const back = new Room('TEST', r.seed, saved);
    check(back.plan && back.schoolAt === r.schoolAt, 'plan et chantier rechargés avec le village');
    const now = Date.now;
    Date.now = () => r.schoolAt + 1;
    r.updateSchool();
    Date.now = now;
    check(r.buildings.includes('school') && !r.schoolAt && saved.buildings.includes('school'), 'le temps écoulé (même sans personne) : l\'école ouvre');
    const old = new Room('TEST', r.seed, { buildings: [...BUILDING_IDS] });
    check(old.plan, 'un village qui avait déjà son école : son plan va de soi');
  });

  rule('Un coffre de géant cache parfois un livre (une fois l\'école bâtie), du tome de sa zone, d\'une discipline au hasard, jamais inutile.', () => {
    check(tomeOfZone(1) === 0 && tomeOfZone(2) === 0 && tomeOfZone(3) === 1 && tomeOfZone(4) === 1 && tomeOfZone(5) === 2 && tomeOfZone(6) === 2, 'tome I : zones 1-2, II : 3-4, III : 5-6');
    const r = room();
    const c = r.map.caves.find((k: { boss: number }) => SPECIES[k.boss].zone === 3);
    const p = r.addPlayer('chanceux', noop);
    const open = () => {
      const boss = r.units.get(r.caveBoss[c.id]);
      [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
      r.damage(boss, boss.hp, p);
      const ch = r.chests.find((k: { cave: number }) => k.cave === c.id);
      [p.x, p.y] = [ch.x + 30, ch.y];
      const rnd = Math.random;
      Math.random = () => 0; // le livre tombe à coup sûr
      r.onChest(p, ch.id);
      Math.random = rnd;
      r.chests = r.chests.filter((k: { id: number }) => k.id !== ch.id);
      r.time = r.caveBack[c.id] + 1;
      r.tick = 0;
      r.updateSpawns();
    };
    const pack = bookIndex(0, 1), tame = bookIndex(1, 1);
    open();
    check(p.tomes[pack] === 1 && p.tomes.reduce((a: number, b: number) => a + b) === 1 && r.profileOf(p).tomes[pack] === 1, 'géant des Landes : un tome II, sauvegardé');
    open();
    check(p.tomes[pack] === 1 && p.tomes[tame] === 1, 'un seul exemplaire de chaque tome : le livre suivant est d\'une autre discipline');
    p.learned[2] = 2; // tome II des essences déjà lu
    p.learned[3] = 2; // tome II de la récolte aussi
    open();
    check(p.tomes.reduce((a: number, b: number) => a + b) === 2, 'plus de tome II à trouver : le coffre n\'en donne plus');
    // village sans école : les coffres ne donnent aucun livre
    r.buildings = r.buildings.filter((b: string) => b !== 'school');
    const before = p.tomes.reduce((a: number, b: number) => a + b);
    p.learned[2] = p.learned[3] = 0;
    p.tomes[bookIndex(2, 1)] = p.tomes[bookIndex(3, 1)] = 0;
    open();
    check(p.tomes.reduce((a: number, b: number) => a + b) === before && !p.tomes[bookIndex(2, 1)] && !p.tomes[bookIndex(3, 1)], 'pas d\'école au village : pas de livre dans les coffres');
    check(p.tomes.length === BOOKS && BOOKS === LESSON_KINDS.length * TOMES && LESSON_KINDS.length >= 4, `${LESSON_KINDS.length} disciplines de ${TOMES} tomes`);
  });

  rule('Une leçon : un livre, 30 minutes à l\'école (même déconnecté), et sa discipline progresse.', () => {
    const r = room();
    r.camps.push(0);
    const p = r.addPlayer('élève', noop), m = r.map;
    const none = LESSON_KINDS.map(() => 0), all = LESSON_KINDS.map(() => LESSONS);
    check(LESSONS === TOMES && armyCap(none) === ARMY_CAP && armyCap(all) === ARMY_CAP + 3, `meute : ${ARMY_CAP} places, +1 par tome lu (${armyCap(all)} une fois les trois lus)`);
    check(lessonBonus(all, 'tame') === DISCIPLINES.tame.per * LESSONS && lessonBonus(none, 'essence') === 0, 'apprivoisement et essences : un gain par leçon');
    p.tomes = Array(BOOKS).fill(0);
    p.tomes[bookIndex(0, 1)] = 1;
    [p.x, p.y] = [m.school.x, m.school.y + 50];
    r.onLearn(p, 0);
    check(!p.readAt && p.tomes[bookIndex(0, 1)] === 1, 'première leçon : il faut un tome I, pas un tome II');
    p.tomes[bookIndex(1, 0)] = 1;
    r.onLearn(p, 0);
    check(!p.readAt, 'un livre d\'une autre discipline n\'apprend rien à celle-ci');
    p.tomes[bookIndex(0, 0)] = 1;
    [p.x, p.y] = [m.village.x, m.village.y];
    r.onLearn(p, 0);
    check(!p.readAt, 'loin de l\'école : rien');
    [p.x, p.y] = [m.school.x, m.school.y + 50];
    r.onLearn(p, 0);
    check(p.readAt === Date.now() + LESSON_MS && p.tomes[bookIndex(0, 0)] === 1, 'à l\'école : le livre est ouvert, la leçon commence');
    const at = p.readAt;
    r.onLearn(p, 1);
    check(p.readAt === at && p.tomes[bookIndex(1, 0)] === 1, 'une leçon à la fois');
    for (let i = 0; i < 25; i++) r.step();
    check(p.learned[0] === 0, 'pas avant la fin des 30 minutes');
    // il se déconnecte pendant la lecture : à son retour, la leçon est apprise
    const prof = r.profileOf(p);
    const now = Date.now;
    Date.now = () => now() + LESSON_MS + 1;
    const r2 = room();
    const back = r2.addPlayer('élève', noop, { userId: 'u', profile: prof });
    check(back.learned[0] === 1 && !back.readAt && back.tomes[bookIndex(1, 0)] === 1, 'leçon finie pendant son absence : elle compte au retour');
    check(r2.profileOf(back).learned[0] === 1, 'leçon sauvegardée');
    Date.now = now;
    for (let i = 0; i < 25; i++) r.step();
    check(p.learned[0] === 0, 'en ligne, la leçon attend toujours l\'heure');
    p.readAt = Date.now() - 1;
    for (let i = 0; i < 25; i++) r.step();
    check(p.learned[0] === 1 && p.tomes[bookIndex(0, 0)] === 0, 'en ligne : la leçon s\'achève à l\'heure ; le tome I est lu, il quitte le sac');
    p.tomes[bookIndex(0, 0)] = 1;
    p.tomes[bookIndex(0, 1)] = 0;
    r.onLearn(p, 0);
    check(!p.readAt, 'un tome déjà lu n\'apprend plus rien : la suite demande le tome II');
    p.tomes[bookIndex(0, 1)] = 1;
    r.onLearn(p, 0);
    check(!!p.readAt, '… et avec lui, elle commence');
    p.readAt = 0;
    [p.x, p.y] = [m.market.x, m.market.y + 40];
    p.gold = 1e6;
    p.seen.add(0);
    for (let i = 0; i < ARMY_CAP + 4; i++) r.onBuy(p, 0);
    check(r.armySize(p) === ARMY_CAP + 1, `un tome de meute lu : ${ARMY_CAP + 1} places`);
  });

  rule('Le tome de la Maîtrise des Alphas ne se trouve que dans le volcan ; lu, il permet un Alpha équipé de plus.', () => {
    const k = LESSON_KINDS.indexOf('alpha'), fire = bookIndex(k, 0);
    check(k >= 0 && DISCIPLINES.alpha.tomes.length === 1, 'une discipline à un seul tome');
    const r = room();
    const p = r.addPlayer('braise', noop);
    const open = (zone: number) => {
      const c = r.map.caves.find((q: { boss: number; zone: number }) => q.zone === zone);
      const boss = r.units.get(r.caveBoss[c.id]);
      [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
      r.damage(boss, boss.hp, p);
      const ch = r.chests.find((q: { cave: number }) => q.cave === c.id);
      [p.x, p.y] = [ch.x + 30, ch.y];
      const rnd = Math.random;
      Math.random = () => 0; // un livre à coup sûr
      r.onChest(p, ch.id);
      Math.random = rnd;
      r.chests = r.chests.filter((q: { id: number }) => q.id !== ch.id);
      r.time = r.caveBack[c.id] + 1; // le géant revient
      r.tick = 0;
      r.updateSpawns();
    };
    for (let i = 0; i < LESSON_KINDS.length; i++) open(5);
    check(!p.tomes[fire] && p.tomes.some((b: number) => b), 'Lacs brumeux : des tomes III, jamais celui du volcan');
    open(VOLCANO_ZONE);
    check(p.tomes[fire] === 1, 'géant du volcan : le Livre des braises');
    const none = LESSON_KINDS.map(() => 0), read = none.map((_, i) => (i === k ? 1 : 0));
    check(alphaEquipMax(none) === ALPHA_EQUIP_MAX && alphaEquipMax(read) === ALPHA_EQUIP_MAX + 1, `lu : ${ALPHA_EQUIP_MAX + 1} Alphas équipés au lieu de ${ALPHA_EQUIP_MAX}`);
    p.learned[k] = 1;
    p.tomes[fire] = 0;
    open(VOLCANO_ZONE);
    check(!p.tomes[fire], 'déjà lu : le volcan ne le redonne plus');
  });
});
