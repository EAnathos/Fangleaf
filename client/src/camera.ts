// Caméra souple (« Élan ») : une zone morte autour du dompteur (les petits pas ne bougent rien), un regard vers l'avant
// qui s'installe peu à peu selon la vitesse, un ressort amorti qui amène la vue au point visé, et un lent recentrage à
// l'arrêt. Rien de brusque : la vue n'épouse d'un coup que les déplacements de la zone morte (pour ne jamais perdre le
// dompteur), le regard vers l'avant arrive et repart toujours en douceur.
// Sans dépendance au navigateur : game.ts lui donne la position du dompteur à chaque image et dessine depuis (x, y).

import {
  CAMERA_DEAD_R, CAMERA_LOOK_FROM, CAMERA_LOOK_MAX, CAMERA_LOOK_S, CAMERA_LOOK_TAU, CAMERA_LOOK_VERT, CAMERA_SETTLE_AFTER, CAMERA_SETTLE_S,
  CAMERA_SNAP_R, CAMERA_SOFT_S, CAMERA_VEL_MAX, CAMERA_VEL_S,
} from '../../shared/config.ts';

const ease = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);
/** Ce vecteur, ramené à la longueur max s'il la dépasse. */
const cap = (x: number, y: number, max: number): [number, number] => {
  const l = Math.hypot(x, y);
  return l > max ? [(x / l) * max, (y / l) * max] : [x, y];
};

export class SmoothCamera {
  /** Centre de la vue. */
  x = 0;
  y = 0;
  /** Regard vers l'avant en cours (décalage du point visé). */
  lookX = 0;
  lookY = 0;
  private ready = false;
  private lastX = 0; // position du dompteur à l'image précédente
  private lastY = 0;
  private ax = 0; // ancre de la zone morte : elle ne bouge que quand le dompteur en sort (ou au recentrage)
  private ay = 0;
  private vx = 0; // vitesse lissée
  private vy = 0;
  private sx = 0; // vitesse de la caméra
  private sy = 0;
  private still = 0; // depuis combien de temps le dompteur ne bouge plus (s)

  /** Place la caméra sur ce point, sans glisser (arrivée en jeu, téléportation, caméra fixe). */
  snap(x: number, y: number) {
    this.ready = true;
    this.x = this.lastX = this.ax = x;
    this.y = this.lastY = this.ay = y;
    this.vx = this.vy = this.sx = this.sy = this.lookX = this.lookY = this.still = 0;
  }

  /**
   * Une image : (x, y) la position du dompteur ; look : regarder devant soi (coupé par « mouvements réduits ») ; reach :
   * vitesse de la monture (1 à pied) : monté, on file plus loin d'un geste, la zone morte et le seuil du regard
   * grandissent d'autant.
   */
  update(dt: number, x: number, y: number, look = true, reach = 1) {
    if (!this.ready || Math.hypot(x - this.lastX, y - this.lastY) > CAMERA_SNAP_R) return this.snap(x, y);
    if (dt <= 0) return;
    // vitesse de l'image, bornée : un recalage du serveur (quelques centaines de pixels d'un coup) ne compte pas comme une course
    const [ix, iy] = cap((x - this.lastX) / dt, (y - this.lastY) / dt, CAMERA_VEL_MAX);
    [this.lastX, this.lastY] = [x, y];
    const kv = ease(dt, CAMERA_VEL_S);
    this.vx += (ix - this.vx) * kv;
    this.vy += (iy - this.vy) * kv;
    this.still = ix || iy ? 0 : this.still + dt;
    // zone morte : l'ancre n'est tirée que quand le dompteur en sort, et seulement de ce qui dépasse
    const ox = this.ax, oy = this.ay, dead = CAMERA_DEAD_R * Math.max(1, reach);
    const dx = x - this.ax, dy = y - this.ay, d = Math.hypot(dx, dy);
    if (d > dead) {
      this.ax += (dx * (d - dead)) / d;
      this.ay += (dy * (d - dead)) / d;
    }
    // vitesse de l'ancre poussée par le dompteur : la caméra la suit (elle ne le perd jamais de vue)
    const [avx, avy] = cap((this.ax - ox) / dt, (this.ay - oy) / dt, CAMERA_VEL_MAX);
    // arrêté un moment : l'ancre revient lentement sur lui (la vue se recentre, sans à-coup)
    if (this.still > CAMERA_SETTLE_AFTER) {
      const k = ease(dt, CAMERA_SETTLE_S);
      this.ax += (x - this.ax) * k;
      this.ay += (y - this.ay) * k;
    }
    // regard vers l'avant : seulement la vitesse au-delà du seuil (un petit pas n'y suffit pas), plafonné, et il
    // s'installe comme il se retire, en douceur (pas de recul brusque de la vue quand on s'arrête)
    // (monté, le seuil grandit comme la zone morte : un geste de cavalier n'est pas une course)
    const from = CAMERA_LOOK_FROM * Math.max(1, reach), sp = Math.hypot(this.vx, this.vy), over = look && sp > from ? ((sp - from) * CAMERA_LOOK_S) / sp : 0;
    const [tx, ty] = cap(this.vx * over, this.vy * over * CAMERA_LOOK_VERT, CAMERA_LOOK_MAX), kl = ease(dt, CAMERA_LOOK_TAU);
    this.lookX += (tx - this.lookX) * kl;
    this.lookY += (ty - this.lookY) * kl;
    const gx = this.ax + this.lookX, gy = this.ay + this.lookY;
    // ressort amorti critique, en deux pas pour rester stable quand une image dure longtemps
    const w = 2 / CAMERA_SOFT_S, h = dt / 2;
    for (let i = 0; i < 2; i++) {
      this.sx += (w * w * (gx - this.x) + 2 * w * (avx - this.sx)) * h;
      this.sy += (w * w * (gy - this.y) + 2 * w * (avy - this.sy)) * h;
      this.x += this.sx * h;
      this.y += this.sy * h;
    }
  }
}
