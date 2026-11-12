// La caméra souple (client/src/camera.ts) : zone morte, suivi en douceur, regard vers l'avant. Lancer : npm run test:rules -- camera

import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { CAMERA_DEAD_R, CAMERA_LOOK_MAX, PLAYER_SPEED } from '../../shared/config.ts';
import { SmoothCamera } from '../../client/src/camera.ts';

const DT = 1 / 60;
/**
 * Fait avancer le dompteur de (vx, vy) px/s pendant s secondes ; each reçoit la caméra après chaque image ; reach : la
 * vitesse de sa monture (1 à pied).
 */
const walk = (cam: SmoothCamera, at: { x: number; y: number }, vx: number, vy: number, s: number, each?: () => void, reach = 1) => {
  for (let i = 0; i < Math.round(s / DT); i++) {
    at.x += vx * DT;
    at.y += vy * DT;
    cam.update(DT, at.x, at.y, true, reach);
    each?.();
  }
};

describe('Caméra souple', () => {
  rule('Petits pas sur place : la caméra ne bouge pas.', () => {
    const cam = new SmoothCamera(), at = { x: 1000, y: 500 };
    cam.snap(at.x, at.y);
    let moved = 0;
    // des pas de quelques dixièmes de seconde, à gauche, à droite, en haut, en bas
    for (let k = 0; k < 12; k++) {
      const [vx, vy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][k % 4];
      walk(cam, at, vx * PLAYER_SPEED, vy * PLAYER_SPEED, 0.16, () => (moved = Math.max(moved, Math.hypot(cam.x - 1000, cam.y - 500))));
      walk(cam, at, 0, 0, 0.16, () => (moved = Math.max(moved, Math.hypot(cam.x - 1000, cam.y - 500))));
    }
    check(moved < 1, `la caméra a bougé de ${moved.toFixed(2)} px au plus`);
  });

  rule('Monté, la zone morte grandit avec la vitesse de la monture : un geste de cavalier ne bouge pas la caméra.', () => {
    const steps = (reach: number) => {
      const cam = new SmoothCamera(), at = { x: 0, y: 0 };
      cam.snap(0, 0);
      let moved = 0;
      // à cheval (×1,5), des allers-retours d'un quart de seconde : environ 80 px de chaque côté
      for (let k = 0; k < 8; k++) {
        walk(cam, at, (k % 2 ? -1 : 1) * PLAYER_SPEED * 1.5, 0, 0.25, () => (moved = Math.max(moved, Math.abs(cam.x))), reach);
        walk(cam, at, 0, 0, 0.2, () => (moved = Math.max(moved, Math.abs(cam.x))), reach);
      }
      return moved;
    };
    const ride = steps(1.5), foot = steps(1);
    check(ride < 1, `zone morte de cavalier : la caméra a bougé de ${ride.toFixed(2)} px`);
    check(foot > 5, `(avec la zone morte d'un piéton, ces mêmes gestes la feraient bouger de ${Math.round(foot)} px)`);
  });

  rule('Une course dans une direction : la caméra suit et regarde devant, d\'autant plus loin qu\'on va vite, sans dépasser la limite.', () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    walk(cam, at, PLAYER_SPEED, 0, 4);
    const foot = cam.x - at.x;
    check(foot > 0 && Math.abs(cam.y - at.y) < 1, `à pied vers la droite : la vue est ${Math.round(foot)} px devant le dompteur`);
    walk(cam, at, PLAYER_SPEED * 1.7, 0, 4, undefined, 1.7);
    const ride = cam.x - at.x;
    check(ride > foot + 20, `plus vite (monté) : ${Math.round(ride)} px devant, contre ${Math.round(foot)} à pied`);
    walk(cam, at, 0, -PLAYER_SPEED * 5, 3);
    check(Math.hypot(cam.lookX, cam.lookY) <= CAMERA_LOOK_MAX + 0.01 && cam.y < at.y, `très vite vers le haut : regard plafonné à ${CAMERA_LOOK_MAX} px, vers le haut`);
  });

  rule("Ni départ ni arrêt brusques : la caméra accélère et freine en douceur, puis se recentre lentement sur le dompteur arrêté.", () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    let last = cam.x, lastV = 0, accel = 0, back = 0;
    const watch = () => {
      const v = (cam.x - last) / DT;
      accel = Math.max(accel, Math.abs(v - lastV) / DT);
      back = Math.max(back, -v);
      [last, lastV] = [cam.x, v];
    };
    walk(cam, at, PLAYER_SPEED, 0, 3, watch);
    walk(cam, at, 0, 0, 6, watch);
    check(accel < 2500, `accélération de la caméra : ${Math.round(accel)} px/s² au plus (pas d'à-coup)`);
    check(back < 120, `à l'arrêt, la vue revient vers le dompteur à ${Math.round(back)} px/s au plus (pas de recul brusque)`);
    check(Math.abs(cam.x - at.x) < 5, `après quelques secondes d'arrêt, la caméra est recentrée (à ${Math.round(Math.abs(cam.x - at.x))} px)`);
  });

  rule('Téléportation : la caméra saute avec le dompteur ; un recalage du serveur, lui, ne la fait pas bondir.', () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    walk(cam, at, PLAYER_SPEED, 0, 1);
    at.x += 3000;
    cam.update(DT, at.x, at.y);
    check(cam.x === at.x && cam.y === at.y && cam.lookX === 0, 'Pierre de passage, grotte : la caméra est aussitôt sur le dompteur');
    const before = cam.x;
    at.x += 220; // le serveur a refusé un déplacement : le dompteur est recalé d'un coup
    cam.update(DT, at.x, at.y);
    check(Math.abs(cam.x - before) < 30 && Math.hypot(cam.lookX, cam.lookY) <= CAMERA_LOOK_MAX, `recalage de 220 px : la caméra avance de ${Math.round(cam.x - before)} px sur l'image, puis suit`);
  });

  rule('Mouvements réduits : la caméra suit sans regarder devant.', () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    for (let i = 0; i < 180; i++) {
      at.x += PLAYER_SPEED * DT;
      cam.update(DT, at.x, at.y, false);
    }
    check(cam.lookX === 0 && cam.x < at.x && at.x - cam.x <= CAMERA_DEAD_R + 20, `pas de regard devant ; la vue suit à ${Math.round(at.x - cam.x)} px derrière`);
  });
});
