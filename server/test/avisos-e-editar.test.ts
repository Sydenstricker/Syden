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

test('editar guarda o histórico: a turma vê o que a mensagem dizia, quem está de fora não, e apagar leva junto', async () => {
  const m = db.createMessage(texto.id, ana.user.id, 'às 19h');
  assert.deepEqual((await deBia('GET', `/api/messages/${m.id}/versoes`)).json().versoes, []);
  await deAna('PATCH', `/api/messages/${m.id}`, { content: 'às 20h' });
  await deAna('PATCH', `/api/messages/${m.id}`, { content: 'às 21h' });
  const { versoes } = (await deBia('GET', `/api/messages/${m.id}/versoes`)).json() as { versoes: { conteudo: string; desde: string; ate: string }[] };
  assert.deepEqual(versoes.map((v) => v.conteudo), ['às 19h', 'às 20h']);
  assert.equal(versoes[0].ate, versoes[1].desde);
  assert.equal(db.findMessageContent(m.id), 'às 21h');
  const fora = await criarConta(app, 'fora-hist');
  assert.equal((await comToken(app, fora.token)('GET', `/api/messages/${m.id}/versoes`)).statusCode, 404);
  assert.deepEqual(db.versoesDaPessoa(ana.user.id).filter((v) => v.mensagem === m.id).map((v) => v.texto), ['às 19h', 'às 20h']);
  db.deleteMessage(m.id);
  assert.equal(db.versoesDaPessoa(ana.user.id).filter((v) => v.mensagem === m.id).length, 0);
});

test('a cortiça do quarto: os avisos das comunidades da pessoa, sem os tópicos e sem os canais comuns', async () => {
  const outro = (await deDona('POST', `/api/communities/${comunidade.id}/channels`, { name: 'recados', type: 'text' })).json() as { id: number };
  await deDona('PUT', `/api/channels/${outro.id}/avisos`, { ligado: true });
  const aviso = db.createMessage(outro.id, dona.user.id, 'reunião sábado');
  db.createMessage(texto.id, dona.user.id, 'conversa comum');
  const { avisos } = (await deBia('GET', '/api/me/avisos')).json() as { avisos: { id: number; content: string; comunidade: string; canal: string; communityId: number }[] };
  const dele = avisos.find((a) => a.id === aviso.id);
  assert.ok(dele);
  assert.equal(dele.comunidade, 'Turma dos avisos');
  assert.equal(dele.canal, 'recados');
  assert.equal(dele.communityId, comunidade.id);
  assert.ok(!avisos.some((a) => a.content === 'conversa comum'));
  const fora = await criarConta(app, 'fora-cortica');
  assert.deepEqual((await comToken(app, fora.token)('GET', '/api/me/avisos')).json().avisos, []);
});
