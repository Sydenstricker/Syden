/** Arrume a despensa (festa/despensa.ts): a resposta é uma arrumação dos mesmos potes, no tempo que o servidor viu. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { arrumacao, POTES, type DadosDespensa } from '../src/festa/despensa.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('despensa: a prateleira e o monte são os mesmos potes, noutra ordem', () => {
  const r = rodadaDeTeste('despensa', { aleatorio: Math.random });
  const d = r.rodada.publico(ANA).dados as DadosDespensa;
  assert.equal(d.prateleira.length, POTES);
  assert.equal(new Set(d.prateleira).size, POTES);
  assert.deepEqual([...d.monte].sort(), [...d.prateleira].sort());
  assert.notDeepEqual(d.monte, d.prateleira);
});

test('despensa: mais potes no lugar ganha; no empate, quem foi mais rápido', () => {
  const r = rodadaDeTeste('despensa', { rede: new Map([[ANA, 200], [BIA, 300], [3, 250]]) });
  const { prateleira } = r.rodada.publico(ANA).dados as DadosDespensa;
  const trocados = [prateleira[1], prateleira[0], ...prateleira.slice(2)];
  r.em(arrumacao() + 4_000 + 200);
  r.rodada.acao(ANA, { tipo: 'resultado', ordem: prateleira, ms: 4_000 });
  r.em(arrumacao() + 3_000 + 250);
  r.rodada.acao(3, { tipo: 'resultado', ordem: trocados, ms: 3_000 });
  r.em(arrumacao() + 6_000 + 300);
  r.rodada.acao(BIA, { tipo: 'resultado', ordem: prateleira, ms: 6_000 });
  assert.deepEqual(r.linhas().map((l) => [l.userId, l.valor, l.posicao]), [
    [ANA, POTES, 1],
    [BIA, POTES, 2],
    [3, POTES - 2, 3],
  ]);
});

test('despensa: potes que não são os da prateleira, ou a resposta antes de ela cair, não valem', () => {
  const r = rodadaDeTeste('despensa');
  const { prateleira } = r.rodada.publico(ANA).dados as DadosDespensa;
  r.em(arrumacao() - 500);
  r.rodada.acao(ANA, { tipo: 'resultado', ordem: prateleira, ms: 100 });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'invalido', 'antes de a prateleira cair');
  r.em(arrumacao() + 5_000);
  r.rodada.acao(BIA, { tipo: 'resultado', ordem: [prateleira[0], prateleira[0], ...prateleira.slice(2)], ms: 4_500 });
  assert.equal(r.rodada.publico(BIA).meu?.motivo, 'invalido', 'o mesmo pote duas vezes');
  // e o tempo dito mais curto que o que o servidor viu sobe ao que a rede explica
  const s = rodadaDeTeste('despensa');
  s.em(arrumacao() + 9_000);
  s.rodada.acao(ANA, { tipo: 'resultado', ordem: prateleira, ms: 800 });
  s.rodada.acao(BIA, { tipo: 'resultado', ordem: prateleira, ms: 8_450 });
  assert.ok((s.linhas()[0].userId === BIA), 'a Ana disse 0,8 s, mas o servidor viu 9 s');
});

test('despensa: o robô acerta uma arrumação possível (nunca 5 de 6)', () => {
  const r = rodadaDeTeste('despensa');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 200; k++) assert.notEqual(resultadoDoRobo('despensa', dados, Math.random, 20_000).valor, POTES - 1);
});
