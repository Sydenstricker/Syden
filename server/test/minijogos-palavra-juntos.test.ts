/**
 * A Palavra secreta, modo Juntos (27/11/2026): a turma num quadro só, como o Termo individual. Todo chute vale para todos,
 * as letras aparecem para a turma inteira, e os pontos são da turma.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { _teste, palavra } from '../src/minijogo-palavra.js';

function sala(ids: number[], solo = false) {
  let relogio: (() => void) | null = null;
  const ctx: Contexto = {
    agendar: (_ms, depois) => void (relogio = depois),
    avisar: () => {},
    terminar: () => {},
    naSala: () => ids,
    nome: (id) => `p${id}`,
    solo,
  };
  return { ctx, disparar: () => relogio?.() };
}

type Visto = {
  fase: string;
  juntos?: boolean;
  acertei: boolean;
  meu: { texto: string; autor: number | null; autorNome: string }[];
  outros: unknown[];
  placar: { userId: number; pontos: number }[];
};

function comecar(solo = false, corpo: Record<string, unknown> = { juntos: true }) {
  _teste.palavras = ['avião', 'fazer', 'termo'];
  const s = sala([1, 2], solo);
  const jogo = palavra.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  return { jogo, ver: (quem: number) => jogo.publico(quem) as Visto, s };
}

test('Palavra Juntos: o chute de um aparece no quadro do outro, com as letras e o autor', () => {
  const { jogo, ver } = comecar();
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), null);
  for (const quem of [1, 2]) {
    const v = ver(quem);
    assert.equal(v.juntos, true);
    assert.equal(v.meu.length, 1);
    assert.equal(v.meu[0].texto, 'fazer');
    assert.equal(v.meu[0].autor, 1);
    assert.equal(v.meu[0].autorNome, 'p1');
    assert.deepEqual(v.outros, []);
  }
  assert.equal(jogo.acao(2, { tipo: 'chute', texto: 'fazer' }), 'A turma já chutou essa palavra.');
  assert.equal(ver(2).meu.length, 1, 'o repetido não gasta chute da turma');
});

test('Palavra Juntos: a turma acerta junto, e os pontos são de todos', () => {
  const { jogo, ver } = comecar();
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), null);
  assert.equal(jogo.acao(2, { tipo: 'chute', texto: 'avião' }), null);
  const v = ver(1);
  assert.equal(v.acertei, true);
  assert.equal(v.fase, 'revelando');
  const [a, b] = v.placar;
  assert.equal(a.pontos, b.pontos, 'ninguém ganha da turma');
  assert.ok(a.pontos > 0);
  // quem chutou tarde não passa de 6 chutes no total da turma
});

test('Palavra Juntos: os seis chutes são da turma toda', () => {
  const { jogo, ver } = comecar();
  const erradas = ['fazer', 'termo', 'ouvir', 'sabor', 'carro', 'porto'];
  erradas.forEach((p, i) => assert.equal(jogo.acao(i % 2 === 0 ? 1 : 2, { tipo: 'chute', texto: p }), null, p));
  const v = ver(1);
  assert.equal(v.meu.length, 6);
  assert.equal(v.fase, 'revelando');
  assert.equal(v.acertei, false);
});

test('Palavra Juntos: sozinho é o Solo de sempre, e sem o pedido a corrida segue igual', () => {
  const solo = comecar(true);
  assert.equal(solo.ver(1).juntos, undefined);
  const corrida = comecar(false, {});
  assert.equal(corrida.ver(1).juntos, undefined);
  assert.equal(corrida.jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), null);
  assert.equal(corrida.ver(2).meu.length, 0, 'na corrida o quadro é de cada um');
});
