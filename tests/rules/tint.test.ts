// Robe de l'Alpha par couleurs (client/src/tint.ts) : même résultat que le filtre CSS, sans filtre canvas. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { VARIANT_FILTERS } from '../../client/src/sprites.ts';
import { tintColor, unsupportedFilterFunctions } from '../../client/src/tint.ts';

describe('Tint : robe de l\'Alpha appliquée aux couleurs', () => {
  rule('Chaque robe (VARIANT_FILTERS) n\'utilise que des fonctions de filtre gérées.', () => {
    const bad = Object.entries(VARIANT_FILTERS).flatMap(([k, f]) => unsupportedFilterFunctions(f).map((n) => `${k}:${n}`));
    check(bad.length === 0, `fonctions de filtre non gérées : ${bad.join(', ')}`);
  });
  rule('Un filtre neutre laisse la couleur telle quelle.', () => {
    check(tintColor('#3a7bd5', 'hue-rotate(0deg) saturate(1) brightness(1) contrast(1)') === 'rgba(58,123,213,1)', 'couleur modifiée');
  });
  rule('hue-rotate(180deg) sur un rouge pur donne le vert-bleu attendu (matrice CSS).', () => {
    check(tintColor('#ff0000', 'hue-rotate(180deg)') === 'rgba(0,109,109,1)', tintColor('#ff0000', 'hue-rotate(180deg)'));
  });
  rule('brightness s\'applique canal par canal et se limite à 255.', () => {
    check(tintColor('rgb(100,200,50)', 'brightness(1.5)') === 'rgba(150,255,75,1)', tintColor('rgb(100,200,50)', 'brightness(1.5)'));
  });
  rule('L\'opacité de la couleur est conservée (rgba, #rrggbbaa, #rgb).', () => {
    check(tintColor('rgba(240,182,74,0.35)', 'brightness(1)') === 'rgba(240,182,74,0.35)', 'rgba');
    check(tintColor('#ff000080', 'brightness(1)').endsWith(`${128 / 255})`), 'hex avec alpha');
    check(tintColor('#f00', 'brightness(1)') === 'rgba(255,0,0,1)', 'hex court');
  });
});
