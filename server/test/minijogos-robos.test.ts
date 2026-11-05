/**
 * OS ADVERSÁRIOS DO COMPUTADOR nos jogos da turma (minijogo-robos.ts; o Cidades à venda tem os testes dele): só no Solo; na
 * mesa (Cinco em linha, Mancala, Damas, Batalha naval) o robô senta na hora e joga lances válidos pela mesma conferência; no
 * Dominó, no Truco e no Tabuleiro da turma a partida vai até o fim com a pessoa parada, e os robôs respondem ao truco. Contra
 * o computador não há troféu. O relógio e o sorteio aqui são de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';
import type { Contexto, Definicao, Jogo } from '../src/minijogo-motor.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const { PAUSA_DO_ROBO, quantosRobos, comRobos, nomeDoRobo } = await import('../src/minijogo-robos.js');
const { gomoku, mancala, JOGADA_SOLO_MS, ESPERANDO_MS, jogadaDoGomoku, LADO_DO_GOMOKU } = await import('../src/minijogo-tabuleiro.js');
const { damas } = await import('../src/minijogo-damas.js');
const { criarNaval, tiroDoRobo, CASAS_DO_MAR } = await import('../src/minijogo-naval.js');
const { criarDomino } = await import('../src/minijogo-domino.js');
const { criarTruco } = await import('../src/minijogo-truco.js');
const { criarTabuleiro } = await import('../src/minijogo-tabuleiro-da-turma.js');

const ana = await criarConta(app, 'ana-robos');
const anaId = (await comToken(app, ana.token)('GET', '/api/me')).json().id as number;

/** Um sorteio que se repete (o mesmo número dá a mesma partida). */
function semente(s: number) {
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

/** Uma partida com o relógio de mão: `andar` dispara o que estiver marcado. */
function partida(def: Definicao, { solo = true, corpo = {} as Record<string, unknown>, naSala = [anaId] } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  let completa: boolean | undefined;
  const ctx: Contexto = {
    agendar: (ms, depois) => void relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (c = true) => {
      terminou = true;
      completa = c;
    },
    naSala: () => naSala,
    nome: (id) => (id === anaId ? 'ana' : `p${id}`),
    comunidade: solo ? 0 : 7,
    solo,
  };
  const jogo = def.comecar(ctx, { naSala, criadaPor: naSala[0], corpo });
  return {
    jogo: jogo as Jogo | string,
    relogio,
    terminou: () => terminou,
    completa: () => completa,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ver: (quem = anaId) => (jogo as Jogo).publico(quem) as Record<string, any>,
    andar() {
      relogio[0].depois();
    },
  };
}

test('os robôs só no Solo: fora dele, o pedido de robôs é ignorado', () => {
  assert.equal(quantosRobos({ solo: false }, { robos: 3 }), 0);
  assert.equal(quantosRobos({ solo: true }, { robos: 3 }), 3);
  assert.equal(quantosRobos({ solo: true }, { robos: 99 }, 3), 3);
  assert.equal(quantosRobos({ solo: true }, { robos: 'x' }), 0);
  const ctx = comRobos({ agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => [5], nome: () => 'ana' }, [-1, -2]);
  assert.deepEqual(ctx.naSala(), [5, -1, -2]);
  assert.equal(ctx.nome(-2), nomeDoRobo(-2));
  assert.match(ctx.nome(-1), /^🤖 /);

  // na mesa da sala, ninguém senta sozinho; no Dominó, no Truco e no Tabuleiro, um só não começa
  const mesa = partida(gomoku, { solo: false });
  assert.equal(mesa.ver().fase, 'esperando');
  assert.equal(mesa.relogio[0].ms, ESPERANDO_MS);
  assert.equal(typeof partida(criarDomino(), { solo: false, corpo: { robos: 3 } }).jogo, 'string');
  assert.equal(typeof partida(criarTruco(), { solo: false, corpo: { robos: 1 } }).jogo, 'string');
  assert.equal(typeof partida(criarTabuleiro(), { solo: false, corpo: { robos: 2 } }).jogo, 'string');
});

/**
 * Uma partida inteira de mesa contra o robô, com a pessoa jogando qualquer lance válido (`minha`): o robô joga sempre na
 * pausa curta, e a partida acaba pelo jogo (nunca porque o robô mandou um lance que as regras recusaram).
 */
function mesaInteira(def: Definicao, minha: (vista: Record<string, unknown>, sorte: () => number) => Record<string, unknown>, s: number, preparar?: (jogo: Jogo) => void) {
  const sorte = semente(s);
  const p = partida(def);
  // a Batalha naval passa antes pela montagem (o robô já está pronto)
  preparar?.(p.jogo as Jogo);
  let v = p.ver();
  assert.equal(v.fase, 'jogando', 'no Solo, a partida começa na hora');
  assert.equal(v.jogadores.length, 2);
  assert.match(v.jogadores[1].username, /^🤖 /);
  const meuLado = v.jogadores.findIndex((j: { userId: number }) => j.userId === anaId);
  for (let k = 0; k < 2000 && v.fase === 'jogando'; k++) {
    if (v.vez === meuLado) {
      assert.equal(p.relogio[0].ms, JOGADA_SOLO_MS, 'a pessoa não tem o prazo de 90 s');
      assert.equal((p.jogo as Jogo).acao(anaId, { tipo: 'jogada', ...minha(v, sorte) }), null);
    } else {
      assert.equal(p.relogio[0].ms, PAUSA_DO_ROBO);
      p.andar();
    }
    v = p.ver();
  }
  assert.equal(v.fase, 'fim');
  assert.equal(v.motivo, 'jogo');
  return { vencedor: v.vencedor as 0 | 1 | 'empate', meuLado };
}

const sortearDe = <T>(lista: T[], sorte: () => number) => lista[Math.floor(sorte() * lista.length)];

test('Cinco em linha contra o robô: lances válidos até o fim, e ele ganha de quem joga a esmo', () => {
  let ganhou = 0;
  for (let s = 1; s <= 4; s++) {
    const r = mesaInteira(gomoku, (v, sorte) => ({ casa: sortearDe([...(v.casas as number[]).keys()].filter((i) => !(v.casas as number[])[i]), sorte) }), s);
    if (r.vencedor === 1 - r.meuLado) ganhou++;
  }
  assert.equal(ganhou, 4);
});

test('o robô do Cinco em linha fecha o cinco dele e bloqueia o da pessoa', () => {
  const n = LADO_DO_GOMOKU;
  const casas = new Array<number>(n * n).fill(0);
  // a pessoa (1) tem quatro na linha 0; o robô (2) tem quatro na linha 5: ele ganha em vez de bloquear
  for (let c = 0; c < 4; c++) casas[c] = 1;
  for (let c = 3; c < 7; c++) casas[5 * n + c] = 2;
  const ganha = jogadaDoGomoku(casas, 2, () => 0.5);
  assert.ok(ganha === 5 * n + 2 || ganha === 5 * n + 7);
  // sem o cinco dele, bloqueia o dela
  for (let c = 3; c < 7; c++) casas[5 * n + c] = 0;
  casas[5 * n + 3] = 2;
  assert.equal(jogadaDoGomoku(casas, 2, () => 0.5), 4);
});

test('Mancala contra o robô: lances válidos até o fim, e ele ganha de quem joga a esmo', () => {
  let ganhou = 0;
  for (let s = 1; s <= 4; s++) {
    const r = mesaInteira(
      mancala,
      (v, sorte) => {
        const casas = v.casas as number[];
        const minhas = (v.jogadores as { userId: number }[])[0].userId === anaId ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
        // a vez é de quem está em `vez`; a Ana é o lado 0 (sentou primeiro)
        return { casa: sortearDe(minhas.filter((k) => casas[k] > 0), sorte) };
      },
      s,
    );
    if (r.vencedor === 1 - r.meuLado) ganhou++;
  }
  assert.ok(ganhou >= 3, `ganhou ${ganhou} de 4`);
});

test('Damas contra o robô: lances válidos até o fim, e ele ganha de quem joga a esmo', () => {
  let ganhou = 0;
  for (let s = 1; s <= 3; s++) {
    const r = mesaInteira(damas, (v, sorte) => ({ lance: Math.floor(sorte() * (v.lances as unknown[]).length) }), s);
    if (r.vencedor === 1 - r.meuLado) ganhou++;
  }
  assert.ok(ganhou >= 2, `ganhou ${ganhou} de 3`);
});

test('Batalha naval contra o robô: ele mira só pelo que vê, caça depois do fogo, e a partida vai até o fim', () => {
  const naval = criarNaval(semente(7));
  mesaInteira(
    naval,
    (v, sorte) => {
      const meu = (v.jogadores as { userId: number }[]).findIndex((j) => j.userId === anaId);
      const tiros = (v.mares as { tiros: number[] }[])[1 - meu].tiros;
      return { casa: sortearDe([...tiros.keys()].filter((i) => tiros[i] === 0), sorte) };
    },
    3,
    (jogo) => {
      assert.equal(jogo.acao(anaId, { tipo: 'montar', acao: 'sortear' }), null);
      assert.equal(jogo.acao(anaId, { tipo: 'montar', acao: 'pronto' }), null);
    },
  );
  // depois de um fogo num navio que boia, o tiro é numa vizinha
  const tiros = new Array<number>(CASAS_DO_MAR).fill(0);
  tiros[44] = 2;
  for (let k = 0; k < 20; k++) {
    const tiro = tiroDoRobo({ tiros, navios: [] }, Math.random);
    assert.ok([34, 54, 43, 45].includes(tiro), `vizinha de 44: ${tiro}`);
  }
  // dois fogos em linha: as pontas da linha
  tiros[45] = 2;
  for (let k = 0; k < 20; k++) assert.ok([43, 46].includes(tiroDoRobo({ tiros, navios: [] }, Math.random)));
  // em volta de um navio afundado não se atira
  const t2 = new Array<number>(CASAS_DO_MAR).fill(1);
  t2[0] = 2;
  t2[1] = 2;
  t2[2] = 0;
  t2[99] = 0;
  assert.equal(tiroDoRobo({ tiros: t2, navios: [{ casas: [0, 1], afundado: true }] }, () => 0), 99);
});

test('Dominó no Solo: 1 a 3 robôs (com 3, em duplas), e a partida vai até o fim com a pessoa parada', () => {
  const um = partida(criarDomino({ aleatorio: semente(3) }), { corpo: { robos: 1 } });
  assert.equal(um.ver().lugares.length, 2);
  assert.equal(um.ver().duplas, false);
  const tres = partida(criarDomino({ aleatorio: semente(4), agora: () => 1 }), { corpo: { robos: 3 } });
  let v = tres.ver();
  assert.equal(v.lugares.length, 4);
  assert.equal(v.duplas, true);
  assert.equal(v.robos, 3);
  assert.ok(v.lugares.every((l: { presente: boolean }) => l.presente));
  assert.ok(v.lugares.filter((l: { userId: number }) => l.userId < 0).every((l: { username: string }) => /^🤖 /.test(l.username)));
  let vezesDoRobo = 0;
  for (let k = 0; k < 5000 && !tres.terminou(); k++) {
    v = tres.ver();
    if (v.fase === 'jogando' && v.vez < 0) {
      vezesDoRobo++;
      assert.ok(tres.relogio[0].ms <= PAUSA_DO_ROBO);
    }
    tres.andar();
  }
  assert.ok(tres.terminou());
  assert.equal(tres.completa(), true);
  assert.ok(vezesDoRobo > 10);
});

test('Truco no Solo: o robô responde ao truco, e a partida (1 × 1 e em duplas) vai até o fim com a pessoa parada', () => {
  // 2 robôs pedidos viram 3: o truco é em 2 ou em 4
  assert.equal(partida(criarTruco(), { corpo: { robos: 2 } }).ver().lugares.length, 4);
  for (const robos of [1, 3]) {
    const p = partida(criarTruco({ aleatorio: semente(robos), agora: () => 1 }), { corpo: { robos } });
    assert.equal(p.ver().lugares.length, robos + 1);
    assert.equal(p.ver().robos, robos);
    for (let k = 0; k < 5000 && !p.terminou(); k++) p.andar();
    assert.ok(p.terminou(), `com ${robos} robôs, acabou`);
    assert.equal(p.completa(), true);
  }
  // a Ana pede truco na vez dela: o robô responde na pausa curta (aceita, corre ou aumenta)
  for (let s = 1; s <= 6; s++) {
    const p = partida(criarTruco({ aleatorio: semente(s), agora: () => 1 }), { corpo: { robos: 1 } });
    for (let k = 0; k < 20 && p.ver().vez !== anaId; k++) p.andar();
    if (p.ver().vez !== anaId) continue;
    assert.equal((p.jogo as Jogo).acao(anaId, { tipo: 'truco' }), null);
    assert.equal(p.ver().fase, 'truco');
    assert.equal(p.relogio[0].ms, PAUSA_DO_ROBO);
    p.andar();
    const v = p.ver();
    assert.ok(v.fase !== 'truco' || v.pedido.time !== v.meuTime, 'respondeu: aceitou, correu, ou aumentou para a Ana responder');
    if (v.fase === 'truco') assert.equal(v.possoResponder, true);
  }
});

test('Truco em duplas: o robô parceiro não responde pela pessoa', () => {
  for (let s = 1; s <= 30; s++) {
    const p = partida(criarTruco({ aleatorio: semente(s), agora: () => 1 }), { corpo: { robos: 3 } });
    for (let k = 0; k < 400 && !p.terminou(); k++) {
      const v = p.ver();
      if (v.fase === 'truco' && v.pedido.time !== v.meuTime) {
        // o pedido é contra a dupla da Ana: o relógio é o dela (30 s), não a pausa do robô
        assert.notEqual(p.relogio[0].ms, PAUSA_DO_ROBO);
        return;
      }
      p.andar();
    }
  }
  assert.fail('nenhum robô adversário pediu truco em 30 partidas');
});

test('Tabuleiro da turma no Solo: os robôs jogam o dado, compram a dourada, jogam o microjogo, e não há troféu', async () => {
  const antes = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  let agora = 1_000_000;
  const p = partida(criarTabuleiro({ aleatorio: semente(11), agora: () => agora, cenourasIniciais: 20 }), { corpo: { robos: 3, rodadas: 5 } });
  let v = p.ver();
  assert.equal(v.participantes.length, 4);
  assert.equal(v.robos, 3);
  assert.ok(v.participantes.every((x: { presente: boolean }) => x.presente));
  let microjogosComRobo = 0;
  let douradasDosRobos = 0;
  for (let k = 0; k < 5000 && !p.terminou(); k++) {
    v = p.ver();
    if ((v.fase === 'vez' || v.fase === 'loja') && v.vez < 0) assert.ok(p.relogio[0].ms <= PAUSA_DO_ROBO + 20 * 280);
    if (v.mini?.linhas) microjogosComRobo += v.mini.linhas.some((l: { userId: number; posicao: number | null }) => l.userId < 0) ? 1 : 0;
    agora += p.relogio[0].ms;
    p.andar();
  }
  assert.ok(p.terminou());
  assert.equal(p.completa(), true);
  v = p.ver();
  douradasDosRobos = v.participantes.filter((x: { userId: number }) => x.userId < 0).reduce((n: number, x: { douradas: number }) => n + x.douradas, 0);
  assert.ok(microjogosComRobo > 0, 'os robôs aparecem na revelação do microjogo');
  assert.ok(douradasDosRobos > 0, 'os robôs compram a dourada');
  const depois = (await comToken(app, ana.token)('GET', '/api/corrida-trofeus')).json().trofeus.length;
  assert.equal(depois, antes);
});

test('Cidades até sobrar um contra o computador tem teto de rodadas: a partida acaba com a pessoa parada (revisão de 05/11/2026)', async () => {
  const { criarCidades, TETO_ATE_SOBRAR_UM_COM_ROBOS } = await import('../src/minijogo-cidades.js');
  // a semente que, sem o teto, passava da rodada 22 mil
  for (const s of [2, 5]) {
    let relogio: { ms: number; depois: () => void } | null = null;
    let acabou = false;
    const ctx = {
      agendar: (ms: number, depois: () => void) => (relogio = { ms, depois }),
      avisar() {},
      terminar() {
        acabou = true;
      },
      naSala: () => [anaId],
      nome: () => 'ana',
      comunidade: 0,
      solo: true,
    } as unknown as Contexto;
    const jogo = criarCidades({ aleatorio: semente(s * 31 + 5) }).comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: { robos: 5, modo: 'falencia' } }) as Jogo;
    for (let i = 0; i < 200_000 && !acabou && relogio; i++) {
      const r: { ms: number; depois: () => void } = relogio;
      relogio = null;
      r.depois();
    }
    assert.ok(acabou, `semente ${s}: a partida não acabou`);
    assert.ok((jogo.publico(anaId).rodada as number) <= TETO_ATE_SOBRAR_UM_COM_ROBOS);
  }
});
