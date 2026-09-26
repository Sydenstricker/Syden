// Os dois portões do Syden, que são diferentes de propósito:
//   1. ter conta — pode ser aberto a qualquer pessoa;
//   2. entrar numa comunidade — sempre por convite.
// Confundir os dois foi o que quase despejou estranhos dentro da comunidade dos amigos.
process.env.CADASTRO_ABERTO = 'sim';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { CONVITE, comToken, criarConta, servidorDeTeste } from './ajuda.js';

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

const cadastrar = (username: string, inviteCode?: string) =>
  app.inject({ method: 'POST', url: '/api/auth/register', payload: { username, password: 'segredo123', inviteCode } });

describe('com o cadastro aberto', () => {
  it('qualquer pessoa cria conta, sem código nenhum', async () => {
    const resposta = await cadastrar('desconhecido');
    assert.equal(resposta.statusCode, 200);
    assert.ok(resposta.json().token);
  });

  it('mas não entra em comunidade nenhuma', async () => {
    // Este é o ponto. Antes, quem chegava sem código caía na comunidade padrão — a dos amigos.
    const { token } = (await cadastrar('estranho')).json();
    const minhas = (await comToken(app, token)('GET', '/api/communities')).json();
    assert.deepEqual(minhas, [], 'conta nova sem convite começa sem comunidade');
  });

  it('e não enxerga a comunidade dos outros', async () => {
    const { token } = (await cadastrar('curioso')).json();
    const como = comToken(app, token);
    assert.equal((await como('GET', `/api/communities/${comunidadeDosAmigos}/channels`)).statusCode, 404);
    assert.equal((await como('GET', `/api/communities/${comunidadeDosAmigos}/members`)).statusCode, 404);
  });

  it('com convite, entra na comunidade de quem convidou', async () => {
    const { token } = (await cadastrar('convidado', CONVITE)).json();
    const minhas = (await comToken(app, token)('GET', '/api/communities')).json();
    assert.equal(minhas.length, 1);
    assert.equal(minhas[0].id, comunidadeDosAmigos);
  });

  it('quem chegou sem convite pode criar a própria comunidade', async () => {
    const { token } = (await cadastrar('fundador')).json();
    const como = comToken(app, token);
    const minha = await como('POST', '/api/communities', { name: 'Clube novo' });
    assert.equal(minha.statusCode, 200);
    assert.equal((await como('GET', '/api/communities')).json().length, 1, 'e é só a dele');
  });

  it('ou entrar depois, com um código que alguém passar', async () => {
    const { token } = (await cadastrar('atrasado')).json();
    const como = comToken(app, token);
    assert.deepEqual((await como('GET', '/api/communities')).json(), []);
    assert.equal((await como('POST', '/api/communities/join', { code: CONVITE })).statusCode, 200);
    assert.equal((await como('GET', '/api/communities')).json().length, 1);
  });
});
