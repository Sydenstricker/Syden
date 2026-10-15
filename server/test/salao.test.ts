/**
 * O salão de cada comunidade (salao-routes.ts): a arrumação do salão isométrico, da turma.
 *
 *   1. Todo membro lê o salão igual; quem não é membro não descobre nem que a comunidade existe.
 *   2. Só quem administra guarda; membro comum recebe 403, e o salão não muda.
 *   3. O que entra é validado como o quarto (é desenhado na tela de todo membro).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const dona = comToken(app, (await criarConta(app, 'dona-salao')).token);
const membro = comToken(app, (await criarConta(app, 'membro-salao')).token);
const fora = comToken(app, (await criarConta(app, 'fora-salao')).token);
const comunidade = (await dona('POST', '/api/communities', { name: 'Clã do salão' })).json();
await membro('POST', '/api/communities/join', { code: comunidade.inviteCode });
const url = `/api/communities/${comunidade.id}/salao`;

const SALAO = {
  moveis: { sofa: { c: [2.5, 3], lado: 1 }, tv: { c: [0.5, 3], lado: 0 }, banqueta: { c: [6, 2], lado: 0 } },
  janela: { tipo: 'redonda', parede: 'esquerda', v: 1 },
  parede: { pintura: { parede: 'direita', v: 0, h: 0 } },
  emCima: { o1: { tipo: 'refrigerante', em: 'balcao', s: 0.3, t: 0.5, lado: 0 } },
};

test('ninguém mexeu: o salão de fábrica, e o membro sabe se pode arrumar', async () => {
  const d = (await dona('GET', url)).json(), m = (await membro('GET', url)).json();
  assert.equal(d.arrumacao, null);
  assert.equal(d.podeEditar, true);
  assert.equal(m.podeEditar, false);
});

test('quem administra guarda, e TODO MEMBRO vê igual', async () => {
  assert.equal((await dona('PUT', url, SALAO)).statusCode, 200);
  assert.deepEqual((await membro('GET', url)).json().arrumacao, SALAO);
});

test('membro comum NÃO arruma, e o salão fica como estava', async () => {
  const r = await membro('PUT', url, { moveis: {} });
  assert.equal(r.statusCode, 403);
  assert.deepEqual((await dona('GET', url)).json().arrumacao, SALAO);
});

test('quem não participa: 404 para ler e para guardar', async () => {
  assert.equal((await fora('GET', url)).statusCode, 404);
  assert.equal((await fora('PUT', url, SALAO)).statusCode, 404);
  assert.equal((await fora('GET', '/api/communities/999999/salao')).statusCode, 404);
});

test('o que quebraria o salão é recusado', async () => {
  assert.equal((await dona('PUT', url, { moveis: { sofa: { c: [99, 1], lado: 0 } } })).statusCode, 400);
  assert.deepEqual((await membro('GET', url)).json().arrumacao, SALAO);
});
