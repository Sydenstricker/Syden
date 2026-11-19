/**
 * Os jogos de palavra depois da auditoria de 19/11/2026: as dificuldades e o "conferir no fim" do Sudoku, as escolhas do Stop,
 * o dueto e o modo difícil da Palavra secreta, o balde, o pular e a lista da turma do desenho, as pistas do quiz, e os
 * recordes do Solo na tabela comum (com o valor que o servidor calculou).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Contexto } from '../src/minijogo-motor.js';
import { criarConta, comToken, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const { DIFICULDADES, gerarSudoku, contarSolucoes, sudoku, PENALIDADE_MS } = await import('../src/minijogo-sudoku.js');
const { categoriasDaPartida, stop, CATEGORIAS } = await import('../src/minijogo-stop.js');
const { palavra, _teste, respeitaAsDicas, _sequencias } = await import('../src/minijogo-palavra.js');
const { desenho, BALDE, BALDES_POR_DESENHO } = await import('../src/minijogo-desenho.js');
const { nivelDoDesenho } = await import('../src/desenho-palavras.js');
const { criarQuiz, TEMAS, _testeQuiz, PISTA_LETRA, PISTA_COLUNA, letraInicial } = await import('../src/minijogo-quiz.js');

const ana = await criarConta(app, 'ana-palavras');
const anaId = (await comToken(app, ana.token)('GET', '/api/me')).json().id as number;

/** Um contexto de mentira: o relógio é chamado à mão. */
function sala(ids: number[], solo = false) {
  let relogio: (() => void) | null = null;
  let terminou = false;
  const ctx: Contexto = {
    agendar: (_ms, depois) => void (relogio = depois),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => ids,
    nome: (id) => `p${id}`,
    solo,
  };
  return { ctx, disparar: () => relogio?.(), terminou: () => terminou };
}

/** O recorde é gravado depois de um import dinâmico: espera ele chegar. */
async function esperar(condicao: () => boolean) {
  for (let i = 0; i < 100 && !condicao(); i++) await new Promise((r) => setTimeout(r, 10));
  assert.ok(condicao(), 'demorou demais');
}

/** Resolve um sudoku (para o teste saber a resposta, que o servidor nunca manda). */
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

test('Sudoku: cada dificuldade tem as casas vazias dela, e a solução é única', () => {
  for (const [nome, vazias] of Object.entries(DIFICULDADES)) {
    const { enigma } = gerarSudoku(Math.random, vazias);
    assert.equal(enigma.filter((n) => n === 0).length, vazias, nome);
    assert.equal(contarSolucoes([...enigma]), 1, nome);
  }
});

type VistoSudoku = { enigma: number[]; errados: number[]; penalidadeMs: number; corrida: { userId: number; certas: number; tempoMs: number | null }[]; recorde: { novo: boolean; valor: number | null } | null };

test('Sudoku: no "conferir no fim" o erro não aparece na hora; Conferir mostra e soma a penalidade', () => {
  const s = sala([1]);
  const jogo = sudoku.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { dificuldade: 'facil', conferencia: 'fim' } });
  assert.ok(typeof jogo !== 'string');
  const ver = () => jogo.publico(1) as VistoSudoku;
  const solucao = resolver(ver().enigma);
  const vazias = ver().enigma.map((n, i) => (n === 0 ? i : -1)).filter((i) => i >= 0);
  assert.equal(vazias.length, 35);
  const errada = vazias[0];
  assert.equal(jogo.acao(1, { tipo: 'conferir' }), 'Preencha todas as casas antes de conferir.');
  for (const i of vazias) jogo.acao(1, { tipo: 'jogada', casa: i, valor: i === errada ? (solucao[i] % 9) + 1 : solucao[i] });
  assert.deepEqual(ver().errados, [], 'o errado não fica vermelho na hora');
  assert.equal(jogo.acao(1, { tipo: 'conferir' }), null);
  assert.deepEqual(ver().errados, [errada]);
  assert.equal(ver().penalidadeMs, PENALIDADE_MS);
  assert.equal(ver().corrida[0].tempoMs, null, 'com erro, não terminou');
  jogo.acao(1, { tipo: 'jogada', casa: errada, valor: solucao[errada] });
  assert.equal(jogo.acao(1, { tipo: 'conferir' }), null);
  assert.ok(ver().corrida[0].tempoMs! >= PENALIDADE_MS, 'o tempo leva a penalidade');
  assert.ok(s.terminou());
});

test('Sudoku no Solo: o recorde por dificuldade vai à tabela comum, com o tempo do servidor', async () => {
  const s = sala([anaId], true);
  const jogo = sudoku.comecar(s.ctx, { naSala: [anaId], criadaPor: anaId, corpo: { dificuldade: 'facil' } });
  assert.ok(typeof jogo !== 'string');
  const ver = () => jogo.publico(anaId) as VistoSudoku;
  const solucao = resolver(ver().enigma);
  ver().enigma.forEach((n, i) => n === 0 && jogo.acao(anaId, { tipo: 'jogada', casa: i, valor: solucao[i] }));
  await esperar(() => ver().recorde?.novo === true);
  const r = db.recordeDoSolo(anaId, 'sudoku', 'facil');
  assert.ok(r && r.valor === ver().corrida[0].tempoMs, 'o valor é o tempo que o servidor mediu');
});

test('Stop: as categorias escolhidas, as livres com "#", e os limites', () => {
  assert.deepEqual(categoriasDaPartida({ categorias: ['animal', 'fruta', 'nao-existe'], livres: ['  Time   de futebol '] }), ['animal', 'fruta', '#Time de futebol']);
  assert.equal(categoriasDaPartida({ categorias: ['animal'] }), 'Escolha pelo menos 3 categorias.');
  assert.equal(categoriasDaPartida({ categorias: CATEGORIAS.slice(0, 13) }), 'Escolha no máximo 12 categorias.');
  const sorteadas = categoriasDaPartida({ livres: ['A', 'B'] }) as string[];
  assert.equal(sorteadas.length, 6, 'sem escolher, 4 sorteadas e as 2 livres');
  assert.ok(CATEGORIAS.length >= 40 && CATEGORIAS.length <= 60 && new Set(CATEGORIAS).size === CATEGORIAS.length);
});

test('Stop: rodadas, tempo e letras excluídas de quem começa', () => {
  const s = sala([1, 2]);
  assert.equal(stop.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { letras: 'ABC', excluir: 'ab', rodadas: 2 } }), 'Faltam letras para sortear.');
  const jogo = stop.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { letras: 'ABCD', excluir: 'a', rodadas: 2, tempoMs: 60_000, categorias: ['cor', 'animal', 'fruta'] } });
  assert.ok(typeof jogo !== 'string');
  const v = jogo.publico(1) as { rodadas: number; tempoMs: number; letra: string; categorias: string[] };
  assert.equal(v.rodadas, 2);
  assert.equal(v.tempoMs, 60_000);
  assert.notEqual(v.letra, 'A');
  assert.deepEqual(v.categorias, ['cor', 'animal', 'fruta']);
});

type VistoPalavra = { meu: { coresTodas: number[][] }[]; resolvidas: (number | null)[]; acertei: boolean; fase: string; palavrasReveladas: string[] | null; sequencia: { atual: number; recorde: number | null; novo: boolean } | null };

test('Palavra secreta: o modo difícil exige as letras reveladas', () => {
  assert.ok(respeitaAsDicas('termo', [{ chave: 'terra', cores: [2, 2, 2, 0, 0] }]));
  assert.ok(!respeitaAsDicas('fazer', [{ chave: 'terra', cores: [2, 0, 0, 0, 0] }]), 'o verde fora do lugar');
  assert.ok(!respeitaAsDicas('fazer', [{ chave: 'boato', cores: [0, 0, 0, 0, 1] }]), 'o amarelo que sumiu');
  _teste.palavras = ['termo', 'fazer', 'campo'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { dificil: true } });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'terra' }), null);
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'fazer' }), 'No modo difícil, use as letras já reveladas.');
  assert.equal(jogo.acao(1, { tipo: 'chute', texto: 'termo' }), null);
});

test('Palavra secreta: o dueto — um chute vale para as duas, e cada uma acertada vale ponto', () => {
  _teste.palavras = ['termo', 'avião', 'fazer', 'campo', 'casal', 'barco'];
  const s = sala([1]);
  const jogo = palavra.comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: { modo: 'dueto' } });
  _teste.palavras = null;
  assert.ok(typeof jogo !== 'string');
  const ver = () => jogo.publico(1) as VistoPalavra;
  jogo.acao(1, { tipo: 'chute', texto: 'aviao' });
  assert.deepEqual(ver().resolvidas, [null, 1]);
  assert.equal(ver().meu[0].coresTodas.length, 2);
  jogo.acao(1, { tipo: 'chute', texto: 'termo' });
  assert.deepEqual(ver().meu[1].coresTodas[1], [], 'a palavra já acertada não ganha cores');
  assert.ok(ver().acertei);
  assert.equal(ver().fase, 'revelando');
  assert.deepEqual(ver().palavrasReveladas, ['termo', 'avião'], 'com acento');
});

test('Palavra secreta no Solo: uma palavra, a sequência da sessão e o recorde na tabela comum', async () => {
  _sequencias.clear();
  for (let vez = 1; vez <= 2; vez++) {
    _teste.palavras = ['termo'];
    const s = sala([anaId], true);
    const jogo = palavra.comecar(s.ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
    _teste.palavras = null;
    assert.ok(typeof jogo !== 'string');
    jogo.acao(anaId, { tipo: 'chute', texto: 'termo' });
    const v = jogo.publico(anaId) as VistoPalavra;
    assert.equal(v.sequencia!.atual, vez);
    await esperar(() => (jogo.publico(anaId) as VistoPalavra).sequencia!.novo);
    s.disparar();
    assert.ok(s.terminou(), 'no Solo, uma rodada só');
  }
  assert.equal(db.recordeDoSolo(anaId, 'palavra', 'normal')?.valor, 2);
});

test('Desenho: as três opções são uma fácil, uma média e uma difícil; o acerto da difícil vale mais', () => {
  const s = sala([1, 2]);
  const jogo = desenho.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const quem = (jogo.publico(1) as { quemDesenha: number }).quemDesenha;
  const v = jogo.publico(quem) as { opcoes: string[]; niveis: number[] };
  assert.deepEqual(v.niveis, [1, 2, 3]);
  assert.deepEqual(v.opcoes.map(nivelDoDesenho), [1, 2, 3]);
  jogo.acao(quem, { tipo: 'escolher', id: v.opcoes[2], texto: 'Palavra Difícil' });
  const outro = quem === 1 ? 2 : 1;
  jogo.acao(outro, { tipo: 'chute', texto: 'palavra dificil' });
  const placar = (jogo.publico(1) as { placar: { userId: number; pontos: number }[] }).placar;
  assert.ok(placar.find((l) => l.userId === outro)!.pontos > 100, 'com o bônus de 50%');
  assert.equal(placar.find((l) => l.userId === quem)!.pontos, Math.round(25 * 1.5));
});

test('Desenho: o balde é um traço de um ponto só, com teto por desenho', () => {
  const s = sala([1, 2]);
  const jogo = desenho.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const quem = (jogo.publico(1) as { quemDesenha: number }).quemDesenha;
  const v = jogo.publico(quem) as { opcoes: string[] };
  jogo.acao(quem, { tipo: 'escolher', id: v.opcoes[0], texto: 'x' });
  assert.notEqual(jogo.tempoReal!(quem, { t: 1, i: 0, c: 3, e: BALDE, p: [500, 300] }), null);
  assert.equal(jogo.tempoReal!(quem, { t: 2, i: 0, c: 3, e: BALDE, p: [500, 300, 10, 10] }), null, 'balde com dois pontos');
  assert.equal(jogo.tempoReal!(quem, { t: 3, i: 0, c: 3, e: 7, p: [1, 1] }), null, 'espessura que não existe');
  for (let k = 0; k < BALDES_POR_DESENHO + 5; k++) jogo.tempoReal!(quem, { t: 10 + k, i: 0, c: 3, e: BALDE, p: [1, 1] });
  const baldes = (jogo.publico(1) as { tracos: { e: number }[] }).tracos.filter((t) => t.e === BALDE).length;
  assert.equal(baldes, BALDES_POR_DESENHO);
});

test('Desenho: mais da metade de quem chuta vota, e o desenho é pulado', () => {
  const s = sala([1, 2, 3]);
  const jogo = desenho.comecar(s.ctx, { naSala: [1, 2, 3], criadaPor: 1, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const quem = (jogo.publico(1) as { quemDesenha: number }).quemDesenha;
  const v = jogo.publico(quem) as { opcoes: string[] };
  jogo.acao(quem, { tipo: 'escolher', id: v.opcoes[0], texto: 'x' });
  const [a, b] = [1, 2, 3].filter((id) => id !== quem);
  assert.equal(jogo.acao(quem, { tipo: 'pular' }), 'Quem desenha não vota para pular.');
  jogo.acao(a, { tipo: 'pular' });
  assert.equal((jogo.publico(1) as { fase: string }).fase, 'desenhando', 'metade não basta');
  jogo.acao(b, { tipo: 'pular' });
  assert.equal((jogo.publico(1) as { fase: string }).fase, 'revelando');
});

test('Desenho: a lista da turma, sozinha, dá as opções e a palavra como foi escrita', () => {
  const s = sala([1, 2]);
  assert.equal(desenho.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { lista: ['a', 'b'], soLista: true } }), 'A lista precisa de pelo menos 3 palavras.');
  const jogo = desenho.comecar(s.ctx, { naSala: [1, 2], criadaPor: 1, corpo: { lista: ['Nosso grupo', 'Pão de batata', 'Gato do Léo'], soLista: true } });
  assert.ok(typeof jogo !== 'string');
  const quem = (jogo.publico(1) as { quemDesenha: number }).quemDesenha;
  const v = jogo.publico(quem) as { opcoes: string[] };
  assert.ok(v.opcoes.every((o) => o.startsWith('#')));
  jogo.acao(quem, { tipo: 'escolher', id: '#Gato do Léo', texto: 'outra coisa' });
  if (!v.opcoes.includes('#Gato do Léo')) return;
  assert.equal((jogo.publico(quem) as { palavra: { texto: string } }).palavra.texto, 'Gato do Léo');
  jogo.acao(quem === 1 ? 2 : 1, { tipo: 'chute', texto: 'gato do leo' });
  assert.equal((jogo.publico(1) as { fase: string }).fase, 'revelando');
});

type VistoQuiz = { pistas: { letra: string | null; coluna: { id: string; valor: unknown } | null }; recorde: { novo: boolean } | null };

test('Quiz: a letra depois de 5 chutes, a coluna depois de 10', () => {
  _testeQuiz.itens = ['adult-red-dragon', 'aboleth', 'lich'];
  const s = sala([1]);
  const jogo = criarQuiz(TEMAS.monstros).comecar(s.ctx, { naSala: [1], criadaPor: 1, corpo: {} });
  _testeQuiz.itens = null;
  assert.ok(typeof jogo !== 'string');
  const outros = TEMAS.monstros.itens.map((i) => i.id).filter((id) => id !== 'adult-red-dragon');
  for (let k = 0; k < PISTA_COLUNA; k++) {
    if (k === PISTA_LETRA) assert.equal((jogo.publico(1) as VistoQuiz).pistas.letra, 'A');
    jogo.acao(1, { tipo: 'chute', id: outros[k], idioma: 'pt-BR' });
  }
  assert.deepEqual((jogo.publico(1) as VistoQuiz).pistas.coluna, { id: 'tipo', valor: 'dragon' });
  assert.equal(letraInicial(TEMAS.paises, TEMAS.paises.itens.find((p) => p.id === 'BR')!, 'pt-BR'), 'B');
});

test('Quiz no Solo: os chutes das três rodadas viram o recorde do tema', async () => {
  _testeQuiz.itens = ['BR', 'FR', 'JP'];
  const s = sala([anaId], true);
  const jogo = criarQuiz(TEMAS.paises).comecar(s.ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  _testeQuiz.itens = null;
  assert.ok(typeof jogo !== 'string');
  for (const id of ['BR', 'FR', 'JP']) {
    if (id === 'FR') jogo.acao(anaId, { tipo: 'chute', id: 'DE' });
    jogo.acao(anaId, { tipo: 'chute', id });
    s.disparar();
  }
  await esperar(() => (jogo.publico(anaId) as VistoQuiz).recorde?.novo === true);
  assert.equal(db.recordeDoSolo(anaId, 'paises', '')?.valor, 4);
});
