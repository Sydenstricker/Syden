import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Server as IOServer } from 'socket.io';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS NÍVEIS (ver niveis.ts e o bloco "OS NÍVEIS" de db.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const niveis = await import('../src/niveis.js');

/** Um io de mentira que só anota o que seria avisado, e para quem. */
const avisos: { sala: string; evento: string; dados: unknown }[] = [];
const io = { to: (sala: string) => ({ emit: (evento: string, dados: unknown) => avisos.push({ sala, evento, dados }) }) } as unknown as IOServer;

const dona = comToken(app, (await criarConta(app, 'dona-niveis')).token);
const membro = comToken(app, (await criarConta(app, 'membro-niveis')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos níveis' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const ids = Object.fromEntries(
  ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).map((m) => [m.username, m.id]),
);
const membroId = ids['membro-niveis'];
const donaId = ids['dona-niveis'];

test('a conta do nível é a do MEE6: 100 pontos para o 1, mais 155 para o 2', () => {
  assert.equal(niveis.pontosParaSubir(0), 100);
  assert.equal(niveis.pontosParaSubir(1), 155);
  assert.deepEqual(niveis.nivelDe(0), { nivel: 0, noNivel: 0, paraOProximo: 100 });
  assert.deepEqual(niveis.nivelDe(99), { nivel: 0, noNivel: 99, paraOProximo: 100 });
  assert.deepEqual(niveis.nivelDe(255), { nivel: 2, noNivel: 0, paraOProximo: 220 });
});

test('desligados por padrão: mensagem não rende ponto, e o ranking vem vazio', async () => {
  niveis.pontuarMensagem(io, comunidade.id, membroId);
  assert.equal(db.pontosDe(comunidade.id, membroId), 0);
  const r = (await membro('GET', `/api/communities/${comunidade.id}/niveis`)).json();
  assert.equal(r.ligado, false);
  assert.deepEqual(r.ranking, []);
});

test('só quem administra liga; ligado, a comunidade avisa todo mundo', async () => {
  assert.equal((await membro('PATCH', `/api/communities/${comunidade.id}/niveis`, { ligado: true })).statusCode, 403);
  assert.equal((await dona('PATCH', `/api/communities/${comunidade.id}/niveis`, { ligado: 'sim' })).statusCode, 400);
  const r = await dona('PATCH', `/api/communities/${comunidade.id}/niveis`, { ligado: true });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().niveisLigados, 1);
});

test('uma mensagem rende de 15 a 25 pontos, e a segunda no mesmo minuto não rende nada', () => {
  const agora = 1_000_000_000;
  niveis.pontuarMensagem(io, comunidade.id, membroId, agora);
  const primeira = db.pontosDe(comunidade.id, membroId);
  assert.ok(primeira >= 15 && primeira <= 25, `rendeu ${primeira}`);
  niveis.pontuarMensagem(io, comunidade.id, membroId, agora + 30_000);
  assert.equal(db.pontosDe(comunidade.id, membroId), primeira, 'rajada não vale');
  niveis.pontuarMensagem(io, comunidade.id, membroId, agora + 61_000);
  assert.ok(db.pontosDe(comunidade.id, membroId) > primeira, 'passado o minuto, vale de novo');
});

test('voz só conta acompanhada', () => {
  const antes = db.pontosDe(comunidade.id, donaId);
  niveis.pontuarMinutoDeVoz(io, [{ userId: donaId, communityId: comunidade.id, channelId: 999 }]);
  assert.equal(db.pontosDe(comunidade.id, donaId), antes, 'sozinha na sala, nada');
  niveis.pontuarMinutoDeVoz(io, [
    { userId: donaId, communityId: comunidade.id, channelId: 999 },
    { userId: membroId, communityId: comunidade.id, channelId: 999 },
  ]);
  assert.equal(db.pontosDe(comunidade.id, donaId), antes + niveis.PONTOS_POR_MINUTO_DE_VOZ);
});

test('subir de nível entrega o cargo da recompensa e avisa só a própria pessoa', async () => {
  const cargo = (await dona('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Nível 1', cor: '#f5b83d' })).json();
  assert.equal((await membro('PUT', `/api/communities/${comunidade.id}/niveis/recompensas`, { nivel: 1, cargoId: cargo.id })).statusCode, 403);
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/niveis/recompensas`, { nivel: 0, cargoId: cargo.id })).statusCode, 400);
  const r = await dona('PUT', `/api/communities/${comunidade.id}/niveis/recompensas`, { nivel: 1, cargoId: cargo.id });
  assert.deepEqual(r.json(), [{ nivel: 1, cargoId: cargo.id }]);

  avisos.length = 0;
  // Leva até perto do nível 1 e deixa a próxima mensagem atravessar a linha.
  db.somarPontos(comunidade.id, membroId, 100 - db.pontosDe(comunidade.id, membroId) - 1, Date.now());
  niveis.pontuarMensagem(io, comunidade.id, membroId, Date.now() + 120_000);
  const membros = (await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; cargos: number[] }[];
  assert.deepEqual(membros.find((m) => m.id === membroId)!.cargos, [cargo.id], 'ganhou o cargo');
  const subiu = avisos.find((a) => a.evento === 'nivel:subiu');
  assert.ok(subiu, 'houve aviso');
  assert.equal(subiu!.sala, `user:${membroId}`, 'o aviso vai só para a pessoa');
  assert.deepEqual(subiu!.dados, { communityId: comunidade.id, nivel: 1, cargos: [cargo.id] });
});

test('o ranking traz nível e progresso, do maior para o menor, e a posição de quem pergunta', async () => {
  const r = (await dona('GET', `/api/communities/${comunidade.id}/niveis`)).json();
  assert.deepEqual(
    r.ranking.map((l: { userId: number }) => l.userId),
    [membroId, donaId],
  );
  assert.equal(r.ranking[0].nivel, 1);
  assert.equal(r.eu.posicao, 2);
  assert.equal(r.eu.nivel, 0);
});

test('quem sai da comunidade sai do ranking', async () => {
  await dona('DELETE', `/api/communities/${comunidade.id}/members/${membroId}`);
  const r = (await dona('GET', `/api/communities/${comunidade.id}/niveis`)).json();
  assert.deepEqual(
    r.ranking.map((l: { userId: number }) => l.userId),
    [donaId],
  );
  assert.equal(r.eu.posicao, 1);
});
