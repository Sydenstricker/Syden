/**
 * Bloquear alguém.
 *
 * Três propriedades, e cada uma existe porque a falta dela tornaria o bloqueio inútil ou perigoso:
 *
 *   1. **Vale nos dois sentidos.** Guardar num só lado é detalhe do banco; um bloqueio que calasse
 *      apenas quem bloqueou deixaria a pessoa continuar recebendo mensagem de quem ela bloqueou.
 *   2. **É invisível para quem foi bloqueado.** As recusas que ele encontra são iguais às de sempre.
 *      Avisar transformaria um ato de defesa num conflito, e quem mais precisa bloquear é justamente
 *      quem menos pode pagar esse preço.
 *   3. **Vence a amizade e a comunidade em comum.** Uma porta aberta antes não pode continuar aberta
 *      depois que alguém a fechou.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let ana: ReturnType<typeof comToken>;
let zeca: ReturnType<typeof comToken>;
let anaId: number;
let zecaId: number;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const aAna = await criarConta(app, 'ana');
  const oZeca = await criarConta(app, 'zeca');
  ana = comToken(app, aAna.token);
  zeca = comToken(app, oZeca.token);
  anaId = aAna.user.id;
  zecaId = oZeca.user.id;
});

after(async () => fechar());

describe('bloquear', () => {
  it('a lista começa vazia', async () => {
    assert.deepEqual((await ana('GET', '/api/me/bloqueios')).json(), []);
  });

  it('DESFAZ a amizade que existia', async () => {
    // Sem isto sobraria um estado sem sentido: "amigo" de alguém com quem não se pode falar.
    await ana('POST', '/api/amigos', { username: 'zeca' });
    await zeca('POST', `/api/amigos/${anaId}/aceitar`);
    assert.equal((await ana('GET', '/api/amigos')).json().amigos.length, 1);

    assert.equal((await ana('POST', '/api/me/bloqueios', { userId: zecaId })).statusCode, 200);
    assert.deepEqual((await ana('GET', '/api/amigos')).json().amigos, []);
    assert.deepEqual((await zeca('GET', '/api/amigos')).json().amigos, [], 'sumiu só de um lado');
  });

  it('aparece na lista de quem bloqueou', async () => {
    const lista = (await ana('GET', '/api/me/bloqueios')).json();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].username, 'zeca');
  });

  it('QUEM FOI BLOQUEADO NÃO VÊ NADA: a lista dele continua vazia', async () => {
    assert.deepEqual((await zeca('GET', '/api/me/bloqueios')).json(), []);
  });

  it('fecha a conversa privada NOS DOIS SENTIDOS', async () => {
    // Os dois dividem a comunidade padrão, então sem o bloqueio a porta estaria aberta.
    assert.equal((await ana('POST', '/api/direct', { userIds: [zecaId] })).statusCode, 403);
    assert.equal(
      (await zeca('POST', '/api/direct', { userIds: [anaId] })).statusCode,
      403,
      'quem foi bloqueado ainda conseguiu abrir conversa',
    );
  });

  it('impede o pedido de amizade, com a MESMA mensagem de quem não existe', async () => {
    const bloqueado = await zeca('POST', '/api/amigos', { username: 'ana' });
    const inexistente = await zeca('POST', '/api/amigos', { username: 'ninguem-com-esse-nome' });

    assert.equal(bloqueado.statusCode, 404);
    assert.equal(
      bloqueado.json().error,
      inexistente.json().error,
      'a mensagem denuncia o bloqueio a quem foi bloqueado',
    );
  });

  it('bloquear duas vezes não estoura nem duplica', async () => {
    assert.equal((await ana('POST', '/api/me/bloqueios', { userId: zecaId })).statusCode, 200);
    assert.equal((await ana('GET', '/api/me/bloqueios')).json().length, 1);
  });

  it('não dá para bloquear a si mesmo, nem quem não existe', async () => {
    assert.equal((await ana('POST', '/api/me/bloqueios', { userId: anaId })).statusCode, 400);
    assert.equal((await ana('POST', '/api/me/bloqueios', { userId: 99999 })).statusCode, 404);
  });

  it('sem estar logado, nem lê nem bloqueia', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/me/bloqueios' })).statusCode, 401);
  });
});

describe('desbloquear', () => {
  it('reabre a conversa, mas NÃO devolve a amizade', async () => {
    assert.equal((await ana('DELETE', `/api/me/bloqueios/${zecaId}`)).statusCode, 200);
    assert.deepEqual((await ana('GET', '/api/me/bloqueios')).json(), []);

    // A porta volta a abrir pela comunidade em comum...
    assert.equal((await ana('POST', '/api/direct', { userIds: [zecaId] })).statusCode, 200);
    // ...mas a amizade continua desfeita: refazê-la é escolha das duas pessoas, de novo.
    assert.deepEqual((await ana('GET', '/api/amigos')).json().amigos, []);
  });

  it('desbloquear quem não estava bloqueado avisa, em vez de fingir que fez', async () => {
    assert.equal((await ana('DELETE', `/api/me/bloqueios/${zecaId}`)).statusCode, 404);
  });
});
