/** Brasas da fogueira (festa/brasas.ts): o golpe é de quem leva, conferido pelo instante e pela piscada; três golpes, fora. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { BRASAS_MS, COM_CORACOES, type DadosBrasas } from '../src/festa/brasas.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

test('brasas: os padrões cobrem a rodada, e os quatro tipos aparecem', () => {
  const r = rodadaDeTeste('brasas', { aleatorio: sorteioFixo(1) });
  const { padroes } = r.rodada.publico(ANA).dados as DadosBrasas;
  assert.ok(padroes.length >= 9, `${padroes.length} padrões`);
  assert.equal(new Set(padroes.map((p) => p.tipo)).size, 4);
});

test('brasas: com 200 e 300 ms de rede, quem leva menos golpes fica na frente, e quem leva três sai pelo tempo', () => {
  const rede = new Map([
    [ANA, 200],
    [BIA, 300],
    [CAIO, 250],
  ]);
  const r = rodadaDeTeste('brasas', { rede, aleatorio: sorteioFixo(2) });
  const ev: [number, number, Record<string, unknown>][] = [
    // a Bia leva um (e o mesmo golpe repetido na piscada não conta)
    [6_300, BIA, { tipo: 'acerto', golpe: true, t: 6_000 }],
    [6_500, BIA, { tipo: 'acerto', golpe: true, t: 6_200 }],
    // o Caio leva três e sai
    [3_250, CAIO, { tipo: 'acerto', golpe: true, t: 3_000 }],
    [8_250, CAIO, { tipo: 'acerto', golpe: true, t: 8_000 }],
    [12_250, CAIO, { tipo: 'acerto', golpe: true, t: 12_000 }],
    [12_300, CAIO, { tipo: 'resultado' }],
    [BRASAS_MS + 200, ANA, { tipo: 'resultado' }],
    [BRASAS_MS + 300, BIA, { tipo: 'resultado' }],
  ];
  for (const [t, quem, corpo] of ev.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, COM_CORACOES + 3);
  assert.equal(r.linhaDe(BIA).valor, COM_CORACOES + 2);
  assert.equal(r.linhaDe(CAIO).valor, 12_000);
  assert.deepEqual(
    [ANA, BIA, CAIO].map((q) => r.linhaDe(q).posicao),
    [1, 2, 3],
  );
});

test('brasas: o fim mandado antes da hora conta como saída, e o golpe fora do relógio não conta', () => {
  const r = rodadaDeTeste('brasas', { aleatorio: sorteioFixo(3) });
  // a Ana manda o fim aos 5 s, sem golpe: aguentou 5 s, não ficou com os três corações
  r.em(5_000);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  // a Bia diz ter levado um golpe aos 20 s, mandado aos 6 s (no futuro): não conta
  r.em(6_000);
  r.rodada.acao(BIA, { tipo: 'acerto', golpe: true, t: 20_000 });
  r.em(BRASAS_MS + 300);
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 5_000);
  assert.equal(r.linhaDe(BIA).valor, COM_CORACOES + 3);
  assert.deepEqual([r.linhaDe(BIA).posicao, r.linhaDe(ANA).posicao], [1, 2]);
});

test('brasas: o robô não aguenta mais do que coube', () => {
  const r = rodadaDeTeste('brasas');
  const d = r.rodada.publico(ANA).dados as DadosBrasas;
  for (let k = 0; k < 30; k++) assert.ok((resultadoDoRobo('brasas', d, Math.random, 6_000).valor ?? 0) <= 6_000);
});
