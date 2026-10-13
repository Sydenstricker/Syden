/**
 * O espaço de boas-vindas guarda também QUEM DÁ O RECADO (13/10/2026): um código do catálogo do site, como a arte.
 * Sem escolha, o coelho do salão.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

await criarConta(app, 'primeira-bv'); // a primeira conta administra o Syden
const dona = comToken(app, (await criarConta(app, 'dona-bv')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Turma do recado' })).json();
const rota = `/api/communities/${comunidade.id}/boas-vindas`;

test('sem escolha, quem dá o recado é o coelho do salão', async () => {
  assert.equal((await dona('PUT', rota, { titulo: 'Chegou!', texto: 'Oi', arte: 'aurora' })).statusCode, 200);
  assert.equal((await dona('GET', rota)).json().boasVindas.coelho, 'salao');
});

test('a escolha fica guardada', async () => {
  await dona('PUT', rota, { titulo: 'Chegou!', texto: 'Oi', arte: 'aurora', coelho: 'pronto-7' });
  assert.equal((await dona('GET', rota)).json().boasVindas.coelho, 'pronto-7');
});
