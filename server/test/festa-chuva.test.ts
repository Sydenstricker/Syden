/** Chuva de cenouras (festa/chuva.ts): cada cenoura vale se o coelho passava por ela e dava para ter chegado; a pedra é de quem leva. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { CHUVA_INICIO, CHUVA_MS, CHUVA_VX, CUSTO_DA_PEDRA, PEDRA, VALOR, type DadosChuva } from '../src/festa/chuva.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** Vai de cenoura em cenoura a 90% da velocidade, pegando as que alcança: [instante, i, x]. */
function caminho(d: DadosChuva): [number, number, number][] {
  let x = CHUVA_INICIO;
  let t = 0;
  const pegas: [number, number, number][] = [];
  d.itens.forEach((it, i) => {
    if (it.tipo === PEDRA) return;
    if (Math.abs(it.x + 4 - x) > (CHUVA_VX * 0.9 * (it.t - t)) / 1000) return;
    pegas.push([it.t, i, it.x + 4]);
    [x, t] = [it.x + 4, it.t];
  });
  return pegas;
}

test('chuva: com 200 e 300 ms de rede, as cenouras do caminho valem, e a pedra custa', () => {
  const r = rodadaDeTeste('chuva', { aleatorio: sorteioFixo(8) });
  const d = r.rodada.publico(ANA).dados as DadosChuva;
  assert.ok(d.itens.some((i) => i.tipo === PEDRA));
  const pegas = caminho(d);
  const pontos = pegas.reduce((s, [, i]) => s + VALOR[d.itens[i].tipo], 0);
  assert.ok(pegas.length >= 15, `${pegas.length} no caminho`);
  const pedra = d.itens.findIndex((i) => i.tipo === PEDRA);
  const ev: [number, number, Record<string, unknown>][] = [];
  for (const [t, i, x] of pegas) ev.push([t + 200, ANA, { tipo: 'acerto', i, t, x }], [t + 300, BIA, { tipo: 'acerto', i, t, x }]);
  ev.push([d.itens[pedra].t + 300, BIA, { tipo: 'acerto', i: pedra, t: d.itens[pedra].t, pedra: true }]);
  ev.push([d.itens[pedra].t + 400, BIA, { tipo: 'acerto', i: pedra, t: d.itens[pedra].t + 50, pedra: true }]);
  ev.push([CHUVA_MS + 200, ANA, { tipo: 'resultado' }], [CHUVA_MS + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, pontos);
  assert.equal(r.linhaDe(BIA).valor, pontos - CUSTO_DA_PEDRA, 'a mesma pedra conta uma vez');
  assert.equal(r.linhaDe(ANA).posicao, 1);
});

test('chuva: pegar tudo pelo console (de um lado ao outro, ou no fim) não vale', () => {
  const r = rodadaDeTeste('chuva', { aleatorio: sorteioFixo(9) });
  const d = r.rodada.publico(ANA).dados as DadosChuva;
  const todas = d.itens.map((it, i) => [it, i] as const).filter(([it]) => it.tipo !== PEDRA);
  for (const [it, i] of todas) {
    r.em(it.t + 250);
    r.rodada.acao(ANA, { tipo: 'acerto', i, t: it.t, x: it.x });
  }
  r.em(CHUVA_MS);
  for (const [it, i] of todas) r.rodada.acao(BIA, { tipo: 'acerto', i, t: it.t, x: it.x });
  r.em(CHUVA_MS + 300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  const tudo = todas.reduce((s, [it]) => s + VALOR[it.tipo], 0);
  assert.ok((r.linhaDe(ANA).valor ?? 0) < tudo, `${r.linhaDe(ANA).valor} de ${tudo}: o caminho impossível corta umas`);
  assert.ok((r.linhaDe(BIA).valor ?? 0) <= 3);
});

test('chuva: o robô não pega mais do que já passou', () => {
  const r = rodadaDeTeste('chuva');
  const d = r.rodada.publico(ANA).dados as DadosChuva;
  for (let k = 0; k < 30; k++) {
    const rob = resultadoDoRobo('chuva', d, Math.random, 4_000);
    assert.ok((rob.valor ?? 0) <= d.itens.filter((i) => i.t <= 4_000).reduce((s, i) => s + VALOR[i.tipo], 0));
  }
});
