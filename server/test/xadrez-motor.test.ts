/**
 * O ROBÔ DE XADREZ (20/11/2026): o motor próprio (xadrez-motor.ts), o worker com a fila e a reserva (xadrez-robo.ts), os cinco
 * níveis, a mesa que joga fora a conta velha, e nos Problemas de xadrez a SEQUÊNCIA e a DICA conferidas pelo servidor.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Chess } from 'chess.js';
import type { Contexto, Definicao, Jogo } from '../src/minijogo-motor.js';
import { lanceDoMotor, NIVEIS_DO_MOTOR, perft, MATE, type NivelDoMotor } from '../src/xadrez-motor.js';
import { contagem, derrubarWorkerParaTeste, desligarRoboDeXadrez, lanceDeReserva, pensarNoWorker } from '../src/xadrez-robo.js';
import { nomeDe, partidaDeXadrez } from '../src/minijogo-partida-de-xadrez.js';
import { criarXadrez, PROBLEMAS, PENALIDADE_MS, CORRIDA_MS, casa, type RecordesDoXadrez } from '../src/minijogo-xadrez.js';

after(() => desligarRoboDeXadrez());

const esperar = async (cond: () => boolean, ms = 8000) => {
  for (let i = 0; i < ms / 20 && !cond(); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(cond(), 'a condição não chegou');
};

test('o gerador de lances bate com os números conhecidos (perft)', () => {
  const casos: [string, number, number][] = [
    ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
    // roque, en passant, promoção e xeques: a "Kiwipete"
    ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
    ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
    ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 3, 9467],
    ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
  ];
  for (const [fen, prof, esperado] of casos) assert.equal(perft(fen, prof), esperado, fen);
});

test('o motor acha o mate em dois, e o lance é sempre legal', () => {
  // mate em 2 (brancas): 1. Dxh7+ Rxh7 2. Th3#? — usamos uma posição clássica conferida pelo chess.js
  const fen = 'r1b2rk1/pppp1ppp/2n5/2b1q3/2B5/2N2N2/PPPP1PPP/R1BQR1K1 b - - 0 1';
  for (const nivel of ['dificil', 'mestre'] as NivelDoMotor[]) {
    const r = lanceDoMotor(fen, nivel);
    assert.ok(r.lance);
    const jogo = new Chess(fen);
    assert.ok(jogo.move({ from: nomeDe(r.lance.de), to: nomeDe(r.lance.para), promotion: r.lance.promocao ?? 'q' }));
  }
  // mate em 1 de verdade: a dama na sétima
  const mateEm1 = '6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1';
  const r1 = lanceDoMotor(mateEm1, 'normal');
  const j1 = new Chess(mateEm1);
  j1.move({ from: nomeDe(r1.lance!.de), to: nomeDe(r1.lance!.para) });
  assert.ok(j1.isCheckmate(), 'o normal dá o mate em um');
  // mate em 2: a torre e a dama
  const mateEm2 = 'k7/8/1K6/8/8/8/8/7R w - - 0 1';
  const r2 = lanceDoMotor(mateEm2, 'dificil');
  assert.ok(r2.valor > MATE - 100, `o difícil vê o mate (nota ${r2.valor})`);
});

test('os níveis: o Mestre olha mais fundo que o Difícil, que olha mais que o Normal, no tempo de cada um', () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const prof: Record<string, number> = {};
  for (const nivel of Object.keys(NIVEIS_DO_MOTOR) as NivelDoMotor[]) {
    const r = lanceDoMotor(fen, nivel);
    prof[nivel] = r.profundidade;
    assert.ok(r.ms < NIVEIS_DO_MOTOR[nivel].tempoMs + 400, `${nivel} levou ${r.ms.toFixed(0)} ms`);
  }
  assert.ok(prof.mestre > prof.dificil && prof.dificil > prof.normal && prof.normal > prof.facil, JSON.stringify(prof));
});

test('os níveis: cada um ganha do de baixo (partidas curtas, o material decide)', () => {
  const VALOR: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const ABERTURAS = ['e4 e5', 'd4 d5', 'e4 c5', 'c4 e5', 'Nf3 d5', 'e4 e6'];
  // os níveis de baixo, no tempo de verdade; o Difícil e o Mestre são medidos por scripts/xadrez-niveis.mjs (minutos)
  const pares: [NivelDoMotor, NivelDoMotor][] = [
    ['facil', 'iniciante'],
    ['normal', 'facil'],
  ];
  for (const [forte, fraco] of pares) {
    let vitorias = 0;
    let derrotas = 0;
    for (let g = 0; g < 6; g++) {
      const jogo = new Chess();
      for (const san of ABERTURAS[g].split(' ')) jogo.move(san);
      const forteBrancas = g % 2 === 0;
      const fens: string[] = [];
      for (let k = 0; k < 160 && !jogo.isGameOver(); k++) {
        const nivel = (jogo.turn() === 'w') === forteBrancas ? forte : fraco;
        const r = lanceDoMotor(jogo.fen(), nivel, fens, k * 7 + g + 1);
        fens.push(jogo.fen());
        jogo.move({ from: nomeDe(r.lance!.de), to: nomeDe(r.lance!.para), promotion: r.lance!.promocao ?? 'q' });
      }
      const cor = forteBrancas ? 'w' : 'b';
      if (jogo.isCheckmate()) {
        if (jogo.turn() === cor) derrotas++;
        else vitorias++;
        continue;
      }
      let m = 0;
      for (const linha of jogo.board()) for (const c of linha) if (c) m += (c.color === cor ? 1 : -1) * VALOR[c.type];
      if (m >= 2) vitorias++;
      else if (m <= -2) derrotas++;
    }
    assert.ok(vitorias > derrotas && vitorias >= 3, `${forte} × ${fraco}: ${vitorias} vitórias, ${derrotas} derrotas`);
  }
});

test('o worker responde, e a fila atende vários pedidos em ordem', async () => {
  const antes = contagem.worker;
  const fen = new Chess().fen();
  const respostas = await Promise.all([1, 2, 3].map((s) => pensarNoWorker({ fen, historico: [], nivel: 'facil', semente: s })));
  for (const l of respostas) {
    assert.ok(l);
    assert.ok(new Chess(fen).move({ from: nomeDe(l.de), to: nomeDe(l.para) }));
  }
  assert.equal(contagem.worker - antes, 3, 'os três vieram do worker (e não da reserva)');
});

test('o worker caiu no meio da conta: a reserva joga um lance legal, e o próximo pedido abre outro worker', async () => {
  const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const reserva = contagem.reserva;
  const pedido = pensarNoWorker({ fen, historico: [], nivel: 'mestre', semente: 1 });
  await new Promise((r) => setTimeout(r, 300));
  await derrubarWorkerParaTeste();
  const l = await pedido;
  assert.ok(l, 'veio um lance');
  assert.ok(new Chess(fen).move({ from: nomeDe(l.de), to: nomeDe(l.para) }), 'e ele vale');
  assert.equal(contagem.reserva, reserva + 1);
  const worker = contagem.worker;
  assert.ok(await pensarNoWorker({ fen, historico: [], nivel: 'iniciante', semente: 2 }));
  assert.equal(contagem.worker, worker + 1, 'o worker voltou');
  // sem lance legal (mate), a reserva diz null
  assert.equal(lanceDeReserva('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'), null);
});

// ---------------------------------------------------------------------------------------------------------------------------
// A MESA
// ---------------------------------------------------------------------------------------------------------------------------

function partida(def: Definicao, corpo: Record<string, unknown> = {}, solo = true, naSala = [1]) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => naSala,
    nome: (id) => `p${id}`,
    comunidade: solo ? 0 : 7,
    solo,
  };
  const jogo = def.comecar(ctx, { naSala, criadaPor: naSala[0], corpo }) as Jogo;
  assert.notEqual(typeof jogo, 'string');
  return {
    jogo,
    relogio,
    terminou: () => terminou,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ver: (quem = 1) => jogo.publico(quem) as Record<string, any>,
    andar: () => relogio[0].depois(),
  };
}

test('a mesa aceita os cinco níveis do xadrez (e o nível estranho cai no normal)', () => {
  assert.equal(partida(partidaDeXadrez, { nivel: 'mestre' }).ver().escolhas.nivel, 'mestre');
  assert.equal(partida(partidaDeXadrez, { nivel: 'iniciante' }).ver().escolhas.nivel, 'iniciante');
  assert.equal(partida(partidaDeXadrez, { nivel: 'impossivel' }).ver().escolhas.nivel, 'normal');
});

test('a conta do robô que volta depois de "voltar o lance" é jogada fora, e a partida segue', async () => {
  const p = partida(partidaDeXadrez, { nivel: 'mestre' });
  const minhaVez = () => p.ver().vez === 0 && p.ver().lances.length > 0;
  if (!minhaVez()) {
    p.andar();
    await esperar(minhaVez);
  }
  const antes = p.ver().casas.join();
  const l = p.ver().lances[0];
  assert.equal(p.jogo.acao(1, { tipo: 'jogada', de: l.de, para: l.para }), null);
  p.andar(); // a pausa passa; o robô (Mestre) ainda pensa
  assert.equal(p.jogo.acao(1, { tipo: 'voltar' }), null);
  assert.equal(p.ver().casas.join(), antes, 'voltou');
  await new Promise((r) => setTimeout(r, NIVEIS_DO_MOTOR.mestre.tempoMs + 800));
  assert.equal(p.ver().casas.join(), antes, 'a conta velha não mexeu na mesa');
  assert.ok(minhaVez(), 'a vez continua da pessoa');
});

// ---------------------------------------------------------------------------------------------------------------------------
// PROBLEMAS: A SEQUÊNCIA E A DICA
// ---------------------------------------------------------------------------------------------------------------------------

function recordesDeMao(): RecordesDoXadrez & { guardados: Map<string, number> } {
  const guardados = new Map<string, number>();
  return {
    guardados,
    recordeDoSolo: (u, j, v = '') => (guardados.has(`${u}:${j}:${v}`) ? { valor: guardados.get(`${u}:${j}:${v}`)! } : null),
    guardarRecordeDoSolo(u, j, v, valor) {
      const k = `${u}:${j}:${v}`;
      const antes = guardados.get(k) ?? null;
      const novo = antes === null || valor > antes;
      if (novo) guardados.set(k, valor);
      return { antes, novo };
    },
  };
}
const semente = (s: number) => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const solucaoDe = (id: string) => PROBLEMAS.find(([p]) => p === id)![2].split(' ');

test('Problemas em sequência: cada acerto sobe a nota, o primeiro erro acaba, e o recorde é do servidor', () => {
  const db = recordesDeMao();
  const p = partida(criarXadrez({ aleatorio: semente(3), recordes: db }), { modo: 'sequencia' });
  assert.equal(p.ver().modo, 'sequencia');
  const notas: number[] = [];
  for (let k = 0; k < 4; k++) {
    notas.push(p.ver().nota);
    const lances = solucaoDe(p.ver().problema);
    for (let i = 1; i < lances.length; i += 2) assert.equal(p.jogo.acao(1, { tipo: 'lance', lance: lances[i] }), null);
  }
  assert.equal(p.ver().sequencia.acertos, 4);
  assert.ok(notas[3] > notas[0], `a nota subiu: ${notas.join(', ')}`);
  // erra: acabou
  const lances = solucaoDe(p.ver().problema);
  const errado = p.ver().lances.map((l: { de: number; para: number }) => nomeDe(l.de) + nomeDe(l.para)).find((x: string) => x !== lances[1].slice(0, 4));
  p.jogo.acao(1, { tipo: 'lance', lance: errado });
  assert.equal(p.ver().fase, 'fim');
  assert.ok(p.terminou());
  assert.equal(db.guardados.get('1:xadrez:sequencia'), 4);
  assert.equal(p.ver().sequencia.recorde.novo, true);
});

test('A dica: acende a peça certa; nas rodadas o problema não pontua, na sequência não conta, na corrida custa 10 s', () => {
  // as rodadas, na sala: quem pediu dica acerta e não leva ponto
  const sala = partida(criarXadrez({ aleatorio: semente(9) }), {}, false, [1, 2]);
  const lances = solucaoDe(sala.ver().problema);
  assert.equal(sala.ver().dica, null);
  assert.equal(sala.jogo.acao(1, { tipo: 'dica' }), null);
  assert.equal(sala.ver(1).dica, casa(lances[1].slice(0, 2)), 'a dica é a casa da peça que move');
  assert.equal(sala.ver(2).dica, null, 'a dica é só de quem pediu');
  for (let i = 1; i < lances.length; i += 2) sala.jogo.acao(1, { tipo: 'lance', lance: lances[i] });
  for (let i = 1; i < lances.length; i += 2) sala.jogo.acao(2, { tipo: 'lance', lance: lances[i] });
  const placar = Object.fromEntries(sala.ver().placar.map((l: { userId: number; pontos: number }) => [l.userId, l.pontos]));
  assert.equal(placar[1], 0, 'com dica, sem ponto');
  assert.equal(placar[2], 2, 'sem dica: o ponto e o extra');

  // a sequência: o acerto com dica passa, mas não conta
  const db = recordesDeMao();
  const seq = partida(criarXadrez({ aleatorio: semente(4), recordes: db }), { modo: 'sequencia' });
  seq.jogo.acao(1, { tipo: 'dica' });
  const l2 = solucaoDe(seq.ver().problema);
  for (let i = 1; i < l2.length; i += 2) seq.jogo.acao(1, { tipo: 'lance', lance: l2[i] });
  assert.equal(seq.ver().sequencia.acertos, 0);
  assert.equal(seq.ver().sequencia.comDica, 1);
  assert.notEqual(seq.ver().fase, 'fim', 'segue para o próximo');

  // a corrida: -10 s por dica (a mesma dica pedida de novo não cobra de novo)
  const agora = 5_000_000;
  const cor = partida(criarXadrez({ agora: () => agora, aleatorio: semente(5) }), { modo: 'corrida' });
  cor.jogo.acao(1, { tipo: 'dica' });
  cor.jogo.acao(1, { tipo: 'dica' });
  assert.equal(cor.ver().corrida.restanteMs, CORRIDA_MS - PENALIDADE_MS);
  assert.equal(cor.ver().corrida.dicas, 1);
});
