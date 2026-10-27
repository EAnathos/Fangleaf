// Boucle de jeu côté client : prédiction locale du joueur, rendu, événements.

import { alphaStats, sleeperBlocks, SHORE_R, swimMount, flyMount, ARC_FLIGHT_S, BUILDINGS, gateHall, gateOpen, HALL, zoneBosses, CAMP_R, campName, CLASSES, SPECS, LEGEND_MULT, MOVE_NAMES, WEB_SLOW, MOUNT_REACH, MOUNTS, PLAYER_SPEED, SPECIES, TICK_HZ, BOAT_STAGES, dockStoneOn, SWORD_PULLS, VILLAGE_R, WORLD_HALF, bootsSpeed, torchRadius, ZONE_NAMES, DESERT_ZONE, JUNGLE_ZONE, LAKES_ZONE, rideSpeed, SCHOOL_CAMP, SCHOOL_BUILD_MS, bookName, DISCIPLINES, LESSON_KINDS, VOLCANO_R, VOLCANO_RY, VOLCANO_ZONE, VOYAGE_ZONE, volcanoOpen, HEART_IN_BOAT, STORM_PUSH, STORM_WIND, TORNADO_PULL, TORNADO_PULL_R } from '../../shared/config.ts';
import { clamp, hash2 } from '../../shared/math.ts';
import type { GameEvent, HazardTuple, PlayerState, ServerMsg, ShotTuple, UnitTuple } from '../../shared/protocol.ts';
import { PET_ACTS, HAZARD_STYLES, UNIT_FLAG_GUARD, UNIT_FLAG_POISON, UNIT_FLAG_RALLY, UNIT_FLAG_PHASE2, UNIT_FLAG_PHASE3, UNIT_FLAG_ALPHA, UNIT_FLAG_ASLEEP, UNIT_FLAG_HIDDEN, UNIT_FLAG_DORMANT, UNIT_FLAG_LEGEND, UNIT_FLAG_MOUNTED } from '../../shared/protocol.ts';
import { BOSS_LINES } from './speciesInfo.ts';
import { type Cast, castPose, drawRock, drawWebGlob, ghostOf, impactOf, lobbed, lungePose, type Pose, REST } from './anim.ts';
import { type Ambience, sound } from './audio.ts';
import { Fog } from './fog.ts';
import { Fx } from './fx.ts';
import { playWakeUp } from './intro.ts';
import { eggsOf, elderName, HATCHLINGS } from './elder.ts';
import { buildingNear, Hud } from './hud.ts';
import { aim, initInput, moveDir, stick } from './input.ts';
import { actionOf, keyLabel, matches, maxDpr, settings, touchOnly } from './settings.ts';
import type { Net } from './net.ts';
import { drawBrokenEgg, drawElder, drawQuestMark, drawStump, drawHatchling, drawPlantedSword, drawScroll, drawWholeEgg, drawBurrow, drawSoaring, drawSoaringShadow, drawTorch, drawBuffs, drawBush, drawChest, drawHazard, drawLaser, drawTornado, type Laser, rgbOf, drawOre, drawPlayer, drawShot, drawUnit, drawWebbed, hops, hpBar, type Tool, type UnitLook } from './sprites.ts';
import { GLOW, SkyFx } from './sky.ts';
import { desertMix, jungleMix, lakesMix, terraceAt, World } from './world.ts';
import { sky as skyAt } from '../../shared/weather.ts';
import { HALL_ID, WorldMap } from '../../shared/worldmap.ts';
import { drawBoatHeart, drawDepths, drawVolcano, VOLCANO_H } from './volcano.ts';
import { drawSubmerged, drawVoyage } from './voyage.ts';

/** Dégâts affichés arrondis à 2 décimales, à la française : 6,4 · 12 · 4,85. */
/** Nom propre d'un géant (sinon le nom de son espèce). */
const bossName = (s: number) => SPECIES[s].title ?? SPECIES[s].name;
const MIST_FADE_S = 2.5; // une brume qui se lève met ce temps à se dissiper
const SPRITE_FPS = 20; // animation des monstres (images par seconde)
const SHOUT_ANIM_S = 1.1; // un Alpha suricate se dresse et crie (un escargot dresse sa carapace) pendant ce temps-là
const fmtDmg = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

const HOP_S = 0.3; // durée du petit saut d'un changement de palier
const FLY_HEIGHT = 2.2; // hauteur de vol à dos de vautour (en rayons de l'oiseau)

const GEAR_NAMES = { weapon: 'Arme améliorée', armor: 'Armure améliorée', torch: 'Torche améliorée', boots: 'Bottes améliorées', saddle: 'Selle améliorée' };

// En local seulement : ?ciel=nuit, ?ciel=pluie, ?ciel=orage (nuit et pluie) ou ?ciel=tempete (dans la Mer de sable) pour voir le ciel sans attendre.
const SKY_TEST = import.meta.env.DEV ? ({ nuit: { light: 0, dusk: 0 }, pluie: { rain: 1 }, orage: { light: 0, dusk: 0, rain: 1 }, tempete: { storm: 1 } } as Record<string, object>)[new URLSearchParams(location.search).get('ciel') ?? ''] : undefined;

/** Rayon runique suivi par le client : angle et vitesse de rotation (extrapolés entre deux snapshots), dernier passage, sol brûlé. */
interface LaserState {
  a: number;
  w: number;
  snap: number;
  len: number;
  seen: number;
  tip?: [number, number];
  spark: number;
  lit: boolean;
  laser: Omit<Laser, 'tx' | 'ty' | 'k' | 'since' | 'fade'>;
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private world: World;
  private map: WorldMap;
  private hud: Hud;
  private fx = new Fx();
  private skyFx = new SkyFx(); // nuit et pluie
  private dt = 0;
  private palisadeUp = false;
  private bridgeUp: boolean | null = null;
  me = { x: 0, y: 0, fx: 1, fy: 0, moving: false };
  private flashes = new Map<number, number>();
  private charges = new Map<number, number>(); // tireur → début de la charge de son tir
  private steps = new Map<number, { lvl: number; x: number; y: number; at: number; up: boolean }>(); // palier de chacun, dernier saut
  private wings = new Map<number, { k: number; at: number; x: number; y: number; ang: number }>(); // vautours de la meute : 0 posé, 1 en vol
  private chestOpen = new Map<number, number>(); // coffre → moment où on l'a ouvert (animation du couvercle)
  private chestSeen = new Map<number, number>(); // coffre → première apparition (il tombe en rebondissant)
  private fades = new Map<object, number>();
  private chopAt = new Map<number, number>(); // arbre → dernier coup de hache (il tremble)
  private gatesOpen: boolean[] | null = null; // état des portes au dernier snapshot (null : pas encore connu)
  private gateToast = -99; // dernier rappel « porte fermée » // arbre → opacité de son feuillage (1 : opaque)
  private tools = new Map<number, { kind: Tool['kind']; at: number; tx: number; ty: number }>(); // dompteur → dernier coup d'outil (récolte)
  private shotsAt = 0; // réception du dernier snapshot (les projectiles droits sont extrapolés depuis)
  private faces = new Map<number, { x: number; y: number; face: number; movedAt: number }>();
  private lastFrame = performance.now();
  private time = 0;
  private scale = 1;
  private sendTimer = 0;
  private boardTimer = 0; // prochain rafraîchissement du tableau du village
  private aimTimer = 0; // prochain coup au clic
  private lastSwing = -9; // dernier coup d'épée dessiné (attaque au clic)
  private wasDead = false;
  private fog: Fog;
  private area = '';
  private shake = 0;
  private pricked = false; // premier contact avec un cactus : on le dit une fois
  private introUntil = 0; // réveil sur l'île en cours : pas de bandeau de lieu
  private swordHit = -9; // dernier coup sur l'épée plantée (elle tremble)
  private swordOut = -9; // épée sortie du sable (elle s'envole)
  private areaTimer = 0;
  private helping = false; // R maintenu (ou bouton tactile) : relever un coéquipier

  constructor(private canvas: HTMLCanvasElement, private net: Net, private myId: number, code: string, seed: number, villageFound = false, founder = false, armed = true) {
    this.ctx = canvas.getContext('2d')!;
    this.map = new WorldMap(seed);
    this.world = new World(this.map);
    this.fog = new Fog(`fangleaf.fog.v8.${seed}`, (x, y) => !this.map.isForest(x, y)); // v8 : zones agrandies à partir des Ruines moussues
    this.hud = new Hud(code, this.map, this.fog, founder);
    this.hud.onCave = (id, enter) => net.send({ t: 'cave', id, enter });
    this.hud.onLegend = (s) => net.send({ t: 'legend', s });
    this.hud.onClass = (cls) => net.send({ t: 'class', cls });
    this.hud.onSpec = (spec) => net.send({ t: 'spec', spec });
    this.hud.onTravel = (to) => net.send({ t: 'travel', to });
    this.hud.onEstablish = (site) => net.send({ t: 'establish', site });
    this.hud.onLearn = (kind) => net.send({ t: 'learn', kind });
    this.hud.onBuild = (b) => net.send({ t: 'build', b });
    this.hud.onUnlock = (cave) => net.send({ t: 'unlock', cave });
    this.hud.onSell = (id) => net.send({ t: 'sell', id });
    this.hud.onBuy = (s) => net.send({ t: 'buy', s });
    this.hud.onChallenge = (cave) => net.send({ t: 'challenge', cave });
    this.hud.onChest = (id) => net.send({ t: 'chest', id });
    this.hud.onHall = (name) => net.send({ t: 'hall', name });
    this.hud.onRename = (name) => net.send({ t: 'rename', name });
    this.hud.onDeposit = () => net.send({ t: 'deposit' });
    this.hud.onChat = (text) => net.send({ t: 'chat', text });
    this.hud.onBoard = () => net.send({ t: 'board' });
    this.hud.onProfile = (color, hat) => net.send({ t: 'profile', color, hat });
    this.hud.onPick = () => net.send({ t: 'pick' });
    this.hud.onHold = () => this.toggleHold();
    this.hud.onRide = () => this.toggleMount();
    this.hud.onSword = () => net.send({ t: 'sword' });
    this.hud.onScroll = (cave) => net.send({ t: 'scroll', cave });
    this.hud.onHeart = () => net.send({ t: 'heart' });
    this.hud.onScrollGive = () => net.send({ t: 'scrollGive' });
    this.hud.onBoat = () => net.send({ t: 'boat' });
    this.hud.onPlan = () => net.send({ t: 'plan' });
    this.hud.onSchool = () => net.send({ t: 'school' });
    this.hud.onReset = () => net.send({ t: 'reset' });
    this.hud.onQuit = () => {
      net.close(); // le serveur sauvegarde la progression à la déconnexion
      location.href = location.pathname;
    };
    this.hud.onUpgrade = (what) => net.send({ t: 'upgrade', what });
    this.hud.onAlphaUp = (s) => net.send({ t: 'alphaUp', s });
    this.hud.onAlphaEquip = (s, equip) => net.send({ t: 'alphaEquip', s, equip });
    this.hud.onAlphaCreate = (s) => net.send({ t: 'alphaCreate', s });
    this.hud.onHelp = (on) => this.setHelp(on);
    this.hud.onQuality = () => this.resize();
    const hints = () => {
      if (!touchOnly) this.hud.toast(`ZQSD / flèches pour bouger · ${settings.attack === 'click' ? 'clic gauche pour attaquer' : 'attaque auto'} · ${keyLabel('interact')} près d'un bâtiment · touches et attaque : Échap › Paramètres`);
      if (armed && !villageFound) this.hud.toast('Suis le chemin jusqu\'au pont de bois : le village est sur l\'îlot d\'en face (étoile dorée : clique sur la minicarte).');
    };
    // Tout premier réveil sur l'île (pas encore d'épée) : on ouvre les yeux, sans comprendre ce qu'on fait là.
    const key = `fangleaf.woke.${code}`;
    let woke = true;
    try {
      woke = !!localStorage.getItem(key);
      localStorage.setItem(key, '1');
    } catch { /* stockage indisponible : on montre le réveil */ woke = false; }
    if (!armed && !villageFound && !woke) {
      this.introUntil = Infinity;
      playWakeUp(canvas, () => {
        this.introUntil = 0;
        hints();
      });
    } else hints();
    initInput(canvas, (code, key) => this.onKey(code, key), (code, key) => (key === '' || matches('revive', code, key)) && this.setHelp(false));
    this.hud.onAttackMode = () => this.sendMode();
    this.hud.onKick = (id) => net.send({ t: 'kick', id });
    this.hud.onUnban = (user) => net.send({ t: 'unban', user });
    this.sendMode();
    addEventListener('resize', () => this.resize());
    this.resize();
    net.onMessage = (m) => this.onMessage(m);
    requestAnimationFrame(() => this.frame());
  }

  /** Pixels par point d'écran : ceux de l'appareil, plafonnés selon la qualité choisie. */
  private get dpr() {
    return Math.min(maxDpr(), devicePixelRatio || 1);
  }

  private resize() {
    const dpr = this.dpr;
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.scale = clamp(Math.min(innerWidth / 1350, innerHeight / 800), 0.62, 1.25) * dpr;
  }

  /** Grotte vide : cercle d'invocation là où le géant reviendra, avec le temps restant (il s'emballe à la fin). */
  private drawBossReturn(ctx: CanvasRenderingContext2D, x: number, y: number, sec: number) {
    const t = this.time, soon = sec <= 10, k = soon ? 1 - sec / 10 : 0;
    const pulse = 0.5 + 0.5 * Math.sin(t * (soon ? 8 + k * 10 : 2.5));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.45); // posé au sol
    ctx.globalAlpha = 0.35 + 0.25 * pulse + 0.3 * k;
    ctx.strokeStyle = soon ? '#F0B64A' : '#8FA9B8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 84, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();
    // runes qui tournent, de plus en plus vite
    ctx.rotate(t * (0.4 + k * 4));
    ctx.fillStyle = ctx.strokeStyle;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 76 - 3.5, Math.sin(a) * 76 - 3.5, 7, 7);
    }
    ctx.restore();
    // étincelles qui montent juste avant le retour
    if (soon && Math.random() < 0.2 + k * 0.6) this.fx.burst(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 40, '#F0B64A', 1, 40);
    ctx.save();
    ctx.font = '700 28px "Pixelify Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(8,14,12,0.8)';
    ctx.fillStyle = soon ? '#F0B64A' : '#D8E4DA';
    const label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const s = soon ? 1 + 0.15 * pulse : 1;
    ctx.translate(x, y - 6);
    ctx.scale(s, s);
    ctx.strokeText(label, 0, 0);
    ctx.fillText(label, 0, 0);
    ctx.font = '600 12px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(216,228,218,0.75)';
    ctx.strokeText('retour du géant', 0, 20);
    ctx.fillText('retour du géant', 0, 20);
    ctx.restore();
  }

  toast(text: string) {
    this.hud.toast(text);
  }

  /** Attaque au clic (PC) ou automatique : le serveur doit le savoir (au doigt, toujours automatique). */
  private sendMode() {
    this.net.send({ t: 'mode', manual: !touchOnly && settings.attack === 'click' });
  }

  private onKey(code: string, key: string) {
    if (this.hud.capturing) return; // réglages : la touche pressée est en train d'être assignée
    const action = actionOf(code, key);
    if (action === 'interact') {
      const st = this.self();
      const b = buildingNear(this.map, this.me.x, this.me.y, this.hud);
      if (this.hud.panel) this.hud.setPanel(null);
      else if (st && !st.dead && b?.panel) this.hud.setPanel(b.panel);
      else if (st && !st.dead && b?.deposit) this.net.send({ t: 'deposit' });
      else if (st && !st.dead && b?.pick) this.net.send({ t: 'pick' });
      else if (st && !st.dead && b?.sword) this.net.send({ t: 'sword' });
      else if (st && !st.dead && b?.scroll !== undefined) this.net.send({ t: 'scroll', cave: b.scroll });
      else if (st && !st.dead && b?.heart) this.net.send({ t: 'heart' });
      else if (st && !st.dead && b?.plan) this.net.send({ t: 'plan' });
      else if (st && !st.dead && b?.chest !== undefined) this.net.send({ t: 'chest', id: b.chest });
      else if (st && !st.dead && b?.cave) this.net.send({ t: 'cave', id: b.cave.id, enter: b.cave.enter });
    } else if (key === 'Escape') {
      // Échap ferme d'abord ce qui est ouvert (carte, forge, Tanière, confirmation) ; sinon, propose de revenir au lobby.
      this.hud.setPanel(this.hud.panel ? null : 'quit');
    }
    else if (action === 'chat' && !this.hud.panel) this.hud.setPanel('chat');
    else if (action === 'map') this.hud.setPanel(this.hud.panel === 'map' ? null : 'map');
    else if (action === 'mount') this.toggleMount();
    else if (action === 'fruit') this.toggleHold();
    else if (action === 'revive') this.setHelp(true);
    else if (code === 'F9' && import.meta.env.DEV) this.net.send({ t: 'cheat' });
  }

  /** T : tendre un fruit (le gibier passif s'approche, chaque fruit peut l'apprivoiser) ou le ranger. */
  private toggleHold() {
    const st = this.self();
    if (!st || st.dead) return;
    if (!st.holding && !st.fruits) return this.hud.toast('Aucune baie : cueille-en aux buissons garnis (E).');
    this.net.send({ t: 'hold', on: !st.holding });
    if (!st.holding) this.hud.toast('Fruit en main : le gibier approche. Tu ne te bats plus tant que tu le tends (T pour le ranger).');
  }

  /** R maintenu près d'un coéquipier à terre : le serveur compte les secondes. */
  private setHelp(on: boolean) {
    if (on === this.helping) return;
    this.helping = on;
    this.net.send({ t: 'help', on });
  }

  /**
   * F : descendre, ou monter sur l'Alpha chevauchable le plus proche. Le serpent ne se monte que près de l'eau
   * (on embarque sur l'eau) et on n'en descend qu'au bord d'une rive.
   */
  private toggleMount() {
    const st = this.self();
    if (!st || st.dead) return;
    if (st.mount) {
      if (swimMount(st.mount.species) && this.map.isWater(this.me.x, this.me.y) && !this.map.landNear(this.me.x, this.me.y, SHORE_R)) {
        return this.hud.toast('Trop loin de la rive : rapproche-toi de la terre pour descendre du serpent.');
      }
      return this.net.send({ t: 'mount', id: 0 });
    }
    if (!st.saddle && st.army.some((a) => a.alpha && MOUNTS[SPECIES[a.species].key])) return this.hud.toast('Il te faut une selle pour monter ton Alpha.');
    const candidates = (this.net.latest?.units ?? []).filter(
      (u) => u[6] === this.myId && u[2] & UNIT_FLAG_ALPHA && MOUNTS[SPECIES[u[1]].key] && Math.hypot(u[3] - this.me.x, u[4] - this.me.y) < MOUNT_REACH,
    );
    if (!candidates.length) {
      const owned = st.army.some((a) => a.alpha && MOUNTS[SPECIES[a.species].key]);
      this.hud.toast(owned ? 'Ta monture est trop loin ou en train de ressusciter.' : 'Aucune monture : éveille un Alpha Loup, Sanglier, Ours, Escargot ou Serpent à la Tanière.');
      return;
    }
    // l'Alpha chevauchable le plus proche ; le serpent seulement si l'eau est à portée (sinon le suivant). Au bord de
    // l'eau, avec une monture nageuse et une terrestre : on regarde vers l'eau, la nageuse ; vers la terre, la terrestre.
    const nearWater = !!this.map.waterNear(this.me.x, this.me.y, SHORE_R);
    const sorted = candidates.sort((a, b) => Math.hypot(a[3] - this.me.x, a[4] - this.me.y) - Math.hypot(b[3] - this.me.x, b[4] - this.me.y));
    const usable = sorted.filter((u) => nearWater || !swimMount(u[1]));
    const facingWater = nearWater && [30, 60, 90, 120, SHORE_R].some((d) => this.map.isWater(this.me.x + this.me.fx * d, this.me.y + this.me.fy * d));
    const pick = usable.find((u) => swimMount(u[1]) === facingWater) ?? usable[0];
    if (!pick) return this.hud.toast('Approche-toi de l\'eau pour monter ton serpent : il ne nage qu\'en eau.');
    this.net.send({ t: 'mount', id: pick[0] });
  }

  /** Annonce le lieu quand on y entre : plage d'arrivée, village ou zone de danger. */
  private updateArea(dt: number) {
    this.areaTimer -= dt;
    if (this.areaTimer > 0) return;
    this.areaTimer = 0.25;
    if (this.introUntil) return; // le bandeau attendra que l'on ait ouvert les yeux
    const { x, y } = this.me, { spawn } = this.map;
    const cave = this.map.caveAt(x, y);
    const site = this.map.siteAt(x, y, CAMP_R);
    const area = cave ? `cave${cave.id}` : this.map.inVillage(x, y) ? 'village'
      : Math.hypot(x - spawn.x, y - spawn.y) < 260 ? 'camp'
      : site >= 0 ? `site${site}${this.hud.camps.includes(site) ? '+' : ''}`
      : `zone${this.map.zoneAt(x, y)}`;
    // ambiance sonore du lieu (un emplacement de camp pas encore établi garde celle de sa zone) ; dans une grotte dont
    // le géant est réveillé, la musique de combat
    const fight = !!cave && (this.net.latest?.units ?? []).some((u) => SPECIES[u[1]].boss && !u[6] && !(u[2] & UNIT_FLAG_DORMANT) && this.map.caveAt(u[3], u[4])?.id === cave.id);
    sound.ambience(cave ? (fight ? 'boss' : 'cave') : area === 'village' ? 'village' : area === 'camp' || area.endsWith('+') ? 'camp' : `zone${this.map.zoneAt(x, y)}` as Ambience);
    if (area === this.area) return;
    const first = this.area === '';
    this.area = area;
    if (area === 'camp') this.hud.banner(first && this.hud.sword < SWORD_PULLS ? 'Une plage inconnue' : 'Plage du naufrage', first ? (this.hud.sword < SWORD_PULLS ? 'Quelque chose brille dans le sable' : 'Suis le chemin de cailloux jusqu\'au pont') : 'De retour sur la plage');
    else if (area === 'village') this.hud.banner('Village', '');
    else if (area.startsWith('site')) {
      this.hud.banner(campName(site), ''); // juste le nom du camp, établi ou non
    }
    else if (cave?.id === HALL_ID) this.hud.banner(ZONE_NAMES[VOLCANO_ZONE - 1], '', true);
    else if (cave?.zone === VOYAGE_ZONE) this.hud.banner(ZONE_NAMES[VOYAGE_ZONE - 1], this.hud.beaten.includes(cave.boss) ? 'La route du Colisée est libre' : 'Cap sur le Colisée', true);
    else if (cave) {
      const boss = SPECIES[cave.boss];
      this.hud.banner(boss.title ?? boss.name, '', true); // le nom du géant qui habite la grotte
    }
    else {
      const z = Number(area.slice(4));
      if (!first) this.hud.banner(ZONE_NAMES[z - 1], '', z >= 3); // juste le nom de la zone
    }
  }

  /**
   * Brume des zones fermées : des bancs de nuages couvrent tout ce qui est au-delà de la première porte fermée
   * (on ne peut pas y entrer). À sa lisière, ce qu'il faut pour la lever. Une porte qui s'ouvre se dissipe en fondu.
   */
  private drawMist(camX: number, camY: number, hw: number, hh: number) {
    const { ctx, map } = this;
    const closed = map.gates.findIndex((_, k) => !this.gateOpen(k));
    const fogArc = closed < 0 ? Infinity : map.gates[closed];
    const fading = [...this.mistLifted].filter(([k, t]) => this.time - t < MIST_FADE_S && map.gates[k] < fogArc);
    if (fogArc === Infinity && !fading.length) return;
    this.puffImage();
    // nuages espacés (STEP) mais plus grands : à peu près la même couverture, 3 à 4 fois moins d'images collées
    const STEP = settings.display.quality === 'low' ? 150 : 120, feather = 140;
    // densité : 0 avant la lisière, 1 un peu après ; idem (en s'estompant) pour une brume qui se lève
    // (abscisse de porte : le couloir droit pour celle du village, la frontière bruitée des zones pour les autres)
    const density = (x: number, y: number) => {
      const a = map.arcAt(x, y), za = map.zoneArc(x, y), at = (k: number) => (k === 0 ? a : za);
      const f = at(closed);
      let d = closed < 0 ? 0 : Math.min(1, Math.max(0, (f - (fogArc - feather)) / (feather * 1.6)));
      for (const [k, t] of fading) {
        const b = at(k);
        if (b > map.gates[k] - feather && (closed < 0 || f < fogArc)) d = Math.max(d, Math.min(1, (b - (map.gates[k] - feather)) / (feather * 1.6)) * (1 - (this.time - t) / MIST_FADE_S));
      }
      return d;
    };
    for (let gx = Math.floor((camX - hw - 120) / STEP); gx <= (camX + hw + 120) / STEP; gx++) {
      for (let gy = Math.floor((camY - hh - 120) / STEP); gy <= (camY + hh + 120) / STEP; gy++) {
        const h = hash2(gx, gy, 41);
        const x = gx * STEP + (h - 0.5) * STEP * 0.6, y = gy * STEP + (hash2(gy, gx, 43) - 0.5) * STEP * 0.6;
        if (Math.abs(x) >= WORLD_HALF || Math.abs(y) >= WORLD_HALF) continue;
        const d = density(x, y);
        if (d <= 0) continue;
        const size = (150 + h * 90) * (STEP / 64) * 0.78, drift = Math.sin(this.time * 0.25 + h * 9) * 14;
        ctx.globalAlpha = Math.min(1, d);
        ctx.drawImage(this.puff!, x + drift - size / 2, y - size / 2 + Math.cos(this.time * 0.2 + h * 7) * 8, size, size);
      }
    }
    ctx.globalAlpha = 1;
    // panneau à la lisière de la brume : la zone, et ce qu'il faut pour la lever
    if (closed >= 0) {
      const c = map.spineAt(map.gateSpine(closed) - 90);
      if (Math.abs(c.x - camX) < hw + 300 && Math.abs(c.y - camY) < hh + 300) {
        this.world.drawGateLabel(ctx, c.x, c.y, closed === 0 ? 'Brume · suite de la Lisière' : `Brume · ${ZONE_NAMES[closed]}`, this.gateWhy(closed));
      }
    }
  }
  private puff?: HTMLCanvasElement;
  /** Nuage rond et doux, pré-rendu une fois (brume des portes, brume des lacs). */
  private puffImage() {
    if (this.puff) return this.puff;
    const c = (this.puff = document.createElement('canvas'));
    c.width = c.height = 128;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, 'rgba(226,232,236,0.95)');
    grad.addColorStop(0.55, 'rgba(206,214,220,0.7)');
    grad.addColorStop(1, 'rgba(190,200,208,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  /**
   * Brume légère des Lacs brumeux : de grands bancs pâles et lents qui traînent au ras du sol, plus épais au-dessus de
   * l'eau, et qui s'effacent en approchant des zones voisines (fondu sur la frontière).
   */
  private drawLakeMist(camX: number, camY: number, hw: number, hh: number) {
    const { ctx, map } = this, puff = this.puffImage(), STEP = 170;
    if (lakesMix(map, camX, camY) <= 0 && lakesMix(map, camX + hw, camY) <= 0 && lakesMix(map, camX - hw, camY) <= 0 && lakesMix(map, camX, camY + hh) <= 0 && lakesMix(map, camX, camY - hh) <= 0) return;
    for (let gx = Math.floor((camX - hw - 200) / STEP); gx <= (camX + hw + 200) / STEP; gx++) {
      for (let gy = Math.floor((camY - hh - 200) / STEP); gy <= (camY + hh + 200) / STEP; gy++) {
        const h = hash2(gx, gy, 57), drift = this.time * (6 + h * 8);
        const x = gx * STEP + (h - 0.5) * STEP + Math.sin(this.time * 0.07 + h * 9) * 60 + drift % STEP, y = gy * STEP + (hash2(gy, gx, 59) - 0.5) * STEP;
        const d = lakesMix(map, x, y);
        if (d <= 0.02) continue;
        const wet = map.isWater(x, y) ? 1.5 : 1, breathe = 0.75 + 0.25 * Math.sin(this.time * 0.3 + h * 11);
        const size = 300 + h * 180;
        ctx.globalAlpha = Math.min(0.32, 0.17 * d * wet * breathe);
        ctx.drawImage(puff, x - size / 2, y - size * 0.32, size, size * 0.64);
      }
    }
    ctx.globalAlpha = 1;
  }

  private canopy?: { c: HTMLCanvasElement; w: number; h: number };
  /**
   * Sous la canopée de la jungle (à l'écran, par-dessus tout) : un bord de feuillage sombre qui pend du haut de l'écran
   * et se balance, l'ombre verte des feuilles sur les bords, et quelques rais de lumière en biais. Son intensité suit la
   * part de jungle sous la caméra : il apparaît en fondu en passant la frontière.
   */
  private drawCanopy(camX: number, camY: number) {
    const j = this.map.caveAt(camX, camY) ? 0 : jungleMix(this.map, camX, camY);
    if (j <= 0.01) return;
    const { ctx, canvas } = this, W = canvas.width, H = canvas.height, dpr = this.dpr;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // ombre verte sur les bords
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(6,24,10,0)');
    vg.addColorStop(1, `rgba(6,24,10,${0.55 * j})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    // rais de lumière en biais, qui respirent
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const x0 = W * (0.15 + k * 0.32) + Math.sin(this.time * 0.15 + k) * 30 * dpr, a = 0.05 * j * (0.6 + 0.4 * Math.sin(this.time * 0.4 + k * 2));
      const g = ctx.createLinearGradient(x0, 0, x0 + H * 0.45, H);
      g.addColorStop(0, `rgba(255,240,170,${a})`);
      g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 60 * dpr, 0);
      ctx.lineTo(x0 + 60 * dpr + H * 0.45, H);
      ctx.lineTo(x0 + H * 0.45, H);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // feuillage qui pend du haut de l'écran
    if (!this.canopy || this.canopy.w !== W || this.canopy.h !== H) this.canopy = { c: this.paintCanopy(W, H, dpr), w: W, h: H };
    ctx.globalAlpha = j;
    ctx.drawImage(this.canopy.c, Math.sin(this.time * 0.5) * 6 * dpr - 10 * dpr, Math.sin(this.time * 0.37) * 3 * dpr - 6 * dpr);
    ctx.restore();
  }

  /** Bord de feuillage de la canopée (pré-rendu à la taille de l'écran) : grandes feuilles et lianes, en silhouettes. */
  private paintCanopy(W: number, H: number, dpr: number) {
    const c = document.createElement('canvas');
    c.width = W + 20 * dpr;
    c.height = Math.round(H * 0.35);
    const g = c.getContext('2d')!;
    const leaf = (x: number, y: number, len: number, a: number, col: string) => {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(len * 0.5, 0, len * 0.55, len * 0.24, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(40,80,40,0.5)';
      g.lineWidth = 1.2 * dpr;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len, 0);
      g.stroke();
      g.restore();
    };
    const n = Math.ceil(W / (46 * dpr));
    for (let k = 0; k <= n; k++) {
      const x = (k / n) * c.width, deep = 26 + hash2(k, 3, 61) * 50 + (k % 5 === 0 ? 40 : 0);
      for (let f = 0; f < 4; f++) {
        const a = Math.PI / 2 + (hash2(k, f, 62) - 0.5) * 1.6, len = (30 + hash2(f, k, 63) * 30) * dpr;
        leaf(x + (hash2(k, f, 64) - 0.5) * 30 * dpr, (hash2(k, f, 65) * deep - 10) * dpr * 0.6, len, a, f % 2 ? 'rgba(10,32,16,0.92)' : 'rgba(16,44,22,0.9)');
      }
      if (k % 4 === 1) {
        // une liane qui descend plus bas
        const len = (60 + hash2(k, 9, 66) * 90) * dpr;
        g.strokeStyle = 'rgba(14,38,18,0.9)';
        g.lineWidth = 3 * dpr;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 10 * dpr, len * 0.4, x - 8 * dpr, len * 0.7, x + 4 * dpr, len);
        g.stroke();
        for (let f = 1; f < 5; f++) leaf(x + (f % 2 ? 4 : -4) * dpr, (len * f) / 5, 12 * dpr, f % 2 ? 0.4 : Math.PI - 0.4, 'rgba(14,40,20,0.9)');
      }
    }
    return c;
  }
  private bubbles = new Map<number, { text: string; until: number }>(); // dompteur → message affiché au-dessus de lui

  /** Bulles de chat au-dessus des dompteurs (dessinées par-dessus tout le reste). */
  private drawBubbles(players: PlayerState[]) {
    const { ctx } = this;
    ctx.font = '600 13px Outfit, sans-serif';
    ctx.textAlign = 'center';
    for (const p of players) {
      const b = this.bubbles.get(p.id);
      if (!b) continue;
      if (this.time > b.until || p.dead) {
        this.bubbles.delete(p.id);
        continue;
      }
      // découpe en lignes de 180 px au plus, 3 lignes au plus
      const lines: string[] = [];
      let line = '';
      for (const word of b.text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > 180 && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
      if (lines.length > 3) {
        lines.length = 3; // trop long : on coupe la 3e ligne sur son dernier mot entier
        lines[2] = `${lines[2].replace(/\s+\S*$/, '')}…`;
      }
      const isMe = p.id === this.myId, x = isMe ? this.me.x : p.x;
      const lift = p.mount ? alphaStats(p.mount.species, 0, 1, p.mount.legend).r * 0.8 : 0;
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20, h = lines.length * 16 + 10;
      const by = (isMe ? this.me.y : p.y) - lift - 46 - h; // au-dessus du nom
      const fade = Math.min(1, (b.until - this.time) / 0.4);
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(238,231,215,0.95)';
      ctx.strokeStyle = 'rgba(16,24,26,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, by, w, h, 8);
      ctx.moveTo(x - 6, by + h);
      ctx.lineTo(x, by + h + 7);
      ctx.lineTo(x + 6, by + h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#10181A';
      lines.forEach((l, i) => ctx.fillText(l, x, by + 18 + i * 16));
      ctx.globalAlpha = 1;
    }
  }
  private mistLifted = new Map<number, number>(); // porte → moment où sa brume a commencé à se lever

  /** « z z z » qui montent en s'estompant au-dessus d'un dormeur. */
  private snore(x: number, y: number, size: number, seed: number) {
    const { ctx } = this;
    ctx.font = `700 ${size}px "Pixelify Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#EEE7D7';
    for (let k = 0; k < 3; k++) {
      const ph = (this.time * 0.45 + k / 3 + seed * 0.13) % 1;
      ctx.globalAlpha = Math.sin(ph * Math.PI);
      ctx.fillText('z', x + ph * size * 1.9, y - ph * size * 2.6);
    }
    ctx.globalAlpha = 1;
  }

  private gateOpen(k: number) {
    return gateOpen(k, this.hud.hall, this.hud.told);
  }

  /** Ce qui manque pour ouvrir la porte k. */
  private gateWhy(k: number) {
    const need: string[] = [];
    if (this.hud.hall < gateHall(k)) need.push(`Hôtel de ville niv. ${gateHall(k)}`);
    const left = k === 0 ? [] : zoneBosses(k).filter((b) => !this.hud.beaten.includes(b));
    if (left.length) need.push(`vaincre ${left.map(bossName).join(', ')}`);
    const unread = k === 0 || left.length ? [] : zoneBosses(k).filter((b) => !this.hud.told.includes(b));
    if (unread.length) need.push(`rapporter à Aubin le parchemin ${k === 1 ? 'de la' : 'des'} ${ZONE_NAMES[k - 1]}`);
    return need.join(' · ');
  }

  /** Une porte vient de s'ouvrir (amélioration ou géant vaincu, par n'importe qui) : on l'annonce. */
  private watchGates() {
    const open = this.map.gates.map((_, k) => this.gateOpen(k));
    if (this.gatesOpen && this.net.latest) {
      open.forEach((o, k) => {
        if (!o || this.gatesOpen![k]) return;
        this.mistLifted.set(k, this.time); // sa brume se dissipe en fondu
        this.hud.toast(k === 0 ? 'La brume se lève : la Lisière vous attend !' : `La brume se lève sur les ${ZONE_NAMES[k]} !`, 'good');
        const c = this.map.spineAt(this.map.gateSpine(k));
        this.fx.ring(c.x, c.y, '#7FCB5B', 20, 260, 1.2);
      });
    }
    if (this.net.latest) this.gatesOpen = open;
  }

  private self(): PlayerState | undefined {
    return this.net.latest?.players.find((p) => p.id === this.myId);
  }

  private onMessage(m: ServerMsg) {
    if (m.t === 'closed') {
      // Village supprimé (ou progression effacée) : retour au lobby, message affiché là-bas.
      try {
        sessionStorage.setItem('fangleaf.notice', m.msg);
      } catch { /* stockage indisponible */ }
      this.net.onClose = () => {};
      this.net.close();
      location.href = location.pathname;
    } else if (m.t === 'error') this.hud.toast(m.msg);
    else if (m.t === 'board') this.hud.board(m.rows);
    else if (m.t === 'teleport') {
      // Entrée ou sortie de grotte : l'écran s'ouvre en iris depuis le noir.
      const from = this.map.caveAt(this.me.x, this.me.y), to = this.map.caveAt(m.x, m.y);
      if (from?.id !== to?.id) this.hud.caveFade();
      this.me.x = m.x;
      this.me.y = m.y;
    } else if (m.t === 's') {
      this.shotsAt = this.time;
      for (const e of m.ev) this.onEvent(e, m.players);
      const st = m.players.find((p) => p.id === this.myId);
      if (st && !st.dead && Math.hypot(st.x - this.me.x, st.y - this.me.y) > 220) {
        this.me.x = st.x; // le serveur a refusé un déplacement : on se recale
        this.me.y = st.y;
      }
    }
  }

  private posOf(id: number, players: PlayerState[]) {
    if (id === this.myId) return this.me;
    const p = players.find((q) => q.id === id);
    if (p) return p;
    const u = this.net.latest && this.net.byId(this.net.latest).get(id);
    return u ? { x: u[3], y: u[4] } : undefined;
  }

  /** Coup au corps à corps d'un monstre : il se fend vers sa cible, et l'effet de son arme éclate sur elle. */
  private meleeHit(id: number, a: { x: number; y: number }, b: { x: number; y: number }, target: number, players: PlayerState[]) {
    const u = this.net.latest && this.net.byId(this.net.latest).get(id);
    if (!u || u[2] & UNIT_FLAG_MOUNTED) return; // une monture frappe sous son cavalier : pas de fente
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    this.lunges.set(id, { at: this.time, ang });
    const sp = SPECIES[u[1]], alpha = (u[2] & UNIT_FLAG_ALPHA) !== 0;
    const r = alpha ? alphaStats(u[1], 0, 1, (u[2] & UNIT_FLAG_LEGEND) !== 0).r : sp.r;
    const tr = players.some((p) => p.id === target) ? 16 : SPECIES[this.net.byId(this.net.latest!).get(target)?.[1] ?? 0]?.r ?? 16;
    // sur le flanc de la cible tourné vers l'attaquant, à mi-hauteur
    const ix = b.x - Math.cos(ang) * tr * 1.1, iy = b.y - Math.sin(ang) * tr * 0.8 - tr * 0.5;
    this.fx.impact(impactOf(sp.sprite ?? sp.key), ix, iy, ang, Math.min(80, Math.max(16, r * 1.3)), sp.color);
    if (sp.boss && Math.hypot(this.me.x - b.x, this.me.y - b.y) < 120) this.shake = Math.max(this.shake, 0.12);
  }

  /** Camp d'un attaquant : soi, sa meute, un coéquipier ou sa meute (couleur du coéquipier), ou un sauvage. */
  private sideOf(id: number, players: PlayerState[]): { kind: 'me' | 'ally' | 'wild'; color: string; pack: boolean } {
    if (id === this.myId) return { kind: 'me', color: '#EEE7D7', pack: false };
    const p = players.find((q) => q.id === id);
    if (p) return { kind: 'ally', color: p.color, pack: false };
    const owner = (this.net.latest && this.net.byId(this.net.latest).get(id)?.[6]) ?? 0;
    if (owner === this.myId) return { kind: 'me', color: '#8FE3D6', pack: true }; // sa meute : turquoise clair
    const o = players.find((q) => q.id === owner);
    return o ? { kind: 'ally', color: o.color, pack: true } : { kind: 'wild', color: '', pack: false };
  }

  /** Bruitage d'un événement : plein volume s'il nous concerne, atténué avec la distance sinon. */
  private sfxFor(e: GameEvent) {
    const near = (x: number, y: number) => Math.max(0, 1 - Math.hypot(x - this.me.x, y - this.me.y) / 900);
    const me = this.myId;
    switch (e.e) {
      case 'hit': // (un coup qui porte n'a pas de son : seul celui qu'on reçoit s'entend)
        if (e.b === me) sound.play('hurt');
        break;
      case 'shot':
        sound.play(e.cls === 'archer' ? 'arrow' : 'orb', e.by === me ? 1 : near(e.x, e.y) * 0.6);
        break;
      case 'mine': {
        const o = this.map.ores[e.id];
        if (o) sound.play(o.res === 'wood' ? 'chop' : 'pick', e.by === me ? 1 : near(o.x, o.y) * 0.6);
        break;
      }
      case 'munch': {
        const o = this.map.ores[e.ore];
        if (o) sound.play('pick', near(o.x, o.y) * 0.8);
        break;
      }
      case 'chop': {
        const d = this.map.decor[e.id];
        if (d) sound.play('chop', e.by === me ? 1 : near(d.x, d.y) * 0.6);
        break;
      }
      case 'chest':
        if (e.to === me) sound.play('chest');
        break;
      case 'shout': {
        const u = this.posOf(e.id, this.net.latest?.players ?? []);
        if (u) sound.play(e.kind === 'rally' ? 'shout' : 'shell', near(u.x, u.y));
        break;
      }
      case 'challenge':
        sound.play('roar');
        break;
      case 'boom':
        sound.play('boom', near(e.x, e.y));
        break;
      case 'pdie':
        if (e.id === me) sound.play('death');
        break;
      case 'legend':
        if (e.by !== me) sound.play('fanfare', 0.5); // le sien : l'animation du double éveil a sa fanfare
        break;
      case 'upgrade':
      case 'hall':
      case 'built':
      case 'alphaUp':
        if (('id' in e && e.id === me) || ('by' in e && e.by === me)) sound.play('fanfare');
        else if (e.e === 'hall' || e.e === 'built') sound.play('fanfare', 0.5);
        break;
      case 'chat':
        if (e.by !== me) sound.play('blip');
        break;
      case 'pick':
        if (e.by === me) sound.play('pop');
        break;
      case 'deposit':
        if (e.by === me) sound.play('thunk');
        break;
      case 'previve':
      case 'awaken':
        if (('id' in e && e.id === me) || ('by' in e && e.by === me)) sound.play('chime');
        break;
    }
  }

  private onEvent(e: GameEvent, players: PlayerState[]) {
    this.sfxFor(e);
    const name = (id: number) => players.find((p) => p.id === id)?.name ?? '?';
    switch (e.e) {
      case 'hit': {
        this.flashes.set(e.b, this.time + 0.1);
        const a = this.posOf(e.a, players), b = this.posOf(e.b, players);
        if (e.m && a && b && !players.some((p) => p.id === e.a)) this.meleeHit(e.a, a, b, e.b, players);
        const ranged = players.find((q) => q.id === e.a)?.cls;
        if (e.a === this.myId && e.b !== e.a && a && b) {
          // (attaque au clic : le coup est déjà dessiné quand on clique)
          if (ranged !== 'archer' && ranged !== 'mage' && (touchOnly || settings.attack !== 'click')) this.fx.slash(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x));
        }
        const show = settings.display.damage;
        if (show === 'off') break;
        if (e.b === this.myId) {
          this.fx.text(this.me.x, this.me.y - 30, `-${fmtDmg(e.dmg)}`, '#FF8A65', 15, 0.8);
          break;
        }
        // Dégâts infligés : les siens et ceux de sa meute, et (réglage « tous ») ceux des coéquipiers et de leurs meutes.
        const side = this.sideOf(e.a, players);
        if (!b || side.kind === 'wild' || (show === 'mine' && side.kind === 'ally')) break;
        if (side.kind === 'me' && !side.pack) this.fx.text(b.x, b.y - 24, fmtDmg(e.dmg), '#EEE7D7', 14, 0.7);
        else this.fx.text(b.x, b.y - 22, fmtDmg(e.dmg), side.color, side.pack ? 11 : 12, 0.6);
        break;
      }
      case 'die':
        this.fx.burst(e.x, e.y, SPECIES[e.s].color, e.alpha ? 30 : 12, e.alpha ? 200 : 120);
        break;
      case 'tame': {
        const u = this.posOf(e.id, players);
        const label = SPECIES[e.s].name;
        if (e.by === this.myId) {
          this.hud.toast(`${label} apprivoisé !`, 'good');
          if (u) {
            this.fx.text(u.x, u.y - 30, 'Apprivoisé !', '#5CC8B8', 18, 1.4);
            this.fx.ring(u.x, u.y, '#5CC8B8', 10, 70);
          }
        } else if (u) this.fx.ring(u.x, u.y, players.find((p) => p.id === e.by)?.color ?? '#5CC8B8', 10, 50);
        break;
      }
      case 'gold':
        if (e.to === this.myId) this.fx.text(e.x, e.y - 12, `+${e.n} or`, '#F0B64A', 14, 1.0);
        break;
      case 'essence':
        if (e.to === this.myId) this.fx.essence(e.x, e.y - 30, SPECIES[e.s].color);
        break;
      case 'soul':
        if (e.to === this.myId) {
          this.fx.essence(e.x, e.y - 50, SPECIES[e.s].color, '+1 âme', 2.2);
          this.hud.toast(`Âme de ${SPECIES[e.s].name} obtenue : double éveil de ton Alpha ${SPECIES.find((b) => b.key === SPECIES[e.s].base)?.name ?? ''} à la Tanière !`, 'alpha');
        }
        break;
      case 'move': {
        const b = this.posOf(e.id, players);
        if (b) this.fx.text(b.x, b.y - 70, `${MOVE_NAMES[e.kind as keyof typeof MOVE_NAMES] ?? e.kind} !`, '#FF9B78', 18, 1.3);
        break;
      }
      case 'challenge': {
        const b = this.posOf(e.id, players), boss = SPECIES[this.map.caves[e.cave]?.boss ?? 0];
        this.hud.setPanel(this.hud.panel === 'talk' ? null : this.hud.panel);
        if (b) {
          this.fx.text(b.x, b.y - 90, `« ${BOSS_LINES[boss.key]?.cry ?? '!'} »`, '#FF9B78', 20, 2.2);
          this.fx.ring(b.x, b.y, '#E8693F', 20, 160, 0.8);
        }
        this.shake = 0.35;
        if (this.map.caves[e.cave]?.zone === VOYAGE_ZONE) this.hud.toast(`${bossName(this.map.caves[e.cave].boss)} surgit des flots et s'attaque au bateau !`);
        else if (e.by !== this.myId) this.hud.toast(`${name(e.by)} a réveillé ${bossName(this.map.caves[e.cave]?.boss ?? 0)} !`);
        break;
      }
      case 'phase': {
        const b = this.posOf(e.id, players);
        if (b) {
          this.fx.ring(b.x, b.y, '#6FB7FF', 30, 260, 1.2);
          this.fx.burst(b.x, b.y, '#C9F0FF', 40, 260);
        }
        this.shake = Math.max(this.shake, 0.4);
        sound.play('roar');
        const max = SPECIES[e.s]?.phases ?? 3;
        this.hud.toast(e.up ? `${bossName(e.s)} remonte, plus furieux que jamais ! (phase ${e.phase}/${max})` : `${bossName(e.s)} replonge… il va revenir, toute sa vie retrouvée !`, e.up ? '' : 'good');
        break;
      }
      case 'chest':
        if (e.to === this.myId) {
          this.chestOpen.set(e.id, this.time);
          this.fx.burst(e.x, e.y - 30, '#F0B64A', 40, 220);
          this.fx.ring(e.x, e.y - 10, '#F0B64A', 10, 110, 0.9);
          this.fx.text(e.x, e.y - 70, `+${e.gold} or`, '#F0B64A', 26, 2);
          this.hud.toast(`Coffre ouvert : +${e.gold} or !`, 'good');
          if (e.book !== undefined) {
            this.fx.text(e.x, e.y - 100, bookName(e.book), '#B48CFF', 18, 2.4);
            this.hud.toast(`Un livre au fond du coffre : ${bookName(e.book)} ! À lire à l'École des dompteurs, au Camp avancé.`, 'alpha');
          }
        }
        break;
      case 'prick':
        if (e.id === this.myId && !this.pricked) {
          this.pricked = true;
          this.hud.toast('Aïe ! Les cactus piquent : passe au large.');
        }
        break;
      case 'learn':
        if (e.by === this.myId) {
          sound.play(e.done ? 'fanfare' : 'chime');
          const d = DISCIPLINES[LESSON_KINDS[e.kind]];
          this.hud.toast(e.done ? `Leçon de ${d.name.toLowerCase()} apprise : ${d.desc} !` : 'Tu ouvres le livre… La leçon prendra un moment, même si tu t\'en vas.', e.done ? 'good' : '');
        } else if (e.done) this.hud.toast(`${name(e.by)} a appris une leçon à l'École des dompteurs`);
        break;
      case 'res':
        if (e.to !== this.myId) break;
        if (e.wood) this.fx.text(e.x, e.y - 12, `+${e.wood} bois`, '#D2A06A', 14, 1.1);
        if (e.stone) this.fx.text(e.x, e.y - (e.wood ? 30 : 12), `+${e.stone} pierre`, '#B9C2BC', 14, 1.1);
        break;
      case 'hall': {
        const h = this.map.hall;
        this.fx.ring(h.x, h.y, '#F0B64A', 20, 160, 1.2);
        this.fx.burst(h.x, h.y - 30, '#F0B64A', 30, 180);
        this.hud.toast(e.by === this.myId ? `Hôtel de ville au niveau ${e.lvl} : ${HALL[e.lvl - 1].unlock}` : `${name(e.by)} a amélioré l'Hôtel de ville (niv. ${e.lvl})`, 'good');
        break;
      }
      case 'sword': {
        // un coup sur l'épée plantée : le sable vole ; au dernier, elle sort
        const s = this.map.sword;
        this.fx.dust(s.x, s.y, 22, 8);
        this.fx.debris(s.x, s.y, ['#D9C391', '#C8B07A', '#B89A62'], 7, 110, 4);
        if (e.by !== this.myId) break;
        this.swordHit = this.time;
        this.shake = Math.max(this.shake, 0.12);
        sound.play('thunk');
        if (e.n >= SWORD_PULLS) {
          this.swordOut = this.time;
          this.fx.ring(s.x, s.y - 20, '#F0B64A', 10, 110, 0.9);
          this.fx.burst(s.x, s.y - 30, '#FFE7A8', 22, 170);
          this.fx.text(s.x, s.y - 70, 'Une épée !', '#F0B64A', 19, 1.8);
          sound.play('fanfare');
          this.hud.toast('Elle tient bien en main. Les monstres n\'ont qu\'à bien se tenir.', 'good');
          this.hud.toast('Un chemin de cailloux s\'enfonce dans l\'île : suis-le (étoile dorée sur la minicarte).');
        } else this.fx.text(s.x, s.y - 50, e.n === 1 ? 'Elle est bien enfoncée…' : 'Ça bouge !', '#EEE7D7', 14, 1.2);
        break;
      }
      case 'pick': {
        const b = this.map.bushes[e.bush];
        if (b) this.fx.burst(b.x, b.y - 10, '#C8323C', 10, 90);
        if (e.by === this.myId && b) this.fx.text(b.x, b.y - 30, `+${e.n} baies`, '#F3A3AA', 15, 1.1);
        break;
      }
      case 'feed': {
        const u = this.posOf(e.id, players);
        if (u) this.fx.text(u.x, u.y - 26, 'miam…', '#F3A3AA', 13, 0.9);
        break;
      }
      case 'deposit': {
        const what = [e.wood && `${e.wood} bois`, e.stone && `${e.stone} pierre`].filter(Boolean).join(' et ');
        this.hud.toast(e.by === this.myId ? `Déposé à l'entrepôt : ${what}` : `${name(e.by)} a déposé ${what} à l'entrepôt`, 'good');
        this.fx.burst(this.map.store.x, this.map.store.y - 20, '#D2A06A', 14, 120);
        break;
      }
      case 'beaten': {
        this.hud.toast(`Première victoire du village sur ${bossName(e.s)} !`, 'good');
        const zone = SPECIES[e.s].zone, beaten = [...this.hud.beaten, e.s];
        if (zone === VOYAGE_ZONE) this.hud.toast('Le Kraken sombre dans les abysses : la route du Colisée est libre !', 'good');
        else if (zone === VOLCANO_ZONE) {
          const left = this.map.caves.filter((c) => c.zone === VOLCANO_ZONE && !beaten.includes(c.boss)).length;
          this.hud.toast(left ? `Une flamme de l'autel du volcan s'éteint. Encore ${left} géant${left > 1 ? 's' : ''}.` : 'La dernière flamme s\'éteint : le cœur volcanique est libéré, au centre des entrailles !', left ? '' : 'good');
        } else {
          const left = zoneBosses(zone).filter((b) => !beaten.includes(b)).length;
          this.hud.toast(left ? `Encore ${left} géant${left > 1 ? 's' : ''} dans cette zone : le dernier gardera son parchemin.` : `Il a laissé tomber le parchemin ${zone === 1 ? 'de la' : 'des'} ${ZONE_NAMES[zone - 1]}, au fond de sa grotte.`, left ? '' : 'good');
        }
        if (zone === VOLCANO_ZONE - 1 && volcanoOpen(beaten) && !volcanoOpen(this.hud.beaten)) this.hud.toast('Un grondement dans la Mer de sable : la bouche du volcan s\'est ouverte !', 'good');
        break;
      }
      case 'heart': {
        const h = e.installed ? this.map.shipwreck : { x: this.map.depths.inside.x, y: this.map.depths.inside.y - 86 };
        this.fx.ring(h.x, h.y, '#FF8A3D', 20, 220, 1.4);
        this.fx.burst(h.x, h.y, '#FFD27A', 50, 260);
        this.shake = Math.max(this.shake, 0.3);
        sound.play('fanfare');
        if (e.installed) this.hud.toast(e.by === this.myId ? 'Le cœur volcanique bat dans la coque : le bateau est prêt à prendre la mer !' : `${name(e.by)} a installé le cœur volcanique : le bateau est prêt à prendre la mer !`, 'good');
        else this.hud.toast(e.by === this.myId ? 'Tu tiens le cœur volcanique ! Va le poser dans le bateau, au bout de l\'île.' : `${name(e.by)} a pris le cœur volcanique ! Il reste à le poser dans le bateau, au bout de l'île.`, 'good');
        break;
      }
      case 'scroll': {
        sound.play('chime', 0.6);
        this.hud.toast(`Le parchemin ${SPECIES[e.s]?.zone === 1 ? 'de la' : 'des'} ${ZONE_NAMES[(SPECIES[e.s]?.zone ?? 1) - 1]}… Le vieil homme du village saura peut-être le lire.`, 'good');
        break;
      }
      case 'lore':
        this.hud.elderRemembers(e.from, e.to, e.by === this.myId);
        if (e.by !== this.myId) this.hud.toast(`${name(e.by)} a rapporté un parchemin : Aubin retrouve la mémoire.`, 'good');
        for (let i = eggsOf(e.from).hatched; i < eggsOf(e.to).hatched; i++) this.hud.toast(`Un œuf vient d'éclore près du feu : ${HATCHLINGS[i].name} !`, 'good');
        sound.play('chime', 0.5);
        break;
      case 'boat': {
        const st = BOAT_STAGES[e.stage];
        if (!e.done) this.hud.toast(`${e.by === this.myId ? 'Tu as' : `${name(e.by)} a`} lancé le bateau : ${st.name} (30 min).`, 'good');
        else if (e.stage + 1 >= BOAT_STAGES.length) this.hud.toast('Le bateau est prêt ! Une Pierre de passage t\'y attend, au bout de l\'île.', 'good');
        else this.hud.toast(`Bateau : ${st.name} terminé. Aubin attend la suite.`, 'good');
        sound.play('fanfare', e.done ? 1 : 0.5);
        break;
      }
      case 'plan':
        this.hud.toast(e.by === this.myId ? 'Le plan de l\'École des dompteurs ! Aubin saura la bâtir au village.' : `${name(e.by)} a trouvé le plan de l'École des dompteurs : Aubin peut la bâtir au village.`, 'good');
        if (e.by === this.myId) sound.play('chest');
        break;
      case 'school':
        this.hud.toast(e.done ? 'L\'École des dompteurs est ouverte, au village !' : `${e.by === this.myId ? 'Tu as' : `${name(e.by)} a`} lancé le chantier de l'école (${Math.round(SCHOOL_BUILD_MS / 60000)} min).`, 'good');
        sound.play('fanfare', e.done ? 1 : 0.5);
        break;
      case 'eat': {
        const b = this.map.bushes[e.bush];
        if (b) this.fx.burst(b.x, b.y - 10, '#C8323C', 8, 80);
        break;
      }
      case 'seen':
        if (e.to === this.myId) this.hud.toast(`Nouvelle espèce au bestiaire de la Tanière : ${SPECIES[e.s].name}`, 'alpha');
        break;
      case 'charge':
        this.charges.set(e.id, this.time);
        break;
      case 'boom': {
        // une attaque d'Alpha légendaire (ou d'un tireur de la meute) éclate à la couleur de son dompteur
        const mine = e.by ? players.find((p) => p.id === e.by)?.color : undefined;
        const col = e.kind === 'cloud' ? '#A0BE5A' : e.kind === 'web' ? '#EEE7D7' : e.kind === 'orb' ? '#B48CFF' : mine ?? (e.kind === 'splash' ? '#B9D86A' : '#E8693F');
        if (e.kind === 'laser' || e.kind === 'breath') break; // le rayon et le souffle s'allument tout seuls
        if (e.kind === 'orb') { // orbe du mage : pas de secousse, juste l'éclat violet
          this.fx.ring(e.x, e.y, col, e.r * 0.3, e.r, 0.35);
          break;
        }
        const near = Math.hypot(this.me.x - e.x, this.me.y - e.y) < e.r + 160;
        if (e.kind === 'pound') {
          // le gorille fracasse le sol devant lui : fissures, mottes et poussière, sans onde tout autour
          this.fx.crack(e.x, e.y, e.r * 0.85, 1.8);
          this.fx.debris(e.x, e.y, ['#7A6248', '#5E4A36', '#4E5A3A'], 14, 220, 8);
          this.fx.dust(e.x, e.y, e.r * 0.7, 10);
          if (near) this.shake = Math.max(this.shake, 0.3);
          break;
        }
        if (e.kind === 'pincer') {
          // la pince claque : éclats et écume au bout de l'arc
          this.fx.debris(e.x, e.y, ['#FFFFFF', '#FFD9C8', '#D46A43'], 12, 260, 5);
          this.fx.ring(e.x, e.y, 'rgba(255,240,230,0.9)', 8, 70, 0.3);
          if (near) this.shake = Math.max(this.shake, 0.32);
          sound.play('swing');
          break;
        }
        if (e.kind === 'bubble' || e.kind === 'geyser') {
          // la bulle éclate, le geyser retombe : gouttes et écume
          this.fx.burst(e.x, e.y - (e.kind === 'geyser' ? 40 : 20), '#DDF4FF', e.kind === 'geyser' ? 26 : 16, e.kind === 'geyser' ? 260 : 170);
          this.fx.burst(e.x, e.y, mine ?? '#6FB7E0', 12, 140);
          this.fx.ring(e.x, e.y, 'rgba(220,244,255,0.9)', e.r * 0.2, e.r * 1.05, 0.4);
          if (near) this.shake = Math.max(this.shake, e.kind === 'geyser' ? 0.25 : 0.15);
          break;
        }
        if (e.kind === 'tongue') {
          this.fx.burst(e.x, e.y, '#E0708F', 10, 120);
          break;
        }
        if (e.kind === 'tornado') {
          this.fx.dust(e.x, e.y, e.r * 1.2, 12);
          break;
        }
        if (e.kind === 'crater') {
          // il retombe dans un cratère : le sol éclate, et le feu prend
          const glow = mine ? rgbOf(mine) : '79,139,255';
          this.fx.fireWave(e.x, e.y, e.r, [glow, mine ? glow : '111,183,255', mine ? '255,250,235' : '214,238,255']);
          this.fx.crack(e.x, e.y, e.r * 0.9, 3);
          this.fx.debris(e.x, e.y, ['#2A2024', '#3A2E2A', '#6FB7FF'], 14, 230, 7);
          if (near) this.shake = Math.max(this.shake, 0.3);
          break;
        }
        if (e.kind === 'rock') {
          // le rocher éclate : éclats qui rebondissent, poussière, petites fissures
          this.fx.debris(e.x, e.y, ['#8A8F8A', '#6E736E', '#A4A8A2'], 16, 210, 10);
          this.fx.dust(e.x, e.y, e.r * 0.8, 9);
          this.fx.crack(e.x, e.y, e.r * 0.7, 1.4);
          this.fx.ring(e.x, e.y, 'rgba(220,210,190,0.8)', e.r * 0.2, e.r, 0.35);
          if (near) this.shake = Math.max(this.shake, 0.22);
          break;
        }
        if (e.kind === 'fireslam') {
          // onde de choc du Feu Ancien : une vague de flammes (ses flammes bleues, ou la couleur du dompteur d'un Alpha légendaire)
          const glow = mine ? rgbOf(mine) : '79,139,255';
          this.fx.fireWave(e.x, e.y, e.r * 1.05, [glow, mine ? glow : '111,183,255', mine ? '255,250,235' : '214,238,255']);
          this.fx.ring(e.x, e.y, mine ?? '#BFE3FF', e.r * 0.15, e.r * 1.05, 0.45);
          if (near) this.shake = Math.max(this.shake, 0.35);
          break;
        }
        if (e.kind === 'leap' || e.kind === 'slam') {
          // le géant retombe de tout son poids : sol fissuré, onde de poussière, mottes de terre
          this.fx.crack(e.x, e.y, e.r * (e.kind === 'slam' ? 0.95 : 0.75), 2);
          this.fx.dust(e.x, e.y, e.r * 0.9, 14);
          this.fx.debris(e.x, e.y, ['#7A6248', '#5E4A36', '#8A8F8A'], 14, 240, 9);
          this.fx.ring(e.x, e.y, 'rgba(240,220,180,0.9)', e.r * 0.2, e.r * 1.05, 0.5);
          this.fx.ring(e.x, e.y, col, e.r * 0.1, e.r * 0.8, 0.7);
          if (near) this.shake = Math.max(this.shake, e.kind === 'slam' ? 0.4 : 0.35);
          break;
        }
        if (e.kind === 'blink') {
          this.fx.ring(e.x, e.y, '#BFE3FF', 10, e.r, 0.5);
          this.fx.burst(e.x, e.y, '#6FB7FF', 24, 200);
          this.fx.burst(e.x, e.y, '#FFFFFF', 10, 120);
          if (near) this.shake = Math.max(this.shake, 0.2);
          break;
        }
        this.fx.ring(e.x, e.y, col, e.r * 0.3, e.r, 0.45);
        this.fx.burst(e.x, e.y, col, 14, 160);
        if (Math.hypot(this.me.x - e.x, this.me.y - e.y) < e.r + 40) this.shake = 0.25;
        break;
      }
      case 'legend':
        if (e.by === this.myId) this.hud.evolve(e.s); // l'animation dit tout (et ses nouvelles attaques)
        else this.hud.toast(`${name(e.by)} a réussi le double éveil de son Alpha ${SPECIES[e.s].name}`, 'alpha');
        {
          const u = this.posOf(e.id, players);
          if (u) {
            this.fx.ring(u.x, u.y, '#F0B64A', 10, 120, 1.2);
            this.fx.burst(u.x, u.y, '#F0B64A', 30, 180);
          }
        }
        break;
      case 'shot':
        this.fx.shot(e.by === this.myId ? this.me.x : e.x, e.by === this.myId ? this.me.y : e.y, e.tx, e.ty, e.cls);
        break;
      case 'spec':
        if (e.id === this.myId) {
          this.hud.toast(`Spécialisation : ${SPECS[e.spec].name} !`, 'good');
          this.fx.ring(this.me.x, this.me.y, '#F0B64A', 10, 70);
          sound.play('fanfare');
        }
        break;
      case 'class':
        if (e.id === this.myId) {
          this.hud.toast(`Tu es désormais ${CLASSES[e.cls].name.toLowerCase()} !`, 'good');
          this.fx.ring(this.me.x, this.me.y, '#F0B64A', 10, 70);
        }
        break;
      case 'mine': {
        const o = this.map.ores[e.id];
        if (!o) break;
        this.fx.burst(o.x, o.y - 8, o.res === 'wood' ? '#B88A5A' : o.res === 'stone' ? '#9AA39E' : '#F0B64A', e.done ? 22 : 5, e.done ? 150 : 70);
        this.tools.set(e.by, { kind: o.res === 'wood' ? 'axe' : 'pick', at: this.time, tx: o.x, ty: o.y });
        break;
      }
      case 'munch': {
        // le golem se penche sur le rocher et en arrache une bouchée : éclats de pierre (et un nuage de poussière quand il l'a avalé)
        const o = this.map.ores[e.ore], g = this.posOf(e.id, players);
        if (!o) break;
        if (g) this.lunges.set(e.id, { at: this.time, ang: Math.atan2(o.y - g.y, o.x - g.x) });
        this.fx.debris(o.x, o.y - 6, ['#9AA39E', '#7E8681', '#5F7A5A'], e.done ? 12 : 5, e.done ? 170 : 110, 6);
        if (e.done) this.fx.dust(o.x, o.y, 40, 8);
        break;
      }
      case 'chop': {
        const d = this.map.decor[e.id];
        if (!d) break;
        const t = this.map.trunkOf(d);
        this.chopAt.set(e.id, this.time);
        this.fx.burst(t.x, t.y - 10, '#B88A5A', e.done ? 24 : 5, e.done ? 160 : 70);
        if (e.done) this.fx.burst(t.x, t.y - 50, this.map.styleZone(d.x, d.y) === DESERT_ZONE ? '#7FA65A' : '#4F8A45', 26, 140); // le feuillage s'éparpille
        this.tools.set(e.by, { kind: 'axe', at: this.time, tx: t.x, ty: t.y });
        break;
      }
      case 'boss': {
        const c = this.map.caves[e.cave];
        const near = c && (this.map.caveAt(this.me.x, this.me.y)?.id === c.id || Math.hypot(this.me.x - c.entrance.x, this.me.y - c.entrance.y) < 1500);
        if (e.down) this.hud.toast(`${bossName(e.s)} est vaincu !`, 'good');
        else if (near) this.hud.toast(`${bossName(e.s)} est de retour dans sa grotte…`);
        if (!e.down && c && this.map.caveAt(this.me.x, this.me.y)?.id === c.id) {
          // il réapparaît sous nos yeux : le cercle d'invocation éclate
          const x = c.inside.x, y = c.inside.y - 60, col = SPECIES[e.s].color;
          this.fx.ring(x, y, '#F0B64A', 20, 220, 1.0);
          this.fx.ring(x, y, col, 10, 150, 0.7);
          this.fx.burst(x, y, col, 40, 240);
          this.fx.burst(x, y, '#F0B64A', 20, 160);
          this.fx.text(x, y - SPECIES[e.s].r - 50, bossName(e.s), '#F0B64A', 24, 2.2);
          this.shake = 0.45;
          sound.play('roar');
        }
        break;
      }
      case 'awaken': {
        if (e.by === this.myId) this.hud.toast(e.id ? `L'Alpha ${SPECIES[e.s].name} s'éveille et rejoint ta meute !` : `L'Alpha ${SPECIES[e.s].name} s'éveille : tes Alphas équipés sont au complet, il t'attend à la Tanière.`, 'alpha');
        else this.hud.toast(`${name(e.by)} a éveillé un Alpha ${SPECIES[e.s].name}`, 'alpha');
        const u = this.posOf(e.id, players);
        if (u) this.fx.ring(u.x, u.y, '#B48CFF', 20, 110, 1.0);
        break;
      }
      case 'heal': {
        const p = this.posOf(e.id, players);
        if (p) this.fx.text(p.x, p.y - 34, `+${e.n}`, '#7FCB5B', e.id === this.myId ? 15 : 12, 0.9);
        break;
      }
      case 'pet': {
        // deux Alphas au repos se mettent à jouer : un « ! » au-dessus de celui qui lance la partie
        const p = (this.net.latest?.pets ?? []).find((q) => q[0] === e.id);
        if (p) this.fx.text(p[3], p[4] - 40, e.act === 'chase' ? '!' : '♪', e.act === 'chase' ? '#F0B64A' : '#F2B8D0', 16, 1);
        break;
      }
      case 'shout': {
        // le suricate se dresse et crie, l'escargot dresse sa carapace : une onde part de lui jusqu'aux alliés touchés
        const u = this.posOf(e.id, players);
        this.shouts.set(e.id, this.time);
        if (u) {
          const col = e.kind === 'rally' ? '#F0B64A' : '#7FC8E8';
          this.fx.ring(u.x, u.y, col, 14, e.r, 0.7);
          this.fx.ring(u.x, u.y, col, 8, e.r * 0.6, 0.5);
        }
        break;
      }
      case 'revive': {
        const u = this.posOf(e.id, players);
        if (u) this.fx.ring(u.x, u.y, '#B48CFF', 60, 10, 0.8);
        break;
      }
      case 'pdie':
        if (e.id === this.myId) this.hud.deathLoss(e.gold, e.wood ?? 0, e.stone ?? 0);
        if (e.id !== this.myId) this.hud.toast(`${name(e.id)} est tombé ! Maintiens R près de lui pour le relever.`);
        break;
      case 'previve': {
        if (e.id === this.myId) this.hud.toast(`${name(e.by)} t'a relevé !`, 'good');
        else if (e.by === this.myId) this.hud.toast(`Tu as relevé ${name(e.id)} !`, 'good');
        else this.hud.toast(`${name(e.by)} a relevé ${name(e.id)}`);
        const p = this.posOf(e.id, players);
        if (p) this.fx.ring(p.x, p.y, '#7FCB5B', 10, 70, 0.8);
        break;
      }
      case 'upgrade':
        if (e.id === this.myId) {
          this.hud.toast(e.what === 'torch' && e.lvl === 1 ? 'Torche achetée : tu y verras plus clair la nuit' : e.what === 'saddle' && e.lvl === 1 ? `Selle achetée : tu peux monter tes Alphas (${keyLabel('mount')})` : `${GEAR_NAMES[e.what]} — niveau ${e.lvl}`, 'good');
          this.fx.ring(this.me.x, this.me.y, '#F0B64A', 10, 60);
        }
        break;
      case 'alphaUp': {
        if (e.by === this.myId) this.hud.toast(`Alpha ${SPECIES[e.s].name} renforcé — niveau ${e.lvl}`, 'alpha');
        const u = this.posOf(e.id, players);
        if (u) this.fx.ring(u.x, u.y, '#B48CFF', 10, 70);
        break;
      }
      case 'scatter':
        if (e.id === this.myId) this.hud.toast(`Ta meute s'est dispersée (${e.n} perdus)… seuls tes Alphas restent.`);
        else this.hud.toast(`La meute de ${name(e.id)} s'est dispersée`);
        break;
      case 'mount':
        if (e.by === this.myId && e.on) {
          const swim = swimMount(this.net.latest?.units.find((u) => u[0] === e.id)?.[1] ?? this.self()?.mount?.species ?? -1);
          if (swim) this.hud.toast('À l\'eau sur ton serpent ! Il ne va qu\'en eau : on en descend au bord d\'une rive.', 'good');
        } else if (e.by === this.myId) this.hud.toast('Tu as mis pied à terre.');
        break;
      case 'full':
        if (e.to === this.myId) this.fx.text(this.me.x, this.me.y - 40, `Meute pleine`, '#A9B3A6', 14);
        break;
      case 'chat':
        this.hud.chat(e.name, e.color, e.text, e.by === this.myId);
        this.bubbles.set(e.by, { text: e.text, until: this.time + 4 + Math.min(4, e.text.length * 0.05) }); // bulle au-dessus de lui
        break;
      case 'info':
        this.hud.toast(e.text);
        break;
      case 'camp': {
        const c = this.map.sites[e.site];
        this.fx.ring(c.x, c.y, '#F0B64A', 20, CAMP_R, 1.2);
        this.fx.burst(c.x, c.y, '#F0B64A', 30, 180);
        this.hud.toast(e.by === this.myId ? `${campName(e.site)} établi ! Sa Pierre de passage est reliée au village.` : `${name(e.by)} a établi le ${campName(e.site)} !`, 'good');
        if (e.by === this.myId) this.hud.setPanel(null);
        this.area = ''; // relance l'annonce du lieu
        break;
      }
      case 'built': {
        const pos = this.map.buildingPos(e.b);
        if (e.b === 'palisade') this.map.setPalisade(true);
        this.fx.ring(pos.x, pos.y, '#F0B64A', 20, 140, 1.2);
        this.fx.burst(pos.x, pos.y, '#F0B64A', 30, 180);
        this.hud.toast(e.by === this.myId ? `Nouveau bâtiment pour tout le village : ${BUILDINGS[e.b].name} !` : `${name(e.by)} a construit : ${BUILDINGS[e.b].name}`, 'good');
        if (e.by === this.myId && e.b !== 'forge2') this.hud.setPanel(null); // la Grande forge : on reste à la forge, pour choisir
        break;
      }
      case 'unlock': {
        const c = this.map.caves[e.cave];
        this.fx.ring(c.entrance.x, c.entrance.y, '#F0B64A', 10, 120, 1.2);
        this.hud.toast(e.by === this.myId ? `Grotte de ${SPECIES[c.boss].name} débloquée !` : `${name(e.by)} a débloqué la grotte de ${SPECIES[c.boss].name}`, 'good');
        if (e.by === this.myId) this.hud.setPanel(null);
        break;
      }
      case 'trade':
        if (e.to === this.myId) this.hud.toast(e.sold ? `${SPECIES[e.s].name} vendu · +${e.gold} or` : `${SPECIES[e.s].name} acheté · −${e.gold} or`, 'good');
        break;
      case 'travel':
        for (const [x, y] of [[e.x, e.y], [e.tx, e.ty]]) {
          this.fx.ring(x, y, '#8FE3D6', 10, 90, 0.8);
          this.fx.burst(x, y, '#8FE3D6', 18, 140);
        }
        if (e.id === this.myId) this.hud.setPanel(null);
        break;
    }
  }

  private frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this.dt = dt;

    const st = this.self();
    const dead = !!st?.dead;
    // Déplacement local (prédiction) puis envoi au serveur à 20 Hz.
    const [dx, dy] = dead || this.hud.panel ? [0, 0] : moveDir();
    this.me.moving = dx !== 0 || dy !== 0;
    if (this.me.moving) {
      // Même règle que le serveur : pas d'eau, on glisse le long des berges.
      const swimming = !!st?.mount && swimMount(st.mount.species); // sur le serpent : seulement l'eau
      const flying = !!st?.mount && flyMount(st.mount.species); // à dos de vautour : par-dessus l'eau et les obstacles
      const speed = PLAYER_SPEED * (st?.mount ? rideSpeed(st.mount.species, st.saddle ?? 1) : bootsSpeed(st?.boots ?? 0)) * (st?.slowed ? WEB_SLOW : 1);
      // (bords du monde et intérieurs de grotte : gérés par blocked())
      const nx = this.me.x + dx * speed * dt, ny = this.me.y + dy * speed * dt;
      // Même règle que le serveur pour les portes fermées : on ne les franchit pas en avançant.
      let shut = -1;
      const ok = (x: number, y: number) => {
        if (!this.map.passable(x, y, swimming, flying) || (!flying && sleeperBlocks(this.hud.sleepers, this.me.x, this.me.y, x, y))) return false;
        const g = this.map.gateCrossed(this.me.x, this.me.y, x, y);
        if (g < 0 || this.gateOpen(g)) return true;
        shut = g;
        return false;
      };
      if (ok(nx, ny)) {
        this.me.x = nx;
        this.me.y = ny;
      } else if (ok(nx, this.me.y)) this.me.x = nx;
      else if (ok(this.me.x, ny)) this.me.y = ny;
      if (shut >= 0 && this.time - this.gateToast > 4) {
        this.gateToast = this.time;
        this.hud.toast(`La brume bloque le passage · ${this.gateWhy(shut)}`);
      }
      const l = Math.hypot(dx, dy);
      this.me.fx = dx / l;
      this.me.fy = dy / l;
    }
    // Tempête de sable : le vent pousse le dompteur vers l'est (même règle de passage qu'un pas ordinaire).
    const gust = dead || this.map.caveAt(this.me.x, this.me.y) || !this.gateOpen(DESERT_ZONE - 1) ? 0 : skyAt(this.map.seed, this.net.serverNow()).storm * desertMix(this.map, this.me.x, this.me.y);
    if (gust > 0.05) {
      const swim = !!st?.mount && swimMount(st.mount.species), fly = !!st?.mount && flyMount(st.mount.species);
      const nx = this.me.x + STORM_WIND.x * STORM_PUSH * gust * dt, ny = this.me.y + STORM_WIND.y * STORM_PUSH * gust * dt;
      if (this.map.passable(nx, ny, swim, fly) && this.map.gateCrossed(this.me.x, this.me.y, nx, ny) < 0) [this.me.x, this.me.y] = [nx, ny];
    }
    // Tornades du Roi-Vautour : elles aspirent le dompteur vers leur cœur (le serveur fait de même pour les monstres).
    if (!dead && !(st?.mount && (swimMount(st.mount.species) || flyMount(st.mount.species)))) {
      for (const h of this.net.latest?.hazards ?? []) {
        if (HAZARD_STYLES[h[8]] !== 'tornado' || h[6] < 100 || h[7]) continue;
        const ddx = h[1] - this.me.x, ddy = h[2] - this.me.y, d = Math.hypot(ddx, ddy);
        if (d < 8 || d > TORNADO_PULL_R) continue;
        const step = Math.min(d, TORNADO_PULL * (1 - (0.5 * d) / TORNADO_PULL_R) * dt), nx = this.me.x + (ddx / d) * step, ny = this.me.y + (ddy / d) * step;
        if (this.map.passable(nx, ny, false, false) && this.map.gateCrossed(this.me.x, this.me.y, nx, ny) < 0) [this.me.x, this.me.y] = [nx, ny];
      }
    }
    // Attaque au clic : tant que le bouton gauche est maintenu, on frappe vers le pointeur.
    this.aimTimer -= dt;
    if (aim.down && !dead && !this.hud.panel && this.aimTimer <= 0) {
      this.aimTimer = 0.15;
      const dpr = this.dpr;
      const x = this.me.x + (aim.x * dpr - this.canvas.width / 2) / this.scale, y = this.me.y + (aim.y * dpr - this.canvas.height / 2) / this.scale;
      this.net.send({ t: 'attack', x, y });
      // guerrier : le coup part vers le pointeur, qu'il touche ou non (au rythme de son arme)
      const st = this.self();
      if (st && (st.cls ?? 'warrior') === 'warrior' && this.time - this.lastSwing >= CLASSES.warrior.cd) {
        this.lastSwing = this.time;
        this.fx.slash(this.me.x, this.me.y, Math.atan2(y - this.me.y, x - this.me.x));
        sound.play('swing');
      }
      [this.me.fx, this.me.fy] = [(x - this.me.x) / (Math.hypot(x - this.me.x, y - this.me.y) || 1), (y - this.me.y) / (Math.hypot(x - this.me.x, y - this.me.y) || 1)];
    }
    // tableau du village ouvert : rafraîchi toutes les 2 s
    if (this.hud.panel === 'board' && (this.boardTimer -= dt) <= 0) {
      this.boardTimer = 2;
      this.net.send({ t: 'board' });
    }
    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && !dead) {
      this.sendTimer = 1 / TICK_HZ;
      this.net.send({ t: 'pos', x: this.me.x, y: this.me.y, fx: this.me.fx, fy: this.me.fy });
    }
    if (this.wasDead && !dead) this.hud.setPanel(null);
    this.wasDead = dead;

    this.fx.update(dt);
    if ((this.pruneTimer -= dt) <= 0) this.prune();
    const view = this.net.sample(dt);
    this.hud.caves = this.net.latest?.caves ?? [];
    this.hud.camps = this.net.latest?.camps ?? [];
    this.hud.buildings = this.net.latest?.buildings ?? [];
    this.hud.unlocked = this.net.latest?.unlocked ?? [];
    this.hud.chests = this.net.latest?.chests ?? [];
    this.hud.hall = this.net.latest?.hall ?? 0;
    this.hud.vname = this.net.latest?.vname ?? '';
    this.hud.sword = this.self()?.sword ?? SWORD_PULLS;
    this.hud.scrollCaves = this.net.latest?.scrolls ?? [];
    this.hud.lore = this.net.latest?.lore ?? [0, 0, 0];
    this.hud.told = this.net.latest?.told ?? [];
    this.hud.banned = this.net.latest?.banned ?? [];
    this.hud.stock = this.net.latest?.stock ?? [0, 0];
    const palisade = this.hud.buildings.includes('palisade');
    if (palisade !== this.palisadeUp) this.map.setPalisade((this.palisadeUp = palisade)); // solide une fois construite (comme côté serveur)
    const bridge = this.hud.buildings.includes('bridge');
    if (bridge !== this.bridgeUp) this.map.setBridge((this.bridgeUp = bridge)); // praticable une fois réparé
    this.hud.bare = this.net.latest?.bare ?? [];
    this.hud.beaten = this.net.latest?.beaten ?? [];
    this.hud.heart = this.net.latest?.heart ?? 0;
    this.hud.school = this.net.latest?.school ?? [0, 0];
    this.watchGates();
    this.hud.sleepers = (view?.units ?? []).flatMap((u) => {
      const cave = u[2] & UNIT_FLAG_DORMANT ? this.map.caveAt(u[3], u[4]) : undefined;
      return cave ? [{ cave: cave.id, x: u[3], y: u[4], r: SPECIES[u[1]].r }] : [];
    });
    // Le brouillard se lève autour de chaque dompteur du village.
    if (!dead) this.fog.reveal(this.me.x, this.me.y, this.myId);
    for (const p of view?.players ?? []) if (p.id !== this.myId && !p.dead) this.fog.reveal(p.x, p.y, p.id);
    this.fog.tick(dt);
    if (!dead) this.updateArea(dt);
    if (view && st) {
      this.render(view.units, view.players);
      this.hud.update(st, view.players, view.units, this.me, this.net.ping);
    }
    requestAnimationFrame(() => this.frame());
  }

  /**
   * Toutes les 10 s, oublie ce qui concerne des unités disparues (mortes, hors de vue) : sans ça, ces tables
   * grossissent pendant toute la partie, une entrée par monstre jamais croisé.
   */
  private prune() {
    this.pruneTimer = 10;
    const alive = new Set((this.net.latest?.units ?? []).map((u) => u[0]));
    for (const [id] of this.net.latest?.dozers ?? []) alive.add(id);
    for (const [id] of this.net.latest?.pets ?? []) alive.add(id);
    for (const p of this.net.latest?.players ?? []) {
      alive.add(p.id);
      if (p.mount) alive.add(p.mount.id);
    }
    for (const m of [this.faces, this.charges] as Map<number, unknown>[]) for (const id of m.keys()) if (!alive.has(id)) m.delete(id);
    for (const [id, until] of this.flashes) if (until < this.time) this.flashes.delete(id);
    for (const [id, l] of this.lunges) if (this.time - l.at > 1) this.lunges.delete(id);
    for (const [id, sp] of this.sprites) if (this.time - sp.used > 2) this.sprites.delete(id);
    const chests = new Set((this.net.latest?.chests ?? []).map((c) => c[0]));
    for (const m of [this.chestSeen, this.chestOpen]) for (const id of m.keys()) if (!chests.has(id)) m.delete(id);
  }
  private pruneTimer = 10;

  /**
   * Monstre dessiné dans sa propre image, redessinée seulement SPRITE_FPS fois par seconde (ou quand son apparence
   * change : flash, sens, charge…) et recollée à sa position à chaque image : le tracé vectoriel coûte 3 fois moins.
   * Les monstres sont décalés dans le temps pour ne pas tous se redessiner pendant la même image.
   */
  /**
   * Alphas au repos sur l'îlot du village : ils flânent, dorment (ronflements), se roulent par terre (sur le dos, les pattes
   * en l'air), reniflent le sol, se courent après (poussière, « ! ») et se chamaillent (petits bonds face à face, notes).
   */
  private drawPets(ctx: CanvasRenderingContext2D, list: { y: number; draw: () => void }[], inView: (x: number, y: number, m: number) => boolean) {
    const pets = this.net.latest?.pets ?? [], at = new Map(pets.map((p) => [p[0], p]));
    for (const [id, s, flags, x, y, color, act, partner] of pets) {
      if (!inView(x, y, 80)) continue;
      const kind = PET_ACTS[act] ?? 'walk', legend = (flags & UNIT_FLAG_LEGEND) !== 0, r = alphaStats(s, 0, 1, legend).r;
      const f = this.faces.get(id) ?? { x, y, face: 1, movedAt: -9 };
      if (Math.abs(x - f.x) > 0.5) f.face = x > f.x ? 1 : -1;
      if (Math.hypot(x - f.x, y - f.y) > 0.25) f.movedAt = this.time;
      [f.x, f.y] = [x, y];
      const mate = partner ? at.get(partner) : undefined;
      if (mate && kind === 'play') f.face = mate[3] > x ? 1 : -1; // face à face
      this.faces.set(id, f);
      const t = this.time, k = id * 0.37;
      let pose: Pose = REST;
      if (kind === 'play') pose = { ...REST, air: Math.abs(Math.sin(t * 7 + k)) * r * 0.45, squash: 1 + Math.sin(t * 14 + k) * 0.08 };
      else if (kind === 'roll') {
        // il se roule : écrasé, il bascule d'un côté à l'autre
        const w = Math.sin(t * 9 + k);
        f.face = w > 0 ? 1 : -1;
        pose = { ...REST, squash: 0.62 + Math.abs(w) * 0.12, dx: w * r * 0.25 };
      } else if (kind === 'sniff') pose = { ...REST, dy: Math.abs(Math.sin(t * 10 + k)) * r * 0.06, squash: 0.94 };
      else if (kind === 'nap') pose = { ...REST, squash: 0.82 };
      const moving = kind === 'walk' || kind === 'chase' || kind === 'flee' ? this.time - f.movedAt < 0.2 : false;
      if ((kind === 'chase' || kind === 'flee') && moving && Math.random() < 0.15) this.fx.dust(x - f.face * r * 0.6, y + r * 0.6, r * 0.5, 2);
      if (kind === 'roll' && Math.random() < 0.1) this.fx.dust(x, y + r * 0.5, r * 0.7, 2);
      if (kind === 'play' && Math.random() < 0.012) this.fx.text(x, y - r * 2, Math.random() < 0.5 ? '♪' : '♥', '#F2B8D0', 13, 1.2);
      const look: UnitLook = {
        x, y, r, species: s, alpha: true, legend, wild: false, ownerColor: color, face: f.face, t: kind === 'nap' ? 0 : t, seed: id * 1.7, flash: false, moving,
      };
      list.push({ y, draw: () => {
        this.drawUnitCached(ctx, id, look, pose);
        if (kind === 'nap') this.snore(x + r * 0.5, y - r * 1.2, 12, id);
      } });
    }
  }

  /** Cri d'un Alpha suricate (ou carapace d'un escargot) : avancement de 0 à 1 pendant la seconde qui suit, 0 sinon. */
  private shoutOf(id: number) {
    const at = this.shouts.get(id);
    if (at === undefined) return 0;
    const k = (this.time - at) / SHOUT_ANIM_S;
    if (k < 1) return Math.max(0.001, k);
    this.shouts.delete(id);
    return 0;
  }

  /**
   * Petit saut quand on change de palier du relief (comme un cheval qui monte une marche) : hauteur à ce moment, en px.
   * Seulement là où la falaise se voit (pas au village, au bord de l'eau…), et pas sur un grand déplacement (voyage).
   */
  private hop(id: number, x: number, y: number) {
    let s = this.steps.get(id);
    if (!s) {
      this.steps.set(id, (s = { lvl: terraceAt(this.map, x, y), x, y, at: -9, up: true }));
      return 0;
    }
    const moved = Math.abs(x - s.x) + Math.abs(y - s.y);
    if (moved > 4) {
      const lvl = terraceAt(this.map, x, y);
      if (lvl !== s.lvl && moved < 200 && this.world.cliffFade(x, y) > 0.3) [s.at, s.up] = [this.time, lvl > s.lvl];
      [s.lvl, s.x, s.y] = [lvl, x, y];
    }
    const t = (this.time - s.at) / HOP_S;
    return t < 1 ? Math.sin(t * Math.PI) * (s.up ? 13 : 8) : 0;
  }

  private drawUnitCached(ctx: CanvasRenderingContext2D, id: number, look: UnitLook, pose: Pose = REST) {
    const r = look.r, res = this.scale;
    const l = r * 2.6, t = r * 2.9, w = r * 5.2, h = r * 4.8; // de quoi contenir aura, couronne, pattes et bond
    const key = `${look.species}|${look.alpha}|${look.legend}|${look.wild}|${look.ownerColor}|${look.face}|${look.flash}|${r}|${look.inWater}|${Math.round((look.charge ?? 0) * 8)}|${look.moving}|${Math.ceil((look.shout ?? 0) * 12)}|${res}`;
    const sprite = SPECIES[look.species].sprite ?? SPECIES[look.species].key;
    const fps = (look.moving && hops(sprite)) || look.shout ? 60 : settings.display.quality === 'low' ? 12 : SPRITE_FPS; // un bond, un cri se dessinent à pleine cadence
    const frame = Math.floor(look.t * fps + (id % 7) / 7);
    let e = this.sprites.get(id);
    if (!e || e.key !== key || e.frame !== frame) {
      const cw = Math.ceil(w * res), ch = Math.ceil(h * res);
      if (!e) this.sprites.set(id, (e = { c: document.createElement('canvas'), key, frame, used: 0 }));
      if (e.c.width !== cw || e.c.height !== ch) [e.c.width, e.c.height] = [cw, ch];
      const g = e.c.getContext('2d')!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cw, ch);
      g.setTransform(res, 0, 0, res, l * res, t * res);
      drawUnit(g, { ...look, x: 0, y: 0 });
      e.key = key;
      e.frame = frame;
    }
    e.used = this.time;
    if (pose === REST) return ctx.drawImage(e.c, look.x - l, look.y - t, w, h);
    // pose d'attaque (fente, élan, écrasement) : l'image est déformée depuis les pieds, sans être redessinée
    ctx.save();
    ctx.globalAlpha *= pose.alpha;
    const fx = look.x + pose.dx, fy = look.y + pose.dy + r * 0.75;
    ctx.translate(fx, fy - pose.air);
    ctx.scale(1 / Math.sqrt(pose.squash), pose.squash);
    ctx.drawImage(e.c, -l, -t - r * 0.75, w, h);
    ctx.restore();
  }
  private drawList: { y: number; draw: () => void }[] = [];
  private lunges = new Map<number, { at: number; ang: number }>(); // monstre → dernier coup au corps à corps
  private shouts = new Map<number, number>(); // Alpha suricate ou escargot → moment de son dernier cri (ou carapace)
  private fired = new Map<string, number>(); // zone d'attaque → moment de son impact (vu par ce client)

  /**
   * Attaques spéciales en cours, par lanceur : leur avancement est extrapolé entre deux snapshots (animation fluide),
   * et l'impact de chacune est daté ici, pour l'écrasement à l'arrivée et le sillon d'une charge.
   */
  private trackCasts(hazards: HazardTuple[], late: number) {
    const casts = new Map<number, Cast>(), seen = new Set<string>();
    for (const h of hazards) {
      const style = HAZARD_STYLES[h[8]];
      if (!style || style === 'lava') continue; // une flaque de traînée : le géant court, il ne prend pas de pose
      const key = `${h[0]}|${h[1]}|${h[2]}|${h[9]}`;
      seen.add(key);
      let since = 0;
      if (h[6] >= 100) {
        let at = this.fired.get(key);
        if (at === undefined) {
          this.fired.set(key, (at = this.time));
          if (style === 'charge') this.chargeTrail(h[1], h[2], h[4], h[5], h[3]);
        }
        since = Math.max(0.001, this.time - at);
      }
      const k = since ? 1 : Math.min(0.999, h[6] / 100 + late / Math.max(0.05, h[10] / 100));
      // un géant qui lance plusieurs rochers à la fois : une seule pose
      if (!casts.has(h[9]) || style !== 'rock') casts.set(h[9], { style, k, since, x: h[1], y: h[2], x2: h[4], y2: h[5] });
    }
    for (const key of this.fired.keys()) if (!seen.has(key)) this.fired.delete(key);
    return casts;
  }

  private lasers = new Map<string, LaserState>();

  /**
   * Rayons runiques : ils partent de l'œil du géant (au-dessus des créatures). Le serveur n'envoie que 20 positions par
   * seconde : l'angle est extrapolé entre deux snapshots pour un balayage fluide. Le bout brûle le sol et crépite ;
   * quand le rayon disparaît du snapshot, il s'éteint en un quart de seconde.
   */
  private drawLasers(ctx: CanvasRenderingContext2D, hazards: HazardTuple[], units: UnitTuple[], late: number, colorOf: Map<number, string>, air: { y: number; draw: () => void }[]) {
    for (const h of hazards) {
      if (HAZARD_STYLES[h[8]] !== 'laser') continue;
      const key = `${h[0]}|${h[1]}|${h[2]}|${h[9]}`;
      const a = Math.atan2(h[5] - h[2], h[4] - h[1]), len = Math.hypot(h[4] - h[1], h[5] - h[2]);
      let st = this.lasers.get(key);
      if (!st) {
        const u = units.find((x) => x[0] === h[9]), lift = u ? SPECIES[u[1]].r * 0.68 : 36; // son œil, géant soulevé compris
        const owner = h[7] ? colorOf.get(h[7]) : undefined;
        st = { a, w: 0, snap: this.shotsAt, len, seen: this.time, spark: 0, lit: false, laser: { ox: h[1], oy: h[2] - lift, gx: h[1], gy: h[2], r: h[3], glow: owner ? rgbOf(owner) : '143,227,214', ember: owner ? rgbOf(owner) : '232,105,63' } };
        this.lasers.set(key, st);
      } else if (this.shotsAt > st.snap) {
        // vitesse de rotation mesurée entre deux snapshots
        const da = Math.atan2(Math.sin(a - st.a), Math.cos(a - st.a));
        st.w = Math.max(-3, Math.min(3, da / Math.max(0.02, this.shotsAt - st.snap)));
        [st.a, st.snap, st.len] = [a, this.shotsAt, len];
      }
      st.seen = this.time;
      const at = this.fired.get(key), since = h[6] >= 100 && at !== undefined ? Math.max(0.001, this.time - at) : 0;
      const k = since ? 1 : Math.min(0.999, h[6] / 100 + late / Math.max(0.05, h[10] / 100));
      if (since && !st.lit) {
        st.lit = true;
        this.fx.ring(st.laser.ox, st.laser.oy, '#FFFFFF', 6, 70, 0.3);
        if (Math.hypot(this.me.x - h[1], this.me.y - h[2]) < 520) this.shake = Math.max(this.shake, 0.22);
      }
      this.queueLaser(ctx, st, k, since, 1, late, air);
    }
    for (const [key, st] of this.lasers) {
      if (st.seen === this.time) continue;
      const fade = 1 - (this.time - st.seen) / 0.25;
      if (fade <= 0 || !st.lit) this.lasers.delete(key);
      else this.queueLaser(ctx, st, 1, 1, fade, 0, air);
    }
  }

  private queueLaser(ctx: CanvasRenderingContext2D, st: LaserState, k: number, since: number, fade: number, late: number, air: { y: number; draw: () => void }[]) {
    const ang = st.a + (since ? st.w * late : 0), l = st.laser;
    const tx = l.gx + Math.cos(ang) * st.len, ty = l.gy + Math.sin(ang) * st.len;
    if (since > 0.12 && fade === 1) {
      // sol brûlé là où passe le rayon, et quelques étincelles
      if (st.tip && Math.hypot(tx - st.tip[0], ty - st.tip[1]) > 3) this.fx.streak(st.tip[0], st.tip[1], tx, ty, l.r * 0.9, 'rgba(28,20,16,0.55)', 2.5);
      st.tip = [tx, ty];
      if (this.time >= st.spark) {
        st.spark = this.time + 0.06;
        this.fx.burst(tx, ty, Math.random() < 0.5 ? '#FFFFFF' : `rgb(${l.glow})`, 3, 170);
      }
    }
    air.push({ y: l.gy + 1, draw: () => drawLaser(ctx, { ...l, tx, ty, k, since, fade }, this.time) });
  }

  /** Tornades en cours : position lissée entre deux snapshots (elles filent vers leur cible), au-dessus des créatures. */
  private twisters = new Map<string, { x: number; y: number; seen: number; r: number; col: string }>();
  private drawTornados(ctx: CanvasRenderingContext2D, hazards: HazardTuple[], colorOf: Map<number, string>, air: { y: number; draw: () => void }[]) {
    // clé : lanceur et rang (une tornade se reconnaît d'un snapshot à l'autre par son ordre chez son lanceur)
    const count = new Map<number, number>();
    for (const h of hazards) {
      if (HAZARD_STYLES[h[8]] !== 'tornado' || h[6] < 100) continue;
      const i = count.get(h[9]) ?? 0;
      count.set(h[9], i + 1);
      const k2 = `${h[9]}|${i}`;
      let tw = this.twisters.get(k2);
      if (!tw) {
        tw = { x: h[1], y: h[2], seen: this.time, r: h[3], col: h[7] ? rgbOf(colorOf.get(h[7]) ?? '#F0B64A') : '196,178,146' };
        this.twisters.set(k2, tw);
        this.fx.dust(h[1], h[2], h[3], 10);
      }
      const f = Math.min(1, this.dt * 10);
      tw.x += (h[1] - tw.x) * f;
      tw.y += (h[2] - tw.y) * f;
      tw.seen = this.time;
      if (Math.random() < this.dt * 8) this.fx.dust(tw.x, tw.y, tw.r * 0.8, 1);
    }
    for (const [key, tw] of this.twisters) {
      const fade = 1 - (this.time - tw.seen) / 0.4;
      if (fade <= 0) {
        this.twisters.delete(key);
        continue;
      }
      air.push({ y: tw.y, draw: () => drawTornado(ctx, tw.x, tw.y, tw.r, this.time, tw.col, fade) });
    }
  }

  /** La charge vient de passer : sillon au sol, poussière tout le long, et quelques mottes de terre. */
  private chargeTrail(x: number, y: number, x2: number, y2: number, w: number) {
    this.fx.streak(x, y, x2, y2, w * 1.1);
    const n = Math.max(2, Math.round(Math.hypot(x2 - x, y2 - y) / 60));
    for (let i = 0; i <= n; i++) this.fx.dust(x + ((x2 - x) * i) / n, y + ((y2 - y) * i) / n, w * 0.9, 3);
    this.fx.debris(x2, y2, ['#7A6248', '#5E4A36'], 8, 140, 5);
  }

  /** Rochers et boules de toile lancés en cloche, du géant jusqu'à leur zone d'impact. */
  private drawThrown(ctx: CanvasRenderingContext2D, hazards: HazardTuple[], units: UnitTuple[], late: number) {
    for (const h of hazards) {
      const style = HAZARD_STYLES[h[8]];
      if ((style !== 'rock' && style !== 'web') || h[6] >= 100) continue;
      const src = this.net.latest && this.net.byId(this.net.latest).get(h[9]);
      const from = units.find((u) => u[0] === h[9]) ?? src;
      const k = Math.min(0.999, h[6] / 100 + late / Math.max(0.05, h[10] / 100));
      const sr = from ? SPECIES[from[1]].r : 40;
      const x0 = from ? from[3] : h[1], y0 = from ? from[4] - sr * 0.6 : h[2] - 300;
      const dist = Math.hypot(h[1] - x0, h[2] - y0);
      const at = lobbed(x0, y0, h[1], h[2], k, 160 + dist * 0.45);
      if (style === 'rock') {
        const mossy = !!from && SPECIES[from[1]].key === 'moss_heart';
        drawRock(ctx, at.x, at.y, at.z, 26 + (h[3] / 80) * 8, k * 9 + h[1] * 0.01, h[1] + h[2], mossy);
      } else drawWebGlob(ctx, at.x, at.y, at.z, 9, this.time);
    }
  }
  private sprites = new Map<number, { c: HTMLCanvasElement; key: string; frame: number; used: number }>();

  private stormOn = false;
  /** Alerte quand une tempête de sable se lève là où l'on est (et quand elle retombe). */
  private watchStorm(level: number) {
    if (!this.stormOn && level >= 0.4) {
      this.stormOn = true;
      this.hud.toast('Tempête de sable ! Elle te blesse tant que tu restes dehors : abrite-toi dans une grotte.');
    } else if (this.stormOn && level < 0.2) {
      this.stormOn = false;
      this.hud.toast('La tempête de sable retombe.', 'good');
    }
  }

  /** Sources de lumière de la nuit : feux, Pierres éveillées, dompteurs, créatures lumineuses, tirs. */
  private collectLights(units: UnitTuple[], players: PlayerState[], shots: ShotTuple[], camps: number[]) {
    const L = this.skyFx, t = this.time, fire = '255,178,92';
    const flick = (k: number) => 0.9 + Math.sin(t * 9 + k) * 0.05 + Math.sin(t * 23 + k * 3) * 0.05;
    L.begin();
    const { village, spawn } = this.map;
    L.light(village.x, village.y, 420, fire, flick(0));
    L.light(spawn.x, spawn.y, 300, fire, flick(1));
    // le cratère du volcan, et sa bouche une fois ouverte
    const vc = this.map.volcano;
    L.light(vc.x, vc.y - VOLCANO_H, 520, '255,120,60', 0.75 * flick(5));
    if (this.hud.heart >= HEART_IN_BOAT) L.light(this.map.shipwreck.x, this.map.shipwreck.y - 20, 240, '255,150,80', 0.8 * flick(7));
    if (volcanoOpen(this.hud.beaten)) L.light(this.map.volcanoMouth.x, this.map.volcanoMouth.y - 40, 260, '255,140,70', 0.8 * flick(6));
    this.map.sites.forEach((c, i) => camps.includes(i) && L.light(c.x, c.y, 280, fire, flick(i + 2)));
    this.map.stones.forEach((st, k) => {
      const active = k === 0 ? this.hud.buildings.includes('stone') : camps.includes(k - 1);
      if (active) L.light(st.x, st.y - 20, 170, '92,200,184', 0.7);
    });
    for (const p of players) {
      if (p.dead) continue;
      const isMe = p.id === this.myId, x = isMe ? this.me.x : p.x, y = isMe ? this.me.y : p.y;
      // sans torche, on n'éclaire pas : il faut l'acheter à la forge
      if (p.torch) L.light(x, y - 16, torchRadius(p.torch), p.torch >= 5 ? '200,235,255' : '255,206,150', 0.85 * (0.94 + Math.sin(t * 13 + x) * 0.06));
      if (p.cls === 'mage') L.light(x + 16, y - 14, 90, '180,140,255', 0.6);
    }
    for (const [, s, flags, x, y] of units) {
      const alpha = (flags & UNIT_FLAG_ALPHA) !== 0, glow = GLOW[SPECIES[s].key];
      if (glow) {
        const r = alpha ? alphaStats(s, 0, 1, (flags & UNIT_FLAG_LEGEND) !== 0).r : SPECIES[s].r;
        L.light(x, y - r * 0.5, r * glow[0], glow[1], glow[2] * (0.92 + Math.sin(t * 3 + x) * 0.08));
      }
    }
    for (const sh of shots) L.light(sh[2], sh[3], 70, '255,224,170', 0.5);
  }

  /**
   * Sur ordinateur, le géant qu'on combat (réveillé, le plus proche, assez près) a sa barre de vie en haut de l'écran,
   * avec son nom (comme le dragon de l'End) : il n'a plus la sienne au-dessus de la tête. Renvoie son id (0 : aucun).
   */
  private bossBarFor = 0;
  private updateBossBar(units: UnitTuple[]) {
    let best = 0, bd = 1100 ** 2, hp = 0, s = 0, flags = 0;
    if (!touchOnly) {
      for (const [id, sp, fl, x, y, h, owner] of units) {
        if (owner || !SPECIES[sp].boss || fl & UNIT_FLAG_DORMANT || h <= 0) continue;
        const d = (x - this.me.x) ** 2 + (y - this.me.y) ** 2;
        if (d < bd) [best, bd, hp, s, flags] = [id, d, h, sp, fl];
      }
    }
    const bar = document.getElementById('boss-bar')!;
    document.getElementById('hud')!.classList.toggle('boss-on', !!best);
    bar.hidden = !best;
    if (!best) {
      this.bossBarFor = 0;
      return 0;
    }
    const pct = `${Math.max(0, Math.min(100, hp))}%`, lag = document.getElementById('boss-lag')!;
    if (this.bossBarFor !== best) {
      // nouveau géant : la traîne repart de sa vie actuelle, sans glisser depuis l'ancien
      this.bossBarFor = best;
      lag.style.transition = 'none';
      lag.style.width = pct;
      void lag.offsetWidth;
      lag.style.transition = '';
    }
    document.getElementById('boss-name')!.textContent = SPECIES[s].title ?? SPECIES[s].name;
    document.getElementById('boss-fill')!.style.width = pct;
    lag.style.width = pct;
    const phase = document.getElementById('boss-phase')!, phases = SPECIES[s].phases;
    phase.hidden = !phases;
    if (phases) phase.textContent = `Phase ${flags & UNIT_FLAG_PHASE3 ? 3 : flags & UNIT_FLAG_PHASE2 ? 2 : 1}/${phases}`;
    return best;
  }

  private render(units: UnitTuple[], players: PlayerState[]) {
    const { ctx, canvas, scale } = this;
    this.shake = Math.max(0, this.shake - 1 / 60);
    const jolt = this.shake > 0 && settings.display.shake ? this.shake * 24 : 0; // secousse quand une attaque frappe près de soi (désactivable)
    const camX = this.me.x + (Math.random() - 0.5) * jolt, camY = this.me.y + (Math.random() - 0.5) * jolt;
    const hw = canvas.width / 2 / scale, hh = canvas.height / 2 / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10181A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, canvas.width / 2 - camX * scale, canvas.height / 2 - camY * scale);

    const sky = skyAt(this.map.seed, this.net.serverNow());
    if (SKY_TEST) Object.assign(sky, SKY_TEST);
    // Mer de sable : jamais de pluie, mais des tempêtes de sable
    const desert = this.map.caveAt(camX, camY) ? 0 : desertMix(this.map, camX, camY);
    sky.rain *= 1 - desert;
    const storm = sky.storm * desert * (this.gateOpen(DESERT_ZONE - 1) ? 1 : 0); // pas de tempête avant que le village ait ouvert le désert
    this.watchStorm(storm);

    // Dans une grotte, on ne voit que la grotte (pas la forêt qui borde le monde).
    if (!this.map.caveAt(camX, camY)) this.world.draw(ctx, camX - hw, camY - hh, camX + hw, camY + hh);
    const { village, spawn } = this.map;
    // Intérieurs des grottes (hors du monde) et leurs entrées sur la carte.
    const inView = (x: number, y: number, m: number) => Math.abs(x - camX) < hw + m && Math.abs(y - camY) < hh + m;
    // seulement la grotte où l'on se trouve : jamais celle d'à côté
    const here = this.map.caveAt(camX, camY);
    if (here === this.map.depths) {
      // les entrailles du volcan : dessinées à chaque image (la lave bouge), avec les sceaux de l'autel
      const sealed = this.map.caves.filter((c) => c.zone === VOLCANO_ZONE).map((c) => !this.hud.beaten.includes(c.boss));
      drawDepths(ctx, this.map, this.time, sealed, !!this.hud.heart);
    } else if (here?.zone === VOYAGE_ZONE) drawVoyage(ctx, here, this.time, camX, camY, hw, hh);
    else if (here) ctx.drawImage(this.world.caveInterior(here), here.inside.x - this.world.caveW / 2, here.inside.y - this.world.caveH / 2);
    if (here && this.hud.caves[here.id] > 0) this.drawBossReturn(ctx, here.inside.x, here.inside.y - 60, this.hud.caves[here.id]);
    const br = this.map.bridge;
    if (!here && inView((br.a.x + br.b.x) / 2, (br.a.y + br.b.y) / 2, Math.hypot(br.b.x - br.a.x, br.b.y - br.a.y) / 2 + 120)) this.world.drawBridge(ctx, this.hud.buildings.includes('bridge'), this.time);
    const cs = this.world.campSize;
    ctx.drawImage(this.world.camp, spawn.x - cs / 2, spawn.y - cs / 2);
    const vs = this.world.villageSize;
    ctx.drawImage(this.world.village, village.x - vs / 2, village.y - vs / 2);
    ctx.save();
    ctx.translate(village.x, village.y);
    this.world.drawCampfire(ctx, this.time);
    // bâtiments : construits, ou leur chantier avec son prix
    for (const b of ['forge', 'den', 'market'] as const) this.world.drawBuilding(ctx, b, this.hud.buildings.includes(b), this.hud.hall, this.hud.buildings.includes(`plot_${b}`), b === 'forge' && this.hud.buildings.includes('forge2'));
    this.world.drawHall(ctx, this.hud.hall, this.time);
    this.world.drawStore(ctx, this.hud.stock);
    this.world.drawBoard(ctx);
    ctx.restore();
    const camps = this.net.latest?.camps ?? [];
    this.map.sites.forEach((c, i) => inView(c.x, c.y, 260) && this.world.drawSite(ctx, i, camps.includes(i), this.time));

    // Projectiles des tireurs (dessinés après les créatures) : les tirs droits sont extrapolés entre deux snapshots.
    const shots = this.net.latest?.shots ?? [];
    const late = Math.min(0.12, this.time - this.shotsAt);
    // Attaques spéciales des mini-boss, au sol sous les créatures, et ce qu'elles font faire à leur lanceur.
    const hazards = this.net.latest?.hazards ?? [];
    const casts = this.trackCasts(hazards, late);
    const colorOf = new Map(players.map((p) => [p.id, p.color]));
    for (const h of hazards) if (inView(h[1], h[2], 500) && HAZARD_STYLES[h[8]] !== 'laser') drawHazard(ctx, h, this.time, colorOf.get(h[7]));
    this.fx.drawGround(ctx); // fissures et sillons au sol
    const air: { y: number; draw: () => void }[] = []; // ce qui passe au-dessus de tout : géant en plein bond, rochers lancés
    this.drawLasers(ctx, hazards, units, late, colorOf, air);
    this.drawTornados(ctx, hazards, colorOf, air);

    // Tri par profondeur : unités, joueurs, filons et entrées de grotte ensemble.
    const list = this.drawList; // réutilisée d'une image à l'autre
    list.length = 0;
    for (const c of this.map.caves) {
      if (c.zone === VOYAGE_ZONE || !inView(c.entrance.x, c.entrance.y, 160)) continue; // le large : on y part depuis le bateau
      list.push({ y: c.entrance.y + 20, draw: () => this.world.drawCaveEntrance(ctx, c, this.time, !this.hud.caves[c.id]) });
    }
    const sc = this.map.school, [plan, wait] = this.hud.school;
    const schoolState = this.hud.buildings.includes('school') ? 'built' : wait ? 'building' : plan ? 'plan' : 'none';
    if (inView(sc.x, sc.y, 140)) list.push({ y: sc.y, draw: () => this.world.drawSchool(ctx, schoolState, wait, this.time) });
    // le vieux coffre du Camp avancé, avec le plan de l'école, tant que personne ne l'a ouvert
    const pc = this.map.planChest;
    if (camps.includes(SCHOOL_CAMP) && !plan && inView(pc.x, pc.y, 80)) list.push({ y: pc.y, draw: () => {
      drawChest(ctx, pc.x, pc.y, 0, this.time);
      drawQuestMark(ctx, pc.x, pc.y - 46, this.time);
    } });
    // le volcan de la Mer de sable : trié par le devant de sa base (on passe devant, on disparaît derrière)
    const vc = this.map.volcano;
    if (!here && inView(vc.x, vc.y - VOLCANO_H / 2, VOLCANO_R + 700)) list.push({ y: vc.y + VOLCANO_R * VOLCANO_RY, draw: () => drawVolcano(ctx, this.map, this.time, volcanoOpen(this.hud.beaten)) });
    this.map.stones.forEach((st, k) => {
      // celle du village se construit ; celles des camps s'éveillent avec leur camp
      const active = k === 0 ? this.hud.buildings.includes('stone') : camps.includes(k - 1);
      const label = k === 0 && !active ? BUILDINGS.stone.name : undefined; // le prix : dans le panneau de construction
      if (inView(st.x, st.y, 100)) list.push({ y: st.y, draw: () => this.world.drawStone(ctx, st.x, st.y, active, this.time, label) });
    });
    // le cœur volcanique, une fois installé dans le bateau
    const sw = this.map.shipwreck;
    if (this.hud.heart >= HEART_IN_BOAT && inView(sw.x, sw.y, 200)) list.push({ y: sw.y + 30, draw: () => drawBoatHeart(ctx, sw.x, sw.y, this.time) });
    // Pierre de passage du bateau : à construire dès la Mer de sable ouverte (éteinte et nommée jusque-là)
    const bs = this.map.boatStone, dock = dockStoneOn(this.hud.buildings, this.hud.lore[1]);
    if ((dock || this.gateOpen(DESERT_ZONE - 1)) && inView(bs.x, bs.y, 100)) list.push({ y: bs.y, draw: () => this.world.drawStone(ctx, bs.x, bs.y, dock, this.time, dock ? undefined : BUILDINGS.stone.name) });
    // parchemins laissés par les géants, au fond de leur grotte (chacun voit ceux qui l'attendent)
    for (const id of this.hud.scrollCaves) {
      const at = this.map.scrollPos(this.map.caves[id]);
      if (inView(at.x, at.y, 60)) list.push({ y: at.y, draw: () => drawScroll(ctx, at.x, at.y, this.time, id) });
    }
    // Palissade du village : pieux hauts, triés avec les créatures (on passe derrière) ; pas encore construite : son tracé.
    const palisade = this.hud.buildings.includes('palisade');
    if (!here && !palisade && inView(village.x, village.y, VILLAGE_R * 1.3 + 60)) this.world.drawPalisadePlan(ctx);
    if (!here && palisade && inView(village.x, village.y, VILLAGE_R * 1.3 + 60)) {
      this.world.stakes.forEach((st, k) => inView(st.x, st.y, 40) && list.push({ y: st.y, draw: () => this.world.drawStake(ctx, k) }));
      this.world.gatePosts.forEach((g, k) => inView(g.x, g.y, 60) && list.push({ y: g.y, draw: () => this.world.drawGatePost(ctx, k, this.time) }));
    }
    // Arbres de la carte : triés avec les créatures, feuillage transparent quand on passe dessous.
    // Abattus : une souche (on passe à travers, comme sur le serveur) jusqu'à ce qu'ils repoussent.
    const treeState = new Map(this.net.latest?.trees ?? []);
    for (const [id, hp] of treeState) if (hp <= 0) this.map.treeDown.add(id);
    const all = here ? [] : this.map.decorIn(camX - hw - 60, camY - hh - 60, camX + hw + 60, camY + hh + 140).filter((d) => d.kind === 0);
    for (const d of all) if (!treeState.has(d.id) || treeState.get(d.id)! > 0) this.map.treeDown.delete(d.id);
    const trees = all.filter((d) => !this.map.treeDown.has(d.id));
    for (const d of all) {
      if (!this.map.treeDown.has(d.id)) continue;
      const t = this.map.trunkOf(d);
      list.push({ y: t.y, draw: () => drawStump(ctx, t.x, t.y, t.r) });
    }
    const tz = new Map(trees.map((d) => [d, this.map.styleZone(d.x, d.y)])); // style de chaque arbre (la jungle a ses géants)
    for (const d of trees) this.world.treeShadow(ctx, d.x, d.y, tz.get(d));
    for (const d of trees) {
      const s = this.world.treeSize(d.x, d.y, tz.get(d));
      const hitK = Math.max(0, 1 - (this.time - (this.chopAt.get(d.id) ?? -9)) / 0.3), shake = Math.sin(this.time * 70) * 3 * hitK; // il tremble sous la hache
      const under = Math.hypot(this.me.x - d.x, this.me.y - (d.y - s * 0.6)) < s + 14 && this.me.y < d.y + s * 0.5;
      const fade = this.fades.get(d) ?? 1, target = under ? 0.3 : 1;
      const next = fade + Math.sign(target - fade) * Math.min(Math.abs(target - fade), 0.08); // fondu en quelques images
      if (next === 1) this.fades.delete(d);
      else this.fades.set(d, next);
      list.push({
        y: d.y + s * 0.5,
        draw: () => {
          if (shake) ctx.translate(shake, 0);
          this.world.tree(ctx, d.x, d.y, tz.get(d) ?? 1, next, false);
          if (shake) ctx.translate(-shake, 0);
        },
      });
    }
    // le vieil homme, près du feu : il regarde le dompteur qui s'approche, sinon le feu
    const { elder } = this.map;
    if (inView(elder.x, elder.y, 60)) {
      const near = Math.hypot(this.me.x - elder.x, this.me.y - elder.y) < 220;
      const tx = near ? this.me.x : this.map.village.x, ty = near ? this.me.y : this.map.village.y, d = Math.hypot(tx - elder.x, ty - elder.y) || 1;
      const calls = this.hud.elderCalls;
      list.push({
        y: elder.y,
        draw: () => {
          drawElder(ctx, elder.x, elder.y, this.time, (tx - elder.x) / d, (ty - elder.y) / d, elderName(this.hud.lore[0]));
          if (calls) drawQuestMark(ctx, elder.x, elder.y - 62, this.time);
        },
      });
    }
    // les autres œufs du village : visibles une fois qu'Aubin s'en souvient, ils éclosent un par un
    const eggs = eggsOf(this.hud.lore[0]);
    if (eggs.shown) {
      HATCHLINGS.forEach((h, i) => {
        const hx = this.map.village.x + h.x, hy = this.map.village.y + h.y;
        if (!inView(hx, hy, 60)) return;
        if (i >= eggs.hatched) return list.push({ y: hy, draw: () => drawWholeEgg(ctx, hx, hy, this.time, i) });
        const near = Math.hypot(this.me.x - hx, this.me.y - hy) < 200, d = Math.hypot(this.me.x - hx, this.me.y - hy) || 1;
        list.push({ y: hy, draw: () => drawHatchling(ctx, hx, hy, h.color, this.time, near ? (this.me.x - hx) / d : 0, near ? (this.me.y - hy) / d : 1, h.name) });
      });
    }
    // plage de l'éveil : l'œuf brisé, et l'épée plantée tant qu'on ne l'a pas déterrée (elle s'envole en sortant)
    const { egg, sword } = this.map;
    if (inView(egg.x, egg.y, 60)) list.push({ y: egg.y, draw: () => drawBrokenEgg(ctx, egg.x, egg.y) });
    const pulls = this.hud.sword, flight = (this.time - this.swordOut) / 0.6;
    if (inView(sword.x, sword.y, 80) && (pulls < SWORD_PULLS || flight < 1)) {
      list.push({
        y: sword.y,
        draw: () => {
          if (pulls < SWORD_PULLS) return drawPlantedSword(ctx, sword.x, sword.y, pulls / SWORD_PULLS, this.time, Math.max(0, 1 - (this.time - this.swordHit) / 0.45));
          ctx.save();
          ctx.globalAlpha = 1 - flight;
          drawPlantedSword(ctx, sword.x, sword.y - flight * 60, 1, this.time, 1 - flight);
          ctx.restore();
        },
      });
    }
    const bare = new Set(this.net.latest?.bare ?? []);
    for (const b of this.map.bushes) {
      if (inView(b.x, b.y, 60)) list.push({ y: b.y, draw: () => drawBush(ctx, b.x, b.y, !bare.has(b.id), b.id, this.map.styleZone(b.x, b.y)) });
    }
    for (const [id, x, y, opened] of this.net.latest?.chests ?? []) {
      if (!inView(x, y, 80)) continue;
      const seen = this.chestSeen.get(id) ?? this.chestSeen.set(id, this.time).get(id)!;
      const k = Math.min(1, (this.time - seen) / 0.7), drop = k < 1 ? Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k) * 140 : 0; // chute et rebonds
      const at = this.chestOpen.get(id);
      const lid = opened ? (at === undefined ? 1 : Math.min(1, (this.time - at) / 0.45)) : 0;
      list.push({ y, draw: () => drawChest(ctx, x, y, lid, this.time, drop) });
    }
    const oreState = new Map(this.net.latest?.ores ?? []);
    // Filons et tas épuisés : disparus (on passe à travers, comme sur le serveur) jusqu'à leur retour.
    for (const [id, hp] of oreState) {
      if (hp <= 0) this.map.oreDown.add(id);
      else this.map.oreDown.delete(id);
    }
    for (const o of this.map.ores) {
      if (!inView(o.x, o.y, 60)) continue;
      const hp = oreState.get(o.id) ?? 100;
      if (hp <= 0) continue;
      list.push({ y: o.y, draw: () => drawOre(ctx, o.x, o.y, o.zone, hp, this.time, o.id, o.res) });
    }

    const topBoss = this.updateBossBar(units);
    for (const u of units) {
      const [id, s, flags, x, y, hp, owner] = u;
      if (flags & UNIT_FLAG_MOUNTED) continue; // dessinée sous son cavalier
      if (!inView(x, y, 220)) continue; // le serveur envoie plus large que l'écran : inutile de dessiner le reste
      const alpha = (flags & UNIT_FLAG_ALPHA) !== 0;
      const legend = (flags & UNIT_FLAG_LEGEND) !== 0;
      const r = alpha ? alphaStats(s, 0, 1, legend).r : SPECIES[s].r;
      const boss = SPECIES[s].boss && owner === 0;
      if (SPECIES[s].anchored && boss && flags & (UNIT_FLAG_HIDDEN | UNIT_FLAG_DORMANT)) {
        // le Kraken sous l'eau (avant de surgir, ou entre deux phases) : remous et bulles, rien d'autre
        list.push({ y: y - 400, draw: () => drawSubmerged(ctx, x, y, r, this.time, (flags & UNIT_FLAG_HIDDEN) !== 0) });
        continue;
      }
      if (flags & UNIT_FLAG_HIDDEN) {
        // hors d'atteinte : vautour qui plane (au-dessus de tout, son ombre au sol), ver sous le sable, suricate à la tanière,
        // escargot rentré dans sa coquille (sur place)
        if (SPECIES[s].shell) {
          const face = this.faces.get(id)?.face ?? 1;
          list.push({ y, draw: () => drawUnit(ctx, { x, y, r, species: s, alpha, wild: owner === 0, face, t: 0, seed: id * 1.7, flash: (this.flashes.get(id) ?? 0) > this.time, shell: true }) });
        } else if (SPECIES[s].flies) {
          list.push({ y: y - 1000, draw: () => drawSoaringShadow(ctx, x, y, r) });
          air.push({ y, draw: () => { // en pleine tempête : il monte très haut, à peine visible dans le sable
            ctx.save();
            ctx.globalAlpha = 1 - storm * 0.6;
            drawSoaring(ctx, x, y, r, this.time, id, 4.2 + storm * 3.5);
            ctx.restore();
          } });
        } else list.push({ y, draw: () => drawBurrow(ctx, x, y, r, !!SPECIES[s].burrows, this.time, id) });
        continue;
      }
      const f = this.faces.get(id) ?? { x, y, face: 1, movedAt: -9 };
      if (Math.abs(x - f.x) > 0.5) f.face = x > f.x ? 1 : -1;
      if (Math.hypot(x - f.x, y - f.y) > 0.25) f.movedAt = this.time;
      [f.x, f.y] = [x, y];
      this.faces.set(id, f);
      const cast = casts.get(id), lunge = this.lunges.get(id);
      if (lunge && this.time - lunge.at < 0.6 && Math.abs(Math.cos(lunge.ang)) > 0.2) f.face = Math.cos(lunge.ang) > 0 ? 1 : -1; // il frappe face à sa cible
      const pose = cast ? castPose(cast, r, x, y, this.time) : (lunge && lungePose(this.time - lunge.at, r, lunge.ang)) || REST;
      const ghost = cast ? ghostOf(cast) : 0;
      const look = (): UnitLook => {
        const ranged = SPECIES[s].ranged, c0 = this.charges.get(id);
        const charge = ranged && c0 !== undefined && this.time - c0 < ranged.windup + 0.15 ? Math.min(1, (this.time - c0) / ranged.windup) : 0;
        return {
          x, y, r, species: s, alpha, wild: owner === 0, ownerColor: owner ? colorOf.get(owner) : undefined,
          face: f.face, t: flags & UNIT_FLAG_ASLEEP ? 0 : this.time, seed: id * 1.7, flash: (this.flashes.get(id) ?? 0) > this.time, legend,
          charge, inWater: !!(SPECIES[s].swim || SPECIES[s].amphibious) && this.map.isWater(x, y), moving: this.time - f.movedAt < 0.2, shout: this.shoutOf(id),
        };
      };
      // Vautour de la meute : il décolle dès qu'il bouge et se pose quand il s'arrête (pas sur l'eau ni dans un arbre).
      if (owner && SPECIES[s].flies && !(flags & UNIT_FLAG_HIDDEN)) {
        const w = this.wings.get(id) ?? { k: 0, at: this.time, x, y, ang: -Math.PI / 2 };
        const perch = !this.map.blocked(x, y) && !this.map.isWater(x, y);
        const want = this.time - f.movedAt < 0.5 || !perch ? 1 : 0, dt = Math.min(0.1, this.time - w.at);
        w.k += Math.sign(want - w.k) * Math.min(Math.abs(want - w.k), dt * (want ? 2.5 : 1.4));
        if (Math.hypot(x - w.x, y - w.y) > 0.5) w.ang = Math.atan2(y - w.y, x - w.x);
        [w.at, w.x, w.y] = [this.time, x, y];
        this.wings.set(id, w);
        if (w.k > 0.25) {
          const k = w.k, beat = k < 1 ? 1 : 0; // il bat des ailes pour monter ou se poser
          list.push({ y, draw: () => drawSoaringShadow(ctx, x, y, r * (0.6 + 0.4 * k)) });
          air.push({ y, draw: () => {
            drawSoaring(ctx, x, y, r, this.time, id, 0.4 + k * 1.6, beat, w.ang);
            if (hp < 100) hpBar(ctx, x, y - r * (2.6 + k * 1.6), alpha ? 46 : 28, hp, '#7FCB5B');
          } });
          continue;
        }
      }
      // clignement : sa silhouette se forme déjà au point d'arrivée
      if (ghost && cast) list.push({ y: cast.y, draw: () => this.drawUnitCached(ctx, id, { ...look(), x: cast.x, y: cast.y }, { ...REST, alpha: ghost }) });
      if (pose.air > r * 0.6) {
        // en plein bond : au-dessus de tout, l'ombre reste au sol (et rétrécit)
        air.push({ y: y + pose.dy, draw: () => drawUnit(ctx, { ...look(), x: x + pose.dx, y: y + pose.dy, air: pose.air, squash: pose.squash }) });
        continue;
      }
      list.push({
        y,
        draw: () => {
          const hop = this.hop(id, x, y); // changement de palier : un petit saut
          this.drawUnitCached(ctx, id, hop ? { ...look(), y: y - hop } : look(), pose);
          if (boss && flags & UNIT_FLAG_DORMANT) this.snore(x + r * 0.6, y - r * 1.3, 18, id); // géant endormi : il attend qu'on lui parle
          if (flags & UNIT_FLAG_ASLEEP) this.snore(x + r * 0.6, y - r * 1.2, 12, id); // lièvre qui dort la nuit, ours le jour
          if (boss && id !== topBoss) {
            // Mini-boss : nom et grande barre de vie, toujours visibles (en combat sur ordinateur : en haut de l'écran).
            ctx.font = '700 15px "Pixelify Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(16,24,26,0.85)';
            ctx.strokeText(SPECIES[s].title ?? SPECIES[s].name, x, y - r * 1.6 - 14);
            ctx.fillStyle = '#F0B64A';
            ctx.fillText(SPECIES[s].title ?? SPECIES[s].name, x, y - r * 1.6 - 14);
            hpBar(ctx, x, y - r * 1.6 - 8, 90, hp, '#E8693F');
            if (SPECIES[s].phases) {
              const ph = flags & UNIT_FLAG_PHASE3 ? 3 : flags & UNIT_FLAG_PHASE2 ? 2 : 1;
              ctx.font = '700 13px "Pixelify Sans", sans-serif';
              ctx.lineWidth = 4;
              ctx.strokeText(`Phase ${ph}/${SPECIES[s].phases}`, x, y - r * 1.6 + 12);
              ctx.fillStyle = '#EEE7D7';
              ctx.fillText(`Phase ${ph}/${SPECIES[s].phases}`, x, y - r * 1.6 + 12);
            }
          } else if (hp < 100) hpBar(ctx, x, y - r * (alpha ? 1.7 : 1.3) - 6, alpha ? 46 : 28, hp, owner ? '#7FCB5B' : '#E8693F');
          if (flags & (UNIT_FLAG_RALLY | UNIT_FLAG_GUARD | UNIT_FLAG_POISON)) drawBuffs(ctx, x, y - r * (alpha ? 1.7 : 1.3) - (hp < 100 ? 18 : 10), flags, this.time, id);
        },
      });
    }
    // Dompteurs déconnectés : endormis près du feu, leurs monstres flânent (ou dorment) dans le village.
    const sleepers = this.net.latest?.sleepers ?? [];
    for (const [name, color, armor, cls, x, y, hat] of sleepers) {
      if (!inView(x, y, 80)) continue;
      list.push({ y, draw: () => {
        drawPlayer(ctx, x, y, color, 0, 1, armor, name, this.time, false, false, false, false, cls || null, null, 0, true, hat ?? 0);
        this.snore(x + 14, y - 36, 15, x);
      } });
    }
    for (const [id, s, flags, x, y, k] of this.net.latest?.dozers ?? []) {
      if (!inView(x, y, 80)) continue;
      const alpha = (flags & UNIT_FLAG_ALPHA) !== 0, legend = (flags & UNIT_FLAG_LEGEND) !== 0, asleep = (flags & UNIT_FLAG_DORMANT) !== 0;
      const r = alpha ? alphaStats(s, 0, 1, legend).r : SPECIES[s].r;
      const f = this.faces.get(id) ?? { x, y, face: 1, movedAt: -9 };
      if (Math.abs(x - f.x) > 0.5) f.face = x > f.x ? 1 : -1;
      f.x = x;
      this.faces.set(id, f);
      list.push({ y, draw: () => {
        this.drawUnitCached(ctx, id, { x, y, r, species: s, alpha, legend, wild: false, ownerColor: sleepers[k]?.[1], face: f.face, t: asleep ? 0 : this.time, seed: id * 1.7, flash: false });
        if (asleep) this.snore(x + r * 0.5, y - r * 1.2, 12, id);
      } });
    }
    this.drawPets(ctx, list, inView);
    for (const p of players) {
      const isMe = p.id === this.myId;
      const x = isMe ? this.me.x : p.x, y = isMe ? this.me.y : p.y;
      if (p.dead) {
        // À terre : silhouette pâle, et l'anneau de réanimation quand un coéquipier peut venir le relever.
        list.push({
          y,
          draw: () => {
            ctx.save();
            ctx.globalAlpha = 0.4;
            drawPlayer(ctx, x, y, p.color, 1, 0, p.armor, p.name, this.time, false, false, isMe, false, p.cls, null, 0, true, p.hat ?? 0);
            ctx.restore();
            if (players.length < 2) return;
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(238,231,215,0.25)';
            ctx.beginPath();
            ctx.arc(x, y - 6, 28, 0, Math.PI * 2);
            ctx.stroke();
            if (p.revive) {
              ctx.strokeStyle = '#7FCB5B';
              ctx.beginPath();
              ctx.arc(x, y - 6, 28, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * p.revive) / 100);
              ctx.stroke();
            }
          },
        });
        continue;
      }
      list.push({
        y,
        draw: () => {
          const fx = isMe ? this.me.fx : p.fx, fy = isMe ? this.me.fy : p.fy;
          const hop = p.mount && flyMount(p.mount.species) ? 0 : this.hop(p.id, x, y); // changement de palier : un petit saut
          let lift = 0, back = 0;
          if (p.mount) {
            // Monture dessinée sous le cavalier, tournée dans le sens de la marche.
            const mr = alphaStats(p.mount.species, 0, 1, p.mount.legend).r;
            if (flyMount(p.mount.species)) {
              // à dos de vautour : son ombre au sol, l'oiseau ailes ouvertes, le cavalier sur son dos
              drawSoaringShadow(ctx, x, y, mr);
              drawSoaring(ctx, x, y, mr, this.time, p.mount.id, FLY_HEIGHT);
              lift = mr * (FLY_HEIGHT - 0.3) + Math.sin(this.time * 1.3 + p.mount.id) * mr * 0.3;
            } else this.drawUnitCached(ctx, p.mount.id, {
              x, y: y - hop, r: mr, species: p.mount.species, alpha: true, wild: false, ownerColor: p.color, legend: p.mount.legend,
              face: fx < -0.1 ? -1 : 1, t: this.time * (isMe && this.me.moving ? 1.8 : 1), seed: p.mount.id,
              flash: (this.flashes.get(p.mount.id) ?? 0) > this.time, inWater: swimMount(p.mount.species) && this.map.isWater(x, y), shout: this.shoutOf(p.mount.id),
            });
            const swim = swimMount(p.mount.species); // serpent : assis bas sur ses anneaux, derrière son cou dressé
            if (!flyMount(p.mount.species)) {
              lift = mr * (swim ? 0.3 : 0.8);
              back = mr * (swim ? 0.7 : 0.25) * (fx < -0.1 ? 1 : -1); // assis sur le dos, pas sur la tête
            }
          }
          // Récolte en cours (un coup il y a moins d'une seconde) : l'arme laisse place à l'outil.
          const used = this.tools.get(p.id);
          const k = used ? (this.time - used.at) / 0.55 : 2;
          const tool: Tool | null = p.holding ? { kind: 'fruit', ang: Math.atan2(fy, fx), k: 0 }
            : used && this.time - used.at < 0.9 ? { kind: used.kind, ang: Math.atan2(used.ty - y, used.tx - x), k: Math.min(1, k) } : null;
          drawPlayer(
            ctx, x + back, y - lift, p.color, fx, fy, p.armor, p.name, this.time,
            isMe ? this.me.moving : false, (this.flashes.get(p.id) ?? 0) > this.time, isMe, !!p.mount, p.cls, tool, p.weapon, (p.sword ?? SWORD_PULLS) >= SWORD_PULLS, p.hat ?? 0, hop,
          );
          if (p.torch && sky.light < 0.85) drawTorch(ctx, x + back - (fx < -0.1 ? -15 : 15), y - lift - 2, p.torch, this.time); // de l'autre main
          if (p.slowed) drawWebbed(ctx, x, y - lift, this.time);
          if (p.buffs) drawBuffs(ctx, x, y - lift - 64, p.buffs, this.time, p.id);
          if (!isMe && p.hp < p.maxHp) hpBar(ctx, x, y + 26, 34, (100 * p.hp) / p.maxHp, '#7FCB5B');
        },
      });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    this.drawThrown(ctx, hazards, units, late);
    air.sort((a, b) => a.y - b.y);
    for (const d of air) d.draw();
    if (!here) this.drawMist(camX, camY, hw, hh);
    this.drawBubbles(players);
    for (const [, kind, x, y, a, b, c, owner] of shots) {
      if (kind === 1 || kind === 3) drawShot(ctx, kind, x, y, a, b, Math.min(100, c + (late * 100) / ARC_FLIGHT_S), this.time, colorOf.get(owner));
      else drawShot(ctx, kind, x + a * late, y + b * late, a, b, 0, this.time, colorOf.get(owner));
    }
    if (!here) this.drawLakeMist(camX, camY, hw, hh);
    this.fog.draw(ctx, -WORLD_HALF, -WORLD_HALF, WORLD_HALF * 2, WORLD_HALF * 2, 0.88);
    this.fx.draw(ctx);
    // Nuit et pluie, communes à tout le village (pas sous terre : les grottes ont leur propre pénombre).
    if (!here) {
      this.collectLights(units, players, shots, camps);
      this.skyFx.shade(ctx, scale, camX, camY, sky);
      this.skyFx.rain(ctx, scale, camX, camY, sky, this.dt, this.dpr);
      this.skyFx.sandstorm(ctx, scale, camX, camY, storm, this.dt, this.dpr, sky.light);
      this.drawCanopy(camX, camY);
    }
    sound.rain(here || !settings.display.weather ? 0 : sky.rain);
    sound.storm(here ? 0 : storm);

    // Joystick tactile / souris.
    if (stick.active) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = this.dpr;
      ctx.strokeStyle = 'rgba(238,231,215,0.35)';
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.arc(stick.ox * dpr, stick.oy * dpr, 60 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(238,231,215,0.35)';
      const ddx = stick.x - stick.ox, ddy = stick.y - stick.oy, d = Math.hypot(ddx, ddy), k = d > 60 ? 60 / d : 1;
      ctx.beginPath();
      ctx.arc((stick.ox + ddx * k) * dpr, (stick.oy + ddy * k) * dpr, 22 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
