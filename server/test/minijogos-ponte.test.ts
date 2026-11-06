/**
 * A Ponte da toca (minijogo-ponte.ts): o site manda só a lista de peças; o servidor confere a lista, refaz a simulação com a mesma
 * regra (ponte-sim.ts) e o resultado é o dele. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarPonte, CONTAGEM_MS, MONTAGEM_MS, FOLGA_MS } = await import('../src/minijogo-ponte.js');
const sim = await import('../src/ponte-sim.js');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-ponte');
const bia = await criarConta(app, 'bia-ponte');
const caio = await criarConta(app, 'caio-ponte');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);
const caioId = await idDe(caio.token);
const nomes: Record<number, string> = { [anaId]: 'ana', [biaId]: 'bia', [caioId]: 'caio' };

interface Linha {
  userId: number;
  mandou: boolean;
  passou: boolean;
  progresso: number;
  custo: number;
  posicao: number | null;
}
interface Estado {
  fase: string;
  faseDaPonte: string;
  meu: { passou: boolean; progresso: number; custo: number } | null;
  placar: Linha[];
  pontes: { userId: number; pecas: number[] }[];
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[], corpo: Record<string, unknown> = { fase: 'riacho' }) {
  let terminou = false;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => nomes[id],
    comunidade: naSala.length > 1 ? 1 : 0,
    solo: naSala.length === 1,
  };
  const jogo = criarPonte({ agora: () => agora, aleatorio: () => 0.5 }).comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo });
  assert.ok(typeof jogo !== 'string', String(jogo));
  return { jogo, estado: (id: number) => jogo.publico(id) as unknown as Estado, terminou: () => terminou };
}

const riacho = sim.faseDe('riacho')!;
const boa = sim.pontePronta(riacho);
/** Só a pista, sem estrutura: cai. */
const fraca = [0, 0, 2, 0, sim.PISTA, 2, 0, 4, 0, sim.PISTA, 4, 0, 6, 0, sim.PISTA];

test('as duas cópias da regra são iguais (o servidor refaz com a mesma conta do site)', () => {
  const site = readFileSync(new URL('../../web/src/ponte/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../src/ponte-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/ponte/sim.ts e server/src/ponte-sim.ts mudaram separados: copie uma sobre a outra');
});

test('no Solo, o resultado é o que o servidor refez, e a ponte que passou vira o recorde da fase', () => {
  const p = comecar([anaId]);
  assert.equal(p.estado(anaId).faseDaPonte, 'riacho');
  assert.equal(p.jogo.acao(anaId, { tipo: 'ponte', pecas: boa, passou: false, custo: 1 }), null);
  const fim = p.estado(anaId);
  const esperado = sim.simular(riacho, boa);
  assert.deepEqual(fim.meu, { passou: true, progresso: 1000, custo: esperado.custo, passos: esperado.passos });
  assert.ok(p.terminou());
  assert.equal(fim.recorde!.novo, true);
  assert.equal(db.recordeDaPonte(anaId, 'riacho'), esperado.custo);
  assert.deepEqual(fim.pontes, [{ userId: anaId, pecas: boa }]);
  assert.equal(p.jogo.acao(anaId, { tipo: 'ponte', pecas: boa }), 'Esta rodada já acabou.', 'uma vez só');

  // uma ponte mais cara não substitui; a que cai não conta
  const outra = comecar([anaId]);
  assert.equal(outra.estado(anaId).recorde!.antes, esperado.custo);
  assert.equal(outra.jogo.acao(anaId, { tipo: 'ponte', pecas: fraca }), null);
  const caiu = outra.estado(anaId);
  assert.equal(caiu.meu!.passou, false);
  assert.ok(caiu.meu!.progresso < 1000);
  assert.equal(caiu.recorde!.novo, false);
  assert.equal(db.recordeDaPonte(anaId, 'riacho'), esperado.custo);
  assert.deepEqual(db.pontesDe(anaId).map((r) => r.fase), ['riacho']);
});

test('o servidor recusa a peça fora da grade, comprida demais, repetida ou solta, e a fase que não existe', () => {
  const ruins: unknown[] = [
    'x',
    [0, 0, 2, 0],
    [0, 0, 2.5, 0, 0],
    [0, 0, 2, 0, 7],
    [0, 0, -1, 0, sim.MADEIRA], // a margem não é grade
    [0, 0, 1, 9, sim.ACO], // acima do alto
    [0, 0, 3, 0, sim.PISTA], // pista de 3 casas
    [0, 0, 1, 2, sim.PISTA], // pista mais inclinada que 45°
    [0, 0, 4, 0, sim.ACO], // aço de 4 casas
    [0, 0, 2, 0, sim.PISTA, 2, 0, 0, 0, sim.MADEIRA], // a mesma ligação duas vezes
    [2, 1, 3, 1, sim.MADEIRA], // solta, sem apoio
    [0, 0, 2, 0, sim.PISTA, 3, 1, 4, 1, sim.MADEIRA], // uma ligada e uma solta
    [0, -1, 1, -1, sim.MADEIRA], // a parede do barranco não é apoio
  ];
  const p = comecar([biaId]);
  for (const ruim of ruins) assert.equal(p.jogo.acao(biaId, { tipo: 'ponte', pecas: ruim }), 'Sessão inválida.', JSON.stringify(ruim));
  const demais: number[] = [];
  for (let i = 0; i <= sim.MAX_PECAS; i++) demais.push(0, 0, 1, 0, sim.PISTA);
  assert.equal(p.jogo.acao(biaId, { tipo: 'ponte', pecas: demais }), 'Sessão inválida.');
  assert.equal(p.terminou(), false);

  const def = criarPonte({ agora: () => agora });
  const ctx = { agendar: () => {}, avisar: () => {}, terminar: () => {}, naSala: () => [biaId], nome: () => 'bia', solo: true };
  assert.equal(def.comecar(ctx as never, { naSala: [biaId], criadaPor: biaId, corpo: { fase: 'lua' } }), 'Fase desconhecida.');
  const sorteada = def.comecar(ctx as never, { naSala: [biaId], criadaPor: biaId, corpo: { fase: 'sortear' } });
  assert.ok(typeof sorteada !== 'string');
  assert.ok(sim.faseDe(sorteada.publico(biaId).faseDaPonte));
});

test('na sala, a mesma fase, o relógio é o do servidor, e o pódio (só de quem passou) vai à estante', () => {
  const p = comecar([anaId, biaId, caioId], { fase: 'riacho' });
  // a mesma treliça sem as peças de aço dos apoios passa no riacho e sai mais barata
  const soMadeira: number[] = [];
  for (let i = 0; i < boa.length; i += 5) if (boa[i + 4] !== sim.ACO) soMadeira.push(...boa.slice(i, i + 5));
  assert.equal(sim.simular(riacho, soMadeira).passou, true, 'a treliça de madeira passa');
  assert.ok(sim.custo(soMadeira) < sim.custo(boa));

  agora += CONTAGEM_MS + 10_000;
  assert.equal(p.jogo.acao(anaId, { tipo: 'ponte', pecas: boa }), null);
  assert.equal(p.estado(anaId).pontes.length, 0, 'as pontes dos outros só no fim');
  assert.equal(p.terminou(), false, 'espera os outros');
  agora += 10_000;
  assert.equal(p.jogo.acao(biaId, { tipo: 'ponte', pecas: soMadeira }), null);
  // o Caio passou do relógio
  agora += MONTAGEM_MS + FOLGA_MS;
  assert.equal(p.jogo.acao(caioId, { tipo: 'ponte', pecas: fraca }), 'Esta rodada já acabou.');
  assert.equal(p.terminou(), false);
  // o Caio continua na sala sem ponte: só o prazo do servidor fecha esta partida
  p.jogo.conferir!();
  assert.equal(p.terminou(), false);

  const p2 = comecar([anaId, biaId], { fase: 'riacho' });
  assert.equal(p2.jogo.acao(anaId, { tipo: 'ponte', pecas: boa }), null);
  assert.equal(p2.jogo.acao(biaId, { tipo: 'ponte', pecas: soMadeira }), null);
  assert.ok(p2.terminou());
  const fim = p2.estado(anaId);
  assert.equal(fim.fase, 'fim');
  assert.equal(fim.placar[0].userId, biaId, 'a mais barata que passou ganha');
  assert.equal(fim.placar[0].posicao, 1);
  assert.equal(fim.placar[1].posicao, 2);
  assert.equal(fim.pontes.length, 2, 'no fim, as pontes de todos');
  assert.ok(db.trofeusDe(biaId).some((t) => t.pista === 'ponte' && t.posicao === 1 && t.pontos === sim.custo(soMadeira)));
  assert.ok(db.trofeusDe(anaId).some((t) => t.pista === 'ponte' && t.posicao === 2));
});

test('na sala, quem não passou fica atrás de quem passou, pelo quanto andou, e não sobe ao pódio', () => {
  const p = comecar([anaId, caioId], { fase: 'riacho' });
  const antes = db.trofeusDe(caioId).length;
  assert.equal(p.jogo.acao(caioId, { tipo: 'ponte', pecas: fraca }), null);
  assert.equal(p.jogo.acao(anaId, { tipo: 'ponte', pecas: boa }), null);
  const fim = p.estado(caioId);
  assert.deepEqual(
    fim.placar.map((l) => [l.userId, l.passou, l.posicao]),
    [
      [anaId, true, 1],
      [caioId, false, 2],
    ],
  );
  assert.equal(db.trofeusDe(caioId).length, antes, 'a ponte que caiu não ganha troféu');
});
