import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('a insígnia dos 25 primeiros', () => {
  it('chega para quem se cadastra no começo, e fica esperando ser aberta', async () => {
    const { token } = await criarConta(app, 'primeira');
    const como = comToken(app, token);

    const fila = (await como('GET', '/api/me/itens/novidades')).json();
    assert.equal(fila.length, 1);
    assert.equal(fila[0].code, 'primeiros-25');
    assert.equal(fila[0].revealedAt, null, 'ainda não foi aberta: a tela de destaque é que abre');
  });

  it('não aparece duas vezes por entrar duas vezes', async () => {
    const { user, password } = await criarConta(app, 'segunda');
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } });
    }
    const como = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } })).json().token);
    const itens = (await como('GET', '/api/me/itens')).json().itens;
    assert.equal(itens.filter((i: { code: string }) => i.code === 'primeiros-25').length, 1);
  });

  it('resgatar tira da fila e põe a insígnia no perfil', async () => {
    const { token } = await criarConta(app, 'terceira');
    const como = comToken(app, token);

    assert.deepEqual((await como('GET', '/api/me')).json().vitrine, [], 'antes de resgatar, o perfil está limpo');

    const resgate = await como('POST', '/api/me/itens/primeiros-25/resgatar');
    assert.equal(resgate.statusCode, 200);
    assert.deepEqual(resgate.json().user.vitrine, ['primeiros-25'], 'resgatou, apareceu no perfil');
    assert.equal((await como('GET', '/api/me/itens/novidades')).json().length, 0, 'saiu da fila');
  });

  it('resgatar de novo não quebra nem reabre a fila', async () => {
    const { token } = await criarConta(app, 'quarta');
    const como = comToken(app, token);
    await como('POST', '/api/me/itens/primeiros-25/resgatar');
    assert.equal((await como('POST', '/api/me/itens/primeiros-25/resgatar')).statusCode, 200);
    assert.equal((await como('GET', '/api/me/itens/novidades')).json().length, 0);
  });

  it('não dá para resgatar item que não se tem', async () => {
    const { token } = await criarConta(app, 'quinta');
    const resposta = await comToken(app, token)('POST', '/api/me/itens/ideia-acolhida/resgatar');
    assert.equal(resposta.statusCode, 404);
  });
});

describe('a vitrine do perfil', () => {
  it('só aceita insígnia que a pessoa tem de verdade', async () => {
    const { token } = await criarConta(app, 'sexta');
    const como = comToken(app, token);
    await como('POST', '/api/me/itens/primeiros-25/resgatar');

    // Mandar um código qualquer pela API não pode virar insígnia no perfil de ninguém.
    const resposta = await como('PUT', '/api/me/vitrine', { codigos: ['primeiros-25', 'medalha-inventada'] });
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(resposta.json().vitrine, ['primeiros-25']);
  });

  it('deixa esconder tudo, se for o que a pessoa quiser', async () => {
    const { token } = await criarConta(app, 'setima');
    const como = comToken(app, token);
    await como('POST', '/api/me/itens/primeiros-25/resgatar');
    assert.deepEqual((await como('PUT', '/api/me/vitrine', { codigos: [] })).json().vitrine, []);
  });

  it('recusa pedido mal formado e uma vitrine grande demais', async () => {
    const { token } = await criarConta(app, 'oitava');
    const como = comToken(app, token);
    assert.equal((await como('PUT', '/api/me/vitrine', { codigos: 'primeiros-25' })).statusCode, 400);
    assert.equal((await como('PUT', '/api/me/vitrine', { codigos: Array(9).fill('primeiros-25') })).statusCode, 400);
  });

  it('a vitrine viaja junto com a pessoa na lista de membros', async () => {
    // É por isso que ela é uma coluna na tabela de usuários, e não uma consulta à parte: a lista de
    // membros mostra as insígnias de todo mundo o tempo todo.
    const { token } = await criarConta(app, 'nona');
    const como = comToken(app, token);
    await como('POST', '/api/me/itens/primeiros-25/resgatar');

    const comunidade = (await como('POST', '/api/communities', { name: 'Clube' })).json();
    const membros = (await como('GET', `/api/communities/${comunidade.id}/members`)).json();
    const eu = membros.find((m: { username: string }) => m.username.startsWith('nona'));
    assert.deepEqual(eu.vitrine, ['primeiros-25'], 'quem vê a lista vê a insígnia');
  });
});
