// O coelho pronto (10/10/2026): o avatar guarda o NÚMERO do coelho, e não a imagem, para o app desenhá-lo na
// pose do estado. O que este teste prende: o número é conferido, e foto e coelho nunca convivem — ou a tela
// teria de adivinhar qual dos dois mostrar.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 3)]);
const comoDataUrl = (dados: Buffer) => 'data:image/png;base64,' + dados.toString('base64');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('o coelho pronto', () => {
  it('escolher guarda o número e tira a foto', async () => {
    const como = comToken(app, (await criarConta(app, 'quemescolhe')).token);
    await como('PUT', '/api/me/avatar', { image: comoDataUrl(png) });
    const resposta = await como('PUT', '/api/me/avatar-pronto', { numero: 7 });
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.json().avatarPronto, 7);
    assert.equal(resposta.json().avatarVersion, null, 'a foto saiu: o avatar é um ou outro');
  });

  it('enviar uma foto depois tira o coelho', async () => {
    const como = comToken(app, (await criarConta(app, 'quemvolta')).token);
    await como('PUT', '/api/me/avatar-pronto', { numero: 3 });
    const resposta = await como('PUT', '/api/me/avatar', { image: comoDataUrl(png) });
    assert.equal(resposta.json().avatarPronto, null);
    assert.notEqual(resposta.json().avatarVersion, null);
  });

  it('remover o avatar tira o coelho também', async () => {
    const como = comToken(app, (await criarConta(app, 'quemremove')).token);
    await como('PUT', '/api/me/avatar-pronto', { numero: 16 });
    assert.equal((await como('DELETE', '/api/me/avatar')).json().avatarPronto, null);
  });

  it('coelho que não existe é recusado', async () => {
    const como = comToken(app, (await criarConta(app, 'queminventa')).token);
    for (const numero of [0, 17, 2.5, '3', null]) {
      assert.equal((await como('PUT', '/api/me/avatar-pronto', { numero })).statusCode, 400, String(numero));
    }
  });

  it('a comunidade vê o coelho de quem escolheu', async () => {
    const dona = await criarConta(app, 'donadocoelho');
    const como = comToken(app, dona.token);
    await como('PUT', '/api/me/avatar-pronto', { numero: 5 });
    const comunidade = (await como('POST', '/api/communities', { name: 'Coelhos' })).json();
    const membros = (await como('GET', `/api/communities/${comunidade.id}/members`)).json();
    assert.equal(membros.find((m: { username: string }) => m.username === 'donadocoelho').avatarPronto, 5);
  });
});
