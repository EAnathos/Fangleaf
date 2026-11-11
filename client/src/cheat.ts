// Dev et staging : écran de triche, un vrai panneau : F9 l'ouvre, et il reste ouvert jusqu'à un nouvel appui sur F9 (ou sa croix).
// Ajouter ou retirer un monstre, un Alpha, un légendaire ; appliquer un effet d'état pour une durée au choix ; débloquer ou
// rejoindre une zone ; abattre un géant. Le serveur n'accepte ces messages qu'en dev et sur le staging.

import { CLASSES, CLASS_IDS, SPECIES, SPECS, SPEC_IDS, ZONES, ZONE_NAMES, type ClassId, type SpecId } from '../../shared/config.ts';
import { STATUS_IDS, type CheatMob, type ClientMsg } from '../../shared/protocol.ts';
import { STATUS_DEFS } from './statusfx.ts';

/** Effets sans effet réel : seulement leur vignette (ils dépendent du terrain, de la météo ou d'une monture). */
const DISPLAY_ONLY = new Set<string>(['quicksand', 'sandstorm', 'rest', 'mounted', 'heal']);
const DURATIONS: [string, number][] = [['5 s', 5], ['15 s', 15], ['30 s', 30], ['1 min', 60], ['5 min', 300], ['30 min', 1800], ['1 h', 3600]];
const KINDS: [CheatMob, string, string][] = [
  ['mob', 'Monstre', 'monstre ordinaire de la meute (sans limite de meute)'],
  ['alpha', 'Alpha', 'son Alpha (équipé, sinon rangé)'],
  ['legend', 'Légendaire', 'Alpha légendaire (le crée au besoin ; retiré : redevient Alpha)'],
  ['wild', 'Sauvage', 'un sauvage apparaît près de toi ; retiré : tous les sauvages de l\'espèce'],
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const options = (pick: (i: number) => boolean) => {
  const groups = new Map<number, string[]>();
  SPECIES.forEach((sp, i) => {
    if (sp.minion || !pick(i)) return;
    groups.set(sp.zone, [...(groups.get(sp.zone) ?? []), `<option value="${i}">${esc(sp.name)}</option>`]);
  });
  return [...groups].sort((a, b) => a[0] - b[0]).map(([z, o]) => `<optgroup label="${esc(ZONE_NAMES[z - 1] ?? `Zone ${z}`)}">${o.join('')}</optgroup>`).join('');
};

export function initCheat(send: (m: ClientMsg) => void) {
  // Les deux valeurs sont figées au build : le panneau est absent du bundle de production.
  if (!import.meta.env.DEV && import.meta.env.VITE_FANGLEAF_ENV !== 'staging') return;
  let panel: HTMLElement | null = null;
  const chosen = new Set<string>(['poison']);
  let secs = 30;

  const build = () => {
    const el = document.createElement('div');
    el.className = 'panel cheat';
    el.hidden = true;
    const statuses = STATUS_IDS.map((k) => {
      const d = STATUS_DEFS[k];
      return `<label class="cheat-fx" style="--c:${d.color}"><input type="checkbox" data-k="${k}"${chosen.has(k) ? ' checked' : ''}><span class="cheat-dot">${d.icon}</span><span>${esc(d.name)} <small>${d.kind === 'buff' ? '▲' : '▼'}${DISPLAY_ONLY.has(k) ? ' · affichage seul' : ''}</small></span></label>`;
    }).join('');
    const zones = ['<option value="0">Village</option>', ...Array.from({ length: ZONES }, (_, i) => `<option value="${i + 1}">${i + 1} · ${esc(ZONE_NAMES[i])}</option>`)].join('');
    el.innerHTML = `
      <div class="cheat-head"><b>Triche</b><small>F9 : ouvrir ou fermer</small><button type="button" data-a="close" aria-label="Fermer">✕</button></div>
      <section><h4>Monstres</h4>
        <select data-id="mon">${options((i) => !SPECIES[i].boss)}</select>
        ${KINDS.map(([k, n, tip]) => `<div class="cheat-row" title="${esc(tip)}"><span>${n}</span><button type="button" data-a="mob" data-k="${k}" data-on="1">+</button><button type="button" data-a="mob" data-k="${k}" data-on="0">−</button></div>`).join('')}
      </section>
      <section><h4>Effets d'état</h4>
        <div class="cheat-fxs">${statuses}</div>
        <div class="cheat-chips">${DURATIONS.map(([n, v]) => `<button type="button" data-a="dur" data-v="${v}">${n}</button>`).join('')}</div>
        <label class="cheat-time">Durée <input type="number" min="1" max="3600" value="${secs}"> s</label>
        <div class="cheat-row"><button type="button" data-a="apply">Appliquer</button><button type="button" data-a="all">Tous</button><button type="button" data-a="clear">Tout retirer</button></div>
      </section>
      <section><h4>Zones</h4>
        <select data-id="zone">${zones}</select>
        <div class="cheat-row"><button type="button" data-a="tp">Aller</button><button type="button" data-a="unlock">Débloquer</button><button type="button" data-a="unlockAll">Tout débloquer</button></div>
      </section>
      <section><h4>Géants</h4>
        <select data-id="boss">${options((i) => !!SPECIES[i].boss)}</select>
        <div class="cheat-row"><button type="button" data-a="kill">Abattre</button><button type="button" data-a="killAll">Tous</button></div>
      </section>
      <section><h4>Classe + arme (test)</h4>
        <select data-id="cls">${CLASS_IDS.map((c) => `<option value="${c}">${esc(CLASSES[c].name)}</option>`).join('')}</select>
        <select data-id="spec"><option value="">Sans spécialisation</option>${SPEC_IDS.map((s) => `<option value="${s}">${esc(SPECS[s].name)} · ${esc(CLASSES[SPECS[s].cls].name)}</option>`).join('')}</select>
        <div class="cheat-row"><button type="button" data-a="gear">Équiper (arme et armure au max, armé)</button></div>
        <div class="cheat-row"><button type="button" data-a="dummy">Mannequin de test (immobile, PV infinis)</button></div>
      </section>
      <section><button type="button" data-a="loot">+300 or, +30 essences, +100 bois et pierre</button></section>`;
    const val = (id: string) => +el.querySelector<HTMLSelectElement>(`select[data-id=${id}]`)!.value;
    const time = el.querySelector<HTMLInputElement>('input[type=number]')!;
    const boxes = () => [...el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const applyFx = (keys: string[]) => send({ t: 'cheatfx', effects: keys.map((k) => STATUS_IDS.indexOf(k as never)), secs });
    time.oninput = () => (secs = Math.max(1, Math.min(3600, +time.value || 1)));
    el.onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      const a = b?.dataset.a;
      if (!b || !a) return;
      if (a === 'close') return show(false);
      if (a === 'mob') send({ t: 'cheatmob', s: val('mon'), kind: b.dataset.k as CheatMob, on: b.dataset.on === '1' });
      else if (a === 'dur') time.value = String((secs = +b.dataset.v!));
      else if (a === 'all' || a === 'clear') {
        boxes().forEach((x) => (x.checked = a === 'all'));
        chosen.clear();
        if (a === 'all') STATUS_IDS.forEach((k) => chosen.add(k));
        applyFx(a === 'all' ? [...chosen] : []);
      } else if (a === 'apply') {
        chosen.clear();
        boxes().filter((x) => x.checked).forEach((x) => chosen.add(x.dataset.k!));
        applyFx([...chosen]);
      } else if (a === 'tp') send({ t: 'cheatzone', z: val('zone'), act: 'tp' });
      else if (a === 'unlock') send({ t: 'cheatzone', z: val('zone'), act: 'unlock' });
      else if (a === 'unlockAll') send({ t: 'cheatzone', z: ZONES, act: 'unlock' });
      else if (a === 'kill') send({ t: 'cheatboss', s: val('boss') });
      else if (a === 'killAll') send({ t: 'cheatboss', s: -1 });
      else if (a === 'gear') {
        const cls = el.querySelector<HTMLSelectElement>('select[data-id=cls]')!.value as ClassId;
        const spec = el.querySelector<HTMLSelectElement>('select[data-id=spec]')!.value;
        send({ t: 'cheatgear', cls, ...(spec ? { spec: spec as SpecId } : {}) });
      }
      else if (a === 'dummy') send({ t: 'cheatdummy' });
      else if (a === 'loot') send({ t: 'cheat' });
      (document.activeElement as HTMLElement | null)?.tagName === 'BUTTON' && (document.activeElement as HTMLElement).blur(); // la barre d'espace ne doit pas re-cliquer
    };
    document.body.append(el);
    return el;
  };
  const show = (on: boolean) => {
    if (on) panel ??= build();
    if (panel) panel.hidden = !on;
  };
  addEventListener('keydown', (e) => {
    if (e.code !== 'F9') return;
    e.preventDefault();
    if (!e.repeat) show(!panel || !!panel.hidden);
  });
}
