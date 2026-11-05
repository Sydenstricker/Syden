/**
 * O Dominó (minijogo-domino.ts): a distribuição, quem começa, o encaixe nas pontas, a compra, o passe, a batida e o
 * trancado (individual e em duplas), a partida até 50, o relógio que joga por quem demora ou saiu, e o que cada um vê.
 * O relógio e as mãos aqui são de mão.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarDomino, PONTOS_PARA_VENCER, TEMPO_DA_VEZ, TEMPO_DO_AUSENTE, TEMPO_DO_RESULTADO, todasAsPedras, type OpcoesDoDomino, type Pedra } from '../src/minijogo-domino.js';

type Lugar = { userId: number; username: string; lado: number; pedras: number; presente: boolean };
type Estado = {
  fase: string;
  duplas: boolean;
  mao: number;
  lugares: Lugar[];
  minhaMao: Pedra[];
  mesa: Pedra[];
  pontas: { esquerda: number; direita: number } | null;
  dorme: number;
  vez: number | null;
  obrigatoria: Pedra | null;
  jogaveis: { pedra: Pedra; pontas: (string | null)[] }[];
  devoComprar: boolean;
  possoPassar: boolean;
  placar: { lado: number; membros: number[]; pontos: number }[];
  ultimo: { tipo: string; userId?: number; pedra?: Pedra } | null;
  historico: { tipo: string; userId?: number }[];
  resultado: { tipo: string; userId: number | null; lado: number | null; pontos: number; maos: { userId: number; pedras: Pedra[]; soma: number }[] } | null;
  vencedor: { lado: number; membros: number[] } | null;
  interrompida: boolean;
  partidaId: string;
};

/** 0,9999 deixa o embaralhar como entrou: os lugares ficam na ordem da sala. */
const identidade = () => 0.9999;

function comecar({ ids = [1, 2], distribuir, aleatorio = identidade }: { ids?: number[]; distribuir?: OpcoesDoDomino['distribuir']; aleatorio?: () => number } = {}) {
  const sala = { ids: [...ids] };
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let completa: boolean | undefined;
  const ctx = {
    agendar: (ms: number, depois: () => void) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (c = true) => {
      terminou = true;
      completa = c;
    },
    naSala: () => sala.ids,
    nome: (id: number) => `p${id}`,
    comunidade: 7,
  };
  const jogo = criarDomino({ agora: () => 1000, aleatorio, distribuir }).comecar(ctx, { naSala: ids, criadaPor: ids[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    sala,
    relogio,
    terminou: () => terminou,
    completa: () => completa,
    estado: (quem = ids[0]) => jogo.publico(quem) as unknown as Estado,
    andar() {
      relogio[0].depois();
    },
  };
}

const P = (a: number, b: number): Pedra => [a, b];

test('a distribuição: 7 para cada um, o resto dorme com 2 e 3, nada dorme com 4; as duplas sentam frente a frente', () => {
  for (const [n, dorme] of [
    [2, 14],
    [3, 7],
    [4, 0],
  ] as const) {
    const ids = [1, 2, 3, 4].slice(0, n);
    const j = comecar({ ids, aleatorio: Math.random });
    const e = j.estado();
    assert.equal(e.dorme, dorme);
    assert.equal(e.minhaMao.length, 7);
    assert.equal(e.mesa.length, 0);
    for (const l of e.lugares) assert.equal(l.pedras, 7);
    assert.equal(e.duplas, n === 4);
    assert.deepEqual(new Set(e.lugares.map((l) => l.userId)), new Set(ids));
    if (n === 4) {
      assert.deepEqual(
        e.lugares.map((l) => l.lado),
        [0, 1, 0, 1],
      );
      assert.equal(e.placar.length, 2);
      assert.deepEqual(e.placar[0].membros, [e.lugares[0].userId, e.lugares[2].userId]);
    } else assert.equal(e.placar.length, n);
  }
});

test('quem começa: a dupla de seis; sem ela, a dupla mais alta; sem dupla, a pedra mais alta', () => {
  // a dupla de seis com o segundo
  let j = comecar({ distribuir: () => ({ maos: [[P(1, 2), P(5, 5)], [P(6, 6), P(0, 1)]], dorme: [P(3, 4)] }) });
  assert.equal(j.estado().vez, 2);
  assert.deepEqual(j.estado().obrigatoria, [6, 6]);
  assert.deepEqual(j.estado(2).jogaveis.map((x) => x.pedra), [[6, 6]]);
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [0, 1] }), 'A primeira pedra é outra.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [5, 5] }), 'Espere a sua vez.');
  // sem 6-6: a dupla mais alta
  j = comecar({ distribuir: () => ({ maos: [[P(1, 2), P(4, 4)], [P(5, 6), P(3, 3)]], dorme: [] }) });
  assert.equal(j.estado().vez, 1);
  assert.deepEqual(j.estado().obrigatoria, [4, 4]);
  // sem dupla: a mais alta pela soma, e depois pela metade maior (5-6 > 4-6)
  j = comecar({ distribuir: () => ({ maos: [[P(1, 2), P(4, 6)], [P(5, 6), P(0, 3)]], dorme: [] }) });
  assert.equal(j.estado().vez, 2);
  assert.deepEqual(j.estado().obrigatoria, [5, 6]);
  j = comecar({ distribuir: () => ({ maos: [[P(2, 5), P(0, 1)], [P(3, 4), P(0, 2)]], dorme: [] }) });
  assert.equal(j.estado().vez, 1, 'empate na soma: a metade maior (5) vence');
});

test('o encaixe nas duas pontas, com a pedra virada, e a ponta pedida só quando o resultado muda', () => {
  const j = comecar({
    distribuir: () => ({
      maos: [
        [P(6, 6), P(2, 6), P(1, 1), P(0, 0)],
        [P(3, 6), P(2, 3), P(4, 5), P(0, 1)],
      ],
      dorme: [],
    }),
  });
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  assert.deepEqual(j.estado().pontas, { esquerda: 6, direita: 6 });
  // as duas pontas iguais: qualquer uma, sem pedir
  assert.deepEqual(j.estado(2).jogaveis, [{ pedra: [3, 6], pontas: ['direita'] }]);
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [6, 3], ponta: 'esquerda' }), null);
  assert.deepEqual(j.estado().mesa, [
    [3, 6],
    [6, 6],
  ]);
  assert.deepEqual(j.estado().pontas, { esquerda: 3, direita: 6 });
  // 2-6 serve só à direita (6): sem ponta vai à direita, virada para encaixar
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [2, 6], ponta: 'esquerda' }), 'Essa pedra não encaixa nessa ponta.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [2, 6] }), null);
  assert.deepEqual(j.estado().mesa, [
    [3, 6],
    [6, 6],
    [6, 2],
  ]);
  // 2-3 serve nas duas pontas (3 e 2) com resultados diferentes: pede a ponta
  assert.deepEqual(j.estado(2).jogaveis.find((x) => x.pedra[0] === 2)?.pontas, ['esquerda', 'direita']);
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [2, 3] }), 'Escolha a ponta.');
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [2, 3], ponta: 'esquerda' }), null);
  assert.deepEqual(j.estado().mesa[0], [2, 3]);
  assert.deepEqual(j.estado().pontas, { esquerda: 2, direita: 2 });
});

test('jogadas inválidas são recusadas', () => {
  const j = comecar({ distribuir: () => ({ maos: [[P(6, 6), P(1, 2), P(0, 0)], [P(0, 6), P(3, 4)]], dorme: [P(5, 5)] }) });
  assert.equal(j.jogo.acao(9, { tipo: 'jogar', pedra: [6, 6] }), 'Você está assistindo esta partida.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [5, 5] }), 'Essa pedra não está na sua mão.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [7, 1] }), 'Essa pedra não está na sua mão.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: 'x' }), 'Essa pedra não está na sua mão.');
  assert.equal(j.jogo.acao(1, { tipo: 'pular' }), 'Ação desconhecida.');
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [3, 4] }), 'Essa pedra não encaixa na mesa.');
  assert.equal(j.jogo.acao(2, { tipo: 'comprar' }), 'Você tem uma pedra que serve.');
  assert.equal(j.jogo.acao(2, { tipo: 'passar' }), 'Você tem uma pedra que serve.');
});

test('comprar até poder jogar; passar só sem pedra e sem nada para comprar (e o Syden passa sozinho)', () => {
  const j = comecar({
    distribuir: () => ({
      maos: [
        [P(6, 6), P(1, 6), P(2, 2)],
        [P(0, 1), P(3, 4), P(2, 3)],
        [P(1, 1), P(0, 0), P(4, 4)],
      ],
      dorme: [P(5, 6), P(0, 2), P(1, 5)],
    }),
    ids: [1, 2, 3],
  });
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  // o 2 não tem 6: tem de comprar
  let e = j.estado(2);
  assert.equal(e.devoComprar, true);
  assert.equal(e.possoPassar, false);
  assert.equal(j.jogo.acao(2, { tipo: 'passar' }), 'Compre uma pedra antes de passar.');
  assert.equal(j.jogo.acao(2, { tipo: 'comprar' }), null); // 1-5
  assert.equal(j.jogo.acao(2, { tipo: 'comprar' }), null); // 0-2
  assert.equal(j.estado(2).devoComprar, true);
  assert.equal(j.jogo.acao(2, { tipo: 'comprar' }), null); // 5-6, serve
  e = j.estado(2);
  assert.equal(e.devoComprar, false);
  assert.equal(e.dorme, 0);
  assert.equal(j.jogo.acao(2, { tipo: 'comprar' }), 'Você tem uma pedra que serve.');
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [5, 6] }), null);
  // pontas 6 e 5: o 3 (1-1, 0-0, 4-4) não pode jogar nem comprar, e passa sozinho; volta ao 1, que joga 1-6
  assert.equal(j.estado().vez, 1);
  assert.equal(j.estado().historico.at(-1)?.tipo, 'passou');
  assert.equal(j.estado().historico.at(-1)?.userId, 3);
  assert.equal(j.jogo.acao(3, { tipo: 'passar' }), 'Espere a sua vez.');
});

test('a batida, individual: quem bate leva a soma das mãos de todos os outros, e começa a próxima mão com qualquer pedra', () => {
  const j = comecar({
    ids: [1, 2, 3],
    distribuir: (n) =>
      n === 1
        ? { maos: [[P(6, 6), P(6, 1)], [P(6, 2), P(3, 4)], [P(0, 0), P(5, 5)]], dorme: [] }
        : { maos: [[P(0, 1), P(2, 2)], [P(1, 3), P(4, 4)], [P(1, 2), P(0, 5)]], dorme: [] },
  });
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  assert.equal(j.jogo.acao(2, { tipo: 'jogar', pedra: [6, 2] }), null);
  // o 3 passa sozinho (0-0, 5-5); o 1 joga 6-1 e bate
  assert.equal(j.estado().vez, 1);
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [1, 6] }), null);
  const e = j.estado(3);
  assert.equal(e.fase, 'resultado');
  assert.equal(e.resultado?.tipo, 'batida');
  assert.equal(e.resultado?.userId, 1);
  assert.equal(e.resultado?.pontos, 7 + 10);
  assert.deepEqual(e.resultado?.maos.find((m) => m.userId === 2)?.pedras, [[3, 4]]);
  assert.deepEqual(e.placar.map((p) => p.pontos), [17, 0, 0]);
  assert.equal(j.relogio[0].ms, TEMPO_DO_RESULTADO);
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [0, 1] }), 'Espere a próxima mão.');
  j.andar();
  const nova = j.estado();
  assert.equal(nova.fase, 'jogando');
  assert.equal(nova.mao, 2);
  assert.equal(nova.vez, 1);
  assert.equal(nova.obrigatoria, null);
  assert.equal(nova.resultado, null);
  assert.equal(nova.jogaveis.length, 2, 'na mesa vazia, qualquer pedra');
});

test('a batida em duplas: a dupla leva a soma das mãos dos dois adversários', () => {
  const j = comecar({
    ids: [1, 2, 3, 4],
    distribuir: () => ({ maos: [[P(6, 6), P(0, 0)], [P(1, 2), P(2, 2)], [P(6, 5), P(3, 3)], [P(4, 4), P(1, 1)]], dorme: [] }),
  });
  assert.equal(j.estado().duplas, true);
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  // o 2 e o 4 não podem; o 3 joga 6-5
  assert.equal(j.estado().vez, 3);
  assert.equal(j.jogo.acao(3, { tipo: 'jogar', pedra: [6, 5] }), null);
  // ninguém pode jogar (pontas 6 e 5): trancado. Lado 0 (1 e 3): 0 + 6 = 6; lado 1 (2 e 4): 7 + 10 = 17
  const e = j.estado();
  assert.equal(e.resultado?.tipo, 'trancado');
  assert.equal(e.resultado?.lado, 0);
  assert.equal(e.resultado?.pontos, 17);
  assert.equal(e.resultado?.userId, 1, 'da dupla, quem tem menos na mão começa a próxima');
  assert.deepEqual(e.placar.map((p) => p.pontos), [17, 0]);

  const b = comecar({
    ids: [1, 2, 3, 4],
    distribuir: () => ({ maos: [[P(6, 6), P(0, 0)], [P(6, 2), P(5, 5)], [P(3, 3)], [P(2, 1), P(4, 4)]], dorme: [] }),
  });
  b.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  b.jogo.acao(2, { tipo: 'jogar', pedra: [6, 2] });
  // o 3 passa (3-3); o 4 joga 2-1
  assert.equal(b.estado().vez, 4);
  b.jogo.acao(4, { tipo: 'jogar', pedra: [1, 2] });
  // pontas 6 e 1: o 1 (0-0) passa, o 2 (5-5) passa, o 3 passa, o 4 (4-4) passa → trancado: lado 0 = 0 + 6 = 6, lado 1 = 10 + 8 = 18
  assert.equal(b.estado().resultado?.tipo, 'trancado');
  assert.equal(b.estado().resultado?.lado, 0);

  const c = comecar({
    ids: [1, 2, 3, 4],
    distribuir: () => ({ maos: [[P(6, 6), P(6, 1)], [P(6, 2), P(5, 5)], [P(3, 3), P(0, 0)], [P(2, 0), P(4, 4)]], dorme: [] }),
  });
  c.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  c.jogo.acao(2, { tipo: 'jogar', pedra: [6, 2] });
  // o 3 (3-3, 0-0) não pode; o 4 joga 2-0
  c.jogo.acao(4, { tipo: 'jogar', pedra: [0, 2] });
  // o 1 joga 6-1 e bate: lado 0 leva a dos adversários (2: 10, 4: 8)
  c.jogo.acao(1, { tipo: 'jogar', pedra: [1, 6], ponta: 'esquerda' });
  const r = c.estado().resultado!;
  assert.equal(r.tipo, 'batida');
  assert.equal(r.lado, 0);
  assert.equal(r.pontos, 18, 'a mão do parceiro (3-3, 0-0) não conta');
});

test('o trancado individual: quem tem menos leva a soma dos outros; empatado, ninguém marca', () => {
  const j = comecar({
    ids: [1, 2],
    distribuir: (n) =>
      n === 1
        ? { maos: [[P(6, 6), P(1, 1)], [P(0, 0), P(2, 3)]], dorme: [] }
        : { maos: [[P(1, 1), P(0, 4)], [P(0, 0), P(2, 3)]], dorme: [] },
  });
  j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  let e = j.estado();
  assert.equal(e.resultado?.tipo, 'trancado');
  assert.equal(e.resultado?.userId, 1);
  assert.equal(e.resultado?.pontos, 5);
  assert.deepEqual(e.placar.map((p) => p.pontos), [5, 0]);
  j.andar();
  // a segunda mão começa com quem ganhou (1): joga 0-4; o 2 joga 0-0; o 1 (1-1) não pode, o 2 (2-3) não pode → trancado 2 x 5
  j.jogo.acao(1, { tipo: 'jogar', pedra: [0, 4] });
  j.jogo.acao(2, { tipo: 'jogar', pedra: [0, 0] });
  e = j.estado();
  assert.equal(e.resultado?.tipo, 'trancado');
  assert.equal(e.resultado?.userId, 1);
  // agora o empate: mãos de soma igual
  const t = comecar({ ids: [1, 2], distribuir: () => ({ maos: [[P(6, 6), P(1, 2)], [P(0, 3), P(0, 0)]], dorme: [] }) });
  t.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  const r = t.estado().resultado!;
  assert.equal(r.tipo, 'trancado');
  assert.equal(r.lado, null);
  assert.equal(r.pontos, 0);
  assert.deepEqual(t.estado().placar.map((p) => p.pontos), [0, 0]);
  t.andar();
  assert.equal(t.estado().vez, 1, 'no empate, começa quem começou');
});

test('a partida vai até 50: quem chega leva, e a partida termina completa', () => {
  const j = comecar({ ids: [1, 2], distribuir: () => ({ maos: [[P(6, 6)], [P(6, 5), P(5, 5), P(4, 4), P(4, 6)]], dorme: [] }) });
  // cada mão: o 1 bate com 6-6 e leva 11 + 10 + 8 + 10 = 39; na segunda, passa de 50
  j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  assert.equal(j.estado().placar[0].pontos, 39);
  assert.equal(j.estado().fase, 'resultado');
  j.andar();
  j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] });
  const e = j.estado(2);
  assert.ok(e.placar[0].pontos >= PONTOS_PARA_VENCER);
  assert.equal(e.fase, 'fim');
  assert.deepEqual(e.vencedor, { lado: 0, membros: [1] });
  assert.ok(e.resultado, 'no fim, as mãos à mostra');
  assert.equal(j.terminou(), true);
  assert.equal(j.completa(), true);
  assert.equal(j.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), 'A partida acabou.');
});

test('o tempo acaba: o Syden compra o que precisar e joga a pedra mais pesada que serve', () => {
  const j = comecar({
    distribuir: () => ({ maos: [[P(6, 6), P(0, 0)], [P(1, 2), P(1, 1)]], dorme: [P(0, 3), P(3, 6), P(2, 6)] }),
  });
  assert.equal(j.relogio[0].ms, TEMPO_DA_VEZ);
  j.andar(); // o 1 joga a obrigatória
  assert.equal(j.estado().mesa.length, 1);
  assert.equal(j.estado().vez, 2);
  j.andar(); // o 2 compra 2-6 e joga
  const e = j.estado();
  assert.equal(e.dorme, 2);
  assert.deepEqual(e.mesa.at(-1), [6, 2]);
  assert.equal(e.historico.filter((h) => h.tipo === 'comprou').length, 1);
});

test('quem saiu da sala tem a vez jogada em 2 s; com menos de 2 na sala, a partida acaba sem vencedor', () => {
  const j = comecar({ ids: [1, 2, 3], distribuir: () => ({ maos: [[P(6, 6), P(0, 2)], [P(6, 1), P(1, 1)], [P(6, 2), P(2, 2)]], dorme: [] }) });
  j.sala.ids = [2, 3];
  j.jogo.conferir!();
  assert.equal(j.relogio[0].ms, TEMPO_DO_AUSENTE);
  j.andar();
  assert.equal(j.estado().mesa.length, 1);
  assert.equal(j.estado().vez, 2);
  assert.equal(j.relogio[0].ms, TEMPO_DA_VEZ);
  j.jogo.acao(2, { tipo: 'jogar', pedra: [1, 6] });
  // a vez do 3, presente; depois a do 1 de novo, ausente: 2 s
  j.jogo.acao(3, { tipo: 'jogar', pedra: [2, 6] });
  assert.equal(j.estado().vez, 1);
  assert.equal(j.relogio[0].ms, TEMPO_DO_AUSENTE);
  j.sala.ids = [3];
  j.jogo.conferir!();
  assert.equal(j.terminou(), true);
  assert.equal(j.completa(), false);
  assert.equal(j.estado(3).interrompida, true);
  assert.equal(j.estado(3).vencedor, null);
});

test('em duplas, a partida segue com um parceiro fora, jogado pelo Syden', () => {
  const j = comecar({ ids: [1, 2, 3, 4], aleatorio: Math.random });
  const quem = j.estado().vez!;
  j.sala.ids = [1, 2, 3, 4].filter((id) => id !== quem);
  j.jogo.conferir!();
  assert.equal(j.terminou(), false);
  assert.equal(j.relogio[0].ms, TEMPO_DO_AUSENTE);
  j.andar();
  assert.equal(j.estado().mesa.length, 1);
  j.sala.ids = [j.sala.ids[0], j.sala.ids[1]];
  j.jogo.conferir!();
  assert.equal(j.terminou(), false, 'com 2 na sala, segue');
});

test('durante a mão, cada um vê só a própria mão; as dos outros só na revelação', () => {
  const j = comecar({ ids: [1, 2, 3], aleatorio: Math.random });
  for (const id of [1, 2, 3]) {
    const e = j.estado(id);
    const texto = JSON.stringify(e);
    assert.equal(e.resultado, null);
    // as pedras visíveis: a minha mão e a mesa; o total das outras é só uma contagem
    const minhas = new Set(e.minhaMao.map((p) => `${p[0]}-${p[1]}`));
    const conhecidas = new Set([...minhas, ...e.mesa.map((p) => `${Math.min(...p)}-${Math.max(...p)}`)]);
    assert.ok(conhecidas.size <= 8);
    assert.ok(!('maos' in e));
    assert.equal(e.lugares.find((l) => l.userId === id)?.pedras, e.minhaMao.length);
    assert.ok(!texto.includes('"maos"'));
  }
  // quem assiste não tem mão
  assert.deepEqual(j.estado(99).minhaMao, []);
  assert.deepEqual(j.estado(99).jogaveis, []);
});

test('as 28 pedras', () => {
  assert.equal(todasAsPedras().length, 28);
});

test('partidas inteiras jogadas pelo relógio, com 2, 3 e 4: as 28 pedras se conservam e a partida chega ao fim', () => {
  for (const n of [2, 3, 4]) {
    for (let k = 0; k < 20; k++) {
      const ids = [1, 2, 3, 4].slice(0, n);
      const j = comecar({ ids, aleatorio: Math.random });
      for (let passos = 0; passos < 5000 && !j.terminou(); passos++) {
        const e = j.estado();
        if (e.fase === 'jogando') {
          const total = e.mesa.length + e.dorme + e.lugares.reduce((s, l) => s + l.pedras, 0);
          assert.equal(total, 28);
          for (let i = 1; i < e.mesa.length; i++) assert.equal(e.mesa[i - 1][1], e.mesa[i][0], 'a corrente encaixa');
        }
        j.andar();
      }
      assert.equal(j.terminou(), true);
      assert.equal(j.completa(), true);
      assert.ok(j.estado().placar.some((p) => p.pontos >= PONTOS_PARA_VENCER));
    }
  }
});
