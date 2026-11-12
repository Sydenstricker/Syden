import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
const { PEDACO_MAXIMO } = await import('../src/medir-envio-routes.js');
after(fechar);

const ana = await criarConta(app, 'ana');
const mandar = (bytes: number, token: string | null = ana.token) =>
  app.inject({
    method: 'POST',
    url: '/api/medir-envio',
    headers: { 'content-type': 'application/octet-stream', ...(token && { authorization: `Bearer ${token}` }) },
    payload: Buffer.alloc(bytes, 7),
  });

test('o pedaço chega, é contado e jogado fora', async () => {
  const resposta = await mandar(256 * 1024);
  assert.equal(resposta.statusCode, 200);
  assert.deepEqual(resposta.json(), { bytes: 256 * 1024 });
});

test('só quem está logado mede, e o pedaço tem teto', async () => {
  assert.equal((await mandar(1024, null)).statusCode, 401);
  assert.equal((await mandar(PEDACO_MAXIMO + 1)).statusCode, 413);
});

test('o freio segura quem manda sem parar', async () => {
  const bia = await criarConta(app, 'bia');
  let recusado = false;
  for (let i = 0; i < 60 && !recusado; i++) recusado = (await mandar(1024, bia.token)).statusCode === 429;
  assert.ok(recusado, 'depois de umas duas medidas no minuto, recusa');
});
