/** Retrato do coelho (festa/retrato.ts): cada parada vale na hora, e o servidor refaz onde a faixa estava. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { AMPLITUDE, deslocamento, FAIXAS, RETRATO_MS, type DadosRetrato } from '../src/festa/retrato.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

/** O primeiro instante depois de `desde` em que a faixa passa pelo lugar certo. */
const noLugar = (f: DadosRetrato['faixas'][number], desde: number) => {
  for (let t = desde; t < RETRATO_MS; t++) if (deslocamento(f, t) === 0) return t;
  throw new Error('a faixa não passou pelo lugar');
};

test('retrato: a faixa vai e volta entre os dois lados, e começa longe do lugar', () => {
  for (let s = 1; s <= 30; s++) {
    const r = rodadaDeTeste('retrato', { aleatorio: sorteioFixo(s) });
    const { faixas } = r.rodada.publico(ANA).dados as DadosRetrato;
    for (const f of faixas) {
      const posicoes = Array.from({ length: f.periodo }, (_, t) => deslocamento(f, t));
      assert.equal(Math.max(...posicoes), AMPLITUDE);
      assert.equal(Math.min(...posicoes), -AMPLITUDE);
      assert.ok(Math.abs(deslocamento(f, 0)) >= AMPLITUDE / 4, 'não começa montado');
    }
  }
});

test('retrato: a Ana para cada faixa no lugar (com 200 ms de rede), a Bia erra um pouco, e a Ana ganha', () => {
  const r = rodadaDeTeste('retrato');
  const { faixas } = r.rodada.publico(ANA).dados as DadosRetrato;
  const eventos: [number, number, Record<string, unknown>][] = [];
  let t = 500;
  for (let k = 0; k < FAIXAS; k++) {
    t = noLugar(faixas[k], t + 300);
    eventos.push([t + 200, ANA, { tipo: 'acerto', t }]);
    // a Bia para 40 ms depois, com 300 ms de rede
    eventos.push([t + 40 + 300, BIA, { tipo: 'acerto', t: t + 40 }]);
  }
  eventos.push([t + 260, ANA, { tipo: 'resultado' }]);
  eventos.push([t + 400, BIA, { tipo: 'resultado' }]);
  for (const [em, quem, corpo] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(em);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, 100);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.ok((r.linhaDe(BIA).valor ?? 100) < 100);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('retrato: os instantes perfeitos mandados depois não valem, nem duas paradas no mesmo instante', () => {
  const r = rodadaDeTeste('retrato');
  const { faixas } = r.rodada.publico(ANA).dados as DadosRetrato;
  const perfeitos: number[] = [];
  let t = 500;
  for (let k = 0; k < FAIXAS; k++) perfeitos.push((t = noLugar(faixas[k], t + 300)));
  // a Ana manda os três no fim: o servidor já viu passar muito mais do que a rede dela explica
  r.em(RETRATO_MS);
  for (const p of perfeitos) r.rodada.acao(ANA, { tipo: 'acerto', t: p });
  r.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'errou');
  // a Bia manda três paradas no mesmo instante, que é o do lugar da primeira: só uma vale
  const s = rodadaDeTeste('retrato');
  s.em(perfeitos[0] + 300);
  for (let k = 0; k < FAIXAS; k++) s.rodada.acao(BIA, { tipo: 'acerto', t: perfeitos[0] });
  s.rodada.acao(BIA, { tipo: 'resultado' });
  assert.ok((s.rodada.publico(BIA).meu?.valor ?? 100) <= 67, 'as outras duas contam como as piores');
  // e um instante no futuro do servidor não vale
  const u = rodadaDeTeste('retrato');
  u.em(1000);
  u.rodada.acao(ANA, { tipo: 'acerto', t: perfeitos[0] + 2000 });
  u.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(u.rodada.publico(ANA).meu?.motivo, 'errou');
});

test('retrato: o robô nunca para mais faixas do que cabem no tempo', () => {
  const r = rodadaDeTeste('retrato');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 100; k++) {
    const rob = resultadoDoRobo('retrato', dados, Math.random, 1_000);
    assert.equal(rob.motivo, 'errou', 'em 1 s, nenhuma');
    const bom = resultadoDoRobo('retrato', dados, Math.random, RETRATO_MS);
    assert.ok(bom.motivo === null && (bom.valor ?? 0) > 50 && (bom.valor ?? 0) <= 100);
  }
});
