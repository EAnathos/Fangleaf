// Robe de l'Alpha par couleurs (client/src/tint.ts) : même résultat que le filtre CSS, sans filtre canvas. Lancer : npm run test:rules

import { describe } from 'node:test';
import { rule, check } from '../helpers.ts';
import { VARIANT_FILTERS } from '../../client/src/sprites.ts';
import { tintColor, unsupportedFilterFunctions, withTint } from '../../client/src/tint.ts';
import { pickCapped } from '../../shared/math.ts';

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

  rule('Les unités d\'angle sont converties, un argument illisible est signalé comme non géré.', () => {
    const red = (f: string) => tintColor('#ff0000', f);
    check(red('hue-rotate(0.5turn)') === red('hue-rotate(180deg)'), 'turn');
    check(red(`hue-rotate(${Math.PI}rad)`) === red('hue-rotate(180deg)'), 'rad');
    check(red('hue-rotate(200grad)') === red('hue-rotate(180deg)'), 'grad');
    check(red('hue-rotate()') === 'rgba(255,0,0,1)', 'hue-rotate() vaut 0 degré');
    check(unsupportedFilterFunctions('hue-rotate(3foo) brightness(abc)').join() === 'hue-rotate,brightness', 'arguments illisibles');
  });

  rule('Une opacité qui varie ne fait pas de nouvelle entrée et est recopiée telle quelle (écriture scientifique comprise).', () => {
    const f = 'brightness(0.5)';
    check(tintColor('rgba(200,100,50,0.25)', f) === 'rgba(100,50,25,0.25)', 'rgba');
    check(tintColor('rgba(200,100,50,6.1e-17)', f) === 'rgba(100,50,25,6.1e-17)', 'écriture scientifique');
    check(tintColor('rgba(200, 100, 50, 0.4)', f) === 'rgba(100,50,25,0.4)', 'espaces');
  });

  // Un faux contexte : mêmes accesseurs sur le prototype, dégradés qui notent leurs arrêts.
  const grad = () => ({ stops: [] as string[], addColorStop(_o: number, c: string) { this.stops.push(c); } });
  class Fake {
    v: Record<string, string> = { fillStyle: '#000', strokeStyle: '#000', shadowColor: '#000' };
    get fillStyle() { return this.v.fillStyle; }
    set fillStyle(c: string) { this.v.fillStyle = c; }
    get strokeStyle() { return this.v.strokeStyle; }
    set strokeStyle(c: string) { this.v.strokeStyle = c; }
    get shadowColor() { return this.v.shadowColor; }
    set shadowColor(c: string) { this.v.shadowColor = c; }
    createLinearGradient(..._a: number[]) { return grad(); }
    createRadialGradient(..._a: number[]) { return grad(); }
  }
  const tintCtx = () => new Fake() as unknown as CanvasRenderingContext2D;
  const F = 'brightness(0.5)';

  rule('withTint : couleurs et dégradés convertis pendant le dessin, rien ensuite, même après une exception.', () => {
    const ctx = tintCtx();
    withTint(ctx, F, () => {
      ctx.fillStyle = '#c86432';
      ctx.shadowColor = 'rgba(200,100,50,0.5)';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1) as unknown as { stops: string[]; addColorStop(o: number, c: string): void };
      g.addColorStop(0, '#c86432');
      check(g.stops[0] === 'rgba(100,50,25,1)', 'arrêt de dégradé');
    });
    check(ctx.fillStyle === 'rgba(100,50,25,1)' && ctx.shadowColor === 'rgba(100,50,25,0.5)', 'couleurs converties');
    ctx.strokeStyle = '#c86432';
    check(ctx.strokeStyle === '#c86432', 'hors robe : tel quel');
    try { withTint(ctx, F, () => { throw new Error('x'); }); } catch { /* attendu */ }
    ctx.fillStyle = '#c86432';
    check(ctx.fillStyle === '#c86432', 'robe retirée après une exception');
    const g2 = ctx.createLinearGradient(0, 0, 1, 1) as unknown as { stops: string[]; addColorStop(o: number, c: string): void };
    g2.addColorStop(0, '#c86432');
    check(g2.stops[0] === '#c86432', 'dégradé hors robe : tel quel');
  });

  rule('withTint : imbriqué, la robe précédente revient ; un autre contexte n\'est pas touché.', () => {
    const a = tintCtx(), b = tintCtx();
    withTint(a, F, () => {
      withTint(a, 'brightness(0.25)', () => { a.fillStyle = '#c86432'; });
      check(a.fillStyle === 'rgba(50,25,13,1)', 'robe interne');
      a.fillStyle = '#c86432';
      check(a.fillStyle === 'rgba(100,50,25,1)', 'robe externe retrouvée');
      b.fillStyle = '#c86432';
      check(b.fillStyle === '#c86432', 'autre contexte intact');
    });
  });

  rule('withTint : sans les propriétés attendues, le dessin se fait quand même (sans robe).', () => {
    const bare = { fillStyle: '#000' } as unknown as CanvasRenderingContext2D;
    let drew = false;
    withTint(bare, F, () => { drew = true; });
    check(drew, 'dessin exécuté');
  });

  rule('pickCapped : des doublons dans la demande ne faussent pas le plafond ; un arrivant ne déloge personne.', () => {
    const dup = ['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd'];
    check(pickCapped(dup, [], 3).size === 3, 'trois distincts');
    const shown = new Set(['a', 'b', 'c']);
    const next = pickCapped(['a', 'b', 'c', 'd'], shown, 3);
    check([...shown].every((k) => next.has(k)) && next.size === 3, 'plafond atteint : les mêmes');
  });
});
