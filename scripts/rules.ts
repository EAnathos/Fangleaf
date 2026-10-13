// Tests des règles de simulation, sans réseau. Usage : npm run test:rules

import { ALPHA_CREATE_COST, ARMY_CAP, DT, PLAYER_RESPAWN_S, REVIVE_HOLD_S, REVIVE_R, REVIVE_WINDOW_S, armorMaxHp, BOSS_RESPAWN_S, BUILDING_IDS, BUILDINGS, CAMP_COST, caveUnlockCost, monsterBuyPrice, monsterSellPrice, CAMP_R, RECALL_R, SPECIES, WORLD_HALF, alphaAwakenS, alphaStats, alphaUpCost, oreGold } from '../shared/config.ts';
import { WorldMap } from '../shared/worldmap.ts';
import { Room } from '../server/room.ts';

let failed = false;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✔' : '✘'} ${label}`);
  if (!ok) failed = true;
};
// Village de test : tous les bâtiments construits et toutes les grottes débloquées (sauf mention contraire).
const ALL_CAVES = Array.from({ length: 64 }, (_, i) => i);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const room = (): any => new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES });
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
  check(a.maxHp === Math.round(SPECIES[1].hp * 2.5 * 1.1) && a.dmg === Math.round(SPECIES[1].dmg * 2.5 * 1.1), `Alpha niv. 0 = 2,5× le Loup, +10 % de collection (PV ${a.maxHp}, dégâts ${a.dmg})`);
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
  check(SPECIES.every((_, i) => seen.has(i)), `les ${SPECIES.length} espèces (dont ${SPECIES.filter((sp) => sp.boss).length} géants) sont présentes au lancement`);
  const zones = new Map<number, number>();
  for (const sp of SPECIES) if (!sp.boss) zones.set(sp.zone, (zones.get(sp.zone) ?? 0) + 1);
  check([1, 2, 3].every((z) => zones.get(z) === 2) && zones.get(4) === 3 && zones.get(5) === 3, 'deux espèces par zone, trois en zones 4 et 5');
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
    let lw = 0, ln = 0;
    for (let x = -WORLD_HALF + 20; x < WORLD_HALF; x += 80) {
      for (let y = -WORLD_HALF + 20; y < WORLD_HALF; y += 80) {
        if (m.isForest(x, y)) continue;
        if (m.zoneAt(x, y) === 5) ln++, lw += +m.isWater(x, y);
        else n++, water += +m.isWater(x, y);
      }
    }
    check(d >= 800 && !m.inVillage(m.spawn.x, m.spawn.y) && pathOk && water / n > 0.04 && water / n < 0.2 && lw / ln > 0.2,
      `graine ${seed} : village à ${Math.round(d)} px du camp, chemin libre, ${Math.round((100 * water) / n)} % de lacs (zone 5 : ${Math.round((100 * lw) / ln)} %)`);
    const edge = WORLD_HALF - 1000;
    check(m.spawn.y < -edge || m.spawn.x > edge || m.spawn.y > edge, `graine ${seed} : camp de départ au bord haut, droit ou bas (${Math.round(m.spawn.x)}, ${Math.round(m.spawn.y)})`);
    const site = m.sites[0], stone = m.stones[1];
    const reach = m.findPath(m.village.x, m.village.y + 40, stone.x, stone.y + 50, 500000);
    const zones = [0.1, 0.3, 0.5, 0.7, 0.92].map((f) => { const q = m.spineAt(f * m.length); return m.zoneAt(q.x, q.y); }).join('');
    const end = m.spineAt(m.length - 250);
    const reachEnd = m.findPath(stone.x, stone.y + 50, end.x, end.y, 600000);
    check(m.sites.length === 1 && m.zoneAt(site.x, site.y) === 4 && !!reach && !!reachEnd && zones === '12345' && m.caves.length === 12,
      `graine ${seed} : couloir de ${m.length} px, zones ${zones}, camp au bout de la zone 4, bout des Lacs brumeux atteignable, 12 grottes`);
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
  const ends = [r.map.spineAt(0), r.map.spineAt(r.map.length)];
  for (const z of [1, 5]) {
    const zs = all.filter((u) => SPECIES[u.s].zone === z);
    const piled = Math.max(...ends.map((e) => zs.filter((u) => Math.hypot(u.x - e.x, u.y - e.y) < 900).length)) / zs.length;
    check(piled < 0.25, `zone ${z} : pas d'entassement aux extrémités du couloir (${Math.round(piled * 100)} % près d'un bout)`);
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
  const o = r.map.ores[0];
  [p.x, p.y] = [o.x + 30, o.y];
  const gold0 = p.gold;
  for (let i = 0; i < 20 * 15 && r.oreHp[o.id] > 0; i++) r.step();
  check(r.oreHp[o.id] <= 0 && p.gold === gold0 + oreGold(o.zone), `filon miné : +${p.gold - gold0} or (zone ${o.zone})`);
  r.time += 1000;
  r.tick = 9;
  r.step();
  check(r.oreHp[o.id] > 0, 'le filon réapparaît après un délai');
}

{
  // Grottes : entrer avec sa meute, mini-boss, âme, réapparition du boss.
  const r = room();
  const p = r.addPlayer('a', noop);
  const c = r.map.caves[0];
  const perZone = [1, 2, 3, 4, 5].map((z) => r.map.caves.filter((cv: { zone: number }) => cv.zone === z).length).join('');
  check(r.map.caves.length === 12 && perZone === '22233' && r.map.caves.every((cv: { boss: number; zone: number }) => SPECIES[cv.boss].boss && SPECIES[cv.boss].zone === cv.zone),
    `12 grottes (${perZone} par zone), un géant par espèce`);
  check(SPECIES.filter((sp) => !sp.boss).every((sp) => SPECIES.some((b) => b.boss && b.base === sp.key)), 'chaque espèce a son géant (âme → Alpha légendaire)');
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
  check(souls > 0 && souls < 40, `âme lâchée parfois (${souls} sur 40 victoires)`);
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
  check(!!tamed && tamed.maxHp === Math.round(SPECIES[1].hp * 0.5) && tamed.dmg === Math.round(SPECIES[1].dmg * 0.5),
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
  let maxStuck = 0;
  for (let i = 0; i < 20 * 12; i++) {
    r.step();
    maxStuck = Math.max(maxStuck, f.stuck);
  }
  check(Math.hypot(f.x - p.x, f.y - p.y) < 160 && maxStuck < 2.5, `le Loup de la meute fait le tour par la porte (arrivé à ${Math.round(Math.hypot(f.x - p.x, f.y - p.y))} px, jamais coincé)`);
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
  check(back.length === 3 && back.every((u: { maxHp: number; s: number }) => u.maxHp === Math.round(SPECIES[u.s].hp * 0.5)), 'meute retrouvée à la reconnexion (stats d\'apprivoisés)');
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
  check(any.maxHp === alphaStats(any.s, 0, 7).hp, 'le bonus de collection compte aussi les Alphas au repos (+70 %)');
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
  // Un archer qui recule en tirant se fait rattraper par les géants.
  const r = room();
  for (const c of r.map.caves) {
    const boss = r.units.get(r.caveBoss[c.id]);
    boss.moveCd = boss.moveCd.map(() => 99); // on mesure la poursuite, pas les attaques spéciales
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
  // Bonus de collection : +10 % par Alpha éveillé, pour tous (3 Alphas = +30 %).
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
  check(p.army.length === 3 && wolf.maxHp === alphaStats(1, 0, 3).hp && wolf.maxHp === Math.round(SPECIES[1].hp * 2.5 * 1.3),
    `3 Alphas : +30 % chacun (Alpha Loup ${Math.round(SPECIES[1].hp * 2.5)} → ${wolf.maxHp} PV)`);
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
  // Bâtiments du village : achetés avec de l'or, une fois pour tous ; sans eux, rien à faire devant le chantier.
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
  r.onBuild(p, 'forge');
  check(!r.buildings.includes('forge') && p.gold === 9, 'pas assez d\'or : rien de construit');
  p.gold = 500;
  r.onBuild(p, 'forge');
  r.onBuild(p, 'forge');
  check(r.buildings.join() === 'forge' && p.gold === 490 && saved.buildings.join() === 'forge', 'forge construite une seule fois, 10 or, sauvegardée pour le village');
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
  r.onBuild(p, 'stone');
  r.onTravel(p, 0);
  check(p.gold === 0 && !r.map.inVillage(p.x, p.y), 'Pierre du village construite (200 or) : voyage vers le camp');
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
    const spot = r.map.freeNear(r.map.spineAt(12000).x, r.map.spineAt(12000).y);
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
    check(crabs.length > 0 && crabs.every((u: { x: number; y: number }) => r.map.zoneAt(u.x, u.y) === 5), `Crabes et Crapauds en zone 5 (${crabs.length} crabes)`);
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
    r.step();
    const shots = r.shots.filter((x: { by: { id: number } }) => x.by.id === b.id);
    check(shots.length === n && shots.every((x: { kind: number }) => x.kind === kind), `${SPECIES[S(key)].name} : ${n} projectiles d'un coup (${['salve de traits', 'pluie de mortiers', 'salve de jets'][kind]})`);
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

console.log(failed ? '\nÉCHEC' : '\nOK');
process.exit(failed ? 1 : 0);
