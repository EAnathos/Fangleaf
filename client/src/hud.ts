// HUD en HTML : panneaux joueur / groupe, minicarte, forge, tanière, toasts.

import {
  ALPHA_EQUIP_MAX, ALPHA_LVL_MAX, BOSS_TALK_R, LURE_R, MAX_PLAYERS, CLASS_CHANGE_COST, CLASS_IDS, CLASSES, classOf, type ClassId, MOUNTS, ALPHA_CREATE_COST, alphaStats, bossOf, collectionMult, LEGEND_MULT, LEGEND_SOULS, ARMOR_MAX, ARMOR_NAMES, ARMY_CAP, BUILDING_REACH,
  BUILDINGS, BUSH_PICK_R, type BuildingId, buildingCost, type Cost, costText, gateHall, gateOpen, HALL, HALL_MAX, zoneBosses, caveUnlockCost, monsterBuyPrice, monsterSellPrice, TAMED_HP_MULT, TAMED_MULT, CAMP_COST, campName, REVIVE_R, SPECIES, SPECIES_BY_ZONE, ZONE_NAMES, WEAPON_MAX, WEAPON_NAMES, WORLD_HALF, alphaAwakenS, alphaLevelMult, alphaReviveS, alphaUpCost, armorCost, armorMaxHp,
  armorReduction, weaponCost, weaponDmg,
} from '../../shared/config.ts';
import type { BoardRow, PlayerState, UnitTuple } from '../../shared/protocol.ts';
import type { WorldMap } from '../../shared/worldmap.ts';
import { armorColor, drawUnit } from './sprites.ts';
import { BOSS_LINES, SPECIES_DESC } from './speciesInfo.ts';
import { sound } from './audio.ts';
import { ACTIONS, type Action, keyLabel, labelOf, resetKeys, saveSettings, settings, touchOnly } from './settings.ts';
import { FOREST_GROUND, ZONE_GROUND } from './world.ts';
import type { Fog } from './fog.ts';

export type Panel = 'forge' | 'den' | 'market' | 'map' | 'quit' | 'travel' | 'camp' | 'buy' | 'talk' | 'hall' | 'settings' | 'chat' | 'board' | null;
/** Achat pour tout le village : un bâtiment, ou l'accès à une grotte. */
export type Purchase = { b: BuildingId } | { cave: number };
/** Bâtiment à portée d'interaction, s'il y en a un. */
export interface Spot {
  pos: { x: number; y: number };
  label: string;
  panel?: 'forge' | 'den' | 'market' | 'travel' | 'camp' | 'buy' | 'talk' | 'hall' | 'board'; // ouvre un panneau
  cave?: { id: number; enter: boolean }; // entre dans une grotte / en sort
  at?: number; // Pierre de passage : -1 village, sinon index du camp ; emplacement de camp : son index
  buy?: Purchase; // panneau d'achat : ce qui est à acheter
  reach?: number; // portée d'interaction (par défaut BUILDING_REACH)
  deposit?: boolean; // entrepôt : déposer son sac
  pick?: boolean; // buisson garni : cueillir ses baies
  chest?: number; // coffre d'un géant vaincu à ouvrir
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
  bare: number[]; // buissons dont les baies ont été mangées ou cueillies
}
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
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
  const building = (b: BuildingId, pos: { x: number; y: number }, open: Spot): Spot =>
    v.buildings.includes(b) ? open : { panel: 'buy', pos, buy: { b }, label: `E — Construire : ${BUILDINGS[b].name} · ${costText(buildingCost(b))}` };
  const spots: Spot[] = [
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
        : { panel: 'camp', pos: site, label: `E — Établir le camp · ${CAMP_COST} or`, at: i },
    ),
    ...map.caves.flatMap((c): Spot[] => [
      v.unlocked.includes(c.id)
        ? {
          cave: { id: c.id, enter: true }, pos: c.entrance,
          label: v.caves[c.id] ? `E — Entrer (${SPECIES[c.boss].name} revient dans ${clock(v.caves[c.id])})` : `E — Entrer · ${SPECIES[c.boss].name} t'attend`,
        }
        : { panel: 'buy', pos: c.entrance, buy: { cave: c.id }, label: `E — Débloquer la grotte · ${caveUnlockCost(c.zone)} or` },
      { cave: { id: c.id, enter: false }, pos: c.exit, label: 'E — Sortir de la grotte' },
    ]),
    ...v.chests.filter((c) => !c[3]).map((c): Spot => ({ chest: c[0], pos: { x: c[1], y: c[2] }, label: 'E — Ouvrir le coffre' })),
    ...map.bushes.filter((b) => !v.bare.includes(b.id) && Math.hypot(x - b.x, y - b.y) < BUSH_PICK_R)
      .map((b): Spot => ({ pick: true, pos: b, reach: BUSH_PICK_R, label: 'E — Cueillir des baies' })),
    ...v.sleepers.map((z): Spot => ({ panel: 'talk', pos: z, at: z.cave, reach: z.r + BOSS_TALK_R, label: `E — Parler à ${SPECIES[map.caves[z.cave].boss].name}` })),
  ];
  return spots.find((b) => Math.hypot(x - b.pos.x, y - b.pos.y) < (b.reach ?? BUILDING_REACH));
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const pct = (n: number) => `${Math.round(n * 100)} %`;
/** 30 → « 30 s », 90 → « 1 min 30 », 120 → « 2 min ». */
const duration = (sec: number) => (sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min${sec % 60 ? ` ${String(sec % 60).padStart(2, '0')}` : ''}`);

export class Hud {
  private mini = $<HTMLCanvasElement>('minimap').getContext('2d')!;
  private miniBg: HTMLCanvasElement;
  private last = { party: '', den: '', cls: '', travel: '', bestiary: '', market: '', hall: '', members: '' };
  private denTab: 'alphas' | 'bestiary' = 'alphas';
  private beasts: Portrait[] = [];
  private portraits: Portrait[] = []; // Alphas de la Tanière
  private wares: Portrait[] = []; // monstres du Marché
  panel: Panel = null;
  onUpgrade = (_what: 'weapon' | 'armor') => {};
  onAlphaUp = (_species: number) => {};
  onAlphaEquip = (_species: number, _equip: boolean) => {};
  onAlphaCreate = (_species: number) => {};
  onHelp = (_on: boolean) => {};
  private helpHeld = false; // bouton « relever » maintenu au doigt
  onMount = (_id: number) => {};
  onCave = (_id: number, _enter: boolean) => {};
  onLegend = (_id: number) => {};
  onQuit = () => {};
  onReset = () => {};
  onClass = (_cls: ClassId) => {};
  onTravel = (_to: number) => {};
  onEstablish = (_site: number) => {};
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
  stock: [number, number] = [0, 0]; // réserve du village : bois, pierre
  bare: number[] = []; // buissons sans baies
  onPick = () => {};
  onHold = () => {};
  onDeposit = () => {};
  beaten: number[] = []; // géants vaincus par le village
  onHall = () => {};
  onAttackMode = () => {};
  onKick = (_id: number) => {};
  onUnban = (_user: string) => {};
  capturing: Action | null = null; // réglages : action dont on attend la nouvelle touche
  banned: { id: string; name: string }[] = []; // bannis du village (vu par le fondateur)
  onChest = (_id: number) => {};
  onChallenge = (_cave: number) => {};
  private talker: Portrait[] = []; // portrait du géant à qui l'on parle
  private buying: Purchase | null = null; // achat proposé par le panneau d'achat
  private spotAt = 0; // Pierre ou emplacement devant lequel on se tient (panneaux voyage et camp)
  private bigBg?: HTMLCanvasElement;
  private mountId = 0;

  /** founder : fondateur du village (peut le supprimer) ; sinon on n'efface que sa propre progression. */
  constructor(code: string, private map: WorldMap, private fog: Fog, founder: boolean) {
    this.miniBg = this.renderMapBackground(180);
    $('hud').hidden = false;
    $('code-label').textContent = code;
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
      $('quit-main').hidden = on;
      $('reset-confirm').hidden = !on;
      $<HTMLButtonElement>(on ? 'reset-cancel' : 'quit-confirm').focus();
    };
    $('reset-ask').onclick = () => confirmStep(true);
    $('reset-cancel').onclick = () => confirmStep(false);
    $('reset-go').onclick = () => {
      $<HTMLButtonElement>('reset-go').disabled = true;
      this.onReset();
    };
    $('talk-fight').onclick = () => this.onChallenge(this.spotAt);
    $('hall-up').onclick = () => this.onHall();
    this.initSettings(founder);
    $('hold-btn').onclick = () => this.onHold();
    $('talk-later').onclick = () => this.setPanel(null);
    for (const id of ['forge', 'den', 'market', 'bigmap', 'quit', 'travel', 'camp', 'buy', 'talk', 'hall', 'settings', 'board'] as const) {
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
    $('weapon-buy').onclick = () => this.onUpgrade('weapon');
    $('armor-buy').onclick = () => this.onUpgrade('armor');
    $('alphas').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.buy');
      if (btn?.dataset.up) this.onAlphaUp(Number(btn.dataset.up));
      else if (btn?.dataset.create) this.onAlphaCreate(Number(btn.dataset.create));
      const eq = (e.target as HTMLElement).closest<HTMLButtonElement>('button.equip');
      if (eq?.dataset.s) this.onAlphaEquip(Number(eq.dataset.s), eq.dataset.equip === '1');
      const ride = (e.target as HTMLElement).closest<HTMLButtonElement>('button.ride');
      if (ride?.dataset.id) this.onMount(Number(ride.dataset.id));
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
    $('quit-main').hidden = false; // le menu rouvre toujours sur ses choix, jamais sur la confirmation
    $('reset-confirm').hidden = true;
    $('travel').hidden = panel !== 'travel';
    $('camp').hidden = panel !== 'camp';
    $('talk').hidden = panel !== 'talk';
    $('hall').hidden = panel !== 'hall';
    $('settings').hidden = panel !== 'settings';
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
    if (panel && panel !== 'chat') $(panel === 'map' ? 'bigmap' : panel).querySelector<HTMLButtonElement>('.close')!.focus();
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
    $('self-name').textContent = me.name;
    $('self-name').style.color = me.color;
    const hpRatio = me.hp / me.maxHp;
    const fill = $('self-hp');
    fill.style.width = `${Math.max(0, hpRatio) * 100}%`;
    fill.classList.toggle('low', hpRatio < 0.3);
    $('self-hptext').textContent = `PV ${me.hp}/${me.maxHp}`;
    $('self-gold').textContent = `Or ${me.gold}`;
    $('self-wood').textContent = `Bois ${me.wood}`;
    $('self-stone').textContent = `Pierre ${me.stone}`;
    $('self-fruits').textContent = `Baies ${me.fruits}`;
    // au doigt seulement (sur PC : touche T) : tendre ou ranger un fruit
    const hold = $('hold-btn');
    hold.classList.toggle('on', me.holding);
    hold.textContent = me.holding ? 'Ranger le fruit' : 'Tendre un fruit';
    $('self-army').textContent = `Meute ${me.army.filter((a) => !a.alpha).length}/${ARMY_CAP}`;
    $('ping').textContent = ping ? `${ping} ms` : '';
    $('invite').hidden = players.length >= MAX_PLAYERS; // village complet : plus personne à inviter
    // au doigt, « Tendre un fruit » seulement près d'un gibier passif (ou si on en tend déjà un)
    const prey = units.some((u) => !u[6] && SPECIES[u[1]].passive && Math.hypot(u[3] - myPos.x, u[4] - myPos.y) < LURE_R);
    $('hold-btn').hidden = me.holding ? false : !me.fruits || !prey;

    // Groupe.
    const others = players.filter((p) => p.id !== me.id);
    const partyKey = JSON.stringify(others.map((p) => [p.name, p.hp, p.maxHp, p.pack, p.dead, this.map.inVillage(p.x, p.y)]));
    if (partyKey !== this.last.party) {
      this.last.party = partyKey;
      const party = $('party');
      party.hidden = others.length === 0;
      party.replaceChildren(
        ...others.map((p) => {
          const wrap = document.createElement('div');
          wrap.className = 'col';
          const status = p.dead ? 'À terre' : this.map.inVillage(p.x, p.y) ? 'Au village' : `Meute ${p.pack}`;
          wrap.innerHTML = `<div class="row"><b></b><span class="muted"></span></div><div class="bar thin"><div class="fill"></div></div>`;
          const b = wrap.querySelector('b')!;
          b.textContent = p.name;
          b.style.color = p.color;
          wrap.querySelector('.muted')!.textContent = status;
          (wrap.querySelector('.fill') as HTMLElement).style.width = `${(p.hp / p.maxHp) * 100}%`;
          return wrap;
        }),
      );
    }

    // Bâtiments.
    const b = me.dead ? undefined : buildingNear(this.map, myPos.x, myPos.y, this);
    const prompt = $('build-prompt');
    prompt.hidden = !b || !!this.panel;
    if (b) {
      // au doigt, pas de touche à rappeler ; sur PC, la touche réglée pour « interagir »
      prompt.textContent = b.label.replace(/^E — /, touchOnly ? '' : `${keyLabel('interact')} — `);
      prompt.className = `btn prompt ${b.panel ?? (b.deposit ? 'hall' : b.pick ? 'pick' : b.chest !== undefined ? 'chest' : b.cave && this.caves[b.cave.id] === 0 && b.cave.enter ? 'danger' : 'den')}`;
      prompt.onclick = () => (b.panel ? this.setPanel(b.panel) : b.deposit ? this.onDeposit() : b.pick ? this.onPick() : b.chest !== undefined ? this.onChest(b.chest) : b.cave && this.onCave(b.cave.id, b.cave.enter));
    }
    const building = this.panel !== null && !['map', 'quit', 'settings', 'chat', 'board'].includes(this.panel);
    if (building && b?.panel !== this.panel) this.setPanel(null);
    if (b?.buy) this.buying = b.buy;
    if (b?.at !== undefined && b.at !== this.spotAt) {
      this.spotAt = b.at;
      this.last.travel = '';
    }
    if (this.panel === 'travel') this.updateTravel();
    if (this.panel === 'camp') this.updateCamp(me);
    if (this.panel === 'buy') this.updateBuy(me);
    if (this.panel === 'talk') this.updateTalk();
    if (this.panel === 'hall') this.updateHall(me);
    if (this.panel === 'settings') this.updateMembers(me, players);
    if (this.panel === 'market') this.updateMarket(me);
    if (this.panel === 'forge') this.updateForge(me);
    if (this.panel === 'den' && this.denTab === 'alphas') this.updateDen(me);
    if (this.panel === 'den' && this.denTab === 'bestiary') this.updateBestiary(me);

    // Mort.
    $('death').hidden = !me.dead;
    $('death-timer').textContent = String(me.respawnIn);
    const help = $('death-help');
    help.hidden = !me.dead || others.length === 0;
    if (me.dead) {
      const c = this.map.respawnSite(me.x, me.y, this.camps);
      $('death-where').textContent = c < 0 ? 'Retour au village' : `Retour au ${campName(c)}`;
      const by = others.find((p) => p.id === me.reviveBy);
      help.textContent = by ? `${by.name} te relève… ${me.revive} %` : 'Un coéquipier peut te relever : R maintenu 5 s près de toi.';
    }

    // Relever un coéquipier à terre (R maintenu, ou bouton maintenu au doigt).
    const downed = me.dead ? undefined : others.find((p) => p.dead && p.respawnIn > 0 && Math.hypot(p.x - myPos.x, p.y - myPos.y) < REVIVE_R);
    const revive = $('revive-prompt');
    revive.hidden = !downed;
    if (downed) revive.textContent = downed.reviveBy === me.id ? `Tu relèves ${downed.name}… ${downed.revive} %` : `Maintiens R : relever ${downed.name}`;
    else if (this.helpHeld) this.releaseHelp();

    // Monture.
    this.mountId = me.mount?.id ?? 0;
    $('mount-row').hidden = !me.mount;
    if (me.mount) {
      $('mount-name').textContent = `Sur l'Alpha ${SPECIES[me.mount.species].name}`;
      $('mount-hp').style.width = `${me.mount.hp}%`;
    }

    this.drawMinimap(me, players, units, myPos);
    if (this.panel === 'map') this.drawBigMap(me, players, myPos);
  }

  private releaseHelp() {
    if (!this.helpHeld) return;
    this.helpHeld = false;
    this.onHelp(false);
  }

  /** Pierre de passage : le village et chaque emplacement de camp, joignables s'ils sont établis. */
  private updateTravel() {
    const key = `${this.spotAt}|${this.camps.join(',')}|${this.buildings.join(',')}`;
    if (key === this.last.travel) return;
    this.last.travel = key;
    const village = this.buildings.includes('stone');
    const rows = [{ to: -1, name: 'Village', sub: village ? 'Feu de camp · Forge · Tanière · Marché' : `Pierre du village pas encore construite (${BUILDINGS.stone.cost} or)`, open: village }].concat(
      this.map.sites.map((_, i) => ({
        to: i, name: campName(i), open: this.camps.includes(i),
        sub: this.camps.includes(i) ? 'Feu de camp · réapparition' : `Au bout de la zone ${4 * (i + 1)} · pas encore établi`,
      })),
    );
    $('stones').replaceChildren(
      ...rows.map((r) => {
        const here = r.to === this.spotAt;
        const row = document.createElement('div');
        row.className = `stone-row${r.open ? '' : ' locked'}`;
        row.innerHTML = `<div class="col"><b></b><span class="small muted"></span></div><button class="cta"></button>`;
        row.querySelector('b')!.textContent = r.name;
        row.querySelector('span')!.textContent = r.sub;
        const btn = row.querySelector('button')!;
        btn.dataset.to = String(r.to);
        btn.disabled = here || !r.open;
        btn.textContent = here ? 'Tu es ici' : r.open ? 'Voyager' : 'Fermé';
        return row;
      }),
    );
  }

  private updateCamp(me: PlayerState) {
    $('camp-gold').textContent = String(me.gold);
    $('camp-title').textContent = `Emplacement · ${campName(this.spotAt)}`;
    const btn = $<HTMLButtonElement>('camp-buy');
    btn.disabled = me.gold < CAMP_COST;
    btn.textContent = me.gold < CAMP_COST ? `Il te faut ${CAMP_COST} or` : `Établir le camp · ${CAMP_COST} or`;
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
    const funds = this.funds(me);
    this.costChips('buy-cost', funds, cost);
    $('buy-title').textContent = 'b' in buy ? `Construire : ${name}` : `Débloquer : ${name}`;
    if ('b' in buy) $('buy-desc').textContent = BUILDINGS[buy.b].desc;
    else {
      const boss = SPECIES[this.map.caves[buy.cave].boss], base = SPECIES.find((s) => s.key === boss.base);
      $('buy-desc').textContent = `Ouvre la grotte pour tout le village : ${boss.name} y attend, et son âme rend légendaire ton Alpha ${base?.name ?? ''}.`;
    }
    const btn = $<HTMLButtonElement>('buy-go');
    btn.disabled = this.hall < hall || !canPay(funds, cost);
    btn.textContent = this.hall < hall ? `Hôtel de ville niv. ${hall} requis` : !canPay(funds, cost) ? 'Il manque des ressources' : `${'b' in buy ? 'Construire' : 'Débloquer'} pour le village`;
  }

  /** Paramètres : mode d'attaque et touches (PC), membres du village (expulsion par le fondateur). */
  private initSettings(founder: boolean) {
    this.founder = founder;
    $('settings-open').onclick = () => this.setPanel('settings');
    $('board-open').onclick = () => this.setPanel('board');
    $('menu-open').onclick = () => this.setPanel(this.panel === 'quit' ? null : 'quit');
    $('chat-open').onclick = () => this.setPanel(this.panel === 'chat' ? null : 'chat');
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
    $('set-pc').hidden = touchOnly;
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
  private keymap = () => {};

  /** Membres en ligne (le fondateur peut les expulser) et comptes bannis (il peut les réintégrer). */
  private updateMembers(me: PlayerState, players: PlayerState[]) {
    const key = JSON.stringify([players.map((p) => [p.id, p.name]), this.banned]);
    if (key === this.last.members) return;
    this.last.members = key;
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

  /** Tableau du village reçu du serveur : un rang par membre, couronne pour le premier de chaque colonne. */
  board(rows: BoardRow[]) {
    const best = (k: 'bosses' | 'tamed' | 'given') => Math.max(1, ...rows.map((r) => r[k]));
    const top = { bosses: best('bosses'), tamed: best('tamed'), given: best('given') };
    rows.sort((a, b) => b.bosses - a.bosses || b.tamed - a.tamed || b.given - a.given);
    $('board-rows').replaceChildren(
      ...rows.map((r) => {
        const tr = document.createElement('tr');
        const who = document.createElement('td');
        const b = document.createElement('b');
        b.textContent = r.name;
        b.style.color = r.color;
        who.append(b);
        tr.append(who);
        for (const k of ['bosses', 'tamed', 'given'] as const) {
          const td = document.createElement('td');
          const lead = r[k] === top[k];
          td.className = lead ? 'top' : '';
          td.textContent = `${lead ? '👑 ' : ''}${r[k]}`;
          tr.append(td);
        }
        return tr;
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
    return z <= 1 || gateOpen(z - 1, this.hall, this.beaten);
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
    $('hall-have').textContent = `Niveau ${this.hall}/${HALL_MAX}`;
    const maxed = this.hall >= HALL_MAX, cost = HALL[this.hall];
    $('hall-cost').hidden = maxed;
    if (!maxed) this.costChips('hall-cost', funds, cost);
    const btn = $<HTMLButtonElement>('hall-up');
    btn.disabled = maxed || !canPay(funds, cost);
    btn.textContent = maxed ? 'Niveau maximum' : !canPay(funds, cost) ? 'Il manque des ressources' : `Passer au niveau ${this.hall + 1}`;
  }

  /** Marché : vendre les monstres ordinaires de sa meute, acheter ceux des espèces déjà croisées. */
  private updateMarket(me: PlayerState) {
    $('market-gold').textContent = String(me.gold);
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
    const full = pack.length >= ARMY_CAP;
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
          el.querySelector('.tag')!.textContent = on ? 'Classe actuelle' : cost ? `Choisir · ${cost} or` : 'Choisir · gratuit';
          el.onclick = () => this.onClass(id);
          return el;
        }),
      );
    }
    const weaponNames = classOf(me.cls).weapons;
    const next = (a: string, b: string, maxed: boolean) => (maxed ? a : `${a} → <span class="up">${b}</span>`);
    const buy = (id: string, maxed: boolean, cost: number) => {
      const btn = $<HTMLButtonElement>(id);
      btn.disabled = maxed || me.gold < cost;
      btn.textContent = maxed ? 'Niveau maximum' : me.gold < cost ? `Il manque ${cost - me.gold} or` : `Améliorer · ${cost} or`;
    };

    const w = me.weapon, wMax = w >= WEAPON_MAX;
    const k = classOf(me.cls).dmg;
    $('weapon-name').textContent = `${weaponNames[w]} · niv. ${w}`;
    $('weapon-dmg').innerHTML = next(String(Math.round(weaponDmg(w) * k)), String(Math.round(weaponDmg(w + 1) * k)), wMax);
    $('weapon-next').textContent = wMax ? '—' : weaponNames[w + 1];
    // Icône d'arme selon la classe (épée, arc ou bâton), teintée selon le niveau.
    const icon = $('weapon-icon');
    for (const g of icon.querySelectorAll<SVGGElement>('g[data-cls]')) g.toggleAttribute('hidden', g.dataset.cls !== (me.cls ?? 'warrior'));
    const tier = armorColor(w);
    icon.querySelectorAll('.tier').forEach((el) => el.setAttribute('fill', me.cls === 'mage' && w < 3 ? '#D9C6FF' : tier));
    icon.querySelectorAll('.tier-stroke').forEach((el) => el.setAttribute('stroke', tier));
    buy('weapon-buy', wMax, weaponCost(w));

    const a = me.armor, aMax = a >= ARMOR_MAX;
    $('armor-name').textContent = `${ARMOR_NAMES[a]} · niv. ${a}`;
    const hpK = classOf(me.cls).hp; // PV selon la classe (guerrier +25 %, archer −10 %, mage −15 %)
    $('armor-hp').innerHTML = next(String(Math.round(armorMaxHp(a) * hpK)), String(Math.round(armorMaxHp(a + 1) * hpK)), aMax);
    $('armor-red').innerHTML = next(pct(armorReduction(a)), pct(armorReduction(a + 1)), aMax);
    // Icône d'armure : tunique (robe à capuche pour le mage), cuir (clouté au niveau 2), puis métal.
    const look = a === 0 ? (me.cls === 'mage' ? 'robe' : 'tunic') : a <= 2 ? 'leather' : 'metal';
    for (const g of $('armor-icon').querySelectorAll<SVGGElement>('g[data-look]')) g.toggleAttribute('hidden', g.dataset.look !== look);
    $('armor-icon').querySelector('.studs')!.toggleAttribute('hidden', a !== 2);
    $('armor-shape').setAttribute('fill', armorColor(a));
    buy('armor-buy', aMax, armorCost(a));
  }

  /** Bestiaire de la Tanière : les espèces déjà croisées, les autres en silhouette (les géants n'y figurent pas). */
  private updateBestiary(me: PlayerState) {
    const all = SPECIES_BY_ZONE.filter((s) => !SPECIES[s].boss);
    const seen = new Set(me.seen);
    const key = all.filter((s) => seen.has(s)).join(',');
    if (key !== this.last.bestiary) {
      this.last.bestiary = key;
      const n = all.filter((s) => seen.has(s)).length;
      $('bestiary-count').innerHTML = `<b>${n}/${all.length}</b> espèces croisées · les autres t'attendent plus loin sur le chemin.`;
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
            const sp = SPECIES[s], known = seen.has(s);
            const el = document.createElement('div');
            el.className = `beast${known ? '' : ' unknown'}`;
            el.innerHTML = '<canvas></canvas><b></b><span class="tag"></span><span class="stats"></span><span class="desc"></span>';
            el.querySelector('b')!.textContent = known ? sp.name : '???';
            const traits = [sp.passive ? 'Passif' : sp.ranged ? 'Tireur' : 'Mêlée', sp.swim ? 'aquatique' : '', MOUNTS[sp.key] ? 'monture en Alpha' : ''].filter(Boolean).join(' · ');
            el.querySelector('.tag')!.textContent = known ? traits : '';
            el.querySelector('.stats')!.textContent = known ? `${sp.hp} PV · ${sp.dmg} dégâts` : '';
            el.querySelector('.desc')!.textContent = known ? SPECIES_DESC[sp.key] ?? '' : 'Pas encore croisé.';
            const canvas = el.querySelector('canvas')!;
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', known ? sp.name : 'Espèce inconnue');
            this.beasts.push({ canvas, s, seen: known });
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

    // Bonus de collection : chaque Alpha éveillé renforce les autres de 10 %.
    const equipped = me.army.filter((x) => x.alpha).length;
    const count = equipped + me.resting.length; // le bonus compte tous les Alphas possédés, équipés ou non
    $('collection').innerHTML = (count
      ? `Bonus de collection : <b>+${Math.round((collectionMult(count) - 1) * 100)} %</b> PV et dégâts`
      : 'Bonus de collection : chaque Alpha éveillé donnera +10 % de PV et de dégâts à tous tes Alphas.')
      + `<br>Équipés : <b>${equipped}/${ALPHA_EQUIP_MAX}</b> · les autres se reposent ici et comptent quand même pour le bonus.`;

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
        const cost = a ? alphaUpCost(lvl) : ALPHA_CREATE_COST;
        const unit = 'essences';
        const have = me.essences[s];
        const el = document.createElement('div');
        el.className = `alpha-card${a ? '' : ' asleep'}`;
        el.innerHTML = `<canvas class="portrait"></canvas><div class="col"><span class="title"></span><div class="stat-rows"></div>
          <div class="ess"><div class="ess-bar"><i></i></div><span></span></div></div><div class="actions"><button class="buy"></button></div>`;
        const canvas = el.querySelector('canvas')!;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Alpha ${sp.name}`);
        this.portraits.push({ canvas, s, seen: true, alpha: true, legend: !!a?.legend });
        el.querySelector('.title')!.textContent = a
          ? `${a.legend ? `${sp.name} légendaire` : `Alpha ${sp.name}`} · niv. ${lvl}${a.reviveIn ? ' (ressuscite…)' : ''}${rest ? ' · au repos' : ''}`
          : `Alpha ${sp.name} · endormi`;
        const now = stat(lvl), nxt = stat(lvl + 1);
        // Une ligne par statistique, avec la valeur au niveau suivant quand on peut renforcer.
        const grow = (a1: number, b1: number) => (a && !maxed ? `${a1} → <span class="up">${b1}</span>` : String(a1));
        const rows: [keyof typeof ICONS, string, string][] = [
          ['hp', 'PV', grow(now.hp, nxt.hp)],
          ['dmg', 'Dégâts', grow(now.dmg, nxt.dmg)],
          ['revive', 'Résurrection', `${alphaReviveS(s)} s`],
        ];
        if (MOUNTS[sp.key]) rows.push(['mount', 'Monture', `vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}`]);
        el.querySelector('.stat-rows')!.innerHTML = rows
          .map(([icon, label, value]) => `<div class="stat-row ${icon}">${ICONS[icon]}<span>${label}</span><b>${value}</b></div>`)
          .join('');
        (el.querySelector('.ess-bar i') as HTMLElement).style.width = `${maxed ? 100 : Math.min(100, (100 * have) / cost)}%`;
        el.querySelector('.ess span')!.textContent = maxed ? `${have} essences` : `${have}/${cost} ${unit} de ${sp.name}`;
        if (a?.legend) el.classList.add('legend');
        const waking = me.awakening.find((w) => w.species === s);
        if (waking) {
          // Éveil en cours : compte à rebours à la place de la jauge d'essences.
          el.className = 'alpha-card waking';
          el.querySelector('.title')!.textContent = `Alpha ${sp.name} · éveil en cours`;
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
        // Évolution légendaire : une âme du boss géant de l'espèce.
        const boss = bossOf(s);
        if (a && !a.legend && boss >= 0) {
          const souls = me.essences[boss] ?? 0;
          const leg = document.createElement('button');
          leg.className = 'legend-btn';
          leg.dataset.legend = String(s);
          leg.disabled = souls < LEGEND_SOULS;
          leg.textContent = souls >= LEGEND_SOULS ? `Rendre légendaire · ${LEGEND_SOULS} âme${LEGEND_SOULS > 1 ? 's' : ''}` : `Légendaire : âme de ${SPECIES[boss].name} (${souls}/${LEGEND_SOULS})`;
          leg.title = `PV et dégâts ×${String(LEGEND_MULT.hp).replace('.', ',')}, aura dorée. Bats ${SPECIES[boss].name} dans sa grotte pour obtenir son âme.`;
          el.querySelector('.actions')!.append(leg);
        }
        // Équiper (5 au maximum sur le terrain) ou ranger à la Tanière.
        if (a) {
          const eq = document.createElement('button');
          eq.className = 'equip';
          eq.dataset.s = String(s);
          eq.dataset.equip = rest ? '1' : '0';
          eq.disabled = !!rest && equipped >= ALPHA_EQUIP_MAX;
          eq.textContent = rest ? (equipped >= ALPHA_EQUIP_MAX ? `Équipés : ${ALPHA_EQUIP_MAX}/${ALPHA_EQUIP_MAX}` : 'Équiper') : 'Ranger';
          el.querySelector('.actions')!.append(eq);
        }
        // Monture : seuls certains Alphas équipés se chevauchent.
        if (field && MOUNTS[sp.key]) {
          const ride = document.createElement('button');
          const on = this.mountId === field.id;
          ride.className = `ride${on ? ' on' : ''}`;
          ride.dataset.id = String(field.id);
          ride.disabled = !!field.reviveIn;
          ride.textContent = on ? 'Descendre' : `Monter · vitesse ×${String(MOUNTS[sp.key]).replace('.', ',')}`;
          el.querySelector('.actions')!.append(ride);
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
        const col = this.map.isForest(x, y) ? FOREST_GROUND : this.map.isWater(x, y) ? [46, 101, 116] : ZONE_GROUND[this.map.inVillage(x, y) ? 0 : this.map.zoneAt(x, y)];
        const o = (j * S + i) * 4;
        img.data[o] = col[0] * 0.8;
        img.data[o + 1] = col[1] * 0.8;
        img.data[o + 2] = col[2] * 0.8;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

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
    this.drawGates(ctx, m, 3 * dpr);
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
    $('explored').textContent = `${Math.round(this.fog.progress * 100)} % de la carte explorée`;
  }

  /** Grottes déjà repérées (hors brouillard) : arche sombre, point rouge si le mini-boss est là. */
  private drawCaves(ctx: CanvasRenderingContext2D, m: (v: number) => number, size: number) {
    for (const c of this.map.caves) {
      if (!this.fog.isExplored(c.entrance.x, c.entrance.y)) continue;
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
      if (!this.caves[c.id]) {
        ctx.fillStyle = '#E8693F';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Portes des zones repérées : trait en travers du couloir, rouge si fermée, vert si ouverte. */
  private drawGates(ctx: CanvasRenderingContext2D, m: (v: number) => number, w: number) {
    this.map.gates.forEach((s, k) => {
      const c = this.map.spineAt(s), n = this.map.normalAt(s), half = this.map.halfWidth(s);
      if (!this.fog.isExplored(c.x, c.y)) return;
      ctx.strokeStyle = gateOpen(k, this.hall, this.beaten) ? '#7FCB5B' : '#E8693F';
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(m(c.x - n.x * half), m(c.y - n.y * half));
      ctx.lineTo(m(c.x + n.x * half), m(c.y + n.y * half));
      ctx.stroke();
    });
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

    // Camp de départ et village (étoile dorée).
    const { spawn, village } = this.map;
    ctx.strokeStyle = '#EEE7D7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m(spawn.x), m(spawn.y), 3, 0, Math.PI * 2);
    ctx.stroke();
    this.drawCaves(ctx, m, 4);
    this.drawGates(ctx, m, 2);
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

type Portrait = { canvas: HTMLCanvasElement; s: number; seen: boolean; alpha?: boolean; legend?: boolean; tame?: boolean };

/** Petites icônes des statistiques (couleur via currentColor). */
const ICONS = {
  hp: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 14.2S1.8 10.4 1.8 6a3.2 3.2 0 0 1 6.2-1.2A3.2 3.2 0 0 1 14.2 6c0 4.4-6.2 8.2-6.2 8.2z"/></svg>',
  dmg: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 2 6.5 9.5M4 7.5l4.5 4.5M5.5 10.5 2 14"/></svg>',
  revive: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M13.5 8.5A5.5 5.5 0 1 1 11.8 4M13 1.8V5H9.8"/></svg>',
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
