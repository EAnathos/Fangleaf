// Réglages du joueur sur PC (gardés dans ce navigateur) : touches et façon d'attaquer.
// Au doigt, rien ne change : on glisse pour se déplacer et l'attaque reste automatique.

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
export interface Settings {
  keys: Record<Action, Binding>;
  attack: 'auto' | 'click'; // automatique (par défaut), ou au clic gauche vers le pointeur
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
    chat: { key: 'Enter', label: 'Entrée' },
  },
  attack: 'auto',
};

const STORE = 'fangleaf.settings.v1';

/** Écran tactile sans souris : pas de touches ni d'attaque au clic. */
export const touchOnly = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Settings> | null;
    return { keys: { ...DEFAULTS.keys, ...(saved?.keys ?? {}) }, attack: saved?.attack === 'click' ? 'click' : 'auto' };
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
