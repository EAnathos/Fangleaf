// Village : quêtes, forge, bâtiments, récolte, social. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop, unarmedAdd } from '../helpers.ts';
import { BOAT_STAGES, BUILDING_IDS, PLAYER_COLORS, SWORD_PULLS, SWORD_REACH, ARMY_CAP, HALL, HALL_MAX, gateHall, zoneBosses, resYield, oreStone, resRoll, BUILDINGS, buildingCost, costText, CAMP_COST, caveUnlockCost, monsterBuyPrice, monsterSellPrice, SPECIES, oreGold, weaponDmg, weaponCost, weaponName, SPEC_LVL, SPEC_CHANGE_COST, CLASS_CHANGE_COST, SPECS, WEAPON_MAX, treeWood, TREE_RESPAWN_S, TREANT_ZONE, ZONES, gearWood, gearCost, saddleSpeed, HAT_PRICES, oreHp } from '../../shared/config.ts';
import { Room } from '../../server/room.ts';
import { villageEdge } from '../../shared/worldmap.ts';
import { ELDER_CHAPTERS } from '../../client/src/elder.ts';

describe('Village : quêtes, forge, bâtiments, récolte, social', () => {
  rule('Les parchemins des géants, les souvenirs du vieil homme et son bateau.', () => {
    const r = room(), m = r.map;
    r.told = []; // aucun souvenir rendu
    let saved: { told: number[]; boat: number; boatAt: number } = { told: [], boat: 0, boatAt: 0 };
    r.onVillage = (v: typeof saved) => (saved = v);
    const p = r.addPlayer('lecteur', () => {});
    // un parchemin par zone : seul le dernier géant vaincu de la zone le laisse
    const z1 = zoneBosses(1), [first, last] = z1, caveOf = (b: number) => m.caves.findIndex((c: { boss: number }) => c.boss === b);
    r.beaten = [first];
    check(!r.scrollCaves(p).length, 'un seul géant de la zone vaincu : pas encore de parchemin');
    r.beaten = [first, last];
    check(r.scrollCaves(p).length === 1 && r.scrollCaves(p)[0] === caveOf(last), 'tous vaincus : le parchemin attend dans la grotte du dernier');
    const cave = caveOf(last), at = m.scrollPos(m.caves[cave]);
    [p.x, p.y] = [at.x + 200, at.y];
    r.onScroll(p, cave);
    check(p.scrolls.length === 0, 'parchemin trop loin : rien');
    r.onScroll(p, caveOf(first));
    [p.x, p.y] = [at.x + 20, at.y];
    r.onScroll(p, caveOf(first));
    check(p.scrolls.length === 0, 'rien dans la grotte du premier géant');
    r.onScroll(p, cave);
    r.onScroll(p, cave);
    check(p.scrolls.length === z1.length && r.profileOf(p).scrolls.length === z1.length, 'parchemin de la zone ramassé (une fois), sauvegardé');
    r.onScrollGive(p);
    check(r.told.length === 0, 'loin du vieil homme : on ne lui donne rien');
    [p.x, p.y] = [m.elder.x + 50, m.elder.y + 20];
    r.onScrollGive(p);
    check(r.told.length === z1.length && p.scrolls.length === 0 && saved.told.length === z1.length, 'parchemin donné au vieil homme : les souvenirs de la zone, sauvegardés');
    [p.x, p.y] = [at.x + 20, at.y];
    r.onScroll(p, cave);
    check(p.scrolls.length === 0, 'souvenirs déjà rendus : plus de parchemin dans cette grotte');
    [p.x, p.y] = [m.elder.x + 50, m.elder.y + 20];
    p.gold = 1e6;
    Object.assign(r.stock, { wood: 1e5, stone: 1e5 });
    r.onBoat(p);
    check(r.boat === 0 && r.boatAt === 0, 'bateau : pas avant d\'avoir rendu tous les souvenirs');
    r.told = m.caves.map((c: { boss: number }) => c.boss);
    r.onBoat(p);
    r.onBoat(p);
    check(r.boatAt > Date.now() && p.gold === 1e6 - BOAT_STAGES[0].gold && r.stock.wood === 1e5 - BOAT_STAGES[0].wood, `bateau : étape 1 (${BOAT_STAGES[0].name}) payée une fois, en chantier`);
    for (let i = 0; i < 25; i++) r.step();
    check(r.boat === 0, 'étape en cours : pas encore finie');
    const yard = r.elderPos();
    check(yard === m.elderYard && Math.hypot(yard.x - m.shipwreck.x, yard.y - m.shipwreck.y) < 250 && !m.blocked(yard.x, yard.y), 'pendant l\'étape, Aubin est au chantier, à côté du bateau');
    p.scrolls = [m.caves[0].id];
    r.onScrollGive(p);
    check(p.scrolls.length === 1, 'au village, plus personne à qui parler…');
    [p.x, p.y] = [yard.x + 30, yard.y];
    r.onScrollGive(p);
    check(p.scrolls.length === 0, '… c\'est au chantier qu\'on le trouve');
    [p.x, p.y] = [m.elder.x + 50, m.elder.y + 20];
    for (let k = 0; k < BOAT_STAGES.length; k++) {
      r.boatAt = Date.now() - 1;
      for (let i = 0; i < 25; i++) r.step();
      if (!k) check(r.elderPos() === m.elder, 'étape finie : Aubin rentre au village');
      if (k < BOAT_STAGES.length - 1) r.onBoat(p);
    }
    check(r.boat === BOAT_STAGES.length && saved.boat === BOAT_STAGES.length, `bateau terminé en ${BOAT_STAGES.length} étapes`);
    const island = m.caves.filter((c: { zone: number; boss: number }) => c.zone <= ZONES && !SPECIES[c.boss].optional).length;
    check(ELDER_CHAPTERS.length === island, `un souvenir par géant de l'île (${ELDER_CHAPTERS.length} chapitres, ${island} géants ; ceux du volcan et le Scorpion Empereur, facultatif, n'ont pas de parchemin)`);
    [p.x, p.y] = [m.stones[0].x, m.stones[0].y + 40];
    r.onTravel(p, -2);
    check(Math.hypot(p.x - m.boatStone.x, p.y - m.boatStone.y) < 120, 'Pierre de passage du bateau : on y voyage depuis le village');
    r.onTravel(p, -1);
    check(Math.hypot(p.x - m.stones[0].x, p.y - m.stones[0].y) < 120, '… et on en revient');
  });

  rule('L\'épée plantée dans le sable : un nouveau venu se réveille sans arme, à côté de l\'œuf, et la déterre en trois coups.', () => {
    const r = room(), m = r.map;
    const p = unarmedAdd.call(r, 'neuf', () => {});
    check(p.sword === 0 && Math.hypot(p.x - m.spawn.x, p.y - m.spawn.y) < 40 && Math.hypot(m.egg.x - m.spawn.x, m.egg.y - m.spawn.y) < 60, 'nouveau venu : sans arme, réveillé à côté de l\'œuf');
    check(!m.blocked(m.sword.x, m.sword.y) && Math.hypot(m.sword.x - m.spawn.x, m.sword.y - m.spawn.y) < 200, 'épée plantée sur la plage, tout près');
    const u = r.createUnit(0, false, p.x + 30, p.y);
    const hp = u.hp;
    for (let i = 0; i < 40; i++) r.step();
    check(u.hp === hp, 'sans arme : on ne frappe pas');
    r.units.delete(u.id);
    r.onSword(p);
    check(p.sword === 0, 'trop loin de l\'épée : rien');
    [p.x, p.y] = [m.sword.x + SWORD_REACH - 20, m.sword.y];
    for (let i = 0; i < SWORD_PULLS; i++) {
      r.onSword(p);
      r.onSword(p); // trop tôt : ne compte pas
      r.time += 0.35;
    }
    check(p.sword === SWORD_PULLS && r.profileOf(p).armed, `épée déterrée en ${SWORD_PULLS} coups, sauvegardée`);
    const back = unarmedAdd.call(r, 'revenu', () => {}, { userId: 'x', profile: { ...r.profileOf(p), village_found: false } });
    const old = unarmedAdd.call(r, 'ancien', () => {}, { userId: 'y', profile: { ...r.profileOf(p), armed: undefined } });
    check(back.sword === SWORD_PULLS && old.sword === SWORD_PULLS, 'déjà armé (ou ancienne sauvegarde) : l\'épée reste en main');
  });

  rule('Forge : arme et armure séparées ; chaque amélioration demande aussi du bois (le sac, puis l\'entrepôt) ; la selle.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.forge.x;
    p.y = r.map.forge.y;
    p.gold = 1000;
    r.onUpgrade(p, 'weapon');
    check(p.weapon === 0 && p.gold === 1000, 'sans bois (ni dans le sac, ni à l\'entrepôt) : pas d\'amélioration');
    p.wood = gearWood('weapon', 0) + 1;
    r.stock.wood = 100;
    r.onUpgrade(p, 'weapon');
    check(p.weapon === 1 && p.wood === 1 && r.stock.wood === 100, `le bois du sac d'abord (${gearWood('weapon', 0)} bois)`);
    r.onUpgrade(p, 'weapon');
    check(p.weapon === 2 && p.wood === 0 && r.stock.wood === 100 - (gearWood('weapon', 1) - 1), `puis celui de l'entrepôt (${gearWood('weapon', 1)} bois, dont ${gearWood('weapon', 1) - 1} de la réserve)`);
    r.onUpgrade(p, 'armor');
    check(p.weapon === 2 && p.armor === 1, `arme niv. ${p.weapon}, armure niv. ${p.armor}`);
    check(gearWood('weapon', 10) > gearWood('weapon', 5) && gearWood('saddle', 0) > 0, `bois de plus en plus cher (arme : ${[0, 5, 10, 19].map((l) => gearWood('weapon', l)).join(', ')})`);
    const q = unarmedAdd.call(r, 'piéton', noop);
    check(q.saddle === 0, 'un nouveau dompteur n\'a pas de selle');
    p.saddle = 0;
    r.onUpgrade(p, 'saddle');
    check(p.saddle === 1 && r.profileOf(p).saddle === 1 && saddleSpeed(1) === 1 && saddleSpeed(3) > 1, `selle achetée (${costText(gearCost('saddle', 0))}), sauvegardée ; plus rapide en l'améliorant (niv. 3 : ×${saddleSpeed(3)})`);
  });

  rule('Arme : les dégâts suivent les monstres, au-delà du niveau 10 une spécialisation (Grande forge) est nécessaire.', () => {
    check(weaponDmg(0) === 8 && weaponDmg(10) > 50 && weaponDmg(17) > 200 && weaponDmg(20) > 400, `dégâts d'arme : ${[0, 10, 17, 20].map(weaponDmg).join(', ')}`);
    check(weaponCost(0) > 25 && weaponCost(9) > 1718 && weaponCost(19) > weaponCost(10), `prix d'arme plus chers : ${[0, 9, 10, 19].map(weaponCost).join(', ')}`);
    check(BUILDINGS.forge2.hall === 4 && BUILDINGS.forge2.needs === 'forge', 'Grande forge : Hôtel de ville niv. 4, après la forge');
    const r = room();
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.forge.x, r.map.forge.y];
    p.gold = 1e6;
    r.stock.wood = 1e6;
    r.onClass(p, 'warrior');
    r.onSpec(p, 'berserker');
    check(p.spec === null, 'arme pas encore au niveau 10 : pas de spécialisation');
    for (let i = 0; i < 15; i++) r.onUpgrade(p, 'weapon');
    check(p.weapon === SPEC_LVL, `bloqué au niveau ${SPEC_LVL} sans spécialisation (niv. ${p.weapon})`);
    r.onSpec(p, 'sniper');
    check(p.spec === null, 'spécialisation d\'une autre classe : refusée');
    const gold = p.gold, hp0 = p.hp;
    r.onSpec(p, 'guardian');
    check(p.spec === 'guardian' && p.gold === gold && p.hp > hp0, 'première spécialisation gratuite, PV du Gardien en plus');
    r.onSpec(p, 'berserker');
    check(p.spec === 'berserker' && p.gold === gold - SPEC_CHANGE_COST, `changer de spécialisation : ${SPEC_CHANGE_COST} or`);
    for (let i = 0; i < 15; i++) r.onUpgrade(p, 'weapon');
    check(p.weapon === WEAPON_MAX && r.profileOf(p).spec === 'berserker', `arme niv. ${WEAPON_MAX}, spécialisation sauvegardée`);
    check(weaponName('warrior', 'berserker', WEAPON_MAX) === SPECS.berserker.weapons[9] && weaponName('warrior', null, 12) === 'Fangleaf +2', 'noms d\'armes de la spécialisation');
    r.onClass(p, 'mage');
    check(p.spec === null && p.weapon === WEAPON_MAX, 'nouvelle classe : pas encore de spécialisation, niveau gardé');
    r.onSpec(p, 'druid');
    const g2 = p.gold;
    r.onClass(p, 'warrior');
    check(p.spec === 'berserker' && p.gold === g2 - CLASS_CHANGE_COST, 'retour au guerrier : on retrouve le Berserker');
    r.onSpec(p, 'guardian');
    check(p.spec === 'guardian' && p.gold === g2 - CLASS_CHANGE_COST - SPEC_CHANGE_COST, 'changer la spécialisation d\'une classe déjà spécialisée reste payant');
    r.onClass(p, 'mage');
    check(p.spec === 'druid' && r.profileOf(p).specs.warrior === 'guardian' && r.profileOf(p).specs.mage === 'druid', 'chaque spécialisation retenue et sauvegardée par classe');
    const back = new Room('TESTS', r.seed, { buildings: [...BUILDING_IDS] }).addPlayer('b', noop, { userId: 'u', profile: { ...r.profileOf(p), class: 'archer', spec: 'pyromancer' } });
    check(back.spec === null, 'spécialisation qui ne va pas avec la classe : ignorée au chargement');
    // sans Grande forge : pas de choix
    const r2 = new Room('TEST3', undefined, { buildings: ['forge'], hall: HALL_MAX });
    const q = r2.addPlayer('c', noop) as any;
    [q.x, q.y, q.gold, q.cls, q.weapon] = [r2.map.forge.x, r2.map.forge.y, 1e6, 'archer', SPEC_LVL];
    r2.onSpec(q, 'sniper');
    check(q.spec === null, 'sans Grande forge : pas de spécialisation');
    // Druide : une part des dégâts infligés revient en PV ; Gardien : moins de dégâts reçus.
    [p.cls, p.spec, p.atkCd] = ['mage', 'druid', 0];
    r.units.clear();
    const w = r.createUnit(0, false, p.x + 150, p.y);
    w.maxHp = w.hp = 1e6;
    r.grid.clear();
    r.grid.insert(w);
    p.hp = 10;
    r.playerAttack(p);
    check(p.hp > 10, `druide : soigné en frappant (${Math.round(p.hp)} PV)`);
  });

  rule('Camps : établis contre de l\'or pour tout le village ; soins, réapparition, Pierre de passage.', () => {
    const r = room();
    let saved: number[] = [];
    r.onVillage = (v: { camps: number[] }) => (saved = v.camps);
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    const site = r.map.sites[0], far = r.map.stones[1];
    p.x = site.x + 40;
    p.y = site.y + 60;
    p.gold = CAMP_COST - 1;
    r.onEstablish(p, 0);
    check(r.camps.length === 0 && p.gold === CAMP_COST - 1, 'pas assez d\'or : camp non établi');
    p.gold = CAMP_COST + 20;
    const [vx, vy] = [p.x, p.y];
    p.x = r.map.village.x;
    p.y = r.map.village.y;
    r.onEstablish(p, 0);
    check(r.camps.length === 0, 'il faut être sur l\'emplacement pour établir le camp');
    [p.x, p.y] = [vx, vy];
    r.onEstablish(p, 0);
    r.onEstablish(p, 0);
    check(r.camps.length === 1 && p.gold === 20 && saved.join() === '0', `camp établi une seule fois, ${CAMP_COST} or payés, sauvegardé pour le village`);
    // soins au feu du camp
    p.hp = 10;
    for (let i = 0; i < 20; i++) r.regen();
    check(p.hp > 10, 'le feu du camp soigne');
    // voyage : depuis la Pierre du village jusqu'à celle du camp, avec la meute
    const f = r.createUnit(0, false, r.map.village.x, r.map.village.y);
    f.owner = q.id;
    q.army.push(f.id);
    q.x = r.map.stones[0].x;
    q.y = r.map.stones[0].y + 40;
    r.onTravel(q, 0);
    check(Math.hypot(q.x - far.x, q.y - far.y) < 200 && Math.hypot(f.x - q.x, f.y - q.y) < 200, 'Pierre de passage : le village rejoint le camp, la meute suit');
    r.onTravel(q, 0);
    check(Math.hypot(q.x - far.x, q.y - far.y) < 200, 'déjà au camp : pas de voyage vers soi-même');
    q.x = r.map.spawn.x;
    q.y = r.map.spawn.y;
    r.onTravel(q, -1);
    check(!r.map.inVillage(q.x, q.y), 'loin d\'une Pierre : pas de voyage');
    // réapparition : au camp si on tombe au-delà, au village si on tombe avant
    q.x = r.map.spineAt(r.map.length - 100).x;
    q.y = r.map.spineAt(r.map.length - 100).y;
    r.killPlayer(q);
    r.time = q.respawnAt + 1;
    r.updateRespawns();
    check(Math.hypot(q.x - site.x, q.y - site.y) < 200, 'mort au bout du couloir : réapparition au camp avancé');
    const mid = r.map.spineAt(r.map.zoneFrom(3));
    q.x = mid.x;
    q.y = mid.y;
    r.killPlayer(q);
    r.time = q.respawnAt + 1;
    r.updateRespawns();
    check(r.map.inVillage(q.x, q.y), 'mort avant le camp : réapparition au village');
    // un village rouvert retrouve ses camps
    const again: any = new Room('TEST2', r.seed, { camps: [0, 0, 7, -1], buildings: ['forge', 'forge', 'nope' as never], unlocked: [1, 1, 999] });
    check(again.camps.join() === '0', 'camps rechargés (doublons et index invalides ignorés)');
    check(again.buildings.join() === 'forge,palisade,plot_forge,plot_den,plot_market,bridge' && again.unlocked.join() === '1', 'bâtiments et grottes rechargés (doublons et valeurs invalides ignorés) ; village d\'avant l\'île : son camp est installé, son pont réparé');
  });

  rule('Bâtiments du village : achetés avec de l\'or, du bois et de la pierre, une fois pour tous ; sans eux, rien à faire devant le chantier.', () => {
    const r: any = new Room('TEST');
    let saved: { buildings: string[]; unlocked: number[] } = { buildings: [], unlocked: [] };
    r.onVillage = (v: typeof saved) => (saved = v);
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    check(r.buildings.length === 0 && r.unlocked.length === 0, 'nouveau village : rien que le feu de camp (ni palissade ni bâtiment), grottes fermées');
    check(BUILDINGS.forge.cost === 10 && BUILDINGS.den.cost === 20 && BUILDINGS.market.cost === 50 && BUILDINGS.stone.cost === 200, 'prix : Forge 10, Tanière 20, Marché 50, Pierre de passage 200');
    [p.x, p.y] = [r.map.forge.x, r.map.forge.y + 60];
    p.gold = 500;
    r.onUpgrade(p, 'weapon');
    check(p.weapon === 0 && p.gold === 500, 'forge pas construite : pas d\'amélioration');
    [p.x, p.y] = [r.map.village.x, r.map.village.y];
    r.onBuild(p, 'forge');
    check(!r.buildings.includes('forge'), 'il faut être devant l\'emplacement pour construire');
    [p.x, p.y] = [r.map.forge.x, r.map.forge.y + 60];
    p.gold = 9;
    r.stock.wood = 100;
    r.onBuild(p, 'forge');
    check(!r.buildings.includes('forge') && p.gold === 9 && r.stock.wood === 100, 'pas assez d\'or : rien de construit');
    p.gold = 500;
    r.stock.wood = 4;
    r.onBuild(p, 'forge');
    check(!r.buildings.includes('forge') && p.gold === 500, 'pas assez de bois en réserve : rien de construit');
    r.stock.wood = 5;
    r.onBuild(p, 'forge');
    check(!r.buildings.includes('forge') && r.stock.wood === 5, 'emplacement pas défriché : pas de forge');
    Object.assign(r.stock, { wood: 5 + BUILDINGS.plot_forge.wood, stone: BUILDINGS.plot_forge.stone });
    r.onBuild(p, 'plot_forge');
    check(r.buildings.join() === 'plot_forge' && r.stock.wood === 5 && r.stock.stone === 0, `emplacement de la forge défriché (${costText(buildingCost('plot_forge'))})`);
    r.onBuild(p, 'forge');
    r.onBuild(p, 'forge');
    check(r.buildings.join() === 'plot_forge,forge' && p.gold === 490 && r.stock.wood === 0 && saved.buildings.join() === 'plot_forge,forge', 'forge construite une seule fois, 10 or et 5 bois, sauvegardée pour le village');
    [q.x, q.y] = [p.x, p.y];
    q.gold = 100;
    q.wood = gearWood('weapon', 0);
    r.onUpgrade(q, 'weapon');
    check(q.weapon === 1, 'un autre membre profite de la forge');
    // Pierre du village : pas de voyage tant qu'elle n'est pas construite.
    r.camps.push(0);
    [p.x, p.y] = [r.map.stones[0].x, r.map.stones[0].y + 40];
    r.onTravel(p, 0);
    check(r.map.inVillage(p.x, p.y), 'Pierre du village pas construite : pas de voyage');
    p.gold = 200;
    r.stock.wood = 10;
    r.stock.stone = 40;
    r.onBuild(p, 'stone');
    check(!r.buildings.includes('stone') && p.gold === 200, `Hôtel de ville trop basse : pas de Pierre (niveau ${BUILDINGS.stone.hall} requis)`);
    r.hall = BUILDINGS.stone.hall;
    r.onBuild(p, 'stone');
    r.onTravel(p, 0);
    check(p.gold === 0 && r.stock.wood === 0 && r.stock.stone === 0 && !r.map.inVillage(p.x, p.y), 'Pierre du village construite (200 or, 10 bois, 40 pierre) : voyage vers le camp');
    // Grottes : débloquées contre 150 × niveau de la zone.
    const c = r.map.caves.find((cv: { zone: number }) => cv.zone === 2);
    [p.x, p.y] = [c.entrance.x, c.entrance.y + 20];
    r.onCave(p, c.id, true);
    check(!r.map.caveAt(p.x, p.y), 'grotte fermée : on n\'entre pas');
    p.gold = caveUnlockCost(2) - 1;
    r.onUnlock(p, c.id);
    check(!r.unlocked.includes(c.id), 'pas assez d\'or : grotte toujours fermée');
    p.gold = caveUnlockCost(2);
    r.onUnlock(p, c.id);
    r.onCave(p, c.id, true);
    check(caveUnlockCost(2) === 300 && p.gold === 0 && saved.unlocked.join() === String(c.id) && r.map.caveAt(p.x, p.y)?.id === c.id, 'grotte de zone 2 débloquée pour 300 or, on y entre');
  });

  rule('Marché : vendre un monstre de sa meute, acheter une espèce déjà croisée.', () => {
    const r: any = new Room('TEST', undefined, { buildings: ['market'] });
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [r.map.market.x, r.map.market.y + 60];
    const u = r.createUnit(1, false, p.x, p.y);
    r.makeTamed(u, p);
    const a = r.createUnit(2, true, p.x, p.y);
    a.owner = p.id;
    p.army.push(a.id);
    r.onSell(p, a.id);
    check(p.army.includes(a.id) && p.gold === 0, 'un Alpha ne se vend pas');
    r.onSell(p, u.id);
    check(!p.army.includes(u.id) && !r.units.has(u.id) && p.gold === monsterSellPrice(1), `Loup vendu : +${monsterSellPrice(1)} or`);
    p.gold = 1000;
    r.onBuy(p, 3);
    check(r.armySize(p) === 0 && p.gold === 1000, 'espèce jamais croisée : pas d\'achat');
    p.seen.add(3);
    r.onBuy(p, 3);
    const bought = p.army.map((id: number) => r.units.get(id)).find((x: { s: number; alpha: boolean }) => x.s === 3 && !x.alpha);
    check(!!bought && bought.owner === p.id && p.gold === 1000 - monsterBuyPrice(3), `Golem acheté : −${monsterBuyPrice(3)} or, il rejoint la meute`);
    p.seen.add(0);
    for (let i = 0; i < ARMY_CAP + 3; i++) r.onBuy(p, 0);
    check(r.armySize(p) === ARMY_CAP, 'meute pleine : plus d\'achat');
    [p.x, p.y] = [r.map.village.x, r.map.village.y];
    const gold = p.gold, sold = p.army.find((id: number) => !r.units.get(id).alpha);
    r.onSell(p, sold);
    check(p.gold === gold, 'loin du marché : pas de vente');
  });

  rule('Hôtel de ville : chaque niveau coûte or, bois et pierre ; elle ouvre les portes avec les géants vaincus.', () => {
    const r: any = new Room('TEST');
    let saved: { hall: number; name: string; beaten: number[] } = { hall: 0, name: '', beaten: [] };
    r.onVillage = (v: typeof saved) => (saved = v);
    const p = r.addPlayer('a', noop);
    const { map } = r;
    // Porte du village (0) : fermée tant que l'Hôtel de ville est au niveau 0.
    // De part et d'autre d'une porte, sur une ligne droite libre (décalée le long de la porte si un arbre est sur la colonne).
    const across = (g: number) => {
      const s = map.gateSpine(g), n = map.normalAt(s); // la porte suit la frontière (bruitée) entre deux zones
      const ok = (q: { x: number; y: number }, after: boolean) => map.gateArc(g, q.x, q.y) > map.gates[g] === after;
      for (const off of [0, 40, -40, 80, -80, 120, -120, 160, -160, 200, -200]) {
        const a = map.spineAt(s - 60), b = map.spineAt(s + 60);
        const p0 = { x: a.x + n.x * off, y: a.y + n.y * off }, p1 = { x: b.x + n.x * off, y: b.y + n.y * off };
        if (!map.blocked(p0.x, p0.y) && map.clearLine(p0.x, p0.y, p1.x, p1.y) && ok(p0, false) && ok(p1, true)) return [p0, p1];
      }
      return [map.spineAt(s - 60), map.spineAt(s + 60)];
    };
    const [before, after] = across(0);
    const walk = (from: { x: number; y: number }, to: { x: number; y: number }, gate = 0) => {
      [p.x, p.y] = [from.x, from.y];
      for (let i = 0; i < 40; i++) {
        p.lastPosMs = Date.now() - 50;
        r.onPos(p, p.x + (to.x - from.x) / 20, p.y + (to.y - from.y) / 20, 1, 0);
      }
      return map.gateArc(gate, p.x, p.y) > map.gates[gate];
    };
    check(!walk(before, after), 'Hôtel de ville niv. 0 : la porte du village ne se franchit pas');
    [p.x, p.y] = [map.hall.x, map.hall.y + 60];
    p.gold = HALL[0].gold;
    Object.assign(r.stock, { wood: HALL[0].wood, stone: HALL[0].stone - 1 });
    r.onHall(p);
    check(r.hall === 0, 'pas assez de pierre : pas d\'amélioration');
    r.stock.stone++;
    r.onHall(p);
    check(r.hall === 0, 'pas de palissade : pas d\'Hôtel de ville (le camp d\'abord)');
    [p.x, p.y] = [map.village.x + 60, map.village.y + 60];
    r.stock.wood += BUILDINGS.palisade.wood;
    r.onBuild(p, 'palisade');
    check(r.buildings.includes('palisade') && map.blocked(map.village.x + Math.cos(0.7) * villageEdge(0.7), map.village.y + Math.sin(0.7) * villageEdge(0.7)), `palissade montée (${costText(buildingCost('palisade'))}) : elle bloque`);
    [p.x, p.y] = [map.hall.x, map.hall.y + 60];
    r.onHall(p, '  Les\n  Trois   Chênes  ');
    check(r.name === 'Les Trois Chênes' && saved.name === 'Les Trois Chênes', `Hôtel de ville construit : le village est nommé (« ${r.name} »), nom nettoyé et sauvegardé`);
    r.onRename(p, 'Bourg-Mousse');
    check(r.name === 'Bourg-Mousse' && saved.name === 'Bourg-Mousse', 'village renommé devant l\'Hôtel de ville, sauvegardé');
    r.onRename(p, 'Trop-Vite');
    check(r.name === 'Bourg-Mousse', 'pas deux changements de nom en moins de 5 s');
    r.time += 6;
    [p.x, p.y] = [map.village.x, map.village.y];
    r.onRename(p, 'Loin');
    check(r.name === 'Bourg-Mousse', 'loin de l\'Hôtel de ville : pas de changement de nom');
    [p.x, p.y] = [map.hall.x, map.hall.y + 60];
    check(r.hall === 1 && p.gold === 0 && r.stock.wood === 0 && r.stock.stone === 0 && saved.hall === 1, `niveau 1 pour ${HALL[0].gold} or, ${HALL[0].wood} bois, ${HALL[0].stone} pierre, sauvegardé`);
    check(walk(before, after), 'niveau 1 : la porte du village s\'ouvre');
    // Porte de la zone 2 : Hôtel de ville niv. 3 et les parchemins de tous les géants de la zone 1 rapportés à Aubin.
    const [b1, a1] = across(1);
    r.hall = gateHall(1);
    check(!walk(b1, a1, 1), 'géants de la zone 1 pas encore vaincus : porte de la zone 2 fermée');
    const [g1, g2] = zoneBosses(1);
    for (const g of [g1, g2]) {
      const u = r.createUnit(g, false, p.x, p.y);
      r.killUnit(u, p);
    }
    check(saved.beaten.includes(g1) && saved.beaten.includes(g2), 'géants vaincus retenus pour le village');
    check(!walk(b1, a1, 1), 'géants vaincus mais parchemins pas rapportés à Aubin : porte de la zone 2 fermée');
    r.told.push(g1);
    check(!walk(b1, a1, 1), 'un seul des deux parchemins rapporté : toujours fermée');
    r.told.push(g2);
    r.hall = gateHall(1) - 1;
    check(!walk(b1, a1, 1), `parchemins rapportés mais Hôtel de ville niv. ${gateHall(1) - 1} : toujours fermée`);
    r.hall = gateHall(1);
    check(walk(b1, a1, 1), `parchemins rapportés et Hôtel de ville niv. ${gateHall(1)} : porte de la zone 2 ouverte`);
    // On peut toujours revenir en arrière, même par une porte fermée.
    r.hall = 0;
    [p.x, p.y] = [a1.x, a1.y];
    for (let i = 0; i < 40; i++) {
      p.lastPosMs = Date.now() - 50;
      r.onPos(p, p.x + (b1.x - a1.x) / 20, p.y + (b1.y - a1.y) / 20, 1, 0);
    }
    check(map.gateArc(1, p.x, p.y) < map.gates[1], 'revenir en arrière par une porte fermée : toujours possible');
    const again: any = new Room('TEST2', r.seed, { hall: 99, beaten: [g1, g1, 0, 999] });
    check(again.hall === HALL_MAX && again.beaten.join() === String(g1), 'Hôtel de ville et géants rechargés (bornés, doublons et non-géants ignorés)');
  });

  rule('Récolte : arbre → bois, rocher → pierre, filon → or et un peu de pierre ; sauvegardés sur le compte.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    check(!r.map.ores.some((o: { res: string }) => o.res === 'wood'), 'plus de tas de bois mort sur la carte : le bois vient des arbres');
    // Un arbre dégagé (une place libre devant son tronc), dans les Bois profonds pour le Tréant.
    const spot = (z: number) => {
      for (const d of r.map.decor) {
        if (d.kind !== 0 || d.zone !== z) continue;
        const t = r.map.trunkOf(d);
        for (let a = 0; a < 8; a++) {
          const x = t.x + Math.cos(a) * (t.r + 22), y = t.y + Math.sin(a) * (t.r + 22);
          // (pas de filon ni de rocher à portée de pioche : on les récolterait avant l'arbre)
          if (!r.map.blocked(x, y) && !r.map.ores.some((o: { x: number; y: number }) => Math.hypot(o.x - x, o.y - y) < 120)) return { d, t, x, y };
        }
      }
      throw new Error('pas d\'arbre');
    };
    const chopDown = (z: number) => {
      const { d, t, x, y } = spot(z);
      [p.x, p.y] = [x, y];
      // seul cet arbre est à portée de hache (un voisin plus proche serait abattu à sa place)
      const others = r.map.treesNear(x, y, 200).filter((i: number) => i !== d.id && !r.map.treeDown.has(i));
      for (const i of others) r.map.treeDown.add(i);
      const w0 = p.wood;
      for (let i = 0; i < 20 * 30 && !r.map.treeDown.has(d.id); i++) {
        for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
        r.step();
      }
      for (const i of others) r.map.treeDown.delete(i);
      return { d, t, got: p.wood - w0 };
    };
    {
      const { d, t, x, y } = spot(1);
      [p.x, p.y] = [x, y];
      for (let i = 0; i < 40; i++) {
        p.movedAt = r.time; // il marche : il traverse la forêt sans l'abattre
        r.step();
      }
      check(!r.treeHp.has(d.id), 'attaque auto en marchant : on n\'abat pas les arbres qu\'on frôle');
      check(r.map.blocked(t.x, t.y), 'un arbre debout bloque le passage');
    }
    const felled = chopDown(1);
    const k = r.map.treeScale(felled.d), lo = resRoll(treeWood(1) * k, 0), hi = resRoll(treeWood(1) * k, 1);
    check(r.map.treeDown.has(felled.d.id) && felled.got >= lo && felled.got <= hi, `arbre abattu (zone 1, taille ×${k.toFixed(2)}) : +${felled.got} bois (entre ${lo} et ${hi})`);
    check(!r.map.blocked(felled.t.x, felled.t.y), 'abattu : on passe à travers sa souche');
    [p.x, p.y] = [felled.t.x + 400, felled.t.y];
    r.time += TREE_RESPAWN_S + 1;
    r.tick = 9;
    r.step();
    check(!r.map.treeDown.has(felled.d.id) && !r.treeHp.has(felled.d.id), `il repousse (${TREE_RESPAWN_S} s)`);
    const rand = Math.random;
    {
      const { d, x, y } = spot(TREANT_ZONE);
      [p.x, p.y] = [x, y];
      const others = r.map.treesNear(x, y, 200).filter((i: number) => i !== d.id && !r.map.treeDown.has(i));
      for (const i of others) r.map.treeDown.add(i); // seul cet arbre est à portée de hache
      r.treeHp.set(d.id, 1); // dernier coup de hache
      Math.random = () => 0; // le Tréant se réveille à coup sûr
      p.atkCd = 0;
      r.step();
      Math.random = rand;
      for (const i of others) r.map.treeDown.delete(i);
      const treant = SPECIES.findIndex((sp) => sp.key === 'treant');
      check(r.map.treeDown.has(d.id) && [...r.units.values()].some((u: { s: number; owner: number }) => u.s === treant && !u.owner), 'Bois profonds : un arbre abattu peut réveiller un Tréant');
      check(SPECIES[treant].hp > Math.max(...SPECIES.filter((sp) => sp.zone === TREANT_ZONE && !sp.boss && !sp.passive && sp.population && sp.season === undefined).map((sp) => sp.hp)), 'le Tréant est plus solide que les autres monstres des Bois profonds (hors Bigfoot, rare, l\'hiver)');
    }
    for (const res of ['stone', 'gold'] as const) {
      const o = r.map.ores.find((x: { res: string }) => x.res === res);
      [p.x, p.y] = [o.x + 30, o.y];
      const [w0, s0, g0] = [p.wood, p.stone, p.gold];
      for (let i = 0; i < 20 * 20 && r.oreHp[o.id] > 0; i++) {
        for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // pas de monstre pour l'interrompre
        r.step();
      }
      const got = { wood: p.wood - w0, stone: p.stone - s0, gold: p.gold - g0 };
      // quantité au hasard autour de la moyenne : entre le tirage le plus bas et le plus haut
      const base = (res === 'gold' ? oreStone(o.zone) : resYield(o.zone)) * o.size, lo = resRoll(base, 0), hi = resRoll(base, 1); // un gros rocher rapporte plus
      const n = got.stone, other = got.wood;
      check(n >= lo && n <= hi && other === 0 && (res !== 'gold' ? got.gold === 0 : got.gold > 0), `${res} (zone ${o.zone}) : +${got.wood} bois, +${got.stone} pierre, +${got.gold} or (entre ${lo} et ${hi})`);
    }
    const prof = r.profileOf(p);
    const r2: any = room();
    const p2 = r2.addPlayer('a', noop, { userId: 'u', profile: prof });
    check(p2.wood === p.wood && p2.stone === p.stone, 'sac (bois et pierre) sauvegardé sur le compte');
    // Entrepôt : le sac se vide dans la réserve du village, sauvegardée avec lui.
    let saved: { wood: number; stone: number } = { wood: 0, stone: 0 };
    r.onVillage = (v: typeof saved) => (saved = v);
    const [w, st] = [p.wood, p.stone];
    r.onDeposit(p);
    check(r.stock.wood === 0, 'loin de l\'entrepôt : rien de déposé');
    [p.x, p.y] = [r.map.store.x, r.map.store.y + 50];
    r.onDeposit(p);
    check(p.wood === 0 && p.stone === 0 && r.stock.wood === w && r.stock.stone === st && saved.wood === w, `déposé à l'entrepôt : réserve du village ${w} bois, ${st} pierre`);
    check(!r.map.blocked(r.map.store.x, r.map.store.y + 50) && r.map.blocked(r.map.store.x, r.map.store.y), 'l\'entrepôt est solide, on peut s\'en approcher');
  });

  rule('Filons d\'or : on les mine quand aucun monstre n\'est à portée, puis ils réapparaissent.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const o = r.map.ores.find((q: { res: string; zone: number }) => q.res === 'gold' && q.zone <= 3);
    [p.x, p.y] = [o.x + 30, o.y];
    const gold0 = p.gold;
    for (let i = 0; i < 20 * 15 && r.oreHp[o.id] > 0; i++) r.step();
    check(r.oreHp[o.id] <= 0 && p.gold === gold0 + Math.round(oreGold(o.zone) * o.size), `filon miné : +${p.gold - gold0} or (zone ${o.zone}, taille ×${o.size.toFixed(2)})`);
    check(!r.map.blocked(o.x, o.y), 'épuisé, il disparaît : on passe à travers');
    r.time += 1000;
    r.tick = 9;
    r.step();
    check(r.oreHp[o.id] <= 0, 'quelqu\'un se tient à sa place : il attend pour réapparaître');
    [p.x, p.y] = [o.x + 200, o.y];
    r.tick = 9;
    r.step();
    check(r.oreHp[o.id] > 0 && r.map.blocked(o.x, o.y), 'le filon réapparaît après un délai, de nouveau solide');
  });

  rule('Expulsion : le fondateur bannit un compte (sa progression reste), puis peut le réintégrer.', () => {
    const r: any = new Room('TEST', undefined, {});
    r.founder = 'chef';
    let saved: { banned: { id: string; name: string }[] } = { banned: [] };
    r.onVillage = (v: typeof saved) => (saved = v);
    const msgs: string[] = [];
    let closed = false;
    const chef = r.addPlayer('Chef', noop, { userId: 'chef', profile: null });
    const bob = r.addPlayer('Bob', (m: { t: string; msg?: string }) => m.t === 'closed' && msgs.push(m.msg!), { userId: 'bob', profile: null });
    bob.close = () => (closed = true);
    r.onKick(bob, chef.id);
    check(!r.isBanned('chef') && !closed, 'un membre ordinaire ne peut pas expulser');
    r.onKick(chef, bob.id);
    check(closed && msgs.length === 1 && r.isBanned('bob') && saved.banned.some((b) => b.id === 'bob'), 'le fondateur expulse Bob : renvoyé au lobby, banni, sauvegardé');
    r.removePlayer(bob.id);
    check(!r.full && r.players.size === 1, 'sa place se libère');
    r.onUnban(chef, 'bob');
    check(!r.isBanned('bob') && saved.banned.length === 0, 'débanni : il peut revenir (avec sa progression)');
    const again: any = new Room('T2', r.seed, { banned: [{ id: 'x', name: 'X' }] });
    check(again.isBanned('x'), 'bannis rechargés avec le village');
  });

  rule('Chat : une ligne nettoyée, 200 caractères au plus, pas de rafale.', () => {
    const r = room();
    const said: string[] = [];
    const p = r.addPlayer('a', (m: { t: string; ev?: { e: string; text?: string }[] }) => m.t === 's' && m.ev!.forEach((e) => e.e === 'chat' && said.push(e.text!)));
    r.onChat(p, '  Salut   tout le monde  ');
    r.onChat(p, 'trop vite');
    r.time += 1;
    r.onChat(p, 'x'.repeat(500));
    r.onChat(p, '   ');
    r.step();
    check(said.length === 2 && said[0] === 'Salut tout le monde' && said[1].length === 200, `chat : ${said.length} messages relayés (espaces nettoyés, rafale et vide ignorés, 200 caractères max)`);
  });

  rule('Couleur d\'un dompteur : sa place dans le village, gardée quand les autres se déconnectent ou reviennent.', () => {
    const r = room();
    const a = r.addPlayer('Lou', noop, { userId: 'lou', profile: null });
    const b = r.addPlayer('Max', noop, { userId: 'max', profile: null });
    check(a.color === PLAYER_COLORS[0] && b.color === PLAYER_COLORS[1], 'deux membres : deux places, deux couleurs');
    const profA = r.profileOf(a), profB = r.profileOf(b);
    check(profA.seat === 0 && profB.seat === 1, 'la place est enregistrée avec la progression');
    r.removePlayer(a.id);
    check(b.color === PLAYER_COLORS[1], 'Lou se déconnecte : Max garde sa couleur');
    const c = r.addPlayer('Zoé', noop, { userId: 'zoe', profile: null });
    check(c.color === PLAYER_COLORS[2], 'une nouvelle venue ne prend pas la place de Lou, endormie au village');
    // le village se rouvre : Max revient seul, avant que les membres endormis ne soient chargés
    const r2 = room();
    const b2 = r2.addPlayer('Max', noop, { userId: 'max', profile: profB });
    check(b2.color === PLAYER_COLORS[1], 'Max revient seul : toujours sa couleur, pas la première libre');
    r2.addSleeper('lou', profA);
    const a2 = r2.addPlayer('Lou', noop, { userId: 'lou', profile: profA });
    check(a2.color === PLAYER_COLORS[0], 'Lou revient : la sienne aussi');
  });

  rule('Rochers petits, moyens ou gros, et arbres de toutes tailles : PV et récolte suivent la taille.', () => {
    const r = room(), m = r.map;
    const sizes = m.ores.map((o: { size: number }) => o.size);
    const small = sizes.filter((s: number) => s < 0.8).length, big = sizes.filter((s: number) => s > 1.25).length;
    check(small > 0 && big > 0 && sizes.every((s: number) => s > 0.6 && s < 1.5), `${small} petits et ${big} gros rochers sur ${sizes.length}`);
    check(m.ores.every((o: { id: number; zone: number; size: number }) => Math.abs(r.oreHp[o.id] - oreHp(o.zone) * o.size) < 1e-6), 'PV de chaque rocher proportionnels à sa taille');
    const scales = m.decor.filter((d: { kind: number }) => d.kind === 0).map((d: unknown) => m.treeScale(d));
    check(Math.min(...scales) >= 0.5 && Math.max(...scales) <= 1.5 && Math.max(...scales) - Math.min(...scales) > 0.8, 'arbres de ×0,5 à ×1,5 (bois et coups de hache)');
    // même graine, même carte : les tailles ne dépendent que de la position
    check(new Room('TEST2', r.seed).map.ores.every((o: { size: number }, i: number) => o.size === m.ores[i].size), 'mêmes tailles à chaque génération');
  });

  rule('Profil : une couleur libre au choix, des chapeaux achetés une fois en or, gardés à la reconnexion.', () => {
    const r = room();
    const a = r.addPlayer('Lou', noop, { userId: 'lou', profile: null });
    const b = r.addPlayer('Max', noop, { userId: 'max', profile: null });
    r.onProfile(a, 1, 0);
    check(a.color === PLAYER_COLORS[0], 'la couleur de Max est prise : Lou garde la sienne');
    r.onProfile(a, 7, 0);
    check(a.color === PLAYER_COLORS[7] && r.profileOf(a).seat === 7, 'une couleur libre : choisie et enregistrée');
    r.removePlayer(b.id);
    r.onProfile(a, 1, 0);
    check(a.color === PLAYER_COLORS[7], 'Max, endormi au village, garde sa couleur : personne ne la prend');
    a.gold = HAT_PRICES[4] - 1;
    r.onProfile(a, 7, 4);
    check(a.hat === 0 && a.gold === HAT_PRICES[4] - 1, 'pas assez d\'or : pas de tricorne');
    a.gold = HAT_PRICES[4] + 50;
    r.onProfile(a, 7, 4);
    check(a.hat === 4 && a.gold === 50 && a.hats.includes(4), `tricorne acheté ${HAT_PRICES[4]} or et porté`);
    r.onProfile(a, 7, 0);
    r.onProfile(a, 7, 4);
    check(a.hat === 4 && a.gold === 50, 'déjà acheté : on le remet sans payer');
    const back = r.addPlayer('Lou', noop, { userId: 'lou2', profile: r.profileOf(a) });
    check(back.hat === 4 && back.hats.includes(4), 'chapeau et achats gardés avec la progression');
  });

  rule('Tableau du village : géants battus, apprivoisements, dons, or dépensé pour le village ; enregistrés et visibles pour les déconnectés.', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner && !SPECIES[u.s].boss) r.units.delete(u.id);
    let board: { name: string; online: boolean; bosses: number; tamed: number; given: number; spent: number }[] = [];
    const p = r.addPlayer('Lou', (m: { t: string; rows?: typeof board }) => m.t === 'board' && (board = m.rows!), { userId: 'lou', profile: null });
    const q = r.addPlayer('Max', noop, { userId: 'max', profile: null });
    const c = r.map.caves[0];
    const boss = r.units.get(r.caveBoss[c.id]);
    r.damage(boss, 1, q);
    r.damage(boss, boss.hp, p);
    for (let i = 0; i < 30 && p.stats.tamed === 0; i++) {
      const w = r.createUnit(1, false, p.x + 20, p.y);
      r.killUnit(w, p);
    }
    p.wood = 7;
    p.stone = 5;
    [p.x, p.y] = [r.map.store.x, r.map.store.y + 50];
    r.onDeposit(p);
    const site = r.map.sites.findIndex((_: unknown, i: number) => !r.camps.includes(i));
    [p.x, p.y] = [r.map.sites[site].x, r.map.sites[site].y];
    p.gold = CAMP_COST;
    r.onEstablish(p, site);
    r.onBoard(p);
    const lou = board.find((b) => b.name === 'Lou'), max = board.find((b) => b.name === 'Max');
    check(lou?.bosses === 1 && max?.bosses === 1 && lou.tamed === 1 && lou.given === 12 && lou.spent === CAMP_COST && max?.spent === 0, `tableau : Lou ${lou?.bosses} géant, ${lou?.tamed} apprivoisé, ${lou?.given} donnés, ${lou?.spent} or pour un camp ; Max ${max?.bosses} géant`);
    const prof = r.profileOf(p);
    r.removePlayer(p.id);
    q.send = (m: { t: string; rows?: typeof board }) => m.t === 'board' && (board = m.rows!);
    r.onBoard(q);
    check(prof.stats?.given === 12 && prof.stats?.spent === CAMP_COST && board.some((b) => b.name === 'Lou' && !b.online && b.given === 12), 'statistiques enregistrées ; Lou déconnecté reste au tableau');
  });

  rule('Le pont du village : cassé au départ, réparé avec le bois et la pierre de son sac ; d\'ici là, on se réveille sur la plage.', () => {
    const r: any = new Room('TEST');
    const p = r.addPlayer('a', noop), m = r.map, br = m.bridge;
    const mid = { x: (br.a.x + br.b.x) / 2, y: (br.a.y + br.b.y) / 2 };
    check(m.blocked(mid.x, mid.y) && !r.buildings.includes('bridge'), 'nouveau village : le pont est cassé');
    const back = r.respawnPoint(m.village.x, m.village.y);
    check(back.x === m.spawn.x && back.y === m.spawn.y, 'pont cassé : on réapparaît sur la plage, pas sur l\'îlot');
    [p.x, p.y] = [br.a.x - (br.b.x - br.a.x) * 0.1, br.a.y - (br.b.y - br.a.y) * 0.1];
    p.wood = BUILDINGS.bridge.wood - 1;
    p.stone = BUILDINGS.bridge.stone;
    r.onBuild(p, 'bridge');
    check(!r.buildings.includes('bridge'), 'pas assez de bois dans le sac : rien');
    p.wood++;
    r.onBuild(p, 'bridge');
    check(r.buildings.includes('bridge') && !m.blocked(mid.x, mid.y) && p.wood === 0 && p.stone === 0, `pont réparé (${costText(buildingCost('bridge'))}, pris dans le sac) : on passe`);
    const old = new Room('TEST', r.seed, { buildings: ['palisade'], hall: 1 });
    check(old.buildings.includes('bridge'), 'un village déjà commencé : son pont est déjà réparé');
  });

  rule('Tableau du village : monstres vaincus, dégâts, plus gros coup, chutes, récolte, temps de jeu ; sauvegardés.', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const p = r.addPlayer('Lou', noop);
    const at = r.map.spineAt(r.map.zoneFrom(2) + 600);
    [p.x, p.y] = [at.x, at.y];
    const foe = r.createUnit(0, false, at.x + 30, at.y);
    r.damage(foe, 7, p);
    r.damage(foe, 1000, p);
    p.hp = 1;
    r.damage(p, 1000, foe);
    r.events.push({ e: 'res', to: p.id, wood: 3, stone: 2, x: 0, y: 0 });
    for (let i = 0; i < 20; i++) r.step();
    const st = r.profileOf(p).stats;
    check(st.kills === 1 && st.dmg >= 1007 && st.best === 1000 && st.deaths === 1 && st.wood === 3 && st.stone === 2 && st.time >= 1,
      `stats comptées (vaincus ${st.kills}, dégâts ${st.dmg}, plus gros coup ${st.best}, chutes ${st.deaths}, bois ${st.wood}, temps ${st.time} s)`);
  });
});
