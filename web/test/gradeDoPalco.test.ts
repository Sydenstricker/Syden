import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { melhorGrade } from '../src/gradeDoPalco.js';

describe('a grade que enche o palco', () => {
  it('num monitor em pé, quatro quadros empilham numa coluna', () => {
    const g = melhorGrade(4, 1080, 1780, 8);
    assert.equal(g.colunas, 1);
    assert.equal(g.largura, 780); // a altura manda: 4 × 439 px de altura
  });
  it('num monitor deitado, quatro quadros ficam 2 × 2', () => {
    assert.equal(melhorGrade(4, 1900, 960, 8).colunas, 2);
  });
  it('duas transmissões num monitor deitado ficam lado a lado', () => {
    assert.equal(melhorGrade(2, 1900, 960, 8).colunas, 2);
  });
  it('o quadro nunca passa da largura nem da altura', () => {
    for (const [n, w, h] of [[3, 1080, 1780], [5, 1900, 960], [7, 800, 600]] as const) {
      const g = melhorGrade(n, w, h, 8);
      const linhas = Math.ceil(n / g.colunas);
      assert.ok(g.colunas * g.largura + (g.colunas - 1) * 8 <= w);
      assert.ok(linhas * (g.largura * 9) / 16 + (linhas - 1) * 8 <= h);
    }
  });
});
