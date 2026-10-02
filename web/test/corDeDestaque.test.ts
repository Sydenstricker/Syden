import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COR_PADRAO, contrasteComBranco, corDeHover, corLegivel, corValida } from '../src/corDeDestaque';

// ===================================================================================================
// A PROMESSA DESTE MÓDULO É UMA SÓ: a cor que a pessoa escolher nunca vai deixar texto ilegível.
//
// Ela precisa de teste porque é uma promessa SOBRE TODAS AS CORES, e não sobre as que alguém lembrou
// de experimentar. O amarelo é o caso óbvio; o ciano claro e o verde-limão são os que passam
// despercebidos na hora de escolher e aparecem depois, num botão que ninguém consegue ler.
// ===================================================================================================

/** Um giro completo de matizes, para a conferência não depender das cores que eu lembrei. */
function todasAsMatizes(): string[] {
  const cores: string[] = [];
  for (let h = 0; h < 360; h += 10) {
    for (const l of [0.5, 0.7, 0.9]) {
      // HSL → RGB, com saturação cheia: é onde o contraste mais varia.
      const c = (1 - Math.abs(2 * l - 1)) * 1;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l - c / 2;
      const [r, g, b] = (
        h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
      ).map((v) => Math.round((v + m) * 255));
      cores.push(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
  }
  return cores;
}

describe('a cor de destaque escolhida pela pessoa', () => {
  it('toda cor possível sai legível com texto branco em cima', () => {
    const ruins: string[] = [];
    for (const cor of todasAsMatizes()) {
      const saida = corLegivel(cor);
      if (contrasteComBranco(saida) < 4.5) ruins.push(`${cor} → ${saida} (${contrasteComBranco(saida).toFixed(2)}:1)`);
    }
    assert.deepEqual(ruins, [], `cores que ficaram ilegíveis:\n  ${ruins.slice(0, 6).join('\n  ')}`);
  });

  it('cor que já é legível NÃO é mexida', () => {
    // Escurecer o que já está bom tiraria do Syden a cor que a pessoa escolheu, de graça.
    assert.equal(corLegivel(COR_PADRAO), COR_PADRAO);
    assert.ok(contrasteComBranco(COR_PADRAO) >= 4.5, 'o próprio azul do Syden tem de passar na régua');
  });

  it('o amarelo continua amarelo — escurece, não vira outra cor', () => {
    // O risco do conserto é ele ser bruto demais: quem pediu ouro não pode receber marrom.
    const saida = corLegivel('#ffd700');
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(saida.slice(i, i + 2), 16));
    assert.ok(r > b && g > b, `${saida} deixou de ser amarelo`);
    assert.ok(r > 90 && g > 70, `${saida} escureceu demais`);
  });

  it('o tom de hover é mais escuro que a cor, sempre', () => {
    for (const cor of ['#5865f2', '#e0112b', '#2d7d46']) {
      const base = [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
      const hover = corDeHover(cor);
      const soma = [1, 3, 5].map((i) => parseInt(hover.slice(i, i + 2), 16)).reduce((a, b) => a + b, 0);
      assert.ok(soma < base, `${hover} não é mais escuro que ${cor}`);
    }
  });

  it('entrada torta não derruba nada: volta o padrão', () => {
    for (const lixo of ['', 'azul', '#fff', '#12345', 'rgb(1,2,3)', '#gggggg']) {
      assert.equal(corValida(lixo), false, `${lixo} não devia ser aceita`);
      assert.equal(corLegivel(lixo), COR_PADRAO);
    }
  });
});
