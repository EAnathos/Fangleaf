import { BUILDING_IDS, HALL_MAX } from '../shared/config.ts';
import { Room } from '../server/room.ts';
let t0 = performance.now();
const r: any = new Room('T', 7, { buildings: [...BUILDING_IDS], unlocked: [], hall: HALL_MAX });
console.log('création village', (performance.now() - t0).toFixed(0), 'ms, unités', r.units.size);
let bytes = 0, n = 0;
const ps = [0, 1, 2].map((i) => r.addPlayer('p' + i, (m: any) => { if (m.t === 's') { bytes += JSON.stringify(m).length; n++; } }));
ps.forEach((p: any, i: number) => { const c = r.map.spineAt(2600 + i * 3000); [p.x, p.y] = [c.x, c.y]; p.hp = 1e9; });
const sections: Record<string, number> = {};
for (const k of ['updateRevives','updateRespawns','clearEmptyCaves','updateAwakenings','updateSpawns','updateSeen','updateHazards','updateShots','separate','regen','broadcast']) {
  const f = r[k].bind(r); r[k] = (...a: any[]) => { const s = performance.now(); const v = f(...a); sections[k] = (sections[k] ?? 0) + performance.now() - s; return v; };
}
for (const k of ['wildAI','followerAI','playerAttack']) { const f = r[k].bind(r); r[k] = (...a: any[]) => { const s = performance.now(); const v = f(...a); sections[k] = (sections[k] ?? 0) + performance.now() - s; return v; }; }
t0 = performance.now();
const N = 400;
for (let i = 0; i < N; i++) { r.step(); for (const p of ps) p.hp = 1e9; }
const total = performance.now() - t0;
console.log('tick moyen', (total / N).toFixed(2), 'ms', 'snapshot moyen', Math.round(bytes / n), 'octets');
console.log(Object.entries(sections).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N).toFixed(3)}`).join('\n'));
let last: any;
ps[0].send = (m: any) => { if (m.t === 's') last = m; };
r.step();
for (const [k, v] of Object.entries(last)) console.log(k.padEnd(10), JSON.stringify(v).length);
console.log('un joueur :', Object.entries(last.players[0]).map(([k, v]) => `${k}=${JSON.stringify(v).length}`).join(' '));
