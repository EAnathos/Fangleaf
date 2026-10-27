// Carte générée à partir d'une graine : même graine = même carte côté serveur et côté client.
//
// - Le monde est une île de forme et de taille aléatoires au milieu de la mer. Elle s'étire le long d'une
//   « colonne » (une ligne courbe) : la côte est à une distance variable de cette colonne, au bord bruité.
// - Mer peu profonde le long de la côte (le serpent y nage), puis mer profonde, infranchissable.
// - Relief : des collines qui montent et descendent (affichage seulement, rien d'infranchissable).
// - On arrive sur la plage d'un bout de l'île (une épave, des planches) ; un chemin de cailloux mène au pont de bois
//   qui traverse un bras de mer jusqu'à l'îlot du village (palissade irrégulière, pas ronde).
// - Zones de danger : ZONES bandes successives à travers l'île, de plus en plus loin de la plage, frontières bruitées ;
//   la zone 5 (Lacs brumeux) est criblée de lacs, parfois ouverts sur la mer, où nagent les Serpents des brumes ; la 6
//   (Jungle) a ses mares et ses marigots, où guettent les crocodiles, sous les grands arbres ; la 7 (Mer de sable)
//   n'a que de rares oasis et une lisière verte le long de la côte (jusqu'au bout de l'île : la transition avec la mer).
// - Au bout de la zone 4 : un emplacement de camp, que le village peut établir contre de l'or
//   (feu qui soigne, point de réapparition, Pierre de passage pour voyager entre camps).
// - Lacs dans l'île, en laissant toujours libre une voie centrale.
// - Une grotte par espèce (deux ou trois par zone), gardée par la version géante de l'espèce (entrée sur la carte, intérieur hors du monde).
// - Un volcan dans la Mer de sable ; sa bouche mène à ses entrailles (zone 8, une grande salle hors du monde) et aux
//   antres de ses trois géants.
// - Des filons d'or éparpillés, plus riches dans les zones dangereuses.
// - Arbres, rochers, palissade, bâtiments : obstacles solides (même grille : 1 = eau, 2 = solide, 3 = mer profonde).

import { CAMP_R, CAVE_RX, CAVE_RY, DECK_RX, DECK_RY, SEA_RX, SEA_RY, VOYAGE_ZONE, HALL_RX, HALL_RY, VOLCANO_R, VOLCANO_RY, VOLCANO_ZONE, ZONE_WEIGHTS, BOARD_OFFSET, DEN_OFFSET, ELDER_OFFSET, FORGE_OFFSET, HALL_OFFSET, MARKET_OFFSET, SCHOOL_OFFSET, STORE_OFFSET, SPECIES, VILLAGE_R, VILLAGE_STONE_OFFSET, WORLD_HALF, ZONES, LAKES_ZONE, JUNGLE_ZONE, DESERT_ZONE, type BuildingId, type Resource } from './config.ts';
import { clamp, dist2, fbm, hash2, rng } from './math.ts';

export const MAP_CELL = 16; // résolution de la grille d'obstacles
const N = (WORLD_HALF * 2) / MAP_CELL;
const LAKE_THRESHOLD = 0.64;
const LAKE_THRESHOLD_LAKES = 0.53; // zone 5 (Lacs brumeux) : bien plus d'eau
const LAKE_THRESHOLD_JUNGLE = 0.59; // Jungle : des mares et des marigots, où guettent les crocodiles
const LAKE_THRESHOLD_DESERT = 0.8; // Mer de sable : de rares oasis
const SPINE_STEP = 100;
const ISLAND_LEN: [number, number] = [34500, 48700]; // longueur de la colonne : l'île est plus ou moins grande
const HALF_W: [number, number] = [1600, 3000]; // demi-largeur de l'île (avant le bruit de la côte)
const DESERT_WIDEN = 0.3; // la Mer de sable est plus large (son volcan y tient, à l'écart de la voie centrale)
const COAST_NOISE = 900; // la côte s'écarte de ± la moitié de ceci
export const SEA_SHALLOW = 520; // mer peu profonde le long de la côte (le serpent y nage), puis mer profonde
export const BEACH = 190; // largeur de la plage, côté terre
const DENS = 7; // tanières de suricates
const ZONE_BLEND = 900; // largeur de la transition (affichage) entre deux zones
const STAMP_R = 4300; // au-delà, mer profonde : on ne calcule plus la distance à la colonne
const LANE = 280; // voie centrale jamais inondée (bord bruité)
const MIN_LAKE = 40; // en cases : un lac plus petit (une flaque) est asséché
const MIN_ISLET = 40; // en cases : un îlot plus petit est englouti
export const COAST_GREEN = 700; // largeur de la lisière verte entre le sable du désert et l'eau
export const MOUTH_FADE = 320; // embouchure : sur cette distance (à travers l'eau), l'eau d'un lac passe à celle de la mer
const NB8 = [-N - 1, -N, -N + 1, -1, 1, N - 1, N, N + 1];
const CAVE_GAP = 4000; // > VIEW_R + 2 × CAVE_RX + la demi-largeur de l'écran
const BRIDGE_ARC: [number, number] = [450, 850]; // abscisse (le long de la colonne) du pied du pont, côté île
const GATE0_AFTER = 600; // la porte de la Lisière coupe le couloir à cette distance du pied du pont
const ZONE1_EXTRA = 1160; // la zone 1 commence par la plage et le chemin du pont : elle est plus longue
const ISLE_MARGIN = 250; // de la palissade à la côte de l'îlot du village (sa plage)
const BRIDGE_GAP = 300; // largeur du bras de mer entre l'île et l'îlot, au plus étroit
export const BRIDGE_W = 64; // largeur du pont de bois
/**
 * Palissade du village : distance du feu à la palissade dans la direction a (radians, 0 vers l'est, y vers le bas).
 * Une forme fixe, irrégulière : large d'est en ouest, plus serrée au sud. Les bâtiments sont placés pour y tenir.
 */
export const villageEdge = (a: number) => VILLAGE_R * (1 + 0.14 * Math.cos(2 * a) + 0.06 * Math.sin(3 * a + 0.8) + 0.035 * Math.cos(5 * a + 2.1));
/** Portes du village : aux quatre points cardinaux (angles), à ± VILLAGE_GATE_W / 2 px de part et d'autre. */
export const VILLAGE_GATES = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const VILLAGE_GATE_W = 92;
/** Angle a dans l'ouverture d'une porte de la palissade. */
export const atVillageGate = (a: number) =>
  VILLAGE_GATES.some((g) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) * villageEdge(g) < VILLAGE_GATE_W / 2);
/** Plus petite distance du feu à la palissade. */
export const VILLAGE_MIN_R = Math.min(...Array.from({ length: 360 }, (_, i) => villageEdge((i / 180) * Math.PI)));
const VILLAGE_MAX_R = Math.max(...Array.from({ length: 360 }, (_, i) => villageEdge((i / 180) * Math.PI)));
const TAU = Math.PI * 2;
const FAR = 32767; // distance à la côte plafonnée (Int16) : le large, loin de l'île
const FAR_U = 65535; // distances positives plafonnées (Uint16)
/** Distance à la côte rangée sur 16 bits, sans changer de signe (un rien en mer reste en mer, à 1 px). */
const shoreCell = (d: number) => (d > 0 ? Math.min(FAR, Math.max(1, Math.round(d))) : Math.max(-FAR, Math.round(d)));
/** ZONE_CUM[z] : parts de zone cumulées jusqu'à la fin de la zone z. */
const ZONE_CUM = ZONE_WEIGHTS.reduce((acc, w) => [...acc, acc[acc.length - 1] + w], [0]);
/** L'île s'est allongée avec ses zones : filons, rochers, buissons et tanières sont plus nombreux d'autant. */
const GROW = ZONE_CUM[ZONES] / 7.7;
const more = (n: number) => Math.round(n * GROW);

export interface Pt {
  x: number;
  y: number;
}

export interface Cave {
  id: number; // index dans caves ; -1 (HALL_ID) : la salle sous le volcan (map.depths)
  zone: number;
  boss: number; // index de l'espèce du mini-boss
  entrance: Pt; // sur la carte
  inside: Pt; // centre de l'intérieur (hors du monde)
  exit: Pt; // sortie, en bas de l'intérieur
  rx?: number; // demi-axes de l'intérieur, s'ils ne sont pas ceux d'une grotte (CAVE_RX, CAVE_RY)
  ry?: number;
  home?: Pt; // où se tient son géant, s'il n'est pas au fond (le Kraken, dans l'eau contre le bateau)
  spots?: Pt[]; // d'autres places où il peut resurgir (le Kraken, entre deux phases : bâbord, tribord, proue)
  open?: number; // géant à l'air libre, sur un îlot du large (index dans islets) : pas d'intérieur, l'îlot est son arène
}
/**
 * Îlot du large : une petite île dans la mer peu profonde, qu'on rejoint à dos de serpent. Il garde un géant (à l'air
 * libre, sa « grotte » sans intérieur : cave) et ses créatures, ou un coffre de naufragé (chest).
 */
export interface Islet {
  x: number;
  y: number;
  r: number; // rayon moyen (le bord ondule)
  zone: number;
  boss: number; // espèce du géant (-1 : un coffre à la place)
  cave: number; // son géant (index dans caves, une grotte à l'air libre : Cave.open ; -1 : aucun)
  chest: Pt | null; // coffre de naufragé
}
/** Les îlots, dans l'ordre : zone, et géant (clé d'espèce) ou coffre. */
const ISLETS: { zone: number; boss?: string }[] = [{ zone: 2 }, { zone: 3, boss: 'drake_king' }, { zone: 4 }, { zone: 5, boss: 'wyvern_king' }, { zone: 6, boss: 'dragon_king' }];

/** Demi-axes de l'intérieur d'une grotte (ou de la salle du volcan). */
export const caveRadii = (c: Cave) => ({ rx: c.rx ?? CAVE_RX, ry: c.ry ?? CAVE_RY });
export const HALL_ID = -1;

export interface Ore {
  id: number;
  x: number;
  y: number;
  zone: number;
  res: Resource; // filon d'or ou rocher (pierre) ; le bois vient des arbres
  size: number; // petit (~0,7), moyen (~1) ou gros (~1,4) : sa taille, ses PV et ce qu'il rapporte
}

/**
 * Taille d'un rocher ou d'un filon, tirée de sa position (pas du hasard de la génération : la carte des villages
 * existants ne bouge pas) : un tiers de petits, une moitié de moyens, quelques gros.
 */
/** Rayon d'obstacle d'un rocher ou d'un filon. */
export const oreRadius = (o: Ore) => (18 + o.zone * 2) * o.size;

export const oreSize = (x: number, y: number, seed: number) => {
  const h = hash2(x | 0, y | 0, seed + 520), jitter = (hash2(y | 0, x | 0, seed + 521) - 0.5) * 0.12;
  return (h < 0.33 ? 0.7 : h < 0.85 ? 1 : 1.4) + jitter;
};

export interface Bush {
  id: number;
  x: number;
  y: number;
  zone: number;
}

export interface Decor {
  id: number; // index dans decor (un arbre abattu se désigne ainsi)
  kind: 0 | 1; // arbre, rocher
  x: number;
  y: number;
  zone: number;
}

/**
 * Lisière verte de la Mer de sable : au bord de l'eau (mer ou lac), le sable laisse place à une steppe (palmiers),
 * pour que le désert ne touche jamais l'eau directement. 0 ailleurs, 1 au bord de l'eau, au bord irrégulier.
 */
export function coastGreen(map: WorldMap, x: number, y: number) {
  const m = map.zoneMix(x, y), d = (m.z0 === DESERT_ZONE ? 1 - m.t : 0) + (m.z1 === DESERT_ZONE ? m.t : 0);
  if (!d) return 0;
  // distance à l'eau la plus proche : la mer, ou un lac (oasis ; les lacs des Lacs brumeux voisins s'ouvrent sur l'océan)
  const near = Math.min(map.wetDistAt(x, y), Math.max(0, -map.shoreAt(x, y)));
  const u = Math.min(1, Math.max(0, 1 - near / COAST_GREEN + (fbm(x / 300, y / 300, map.seed + 76, 2) - 0.5) * 0.5));
  return d * u * u * (3 - 2 * u);
}

/**
 * Bord de l'intérieur d'une grotte dans la direction a, en part de l'ellipse CAVE_RX × CAVE_RY (de 0,82 à 1,08) :
 * une paroi rocheuse irrégulière plutôt qu'un ovale parfait. Même forme pour le jeu (caveAt) et le dessin.
 */
export function caveEdge(c: Cave, a: number) {
  const k = c.id * 1.7;
  const n = Math.sin(a * 3 + k) * 0.06 + Math.sin(a * 5 + k * 2.3) * 0.045 + Math.sin(a * 9 + k * 0.7) * 0.025 + Math.sin(a * 14 + k * 1.3) * 0.015;
  return 0.95 + n;
}

const DECO_CELL = 96;
const BUCKET = 256;

/** Colonne du couloir : marche aléatoire depuis un bord, qui évite les bords et ses propres boucles. */
/**
 * Colonne de l'île : une courbe douce (direction, ondulation et courbure tirées au sort), rééchantillonnée tous
 * les SPINE_STEP px, centrée sur la carte ; raccourcie si elle n'y tient pas (avec la mer autour).
 */
function makeSpine(seed: number): Pt[] {
  const rand = rng(seed ^ 0x1234567);
  const len = ISLAND_LEN[0] + rand() * (ISLAND_LEN[1] - ISLAND_LEN[0]);
  const ang = rand() * TAU, wob = 400 + rand() * 1400, waves = 0.6 + rand() * 1.2, ph = rand() * TAU, bend = (rand() - 0.5) * 0.5;
  const dx = Math.cos(ang), dy = Math.sin(ang), room = WORLD_HALF - HALF_W[1] * (1 + DESERT_WIDEN) - COAST_NOISE / 2 - SEA_SHALLOW - 400;
  for (let scale = 1; ; scale -= 0.04) {
    const L = len * scale;
    // courbe dense, puis points tous les SPINE_STEP px le long de la courbe
    const dense: Pt[] = [];
    for (let i = 0; i <= 400; i++) {
      const t = i / 400, s = (t - 0.5) * L;
      const off = wob * Math.sin(t * Math.PI * 2 * waves + ph) * scale + bend * L * (t - 0.5) ** 2 * 2;
      dense.push({ x: dx * s - dy * off, y: dy * s + dx * off });
    }
    const pts: Pt[] = [dense[0]];
    let carry = 0;
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1], b = dense[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
      let d = SPINE_STEP - carry;
      while (d <= seg) {
        pts.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
        d += SPINE_STEP;
      }
      carry = seg - (d - SPINE_STEP);
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) [x0, x1, y0, y1] = [Math.min(x0, p.x), Math.max(x1, p.x), Math.min(y0, p.y), Math.max(y1, p.y)];
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if ((x1 - x0) / 2 <= room && (y1 - y0) / 2 <= room || scale < 0.5) return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  }
}

export class WorldMap {
  readonly spine: Pt[];
  readonly length: number; // longueur réelle de la colonne
  readonly spawn: Pt;
  readonly village: Pt; // le feu du village, au centre de son îlot
  readonly gate: Pt; // porte du village côté pont, où arrive le chemin
  readonly bridge: { a: Pt; b: Pt } = { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }; // pont de bois : de la côte de l'île (a) à celle de l'îlot (b)
  private isleNoise = 0; // phase du bruit de la côte de l'îlot
  readonly forge: Pt;
  readonly den: Pt;
  readonly market: Pt;
  readonly hall: Pt; // Hôtel de ville
  readonly elder: Pt; // le vieil homme, près du feu du village
  readonly store: Pt; // entrepôt (réserve commune de bois et de pierre)
  readonly board: Pt; // panneau du village (tableau des exploits)
  readonly shipwreck: Pt & { a: number };
  readonly boatStone: Pt; // Pierre de passage du bateau (une fois reconstruit), côté terre de l'épave // épave coupée en deux, sur la plage du bout de l'île (a : direction de la coque)
  readonly egg: Pt; // œuf brisé, juste à côté de l'endroit où l'on se réveille
  readonly sword: Pt; // épée plantée dans le sable, un peu plus haut sur la plage
  readonly gates: number[] = []; // portes : abscisse le long du couloir ([0] sortie du village, puis début de chaque zone)
  readonly wreck: { boat: Pt; out: number; planks: { x: number; y: number; a: number; l: number }[] } = { boat: { x: 0, y: 0 }, out: 0, planks: [] }; // épave sur la plage d'arrivée (décalages depuis le point d'arrivée)
  readonly zoneLen: number; // longueur (le long de la colonne) d'une part de zone (ZONE_WEIGHTS) ; la zone 1 a en plus la plage et le village
  readonly sites: Pt[] = []; // emplacements de camp (un au bout de chaque série de 4 zones)
  private siteArcs: number[] = []; // abscisse de chaque emplacement le long du couloir
  readonly siteLayout: { tents: Pt[]; flag: Pt }[] = []; // décalages depuis le feu, à l'écart de la piste qui arrive
  readonly stones: Pt[] = []; // Pierres de passage : [0] au village, puis une par emplacement de camp
  volcano: Pt = { x: 0, y: 0 }; // centre de la base du volcan (Mer de sable)
  volcanoMouth: Pt = { x: 0, y: 0 }; // son entrée, au pied du volcan (devant, en bas à l'écran)
  /** La salle sous le volcan : une grotte (hors du monde) de la zone VOLCANO_ZONE, plus grande, sans géant à elle. */
  depths: Cave = { id: HALL_ID, zone: VOLCANO_ZONE, boss: -1, entrance: { x: 0, y: 0 }, inside: { x: 0, y: 0 }, exit: { x: 0, y: 0 }, rx: HALL_RX, ry: HALL_RY };
  readonly lavaPools: { x: number; y: number; r: number }[] = []; // mares de lave de la salle (infranchissables)
  school: Pt = { x: 0, y: 0 }; // École des dompteurs, au village
  planChest: Pt = { x: 0, y: 0 }; // coffre du plan de l'école, dans le premier camp (sur le côté de la piste)
  readonly caves: Cave[] = [];
  readonly ores: Ore[] = [];
  readonly decor: Decor[] = [];
  readonly bushes: Bush[] = []; // buissons à fruits (décor franchissable : le gibier vient y manger)
  readonly dens: Pt[] = []; // tanières de suricates (Mer de sable) : buttes percées de trous, franchissables
  readonly paths: [number, number][][] = []; // chemins de terre : de la plage au pont, puis du pont à la porte du village
  private buckets = new Map<number, number[]>(); // décor par case de 256 px
  readonly islets: Islet[] = []; // îlots du large
  readonly deepWater: number[][] = []; // par zone : x, y à la suite de points en eau profonde
  private segs = new Map<number, number[]>(); // segments de chemin par case de 256 px (ax, ay, bx, by à la suite)
  private water = new Uint8Array(N * N); // 0 libre, 1 eau, 2 solide, 3 forêt, 4 filon ou tas à récolter (voir oreCell)
  private oreCell = new Map<number, number>(); // case occupée par un filon ou un tas → son index dans ores (peu de cases : pas de tableau plein)
  readonly oreDown = new Set<number>(); // filons et tas épuisés : ils ont disparu (on passe à travers) jusqu'à leur retour
  private treeCell = new Map<number, number>(); // case occupée par un tronc → son index dans decor
  readonly treeDown = new Set<number>(); // arbres abattus (index dans decor) : on passe à travers jusqu'à ce qu'ils repoussent
  // Grilles par case, au plus juste (sur téléphone, chaque octet par case pèse 4,7 Mo) : distances en px entiers sur
  // 16 bits, plafonnées (FAR) ; la distance à la colonne ne sert qu'à la génération, elle est libérée ensuite.
  private cdist: Float32Array = new Float32Array(N * N).fill(1e9); // distance à la colonne (génération seulement)
  private arc = new Uint16Array(N * N); // abscisse (le long de la colonne) du point de colonne le plus proche, en px
  private shore = new Int16Array(N * N).fill(FAR); // distance à la côte (px) : négative dans l'île, positive en mer, FAR au large
  private mouth: Uint8Array; // embouchures (voir buildMouths), en pas de 2 px, 255 loin de toute embouchure (vide sur le serveur)
  private wetDist = new Uint16Array(N * N); // distance à l'eau la plus proche (en demi-px), mer ou lac (voir buildWetDist)
  private palisadeCells: number[] = []; // cases de la palissade (solides seulement une fois construite)
  private bridgeCells: number[] = []; // cases du pont (praticables seulement une fois réparé)

  /** draw : la carte sert aussi à dessiner (le client) ; le serveur se passe de ce qui ne sert qu'au dessin (embouchures). */
  constructor(readonly seed: number, draw = true) {
    this.mouth = new Uint8Array(draw ? N * N : 0).fill(255);
    const rand = rng(seed ^ 0x5f3759df);
    this.spine = makeSpine(seed);
    this.length = (this.spine.length - 1) * SPINE_STEP;
    this.zoneLen = (this.length - ZONE1_EXTRA) / ZONE_CUM[ZONES];
    this.stampIsland();

    // Arrivée sur la plage du bout de l'île : on part de la colonne vers le large jusqu'au sable.
    const s0 = this.spine[0], s1 = this.spine[Math.min(4, this.spine.length - 1)];
    const ol = Math.hypot(s0.x - s1.x, s0.y - s1.y) || 1, ox = (s0.x - s1.x) / ol, oy = (s0.y - s1.y) / ol;
    let d = 0;
    while (d < 4000 && this.shoreAt(s0.x + ox * d, s0.y + oy * d) < -BEACH * 0.6) d += 16;
    this.spawn = { x: s0.x + ox * (d - 90), y: s0.y + oy * (d - 90) };
    // Épave au bout de l'île (Mer de sable) : sur le sable, au bord de l'eau, couchée le long du rivage.
    {
      const e0 = this.spine[this.spine.length - 1], e1 = this.spine[Math.max(0, this.spine.length - 5)];
      const el = Math.hypot(e0.x - e1.x, e0.y - e1.y) || 1, ex = (e0.x - e1.x) / el, ey = (e0.y - e1.y) / el;
      let de = 0;
      while (de < 4000 && this.shoreAt(e0.x + ex * de, e0.y + ey * de) < -45) de += 8;
      this.shipwreck = { x: e0.x + ex * (de - 12), y: e0.y + ey * (de - 12), a: Math.atan2(ey, ex) + Math.PI / 2 }; // la coque touche l'eau
      this.boatStone = { x: this.shipwreck.x - ex * 130, y: this.shipwreck.y - ey * 130 };
    }
    // au réveil : l'œuf brisé à côté (à gauche ou à droite, côté terre : jamais caché par le nom), l'épée plantée
    // un peu plus haut, vers l'intérieur de l'île
    this.egg = { x: this.spawn.x + (ox > 0 ? -36 : 36), y: this.spawn.y + 8 };
    this.sword = { x: this.spawn.x - ox * 130 + oy * 40, y: this.spawn.y - oy * 130 - ox * 40 };
    const isle = this.placeIsle();
    const village = (this.village = isle.c);
    this.gate = { x: village.x - isle.dir.x * (villageEdge(isle.back) + 60), y: village.y - isle.dir.y * (villageEdge(isle.back) + 60) };
    this.stampIsle(isle.arc);
    this.placeBridge();
    // épave : la barque échouée côté mer, des planches éparpillées autour
    const wr = rng(seed ^ 0xb0a7), out = Math.atan2(oy, ox);
    this.wreck.out = out;
    this.wreck.boat = { x: ox * 120 - oy * 60, y: oy * 120 + ox * 60 };
    for (let k = 0; k < 9; k++) {
      const a = out + (wr() - 0.5) * 3.4, r = 70 + wr() * 130;
      this.wreck.planks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a: wr() * Math.PI, l: 26 + wr() * 22 });
    }
    this.forge = { x: village.x + FORGE_OFFSET.x, y: village.y + FORGE_OFFSET.y };
    this.den = { x: village.x + DEN_OFFSET.x, y: village.y + DEN_OFFSET.y };
    this.market = { x: village.x + MARKET_OFFSET.x, y: village.y + MARKET_OFFSET.y };
    this.hall = { x: village.x + HALL_OFFSET.x, y: village.y + HALL_OFFSET.y };
    this.store = { x: village.x + STORE_OFFSET.x, y: village.y + STORE_OFFSET.y };
    this.elder = { x: village.x + ELDER_OFFSET.x, y: village.y + ELDER_OFFSET.y };
    this.board = { x: village.x + BOARD_OFFSET.x, y: village.y + BOARD_OFFSET.y };
    this.school = { x: village.x + SCHOOL_OFFSET.x, y: village.y + SCHOOL_OFFSET.y };
    for (const s of [isle.arc + GATE0_AFTER, ...Array.from({ length: ZONES - 1 }, (_, k) => this.zoneTo(k + 1))]) if (s < this.length - 300) this.gates.push(s);
    this.stones.push({ x: village.x + VILLAGE_STONE_OFFSET.x, y: village.y + VILLAGE_STONE_OFFSET.y });
    for (const s of [this.zoneTo(4)]) {
      const at = s - 650, site = this.spineAt(at), from = this.spineAt(at - 300);
      const a = Math.atan2(from.y - site.y, from.x - site.x); // direction d'où arrive la piste
      const off = (ang: number, d: number) => ({ x: Math.cos(ang) * d, y: Math.sin(ang) * d });
      this.sites.push(site);
      this.siteArcs.push(at);
      this.siteLayout.push({ tents: [off(a + Math.PI - 0.75, 105), off(a + Math.PI + 0.75, 105)], flag: off(a - 1.7, 115) });
      const st = off(a + 1.6, 125);
      this.stones.push({ x: site.x + st.x, y: site.y + st.y });
    }

    this.buildPath(isle.dir);
    this.indexPaths();
    this.placePlanChest();
    this.placeVolcano();

    // Lacs : seulement dans l'île, hors de la voie centrale, de la plage, du village et des emplacements de camp.
    const keepDry = new Uint8Array(N * N); // cases qui doivent rester au sec (le nettoyage de l'eau n'y touche pas)
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (this.water[k] !== 0 || this.shore[k] >= FAR) continue;
        const p = { x: -WORLD_HALF + (i + 0.5) * MAP_CELL, y: -WORLD_HALF + (j + 0.5) * MAP_CELL };
        // part de Lacs brumeux et de désert, en fondu à travers les frontières bruitées des zones (pas de bord au cordeau)
        const m = this.zoneMix(p.x, p.y), w = (z: number) => (m.z0 === z ? 1 - m.t : 0) + (m.z1 === z ? m.t : 0);
        const w5 = w(LAKES_ZONE), w6 = w(DESERT_ZONE), wj = w(JUNGLE_ZONE);
        if (
          (w5 < 0.5 && this.shore[k] > -BEACH - 120) || // plage au sec (sauf aux Lacs brumeux : les lacs y rejoignent la mer)
          // voie centrale au sec, au bord très irrégulier (jamais moins d'une centaine de px de chaque côté de la colonne)
          this.cdist[k] < LANE + (fbm(p.x / 500, p.y / 500, this.seed + 95, 2) - 0.5) * 700 ||
          this.inVillage(p.x, p.y, ISLE_MARGIN + 300) || // l'îlot du village, tout entier
          dist2(p.x, p.y, this.spawn.x, this.spawn.y) < 320 ** 2 ||
          dist2(p.x, p.y, this.shipwreck.x, this.shipwreck.y) < 260 ** 2 ||
          this.sites.some((c) => dist2(p.x, p.y, c.x, c.y) < 380 ** 2) ||
          this.nearVolcano(p.x, p.y, 320) || this.volcanoTrail(p.x, p.y) < 160 ||
          this.pathDist(p.x, p.y) < 130
        ) {
          keepDry[k] = 1;
          continue;
        }
        // près de la côte des Lacs brumeux, l'eau gagne : bras de mer et lacs ouverts sur l'océan
        const lakes = LAKE_THRESHOLD_LAKES + 0.04 - 0.12 * clamp(1 + this.shore[k] / 450, 0, 1);
        const threshold = LAKE_THRESHOLD + (lakes - LAKE_THRESHOLD) * w5 + (LAKE_THRESHOLD_JUNGLE - LAKE_THRESHOLD) * wj + (LAKE_THRESHOLD_DESERT - LAKE_THRESHOLD) * w6;
        if (this.lakeNoise(p.x, p.y) > threshold) this.water[k] = 1;
      }
    }
    this.cleanWater(keepDry);
    this.stampBridge();
    this.placeIslets();
    if (draw) this.buildMouths();
    this.buildWetDist();
    // l'épave : poupe et proue solides (le reste, des débris sur le sable, se traverse)
    {
      const { x, y, a } = this.shipwreck, c = Math.cos(a), sn = Math.sin(a);
      for (const [lx, ly, r] of [[-110, 0, 26], [-80, 0, 30], [-50, 0, 30], [-20, 2, 28], [55, 6, 26], [85, 4, 24], [112, 0, 18]]) {
        this.solidDisc(x + lx * c - ly * sn, y + lx * sn + ly * c, r);
      }
    }

    // Grottes : deux ou trois par zone, dans la bande de la zone, de part et d'autre de la colonne, l'ouverture accessible.
    const free = (x: number, y: number, r: number) => {
      for (let a = 0; a < 8; a++) if (this.blocked(x + Math.cos(a) * r, y + Math.sin(a) * r)) return false;
      return !this.blocked(x, y);
    };
    const bosses = SPECIES.map((sp, i) => (sp.boss ? i : -1)).filter((i) => i >= 0).sort((x, y) => SPECIES[x].zone - SPECIES[y].zone || x - y);
    for (const boss of bosses.filter((b) => SPECIES[b].zone <= ZONES && !SPECIES[b].isle)) {
      const z = SPECIES[boss].zone;
      const lo = z === 1 ? this.gates[0] + 450 : this.zoneFrom(z) + 300, hi = this.zoneTo(z) - 300;
      // Écart entre grottes assoupli si la zone est trop encombrée (lacs, camp) : jamais de géant manquant.
      // Dernier recours (petite île, zone criblée de lacs) : tout près de la voie centrale, toujours au sec.
      for (const [gap, near] of [[1000, false], [750, false], [500, false], [350, false], [250, false], [220, true]] as const) {
        if (this.caves.some((c) => c.boss === boss)) break;
        for (let tries = 0; tries < 1500; tries++) {
          const s = lo + rand() * (hi - lo);
          const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
          const off = (rand() < 0.5 ? -1 : 1) * (near ? 160 + rand() * 260 : 300 + rand() * Math.max(0, this.halfWidth(s) - 700));
          const x = sx + n.x * off, y = sy + n.y * off;
          if (this.zoneAt(x, y) !== z || !free(x, y, 120) || !free(x, y + 70, 40)) continue;
          if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < gap ** 2)) continue;
          if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 700 ** 2) || this.nearWreck(x, y, 450)) continue; // pas au pied d'un camp ni de l'épave
          if (this.nearVolcano(x, y, 500)) continue;
          if (!this.findPath(sx, sy, x, y + 70, 20000)) continue;
          const id = this.caves.length;
          // intérieurs alignés hors du monde, assez espacés pour qu'aucun ne soit visible (ni ses monstres envoyés) depuis un autre
          const inside = { x: WORLD_HALF + 1400 + id * CAVE_GAP, y: 0 };
          this.caves.push({ id, zone: z, boss, entrance: { x, y }, inside, exit: { x: inside.x, y: inside.y + CAVE_RY - 90 } });
          break;
        }
      }
    }

    this.placeLairs(bosses.filter((b) => SPECIES[b].zone === VOLCANO_ZONE));
    this.placeVoyage(bosses.filter((b) => SPECIES[b].zone === VOYAGE_ZONE));
    this.placeIsletCaves(); // après toutes les autres : les grottes existantes gardent leur numéro

    // Filons d'or : éparpillés sur l'île, hors de l'eau, du village, des camps et des chemins.
    for (let tries = 0; tries < 12000 && this.ores.length < more(120); tries++) {
      const s = 500 + rand() * (this.length - 500);
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 90);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (!free(x, y, 40) || this.inVillage(x, y, 200) || dist2(x, y, this.spawn.x, this.spawn.y) < 300 ** 2 || this.nearWreck(x, y, 240)) continue;
      if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 350 ** 2)) continue;
      if (this.ores.some((o) => dist2(x, y, o.x, o.y) < 480 ** 2)) continue;
      if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 250 ** 2) || this.nearVolcano(x, y, 250)) continue;
      if (this.pathDist(x, y) < 60) continue;
      this.ores.push({ id: this.ores.length, x, y, zone: this.zoneAt(x, y), res: 'gold', size: oreSize(x, y, this.seed) });
    }

    this.buildDecor();
    this.buildSolids();
    this.buildBushes();
    this.buildHarvest();
    this.buildDens();
    // Eau profonde (pas une berge) par zone : là où peuvent apparaître les créatures aquatiques.
    for (let z = 0; z <= ZONES; z++) this.deepWater.push([]);
    for (let j = 2; j < N - 2; j += 2) {
      for (let i = 2; i < N - 2; i += 2) {
        const x = -WORLD_HALF + (i + 0.5) * MAP_CELL, y = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if (this.isWater(x, y) && this.isWater(x + 40, y) && this.isWater(x - 40, y) && this.isWater(x, y + 40) && this.isWater(x, y - 40)) {
          this.deepWater[this.zoneAt(x, y)].push(x, y);
        }
      }
    }
    this.cdist = new Float32Array(0); // ne servait qu'à tracer l'île : 19 Mo de rendus
  }

  // ── Couloir ──

  /** Point de la colonne à l'abscisse s (bornée). */
  spineAt(s: number): Pt {
    const t = clamp(s, 0, this.length) / SPINE_STEP, i = Math.min(Math.floor(t), this.spine.length - 2), f = t - i;
    const a = this.spine[i], b = this.spine[i + 1];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  /** Normale (unitaire) de la colonne à l'abscisse s. */
  normalAt(s: number): Pt {
    const a = this.spineAt(s - 150), b = this.spineAt(s + 150), l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  }

  /** Demi-largeur de l'île à l'abscisse s (avant le bruit de la côte) : de larges renflements et des étranglements. */
  halfWidth(s: number) {
    const taper = Math.min(1, 0.55 + (0.45 * Math.min(s, this.length - s)) / 1800); // les deux bouts s'affinent
    // la Mer de sable s'élargit, en douceur à l'approche de sa frontière
    const d = clamp((s - this.zoneFrom(ZONES) + 1200) / 2400, 0, 1), widen = 1 + DESERT_WIDEN * d * d * (3 - 2 * d);
    return clamp(2300 + (fbm(s / 2800, 0.5, this.seed + 91, 2) - 0.5) * 2200, HALF_W[0], HALF_W[1]) * widen * taper;
  }

  /** Distance et abscisse de la colonne pour chaque case, côte bruitée, puis mer : peu profonde (1), profonde (3). */
  private stampIsland() {
    const cells = Math.ceil(STAMP_R / MAP_CELL);
    for (let k = 1; k < this.spine.length; k++) {
      const a = this.spine[k - 1], b = this.spine[k];
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) + WORLD_HALF) / MAP_CELL) - cells), i1 = Math.min(N - 1, Math.floor((Math.max(a.x, b.x) + WORLD_HALF) / MAP_CELL) + cells);
      const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) + WORLD_HALF) / MAP_CELL) - cells), j1 = Math.min(N - 1, Math.floor((Math.max(a.y, b.y) + WORLD_HALF) / MAP_CELL) + cells);
      for (let j = j0; j <= j1; j++) {
        const py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        for (let i = i0; i <= i1; i++) {
          const px = -WORLD_HALF + (i + 0.5) * MAP_CELL;
          let t = ((px - a.x) * dx + (py - a.y) * dy) / l2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = px - a.x - t * dx, ey = py - a.y - t * dy, d2 = ex * ex + ey * ey, c = j * N + i;
          if (d2 < this.cdist[c] * this.cdist[c]) {
            this.cdist[c] = Math.sqrt(d2);
            this.arc[c] = Math.round((k - 1 + t) * SPINE_STEP);
          }
        }
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const c = j * N + i;
        if (this.cdist[c] > 1e8) {
          this.water[c] = 3; // loin de tout : le large
          continue;
        }
        const px = -WORLD_HALF + (i + 0.5) * MAP_CELL, py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        const edge = this.halfWidth(this.arc[c]) + (fbm(px / 700, py / 700, this.seed + 93, 3) - 0.5) * COAST_NOISE + (fbm(px / 160, py / 160, this.seed + 94, 2) - 0.5) * 160;
        const d = this.cdist[c] - edge;
        this.shore[c] = shoreCell(d);
        if (d > SEA_SHALLOW) this.water[c] = 3;
        else if (d > 0) this.water[c] = 1;
      }
    }
  }

  /**
   * Nettoie l'eau une fois la côte et les lacs posés : ni flaque d'une case, ni pointe, ni encoche (lissage), ni petit
   * lac, ni poche de mer coupée du large (asséchés), ni îlot minuscule (englouti). Les cases keepDry restent au sec.
   */
  private cleanWater(keepDry: Uint8Array) {
    const w = this.water, sh = this.shore, wet = new Uint8Array(N * N);
    const syncWet = () => {
      for (let k = 0; k < N * N; k++) wet[k] = w[k] === 1 || w[k] === 3 ? 1 : 0;
    };
    const wetAround = (k: number) => wet[k - N - 1] + wet[k - N] + wet[k - N + 1] + wet[k - 1] + wet[k + 1] + wet[k + N - 1] + wet[k + N] + wet[k + N + 1];
    // Lissage : une case d'eau presque entourée de terre s'assèche, une case de terre presque entourée d'eau est noyée.
    for (let pass = 0; pass < 3; pass++) {
      syncWet();
      const dry: number[] = [], flood: number[] = [];
      for (let j = 1; j < N - 1; j++) {
        for (let i = 1, k = j * N + 1; i < N - 1; i++, k++) {
          const v = w[k];
          if (v === 3 || (v === 0 && keepDry[k])) continue;
          const n = wetAround(k);
          if (v === 1 && n <= 3) dry.push(k);
          else if (v === 0 && n >= 6) flood.push(k);
        }
      }
      for (const k of dry) {
        w[k] = 0;
        if (sh[k] > 0) sh[k] = -1; // un bout de mer devenu plage
      }
      for (const k of flood) {
        w[k] = 1;
        for (const d of NB8) if (sh[k + d] > 0) sh[k] = 1; // une encoche de la côte : elle rejoint la mer
      }
    }
    // Composantes (4-connexité) : eau sans accès au large trop petite, terre détachée de l'île trop petite.
    syncWet();
    // parcours en largeur : la file garde aussi les cases de la composante (queue[0..tail)), sans tableau à part
    // (la mer d'un seul tenant compte des millions de cases)
    const seen = new Uint8Array(N * N), queue = new Int32Array(N * N);
    for (let s = 0; s < N * N; s++) {
      if (seen[s]) continue;
      const isWet = wet[s];
      let head = 0, tail = 0, ocean = false, coast = false;
      queue[tail++] = s;
      seen[s] = 1;
      while (head < tail) {
        const k = queue[head++], i = k % N;
        if (w[k] === 3) ocean = true;
        for (let e = 0; e < 4; e++) {
          const nk = e === 0 ? (i > 0 ? k - 1 : -1) : e === 1 ? (i < N - 1 ? k + 1 : -1) : e === 2 ? k - N : k + N;
          if (nk < 0 || nk >= N * N) {
            ocean = true; // bord du monde
            continue;
          }
          if (wet[nk] !== isWet) {
            if (sh[nk] > 0) coast = true; // touche la mer
            continue;
          }
          if (seen[nk]) continue;
          seen[nk] = 1;
          queue[tail++] = nk;
        }
      }
      const cells = queue.subarray(0, tail);
      if (isWet && !ocean) {
        if (cells.length < MIN_LAKE) {
          for (const k of cells) {
            w[k] = 0;
            if (sh[k] > 0) sh[k] = -1;
          }
        } else for (const k of cells) if (sh[k] > 0) sh[k] = -1; // poche de mer enclavée : c'est un lac
      } else if (!isWet && cells.length < MIN_ISLET) {
        for (const k of cells) {
          w[k] = 1;
          if (coast) sh[k] = 1;
        }
      }
    }
  }

  /**
   * Embouchures : pour chaque case de lac, distance (à travers l'eau) à la mer ; pour chaque case de mer, distance au
   * lac le plus proche. Plafonnée à MOUTH_FADE (1e9 au-delà). Le dessin y fond l'eau du lac dans celle de la mer.
   */
  private buildMouths() {
    const w = this.water, sh = this.shore, md = this.mouth;
    const kind = new Uint8Array(N * N); // 0 terre, 1 lac, 2 mer
    for (let k = 0; k < N * N; k++) kind[k] = w[k] === 1 || w[k] === 3 ? (sh[k] > 0 ? 2 : 1) : 0;
    // départs : de part et d'autre de chaque contact lac-mer
    const toLake: number[] = [], toSea: number[] = [];
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1, k = j * N + 1; i < N - 1; i++, k++) {
        if (kind[k] !== 1) continue;
        for (const d of NB8) {
          if (kind[k + d] !== 2) continue;
          toLake.push(k + d);
          toSea.push(k);
        }
      }
    }
    // on avance dans l'eau de l'autre sorte (Dijkstra, pas de 1 ou √2 case), jusqu'à MOUTH_FADE
    const keys: number[] = [], dists: number[] = [];
    const push = (d: number, k: number) => {
      let c = keys.length;
      keys.push(k);
      dists.push(d);
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (dists[p] <= d) break;
        keys[c] = keys[p];
        dists[c] = dists[p];
        c = p;
      }
      keys[c] = k;
      dists[c] = d;
    };
    const pop = () => {
      const k = keys[0], lk = keys.pop()!, ld = dists.pop()!;
      if (keys.length) {
        let c = 0;
        for (;;) {
          const l = 2 * c + 1, r = l + 1;
          let m = -1, md2 = ld;
          if (l < keys.length && dists[l] < md2) [m, md2] = [l, dists[l]];
          if (r < keys.length && dists[r] < md2) m = r;
          if (m < 0) break;
          keys[c] = keys[m];
          dists[c] = dists[m];
          c = m;
        }
        keys[c] = lk;
        dists[c] = ld;
      }
      return k;
    };
    for (const [starts, into] of [[toLake, 1], [toSea, 2]] as const) {
      const done = new Uint8Array(N * N);
      for (const k of starts) push(0, k);
      while (keys.length) {
        const d = dists[0], k = pop();
        if (done[k]) continue;
        done[k] = 1;
        const i = k % N;
        if (i === 0 || i === N - 1 || k < N || k >= N * (N - 1)) continue;
        for (let n = 0; n < 8; n++) {
          const nk = k + NB8[n], nd = d + (n === 0 || n === 2 || n === 5 || n === 7 ? 1.414 : 1) * MAP_CELL;
          if (kind[nk] !== into || nd >= md[nk] * 2 || nd > MOUTH_FADE) continue;
          md[nk] = Math.round(nd / 2);
          push(nd, nk);
        }
      }
    }
  }

  /** Distance (px) à l'eau la plus proche pour chaque case : transformée de distance en deux passes (pas de 1 et √2 case). */
  private buildWetDist() {
    const d = this.wetDist, w = this.water, D = 1.414 * MAP_CELL;
    for (let k = 0; k < N * N; k++) d[k] = w[k] === 1 || w[k] === 3 ? 0 : FAR_U;
    // (en demi-px entiers sur 16 bits : le pas en diagonale presque exact, plafonné à FAR_U)
    const S = 2 * MAP_CELL, Di = Math.round(2 * D), cap = (v: number) => (v > FAR_U ? FAR_U : v);
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1, k = j * N + 1; i < N - 1; i++, k++) {
        d[k] = cap(Math.min(d[k], d[k - 1] + S, d[k - N] + S, d[k - N - 1] + Di, d[k - N + 1] + Di));
      }
    }
    for (let j = N - 2; j > 0; j--) {
      for (let i = N - 2, k = j * N + N - 2; i > 0; i--, k--) {
        d[k] = cap(Math.min(d[k], d[k + 1] + S, d[k + N] + S, d[k + N + 1] + Di, d[k + N - 1] + Di));
      }
    }
  }

  /** Distance à l'eau la plus proche (mer ou lac), interpolée entre les cases : un dégradé sans marches. */
  wetDistAt(x: number, y: number) {
    const fx = (x + WORLD_HALF) / MAP_CELL - 0.5, fy = (y + WORLD_HALF) / MAP_CELL - 0.5;
    const i = clamp(Math.floor(fx), 0, N - 2), j = clamp(Math.floor(fy), 0, N - 2), u = clamp(fx - i, 0, 1), v = clamp(fy - j, 0, 1);
    const k = j * N + i, d = this.wetDist;
    return ((d[k] * (1 - u) + d[k + 1] * u) * (1 - v) + (d[k + N] * (1 - u) + d[k + N + 1] * u) * v) / 2; // (rangée en demi-px)
  }

  /** Embouchure : distance (à travers l'eau) d'un lac à la mer, ou de la mer au lac le plus proche ; 1e9 loin de toute embouchure. */
  mouthAt(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return 1e9;
    const d = this.mouth.length ? this.mouth[this.cellOf(x, y)] : 255;
    return d === 255 ? 1e9 : d * 2;
  }

  /** Distance à la côte (négative dans l'île, positive en mer). */
  shoreAt(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return 1e9;
    const d = this.shore[this.cellOf(x, y)];
    return d === FAR ? 1e9 : d;
  }

  /** En mer (peu profonde ou profonde), pas dans un lac. */
  isSea(x: number, y: number) {
    return !this.caveAt(x, y) && this.shoreAt(x, y) > 0;
  }

  /** Relief (affichage seulement) : 0 au bord de l'eau, jusqu'à 1 au sommet des collines. */
  height(x: number, y: number) {
    const sh = this.shoreAt(x, y);
    if (sh >= 0) return 0;
    const k = Math.min(1, -sh / 1100);
    return (0.35 + fbm(x / 1900, y / 1900, this.seed + 300, 4) * 0.65 + (fbm(x / 520, y / 520, this.seed + 301, 2) - 0.5) * 0.18) * k * (2 - k);
  }

  /** Début et fin (abscisses le long de la colonne) de la zone z ; la zone 1 commence à la plage. */
  zoneFrom(z: number) {
    return z <= 1 ? 0 : ZONE1_EXTRA + ZONE_CUM[Math.min(z, ZONES) - 1] * this.zoneLen;
  }
  zoneTo(z: number) {
    return ZONE1_EXTRA + ZONE_CUM[Math.min(z, ZONES)] * this.zoneLen;
  }
  /** Longueur de la zone z le long de l'île (la zone 1 sans la plage ni le village). */
  zoneSpan(z: number) {
    return (ZONE_WEIGHTS[Math.min(z, ZONES) - 1] ?? 1) * this.zoneLen;
  }

  private cellOf(x: number, y: number) {
    const i = clamp(Math.floor((x + WORLD_HALF) / MAP_CELL), 0, N - 1), j = clamp(Math.floor((y + WORLD_HALF) / MAP_CELL), 0, N - 1);
    return j * N + i;
  }

  /** Abscisse le long du couloir, déformée comme les frontières des zones (bruit) : zoneAt et les portes k ≥ 1 la suivent. */
  zoneArc(x: number, y: number): number {
    const cave = this.caveAt(x, y);
    if (cave) return this.zoneArc(cave.entrance.x, cave.entrance.y);
    const s = this.arc[this.cellOf(x, y)];
    let warp = (fbm(x / 1400, y / 1400, this.seed + 31, 2) - 0.5) * 1000;
    // autour d'un camp (au bout d'une zone), la frontière suivante reste à distance : jamais de brume sur le camp
    this.sites.forEach((c, i) => {
      const d = Math.sqrt(dist2(x, y, c.x, c.y)), t = clamp((d - CAMP_R - 150) / 600, 0, 1);
      const g = this.gates.find((g) => g > this.siteArcs[i]);
      if (t < 1 && g !== undefined) warp = Math.min(warp, g - 200 - s + t * 2000);
    });
    return s + warp;
  }
  /**
   * Abscisse à comparer à la porte k : la porte du village (0) coupe le couloir droit ; les suivantes suivent la
   * frontière (bruitée) entre deux zones, pour que la brume et le blocage tombent pile sur le changement de décor.
   */
  gateArc(k: number, x: number, y: number) {
    return k === 0 ? this.arcAt(x, y) : this.zoneArc(x, y);
  }
  /** Abscisse du point de la colonne où passe la porte k (frontière déformée : pas forcément gates[k]). */
  gateSpine(k: number) {
    const g = this.gates[k];
    if (k === 0) return g;
    for (let s = g - 800; s <= g + 800; s += 10) {
      const c = this.spineAt(s);
      if (this.zoneArc(c.x, c.y) >= g) return s;
    }
    return g;
  }

  /** Abscisse le long du couloir du point de colonne le plus proche (0 au bord de départ). */
  arcAt(x: number, y: number): number {
    const cave = this.caveAt(x, y);
    if (cave) return this.arcAt(cave.entrance.x, cave.entrance.y);
    return this.arc[this.cellOf(x, y)];
  }

  /** Mer profonde autour de l'île (ou hors du monde) : infranchissable. (Le nom vient de l'ancienne forêt du couloir.) */
  isForest(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return !this.caveAt(x, y);
    return this.water[this.cellOf(x, y)] === 3;
  }

  /**
   * L'îlot du village, au large de la côte, à côté de la plage d'arrivée : sa porte côté île regarde un point cardinal,
   * le pont part de là, droit, jusqu'à la côte de l'île (pied du pont à une abscisse BRIDGE_ARC le long de la colonne).
   * Toute sa côte reste à BRIDGE_GAP au moins de l'île (un vrai bras de mer), et dans le monde. Rend son centre (le feu),
   * la direction de l'île vers l'îlot (dir), l'angle de sa porte côté pont (back) et l'abscisse du pied du pont.
   */
  private placeIsle() {
    this.isleNoise = rng(this.seed ^ 0x15e7)() * TAU;
    const dirs: Pt[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
    const lim = WORLD_HALF - SEA_SHALLOW - 200;
    const attempt = (arc: number, side: number, gap: number, tol: number) => {
      const nn = this.normalAt(arc), n = { x: nn.x * side, y: nn.y * side };
      const dir = dirs.reduce((b, d) => (d.x * n.x + d.y * n.y > b.x * n.x + b.y * n.y ? d : b));
      const S = this.spineAt(arc);
      let t = 0;
      while (t < 5000 && this.shoreAt(S.x + dir.x * t, S.y + dir.y * t) < 0) t += 8;
      const M = { x: S.x + dir.x * t, y: S.y + dir.y * t }, foot = this.arc[this.cellOf(M.x, M.y)];
      if (t >= 5000 || Math.abs(foot - (BRIDGE_ARC[0] + BRIDGE_ARC[1]) / 2) > tol) return null;
      const back = Math.atan2(-dir.y, -dir.x);
      for (let k = gap + this.isleEdge(back); k < gap + 900 + this.isleEdge(back); k += 30) {
        const c = { x: M.x + dir.x * k, y: M.y + dir.y * k };
        if (Math.abs(c.x) + VILLAGE_MAX_R + ISLE_MARGIN + 120 > lim || Math.abs(c.y) + VILLAGE_MAX_R + ISLE_MARGIN + 120 > lim) return null;
        let ok = true;
        for (let i = 0; i < 90 && ok; i++) {
          const a = (i / 90) * TAU, r = this.isleEdge(a) + 60;
          if (this.shoreAt(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r) < gap) ok = false;
        }
        if (ok) return { c, dir, back, arc: foot };
      }
      return null;
    };
    const first = rng(this.seed ^ 0x51de)() < 0.5 ? 1 : -1;
    // le pied du pont le plus près du milieu de BRIDGE_ARC (de préférence du côté first)
    const mid = (BRIDGE_ARC[0] + BRIDGE_ARC[1]) / 2;
    for (const [gap, tol] of [[BRIDGE_GAP, 200], [BRIDGE_GAP, 600], [BRIDGE_GAP * 0.7, 1200], [BRIDGE_GAP * 0.5, 4000]]) {
      let best: ReturnType<typeof attempt> = null;
      for (let arc = 200; arc <= 2600; arc += 50) {
        for (const side of [first, -first]) {
          const got = attempt(arc, side, gap, tol);
          if (got && (!best || Math.abs(got.arc - mid) < Math.abs(best.arc - mid) - 1)) best = got;
        }
      }
      if (best) return best;
    }
    // (jamais vu) : en face du milieu du chemin, côté first, sans vérifier
    const arc = (BRIDGE_ARC[0] + BRIDGE_ARC[1]) / 2, n = this.normalAt(arc), S = this.spineAt(arc);
    const dir = Math.abs(n.x) > Math.abs(n.y) ? { x: Math.sign(n.x * first), y: 0 } : { x: 0, y: Math.sign(n.y * first) };
    const d = this.halfWidth(arc) + 600 + BRIDGE_GAP + VILLAGE_MAX_R + ISLE_MARGIN;
    return { c: { x: S.x + dir.x * d, y: S.y + dir.y * d }, dir, back: Math.atan2(-dir.y, -dir.x), arc };
  }

  /** Côte de l'îlot du village dans la direction a, depuis le feu (avant le bruit fin) : la palissade, sa plage, des criques. */
  private isleEdge(a: number) {
    const k = this.isleNoise;
    return villageEdge(a) + ISLE_MARGIN + Math.sin(a * 2 + k) * 45 + Math.sin(a * 5 + k * 1.7) * 30 + Math.sin(a * 9 + k * 0.6) * 14;
  }

  /**
   * Pose l'îlot sur la carte (côte, mer peu profonde puis profonde autour). Ses cases, le bras de mer et le pont prennent
   * au plus l'abscisse du pied du pont : la porte de la Lisière, plus loin sur le couloir, ne les coupe jamais.
   */
  private stampIsle(footArc: number) {
    const v = this.village, far = SEA_SHALLOW + 560, R = VILLAGE_MAX_R + ISLE_MARGIN + 120 + far; // jusqu'au bleu du large (voir seaColor)
    const i0 = Math.max(0, Math.floor((v.x - R + WORLD_HALF) / MAP_CELL)), i1 = Math.min(N - 1, Math.floor((v.x + R + WORLD_HALF) / MAP_CELL));
    const j0 = Math.max(0, Math.floor((v.y - R + WORLD_HALF) / MAP_CELL)), j1 = Math.min(N - 1, Math.floor((v.y + R + WORLD_HALF) / MAP_CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = j * N + i, px = -WORLD_HALF + (i + 0.5) * MAP_CELL, py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        const d = Math.hypot(px - v.x, py - v.y) - this.isleEdge(Math.atan2(py - v.y, px - v.x)) - (fbm(px / 160, py / 160, this.seed + 98, 2) - 0.5) * 90;
        if (d >= far) continue;
        if (this.shore[c] >= 0) this.arc[c] = Math.min(this.arc[c], footArc); // pas l'île elle-même
        if (d >= this.shore[c]) continue;
        this.shore[c] = shoreCell(d);
        this.water[c] = d > SEA_SHALLOW ? 3 : d > 0 ? 1 : 0;
      }
    }
  }

  /** Bord d'un îlot dans la direction ang : un cercle qui ondule. */
  isletEdge(t: Islet, ang: number) {
    return t.r * (1 + (fbm(Math.cos(ang) * 1.6 + t.x / 900, Math.sin(ang) * 1.6 + t.y / 900, this.seed + 530, 2) - 0.5) * 0.45);
  }

  /**
   * Îlots du large (hasard à part : le reste de la carte ne bouge pas) : chacun au large de la côte de sa zone, dans la
   * mer peu profonde (le serpent y nage), séparé de l'île par un bras de mer, loin du village, de la plage et de l'épave.
   */
  private placeIslets() {
    const rand = rng(this.seed ^ 0x15e7);
    const lim = WORLD_HALF - SEA_SHALLOW - 500;
    for (const plan of ISLETS) {
      for (let tries = 0; tries < 400; tries++) {
        const r = 300 + rand() * 60;
        const s = this.zoneFrom(plan.zone) + 250 + rand() * Math.max(100, this.zoneTo(plan.zone) - this.zoneFrom(plan.zone) - 500);
        const side = rand() < 0.5 ? -1 : 1, c = this.spineAt(s), n = this.normalAt(s);
        // de la colonne vers le large jusqu'à la côte
        let d = 0;
        while (d < this.halfWidth(s) + 2500 && this.shoreAt(c.x + n.x * side * d, c.y + n.y * side * d) < 0) d += 16;
        const gap = 440 + rand() * 160, x = c.x + n.x * side * (d + gap + r), y = c.y + n.y * side * (d + gap + r);
        if (Math.abs(x) > lim || Math.abs(y) > lim || this.zoneAt(x, y) !== plan.zone) continue;
        // tout autour : la mer (pas une autre côte trop près), et loin du village, de la plage, de l'épave et des autres îlots
        let ok = true;
        for (let a = 0; a < 16 && ok; a++) {
          const ang = (a / 16) * Math.PI * 2;
          if (this.shoreAt(x + Math.cos(ang) * (r + 150), y + Math.sin(ang) * (r + 150)) < 80) ok = false;
        }
        if (!ok || this.inVillage(x, y, 2200) || dist2(x, y, this.spawn.x, this.spawn.y) < 2200 ** 2 || this.nearWreck(x, y, 2200)) continue;
        if (dist2(x, y, this.bridge.a.x, this.bridge.a.y) < 2000 ** 2 || this.islets.some((t) => dist2(x, y, t.x, t.y) < 2500 ** 2)) continue;
        const boss = plan.boss ? SPECIES.findIndex((sp) => sp.key === plan.boss) : -1;
        const t: Islet = { x, y, r, zone: plan.zone, boss, cave: -1, chest: boss < 0 ? { x, y: y + 10 } : null };
        this.stampIslet(t);
        this.islets.push(t);
        break;
      }
    }
  }

  /** L'îlot dans les grilles : sa terre, puis la mer peu profonde tout autour (jusqu'au large). */
  private stampIslet(t: Islet) {
    const R = t.r * 1.3 + SEA_SHALLOW + 40;
    const i0 = Math.max(0, Math.floor((t.x - R + WORLD_HALF) / MAP_CELL)), i1 = Math.min(N - 1, Math.floor((t.x + R + WORLD_HALF) / MAP_CELL));
    const j0 = Math.max(0, Math.floor((t.y - R + WORLD_HALF) / MAP_CELL)), j1 = Math.min(N - 1, Math.floor((t.y + R + WORLD_HALF) / MAP_CELL));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const c = j * N + i, px = -WORLD_HALF + (i + 0.5) * MAP_CELL, py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        const d = Math.hypot(px - t.x, py - t.y) - this.isletEdge(t, Math.atan2(py - t.y, px - t.x));
        if (d >= this.shore[c] || d >= SEA_SHALLOW + 40) continue;
        this.shore[c] = shoreCell(d);
        this.water[c] = d > SEA_SHALLOW ? 3 : d > 0 ? 1 : 0;
      }
    }
  }

  /** Grotte (ou îlot, pour un géant à l'air libre) où l'on affronte son géant, à ce point. */
  arenaAt(x: number, y: number): Cave | undefined {
    const c = this.caveAt(x, y);
    if (c) return c;
    const t = this.isletAt(x, y, 60);
    return t && t.cave >= 0 ? this.caves[t.cave] : undefined;
  }

  /** Géants des îlots, au milieu de leur îlot (ajoutés en dernier aux grottes : les autres gardent leur numéro). */
  private placeIsletCaves() {
    for (const t of this.islets) {
      if (t.boss < 0) continue;
      // à l'air libre : il se tient au milieu de son îlot (pas d'intérieur, pas d'entrée)
      const id = this.caves.length, at = { x: t.x, y: t.y + 40 };
      t.cave = id;
      this.caves.push({ id, zone: t.zone, boss: t.boss, entrance: at, inside: at, exit: at, home: { x: t.x, y: t.y - 20 }, open: this.islets.indexOf(t) });
    }
  }

  /** Îlot du large où se trouve ce point (sur sa terre ou à moins de margin de son bord), ou undefined. */
  isletAt(x: number, y: number, margin = 0) {
    return this.islets.find((t) => Math.hypot(x - t.x, y - t.y) < this.isletEdge(t, Math.atan2(y - t.y, x - t.x)) + margin);
  }

  /** Le pont de bois : du pied, sur l'île, à l'îlot, dans l'axe de la porte. */
  private placeBridge() {
    const v = this.village, g = this.gate, l = Math.hypot(g.x - v.x, g.y - v.y), ux = (g.x - v.x) / l, uy = (g.y - v.y) / l;
    // de la porte vers l'île : la côte de l'îlot (b), puis celle de l'île (a)
    let t = 0;
    while (t < 3000 && this.shoreAt(g.x + ux * t, g.y + uy * t) < 0) t += 4;
    const b = { x: g.x + ux * t, y: g.y + uy * t };
    while (t < 5000 && this.shoreAt(g.x + ux * t, g.y + uy * t) >= 0) t += 4;
    const a = { x: g.x + ux * t, y: g.y + uy * t };
    Object.assign(this.bridge, { a: { x: a.x + ux * 30, y: a.y + uy * 30 }, b: { x: b.x - ux * 30, y: b.y - uy * 30 } });
  }

  /** Cases du pont, une fois l'eau nettoyée : on n'y marche qu'une fois le pont réparé (setBridge), la mer dessous. */
  private stampBridge() {
    const { a: A, b: B } = this.bridge, half = BRIDGE_W / 2;
    for (let j = Math.floor((Math.min(A.y, B.y) - half + WORLD_HALF) / MAP_CELL); j <= Math.floor((Math.max(A.y, B.y) + half + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((Math.min(A.x, B.x) - half + WORLD_HALF) / MAP_CELL); i <= Math.floor((Math.max(A.x, B.x) + half + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i, px = -WORLD_HALF + (i + 0.5) * MAP_CELL, py = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if (this.bridgeDist(px, py) < half - 4 && (this.water[k] === 1 || this.water[k] === 3)) this.bridgeCells.push(k);
      }
    }
  }

  /** Distance au milieu du pont (dans sa longueur). */
  bridgeDist(x: number, y: number) {
    const { a, b } = this.bridge, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1);
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
  }

  /** Sur l'îlot du village (sa plage comprise) ou sur son pont : à l'abri, les monstres sauvages n'y vont pas. */
  onIsle(x: number, y: number) {
    if (x >= WORLD_HALF) return false;
    const v = this.village, d = Math.hypot(x - v.x, y - v.y);
    return d < this.isleEdge(Math.atan2(y - v.y, x - v.x)) + 50 || this.bridgeDist(x, y) < BRIDGE_W;
  }

  /**
   * Chemins : de la plage au pied du pont (il serpente, par le milieu de l'île si la ligne droite longe l'eau, puis
   * arrive dans l'axe du pont), et sur l'îlot, du bout du pont à la porte du village.
   */
  private buildPath(dir: Pt) {
    const { spawn, bridge } = this, a = bridge.a, ux = -dir.x, uy = -dir.y; // de l'îlot vers l'île
    // un peu dans les terres, dans l'axe du pont : le chemin y arrive droit
    let t = 40;
    while (t < 260 && this.shoreAt(a.x + ux * t, a.y + uy * t) < -40) t += 10;
    const q = { x: a.x + ux * Math.max(60, t - 40), y: a.y + uy * Math.max(60, t - 40) };
    const dry = (p: Pt, r: Pt) => {
      for (let k = 1; k < 40; k++) if (this.shoreAt(p.x + ((r.x - p.x) * k) / 40, p.y + ((r.y - p.y) * k) / 40) > -90) return false;
      return true;
    };
    const via = dry(spawn, q) ? [] : [this.spineAt(this.arcAt(q.x, q.y) * 0.5), this.spineAt(this.arcAt(q.x, q.y))].filter((p, i, all) => i === 0 || !dry(all[i - 1], q));
    const line: [number, number][] = [];
    const wob = (p: Pt, r: Pt, n: number, amp: number) => {
      const dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1;
      for (let i = line.length ? 1 : 0; i <= n; i++) {
        const k = i / n, w = Math.sin(k * Math.PI * 3 + this.seed) * amp * Math.sin(k * Math.PI);
        line.push([p.x + dx * k + (-dy / len) * w, p.y + dy * k + (dx / len) * w]);
      }
    };
    const stops = [spawn, ...via, q];
    for (let k = 1; k < stops.length; k++) wob(stops[k - 1], stops[k], 20, 45);
    line.push([a.x, a.y]);
    this.paths.push(line);
    // sur l'îlot : du bout du pont à la porte, tout droit
    this.paths.push([[bridge.b.x, bridge.b.y], [this.gate.x, this.gate.y]]);
  }

  /** Range les segments du chemin par case de 256 px (marge de 260 px) pour pathDist. */
  private indexPaths() {
    for (const line of this.paths) {
      for (let i = 1; i < line.length; i++) {
        const [ax, ay] = line[i - 1], [bx, by] = line[i];
        for (let gx = Math.floor((Math.min(ax, bx) - 260) / BUCKET); gx <= Math.floor((Math.max(ax, bx) + 260) / BUCKET); gx++) {
          for (let gy = Math.floor((Math.min(ay, by) - 260) / BUCKET); gy <= Math.floor((Math.max(ay, by) + 260) / BUCKET); gy++) {
            const key = gx * 100000 + gy;
            let b = this.segs.get(key);
            if (!b) this.segs.set(key, (b = []));
            b.push(ax, ay, bx, by);
          }
        }
      }
    }
  }

  /** Distance au bord du chemin (négative : dessus), plafonnée à 240 au-delà. */
  pathDist(x: number, y: number) {
    const b = this.segs.get(Math.floor(x / BUCKET) * 100000 + Math.floor(y / BUCKET));
    let best = 260;
    if (b) {
      for (let i = 0; i < b.length; i += 4) {
        const ax = b[i], ay = b[i + 1], dx = b[i + 2] - ax, dy = b[i + 3] - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
      }
    }
    return best - 20;
  }

  /** Arbres et rochers (mêmes règles que l'ancien décor : forêts denses, clairières, abords dégagés). */
  private buildDecor() {
    const n = Math.ceil(WORLD_HALF / DECO_CELL);
    for (let gy = -n; gy < n; gy++) {
      for (let gx = -n; gx < n; gx++) {
        const h = hash2(gx, gy, this.seed + 3);
        const x = (gx + 0.2 + hash2(gx, gy, this.seed + 4) * 0.6) * DECO_CELL;
        const y = (gy + 0.2 + hash2(gx, gy, this.seed + 5) * 0.6) * DECO_CELL;
        if (Math.abs(x) > WORLD_HALF - 20 || Math.abs(y) > WORLD_HALF - 20 || this.isForest(x, y) || this.shoreAt(x, y) > -BEACH - 40) continue; // ni en mer ni sur la plage
        if (this.inVillage(x, y, 80) || Math.hypot(x - this.spawn.x, y - this.spawn.y) < 230 || this.nearWreck(x, y, 220)) continue;
        if (this.sites.some((c) => Math.hypot(x - c.x, y - c.y) < 300)) continue;
        if (this.isWater(x, y) || this.isWater(x + 24, y) || this.isWater(x - 24, y) || this.isWater(x, y + 24)) continue;
        if (this.caves.some((c) => Math.hypot(x - c.entrance.x, y - c.entrance.y) < 190)) continue;
        if (this.islets.some((t) => t.chest && Math.hypot(x - t.chest.x, y - t.chest.y) < 120)) continue; // le coffre de naufragé reste dégagé
        if (this.nearVolcano(x, y, 140) || this.volcanoTrail(x, y) < 90) continue;
        if (this.ores.some((o) => Math.hypot(x - o.x, y - o.y) < 50)) continue;
        const z = this.zoneAt(x, y);
        const f = fbm(x / 700, y / 700, this.seed + 55, 3);
        const edge = this.shoreAt(x, y) > -600; // près de la côte : plus dense
        const forest = Math.max(f > 0.56 ? 4.5 : f > 0.48 ? 1.2 : 0.15, z === 2 ? 0.7 : z === JUNGLE_ZONE ? 1.1 : 0) * (edge ? 3 : 1); // Bois profonds, jungle : jamais de vraie clairière
        const treeP = [0, 0.1, 0.3, 0.09, 0.05, 0.07, 0.12, 0.025][z] * forest; // Bois profonds : sapins ; jungle : grands arbres et bambous ; désert : de rares cactus
        if (h >= treeP) continue; // les rochers ronds d'autrefois ont disparu : la pierre vient des rochers à casser
        if (this.pathDist(x, y) < 30) continue;
        const d: Decor = { id: this.decor.length, kind: 0, x, y, zone: z };
        const key = Math.floor(x / BUCKET) * 100000 + Math.floor(y / BUCKET);
        let b = this.buckets.get(key);
        if (!b) this.buckets.set(key, (b = []));
        b.push(this.decor.length);
        this.decor.push(d);
      }
    }
  }

  /**
   * Buissons à fruits, surtout dans les premières zones (hasard à part : les cartes existantes ne changent pas).
   * Franchissables, hors de l'eau, des chemins, du village et des camps.
   */
  private buildBushes() {
    const rand = rng(this.seed ^ 0xb0551e5);
    for (let tries = 0; tries < 9000 && this.bushes.length < more(110); tries++) {
      const s = 600 + Math.pow(rand(), 1.25) * (this.length - 600); // un peu plus nombreux près du départ
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 80);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (this.blocked(x, y) || this.blocked(x + 20, y) || this.blocked(x - 20, y) || this.inVillage(x, y, 120)) continue;
      if (dist2(x, y, this.spawn.x, this.spawn.y) < 260 ** 2 || this.nearWreck(x, y, 240) || this.sites.some((c) => dist2(x, y, c.x, c.y) < 320 ** 2)) continue;
      if (this.pathDist(x, y) < 40 || this.bushes.some((b) => dist2(x, y, b.x, b.y) < 300 ** 2)) continue;
      if (this.ores.some((o) => dist2(x, y, o.x, o.y) < 90 ** 2) || this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 220 ** 2)) continue;
      if (this.nearVolcano(x, y, 200)) continue;
      this.bushes.push({ id: this.bushes.length, x, y, zone: this.zoneAt(x, y) });
    }
  }

  /**
   * Rochers à casser, à la suite des filons (hasard à part : le reste de la carte ne change pas).
   * Quelques-uns entre la plage et le village, pour construire avant même de passer la porte. Le bois vient des arbres.
   */
  private buildHarvest() {
    const rand = rng(this.seed ^ 0x5707e);
    const free = (x: number, y: number) => {
      for (let a = 0; a < 8; a++) if (this.blocked(x + Math.cos(a) * 36, y + Math.sin(a) * 36)) return false;
      return !this.blocked(x, y);
    };
    for (const res of ['stone'] as const) {
      let early = 0, total = 0;
      for (let tries = 0; tries < 12000 && total < more(70); tries++) {
        // les 4 premiers entre la plage et le pont, les autres tout le long du couloir
        const first = early < 4 && tries < 2000, bridgeArc = this.gates[0] - GATE0_AFTER;
        const s = first ? 150 + rand() * Math.max(200, bridgeArc - 100) : 650 + rand() * (this.length - 900);
        const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
        const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 90);
        const x = sx + n.x * off, y = sy + n.y * off;
        if (!free(x, y) || this.inVillage(x, y, 150) || dist2(x, y, this.spawn.x, this.spawn.y) < 260 ** 2 || this.nearWreck(x, y, 240)) continue;
        if (this.sites.some((c) => dist2(x, y, c.x, c.y) < 350 ** 2) || this.pathDist(x, y) < 50) continue;
        if (this.ores.some((o) => dist2(x, y, o.x, o.y) < (first ? 160 : 300) ** 2) || this.bushes.some((b) => dist2(x, y, b.x, b.y) < 70 ** 2)) continue;
        if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 250 ** 2) || this.nearVolcano(x, y, 250)) continue;
        this.ores.push({ id: this.ores.length, x, y, zone: this.zoneAt(x, y), res, size: oreSize(x, y, this.seed) });
        this.solidOre(this.ores[this.ores.length - 1]);
        total++;
        if (first) early++;
      }
    }
  }

  /** Tanières de suricates dans la Mer de sable (hasard à part), loin des chemins, de l'eau et les unes des autres. */
  private buildDens() {
    const rand = rng(this.seed ^ 0xde75);
    const lo = this.zoneFrom(DESERT_ZONE) + 400, hi = this.zoneTo(DESERT_ZONE) - 400;
    for (let tries = 0; tries < 3000 && this.dens.length < more(DENS) && hi > lo; tries++) {
      const s = lo + rand() * (hi - lo);
      const { x: sx, y: sy } = this.spineAt(s), n = this.normalAt(s);
      const off = (rand() - 0.5) * 2 * (this.halfWidth(s) - 140);
      const x = sx + n.x * off, y = sy + n.y * off;
      if (this.zoneAt(x, y) !== DESERT_ZONE || this.blocked(x, y) || this.blocked(x + 40, y) || this.blocked(x - 40, y) || this.blocked(x, y + 30)) continue;
      if (this.pathDist(x, y) < 90 || this.nearWreck(x, y, 300) || this.dens.some((d) => dist2(x, y, d.x, d.y) < 700 ** 2)) continue;
      if (this.caves.some((c) => dist2(x, y, c.entrance.x, c.entrance.y) < 400 ** 2) || this.ores.some((o) => dist2(x, y, o.x, o.y) < 120 ** 2)) continue;
      if (this.nearVolcano(x, y, 400)) continue;
      if (this.bushes.some((b) => dist2(x, y, b.x, b.y) < 100 ** 2)) continue;
      this.dens.push({ x, y });
    }
  }

  /** Parchemin laissé par le géant de cette grotte, à côté de son coffre (au fond de la grotte). */
  scrollPos(c: Cave): Pt {
    return { x: c.inside.x + 95, y: c.inside.y - 175 };
  }

  /** Près de l'épave du bout de l'île (rien n'y pousse ni n'y apparaît). */
  nearWreck(x: number, y: number, r: number) {
    return dist2(x, y, this.shipwreck.x, this.shipwreck.y) < r * r;
  }

  /**
   * Coffre du plan de l'École des dompteurs, dans le premier camp : la place la plus proche du feu où il ne touche ni le
   * feu, ni une tente, ni le fanion, ni la Pierre de passage, ni la piste, et ne monte pas sur le nom du camp.
   */
  private placePlanChest() {
    const site = this.sites[0];
    if (!site) return;
    const lay = this.siteLayout[0], st = this.stones[1];
    type Box = [number, number, number, number]; // x0, y0, x1, y1 autour d'un point
    const at = (x: number, y: number, b: Box): Box => [x + b[0], y + b[1], x + b[2], y + b[3]];
    const others: Box[] = [
      at(0, 0, [-34, -34, 34, 24]), // feu
      ...lay.tents.map((t) => at(t.x, t.y, [-42, -30, 42, 34])),
      at(lay.flag.x, lay.flag.y, [-6, -54, 40, 10]),
      at(st.x - site.x, st.y - site.y, [-22, -64, 22, 14]),
      [-110, -190, 110, -150], // nom du camp
    ];
    const house: Box = [-30, -40, 30, 14];
    const free = (x: number, y: number, gap: number) =>
      others.every((o) => { const h = at(x, y, house); return h[2] < o[0] || h[0] > o[2] || h[3] < o[1] || h[1] > o[3]; }) &&
      this.pathDist(site.x + x, site.y + y) > gap;
    // d'abord bien à l'écart de la piste, puis un peu plus près si le camp est trop serré
    for (const gap of [70, 50, 35]) {
      for (let r = 80; r <= 190; r += 10) {
        for (let k = 0; k < 48; k++) {
          const ang = (k / 48) * Math.PI * 2, x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.75;
          if (free(x, y, gap)) return void (this.planChest = { x: site.x + x, y: site.y + y });
        }
      }
    }
    this.planChest = { x: site.x, y: site.y + 150 }; // (jamais vu) : sous le feu
  }

  /** Pont réparé (on marche sur ses planches) ou cassé (de l'eau, on ne passe pas). */
  setBridge(up: boolean) {
    for (const c of this.bridgeCells) this.water[c] = up ? 0 : 1;
  }

  /** Palissade construite (solide) ou non (on passe). Seules ses cases encore libres changent. */
  setPalisade(up: boolean) {
    for (const c of this.palisadeCells) if (this.water[c] === 0 || this.water[c] === 2) this.water[c] = up ? 2 : 0;
  }

  /** Où se construit un bâtiment du village (un emplacement à défricher est celui de son bâtiment ; la palissade : au feu). */
  buildingPos(b: BuildingId): Pt {
    if (b === 'stone') return this.stones[0];
    if (b === 'bridge') return this.bridge.a;
    if (b === 'palisade') return this.village;
    if (b === 'forge2') return this.forge; // la Grande forge : la forge améliorée, sur place
    if (b === 'school') return this.school;
    if (b === 'dock') return this.boatStone;
    return this[(b.startsWith('plot_') ? b.slice(5) : b) as 'forge' | 'den' | 'market'];
  }

  /** Tanière la plus proche d'un point (-1 s'il n'y en a pas). */
  denNear(x: number, y: number) {
    let best = -1, bd = Infinity;
    this.dens.forEach((d, i) => {
      const k = dist2(x, y, d.x, d.y);
      if (k < bd) [bd, best] = [k, i];
    });
    return best;
  }

  /** Porte (index) que franchit en avançant le déplacement de a vers b, ou -1. */
  gateCrossed(ax: number, ay: number, bx: number, by: number) {
    if (this.caveAt(ax, ay) || this.caveAt(bx, by)) return -1;
    const sa = this.arcAt(ax, ay), sb = this.arcAt(bx, by), za = this.zoneArc(ax, ay), zb = this.zoneArc(bx, by);
    return this.gates.findIndex((g, k) => (k === 0 ? sa <= g && sb > g : za <= g && zb > g));
  }

  /** Taille d'un arbre ou d'un rocher (même hasard que le dessin). */
  decorSize(d: Decor) {
    return d.kind === 0 ? 26 + hash2(d.x | 0, d.y | 0, this.seed) * 16 : 12 + hash2(d.x | 0, d.y | 0, this.seed + 1) * 14;
  }

  /** Décor dont le centre est dans le rectangle donné. */
  decorIn(x0: number, y0: number, x1: number, y1: number) {
    const out: Decor[] = [];
    for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
      for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++) {
        for (const i of this.buckets.get(bx * 100000 + by) ?? []) {
          const d = this.decor[i];
          if (d.x >= x0 && d.x <= x1 && d.y >= y0 && d.y <= y1) out.push(d);
        }
      }
    }
    return out;
  }

  // ── Obstacles solides, inscrits dans la grille (valeur 2) ──

  private solidDisc(x: number, y: number, r: number) {
    for (let j = Math.floor((y - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((y + r + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((x - r + WORLD_HALF) / MAP_CELL); i <= Math.floor((x + r + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const cx = -WORLD_HALF + (i + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r && this.water[j * N + i] === 0) this.water[j * N + i] = 2;
      }
    }
  }

  /** Filon ou tas à récolter : solide tant qu'il n'est pas épuisé (voir oreDown). */
  private solidOre(o: Ore) {
    const r = oreRadius(o);
    for (let j = Math.floor((o.y - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((o.y + r + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((o.x - r + WORLD_HALF) / MAP_CELL); i <= Math.floor((o.x + r + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const cx = -WORLD_HALF + (i + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL, k = j * N + i;
        if ((cx - o.x) ** 2 + (cy - o.y) ** 2 <= r * r && this.water[k] === 0) {
          this.water[k] = 4;
          this.oreCell.set(k, o.id);
        }
      }
    }
  }

  /** Case infranchissable (un filon épuisé ou un arbre abattu ne l'est plus). */
  private solid(k: number) {
    const v = this.water[k];
    return v !== 0 && !(v === 4 && this.oreDown.has(this.oreCell.get(k)!)) && !(v === 5 && this.treeDown.has(this.treeCell.get(k)!));
  }

  /** Tronc d'un arbre, à abattre : solide tant qu'il est debout (voir treeDown). */
  private solidTree(i: number) {
    const d = this.decor[i], s = this.decorSize(d), x = d.x, y = d.y + s * 0.15, r = s * 0.45;
    for (let j = Math.floor((y - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((y + r + WORLD_HALF) / MAP_CELL); j++) {
      for (let c = Math.floor((x - r + WORLD_HALF) / MAP_CELL); c <= Math.floor((x + r + WORLD_HALF) / MAP_CELL); c++) {
        if (c < 0 || j < 0 || c >= N || j >= N) continue;
        const cx = -WORLD_HALF + (c + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL, k = j * N + c;
        if ((cx - x) ** 2 + (cy - y) ** 2 <= r * r && this.water[k] === 0) {
          this.water[k] = 5;
          this.treeCell.set(k, i);
        }
      }
    }
  }

  /** Arbre de la Mer de sable hors de sa lisière verte (là, des palmiers) : un cactus, qui pique. Même règle que le dessin. */
  isCactus(d: Decor) {
    return d.kind === 0 && this.styleZone(d.x, d.y) === DESERT_ZONE && coastGreen(this, d.x, d.y) <= 0.45;
  }

  /** Tronc d'un arbre (pour l'abattre) : centre et rayon. */
  /** Bois et coups de hache d'un arbre selon sa taille : de ×0,5 (le plus petit) à ×1,5 (le plus grand). */
  treeScale(d: Decor) {
    return 0.5 + (this.decorSize(d) - 26) / 16;
  }

  trunkOf(d: Decor) {
    const s = this.decorSize(d);
    return { x: d.x, y: d.y + s * 0.15, r: s * 0.45 };
  }

  /** Arbres (index dans decor) dont le tronc est à moins de r de (x, y). */
  treesNear(x: number, y: number, r: number) {
    const out: number[] = [];
    for (let bx = Math.floor((x - r - 40) / BUCKET); bx <= Math.floor((x + r + 40) / BUCKET); bx++) {
      for (let by = Math.floor((y - r - 40) / BUCKET); by <= Math.floor((y + r + 40) / BUCKET); by++) {
        for (const i of this.buckets.get(bx * 100000 + by) ?? []) {
          const d = this.decor[i];
          if (d.kind !== 0) continue;
          const t = this.trunkOf(d);
          if ((t.x - x) ** 2 + (t.y - y) ** 2 <= (r + t.r) ** 2) out.push(i);
        }
      }
    }
    return out;
  }

  private solidRect(x0: number, y0: number, x1: number, y1: number) {
    for (let j = Math.floor((y0 + WORLD_HALF) / MAP_CELL); j <= Math.floor((y1 + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((x0 + WORLD_HALF) / MAP_CELL); i <= Math.floor((x1 + WORLD_HALF) / MAP_CELL); i++) {
        if (i >= 0 && j >= 0 && i < N && j < N && this.water[j * N + i] === 0) this.water[j * N + i] = 2;
      }
    }
  }

  private buildSolids() {
    // arbres (tronc et bas du feuillage) et rochers
    this.decor.forEach((d, i) => {
      if (d.kind === 0) this.solidTree(i);
      else this.solidDisc(d.x, d.y, this.decorSize(d) * 0.85);
    });
    for (const o of this.ores) this.solidOre(o);
    // palissade du village, avec ses 4 portes : ses cases ne deviennent solides qu'une fois construite (setPalisade)
    const v = this.village;
    const marked = new Set<number>();
    for (let a = 0; a < Math.PI * 2; a += 0.015) {
      if (atVillageGate(a)) continue;
      const px = v.x + Math.cos(a) * villageEdge(a), py = v.y + Math.sin(a) * villageEdge(a), r = 13;
      for (let j = Math.floor((py - r + WORLD_HALF) / MAP_CELL); j <= Math.floor((py + r + WORLD_HALF) / MAP_CELL); j++) {
        for (let i = Math.floor((px - r + WORLD_HALF) / MAP_CELL); i <= Math.floor((px + r + WORLD_HALF) / MAP_CELL); i++) {
          const cx = -WORLD_HALF + (i + 0.5) * MAP_CELL, cy = -WORLD_HALF + (j + 0.5) * MAP_CELL, c = j * N + i;
          if ((cx - px) ** 2 + (cy - py) ** 2 <= r * r && this.water[c] === 0 && !marked.has(c)) marked.add(c);
        }
      }
    }
    this.palisadeCells = [...marked];
    // bâtiments (construits ou non, leur emplacement est clos) : hutte, marché, forge (et son enclume), tanière, feu de camp
    for (const [hx, hy] of [[MARKET_OFFSET.x, MARKET_OFFSET.y], [HALL_OFFSET.x, HALL_OFFSET.y]]) this.solidRect(v.x + hx - 52, v.y + hy - 6, v.x + hx + 52, v.y + hy + 40);
    this.solidRect(v.x + FORGE_OFFSET.x - 74, v.y + FORGE_OFFSET.y - 30, v.x + FORGE_OFFSET.x + 2, v.y + FORGE_OFFSET.y + 38);
    this.solidRect(v.x + FORGE_OFFSET.x + 10, v.y + FORGE_OFFSET.y + 12, v.x + FORGE_OFFSET.x + 54, v.y + FORGE_OFFSET.y + 38);
    for (const k of [-1, 0, 1]) this.solidDisc(v.x + DEN_OFFSET.x + k * 46, v.y + DEN_OFFSET.y - 6, 38);
    this.solidDisc(v.x, v.y, 20);
    this.solidDisc(this.elder.x, this.elder.y, 16); // le vieil homme
    this.solidRect(v.x + STORE_OFFSET.x - 36, v.y + STORE_OFFSET.y - 14, v.x + STORE_OFFSET.x + 36, v.y + STORE_OFFSET.y + 14); // entrepôt
    this.solidRect(v.x + BOARD_OFFSET.x - 18, v.y + BOARD_OFFSET.y - 2, v.x + BOARD_OFFSET.x + 18, v.y + BOARD_OFFSET.y + 4); // panneau
    // plage d'arrivée : la barque échouée
    this.solidDisc(this.spawn.x + this.wreck.boat.x, this.spawn.y + this.wreck.boat.y, 30);
    // emplacements de camp : cercle de pierres du feu ; Pierres de passage
    for (const c of this.sites) this.solidDisc(c.x, c.y, 26);
    for (const st of this.stones) this.solidDisc(st.x, st.y, 18);
    this.solidRect(this.school.x - 54, this.school.y - 24, this.school.x + 54, this.school.y + 8); // l'école (même pas encore bâtie : son chantier)
    if (this.sites.length) this.solidRect(this.planChest.x - 18, this.planChest.y - 10, this.planChest.x + 18, this.planChest.y + 6); // coffre du plan
    // butte rocheuse des grottes (l'ouverture, devant, reste libre)
    for (const c of this.caves) {
      const { x, y } = c.entrance;
      if (x >= WORLD_HALF || c.zone === VOYAGE_ZONE || c.open !== undefined) continue; // antre du volcan (hors de la grille), bateau, géant d'îlot à l'air libre : pas de butte
      this.solidDisc(x - 68, y - 20, 42);
      this.solidDisc(x + 68, y - 20, 42);
      this.solidRect(x - 60, y - 88, x + 60, y - 42);
    }
  }

  /** Grotte dont l'intérieur contient ce point, s'il y en a une. */
  caveAt(x: number, y: number): Cave | undefined {
    if (x < WORLD_HALF) return undefined;
    const inside = (c: Cave) => {
      const { rx, ry } = caveRadii(c), nx = (x - c.inside.x) / rx, ny = (y - c.inside.y) / ry;
      return nx * nx + ny * ny < caveEdge(c, Math.atan2(ny, nx)) ** 2;
    };
    return inside(this.depths) ? this.depths : this.caves.find(inside);
  }

  /**
   * La haute mer : prendre le bateau mène sur son pont, au large (une « grotte » hors de l'île, dont l'entrée est le
   * bateau rebâti, côté terre de l'épave). Autour du pont, la mer ; le Kraken attend contre le flanc, dans l'eau.
   */
  private placeVoyage(bosses: number[]) {
    const sw = this.shipwreck, bs = this.boatStone;
    for (const boss of bosses) {
      const id = this.caves.length, inside = { x: WORLD_HALF + 1400 + id * CAVE_GAP, y: 0 };
      this.caves.push({
        id, zone: VOYAGE_ZONE, boss, rx: SEA_RX, ry: SEA_RY, inside,
        entrance: { x: sw.x + (bs.x - sw.x) * 0.45, y: sw.y + (bs.y - sw.y) * 0.45 },
        exit: { x: inside.x - DECK_RX + 110, y: inside.y + 20 }, // à la poupe
        home: { x: inside.x + 90, y: inside.y - DECK_RY - 75 }, // contre le flanc, côté bâbord
        spots: [
          { x: inside.x + 90, y: inside.y - DECK_RY - 75 }, // bâbord
          { x: inside.x - 140, y: inside.y + DECK_RY + 75 }, // tribord
          { x: inside.x + DECK_RX + 110, y: inside.y + 10 }, // devant la proue (jamais à la poupe : on y fait demi-tour)
        ],
      });
    }
  }

  /** Le voyage en haute mer (ou undefined s'il n'y en a pas). */
  get voyage() {
    return this.caves.find((c) => c.zone === VOYAGE_ZONE);
  }

  /** Sur le pont du bateau : coque pointue vers la proue (à droite), mât au milieu. */
  onDeck(c: Cave, x: number, y: number) {
    const dx = (x - c.inside.x) / DECK_RX, dy = (y - c.inside.y) / DECK_RY;
    if (dist2(x, y, c.inside.x + 40, c.inside.y) < 26 ** 2) return false; // le mât
    const taper = dx > 0 ? 1 - dx * dx * dx * 0.75 : 1; // la proue s'affine
    return Math.abs(dx) ** 2.6 + (dy / taper) ** 2 < 1;
  }

  /** Dans la salle du volcan : mares de lave, autel du cœur et buttes des antres (les seuls obstacles). */
  private hallSolid(x: number, y: number) {
    const h = this.depths.inside;
    if (dist2(x, y, h.x, h.y) < 34 ** 2) return true; // l'autel
    if (this.lavaPools.some((p) => dist2(x, y, p.x, p.y) < p.r * p.r)) return true;
    return this.caves.some((c) => {
      if (c.zone !== VOLCANO_ZONE) return false;
      const { x: ex, y: ey } = c.entrance;
      return dist2(x, y, ex - 68, ey - 20) < 42 ** 2 || dist2(x, y, ex + 68, ey - 20) < 42 ** 2 || (x > ex - 60 && x < ex + 60 && y > ey - 88 && y < ey - 42);
    });
  }

  /** Dans la base du volcan (l'obstacle lui-même). */
  inVolcano(x: number, y: number) {
    const v = this.volcano, nx = (x - v.x) / VOLCANO_R, ny = (y - v.y) / (VOLCANO_R * VOLCANO_RY);
    return nx * nx + ny * ny < 1;
  }

  /** Près du volcan : dans sa base (agrandie de margin), ou devant son entrée. */
  nearVolcano(x: number, y: number, margin: number) {
    const v = this.volcano, nx = (x - v.x) / (VOLCANO_R + margin), ny = (y - v.y) / (VOLCANO_R * VOLCANO_RY + margin);
    return nx * nx + ny * ny < 1 || dist2(x, y, this.volcanoMouth.x, this.volcanoMouth.y) < (margin + 150) ** 2;
  }

  /** Distance à la piste qui va de la voie centrale à l'entrée du volcan (gardée au sec et dégagée). */
  volcanoTrail(x: number, y: number) {
    const a = this.volcanoMouth, b = this.volcanoTrailEnd, dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1);
    return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
  }
  private volcanoTrailEnd: Pt = { x: 0, y: 0 };

  /**
   * Le volcan : dans la Mer de sable, d'un côté de la voie centrale, sa base entière sur la terre ferme et loin de la
   * côte ; son entrée devant (en bas à l'écran), reliée à la voie centrale. Sa base devient un obstacle solide.
   */
  private placeVolcano() {
    const rand = rng(this.seed ^ 0x701ca0);
    const R = VOLCANO_R, RY = R * VOLCANO_RY, z0 = this.zoneFrom(ZONES), span = this.zoneTo(ZONES) - z0;
    const fits = (cx: number, cy: number, coast: number) => {
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * TAU, x = cx + Math.cos(a) * R * 1.2, y = cy + Math.sin(a) * RY * 1.2;
        if (this.shoreAt(x, y) > -coast || this.cdist[this.cellOf(x, y)] < LANE + 260) return false;
      }
      const m = { x: cx, y: cy + RY + 60 };
      return this.shoreAt(m.x, m.y) < -coast && !this.nearWreck(cx, cy, 1800) && !this.sites.some((c) => dist2(cx, cy, c.x, c.y) < 2000 ** 2);
    };
    let best: Pt | null = null;
    for (const coast of [450, 250, 80]) {
      for (let tries = 0; tries < 600 && !best; tries++) {
        const s = z0 + (0.25 + rand() * 0.55) * span, side = rand() < 0.5 ? -1 : 1;
        const lo = R + LANE + 350, hi = this.halfWidth(s) - RY - coast;
        if (hi < lo) continue;
        const off = side * (lo + rand() * (hi - lo)), c = this.spineAt(s), n = this.normalAt(s);
        const x = c.x + n.x * off, y = c.y + n.y * off;
        if (fits(x, y, coast)) best = { x, y };
      }
      if (best) break;
    }
    // (petite île, jamais vu) : au milieu du désert, au bord de la voie centrale
    if (!best) {
      const s = z0 + span * 0.5, c = this.spineAt(s), n = this.normalAt(s);
      best = { x: c.x + n.x * (R + LANE + 200), y: c.y + n.y * (R + LANE + 200) };
    }
    this.volcano = best;
    this.volcanoMouth = { x: best.x, y: best.y + RY + 60 };
    // la piste : de l'entrée au point le plus proche de la voie centrale
    const s = this.arc[this.cellOf(this.volcanoMouth.x, this.volcanoMouth.y)];
    this.volcanoTrailEnd = this.spineAt(s);
    // base du volcan : solide (même en vol, on le contourne)
    for (let j = Math.floor((best.y - RY + WORLD_HALF) / MAP_CELL); j <= Math.floor((best.y + RY + WORLD_HALF) / MAP_CELL); j++) {
      for (let i = Math.floor((best.x - R + WORLD_HALF) / MAP_CELL); i <= Math.floor((best.x + R + WORLD_HALF) / MAP_CELL); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const x = -WORLD_HALF + (i + 0.5) * MAP_CELL, y = -WORLD_HALF + (j + 0.5) * MAP_CELL;
        if (((x - best.x) / R) ** 2 + ((y - best.y) / RY) ** 2 < 1 && this.water[j * N + i] !== 3) this.water[j * N + i] = 2;
      }
    }
    // la salle, sous le volcan : hors du monde, sous la rangée des grottes (assez loin pour ne rien en voir)
    const inside = { x: WORLD_HALF + 1400 + HALL_RX * 1.1, y: CAVE_RY + HALL_RY * 1.1 + 4600 };
    this.depths = { ...this.depths, entrance: this.volcanoMouth, inside, exit: { x: inside.x, y: inside.y + HALL_RY - 110 } };
  }

  /**
   * Antres des géants du volcan, dans la salle : en arc dans sa moitié haute, l'intérieur de chacun hors du monde comme
   * une grotte ordinaire. Puis les mares de lave, à l'écart du centre, de la sortie, des antres et des passages qui y mènent.
   */
  private placeLairs(bosses: number[]) {
    const h = this.depths.inside;
    bosses.forEach((boss, k) => {
      const a = -Math.PI / 2 + (k - (bosses.length - 1) / 2) * 0.95;
      const entrance = { x: h.x + Math.cos(a) * HALL_RX * 0.66, y: h.y + Math.sin(a) * HALL_RY * 0.66 + 60 };
      const id = this.caves.length, inside = { x: WORLD_HALF + 1400 + id * CAVE_GAP, y: 0 };
      this.caves.push({ id, zone: VOLCANO_ZONE, boss, entrance, inside, exit: { x: inside.x, y: inside.y + CAVE_RY - 90 } });
    });
    const rand = rng(this.seed ^ 0x1a7a);
    const lanes = [this.depths.exit, ...this.caves.filter((c) => c.zone === VOLCANO_ZONE).map((c) => ({ x: c.entrance.x, y: c.entrance.y + 70 }))];
    const toLane = (x: number, y: number) =>
      Math.min(...lanes.map((a) => {
        const dx = h.x - a.x, dy = h.y - a.y, l2 = dx * dx + dy * dy || 1, t = clamp(((x - a.x) * dx + (y - a.y) * dy) / l2, 0, 1);
        return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
      }));
    for (let tries = 0; tries < 600 && this.lavaPools.length < 7; tries++) {
      const a = rand() * TAU, k = Math.sqrt(rand()) * 0.82, r = 50 + rand() * 55;
      const x = h.x + Math.cos(a) * HALL_RX * k * caveEdge(this.depths, a), y = h.y + Math.sin(a) * HALL_RY * k * caveEdge(this.depths, a);
      if (dist2(x, y, h.x, h.y) < (r + 220) ** 2 || toLane(x, y) < r + 90) continue;
      if (lanes.some((l) => dist2(x, y, l.x, l.y) < (r + 190) ** 2)) continue;
      if (this.lavaPools.some((p) => dist2(x, y, p.x, p.y) < (r + p.r + 120) ** 2)) continue;
      this.lavaPools.push({ x, y, r });
    }
  }

  /** Bruit des lacs : coordonnées tournées et déformées pour des rives organiques, pas alignées sur la grille. */
  /**
   * Bruit des lacs : deux grilles de bruit tournées l'une par rapport à l'autre et moyennées, plus une déformation
   * large et une fine, pour des berges organiques (une seule grille donne par endroits des bords presque droits).
   */
  private lakeNoise(x: number, y: number) {
    const wx = (fbm(x / 900, y / 900, this.seed + 13, 2) - 0.5) * 700 + (fbm(x / 260, y / 260, this.seed + 14, 2) - 0.5) * 220;
    const wy = (fbm(x / 900, y / 900, this.seed + 17, 2) - 0.5) * 700 + (fbm(x / 260, y / 260, this.seed + 18, 2) - 0.5) * 220;
    const X = x + wx, Y = y + wy;
    const a = fbm((X * 0.8 - Y * 0.6) / 620, (X * 0.6 + Y * 0.8) / 620, this.seed + 77, 4);
    const b = fbm((X * 0.26 + Y * 0.97) / 560, (-X * 0.97 + Y * 0.26) / 560, this.seed + 79, 4);
    return 0.5 + (a + b - 1) * 0.72; // la moyenne de deux bruits est plus resserrée : on la rétablit
  }

  /** Infranchissable : eau, obstacle solide (arbre, rocher, mur) ou hors du monde. */
  blocked(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) {
      const c = this.caveAt(x, y);
      if (c?.zone === VOYAGE_ZONE) return !this.onDeck(c, x, y); // au large : tout sauf le pont, c'est la mer
      return !c || (c === this.depths && this.hallSolid(x, y));
    }
    return this.solid(Math.floor((y + WORLD_HALF) / MAP_CELL) * N + Math.floor((x + WORLD_HALF) / MAP_CELL));
  }

  isWater(x: number, y: number) {
    if (x <= -WORLD_HALF || y <= -WORLD_HALF || x >= WORLD_HALF || y >= WORLD_HALF) return false;
    return this.water[Math.floor((y + WORLD_HALF) / MAP_CELL) * N + Math.floor((x + WORLD_HALF) / MAP_CELL)] === 1;
  }

  /** Zone de danger (1 à 4) d'un point : tronçon du couloir, frontière déformée par du bruit. */
  zoneAt(x: number, y: number) {
    const cave = this.caveAt(x, y);
    if (cave) return cave.zone;
    return clamp(Math.floor(this.zonePos(x, y)), 1, ZONES);
  }

  /** Position continue le long des zones : 1,5 = milieu de la zone 1, 2,0 = frontière entre les zones 1 et 2. */
  private zonePos(x: number, y: number) {
    const u = (this.zoneArc(x, y) - ZONE1_EXTRA) / this.zoneLen; // en parts de zone
    if (u <= 0) return 1 + u;
    let z = 1;
    while (z < ZONES && u >= ZONE_CUM[z]) z++;
    return z + (u - ZONE_CUM[z - 1]) / ZONE_WEIGHTS[z - 1];
  }

  /**
   * Affichage seulement (les règles suivent zoneAt) : près d'une frontière, les deux zones voisines se mélangent sur
   * une bande de ZONE_BLEND px. z0 → z1, t de 0 (tout z0) à 1 (tout z1) en traversant la bande ; ailleurs t = 0.
   */
  zoneMix(x: number, y: number) {
    const cave = this.caveAt(x, y);
    if (cave) return { z0: cave.zone, z1: cave.zone, t: 0 };
    const p = this.zonePos(x, y), k = Math.round(p), half = ZONE_BLEND / 2 / this.zoneLen, d = p - k;
    if (k <= 1 || k > ZONES || Math.abs(d) >= half) {
      const z = clamp(Math.floor(p), 1, ZONES);
      return { z0: z, z1: z, t: 0 };
    }
    const u = (d + half) / (2 * half);
    return { z0: k - 1, z1: k, t: u * u * (3 - 2 * u) };
  }

  /** Zone dont un élément du décor (arbre, buisson, herbe) prend le style : dans la bande de transition, par plaques. */
  styleZone(x: number, y: number) {
    const m = this.zoneMix(x, y);
    if (!m.t) return m.z0;
    return fbm(x / 300, y / 300, this.seed + 71, 2) * 0.7 + hash2(x | 0, y | 0, this.seed + 72) * 0.3 < m.t ? m.z1 : m.z0;
  }

  /** Où l'on réapparaît après une mort en (x, y) : le camp établi le plus avancé qui n'est pas plus loin sur le couloir (-1 : village). */
  respawnSite(x: number, y: number, camps: number[]) {
    const s = this.arcAt(x, y);
    let best = -1, bestS = -1;
    for (const c of camps) {
      const site = this.sites[c];
      if (!site) continue;
      const cs = this.arcAt(site.x, site.y);
      if (cs <= s + 300 && cs > bestS) [best, bestS] = [c, cs];
    }
    return best;
  }

  /** Emplacement de camp (index) dont le rayon contient ce point, ou -1. */
  siteAt(x: number, y: number, r: number) {
    return this.sites.findIndex((c) => dist2(x, y, c.x, c.y) < r * r);
  }

  /** Dans la palissade (élargie de margin). */
  inVillage(x: number, y: number, margin = 0) {
    const dx = x - this.village.x, dy = y - this.village.y, d2 = dx * dx + dy * dy;
    if (d2 > (VILLAGE_MAX_R + margin) ** 2) return false;
    return d2 < (VILLAGE_MIN_R + margin) ** 2 || d2 < (villageEdge(Math.atan2(dy, dx)) + margin) ** 2;
  }

  /** Ligne droite praticable entre deux points (échantillonnée tous les 8 px). */
  clearLine(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 8);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (this.blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false;
    }
    return true;
  }

  /**
   * Chemin qui contourne les obstacles (A* sur la grille de 16 px, 8 directions, sans couper les coins),
   * puis lissé : on ne garde que les points nécessaires. null si rien de trouvé (ou hors du monde).
   */
  findPath(ax: number, ay: number, bx: number, by: number, maxNodes = 5000): Pt[] | null {
    const cell = (v: number) => Math.floor((v + WORLD_HALF) / MAP_CELL);
    const si = cell(ax), sj = cell(ay);
    let gi = cell(bx), gj = cell(by);
    const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
    if (!inside(si, sj) || !inside(gi, gj)) return null;
    if (this.solid(gj * N + gi)) {
      const f = this.freeNear(bx, by);
      [gi, gj] = [cell(f.x), cell(f.y)];
    }
    const goal = gj * N + gi, start = sj * N + si;
    const g = new Map<number, number>([[start, 0]]);
    const from = new Map<number, number>();
    const heap: [number, number][] = [[0, start]]; // [f, index]
    const h = (i: number, j: number) => {
      const dx = Math.abs(i - gi), dy = Math.abs(j - gj);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const push = (f: number, k: number) => {
      heap.push([f, k]);
      for (let c = heap.length - 1; c > 0; ) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let c = 0; ; ) {
          const l = 2 * c + 1, r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    let found = false, expanded = 0;
    while (heap.length && expanded++ < maxNodes) {
      const [, k] = pop();
      if (k === goal) {
        found = true;
        break;
      }
      const ci = k % N, cj = (k - ci) / N, gk = g.get(k)!;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!inside(ni, nj) || this.solid(nj * N + ni)) continue;
          if (di && dj && (this.solid(cj * N + ni) || this.solid(nj * N + ci))) continue; // pas de coin coupé
          const nk = nj * N + ni, ng = gk + (di && dj ? 1.414 : 1);
          if (ng >= (g.get(nk) ?? Infinity)) continue;
          g.set(nk, ng);
          from.set(nk, k);
          push(ng + h(ni, nj), nk);
        }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    for (let k: number | undefined = goal; k !== undefined && k !== start; k = from.get(k)) {
      const i = k % N, j = (k - i) / N;
      cells.push({ x: -WORLD_HALF + (i + 0.5) * MAP_CELL, y: -WORLD_HALF + (j + 0.5) * MAP_CELL });
    }
    cells.reverse();
    // Lissage : depuis chaque point, on saute au plus loin visible en ligne droite.
    const out: Pt[] = [];
    let cur = { x: ax, y: ay }, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.clearLine(cur.x, cur.y, cells[j].x, cells[j].y)) j--;
      out.push(cells[j]);
      cur = cells[j];
      i = j + 1;
    }
    return out;
  }

  /** Point libre (hors de l'eau) le plus proche autour de (x, y), en spirale. */
  freeNear(x: number, y: number) {
    if (!this.blocked(x, y)) return { x, y };
    for (let r = MAP_CELL; r < 600; r += MAP_CELL) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (!this.blocked(px, py)) return { x: px, y: py };
      }
    }
    return { x: this.village.x, y: this.village.y };
  }

  /** Point le plus proche, à moins de maxR, qui vérifie ok (en spirale, de plus en plus loin), ou null. */
  private nearestWhere(x: number, y: number, maxR: number, ok: (x: number, y: number) => boolean) {
    if (ok(x, y)) return { x, y };
    for (let r = MAP_CELL / 2; r <= maxR; r += MAP_CELL / 2) {
      const n = Math.max(12, Math.ceil((r * Math.PI * 2) / MAP_CELL));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  /** Eau navigable la plus proche (pas une flaque en bord de rive : de l'eau tout autour), ou null. */
  waterNear(x: number, y: number, maxR: number) {
    const d = MAP_CELL * 0.6;
    return this.nearestWhere(x, y, maxR, (px, py) => this.isWater(px, py) && this.isWater(px + d, py) && this.isWater(px - d, py) && this.isWater(px, py + d) && this.isWater(px, py - d));
  }

  /** Terre ferme la plus proche (où l'on peut marcher), ou null. */
  landNear(x: number, y: number, maxR: number) {
    return this.nearestWhere(x, y, maxR, (px, py) => !this.blocked(px, py));
  }

  /** Où l'on peut aller : à pied, tout sauf l'eau et les obstacles ; sur une monture nageuse, seulement l'eau. */
  passable(x: number, y: number, swimming: boolean, flying = false) {
    // en vol : tout sauf la forêt du bord… et le volcan, trop haut (et son panache, trop chaud) pour le survoler
    if (flying) return this.caveAt(x, y) ? !this.blocked(x, y) : !this.isForest(x, y) && !this.inVolcano(x, y);
    return swimming ? this.isWater(x, y) : !this.blocked(x, y);
  }
}
