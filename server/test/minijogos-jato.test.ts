/**
 * Os Coelhos a jato (minijogo-jato.ts, jato.ts): a conferência do fantasma, o Solo (o recorde, os fantasmas só de amigos) e a
 * corrida na sala (o verde do servidor, a classificação pelo tempo de cada um, quem explode, o pódio na estante).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarJato, FOLGA_MS, LARGADA_MS, NAVES_NA_PISTA } = await import('../src/minijogo-jato.js');
const { PISTAS_DO_JATO, validarJato } = await import('../src/jato.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const jato = criarJato(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-jato');
const bia = await criarConta(app, 'bia-jato');
const caio = await criarConta(app, 'caio-jato');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do jato' })).json() as { id: number };

/**
 * Uma corrida pelo polígono da largada, da linha de chegada e dos marcos: o que o servidor confere (a largada, andar 70% da
 * pista por volta, passar pelos marcos em ordem e acabar na linha). `porVolta` passos por volta.
 */
function corridaDe(porVolta: number, pista = 'cidade-1') {
  const { linha, marcos, largada, voltas: quantas } = PISTAS_DO_JATO[pista];
  const voltas = Array.from({ length: quantas }, (_, i) => porVolta * (i + 1));
  const amostras: number[] = [];
  const caminhoDaVolta = (k: number): [number, number][] => (k === 0 ? [largada, linha, ...marcos, linha] : [linha, ...marcos, linha]);
  for (let p = 1; p <= voltas[voltas.length - 1]; p += 4) {
    const k = Math.min(quantas - 1, Math.floor((p - 1) / porVolta));
    const pontos = caminhoDaVolta(k);
    const trechos = pontos.slice(1).map((b, i) => ({ a: pontos[i], b, l: Math.hypot(b[0] - pontos[i][0], b[1] - pontos[i][1]) }));
    const total = trechos.reduce((s, t) => s + t.l, 0);
    // o fim de cada volta cai na linha (a amostra do passo da volta é a última dela)
    let s = (((p - 1) % porVolta) / (porVolta - 1)) * total;
    let t = trechos[0];
    for (t of trechos) {
      if (s <= t.l) break;
      s -= t.l;
    }
    const f = Math.min(1, s / t.l);
    amostras.push(Math.round((t.a[0] + (t.b[0] - t.a[0]) * f) * 10), Math.round((t.a[1] + (t.b[1] - t.a[1]) * f) * 10), 0);
  }
  return { tipo: 'chegada', voltas, amostras };
}

function contexto(naSala: number[], { comunidadeId = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
      solo,
    },
  };
}

test('a conferência: a corrida pelo polígono passa; parada, aos saltos, curta demais ou longe da largada, não', () => {
  const honesta = corridaDe(700);
  assert.ok('ok' in validarJato('cidade-1', honesta));
  assert.ok('erro' in validarJato('cidade-1', corridaDe(200)), 'volta de menos de 5 s');
  const parada = { ...honesta, amostras: honesta.amostras.map((v, i) => (i % 3 === 2 ? 0 : i % 3 === 0 ? 1487 : 2742)) };
  assert.ok('erro' in validarJato('cidade-1', parada), 'parada na largada');
  const salto = { ...honesta, amostras: [...honesta.amostras] };
  salto.amostras[60] += 4000;
  assert.ok('erro' in validarJato('cidade-1', salto), 'o salto de posição');
  const longe = { ...honesta, amostras: [...honesta.amostras] };
  longe.amostras[0] += 300;
  assert.ok('erro' in validarJato('cidade-1', longe), 'começar longe da largada');
  assert.ok('erro' in validarJato('orbita-1', honesta), 'o fantasma da cidade não fecha na órbita');
  assert.ok('erro' in validarJato('pista-que-nao-existe', honesta));
});

test('no Solo: escolher a pista, correr, e o melhor tempo vira o recorde; o relógio não deixa chegar antes da hora', () => {
  const m = contexto([anaId], { solo: true });
  const j = jato.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).fase, 'escolha');
  assert.equal(j.publico(anaId).robos, NAVES_NA_PISTA - 1, 'as naves do computador completam a pista');
  assert.ok(j.acao(anaId, { tipo: 'pista', pista: 'lua-9' }));
  assert.equal(j.acao(anaId, { tipo: 'pista', pista: 'nuvens-1' }), null);
  assert.equal(j.acao(anaId, { tipo: 'pista', pista: 'cidade-1' }), null);
  assert.ok(j.acao(anaId, corridaDe(700)), 'chegar sem ter largado');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  assert.equal(j.publico(anaId).fase, 'correndo');
  agora += 2000;
  assert.ok(j.acao(anaId, corridaDe(700)), 'o fantasma guardado, mandado 2 s depois de largar');
  agora += 50_000;
  assert.equal(j.acao(anaId, corridaDe(700)), null);
  const r = j.publico(anaId).resultado as { tempoMs: number; recorde: boolean; voltas: number[] };
  assert.equal(r.recorde, true);
  assert.equal(r.tempoMs, Math.round((2800 * 1000) / 60));
  assert.equal(r.voltas.length, 4);
  // de novo, mais devagar: não substitui
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  agora += 60_000;
  assert.equal(j.acao(anaId, corridaDe(800)), null);
  assert.equal((j.publico(anaId).resultado as { recorde: boolean; anterior: number }).recorde, false);
  // explodir só encerra a corrida, sem tempo
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  assert.equal(j.acao(anaId, { tipo: 'explodiu' }), null);
  assert.equal((j.publico(anaId).resultado as { explodiu: boolean }).explodiu, true);
  assert.equal(db.recordeDoJato(anaId, 'cidade-1')?.tempoMs, Math.round((2800 * 1000) / 60));
  assert.equal(m.terminou(), false, 'a partida solo não acaba sozinha depois do resultado');
});

test('os fantasmas: o meu e os dos amigos aceitos; o de quem não é amigo não vem', async () => {
  await comToken(app, ana.token)('POST', '/api/amigos', { username: 'bia-jato' });
  assert.equal((await comToken(app, bia.token)('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  db.guardarJato(biaId, 'cidade-1', 45_000, [1, 2, 3, 4], JSON.stringify(corridaDe(675).amostras));
  db.guardarJato(caioId, 'cidade-1', 44_000, [1, 2, 3, 4], JSON.stringify(corridaDe(660).amostras));
  const m = contexto([anaId], { solo: true });
  const j = jato.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: { pista: 'cidade-1' } });
  assert.ok(typeof j !== 'string');
  const recordes = j.publico(anaId).recordes as { userId: number }[];
  assert.deepEqual(recordes.map((r) => r.userId), [biaId, anaId], 'o Caio não é amigo: não aparece');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [anaId, biaId, caioId] }), null);
  const fantasmas = j.publico(anaId).fantasmas as { userId: number; amostras: number[] }[];
  assert.deepEqual(fantasmas.map((f) => f.userId), [anaId, biaId], 'nem pedindo pelo console');
  assert.ok(fantasmas[1].amostras.length > 100);
});

test('na sala: o verde do servidor, a classificação pelo tempo, quem explode atrás, e o pódio na estante', () => {
  const m = contexto([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  const j = jato.comecar(m.ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: { pista: 'orbita-1' } });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).fase, 'largada');
  assert.equal(j.publico(anaId).robos, NAVES_NA_PISTA - 3);
  assert.equal(m.relogio[0].ms, LARGADA_MS);
  assert.ok(j.acao(anaId, corridaDe(600, 'orbita-1')), 'chegar na contagem');
  m.relogio[0].depois();
  assert.equal(j.publico(anaId).fase, 'correndo');
  // a posição: a primeira sai da largada; a que pula não é repassada
  const { largada } = PISTAS_DO_JATO['orbita-1'];
  agora += 200;
  assert.equal(j.tempoReal!(biaId, { x: 500, y: 500, a: 0, n: 5, andou: -0.03 }), null, 'longe da largada');
  assert.ok(j.tempoReal!(biaId, { x: largada[0] + 3, y: largada[1], a: 0, n: 5, andou: -0.03 }));
  assert.equal(j.tempoReal!(biaId, { x: largada[0] + 200, y: largada[1], a: 0, n: 9, andou: -0.02 }), null, 'o salto');
  agora += 1000;
  assert.ok(j.acao(anaId, corridaDe(600, 'orbita-1')), 'o fantasma guardado, 1 s depois do verde');
  agora += 45_000 - FOLGA_MS;
  assert.equal(j.acao(biaId, corridaDe(640, 'orbita-1')), null, 'a Bia chega primeiro');
  assert.equal(m.relogio[0].ms, 30_000, 'e abre o prazo');
  assert.equal(j.acao(caioId, { tipo: 'explodiu' }), null, 'o Caio explode');
  assert.equal(m.terminou(), false);
  assert.equal(j.acao(anaId, corridaDe(600, 'orbita-1')), null, 'a Ana chega depois na rede, com tempo menor');
  assert.equal(m.terminou(), true);
  const pilotos = j.publico(anaId).pilotos as { userId: number; posicao: number; explodiu: boolean }[];
  assert.deepEqual(pilotos.map((p) => [p.userId, p.posicao]), [[anaId, 1], [biaId, 2], [caioId, 3]]);
  assert.equal(pilotos[2].explodiu, true);
  const daAna = db.trofeusDe(anaId).find((t) => t.pista === 'jato');
  assert.ok(daAna && daAna.posicao === 1);
  assert.deepEqual(daAna.rivais.map((r) => r.userId).sort(), [biaId, caioId].sort());
  assert.equal(db.trofeusDe(caioId).some((t) => t.pista === 'jato'), false, 'quem explodiu não sobe ao pódio');
  assert.equal(db.recordeDoJato(anaId, 'orbita-1')?.tempoMs, 40_000, 'sem itens, a corrida da sala vira recorde');
});
