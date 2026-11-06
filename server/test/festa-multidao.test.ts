/** Quem está atrás da turma? (festa/multidao.ts): o bicho só vai quando o primeiro coelho sai; uma escolha, e errar é zero. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rodadaDeTeste, sorteioFixo } from './festa-ajuda.js';
import { MULTIDAO_MS, OPCOES, PRIMEIRA_SAIDA_MS, TURMA, type DadosMultidao } from '../src/festa/multidao.js';
import { resultadoDoRobo } from '../src/festa/rodada.js';

const ANA = 1;
const BIA = 2;
const CAIO = 3;

test('multidao: o bicho escondido é uma das opções, e só vai quando o primeiro coelho sai', () => {
  for (let s = 1; s <= 20; s++) {
    const r = rodadaDeTeste('multidao', { aleatorio: sorteioFixo(s) });
    const antes = r.rodada.publico(ANA).dados as DadosMultidao;
    assert.equal(antes.bicho, -1);
    assert.equal(antes.saidas.length, TURMA);
    assert.equal(new Set(antes.opcoes).size, OPCOES);
    assert.equal(Math.min(...antes.saidas), PRIMEIRA_SAIDA_MS);
    assert.ok(Math.max(...antes.saidas) < MULTIDAO_MS - 1000, 'a turma inteira sai antes do fim');
    r.andar();
    const d = r.rodada.publico(ANA).dados as DadosMultidao;
    assert.ok(d.opcoes.includes(d.bicho));
  }
});

test('multidao: quem acerta antes ganha; quem errou não pontua', () => {
  const r = rodadaDeTeste('multidao', { rede: new Map([[ANA, 200], [BIA, 300], [CAIO, 250]]) });
  r.andar();
  const d = r.rodada.publico(ANA).dados as DadosMultidao;
  const errado = d.opcoes.find((o) => o !== d.bicho)!;
  r.em(3000 + 250);
  r.rodada.acao(CAIO, { tipo: 'resultado', bicho: errado, t: 3000 });
  r.em(4200 + 200);
  r.rodada.acao(ANA, { tipo: 'resultado', bicho: d.bicho, t: 4200 });
  r.em(6000 + 300);
  r.rodada.acao(BIA, { tipo: 'resultado', bicho: d.bicho, t: 6000 });
  assert.deepEqual(r.linhas().map((l) => [l.userId, l.posicao]), [
    [ANA, 1],
    [BIA, 2],
    [CAIO, null],
  ]);
  assert.equal(r.linhaDe(CAIO).motivo, 'errou');
  assert.equal(r.rodada.publico(ANA).resposta, d.bicho);
});

test('multidao: antes do primeiro coelho sair, fora das opções, ou com o tempo encurtado, não vale', () => {
  const r = rodadaDeTeste('multidao');
  r.em(500);
  r.rodada.acao(ANA, { tipo: 'resultado', bicho: 0, t: 500 });
  assert.equal(r.rodada.publico(ANA).meu?.motivo, 'invalido', 'o bicho ainda não tinha aparecido');
  r.andar();
  const d = r.rodada.publico(BIA).dados as DadosMultidao;
  r.em(8000);
  r.rodada.acao(BIA, { tipo: 'resultado', bicho: d.bicho, t: 1500 });
  assert.equal(r.rodada.publico(BIA).meu?.motivo, 'invalido', 'escolheu aos 8 s e disse 1,5 s');
  const s = rodadaDeTeste('multidao', { aleatorio: sorteioFixo(9) });
  s.andar();
  const fora = [0, 1, 2, 3, 4, 5, 6, 7].find((b) => !(s.rodada.publico(ANA).dados as DadosMultidao).opcoes.includes(b));
  s.em(3000);
  s.rodada.acao(ANA, { tipo: 'resultado', bicho: fora, t: 2900 });
  assert.equal(s.rodada.publico(ANA).meu?.motivo, 'invalido');
});

test('multidao: o robô espera alguns coelhos saírem, e nunca responde depois do tempo', () => {
  const r = rodadaDeTeste('multidao');
  const dados = r.rodada.publico(ANA).dados;
  for (let k = 0; k < 200; k++) {
    const rob = resultadoDoRobo('multidao', dados, Math.random, 5000);
    if (rob.motivo === null) assert.ok((rob.valor ?? 0) >= PRIMEIRA_SAIDA_MS + 300 && (rob.valor ?? 0) <= 5000);
  }
});
