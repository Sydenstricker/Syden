import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// OS CONTADORES (ver contadores-routes.ts): o servidor guarda só a escolha; a conta é de cada tela.
const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-contador')).token);
const membro = comToken(app, (await criarConta(app, 'membro-contador')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã dos números' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const url = `/api/communities/${comunidade.id}/contadores`;

test('começa sem contador nenhum', async () => {
  const minhas = (await membro('GET', '/api/communities')).json() as { id: number; contadores: string }[];
  assert.equal(minhas.find((c) => c.id === comunidade.id)!.contadores, '');
});

test('só quem administra escolhe, e só entre os que existem', async () => {
  assert.equal((await membro('PUT', url, { lista: ['membros'] })).statusCode, 403);
  assert.equal((await dona('PUT', url, { lista: ['visitas'] })).statusCode, 400);
  assert.equal((await dona('PUT', url, { lista: 'membros' })).statusCode, 400);
});

test('a ordem é sempre a mesma e não repete', async () => {
  assert.equal((await dona('PUT', url, { lista: ['em-chamada', 'membros', 'membros'] })).json().contadores, 'membros,em-chamada');
  const minhas = (await membro('GET', '/api/communities')).json() as { id: number; contadores: string }[];
  assert.equal(minhas.find((c) => c.id === comunidade.id)!.contadores, 'membros,em-chamada');
  assert.equal((await dona('PUT', url, { lista: [] })).json().contadores, '');
});
