// Le volcan de la Mer de sable : sa bouche, ses entrailles (zone 7), leurs géants et le cœur volcanique. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop, ALL_CAVES } from '../helpers.ts';
import { BOSS_MOVES, BOAT_REACH, BOAT_STAGES, boatReady, BOSS_RESPAWN_S, ROOM_MIN, ROOM_REFILL_R, ROOM_REFILL_S, BUILDING_IDS, DEPTHS_RESET_S, LAIR_PULL_R, HALL_MAX, HEART_IN_BOAT, HEART_REACH, HEART_TAKEN, SPECIES, TICK_HZ, VOLCANO_R, VOLCANO_RY, VOLCANO_ZONE, ZONES, zoneBosses } from '../../shared/config.ts';
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

  rule('Chaque salle gardée du donjon a sa garnison bien fournie : ROOM_MIN créatures de lave au moins.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const counts: number[] = [];
    m.rooms.forEach((q: { kind: string }, k: number) => {
      if (q.kind === 'entry' || q.kind === 'lair') return;
      r.garrison(k);
      counts.push([...r.units.values()].filter((u: { room?: number; x: number; y: number }) => u.room === k && m.roomAt(u.x, u.y) === k).length);
    });
    check(counts.length > 10 && counts.every((n) => n >= ROOM_MIN), `${counts.length} salles gardées, de ${Math.min(...counts)} à ${Math.max(...counts)} créatures (au moins ${ROOM_MIN})`);
  });

  rule('Une salle vidée du donjon se regarnit pendant la visite, loin de tout dompteur, et ses herses restent levées.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map, p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.updateDepths();
    const entry = m.rooms.findIndex((q: { kind: string }) => q.kind === 'entry');
    const k = m.links.flatMap(([a, b]: number[]) => (a === entry ? [b] : b === entry ? [a] : [])).find((i: number) => m.rooms[i].kind !== 'lair');
    const garrison = () => [...r.units.values()].filter((u: { room?: number; owner: number }) => u.room === k && !u.owner);
    check(garrison().length >= ROOM_MIN, `salle voisine de l'entrée : ${garrison().length} créatures`);
    for (const u of garrison()) r.units.delete(u.id);
    r.updateDepths();
    const doors = m.links.map((_: unknown, i: number) => i).filter((i: number) => m.links[i].includes(k) && m.doors[i].lair < 0);
    const open = () => doors.every((i: number) => m.doorShut[i] === 0);
    check(r.cleared.has(k) && open() && garrison().length === 0, 'vidée : ses herses se lèvent, elle reste vide');
    // un dompteur la voit (il s'y tient) : rien ne revient, même longtemps après
    const Q = m.rooms[k], there = m.freeNear(Q.x, Q.y);
    [p.x, p.y] = [there.x, there.y];
    check(r.nearRoom(k, ROOM_REFILL_R), 'le dompteur est dans la salle vidée');
    r.time += ROOM_REFILL_S * 2;
    r.updateDepths();
    check(garrison().length === 0, 'un dompteur à côté : la salle ne se regarnit pas sous ses yeux');
    // loin, dans une salle à l'écart : elle se regarnit, une fois le délai passé (compté depuis qu'elle est vide)
    const far = m.rooms.findIndex((q: { x: number; y: number; kind: string }) => q.kind === 'room' && Math.hypot(q.x - Q.x, q.y - Q.y) > Math.max(Q.rx, Q.ry) + ROOM_REFILL_R + 600);
    check(far >= 0, 'une salle loin de la salle vidée');
    const at = m.freeNear(m.rooms[far].x, m.rooms[far].y);
    [p.x, p.y] = [at.x, at.y];
    check(m.caveAt(p.x, p.y) === m.depths && !r.nearRoom(k, ROOM_REFILL_R), 'le dompteur est parti loin, toujours dans le donjon');
    r.updateDepths();
    check(garrison().length >= ROOM_MIN, `personne à côté depuis le délai : la salle se regarnit (${garrison().length} créatures)`);
    check(r.cleared.has(k) && open(), 'regarnie : ses herses restent levées, personne n\'est enfermé');
    // vidée de nouveau : le délai repart de zéro
    for (const u of garrison()) r.units.delete(u.id);
    r.updateDepths();
    r.time += ROOM_REFILL_S - 5;
    r.updateDepths();
    check(garrison().length === 0, 'vidée de nouveau : rien avant la fin du délai');
    r.time += 10;
    r.updateDepths();
    check(garrison().length >= ROOM_MIN, '… puis elle se regarnit');
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
    r.updateDepths();
    check(m.doorShut[li] === 1, 'tant que le géant est debout, elle reste baissée');
    r.events = [];
    r.calmBoss(boss); // combat perdu : il se rendort, guéri
    r.updateDepths();
    check(m.doorShut[li] === 0 && r.events.some((e: { e: string; shut?: boolean }) => e.e === 'lair' && !e.shut), 'le combat fini, la herse se relève');
  });

  rule('Géant du volcan : combat perdu, il se rendort chez lui avec toute sa vie ; vaincu, il réapparaît dans son antre, lui aussi avec toute sa vie.', () => {
    const r = room(), m = r.map;
    const lair = m.caves.find((c: { room?: number }) => c.room !== undefined), home = lair.home ?? lair.inside;
    let boss = r.units.get(r.caveBoss[lair.id]);
    const p = r.addPlayer('a', noop);
    p.hp = 1e9;
    [p.x, p.y] = [boss.x, boss.y + boss.r + 40];
    r.onChallenge(p, lair.id);
    boss.hp = boss.maxHp / 3;
    [boss.x, boss.y] = [boss.x + 120, boss.y + 40];
    // plus personne dans l'antre (le dompteur est retourné à l'entrée du donjon) : le combat est perdu
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.clearEmptyCaves();
    check(boss.dormant && boss.hp === boss.maxHp && !boss.fight && Math.hypot(boss.x - home.x, boss.y - home.y) < 1, `combat perdu : il se rendort chez lui, ${Math.round(boss.hp)} / ${Math.round(boss.maxHp)} PV`);
    // cette fois il est vaincu : il réapparaît après le délai
    [p.x, p.y] = [boss.x, boss.y + boss.r + 40];
    r.onChallenge(p, lair.id);
    r.killUnit(boss, p);
    check(!r.caveBoss[lair.id], 'vaincu : son antre est vide');
    r.time += BOSS_RESPAWN_S + 1;
    r.tick = 0;
    r.updateSpawns();
    boss = r.units.get(r.caveBoss[lair.id]);
    check(!!boss && boss.dormant && boss.hp === boss.maxHp && m.roomAt(boss.x, boss.y) === lair.room, 'le délai passé, il réapparaît endormi dans son antre, avec toute sa vie');
  });

  rule('Antre de la Tortue-Montagne : sa camarade à terre, le dernier dompteur debout peut reculer jusqu\'à la herse ou se coller au mur, le combat continue.', () => {
    const r = room(), m = r.map;
    const lair = m.caves.find((c: { room?: number; boss: number }) => c.room !== undefined && SPECIES[c.boss].key === 'mountain_tortoise');
    const li = m.doors.findIndex((q: { lair: number }) => q.lair === lair.id), d = m.doors[li], R = m.rooms[lair.room];
    const boss = r.units.get(r.caveBoss[lair.id]);
    const p = r.addPlayer('a', noop), q = r.addPlayer('b', noop);
    [p.x, p.y] = [boss.x, boss.y + boss.r + 40];
    [q.x, q.y] = [boss.x + 60, boss.y + boss.r + 40];
    r.onChallenge(p, lair.id);
    check(!boss.dormant && m.doorShut[li] === 1, 'le combat commence, la herse retombe');
    q.dead = true; // sa camarade tombe
    // les points où l'on peut se tenir du côté du géant, hors de l'ellipse de la salle : le bout de couloir devant la
    // herse, et le ras des murs (le sol est creusé par cases)
    const spots: { x: number; y: number; door: number }[] = [];
    for (let x = R.x - R.rx * 1.4; x <= R.x + R.rx * 1.4; x += 8) {
      for (let y = R.y - R.ry * 1.4; y <= R.y + R.ry * 1.4; y += 8) {
        if (m.blocked(x, y) || m.roomAt(x, y) >= 0) continue;
        const n = Math.ceil(Math.hypot(x - R.x, y - R.y) / 4);
        let open = true;
        for (let s = 1; s <= n && open; s++) open = !m.blocked(R.x + ((x - R.x) * s) / n, R.y + ((y - R.y) * s) / n);
        if (open) spots.push({ x, y, door: Math.hypot(x - d.x, y - d.y) });
      }
    }
    spots.sort((a, b) => a.door - b.door);
    check(spots.length > 0, `${spots.length} points de l'antre hors de l'ellipse de sa salle`);
    for (const at of [spots[0], spots[spots.length - 1]]) {
      [p.x, p.y] = [at.x, at.y];
      r.tick = 0;
      r.clearEmptyCaves();
      check(!boss.dormant && r.map.arenaAt(p.x, p.y)?.id === lair.id, `seul debout à ${Math.round(at.door)} px de la herse : le combat continue`);
    }
    p.dead = true;
    r.tick = 0;
    r.clearEmptyCaves();
    check(boss.dormant && boss.hp === boss.maxHp, 'les deux à terre : il se rendort, guéri');
  });

  rule('Antre : quand la herse retombe, rien ne reste coincé dessous, et les monstres sauvages aux trousses d\'un dompteur de l\'antre entrent avec lui.', () => {
    const r = room(), m = r.map;
    const lair = m.caves.find((c: { room?: number }) => c.room !== undefined);
    const li = m.doors.findIndex((q: { lair: number }) => q.lair === lair.id), d = m.doors[li], R = m.rooms[lair.room];
    const boss = r.units.get(r.caveBoss[lair.id]);
    const inLair = (e: { x: number; y: number }) => m.arenaAt(e.x, e.y)?.id === lair.id;
    const l = Math.hypot(R.x - d.x, R.y - d.y), out = (k: number) => m.freeNear(d.x - ((R.x - d.x) / l) * k, d.y - ((R.y - d.y) / l) * k);
    const sal = SPECIES.findIndex((sp) => sp.key === 'salamander'), wolf = SPECIES.findIndex((sp) => sp.key === 'wolf');
    const p = r.addPlayer('a', noop);
    p.hp = 1e9;
    [p.x, p.y] = [boss.x, boss.y + boss.r + 40];
    const pet = r.createUnit(wolf, false, d.x, d.y); // sous la herse
    r.makeTamed(pet, p);
    const near = out(200), far = out(LAIR_PULL_R + 300);
    const chaser = r.createUnit(sal, false, near.x, near.y), idle = r.createUnit(sal, false, d.x, d.y), late = r.createUnit(sal, false, far.x, far.y);
    chaser.target = late.target = p.id;
    idle.target = 0;
    check(!inLair(chaser) && !inLair(late) && Math.hypot(late.x - d.x, late.y - d.y) > LAIR_PULL_R, 'avant le combat : deux poursuivants dans le couloir, l\'un tout près de la herse, l\'autre loin');
    r.onChallenge(p, lair.id);
    const free = (e: { x: number; y: number }) => m.doorAt(e.x, e.y) < 0 && !m.blocked(e.x, e.y);
    check(inLair(pet) && free(pet), 'le loup de la meute resté sous la herse rejoint son dompteur dans l\'antre');
    check(inLair(chaser) && free(chaser), 'la salamandre qui le poursuivait, tout près de la herse, entre avec lui');
    check(!inLair(idle) && free(idle), 'la salamandre qui ne poursuivait personne, sous la herse, est poussée dans le couloir (pas coincée)');
    check(!inLair(late), 'la salamandre restée loin dans le couloir reste dehors');
  });

  rule('Carte du donjon : le serveur garde les salles découvertes pour le village ; partir, laisser les salles se regarnir ou recharger le village ne les efface pas.', () => {
    const r = room(), m = r.map;
    const k = m.caves.find((c: { room?: number }) => c.room !== undefined).room, R = m.rooms[k];
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [R.x, R.y + R.ry * 0.5];
    r.tick = 0;
    r.updateExplored();
    check(r.depthsSeen.has(k), 'un dompteur dans une salle du donjon : elle est découverte pour le village');
    // tout le monde repart ; personne dans le donjon assez longtemps : les salles se regarnissent
    [p.x, p.y] = [m.village.x, m.village.y];
    r.time += DEPTHS_RESET_S + 10;
    r.tick = 0;
    r.updateDepths();
    check(r.depthsSeen.has(k), 'les salles se regarnissent : la carte, elle, reste');
    let saved: { depths: number[] } | undefined;
    r.onVillage = (v: { depths: number[] }) => {
      saved = v;
    };
    r.flushExplored();
    check(!!saved && saved.depths.includes(k), 'sauvegardée avec le village');
    const back = new Room('TEST', r.seed, saved);
    const msgs: { t: string; depths?: number[] }[] = [];
    back.addPlayer('b', (msg: { t: string; depths?: number[] }) => msgs.push(msg));
    check(back.depthsSeen.has(k) && !!msgs.find((msg) => msg.t === 'fog')?.depths?.includes(k), 'village rechargé : elle revient, et part aux dompteurs qui arrivent');
    const odd = new Room('TEST', r.seed, { depths: [-1, 9999, 1.5, k, k] });
    check(odd.depthsSeen.size === 1, 'une sauvegarde abîmée ne rajoute aucune salle imaginaire');
  });

  rule('Salamandre de braise : sauvage, elle sème la lave en courant et bondit sur sa cible dans une gerbe de braises.', () => {
    const r = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y];
    const u = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'salamander'), false, p.x + 150, p.y);
    const kinds = new Set<string>(), broadcast = r.broadcast.bind(r);
    r.broadcast = () => {
      for (const e of r.events) if (e.e === 'move' && e.id === u.id) kinds.add(e.kind);
      broadcast();
    };
    for (let i = 0; i < TICK_HZ * 60 && kinds.size < 2 && r.units.has(u.id); i++) {
      p.hp = 1e9;
      p.dead = false;
      r.step();
    }
    check(kinds.has('trail') && kinds.has('blink'), `en combat : ${[...kinds].join(', ') || 'aucune attaque spéciale'}`);
  });
  rule('Herse baissée : aucun chemin ne la traverse, et un monstre qui ne peut pas rejoindre sa cible la lâche au lieu de s\'écraser contre elle.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.updateDepths();
    const di = m.doors.findIndex((q: { lair: number }, i: number) => q.lair < 0 && m.doorShut[i]);
    const [ka, kb] = m.links[di], A = m.rooms[ka], B = m.rooms[kb];
    const from = m.freeNear(A.x, A.y), to = m.freeNear(B.x, B.y);
    // herse baissée : le chemin direct n'existe pas (ou fait le tour par d'autres salles, jamais par elle)
    const path = m.findPath(from.x, from.y, to.x, to.y);
    check(!path || !path.some((q: { x: number; y: number }) => m.doorAt(q.x, q.y) === di), `aucun point du chemin sous la herse ${di}`);
    // le sauvage garde une cible de l'autre côté (dernier agresseur) : pas de chemin, il la lâche
    const lava = SPECIES.findIndex((sp) => sp.zone === VOLCANO_ZONE && !sp.boss && !sp.minion);
    const near = m.freeNear(m.doors[di].x - m.doors[di].ux * 80, m.doors[di].y - m.doors[di].uy * 80);
    const w = r.createUnit(lava, false, near.x, near.y);
    // un dompteur de l'autre côté, sans que rien ne sépare les deux salles autrement
    for (const q of m.doorShut.keys()) if (q !== di) m.doorShut[q] = 1;
    const behind = m.freeNear(m.doors[di].x + m.doors[di].ux * 80, m.doors[di].y + m.doors[di].uy * 80);
    [p.x, p.y] = [behind.x, behind.y]; // juste derrière la herse : à portée de la cible, mais coupé d'elle
    w.target = w.lastAttacker = p.id;
    let moved = 0;
    for (let i = 0; i < TICK_HZ * 6; i++) {
      r.step();
      r.time += 1 / TICK_HZ;
      if (m.doorAt(w.x, w.y) === di) moved++;
    }
    check(moved === 0, `le monstre ne reste pas collé sous la herse (${moved} ticks dessous)`);
    check(w.target !== p.id, `il a lâché sa cible hors d'atteinte (cible ${w.target})`);
  });
  rule('Le bond de feu avec cratère est réservé à la Salamandre-Mère et à son légendaire : la salamandre ordinaire bondit sans cratère, et moins fort.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    r.units.clear();
    const p = r.addPlayer('a', noop);
    p.hp = 1e9;
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y];
    const sal = SPECIES.find((sp) => sp.key === 'salamander')!;
    const blinkOf = (moves: readonly { kind: string }[] | undefined) => moves?.find((mv) => mv.kind === 'blink') as { fire?: boolean; power?: number } | undefined;
    const queenBlink = blinkOf(BOSS_MOVES.salamander_queen);
    check(!!blinkOf(sal.moves) && !blinkOf(sal.moves)!.fire, 'la salamandre ordinaire garde son bond, mais sans cratère de feu');
    check((blinkOf(sal.moves)?.power ?? 1.3) < 1.3, `… et son explosion est plus faible (x${blinkOf(sal.moves)?.power ?? 1.3} au lieu de x1,3)`);
    check(!!queenBlink?.fire, 'la Salamandre-Mère, elle, bondit en laissant un cratère de feu');
    // en jeu : la variante ordinaire ne laisse aucun cratère, celle de la reine oui
    const craters = (mv: { kind: 'blink'; cd: number; fire?: boolean; power?: number }, key: string) => {
      const u = r.createUnit(SPECIES.findIndex((sp) => sp.key === key), false, p.x + 300, p.y);
      r.hazards = [];
      r.castMove(u, mv, p);
      r.time += 1;
      r.updateHazards();
      return r.hazards.filter((h: { style?: string }) => h.style === 'crater').length;
    };
    check(craters({ kind: 'blink', cd: 12, power: 0.9 }, 'salamander') === 0, 'bond de la salamandre ordinaire : pas de cratère');
    check(craters({ kind: 'blink', cd: 12, fire: true }, 'salamander_queen') === 1, 'bond de la Salamandre-Mère : un cratère de feu');
  });
  rule('La meute ne traverse pas une herse baissée : ni en marchant, ni en rejoignant son dompteur coincé, ni repoussée par un coup.', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = room(), m = r.map;
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [m.depths.exit.x, m.depths.exit.y - 40];
    r.tick = 0;
    r.updateDepths();
    const lava = SPECIES.findIndex((sp) => sp.zone === VOLCANO_ZONE && !sp.boss && !sp.minion);
    r.updateDepths = () => {}; // sans garnison, le donjon lèverait ses herses : on les garde baissées
    m.doorShut.fill(1); // tout est cloisonné : aucun détour possible
    const doors = m.doors.map((_: unknown, i: number) => i).filter((i: number) => m.doors[i].lair < 0).slice(0, 3);
    for (const di of doors) {
      const d = m.doors[di];
      for (const sign of [1, -1]) {
        r.units.clear();
        const at = (k: number, off: number) => m.freeNear(d.x + d.ux * off * k, d.y + d.uy * off * k);
        const mine = at(sign, 120), theirs = at(-sign, 60);
        [p.x, p.y] = [mine.x, mine.y];
        const pets = [0, 1, 2, 3, 4].map((k) => {
          const u = r.createUnit(lava, false, theirs.x + k * 6, theirs.y);
          r.makeTamed(u, p);
          return u;
        });
        const across = (u: { x: number; y: number }) => Math.sign((u.x - d.x) * d.ux + (u.y - d.y) * d.uy) === sign;
        let crossed = 0;
        for (let t = 0; t < TICK_HZ * 8; t++) {
          r.step();
          r.time += 1 / TICK_HZ;
          p.hp = p.maxHp;
          if (t === TICK_HZ * 3) r.knock(pets[0], theirs.x - d.ux * -sign * 30, theirs.y - d.uy * -sign * 30, 90); // un coup qui la pousse vers la herse
          for (const u of pets) if (across(u)) crossed++;
        }
        check(crossed === 0, `herse ${di}, dompteur à ${sign > 0 ? 'droite' : 'gauche'} : la meute reste de son côté (${crossed} passages)`);
      }
    }
  });
});
