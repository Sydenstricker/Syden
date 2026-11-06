/**
 * A Regata da toca (minijogo-barco.ts, barco.ts): a conferência do fantasma, o Solo (o recorde, os fantasmas só de amigos) e a
 * corrida na sala (o verde do servidor, a classificação pelo tempo de cada um, quem sai da sala, o pódio na estante).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarBarco, FOLGA_MS, LARGADA_MS, PRAZO_MS } = await import('../src/minijogo-barco.js');
const { PISTAS_DO_BARCO, validarBarco } = await import('../src/barco.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const barco = criarBarco(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-barco');
const bia = await criarConta(app, 'bia-barco');
const caio = await criarConta(app, 'caio-barco');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da regata' })).json() as { id: number };

/**
 * Uma corrida pelo polígono da largada, da linha de chegada e dos marcos: o que o servidor confere (a largada, andar 70% da
 * pista por volta, passar pelos marcos em ordem e acabar na linha). `porVolta` passos por volta.
 */
function corridaDe(porVolta: number, pista = 'lago-1') {
  const { linha, marcos, largada, voltas: quantas } = PISTAS_DO_BARCO[pista];
  const voltas = Array.from({ length: quantas }, (_, i) => porVolta * (i + 1));
  const amostras: number[] = [];
  const caminhoDaVolta = (k: number): [number, number][] => (k === 0 ? [largada, linha, ...marcos, linha] : [linha, ...marcos, linha]);
  for (let p = 1; p <= voltas[voltas.length - 1]; p += 4) {
    const k = Math.min(quantas - 1, Math.floor((p - 1) / porVolta));
    const pontos = caminhoDaVolta(k);
    const trechos = pontos.slice(1).map((b, i) => ({ a: pontos[i], b, l: Math.hypot(b[0] - pontos[i][0], b[1] - pontos[i][1]) }));
    const total = trechos.reduce((s, t) => s + t.l, 0);
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

test('a conferência: a corrida pelo polígono passa; parada, aos saltos, curta demais, longe da largada ou em outra pista, não', () => {
  const honesta = corridaDe(1000);
  assert.ok('ok' in validarBarco('lago-1', honesta));
  assert.ok('erro' in validarBarco('lago-1', corridaDe(300)), 'volta de menos de 6 s');
  const { largada } = PISTAS_DO_BARCO['lago-1'];
  const parada = { ...honesta, amostras: honesta.amostras.map((v, i) => (i % 3 === 2 ? 0 : i % 3 === 0 ? Math.round(largada[0] * 10) : Math.round(largada[1] * 10))) };
  assert.ok('erro' in validarBarco('lago-1', parada), 'parada na largada');
  const salto = { ...honesta, amostras: [...honesta.amostras] };
  salto.amostras[60] += 4000;
  assert.ok('erro' in validarBarco('lago-1', salto), 'o salto de posição');
  const longe = { ...honesta, amostras: [...honesta.amostras] };
  longe.amostras[0] += 300;
  assert.ok('erro' in validarBarco('lago-1', longe), 'começar longe da largada');
  // só a linha e a largada: sem os marcos (ir e voltar na linha de chegada)
  const vaiEVolta = { ...honesta, amostras: honesta.amostras.map((v, i) => (i % 3 === 2 ? 0 : i % 3 === 0 ? 2300 + ((Math.floor(i / 3) % 60) - 30) * 25 : 2500)) };
  vaiEVolta.amostras[0] = Math.round(largada[0] * 10);
  vaiEVolta.amostras[1] = Math.round(largada[1] * 10);
  assert.ok('erro' in validarBarco('lago-1', vaiEVolta), 'sem passar pelos marcos');
  assert.ok('erro' in validarBarco('riacho-1', honesta), 'o fantasma do lago não fecha no riacho');
  assert.ok('erro' in validarBarco('pista-que-nao-existe', honesta));
});

test('no Solo: escolher a pista, correr, e o melhor tempo vira o recorde; o relógio não deixa chegar antes da hora', () => {
  const m = contexto([anaId], { solo: true });
  const j = barco.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).fase, 'escolha');
  assert.equal(j.publico(anaId).pista, 'lago-1');
  assert.ok(j.acao(anaId, { tipo: 'pista', pista: 'oceano-9' }));
  assert.equal(j.acao(anaId, { tipo: 'pista', pista: 'mangue-1' }), null);
  assert.equal(j.acao(anaId, { tipo: 'pista', pista: 'lago-1' }), null);
  assert.ok(j.acao(anaId, corridaDe(1000)), 'chegar sem ter largado');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  assert.equal(j.publico(anaId).fase, 'correndo');
  assert.ok(j.acao(anaId, { tipo: 'pista', pista: 'riacho-1' }), 'trocar de pista no meio da corrida');
  agora += 2000;
  assert.ok(j.acao(anaId, corridaDe(1000)), 'o fantasma guardado, mandado 2 s depois de largar');
  agora += 50_000;
  assert.equal(j.acao(anaId, corridaDe(1000)), null);
  const r = j.publico(anaId).resultado as { tempoMs: number; recorde: boolean; voltas: number[] };
  assert.equal(r.recorde, true);
  assert.equal(r.tempoMs, 50_000);
  assert.equal(r.voltas.length, 3);
  // de novo, mais devagar: não substitui
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [] }), null);
  agora += 60_000;
  assert.equal(j.acao(anaId, corridaDe(1100)), null);
  assert.equal((j.publico(anaId).resultado as { recorde: boolean; anterior: number }).recorde, false);
  assert.equal((j.publico(anaId).resultado as { anterior: number }).anterior, 50_000);
  assert.equal(db.recordeDoBarco(anaId, 'lago-1')?.tempoMs, 50_000);
  assert.equal(j.acao(biaId, { tipo: 'correr' }), 'Você está assistindo esta partida.');
  assert.equal(m.terminou(), false, 'a partida solo não acaba sozinha depois do resultado');
  assert.ok(db.barcosDe(anaId).some((b) => b.pista === 'lago-1' && b.fantasma.length > 100), 'o "Levar seus dados" leva o fantasma');
});

test('os fantasmas: o meu e os dos amigos aceitos; o de quem não é amigo não vem', async () => {
  await comToken(app, ana.token)('POST', '/api/amigos', { username: 'bia-barco' });
  assert.equal((await comToken(app, bia.token)('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  db.guardarBarco(biaId, 'lago-1', 45_000, [1, 2, 3], JSON.stringify(corridaDe(900).amostras));
  db.guardarBarco(caioId, 'lago-1', 44_000, [1, 2, 3], JSON.stringify(corridaDe(880).amostras));
  const m = contexto([anaId], { solo: true });
  const j = barco.comecar(m.ctx, { naSala: [anaId], criadaPor: anaId, corpo: { pista: 'lago-1' } });
  assert.ok(typeof j !== 'string');
  const recordes = j.publico(anaId).recordes as { userId: number }[];
  assert.deepEqual(recordes.map((r) => r.userId), [biaId, anaId], 'o Caio não é amigo: não aparece');
  assert.equal(j.acao(anaId, { tipo: 'correr', fantasmas: [anaId, biaId, caioId] }), null);
  const fantasmas = j.publico(anaId).fantasmas as { userId: number; amostras: number[] }[];
  assert.deepEqual(fantasmas.map((f) => f.userId), [anaId, biaId], 'nem pedindo pelo console');
  assert.ok(fantasmas[1].amostras.length > 100);
});

test('na sala: o verde do servidor, a classificação pelo tempo, o prazo depois da primeira chegada, e o pódio na estante', () => {
  const m = contexto([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  const j = barco.comecar(m.ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: { pista: 'mangue-1' } });
  assert.ok(typeof j !== 'string');
  assert.equal(j.publico(anaId).fase, 'largada');
  assert.equal(m.relogio[0].ms, LARGADA_MS);
  assert.ok(j.acao(anaId, corridaDe(900, 'mangue-1')), 'chegar na contagem');
  m.relogio[0].depois();
  assert.equal(j.publico(anaId).fase, 'correndo');
  // a posição: a primeira sai da largada; a que pula não é repassada
  const { largada } = PISTAS_DO_BARCO['mangue-1'];
  agora += 200;
  assert.equal(j.tempoReal!(biaId, { x: 500, y: 500, a: 0, n: 5, andou: -0.02 }), null, 'longe da largada');
  const repassada = j.tempoReal!(biaId, { x: largada[0] + 3, y: largada[1], a: 0, n: 5, andou: -0.02, v: 9999 }) as { userId: number; v: number };
  assert.ok(repassada && repassada.userId === biaId, 'carimbada com quem mandou');
  assert.equal(repassada.v, 400, 'a velocidade de desenho tem teto');
  assert.equal(j.tempoReal!(biaId, { x: largada[0] + 200, y: largada[1], a: 0, n: 9, andou: -0.01 }), null, 'o salto');
  agora += 1000;
  assert.ok(j.acao(anaId, corridaDe(900, 'mangue-1')), 'o fantasma guardado, 1 s depois do verde');
  agora += 31_000 - FOLGA_MS;
  assert.equal(j.acao(biaId, corridaDe(950, 'mangue-1')), null, 'a Bia chega primeiro');
  assert.equal(m.relogio[0].ms, PRAZO_MS, 'e abre o prazo');
  assert.equal(m.terminou(), false);
  assert.equal(j.acao(anaId, corridaDe(900, 'mangue-1')), null, 'a Ana chega depois na rede, com tempo menor');
  assert.equal(m.terminou(), false, 'o Caio ainda corre');
  m.relogio[0].depois();
  assert.equal(m.terminou(), true, 'o prazo fecha');
  const pilotos = j.publico(anaId).pilotos as { userId: number; posicao: number; tempoMs: number | null }[];
  assert.deepEqual(pilotos.map((p) => [p.userId, p.posicao]), [[anaId, 1], [biaId, 2], [caioId, 3]]);
  assert.equal(pilotos[2].tempoMs, null);
  const daAna = db.trofeusDe(anaId).find((t) => t.pista === 'barco');
  assert.ok(daAna && daAna.posicao === 1);
  assert.deepEqual(daAna.rivais.map((r) => r.userId).sort(), [biaId, caioId].sort());
  assert.equal(db.trofeusDe(caioId).some((t) => t.pista === 'barco'), false, 'quem não chegou não sobe ao pódio');
  assert.equal(db.recordeDoBarco(anaId, 'mangue-1')?.tempoMs, 30_000, 'sem itens, a corrida da sala vira recorde');
});

test('na sala, sozinho no fim (os outros saíram): a corrida fecha sem troféu', () => {
  let naSala = [anaId, biaId];
  const m = contexto(naSala, { comunidadeId: comunidade.id });
  m.ctx.naSala = () => naSala;
  const j = barco.comecar(m.ctx, { naSala, criadaPor: anaId, corpo: { pista: 'riacho-1' } });
  assert.ok(typeof j !== 'string');
  m.relogio[0].depois();
  const antes = db.trofeusDe(anaId).filter((t) => t.pista === 'barco').length;
  naSala = [anaId];
  agora += 40_000;
  assert.equal(j.acao(anaId, corridaDe(1000, 'riacho-1')), null);
  assert.equal(m.terminou(), true, 'quem ficou chegou: acabou');
  assert.equal(db.trofeusDe(anaId).filter((t) => t.pista === 'barco').length, antes, 'com um só até o fim, não há pódio');
  assert.equal(j.acao(caioId, corridaDe(1000, 'riacho-1')), 'Você não está nesta corrida.');
});
