// Toutes les règles et l'équilibrage du jeu. Partagé client / serveur.

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;

export const MAX_PLAYERS = 4;
export const SWORD_PULLS = 3; // à l'arrivée sur l'île, l'épée est plantée dans le sable : trois coups pour la déterrer
export const SWORD_REACH = 80;
export const MAX_VILLAGES = 3; // villages par compte (on choisit le sien au lobby)
export const WORLD_HALF = 17280; // carte de -17280 à 17280 : une île au milieu de la mer (voir worldmap.ts) ; divisible par 48 (brouillard) et 16 (grille)
// Le village, sur son îlot (relié à l'île par un pont de bois) : une palissade qui n'est pas ronde (voir villageEdge),
// plus large d'est en ouest ; VILLAGE_R est son rayon moyen.
export const VILLAGE_R = 470;
export const VIEW_R = 1250; // rayon d'intérêt : unités envoyées à chaque joueur

// Bâtiments : positions relatives au centre du village (le feu), un quartier chacun entre les quatre routes.
export const FORGE_OFFSET = { x: -235, y: 150 };
export const DEN_OFFSET = { x: 250, y: -190 };
export const MARKET_OFFSET = { x: -235, y: -200 };
export const SCHOOL_OFFSET = { x: 405, y: 140 }; // École des dompteurs (bâtie par Aubin, d'après le plan du Camp avancé)
export const BUILDING_REACH = 110;
// Bâtiments du village : construits par n'importe quel membre contre de l'or, une fois pour tout le village.
// Il faut aussi du bois et de la pierre (récoltés sur la carte), et parfois un Hôtel de ville assez développé.
export type BuildingId = 'forge' | 'den' | 'market' | 'stone' | 'palisade' | 'plot_forge' | 'plot_den' | 'plot_market' | 'forge2' | 'school' | 'bridge' | 'dock';
export interface Cost {
  gold: number;
  wood: number;
  stone: number;
}
// Mise en place du camp : au départ, il n'y a que le feu. On monte la palissade, puis on défriche l'emplacement
// de chaque bâtiment avant de pouvoir le bâtir (needs : ce qu'il faut avoir fait avant).
export const BUILDINGS: Record<BuildingId, { name: string; cost: number; wood: number; stone: number; hall: number; desc: string; needs?: BuildingId; zone?: number }> = {
  // le vieux pont qui mène à l'îlot du village est cassé : on le répare avec le bois et la pierre de son sac (l'entrepôt
  // est de l'autre côté), avant tout le reste
  bridge: { name: 'Pont de bois', cost: 0, wood: 12, stone: 6, hall: 0, desc: 'Le vieux pont qui mène à l\'îlot du village est cassé. Répare-le avec le bois et la pierre de ton sac.' },
  palisade: { name: 'Palissade', cost: 0, wood: 15, stone: 0, hall: 0, desc: 'Les pieux du village, et ses quatre portes. Il la faut pour bâtir l\'Hôtel de ville.' },
  plot_forge: { name: 'Emplacement de la forge', cost: 0, wood: 4, stone: 4, hall: 0, desc: 'Défricher et aplanir le terrain de la forge.' },
  plot_den: { name: 'Emplacement de la Tanière', cost: 0, wood: 8, stone: 4, hall: 0, desc: 'Défricher le terrain de la Tanière.' },
  plot_market: { name: 'Emplacement du marché', cost: 0, wood: 8, stone: 6, hall: 0, desc: 'Défricher le terrain du marché.' },
  forge: { name: 'Forge', cost: 10, wood: 5, stone: 0, hall: 0, desc: 'Choisis ta classe, améliore ton arme et ton armure.', needs: 'plot_forge' },
  den: { name: 'Tanière', cost: 20, wood: 20, stone: 15, hall: 0, desc: 'Éveille, renforce et range tes Alphas. Bestiaire des espèces croisées.', needs: 'plot_den' },
  market: { name: 'Marché', cost: 50, wood: 25, stone: 10, hall: 1, desc: 'Vends les monstres de ta meute, achète des monstres des espèces déjà croisées.', needs: 'plot_market' },
  stone: { name: 'Pierre de passage', cost: 200, wood: 10, stone: 40, hall: 2, desc: 'Voyage instantané entre le village et les camps établis.' },
  // amélioration de la forge (à la forge, pas d'emplacement à part) : au-delà du niveau 10, l'arme suit une spécialisation
  forge2: { name: 'Grande forge', cost: 2500, wood: 400, stone: 450, hall: 4, desc: 'Au-delà du niveau 10, choisis la spécialisation de ton arme.', needs: 'forge' },
  // au village, mais bâtie par Aubin : il faut d'abord trouver son plan, dans le coffre du Camp avancé (une fois le camp établi)
  // près de l'épave, au bout de l'île : elle se construit dès que la porte de la Mer de sable (zone 7) est ouverte
  dock: { name: 'Pierre de passage du bateau', cost: 50000, wood: 60, stone: 150, hall: 0, zone: 7, desc: 'Voyage instantané jusqu\'à l\'épave du bateau, au bout de l\'île. Se construit dès que la Mer de sable est ouverte.' },
  school: { name: 'École des dompteurs', cost: 1500, wood: 250, stone: 200, hall: 4, desc: 'On y lit les livres d\'apprentissage trouvés dans les coffres des géants. Aubin la bâtit au village, d\'après le plan caché au Camp avancé.' },
};
/** « 20 or · 15 bois · 10 pierre » (les montants nuls sont omis). */
export const costText = (c: Cost) => [c.gold && `${c.gold} or`, c.wood && `${c.wood} bois`, c.stone && `${c.stone} pierre`].filter(Boolean).join(' · ');
export const buildingCost = (b: BuildingId): Cost => ({ gold: BUILDINGS[b].cost, wood: BUILDINGS[b].wood, stone: BUILDINGS[b].stone });

// Hôtel de ville : on l'améliore (or, bois, pierre) pour débloquer le reste du village et du monde.
// HALL[n] : passage au niveau n + 1. La porte de la zone z + 1 demande aussi d'avoir rapporté à Aubin les parchemins
// des géants de la zone z (chaque géant vaincu laisse le sien dans sa grotte).
export const HALL_OFFSET = { x: 215, y: 150 };
// Entrepôt : chacun y dépose le bois et la pierre de son sac ; constructions et Hôtel de ville puisent dans cette réserve commune.
export const STORE_OFFSET = { x: -385, y: -80 };
// Panneau du village, au bord de la place : le tableau des exploits de chacun.
export const BOARD_OFFSET = { x: 100, y: -128 };
export const HALL: (Cost & { unlock: string })[] = [
  { gold: 20, wood: 15, stone: 10, unlock: 'Porte du village : la suite de la Lisière (zone 1) · Marché' },
  { gold: 200, wood: 60, stone: 50, unlock: 'Porte des Bois profonds (zone 2) · Pierre de passage' },
  { gold: 500, wood: 160, stone: 140, unlock: 'Porte des Landes (zone 3)' },
  { gold: 1500, wood: 350, stone: 300, unlock: 'Porte des Ruines moussues (zone 4) · Grande forge' },
  { gold: 3000, wood: 600, stone: 550, unlock: 'Porte des Lacs brumeux (zone 5)' },
  { gold: 4500, wood: 800, stone: 700, unlock: 'Porte de la Jungle (zone 6)' },
  { gold: 6000, wood: 1000, stone: 900, unlock: 'Porte de la Mer de sable (zone 7)' },
];
export const HALL_MAX = HALL.length;
/** Géants d'une zone (index d'espèce) : il faut rapporter tous leurs parchemins pour ouvrir la porte de la zone suivante. */
/** Géants de la zone dont dépendent sa porte, son parchemin, le volcan et le bateau (pas les géants facultatifs). */
export const zoneBosses = (z: number) => SPECIES.map((sp, i) => (sp.boss && sp.zone === z && !sp.optional ? i : -1)).filter((i) => i >= 0);
/** Niveau d'Hôtel de ville pour ouvrir la porte k (0 : sortie du village vers la zone 1 ; k ≥ 1 : vers la zone k + 1). */
export const gateHall = (k: number) => (k === 0 ? 1 : k + 1);
/** Porte k ouverte : Hôtel de ville au niveau requis et, après la première, parchemins des géants de la zone k tous lus par Aubin. */
export const gateOpen = (k: number, hall: number, told: number[]) => hall >= gateHall(k) && (k === 0 || zoneBosses(k).every((b) => told.includes(b)));
/** Zones découvertes par le village : la Lisière, puis chaque zone dont la porte est ouverte. */
export const zonesOpen = (hall: number, told: number[]) => {
  let z = 1;
  while (z < ZONES && gateOpen(z, hall, told)) z++;
  return z;
};

// Récolte : filons d'or (or et un peu de pierre), rochers (pierre) et arbres à abattre (bois).
export type Resource = 'gold' | 'wood' | 'stone';
export const resYield = (zone: number) => 4 + 2 * zone; // pierre d'un rocher cassé (en moyenne)
export const treeHp = (zone: number) => 15 + 15 * zone; // coups de hache (dégâts de pioche) pour abattre un arbre
export const treeWood = (zone: number) => 1 + Math.round(zone / 2); // bois d'un arbre abattu (en moyenne) : peu, mais il y en a partout
export const TREE_RESPAWN_S = 240; // l'arbre repousse
export const TREE_STILL_S = 0.4; // attaque auto : on n'abat un arbre qu'arrêté devant (pas en traversant la forêt)
/** Bois profonds : un arbre abattu réveille parfois un Tréant, qui attaque. */
export const TREANT_CHANCE = 0.06;
export const TREANT_ZONE = 2;
export const oreStone = (zone: number) => 1 + zone; // pierre en plus de l'or d'un filon (en moyenne)
export const RES_SPREAD = 0.4; // la récolte varie de ± 40 % autour de la moyenne
/** Quantité réellement récoltée : un tirage autour de la moyenne n (r : hasard entre 0 et 1), jamais moins de 1. */
export const resRoll = (n: number, r = Math.random()) => Math.max(1, Math.round(n * (1 - RES_SPREAD + 2 * RES_SPREAD * r)));
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
// Marché : prix d'un monstre ordinaire (apprivoisé) selon l'or qu'il rapporte à la chasse.
export const monsterBuyPrice = (species: number) => SPECIES[species].gold * 12;
export const monsterSellPrice = (species: number) => SPECIES[species].gold * 4;
// Grottes : fermées au départ, débloquées pour tout le village contre de l'or, bien plus cher dans les dernières zones.
const CAVE_UNLOCK = [150, 300, 450, 1500, 3000, 4500, 6000, 6000]; // par zone (la Jungle : ses temples)
export const caveUnlockCost = (zone: number) => CAVE_UNLOCK[zone - 1] ?? 150 * zone;
// Camps : un emplacement au bout de la zone 4, établi par n'importe quel membre du village contre de l'or.
export const CAMP_COST = 2000;
export const CAMP_R = 260; // feu qui soigne, monstres tenus à l'écart
// Le bateau du vieil homme : une fois tous ses souvenirs retrouvés, il le reconstruit en 4 étapes (or des dompteurs,
// bois et pierre de la réserve du village), chacune prenant 30 minutes (temps réel).
export const BOAT_STAGES: (Cost & { name: string })[] = [
  { name: 'La quille', gold: 3000, wood: 300, stone: 150 },
  { name: 'La coque', gold: 5000, wood: 500, stone: 250 },
  { name: 'Le pont et les mâts', gold: 8000, wood: 700, stone: 400 },
  { name: 'Les voiles', gold: 12000, wood: 900, stone: 600 },
];
export const BOAT_STAGE_MS = 30 * 60 * 1000;
/** Pierre de passage du bateau active : construite (dès la Mer de sable ouverte), ou bateau déjà reconstruit. */
export const dockStoneOn = (buildings: readonly BuildingId[], boat: number) => buildings.includes('dock') || boat >= BOAT_STAGES.length;
export const ELDER_REACH = 90; // pour lui parler, lui donner un parchemin ou des ressources
export const SCROLL_REACH = 70; // pour ramasser un parchemin
export const ELDER_OFFSET = { x: -46, y: 62 }; // le vieil homme, près du feu du village
export const VILLAGE_STONE_OFFSET = { x: 110, y: 255 }; // Pierre de passage du village
// École des dompteurs, au village : son plan est dans un coffre du Camp avancé (on l'ouvre une fois le camp établi) ;
// Aubin la bâtit ensuite contre des ressources, comme le bateau, en SCHOOL_BUILD_MS.
export const SCHOOL_BUILD_MS = 20 * 60 * 1000;
export const PLAN_REACH = 80; // pour ouvrir le coffre du plan
// Les coffres des géants lâchent parfois un livre d'apprentissage.
// Il y a plusieurs disciplines (meute, apprivoisement, essences, récolte), chacune en trois tomes : le tome dépend de
// la zone du géant (I : zones 1-2, II : 3-4, III : 5 à 7). On n'a qu'un exemplaire de chaque tome, qui enseigne une leçon
// de sa discipline, dans l'ordre (le tome II demande d'avoir lu le tome I) : trois leçons par discipline en tout.
// À part, la Maîtrise des Alphas n'a qu'un tome, que seuls les coffres des géants du volcan renferment.
// Une leçon lue à l'école prend 30 minutes.
export const SCHOOL_CAMP = 0; // le plan de l'école attend au premier camp
export type LessonKind = 'pack' | 'tame' | 'essence' | 'gather' | 'alpha' | 'vigor';
export interface Discipline {
  name: string;
  tomes: string[]; // nom du livre de chaque tome (I, II, III)
  per: number; // gain par leçon apprise
  desc: string; // ce que rapporte une leçon
  volcano?: boolean; // ses tomes ne se trouvent que dans les coffres des géants du volcan (et nulle part ailleurs)
  isle?: boolean; // ses tomes ne se trouvent que dans les coffres des géants des îlots du large (chacun le sien : Species.tome)
}
export const DISCIPLINES: Record<LessonKind, Discipline> = {
  pack: { name: 'Meute', tomes: ['Traité du jeune dompteur', 'Manuel de la grande meute', 'Codex du maître des bêtes'], per: 1, desc: '+1 place dans la meute' },
  tame: { name: 'Apprivoisement', tomes: ['Carnet du charmeur', 'Art de l\'apprivoisement', 'Grimoire des liens'], per: 0.02, desc: '+2 % de chance d\'apprivoiser (au combat et aux fruits)' },
  essence: { name: 'Essences', tomes: ['Herbier des essences', 'Traité des âmes sauvages', 'Codex de l\'éveil'], per: 0.03, desc: '+3 % de chance de recueillir une essence' },
  gather: { name: 'Récolte', tomes: ['Almanach du bûcheron', 'Manuel du mineur', 'Somme des artisans'], per: 0.1, desc: '+10 % de bois et de pierre récoltés' },
  alpha: { name: 'Maîtrise des Alphas', tomes: ['Livre des braises'], per: 1, desc: '+1 Alpha équipé en même temps', volcano: true },
  // îlots du large : un tome par géant des îlots (Grand Drake, Wyverne-Reine, Dragon ancien)
  vigor: { name: 'Endurance', tomes: ['Traité de la robustesse', 'Manuel de l\'endurance', 'Codex du colosse'], per: 0.1, desc: '+10 % de PV max', isle: true },
};
/** Disciplines dans l'ordre de la sauvegarde (n'ajouter qu'à la fin). */
export const LESSON_KINDS = Object.keys(DISCIPLINES) as LessonKind[];
export const TOMES = 3; // tomes par discipline (au plus : la Maîtrise des Alphas n'en a qu'un)
export const LESSONS_PER_TOME = 1;
export const LESSONS = TOMES * LESSONS_PER_TOME; // leçons par discipline (au plus, voir lessonsOf)
/** Leçons de la discipline k (index dans LESSON_KINDS). */
export const lessonsOf = (k: number) => (DISCIPLINES[LESSON_KINDS[k]]?.tomes.length ?? 0) * LESSONS_PER_TOME;
export const LESSON_MS = 30 * 60 * 1000; // lecture d'une leçon (temps réel : elle continue hors ligne)
export const TOME_DROP = 0.25; // chance, à l'ouverture d'un coffre de géant, d'y trouver un livre
export const ISLE_TOME_DROP = 0.5; // pour le tome que garde un géant des îlots du large (Endurance I, II ou III)
/** Index d'un livre dans le sac : discipline k, tome t. */
export const bookIndex = (k: number, tome: number) => k * TOMES + tome;
export const BOOKS = LESSON_KINDS.length * TOMES;
/** Nom d'un livre (index dans le sac). */
export const bookName = (i: number) => DISCIPLINES[LESSON_KINDS[Math.floor(i / TOMES)]].tomes[i % TOMES];
/** Tome (0 à TOMES - 1) que lâche le coffre d'un géant de cette zone. */
export const tomeOfZone = (zone: number) => Math.min(TOMES - 1, Math.floor((zone - 1) / 2));
/** Tome dont il faut un exemplaire pour apprendre la leçon suivante de la discipline k (lessons : leçons déjà apprises), ou -1 si tout est su. */
export const tomeForLesson = (lessons: number, k: number) => (lessons >= lessonsOf(k) ? -1 : Math.floor(lessons / LESSONS_PER_TOME));
/** Leçons d'un tome encore à apprendre (après celles déjà sues dans sa discipline). */
export const lessonsLeft = (tome: number, lessons: number) => Math.max(0, Math.min(LESSONS_PER_TOME, LESSONS_PER_TOME * (tome + 1) - lessons));
/** Gain total des leçons apprises d'une discipline (learned : leçons sues, par discipline). */
export const lessonBonus = (learned: readonly number[], kind: LessonKind) => {
  const k = LESSON_KINDS.indexOf(kind);
  return DISCIPLINES[kind].per * Math.max(0, Math.min(lessonsOf(k), learned[k] ?? 0));
};
/** Places de la meute ordinaire, avec les leçons de l'école. */
export const armyCap = (learned: readonly number[]) => ARMY_CAP + Math.round(lessonBonus(learned, 'pack'));
export const campName = (i: number) => (i === 0 ? 'Camp avancé' : `Camp avancé ${i + 1}`);

export const PLAYER_R = 16;
/**
 * Géants endormis : des obstacles pour le dompteur (même règle côté client et serveur).
 * On ne peut pas entrer dans leur cercle ; déjà dedans, on peut seulement s'en éloigner.
 */
export const sleeperBlocks = (bosses: Iterable<{ x: number; y: number; r: number }>, ox: number, oy: number, x: number, y: number) => {
  for (const b of bosses) {
    const R = b.r + PLAYER_R, d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
    if (d2 < R * R && d2 < (ox - b.x) ** 2 + (oy - b.y) ** 2) return true;
  }
  return false;
};
export const PLAYER_SPEED = 210;
export const PLAYER_RANGE = 62; // portée de pioche (filons), au-delà des rayons

// Classes, choisies à la forge (la première fois gratuitement, ensuite contre un peu d'or).
export type ClassId = 'warrior' | 'archer' | 'mage';
export interface HeroClass {
  name: string;
  range: number; // portée d'attaque au-delà des rayons
  dmg: number; // multiplicateur des dégâts d'arme
  cd: number; // secondes entre deux attaques
  hp: number; // multiplicateur des PV max
  splash?: number; // rayon de l'explosion (mage)
  desc: string;
  weapons: string[];
}
export const CLASSES: Record<ClassId, HeroClass> = {
  warrior: {
    name: 'Guerrier', range: 42, dmg: 1, cd: 0.55, hp: 1.25,
    desc: '+25 % de PV',
    weapons: ['Bâton', 'Coutelas', 'Épée courte', 'Épée longue', 'Lame dentée', 'Sabre', 'Croc-lame', 'Lame runique', 'Fendeur', 'Crocs jumeaux', 'Fangleaf'],
  },
  archer: {
    name: 'Archer', range: 300, dmg: 0.8, cd: 0.7, hp: 0.9,
    desc: '',
    weapons: ['Fronde', 'Arc court', 'Arc de chasse', 'Arc long', 'Arc composite', 'Arc de frêne', 'Arc-croc', 'Arc runique', 'Arc du traqueur', 'Arc jumeau', 'Arc Fangleaf'],
  },
  mage: {
    name: 'Mage', range: 240, dmg: 0.6, cd: 1, hp: 0.85, splash: 80,
    desc: '',
    weapons: ['Baguette', 'Bâton noueux', 'Bâton de chêne', 'Sceptre', 'Orbe de mousse', 'Bâton runique', 'Croc de lune', 'Sceptre ancien', 'Bâton du voile', 'Orbe jumelé', 'Bâton Fangleaf'],
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const CLASS_CHANGE_COST = 50; // la première classe est gratuite
/** Sans classe choisie, on se bat comme un guerrier. */
export const classOf = (cls: ClassId | null) => CLASSES[cls ?? 'warrior'];
export const PLAYER_ATK_CD = 0.55;
export const PLAYER_RESPAWN_S = 5;
export const DEATH_GOLD_LOSS = 0.15; // part de son or perdue à chaque mort…
export const DEATH_RES_LOSS = 0.1; // … et du bois et de la pierre de son sac
export const MAGE_SPLASH_EDGE = 0.4; // orbe du mage : dégâts au bord de l'explosion (pleins au point d'impact)
/** Avec un autre dompteur dans le village, on reste à terre ce temps-là : il peut venir nous relever. */
export const REVIVE_WINDOW_S = 10;
export const REVIVE_HOLD_S = 5; // R maintenu près du corps
export const REVIVE_R = 80;
export const REVIVE_HP = 0.5; // relevé avec la moitié de ses PV
// Couleur de chaque dompteur : les 4 premières sont données d'office (une par place du village, MAX_PLAYERS) ; les
// autres se choisissent dans son profil. Deux membres du village n'ont jamais la même. (N'ajouter qu'à la fin : sauvegardé.)
export const PLAYER_COLORS = ['#5CC8B8', '#E6A15C', '#D886C9', '#8FD16A', '#E8D45C', '#E8695C', '#6F9BE8', '#B48CFF', '#F2F0E6', '#4FB06A', '#E890B0', '#9A7A5A'];
/** Chapeaux du profil, purement décoratifs (0 : tête nue). N'ajouter qu'à la fin : sauvegardé. */
export const HATS = ['Tête nue', 'Chapeau de paille', 'Bonnet', 'Couronne de fleurs', 'Tricorne', 'Chapeau de sorcier', 'Haut-de-forme', 'Casquette', 'Feuille'];
/** Prix en or de chaque chapeau (payé une fois : on le garde ensuite). */
export const HAT_PRICES = [0, 20000, 30000, 50000, 100000, 150000, 250000, 40000, 10000];

export const ARMY_CAP = 12; // meute ordinaire (les Alphas ne comptent pas), avant les leçons de l'école (armyCap)
export const RECALL_R = 420; // trop loin du dompteur : la meute lâche tout et revient
export const RECALL_DONE_R = 110;
export const TAME_CHANCE = 0.25;
export const TAMED_MULT = 0.5; // un monstre apprivoisé a 50 % des dégâts de sa version sauvage…
export const TAMED_HP_MULT = 0.575; // … et 57,5 % de ses PV (+15 % par rapport à la moitié)
export const GOLD_SHARE_R = 700;

export const ALPHA_MULT = { hp: 1.9, dmg: 2.2, size: 1.6 }; // Alpha niv. 0 = 1,9× les PV et 2,2× les dégâts du monstre de base

// Forge : arme et armure progressent séparément.
export const ARMOR_MAX = 10;
export const ARMOR_NAMES = [
  'Tunique', 'Cuir', 'Cuir clouté', 'Mailles', 'Écailles', 'Brigandine',
  'Plates', 'Plates gravées', 'Écorce-fer', 'Croc-d’acier', 'Fangleaf',
];
export const armorMaxHp = (lvl: number) => 60 + 20 * lvl;
export const armorReduction = (lvl: number) => 0.03 * lvl;
export const armorCost = (lvl: number) => Math.round(20 * Math.pow(1.6, lvl));

// Arme : niveaux 0 à 10 propres à la classe, puis 11 à 20 dans une spécialisation (Grande forge).
// Les dégâts suivent la force des monstres (×2,5 environ d'une zone à l'autre) : +23 % par niveau,
// à peu près trois niveaux par zone (niv. 10 vers les Ruines moussues, 17 dans la Mer de sable).
export const WEAPON_MAX = 20;
export const SPEC_LVL = 10; // au-delà, il faut une spécialisation
export const WEAPON_NAMES = [
  'Bâton', 'Coutelas', 'Épée courte', 'Épée longue', 'Lame dentée', 'Sabre',
  'Croc-lame', 'Lame runique', 'Fendeur', 'Crocs jumeaux', 'Fangleaf',
];
export const weaponDmg = (lvl: number) => Math.round(7.5 * Math.pow(1.23, lvl)); // 8, 9, 11, 14… 59 (niv. 10)… 473 (niv. 20)
/** Pioche : elle ne profite pas de la spécialisation (sinon les filons tomberaient d'un coup). */
export const mineDmg = (lvl: number) => weaponDmg(Math.min(lvl, SPEC_LVL));
// Prix : ×1,6 par niveau jusqu'au 10, puis ×1,12 (l'or des monstres augmente moins vite que leur force) ; arrondi à 5.
export const weaponCost = (lvl: number) => Math.round((40 * Math.pow(1.6, Math.min(lvl, 9)) * Math.pow(1.12, Math.max(0, lvl - 9))) / 5) * 5;

// Spécialisations : une fois l'arme au niveau 10, la Grande forge permet de choisir une voie de sa classe.
// Multiplicateurs (dmg, cd, hp, splash), portée en plus (range), part des dégâts reçus évitée (guard),
// part des dégâts infligés rendue en PV (leech). weapons : noms des niveaux 11 à 20.
export type SpecId = 'berserker' | 'guardian' | 'sniper' | 'ranger' | 'pyromancer' | 'druid';
export interface Spec {
  cls: ClassId;
  name: string;
  desc: string;
  dmg?: number;
  cd?: number;
  hp?: number;
  range?: number;
  splash?: number;
  guard?: number;
  leech?: number;
  weapons: string[];
}
export const SPECS: Record<SpecId, Spec> = {
  berserker: {
    cls: 'warrior', name: 'Berserker', desc: '+30 % de dégâts, frappe 15 % plus vite, −10 % de PV', dmg: 1.3, cd: 0.85, hp: 0.9,
    weapons: ['Hache de guerre', 'Hache dentée', 'Fend-crâne', 'Hache sanglante', 'Grande hache', 'Hache-tempête', 'Croc du fauve', 'Hache runique', 'Dévoreuse', 'Rage de Fangleaf'],
  },
  guardian: {
    cls: 'warrior', name: 'Gardien', desc: '+35 % de PV, −15 % de dégâts reçus', hp: 1.35, guard: 0.15,
    weapons: ['Épée et écu', 'Lame du rempart', 'Épée bastion', 'Lame de chêne', 'Épée-roc', 'Lame du serment', 'Épée gardienne', 'Lame d\'écorce runique', 'Rempart vivant', 'Écu de Fangleaf'],
  },
  sniper: {
    cls: 'archer', name: 'Tireur d\'élite', desc: '+40 % de dégâts, +120 de portée, tire 15 % moins vite', dmg: 1.4, range: 120, cd: 1.15,
    weapons: ['Arc de visée', 'Long arc d\'if', 'Arc du faucon', 'Arc-aiguille', 'Arc de l\'aigle', 'Arc perce-cœur', 'Arc du guetteur', 'Grand arc runique', 'Œil de l\'orage', 'Œil de Fangleaf'],
  },
  ranger: {
    cls: 'archer', name: 'Rôdeur', desc: 'Tire 35 % plus vite, +10 % de PV', cd: 0.65, hp: 1.1,
    weapons: ['Arc léger', 'Arc de ronce', 'Arc véloce', 'Arc du vent', 'Arc-griffe', 'Arc de la meute', 'Arc-éclair', 'Arc runique vif', 'Bourrasque', 'Vent de Fangleaf'],
  },
  pyromancer: {
    cls: 'mage', name: 'Pyromancien', desc: '+20 % de dégâts, explosion 50 % plus large', dmg: 1.2, splash: 1.5,
    weapons: ['Bâton de braise', 'Sceptre ardent', 'Orbe de feu', 'Bâton-brasier', 'Sceptre de lave', 'Orbe solaire', 'Bâton du volcan', 'Sceptre runique ardent', 'Cœur de flamme', 'Brasier de Fangleaf'],
  },
  druid: {
    cls: 'mage', name: 'Druide', desc: '+20 % de PV, rend 12 % des dégâts infligés en PV', hp: 1.2, leech: 0.12,
    weapons: ['Bâton de saule', 'Sceptre de mousse', 'Bâton de lierre', 'Orbe de sève', 'Bâton des racines', 'Sceptre du chêne', 'Orbe de rosée', 'Bâton sylvestre runique', 'Cœur de la forêt', 'Racine de Fangleaf'],
  },
};
export const SPEC_IDS = Object.keys(SPECS) as SpecId[];
export const SPEC_CHANGE_COST = 1500; // la première spécialisation de chaque classe est gratuite ; elle est retenue si on change de classe
/** Spécialisation valable pour cette classe (une spécialisation d'une autre classe ne compte pas). */
export const specOf = (cls: ClassId | null, spec: SpecId | null) => (cls && spec && SPECS[spec]?.cls === cls ? SPECS[spec] : null);
/** Classe et spécialisation réunies : ce qui sert au combat. */
export function heroOf(cls: ClassId | null, spec: SpecId | null) {
  const c = classOf(cls), s = specOf(cls, spec);
  return {
    ...c,
    dmg: c.dmg * (s?.dmg ?? 1),
    cd: c.cd * (s?.cd ?? 1),
    hp: c.hp * (s?.hp ?? 1),
    range: c.range + (s?.range ?? 0),
    splash: c.splash && c.splash * (s?.splash ?? 1),
    guard: s?.guard ?? 0,
    leech: s?.leech ?? 0,
  };
}
/** Nom de l'arme à ce niveau : celui de la classe jusqu'au 10, puis celui de la spécialisation. */
export const weaponName = (cls: ClassId | null, spec: SpecId | null, lvl: number) =>
  lvl <= SPEC_LVL ? classOf(cls).weapons[lvl] : specOf(cls, spec)?.weapons[lvl - SPEC_LVL - 1] ?? `${classOf(cls).weapons[SPEC_LVL]} +${lvl - SPEC_LVL}`;

// Torche : on n'y voit rien la nuit sans elle. Achetée au niveau 1, puis de plus en plus de lumière.
export const TORCH_MAX = 5;
export const TORCH_NAMES = ['Aucune', 'Torche', 'Torche de résine', 'Lanterne', 'Lanterne de cuivre', 'Lanterne runique'];
export const torchRadius = (lvl: number) => (lvl > 0 ? 150 + 55 * (lvl - 1) : 0); // rayon du halo, la nuit
export const torchCost = (lvl: number) => Math.round(30 * Math.pow(1.8, lvl));

// Bottes : +2 % de vitesse à pied par niveau.
export const BOOTS_MAX = 10;
export const BOOTS_NAMES = [
  'Pieds nus', 'Sandales', 'Bottes de toile', 'Bottes de cuir', 'Bottes cloutées', 'Bottes de course',
  'Bottes de ranger', 'Bottes de lièvre', 'Bottes-vent', 'Bottes de loup', 'Fangleaf',
];
export const bootsSpeed = (lvl: number) => 1 + 0.02 * lvl;
export const bootsCost = (lvl: number) => Math.round(22 * Math.pow(1.6, lvl));

// Selle : sans elle, on ne monte pas sur un Alpha. Achetée au niveau 1, chaque niveau suivant rend les montures plus rapides.
export const SADDLE_MAX = 10;
export const SADDLE_NAMES = [
  'Aucune', 'Selle de corde', 'Selle de toile', 'Selle de cuir', 'Selle cloutée', 'Selle de course',
  'Selle de ranger', 'Selle du vent', 'Selle runique', 'Selle du loup', 'Selle Fangleaf',
];
export const saddleSpeed = (lvl: number) => 1 + 0.04 * Math.max(0, lvl - 1); // +4 % de vitesse en selle par niveau après le premier
export const saddleCost = (lvl: number) => Math.round(35 * Math.pow(1.6, lvl));
export type Gear = 'weapon' | 'armor' | 'torch' | 'boots' | 'saddle';
export const GEARS: Gear[] = ['weapon', 'armor', 'torch', 'boots', 'saddle'];
// Chaque amélioration de la forge demande aussi du bois : celui du sac d'abord, puis celui de l'entrepôt du village.
const GEAR_WOOD: Record<Gear, number> = { weapon: 4, armor: 4, torch: 3, boots: 3, saddle: 6 };
/** Bois pour passer un équipement de ce niveau au suivant : ×1,35 par niveau jusqu'au 10, puis ×1,06 (arme spécialisée). */
export const gearWood = (what: Gear, lvl: number) => Math.round(GEAR_WOOD[what] * Math.pow(1.35, Math.min(lvl, 10)) * Math.pow(1.06, Math.max(0, lvl - 10)));
/** Niveau maximum d'un équipement de la forge. */
export const gearMax = (what: Gear) => ({ weapon: WEAPON_MAX, armor: ARMOR_MAX, torch: TORCH_MAX, boots: BOOTS_MAX, saddle: SADDLE_MAX })[what];
/** Prix (or et bois) de l'amélioration d'un équipement de ce niveau au suivant. */
export const gearCost = (what: Gear, lvl: number): Cost => ({
  gold: ({ weapon: weaponCost, armor: armorCost, torch: torchCost, boots: bootsCost, saddle: saddleCost })[what](lvl),
  wood: gearWood(what, lvl),
  stone: 0,
});

// Tanière : il n'y a pas d'Alpha sauvage. On éveille l'Alpha d'une espèce avec ses essences
// (1 essence par monstre de l'espèce vaincu), puis on le renforce, de plus en plus cher.
// Montures : certains Alphas éveillés se chevauchent. Vitesse multipliée, et la monture encaisse
// une partie des coups (elle peut tomber : on est désarçonné, elle ressuscite comme tout Alpha).
export const MOUNTS: Record<string, number> = { wolf: 1.6, boar: 1.4, bear: 1.25, snail: 0.6, serpent: 1.5, vulture: 1.5, gorilla: 1.35, croc: 1.45 }; // l'escargot se monte, mais ralentit
/**
 * Montures nageuses (le serpent) : on ne va qu'en eau avec elles. On embarque près de l'eau (à SHORE_R au plus) :
 * on est posé sur l'eau. On ne descend que près d'une rive (posé sur la terre ferme). Si la monture tombe sur l'eau, on se noie.
 */
export const SWIM_MOUNTS = new Set(['serpent', 'croc']);
/** Montures volantes (le vautour) : on survole l'eau, les rochers et les arbres, pas la forêt qui borde le couloir. */
export const FLY_MOUNTS = new Set(['vulture']);
export const flyMount = (species: number) => FLY_MOUNTS.has(SPECIES_KEYS[species]);
export const SHORE_R = 140;
export const swimMount = (species: number) => SWIM_MOUNTS.has(SPECIES_KEYS[species]);
export const MOUNT_SHARE = 0.75; // part des dégâts reçus par la monture
export const MOUNT_REACH = 240; // distance max pour enfourcher sa monture
export const mountSpeedOf = (species: number) => MOUNTS[SPECIES_KEYS[species]] ?? 1;
/** Vitesse (multiplicateur) d'un dompteur sur une monture de cette espèce, avec sa selle. */
export const rideSpeed = (species: number, saddle: number) => mountSpeedOf(species) * saddleSpeed(saddle);

export const ALPHA_LVL_MAX = 10;
/**
 * Pouvoirs de certains Alphas, tant qu'ils sont sur le terrain et debout :
 * - le suricate (cri de ralliement) et l'escargot (carapace) ont une compétence : au combat, ils la lancent dès qu'elle
 *   est rechargée, et tous les alliés autour d'eux (dompteurs et meutes, pas seulement le leur) en profitent un moment :
 *   dégâts infligés accrus (suricate) ou dégâts reçus réduits (escargot) ;
 * - le lièvre soigne un peu son dompteur et la meute autour de lui, toutes les ALPHA_HEAL_S secondes.
 */
export const ALPHA_PERKS: Record<string, { kind: 'guard' | 'heal' | 'rally'; base: number; per: number }> = {
  meerkat: { kind: 'rally', base: 0.15, per: 0.015 }, // +15 % de dégâts infligés, +1,5 % par niveau
  snail: { kind: 'guard', base: 0.15, per: 0.015 }, // −15 % de dégâts reçus, +1,5 % par niveau
  hare: { kind: 'heal', base: 0.03, per: 0.003 }, // 3 % des PV max, +0,3 % par niveau
};
export const ALPHA_SHOUT_S = 6; // durée du cri (suricate) ou de la carapace (escargot)
export const ALPHA_SHOUT_CD = 9; // recharge, comptée depuis le lancer : un peu plus longue que l'effet
export const ALPHA_SHOUT_R = 320; // les alliés à cette distance de l'Alpha en profitent
export const ALPHA_SHOUT_AGGRO = 360; // il la lance quand un ennemi est à cette distance de lui
export const LASER_TICK = 1; // rayon runique : par quart de seconde dans le faisceau, 100 % des dégâts du lanceur
export const ALPHA_HEAL_S = 3;
export const ALPHA_HEAL_R = 260; // le lièvre soigne ce qui est à cette distance de lui
/** Pouvoir de l'Alpha de cette espèce à ce niveau (part de dégâts évités ou de PV rendus), ou null. */
export const alphaPerk = (species: number, lvl: number) => {
  const k = ALPHA_PERKS[SPECIES[species]?.key];
  return k ? { kind: k.kind, value: k.base + k.per * lvl } : null;
};
export const ALPHA_EQUIP_MAX = 5; // Alphas équipés (sur le terrain) en même temps ; les autres se reposent à la Tanière
/** Alphas équipés au plus, avec la Maîtrise des Alphas (tome du volcan) lue à l'école. */
export const alphaEquipMax = (learned: readonly number[]) => ALPHA_EQUIP_MAX + Math.round(lessonBonus(learned, 'alpha'));

// Grottes : un mini-boss par grotte, qui réapparaît après un délai ; il peut lâcher son âme.
export const BOSS_RESPAWN_S = 300;
export const STORM_PUSH = 55; // tempête de sable au plus fort : elle pousse le dompteur de 55 px/s dans le sens du vent…
export const STORM_WIND = { x: 0.984, y: 0.177 }; // … vers l'est, en descendant un peu (comme les traînées de sable à l'écran)
export const GOLEM_EAT_R = 130; // un golem de la meute repère un rocher à cette distance…
export const GOLEM_BITE_S = 0.9; // … et le grignote, une bouchée toutes les 0,9 s…
export const GOLEM_BITES = 4; // … en quatre bouchées : la pierre revient à son dompteur
export const CACTUS_PRICK = 0.05; // s'y frotter : 5 % des PV max…
export const CACTUS_CD = 0.8; // … au plus toutes les 0,8 s
/**
 * Tempête de sable assez forte pour blesser : elle cache vers et suricates, et cloue les vautours au sol (les sauvages,
 * ceux de la meute et la monture : on ne vole plus dans la Mer de sable tant qu'elle souffle).
 */
export const STORM_HARM = 0.4;
// Sables mouvants : ils s'ouvrent au hasard sous les pas d'un dompteur, n'importe où dans la Mer de sable, puis se referment.
export const QUICKSAND_CHANCE = 0.04; // chance, chaque seconde, qu'il s'en ouvre sous un dompteur qui marche dans le désert…
export const QUICKSAND_GAP = 700; // … s'il n'y en a pas déjà à cette distance de lui
export const QUICKSAND_R: [number, number] = [60, 95]; // rayon (une ellipse : r × 0,6 r)
export const QUICKSAND_OPEN_S = 0.8; // il s'ouvre en ce temps (il s'élargit depuis un point)…
export const QUICKSAND_LIFE_S = 20; // … et se referme au bout de ce temps
export const QUICKSAND_SLOW = 0.4; // on y avance à 40 % de sa vitesse…
export const QUICKSAND_GRACE_S = 1; // … et passé 1 s dedans, on s'enlise…
export const QUICKSAND_SINK = 0.03; // … 3 % des PV max la première seconde…
export const QUICKSAND_GROWTH = 1.8; // … puis × 1,8 chaque seconde (3, 5,4, 9,7, 17,5, 31,5 %…), jusqu'à en sortir (en vol : rien)
/** Dégâts de la n-ième seconde d'enlisement (n = 0 : la première), en part des PV max. */
export const quicksandSink = (n: number) => QUICKSAND_SINK * QUICKSAND_GROWTH ** Math.max(0, n);
export const BOSS_HP_BONUS = 1.2; // PV des géants : +20 % par-dessus le tableau des espèces
export const BOSS_TALK_R = 140; // distance (depuis le bord du géant) pour lui parler et lancer le combat
export const BOSS_SOUL_DROP = 0.35;
// Coffre du géant vaincu : chaque dompteur l'ouvre une fois, pour un montant d'or tiré au hasard (× l'or du géant).
export const CHEST_GOLD: [number, number] = [0.75, 2]; // chance, pour chaque dompteur présent, d'obtenir l'âme
export const CAVE_CD = 1; // s entre deux passages d'entrée ou de sortie de grotte (un double clic ne fait pas ressortir)
export const CAVE_RX = 560; // intérieur elliptique des grottes
export const CAVE_RY = 400;

// Filons d'or : on les mine en restant à côté (attaque automatique quand aucun monstre n'est à portée).
export const ORE_R = 16;
export const oreHp = (zone: number) => 30 + 30 * zone;
export const oreGold = (zone: number) => 12 * zone + 6;
export const ORE_RESPAWN_S = 180;
/**
 * Essences pour éveiller l'Alpha d'une espèce : de 15 (Lisière) à 30 (Mer de sable), le double pour un monstre
 * sauvage agressif (le gibier passif, lui, se laisse amadouer). Une espèce rare peut fixer son propre prix.
 */
export const alphaCreateCost = (species: number) => {
  const sp = SPECIES[species], base = Math.round(15 + (15 * (sp.zone - 1)) / (ZONES - 1));
  return sp.awaken ?? (sp.passive ? base : base * 2);
};
/** Temps d'éveil d'un Alpha après avoir payé ses essences : plus l'espèce est forte, plus c'est long. */
export const alphaAwakenS = (species: number) => 30 * SPECIES[species].zone;
export const ESSENCE_DROP = 0.35; // chance, pour chaque dompteur proche, qu'un monstre vaincu lâche une essence
export const alphaLevelMult = (lvl: number) => 1 + 0.15 * lvl; // +15 % de PV et de dégâts par niveau
/** Résurrection d'un Alpha : plus son espèce est forte (zone), plus elle est longue. Le niveau n'y change rien. */
export const alphaReviveS = (species: number) => 10 + 8 * SPECIES[species].zone;
/** Essences pour renforcer un Alpha de ce niveau au suivant : ×1,6 par niveau, +15 % par zone après la Lisière. */
export const alphaUpCost = (species: number, lvl: number) =>
  Math.round(10 * (1 + 0.15 * (SPECIES[species].zone - 1)) * Math.pow(1.6, lvl)); // Lisière : 10, 16, 26, 41, 66…
export const isBoss = (species: number) => !!SPECIES[species]?.boss;
/** Boss géant d'une espèce (dont l'âme rend légendaire l'Alpha de cette espèce), ou -1. */
export const bossOf = (species: number) => SPECIES.findIndex((b) => b.boss && b.base === SPECIES[species]?.key);
// Alpha légendaire : une âme du boss de l'espèce fait évoluer son Alpha.
export const LEGEND_SOULS = 3;
export const LEGEND_MULT = { hp: 1.2, dmg: 1.2, size: 1.15 };
// Il hérite aussi des attaques spéciales de son géant, lancées seul en combat : un peu moins fortes et moins fréquentes.
export const LEGEND_MOVE_DMG = 0.4;
export const LEGEND_MOVE_CD = 1.5;
export const LEGEND_STAGGER_S = 1.2; // deux attaques spéciales des légendaires d'un même dompteur sont espacées d'au moins ce temps
export const LEGEND_AIM_S = 2.5; // un monstre déjà visé par un légendaire depuis moins que ça : les autres en choisissent un autre
/** Bonus de collection : +5 % de PV et de dégâts à tous les Alphas par Alpha éveillé (3 Alphas = +15 %). */
export const COLLECTION_BONUS = 0.05;
export const collectionMult = (alphaCount: number) => 1 + COLLECTION_BONUS * Math.max(0, alphaCount);
/** PV et dégâts d'un Alpha (niveau, nombre d'Alphas éveillés par son dompteur, légendaire ou non). */
export function alphaStats(species: number, lvl: number, alphaCount: number, legend = false) {
  const sp = SPECIES[species];
  const k = alphaLevelMult(lvl) * collectionMult(alphaCount);
  const l = legend ? LEGEND_MULT : { hp: 1, dmg: 1, size: 1 };
  return {
    hp: Math.round(sp.hp * ALPHA_MULT.hp * k * l.hp),
    dmg: Math.round(sp.dmg * ALPHA_MULT.dmg * k * l.dmg),
    r: Math.round(sp.r * ALPHA_MULT.size * l.size),
  };
}

// ───────────────────────── Attaques spéciales des mini-boss ─────────────────────────
// Chaque attaque est annoncée au sol (zone rouge) avant de frapper : on peut l'esquiver.
export type BossMove = (
  | { kind: 'leap'; cd: number } // bondit sur une cible et écrase la zone d'arrivée
  | { kind: 'split'; at: number[]; n: number } // se divise en petits monstres à ces seuils de PV
  | { kind: 'spores'; cd: number } // nuages de spores sous les dompteurs : dégâts dans la durée
  | { kind: 'summon'; cd: number; n: number; max: number; minion?: string } // appelle des renforts de son espèce (ou de l'espèce minion)
  | { kind: 'charge'; cd: number } // charge en ligne droite
  | { kind: 'web'; cd: number } // toiles qui ralentissent
  | { kind: 'slam'; cd: number; power?: number; fire?: boolean } // onde de choc tout autour de lui (power : multiplicateur des dégâts, 1,5 par défaut ; fire : une vague de flammes)
  | { kind: 'enrage'; below: number } // s'enrage sous ce seuil de PV
  | { kind: 'rocks'; cd: number } // projette des rochers sur plusieurs cibles
  | { kind: 'blink'; cd: number; fire?: boolean } // disparaît et réapparaît près d'une cible (fire : il laisse un cratère de feu)
  | { kind: 'volley'; cd: number; n: number; shot: 'bolt' | 'jet' | 'dart' | 'fire' | 'spark'; pierce?: boolean } // salve de projectiles en éventail (esquivable) ; pierce : ils traversent la meute
  | { kind: 'mortar'; cd: number; n: number } // pluie de tirs en cloche, cercles annoncés au sol
  | { kind: 'trail'; cd: number; dur: number } // pendant dur secondes, il laisse derrière lui des flaques de lave qui brûlent
  | { kind: 'spin'; cd: number; arms: number; dur: number } // il s'arrête : des jets de flammes tournent autour de lui (annoncés au sol)
  | { kind: 'lash'; cd: number; n: number } // coups de tentacule : des couloirs annoncés vers ses cibles, qui s'abattent d'un coup
  | { kind: 'ink'; cd: number } // nuages d'encre sous les dompteurs : ils brûlent et ralentissent
  | { kind: 'laser'; cd: number; dur: number; turn: number } // il s'arrête : un rayon annoncé vers sa cible, maintenu dur secondes en tournant (turn rad/s)
  | { kind: 'pound'; cd: number } // il fracasse le sol devant lui, sur sa cible (le gorille : pas d'onde de choc)
  | { kind: 'pincer'; cd: number } // grosse pince : il découpe tout ce qui est devant lui, dans un large arc (annoncé au sol)
  | { kind: 'bubbles'; cd: number; n: number } // bulles d'écume qui gonflent sous et autour des cibles, puis éclatent (et collent)
  | { kind: 'tongue'; cd: number; n: number } // coups de langue : un couloir vers chaque cible ; ce qu'elle touche est ramené contre lui
  | { kind: 'geyser'; cd: number; n: number } // geysers qui jaillissent sous les cibles, en chaîne
  | { kind: 'breath'; cd: number; heads: number; dur: number } // souffle de ses têtes : des jets d'eau qui balaient l'avant
  | { kind: 'tornado'; cd: number; n: number; dur: number } // tornades qui poursuivent les cibles : elles blessent et aspirent
  | { kind: 'stalk'; cd: number } // il se fond dans l'ombre, file au ras du sol et bondit dans le dos de sa cible
  | { kind: 'howl'; cd: number } // hurlement : les dompteurs autour sont ralentis, ses renforts enragent
  | { kind: 'rampage'; cd: number; n: number } // ruée folle : n charges d'affilée, il rebondit sur les murs et les rochers
  | { kind: 'mud'; cd: number; n: number } // il projette de la boue : des flaques qui collent
  | { kind: 'hug'; cd: number } // étreinte : il saisit le plus proche, qui ne peut plus bouger, et le broie
  | { kind: 'hibernate'; below: number } // sous ce seuil de PV, il s'endort pour guérir (sauf si on le frappe assez fort)
  | { kind: 'shrooms'; cd: number; n: number } // des champignons poussent dans l'arène : ils explosent quand on passe à côté
  | { kind: 'decoys'; cd: number; n: number } // il se divise : n leurres et lui, au même visage ; les leurres explosent
  | { kind: 'venomdive'; cd: number } // elle s'envole hors de vue, puis fond sur sa cible et laisse une mare de venin
  | { kind: 'drum'; cd: number; n: number } // tambour de guerre : n anneaux d'onde l'un après l'autre, avec des brèches où passer
  | { kind: 'log'; cd: number } // il arrache un tronc et le fait rouler droit sur sa cible
  | { kind: 'tail'; cd: number } // coup de queue : un large balayage, vers ceux qui se croient à l'abri
  | { kind: 'roll'; cd: number } // roulade de la mort : il happe sa cible et l'entraîne en tournoyant
  | { kind: 'ambush'; cd: number } // embuscade : il plonge (eau, sable), file sous sa cible et surgit
  | { kind: 'totem'; cd: number; max: number } // il plante un totem qui soigne les siens (à casser)
  | { kind: 'curse'; cd: number } // malédiction : la cible marquée subit plus de dégâts
  | { kind: 'maw'; cd: number } // gueule des dunes : des sables mouvants s'ouvrent sous les dompteurs, aspirent et mordent
  | { kind: 'eclipse'; cd: number; dur: number } // éclipse : la nuit tombe sur l'arène, on ne voit plus qu'autour de soi
  | { kind: 'mirage'; cd: number; n: number } // reflets de lune : n copies spectrales foncent sur la cible
  | { kind: 'impale'; cd: number } // dard empaleur : un long coup de queue en ligne, qui empoisonne fort
  | { kind: 'molt'; cd: number } // mue : elle laisse sa vieille peau, qui explose, et file
  | { kind: 'tailcut'; at: number[] } // à ces seuils de PV, sa queue tombe et se bat seule (elle repousse)
  | { kind: 'echo'; cd: number; n: number } // écholocation : des anneaux sonores qui étourdissent
  | { kind: 'roost'; cd: number; dur: number } // il s'accroche au plafond, hors d'atteinte : braises et nuée, puis il fond
  | { kind: 'shellspin'; cd: number; dur: number } // toupie : rentrée dans sa carapace, elle rebondit dans l'arène
) & { from?: number }; // from : phase de combat à partir de laquelle il s'en sert (géant à plusieurs phases)

export const BOSS_MOVES: Record<string, BossMove[]> = {
  slime_queen: [{ kind: 'leap', cd: 6 }, { kind: 'split', at: [0.66, 0.33], n: 3 }],
  spore_giant: [{ kind: 'spores', cd: 5 }, { kind: 'shrooms', cd: 10, n: 5 }, { kind: 'summon', cd: 12, n: 3, max: 6 }],
  shadow_fang: [{ kind: 'stalk', cd: 6 }, { kind: 'howl', cd: 11 }, { kind: 'summon', cd: 12, n: 2, max: 4 }],
  weaver: [{ kind: 'web', cd: 4 }, { kind: 'summon', cd: 10, n: 3, max: 6 }],
  old_tusk: [{ kind: 'rampage', cd: 7, n: 3 }, { kind: 'mud', cd: 9, n: 3 }],
  colossus: [{ kind: 'slam', cd: 6, power: 4 }, { kind: 'hug', cd: 9 }, { kind: 'hibernate', below: 0.4 }], // onde de choc de l'ours : plus forte que les autres
  moss_heart: [{ kind: 'rocks', cd: 5 }, { kind: 'slam', cd: 8 }],
  old_flame: [{ kind: 'blink', cd: 6, fire: true }, { kind: 'decoys', cd: 12, n: 2 }], // il se téléporte en laissant un cratère de feu ; il se divise en trois feux follets
  rune_eye: [{ kind: 'volley', cd: 4, n: 5, shot: 'bolt', pierce: true }, { kind: 'laser', cd: 10, dur: 3.5, turn: 0.9 }, { kind: 'summon', cd: 11, n: 2, max: 4 }], // ses traits traversent la meute ; son rayon balaie
  // Lacs brumeux : le roi des mares crache sa langue (et ramène sa proie), pilonne de têtards et bondit ; l'hydre
  // souffle de ses trois têtes et fait jaillir les geysers ; le crabe titan découpe dans le tas et noie tout sous l'écume
  toad_king: [{ kind: 'tongue', cd: 5, n: 2 }, { kind: 'mortar', cd: 6, n: 5 }, { kind: 'leap', cd: 8 }],
  mist_hydra: [{ kind: 'breath', cd: 7, heads: 3, dur: 2.6 }, { kind: 'geyser', cd: 6, n: 5 }, { kind: 'volley', cd: 4, n: 3, shot: 'jet' }],
  titan_crab: [{ kind: 'pincer', cd: 4.5 }, { kind: 'bubbles', cd: 7, n: 5 }, { kind: 'enrage', below: 0.3 }],
  sand_queen: [{ kind: 'blink', cd: 5 }, { kind: 'maw', cd: 9 }, { kind: 'summon', cd: 11, n: 2, max: 4 }], // elle plonge et resurgit sous sa cible ; le sable s'ouvre en gueules
  vulture_king: [{ kind: 'tornado', cd: 9, n: 2, dur: 6 }, { kind: 'leap', cd: 5 }, { kind: 'summon', cd: 11, n: 2, max: 4 }], // tornades, piqués, ses vautours
  drake_king: [{ kind: 'volley', cd: 5, n: 3, shot: 'spark' }, { kind: 'charge', cd: 6 }, { kind: 'slam', cd: 8 }, { kind: 'summon', cd: 12, n: 2, max: 4 }, { kind: 'enrage', below: 0.3 }], // décharges électriques en éventail (elles rebondissent sur ceux qui se tiennent à côté), il charge, ses petits
  wyvern_king: [{ kind: 'leap', cd: 6 }, { kind: 'venomdive', cd: 10 }, { kind: 'volley', cd: 5, n: 6, shot: 'dart' }, { kind: 'charge', cd: 7 }, { kind: 'enrage', below: 0.35 }], // elle bondit, fond du ciel dans une mare de venin, épines de sa queue (poison)
  dragon_king: [{ kind: 'spin', cd: 9, arms: 3, dur: 3.5 }, { kind: 'volley', cd: 6, n: 5, shot: 'fire' }, { kind: 'trail', cd: 11, dur: 4 }, { kind: 'leap', cd: 8 }, { kind: 'slam', cd: 7, power: 2, fire: true }, { kind: 'enrage', below: 0.3 }], // souffle de feu tournoyant, boules de feu en éventail, il embrase le sol
  scorpion_king: [{ kind: 'impale', cd: 6 }, { kind: 'volley', cd: 5, n: 5, shot: 'dart' }, { kind: 'ambush', cd: 10 }, { kind: 'summon', cd: 11, n: 2, max: 4 }, { kind: 'enrage', below: 0.3 }], // dard empaleur, crachats de venin, il s'enfouit, ses scorpions
  moon_jackal: [{ kind: 'mirage', cd: 6, n: 3 }, { kind: 'eclipse', cd: 16, dur: 7 }, { kind: 'summon', cd: 9, n: 3, max: 6 }],
  // elle fonce en laissant une traînée de lave, appelle ses petits
  salamander_queen: [{ kind: 'trail', cd: 7, dur: 4 }, { kind: 'molt', cd: 11 }, { kind: 'tailcut', at: [0.66, 0.33] }, { kind: 'summon', cd: 10, n: 3, max: 6 }, { kind: 'enrage', below: 0.35 }],
  // piqués, tourbillon de flammes, il disparaît dans la cendre, sa nuée
  ash_lord: [{ kind: 'echo', cd: 7, n: 2 }, { kind: 'spin', cd: 9, arms: 3, dur: 3.5 }, { kind: 'roost', cd: 15, dur: 5 }, { kind: 'blink', cd: 7 }, { kind: 'summon', cd: 10, n: 3, max: 6 }],
  // son volcan crache, ses jets de flammes tournent, il sème la lave, il fait trembler le sol
  // Le Kraken, en haute mer : trois phases (chaque fois vaincu, il replonge et revient avec toute sa vie, plus redoutable)
  kraken: [
    { kind: 'lash', cd: 4, n: 2 }, { kind: 'summon', cd: 10, n: 2, max: 4, minion: 'kraken_tentacle' },
    { kind: 'ink', cd: 7, from: 2 }, { kind: 'lash', cd: 3, n: 3, from: 2 },
    { kind: 'mortar', cd: 6, n: 6, from: 3 }, { kind: 'summon', cd: 8, n: 3, max: 6, minion: 'kraken_tentacle', from: 3 },
  ],
  // Jungle : le roi gorille fracasse le sol et fait pleuvoir les bananes ; le vieux crocodile charge et fouette de la
  // queue ; le Grand Masque crache ses fléchettes, empoisonne l'air, disparaît et appelle les siens
  gorilla_king: [{ kind: 'drum', cd: 10, n: 4 }, { kind: 'log', cd: 7 }, { kind: 'mortar', cd: 8, n: 6 }, { kind: 'leap', cd: 9 }, { kind: 'enrage', below: 0.3 }],
  croc_king: [{ kind: 'tail', cd: 5 }, { kind: 'roll', cd: 9 }, { kind: 'ambush', cd: 11 }, { kind: 'enrage', below: 0.35 }],
  mask_lord: [{ kind: 'volley', cd: 4, n: 5, shot: 'dart' }, { kind: 'curse', cd: 9 }, { kind: 'totem', cd: 13, max: 2 }, { kind: 'blink', cd: 7 }, { kind: 'summon', cd: 10, n: 3, max: 6 }],
  mountain_tortoise: [{ kind: 'mortar', cd: 5, n: 6 }, { kind: 'spin', cd: 10, arms: 4, dur: 4 }, { kind: 'trail', cd: 12, dur: 5 }, { kind: 'shellspin', cd: 13, dur: 4.5 }, { kind: 'enrage', below: 0.3 }],
};
/** Coup ordinaire d'un géant : une seule cible (deux pour la reine des Gluants et l'ours), dégâts multipliés. */
const BOSS_MELEE: Record<string, { targets: number; mult: number }> = { slime_queen: { targets: 2, mult: 1.3 }, colossus: { targets: 2, mult: 1.3 } };
export const bossMelee = (key: string) => BOSS_MELEE[key] ?? { targets: 1, mult: 1.6 };
export const MOVE_NAMES: Record<BossMove['kind'], string> = {
  leap: 'Bond écrasant', split: 'Division', spores: 'Nuages de spores', summon: 'Renforts', charge: 'Charge',
  web: 'Toiles', slam: 'Onde de choc', enrage: 'Rage', rocks: 'Pluie de rochers', blink: 'Clignement',
  volley: 'Salve', mortar: 'Pluie de mortiers', trail: 'Traînée de lave', spin: 'Tourbillon de flammes', lash: 'Coup de tentacule', ink: 'Nuage d\'encre', laser: 'Rayon runique',
  pound: 'Fracasse le sol', pincer: 'Grande pince', bubbles: 'Écume', tongue: 'Coup de langue', geyser: 'Geysers', breath: 'Souffle des trois têtes', tornado: 'Tornades',
  stalk: 'Traque', howl: 'Hurlement', rampage: 'Ruée folle', mud: 'Bauge', hug: 'Étreinte', hibernate: 'Hibernation', shrooms: 'Champignonnière',
  decoys: 'Lueurs trompeuses', venomdive: 'Piqué venimeux', drum: 'Tambour de guerre', log: 'Lancer de tronc', tail: 'Coup de queue',
  roll: 'Roulade de la mort', ambush: 'Embuscade', totem: 'Totem', curse: 'Malédiction', maw: 'Gueule des dunes', eclipse: 'Éclipse',
  mirage: 'Reflets de lune', impale: 'Dard empaleur', molt: 'Mue', tailcut: 'Queue repoussée', echo: 'Écholocation', roost: 'Suspendu',
  shellspin: 'Toupie de lave',
};
/** Attaques que n'hérite pas un Alpha légendaire : elles appellent des renforts ou ne valent que contre les dompteurs. */
export const LEGEND_SKIPS = new Set<BossMove['kind']>(['summon', 'decoys', 'totem', 'roost', 'eclipse']);
// Réglages des nouvelles attaques des géants
export const HUG_S = 2.2; // étreinte de l'ours : la cible ne bouge plus pendant ce temps (il la broie)
export const ROLL_S = 1.8; // roulade du crocodile : pareil, en tournoyant
export const RING_SPEED = 300; // tambour de guerre, écholocation : vitesse des anneaux (px/s)…
export const RING_W = 26; // … leur épaisseur (demi)…
export const DRUM_R = 540; // … jusqu'où va le tambour du gorille…
export const ECHO_R = 460; // … et le cri de la chauve-souris
export const DRUM_GAP = 0.42; // demi-angle de chacune des deux brèches d'un anneau de tambour (on s'y glisse)
export const ECHO_STUN_S = 0.8; // un anneau d'écholocation étourdit (on ne bouge plus) ce temps-là
export const LOG_SPEED = 720; // le tronc roule à cette vitesse (px/s)
export const RAMPAGE_SPEED = 900; // le sanglier fonce à cette vitesse pendant sa ruée
export const MAW_PULL = 95; // gueule des dunes : elle aspire vers son centre (px/s)…
export const MAW_R = 125; // … sur ce rayon (et un peu au-delà)
export const CURSE_S = 7; // malédiction : la cible subit CURSE_BONUS de dégâts en plus pendant ce temps
export const CURSE_BONUS = 0.35;
export const SHELL_SPEED = 430; // toupie de lave : vitesse de la carapace qui rebondit
export const DECOY_S = 8; // leurres du Feu Ancien : ils explosent au bout de ce temps (ou quand on les abat)
/** Arc de la grande pince (demi-angle, en radians) et sa portée. */
export const PINCER_HALF = 0.8;
export const PINCER_R = 210;
/** Tornade : rayon, vitesse (elle poursuit), aspiration (px/s vers son cœur, dans TORNADO_PULL_R). */
export const TORNADO_R = 70;
export const TORNADO_SPEED = 120;
export const TORNADO_PULL = 150;
export const TORNADO_PULL_R = 230;
/** Fléchettes des Petits Masqués, dard du scorpion : poison (part des dégâts du coup, chaque seconde, pendant POISON_S). */
/** Décharge du Grand Drake : elle rebondit de sa cible sur les ennemis proches (bonds, distance, dégâts gardés à chaque bond). */
export const SPARK_JUMPS = 2;
export const SPARK_R = 190;
export const SPARK_FALLOFF = 0.7;
export const POISON_DPS = 0.18;
export const POISON_S = 4;
// Les géants poursuivent : quand leur cible s'éloigne, ils accélèrent (impossible de les tuer en reculant).
export const BOSS_CHASE_R = 0; // dès que sa cible n'est plus au contact
export const BOSS_CHASE_MULT = 1.45; // 270 à 340 px/s, plus rapide que le dompteur (210)
export const WEB_SLOW = 0.5; // vitesse sous l'effet d'une toile
export const WEB_SLOW_S = 2.5;

export type SpeciesId = number; // index dans SPECIES (l'ordre est sauvegardé : n'ajouter qu'à la fin)

export interface Species {
  key: string;
  name: string;
  color: string;
  r: number;
  hp: number;
  dmg: number;
  speed: number;
  atkCd: number;
  gold: number;
  zone: number; // 1 à ZONES : zones de plus en plus dangereuses en s'éloignant de la plage d'arrivée
  population: number;
  pack: [number, number];
  boss?: boolean; // mini-boss de grotte : n'apparaît que dans sa grotte, ne s'apprivoise pas, lâche son âme
  phases?: number; // géant à plusieurs phases : vaincu, il reprend toute sa vie jusqu'à la dernière
  anchored?: boolean; // ne se déplace pas (le Kraken dans l'eau, ses tentacules accrochés au bateau)
  minion?: boolean; // renfort d'un géant seulement : ni or, ni essence, ni bestiaire
  base?: string; // boss : espèce dont il est la version géante (son âme rend légendaire l'Alpha de cette espèce)
  sprite?: string; // apparence à réutiliser (par défaut : key)
  ranged?: Ranged; // tireur : attaque à distance (projectile esquivable) au lieu du corps à corps
  swim?: boolean; // sauvage, il ne quitte jamais l'eau (apprivoisé, il suit son dompteur sur terre et dans l'eau)
  amphibious?: boolean; // apprivoisé, il suit son dompteur dans l'eau (sauvage, il reste à terre)
  night?: boolean; // n'apparaît que la nuit (il s'envole au lever du jour)
  day?: boolean; // n'apparaît que le jour (il s'enfouit au coucher du soleil)
  season?: number; // n'apparaît qu'en cette saison (0 printemps … 3 hiver, voir weather.ts) : il s'en va quand elle finit
  venom?: boolean; // ses coups au corps à corps empoisonnent (le scorpion)
  optional?: boolean; // géant ajouté après coup : ni porte, ni parchemin, ni volcan, ni bateau n'en dépendent
  isle?: boolean; // vit sur un îlot du large (son géant, dans une grotte de l'îlot) : on y va à dos de serpent
  tome?: [LessonKind, number]; // géant d'un îlot : le tome qu'il garde dans son coffre (discipline, tome I, II ou III)
  sleeps?: 'night' | 'day'; // sauvage, il dort la nuit (lièvre) ou le jour (ours) : ni aggro ni errance, jusqu'à ce qu'on le frappe
  shell?: boolean; // sauvage, il rentre dans sa coquille (intouchable) quand un dompteur sans fruit en main approche
  rainSpeed?: number; // sauvage, sa vitesse sous une grosse averse (multiplicateur ; l'escargot aime la pluie)
  burrows?: boolean; // sauvage, il file sous le sable (intouchable) et surgit sous sa cible (cercle annoncé), puis reste exposé
  flies?: boolean; // sauvage, il tourne au-dessus de sa cible (hors d'atteinte), pique là où tombe son ombre (cercle annoncé), puis reste un moment au sol
  shy?: boolean; // gibier craintif : un dompteur sans fruit en main ou un vautour approche, et la colonie court se cacher dans sa tanière (elle y passe aussi la nuit)
  skittish?: boolean; // sauvage, il détale devant un dompteur qui approche sans fruit en main (lièvre)
  awaken?: number; // essences pour éveiller son Alpha, si elles ne suivent pas la règle (espèce rare)
  passive?: boolean; // sauvage, il n'attaque jamais : il broute les buissons à fruits et s'enfuit quand on le frappe
  brawler?: boolean; // tireur qui cogne aussi : une cible collée à lui, il la frappe au corps à corps au lieu de tirer (gorille)
  reach?: number; // portée en plus au corps à corps (le crocodile se jette hors de l'eau sur ce qui passe au bord)
  ambush?: boolean; // sauvage nageur qui sort de l'eau pour attaquer ce qui passe, puis y retourne (le crocodile)
  mimic?: string; // renfort qui a l'apparence d'un géant (clé d'espèce) : les leurres du Feu Ancien
  frail?: number; // renfort : il encaisse les coups multipliés par ceci (un leurre tombe en quelques coups)
  inert?: boolean; // renfort qui ne bouge ni ne frappe (le totem du Grand Masque)
  moves?: BossMove[]; // attaques spéciales d'un monstre ordinaire (le gorille fracasse le sol), sauvage comme apprivoisé
}

/**
 * Tir à distance. bolt : projectile lent en ligne droite ; jet : rapide en ligne droite ;
 * arc : tir en cloche qui retombe là où était la cible (cercle annoncé au sol), dégâts de zone.
 */
export interface Ranged {
  kind: 'bolt' | 'arc' | 'jet' | 'banana' | 'dart' | 'fire' | 'spark'; // banana : lancée en cloche (comme arc) ; dart : fléchette de sarbacane (comme jet) ;
  // fire : boule de feu en ligne droite (dragonnet) ; spark : décharge électrique qui rebondit sur les ennemis proches (Grand Drake)
  range: number;
  windup: number; // s d'immobilité à charger le tir (lisible : on voit venir le coup)
  speed: number; // px/s (bolt, jet) ; arc : durée de vol fixe
  splash?: number; // arc : rayon des dégâts à l'impact
}
export const SHOT_KINDS = ['bolt', 'arc', 'jet', 'banana', 'dart', 'fire', 'spark'] as const; // n'ajouter qu'à la fin
/** Tir en cloche (il retombe là où était la cible, cercle annoncé au sol) : arc, banane du gorille. */
export const lobbedShot = (kind: number | Ranged['kind']) => { const k = typeof kind === 'number' ? SHOT_KINDS[kind] : kind; return k === 'arc' || k === 'banana'; };
export const ARC_FLIGHT_S = 0.9;

// Deux à trois espèces par zone, progression marquée d'une zone à l'autre (PV et dégâts ×2,5 à ×3).
// L'index de chaque espèce sert dans les profils sauvegardés (essences, Alphas) : n'ajouter qu'à la fin.
export const SPECIES: Species[] = [
  { key: 'slime', name: 'Gluant', color: '#7FCB5B', r: 14, hp: 25, dmg: 2, speed: 70, atkCd: 1.2, gold: 2, zone: 1, population: 57, pack: [2, 4] },
  { key: 'wolf', name: 'Loup', color: '#8A93A8', r: 19, hp: 70, dmg: 9, speed: 135, atkCd: 0.8, gold: 5, zone: 2, population: 43, pack: [2, 4] },
  { key: 'boar', name: 'Sanglier', color: '#8B5E3C', r: 20, hp: 180, dmg: 18, speed: 95, atkCd: 1.1, gold: 10, zone: 3, population: 34, pack: [1, 3] }, // bête de nuit : il ne dort pas
  { key: 'golem', name: 'Golem de mousse', color: '#5F7A5A', r: 24, hp: 340, dmg: 32, speed: 60, atkCd: 1.4, gold: 20, zone: 4, population: 30, pack: [1, 2] },
  { key: 'sporelin', name: 'Sporelin', color: '#C8553D', r: 13, hp: 18, dmg: 5, speed: 95, atkCd: 1.0, gold: 2, zone: 1, population: 38, pack: [3, 5] },
  { key: 'spider', name: 'Araignée sylvestre', color: '#6A4E7E', r: 17, hp: 55, dmg: 11, speed: 155, atkCd: 0.9, gold: 5, zone: 2, population: 30, pack: [1, 3] },
  { key: 'bear', name: 'Ours des fourrés', color: '#6B4A33', r: 24, hp: 240, dmg: 15, speed: 80, atkCd: 1.3, gold: 12, zone: 3, population: 24, pack: [1, 1], sleeps: 'day' }, // il chasse la nuit, dort le jour
  { key: 'wisp', name: 'Feu follet', color: '#6FB7FF', r: 18, hp: 300, dmg: 40, speed: 110, atkCd: 1.2, gold: 22, zone: 4, population: 21, pack: [1, 2] },
  // Mini-boss des grottes : la version géante de chaque espèce. Leur « essence » est leur âme.
  // (ordre conservé : les index servent dans les sauvegardes)
  { key: 'slime_queen', name: 'Gluant Géant', color: '#9BE070', r: 60, hp: 720, dmg: 8, speed: 190, atkCd: 1.1, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, sprite: 'slime', base: 'slime' },
  { key: 'shadow_fang', name: "Croc-d'Ombre", color: '#4A4E6A', r: 48, hp: 2140, dmg: 22, speed: 235, atkCd: 0.8, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, sprite: 'wolf', base: 'wolf' },
  { key: 'old_tusk', name: 'Vieille-Défense', color: '#6E3F24', r: 54, hp: 5590, dmg: 40, speed: 200, atkCd: 1.1, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, sprite: 'boar', base: 'boar' },
  { key: 'moss_heart', name: 'Cœur-de-Mousse', color: '#3F5E45', r: 63, hp: 14170, dmg: 65, speed: 185, atkCd: 1.5, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'golem', base: 'golem' },
  { key: 'spore_giant', name: 'Champignon Géant', color: '#B8432E', r: 57, hp: 610, dmg: 9, speed: 205, atkCd: 1.2, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, sprite: 'sporelin', base: 'sporelin' },
  { key: 'weaver', name: 'Mère Tisseuse', color: '#4E3760', r: 51, hp: 1880, dmg: 24, speed: 220, atkCd: 0.9, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, sprite: 'spider', base: 'spider' },
  { key: 'colossus', name: 'Ours Colosse', color: '#4F3524', r: 63, hp: 5000, dmg: 34, speed: 190, atkCd: 1.3, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, sprite: 'bear', base: 'bear' },
  { key: 'old_flame', name: 'Feu Ancien', color: '#4F8BFF', r: 54, hp: 11380, dmg: 75, speed: 200, atkCd: 1.3, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'wisp', base: 'wisp' },
  // Itération 16 : un tireur dans les Ruines moussues, et la zone 5 (Lacs brumeux) au-delà du Camp avancé.
  { key: 'watcher', name: 'Guetteur runique', color: '#6E7570', r: 22, hp: 320, dmg: 38, speed: 55, atkCd: 2.0, gold: 20, zone: 4, population: 22, pack: [1, 2], ranged: { kind: 'bolt', range: 320, windup: 0.6, speed: 260 } },
  { key: 'toad', name: 'Crapaud-mortier', color: '#6E8F45', r: 24, hp: 900, dmg: 50, speed: 75, atkCd: 2.4, gold: 40, zone: 5, population: 18, pack: [1, 2], ranged: { kind: 'arc', range: 340, windup: 0.55, speed: 0, splash: 52 }, amphibious: true },
  { key: 'serpent', name: 'Serpent des brumes', color: '#4A93A0', r: 22, hp: 700, dmg: 45, speed: 105, atkCd: 1.8, gold: 36, zone: 5, population: 16, pack: [1, 1], ranged: { kind: 'jet', range: 360, windup: 0.45, speed: 560 }, swim: true },
  { key: 'crab', name: 'Crabe des berges', color: '#D46A43', r: 24, hp: 1050, dmg: 55, speed: 70, atkCd: 1.4, gold: 45, zone: 5, population: 16, pack: [1, 2], amphibious: true },
  // Géants des nouvelles espèces : une grotte chacun (zone 4 : Œil des Ruines ; zone 5 : les trois autres).
  { key: 'rune_eye', name: 'Œil des Ruines', color: '#5E6662', r: 57, hp: 12480, dmg: 70, speed: 185, atkCd: 1.4, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'watcher', base: 'watcher' },
  { key: 'toad_king', name: 'Crapaud-Roi', color: '#5F8A3A', r: 60, hp: 27170, dmg: 100, speed: 190, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'toad', base: 'toad' },
  { key: 'mist_hydra', name: 'Hydre des brumes', color: '#3E8290', r: 57, hp: 23400, dmg: 95, speed: 205, atkCd: 1.2, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'serpent', base: 'serpent' },
  { key: 'titan_crab', name: 'Crabe Titan', color: '#B9532F', r: 63, hp: 34580, dmg: 110, speed: 185, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'crab', base: 'crab' },
  // Gibier passif : il broute les buissons à fruits et s'enfuit quand on le frappe (pas de géant). S'apprivoise surtout aux baies.
  { key: 'hare', name: 'Lièvre des ronces', color: '#B89A72', r: 13, hp: 30, dmg: 2, speed: 150, atkCd: 1.0, gold: 3, zone: 3, population: 20, pack: [1, 3], passive: true, sleeps: 'night', skittish: true },
  { key: 'snail', name: 'Escargot des mousses', color: '#C99A5B', r: 12, hp: 22, dmg: 1, speed: 32, atkCd: 1.4, gold: 2, zone: 1, population: 20, pack: [1, 2], passive: true, shell: true, rainSpeed: 1.5 },
  // Gibier de nuit : il n'apparaît qu'une fois la nuit tombée, et s'en va au lever du jour.
  { key: 'firefly', name: 'Luciole', color: '#E4F07A', r: 11, hp: 20, dmg: 1, speed: 70, atkCd: 1.4, gold: 4, zone: 2, population: 24, pack: [3, 5], passive: true, night: true },
  // Zone 6 (Mer de sable) : suricates craintifs autour de leurs tanières, vers fouisseurs, vautours ; chacals fantômes la nuit.
  { key: 'meerkat', name: 'Suricate', color: '#C9A06A', r: 12, hp: 60, dmg: 3, speed: 125, atkCd: 1.2, gold: 8, zone: 7, population: 26, pack: [3, 6], passive: true, shy: true },
  { key: 'sandworm', name: 'Ver des sables', color: '#B98A5A', r: 26, hp: 2600, dmg: 120, speed: 115, atkCd: 1.6, gold: 100, zone: 7, population: 16, pack: [1, 1], burrows: true },
  { key: 'vulture', name: 'Vautour', color: '#4A3A30', r: 21, hp: 1700, dmg: 110, speed: 150, atkCd: 1.1, gold: 90, zone: 7, population: 18, pack: [1, 2], flies: true },
  { key: 'jackal', name: 'Chacal fantôme', color: '#CDBB98', r: 21, hp: 1400, dmg: 90, speed: 175, atkCd: 0.9, gold: 80, zone: 7, population: 24, pack: [4, 6], night: true },
  // Géants de la Mer de sable : une grotte chacun.
  { key: 'sand_queen', name: 'Reine des sables', color: '#A87A4A', r: 66, hp: 86000, dmg: 300, speed: 190, atkCd: 1.3, gold: 2500, zone: 7, population: 0, pack: [1, 1], boss: true, sprite: 'sandworm', base: 'sandworm' },
  { key: 'vulture_king', name: 'Roi-Vautour', color: '#3A2C24', r: 60, hp: 76000, dmg: 280, speed: 200, atkCd: 1.1, gold: 2500, zone: 7, population: 0, pack: [1, 1], boss: true, sprite: 'vulture', base: 'vulture' },
  { key: 'moon_jackal', name: 'Chacal lunaire', color: '#D8CDB0', r: 57, hp: 70000, dmg: 265, speed: 220, atkCd: 0.85, gold: 2500, zone: 7, population: 0, pack: [1, 1], boss: true, sprite: 'jackal', base: 'jackal' },
  // Bois profonds : le Tréant dort dans un arbre ; il en sort parfois quand on l'abat (jamais d'apparition ailleurs).
  { key: 'treant', name: 'Tréant', color: '#6B4E30', r: 24, hp: 160, dmg: 15, speed: 80, atkCd: 1.3, gold: 10, zone: 2, population: 0, pack: [1, 1], awaken: 20 }, // rare : éveil moins cher
  // Entrailles du volcan (zone 7, sous la Mer de sable) : trois espèces qu'on ne voit nulle part ailleurs, et leurs géants
  // (un antre chacun dans la salle).
  { key: 'salamander', name: 'Salamandre de braise', color: '#5A4038', r: 17, hp: 3600, dmg: 260, speed: 150, atkCd: 0.9, gold: 170, zone: 8, population: 16, pack: [2, 4] },
  { key: 'ash_bat', name: 'Chauve-souris de cendre', color: '#4A4448', r: 15, hp: 2800, dmg: 220, speed: 180, atkCd: 0.8, gold: 150, zone: 8, population: 14, pack: [3, 5] },
  { key: 'lava_tortoise', name: 'Tortue-volcan', color: '#4E4038', r: 28, hp: 9000, dmg: 320, speed: 50, atkCd: 2.4, gold: 240, zone: 8, population: 10, pack: [1, 1], ranged: { kind: 'arc', range: 360, windup: 0.7, speed: 0, splash: 60 } },
  { key: 'salamander_queen', name: 'Salamandre-Mère', color: '#4A3430', r: 63, hp: 135000, dmg: 480, speed: 210, atkCd: 1.0, gold: 5000, zone: 8, population: 0, pack: [1, 1], boss: true, sprite: 'salamander', base: 'salamander' },
  { key: 'ash_lord', name: 'Seigneur des cendres', color: '#38323A', r: 60, hp: 125000, dmg: 470, speed: 220, atkCd: 0.9, gold: 5000, zone: 8, population: 0, pack: [1, 1], boss: true, sprite: 'ash_bat', base: 'ash_bat' },
  { key: 'mountain_tortoise', name: 'Tortue-Montagne', color: '#40342E', r: 70, hp: 170000, dmg: 520, speed: 185, atkCd: 1.5, gold: 5000, zone: 8, population: 0, pack: [1, 1], boss: true, sprite: 'lava_tortoise', base: 'lava_tortoise' },
  // Haute mer : le Kraken attaque le bateau sur la route du Colisée ; ses tentacules s'accrochent au pont.
  { key: 'kraken_tentacle', name: 'Tentacule du Kraken', color: '#7A4A8A', r: 32, hp: 9000, dmg: 260, speed: 0, atkCd: 1.3, gold: 0, zone: 9, population: 0, pack: [1, 1], anchored: true, minion: true },
  { key: 'kraken', name: 'Kraken', color: '#6A3E7E', r: 100, hp: 130000, dmg: 480, speed: 0, atkCd: 1.6, gold: 7000, zone: 9, population: 0, pack: [1, 1], boss: true, anchored: true, phases: 3 },
  // Jungle (zone 6, entre les Lacs brumeux et le désert) : gorilles (bananes à distance, poings au contact, il fracasse le
  // sol), crocodiles tapis dans l'eau (on ne voit que leur tête), petits hommes masqués à la sarbacane. Leurs géants
  // dorment au fond de temples.
  { key: 'gorilla', name: 'Gorille des cimes', color: '#3E3A38', r: 24, hp: 1500, dmg: 80, speed: 110, atkCd: 1.3, gold: 60, zone: 6, population: 20, pack: [1, 2], ranged: { kind: 'banana', range: 300, windup: 0.5, speed: 0, splash: 46 }, brawler: true, moves: [{ kind: 'pound', cd: 8 }] },
  { key: 'croc', name: 'Crocodile des marais', color: '#56703F', r: 24, hp: 1400, dmg: 95, speed: 100, atkCd: 1.5, gold: 58, zone: 6, population: 16, pack: [1, 1], swim: true, ambush: true, reach: 46 },
  { key: 'masked', name: 'Petit Masqué', color: '#A0603A', r: 17, hp: 800, dmg: 60, speed: 150, atkCd: 1.3, gold: 45, zone: 6, population: 22, pack: [2, 4], ranged: { kind: 'dart', range: 330, windup: 0.4, speed: 620 } },
  { key: 'gorilla_king', name: 'Roi Gorille', color: '#2E2A28', r: 66, hp: 58000, dmg: 205, speed: 195, atkCd: 1.2, gold: 1800, zone: 6, population: 0, pack: [1, 1], boss: true, sprite: 'gorilla', base: 'gorilla' },
  { key: 'croc_king', name: 'Crocodile Ancien', color: '#3F5A30', r: 66, hp: 62000, dmg: 215, speed: 185, atkCd: 1.3, gold: 1800, zone: 6, population: 0, pack: [1, 1], boss: true, sprite: 'croc', base: 'croc' },
  { key: 'mask_lord', name: 'Grand Masque', color: '#8A4A2A', r: 57, hp: 52000, dmg: 195, speed: 205, atkCd: 1.0, gold: 1800, zone: 6, population: 0, pack: [1, 1], boss: true, sprite: 'masked', base: 'masked' },
  // Mer de sable, de jour seulement (il s'enfouit au coucher du soleil, quand sortent les chacals) : son dard empoisonne.
  { key: 'scorpion', name: 'Scorpion des dunes', color: '#C8913E', r: 20, hp: 1900, dmg: 100, speed: 135, atkCd: 1.2, gold: 85, zone: 7, population: 18, pack: [1, 3], day: true, venom: true },
  { key: 'scorpion_king', name: 'Scorpion Empereur', color: '#7A2E22', r: 63, hp: 80000, dmg: 290, speed: 200, atkCd: 1.1, gold: 2500, zone: 7, population: 0, pack: [1, 1], boss: true, optional: true, venom: true, sprite: 'scorpion', base: 'scorpion' },
  // Îlots du large (on y va à dos de serpent) : chacun a sa créature, et son géant au fond d'une grotte, qui garde un tome.
  { key: 'drake', name: 'Drake des marées', color: '#2E7A80', r: 22, hp: 450, dmg: 22, speed: 100, atkCd: 1.3, gold: 20, zone: 3, population: 3, pack: [1, 2], isle: true, ranged: { kind: 'jet', range: 280, windup: 0.55, speed: 480 }, brawler: true, awaken: 15 },
  { key: 'wyvern', name: 'Wyverne des falaises', color: '#5A6A3A', r: 24, hp: 1600, dmg: 65, speed: 125, atkCd: 1.3, gold: 58, zone: 5, population: 3, pack: [1, 2], isle: true, venom: true, awaken: 20 },
  { key: 'dragon', name: 'Dragonnet de braise', color: '#A8402E', r: 26, hp: 1900, dmg: 90, speed: 105, atkCd: 1.4, gold: 66, zone: 6, population: 3, pack: [1, 2], isle: true, ranged: { kind: 'fire', range: 340, windup: 0.6, speed: 400 }, brawler: true, awaken: 25 },
  { key: 'drake_king', name: 'Grand Drake', color: '#1E5A66', r: 63, hp: 8500, dmg: 50, speed: 180, atkCd: 1.3, gold: 450, zone: 3, population: 0, pack: [1, 1], boss: true, optional: true, isle: true, tome: ['vigor', 0], sprite: 'drake', base: 'drake' },
  { key: 'wyvern_king', name: 'Wyverne-Reine', color: '#3E4A2A', r: 66, hp: 42000, dmg: 125, speed: 200, atkCd: 1.2, gold: 1800, zone: 5, population: 0, pack: [1, 1], boss: true, optional: true, isle: true, venom: true, tome: ['vigor', 1], sprite: 'wyvern', base: 'wyvern' },
  { key: 'dragon_king', name: 'Dragon ancien', color: '#7A2418', r: 70, hp: 80000, dmg: 230, speed: 190, atkCd: 1.2, gold: 2600, zone: 6, population: 0, pack: [1, 1], boss: true, optional: true, isle: true, tome: ['vigor', 2], sprite: 'dragon', base: 'dragon' },
  // Bois profonds, l'hiver seulement : le Bigfoot sort des sapins enneigés (il repart à la fonte des neiges). Rare, solide, il frappe fort.
  { key: 'bigfoot', name: 'Bigfoot', color: '#7A5A44', r: 27, hp: 420, dmg: 22, speed: 105, atkCd: 1.4, gold: 24, zone: 2, population: 7, pack: [1, 1], season: 3, awaken: 25 },
  // Renforts des géants (n'apparaissent qu'appelés par eux) : leurres du Feu Ancien, totem du Grand Masque, queue de la Salamandre-Mère
  { key: 'flame_decoy', name: 'Feu Ancien', color: '#4F8BFF', r: 54, hp: 11380, dmg: 1, speed: 200, atkCd: 99, gold: 0, zone: 4, population: 0, pack: [1, 1], minion: true, mimic: 'old_flame', frail: 30 },
  { key: 'mask_totem', name: 'Totem masqué', color: '#7A5030', r: 24, hp: 2600, dmg: 0, speed: 0, atkCd: 99, gold: 0, zone: 6, population: 0, pack: [1, 1], minion: true, anchored: true, inert: true },
  { key: 'salamander_tail', name: 'Queue de salamandre', color: '#5A4038', r: 18, hp: 8000, dmg: 240, speed: 175, atkCd: 0.8, gold: 0, zone: 8, population: 0, pack: [1, 1], minion: true },
];

export const SPECIES_KEYS = SPECIES.map((s) => s.key);

/** Espèces triées par zone (pour l'affichage : Tanière, bestiaire). */
export const SPECIES_BY_ZONE = SPECIES.map((_, i) => i).filter((i) => !SPECIES[i].minion).sort((a, b) => SPECIES[a].zone - SPECIES[b].zone || a - b);

// Le monde est une île (voir worldmap.ts) découpée en ZONES zones successives, de plus en plus loin de la plage d'arrivée.
export const ZONES = 7; // la Mer de sable va jusqu'au bout de l'île
export const LAKES_ZONE = 5; // Lacs brumeux : une brume légère flotte sur toute la zone
export const JUNGLE_ZONE = 6; // Jungle, entre les Lacs brumeux et le désert : grands arbres, bambous, lianes, sous la canopée
export const DESERT_ZONE = 7; // Mer de sable, la dernière (son volcan)
/**
 * Taille de chaque zone (à partir des Ruines moussues, deux fois plus grande que les premières) : sa longueur le long de
 * l'île, et sa population de monstres, multipliées d'autant.
 */
export const ZONE_SIZE = [1, 1, 1, 2, 2, 2, 2];
/** Longueur de chaque zone le long de l'île, en parts (la Mer de sable est plus grande : son volcan y tient). */
export const ZONE_WEIGHTS = [1, 1, 1, 1, 1, 1.1, 1.6].map((w, i) => w * ZONE_SIZE[i]);
/** Monstres sauvages d'une espèce sur l'île : sa population, multipliée par la taille de sa zone. */
export const populationOf = (s: number) => Math.round(SPECIES[s].population * (ZONE_SIZE[SPECIES[s].zone - 1] ?? 1));
// Sous le volcan de la Mer de sable : une zone de plus, souterraine (une grande salle hors de l'île), ses monstres et
// trois antres de géants. Les trois vaincus, le cœur volcanique se libère au centre de la salle.
export const VOLCANO_ZONE = ZONES + 1;
export const ZONE_NAMES = ['Lisière', 'Bois profonds', 'Landes', 'Ruines moussues', 'Lacs brumeux', 'Jungle', 'Mer de sable', 'Entrailles du volcan', 'Haute mer'];
// En haute mer : une fois le bateau prêt, on prend la mer vers le Colisée ; le Kraken attaque le bateau en chemin.
// Le pont du bateau est une « grotte » hors de l'île (son entrée : le bateau, au bout de l'île).
export const VOYAGE_ZONE = VOLCANO_ZONE + 1;
export const DECK_RX = 520; // pont du bateau (le reste, autour, c'est la mer)
export const DECK_RY = 150;
export const SEA_RX = 950; // la mer visible autour du bateau
export const SEA_RY = 620;
export const KRAKEN_DELAY_S = 12; // à bord depuis ce temps-là, le Kraken surgit (avant, si la cinématique de son arrivée est finie)
export const VOLCANO_R = 460; // le volcan, sur l'île : demi-largeur de sa base (une ellipse aplatie, VOLCANO_RY) ; il tient à l'écran
export const VOLCANO_RY = 0.55;
export const HALL_RX = 950; // la salle sous le volcan (ellipse irrégulière, comme une grotte) : depuis sa sortie, on voit l'autel
export const HALL_RY = 540;
export const HEART_REACH = 90; // pour prendre le cœur volcanique, sur son autel
// Le cœur volcanique est la dernière étape du bateau : pris sur son autel, puis installé dans la coque rebâtie.
export const HEART_TAKEN = 1;
export const HEART_IN_BOAT = 2;
export const BOAT_REACH = 230; // pour installer le cœur, devant le bateau (l'épave du bout de l'île)
/** Le bateau peut prendre la mer : rebâti en entier, son cœur volcanique installé. */
export const boatReady = (boat: number, heart: number) => boat >= BOAT_STAGES.length && heart >= HEART_IN_BOAT;
/** Le volcan s'ouvre quand le village a vaincu tous les géants de la Mer de sable. */
export const volcanoOpen = (beaten: readonly number[]) => zoneBosses(ZONES).every((b) => beaten.includes(b));
export const SPAWN_SAFE_R = 420; // pas de monstre qui apparaît près de la plage d'arrivée

// Buissons à fruits : le gibier passif vient y manger ; les fruits repoussent ensuite.
export const BUSH_REGROW_S = 45;
export const BUSH_SEEK_R = 520; // distance (depuis son point d'origine) à laquelle le gibier va chercher un buisson
export const FLEE_S = 4; // le gibier frappé s'enfuit pendant ce temps
// Apprivoiser aux baies : on cueille aux buissons, on tend un fruit (touche T) ; le gibier passif s'approche peu à peu,
// et chaque fruit donné a une chance de l'apprivoiser (bien plus faible pour un monstre hostile).
export const BERRIES_PICKED = 3; // baies cueillies sur un buisson garni
export const MAX_BERRIES = 200; // baies qu'un dompteur peut porter
export const BUSH_PICK_R = 80; // distance pour cueillir
export const FEED_CD = 1; // s entre deux fruits donnés
export const LURE_R = 340; // le gibier passif voit un fruit tendu de cette distance
export const fruitTameChance = (species: number) => (SPECIES[species].passive ? 0.34 : 0.05);
export const FRUIT_ESSENCE = 0.25; // un fruit mangé par un gibier passif (sans l'apprivoiser) peut laisser une essence

export const WILD_AGGRO_R = 220;
export const WILD_REGEN_DELAY = 4; // s sans être frappé avant que le monstre sauvage récupère
export const WILD_REGEN = 0.08; // part des PV max récupérée par seconde ensuite
export const WILD_LEASH_R = 650;
export const FOLLOW_ENGAGE_R = 320; // la meute engage les ennemis à cette distance du dompteur
export const FOLLOW_MAX_R = 400; // une cible plus loin du dompteur est abandonnée
