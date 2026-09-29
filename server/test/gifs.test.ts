// Os GIFs, sem tocar no GIPHY.
//
// A parte que dá errado não é a busca: é a COTA. São 100 buscas por hora no plano grátis, para o Syden
// inteiro, e quem gasta isso não é atacante nenhum — é uma pessoa digitando "gatinho" letra por letra.
// Por isso o que está testado aqui é o cache, o freio e o que a tela recebe quando não dá para buscar.
//
// O `fetch` é trocado por um de mentira. Bater no GIPHY de verdade num teste gastaria a cota do Syden
// para provar uma coisa que não depende deles, e falharia sem internet.
import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

/*
 * O gifs.js entra por import DINÂMICO, depois de o servidor de teste subir.
 *
 * Qualquer import estático de um módulo do servidor arrasta o config.ts junto, e o config congela o
 * DATABASE_PATH no primeiro import — o que faria este arquivo abrir o banco de DESENVOLVIMENTO e sujá-lo
 * sem ninguém notar. O para-raios em ajuda.ts estoura nesse caso, e foi o que aconteceu aqui.
 */
let gifs: typeof import('../src/gifs.js');
let app: FastifyInstance;
let fechar: () => Promise<void>;
let alguem: ReturnType<typeof comToken>;

const original = globalThis.fetch;
let pedidos: string[] = [];

/** Um GIPHY de mentira: conta quantas vezes foi chamado e devolve sempre a mesma coisa. */
function giphyDeMentira(quantos = 2) {
  globalThis.fetch = (async (entrada: string | URL) => {
    pedidos.push(String(entrada));
    return new Response(
      JSON.stringify({
        data: Array.from({ length: quantos }, (_, i) => ({
          id: 'gif' + i,
          title: 'um gato',
          images: {
            downsized_medium: { url: `https://media0.giphy.com/media/gif${i}/giphy.gif`, width: '480', height: '270' },
            fixed_width: { url: `https://media0.giphy.com/media/gif${i}/200w.gif`, width: '200', height: '112' },
          },
        })),
        pagination: { total_count: 100, offset: 0 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;
}

before(async () => {
  process.env.GIPHY_API_KEY = 'chave-de-teste';
  ({ app, fechar } = await servidorDeTeste());
  gifs = await import('../src/gifs.js');
  const conta = await criarConta(app, 'gif');
  alguem = comToken(app, conta.token);
});
after(() => fechar());

afterEach(() => {
  gifs.esquecerTudo();
  pedidos = [];
  globalThis.fetch = original;
});

describe('traduzir o que o GIPHY manda', () => {
  it('as medidas vêm como TEXTO, e viram número', () => {
    // O formato deles manda "480", não 480. Um NaN aqui vira um buraco no meio da grade.
    const gif = gifs.paraOSyden({
      id: 'abc',
      title: 'gato',
      images: {
        downsized_medium: { url: 'https://media0.giphy.com/media/abc/giphy.gif', width: '480', height: '270' },
        fixed_width: { url: 'https://media0.giphy.com/media/abc/200w.gif', width: '200', height: '112' },
      },
    });
    assert.equal(gif?.largura, 480);
    assert.equal(gif?.previaAltura, 112);
  });

  it('item sem endereço é DESCARTADO, e não remendado', () => {
    // Um `undefined` na url viraria uma imagem quebrada na conversa de todo mundo.
    assert.equal(gifs.paraOSyden({ id: 'abc', images: {} }), null);
    assert.equal(gifs.paraOSyden({ images: { original: { url: 'x' } } }), null);
    assert.equal(gifs.paraOSyden(null), null);
  });

  it('prefere a versão com teto de tamanho à original', () => {
    // O original pode ter dezenas de megabytes, e quem assiste paga essa conta na internet dele.
    const gif = gifs.paraOSyden({
      id: 'abc',
      images: {
        original: { url: 'https://media0.giphy.com/media/abc/gigante.gif', width: '1000', height: '1000' },
        downsized_medium: { url: 'https://media0.giphy.com/media/abc/medio.gif', width: '480', height: '480' },
        fixed_width: { url: 'https://media0.giphy.com/media/abc/200w.gif', width: '200', height: '200' },
      },
    });
    assert.match(gif!.url, /medio\.gif$/);
  });
});

describe('a cota do GIPHY', () => {
  it('busca repetida NÃO gasta cota: sai do cache', async () => {
    giphyDeMentira();
    await gifs.buscar({ termo: 'gato' });
    await gifs.buscar({ termo: 'gato' });
    await gifs.buscar({ termo: 'GATO ' });
    assert.equal(pedidos.length, 1, 'três buscas iguais gastaram ' + pedidos.length);
    assert.equal(gifs.consumo().hora, 1);
  });

  it('a lista do momento também se guarda, e é a busca mais repetida que existe', async () => {
    giphyDeMentira();
    await gifs.buscar({});
    await gifs.buscar({});
    assert.equal(pedidos.length, 1);
    assert.match(pedidos[0], /\/trending/);
  });

  it('termo diferente é busca diferente', async () => {
    giphyDeMentira();
    await gifs.buscar({ termo: 'gato' });
    await gifs.buscar({ termo: 'cachorro' });
    assert.equal(pedidos.length, 2);
    assert.match(pedidos[1], /\/search/);
  });

  it('a classificação vai em toda busca, e o termo também', async () => {
    giphyDeMentira();
    await gifs.buscar({ termo: 'abraço', idioma: 'pt' });
    const endereco = new URL(pedidos[0]);
    assert.equal(endereco.searchParams.get('rating'), 'pg-13');
    assert.equal(endereco.searchParams.get('q'), 'abraço');
    assert.equal(endereco.searchParams.get('lang'), 'pt');
  });

  it('a chave NÃO aparece em nada que volte para a tela', async () => {
    giphyDeMentira();
    const resposta = await gifs.buscar({ termo: 'gato' });
    assert.ok(!JSON.stringify(resposta).includes('chave-de-teste'), 'a chave vazou na resposta');
  });

  it('GIPHY fora do ar vira "indisponivel", e não uma exceção', async () => {
    globalThis.fetch = (async () => {
      throw new Error('rede caiu');
    }) as typeof fetch;
    assert.deepEqual(await gifs.buscar({ termo: 'gato' }), { estado: 'indisponivel' });
  });

  it('sem chave, está desligado e nada sai daqui', async () => {
    const guardada = process.env.GIPHY_API_KEY;
    delete process.env.GIPHY_API_KEY;
    try {
      assert.equal(gifs.ligado(), false);
      assert.deepEqual(await gifs.buscar({ termo: 'gato' }), { estado: 'desligado' });
      assert.equal(pedidos.length, 0);
    } finally {
      process.env.GIPHY_API_KEY = guardada;
    }
  });
});

describe('a rota dos GIFs', () => {
  it('não responde para quem não entrou', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/gifs?q=gato' })).statusCode, 401);
  });

  it('devolve os GIFs para quem entrou', async () => {
    giphyDeMentira(3);
    const resposta = await alguem('GET', '/api/gifs?q=gato');
    assert.equal(resposta.statusCode, 200);
    const corpo = resposta.json();
    assert.equal(corpo.estado, 'ok');
    assert.equal(corpo.itens.length, 3);
    assert.match(corpo.itens[0].url, /^https:\/\/media0\.giphy\.com\//);
  });

  it('freia quem procura freneticamente, sem derrubar nada', async () => {
    // Uma pessoa não pode gastar a cota de todo mundo. O freio conta por PESSOA, e a resposta diz
    // quantos segundos faltam — a tela transforma isso numa frase, não num erro vermelho.
    giphyDeMentira();
    let freado = 0;
    for (let i = 0; i < 20; i += 1) {
      const r = await alguem('GET', `/api/gifs?q=termo${i}`);
      if (r.statusCode === 429) {
        freado += 1;
        assert.equal(r.json().estado, 'devagar');
        assert.ok(r.json().segundos > 0);
      }
    }
    assert.ok(freado > 0, 'ninguém foi freado em vinte buscas seguidas');
  });
});
