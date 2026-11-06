/** Pegue a galinha (festa/galinha.ts): as mudanças de direção vão na hora, e as galinhas pegas são as da simulação do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { galinha, PASSO_MS, pilotoDaGalinha, type DadosGalinha } from '../src/festa/lote2sim.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('galinha: quem corre atrás na hora (200 e 300 ms de rede) pega as que a tela mostrou', () => {
  const r = rodadaDeTeste('galinha', { aleatorio: sorteioFixo(11) });
  const d = r.rodada.publico(ANA).dados as DadosGalinha;
  const e = pilotoDaGalinha(d);
  const naTela = galinha(d, e).k;
  assert.ok(naTela >= 3 && naTela <= 10, `o piloto pega ${naTela}`);
  // a Bia faz o mesmo, mas a cada mudança 300 ms depois (com a tela dela, a partida é a mesma)
  const ev: [number, number, Record<string, unknown>][] = [];
  for (const [p, dx, dy] of e) ev.push([p * PASSO_MS + 200, ANA, { tipo: 'acerto', p, dx, dy }], [p * PASSO_MS + 300, BIA, { tipo: 'acerto', p, dx, dy }]);
  ev.push([20_000 + 200, ANA, { tipo: 'resultado' }], [20_000 + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, naTela);
  assert.equal(r.linhaDe(BIA).valor, naTela);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).posicao, 1, 'mesma partida, mesma posição');
});

test('galinha: parado não pega, e a corrida mandada no fim não vale', () => {
  const r = rodadaDeTeste('galinha', { aleatorio: sorteioFixo(12) });
  const d = r.rodada.publico(ANA).dados as DadosGalinha;
  const e = pilotoDaGalinha(d);
  r.em(19_900);
  for (const [p, dx, dy] of e) r.rodada.acao(ANA, { tipo: 'acerto', p, dx, dy });
  r.rodada.acao(BIA, { tipo: 'acerto', p: 0, dx: 0, dy: 0 });
  r.em(20_300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
  assert.equal(r.linhaDe(BIA).motivo, 'errou');
});

test('galinha: o robô não pega mais do que coube', () => {
  const r = rodadaDeTeste('galinha');
  const d = r.rodada.publico(ANA).dados as DadosGalinha;
  for (let k = 0; k < 30; k++) assert.ok((resultadoDoRobo('galinha', d, Math.random, 3_000).valor ?? 0) <= 1);
});
