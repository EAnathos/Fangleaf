// HUD des effets d'état : une vignette colorée (icône, compte à rebours) par altération (▼) ou bonus (▲) en cours sur soi.
// Le serveur envoie [numéro, secondes restantes, valeur] (voir statusOf) ; ici : le dessin, le réglage, et la mise à jour sans tout refaire.

import { STATUS_IDS, type StatusId, type StatusTuple } from '../../shared/protocol.ts';
import { settings, type StatusHud } from './settings.ts';

export interface StatusDef {
  name: string;
  kind: 'buff' | 'nerf';
  color: string;
  icon: string; // SVG 24×24 (blanc, sur la vignette)
  about: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;
const W = 'fill="#fff"', S = 'fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const STATUS_DEFS: Record<StatusId, StatusDef> = {
  poison: {
    name: 'Poison', kind: 'nerf', color: '#8FD14A',
    icon: svg(`<path ${W} d="M12 2.5C12 2.5 5 10 5 15a7 7 0 0 0 14 0c0-5-7-12.5-7-12.5z"/><circle cx="9.3" cy="14" r="1.7" fill="#3B6A12"/><circle cx="14.7" cy="14" r="1.7" fill="#3B6A12"/><path d="M9.5 18.2h5" stroke="#3B6A12" stroke-width="1.6" stroke-linecap="round"/>`),
    about: (v) => `Empoisonné : −${v} PV par seconde.`,
  },
  burn: {
    name: 'Brûlure', kind: 'nerf', color: '#FF6A2A',
    icon: svg(`<path ${W} d="M12 1.5c.8 4 5.5 6.2 5.5 12a5.5 5.5 0 0 1-11 0c0-2.4 1.2-4 2.4-5.2.2 2 1 3 2.2 3.2C10.3 8 10.4 4.5 12 1.5z"/><path fill="#FFC53D" d="M12 21a3.3 3.3 0 0 1-3.3-3.3c0-2 2-3.2 3.3-5.2 1.3 2 3.3 3.2 3.3 5.2A3.3 3.3 0 0 1 12 21z"/>`),
    about: (v) => `En feu : −${v} PV par seconde. L'eau l'éteint.`,
  },
  curse: {
    name: 'Malédiction', kind: 'nerf', color: '#B070F0',
    icon: svg(`<path ${W} d="M1.5 12C5 6.5 8.5 5 12 5s7 1.5 10.5 7C19 17.5 15.5 19 12 19s-7-1.5-10.5-7z"/><circle cx="12" cy="12" r="3.8" fill="#6A2DB0"/><ellipse cx="12" cy="12" rx="1" ry="3.4" fill="#1B0B33"/><path d="M5 3.5l1.6 2M12 1.5V4M19 3.5l-1.6 2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`),
    about: (v) => `Maudit : tu subis ${pct(v)} de dégâts en plus.`,
  },
  slow: {
    name: 'Ralenti', kind: 'nerf', color: '#6FB5E8',
    icon: svg(`<g ${S} stroke-width="1.6"><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/><path d="M12 6.5l4 2.5v6l-4 2.5-4-2.5V9z"/></g>`),
    about: (v) => `Pris dans une toile ou de la boue : ${pct(1 - v)} de vitesse en moins.`,
  },
  stun: {
    name: 'Étourdi', kind: 'nerf', color: '#F2C21B',
    icon: svg(`<path ${W} d="M12 2.5l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7z"/><path ${W} d="M3.5 17.5l.8 1.7 1.8.3-1.3 1.2.3 1.8-1.60-.9-1.60.9.3-1.8L.9 19.5l1.8-.3zM20.50 16l.8 1.7 1.8.3-1.3 1.2.3 1.8-1.60-.9-1.60.9.3-1.8-1.3-1.2 1.8-.3z"/>`),
    about: () => 'Étourdi ou saisi : impossible de bouger.',
  },
  quicksand: {
    name: 'Enlisé', kind: 'nerf', color: '#D39A4A',
    icon: svg(`<g ${S}><path d="M12 12m0 0a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0"/></g><path d="M12 9v7m-3-3l3 3 3-3" fill="none" stroke="#5B3A12" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
    about: (v) => `Sables mouvants : tu t'enfonces de plus en plus vite (${Math.round(v)} s). Sors vite, ou envole-toi !`,
  },
  sandstorm: {
    name: 'Tempête', kind: 'nerf', color: '#E3A055',
    icon: svg(`<g ${S}><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M2 13h16a3 3 0 1 1-3 3"/><path d="M5 18h6"/></g>`),
    about: () => 'Tempête de sable : le vent te pousse et t\'use. Abrite-toi dans une grotte ou un camp.',
  },
  rally: {
    name: 'Cri', kind: 'buff', color: '#F0B64A',
    icon: svg(`<path ${W} d="M12 1.5l3 3.5v8h-6v-8z"/><path ${W} d="M6.5 13.5h11v2.5h-11z"/><path ${W} d="M10.8 16h2.4v4h-2.4z"/><path d="M4 8l2.5-2.5M20 8l-2.5-2.5M3 12.5h2M19 12.5h2" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`),
    about: (v) => `Cri de l'Alpha : +${pct(v)} de dégâts infligés.`,
  },
  guard: {
    name: 'Carapace', kind: 'buff', color: '#4FB6E8',
    icon: svg(`<path ${W} d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M12 6v12c-2.5-1.6-4.5-4-4.5-7V7.3z" fill="#1E7CB0" opacity=".45"/>`),
    about: (v) => `Carapace de l'Alpha : −${pct(v)} de dégâts subis.`,
  },
  rest: {
    name: 'Repos', kind: 'buff', color: '#4FD68A',
    icon: svg(`<path ${W} d="M12 21C5 15.5 3 11.5 3 8.5A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21 8.5c0 3-2 7-9 12.5z"/><path d="M12 9.5v5M9.5 12h5" stroke="#1E8B4F" stroke-width="2" stroke-linecap="round"/>`),
    about: (v) => `Au repos (village, plage, camp) : +${v} PV par seconde.`,
  },
  mounted: {
    name: 'Monture', kind: 'buff', color: '#C98A52',
    icon: svg(`<path d="M6 3.5v8.5a6 6 0 0 0 12 0V3.5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="6" cy="8" r="1" fill="#7A4A1E"/><circle cx="18" cy="8" r="1" fill="#7A4A1E"/><circle cx="7.6" cy="14" r="1" fill="#7A4A1E"/><circle cx="16.4" cy="14" r="1" fill="#7A4A1E"/>`),
    about: (v) => `En selle : ta monture encaisse ${pct(v)} des dégâts à ta place.`,
  },
};

/** Les vignettes, dans l'ordre : altérations d'abord, bonus ensuite. */
const order = (id: number) => (STATUS_DEFS[STATUS_IDS[id]]?.kind === 'nerf' ? 0 : 100) + id;

interface Tile {
  el: HTMLElement;
  sweep: HTMLElement;
  time: HTMLElement;
  peak: number; // plus longue durée vue depuis son arrivée (ou son renouvellement) : la jauge en est la part restante
  left: number;
  key: string;
}

export class StatusBar {
  private tiles = new Map<number, Tile>();

  private edges = new Map<number, HTMLElement>(); // une teinte de bord d'écran par effet
  private floaters: HTMLElement | null;
  private active: number[] = [];
  private timer = 0;

  /** root : les vignettes ; vignette : le calque plein écran (bord teinté + icônes qui flottent), absent dans certains aperçus. */
  constructor(readonly root: HTMLElement, private vignette: HTMLElement | null = null, private opts: () => StatusHud = () => settings.display.statusHud) {
    this.floaters = vignette ? Object.assign(document.createElement('div'), { className: 'fx-floaters' }) : null;
    if (this.floaters) vignette!.append(this.floaters);
  }

  /** Applique le réglage : taille, animations, filtre, activé ou non. Le déplacement dans le coin choisi est fait par le HUD. */
  applyOptions() {
    const o = this.opts();
    this.root.dataset.size = o.size;
    this.root.dataset.position = o.position;
    this.root.classList.toggle('still', !o.animations);
    this.root.classList.toggle('no-time', !o.timers);
    this.root.hidden = !o.enabled;
    const v = this.vignette;
    if (v) {
      const [cx, cy] = { 'top-left': ['0%', '0%'], 'top-right': ['100%', '0%'], 'bottom-left': ['0%', '100%'], bottom: ['50%', '100%'] }[o.position];
      v.style.setProperty('--cx', cx);
      v.style.setProperty('--cy', cy);
      v.style.setProperty('--vig', String({ off: 0, soft: 0.55, normal: 1, strong: 1.5 }[o.vignette]));
      v.dataset.position = o.position;
      v.classList.toggle('still', !o.animations);
      v.hidden = !o.enabled || o.vignette === 'off';
    }
  }

  /** Une icône de l'effet monte du coin choisi en s'effaçant. */
  private float(id: number) {
    const o = this.opts(), box = this.floaters;
    if (!box || !o.animations || o.vignette === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches || box.childElementCount > 14) return;
    const def = STATUS_DEFS[STATUS_IDS[id]], el = document.createElement('span');
    el.className = 'fx-float';
    el.innerHTML = def.icon;
    const x = { 'top-left': 2, 'top-right': 82, 'bottom-left': 2, bottom: 34 }[o.position] + Math.random() * 16;
    const y = o.position.startsWith('top') ? 8 + Math.random() * 18 : 66 + Math.random() * 20;
    const size = 22 + Math.random() * 16;
    el.style.cssText = `--c:${def.color};left:${x}%;top:${y}%;width:${size}px;height:${size}px;--dx:${(Math.random() - 0.5) * 50}px;--rot:${(Math.random() - 0.5) * 50}deg;animation-duration:${2.2 + Math.random() * 1.4}s`;
    el.onanimationend = () => el.remove();
    box.append(el);
  }

  private sync(shown: number[]) {
    this.active = shown;
    if (shown.length && !this.timer) this.timer = window.setInterval(() => this.active.length && this.float(this.active[Math.floor(Math.random() * this.active.length)]), 420);
    else if (!shown.length && this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  update(list: readonly StatusTuple[]) {
    const o = this.opts();
    const shown = o.enabled ? list.filter(([id]) => STATUS_DEFS[STATUS_IDS[id]] && (o.filter === 'all' || (o.filter === 'buffs') === (STATUS_DEFS[STATUS_IDS[id]].kind === 'buff'))) : [];
    const live = new Set<number>();
    for (const [id, left, value] of shown) {
      live.add(id);
      const def = STATUS_DEFS[STATUS_IDS[id]];
      let t = this.tiles.get(id);
      if (!t) {
        t = this.make(id, def);
        this.tiles.set(id, t);
        this.root.append(t.el);
        t.peak = left;
      }
      if (left > t.left + 0.05 || left > t.peak) t.peak = left; // renouvelé : la jauge repart de zéro
      t.left = left;
      const timed = left >= 0, p = timed && t.peak > 0 ? 1 - Math.min(1, left / t.peak) : 0;
      t.sweep.style.setProperty('--p', p.toFixed(3));
      const label = timed ? `${Math.ceil(left)}` : '';
      if (t.time.textContent !== label) t.time.textContent = label;
      t.el.classList.toggle('ending', timed && left <= 2);
      t.el.classList.toggle('untimed', !timed);
      t.el.style.order = String(order(id));
      const key = `${def.name} : ${def.about(value)}`;
      if (t.key !== key) {
        t.key = key;
        t.el.title = key;
        t.el.setAttribute('aria-label', key);
      }
    }
    this.sync([...live]);
    if (this.vignette) {
      this.vignette.style.setProperty('--share', String(Math.min(1, 1.5 / Math.max(1, live.size)))); // beaucoup d'effets : chaque teinte s'atténue
      for (const id of live) {
        let e = this.edges.get(id);
        const left = shown.find((s) => s[0] === id)![1];
        if (!e) {
          e = document.createElement('div');
          e.className = 'fx-edge';
          e.style.setProperty('--c', STATUS_DEFS[STATUS_IDS[id]].color);
          this.vignette.prepend(e);
          this.edges.set(id, e);
        }
        e.classList.toggle('ending', left >= 0 && left <= 2);
      }
      for (const [id, e] of this.edges) {
        if (live.has(id)) continue;
        this.edges.delete(id);
        e.classList.add('out');
        setTimeout(() => e.remove(), 500);
      }
    }
    for (const [id, t] of this.tiles) {
      if (live.has(id)) continue;
      this.tiles.delete(id);
      t.el.classList.add('out');
      setTimeout(() => t.el.remove(), 220);
    }
  }

  private make(id: number, def: StatusDef): Tile {
    const el = document.createElement('div');
    el.className = `fx-tile ${def.kind}`;
    el.dataset.status = STATUS_IDS[id];
    el.style.setProperty('--c', def.color);
    el.setAttribute('role', 'img');
    el.innerHTML = `${def.icon}<span class="fx-sweep"></span><span class="fx-kind" aria-hidden="true">${def.kind === 'buff' ? '▲' : '▼'}</span><span class="fx-time"></span>`;
    return { el, sweep: el.querySelector<HTMLElement>('.fx-sweep')!, time: el.querySelector<HTMLElement>('.fx-time')!, peak: 0, left: -2, key: '' };
  }
}
