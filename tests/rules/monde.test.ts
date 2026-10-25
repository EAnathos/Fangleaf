// Le monde : carte, obstacles, brume, météo. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { DESERT_ZONE, JUNGLE_ZONE, ZONES, CACTUS_CD, CACTUS_PRICK, mountSpeedOf, HALL_MAX, gateHall, gateOpen, zoneBosses, SPECIES, WORLD_HALF } from '../../shared/config.ts';
import { BEACH, villageEdge, WorldMap } from '../../shared/worldmap.ts';
import { sky } from '../../shared/weather.ts';
import { Room } from '../../server/room.ts';

describe('Le monde : carte, obstacles, brume, météo', () => {
  rule('Les 8 espèces apparaissent sur la carte, deux par zone.', () => {
    const r = room();
    const seen = new Set([...r.units.values()].map((u: { s: number }) => u.s));
    check(SPECIES.every((sp, i) => seen.has(i) || sp.night || (!sp.boss && !sp.population)), `les ${SPECIES.length} espèces (dont ${SPECIES.filter((sp) => sp.boss).length} géants) sont présentes au lancement (de jour, sauf les bêtes de nuit et le Tréant, caché dans les arbres)`);
    const zones = new Map<number, number>();
    for (const sp of SPECIES) if (!sp.boss && !sp.passive && sp.population) zones.set(sp.zone, (zones.get(sp.zone) ?? 0) + 1);
    check([1, 2, 3].every((z) => zones.get(z) === 2) && zones.get(4) === 3 && zones.get(5) === 3, 'deux espèces hostiles par zone, trois en zones 4 et 5');
  });

  rule('Carte générée : un long couloir depuis un bord (haut, droite ou bas), village sur son îlot, chemin et pont praticables.', () => {
    for (const seed of [1, 42, 777, 123456789]) {
      const m = new WorldMap(seed);
      const d = Math.hypot(m.village.x - m.spawn.x, m.village.y - m.spawn.y);
      const mid0 = { x: (m.bridge.a.x + m.bridge.b.x) / 2, y: (m.bridge.a.y + m.bridge.b.y) / 2 };
      check(m.blocked(mid0.x, mid0.y), `graine ${seed} : au départ, le pont est cassé (on ne passe pas)`);
      m.setBridge(true);
      let pathOk = true;
      // le long des chemins de terre (de la plage au pont, du pont à la porte), sur le pont, puis de la porte jusqu'au feu
      const lines = [...m.paths, [[m.bridge.a.x, m.bridge.a.y], [m.bridge.b.x, m.bridge.b.y]]];
      for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
          const [ax, ay] = line[i - 1], [bx, by] = line[i];
          for (let t = 0; t <= 1; t += 0.05) {
            const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
            if (Math.hypot(x - m.spawn.x, y - m.spawn.y) > 40 && m.blocked(x, y)) pathOk = false;
          }
        }
      }
      // un vrai îlot : de part et d'autre du milieu du pont, la mer ; le village et le pont, à l'abri
      const bm = { x: (m.bridge.a.x + m.bridge.b.x) / 2, y: (m.bridge.a.y + m.bridge.b.y) / 2 };
      const bl = Math.hypot(m.bridge.b.x - m.bridge.a.x, m.bridge.b.y - m.bridge.a.y), nx = -(m.bridge.b.y - m.bridge.a.y) / bl, ny = (m.bridge.b.x - m.bridge.a.x) / bl;
      const isle = [-1, 1].every((k) => m.isSea(bm.x + nx * k * 90, bm.y + ny * k * 90) && m.isWater(bm.x + nx * k * 90, bm.y + ny * k * 90)) && m.isSea(bm.x, bm.y) && !m.blocked(bm.x, bm.y);
      check(isle && bl >= 200 && m.onIsle(m.village.x, m.village.y) && m.onIsle(bm.x, bm.y) && !m.onIsle(m.spawn.x, m.spawn.y) && m.zoneAt(m.village.x, m.village.y) === 1,
        `graine ${seed} : village sur un îlot, relié par un pont de ${Math.round(bl)} px au-dessus de la mer`);
      check(m.arcAt(m.bridge.a.x, m.bridge.a.y) < m.gates[0] && m.arcAt(m.village.x, m.village.y) < m.gates[0], `graine ${seed} : le pont et le village avant la porte de la Lisière`);
      for (let t = 0; t <= 0.85; t += 0.01) {
        if (m.blocked(m.gate.x + (m.village.x - m.gate.x) * t, m.gate.y + (m.village.y - m.gate.y) * t)) pathOk = false;
      }
      let water = 0, n = 0;
      let lw = 0, ln = 0, dw = 0, dn = 0, jw = 0, jn = 0;
      for (let x = -WORLD_HALF + 20; x < WORLD_HALF; x += 80) {
        for (let y = -WORLD_HALF + 20; y < WORLD_HALF; y += 80) {
          if (m.isSea(x, y)) continue; // la mer ne compte pas : seulement les lacs de l'île
          const z = m.zoneAt(x, y);
          if (z === 5) ln++, lw += +m.isWater(x, y);
          else if (z === DESERT_ZONE) dn++, dw += +m.isWater(x, y);
          else if (z === JUNGLE_ZONE) jn++, jw += +m.isWater(x, y);
          else n++, water += +m.isWater(x, y);
        }
      }
      check(d >= 800 && !m.inVillage(m.spawn.x, m.spawn.y) && pathOk && water / n > 0.04 && water / n < 0.2 && lw / ln > 0.15 && dw / dn < 0.06 && jw / jn > water / n,
        `graine ${seed} : village à ${Math.round(d)} px de la plage, chemin libre, ${Math.round((100 * water) / n)} % de lacs (zone 5 : ${Math.round((100 * lw) / ln)} %, jungle : ${Math.round((100 * jw) / jn)} % de marigots, désert : ${Math.round((100 * dw) / dn)} % d'oasis)`);
      const sh = m.shoreAt(m.spawn.x, m.spawn.y), seaNear = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => m.isSea(m.spawn.x + Math.cos(k * 0.785) * 450, m.spawn.y + Math.sin(k * 0.785) * 450));
      check(sh < 0 && sh > -BEACH * 2 && seaNear && !m.blocked(m.spawn.x, m.spawn.y), `graine ${seed} : arrivée sur la plage, la mer à deux pas (${Math.round(-sh)} px de l'eau)`);
      let edgeSea = true;
      for (let k = -WORLD_HALF; k < WORLD_HALF; k += 200) for (const [x, y] of [[k, -WORLD_HALF + 100], [k, WORLD_HALF - 100], [-WORLD_HALF + 100, k], [WORLD_HALF - 100, k]]) if (!m.isForest(x, y)) edgeSea = false;
      check(edgeSea, `graine ${seed} : une île, la mer profonde tout autour`);
      const site = m.sites[0], stone = m.stones[1];
      const reach = m.findPath(m.village.x, m.village.y + 40, stone.x, stone.y + 50, 500000);
      const zones = [1, 2, 3, 4, 5, 6, 7].map((z) => { const q = m.spineAt((m.zoneFrom(z) + m.zoneTo(z)) / 2); return m.zoneAt(q.x, q.y); }).join('');
      const end = m.spineAt(m.length - 250);
      const reachEnd = m.findPath(stone.x, stone.y + 50, end.x, end.y, 600000);
      check(m.sites.length === 1 && m.zoneAt(site.x, site.y) === 4 && !!reach && !!reachEnd && zones === '1234567' && m.caves.filter((c) => c.zone <= ZONES).length === 18 && m.caves.filter((c) => c.zone === ZONES + 1).length === 3 && m.caves.filter((c) => c.zone === ZONES + 2).length === 1,
        `graine ${seed} : île de ${m.length} px de long, zones ${zones} de plus en plus loin de la plage, camp au bout de la zone 4, bout de l'île (Mer de sable) atteignable, 18 grottes sur l'île (dont 3 temples dans la jungle) et 3 antres sous le volcan`);
      const mid = m.length / 2, c = m.spineAt(mid), nv = m.normalAt(mid), far = m.halfWidth(mid) + 1700;
      let shallow = false;
      for (let x = -WORLD_HALF + 50; x < WORLD_HALF && !shallow; x += 120) for (let y = -WORLD_HALF + 50; y < WORLD_HALF && !shallow; y += 120) shallow = m.isSea(x, y) && m.isWater(x, y);
      check([-1, 1].every((k) => m.isForest(c.x + nv.x * far * k, c.y + nv.y * far * k) && m.blocked(c.x + nv.x * far * k, c.y + nv.y * far * k)) && shallow,
        `graine ${seed} : mer profonde infranchissable de part et d'autre, mer peu profonde le long de la côte (le serpent y nage)`);
    }
    {
      // Eau propre : ni flaque isolée, ni lac minuscule, ni poche de mer enclavée, ni îlot minuscule.
      const m = new WorldMap(4242) as unknown as { water: Uint8Array; shore: Int16Array };
      const n = Math.sqrt(m.water.length), wet = (k: number) => m.water[k] === 1 || m.water[k] === 3;
      const seen = new Uint8Array(n * n), small: number[] = [];
      let lone = 0;
      for (let s = 0; s < n * n; s++) {
        if (seen[s]) continue;
        const w = wet(s), st = [s];
        let size = 0, ocean = false;
        seen[s] = 1;
        while (st.length) {
          const k = st.pop()!, i = k % n;
          size++;
          if (m.water[k] === 3) ocean = true;
          for (const nk of [i > 0 ? k - 1 : -1, i < n - 1 ? k + 1 : -1, k - n, k + n]) {
            if (nk < 0 || nk >= n * n) { ocean = true; continue; }
            if (!seen[nk] && wet(nk) === w) (seen[nk] = 1), st.push(nk);
          }
        }
        if ((w && !ocean && size < 40) || (!w && size < 40)) small.push(size);
      }
      for (let k = n + 1; k < n * n - n - 1; k++) {
        if (m.water[k] !== 1) continue;
        let c = 0;
        for (const d of [-n - 1, -n, -n + 1, -1, 1, n - 1, n, n + 1]) c += +wet(k + d);
        if (c === 0) lone++;
      }
      check(!small.length && !lone, `carte nettoyée : ni flaque isolée, ni lac ou îlot minuscule (${small.length} trop petits, ${lone} cases d'eau seules)`);
    }
    const a = new WorldMap(99), b = new WorldMap(99);
    check(a.village.x === b.village.x && a.sites[0].x === b.sites[0].x && a.isWater(500, 500) === b.isWater(500, 500) && a.zoneAt(2000, -1500) === b.zoneAt(2000, -1500), 'carte déterministe');
    const r = room();
    check(![...r.units.values()].some((u: { s: number; x: number; y: number }) => !SPECIES[u.s].swim && !SPECIES[u.s].anchored && r.map.blocked(u.x, u.y)), 'aucun monstre dans l\'eau (sauf les serpents et le Kraken)');
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
  });

  rule('Obstacles : arbres et palissade bloquent, les portes laissent passer.', () => {
    const m = new WorldMap(42);
    const tree = m.decor.find((d) => d.kind === 0)!;
    check(m.blocked(tree.x, tree.y + m.decorSize(tree) * 0.15), `les arbres bloquent (${m.decor.filter((d) => d.kind === 0).length} arbres)`);
    const v = m.village, wall = (a: number) => ({ x: v.x + Math.cos(a) * villageEdge(a), y: v.y + Math.sin(a) * villageEdge(a) });
    check(!m.blocked(wall(0.7).x, wall(0.7).y), 'palissade pas encore construite : on passe');
    m.setPalisade(true);
    check([0.7, 2.2, 3.9, 5.3].every((a) => m.blocked(wall(a).x, wall(a).y)), 'construite, la palissade bloque (tout le long de son contour, qui n\'est pas rond)');
    check(Math.max(villageEdge(0), villageEdge(Math.PI)) > 1.25 * villageEdge(Math.PI / 2), `pas ronde : plus large d'est en ouest (${Math.round(villageEdge(0))} px) que du nord au sud (${Math.round(villageEdge(Math.PI / 2))} px)`);
    check([0, 1, 2, 3].every((g) => !m.blocked(wall((g * Math.PI) / 2).x, wall((g * Math.PI) / 2).y)), 'les 4 portes laissent passer');
    check(!m.blocked(m.forge.x, m.forge.y + 70) && !m.blocked(m.den.x, m.den.y + 70), 'on peut approcher de la forge et de la tanière');
    check(m.blocked(m.forge.x - 40, m.forge.y) && m.blocked(m.market.x, m.market.y + 10), 'la forge et les huttes sont solides');
    // les bâtiments tiennent dans la palissade, à l'écart des quatre routes
    const boxes = [[m.forge, 80, 44], [m.den, 84, 50], [m.market, 58, 46], [m.hall, 64, 56], [m.store, 44, 40], [m.board, 30, 54], [m.school, 54, 96], [m.stones[0], 24, 60]] as const;
    const inside = boxes.every(([b, w, h]) => [[-w, -h], [w, -h], [-w, 12], [w, 12]].every(([dx, dy]) => m.inVillage(b.x + dx, b.y + dy, -30)));
    const offRoads = boxes.every(([b, w]) => Math.abs(b.x - v.x) > w + 26 && Math.abs(b.y - v.y) > 40);
    check(inside && offRoads, 'chaque bâtiment tient dans la palissade, hors des routes qui mènent aux portes');
  });

  rule('Recherche de chemin : contourner la palissade par une porte au lieu de foncer dans le mur.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const v = r.map.village;
    const e = villageEdge(0.75);
    [p.x, p.y] = [v.x + Math.cos(0.75) * (e - 110), v.y + Math.sin(0.75) * (e - 110)]; // dans le village, près du mur
    const out = r.map.freeNear(v.x + Math.cos(0.75) * (e + 110), v.y + Math.sin(0.75) * (e + 110)); // juste derrière le mur
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
  });

  rule('Courbe des monstres : chaque zone nettement plus dure que la précédente.', () => {
    const main = SPECIES.slice(0, 4); // espèce principale de chaque zone
    const ok = main.every((s, i) => i === 0 || (s.hp >= main[i - 1].hp * 1.8 && s.dmg >= main[i - 1].dmg * 1.75));
    check(ok, `progression des monstres : ${main.map((s) => `${s.hp}/${s.dmg}`).join(' → ')}`);
  });

  rule('Ordre des espèces figé : leur index sert dans les sauvegardes (essences, Alphas). On n\'ajoute qu\'à la fin.', () => {
    const order = 'slime wolf boar golem sporelin spider bear wisp slime_queen shadow_fang old_tusk moss_heart spore_giant weaver colossus old_flame watcher toad serpent crab rune_eye toad_king mist_hydra titan_crab hare snail firefly meerkat sandworm vulture jackal sand_queen vulture_king moon_jackal treant salamander ash_bat lava_tortoise salamander_queen ash_lord mountain_tortoise kraken_tentacle kraken gorilla croc masked gorilla_king croc_king mask_lord';
    check(SPECIES.map((sp) => sp.key).join(' ') === order, `ordre des ${SPECIES.length} espèces inchangé (sauvegardes intactes)`);
  });

  rule('Jungle (zone 6) puis Mer de sable (zone 7) : chaque porte demande son niveau d\'Hôtel de ville et les parchemins des géants de la zone d\'avant.', () => {
    const z5 = zoneBosses(5), zj = zoneBosses(JUNGLE_ZONE), z7 = zoneBosses(DESERT_ZONE);
    check(gateHall(5) === 6 && !gateOpen(5, 6, []) && gateOpen(5, 6, z5) && !gateOpen(5, 5, z5) && zj.length === 3,
      `porte de la Jungle : Hôtel de ville niv. 6 et les ${z5.length} géants des Lacs ; ${zj.length} géants dans leurs temples`);
    check(gateHall(6) === 7 && HALL_MAX >= 7 && !gateOpen(6, 7, z5) && gateOpen(6, 7, zj) && !gateOpen(6, 6, zj) && z7.length === 3,
      `porte de la Mer de sable : Hôtel de ville niv. 7 et les géants de la Jungle ; ${z7.length} géants dans le désert`);

    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const p = r.addPlayer('dune', noop);
    const key = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
    // Ver des sables : sous le sable, intouchable ; arrivé sous sa cible, sortie annoncée, puis exposé et frappable.
    const spot = r.map.freeNear(r.map.spineAt((r.map.zoneFrom(DESERT_ZONE) + r.map.zoneTo(DESERT_ZONE)) / 2).x, r.map.spineAt((r.map.zoneFrom(DESERT_ZONE) + r.map.zoneTo(DESERT_ZONE)) / 2).y);
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
    check(r.map.dens.length >= 3 && r.map.dens.every((d: { x: number; y: number }) => r.map.zoneAt(d.x, d.y) === DESERT_ZONE), `${r.map.dens.length} tanières de suricates dans la Mer de sable`);
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
  });

  rule('Brume : rien n\'apparaît au-delà de la première porte fermée, ni d\'espèce d\'une zone encore fermée.', () => {
    const r: any = new Room('TEST', undefined, { hall: 2 }); // porte du village ouverte, Bois profonds fermés (géants invaincus)
    const fog = r.map.gates[1];
    const wild = [...r.units.values()].filter((u: { owner: number; s: number }) => !u.owner && !SPECIES[u.s].boss);
    check(wild.length > 50 && wild.every((u: { x: number; y: number; s: number }) => r.map.zoneArc(u.x, u.y) < fog && SPECIES[u.s].zone === 1),
      `zone 2 sous la brume : ${wild.length} monstres, tous de la zone 1 et en deçà de la brume`);
  });

  rule('Tempête de sable : elle blesse dehors dans la Mer de sable ; vers sous le sable, vautours très haut, suricates cachés.', () => {
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
    const q = r.map.freeNear(r.map.spineAt((r.map.zoneFrom(DESERT_ZONE) + r.map.zoneTo(DESERT_ZONE)) / 2).x, r.map.spineAt((r.map.zoneFrom(DESERT_ZONE) + r.map.zoneTo(DESERT_ZONE)) / 2).y);
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

    // cactus : s'y frotter pique (pas les palmiers de la lisière verte)
    const cactus = r.map.decor.find((d: { kind: number }) => r.map.isCactus(d));
    check(!!cactus && r.map.decor.some((d: { kind: number; x: number; y: number }) => d.kind === 0 && r.map.styleZone(d.x, d.y) === DESERT_ZONE && !r.map.isCactus(d)), 'des cactus dans le désert, des palmiers au bord de l\'eau');
    const trunk = r.map.trunkOf(cactus);
    Date.now = realNow;
    [p.x, p.y, p.hp] = [trunk.x + trunk.r + p.r + 2, trunk.y, 1000];
    p.maxHp = 1000;
    r.cactusDamage();
    const pricked = 1000 - p.hp;
    check(pricked > 0 && pricked <= Math.ceil(2000 * CACTUS_PRICK), `contre un cactus : il pique (${pricked} PV, ${CACTUS_PRICK * 100} % des PV max)`);
    r.cactusDamage();
    check(1000 - p.hp === pricked, `pas à chaque tick : au plus toutes les ${CACTUS_CD} s`);
    r.time += CACTUS_CD;
    r.cactusDamage();
    check(1000 - p.hp > pricked, 'resté collé : il pique encore');
    [p.x, p.y, p.hp] = [trunk.x + trunk.r + p.r + 80, trunk.y, 1000];
    r.time += CACTUS_CD;
    r.cactusDamage();
    const other = r.map.treesNear(p.x, p.y, p.r + 10).some((i: number) => r.map.isCactus(r.map.decor[i]));
    check(other || p.hp === 1000, 'à distance, rien');

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
  });
});
