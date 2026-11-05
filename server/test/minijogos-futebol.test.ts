/**
 * O Futebol dos coelhos (minijogo-futebol.ts): na sala, a bola e os robôs são do servidor, num passo de 20 por segundo; cada
 * pessoa manda a posição do próprio coelho e o chute, e o servidor confere pelo passado da bola. No Solo, só o placar do fim.
 * O relógio e o passo aqui são de mão: o teste anda o tempo e chama o passo.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarFutebol, PASSO_MS, HISTORIA_PASSOS, tamanhoDoTime } = await import('../src/minijogo-futebol.js');
const sim = await import('../src/futebol-sim.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-futebol');
const bia = await criarConta(app, 'bia-futebol');
const caio = await criarConta(app, 'caio-futebol');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do futebol' })).json() as { id: number };

interface Interno {
  _passo: () => void;
  _mundo: import('../src/futebol-sim.js').Mundo;
  _motivo: () => string | null;
}

function comecar(naSala: number[], { solo = false, corpo = {} as Record<string, unknown> } = {}) {
  let passo: (() => void) | null = null;
  let limpo = 0;
  let terminou: boolean | null = null;
  const quadros: Record<string, unknown>[] = [];
  let sala = [...naSala];
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: (c = true) => (terminou = c),
    naSala: () => sala,
    nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
    comunidade: solo ? 0 : comunidade.id,
    solo,
    difundir: (d: unknown) => quadros.push(d as Record<string, unknown>),
  };
  const jogo = criarFutebol({
    agora: () => agora,
    intervalo: (p) => {
      passo = p;
      return 1;
    },
    limpar: () => limpo++,
  }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo });
  assert.ok(typeof jogo !== 'string');
  const interno = jogo as unknown as Interno;
  const m = interno._mundo;
  return {
    jogo,
    m,
    quadros,
    terminou: () => terminou,
    limpo: () => limpo,
    sair: (id: number) => (sala = sala.filter((s) => s !== id)),
    /** Anda o tempo, um quadro (3 passos) a cada 50 ms. */
    andar(ms: number) {
      for (let t = 0; t < ms; t += PASSO_MS) {
        agora += PASSO_MS;
        passo!();
      }
    },
    /** Passa a contagem da largada. */
    largar() {
      while (m.pausa > 0) this.andar(PASSO_MS);
    },
    pos(id: number, d: Record<string, unknown>) {
      agora += 40;
      jogo.tempoReal!(id, { tipo: 'pos', r: m.reinicios, ...d });
      return interno._motivo();
    },
    chute(id: number, d: Record<string, unknown>) {
      jogo.tempoReal!(id, { tipo: 'chute', ...d });
      return interno._motivo();
    },
    eu: (id: number) => m.jogadores.find((j) => j.id === id)!,
  };
}

async function trofeus(token: string) {
  return ((await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; pontos: number }[]).filter(
    (t) => t.pista === 'futebol',
  );
}

test('os times: as pessoas alternadas, e os robôs completam (no mínimo 2 por time)', () => {
  assert.equal(tamanhoDoTime(2), 2);
  assert.equal(tamanhoDoTime(3), 2);
  assert.equal(tamanhoDoTime(5), 3);
  assert.equal(tamanhoDoTime(8), 4);
  const p = comecar([anaId, biaId, caioId]);
  const times = p.jogo.publico(anaId).times as { userId: number; robo: boolean; username: string }[][];
  assert.deepEqual(
    times[0].map((j) => j.userId),
    [anaId, caioId],
  );
  assert.equal(times[1][0].userId, biaId);
  assert.equal(times[1][1].robo, true);
  assert.match(times[1][1].username, /^🤖 /);
  assert.equal(p.jogo.publico(biaId).meuTime, 1);
  // as pessoas são movidas de fora; o robô, pelo passo
  assert.equal(p.eu(anaId).externo, true);
  assert.equal(p.eu(-1).externo, false);
  p.jogo.parar!();
});

test('o passo anda a bola e os robôs, e o quadro vai 20 vezes por segundo', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  const robo = p.eu(-1);
  const antes = { x: robo.x, y: robo.y };
  const quadros = p.quadros.length;
  p.andar(1000);
  assert.equal(p.quadros.length - quadros, 20);
  assert.ok(robo.x !== antes.x || robo.y !== antes.y, 'o robô anda');
  const q = p.quadros.at(-1)!;
  assert.equal(q.tipo, 'q');
  assert.equal((q.j as unknown[]).length, 4);
  p.jogo.parar!();
});

test('a posição: andando no ritmo vale; um pulo para longe fica no limite da velocidade', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  const a = p.eu(anaId);
  const x0 = a.x;
  assert.equal(p.pos(anaId, { x: x0 - 3, y: a.y, vx: -2, vy: 0, fx: -1, fy: 0, ts: 123 }), null);
  assert.equal(a.x, x0 - 3);
  assert.equal(a.fx, -1);
  // 300 px de uma vez: anda só o que o crédito deixa
  const y0 = a.y;
  p.pos(anaId, { x: a.x, y: y0 + 300 });
  assert.ok(a.y - y0 < 40, `andou ${a.y - y0}`);
  // a posição de antes da volta ao meio não vale
  assert.equal(p.pos(anaId, { x: a.x, y: a.y, r: p.m.reinicios - 1 }), 'reinício');
  p.jogo.parar!();
});

test('o chute: longe da bola não vale; com a bola no pé vale, e a força tem teto', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  const a = p.eu(anaId);
  // a Ana longe da bola (a dela é a saída, mas está a 16 px; leva-a para longe)
  a.x = 100;
  a.y = 100;
  assert.equal(p.chute(anaId, { x: 100, y: 100, vx: 5, vy: 0, s: 1 }), 'longe da bola');
  assert.equal(p.chute(anaId, { x: 300, y: 300, vx: 5, vy: 0, s: 2 }), 'longe de si');
  // dá a bola à Ana, e anda um quadro para ela ficar no passado também
  a.x = 200;
  a.y = 200;
  a.fx = 1;
  a.fy = 0;
  sim.darBola(p.m, a);
  sim.contatos(p.m);
  p.andar(PASSO_MS);
  assert.equal(p.m.bola.dono, anaId);
  assert.equal(p.chute(anaId, { x: a.x, y: a.y, vx: 30, vy: 0, s: 3 }), 'força');
  assert.equal(p.chute(anaId, { x: a.x, y: a.y, vx: 9, vy: 0, fx: 1, fy: 0, s: 4 }), null);
  assert.equal(p.m.bola.dono, 0);
  assert.ok(p.m.bola.vx > 5, 'a bola saiu para a direita');
  agora += 1000;
  assert.equal(p.chute(anaId, { x: a.x, y: a.y, vx: 9, vy: 0, s: 4 }), 'chute repetido');
  // a resposta vai no quadro seguinte, para o site saber que o chute valeu
  p.andar(PASSO_MS);
  const comResposta = p.quadros.filter((q) => (q.c as number[][]).some((c) => c[0] === anaId && c[1] === 4 && c[2] === 1));
  assert.equal(comResposta.length, 1);
  p.jogo.parar!();
});

test('quem chuta tem razão: a bola que já rolou para longe, mas estava no pé dele há pouco, ainda vale (e não mais que 300 ms)', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  const a = p.eu(anaId);
  a.x = 200;
  a.y = 120;
  a.fx = 1;
  a.fy = 0;
  // a bola passa encostada nele e segue (devagar, para ninguém a dominar no caminho)
  const b = p.m.bola;
  b.dono = 0;
  b.x = 215;
  b.y = 120;
  b.vx = 4;
  b.vy = 0;
  b.versao++;
  for (const j of p.m.jogadores) if (j.id !== anaId) ((j.x = 560), (j.y = 340));
  a.semDominio = 999; // ele não a domina no passo
  p.andar(PASSO_MS * 2);
  assert.ok(Math.abs(b.x - a.x) > 30, 'a bola já está longe dele no presente');
  assert.equal(p.chute(anaId, { x: a.x, y: a.y, vx: 0, vy: 8, s: 1 }), null);
  assert.ok(b.vy > 3, 'a bola saiu para baixo');
  // depois de 300 ms, não
  b.x = 215;
  b.y = 120;
  b.vx = 4;
  b.vy = 0;
  b.versao++;
  p.andar(PASSO_MS * (Math.ceil(HISTORIA_PASSOS / 3) + 2));
  assert.equal(p.chute(anaId, { x: a.x, y: a.y, vx: 0, vy: 8, s: 2 }), 'longe da bola');
  p.jogo.parar!();
});

test('quem encostou na bola solta como a tela mostrava fica com ela (o passado de 300 ms)', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  const a = p.eu(anaId);
  for (const j of p.m.jogadores) if (j.id !== anaId) ((j.x = 560), (j.y = 340));
  a.x = 150;
  a.y = 300;
  const b = p.m.bola;
  b.dono = 0;
  b.x = 150;
  b.y = 250;
  b.vx = 3;
  b.vy = 0;
  b.versao++;
  p.andar(PASSO_MS * 3);
  assert.equal(b.dono, 0);
  // ele chega aonde a bola estava há uns passos
  const ponto = { x: 160, y: 253 };
  a.x = ponto.x;
  a.y = ponto.y + 25;
  assert.equal(p.pos(anaId, { x: ponto.x, y: ponto.y + 3 }), null);
  assert.equal(b.dono, anaId);
  p.jogo.parar!();
});

test('o gol conta, a bola volta ao meio, e a posição de antes da volta não vale', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  for (const j of p.m.jogadores) ((j.x = 320), (j.y = 60));
  const b = p.m.bola;
  b.dono = 0;
  b.x = sim.X1 - 20;
  b.y = sim.CY;
  b.vx = 8;
  b.vy = 0;
  b.ultimo = anaId;
  b.versao++;
  const reinicios = p.m.reinicios;
  p.andar(PASSO_MS * 2);
  assert.deepEqual(p.m.placar, [1, 0], 'o time 0 (da Ana) ataca a direita');
  assert.equal(p.eu(anaId).gols, 1);
  assert.ok(p.quadros.some((q) => (q.e as unknown[][]).some((e) => e[0] === 'g' && e[1] === 0 && e[2] === anaId)));
  for (let k = 0; k < 100 && p.m.reinicios === reinicios; k++) p.andar(PASSO_MS);
  assert.equal(p.m.reinicios, reinicios + 1, 'voltou ao meio');
  assert.equal(b.x, sim.CX);
  assert.ok(p.m.pausa > 0, 'e espera um pouco antes de rolar');
  assert.equal(p.pos(anaId, { x: 100, y: 100, r: reinicios }), 'reinício');
  p.jogo.parar!();
});

test('quem sai da sala deixa o coelho com o computador', () => {
  const p = comecar([anaId, biaId]);
  p.largar();
  p.sair(biaId);
  p.andar(PASSO_MS);
  assert.equal(p.eu(biaId).externo, false);
  assert.equal(p.eu(biaId).robo, true);
  p.jogo.parar!();
});

test('o fim: o resultado, e o troféu de cada pessoa que ficou (1º quem venceu, 2º quem perdeu)', async () => {
  const antesAna = (await trofeus(ana.token)).length;
  const antesBia = (await trofeus(bia.token)).length;
  const p = comecar([anaId, biaId]);
  p.largar();
  p.m.placar[0] = 2;
  p.m.passo = sim.PARTIDA_PASSOS - 2;
  p.andar(PASSO_MS * 2);
  assert.equal(p.terminou(), true);
  assert.ok(p.limpo() >= 1, 'o passo desliga no fim');
  const r = p.jogo.publico(anaId).resultado as { placar: number[]; venceu: number };
  assert.equal(r.venceu, 0);
  assert.deepEqual(r.placar, [2, 0]);
  const daAna = await trofeus(ana.token);
  const daBia = await trofeus(bia.token);
  assert.equal(daAna.length, antesAna + 1);
  assert.equal(daBia.length, antesBia + 1);
  assert.equal(daAna[0].posicao, 1);
  assert.equal(daAna[0].pontos, 2);
  assert.equal(daBia[0].posicao, 2);
});

test('o fim com uma pessoa só na sala: sem troféu', async () => {
  const antes = (await trofeus(ana.token)).length;
  const p = comecar([anaId, biaId]);
  p.largar();
  p.sair(biaId);
  p.m.passo = sim.PARTIDA_PASSOS - 2;
  p.andar(PASSO_MS * 2);
  assert.equal(p.terminou(), true);
  assert.equal((await trofeus(ana.token)).length, antes);
});

test('o Solo: o placar do fim, conferido (o tamanho e o relógio)', async () => {
  const antes = (await trofeus(ana.token)).length;
  const p = comecar([anaId], { solo: true });
  const tempo = sim.CONTAGEM + sim.PARTIDA_PASSOS + 2 * sim.GOL_PAUSA;
  const fim = { tipo: 'fim', formato: 2, gols: 2, contra: 1, passos: sim.PARTIDA_PASSOS, tempo };
  // cedo demais: o relógio do servidor não viu passar os 3 minutos
  assert.equal(p.jogo.acao(anaId, fim), 'Partida inválida.');
  agora += (tempo / 60) * 1000;
  assert.equal(p.jogo.acao(anaId, { ...fim, passos: 100 }), 'Partida inválida.');
  assert.equal(p.jogo.acao(anaId, { ...fim, formato: 7 }), 'Partida inválida.');
  assert.equal(p.jogo.acao(anaId, { ...fim, tempo: tempo + 50 * sim.GOL_PAUSA }), 'Partida inválida.');
  assert.equal(p.jogo.acao(anaId, fim), null);
  assert.equal(p.terminou(), true);
  assert.deepEqual(p.jogo.publico(anaId).resultadoDoSolo, { formato: 2, gols: 2, contra: 1 });
  assert.equal(p.jogo.acao(anaId, fim), 'Esta rodada já acabou.');
  assert.equal((await trofeus(ana.token)).length, antes, 'o Solo não dá troféu');
});
