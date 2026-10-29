// Faune : tireurs, gibier, baies, bestiaire. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { DT, mountSpeedOf, BERRIES_PICKED, fruitTameChance, BUSH_REGROW_S, SPECIES } from '../../shared/config.ts';
import { DAY_MS, SEASON_MS, season, sky, WINTER } from '../../shared/weather.ts';

describe('Faune : tireurs, gibier, baies, bestiaire', () => {
  rule('Tireurs : charge visible, projectile esquivable, tir en cloche annoncé, serpent qui reste dans l\'eau.', () => {
    const S = (k: string) => SPECIES.findIndex((sp) => sp.key === k);
    const setup = (key: string) => {
      const r = room();
      r.units.clear();
      const p = r.addPlayer('a', noop);
      // un endroit dégagé du couloir : rien entre le tireur et le dompteur (un arbre arrêterait le tir)
      // (le tir part un peu au-dessus du tireur : on vérifie une bande, pas une ligne)
      const clear = (x0: number, y0: number) =>
        Array.from({ length: 23 }, (_, i) => i / 22).every((f) => [0, -12, -24].every((dy) => !r.map.blocked(x0 - 220 * f, y0 + dy)));
      // dans les Lacs brumeux (zone des tireurs) : pas dans la Mer de sable, où une tempête blesserait le dompteur
      const lo = r.map.zoneFrom(5) + 300, hi = r.map.zoneTo(5) - 300;
      let spot = r.map.freeNear(r.map.spineAt(lo).x, r.map.spineAt(lo).y);
      for (let s = lo; s < hi && !clear(spot.x, spot.y); s += 150) spot = r.map.freeNear(r.map.spineAt(s).x, r.map.spineAt(s).y);
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
          // un point libre bien hors du cercle annoncé (freeNear seul peut retomber dedans quand l'eau ou un arbre gêne)
          const out = s.splash + p.r + 60;
          for (let k = 0; k < 24 && !dodged; k++) {
            const a = (k / 24) * Math.PI * 2, x = s.tx + Math.cos(a) * out, y = s.ty + Math.sin(a) * out;
            if (r.map.blocked(x, y)) continue;
            [p.x, p.y] = [x, y];
            dodged = true;
          }
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
    {
      // une monture qui tire (le gorille) vise de loin, sous son cavalier
      const { r, p, w } = setup('gorilla');
      r.units.delete(w.id);
      const g = r.createUnit(S('gorilla'), true, p.x, p.y);
      g.owner = p.id;
      p.army.push(g.id);
      p.mount = g.id;
      const foe = r.createUnit(S('golem'), false, p.x + 230, p.y);
      foe.hp = foe.maxHp = 1e6;
      foe.speed = 0;
      run(r, 4);
      check(foe.hp < 1e6, 'gorille monté : il bombarde de bananes les sauvages à distance');
    }
    {
      // le crocodile sauvage sort de l'eau pour attaquer ce qui passe sur la berge, puis y retourne
      const r = room();
      r.units.clear();
      const p = r.addPlayer('a', noop);
      p.hp = 1e6;
      let bank: { x: number; y: number } | null = null, water: { x: number; y: number } | null = null;
      for (let z = r.map.zoneFrom(6); z < r.map.zoneTo(6) && !water; z += 60) {
        const at = r.map.freeNear(r.map.spineAt(z).x, r.map.spineAt(z).y), wt = r.map.waterNear(at.x, at.y, 260);
        if (wt && Math.hypot(wt.x - at.x, wt.y - at.y) > 120) [bank, water] = [at, wt];
      }
      check(bank && water, 'un marigot de la Jungle, près d\'une berge');
      const c = r.createUnit(S('croc'), false, water!.x, water!.y);
      [c.homeX, c.homeY] = [c.x, c.y];
      // sur la berge, à portée de ses yeux
      const k = 160 / Math.hypot(bank!.x - water!.x, bank!.y - water!.y);
      [p.x, p.y] = [water!.x + (bank!.x - water!.x) * k, water!.y + (bank!.y - water!.y) * k];
      check(!r.map.isWater(p.x, p.y), 'le dompteur est bien sur la terre ferme');
      let landed = false;
      run(r, 6, () => void (landed ||= !r.map.isWater(c.x, c.y)));
      check(landed && p.hp < 1e6, `il sort de l'eau pour mordre le dompteur sur la berge (${landed}, ${Math.round(p.hp)}, à ${Math.round(Math.hypot(c.x - p.x, c.y - p.y))} px)`);
      [p.x, p.y] = [p.x + (p.x - water!.x) * 5, p.y + (p.y - water!.y) * 5]; // le dompteur s'en va (pas trop loin : le crocodile reste éveillé)
      run(r, 15);
      check(r.map.isWater(c.x, c.y), `plus de proie : il regagne son eau (à ${Math.round(Math.hypot(c.x - c.homeX, c.y - c.homeY))} px de chez lui, cible ${c.target}, retour ${c.returning}, dompteur à ${Math.round(Math.hypot(c.x - p.x, c.y - p.y))} px)`);
    }
  });

  rule('Gibier passif : il n\'attaque jamais, mange aux buissons à fruits et fuit qui le frappe.', () => {
    const r = room();
    const s = SPECIES.findIndex((sp) => sp.passive);
    // en plein jour : la nuit, le lièvre dort
    const realNow = Date.now, t0 = realNow();
    let day = t0;
    for (let t = t0; t < t0 + DAY_MS && sky(r.seed, day).light < 1; t += 10_000) day = t;
    Date.now = () => day;
    // un buisson dans un coin dégagé (le lièvre doit pouvoir y aller puis s'enfuir)
    const open = (x: number, y: number) => [0, 1, 2, 3, 4, 5, 6, 7].every((k) => !r.map.blocked(x + Math.cos(k) * 160, y + Math.sin(k) * 160)) && !r.map.blocked(x, y);
    const bush = r.map.bushes.find((b: { x: number; y: number; zone: number }) => b.zone <= 3 && open(b.x + 120, b.y) && r.map.clearLine(b.x + 120, b.y, b.x, b.y + 14))!; // loin du désert (et de ses tempêtes)
    check(r.map.bushes.length > 40, `${r.map.bushes.length} buissons à fruits sur la carte`);
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id); // seuls le lièvre et le dompteur
    const hare = r.createUnit(s, false, bush.x + 120, bush.y);
    const p = r.addPlayer('a', noop);
    [p.x, p.y] = [hare.x + 260, hare.y]; // assez loin : il ne détale pas devant le dompteur
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
    [hare.x, hare.y] = [bush.x + 120, bush.y];
    [p.x, p.y] = [hare.x + 30, hare.y]; // il s'enfuira vers le buisson, par le coin dégagé
    r.damage(hare, 1, p);
    const d0 = Math.hypot(hare.x - p.x, hare.y - p.y);
    for (let i = 0; i < 20; i++) r.step(), (p.atkCd = 999);
    check(Math.hypot(hare.x - p.x, hare.y - p.y) > d0 + 60, 'frappé, il s\'enfuit');
    // Il détale devant un dompteur qui approche les mains vides ; un fruit à la main, il vient à lui.
    r.time += 10; // il a oublié le coup
    [hare.x, hare.y] = [bush.x + 120, bush.y];
    [p.x, p.y] = [hare.x + 100, hare.y];
    r.bushBack[bush.id] = r.time + 999; // plus de fruits : il ne file pas au buisson
    for (let i = 0; i < 20; i++) r.step(), (p.atkCd = 999);
    check(Math.hypot(hare.x - p.x, hare.y - p.y) > 160, 'approché les mains vides : il détale');
    [hare.x, hare.y] = [bush.x + 120, bush.y];
    [p.x, p.y] = [hare.x + 100, hare.y];
    p.fruits = 3;
    r.onHold(p, true);
    for (let i = 0; i < 20; i++) r.step(), (p.atkCd = 999);
    check(Math.hypot(hare.x - p.x, hare.y - p.y) < 100, 'un fruit à la main : il vient à lui');
    Date.now = realNow;
  });

  rule('Lucioles : gibier passif de la zone 2 qui n\'apparaît que la nuit, et s\'en va au lever du jour (loin des dompteurs).', () => {
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

    // Le lièvre dort la nuit, l'ours le jour (même un dompteur collé à lui) ; un coup les réveille.
    // Le sanglier, bête de nuit, reste éveillé ; les suricates passent la nuit dans leur tanière.
    Date.now = () => night;
    r.tick = 0;
    r.updateSpawns();
    const wildOf = (key: string) => {
      const s = SPECIES.findIndex((sp) => sp.key === key);
      return [...r.units.values()].find((u: any) => u.s === s && !u.owner) ?? r.createUnit(s, false, r.map.village.x + 900, r.map.village.y);
    };
    const bear = wildOf('bear'), hare = wildOf('hare'), boar = wildOf('boar');
    const p = r.addPlayer('nuit', noop);
    r.time += 30;
    r.wildAI(bear);
    r.wildAI(hare);
    r.wildAI(boar);
    check(hare.asleep && !bear.asleep && !boar.asleep, 'la nuit, le lièvre dort ; l\'ours et le sanglier sont éveillés');
    const meerkat = wildOf('meerkat');
    r.players.clear();
    meerkat.surfaceUntil = 0;
    for (let i = 0; i < 400 && !meerkat.hidden; i++) r.wildAI(meerkat), (r.time += DT);
    check(meerkat.hidden, 'la nuit, le suricate dort dans sa tanière');
    r.players.set(p.id, p);
    Date.now = () => day;
    r.tick = 0;
    r.updateSpawns();
    r.time += 60;
    [p.x, p.y] = [bear.x + 30, bear.y];
    r.wildAI(bear);
    r.wildAI(hare);
    check(bear.asleep && bear.target === 0 && !hare.asleep, 'le jour, l\'ours dort (il ignore le dompteur à côté), le lièvre est réveillé');
    r.damage(bear, 1, p, true);
    r.wildAI(bear);
    check(!bear.asleep && bear.target === p.id, 'frappé, l\'ours se réveille et s\'en prend au dompteur');

    // Escargot : il rentre dans sa coquille (intouchable) si un dompteur s'approche sans fruit en main, et file sous la pluie.
    const snail = wildOf('snail');
    r.players.set(p.id, p);
    [p.x, p.y, p.holding] = [snail.x + 60, snail.y, false];
    r.wildAI(snail);
    check(snail.hidden && !r.isWild(snail) && !r.isFeedable(snail), 'dompteur sans fruit tout près : l\'escargot rentre dans sa coquille');
    [p.fruits, p.holding] = [5, true];
    r.time += 5;
    r.wildAI(snail);
    check(snail.hidden && !r.isFeedable(snail), 'apeuré : même un fruit à la main, il reste dans sa coquille (pas de fruit à lui donner)');
    [p.x, p.y] = [snail.x + 400, snail.y];
    r.wildAI(snail);
    r.time += 5;
    r.wildAI(snail);
    check(!snail.hidden, 'on s\'éloigne : il ressort de sa coquille');
    [p.x, p.y] = [snail.x + 60, snail.y];
    r.wildAI(snail);
    check(!snail.hidden && r.isFeedable(snail), 'on revient doucement, un fruit à la main : il reste dehors');
    r.rain = 1;
    r.wildAI(snail);
    check(snail.speed === SPECIES[snail.s].speed * 1.5, `sous la pluie, il va plus vite (${snail.speed} px/s)`);
    r.rain = 0;
    r.wildAI(snail);
    check(snail.speed === SPECIES[snail.s].speed, 'au sec, il reprend son allure');
    Date.now = realNow;
  });

  rule('Baies : cueillies aux buissons ; fruit tendu, le gibier passif s\'approche et chaque fruit peut l\'apprivoiser.', () => {
    const r = room();
    for (const u of [...r.units.values()]) if (!u.owner) r.units.delete(u.id);
    const snail = SPECIES.findIndex((sp) => sp.key === 'snail'), hare = SPECIES.findIndex((sp) => sp.key === 'hare');
    check(SPECIES[snail].zone === 1 && !!SPECIES[snail].passive && SPECIES[hare].zone === 3 && SPECIES[hare].zone === SPECIES[2].zone, 'escargot passif en zone 1, lièvre dans la zone des sangliers et des ours');
    const p = r.addPlayer('a', noop);
    const bush = r.map.bushes.find((b: { zone: number }) => b.zone === 1) ?? r.map.bushes[3]; // dans la Lisière, chez l'escargot (pas sous une tempête de sable)
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
  });

  rule('Bestiaire : une espèce croisée y entre (pas les géants), et c\'est sauvegardé.', () => {
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
  });

  rule('Vautour de la meute : il suit en volant et attaque les vautours sauvages en plein vol.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    p.hp = 1e6;
    const vulture = SPECIES.findIndex((sp) => sp.key === 'vulture');
    const mine = r.createUnit(vulture, false, p.x + 40, p.y);
    r.makeTamed(mine, p);
    mine.hp = mine.maxHp = 1e6;
    const wild = r.createUnit(vulture, false, p.x + 160, p.y);
    wild.hidden = true; // en vol, hors d'atteinte du sol
    const hp0 = wild.hp;
    for (let i = 0; i < 20 * 6; i++) {
      [wild.hidden, wild.emerging, wild.diveAt] = [true, false, r.time + 99]; // il reste en l'air, sans piquer
      r.step();
    }
    check(wild.hp < hp0 || !r.units.has(wild.id), `le vautour sauvage, en plein vol, est touché par le nôtre (${Math.round(wild.hp)}/${Math.round(hp0)} PV)`);
  });
  rule('Saisons : le Bigfoot ne sort qu\'en hiver, dans les Bois profonds, et s\'en va quand l\'hiver finit (loin des dompteurs).', () => {
    const r = room();
    const big = SPECIES.findIndex((sp) => sp.key === 'bigfoot');
    check(big === SPECIES.length - 1 && SPECIES[big].zone === 2 && SPECIES[big].season === WINTER && !SPECIES[big].passive, 'Bigfoot : zone 2, hiver, hostile, ajouté en fin de liste (sauvegardes intactes)');
    const realNow = Date.now, t0 = realNow();
    let winter = -1, spring = -1;
    for (let t = t0; t < t0 + 4 * SEASON_MS && (winter < 0 || spring < 0); t += 60_000) {
      if (season(r.seed, t) === WINTER && winter < 0) winter = t;
      if (season(r.seed, t) === 0 && spring < 0) spring = t;
    }
    check(winter >= 0 && spring >= 0, 'les quatre saisons passent en une année');
    const bigs = () => [...r.units.values()].filter((u: any) => u.s === big && !u.owner);
    Date.now = () => spring;
    for (let i = 0; i < 30; i++) r.updateSpawns(), (r.time += 3);
    check(bigs().length === 0, 'au printemps, pas de Bigfoot');
    Date.now = () => winter;
    for (let i = 0; i < 30; i++) r.updateSpawns(), (r.time += 3);
    check(bigs().length > 0 && bigs().every((u: any) => r.map.zoneAt(u.x, u.y) === 2), `l'hiver, des Bigfoots apparaissent dans les Bois profonds (${bigs().length})`);
    Date.now = () => spring;
    r.updateSpawns();
    check(bigs().length === 0, 'au printemps, les Bigfoots sauvages s\'en vont');
    Date.now = realNow;
  });
});
