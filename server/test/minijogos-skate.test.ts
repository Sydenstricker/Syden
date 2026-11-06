/**
 * O Rolê do coelho (minijogo-skate.ts): a sessão é do site, e o servidor só confere o fim (uma vez, o tamanho, os passos e o
 * relógio) e guarda o recorde do Solo. O relógio aqui é de mão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { criarSkate, PASSOS_DA_SESSAO, DURACAO_MS, PRAZO_MS, PONTOS_MAX } = await import('../src/minijogo-skate.js');
const db = await import('../src/db.js');
after(fechar);

let agora = 9_000_000;
const ana = await criarConta(app, 'ana-skate');
const bia = await criarConta(app, 'bia-skate');
const idDe = async (token: string) => (await comToken(app, token)('GET', '/api/me')).json().id as number;
const anaId = await idDe(ana.token);
const biaId = await idDe(bia.token);

interface Estado {
  fase: string;
  meu: { pontos: number | null; melhorCombo: number | null } | null;
  placar: { userId: number; pontos: number | null; posicao: number | null }[];
  recorde: { antes: number | null; novo: boolean } | null;
}

function comecar(naSala: number[], comunidade = 0) {
  const relogio: { ms: number; depois: () => void }[] = [];
  let terminou: boolean | null = null;
  let sala = [...naSala];
  const ctx = {
    agendar: (ms: number, depois: () => void) => relogio.splice(0, relogio.length, { ms, depois }),
    avisar: () => {},
    terminar: (completa = true) => (terminou = completa),
    naSala: () => sala,
    nome: (id: number) => (id === anaId ? 'ana' : 'bia'),
    comunidade,
  };
  const jogo = criarSkate({ agora: () => agora }).comecar(ctx, { naSala, criadaPor: naSala[0], corpo: {} });
  assert.ok(typeof jogo !== 'string');
  return {
    jogo,
    estado: (id: number) => jogo.publico(id) as unknown as Estado,
    terminou: () => terminou,
    sair: (id: number) => (sala = sala.filter((x) => x !== id)),
    prazo: () => {
      agora += relogio[0].ms;
      relogio[0].depois();
    },
  };
}

const fim = (pontos: number, passos = PASSOS_DA_SESSAO, melhorCombo = Math.floor(pontos / 2)) => ({ tipo: 'fim', pontos, passos, melhorCombo });

test('no Solo, a sessão inteira vira o recorde, e a pior não substitui', () => {
  const p = comecar([anaId]);
  assert.equal(p.estado(anaId).recorde?.antes, null);
  // antes de passar o minuto no relógio do servidor, não dá para ter andado a sessão inteira
  agora += 30_000;
  assert.equal(p.jogo.acao(anaId, fim(4000)), 'Sessão inválida.');
  agora += DURACAO_MS;
  assert.equal(p.jogo.acao(anaId, fim(4000)), null);
  assert.equal(p.terminou(), true);
  const e = p.estado(anaId);
  assert.equal(e.fase, 'fim');
  assert.deepEqual(e.recorde, { antes: null, novo: true });
  assert.equal(db.recordeDoSkate(anaId), 4000);
  // uma vez só
  assert.equal(p.jogo.acao(anaId, fim(9000)), 'Esta rodada já acabou.');

  const q = comecar([anaId]);
  assert.equal(q.estado(anaId).recorde?.antes, 4000);
  agora += DURACAO_MS + 5000;
  assert.equal(q.jogo.acao(anaId, fim(2500)), null);
  assert.deepEqual(q.estado(anaId).recorde, { antes: 4000, novo: false });
  assert.equal(db.recordeDoSkate(anaId), 4000);
});

test('o servidor confere o tamanho da sessão', () => {
  const p = comecar([anaId]);
  agora += DURACAO_MS + 60_000;
  assert.equal(p.jogo.acao(anaId, fim(-1)), 'Sessão inválida.');
  assert.equal(p.jogo.acao(anaId, fim(PONTOS_MAX + 1)), 'Sessão inválida.');
  assert.equal(p.jogo.acao(anaId, fim(1.5)), 'Sessão inválida.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'fim', pontos: '100', passos: PASSOS_DA_SESSAO, melhorCombo: 0 }), 'Sessão inválida.');
  // a sessão é de 3600 passos (um pouco mais, para fechar o combo no ar), nem menos, nem muito mais
  assert.equal(p.jogo.acao(anaId, fim(100, PASSOS_DA_SESSAO - 1)), 'Sessão inválida.');
  assert.equal(p.jogo.acao(anaId, fim(100, PASSOS_DA_SESSAO + 5000)), 'Sessão inválida.');
  // o melhor combo não passa do total
  assert.equal(p.jogo.acao(anaId, fim(100, PASSOS_DA_SESSAO, 200)), 'Sessão inválida.');
  assert.equal(p.jogo.acao(anaId, { tipo: 'manobra' }), 'Ação desconhecida.');
  assert.equal(p.jogo.acao(999, fim(100)), 'Você está assistindo esta partida.');
  // e o que é válido passa
  assert.equal(p.jogo.acao(anaId, fim(100, PASSOS_DA_SESSAO + 300, 100)), null);
});

test('com a turma, cada um manda a sua sessão, e o pódio vai para a estante', () => {
  const p = comecar([anaId, biaId], 1);
  agora += DURACAO_MS + 3000;
  assert.equal(p.jogo.acao(anaId, fim(7000)), null);
  // falta a Bia: a partida espera
  assert.equal(p.terminou(), null);
  assert.equal(p.estado(biaId).placar[0].userId, anaId);
  assert.equal(p.estado(biaId).placar[0].posicao, 1);
  assert.equal(p.estado(biaId).placar[1].posicao, null);
  assert.equal(p.jogo.acao(biaId, fim(9000)), null);
  assert.equal(p.terminou(), true);
  const placar = p.estado(anaId).placar;
  assert.deepEqual(
    placar.map((l) => [l.userId, l.posicao]),
    [
      [biaId, 1],
      [anaId, 2],
    ],
  );
  assert.equal(p.estado(anaId).recorde, null);
});

test('quem sai da sala não segura a partida, e o prazo fecha o resto', () => {
  const p = comecar([anaId, biaId], 1);
  agora += DURACAO_MS + 3000;
  assert.equal(p.jogo.acao(anaId, fim(500)), null);
  p.sair(biaId);
  p.jogo.conferir!();
  assert.equal(p.terminou(), true);

  const q = comecar([anaId, biaId], 1);
  q.prazo();
  assert.ok(PRAZO_MS > DURACAO_MS);
  // ninguém mandou: a partida acaba como interrompida
  assert.equal(q.terminou(), false);
});

test('os números da sessão são os mesmos da física do site', async () => {
  const fisica = await import('../../web/src/skate/fisica.js');
  const { PASSOS_DE_FOLGA } = await import('../src/minijogo-skate.js');
  assert.equal(fisica.PASSOS_DA_SESSAO, PASSOS_DA_SESSAO);
  assert.equal(fisica.PASSOS_DE_FOLGA, PASSOS_DE_FOLGA);
});
