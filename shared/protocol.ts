// Messages échangés sur le WebSocket (JSON).

import type { BuildingId, ClassId, Gear, SpecId } from './config.ts';

/** Statistiques d'un dompteur dans son village (tableau du village). */
export interface Stats {
  bosses: number; // géants vaincus (en ayant pris part au combat)
  tamed: number; // monstres apprivoisés
  given: number; // bois et pierre donnés à l'entrepôt
}
/** Ligne du tableau du village. */
export interface BoardRow extends Stats {
  name: string;
  color: string;
  online: boolean;
}

export type ClientMsg =
  | { t: 'create'; name: string; token?: string } // token : session Supabase (optionnel)
  | { t: 'join'; code: string; name: string; token?: string }
  | { t: 'leave'; code: string; token: string } // depuis le lobby : quitter un de ses villages (sa progression y est effacée)
  | { t: 'pos'; x: number; y: number; fx: number; fy: number }
  | { t: 'upgrade'; what: Gear }
  | { t: 'alphaUp'; s: number } // renforcer l'Alpha de cette espèce (équipé ou au repos)
  | { t: 'alphaEquip'; s: number; equip: boolean } // l'emmener sur le terrain, ou le ranger à la Tanière
  | { t: 'alphaCreate'; s: number }
  | { t: 'class'; cls: ClassId } // choisir sa classe à la forge
  | { t: 'spec'; spec: SpecId } // choisir la spécialisation de son arme (Grande forge, arme niv. 10)
  | { t: 'legend'; s: number } // rendre légendaire l'Alpha de cette espèce avec l'âme de son géant
  | { t: 'mount'; id: number } // 0 = descendre
  | { t: 'cave'; id: number; enter: boolean } // entrer dans une grotte / en sortir (id -1 : le volcan)
  | { t: 'challenge'; cave: number } // parler au géant endormi de sa grotte : le combat commence
  | { t: 'chest'; id: number } // ouvrir le coffre laissé par un géant vaincu (une fois par dompteur)
  | { t: 'establish'; site: number } // établir le camp de cet emplacement (pour tout le village)
  | { t: 'travel'; to: number } // Pierre de passage : -1 = village, -2 = bateau, sinon index du camp
  | { t: 'scroll'; cave: number } // ramasser le parchemin laissé par le géant de cette grotte
  | { t: 'scrollGive' } // donner ses parchemins au vieil homme : il retrouve des souvenirs
  | { t: 'heart' } // cœur volcanique : le prendre sur son autel (géants du volcan vaincus), ou l'installer dans le bateau rebâti
  | { t: 'learn'; kind: number } // École des dompteurs : commencer la leçon suivante de cette discipline (index dans LESSON_KINDS)
  | { t: 'boat' } // donner au vieil homme les ressources de l'étape suivante du bateau
  | { t: 'build'; b: BuildingId } // construire un bâtiment du village (pour tout le village)
  | { t: 'rename'; name: string } // renommer le village, devant l'Hôtel de ville (une fois construit)
  | { t: 'hall'; name?: string } // améliorer la Maison commune (pour tout le village) ; name : nom du village, à sa construction
  | { t: 'sword' } // tirer sur l'épée plantée dans le sable (SWORD_PULLS fois)
  | { t: 'pick' } // cueillir les baies du buisson garni le plus proche
  | { t: 'hold'; on: boolean } // tendre un fruit (ou le ranger) : le gibier passif s'approche
  | { t: 'deposit' }
  | { t: 'chat'; text: string } // message pour tout le village
  | { t: 'board' } // demander le tableau du village
  | { t: 'kick'; id: number } // fondateur : expulser ce dompteur (banni du village)
  | { t: 'unban'; user: string } // fondateur : lever le bannissement d'un compte
  | { t: 'mode'; manual: boolean } // attaque au clic (PC) au lieu de l'attaque automatique
  | { t: 'attack'; x: number; y: number } // attaque au clic : frapper vers ce point // vider son sac (bois, pierre) dans la réserve du village, à l'entrepôt
  | { t: 'unlock'; cave: number } // débloquer une grotte (pour tout le village)
  | { t: 'sell'; id: number } // Marché : vendre un monstre ordinaire de sa meute
  | { t: 'buy'; s: number } // Marché : acheter un monstre d'une espèce déjà croisée
  | { t: 'help'; on: boolean } // R maintenu (on) ou relâché : relever un dompteur à terre
  | { t: 'reset' } // fondateur : supprimer le village ; autre membre : effacer sa progression ici
  | { t: 'cheat' } // dev uniquement : +300 or, +30 essences
  | { t: 'ping'; ts: number };

export interface PlayerState {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  fx: number; // direction du regard
  fy: number;
  hp: number;
  maxHp: number;
  weapon: number;
  armor: number;
  torch: number; // 0 : pas de torche
  boots: number;
  sword: number; // coups donnés pour déterrer l'épée (SWORD_PULLS : armé)
  scrolls: number; // parchemins dans son sac (à donner au vieil homme)
  cls: ClassId | null; // classe (null : pas encore choisie)
  spec: SpecId | null; // spécialisation de l'arme (null : pas encore)
  gold: number;
  fruits: number; // baies dans son sac
  holding: boolean; // tend un fruit (il ne se bat plus, il nourrit)
  wood: number; // dans son sac (à déposer à l'entrepôt)
  stone: number;
  essences: number[]; // par espèce
  saved: boolean; // progression sauvegardée sur un compte
  mount: { id: number; species: number; hp: number; legend: boolean } | null; // monture chevauchée (pv en %)
  slowed: boolean; // pris dans une toile
  awakening: { species: number; left: number; total: number }[]; // Alphas en cours d'éveil (secondes)
  resting: { species: number; level: number; legend: boolean }[]; // Alphas rangés à la Tanière
  seen: number[]; // espèces déjà croisées (bestiaire de la Tanière ; sans les géants)
  dead: boolean;
  respawnIn: number; // secondes, 0 si vivant
  revive: number; // à terre : avancement de la réanimation par un coéquipier (0..100)
  reviveBy: number; // id du coéquipier qui le relève (0 = personne)
  army: ArmySlot[]; // détail de la meute : envoyé à son seul dompteur (vide pour les autres)
  pack: number; // taille de la meute (tout le monde la voit)
  tomes: number[]; // livres d'apprentissage dans le sac, par bookIndex(discipline, tome) (envoyé à son seul dompteur)
  learned: number[]; // leçons apprises à l'École des dompteurs, par discipline
  readKind: number; // discipline de la leçon en cours
  reading: number; // secondes avant la fin de la leçon en cours (0 : aucune)
}

/** Résumé d'un membre de la meute pour le HUD. */
export interface ArmySlot {
  id: number;
  species: number;
  alpha: boolean;
  level: number; // niveau d'Alpha (0 pour une unité normale)
  legend: boolean; // Alpha légendaire
  hp: number; // 0..100
  reviveIn: number; // >0 si l'Alpha est en train de ressusciter
}

/** Unité compacte : [id, espèce, flags, x, y, pv%, idDuDompteur (0 = sauvage)] */
export type UnitTuple = [number, number, number, number, number, number, number];
/**
 * Attaque spéciale au sol : [type, x, y, rayon, x2, y2, avancement %, dompteur, style, lanceur, durée] — type 0 cercle,
 * 1 ligne (x2,y2 = bout, rayon = demi-largeur), 2 nuage, 3 toile. avancement 100 = actif. dompteur : id du dompteur
 * dont l'Alpha légendaire l'a lancée (dessinée à sa couleur), 0 pour un sauvage. style : index dans HAZARD_STYLES (-1 : aucun), pour l'animer ; lanceur : id de l'unité ;
 * durée : temps d'annonce avant l'impact, en centièmes de seconde.
 */
export type HazardTuple = [number, number, number, number, number, number, number, number, number, number, number];
/** Attaque d'où vient une zone annoncée au sol (le client l'anime : bond, rocher lancé, onde de choc…). */
export const HAZARD_STYLES = ['leap', 'rock', 'slam', 'blink', 'charge', 'web', 'spores'] as const;
export type HazardStyle = (typeof HAZARD_STYLES)[number];
/**
 * Projectile de tireur : [id, type, x, y, a, b, c, dompteur] — type 0 trait (bolt), 1 en cloche (arc), 2 jet.
 * Trait et jet : (x, y) position, (a, b) vitesse px/s. Cloche : (x, y) départ, (a, b) point d'impact, c avancement %.
 * dompteur : id du dompteur du tireur (meute, légendaire : dessiné à sa couleur), 0 pour un sauvage.
 */
export type ShotTuple = [number, number, number, number, number, number, number, number];

/** Dompteur déconnecté, endormi au village : [nom, couleur, armure, classe ('' sans), x, y]. */
export type SleeperTuple = [string, string, number, string, number, number];
/** Monstre d'un dompteur endormi : [id, espèce, flags (UNIT_FLAG_ALPHA, _LEGEND, _DORMANT = endormi), x, y, index du dompteur dans sleepers]. */
export type DozerTuple = [number, number, number, number, number, number];

export const UNIT_FLAG_ALPHA = 1;
export const UNIT_FLAG_MOUNTED = 2; // Alpha chevauché : dessiné sous son dompteur
export const UNIT_FLAG_LEGEND = 4; // Alpha légendaire
export const UNIT_FLAG_DORMANT = 8; // géant qui attend qu'on vienne lui parler (ni cible ni menace)
export const UNIT_FLAG_ASLEEP = 16; // bête sauvage qui dort la nuit (sanglier) : on peut la surprendre
export const UNIT_FLAG_HIDDEN = 32; // sous le sable (ver qui file, suricate au terrier) : intouchable, on ne voit qu'une bosse ou un trou

export type GameEvent =
  | { e: 'hit'; a: number; b: number; dmg: number; m?: 1 } // m : coup au corps à corps
  | { e: 'die'; x: number; y: number; s: number; alpha: boolean }
  | { e: 'tame'; id: number; by: number; s: number }
  | { e: 'gold'; to: number; n: number; x: number; y: number }
  | { e: 'essence'; to: number; s: number; x: number; y: number }
  | { e: 'soul'; to: number; s: number; x: number; y: number } // âme de mini-boss
  | { e: 'mine'; by: number; id: number; done: boolean } // coup de pioche sur un filon (done : épuisé)
  | { e: 'chop'; by: number; id: number; done: boolean } // coup de hache sur un arbre (id : index dans decor ; done : abattu)
  | { e: 'boss'; cave: number; s: number; down: boolean } // mini-boss vaincu (down) ou de retour
  | { e: 'move'; id: number; kind: string } // un mini-boss lance une attaque spéciale
  | { e: 'challenge'; cave: number; id: number; by: number } // un dompteur a provoqué le géant : le combat commence
  | { e: 'chest'; id: number; to: number; gold: number; x: number; y: number; book?: number } // coffre ouvert : or tiré au hasard, parfois un livre (bookIndex)
  | { e: 'heart'; by: number; installed: boolean } // le cœur volcanique a été pris (ou installé dans le bateau), pour tout le village
  | { e: 'learn'; by: number; kind: number; lesson: number; done: boolean } // École des dompteurs : une leçon commence (by) ou s'achève (done)
  | { e: 'eat'; id: number; bush: number } // du gibier mange les fruits d'un buisson
  | { e: 'pick'; by: number; bush: number; n: number } // baies cueillies
  | { e: 'sword'; by: number; n: number } // un coup pour déterrer l'épée (n : coups donnés ; SWORD_PULLS : elle est sortie)
  | { e: 'feed'; by: number; id: number } // un fruit donné, sans apprivoiser cette fois
  | { e: 'boom'; x: number; y: number; r: number; kind: string; by?: number } // une attaque spéciale frappe (by : dompteur de l'Alpha qui l'a lancée)
  | { e: 'legend'; id: number; by: number; s: number } // un Alpha devient légendaire
  | { e: 'shot'; by: number; x: number; y: number; tx: number; ty: number; cls: ClassId } // flèche ou orbe
  | { e: 'class'; id: number; cls: ClassId }
  | { e: 'spec'; id: number; spec: SpecId }
  | { e: 'awaken'; id: number; by: number; s: number } // Alpha éveillé à la tanière
  | { e: 'revive'; id: number }
  | { e: 'heal'; id: number; n: number } // un Alpha lièvre soigne son dompteur
  | { e: 'pdie'; id: number; gold: number } // gold : or perdu dans la chute
  | { e: 'previve'; id: number; by: number } // dompteur relevé sur place par un coéquipier
  | { e: 'upgrade'; id: number; what: Gear; lvl: number }
  | { e: 'alphaUp'; id: number; by: number; s: number; lvl: number }
  | { e: 'mount'; by: number; id: number; on: boolean }
  | { e: 'scatter'; id: number; n: number } // la meute se disperse à la mort du dompteur
  | { e: 'full'; to: number }
  | { e: 'seen'; to: number; s: number } // nouvelle espèce croisée : elle entre au bestiaire
  | { e: 'charge'; id: number } // un tireur charge son tir (il est immobile pendant windup)
  | { e: 'camp'; site: number; by: number } // un camp vient d'être établi
  | { e: 'built'; b: BuildingId; by: number } // un bâtiment du village vient d'être construit
  | { e: 'hall'; lvl: number; by: number } // Maison commune améliorée
  | { e: 'deposit'; by: number; wood: number; stone: number } // bois et pierre déposés à l'entrepôt
  | { e: 'beaten'; s: number; by: number } // un géant vaincu pour la première fois par le village
  | { e: 'scroll'; to: number; s: number } // parchemin ramassé (s : son géant)
  | { e: 'lore'; by: number; from: number; to: number } // le vieil homme a retrouvé les souvenirs from à to - 1
  | { e: 'boat'; by: number; stage: number; done: boolean } // une étape du bateau commence (by) ou s'achève (done)
  | { e: 'res'; to: number; wood: number; stone: number; x: number; y: number } // bois ou pierre récoltés
  | { e: 'unlock'; cave: number; by: number } // une grotte vient d'être débloquée
  | { e: 'trade'; to: number; s: number; gold: number; sold: boolean } // Marché : monstre vendu ou acheté
  | { e: 'travel'; id: number; x: number; y: number; tx: number; ty: number } // voyage par Pierre de passage
  | { e: 'chat'; by: number; name: string; color: string; text: string } // message d'un dompteur
  | { e: 'info'; text: string };

export interface Snapshot {
  t: 's';
  tick: number;
  players: PlayerState[];
  units: UnitTuple[]; // sur le réseau : seulement les unités nouvelles ou changées (voir snapshot.ts)
  gone: number[]; // unités sorties de la vue depuis le snapshot précédent
  ores: [number, number][]; // filons proches : [id, pv %] (0 = épuisé) ; sur le réseau : seulement ceux qui ont changé
  chests: [number, number, number, number][]; // coffres des géants vaincus : [id, x, y, ouvert par ce dompteur (0/1)]
  banned: { id: string; name: string }[]; // comptes bannis du village (envoyé au seul fondateur)
  sleepers: SleeperTuple[]; // dompteurs déconnectés qui dorment au village
  dozers: DozerTuple[]; // leurs monstres, qui flânent ou dorment autour d'eux
  bare: number[]; // buissons proches dont les fruits ont été mangés (ils repoussent)
  trees: [number, number][]; // arbres proches entamés ou abattus : [index dans decor, pv %] (absents : intacts)
  caves: number[]; // par grotte : secondes avant le retour du mini-boss (0 = présent)
  camps: number[]; // emplacements de camp établis par le village
  buildings: BuildingId[]; // bâtiments construits au village
  hall: number; // niveau de la Maison commune
  vname: string; // nom du village ('' : Hôtel de ville pas encore construit)
  scrolls: number[]; // grottes dont le parchemin attend ce dompteur
  told: number[]; // parchemins lus par le vieil homme (géant de chacun), dans l'ordre de ses souvenirs
  lore: [number, number, number]; // souvenirs retrouvés par le vieil homme, étapes du bateau achevées, secondes avant la fin de l'étape en cours (0 : aucune)
  stock: [number, number]; // réserve du village : [bois, pierre]
  beaten: number[]; // géants (espèce) déjà vaincus par le village : ils ouvrent les portes des zones
  heart: number; // cœur volcanique : 0 sous le volcan, 1 pris, 2 installé dans le bateau
  unlocked: number[]; // grottes débloquées par le village
  hazards: HazardTuple[]; // attaques spéciales visibles
  shots: ShotTuple[]; // projectiles des tireurs (esquivables)
  ev: GameEvent[];
}

export type ServerMsg =
  | { t: 'welcome'; id: number; code: string; seed: number; saved: boolean; villageFound: boolean; founder: boolean; armed: boolean } // armed : épée déjà déterrée
  | { t: 'left'; code: string } // village quitté (réponse à « leave »)
  | { t: 'closed'; msg: string } // village supprimé (ou progression effacée) : retour au lobby
  | { t: 'error'; msg: string }
  | { t: 'teleport'; x: number; y: number }
  | { t: 'pong'; ts: number; now?: number } // now : heure du serveur (ms), pour le ciel commun
  | { t: 'board'; rows: BoardRow[] } // tableau du village (membres en ligne et déconnectés)
  | Snapshot;
