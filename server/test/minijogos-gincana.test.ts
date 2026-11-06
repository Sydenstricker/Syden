/**
 * A Gincana da toca (minijogo-gincana.ts, gincana-sim.ts): o servidor REFAZ o percurso pelos comandos; o Solo (o recorde por
 * percurso, os fantasmas só de amigos, o relógio) e a corrida na sala (o verde, as posições conferidas, a classificação, o
 * recomeço que não vale e o pódio).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarGincana, FOLGA_MS, LARGADA_MS } = await import('../src/minijogo-gincana.js');
const sim = await import('../src/gincana-sim.js');
const { planejar } = await import('../../web/src/gincana/piloto.ts');
const db = await import('../src/db.js');
let agora = 1_000_000;
const gincana = criarGincana(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-gincana');
const bia = await criarConta(app, 'bia-gincana');
const caio = await criarConta(app, 'caio-gincana');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma da gincana' })).json() as { id: number };

/** Um percurso honesto: o plano do piloto automático, gravado em trechos (um por percurso, guardado). */
const planos = new Map<string, { entradas: number[]; passos: number; posicoes: { n: number; x: number; y: number; z: number }[] }>();
function honesto(id: string) {
  const ja = planos.get(id);
  if (ja) return ja;
  const p = sim.PERCURSOS[id];
  const plano = planejar(p);
  assert.ok(plano, `o piloto fecha ${id}`);
  const g = sim.gravador();
  const c = sim.novoCoelho(p);
  const posicoes: { n: number; x: number; y: number; z: number }[] = [];
  for (const e of plano!) {
    g.anotar(e);
    sim.passo(c, e, p);
    if (c.passo % 4 === 0) posicoes.push({ n: c.passo, x: c.x, y: c.y, z: c.z });
  }
  assert.ok(c.chegou);
  const r = { entradas: g.entradas, passos: c.chegouEm, posicoes };
  planos.set(id, r);
  return r;
}

function contexto(naSala: number[], { comunidadeId = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (ms: number, depois: () => void) => relogio.push({ ms, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
      solo,
    },
  };
}

type Jogo = { publico: () => Record<string, unknown>; acao: (q: number, c: Record<string, unknown>) => string | null; tempoReal: (q: number, d: unknown) => unknown };

test('a regra: refazer os mesmos comandos dá o mesmo tempo; cair do mapa volta à última bandeira', () => {
  const p = sim.PERCURSOS['prado-1'];
  const { entradas, passos } = honesto('prado-1');
  assert.equal(sim.refazer(p, entradas).chegouEm, passos);
  assert.equal(sim.refazer(p, entradas).chegouEm, passos);
  // andar para o lado até cair: volta à largada, piscando, e conta a queda
  const c = sim.novoCoelho(p);
  let ev: sim.Evento = null;
  for (let i = 0; i < 600 && ev !== 'queda'; i++) ev = sim.passo(c, sim.ESQUERDA, p);
  assert.equal(ev, 'queda');
  assert.equal(c.quedas, 1);
  assert.equal(c.z, p.postos[0].zVolta);
  assert.ok(c.pisca > 0);
});

test('o Solo: o percurso honesto vira recorde; comandos que não chegam, inválidos, ou mais rápidos que o relógio, não', () => {
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = gincana.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} }) as Jogo;
  assert.equal(jogo.publico().fase, 'escolha');
  assert.equal(jogo.acao(anaId, { tipo: 'correr', percurso: 'ponte-2' }), null);
  assert.equal(jogo.publico().percurso, 'ponte-2');
  const { entradas, passos } = honesto('ponte-2');
  // um tempo impossível: a chegada logo depois da largada
  agora += 2000;
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas }), 'Corrida inválida.');
  agora += Math.round((passos * 1000) / 60);
  // só andar para a frente não chega (cai no primeiro buraco, volta e acaba os comandos)
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [600, sim.FRENTE] }), 'Corrida inválida.');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [10, 99] }), 'Corrida inválida.');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: 'x' }), 'Corrida inválida.');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas }), null);
  const r = jogo.publico().resultado as { tempoMs: number; recorde: boolean };
  assert.equal(r.tempoMs, Math.round((passos * 1000) / 60));
  assert.ok(r.recorde);
  assert.equal(db.recordeDaGincana(anaId, 'ponte-2')?.tempoMs, r.tempoMs);
  assert.equal(db.recordeDaGincana(anaId, 'prado-1'), null, 'cada percurso tem o seu recorde');
  assert.ok(db.gincanaDe(anaId).length === 1);
});

test('o Solo: o fantasma é só de amigo aceito', () => {
  // a bia guarda um recorde; a ana não é amiga dela
  const { ctx } = contexto([biaId], { solo: true });
  const jogoBia = gincana.comecar(ctx, { naSala: [biaId], criadaPor: biaId, corpo: {} }) as Jogo;
  jogoBia.acao(biaId, { tipo: 'correr', percurso: 'ponte-2' });
  agora += 120_000;
  assert.equal(jogoBia.acao(biaId, { tipo: 'chegada', entradas: honesto('ponte-2').entradas }), null);
  const { ctx: ctxAna } = contexto([anaId], { solo: true });
  const jogo = gincana.comecar(ctxAna, { naSala: [anaId], criadaPor: anaId, corpo: {} }) as Jogo;
  jogo.acao(anaId, { tipo: 'correr', percurso: 'ponte-2', fantasmas: [biaId, anaId] });
  const fantasmas = jogo.publico().fantasmas as { userId: number }[];
  assert.deepEqual(fantasmas.map((f) => f.userId), [anaId]);
});

test('na sala: o verde, as posições conferidas, a classificação pelo tempo refeito e o pódio', () => {
  const naSala = [anaId, biaId, caioId];
  const { ctx, relogio, terminou } = contexto(naSala, { comunidadeId: comunidade.id });
  const jogo = gincana.comecar(ctx, { naSala, criadaPor: anaId, corpo: { percurso: 'prado-1' } }) as Jogo;
  assert.equal(jogo.publico().fase, 'largada');
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas: [1, 1] }), 'A corrida não está andando.');
  agora += LARGADA_MS;
  relogio.shift()!.depois();
  assert.equal(jogo.publico().fase, 'correndo');
  const { entradas, passos, posicoes } = honesto('prado-1');

  // as posições: a honesta passa (carimbada); um salto, ou um passo à frente do relógio, não
  agora += 1000;
  const primeira = posicoes.find((q) => q.n === 32)!;
  assert.deepEqual((jogo.tempoReal(anaId, primeira) as { userId: number }).userId, anaId);
  assert.equal(jogo.tempoReal(biaId, { n: 40, x: 0, y: 0, z: 120 }), null, 'teleporte para a frente');
  assert.equal(jogo.tempoReal(biaId, { n: 60 * 60, x: 0, y: 0, z: 2 }), null, 'à frente do relógio');

  // o caio recarrega a página no meio: a chegada dele não vale
  agora += 9000;
  for (const q of posicoes.filter((q) => q.n <= 600)) jogo.tempoReal(caioId, q);
  jogo.tempoReal(caioId, posicoes[0]);
  agora += Math.round((passos * 1000) / 60);
  assert.equal(jogo.acao(caioId, { tipo: 'chegada', entradas }), 'Corrida inválida.');

  // a ana chega com o plano honesto; a bia, mais devagar (parada um segundo no começo, e o plano dela a partir dali: o que se
  // mexe anda pelo passo, e o plano da ana já não serviria)
  const p = sim.PERCURSOS['prado-1'];
  const parada = sim.novoCoelho(p);
  for (let i = 0; i < 60; i++) sim.passo(parada, 0, p);
  const daBia = sim.gravador();
  for (let i = 0; i < 60; i++) daBia.anotar(0);
  for (const e of planejar(p, parada)!) daBia.anotar(e);
  const tempoDaBia = sim.refazer(p, daBia.entradas).chegouEm;
  assert.ok(tempoDaBia > passos);
  assert.equal(jogo.acao(anaId, { tipo: 'chegada', entradas }), null);
  assert.ok(jogo.publico().prazo);
  agora += 2000;
  assert.equal(jogo.acao(biaId, { tipo: 'chegada', entradas: daBia.entradas }), null);
  const linhas = jogo.publico().corredores as { userId: number; tempoMs: number | null; posicao: number }[];
  assert.deepEqual(linhas.map((l) => l.userId), [anaId, biaId, caioId]);
  assert.equal(linhas[0].tempoMs, Math.round((passos * 1000) / 60));
  assert.equal(linhas[1].tempoMs, Math.round((tempoDaBia * 1000) / 60));
  assert.equal(linhas[2].tempoMs, null);
  // o prazo fecha: o pódio vai para a estante de quem chegou
  relogio.find((r) => r.ms === 30_000)!.depois();
  assert.ok(terminou());
  const trofeus = db.trofeusDe(anaId).filter((t) => t.pista === 'gincana');
  assert.equal(trofeus.length, 1);
  assert.equal(trofeus[0].posicao, 1);
  // a corrida da sala, sem itens, vira recorde (a ana não tinha no prado)
  assert.equal(db.recordeDaGincana(anaId, 'prado-1')?.tempoMs, Math.round((passos * 1000) / 60));
  assert.ok(FOLGA_MS > 0);
});
