/**
 * O Pulo do coelho na sala (minijogo-plataforma.ts): a largada é do servidor, a posição só é repassada (conferida e
 * carimbada), e a classificação é pelo tempo de cada um, conferido pelo fantasma e pelo relógio de verdade.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarPlataforma, FOLGA_MS } = await import('../src/minijogo-plataforma.js');
const { FASES_DO_PULO } = await import('../src/plataforma.js');
let agora = 1_000_000;
const plataforma = criarPlataforma(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-plataforma');
const bia = await criarConta(app, 'bia-plataforma');
const caio = await criarConta(app, 'caio-plataforma');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do pulo' })).json() as { id: number };
const trofeus = async (token: string) => (await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; tempoMs: number; pontos: number | null }[];

/** Em linha reta da largada até passar da chegada, em `passos` passos (como em plataforma.test.ts). */
function pulo(fase: string, passos: number) {
  const d = FASES_DO_PULO[fase];
  const [x0, y0] = d.largada;
  const x1 = d.chegada + 2;
  const amostras: number[] = [];
  for (let p = 1; p <= passos; p += 4) amostras.push(Math.round((x0 + ((x1 - x0) * (p - 1)) / (passos - 1)) * 10), y0 * 10, 1);
  return { tipo: 'chegada', passos, amostras };
}

function contexto(naSala: () => number[], comunidadeId = comunidade.id) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
    },
  };
}

test('antes do verde não se chega; o fantasma guardado mandado logo depois do verde não vale; quem tem menos tempo ganha', async () => {
  const m = contexto(() => [anaId, biaId]);
  const jogo = plataforma.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { pista: 'toca-1' } });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.publico(anaId).pista, 'toca-1');
  assert.ok(jogo.acao(anaId, pulo('toca-1', 2400)), 'durante a contagem, recusado');
  m.relogio[0].depois();
  agora += 1000;
  assert.ok(jogo.acao(anaId, pulo('toca-1', 2400)), '40 s de fase com 1 s de relógio: recusado');
  assert.ok(jogo.acao(anaId, { ...pulo('toca-1', 2400), amostras: pulo('toca-1', 2400).amostras.slice(3) }), 'fantasma que não fecha');
  agora += 40_000 - FOLGA_MS;
  assert.equal(jogo.acao(anaId, pulo('toca-1', 2400)), null, 'a Ana chega com 40 s');
  assert.equal(m.relogio[0].ms, 30_000, 'e abre o prazo');
  assert.equal(jogo.acao(biaId, pulo('toca-1', 2280)), null, 'a Bia chega depois na rede, com 38 s');
  assert.equal(m.terminou(), true);
  const pilotos = jogo.publico(anaId).pilotos as { userId: number }[];
  assert.deepEqual(pilotos.map((p) => p.userId), [biaId, anaId]);
  const daBia = await trofeus(bia.token);
  assert.deepEqual([daBia[0].pista, daBia[0].posicao, daBia[0].tempoMs], ['toca-1', 1, 38000]);
  assert.equal((await trofeus(ana.token))[0].posicao, 2);
  // sem itens, a fase da sala vira o recorde da pessoa
  const recordes = (await comToken(app, bia.token)('GET', '/api/plataforma/toca-1')).json().recordes as { userId: number; tempoMs: number }[];
  assert.ok(recordes.some((r) => r.userId === biaId && r.tempoMs === 38000));
});

test('a posição é conferida e carimbada: fora da fase, jeito inventado ou de quem não corre, não passa', () => {
  const m = contexto(() => [anaId, biaId]);
  const jogo = plataforma.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.tempoReal!(anaId, { x: 100, y: 100, n: 4, j: 1, andou: 0.01 }), null, 'antes do verde');
  m.relogio[0].depois();
  assert.deepEqual(jogo.tempoReal!(anaId, { x: 100.04, y: 100, n: 4, j: 1, andou: 0.01, userId: biaId }), { userId: anaId, x: 100, y: 100, n: 4, j: 1, andou: 0.01 });
  assert.equal(jogo.tempoReal!(anaId, { x: 99999, y: 100, n: 4, j: 1, andou: 0.01 }), null);
  assert.equal(jogo.tempoReal!(anaId, { x: 100, y: 100, n: 4, j: 9, andou: 0.01 }), null);
  assert.equal(jogo.tempoReal!(anaId, { x: 100, y: 100, n: 4, j: 1, andou: 3 }), null);
  assert.equal(jogo.tempoReal!(caioId, { x: 100, y: 100, n: 4, j: 1, andou: 0.01 }), null, 'quem não está na corrida');
  // ninguém chega: o fim pelo relógio, quem andou mais na frente, e nenhum troféu (ninguém tem resultado)
  jogo.tempoReal!(biaId, { x: 900, y: 100, n: 400, j: 1, andou: 0.3 });
  m.relogio[0].depois();
  assert.equal(m.terminou(), true);
  assert.deepEqual((jogo.publico(anaId).pilotos as { userId: number }[]).map((p) => p.userId), [biaId, anaId]);
});

test('a Copa do Pulo: as três fases, pontos por posição, empate no tempo divide, e o troféu da copa', async () => {
  const m = contexto(() => [anaId, biaId, caioId]);
  const jogo = plataforma.comecar(m.ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: { pista: 'copa-do-pulo' } });
  assert.ok(typeof jogo !== 'string');
  const correr = (fase: string, a: number, b: number, c: number) => {
    assert.equal(jogo.publico(anaId).pista, fase);
    m.relogio[0].depois();
    agora += 200_000;
    assert.equal(jogo.acao(anaId, pulo(fase, a)), null);
    assert.equal(jogo.acao(biaId, pulo(fase, b)), null);
    assert.equal(jogo.acao(caioId, pulo(fase, c)), null);
  };
  correr('prado-1', 2200, 2200, 2400); // Ana e Bia empatam: 10 cada, Caio 6
  assert.equal(jogo.publico(anaId).fase, 'intervalo');
  m.relogio[0].depois();
  correr('toca-1', 2400, 2250, 2500); // Bia 10, Ana 8, Caio 6
  m.relogio[0].depois();
  correr('copas-1', 2300, 2400, 2500); // Ana 10, Bia 8, Caio 6
  assert.equal(m.terminou(), true);
  const placar = jogo.publico(anaId).placarDaCopa as { userId: number; pontos: number }[];
  assert.deepEqual(placar.map((l) => [l.userId, l.pontos]), [[biaId, 28], [anaId, 28], [caioId, 18]], 'empate nos pontos: a soma menor na frente');
  const daBia = (await trofeus(bia.token))[0];
  assert.deepEqual([daBia.pista, daBia.posicao, daBia.pontos], ['copa-do-pulo', 1, 28]);
  assert.equal((await trofeus(ana.token))[0].posicao, 2);
  assert.equal((await trofeus(caio.token))[0].posicao, 3);
});

test('quem fica sozinho na sala não ganha troféu, e quem saiu também não', async () => {
  let naSala = [anaId, biaId];
  const m = contexto(() => naSala);
  const antesAna = (await trofeus(ana.token)).length;
  const antesBia = (await trofeus(bia.token)).length;
  const jogo = plataforma.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  m.relogio[0].depois();
  agora += 100_000;
  assert.equal(jogo.acao(biaId, pulo('prado-1', 2100)), null, 'a Bia chega e sai da sala');
  naSala = [anaId];
  assert.equal(jogo.acao(anaId, pulo('prado-1', 2200)), null);
  assert.equal(m.terminou(), true);
  assert.equal((await trofeus(ana.token)).length, antesAna, 'a Ana ficou sozinha');
  assert.equal((await trofeus(bia.token)).length, antesBia, 'a Bia saiu');
});
