// Haute mer : le bateau prêt prend la mer vers le Colisée ; le Kraken l'intercepte (trois phases). Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, noop, ALL_CAVES } from '../helpers.ts';
import { BOAT_STAGES, BUILDING_IDS, DECK_RY, HALL_MAX, HEART_IN_BOAT, KRAKEN_DELAY_S, SPECIES, TICK_HZ, VOYAGE_ZONE } from '../../shared/config.ts';
import { Room } from '../../server/room.ts';

const KRAKEN = SPECIES.findIndex((sp) => sp.key === 'kraken');
const TENTACLE = SPECIES.findIndex((sp) => sp.key === 'kraken_tentacle');

/** Village au bout de l'aventure : tout ouvert, tous les géants de l'île et du volcan vaincus (pas le Kraken). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lateRoom = (): any => new Room('TEST', undefined, {
  buildings: [...BUILDING_IDS], unlocked: ALL_CAVES, hall: HALL_MAX,
  beaten: SPECIES.map((sp, i) => (sp.boss && sp.key !== 'kraken' ? i : -1)).filter((i) => i >= 0),
  told: SPECIES.map((sp, i) => (sp.boss && sp.zone <= 6 ? i : -1)).filter((i) => i >= 0),
});

describe('Haute mer : le Kraken', () => {
  rule('On ne prend la mer qu\'avec le bateau prêt ; à bord, le pont, la mer autour, et on peut faire demi-tour.', () => {
    const r = lateRoom(), m = r.map, c = m.voyage;
    check(!!c && c.zone === VOYAGE_ZONE && SPECIES[c.boss].key === 'kraken', 'un voyage en haute mer, gardé par le Kraken');
    const p = r.addPlayer('marin', noop);
    [p.x, p.y] = [c.entrance.x, c.entrance.y];
    r.onCave(p, c.id, true);
    check(!m.caveAt(p.x, p.y), 'bateau pas encore prêt : on reste à quai');
    r.boat = BOAT_STAGES.length;
    r.heart = HEART_IN_BOAT;
    r.time += 5;
    r.onCave(p, c.id, true);
    check(m.caveAt(p.x, p.y) === c && m.onDeck(c, p.x, p.y), 'bateau rebâti, son cœur installé : on prend la mer, sur le pont');
    check(m.blocked(c.inside.x, c.inside.y + DECK_RY + 60) && m.blocked(c.inside.x, c.inside.y - DECK_RY - 60), 'autour du pont : la mer (on ne marche pas dessus)');
    const k = r.units.get(r.caveBoss[c.id]);
    check(k && m.blocked(k.x, k.y) && k.dormant, 'le Kraken attend sous l\'eau, contre le flanc du bateau');
    [p.x, p.y] = [c.exit.x, c.exit.y];
    r.time += 5;
    r.onCave(p, c.id, false);
    check(!m.caveAt(p.x, p.y) && Math.hypot(p.x - c.entrance.x, p.y - c.entrance.y) < 250, 'demi-tour : retour au port, à côté du bateau');
  });

  rule('Le Kraken intercepte le bateau, puis trois phases : chaque fois vaincu, il replonge et revient avec toute sa vie.', () => {
    const r = lateRoom(), m = r.map, c = m.voyage;
    r.boat = BOAT_STAGES.length;
    r.heart = HEART_IN_BOAT;
    const p = r.addPlayer('marin', noop);
    p.hp = 1e9;
    [p.x, p.y] = [c.entrance.x, c.entrance.y];
    r.onCave(p, c.id, true);
    const k = r.units.get(r.caveBoss[c.id]);
    for (let i = 0; i < TICK_HZ * (KRAKEN_DELAY_S - 1); i++) r.step();
    check(k.dormant, 'pas tout de suite…');
    for (let i = 0; i < TICK_HZ * 2; i++) r.step();
    check(!k.dormant, `… mais au bout de ${KRAKEN_DELAY_S} s à bord, il surgit et attaque, sans qu'on lui parle`);
    // sa cinématique finie (ou passée), un dompteur à bord le fait surgir sans attendre la fin du délai
    const r2 = lateRoom(), c2 = r2.map.voyage;
    r2.boat = BOAT_STAGES.length;
    r2.heart = HEART_IN_BOAT;
    const p2 = r2.addPlayer('mousse', noop);
    [p2.x, p2.y] = [c2.entrance.x, c2.entrance.y];
    r2.onCave(p2, c2.id, true);
    const k2 = r2.units.get(r2.caveBoss[c2.id]);
    for (let i = 0; i < TICK_HZ; i++) r2.step();
    r2.onKraken(p2);
    for (let i = 0; i < 6; i++) r2.step();
    check(!k2.dormant, 'cinématique finie : le Kraken surgit tout de suite');
    const x0 = k.x, y0 = k.y;
    for (let i = 0; i < TICK_HZ * 3; i++) {
      p.hp = 1e9;
      r.step();
    }
    check(k.x === x0 && k.y === y0, 'il ne quitte pas l\'eau : il frappe depuis le flanc');
    k.moveCd = k.moveCd.map(() => 99); // on mesure ses phases, pas ses attaques
    const max = k.maxHp;
    r.damage(k, max + 10, p);
    check(r.units.has(k.id) && k.phase === 2 && k.hp === max && k.hidden, 'vaincu une première fois : il replonge, toute sa vie retrouvée (phase 2)');
    r.damage(k, 999, p);
    check(k.hp === max, 'sous l\'eau : intouchable');
    const dived = { x: k.x, y: k.y };
    r.time += 3.5;
    r.step();
    const moved = Math.hypot(k.x - dived.x, k.y - dived.y);
    check(!k.hidden && moved > 100, `puis il remonte, ailleurs autour du bateau (à ${Math.round(moved)} px)`);
    check(m.blocked(k.x, k.y) && c.spots.some((s: { x: number; y: number }) => s.x === k.x && s.y === k.y), 'toujours dans l\'eau, contre le bateau');
    const second = { x: k.x, y: k.y };
    r.damage(k, k.hp + 10, p);
    check(k.phase === 3 && k.hp === max && k.enraged, 'deuxième fois : phase 3, il frappe plus souvent');
    r.time += 3.5;
    r.step();
    check(Math.hypot(k.x - second.x, k.y - second.y) > 100, 'et il change encore de place');
    check(!r.beaten.includes(KRAKEN), 'il n\'est pas encore vaincu');
    r.damage(k, k.hp + 10, p);
    check(!r.units.has(k.id) && r.beaten.includes(KRAKEN), 'troisième fois : il sombre pour de bon, la route du Colisée est libre');
    check(r.chests.some((ch: { cave: number }) => ch.cave === c.id), 'et il laisse un coffre sur le pont');
  });

  rule('Ses tentacules s\'agrippent au pont : ils ne bougent pas, ne rapportent rien, et disparaissent quand il plonge.', () => {
    const r = lateRoom(), m = r.map, c = m.voyage;
    const k = r.units.get(r.caveBoss[c.id]);
    k.dormant = false;
    const p = r.addPlayer('marin', noop);
    [p.x, p.y] = [c.inside.x, c.inside.y];
    r.castMove(k, { kind: 'summon', cd: 10, n: 3, max: 4, minion: 'kraken_tentacle' }, p);
    const arms = [...r.units.values()].filter((u: { s: number }) => u.s === TENTACLE);
    check(arms.length === 3 && arms.every((u: { x: number; y: number }) => m.onDeck(c, u.x, u.y)), 'trois tentacules accrochés au pont');
    const at = arms.map((u: { x: number; y: number }) => [u.x, u.y]);
    p.hp = 1e9;
    for (let i = 0; i < TICK_HZ; i++) r.step();
    check(arms.every((u: { x: number; y: number }, i: number) => u.x === at[i][0] && u.y === at[i][1]), 'ils ne bougent pas');
    const g0 = p.gold, e0 = p.essences[TENTACLE];
    [p.x, p.y] = [arms[0].x + 30, arms[0].y];
    r.damage(arms[0], arms[0].hp + 1, p);
    check(p.gold === g0 && p.essences[TENTACLE] === e0, 'un tentacule abattu : ni or ni essence');
    check(!SPECIES[TENTACLE].boss && SPECIES[TENTACLE].minion, 'et il n\'a pas sa place au bestiaire');
    r.damage(k, k.hp + 1, p);
    check(![...r.units.values()].some((u: { s: number }) => u.s === TENTACLE), 'le Kraken plonge : ses tentacules lâchent prise');
  });
});
