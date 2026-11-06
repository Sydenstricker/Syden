/** Fuga do rio (festa/rio.ts): as braçadas e os mergulhos vão na hora, e a distância do peixe é a conta do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { fuga, MERGULHO_MS, RIO_MS, type DadosRio } from '../src/festa/lote2sim.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** Bate `porSegundo` vezes por segundo e mergulha 200 ms antes de cada tronco (os mergulhados, só se `mergulha`). */
function nado(d: DadosRio, porSegundo: number, mergulha: boolean) {
  const bracadas: number[] = [];
  for (let t = 200; t < RIO_MS; t += 1000 / porSegundo) bracadas.push(Math.round(t));
  const mergulhos = mergulha ? d.troncos.map((t) => t - 200) : [];
  return { bracadas, mergulhos };
}

test('rio: quem bate rápido e mergulha nos troncos escapa; quem não mergulha é pego', () => {
  for (let s = 1; s <= 10; s++) {
    const r = rodadaDeTeste('rio', { aleatorio: sorteioFixo(s) });
    const d = r.rodada.publico(ANA).dados as DadosRio;
    const bom = nado(d, 9, true);
    assert.equal(fuga(d, bom.bracadas, bom.mergulhos).pegoEm, null, `semente ${s}: 9 por segundo, mergulhando, escapa`);
    const fraco = nado(d, 5, true);
    assert.notEqual(fuga(d, fraco.bracadas, fraco.mergulhos).pegoEm, null, `semente ${s}: 5 por segundo não basta`);
    const seco = nado(d, 9, false);
    assert.ok((fuga(d, seco.bracadas, seco.mergulhos).pegoEm ?? RIO_MS) < RIO_MS || fuga(d, seco.bracadas, []).golpes > 0);
  }
});

test('rio: com 200 e 300 ms de rede, em pacotes, o servidor chega à mesma fuga da tela', () => {
  const r = rodadaDeTeste('rio', { aleatorio: sorteioFixo(3) });
  const d = r.rodada.publico(ANA).dados as DadosRio;
  const ana = nado(d, 9, true);
  const bia = nado(d, 8, false);
  const ev: [number, number, Record<string, unknown>][] = [];
  // as braçadas em pacotes de 150 ms, mandados no fim de cada pacote
  for (const [quem, rede, n] of [[ANA, 200, ana], [BIA, 300, bia]] as const) {
    for (let p = 0; p < RIO_MS; p += 150) {
      const b = n.bracadas.filter((t) => t >= p && t < p + 150);
      if (b.length) ev.push([p + 150 + rede, quem, { tipo: 'acerto', b }]);
    }
    for (const m of n.mergulhos) ev.push([m + rede, quem, { tipo: 'acerto', m }]);
  }
  const daBia = fuga(d, bia.bracadas, bia.mergulhos);
  ev.push([RIO_MS + 200, ANA, { tipo: 'resultado' }]);
  ev.push([(daBia.pegoEm ?? RIO_MS) + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, RIO_MS);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, Math.round(daBia.pegoEm ?? RIO_MS));
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('rio: braçadas mandadas depois da hora, ou mais de 14 por segundo, não contam; mergulho seguido também não', () => {
  const r = rodadaDeTeste('rio', { aleatorio: sorteioFixo(4) });
  const d = r.rodada.publico(ANA).dados as DadosRio;
  // a Ana manda, aos 10 s, as braçadas perfeitas dos primeiros 10 s: nenhuma cabe no relógio
  r.em(10_000);
  r.rodada.acao(ANA, { tipo: 'acerto', b: Array.from({ length: 12 }, (_, k) => 500 + k * 100) });
  // a Bia, pelo console, manda 12 braçadas no mesmo instante: conta uma
  r.rodada.acao(BIA, { tipo: 'acerto', b: Array(12).fill(9_900) });
  r.rodada.acao(BIA, { tipo: 'acerto', m: 9_950 });
  r.em(10_100);
  r.rodada.acao(BIA, { tipo: 'acerto', m: 10_050 });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).motivo, 'errou');
  // a Bia, com uma braçada só, foi pega bem antes dos 10 s
  assert.ok((r.linhaDe(BIA).valor ?? 0) < 4_000, `${r.linhaDe(BIA).valor}`);
  assert.ok(MERGULHO_MS > 100);
});

test('rio: o robô é pego ou escapa pela mesma conta, e não passa do tempo que coube', () => {
  const r = rodadaDeTeste('rio');
  const d = r.rodada.publico(ANA).dados as DadosRio;
  for (let k = 0; k < 30; k++) assert.ok((resultadoDoRobo('rio', d, Math.random, 6_000).valor ?? 0) <= 6_000);
});
