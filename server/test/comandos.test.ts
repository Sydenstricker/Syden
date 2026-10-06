import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Server as IOServer } from 'socket.io';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A CONTA DO SYDEN e os COMANDOS PERSONALIZADOS (ver syden-app.ts e comandos-routes.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const { responderComando } = await import('../src/comandos-routes.js');

// A conta do Syden nasce ANTES de qualquer pessoa, de propósito: é o caso que roubaria o lugar de dono.
const idDoSyden = db.contaDoSyden();

const avisos: { sala: string; evento: string; dados: { content?: string; author?: { username: string; app?: boolean } } }[] = [];
const io = { to: (sala: string) => ({ emit: (evento: string, dados: never) => avisos.push({ sala, evento, dados }) }) } as unknown as IOServer;

const contaDaDona = await criarConta(app, 'dona-cmd');
const dona = comToken(app, contaDaDona.token);
const membro = comToken(app, (await criarConta(app, 'membro-cmd')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos comandos' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const geral = ((await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find((c) => c.type === 'text')!;

test('a conta do Syden não rouba o lugar de dono da primeira pessoa', () => {
  const dono = db.findUserByName('dona-cmd')!;
  assert.equal(dono.isOwner, true);
  assert.equal(db.contaDoSyden(), idDoSyden, 'a conta é uma só');
});

test('ninguém se cadastra com o nome guardado dela, nem conversa com ela', async () => {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { username: 'syden sistema', password: 'segredo123', invite: 'x' } });
  assert.notEqual(r.statusCode, 200);
  assert.equal((await membro('POST', '/api/direct', { userIds: [idDoSyden] })).statusCode, 400);
});

test('só quem administra cria comandos; o nome é normalizado e a resposta é obrigatória', async () => {
  assert.equal((await membro('PUT', `/api/communities/${comunidade.id}/comandos`, { nome: 'regras', resposta: 'x' })).statusCode, 403);
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/comandos`, { nome: 'com espaço', resposta: 'x' })).statusCode, 400);
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/comandos`, { nome: 'regras', resposta: '' })).statusCode, 400);
  const r = await dona('PUT', `/api/communities/${comunidade.id}/comandos`, { nome: '!Regras', resposta: 'Oi {pessoa}, leia as regras de {comunidade}.' });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().nome, 'regras');
  assert.deepEqual(
    (await membro('GET', `/api/communities/${comunidade.id}/comandos`)).json().map((c: { nome: string }) => c.nome),
    ['regras'],
  );
});

test('"!regras" faz o Syden responder no canal, com o selo de app e os campos preenchidos', () => {
  avisos.length = 0;
  const autor = db.findUserByName('membro-cmd')!;
  responderComando(io, db.findChannel(geral.id)!, autor, '!regras por favor', null);
  const nova = avisos.find((a) => a.evento === 'message:new');
  assert.ok(nova, 'houve resposta');
  assert.equal(nova!.dados.content, 'Oi membro-cmd, leia as regras de Clã dos comandos.');
  assert.deepEqual(nova!.dados.author, { id: idDoSyden, username: 'Syden', app: true });
});

test('repetir o comando no mesmo canal em seguida não gera outra resposta; comando inexistente não responde', () => {
  avisos.length = 0;
  const autor = db.findUserByName('membro-cmd')!;
  responderComando(io, db.findChannel(geral.id)!, autor, '!regras', null);
  responderComando(io, db.findChannel(geral.id)!, autor, '!naoexiste', null);
  responderComando(io, db.findChannel(geral.id)!, autor, 'texto com !regras no meio', null);
  assert.equal(avisos.length, 0);
});

test('a mensagem do Syden lida do banco também vem com o selo', async () => {
  const mensagens = (await dona('GET', `/api/channels/${geral.id}/messages`)).json() as { author: { username: string; app?: boolean } }[];
  assert.ok(mensagens.some((m) => m.author.app === true && m.author.username === 'Syden'));
});

test('apagar o comando: só quem administra', async () => {
  const id = (await dona('GET', `/api/communities/${comunidade.id}/comandos`)).json()[0].id;
  assert.equal((await membro('DELETE', `/api/communities/${comunidade.id}/comandos/${id}`)).statusCode, 403);
  assert.equal((await dona('DELETE', `/api/communities/${comunidade.id}/comandos/${id}`)).statusCode, 200);
  assert.deepEqual((await dona('GET', `/api/communities/${comunidade.id}/comandos`)).json(), []);
});
