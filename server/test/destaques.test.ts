import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS DESTAQUES (ver destaques-routes.ts e o bloco em db.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');

const contaDona = await criarConta(app, 'dona-estrela');
const contaAna = await criarConta(app, 'ana-estrela');
const contaBia = await criarConta(app, 'bia-estrela');
const dona = comToken(app, contaDona.token);
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã das estrelas' })).json();
await ana('POST', '/api/communities/join', { code: comunidade.inviteCode });
await bia('POST', '/api/communities/join', { code: comunidade.inviteCode });
const geral = ((await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find((c) => c.type === 'text')!;
const mural = (await dona('POST', `/api/communities/${comunidade.id}/channels`, { name: 'destaques', type: 'text' })).json() as { id: number };
const url = `/api/communities/${comunidade.id}/destaques`;

const estrela = (quem: typeof ana, id: number) => quem('POST', `/api/messages/${id}/reactions`, { emoji: '⭐' });
const doMural = async () =>
  ((await dona('GET', `/api/channels/${mural.id}/messages`)).json() as { id: number; content: string; author: { username: string }; attachments: unknown[] }[]);

test('só quem administra configura; o mínimo vai de 1 a 50', async () => {
  assert.equal((await ana('PUT', url, { canalId: mural.id, minimo: 2 })).statusCode, 403);
  assert.equal((await dona('PUT', url, { canalId: mural.id, minimo: 0 })).statusCode, 400);
  assert.deepEqual((await dona('PUT', url, { canalId: mural.id, minimo: 2 })).json(), { canalId: mural.id, minimo: 2 });
});

test('a ⭐ do próprio autor não conta; com o mínimo, o Syden destaca uma vez só', async () => {
  const msg = db.createMessage(geral.id, contaAna.user.id, 'que jogada!', null);
  await estrela(ana, msg.id);
  await estrela(bia, msg.id);
  assert.equal((await doMural()).length, 0, 'uma ⭐ de outra pessoa (a da autora não conta) não basta');
  await estrela(dona, msg.id);
  const mural1 = await doMural();
  assert.equal(mural1.length, 1);
  assert.equal(mural1[0].author.username, 'Syden');
  assert.equal(mural1[0].content, '⭐ 2 · @ana-estrela · #geral\nque jogada!');
  // Tirar e pôr de novo não republica.
  await estrela(dona, msg.id);
  await estrela(dona, msg.id);
  assert.equal((await doMural()).length, 1);
});

test('a imagem da original vai junto, sem copiar o arquivo', async () => {
  const msg = db.createMessage(geral.id, contaBia.user.id, '', null);
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  db.addAttachment(msg.id, { name: 'print.png', mime: 'image/png', data: png, width: 1, height: 1 });
  await estrela(ana, msg.id);
  await estrela(dona, msg.id);
  const post = (await doMural()).at(-1)!;
  assert.equal(post.content, '⭐ 2 · @bia-estrela · #geral');
  assert.equal(post.attachments.length, 1);
});

test('apagar a original apaga o destaque', async () => {
  const msg = db.createMessage(geral.id, contaAna.user.id, 'isto vai sumir', null);
  await estrela(bia, msg.id);
  await estrela(dona, msg.id);
  assert.ok((await doMural()).some((m) => m.content.endsWith('isto vai sumir')));
  assert.equal((await dona('DELETE', `/api/messages/${msg.id}`)).statusCode, 200);
  assert.ok(!(await doMural()).some((m) => m.content.endsWith('isto vai sumir')), 'o destaque ficou depois de a original sair');
});

test('o canal de destaques não destaca a si mesmo, e desligado não destaca nada', async () => {
  const noMural = db.createMessage(mural.id, contaAna.user.id, 'no mural', null);
  await estrela(bia, noMural.id);
  await estrela(dona, noMural.id);
  assert.ok(!(await doMural()).some((m) => m.content.includes('@ana-estrela · #destaques')));

  await dona('PUT', url, { canalId: null, minimo: 2 });
  const antes = (await doMural()).length;
  const msg = db.createMessage(geral.id, contaAna.user.id, 'sem mural', null);
  await estrela(bia, msg.id);
  await estrela(dona, msg.id);
  assert.equal((await doMural()).length, antes);
});
