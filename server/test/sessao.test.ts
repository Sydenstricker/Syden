import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { CONVITE, comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('porta de entrada', () => {
  it('não cria conta sem convite válido', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'intruso', password: 'segredo123', inviteCode: 'chute' },
    });
    assert.equal(resposta.statusCode, 403);
  });

  it('cria conta com o convite certo', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ana', password: 'segredo123', inviteCode: CONVITE },
    });
    assert.equal(resposta.statusCode, 200);
    assert.ok(resposta.json().token, 'devia vir com token de sessão');
  });

  it('recusa senha curta demais', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'curta', password: '123', inviteCode: CONVITE },
    });
    assert.equal(resposta.statusCode, 400);
  });

  it('não deixa dois com o mesmo nome', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ANA', password: 'segredo123', inviteCode: CONVITE },
    });
    assert.equal(resposta.statusCode, 409, 'o nome não diferencia maiúscula de minúscula');
  });
});

describe('token de sessão', () => {
  it('sem token, não entra', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/me' })).statusCode, 401);
  });

  it('token adulterado não entra', async () => {
    const { token } = await criarConta(app, 'bia');
    const [cabeca, corpo, assinatura] = token.split('.');
    // Mexe no conteúdo mantendo a assinatura: é a tentativa clássica de virar outra pessoa.
    const falso = `${cabeca}.${Buffer.from('{"sub":"1","sv":1}').toString('base64url')}.${assinatura}`;
    const resposta = await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${falso}` } });
    assert.equal(resposta.statusCode, 401);
  });

  it('trocar a senha derruba os aparelhos antigos e devolve token novo', async () => {
    const { token, password } = await criarConta(app, 'carla');
    const como = comToken(app, token);
    assert.equal((await como('GET', '/api/me')).statusCode, 200);

    const troca = await como('POST', '/api/me/password', { currentPassword: password, newPassword: 'outra-senha' });
    assert.equal(troca.statusCode, 200);

    assert.equal((await como('GET', '/api/me')).statusCode, 401, 'o token antigo tinha que morrer na troca');
    const novo = comToken(app, troca.json().token);
    assert.equal((await novo('GET', '/api/me')).statusCode, 200, 'quem trocou continua logado');
  });

  it('senha errada não troca nada', async () => {
    const { token } = await criarConta(app, 'dani');
    const como = comToken(app, token);
    const troca = await como('POST', '/api/me/password', { currentPassword: 'chute', newPassword: 'outra-senha' });
    assert.equal(troca.statusCode, 400);
    assert.equal((await como('GET', '/api/me')).statusCode, 200, 'a sessão não podia cair por uma tentativa errada');
  });

  it('sair de todos os aparelhos derruba as outras sessões', async () => {
    const { user, password } = await criarConta(app, 'edu');
    // Duas sessões da mesma pessoa, como se fossem dois computadores.
    const primeira = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } })).json();
    const segunda = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } })).json();

    const saida = await comToken(app, segunda.token)('POST', '/api/me/sessions/revoke');
    assert.equal(saida.statusCode, 200);

    assert.equal((await comToken(app, primeira.token)('GET', '/api/me')).statusCode, 401, 'o outro aparelho tinha que cair');
    assert.equal((await comToken(app, saida.json().token)('GET', '/api/me')).statusCode, 200, 'quem clicou continua dentro');
  });

  it('conta apagada não volta com token antigo na mão', async () => {
    const { token, password } = await criarConta(app, 'fabi');
    const como = comToken(app, token);
    assert.equal((await como('POST', '/api/me/delete', { password })).statusCode, 200);
    assert.equal((await como('GET', '/api/me')).statusCode, 401);
  });
});
