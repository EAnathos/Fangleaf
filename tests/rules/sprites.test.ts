// Robes et effets de l'Alpha et du légendaire : chaque espèce a sa robe, chaque espèce qui a un géant a ses effets. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { SPECIES, bossOf } from '../../shared/config.ts';
import { VARIANT_FILTERS, LEGEND_FRONT } from '../../client/src/sprites.ts';

const keyOf = (i: number) => SPECIES[i].sprite ?? SPECIES[i].key;
const playable = SPECIES.map((_, i) => i).filter((i) => !SPECIES[i].boss && !SPECIES[i].minion);

describe('Sprites : robes et effets légendaires', () => {
  rule('Toute espèce jouable a une robe d\'Alpha (VARIANT_FILTERS).', () => {
    const missing = playable.filter((i) => !(keyOf(i) in VARIANT_FILTERS)).map(keyOf);
    check(missing.length === 0, `robe manquante : ${missing.join(', ')}`);
  });
  rule('Toute espèce qui a un géant a des effets de légendaire (LEGEND_FRONT).', () => {
    const missing = playable.filter((i) => bossOf(i) >= 0 && !(keyOf(i) in LEGEND_FRONT)).map(keyOf);
    check(missing.length === 0, `effets manquants : ${missing.join(', ')}`);
  });
});
