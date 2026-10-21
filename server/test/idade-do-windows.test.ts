/**
 * A idade pelo Windows (POST /api/me/idade-do-windows; ver protecao.ts, faixaDaConta):
 *   1. Só a faixa VERIFICADA é guardada; a não verificada não muda nada.
 *   2. A verificada só deixa a conta MAIS protegida, nunca menos (o servidor não prova que ela veio do Windows).
 *   3. Abaixo de 13, verificado, a conta é suspensa como na data declarada.
 *   4. Faixa que não bate com as do Windows é recusada.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const comAnos = (anos: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anos);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
};
await criarConta(app, 'dona-idade-windows'); // a primeira conta cuida do Syden
const rota = '/api/me/idade-do-windows';

test('a não verificada não muda nada', async () => {
  const eu = comToken(app, (await criarConta(app, 'adulto-nao-verificado', 'segredo123', comAnos(30))).token);
  const r = await eu('POST', rota, { menor: 13, maior: 15, verificacao: 'nao-verificada' });
  assert.equal(r.json().guardada, false);
  assert.equal((await eu('GET', '/api/me')).json().faixa, 'adulto');
});

test('a verificada vale acima da data: quem disse 30 e o Windows verificou 13-15 tem as proteções', async () => {
  const eu = comToken(app, (await criarConta(app, 'disse-adulto', 'segredo123', comAnos(30))).token);
  const r = await eu('POST', rota, { menor: 13, maior: 15, verificacao: 'verificada' });
  assert.equal(r.json().guardada, true);
  assert.equal((await eu('GET', '/api/me')).json().faixa, '13-15');
  assert.equal((await eu('GET', '/api/me/protecao')).json().faixa, '13-15');
});

test('mas NUNCA no outro sentido: quem disse 15 e manda "18+ verificada" continua com as proteções', async () => {
  // O servidor não tem como provar que a faixa veio do Windows: qualquer um a manda pelo console do navegador.
  const eu = comToken(app, (await criarConta(app, 'disse-menor', 'segredo123', comAnos(15))).token);
  await eu('POST', rota, { menor: 18, maior: null, verificacao: 'verificada' });
  assert.equal((await eu('GET', '/api/me')).json().faixa, '13-15');
  assert.equal((await eu('GET', '/api/me/protecao')).json().faixa, '13-15');
});

test('a rota responde mesmo com a conta barrada (sem a data): ela só protege mais', async () => {
  const eu = comToken(app, (await criarConta(app, 'sem-data-windows', 'segredo123')).token);
  const r = await eu('POST', rota, { menor: 13, maior: 15, verificacao: 'verificada' });
  assert.equal(r.statusCode, 200);
});

test('abaixo de 13, verificado, a conta é suspensa', async () => {
  const eu = comToken(app, (await criarConta(app, 'crianca-windows', 'segredo123', comAnos(30))).token);
  const r = await eu('POST', rota, { menor: 10, maior: 12, verificacao: 'verificada' });
  assert.equal(r.json().barreira?.tipo, 'suspensa');
});

test('faixa que não bate com as do Windows é recusada', async () => {
  const eu = comToken(app, (await criarConta(app, 'faixa-estranha', 'segredo123', comAnos(30))).token);
  assert.equal((await eu('POST', rota, { menor: 14, maior: 20, verificacao: 'verificada' })).statusCode, 400);
  assert.equal((await eu('POST', rota, { menor: 'x', maior: null, verificacao: 'verificada' })).statusCode, 400);
});
