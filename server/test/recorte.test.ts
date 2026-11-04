/**
 * O MODELO DO RECORTE DE FUNDO (recorte-routes.ts): o servidor só guarda e entrega o arquivo que tem o sha256 medido. A busca
 * na origem é trocada por uma de mentira, para o teste não baixar 98 MB da internet.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);
const db = await import('../src/config.js');
// o modelo fica ao lado do banco de teste, na pasta temporária, que é a mesma em toda rodada: sai antes e depois
const guardado = join(dirname(db.config.databasePath), 'modelos', 'birefnet-lite-512-fp16.onnx');
rmSync(guardado, { force: true });
after(() => rmSync(guardado, { force: true }));

const buscaDeVerdade = globalThis.fetch;
after(() => {
  globalThis.fetch = buscaDeVerdade;
});
const fingir = (bytes: Buffer, status = 200) => {
  globalThis.fetch = (async () => new Response(bytes, { status })) as typeof fetch;
};

test('o arquivo da origem que não confere com o sha256 não é guardado nem entregue', async () => {
  fingir(Buffer.from('um modelo qualquer, que não é o medido'));
  const resposta = await app.inject({ method: 'GET', url: '/api/recorte-de-fundo/modelo' });
  assert.equal(resposta.statusCode, 503);
  // e a origem fora do ar também não derruba nada
  fingir(Buffer.from(''), 502);
  assert.equal((await app.inject({ method: 'GET', url: '/api/recorte-de-fundo/modelo' })).statusCode, 503);
});

const MODELO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'e2e', 'recorte-de-fundo', 'modelos', 'birefnet-lite-512-fp16.onnx');
test('o arquivo certo é guardado e entregue, sem conta', { skip: !existsSync(MODELO) && 'sem o modelo baixado' }, async () => {
  fingir(readFileSync(MODELO));
  const resposta = await app.inject({ method: 'GET', url: '/api/recorte-de-fundo/modelo' });
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.rawPayload.length, 98_451_949);
  // a segunda vez já vem do disco: a origem fora do ar não importa mais
  fingir(Buffer.from(''), 502);
  assert.equal((await app.inject({ method: 'GET', url: '/api/recorte-de-fundo/modelo' })).statusCode, 200);
});
