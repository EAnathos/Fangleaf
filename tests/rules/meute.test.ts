// Meute et montures. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { SHORE_R, alphaCreateCost, RECALL_R, SPECIES, WORLD_HALF } from '../../shared/config.ts';

describe('Meute et montures', () => {
  rule('Rappel : trop loin du dompteur, la meute lâche sa cible et revient.', () => {
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
  });

  rule('Apprivoisé : moitié moins fort que sauvage.', () => {
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
  });

  rule('Essences : environ 35 % de drop par kill.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    for (let i = 0; i < 400; i++) {
      const w = r.createUnit(0, false, p.x + 40, p.y);
      r.killUnit(w, p);
      if (w.owner) r.units.delete(w.id);
    }
    const rate = p.essences[0] / 400;
    check(rate > 0.27 && rate < 0.43, `taux de drop d'essence : ${Math.round(rate * 100)} % (attendu ~35 %)`);
  });

  rule('Meute ordinaire sauvegardée avec la progression.', () => {
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
  });

  rule('Déconnecté : il dort au village, sa meute flâne autour (un monstre sur trois dort) ; il se réveille en revenant.', () => {
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
  });

  rule('Montures : monter sur un Alpha Loup, vitesse, partage des dégâts, désarçonné quand il tombe.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    p.x = r.map.den.x;
    p.y = r.map.den.y;
    p.essences[0] = alphaCreateCost(0);
    r.onAlphaCreate(p, 0);
    r.onCheat(p);
    r.step();
    const slimeAlpha = r.units.get(p.army[0]);
    r.onMount(p, slimeAlpha.id);
    check(p.mount === 0, 'un Alpha Gluant ne se chevauche pas');
    p.essences[1] = alphaCreateCost(1);
    r.onAlphaCreate(p, 1);
    r.onCheat(p);
    r.step();
    const wolf = r.units.get(p.army[1]);
    p.saddle = 0;
    r.onMount(p, wolf.id);
    check(p.mount === 0, 'sans selle (la forge en vend) : on ne monte pas');
    p.saddle = 1;
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
  });

  rule('Serpent des brumes en monture : seulement sur l\'eau, on embarque près de l\'eau, on descend au bord, on se noie s\'il tombe.', () => {
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
  });

  rule('Lièvre de la meute : il ne va pas au contact, il reste en retrait derrière son dompteur.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const at = r.map.freeNear(r.map.spineAt(r.map.zoneFrom(2) + 600).x, r.map.spineAt(r.map.zoneFrom(2) + 600).y);
    [p.x, p.y] = [at.x, at.y];
    p.hp = 1e6;
    const hare = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'hare'), false, p.x, p.y + 20);
    hare.owner = p.id;
    p.army.push(hare.id);
    const foe = r.createUnit(1, false, p.x + 120, p.y);
    foe.hp = foe.maxHp = 1e6;
    foe.speed = 0;
    for (let i = 0; i < 20 * 3; i++) r.step();
    check(foe.hp === foe.maxHp, 'il ne frappe pas l\'ennemi');
    check(hare.x < p.x && Math.hypot(hare.x - foe.x, hare.y - foe.y) > Math.hypot(p.x - foe.x, p.y - foe.y), 'il se tient derrière son dompteur, à l\'opposé de l\'ennemi');
  });

  rule("Combat de géant : la meute tanke et frappe le géant même si le dompteur s'éloigne ; seuls les passifs (lièvre, suricate, escargot) restent avec lui.", () => {
    const r = room();
    const key = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
    const c = r.map.caves.find((q: { room?: number }) => q.room === undefined);
    const boss = r.units.get(r.caveBoss[c.id]);
    const p = r.addPlayer('a', noop);
    p.armor = 10;
    [p.x, p.y] = [boss.x + 140, boss.y + 60];
    r.onChallenge(p, c.id);
    boss.speed = 0; // le géant ne bouge pas : on mesure la meute, pas la poursuite
    boss.maxHp = boss.hp = 1e9;
    const wolf = r.createUnit(key('wolf'), false, boss.x - 60, boss.y);
    r.makeTamed(wolf, p);
    wolf.maxHp = wolf.hp = 1e9;
    const hare = r.createUnit(key('hare'), false, boss.x - 60, boss.y + 30);
    r.makeTamed(hare, p);
    hare.maxHp = hare.hp = 1e9;
    // le dompteur recule loin du géant, bien au-delà du rappel
    let far = { x: boss.x, y: boss.y };
    for (let k = 0; k < 24; k++) {
      for (let d = 1100; d > 0; d -= 20) {
        const q = { x: boss.x + Math.cos((k * Math.PI) / 12) * d, y: boss.y + Math.sin((k * Math.PI) / 12) * d };
        if (r.map.arenaAt(q.x, q.y)?.id === c.id && !r.map.blocked(q.x, q.y)) {
          if (d > Math.hypot(far.x - boss.x, far.y - boss.y)) far = q;
          break;
        }
      }
    }
    check(Math.hypot(far.x - boss.x, far.y - boss.y) > RECALL_R + 20 && r.map.arenaAt(far.x, far.y)?.id === c.id, `le dompteur est dans l'arène, à plus que la distance de rappel du géant (${Math.round(Math.hypot(far.x - boss.x, far.y - boss.y))} px)`);
    [p.x, p.y] = [far.x, far.y];
    const hp0 = boss.hp;
    for (let i = 0; i < 20 * 6; i++) {
      p.hp = 99999;
      p.dead = false;
      boss.x = boss.x; // (immobile)
      r.step();
    }
    check(Math.hypot(wolf.x - boss.x, wolf.y - boss.y) < Math.hypot(wolf.x - p.x, wolf.y - p.y), `le loup reste sur le géant (à ${Math.round(Math.hypot(wolf.x - boss.x, wolf.y - boss.y))} px) au lieu de suivre son dompteur`);
    check(boss.hp < hp0, 'il frappe le géant pendant que le dompteur est loin');
    check(!wolf.recalling, "il n'est pas rappelé");
    check(Math.hypot(hare.x - p.x, hare.y - p.y) < 250 && Math.hypot(hare.x - boss.x, hare.y - boss.y) > Math.hypot(p.x - boss.x, p.y - boss.y) - 120, "le lièvre, passif, suit son dompteur au lieu de s'engager");
    // hors combat de géant : le rappel joue comme avant
    r.calmBoss(boss);
    wolf.recalling = false;
    [wolf.x, wolf.y] = [p.x - RECALL_R - 100, p.y];
    r.step();
    check(wolf.recalling, 'hors combat de géant, trop loin du dompteur : la meute est rappelée comme avant');
  });

  rule('Tréant de la meute : comme le golem avec la pierre, il abat les arbres alentour ; le bois revient à son dompteur.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const d = r.map.decor.find((x: { kind: number; x: number; y: number }) => x.kind === 0 && r.map.zoneAt(x.x, x.y) === 1 && !r.map.caveAt(x.x, x.y));
    const t = r.map.trunkOf(d);
    const at = r.map.freeNear(t.x + 70, t.y);
    [p.x, p.y] = [at.x, at.y];
    const tr = r.createUnit(SPECIES.findIndex((sp) => sp.key === 'treant'), false, at.x, at.y + 10);
    tr.owner = p.id;
    p.army.push(tr.id);
    const others = r.map.treesNear(t.x, t.y, 400).filter((i: number) => i !== d.id);
    for (const i of others) r.map.treeDown.add(i); // seul cet arbre à portée
    const w0 = p.wood;
    for (let i = 0; i < 20 * 15 && !r.map.treeDown.has(d.id); i++) {
      p.movedAt = r.time; // le dompteur ne coupe pas lui-même
      r.step();
    }
    check(r.map.treeDown.has(d.id) && p.wood > w0, `l'arbre tombe sous ses coups (+${p.wood - w0} bois pour son dompteur)`);
  });
});
