/**
 * Os Carrinhos da toca (minijogo-carrinhos.ts, carrinhos-sim.ts): o servidor REFAZ a corrida pelo acelerador; o Solo (o
 * recorde, os fantasmas só de amigos, o relógio) e a corrida na sala (o verde, a faixa de cada um, a classificação e o pódio).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { chaveDoRecorde, criarCarrinhos, FOLGA_MS, LARGADA_MS, PISTA_DOS_CARRINHOS } = await import('../src/minijogo-carrinhos.js');
const sim = await import('../src/carrinhos-sim.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const carrinhos = criarCarrinhos(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-carrinho');
const bia = await criarConta(app, 'bia-carrinho');
const caio = await criarConta(app, 'caio-carrinho');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma dos carrinhos' })).json() as { id: number };

/** Uma corrida honesta: o piloto automático na faixa, gravado em trechos. */
function corrida(faixa: number, margem = 0.3, pista = sim.PISTA_PADRAO, voltas = sim.VOLTAS) {
  const c = sim.novoCarro(faixa, pista, voltas);
  const g = sim.gravador();
  while (!c.chegou) {
    const a = sim.pilotoAutomatico(c, margem);
    g.anotar(a);
    sim.passo(c, a);
  }
  return { entradas: g.entradas, passos: c.voltas[voltas - 1], saidas: c.saidas };
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

test('a regra: o piloto automático fecha as cinco voltas sem sair; acelerador cheio sai na curva e volta depois de 1,75 s, parado', () => {
  const honesta = corrida(sim.FAIXA_DO_RECORDE);
  assert.equal(honesta.saidas, 0);
  const c = sim.novoCarro(0);
  let saiu = -1;
  while (saiu < 0 && c.passo < 2000) if (sim.passo(c, 8) === 'saiu') saiu = c.passo;
  assert.ok(saiu > 0, 'saiu da pista');
  assert.ok(sim.trechoEm(c.pista, 0, c.s).sentido !== 0, 'saiu numa curva');
  const onde = c.s;
  let voltou = -1;
  while (voltou < 0) if (sim.passo(c, 8) === 'voltou') voltou = c.passo;
  assert.equal(voltou - saiu, sim.FORA_PASSOS);
  assert.equal(c.s, onde, 'volta ao lugar de onde saiu');
  assert.equal(c.v, 0, 'parado');
});

test('determinismo: refazer as mesmas entradas dá o mesmo tempo', () => {
  const { entradas, passos } = corrida(2, 0.1);
  assert.equal(sim.refazer(2, entradas).voltas[sim.VOLTAS - 1], passos);
  assert.equal(sim.refazer(2, entradas).voltas[sim.VOLTAS - 1], passos);
});

test('o Solo: a corrida honesta vira recorde; entradas que não chegam, inválidas, ou mais rápidas que o relógio, não', () => {
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = carrinhos.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(anaId, { tipo: 'correr', robos: 3 }), null);
  const { entradas, passos } = corrida(sim.FAIXA_DO_RECORDE);
  // o relógio: a corrida não pode ter passado mais rápido do que o tempo de verdade
  agora += 10_000;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas }), 'Corrida inválida.');
  agora += Math.round((passos * 1000) / 60) - 10_000 + 500;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [100, 8] }), 'Corrida inválida.', 'não chegou');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [100, 9] }), 'Corrida inválida.', 'acelerador fora da faixa');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [99999999, 8] }), 'Corrida inválida.', 'longa demais');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas }), null);
  const p = jogo.publico(anaId) as { fase: string; robos: number; resultado: { tempoMs: number; recorde: boolean; saidas: number } };
  assert.equal(p.fase, 'resultado');
  assert.equal(p.robos, 3);
  assert.equal(p.resultado.recorde, true);
  assert.equal(p.resultado.saidas, 0);
  assert.equal(p.resultado.tempoMs, Math.round((passos * 1000) / 60));
  assert.equal(db.recordeDosCarrinhos(anaId, PISTA_DOS_CARRINHOS)?.tempoMs, p.resultado.tempoMs);
  // um tempo pior não substitui
  assert.equal(jogo.acao(anaId, { tipo: 'correr' }), null);
  agora += 120_000;
  const pior = corrida(sim.FAIXA_DO_RECORDE, 0.8);
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: pior.entradas }), null);
  assert.equal((jogo.publico(anaId) as { resultado: { recorde: boolean } }).resultado.recorde, false);
});

test('o Solo: o fantasma é só o meu e o dos amigos aceitos', async () => {
  const { entradas } = corrida(sim.FAIXA_DO_RECORDE, 0.5);
  db.guardarCarrinhos(biaId, PISTA_DOS_CARRINHOS, 50_000, [1], JSON.stringify(entradas));
  db.guardarCarrinhos(caioId, PISTA_DOS_CARRINHOS, 49_000, [1], JSON.stringify(entradas));
  await comToken(app, ana.token)('POST', '/api/amigos', { username: 'bia-carrinho' });
  assert.equal((await comToken(app, bia.token)('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = carrinhos.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const recordes = (jogo.publico(anaId) as { recordes: { userId: number }[] }).recordes.map((r) => r.userId);
  assert.deepEqual(recordes.sort(), [anaId, biaId].sort(), 'o Caio não é amigo: não aparece');
  assert.equal(jogo.acao(anaId, { tipo: 'correr', fantasmas: [anaId, biaId, caioId] }), null);
  const f = (jogo.publico(anaId) as { fantasmas: { userId: number; entradas: number[] }[] }).fantasmas;
  assert.deepEqual(f.map((x) => x.userId), [anaId, biaId]);
  assert.deepEqual(f[1].entradas, entradas, 'o fantasma é o acelerador');
  assert.ok(db.carrinhosDe(anaId).length === 1, 'o "Levar seus dados" leva o recorde');
});

test('a sala: cada um na sua faixa, o verde do servidor, as posições conferidas, a classificação e o pódio', () => {
  const { ctx, relogio, terminou } = contexto([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  const jogo = carrinhos.comecar(ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const pub = () => jogo.publico(anaId) as { fase: string; pilotos: { userId: number; faixa: number; tempoMs: number | null; posicao: number | null }[] };
  assert.equal(pub().fase, 'largada');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [1, 8] }), 'A corrida não está andando.');
  assert.equal(relogio[0].ms, LARGADA_MS);
  agora += LARGADA_MS;
  relogio[0].depois();
  assert.equal(pub().fase, 'correndo');
  const faixa = (id: number) => pub().pilotos.find((p) => p.userId === id)!.faixa;
  assert.deepEqual([faixa(anaId), faixa(biaId), faixa(caioId)], [0, 1, 2]);

  // a posição ao vivo: andar o que a reta deixa passa; saltar ou correr à frente do relógio, não
  agora += 1000;
  assert.ok(jogo.tempoReal!(anaId, { n: 60, s: 5, f: 0 }));
  assert.equal(jogo.tempoReal!(anaId, { n: 61, s: 9 }), null, 'salto');
  assert.equal(jogo.tempoReal!(anaId, { n: 9000, s: 6 }), null, 'à frente do relógio');

  const a = corrida(0, 0.2);
  const b = corrida(1, 0.6);
  agora += Math.round((Math.max(a.passos, b.passos) * 1000) / 60) + FOLGA_MS;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: a.entradas }), null);
  const tempoDaAna = pub().pilotos.find((p) => p.userId === anaId)!.tempoMs;
  assert.equal(tempoDaAna, Math.round((a.passos * 1000) / 60), 'o tempo é o que o servidor refez, na faixa dela');
  assert.equal(jogo.acao(biaId, { tipo: 'chegada', entradas: b.entradas }), null);
  // o caio não chega: o prazo fecha
  relogio[0].depois();
  assert.ok(terminou());
  const fim = pub().pilotos;
  assert.equal(fim.find((p) => p.userId === caioId)!.tempoMs, null);
  assert.equal(fim.at(-1)!.userId, caioId);
  const trofeus = db.trofeusParaLevar(anaId) as { pista: string }[];
  assert.ok(trofeus.some((t) => t.pista === 'carrinhos'));
});

test('as pistas (19/11/2026): no Solo, cada pista e cada número de voltas tem o seu recorde; a Toca em cinco é a chave de antes', () => {
  assert.equal(chaveDoRecorde(sim.PISTA_PADRAO, sim.VOLTAS), PISTA_DOS_CARRINHOS, 'os recordes de antes continuam valendo');
  assert.equal(chaveDoRecorde(sim.PISTAS['zigue-1'], sim.VOLTAS_DA_RESISTENCIA), 'zigue-1@20c');
  const { ctx } = contexto([caioId], { solo: true });
  const jogo = carrinhos.comecar(ctx, { naSala: [caioId], criadaPor: caioId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const pub = () => jogo.publico(caioId) as { pista: string; tracado: string; voltasDaCorrida: number; resultado: { tempoMs: number; recorde: boolean } | null; meusTempos: Record<string, number> };
  assert.equal(pub().pista, 'toca-1');
  assert.equal(jogo.acao(caioId, { tipo: 'escolher', pista: 'nao-existe' }), 'Pista inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'escolher', pista: 'caracol-1', voltas: 20 }), null);
  assert.equal(pub().pista, 'caracol-1');
  assert.equal(pub().voltasDaCorrida, 20);
  // a corrida de 20 voltas no caracol, refeita pelo servidor
  assert.equal(jogo.acao(caioId, { tipo: 'correr' }), null);
  const longa = corrida(sim.FAIXA_DO_RECORDE, 0.3, sim.PISTAS['caracol-1'], 20);
  // as entradas de cinco voltas na Toca não chegam ao fim aqui
  agora += 30 * 60_000;
  assert.equal(jogo.acao(caioId, { tipo: 'chegada', entradas: corrida(sim.FAIXA_DO_RECORDE).entradas }), 'Corrida inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'chegada', entradas: longa.entradas }), null);
  assert.equal(pub().resultado?.tempoMs, Math.round((longa.passos * 1000) / 60));
  assert.equal(db.recordeDosCarrinhos(caioId, 'caracol-1@20c')?.tempoMs, pub().resultado?.tempoMs);
  assert.equal(db.recordeDosCarrinhos(caioId, 'caracol-1'), null, 'as cinco voltas são outro recorde');
  assert.equal(pub().meusTempos['caracol-1@20c'], pub().resultado?.tempoMs);
});

test('o editor: o servidor confere o código colado, refaz a corrida sobre ele e guarda o recorde pelo código', () => {
  const tracado = 'RRRRR++RRRRR++';
  const codigo = sim.codigoDaPista(tracado);
  const pista = sim.pistaPedida(undefined, codigo)!;
  assert.ok(pista && pista.tracado === tracado);
  const { ctx } = contexto([caioId], { solo: true });
  const jogo = carrinhos.comecar(ctx, { naSala: [caioId], criadaPor: caioId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  // o que não fecha, se cruza ou não é código, não corre
  assert.equal(jogo.acao(caioId, { tipo: 'correr', codigo: 'SYDP1-RRRR+RR' }), 'Pista inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'correr', codigo: sim.codigoDaPista('R+R++R+--R--') }), 'Pista inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'correr', codigo: 'oi' }), 'Pista inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'correr', codigo }), null);
  assert.equal((jogo.publico(caioId) as { tracado: string }).tracado, tracado);
  const c = corrida(sim.FAIXA_DO_RECORDE, 0.3, pista);
  agora += 10 * 60_000;
  // a corrida da Toca não serve na pista do editor
  assert.equal(jogo.acao(caioId, { tipo: 'chegada', entradas: corrida(sim.FAIXA_DO_RECORDE).entradas }), 'Corrida inválida.');
  assert.equal(jogo.acao(caioId, { tipo: 'chegada', entradas: c.entradas }), null);
  assert.equal(db.recordeDosCarrinhos(caioId, codigo)?.tempoMs, Math.round((c.passos * 1000) / 60), 'o recorde mora no código da pista');
});

test('a sala: a pista do editor e a resistência vão a todos; código que não vale não começa', () => {
  assert.equal(carrinhos.comecar(contexto([anaId, biaId]).ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { codigo: 'SYDP1-RRRR+RR' } }), 'Pista inválida.');
  const tracado = 'RRRRR++RRRRR++';
  const { ctx, relogio } = contexto([anaId, biaId], { comunidadeId: comunidade.id });
  const jogo = carrinhos.comecar(ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { codigo: sim.codigoDaPista(tracado), voltas: 20 } });
  assert.ok(typeof jogo !== 'string');
  const p = jogo.publico(biaId) as { tracado: string; voltasDaCorrida: number };
  assert.equal(p.tracado, tracado);
  assert.equal(p.voltasDaCorrida, 20);
  agora += LARGADA_MS;
  relogio[0].depois();
  const pista = sim.pistaPedida(undefined, sim.codigoDaPista(tracado))!;
  const a = corrida(0, 0.3, pista, 20);
  agora += 30 * 60_000;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: corrida(0, 0.3, pista).entradas }), 'Corrida inválida.', 'cinco voltas não bastam');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: a.entradas }), null);
  const ana = (jogo.publico(anaId) as { pilotos: { userId: number; tempoMs: number | null }[] }).pilotos.find((x) => x.userId === anaId)!;
  assert.equal(ana.tempoMs, Math.round((a.passos * 1000) / 60));
  assert.equal(db.recordeDosCarrinhos(anaId, sim.codigoDaPista(tracado) + '@20c'), null, 'a corrida da sala não vira recorde');
});

test('a Agulha na sala (24/11/2026): a troca de faixa vai nas posições (só para a outra da fileira) e o servidor refaz a corrida que troca', () => {
  const pista = sim.PISTAS['agulha-1'];
  const { ctx, relogio } = contexto([anaId, biaId], { comunidadeId: comunidade.id });
  const jogo = carrinhos.comecar(ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { pista: 'agulha-1' } });
  assert.ok(typeof jogo !== 'string');
  agora += LARGADA_MS;
  relogio[0].depois();
  agora += 1000;
  assert.ok(jogo.tempoReal!(anaId, { n: 60, s: 5, f: 0, x: 0 }));
  assert.equal(jogo.tempoReal!(anaId, { n: 61, s: 5.1, x: 2 }), null, 'só a outra faixa da mesma fileira');
  const r = jogo.tempoReal!(anaId, { n: 62, s: 3, x: 1, e: 0 }) as { x: number; e: number } | null;
  assert.ok(r, 'na troca, a distância é a da faixa nova');
  assert.equal(r!.x, 1);
  assert.equal(r!.e, 0);
  // a corrida que troca: o piloto com a troca, refeito pelo servidor a partir da faixa da largada
  const c = sim.novoCarro(0, pista);
  const g = sim.gravador();
  while (!c.chegou) {
    const a = sim.pilotoComTroca(c, 0.3);
    g.anotar(a);
    sim.passo(c, a);
  }
  assert.ok(g.entradas.some((v, i) => i % 2 === 1 && v >= sim.TROCA), 'trocou de faixa');
  agora += Math.round((c.voltas[4] * 1000) / 60) + FOLGA_MS;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: g.entradas }), null);
  const ana = (jogo.publico(anaId) as { pilotos: { userId: number; tempoMs: number | null }[] }).pilotos.find((x) => x.userId === anaId)!;
  assert.equal(ana.tempoMs, Math.round((c.voltas[4] * 1000) / 60));
  // numa pista sem agulha, trocar de faixa pelas posições não passa
  const outra = contexto([anaId, biaId], { comunidadeId: comunidade.id });
  const j2 = carrinhos.comecar(outra.ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof j2 !== 'string');
  agora += LARGADA_MS;
  outra.relogio[0].depois();
  agora += 1000;
  assert.equal(j2.tempoReal!(anaId, { n: 60, s: 5, x: 1 }), null);
});
