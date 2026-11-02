import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// RESPONDER A UMA MENSAGEM (ver a tabela `respostas` e citacoes, em db.ts). O que não pode quebrar: a citação só
// aponta para uma mensagem do mesmo lugar, some quando a original some, e quem apagou a conversa não a vê de volta.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');

const aAna = await criarConta(app, 'ana-responde');
const oZeca = await criarConta(app, 'zeca-responde');
const ana = comToken(app, aAna.token);
const zeca = comToken(app, oZeca.token);
const conversa = (await ana('POST', '/api/direct', { userIds: [oZeca.user.id] })).json() as { id: number };
const outra = (await ana('POST', '/api/direct', { userIds: [oZeca.user.id], name: 'Grupo à parte' })).json() as { id: number };
type Msg = { id: number; content: string; replyTo: { id: number | null; content: string; author: { username: string } | null } | null };
const mensagens = async (quem: typeof ana, canal = conversa.id) => (await quem('GET', `/api/channels/${canal}/messages`)).json() as Msg[];
const anexo = [{ name: 'a.txt', data: `data:text/plain;base64,${Buffer.from('oi').toString('base64')}` }];

const original = db.createMessage(conversa.id, aAna.user.id, 'vamos jogar hoje?');

test('a resposta traz a original resumida, com o autor', async () => {
  assert.ok(db.podeResponderA(original.id, conversa.id, null, oZeca.user.id));
  const resposta = db.createMessage(conversa.id, oZeca.user.id, 'bora', null, original.id);
  assert.equal(resposta.replyTo?.id, original.id, 'a citação não voltou para quem escreveu');
  const lida = (await mensagens(ana)).find((m) => m.id === resposta.id)!;
  assert.equal(lida.replyTo?.content, 'vamos jogar hoje?');
  assert.equal(lida.replyTo?.author?.username, 'ana-responde');
  assert.equal((await mensagens(ana)).find((m) => m.id === original.id)!.replyTo, null, 'mensagem comum ganhou citação');
});

test('só se responde a mensagem do mesmo lugar', async () => {
  assert.equal(db.podeResponderA(original.id, outra.id, null, aAna.user.id), false, 'citou mensagem de outra conversa');
  assert.equal(db.podeResponderA(999_999, conversa.id, null, aAna.user.id), false, 'citou mensagem que não existe');
  const r = await ana('POST', `/api/channels/${outra.id}/messages`, { content: 'olha', replyTo: original.id, files: anexo });
  assert.equal(r.statusCode, 400, 'a rota de anexo aceitou citação de outra conversa');
  const certa = await ana('POST', `/api/channels/${conversa.id}/messages`, { content: 'o print', replyTo: original.id, files: anexo });
  assert.equal(certa.statusCode, 200, certa.body);
  assert.equal(certa.json().replyTo.id, original.id);
});

test('apagada a original, a resposta fica, citando "mensagem apagada"', async () => {
  const pergunta = db.createMessage(conversa.id, aAna.user.id, 'apaga isso depois');
  const resposta = db.createMessage(conversa.id, oZeca.user.id, 'ok', null, pergunta.id);
  db.deleteMessage(pergunta.id);
  const lida = (await mensagens(zeca)).find((m) => m.id === resposta.id)!;
  assert.deepEqual(lida.replyTo && { id: lida.replyTo.id, author: lida.replyTo.author, content: lida.replyTo.content }, { id: null, author: null, content: '' });
});

test('quem apagou a conversa não vê de volta o que apagou numa citação nova', async () => {
  const antiga = db.createMessage(conversa.id, oZeca.user.id, 'segredo antigo');
  await ana('POST', `/api/direct/${conversa.id}/apagar`);
  // O outro lado ainda vê a antiga e pode respondê-la; quem apagou recebe a resposta, mas sem o texto apagado.
  assert.ok(db.podeResponderA(antiga.id, conversa.id, null, oZeca.user.id));
  assert.equal(db.podeResponderA(antiga.id, conversa.id, null, aAna.user.id), false, 'quem apagou citou o que apagou');
  const resposta = db.createMessage(conversa.id, oZeca.user.id, 'lembra disso?', null, antiga.id);
  assert.equal(db.citacaoPara(resposta.id, aAna.user.id)?.id, null);
  assert.equal(db.citacaoPara(resposta.id, oZeca.user.id)?.content, 'segredo antigo');
  const daAna = (await mensagens(ana)).find((m) => m.id === resposta.id)!;
  assert.equal(daAna.replyTo?.id, null);
  assert.equal(JSON.stringify(daAna).includes('segredo antigo'), false);
});
