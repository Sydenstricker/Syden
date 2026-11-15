/**
 * O bolão da comunidade (bolao-routes.ts):
 *   1. Qualquer membro cria um bolão; quem não participa recebe 404.
 *   2. Só quem criou e quem administra cadastram jogos, lançam o placar e apagam.
 *   3. O palpite fecha na hora do jogo, e o dos outros só aparece depois dela.
 *   4. A pontuação: exato 10, vencedor com o saldo 5, só o vencedor 3; e a classificação.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/db.js');
const { DatabaseSync } = await import('node:sqlite');
const banco = new DatabaseSync(process.env.DATABASE_PATH!);
const { pontosDoPalpite } = await import('../src/bolao-routes.js');

const dona = comToken(app, (await criarConta(app, 'dona-bolao')).token);
const ana = comToken(app, (await criarConta(app, 'ana-bolao')).token);
const bia = comToken(app, (await criarConta(app, 'bia-bolao')).token);
const fora = comToken(app, (await criarConta(app, 'fora-bolao')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do bolão' })).json();
await ana('POST', '/api/communities/join', { code: comunidade.inviteCode });
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
const base = `/api/communities/${comunidade.id}/boloes`;
const daqui = (minutos: number) => new Date(Date.now() + minutos * 60000).toISOString();

/** Leva a hora de um jogo para o passado, como se ele tivesse começado (a rota não aceita jogo de mais de 1 h atrás). */
const comecar = (jogoId: number) => banco.prepare('UPDATE bolao_jogos SET quando = ? WHERE id = ?').run(daqui(-5), jogoId);

test('a pontuação clássica', () => {
  const p = (c: number, f: number) => ({ golsCasa: c, golsFora: f });
  assert.equal(pontosDoPalpite(p(2, 1), p(2, 1)), 10);
  assert.equal(pontosDoPalpite(p(3, 2), p(2, 1)), 5);
  assert.equal(pontosDoPalpite(p(1, 1), p(0, 0)), 5);
  assert.equal(pontosDoPalpite(p(3, 0), p(2, 1)), 3);
  assert.equal(pontosDoPalpite(p(1, 2), p(2, 1)), 0);
  assert.equal(pontosDoPalpite(p(1, 1), p(2, 1)), 0);
});

test('membro cria; quem não participa não vê', async () => {
  const r = await ana('POST', base, { titulo: '  Copa   da turma ' });
  assert.equal(r.statusCode, 201);
  assert.equal(r.json().titulo, 'Copa da turma');
  assert.deepEqual((await bia('GET', base)).json().boloes.map((b: { titulo: string }) => b.titulo), ['Copa da turma']);
  assert.equal((await fora('GET', base)).statusCode, 404);
  assert.equal((await fora('POST', base, { titulo: 'x' })).statusCode, 404);
  assert.equal((await ana('POST', base, { titulo: '​' })).statusCode, 400);
});

test('jogos, palpites escondidos até a hora, placar e classificação', async () => {
  const bolao = (await ana('GET', base)).json().boloes[0];
  const b = `${base}/${bolao.id}`;
  // só quem criou (Ana) e quem administra (a dona) cadastram
  assert.equal((await bia('POST', `${b}/jogos`, { casa: 'Brasil', fora: 'Argentina', quando: daqui(60) })).statusCode, 403);
  const j1 = (await ana('POST', `${b}/jogos`, { casa: 'Brasil', fora: 'Argentina', quando: daqui(60) })).json();
  const j2 = (await dona('POST', `${b}/jogos`, { casa: 'Flamengo', fora: 'Palmeiras', quando: daqui(120) })).json();
  assert.equal((await ana('POST', `${b}/jogos`, { casa: 'A', fora: 'B', quando: daqui(-120) })).statusCode, 400);

  assert.equal((await bia('PUT', `${b}/jogos/${j1.id}/palpite`, { golsCasa: 2, golsFora: 1 })).statusCode, 200);
  assert.equal((await ana('PUT', `${b}/jogos/${j1.id}/palpite`, { golsCasa: 1, golsFora: 0 })).statusCode, 200);
  assert.equal((await ana('PUT', `${b}/jogos/${j2.id}/palpite`, { golsCasa: 1, golsFora: 1 })).statusCode, 200);
  assert.equal((await bia('PUT', `${b}/jogos/${j2.id}/palpite`, { golsCasa: -1, golsFora: 1 })).statusCode, 400);
  assert.equal((await fora('PUT', `${b}/jogos/${j1.id}/palpite`, { golsCasa: 1, golsFora: 1 })).statusCode, 404);

  // antes da hora: cada um vê o seu, e dos outros só quantos palpitaram
  let visto = (await bia('GET', b)).json();
  assert.equal(visto.podeEditar, false);
  assert.equal(visto.jogos[0].palpites, null);
  assert.equal(visto.jogos[0].quantosPalpitaram, 2);
  assert.deepEqual(visto.jogos[0].meu, { golsCasa: 2, golsFora: 1, pontos: null });
  // e o placar não sai antes do jogo
  assert.equal((await ana('PUT', `${b}/jogos/${j1.id}/resultado`, { golsCasa: 2, golsFora: 1 })).statusCode, 409);

  // começou: o palpite fecha e os dos outros aparecem
  comecar(j1.id);
  assert.equal((await bia('PUT', `${b}/jogos/${j1.id}/palpite`, { golsCasa: 3, golsFora: 0 })).statusCode, 409);
  visto = (await bia('GET', b)).json();
  assert.equal(visto.jogos[0].palpites.length, 2);

  assert.equal((await bia('PUT', `${b}/jogos/${j1.id}/resultado`, { golsCasa: 2, golsFora: 1 })).statusCode, 403);
  assert.equal((await ana('PUT', `${b}/jogos/${j1.id}/resultado`, { golsCasa: 2, golsFora: 1 })).statusCode, 200);
  visto = (await bia('GET', b)).json();
  assert.deepEqual(
    visto.ranking.map((r: { nome: string; pontos: number; exatos: number }) => [r.pontos, r.exatos]),
    [
      [10, 1],
      [5, 0], // 1×0 contra 2×1: o vencedor e o saldo
    ],
  );
  assert.equal(visto.jogos[0].meu.pontos, 10);

  // placar corrigido para "sem resultado": a classificação esvazia
  assert.equal((await dona('PUT', `${b}/jogos/${j1.id}/resultado`, { golsCasa: null, golsFora: null })).statusCode, 200);
  assert.deepEqual((await bia('GET', b)).json().ranking, []);

  // os palpites vão no "Levar seus dados"
  assert.equal(db.palpitesDe(visto.ranking[0].userId).length >= 1, true);

  // apagar: só quem cuida
  assert.equal((await bia('DELETE', `${b}/jogos/${j2.id}`)).statusCode, 403);
  assert.equal((await dona('DELETE', `${b}/jogos/${j2.id}`)).statusCode, 200);
  assert.equal((await bia('DELETE', b)).statusCode, 403);
  assert.equal((await ana('DELETE', b)).statusCode, 200);
  assert.equal((await ana('GET', b)).statusCode, 404);
});
