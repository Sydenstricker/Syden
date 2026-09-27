/**
 * Amizades.
 *
 * Três coisas se provam aqui, e as duas últimas são as que causariam estrago em silêncio:
 *
 *   1. o ciclo funciona: pedir, aparecer para os dois lados, aceitar, desfazer;
 *   2. quem pediu NÃO aceita o próprio pedido — senão qualquer um vira amigo de qualquer um sozinho;
 *   3. esta é a única rota do Syden que procura outra conta PELO NOME, e ela não pode virar um
 *      consultor de "essa pessoa existe?" para quem quiser varrer o alfabeto.
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

describe('o ciclo de uma amizade', () => {
  it('começa vazia', async () => {
    const { amigos } = (await ana('GET', '/api/amigos')).json();
    assert.deepEqual(amigos, []);
  });

  it('o pedido aparece dos dois lados, com o sentido certo em cada um', async () => {
    assert.equal((await ana('POST', '/api/amigos', { username: 'zeca' })).statusCode, 200);

    const daAna = (await ana('GET', '/api/amigos')).json().amigos;
    assert.equal(daAna.length, 1);
    assert.equal(daAna[0].username, 'zeca');
    assert.equal(daAna[0].situacao, 'pendente');
    assert.equal(daAna[0].euPedi, true, 'a Ana pediu, então para ela euPedi tem de ser verdadeiro');

    const doZeca = (await zeca('GET', '/api/amigos')).json().amigos;
    assert.equal(doZeca[0].username, 'ana');
    assert.equal(doZeca[0].euPedi, false, 'o Zeca recebeu, não pediu');
  });

  it('pedir de novo não cria uma segunda linha, nem invertido', async () => {
    assert.equal((await ana('POST', '/api/amigos', { username: 'zeca' })).statusCode, 409);
    // O caso perigoso: o Zeca pedindo de volta. Sem a ordem fixa do par, isto viraria outra linha.
    assert.equal((await zeca('POST', '/api/amigos', { username: 'ana' })).statusCode, 409);
    assert.equal((await ana('GET', '/api/amigos')).json().amigos.length, 1);
  });

  it('QUEM PEDIU NÃO ACEITA O PRÓPRIO PEDIDO', async () => {
    const resposta = await ana('POST', `/api/amigos/${zecaId}/aceitar`);
    assert.equal(resposta.statusCode, 404, 'a Ana aceitou o pedido que ela mesma fez');
    assert.equal((await ana('GET', '/api/amigos')).json().amigos[0].situacao, 'pendente');
  });

  it('quem recebeu aceita, e vira amizade para os dois', async () => {
    assert.equal((await zeca('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 200);
    assert.equal((await ana('GET', '/api/amigos')).json().amigos[0].situacao, 'aceita');
    assert.equal((await zeca('GET', '/api/amigos')).json().amigos[0].situacao, 'aceita');
  });

  it('aceitar duas vezes não faz nada', async () => {
    assert.equal((await zeca('POST', `/api/amigos/${anaId}/aceitar`)).statusCode, 404);
  });

  it('desfazer some dos dois lados', async () => {
    assert.equal((await ana('DELETE', `/api/amigos/${zecaId}`)).statusCode, 200);
    assert.deepEqual((await ana('GET', '/api/amigos')).json().amigos, []);
    assert.deepEqual((await zeca('GET', '/api/amigos')).json().amigos, []);
  });
});

describe('procurar alguém pelo nome não pode virar uma varredura', () => {
  it('nome que não existe e pedido repetido dão a MESMA mensagem', async () => {
    const inexistente = await ana('POST', '/api/amigos', { username: 'ninguem-com-esse-nome' });
    await ana('POST', '/api/amigos', { username: 'zeca' });
    const repetido = await ana('POST', '/api/amigos', { username: 'zeca' });

    assert.equal(
      inexistente.json().error,
      repetido.json().error,
      'as mensagens diferem, e a diferença conta a um estranho se a conta existe',
    );
  });

  it('não dá para pedir amizade a si mesmo', async () => {
    assert.equal((await ana('POST', '/api/amigos', { username: 'ana' })).statusCode, 404);
  });

  it('nome vazio é recusado antes de qualquer busca', async () => {
    assert.equal((await ana('POST', '/api/amigos', { username: '   ' })).statusCode, 400);
  });

  it('sem estar logado, nem lê nem pede', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/amigos' })).statusCode, 401);
    assert.equal(
      (await app.inject({ method: 'POST', url: '/api/amigos', payload: { username: 'ana' } })).statusCode,
      401,
    );
  });
});

describe('sugestões', () => {
  it('só sugere quem divide comunidade — nunca o Syden inteiro', async () => {
    const db = await import('../src/db.js');
    const bia = await criarConta(app, 'bia');

    // Recém-criada, a Bia cai na comunidade padrão junto com todo mundo — e aí ela É uma sugestão
    // legítima, porque as duas se veem na lista de membros.
    const antes = (await ana('GET', '/api/amigos')).json().sugestoes;
    assert.ok(antes.some((s: { username: string }) => s.username === 'bia'));

    // Tirando-a de todas as comunidades, ela vira uma estranha. É ISTO que a regra protege: sem o
    // filtro, o Syden entregaria a existência de contas desconhecidas a quem nunca as viu.
    for (const c of db.listCommunitiesForUser(bia.user.id)) db.removeMember(c.id, bia.user.id);

    const depois = (await ana('GET', '/api/amigos')).json().sugestoes;
    assert.ok(
      !depois.some((s: { username: string }) => s.username === 'bia'),
      'sugeriu alguém que não divide nenhuma comunidade',
    );
  });

  it('toda sugestão divide pelo menos uma comunidade', async () => {
    const { sugestoes } = (await ana('GET', '/api/amigos')).json();
    for (const s of sugestoes) assert.ok(s.emComum >= 1, `${s.username} apareceu sem comunidade em comum`);
  });

  it('quem já tem pedido pendente sai das sugestões', async () => {
    const { sugestoes } = (await ana('GET', '/api/amigos')).json();
    assert.ok(!sugestoes.some((s: { userId: number }) => s.userId === zecaId));
  });
});
