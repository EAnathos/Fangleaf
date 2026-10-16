// Tests des règles de simulation, sans réseau. Usage : npm run test:rules

import { SHORE_R, ALPHA_CREATE_COST, ARMY_CAP, SHOT_KINDS, DT, PLAYER_RESPAWN_S, REVIVE_HOLD_S, REVIVE_R, REVIVE_WINDOW_S, armorMaxHp, BOSS_RESPAWN_S, BUILDING_IDS, mountSpeedOf, DEATH_GOLD_LOSS, BERRIES_PICKED, fruitTameChance, HALL, HALL_MAX, gateHall, gateOpen, zoneBosses, resYield, oreStone, BUSH_REGROW_S, CHEST_GOLD, BUILDINGS, CAMP_COST, caveUnlockCost, monsterBuyPrice, monsterSellPrice, CAMP_R, RECALL_R, SPECIES, WORLD_HALF, alphaAwakenS, alphaStats, alphaUpCost, oreGold } from '../shared/config.ts';
import { WorldMap } from '../shared/worldmap.ts';
import { DAY_MS, sky } from '../shared/weather.ts';
import { Room } from '../server/room.ts';
import { SnapshotState } from '../shared/snapshot.ts';

// Hasard reproductible : même graine à chaque exécution, donc même résultat en local et en CI.
// TEST_SEED=… npm run test:rules pour en essayer une autre.
const TEST_SEED = Number(process.env.TEST_SEED ?? 1);
let rng = TEST_SEED >>> 0;
Math.random = () => {
  // mulberry32
  rng = (rng + 0x6d2b79f5) >>> 0;
  let t = rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

let failed = false;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) failed = true;
};
// Village de test : tous les bâtiments construits et toutes les grottes débloquées (sauf mention contraire).
const ALL_CAVES = Array.from({ length: 64 }, (_, i) => i);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_BOSSES = SPECIES.map((sp, i) => (sp.boss ? i : -1)).filter((i) => i >= 0);
// (toutes les portes ouvertes : Hôtel de ville au maximum, tous les géants vaincus)
const room = (): any => new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX, beaten: ALL_BOSSES });
const noop = () => {};

{
  // Mort : la meute se disperse, les Alphas restent.
  const r = room();
  const p = r.addPlayer('a', noop);
  p.x = r.map.den.x;
  p.y = r.map.den.y;
  p.essences[1] = ALPHA_CREATE_COST;
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
}

{
  // Pas de régénération hors du village, régénération au village.
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
}

{
  // Monstres sauvages : récupération progressive quand on cesse de les frapper.
  const r = room();
  const p = r.addPlayer('a', noop);
  const w = [...r.units.values()].find((u: { owner: number }) => !u.owner);
  r.damage(w, w.maxHp / 2, p);
  const hit = w.hp;
  for (let i = 0; i < 20 * 3; i++) r.regen(), (r.time += 1 / 20); // 3 s : encore « en combat »
  check(w.hp === hit, 'pas de récupération juste après un coup');
  for (let i = 0; i < 20 * 3; i++) r.regen(), (r.time += 1 / 20); // puis 3 s de calme
  check(w.hp > hit && w.hp < w.maxHp, `récupération progressive ensuite (${Math.round(hit)} → ${Math.round(w.hp)} / ${w.maxHp})`);
}

{
  // Rappel : trop loin du dompteur, la meute lâche sa cible et revient.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop);
  p.x = r.map.spawn.x;
  p.y = r.map.spawn.y;
  const f = r.createUnit(1, false, p.x, p.y);
  f.owner = p.id;
  p.army.push(f.id);
  // un point libre à RECALL_R + 100 du dompteur (dans n'importe quelle direction)
  let spot = { x: p.x, y: p.y };
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const q = { x: p.x + Math.cos(a) * (RECALL_R + 100), y: p.y + Math.sin(a) * (RECALL_R + 100) };
    if (!r.map.blocked(q.x, q.y) && !r.map.blocked(q.x - 30, q.y)) {
      spot = q;
      break;
    }
  }
  const wild = r.createUnit(3, false, spot.x, spot.y);
  f.x = wild.x - 30;
  f.y = wild.y;
  f.target = wild.id;
  r.step();
  check(f.recalling && f.target === 0, 'la meute trop éloignée abandonne le combat');
  const d0 = Math.hypot(f.x - p.x, f.y - p.y);
  for (let i = 0; i < 10; i++) r.step();
  check(Math.hypot(f.x - p.x, f.y - p.y) < d0, 'et revient vers le dompteur');
}

{
  // Forge : arme et armure séparées.
  const r = room();
  const p = r.addPlayer('a', noop);
  p.x = r.map.forge.x;
  p.y = r.map.forge.y;
  p.gold = 1000;
  r.onUpgrade(p, 'weapon');
  r.onUpgrade(p, 'weapon');
  r.onUpgrade(p, 'armor');
  check(p.weapon === 2 && p.armor === 1, `arme niv. ${p.weapon}, armure niv. ${p.armor}`);
}

{
  // Tanière : éveiller un Alpha avec des essences, le renforcer (de plus en plus cher), sauvegarde du profil.
  const r = room();
  const p = r.addPlayer('a', noop);
  p.x = r.map.den.x;
  p.y = r.map.den.y;
  p.essences[1] = ALPHA_CREATE_COST - 1;
  r.onAlphaCreate(p, 1);
  check(p.army.length === 0, 'pas assez d\'essences : pas d\'éveil');
  p.essences[1] = ALPHA_CREATE_COST * 2;
  r.onAlphaCreate(p, 1);
  r.onAlphaCreate(p, 1);
  check(p.army.length === 0 && p.awakening.has(1) && p.essences[1] === ALPHA_CREATE_COST, `éveil lancé, pas encore là (${alphaAwakenS(1)} s pour un Loup)`);
  r.step();
  check(p.army.length === 0, 'toujours en éveil au tick suivant');
  p.awakening.set(1, Date.now() - 1); // le temps est écoulé
  p.x = r.map.den.x; // (rester sur place)
  r.step();
  check(p.army.length === 1 && r.units.get(p.army[0]).alpha, 'Alpha Loup éveillé, un seul par espèce');
  const a = r.units.get(p.army[0]);
  const hp0 = a.maxHp;
  check(a.maxHp === Math.round(SPECIES[1].hp * 2.5 * 1.05) && a.dmg === Math.round(SPECIES[1].dmg * 2.5 * 1.05), `Alpha niv. 0 = 2,5× le Loup, +5 % de collection (PV ${a.maxHp}, dégâts ${a.dmg})`);
  p.essences[1] = alphaUpCost(0);
  r.onAlphaUp(p, a.s);
  check(a.level === 1 && a.maxHp > hp0 && p.essences[1] === 0, `Alpha renforcé (PV ${hp0} → ${a.maxHp})`);
  r.onAlphaUp(p, a.s);
  check(a.level === 1, 'pas assez d\'essences : refusé');
  check(alphaUpCost(1) > alphaUpCost(0) && alphaUpCost(5) > 3 * alphaUpCost(1), `coûts croissants : ${[0, 1, 2, 3, 4, 5].map(alphaUpCost).join(', ')}…`);

  // Les Alphas ne comptent pas dans la limite de meute.
  for (let i = 0; i < ARMY_CAP; i++) {
    const u = r.createUnit(0, false, 600, 0);
    u.owner = p.id;
    p.army.push(u.id);
  }
  check(r.armySize(p) === ARMY_CAP, 'limite de meute hors Alphas');

  p.essences[2] = ALPHA_CREATE_COST;
  r.onAlphaCreate(p, 2);
  const prof = r.profileOf(p);
  check(prof.alphas.some((a: { s: number; wakeAt?: number }) => a.s === 2 && a.wakeAt), 'éveil en cours sauvegardé dans le profil');
  check(prof.alphas.filter((x: { wakeAt?: number }) => !x.wakeAt).length === 1 && prof.alphas[0].lvl === 1, 'le profil ne garde que les Alphas (pas la meute ordinaire)');
  const r2 = room();
  const p2 = r2.addPlayer('a', noop, { userId: 'u1', profile: prof });
  const back = r2.units.get(p2.army[0]);
  check(back?.alpha && back.level === 1 && back.maxHp === a.maxHp, 'profil rechargé : Alpha recréé au bon niveau');
  check(p2.awakening.has(2) && p2.army.filter((id: number) => r2.units.get(id)?.alpha).length === 1, 'profil rechargé : l\'éveil du Sanglier continue');
}

{
  // Aucun Alpha sauvage, même après beaucoup de kills.
  const r = room();
  const p = r.addPlayer('a', noop);
  for (let i = 0; i < 40; i++) {
    const w = [...r.units.values()].find((u: { owner: number }) => !u.owner);
    if (w) r.killUnit(w, p);
  }
  check(![...r.units.values()].some((u: { owner: number; alpha: boolean }) => !u.owner && u.alpha), 'aucun Alpha sauvage après 40 kills');
}

{
  // Les 8 espèces apparaissent sur la carte, deux par zone.
  const r = room();
  const seen = new Set([...r.units.values()].map((u: { s: number }) => u.s));
  check(SPECIES.every((sp, i) => seen.has(i) || sp.night), `les ${SPECIES.length} espèces (dont ${SPECIES.filter((sp) => sp.boss).length} géants) sont présentes au lancement (de jour, sauf les bêtes de nuit)`);
  const zones = new Map<number, number>();
  for (const sp of SPECIES) if (!sp.boss && !sp.passive) zones.set(sp.zone, (zones.get(sp.zone) ?? 0) + 1);
  check([1, 2, 3].every((z) => zones.get(z) === 2) && zones.get(4) === 3 && zones.get(5) === 3, 'deux espèces hostiles par zone, trois en zones 4 et 5');
}

{
  // Montures : monter sur un Alpha Loup, vitesse, partage des dégâts, désarçonné quand il tombe.
  const r = room();
  const p = r.addPlayer('a', noop);
  p.x = r.map.den.x;
  p.y = r.map.den.y;
  p.essences[0] = ALPHA_CREATE_COST;
  r.onAlphaCreate(p, 0);
  r.onCheat(p);
  r.step();
  const slimeAlpha = r.units.get(p.army[0]);
  r.onMount(p, slimeAlpha.id);
  check(p.mount === 0, 'un Alpha Gluant ne se chevauche pas');
  p.essences[1] = ALPHA_CREATE_COST;
  r.onAlphaCreate(p, 1);
  r.onCheat(p);
  r.step();
  const wolf = r.units.get(p.army[1]);
  r.onMount(p, wolf.id);
  check(p.mount === wolf.id, 'en selle sur l\'Alpha Loup');
  const hp0 = p.hp, mhp0 = wolf.hp;
  const foe = r.createUnit(1, false, p.x + 30, p.y);
  r.damage(p, 20, foe);
  check(wolf.hp === mhp0 - 15 && p.hp < hp0 && hp0 - p.hp <= 5, `la monture encaisse 75 % (monture −${mhp0 - wolf.hp}, dompteur −${hp0 - p.hp})`);
  wolf.hp = 10;
  r.damage(p, 20, foe);
  check(p.mount === 0 && wolf.reviveAt > 0 && !p.dead, 'monture tombée : dompteur désarçonné mais vivant');
  r.onMount(p, 0);
  check(p.mount === 0, 'descendre sans monture : sans effet');
}

{
  // Carte générée : un long couloir depuis un bord (haut, droite ou bas), village loin du camp, chemin praticable.
  for (const seed of [1, 42, 777, 123456789]) {
    const m = new WorldMap(seed);
    const d = Math.hypot(m.village.x - m.spawn.x, m.village.y - m.spawn.y);
    let pathOk = true;
    // le long du chemin de terre (hors cercle de pierres du camp), puis de la porte jusqu'au feu de camp
    for (let i = 1; i < m.path.length; i++) {
      const [ax, ay] = m.path[i - 1], [bx, by] = m.path[i];
      for (let t = 0; t <= 1; t += 0.1) {
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (Math.hypot(x - m.spawn.x, y - m.spawn.y) > 40 && m.blocked(x, y)) pathOk = false;
      }
    }
    for (let t = 0; t <= 0.85; t += 0.01) {
      if (m.blocked(m.gate.x + (m.village.x - m.gate.x) * t, m.gate.y + (m.village.y - m.gate.y) * t)) pathOk = false;
    }
    let water = 0, n = 0;
    let lw = 0, ln = 0, dw = 0, dn = 0;
    for (let x = -WORLD_HALF + 20; x < WORLD_HALF; x += 80) {
      for (let y = -WORLD_HALF + 20; y < WORLD_HALF; y += 80) {
        if (m.isForest(x, y)) continue;
        const z = m.zoneAt(x, y);
        if (z === 5) ln++, lw += +m.isWater(x, y);
        else if (z === 6) dn++, dw += +m.isWater(x, y);
        else n++, water += +m.isWater(x, y);
      }
    }
    check(d >= 800 && !m.inVillage(m.spawn.x, m.spawn.y) && pathOk && water / n > 0.04 && water / n < 0.2 && lw / ln > 0.15 && dw / dn < 0.06,
      `graine ${seed} : village à ${Math.round(d)} px du camp, chemin libre, ${Math.round((100 * water) / n)} % de lacs (zone 5 : ${Math.round((100 * lw) / ln)} %, désert : ${Math.round((100 * dw) / dn)} % d'oasis)`);
    const edge = WORLD_HALF - 1000;
    check(m.spawn.y < -edge || m.spawn.x > edge || m.spawn.y > edge, `graine ${seed} : camp de départ au bord haut, droit ou bas (${Math.round(m.spawn.x)}, ${Math.round(m.spawn.y)})`);
    const site = m.sites[0], stone = m.stones[1];
    const reach = m.findPath(m.village.x, m.village.y + 40, stone.x, stone.y + 50, 500000);
    const zones = [1, 3, 5, 7, 9, 11].map((k) => k / 12).map((f) => { const q = m.spineAt(f * m.length); return m.zoneAt(q.x, q.y); }).join('');
    const end = m.spineAt(m.length - 250);
    const reachEnd = m.findPath(stone.x, stone.y + 50, end.x, end.y, 600000);
    check(m.sites.length === 1 && m.zoneAt(site.x, site.y) === 4 && !!reach && !!reachEnd && zones === '123456' && m.caves.length === 15,
      `graine ${seed} : couloir de ${m.length} px, zones ${zones}, camp au bout de la zone 4, bout de la Mer de sable atteignable, 15 grottes`);
    check(m.isForest(m.spineAt(5000).x + m.normalAt(5000).x * 1200, m.spineAt(5000).y + m.normalAt(5000).y * 1200) && m.blocked(m.spineAt(5000).x + m.normalAt(5000).x * 1200, m.spineAt(5000).y + m.normalAt(5000).y * 1200),
      `graine ${seed} : forêt infranchissable de part et d'autre du couloir`);
  }
  const a = new WorldMap(99), b = new WorldMap(99);
  check(a.village.x === b.village.x && a.sites[0].x === b.sites[0].x && a.isWater(500, 500) === b.isWater(500, 500) && a.zoneAt(2000, -1500) === b.zoneAt(2000, -1500), 'carte déterministe');
  const r = room();
  check(![...r.units.values()].some((u: { s: number; x: number; y: number }) => !SPECIES[u.s].swim && r.map.blocked(u.x, u.y)), 'aucun monstre dans l\'eau (sauf les serpents)');
  const all = [...r.units.values()] as { s: number; x: number; y: number }[];
  const inZone = all.filter((u) => r.map.zoneAt(u.x, u.y) === SPECIES[u.s].zone).length / all.length;
  check(inZone > 0.9, `monstres dans leur zone (${Math.round(inZone * 100)} %, ${all.length} au total)`);
  // Répartis le long de leur tronçon : jamais entassés au début ni au bout du couloir.
  // Moyenne sur 6 cartes : les meutes tombent au hasard (≈ 16 % ± 7 % près du bout sur une seule carte).
  const rooms = [r, ...Array.from({ length: 5 }, () => room())];
  for (const z of [1, 5]) {
    const piled = rooms.map((rm) => {
      const zs = ([...rm.units.values()] as { s: number; x: number; y: number }[]).filter((u) => SPECIES[u.s].zone === z);
      const ends = [rm.map.spineAt(0), rm.map.spineAt(rm.map.length)];
      return Math.max(...ends.map((e: { x: number; y: number }) => zs.filter((u) => Math.hypot(u.x - e.x, u.y - e.y) < 900).length)) / zs.length;
    }).reduce((x, y) => x + y) / rooms.length;
    check(piled < 0.25, `zone ${z} : pas d'entassement aux extrémités du couloir (${Math.round(piled * 100)} % près d'un bout, moyenne sur ${rooms.length} cartes)`);
  }
  const p = r.addPlayer('a', noop);
  check(Math.hypot(p.x - r.map.spawn.x, p.y - r.map.spawn.y) < 120 && !r.map.inVillage(p.x, p.y), 'arrivée au camp de départ, pas au village');
  check(!r.profileOf(p).village_found, 'village pas encore découvert');
  p.x = r.map.village.x;
  p.y = r.map.village.y;
  r.step();
  const prof = r.profileOf(p);
  check(prof.village_found, 'village découvert en y entrant');
  const p2 = r.addPlayer('a', noop, { userId: 'u2', profile: prof });
  check(r.map.inVillage(p2.x, p2.y), 'village découvert : on y apparaît directement en rejoignant');
}

{
  // Filons d'or : on les mine quand aucun monstre n'est à portée, puis ils réapparaissent.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop);
  const o = r.map.ores.find((q: { res: string; zone: number }) => q.res === 'gold' && q.zone <= 3);
  [p.x, p.y] = [o.x + 30, o.y];
  const gold0 = p.gold;
  for (let i = 0; i < 20 * 15 && r.oreHp[o.id] > 0; i++) r.step();
  check(r.oreHp[o.id] <= 0 && p.gold === gold0 + oreGold(o.zone), `filon miné : +${p.gold - gold0} or (zone ${o.zone})`);
  check(!r.map.blocked(o.x, o.y), 'épuisé, il disparaît : on passe à travers');
  r.time += 1000;
  r.tick = 9;
  r.step();
  check(r.oreHp[o.id] <= 0, 'quelqu\'un se tient à sa place : il attend pour réapparaître');
  [p.x, p.y] = [o.x + 200, o.y];
  r.tick = 9;
  r.step();
  check(r.oreHp[o.id] > 0 && r.map.blocked(o.x, o.y), 'le filon réapparaît après un délai, de nouveau solide');
}

{
  // Grottes : entrer avec sa meute, mini-boss, âme, réapparition du boss.
  const r = room();
  const p = r.addPlayer('a', noop);
  const c = r.map.caves[0];
  const perZone = [1, 2, 3, 4, 5, 6].map((z) => r.map.caves.filter((cv: { zone: number }) => cv.zone === z).length).join('');
  check(r.map.caves.length === 15 && perZone === '222333' && r.map.caves.every((cv: { boss: number; zone: number }) => SPECIES[cv.boss].boss && SPECIES[cv.boss].zone === cv.zone),
    `15 grottes (${perZone} par zone), un géant par espèce`);
  check(SPECIES.filter((sp) => !sp.boss && !sp.passive).every((sp) => SPECIES.some((b) => b.boss && b.base === sp.key)), 'chaque espèce hostile a son géant (âme → Alpha légendaire)');
  const f = r.createUnit(0, false, 0, 0);
  f.owner = p.id;
  p.army.push(f.id);
  [p.x, p.y] = [c.entrance.x, c.entrance.y + 20];
  r.onCave(p, c.id, true);
  check(r.map.caveAt(p.x, p.y)?.id === c.id && r.map.caveAt(f.x, f.y)?.id === c.id, 'entrée dans la grotte avec sa meute');
  const bossId = r.caveBoss[c.id];
  const boss = r.units.get(bossId);
  check(!!boss && r.map.caveAt(boss.x, boss.y)?.id === c.id, `le mini-boss (${SPECIES[c.boss].name}) attend dans la grotte`);
  let souls = 0;
  for (let k = 0; k < 40; k++) {
    const b = r.units.get(r.caveBoss[c.id]) ?? r.units.get(r.spawnBoss(c.id));
    r.caveBoss[c.id] = b.id;
    [b.x, b.y] = [p.x + 30, p.y];
    r.killUnit(b, p);
    souls = p.essences[c.boss];
  }
  check(souls > 0 && souls <= 3, `âme lâchée parfois, jamais plus de 3 en poche (${souls} après 40 victoires)`);
  const chest = r.chests.find((ch: { cave: number }) => ch.cave === c.id);
  check(!!chest && Math.hypot(chest.x - c.inside.x, chest.y - (c.inside.y - 190)) < 60, 'le coffre apparaît au fond de la grotte, derrière la place du géant');
  check(r.caveBoss[c.id] === 0 && r.caveBack[c.id] > r.time + BOSS_RESPAWN_S - 1, 'le mini-boss reviendra après le délai');
  check(!p.army.some((id: number) => r.units.get(id)?.s === c.boss), 'un mini-boss ne s\'apprivoise pas');
  [p.x, p.y] = [c.exit.x, c.exit.y];
  r.onCave(p, c.id, false);
  check(!r.map.caveAt(p.x, p.y) && Math.hypot(p.x - c.entrance.x, p.y - c.entrance.y) < 200, 'sortie : retour devant l\'entrée');

  // Âme → l'Alpha de l'espèce devient légendaire.
  [p.x, p.y] = [r.map.den.x, r.map.den.y];
  r.onAlphaCreate(p, c.boss);
  check(!p.awakening.has(c.boss), 'pas d\'Alpha de boss : l\'âme sert à l\'évolution');
  const base = SPECIES.findIndex((sp) => sp.key === SPECIES[c.boss].base);
  p.essences[base] = ALPHA_CREATE_COST;
  r.onAlphaCreate(p, base);
  r.onCheat(p);
  r.step();
  const al = p.army.map((id: number) => r.units.get(id)).find((u: { alpha: boolean; s: number }) => u?.alpha && u.s === base);
  const hp0 = al.maxHp, soulsBefore = p.essences[c.boss];
  r.onLegend(p, al.s);
  check(al.legend && Math.abs(al.maxHp - hp0 * 1.5) <= 1 && p.essences[c.boss] === soulsBefore - 3,
    `3 âmes de ${SPECIES[c.boss].name} : Alpha ${SPECIES[base].name} légendaire (PV ${hp0} → ${al.maxHp})`);
  p.essences[c.boss] = 0;
  [p.x, p.y] = [c.inside.x, c.inside.y + 80];
  for (let k = 0; k < 40; k++) {
    const b = r.units.get(r.caveBoss[c.id]) ?? r.units.get(r.spawnBoss(c.id));
    r.caveBoss[c.id] = b.id;
    [b.x, b.y] = [p.x + 30, p.y];
    r.killUnit(b, p);
  }
  check(p.essences[c.boss] === 0, 'Alpha déjà légendaire : le géant ne lâche plus d\'âme');
  const prof = r.profileOf(p);
  const r2 = room();
  const p2 = r2.addPlayer('a', noop, { userId: 'u9', profile: prof });
  check(p2.army.some((id: number) => r2.units.get(id)?.legend), 'le statut légendaire est sauvegardé');
}

{
  // Attaques spéciales : chaque géant combat un dompteur 25 s dans sa grotte.
  const r = room();
  for (const c of r.map.caves) {
    const seen = new Set<string>();
    let boss: { id: number; x: number; y: number; hp: number; maxHp: number } = r.units.get(r.caveBoss[c.id]);
    // les événements arrivent dans les snapshots envoyés au joueur
    const p = r.addPlayer('t' + c.id, (m: { t: string; ev?: { e: string; id?: number; kind?: string }[] }) => {
      for (const e of m.ev ?? []) if (e.e === 'move' && e.id === boss.id) seen.add(e.kind!);
    });
    p.armor = 10;
    [p.x, p.y] = [boss.x + 120, boss.y + 60];
    r.onChallenge(p, c.id); // on lui parle : le combat commence
    let hazards = 0, minions = 0;
    for (let i = 0; i < 20 * 25; i++) {
      p.hp = 9999; // on observe les attaques sans mourir
      if (boss.hp > 0 && i % 20 === 0) r.damage(boss, boss.maxHp * 0.04, p); // le combat avance
      r.step();
      hazards = Math.max(hazards, r.hazards.length);
      minions = Math.max(minions, [...r.units.values()].filter((u: { summoner: number }) => u.summoner === boss.id).length);
    }
    check(seen.size >= 2, `${SPECIES[c.boss].name} : ${[...seen].join(', ')}${minions ? ` · ${minions} renforts` : ''}`);
    r.removePlayer(p.id);
  }
}

{
  // Apprivoisé : moitié moins fort que sauvage.
  const r = room();
  const p = r.addPlayer('a', noop);
  let tamed;
  for (let i = 0; i < 60 && !tamed; i++) {
    const w = r.createUnit(1, false, p.x + 40, p.y);
    r.killUnit(w, p);
    if (w.owner === p.id) tamed = w;
  }
  check(!!tamed && tamed.maxHp === Math.round(SPECIES[1].hp * 0.575) && tamed.dmg === Math.round(SPECIES[1].dmg * 0.5),
    `Loup apprivoisé : ${tamed?.maxHp} PV / ${tamed?.dmg} dégâts (sauvage : ${SPECIES[1].hp} / ${SPECIES[1].dmg})`);
}

{
  // Essences : environ 35 % de drop par kill.
  const r = room();
  const p = r.addPlayer('a', noop);
  for (let i = 0; i < 400; i++) {
    const w = r.createUnit(0, false, p.x + 40, p.y);
    r.killUnit(w, p);
    if (w.owner) r.units.delete(w.id);
  }
  const rate = p.essences[0] / 400;
  check(rate > 0.27 && rate < 0.43, `taux de drop d'essence : ${Math.round(rate * 100)} % (attendu ~35 %)`);
}

{
  // Obstacles : arbres et palissade bloquent, les portes laissent passer.
  const m = new WorldMap(42);
  const tree = m.decor.find((d) => d.kind === 0)!;
  check(m.blocked(tree.x, tree.y + m.decorSize(tree) * 0.15), `les arbres bloquent (${m.decor.filter((d) => d.kind === 0).length} arbres)`);
  const v = m.village;
  check(m.blocked(v.x + Math.cos(0.7) * 360, v.y + Math.sin(0.7) * 360), 'la palissade bloque');
  check([0, 1, 2, 3].every((g) => !m.blocked(v.x + Math.cos((g * Math.PI) / 2) * 360, v.y + Math.sin((g * Math.PI) / 2) * 360)), 'les 4 portes laissent passer');
  check(!m.blocked(m.forge.x, m.forge.y + 70) && !m.blocked(m.den.x, m.den.y + 70), 'on peut approcher de la forge et de la tanière');
  check(m.blocked(m.forge.x - 40, m.forge.y) && m.blocked(v.x - 180, v.y - 140), 'la forge et les huttes sont solides');
}

{
  // Les monstres sauvages attaquent en priorité le plus proche (dompteur ou monstre de meute).
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
}

{
  // Recherche de chemin : contourner la palissade par une porte au lieu de foncer dans le mur.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop);
  const v = r.map.village;
  [p.x, p.y] = [v.x + Math.cos(0.75) * 250, v.y + Math.sin(0.75) * 250]; // dans le village, près du mur
  const out = r.map.freeNear(v.x + Math.cos(0.75) * 470, v.y + Math.sin(0.75) * 470); // juste derrière le mur
  const path = r.map.findPath(out.x, out.y, p.x, p.y);
  let ok = !!path;
  let prev = out;
  for (const q of path ?? []) {
    if (!r.map.clearLine(prev.x, prev.y, q.x, q.y)) ok = false;
    prev = q;
  }
  check(ok && path!.length >= 2, `détour calculé sans traverser d'obstacle (${path?.length} étapes)`);
  const f = r.createUnit(1, false, out.x, out.y);
  f.owner = p.id;
  p.army.push(f.id);
  let maxStuck = 0, closest = Infinity; // au plus près : ensuite, il peut repartir chasser ce qui apparaît autour
  for (let i = 0; i < 20 * 12; i++) {
    r.step();
    maxStuck = Math.max(maxStuck, f.stuck);
    closest = Math.min(closest, Math.hypot(f.x - p.x, f.y - p.y));
  }
  check(closest < 160 && maxStuck < 2.5, `le Loup de la meute fait le tour par la porte (arrivé à ${Math.round(closest)} px, jamais coincé)`);
}

{
  // Meute ordinaire sauvegardée avec la progression.
  const r = room();
  const p = r.addPlayer('a', noop, { userId: 'u1', profile: null });
  for (const sp of [0, 0, 5]) {
    const w = r.createUnit(sp, false, p.x + 30, p.y);
    r.makeTamed(w, p);
  }
  const prof = r.profileOf(p);
  check(JSON.stringify(prof.pack) === '[0,0,5]', `meute sauvegardée : ${JSON.stringify(prof.pack)}`);
  const r2 = room();
  const p2 = r2.addPlayer('a', noop, { userId: 'u1', profile: prof });
  const back = p2.army.map((id: number) => r2.units.get(id));
  check(back.length === 3 && back.every((u: { maxHp: number; s: number }) => u.maxHp === Math.round(SPECIES[u.s].hp * 0.575)), 'meute retrouvée à la reconnexion (stats d\'apprivoisés)');
}

{
  // 5 Alphas équipés au maximum ; les autres se reposent à la Tanière et comptent pour la collection.
  const r = room();
  const p = r.addPlayer('a', noop);
  [p.x, p.y] = [r.map.den.x, r.map.den.y];
  const kinds = [0, 1, 2, 3, 4, 5, 6];
  for (const s of kinds) {
    p.essences[s] = ALPHA_CREATE_COST;
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
}

{
  // Géants : coup de balayage au corps à corps ; leurs renforts ne s'apprivoisent pas.
  const r = room();
  const c = r.map.caves[0];
  const boss = r.units.get(r.caveBoss[c.id]);
  const p = r.addPlayer('a', noop);
  const f = r.createUnit(0, false, boss.x - boss.r - 10, boss.y);
  r.makeTamed(f, p);
  [p.x, p.y] = [boss.x + boss.r + 10, boss.y];
  p.hp = p.maxHp = 9999;
  f.hp = f.maxHp = 9999;
  boss.moveCd = boss.moveCd.map(() => 99); // pas d'attaque spéciale : on observe le corps à corps
  boss.dormant = false;
  for (let i = 0; i < 20 * 3; i++) {
    [p.x, p.y] = [boss.x + boss.r + 10, boss.y];
    [f.x, f.y] = [boss.x - boss.r - 10, boss.y];
    r.step();
  }
  check(p.hp < 9999 && f.hp < 9999, `${SPECIES[c.boss].name} frappe au corps à corps tout ce qui le colle (dompteur −${Math.round(9999 - p.hp)}, meute −${Math.round(9999 - f.hp)})`);
  let tamed = 0;
  for (let i = 0; i < 60; i++) {
    const m = r.createUnit(0, false, p.x + 30, p.y);
    m.summoner = boss.id;
    r.killUnit(m, p);
    if (m.owner) tamed++;
  }
  check(tamed === 0, 'les renforts d\'un géant ne s\'apprivoisent jamais (0 sur 60)');
}

{
  // Renforts d'un géant : ils disparaissent dès que plus aucun dompteur debout n'est dans la grotte.
  const r = room();
  const c = r.map.caves[0];
  const boss = r.units.get(r.caveBoss[c.id]);
  const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
  const inside = () => [...r.units.values()].filter((u: { summoner: number }) => u.summoner === boss.id).length;
  const settle = () => {
    r.tick = 0; // le nettoyage passe tous les 5 ticks
    r.clearEmptyCaves();
  };
  [p.x, p.y] = [c.inside.x, c.inside.y + 80];
  [q.x, q.y] = [c.inside.x + 40, c.inside.y + 80];
  r.summonMinions(boss, 3, 99);
  settle();
  check(inside() === 3, 'renforts présents tant que des dompteurs sont dans la grotte');
  [p.x, p.y] = [c.entrance.x, c.entrance.y + 70]; // sorti
  settle();
  check(inside() === 3, 'un coéquipier encore dans la grotte : les renforts restent');
  r.killPlayer(q);
  settle();
  check(inside() === 0, 'le dernier dompteur meurt : les renforts disparaissent');
  [p.x, p.y] = [c.inside.x, c.inside.y + 80];
  r.summonMinions(boss, 2, 99);
  [p.x, p.y] = [c.exit.x, c.exit.y];
  r.onCave(p, c.id, false);
  settle();
  check(!r.map.caveAt(p.x, p.y) && inside() === 0, 'sortie volontaire : les renforts disparaissent');
  check(r.units.has(boss.id), 'le géant, lui, reste dans sa grotte');
}

{
  // Coup ordinaire d'un géant : une seule cible, plus fort (deux pour la reine des Gluants et l'ours) ; les zones, c'est pour ses compétences.
  const r = room();
  const hits = (key: string) => {
    const c = r.map.caves.find((k: { boss: number }) => SPECIES[k.boss].key === key);
    const boss = r.units.get(r.caveBoss[c.id]);
    boss.dormant = false;
    boss.atkCd = 0;
    const p = r.addPlayer('m' + key, noop);
    [p.x, p.y] = [boss.x, boss.y + 400];
    const pack = [0, 1, 2, 3].map((k) => {
      const u = r.createUnit(1, false, boss.x + Math.cos(k * 1.5) * (boss.r + 4), boss.y + Math.sin(k * 1.5) * (boss.r + 4));
      u.owner = p.id;
      u.maxHp = u.hp = 99999;
      p.army.push(u.id);
      return u;
    });
    r.grid.clear();
    for (const u of pack) r.grid.insert(u);
    r.bossMelee(boss);
    const hurt = pack.filter((u) => u.hp < u.maxHp);
    return [hurt.length, hurt.length ? Math.round(99999 - hurt[0].hp) : 0, boss.dmg];
  };
  const [n1, d1, base1] = hits('shadow_fang');
  check(n1 === 1 && d1 > base1, `Croc-d'Ombre ne frappe qu'une cible, plus fort (${d1} au lieu de ${base1})`);
  check(hits('slime_queen')[0] === 2 && hits('colossus')[0] === 2, 'la reine des Gluants et l\'ours en frappent deux à la fois');
}

{
  // Un géant endormi ne se pousse pas : il reste au centre de sa grotte.
  const r = room();
  const c = r.map.caves[0];
  const boss = r.units.get(r.caveBoss[c.id]);
  const home = [boss.x, boss.y];
  const p = r.addPlayer('a', noop);
  const f = r.createUnit(1, false, boss.x + boss.r * 0.5, boss.y);
  f.owner = p.id;
  p.army.push(f.id);
  [p.x, p.y] = [boss.x - boss.r * 0.5, boss.y];
  r.grid.clear();
  for (const e of [boss, f, p]) r.grid.insert(e);
  r.separate();
  check(boss.x === home[0] && boss.y === home[1] && Math.hypot(f.x - boss.x, f.y - boss.y) >= boss.r + f.r - 0.5, 'géant endormi immobile : c\'est le monstre qui s\'écarte');
  // le dompteur ne le traverse pas : il bute contre lui en avançant
  [p.x, p.y] = [boss.x - boss.r - 60, boss.y];
  for (let i = 0; i < 40; i++) {
    p.lastPosMs = Date.now() - 50;
    r.onPos(p, p.x + 10, p.y, 1, 0);
  }
  check(p.x < boss.x - boss.r - 15 && p.x > boss.x - boss.r - 30, `le dompteur bute contre le géant endormi (bord à ${Math.round(boss.x - boss.r - p.x)} px)`);
  boss.dormant = false;
  r.onPos(p, p.x + 10, p.y, 1, 0);
  check(p.x > boss.x - boss.r - 15, 'réveillé, il ne bloque plus le passage');
}

{
  // Un Alpha tombé ne revient pas pendant un combat de géant : il attend la fin du combat.
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
}

{
  // Un archer qui recule en tirant se fait rattraper par les géants.
  const r = room();
  for (const c of r.map.caves) {
    const boss = r.units.get(r.caveBoss[c.id]);
    boss.moveCd = boss.moveCd.map(() => 99); // on mesure la poursuite, pas les attaques spéciales
    boss.dormant = false;
    const p = r.addPlayer('k', noop);
    p.cls = 'archer';
    p.hp = 99999;
    [p.x, p.y] = [c.inside.x - 200, c.inside.y];
    [boss.x, boss.y] = [p.x - 260, p.y]; // le géant derrière, l'archer fuit vers la droite
    let caught = -1;
    for (let i = 0; i < 20 * 6 && caught < 0; i++) {
      p.x = Math.min(p.x + 210 / 20, c.inside.x + 520); // il recule à pleine vitesse, en ligne droite
      p.hp = 99999;
      r.step();
      if (Math.hypot(boss.x - p.x, boss.y - p.y) < boss.r + p.r + 30) caught = i / 20;
    }
    check(caught >= 0, `${SPECIES[c.boss].name} rattrape un archer qui recule (${caught >= 0 ? caught.toFixed(1) + ' s' : 'jamais'})`);
    r.removePlayer(p.id);
  }
}

{
  // Classes : choix à la forge, premier gratuit, changement payant ; portée et PV selon la classe.
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
}

{
  // Bonus de collection : +5 % par Alpha éveillé, pour tous (3 Alphas = +15 %).
  const r = room();
  const p = r.addPlayer('a', noop);
  [p.x, p.y] = [r.map.den.x, r.map.den.y];
  for (const s of [0, 1, 2]) {
    p.essences[s] = ALPHA_CREATE_COST;
    r.onAlphaCreate(p, s);
  }
  r.onCheat(p);
  r.step();
  const wolf = p.army.map((id: number) => r.units.get(id)).find((u: { s: number }) => u.s === 1);
  check(p.army.length === 3 && wolf.maxHp === alphaStats(1, 0, 3).hp && wolf.maxHp === Math.round(SPECIES[1].hp * 2.5 * 1.15),
    `3 Alphas : +15 % chacun (Alpha Loup ${Math.round(SPECIES[1].hp * 2.5)} → ${wolf.maxHp} PV)`);
}

{
  // Camps : établis contre de l'or pour tout le village ; soins, réapparition, Pierre de passage.
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
  const mid = r.map.spineAt(8000);
  q.x = mid.x;
  q.y = mid.y;
  r.killPlayer(q);
  r.time = q.respawnAt + 1;
  r.updateRespawns();
  check(r.map.inVillage(q.x, q.y), 'mort avant le camp : réapparition au village');
  // un village rouvert retrouve ses camps
  const again: any = new Room('TEST2', r.seed, { camps: [0, 0, 7, -1], buildings: ['forge', 'forge', 'nope' as never], unlocked: [1, 1, 999] });
  check(again.camps.join() === '0', 'camps rechargés (doublons et index invalides ignorés)');
  check(again.buildings.join() === 'forge' && again.unlocked.join() === '1', 'bâtiments et grottes rechargés (doublons et valeurs invalides ignorés)');
}

{
  // Bâtiments du village : achetés avec de l'or, du bois et de la pierre, une fois pour tous ; sans eux, rien à faire devant le chantier.
  const r: any = new Room('TEST');
  let saved: { buildings: string[]; unlocked: number[] } = { buildings: [], unlocked: [] };
  r.onVillage = (v: typeof saved) => (saved = v);
  const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
  check(r.buildings.length === 0 && r.unlocked.length === 0, 'nouveau village : aucun bâtiment, grottes fermées');
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
  r.onBuild(p, 'forge');
  check(r.buildings.join() === 'forge' && p.gold === 490 && r.stock.wood === 0 && saved.buildings.join() === 'forge', 'forge construite une seule fois, 10 or et 5 bois, sauvegardée pour le village');
  [q.x, q.y] = [p.x, p.y];
  q.gold = 100;
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
}

{
  // Marché : vendre un monstre de sa meute, acheter une espèce déjà croisée.
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
}

{
  // Bond du Gluant Géant : il atterrit dans la zone annoncée, même si la cible s'en est écartée.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop);
  const king = SPECIES.findIndex((sp) => sp.key === 'slime_queen');
  const c = r.map.caves.find((cv: { boss: number }) => cv.boss === king);
  const b = r.units.get(r.spawnBoss(c.id));
  [p.x, p.y] = [c.inside.x - 200, c.inside.y + 40];
  p.hp = 1e6;
  r.castMove(b, { kind: 'leap', cd: 6 }, p);
  const h = r.hazards[0];
  const [zx, zy] = [h.x, h.y];
  [p.x, p.y] = [c.inside.x + 220, c.inside.y + 40]; // le dompteur sort de la zone rouge
  for (let i = 0; i < 25; i++) r.updateHazards(), (r.time += 0.05);
  check(Math.hypot(b.x - zx, b.y - zy) < 1 && Math.hypot(b.x - p.x, b.y - p.y) > 300, 'Gluant Géant : il saute dans la zone rouge, pas sur le dompteur qui l\'a quittée');
}

{
  // Tireurs : charge visible, projectile esquivable, tir en cloche annoncé, serpent qui reste dans l'eau.
  const S = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
  const setup = (key: string) => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    // un endroit dégagé du couloir : rien entre le tireur et le dompteur (un arbre arrêterait le tir)
    // (le tir part un peu au-dessus du tireur : on vérifie une bande, pas une ligne)
    const clear = (x0: number, y0: number) =>
      Array.from({ length: 23 }, (_, i) => i / 22).every((f) => [0, -12, -24].every((dy) => !r.map.blocked(x0 - 220 * f, y0 + dy)));
    let spot = r.map.freeNear(r.map.spineAt(12000).x, r.map.spineAt(12000).y);
    for (let s = 12000; s < 16000 && !clear(spot.x, spot.y); s += 150) spot = r.map.freeNear(r.map.spineAt(s).x, r.map.spineAt(s).y);
    p.x = spot.x;
    p.y = spot.y;
    p.hp = 1e6; // on mesure les dégâts sans mourir
    const at = r.map.freeNear(p.x - 220, p.y);
    const w = r.createUnit(S(key), false, at.x, at.y);
    w.homeX = w.x;
    w.homeY = w.y;
    return { r, p, w };
  };
  const run = (r: any, sec: number, each?: () => void) => {
    for (let i = 0; i < sec * 20; i++) {
      each?.();
      r.step();
    }
  };
  {
    const { r, p, w } = setup('watcher');
    const hp0 = p.hp;
    let charged = false;
    run(r, 3, () => (charged ||= w.windup > 0));
    check(charged && p.hp < hp0, `Guetteur runique : charge son tir puis touche un dompteur immobile (−${Math.round(hp0 - p.hp)} PV)`);
  }
  {
    const { r, p, w } = setup('toad');
    p.armor = 0;
    const hp0 = p.hp;
    // on attend que le crapaud tire, puis on s'écarte de la zone annoncée
    let dodged = false;
    run(r, 4, () => {
      const s = r.shots[0];
      if (s && !dodged) {
        const spot = r.map.freeNear(s.tx + 200 * Math.sign(p.x - w.x || 1), s.ty + 160);
        p.x = spot.x;
        p.y = spot.y;
        dodged = Math.hypot(p.x - s.tx, p.y - s.ty) > s.splash + p.r;
        w.atkCd = 99; // un seul tir
      }
    });
    check(dodged && p.hp === hp0, 'Crapaud-mortier : tir en cloche esquivé en sortant du cercle');
    const t = setup('toad');
    const h0 = t.p.hp;
    run(t.r, 4);
    check(t.p.hp < h0, `Crapaud-mortier : touche un dompteur qui ne bouge pas (−${Math.round(h0 - t.p.hp)} PV)`);
  }
  {
    const r = room();
    const snakes = [...r.units.values()].filter((u: { s: number }) => u.s === S('serpent'));
    run(r, 5);
    check(snakes.length > 0 && snakes.every((u: { x: number; y: number }) => r.map.isWater(u.x, u.y)), `Serpents des brumes : ${snakes.length} dans les lacs, aucun n'en sort`);
    const crabs = [...r.units.values()].filter((u: { s: number }) => u.s === S('crab'));
    // le point d'apparition (l'errance peut mordre de quelques pas sur la zone voisine)
    check(crabs.length > 0 && crabs.every((u: { homeX: number; homeY: number }) => r.map.zoneAt(u.homeX, u.homeY) === 5), `Crabes et Crapauds en zone 5 (${crabs.length} crabes)`);
  }
  {
    // un Guetteur apprivoisé tire pour sa meute
    const { r, p, w } = setup('watcher');
    w.owner = p.id;
    p.army.push(w.id);
    w.x = p.x + 30;
    w.y = p.y;
    const foe = r.createUnit(S('golem'), false, p.x + 200, p.y);
    foe.hp = foe.maxHp = 1e6;
    run(r, 4);
    check(foe.hp < 1e6, 'Guetteur apprivoisé : tire sur les sauvages pour sa meute');
  }
}

{
  // Géants des nouvelles espèces : salve en éventail et pluie de mortiers, esquivables.
  const S = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
  for (const [key, kind, n] of [['rune_eye', 0, 5], ['toad_king', 1, 5], ['mist_hydra', 2, 3]] as const) {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    p.hp = 1e6;
    const spot = r.map.freeNear(r.map.spineAt(9000).x, r.map.spineAt(9000).y);
    [p.x, p.y] = [spot.x, spot.y];
    const at = r.map.freeNear(p.x - 250, p.y);
    const b = r.createUnit(S(key), false, at.x, at.y);
    b.moveCd = b.moveCd.map((_: number, i: number) => (i === 0 ? 0 : 99)); // la première attaque spéciale, tout de suite
    // comptés au lancement : un tir qui part dans un arbre disparaît dès le premier tick
    const shots: { kind: number }[] = [];
    const launch = r.launch.bind(r);
    r.launch = (u: { id: number }, k: string, ...rest: unknown[]) => {
      if (u.id === b.id) shots.push({ kind: SHOT_KINDS.indexOf(k as never) });
      return launch(u, k, ...rest);
    };
    r.step();
    check(shots.length === n && shots.every((x) => x.kind === kind), `${SPECIES[S(key)].name} : ${n} projectiles d'un coup (${['salve de traits', 'pluie de mortiers', 'salve de jets'][kind]})`);
  }
}

{
  // Bestiaire : une espèce croisée y entre (pas les géants), et c'est sauvegardé.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop, { userId: 'u', profile: null });
  p.hp = 1e6; // le géant frappe fort : on reste en vie pendant le test
  const toad = SPECIES.findIndex((sp) => sp.key === 'toad'), king = SPECIES.findIndex((sp) => sp.key === 'toad_king');
  r.createUnit(toad, false, p.x + 200, p.y);
  r.createUnit(king, false, p.x - 200, p.y);
  for (let i = 0; i < 25; i++) r.step();
  const prof = r.profileOf(p);
  check(p.seen.has(toad) && !p.seen.has(king) && prof.seen.includes(toad), 'bestiaire : espèce croisée enregistrée, géant exclu');
  const back = r.addPlayer('b', noop, { userId: 'v', profile: { ...prof, seen: [], essences: SPECIES.map((_, i) => (i === 3 ? 2 : 0)) } });
  check(back.seen.has(3), 'bestiaire : les espèces déjà chassées (essences) y figurent pour une ancienne sauvegarde');
}

{
  // Alpha tombé pendant que son dompteur est à terre : il attend que le dompteur soit debout.
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
}

{
  // Relever un coéquipier : R maintenu 5 s près du corps, dans les 10 s.
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
}

{
  // Courbe des monstres : chaque zone nettement plus dure que la précédente.
  const main = SPECIES.slice(0, 4); // espèce principale de chaque zone
  const ok = main.every((s, i) => i === 0 || (s.hp >= main[i - 1].hp * 2.4 && s.dmg >= main[i - 1].dmg * 1.75));
  check(ok, `progression des monstres : ${main.map((s) => `${s.hp}/${s.dmg}`).join(' → ')}`);
}

{
  // Géant endormi : ni cible ni menace tant qu'on ne lui a pas parlé ; il se rendort quand la grotte se vide.
  const r = room();
  const c = r.map.caves[0];
  const boss = r.units.get(r.caveBoss[c.id]);
  const p = r.addPlayer('a', noop);
  [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
  p.hp = 9999;
  for (let i = 0; i < 20 * 3; i++) r.step();
  check(boss.dormant && boss.hp === boss.maxHp && p.hp === 9999, 'géant endormi : on ne le frappe pas, il ne frappe pas');
  [p.x, p.y] = [c.entrance.x, c.entrance.y + 70];
  r.onChallenge(p, c.id);
  check(boss.dormant, 'hors de sa grotte : impossible de le provoquer');
  [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
  r.onChallenge(p, c.id);
  check(!boss.dormant, 'on lui parle : il se réveille');
  for (let i = 0; i < 20 * 3; i++) r.step();
  check(boss.hp < boss.maxHp && p.hp < 9999, 'puis le combat s\'engage');
  [p.x, p.y] = [c.entrance.x, c.entrance.y + 70];
  r.tick = 0;
  r.clearEmptyCaves();
  check(boss.dormant && boss.hp === boss.maxHp && boss.x === boss.homeX, 'grotte vide : il se rendort, guéri, à sa place');
}

{
  // Coffre du géant vaincu : chaque dompteur l'ouvre une fois, pour un montant d'or aléatoire.
  const r = room();
  const c = r.map.caves[0];
  const boss = r.units.get(r.caveBoss[c.id]);
  const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
  [p.x, p.y] = [boss.x + boss.r + 20, boss.y];
  [q.x, q.y] = [boss.x - boss.r - 20, boss.y];
  const g0 = p.gold;
  const bystander = r.addPlayer('c', noop);
  r.damage(boss, 1, q); // q frappe un peu, le reste vient de p ; bystander ne fait rien
  r.damage(boss, boss.hp, p);
  const ch = r.chests[0];
  check(r.chests.length === 1 && p.gold === g0, 'géant vaincu : un coffre, et pas d\'or direct');
  [p.x, p.y] = [ch.x + 30, ch.y];
  r.onChest(p, ch.id);
  const gold = p.gold - g0, base = SPECIES[c.boss].gold;
  check(gold >= Math.round(base * CHEST_GOLD[0]) && gold <= Math.round(base * CHEST_GOLD[1]), `coffre ouvert : +${gold} or (entre ${Math.round(base * CHEST_GOLD[0])} et ${Math.round(base * CHEST_GOLD[1])})`);
  r.onChest(p, ch.id);
  check(p.gold === g0 + gold, 'une seule fois par dompteur');
  [q.x, q.y] = [ch.x + 400, ch.y];
  r.onChest(q, ch.id);
  check(q.gold === 0, 'trop loin du coffre : rien');
  [q.x, q.y] = [ch.x, ch.y + 30];
  r.onChest(q, ch.id);
  check(q.gold > 0, 'chaque coéquipier a sa part');
  [bystander.x, bystander.y] = [ch.x, ch.y + 30];
  r.onChest(bystander, ch.id);
  check(bystander.gold === 0, 'qui n\'a pas combattu n\'a pas de coffre');
  r.time = r.caveBack[c.id] + 1;
  r.tick = 0;
  r.updateSpawns();
  check(r.chests.length === 0 && r.caveBoss[c.id] > 0, 'le géant revient, le coffre disparaît');
}

{
  // Gibier passif : il n'attaque jamais, mange aux buissons à fruits et fuit qui le frappe.
  const r = room();
  const s = SPECIES.findIndex((sp) => sp.passive);
  // un buisson dans un coin dégagé (le lièvre doit pouvoir y aller puis s'enfuir)
  const open = (x: number, y: number) => [0, 1, 2, 3, 4, 5, 6, 7].every((k) => !r.map.blocked(x + Math.cos(k) * 160, y + Math.sin(k) * 160)) && !r.map.blocked(x, y);
  const bush = r.map.bushes.find((b: { x: number; y: number }) => open(b.x + 120, b.y) && r.map.clearLine(b.x + 120, b.y, b.x, b.y + 14))!;
  check(r.map.bushes.length > 40, `${r.map.bushes.length} buissons à fruits sur la carte`);
  for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // seuls le lièvre et le dompteur
  const hare = r.createUnit(s, false, bush.x + 120, bush.y);
  const p = r.addPlayer('a', noop);
  [p.x, p.y] = [hare.x + 40, hare.y];
  p.hp = 999;
  p.atkCd = 999; // il ne frappe pas : on observe le lièvre
  let ate = false;
  for (let i = 0; i < 20 * 15 && !ate; i++) {
    r.step();
    p.atkCd = 999;
    ate = r.bushBack[bush.id] > r.time;
  }
  check(p.hp === 999, `${SPECIES[s].name} : jamais d'attaque, même collé au dompteur`);
  check(ate, 'il va manger les fruits du buisson voisin');
  r.time += BUSH_REGROW_S + 1;
  check(r.bushBack[bush.id] <= r.time, 'les fruits repoussent');
  [hare.x, hare.y] = [p.x + 30, p.y];
  r.damage(hare, 1, p);
  const d0 = Math.hypot(hare.x - p.x, hare.y - p.y);
  for (let i = 0; i < 20; i++) r.step(), (p.atkCd = 999);
  check(Math.hypot(hare.x - p.x, hare.y - p.y) > d0 + 60, 'frappé, il s\'enfuit');
}

{
  // Récolte : bois mort → bois, rocher → pierre, filon → or et un peu de pierre ; sauvegardés sur le compte.
  const r = room();
  r.units.clear();
  const p = r.addPlayer('a', noop);
  for (const res of ['wood', 'stone', 'gold'] as const) {
    const o = r.map.ores.find((x: { res: string }) => x.res === res);
    [p.x, p.y] = [o.x + 30, o.y];
    const [w0, s0, g0] = [p.wood, p.stone, p.gold];
    for (let i = 0; i < 20 * 20 && r.oreHp[o.id] > 0; i++) {
      for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // pas de monstre pour l'interrompre
      r.step();
    }
    const got = { wood: p.wood - w0, stone: p.stone - s0, gold: p.gold - g0 };
    const want = res === 'wood' ? { wood: resYield(o.zone), stone: 0, gold: 0 } : res === 'stone' ? { wood: 0, stone: resYield(o.zone), gold: 0 } : { wood: 0, stone: oreStone(o.zone), gold: got.gold };
    check(JSON.stringify(got) === JSON.stringify(want) && (res !== 'gold' || got.gold > 0), `${res} (zone ${o.zone}) : +${got.wood} bois, +${got.stone} pierre, +${got.gold} or`);
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
}

{
  // Hôtel de ville : chaque niveau coûte or, bois et pierre ; elle ouvre les portes avec les géants vaincus.
  const r: any = new Room('TEST');
  let saved: { hall: number; beaten: number[] } = { hall: 0, beaten: [] };
  r.onVillage = (v: typeof saved) => (saved = v);
  const p = r.addPlayer('a', noop);
  const { map } = r;
  // Porte du village (0) : fermée tant que l'Hôtel de ville est au niveau 0.
  const before = map.spineAt(map.gates[0] - 60), after = map.spineAt(map.gates[0] + 60);
  const walk = (from: { x: number; y: number }, to: { x: number; y: number }, gate = 0) => {
    [p.x, p.y] = [from.x, from.y];
    for (let i = 0; i < 40; i++) {
      p.lastPosMs = Date.now() - 50;
      r.onPos(p, p.x + (to.x - from.x) / 20, p.y + (to.y - from.y) / 20, 1, 0);
    }
    return map.arcAt(p.x, p.y) > map.gates[gate];
  };
  check(!walk(before, after), 'Hôtel de ville niv. 0 : la porte du village ne se franchit pas');
  [p.x, p.y] = [map.hall.x, map.hall.y + 60];
  p.gold = HALL[0].gold;
  Object.assign(r.stock, { wood: HALL[0].wood, stone: HALL[0].stone - 1 });
  r.onHall(p);
  check(r.hall === 0, 'pas assez de pierre : pas d\'amélioration');
  r.stock.stone++;
  r.onHall(p);
  check(r.hall === 1 && p.gold === 0 && r.stock.wood === 0 && r.stock.stone === 0 && saved.hall === 1, `niveau 1 pour ${HALL[0].gold} or, ${HALL[0].wood} bois, ${HALL[0].stone} pierre, sauvegardé`);
  check(walk(before, after), 'niveau 1 : la porte du village s\'ouvre');
  // Porte de la zone 2 : Hôtel de ville niv. 3 et tous les géants de la zone 1.
  const b1 = map.spineAt(map.gates[1] - 60), a1 = map.spineAt(map.gates[1] + 60);
  r.hall = gateHall(1);
  check(!walk(b1, a1, 1), 'géants de la zone 1 pas encore vaincus : porte de la zone 2 fermée');
  const [g1, g2] = zoneBosses(1);
  for (const g of [g1, g2]) {
    const u = r.createUnit(g, false, p.x, p.y);
    r.killUnit(u, p);
  }
  check(saved.beaten.includes(g1) && saved.beaten.includes(g2), 'géants vaincus retenus pour le village');
  r.hall = gateHall(1) - 1;
  check(!walk(b1, a1, 1), `géants vaincus mais Hôtel de ville niv. ${gateHall(1) - 1} : toujours fermée`);
  r.hall = gateHall(1);
  check(walk(b1, a1, 1), `géants vaincus et Hôtel de ville niv. ${gateHall(1)} : porte de la zone 2 ouverte`);
  // On peut toujours revenir en arrière, même par une porte fermée.
  r.hall = 0;
  [p.x, p.y] = [a1.x, a1.y];
  for (let i = 0; i < 40; i++) {
    p.lastPosMs = Date.now() - 50;
    r.onPos(p, p.x + (b1.x - a1.x) / 20, p.y + (b1.y - a1.y) / 20, 1, 0);
  }
  check(map.arcAt(p.x, p.y) < map.gates[1], 'revenir en arrière par une porte fermée : toujours possible');
  const again: any = new Room('TEST2', r.seed, { hall: 99, beaten: [g1, g1, 0, 999] });
  check(again.hall === HALL_MAX && again.beaten.join() === String(g1), 'Hôtel de ville et géants rechargés (bornés, doublons et non-géants ignorés)');
}

{
  // Lucioles : gibier passif de la zone 2 qui n'apparaît que la nuit, et s'en va au lever du jour (loin des dompteurs).
  const r = room();
  const fly = SPECIES.findIndex((sp) => sp.key === 'firefly');
  check(fly === SPECIES.findIndex((sp) => sp.key === 'snail') + 1 && SPECIES[fly].zone === 2 && !!SPECIES[fly].passive && !!SPECIES[fly].night, 'luciole : passive, zone 2, de nuit, ajoutée en fin de liste (sauvegardes intactes)');
  const realNow = Date.now, t0 = realNow();
  let night = t0, day = t0;
  for (let t = t0; t < t0 + DAY_MS; t += 10_000) {
    const k = sky(r.seed, t).light;
    if (k === 0) night = t;
    if (k === 1) day = t;
  }
  Date.now = () => night;
  r.tick = 0;
  for (let i = 0; i < 30; i++) r.updateSpawns(), (r.time += 3);
  const flies = () => [...r.units.values()].filter((u: any) => u.s === fly && !u.owner).length;
  check(flies() > 0 && [...r.units.values()].every((u: any) => u.s !== fly || r.map.zoneAt(u.x, u.y) === 2), `la nuit, des lucioles apparaissent en zone 2 (${flies()})`);
  Date.now = () => day;
  r.updateSpawns();
  check(flies() === 0, 'au lever du jour, les lucioles sauvages s\'en vont');

  // Sangliers sauvages : ils dorment la nuit (même un dompteur collé à eux), un coup les réveille.
  Date.now = () => night;
  r.tick = 0;
  r.updateSpawns();
  const boar = [...r.units.values()].find((u: any) => SPECIES[u.s].key === 'boar' && !u.owner);
  const p = r.addPlayer('nuit', noop);
  [p.x, p.y] = [boar.x + 30, boar.y];
  r.time += 30;
  r.wildAI(boar);
  check(boar.asleep && boar.target === 0, 'la nuit, le sanglier sauvage dort et ignore le dompteur à côté');
  r.damage(boar, 1, p, true);
  r.wildAI(boar);
  check(!boar.asleep && boar.target === p.id, 'frappé, il se réveille et s\'en prend au dompteur');
  Date.now = () => day;
  r.tick = 0;
  r.updateSpawns();
  r.time += 60;
  r.wildAI(boar);
  check(!boar.asleep, 'le jour, il est réveillé');
  Date.now = realNow;
}

{
  // Ordre des espèces figé : leur index sert dans les sauvegardes (essences, Alphas). On n'ajoute qu'à la fin.
  const order = 'slime wolf boar golem sporelin spider bear wisp slime_queen shadow_fang old_tusk moss_heart spore_giant weaver colossus old_flame watcher toad serpent crab rune_eye toad_king mist_hydra titan_crab hare snail firefly meerkat sandworm vulture jackal sand_queen vulture_king moon_jackal';
  check(SPECIES.map((sp) => sp.key).join(' ') === order, `ordre des ${SPECIES.length} espèces inchangé (sauvegardes intactes)`);
}

{
  // Mer de sable (zone 6) : porte après les Lacs brumeux, Hôtel de ville niveau 6 et géants de la zone 5 vaincus.
  const z5 = zoneBosses(5), z6 = zoneBosses(6);
  check(gateHall(5) === 6 && HALL_MAX >= 6 && !gateOpen(5, 6, []) && gateOpen(5, 6, z5) && !gateOpen(5, 5, z5) && z6.length === 3,
    `porte de la Mer de sable : Hôtel de ville niv. 6 et les ${z5.length} géants des Lacs ; ${z6.length} géants dans le désert`);

  const r = room();
  for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
  const p = r.addPlayer('dune', noop);
  const key = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
  // Ver des sables : sous le sable, intouchable ; arrivé sous sa cible, sortie annoncée, puis exposé et frappable.
  const spot = r.map.freeNear(r.map.spineAt(27500).x, r.map.spineAt(27500).y);
  [p.x, p.y] = [spot.x, spot.y];
  const worm = r.createUnit(key('sandworm'), false, p.x + 60, p.y);
  const regrid = () => {
    r.grid.clear();
    for (const e of [p, ...r.units.values()]) r.grid.insert(e);
  };
  regrid();
  r.wildAI(worm);
  r.wildAI(worm);
  const hp0 = worm.hp;
  r.damage(worm, 500, p, true);
  check(worm.hidden && worm.hp === hp0 && !r.isWild(worm), 'ver sous le sable : ni cible ni touché');
  check(worm.emerging && r.hazards.some((h: any) => h.boss === worm), 'arrivé sous sa cible : sa sortie est annoncée au sol');
  r.time += 1;
  r.updateHazards();
  check(!worm.hidden && r.isWild(worm), 'le ver jaillit : il est exposé, on peut le frapper');
  r.damage(worm, 500, p, true);
  check(worm.hp < hp0, `ver exposé touché (${hp0} → ${Math.round(worm.hp)} PV)`);
  r.time += 5;
  r.wildAI(worm);
  check(worm.hidden, 'quelques secondes plus tard, il replonge');
  r.units.delete(worm.id);
  r.hazards.length = 0;
  Object.assign(p, { dead: false, hp: 9999 }); // le ver a pu l'abattre : on le remet debout pour la suite
  // Suricates : ils vivent autour de leur tanière ; un dompteur sans fruit approche, et la colonie court s'y cacher.
  check(r.map.dens.length >= 4 && r.map.dens.every((d: { x: number; y: number }) => r.map.zoneAt(d.x, d.y) === 6), `${r.map.dens.length} tanières de suricates dans la Mer de sable`);
  const den = r.map.dens[0];
  const cats = [0, 1, 2].map((k) => r.createUnit(key('meerkat'), false, den.x + 40 + k * 20, den.y + 20));
  [p.x, p.y] = [den.x + 200, den.y];
  for (let i = 0; i < 60 && !cats.every((c: any) => c.hidden); i++) for (const c of cats) r.wildAI(c);
  check(cats.every((c: any) => c.hidden && !r.isFeedable(c) && Math.hypot(c.x - den.x, c.y - den.y) < 30), 'un dompteur sans fruit approche : la colonie court se cacher dans sa tanière');
  r.time += 10;
  p.fruits = 5;
  r.onHold(p, true);
  for (const c of cats) r.wildAI(c);
  check(cats.every((c: any) => !c.hidden), 'fruit en main, ils ressortent et se laissent approcher');
  // Vautour : il plane hors d'atteinte, pique là où tombe son ombre (annoncé), puis reste posé, frappable.
  const v = r.createUnit(key('vulture'), false, p.x + 120, p.y);
  regrid();
  r.wildAI(v);
  const vh = v.hp;
  r.damage(v, 500, p, true);
  check(v.hidden && v.hp === vh && !r.isWild(v), 'vautour en vol : hors d\'atteinte');
  for (const c of cats) r.wildAI(c);
  check(cats.every((c: any) => c.hidden || Math.hypot(c.x - den.x, c.y - den.y) < 60), 'un vautour approche : les suricates filent à la tanière (même fruit en main)');
  r.time += 3.1;
  regrid();
  r.wildAI(v);
  check(v.emerging && r.hazards.some((h: any) => h.boss === v), 'il pique : un cercle au sol annonce où il fond');
  r.time += 1.1;
  r.updateHazards();
  r.damage(v, 500, p, true);
  check(!v.hidden && v.hp < vh, `posé, on peut le frapper (${vh} → ${Math.round(v.hp)} PV)`);
  r.time += 3.5;
  r.wildAI(v);
  check(v.hidden, 'puis il redécolle');
}

{
  // Tempête de sable : elle blesse dehors dans la Mer de sable ; vers sous le sable, vautours très haut, suricates cachés.
  const r = room();
  for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
  const realNow = Date.now, t0 = realNow();
  let storm = 0;
  for (let t = t0; t < t0 + 6 * 3600_000 && !storm; t += 20_000) if (sky(r.seed, t).storm > 0.9) storm = t;
  check(storm > 0, 'des tempêtes de sable se lèvent de temps en temps');
  Date.now = () => storm;
  r.tick = 0;
  r.updateSpawns();
  const key = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
  const p = r.addPlayer('tempete', noop);
  const q = r.map.freeNear(r.map.spineAt(27500).x, r.map.spineAt(27500).y);
  [p.x, p.y] = [q.x, q.y];
  p.hp = p.maxHp = 1000;
  r.tick = 0;
  r.stormDamage();
  check(p.hp < 1000, `dehors dans la Mer de sable, la tempête blesse (${1000 - p.hp} PV en 1 s)`);
  const v = r.map.village;
  [p.x, p.y, p.hp] = [v.x, v.y, 1000];
  r.stormDamage();
  check(p.hp === 1000, 'au village, rien');
  [p.x, p.y] = [q.x, q.y];
  const worm = r.createUnit(key('sandworm'), false, p.x + 60, p.y), vul = r.createUnit(key('vulture'), false, p.x + 90, p.y);
  const cat = r.createUnit(key('meerkat'), false, r.map.dens[0].x + 30, r.map.dens[0].y);
  r.grid.clear();
  for (const e of [p, ...r.units.values()]) r.grid.insert(e);
  for (let i = 0; i < 40; i++) {
    r.wildAI(worm), r.wildAI(vul), r.wildAI(cat);
    r.time += 0.25;
  }
  check(worm.hidden && !worm.emerging && vul.hidden && !vul.emerging && !r.hazards.length, 'en pleine tempête, le ver reste sous le sable et le vautour très haut : aucun ne frappe');
  check(cat.hidden, 'les suricates se cachent dans leur tanière');
  Date.now = realNow;

  // Alpha suricate : il encourage son dompteur (+8 % de dégâts, plus en le renforçant), comme l'escargot le protège.
  const r2 = room();
  const p2 = r2.addPlayer('chef', noop);
  check(r2.rallyOf(p2) === 0, 'sans Alpha suricate : pas de bonus');
  r2.spawnAlpha(p2, key('meerkat'), 2, false);
  check(Math.abs(r2.rallyOf(p2) - 0.1) < 1e-9, `Alpha suricate niv. 2 : +${Math.round(r2.rallyOf(p2) * 100)} % de dégâts pour son dompteur`);

  // Vautour : il se chevauche et vole, par-dessus l'eau ; on se pose sur la terre ferme.
  const r3 = room();
  const p3 = r3.addPlayer('ciel', noop);
  let wx = 0, wy = 0;
  for (let i = 0; i < 4000 && !wx; i++) {
    const s = r3.map.spineAt(Math.random() * r3.map.length), x = s.x + (Math.random() - 0.5) * 600, y = s.y + (Math.random() - 0.5) * 600;
    if (r3.map.isWater(x, y) && r3.map.isWater(x + 40, y) && !r3.map.inVillage(x, y, 300)) [wx, wy] = [x, y];
  }
  const shore = r3.map.landNear(wx, wy, 600);
  [p3.x, p3.y] = [shore.x, shore.y];
  const bird = r3.spawnAlpha(p3, key('vulture'), 0, false);
  [bird.x, bird.y] = [p3.x + 20, p3.y];
  r3.onMount(p3, bird.id);
  check(p3.mount === bird.id && mountSpeedOf(key('vulture')) > 1, `à dos de vautour (vitesse ×${mountSpeedOf(key('vulture'))})`);
  for (let i = 0; i < 40; i++) {
    p3.lastPosMs = Date.now() - 400;
    const d = Math.hypot(wx - p3.x, wy - p3.y), k = Math.min(1, 60 / (d || 1));
    r3.onPos(p3, p3.x + (wx - p3.x) * k, p3.y + (wy - p3.y) * k, 1, 0);
  }
  check(r3.map.isWater(p3.x, p3.y), 'il survole l\'eau');
  r3.onMount(p3, 0);
  check(!p3.mount && !r3.map.blocked(p3.x, p3.y), 'en descendant au-dessus de l\'eau, on se pose sur la terre ferme');
}

{
  // Baies : cueillies aux buissons ; fruit tendu, le gibier passif s'approche et chaque fruit peut l'apprivoiser.
  const r = room();
  for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
  const snail = SPECIES.findIndex((sp) => sp.key === 'snail'), hare = SPECIES.findIndex((sp) => sp.key === 'hare');
  check(SPECIES[snail].zone === 1 && !!SPECIES[snail].passive && SPECIES[hare].zone === 3 && SPECIES[hare].zone === SPECIES[2].zone, 'escargot passif en zone 1, lièvre dans la zone des sangliers et des ours');
  const p = r.addPlayer('a', noop);
  const bush = r.map.bushes[3];
  [p.x, p.y] = [bush.x + 30, bush.y];
  r.onPick(p);
  check(p.fruits === BERRIES_PICKED && r.bushBack[bush.id] > r.time, `${BERRIES_PICKED} baies cueillies, le buisson est vide`);
  r.onPick(p);
  check(p.fruits === BERRIES_PICKED, 'buisson vide : rien de plus');
  // Fruit tendu : l'escargot vient vers le dompteur.
  p.fruits = 40;
  // à 250 px, en vue directe du dompteur (pas derrière un rocher ou un arbre)
  const spot = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ x: p.x + Math.cos(k * Math.PI / 4) * 250, y: p.y + Math.sin(k * Math.PI / 4) * 250 }))
    .find((q) => !r.map.blocked(q.x, q.y) && r.map.clearLine(q.x, q.y, p.x, p.y)) ?? { x: p.x + 250, y: p.y };
  const u = r.createUnit(snail, false, spot.x, spot.y);
  const d0 = Math.hypot(u.x - p.x, u.y - p.y);
  r.onHold(p, true);
  let fed = 0, tamedAt = -1;
  for (let i = 0; i < 20 * 60 && tamedAt < 0; i++) {
    const f0 = p.fruits;
    for (const w of [...r.units.values()]) if (!w.owner && w !== u) r.units.delete(w.id); // seuls l'escargot et le dompteur
    r.step();
    if (p.fruits < f0) fed++;
    if (u.owner === p.id) tamedAt = fed;
  }
  check(d0 > 150 && tamedAt > 0, `fruit tendu : l'escargot approche et s'apprivoise (${tamedAt} fruit${tamedAt > 1 ? 's' : ''})`);
  check(p.army.includes(u.id), 'il rejoint la meute');
  // Chances : bien meilleures pour le gibier que pour un monstre hostile.
  check(fruitTameChance(snail) >= 5 * fruitTameChance(0), `chance par fruit : ${Math.round(fruitTameChance(snail) * 100)} % (gibier) contre ${Math.round(fruitTameChance(0) * 100)} % (hostile)`);
  let wild = 0, n = 0;
  p.fruits = 400;
  p.army = [];
  for (let i = 0; i < 300; i++) {
    const w = r.createUnit(0, false, p.x + 20, p.y);
    p.atkCd = 0;
    r.grid.clear();
    r.grid.insert(w);
    r.feed(p);
    if (w.owner) wild++;
    n++;
    r.units.delete(w.id);
    p.army = [];
  }
  check(wild > 0 && wild / n < 0.12, `Gluant hostile nourri : ${wild} apprivoisés sur ${n} fruits`);
  // Un gibier passif nourri sans être apprivoisé laisse parfois une essence de son espèce.
  const ess0 = p.essences[snail];
  for (let i = 0; i < 120; i++) {
    const w = r.createUnit(snail, false, p.x + 20, p.y);
    p.atkCd = 0;
    p.army = [];
    r.grid.clear();
    r.grid.insert(w);
    r.feed(p);
    r.units.delete(w.id);
  }
  check(p.essences[snail] > ess0, `escargots nourris : ${p.essences[snail] - ess0} essences d'Escargot obtenues`);
  p.holding = true;
  p.fruits = 0;
  p.atkCd = 0;
  r.feed(p);
  check(!p.holding, 'plus de fruit : la main se vide');
  // Personne n'attaque le gibier passif (ni le dompteur, ni sa meute) : il ne s'apprivoise qu'aux fruits.
  for (const w of [...r.units.values()]) if (!w.owner) r.units.delete(w.id);
  p.army = [];
  const wolf = r.createUnit(1, false, p.x, p.y);
  r.makeTamed(wolf, p);
  const prey = r.createUnit(snail, false, p.x + 25, p.y);
  for (let i = 0; i < 20 * 4; i++) r.step();
  check(prey.hp === prey.maxHp && !prey.owner, 'escargot à côté : ni le dompteur ni sa meute ne l\'attaquent');
  for (let i = 0; i < 50; i++) {
    const q = r.createUnit(snail, false, p.x + 20, p.y);
    r.killUnit(q, p);
  }
  check(!p.army.some((id: number) => r.units.get(id)?.s === snail), 'un gibier vaincu ne s\'apprivoise jamais');
  // L'Alpha escargot se monte, mais ralentit son cavalier.
  const ride = r.spawnAlpha(p, snail, 0, false);
  r.onMount(p, ride.id);
  check(p.mount === ride.id && mountSpeedOf(snail) < 1, `à dos d'Alpha escargot : vitesse ×${mountSpeedOf(snail)}`);
}

{
  // Mort : une part de l'or est perdue ; mage : dégâts dégressifs loin du point d'impact ; meute en promenade au village.
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
}

{
  // Alpha légendaire : il lance seul l'attaque spéciale de son géant, qui ne touche que les sauvages.
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
}

{
  // Attaque au clic (PC) : rien sans ordre, puis on frappe le monstre visé.
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
}

{
  // Expulsion : le fondateur bannit un compte (sa progression reste), puis peut le réintégrer.
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
}

{
  // Déconnecté : il dort au village, sa meute flâne autour (un monstre sur trois dort) ; il se réveille en revenant.
  const r = room();
  let snap: { sleepers: unknown[]; dozers: number[][] } = { sleepers: [], dozers: [] };
  const watcher = r.addPlayer('w', (m: { t: string; sleepers?: unknown[]; dozers?: number[][] }) => m.t === 's' && (snap = m as typeof snap));
  [watcher.x, watcher.y] = [r.map.village.x, r.map.village.y];
  const p = r.addPlayer('Lou', noop, { userId: 'lou', profile: null });
  r.spawnAlpha(p, 1, 2, false);
  for (let i = 0; i < 4; i++) {
    const u = r.createUnit(0, false, p.x, p.y);
    r.makeTamed(u, p);
  }
  r.removePlayer(p.id);
  r.step();
  check(snap.sleepers.length === 1 && snap.dozers.length === 5, `Lou déconnecté : endormi au village avec ses ${snap.dozers.length} monstres`);
  const awake = snap.dozers.filter((d) => !(d[2] & 8)), asleep = snap.dozers.length - awake.length;
  const before = awake.map((d) => [d[3], d[4]]);
  for (let i = 0; i < 20 * 8; i++) r.step();
  const moved = snap.dozers.filter((d) => !(d[2] & 8)).filter((d, i) => Math.hypot(d[3] - before[i][0], d[4] - before[i][1]) > 20).length;
  check(asleep >= 1 && moved >= 1 && snap.dozers.every((d) => r.map.inVillage(d[3], d[4])), `${asleep} dorment, ${moved} se promènent dans le village`);
  r.addPlayer('Lou', noop, { userId: 'lou', profile: null });
  r.step();
  check(snap.sleepers.length === 0 && snap.dozers.length === 0, 'Lou revient : il n\'est plus endormi au village');
}

{
  // Champignon légendaire : un seul nuage de spores, sur sa cible (pas un par monstre autour).
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
}

{
  // Chat : une ligne nettoyée, 200 caractères au plus, pas de rafale.
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
}

{
  // Brume : rien n'apparaît au-delà de la première porte fermée, ni d'espèce d'une zone encore fermée.
  const r: any = new Room('TEST', undefined, { hall: 2 }); // porte du village ouverte, Bois profonds fermés (géants invaincus)
  const fog = r.map.gates[1];
  const wild = [...r.units.values()].filter((u: { owner: number; s: number }) => !u.owner && !SPECIES[u.s].boss);
  check(wild.length > 50 && wild.every((u: { x: number; y: number; s: number }) => r.map.arcAt(u.x, u.y) < fog && SPECIES[u.s].zone === 1),
    `zone 2 sous la brume : ${wild.length} monstres, tous de la zone 1 et en deçà de la brume`);
}

{
  // Tableau du village : géants battus, apprivoisements, dons ; enregistrés et visibles pour les déconnectés.
  const r = room();
  for (const u of [...r.units.values()]) if (!u.owner && !SPECIES[u.s].boss) r.units.delete(u.id);
  let board: { name: string; online: boolean; bosses: number; tamed: number; given: number }[] = [];
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
  r.onBoard(p);
  const lou = board.find((b) => b.name === 'Lou'), max = board.find((b) => b.name === 'Max');
  check(lou?.bosses === 1 && max?.bosses === 1 && lou.tamed === 1 && lou.given === 12, `tableau : Lou ${lou?.bosses} géant, ${lou?.tamed} apprivoisé, ${lou?.given} donnés ; Max ${max?.bosses} géant`);
  const prof = r.profileOf(p);
  r.removePlayer(p.id);
  q.send = (m: { t: string; rows?: typeof board }) => m.t === 'board' && (board = m.rows!);
  r.onBoard(q);
  check(prof.stats?.given === 12 && board.some((b) => b.name === 'Lou' && !b.online && b.given === 12), 'statistiques enregistrées ; Lou déconnecté reste au tableau');
}

{
  // Envoi différentiel : l'état reconstitué par le client correspond à l'état complet (à 2 px près).
  const r = room();
  let full: { units: number[][]; players: { id: number; gold: number; essences: number[] }[] } = { units: [], players: [] };
  const state = new SnapshotState();
  const p = r.addPlayer('a', (m: { t: string }) => m.t === 's' && (full = state.apply(m as never) as never));
  let raw: { units: number[][]; players: Record<string, unknown>[] } = { units: [], players: [] };
  r.addPlayer('b', (m: { t: string }) => m.t === 's' && (raw = m as never));
  const c = r.map.spineAt(2600);
  [p.x, p.y] = [c.x, c.y];
  p.hp = 1e9;
  let ok = true;
  for (let i = 0; i < 100; i++) {
    r.step();
    p.hp = 1e9;
    const truth = [...r.units.values()].filter((u: { x: number; y: number; reviveAt: number }) => !u.reviveAt && Math.hypot(u.x - p.x, u.y - p.y) <= 1250);
    const byId = new Map(full.units.map((u) => [u[0], u]));
    if (truth.length !== full.units.length || truth.some((u: { id: number; x: number; y: number }) => !byId.has(u.id) || Math.abs(byId.get(u.id)![3] - u.x) > 2.5 || Math.abs(byId.get(u.id)![4] - u.y) > 2.5)) ok = false;
  }
  p.gold = 1234;
  r.step();
  check(ok && full.players.find((x) => x.id === p.id)?.gold === 1234 && full.players.find((x) => x.id === p.id)!.essences.length === SPECIES.length,
    `état reconstitué fidèle (${full.units.length} unités, or et essences du dompteur à jour)`);
  check(Object.keys(raw.players.find((x) => x.id !== undefined && Object.keys(x).length < 6) ?? { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }).length < 6, 'un dompteur dont rien n\'a changé ne coûte presque rien (seulement son id et ses changements)');
}

{
  // PV des géants : multipliés par le nombre de dompteurs en ligne, en gardant leur part de PV.
  const r = room();
  const boss = r.units.get(r.caveBoss[0]);
  const base = SPECIES[boss.s].hp;
  const p = r.addPlayer('a', noop);
  check(boss.maxHp === base && boss.hp === base, `un dompteur : ${SPECIES[boss.s].name} à ${base} PV`);
  r.damage(boss, base / 2, p);
  r.addPlayer('b', noop);
  check(boss.maxHp === base * 2 && Math.abs(boss.hp - base) < 1e-6, `deux dompteurs : PV doublés (${boss.hp}/${boss.maxHp}), toujours à moitié`);
  const q = r.addPlayer('c', noop);
  r.removePlayer(q.id);
  check(boss.maxHp === base * 2, 'un dompteur s\'en va : on revient au total pour deux');
}

{
  // Alpha escargot : il protège son dompteur ; Alpha lièvre : il le soigne un peu, et sa meute proche.
  const r = room();
  const p = r.addPlayer('a', noop);
  p.x = r.map.spawn.x;
  p.y = r.map.spawn.y;
  const foe = r.createUnit(0, false, p.x + 400, p.y);
  p.hp = 1000;
  r.damage(p, 100, foe);
  const bare = 1000 - p.hp;
  const snailS = SPECIES.findIndex((s) => s.key === 'snail'), hareS = SPECIES.findIndex((s) => s.key === 'hare');
  const snail = r.spawnAlpha(p, snailS, 10, false);
  p.hp = 1000;
  r.damage(p, 100, foe);
  check(bare === 100 && 1000 - p.hp === 82, `escargot niv. 10 : 100 dégâts → ${1000 - p.hp} (au lieu de ${bare})`);
  snail.reviveAt = r.time + 30;
  p.hp = 1000;
  r.damage(p, 100, foe);
  check(1000 - p.hp === 100, 'escargot en train de ressusciter : plus de protection');
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
}

{
  // Événements : un coup porté loin d'un dompteur ne lui est pas envoyé ; les annonces et ce qui lui est destiné, si.
  const r = room();
  const got = new Map<number, { e: string; to?: number }[]>();
  const spy = (id: () => number) => (m: { t: string; ev?: { e: string }[] }) => m.t === 's' && got.set(id(), [...(got.get(id()) ?? []), ...(m.ev ?? [])]);
  let ida = 0, idb = 0;
  const a = r.addPlayer('a', spy(() => ida));
  const b = r.addPlayer('b', spy(() => idb));
  [ida, idb] = [a.id, b.id];
  [a.x, a.y] = [r.map.spawn.x, r.map.spawn.y];
  [b.x, b.y] = [r.map.village.x + 4000, r.map.village.y];
  const foe = r.createUnit(0, false, a.x + 30, a.y);
  r.events = [];
  r.damage(foe, 1, a);
  r.events.push({ e: 'gold', to: a.id, n: 2, x: a.x, y: a.y }, { e: 'info', text: 'annonce' });
  r.broadcast();
  const ea = (got.get(a.id) ?? []).map((e) => e.e).join(), eb = (got.get(b.id) ?? []).map((e) => e.e).join();
  check(ea.includes('hit') && ea.includes('gold') && eb === 'info', `événements filtrés : proche « ${ea} », loin « ${eb} »`);
}

{
  // Arrivée au village : tous ses PV, classe comprise (nouveau dompteur : 75/75, pas 60/75).
  const r = room();
  const p = r.addPlayer('a', noop);
  check(p.hp === Math.round(armorMaxHp(0) * 1.25), `nouveau dompteur : ${p.hp} PV à l'arrivée, le maximum`);
}

{
  // Serpent des brumes en monture : seulement sur l'eau, on embarque près de l'eau, on descend au bord, on se noie s'il tombe.
  const r = room();
  const m = r.map;
  const p = r.addPlayer('a', noop);
  let shore: { x: number; y: number } | null = null, deep: { x: number; y: number } | null = null;
  for (let y = -WORLD_HALF + 200; y < WORLD_HALF - 200 && !(shore && deep); y += 60) {
    for (let x = -WORLD_HALF + 200; x < WORLD_HALF - 200 && !(shore && deep); x += 60) {
      if (!shore && !m.blocked(x, y) && m.waterNear(x, y, SHORE_R * 0.6)) shore = { x, y };
      if (!deep && m.waterNear(x, y, 0) && !m.landNear(x, y, SHORE_R + 40)) deep = { x, y };
    }
  }
  const serpentS = SPECIES.findIndex((s) => s.key === 'serpent');
  [p.x, p.y] = [shore!.x, shore!.y];
  const sp = r.spawnAlpha(p, serpentS, 0, false);
  [sp.x, sp.y] = [p.x, p.y];
  r.onMount(p, sp.id);
  check(p.mount === sp.id && m.isWater(p.x, p.y), 'serpent monté près de l\'eau : posé sur l\'eau');
  const water = { x: p.x, y: p.y };
  p.lastPosMs = Date.now() - 400;
  r.onPos(p, shore!.x, shore!.y, 1, 0);
  check(m.isWater(p.x, p.y), 'sur le serpent, impossible de marcher sur la terre');
  [p.x, p.y] = [deep!.x, deep!.y];
  r.onMount(p, 0);
  check(p.mount === sp.id, 'en pleine eau, loin de la rive : on ne peut pas descendre');
  [p.x, p.y] = [water.x, water.y];
  r.onMount(p, 0);
  check(p.mount === 0 && !m.blocked(p.x, p.y), 'au bord de la rive : on descend sur la terre ferme');
  const far = r.addPlayer('b', noop);
  [far.x, far.y] = [deep!.x + 5000, deep!.y]; // loin : pas de coéquipier pour le relever tout de suite
  [p.x, p.y] = [shore!.x, shore!.y];
  [sp.x, sp.y] = [p.x, p.y];
  r.onMount(p, sp.id);
  [p.x, p.y] = [deep!.x, deep!.y];
  const foe = r.createUnit(0, false, p.x, p.y);
  r.killUnit(sp, foe);
  check(p.dead && p.mount === 0, 'le serpent tombe en pleine eau : son dompteur se noie');
  const wolf = r.spawnAlpha(p, 1, 0, false);
  p.dead = false;
  [p.x, p.y] = [r.map.village.x, r.map.village.y];
  [wolf.x, wolf.y] = [p.x, p.y];
  const at = { x: p.x, y: p.y };
  r.onMount(p, wolf.id);
  check(p.mount === wolf.id && p.x === at.x, 'une monture terrestre se monte toujours sur place');

  // Dompteur sur l'eau : sa meute terrestre l'attend sur la berge, un serpent de la meute le suit dans l'eau.
  r.onMount(p, 0);
  [p.x, p.y] = [shore!.x, shore!.y];
  const sp2 = r.spawnAlpha(p, serpentS, 0, false);
  [sp2.x, sp2.y] = [p.x, p.y];
  r.onMount(p, sp2.id);
  const pack = [0, 4, 1].map((s) => {
    const u = r.createUnit(s, false, p.x, p.y);
    r.makeTamed(u, p);
    r.placeNear(u, p);
    return u;
  });
  const swimmers = ['serpent', 'crab', 'toad'].map((k) => {
    const u = r.createUnit(SPECIES.findIndex((s) => s.key === k), false, p.x, p.y);
    r.makeTamed(u, p);
    return u;
  });
  // il nage au large : un point d'eau à plus de 120 px de toute terre, la meute part de la berge la plus proche
  let swim: { x: number; y: number } | null = null;
  for (let y = -WORLD_HALF + 200; y < WORLD_HALF - 200 && !swim; y += 50) {
    for (let x = -WORLD_HALF + 200; x < WORLD_HALF - 200 && !swim; x += 50) {
      if (m.waterNear(x, y, 0) && !m.landNear(x, y, 120) && m.landNear(x, y, 300)) swim = { x, y };
    }
  }
  [p.x, p.y] = [swim!.x, swim!.y];
  const start = m.landNear(p.x, p.y, 900)!;
  for (const u of [...pack, ...swimmers]) [u.x, u.y] = [start.x, start.y];
  for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // pas de sauvages : la meute ne part pas se battre
  r.nextSpawn = r.nextSpawn.map(() => Infinity);
  let wet = 0;
  for (let i = 0; i < 20 * 8; i++) {
    r.step();
    [p.x, p.y] = [swim!.x, swim!.y];
    p.hp = 1e6;
    wet += pack.filter((u) => m.isWater(u.x, u.y)).length;
  }
  const bank = m.landNear(p.x, p.y, 900)!;
  const onBank = pack.every((u) => Math.hypot(u.x - bank.x, u.y - bank.y) < 260);
  check(wet === 0 && onBank, `meute terrestre restée sur la berge (jamais dans l'eau, à ${Math.round(Math.max(...pack.map((u) => Math.hypot(u.x - bank.x, u.y - bank.y))))} px de la berge la plus proche)`);
  // (leur place dans la formation peut tomber sur la rive toute proche : ils y vont, comme dans l'eau)
  check(swimmers.every((u) => Math.hypot(u.x - p.x, u.y - p.y) < 180) && swimmers.filter((u) => m.isWater(u.x, u.y)).length >= 2,
    'serpent, crabe et crapaud de la meute suivent leur dompteur dans l\'eau');
}

{
  // Animations : chaque zone d'attaque dit au client d'où elle vient (style, lanceur, durée), les coups au corps à corps sont marqués.
  const r = room();
  const got: { ev: { e: string; m?: number }[]; hazards: number[][] }[] = [];
  const p = r.addPlayer('a', (m: { t: string }) => m.t === 's' && got.push(m as never));
  const boss = r.units.get(r.caveBoss.find((id: number) => r.units.get(id) && SPECIES[r.units.get(id).s].key === 'colossus'));
  [p.x, p.y] = [boss.x + 30, boss.y];
  r.castMove(boss, { kind: 'slam', cd: 6 }, p);
  r.broadcast();
  const h = got.at(-1)!.hazards[0];
  check(!!h && h[8] === 2 && h[9] === boss.id && h[10] === 110, `onde de choc annoncée avec son style, son lanceur et sa durée (${h?.slice(8).join(', ')})`);
  const wolf = r.createUnit(1, false, p.x + 20, p.y);
  r.events = [];
  r.tryAttack(Object.assign(wolf, { atkCd: 0 }), p);
  const hit = r.events.find((e: { e: string }) => e.e === 'hit');
  r.events = [];
  r.damage(p, 3, wolf);
  const plain = r.events.find((e: { e: string }) => e.e === 'hit');
  check(hit?.m === 1 && plain && !plain.m, 'coup au corps à corps marqué (m : 1), dégâts d\'une zone non');
}

check(caveUnlockCost(1) === 150 && caveUnlockCost(3) === 450 && caveUnlockCost(4) === 1500 && caveUnlockCost(5) === 3000, 'grottes des dernières zones bien plus chères (1500 et 3000 or)');

console.log(failed ? `\nÉCHEC (TEST_SEED=${TEST_SEED})` : '\nOK');
process.exit(failed ? 1 : 0);
