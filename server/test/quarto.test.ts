/**
 * O quarto de cada pessoa: a arrumação mora no servidor, e outra conta pode VISITAR (decisão dele, 15/10/2026).
 *
 *   1. Cada um guarda e lê o SEU; o que entra é validado (é desenhado na tela de quem visita).
 *   2. Qualquer conta visita e vê IGUAL, inclusive onde a cadeira parou.
 *   3. Com bloqueio, em qualquer sentido, a porta fecha — e a resposta é a mesma de "não arrumou o quarto".
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let ana: ReturnType<typeof comToken>;
let zeca: ReturnType<typeof comToken>;
let rui: ReturnType<typeof comToken>;
let anaId: number;
let zecaId: number;

const ARRUMACAO = {
  moveis: { cama: { c: [1.5, 2], lado: 3 }, pufe: { c: [5, 5], lado: 0 } },
  cadeira: { u: 6.2, v: 1.4, th: 1.2 },
  janela: { tipo: 'arco', parede: 'esquerda', v: 1.5 },
  cortina: false,
  janelaAberta: false,
  vista: 2,
  parede: { quadro: { parede: 'esquerda', v: 0, h: 0 }, fone: { parede: 'direita', v: -2.5, h: -6 } },
  cores: { tapete: 'terracota' },
};

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const a = await criarConta(app, 'ana'), z = await criarConta(app, 'zeca'), r = await criarConta(app, 'rui');
  ana = comToken(app, a.token); zeca = comToken(app, z.token); rui = comToken(app, r.token);
  anaId = a.user.id; zecaId = z.user.id;
});

after(async () => fechar());

describe('o meu quarto', () => {
  it('começa sem arrumação (a página usa a de fábrica)', async () => {
    assert.equal((await ana('GET', '/api/quarto')).json().arrumacao, null);
  });

  it('guarda e devolve a arrumação', async () => {
    assert.equal((await ana('PUT', '/api/quarto', ARRUMACAO)).statusCode, 200);
    assert.deepEqual((await ana('GET', '/api/quarto')).json().arrumacao, ARRUMACAO);
  });

  it('o que não é da arrumação fica de fora', async () => {
    await ana('PUT', '/api/quarto', { ...ARRUMACAO, segredo: 'x'.repeat(50) });
    assert.equal((await ana('GET', '/api/quarto')).json().arrumacao.segredo, undefined);
  });

  it('o ângulo da cadeira volta para uma volta só', async () => {
    await ana('PUT', '/api/quarto', { ...ARRUMACAO, cadeira: { u: 3, v: 3, th: 100 } });
    const th = (await ana('GET', '/api/quarto')).json().arrumacao.cadeira.th;
    assert.ok(th >= 0 && th < 2 * Math.PI, String(th));
    await ana('PUT', '/api/quarto', ARRUMACAO);
  });

  it('RECUSA o que quebraria o quarto de quem visita', async () => {
    const ruins: unknown[] = [
      null,
      { moveis: [] },
      { moveis: { cama: { c: [9, 1], lado: 0 } } }, // fora do quarto
      { moveis: { cama: { c: [1, 1], lado: 4 } } }, // não existe posição 4
      { moveis: { 'Cama!': { c: [1, 1], lado: 0 } } }, // código que não é código
      { moveis: Object.fromEntries(Array.from({ length: 41 }, (_, i) => ['m' + i, { c: [1, 1], lado: 0 }])) },
      { moveis: {}, cadeira: { u: 1, v: 1, th: 'gira' } },
      { moveis: {}, janela: { tipo: 'arco', parede: 'teto', v: 0 } },
      { moveis: {}, cortina: 'sim' },
      { moveis: {}, parede: { quadro: { parede: 'teto', v: 0, h: 0 } } },
      { moveis: {}, parede: { quadro: { parede: 'esquerda', v: 0, h: 9999 } } },
      { moveis: {}, cores: { tapete: '<script>' } },
    ];
    for (const r of ruins) assert.equal((await ana('PUT', '/api/quarto', r)).statusCode, 400, JSON.stringify(r)?.slice(0, 80));
    assert.deepEqual((await ana('GET', '/api/quarto')).json().arrumacao, ARRUMACAO, 'a recusa não mexeu no que estava');
  });
});

describe('visitar', () => {
  it('qualquer conta vê o quarto IGUAL ao do dono', async () => {
    const r = await zeca('GET', `/api/quarto/${anaId}`);
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.json().arrumacao, ARRUMACAO);
    assert.equal(r.json().dono.username, 'ana');
  });

  it('quem não arrumou o quarto: não há o que visitar', async () => {
    assert.equal((await ana('GET', `/api/quarto/${zecaId}`)).statusCode, 404);
  });

  it('id que não existe: a mesma resposta', async () => {
    const r = await ana('GET', '/api/quarto/999999');
    assert.equal(r.statusCode, 404);
    assert.deepEqual(r.json(), (await ana('GET', `/api/quarto/${zecaId}`)).json());
  });

  it('COM BLOQUEIO, em qualquer sentido, a porta fecha — com a resposta de "não arrumou"', async () => {
    const semQuarto = (await ana('GET', `/api/quarto/${zecaId}`)).json();
    assert.equal((await ana('POST', '/api/me/bloqueios', { userId: zecaId })).statusCode, 200);
    const bloqueado = await zeca('GET', `/api/quarto/${anaId}`);
    assert.equal(bloqueado.statusCode, 404);
    assert.deepEqual(bloqueado.json(), semQuarto, 'quem foi bloqueado não descobre que foi');
    await zeca('PUT', '/api/quarto', ARRUMACAO);
    assert.equal((await ana('GET', `/api/quarto/${zecaId}`)).statusCode, 404, 'quem bloqueou também não entra');
    assert.equal((await rui('GET', `/api/quarto/${anaId}`)).statusCode, 200, 'o resto continua visitando');
  });

  it('sem conta, não entra', async () => {
    assert.equal((await app.inject({ method: 'GET', url: `/api/quarto/${anaId}` })).statusCode, 401);
  });
});
