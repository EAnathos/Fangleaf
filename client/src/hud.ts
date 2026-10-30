// HUD en HTML : panneaux joueur / groupe, minicarte, forge, tanière, toasts.

import {
  alphaEquipMax, CAVE_CD, BOAT_STAGES, dockStoneOn, ELDER_REACH, SCROLL_REACH, SWORD_PULLS, SWORD_REACH, SWIM_MOUNTS, FLY_MOUNTS, ALPHA_HEAL_S, ALPHA_SHOUT_CD, ALPHA_SHOUT_S, ALPHA_LVL_MAX, alphaPerk, BOSS_MOVES, MOVE_NAMES, BOSS_TALK_R, LURE_R, MAX_PLAYERS, CLASS_CHANGE_COST, CLASS_IDS, CLASSES, classOf, heroOf, type ClassId, SPEC_CHANGE_COST, SPEC_IDS, SPEC_LVL, SPECS, type SpecId, weaponName, MOUNTS, alphaCreateCost, alphaStats, bossOf, collectionMult, LEGEND_MULT, LEGEND_SOULS, ARMOR_MAX, ARMOR_NAMES, BOOTS_MAX, BOOTS_NAMES, bootsSpeed, type Gear, gearCost, gearMax, SADDLE_MAX, SADDLE_NAMES, saddleSpeed, costText, TORCH_MAX, TORCH_NAMES, torchRadius, armyCap, DISCIPLINES, LESSON_KINDS, bookIndex, tomeForLesson, SCHOOL_CAMP, PLAN_REACH, ZONES, tomeOfZone, BUILDING_REACH,
  BUILDINGS, BUSH_PICK_R, type BuildingId, buildingCost, type Cost, gateHall, gateOpen, DESERT_ZONE, PLAYER_COLORS, HATS, HAT_PRICES, HALL, HALL_MAX, zoneBosses, caveUnlockCost, monsterBuyPrice, monsterSellPrice, TAMED_HP_MULT, TAMED_MULT, CAMP_COST, campName, REVIVE_R, SPECIES, SPECIES_BY_ZONE, ZONE_NAMES, WEAPON_MAX, WORLD_HALF, alphaAwakenS, alphaLevelMult, alphaReviveS, alphaUpCost, armorCost, armorMaxHp,
  armorReduction, weaponCost, weaponDmg, volcanoOpen, VOLCANO_ZONE, VOYAGE_ZONE, DECK_RX, HEART_REACH, HEART_TAKEN, HEART_IN_BOAT, BOAT_REACH, VOLCANO_R, VOLCANO_RY,
} from '../../shared/config.ts';
import type { BoardRow, Holdings, PlayerState, Stats, UnitTuple } from '../../shared/protocol.ts';
import { BRIDGE_W, HALL_ID, type WorldMap } from '../../shared/worldmap.ts';
import { armorColor, drawElder, drawHatchling, drawPlayer, drawUnit } from './sprites.ts';
import { CHAPTER_TITLES, ELDER_CHAPTERS, eggsOf, elderGreeting, elderName, HATCHLINGS, REREAD, zoneChapters } from './elder.ts';
import { BOSS_LINES, SPECIES_DESC } from './speciesInfo.ts';
import { sound } from './audio.ts';
import { ACTIONS, type Action, keyLabel, labelOf, resetKeys, saveSettings, settings, touchOnly } from './settings.ts';
import { landColor, seaColor } from './world.ts';
import type { Fog } from './fog.ts';

export type Panel = 'forge' | 'den' | 'market' | 'map' | 'quit' | 'travel' | 'camp' | 'buy' | 'talk' | 'elder' | 'npc' | 'hall' | 'settings' | 'chat' | 'board' | 'school' | 'profile' | null;
/** Achat pour tout le village : un bâtiment, ou l'accès à une grotte. */
export type Purchase = { b: BuildingId } | { cave: number };
/** Bâtiment à portée d'interaction, s'il y en a un. */
export interface Spot {
  pos: { x: number; y: number };
  label: string;
  panel?: 'forge' | 'den' | 'market' | 'travel' | 'camp' | 'buy' | 'talk' | 'elder' | 'npc' | 'hall' | 'board' | 'school'; // ouvre un panneau
  cave?: { id: number; enter: boolean }; // entre dans une grotte / en sort
  at?: number; // Pierre de passage : -1 village, sinon index du camp ; emplacement de camp : son index
  buy?: Purchase; // panneau d'achat : ce qui est à acheter
  reach?: number; // portée d'interaction (par défaut BUILDING_REACH)
  deposit?: boolean; // entrepôt : déposer son sac
  pick?: boolean; // buisson garni : cueillir ses baies
  chest?: number; // coffre d'un géant vaincu à ouvrir
  sword?: boolean; // épée plantée dans le sable : tirer dessus
  scroll?: number; // grotte dont on ramasse le parchemin
  heart?: boolean; // cœur volcanique : le prendre sur son autel, ou l'installer dans le bateau
  plan?: boolean; // coffre du Camp avancé : le plan de l'École des dompteurs
}
/** Géant endormi dans sa grotte : on peut aller lui parler. */
export interface Sleeper {
  cave: number;
  x: number;
  y: number;
  r: number;
}
/** Ce que le village possède, d'après le dernier snapshot. */
export interface VillageView {
  caves: number[]; // retour des mini-boss (s)
  camps: number[]; // emplacements de camp établis
  buildings: BuildingId[]; // bâtiments construits
  unlocked: number[]; // grottes débloquées
  sleepers: Sleeper[]; // géants endormis à portée de vue
  chests: [number, number, number, number][]; // coffres des géants : [id, x, y, déjà ouvert]
  hall: number; // niveau de l'Hôtel de ville
  told: number[]; // parchemins lus par Aubin (les portes des zones en dépendent)
  bare: number[]; // buissons dont les baies ont été mangées ou cueillies
  sword: number; // coups donnés pour déterrer l'épée (SWORD_PULLS : armé)
  scrollCaves: number[]; // grottes dont le parchemin m'attend
  lore: [number, number, number]; // souvenirs du vieil homme, étapes du bateau, secondes avant la fin de l'étape en cours
  beaten: number[]; // géants vaincus par le village
  heart: number; // cœur volcanique : 0 sur son autel, HEART_TAKEN pris, HEART_IN_BOAT installé dans le bateau
  school: [number, number]; // École des dompteurs : plan trouvé (0/1), secondes avant la fin du chantier d'Aubin
  elderLeaving?: boolean; // Aubin vient de partir au chantier du bateau : il est encore au village (on finit de lui parler)
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const ROMAN = ['I', 'II', 'III'];
const num = (n: number) => Math.round(n).toLocaleString('fr-FR');
/** Sac : nombre court à partir de 10 000 (11k, 250k, 1,2M), pour que la ligne tienne sur téléphone. */
const short = (n: number) =>
  n < 10_000 ? String(n) : n < 1_000_000 ? `${Math.floor(n / 1000)}k` : `${(Math.floor(n / 100_000) / 10).toLocaleString('fr-FR')}M`;
/** Petit nom d'un géant : son titre sans ce qui suit la virgule ni l'épithète (« Lueur », « Grisecroc », « Ursus Mâchefer »). */
const shortTitle = (boss: number) => (SPECIES[boss]?.title ?? SPECIES[boss]?.name ?? '').split(/,| (?:le|la|les|aux|l') /)[0].trim();
/** Tableau du village, par catégorie : clé de la statistique, libellé, mise en forme, et « moins, c'est mieux ». */
const BOARD: { title: string; stats: { k: keyof Stats | keyof Holdings; label: string; fmt?: (n: number) => string; low?: boolean }[] }[] = [
  { title: '⚔️ Combat', stats: [
    { k: 'bosses', label: 'Géants battus' }, { k: 'firsts', label: 'Premières victoires sur un géant' }, { k: 'kills', label: 'Monstres vaincus' },
    { k: 'dmg', label: 'Dégâts infligés' }, { k: 'best', label: 'Plus gros coup' }, { k: 'deaths', label: 'Morts', low: true }, { k: 'revives', label: 'Coéquipiers relevés' },
  ] },
  { title: '🐾 Dressage', stats: [
    { k: 'tamed', label: 'Monstres apprivoisés' }, { k: 'essences', label: 'Essences recueillies' }, { k: 'awakened', label: 'Alphas éveillés' }, { k: 'legends', label: 'Alphas légendaires' },
  ] },
  { title: '🪵 Récolte et village', stats: [
    { k: 'wood', label: 'Bois récolté' }, { k: 'stone', label: 'Pierre récoltée' }, { k: 'given', label: 'Dons à l\'entrepôt' }, { k: 'spent', label: 'Or pour le village' },
  ] },
  { title: '🧭 Exploration', stats: [
    { k: 'chests', label: 'Coffres de géants ouverts' }, { k: 'books', label: 'Livres trouvés' },
    { k: 'dist', label: 'Distance parcourue', fmt: (n) => `${(n * 0.00003).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km` },
    { k: 'time', label: 'Temps de jeu', fmt: (n) => (n >= 3600 ? `${Math.floor(n / 3600)} h ${String(Math.floor((n % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(n / 60)} min`) },
  ] },
];
/** Prix (or, bois, pierre), nom et niveau de Hôtel de ville requis d'un achat pour le village. */
export const purchaseOf = (map: WorldMap, buy: Purchase): { name: string; cost: Cost; hall: number } =>
  'b' in buy
    ? { name: BUILDINGS[buy.b].name, cost: buildingCost(buy.b), hall: BUILDINGS[buy.b].hall }
    : { name: `Grotte de ${SPECIES[map.caves[buy.cave].boss].name}`, cost: { gold: caveUnlockCost(map.caves[buy.cave].zone), wood: 0, stone: 0 }, hall: 0 };
/** Ce qu'on peut dépenser : son or, et le bois et la pierre de la réserve du village. */
type Funds = { gold: number; wood: number; stone: number };
const canPay = (f: Funds, c: Cost) => f.gold >= c.gold && f.wood >= c.wood && f.stone >= c.stone;
/** Point d'interaction (touche E) à portée : bâtiments (ou leur chantier), Pierres de passage, emplacements de camp, grottes. */
export const buildingNear = (map: WorldMap, x: number, y: number, v: VillageView): Spot | undefined => {
  // le prix : dans le panneau qui s'ouvre ; name : le nom affiché (pour un emplacement, celui du bâtiment, plus court)
  const offer = (b: BuildingId, pos: { x: number; y: number }, verb: string, name = BUILDINGS[b].name): Spot => ({ panel: 'buy', pos, buy: { b }, label: `E — ${verb} : ${name}` });
  // un emplacement à défricher passe avant le bâtiment
  const building = (b: BuildingId, pos: { x: number; y: number }, open: Spot): Spot => {
    const needs = BUILDINGS[b].needs;
    if (needs && !v.buildings.includes(needs)) return offer(needs, pos, 'Défricher', BUILDINGS[b].name);
    return v.buildings.includes(b) ? open : offer(b, pos, 'Construire');
  };
  const spots: Spot[] = [
    { panel: 'elder', pos: v.lore[2] > 0 && !v.elderLeaving ? map.elderYard : map.elder, reach: 55, label: `E — Parler ${v.lore[0] ? 'à Aubin' : 'au vieil homme'}` },
    // les nouveau-nés des œufs du village (at : lequel)
    ...HATCHLINGS.slice(0, eggsOf(v.lore[0]).hatched).map((h, i): Spot => ({ panel: 'npc', at: i, pos: { x: map.village.x + h.x, y: map.village.y + h.y }, reach: 60, label: `E — Parler à ${h.name}` })),
    ...v.scrollCaves.map((id): Spot => ({ scroll: id, pos: map.scrollPos(map.caves[id]), reach: SCROLL_REACH, label: 'E — Ramasser le parchemin' })),
    // Pierre de passage du bateau : à construire dès que la Mer de sable est ouverte (ou déjà là, le bateau reconstruit)
    ...(dockStoneOn(v.buildings, v.lore[1]) ? [{ panel: 'travel' as const, pos: map.boatStone, label: 'E — Pierre de passage', at: -2 }]
      : gateOpen(DESERT_ZONE - 1, v.hall, v.told) ? [offer('dock', map.boatStone, 'Construire', BUILDINGS.stone.name)] : []),
    ...(v.sword < SWORD_PULLS ? [{ sword: true, pos: map.sword, reach: SWORD_REACH, label: v.sword ? `E — Tirer encore (${v.sword}/${SWORD_PULLS})` : 'E — Déterrer l\'épée' }] : []),
    ...(v.buildings.includes('palisade') ? [] : [{ ...offer('palisade', map.village, 'Monter'), reach: 110 }]),
    ...(v.buildings.includes('bridge') ? [] : [{ ...offer('bridge', map.bridge.a, 'Réparer'), reach: 150 }]),
    { panel: 'hall', pos: map.hall, label: `E — Hôtel de ville · niv. ${v.hall}` },
    { deposit: true, pos: map.store, label: 'E — Entrepôt : déposer ton bois et ta pierre' },
    building('forge', map.forge, { panel: 'forge', pos: map.forge, label: 'E — Forge' }),
    building('den', map.den, { panel: 'den', pos: map.den, label: 'E — Tanière' }),
    building('market', map.market, { panel: 'market', pos: map.market, label: 'E — Marché' }),
    { panel: 'board', pos: map.board, reach: 55, label: 'E — Tableau du village' }, // petit : la Tanière d'à côté passe avant
    building('stone', map.stones[0], { panel: 'travel', pos: map.stones[0], label: 'E — Pierre de passage', at: -1 }),
    ...map.sites.map((site, i): Spot =>
      v.camps.includes(i)
        ? { panel: 'travel', pos: map.stones[i + 1], label: 'E — Pierre de passage', at: i }
        : { panel: 'camp', pos: site, label: 'E — Établir le camp', at: i },
    ),
    // l'École des dompteurs, au village une fois bâtie par Aubin ; son plan, dans un coffre du Camp avancé une fois établi
    ...(v.buildings.includes('school') ? [{ panel: 'school' as const, pos: map.school, label: 'E — École des dompteurs' }]
      : [{ pos: map.school, reach: 90, label: v.school[1] ? `Aubin bâtit l'école · ${clock(v.school[1])}` : v.school[0] ? 'École des dompteurs : Aubin peut la bâtir' : 'École des dompteurs : son plan est au Camp avancé' }]),
    ...(v.camps.includes(SCHOOL_CAMP) && !v.school[0] ? [{ plan: true, pos: map.planChest, reach: PLAN_REACH, label: 'E — Ouvrir le vieux coffre' }] : []),
    // le volcan : sa bouche (scellée tant que les géants de la Mer de sable sont debout), la sortie de ses entrailles,
    // et l'autel du cœur, au centre
    volcanoOpen(v.beaten)
      ? { cave: { id: HALL_ID, enter: true }, pos: map.volcanoMouth, label: 'E — Descendre dans le volcan' }
      : { pos: map.volcanoMouth, label: 'Scellée : vaincs les géants de la Mer de sable' },
    { cave: { id: HALL_ID, enter: false }, pos: map.depths.exit, label: 'E — Remonter à la surface' },
    // la haute mer : on prend la mer depuis le bateau prêt ; à bord, on peut faire demi-tour, et une fois le Kraken
    // vaincu, la route du Colisée est libre
    ...(() => {
      const c = map.voyage;
      if (!c) return [];
      const free = v.beaten.includes(c.boss);
      return [
        ...(v.lore[1] >= BOAT_STAGES.length && v.heart >= HEART_IN_BOAT
          ? [{ cave: { id: c.id, enter: true }, pos: c.entrance, reach: BOAT_REACH, label: free ? 'E — Prendre la mer (cap sur le Colisée)' : 'E — Prendre la mer' }]
          : []),
        { cave: { id: c.id, enter: false }, pos: c.exit, label: 'E — Faire demi-tour (retour au port)' },
        ...(free ? [{ pos: { x: c.inside.x + DECK_RX - 130, y: c.inside.y }, reach: 150, label: 'Cap sur le Colisée : la suite arrive bientôt' }] : []),
      ];
    })(),
    // le bateau rebâti : il lui faut encore son cœur, dernière étape avant de prendre la mer
    ...(v.lore[1] >= BOAT_STAGES.length && v.heart < HEART_IN_BOAT
      ? [v.heart === HEART_TAKEN
          ? { heart: true, pos: map.shipwreck, reach: BOAT_REACH, label: 'E — Installer le cœur volcanique dans le bateau' }
          : { pos: map.shipwreck, reach: BOAT_REACH, label: 'Il manque au bateau un cœur pour naviguer' }]
      : []),
    ...(() => {
      if (v.heart) return [];
      const left = map.caves.filter((c) => c.zone === VOLCANO_ZONE && !v.beaten.includes(c.boss)).length;
      return [left
        ? { pos: map.depths.inside, reach: HEART_REACH + 40, label: `Scellé : encore ${left} géant${left > 1 ? 's' : ''} du volcan à vaincre` }
        : { heart: true, pos: map.depths.inside, reach: HEART_REACH, label: 'E — Prendre le cœur volcanique' }];
    })(),
    ...map.caves.filter((c) => c.zone !== VOYAGE_ZONE && c.open === undefined).flatMap((c): Spot[] => [
      v.unlocked.includes(c.id)
        ? {
          cave: { id: c.id, enter: true }, pos: c.entrance,
          label: v.caves[c.id] ? `E — Entrer (${SPECIES[c.boss].name} revient dans ${clock(v.caves[c.id])})` : `E — Entrer · ${SPECIES[c.boss].name} t'attend`,
        }
        : { panel: 'buy', pos: c.entrance, buy: { cave: c.id }, label: 'E — Débloquer la grotte' },
      { cave: { id: c.id, enter: false }, pos: c.exit, label: 'E — Sortir de la grotte' },
    ]),
    ...v.chests.filter((c) => !c[3]).map((c): Spot => ({ chest: c[0], pos: { x: c[1], y: c[2] }, label: c[0] < 0 ? 'E — Ouvrir le coffre du naufragé' : 'E — Ouvrir le coffre' })),
    ...map.bushes.filter((b) => !v.bare.includes(b.id) && Math.hypot(x - b.x, y - b.y) < BUSH_PICK_R)
      .map((b): Spot => ({ pick: true, pos: b, reach: BUSH_PICK_R, label: 'E — Cueillir' })),
    ...v.sleepers.filter((z) => map.caves[z.cave]?.zone !== VOYAGE_ZONE).map((z): Spot => ({ panel: 'talk', pos: z, at: z.cave, reach: z.r + BOSS_TALK_R, label: `E — Parler à ${SPECIES[map.caves[z.cave].boss].name}` })),
  ];
  return spots.find((b) => Math.hypot(x - b.pos.x, y - b.pos.y) < (b.reach ?? BUILDING_REACH));
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
// Le HUD est mis à jour à chaque image : on n'écrit dans la page que ce qui a changé (sinon le navigateur
// recalcule styles et mise en page 60 fois par seconde pour rien).
const setText = (el: HTMLElement, v: string) => void (el.textContent !== v && (el.textContent = v));
const setHidden = (el: HTMLElement, v: boolean) => void (el.hidden !== v && (el.hidden = v));
const setClass = (el: HTMLElement, v: string) => void (el.className !== v && (el.className = v));
const setStyle = (el: HTMLElement, k: 'width' | 'color', v: string) => void (el.style[k] !== v && (el.style[k] = v));
/**
 * Bouton du jeu : au doigt, il agit dès que le doigt se pose. Un autre doigt qui tient le déplacement n'empêche rien
 * (le navigateur ne déclenche pas de clic pendant un geste à deux doigts).
 * Le clic que le navigateur fabrique ensuite, au lever du doigt, ne doit rien refaire : il est annulé à la source
 * (touchend), et, au cas où il passerait quand même, ignoré partout pendant un moment (le bouton a pu changer de rôle,
 * « Entrer » devenu « Sortir », ou un panneau s'ouvrir sous le doigt).
 */
const tapAt = new WeakMap<HTMLElement, number>();
let ghostUntil = 0;
addEventListener('click', (e) => {
  if (performance.now() >= ghostUntil || !e.isTrusted) return;
  e.stopPropagation();
  e.preventDefault();
}, true);
const onTap = (el: HTMLElement, fn: () => void) => {
  el.onpointerdown = (e) => {
    if (e.pointerType === 'mouse') return;
    const now = performance.now();
    if (now - (tapAt.get(el) ?? -Infinity) < 250) return; // le même toucher signalé deux fois
    tapAt.set(el, now);
    ghostUntil = now + 800;
    fn();
  };
  el.ontouchend = (e) => e.cancelable && e.preventDefault(); // pas de clic fabriqué après le toucher
  el.onclick = () => void (performance.now() - (tapAt.get(el) ?? -Infinity) > 700 && fn());
};
const pct = (n: number) => `${Math.round(n * 100)} %`;
/** 0.033 → « 3,3 % » (une décimale au plus). */
const pctLabel = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString('fr-FR')} %`;
/** 30 → « 30 s », 90 → « 1 min 30 », 120 → « 2 min ». */
const duration = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min${sec % 60 ? ` ${String(sec % 60).padStart(2, '0')}` : ''}`);

export class Hud {
  private mini = $<HTMLCanvasElement>('minimap').getContext('2d')!;
  private miniBg: HTMLCanvasElement;
  private last = { party: '', den: '', cls: '', spec: '', travel: '', bestiary: '', market: '', hall: '', members: '', elder: '', school: '', profile: '' };
  private denTab: 'alphas' | 'bestiary' = 'alphas';
  private form: BestiaryForm = 'wild'; // forme montrée par le bestiaire
  private beasts: Portrait[] = [];
  private portraits: Portrait[] = []; // Alphas de la Tanière
  private wares: Portrait[] = []; // monstres du Marché
  panel: Panel = null;
  private promptAfter = 0; // passage de grotte : pas de bouton d'action avant cette date (le double clic ne fait rien)
  onUpgrade = (_what: Gear) => {};
  onAlphaUp = (_species: number) => {};
  onAlphaEquip = (_species: number, _equip: boolean) => {};
  onAlphaCreate = (_species: number) => {};
  onHelp = (_on: boolean) => {};
  private helpHeld = false; // bouton « relever » maintenu au doigt
  onCave = (_id: number, _enter: boolean) => {};
  onLegend = (_id: number) => {};
  onQuit = () => {};
  onReset = () => {};
  onClass = (_cls: ClassId) => {};
  onSpec = (_spec: SpecId) => {};
  onTravel = (_to: number) => {};
  onEstablish = (_site: number) => {};
  onLearn = (_kind: number) => {};
  onBuild = (_b: BuildingId) => {};
  onUnlock = (_cave: number) => {};
  onSell = (_id: number) => {};
  onBuy = (_species: number) => {};
  // Biens du village, mis à jour à chaque snapshot.
  caves: number[] = []; // retour des mini-boss (s)
  camps: number[] = []; // camps établis
  buildings: BuildingId[] = []; // bâtiments construits
  unlocked: number[] = []; // grottes débloquées
  sleepers: Sleeper[] = []; // géants endormis à portée de vue
  chests: [number, number, number, number][] = []; // coffres des géants vaincus
  hall = 0; // niveau de l'Hôtel de ville
  vname = ''; // nom du village ('' : pas encore nommé)
  sword = SWORD_PULLS; // coups donnés pour déterrer l'épée
  stock: [number, number] = [0, 0]; // réserve du village : bois, pierre
  bare: number[] = []; // buissons sans baies
  onPick = () => {};
  onHold = () => {};
  onScroll = (_cave: number) => {};
  onHeart = () => {};
  heart = 0; // cœur volcanique (0, HEART_TAKEN, HEART_IN_BOAT)
  school: [number, number] = [0, 0]; // École des dompteurs : plan trouvé (0/1), secondes avant la fin du chantier d'Aubin
  /** Géants dont le vieil homme attend le parchemin : ceux de l'île (ceux du volcan n'en laissent pas). */
  private islandCaves() {
    return this.map.caves.filter((c) => c.zone < VOLCANO_ZONE && !SPECIES[c.boss].optional).length;
  }
  onScrollGive = () => {};
  onBoat = () => {};
  onPlan = () => {}; // coffre du Camp avancé : le plan de l'école
  onSchool = () => {}; // donner à Aubin les ressources de l'école
  onSword = () => {};
  onRide = () => {}; // bouton selle (mobile) : monter ou descendre
  onDeposit = () => {};
  beaten: number[] = []; // géants vaincus par le village
  onHall = (_name?: string) => {};
  onRename = (_name: string) => {};
  onAttackMode = () => {};
  onKick = (_id: number) => {};
  onUnban = (_user: string) => {};
  capturing: Action | null = null; // réglages : action dont on attend la nouvelle touche
  banned: { id: string; name: string }[] = []; // bannis du village (vu par le fondateur)
  onChest = (_id: number) => {};
  onChallenge = (_cave: number) => {};
  private talker: Portrait[] = [];
  private elderAt = 0; // réplique du vieil homme en cours
  private npcWho = 0; // nouveau-né à qui l'on parle
  private npcAt = 0; // réplique en cours avec lui
  private elderLines: string[] = []; // ce qu'il est en train de dire
  private elderView: 'talk' | 'boat' | 'scrolls' | 'school' = 'talk';
  told: number[] = []; // parchemins lus par Aubin (géant de chacun), dans l'ordre
  private myScrolls = 0; // parchemins dans mon sac
  private elderMet = true; // déjà parlé au vieil homme dans ce village (retenu sur cet appareil)
  private elderKey = '';
  /** Point d'exclamation au-dessus du vieil homme : jamais venu lui parler, ou des parchemins à lui rapporter. */
  get elderCalls() {
    return !this.elderMet || this.myScrolls > 0;
  }
  elderLeaving = false; // Aubin part au chantier du bateau, mais on lui parle encore (voir Game.elderWalk)
  lore: [number, number, number] = [0, 0, 0]; // souvenirs retrouvés, étapes du bateau, secondes avant la fin de l'étape en cours
  scrollCaves: number[] = []; // grottes dont le parchemin m'attend // portrait du géant à qui l'on parle
  private buying: Purchase | null = null; // achat proposé par le panneau d'achat
  private spotAt = 0; // Pierre ou emplacement devant lequel on se tient (panneaux voyage et camp)
  private bigBg?: HTMLCanvasElement;
  private miniAt = 0; // dernier dessin de la minicarte
  private bigAt = 0; // et de la grande carte

  /** founder : fondateur du village (peut le supprimer) ; sinon on n'efface que sa propre progression. */
  constructor(code: string, private map: WorldMap, private fog: Fog, founder: boolean) {
    this.miniBg = this.renderMapBackground(180);
    // grande carte, à la souris : la grotte survolée affiche le nom de son géant
    const big = $<HTMLCanvasElement>('bigmap-canvas');
    big.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const b = big.getBoundingClientRect();
      this.mapHover = { x: e.clientX - b.left, y: e.clientY - b.top };
    });
    big.addEventListener('pointerleave', () => (this.mapHover = null));
    $('hud').hidden = false;
    // pastille de meute : le gluant du jeu, dessiné avec son sprite et qui remplit la pastille
    requestAnimationFrame(() => {
      const c = $<HTMLCanvasElement>('army-icon'), dpr = Math.min(2, devicePixelRatio || 1), s = SPECIES.findIndex((sp) => sp.key === 'slime');
      c.width = Math.round(c.clientWidth * dpr);
      c.height = Math.round(c.clientHeight * dpr);
      const ctx = c.getContext('2d')!, r = SPECIES[s].r, k = (c.height * 0.5) / r;
      ctx.setTransform(k, 0, 0, k, c.width / 2, c.height * 0.58);
      drawUnit(ctx, { x: 0, y: 0, r, species: s, alpha: false, legend: false, wild: false, face: 1, t: 0, seed: s, flash: false });
    });
    $('code-label').textContent = code;
    this.elderKey = `fangleaf.elder.${code}`;
    try {
      this.elderMet = !!localStorage.getItem(this.elderKey);
    } catch { /* stockage indisponible : on ne le signale pas */ }
    const revive = $('revive-prompt');
    revive.onpointerdown = (e) => {
      revive.setPointerCapture(e.pointerId);
      this.helpHeld = true;
      this.onHelp(true);
    };
    revive.onpointerup = revive.onpointercancel = () => this.releaseHelp();
    $('invite').onclick = async () => {
      const url = `${location.origin}${location.pathname}?v=${code}`;
      try {
        await navigator.clipboard.writeText(url);
        this.toast('Lien d\'invitation copié — envoie-le à tes amis !', 'good');
      } catch {
        prompt('Copie ce lien et envoie-le à tes amis :', url);
      }
    };
    $('minimap').addEventListener('click', () => this.setPanel('map'));
    $('quit-confirm').onclick = () => this.onQuit();
    // Repartir de zéro, avec une confirmation dans le même panneau.
    $('reset-ask').textContent = founder ? 'Supprimer le village' : 'Effacer ma progression ici';
    $('reset-go').textContent = founder ? 'Oui, supprimer le village' : 'Oui, tout effacer';
    $('reset-text').innerHTML = founder
      ? `Supprimer définitivement le village <b>${code}</b> ? La carte, les camps et la progression de <b>tous ses membres</b> (or, équipement, essences, Alphas) seront effacés. C'est irréversible.`
      : `Effacer définitivement <b>ta</b> progression dans le village <b>${code}</b> (or, équipement, essences, Alphas) ? Seul son fondateur peut supprimer le village. C'est irréversible.`;
    const confirmStep = (on: boolean) => {
      $('reset-main').hidden = on;
      $('reset-confirm').hidden = !on;
      $<HTMLButtonElement>(on ? 'reset-cancel' : 'reset-ask').focus();
    };
    $('reset-ask').onclick = () => confirmStep(true);
    $('reset-cancel').onclick = () => confirmStep(false);
    $('reset-go').onclick = () => {
      $<HTMLButtonElement>('reset-go').disabled = true;
      this.onReset();
    };
    $('talk-fight').onclick = () => this.onChallenge(this.spotAt);
    $('hall-up').onclick = () => {
      if (this.hall > 0) return this.onHall();
      const input = $<HTMLInputElement>('hall-name');
      const name = input.value.replace(/\s+/g, ' ').trim();
      if (!name) return input.focus(); // on construit l'Hôtel de ville : il faut nommer le village
      this.onHall(name);
    };
    // Hôtel de ville construit : on peut renommer le village à tout moment
    $('hall-rename').onclick = () => {
      const input = $<HTMLInputElement>('hall-name');
      const name = input.value.replace(/\s+/g, ' ').trim();
      if (!name) return input.focus();
      if (name !== this.vname) this.onRename(name);
      input.blur();
    };
    $('hall-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $(this.hall > 0 ? 'hall-rename' : 'hall-up').click();
      else if (e.key === 'Escape') (e.target as HTMLInputElement).blur(); // les touches reviennent au jeu
    });
    this.initSettings(founder);
    onTap($('hold-btn'), () => this.onHold());
    onTap($('mount-btn'), () => this.onRide());
    $('talk-later').onclick = () => this.setPanel(null);
    // un nouveau-né : on se parle à tour de rôle, une réplique après l'autre
    $('npc-next').onclick = () => {
      const h = HATCHLINGS[this.npcWho];
      if (!h || this.npcAt >= h.lines.length - 1) return this.setPanel(null);
      this.npcAt++;
      this.showNpc();
    };
    for (const id of ['forge', 'den', 'market', 'bigmap', 'quit', 'travel', 'camp', 'buy', 'talk', 'elder', 'npc', 'hall', 'settings', 'board', 'school', 'profile'] as const) {
      const el = $(id);
      el.querySelector<HTMLButtonElement>('.close')!.onclick = () => this.setPanel(null);
      el.addEventListener('click', (e) => {
        if (e.target === el) this.setPanel(null);
      });
    }
    $('stones').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-to]');
      if (btn && !btn.disabled) this.onTravel(Number(btn.dataset.to));
    });
    $('camp-buy').onclick = () => this.onEstablish(this.spotAt);
    $('school-list').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-kind]');
      if (btn && !btn.disabled) this.onLearn(Number(btn.dataset.kind));
    });
    $('buy-go').onclick = () => {
      if (this.buying && 'b' in this.buying) this.onBuild(this.buying.b);
      else if (this.buying) this.onUnlock(this.buying.cave);
    };
    $('market').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-sell], button[data-buy]');
      if (!btn || btn.disabled) return;
      if (btn.dataset.sell) this.onSell(Number(btn.dataset.sell));
      else this.onBuy(Number(btn.dataset.buy));
    });
    // Tanière : onglets Alphas / Bestiaire.
    for (const tab of ['alphas', 'bestiary'] as const) {
      $(`den-tab-${tab}`).onclick = () => {
        this.denTab = tab;
        $('den-tab-alphas').setAttribute('aria-selected', String(tab === 'alphas'));
        $('den-tab-bestiary').setAttribute('aria-selected', String(tab === 'bestiary'));
        $('den-alphas').hidden = tab !== 'alphas';
        $('den-bestiary').hidden = tab !== 'bestiary';
        this.last.den = '';
        this.last.bestiary = '';
      };
    }
    // Bestiaire : forme sauvage, Alpha, légendaire ou géant de chaque espèce.
    const forms = $('bestiary-forms').querySelectorAll<HTMLButtonElement>('button');
    forms.forEach((b) => (b.onclick = () => {
      this.form = b.dataset.form as BestiaryForm;
      forms.forEach((o) => o.setAttribute('aria-checked', String(o === b)));
      this.last.bestiary = '';
    }));
    $('weapon-buy').onclick = () => this.onUpgrade('weapon');
    $('forge2-go').onclick = () => this.onBuild('forge2');
    $('armor-buy').onclick = () => this.onUpgrade('armor');
    $('torch-buy').onclick = () => this.onUpgrade('torch');
    $('boots-buy').onclick = () => this.onUpgrade('boots');
    $('saddle-buy').onclick = () => this.onUpgrade('saddle');
    $('evolve-go').onclick = () => {
      $('evolve').hidden = true;
      $('evolve-text').classList.remove('on');
    };
    $('alphas').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.buy');
      if (btn?.dataset.up) this.onAlphaUp(Number(btn.dataset.up));
      else if (btn?.dataset.create) this.onAlphaCreate(Number(btn.dataset.create));
      const eq = (e.target as HTMLElement).closest<HTMLButtonElement>('button.equip');
      if (eq?.dataset.s) this.onAlphaEquip(Number(eq.dataset.s), eq.dataset.equip === '1');
      const leg = (e.target as HTMLElement).closest<HTMLButtonElement>('button.legend-btn');
      if (leg?.dataset.legend) this.onLegend(Number(leg.dataset.legend));
    });
  }

  /** Grande annonce au centre de l'écran quand on entre dans un lieu (camp, village, zone). */
  banner(title: string, subtitle: string, danger = false) {
    const el = $('area-banner');
    el.querySelector('b')!.textContent = title;
    el.querySelector('span')!.textContent = subtitle;
    el.querySelector('span')!.hidden = !subtitle;
    el.classList.toggle('danger', danger);
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth; // relance l'animation
    el.style.animation = '';
  }

  /** Transition d'entrée ou de sortie de grotte : noir, puis l'image s'ouvre en iris (le lieu s'annonce par la bannière). */
  caveFade() {
    this.promptAfter = performance.now() + CAVE_CD * 1000;
    const el = $('cave-fade');
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth; // relance l'animation
    el.style.animation = '';
    clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => (el.hidden = true), 1600);
  }
  private fadeTimer = 0;

  setPanel(panel: Panel) {
    this.panel = panel;
    $('forge').hidden = panel !== 'forge';
    $('den').hidden = panel !== 'den';
    $('market').hidden = panel !== 'market';
    $('buy').hidden = panel !== 'buy';
    $('bigmap').hidden = panel !== 'map';
    $('quit').hidden = panel !== 'quit';
    $('reset-main').hidden = false; // les paramètres rouvrent toujours sur leurs choix, jamais sur la confirmation
    $('reset-confirm').hidden = true;
    $('travel').hidden = panel !== 'travel';
    $('camp').hidden = panel !== 'camp';
    $('school').hidden = panel !== 'school';
    $('talk').hidden = panel !== 'talk';
    $('elder').hidden = panel !== 'elder';
    $('npc').hidden = panel !== 'npc';
    if (panel === 'npc') {
      this.npcWho = this.spotAt;
      this.npcAt = 0;
      this.showNpc();
    }
    if (panel === 'elder') {
      this.elderMet = true;
      try {
        localStorage.setItem(this.elderKey, '1');
      } catch { /* stockage indisponible */ }
      // des parchemins à lui donner : il les réclame ; sinon il salue (et reprend depuis le début)
      this.elderView = 'talk';
      this.elderSay(this.myScrolls ? ['Oh ! Ce que tu tiens là… ce sont des parchemins ? Fais voir, fais voir !'] : elderGreeting(this.lore[0], this.islandCaves(), this.lore[1], BOAT_STAGES.length, this.heart, this.lore[2]));
    }
    $('hall').hidden = panel !== 'hall';
    $('settings').hidden = panel !== 'settings';
    $('profile').hidden = panel !== 'profile';
    if (panel === 'profile') {
      this.last.profile = '';
      this.onBoard(); // les couleurs des membres endormis au village (déjà prises)
    }
    $('chat').hidden = panel !== 'chat';
    $('board').hidden = panel !== 'board';
    if (panel === 'board') this.onBoard(); // le serveur répond avec le tableau à jour
    if (panel !== 'chat' && document.activeElement === $('chat-input')) $('chat-input').blur(); // les touches reviennent au jeu
    if (panel === 'chat') {
      this.unread = 0;
      $('chat-unread').hidden = true;
      this.renderChat();
      setTimeout(() => $<HTMLInputElement>('chat-input').focus()); // après la touche d'ouverture : pas de « c » tapé dans le champ
    }
    this.capturing = null;
    this.last.members = '';
    this.last.den = '';
    this.last.travel = '';
    this.last.cls = '';
    this.last.market = '';
    this.last.hall = '';
    this.last.school = '';
    if (panel && panel !== 'chat') $(panel === 'map' ? 'bigmap' : panel).querySelector<HTMLButtonElement>('.close')!.focus();
  }

  /**
   * Double éveil, façon évolution : l'Alpha au centre, une silhouette blanche qui grandit et rapetisse de plus en plus
   * vite (sa forme d'avant, sa forme légendaire), un éclair, puis l'Alpha légendaire dans son aura dorée ; le texte dit
   * qu'il peut maintenant utiliser les attaques de son géant. Un clic sur « Continuer » referme.
   */
  evolve(s: number) {
    const el = $('evolve'), c = $<HTMLCanvasElement>('evolve-canvas'), text = $('evolve-text');
    const sp = SPECIES[s], boss = bossOf(s), giant = SPECIES[boss];
    $('evolve-title').textContent = 'Quoi ? Ton Alpha éveille son vrai potentiel !';
    $('evolve-line').textContent = `Ton Alpha ${sp.name} est devenu légendaire ! Il peut maintenant utiliser les attaques de ${giant?.title ?? giant?.name ?? 'son géant'}.`;

    text.classList.remove('on');
    el.hidden = false;
    const t0 = performance.now(), REVEAL = 3.8, r = alphaStats(s, 0, 0, false).r, rl = alphaStats(s, 0, 0, true).r;
    const id = ++this.evolveId;
    let revealed = false;
    sound.play('chime');
    const frame = () => {
      if (id !== this.evolveId || el.hidden) return;
      const t = (performance.now() - t0) / 1000, dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== H) [c.width, c.height] = [W, H];
      const ctx = c.getContext('2d')!, cx = W / 2, cy = H * 0.42, k = (Math.min(W, H) * 0.16) / rl;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07090A';
      ctx.fillRect(0, 0, W, H);
      // rayons de lumière qui tournent derrière lui, de plus en plus vifs
      const glow = Math.min(1, t / REVEAL), gold = t >= REVEAL;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(Math.PI / 6);
        ctx.fillStyle = gold ? 'rgba(240,182,74,0.16)' : `rgba(190,220,255,${0.05 + glow * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H), -40 * dpr);
        ctx.lineTo(Math.max(W, H), 40 * dpr);
        ctx.fill();
      }
      ctx.restore();
      // la transformation : sa forme d'avant et sa forme légendaire en silhouette blanche, de plus en plus vite
      ctx.setTransform(k, 0, 0, k, cx, cy);
      if (t < 0.7) drawUnit(ctx, { x: 0, y: 0, r, species: s, alpha: true, legend: false, wild: false, face: 1, t, seed: s, flash: false });
      else if (!gold) {
        const speed = 1.5 + (t - 0.7) * 4, big = Math.sin((t - 0.7) * speed * Math.PI) > 0;
        drawUnit(ctx, { x: 0, y: 0, r: big ? rl : r, species: s, alpha: true, legend: false, wild: false, face: 1, t: 0, seed: s, flash: true });
      } else drawUnit(ctx, { x: 0, y: 0, r: rl, species: s, alpha: true, legend: true, wild: false, face: 1, t, seed: s, flash: false });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // éclair blanc au moment de la révélation, puis des étincelles dorées qui montent
      if (t >= REVEAL - 0.25 && t < REVEAL + 0.6) {
        ctx.fillStyle = `rgba(255,255,255,${t < REVEAL ? (t - REVEAL + 0.25) / 0.25 : 1 - (t - REVEAL) / 0.6})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (gold) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + i, d = ((t - REVEAL) * 60 + i * 37) % 220;
          ctx.fillStyle = `rgba(240,182,74,${1 - d / 220})`;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * (60 + d) * dpr, cy + Math.sin(a) * (40 + d * 0.6) * dpr - d * 0.5 * dpr, 3 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
        if (!revealed) {
          revealed = true;
          text.classList.add('on');
          sound.play('fanfare');
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  private evolveId = 0;

  /** Ce qu'on vient de perdre en tombant : en gros, en rouge, sur l'écran de mort (or, puis bois et pierre du sac). */
  deathLoss(gold: number, wood: number, stone: number) {
    const el = $('death-loss'), res = [wood && `−${wood} bois`, stone && `−${stone} pierre`].filter(Boolean).join(' · ');
    el.hidden = !gold && !res;
    el.innerHTML = gold ? `−${gold.toLocaleString('fr-FR')} or` : '';
    if (res) {
      const small = document.createElement('small');
      small.textContent = res;
      el.append(small);
    }
    el.style.animation = 'none';
    void el.offsetWidth; // relance l'animation
    el.style.animation = '';
  }

  /** Saison du village, sous la minicarte. */
  setSeason(name: string) {
    const icon: Record<string, string> = { Printemps: '🌸', Été: '☀️', Automne: '🍂', Hiver: '❄️' };
    $('season').textContent = `${icon[name] ?? ''} ${name}`;
  }

    toast(text: string, kind: '' | 'alpha' | 'good' = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('toasts').append(el);
    setTimeout(() => el.remove(), 3400);
    while ($('toasts').children.length > 4) $('toasts').firstElementChild!.remove();
  }

  update(me: PlayerState, players: PlayerState[], units: UnitTuple[], myPos: { x: number; y: number }, ping: number) {
    // Soi.
    setText($('self-name'), me.name);
    setStyle($('self-name'), 'color', me.color);
    const hpRatio = me.hp / me.maxHp;
    const fill = $('self-hp');
    setStyle(fill, 'width', `${Math.round(Math.max(0, hpRatio) * 1000) / 10}%`); // arrondi : comparable à ce que le navigateur garde
    fill.classList.toggle('low', hpRatio < 0.3);
    setText($('self-hptext'), `${me.hp} / ${me.maxHp}`); // dans la barre de vie
    setText($('self-gold'), short(me.gold)); // l'icône (pièce) dit ce que c'est
    setText($('self-wood'), short(me.wood)); // l'icône dit ce que c'est
    setText($('self-stone'), short(me.stone));
    setText($('self-fruits'), short(me.fruits));
    // au doigt seulement (sur PC : touche T) : tendre ou ranger un fruit
    const hold = $('hold-btn');
    hold.classList.toggle('on', me.holding);
    hold.setAttribute('aria-label', me.holding ? 'Ranger la baie' : 'Tendre une baie');
    // au doigt (sur PC : touche F) : monter ou descendre, dès qu'on a une monture dans sa meute
    const ride = $('mount-btn');
    ride.classList.toggle('on', !!me.mount);
    ride.setAttribute('aria-label', me.mount ? 'Descendre de sa monture' : 'Monter sur sa monture');
    setHidden(ride, !me.mount && !me.army.some((a) => a.alpha && MOUNTS[SPECIES[a.species].key]));
    setText($('self-army'), `${me.army.filter((a) => !a.alpha).length} / ${armyCap(me.learned)}`); // meute ordinaire, en bas à gauche
    setText($('ping'), ping && settings.display.ping ? `${ping} ms` : '');
    setHidden($('invite'), players.length >= MAX_PLAYERS); // village complet : plus personne à inviter
    // au doigt, « Tendre un fruit » seulement près d'un gibier passif (ou si on en tend déjà un)
    const prey = units.some((u) => !u[6] && SPECIES[u[1]].passive && Math.hypot(u[3] - myPos.x, u[4] - myPos.y) < LURE_R);
    setHidden($('hold-btn'), me.holding ? false : !me.fruits || !prey);

    // Groupe.
    const others = players.filter((p) => p.id !== me.id);
    const partyKey = JSON.stringify(others.map((p) => [p.name, p.hp, p.maxHp, p.pack, p.dead, this.map.inVillage(p.x, p.y)]));
    if (partyKey !== this.last.party) {
      this.last.party = partyKey;
      const party = $('party');
      setHidden(party, others.length === 0);
      party.replaceChildren(
        ...others.map((p) => {
          const wrap = document.createElement('div');
          wrap.className = 'col';
          const status = p.dead ? 'À terre' : this.map.inVillage(p.x, p.y) ? 'Au village' : `Meute ${p.pack}`;
          wrap.innerHTML = `<div class="row"><b></b><span class="muted"></span></div><div class="bar thin"><div class="fill"></div></div>`;
          const b = wrap.querySelector('b')!;
          setText(b, p.name);
          setStyle(b, 'color', p.color);
          wrap.querySelector('.muted')!.textContent = status;
          (wrap.querySelector('.fill') as HTMLElement).style.width = `${(p.hp / p.maxHp) * 100}%`;
          return wrap;
        }),
      );
    }

    // Bâtiments.
    const b = me.dead ? undefined : buildingNear(this.map, myPos.x, myPos.y, this);
    const prompt = $('build-prompt');
    setHidden(prompt, !b || !!this.panel || performance.now() < this.promptAfter);
    if (b) {
      // au doigt, pas de touche à rappeler ; sur PC, la touche réglée pour « interagir »
      setText(prompt, b.label.replace(/^E — /, touchOnly ? '' : `${keyLabel('interact')} — `));
      setClass(prompt, `btn prompt ${b.panel ?? (b.deposit ? 'hall' : b.pick || b.sword || b.heart || b.scroll !== undefined ? 'pick' : b.chest !== undefined ? 'chest' : b.cave && this.caves[b.cave.id] === 0 && b.cave.enter ? 'danger' : 'den')}`);
      const act = () => (b.panel ? this.setPanel(b.panel) : b.deposit ? this.onDeposit() : b.pick ? this.onPick() : b.sword ? this.onSword() : b.heart ? this.onHeart() : b.plan ? this.onPlan() : b.scroll !== undefined ? this.onScroll(b.scroll) : b.chest !== undefined ? this.onChest(b.chest) : b.cave && this.onCave(b.cave.id, b.cave.enter));
      onTap(prompt, act);
    }
    const building = this.panel !== null && !['map', 'quit', 'settings', 'chat', 'board', 'profile'].includes(this.panel);
    if (building && b?.panel !== this.panel) this.setPanel(null);
    if (b?.buy) this.buying = b.buy;
    if (b?.at !== undefined && b.at !== this.spotAt) {
      this.spotAt = b.at;
      this.last.travel = '';
    }
    if (this.panel === 'travel') this.updateTravel();
    if (this.panel === 'camp') this.updateCamp(me);
    if (this.panel === 'school') this.updateSchool(me);
    if (this.panel === 'buy') this.updateBuy(me);
    if (this.panel === 'talk') this.updateTalk();
    if (this.panel === 'hall') this.updateHall(me);
    this.myScrolls = me.scrolls ?? 0;
    if (this.panel === 'elder') this.updateElder(me);
    if (this.panel === 'settings') this.updateMembers(me, players);
    if (this.panel === 'profile') this.updateProfile(me, players);
    if (this.panel === 'market') this.updateMarket(me);
    if (this.panel === 'forge') this.updateForge(me);
    if (this.panel === 'den' && this.denTab === 'alphas') this.updateDen(me);
    if (this.panel === 'den' && this.denTab === 'bestiary') this.updateBestiary(me);

    // Mort.
    setHidden($('death'), !me.dead);
    setText($('death-timer'), String(me.respawnIn));
    const help = $('death-help');
    setHidden(help, !me.dead || others.length === 0);
    if (me.dead) {
      const c = this.map.respawnSite(me.x, me.y, this.camps);
      setText($('death-where'), c < 0 ? 'Retour au village' : `Retour au ${campName(c)}`);
      const by = others.find((p) => p.id === me.reviveBy);
      setText(help, by ? `${by.name} te relève… ${me.revive} %` : 'Un coéquipier peut te relever : R maintenu 5 s près de toi.');
    }

    // Relever un coéquipier à terre (R maintenu, ou bouton maintenu au doigt).
    const downed = me.dead ? undefined : others.find((p) => p.dead && p.respawnIn > 0 && Math.hypot(p.x - myPos.x, p.y - myPos.y) < REVIVE_R);
    const revive = $('revive-prompt');
    setHidden(revive, !downed);
    if (downed) setText(revive, downed.reviveBy === me.id ? `Tu relèves ${downed.name}… ${downed.revive} %` : `Maintiens R : relever ${downed.name}`);
    else if (this.helpHeld) this.releaseHelp();

    // Monture.
    setHidden($('mount-row'), !me.mount);
    if (me.mount) {
      setText($('mount-name'), 'Monture');
      setStyle($('mount-hp'), 'width', `${me.mount.hp}%`);
    }

    // minicarte à 10 images par seconde, grande carte à 20 : bien assez pour des points qui se déplacent
    const now = performance.now();
    if (now - this.miniAt >= 100) {
      this.miniAt = now;
      this.drawMinimap(me, players, units, myPos);
    }
    if (this.panel === 'map' && now - this.bigAt >= 50) {
      this.bigAt = now;
      this.drawBigMap(me, players, myPos);
    }
  }

  private releaseHelp() {
    if (!this.helpHeld) return;
    this.helpHeld = false;
    this.onHelp(false);
  }

  /** Pierre de passage : le village et chaque emplacement de camp, joignables s'ils sont établis. */
  private updateTravel() {
    const key = `${this.spotAt}|${this.camps.join(',')}|${this.buildings.join(',')}|${this.lore[1]}`;
    if (key === this.last.travel) return;
    this.last.travel = key;
    const village = this.buildings.includes('stone');
    // juste le nom de chaque lieu (le village, les camps)
    const rows = [{ to: -1, name: 'Village', open: village }].concat(
      this.map.sites.map((_, i) => ({ to: i, name: campName(i), open: this.camps.includes(i) })),
      dockStoneOn(this.buildings, this.lore[1]) ? [{ to: -2, name: 'Bateau', open: true }] : [],
    );
    $('stones').replaceChildren(
      ...rows.map((r) => {
        const here = r.to === this.spotAt;
        const row = document.createElement('div');
        row.className = `stone-row${r.open ? '' : ' locked'}`;
        row.innerHTML = `<div class="col"><b></b></div><button class="cta"></button>`;
        row.querySelector('b')!.textContent = r.name;
        const btn = row.querySelector('button')!;
        btn.dataset.to = String(r.to);
        btn.disabled = here || !r.open;
        btn.textContent = here ? 'Tu es ici' : r.open ? 'Voyager' : 'Fermé';
        return row;
      }),
    );
  }

  private updateCamp(me: PlayerState) {
    $('camp-title').textContent = `Emplacement · ${campName(this.spotAt)}`;
    const btn = $<HTMLButtonElement>('camp-buy');
    btn.disabled = me.gold < CAMP_COST;
    btn.textContent = me.gold < CAMP_COST ? `Il te faut ${CAMP_COST} or` : `Établir le camp · ${CAMP_COST} or`;
  }

  /** École des dompteurs : une carte par discipline (ce qu'elle apprend, de quoi lire la suivante) ; la leçon en cours affiche son compte à rebours. */
  private updateSchool(me: PlayerState) {
    const key = JSON.stringify([me.learned, me.tomes, !!me.reading, me.readKind]);
    if (key !== this.last.school) this.buildSchool(me, key);
    const reading = me.reading ? $('school-list').querySelector<HTMLButtonElement>(`button[data-kind="${me.readKind}"]`) : null;
    if (reading) setText(reading, `En lecture · ${clock(me.reading)}`);
  }

  private buildSchool(me: PlayerState, key: string) {
    this.last.school = key;
    // où trouver chaque tome : les coffres des géants de deux zones chacun ; le livre à part, ceux du volcan
    const where = (label: string, place: string) => {
      const li = document.createElement('li');
      li.innerHTML = '<b></b> : ';
      li.querySelector('b')!.textContent = label;
      li.append(place);
      return li;
    };
    $('school-where').replaceChildren(
      ...ROMAN.map((t, i) => where(`Tome ${t}`, `géants ${ZONE_NAMES.slice(0, ZONES).filter((_, z) => tomeOfZone(z + 1) === i).join(', ')}`)),
      ...LESSON_KINDS.filter((kind) => DISCIPLINES[kind].volcano).map((kind) => where(DISCIPLINES[kind].tomes[0], `géants du volcan, ${ZONE_NAMES[VOLCANO_ZONE - 1]} (${DISCIPLINES[kind].name})`)),
      // les tomes des îlots du large : chacun gardé par son géant
      ...LESSON_KINDS.filter((kind) => DISCIPLINES[kind].isle).map((kind) => {
        const boss = SPECIES.find((sp) => sp.tome === kind);
        return where(DISCIPLINES[kind].tomes[0], `${boss?.name ?? 'géant'}, sur un îlot au large (${DISCIPLINES[kind].name})`);
      }),
    );
    $('school-list').replaceChildren(...LESSON_KINDS.map((kind, k) => {
      const d = DISCIPLINES[kind], n = me.learned[k] ?? 0, next = tomeForLesson(n, k), solo = d.tomes.length === 1;
      const row = document.createElement('div');
      row.className = 'stone-row';
      row.innerHTML = '<div class="col"><b></b><span class="small muted"></span></div>';
      row.querySelector('b')!.textContent = d.name;
      row.querySelector('span')!.textContent = d.desc;
      const btn = document.createElement('button');
      btn.className = me.reading && me.readKind === k ? 'cta reading' : 'cta';
      btn.dataset.kind = String(k);
      const have = next >= 0 ? me.tomes[bookIndex(k, next)] ?? 0 : 0;
      btn.disabled = next < 0 || !have || !!me.reading;
      // bouton court (il tient sur téléphone) ; où trouver chaque tome : l'encadré en tête du panneau
      btn.textContent = next < 0 ? 'Tout appris' : have ? (solo ? 'Lire' : `Lire le tome ${ROMAN[next]}`) : solo ? 'Livre à trouver' : `Tome ${ROMAN[next]} à trouver`;
      row.append(btn);
      return row;
    }));
  }

  /** Réplique en cours avec un nouveau-né : son nom ou « Toi » en tête, son portrait, et la suite. */
  private showNpc() {
    const h = HATCHLINGS[this.npcWho];
    if (!h) return;
    const [me, text] = h.lines[this.npcAt];
    $('npc-title').textContent = h.name;
    const line = $('npc-line');
    line.classList.toggle('mine', me);
    line.innerHTML = '<b></b><span></span>';
    line.querySelector('b')!.textContent = me ? 'Toi' : h.name;
    line.querySelector('span')!.textContent = me ? text : `« ${text} »`;
    $('npc-next').textContent = this.npcAt >= h.lines.length - 1 ? 'Au revoir' : 'Suite';
    const c = $<HTMLCanvasElement>('npc-portrait'), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = 110 * dpr;
    c.height = 96 * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr * 2.3, 0, 0, dpr * 2.3, 0, 0);
    drawHatchling(ctx, 110 / 2.3 / 2 - 6, 96 / 2.3 / 2 + 8, h.color, 0, 0, 0.4);
  }

  /** Le vieil homme dit ces répliques, une à une (bouton « Suite »). */
  private elderSay(lines: string[]) {
    this.elderLines = lines;
    this.elderAt = 0;
    this.last.elder = '';
  }

  /** Il vient de retrouver les souvenirs from à to - 1 : il les raconte (si on est avec lui), sinon on l'annonce. */
  elderRemembers(from: number, to: number, mine: boolean) {
    const lines = ELDER_CHAPTERS.slice(from, to).flat();
    if (mine && this.panel === 'elder') {
      this.elderView = 'talk';
      this.elderSay(lines);
    } else if (mine) this.toast('Aubin a retrouvé des souvenirs : va l\'écouter près du feu.', 'good');
  }

  /** Panneau du vieil homme : sa réplique, et selon le moment, donner ses parchemins, réécouter ses souvenirs, le bateau. */
  private updateElder(me: PlayerState) {
    const total = this.islandCaves(), [told, boat, left] = this.lore, funds = this.funds(me);
    const key = JSON.stringify([this.elderView, this.elderAt, this.elderLines.length, me.scrolls, this.lore, this.told, this.school, this.buildings.includes('school'), this.hall, this.elderView === 'boat' ? [funds.gold >= 0 && canPay(funds, BOAT_STAGES[boat] ?? BOAT_STAGES[0])] : this.elderView === 'school' ? canPay(funds, buildingCost('school')) : 0]);
    if (key === this.last.elder) return;
    this.last.elder = key;
    $('elder-title').textContent = told ? 'Aubin' : 'Un vieil homme';
    const last = this.elderAt >= this.elderLines.length - 1;
    const button = (label: string, cls: string, act: () => void) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.onclick = act;
      return b;
    };
    const actions: HTMLButtonElement[] = [];
    $('elder-boat').hidden = this.elderView === 'talk';
    if (this.elderView === 'scrolls') {
      // les anciens parchemins : on lui en remontre un, il le raconte à nouveau
      $('elder-line').textContent = '« Lequel veux-tu me montrer ? »';
      $('elder-boat').replaceChildren(
        // un parchemin par zone : ses souvenirs racontés d'un trait
        ...zoneChapters().filter((z) => z.from < told).map((z) => {
          const to = Math.min(z.to, told);
          const row = document.createElement('button');
          row.className = 'boat-stage scroll-pick';
          row.innerHTML = '<b></b><span class="small"></span>';
          row.querySelector('b')!.textContent = `Parchemin ${z.name === 'Lisière' ? 'de la' : 'des'} ${z.name}`;
          row.querySelector('span')!.textContent = CHAPTER_TITLES.slice(z.from, to).join(' · ');
          row.onclick = () => {
            this.elderView = 'talk';
            this.elderSay([...REREAD, ...ELDER_CHAPTERS.slice(z.from, to).flat()]);
          };
          return row;
        }),
      );
      actions.push(button('Retour', 'btn', () => {
        this.elderView = 'talk';
        this.elderSay(elderGreeting(told, total, boat, BOAT_STAGES.length, this.heart, left));
      }));
    } else if (this.elderView === 'school') {
      // l'école : son plan rapporté du Camp avancé, il la bâtit au village contre des ressources
      const built = this.buildings.includes('school'), [, wait] = this.school, need = BUILDINGS.school.hall, c = buildingCost('school');
      $('elder-line').textContent = `« ${built ? 'L\'école est ouverte ! Les livres des géants n\'attendent plus que toi.' : wait ? 'Les murs montent ! Reviens dans un moment.' : this.hall < need ? `Avec ce plan, je pourrais la bâtir… Mais il faut d'abord un Hôtel de ville de niveau ${need}.` : 'Ce plan… l\'École des dompteurs ! Apporte-moi de quoi la bâtir, et je m\'y mets.'} »`;
      const row = document.createElement('div');
      row.className = `boat-stage${built ? ' done' : ' now'}`;
      row.innerHTML = '<b></b><span class="small"></span>';
      row.querySelector('b')!.textContent = BUILDINGS.school.name;
      const info = row.querySelector('span')!;
      if (built) info.textContent = 'Ouverte';
      else if (wait) info.textContent = `En chantier · ${clock(wait)}`;
      else {
        info.className = 'cost-list';
        info.id = 'elder-cost';
      }
      $('elder-boat').replaceChildren(row);
      if (!built && !wait) {
        this.costChips('elder-cost', funds, c);
        const ok = this.hall >= need && canPay(funds, c);
        const pay = button(this.hall < need ? `Hôtel de ville niv. ${need} requis` : ok ? 'Donner les ressources' : 'Il manque des ressources', 'cta', () => this.onSchool());
        pay.disabled = !ok;
        actions.push(pay);
      }
      actions.push(button('Retour', 'btn', () => {
        this.elderView = 'talk';
        this.elderSay(elderGreeting(told, total, boat, BOAT_STAGES.length, this.heart, left));
      }));
    } else if (this.elderView === 'boat') {
      // le bateau : les étapes faites, celle en chantier, ou celle à payer
      $('elder-line').textContent = `« ${boat >= BOAT_STAGES.length ? (this.heart >= HEART_IN_BOAT ? 'Le bateau est prêt à prendre la mer !' : 'La coque est finie. Mais sans cœur, il ne naviguera pas.') : left ? 'Je m\'en occupe ! Reviens dans un moment.' : 'Voilà ce qu\'il me faut pour la suite.'} »`;
      $('elder-boat').replaceChildren(
        ...BOAT_STAGES.map((st, i) => {
          const row = document.createElement('div');
          row.className = `boat-stage${i < boat ? ' done' : i === boat ? ' now' : ''}`;
          row.innerHTML = '<b></b><span class="small"></span>';
          row.querySelector('b')!.textContent = `${i + 1}. ${st.name}`;
          const info = row.querySelector('span')!;
          if (i < boat) info.textContent = 'Terminé';
          else if (i === boat && left) info.textContent = `En chantier · ${clock(left)}`;
          else if (i === boat) {
            info.className = 'cost-list';
            info.id = 'elder-cost';
          } else info.textContent = '…';
          return row;
        }),
      );
      if (boat < BOAT_STAGES.length && !left) {
        this.costChips('elder-cost', funds, BOAT_STAGES[boat]);
        const pay = button(canPay(funds, BOAT_STAGES[boat]) ? 'Donner les ressources' : 'Il manque des ressources', 'cta', () => {
          this.onBoat();
          // il annonce qu'il part au chantier (on le verra partir une fois la conversation finie)
          this.elderView = 'talk';
          this.elderSay([
            `Merci ! Avec tout ça, ${BOAT_STAGES[boat].name.toLowerCase()} ne va pas traîner.`,
            'Bon ! Je file au bateau, au bout de l\'île. Il y a du travail, et ces vieilles jambes ne vont pas vite.',
            'Si tu me cherches, je serai là-bas, le marteau à la main. Viens voir comme il prend forme !',
          ]);
        });
        pay.disabled = !canPay(funds, BOAT_STAGES[boat]);
        actions.push(pay);
      }
      actions.push(button('Retour', 'btn', () => {
        this.elderView = 'talk';
        this.elderSay(elderGreeting(told, total, boat, BOAT_STAGES.length, this.heart, left));
      }));
    } else {
      $('elder-line').textContent = `« ${this.elderLines[this.elderAt] ?? ''} »`;
      if (!last) actions.push(button('Suite', 'cta', () => {
        this.elderAt++;
        this.last.elder = '';
      }));
      else {
        if (me.scrolls) actions.push(button(`Donner ${me.scrolls > 1 ? `les ${me.scrolls} parchemins` : 'le parchemin'}`, 'cta', () => this.onScrollGive()));
        if (this.school[0] && !this.buildings.includes('school')) actions.push(button('L\'école', me.scrolls ? 'btn' : 'cta', () => {
          this.elderView = 'school';
          this.last.elder = '';
        }));
        if (told >= total) actions.push(button('Le bateau', me.scrolls ? 'btn' : 'cta', () => {
          this.elderView = 'boat';
          this.last.elder = '';
        }));
        if (told) actions.push(button('Les anciens parchemins', 'btn', () => {
          this.elderView = 'scrolls';
          this.last.elder = '';
        }));
      }
    }
    actions.push(button('Au revoir', 'btn', () => this.setPanel(null)));
    $('elder-actions').replaceChildren(...actions);
    const c = $<HTMLCanvasElement>('elder-portrait'), dpr = Math.min(2, devicePixelRatio || 1);
    c.width = 110 * dpr;
    c.height = 96 * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr * 2.3, 0, 0, dpr * 2.3, 0, 0);
    drawElder(ctx, 110 / 2.3 / 2, 96 / 2.3 / 2 + 2, 0, 0, 0.4, ''); // de face, le regard vers nous
  }

  /** Dialogue avec un géant endormi : sa réplique, puis on lance le combat (ou pas). */
  private updateTalk() {
    const c = this.map.caves[this.spotAt];
    if (!c) return;
    const sp = SPECIES[c.boss];
    if (this.talker[0]?.s !== c.boss) {
      $('talk-title').textContent = sp.title ?? sp.name;
      $('talk-line').textContent = `« ${BOSS_LINES[sp.key]?.intro ?? '…'} »`;
      $('talk-portrait').setAttribute('aria-label', sp.name);
      this.talker = [{ canvas: $<HTMLCanvasElement>('talk-portrait'), s: c.boss, seen: true }];
    }
    paintPortraits(this.talker);
  }

  /** Panneau d'achat pour le village : un bâtiment à construire ou une grotte à débloquer. */
  private updateBuy(me: PlayerState) {
    const buy = this.buying;
    if (!buy) return;
    const { name, cost, hall } = purchaseOf(this.map, buy);
    // le pont : le bois et la pierre du sac comptent (l'entrepôt est de l'autre côté)
    const funds = 'b' in buy && buy.b === 'bridge' ? { gold: me.gold, wood: me.wood + this.stock[0], stone: me.stone + this.stock[1] } : this.funds(me);
    this.costChips('buy-cost', funds, cost);
    $('buy-title').textContent = 'b' in buy ? `${buy.b === 'bridge' ? 'Réparer' : 'Construire'} : ${name}` : `Débloquer : ${name}`;
    if ('b' in buy) $('buy-desc').textContent = BUILDINGS[buy.b].desc;
    else {
      const boss = SPECIES[this.map.caves[buy.cave].boss], base = SPECIES.find((s) => s.key === boss.base);
      $('buy-desc').textContent = `Ouvre la grotte pour tout le village : ${boss.name} y attend, et son âme permet le double éveil de ton Alpha ${base?.name ?? ''}.`;
    }
    const btn = $<HTMLButtonElement>('buy-go');
    btn.disabled = this.hall < hall || !canPay(funds, cost);
    btn.textContent = this.hall < hall ? `Hôtel de ville niv. ${hall} requis` : !canPay(funds, cost) ? 'Il manque des ressources' : `${'b' in buy ? (buy.b === 'bridge' ? 'Réparer' : 'Construire') : 'Débloquer'} pour le village`;
  }

  /** Paramètres : mode d'attaque et touches (PC), membres du village (expulsion par le fondateur). */
  private initSettings(founder: boolean) {
    this.founder = founder;
    $('settings-open').onclick = () => this.setPanel('settings');
    $('profile-open').onclick = () => this.setPanel('profile');
    onTap($('menu-open'), () => this.setPanel(this.panel === 'quit' ? null : 'quit'));
    onTap($('chat-open'), () => this.setPanel(this.panel === 'chat' ? null : 'chat'));
    $('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $<HTMLInputElement>('chat-input');
      if (input.value.trim()) this.onChat(input.value);
      input.value = '';
      this.setPanel(null); // comme dans Minecraft : on envoie et on retourne au jeu
    });
    $('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setPanel(null);
    });
    // Rubriques : affichage, son, touches (PC seulement), village.
    const tabs = ['display', 'sound', 'keys', 'village'] as const;
    $('set-tab-keys').hidden = touchOnly;
    for (const tab of tabs) {
      $(`set-tab-${tab}`).onclick = () => {
        this.capturing = null;
        for (const t of tabs) {
          $(`set-tab-${t}`).setAttribute('aria-selected', String(t === tab));
          $(`set-${t}`).hidden = t !== tab;
        }
        if (tab === 'village') this.onBoard(); // les membres déconnectés : le serveur répond avec le tableau du village
      };
    }
    // Affichage : qualité, chiffres des dégâts, secousses, latence (appliqués tout de suite).
    const seg = (name: 'quality' | 'damage') => {
      const group = document.querySelector<HTMLElement>(`[data-setting="${name}"]`)!;
      const paint = () => group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === settings.display[name])));
      group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.onclick = () => {
        (settings.display[name] as string) = b.dataset.value!;
        saveSettings();
        paint();
        if (name === 'quality') this.onQuality();
      }));
      paint();
    };
    seg('quality');
    seg('damage');
    for (const k of ['shake', 'ping', 'weather'] as const) {
      const box = $<HTMLInputElement>(`set-${k}`);
      box.checked = settings.display[k];
      box.onchange = () => {
        settings.display[k] = box.checked;
        saveSettings();
      };
    }
    // Son : volumes et coupure (gardés dans ce navigateur), appliqués tout de suite
    for (const k of ['master', 'music', 'sfx'] as const) {
      const input = $<HTMLInputElement>(`vol-${k}`);
      input.value = String(Math.round(sound.settings[k] * 100));
      input.oninput = () => {
        sound.settings[k] = Number(input.value) / 100;
        sound.apply();
      };
    }
    const mute = $<HTMLInputElement>('vol-mute');
    mute.checked = sound.settings.muted;
    mute.onchange = () => {
      sound.settings.muted = mute.checked;
      sound.apply();
    };
    const mode = () => {
      $('atk-auto').setAttribute('aria-checked', String(settings.attack === 'auto'));
      $('atk-click').setAttribute('aria-checked', String(settings.attack === 'click'));
    };
    for (const m of ['auto', 'click'] as const) {
      $(`atk-${m}`).onclick = () => {
        settings.attack = m;
        saveSettings();
        mode();
        this.onAttackMode();
      };
    }
    mode();
    const keymap = () =>
      $('keymap').replaceChildren(
        ...ACTIONS.map((a) => {
          const row = document.createElement('div');
          row.className = 'key-row';
          row.innerHTML = '<span></span><button></button>';
          row.querySelector('span')!.textContent = a.name;
          const btn = row.querySelector('button')!;
          const waiting = this.capturing === a.id;
          btn.className = waiting ? 'wait' : '';
          btn.textContent = waiting ? 'Appuie…' : keyLabel(a.id);
          btn.onclick = () => {
            this.capturing = waiting ? null : a.id;
            keymap();
          };
          return row;
        }),
      );
    this.keymap = keymap;
    keymap();
    $('keys-reset').onclick = () => {
      resetKeys();
      keymap();
    };
    // Touche choisie pour l'action en attente (Échap annule) ; on la retient par son code physique.
    addEventListener('keydown', (e) => {
      const a = this.capturing;
      if (!a) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key !== 'Escape') {
        settings.keys[a] = { code: e.code, label: labelOf(e.code, e.key) };
        saveSettings();
      }
      setTimeout(() => {
        this.capturing = null;
        keymap();
      });
    }, true);
  }
  private founder = false;
  private offline: { name: string; color: string }[] = []; // membres déconnectés (d'après le tableau du village)
  private keymap = () => {};
  onQuality = () => {};

  /** Membres en ligne (le fondateur peut les expulser), puis déconnectés ; comptes bannis (il peut les réintégrer). */
  onProfile = (_color: number, _hat: number) => {};

  /** Profil : aperçu du dompteur, couleurs (celles des autres membres sont prises) et chapeaux. */
  private updateProfile(me: PlayerState, players: PlayerState[]) {
    // couleurs déjà prises par un autre membre (en ligne ou endormi au village) : on ne peut pas les choisir
    const takenBy = new Map<string, string>([...this.offline.filter((o) => o.name !== me.name), ...players.filter((p) => p.id !== me.id)].map((o) => [o.color, o.name]));
    const taken = new Set(takenBy.keys());
    const owned = (h: number) => h === 0 || (me.hats ?? []).includes(h);
    const key = JSON.stringify([me.color, me.hat, me.hats, me.armor, me.cls, [...taken], HAT_PRICES.map((c) => me.gold >= c)]);
    if (key === this.last.profile) return;
    this.last.profile = key;
    const color = PLAYER_COLORS.indexOf(me.color), armed = (me.sword ?? SWORD_PULLS) >= SWORD_PULLS;
    const paint = (canvas: HTMLCanvasElement, hat: number, scale: number, name: string) => {
      const ctx = canvas.getContext('2d')!, w = canvas.width, h = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.setTransform(scale, 0, 0, scale, w / 2, h * 0.72);
      drawPlayer(ctx, 0, 0, me.color, 0.4, 0.9, me.armor, name, 0, false, false, false, false, me.cls, null, me.weapon, armed, hat);
    };
    paint($<HTMLCanvasElement>('profile-preview'), me.hat, 2.4, '');
    $('profile-colors').replaceChildren(...PLAYER_COLORS.map((c, i) => {
      const b = document.createElement('button');
      const off = taken.has(c) && i !== color;
      b.className = `swatch${off ? ' taken' : ''}`;
      b.style.background = c;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === color));
      b.setAttribute('aria-label', off ? `Couleur prise par ${takenBy.get(c)}` : `Couleur ${i + 1}`);
      b.title = off ? `Prise par ${takenBy.get(c)}` : '';
      b.disabled = off;
      if (!off) b.onclick = () => this.onProfile(i, me.hat);
      return b;
    }));
    // du moins cher au plus cher (tête nue d'abord)
    const byPrice = HATS.map((_, i) => i).sort((a, b) => HAT_PRICES[a] - HAT_PRICES[b]);
    $('profile-hats').replaceChildren(...byPrice.map((i) => {
      const name = HATS[i];
      const b = document.createElement('button');
      b.className = 'hat-btn';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(i === me.hat));
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 112;
      cv.setAttribute('aria-hidden', 'true');
      paint(cv, i, 2, '');
      const label = document.createElement('span'), price = document.createElement('span');
      label.textContent = name;
      // à acheter : son prix (en rouge s'il manque de l'or) ; déjà à lui : il le porte d'un clic
      price.className = `small ${owned(i) ? 'muted' : me.gold >= HAT_PRICES[i] ? 'hat-price' : 'hat-price short'}`;
      price.textContent = i === me.hat ? 'Porté' : owned(i) ? (i ? 'Acheté' : 'Gratuit') : `${HAT_PRICES[i]} or`;
      b.append(cv, label, price);
      b.setAttribute('aria-label', `${name} — ${price.textContent}`);
      b.disabled = !owned(i) && me.gold < HAT_PRICES[i];
      b.onclick = () => this.onProfile(color, i);
      return b;
    }));
  }

  private updateMembers(me: PlayerState, players: PlayerState[]) {
    const key = JSON.stringify([players.map((p) => [p.id, p.name]), this.offline, this.banned]);
    if (key === this.last.members) return;
    this.last.members = key;
    const away = this.offline.filter((o) => !players.some((p) => p.name === o.name)).map((o) => {
      const row = document.createElement('div');
      row.className = 'stone-row';
      row.innerHTML = '<div class="col"><b></b><span class="small muted">Hors ligne</span></div>';
      const b = row.querySelector('b')!;
      b.textContent = o.name;
      b.style.color = o.color;
      return row;
    });
    $('members').replaceChildren(
      ...players.map((p) => {
        const row = document.createElement('div');
        row.className = 'stone-row';
        row.innerHTML = '<div class="col"><b></b><span class="small muted"></span></div>';
        const b = row.querySelector('b')!;
        b.textContent = p.name;
        b.style.color = p.color;
        row.querySelector('.small')!.textContent = p.id === me.id ? (this.founder ? 'Toi · fondateur' : 'Toi') : 'En ligne';
        if (this.founder && p.id !== me.id) {
          const kick = document.createElement('button');
          kick.className = 'kick';
          kick.textContent = 'Expulser';
          kick.onclick = () => {
            if (!kick.classList.contains('sure')) {
              kick.classList.add('sure');
              kick.textContent = 'Confirmer : bannir';
              setTimeout(() => {
                kick.classList.remove('sure');
                kick.textContent = 'Expulser';
              }, 3000);
              return;
            }
            this.onKick(p.id);
          };
          row.append(kick);
        }
        return row;
      }),
      ...away,
    );
    $('banned-box').hidden = !this.founder || !this.banned.length;
    $('banned').replaceChildren(
      ...this.banned.map((u) => {
        const row = document.createElement('div');
        row.className = 'stone-row';
        row.innerHTML = '<div class="col"><b></b><span class="small muted">Banni · sa progression est gardée</span></div><button class="cta">Débannir</button>';
        row.querySelector('b')!.textContent = u.name;
        row.querySelector('button')!.onclick = () => this.onUnban(u.id);
        return row;
      }),
    );
  }

  /** Tableau du village reçu du serveur : une colonne par membre, une ligne par exploit, couronne pour le premier de chaque ligne. */
  board(rows: BoardRow[]) {
    this.offline = rows.filter((r) => !r.online).map((r) => ({ name: r.name, color: r.color })); // pour la liste des membres
    rows.sort((a, b) => b.bosses - a.bosses || b.kills - a.kills || b.tamed - a.tamed || b.given - a.given);
    const head = document.createElement('tr'), corner = document.createElement('th');
    head.append(corner);
    for (const r of rows) {
      const th = document.createElement('th');
      th.scope = 'col';
      const b = document.createElement('b');
      b.textContent = r.name;
      b.style.color = r.color;
      th.append(b);
      head.append(th);
    }
    $('board-head').replaceChildren(head);
    $('board-rows').replaceChildren(
      ...BOARD.flatMap(({ title, stats }) => {
        // une ligne de titre par catégorie, sur toute la largeur
        const head = document.createElement('tr'), cell = document.createElement('th');
        head.className = 'board-cat';
        cell.colSpan = rows.length + 1;
        cell.textContent = title;
        head.append(cell);
        return [head, ...stats.map(({ k, label, fmt, low }) => {
          const tr = document.createElement('tr'), vals = rows.map((r) => r[k] ?? 0);
          // couronne : le premier (le moins de chutes, pour les chutes), s'il y a quelque chose à départager
          const top = low ? Math.min(...vals) : Math.max(1, ...vals), shared = vals.filter((v) => v === top).length === rows.length;
          const th = document.createElement('th');
          th.scope = 'row';
          th.textContent = label;
          tr.append(th);
          for (const v of vals) {
            const td = document.createElement('td'), lead = v === top && !(low && shared);
            td.className = lead ? 'top' : '';
            td.textContent = `${lead ? '👑 ' : ''}${(fmt ?? num)(v)}`;
            tr.append(td);
          }
          return tr;
        })];
      }),
    );
  }
  onBoard = () => {};

  /** Nouveau message : gardé dans l'historique ; chat fermé, seul le compteur du bouton 💬 le signale. */
  chat(name: string, color: string, text: string, mine: boolean) {
    this.chatLog.push({ name, color, text });
    if (this.chatLog.length > 60) this.chatLog.shift();
    if (this.panel === 'chat') return this.renderChat();
    if (mine) return;
    this.unread++;
    $('chat-unread').hidden = false;
    $('chat-unread').textContent = String(Math.min(this.unread, 99));
  }

  private renderChat() {
    const log = $('chat-log');
    log.replaceChildren(
      ...(this.chatLog.length
        ? this.chatLog.map((m) => {
          const p = document.createElement('p');
          const b = document.createElement('b');
          b.textContent = m.name;
          b.style.color = m.color;
          p.append(b, m.text);
          return p;
        })
        : [Object.assign(document.createElement('p'), { className: 'empty', textContent: 'Aucun message pour l\'instant.' })]),
    );
    log.scrollTop = log.scrollHeight;
  }
  private chatLog: { name: string; color: string; text: string }[] = [];
  private unread = 0;
  onChat = (_text: string) => {};

  /** Zone ouverte pour le village : la zone 1, puis chaque zone dont la porte est ouverte. */
  private zoneOpen(z: number) {
    if (z === VOLCANO_ZONE) return volcanoOpen(this.beaten);
    return z <= 1 || gateOpen(z - 1, this.hall, this.told);
  }

  private funds(me: PlayerState): Funds {
    return { gold: me.gold, wood: this.stock[0], stone: this.stock[1] };
  }

  /** Pastilles de coût : en rouge ce qui manque encore. */
  private costChips(id: string, me: Funds, c: Cost) {
    $(id).replaceChildren(
      ...([['gold', 'or'], ['wood', 'bois'], ['stone', 'pierre']] as const).filter(([k]) => c[k] > 0).map(([k, label]) => {
        const el = document.createElement('span');
        el.className = me[k] >= c[k] ? 'ok' : 'miss';
        el.textContent = `${c[k]} ${label}`;
        return el;
      }),
    );
  }

  /** Hôtel de ville : ses niveaux (ce que chacun débloque), le prochain à payer, et l'état des portes des zones. */
  private updateHall(me: PlayerState) {
    const funds = this.funds(me);
    $('hall-title').textContent = this.vname ? `Hôtel de ville · ${this.vname}` : 'Hôtel de ville';
    $('hall-have').textContent = this.hall ? `Niveau ${this.hall}/${HALL_MAX}` : 'À construire : donne un nom au village';
    // à la construction : le nom à donner ; ensuite : le nom actuel, modifiable (sans écraser ce qu'on est en train de taper)
    const input = $<HTMLInputElement>('hall-name'), built = this.hall > 0;
    setHidden($('hall-rename'), !built);
    if (built && document.activeElement !== input && input.dataset.shown !== this.vname) {
      input.value = this.vname;
      input.dataset.shown = this.vname;
    }
    const btnRename = $<HTMLButtonElement>('hall-rename'), typed = input.value.replace(/\s+/g, ' ').trim();
    btnRename.disabled = !typed || typed === this.vname;
    const maxed = this.hall >= HALL_MAX, cost = HALL[this.hall];
    $('hall-cost').hidden = maxed;
    if (!maxed) this.costChips('hall-cost', funds, cost);
    const btn = $<HTMLButtonElement>('hall-up');
    const camp = this.hall > 0 || this.buildings.includes('palisade'); // le camp d'abord : la palissade
    btn.disabled = maxed || !camp || !canPay(funds, cost);
    btn.textContent = maxed ? 'Niveau maximum' : !camp ? 'Construis d\'abord la palissade' : !canPay(funds, cost) ? 'Il manque des ressources' : this.hall ? `Passer au niveau ${this.hall + 1}` : 'Construire et nommer le village';
  }

  /** Marché : vendre les monstres ordinaires de sa meute, acheter ceux des espèces déjà croisées. */
  private updateMarket(me: PlayerState) {
    const pack = me.army.filter((a) => !a.alpha);
    const key = JSON.stringify([this.hall, this.beaten, me.gold, me.seen, pack.map((a) => a.id)]);
    if (key !== this.last.market) {
      this.last.market = key;
      this.buildMarket(me, pack);
    }
    paintPortraits(this.wares);
  }

  private buildMarket(me: PlayerState, pack: PlayerState['army']) {
    this.wares = [];
    const row = (s: number, sub: string, btn: HTMLButtonElement) => {
      const el = document.createElement('div');
      el.className = 'stone-row';
      el.innerHTML = '<canvas class="ware"></canvas><div class="col"><b></b><span class="small muted"></span></div>';
      const canvas = el.querySelector('canvas')!;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', SPECIES[s].name);
      this.wares.push({ canvas, s, seen: true, tame: true }); // apprivoisé : sans l'anneau ni le regard des sauvages
      el.querySelector('b')!.textContent = SPECIES[s].name;
      el.querySelector('span.small')!.textContent = sub;
      el.append(btn);
      return el;
    };
    // Vendre : un rang par espèce de la meute (on vend un monstre à la fois).
    const owned = [...new Set(pack.map((a) => a.species))];
    $('market-sell').replaceChildren(
      ...(owned.length
        ? owned.map((s) => {
          const mine = pack.filter((a) => a.species === s);
          const btn = document.createElement('button');
          btn.className = 'cta';
          btn.dataset.sell = String(mine[0].id);
          btn.textContent = `Vendre · +${monsterSellPrice(s)} or`;
          return row(s, `${mine.length} dans ta meute`, btn);
        })
        : [Object.assign(document.createElement('p'), { className: 'small muted', textContent: 'Ta meute est vide : apprivoise des monstres pour les vendre ici.' })]),
    );
    // Acheter : espèces déjà croisées (bestiaire), dans la limite de la meute.
    const full = pack.length >= armyCap(me.learned);
    const known = SPECIES_BY_ZONE.filter((s) => !SPECIES[s].boss && me.seen.includes(s) && this.zoneOpen(SPECIES[s].zone));
    $('market-buy').replaceChildren(
      ...(known.length
        ? known.map((s) => {
          const price = monsterBuyPrice(s);
          const btn = document.createElement('button');
          btn.className = 'cta';
          btn.dataset.buy = String(s);
          btn.disabled = full || me.gold < price;
          btn.textContent = full ? 'Meute pleine' : me.gold < price ? `Il te faut ${price} or` : `Acheter · ${price} or`;
          const sp = SPECIES[s], tamed = (n: number, k: number) => Math.max(1, Math.round(n * k)); // mêmes stats que dans la meute
          return row(s, `Zone ${sp.zone} · ${tamed(sp.hp, TAMED_HP_MULT)} PV · ${tamed(sp.dmg, TAMED_MULT)} dégâts`, btn);
        })
        : [Object.assign(document.createElement('p'), { className: 'small muted', textContent: 'Aucune espèce croisée pour l\'instant.' })]),
    );
  }

  private updateForge(me: PlayerState) {
    // Classe : la première est gratuite, changer ensuite coûte un peu d'or.
    const cost = me.cls === null ? 0 : CLASS_CHANGE_COST;
    $('class-hint').textContent = me.cls === null ? 'Choisis ta classe : le premier choix est gratuit.' : '';
    const classKey = `${me.cls}|${me.gold >= cost}`;
    if (classKey !== this.last.cls) {
      this.last.cls = classKey;
      $('classes').replaceChildren(
        ...CLASS_IDS.map((id) => {
          const c = CLASSES[id], on = me.cls === id;
          const el = document.createElement('button');
          el.className = `class-card${on ? ' on' : ''}`;
          el.disabled = on || me.gold < cost;
          el.innerHTML = '<b></b><span></span><span class="tag"></span>';
          el.querySelector('b')!.textContent = c.name;
          el.querySelector('span')!.textContent = c.desc;
          el.querySelector('span')!.hidden = !c.desc; // seul le guerrier a une particularité à dire
          el.querySelector('.tag')!.textContent = on ? 'Classe actuelle' : cost ? `Choisir · ${cost} or` : 'Choisir · gratuit';
          el.onclick = () => this.onClass(id);
          return el;
        }),
      );
    }
    this.updateSpecs(me);
    const next = (a: string, b: string, maxed: boolean) => (maxed ? a : `${a} → <span class="up">${b}</span>`);
    // l'or du dompteur, et le bois de son sac puis de l'entrepôt du village
    const wood = me.wood + this.stock[0];
    const buy = (id: string, what: Gear, lvl: number, verb = 'Améliorer') => {
      const btn = $<HTMLButtonElement>(id), maxed = lvl >= gearMax(what), c = gearCost(what, lvl);
      const miss = [c.gold > me.gold && `${c.gold - me.gold} or`, c.wood > wood && `${c.wood - wood} bois`].filter(Boolean).join(' · ');
      btn.disabled = maxed || !!miss;
      btn.textContent = maxed ? 'Niveau maximum' : miss ? `Il manque ${miss}` : `${verb} · ${costText(c)}`;
    };

    const w = me.weapon, wMax = w >= WEAPON_MAX, hero = heroOf(me.cls, me.spec);
    const k = hero.dmg, locked = w >= SPEC_LVL && !me.spec; // au-delà du niveau 10 : une spécialisation d'abord
    $('weapon-name').textContent = `${weaponName(me.cls, me.spec, w)} · niv. ${w}`;
    $('weapon-dmg').innerHTML = next(String(Math.round(weaponDmg(w) * k)), String(Math.round(weaponDmg(w + 1) * k)), wMax || locked);
    $('weapon-next').textContent = wMax ? '—' : locked ? 'Spécialisation à choisir' : weaponName(me.cls, me.spec, w + 1);
    // Icône d'arme selon la classe (épée, arc ou bâton), teintée selon le niveau.
    const icon = $('weapon-icon');
    for (const g of icon.querySelectorAll<SVGGElement>('g[data-cls]')) g.toggleAttribute('hidden', g.dataset.cls !== (me.cls ?? 'warrior'));
    const tier = armorColor(w);
    icon.querySelectorAll('.tier').forEach((el) => el.setAttribute('fill', me.cls === 'mage' && w < 3 ? '#D9C6FF' : tier));
    icon.querySelectorAll('.tier-stroke').forEach((el) => el.setAttribute('stroke', tier));
    buy('weapon-buy', 'weapon', w);
    if (locked && !wMax) {
      const btn = $<HTMLButtonElement>('weapon-buy');
      btn.disabled = true;
      btn.textContent = this.buildings.includes('forge2') ? 'Choisis une spécialisation' : 'Grande forge requise';
    }

    const a = me.armor, aMax = a >= ARMOR_MAX;
    $('armor-name').textContent = `${ARMOR_NAMES[a]} · niv. ${a}`;
    const hpK = heroOf(me.cls, me.spec).hp; // PV selon la classe (guerrier +25 %, archer −10 %, mage −15 %) et la spécialisation
    $('armor-hp').innerHTML = next(String(Math.round(armorMaxHp(a) * hpK)), String(Math.round(armorMaxHp(a + 1) * hpK)), aMax);
    $('armor-red').innerHTML = next(pct(armorReduction(a)), pct(armorReduction(a + 1)), aMax);
    // Icône d'armure : tunique (robe à capuche pour le mage), cuir (clouté au niveau 2), puis métal.
    const look = a === 0 ? (me.cls === 'mage' ? 'robe' : 'tunic') : a <= 2 ? 'leather' : 'metal';
    for (const g of $('armor-icon').querySelectorAll<SVGGElement>('g[data-look]')) g.toggleAttribute('hidden', g.dataset.look !== look);
    $('armor-icon').querySelector('.studs')!.toggleAttribute('hidden', a !== 2);
    $('armor-shape').setAttribute('fill', armorColor(a));
    buy('armor-buy', 'armor', a);

    // Torche : rien au niveau 0 (on n'éclaire pas la nuit), torche puis lanterne.
    const tl = me.torch, tMax = tl >= TORCH_MAX;
    $('torch-name').textContent = tl ? `${TORCH_NAMES[tl]} · niv. ${tl}` : 'Aucune';
    $('torch-r').innerHTML = next(tl ? `${torchRadius(tl)} px` : 'aucune', `${torchRadius(tl + 1)} px`, tMax);
    const tIcon = $('torch-icon'), lantern = tl >= 3;
    for (const g of tIcon.querySelectorAll<SVGGElement>('g[data-look]')) g.toggleAttribute('hidden', g.dataset.look !== (lantern ? 'lantern' : 'torch'));
    tIcon.querySelectorAll('.frame').forEach((el) => el.setAttribute('fill', tl === 4 ? '#B87333' : tl >= 5 ? '#6E7570' : '#4A4E52'));
    tIcon.querySelector('.glow')!.setAttribute('fill', tl >= 5 ? '#BDF2FF' : '#F7D774');
    tIcon.style.opacity = tl ? '1' : '0.45';
    buy('torch-buy', 'torch', tl, tl ? 'Améliorer' : 'Acheter');

    // Bottes : +2 % de vitesse à pied par niveau.
    const b = me.boots, bMax = b >= BOOTS_MAX;
    $('boots-name').textContent = `${BOOTS_NAMES[b]} · niv. ${b}`;
    const sp = (l: number) => `+${Math.round((bootsSpeed(l) - 1) * 100)} %`;
    $('boots-speed').innerHTML = next(sp(b), sp(b + 1), bMax);
    $('boots-shape').setAttribute('fill', b ? armorColor(b) : '#8B5E3C');
    $('boots-icon').style.opacity = b ? '1' : '0.45';
    buy('boots-buy', 'boots', b, b ? 'Améliorer' : 'Acheter');

    // Selle : sans elle, on ne monte pas ; ensuite, +4 % de vitesse en selle par niveau.
    const sd = me.saddle ?? 0, sdMax = sd >= SADDLE_MAX;
    $('saddle-name').textContent = sd ? `${SADDLE_NAMES[sd]} · niv. ${sd}` : 'Aucune';
    const ss = (l: number) => `+${Math.round((saddleSpeed(l) - 1) * 100)} %`;
    $('saddle-line').hidden = !sd; // sans selle : rien à dire de la vitesse
    $('saddle-speed').innerHTML = next(ss(sd), ss(sd + 1), sdMax);
    $('saddle-shape').setAttribute('fill', sd > 1 ? armorColor(sd) : '#8B5E3C');
    $('saddle-icon').style.opacity = sd ? '1' : '0.45';
    buy('saddle-buy', 'saddle', sd, sd ? 'Améliorer' : 'Acheter');
  }

  /**
   * Grande forge : à construire pour le village (Hôtel de ville niv. 4), puis les deux spécialisations de sa classe,
   * à choisir une fois l'arme au niveau 10 (la première gratuitement, ensuite contre de l'or).
   */
  private updateSpecs(me: PlayerState) {
    const built = this.buildings.includes('forge2'), b = BUILDINGS.forge2, cost = buildingCost('forge2'), funds = this.funds(me);
    $('forge2-build').hidden = built;
    $('specs').hidden = !built;
    $('spec-title').textContent = built ? (me.spec ? `Spécialisation · ${SPECS[me.spec].name}` : 'Spécialisation') : b.name;
    $('spec-hint').textContent = !built ? `Hôtel de ville niv. ${b.hall}` : !me.cls ? 'Choisis d\'abord ta classe' : me.weapon < SPEC_LVL ? `Arme niv. ${SPEC_LVL} requise` : me.spec ? '' : 'Le premier choix est gratuit';
    if (!built) {
      this.costChips('forge2-cost', funds, cost);
      const btn = $<HTMLButtonElement>('forge2-go');
      btn.disabled = this.hall < b.hall || !canPay(funds, cost);
      btn.textContent = this.hall < b.hall ? `Hôtel de ville niv. ${b.hall} requis` : !canPay(funds, cost) ? 'Il manque des ressources' : 'Améliorer la forge pour le village';
      return;
    }
    const price = me.spec === null ? 0 : SPEC_CHANGE_COST, ready = !!me.cls && me.weapon >= SPEC_LVL;
    const key = `${me.cls}|${me.spec}|${ready}|${me.gold >= price}`;
    if (key === this.last.spec) return;
    this.last.spec = key;
    $('specs').replaceChildren(
      ...SPEC_IDS.filter((id) => SPECS[id].cls === (me.cls ?? 'warrior')).map((id) => {
        const s = SPECS[id], on = me.spec === id;
        const el = document.createElement('button');
        el.className = `class-card${on ? ' on' : ''}`;
        el.disabled = on || !ready || me.gold < price;
        el.innerHTML = '<b></b><span></span><span class="tag"></span>';
        el.querySelector('b')!.textContent = s.name;
        el.querySelector('span')!.textContent = s.desc;
        el.querySelector('.tag')!.textContent = on ? 'Spécialisation actuelle' : !ready ? 'Pas encore' : price ? `Choisir · ${price} or` : 'Choisir · gratuit';
        el.onclick = () => this.onSpec(id);
        return el;
      }),
    );
  }

  /**
   * Bestiaire de la Tanière, sous la forme choisie : sauvage, Alpha (niv. 0), légendaire (espèces qui ont un géant)
   * ou géant. Les espèces déjà croisées sont décrites, les autres en silhouette ; un géant se dévoile une fois vaincu par le village.
   */
  private updateBestiary(me: PlayerState) {
    const form = this.form;
    const all = form === 'boss' ? SPECIES_BY_ZONE.filter((s) => SPECIES[s].boss)
      : SPECIES_BY_ZONE.filter((s) => !SPECIES[s].boss && (form !== 'legend' || bossOf(s) >= 0));
    const seen = new Set(form === 'boss' ? this.beaten : me.seen);
    // Alphas possédés (sur le terrain ou au repos), et ceux qui ont fait leur double éveil
    const owned = [...me.army.filter((a) => a.alpha).map((a) => ({ s: a.species, legend: a.legend })), ...me.resting.map((r) => ({ s: r.species, legend: r.legend }))];
    const awake = new Set(owned.map((o) => o.s)), double = new Set(owned.filter((o) => o.legend).map((o) => o.s));
    const key = `${form}|${all.filter((s) => seen.has(s)).join(',')}|${[...awake].join(',')}|${[...double].join(',')}`;
    if (key !== this.last.bestiary) {
      this.last.bestiary = key;
      const count = (set: Set<number>) => all.filter((s) => set.has(s)).length;
      $('bestiary-count').innerHTML = form === 'boss' ? `<b>${count(seen)}/${all.length}</b> géants vaincus par le village`
        : form === 'alpha' ? `<b>${count(awake)}/${all.length}</b> éveillés`
        : form === 'legend' ? `<b>${count(double)}/${all.length}</b> double éveillés`
        : `<b>${count(seen)}/${all.length}</b> espèces rencontrées`;
      this.beasts = [];
      const zones = [...new Set(all.map((s) => SPECIES[s].zone))];
      $('bestiary').replaceChildren(
        ...zones.flatMap((z) => {
          const title = document.createElement('h3');
          title.className = 'bestiary-zone';
          title.textContent = `Zone ${z} · ${ZONE_NAMES[z - 1]}`;
          const row = document.createElement('div');
          row.className = 'bestiary-row';
          for (const s of all.filter((i) => SPECIES[i].zone === z)) {
            const known = seen.has(s), card = beastCard(s, form);
            const el = document.createElement('div');
            el.className = `beast ${form}${known ? '' : ' unknown'}`;
            el.innerHTML = '<canvas></canvas><b></b><span class="tag"></span><span class="stats"></span><span class="desc"></span>';
            el.querySelector('b')!.textContent = known ? card.name : '???';
            el.querySelector('.tag')!.textContent = known ? card.tag : '';
            el.querySelector('.stats')!.textContent = known ? card.stats : '';
            el.querySelector('.desc')!.textContent = known ? card.desc : form === 'boss' ? 'Pas encore vaincu.' : 'Pas encore croisé.';
            const canvas = el.querySelector('canvas')!;
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', known ? card.name : 'Espèce inconnue');
            this.beasts.push({ canvas, s, seen: known, alpha: form === 'alpha' || form === 'legend', legend: form === 'legend' });
            row.append(el);
          }
          return [title, row];
        }),
      );
    }
    paintPortraits(this.beasts);
  }

  private updateDen(me: PlayerState) {
    const key = JSON.stringify([this.hall, this.beaten, me.mount?.id, me.awakening, me.essences, me.resting, me.seen, me.army.filter((a) => a.alpha).map((a) => [a.id, a.level, a.legend, a.reviveIn > 0])]);
    if (key !== this.last.den) {
      this.last.den = key;
      this.buildDen(me);
    }
    paintPortraits(this.portraits);
  }

  private buildDen(me: PlayerState) {
    this.portraits = [];

    // Bonus de collection : chaque Alpha éveillé renforce les autres de 5 %.
    const equipped = me.army.filter((x) => x.alpha).length, equipMax = alphaEquipMax(me.learned);
    const count = equipped + me.resting.length; // le bonus compte tous les Alphas possédés, équipés ou non
    $('collection').innerHTML = (count
      ? `Bonus de collection : <b>+${Math.round((collectionMult(count) - 1) * 100)} %</b> PV et dégâts`
      : 'Bonus de collection : chaque Alpha éveillé donnera +5 % de PV et de dégâts à tous tes Alphas.')
      + `<br>Équipés : <b>${equipped}/${equipMax}</b>`;

    // Une carte par espèce déjà rencontrée (ou dont on a déjà l'Alpha) : éveiller son Alpha, puis le renforcer.
    // espèces croisées dont la zone est ouverte (un Alpha déjà possédé reste visible, même d'une zone fermée)
    const owned = (s: number) => me.army.some((x) => x.alpha && x.species === s) || me.resting.some((x) => x.species === s) || me.awakening.some((w) => w.species === s);
    const known = SPECIES_BY_ZONE.filter((s) => !SPECIES[s].boss && (owned(s) || (me.seen.includes(s) && this.zoneOpen(SPECIES[s].zone))));
    if (!known.length) {
      $('alphas').replaceChildren(Object.assign(document.createElement('p'), { className: 'small muted', textContent: 'Aucune espèce rencontrée pour l\'instant : pars à la chasse, chaque espèce croisée pourra éveiller son Alpha ici.' }));
      return;
    }
    $('alphas').replaceChildren(
      ...known.map((s) => {
        const sp = SPECIES[s];
        // Alpha possédé : équipé (sur le terrain) ou rangé à la Tanière.
        const field = me.army.find((x) => x.alpha && x.species === s);
        const rest = me.resting.find((x) => x.species === s);
        const a = field ?? (rest ? { id: 0, level: rest.level, legend: rest.legend, reviveIn: 0 } : undefined);
        const lvl = a?.level ?? 0;
        // stats affichées avec le bonus de collection (en comptant cet Alpha s'il n'est pas encore là)
        const stat = (l: number) => alphaStats(s, l, a ? count : count + 1, a?.legend);
        const maxed = !!a && lvl >= ALPHA_LVL_MAX;
        const cost = a ? alphaUpCost(s, lvl) : alphaCreateCost(s);
        const unit = 'essences';
        const have = me.essences[s];
        const el = document.createElement('div');
        el.className = `alpha-card${a ? '' : ' asleep'}`;
        el.innerHTML = `<canvas class="portrait"></canvas><div class="col"><span class="title"></span><div class="stat-rows"></div>
          <div class="ess"><div class="ess-bar"><i></i><span></span></div></div></div><div class="actions"><button class="buy"></button></div>`;
        const canvas = el.querySelector('canvas')!;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${sp.name} alpha`);
        this.portraits.push({ canvas, s, seen: true, alpha: true, legend: !!a?.legend });
        el.querySelector('.title')!.textContent = a
          ? `${a.legend ? `${sp.name} légendaire` : `${sp.name} alpha`} · niv. ${lvl}${a.reviveIn ? ' (ressuscite…)' : ''}${rest ? ' · au repos' : ''}`
          : `${sp.name} alpha`;
        const now = stat(lvl), nxt = stat(lvl + 1);
        // Une ligne par statistique, avec la valeur au niveau suivant quand on peut renforcer.
        const grow = (a1: number, b1: number) => (a && !maxed ? `${a1} → <span class="up">${b1}</span>` : String(a1));
        const rows: [keyof typeof ICONS, string, string][] = [
          ['hp', 'PV', grow(now.hp, nxt.hp)],
          ['dmg', 'Dégâts', grow(now.dmg, nxt.dmg)],
          ['revive', 'Résurrection', `${alphaReviveS(s)} s`],
        ];
        if (MOUNTS[sp.key]) rows.push(['mount', 'Monture', `vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}${SWIM_MOUNTS.has(sp.key) ? ' · sur l\'eau' : FLY_MOUNTS.has(sp.key) ? ' · en vol' : ''}`]);
        const perk = alphaPerk(s, lvl), perkNext = alphaPerk(s, lvl + 1);
        if (perk && perkNext) {
          const grow1 = (v: number, w: number, f: (n: number) => string) => (a && !maxed ? `${f(v)} → <span class="up">${f(w)}</span>` : f(v));
          rows.push(perk.kind === 'guard'
            ? ['guard', 'Carapace', grow1(perk.value, perkNext.value, (n) => `−${pctLabel(n)} dégâts reçus`)]
            : perk.kind === 'rally'
              ? ['rally', 'Cri', grow1(perk.value, perkNext.value, (n) => `+${pctLabel(n)} dégâts`)]
              : ['heal', 'Soigne', grow1(perk.value, perkNext.value, (n) => `${pctLabel(n)} PV / ${ALPHA_HEAL_S} s`)]);
        }
        el.querySelector('.stat-rows')!.innerHTML = rows
          .map(([icon, label, value]) => `<div class="stat-row ${icon}">${ICONS[icon]}<span>${label}</span><b>${value}</b></div>`)
          .join('');
        (el.querySelector('.ess-bar i') as HTMLElement).style.width = `${maxed ? 100 : Math.min(100, (100 * have) / cost)}%`;
        el.querySelector('.ess span')!.textContent = maxed ? `${have} ${unit}` : `${have} / ${cost} ${unit}`; // dans la jauge
        if (a?.legend) el.classList.add('legend');
        const waking = me.awakening.find((w) => w.species === s);
        if (waking) {
          // Éveil en cours : compte à rebours à la place de la jauge d'essences.
          el.className = 'alpha-card waking';
          el.querySelector('.title')!.textContent = `${sp.name} alpha · éveil en cours`;
          (el.querySelector('.ess-bar i') as HTMLElement).style.width = `${(100 * (waking.total - waking.left)) / waking.total}%`;
          const mm = Math.floor(waking.left / 60), ss = String(waking.left % 60).padStart(2, '0');
          el.querySelector('.ess span')!.textContent = `S'éveille dans ${mm}:${ss}`;
        }
        const btn = el.querySelector<HTMLButtonElement>('.buy')!;
        if (a) btn.dataset.up = String(s);
        else btn.dataset.create = String(s);
        if (rest) el.classList.add('resting');
        btn.disabled = maxed || have < cost || !!waking;
        btn.textContent = maxed ? 'Niveau maximum' : a ? 'Renforcer' : waking ? 'Éveil…' : `Éveiller · ${duration(alphaAwakenS(s))}`;
        // Double éveil (Alpha légendaire) : les âmes du géant de l'espèce, dans une jauge sous celle des essences.
        const boss = bossOf(s);
        if (a && !a.legend && boss >= 0) {
          const souls = me.essences[boss] ?? 0;
          const why = `Double éveil : PV et dégâts ×${String(LEGEND_MULT.hp).replace('.', ',')}, aura dorée. Bats ${SPECIES[boss].name} dans sa grotte pour obtenir son âme.`;
          const gauge = document.createElement('div');
          gauge.className = 'ess double';
          gauge.title = why;
          gauge.innerHTML = '<div class="ess-bar"><i></i><span></span></div>';
          (gauge.querySelector('i') as HTMLElement).style.width = `${Math.min(100, (100 * souls) / LEGEND_SOULS)}%`;
          gauge.querySelector('span')!.textContent = `Double éveil · ${Math.min(souls, LEGEND_SOULS)} / ${LEGEND_SOULS} âmes`; // de quel géant : dans l'infobulle
          el.querySelector('.col')!.append(gauge);
          const leg = document.createElement('button');
          leg.className = 'legend-btn';
          leg.dataset.legend = String(s);
          leg.disabled = souls < LEGEND_SOULS;
          leg.textContent = 'Double éveil';
          leg.title = why;
          el.querySelector('.actions')!.append(leg);
        }
        // Équiper (5 au maximum sur le terrain, 6 avec le tome du volcan) ou ranger à la Tanière.
        if (a) {
          const eq = document.createElement('button');
          eq.className = `equip${rest && equipped >= equipMax ? ' full' : ''}`; // plus de place : grisé
          eq.dataset.s = String(s);
          eq.dataset.equip = rest ? '1' : '0';
          eq.disabled = !!rest && equipped >= equipMax;
          eq.textContent = rest ? (equipped >= equipMax ? `${equipMax}/${equipMax} équipés` : 'Équiper') : 'Déséquiper';
          el.querySelector('.actions')!.append(eq);
        }
        return el;
      }),
    );
  }

  /** Fond de la minicarte (zones + lacs), calculé une seule fois à partir de la carte. */
  private renderMapBackground(S: number) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(S, S);
    const k = (WORLD_HALF * 2) / S;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = -WORLD_HALF + (i + 0.5) * k, y = -WORLD_HALF + (j + 0.5) * k;
        const col = this.map.isSea(x, y) ? seaColor(this.map, x, y) : this.map.isWater(x, y) ? [46, 101, 116] : landColor(this.map, x, y);
        const o = (j * S + i) * 4;
        img.data[o] = col[0] * 0.8;
        img.data[o + 1] = col[1] * 0.8;
        img.data[o + 2] = col[2] * 0.8;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // le pont de bois jusqu'à l'îlot du village
    const { a, b } = this.map.bridge, m = (v: number) => (v + WORLD_HALF) / k;
    ctx.strokeStyle = '#9C7A52';
    ctx.lineWidth = Math.max(1.5, BRIDGE_W / k);
    ctx.beginPath();
    ctx.moveTo(m(a.x), m(a.y));
    ctx.lineTo(m(b.x), m(b.y));
    ctx.stroke();
    return c;
  }

  private mapHover: { x: number; y: number } | null = null; // souris sur la grande carte (px CSS du canvas)

  /** Grande carte (touche M) : terrain, brouillard, camp, village et dompteurs. */
  private drawBigMap(me: PlayerState, players: PlayerState[], myPos: { x: number; y: number }) {
    const canvas = $<HTMLCanvasElement>('bigmap-canvas');
    const dpr = Math.min(2, devicePixelRatio || 1);
    const S = Math.round(Math.min(canvas.clientWidth, canvas.clientHeight || canvas.clientWidth) * dpr);
    if (!S) return;
    if (canvas.width !== S) canvas.width = canvas.height = S;
    this.bigBg ??= this.renderMapBackground(640);
    const ctx = canvas.getContext('2d')!;
    const k = S / (WORLD_HALF * 2), m = (v: number) => (v + WORLD_HALF) * k;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bigBg, 0, 0, S, S);
    this.fog.draw(ctx, 0, 0, S, S, 0.94);
    const { spawn, village } = this.map;
    ctx.strokeStyle = '#EEE7D7';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(m(spawn.x), m(spawn.y), 6 * dpr, 0, Math.PI * 2);
    ctx.stroke();
    this.drawCaves(ctx, m, 8 * dpr);
    this.drawCamps(ctx, m, 7 * dpr);
    this.star(ctx, m(village.x), m(village.y), 11 * dpr, dpr);
    for (const p of players) {
      const x = p.id === me.id ? myPos.x : p.x, y = p.id === me.id ? myPos.y : p.y;
      ctx.fillStyle = p.dead ? '#A9B3A6' : p.color;
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = 2.5 * dpr;
      ctx.beginPath();
      ctx.arc(m(x), m(y), (p.id === me.id ? 7 : 6) * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `600 ${12 * dpr}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3 * dpr;
      ctx.strokeText(p.name, m(x), m(y) - 11 * dpr);
      ctx.fillStyle = '#EEE7D7';
      ctx.fillText(p.name, m(x), m(y) - 11 * dpr);
    }
    // grotte survolée : le petit nom de son géant (« Lueur »)
    const hover = this.mapHover && this.caveUnder(m, this.mapHover.x * dpr, this.mapHover.y * dpr, 14 * dpr);
    if (hover) {
      const x = m(hover.entrance.x), y = m(hover.entrance.y) - 16 * dpr, text = shortTitle(hover.boss);
      ctx.font = `700 ${14 * dpr}px Outfit, sans-serif`;
      const w = ctx.measureText(text).width + 14 * dpr, h = 22 * dpr;
      ctx.fillStyle = 'rgba(16,24,26,0.92)';
      ctx.strokeStyle = '#F0B64A';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h, w, h, 6 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F0B64A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y - h / 2);
      ctx.textBaseline = 'alphabetic';
    }
    canvas.style.cursor = hover ? 'pointer' : '';
    $('explored').textContent = `${Math.round(this.fog.progress * 100)} % de la carte explorée`;
  }

  /** Grottes affichées sur la carte : repérées (hors brouillard), dans une zone ouverte, sur l'île. */
  private shownCaves() {
    return this.map.caves.filter((c) => c.entrance.x < WORLD_HALF && c.zone !== VOYAGE_ZONE && c.open === undefined && this.zoneOpen(c.zone) && this.fog.isExplored(c.entrance.x, c.entrance.y));
  }

  /** Grotte affichée sous ce point de la carte (px du canvas), la plus proche à moins de r, ou null. */
  private caveUnder(m: (v: number) => number, x: number, y: number, r: number) {
    let best: (typeof this.map.caves)[number] | null = null, bd = r * r;
    for (const c of this.shownCaves()) {
      const d = (m(c.entrance.x) - x) ** 2 + (m(c.entrance.y) - y) ** 2;
      if (d < bd) [best, bd] = [c, d];
    }
    return best;
  }

  /** Grottes déjà repérées (hors brouillard, dans une zone ouverte) : arche sombre, avec un sablier tant que son géant n'est pas revenu. */
  private drawCaves(ctx: CanvasRenderingContext2D, m: (v: number) => number, size: number) {
    this.drawVolcanoMark(ctx, m);
    for (const c of this.shownCaves()) {
      const x = m(c.entrance.x), y = m(c.entrance.y);
      ctx.fillStyle = '#2A2E2D';
      ctx.strokeStyle = '#C9CFC2';
      ctx.lineWidth = size * 0.3;
      ctx.beginPath();
      ctx.moveTo(x - size, y + size * 0.7);
      ctx.lineTo(x - size, y - size * 0.2);
      ctx.arc(x, y - size * 0.2, size, Math.PI, 0);
      ctx.lineTo(x + size, y + size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (this.caves[c.id]) {
        // sablier : le géant ressuscite
        const w = size * 0.42, h = size * 0.55, cy = y + size * 0.05;
        ctx.fillStyle = '#E8D9B0';
        ctx.beginPath();
        ctx.moveTo(x - w, cy - h);
        ctx.lineTo(x + w, cy - h);
        ctx.lineTo(x, cy);
        ctx.lineTo(x + w, cy + h);
        ctx.lineTo(x - w, cy + h);
        ctx.lineTo(x, cy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#F0B64A'; // le sable qui reste en haut, et celui tombé en bas
        ctx.beginPath();
        ctx.moveTo(x - w * 0.5, cy - h * 0.5);
        ctx.lineTo(x + w * 0.5, cy - h * 0.5);
        ctx.lineTo(x, cy);
        ctx.closePath();
        ctx.moveTo(x - w * 0.75, cy + h);
        ctx.lineTo(x + w * 0.75, cy + h);
        ctx.lineTo(x, cy + h * 0.45);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** Le volcan, une fois repéré : sa base à l'échelle de la carte, le cratère rougeoyant. */
  private drawVolcanoMark(ctx: CanvasRenderingContext2D, m: (v: number) => number) {
    const v = this.map.volcano;
    if (!this.fog.isExplored(v.x, v.y + VOLCANO_R * VOLCANO_RY)) return;
    const rx = m(v.x + VOLCANO_R) - m(v.x), ry = rx * VOLCANO_RY;
    ctx.fillStyle = '#3A2A22';
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = Math.max(1, rx * 0.12);
    ctx.beginPath();
    ctx.ellipse(m(v.x), m(v.y), rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = volcanoOpen(this.beaten) ? '#FF8A3D' : '#B8541E';
    ctx.beginPath();
    ctx.ellipse(m(v.x), m(v.y), rx * 0.32, ry * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Emplacements de camp repérés : cercle (plein et doré une fois établi). */
  private drawCamps(ctx: CanvasRenderingContext2D, m: (v: number) => number, size: number) {
    this.map.sites.forEach((c, i) => {
      if (!this.fog.isExplored(c.x, c.y)) return;
      const on = this.camps.includes(i);
      ctx.fillStyle = on ? '#F0B64A' : 'rgba(0,0,0,0)';
      ctx.strokeStyle = on ? '#10181A' : '#EEE7D7';
      ctx.lineWidth = size * 0.35;
      ctx.beginPath();
      ctx.arc(m(c.x), m(c.y), size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  private star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lw: number) {
    ctx.fillStyle = '#F0B64A';
    ctx.strokeStyle = '#10181A';
    ctx.lineWidth = 1.5 * lw;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawMinimap(me: PlayerState, players: PlayerState[], units: UnitTuple[], myPos: { x: number; y: number }) {
    const ctx = this.mini;
    const S = 180, k = S / (WORLD_HALF * 2);
    const m = (v: number) => (v + WORLD_HALF) * k;
    ctx.drawImage(this.miniBg, 0, 0);
    this.fog.draw(ctx, 0, 0, S, S, 0.92);

    // Plage d'arrivée et village (étoile dorée).
    const { spawn, village } = this.map;
    ctx.strokeStyle = '#EEE7D7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m(spawn.x), m(spawn.y), 3, 0, Math.PI * 2);
    ctx.stroke();
    this.drawCaves(ctx, m, 4);
    this.drawCamps(ctx, m, 3.5);
    this.star(ctx, m(village.x), m(village.y), 6.5, 1);

    for (const u of units) {
      ctx.fillStyle = u[6] ? '#5CC8B8' : '#E8693F';
      ctx.fillRect(m(u[3]) - 1, m(u[4]) - 1, 2, 2);
    }
    for (const p of players) {
      const x = p.id === me.id ? myPos.x : p.x, y = p.id === me.id ? myPos.y : p.y;
      ctx.fillStyle = p.dead ? '#A9B3A6' : p.color;
      ctx.strokeStyle = '#10181A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m(x), m(y), p.id === me.id ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

}

type BestiaryForm = 'wild' | 'alpha' | 'legend' | 'boss';

/** Texte d'une carte du bestiaire : nom, traits, statistiques et description selon la forme. */
function beastCard(s: number, form: BestiaryForm): { name: string; tag: string; stats: string; desc: string } {
  const sp = SPECIES[s];
  if (form === 'boss') {
    const moves = (BOSS_MOVES[sp.key] ?? []).map((m) => MOVE_NAMES[m.kind]);
    return {
      name: sp.title ?? sp.name, tag: sp.name, stats: `${sp.hp} PV · ${sp.dmg} dégâts`,
      desc: `${moves.length ? `${moves.join(', ')}. ` : ''}« ${BOSS_LINES[sp.key]?.intro ?? '…'} »`,
    };
  }
  // apprivoisé, le gibier passif se bat comme les autres : « Passif » ne vaut que pour la forme sauvage
  const traits = [sp.passive && form === 'wild' ? 'Passif' : sp.ranged ? 'Tireur' : 'Mêlée', sp.swim ? 'aquatique' : sp.amphibious ? 'amphibie en meute' : '', MOUNTS[sp.key] ? 'monture en Alpha' : ''].filter(Boolean).join(' · ');
  if (form === 'wild') return { name: sp.name, tag: traits, stats: `${sp.hp} PV · ${sp.dmg} dégâts`, desc: SPECIES_DESC[sp.key] ?? '' };
  const legend = form === 'legend', st = alphaStats(s, 0, 0, legend), boss = bossOf(s), perk = alphaPerk(s, 0);
  const powers = [
    MOUNTS[sp.key] ? (SWIM_MOUNTS.has(sp.key)
      ? `Se chevauche sur l'eau seulement (vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}) : on embarque près de l'eau, on descend au bord d'une rive, et s'il tombe en pleine eau, on se noie.`
      : FLY_MOUNTS.has(sp.key) ? `Se chevauche et vole (vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}) : par-dessus l'eau, les rochers et les arbres.`
      : `Se chevauche (vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}).`) : '',
    perk?.kind === 'guard' ? `Carapace : au combat, il dresse sa coquille ; les alliés autour de lui (dompteurs et meutes) encaissent ${pctLabel(perk.value)} de dégâts en moins pendant ${ALPHA_SHOUT_S} s, toutes les ${ALPHA_SHOUT_CD} s (plus en le renforçant).` : '',
    perk?.kind === 'rally' ? `Cri de ralliement : au combat, il se dresse et crie ; les alliés autour de lui (dompteurs et meutes) font +${pctLabel(perk.value)} de dégâts pendant ${ALPHA_SHOUT_S} s, toutes les ${ALPHA_SHOUT_CD} s (plus en le renforçant).` : '',
    perk?.kind === 'heal' ? `Soigne son dompteur et sa meute proche : ${pctLabel(perk.value)} de leurs PV toutes les ${ALPHA_HEAL_S} s (plus en le renforçant).` : '',
    legend && boss >= 0 ? `Âme de ${SPECIES[boss].title ?? SPECIES[boss].name} : il hérite de ses attaques (${(BOSS_MOVES[SPECIES[boss].key] ?? []).map((m) => MOVE_NAMES[m.kind].toLowerCase()).join(', ')}).` : '',
    !legend ? `Éveil : ${alphaCreateCost(s)} essences, puis ${duration(alphaAwakenS(s))}.` : '',
  ].filter(Boolean).join(' ');
  return { name: legend ? `${sp.name} légendaire` : `${sp.name} alpha`, tag: legend ? `Aura dorée · ×${String(LEGEND_MULT.hp).replace('.', ',')} PV et dégâts` : traits, stats: `niv. 0 · ${st.hp} PV · ${st.dmg} dégâts`, desc: powers };
}

type Portrait = { canvas: HTMLCanvasElement; s: number; seen: boolean; alpha?: boolean; legend?: boolean; tame?: boolean };

/** Petites icônes des statistiques (couleur via currentColor). */
const ICONS = {
  hp: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14.2S1.8 10.4 1.8 6a3.2 3.2 0 0 1 6.2-1.2A3.2 3.2 0 0 1 14.2 6c0 4.4-6.2 8.2-6.2 8.2z"/></svg>',
  dmg: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 2 6.5 9.5M4 7.5l4.5 4.5M5.5 10.5 2 14"/></svg>',
  revive: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M13.5 8.5A5.5 5.5 0 1 1 11.8 4M13 1.8V5H9.8"/></svg>',
  guard: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5 13.5 3.5v4c0 3.4-2.4 5.9-5.5 7-3.1-1.1-5.5-3.6-5.5-7v-4z"/></svg>',
  rally: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.5 9.9 5.6l4.4.5-3.3 3 .9 4.4L8 11.3l-3.9 2.2.9-4.4-3.3-3 4.4-.5z"/></svg>',
  heal: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.3 2h3.4v4.3H14v3.4H9.7V14H6.3V9.7H2V6.3h4.3z"/></svg>',
  mount: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 3.5 7.5 8 3 12.5M8.5 3.5 13 8l-4.5 4.5"/></svg>',
};

/** Sprites du jeu animés dans des canvas du HUD ; silhouette sombre pour une espèce pas encore croisée. */
function paintPortraits(list: Portrait[]) {
  const t = performance.now() / 1000, dpr = Math.min(2, devicePixelRatio || 1);
  for (const b of list) {
    const w = b.canvas.clientWidth, h = b.canvas.clientHeight;
    if (!w) continue;
    if (b.canvas.width !== Math.round(w * dpr)) {
      b.canvas.width = Math.round(w * dpr);
      b.canvas.height = Math.round(h * dpr);
    }
    const ctx = b.canvas.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, b.canvas.width, b.canvas.height);
    const r = b.alpha ? alphaStats(b.s, 0, 1, b.legend).r : SPECIES[b.s].r;
    const scale = Math.min(2.2, (h * dpr * (b.alpha ? 0.72 : 0.55)) / (r * 2)); // l'aura d'Alpha déborde : on remplit plus le cadre
    ctx.setTransform(scale, 0, 0, scale, b.canvas.width / 2, b.canvas.height * 0.55);
    drawUnit(ctx, { x: 0, y: 0, r, species: b.s, alpha: !!b.alpha, legend: b.legend, wild: b.seen && !b.alpha && !b.tame, face: 1, t: t + b.s, seed: b.s, flash: false });
    if (!b.seen) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#2A3A36';
      ctx.fillRect(0, 0, b.canvas.width, b.canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
