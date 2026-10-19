import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
// depois do banco de teste: o arquivo das rotas abre o db.ts ao ser importado
const { IDIOMAS_POR_LISTA, lerIdiomas } = await import('../src/idiomas-routes.js');
after(fechar);

const ana = await criarConta(app, 'ana');
const bia = await criarConta(app, 'bia');
const comoAna = comToken(app, ana.token);
const comoBia = comToken(app, bia.token);
const idDe = async (pedir: typeof comoAna) => (await pedir('GET', '/api/me')).json().id as number;

test('o formulário recusa lista grande, código estranho, repetido e o mesmo idioma nas duas listas', () => {
  assert.ok('erro' in lerIdiomas({ falados: Array.from({ length: IDIOMAS_POR_LISTA + 1 }, (_, i) => 'a' + 'bcdefghij'[i]) }));
  assert.ok('erro' in lerIdiomas({ falados: ['<script>'] }));
  assert.ok('erro' in lerIdiomas({ falados: ['en', 'en'] }));
  assert.ok('erro' in lerIdiomas({ falados: ['en'], estudo: ['en'] }));
  assert.ok('erro' in lerIdiomas({ falados: 'en' }));
  assert.deepEqual(lerIdiomas({ falados: ['pt-BR', 'en'], estudo: ['ja'] }), { falados: ['pt-BR', 'en'], estudo: ['ja'] });
});

test('a pessoa informa os idiomas, e quem abre o cartão dela vê', async () => {
  assert.equal((await comoAna('PUT', '/api/me/idiomas', { falados: ['pt-BR'], estudo: ['ja', 'ko'] })).statusCode, 200);
  const visto = (await comoBia('GET', `/api/users/${await idDe(comoAna)}/idiomas`)).json();
  assert.deepEqual(visto, { falados: ['pt-BR'], estudo: ['ja', 'ko'] });
  assert.deepEqual((await comoAna('GET', '/api/me/idiomas')).json(), visto, 'e a própria pessoa relê o que pôs');
  assert.deepEqual((await comoAna('GET', '/api/me/dados')).json().conta.idiomas, visto, 'e vai no "Levar seus dados"');
});

test('quem não informou não mostra nada; apagar é mandar as listas vazias', async () => {
  assert.deepEqual((await comoAna('GET', `/api/users/${await idDe(comoBia)}/idiomas`)).json(), { falados: [], estudo: [] });
  await comoAna('PUT', '/api/me/idiomas', { falados: [], estudo: [] });
  assert.deepEqual((await comoBia('GET', `/api/users/${await idDe(comoAna)}/idiomas`)).json(), { falados: [], estudo: [] });
});

test('com bloqueio, a resposta é a de quem não informou', async () => {
  await comoAna('PUT', '/api/me/idiomas', { falados: ['es'] });
  const biaId = await idDe(comoBia);
  const bloqueio = await comoAna('POST', '/api/me/bloqueios', { userId: biaId });
  assert.ok(bloqueio.statusCode < 300, 'bloquear: ' + bloqueio.statusCode + ' ' + bloqueio.body);
  assert.deepEqual((await comoBia('GET', `/api/users/${await idDe(comoAna)}/idiomas`)).json(), { falados: [], estudo: [] });
});
