/**
 * Os balões da tela inicial não podem se atravessar.
 *
 * Isto já aconteceu de verdade, e a reclamação foi exatamente essa: "os balões estão se atravessando".
 * Naquela vez o problema era a cena ficar menor que o previsto; desta vez o risco é outro e mais fácil
 * de cometer — dois balões ancorados no MESMO ponto, porque quem acrescentou o segundo reaproveitou a
 * casa do primeiro sem perceber.
 *
 * Aqui a posição é CALCULADA, não olhada. É a mesma conta que a tela faz, então o teste envelhece
 * junto com ela: mudar a projeção da vila muda os dois lados ao mesmo tempo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { balaoDaCasa, CASAS, ESTATUA, PRACA_DOS_AMIGOS } from '../src/vilaGeometria.js';

/**
 * Distância mínima entre dois balões, em pontos percentuais da cena.
 *
 * Um balão ocupa por volta de 14% da largura. Oito é o suficiente para não se sobreporem, sem
 * engessar o desenho da vila a ponto de impedir uma casa nova.
 */
const MINIMO = 8;

const ANCORAS: Record<string, { c: number; r: number; alt: number }> = {
  salas: CASAS.salas,
  loja: CASAS.loja,
  aprender: CASAS.aprender,
  explorar: CASAS.explorar,
  amigos: PRACA_DOS_AMIGOS,
  coelhos: ESTATUA,
};

describe('posição dos balões da tela inicial', () => {
  it('nenhum par fica perto demais', () => {
    const pontos = Object.entries(ANCORAS).map(([nome, casa]) => ({ nome, ...balaoDaCasa(casa, 0) }));

    for (let i = 0; i < pontos.length; i++) {
      for (let j = i + 1; j < pontos.length; j++) {
        const a = pontos[i];
        const b = pontos[j];
        const distancia = Math.hypot(a.x - b.x, a.y - b.y);
        assert.ok(
          distancia >= MINIMO,
          `"${a.nome}" e "${b.nome}" estão a ${distancia.toFixed(1)} de distância (mínimo ${MINIMO}). ` +
            `Provavelmente os dois usam a mesma casa como âncora.`,
        );
      }
    }
  });

  it('todos ficam dentro da cena', () => {
    for (const [nome, casa] of Object.entries(ANCORAS)) {
      const { x, y } = balaoDaCasa(casa, 0);
      assert.ok(x >= 0 && x <= 100, `"${nome}" saiu pela lateral (x = ${x.toFixed(1)})`);
      assert.ok(y >= 0 && y <= 100, `"${nome}" saiu pelo topo ou pelo pé (y = ${y.toFixed(1)})`);
    }
  });
});
