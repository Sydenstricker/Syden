/**
 * Os tickets (pacote MEE6, 12/10/2026): um pedido a quem administra vira uma conversa privada em grupo.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

await criarConta(app, 'primeira-tickets'); // a primeira conta administra o Syden: fica de fora
const contaAna = await criarConta(app, 'ana-tickets');
const contaBia = await criarConta(app, 'bia-tickets');
const contaCaio = await criarConta(app, 'caio-tickets');
const ana = comToken(app, contaAna.token);
const bia = comToken(app, contaBia.token);
const caio = comToken(app, contaCaio.token);
const comunidade = (await ana('POST', '/api/communities', { name: 'Turma dos tickets' })).json();
for (const pessoa of [bia, caio]) await pessoa('POST', '/api/communities/join', { code: comunidade.inviteCode });
const rota = `/api/communities/${comunidade.id}/tickets`;

test('desligados por padrão: ninguém abre ticket até quem administra ligar', async () => {
  assert.equal((await bia('GET', rota)).json().ligados, false);
  assert.equal((await bia('POST', rota, { assunto: 'Ajuda' })).statusCode, 403);
  assert.equal((await bia('PUT', `${rota}/ligados`, { ligados: true })).statusCode, 403, 'só quem administra liga');
  assert.equal((await ana('PUT', `${rota}/ligados`, { ligados: true })).json().ligados, true);
});

test('o ticket vira uma conversa em grupo de quem abriu com quem administra', async () => {
  assert.equal((await bia('POST', rota, { assunto: '   ' })).statusCode, 400, 'sem assunto, não');
  const r = (await bia('POST', rota, { assunto: 'Pedido de cargo' })).json();
  assert.equal(r.ticket.assunto, 'Pedido de cargo');
  assert.equal(r.conversa.name, 'Ticket: Pedido de cargo');
  const nomes = r.conversa.members.map((m: { username: string }) => m.username).sort();
  assert.deepEqual(nomes, ['ana-tickets', 'bia-tickets']);
  const daAna = (await ana('GET', '/api/direct')).json();
  assert.ok(daAna.some((c: { id: number }) => c.id === r.conversa.id), 'quem administra recebe a conversa');
  const doCaio = (await caio('GET', '/api/direct')).json();
  assert.ok(!doCaio.some((c: { id: number }) => c.id === r.conversa.id), 'os outros membros não');
});

test('cada um vê os próprios tickets; quem administra vê todos', async () => {
  assert.equal((await bia('GET', rota)).json().tickets.length, 1);
  assert.equal((await caio('GET', rota)).json().tickets.length, 0);
  assert.equal((await ana('GET', rota)).json().tickets.length, 1);
});

test('no máximo três abertos por pessoa', async () => {
  await bia('POST', rota, { assunto: 'Dois' });
  await bia('POST', rota, { assunto: 'Três' });
  assert.equal((await bia('POST', rota, { assunto: 'Quatro' })).statusCode, 409);
});

test('encerrar: quem abriu ou quem administra; a conversa fica, com o nome trocado', async () => {
  const [ticket] = (await bia('GET', rota)).json().tickets.filter((t: { assunto: string }) => t.assunto === 'Pedido de cargo');
  assert.equal((await caio('POST', `${rota}/${ticket.id}/encerrar`)).statusCode, 403);
  const fechado = (await ana('POST', `${rota}/${ticket.id}/encerrar`)).json().ticket;
  assert.ok(fechado.fechadoEm);
  assert.equal(fechado.fechadoPorNome, 'ana-tickets');
  const conversa = (await bia('GET', '/api/direct')).json().find((c: { id: number }) => c.id === ticket.channelId);
  assert.equal(conversa.name, 'Encerrado: Pedido de cargo');
  assert.equal((await bia('POST', rota, { assunto: 'Quatro, agora sim' })).statusCode, 200, 'encerrado não conta no limite');
});

test('quem administra sozinho não tem a quem abrir ticket', async () => {
  assert.equal((await ana('POST', rota, { assunto: 'Eu mesma' })).statusCode, 409);
});
