/**
 * O LOTE C DA SEGUNDA AUDITORIA (20/11/2026): as variantes das mesas, escolhidas na largada (a regra de fábrica continua a de
 * sempre), e a Copa do Celeiro na sala.
 * - Cinco em linha: a CAPTURA (X O O X tira as duas; cinco capturas vencem) e a RESTRIÇÃO 3-3 das escuras, e o robô que as
 *   respeita;
 * - Damas: a pedra que não come para trás;
 * - Batalha naval: os mares de 8 × 8 e 12 × 12, com as frotas deles, a montagem e o robô;
 * - Dominó: as batidas especiais (carroça, lá-e-ló, cruzada);
 * - Truco: o mineiro (manilhas fixas, sem vira);
 * - Torre do Celeiro: a Copa do Celeiro (as cinco torres, a soma, o pódio).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';
import type { Contexto, Definicao, Jogo } from '../src/minijogo-motor.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const tab = await import('../src/minijogo-tabuleiro.js');
const { gomoku, capturasDaPedra, fazTresTres, jogadaDoGomoku, LADO_DO_GOMOKU, CAPTURAS_PARA_VENCER } = tab;
const { damas, lancesDe, VAZIA, PEDRA_CLARA, PEDRA_ESCURA, lanceDoRobo: lanceDasDamas } = await import('../src/minijogo-damas.js');
const { criarNaval, sortearFrota, MARES, encosta } = await import('../src/minijogo-naval.js');
const { criarDomino, batidaEspecial } = await import('../src/minijogo-domino.js');
const { criarTruco, forca, MINEIRO, baralho } = await import('../src/minijogo-truco.js');
const { criarTorre, COPA_DO_CELEIRO, TORRES_DA_COPA } = await import('../src/minijogo-torre.js');
const { TORRES_DO_CELEIRO } = await import('../src/torre.js');

const ana = await criarConta(app, 'ana-variantes');
const bia = await criarConta(app, 'bia-variantes');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma das variantes' })).json() as { id: number };

function semente(s: number) {
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Uma partida com o relógio de mão (o relógio guarda só o último agendado, como o motor). */
function partida(def: Definicao, { solo = false, corpo = {} as Record<string, unknown>, naSala = [anaId, biaId], comunidadeId = 7 } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => naSala,
    nome: (id) => (id === anaId ? 'ana' : id === biaId ? 'bia' : `p${id}`),
    comunidade: solo ? 0 : comunidadeId,
    solo,
  };
  const jogo = def.comecar(ctx, { naSala, criadaPor: naSala[0], corpo }) as Jogo;
  assert.notEqual(typeof jogo, 'string');
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ver: (quem = anaId) => jogo.publico(quem) as Record<string, any>,
    andar: () => relogio[0].depois(),
  };
}

const N = LADO_DO_GOMOKU;
const casa = (l: number, c: number) => l * N + c;

/** Uma mesa do Cinco em linha na sala, já com as duas sentadas: devolve quem tem as escuras (abre) e quem tem as claras. */
function mesaDoGomoku(corpo: Record<string, unknown>) {
  const p = partida(gomoku, { corpo });
  assert.equal(p.jogo.acao(biaId, { tipo: 'sentar' }), null);
  const e = p.ver();
  const escuras: number = e.jogadores[e.vez].userId;
  const claras = escuras === anaId ? biaId : anaId;
  const jogar = (quem: number, l: number, c: number) => p.jogo.acao(quem, { tipo: 'jogada', casa: casa(l, c) });
  return { ...p, escuras, claras, jogar };
}

// ---------------------------------------------------------------------------------------------------------------------------
// CINCO EM LINHA
// ---------------------------------------------------------------------------------------------------------------------------

test('Cinco em linha: a pedra que fecha X O O X captura as duas, nas oito direções', () => {
  const casas = new Array<number>(N * N).fill(0);
  casas[casa(7, 7)] = 1;
  casas[casa(7, 8)] = 2;
  casas[casa(7, 9)] = 2;
  casas[casa(7, 10)] = 1;
  casas[casa(8, 8)] = 2;
  casas[casa(9, 9)] = 2;
  casas[casa(10, 10)] = 1;
  // a pedra em 7,7 (já posta) fecha a linha à direita e a diagonal para baixo
  assert.deepEqual(capturasDaPedra(casas, casa(7, 7), 1).sort((a, b) => a - b), [casa(7, 8), casa(7, 9), casa(8, 8), casa(9, 9)].sort((a, b) => a - b));
  // três do outro no meio não capturam (só duas)
  casas[casa(7, 10)] = 2;
  casas[casa(7, 11)] = 1;
  assert.deepEqual(capturasDaPedra(casas, casa(7, 7), 1), [casa(8, 8), casa(9, 9)]);
});

test('Cinco em linha com captura: as duas somem, a captura conta, e cinco capturas vencem', () => {
  const m = mesaDoGomoku({ captura: true });
  const { escuras: A, claras: B, jogar } = m;
  const linhas = [1, 3, 5, 9, 11];
  linhas.forEach((r, k) => {
    assert.equal(jogar(A, r, 3), null);
    assert.equal(jogar(B, r, 4), null);
    assert.equal(jogar(A, 14, 2 * k), null);
    assert.equal(jogar(B, r, 5), null);
    assert.equal(jogar(A, r, 6), null, `a captura da linha ${r}`);
    const e = m.ver();
    assert.equal(e.casas[casa(r, 4)], 0);
    assert.equal(e.casas[casa(r, 5)], 0);
    assert.deepEqual([...e.capturadas].sort((a: number, b: number) => a - b), [casa(r, 4), casa(r, 5)]);
    const ladoA = e.jogadores.findIndex((j: { userId: number }) => j.userId === A);
    assert.equal(e.capturas[ladoA], k + 1);
    if (k < linhas.length - 1) assert.equal(jogar(B, 13, 2 * k), null);
  });
  const fim = m.ver();
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.jogadores[fim.vencedor].userId, A, `${CAPTURAS_PARA_VENCER} capturas vencem`);
  assert.match(fim.historico[fim.historico.length - 1].texto, /×1$/);
});

test('Cinco em linha sem a captura (a regra de fábrica): nada sai do tabuleiro', () => {
  const { escuras: A, claras: B, jogar, ver } = mesaDoGomoku({});
  jogar(A, 7, 3);
  jogar(B, 7, 4);
  jogar(A, 0, 0);
  jogar(B, 7, 5);
  jogar(A, 7, 6);
  assert.equal(ver().casas[casa(7, 4)], 2);
  assert.equal(ver().captura, false);
});

test('Cinco em linha, a restrição 3-3: as escuras não fazem dois três abertos; as claras podem, e o robô não tenta', () => {
  const montar = (corpo: Record<string, unknown>) => {
    const m = mesaDoGomoku(corpo);
    const { escuras: A, claras: B, jogar } = m;
    jogar(A, 7, 6);
    jogar(B, 0, 0);
    jogar(A, 7, 7);
    jogar(B, 0, 2);
    jogar(A, 5, 8);
    jogar(B, 0, 4);
    jogar(A, 6, 8);
    jogar(B, 0, 6);
    return m;
  };
  const com = montar({ tresTres: true });
  assert.equal(com.jogar(com.escuras, 7, 8), 'As escuras não podem fazer dois três abertos de uma vez.');
  assert.equal(com.jogar(com.escuras, 7, 5), null, 'um três aberto só pode');
  const sem = montar({});
  assert.equal(sem.jogar(sem.escuras, 7, 8), null, 'sem a restrição, vale');
  // a conta direta, e o três separado (X·XX) também conta
  const casas = new Array<number>(N * N).fill(0);
  for (const [l, c] of [
    [7, 5],
    [7, 7],
    [7, 8],
    [5, 6],
    [6, 6],
    [7, 6],
  ])
    casas[casa(l, c)] = 1;
  assert.equal(fazTresTres(casas, casa(7, 6)), false, 'quatro na linha não é três');
  casas[casa(7, 5)] = 0;
  casas[casa(7, 4)] = 1;
  casas[casa(7, 8)] = 0;
  // linha: 4 · 6 7 → X·XX; coluna: 5 6 7 → três seguido
  assert.equal(fazTresTres(casas, casa(7, 6)), true);
  // o robô das escuras, com a casa proibida sendo a melhor: não a escolhe
  const tab = new Array<number>(N * N).fill(0);
  for (const [l, c] of [
    [7, 6],
    [7, 7],
    [5, 8],
    [6, 8],
  ])
    tab[casa(l, c)] = 1;
  tab[casa(0, 0)] = 2;
  tab[casa(0, 2)] = 2;
  for (let s = 1; s <= 20; s++) {
    for (const nivel of ['facil', 'normal', 'dificil'] as const) {
      const j = jogadaDoGomoku(tab, 1, semente(s), N, nivel, false, { tresTres: true });
      assert.notEqual(j, casa(7, 8), `nível ${nivel}`);
      tab[j] = 1;
      assert.equal(fazTresTres(tab, j), false);
      tab[j] = 0;
    }
  }
});

test('Cinco em linha com captura: o robô captura quando pode', () => {
  const tab = new Array<number>(N * N).fill(0);
  tab[casa(7, 7)] = 1;
  tab[casa(7, 8)] = 2;
  tab[casa(7, 9)] = 2;
  tab[casa(3, 3)] = 2;
  for (let s = 1; s <= 10; s++) assert.equal(jogadaDoGomoku(tab, 1, semente(s), N, 'normal', false, { captura: true }), casa(7, 10));
});

test('Cinco em linha: o Solo com captura e 3-3 joga até o fim contra o robô, sem jogada recusada', () => {
  const p = partida(gomoku, { solo: true, naSala: [anaId], corpo: { captura: true, tresTres: true, nivel: 'facil' } });
  const sorte = semente(9);
  for (let k = 0; k < 400 && !p.terminou(); k++) {
    const e = p.ver();
    const meu = e.jogadores.findIndex((j: { userId: number }) => j.userId === anaId);
    if (e.vez !== meu) {
      p.andar();
      continue;
    }
    const livres = e.casas.flatMap((c: number, i: number) => (c ? [] : [i]));
    // ana joga ao acaso, mas sem ser recusada (com as escuras, a casa 3-3 é recusada: tenta outra)
    for (let t = 0; t < 50; t++) if (p.jogo.acao(anaId, { tipo: 'jogada', casa: livres[Math.floor(sorte() * livres.length)] }) === null) break;
  }
  assert.ok(p.terminou(), 'a partida acaba');
});

// ---------------------------------------------------------------------------------------------------------------------------
// DAMAS
// ---------------------------------------------------------------------------------------------------------------------------

test('Damas: sem comer para trás, a pedra não come a peça de trás; a regra de fábrica come', () => {
  const casas = new Array<number>(64).fill(VAZIA);
  casas[4 * 8 + 3] = PEDRA_CLARA; // as claras sobem (para a linha 0)
  casas[5 * 8 + 4] = PEDRA_ESCURA; // atrás dela
  casas[0 * 8 + 1] = PEDRA_ESCURA;
  const brasileira = lancesDe(casas, 0);
  assert.equal(brasileira.length, 1);
  assert.deepEqual(brasileira[0].comidas, [5 * 8 + 4]);
  const semTras = lancesDe(casas, 0, false);
  assert.ok(semTras.length > 0);
  assert.ok(semTras.every((l) => l.comidas.length === 0), 'só os simples, para a frente');
  // para a frente continua obrigatório
  casas[3 * 8 + 2] = PEDRA_ESCURA;
  assert.deepEqual(lancesDe(casas, 0, false).map((l) => l.comidas), [[3 * 8 + 2]]);
  // o robô usa a mesma regra
  const i = lanceDasDamas(casas, 0, semente(1), 2, 0, false);
  assert.deepEqual(lancesDe(casas, 0, false)[i].comidas, [3 * 8 + 2]);
});

test('Damas: a variante vem da largada e volta no público', () => {
  const p = partida(damas, { corpo: { paraTras: false } });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(p.ver().paraTras, false);
  assert.equal(p.ver().escolhas.paraTras, false);
  const q = partida(damas, {});
  q.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(q.ver().paraTras, true, 'a de fábrica come para trás');
});

// ---------------------------------------------------------------------------------------------------------------------------
// BATALHA NAVAL
// ---------------------------------------------------------------------------------------------------------------------------

test('Batalha naval: as frotas sorteadas de cada mar cabem, sem encostar', () => {
  for (const n of [8, 10, 12]) {
    for (let s = 1; s <= 120; s++) {
      const frota = sortearFrota(semente(s), [], n);
      assert.deepEqual(
        frota.map((x) => x.length),
        [...MARES[n]],
      );
      for (const [i, navio] of frota.entries()) {
        assert.ok(navio.every((c) => c >= 0 && c < n * n));
        const linhas = new Set(navio.map((c) => Math.floor(c / n)));
        const colunas = new Set(navio.map((c) => c % n));
        assert.ok(linhas.size === 1 || colunas.size === 1, 'reto');
        assert.equal(encosta(navio, frota.filter((_, k) => k !== i), n), false);
      }
    }
  }
});

test('Batalha naval: o mar escolhido na largada, a montagem nele e o Solo até o fim contra o robô', () => {
  for (const mar of [8, 12]) {
    const p = partida(criarNaval(semente(mar)), { solo: true, naSala: [anaId], corpo: { mar, nivel: 'normal' } });
    const e = p.ver();
    assert.equal(e.mar, mar);
    assert.deepEqual(e.frota, [...MARES[mar]]);
    assert.equal(e.mares[0].tiros.length, mar * mar);
    assert.equal(e.escolhas.mar, mar, 'o "Jogar de novo" repete o mar');
    // a montagem: um navio fora do mar não cabe; no canto de baixo do mar de 12 cabe (o de 10 recusaria a casa)
    if (mar === 12) assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'por', navio: 0, casa: 11 * 12, deitado: true }), null);
    assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'por', navio: 0, casa: mar * mar - 2, deitado: true }), 'O navio não cabe aí.');
    assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'sortear' }), null);
    assert.equal(p.jogo.acao(anaId, { tipo: 'montar', acao: 'pronto' }), null);
    let proxima = 0;
    for (let k = 0; k < 2000 && !p.terminou(); k++) {
      const v = p.ver();
      const meu = v.jogadores.findIndex((j: { userId: number }) => j.userId === anaId);
      if (v.vez === meu) assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', casa: proxima++ }), null);
      else p.andar();
    }
    assert.ok(p.terminou(), `o mar de ${mar} acaba`);
    assert.equal(p.ver().mares[1].navios.length, MARES[mar].length, 'no fim, a frota do robô aparece inteira');
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// DOMINÓ
// ---------------------------------------------------------------------------------------------------------------------------

test('Dominó: qual batida é especial', () => {
  assert.equal(batidaEspecial([3, 3], { esquerda: 6, direita: 3 }), 'carroca');
  assert.equal(batidaEspecial([3, 3], { esquerda: 3, direita: 3 }), 'cruzada');
  assert.equal(batidaEspecial([0, 4], { esquerda: 4, direita: 0 }), 'la-e-lo');
  assert.equal(batidaEspecial([2, 4], { esquerda: 4, direita: 4 }), null, 'pontas iguais: não é lá-e-ló');
  assert.equal(batidaEspecial([2, 4], { esquerda: 4, direita: 1 }), null);
});

function domino(especiais: boolean, maos: [number, number][][]) {
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => [1, 2],
    nome: (id: number) => `p${id}`,
    comunidade: 7,
  };
  const jogo = criarDomino({ agora: () => 1000, aleatorio: () => 0.9999, distribuir: () => ({ maos, dorme: [] }) }).comecar(ctx as unknown as Contexto, {
    naSala: [1, 2],
    criadaPor: 1,
    corpo: { especiais },
  }) as Jogo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { jogo, ver: () => jogo.publico(1) as Record<string, any> };
}

test('Dominó com as batidas especiais: a carroça vale o dobro; sem a opção, a batida comum', () => {
  for (const especiais of [true, false]) {
    const d = domino(especiais, [
      [
        [6, 6],
        [3, 3],
      ],
      [
        [3, 6],
        [0, 1],
      ],
    ]);
    assert.equal(d.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
    assert.equal(d.jogo.acao(2, { tipo: 'jogar', pedra: [3, 6] }), null);
    assert.equal(d.jogo.acao(1, { tipo: 'jogar', pedra: [3, 3] }), null);
    const r = d.ver().resultado;
    assert.equal(r.tipo, 'batida');
    assert.equal(r.especial, especiais ? 'carroca' : null);
    assert.equal(r.pontos, especiais ? 2 : 1);
    assert.equal(d.ver().especiais, especiais);
  }
});

test('Dominó com as batidas especiais: o lá-e-ló vale o dobro', () => {
  const d = domino(true, [
    [
      [6, 6],
      [0, 5],
      [0, 4],
    ],
    [
      [5, 6],
      [4, 6],
      [1, 1],
    ],
  ]);
  assert.equal(d.jogo.acao(1, { tipo: 'jogar', pedra: [6, 6] }), null);
  assert.equal(d.jogo.acao(2, { tipo: 'jogar', pedra: [5, 6] }), null);
  assert.equal(d.jogo.acao(1, { tipo: 'jogar', pedra: [0, 5] }), null);
  assert.equal(d.jogo.acao(2, { tipo: 'jogar', pedra: [4, 6] }), null);
  assert.deepEqual(d.ver().pontas, { esquerda: 4, direita: 0 });
  assert.equal(d.jogo.acao(1, { tipo: 'jogar', pedra: [0, 4], ponta: 'esquerda' }), null);
  const r = d.ver().resultado;
  assert.equal(r.especial, 'la-e-lo');
  assert.equal(r.pontos, 4);
});

// ---------------------------------------------------------------------------------------------------------------------------
// TRUCO
// ---------------------------------------------------------------------------------------------------------------------------

test('Truco mineiro: as manilhas fixas, na ordem, acima de tudo; as outras do mesmo valor são comuns', () => {
  const f = (c: string) => forca(c, MINEIRO);
  assert.ok(f('4p') > f('7c') && f('7c') > f('Ae') && f('Ae') > f('7o') && f('7o') > f('3c'));
  assert.equal(f('4o'), forca('4o', 'K'), 'o 4 de ouros é um 4 comum');
  assert.equal(f('7e'), forca('7e', 'K'));
  assert.equal(f('Ac'), forca('Ac', 'K'));
  // as 36 que não são manilha seguem a ordem do paulista
  for (const c of baralho()) if (!['4p', '7c', 'Ae', '7o'].includes(c)) assert.ok(f(c) < 100);
});

test('Truco mineiro: sem vira, e o ás de espadas ganha do 3 (no paulista, perde)', () => {
  for (const variante of [MINEIRO, 'paulista']) {
    const relogio: { ms: number; depois: () => void }[] = [];
    const ctx = {
      agendar: (ms: number, depois: () => void) => void relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => {},
      naSala: () => [1, 2],
      nome: (id: number) => `p${id}`,
      comunidade: 7,
    };
    const maos = [
      ['3o', '2o', 'Qo'],
      ['Ae', '4c', '5c'],
    ];
    // a vira 6 de espadas: no paulista, a manilha é o 7
    const usadas = [...maos.flat(), '6e'];
    const cartas = [...usadas, ...baralho().filter((c) => !usadas.includes(c))];
    const jogo = criarTruco({ aleatorio: () => 0.999, agora: () => 1000, baralhos: [cartas] }).comecar(ctx as unknown as Contexto, {
      naSala: [1, 2],
      criadaPor: 1,
      corpo: { variante },
    }) as Jogo;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ver = () => jogo.publico(1) as Record<string, any>;
    assert.equal(ver().vira, variante === MINEIRO ? null : '6e');
    assert.equal(ver().manilha, variante === MINEIRO ? MINEIRO : '7');
    assert.equal(ver().variante, variante);
    const primeiro = ver().vez as number;
    const segundo = primeiro === 1 ? 2 : 1;
    const cartaDe = (id: number) => (id === 1 ? '3o' : 'Ae');
    assert.equal(jogo.acao(primeiro, { tipo: 'jogar', carta: cartaDe(primeiro) }), null);
    assert.equal(jogo.acao(segundo, { tipo: 'jogar', carta: cartaDe(segundo) }), null);
    const ganhou = ver().rodadas[0];
    const lugarDe2 = (ver().lugares as { userId: number; time: number }[]).find((l) => l.userId === 2)!.time;
    if (variante === MINEIRO) assert.equal(ganhou, lugarDe2, 'o ás de espadas é manilha');
    else assert.notEqual(ganhou, lugarDe2, 'no paulista, o 3 ganha do ás');
  }
});

/** Uma mesa de truco de dois (1 e 2), com os pontos de partida e a variante. */
function mesaDeTruco(variante: string, pontos?: [number, number]) {
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx = {
    agendar: (ms: number, depois: () => void) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => [1, 2],
    nome: (id: number) => `p${id}`,
    comunidade: 7,
  };
  const jogo = criarTruco({ aleatorio: semente(3), agora: () => 1000, pontos }).comecar(ctx as unknown as Contexto, {
    naSala: [1, 2],
    criadaPor: 1,
    corpo: { variante },
  }) as Jogo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ver = (quem = 1) => jogo.publico(quem) as Record<string, any>;
  const timeDe = (id: number) => (ver().lugares as { userId: number; time: 0 | 1 }[]).find((l) => l.userId === id)!.time;
  const doTime = (time: 0 | 1) => (timeDe(1) === time ? 1 : 2);
  return { jogo, ver, timeDe, doTime };
}

test('Truco mineiro: a contagem mineira (2, 4, 8, 10, 12); o paulista continua 1, 3, 6, 9, 12', () => {
  for (const [variante, esperados] of [
    [MINEIRO, [2, 4, 8, 10, 12]],
    ['paulista', [1, 3, 6, 9, 12]],
  ] as const) {
    const { jogo, ver } = mesaDeTruco(variante);
    assert.deepEqual(ver().valoresDaMao, esperados);
    assert.equal(ver().valor, esperados[0], 'a mão começa valendo o primeiro');
    const pede = ver().vez as number;
    const responde = pede === 1 ? 2 : 1;
    assert.equal(ver(pede).proximoValor, esperados[1]);
    assert.equal(jogo.acao(pede, { tipo: 'truco' }), null);
    assert.equal(ver().pedido.valor, esperados[1], 'o truco');
    // o aumento vai degrau a degrau, um de cada lado, até o doze
    let quem = responde;
    for (const k of [2, 3, 4]) {
      assert.equal(ver(quem).possoAumentar, esperados[k]);
      assert.equal(jogo.acao(quem, { tipo: 'aumentar' }), null);
      assert.equal(ver().pedido.valor, esperados[k]);
      quem = quem === pede ? responde : pede;
    }
    assert.equal(ver(quem).possoAumentar, null, 'depois do doze, nada');
    assert.equal(jogo.acao(quem, { tipo: 'aceitar' }), null);
    assert.equal(ver().valor, 12);
  }
});

test('Truco mineiro: correr do truco dá o valor de antes (2 no mineiro, 1 no paulista)', () => {
  for (const [variante, antes] of [
    [MINEIRO, 2],
    ['paulista', 1],
  ] as const) {
    const { jogo, ver, timeDe } = mesaDeTruco(variante);
    const pede = ver().vez as number;
    const responde = pede === 1 ? 2 : 1;
    jogo.acao(pede, { tipo: 'truco' });
    assert.equal(jogo.acao(responde, { tipo: 'correr' }), null);
    assert.equal(ver().pontos[timeDe(pede)], antes);
    assert.equal(ver().pontos[timeDe(responde)], 0);
  }
});

test('Truco mineiro: a mão de dez (jogar vale 4; correr dá 2); no paulista, 10 é mão comum e a de onze segue 3 e 1', () => {
  // mineiro, o time 0 com 10: ele decide
  {
    const { jogo, ver, doTime } = mesaDeTruco(MINEIRO, [10, 5]);
    assert.equal(ver().fase, 'mao-de-onze');
    assert.equal(ver().onze, 0);
    assert.deepEqual(ver().maoDecidida, { pontos: 10, jogando: 4, correndo: 2 });
    assert.equal(ver(doTime(0)).decidoOnze, true);
    assert.equal(ver(doTime(1)).decidoOnze, false);
    assert.equal(jogo.acao(doTime(0), { tipo: 'onze', jogar: true }), null);
    assert.equal(ver().fase, 'jogando');
    assert.equal(ver().valor, 4);
    assert.equal(ver().semTruco, true, 'sem truco na mão de dez');
    assert.equal(ver(ver().vez).possoPedir, false);
  }
  {
    const { jogo, ver, doTime } = mesaDeTruco(MINEIRO, [10, 5]);
    assert.equal(jogo.acao(doTime(0), { tipo: 'onze', jogar: false }), null);
    assert.deepEqual(ver().pontos, [10, 7], 'correu: o outro leva 2');
  }
  // mineiro com 11 (veio de 9 + 2): mão comum
  assert.equal(mesaDeTruco(MINEIRO, [11, 5]).ver().fase, 'jogando');
  // paulista: 10 é mão comum, e a de onze continua valendo 3 e dando 1
  assert.equal(mesaDeTruco('paulista', [10, 5]).ver().fase, 'jogando');
  {
    const { jogo, ver, doTime } = mesaDeTruco('paulista', [11, 5]);
    assert.equal(ver().fase, 'mao-de-onze');
    assert.equal(jogo.acao(doTime(0), { tipo: 'onze', jogar: true }), null);
    assert.equal(ver().valor, 3);
  }
  {
    const { jogo, ver, doTime } = mesaDeTruco('paulista', [11, 5]);
    assert.equal(jogo.acao(doTime(0), { tipo: 'onze', jogar: false }), null);
    assert.deepEqual(ver().pontos, [11, 6]);
  }
});

test('Truco mineiro: as duas duplas em 10 jogam a mão de ferro valendo 2, sem truco; no paulista, em 11, valendo 1', () => {
  for (const [variante, pontos, base] of [
    [MINEIRO, [10, 10], 2],
    ['paulista', [11, 11], 1],
  ] as const) {
    const { ver } = mesaDeTruco(variante, [...pontos] as [number, number]);
    assert.equal(ver().fase, 'jogando');
    assert.equal(ver().onze, null);
    assert.equal(ver().semTruco, true);
    assert.equal(ver().valor, base);
    assert.equal(ver(ver().vez).possoPedir, false);
  }
  // no paulista, 10 × 10 é mão comum, com truco
  const { ver } = mesaDeTruco('paulista', [10, 10]);
  assert.equal(ver().semTruco, false);
});

// ---------------------------------------------------------------------------------------------------------------------------
// A COPA DO CELEIRO
// ---------------------------------------------------------------------------------------------------------------------------

/** Em linha reta da largada até passar do topo (a mesma subida de minijogos-torre.test.ts). */
function subida(id: string, passos: number) {
  const d = TORRES_DO_CELEIRO[id];
  const amostras: number[] = [];
  for (let p = 1; p <= passos; p += 4) {
    const t = (p - 1) / (passos - 1);
    amostras.push(d.largada[0] * 10, Math.round((d.largada[1] + (d.chegada - 2 - d.largada[1]) * t) * 10), 1);
  }
  return { tipo: 'chegada', passos, amostras };
}

test('A Copa do Celeiro: as cinco torres seguidas, o placar pela soma, e o pódio só de quem subiu as cinco', async () => {
  let agora = 5_000_000;
  const p = partida(criarTorre(() => agora), { corpo: { pista: COPA_DO_CELEIRO }, comunidadeId: comunidade.id });
  assert.equal(p.ver().copa, true);
  assert.equal(p.ver().corridas, 5);
  assert.equal(p.ver().categoria, COPA_DO_CELEIRO);
  for (const [k, id] of TORRES_DA_COPA.entries()) {
    const e = p.ver();
    assert.equal(e.pista, id);
    assert.equal(e.corrida, k + 1);
    assert.equal(e.fase, 'largada');
    p.andar(); // o verde
    agora += 50_000;
    const minimo = TORRES_DO_CELEIRO[id].minimo;
    assert.equal(p.jogo.acao(anaId, subida(id, Math.max(2400, minimo + 100))), null);
    assert.equal(p.jogo.acao(biaId, subida(id, Math.max(2500, minimo + 200))), null);
    if (k < TORRES_DA_COPA.length - 1) {
      assert.equal(p.ver().fase, 'intervalo');
      assert.deepEqual(
        p.ver().placarDaCopa.map((l: { userId: number; feitas: number }) => [l.userId, l.feitas]),
        [
          [anaId, k + 1],
          [biaId, k + 1],
        ],
      );
      p.andar(); // o placar acabou: a próxima torre
    }
  }
  assert.ok(p.terminou());
  const placar = p.ver().placarDaCopa as { userId: number; feitas: number; soma: number; posicao: number }[];
  assert.deepEqual(
    placar.map((l) => [l.userId, l.posicao, l.feitas]),
    [
      [anaId, 1, 5],
      [biaId, 2, 5],
    ],
  );
  const trofeus = async (token: string) =>
    ((await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; tempoMs: number }[]).filter(
      (t) => t.pista === COPA_DO_CELEIRO,
    );
  const daAna = await trofeus(ana.token);
  assert.equal(daAna.length, 1);
  assert.equal(daAna[0].posicao, 1);
  assert.equal(daAna[0].tempoMs, placar[0].soma, 'o tempo do troféu é a soma');
  assert.equal((await trofeus(bia.token))[0]?.posicao, 2);
});

test('A Copa do Celeiro: quem não sobe uma torre fica atrás de quem subiu todas, e sem troféu da copa', async () => {
  let agora = 9_000_000;
  const p = partida(criarTorre(() => agora), { corpo: { pista: COPA_DO_CELEIRO }, comunidadeId: comunidade.id });
  for (const [k, id] of TORRES_DA_COPA.entries()) {
    p.andar();
    agora += 50_000;
    // bia não sobe a primeira (o prazo fecha a torre sem ela) e é a mais rápida nas outras
    assert.equal(p.jogo.acao(anaId, subida(id, Math.max(2600, TORRES_DO_CELEIRO[id].minimo + 300))), null);
    if (k > 0) assert.equal(p.jogo.acao(biaId, subida(id, Math.max(2400, TORRES_DO_CELEIRO[id].minimo + 100))), null);
    else p.andar(); // o prazo de 30 s
    if (k < TORRES_DA_COPA.length - 1) p.andar();
  }
  const placar = p.ver().placarDaCopa as { userId: number; feitas: number; posicao: number }[];
  assert.deepEqual(
    placar.map((l) => [l.userId, l.feitas, l.posicao]),
    [
      [anaId, 5, 1],
      [biaId, 4, 2],
    ],
  );
});

test('A Copa do Celeiro é só da sala: no Solo, a copa pedida cai na torre de fábrica', () => {
  const p = partida(criarTorre(() => 1), { solo: true, naSala: [anaId], corpo: { pista: COPA_DO_CELEIRO } });
  assert.equal(p.ver().pista, 'celeiro-1');
  assert.equal(p.ver().solo, true);
});
