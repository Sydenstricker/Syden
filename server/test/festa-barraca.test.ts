/** Barraca de tiro (festa/barraca.ts): cada tiro vale na hora, se a figura estava na barraca; o coelhinho custa dois. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { BARRACA_MS, LARGURA, MARGEM, posicaoDaFigura, travessia, type DadosBarraca } from '../src/festa/barraca.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('barraca: as figuras atravessam a barraca, sem andar grudadas, e há coelhinhos', () => {
  for (let s = 1; s <= 20; s++) {
    const r = rodadaDeTeste('barraca', { aleatorio: sorteioFixo(s) });
    const { figuras } = r.rodada.publico(ANA).dados as DadosBarraca;
    assert.ok(figuras.length >= 25);
    for (const f of figuras) {
      assert.ok(Math.abs(posicaoDaFigura(f, f.t) - (f.dir > 0 ? -MARGEM : LARGURA + MARGEM)) < 1e-9);
      assert.ok(Math.abs(posicaoDaFigura(f, f.t + travessia(f)) - (f.dir > 0 ? LARGURA + MARGEM : -MARGEM)) < 1);
    }
    assert.ok(figuras.some((f) => f.coelho) && figuras.filter((f) => f.coelho).length < figuras.length / 3);
  }
});

test('barraca: os corvos valem, o coelhinho custa, e o servidor vê os tiros na hora', () => {
  const r = rodadaDeTeste('barraca', { aleatorio: sorteioFixo(2) });
  const { figuras } = r.rodada.publico(ANA).dados as DadosBarraca;
  const corvos = figuras.map((f, i) => [f, i] as const).filter(([f]) => !f.coelho);
  const coelho = figuras.findIndex((f) => f.coelho);
  const eventos: [number, number, Record<string, unknown>][] = [];
  // a Ana acerta cada corvo quando ele chega ao meio; a Bia acerta metade, e um coelhinho
  for (const [k, [f, i]] of corvos.entries()) {
    const meio = f.t + travessia(f) / 2;
    eventos.push([meio + 100, ANA, { tipo: 'acerto', i }]);
    if (k % 2 === 0) eventos.push([meio + 150, BIA, { tipo: 'acerto', i }]);
  }
  const fc = figuras[coelho];
  eventos.push([fc.t + travessia(fc) / 2 + 150, BIA, { tipo: 'acerto', i: coelho }]);
  eventos.push([BARRACA_MS + 100, ANA, { tipo: 'resultado' }], [BARRACA_MS + 150, BIA, { tipo: 'resultado' }]);
  for (const [em, quem, corpo] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(em);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, corvos.length);
  assert.equal(r.linhaDe(BIA).valor, Math.ceil(corvos.length / 2) - 2);
  assert.deepEqual([r.linhaDe(ANA).posicao, r.linhaDe(BIA).posicao], [1, 2]);
});

test('barraca: a figura que ainda não entrou, ou que já saiu há muito, não se acerta', () => {
  const r = rodadaDeTeste('barraca');
  const { figuras } = r.rodada.publico(ANA).dados as DadosBarraca;
  const i = figuras.findIndex((f) => !f.coelho && f.t > 5000);
  r.em(figuras[i].t - 1000);
  r.rodada.acao(ANA, { tipo: 'acerto', i });
  r.em(figuras[0].t + travessia(figuras[0]) + 2000);
  r.rodada.acao(ANA, { tipo: 'acerto', i: 0 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('barraca: o robô não acerta mais corvos do que já passaram', () => {
  const r = rodadaDeTeste('barraca');
  const dados = r.rodada.publico(ANA).dados as DadosBarraca;
  for (let k = 0; k < 100; k++) {
    const passaram = dados.figuras.filter((f) => !f.coelho && f.t + travessia(f) <= 6000).length;
    assert.ok((resultadoDoRobo('barraca', dados, Math.random, 6000).valor ?? 0) <= passaram);
  }
});
