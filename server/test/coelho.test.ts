// O COELHO DO CRIADOR (10/11/2026, pedido dele: "gostei da tela de criação, pode implementar ao Syden?"). O que este teste
// prende: o servidor só guarda receita que lê, e a guarda CANÔNICA (é desenhada na tela de todos); com a sugestão intacta o
// avatar é o desenho pronto, mexida vira o coelho montado; a foto de antes vai para os anteriores; escolher um pronto pelo
// caminho antigo tira a receita.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { codigo, lerCodigo, PRESETS } from '../src/coelho-receita.js';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

const { app, fechar } = await servidorDeTeste();
after(fechar);

const png = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(600, 7)]).toString('base64');

test('a receita: ida e volta, e o que não é coelho não passa', () => {
  const r = { ...PRESETS[2] };
  assert.deepEqual(lerCodigo(codigo(r)), r);
  assert.equal(lerCodigo('SYD1-'), null);
  assert.equal(lerCodigo('outra coisa'), null);
  assert.equal(lerCodigo('SYD1-' + btoa(JSON.stringify({ c: 'dragao' }))), null, 'corpo que não existe');
  // cor inválida vira a original; acessório que não existe some
  const estranho = lerCodigo('SYD1-' + btoa(JSON.stringify({ c: 'mascote', p: 'red', h: 'coroa', n: 'bandana', nc: '#ABCDEF' })).replace(/=+$/, ''));
  assert.deepEqual(estranho, { corpo: 'mascote', pelo: null, roupa: null, cabeca: null, cabecaCor: null, pescoco: 'bandana', pescocoCor: '#abcdef' });
});

test('guardar o coelho: canônico, com e sem a sugestão, e a foto vai para os anteriores', async () => {
  const como = comToken(app, (await criarConta(app, 'quemcria')).token);
  await como('PUT', '/api/me/avatar', { image: png });

  // um código feito à mão, com campos a mais e "=" no fim: guarda-se o canônico
  const bagunçado = 'SYD1-' + btoa(JSON.stringify({ c: 'musculoso', p: '#FFAA00', x: 1 }));
  const r1 = await como('PUT', '/api/me/coelho', { codigo: bagunçado });
  assert.equal(r1.statusCode, 200, r1.body);
  assert.equal(r1.json().coelho, codigo({ corpo: 'musculoso', pelo: '#ffaa00', roupa: null, cabeca: null, cabecaCor: null, pescoco: null, pescocoCor: null }));
  assert.equal(r1.json().avatarVersion, null, 'a foto saiu');
  assert.equal(r1.json().avatarPronto, null, 'o avatar é o coelho montado');
  assert.equal(((await como('GET', '/api/me/avatares-anteriores')).json() as unknown[]).length, 1, 'a foto foi para os anteriores');

  // a sugestão intacta: o avatar é o desenho pronto
  const r2 = await como('PUT', '/api/me/coelho', { codigo: codigo(PRESETS[5]), pronto: 5 });
  assert.equal(r2.json().avatarPronto, 5);
  assert.equal(r2.json().coelho, codigo(PRESETS[5]));

  // o caminho antigo (só o número) tira a receita: na cena, vale a do pronto
  const r3 = await como('PUT', '/api/me/avatar-pronto', { numero: 7 });
  assert.equal(r3.json().coelho, null);

  assert.equal((await como('PUT', '/api/me/coelho', { codigo: 'nada' })).statusCode, 400);
  assert.equal((await como('PUT', '/api/me/coelho', { codigo: codigo(PRESETS[1]), pronto: 99 })).statusCode, 400);
});

test('"Meus coelhos": a lista vai inteira, conferida e canônica, e só a dona a vê', async () => {
  const como = comToken(app, (await criarConta(app, 'guardacoelho')).token);
  assert.deepEqual((await como('GET', '/api/me/coelhos-salvos')).json(), []);
  const r = await como('PUT', '/api/me/coelhos-salvos', { lista: [{ nome: '  Coelho do CS  ', codigo: codigo(PRESETS[11]) + '==' }] });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual((await como('GET', '/api/me/coelhos-salvos')).json(), [{ nome: 'Coelho do CS', codigo: codigo(PRESETS[11]) }]);
  assert.equal((await como('PUT', '/api/me/coelhos-salvos', { lista: [{ nome: 'x', codigo: 'nada' }] })).statusCode, 400);
  assert.equal((await como('PUT', '/api/me/coelhos-salvos', { lista: Array.from({ length: 13 }, () => ({ nome: 'a', codigo: codigo(PRESETS[1]) })) })).statusCode, 400);
  const outra = comToken(app, (await criarConta(app, 'outracoelho')).token);
  assert.deepEqual((await outra('GET', '/api/me/coelhos-salvos')).json(), []);
});
