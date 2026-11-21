/**
 * O Sudoku cooperativo (21/11/2026, minijogo-sudoku.ts): a turma no MESMO tabuleiro, cada casa com quem a preencheu, a casa
 * certa que trava no "conferir na hora", o "conferir no fim" da turma, e o fim quando o tabuleiro fecha. No Solo, o pedido de
 * cooperativo vira a corrida de sempre.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Contexto, Jogo } from '../src/minijogo-motor.js';
import { sudoku } from '../src/minijogo-sudoku.js';

function sala(ids: number[], solo = false) {
  let terminou = false;
  const ctx: Contexto = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => ids,
    nome: (id) => `p${id}`,
    solo,
  };
  return { ctx, terminou: () => terminou };
}

/** Resolve um sudoku (o teste precisa da resposta, que o servidor nunca manda). */
function resolver(grade: number[]): number[] {
  const g = [...grade];
  const cabe = (i: number, d: number) => {
    const l = Math.floor(i / 9);
    const c = i % 9;
    for (let j = 0; j < 81; j++) {
      const lj = Math.floor(j / 9);
      const cj = j % 9;
      const mesmoBloco = Math.floor(l / 3) === Math.floor(lj / 3) && Math.floor(c / 3) === Math.floor(cj / 3);
      if (g[j] === d && (lj === l || cj === c || mesmoBloco)) return false;
    }
    return true;
  };
  const ir = (): boolean => {
    const i = g.indexOf(0);
    if (i < 0) return true;
    for (let d = 1; d <= 9; d++) {
      if (!cabe(i, d)) continue;
      g[i] = d;
      if (ir()) return true;
    }
    g[i] = 0;
    return false;
  };
  ir();
  return g;
}

type Estado = {
  juntos?: boolean;
  enigma: number[];
  meu: number[];
  autores?: (number | null)[];
  errados: number[];
  total: number;
  turma?: { certas: number; tempoMs: number | null };
  corrida: { userId: number; certas: number; erros: number; tempoMs: number | null }[];
  largada: Record<string, unknown>;
  penalidadeMs: number;
};

test('o cooperativo: o mesmo tabuleiro para todos, com quem preencheu cada casa, e a certa trava', () => {
  const s = sala([1, 2, 3]);
  const jogo = sudoku.comecar(s.ctx, { naSala: [1, 2, 3], criadaPor: 1, corpo: { dificuldade: 'facil', modo: 'juntos' } }) as Jogo;
  const e = (q: number) => jogo.publico(q) as unknown as Estado;
  assert.equal(e(1).juntos, true);
  assert.equal(e(1).largada.modo, 'juntos', 'o "Jogar de novo" repete o modo');
  const solucao = resolver(e(1).enigma);
  const livres = e(1).enigma.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
  const [a, b] = livres;
  // a Ana acerta uma casa: o Bia e o Caio a veem, com a autora
  assert.equal(jogo.acao(1, { tipo: 'jogada', casa: a, valor: solucao[a] }), null);
  for (const q of [2, 3, 99]) {
    assert.equal(e(q).meu[a], solucao[a]);
    assert.equal(e(q).autores![a], 1);
  }
  // a certa trava: ninguém apaga o acerto de ninguém
  assert.equal(jogo.acao(2, { tipo: 'jogada', casa: a, valor: 0 }), 'Essa casa já está certa.');
  // o Bia erra: a casa fica vermelha para todos, e o erro é dele
  const errado = (solucao[b] % 9) + 1;
  assert.equal(jogo.acao(2, { tipo: 'jogada', casa: b, valor: errado }), null);
  assert.ok(e(3).errados.includes(b));
  assert.equal(e(1).corrida.find((l) => l.userId === 2)!.erros, 1);
  // o Caio conserta a casa do Bia
  assert.equal(jogo.acao(3, { tipo: 'jogada', casa: b, valor: solucao[b] }), null);
  assert.equal(e(1).autores![b], 3);
  assert.ok(!e(1).errados.includes(b));
  assert.equal(e(1).turma!.certas, 2);
  assert.deepEqual(
    e(1).corrida.filter((l) => l.certas > 0).map((l) => [l.userId, l.certas]).sort(),
    [
      [1, 1],
      [3, 1],
    ],
  );
  // a turma fecha o resto (alguém que entrou depois também ajuda) e a partida acaba, com o tempo da turma
  livres.slice(2).forEach((i, k) => assert.equal(jogo.acao([1, 2, 3, 4][k % 4], { tipo: 'jogada', casa: i, valor: solucao[i] }), null));
  assert.equal(s.terminou(), true);
  assert.ok(e(1).turma!.tempoMs !== null);
  assert.ok(e(1).corrida.some((l) => l.userId === 4 && l.certas > 0));
  assert.equal(jogo.acao(1, { tipo: 'jogada', casa: a, valor: 1 }), 'A partida acabou.');
});

test('o cooperativo de conferir no fim: qualquer um confere, o erro é de quem pôs, e a penalidade é da turma', () => {
  const s = sala([1, 2]);
  const jogo = sudoku.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { dificuldade: 'facil', conferencia: 'fim', modo: 'juntos' } }) as Jogo;
  const e = () => jogo.publico(1) as unknown as Estado;
  const solucao = resolver(e().enigma);
  const livres = e().enigma.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
  assert.equal(jogo.acao(2, { tipo: 'conferir' }), 'Preencha todas as casas antes de conferir.');
  const errada = livres[0];
  livres.forEach((i, k) => jogo.acao(k % 2 ? 2 : 1, { tipo: 'jogada', casa: i, valor: i === errada ? (solucao[i] % 9) + 1 : solucao[i] }));
  assert.deepEqual(e().errados, [], 'no "no fim", nada fica vermelho antes de conferir');
  assert.equal(jogo.acao(2, { tipo: 'conferir' }), null);
  assert.deepEqual(e().errados, [errada]);
  assert.equal(e().corrida.find((l) => l.userId === 1)!.erros, 1, 'a errada era da Ana');
  assert.ok(e().penalidadeMs > 0);
  assert.equal(s.terminou(), false);
  jogo.acao(2, { tipo: 'jogada', casa: errada, valor: solucao[errada] });
  assert.equal(jogo.acao(1, { tipo: 'conferir' }), null);
  assert.equal(s.terminou(), true);
});

test('no Solo, o cooperativo é a corrida de sempre', () => {
  const s = sala([1], true);
  const jogo = sudoku.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { dificuldade: 'facil', modo: 'juntos' } }) as Jogo;
  assert.equal((jogo.publico(1) as unknown as Estado).juntos, undefined);
});
