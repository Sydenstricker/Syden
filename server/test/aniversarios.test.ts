import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import type { Server as IOServer } from 'socket.io';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS ANIVERSÁRIOS (ver aniversarios-routes.ts e anunciarAniversarios em agendador.ts).
const { app, fechar } = await servidorDeTeste();
after(fechar);

const { anunciarAniversarios } = await import('../src/agendador.js');

const publicadas: string[] = [];
const io = { to: () => ({ emit: (evento: string, dados: { content: string }) => evento === 'message:new' && publicadas.push(dados.content) }) } as unknown as IOServer;

const dona = comToken(app, (await criarConta(app, 'dona-niver')).token);
const membro = comToken(app, (await criarConta(app, 'membro-niver')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos parabéns' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const geral = ((await dona('GET', `/api/communities/${comunidade.id}/channels`)).json() as { id: number; type: string }[]).find((c) => c.type === 'text')!;

test('a pessoa informa dia e mês, sem ano; data impossível é recusada; e dá para apagar', async () => {
  assert.equal((await membro('PUT', '/api/me/aniversario', { dia: 31, mes: 4 })).statusCode, 400, '31 de abril não existe');
  assert.equal((await membro('PUT', '/api/me/aniversario', { dia: 1, mes: 13 })).statusCode, 400);
  assert.deepEqual((await membro('PUT', '/api/me/aniversario', { dia: 29, mes: 2 })).json(), { mes: 2, dia: 29 }, '29 de fevereiro existe');
  assert.deepEqual((await membro('PUT', '/api/me/aniversario', { dia: null, mes: null })).json(), { mes: null, dia: null });
  assert.deepEqual((await membro('PUT', '/api/me/aniversario', { dia: 7, mes: 10 })).json(), { mes: 10, dia: 7 });
  assert.deepEqual((await membro('GET', '/api/me/aniversario')).json(), { mes: 10, dia: 7, parabensVistoEm: null });
});

test('os parabéns da comunidade: só quem administra, canal de texto, e o texto precisa de {pessoa}', async () => {
  const url = `/api/communities/${comunidade.id}/aniversarios`;
  assert.equal((await membro('PUT', url, { canalId: geral.id, texto: 'Parabéns, {pessoa}!' })).statusCode, 403);
  assert.equal((await dona('PUT', url, { canalId: geral.id, texto: 'Parabéns!' })).statusCode, 400, 'sem {pessoa} não');
  const r = await dona('PUT', url, { canalId: geral.id, texto: 'Hoje é aniversário de {pessoa}! 🎉' });
  assert.equal(r.statusCode, 200, r.body);
});

test('no dia, depois do meio-dia UTC, o Syden anuncia — uma vez só no ano', () => {
  publicadas.length = 0;
  anunciarAniversarios(io, Date.parse('2026-10-07T09:00:00Z'));
  assert.deepEqual(publicadas, [], 'antes do meio-dia UTC, ainda não');
  anunciarAniversarios(io, Date.parse('2026-10-07T13:00:00Z'));
  assert.deepEqual(publicadas, ['Hoje é aniversário de membro-niver! 🎉']);
  anunciarAniversarios(io, Date.parse('2026-10-07T18:00:00Z'));
  assert.equal(publicadas.length, 1, 'não repete no mesmo dia');
  anunciarAniversarios(io, Date.parse('2026-10-08T13:00:00Z'));
  assert.equal(publicadas.length, 1, 'nem no dia seguinte');
  anunciarAniversarios(io, Date.parse('2027-10-07T13:00:00Z'));
  assert.equal(publicadas.length, 2, 'no ano que vem, de novo');
});

test('comunidade que desligou não anuncia', async () => {
  await dona('PUT', `/api/communities/${comunidade.id}/aniversarios`, { canalId: null });
  publicadas.length = 0;
  anunciarAniversarios(io, Date.parse('2028-10-07T13:00:00Z'));
  assert.deepEqual(publicadas, []);
});

// A FESTA DE ANIVERSÁRIO DO SYDEN (18/10/2026): o ano em que a pessoa já viu fica no servidor, para não repetir em outro aparelho.
test('a festa vista neste ano fica guardada, e um ano absurdo é recusado', async () => {
  const pessoa = comToken(app, (await criarConta(app, 'festa-aniversario')).token);
  await pessoa('PUT', '/api/me/aniversario', { dia: 5, mes: 6 });
  assert.equal((await pessoa('GET', '/api/me/aniversario')).json().parabensVistoEm, null);
  const ano = new Date().getUTCFullYear();
  assert.equal((await pessoa('POST', '/api/me/aniversario/parabens-visto', { ano })).statusCode, 200);
  assert.equal((await pessoa('GET', '/api/me/aniversario')).json().parabensVistoEm, ano);
  assert.equal((await pessoa('POST', '/api/me/aniversario/parabens-visto', { ano: 1990 })).statusCode, 400);
});
