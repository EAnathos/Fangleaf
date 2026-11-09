// Aperçu (développement) des vignettes d'effets : toutes, ou une seule (?only=poison), pour les captures et la mise au point.
import './styles.css';
import { STATUS_IDS, type StatusTuple } from '../../shared/protocol.ts';
import { STATUS_DEFS, StatusBar } from './statusfx.ts';
import { settings } from './settings.ts';

const q = new URLSearchParams(location.search), only = q.get('only');
const hud = settings.display.statusHud;
hud.size = (['small', 'normal', 'large'] as const).find((s) => s === q.get('size')) ?? 'large';
hud.timers = q.get('timers') !== '0';
hud.animations = q.get('still') !== '1';
hud.opacity = Math.min(100, Math.max(10, +(q.get('opa') ?? 100)));
const pop = q.get('pop') === '1'; // montre la fenêtre d'info de la première vignette

const stage = document.getElementById('stage')!;
hud.vignette = (['off', 'soft', 'normal', 'strong'] as const).find((v) => v === q.get('vig')) ?? 'normal';
hud.position = (['top-left', 'top-right', 'bottom-left', 'bottom'] as const).find((v) => v === q.get('pos')) ?? 'top-left';
const vignette = Object.assign(document.createElement('div'), { className: 'fx-vignette' });
vignette.style.position = 'fixed';
document.body.prepend(vignette);
stage.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;background:radial-gradient(circle at 50% 30%,#2c3d38,#10181A)';
if (pop) stage.style.cssText += ';justify-content:flex-start;padding-top:70px'; // la fenêtre d'info sous la vignette : pas de centrage qui dépende de la taille de la page
const demo = (ids: readonly string[]): StatusTuple[] => ids.map((k) => [STATUS_IDS.indexOf(k as never), k === 'quicksand' || k === 'sandstorm' || k === 'rest' || k === 'mounted' || k === 'heal' ? -1 : 6, ({ poison: 2, burn: 3, curse: 0.35, slow: 0.5, stun: 0, quicksand: 4, sandstorm: 0.7, rally: 0.3, guard: 0.2, rest: 30, mounted: 0.75, heal: 0.03 } as Record<string, number>)[k]] as StatusTuple);

const make = (title: string, list: StatusTuple[]) => {
  const wrap = document.createElement('section');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
  if (!q.has('only') || q.get('title') === '1') wrap.innerHTML = `<h2 style="margin:0;font:700 20px var(--display);color:var(--text)">${title}</h2>`;
  const root = document.createElement('div');
  root.className = 'fx-bar';
  wrap.append(root);
  stage.append(wrap);
  const bar = new StatusBar(root, only || title.startsWith('Les') ? vignette : null);
  bar.applyOptions();
  bar.update(list);
  if (pop) setInterval(() => bar.update(list), 200); // la fenêtre se replace si la page change de taille
  if (pop) setTimeout(() => root.querySelector('.fx-tile')?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })), 900);
  // le compte à rebours tourne, pour voir la jauge et le clignotement de fin
  if (q.get('live') === '1') {
    const t0 = performance.now();
    setInterval(() => bar.update(list.map(([id, left, v]) => [id, left < 0 ? left : Math.max(0.1, left - (performance.now() - t0) / 1000), v] as StatusTuple)), 100);
  }
};

if (only) {
  const def = STATUS_DEFS[only as keyof typeof STATUS_DEFS], l = demo([only])[0];
  make('', [l]);
  if (!pop) {
    const cap = document.createElement('p');
    cap.style.cssText = 'margin:0;max-width:320px;text-align:center;font:600 15px var(--body);color:var(--text-2)';
    cap.innerHTML = `<b style="font:700 20px var(--display);color:${def.color}">${def.name}</b> · ${def.kind === 'buff' ? 'bonus ▲' : 'altération ▼'}<br>${def.about(l[2])}`;
    stage.append(cap);
  }
}
else {
  make('Altérations', demo(['poison', 'burn', 'curse', 'slow', 'stun', 'quicksand', 'sandstorm']));
  make('Bonus', demo(['rally', 'guard', 'rest', 'heal', 'mounted']));
  make(`Les ${Object.keys(STATUS_DEFS).length} effets ensemble`, demo(Object.keys(STATUS_DEFS)));
}
