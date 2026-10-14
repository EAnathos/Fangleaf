// Clavier (touches réglables, voir settings.ts) + glisser au doigt / à la souris, ou clic gauche pour attaquer.

import { matches, settings } from './settings.ts';

const codes = new Set<string>(); // codes physiques enfoncés
const typed = new Set<string>(); // lettres enfoncées (pour les touches réglées par lettre)

export const stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
const STICK_MAX = 60;
/** Clic gauche maintenu (mode « attaque au clic ») : position du pointeur à l'écran. */
export const aim = { down: false, x: 0, y: 0 };

const keyOf = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

/**
 * Raccourcis : onAction(code, lettre) à chaque touche pressée, onRelease quand elle est relâchée.
 * Au doigt (ou à la souris en attaque automatique), glisser déplace ; en attaque au clic, la souris vise et frappe.
 */
export function initInput(canvas: HTMLCanvasElement, onAction: (code: string, key: string) => void, onRelease: (code: string, key: string) => void = () => {}) {
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    codes.add(e.code);
    typed.add(keyOf(e));
    if (!e.repeat) onAction(e.code, keyOf(e));
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    codes.delete(e.code);
    typed.delete(keyOf(e));
    onRelease(e.code, keyOf(e));
  });
  addEventListener('blur', () => {
    codes.clear();
    typed.clear();
    aim.down = false;
    onRelease('', ''); // touche relâchée hors de la fenêtre : on la considère lâchée
  });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'mouse' && settings.attack === 'click') {
      if (e.button !== 0) return;
      Object.assign(aim, { down: true, x: e.clientX, y: e.clientY });
      return;
    }
    stick.active = true;
    stick.ox = stick.x = e.clientX;
    stick.oy = stick.y = e.clientY;
  });
  canvas.addEventListener('pointermove', (e) => {
    [aim.x, aim.y] = [e.clientX, e.clientY];
    if (!stick.active) return;
    stick.x = e.clientX;
    stick.y = e.clientY;
  });
  const end = () => {
    stick.active = false;
    aim.down = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

const held = (a: 'up' | 'down' | 'left' | 'right', arrow: string) => {
  const b = settings.keys[a];
  return codes.has(arrow) || (b.code ? codes.has(b.code) : !!b.key && typed.has(b.key));
};

/** Direction de déplacement normalisée (ou nulle). Les flèches marchent toujours. */
export function moveDir(): [number, number] {
  let x = 0, y = 0;
  if (held('up', 'ArrowUp')) y -= 1;
  if (held('down', 'ArrowDown')) y += 1;
  if (held('left', 'ArrowLeft')) x -= 1;
  if (held('right', 'ArrowRight')) x += 1;
  if (stick.active) {
    const dx = stick.x - stick.ox, dy = stick.y - stick.oy, d = Math.hypot(dx, dy);
    if (d > 8) {
      const k = Math.min(1, d / STICK_MAX);
      return [(dx / d) * k, (dy / d) * k];
    }
  }
  const l = Math.hypot(x, y);
  return l ? [x / l, y / l] : [0, 0];
}

