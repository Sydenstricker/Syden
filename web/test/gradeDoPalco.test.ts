import { describe, expect, it } from 'vitest';
import { melhorGrade } from '../src/gradeDoPalco';

describe('a grade que enche o palco', () => {
  it('num monitor em pé, quatro quadros empilham numa coluna', () => {
    const g = melhorGrade(4, 1080, 1780, 8);
    expect(g.colunas).toBe(1);
    expect(g.largura).toBe(780); // a altura manda: 4 × 439 px de altura
  });
  it('num monitor deitado, quatro quadros ficam 2 × 2', () => {
    expect(melhorGrade(4, 1900, 960, 8).colunas).toBe(2);
  });
  it('duas transmissões num monitor deitado ficam lado a lado', () => {
    expect(melhorGrade(2, 1900, 960, 8).colunas).toBe(2);
  });
  it('o quadro nunca passa da largura nem da altura', () => {
    for (const [n, w, h] of [[3, 1080, 1780], [5, 1900, 960], [7, 800, 600]] as const) {
      const g = melhorGrade(n, w, h, 8);
      const linhas = Math.ceil(n / g.colunas);
      expect(g.colunas * g.largura + (g.colunas - 1) * 8).toBeLessThanOrEqual(w);
      expect(linhas * (g.largura * 9) / 16 + (linhas - 1) * 8).toBeLessThanOrEqual(h);
    }
  });
});
