/**
 * BANIR DA COMUNIDADE E FIXAR MENSAGENS (23/11/2026; banidos-routes.ts e fixadas-routes.ts). Confere quem pode, que o
 * banido não volta por convite (nem pelo link de aula), que desbanir libera, e as regras de fixar: só quem administra na
 * comunidade, os dois na conversa privada, nada de tópico, o teto de 50, e que apagar a mensagem a tira das fixadas.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
// Só depois do servidor de teste: importar antes abriria o banco de desenvolvimento (ver ajuda.ts).
const db = await import('../src/db.js');

await criarConta(app, 'primeira-ban');
const dona = await criarConta(app, 'dona-ban');
const adm = await criarConta(app, 'adm-ban');
const ana = await criarConta(app, 'ana-ban');
const bia = await criarConta(app, 'bia-ban');
const deDona = comToken(app, dona.token);
const deAdm = comToken(app, adm.token);
const deAna = comToken(app, ana.token);
const deBia = comToken(app, bia.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Turma do ban' })).json();
for (const quem of [deAdm, deAna, deBia]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
await deDona('PUT', `/api/communities/${comunidade.id}/members/${adm.user.id}`, { role: 'admin' });
const canais = (await deDona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const texto = canais.find((c) => c.type === 'text')!;

test('membro comum não bane ninguém', async () => {
  const r = await deAna('POST', `/api/communities/${comunidade.id}/members/${bia.user.id}/banir`);
  assert.equal(r.statusCode, 403);
});

test('administrador não bane outro administrador nem a dona', async () => {
  await deDona('PUT', `/api/communities/${comunidade.id}/members/${ana.user.id}`, { role: 'admin' });
  assert.equal((await deAdm('POST', `/api/communities/${comunidade.id}/members/${ana.user.id}/banir`)).statusCode, 403);
  assert.equal((await deAdm('POST', `/api/communities/${comunidade.id}/members/${dona.user.id}/banir`)).statusCode, 403);
  await deDona('PUT', `/api/communities/${comunidade.id}/members/${ana.user.id}`, { role: 'member' });
});

test('banida, a pessoa sai e não volta pelo convite; desbanida, volta', async () => {
  const r = await deAdm('POST', `/api/communities/${comunidade.id}/members/${bia.user.id}/banir`);
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(db.memberRole(comunidade.id, bia.user.id), undefined);
  const volta = await deBia('POST', '/api/communities/join', { code: comunidade.inviteCode });
  assert.equal(volta.statusCode, 403);
  assert.match(volta.json().error, /baniu a sua conta/);
  // a lista, só para quem administra
  assert.equal((await deAna('GET', `/api/communities/${comunidade.id}/banidos`)).statusCode, 403);
  const lista = (await deDona('GET', `/api/communities/${comunidade.id}/banidos`)).json() as { id: number; por: string }[];
  assert.deepEqual(lista.map((b) => b.id), [bia.user.id]);
  assert.equal(lista[0].por, 'adm-ban');
  // desbanir libera a volta, mas não põe a pessoa de volta sozinha
  assert.equal((await deAna('DELETE', `/api/communities/${comunidade.id}/banidos/${bia.user.id}`)).statusCode, 403);
  assert.equal((await deDona('DELETE', `/api/communities/${comunidade.id}/banidos/${bia.user.id}`)).statusCode, 200);
  assert.equal(db.memberRole(comunidade.id, bia.user.id), undefined);
  assert.equal((await deBia('POST', '/api/communities/join', { code: comunidade.inviteCode })).statusCode, 200);
});

test('fixar: membro comum não fixa; quem administra fixa e desafixa, e todos veem a lista', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'o IP do servidor é 10.0.0.1');
  assert.equal((await deAna('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 403);
  assert.equal((await deAdm('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 200);
  const lista = (await deBia('GET', `/api/channels/${texto.id}/fixadas`)).json() as { id: number; fixadaEm: string | null }[];
  assert.deepEqual(lista.map((x) => x.id), [m.id]);
  assert.ok(lista[0].fixadaEm);
  // a mensagem, lida pelo canal, diz que está fixada
  const doCanal = (await deBia('GET', `/api/channels/${texto.id}/messages`)).json() as { id: number; fixadaEm: string | null }[];
  assert.ok(doCanal.find((x) => x.id === m.id)?.fixadaEm);
  assert.equal((await deAdm('POST', `/api/messages/${m.id}/fixar`, { fixar: false })).statusCode, 200);
  assert.equal(((await deBia('GET', `/api/channels/${texto.id}/fixadas`)).json() as unknown[]).length, 0);
});

test('fixar: apagar a mensagem a tira das fixadas', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'regras');
  await deAdm('POST', `/api/messages/${m.id}/fixar`, { fixar: true });
  assert.equal((await deAna('DELETE', `/api/messages/${m.id}`)).statusCode, 200);
  assert.equal(((await deBia('GET', `/api/channels/${texto.id}/fixadas`)).json() as unknown[]).length, 0);
});

test('fixar: o teto de 50 por canal', async () => {
  for (let i = 0; i < 50; i++) {
    const m = db.createMessage(texto.id, ana.user.id, `fixada ${i}`);
    assert.equal((await deAdm('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 200);
  }
  const demais = db.createMessage(texto.id, ana.user.id, 'a 51ª');
  const r = await deAdm('POST', `/api/messages/${demais.id}/fixar`, { fixar: true });
  assert.equal(r.statusCode, 409);
});

test('fixar: quem não participa nem acha a mensagem', async () => {
  const fora = await criarConta(app, 'fora-ban');
  const m = db.createMessage(texto.id, ana.user.id, 'só da turma');
  assert.equal((await comToken(app, fora.token)('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 404);
  assert.equal((await comToken(app, fora.token)('GET', `/api/channels/${texto.id}/fixadas`)).statusCode, 404);
});

test('fixar na conversa privada: os dois lados fixam, e quem está de fora não', async () => {
  // A conversa privada pede amizade ou comunidade em comum: as duas estão na Turma do ban.
  const conversa = (await deAna('POST', '/api/direct', { userIds: [adm.user.id] })).json() as { id: number };
  assert.ok(conversa.id, JSON.stringify(conversa));
  const m = db.createMessage(conversa.id, ana.user.id, 'o endereço da festa');
  assert.equal((await deAdm('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 200);
  assert.equal(((await deAna('GET', `/api/channels/${conversa.id}/fixadas`)).json() as unknown[]).length, 1);
  assert.equal((await deAna('POST', `/api/messages/${m.id}/fixar`, { fixar: false })).statusCode, 200);
  assert.equal((await deBia('POST', `/api/messages/${m.id}/fixar`, { fixar: true })).statusCode, 404);
});
