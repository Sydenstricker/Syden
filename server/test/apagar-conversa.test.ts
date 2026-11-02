import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// "APAGAR CONVERSA", SÓ PARA QUEM APAGA (ver apagarConversaParaMim, em db.ts). O que não pode quebrar: o outro lado
// continua com tudo (é a prova de quem precisa denunciar), e mensagem nova traz a conversa de volta só com o novo.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');

const aAna = await criarConta(app, 'ana-apaga');
const oZeca = await criarConta(app, 'zeca-apaga');
const ana = comToken(app, aAna.token);
const zeca = comToken(app, oZeca.token);
const conversa = (await ana('POST', '/api/direct', { userIds: [oZeca.user.id] })).json() as { id: number };
const textos = async (quem: typeof ana) =>
  ((await quem('GET', `/api/channels/${conversa.id}/messages`)).json() as { content: string }[]).map((m) => m.content);
const naLista = async (quem: typeof ana) =>
  ((await quem('GET', '/api/direct')).json() as { id: number; lastMessage: string | null }[]).find((c) => c.id === conversa.id);

db.createMessage(conversa.id, aAna.user.id, 'oi');
db.createMessage(conversa.id, oZeca.user.id, 'tudo bem?');

test('apagar tira a conversa da lista e as mensagens SÓ de quem apagou', async () => {
  assert.equal((await ana('POST', `/api/direct/${conversa.id}/apagar`)).statusCode, 200);
  assert.equal(await naLista(ana), undefined, 'continua na lista de quem apagou');
  assert.deepEqual(await textos(ana), []);

  assert.ok(await naLista(zeca), 'sumiu da lista do outro lado');
  assert.deepEqual(await textos(zeca), ['oi', 'tudo bem?'], 'o outro lado perdeu mensagens');
  assert.ok(db.listMessages(conversa.id, undefined, oZeca.user.id).length === 2, 'apagou do banco');
});

test('mensagem nova traz a conversa de volta, só com o que veio depois', async () => {
  db.createMessage(conversa.id, oZeca.user.id, 'sumiu?');
  assert.equal((await naLista(ana))?.lastMessage, 'sumiu?');
  assert.deepEqual(await textos(ana), ['sumiu?']);
  assert.deepEqual(await textos(zeca), ['oi', 'tudo bem?', 'sumiu?']);
});

test('abrir a conversa de novo mostra ela vazia, sem a prévia do que foi apagado', async () => {
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  assert.equal(await naLista(ana), undefined);
  const reaberta = (await ana('POST', '/api/direct', { userIds: [oZeca.user.id] })).json() as { id: number; lastMessage: string | null };
  assert.equal(reaberta.id, conversa.id, 'abriu outra conversa em vez da mesma');
  assert.equal(reaberta.lastMessage, null);
  assert.deepEqual(await textos(ana), []);
});

test('não dá para apagar conversa de que não se faz parte', async () => {
  const intrusa = comToken(app, (await criarConta(app, 'intrusa-apaga')).token);
  assert.equal((await intrusa('POST', `/api/direct/${conversa.id}/apagar`)).statusCode, 404);
  assert.deepEqual(await textos(zeca), ['oi', 'tudo bem?', 'sumiu?']);
});

// Achados da revisão independente de 02/11/2026.

test('a conversa apagada continua entre as salas do socket de quem apagou (senão a mensagem nova não a traria de volta)', async () => {
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  assert.equal(await naLista(ana), undefined);
  assert.ok(db.idsDasConversas(aAna.user.id).includes(conversa.id));
});

test('quem apagou não age pelo número sobre o que apagou: reação, tópico e lembrete', async () => {
  const antiga = db.createMessage(conversa.id, oZeca.user.id, 'segredo velho');
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  assert.equal((await ana('POST', `/api/messages/${antiga.id}/reactions`, { emoji: '👍' })).statusCode, 404);
  assert.equal((await ana('POST', `/api/messages/${antiga.id}/thread`, { title: 'oi' })).statusCode, 404);
  assert.equal((await ana('POST', '/api/lembretes', { messageId: antiga.id, minutos: 20 })).statusCode, 404);
  // O outro lado continua podendo.
  assert.equal((await zeca('POST', `/api/messages/${antiga.id}/reactions`, { emoji: '👍' })).statusCode, 200);
});

test('o lembrete pedido ANTES de apagar não traz o texto de volta depois', async () => {
  const antiga = db.createMessage(conversa.id, oZeca.user.id, 'lembra de mim');
  assert.equal((await ana('POST', '/api/lembretes', { messageId: antiga.id, minutos: 20 })).statusCode, 200);
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  const daqui = new Date(Date.now() + 60 * 60_000).toISOString();
  assert.deepEqual(db.lembretesVencidos(daqui, aAna.user.id), []);
});

test('número de mensagem reaproveitado não esconde a mensagem nova de quem apagou', async () => {
  // A última mensagem do banco some (o autor apagou), e a próxima nasce com o MESMO número (sem AUTOINCREMENT).
  const ultima = db.createMessage(conversa.id, oZeca.user.id, 'vou apagar já');
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  db.deleteMessage(ultima.id);
  await new Promise((r) => setTimeout(r, 5));
  const nova = db.createMessage(conversa.id, oZeca.user.id, 'oi de novo');
  assert.equal(nova.id, ultima.id, 'o banco não reaproveitou o número; o teste perdeu o sentido');
  assert.equal((await naLista(ana))?.lastMessage, 'oi de novo');
  assert.deepEqual(await textos(ana), ['oi de novo']);
});
