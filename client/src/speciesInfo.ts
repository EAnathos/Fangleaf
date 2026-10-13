// Descriptions des espèces : bestiaire de la Tanière et page de dev /bestiary.html.

export const SPECIES_DESC: Record<string, string> = {
  hare: 'Gibier inoffensif qui grignote les baies des buissons. Il ne se bat pas : frappé, il détale.',
  slime: 'Lent et mou : la première proie du dompteur.',
  sporelin: 'Petit champignon sauteur. Fragile mais vif : il arrive en groupe.',
  wolf: 'Rapide, chasse en meute.',
  spider: 'Frappe fort et vite mais encaisse peu. Punit les dompteurs qui avancent seuls.',
  boar: 'Crête de soies, tête en coin et grandes défenses. Charge lourde.',
  bear: 'Énorme réserve de PV. Apprivoisé, il devient le tank de la meute.',
  golem: 'Bloc de pierre et de mousse, très lent, très solide.',
  wisp: 'Flamme froide qui flotte au-dessus des ruines.',
  watcher: 'Sentinelle de pierre moussue (tireur). Son œil se charge, puis un trait runique lent part vers toi : écarte-toi.',
  toad: 'Crapaud des Lacs brumeux (tireur). Gonfle sa gorge et crache en cloche : sors du cercle annoncé au sol.',
  serpent: 'Nage dans les lacs sans jamais en sortir (tireur). Se dresse, puis tire un jet d\'eau rapide. À frapper depuis la rive ou à distance.',
  crab: 'Carapace épaisse, marche de côté et pince fort. Le tank des Lacs brumeux, qui protège les tireurs.',
};

/** Ce que dit chaque géant quand on vient lui parler (intro), puis son cri quand le combat commence. */
export const BOSS_LINES: Record<string, { intro: string; cry: string }> = {
  slime_queen: { intro: 'Blop ? Encore un dompteur qui veut me mettre en bocal… Tu sais que je colle aux bottes, au moins ?', cry: 'Blop blop BLOP !' },
  spore_giant: { intro: 'Chut, je fais pousser mes champignons. Marche dessus et je t\'en fais une omelette.', cry: 'Atchoum… je veux dire : SPORES !' },
  shadow_fang: { intro: 'Tu as apporté des croquettes ? Non ? Alors c\'est toi, les croquettes.', cry: 'Aouuuuh !' },
  weaver: { intro: 'Huit pattes, huit yeux, et pas une seule envie d\'être dérangée. Tu restes pour le dîner ?', cry: 'Le dîner, c\'est toi !' },
  old_tusk: { intro: 'De mon temps, les dompteurs frappaient avant d\'entrer. Et repartaient avec des bosses.', cry: 'À la charge, comme en quarante !' },
  colossus: { intro: 'Je faisais la sieste. C\'était ma sieste préférée.', cry: 'GROAAAR ! (rends-moi ma sieste)' },
  moss_heart: { intro: 'Trois siècles que personne ne m\'a parlé. Bon. Ça va être court.', cry: 'Pluie de cailloux, sors ton parapluie !' },
  old_flame: { intro: 'Tu as froid ? Approche, approche… encore un peu…', cry: 'Tout feu, tout flamme !' },
  rune_eye: { intro: 'Je t\'ai vu venir. Littéralement. Je ne fais que ça.', cry: 'Œil pour œil !' },
  toad_king: { intro: 'Agenouille-toi devant le Roi des mares. Ou au moins, essuie tes pieds.', cry: 'Croâââ de guerre !' },
  mist_hydra: { intro: 'Trois têtes, et aucune n\'est d\'accord pour te laisser passer.', cry: 'Tête la première !' },
  titan_crab: { intro: 'Clac clac. Mon rocher, mon sable, ma grotte. Clac.', cry: 'Pince-moi si je rêve !' },
};
