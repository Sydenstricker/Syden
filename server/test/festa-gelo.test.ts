/**
 * Repolhos no gelo (festa/gelo.ts): cada cenoura vale se estava no gelo, o coelho em cima dela, e dava para ter chegado; o golpe
 * do repolho é de quem leva (o servidor só confere o instante).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { CUSTO_DO_GOLPE, GELO_INICIO, GELO_MS, GELO_VMAX, type DadosGelo } from '../src/festa/gelo.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** Vai de cenoura em cenoura a 90% da velocidade máxima, pegando as que alcança: [instante, i, x, y]. */
function caminho(d: DadosGelo): [number, number, number, number][] {
  let [x, y] = GELO_INICIO;
  let t = 0;
  const pegas: [number, number, number, number][] = [];
  d.cenouras.forEach((c, i) => {
    const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
    const chega = Math.round(Math.max(t + (dist / (GELO_VMAX * 0.9)) * 1000, c.t + 100));
    if (chega > c.t + 4000 || chega > GELO_MS) return;
    pegas.push([chega, i, c.x + 3, c.y - 2]);
    [x, y, t] = [c.x + 3, c.y - 2, chega];
  });
  return pegas;
}

test('gelo: com 200 e 300 ms de rede, as cenouras alcançáveis valem, e cada golpe custa', () => {
  const r = rodadaDeTeste('gelo', { aleatorio: sorteioFixo(4) });
  const d = r.rodada.publico(ANA).dados as DadosGelo;
  assert.ok(d.repolhos.length >= 6 && d.cenouras.length >= 8);
  const pegas = caminho(d);
  assert.ok(pegas.length >= 6, `${pegas.length} cenouras alcançáveis`);
  const ev: [number, number, Record<string, unknown>][] = [];
  for (const [t, i, x, y] of pegas) {
    ev.push([t + 200, ANA, { tipo: 'acerto', i, t, x, y }], [t + 300, BIA, { tipo: 'acerto', i, t, x, y }]);
  }
  // a Bia leva dois repolhos (o segundo dito duas vezes na mesma piscada, que conta um)
  ev.push(
    [5_300, BIA, { tipo: 'acerto', golpe: true, t: 5_000 }],
    [9_300, BIA, { tipo: 'acerto', golpe: true, t: 9_000 }],
    [9_400, BIA, { tipo: 'acerto', golpe: true, t: 9_100 }],
  );
  ev.push([GELO_MS + 200, ANA, { tipo: 'resultado' }], [GELO_MS + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, pegas.length);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, pegas.length - 2 * CUSTO_DO_GOLPE);
});

test('gelo: o coelho em dois lugares, longe da cenoura, e a lista mandada no fim não valem', () => {
  const r = rodadaDeTeste('gelo', { aleatorio: sorteioFixo(5) });
  const d = r.rodada.publico(ANA).dados as DadosGelo;
  // a Ana pega a cenoura 0 e, 100 ms depois, diz estar em cima da 1, longe dali: a segunda não vale
  const [c0, c1] = d.cenouras;
  assert.ok(Math.sqrt((c0.x - c1.x) ** 2 + (c0.y - c1.y) ** 2) > 30, 'as duas primeiras ficam longe uma da outra');
  r.em(c1.t + 300);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 0, t: c1.t + 50, x: c0.x, y: c0.y });
  r.em(c1.t + 400);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 1, t: c1.t + 150, x: c1.x, y: c1.y });
  // e diz estar longe da cenoura 2 quando a pega: não vale
  const c2 = d.cenouras[2];
  r.em(c2.t + 2_500);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 2, t: c2.t + 2_300, x: c2.x + 40, y: c2.y });
  // a Bia, no fim, manda o caminho inteiro
  r.em(GELO_MS);
  for (const [t, i, x, y] of caminho(d)) r.rodada.acao(BIA, { tipo: 'acerto', i, t, x, y });
  r.em(GELO_MS + 300);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 1, 'só a primeira');
  assert.ok((r.linhaDe(BIA).valor ?? 0) <= 1, `no fim: ${r.linhaDe(BIA).valor}`);
});

test('gelo: o robô não pega mais do que já tinha aparecido', () => {
  const r = rodadaDeTeste('gelo');
  const d = r.rodada.publico(ANA).dados as DadosGelo;
  for (let k = 0; k < 30; k++) {
    const rob = resultadoDoRobo('gelo', d, Math.random, 5_000);
    assert.ok((rob.valor ?? 0) <= d.cenouras.filter((c) => c.t <= 5_000).length);
  }
});
