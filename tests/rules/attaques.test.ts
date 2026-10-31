// Attaques des géants qui leur sont propres (traque, ruée folle, étreinte, champignonnière…). Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { BOSS_MOVES, CURSE_BONUS, DECOY_S, DRUM_GAP, DRUM_R, HUG_S, LEGEND_SKIPS, RING_SPEED, SPECIES } from '../../shared/config.ts';

const S = (key: string) => SPECIES.findIndex((sp) => sp.key === key);
type R = ReturnType<typeof room>;

/** Un coin dégagé de la carte, loin de l'eau et des arbres. */
const open = (r: R) => {
  let s = 3000, at = r.map.spineAt(s);
  const ok = (x: number, y: number) => [-300, -150, 0, 150, 300].every((d) => [-300, -150, 0, 150, 300].every((e) => !r.map.blocked(x + d, y + e) && !r.map.isForest(x + d, y + e)));
  while (!ok(at.x, at.y)) at = r.map.spineAt((s += 41));
  return at;
};
const move = (key: string, kind: string) => BOSS_MOVES[key].find((mv) => mv.kind === kind)!;
const cast = (r: R, key: string, kind: string, b: unknown, t: unknown) => r.castMove(b, move(key, kind), t);
/** Fait tourner les attaques au sol pendant s secondes (la grille suit les déplacements). */
const run = (r: R, s: number, each?: () => void) => {
  for (let i = 0; i < s / 0.05; i++) {
    r.grid.clear();
    for (const e of [...r.players.values(), ...r.units.values()]) r.grid.insert(e);
    r.updateHazards();
    each?.();
    r.time += 0.05;
  }
};
/** Un géant éveillé, un dompteur à côté (increvable), dans un coin dégagé. */
const arena = (key: string, dx = 160) => {
  const r = room();
  r.units.clear();
  const at = open(r), p = r.addPlayer('a', noop);
  p.hp = 1e7;
  const b = r.createUnit(S(key), false, at.x, at.y);
  b.maxHp = b.hp = 1e6;
  [p.x, p.y] = [at.x + dx, at.y];
  return { r, p, b, at };
};

describe('Attaques propres des géants', () => {
  rule('Chaque géant qui en manquait a une attaque à lui ; un Alpha légendaire n\'hérite pas de celles qui appellent des renforts.', () => {
    const own: Record<string, string[]> = {
      shadow_fang: ['stalk', 'howl'], old_tusk: ['rampage', 'mud'], colossus: ['hug', 'hibernate'], spore_giant: ['shrooms'], old_flame: ['decoys'],
      wyvern_king: ['venomdive'], gorilla_king: ['drum', 'log'], croc_king: ['tail', 'roll', 'ambush'], mask_lord: ['totem', 'curse'], sand_queen: ['maw'],
      moon_jackal: ['eclipse', 'mirage'], scorpion_king: ['impale', 'ambush'], salamander_queen: ['molt', 'tailcut'], ash_lord: ['echo', 'roost'], mountain_tortoise: ['shellspin'],
    };
    for (const [key, kinds] of Object.entries(own)) check(kinds.every((k) => BOSS_MOVES[key].some((m) => m.kind === k)), `${SPECIES[S(key)].name} : ${kinds.join(', ')}`);
    check(!BOSS_MOVES.vulture_king.some((m) => m.kind === 'mortar') && !BOSS_MOVES.wyvern_king.some((m) => m.kind === 'tornado'), 'le Roi-Vautour n\'a plus de mortiers ; ses tornades ne sont qu\'à lui');
    check(['summon', 'decoys', 'totem', 'roost', 'eclipse'].every((k) => LEGEND_SKIPS.has(k as never)), 'renforts, totem, leurres, plafond, éclipse : pas pour un légendaire');
  });

  rule('Croc-d\'Ombre : il traque (caché dans l\'ombre, il ressort dans le dos de sa cible) et hurle (on est ralenti, ses louveteaux enragent).', () => {
    const { r, p, b, at } = arena('shadow_fang', 220);
    cast(r, 'shadow_fang', 'stalk', b, p);
    check(b.hidden, 'il se fond dans l\'ombre : intouchable');
    r.damage(b, 500, p);
    check(b.hp === b.maxHp, 'les coups ne l\'atteignent pas');
    run(r, 1.3);
    check(!b.hidden && b.x > p.x && p.hp < 1e7, `il ressort derrière sa cible et la mord (${Math.round(b.x - at.x)} px, la cible à ${Math.round(p.x - at.x)})`);
    const pup = r.createUnit(S('wolf'), false, b.x + 40, b.y);
    pup.summoner = b.id;
    [p.x, p.y] = [b.x - 150, b.y];
    r.time += 10;
    cast(r, 'shadow_fang', 'howl', b, p);
    run(r, 1.1);
    check(p.slowUntil > r.time && r.buffOf(pup, 'rally') > 0, 'hurlement : le dompteur traîne les pieds, le louveteau enrage');
  });

  rule('Vieille-Défense : ruée folle (il fonce, rebondit, touche une fois au passage) et bauge (la boue colle).', () => {
    const { r, p, b, at } = arena('old_tusk', 300);
    p.y += 4;
    cast(r, 'old_tusk', 'rampage', b, p);
    const lanes = r.hazards.filter((h: { style: string }) => h.style === 'rampage');
    check(lanes.length === 3, 'trois charges d\'affilée');
    let hits = 0;
    const hp0 = p.hp;
    run(r, 0.9 + 3 * (460 / 900 + 0.22), () => (hits = Math.max(hits, p.hp < hp0 ? 1 : 0)));
    check(p.hp < hp0 && Math.hypot(b.x - at.x, b.y - at.y) > 200, `il a foncé (${Math.round(Math.hypot(b.x - at.x, b.y - at.y))} px) et l'a renversé au passage`);
    const { r: r2, p: p2, b: b2 } = arena('old_tusk', 200);
    cast(r2, 'old_tusk', 'mud', b2, p2);
    run(r2, 1.6);
    check(p2.slowUntil > r2.time && r2.hazards.some((h: { style: string }) => h.style === 'mud'), 'la flaque de boue reste et colle');
  });

  rule('Ours Colosse : étreinte (sa proie ne bouge plus, il la broie, puis la lâche) ; hibernation (il guérit en dormant, un gros coup le réveille).', () => {
    const { r, p, b } = arena('colossus', 120);
    cast(r, 'colossus', 'hug', b, p);
    run(r, 0.85);
    const held = { x: p.x, y: p.y }, hp1 = p.hp;
    check(p.rootUntil > r.time, 'saisi');
    p.lastPosMs = Date.now() - 400;
    r.onPos(p, p.x + 60, p.y, 1, 0);
    check(p.x === held.x && p.y === held.y, 'il ne peut plus bouger');
    run(r, HUG_S);
    check(p.hp < hp1 && p.rootUntil <= r.time, 'broyé, puis relâché');
    b.hp = b.maxHp * 0.3;
    r.bossAI(b, p);
    check(!!b.hibernate, 'à bout de forces : il s\'endort');
    const hp2 = b.hp;
    for (let i = 0; i < 20; i++) r.bossAI(b, p), (r.time += 0.05);
    check(b.hp > hp2, 'il guérit en dormant');
    r.damage(b, b.maxHp * 0.12, p);
    r.bossAI(b, p);
    check(!b.hibernate && b.slept, 'un gros coup le réveille (et il ne s\'endormira plus de ce combat)');
  });

  rule('Champignon Géant : des champignons poussent ; on s\'en approche, la mèche s\'allume, ils éclatent.', () => {
    const { r, p, b } = arena('spore_giant', 400);
    cast(r, 'spore_giant', 'shrooms', b, p);
    const shrooms = r.hazards.filter((h: { style: string }) => h.style === 'shroom');
    check(shrooms.length === (move('spore_giant', 'shrooms') as { n: number }).n, `${shrooms.length} champignons`);
    [p.x, p.y] = [b.x - 2000, b.y];
    run(r, 1.6);
    check(r.hazards.filter((h: { style: string }) => h.style === 'shroom').length === shrooms.length, 'personne à côté : ils attendent');
    const s0 = shrooms[0], hp0 = p.hp;
    [p.x, p.y] = [s0.x + 20, s0.y];
    run(r, 0.3);
    check(p.hp === hp0 && s0.mine.boomAt, 'on s\'en approche : la mèche s\'allume (pas encore d\'explosion)');
    run(r, 0.5);
    check(p.hp < hp0 && !r.hazards.includes(s0), 'il éclate');
  });

  rule('Feu Ancien : il se divise en trois feux follets ; deux leurres, à son visage, tombent en quelques coups et explosent.', () => {
    const { r, p, b } = arena('old_flame', 150);
    b.hp = b.maxHp * 0.6;
    cast(r, 'old_flame', 'decoys', b, p);
    check(b.hidden, 'il s\'efface');
    run(r, 1);
    const decoys = [...r.units.values()].filter((u: { s: number }) => u.s === S('flame_decoy'));
    check(!b.hidden && decoys.length === 2 && decoys.every((d: { hp: number; maxHp: number }) => d.hp / d.maxHp === b.hp / b.maxHp), 'deux leurres, avec la même vie que lui');
    r.damage(decoys[0], decoys[0].hp / 25, p);
    check(r.units.has(decoys[0].id) && decoys[0].rootUntil > r.time, 'un leurre abattu s\'embrase…');
    run(r, 0.7);
    check(!r.units.has(decoys[0].id), '… et explose');
    r.time += DECOY_S;
    r.grid.clear();
    for (const e of [p, ...r.units.values()]) r.grid.insert(e);
    r.wildAI(decoys[1]);
    run(r, 1);
    check(!r.units.has(decoys[1].id), 'l\'autre explose à la fin de son temps');
  });

  rule('Wyverne-Reine : piqué venimeux (hors d\'atteinte dans le ciel, elle fond sur sa cible et laisse une mare de venin).', () => {
    const { r, p, b } = arena('wyvern_king', 250);
    cast(r, 'wyvern_king', 'venomdive', b, p);
    check(b.hidden, 'elle monte hors de vue');
    run(r, 2.2);
    check(!b.hidden && Math.hypot(b.x - p.x, b.y - p.y) < 80 && r.hazards.some((h: { style: string }) => h.style === 'venom') && p.poison, 'elle s\'écrase sur sa cible, le venin empoisonne');
  });

  rule('Roi Gorille : tambour de guerre (des anneaux qui épargnent ceux qui se glissent dans leurs brèches) et tronc qui roule.', () => {
    const { r, p, b } = arena('gorilla_king', 260);
    const q = r.addPlayer('b', noop);
    q.hp = 1e7;
    cast(r, 'gorilla_king', 'drum', b, p);
    const rings = r.hazards.filter((h: { style: string }) => h.style === 'drum');
    check(rings.length === 4, 'quatre anneaux');
    // le premier anneau : p hors des brèches, q dans une brèche
    const g = rings[0].ring.gap, off = g + Math.PI / 2;
    [p.x, p.y] = [b.x + Math.cos(off) * 260, b.y + Math.sin(off) * 260];
    [q.x, q.y] = [b.x + Math.cos(g) * 260, b.y + Math.sin(g) * 260];
    const [hp, hq] = [p.hp, q.hp];
    run(r, 0.7 + 260 / RING_SPEED + 0.1);
    check(p.hp < hp && q.hp === hq && DRUM_GAP > 0, 'l\'anneau frappe, sauf dans sa brèche');
    check(rings[0].r === DRUM_R, 'jusqu\'au bord de l\'arène');
    const { r: r2, p: p2, b: b2 } = arena('gorilla_king', 350);
    cast(r2, 'gorilla_king', 'log', b2, p2);
    const hp2 = p2.hp;
    run(r2, 1.1 + 0.8);
    check(p2.hp < hp2, 'le tronc roule jusqu\'à lui');
  });

  rule('Crocodile Ancien : coup de queue (vers le plus de monde, même dans son dos), roulade (il happe et tournoie), embuscade (il file sous terre et surgit).', () => {
    const { r, p, b, at } = arena('croc_king', 150);
    const w1 = r.createUnit(S('wolf'), false, at.x - 120, at.y), w2 = r.createUnit(S('wolf'), false, at.x - 110, at.y + 40);
    r.makeTamed(w1, p);
    r.makeTamed(w2, p);
    const [h1, h2] = [w1.hp, w2.hp];
    cast(r, 'croc_king', 'tail', b, p);
    run(r, 1);
    check(w1.hp < h1 && w2.hp < h2, 'sa queue fouette les deux loups dans son dos (plutôt que le dompteur seul devant)');
    const { r: r2, p: p2, b: b2 } = arena('croc_king', 180);
    cast(r2, 'croc_king', 'roll', b2, p2);
    run(r2, 0.9);
    check(p2.rootUntil > r2.time && r2.hazards.some((h: { style: string; victim: number }) => h.style === 'squeeze' && h.victim === p2.id), 'roulade : il le happe');
    const { r: r3, p: p3, b: b3 } = arena('croc_king', 300);
    cast(r3, 'croc_king', 'ambush', b3, p3);
    check(b3.hidden, 'il plonge');
    p3.x += 120;
    run(r3, 2.1);
    check(!b3.hidden && Math.hypot(b3.x - p3.x, b3.y - p3.y) < 100, 'il a suivi sa cible sous terre et surgit sous elle');
  });

  rule('Grand Masque : totem (il soigne les Petits Masqués, à casser) et malédiction (la cible marquée subit plus de dégâts).', () => {
    const { r, p, b } = arena('mask_lord', 200);
    cast(r, 'mask_lord', 'totem', b, p);
    run(r, 1);
    const totem = [...r.units.values()].find((u: { s: number }) => u.s === S('mask_totem'));
    check(!!totem && totem.summoner === b.id, 'un totem sort de terre');
    const m = r.createUnit(S('masked'), false, totem.x + 60, totem.y);
    m.summoner = b.id;
    m.hp = m.maxHp / 2;
    r.tick = 0;
    r.wildAI(totem);
    check(m.hp > m.maxHp / 2 && r.events.some((e: { e: string }) => e.e === 'mend'), 'il soigne le Petit Masqué');
    r.damage(totem, totem.hp, p);
    check(!r.units.has(totem.id), 'on peut le casser');
    cast(r, 'mask_lord', 'curse', b, p);
    run(r, 1.1);
    check(p.curseUntil > r.time, 'maudit');
    const w = r.createUnit(S('wolf'), false, p.x, p.y), hp0 = p.hp;
    r.damage(p, 100, w);
    const cursed = hp0 - p.hp;
    p.curseUntil = 0;
    r.damage(p, 100, w);
    check(Math.abs(cursed - (hp0 - cursed - p.hp) * (1 + CURSE_BONUS)) <= 2, `il subit ${Math.round(CURSE_BONUS * 100)} % de dégâts en plus`);
  });

  rule('Reine des sables : des gueules s\'ouvrent sous les dompteurs, aspirent les monstres et se referment en mordant.', () => {
    const { r, p, b } = arena('sand_queen', 300);
    cast(r, 'sand_queen', 'maw', b, p);
    const maw = r.hazards.find((h: { style: string }) => h.style === 'maw');
    check(!!maw && Math.hypot(maw.x - p.x, maw.y - p.y) < 1, 'sous le dompteur');
    const w = r.createUnit(S('wolf'), false, maw.x + 150, maw.y);
    r.makeTamed(w, p);
    run(r, 2);
    check(Math.hypot(w.x - maw.x, w.y - maw.y) < 150, 'elle aspire le loup');
    const hp0 = p.hp;
    run(r, 3.2);
    check(p.hp < hp0 && maw.done, 'elle se referme en mordant');
  });

  rule('Chacal lunaire : éclipse (ses chacals sortent de l\'ombre, enragés) et reflets de lune (des copies foncent sur la cible).', () => {
    const { r, p, b } = arena('moon_jackal', 200);
    cast(r, 'moon_jackal', 'eclipse', b, p);
    run(r, 1.3);
    const pack = [...r.units.values()].filter((u: { summoner: number }) => u.summoner === b.id);
    check(pack.length === 2 && pack.every((u: unknown) => r.buffOf(u, 'rally') > 0) && r.buffOf(b, 'rally') > 0, 'la nuit tombe : deux chacals, enragés comme lui');
    const hp0 = p.hp;
    cast(r, 'moon_jackal', 'mirage', b, p);
    run(r, 1.6);
    check(p.hp < hp0 && r.events.some((e: { e: string; kind: string }) => e.e === 'boom' && e.kind === 'mirage'), 'les reflets le traversent');
  });

  rule('Scorpion Empereur : dard empaleur (en ligne, il empoisonne fort) et fouissage (il surgit sous sa cible).', () => {
    const { r, p, b } = arena('scorpion_king', 250);
    cast(r, 'scorpion_king', 'impale', b, p);
    run(r, 1);
    check(p.poison && p.hp < 1e7, 'empalé, empoisonné');
    const { r: r2, p: p2, b: b2 } = arena('scorpion_king', 300);
    cast(r2, 'scorpion_king', 'ambush', b2, p2);
    run(r2, 2.1);
    check(!b2.hidden && Math.hypot(b2.x - p2.x, b2.y - p2.y) < 100, 'il surgit sous sa cible');
  });

  rule('Salamandre-Mère : mue (elle file, sa vieille peau explose) et queue repoussée (elle tombe et se bat seule).', () => {
    const { r, p, b, at } = arena('salamander_queen', 100);
    cast(r, 'salamander_queen', 'molt', b, p);
    const husk = r.hazards.find((h: { style: string }) => h.style === 'husk');
    const hp0 = p.hp;
    run(r, 2.2);
    check(Math.hypot(b.x - at.x, b.y - at.y) > 150 && p.hp < hp0 && !r.hazards.includes(husk), 'elle a filé, la peau a explosé là où elle était');
    b.hp = b.maxHp * 0.6;
    r.bossAI(b, p);
    const tails = () => [...r.units.values()].filter((u: { s: number }) => u.s === S('salamander_tail')).length;
    check(tails() === 1, 'sous les deux tiers : sa queue tombe et se bat');
    b.hp = b.maxHp * 0.3;
    r.bossAI(b, p);
    r.bossAI(b, p);
    check(tails() === 2, 'sous le tiers : une deuxième (pas plus)');
  });

  rule('Seigneur des cendres : écholocation (les anneaux étourdissent) et suspendu au plafond (braises, nuée, puis il fond sur quelqu\'un).', () => {
    const { r, p, b } = arena('ash_lord', 200);
    cast(r, 'ash_lord', 'echo', b, p);
    run(r, 0.6 + 200 / RING_SPEED + 0.1);
    check(p.rootUntil > r.time, 'étourdi');
    const { r: r2, p: p2, b: b2 } = arena('ash_lord', 200);
    cast(r2, 'ash_lord', 'roost', b2, p2);
    check(b2.hidden && [...r2.units.values()].some((u: { summoner: number }) => u.summoner === b2.id), 'au plafond, hors d\'atteinte ; sa nuée descend');
    run(r2, 0.8 + 2);
    check(r2.hazards.some((h: { style: string }) => h.style === 'cinder'), 'des braises tombent');
    run(r2, 3 + 1.2);
    check(!b2.hidden && Math.hypot(b2.x - p2.x, b2.y - p2.y) < 120, 'il fond sur sa proie');
  });

  rule('Tortue-Montagne : toupie de lave (elle file, rebondit, encaisse moins, frappe ce qu\'elle percute).', () => {
    const { r, p, b, at } = arena('mountain_tortoise', 300);
    cast(r, 'mountain_tortoise', 'shellspin', b, p);
    const hp0 = p.hp;
    run(r, 0.9 + 1.2);
    check(Math.hypot(b.x - at.x, b.y - at.y) > 200 && p.hp < hp0, 'elle file et percute');
    const hp1 = b.hp;
    r.damage(b, 1000, p);
    check(Math.abs(hp1 - b.hp - 350) < 1, 'rentrée dans sa carapace, elle encaisse moins');
  });

  rule('Un Alpha légendaire de chaque espèce lance ses nouvelles attaques contre les sauvages sans rien casser.', () => {
    for (const key of ['wolf', 'boar', 'bear', 'sporelin', 'wisp', 'wyvern', 'gorilla', 'croc', 'masked', 'sandworm', 'jackal', 'scorpion', 'salamander', 'ash_bat', 'lava_tortoise']) {
      const r = room();
      r.units.clear();
      const at = open(r), p = r.addPlayer('a', noop);
      [p.x, p.y] = [at.x - 300, at.y];
      const al = r.spawnAlpha(p, S(key), 3, true);
      [al.x, al.y] = [at.x, at.y];
      const foe = r.createUnit(S('golem'), false, at.x + 120, at.y);
      foe.maxHp = foe.hp = 1e6;
      for (let i = 0; i < 400; i++) {
        r.grid.clear();
        for (const e of [p, al, foe]) r.grid.insert(e);
        r.legendMove(al, foe);
        r.updateHazards();
        r.time += 0.05;
      }
      check(foe.hp < 1e6 && r.units.has(al.id), `${SPECIES[S(key)].name} légendaire : ses attaques frappent les sauvages`);
    }
  });

  rule('Écran de victoire : chaque dompteur qui a combattu le géant voit ses dégâts infligés et reçus, ses esquives et son plus gros coup.', () => {
    const { r, p, b } = arena('old_tusk', 120);
    const c = r.map.caves.findIndex((cv: { boss: number }) => cv.boss === b.s);
    r.caveBoss[c] = b.id;
    b.fight = { at: r.time, by: new Map() };
    b.dormant = false;
    r.damage(b, 300, p);
    r.damage(b, 800, p);
    r.damage(p, 50, b, true);
    // une charge annoncée à côté de lui, qui le manque : une esquive
    cast(r, 'old_tusk', 'mud', b, p);
    [p.x, p.y] = [p.x + 400, p.y];
    r.hazards.length = 0;
    r.hazard(b, { kind: 0, x: p.x + 150, y: p.y, r: 80, at: r.time + 0.1, dmg: 100 });
    run(r, 0.3);
    r.time += 30;
    r.damage(b, b.hp, p);
    const v = r.events.find((e: { e: string }) => e.e === 'victory');
    const row = v?.rows.find((x: { id: number }) => x.id === p.id);
    check(!!row && row.dealt >= 1100 && row.best >= 800 && row.taken > 0 && row.dodges === 1 && v.dur >= 30,
      `victoire : ${row?.dealt} infligés, ${row?.taken} reçus, ${row?.dodges} esquive, plus gros coup ${row?.best}, en ${v?.dur} s`);
  });
});
