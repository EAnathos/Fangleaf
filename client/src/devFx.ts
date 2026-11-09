// Dev uniquement (touche V) : panneau pour essayer les effets d'état du HUD, au choix et pour la durée voulue.
// Les choix ne durent que le temps de la session ; rien n'est enregistré.

import { STATUS_IDS, type ClientMsg } from '../../shared/protocol.ts';
import { STATUS_DEFS } from './statusfx.ts';

/** Effets sans effet réel : seulement leur vignette (ils dépendent du terrain, de la météo ou d'une monture). */
const DISPLAY_ONLY = new Set(['quicksand', 'sandstorm', 'rest', 'mounted', 'heal']);
const chosen = new Set<string>(['poison', 'burn', 'rally']);
const ALPHAS = [['hare', 'lièvre (soigne)'], ['meerkat', 'suricate (cri)'], ['snail', 'escargot (carapace)']] as const;
let secs = 12;
let panel: HTMLElement | null = null;

export function toggleDevFx(send: (m: ClientMsg) => void) {
  if (panel) {
    panel.remove();
    panel = null;
    return;
  }
  const el = (panel = document.createElement('div'));
  el.className = 'panel dev-fx';
  const rows = STATUS_IDS.map((k) => {
    const d = STATUS_DEFS[k];
    return `<label class="dev-fx-row" style="--c:${d.color}"><input type="checkbox" data-k="${k}"${chosen.has(k) ? ' checked' : ''}><span class="dev-fx-dot">${d.icon}</span><span>${d.name} <small>${d.kind === 'buff' ? '▲' : '▼'}${DISPLAY_ONLY.has(k) ? ' · affichage seul' : ''}</small></span></label>`;
  }).join('');
  el.innerHTML = `<div class="dev-fx-head"><b>Essai des effets</b><button type="button" data-a="close" aria-label="Fermer">✕</button></div>${rows}
    <label class="dev-fx-time">Durée <input type="range" min="2" max="120" value="${secs}"><b>${secs} s</b></label>
    <div class="dev-fx-btns"><button type="button" data-a="apply">Appliquer</button><button type="button" data-a="all">Tous</button><button type="button" data-a="clear">Tout retirer</button></div>
${ALPHAS.map(([k, n]) => `<div class="dev-fx-alpha"><span>Alpha ${n}</span><button type="button" data-a="alpha+${k}" aria-label="Ajouter l'Alpha ${n}">+</button><button type="button" data-a="alpha-${k}" aria-label="Retirer l'Alpha ${n}">−</button></div>`).join('')}
    <div class="dev-fx-btns"><button type="button" data-a="hurt">Blesser (50 % des PV)</button></div>
    <p class="small muted">Poison, feu, malédiction, toile, étourdi, cri et carapace sont réels. Touche V : ouvrir ou fermer.</p>`;
  const boxes = () => [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  const range = el.querySelector<HTMLInputElement>('input[type=range]')!, label = range.nextElementSibling!;
  const apply = (keys: string[]) => send({ t: 'cheatfx', effects: keys.map((k) => STATUS_IDS.indexOf(k as never)), secs });
  range.oninput = () => {
    secs = +range.value;
    label.textContent = `${secs} s`;
  };
  el.onclick = (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'close') return toggleDevFx(send);
    if (a === 'hurt') return send({ t: 'cheathurt' });
    if (a.startsWith('alpha')) return send({ t: 'cheatalpha', key: a.slice(6), on: a[5] === '+' });
    if (a === 'all') boxes().forEach((b) => (b.checked = true));
    if (a === 'clear') boxes().forEach((b) => (b.checked = false));
    chosen.clear();
    boxes().filter((b) => b.checked).forEach((b) => chosen.add(b.dataset.k!));
    apply(a === 'clear' ? [] : [...chosen]);
    (document.activeElement as HTMLElement | null)?.blur(); // la touche V doit pouvoir refermer le panneau
  };
  el.onchange = () => (document.activeElement as HTMLElement | null)?.blur();
  document.body.append(el);
}
