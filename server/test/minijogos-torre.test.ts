/**
 * A Torre do celeiro (minijogo-torre.ts, torre.ts): a conferência do fantasma, o Solo (o recorde, os fantasmas só de amigos)
 * e a subida na sala (o verde do servidor, a posição conferida, a classificação pelo tempo de cada um, o pódio na estante).
 * A subida honesta de verdade (a do piloto automático) é conferida em web/test/torre.test.ts.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarTorre, FOLGA_MS } = await import('../src/minijogo-torre.js');
const { TORRES_DO_CELEIRO, validarTorre } = await import('../src/torre.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const torre = criarTorre(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-torre');
const bia = await criarConta(app, 'bia-torre');
const caio = await criarConta(app, 'caio-torre');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da torre' })).json() as { id: number };
const trofeus = async (token: string) => (await comToken(app, token)('GET', '/api/corrida-trofeus')).json().trofeus as { pista: string; posicao: number; tempoMs: number }[];

/** Em linha reta da largada até passar do topo, em `passos` passos (o que continua possível, no tempo mínimo ou mais). */
function subida(id: string, passos: number) {
  const d = TORRES_DO_CELEIRO[id];
  const amostras: number[] = [];
  for (let p = 1; p <= passos; p += 4) {
    const t = (p - 1) / (passos - 1);
    amostras.push(d.largada[0] * 10, Math.round((d.largada[1] + (d.chegada - 2 - d.largada[1]) * t) * 10), 1);
  }
  return { tipo: 'chegada', passos, amostras };
}

function contexto(naSala: () => number[], { comunidadeId = comunidade.id, solo = false } = {}) {
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
      solo,
    },
  };
}

test('a conferência: a largada, o tempo mínimo, o fim no topo, a torre certa', () => {
  const ok = subida('celeiro-1', 2400);
  assert.ok('ok' in validarTorre('celeiro-1', ok));
  assert.ok('erro' in validarTorre('celeiro-1', subida('celeiro-1', TORRES_DO_CELEIRO['celeiro-1'].minimo - 4)), 'rápido demais');
  const longe = { ...ok, amostras: [...ok.amostras] };
  longe.amostras[0] += 300;
  assert.ok('erro' in validarTorre('celeiro-1', longe), 'começar longe da largada');
  const parou = { ...ok, amostras: ok.amostras.map((v, i) => (i % 3 === 1 ? Math.max(v, 4000) : v)) };
  assert.ok('erro' in validarTorre('celeiro-1', parou), 'parou antes do topo');
  assert.ok('erro' in validarTorre('silo-1', ok), 'a subida do celeiro não fecha no silo');
  assert.ok('erro' in validarTorre('moinho-9', ok));
  assert.ok('erro' in validarTorre('celeiro-1', { ...ok, amostras: ok.amostras.slice(3) }), 'amostras que não batem com os passos');
});

test('no Solo: escolher a torre, subir, e o melhor tempo vira o recorde; o relógio não deixa chegar antes da hora', () => {
  const m = contexto(() => [anaId], { solo: true, comunidadeId: 0 });
  const j = torre.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).fase, 'escolha');
  assert.ok(j.acao(anaId, { tipo: 'pista', pista: 'moinho-9' }));
  assert.equal(j.acao(anaId, { tipo: 'pista', pista: 'paiol-1' }), null);
  assert.ok(j.acao(anaId, subida('paiol-1', 2400)), 'chegar sem ter largado');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  agora += 2000;
  assert.ok(j.acao(anaId, subida('paiol-1', 2400)), 'o fantasma guardado, mandado 2 s depois de largar');
  agora += 40_000;
  assert.equal(j.acao(anaId, subida('paiol-1', 2400)), null);
  const r = j.publico(anaId).resultado as { tempoMs: number; recorde: boolean };
  assert.deepEqual([r.tempoMs, r.recorde], [40_000, true]);
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  agora += 60_000;
  assert.equal(j.acao(anaId, subida('paiol-1', 3000)), null);
  assert.equal((j.publico(anaId).resultado as { recorde: boolean }).recorde, false, 'mais devagar não substitui');
  assert.equal(db.recordeDaTorre(anaId, 'paiol-1')?.tempoMs, 40_000);
  assert.equal(m.terminou(), false, 'a partida solo não acaba sozinha');
  assert.ok(j.acao(biaId, { tipo: 'correr' }), 'quem não é dono da partida solo só assiste');
});

test('os fantasmas: o meu e os dos amigos aceitos; o de quem não é amigo não vem', async () => {
  await comToken(app, ana.token)('POST', '/api/amigos', { username: 'bia-torre' });
  assert.equal((await comToken(app, bia.token)('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  db.guardarTorre(biaId, 'paiol-1', 39_000, JSON.stringify(subida('paiol-1', 2340).amostras));
  db.guardarTorre(caioId, 'paiol-1', 38_000, JSON.stringify(subida('paiol-1', 2280).amostras));
  const m = contexto(() => [anaId], { solo: true, comunidadeId: 0 });
  const j = torre.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: { pista: 'paiol-1' } });
  assert.ok(typeof j !== 'string');
  assert.deepEqual((j.publico(anaId).recordes as { userId: number }[]).map((r) => r.userId), [biaId, anaId], 'o Caio não é amigo');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [anaId, biaId, caioId] }), null);
  const fantasmas = j.publico(anaId).fantasmas as { userId: number; amostras: number[] }[];
  assert.deepEqual(fantasmas.map((f) => f.userId), [anaId, biaId]);
  assert.ok(fantasmas[1].amostras.length > 100);
});

test('na sala: antes do verde não se chega; quem tem menos tempo ganha; o pódio vai para a estante', async () => {
  const m = contexto(() => [anaId, biaId]);
  const j = torre.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { pista: 'silo-1' } });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).pista, 'silo-1');
  assert.ok(j.acao(anaId, subida('silo-1', 2400)), 'durante a contagem');
  m.relogio[0].depois();
  agora += 1000;
  assert.ok(j.acao(anaId, subida('silo-1', 2400)), '40 s de subida com 1 s de relógio');
  agora += 40_000 - FOLGA_MS;
  assert.equal(j.acao(anaId, subida('silo-1', 2400)), null, 'a Ana chega com 40 s');
  assert.equal(m.relogio[0].ms, 30_000, 'e abre o prazo');
  assert.equal(j.acao(biaId, subida('silo-1', 2280)), null, 'a Bia chega depois, com 38 s');
  assert.equal(m.terminou(), true);
  assert.deepEqual((j.publico(anaId).pilotos as { userId: number }[]).map((p) => p.userId), [biaId, anaId]);
  const daBia = (await trofeus(bia.token)).find((t) => t.pista === 'torre');
  assert.deepEqual([daBia?.posicao, daBia?.tempoMs], [1, 38_000]);
  assert.equal((await trofeus(ana.token)).find((t) => t.pista === 'torre')?.posicao, 2);
  assert.equal(db.recordeDaTorre(biaId, 'silo-1')?.tempoMs, 38_000, 'sem itens, a subida da sala vira o recorde');
});

test('a posição ao vivo é conferida e carimbada, e o quanto subiu não pula para o topo', () => {
  const m = contexto(() => [anaId, biaId]);
  const j = torre.comecar(m.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof j !== 'string');
  const d = TORRES_DO_CELEIRO['celeiro-1'];
  assert.equal(j.tempoReal!(anaId, { x: 50, y: 2500, n: 4, j: 1 }), null, 'antes do verde');
  m.relogio[0].depois();
  agora += 2000;
  assert.deepEqual(j.tempoReal!(anaId, { x: 50.04, y: d.largada[1], n: 4, j: 1, userId: biaId }), { userId: anaId, x: 50, y: d.largada[1], n: 4, j: 1, andou: 0 });
  assert.equal(j.tempoReal!(anaId, { x: 9999, y: 100, n: 8, j: 1 }), null, 'fora da torre');
  assert.equal(j.tempoReal!(anaId, { x: 50, y: 100, n: 8, j: 7 }), null, 'jeito inventado');
  assert.equal(j.tempoReal!(anaId, { x: 50, y: 100, n: 301, j: 1 }), null, 'à frente do relógio');
  assert.equal(j.tempoReal!(caioId, { x: 50, y: 100, n: 8, j: 1 }), null, 'quem não sobe');
  // o console manda o y do topo: vai aos outros (é onde o coelho é desenhado), mas a ordem conta só o que dá para subir
  j.tempoReal!(anaId, { x: 50, y: d.chegada, n: 12, j: 1 });
  j.tempoReal!(biaId, { x: 50, y: d.largada[1] - 200, n: 120, j: 1 });
  agora += 300_000;
  m.relogio[0].depois();
  assert.equal(m.terminou(), true);
  assert.deepEqual((j.publico(anaId).pilotos as { userId: number }[]).map((p) => p.userId), [biaId, anaId], 'a Bia subiu mais de verdade');
});
