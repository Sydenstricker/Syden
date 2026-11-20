/**
 * A MESA COMUM e as regras novas dos jogos dela (19/11/2026, a auditoria dos mini-games): o nível do robô (o difícil ganha do
 * fácil na maioria), voltar o lance no Solo, a oferta de empate na sala, o relógio de partida, o histórico; e, por jogo, o
 * "exatamente 5" e a troca do Cinco em linha, as sementes e o Oware da Mancala, a repetição tripla das Damas, o salvo, a pontaria
 * e o robô que conta as posições da Batalha naval, o voltar e as capturadas do xadrez, a corrida e o "tente de novo" dos
 * Problemas de xadrez, e os dados iguais, o engarrafamento pago, a partida rápida e a troca proposta pelo robô no Capitais.
 * O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Chess } from 'chess.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';
import type { Contexto, Definicao, Jogo } from '../src/minijogo-motor.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const tab = await import('../src/minijogo-tabuleiro.js');
const { duelo, gomoku, mancala, jogadaDoGomoku, jogadaDaMancala, linhaDeCinco, semear, semearOware, lancesDoOware, PROFUNDIDADE_DA_MANCALA_NO, LADO_DO_GOMOKU, RELOGIOS } = tab;
const { damas, regrasDasDamas, lanceDoRobo: lanceDasDamas, lancesDe, aplicar, NIVEL_DAS_DAMAS, corDa, VAZIA, DAMA_CLARA, DAMA_ESCURA } = await import('../src/minijogo-damas.js');
const { criarNaval, sortearFrota, tiroNoNivel, CASAS_DO_MAR, FROTA } = await import('../src/minijogo-naval.js');
const { partidaDeXadrez, lanceDoRobo: lanceDoXadrez, nomeDe } = await import('../src/minijogo-partida-de-xadrez.js');
const { criarXadrez, PROBLEMAS, CORRIDA_MS, PENALIDADE_MS } = await import('../src/minijogo-xadrez.js');
const cidadesMod = await import('../src/minijogo-cidades.js');
const db = await import('../src/db.js');

const ana = await criarConta(app, 'ana-mesa');
const bia = await criarConta(app, 'bia-mesa');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

function semente(s: number) {
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Uma partida com o relógio de mão. */
function partida(def: Definicao, { solo = true, corpo = {} as Record<string, unknown>, naSala = [anaId] } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => void (terminou = true),
    naSala: () => naSala,
    nome: (id) => (id === anaId ? 'ana' : id === biaId ? 'bia' : `p${id}`),
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
    ver: (quem = anaId) => jogo.publico(quem) as Record<string, any>,
    andar: () => relogio[0].depois(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// OS NÍVEIS: o difícil ganha do fácil na maioria
// ---------------------------------------------------------------------------------------------------------------------------

test('Mancala: o robô difícil ganha do fácil na maioria (nas duas variantes)', () => {
  for (const variante of ['kalah', 'oware'] as const) {
    let dificil = 0;
    let facil = 0;
    for (let g = 0; g < 8; g++) {
      const sorte = semente(g + 1);
      const casas = Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : 4));
      const ladoDificil = (g % 2) as 0 | 1;
      let vez: 0 | 1 = 0;
      let semCaptura = 0;
      for (let k = 0; k < 400; k++) {
        const nivel = vez === ladoDificil ? 'dificil' : 'facil';
        const casa = jogadaDaMancala(casas, vez, sorte, PROFUNDIDADE_DA_MANCALA_NO[nivel], variante, nivel === 'facil' ? 3 : 0.1);
        assert.ok(casa >= 0);
        const r = variante === 'oware' ? semearOware(casas, vez, casa, semCaptura) : semear(casas, vez, casa);
        if (variante === 'oware') semCaptura = (r as { levou: number }).levou ? 0 : semCaptura + 1;
        if (r.acabou) break;
        vez = r.proximo;
      }
      const meu = casas[ladoDificil === 0 ? 6 : 13];
      const dele = casas[ladoDificil === 0 ? 13 : 6];
      if (meu > dele) dificil++;
      else if (dele > meu) facil++;
    }
    assert.ok(dificil > facil && dificil >= 5, `${variante}: difícil ${dificil} × fácil ${facil}`);
  }
});

test('Damas: o robô difícil ganha do fácil na maioria', () => {
  let dificil = 0;
  let facil = 0;
  for (let g = 0; g < 4; g++) {
    const sorte = semente(g + 11);
    const e = regrasDasDamas.inicio({});
    const corDificil = (g % 2) as 0 | 1;
    let cor: 0 | 1 = 0;
    for (let k = 0; k < 120; k++) {
      if (!lancesDe(e.casas, cor).length) break;
      const { profundidade, ruido } = NIVEL_DAS_DAMAS[cor === corDificil ? 'dificil' : 'facil'];
      const i = lanceDasDamas(e.casas, cor, sorte, profundidade, ruido);
      aplicar(e.casas, lancesDe(e.casas, cor)[i]);
      cor = cor === 0 ? 1 : 0;
    }
    // sem lance perde; senão, conta o material (dama vale 3)
    const valor = (c: 0 | 1) => e.casas.reduce((s, p) => s + (corDa(p) === c ? (p === DAMA_CLARA || p === DAMA_ESCURA ? 3 : 1) : 0), 0);
    const semLance = lancesDe(e.casas, cor).length === 0 ? cor : null;
    const d = semLance === corDificil ? -1 : semLance !== null ? 1 : valor(corDificil) - valor(corDificil === 0 ? 1 : 0);
    if (d > 0) dificil++;
    else if (d < 0) facil++;
  }
  assert.ok(dificil > facil, `difícil ${dificil} × fácil ${facil}`);
});

test('Cinco em linha: o robô difícil ganha do fácil na maioria, e olha à frente em pouco tempo', () => {
  let dificil = 0;
  let facil = 0;
  let maisLento = 0;
  for (let g = 0; g < 6; g++) {
    const sorte = semente(g + 21);
    const casas = new Array<number>(LADO_DO_GOMOKU * LADO_DO_GOMOKU).fill(0);
    const corDificil = 1 + (g % 2);
    let cor = 1;
    for (let k = 0; k < 225; k++) {
      const t = performance.now();
      const i = jogadaDoGomoku(casas, cor, sorte, LADO_DO_GOMOKU, cor === corDificil ? 'dificil' : 'facil');
      if (cor === corDificil) maisLento = Math.max(maisLento, performance.now() - t);
      casas[i] = cor;
      if (linhaDeCinco(casas, i)) {
        if (cor === corDificil) dificil++;
        else facil++;
        break;
      }
      cor = cor === 1 ? 2 : 1;
    }
  }
  assert.ok(dificil >= 4 && dificil > facil, `difícil ${dificil} × fácil ${facil}`);
  assert.ok(maisLento < 5000, `o difícil levou ${maisLento} ms`);
});

test('Batalha naval: o robô difícil (que conta as posições) afunda a frota com menos tiros que o fácil, na maioria', () => {
  let melhor = 0;
  const tirosAte = (frota: number[][], nivel: 'facil' | 'dificil', sorte: () => number) => {
    const tiros = new Array<number>(CASAS_DO_MAR).fill(0);
    const navio = (c: number) => frota.find((n) => n.includes(c));
    for (let k = 1; k <= CASAS_DO_MAR; k++) {
      const afundados = frota.filter((n) => n.every((c) => tiros[c]));
      const restam = frota.filter((n) => !afundados.includes(n)).map((n) => n.length);
      const casa = tiroNoNivel({ tiros, navios: afundados.map((casas) => ({ casas, afundado: true })) }, restam, nivel, sorte);
      assert.equal(tiros[casa], 0, 'nunca atira duas vezes na mesma casa');
      tiros[casa] = navio(casa) ? 2 : 1;
      if (frota.every((n) => n.every((c) => tiros[c]))) return k;
    }
    return CASAS_DO_MAR;
  };
  for (let g = 0; g < 10; g++) {
    const frota = sortearFrota(semente(g + 31));
    if (tirosAte(frota, 'dificil', semente(g + 41)) < tirosAte(frota, 'facil', semente(g + 41))) melhor++;
  }
  assert.ok(melhor >= 7, `o difícil foi melhor em ${melhor} de 10`);
});

test('Xadrez: o robô difícil ganha do fácil, e nunca segura a mesa', () => {
  let dificil = 0;
  let facil = 0;
  let maisLento = 0;
  const VALOR: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  for (let g = 0; g < 2; g++) {
    const sorte = semente(g + 51);
    const jogo = new Chess();
    const difBrancas = g === 0;
    for (let p = 0; p < 50 && !jogo.isGameOver(); p++) {
      const nivel = (jogo.turn() === 'w') === difBrancas ? 'dificil' : 'facil';
      const t = performance.now();
      const l = lanceDoXadrez(jogo.fen(), sorte, nivel)!;
      if (nivel === 'dificil') maisLento = Math.max(maisLento, performance.now() - t);
      jogo.move({ from: nomeDe(l.de), to: nomeDe(l.para), promotion: 'q' });
    }
    const corDif = difBrancas ? 'w' : 'b';
    if (jogo.isCheckmate()) {
      if (jogo.turn() !== corDif) dificil++;
      else facil++;
      continue;
    }
    // sem mate em 50 lances, o material decide
    let material = 0;
    for (const linha of jogo.board()) for (const c of linha) if (c) material += (c.color === corDif ? 1 : -1) * VALOR[c.type];
    if (material > 0) dificil++;
    else if (material < 0) facil++;
  }
  assert.ok(dificil >= 1 && facil === 0, `difícil ${dificil} × fácil ${facil}`);
  assert.ok(maisLento < 5000, `o difícil levou ${maisLento} ms`);
});

// ---------------------------------------------------------------------------------------------------------------------------
// A MESA COMUM
// ---------------------------------------------------------------------------------------------------------------------------

test('no Solo, voltar o lance desfaz o da pessoa e a resposta do robô, com o histórico junto', () => {
  const p = partida(gomoku, { corpo: { nivel: 'facil' } });
  let v = p.ver();
  assert.equal(v.escolhas.nivel, 'facil');
  assert.equal(v.podeVoltar, false);
  // se o robô abre, ele joga primeiro
  if (v.vez !== 0) {
    p.andar();
    v = p.ver();
  }
  const antes = v.casas.filter(Boolean).length;
  const livre = v.casas.findIndex((x: number) => !x);
  assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', casa: livre }), null);
  p.andar(); // o robô responde
  v = p.ver();
  assert.equal(v.casas.filter(Boolean).length, antes + 2);
  assert.equal(v.historico.length, antes + 2);
  assert.equal(v.podeVoltar, true);
  assert.equal(p.jogo.acao(anaId, { tipo: 'voltar' }), null);
  v = p.ver();
  assert.equal(v.casas.filter(Boolean).length, antes);
  assert.equal(v.historico.length, antes);
  assert.equal(v.vez, 0, 'a vez volta para a pessoa');
  assert.equal(p.relogio[0].ms, tab.JOGADA_SOLO_MS, 'e o robô não joga sozinho depois de voltar');
  assert.equal(p.jogo.acao(anaId, { tipo: 'voltar' }), 'Não há lance para voltar.');
});

test('na sala, não se volta o lance; o empate oferecido cai no lance seguinte, e aceito acaba a partida', () => {
  const p = partida(gomoku, { solo: false, naSala: [anaId, biaId] });
  assert.equal(p.jogo.acao(biaId, { tipo: 'sentar' }), null);
  let v = p.ver();
  const daVez = v.jogadores[v.vez].userId as number;
  const outro = daVez === anaId ? biaId : anaId;
  assert.match(p.jogo.acao(daVez, { tipo: 'voltar' })!, /computador/);
  assert.equal(p.jogo.acao(outro, { tipo: 'empate', acao: 'aceitar' }), 'Ninguém ofereceu empate.');
  assert.equal(p.jogo.acao(daVez, { tipo: 'empate', acao: 'oferecer' }), null);
  assert.equal(p.ver().oferta, v.vez);
  // a jogada derruba a oferta
  assert.equal(p.jogo.acao(daVez, { tipo: 'jogada', casa: 112 }), null);
  assert.equal(p.ver().oferta, null);
  assert.equal(p.jogo.acao(outro, { tipo: 'empate', acao: 'oferecer' }), null);
  assert.equal(p.jogo.acao(daVez, { tipo: 'empate', acao: 'recusar' }), null);
  assert.equal(p.ver().oferta, null);
  assert.equal(p.jogo.acao(outro, { tipo: 'empate', acao: 'oferecer' }), null);
  assert.equal(p.jogo.acao(daVez, { tipo: 'empate', acao: 'aceitar' }), null);
  v = p.ver();
  assert.equal(v.fase, 'fim');
  assert.equal(v.vencedor, 'empate');
  assert.equal(v.motivo, 'acordo');
  assert.ok(p.terminou());
});

test('contra o computador, não há oferta de empate', () => {
  const p = partida(mancala);
  assert.match(p.jogo.acao(anaId, { tipo: 'empate', acao: 'oferecer' })!, /computador/);
});

test('o relógio de partida: cada um gasta o seu, ganha o acréscimo, e quem zera perde', () => {
  let agora = 1_000_000;
  // um jogo mínimo: qualquer jogada passa a vez
  const simples = duelo<{ n: number }>({ inicio: () => ({ n: 0 }), jogar: (e, lado) => (e.n++, { proximo: lado === 0 ? 1 : 0 }), publico: (e) => ({ n: e.n }) }, () => 0.1, () => agora);
  const p = partida(simples, { solo: false, naSala: [anaId, biaId], corpo: { relogio: '3+2' } });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  let v = p.ver();
  assert.equal(v.vez, 0);
  assert.equal(p.relogio[0].ms, RELOGIOS['3+2'].baseMs, 'o prazo é o tempo inteiro de quem joga');
  agora += 10_000;
  assert.deepEqual(p.ver().relogio.restam, [170_000, 180_000]);
  assert.equal(p.jogo.acao(anaId, { tipo: 'jogada' }), null);
  v = p.ver();
  assert.deepEqual(v.relogio.restam, [172_000, 180_000], 'gastou 10 s e ganhou 2');
  assert.equal(p.relogio[0].ms, 180_000);
  agora += 180_000;
  p.andar();
  v = p.ver();
  assert.equal(v.fase, 'fim');
  assert.equal(v.motivo, 'tempo');
  assert.equal(v.vencedor, 0);
  // um relógio que não existe cai no prazo por lance
  const sem = partida(simples, { solo: false, naSala: [anaId, biaId], corpo: { relogio: '1+0' } });
  sem.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(sem.ver().relogio, null);
  assert.equal(sem.relogio[0].ms, tab.JOGADA_MS);
});

// ---------------------------------------------------------------------------------------------------------------------------
// CINCO EM LINHA
// ---------------------------------------------------------------------------------------------------------------------------

test('Cinco em linha: com "exatamente 5", seis seguidas não ganham', () => {
  const casas = new Array<number>(225).fill(0);
  for (const c of [0, 1, 2, 4, 5]) casas[c] = 1;
  casas[3] = 1;
  assert.ok(linhaDeCinco(casas, 3));
  assert.equal(linhaDeCinco(casas, 3, LADO_DO_GOMOKU, true), null);
  casas[5] = 0;
  assert.deepEqual(linhaDeCinco(casas, 3, LADO_DO_GOMOKU, true), [0, 1, 2, 3, 4]);
});

test('Cinco em linha com a troca: quem abre põe três pedras, e quem responde escolhe a cor', () => {
  for (const trocar of [true, false]) {
    const p = partida(gomoku, { solo: false, naSala: [anaId, biaId], corpo: { troca: true } });
    p.jogo.acao(biaId, { tipo: 'sentar' });
    let v = p.ver();
    const abre = v.jogadores[v.vez].userId as number;
    const responde = abre === anaId ? biaId : anaId;
    for (const casa of [112, 113, 114]) assert.equal(p.jogo.acao(abre, { tipo: 'jogada', casa }), null);
    v = p.ver();
    assert.deepEqual([v.casas[112], v.casas[113], v.casas[114]], [1, 2, 1], 'escura, clara, escura');
    assert.equal(v.decidindo, true);
    assert.equal(v.jogadores[v.vez].userId, responde);
    assert.equal(p.jogo.acao(responde, { tipo: 'jogada', casa: 0 }), 'Escolha a sua cor.');
    assert.equal(p.jogo.acao(responde, { tipo: 'jogada', trocar }), null);
    v = p.ver();
    const ladoResponde = v.jogadores.findIndex((j: { userId: number }) => j.userId === responde);
    assert.equal(v.cores[ladoResponde], trocar ? 1 : 2);
    // as claras jogam agora, sejam de quem forem
    const daVez = v.jogadores[v.vez].userId;
    assert.equal(daVez, trocar ? abre : responde);
    assert.equal(p.jogo.acao(daVez, { tipo: 'jogada', casa: 0 }), null);
    assert.equal(p.ver().casas[0], 2);
  }
  // contra o robô, a abertura e a escolha andam sozinhas
  const solo = partida(gomoku, { corpo: { troca: true, nivel: 'dificil' } });
  for (let k = 0; k < 8 && solo.ver().vez !== 0; k++) solo.andar();
  assert.equal(solo.ver().fase, 'jogando');
});

// ---------------------------------------------------------------------------------------------------------------------------
// MANCALA
// ---------------------------------------------------------------------------------------------------------------------------

test('Mancala: 3 a 6 sementes por casa, e o estado de antes para a tela animar', () => {
  const p = partida(mancala, { corpo: { sementes: 6 } });
  let v = p.ver();
  assert.equal(v.casas[0], 6);
  assert.equal(v.escolhas.sementes, 6);
  assert.equal(partida(mancala, { corpo: { sementes: 9 } }).ver().casas[0], 4, 'fora da faixa, o padrão');
  if (v.vez !== 0) p.andar();
  v = p.ver();
  const casa = [0, 1, 2, 3, 4, 5].find((c) => v.casas[c] > 0)!;
  const antes = v.casas.slice();
  assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', casa }), null);
  v = p.ver();
  assert.deepEqual(v.antes, antes);
  assert.equal(v.ultima, casa);
  assert.equal(v.quem, 0);
  assert.equal(v.historico.at(-1).texto, String(casa + 1));
});

test('Oware: pula a casa de saída, captura 2 e 3 para trás, não faz o grande golpe e obriga a alimentar', () => {
  // a captura: a última semente cai na casa 8 do outro, que fica com 3; a 7 também tem 2 (depois de semear): leva as duas
  let casas = [0, 0, 0, 0, 0, 2, 0, 1, 2, 4, 4, 4, 4, 0];
  let r = semearOware(casas, 0, 5);
  assert.equal(r.levou, 5);
  assert.equal(casas[6], 5);
  assert.equal(casas[7] + casas[8], 0);
  // o grande golpe: levaria tudo do outro, então não leva nada
  casas = [0, 0, 0, 0, 0, 2, 0, 1, 2, 0, 0, 0, 0, 0];
  r = semearOware(casas, 0, 5);
  assert.equal(r.levou, 0);
  assert.equal(casas[7], 2);
  // com 12 ou mais, a casa de saída fica vazia
  casas = [12, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0];
  semearOware(casas, 0, 0);
  assert.equal(casas[0], 0);
  // alimentar: o outro está vazio, então só valem as casas que chegam lá
  casas = [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(lancesDoOware(casas, 0), [5]);
  const p = partida(mancala, { solo: false, naSala: [anaId, biaId], corpo: { variante: 'oware' } });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  assert.equal(p.ver().variante, 'oware');
});

// ---------------------------------------------------------------------------------------------------------------------------
// DAMAS
// ---------------------------------------------------------------------------------------------------------------------------

test('Damas: a mesma posição pela terceira vez empata, e o lance vai ao histórico em números', () => {
  const e = regrasDasDamas.inicio({});
  e.casas = new Array<number>(64).fill(VAZIA);
  // uma dama de cada lado, longe uma da outra
  e.casas[63] = DAMA_CLARA; // h1
  e.casas[0 * 8 + 1] = DAMA_ESCURA; // b8
  e.vezDaCor = 0;
  e.comecou = true;
  e.lances = lancesDe(e.casas, 0);
  e.vistas = { [`${e.casas.join('')}0`]: 1 };
  const mover = (de: number, para: number) => {
    const lado = corDa(e.casas[de]) === 0 ? 0 : 1;
    const n = e.lances.findIndex((l) => l.de === de && l.caminho.at(-1) === para);
    assert.ok(n >= 0, `${de}→${para}`);
    return regrasDasDamas.jogar(e, lado as 0 | 1, { lance: n });
  };
  // ida e volta duas vezes: a posição inicial aparece pela terceira vez no oitavo lance
  let r: ReturnType<typeof mover> = { proximo: 0 };
  for (let volta = 0; volta < 2; volta++) {
    for (const [de, para] of [[63, 54], [1, 10], [54, 63], [10, 1]]) r = mover(de, para);
  }
  assert.deepEqual(r, { proximo: 0, vencedor: 'empate' });
  assert.equal(regrasDasDamas.publico(e, null).repetida, true);
  const p = partida(damas);
  if (p.ver().vez !== 0) p.andar();
  assert.equal(p.jogo.acao(anaId, { tipo: 'jogada', lance: 0 }), null);
  assert.match(p.ver().historico[p.ver().historico.length - 1].texto, /^\d+-\d+$/);
});

// ---------------------------------------------------------------------------------------------------------------------------
// BATALHA NAVAL
// ---------------------------------------------------------------------------------------------------------------------------

test('Batalha naval: no salvo, a rajada tem um tiro por navio vivo, a vez passa sempre, e a pontaria é contada', () => {
  const p = partida(criarNaval(semente(3)), { solo: false, naSala: [anaId, biaId], corpo: { salvo: true } });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  for (const id of [anaId, biaId]) {
    p.jogo.acao(id, { tipo: 'montar', acao: 'sortear' });
    p.jogo.acao(id, { tipo: 'montar', acao: 'pronto' });
  }
  let v = p.ver();
  assert.equal(v.fase, 'jogando');
  assert.equal(v.salvo, true);
  assert.deepEqual(v.tirosDaRajada, [FROTA.length, FROTA.length]);
  const daVez = v.jogadores[v.vez].userId as number;
  assert.equal(p.jogo.acao(daVez, { tipo: 'jogada', casas: [0, 1] }), 'Escolha todas as casas da rajada.');
  assert.equal(p.jogo.acao(daVez, { tipo: 'jogada', casas: [0, 0, 1, 2, 3] }), 'Escolha uma casa do mar.');
  assert.equal(p.jogo.acao(daVez, { tipo: 'jogada', casas: [0, 1, 2, 3, 4] }), null);
  v = p.ver();
  assert.notEqual(v.jogadores[v.vez].userId, daVez, 'a vez passa, acertando ou não');
  assert.equal(v.rajada.tiros.length, 5);
  const meuLado = v.jogadores.findIndex((j: { userId: number }) => j.userId === daVez);
  assert.equal(v.pontaria[meuLado].tiros, 5);
  assert.equal(v.pontaria[meuLado].acertos, v.rajada.tiros.filter((t: { resultado: string }) => t.resultado !== 'agua').length);
  assert.equal(v.historico.length, 1);
  assert.equal(v.historico[0].texto.split(' ').length, 5);
  // no Solo, o robô difícil manda a rajada inteira, e não se volta tiro
  const solo = partida(criarNaval(semente(4)), { corpo: { salvo: true, nivel: 'dificil' } });
  solo.jogo.acao(anaId, { tipo: 'montar', acao: 'sortear' });
  solo.jogo.acao(anaId, { tipo: 'montar', acao: 'pronto' });
  if (solo.ver().vez !== 0) solo.andar();
  assert.equal(solo.ver().vez, 0);
  assert.equal(solo.jogo.acao(anaId, { tipo: 'jogada', casas: [10, 11, 12, 13, 14] }), null);
  assert.equal(solo.ver().podeVoltar, false);
  assert.match(solo.jogo.acao(anaId, { tipo: 'voltar' })!, /computador/);
  solo.andar();
  assert.equal(solo.ver().vez, 0, 'o robô atirou a rajada dele');
});

// ---------------------------------------------------------------------------------------------------------------------------
// PARTIDA DE XADREZ
// ---------------------------------------------------------------------------------------------------------------------------

test('Xadrez: o histórico em notação algébrica, as peças capturadas, e voltar refaz a partida', async () => {
  const p = partida(partidaDeXadrez, { solo: false, naSala: [anaId, biaId] });
  p.jogo.acao(biaId, { tipo: 'sentar' });
  const v0 = p.ver();
  const brancas = v0.jogadores[v0.brancas].userId as number;
  const pretas = brancas === anaId ? biaId : anaId;
  const casa = (n: string) => (8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0]);
  const jogar = (quem: number, de: string, para: string) => assert.equal(p.jogo.acao(quem, { tipo: 'jogada', de: casa(de), para: casa(para) }), null);
  jogar(brancas, 'e2', 'e4');
  jogar(pretas, 'd7', 'd5');
  jogar(brancas, 'e4', 'd5');
  const v = p.ver();
  assert.deepEqual(v.historico.map((h: { texto: string }) => h.texto), ['e4', 'd5', 'exd5']);
  assert.deepEqual(v.capturadas, { brancas: [], pretas: ['p'] });

  const solo = partida(partidaDeXadrez, { corpo: { nivel: 'facil' } });
  // o robô pensa no worker (xadrez-robo.ts): a vez da pessoa volta um instante depois da pausa
  const minhaVez = async () => {
    for (let i = 0; i < 400 && !(solo.ver().vez === 0 && solo.ver().lances.length); i++) await new Promise((r) => setTimeout(r, 20));
  };
  if (solo.ver().vez !== 0) {
    solo.andar();
    await minhaVez();
  }
  const antes = solo.ver().casas.join();
  const lance = solo.ver().lances[0];
  assert.equal(solo.jogo.acao(anaId, { tipo: 'jogada', de: lance.de, para: lance.para }), null);
  solo.andar();
  await minhaVez();
  assert.notEqual(solo.ver().casas.join(), antes);
  assert.equal(solo.jogo.acao(anaId, { tipo: 'voltar' }), null);
  assert.equal(solo.ver().casas.join(), antes);
  assert.ok(solo.ver().lances.length > 0, 'a vez é da pessoa de novo');
});

// ---------------------------------------------------------------------------------------------------------------------------
// PROBLEMAS DE XADREZ
// ---------------------------------------------------------------------------------------------------------------------------

test('Problemas de xadrez: as casas que a peça alcança, e no Solo o "tente de novo" sem perder o problema', () => {
  const p = partida(criarXadrez({ aleatorio: semente(5) }));
  let v = p.ver();
  assert.ok(v.lances.length > 0);
  const [, , texto] = PROBLEMAS.find(([id]) => id === v.problema)!;
  const certo = texto.split(' ')[1];
  assert.ok(v.lances.some((l: { de: number; para: number }) => nomeDe(l.de) + nomeDe(l.para) === certo.slice(0, 4)), 'o lance certo está entre os destinos');
  const errado = v.lances.map((l: { de: number; para: number }) => nomeDe(l.de) + nomeDe(l.para)).find((x: string) => x !== certo.slice(0, 4));
  assert.equal(p.jogo.acao(anaId, { tipo: 'lance', lance: errado }), null);
  v = p.ver();
  assert.equal(v.estado, 'errou');
  assert.equal(v.fase, 'resolvendo', 'no Solo, errar não mostra a solução na hora');
  assert.equal(v.podeTentarDeNovo, true);
  const problema = v.problema;
  assert.equal(p.jogo.acao(anaId, { tipo: 'de-novo' }), null);
  v = p.ver();
  assert.equal(v.estado, 'resolvendo');
  assert.equal(v.problema, problema);
  // na sala, não há "de novo"
  const sala = partida(criarXadrez(), { solo: false, naSala: [anaId, biaId] });
  assert.match(sala.jogo.acao(anaId, { tipo: 'de-novo' })!, /Solo/);
});

test('Problemas de xadrez em corrida: 3 minutos, o erro tira 10 s, e o recorde é contado pelo servidor', () => {
  let agora = 9_000_000;
  const p = partida(criarXadrez({ agora: () => agora, aleatorio: semente(6), recordes: db }), { corpo: { modo: 'corrida' } });
  let v = p.ver();
  assert.equal(v.modo, 'corrida');
  assert.equal(p.relogio[0].ms, CORRIDA_MS);
  // resolve o primeiro
  const resolver = () => {
    const lances = PROBLEMAS.find(([id]) => id === p.ver().problema)![2].split(' ');
    for (let i = 1; i < lances.length; i += 2) assert.equal(p.jogo.acao(anaId, { tipo: 'lance', lance: lances[i] }), null);
  };
  const primeiro = v.problema;
  resolver();
  v = p.ver();
  assert.equal(v.corrida.resolvidos, 1);
  assert.notEqual(v.problema, primeiro, 'o próximo vem na hora');
  // erra o segundo: perde 10 s e passa
  agora += 20_000;
  const lances = PROBLEMAS.find(([id]) => id === v.problema)![2].split(' ');
  const errado = v.lances.map((l: { de: number; para: number }) => nomeDe(l.de) + nomeDe(l.para)).find((x: string) => x !== lances[1].slice(0, 4));
  p.jogo.acao(anaId, { tipo: 'lance', lance: errado });
  v = p.ver();
  assert.equal(v.corrida.erros, 1);
  assert.equal(v.corrida.restanteMs, CORRIDA_MS - 20_000 - PENALIDADE_MS);
  assert.equal(p.relogio[0].ms, CORRIDA_MS - 20_000 - PENALIDADE_MS);
  agora += 200_000;
  p.andar();
  v = p.ver();
  assert.equal(v.fase, 'fim');
  assert.ok(p.terminou());
  assert.equal(db.recordeDoSolo(anaId, 'xadrez', 'corrida')?.valor, 1);
  assert.equal(v.corrida.recorde.novo, true);
});

test('Problemas de xadrez por tema: sem o tema no arquivo, a partida não começa', () => {
  const temTemas = PROBLEMAS.some((p) => (p[4] ?? '') !== '');
  const r = criarXadrez().comecar(
    { agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => [anaId], nome: () => 'ana', solo: true },
    { naSala: [anaId], criadaPor: anaId, corpo: { tema: 'mateIn1' } },
  );
  if (!temTemas) assert.equal(r, 'Ainda não há problemas desse tema.');
  else assert.notEqual(typeof r, 'string');
});

// ---------------------------------------------------------------------------------------------------------------------------
// CAPITAIS
// ---------------------------------------------------------------------------------------------------------------------------

function cidades(corpo: Record<string, unknown>, sortes: number[], { solo = false, naSala = [anaId, biaId] } = {}) {
  let agora = 4_000_000;
  let k = 0;
  // os números do sorteio, em ordem (o embaralhar da ordem dos jogadores e dos dados), e depois 0,5
  const aleatorio = () => (k < sortes.length ? sortes[k++] : 0.5);
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => naSala,
    nome: (id) => (id === anaId ? 'ana' : 'bia'),
    comunidade: solo ? 0 : 7,
    solo,
  };
  const jogo = cidadesMod.criarCidades({ agora: () => agora, aleatorio }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo }) as Jogo;
  assert.notEqual(typeof jogo, 'string');
  return {
    jogo,
    relogio,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ver: () => jogo.publico(anaId) as Record<string, any>,
    andar() {
      agora += relogio[0].ms;
      relogio[0].depois();
    },
    sortes,
  };
}

test('Capitais rápida: cada um começa com 2 cidades sorteadas, e ninguém com um grupo inteiro', () => {
  for (let s = 1; s <= 10; s++) {
    const sorte = semente(s);
    const p = cidades({ rapida: true }, Array.from({ length: 200 }, () => sorte()));
    const v = p.ver();
    assert.equal(v.rapida, true);
    for (const id of [anaId, biaId]) {
      const minhas = v.posses.filter((x: { dono: number }) => x.dono === id).map((x: { casa: number }) => x.casa);
      assert.equal(minhas.length, cidadesMod.CIDADES_DA_RAPIDA);
      for (const c of minhas) {
        const grupo = cidadesMod.CASAS.map((x, i) => (x.tipo === 'cidade' && x.grupo === cidadesMod.CASAS[c].grupo ? i : -1)).filter((i) => i >= 0);
        assert.ok(!grupo.every((i) => minhas.includes(i)), 'não começa com o grupo fechado');
      }
    }
  }
});

test('Capitais: dados iguais jogam de novo, o terceiro par vai ao engarrafamento, e dá para pagar para sair', () => {
  // 0,5 na ordem não troca ninguém; 0,5 nos dados dá 4 e 4 (iguais), sempre
  const p = cidades({}, []);
  const primeiro = p.ver().vez as number;
  const jogar = () => {
    assert.equal(p.jogo.acao(primeiro, { tipo: 'dados' }), null);
    // anda, e recusa a compra (vai a leilão) ou abre as ações
    for (let k = 0; k < 6 && p.ver().fase !== 'acoes'; k++) {
      if (p.ver().fase === 'compra') p.jogo.acao(primeiro, { tipo: 'comprar', sim: false });
      else p.andar();
    }
    assert.equal(p.ver().fase, 'acoes');
    assert.equal(p.jogo.acao(primeiro, { tipo: 'terminar' }), null);
  };
  jogar();
  assert.equal(p.ver().vez, primeiro, 'o primeiro par: joga de novo');
  jogar();
  assert.equal(p.ver().vez, primeiro, 'o segundo par: joga de novo');
  assert.equal(p.jogo.acao(primeiro, { tipo: 'dados' }), null);
  p.andar();
  const v = p.ver();
  const eu = v.jogadores.find((j: { userId: number }) => j.userId === primeiro);
  assert.equal(eu.pos, cidadesMod.ENGARRAFAMENTO, 'o terceiro par: direto ao engarrafamento');
  assert.equal(eu.parado, 1);
  assert.equal(v.fase, 'acoes');
  const dinheiro = eu.dinheiro;
  assert.equal(p.jogo.acao(primeiro, { tipo: 'sair' }), null);
  const depois = p.ver().jogadores.find((j: { userId: number }) => j.userId === primeiro);
  assert.equal(depois.parado, 0);
  assert.equal(depois.dinheiro, dinheiro - cidadesMod.SAIR_DO_ENGARRAFAMENTO);
  assert.equal(p.jogo.acao(primeiro, { tipo: 'sair' }), 'Você não está no engarrafamento.');
  p.jogo.acao(primeiro, { tipo: 'terminar' });
  assert.notEqual(p.ver().vez, primeiro, 'depois do engarrafamento, a vez passa');
});

test('Capitais contra o computador: o robô propõe à pessoa a troca que fecha o grupo dele, e não insiste', () => {
  // a Ana tem a cidade que falta ao robô no grupo 0
  const grupo0 = cidadesMod.CASAS.map((c, i) => (c.tipo === 'cidade' && c.grupo === 0 ? i : -1)).filter((i) => i >= 0);
  let agora = 4_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => {},
    naSala: () => [anaId],
    nome: () => 'ana',
    comunidade: 0,
    solo: true,
  };
  // 0,4 nos dados dá 3 e 3? (1 + floor(0,4·6) = 3): iguais; 0,1 e 0,9 dariam 1 e 6. Usamos dados diferentes depois da ordem.
  const seq = [0.9, 0.1, 0.9];
  let k = 0;
  const jogo = cidadesMod
    .criarCidades({
      agora: () => agora,
      aleatorio: () => (k < seq.length ? seq[k++] : k++ % 2 ? 0.1 : 0.9),
      posses: [[grupo0[0], -1], ...grupo0.slice(1, -1).map((i) => [i, -1] as [number, number]), [grupo0[grupo0.length - 1], anaId]],
    })
    .comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: { robos: 1 } }) as Jogo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ver = () => jogo.publico(anaId) as Record<string, any>;
  const andar = () => {
    agora += relogio[0].ms;
    relogio[0].depois();
  };
  let proposta = null;
  for (let passo = 0; passo < 80 && !proposta; passo++) {
    const v = ver();
    if (v.troca && v.troca.de === -1) proposta = v.troca;
    else if (v.vez === anaId && v.fase === 'vez') jogo.acao(anaId, { tipo: 'dados' });
    else if (v.vez === anaId && v.fase === 'compra') jogo.acao(anaId, { tipo: 'comprar', sim: false });
    else if (v.vez === anaId && v.fase === 'acoes') jogo.acao(anaId, { tipo: 'terminar' });
    else andar();
  }
  assert.ok(proposta, 'o robô propôs');
  assert.equal(proposta.para, anaId);
  assert.deepEqual(proposta.pedirCasas, [grupo0[grupo0.length - 1]]);
  assert.ok(proposta.darDinheiro > cidadesMod.CASAS[grupo0[grupo0.length - 1]].preco!, 'oferece mais que o preço');
  // a Ana recusa; o robô não pede a mesma de novo
  assert.equal(jogo.acao(anaId, { tipo: 'responder', sim: false }), null);
  let deNovo = false;
  for (let passo = 0; passo < 60; passo++) {
    const v = ver();
    if (v.troca && v.troca.de === -1) deNovo = true;
    if (v.vez === anaId && v.fase === 'vez') jogo.acao(anaId, { tipo: 'dados' });
    else if (v.vez === anaId && v.fase === 'compra') jogo.acao(anaId, { tipo: 'comprar', sim: false });
    else if (v.vez === anaId && v.fase === 'acoes') jogo.acao(anaId, { tipo: 'terminar' });
    else if (v.fase === 'troca' && v.troca?.para === anaId) jogo.acao(anaId, { tipo: 'responder', sim: false });
    else if (v.fase !== 'fim') andar();
  }
  assert.equal(deNovo, false);
});
