/**
 * O Duelo de aviõezinhos (minijogo-duelo.ts): o servidor confere as posições e os tiros, carimba o dono, deixa uma cenoura
 * por vez, e tira a vida de quem passa por um tiro MESMO SEM ELA AVISAR (refaz o caminho que ela mesma mandou contra a
 * ervilha e a cenoura, que são contas iguais nos dois lados: duelo-sim.ts). Quem fica calado vira alvo parado, e a curva
 * fechada na cerca protege. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarDueloDeAvioes, LARGADA_MS } = await import('../src/minijogo-duelo.js');
const sim = await import('../src/duelo-sim.js');
const db = await import('../src/db.js');
after(fechar);

const ana = await criarConta(app, 'ana-duelo');
const bia = await criarConta(app, 'bia-duelo');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Linha {
  userId: number;
  vidas: number;
  acertos: number;
  vivo: boolean;
  posicao: number | null;
}

function comecar(comunidade = 0) {
  let agora = 7_000_000;
  const relogio: { ms: number; depois: () => void }[] = [];
  const difundidos: Record<string, unknown>[] = [];
  let terminou = false;
  const naSala = [anaId, biaId];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
    difundir: (d: unknown) => difundidos.push(d as Record<string, unknown>),
  };
  const jogo = criarDueloDeAvioes({ agora: () => agora }).comecar(ctx, { naSala, criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(relogio[0].ms, LARGADA_MS);
  agora += LARGADA_MS;
  relogio[0].depois();
  const verde = agora;
  let N = 0;
  const pos = new Map<number, { x: number; y: number; hx: number; hy: number }>([
    [anaId, { ...sim.largada(0) }],
    [biaId, { ...sim.largada(1) }],
  ]);
  const alvos = new Map<number, { x: number; y: number }>();
  const calados = new Set<number>();
  const recusadas: number[] = [];
  const t = {
    jogo,
    difundidos,
    pos,
    alvos,
    calados,
    recusadas,
    terminou: () => terminou,
    /** O relógio do motor dispara (o fim do tempo). */
    fimDoTempo: () => relogio[0].depois(),
    get N() {
      return N;
    },
    estado: () => jogo.publico(anaId) as { fase: string; jogadores: Linha[] },
    linha: (id: number) => (jogo.publico(anaId) as { jogadores: Linha[] }).jogadores.find((l) => l.userId === id)!,
    /** Anda `passos` passos: cada um vai ao alvo dele (a 1,75 por passo, abaixo do máximo) e manda a posição a cada 4. */
    andar(passos: number) {
      for (let i = 0; i < passos; i += 4) {
        N += 4;
        agora = verde + (N * 1000) / 60;
        for (const id of naSala) {
          const p = pos.get(id)!, alvo = alvos.get(id);
          if (alvo) {
            const dx = alvo.x - p.x, dy = alvo.y - p.y, d = Math.hypot(dx, dy);
            const k = d > 7 ? 7 / d : 1;
            p.x += dx * k;
            p.y += dy * k;
          }
          if (calados.has(id)) continue;
          const r = jogo.tempoReal!(id, { n: N, x: +p.x.toFixed(1), y: +p.y.toFixed(1), hx: p.hx, hy: p.hy });
          if (r === null && t.linha(id).vivo) recusadas.push(N);
        }
      }
    },
    ir(id: number, x: number, y: number) {
      alvos.set(id, { x, y });
      for (let i = 0; i < 400 && Math.hypot(pos.get(id)!.x - x, pos.get(id)!.y - y) > 0.01; i++) t.andar(4);
    },
    mandar: (id: number, dados: Record<string, unknown>) => jogo.tempoReal!(id, dados),
    esperar(ms: number) {
      agora += ms;
      N = Math.floor(((agora - verde) * 60) / 1000);
    },
  };
  return t;
}

test('as duas cópias da simulação são iguais (o site acerta com a mesma conta que o servidor confere)', () => {
  const servidor = readFileSync(new URL('../src/duelo-sim.ts', import.meta.url));
  const site = readFileSync(new URL('../../web/src/duelo/sim.ts', import.meta.url));
  assert.ok(servidor.equals(site), 'server/src/duelo-sim.ts e web/src/duelo/sim.ts mudaram separados: copie uma sobre a outra');
  assert.doesNotMatch(servidor.toString(), /Math\.(sin|cos|tan|atan|atan2|exp|log|pow)\b/, 'só + − × ÷ e Math.sqrt nas contas dos dois lados');
});

test('a posição: só a que o avião alcança, dentro da cerca, não à frente do relógio, e sem virar mais que ele vira', () => {
  const t = comecar();
  const { x, y } = t.pos.get(anaId)!;
  const h = { hx: t.pos.get(anaId)!.hx, hy: t.pos.get(anaId)!.hy };
  assert.equal(t.mandar(anaId, { n: 4, x: x + 100, y, ...h }), null, 'um pulo');
  assert.equal(t.mandar(anaId, { n: 4, x: 2, y, ...h }), null, 'fora da cerca');
  assert.equal(t.mandar(anaId, { n: 600, x: x + 5, y, ...h }), null, 'à frente do relógio');
  assert.equal(t.mandar(anaId, { n: 4, x: x + 5, y, hx: 3, hy: 0 }), null, 'a direção não é de tamanho 1');
  const r = t.mandar(anaId, { n: 4, x: x + 5, y, ...h }) as Record<string, unknown>;
  assert.equal(r.userId, anaId, 'a de verdade é repassada, carimbada com quem mandou');
  assert.equal(t.mandar(anaId, { n: 4, x: x + 6, y, ...h }), null, 'o passo só cresce');
  // no meio da arena, meia-volta em 4 passos não dá; perto da cerca (onde ele quica), dá
  t.ir(anaId, 160, 120);
  assert.equal(t.mandar(anaId, { n: t.N + 4, x: 160, y: 120, hx: -h.hx, hy: -h.hy }), null, 'meia-volta no meio da arena');
  t.ir(anaId, 160, 24);
  assert.ok(t.mandar(anaId, { n: t.N + 4, x: 160, y: 24, hx: -h.hx, hy: -h.hy }), 'quicando na cerca de cima');
  t.jogo.parar?.();
});

test('a ervilha: só depois do primeiro segundo e meio, de perto do avião, no ritmo da recarga; o dono é o servidor que carimba', () => {
  const t = comecar();
  t.ir(anaId, 100, 120);
  // no começo, ninguém atira
  const cedo = comecar();
  cedo.andar(8);
  const p0 = cedo.pos.get(anaId)!;
  assert.equal(cedo.mandar(anaId, { tipo: 'ervilha', n: cedo.N, x: p0.x, y: p0.y, dx: 1, dy: 0 }), null);
  cedo.jogo.parar?.();
  if (t.N < sim.SEM_TIRO) t.andar(sim.SEM_TIRO - t.N + 4);
  assert.equal(t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 200, y: 120, dx: 1, dy: 0 }), null, 'longe do avião');
  const r = t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0, dono: biaId }) as Record<string, unknown>;
  assert.equal(r.tipo, 'ervilha');
  assert.equal(r.dono, anaId, 'o dono é quem mandou, e não o que veio no corpo');
  assert.equal(r.id, `${anaId}-${t.N}`);
  t.andar(8);
  assert.equal(t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 }), null, 'antes da recarga');
  t.andar(sim.RECARGA_DA_ERVILHA);
  assert.ok(t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 }));
  t.jogo.parar?.();
});

test('quem passa pela ervilha perde a vida MESMO SEM AVISAR; o "acertou" de longe não vale; e há 2 s sem levar outro', () => {
  const t = comecar();
  t.ir(anaId, 100, 120);
  t.ir(biaId, 160, 120);
  t.andar(sim.SEM_TIRO);
  const r = t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 }) as { id: string };
  // um "acertou" da Bia agora, longe da ervilha, é recusado
  t.mandar(biaId, { tipo: 'acertou', id: r.id, n: t.N });
  assert.equal(t.linha(biaId).vidas, sim.VIDAS);
  // a ervilha chega nela; ela não avisa nada, só manda as posições
  t.andar(40);
  const acerto = t.difundidos.find((d) => d.tipo === 'acerto');
  assert.ok(acerto, 'o servidor achou o acerto pelo caminho da própria Bia');
  assert.equal(acerto!.alvo, biaId);
  assert.equal(acerto!.dono, anaId);
  assert.equal(t.linha(biaId).vidas, sim.VIDAS - 1);
  assert.equal(t.linha(anaId).acertos, 1);
  // a próxima, logo depois, passa (os 2 s); e o "acertou" honesto dela também não vale dentro deles
  t.andar(sim.RECARGA_DA_ERVILHA);
  const r2 = t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 }) as { id: string };
  t.andar(20);
  t.mandar(biaId, { tipo: 'acertou', id: r2.id, n: t.N });
  t.andar(20);
  assert.equal(t.linha(biaId).vidas, sim.VIDAS - 1, 'dentro dos 2 s, nada pega');
  // passados os 2 s, o "acertou" honesto vale
  t.andar(sim.INVULNERAVEL);
  const r3 = t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 }) as { id: string };
  t.andar(16);
  t.mandar(biaId, { tipo: 'acertou', id: r3.id, n: t.N });
  assert.equal(t.linha(biaId).vidas, sim.VIDAS - 2);
  assert.deepEqual(t.recusadas, [], 'nenhuma posição honesta recusada');
  t.jogo.parar?.();
});

test('a cenoura teleguiada: uma por vez, persegue quem ficou calado até a última posição dele, e libera a próxima', () => {
  const t = comecar();
  t.ir(anaId, 60, 200);
  t.ir(biaId, 250, 60);
  t.andar(sim.SEM_TIRO);
  // um alvo que não está no jogo não vale
  assert.equal(t.mandar(anaId, { tipo: 'missil', n: t.N, x: 68, y: 200, dx: 1, dy: 0, alvo: 999 }), null);
  const r = t.mandar(anaId, { tipo: 'missil', n: t.N, x: 68, y: 200, dx: 1, dy: 0, alvo: biaId }) as Record<string, unknown>;
  assert.equal(r.tipo, 'missil');
  assert.equal(r.alvo, biaId);
  // a segunda, com a primeira no ar, não sai
  t.andar(sim.RECARGA_DA_ERVILHA);
  assert.equal(t.mandar(anaId, { tipo: 'missil', n: t.N, x: 68, y: 200, dx: 1, dy: 0, alvo: biaId }), null);
  // a Bia fica calada: para o servidor, parada onde estava, e a cenoura vai até ela
  t.calados.add(biaId);
  t.andar(sim.VIDA_DO_MISSIL - 40);
  t.jogo.conferir?.();
  assert.equal(t.linha(biaId).vidas, sim.VIDAS - 1, 'a cenoura pegou a Bia parada');
  assert.ok(t.difundidos.some((d) => d.tipo === 'acerto' && d.id === r.id));
  // acertou: a próxima pode sair
  assert.ok(t.mandar(anaId, { tipo: 'missil', n: t.N, x: 68, y: 200, dx: 1, dy: 0, alvo: biaId }));
  t.jogo.parar?.();
});

test('a curva fechada na cerca protege: a ervilha atravessa sem tirar vida', () => {
  const t = comecar();
  t.ir(anaId, 100, 24);
  t.ir(biaId, 160, 24);
  t.andar(sim.SEM_TIRO);
  // a Bia, colada na cerca de cima, vira 90° (ia para a direita, agora para baixo)
  const b = t.pos.get(biaId)!;
  b.hx = 0;
  b.hy = 1;
  t.andar(4);
  t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 24, dx: 1, dy: 0 });
  t.andar(24);
  assert.equal(t.linha(biaId).vidas, sim.VIDAS, 'protegida pela curva');
  // sem virar de novo, a proteção acaba: a próxima pega
  t.andar(sim.PROTECAO + 8);
  t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 24, dx: 1, dy: 0 });
  t.andar(28);
  assert.equal(t.linha(biaId).vidas, sim.VIDAS - 1);
  assert.deepEqual(t.recusadas, []);
  t.jogo.parar?.();
});

test('no terceiro acerto a Bia cai, a partida fecha, e o pódio vai para a estante', () => {
  const t = comecar(1);
  t.ir(anaId, 100, 120);
  t.ir(biaId, 160, 120);
  t.andar(sim.SEM_TIRO);
  for (let k = 0; k < 3; k++) {
    t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 });
    t.andar(sim.INVULNERAVEL + 8);
  }
  assert.equal(t.linha(biaId).vidas, 0);
  assert.equal(t.terminou(), true);
  assert.equal(t.estado().fase, 'fim');
  assert.equal(t.linha(anaId).posicao, 1);
  assert.equal(t.linha(biaId).posicao, 2);
  const trofeu = db.trofeusDe(anaId).find((x) => x.pista === 'duelo');
  assert.ok(trofeu, 'o troféu da Ana');
  assert.equal(trofeu!.posicao, 1);
  assert.equal(t.mandar(biaId, { n: t.N + 4, x: 160, y: 120, hx: 1, hy: 0 }), null, 'depois do fim, nada muda');
  t.jogo.parar?.();
});

test('acabando o tempo, ganha quem tem mais vida', () => {
  const t = comecar();
  t.ir(anaId, 100, 120);
  t.ir(biaId, 160, 120);
  t.andar(sim.SEM_TIRO);
  t.mandar(anaId, { tipo: 'ervilha', n: t.N, x: 108, y: 120, dx: 1, dy: 0 });
  t.andar(40);
  t.alvos.clear();
  t.andar(sim.DURACAO_PASSOS - t.N);
  t.esperar(3000);
  // o relógio do motor fecha
  t.fimDoTempo();
  assert.equal(t.terminou(), true);
  assert.equal(t.linha(anaId).posicao, 1);
  assert.equal(t.linha(biaId).posicao, 2);
  t.jogo.parar?.();
});

test('o Solo só guarda o fim que cabe no relógio', () => {
  let agora = 1_000_000;
  let terminou = false;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => [anaId],
    nome: () => 'ana',
    solo: true,
  };
  const jogo = criarDueloDeAvioes({ agora: () => agora }).comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const est = jogo.publico(anaId) as { robos: { username: string }[] };
  assert.equal(est.robos.length, 3);
  assert.ok(est.robos[0].username.startsWith('🤖'));
  agora += 10_000;
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 1, total: 4, vidas: 3, acertos: 3, passos: 4500 }), 'Partida inválida.', '75 s em 10 s');
  agora += 80_000;
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 1, total: 6, vidas: 3, acertos: 0, passos: 4500 }), 'Partida inválida.', 'mais de 3 do computador');
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 1, total: 4, vidas: 4, acertos: 0, passos: 4500 }), 'Partida inválida.', 'mais vida do que se tem');
  assert.equal(jogo.acao(anaId, { tipo: 'fim', posicao: 2, total: 4, vidas: 0, acertos: 2, passos: 4500 }), null);
  assert.equal(terminou, true);
  assert.deepEqual((jogo.publico(anaId) as { resultadoDoSolo: unknown }).resultadoDoSolo, { posicao: 2, total: 4, vidas: 0, acertos: 2 });
});
