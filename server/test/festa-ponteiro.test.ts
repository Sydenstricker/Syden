/** Pula o ponteiro (festa/ponteiro.ts): cada pulo vale na hora, e o servidor conta quantas passagens ele cobriu. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste } from './festa-ajuda.js';
import { passagensAguentadas, PULO_MS, RECARGA_MS, VOLTA_MINIMA_MS, type DadosPonteiro } from '../src/festa/ponteiro.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('ponteiro: as voltas aceleram, e dá para pular todas', () => {
  const r = rodadaDeTeste('ponteiro');
  const { passagens } = r.rodada.publico(ANA).dados as DadosPonteiro;
  const voltas = passagens.slice(1).map((p, i) => p - passagens[i]);
  assert.ok(voltas.every((v, i) => i === 0 || v <= voltas[i - 1]), 'cada volta igual ou mais rápida');
  assert.ok(Math.min(...voltas) >= VOLTA_MINIMA_MS);
  assert.ok(VOLTA_MINIMA_MS > PULO_MS + RECARGA_MS, 'mesmo a mais rápida deixa pular de novo');
  // pular 200 ms antes de cada passagem cobre todas
  assert.equal(passagensAguentadas(passagens, passagens.map((p) => p - 200)), passagens.length);
});

test('ponteiro: a Ana pula na hora até o fim, a Bia pula cedo demais na quinta, e cai', () => {
  const r = rodadaDeTeste('ponteiro');
  const { passagens } = r.rodada.publico(ANA).dados as DadosPonteiro;
  const eventos: [number, number, Record<string, unknown>][] = [];
  passagens.forEach((p, k) => {
    eventos.push([p - 180 + 200, ANA, { tipo: 'acerto', t: p - 180 }]);
    // a Bia pula 600 ms antes na quinta: já caiu quando o ponteiro passa
    const t = k === 4 ? p - 600 : p - 250;
    eventos.push([t + 300, BIA, { tipo: 'acerto', t }]);
  });
  // a Bia foi atingida na quinta: a tela dela manda o fim logo depois
  eventos.push([passagens[4] + 50 + 300, BIA, { tipo: 'resultado' }]);
  eventos.push([passagens[passagens.length - 1] + 300 + 200, ANA, { tipo: 'resultado' }]);
  for (const [t, quem, corpo] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, corpo);
  }
  assert.equal(r.linhaDe(ANA).valor, passagens.length);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, 4);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('ponteiro: pular sem parar não cobre, e o pulo mandado fora da hora não vale', () => {
  const r = rodadaDeTeste('ponteiro');
  const { passagens } = r.rodada.publico(ANA).dados as DadosPonteiro;
  // a Bia, pelo console, manda um pulo a cada 50 ms, na hora: só vale um a cada PULO_MS + RECARGA_MS
  for (let t = 0; t <= passagens[passagens.length - 1]; t += 50) {
    r.em(t + 100);
    r.rodada.acao(BIA, { tipo: 'acerto', t });
  }
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.ok((r.rodada.publico(BIA).meu?.valor ?? 0) < passagens.length, 'não aguenta todas');
  // a Ana manda, no fim, a lista dos pulos perfeitos (os instantes já passaram): nenhum vale
  const s = rodadaDeTeste('ponteiro');
  s.em(passagens[passagens.length - 1] + 100);
  for (const p of passagens) s.rodada.acao(ANA, { tipo: 'acerto', t: p - 200 });
  s.rodada.acao(ANA, { tipo: 'resultado' });
  assert.equal(s.rodada.publico(ANA).meu?.motivo, 'errou');
  assert.equal(s.rodada.publico(ANA).meu?.valor, 0);
});

test('ponteiro: o robô não aguenta mais passagens do que já aconteceram', () => {
  const r = rodadaDeTeste('ponteiro');
  const dados = r.rodada.publico(ANA).dados as DadosPonteiro;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('ponteiro', dados, Math.random, 6_000);
    assert.ok((rob.valor ?? 0) <= dados.passagens.filter((p) => p <= 6_000).length);
  }
});
