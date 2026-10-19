// Boucle de jeu côté client : prédiction locale du joueur, rendu, événements.

import { alphaStats, sleeperBlocks, SHORE_R, swimMount, flyMount, ARC_FLIGHT_S, BUILDINGS, gateHall, gateOpen, HALL, zoneBosses, CAMP_R, campName, CLASSES, LEGEND_MULT, MOVE_NAMES, WEB_SLOW, MOUNT_REACH, MOUNTS, PLAYER_SPEED, SPECIES, TICK_HZ, SWORD_PULLS, VILLAGE_R, WORLD_HALF, bootsSpeed, torchRadius, ZONE_NAMES, mountSpeedOf } from '../../shared/config.ts';
import { clamp, hash2 } from '../../shared/math.ts';
import type { GameEvent, HazardTuple, PlayerState, ServerMsg, ShotTuple, UnitTuple } from '../../shared/protocol.ts';
import { HAZARD_STYLES, UNIT_FLAG_ALPHA, UNIT_FLAG_ASLEEP, UNIT_FLAG_HIDDEN, UNIT_FLAG_DORMANT, UNIT_FLAG_LEGEND, UNIT_FLAG_MOUNTED } from '../../shared/protocol.ts';
import { BOSS_LINES } from './speciesInfo.ts';
import { type Cast, castPose, drawRock, drawWebGlob, ghostOf, impactOf, lobbed, lungePose, type Pose, REST } from './anim.ts';
import { type Ambience, sound } from './audio.ts';
import { Fog } from './fog.ts';
import { Fx } from './fx.ts';
import { playWakeUp } from './intro.ts';
import { buildingNear, Hud } from './hud.ts';
import { aim, initInput, moveDir, stick } from './input.ts';
import { actionOf, keyLabel, matches, maxDpr, settings, touchOnly } from './settings.ts';
import type { Net } from './net.ts';
import { drawBrokenEgg, drawElder, drawPlantedSword, drawBurrow, drawSoaring, drawSoaringShadow, drawTorch, drawBush, drawChest, drawHazard, drawOre, drawPlayer, drawShot, drawUnit, drawWebbed, hpBar, type Tool, type UnitLook } from './sprites.ts';
import { GLOW, SkyFx } from './sky.ts';
import { desertMix, World } from './world.ts';
import { sky as skyAt } from '../../shared/weather.ts';
import { WorldMap } from '../../shared/worldmap.ts';

/** Dégâts affichés arrondis à 2 décimales, à la française : 6,4 · 12 · 4,85. */
/** Nom propre d'un géant (sinon le nom de son espèce). */
const bossName = (s: number) => SPECIES[s].title ?? SPECIES[s].name;
const MIST_FADE_S = 2.5; // une brume qui se lève met ce temps à se dissiper
const SPRITE_FPS = 20; // animation des monstres (images par seconde)
const fmtDmg = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

const FLY_HEIGHT = 2.2; // hauteur de vol à dos de vautour (en rayons de l'oiseau)

const GEAR_NAMES = { weapon: 'Arme améliorée', armor: 'Armure améliorée', torch: 'Torche améliorée', boots: 'Bottes améliorées' };

// En local seulement : ?ciel=nuit, ?ciel=pluie, ?ciel=orage (nuit et pluie) ou ?ciel=tempete (dans la Mer de sable) pour voir le ciel sans attendre.
const SKY_TEST = import.meta.env.DEV ? ({ nuit: { light: 0, dusk: 0 }, pluie: { rain: 1 }, orage: { light: 0, dusk: 0, rain: 1 }, tempete: { storm: 1 } } as Record<string, object>)[new URLSearchParams(location.search).get('ciel') ?? ''] : undefined;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private world: World;
  private map: WorldMap;
  private hud: Hud;
  private fx = new Fx();
  private skyFx = new SkyFx(); // nuit et pluie
  private dt = 0;
  private palisadeUp = false;
  me = { x: 0, y: 0, fx: 1, fy: 0, moving: false };
  private flashes = new Map<number, number>();
  private charges = new Map<number, number>(); // tireur → début de la charge de son tir
  private chestOpen = new Map<number, number>(); // coffre → moment où on l'a ouvert (animation du couvercle)
  private chestSeen = new Map<number, number>(); // coffre → première apparition (il tombe en rebondissant)
  private fades = new Map<object, number>();
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
  private introUntil = 0; // réveil sur l'île en cours : pas de bandeau de lieu
  private swordHit = -9; // dernier coup sur l'épée plantée (elle tremble)
  private swordOut = -9; // épée sortie du sable (elle s'envole)
  private areaTimer = 0;
  private helping = false; // R maintenu (ou bouton tactile) : relever un coéquipier

  constructor(private canvas: HTMLCanvasElement, private net: Net, private myId: number, code: string, seed: number, villageFound = false, founder = false, armed = true) {
    this.ctx = canvas.getContext('2d')!;
    this.map = new WorldMap(seed);
    this.world = new World(this.map);
    this.fog = new Fog(`fangleaf.fog.v7.${seed}`, (x, y) => !this.map.isForest(x, y)); // v7 : île élargie
    this.hud = new Hud(code, this.map, this.fog, founder);
    this.hud.onMount = (id) => net.send({ t: 'mount', id });
    this.hud.onCave = (id, enter) => net.send({ t: 'cave', id, enter });
    this.hud.onLegend = (s) => net.send({ t: 'legend', s });
    this.hud.onClass = (cls) => net.send({ t: 'class', cls });
    this.hud.onTravel = (to) => net.send({ t: 'travel', to });
    this.hud.onEstablish = (site) => net.send({ t: 'establish', site });
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
    this.hud.onPick = () => net.send({ t: 'pick' });
    this.hud.onHold = () => this.toggleHold();
    this.hud.onRide = () => this.toggleMount();
    this.hud.onSword = () => net.send({ t: 'sword' });
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
      if (armed && !villageFound) this.hud.toast('Suis le chemin de terre jusqu\'au village (étoile dorée : clique sur la minicarte).');
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
    const candidates = (this.net.latest?.units ?? []).filter(
      (u) => u[6] === this.myId && u[2] & UNIT_FLAG_ALPHA && MOUNTS[SPECIES[u[1]].key] && Math.hypot(u[3] - this.me.x, u[4] - this.me.y) < MOUNT_REACH,
    );
    if (!candidates.length) {
      const owned = st.army.some((a) => a.alpha && MOUNTS[SPECIES[a.species].key]);
      this.hud.toast(owned ? 'Ta monture est trop loin ou en train de ressusciter.' : 'Aucune monture : éveille un Alpha Loup, Sanglier, Ours, Escargot ou Serpent à la Tanière.');
      return;
    }
    // toujours l'Alpha chevauchable le plus proche ; le serpent seulement si l'eau est à portée (sinon le suivant)
    const nearWater = !!this.map.waterNear(this.me.x, this.me.y, SHORE_R);
    const sorted = candidates.sort((a, b) => Math.hypot(a[3] - this.me.x, a[4] - this.me.y) - Math.hypot(b[3] - this.me.x, b[4] - this.me.y));
    const pick = sorted.find((u) => nearWater || !swimMount(u[1]));
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
    if (area === 'camp') this.hud.banner(first && this.hud.sword < SWORD_PULLS ? 'Une plage inconnue' : 'Plage du naufrage', first ? (this.hud.sword < SWORD_PULLS ? 'Quelque chose brille dans le sable' : 'Suis le chemin de cailloux jusqu\'au feu de camp') : 'De retour sur la plage');
    else if (area === 'village') this.hud.banner('Village', '');
    else if (area.startsWith('site')) {
      if (area.endsWith('+')) this.hud.banner(campName(site), 'Feu de camp · réapparition · Pierre de passage');
      else this.hud.banner('Emplacement de camp', 'Établis-le pour tout le village (E) : soins, réapparition, voyage');
    }
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
    if (!this.puff) {
      // nuage rond et doux, pré-rendu une fois
      const c = (this.puff = document.createElement('canvas'));
      c.width = c.height = 128;
      const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      grad.addColorStop(0, 'rgba(226,232,236,0.95)');
      grad.addColorStop(0.55, 'rgba(206,214,220,0.7)');
      grad.addColorStop(1, 'rgba(190,200,208,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    // nuages espacés (STEP) mais plus grands : à peu près la même couverture, 3 à 4 fois moins d'images collées
    const STEP = settings.display.quality === 'low' ? 150 : 120, feather = 140;
    // densité : 0 avant la lisière, 1 un peu après ; idem (en s'estompant) pour une brume qui se lève
    const density = (a: number) => {
      let d = Math.min(1, Math.max(0, (a - (fogArc - feather)) / (feather * 1.6)));
      for (const [k, t] of fading) {
        if (a > map.gates[k] - feather && a < fogArc) d = Math.max(d, Math.min(1, (a - (map.gates[k] - feather)) / (feather * 1.6)) * (1 - (this.time - t) / MIST_FADE_S));
      }
      return d;
    };
    for (let gx = Math.floor((camX - hw - 120) / STEP); gx <= (camX + hw + 120) / STEP; gx++) {
      for (let gy = Math.floor((camY - hh - 120) / STEP); gy <= (camY + hh + 120) / STEP; gy++) {
        const h = hash2(gx, gy, 41);
        const x = gx * STEP + (h - 0.5) * STEP * 0.6, y = gy * STEP + (hash2(gy, gx, 43) - 0.5) * STEP * 0.6;
        if (Math.abs(x) >= WORLD_HALF || Math.abs(y) >= WORLD_HALF) continue;
        const d = density(map.arcAt(x, y));
        if (d <= 0) continue;
        const size = (150 + h * 90) * (STEP / 64) * 0.78, drift = Math.sin(this.time * 0.25 + h * 9) * 14;
        ctx.globalAlpha = Math.min(1, d);
        ctx.drawImage(this.puff, x + drift - size / 2, y - size / 2 + Math.cos(this.time * 0.2 + h * 7) * 8, size, size);
      }
    }
    ctx.globalAlpha = 1;
    // panneau à la lisière de la brume : la zone, et ce qu'il faut pour la lever
    if (closed >= 0) {
      const c = map.spineAt(fogArc - 90);
      if (Math.abs(c.x - camX) < hw + 300 && Math.abs(c.y - camY) < hh + 300) {
        this.world.drawGateLabel(ctx, c.x, c.y, closed === 0 ? 'Brume · suite de la Lisière' : `Brume · ${ZONE_NAMES[closed]}`, this.gateWhy(closed));
      }
    }
  }
  private puff?: HTMLCanvasElement;
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
    return gateOpen(k, this.hud.hall, this.hud.beaten);
  }

  /** Ce qui manque pour ouvrir la porte k. */
  private gateWhy(k: number) {
    const need: string[] = [];
    if (this.hud.hall < gateHall(k)) need.push(`Hôtel de ville niv. ${gateHall(k)}`);
    const left = k === 0 ? [] : zoneBosses(k).filter((b) => !this.hud.beaten.includes(b));
    if (left.length) need.push(`vaincre ${left.map(bossName).join(', ')}`);
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
        const c = this.map.spineAt(this.map.gates[k]);
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
      case 'chest':
        if (e.to === me) sound.play('chest');
        break;
      case 'challenge':
        sound.play('roar');
        break;
      case 'boom':
        sound.play('boom', near(e.x, e.y));
        break;
      case 'pdie':
        if (e.id === me) sound.play('death');
        break;
      case 'upgrade':
      case 'hall':
      case 'built':
      case 'legend':
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
        if (e.a === this.myId && a && b) {
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
          this.fx.essence(e.x, e.y - 50, SPECIES[e.s].color, '+1 âme');
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
        if (e.by !== this.myId) this.hud.toast(`${name(e.by)} a réveillé ${bossName(this.map.caves[e.cave]?.boss ?? 0)} !`);
        break;
      }
      case 'chest':
        if (e.to === this.myId) {
          this.chestOpen.set(e.id, this.time);
          this.fx.burst(e.x, e.y - 30, '#F0B64A', 40, 220);
          this.fx.ring(e.x, e.y - 10, '#F0B64A', 10, 110, 0.9);
          this.fx.text(e.x, e.y - 70, `+${e.gold} or`, '#F0B64A', 26, 2);
          this.hud.toast(`Coffre ouvert : +${e.gold} or !`, 'good');
        }
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
      case 'beaten':
        this.hud.toast(`Première victoire du village sur ${bossName(e.s)} !`, 'good');
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
        if (e.kind === 'orb') { // orbe du mage : pas de secousse, juste l'éclat violet
          this.fx.ring(e.x, e.y, col, e.r * 0.3, e.r, 0.35);
          break;
        }
        const near = Math.hypot(this.me.x - e.x, this.me.y - e.y) < e.r + 160;
        if (e.kind === 'rock') {
          // le rocher éclate : éclats qui rebondissent, poussière, petites fissures
          this.fx.debris(e.x, e.y, ['#8A8F8A', '#6E736E', '#A4A8A2'], 16, 210, 10);
          this.fx.dust(e.x, e.y, e.r * 0.8, 9);
          this.fx.crack(e.x, e.y, e.r * 0.7, 1.4);
          this.fx.ring(e.x, e.y, 'rgba(220,210,190,0.8)', e.r * 0.2, e.r, 0.35);
          if (near) this.shake = Math.max(this.shake, 0.22);
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
        if (e.by === this.myId) this.hud.toast(`Double éveil : ton Alpha ${SPECIES[e.s].name} devient légendaire ! (×${String(LEGEND_MULT.hp).replace('.', ',')})`, 'alpha');
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
      case 'boss': {
        const c = this.map.caves[e.cave];
        const near = c && (this.map.caveAt(this.me.x, this.me.y)?.id === c.id || Math.hypot(this.me.x - c.entrance.x, this.me.y - c.entrance.y) < 1500);
        if (e.down) this.hud.toast(`${bossName(e.s)} est vaincu ! Ouvre son coffre (E) · retour du géant dans 5 min.`, 'good');
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
        if (e.by === this.myId) this.hud.toast(e.id ? `L'Alpha ${SPECIES[e.s].name} s'éveille et rejoint ta meute !` : `L'Alpha ${SPECIES[e.s].name} s'éveille : 5 Alphas déjà équipés, il t'attend à la Tanière.`, 'alpha');
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
      case 'revive': {
        const u = this.posOf(e.id, players);
        if (u) this.fx.ring(u.x, u.y, '#B48CFF', 60, 10, 0.8);
        break;
      }
      case 'pdie':
        if (e.id === this.myId && e.gold) this.hud.toast(`Tu es tombé : ${e.gold} or perdus.`);
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
          this.hud.toast(e.what === 'torch' && e.lvl === 1 ? 'Torche achetée : tu y verras plus clair la nuit' : `${GEAR_NAMES[e.what]} — niveau ${e.lvl}`, 'good');
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
          this.hud.toast(swim ? 'À l\'eau sur ton serpent ! Il ne va qu\'en eau : F au bord d\'une rive pour descendre.' : 'En selle ! F pour descendre.', 'good');
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
        if (e.by === this.myId) this.hud.setPanel(null);
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
      const speed = PLAYER_SPEED * (st?.mount ? mountSpeedOf(st.mount.species) : bootsSpeed(st?.boots ?? 0)) * (st?.slowed ? WEB_SLOW : 1);
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
    this.hud.banned = this.net.latest?.banned ?? [];
    this.hud.stock = this.net.latest?.stock ?? [0, 0];
    const palisade = this.hud.buildings.includes('palisade');
    if (palisade !== this.palisadeUp) this.map.setPalisade((this.palisadeUp = palisade)); // solide une fois construite (comme côté serveur)
    this.hud.bare = this.net.latest?.bare ?? [];
    this.hud.beaten = this.net.latest?.beaten ?? [];
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
  private drawUnitCached(ctx: CanvasRenderingContext2D, id: number, look: UnitLook, pose: Pose = REST) {
    const r = look.r, res = this.scale;
    const l = r * 2.6, t = r * 2.9, w = r * 5.2, h = r * 4.8; // de quoi contenir aura, couronne, pattes et bond
    const key = `${look.species}|${look.alpha}|${look.legend}|${look.wild}|${look.ownerColor}|${look.face}|${look.flash}|${r}|${look.inWater}|${Math.round((look.charge ?? 0) * 8)}|${look.moving}|${res}`;
    const fps = settings.display.quality === 'low' ? 12 : SPRITE_FPS;
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
  private fired = new Map<string, number>(); // zone d'attaque → moment de son impact (vu par ce client)

  /**
   * Attaques spéciales en cours, par lanceur : leur avancement est extrapolé entre deux snapshots (animation fluide),
   * et l'impact de chacune est daté ici, pour l'écrasement à l'arrivée et le sillon d'une charge.
   */
  private trackCasts(hazards: HazardTuple[], late: number) {
    const casts = new Map<number, Cast>(), seen = new Set<string>();
    for (const h of hazards) {
      const style = HAZARD_STYLES[h[8]];
      if (!style) continue;
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
    const storm = sky.storm * desert;
    this.watchStorm(storm);

    // Dans une grotte, on ne voit que la grotte (pas la forêt qui borde le monde).
    if (!this.map.caveAt(camX, camY)) this.world.draw(ctx, camX - hw, camY - hh, camX + hw, camY + hh);
    const { village, spawn } = this.map;
    // Intérieurs des grottes (hors du monde) et leurs entrées sur la carte.
    const inView = (x: number, y: number, m: number) => Math.abs(x - camX) < hw + m && Math.abs(y - camY) < hh + m;
    // seulement la grotte où l'on se trouve : jamais celle d'à côté
    const here = this.map.caveAt(camX, camY);
    if (here) ctx.drawImage(this.world.caveInterior(here), here.inside.x - this.world.caveW / 2, here.inside.y - this.world.caveH / 2);
    if (here && this.hud.caves[here.id] > 0) this.drawBossReturn(ctx, here.inside.x, here.inside.y - 60, this.hud.caves[here.id]);
    const cs = this.world.campSize;
    ctx.drawImage(this.world.camp, spawn.x - cs / 2, spawn.y - cs / 2);
    const vs = this.world.villageSize;
    ctx.drawImage(this.world.village, village.x - vs / 2, village.y - vs / 2);
    ctx.save();
    ctx.translate(village.x, village.y);
    this.world.drawCampfire(ctx, this.time);
    // bâtiments : construits, ou leur chantier avec son prix
    for (const b of ['forge', 'den', 'market'] as const) this.world.drawBuilding(ctx, b, this.hud.buildings.includes(b), this.hud.hall, this.hud.buildings.includes(`plot_${b}`));
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
    for (const h of hazards) if (inView(h[1], h[2], 500)) drawHazard(ctx, h, this.time, colorOf.get(h[7]));
    this.fx.drawGround(ctx); // fissures et sillons au sol
    const air: { y: number; draw: () => void }[] = []; // ce qui passe au-dessus de tout : géant en plein bond, rochers lancés

    // Tri par profondeur : unités, joueurs, filons et entrées de grotte ensemble.
    const list = this.drawList; // réutilisée d'une image à l'autre
    list.length = 0;
    for (const c of this.map.caves) {
      if (!inView(c.entrance.x, c.entrance.y, 160)) continue;
      list.push({ y: c.entrance.y + 20, draw: () => this.world.drawCaveEntrance(ctx, c, this.time, !this.hud.caves[c.id]) });
    }
    this.map.stones.forEach((st, k) => {
      // celle du village se construit ; celles des camps s'éveillent avec leur camp
      const active = k === 0 ? this.hud.buildings.includes('stone') : camps.includes(k - 1);
      const label = k === 0 && !active ? BUILDINGS.stone.name : undefined; // le prix : dans le panneau de construction
      if (inView(st.x, st.y, 100)) list.push({ y: st.y, draw: () => this.world.drawStone(ctx, st.x, st.y, active, this.time, label) });
    });
    // Palissade du village : pieux hauts, triés avec les créatures (on passe derrière) ; pas encore construite : son tracé.
    const palisade = this.hud.buildings.includes('palisade');
    if (!here && !palisade && inView(village.x, village.y, VILLAGE_R + 60)) this.world.drawPalisadePlan(ctx);
    if (!here && palisade && inView(village.x, village.y, VILLAGE_R + 60)) {
      this.world.stakes.forEach((st, k) => inView(st.x, st.y, 40) && list.push({ y: st.y, draw: () => this.world.drawStake(ctx, k) }));
      this.world.gatePosts.forEach((g, k) => inView(g.x, g.y, 60) && list.push({ y: g.y, draw: () => this.world.drawGatePost(ctx, k, this.time) }));
    }
    // Arbres de la carte : triés avec les créatures, feuillage transparent quand on passe dessous.
    const trees = here ? [] : this.map.decorIn(camX - hw - 60, camY - hh - 60, camX + hw + 60, camY + hh + 140).filter((d) => d.kind === 0);
    for (const d of trees) this.world.treeShadow(ctx, d.x, d.y);
    for (const d of trees) {
      const s = this.world.treeSize(d.x, d.y);
      const under = Math.hypot(this.me.x - d.x, this.me.y - (d.y - s * 0.6)) < s + 14 && this.me.y < d.y + s * 0.5;
      const fade = this.fades.get(d) ?? 1, target = under ? 0.3 : 1;
      const next = fade + Math.sign(target - fade) * Math.min(Math.abs(target - fade), 0.08); // fondu en quelques images
      if (next === 1) this.fades.delete(d);
      else this.fades.set(d, next);
      list.push({ y: d.y + s * 0.5, draw: () => this.world.tree(ctx, d.x, d.y, this.map.styleZone(d.x, d.y), next, false) });
    }
    // le vieil homme, près du feu : il regarde le dompteur qui s'approche, sinon le feu
    const { elder } = this.map;
    if (inView(elder.x, elder.y, 60)) {
      const near = Math.hypot(this.me.x - elder.x, this.me.y - elder.y) < 220;
      const tx = near ? this.me.x : this.map.village.x, ty = near ? this.me.y : this.map.village.y, d = Math.hypot(tx - elder.x, ty - elder.y) || 1;
      list.push({ y: elder.y, draw: () => drawElder(ctx, elder.x, elder.y, this.time, (tx - elder.x) / d, (ty - elder.y) / d) });
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

    for (const u of units) {
      const [id, s, flags, x, y, hp, owner] = u;
      if (flags & UNIT_FLAG_MOUNTED) continue; // dessinée sous son cavalier
      if (!inView(x, y, 220)) continue; // le serveur envoie plus large que l'écran : inutile de dessiner le reste
      const alpha = (flags & UNIT_FLAG_ALPHA) !== 0;
      const legend = (flags & UNIT_FLAG_LEGEND) !== 0;
      const r = alpha ? alphaStats(s, 0, 1, legend).r : SPECIES[s].r;
      const boss = SPECIES[s].boss && owner === 0;
      if (flags & UNIT_FLAG_HIDDEN) {
        // hors d'atteinte : vautour qui plane (au-dessus de tout, son ombre au sol), ver sous le sable, suricate à la tanière
        if (SPECIES[s].flies) {
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
          charge, inWater: !!SPECIES[s].swim && this.map.isWater(x, y), moving: this.time - f.movedAt < 0.2,
        };
      };
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
          this.drawUnitCached(ctx, id, look(), pose);
          if (boss && flags & UNIT_FLAG_DORMANT) this.snore(x + r * 0.6, y - r * 1.3, 18, id); // géant endormi : il attend qu'on lui parle
          if (flags & UNIT_FLAG_ASLEEP) this.snore(x + r * 0.6, y - r * 1.2, 12, id); // sanglier qui dort la nuit
          if (boss) {
            // Mini-boss : nom et grande barre de vie, toujours visibles.
            ctx.font = '700 15px "Pixelify Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(16,24,26,0.85)';
            ctx.strokeText(SPECIES[s].title ?? SPECIES[s].name, x, y - r * 1.6 - 14);
            ctx.fillStyle = '#F0B64A';
            ctx.fillText(SPECIES[s].title ?? SPECIES[s].name, x, y - r * 1.6 - 14);
            hpBar(ctx, x, y - r * 1.6 - 8, 90, hp, '#E8693F');
          } else if (hp < 100) hpBar(ctx, x, y - r * (alpha ? 1.7 : 1.3) - 6, alpha ? 46 : 28, hp, owner ? '#7FCB5B' : '#E8693F');
        },
      });
    }
    // Dompteurs déconnectés : endormis près du feu, leurs monstres flânent (ou dorment) dans le village.
    const sleepers = this.net.latest?.sleepers ?? [];
    for (const [name, color, armor, cls, x, y] of sleepers) {
      if (!inView(x, y, 80)) continue;
      list.push({ y, draw: () => {
        drawPlayer(ctx, x, y, color, 0, 1, armor, name, this.time, false, false, false, false, cls || null);
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
            drawPlayer(ctx, x, y, p.color, 1, 0, p.armor, p.name, this.time, false, false, isMe, false, p.cls);
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
              x, y, r: mr, species: p.mount.species, alpha: true, wild: false, ownerColor: p.color, legend: p.mount.legend,
              face: fx < -0.1 ? -1 : 1, t: this.time * (isMe && this.me.moving ? 1.8 : 1), seed: p.mount.id,
              flash: (this.flashes.get(p.mount.id) ?? 0) > this.time, inWater: swimMount(p.mount.species) && this.map.isWater(x, y),
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
            isMe ? this.me.moving : false, (this.flashes.get(p.id) ?? 0) > this.time, isMe, !!p.mount, p.cls, tool, p.weapon, (p.sword ?? SWORD_PULLS) >= SWORD_PULLS,
          );
          if (p.torch && sky.light < 0.85) drawTorch(ctx, x + back - (fx < -0.1 ? -15 : 15), y - lift - 2, p.torch, this.time); // de l'autre main
          if (p.slowed) drawWebbed(ctx, x, y - lift, this.time);
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
      if (kind === 1) drawShot(ctx, kind, x, y, a, b, Math.min(100, c + (late * 100) / ARC_FLIGHT_S), this.time, colorOf.get(owner));
      else drawShot(ctx, kind, x + a * late, y + b * late, a, b, 0, this.time, colorOf.get(owner));
    }
    this.fog.draw(ctx, -WORLD_HALF, -WORLD_HALF, WORLD_HALF * 2, WORLD_HALF * 2, 0.88);
    this.fx.draw(ctx);
    // Nuit et pluie, communes à tout le village (pas sous terre : les grottes ont leur propre pénombre).
    if (!here) {
      this.collectLights(units, players, shots, camps);
      this.skyFx.shade(ctx, scale, camX, camY, sky);
      this.skyFx.rain(ctx, scale, camX, camY, sky, this.dt, this.dpr);
      this.skyFx.sandstorm(ctx, scale, camX, camY, storm, this.dt, this.dpr, sky.light);
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
