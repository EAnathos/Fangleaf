// Toutes les règles et l'équilibrage du jeu. Partagé client / serveur.

export const TICK_HZ = 20;
export const DT = 1 / TICK_HZ;

export const MAX_PLAYERS = 3;
export const WORLD_HALF = 6000; // carte de -6000 à 6000 : un long couloir sinueux dans la forêt (voir worldmap.ts)
export const VILLAGE_R = 360;
export const VIEW_R = 1250; // rayon d'intérêt : unités envoyées à chaque joueur

// Bâtiments : positions relatives au centre du village.
export const FORGE_OFFSET = { x: -150, y: 90 };
export const DEN_OFFSET = { x: 170, y: -150 };
export const MARKET_OFFSET = { x: -180, y: -160 };
export const BUILDING_REACH = 110;
// Bâtiments du village : construits par n'importe quel membre contre de l'or, une fois pour tout le village.
export type BuildingId = 'forge' | 'den' | 'market' | 'stone';
export const BUILDINGS: Record<BuildingId, { name: string; cost: number; desc: string }> = {
  forge: { name: 'Forge', cost: 10, desc: 'Choisis ta classe, améliore ton arme et ton armure.' },
  den: { name: 'Tanière', cost: 20, desc: 'Éveille, renforce et range tes Alphas. Bestiaire des espèces croisées.' },
  market: { name: 'Marché', cost: 50, desc: 'Vends les monstres de ta meute, achète des monstres des espèces déjà croisées.' },
  stone: { name: 'Pierre de passage', cost: 200, desc: 'Voyage instantané entre le village et les camps établis.' },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
// Marché : prix d'un monstre ordinaire (apprivoisé) selon l'or qu'il rapporte à la chasse.
export const monsterBuyPrice = (species: number) => SPECIES[species].gold * 12;
export const monsterSellPrice = (species: number) => SPECIES[species].gold * 4;
// Grottes : fermées au départ, débloquées pour tout le village contre de l'or (150 × niveau de la zone).
export const caveUnlockCost = (zone: number) => 150 * zone;
// Camps : un emplacement au bout de la zone 4, établi par n'importe quel membre du village contre de l'or.
export const CAMP_COST = 2000;
export const CAMP_R = 260; // feu qui soigne, monstres tenus à l'écart
export const VILLAGE_STONE_OFFSET = { x: 95, y: 225 }; // Pierre de passage du village
export const campName = (i: number) => (i === 0 ? 'Camp avancé' : `Camp avancé ${i + 1}`);

export const PLAYER_R = 16;
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
    desc: 'Corps à corps. Robuste : +25 % de PV.',
    weapons: ['Bâton', 'Coutelas', 'Épée courte', 'Épée longue', 'Lame dentée', 'Sabre', 'Croc-lame', 'Lame runique', 'Fendeur', 'Crocs jumeaux', 'Fangleaf'],
  },
  archer: {
    name: 'Archer', range: 300, dmg: 0.8, cd: 0.7, hp: 0.9,
    desc: 'Tire de loin sur une cible. Fragile au contact.',
    weapons: ['Fronde', 'Arc court', 'Arc de chasse', 'Arc long', 'Arc composite', 'Arc de frêne', 'Arc-croc', 'Arc runique', 'Arc du traqueur', 'Arc jumeau', 'Arc Fangleaf'],
  },
  mage: {
    name: 'Mage', range: 240, dmg: 0.6, cd: 1, hp: 0.85, splash: 80,
    desc: 'Orbe qui explose et touche tous les monstres autour de la cible.',
    weapons: ['Baguette', 'Bâton noueux', 'Bâton de chêne', 'Sceptre', 'Orbe de mousse', 'Bâton runique', 'Croc de lune', 'Sceptre ancien', 'Bâton du voile', 'Orbe jumelé', 'Bâton Fangleaf'],
  },
};
export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
export const CLASS_CHANGE_COST = 50; // la première classe est gratuite
/** Sans classe choisie, on se bat comme un guerrier. */
export const classOf = (cls: ClassId | null) => CLASSES[cls ?? 'warrior'];
export const PLAYER_ATK_CD = 0.55;
export const PLAYER_RESPAWN_S = 5;
export const PLAYER_COLORS = ['#5CC8B8', '#E6A15C', '#D886C9'];

export const ARMY_CAP = 12; // meute ordinaire (les Alphas ne comptent pas)
export const RECALL_R = 320; // trop loin du dompteur : la meute lâche tout et revient
export const RECALL_DONE_R = 110;
export const TAME_CHANCE = 0.25;
export const TAMED_MULT = 0.5; // un monstre apprivoisé a 50 % des PV et des dégâts de sa version sauvage
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

export const WEAPON_MAX = 10;
export const WEAPON_NAMES = [
  'Bâton', 'Coutelas', 'Épée courte', 'Épée longue', 'Lame dentée', 'Sabre',
  'Croc-lame', 'Lame runique', 'Fendeur', 'Crocs jumeaux', 'Fangleaf',
];
export const weaponDmg = (lvl: number) => Math.round((10 + 4 * lvl) * 0.75); // −25 % sur les dégâts du héros
export const weaponCost = (lvl: number) => Math.round(25 * Math.pow(1.6, lvl));

// Tanière : il n'y a pas d'Alpha sauvage. On éveille l'Alpha d'une espèce avec ses essences
// (1 essence par monstre de l'espèce vaincu), puis on le renforce, de plus en plus cher.
// Montures : certains Alphas éveillés se chevauchent. Vitesse multipliée, et la monture encaisse
// une partie des coups (elle peut tomber : on est désarçonné, elle ressuscite comme tout Alpha).
export const MOUNTS: Record<string, number> = { wolf: 1.6, boar: 1.4, bear: 1.25 };
export const MOUNT_SHARE = 0.75; // part des dégâts reçus par la monture
export const MOUNT_REACH = 240; // distance max pour enfourcher sa monture
export const mountSpeedOf = (species: number) => MOUNTS[SPECIES_KEYS[species]] ?? 1;

export const ALPHA_LVL_MAX = 10;
export const ALPHA_EQUIP_MAX = 5; // Alphas équipés (sur le terrain) en même temps ; les autres se reposent à la Tanière

// Grottes : un mini-boss par grotte, qui réapparaît après un délai ; il peut lâcher son âme.
export const BOSS_RESPAWN_S = 300;
export const BOSS_SOUL_DROP = 0.35; // chance, pour chaque dompteur présent, d'obtenir l'âme
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
export const alphaLevelMult = (lvl: number) => 1 + 0.25 * lvl;
/** Résurrection d'un Alpha : plus son espèce est forte (zone), plus elle est longue. Le niveau n'y change rien. */
export const alphaReviveS = (species: number) => 10 + 8 * SPECIES[species].zone;
export const alphaUpCost = (lvl: number) => Math.round(10 * Math.pow(1.6, lvl)); // 10, 16, 26, 41, 66…
export const isBoss = (species: number) => !!SPECIES[species]?.boss;
/** Boss géant d'une espèce (dont l'âme rend légendaire l'Alpha de cette espèce), ou -1. */
export const bossOf = (species: number) => SPECIES.findIndex((b) => b.boss && b.base === SPECIES[species]?.key);
// Alpha légendaire : une âme du boss de l'espèce fait évoluer son Alpha.
export const LEGEND_SOULS = 3;
export const LEGEND_MULT = { hp: 1.5, dmg: 1.5, size: 1.15 };
/** Bonus de collection : +10 % de PV et de dégâts à tous les Alphas par Alpha éveillé (3 Alphas = +30 %). */
export const COLLECTION_BONUS = 0.1;
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
  colossus: [{ kind: 'slam', cd: 6, power: 6 }, { kind: 'enrage', below: 0.3 }], // onde de choc de l'ours : 4× plus forte
  moss_heart: [{ kind: 'rocks', cd: 5 }, { kind: 'slam', cd: 8 }],
  old_flame: [{ kind: 'blink', cd: 6 }, { kind: 'slam', cd: 7 }],
  rune_eye: [{ kind: 'volley', cd: 4, n: 5, shot: 'bolt' }, { kind: 'summon', cd: 11, n: 2, max: 4 }],
  toad_king: [{ kind: 'mortar', cd: 5, n: 5 }, { kind: 'leap', cd: 7 }],
  mist_hydra: [{ kind: 'volley', cd: 3.5, n: 3, shot: 'jet' }, { kind: 'slam', cd: 8 }],
  titan_crab: [{ kind: 'charge', cd: 5 }, { kind: 'slam', cd: 7, power: 3 }, { kind: 'enrage', below: 0.3 }],
};
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
  zone: number; // 1 à ZONES : zones de plus en plus dangereuses en s'éloignant du camp de départ
  population: number;
  pack: [number, number];
  boss?: boolean; // mini-boss de grotte : n'apparaît que dans sa grotte, ne s'apprivoise pas, lâche son âme
  base?: string; // boss : espèce dont il est la version géante (son âme rend légendaire l'Alpha de cette espèce)
  sprite?: string; // apparence à réutiliser (par défaut : key)
  ranged?: Ranged; // tireur : attaque à distance (projectile esquivable) au lieu du corps à corps
  swim?: boolean; // sauvage, il ne quitte jamais l'eau (apprivoisé, il suit son dompteur sur terre)
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
  { key: 'wolf', name: 'Loup', color: '#8A93A8', r: 16, hp: 70, dmg: 9, speed: 135, atkCd: 0.8, gold: 5, zone: 2, population: 43, pack: [2, 4] },
  { key: 'boar', name: 'Sanglier', color: '#8B5E3C', r: 20, hp: 180, dmg: 18, speed: 95, atkCd: 1.1, gold: 10, zone: 3, population: 34, pack: [1, 3] },
  { key: 'golem', name: 'Golem de mousse', color: '#5F7A5A', r: 24, hp: 450, dmg: 32, speed: 60, atkCd: 1.4, gold: 20, zone: 4, population: 30, pack: [1, 2] },
  { key: 'sporelin', name: 'Sporelin', color: '#C8553D', r: 13, hp: 18, dmg: 3, speed: 95, atkCd: 1.0, gold: 2, zone: 1, population: 38, pack: [3, 5] },
  { key: 'spider', name: 'Araignée sylvestre', color: '#6A4E7E', r: 17, hp: 55, dmg: 11, speed: 155, atkCd: 0.9, gold: 5, zone: 2, population: 30, pack: [1, 3] },
  { key: 'bear', name: 'Ours des fourrés', color: '#6B4A33', r: 24, hp: 240, dmg: 15, speed: 80, atkCd: 1.3, gold: 12, zone: 3, population: 24, pack: [1, 1] },
  { key: 'wisp', name: 'Feu follet', color: '#6FB7FF', r: 18, hp: 300, dmg: 40, speed: 110, atkCd: 1.2, gold: 22, zone: 4, population: 21, pack: [1, 2] },
  // Mini-boss des grottes : la version géante de chaque espèce. Leur « essence » est leur âme.
  // (ordre conservé : les index servent dans les sauvegardes)
  { key: 'slime_queen', name: 'Gluant Géant', color: '#9BE070', r: 60, hp: 420, dmg: 8, speed: 190, atkCd: 1.1, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, sprite: 'slime', base: 'slime' },
  { key: 'shadow_fang', name: "Croc-d'Ombre", color: '#4A4E6A', r: 48, hp: 1150, dmg: 22, speed: 235, atkCd: 0.8, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, sprite: 'wolf', base: 'wolf' },
  { key: 'old_tusk', name: 'Vieille-Défense', color: '#6E3F24', r: 54, hp: 2700, dmg: 40, speed: 200, atkCd: 1.1, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, sprite: 'boar', base: 'boar' },
  { key: 'moss_heart', name: 'Cœur-de-Mousse', color: '#3F5E45', r: 63, hp: 6200, dmg: 65, speed: 185, atkCd: 1.5, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'golem', base: 'golem' },
  { key: 'spore_giant', name: 'Champignon Géant', color: '#B8432E', r: 57, hp: 360, dmg: 6, speed: 205, atkCd: 1.2, gold: 60, zone: 1, population: 0, pack: [1, 1], boss: true, sprite: 'sporelin', base: 'sporelin' },
  { key: 'weaver', name: 'Mère Tisseuse', color: '#4E3760', r: 51, hp: 1000, dmg: 24, speed: 220, atkCd: 0.9, gold: 150, zone: 2, population: 0, pack: [1, 1], boss: true, sprite: 'spider', base: 'spider' },
  { key: 'colossus', name: 'Ours Colosse', color: '#4F3524', r: 63, hp: 3300, dmg: 34, speed: 190, atkCd: 1.3, gold: 300, zone: 3, population: 0, pack: [1, 1], boss: true, sprite: 'bear', base: 'bear' },
  { key: 'old_flame', name: 'Feu Ancien', color: '#4F8BFF', r: 54, hp: 5000, dmg: 75, speed: 200, atkCd: 1.3, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'wisp', base: 'wisp' },
  // Itération 16 : un tireur dans les Ruines moussues, et la zone 5 (Lacs brumeux) au-delà du Camp avancé.
  { key: 'watcher', name: 'Guetteur runique', color: '#6E7570', r: 22, hp: 320, dmg: 38, speed: 55, atkCd: 2.0, gold: 20, zone: 4, population: 22, pack: [1, 2], ranged: { kind: 'bolt', range: 320, windup: 0.6, speed: 260 } },
  { key: 'toad', name: 'Crapaud-mortier', color: '#6E8F45', r: 24, hp: 900, dmg: 50, speed: 75, atkCd: 2.4, gold: 40, zone: 5, population: 18, pack: [1, 2], ranged: { kind: 'arc', range: 340, windup: 0.55, speed: 0, splash: 52 } },
  { key: 'serpent', name: 'Serpent des brumes', color: '#4A93A0', r: 22, hp: 700, dmg: 45, speed: 105, atkCd: 1.8, gold: 36, zone: 5, population: 16, pack: [1, 1], ranged: { kind: 'jet', range: 360, windup: 0.45, speed: 560 }, swim: true },
  { key: 'crab', name: 'Crabe des berges', color: '#D46A43', r: 24, hp: 1400, dmg: 55, speed: 70, atkCd: 1.4, gold: 45, zone: 5, population: 16, pack: [1, 2] },
  // Géants des nouvelles espèces : une grotte chacun (zone 4 : Œil des Ruines ; zone 5 : les trois autres).
  { key: 'rune_eye', name: 'Œil des Ruines', color: '#5E6662', r: 57, hp: 5500, dmg: 70, speed: 185, atkCd: 1.4, gold: 600, zone: 4, population: 0, pack: [1, 1], boss: true, sprite: 'watcher', base: 'watcher' },
  { key: 'toad_king', name: 'Crapaud-Roi', color: '#5F8A3A', r: 60, hp: 11000, dmg: 100, speed: 190, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'toad', base: 'toad' },
  { key: 'mist_hydra', name: 'Hydre des brumes', color: '#3E8290', r: 57, hp: 9500, dmg: 95, speed: 205, atkCd: 1.2, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'serpent', base: 'serpent' },
  { key: 'titan_crab', name: 'Crabe Titan', color: '#B9532F', r: 63, hp: 14000, dmg: 110, speed: 185, atkCd: 1.4, gold: 1200, zone: 5, population: 0, pack: [1, 1], boss: true, sprite: 'crab', base: 'crab' },
];

export const SPECIES_KEYS = SPECIES.map((s) => s.key);

/** Espèces triées par zone (pour l'affichage : Tanière, bestiaire). */
export const SPECIES_BY_ZONE = SPECIES.map((_, i) => i).sort((a, b) => SPECIES[a].zone - SPECIES[b].zone || a - b);

// Le monde est un long couloir (voir worldmap.ts) découpé en ZONES zones successives de PATH_LEN / ZONES.
export const PATH_LEN = 25000;
export const ZONES = 5;
export const ZONE_NAMES = ['Lisière', 'Bois profonds', 'Landes', 'Ruines moussues', 'Lacs brumeux'];
export const SPAWN_SAFE_R = 420; // pas de monstre qui apparaît près du camp de départ

export const WILD_AGGRO_R = 220;
export const WILD_REGEN_DELAY = 4; // s sans être frappé avant que le monstre sauvage récupère
export const WILD_REGEN = 0.08; // part des PV max récupérée par seconde ensuite
export const WILD_LEASH_R = 650;
export const FOLLOW_ENGAGE_R = 260; // la meute engage les ennemis à cette distance du dompteur
export const FOLLOW_MAX_R = 300; // une cible plus loin du dompteur est abandonnée
