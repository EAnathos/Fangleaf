// Écran de triche (dev, F9) : monstres, effets, zones, géants. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { SPECIES, ZONES, gateOpen } from '../../shared/config.ts';
import { STATUS_IDS } from '../../shared/protocol.ts';

describe('Triche (dev) : écran F9', () => {
  rule('Monstres : ajouter ou retirer un monstre de meute, un Alpha, un légendaire, un sauvage.', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    const S = SPECIES.findIndex((sp) => sp.key === 'wolf');
    const mine = (alpha?: boolean) => [...r.units.values()].filter((u: any) => u.owner === p.id && u.s === S && (alpha === undefined || u.alpha === alpha)).length;
    r.onCheatMob(p, S, 'mob', true);
    r.onCheatMob(p, S, 'mob', true);
    check(mine(false) === 2, 'deux loups ordinaires dans la meute');
    r.onCheatMob(p, S, 'mob', false);
    check(mine(false) === 1, 'un loup retiré');
    r.onCheatMob(p, S, 'alpha', true);
    check(mine(true) === 1 && !r.units.get(p.army[p.army.length - 1]).legend, 'un Alpha apparaît');
    r.onCheatMob(p, S, 'legend', true);
    const a = [...r.units.values()].find((u: any) => u.owner === p.id && u.alpha && u.s === S) as any;
    check(a?.legend === true, 'il devient légendaire');
    r.onCheatMob(p, S, 'legend', false);
    check(a.legend === false && mine(true) === 1, 'légendaire retiré : il redevient un Alpha ordinaire');
    r.onCheatMob(p, S, 'alpha', false);
    check(mine(true) === 0 && !p.army.includes(a.id), 'Alpha retiré');
    r.onCheatMob(p, S, 'legend', true);
    check([...r.units.values()].some((u: any) => u.owner === p.id && u.alpha && u.legend && u.s === S), 'un légendaire crée aussi l\'Alpha manquant');
    r.onCheatMob(p, S, 'wild', true);
    check([...r.units.values()].some((u: any) => !u.owner && u.s === S), 'un sauvage apparaît');
    r.onCheatMob(p, S, 'wild', false);
    check(![...r.units.values()].some((u: any) => !u.owner && !u.alpha && u.s === S), 'sauvages retirés');
    const boss = SPECIES.findIndex((sp) => sp.boss);
    const n = r.units.size;
    r.onCheatMob(p, boss, 'wild', true);
    check(r.units.size === n, 'pas de géant par ici : on les abat (onCheatBoss)');
  });

  rule('Effets : n\'importe quel effet d\'état, pour la durée voulue ; liste vide : tout retirer.', () => {
    const r = room();
    const p = r.addPlayer('a', noop);
    const id = (k: string) => STATUS_IDS.indexOf(k as never);
    r.onCheatEffects(p, STATUS_IDS.map((_, i) => i), 600);
    const left = (k: string) => r.statusOf(p).find((s: number[]) => s[0] === id(k))?.[1] ?? 0;
    check(STATUS_IDS.every((k) => k === 'rest' || k === 'heal' || k === 'sandstorm' || left(k) !== 0 || r.statusOf(p).some((s: number[]) => s[0] === id(k))), 'tous les effets sont actifs');
    check(left('poison') > 590 && left('stun') > 590 && left('quicksand') > 590, 'pendant 600 s');
    r.onCheatEffects(p, [id('burn')], 5);
    check(r.statusOf(p).length === 1 && left('burn') <= 5, 'un seul effet, 5 s');
    r.onCheatEffects(p, [], 5);
    check(r.statusOf(p).length === 0, 'tout retiré');
  });

  rule('Zones : tout débloquer, se téléporter dans chaque zone (et au village).', () => {
    const r = room();
    r.units.clear();
    const p = r.addPlayer('a', noop);
    r.hall = 0;
    r.told = [];
    r.unlocked = [];
    r.onCheatZone(p, 4, 'unlock');
    check([0, 1, 2, 3].every((k) => gateOpen(k, r.hall, r.told)) && !gateOpen(4, r.hall, r.told), 'zone 4 : les portes 0 à 3 s\'ouvrent, pas la suivante');
    check(r.map.caves.filter((c: any) => c.zone <= 4).every((c: any) => r.unlocked.includes(c.id)), 'ses grottes (et celles d\'avant) sont ouvertes');
    r.onCheatZone(p, ZONES, 'unlock');
    check(Array.from({ length: ZONES }, (_, k) => gateOpen(k, r.hall, r.told)).every(Boolean), 'toutes les portes ouvertes');
    for (let z = 1; z <= ZONES; z++) {
      r.onCheatZone(p, z, 'tp');
      check(r.map.zoneAt(p.x, p.y) === z, `téléporté en zone ${z}`);
    }
    r.onCheatZone(p, 0, 'tp');
    check(r.map.zoneAt(p.x, p.y) <= 1 && Math.hypot(p.x - r.map.village.x, p.y - r.map.village.y) < 800, 'retour au village');
  });

  rule('Géants : on en abat un (ou tous) ; un géant qui dort compte comme vaincu.', () => {
    const r = room();
    r.beaten = [];
    const p = r.addPlayer('a', noop);
    const cave = r.map.caves[0], boss = cave.boss;
    check(r.units.get(r.caveBoss[0])?.s === boss, 'le géant de la grotte 0 est là');
    r.onCheatBoss(p, boss);
    check(r.beaten.includes(boss) && !r.units.has(r.caveBoss[0]), 'abattu : compté vaincu, plus sur le terrain');
    r.onCheatBoss(p, -1);
    check(SPECIES.every((sp, i) => !sp.boss || r.beaten.includes(i)), 'tous les géants vaincus');
  });
});
