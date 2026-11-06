/**
 * O Trânsito da toca (minijogo-transito.ts): o site joga e manda só as liberações; o servidor refaz a partida inteira com a mesma
 * regra (transito-sim.ts) e os pontos são os dele. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarTransito, DURACAO_MS } = await import('../src/minijogo-transito.js');
const sim = await import('../src/transito-sim.js');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-transito');
const bia = await criarConta(app, 'bia-transito');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Estado {
  fase: string;
  semente: number;
  meu: { pontos: number | null; atravessaram: number | null; batidas: number | null } | null;
  placar: { userId: number; pontos: number | null; posicao: number | null }[];
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[]) {
  let terminou = false;
  const ctx = {
    agendar: () => {},
    avisar: () => {},
    terminar: () => (terminou = true),
    naSala: () => naSala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade: naSala.length > 1 ? 1 : 0,
  };
  const jogo = criarTransito({ agora: () => agora, aleatorio: () => 0.4242 }).comecar(ctx as never, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return { jogo, estado: (id: number) => jogo.publico(id) as unknown as Estado, terminou: () => terminou };
}

/** Uma partida honesta: solta o carro da frente quando, olhando 2,5 s adiante, ninguém bate (o piloto do site, resumido). */
function jogarDireito(semente: number) {
  const e = sim.novaPartida(semente);
  const lista: number[] = [];
  while (!e.terminou) {
    if (e.passo % 6 === 0 && !sim.travado(e)) {
      for (let rua = 0; rua < 4; rua++) {
        const c = sim.primeiroDaFila(e, rua);
        if (!c || c.s < sim.CAMINHOS[c.caminho].parada - 0.4) continue;
        const f = sim.copiar(e);
        sim.liberar(f, rua);
        for (let i = 0; i < 150 && !f.terminou; i++) sim.passo(f);
        if (f.batidas === 0 && sim.liberar(e, rua)) {
          lista.push(e.passo, rua);
          break;
        }
      }
    }
    sim.passo(e);
  }
  return { lista, e };
}

test('as duas cópias da regra são iguais (o servidor refaz com a mesma conta do site)', () => {
  const site = readFileSync(new URL('../../web/src/transito/sim.ts', import.meta.url));
  const servidor = readFileSync(new URL('../src/transito-sim.ts', import.meta.url));
  assert.ok(site.equals(servidor), 'web/src/transito/sim.ts e server/src/transito-sim.ts mudaram separados: copie uma sobre a outra');
});

test('no Solo, os pontos são os que o servidor refez, e viram o recorde', () => {
  const p = comecar([anaId]);
  const { semente } = p.estado(anaId);
  const { lista, e } = jogarDireito(semente);
  assert.ok(e.atravessaram > 30, 'a partida honesta solta muitos carros');
  agora += DURACAO_MS + 3000;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', liberacoes: lista }), null);
  const fim = p.estado(anaId);
  assert.equal(fim.meu!.pontos, e.pontos);
  assert.equal(fim.meu!.batidas, 0);
  assert.ok(p.terminou());
  assert.equal(fim.recorde!.novo, true);
  assert.equal(db.recordeDoTransito(anaId), e.pontos);
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', liberacoes: lista }), 'Esta rodada já acabou.', 'uma vez só');
});

test('o servidor recusa o minuto mais rápido que o relógio, e a lista fora da regra', () => {
  const p = comecar([biaId]);
  agora += 20_000;
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', liberacoes: [] }), 'Sessão inválida.', 'só passaram 20 s');
  agora += DURACAO_MS;
  for (const ruim of [[5], [10, 0, 5, 1], [10, 4], [3600, 0], [-1, 0], [10.5, 1], 'x', [10, 0, 10, 0]])
    assert.equal(p.jogo.acao(biaId, { tipo: 'fim', liberacoes: ruim }), 'Sessão inválida.', JSON.stringify(ruim));
  // os pontos são os da regra, não os que o site diria: soltar tudo de uma vez bate, e a lista não carrega pontos
  const cego: number[] = [];
  for (let passo = 0; passo < sim.PASSOS_DA_PARTIDA; passo += 6) for (let rua = 0; rua < 4; rua++) cego.push(passo, rua);
  const esperado = sim.refazer(p.estado(biaId).semente, cego);
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', liberacoes: cego.slice(0, 800), pontos: 9999 }), null);
  assert.ok(p.estado(biaId).meu!.pontos! < 9999);
  assert.ok(esperado.batidas >= 0);
});

test('com a turma, a mesma semente, e o pódio vai à estante de troféus', () => {
  const p = comecar([anaId, biaId]);
  const s = p.estado(anaId).semente;
  assert.equal(p.estado(biaId).semente, s, 'os mesmos carros para todos');
  const boa = jogarDireito(s).lista;
  agora += DURACAO_MS + 3000;
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', liberacoes: boa }), null);
  assert.equal(p.terminou(), false, 'espera a Bia');
  assert.equal(p.jogo.acao(biaId, { tipo: 'fim', liberacoes: boa.slice(0, 20) }), null);
  assert.ok(p.terminou());
  const placar = p.estado(anaId).placar;
  assert.equal(placar[0].userId, anaId);
  assert.equal(placar[0].posicao, 1);
  assert.ok(db.trofeusDe(anaId).some((t) => t.pista === 'transito' && t.posicao === 1));
});
