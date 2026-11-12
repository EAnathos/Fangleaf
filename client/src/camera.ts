// Caméra souple (« Élan ») : une zone morte autour du dompteur (les petits pas ne bougent rien), un regard vers l'avant
// qui grandit avec la vitesse lissée au-delà d'un seuil, et un ressort amorti qui amène la vue au point visé sans
// dépassement ni rebond, en suivant sa vitesse (pas de retard quand on court).
// Sans dépendance au navigateur : game.ts lui donne la position du dompteur à chaque image et dessine depuis (x, y).

import { CAMERA_DEAD_R, CAMERA_LOOK_FROM, CAMERA_LOOK_MAX, CAMERA_LOOK_S, CAMERA_LOOK_VERT, CAMERA_SNAP_R, CAMERA_SOFT_S, CAMERA_VEL_MAX, CAMERA_VEL_S } from '../../shared/config.ts';

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
  private ax = 0; // ancre de la zone morte : elle ne bouge que quand le dompteur en sort
  private ay = 0;
  private vx = 0; // vitesse lissée
  private vy = 0;
  private gx = 0; // point visé (ancre + regard)
  private gy = 0;
  private sx = 0; // vitesse de la caméra
  private sy = 0;

  /** Place la caméra sur ce point, sans glisser (arrivée en jeu, téléportation, caméra fixe). */
  snap(x: number, y: number) {
    this.ready = true;
    this.x = this.lastX = this.ax = this.gx = x;
    this.y = this.lastY = this.ay = this.gy = y;
    this.vx = this.vy = this.sx = this.sy = this.lookX = this.lookY = 0;
  }

  /** Une image : (x, y) la position du dompteur ; look : regarder devant soi (coupé par « mouvements réduits »). */
  update(dt: number, x: number, y: number, look = true) {
    if (!this.ready || Math.hypot(x - this.lastX, y - this.lastY) > CAMERA_SNAP_R) return this.snap(x, y);
    if (dt <= 0) return;
    // vitesse de l'image, bornée : un recalage du serveur (quelques centaines de pixels d'un coup) ne compte pas comme une course
    const [ix, iy] = cap((x - this.lastX) / dt, (y - this.lastY) / dt, CAMERA_VEL_MAX);
    [this.lastX, this.lastY] = [x, y];
    const kv = ease(dt, CAMERA_VEL_S);
    this.vx += (ix - this.vx) * kv;
    this.vy += (iy - this.vy) * kv;
    // zone morte : l'ancre n'est tirée que quand le dompteur en sort, et seulement de ce qui dépasse
    const dx = x - this.ax, dy = y - this.ay, d = Math.hypot(dx, dy);
    if (d > CAMERA_DEAD_R) {
      this.ax += (dx * (d - CAMERA_DEAD_R)) / d;
      this.ay += (dy * (d - CAMERA_DEAD_R)) / d;
    }
    // regard vers l'avant : seulement la vitesse au-delà du seuil (un petit pas n'y suffit pas), plafonné
    const sp = Math.hypot(this.vx, this.vy), over = look && sp > CAMERA_LOOK_FROM ? ((sp - CAMERA_LOOK_FROM) * CAMERA_LOOK_S) / sp : 0;
    [this.lookX, this.lookY] = cap(this.vx * over, this.vy * over * CAMERA_LOOK_VERT, CAMERA_LOOK_MAX);
    const gx = this.ax + this.lookX, gy = this.ay + this.lookY;
    // vitesse du point visé (bornée elle aussi) : le ressort la suit, sans traîner derrière quand on court
    const [gvx, gvy] = cap((gx - this.gx) / dt, (gy - this.gy) / dt, CAMERA_VEL_MAX);
    [this.gx, this.gy] = [gx, gy];
    // ressort amorti critique, en deux pas pour rester stable quand une image dure longtemps
    const w = 2 / CAMERA_SOFT_S, h = dt / 2, ex = gx - this.x, ey = gy - this.y;
    for (let i = 0; i < 2; i++) {
      this.sx += (w * w * (gx - this.x) + 2 * w * (gvx - this.sx)) * h;
      this.sy += (w * w * (gy - this.y) + 2 * w * (gvy - this.sy)) * h;
      this.x += this.sx * h;
      this.y += this.sy * h;
    }
    // elle ne dépasse jamais le point visé : en le franchissant, elle s'y pose et prend son allure (pas de rebond)
    if (ex * (gx - this.x) < 0) [this.x, this.sx] = [gx, gvx];
    if (ey * (gy - this.y) < 0) [this.y, this.sy] = [gy, gvy];
  }
}
