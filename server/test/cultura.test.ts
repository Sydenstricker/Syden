import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

// A faixa de cultura da home. A busca nas fontes depende da internet e fica de fora; o que se segura
// aqui é o que não depende: o nome da categoria de cada país e a porta das rotas.

let app: FastifyInstance;
let fechar: () => Promise<void>;
// Dinâmico: importar o servidor antes de servidorDeTeste() abriria o banco de desenvolvimento.
let categoriasDoPais: typeof import('../src/cultura.js').categoriasDoPais;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  ({ categoriasDoPais } = await import('../src/cultura.js'));
});

after(async () => {
  await fechar();
});

describe('a categoria do país no Commons', () => {
  it('tenta o nome sem e com artigo, que é onde o Commons varia', () => {
    assert.deepEqual(categoriasDoPais('BR'), ['Category:Quality images of Brazil', 'Category:Quality images of the Brazil']);
    assert.ok(categoriasDoPais('US').includes('Category:Quality images of the United States'));
    assert.ok(categoriasDoPais('NL').includes('Category:Quality images of the Netherlands'));
  });

  it('tira o parêntese que o nome em inglês às vezes traz', () => {
    assert.equal(categoriasDoPais('MM')[0], 'Category:Quality images of Myanmar');
  });
});

describe('as rotas da cultura', () => {
  it('a lista pede conta, e recusa país ou língua fora do formato', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/cultura?pais=BR&lingua=pt' })).statusCode, 401);
    const pedir = comToken(app, (await criarConta(app, 'cultura')).token);
    for (const consulta of ['pais=BRA&lingua=pt', 'pais=BR&lingua=portugues', 'pais=../&lingua=pt', 'lingua=pt']) {
      const resposta = await pedir('GET', `/api/cultura?${consulta}`);
      assert.equal(resposta.statusCode, 400, consulta);
    }
  });

  it('arquivo que a lista do dia não selecionou não existe: o servidor não vira proxy de nada', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/cultura/arquivo/qualquer-coisa' });
    assert.equal(resposta.statusCode, 404);
  });

  it('o áudio também: só toca o que uma seção de música já selecionou', async () => {
    for (const id of ['qualquer-coisa', 'a-inventado', encodeURIComponent('https://upload.wikimedia.org/x.ogg')]) {
      const resposta = await app.inject({ method: 'GET', url: `/api/cultura/audio/${id}` });
      assert.equal(resposta.statusCode, 404, id);
    }
  });

  it('as seções pedem conta, só existem as quatro, e recusam país ou língua fora do formato', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/cultura/secao/comida?pais=BR&lingua=pt' })).statusCode, 401);
    const pedir = comToken(app, (await criarConta(app, 'secoes')).token);
    assert.equal((await pedir('GET', '/api/cultura/secao/politica?pais=BR&lingua=pt')).statusCode, 404);
    assert.equal((await pedir('GET', '/api/cultura/secao/teatro?pais=BRA&lingua=pt')).statusCode, 400);
    assert.equal((await pedir('GET', '/api/cultura/secao/danca?pais=BR&lingua=../')).statusCode, 400);
  });
});

describe('as categorias de cada seção', () => {
  it('comida, dança e instrumentos usam o mesmo nome de país, com e sem artigo', () => {
    assert.deepEqual(categoriasDoPais('NG', 'Cuisine of'), ['Category:Cuisine of Nigeria', 'Category:Cuisine of the Nigeria']);
    assert.equal(categoriasDoPais('JP', 'Dance of')[0], 'Category:Dance of Japan');
    assert.ok(categoriasDoPais('NL', 'Musical instruments of').includes('Category:Musical instruments of the Netherlands'));
  });
});
