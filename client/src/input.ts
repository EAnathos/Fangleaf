// Clavier (codes physiques : ZQSD en AZERTY = WASD en QWERTY) + glisser au doigt / à la souris.

const keys = new Set<string>();
const UP = ['KeyW', 'ArrowUp'], DOWN = ['KeyS', 'ArrowDown'], LEFT = ['KeyA', 'ArrowLeft'], RIGHT = ['KeyD', 'ArrowRight'];

export const stick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
const STICK_MAX = 60;

/**
 * Déplacement : codes physiques (ZQSD en AZERTY = WASD en QWERTY).
 * Raccourcis (E, F, M…) : la lettre réellement tapée, sinon M ne marche pas en AZERTY (touche « ; » en QWERTY).
 */
export function initInput(canvas: HTMLCanvasElement, onAction: (code: string, key: string) => void, onRelease: (code: string, key: string) => void = () => {}) {
  addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    keys.add(e.code);
    if (!e.repeat) onAction(e.code, e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    keys.delete(e.code);
    onRelease(e.code, e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  addEventListener('blur', () => {
    keys.clear();
    onRelease('', ''); // touche relâchée hors de la fenêtre : on la considère lâchée
  });

  canvas.addEventListener('pointerdown', (e) => {
    stick.active = true;
    stick.ox = stick.x = e.clientX;
    stick.oy = stick.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!stick.active) return;
    stick.x = e.clientX;
    stick.y = e.clientY;
  });
  const end = () => (stick.active = false);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

/** Direction de déplacement normalisée (ou nulle). */
export function moveDir(): [number, number] {
  let x = 0, y = 0;
  if (UP.some((k) => keys.has(k))) y -= 1;
  if (DOWN.some((k) => keys.has(k))) y += 1;
  if (LEFT.some((k) => keys.has(k))) x -= 1;
  if (RIGHT.some((k) => keys.has(k))) x += 1;
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
