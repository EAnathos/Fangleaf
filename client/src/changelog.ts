// Nouveautés du jeu, affichées à chaque connexion (et depuis Menu › Nouveautés). La plus récente en tête.
// Une entrée par mise à jour fusionnée dans main : ce qui change pour le joueur, pas comment c'est codé.
// id : unique et stable (il sert à repérer ce que le joueur n'a pas encore vu) ; ne jamais le changer après coup.

export interface ChangelogEntry {
  id: string;
  date: string; // AAAA-MM-JJ
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-11-10-chef-ecole',
    date: '2026-11-10',
    title: 'Chef du village, membres et inventaire de l\'école',
    items: [
      'Les nouveautés s\'affichent à chaque connexion (et dans Menu › Nouveautés).',
      'Le chef du village peut le transmettre à un autre membre, connecté ou non (Paramètres › Village).',
      'Un village compte 4 membres au plus, connectés ou non : le chef peut expulser un membre déconnecté pour faire une place.',
      'École des dompteurs : un onglet Inventaire montre les livres de ton sac (en lecture, prêt à lire, à lire après le tome d\'avant) et ceux déjà lus.',
    ],
  },
  {
    id: '2026-11-10-serveur',
    date: '2026-11-10',
    title: 'Serveur plus solide',
    items: ['Une adresse mal formée ne fait plus tomber le serveur (et les villages en cours avec lui).'],
  },
  {
    id: '2026-11-10-volcan',
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
    id: '2026-11-10-fluidite',
    date: '2026-11-10',
    title: 'Village plus fluide',
    items: ['Le village rame moins avec beaucoup d\'Alphas : 30 Alphas au repos au plus sont montrés en même temps.'],
  },
  {
    id: '2026-11-09-coati-legendaires',
    date: '2026-11-09',
    title: 'Coati roux et robes des Alphas',
    items: [
      'Coati roux : un gibier de la jungle tapi dans les buissons (feuillage qui frémit, poils roux, reflet d\'yeux) ; dans la meute, il cueille.',
      'Chaque espèce a sa robe d\'Alpha et de légendaire, et les légendaires leurs effets propres.',
    ],
  },
  {
    id: '2026-11-09-alpha-marque',
    date: '2026-11-09',
    title: 'Alpha marqué et effets d\'état',
    items: [
      'Tanière : marque un Alpha (☆) pour suivre ses essences dans le HUD.',
      'Les effets en cours (poison, brûlure, cri du suricate…) ont leur vignette dans le HUD, avec une fenêtre d\'info.',
    ],
  },
];
