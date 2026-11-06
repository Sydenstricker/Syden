/** Praga na toca (festa/praga.ts): cada batida vale se o bicho estava fora da toca naquela hora, no relógio do servidor. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { CUSTO_DO_COELHO, type DadosPraga } from '../src/festa/praga.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;

test('praga: quem bate na hora (com 200 a 300 ms de rede) pontua, e o coelhinho custa', () => {
  const r = rodadaDeTeste('praga', { aleatorio: sorteioFixo(7) });
  const { bichos } = r.rodada.publico(ANA).dados as DadosPraga;
  assert.ok(bichos.length >= 20, `${bichos.length} bichos`);
  assert.ok(bichos.some((b) => b.coelho), 'sai algum coelhinho');
  const pragas = bichos.map((b, i) => [b, i] as const).filter(([b]) => !b.coelho).slice(0, 6);
  const coelho = bichos.findIndex((b) => b.coelho);
  // a Ana bate logo que sai (o pedido chega 200 ms depois); a Bia, no último instante na tela dela (300 ms de rede)
  const eventos: [number, number, number][] = [];
  for (const [b, i] of pragas) eventos.push([b.t + 120 + 200, ANA, i], [b.t + b.vida - 30 + 300, BIA, i]);
  eventos.push([bichos[coelho].t + 300 + 300, BIA, coelho]);
  for (const [t, quem, i] of eventos.sort((a, b) => a[0] - b[0])) {
    r.em(t);
    r.rodada.acao(quem, { tipo: 'acerto', i });
  }
  r.em(21_000);
  r.rodada.acao(ANA, { tipo: 'resultado' });
  r.rodada.acao(BIA, { tipo: 'resultado' });
  assert.equal(r.linhaDe(ANA).valor, 6);
  assert.equal(r.linhaDe(ANA).posicao, 1);
  assert.equal(r.linhaDe(BIA).valor, 6 - CUSTO_DO_COELHO);
  assert.equal(r.linhaDe(BIA).posicao, 2);
});

test('praga: a lista inteira mandada de uma vez, ou a batida antes de o bicho sair, não vale', () => {
  const r = rodadaDeTeste('praga', { aleatorio: sorteioFixo(8) });
  const { bichos } = r.rodada.publico(ANA).dados as DadosPraga;
  r.em(5_000);
  for (let i = 0; i < bichos.length; i++) r.rodada.acao(BIA, { tipo: 'acerto', i });
  // a Ana bate num bicho meio segundo antes de ele sair
  const i = bichos.findIndex((b) => !b.coelho && b.t > 8_000);
  r.em(bichos[i].t - 500);
  r.rodada.acao(ANA, { tipo: 'acerto', i });
  r.ateRevelar();
  const daBia = r.linhaDe(BIA);
  const naTela = bichos.filter((b) => !b.coelho && b.t - 50 <= 5_000 && 5_000 <= b.t + b.vida + 500).length;
  assert.ok((daBia.valor ?? 0) <= naTela, `só o que estava na tela: ${daBia.valor} (na tela: ${naTela}, ao todo: ${bichos.length})`);
  assert.equal(r.linhaDe(ANA).motivo, 'nada', 'nenhuma batida valeu: não aparece com ponto');
});

test('praga: o robô não diz ter batido mais do que já tinha saído', () => {
  const r = rodadaDeTeste('praga');
  const dados = r.rodada.publico(ANA).dados as DadosPraga;
  for (let k = 0; k < 50; k++) {
    const rob = resultadoDoRobo('praga', dados, Math.random, 4_000);
    const sairam = dados.bichos.filter((b) => !b.coelho && b.t + b.vida <= 4_000).length;
    assert.ok((rob.valor ?? 0) <= sairam);
  }
});
