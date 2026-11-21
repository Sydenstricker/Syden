/**
 * A Palavra secreta (14/10/2026): as cores do chute, as duas listas de palavras e a corrida, com um contexto de
 * mentira no lugar da sala (o relógio é chamado à mão).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { _teste, CHUTES, cores, palavra, RODADAS_PALAVRA, semAcento, SORTEIO, valida } from '../src/minijogo-palavra.js';

test('Palavra secreta: as cores contam a letra repetida como o Termo', () => {
  assert.deepEqual(cores('termo', 'termo'), [2, 2, 2, 2, 2]);
  assert.deepEqual(cores('arara', 'parto'), [1, 1, 0, 0, 0], 'o segundo A não sobra na palavra');
  assert.deepEqual(cores('ossos', 'sabor'), [0, 1, 0, 2, 0], 'só um S sobra');
  assert.deepEqual(cores('aaaaa', 'casal'), [0, 2, 0, 2, 0], 'os verdes contam primeiro');
});

test('Palavra secreta: toda palavra que pode sair também pode ser chutada, sem acento', () => {
  assert.ok(SORTEIO.length >= 300);
  assert.equal(new Set(SORTEIO).size, SORTEIO.length);
  for (const p of SORTEIO) {
    const chave = semAcento(p).replace(/ç/g, 'c');
    assert.match(chave, /^[a-z]{5}$/, p);
    assert.ok(valida(chave), p);
  }
  assert.ok(valida('aviao') && valida('fazer') && !valida('xkcdz'));
});

function sala(ids: number[]) {
  let relogio: (() => void) | null = null;
  let terminou = false;
  const ctx: Contexto = {
    agendar: (_ms, depois) => void (relogio = depois),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => ids,
    nome: (id) => `p${id}`,
  };
  return { ctx, disparar: () => relogio?.(), terminou: () => terminou };
}

test('Palavra secreta: a corrida — os outros veem as cores, nunca as letras, até a revelação', () => {
  _teste.palavras = ['avião', 'fazer', 'termo'];
  const s = sala([1, 2]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: {} });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  type Visto = {
    rodada: number;
    fase: string;
    palavra: string | null;
    acertei: boolean;
    meu: { texto: string; cores: number[] }[];
    outros: { userId: number; cores: number[][]; letras: string[] | null }[];
    placar: { userId: number; pontos: number }[];
  };
  const ver = (quem: number) => jogo.publico(quem) as Visto;

  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'abc' }), 'Escreva uma palavra de 5 letras.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'xkcdz' }), 'Essa palavra não está na lista.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'FAZER' }), null);
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'aviao' }), null, 'sem acento vale');
  assert.equal(ver(1).meu[1].texto, 'avião', 'e a tela mostra com acento');
  assert.ok(ver(1).acertei);
  const dele = ver(2).outros.find((o) => o.userId === 1)!;
  assert.deepEqual(dele.cores[1], [2, 2, 2, 2, 2]);
  assert.equal(dele.letras, null, 'as letras dos outros ficam escondidas');
  assert.equal(ver(2).palavra, null);

  // O 2 gasta os 6 chutes: todo mundo terminou, e a palavra aparece na hora.
  // (seis palavras diferentes: o mesmo chute duas vezes não conta, desde 16/10/2026)
  for (const p of SORTEIO.filter((x) => semAcento(x) !== 'aviao').slice(0, CHUTES)) assert.equal(jogo.acao(2, { tipo: 'chute', texto: p }), null);
  assert.equal(ver(2).fase, 'revelando');
  assert.equal(ver(2).palavra, 'avião');
  assert.deepEqual(ver(2).outros.find((o) => o.userId === 1)!.letras, ['fazer', 'avião']);
  // Acertou no 2º chute: 7 − 2 = 5, e +1 por ser o primeiro.
  assert.equal(ver(1).placar.find((l) => l.userId === 1)!.pontos, 6);
  assert.equal(ver(1).placar.find((l) => l.userId === 2)!.pontos, 0);

  s.disparar(); // a rodada 2
  assert.equal(ver(1).rodada, 2);
  assert.equal(ver(1).meu.length, 0, 'quadro novo');
  s.disparar(); // o tempo acabou: revela
  assert.equal(ver(1).palavra, 'fazer');
  s.disparar(); // a rodada 3
  assert.equal(ver(1).rodada, RODADAS_PALAVRA);
  s.disparar();
  s.disparar();
  assert.ok(s.terminou());
});

test('Palavra secreta de 4 e de 6 letras (21/11/2026): listas próprias, conferidas contra o VERO', async () => {
  const { DICIONARIOS, TAMANHOS } = await import('../src/minijogo-palavra.js');
  for (const n of TAMANHOS) {
    const { sorteio } = DICIONARIOS[n];
    assert.ok(sorteio.length >= 250, `${n} letras: ${sorteio.length}`);
    assert.equal(new Set(sorteio).size, sorteio.length, `${n}: sem repetidas`);
    for (const p of sorteio) {
      const chave = semAcento(p).replace(/ç/g, 'c');
      assert.match(chave, new RegExp(`^[a-z]{${n}}$`), p);
      assert.ok(valida(chave, n), `${p} está no VERO de ${n} letras`);
    }
  }
  assert.ok(valida('amor', 4) && !valida('amor') && valida('janela', 6) && !valida('janela', 4));
  // as cores e o modo difícil valem para qualquer tamanho
  assert.deepEqual(cores('amor', 'roma'), [1, 1, 1, 1]);
  assert.deepEqual(cores('janela', 'canela'), [0, 2, 2, 2, 2, 2]);
});

test('Palavra secreta de 4 e de 6: a largada escolhe, o servidor confere o tamanho', () => {
  _teste.palavras = ['amor'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { letras: 4 } });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  const ver = () => jogo.publico(1) as { letras: number; largada: { letras: number }; meu: { texto: string; cores: number[] }[]; acertei: boolean };
  assert.equal(ver().letras, 4);
  assert.equal(ver().largada.letras, 4, '"Jogar de novo" repete o tamanho');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'termo' }), 'Escreva uma palavra de 4 letras.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'roma' }), null);
  assert.deepEqual(ver().meu[0].cores, [1, 1, 1, 1]);
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'amor' }), null);
  assert.ok(ver().acertei);
  // tamanho fora da lista: a de 5, a de fábrica
  const outro = palavra.comecar(sala([1]).ctx, { naSala: [1], criadaPor: 1, corpo: { letras: 9 } });
  assert.ok(typeof outro !== 'string');
  assert.equal((outro.publico(1) as { letras: number }).letras, 5);
});
