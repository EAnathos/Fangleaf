// Géants et grottes. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { alphaCreateCost, SHOT_KINDS, BOSS_HP_BONUS, BOSS_MOVES, BOSS_RESPAWN_S, CHEST_GOLD, caveUnlockCost, SPECIES } from '../../shared/config.ts';

describe('Géants et grottes', () => {
  rule('Grottes : entrer avec sa meute, mini-boss, âme, réapparition du boss.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    const c = r.map.caves[0];
    const perZone = [1, 2, 3, 4, 5, 6, 7, 8].map((z) => r.map.caves.filter((cv: { zone: number }) => cv.zone === z).length).join('');
    check(r.map.caves.length === 19 && perZone === '22233331' && r.map.caves.every((cv: { boss: number; zone: number }) => SPECIES[cv.boss].boss && SPECIES[cv.boss].zone === cv.zone),
      `19 grottes (${perZone} par zone : la 7e sous le volcan, la 8e en haute mer), un géant par espèce`);
    check(SPECIES.filter((sp) => !sp.boss && !sp.passive && sp.population).every((sp) => SPECIES.some((b) => b.boss && b.base === sp.key)), 'chaque espèce hostile a son géant (âme → Alpha légendaire ; sauf le Tréant, caché dans les arbres)');
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
    r.time += 2; // le passage d'entrée est loin
    [p.x, p.y] = [c.exit.x, c.exit.y];
    r.onCave(p, c.id, false);
    check(!r.map.caveAt(p.x, p.y) && Math.hypot(p.x - c.entrance.x, p.y - c.entrance.y) < 200, 'sortie : retour devant l\'entrée');
    r.onCave(p, c.id, true);
    check(!r.map.caveAt(p.x, p.y), 'double clic sur « Sortir » : on ne rentre pas aussitôt');

    // Âme → l'Alpha de l'espèce devient légendaire.
    [p.x, p.y] = [r.map.den.x, r.map.den.y];
    r.onAlphaCreate(p, c.boss);
    check(!p.awakening.has(c.boss), 'pas d\'Alpha de boss : l\'âme sert à l\'évolution');
    const base = SPECIES.findIndex((sp) => sp.key === SPECIES[c.boss].base);
    p.essences[base] = alphaCreateCost(base);
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
  });

  rule('Attaques spéciales : chaque géant combat un dompteur 25 s dans sa grotte.', () => {
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
  });

  rule('Géants : coup de balayage au corps à corps ; leurs renforts ne s\'apprivoisent pas.', () => {
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
  });

  rule('Renforts d\'un géant : ils disparaissent dès que plus aucun dompteur debout n\'est dans la grotte.', () => {
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
  });

  rule('Coup ordinaire d\'un géant : une seule cible, plus fort (deux pour la reine des Gluants et l\'ours) ; les zones, c\'est pour ses compétences.', () => {
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
  });

  rule('Un géant endormi ne se pousse pas : il reste au centre de sa grotte.', () => {
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
  });

  rule('Un archer qui recule en tirant se fait rattraper par les géants.', () => {
    const r = room();
    for (const c of r.map.caves) {
      if (SPECIES[c.boss].anchored) continue; // le Kraken ne quitte pas l'eau : ses coups de tentacule portent sur tout le pont
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
  });

  rule('Bond du Gluant Géant : il atterrit dans la zone annoncée, même si la cible s\'en est écartée.', () => {
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
  });

  rule('Géants des nouvelles espèces : salve en éventail et pluie de mortiers, esquivables.', () => {
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
  });

  rule('Œil des Ruines : ses traits traversent la meute ; son rayon runique poursuit sa cible en tournant.', () => {
    const S = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop), m = r.map;
    p.hp = 1e6;
    // un couloir dégagé : le géant, un loup de la meute, puis le dompteur, alignés
    let s = 3000, at = m.spineAt(s);
    const clear = (x: number, y: number) => [0, 40, 80, 120, 160, 200].every((d) => !m.blocked(x - d, y) && !m.isForest(x - d, y));
    while (!clear(at.x, at.y)) at = m.spineAt((s += 37));
    [p.x, p.y] = [at.x, at.y];
    const eye = r.createUnit(S('rune_eye'), false, p.x - 200, p.y + 28); // (ses traits partent de son œil, au-dessus de son centre)
    const wolf = r.createUnit(S('wolf'), false, p.x - 100, p.y);
    r.makeTamed(wolf, p);
    const shoot = (pierce: boolean) => {
      const hw = wolf.hp, hp = p.hp;
      r.shots = [];
      r.launch(eye, 'bolt', p.x, p.y + 28, 10, 280, 520, 0, pierce);
      for (let i = 0; i < 40; i++) {
        r.grid.clear();
        for (const e of [p, wolf]) r.grid.insert(e);
        r.updateShots();
      }
      return [hw - wolf.hp, hp - p.hp];
    };
    const [w1, p1] = shoot(false);
    check(w1 > 0 && p1 === 0, 'un trait ordinaire s\'arrête sur le premier monstre');
    const [w2, p2] = shoot(true);
    check(w2 > 0 && p2 > 0, `le trait de l'Œil traverse le loup (${w2}) et atteint le dompteur (${p2})`);
    check(BOSS_MOVES.rune_eye.some((mv) => mv.kind === 'volley' && mv.pierce), 'ses salves sont perçantes');
    // rayon : annoncé vers sa cible, il reste sur place et balaie quelques secondes
    const laser = BOSS_MOVES.rune_eye.find((mv) => mv.kind === 'laser');
    check(!!laser, 'il a un rayon runique');
    r.hazards = [];
    [p.x, p.y] = [eye.x + 220, eye.y];
    r.castMove(eye, laser, p);
    const beam = r.hazards.find((h: { style?: string }) => h.style === 'laser');
    check(beam && eye.castUntil > r.time + 3, 'un seul rayon ; le géant reste sur place pendant qu\'il le maintient');
    const hp = p.hp;
    r.time = beam.at;
    r.grid.clear();
    r.grid.insert(p);
    r.updateHazards();
    const aim = Math.atan2(beam.y2 - beam.y, beam.x2 - beam.x);
    check(Math.abs(aim) < 0.05, `il s'allume face à sa cible (${aim.toFixed(2)} rad)`);
    for (let i = 0; i < 20; i++) {
      r.time += 0.05;
      r.grid.clear();
      r.grid.insert(p);
      r.updateHazards();
    }
    check(p.hp < hp, 'pris dans le rayon : on brûle');
    const angle = () => Math.atan2(beam.y2 - beam.y, beam.x2 - beam.x);
    check(Math.abs(angle()) < 0.05, 'immobile, il reste dans le rayon : il ne le lâche pas');
    // on s'écarte d'un quart de tour : le rayon le poursuit, à sa vitesse de rotation (pas d'un coup)
    const tick = (n: number) => {
      for (let i = 0; i < n; i++) {
        r.time += 0.05;
        r.grid.clear();
        for (const e of [p, wolf]) r.grid.insert(e);
        r.updateHazards();
      }
    };
    [wolf.x, wolf.y] = [eye.x - 2000, eye.y]; // (le loup, lui, est hors de portée)
    [p.x, p.y] = [eye.x, eye.y + 220];
    tick(10);
    const half = angle();
    check(half > 0.35 && half < 0.55, `il tourne vers lui, à ${laser!.turn} rad/s (${half.toFixed(2)} rad en 0,5 s)`);
    tick(30);
    check(Math.abs(angle() - Math.PI / 2) < 0.05, 'puis il le rattrape et le suit');
    // plus personne à portée : il continue de balayer dans le même sens
    [p.x, p.y] = [eye.x + 2000, eye.y];
    [wolf.x, wolf.y] = [eye.x + 2000, eye.y + 40];
    const before = angle();
    tick(6);
    check(angle() - before > 0.2, 'personne à portée : il continue de tourner');
    while (r.time < eye.castUntil + 0.5) {
      r.time += 0.25;
      r.updateHazards();
    }
    check(!r.hazards.some((h: { style?: string }) => h.style === 'laser'), 'puis il s\'éteint');
  });

  rule('Géant endormi : ni cible ni menace tant qu\'on ne lui a pas parlé ; il se rendort quand la grotte se vide.', () => {
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
  });

  rule('Coffre du géant vaincu : chaque dompteur l\'ouvre une fois, pour un montant d\'or aléatoire.', () => {
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
  });

  rule('PV des géants : +20 %, multipliés par le nombre de membres du village (en ligne ou endormis au village), en gardant leur part de PV.', () => {
    const r = room();
    const boss = r.units.get(r.caveBoss[0]);
    const base = SPECIES[boss.s].hp * BOSS_HP_BONUS, near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const p = r.addPlayer('a', noop);
    check(BOSS_HP_BONUS === 1.2 && near(boss.maxHp, base) && near(boss.hp, base), `un dompteur : ${SPECIES[boss.s].name} à ${base} PV`);
    r.damage(boss, base / 2, p);
    r.addPlayer('b', noop);
    check(near(boss.maxHp, base * 2) && near(boss.hp, base), `deux dompteurs : PV doublés (${boss.hp}/${boss.maxHp}), toujours à moitié`);
    const q = r.addPlayer('c', noop);
    r.removePlayer(q.id);
    check(near(boss.maxHp, base * 3), 'un dompteur se déconnecte : il dort au village, il compte toujours (trois membres)');
    r.addSleeper('absent', { name: 'Absent', armor: 0, class: null, alphas: [], pack: [], stats: {} });
    check(near(boss.maxHp, base * 4), 'un membre déconnecté de plus (chargé au démarrage) : quatre membres');
    r.removeSleeper('absent');
    check(near(boss.maxHp, base * 3), 'un membre quitte le village : on revient à trois');
  });

  rule('grottes des dernières zones bien plus chères', () => {
    check(caveUnlockCost(1) === 150 && caveUnlockCost(3) === 450 && caveUnlockCost(4) === 1500 && caveUnlockCost(5) === 3000, 'grottes des dernières zones bien plus chères (1500 et 3000 or)');
  });
});
