// Réglages du joueur (gardés dans ce navigateur) : affichage, et sur PC touches et façon d'attaquer.
// Au doigt, rien ne change pour les touches : on glisse pour se déplacer et l'attaque reste automatique.

export type Action = 'up' | 'down' | 'left' | 'right' | 'interact' | 'fruit' | 'mount' | 'map' | 'revive' | 'chat';
/**
 * Une touche : par code physique (déplacements : ZQSD en AZERTY = WASD en QWERTY) ou par lettre tapée
 * (raccourcis : sinon M ne marche pas en AZERTY). Une touche choisie par le joueur est toujours gardée par code.
 */
export interface Binding {
  code?: string;
  key?: string;
  label: string;
}
export type Quality = 'low' | 'medium' | 'high';
export type DamageNumbers = 'all' | 'mine' | 'off';
export type Size = 'small' | 'normal' | 'large' | 'xl';
export type FxPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom';
/** HUD des effets d'état (altérations et bonus). */
export interface StatusHud {
  enabled: boolean;
  position: FxPosition;
  size: 'small' | 'normal' | 'large';
  timers: boolean; // secondes restantes sur chaque vignette
  filter: 'all' | 'buffs' | 'nerfs';
  animations: boolean;
  opacity: number; // opacité du bord teinté et des icônes qui flottent (10 à 100 %)
  edge: number; // largeur du bord teinté, du bord de l'écran vers le centre (10 à 90 %)
  corner: number; // taille du foyer plus fort dans le coin choisi (10 à 100 %)
  vignette: 'off' | 'soft' | 'normal' | 'strong'; // bord de l'écran teinté par les effets, icônes qui flottent
}
export interface Display {
  quality: Quality; // basse : image moins fine et moins de particules (machines modestes)
  damage: DamageNumbers; // chiffres des dégâts : tous (meute, coéquipiers), les siens (soi et sa meute), aucun
  shake: boolean; // secousses de l'écran
  ping: boolean; // latence affichée sous la minicarte
  weather: boolean; // pluie (la nuit reste : elle fait partie du monde)
  ui: Size; // taille de l'interface (barres, boutons, panneaux)
  text: Size; // taille des textes dans le monde (noms, dégâts, gains)
  statusHud: StatusHud; // vignettes des effets d'état
}
export interface Settings {
  keys: Record<Action, Binding>;
  attack: 'auto' | 'click'; // automatique (par défaut), ou au clic gauche vers le pointeur
  display: Display;
}

export const ACTIONS: { id: Action; name: string }[] = [
  { id: 'up', name: 'Avancer' },
  { id: 'down', name: 'Reculer' },
  { id: 'left', name: 'Gauche' },
  { id: 'right', name: 'Droite' },
  { id: 'interact', name: 'Interagir (bâtiment, grotte, coffre, baies)' },
  { id: 'fruit', name: 'Tendre un fruit' },
  { id: 'mount', name: 'Monter / descendre' },
  { id: 'map', name: 'Carte' },
  { id: 'revive', name: 'Relever un coéquipier (maintenir)' },
  { id: 'chat', name: 'Ouvrir le chat' },
];

const DEFAULTS: Settings = {
  keys: {
    up: { code: 'KeyW', label: 'Z / W' },
    down: { code: 'KeyS', label: 'S' },
    left: { code: 'KeyA', label: 'Q / A' },
    right: { code: 'KeyD', label: 'D' },
    interact: { key: 'e', label: 'E' },
    fruit: { key: 't', label: 'T' },
    mount: { key: 'f', label: 'F' },
    map: { key: 'm', label: 'M' },
    revive: { key: 'r', label: 'R' },
    chat: { key: 'c', label: 'C' },
  },
  attack: 'auto',
  display: { quality: 'high', damage: 'all', shake: true, ping: true, weather: true, ui: 'normal', text: 'normal', statusHud: { enabled: true, position: 'top-left', size: 'normal', timers: true, filter: 'all', animations: true, vignette: 'normal', opacity: 50, edge: 58, corner: 52 } },
};

/** Netteté maximale de l'image (pixels par point d'écran) selon la qualité. */
export const maxDpr = () => ({ low: 1, medium: 1.5, high: 2 })[settings.display.quality];
/** Part des particules gardées selon la qualité. */
export const particleRate = () => ({ low: 0.35, medium: 0.7, high: 1 })[settings.display.quality];

const STORE = 'fangleaf.settings.v1';
const SIZES = ['small', 'normal', 'large', 'xl'] as const;
const SCALE: Record<Size, number> = { small: 0.85, normal: 1, large: 1.18, xl: 1.36 };
/** Facteur de taille de l'interface. */
export const uiScale = () => SCALE[settings.display.ui];
/** Facteur de taille des textes dans le monde. */
export const textScale = () => SCALE[settings.display.text];
/** Applique la taille de l'interface (une variable CSS que le HUD suit). */
export const applyUi = () => document.documentElement.style.setProperty('--ui', String(uiScale()));

/** Écran tactile sans souris : pas de touches ni d'attaque au clic. */
export const touchOnly = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Settings> | null;
    const keys = { ...DEFAULTS.keys, ...(saved?.keys ?? {}) };
    if (keys.chat.key === 'Enter' && !keys.chat.code) keys.chat = DEFAULTS.keys.chat; // ancienne touche par défaut du chat : C désormais
    const d = saved?.display ?? DEFAULTS.display, D = DEFAULTS.display;
    const display: Display = {
      quality: (['low', 'medium', 'high'] as const).find((q) => q === d.quality) ?? D.quality,
      damage: (['all', 'mine', 'off'] as const).find((q) => q === d.damage) ?? D.damage,
      shake: typeof d.shake === 'boolean' ? d.shake : D.shake,
      ping: typeof d.ping === 'boolean' ? d.ping : D.ping,
      weather: typeof d.weather === 'boolean' ? d.weather : D.weather,
      ui: SIZES.find((q) => q === d.ui) ?? D.ui,
      text: SIZES.find((q) => q === d.text) ?? D.text,
      statusHud: {
        enabled: typeof d.statusHud?.enabled === 'boolean' ? d.statusHud.enabled : D.statusHud.enabled,
        position: (['top-left', 'top-right', 'bottom-left', 'bottom'] as const).find((q) => q === d.statusHud?.position) ?? D.statusHud.position,
        size: (['small', 'normal', 'large'] as const).find((q) => q === d.statusHud?.size) ?? D.statusHud.size,
        timers: typeof d.statusHud?.timers === 'boolean' ? d.statusHud.timers : D.statusHud.timers,
        filter: (['all', 'buffs', 'nerfs'] as const).find((q) => q === d.statusHud?.filter) ?? D.statusHud.filter,
        animations: typeof d.statusHud?.animations === 'boolean' ? d.statusHud.animations : D.statusHud.animations,
        vignette: (['off', 'soft', 'normal', 'strong'] as const).find((q) => q === d.statusHud?.vignette) ?? D.statusHud.vignette,
        opacity: typeof d.statusHud?.opacity === 'number' ? Math.min(100, Math.max(10, Math.round(d.statusHud.opacity))) : D.statusHud.opacity,
        edge: typeof d.statusHud?.edge === 'number' ? Math.min(90, Math.max(10, Math.round(d.statusHud.edge))) : D.statusHud.edge,
        corner: typeof d.statusHud?.corner === 'number' ? Math.min(100, Math.max(10, Math.round(d.statusHud.corner))) : D.statusHud.corner,
      },
    };
    return { keys, attack: saved?.attack === 'click' ? 'click' : 'auto', display };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export const settings: Settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(STORE, JSON.stringify(settings));
  } catch { /* stockage indisponible : réglages pour cette partie seulement */ }
}

export function resetKeys() {
  settings.keys = structuredClone(DEFAULTS.keys);
  saveSettings();
}

/** La touche (code physique, lettre tapée) correspond-elle à cette action ? */
export function matches(a: Action, code: string, key: string) {
  const b = settings.keys[a];
  return b.code ? b.code === code : b.key === key;
}

/** Action d'une touche pressée, s'il y en a une. */
export function actionOf(code: string, key: string): Action | undefined {
  return ACTIONS.find((a) => matches(a.id, code, key))?.id;
}

/** Nom affiché de la touche d'une action (« E », « Espace »…). */
export const keyLabel = (a: Action) => settings.keys[a].label;

/** Nom lisible d'une touche pressée, pour l'enregistrer. */
export function labelOf(code: string, key: string) {
  if (key === ' ') return 'Espace';
  if (key === 'Enter') return 'Entrée';
  if (key.length === 1) return key.toUpperCase();
  return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code] ?? key;
}
