import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

// Sem provedor configurado, o servidor devolve o link na resposta fora de produção. É assim que o teste
// "abre o e-mail" — e é assim que dá para usar o fluxo inteiro antes de existir domínio e conta no Resend.
const codigoDoLink = (link: string) => new URL(link).searchParams.get('recuperar') ?? new URL(link).searchParams.get('confirmar');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('cadastrar o e-mail', () => {
  it('exige a senha atual, porque o e-mail é a chave da recuperação', async () => {
    const { token } = await criarConta(app, 'ana');
    const como = comToken(app, token);
    const semSenha = await como('PUT', '/api/me/email', { email: 'ana@exemplo.com', password: 'chute' });
    assert.equal(semSenha.statusCode, 400);
    assert.equal((await como('GET', '/api/me/email')).json().email, null, 'não podia ter trocado');
  });

  it('aceita com a senha certa e já manda o link de confirmação', async () => {
    const { token, password } = await criarConta(app, 'bia');
    const como = comToken(app, token);
    const posto = await como('PUT', '/api/me/email', { email: 'Bia@Exemplo.com ', password });
    assert.equal(posto.statusCode, 200);
    assert.equal(posto.json().email, 'bia@exemplo.com', 'guarda em minúsculas e sem espaço');
    assert.ok(posto.json().rascunho, 'sem provedor, fica em rascunho em vez de fingir que enviou');

    const antes = await como('GET', '/api/me/email');
    assert.equal(antes.json().verifiedAt, null, 'endereço novo começa por confirmar');

    const confirmado = await app.inject({
      method: 'POST',
      url: '/api/auth/confirmar-email',
      payload: { codigo: codigoDoLink(posto.json().link) },
    });
    assert.equal(confirmado.statusCode, 200);
    assert.ok((await como('GET', '/api/me/email')).json().verifiedAt, 'agora está confirmado');
  });

  it('recusa endereço já usado por outra pessoa', async () => {
    const { token, password } = await criarConta(app, 'carla');
    const resposta = await comToken(app, token)('PUT', '/api/me/email', { email: 'bia@exemplo.com', password });
    assert.equal(resposta.statusCode, 409);
  });

  it('recusa endereço sem cara de endereço', async () => {
    const { token, password } = await criarConta(app, 'dani');
    assert.equal((await comToken(app, token)('PUT', '/api/me/email', { email: 'isto-nao-e-email', password })).statusCode, 400);
  });
});

describe('esqueci a senha', () => {
  it('responde a mesma coisa para conta que existe e para endereço inventado', async () => {
    const existe = await app.inject({ method: 'POST', url: '/api/auth/esqueci', payload: { email: 'bia@exemplo.com' } });
    const naoExiste = await app.inject({ method: 'POST', url: '/api/auth/esqueci', payload: { email: 'ninguem@exemplo.com' } });

    assert.equal(existe.statusCode, naoExiste.statusCode);
    assert.equal(existe.json().aviso, naoExiste.json().aviso, 'a tela não pode virar consultório de quem tem conta');
  });

  it('o link troca a senha, vale uma vez só e derruba as sessões abertas', async () => {
    const { token, password } = await criarConta(app, 'edu');
    const como = comToken(app, token);
    await como('PUT', '/api/me/email', { email: 'edu@exemplo.com', password });

    const pedido = await app.inject({ method: 'POST', url: '/api/auth/esqueci', payload: { email: 'edu@exemplo.com' } });
    const codigo = codigoDoLink(pedido.json().link);

    const trocou = await app.inject({ method: 'POST', url: '/api/auth/recuperar', payload: { codigo, novaSenha: 'senha-nova-123' } });
    assert.equal(trocou.statusCode, 200);

    // A sessão que estava aberta cai: quem recupera a senha costuma ter perdido o controle da conta.
    assert.equal((await como('GET', '/api/me')).statusCode, 401);

    const repetido = await app.inject({ method: 'POST', url: '/api/auth/recuperar', payload: { codigo, novaSenha: 'outra-ainda-123' } });
    assert.equal(repetido.statusCode, 400, 'o mesmo link não serve duas vezes');
  });

  it('a senha nova é a que passa a valer', async () => {
    const { user, password } = await criarConta(app, 'fabi');
    const como = comToken(app, (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } })).json().token);
    await como('PUT', '/api/me/email', { email: 'fabi@exemplo.com', password });

    const pedido = await app.inject({ method: 'POST', url: '/api/auth/esqueci', payload: { email: 'fabi@exemplo.com' } });
    await app.inject({
      method: 'POST',
      url: '/api/auth/recuperar',
      payload: { codigo: codigoDoLink(pedido.json().link), novaSenha: 'trocada-agora-1' },
    });

    const velha = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password } });
    assert.equal(velha.statusCode, 401, 'a senha antiga não entra mais');
    const nova = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: user.username, password: 'trocada-agora-1' } });
    assert.equal(nova.statusCode, 200);
  });

  it('código inventado não troca senha de ninguém', async () => {
    const resposta = await app.inject({ method: 'POST', url: '/api/auth/recuperar', payload: { codigo: 'chute', novaSenha: 'qualquer-coisa' } });
    assert.equal(resposta.statusCode, 400);
  });

  it('recusa senha nova curta demais antes de gastar o código', async () => {
    const { token, password } = await criarConta(app, 'gabi');
    await comToken(app, token)('PUT', '/api/me/email', { email: 'gabi@exemplo.com', password });
    const pedido = await app.inject({ method: 'POST', url: '/api/auth/esqueci', payload: { email: 'gabi@exemplo.com' } });
    const codigo = codigoDoLink(pedido.json().link);

    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/recuperar', payload: { codigo, novaSenha: '123' } })).statusCode, 400);
    // O código não pode ter sido queimado por uma senha curta: ele ainda tem que funcionar.
    const agora = await app.inject({ method: 'POST', url: '/api/auth/recuperar', payload: { codigo, novaSenha: 'agora-vai-123' } });
    assert.equal(agora.statusCode, 200, 'errar o tamanho da senha não pode custar o link');
  });
});
