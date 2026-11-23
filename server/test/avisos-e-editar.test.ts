/**
 * O CANAL DE AVISOS E O EDITAR MENSAGEM (23/11/2026; o porquê no fim de db.ts). Confere que só quem administra liga o
 * canal de avisos e escreve nele (o tópico continua aberto à turma), e as regras de editar: só quem escreveu, só o texto,
 * a hora da edição, e as palavras proibidas valendo também na edição.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
// Só depois do servidor de teste: importar antes abriria o banco de desenvolvimento (ver ajuda.ts).
const db = await import('../src/db.js');
const { soQuemAdministra } = await import('../src/automod.js');

await criarConta(app, 'primeira-av');
const dona = await criarConta(app, 'dona-av');
const ana = await criarConta(app, 'ana-av');
const bia = await criarConta(app, 'bia-av');
const deDona = comToken(app, dona.token);
const deAna = comToken(app, ana.token);
const deBia = comToken(app, bia.token);

const comunidade = (await deDona('POST', '/api/communities', { name: 'Turma dos avisos' })).json();
for (const quem of [deAna, deBia]) await quem('POST', '/api/communities/join', { code: comunidade.inviteCode });
const canais = (await deDona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[];
const texto = canais.find((c) => c.type === 'text')!;
const enquete = { question: 'Quando?', options: ['sábado', 'domingo'] };

test('canal de avisos: só quem administra liga, e só canal de texto', async () => {
  assert.equal((await deAna('PUT', `/api/channels/${texto.id}/avisos`, { ligado: true })).statusCode, 403);
  const voz = canais.find((c) => c.type === 'voice');
  if (voz) assert.equal((await deDona('PUT', `/api/channels/${voz.id}/avisos`, { ligado: true })).statusCode, 400);
  const r = await deDona('PUT', `/api/channels/${texto.id}/avisos`, { ligado: true });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().avisos, 1);
});

test('canal de avisos: a turma não escreve no canal, mas escreve no tópico', async () => {
  const barrada = await deAna('POST', `/api/channels/${texto.id}/polls`, enquete);
  assert.equal(barrada.statusCode, 403);
  assert.match(barrada.json().error, /canal de avisos/);
  assert.equal((await deDona('POST', `/api/channels/${texto.id}/polls`, enquete)).statusCode, 200);

  const aviso = db.createMessage(texto.id, dona.user.id, 'A reunião mudou para sábado.');
  const topico = await deAna('POST', `/api/messages/${aviso.id}/thread`, { title: 'Dúvidas' });
  assert.equal(topico.statusCode, 200, topico.body);
  const noTopico = await deAna('POST', `/api/channels/${texto.id}/polls`, { ...enquete, threadId: topico.json().id });
  assert.equal(noTopico.statusCode, 200, noTopico.body);

  // o caminho do socket usa a mesma regra
  const canal = db.findChannel(texto.id)!;
  assert.ok(soQuemAdministra(canal, ana.user.id, null));
  assert.equal(soQuemAdministra(canal, ana.user.id, topico.json().id), null);
  assert.equal(soQuemAdministra(canal, dona.user.id, null), null);

  await deDona('PUT', `/api/channels/${texto.id}/avisos`, { ligado: false });
  assert.equal((await deAna('POST', `/api/channels/${texto.id}/polls`, enquete)).statusCode, 200);
});

test('editar: só quem escreveu, e a mensagem diz que foi editada', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'encontro às 19h');
  assert.equal((await deBia('PATCH', `/api/messages/${m.id}`, { content: 'oi' })).statusCode, 403);
  // nem quem administra edita o texto dos outros (apaga, se precisar)
  assert.equal((await deDona('PATCH', `/api/messages/${m.id}`, { content: 'oi' })).statusCode, 403);
  const r = await deAna('PATCH', `/api/messages/${m.id}`, { content: 'encontro às 20h' });
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(r.json().editadaEm);
  const lidas = (await deBia('GET', `/api/channels/${texto.id}/messages`)).json() as { id: number; content: string; editadaEm: string | null }[];
  const lida = lidas.find((x) => x.id === m.id)!;
  assert.equal(lida.content, 'encontro às 20h');
  assert.ok(lida.editadaEm);
  // a mensagem que nunca foi editada não diz nada
  const outra = db.createMessage(texto.id, ana.user.id, 'oi');
  const lidas2 = (await deBia('GET', `/api/channels/${texto.id}/messages`)).json() as { id: number; editadaEm: string | null }[];
  assert.equal(lidas2.find((x) => x.id === outra.id)!.editadaEm, null);
});

test('editar: sem texto vazio, sem passar de 2000, e enquete não se edita', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'algo');
  assert.equal((await deAna('PATCH', `/api/messages/${m.id}`, { content: '   ' })).statusCode, 400);
  assert.equal((await deAna('PATCH', `/api/messages/${m.id}`, { content: 'x'.repeat(2001) })).statusCode, 400);
  const comEnquete = (await deAna('POST', `/api/channels/${texto.id}/polls`, enquete)).json() as { id: number };
  assert.equal((await deAna('PATCH', `/api/messages/${comEnquete.id}`, { content: 'mudei' })).statusCode, 400);
});

test('editar: a palavra proibida vale também na edição', async () => {
  await deDona('PUT', `/api/communities/${comunidade.id}/moderacao`, { palavras: ['abacaxi'], links: false, flood: false });
  const m = db.createMessage(texto.id, ana.user.id, 'fruta');
  const r = await deAna('PATCH', `/api/messages/${m.id}`, { content: 'um abacaxi' });
  assert.equal(r.statusCode, 400);
  assert.equal(db.findMessageContent(m.id), 'fruta');
});

test('editar: quem está de fora nem acha a mensagem', async () => {
  const fora = await criarConta(app, 'fora-av');
  const m = db.createMessage(texto.id, ana.user.id, 'só da turma');
  assert.equal((await comToken(app, fora.token)('PATCH', `/api/messages/${m.id}`, { content: 'x' })).statusCode, 404);
});
