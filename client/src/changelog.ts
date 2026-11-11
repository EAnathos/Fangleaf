// Nouveautés du jeu, une entrée par mise à jour (la plus récente en tête), affichées dans le lobby : la dernière en
// grand, avec son numéro de version, les précédentes dépliables. Ce qui change pour le joueur, pas comment c'est codé.
// version : semver ; celle de la plus récente est aussi celle de package.json (les changer ensemble).

import changelogData from './changelog.json';

export interface ChangelogEntry {
  version: string; // 0.6.0
  date: string; // AAAA-MM-JJ
  title: string;
  items: string[];
}

export const CHANGELOG = changelogData as ChangelogEntry[];

/** Version du jeu : celle de la dernière mise à jour. */
export const GAME_VERSION = CHANGELOG[0].version;

/**
 * Remplit le panneau des nouveautés du lobby : la dernière mise à jour en grand (« nouveau » si ce navigateur ne l'avait
 * pas encore vue), les précédentes dans « Versions précédentes ». Sur téléphone, une pastille l'ouvre par-dessus le lobby.
 */
export function renderLobbyNews() {
  const $ = (id: string) => document.getElementById(id)!;
  const date = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const entry = (c: ChangelogEntry, withVersion: boolean) => {
    const el = document.createElement('section');
    el.className = 'news-entry';
    el.innerHTML = '<div class="news-head"><b></b><span class="small muted"></span></div><ul class="small"></ul>';
    el.querySelector('b')!.textContent = c.title;
    el.querySelector('.news-head .small')!.textContent = withVersion ? `v${c.version} · ${date(c.date)}` : date(c.date);
    el.querySelector('ul')!.replaceChildren(...c.items.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    return el;
  };
  let fresh = false;
  try {
    fresh = localStorage.getItem('fangleaf.version') !== GAME_VERSION;
    localStorage.setItem('fangleaf.version', GAME_VERSION);
  } catch { /* stockage indisponible : rien n'est marqué nouveau */ }
  const v = $('lobby-version');
  v.textContent = `v${GAME_VERSION}`;
  v.classList.toggle('fresh', fresh);
  $('lobby-news-chip').textContent = `v${GAME_VERSION}`;
  $('lobby-news-latest').replaceChildren(entry(CHANGELOG[0], false));
  $('lobby-news-list').replaceChildren(...CHANGELOG.slice(1).map((c) => entry(c, true)));
  $('lobby-news-older').hidden = CHANGELOG.length < 2;
  const panel = $('lobby-news'), toggle = $('lobby-news-toggle');
  const open = (on: boolean) => {
    panel.classList.toggle('open', on);
    toggle.setAttribute('aria-expanded', String(on));
  };
  toggle.onclick = () => open(!panel.classList.contains('open'));
  $('lobby-news-close').onclick = () => open(false);
}
