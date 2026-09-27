// Os dois portões do Syden, que são diferentes de propósito:
//   1. ter conta — pode ser aberto a qualquer pessoa;
//   2. entrar numa comunidade — sempre por convite.
// Confundir os dois foi o que quase despejou estranhos dentro da comunidade dos amigos.
process.env.CADASTRO_ABERTO = 'sim';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { CONVITE, codigoDoLink, comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let comunidadeDosAmigos: number;

before(async () => {
  process.env.CADASTRO_ABERTO = 'sim';
  ({ app, fechar } = await servidorDeTeste());
  // A primeira conta do Syden cria a comunidade inicial, como sempre.
  const dono = await criarConta(app, 'dono');
  comunidadeDosAmigos = (await comToken(app, dono.token)('GET', '/api/communities')).json()[0].id;
});
after(() => fechar());

// O cadastro não devolve mais token: devolve o link de confirmação (só fora de produção). Quem quiser
// uma conta pronta para usar chama `entrar`, logo abaixo.
const cadastrar = (username: string, inviteCode?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password: 'segredo123', email: `${username}@exemplo.teste`, inviteCode },
  });

/** Cadastra, confirma o e-mail e entra — o caminho inteiro de quem chega hoje. */
async function entrar(username: string, inviteCode?: string) {
  const cadastro = await cadastrar(username, inviteCode);
  assert.equal(cadastro.statusCode, 200, cadastro.body);
  await app.inject({ method: 'POST', url: '/api/auth/confirmar-email', payload: { codigo: codigoDoLink(cadastro.json().link) } });
  const entrada = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password: 'segredo123' } });
  assert.equal(entrada.statusCode, 200, entrada.body);
  return entrada.json();
}

describe('com o cadastro aberto', () => {
  it('qualquer pessoa cria conta, sem código nenhum', async () => {
    const resposta = await cadastrar('desconhecido');
    assert.equal(resposta.statusCode, 200);
    // Não vem token: a conta existe, mas só entra depois de confirmar o e-mail.
    assert.equal(resposta.json().precisaConfirmar, true);
    assert.equal(resposta.json().token, undefined);
  });

  it('mas não entra em comunidade nenhuma', async () => {
    // Este é o ponto. Antes, quem chegava sem código caía na comunidade padrão — a dos amigos.
    const { token } = await entrar('estranho');
    const minhas = (await comToken(app, token)('GET', '/api/communities')).json();
    assert.deepEqual(minhas, [], 'conta nova sem convite começa sem comunidade');
  });

  it('e não enxerga a comunidade dos outros', async () => {
    const { token } = await entrar('curioso');
    const como = comToken(app, token);
    assert.equal((await como('GET', `/api/communities/${comunidadeDosAmigos}/channels`)).statusCode, 404);
    assert.equal((await como('GET', `/api/communities/${comunidadeDosAmigos}/members`)).statusCode, 404);
  });

  it('com convite, entra na comunidade de quem convidou', async () => {
    const { token } = await entrar('convidado', CONVITE);
    const minhas = (await comToken(app, token)('GET', '/api/communities')).json();
    assert.equal(minhas.length, 1);
    assert.equal(minhas[0].id, comunidadeDosAmigos);
  });

  it('quem chegou sem convite pode criar a própria comunidade', async () => {
    const { token } = await entrar('fundador');
    const como = comToken(app, token);
    const minha = await como('POST', '/api/communities', { name: 'Clube novo' });
    assert.equal(minha.statusCode, 200);
    assert.equal((await como('GET', '/api/communities')).json().length, 1, 'e é só a dele');
  });

  it('ou entrar depois, com um código que alguém passar', async () => {
    const { token } = await entrar('atrasado');
    const como = comToken(app, token);
    assert.deepEqual((await como('GET', '/api/communities')).json(), []);
    assert.equal((await como('POST', '/api/communities/join', { code: CONVITE })).statusCode, 200);
    assert.equal((await como('GET', '/api/communities')).json().length, 1);
  });
});
