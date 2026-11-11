// Le volcan de la Mer de sable : sa bouche, ses entrailles (zone 7), leurs géants et le cœur volcanique. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop, ALL_CAVES } from '../helpers.ts';
import { BOAT_REACH, BOAT_STAGES, boatReady, BOSS_RESPAWN_S, BUILDING_IDS, HALL_MAX, HEART_IN_BOAT, HEART_REACH, HEART_TAKEN, SPECIES, TICK_HZ, VOLCANO_R, VOLCANO_RY, VOLCANO_ZONE, ZONES, zoneBosses } from '../../shared/config.ts';
import { HALL_ID } from '../../shared/worldmap.ts';
import { Room } from '../../server/room.ts';

describe('Le volcan et ses entrailles', () => {
  rule('Sur la carte : un grand volcan dans la Mer de sable, solide, sa bouche devant, reliée à la voie centrale.', () => {
    const m = room().map, v = m.volcano, mo = m.volcanoMouth;
    check(m.zoneAt(v.x, v.y) === ZONES && m.zoneAt(mo.x, mo.y) === ZONES, 'le volcan est dans la Mer de sable');
    check(m.blocked(v.x, v.y) && m.blocked(v.x + VOLCANO_R * 0.8, v.y) && m.blocked(v.x, v.y + VOLCANO_R * VOLCANO_RY * 0.8), 'sa base est infranchissable');
    check(!m.blocked(mo.x, mo.y) && !m.isWater(mo.x, mo.y), 'sa bouche est libre, au sec');
    const s = m.arcAt(mo.x, mo.y), lane = m.spineAt(s);
    check(!!m.findPath(mo.x, mo.y, lane.x, lane.y, 60000), 'on y arrive depuis la voie centrale');
    check(m.zoneTo(ZONES) - m.zoneFrom(ZONES) > 1.5 * (m.zoneTo(5) - m.zoneFrom(5)), 'la Mer de sable est bien plus longue que les autres zones');
  });

  rule('Les entrailles : un donjon de la zone 7, ses salles, ses couloirs, ses mares de lave, trois antres au bout de culs-de-sac.', () => {
    const m = room().map, d = m.depths, h = d.inside;
    check(m.caveAt(h.x + 120, h.y + 60) === d && m.zoneAt(h.x + 120, h.y + 60) === VOLCANO_ZONE, 'le donjon est la zone 7');
    check(m.blocked(h.x, h.y) && !m.blocked(h.x + 120, h.y + 60), 'l\'autel du cœur, au centre, et on tourne autour');
    check(m.rooms.length >= 20 && m.rooms.filter((r: { kind: string }) => r.kind === 'heart').length === 1, `${m.rooms.length} salles, dont celle du cœur`);
    check(m.lavaPools.length >= 5 && m.lavaPools.every((p: { x: number; y: number }) => m.blocked(p.x, p.y)), `${m.lavaPools.length} mares de lave, infranchissables`);
    check(m.traps.some((t: { kind: string }) => t.kind === 'vent') && m.traps.some((t: { kind: string }) => t.kind === 'plate'), 'des évents de flammes et des dalles piégées');
    const lairs = m.caves.filter((c: { zone: number }) => c.zone === VOLCANO_ZONE);
    check(lairs.length === zoneBosses(VOLCANO_ZONE).length && lairs.length === 3, 'trois antres, un par géant du volcan');
    check(m.doors.length === m.links.length, 'une herse par couloir');
    const sides = new Set<string>();
    for (const c of lairs) {
      const k = c.room;
      check(k >= 0 && m.rooms[k].kind === 'lair' && m.links.filter(([a, b]: number[]) => a === k || b === k).length === 1, `antre de ${SPECIES[c.boss].name} : au bout d'un cul-de-sac`);
      check(m.arenaAt(m.rooms[k].x, m.rooms[k].y + 60)?.id === c.id && !m.blocked(c.home.x, c.home.y), '… le géant s\'y tient, à l\'air libre : la salle est son arène');
      const door = m.doors.findIndex((q: { lair: number }) => q.lair === c.id);
      check(door >= 0 && Math.hypot(m.doors[door].x - c.entrance.x, m.doors[door].y - c.entrance.y) < 1, '… derrière une herse, où l\'on paie l\'entrée');
      // de la sortie à l'antre (herses levées) : un chemin de salle en salle, droit d'un point à l'autre
      m.doorShut.fill(0);
      const path = m.findPath(d.exit.x, d.exit.y, c.home.x, c.home.y + 70);
      let cur = d.exit, ok = !!path;
      for (const q of path ?? []) {
        ok &&= m.clearLine(cur.x, cur.y, q.x, q.y);
        cur = q;
      }
      check(ok, '… et on y va depuis la sortie');
      sides.add(c.home.x < h.x - 1500 ? 'gauche' : c.home.x > h.x + 1500 ? 'droite' : 'haut');
    }
    check(sides.size === 3, 'un antre à gauche, un à droite, un en haut');
    check(m.blocked(d.exit.x, d.exit.y + 400), 'hors des salles : la roche');
  });

  rule('Les pièges du donjon : l\'évent brûle à son rythme, la dalle fait jaillir un geyser.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map, p = r.addPlayer('a', noop);
    const vi = m.traps.findIndex((t: { kind: string }) => t.kind === 'vent'), v = m.traps[vi];
    [p.x, p.y] = [v.x, v.y];
    let hurt = false;
    for (let i = 0; i < TICK_HZ * 7 && !hurt; i++) {
      const hp = p.hp;
      r.tick++;
      r.time += 1 / TICK_HZ;
      r.updateTraps();
      if (p.hp < hp) hurt = r.ventState(vi) === 2;
    }
    check(hurt, 'dans les flammes de l\'évent, quand il crache : on brûle');
    const d = m.traps.find((t: { kind: string }) => t.kind === 'plate');
    p.hp = 100000;
    [p.x, p.y] = [d.x, d.y];
    r.updateTraps();
    const hp = p.hp;
    r.time += 2;
    r.updateTraps();
    check(p.hp < hp && r.events.some((e: { e: string; kind?: string }) => e.e === 'boom' && e.kind === 'trap'), 'sur la dalle : le geyser jaillit peu après');
  });

  rule('La bouche s\'ouvre quand le village a vaincu les géants de la Mer de sable ; on y descend avec sa meute.', () => {
    const desert = zoneBosses(ZONES);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX, beaten: SPECIES.map((sp, i) => (sp.boss && !desert.includes(i) ? i : -1)).filter((i) => i >= 0) });
    const p = r.addPlayer('a', noop), m = r.map, mo = m.volcanoMouth;
    [p.x, p.y] = [mo.x, mo.y + 20];
    r.onCave(p, HALL_ID, true);
    check(!m.caveAt(p.x, p.y), 'géants de la Mer de sable encore debout : la bouche est scellée');
    r.beaten.push(...desert);
    r.time += 5;
    r.onCave(p, HALL_ID, true);
    check(m.caveAt(p.x, p.y) === m.depths, 'les trois vaincus : on descend dans les entrailles');
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y];
    r.time += 5;
    r.onCave(p, HALL_ID, false);
    check(!m.caveAt(p.x, p.y) && Math.hypot(p.x - mo.x, p.y - mo.y) < 200, '… et on remonte devant la bouche');
  });

  rule('Les créatures de lave gardent les salles des entrailles : elles apparaissent quand on peut y entrer, jamais au hasard.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const lava = SPECIES.map((sp, i) => (sp.zone === VOLCANO_ZONE && !sp.boss && !sp.minion ? i : -1)).filter((i) => i >= 0);
    check(lava.length === 3, 'trois espèces dans les entrailles');
    for (const s of lava) for (let k = 0; k < 5; k++) r.spawnPack(s);
    check(![...r.units.values()].some((u: { s: number }) => lava.includes(u.s)), 'rien n\'apparaît au hasard');
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.updateDepths();
    const wild = [...r.units.values()].filter((u: { s: number; owner: number }) => lava.includes(u.s) && !u.owner);
    const entry = m.rooms.findIndex((q: { kind: string }) => q.kind === 'entry');
    const next = new Set(m.links.flatMap(([a, b]: number[]) => (a === entry ? [b] : b === entry ? [a] : [])));
    check(wild.length > 0 && wild.every((u: { x: number; y: number; room: number }) => m.caveAt(u.x, u.y) === m.depths && !m.blocked(u.x, u.y) && next.has(u.room) && m.roomAt(u.x, u.y) === u.room),
      `${wild.length} créatures de lave, dans les salles qui touchent l'entrée (et seulement elles)`);
  });

  rule('Les herses : vider une salle ouvre les voisines ; un antre ne s\'ouvre qu\'une fois son entrée payée.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: [], hall: HALL_MAX, beaten: [] });
    const m = r.map, p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.updateDepths();
    const entry = m.rooms.findIndex((q: { kind: string }) => q.kind === 'entry');
    const touches = (i: number, k: number) => m.links[i][0] === k || m.links[i][1] === k;
    check(m.links.every((_: unknown, i: number) => !!m.doorShut[i] === !touches(i, entry)), 'au départ : seules les herses de la salle d\'entrée sont levées');
    const door = m.links.findIndex((_: unknown, i: number) => touches(i, entry));
    const k = m.links[door][0] === entry ? m.links[door][1] : m.links[door][0];
    const shut = m.doors.find((_: unknown, i: number) => !touches(i, entry) && touches(i, k));
    check(!shut || m.blocked(shut.x, shut.y), 'une herse baissée barre le couloir');
    // la garnison de la salle voisine tombe : ses autres herses se lèvent
    for (const u of [...r.units.values()]) if (u.room === k) r.units.delete(u.id);
    r.updateDepths();
    check(r.cleared.has(k) && m.links.every((_: unknown, i: number) => !touches(i, k) || !m.doorShut[i] || m.doors[i].lair >= 0), 'salle vidée : les herses de ses couloirs se lèvent');
    // un antre : il faut que la salle d'à côté soit vidée, et que l'entrée soit payée
    const lair = m.caves.find((c: { room?: number }) => c.room !== undefined), li = m.doors.findIndex((q: { lair: number }) => q.lair === lair.id);
    const [a, b] = m.links[li], before = a === lair.room ? b : a;
    r.cleared.add(before);
    r.updateDepths();
    check(m.doorShut[li] === 1, 'salle d\'à côté vidée, entrée pas payée : la herse de l\'antre reste baissée');
    p.gold = 1e6;
    [p.x, p.y] = [lair.entrance.x - m.doors[li].ux * 60, lair.entrance.y - m.doors[li].uy * 60];
    if (m.doors[li].lair >= 0 && m.rooms[a] === m.rooms[lair.room]) [p.x, p.y] = [lair.entrance.x + m.doors[li].ux * 60, lair.entrance.y + m.doors[li].uy * 60];
    r.onUnlock(p, lair.id);
    r.updateDepths();
    check(r.unlocked.includes(lair.id) && m.doorShut[li] === 0, 'entrée payée devant la herse : elle se lève');
    r.onCave(p, lair.id, true);
    check(m.caveAt(p.x, p.y) === m.depths, 'pas d\'intérieur à part : le géant attend dans sa salle');
  });

  rule('Dans le donjon, on ne tire pas d\'une salle à l\'autre : la roche et les herses arrêtent la vue.', () => {
    const r = room(), m = r.map;
    const [a, b] = m.links[0], A = m.rooms[a], B = m.rooms[b];
    m.doorShut.fill(0);
    check(m.inSight(A.x, A.y, B.x, B.y) || !m.clearLine(A.x, A.y, B.x, B.y), 'herse levée : on voit d\'un bout du couloir à l\'autre (s\'il est dégagé)');
    m.doorShut[0] = 1;
    check(!m.inSight(A.x, A.y, B.x, B.y), 'herse baissée : on ne voit plus au travers');
    // une salle proche, sans couloir entre les deux : la roche coupe la vue
    const far = m.rooms.findIndex((q: { x: number; y: number }, i: number) => i !== a && Math.hypot(q.x - A.x, q.y - A.y) < 1600 && !m.links.some(([x, y]: number[]) => (x === a && y === i) || (x === i && y === a)));
    check(far >= 0, 'deux salles proches sans couloir entre elles');
    const F = m.rooms[far];
    check(!m.inSight(A.x, A.y, F.x, F.y), 'à travers la roche : rien');
    // un archer au bord de sa salle, un monstre de l'autre côté de la roche, à portée : il ne le touche pas
    r.units.clear();
    const p = r.addPlayer('arc', noop);
    p.cls = 'archer';
    p.hp = 1e6;
    const d = Math.hypot(F.x - A.x, F.y - A.y), ux = (F.x - A.x) / d, uy = (F.y - A.y) / d;
    const edge = m.sightReach(A.x, A.y, ux, uy, d);
    [p.x, p.y] = [A.x + ux * (edge - 40), A.y + uy * (edge - 40)];
    const lava = SPECIES.findIndex((sp) => sp.key === 'salamander');
    let spot = edge + 40;
    while (spot < d && m.blocked(A.x + ux * spot, A.y + uy * spot)) spot += 16;
    const u = r.createUnit(lava, false, A.x + ux * spot, A.y + uy * spot);
    const hp = u.hp;
    for (let i = 0; i < 20; i++) r.step();
    check(Math.hypot(u.x - p.x, u.y - p.y) > 500 || u.hp === hp, 'derrière la roche : l\'archer ne le touche pas');
  });

  rule('Les flammes des pièges brûlent aussi à dos de vautour, et la meute qui n\'est pas de feu.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const vi = m.traps.findIndex((t: { kind: string }) => t.kind === 'vent'), v = m.traps[vi];
    [p.x, p.y] = [v.x, v.y];
    const vul = SPECIES.findIndex((sp) => sp.key === 'vulture'), wolf = SPECIES.findIndex((sp) => sp.key === 'wolf'), bat = SPECIES.findIndex((sp) => sp.key === 'ash_bat');
    const mount = r.spawnAlpha(p, vul, 0, false);
    [mount.x, mount.y] = [p.x, p.y];
    r.onMount(p, mount.id);
    check(r.airborne(p), 'en vol');
    const w = r.spawnAlpha(p, wolf, 0, false), f = r.spawnAlpha(p, bat, 0, false);
    for (const u of [w, f]) [u.x, u.y] = [v.x + 10, v.y];
    const hp = p.hp, whp = w.hp, fhp = f.hp;
    for (let i = 0; i < TICK_HZ * 8; i++) {
      r.tick++;
      r.time += 1 / TICK_HZ;
      for (const u of [w, f]) [u.x, u.y] = [v.x + 10, v.y];
      p.hp = Math.max(p.hp, 1);
      r.updateTraps();
    }
    check(p.hp < hp, 'à dos de vautour : on brûle quand même');
    check(w.hp < whp, 'le loup de la meute brûle');
    check(f.hp === fhp, 'la chauve-souris de cendre (feu) ne craint rien');
  });

  rule('Le cœur volcanique : scellé tant qu\'un géant du volcan est debout, pris une fois, puis installé dans le bateau rebâti.', () => {
    const lords = zoneBosses(VOLCANO_ZONE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new Room('TEST', undefined, { buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX, beaten: SPECIES.map((sp, i) => (sp.boss && sp.zone < VOLCANO_ZONE ? i : -1)).filter((i) => i >= 0) });
    let saved = { heart: 0 };
    r.onVillage = (v: typeof saved) => (saved = v);
    const p = r.addPlayer('a', noop), h = r.map.depths.inside, sw = r.map.shipwreck;
    [p.x, p.y] = [h.x + HEART_REACH - 20, h.y];
    r.beaten.push(lords[0], lords[1]);
    r.onHeart(p);
    check(r.heart === 0, 'un géant du volcan encore debout : le cœur est scellé');
    r.beaten.push(lords[2]);
    [p.x, p.y] = [h.x + HEART_REACH + 200, h.y];
    r.onHeart(p);
    check(r.heart === 0, 'trop loin de l\'autel : rien');
    [p.x, p.y] = [h.x + HEART_REACH - 20, h.y];
    r.onHeart(p);
    check(r.heart === HEART_TAKEN && saved.heart === HEART_TAKEN, 'les trois vaincus : le cœur est pris, sauvegardé avec le village');
    [p.x, p.y] = [sw.x + 60, sw.y + 60];
    r.onHeart(p);
    check(r.heart === HEART_TAKEN && !boatReady(r.boat, r.heart), 'bateau pas encore rebâti : le cœur attend');
    r.boat = BOAT_STAGES.length;
    [p.x, p.y] = [sw.x + BOAT_REACH + 300, sw.y];
    r.onHeart(p);
    check(r.heart === HEART_TAKEN, 'loin du bateau : rien');
    [p.x, p.y] = [sw.x + 60, sw.y + 60];
    r.onHeart(p);
    check(r.heart === HEART_IN_BOAT && boatReady(r.boat, r.heart) && saved.heart === HEART_IN_BOAT, 'devant le bateau rebâti : le cœur est installé, le bateau peut prendre la mer');
    const back = new Room('TEST', r.seed, { ...saved });
    check(back.heart === HEART_IN_BOAT, 'il reste dans le bateau au redémarrage');
    check(r.bossCount() === r.map.caves.filter((c: { zone: number; boss: number }) => c.zone <= ZONES && !SPECIES[c.boss].optional).length, 'les géants du volcan (et le Scorpion Empereur, facultatif) ne comptent pas dans les souvenirs du vieil homme');
    check(!r.scrollCaves(p).some((id: number) => r.map.caves[id].zone === VOLCANO_ZONE), 'ils ne laissent pas de parchemin');
  });

  rule('À dos de vautour : pas de survol du volcan, et on combat les vautours en plein vol.', () => {
    const r = room(), m = r.map, v = m.volcano, mo = m.volcanoMouth;
    r.units.clear();
    const p = r.addPlayer('aile', noop), q = r.addPlayer('pied', noop);
    const vul = SPECIES.findIndex((sp) => sp.key === 'vulture');
    check(!m.passable(v.x, v.y, false, true) && !m.passable(v.x + VOLCANO_R * 0.7, v.y, false, true), 'en vol, la base du volcan reste infranchissable');
    const tree = m.decor.find((d: { kind: number; zone: number }) => d.kind === 0 && d.zone === 2);
    const trunk = m.trunkOf(tree);
    check(m.blocked(trunk.x, trunk.y) && m.passable(trunk.x, trunk.y, false, true), 'mais on survole toujours les arbres et les rochers');
    [p.x, p.y] = [mo.x, mo.y + 60];
    const mount = r.spawnAlpha(p, vul, 0, false);
    [mount.x, mount.y] = [p.x, p.y];
    r.onMount(p, mount.id);
    check(p.mount === mount.id, 'en selle sur le vautour');
    for (let i = 0; i < 40; i++) {
      p.lastPosMs = Date.now() - 100;
      r.onPos(p, p.x, p.y - 25, 0, -1); // tout droit vers le cœur du volcan
    }
    check(!m.inVolcano(p.x, p.y), 'il bute contre le volcan au lieu de passer au-dessus');
    // un vautour sauvage tourne haut dans le ciel : hors d'atteinte du sol, pas du dos d'un vautour
    const wild = r.createUnit(vul, false, p.x + 60, p.y);
    wild.hidden = true;
    const hp0 = wild.hp;
    [q.x, q.y] = [p.x - 60, p.y];
    r.damage(wild, 50, q);
    check(wild.hp === hp0, 'à pied : le vautour en vol est hors d\'atteinte');
    r.damage(wild, 50, p);
    check(wild.hp < hp0, 'à dos de vautour : on le touche en plein vol');
    check(r.preyOf(p)(wild) && !r.preyOf(q)(wild), 'et on peut le prendre pour cible (le cavalier, pas le piéton)');
  });

  rule('Géants du volcan : traînée de lave et tourbillon de flammes.', () => {
    const r = room();
    // la grille de voisinage est refaite à chaque pas de simulation : ici on avance les attaques à la main
    const regrid = () => {
      r.grid.clear();
      for (const e of [...r.players.values(), ...r.units.values()]) r.grid.insert(e);
    };
    const giant = (key: string) => {
      const c = r.map.caves.find((k: { boss: number }) => SPECIES[k.boss].key === key);
      const u = r.units.get(r.caveBoss[c.id]);
      u.dormant = false;
      return u;
    };
    // traînée de lave : des flaques derrière elle, qui brûlent ceux qui y restent
    const queen = giant('salamander_queen');
    const p = r.addPlayer('a', noop);
    p.hp = 99999;
    [p.x, p.y] = [queen.x + 600, queen.y];
    r.castMove(queen, { kind: 'trail', cd: 7, dur: 4 }, p);
    const x0 = queen.x;
    for (let k = 0; k < 5; k++) {
      queen.x = x0 + k * 80;
      r.dropTrail(queen);
    }
    const pools = r.hazards.filter((h: { style?: string; boss: unknown }) => h.style === 'lava' && h.boss === queen);
    check(pools.length === 5, `traînée : une flaque tous les quelques pas (${pools.length})`);
    [p.x, p.y] = [pools[1].x, pools[1].y];
    queen.x = x0 + 900;
    const hp1 = p.hp;
    regrid();
    r.time += 1;
    r.updateHazards();
    r.time += 0.6;
    r.updateHazards();
    check(p.hp < hp1, 'debout dans une flaque : on brûle');
    // tourbillon : trois jets annoncés qui tournent autour de lui et balaient tout ce qui est à portée
    const lord = giant('ash_lord');
    const q = r.addPlayer('b', noop);
    q.hp = 99999;
    r.hazards = [];
    r.castMove(lord, { kind: 'spin', cd: 9, arms: 3, dur: 3.5 }, q);
    const jets = r.hazards.filter((h: { style?: string }) => h.style === 'flame');
    check(jets.length === 3 && lord.castUntil > r.time + 4, 'tourbillon : trois jets, le géant reste sur place');
    [q.x, q.y] = [lord.x + 200, lord.y + 30];
    regrid();
    const hp2 = q.hp, end = r.time + 4.6;
    while (r.time < end) {
      r.time += 0.05;
      r.updateHazards();
    }
    check(q.hp < hp2, 'les jets tournent : impossible de rester à portée sans être brûlé');
    check(!r.hazards.some((h: { style?: string }) => h.style === 'flame'), 'puis ils s\'éteignent');
  });

  rule('Antre du volcan : la herse retombe pendant le combat, chacun se retrouve du côté de sa meute et de ses Alphas, puis elle se relève.', () => {
    const r = room(), m = r.map;
    const lair = m.caves.find((c: { room?: number }) => c.room !== undefined), li = m.doors.findIndex((q: { lair: number }) => q.lair === lair.id);
    const d = m.doors[li], k = lair.room, boss = r.units.get(r.caveBoss[lair.id]);
    const inLair = (e: { x: number; y: number }) => m.roomAt(e.x, e.y) === k;
    // un point du couloir, juste derrière la herse (côté opposé à l'antre)
    const out = [1, -1].map((sg) => ({ x: d.x + d.ux * 150 * sg, y: d.y + d.uy * 150 * sg })).find((q) => !inLair(q) && !m.blocked(q.x, q.y))!;
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    [p.x, p.y] = [boss.x, boss.y + boss.r + 40];
    [q.x, q.y] = [out.x, out.y];
    m.rooms.forEach((_: unknown, i: number) => r.cleared.add(i));
    r.tick = 0;
    r.updateDepths();
    check(inLair(p) && r.map.arenaAt(p.x, p.y)?.id === lair.id && m.doorShut[li] === 0, 'avant le combat : la herse de l\'antre est levée, le dompteur est dans l\'antre');
    // la meute de p est restée dans le couloir ; un monstre de q, lui, est entré dans l'antre sans son dompteur
    const wolf = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'wolf'), false, out.x, out.y);
    r.makeTamed(wolf, p);
    const hare = r.spawnAlpha(p, SPECIES.findIndex((sp) => sp.key === 'hare'), 0, false);
    [hare.x, hare.y] = [out.x, out.y];
    const stray = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'wolf'), false, p.x + 60, p.y);
    r.makeTamed(stray, q);
    r.events = [];
    r.onChallenge(p, lair.id);
    check(!boss.dormant && m.doorShut[li] === 1 && m.blocked(d.x, d.y), 'le combat commence : la herse retombe aussitôt et barre le couloir');
    check(inLair(wolf) && inLair(hare), 'la meute et l\'Alpha restés dans le couloir rejoignent leur dompteur dans l\'antre');
    check(!inLair(stray) && Math.hypot(stray.x - q.x, stray.y - q.y) < 200, 'le monstre entré sans son dompteur le rejoint dehors');
    check(r.events.some((e: { e: string; shut?: boolean }) => e.e === 'lair' && e.shut), 'les joueurs proches sont prévenus');
    check(m.doorShut[li] === 1, 'tant que le géant est debout, elle reste baissée');
    r.calmBoss(boss); // combat perdu : il se rendort, guéri
    check(m.doorShut[li] === 0 && r.events.some((e: { e: string; shut?: boolean }) => e.e === 'lair' && !e.shut), 'le combat fini, la herse se relève');
  });
  rule('Géant du volcan : combat perdu, il se rendort chez lui avec toute sa vie ; vaincu, il réapparaît dans son antre, lui aussi avec toute sa vie.', () => {
    const lair = m.caves.find((c: { room?: number }) => c.room !== undefined), home = lair.home ?? lair.inside;
    let boss = r.units.get(r.caveBoss[lair.id]);
    const p = r.addPlayer('a', noop);
    p.hp = 1e9;
    boss.hp = boss.maxHp / 3;
    [boss.x, boss.y] = [boss.x + 120, boss.y + 40];
    // plus personne dans l'antre (le dompteur est retourné à l'entrée du donjon) : le combat est perdu
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.clearEmptyCaves();
    check(boss.dormant && boss.hp === boss.maxHp && !boss.fight && Math.hypot(boss.x - home.x, boss.y - home.y) < 1, `combat perdu : il se rendort chez lui, ${Math.round(boss.hp)} / ${Math.round(boss.maxHp)} PV`);
    // cette fois il est vaincu : il réapparaît après le délai
    r.killUnit(boss, p);
    check(!r.caveBoss[lair.id], 'vaincu : son antre est vide');
    r.time += BOSS_RESPAWN_S + 1;
    r.updateSpawns();
    boss = r.units.get(r.caveBoss[lair.id]);
    check(!!boss && boss.dormant && boss.hp === boss.maxHp && m.roomAt(boss.x, boss.y) === lair.room, 'le délai passé, il réapparaît endormi dans son antre, avec toute sa vie');
});
