// Le volcan de la Mer de sable : sa bouche, ses entrailles (zone 7), leurs géants et le cœur volcanique. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop, ALL_CAVES } from '../helpers.ts';
import { BOAT_REACH, BOAT_STAGES, boatReady, BUILDING_IDS, HALL_MAX, HEART_IN_BOAT, HEART_REACH, HEART_TAKEN, SPECIES, VOLCANO_R, VOLCANO_RY, VOLCANO_ZONE, ZONES, zoneBosses } from '../../shared/config.ts';
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
    check(m.zoneTo(ZONES) - m.zoneFrom(ZONES) > 1.5 * (m.zoneTo(ZONES - 1) - m.zoneFrom(ZONES - 1)), 'la Mer de sable est bien plus longue que les autres zones');
  });

  rule('Les entrailles : une grande salle de la zone 7, ses mares de lave, trois antres de géants.', () => {
    const m = room().map, d = m.depths, h = d.inside;
    check(m.caveAt(h.x + 300, h.y + 200) === d && m.zoneAt(h.x + 300, h.y + 200) === VOLCANO_ZONE, 'la salle est la zone 7');
    check(m.blocked(h.x, h.y) && !m.blocked(h.x + 120, h.y + 60), 'l\'autel du cœur, au centre, et on tourne autour');
    check(m.lavaPools.length >= 5 && m.lavaPools.every((p: { x: number; y: number }) => m.blocked(p.x, p.y)), `${m.lavaPools.length} mares de lave, infranchissables`);
    const lairs = m.caves.filter((c: { zone: number }) => c.zone === VOLCANO_ZONE);
    check(lairs.length === zoneBosses(VOLCANO_ZONE).length && lairs.length === 3, 'trois antres, un par géant du volcan');
    for (const c of lairs) {
      check(m.caveAt(c.entrance.x, c.entrance.y) === d && !m.blocked(c.entrance.x, c.entrance.y + 70), `antre de ${SPECIES[c.boss].name} : son entrée est dans la salle, dégagée`);
      // de la sortie à l'autel, puis de l'autel à l'antre : aucune mare de lave en travers (on contourne l'autel)
      const clear = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        for (let t = 0; t <= 1; t += 0.02) {
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          if (Math.hypot(x - h.x, y - h.y) > 90 && m.blocked(x, y)) return false;
        }
        return true;
      };
      check(clear(d.exit, h) && clear(h, { x: c.entrance.x, y: c.entrance.y + 70 }), '… et on y va depuis la sortie de la salle, sans mare de lave en travers');
    }
    check(m.blocked(d.exit.x, d.exit.y + 400), 'hors de la salle : la roche');
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

  rule('Les créatures de lave n\'apparaissent que dans les entrailles, une fois le volcan ouvert.', () => {
    const r = room(), m = r.map;
    r.units.clear();
    const lava = SPECIES.map((sp, i) => (sp.zone === VOLCANO_ZONE && !sp.boss ? i : -1)).filter((i) => i >= 0);
    check(lava.length === 3, 'trois espèces dans les entrailles');
    for (const s of lava) for (let k = 0; k < 5; k++) r.spawnPack(s);
    const wild = [...r.units.values()].filter((u: { s: number; owner: number }) => lava.includes(u.s) && !u.owner);
    check(wild.length > 0 && wild.every((u: { x: number; y: number }) => m.caveAt(u.x, u.y) === m.depths && !m.blocked(u.x, u.y)), `${wild.length} créatures de lave, toutes dans la salle`);
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
    check(r.bossCount() === r.map.caves.filter((c: { zone: number }) => c.zone <= ZONES).length, 'les géants du volcan ne comptent pas dans les souvenirs du vieil homme');
    check(!r.scrollCaves(p).some((id: number) => r.map.caves[id].zone === VOLCANO_ZONE), 'ils ne laissent pas de parchemin');
  });
});
