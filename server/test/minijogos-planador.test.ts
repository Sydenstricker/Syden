/**
 * O Planador da toca (minijogo-planador.ts, planador-sim.ts): o servidor REFAZ o voo pelos comandos; o Solo (o recorde por
 * desafio, os fantasmas só de amigos, o relógio) e o voo na sala (a escolha de quem começou, o verde, as posições conferidas,
 * a classificação pelos pontos e o pódio).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarPlanador, FOLGA_MS, LARGADA_MS } = await import('../src/minijogo-planador.js');
const sim = await import('../src/planador-sim.js');
const db = await import('../src/db.js');
let agora = 1_000_000;
const planador = criarPlanador(() => agora);
after(fechar);

const ana = await criarConta(app, 'ana-planador');
const bia = await criarConta(app, 'bia-planador');
const caio = await criarConta(app, 'caio-planador');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const comunidade = (await comToken(app, ana.token)('POST', '/api/communities', { name: 'Turma do planador' })).json() as { id: number };

/** Um voo: o piloto automático (ou outro), gravado em trechos. */
function voo(id: string, piloto: (v: import('../src/planador-sim.js').Voo) => number = sim.pilotoAutomatico) {
  const v = sim.novoVoo(sim.desafioPorId(id)!);
  const g = sim.gravador();
  while (!v.fim) {
    const c = piloto(v);
    g.anotar(c);
    sim.passo(v, c);
  }
  return { entradas: g.entradas, r: v.fim! };
}
const ms = (passos: number) => Math.round((passos * 1000) / 60);

function contexto(naSala: number[], { comunidadeId = 0, solo = false } = {}) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou = false;
  return {
    relogio,
    terminou: () => terminou,
    ctx: {
      agendar: (t: number, depois: () => void) => relogio.splice(0, relogio.length, { ms: t, depois }),
      avisar: () => {},
      terminar: () => (terminou = true),
      naSala: () => naSala,
      nome: (id: number) => (id === anaId ? 'ana' : id === biaId ? 'bia' : 'caio'),
      comunidade: comunidadeId,
      solo,
    },
  };
}

test('o Solo: o voo honesto vira recorde; comandos que não acabam, inválidos, ou mais rápidos que o relógio, não', () => {
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = planador.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  assert.equal(jogo.acao(anaId, { tipo: 'voar', desafio: 'nenhum' }), 'Desafio desconhecido.');
  assert.equal(jogo.acao(anaId, { tipo: 'voar', desafio: 'asa-1' }), null);
  const { entradas, r } = voo('asa-1');
  agora += 5_000;
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas }), 'Voo inválido.', 'mais rápido que o relógio');
  agora += ms(r.passos);
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas: [100, 0] }), 'Voo inválido.', 'não pousou');
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas: [100, 32] }), 'Voo inválido.', 'comando fora da faixa');
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas: [99999999, 0] }), 'Voo inválido.', 'longo demais');
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas }), null);
  const p = jogo.publico(anaId) as { fase: string; resultado: { total: number; recorde: boolean; como: string } };
  assert.equal(p.fase, 'resultado');
  assert.equal(p.resultado.como, 'pousou');
  assert.equal(p.resultado.total, r.total, 'os pontos são os que o servidor refez');
  assert.equal(p.resultado.recorde, true);
  assert.equal(db.recordeDoPlanador(anaId, 'asa-1')?.pontos, r.total);
  // um voo pior não substitui
  assert.equal(jogo.acao(anaId, { tipo: 'voar', desafio: 'asa-1' }), null);
  agora += 200_000;
  const pior = voo('asa-1', () => sim.CIMA);
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas: pior.entradas }), null);
  const q = jogo.publico(anaId) as { resultado: { recorde: boolean; anterior: number; como: string } };
  assert.equal(q.resultado.como, 'batida');
  assert.equal(q.resultado.recorde, false);
  assert.equal(q.resultado.anterior, r.total);
});

test('o Solo: o fantasma é só o meu e o dos amigos aceitos, por desafio', async () => {
  const { entradas, r } = voo('queda-1');
  db.guardarPlanador(biaId, 'queda-1', r.total, r.passos, JSON.stringify(entradas));
  db.guardarPlanador(caioId, 'queda-1', r.total + 1, r.passos, JSON.stringify(entradas));
  await comToken(app, ana.token)('POST', '/api/amigos', { username: 'bia-planador' });
  assert.equal((await comToken(app, bia.token)('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
  const { ctx } = contexto([anaId], { solo: true });
  const jogo = planador.comecar(ctx, { naSala: [anaId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const recordes = (jogo.publico(anaId) as { recordes: { userId: number; desafio: string }[] }).recordes;
  assert.ok(!recordes.some((x) => x.userId === caioId), 'o Caio não é amigo: não aparece');
  assert.ok(recordes.some((x) => x.userId === biaId && x.desafio === 'queda-1'));
  assert.equal(jogo.acao(anaId, { tipo: 'voar', desafio: 'queda-1', fantasmas: [biaId, caioId] }), null);
  const f = (jogo.publico(anaId) as { fantasmas: { userId: number; entradas: number[] }[] }).fantasmas;
  assert.deepEqual(f.map((x) => x.userId), [biaId]);
  assert.deepEqual(f[0].entradas, entradas, 'o fantasma são os comandos');
  assert.ok(db.planadorDe(anaId).length === 1, 'o "Levar seus dados" leva o recorde');
});

test('a sala: quem começou escolhe, o verde do servidor, as posições conferidas, a classificação pelos pontos e o pódio', () => {
  const { ctx, relogio, terminou } = contexto([anaId, biaId, caioId], { comunidadeId: comunidade.id });
  const jogo = planador.comecar(ctx, { naSala: [anaId, biaId, caioId], criadaPor: anaId, corpo: {} });
  assert.ok(typeof jogo !== 'string');
  const pub = () =>
    jogo.publico(anaId) as { fase: string; desafio: string; pilotos: { userId: number; resultado: { total: number } | null; posicao: number | null }[] };
  assert.equal(pub().fase, 'escolha');
  assert.equal(jogo.acao(biaId, { tipo: 'escolher', desafio: 'mochila-1' }), 'Quem começou escolhe o desafio.');
  assert.equal(jogo.acao(anaId, { tipo: 'escolher', desafio: 'mochila-1' }), null);
  assert.equal(pub().fase, 'largada');
  assert.equal(pub().desafio, 'mochila-1');
  assert.equal(relogio[0].ms, LARGADA_MS);
  agora += LARGADA_MS;
  relogio[0].depois();
  assert.equal(pub().fase, 'voando');

  // a posição ao vivo: andar o que um voo anda passa; saltar ou voar à frente do relógio, não
  agora += 1000;
  assert.ok(jogo.tempoReal!(anaId, { n: 60, x: 512, y: 896, h: 3 }));
  assert.equal(jogo.tempoReal!(anaId, { n: 61, x: 700, y: 896, h: 3 }), null, 'salto');
  assert.equal(jogo.tempoReal!(anaId, { n: 9000, x: 512, y: 896, h: 3 }), null, 'à frente do relógio');

  const a = voo('mochila-1');
  // a Bia sobe e cai: só os anéis que pegou
  const b = voo('mochila-1', (v) => (v.passo < 180 ? sim.BOTAO : 0));
  agora += ms(Math.max(a.r.passos, b.r.passos)) + FOLGA_MS;
  assert.equal(jogo.acao(biaId, { tipo: 'pouso', entradas: b.entradas }), null);
  assert.equal(jogo.acao(anaId, { tipo: 'pouso', entradas: a.entradas }), null);
  assert.equal(pub().pilotos[0].userId, anaId, 'mais pontos na frente');
  assert.equal(pub().pilotos[0].resultado!.total, a.r.total);
  // o caio não pousa: o tempo do desafio fecha
  relogio[0].depois();
  assert.ok(terminou());
  const fim = pub().pilotos;
  assert.deepEqual(fim.map((p) => p.posicao), [1, 2, 3]);
  assert.equal(fim.at(-1)!.resultado, null);
  const trofeus = db.trofeusParaLevar(anaId) as { pista: string; pontos: number }[];
  assert.ok(trofeus.some((t) => t.pista === 'planador' && t.pontos === a.r.total));
});

test('a sala: o desafio que já vem no convite larga direto, e o desconhecido não começa', () => {
  const { ctx } = contexto([anaId, biaId], { comunidadeId: comunidade.id });
  assert.equal(planador.comecar(ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { desafio: 'x' } }), 'Desafio desconhecido.');
  const jogo = planador.comecar(ctx, { naSala: [anaId, biaId], criadaPor: anaId, corpo: { desafio: 'queda-1' } });
  assert.ok(typeof jogo !== 'string');
  assert.equal((jogo.publico(anaId) as { fase: string }).fase, 'largada');
});
