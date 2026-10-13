// Messages échangés sur le WebSocket (JSON).

import type { ClassId } from './config.ts';

export type ClientMsg =
  | { t: 'create'; name: string; token?: string } // token : session Supabase (optionnel)
  | { t: 'join'; code: string; name: string; token?: string }
  | { t: 'pos'; x: number; y: number; fx: number; fy: number }
  | { t: 'upgrade'; what: 'weapon' | 'armor' }
  | { t: 'alphaUp'; s: number } // renforcer l'Alpha de cette espèce (équipé ou au repos)
  | { t: 'alphaEquip'; s: number; equip: boolean } // l'emmener sur le terrain, ou le ranger à la Tanière
  | { t: 'alphaCreate'; s: number }
  | { t: 'class'; cls: ClassId } // choisir sa classe à la forge
  | { t: 'legend'; s: number } // rendre légendaire l'Alpha de cette espèce avec l'âme de son géant
  | { t: 'mount'; id: number } // 0 = descendre
  | { t: 'cave'; id: number; enter: boolean } // entrer dans une grotte / en sortir
  | { t: 'establish'; site: number } // établir le camp de cet emplacement (pour tout le village)
  | { t: 'travel'; to: number } // Pierre de passage : -1 = village, sinon index du camp
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
  cls: ClassId | null; // classe (null : pas encore choisie)
  gold: number;
  essences: number[]; // par espèce
  saved: boolean; // progression sauvegardée sur un compte
  mount: { id: number; species: number; hp: number; legend: boolean } | null; // monture chevauchée (pv en %)
  slowed: boolean; // pris dans une toile
  awakening: { species: number; left: number; total: number }[]; // Alphas en cours d'éveil (secondes)
  resting: { species: number; level: number; legend: boolean }[]; // Alphas rangés à la Tanière
  seen: number[]; // espèces déjà croisées (bestiaire de la Tanière ; sans les géants)
  dead: boolean;
  respawnIn: number; // secondes, 0 si vivant
  army: ArmySlot[];
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
/** Attaque spéciale au sol : [type, x, y, rayon, x2, y2, avancement %] — type 0 cercle, 1 ligne (x2,y2 = bout, rayon = demi-largeur), 2 nuage, 3 toile. avancement 100 = actif. */
export type HazardTuple = [number, number, number, number, number, number, number];
/**
 * Projectile de tireur : [id, type, x, y, a, b, c] — type 0 trait (bolt), 1 en cloche (arc), 2 jet.
 * Trait et jet : (x, y) position, (a, b) vitesse px/s. Cloche : (x, y) départ, (a, b) point d'impact, c avancement %.
 */
export type ShotTuple = [number, number, number, number, number, number, number];

export const UNIT_FLAG_ALPHA = 1;
export const UNIT_FLAG_MOUNTED = 2; // Alpha chevauché : dessiné sous son dompteur
export const UNIT_FLAG_LEGEND = 4; // Alpha légendaire

export type GameEvent =
  | { e: 'hit'; a: number; b: number; dmg: number }
  | { e: 'die'; x: number; y: number; s: number; alpha: boolean }
  | { e: 'tame'; id: number; by: number; s: number }
  | { e: 'gold'; to: number; n: number; x: number; y: number }
  | { e: 'essence'; to: number; s: number; x: number; y: number }
  | { e: 'soul'; to: number; s: number; x: number; y: number } // âme de mini-boss
  | { e: 'mine'; by: number; id: number; done: boolean } // coup de pioche sur un filon (done : épuisé)
  | { e: 'boss'; cave: number; s: number; down: boolean } // mini-boss vaincu (down) ou de retour
  | { e: 'move'; id: number; kind: string } // un mini-boss lance une attaque spéciale
  | { e: 'boom'; x: number; y: number; r: number; kind: string } // une attaque spéciale frappe
  | { e: 'legend'; id: number; by: number; s: number } // un Alpha devient légendaire
  | { e: 'shot'; by: number; x: number; y: number; tx: number; ty: number; cls: ClassId } // flèche ou orbe
  | { e: 'class'; id: number; cls: ClassId }
  | { e: 'awaken'; id: number; by: number; s: number } // Alpha éveillé à la tanière
  | { e: 'revive'; id: number }
  | { e: 'pdie'; id: number }
  | { e: 'upgrade'; id: number; what: 'weapon' | 'armor'; lvl: number }
  | { e: 'alphaUp'; id: number; by: number; s: number; lvl: number }
  | { e: 'mount'; by: number; id: number; on: boolean }
  | { e: 'scatter'; id: number; n: number } // la meute se disperse à la mort du dompteur
  | { e: 'full'; to: number }
  | { e: 'seen'; to: number; s: number } // nouvelle espèce croisée : elle entre au bestiaire
  | { e: 'charge'; id: number } // un tireur charge son tir (il est immobile pendant windup)
  | { e: 'camp'; site: number; by: number } // un camp vient d'être établi
  | { e: 'travel'; id: number; x: number; y: number; tx: number; ty: number } // voyage par Pierre de passage
  | { e: 'info'; text: string };

export interface Snapshot {
  t: 's';
  tick: number;
  players: PlayerState[];
  units: UnitTuple[];
  ores: [number, number][]; // filons proches : [id, pv %] (0 = épuisé)
  caves: number[]; // par grotte : secondes avant le retour du mini-boss (0 = présent)
  camps: number[]; // emplacements de camp établis par le village
  hazards: HazardTuple[]; // attaques spéciales visibles
  shots: ShotTuple[]; // projectiles des tireurs (esquivables)
  ev: GameEvent[];
}

export type ServerMsg =
  | { t: 'welcome'; id: number; code: string; seed: number; saved: boolean; villageFound: boolean; founder: boolean }
  | { t: 'closed'; msg: string } // village supprimé (ou progression effacée) : retour au lobby
  | { t: 'error'; msg: string }
  | { t: 'teleport'; x: number; y: number }
  | { t: 'pong'; ts: number }
  | Snapshot;
