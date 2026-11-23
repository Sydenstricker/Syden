/**
 * "PODE MODERAR A CONVERSA" (23/11/2026; a SEGUNDA EXCEÇÃO em db.ts): o cargo com o interruptor apaga a mensagem dos outros,
 * fixa e desafixa, encerra a enquete e apaga o tópico dos outros — na comunidade dele, e em nada mais. Banir, tirar alguém,
 * mexer nos cargos e nas configurações continua só de quem administra. Desligar o interruptor, ou tirar o cargo, tira o poder.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
// Só depois do servidor de teste: importar antes abriria o banco de desenvolvimento (ver ajuda.ts).
const db = await import('../src/db.js');

await criarConta(app, 'primeira-mod');
const dona = await criarConta(app, 'dona-mod');
const mod = await criarConta(app, 'mod-mod');
const ana = await criarConta(app, 'ana-mod');
const bia = await criarConta(app, 'bia-mod');
const deDona = comToken(app, dona.token);
const deMod = comToken(app, mod.token);
const deAna = comToken(app, ana.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Turma da moderação' })).json();
for (const quem of [deMod, deAna, comToken(app, bia.token)]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await deDona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const texto = canais.find((c) => c.type === 'text')!;

const cargo = (await deDona('POST', `/api/communities/${comunidade.id}/cargos`, { nome: 'Ajudante', cor: '#3366aa' })).json() as {
  id: number;
  modera: boolean;
};
await deDona('PUT', `/api/communities/${comunidade.id}/members/${mod.user.id}/cargos/${cargo.id}`);

test('o cargo nasce sem o interruptor, e o cargo sozinho não modera', async () => {
  assert.equal(cargo.modera, false);
  assert.equal(db.podeModerar(comunidade.id, mod.user.id), false);
  const m = db.createMessage(texto.id, ana.user.id, 'oi');
  assert.equal((await deMod('DELETE', `/api/messages/${m.id}`)).statusCode, 403);
  assert.equal((await deMod('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 403);
});

test('só quem administra liga o interruptor', async () => {
  const r = await deAna('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { modera: true });
  assert.equal(r.statusCode, 403);
  const ok = await deDona('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { modera: true });
  assert.equal(ok.statusCode, 200, ok.body);
  assert.equal(ok.json().modera, true);
  // a lista de cargos que todo membro lê traz o interruptor (é por ela que a tela sabe)
  const lista = (await deAna('GET', `/api/communities/${comunidade.id}/cargos`)).json() as { id: number; modera: boolean }[];
  assert.equal(lista.find((c) => c.id === cargo.id)?.modera, true);
  assert.equal(db.podeModerar(comunidade.id, mod.user.id), true);
  assert.equal(db.podeModerar(comunidade.id, ana.user.id), false);
});

test('com o interruptor: apaga a mensagem dos outros, fixa e desafixa', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'regras da turma');
  assert.equal((await deMod('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 200);
  assert.equal((await deMod('POST', `/api/messages/${m.id}/fixar`, { fixar: false })).statusCode, 200);
  assert.equal((await deMod('DELETE', `/api/messages/${m.id}`)).statusCode, 200);
  assert.equal(db.findMessage(m.id), undefined);
  // quem não tem o cargo continua sem poder
  const outra = db.createMessage(texto.id, mod.user.id, 'minha');
  assert.equal((await deAna('DELETE', `/api/messages/${outra.id}`)).statusCode, 403);
});

test('com o interruptor: encerra a enquete e apaga o tópico dos outros', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'qual dia?');
  const pollId = db.createPoll(m.id, 'Qual dia?', ['sábado', 'domingo'], false);
  assert.equal((await deMod('POST', `/api/polls/${pollId}/close`)).statusCode, 200);
  const outra = db.createMessage(texto.id, ana.user.id, 'vamos conversar');
  const topico = db.createThread(texto.id, outra.id, 'Conversa', ana.user.id);
  assert.equal((await deMod('DELETE', `/api/threads/${topico.id}`)).statusCode, 200);
});

test('o cargo que modera não bane, não tira ninguém, não mexe em cargos nem no papel', async () => {
  assert.equal((await deMod('POST', `/api/communities/${comunidade.id}/members/${bia.user.id}/banir`)).statusCode, 403);
  assert.equal((await deMod('DELETE', `/api/communities/${comunidade.id}/members/${bia.user.id}`)).statusCode, 403);
  assert.equal((await deMod('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { nome: 'Chefe' })).statusCode, 403);
  assert.equal((await deMod('PUT', `/api/communities/${comunidade.id}/members/${ana.user.id}/cargos/${cargo.id}`)).statusCode, 403);
  assert.equal((await deMod('PUT', `/api/communities/${comunidade.id}/members/${ana.user.id}`, { role: 'admin' })).statusCode, 403);
});

test('não vale em outra comunidade', async () => {
  const outra = (await deAna('POST', '/api/communities', { name: 'Outra turma' })).json();
  await deMod('POST', '/api/communities/join', { code: outra.inviteCode });
  const canal = ((await deAna('GET', `/api/communities/${outra.id}/channels`)).json() as { id: number; type: string }[]).find(
    (c) => c.type === 'text',
  )!;
  const m = db.createMessage(canal.id, ana.user.id, 'daqui');
  assert.equal((await deMod('DELETE', `/api/messages/${m.id}`)).statusCode, 403);
  assert.equal((await deMod('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 403);
});

test('tirar o cargo, ou desligar o interruptor, tira o poder', async () => {
  await deDona('DELETE', `/api/communities/${comunidade.id}/members/${mod.user.id}/cargos/${cargo.id}`);
  assert.equal(db.podeModerar(comunidade.id, mod.user.id), false);
  const m = db.createMessage(texto.id, ana.user.id, 'de novo');
  assert.equal((await deMod('DELETE', `/api/messages/${m.id}`)).statusCode, 403);
  await deDona('PUT', `/api/communities/${comunidade.id}/members/${mod.user.id}/cargos/${cargo.id}`);
  assert.equal(db.podeModerar(comunidade.id, mod.user.id), true);
  await deDona('PATCH', `/api/communities/${comunidade.id}/cargos/${cargo.id}`, { modera: false });
  assert.equal(db.podeModerar(comunidade.id, mod.user.id), false);
  assert.equal((await deMod('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 403);
});

test('quem administra continua podendo, sem cargo nenhum', () => {
  assert.equal(db.podeModerar(comunidade.id, dona.user.id), true);
});
