/** De galho em galho (festa/cipo.ts): cada soltura vale na hora, pela mesma conta do balanço da tela. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { balanco, CIPO_MS, CIPOS, cipozalInicial, soltar, VOO_MS, type DadosCipo } from '../src/festa/lote2sim.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('cipo: o balanço vai de −1 a 1, começando no meio para a frente, e todo cipó tem o ponto certo', () => {
  assert.equal(balanco(0), 0);
  assert.equal(balanco(0.25), 1);
  assert.equal(balanco(0.75), -1);
  assert.ok(balanco(0.1) > 0 && balanco(0.6) < 0);
  const r = rodadaDeTeste('cipo', { aleatorio: sorteioFixo(2) });
  const d = r.rodada.publico(ANA).dados as DadosCipo;
  for (let k = 0; k < CIPOS; k++) assert.ok(d.limiares[k] < 1 && d.periodos[k] >= 850, `cipó ${k}`);
});

/** Solta no ponto mais alto de cada cipó: os instantes, na tela. */
function noPontoCerto(d: DadosCipo): number[] {
  const s = cipozalInicial();
  const t: number[] = [];
  while (s.k < CIPOS) {
    const quando = Math.round(s.g + d.periodos[s.k] * 0.25);
    t.push(quando);
    assert.equal(soltar(s, d, quando), 'pegou');
  }
  return t;
}

test('cipo: com 200 e 300 ms de rede, quem solta no ponto atravessa tudo; quem solta cedo cai e perde tempo', () => {
  const r = rodadaDeTeste('cipo', { aleatorio: sorteioFixo(9) });
  const d = r.rodada.publico(ANA).dados as DadosCipo;
  const ana = noPontoCerto(d);
  assert.ok(ana[ana.length - 1] + VOO_MS < CIPO_MS, 'dá tempo de atravessar todos');
  // a Bia solta logo que pega cada cipó (cedo demais) a cada três, e cai
  const bia: number[] = [];
  const s = cipozalInicial();
  let n = 0;
  while (s.k < CIPOS) {
    const quando = Math.round(s.g + d.periodos[s.k] * (n++ % 3 === 0 ? 0.02 : 0.25));
    if (quando > CIPO_MS) break;
    bia.push(quando);
    soltar(s, d, quando);
  }
  assert.ok(s.quedas > 0);
  const ev: [number, number, Record<string, unknown>][] = [];
  for (const t of ana) ev.push([t + 200, ANA, { tipo: 'acerto', t }]);
  for (const t of bia) ev.push([t + 300, BIA, { tipo: 'acerto', t }]);
  ev.push([ana[ana.length - 1] + VOO_MS + 200, ANA, { tipo: 'resultado' }]);
  ev.push([CIPO_MS + 300, BIA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, CIPOS);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, s.k);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('cipo: as solturas perfeitas mandadas no fim não valem', () => {
  const r = rodadaDeTeste('cipo', { aleatorio: sorteioFixo(10) });
  const d = r.rodada.publico(ANA).dados as DadosCipo;
  r.em(23_000);
  for (const t of noPontoCerto(d)) r.rodada.acao(ANA, { tipo: 'acerto', t });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('cipo: o robô não atravessa mais do que coube', () => {
  const r = rodadaDeTeste('cipo');
  const d = r.rodada.publico(ANA).dados as DadosCipo;
  // quem solta sempre no ponto mais alto é o máximo possível
  const perfeito = noPontoCerto(d).filter((t) => t <= 3_000).length;
  for (let k = 0; k < 30; k++) assert.ok((resultadoDoRobo('cipo', d, Math.random, 3_000).valor ?? 0) <= perfeito);
  const cheios = Array.from({ length: 30 }, () => resultadoDoRobo('cipo', d, Math.random, CIPO_MS).valor ?? 0);
  assert.ok(Math.max(...cheios) >= 6, `o robô atravessa uns cipós: ${cheios}`);
});
