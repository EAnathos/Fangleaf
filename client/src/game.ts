// Boucle de jeu côté client : prédiction locale du joueur, rendu, événements.

import { alphaStats, ARC_FLIGHT_S, BUILDINGS, buildingCost, costText, gateHall, gateOpen, HALL, zoneBosses, REVIVE_R, CAMP_R, campName, CLASSES, LEGEND_MULT, MOVE_NAMES, WEB_SLOW, MOUNT_REACH, MOUNTS, PLAYER_SPEED, SPECIES, TICK_HZ, WORLD_HALF, ZONE_NAMES, mountSpeedOf } from '../../shared/config.ts';
import { clamp } from '../../shared/math.ts';
import type { GameEvent, PlayerState, ServerMsg, UnitTuple } from '../../shared/protocol.ts';
import { UNIT_FLAG_ALPHA, UNIT_FLAG_DORMANT, UNIT_FLAG_LEGEND, UNIT_FLAG_MOUNTED } from '../../shared/protocol.ts';
import { BOSS_LINES } from './speciesInfo.ts';
import { Fog } from './fog.ts';
import { Fx } from './fx.ts';
import { buildingNear, Hud } from './hud.ts';
import { initInput, moveDir, stick } from './input.ts';
import type { Net } from './net.ts';
import { drawBush, drawChest, drawHazard, drawOre, drawPlayer, drawShot, drawUnit, drawWebbed, hpBar, type Tool } from './sprites.ts';
import { World } from './world.ts';
import { WorldMap } from '../../shared/worldmap.ts';

/** Dégâts affichés arrondis à 2 décimales, à la française : 6,4 · 12 · 4,85. */
const fmtDmg = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

export class Game {
  private ctx: CanvasRenderingContext2D;
  private world: World;
  private map: WorldMap;
  private hud: Hud;
  private fx = new Fx();
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
  private faces = new Map<number, { x: number; face: number }>();
  private lastFrame = performance.now();
  private time = 0;
  private scale = 1;
  private sendTimer = 0;
  private wasDead = false;
  private fog: Fog;
  private lastMount = 0;
  private area = '';
  private shake = 0;
  private areaTimer = 0;
  private helping = false; // R maintenu (ou bouton tactile) : relever un coéquipier

  constructor(private canvas: HTMLCanvasElement, private net: Net, private myId: number, code: string, seed: number, villageFound = false, founder = false) {
    this.ctx = canvas.getContext('2d')!;
    this.map = new WorldMap(seed);
    this.world = new World(this.map);
    this.fog = new Fog(`fangleaf.fog.v4.${seed}`, (x, y) => !this.map.isForest(x, y)); // v4 : carte en couloir
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
    this.hud.onHall = () => net.send({ t: 'hall' });
    this.hud.onDeposit = () => net.send({ t: 'deposit' });
    this.hud.onPick = () => net.send({ t: 'pick' });
    this.hud.onHold = () => this.toggleHold();
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
    this.hud.toast('ZQSD / flèches ou glisser pour bouger · attaque auto · E près d\'un bâtiment');
    if (!villageFound) this.hud.toast('Suis le chemin de terre jusqu\'au village (étoile dorée : clique sur la minicarte).');
    initInput(canvas, (code, key) => this.onKey(code, key), (_code, key) => (key === 'r' || key === '') && this.setHelp(false));
    addEventListener('resize', () => this.resize());
    this.resize();
    net.onMessage = (m) => this.onMessage(m);
    requestAnimationFrame(() => this.frame());
  }

  private resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.scale = clamp(Math.min(innerWidth / 1350, innerHeight / 800), 0.62, 1.25) * dpr;
  }

  toast(text: string) {
    this.hud.toast(text);
  }

  private onKey(code: string, key: string) {
    if (key === 'e') {
      const st = this.self();
      const b = buildingNear(this.map, this.me.x, this.me.y, this.hud);
      if (this.hud.panel) this.hud.setPanel(null);
      else if (st && !st.dead && b?.panel) this.hud.setPanel(b.panel);
      else if (st && !st.dead && b?.deposit) this.net.send({ t: 'deposit' });
      else if (st && !st.dead && b?.pick) this.net.send({ t: 'pick' });
      else if (st && !st.dead && b?.chest !== undefined) this.net.send({ t: 'chest', id: b.chest });
      else if (st && !st.dead && b?.cave) this.net.send({ t: 'cave', id: b.cave.id, enter: b.cave.enter });
    } else if (key === 'Escape') {
      // Échap ferme d'abord ce qui est ouvert (carte, forge, Tanière, confirmation) ; sinon, propose de revenir au lobby.
      this.hud.setPanel(this.hud.panel ? null : 'quit');
    }
    else if (key === 'm') this.hud.setPanel(this.hud.panel === 'map' ? null : 'map');
    else if (key === 'f') this.toggleMount();
    else if (key === 't') this.toggleHold();
    else if (key === 'r') this.setHelp(true);
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

  /** F : descendre, ou monter sur l'Alpha chevauchable le plus proche (de préférence le dernier utilisé). */
  private toggleMount() {
    const st = this.self();
    if (!st || st.dead) return;
    if (st.mount) return this.net.send({ t: 'mount', id: 0 });
    const candidates = (this.net.latest?.units ?? []).filter(
      (u) => u[6] === this.myId && u[2] & UNIT_FLAG_ALPHA && MOUNTS[SPECIES[u[1]].key] && Math.hypot(u[3] - this.me.x, u[4] - this.me.y) < MOUNT_REACH,
    );
    if (!candidates.length) {
      const owned = st.army.some((a) => a.alpha && MOUNTS[SPECIES[a.species].key]);
      this.hud.toast(owned ? 'Ta monture est trop loin ou en train de ressusciter.' : 'Aucune monture : éveille un Alpha Loup, Sanglier ou Ours à la Tanière.');
      return;
    }
    const pick = candidates.find((u) => u[0] === this.lastMount) ?? candidates.sort((a, b) => Math.hypot(a[3] - this.me.x, a[4] - this.me.y) - Math.hypot(b[3] - this.me.x, b[4] - this.me.y))[0];
    this.net.send({ t: 'mount', id: pick[0] });
  }

  /** Annonce le lieu quand on y entre : camp de départ, village ou zone de danger. */
  private updateArea(dt: number) {
    this.areaTimer -= dt;
    if (this.areaTimer > 0) return;
    this.areaTimer = 0.25;
    const { x, y } = this.me, { spawn } = this.map;
    const cave = this.map.caveAt(x, y);
    const site = this.map.siteAt(x, y, CAMP_R);
    const area = cave ? `cave${cave.id}` : this.map.inVillage(x, y) ? 'village'
      : Math.hypot(x - spawn.x, y - spawn.y) < 260 ? 'camp'
      : site >= 0 ? `site${site}${this.hud.camps.includes(site) ? '+' : ''}`
      : `zone${this.map.zoneAt(x, y)}`;
    if (area === this.area) return;
    const first = this.area === '';
    this.area = area;
    if (area === 'camp') this.hud.banner('Camp de départ', first ? 'Le village t\'attend au bout du chemin' : 'De retour au camp');
    else if (area === 'village') this.hud.banner('Village', 'Feu de camp · Forge · Tanière · Marché · Pierre de passage');
    else if (area.startsWith('site')) {
      if (area.endsWith('+')) this.hud.banner(campName(site), 'Feu de camp · réapparition · Pierre de passage');
      else this.hud.banner('Emplacement de camp', 'Établis-le pour tout le village (E) : soins, réapparition, voyage');
    }
    else if (cave) {
      const boss = SPECIES[cave.boss];
      this.hud.banner(`Antre : ${boss.name}`, this.hud.caves[cave.id] ? 'Le géant n\'est pas encore revenu' : 'Il dort au fond de sa grotte : va lui parler (E) pour lancer le combat', true);
    }
    else {
      const z = Number(area.slice(4));
      const names = SPECIES.filter((s) => s.zone === z).map((s) => s.name).join(' · ');
      if (!first) this.hud.banner(ZONE_NAMES[z - 1], `Zone ${z} · ${names}`, z >= 3);
    }
  }

  private gateOpen(k: number) {
    return gateOpen(k, this.hud.hall, this.hud.beaten);
  }

  /** Ce qui manque pour ouvrir la porte k. */
  private gateWhy(k: number) {
    const need: string[] = [];
    if (this.hud.hall < gateHall(k)) need.push(`Hôtel de ville niv. ${gateHall(k)}`);
    const left = k === 0 ? [] : zoneBosses(k).filter((b) => !this.hud.beaten.includes(b));
    if (left.length) need.push(`vaincre ${left.map((b) => SPECIES[b].name).join(', ')}`);
    return need.join(' · ');
  }

  /** Une porte vient de s'ouvrir (amélioration ou géant vaincu, par n'importe qui) : on l'annonce. */
  private watchGates() {
    const open = this.map.gates.map((_, k) => this.gateOpen(k));
    if (this.gatesOpen && this.net.latest) {
      open.forEach((o, k) => {
        if (!o || this.gatesOpen![k]) return;
        this.hud.toast(k === 0 ? 'La porte du village est ouverte : la Lisière vous attend !' : `La porte des ${ZONE_NAMES[k]} (zone ${k + 1}) est ouverte !`, 'good');
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
    const u = this.net.latest?.units.find((q) => q[0] === id);
    return u ? { x: u[3], y: u[4] } : undefined;
  }

  private onEvent(e: GameEvent, players: PlayerState[]) {
    const name = (id: number) => players.find((p) => p.id === id)?.name ?? '?';
    switch (e.e) {
      case 'hit': {
        this.flashes.set(e.b, this.time + 0.1);
        const a = this.posOf(e.a, players), b = this.posOf(e.b, players);
        const ranged = players.find((q) => q.id === e.a)?.cls;
        if (e.a === this.myId && a && b) {
          if (ranged !== 'archer' && ranged !== 'mage') this.fx.slash(a.x, a.y, Math.atan2(b.y - a.y, b.x - a.x));
          this.fx.text(b.x, b.y - 24, fmtDmg(e.dmg), '#EEE7D7', 14, 0.7);
        }
        if (e.b === this.myId) this.fx.text(this.me.x, this.me.y - 30, `-${fmtDmg(e.dmg)}`, '#FF8A65', 15, 0.8);
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
          this.hud.toast(`Âme de ${SPECIES[e.s].name} obtenue : rends ton Alpha ${SPECIES.find((b) => b.key === SPECIES[e.s].base)?.name ?? ''} légendaire à la Tanière !`, 'alpha');
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
        if (e.by !== this.myId) this.hud.toast(`${name(e.by)} a réveillé ${boss.name} !`);
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
        this.hud.toast(`Première victoire du village sur ${SPECIES[e.s].name} !`, 'good');
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
        const col = e.kind === 'cloud' ? '#A0BE5A' : e.kind === 'web' ? '#EEE7D7' : e.kind === 'splash' ? '#B9D86A' : '#E8693F';
        this.fx.ring(e.x, e.y, col, e.r * 0.3, e.r, 0.45);
        this.fx.burst(e.x, e.y, col, 14, 160);
        if (Math.hypot(this.me.x - e.x, this.me.y - e.y) < e.r + 40) this.shake = 0.25;
        break;
      }
      case 'legend':
        if (e.by === this.myId) this.hud.toast(`Ton Alpha ${SPECIES[e.s].name} devient légendaire ! (×${String(LEGEND_MULT.hp).replace('.', ',')})`, 'alpha');
        else this.hud.toast(`${name(e.by)} a rendu légendaire son Alpha ${SPECIES[e.s].name}`, 'alpha');
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
        if (e.down) this.hud.toast(`${SPECIES[e.s].name} est vaincu ! Ouvre son coffre (E) · retour du géant dans 5 min.`, 'good');
        else if (near) this.hud.toast(`${SPECIES[e.s].name} est de retour dans sa grotte…`);
        break;
      }
      case 'awaken': {
        if (e.by === this.myId) this.hud.toast(e.id ? `L'Alpha ${SPECIES[e.s].name} s'éveille et rejoint ta meute !` : `L'Alpha ${SPECIES[e.s].name} s'éveille : 5 Alphas déjà équipés, il t'attend à la Tanière.`, 'alpha');
        else this.hud.toast(`${name(e.by)} a éveillé un Alpha ${SPECIES[e.s].name}`, 'alpha');
        const u = this.posOf(e.id, players);
        if (u) this.fx.ring(u.x, u.y, '#B48CFF', 20, 110, 1.0);
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
          this.hud.toast(`${e.what === 'weapon' ? 'Arme' : 'Armure'} améliorée — niveau ${e.lvl}`, 'good');
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
          this.lastMount = e.id;
          this.hud.toast('En selle ! F pour descendre.', 'good');
        } else if (e.by === this.myId) this.hud.toast('Tu as mis pied à terre.');
        break;
      case 'full':
        if (e.to === this.myId) this.fx.text(this.me.x, this.me.y - 40, `Meute pleine`, '#A9B3A6', 14);
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
        const pos = e.b === 'stone' ? this.map.stones[0] : this.map[e.b];
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

    const st = this.self();
    const dead = !!st?.dead;
    // Déplacement local (prédiction) puis envoi au serveur à 20 Hz.
    const [dx, dy] = dead || this.hud.panel ? [0, 0] : moveDir();
    this.me.moving = dx !== 0 || dy !== 0;
    if (this.me.moving) {
      // Même règle que le serveur : pas d'eau, on glisse le long des berges.
      const speed = PLAYER_SPEED * (st?.mount ? mountSpeedOf(st.mount.species) : 1) * (st?.slowed ? WEB_SLOW : 1);
      // (bords du monde et intérieurs de grotte : gérés par blocked())
      const nx = this.me.x + dx * speed * dt, ny = this.me.y + dy * speed * dt;
      // Même règle que le serveur pour les portes fermées : on ne les franchit pas en avançant.
      let shut = -1;
      const ok = (x: number, y: number) => {
        if (this.map.blocked(x, y)) return false;
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
        this.hud.toast(`${shut === 0 ? 'Porte du village' : `Porte des ${ZONE_NAMES[shut]}`} fermée · ${this.gateWhy(shut)}`);
      }
      const l = Math.hypot(dx, dy);
      this.me.fx = dx / l;
      this.me.fy = dy / l;
    }
    this.sendTimer -= dt;
    if (this.sendTimer <= 0 && !dead) {
      this.sendTimer = 1 / TICK_HZ;
      this.net.send({ t: 'pos', x: this.me.x, y: this.me.y, fx: this.me.fx, fy: this.me.fy });
    }
    if (this.wasDead && !dead) this.hud.setPanel(null);
    this.wasDead = dead;

    this.fx.update(dt);
    const view = this.net.sample(dt);
    this.hud.caves = this.net.latest?.caves ?? [];
    this.hud.camps = this.net.latest?.camps ?? [];
    this.hud.buildings = this.net.latest?.buildings ?? [];
    this.hud.unlocked = this.net.latest?.unlocked ?? [];
    this.hud.chests = this.net.latest?.chests ?? [];
    this.hud.hall = this.net.latest?.hall ?? 0;
    this.hud.stock = this.net.latest?.stock ?? [0, 0];
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

  private render(units: UnitTuple[], players: PlayerState[]) {
    const { ctx, canvas, scale } = this;
    this.shake = Math.max(0, this.shake - 1 / 60);
    const jolt = this.shake > 0 ? this.shake * 24 : 0; // secousse quand une attaque frappe près de soi
    const camX = this.me.x + (Math.random() - 0.5) * jolt, camY = this.me.y + (Math.random() - 0.5) * jolt;
    const hw = canvas.width / 2 / scale, hh = canvas.height / 2 / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10181A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, canvas.width / 2 - camX * scale, canvas.height / 2 - camY * scale);

    // Dans une grotte, on ne voit que la grotte (pas la forêt qui borde le monde).
    if (!this.map.caveAt(camX, camY)) this.world.draw(ctx, camX - hw, camY - hh, camX + hw, camY + hh);
    const { village, spawn } = this.map;
    // Intérieurs des grottes (hors du monde) et leurs entrées sur la carte.
    const inView = (x: number, y: number, m: number) => Math.abs(x - camX) < hw + m && Math.abs(y - camY) < hh + m;
    // seulement la grotte où l'on se trouve : jamais celle d'à côté
    const here = this.map.caveAt(camX, camY);
    if (here) ctx.drawImage(this.world.caveInterior(here), here.inside.x - this.world.caveW / 2, here.inside.y - this.world.caveH / 2);
    const cs = this.world.campSize;
    ctx.drawImage(this.world.camp, spawn.x - cs / 2, spawn.y - cs / 2);
    const vs = this.world.villageSize;
    ctx.drawImage(this.world.village, village.x - vs / 2, village.y - vs / 2);
    ctx.save();
    ctx.translate(village.x, village.y);
    this.world.drawCampfire(ctx, this.time);
    // bâtiments : construits, ou leur chantier avec son prix
    for (const b of ['forge', 'den', 'market'] as const) this.world.drawBuilding(ctx, b, this.hud.buildings.includes(b), this.hud.hall);
    this.world.drawHall(ctx, this.hud.hall, this.time);
    this.world.drawStore(ctx, this.hud.stock);
    ctx.restore();
    // Portes des zones (dans le couloir, à l'écran) : palissade en travers, couchée une fois ouverte.
    const gates = this.map.gates.map((g, k) => k).filter((k) => {
      const c = this.map.spineAt(this.map.gates[k]);
      return !here && inView(c.x, c.y, 1100);
    });
    const camps = this.net.latest?.camps ?? [];
    this.map.sites.forEach((c, i) => inView(c.x, c.y, 260) && this.world.drawSite(ctx, i, camps.includes(i), this.time));

    // Attaques spéciales des mini-boss, au sol sous les créatures.
    for (const h of this.net.latest?.hazards ?? []) if (inView(h[1], h[2], 500)) drawHazard(ctx, h, this.time);
    // Projectiles des tireurs (dessinés après les créatures) : les tirs droits sont extrapolés entre deux snapshots.
    const shots = this.net.latest?.shots ?? [];
    const late = Math.min(0.12, this.time - this.shotsAt);

    // Tri par profondeur : unités, joueurs, filons et entrées de grotte ensemble.
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    for (const c of this.map.caves) {
      if (!inView(c.entrance.x, c.entrance.y, 160)) continue;
      list.push({ y: c.entrance.y + 20, draw: () => this.world.drawCaveEntrance(ctx, c, this.time, !this.hud.caves[c.id]) });
    }
    this.map.stones.forEach((st, k) => {
      // celle du village se construit ; celles des camps s'éveillent avec leur camp
      const active = k === 0 ? this.hud.buildings.includes('stone') : camps.includes(k - 1);
      const need = BUILDINGS.stone.hall;
      const label = k === 0 && !active ? `${BUILDINGS.stone.name} · ${this.hud.hall < need ? `Hôtel de ville niv. ${need}` : costText(buildingCost('stone'))}` : undefined;
      if (inView(st.x, st.y, 100)) list.push({ y: st.y, draw: () => this.world.drawStone(ctx, st.x, st.y, active, this.time, label) });
    });
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
      list.push({ y: d.y + s * 0.5, draw: () => this.world.tree(ctx, d.x, d.y, d.zone, next, false) });
    }
    const bare = new Set(this.net.latest?.bare ?? []);
    for (const b of this.map.bushes) {
      if (inView(b.x, b.y, 60)) list.push({ y: b.y, draw: () => drawBush(ctx, b.x, b.y, !bare.has(b.id), b.id, b.zone) });
    }
    for (const [id, x, y, opened] of this.net.latest?.chests ?? []) {
      if (!inView(x, y, 80)) continue;
      const seen = this.chestSeen.get(id) ?? this.chestSeen.set(id, this.time).get(id)!;
      const k = Math.min(1, (this.time - seen) / 0.7), drop = k < 1 ? Math.abs(Math.cos(k * Math.PI * 1.5)) * (1 - k) * 140 : 0; // chute et rebonds
      const at = this.chestOpen.get(id);
      const lid = opened ? (at === undefined ? 1 : Math.min(1, (this.time - at) / 0.45)) : 0;
      list.push({ y, draw: () => drawChest(ctx, x, y, lid, this.time, drop) });
    }
    for (const k of gates) list.push(...this.world.gateParts(ctx, k, this.gateOpen(k)).filter((p) => p.y > camY - hh - 80 && p.y < camY + hh + 80));
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
    const colorOf = new Map(players.map((p) => [p.id, p.color]));

    for (const u of units) {
      const [id, s, flags, x, y, hp, owner] = u;
      if (flags & UNIT_FLAG_MOUNTED) continue; // dessinée sous son cavalier
      const alpha = (flags & UNIT_FLAG_ALPHA) !== 0;
      const legend = (flags & UNIT_FLAG_LEGEND) !== 0;
      const r = alpha ? alphaStats(s, 0, 1, legend).r : SPECIES[s].r;
      const boss = SPECIES[s].boss && owner === 0;
      const f = this.faces.get(id) ?? { x, face: 1 };
      if (Math.abs(x - f.x) > 0.5) f.face = x > f.x ? 1 : -1;
      f.x = x;
      this.faces.set(id, f);
      list.push({
        y,
        draw: () => {
          const ranged = SPECIES[s].ranged, c0 = this.charges.get(id);
          const charge = ranged && c0 !== undefined && this.time - c0 < ranged.windup + 0.15 ? Math.min(1, (this.time - c0) / ranged.windup) : 0;
          drawUnit(ctx, {
            x, y, r, species: s, alpha, wild: owner === 0, ownerColor: owner ? colorOf.get(owner) : undefined,
            face: f.face, t: this.time, seed: id * 1.7, flash: (this.flashes.get(id) ?? 0) > this.time, legend,
            charge, inWater: !!SPECIES[s].swim && this.map.isWater(x, y),
          });
          if (boss && flags & UNIT_FLAG_DORMANT) {
            // Géant endormi : il ronfle en attendant qu'on vienne lui parler.
            ctx.font = '700 18px "Pixelify Sans", sans-serif';
            ctx.textAlign = 'center';
            for (let k = 0; k < 3; k++) {
              const ph = (this.time * 0.45 + k / 3) % 1;
              ctx.globalAlpha = Math.sin(ph * Math.PI);
              ctx.fillStyle = '#EEE7D7';
              ctx.fillText('z', x + r * 0.6 + ph * 34, y - r * 1.3 - ph * 46);
            }
            ctx.globalAlpha = 1;
          }
          if (boss) {
            // Mini-boss : nom et grande barre de vie, toujours visibles.
            ctx.font = '700 15px "Pixelify Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(16,24,26,0.85)';
            ctx.strokeText(SPECIES[s].name, x, y - r * 1.6 - 14);
            ctx.fillStyle = '#F0B64A';
            ctx.fillText(SPECIES[s].name, x, y - r * 1.6 - 14);
            hpBar(ctx, x, y - r * 1.6 - 8, 90, hp, '#E8693F');
          } else if (hp < 100) hpBar(ctx, x, y - r * (alpha ? 1.7 : 1.3) - 6, alpha ? 46 : 28, hp, owner ? '#7FCB5B' : '#E8693F');
        },
      });
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
            drawUnit(ctx, {
              x, y, r: mr, species: p.mount.species, alpha: true, wild: false, ownerColor: p.color, legend: p.mount.legend,
              face: fx < -0.1 ? -1 : 1, t: this.time * (isMe && this.me.moving ? 1.8 : 1), seed: p.mount.id,
              flash: (this.flashes.get(p.mount.id) ?? 0) > this.time,
            });
            lift = mr * 0.8;
            back = mr * 0.25 * (fx < -0.1 ? 1 : -1); // assis sur le dos, pas sur la tête
          }
          // Récolte en cours (un coup il y a moins d'une seconde) : l'arme laisse place à l'outil.
          const used = this.tools.get(p.id);
          const k = used ? (this.time - used.at) / 0.55 : 2;
          const tool: Tool | null = p.holding ? { kind: 'fruit', ang: Math.atan2(fy, fx), k: 0 }
            : used && this.time - used.at < 0.9 && !p.mount ? { kind: used.kind, ang: Math.atan2(used.ty - y, used.tx - x), k: Math.min(1, k) } : null;
          drawPlayer(
            ctx, x + back, y - lift, p.color, fx, fy, p.armor, p.name, this.time,
            isMe ? this.me.moving : false, (this.flashes.get(p.id) ?? 0) > this.time, isMe, !!p.mount, p.cls, tool, p.weapon,
          );
          if (p.slowed) drawWebbed(ctx, x, y - lift, this.time);
          if (!isMe && p.hp < p.maxHp) hpBar(ctx, x, y + 26, 34, (100 * p.hp) / p.maxHp, '#7FCB5B');
        },
      });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    for (const k of gates) {
      const open = this.gateOpen(k);
      this.world.drawGateLabel(ctx, k, open, k === 0 ? 'Porte du village' : `Porte · ${ZONE_NAMES[k]}`, open ? '' : this.gateWhy(k));
    }
    for (const [, kind, x, y, a, b, c] of shots) {
      if (kind === 1) drawShot(ctx, kind, x, y, a, b, Math.min(100, c + (late * 100) / ARC_FLIGHT_S), this.time);
      else drawShot(ctx, kind, x + a * late, y + b * late, a, b, 0, this.time);
    }
    this.fog.draw(ctx, -WORLD_HALF, -WORLD_HALF, WORLD_HALF * 2, WORLD_HALF * 2, 0.88);
    this.fx.draw(ctx);

    // Joystick tactile / souris.
    if (stick.active) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(2, devicePixelRatio || 1);
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
