import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Server as IOServer } from 'socket.io';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS SORTEIOS (ver sorteios-routes.ts e sortearVencidos em agendador.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const { sortearVencidos, sortearEntre } = await import('../src/agendador.js');

const publicadas: string[] = [];
const io = { to: () => ({ emit: (evento: string, dados: { content: string }) => evento === 'message:new' && publicadas.push(dados.content) }) } as unknown as IOServer;

const dona = comToken(app, (await criarConta(app, 'dona-sorteio')).token);
const ana = comToken(app, (await criarConta(app, 'ana-sorteio')).token);
const bia = comToken(app, (await criarConta(app, 'bia-sorteio')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do sorteio' })).json();
await ana('POST', '/api/communities/join', { code: comunidade.inviteCode });
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
const geral = ((await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find((c) => c.type === 'text')!;
const url = `/api/communities/${comunidade.id}/sorteios`;

/** O que o Syden publicou por último no #geral — as rotas publicam pelo io de verdade, não pelo falso. */
const ultima = async () => ((await dona('GET', `/api/channels/${geral.id}/messages`)).json() as { content: string }[]).at(-1)!.content;

const daquiA = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();
const novo = (extra: Record<string, unknown> = {}) => ({
  channelId: geral.id,
  premio: 'Um jogo na Steam',
  vencedores: 1,
  terminaEm: daquiA(10),
  anuncio: '🎉 Sorteio: Um jogo na Steam! Reaja com 🎉.',
  textoResultado: 'Quem ganhou {premio}: {vencedores}!',
  textoVazio: 'Ninguém participou do sorteio de {premio}.',
  ...extra,
});

test('só quem administra cria; prêmio, prazo e {vencedores} são conferidos', async () => {
  assert.equal((await ana('POST', url, novo())).statusCode, 403);
  assert.equal((await dona('POST', url, novo({ premio: '' }))).statusCode, 400);
  assert.equal((await dona('POST', url, novo({ vencedores: 0 }))).statusCode, 400);
  assert.equal((await dona('POST', url, novo({ terminaEm: daquiA(-5) }))).statusCode, 400, 'no passado não');
  assert.equal((await dona('POST', url, novo({ terminaEm: daquiA(60 * 24 * 31) }))).statusCode, 400, 'mais de 30 dias não');
  assert.equal((await dona('POST', url, novo({ textoResultado: 'Parabéns!' }))).statusCode, 400, 'sem {vencedores} não');
});

test('o anúncio sai pelo Syden, já com o 🎉 dele — que não conta como participante', async () => {
  const r = await dona('POST', url, novo());
  assert.equal(r.statusCode, 200, r.body);
  const sorteio = r.json();
  assert.equal(sorteio.participantes, 0);
  const mensagens = (await ana('GET', `/api/channels/${geral.id}/messages`)).json() as { id: number; author: { username: string }; reactions: { emoji: string; count: number }[] }[];
  const anuncio = mensagens.find((m) => m.id === sorteio.messageId)!;
  assert.equal(anuncio.author.username, 'Syden');
  assert.deepEqual(anuncio.reactions.map((x) => [x.emoji, x.count]), [['🎉', 1]]);
});

test('na hora marcada, o agendador sorteia entre quem reagiu, e uma vez só', async () => {
  const sorteio = (await dona('POST', url, novo({ vencedores: 2, premio: 'Duas camisas', terminaEm: daquiA(5) }))).json();
  await ana('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  await bia('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  publicadas.length = 0;
  sortearVencidos(io, Date.now() + 2 * 60_000);
  assert.deepEqual(publicadas, [], 'antes da hora, nada');
  sortearVencidos(io, Date.now() + 6 * 60_000);
  assert.equal(publicadas.length, 1);
  assert.match(publicadas[0], /^Quem ganhou Duas camisas: @(ana|bia)-sorteio, @(ana|bia)-sorteio!$/);
  assert.ok(publicadas[0].includes('@ana-sorteio') && publicadas[0].includes('@bia-sorteio'), 'dois prêmios, dois participantes: os dois ganham');
  sortearVencidos(io, Date.now() + 7 * 60_000);
  assert.equal(publicadas.length, 1, 'encerrado não sorteia de novo sozinho');
  const lista = (await dona('GET', url)).json() as { id: number; encerrado: boolean; ganhadores: string[] }[];
  const guardado = lista.find((s) => s.id === sorteio.id)!;
  assert.equal(guardado.encerrado, true);
  assert.deepEqual([...guardado.ganhadores].sort(), ['ana-sorteio', 'bia-sorteio']);
});

test('encerrar agora sem ninguém: publica o texto de vazio; sortear de novo sem sobrar ninguém é recusado', async () => {
  const sorteio = (await dona('POST', url, novo({ premio: 'Adesivo' }))).json();
  const r = await dona('POST', `${url}/${sorteio.id}/encerrar`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(await ultima(), 'Ninguém participou do sorteio de Adesivo.');
  assert.equal((await dona('POST', `${url}/${sorteio.id}/encerrar`)).statusCode, 409, 'não encerra duas vezes');
  assert.equal((await dona('POST', `${url}/${sorteio.id}/sortear-de-novo`)).statusCode, 409);
});

test('sortear de novo escolhe quem ainda não ganhou', async () => {
  const sorteio = (await dona('POST', url, novo({ premio: 'Caneca' }))).json();
  await ana('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  await bia('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  assert.equal((await dona('POST', `${url}/${sorteio.id}/sortear-de-novo`)).statusCode, 409, 'aberto ainda não');
  const primeiro = (await dona('POST', `${url}/${sorteio.id}/encerrar`)).json().ganhadores as string[];
  assert.equal(primeiro.length, 1);
  const depois = (await dona('POST', `${url}/${sorteio.id}/sortear-de-novo`)).json().ganhadores as string[];
  assert.deepEqual([...depois].sort(), ['ana-sorteio', 'bia-sorteio'], 'o segundo é quem faltava');
  assert.equal((await dona('POST', `${url}/${sorteio.id}/sortear-de-novo`)).statusCode, 409, 'acabaram os participantes');
});

test('quem tira a reação, ou sai da comunidade, sai do sorteio', async () => {
  const sorteio = (await dona('POST', url, novo({ premio: 'Chaveiro' }))).json();
  await ana('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  await ana('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  await bia('POST', `/api/messages/${sorteio.messageId}/reactions`, { emoji: '🎉' });
  await bia('POST', `/api/communities/${comunidade.id}/leave`);
  await dona('POST', `${url}/${sorteio.id}/encerrar`);
  assert.equal(await ultima(), 'Ninguém participou do sorteio de Chaveiro.');
});

test('sortearEntre nunca repete e não passa do que há', () => {
  const gente = [{ id: 1 }, { id: 2 }, { id: 3 }];
  for (let i = 0; i < 50; i++) {
    const escolhidos = sortearEntre(gente, 2).map((g) => g.id);
    assert.equal(new Set(escolhidos).size, 2);
  }
  assert.equal(sortearEntre(gente, 10).length, 3);
  assert.deepEqual(sortearEntre(gente, 3, [1, 2]).map((g) => g.id), [3]);
});

test('os prêmios ganhos vão na exportação da LGPD', async () => {
  const dados = (await ana('GET', '/api/me/dados')).json() as { comunidades: { nome: string; sorteiosGanhos: { premio: string }[] }[] };
  const premios = dados.comunidades.find((c) => c.nome === 'Clã do sorteio')!.sorteiosGanhos.map((s) => s.premio);
  assert.ok(premios.includes('Duas camisas'), JSON.stringify(premios));
});
