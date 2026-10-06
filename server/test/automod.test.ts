import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A MODERAÇÃO AUTOMÁTICA (ver automod.ts e automod-routes.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const db = await import('../src/db.js');
const automod = await import('../src/automod.js');

const dona = comToken(app, (await criarConta(app, 'dona-automod')).token);
const membro = comToken(app, (await criarConta(app, 'membro-automod')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã moderado' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const ids = Object.fromEntries(
  ((await dona('GET', `/api/communities/${comunidade.id}/members`)).json() as { id: number; username: string }[]).map((m) => [m.username, m.id]),
);
const geral = ((await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find((c) => c.type === 'text')!;
const canal = () => db.findChannel(geral.id)!;

test('a palavra é achada inteira, sem acento e sem diferença de maiúscula', () => {
  assert.ok(automod.contemPalavra('que PÔRRA é essa', 'porra'));
  assert.ok(automod.contemPalavra('porra!', 'Porra'));
  assert.ok(!automod.contemPalavra('cultura e música', 'cu'), '"cu" não pega "cultura"');
  assert.ok(automod.contemPalavra('vai tomar no cu', 'tomar no cu'), 'frase inteira também');
});

test('link é link, mas GIF do seletor não é', () => {
  assert.ok(automod.temLink('olha https://exemplo.com'));
  assert.ok(automod.temLink('entra em discord.gg/abcd'));
  assert.ok(automod.temLink('www.exemplo.com.br'));
  assert.ok(!automod.temLink('https://media2.giphy.com/media/abc/giphy.gif'));
  assert.ok(!automod.temLink('nada de link aqui.'));
});

test('desligada, não barra nada', () => {
  assert.equal(automod.barrarMensagem(canal(), ids['membro-automod'], 'https://exemplo.com porra', 1_000), null);
});

test('só quem administra lê e muda as regras; palavras repetidas viram uma', async () => {
  assert.equal((await membro('GET', `/api/communities/${comunidade.id}/moderacao`)).statusCode, 403);
  assert.equal((await dona('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: 'porra', links: true, flood: true })).statusCode, 400);
  const r = await dona('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: ['porra', 'Pôrra', ' ', 'tomar no cu'], links: true, flood: true });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual(r.json().palavras, ['porra', 'tomar no cu']);
});

test('ligada: palavra, link e excesso barram o membro, com o motivo', () => {
  const membroId = ids['membro-automod'];
  assert.match(automod.barrarMensagem(canal(), membroId, 'que porra', 50_000)!, /palavras/);
  assert.match(automod.barrarMensagem(canal(), membroId, 'https://exemplo.com', 50_000)!, /links/);
  assert.equal(automod.barrarMensagem(canal(), membroId, 'https://media2.giphy.com/media/abc/giphy.gif', 50_000), null, 'GIF passa');
  for (let i = 1; i < 5; i++) assert.equal(automod.barrarMensagem(canal(), membroId, `oi ${i}`, 50_000 + i), null);
  assert.match(automod.barrarMensagem(canal(), membroId, 'oi de novo', 50_010)!, /muitas mensagens/, 'a sexta em 10 s');
  assert.equal(automod.barrarMensagem(canal(), membroId, 'passou', 65_000), null, 'passada a janela, volta');
});

test('quem administra não passa pelas regras', () => {
  assert.equal(automod.barrarMensagem(canal(), ids['dona-automod'], 'porra https://regras.com', 70_000), null);
});

test('modo lento: só quem administra liga, só nos tempos da lista, e barra a segunda mensagem', async () => {
  assert.equal((await membro('PUT', `/api/channels/${geral.id}/modo-lento`, { segundos: 30 })).statusCode, 403);
  assert.equal((await dona('PUT', `/api/channels/${geral.id}/modo-lento`, { segundos: 7 })).statusCode, 400);
  const r = await dona('PUT', `/api/channels/${geral.id}/modo-lento`, { segundos: 30 });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().modoLento, 30);
  const membroId = ids['membro-automod'];
  assert.equal(automod.barrarMensagem(canal(), membroId, 'primeira', 100_000), null);
  assert.match(automod.barrarMensagem(canal(), membroId, 'segunda', 110_000)!, /modo lento: espere 20 s/);
  assert.equal(automod.barrarMensagem(canal(), membroId, 'terceira', 131_000), null);
});

test('a mensagem barrada não é gravada, e o motivo volta para quem mandou pela rota de anexo', async () => {
  const antes = (await dona('GET', `/api/channels/${geral.id}/messages`)).json().length;
  const r = await membro('POST', `/api/channels/${geral.id}/messages`, {
    content: 'que porra',
    files: [{ name: 'a.txt', data: Buffer.from('oi').toString('base64') }],
  });
  assert.equal(r.statusCode, 400);
  assert.match(r.json().error, /palavras|modo lento/);
  assert.equal((await dona('GET', `/api/channels/${geral.id}/messages`)).json().length, antes);
});
