// Un village : jusqu'à 3 joueurs, la carte et sa simulation autoritaire.

import {
  bossMelee,
  ALPHA_EQUIP_MAX, ALPHA_LVL_MAX, BOSS_CHASE_MULT, BOSS_TALK_R, BOSS_CHASE_R, CLASS_CHANGE_COST, CLASS_IDS, classOf, type ClassId, BOSS_RESPAWN_S, BOSS_SOUL_DROP, FRUIT_ESSENCE, LEGEND_MOVE_CD, LEGEND_MOVE_DMG, DEATH_GOLD_LOSS, MAGE_SPLASH_EDGE, BERRIES_PICKED, BUSH_PICK_R, BUSH_REGROW_S, BUSH_SEEK_R, FEED_CD, fruitTameChance, LURE_R, CHEST_GOLD, FLEE_S, ESSENCE_DROP, ORE_R, ORE_RESPAWN_S, alphaAwakenS, ALPHA_CREATE_COST,
  ARC_FLIGHT_S, SHOT_KINDS, type Ranged, alphaStats, BOSS_MOVES, bossOf, isBoss, LEGEND_SOULS, WEB_SLOW, WEB_SLOW_S, type BossMove, oreGold, oreHp, ALPHA_MULT, ARMOR_MAX, ARMY_CAP, BUILDING_REACH, DT,
  FOLLOW_ENGAGE_R, FOLLOW_MAX_R, GOLD_SHARE_R, MAX_PLAYERS, PLAYER_ATK_CD, PLAYER_COLORS,
  PLAYER_R, PLAYER_RANGE, PLAYER_RESPAWN_S, PLAYER_SPEED, REVIVE_HOLD_S, REVIVE_HP, REVIVE_R, REVIVE_WINDOW_S, RECALL_DONE_R, RECALL_R, SPECIES, TAME_CHANCE, TAMED_HP_MULT, TAMED_MULT, VIEW_R,
  SPAWN_SAFE_R, VILLAGE_R, CAMP_COST, CAMP_R, BUILDINGS, BUILDING_IDS, type BuildingId, buildingCost, type Cost, HALL, HALL_MAX, gateOpen, oreStone, resYield, caveUnlockCost, monsterBuyPrice, monsterSellPrice, ZONES, WILD_REGEN, WILD_REGEN_DELAY, WEAPON_MAX, WILD_AGGRO_R, WILD_LEASH_R, alphaLevelMult, alphaReviveS, alphaUpCost, armorCost,
  armorMaxHp, armorReduction, MOUNT_REACH, MOUNT_SHARE, mountSpeedOf, weaponCost, weaponDmg, type SpeciesId,
} from '../shared/config.ts';
import { clamp, dist2 } from '../shared/math.ts';
import type { ArmySlot, BoardRow, DozerTuple, Stats, GameEvent, PlayerState, ServerMsg, SleeperTuple, UnitTuple } from '../shared/protocol.ts';
import { UNIT_FLAG_ALPHA, UNIT_FLAG_DORMANT, UNIT_FLAG_LEGEND, UNIT_FLAG_MOUNTED, type HazardTuple, type ShotTuple } from '../shared/protocol.ts';
import { SnapshotDiff } from '../shared/snapshot.ts';
import { WorldMap } from '../shared/worldmap.ts';
import { Grid } from './grid.ts';
import type { Profile } from './persist.ts';

interface Unit {
  kind: 'u';
  id: number;
  s: SpeciesId;
  alpha: boolean;
  owner: number; // 0 = sauvage
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  dmg: number;
  speed: number;
  atkCdBase: number;
  atkCd: number;
  target: number;
  lastAttacker: number;
  lastHitAt: number; // dernier coup reçu (temps de simulation)
  homeX: number;
  homeY: number;
  returning: boolean;
  wanderX: number;
  wanderY: number;
  wanderT: number;
  reviveAt: number; // > 0 : Alpha apprivoisé en attente de résurrection
  level: number; // niveau d'Alpha
  recalling: boolean; // trop loin du dompteur : revient sans combattre
  legend: boolean; // Alpha légendaire
  // mini-boss
  castUntil: number; // immobile pendant qu'il prépare une attaque
  moveCd: number[]; // recharge de chaque attaque spéciale
  splitDone: number; // seuils de division déjà passés
  enraged: boolean;
  summoner: number; // renfort : id du boss qui l'a appelé
  stuck: number; // secondes passées bloqué contre un obstacle
  path: { x: number; y: number }[] | null; // détour en cours autour des obstacles
  pathAt: number; // date du dernier calcul de détour
  pathGoalX: number;
  pathGoalY: number;
  windup: number; // tireur : charge son tir (s restantes), immobile
  shotAt: number; // cible visée pendant la charge
  dormant: boolean; // géant qui attend qu'un dompteur vienne lui parler : ni cible ni menace
  idle: boolean; // sauvage loin de tout dompteur : ni réflexion ni bousculade ce tick
  hitters: Set<number>; // géant : dompteurs qui l'ont frappé (eux ou leur meute) pendant ce combat, seuls ayants droit au coffre
}

/** Projectile d'un tireur : esquivable (trait, jet) ou annoncé au sol (cloche). */
interface Shot {
  id: number;
  kind: number; // index dans SHOT_KINDS
  x: number;
  y: number;
  vx: number;
  vy: number;
  x0: number; // cloche : départ et impact
  y0: number;
  tx: number;
  ty: number;
  start: number;
  left: number; // trait, jet : distance restante avant de se perdre
  dmg: number;
  splash: number;
  wild: boolean; // tiré par un sauvage (touche dompteurs et meutes) ou par la meute (touche les sauvages)
  by: Unit;
}

/** Attaque spéciale posée au sol : annoncée, puis elle frappe (et dure, pour les nuages). */
interface Hazard {
  kind: 0 | 1 | 2 | 3; // cercle, ligne, nuage, toile
  x: number;
  y: number;
  r: number;
  x2: number;
  y2: number;
  start: number;
  at: number; // déclenchement
  until: number; // fin (nuages)
  dmg: number;
  boss: Unit;
  fired: boolean;
  nextTick: number;
  onFire?: () => void;
}

export interface Player {
  kind: 'p';
  id: number;
  name: string;
  color: string;
  send: (m: ServerMsg) => void;
  x: number;
  y: number;
  r: number;
  fx: number;
  fy: number;
  hp: number;
  weapon: number;
  armor: number;
  gold: number;
  wood: number;
  stone: number;
  fruits: number; // baies cueillies
  holding: boolean; // tend un fruit : il nourrit au lieu de frapper
  manual: boolean; // attaque au clic : il ne frappe (ni ne récolte) que sur ordre
  orderUntil: number; // attaque au clic : ordre valable jusqu'à ce temps de simulation
  aimX: number; // point visé par le dernier clic
  aimY: number;
  essences: number[];
  userId: string | null; // compte Supabase, null = invité (tests uniquement)
  dirty: boolean; // progression à sauvegarder
  dead: boolean;
  respawnAt: number;
  helping: boolean; // R maintenu : relève le coéquipier à terre le plus proche
  reviveBy: number; // à terre : id du coéquipier qui le relève (0 = personne)
  reviveT: number; // à terre : secondes de réanimation déjà passées
  atkCd: number;
  lastPosMs: number;
  army: number[];
  mount: number; // id de l'Alpha chevauché, 0 sinon
  awakening: Map<number, number>; // espèce → heure d'éveil (Date.now en ms)
  villageFound: boolean; // a déjà atteint le village : on y apparaît directement ensuite
  slowUntil: number; // ralenti par une toile jusqu'à
  cls: ClassId | null; // classe choisie à la forge (null : pas encore)
  resting: { s: number; lvl: number; legend: boolean }[]; // Alphas rangés à la Tanière (pas sur le terrain)
  wiped?: boolean; // progression effacée : plus sauvegardé
  seen: Set<number>; // espèces déjà croisées (bestiaire de la Tanière)
  close?: () => void; // coupe sa connexion (expulsion)
  chatAt?: number; // dernier message envoyé (anti-spam)
  stats: Stats; // tableau du village
}

type Ent = Unit | Player;

/** Monstre d'un dompteur déconnecté : purement décoratif (ni cible, ni obstacle). */
interface Dozer {
  id: number;
  s: number;
  alpha: boolean;
  legend: boolean;
  asleep: boolean; // il dort à côté de son dompteur ; sinon il flâne dans le village
  x: number;
  y: number;
  wx: number; // but de sa promenade
  wy: number;
  wt: number; // secondes avant d'en changer
}

/** Dompteur déconnecté, endormi près du feu du village avec ses monstres. */
interface Sleeper {
  name: string;
  color: string;
  armor: number;
  cls: string;
  x: number;
  y: number;
  pack: Dozer[];
  stats: Stats; // pour le tableau du village
}

/** Coffre laissé par un géant vaincu : chaque dompteur l'ouvre une fois ; il disparaît au retour du géant. */
interface Chest {
  id: number;
  cave: number;
  s: number; // espèce du géant (son or fixe la mise)
  x: number;
  y: number;
  opened: Set<number>; // dompteurs qui l'ont déjà ouvert
  eligible: Set<number>; // dompteurs qui ont participé au combat : eux seuls peuvent l'ouvrir
}

const ACTIVE_R = VIEW_R + 500; // au-delà, les monstres sauvages restent immobiles (personne ne les voit)

/** Statistiques lues d'un profil (champs manquants ou invalides : 0). */
const statsOf = (s?: Partial<Stats>): Stats => ({
  bosses: Math.max(0, Math.floor(Number(s?.bosses) || 0)),
  tamed: Math.max(0, Math.floor(Number(s?.tamed) || 0)),
  given: Math.max(0, Math.floor(Number(s?.given) || 0)),
});

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

/** Ce que le village possède en commun (sauvegardé avec le village). */
export interface VillageState {
  camps: number[];
  buildings: BuildingId[];
  unlocked: number[];
  hall: number; // niveau de l'Hôtel de ville
  beaten: number[]; // géants (espèce) déjà vaincus au moins une fois
  wood: number; // réserve commune (entrepôt)
  stone: number;
  banned: { id: string; name: string }[]; // comptes expulsés par le fondateur
}

const maxHpOf = (p: Player) => Math.round(armorMaxHp(p.armor) * classOf(p.cls).hp);

export class Room {
  readonly seed: number;
  players = new Map<number, Player>();
  units = new Map<number, Unit>();
  private grid = new Grid<Ent>();
  private nextId = 1;
  private tick = 0;
  private time = 0;
  private events: GameEvent[] = [];
  private nextSpawn = SPECIES.map(() => 0);
  private oreHp: number[] = [];
  private oreBack: number[] = []; // temps de simulation où un filon épuisé réapparaît
  private caveBoss: number[] = []; // id du mini-boss de chaque grotte (0 : vaincu)
  private caveBack: number[] = []; // temps de simulation de son retour
  private hazards: Hazard[] = [];
  private shots: Shot[] = [];
  private chests: Chest[] = [];
  private sleepers = new Map<string, Sleeper>();
  private diffs = new Map<number, SnapshotDiff>(); // par spectateur : ce qu'il a déjà reçu (envoi différentiel) // membres déconnectés (compte, ou « invité:id »)
  private bushBack: number[] = []; // par buisson : temps de simulation où ses fruits repoussent (0 : garni)
  readonly map: WorldMap;
  readonly camps: number[]; // emplacements de camp établis (index dans map.sites)
  readonly buildings: BuildingId[]; // bâtiments construits au village
  readonly unlocked: number[]; // grottes débloquées (index dans map.caves)
  hall: number; // niveau de l'Hôtel de ville
  readonly beaten: number[]; // géants (espèce) déjà vaincus par le village
  readonly stock = { wood: 0, stone: 0 }; // réserve commune de l'entrepôt
  banned: { id: string; name: string }[] = []; // comptes expulsés par le fondateur (leur progression est gardée)
  onVillage?: (v: VillageState) => void; // sauvegarde, appelée quand le village change (camp, bâtiment, grotte)
  founder: string | null = null; // compte qui a fondé le village (seul à pouvoir le supprimer)
  deleted = false; // supprimé : plus aucune sauvegarde

  /** seed : graine d'un village enregistré (même carte qu'avant) ; absente pour un nouveau village. */
  constructor(readonly code: string, seed?: number, saved: Partial<VillageState> = {}) {
    this.seed = seed ?? Math.floor(Math.random() * 2 ** 31);
    this.map = new WorldMap(this.seed);
    const indexes = (list: unknown[] | undefined, n: number) =>
      (list ?? []).map(Number).filter((c, i, all) => Number.isInteger(c) && c >= 0 && c < n && all.indexOf(c) === i);
    this.camps = indexes(saved.camps, this.map.sites.length);
    this.unlocked = indexes(saved.unlocked, this.map.caves.length);
    this.buildings = BUILDING_IDS.filter((b) => saved.buildings?.includes(b));
    this.hall = clamp(Math.floor(Number(saved.hall) || 0), 0, HALL_MAX);
    this.beaten = indexes(saved.beaten, SPECIES.length).filter((s) => isBoss(s));
    this.stock.wood = Math.max(0, Math.floor(Number(saved.wood) || 0));
    this.stock.stone = Math.max(0, Math.floor(Number(saved.stone) || 0));
    this.banned = (saved.banned ?? []).filter((b) => b && typeof b.id === 'string');
    this.oreHp = this.map.ores.map((o) => oreHp(o.zone));
    this.oreBack = this.map.ores.map(() => 0);
    this.bushBack = this.map.bushes.map(() => 0);
    this.caveBoss = this.map.caves.map((c) => this.spawnBoss(c.id));
    this.caveBack = this.map.caves.map(() => 0);
    // Peuple la carte dès la création.
    for (let s = 0; s < SPECIES.length; s++) {
      let guard = 0;
      while (this.wildCount(s) < SPECIES[s].population && guard++ < 200) this.spawnPack(s);
    }
  }

  get full() {
    return this.players.size >= MAX_PLAYERS;
  }

  addPlayer(name: string, send: (m: ServerMsg) => void, account?: { userId: string; profile: Profile | null }): Player {
    const used = new Set([...this.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
    // Première fois : on arrive au camp de départ et il faut trouver le village.
    // Une fois le village découvert, on y apparaît directement.
    const found = !!account?.profile?.village_found;
    const from = found ? { x: this.map.village.x, y: this.map.village.y + 40 } : this.map.spawn;
    const a = Math.random() * Math.PI * 2;
    const at = this.map.freeNear(from.x + Math.cos(a) * 60, from.y + Math.sin(a) * 60);
    const p: Player = {
      kind: 'p', id: this.nextId++, name, color, send,
      x: at.x, y: at.y, r: PLAYER_R, fx: 1, fy: 0,
      hp: armorMaxHp(0), weapon: 0, armor: 0, gold: 0, wood: 0, stone: 0, fruits: 0, holding: false, stats: { bosses: 0, tamed: 0, given: 0 }, manual: false, orderUntil: 0, aimX: 0, aimY: 0, essences: SPECIES.map(() => 0),
      userId: account?.userId ?? null, dirty: false, dead: false, respawnAt: 0, helping: false, reviveBy: 0, reviveT: 0, atkCd: 0,
      lastPosMs: Date.now(), army: [], mount: 0, awakening: new Map(), villageFound: found, slowUntil: 0, cls: null, resting: [], seen: new Set(),
    };
    const prof = account?.profile;
    if (prof) {
      p.gold = prof.gold;
      p.wood = Math.max(0, Math.floor(prof.wood ?? 0));
      p.stone = Math.max(0, Math.floor(prof.stone ?? 0));
      p.fruits = Math.max(0, Math.floor(prof.fruits ?? 0));
      p.stats = statsOf(prof.stats);
      p.weapon = clamp(prof.weapon, 0, WEAPON_MAX);
      p.armor = clamp(prof.armor, 0, ARMOR_MAX);
      p.cls = CLASS_IDS.includes(prof.class as ClassId) ? (prof.class as ClassId) : null;
      p.essences = SPECIES.map((_, i) => prof.essences[i] ?? 0);
      // Bestiaire : ce qui a été vu, plus (pour les anciennes sauvegardes) tout ce qu'on a déjà chassé ou possédé.
      for (const s of [...(prof.seen ?? []), ...(prof.pack ?? []), ...prof.alphas.map((a) => a.s)]) if (s in SPECIES && !SPECIES[s].boss) p.seen.add(s);
      p.essences.forEach((n, s) => n > 0 && !SPECIES[s].boss && p.seen.add(s));
      p.hp = maxHpOf(p);
      for (const a of prof.alphas) {
        if (!(a.s in SPECIES)) continue;
        if (a.wakeAt && a.wakeAt > Date.now()) {
          p.awakening.set(a.s, a.wakeAt); // l'éveil continue même hors ligne
          continue;
        }
        // Au-delà de 5 équipés, ou rangé : il reste à la Tanière.
        if (a.rest || this.equippedCount(p) >= ALPHA_EQUIP_MAX) {
          p.resting.push({ s: a.s, lvl: clamp(a.lvl, 0, ALPHA_LVL_MAX), legend: !!a.legend });
          continue;
        }
        this.spawnAlpha(p, a.s, clamp(a.lvl, 0, ALPHA_LVL_MAX), !!a.legend);
      }
      // La meute ordinaire revient avec son dompteur.
      for (const s of (prof.pack ?? []).slice(0, ARMY_CAP)) {
        if (!(s in SPECIES) || SPECIES[s].boss) continue;
        const u = this.createUnit(s as SpeciesId, false, p.x, p.y);
        this.makeTamed(u, p);
        this.placeNear(u, p);
      }
    }
    this.sleepers.delete(p.userId ?? ''); // il se réveille : il n'est plus endormi au village
    this.players.set(p.id, p);
    this.scaleBosses();
    this.refreshAlphas(p);
    send({ t: 'welcome', id: p.id, code: this.code, seed: this.seed, saved: !!p.userId, villageFound: found, founder: this.isFounder(p) });
    send({ t: 'teleport', x: p.x, y: p.y });
    this.events.push({ e: 'info', text: `${name} a rejoint le village` });
    return p;
  }

  /**
   * Membre déconnecté : il dort près du feu du village, ses Alphas équipés et sa meute autour de lui
   * (un sur trois dort aussi, les autres flânent dans le village).
   */
  addSleeper(key: string, prof: Pick<Profile, 'name' | 'armor' | 'class' | 'alphas' | 'pack' | 'stats'>) {
    if (this.sleepers.has(key) || [...this.players.values()].some((p) => p.userId === key)) return;
    const v = this.map.village, k = this.sleepers.size;
    const a = 0.9 + k * 2.1, at = this.map.freeNear(v.x + Math.cos(a) * 95, v.y + Math.sin(a) * 70 + 10);
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    const species = [
      ...(prof.alphas ?? []).filter((x) => !x.rest && !x.wakeAt && x.s in SPECIES).map((x) => ({ s: x.s, alpha: true, legend: !!x.legend })),
      ...(prof.pack ?? []).filter((s) => s in SPECIES && !SPECIES[s].boss).slice(0, ARMY_CAP).map((s) => ({ s, alpha: false, legend: false })),
    ];
    const pack = species.map((m, i): Dozer => {
      const b = (i / Math.max(1, species.length)) * Math.PI * 2, d = 40 + (i % 3) * 18;
      const pos = this.map.freeNear(at.x + Math.cos(b) * d, at.y + Math.sin(b) * d * 0.7);
      return { id: this.nextId++, ...m, asleep: i % 3 === 0, x: pos.x, y: pos.y, wx: pos.x, wy: pos.y, wt: Math.random() * 3 };
    });
    this.sleepers.set(key, {
      name: prof.name, color: PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length], armor: clamp(Number(prof.armor) || 0, 0, ARMOR_MAX),
      cls: CLASS_IDS.includes(prof.class as ClassId) ? (prof.class as string) : '', x: at.x, y: at.y, pack, stats: statsOf(prof.stats),
    });
  }

  /** Les monstres éveillés des dormeurs flânent tranquillement dans le village. */
  private updateSleepers() {
    const v = this.map.village;
    for (const z of this.sleepers.values()) {
      for (const d of z.pack) {
        if (d.asleep) continue;
        d.wt -= DT;
        if (d.wt <= 0) {
          d.wt = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (VILLAGE_R - 80);
          const wx = v.x + Math.cos(a) * r, wy = v.y + Math.sin(a) * r;
          if (!this.map.blocked(wx, wy)) [d.wx, d.wy] = [wx, wy];
        }
        const dx = d.wx - d.x, dy = d.wy - d.y, len = Math.hypot(dx, dy);
        if (len < 3) continue;
        const step = Math.min(len, SPECIES[d.s].speed * 0.3 * DT), nx = d.x + (dx / len) * step, ny = d.y + (dy / len) * step;
        if (this.map.blocked(nx, ny)) d.wt = 0; // un bâtiment sur la route : autre promenade
        else [d.x, d.y] = [nx, ny];
      }
    }
  }

  /** Chat : un message pour tout le village (une ligne, 200 caractères au plus, pas plus de 2 par seconde). */
  onChat(p: Player, raw: string) {
    const text = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text || (p.chatAt !== undefined && this.time - p.chatAt < 0.5)) return;
    p.chatAt = this.time;
    this.events.push({ e: 'chat', by: p.id, name: p.name, color: p.color, text });
  }

  /** Tableau du village : chaque membre (en ligne ou endormi au village), géants battus, apprivoisements, dons. */
  onBoard(p: Player) {
    const rows: BoardRow[] = [
      ...[...this.players.values()].map((q) => ({ name: q.name, color: q.color, online: true, ...q.stats })),
      ...[...this.sleepers.values()].map((z) => ({ name: z.name, color: z.color, online: false, ...z.stats })),
    ];
    p.send({ t: 'board', rows });
  }

  /** Compte banni de ce village. */
  isBanned(userId: string | null | undefined) {
    return !!userId && this.banned.some((b) => b.id === userId);
  }

  /** Fondateur : expulser un dompteur. Son compte est banni (sa progression reste) et sa place se libère. */
  onKick(p: Player, id: number) {
    const t = this.players.get(id);
    if (!t || t === p || !this.isFounder(p)) return;
    if (t.userId && !this.isBanned(t.userId)) this.banned.push({ id: t.userId, name: t.name });
    this.saveVillage();
    this.events.push({ e: 'info', text: `${t.name} a été expulsé du village` });
    t.send({ t: 'closed', msg: 'Tu as été expulsé de ce village par son fondateur.' });
    t.close?.();
  }

  /** Fondateur : lever un bannissement ; le compte pourra revenir, avec sa progression. */
  onUnban(p: Player, userId: string) {
    if (!this.isFounder(p) || p.userId === null || !this.isBanned(userId)) return;
    const b = this.banned.find((x) => x.id === userId)!;
    this.banned = this.banned.filter((x) => x.id !== userId);
    this.saveVillage();
    this.events.push({ e: 'info', text: `${b.name} peut de nouveau rejoindre le village` });
  }

  /** Fondateur du village (sans compte enregistré, en test : tout le monde). */
  isFounder(p: Player) {
    return this.founder === null || p.userId === this.founder;
  }

  removePlayer(id: number) {
    const p = this.players.get(id);
    if (!p) return;
    const prof = this.profileOf(p);
    for (const uid of p.army) this.units.delete(uid);
    this.players.delete(id);
    this.diffs.delete(id);
    // Il s'endort au village avec sa meute (sauf s'il a été expulsé ou a tout effacé).
    if (!this.deleted && !p.wiped && !this.isBanned(p.userId)) this.addSleeper(p.userId ?? `invité:${p.id}`, prof);
    this.scaleBosses();
    this.events.push({ e: 'info', text: `${p.name} a quitté le village` });
  }

  /** Position envoyée par le client, bornée par la vitesse max (anti-téléportation). */
  onPos(p: Player, x: number, y: number, fx: number, fy: number) {
    if (p.dead || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    const mounted = p.mount ? this.units.get(p.mount) : undefined;
    const slow = p.slowUntil > this.time ? WEB_SLOW : 1;
    const allowed = PLAYER_SPEED * slow * (mounted ? mountSpeedOf(mounted.s) : 1) * 1.35 * Math.min(0.5, (now - p.lastPosMs) / 1000) + 12;
    p.lastPosMs = now;
    let dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > allowed) {
      dx = (dx / d) * allowed;
      dy = (dy / d) * allowed;
    }
    // Pas de traversée de l'eau : on glisse le long de la berge si possible. Une porte fermée ne se franchit pas.
    const nx = p.x + dx, ny = p.y + dy; // les bords du monde et les grottes sont gérés par blocked()
    const ok = (x: number, y: number) => {
      if (this.map.blocked(x, y)) return false;
      const g = this.map.gateCrossed(p.x, p.y, x, y);
      return g < 0 || this.gateIsOpen(g);
    };
    if (ok(nx, ny)) {
      p.x = nx;
      p.y = ny;
    } else if (ok(nx, p.y)) p.x = nx;
    else if (ok(p.x, ny)) p.y = ny;
    const fl = Math.hypot(fx, fy);
    if (fl > 0.01 && Number.isFinite(fl)) {
      p.fx = fx / fl;
      p.fy = fy / fl;
    }
  }

  /** Ce qui est sauvegardé sur le compte : pas la meute ordinaire, seulement les Alphas. */
  profileOf(p: Player): Profile {
    const alphas: Profile['alphas'] = [];
    const pack: number[] = [];
    for (const id of p.army) {
      const u = this.units.get(id);
      if (u?.alpha) alphas.push({ s: u.s, lvl: u.level, legend: u.legend || undefined });
      else if (u) pack.push(u.s);
    }
    for (const r of p.resting) alphas.push({ s: r.s, lvl: r.lvl, legend: r.legend || undefined, rest: true });
    for (const [s, wakeAt] of p.awakening) alphas.push({ s, lvl: 0, wakeAt });
    return { name: p.name, gold: p.gold, wood: p.wood, stone: p.stone, fruits: p.fruits, weapon: p.weapon, armor: p.armor, essences: [...p.essences], alphas, village_found: p.villageFound, class: p.cls, pack, seen: [...p.seen], stats: { ...p.stats } };
  }

  private near(p: Player, pos: { x: number; y: number }) {
    return !p.dead && dist2(p.x, p.y, pos.x, pos.y) <= (BUILDING_REACH + 40) ** 2;
  }

  /** Devant un bâtiment déjà construit. */
  private at(p: Player, b: BuildingId) {
    return this.buildings.includes(b) && this.near(p, this.posOf(b));
  }

  /** L'or du dompteur, le bois et la pierre de la réserve du village : s'il y a assez de tout, on paie (vrai). */
  private pay(p: Player, c: Cost) {
    if (p.gold < c.gold || this.stock.wood < c.wood || this.stock.stone < c.stone) return false;
    p.gold -= c.gold;
    this.stock.wood -= c.wood;
    this.stock.stone -= c.stone;
    p.dirty = true;
    return true;
  }

  /** À l'entrepôt : le bois et la pierre du sac passent dans la réserve du village. */
  onDeposit(p: Player) {
    if (!this.near(p, this.map.store) || (!p.wood && !p.stone)) return;
    this.events.push({ e: 'deposit', by: p.id, wood: p.wood, stone: p.stone });
    p.stats.given += p.wood + p.stone;
    this.stock.wood += p.wood;
    this.stock.stone += p.stone;
    p.wood = p.stone = 0;
    p.dirty = true;
    this.saveVillage();
  }

  private posOf(b: BuildingId) {
    return b === 'stone' ? this.map.stones[0] : this.map[b];
  }

  private saveVillage() {
    this.onVillage?.({ camps: [...this.camps], buildings: [...this.buildings], unlocked: [...this.unlocked], hall: this.hall, beaten: [...this.beaten], ...this.stock, banned: [...this.banned] });
  }

  /** Construire un bâtiment du village : n'importe quel membre, devant son emplacement, une fois pour tous (or, bois, pierre). */
  onBuild(p: Player, b: BuildingId) {
    if (!BUILDING_IDS.includes(b) || this.buildings.includes(b) || !this.near(p, this.posOf(b))) return;
    if (this.hall < BUILDINGS[b].hall || !this.pay(p, buildingCost(b))) return;
    this.buildings.push(b);
    this.saveVillage();
    this.events.push({ e: 'built', b, by: p.id });
  }

  /** Améliorer l'Hôtel de ville, devant elle : un niveau de plus pour tout le village (or, bois, pierre). */
  onHall(p: Player) {
    if (this.hall >= HALL_MAX || !this.near(p, this.map.hall) || !this.pay(p, HALL[this.hall])) return;
    this.hall++;
    this.saveVillage();
    this.events.push({ e: 'hall', lvl: this.hall, by: p.id });
  }

  /** Porte k ouverte pour le village (Hôtel de ville assez haut, géants de la zone vaincus). */
  private gateIsOpen(k: number) {
    return gateOpen(k, this.hall, this.beaten);
  }

  /** Débloquer une grotte pour tout le village, devant son entrée : 150 or × niveau de sa zone. */
  onUnlock(p: Player, cave: number) {
    const c = this.map.caves[cave];
    if (!c || this.unlocked.includes(cave) || !this.near(p, c.entrance)) return;
    const cost = caveUnlockCost(c.zone);
    if (p.gold < cost) return;
    p.gold -= cost;
    p.dirty = true;
    this.unlocked.push(cave);
    this.saveVillage();
    this.events.push({ e: 'unlock', cave, by: p.id });
  }

  /** Marché : vendre un monstre ordinaire de sa meute (les Alphas ne se vendent pas). */
  onSell(p: Player, id: number) {
    const u = this.units.get(id);
    if (!this.at(p, 'market') || !u || u.alpha || u.owner !== p.id) return;
    const gold = monsterSellPrice(u.s);
    this.units.delete(u.id);
    p.army = p.army.filter((x) => x !== u.id);
    p.gold += gold;
    p.dirty = true;
    this.events.push({ e: 'trade', to: p.id, s: u.s, gold, sold: true });
  }

  /** Marché : acheter un monstre ordinaire d'une espèce déjà croisée (dans la limite de la meute). */
  onBuy(p: Player, s: number) {
    if (!this.at(p, 'market') || !(s in SPECIES) || isBoss(s) || !p.seen.has(s) || this.armySize(p) >= ARMY_CAP) return;
    const gold = monsterBuyPrice(s);
    if (p.gold < gold) return;
    p.gold -= gold;
    const u = this.createUnit(s as SpeciesId, false, p.x, p.y);
    this.makeTamed(u, p);
    this.placeNear(u, p);
    p.dirty = true;
    this.events.push({ e: 'trade', to: p.id, s, gold, sold: false });
  }

  onUpgrade(p: Player, what: 'weapon' | 'armor') {
    if (!this.at(p, 'forge')) return;
    if (what === 'weapon') {
      const cost = weaponCost(p.weapon);
      if (p.weapon >= WEAPON_MAX || p.gold < cost) return;
      p.gold -= cost;
      p.weapon++;
    } else if (what === 'armor') {
      const cost = armorCost(p.armor);
      if (p.armor >= ARMOR_MAX || p.gold < cost) return;
      p.gold -= cost;
      const ratio = p.hp / maxHpOf(p);
      p.armor++;
      p.hp = Math.round(maxHpOf(p) * ratio);
    } else return;
    p.dirty = true;
    this.events.push({ e: 'upgrade', id: p.id, what, lvl: what === 'weapon' ? p.weapon : p.armor });
  }

  /** Choisir sa classe à la forge : la première fois gratuitement, ensuite contre un peu d'or. */
  onClass(p: Player, cls: ClassId) {
    if (!CLASS_IDS.includes(cls) || p.cls === cls || !this.at(p, 'forge')) return;
    const cost = p.cls === null ? 0 : CLASS_CHANGE_COST;
    if (p.gold < cost) return;
    p.gold -= cost;
    const ratio = p.hp / maxHpOf(p);
    p.cls = cls;
    p.hp = Math.round(maxHpOf(p) * ratio);
    p.dirty = true;
    this.events.push({ e: 'class', id: p.id, cls });
  }

  /** Alpha équipé (unité sur le terrain) de cette espèce, s'il y en a un. */
  private fieldAlpha(p: Player, s: number) {
    for (const id of p.army) {
      const u = this.units.get(id);
      if (u?.alpha && u.s === s) return u;
    }
    return undefined;
  }

  private equippedCount(p: Player) {
    return p.army.filter((id) => this.units.get(id)?.alpha).length;
  }

  /** Nombre total d'Alphas possédés (équipés et rangés) : c'est lui qui compte pour le bonus de collection. */
  private alphaCount(p: Player) {
    return this.equippedCount(p) + p.resting.length;
  }

  private spawnAlpha(p: Player, s: number, lvl: number, legend: boolean) {
    const u = this.createUnit(s as SpeciesId, true, p.x, p.y, lvl);
    u.legend = legend;
    u.owner = p.id;
    this.placeNear(u, p);
    p.army.push(u.id);
    return u;
  }

  /** Équiper un Alpha rangé (5 au maximum sur le terrain), ou ranger un Alpha équipé à la Tanière. */
  onAlphaEquip(p: Player, s: number, equip: boolean) {
    if (!this.at(p, 'den')) return;
    if (equip) {
      const i = p.resting.findIndex((r) => r.s === s);
      if (i < 0 || this.equippedCount(p) >= ALPHA_EQUIP_MAX) return;
      const [r] = p.resting.splice(i, 1);
      this.spawnAlpha(p, r.s, r.lvl, r.legend);
    } else {
      const u = this.fieldAlpha(p, s);
      if (!u) return;
      if (p.mount === u.id) this.dismount(p);
      p.resting.push({ s: u.s, lvl: u.level, legend: u.legend });
      p.army = p.army.filter((id) => id !== u.id);
      this.units.delete(u.id);
    }
    this.refreshAlphas(p);
    p.dirty = true;
  }

  onAlphaUp(p: Player, s: number) {
    if (!this.at(p, 'den')) return;
    const u = this.fieldAlpha(p, s), r = p.resting.find((x) => x.s === s);
    const lvl = u?.level ?? r?.lvl;
    if (lvl === undefined || lvl >= ALPHA_LVL_MAX) return;
    const cost = alphaUpCost(lvl);
    if (p.essences[s] < cost) return;
    p.essences[s] -= cost;
    if (u) this.setAlphaLevel(u, lvl + 1);
    else r!.lvl++;
    p.dirty = true;
    this.events.push({ e: 'alphaUp', id: u?.id ?? 0, by: p.id, s, lvl: lvl + 1 });
  }

  /** Une âme de ce géant sert-elle encore au dompteur ? Non s'il en a déjà assez, ou si son Alpha est déjà légendaire. */
  private wantsSoul(p: Player, boss: number) {
    if (p.essences[boss] >= LEGEND_SOULS) return false;
    const base = SPECIES.findIndex((sp) => sp.key === SPECIES[boss].base);
    return !(this.fieldAlpha(p, base)?.legend || p.resting.some((r) => r.s === base && r.legend));
  }

  /** Éveille l'Alpha d'une espèce (un seul par espèce) avec les essences récoltées. */
  /** Âme du boss de l'espèce → l'Alpha devient légendaire (stats ×1,5, plus grand). */
  onLegend(p: Player, s: number) {
    if (!this.at(p, 'den')) return;
    const u = this.fieldAlpha(p, s), r = p.resting.find((x) => x.s === s);
    if ((!u && !r) || u?.legend || r?.legend) return;
    const boss = bossOf(s);
    if (boss < 0 || p.essences[boss] < LEGEND_SOULS) return;
    p.essences[boss] -= LEGEND_SOULS;
    if (u) {
      u.legend = true;
      this.setAlphaLevel(u, u.level);
    } else r!.legend = true;
    p.dirty = true;
    this.events.push({ e: 'legend', id: u?.id ?? 0, by: p.id, s });
  }

  onAlphaCreate(p: Player, s: number) {
    if (!(s in SPECIES) || isBoss(s) || !this.at(p, 'den') || p.essences[s] < ALPHA_CREATE_COST) return;
    if (p.awakening.has(s) || this.fieldAlpha(p, s) || p.resting.some((r) => r.s === s)) return;
    p.essences[s] -= ALPHA_CREATE_COST;
    p.awakening.set(s, Date.now() + alphaAwakenS(s) * 1000);
    p.dirty = true;
    this.events.push({ e: 'info', text: `${p.name} commence l'éveil d'un Alpha ${SPECIES[s].name}` });
  }

  /** Les Alphas dont l'éveil est terminé rejoignent leur dompteur (s'il est debout). */
  private updateAwakenings() {
    const now = Date.now();
    for (const p of this.players.values()) {
      if (p.dead) continue;
      for (const [s, wakeAt] of p.awakening) {
        if (now < wakeAt) continue;
        p.awakening.delete(s);
        p.dirty = true;
        if (this.equippedCount(p) >= ALPHA_EQUIP_MAX) {
          // Déjà 5 Alphas sur le terrain : le nouveau attend à la Tanière.
          p.resting.push({ s, lvl: 0, legend: false });
          this.refreshAlphas(p);
          this.events.push({ e: 'awaken', id: 0, by: p.id, s });
          continue;
        }
        const u = this.spawnAlpha(p, s, 0, false);
        this.refreshAlphas(p);
        this.events.push({ e: 'awaken', id: u.id, by: p.id, s: u.s });
      }
    }
  }

  private setAlphaLevel(u: Unit, lvl: number) {
    const owner = this.players.get(u.owner);
    const count = owner ? this.alphaCount(owner) : 1;
    const st = alphaStats(u.s, lvl, count, u.legend);
    const ratio = u.reviveAt ? 1 : u.hp / u.maxHp;
    u.level = lvl;
    u.maxHp = st.hp;
    u.dmg = st.dmg;
    u.r = st.r;
    if (!u.reviveAt) u.hp = u.maxHp * ratio;
  }

  /** Bonus de collection : recalcule tous les Alphas d'un dompteur (chaque Alpha renforce les autres de 10 %). */
  private refreshAlphas(p: Player) {
    for (const id of p.army) {
      const u = this.units.get(id);
      if (u?.alpha) this.setAlphaLevel(u, u.level);
    }
  }

  /** Monter sur un Alpha éveillé (id) ou en descendre (id = 0, ou la monture actuelle). */
  onMount(p: Player, id: number) {
    if (p.mount && (id === 0 || id === p.mount)) return this.dismount(p);
    const u = this.units.get(id);
    if (p.dead || !u || !u.alpha || u.owner !== p.id || u.reviveAt || mountSpeedOf(u.s) === 1) return;
    if (dist2(u.x, u.y, p.x, p.y) > MOUNT_REACH ** 2) return;
    if (p.mount) this.dismount(p);
    p.mount = u.id;
    u.target = 0;
    u.recalling = false;
    this.events.push({ e: 'mount', by: p.id, id: u.id, on: true });
  }

  private dismount(p: Player) {
    const u = this.units.get(p.mount);
    p.mount = 0;
    if (!u) return;
    if (!u.reviveAt) this.placeNear(u, p);
    this.events.push({ e: 'mount', by: p.id, id: u.id, on: false });
  }

  /** Vrai si cette unité est la monture de son dompteur. */
  private isMount(u: Unit) {
    return u.owner !== 0 && this.players.get(u.owner)?.mount === u.id;
  }

  onCheat(p: Player) {
    for (const s of p.awakening.keys()) p.awakening.set(s, 0); // éveils instantanés
    p.essences = p.essences.map((n) => n + 30);
    p.gold += 300;
    p.wood += 100;
    p.stone += 100;
    this.events.push({ e: 'info', text: `${p.name} triche (mode dev)` });
  }

  // ───────────────────────── Simulation ─────────────────────────

  step() {
    this.tick++;
    this.time += DT;

    this.updateRevives();
    this.updateRespawns();
    this.clearEmptyCaves();
    this.updateAwakenings();
    this.updateSleepers();
    for (const p of this.players.values()) {
      if (p.villageFound || p.dead || !this.map.inVillage(p.x, p.y)) continue;
      p.villageFound = true; // découvert : la prochaine fois, on arrivera ici
      p.dirty = true;
    }
    this.updateSpawns();
    this.updateSeen();

    // La monture suit exactement son cavalier (elle n'est pas une cible séparée).
    for (const p of this.players.values()) {
      const m = p.mount ? this.units.get(p.mount) : undefined;
      if (m) [m.x, m.y] = [p.x, p.y];
    }
    this.grid.clear();
    for (const p of this.players.values()) if (!p.dead) this.grid.insert(p);
    for (const u of this.units.values()) if (!u.reviveAt && !this.isMount(u)) this.grid.insert(u);

    for (const p of this.players.values()) this.playerAttack(p);
    const near = [...this.players.values()].filter((p) => !p.dead);
    const watched = (u: Unit) => near.some((p) => dist2(p.x, p.y, u.x, u.y) < ACTIVE_R ** 2);
    for (const u of [...this.units.values()]) {
      if (u.reviveAt || u.hp <= 0) continue;
      if (this.isMount(u)) this.mountAttack(u);
      else if (u.owner) this.followerAI(u);
      // loin de tout dompteur, un sauvage ne fait que flâner sans témoin : on ne le fait pas réfléchir
      else if (!(u.idle = !u.returning && !watched(u))) this.wildAI(u);
    }
    this.updateHazards();
    this.updateShots();
    this.separate();
    this.regen();
    this.broadcast();
    this.events = [];
  }

  /** Bestiaire : chaque espèce sauvage (hors géants) croisée à l'écran y entre, pour ce dompteur. */
  private updateSeen() {
    if (this.tick % 10 !== 0) return;
    for (const p of this.players.values()) {
      if (p.dead) continue;
      this.grid.query(p.x, p.y, 520, (e) => {
        if (e.kind !== 'u' || e.owner || isBoss(e.s) || p.seen.has(e.s) || dist2(p.x, p.y, e.x, e.y) > 520 ** 2) return;
        p.seen.add(e.s);
        p.dirty = true;
        this.events.push({ e: 'seen', to: p.id, s: e.s });
      });
    }
  }

  /** R maintenu, relâché (ou l'onglet perd le focus). */
  onHelp(p: Player, on: boolean) {
    p.helping = on;
  }

  /** Un coéquipier debout, R maintenu près du corps pendant REVIVE_HOLD_S : relevé sur place. */
  private updateRevives() {
    for (const d of this.players.values()) {
      if (!d.dead) continue;
      const ok = (h: Player | undefined): h is Player => !!h && h !== d && !h.dead && h.helping && dist2(h.x, h.y, d.x, d.y) <= REVIVE_R ** 2;
      let h = this.players.get(d.reviveBy);
      if (!ok(h)) {
        h = [...this.players.values()].find(ok);
        d.reviveT = 0; // relâché, éloigné ou changement de sauveteur : on recommence
      }
      d.reviveBy = h?.id ?? 0;
      if (!h) continue;
      d.reviveT += DT;
      if (d.reviveT >= REVIVE_HOLD_S) this.revivePlayer(d, h);
    }
  }

  private revivePlayer(d: Player, by: Player) {
    d.dead = false;
    d.hp = Math.max(1, Math.round(maxHpOf(d) * REVIVE_HP));
    d.reviveBy = 0;
    d.reviveT = 0;
    d.lastPosMs = Date.now();
    d.send({ t: 'teleport', x: d.x, y: d.y });
    this.events.push({ e: 'previve', id: d.id, by: by.id });
  }

  private updateRespawns() {
    for (const p of this.players.values()) {
      // Une réanimation en cours retient le retour au camp.
      if (!p.dead || p.reviveBy || this.time < p.respawnAt) continue;
      // Réapparition au dernier camp établi avant le lieu de la mort, sinon au village.
      const home = this.respawnPoint(p.x, p.y);
      const a = Math.random() * Math.PI * 2;
      const at = this.map.freeNear(home.x + Math.cos(a) * 50, home.y + Math.sin(a) * 50 + 40);
      p.dead = false;
      p.hp = maxHpOf(p);
      p.lastPosMs = Date.now();
      p.x = at.x;
      p.y = at.y;
      p.send({ t: 'teleport', x: p.x, y: p.y });
      for (const uid of p.army) {
        const u = this.units.get(uid);
        if (u && !u.reviveAt) this.placeNear(u, p);
      }
    }
    for (const u of this.units.values()) {
      if (!u.reviveAt || this.time < u.reviveAt) continue;
      const owner = this.players.get(u.owner);
      if (!owner || owner.dead) continue; // il attend que son dompteur soit debout (pas de retour près du boss)
      if (this.bossFight(owner)) continue; // ni pendant un combat de géant : il revient une fois le combat fini
      u.reviveAt = 0;
      u.hp = u.maxHp;
      u.target = 0;
      this.placeNear(u, owner);
      this.events.push({ e: 'revive', id: u.id });
    }
  }

  /** Camp établi le plus avancé qui ne soit pas plus loin sur le couloir que (x, y) ; sinon le village. */
  respawnPoint(x: number, y: number) {
    const c = this.map.respawnSite(x, y, this.camps);
    return c < 0 ? this.map.village : this.map.sites[c];
  }

  /** Zone où la meute se promène quand son dompteur s'y repose : la place du village, ou un camp établi. */
  private safeArea(x: number, y: number) {
    if (this.map.inVillage(x, y)) return { ...this.map.village, r: VILLAGE_R - 70 };
    const c = this.campAt(x, y);
    return c >= 0 ? { ...this.map.sites[c], r: CAMP_R - 50 } : null;
  }

  /** Dans le village ou dans un camp établi : soins, et les monstres n'y attaquent pas. */
  safe(x: number, y: number) {
    return this.map.inVillage(x, y) || this.campAt(x, y) >= 0;
  }

  private campAt(x: number, y: number) {
    const i = this.map.siteAt(x, y, CAMP_R);
    return i >= 0 && this.camps.includes(i) ? i : -1;
  }

  /** Établir le camp d'un emplacement : n'importe quel membre du village, contre de l'or, une fois pour tous. */
  onEstablish(p: Player, site: number) {
    const c = this.map.sites[site];
    if (!c || p.dead || this.camps.includes(site) || p.gold < CAMP_COST) return;
    if (dist2(p.x, p.y, c.x, c.y) > CAMP_R ** 2) return;
    p.gold -= CAMP_COST;
    p.dirty = true;
    this.camps.push(site);
    this.saveVillage();
    this.events.push({ e: 'camp', site, by: p.id });
    // les monstres qui traînent dans le camp sont chassés
    for (const u of this.units.values()) if (!u.owner && !isBoss(u.s) && this.campAt(u.x, u.y) >= 0) u.returning = true;
  }

  /** Pierre active près de laquelle se trouve p : -1 village, index du camp, ou null. */
  private stoneNear(p: Player): number | null {
    const near = (st: { x: number; y: number }) => dist2(p.x, p.y, st.x, st.y) <= (BUILDING_REACH + 40) ** 2;
    if (this.buildings.includes('stone') && near(this.map.stones[0])) return -1;
    for (const c of this.camps) if (near(this.map.stones[c + 1])) return c;
    return null;
  }

  /** Voyage d'une Pierre de passage à une autre (village ou camp établi), avec toute la meute. */
  onTravel(p: Player, to: number) {
    if (p.dead) return;
    const from = this.stoneNear(p);
    if (from === null || from === to || (to === -1 ? !this.buildings.includes('stone') : !this.camps.includes(to))) return;
    const st = this.map.stones[to + 1];
    const at = this.map.freeNear(st.x - 10, st.y + 60);
    this.events.push({ e: 'travel', id: p.id, x: Math.round(p.x), y: Math.round(p.y), tx: Math.round(at.x), ty: Math.round(at.y) });
    p.x = at.x;
    p.y = at.y;
    p.send({ t: 'teleport', x: p.x, y: p.y });
    for (const uid of p.army) {
      const u = this.units.get(uid);
      if (u && !u.reviveAt) {
        this.placeNear(u, p);
        u.target = 0;
        u.recalling = false;
        u.path = null;
      }
    }
  }

  private placeNear(u: Unit, p: Player) {
    const a = Math.random() * Math.PI * 2;
    const at = this.map.freeNear(p.x + Math.cos(a) * 50, p.y + Math.sin(a) * 50);
    u.x = at.x;
    u.y = at.y;
  }

  private wildCount(s: number) {
    let n = 0;
    for (const u of this.units.values()) if (!u.owner && !u.alpha && u.s === s) n++;
    return n;
  }

  private updateSpawns() {
    if (this.tick % 10 !== 0) return; // 2×/s suffit
    this.map.ores.forEach((o, i) => {
      if (this.oreHp[i] > 0 || this.time < this.oreBack[i]) return;
      // il réapparaît (solide) seulement quand personne ne se tient à sa place
      let free = true;
      this.grid.query(o.x, o.y, 80, (e) => {
        if (dist2(e.x, e.y, o.x, o.y) < (e.r + 18 + o.zone * 2 + 6) ** 2) free = false;
      });
      if (!free) return;
      this.oreHp[i] = oreHp(o.zone);
      this.map.oreDown.delete(i);
    });
    this.map.caves.forEach((c, i) => {
      if (this.caveBoss[i] || this.time < this.caveBack[i]) return;
      this.caveBoss[i] = this.spawnBoss(i);
      this.chests = this.chests.filter((ch) => ch.cave !== i); // le géant revient : son coffre s'en va
      this.events.push({ e: 'boss', cave: i, s: c.boss, down: false });
    });
    for (let s = 0; s < SPECIES.length; s++) {
      if (this.time < this.nextSpawn[s]) continue;
      if (this.wildCount(s) >= SPECIES[s].population) continue;
      if (this.spawnPack(s)) this.nextSpawn[s] = this.time + 2.5;
    }
  }

  /** Abscisse de la première porte fermée : au-delà, tout est sous la brume (rien n'y apparaît). */
  private fogArc() {
    const k = this.map.gates.findIndex((_, i) => !this.gateIsOpen(i));
    return k < 0 ? Infinity : this.map.gates[k];
  }

  /** Zone ouverte au village : la zone 1, puis chaque zone dont la porte s'est ouverte. */
  private zoneOpen(z: number) {
    return z <= 1 || this.gateIsOpen(z - 1);
  }

  private spawnPack(s: SpeciesId): boolean {
    const sp = SPECIES[s];
    const { map } = this;
    if (!this.zoneOpen(sp.zone)) return false; // zone encore sous la brume : pas de monstre
    const fog = this.fogArc();
    // On vise le tronçon du couloir de la zone, puis on vérifie la zone réelle (frontières déformées par le bruit).
    const zl = map.length / ZONES;
    for (let attempt = 0; attempt < 40; attempt++) {
      let cx: number, cy: number;
      if (sp.swim) {
        // créature aquatique : un point d'eau profonde de sa zone
        const pool = map.deepWater[sp.zone];
        if (!pool.length) return false;
        const k = Math.floor(Math.random() * (pool.length / 2)) * 2;
        [cx, cy] = [pool[k], pool[k + 1]];
      } else {
        // abscisse le long du couloir : le tronçon de la zone (un peu débordant), jamais au-delà du bout,
        const lo = Math.max(900, (sp.zone - 1.1) * zl), hi = Math.min(map.length - 250, (sp.zone + 0.1) * zl); // ni derrière le camp de départ
        const at = lo + Math.random() * (hi - lo);
        const c = map.spineAt(at), nv = map.normalAt(at);
        const off = (Math.random() - 0.5) * 2 * (map.halfWidth(at) - 60);
        [cx, cy] = [c.x + nv.x * off, c.y + nv.y * off];
      }
      if ((sp.swim ? !map.isWater(cx, cy) : map.blocked(cx, cy)) || map.zoneAt(cx, cy) !== sp.zone) continue;
      if (map.arcAt(cx, cy) > fog - 150) continue; // jamais dans la brume (ni tout contre)
      if (map.inVillage(cx, cy, 250) || dist2(cx, cy, map.spawn.x, map.spawn.y) < SPAWN_SAFE_R ** 2) continue;
      if (map.siteAt(cx, cy, CAMP_R + 300) >= 0) continue;
      let tooClose = false;
      for (const p of this.players.values()) if (dist2(cx, cy, p.x, p.y) < 700 ** 2) tooClose = true;
      if (tooClose) continue;
      const n = sp.pack[0] + Math.floor(Math.random() * (sp.pack[1] - sp.pack[0] + 1));
      for (let i = 0; i < n; i++) {
        const x = cx + (Math.random() - 0.5) * 120, y = cy + (Math.random() - 0.5) * 120;
        // chaque membre reste dans la zone de son espèce (une meute en lisière ne déborde pas)
        if (sp.swim ? map.isWater(x, y) : !map.blocked(x, y) && map.zoneAt(x, y) === sp.zone) this.createUnit(s, false, x, y);
      }
      return true;
    }
    return false;
  }

  private createUnit(s: SpeciesId, alpha: boolean, x: number, y: number, level = 0): Unit {
    const sp = SPECIES[s];
    const m = alpha ? ALPHA_MULT : { hp: 1, dmg: 1, size: 1 };
    const u: Unit = {
      kind: 'u', id: this.nextId++, s, alpha, owner: 0, x, y,
      r: Math.round(sp.r * m.size), hp: sp.hp * m.hp, maxHp: sp.hp * m.hp, dmg: sp.dmg * m.dmg,
      speed: sp.speed * (alpha ? 1.1 : 1), atkCdBase: sp.atkCd, atkCd: 0,
      target: 0, lastAttacker: 0, lastHitAt: -Infinity, homeX: x, homeY: y, returning: false,
      wanderX: x, wanderY: y, wanderT: Math.random() * 3, reviveAt: 0, level: 0, recalling: false, legend: false,
      castUntil: 0, moveCd: (BOSS_MOVES[SPECIES[s].key] ?? []).map((m) => ('cd' in m ? m.cd * (0.4 + Math.random() * 0.3) : 0)), splitDone: 0, enraged: false, summoner: 0, stuck: 0, path: null, pathAt: -Infinity, pathGoalX: 0, pathGoalY: 0,
      windup: 0, shotAt: 0, dormant: false, idle: false, hitters: new Set(),
    };
    if (alpha) this.setAlphaLevel(u, level); // arrondit aussi les stats du niveau 0
    this.units.set(u.id, u);
    return u;
  }

  private getEnt(id: number): Ent | undefined {
    return this.units.get(id) ?? this.players.get(id);
  }

  private alive(e: Ent | undefined): e is Ent {
    if (!e) return false;
    if (e.kind === 'p') return !e.dead;
    return !e.reviveAt && e.hp > 0;
  }

  /** Cible la plus proche satisfaisant le filtre dans un rayon autour de (x, y). */
  private nearest(x: number, y: number, radius: number, ok: (e: Ent) => boolean, fromX = x, fromY = y) {
    let best: Ent | undefined, bestD = Infinity;
    const r2 = radius * radius;
    this.grid.query(x, y, radius, (e) => {
      if (!ok(e) || !this.alive(e)) return;
      if (dist2(x, y, e.x, e.y) > r2) return;
      const d = dist2(fromX, fromY, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  /** Monstre sauvage qu'on combat : ni géant endormi, ni gibier passif (lui ne s'apprivoise qu'aux fruits). */
  private isWild = (e: Ent) => e.kind === 'u' && e.owner === 0 && !e.dormant && !SPECIES[e.s].passive;
  /** Monstre sauvage qu'on peut nourrir d'un fruit (gibier passif compris, géants exclus plus bas). */
  private isFeedable = (e: Ent) => e.kind === 'u' && e.owner === 0 && !e.dormant;
  private isAllyOfPlayers = (e: Ent) => (e.kind === 'p' || e.owner !== 0) && !this.safe(e.x, e.y);

  /** Attaque au clic (PC) ou automatique. */
  onMode(p: Player, manual: boolean) {
    p.manual = manual;
  }

  /** Attaque au clic : un coup vers ce point (clic maintenu : un ordre toutes les 0,15 s). */
  onAttack(p: Player, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    [p.aimX, p.aimY] = [x, y];
    p.orderUntil = this.time + 0.3;
  }

  private playerAttack(p: Player) {
    if (p.dead) return;
    p.atkCd -= DT;
    if (p.atkCd > 0) return;
    if (p.holding) return this.feed(p); // fruit en main : on nourrit, on ne frappe pas
    if (p.manual) return this.time <= p.orderUntil ? this.aimedAttack(p) : undefined; // attaque au clic : rien sans ordre
    const cls = classOf(p.cls);
    const reach = PLAYER_R + cls.range;
    const t = this.nearest(p.x, p.y, reach + 50, this.isWild) as Unit | undefined;
    if (!t || dist2(p.x, p.y, t.x, t.y) > (reach + t.r) ** 2) return this.mine(p);
    p.atkCd = cls.cd;
    const dmg = weaponDmg(p.weapon) * cls.dmg;
    if (p.cls === 'archer' || p.cls === 'mage') this.events.push({ e: 'shot', by: p.id, x: p.x, y: p.y, tx: t.x, ty: t.y, cls: p.cls });
    if (cls.splash) {
      // Mage : l'orbe explose et touche tous les monstres sauvages autour de la cible.
      const hit: Unit[] = [];
      this.grid.query(t.x, t.y, cls.splash + 40, (e) => {
        if (this.isWild(e) && this.alive(e) && dist2(e.x, e.y, t.x, t.y) <= (cls.splash! + e.r) ** 2) hit.push(e as Unit);
      });
      // pleins dégâts au point d'impact, de moins en moins vers le bord de l'explosion
      for (const e of hit) this.damage(e, dmg * (1 - (1 - MAGE_SPLASH_EDGE) * Math.min(1, Math.sqrt(dist2(e.x, e.y, t.x, t.y)) / cls.splash)), p);
    } else this.damage(t, dmg, p);
  }

  /**
   * Attaque au clic, dans la direction visée, qu'il y ait un monstre ou non : le guerrier frappe en arc devant lui,
   * l'archer tire en ligne droite (le premier monstre sur la trajectoire), l'orbe du mage explose au point visé
   * (dans sa portée). Tout monstre sauvage hostile peut être touché (jamais le gibier passif ni un géant endormi).
   * Rien touché au corps à corps : il récolte le filon ou le tas à portée.
   */
  private aimedAttack(p: Player) {
    const cls = classOf(p.cls);
    const reach = PLAYER_R + cls.range;
    const d = Math.hypot(p.aimX - p.x, p.aimY - p.y) || 1, ux = (p.aimX - p.x) / d, uy = (p.aimY - p.y) / d;
    const dmg = weaponDmg(p.weapon) * cls.dmg;
    const prey = (e: Ent) => this.isWild(e) && this.alive(e); // jamais le gibier passif, même au clic
    if (p.cls === 'mage') {
      p.atkCd = cls.cd;
      const k = Math.min(d, reach), bx = p.x + ux * k, by = p.y + uy * k;
      this.events.push({ e: 'shot', by: p.id, x: p.x, y: p.y, tx: Math.round(bx), ty: Math.round(by), cls: 'mage' });
      this.events.push({ e: 'boom', x: Math.round(bx), y: Math.round(by), r: cls.splash!, kind: 'orb' });
      const hit: Ent[] = [];
      this.grid.query(bx, by, cls.splash! + 40, (e) => prey(e) && dist2(e.x, e.y, bx, by) <= (cls.splash! + e.r) ** 2 && hit.push(e));
      for (const e of hit) this.damage(e, dmg * (1 - (1 - MAGE_SPLASH_EDGE) * Math.min(1, Math.sqrt(dist2(e.x, e.y, bx, by)) / cls.splash!)), p);
      return;
    }
    if (p.cls === 'archer') {
      // flèche en ligne droite : le premier monstre dont elle frôle le corps
      p.atkCd = cls.cd;
      let best: Ent | undefined, bt = reach;
      this.grid.query(p.x + ux * reach * 0.5, p.y + uy * reach * 0.5, reach * 0.5 + 60, (e) => {
        if (!prey(e)) return;
        const t = (e.x - p.x) * ux + (e.y - p.y) * uy;
        if (t < 0 || t > reach || t >= bt) return;
        if (Math.hypot(e.x - p.x - ux * t, e.y - p.y - uy * t) <= e.r + 6) [best, bt] = [e, t];
      });
      this.events.push({ e: 'shot', by: p.id, x: p.x, y: p.y, tx: Math.round(p.x + ux * bt), ty: Math.round(p.y + uy * bt), cls: 'archer' });
      if (best) this.damage(best, dmg, p);
      return;
    }
    // guerrier : coup en arc (±65°) devant lui, sur le plus proche
    let best: Ent | undefined, bd = Infinity;
    this.grid.query(p.x, p.y, reach + 60, (e) => {
      if (!prey(e)) return;
      const ex = e.x - p.x, ey = e.y - p.y, de = Math.hypot(ex, ey);
      if (de > reach + e.r || de >= bd || (de > e.r && (ex * ux + ey * uy) / de < Math.cos((65 * Math.PI) / 180))) return;
      [best, bd] = [e, de];
    });
    if (!best) return this.mine(p);
    p.atkCd = cls.cd;
    this.damage(best, dmg, p);
  }

  /** Cueillir les baies du buisson garni le plus proche (devant lui). */
  onPick(p: Player) {
    if (p.dead) return;
    const b = this.map.bushes.find((x) => this.bushBack[x.id] <= this.time && dist2(p.x, p.y, x.x, x.y) <= BUSH_PICK_R ** 2);
    if (!b) return;
    this.bushBack[b.id] = this.time + BUSH_REGROW_S;
    p.fruits += BERRIES_PICKED;
    p.dirty = true;
    this.events.push({ e: 'pick', by: p.id, bush: b.id, n: BERRIES_PICKED });
  }

  /** Tendre un fruit (s'il en a) ou le ranger. */
  onHold(p: Player, on: boolean) {
    p.holding = on && p.fruits > 0;
  }

  /**
   * Fruit tendu : il nourrit le monstre sauvage collé à lui, un fruit par seconde. Chaque fruit a une chance de
   * l'apprivoiser (bonne pour le gibier passif, faible pour un monstre hostile ; jamais un géant ni ses renforts).
   */
  private feed(p: Player) {
    if (p.fruits <= 0) {
      p.holding = false;
      return;
    }
    const t = this.nearest(p.x, p.y, PLAYER_R + 80, (e) => this.isFeedable(e) && !isBoss((e as Unit).s) && !(e as Unit).summoner) as Unit | undefined;
    if (!t || dist2(p.x, p.y, t.x, t.y) > (PLAYER_R + t.r + 26) ** 2) return;
    p.atkCd = FEED_CD;
    if (this.armySize(p) >= ARMY_CAP) {
      this.events.push({ e: 'full', to: p.id });
      return;
    }
    p.fruits--;
    p.dirty = true;
    if (Math.random() < fruitTameChance(t.s)) {
      this.makeTamed(t, p);
      this.events.push({ e: 'tame', id: t.id, by: p.id, s: t.s });
      p.stats.tamed++;
    } else {
      this.events.push({ e: 'feed', by: p.id, id: t.id });
      if (SPECIES[t.s].passive && Math.random() < FRUIT_ESSENCE) {
        // repu, le gibier laisse parfois une essence de son espèce
        p.essences[t.s] += 1;
        this.events.push({ e: 'essence', to: p.id, s: t.s, x: t.x, y: t.y });
      }
    }
    if (p.fruits <= 0) p.holding = false;
  }

  /** Aucun monstre à portée : le dompteur récolte le filon, le rocher ou le bois mort le plus proche. */
  private mine(p: Player) {
    const reach = PLAYER_R + PLAYER_RANGE + ORE_R;
    let best = -1, bd = reach * reach;
    for (const o of this.map.ores) {
      if (this.oreHp[o.id] <= 0) continue;
      const d = dist2(p.x, p.y, o.x, o.y);
      if (d < bd) [bd, best] = [d, o.id];
    }
    if (best < 0) return;
    const o = this.map.ores[best];
    p.atkCd = PLAYER_ATK_CD;
    this.oreHp[best] -= weaponDmg(p.weapon);
    const done = this.oreHp[best] <= 0;
    this.events.push({ e: 'mine', by: p.id, id: best, done });
    if (!done) return;
    this.oreBack[best] = this.time + ORE_RESPAWN_S;
    this.map.oreDown.add(best); // épuisé : il disparaît, on passe à travers jusqu'à son retour
    p.dirty = true;
    if (o.res === 'gold') {
      const gold = oreGold(o.zone);
      p.gold += gold;
      this.events.push({ e: 'gold', to: p.id, n: gold, x: o.x, y: o.y - 10 });
    }
    // un filon donne aussi un peu de pierre ; rochers et bois mort donnent leur matière
    const wood = o.res === 'wood' ? resYield(o.zone) : 0, stone = o.res === 'stone' ? resYield(o.zone) : o.res === 'gold' ? oreStone(o.zone) : 0;
    p.wood += wood;
    p.stone += stone;
    this.events.push({ e: 'res', to: p.id, wood, stone, x: o.x, y: o.y - (o.res === 'gold' ? 30 : 10) });
  }

  // ───────────────────────── Attaques spéciales des mini-boss ─────────────────────────

  /** Alliés des dompteurs (joueurs et leurs monstres) vivants dans un rayon. */
  private alliesNear(x: number, y: number, r: number) {
    const out: Ent[] = [];
    this.grid.query(x, y, r + 60, (e) => {
      if (!this.alive(e) || !(e.kind === 'p' || e.owner !== 0)) return;
      if (dist2(x, y, e.x, e.y) <= (r + e.r) ** 2) out.push(e);
    });
    return out;
  }

  /** Monstres sauvages vivants (combattus) dans un rayon. */
  private wildNear(x: number, y: number, r: number) {
    const out: Ent[] = [];
    this.grid.query(x, y, r + 60, (e) => {
      if (this.alive(e) && this.isWild(e) && dist2(x, y, e.x, e.y) <= (r + e.r) ** 2) out.push(e);
    });
    return out;
  }

  /** Qui une attaque spéciale peut toucher : les dompteurs et leurs meutes (géant), ou les sauvages (Alpha légendaire). */
  private targetsNear(caster: Unit, x: number, y: number, r: number) {
    return caster.owner ? this.wildNear(x, y, r) : this.alliesNear(x, y, r);
  }

  private hazard(boss: Unit, h: Partial<Hazard> & Pick<Hazard, 'kind' | 'x' | 'y' | 'r' | 'at' | 'dmg'>) {
    this.hazards.push({ x2: h.x, y2: h.y, start: this.time, until: h.at, fired: false, nextTick: 0, boss, ...h });
  }

  /** Plus aucun dompteur debout dans la grotte (sorti, mort ou parti) : les renforts du boss disparaissent. */
  private clearEmptyCaves() {
    if (this.tick % 5 !== 0) return;
    const occupied = new Set<number>();
    for (const p of this.players.values()) {
      const c = p.dead ? undefined : this.map.caveAt(p.x, p.y);
      if (c) occupied.add(c.id);
    }
    const bosses = new Set(this.caveBoss.filter((id, cave) => id && !occupied.has(cave)));
    if (!bosses.size) return;
    for (const m of [...this.units.values()]) if (m.summoner && !m.owner && bosses.has(m.summoner)) this.units.delete(m.id);
    // Le géant se rendort, guéri, au fond de sa grotte : il faudra lui reparler.
    for (const id of bosses) {
      const u = this.units.get(id);
      if (u && !u.dormant) this.calmBoss(u);
    }
  }

  private calmBoss(u: Unit) {
    const sp = SPECIES[u.s];
    this.hazards = this.hazards.filter((h) => h.boss !== u);
    Object.assign(u, {
      dormant: true, hitters: new Set(), hp: u.maxHp, x: u.homeX, y: u.homeY, target: 0, lastAttacker: 0, castUntil: 0, windup: 0,
      splitDone: 0, enraged: false, atkCdBase: sp.atkCd, speed: sp.speed, path: null,
    });
  }

  /** Ouvrir le coffre d'un géant vaincu, devant lui : une fois par dompteur, un montant d'or tiré au hasard. */
  onChest(p: Player, id: number) {
    const ch = this.chests.find((c) => c.id === id);
    if (!ch || p.dead || !ch.eligible.has(p.id) || ch.opened.has(p.id) || !this.near(p, ch)) return;
    ch.opened.add(p.id);
    const [lo, hi] = CHEST_GOLD;
    const gold = Math.round(SPECIES[ch.s].gold * (lo + Math.random() * (hi - lo)));
    p.gold += gold;
    p.dirty = true;
    this.events.push({ e: 'chest', id, to: p.id, gold, x: Math.round(ch.x), y: Math.round(ch.y) });
  }

  /** Parler au géant endormi de sa grotte, à côté de lui : il se réveille et le combat commence. */
  onChallenge(p: Player, cave: number) {
    const c = this.map.caves[cave];
    const u = c && this.units.get(this.caveBoss[cave]);
    if (!u || !u.dormant || p.dead || this.map.caveAt(p.x, p.y)?.id !== c.id) return;
    if (dist2(p.x, p.y, u.x, u.y) > (u.r + BOSS_TALK_R) ** 2) return;
    u.dormant = false;
    u.target = p.id;
    this.events.push({ e: 'challenge', cave, id: u.id, by: p.id });
  }

  private summonMinions(u: Unit, n: number, max: number) {
    const base = SPECIES.findIndex((sp) => sp.key === SPECIES[u.s].base);
    if (base < 0) return;
    let alive = 0;
    for (const m of this.units.values()) if (m.summoner === u.id && !m.owner) alive++;
    for (let i = 0; i < Math.min(n, max - alive); i++) {
      const a = Math.random() * Math.PI * 2;
      const at = this.map.freeNear(u.x + Math.cos(a) * (u.r + 30), u.y + Math.sin(a) * (u.r + 30));
      const m = this.createUnit(base, false, at.x, at.y);
      m.summoner = u.id;
      [m.homeX, m.homeY] = [u.homeX, u.homeY];
    }
  }

  /**
   * Alpha légendaire : il a hérité de l'attaque spéciale de son géant (bond, charge, onde de choc…) et la lance seul
   * contre les monstres sauvages, avec sa recharge. Renvoie vrai pendant qu'il la prépare (il reste sur place).
   */
  private legendMove(u: Unit, t: Ent) {
    if (u.castUntil > this.time) return true;
    const boss = bossOf(u.s);
    const moves = (boss < 0 ? [] : BOSS_MOVES[SPECIES[boss].key] ?? []).filter((m): m is Extract<BossMove, { cd: number }> => 'cd' in m && m.kind !== 'summon');
    if (!moves.length) return false;
    if (u.moveCd.length !== moves.length) u.moveCd = moves.map((m) => m.cd * 0.5);
    moves.forEach((_, i) => (u.moveCd[i] -= DT));
    const i = moves.findIndex((_, k) => u.moveCd[k] <= 0);
    if (i < 0 || dist2(u.x, u.y, t.x, t.y) > 450 ** 2) return false;
    u.moveCd[i] = moves[i].cd * LEGEND_MOVE_CD;
    this.castMove(u, moves[i], t);
    this.events.push({ e: 'move', id: u.id, kind: moves[i].kind });
    return u.castUntil > this.time;
  }

  /** Cerveau d'un mini-boss en combat. Renvoie vrai s'il est occupé (préparation d'une attaque). */
  private bossAI(u: Unit, t: Ent) {
    if (u.castUntil > this.time) return true;
    const moves = BOSS_MOVES[SPECIES[u.s].key] ?? [];
    const ratio = u.hp / u.maxHp;
    moves.forEach((m, i) => {
      if ('cd' in m) u.moveCd[i] -= DT;
      if (m.kind === 'split' && u.splitDone < m.at.length && ratio < m.at[u.splitDone]) {
        u.splitDone++;
        this.summonMinions(u, m.n, 99);
        this.events.push({ e: 'move', id: u.id, kind: m.kind });
      }
      if (m.kind === 'enrage' && !u.enraged && ratio < m.below) {
        u.enraged = true;
        u.atkCdBase *= 0.6;
        u.speed *= 1.3;
        this.events.push({ e: 'move', id: u.id, kind: m.kind });
      }
    });
    // Une seule attaque à recharge à la fois : la première prête.
    const i = moves.findIndex((m, k) => 'cd' in m && u.moveCd[k] <= 0);
    if (i < 0) return false;
    const m = moves[i] as Extract<BossMove, { cd: number }>;
    u.moveCd[i] = m.cd;
    this.castMove(u, m, t);
    this.events.push({ e: 'move', id: u.id, kind: m.kind });
    return u.castUntil > this.time;
  }

  private castMove(u: Unit, m: Extract<BossMove, { cd: number }>, t: Ent) {
    const d = u.dmg * (u.owner ? LEGEND_MOVE_DMG : 1); // lancée par un Alpha légendaire : un peu atténuée
    switch (m.kind) {
      case 'leap': {
        // Bond : zone d'arrivée annoncée 1 s à l'avance, le boss y atterrit et écrase tout.
        // (point d'arrivée fixé au lancement : il atterrit dans la zone rouge, pas sur la cible qui s'en est écartée)
        const at = this.time + 1, lx = t.x, ly = t.y;
        u.castUntil = at;
        this.hazard(u, { kind: 0, x: lx, y: ly, r: 115, at, dmg: d * 1.8, onFire: () => {
          if (!this.map.blocked(lx, ly) && this.units.has(u.id)) [u.x, u.y] = [lx, ly];
        } });
        break;
      }
      case 'spores':
        // Nuages sous les dompteurs proches : ils restent 5 s et rongent ceux qui y restent.
        // (un Alpha légendaire n'en pose qu'un, sur sa cible)
        for (const p of u.owner ? [t] : this.alliesNear(u.x, u.y, 650).filter((e) => e.kind === 'p').slice(0, 3)) {
          this.hazard(u, { kind: 2, x: p.x, y: p.y, r: 95, at: this.time + 0.9, until: this.time + 5.9, dmg: d * 0.6 });
        }
        break;
      case 'summon':
        this.summonMinions(u, m.n, m.max);
        break;
      case 'charge': {
        // Charge : couloir annoncé, puis le boss le traverse d'un coup.
        const ang = Math.atan2(t.y - u.y, t.x - u.x);
        let len = 0;
        while (len < 460 && !this.map.blocked(u.x + Math.cos(ang) * (len + 20), u.y + Math.sin(ang) * (len + 20))) len += 20;
        const x2 = u.x + Math.cos(ang) * len, y2 = u.y + Math.sin(ang) * len;
        const at = this.time + 0.85;
        u.castUntil = at + 0.15;
        this.hazard(u, { kind: 1, x: u.x, y: u.y, x2, y2, r: 38, at, dmg: d * 1.6, onFire: () => {
          if (this.units.has(u.id)) [u.x, u.y] = [x2, y2];
        } });
        break;
      }
      case 'web':
        this.hazard(u, { kind: 3, x: t.x, y: t.y, r: 105, at: this.time + 0.7, dmg: d * 0.5 });
        break;
      case 'slam': {
        const at = this.time + 1.1;
        u.castUntil = at;
        this.hazard(u, { kind: 0, x: u.x, y: u.y, r: 175, at, dmg: d * (m.power ?? 1.5) });
        break;
      }
      case 'rocks':
        for (const e of this.targetsNear(u, u.x, u.y, 700).slice(0, 3)) {
          this.hazard(u, { kind: 0, x: e.x, y: e.y, r: 80, at: this.time + 1.2, dmg: d * 1.4 });
        }
        break;
      case 'volley': {
        // Salve en éventail vers la cible : on se glisse entre les projectiles.
        const base = Math.atan2(t.y - u.y, t.x - u.x), spread = 0.22;
        const speed = m.shot === 'jet' ? 520 : 280;
        for (let k = 0; k < m.n; k++) {
          const a = base + (k - (m.n - 1) / 2) * spread;
          this.launch(u, m.shot, u.x + Math.cos(a) * 400, u.y + Math.sin(a) * 400, d * 0.8, speed, 520, 0);
        }
        break;
      }
      case 'mortar': {
        // Pluie de tirs en cloche : le premier sur la cible, les autres autour ; chaque impact est annoncé au sol.
        for (let k = 0; k < m.n; k++) {
          const a = Math.random() * Math.PI * 2, off = k ? 70 + Math.random() * 110 : 0;
          this.launch(u, 'arc', t.x + Math.cos(a) * off, t.y + Math.sin(a) * off, d * 0.9, 0, 600, 60);
        }
        break;
      }
      case 'blink': {
        // Disparaît puis réapparaît à côté d'une cible, en explosant.
        const a = Math.random() * Math.PI * 2;
        const to = this.map.freeNear(t.x + Math.cos(a) * 70, t.y + Math.sin(a) * 70);
        const at = this.time + 0.9;
        u.castUntil = at;
        this.hazard(u, { kind: 0, x: to.x, y: to.y, r: 130, at, dmg: d * 1.3, onFire: () => {
          if (this.units.has(u.id)) [u.x, u.y] = [to.x, to.y];
        } });
        break;
      }
    }
  }

  private updateHazards() {
    for (const h of this.hazards) {
      if (!h.fired && this.time >= h.at) {
        h.fired = true;
        h.onFire?.();
        this.events.push({ e: 'boom', x: Math.round(h.x2 === h.x && h.y2 === h.y ? h.x : h.x2), y: Math.round(h.y2), r: h.r, kind: ['circle', 'line', 'cloud', 'web'][h.kind] });
        if (h.kind === 2) continue; // les nuages frappent dans la durée
        const hit = h.kind === 1 ? this.alliesOnLine(h) : this.targetsNear(h.boss, h.x, h.y, h.r);
        for (const e of hit) {
          if (h.kind === 3 && e.kind === 'p') e.slowUntil = this.time + WEB_SLOW_S;
          this.damage(e, h.dmg, h.boss);
        }
      }
      if (h.fired && h.kind === 2 && this.time < h.until && this.time >= h.nextTick) {
        h.nextTick = this.time + 0.5;
        for (const e of this.targetsNear(h.boss, h.x, h.y, h.r)) this.damage(e, h.dmg * 0.5, h.boss);
      }
    }
    this.hazards = this.hazards.filter((h) => !h.fired || (h.kind === 2 && this.time < h.until) || this.time < h.at + 0.3);
  }

  private alliesOnLine(h: Hazard) {
    const dx = h.x2 - h.x, dy = h.y2 - h.y, len2 = dx * dx + dy * dy || 1;
    const midX = (h.x + h.x2) / 2, midY = (h.y + h.y2) / 2;
    return this.targetsNear(h.boss, midX, midY, Math.sqrt(len2) / 2 + h.r).filter((e) => {
      const k = Math.max(0, Math.min(1, ((e.x - h.x) * dx + (e.y - h.y) * dy) / len2));
      return Math.hypot(e.x - h.x - k * dx, e.y - h.y - k * dy) <= h.r + e.r;
    });
  }

  /** Le dompteur est dans une grotte dont le géant est réveillé (combat en cours). */
  private bossFight(p: Player) {
    const c = this.map.caveAt(p.x, p.y);
    const u = c && this.units.get(this.caveBoss[c.id]);
    return !!u && !u.dormant && u.hp > 0;
  }

  /** Fait apparaître le mini-boss d'une grotte, au fond de son intérieur. */
  private spawnBoss(cave: number) {
    const c = this.map.caves[cave];
    if (!c) return 0;
    const u = this.createUnit(c.boss as SpeciesId, false, c.inside.x, c.inside.y - 60);
    u.maxHp = u.hp = SPECIES[u.s].hp * this.bossHpMult();
    u.dormant = true; // il attend qu'on vienne lui parler
    return u.id;
  }

  /** PV des géants multipliés par le nombre de dompteurs en ligne dans le village (au moins ×1). */
  private bossHpMult() {
    return Math.max(1, this.players.size);
  }

  /** Quelqu'un arrive ou s'en va : chaque géant garde sa part de PV, sur un total recalculé. */
  private scaleBosses() {
    for (const id of this.caveBoss) {
      const u = this.units.get(id);
      if (!u) continue;
      const ratio = u.hp / u.maxHp;
      u.maxHp = SPECIES[u.s].hp * this.bossHpMult();
      u.hp = u.maxHp * ratio;
    }
  }

  /** Entrer dans une grotte (depuis son entrée) ou en sortir (depuis sa sortie), avec sa meute. */
  onCave(p: Player, id: number, enter: boolean) {
    const c = this.map.caves[id];
    if (!c || p.dead) return;
    if (enter && !this.unlocked.includes(id)) return; // grotte pas encore débloquée
    const from = enter ? c.entrance : c.exit;
    if (dist2(p.x, p.y, from.x, from.y) > (BUILDING_REACH + 40) ** 2) return;
    const to = enter ? { x: c.exit.x, y: c.exit.y - 50 } : { x: c.entrance.x, y: c.entrance.y + 70 };
    const at = this.map.freeNear(to.x, to.y);
    p.x = at.x;
    p.y = at.y;
    p.send({ t: 'teleport', x: p.x, y: p.y });
    for (const uid of p.army) {
      const u = this.units.get(uid);
      if (u && !u.reviveAt) {
        this.placeNear(u, p);
        u.target = 0;
        u.recalling = false;
      }
    }
  }

  /** La monture mord ce qui passe à portée, en plus des coups de son cavalier. */
  private mountAttack(u: Unit) {
    u.atkCd -= DT;
    if (u.atkCd > 0) return;
    const t = this.nearest(u.x, u.y, u.r + 70, this.isWild) as Unit | undefined;
    if (!t || dist2(u.x, u.y, t.x, t.y) > (u.r + t.r + 14) ** 2) return;
    u.atkCd = u.atkCdBase;
    this.damage(t, u.dmg, u);
  }

  private move(u: Unit, tx: number, ty: number, speed: number, stop: number) {
    const dx = tx - u.x, dy = ty - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= stop) return true;
    const step = Math.min(speed * DT, d - stop);
    const ux = dx / d, uy = dy / d;
    // Contourne l'eau : essaie tout droit, puis en s'écartant de plus en plus.
    u.stuck += DT;
    for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.7, -1.7, 2.3, -2.3]) {
      const c = Math.cos(turn), sn = Math.sin(turn);
      const nx = u.x + (ux * c - uy * sn) * step, ny = u.y + (ux * sn + uy * c) * step;
      if (!this.blockedFor(u, nx, ny)) {
        u.x = nx;
        u.y = ny;
        if (Math.abs(turn) < 1.3) u.stuck = 0; // avance à peu près dans la bonne direction
        break;
      }
    }
    return false;
  }

  /**
   * Se déplace vers (tx, ty) en réfléchissant : tout droit si la voie est libre, sinon en suivant
   * un détour calculé (A*) autour des arbres, rochers, murs et lacs, recalculé au plus une fois par seconde.
   */
  private navTo(u: Unit, tx: number, ty: number, speed: number, stop: number) {
    if (this.swims(u)) return this.move(u, tx, ty, speed, stop); // dans l'eau : il longe la rive, sans détour par la terre
    if (this.map.clearLine(u.x, u.y, tx, ty)) {
      u.path = null;
      return this.move(u, tx, ty, speed, stop);
    }
    const goalMoved = dist2(tx, ty, u.pathGoalX, u.pathGoalY) > 64 ** 2;
    if (!u.path?.length || (goalMoved && this.time - u.pathAt > 0.5) || this.time - u.pathAt > 2) {
      u.path = this.map.findPath(u.x, u.y, tx, ty);
      u.pathAt = this.time;
      [u.pathGoalX, u.pathGoalY] = [tx, ty];
    }
    if (!u.path?.length) return this.move(u, tx, ty, speed, stop); // rien trouvé : on tente quand même
    const next = u.path[0];
    if (dist2(u.x, u.y, next.x, next.y) < 14 ** 2) u.path.shift();
    this.move(u, next.x, next.y, speed, 0);
    return dist2(u.x, u.y, tx, ty) <= stop * stop;
  }

  /** Serpent sauvage : il ne quitte jamais l'eau. */
  private swims(u: Unit) {
    return !u.owner && !!SPECIES[u.s].swim;
  }

  private blockedFor(u: Unit, x: number, y: number) {
    return this.swims(u) ? !this.map.isWater(x, y) : this.map.blocked(x, y);
  }

  /** Portée d'aggro : un tireur repère de plus loin. */
  private aggroOf(u: Unit) {
    if (isBoss(u.s)) return 430;
    return Math.max(WILD_AGGRO_R, SPECIES[u.s].ranged?.range ?? 0);
  }

  /** Tireur : s'approche à portée, charge son tir (immobile, visible), puis tire. */
  private rangedAttack(u: Unit, t: Ent) {
    const rg = SPECIES[u.s].ranged!;
    if (u.windup > 0) {
      u.windup -= DT;
      if (u.windup <= 0) this.fire(u, this.getEnt(u.shotAt) ?? t);
      return;
    }
    u.atkCd -= DT;
    if (dist2(u.x, u.y, t.x, t.y) > (rg.range * 0.9) ** 2) {
      this.navTo(u, t.x, t.y, u.speed, rg.range * 0.8);
      return;
    }
    if (u.atkCd > 0) return;
    u.atkCd = u.atkCdBase;
    u.windup = rg.windup;
    u.shotAt = t.id;
    this.events.push({ e: 'charge', id: u.id });
  }

  private fire(u: Unit, t: Ent) {
    const rg = SPECIES[u.s].ranged!;
    this.launch(u, rg.kind, t.x, t.y, u.dmg, rg.speed, rg.range, rg.splash ?? 0);
  }

  /**
   * Lance un projectile de u vers (tx, ty). Cloche : retombe là où était la cible (au plus à portée),
   * on l'esquive en bougeant. Trait, jet : file en ligne droite.
   */
  private launch(u: Unit, kind: Ranged['kind'], tx: number, ty: number, dmg: number, speed: number, range: number, splash: number) {
    const d = Math.hypot(tx - u.x, ty - u.y) || 1;
    const shot: Shot = {
      id: this.nextId++, kind: SHOT_KINDS.indexOf(kind), x: u.x, y: u.y - u.r * 0.5, vx: 0, vy: 0, x0: u.x, y0: u.y - u.r * 0.5, tx, ty,
      start: this.time, left: range * 1.3, dmg, splash, wild: !u.owner, by: u,
    };
    if (kind === 'arc') {
      const k = Math.min(1, range / d);
      shot.tx = u.x + (tx - u.x) * k;
      shot.ty = u.y + (ty - u.y) * k;
    } else {
      shot.vx = ((tx - u.x) / d) * speed;
      shot.vy = ((ty - u.y) / d) * speed;
    }
    this.shots.push(shot);
  }

  /** Cibles qu'un projectile peut toucher autour de (x, y). */
  private shotTargets(s: Shot, x: number, y: number, r: number) {
    const out: Ent[] = [];
    this.grid.query(x, y, r + 40, (e) => {
      if (!this.alive(e) || (s.wild ? !this.isAllyOfPlayers(e) : !this.isWild(e))) return;
      if (dist2(x, y, e.x, e.y) <= (r + e.r) ** 2) out.push(e);
    });
    return out;
  }

  private updateShots() {
    this.shots = this.shots.filter((s) => {
      if (SHOT_KINDS[s.kind] === 'arc') {
        if (this.time - s.start < ARC_FLIGHT_S) return true;
        for (const e of this.shotTargets(s, s.tx, s.ty, s.splash)) this.damage(e, s.dmg, s.by);
        this.events.push({ e: 'boom', x: Math.round(s.tx), y: Math.round(s.ty), r: s.splash, kind: 'splash' });
        return false;
      }
      // trait, jet : avance par petits pas pour ne traverser personne ; passe au-dessus de l'eau, pas des obstacles
      const step = Math.hypot(s.vx, s.vy) * DT, n = Math.ceil(step / 8);
      for (let i = 0; i < n; i++) {
        s.x += (s.vx * DT) / n;
        s.y += (s.vy * DT) / n;
        s.left -= step / n;
        const hit = this.shotTargets(s, s.x, s.y, 6)[0];
        if (hit) {
          this.damage(hit, s.dmg, s.by);
          return false;
        }
        if (s.left <= 0 || this.map.isForest(s.x, s.y) || (this.map.blocked(s.x, s.y) && !this.map.isWater(s.x, s.y))) return false;
      }
      return true;
    });
  }

  private tryAttack(u: Unit, t: Ent) {
    if (SPECIES[u.s].ranged && !isBoss(u.s)) return this.rangedAttack(u, t);
    const range = u.r + t.r + 8;
    // Un géant accélère quand sa cible s'éloigne : on ne le tue pas en reculant (arc, mage).
    const chase = isBoss(u.s) && dist2(u.x, u.y, t.x, t.y) > (range + BOSS_CHASE_R) ** 2 ? BOSS_CHASE_MULT : 1;
    const arrived = this.navTo(u, t.x, t.y, u.speed * chase, range - 2);
    if (isBoss(u.s)) return this.bossMelee(u);
    u.atkCd -= DT;
    if (arrived && u.atkCd <= 0 && dist2(u.x, u.y, t.x, t.y) <= (range + 4) ** 2) {
      u.atkCd = u.atkCdBase;
      this.damage(t, u.dmg, u);
    }
  }

  /** Corps à corps d'un géant : un coup de balayage qui touche tout ce qui est collé à lui (dompteurs et meute). */
  private bossMelee(u: Unit) {
    u.atkCd -= DT;
    if (u.atkCd > 0) return;
    const near = this.alliesNear(u.x, u.y, u.r + 14).filter((e) => !(e.kind === 'p' && this.safe(e.x, e.y)));
    if (!near.length) return;
    u.atkCd = u.atkCdBase;
    // sa cible d'abord, puis les plus proches : les attaques de zone restent pour ses compétences
    const melee = bossMelee(SPECIES[u.s].key);
    near.sort((a, b) => Number(b.id === u.target) - Number(a.id === u.target) || dist2(u.x, u.y, a.x, a.y) - dist2(u.x, u.y, b.x, b.y));
    for (const e of near.slice(0, melee.targets)) this.damage(e, u.dmg * melee.mult, u);
  }

  private wildAI(u: Unit) {
    if (u.dormant) return; // géant qui attend qu'on lui parle
    if (u.returning) {
      if (this.move(u, u.homeX, u.homeY, u.speed * 1.3, 20)) {
        u.returning = false;
        u.hp = u.maxHp;
      }
      return;
    }
    if (!isBoss(u.s) && (dist2(u.x, u.y, u.homeX, u.homeY) > WILD_LEASH_R ** 2 || this.campAt(u.x, u.y) >= 0)) { // un géant ne quitte pas sa grotte : pas de laisse
      u.returning = true;
      u.target = 0;
      return;
    }
    if (SPECIES[u.s].passive) return this.grazeAI(u);
    // Priorité au plus proche, dompteurs et monstres de meute confondus (réévalué à chaque tick).
    let t: Ent | undefined = this.nearest(u.x, u.y, this.aggroOf(u), this.isAllyOfPlayers);
    if (!t) {
      // Personne à portée d'aggro : il poursuit sa cible, ou riposte à qui l'a frappé de loin (archer, mage).
      const cur = this.getEnt(u.target);
      if (this.alive(cur) && this.isAllyOfPlayers(cur) && dist2(u.x, u.y, cur.x, cur.y) <= (this.aggroOf(u) + 260) ** 2) t = cur;
      else if (u.lastAttacker) {
        const a = this.getEnt(u.lastAttacker);
        if (this.alive(a) && this.isAllyOfPlayers(a) && dist2(u.x, u.y, a.x, a.y) <= (this.aggroOf(u) + 260) ** 2) t = a;
      }
    }
    u.lastAttacker = 0;
    u.target = t?.id ?? 0;
    if (!t) u.windup = 0; // plus de cible : le tir en préparation est abandonné
    if (t) {
      u.target = t.id;
      if (isBoss(u.s) && this.bossAI(u, t)) {
        this.bossMelee(u); // même en préparant une attaque spéciale, il frappe ce qui le colle
        return;
      }
      this.tryAttack(u, t);
      return;
    }
    // Errance autour du point d'origine.
    u.wanderT -= DT;
    if (u.wanderT <= 0) {
      u.wanderT = 2 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2, d = Math.random() * 140;
      u.wanderX = u.homeX + Math.cos(a) * d;
      u.wanderY = u.homeY + Math.sin(a) * d;
    }
    this.move(u, u.wanderX, u.wanderY, u.speed * 0.35, 4);
  }

  /** Gibier passif : il n'attaque jamais ; il va manger aux buissons à fruits, et fuit qui le frappe. */
  private grazeAI(u: Unit) {
    if (u.lastAttacker) {
      u.target = u.lastAttacker; // retenu comme celui qu'il fuit
      u.lastAttacker = 0;
    }
    const foe = this.time - u.lastHitAt < FLEE_S ? this.getEnt(u.target) : undefined;
    if (this.alive(foe)) {
      const dx = u.x - foe.x, dy = u.y - foe.y, d = Math.hypot(dx, dy) || 1;
      this.move(u, u.x + (dx / d) * 80, u.y + (dy / d) * 80, u.speed * 1.15, 0);
      return;
    }
    u.target = 0;
    // Un dompteur tend un fruit pas loin : il s'approche, sans se presser.
    for (const p of this.players.values()) {
      if (p.dead || !p.holding || p.fruits <= 0 || dist2(p.x, p.y, u.x, u.y) > LURE_R ** 2) continue;
      this.navTo(u, p.x, p.y, u.speed * 0.55, PLAYER_R + u.r + 12);
      return;
    }
    u.wanderT -= DT;
    if (u.wanderT <= 0) {
      // Le buisson garni le plus proche de son coin, s'il y en a un : il y va et mange.
      let best = -1, bd = BUSH_SEEK_R ** 2;
      for (const b of this.map.bushes) {
        const d = dist2(b.x, b.y, u.homeX, u.homeY);
        if (d < bd && this.bushBack[b.id] <= this.time) [bd, best] = [d, b.id];
      }
      if (best >= 0) {
        const b = this.map.bushes[best];
        this.navTo(u, b.x, b.y + 14, u.speed * 0.6, 16);
        if (dist2(u.x, u.y, b.x, b.y + 14) < 24 ** 2) {
          this.bushBack[best] = this.time + BUSH_REGROW_S;
          this.events.push({ e: 'eat', id: u.id, bush: best });
          u.wanderT = 3 + Math.random() * 3; // il digère un moment avant de repartir
          [u.wanderX, u.wanderY] = [u.x, u.y];
        }
        return;
      }
      u.wanderT = 2 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2, d = Math.random() * 140;
      u.wanderX = u.homeX + Math.cos(a) * d;
      u.wanderY = u.homeY + Math.sin(a) * d;
    }
    this.move(u, u.wanderX, u.wanderY, u.speed * 0.3, 4);
  }

  private followerAI(u: Unit) {
    const o = this.players.get(u.owner);
    if (!o) return;
    // Trop loin, ou coincé derrière un arbre ou la palissade depuis un moment : il rejoint son dompteur.
    if (dist2(u.x, u.y, o.x, o.y) > 900 ** 2 || (u.stuck > 2.5 && !o.dead)) {
      this.placeNear(u, o);
      u.stuck = 0;
    }

    // Trop loin du dompteur : on lâche le combat et on revient, sans se laisser distraire.
    if (!o.dead) {
      const d2o = dist2(u.x, u.y, o.x, o.y);
      if (!u.recalling && d2o > RECALL_R ** 2) {
        u.recalling = true;
        u.target = 0;
        u.lastAttacker = 0;
      }
      if (u.recalling) {
        if (d2o < RECALL_DONE_R ** 2) u.recalling = false;
        else {
          this.navTo(u, o.x, o.y, Math.max(u.speed, PLAYER_SPEED * 1.7), 40);
          return;
        }
      }
    }

    let t = this.getEnt(u.target);
    const anchorX = o.dead ? u.x : o.x, anchorY = o.dead ? u.y : o.y;
    const leash = o.dead ? 140 : FOLLOW_MAX_R;
    if (!this.alive(t) || !this.isWild(t) || dist2(anchorX, anchorY, t.x, t.y) > leash ** 2) {
      t = undefined;
      u.target = 0;
    }
    if (!t && u.lastAttacker) {
      const a = this.getEnt(u.lastAttacker);
      if (this.alive(a) && this.isWild(a) && dist2(anchorX, anchorY, a.x, a.y) < leash ** 2) t = a;
      u.lastAttacker = 0;
    }
    if (!t) t = this.nearest(anchorX, anchorY, o.dead ? 120 : FOLLOW_ENGAGE_R, this.isWild, u.x, u.y);
    if (t) {
      u.target = t.id;
      if (u.legend && this.legendMove(u, t)) return; // en pleine attaque spéciale
      this.tryAttack(u, t);
      return;
    }
    if (o.dead) return;
    // Au village ou dans un camp (dompteur et monstre à l'abri) : la meute se promène tranquillement.
    const area = this.safeArea(o.x, o.y);
    if (area && dist2(u.x, u.y, area.x, area.y) < area.r ** 2) {
      u.wanderT -= DT;
      if (u.wanderT <= 0) {
        u.wanderT = 2 + Math.random() * 4;
        for (let k = 0; k < 6; k++) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * area.r;
          const wx = area.x + Math.cos(a) * d, wy = area.y + Math.sin(a) * d;
          if (this.map.blocked(wx, wy)) continue;
          [u.wanderX, u.wanderY] = [wx, wy];
          break;
        }
      }
      if (dist2(u.wanderX, u.wanderY, area.x, area.y) > area.r ** 2) [u.wanderX, u.wanderY] = [u.x, u.y];
      this.navTo(u, u.wanderX, u.wanderY, u.speed * 0.4, 6);
      return;
    }
    // Formation en tournesol autour du dompteur.
    const i = o.army.indexOf(u.id);
    const ang = i * 2.39996;
    const rad = 48 + 20 * Math.sqrt(i);
    const sx = o.x + Math.cos(ang) * rad, sy = o.y + Math.sin(ang) * rad;
    const far = dist2(u.x, u.y, sx, sy) > 70 ** 2;
    const om = o.mount ? this.units.get(o.mount) : undefined;
    const ownerSpeed = PLAYER_SPEED * (om ? mountSpeedOf(om.s) : 1); // la meute suit aussi un dompteur à cheval
    // Place libre dans la formation (pas au milieu d'un arbre), puis on y va en contournant les obstacles.
    const slot = this.map.blocked(sx, sy) ? { x: o.x, y: o.y } : { x: sx, y: sy };
    this.navTo(u, slot.x, slot.y, far ? Math.max(u.speed, ownerSpeed * 1.15) : Math.max(u.speed, 90), 3);
  }

  private damage(t: Ent, amount: number, by: Ent) {
    if (t.kind === 'p') {
      if (t.dead) return;
      const mount = t.mount ? this.units.get(t.mount) : undefined;
      if (mount) {
        // La monture encaisse l'essentiel du coup.
        const share = Math.round(amount * MOUNT_SHARE);
        mount.hp -= share;
        this.events.push({ e: 'hit', a: by.id, b: mount.id, dmg: share });
        if (mount.hp <= 0) this.killUnit(mount, by);
        amount -= share;
        if (amount <= 0) return;
      }
      const dmg = Math.max(1, Math.round(amount * (1 - armorReduction(t.armor))));
      t.hp -= dmg;
      this.events.push({ e: 'hit', a: by.id, b: t.id, dmg });
      if (t.hp <= 0) this.killPlayer(t);
      return;
    }
    t.hp -= amount;
    if (isBoss(t.s) && !t.owner) {
      const credit = by.kind === 'p' ? by.id : by.owner; // un coup de sa meute compte pour le dompteur
      if (credit) t.hitters.add(credit);
    }
    t.lastAttacker = by.id;
    t.lastHitAt = this.time;
    this.events.push({ e: 'hit', a: by.id, b: t.id, dmg: Math.round(amount * 100) / 100 }); // 2 décimales
    if (t.hp <= 0) this.killUnit(t, by);
  }

  private killPlayer(p: Player) {
    if (p.mount) this.dismount(p);
    p.dead = true;
    p.hp = 0;
    // Un autre dompteur est là : il a le temps de venir nous relever.
    p.respawnAt = this.time + (this.players.size > 1 ? Math.max(PLAYER_RESPAWN_S, REVIVE_WINDOW_S) : PLAYER_RESPAWN_S);
    p.reviveBy = 0;
    p.reviveT = 0;
    p.helping = false;
    // Pénalité : une part de son or reste sur le champ de bataille.
    const lost = Math.floor(p.gold * DEATH_GOLD_LOSS);
    p.gold -= lost;
    if (lost) p.dirty = true;
    this.events.push({ e: 'pdie', id: p.id, gold: lost });
    // La meute se disperse : seuls les Alphas restent fidèles.
    let n = 0;
    p.army = p.army.filter((id) => {
      const u = this.units.get(id);
      if (!u || u.alpha) return !!u;
      if (!u.reviveAt) this.events.push({ e: 'die', x: u.x, y: u.y, s: u.s, alpha: false });
      this.units.delete(id);
      n++;
      return false;
    });
    if (n) {
      this.events.push({ e: 'scatter', id: p.id, n });
      p.dirty = true;
    }
  }

  /** Rejoint la meute de p, moitié moins fort que sa version sauvage. */
  private makeTamed(u: Unit, p: Player) {
    const sp = SPECIES[u.s];
    u.owner = p.id;
    u.idle = false;
    u.maxHp = Math.max(1, Math.round(sp.hp * TAMED_HP_MULT));
    u.dmg = Math.max(1, Math.round(sp.dmg * TAMED_MULT));
    u.hp = u.maxHp;
    u.target = 0;
    u.lastAttacker = 0;
    u.returning = false;
    u.summoner = 0;
    p.army.push(u.id);
  }

  /** Taille de la meute ordinaire (les Alphas ne comptent pas dans la limite). */
  private armySize(p: Player) {
    return p.army.filter((id) => !this.units.get(id)?.alpha).length;
  }

  private killUnit(u: Unit, by: Ent) {
    if (u.owner) {
      // Membre de la meute tombé.
      this.events.push({ e: 'die', x: u.x, y: u.y, s: u.s, alpha: u.alpha });
      const rider = this.players.get(u.owner);
      if (rider?.mount === u.id) {
        rider.mount = 0; // désarçonné
        this.events.push({ e: 'mount', by: rider.id, id: u.id, on: false });
      }
      if (u.alpha) {
        u.reviveAt = this.time + alphaReviveS(u.s);
        u.hp = 0;
        u.target = 0;
      } else {
        this.units.delete(u.id);
        const o = this.players.get(u.owner);
        if (o) {
          o.army = o.army.filter((id) => id !== u.id);
          o.dirty = true;
        }
      }
      return;
    }

    const creditId = by.kind === 'p' ? by.id : by.owner;
    const credit = this.players.get(creditId);
    const sp = SPECIES[u.s];
    const gold = sp.gold;
    const boss = isBoss(u.s);
    for (const p of this.players.values()) {
      if (p.dead || dist2(p.x, p.y, u.x, u.y) > GOLD_SHARE_R ** 2) continue;
      if (!boss) p.gold += gold; // l'or d'un géant est dans son coffre
      if (boss && !this.wantsSoul(p, u.s)) continue; // Alpha déjà légendaire, ou déjà 3 âmes : pas d'âme en plus
      if (Math.random() < (boss ? BOSS_SOUL_DROP : ESSENCE_DROP)) {
        p.essences[u.s] += 1; // pour un mini-boss, c'est son âme
        this.events.push({ e: boss ? 'soul' : 'essence', to: p.id, s: u.s, x: u.x, y: u.y });
      }
      p.dirty = true;
      if (!boss) this.events.push({ e: 'gold', to: p.id, n: gold, x: u.x, y: u.y });
    }
    if (boss) {
      // Mini-boss vaincu : ses renforts et ses attaques en cours disparaissent avec lui.
      this.hazards = this.hazards.filter((h) => h.boss !== u);
      for (const m of [...this.units.values()]) {
        if (m.summoner !== u.id || m.owner) continue;
        this.units.delete(m.id);
        this.events.push({ e: 'die', x: m.x, y: m.y, s: m.s, alpha: false });
      }
      // Il ne s'apprivoise pas et revient après un délai.
      // tableau du village : un géant de plus pour chacun de ceux qui l'ont combattu
      for (const q of this.players.values()) {
        if (!u.hitters.has(q.id)) continue;
        q.stats.bosses++;
        q.dirty = true;
      }
      if (!this.beaten.includes(u.s)) {
        // première victoire du village sur ce géant : elle compte pour ouvrir la porte de la zone suivante
        this.beaten.push(u.s);
        this.saveVillage();
        this.events.push({ e: 'beaten', s: u.s, by: creditId });
      }
      const cave = this.caveBoss.indexOf(u.id);
      if (cave >= 0) {
        const c = this.map.caves[cave];
        const at = this.map.freeNear(c.inside.x, c.inside.y - 60); // là où le géant dormait
        this.chests.push({ id: this.nextId++, cave, s: u.s, x: at.x, y: at.y, opened: new Set(), eligible: new Set(u.hitters) });
        this.caveBoss[cave] = 0;
        this.caveBack[cave] = this.time + BOSS_RESPAWN_S;
        this.events.push({ e: 'boss', cave, s: u.s, down: true });
      }
      this.units.delete(u.id);
      this.events.push({ e: 'die', x: u.x, y: u.y, s: u.s, alpha: true });
      return;
    }

    let tame = false;
    // Coup de pouce au départ : 50 % tant que la meute est vide.
    const chance = credit && this.armySize(credit) === 0 ? 0.5 : TAME_CHANCE;
    // Les renforts appelés par un géant ne s'apprivoisent pas.
    if (credit && !u.summoner && !sp.passive && Math.random() < chance) {
      if (this.armySize(credit) < ARMY_CAP) tame = true;
      else this.events.push({ e: 'full', to: credit.id });
    }

    if (tame && credit) {
      this.makeTamed(u, credit);
      credit.dirty = true;
      this.events.push({ e: 'tame', id: u.id, by: credit.id, s: u.s });
      credit.stats.tamed++;
    } else {
      this.units.delete(u.id);
      this.events.push({ e: 'die', x: u.x, y: u.y, s: u.s, alpha: u.alpha });
    }
  }

  private separate() {
    const before = new Map<Unit, [number, number]>();
    for (const u of this.units.values()) before.set(u, [u.x, u.y]);
    for (const u of this.units.values()) {
      if (u.reviveAt || u.idle || this.isMount(u)) continue;
      this.grid.query(u.x, u.y, u.r + 60, (o) => {
        if (o === u) return;
        if (o.kind === 'u' && (o.id < u.id || o.reviveAt)) return; // chaque paire une seule fois
        if (o.kind === 'p' && o.dead) return;
        const min = u.r + o.r;
        const dx = u.x - o.x, dy = u.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.01;
        const push = (min - d) * 0.5;
        const nx = d2 ? dx / d : Math.random() - 0.5, ny = d2 ? dy / d : Math.random() - 0.5;
        if (o.kind === 'p') {
          if (u.dormant) return; // géant endormi : on ne le pousse pas, il reste au centre de sa grotte
          u.x += nx * push * 2;
          u.y += ny * push * 2;
        } else if (u.dormant || (o as Unit).dormant) {
          // un géant endormi ne bouge pas : c'est l'autre qui s'écarte de toute la distance
          const k = u.dormant ? -2 : 2;
          const m = u.dormant ? o : u;
          m.x += nx * push * k;
          m.y += ny * push * k;
        } else {
          u.x += nx * push;
          u.y += ny * push;
          o.x -= nx * push;
          o.y -= ny * push;
        }
      });
    }
    for (const u of this.units.values()) {
      const v = this.map.village;
      if (!u.owner) {
        // Les sauvages n'entrent pas dans le village.
        const dx = u.x - v.x, dy = u.y - v.y, d = Math.hypot(dx, dy), min = VILLAGE_R + u.r;
        if (d < min) {
          const k = min / Math.max(d, 0.01);
          u.x = v.x + dx * k;
          u.y = v.y + dy * k;
        }
        // ni dans un camp établi (sauf les géants, qui ne quittent pas leur grotte)
        const c = isBoss(u.s) ? -1 : this.campAt(u.x, u.y);
        if (c >= 0) {
          const site = this.map.sites[c], ex = u.x - site.x, ey = u.y - site.y, k = (CAMP_R + u.r) / Math.max(Math.hypot(ex, ey), 0.01);
          u.x = site.x + ex * k;
          u.y = site.y + ey * k;
        }
      }
      if (this.blockedFor(u, u.x, u.y)) [u.x, u.y] = before.get(u) ?? [u.x, u.y]; // jamais poussé dans l'eau (ni hors de l'eau, pour un serpent)
    }
  }

  private regen() {
    for (const p of this.players.values()) {
      if (p.dead) continue;
      if (!this.safe(p.x, p.y)) continue; // aucune régénération hors du village et des camps
      p.hp = Math.min(maxHpOf(p), p.hp + 30 * DT);
    }
    for (const u of this.units.values()) {
      if (u.reviveAt || u.hp >= u.maxHp) continue;
      if (!u.owner) {
        // Monstre sauvage : il récupère petit à petit dès qu'on cesse de le frapper.
        if (this.time - u.lastHitAt >= WILD_REGEN_DELAY) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * WILD_REGEN * DT);
        continue;
      }
      if (!this.safe(u.x, u.y)) continue;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.15 * DT);
    }
  }

  // ───────────────────────── Réseau ─────────────────────────

  private armyOf(p: Player): ArmySlot[] {
    const out: ArmySlot[] = [];
    for (const id of p.army) {
      const u = this.units.get(id);
      if (!u) continue;
      out.push({
        id: u.id, species: u.s, alpha: u.alpha, level: u.level, legend: u.legend, hp: Math.round((100 * Math.max(0, u.hp)) / u.maxHp),
        reviveIn: u.reviveAt ? Math.max(1, Math.ceil(u.reviveAt - this.time)) : 0, // au moins 1 : il peut attendre la fin d'un combat de géant
      });
    }
    return out;
  }

  private mountState(p: Player): PlayerState['mount'] {
    const m = p.mount ? this.units.get(p.mount) : undefined;
    return m ? { id: m.id, species: m.s, hp: Math.round((100 * Math.max(0, m.hp)) / m.maxHp), legend: m.legend } : null;
  }

  private broadcast() {
    // Chacun reçoit son état complet ; des autres, seulement ce qui s'affiche (pas leurs essences, bestiaire, Alphas…).
    const full = new Map<number, PlayerState>(), light = new Map<number, PlayerState>();
    for (const p of this.players.values()) {
      const st: PlayerState = {
        id: p.id, name: p.name, color: p.color, x: Math.round(p.x), y: Math.round(p.y), fx: Math.round(p.fx * 100) / 100, fy: Math.round(p.fy * 100) / 100,
        hp: Math.ceil(Math.max(0, p.hp)), maxHp: maxHpOf(p), weapon: p.weapon, armor: p.armor, cls: p.cls, gold: p.gold, wood: p.wood, stone: p.stone, fruits: p.fruits, holding: p.holding,
        essences: p.essences, saved: !!p.userId, dead: p.dead,
        respawnIn: p.dead ? Math.max(0, Math.ceil(p.respawnAt - this.time)) : 0,
        revive: p.dead ? Math.min(100, Math.round((100 * p.reviveT) / REVIVE_HOLD_S)) : 0, reviveBy: p.dead ? p.reviveBy : 0, army: this.armyOf(p),
        pack: this.armySize(p),
        mount: this.mountState(p),
        slowed: p.slowUntil > this.time,
        resting: p.resting.map((r) => ({ species: r.s, level: r.lvl, legend: r.legend })),
        seen: [...p.seen],
        awakening: [...p.awakening].map(([species, wakeAt]) => ({
          species, left: Math.max(0, Math.ceil((wakeAt - Date.now()) / 1000)), total: alphaAwakenS(species),
        })),
      };
      full.set(p.id, st);
      light.set(p.id, { ...st, essences: [], army: [], resting: [], seen: [], awakening: [] });
    }
    const vr2 = VIEW_R * VIEW_R;
    const caves = this.caveBoss.map((id, i) => (id ? 0 : Math.max(1, Math.ceil(this.caveBack[i] - this.time))));
    for (const viewer of this.players.values()) {
      const units: UnitTuple[] = [];
      for (const u of this.units.values()) {
        if (u.reviveAt || dist2(u.x, u.y, viewer.x, viewer.y) > vr2) continue;
        units.push([
          u.id, u.s, (u.alpha ? UNIT_FLAG_ALPHA : 0) | (this.isMount(u) ? UNIT_FLAG_MOUNTED : 0) | (u.legend ? UNIT_FLAG_LEGEND : 0) | (u.dormant ? UNIT_FLAG_DORMANT : 0), Math.round(u.x), Math.round(u.y),
          Math.round((100 * Math.max(0, u.hp)) / u.maxHp), u.owner,
        ]);
      }
      const ores: [number, number][] = [];
      for (const o of this.map.ores) {
        if (dist2(o.x, o.y, viewer.x, viewer.y) > vr2) continue;
        ores.push([o.id, Math.round((100 * Math.max(0, this.oreHp[o.id])) / oreHp(o.zone))]);
      }
      const sleepers: SleeperTuple[] = [], dozers: DozerTuple[] = [];
      for (const z of this.sleepers.values()) {
        if (dist2(z.x, z.y, viewer.x, viewer.y) > vr2) continue;
        const k = sleepers.push([z.name, z.color, z.armor, z.cls, Math.round(z.x), Math.round(z.y)]) - 1;
        for (const d of z.pack) {
          dozers.push([d.id, d.s, (d.alpha ? UNIT_FLAG_ALPHA : 0) | (d.legend ? UNIT_FLAG_LEGEND : 0) | (d.asleep ? UNIT_FLAG_DORMANT : 0), Math.round(d.x), Math.round(d.y), k]);
        }
      }
      const bare: number[] = [];
      for (const b of this.map.bushes) if (this.bushBack[b.id] > this.time && dist2(b.x, b.y, viewer.x, viewer.y) <= vr2) bare.push(b.id);
      const chests: [number, number, number, number][] = [];
      for (const ch of this.chests) {
        if (ch.eligible.has(viewer.id) && dist2(ch.x, ch.y, viewer.x, viewer.y) <= vr2) chests.push([ch.id, Math.round(ch.x), Math.round(ch.y), ch.opened.has(viewer.id) ? 1 : 0]);
      }
      const hazards: HazardTuple[] = [];
      for (const h of this.hazards) {
        if (dist2(h.x, h.y, viewer.x, viewer.y) > vr2) continue;
        const prog = h.fired ? 100 : Math.min(99, Math.round((100 * (this.time - h.start)) / (h.at - h.start)));
        hazards.push([h.kind, Math.round(h.x), Math.round(h.y), h.r, Math.round(h.x2), Math.round(h.y2), prog, h.boss.owner ? 1 : 0]);
      }
      const shots: ShotTuple[] = [];
      for (const sh of this.shots) {
        if (dist2(sh.x, sh.y, viewer.x, viewer.y) > vr2) continue;
        shots.push(SHOT_KINDS[sh.kind] === 'arc'
          ? [sh.id, sh.kind, Math.round(sh.x0), Math.round(sh.y0), Math.round(sh.tx), Math.round(sh.ty), Math.min(100, Math.round((100 * (this.time - sh.start)) / ARC_FLIGHT_S))]
          : [sh.id, sh.kind, Math.round(sh.x), Math.round(sh.y), Math.round(sh.vx), Math.round(sh.vy), 0]);
      }
      const players = [...this.players.values()].map((p) => (p === viewer ? full : light).get(p.id)!);
      // envoi différentiel : seulement ce qui a changé depuis le dernier snapshot de ce spectateur
      let diff = this.diffs.get(viewer.id);
      if (!diff) this.diffs.set(viewer.id, (diff = new SnapshotDiff()));
      const [changed, gone] = diff.diffUnits(units);
      viewer.send({ t: 's', tick: this.tick, players: diff.diffPlayers(players), units: changed, gone, ores: diff.diffOres(ores), chests, bare, sleepers, dozers, banned: this.isFounder(viewer) && viewer.userId ? this.banned : [], caves, camps: this.camps, buildings: this.buildings, hall: this.hall, stock: [this.stock.wood, this.stock.stone], beaten: this.beaten, unlocked: this.unlocked, hazards, shots, ev: this.events });
    }
  }
}
