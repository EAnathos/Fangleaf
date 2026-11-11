// Nouveautés du jeu, une entrée par mise à jour (la plus récente en tête), affichées dans le lobby : la dernière en
// grand, avec son numéro de version, les précédentes dépliables. Ce qui change pour le joueur, pas comment c'est codé.
// version : semver ; celle de la plus récente est aussi celle de package.json (les changer ensemble).

export interface ChangelogEntry {
  version: string; // 0.6.0
  date: string; // AAAA-MM-JJ
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.11.0',
    date: '2026-11-11',
    title: 'Réglages et affichage',
    items: [
      'Les capacités de spécialisation s\'utilisent aussi à dos de monture, et l\'armurerie décrit la capacité de chaque voie.',
      'Effets en cours : un seul réglage, le mode d\'affichage (Désactivé / Bonus / Malus / Tous) ; les vignettes sont en petite taille.',
      'Nouveaux réglages : opacité des meutes des autres joueurs, et options pour masquer les meutes des joueurs déconnectés et les Alphas au repos au village.',
      'Sur téléphone, le jeu reste en portrait.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-11-10',
    title: 'Prévenu quand on peut éveiller',
    items: [
      'Une notification apparaît dès que tes essences suffisent pour éveiller un Alpha ou pour le renforcer, sans avoir à ouvrir la Tanière pour vérifier.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-10',
    title: 'Une Tanière plus claire',
    items: [
      'Tanière : un filtre (Équipés, Au repos, À éveiller, Tous) pour ne plus se perdre parmi les Alphas, avec une pastille quand l\'un d\'eux attend une action.',
      'Les Alphas pas encore éveillés sont de petites tuiles, les prêts à éveiller en tête ; un clic montre leurs stats.',
      '☆ Marquer et ✎ Renommer deviennent de petites icônes à côté du nom, et « au repos » n\'est plus écrit.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-11-10',
    title: 'Le retour de tes Alphas',
    items: [
      'Sur ordinateur, quand un Alpha équipé tombe, le HUD dit dans combien de temps il ressuscite (face à un géant : après le combat).',
      'Au choix dans Paramètres › Affichage : une ligne sous le sac, ou une vignette à son portrait près des effets en cours.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-10',
    title: 'Capacités de spécialisation',
    items: [
      'En te spécialisant à la Grande armurerie, ta voie débloque une capacité active (touche Espace, ou le bouton dédié, sur recharge).',
      'Une par voie : Frénésie (Berserker), Rempart (Gardien), Tir de rupture (Tireur d\'élite), Pluie de flèches (Rôdeur), Météore (Pyromancien), Floraison (Druide).',
      'Elles sont pensées pour peser contre les géants : frapper plus fort, protéger ou soigner les coéquipiers, marquer ou embraser l\'ennemi.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-11-10',
    title: 'Chef du village, membres et inventaire de l\'école',
    items: [
      'Le lobby montre les nouveautés de la dernière mise à jour, avec son numéro de version.',
      'Le chef du village peut le transmettre à un autre membre, connecté ou non (Paramètres › Village).',
      'Un village compte 4 membres au plus, connectés ou non : le chef peut expulser un membre déconnecté pour faire une place.',
      'École des dompteurs : un onglet Inventaire montre les livres de ton sac (en lecture, prêt à lire, à lire après le tome d\'avant) et ceux déjà lus.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-10',
    title: 'Essences des géants, noms des Alphas, combats signalés',
    items: [
      'Un géant vaincu donne des essences de son espèce à ceux qui l\'ont combattu, un peu plus à chaque nouvelle victoire sur lui.',
      'Tanière : renomme tes Alphas ; leur nom s\'affiche sous eux, pour tout le village.',
      'Quand un coéquipier réveille un géant, tu es prévenu, et une flèche autour de toi indique le chemin du combat.',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-11-10',
    title: 'Serveur plus solide',
    items: ['Une adresse mal formée ne fait plus tomber le serveur (et les villages en cours avec lui).'],
  },
  {
    version: '0.4.0',
    date: '2026-11-10',
    title: 'Volcan, récolte et chapeaux',
    items: [
      'Volcan : salles agrandies, herses à lever en vidant les salles, géants dans leur salle (entrée payante), carte du donjon ; plus de tir à travers la roche.',
      'Le Tréant et le Golem de la meute récoltent (touche G) : ils abattent les arbres et mangent les pierres.',
      'Chaque chapeau débloqué renforce l\'arme de 10 %.',
      'Le Seigneur des cendres s\'appelle désormais Titus Veillafandre.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-11-10',
    title: 'Village plus fluide',
    items: ['Le village rame moins avec beaucoup d\'Alphas : 30 Alphas au repos au plus sont montrés en même temps.'],
  },
  {
    version: '0.2.0',
    date: '2026-11-09',
    title: 'Coati roux et robes des Alphas',
    items: [
      'Coati roux : un gibier de la jungle tapi dans les buissons (feuillage qui frémit, poils roux, reflet d\'yeux) ; dans la meute, il cueille.',
      'Chaque espèce a sa robe d\'Alpha et de légendaire, et les légendaires leurs effets propres.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-09',
    title: 'Alpha marqué et effets d\'état',
    items: [
      'Tanière : marque un Alpha (☆) pour suivre ses essences dans le HUD.',
      'Les effets en cours (poison, brûlure, cri du suricate…) ont leur vignette dans le HUD, avec une fenêtre d\'info.',
    ],
  },
];

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
