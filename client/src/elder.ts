// Le vieil homme du village et ses souvenirs. Chaque géant vaincu pour la première fois laisse un parchemin ;
// rapporté au vieil homme, il lui rend un souvenir (dans l'ordre des chapitres, quel que soit le géant).
// Au dernier, il se rappelle comment construire un bateau.

/** Tant qu'il n'a retrouvé aucun souvenir. */
export const ELDER_INTRO = [
  'Oh ! Quelqu\'un ! Approche, approche… que je te regarde un peu.',
  'Pardonne-moi, j\'ai la mémoire qui flanche. Je ne me souviens plus de rien : ni de mon nom, ni de comment je suis arrivé ici.',
  'Mais je suis bien content de te voir ! Ça fait bien longtemps que je n\'ai vu personne…',
  'Enfin, je crois…',
  'Si un jour tu trouves des écrits… des parchemins, peut-être… rapporte-les-moi. Qui sait ce qui me reviendrait ?',
];

/** Un chapitre par parchemin rapporté (autant que de géants). */
export const ELDER_CHAPTERS: string[][] = [
  [
    'Ce parchemin… c\'est mon écriture ! Attends… Aubin. Je m\'appelle Aubin !',
    'Ça alors. Un nom, ça ne paraît rien, mais ça réchauffe le cœur.',
  ],
  [
    'Il y avait du monde, ici. Beaucoup de monde. Des rires autour du feu, des enfants qui couraient partout.',
    'C\'était un village de dompteurs. Les meilleurs de toutes les îles.',
  ],
  [
    'Les monstres vivaient avec nous. On ne les capturait pas : on les apprivoisait, et ils nous suivaient parce qu\'ils le voulaient bien.',
    'Les plus fidèles devenaient des Alphas. Oh… le premier loup de ma meute me revient. Grisou. Une vraie tête de mule.',
  ],
  [
    'Et les géants ! Ils n\'étaient pas méchants, tu sais. C\'étaient les gardiens de l\'île : chacun veillait sur son coin de terre.',
    'Les jours de fête, on leur portait des fruits.',
  ],
  [
    'Puis la Brume est venue de la mer. Épaisse, froide, avec une odeur de sel et de pierre mouillée.',
    'Elle rendait les bêtes sauvages. Les géants surtout : ils se sont enfermés dans leurs grottes en grondant.',
    'Et les autres… Les gluants, les loups, les sangliers que tu croises dans les bois… c\'étaient nos compagnons. Chaque famille avait les siens.',
    'La Brume les a rendus fous. Ils ne reconnaissaient plus personne. Quand tu en combats un… dis-toi qu\'il a eu un nom, un jour.',
  ],
  [
    'La Brume s\'est posée sur l\'île, zone après zone, comme une couverture. C\'est elle que tu vois aux lisières.',
    'Plus on avançait, plus elle était épaisse. Bientôt, plus personne n\'osait quitter le village.',
  ],
  [
    'Alors le village a construit un bateau. Le plus grand qu\'on ait jamais vu : trois mâts, une coque taillée dans les chênes des Landes.',
    'On allait partir tous ensemble, trouver une terre sans Brume.',
  ],
  [
    'Le jour du départ, la mer était mauvaise. Le bateau a longé l\'île jusqu\'au bout, là-bas, après le désert…',
    '… et il s\'est brisé sur les rochers. Coupé en deux. Tu l\'as peut-être vu, sur la plage.',
  ],
  [
    'Tout le monde s\'en est sorti, va. Mais il n\'y avait plus de bateau, et la Brume gagnait toujours.',
    'Les derniers dompteurs sont partis sur des barques, un matin. Ils ont promis de revenir. Ils ne sont jamais revenus.',
  ],
  [
    'Avant de partir, ils ont fait une chose étrange : ils ont confié à l\'île ce qu\'ils avaient de plus précieux.',
    'Des œufs. Des œufs de dompteur. Le jour où l\'île aurait besoin de nous, l\'un d\'eux éclorait.',
  ],
  [
    'Moi, j\'étais trop vieux pour ramer. Je suis resté, pour veiller sur les œufs et garder le feu allumé.',
    'J\'ai attendu. Les saisons ont passé… et la Brume m\'a pris mes souvenirs, un à un.',
  ],
  [
    'Attends… L\'œuf, sur la plage. L\'œuf brisé, juste là où tu t\'es réveillé…',
    'C\'était le tien. Tu es sorti de cet œuf. Tu es un dompteur de Fangleaf. Le premier depuis si longtemps…',
    'Et… tu sens ? Il se passe quelque chose. Les autres œufs se réveillent ! Ils sont là, au village, près du feu.',
    'Ils vont éclore, un par un. Ils seront perdus, comme tu l\'étais. Va les voir. Raconte-leur.',
  ],
  [
    'Et l\'épée plantée dans le sable ! C\'est la dernière cheffe du village qui l\'a laissée là, je m\'en souviens maintenant.',
    '« Pour celui qui viendra », disait-elle. Elle serait fière de toi.',
  ],
  [
    'Chaque géant que tu calmes fait reculer la Brume. C\'est pour ça que la mémoire me revient, morceau par morceau.',
    'Les géants ne nous en veulent pas. Ils attendaient seulement quelqu\'un d\'assez fort pour les réveiller.',
    'Et chaque monstre que tu apprivoises… c\'est un peu un vieil ami qui rentre enfin à la maison.',
  ],
  [
    'Je me souviens de tout, maintenant. De tout…',
    'Et je sais une chose : je sais construire un bateau. C\'est moi qui avais tracé les plans du grand navire !',
    'L\'épave, au bout de l\'île… on peut la relever. Il me faudra de l\'or, du bois, de la pierre… et un peu de temps. Tu m\'aides ?',
  ],
];

/** Titre de chaque souvenir (la liste des anciens parchemins). */
export const CHAPTER_TITLES = [
  'Un nom', 'Le village', 'Nos compagnons', 'Les gardiens', 'La Brume', 'Les lisières', 'Le grand bateau', 'Le naufrage',
  'Le départ', 'Les œufs', 'Le gardien', 'Ton œuf', 'L\'épée', 'La Brume recule', 'Le bateau à reconstruire',
];

/** Ce qu'il dit quand on lui remontre un parchemin déjà lu. */
export const REREAD = ['Ah oui, celui-là ! Je m\'en souviens bien, maintenant. Écoute…'];

/** Son nom, une fois le premier souvenir retrouvé. */
export const elderName = (told: number) => (told > 0 ? 'Aubin' : 'Vieil homme');

/** Ce qu'il dit quand on vient le voir (sans nouveau parchemin à lui donner). */
export function elderGreeting(told: number, total: number, boat: number, stages: number, heart = 0): string[] {
  if (told === 0) return ELDER_INTRO;
  if (told < total) {
    const left = total - told;
    return [
      'Ah, te revoilà ! Ça me fait plaisir.',
      `Les parchemins des géants me rendent la mémoire. Il en reste ${left === 1 ? 'un' : left} quelque part… je le sens.`,
    ];
  }
  if (boat < stages) return ['Alors, on s\'y remet, à ce bateau ?'];
  // le cœur volcanique : la dernière étape (1 : pris sur son autel, 2 : installé dans le bateau)
  if (heart >= 2) return ['Le cœur bat dans la coque : le bateau est prêt à prendre la mer.', 'Pour la suite… on verra bien. Une chose à la fois.'];
  if (heart === 1) return ['Tu l\'as trouvé ! Je le sens d\'ici, ce cœur, il chauffe comme une forge.', 'Va le poser dans le bateau, au bout de l\'île. Une Pierre de passage t\'y mène.'];
  return [
    'La coque est finie. Mais un bateau sans cœur ne va nulle part : il lui faut de quoi fendre la mer.',
    'On raconte qu\'il en bat un sous le volcan de la Mer de sable, gardé par trois géants de feu.',
  ];
}

/** Le souvenir où il comprend que l'œuf de la plage était le tien : à partir de là, les autres œufs du village éclosent. */
export const EGGS_CHAPTER = 11;

/**
 * Les autres œufs, autour du feu du village. Ils apparaissent avec ce souvenir, et un de plus éclot à chaque souvenir
 * suivant. Chaque nouveau-né, perdu comme on l'était, parle avec nous ; c'est nous qui lui expliquons l'histoire.
 */
export const HATCHLINGS: { name: string; color: string; x: number; y: number; lines: [boolean, string][] }[] = [
  {
    name: 'Pépin', color: '#E6A15C', x: -130, y: -55,
    lines: [
      [false, 'Hein ? Qu\'est-ce que… Tout est blanc, puis tout vert… Où je suis ?'],
      [true, 'Doucement. Tu viens d\'éclore, comme moi il n\'y a pas si longtemps. Tu es sur l\'île de Fangleaf.'],
      [false, 'Éclore ? Moi ? … C\'est vrai que j\'ai des coquilles plein la tête.'],
      [true, 'Il y avait un village, ici. La Brume a tout pris. Les derniers dompteurs nous ont laissés en œufs, pour qu\'on revienne un jour.'],
      [false, 'Alors on est… les nouveaux dompteurs ? Je vais m\'asseoir près du feu, je crois. Ça fait beaucoup d\'un coup.'],
    ],
  },
  {
    name: 'Myrtille', color: '#D886C9', x: 120, y: -10,
    lines: [
      [false, 'Chut… tu entends ? La mer. Je l\'entendais déjà dans ma coquille.'],
      [true, 'Tu es réveillée ! Bienvenue. Il y a un vieil homme, Aubin, qui veille sur vous depuis des années.'],
      [false, 'Des années ? Il doit être fatigué… Tu crois qu\'il voudra bien me raconter des histoires ?'],
      [true, 'Il en a plein. Des tristes, surtout. Les monstres sauvages, dehors… c\'étaient nos compagnons, avant la Brume.'],
      [false, 'Alors on les ramènera. Un par un. Promis.'],
    ],
  },
  {
    name: 'Bastien', color: '#8FD16A', x: 10, y: -140,
    lines: [
      [false, 'Je suis prêt ! … Prêt à quoi, au fait ?'],
      [true, 'À rien pour l\'instant. Tu viens d\'éclore. Repose-toi un peu.'],
      [false, 'Éclore… Donc j\'avais une coquille. Et là, je n\'en ai plus. C\'est logique.'],
      [true, 'Les géants gardaient l\'île, avant que la Brume les rende furieux. Quand on les bat, elle recule.'],
      [false, 'Les géants ! Je veux en voir un. De loin. De très, très loin.'],
    ],
  },
  {
    name: 'Ondine', color: '#6FB7FF', x: -10, y: 140,
    lines: [
      [false, 'Le bateau… j\'ai rêvé d\'un bateau. Il se brisait sur des rochers.'],
      [true, 'Ce n\'était pas un rêve. Il est au bout de l\'île, coupé en deux. Aubin veut le reconstruire.'],
      [false, 'Alors un jour, on pourra partir ? Retrouver ceux qui sont partis ?'],
      [true, 'Peut-être. Les derniers dompteurs sont partis en barque. Ils n\'ont jamais donné de nouvelles.'],
      [false, 'Je garderai une place pour eux sur le bateau. Au cas où.'],
    ],
  },
];

/** Œufs visibles au village, et combien ont éclos, selon les souvenirs retrouvés. */
export const eggsOf = (told: number) => ({ shown: told > EGGS_CHAPTER, hatched: Math.max(0, Math.min(HATCHLINGS.length, told - EGGS_CHAPTER)) });
