// La caméra souple (client/src/camera.ts) : zone morte, suivi en douceur, regard vers l'avant. Lancer : npm run test:rules -- camera

import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { CAMERA_DEAD_R, CAMERA_LOOK_MAX, PLAYER_SPEED } from '../../shared/config.ts';
import { SmoothCamera } from '../../client/src/camera.ts';

const DT = 1 / 60;
/** Fait avancer le dompteur de (vx, vy) px/s pendant s secondes ; each reçoit la caméra après chaque image. */
const walk = (cam: SmoothCamera, at: { x: number; y: number }, vx: number, vy: number, s: number, each?: () => void) => {
  for (let i = 0; i < Math.round(s / DT); i++) {
    at.x += vx * DT;
    at.y += vy * DT;
    cam.update(DT, at.x, at.y);
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

  rule('Une course dans une direction : la caméra suit et regarde devant, d\'autant plus loin qu\'on va vite, sans dépasser la limite.', () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    walk(cam, at, PLAYER_SPEED, 0, 3);
    const foot = cam.x - at.x;
    check(foot > 80 && Math.abs(cam.y - at.y) < 1, `à pied vers la droite : la vue est ${Math.round(foot)} px devant le dompteur`);
    walk(cam, at, PLAYER_SPEED * 1.7, 0, 3);
    const ride = cam.x - at.x;
    check(ride > foot + 40, `plus vite (monté) : ${Math.round(ride)} px devant`);
    walk(cam, at, 0, -PLAYER_SPEED * 5, 3);
    check(Math.hypot(cam.lookX, cam.lookY) <= CAMERA_LOOK_MAX + 0.01 && cam.y < at.y, `très vite vers le haut : regard plafonné à ${CAMERA_LOOK_MAX} px, vers le haut`);
  });

  rule("À l'arrêt, la caméra revient sur le dompteur en douceur, sans rebond.", () => {
    const cam = new SmoothCamera(), at = { x: 0, y: 0 };
    cam.snap(0, 0);
    walk(cam, at, PLAYER_SPEED, 0, 3);
    let turns = 0, prev = 0, last = cam.x;
    walk(cam, at, 0, 0, 4, () => {
      const v = cam.x - last;
      if (Math.abs(v) > 1e-4) {
        if (prev && Math.sign(v) !== Math.sign(prev)) turns++;
        prev = v;
      }
      last = cam.x;
    });
    check(Math.abs(cam.x - at.x) <= CAMERA_DEAD_R + 1, `revenue à ${Math.round(Math.abs(cam.x - at.x))} px du dompteur (zone morte ${CAMERA_DEAD_R} px)`);
    check(turns <= 1, `un seul changement de sens (elle revient de devant), pas de rebond : ${turns}`);
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
