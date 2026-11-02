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
