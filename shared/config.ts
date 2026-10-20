// Toutes les règles et l'équilibrage du jeu. Partagé client / serveur.

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;

export const MAX_PLAYERS = 4;
export const SWORD_PULLS = 3; // à l'arrivée sur l'île, l'épée est plantée dans le sable : trois coups pour la déterrer
export const SWORD_REACH = 80;
export const MAX_VILLAGES = 3; // villages par compte (on choisit le sien au lobby)
export const WORLD_HALF = 10800; // carte de -10800 à 10800 : une île au milieu de la mer (voir worldmap.ts)
export const VILLAGE_R = 360;
export const VIEW_R = 1250; // rayon d'intérêt : unités envoyées à chaque joueur

// Bâtiments : positions relatives au centre du village.
export const FORGE_OFFSET = { x: -150, y: 90 };
export const DEN_OFFSET = { x: 170, y: -150 };
export const MARKET_OFFSET = { x: -168, y: -185 };
export const BUILDING_REACH = 110;
// Bâtiments du village : construits par n'importe quel membre contre de l'or, une fois pour tout le village.
// Il faut aussi du bois et de la pierre (récoltés sur la carte), et parfois un Hôtel de ville assez développé.
export type BuildingId = 'forge' | 'den' | 'market' | 'stone' | 'palisade' | 'plot_forge' | 'plot_den' | 'plot_market' | 'forge2';
export interface Cost {
  gold: number;
  wood: number;
  stone: number;
}
// Mise en place du camp : au départ, il n'y a que le feu. On monte la palissade, puis on défriche l'emplacement
// de chaque bâtiment avant de pouvoir le bâtir (needs : ce qu'il faut avoir fait avant).
export const BUILDINGS: Record<BuildingId, { name: string; cost: number; wood: number; stone: number; hall: number; desc: string; needs?: BuildingId }> = {
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
};
/** « 20 or · 15 bois · 10 pierre » (les montants nuls sont omis). */
export const costText = (c: Cost) => [c.gold && `${c.gold} or`, c.wood && `${c.wood} bois`, c.stone && `${c.stone} pierre`].filter(Boolean).join(' · ');
export const buildingCost = (b: BuildingId): Cost => ({ gold: BUILDINGS[b].cost, wood: BUILDINGS[b].wood, stone: BUILDINGS[b].stone });

// Hôtel de ville : on l'améliore (or, bois, pierre) pour débloquer le reste du village et du monde.
// HALL[n] : passage au niveau n + 1. La porte de la zone z + 1 demande aussi d'avoir vaincu les géants de la zone z.
export const HALL_OFFSET = { x: 185, y: 138 };
// Entrepôt : chacun y dépose le bois et la pierre de son sac ; constructions et Hôtel de ville puisent dans cette réserve commune.
export const STORE_OFFSET = { x: -270, y: -55 };
// Panneau du village, au bord de la place : le tableau des exploits de chacun.
export const BOARD_OFFSET = { x: 68, y: -86 };
export const HALL: (Cost & { unlock: string })[] = [
  { gold: 20, wood: 15, stone: 10, unlock: 'Porte du village : la suite de la Lisière (zone 1) · Marché' },
  { gold: 200, wood: 60, stone: 50, unlock: 'Porte des Bois profonds (zone 2) · Pierre de passage' },
  { gold: 500, wood: 160, stone: 140, unlock: 'Porte des Landes (zone 3)' },
  { gold: 1500, wood: 350, stone: 300, unlock: 'Porte des Ruines moussues (zone 4) · Grande forge' },
  { gold: 3000, wood: 600, stone: 550, unlock: 'Porte des Lacs brumeux (zone 5)' },
  { gold: 6000, wood: 1000, stone: 900, unlock: 'Porte de la Mer de sable (zone 6)' },
];
export const HALL_MAX = HALL.length;
/** Géants d'une zone (index d'espèce) : il faut tous les vaincre pour ouvrir la porte de la zone suivante. */
export const zoneBosses = (z: number) => SPECIES.map((sp, i) => (sp.boss && sp.zone === z ? i : -1)).filter((i) => i >= 0);
/** Niveau d'Hôtel de ville pour ouvrir la porte k (0 : sortie du village vers la zone 1 ; k ≥ 1 : vers la zone k + 1). */
export const gateHall = (k: number) => (k === 0 ? 1 : k + 1);
/** Porte k ouverte : Hôtel de ville au niveau requis et, après la première, géants de la zone k tous vaincus. */
export const gateOpen = (k: number, hall: number, beaten: number[]) => hall >= gateHall(k) && (k === 0 || zoneBosses(k).every((b) => beaten.includes(b)));
/** Zones découvertes par le village : la Lisière, puis chaque zone dont la porte est ouverte. */
export const zonesOpen = (hall: number, beaten: number[]) => {
  let z = 1;
  while (z < ZONES && gateOpen(z, hall, beaten)) z++;
  return z;
};

// Récolte : filons d'or (or et un peu de pierre), rochers (pierre) et bois mort (bois).
export type Resource = 'gold' | 'wood' | 'stone';
export const resYield = (zone: number) => 4 + 2 * zone; // bois ou pierre d'un tas épuisé (en moyenne)
export const oreStone = (zone: number) => 1 + zone; // pierre en plus de l'or d'un filon (en moyenne)
export const RES_SPREAD = 0.4; // la récolte varie de ± 40 % autour de la moyenne
/** Quantité réellement récoltée : un tirage autour de la moyenne n (r : hasard entre 0 et 1), jamais moins de 1. */
export const resRoll = (n: number, r = Math.random()) => Math.max(1, Math.round(n * (1 - RES_SPREAD + 2 * RES_SPREAD * r)));
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
// Marché : prix d'un monstre ordinaire (apprivoisé) selon l'or qu'il rapporte à la chasse.
export const monsterBuyPrice = (species: number) => SPECIES[species].gold * 12;
export const monsterSellPrice = (species: number) => SPECIES[species].gold * 4;
// Grottes : fermées au départ, débloquées pour tout le village contre de l'or, bien plus cher dans les dernières zones.
const CAVE_UNLOCK = [150, 300, 450, 1500, 3000, 6000, 6000];
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
export const ELDER_REACH = 90; // pour lui parler, lui donner un parchemin ou des ressources
export const SCROLL_REACH = 70; // pour ramasser un parchemin
export const ELDER_OFFSET = { x: -46, y: 62 }; // le vieil homme, près du feu du village
export const VILLAGE_STONE_OFFSET = { x: 95, y: 225 }; // Pierre de passage du village
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
export const DEATH_GOLD_LOSS = 0.1; // part de son or perdue à chaque mort
export const MAGE_SPLASH_EDGE = 0.4; // orbe du mage : dégâts au bord de l'explosion (pleins au point d'impact)
/** Avec un autre dompteur dans le village, on reste à terre ce temps-là : il peut venir nous relever. */
export const REVIVE_WINDOW_S = 10;
export const REVIVE_HOLD_S = 5; // R maintenu près du corps
export const REVIVE_R = 80;
export const REVIVE_HP = 0.5; // relevé avec la moitié de ses PV
export const PLAYER_COLORS = ['#5CC8B8', '#E6A15C', '#D886C9', '#8FD16A']; // une par place du village (MAX_PLAYERS)

export const ARMY_CAP = 12; // meute ordinaire (les Alphas ne comptent pas)
export const RECALL_R = 420; // trop loin du dompteur : la meute lâche tout et revient
export const RECALL_DONE_R = 110;
export const TAME_CHANCE = 0.25;
export const TAMED_MULT = 0.5; // un monstre apprivoisé a 50 % des dégâts de sa version sauvage…
export const TAMED_HP_MULT = 0.575; // … et 57,5 % de ses PV (+15 % par rapport à la moitié)
export const GOLD_SHARE_R = 700;

export const ALPHA_MULT = { hp: 2.5, dmg: 2.5, size: 1.6 }; // Alpha niv. 0 = 2,5× le monstre de base

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
export type Gear = 'weapon' | 'armor' | 'torch' | 'boots';

// Tanière : il n'y a pas d'Alpha sauvage. On éveille l'Alpha d'une espèce avec ses essences
// (1 essence par monstre de l'espèce vaincu), puis on le renforce, de plus en plus cher.
// Montures : certains Alphas éveillés se chevauchent. Vitesse multipliée, et la monture encaisse
// une partie des coups (elle peut tomber : on est désarçonné, elle ressuscite comme tout Alpha).
export const MOUNTS: Record<string, number> = { wolf: 1.6, boar: 1.4, bear: 1.25, snail: 0.6, serpent: 1.5, vulture: 1.5 }; // l'escargot se monte, mais ralentit
/**
 * Montures nageuses (le serpent) : on ne va qu'en eau avec elles. On embarque près de l'eau (à SHORE_R au plus) :
 * on est posé sur l'eau. On ne descend que près d'une rive (posé sur la terre ferme). Si la monture tombe sur l'eau, on se noie.
 */
export const SWIM_MOUNTS = new Set(['serpent']);
/** Montures volantes (le vautour) : on survole l'eau, les rochers et les arbres, pas la forêt qui borde le couloir. */
export const FLY_MOUNTS = new Set(['vulture']);
export const flyMount = (species: number) => FLY_MOUNTS.has(SPECIES_KEYS[species]);
export const SHORE_R = 140;
export const swimMount = (species: number) => SWIM_MOUNTS.has(SPECIES_KEYS[species]);
export const MOUNT_SHARE = 0.75; // part des dégâts reçus par la monture
export const MOUNT_REACH = 240; // distance max pour enfourcher sa monture
export const mountSpeedOf = (species: number) => MOUNTS[SPECIES_KEYS[species]] ?? 1;

export const ALPHA_LVL_MAX = 10;
/**
 * Pouvoirs de certains Alphas, tant qu'ils sont sur le terrain et debout :
 * l'escargot protège son dompteur (dégâts reçus réduits, en plus de l'armure), le suricate l'encourage (dégâts infligés accrus),
 * le lièvre soigne un peu son dompteur et la meute autour de lui, toutes les ALPHA_HEAL_S secondes.
 */
export const ALPHA_PERKS: Record<string, { kind: 'guard' | 'heal' | 'rally'; base: number; per: number }> = {
  meerkat: { kind: 'rally', base: 0.08, per: 0.01 }, // +8 % de dégâts infligés par son dompteur, +1 % par niveau
  snail: { kind: 'guard', base: 0.08, per: 0.01 }, // −8 % de dégâts reçus, +1 % par niveau
  hare: { kind: 'heal', base: 0.03, per: 0.003 }, // 3 % des PV max, +0,3 % par niveau
};
export const ALPHA_HEAL_S = 3;
export const ALPHA_HEAL_R = 260; // le lièvre soigne ce qui est à cette distance de lui
/** Pouvoir de l'Alpha de cette espèce à ce niveau (part de dégâts évités ou de PV rendus), ou null. */
export const alphaPerk = (species: number, lvl: number) => {
  const k = ALPHA_PERKS[SPECIES[species]?.key];
  return k ? { kind: k.kind, value: k.base + k.per * lvl } : null;
};
export const ALPHA_EQUIP_MAX = 5; // Alphas équipés (sur le terrain) en même temps ; les autres se reposent à la Tanière

// Grottes : un mini-boss par grotte, qui réapparaît après un délai ; il peut lâcher son âme.
export const BOSS_RESPAWN_S = 300;
export const BOSS_TALK_R = 140; // distance (depuis le bord du géant) pour lui parler et lancer le combat
export const BOSS_SOUL_DROP = 0.35;
// Coffre du géant vaincu : chaque dompteur l'ouvre une fois, pour un montant d'or tiré au hasard (× l'or du géant).
export const CHEST_GOLD: [number, number] = [0.75, 2]; // chance, pour chaque dompteur présent, d'obtenir l'âme
export const CAVE_RX = 560; // intérieur elliptique des grottes
export const CAVE_RY = 400;

// Filons d'or : on les mine en restant à côté (attaque automatique quand aucun monstre n'est à portée).
export const ORE_R = 16;
export const oreHp = (zone: number) => 30 + 30 * zone;
export const oreGold = (zone: number) => 12 * zone + 6;
export const ORE_RESPAWN_S = 180;
export const ALPHA_CREATE_COST = 15;
/** Temps d'éveil d'un Alpha après avoir payé ses essences : plus l'espèce est forte, plus c'est long. */
export const alphaAwakenS = (species: number) => 30 * SPECIES[species].zone;
export const ESSENCE_DROP = 0.35; // chance, pour chaque dompteur proche, qu'un monstre vaincu lâche une essence
export const alphaLevelMult = (lvl: number) => 1 + 0.15 * lvl; // +15 % de PV et de dégâts par niveau
/** Résurrection d'un Alpha : plus son espèce est forte (zone), plus elle est longue. Le niveau n'y change rien. */
export const alphaReviveS = (species: number) => 10 + 8 * SPECIES[species].zone;
export const alphaUpCost = (lvl: number) => Math.round(10 * Math.pow(1.6, lvl)); // 10, 16, 26, 41, 66…
export const isBoss = (species: number) => !!SPECIES[species]?.boss;
/** Boss géant d'une espèce (dont l'âme rend légendaire l'Alpha de cette espèce), ou -1. */
export const bossOf = (species: number) => SPECIES.findIndex((b) => b.boss && b.base === SPECIES[species]?.key);
// Alpha légendaire : une âme du boss de l'espèce fait évoluer son Alpha.
export const LEGEND_SOULS = 3;
export const LEGEND_MULT = { hp: 1.5, dmg: 1.5, size: 1.15 };
// Il hérite aussi des attaques spéciales de son géant, lancées seul en combat : un peu moins fortes et moins fréquentes.
export const LEGEND_MOVE_DMG = 0.6;
export const LEGEND_MOVE_CD = 1.3;
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
export type BossMove =
  | { kind: 'leap'; cd: number } // bondit sur une cible et écrase la zone d'arrivée
  | { kind: 'split'; at: number[]; n: number } // se divise en petits monstres à ces seuils de PV
  | { kind: 'spores'; cd: number } // nuages de spores sous les dompteurs : dégâts dans la durée
  | { kind: 'summon'; cd: number; n: number; max: number } // appelle des renforts de son espèce
  | { kind: 'charge'; cd: number } // charge en ligne droite
  | { kind: 'web'; cd: number } // toiles qui ralentissent
  | { kind: 'slam'; cd: number; power?: number } // onde de choc tout autour de lui (power : multiplicateur des dégâts, 1,5 par défaut)
  | { kind: 'enrage'; below: number } // s'enrage sous ce seuil de PV
  | { kind: 'rocks'; cd: number } // projette des rochers sur plusieurs cibles
  | { kind: 'blink'; cd: number } // disparaît et réapparaît près d'une cible
  | { kind: 'volley'; cd: number; n: number; shot: 'bolt' | 'jet' } // salve de projectiles en éventail (esquivable)
  | { kind: 'mortar'; cd: number; n: number }; // pluie de tirs en cloche, cercles annoncés au sol

export const BOSS_MOVES: Record<string, BossMove[]> = {
  slime_queen: [{ kind: 'leap', cd: 6 }, { kind: 'split', at: [0.66, 0.33], n: 3 }],
  spore_giant: [{ kind: 'spores', cd: 5 }, { kind: 'summon', cd: 9, n: 3, max: 6 }],
  shadow_fang: [{ kind: 'charge', cd: 5 }, { kind: 'summon', cd: 12, n: 2, max: 4 }],
  weaver: [{ kind: 'web', cd: 4 }, { kind: 'summon', cd: 10, n: 3, max: 6 }],
  old_tusk: [{ kind: 'charge', cd: 4 }, { kind: 'enrage', below: 0.35 }],
  colossus: [{ kind: 'slam', cd: 6, power: 4 }, { kind: 'enrage', below: 0.3 }], // onde de choc de l'ours : plus forte que les autres
  moss_heart: [{ kind: 'rocks', cd: 5 }, { kind: 'slam', cd: 8 }],
  old_flame: [{ kind: 'blink', cd: 6 }, { kind: 'slam', cd: 7 }],
  rune_eye: [{ kind: 'volley', cd: 4, n: 5, shot: 'bolt' }, { kind: 'summon', cd: 11, n: 2, max: 4 }],
  toad_king: [{ kind: 'mortar', cd: 5, n: 5 }, { kind: 'leap', cd: 7 }],
  mist_hydra: [{ kind: 'volley', cd: 3.5, n: 3, shot: 'jet' }, { kind: 'slam', cd: 8 }],
  titan_crab: [{ kind: 'charge', cd: 5 }, { kind: 'slam', cd: 7, power: 3 }, { kind: 'enrage', below: 0.3 }],
  sand_queen: [{ kind: 'blink', cd: 5 }, { kind: 'summon', cd: 11, n: 2, max: 4 }, { kind: 'slam', cd: 8 }], // elle plonge et resurgit sous sa cible
  vulture_king: [{ kind: 'leap', cd: 5 }, { kind: 'mortar', cd: 7, n: 4 }, { kind: 'summon', cd: 11, n: 2, max: 4 }], // piqués, pluie d'ossements, ses vautours
  moon_jackal: [{ kind: 'charge', cd: 4 }, { kind: 'summon', cd: 9, n: 3, max: 6 }, { kind: 'enrage', below: 0.35 }],
};
/** Coup ordinaire d'un géant : une seule cible (deux pour la reine des Gluants et l'ours), dégâts multipliés. */
const BOSS_MELEE: Record<string, { targets: number; mult: number }> = { slime_queen: { targets: 2, mult: 1.3 }, colossus: { targets: 2, mult: 1.3 } };
export const bossMelee = (key: string) => BOSS_MELEE[key] ?? { targets: 1, mult: 1.6 };
export const MOVE_NAMES: Record<BossMove['kind'], string> = {
  leap: 'Bond écrasant', split: 'Division', spores: 'Nuages de spores', summon: 'Renforts', charge: 'Charge',
  web: 'Toiles', slam: 'Onde de choc', enrage: 'Rage', rocks: 'Pluie de rochers', blink: 'Clignement',
  volley: 'Salve', mortar: 'Pluie de mortiers',
};
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
  base?: string; // boss : espèce dont il est la version géante (son âme rend légendaire l'Alpha de cette espèce)
  title?: string; // boss : son nom propre (affiché en entrant dans sa grotte et quand on lui parle)
  sprite?: string; // apparence à réutiliser (par défaut : key)
  ranged?: Ranged; // tireur : attaque à distance (projectile esquivable) au lieu du corps à corps
  swim?: boolean; // sauvage, il ne quitte jamais l'eau (apprivoisé, il suit son dompteur sur terre et dans l'eau)
  amphibious?: boolean; // apprivoisé, il suit son dompteur dans l'eau (sauvage, il reste à terre)
  night?: boolean; // n'apparaît que la nuit (il s'envole au lever du jour)
  sleeps?: 'night' | 'day'; // sauvage, il dort la nuit (lièvre) ou le jour (ours) : ni aggro ni errance, jusqu'à ce qu'on le frappe
  shell?: boolean; // sauvage, il rentre dans sa coquille (intouchable) quand un dompteur sans fruit en main approche
  rainSpeed?: number; // sauvage, sa vitesse sous une grosse averse (multiplicateur ; l'escargot aime la pluie)
  burrows?: boolean; // sauvage, il file sous le sable (intouchable) et surgit sous sa cible (cercle annoncé), puis reste exposé
  flies?: boolean; // sauvage, il tourne au-dessus de sa cible (hors d'atteinte), pique là où tombe son ombre (cercle annoncé), puis reste un moment au sol
  shy?: boolean; // gibier craintif : un dompteur sans fruit en main ou un vautour approche, et la colonie court se cacher dans sa tanière (elle y passe aussi la nuit)
  passive?: boolean; // sauvage, il n'attaque jamais : il broute les buissons à fruits et s'enfuit quand on le frappe
}

/**
 * Tir à distance. bolt : projectile lent en ligne droite ; jet : rapide en ligne droite ;
 * arc : tir en cloche qui retombe là où était la cible (cercle annoncé au sol), dégâts de zone.
 */
export interface Ranged {
  kind: 'bolt' | 'arc' | 'jet';
  range: number;
  windup: number; // s d'immobilité à charger le tir (lisible : on voit venir le coup)
  speed: number; // px/s (bolt, jet) ; arc : durée de vol fixe
  splash?: number; // arc : rayon des dégâts à l'impact
}
export const SHOT_KINDS = ['bolt', 'arc', 'jet'] as const;
export const ARC_FLIGHT_S = 0.9;

// Deux à trois espèces par zone, progression marquée d'une zone à l'autre (PV et dégâts ×2,5 à ×3).
// L'index de chaque espèce sert dans les profils sauvegardés (essences, Alphas) : n'ajouter qu'à la fin.
export const SPECIES: Species[] = [
  { key: 'slime', name: 'Gluant', color: '#7FCB5B', r: 14, hp: 25, dmg: 2, speed: 70, atkCd: 1.2, gold: 2, zone: 1, population: 57, pack: [2, 4] },
  { key: 'wolf', name: 'Loup', color: '#8A93A8', r: 19, hp: 70, dmg: 9, speed: 135, atkCd: 0.8, gold: 5, zone: 2, population: 43, pack: [2, 4] },
  { key: 'boar', name: 'Sanglier', color: '#8B5E3C', r: 20, hp: 180, dmg: 18, speed: 95, atkCd: 1.1, gold: 10, zone: 3, population: 34, pack: [1, 3] }, // bête de nuit : il ne dort pas
  { key: 'golem', name: 'Golem de mousse', color: '#5F7A5A', r: 24, hp: 450, dmg: 32, speed: 60, atkCd: 1.4, gold: 20, zone: 4, population: 30, pack: [1, 2] },
  { key: 'sporelin', name: 'Sporelin', color: '#C8553D', r: 13, hp: 18, dmg: 5, speed: 95, atkCd: 1.0, gold: 2, zone: 1, population: 38, pack: [3, 5] },
  { key: 'spider', name: 'Araignée sylvestre', color: '#6A4E7E', r: 17, hp: 55, dmg: 11, speed: 155, atkCd: 0.9, gold: 5, zone: 2, population: 30, pack: [1, 3] },
  { key: 'bear', name: 'Ours des fourrés', color: '#6B4A33', r: 24, hp: 240, dmg: 15, speed: 80, atkCd: 1.3, gold: 12, zone: 3, population: 24, pack: [1, 1], sleeps: 'day' }, // il chasse la nuit, dort le jour
  { key: 'wisp', name: 'Feu follet', color: '#6FB7FF', r: 18, hp: 300, dmg: 40, speed: 110, atkCd: 1.2, gold: 22, zone: 4, population: 21, pack: [1, 2] },
  // Mini-boss des grottes : la version géante de chaque espèce. Leur « essence » est leur âme.
  // (ordre conservé : les index servent dans les sauvegardes)
  { key: 'slime_queen', name: 'Gluant Géant', color: '#9BE070', r: 60, hp: 720, dmg: 8, speed: 190, atkCd: 1.1, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, title: 'Gélatine Ire, reine des Gluants', sprite: 'slime', base: 'slime' },
  { key: 'shadow_fang', name: "Croc-d'Ombre", color: '#4A4E6A', r: 48, hp: 2140, dmg: 22, speed: 235, atkCd: 0.8, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, title: 'Grisecroc le Hurleur', sprite: 'wolf', base: 'wolf' },
  { key: 'old_tusk', name: 'Vieille-Défense', color: '#6E3F24', r: 54, hp: 5590, dmg: 40, speed: 200, atkCd: 1.1, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, title: 'Grognard le Vieux Solitaire', sprite: 'boar', base: 'boar' },
  { key: 'moss_heart', name: 'Cœur-de-Mousse', color: '#3F5E45', r: 63, hp: 14170, dmg: 65, speed: 185, atkCd: 1.5, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, title: 'Moussegrave le Millénaire', sprite: 'golem', base: 'golem' },
  { key: 'spore_giant', name: 'Champignon Géant', color: '#B8432E', r: 57, hp: 610, dmg: 9, speed: 205, atkCd: 1.2, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, title: 'Amanite la Vénéneuse', sprite: 'sporelin', base: 'sporelin' },
  { key: 'weaver', name: 'Mère Tisseuse', color: '#4E3760', r: 51, hp: 1880, dmg: 24, speed: 220, atkCd: 0.9, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, title: 'Arachnée la Fileuse', sprite: 'spider', base: 'spider' },
  { key: 'colossus', name: 'Ours Colosse', color: '#4F3524', r: 63, hp: 5000, dmg: 34, speed: 190, atkCd: 1.3, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, title: 'Ursus Mâchefer', sprite: 'bear', base: 'bear' },
  { key: 'old_flame', name: 'Feu Ancien', color: '#4F8BFF', r: 54, hp: 11380, dmg: 75, speed: 200, atkCd: 1.3, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, title: 'Lueur, la Flamme Ancienne', sprite: 'wisp', base: 'wisp' },
  // Itération 16 : un tireur dans les Ruines moussues, et la zone 5 (Lacs brumeux) au-delà du Camp avancé.
  { key: 'watcher', name: 'Guetteur runique', color: '#6E7570', r: 22, hp: 320, dmg: 38, speed: 55, atkCd: 2.0, gold: 20, zone: 4, population: 22, pack: [1, 2], ranged: { kind: 'bolt', range: 320, windup: 0.6, speed: 260 } },
  { key: 'toad', name: 'Crapaud-mortier', color: '#6E8F45', r: 24, hp: 900, dmg: 50, speed: 75, atkCd: 2.4, gold: 40, zone: 5, population: 18, pack: [1, 2], ranged: { kind: 'arc', range: 340, windup: 0.55, speed: 0, splash: 52 }, amphibious: true },
  { key: 'serpent', name: 'Serpent des brumes', color: '#4A93A0', r: 22, hp: 700, dmg: 45, speed: 105, atkCd: 1.8, gold: 36, zone: 5, population: 16, pack: [1, 1], ranged: { kind: 'jet', range: 360, windup: 0.45, speed: 560 }, swim: true },
  { key: 'crab', name: 'Crabe des berges', color: '#D46A43', r: 24, hp: 1400, dmg: 55, speed: 70, atkCd: 1.4, gold: 45, zone: 5, population: 16, pack: [1, 2], amphibious: true },
  // Géants des nouvelles espèces : une grotte chacun (zone 4 : Œil des Ruines ; zone 5 : les trois autres).
  { key: 'rune_eye', name: 'Œil des Ruines', color: '#5E6662', r: 57, hp: 12480, dmg: 70, speed: 185, atkCd: 1.4, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, title: 'Œil-de-Pierre le Veilleur', sprite: 'watcher', base: 'watcher' },
  { key: 'toad_king', name: 'Crapaud-Roi', color: '#5F8A3A', r: 60, hp: 27170, dmg: 100, speed: 190, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, title: 'Croâ XIV, roi des Mares', sprite: 'toad', base: 'toad' },
  { key: 'mist_hydra', name: 'Hydre des brumes', color: '#3E8290', r: 57, hp: 23400, dmg: 95, speed: 205, atkCd: 1.2, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, title: 'Brumentine aux Trois Têtes', sprite: 'serpent', base: 'serpent' },
  { key: 'titan_crab', name: 'Crabe Titan', color: '#B9532F', r: 63, hp: 34580, dmg: 110, speed: 185, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, title: 'Pince-d’Acier le Titan', sprite: 'crab', base: 'crab' },
  // Gibier passif : il broute les buissons à fruits et s'enfuit quand on le frappe (pas de géant). S'apprivoise surtout aux baies.
  { key: 'hare', name: 'Lièvre des ronces', color: '#B89A72', r: 13, hp: 30, dmg: 2, speed: 150, atkCd: 1.0, gold: 3, zone: 3, population: 20, pack: [1, 3], passive: true, sleeps: 'night' },
  { key: 'snail', name: 'Escargot des mousses', color: '#C99A5B', r: 12, hp: 22, dmg: 1, speed: 32, atkCd: 1.4, gold: 2, zone: 1, population: 20, pack: [1, 2], passive: true, shell: true, rainSpeed: 1.5 },
  // Gibier de nuit : il n'apparaît qu'une fois la nuit tombée, et s'en va au lever du jour.
  { key: 'firefly', name: 'Luciole', color: '#E4F07A', r: 11, hp: 20, dmg: 1, speed: 70, atkCd: 1.4, gold: 4, zone: 2, population: 24, pack: [3, 5], passive: true, night: true },
  // Zone 6 (Mer de sable) : suricates craintifs autour de leurs tanières, vers fouisseurs, vautours ; chacals fantômes la nuit.
  { key: 'meerkat', name: 'Suricate', color: '#C9A06A', r: 12, hp: 60, dmg: 3, speed: 125, atkCd: 1.2, gold: 8, zone: 6, population: 26, pack: [3, 6], passive: true, shy: true },
  { key: 'sandworm', name: 'Ver des sables', color: '#B98A5A', r: 26, hp: 2600, dmg: 120, speed: 115, atkCd: 1.6, gold: 100, zone: 6, population: 16, pack: [1, 1], burrows: true },
  { key: 'vulture', name: 'Vautour', color: '#4A3A30', r: 21, hp: 1700, dmg: 110, speed: 150, atkCd: 1.1, gold: 90, zone: 6, population: 18, pack: [1, 2], flies: true },
  { key: 'jackal', name: 'Chacal fantôme', color: '#CDBB98', r: 18, hp: 1400, dmg: 90, speed: 175, atkCd: 0.9, gold: 80, zone: 6, population: 24, pack: [4, 6], night: true },
  // Géants de la Mer de sable : une grotte chacun.
  { key: 'sand_queen', name: 'Reine des sables', color: '#A87A4A', r: 66, hp: 62000, dmg: 230, speed: 190, atkCd: 1.4, gold: 2500, zone: 6, population: 0, pack: [1, 1], boss: true, title: 'Dunebouche, la Reine des Sables', sprite: 'sandworm', base: 'sandworm' },
  { key: 'vulture_king', name: 'Roi-Vautour', color: '#3A2C24', r: 60, hp: 54000, dmg: 215, speed: 200, atkCd: 1.2, gold: 2500, zone: 6, population: 0, pack: [1, 1], boss: true, title: 'Charognard, le Roi des Cieux', sprite: 'vulture', base: 'vulture' },
  { key: 'moon_jackal', name: 'Chacal lunaire', color: '#D8CDB0', r: 57, hp: 50000, dmg: 205, speed: 220, atkCd: 0.9, gold: 2500, zone: 6, population: 0, pack: [1, 1], boss: true, title: 'Anubeth, le Chacal de la Lune', sprite: 'jackal', base: 'jackal' },
];

export const SPECIES_KEYS = SPECIES.map((s) => s.key);

/** Espèces triées par zone (pour l'affichage : Tanière, bestiaire). */
export const SPECIES_BY_ZONE = SPECIES.map((_, i) => i).sort((a, b) => SPECIES[a].zone - SPECIES[b].zone || a - b);

// Le monde est une île (voir worldmap.ts) découpée en ZONES zones successives, de plus en plus loin de la plage d'arrivée.
export const ZONES = 6; // la Mer de sable va jusqu'au bout de l'île
export const ZONE_NAMES = ['Lisière', 'Bois profonds', 'Landes', 'Ruines moussues', 'Lacs brumeux', 'Mer de sable'];
export const SPAWN_SAFE_R = 420; // pas de monstre qui apparaît près de la plage d'arrivée

// Buissons à fruits : le gibier passif vient y manger ; les fruits repoussent ensuite.
export const BUSH_REGROW_S = 45;
export const BUSH_SEEK_R = 520; // distance (depuis son point d'origine) à laquelle le gibier va chercher un buisson
export const FLEE_S = 4; // le gibier frappé s'enfuit pendant ce temps
// Apprivoiser aux baies : on cueille aux buissons, on tend un fruit (touche T) ; le gibier passif s'approche peu à peu,
// et chaque fruit donné a une chance de l'apprivoiser (bien plus faible pour un monstre hostile).
export const BERRIES_PICKED = 3; // baies cueillies sur un buisson garni
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
