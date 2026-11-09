import { describe } from 'node:test';
import { rule, check, room, noop } from '../helpers.ts';
import { STATUS_IDS } from '../../shared/protocol.ts';
import { BURN_S, CURSE_BONUS, POISON_S, SPECIES } from '../../shared/config.ts';

const id = (k: (typeof STATUS_IDS)[number]) => STATUS_IDS.indexOf(k);

describe('Effets d\'état (HUD)', () => {
  rule('Aucun effet : rien n\'est envoyé pour le HUD.', () => {
    const r = room(), p = r.addPlayer('a', noop);
    check(r.statusOf(p).filter((s: number[]) => s[0] !== id('rest')).length === 0, 'aucune vignette hors repos');
  });

  rule('Poison, brûlure et malédiction : durée restante et valeur.', () => {
    const r = room(), p = r.addPlayer('a', noop);
    r.time = 100;
    p.poison = { dps: 2, until: 100 + POISON_S, by: p };
    p.burn = { dps: 3, until: 100 + BURN_S, by: p };
    p.curseUntil = 105;
    const st = r.statusOf(p) as number[][];
    const get = (k: (typeof STATUS_IDS)[number]) => st.find((s) => s[0] === id(k));
    check(get('poison')?.[1] === POISON_S && get('poison')?.[2] === 2, 'poison : 4 s, 2 PV/s');
    check(get('burn')?.[1] === BURN_S && get('burn')?.[2] === 3, 'brûlure : 3 s, 3 PV/s');
    check(get('curse')?.[1] === 5 && get('curse')?.[2] === CURSE_BONUS, 'malédiction : 5 s, +35 %');
  });

  rule('Ralenti, étourdi et cri d\'Alpha : actifs puis éteints à l\'échéance.', () => {
    const r = room(), p = r.addPlayer('a', noop);
    r.time = 50;
    p.slowUntil = 52;
    p.rootUntil = 51;
    p.rally = { v: 0.3, until: 56 };
    p.guard = { v: 0.2, until: 56 };
    let st = r.statusOf(p) as number[][];
    for (const k of ['slow', 'stun', 'rally', 'guard'] as const) check(st.some((s) => s[0] === id(k)), `${k} actif`);
    check(st.find((s) => s[0] === id('rally'))?.[2] === 0.3, 'valeur du cri : 0,3');
    r.time = 60;
    st = r.statusOf(p);
    for (const k of ['slow', 'stun', 'rally', 'guard'] as const) check(!st.some((s) => s[0] === id(k)), `${k} éteint`);
  });

  rule('Enlisé : durée passée dans le sable, sans compte à rebours (-1).', () => {
    const r = room(), p = r.addPlayer('a', noop);
    r.time = 20;
    p.sinkSince = 17;
    const q = (r.statusOf(p) as number[][]).find((s) => s[0] === id('quicksand'));
    check(q && q[1] === -1 && q[2] === 3, 'enlisé depuis 3 s');
  });

  rule('Seul le dompteur reçoit ses effets : les autres voient une liste vide.', () => {
    const r = room(), got = new Map<string, { id: number; status: unknown[] }[]>();
    const a = r.addPlayer('a', (m: { t: string; players?: { id: number; status: unknown[] }[] }) => m.t === 's' && got.set('a', m.players!));
    r.addPlayer('b', (m: { t: string; players?: { id: number; status: unknown[] }[] }) => m.t === 's' && got.set('b', m.players!));
    a.poison = { dps: 1, until: r.time + 3, by: a };
    r.broadcast();
    const seenByA = got.get('a')!.find((q) => q.id === a.id)!, seenByB = got.get('b')!.find((q) => q.id === a.id)!;
    check(seenByA.status.length >= 1, 'lui voit son poison');
    check(seenByB.status.length === 0, 'son coéquipier ne reçoit rien');
  });

  rule('Alpha lièvre : la vignette Soins apparaît près de lui quand on a perdu des PV, et pas loin ou en pleine forme.', () => {
    const r = room(), p = r.addPlayer('a', noop);
    r.spawnAlpha(p, SPECIES.findIndex((sp) => sp.key === 'hare'), 0, false);
    r.refreshAlphas(p);
    const hare = r.units.get(p.army.find((id: number) => r.units.get(id)?.alpha)), has = () => (r.statusOf(p) as number[][]).some((s) => s[0] === id('heal'));
    check(hare, 'l\'Alpha lièvre est là');
    hare.x = p.x + 40; hare.y = p.y;
    p.hp = p.hp - 10;
    check(has(), 'soigné : blessé et près de lui');
    hare.x = p.x + 5000;
    check(!has(), 'trop loin : pas de tuile');
  });
});
