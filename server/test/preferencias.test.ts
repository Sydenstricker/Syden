/**
 * As preferências que seguem a pessoa entre navegadores.
 *
 * O que se prova aqui, em ordem de importância:
 *
 *   1. elas são DE CADA UM. Uma preferência que vaze para outra conta seria grave por si só, e aqui
 *      seria pior: dentro delas vão as anotações que alguém escreve sobre outras pessoas.
 *   2. o teto existe e recusa com o motivo escrito, em vez de engolir;
 *   3. excluir a conta apaga as anotações junto — é o que a política de privacidade promete.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

let ana: ReturnType<typeof comToken>;
let zeca: ReturnType<typeof comToken>;
let zecaId: number;
let token: string;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  const aAna = await criarConta(app, 'ana');
  const oZeca = await criarConta(app, 'zeca');
  ana = comToken(app, aAna.token);
  token = aAna.token;
  zeca = comToken(app, oZeca.token);
  zecaId = oZeca.user.id;
});

after(async () => fechar());

describe('preferências no servidor', () => {
  it('quem nunca guardou nada recebe o vazio, não um erro', async () => {
    const resposta = await ana('GET', '/api/me/preferencias');
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(resposta.json(), { preferencias: {}, em: null });
  });

  it('guarda e devolve o que foi guardado', async () => {
    await ana('PUT', '/api/me/preferencias', { tema: 'light', idioma: 'pt-BR', coelho: 'big' });
    const lido = (await ana('GET', '/api/me/preferencias')).json();
    assert.equal(lido.preferencias.tema, 'light');
    assert.equal(lido.preferencias.coelho, 'big');
    assert.ok(lido.em, 'faltou a data da última gravação');
  });

  it('guardar de novo substitui, não acumula', async () => {
    await ana('PUT', '/api/me/preferencias', { tema: 'dark' });
    const lido = (await ana('GET', '/api/me/preferencias')).json();
    assert.equal(lido.preferencias.tema, 'dark');
    // O idioma tinha sido guardado antes e não veio no pacote novo: some, como deve.
    assert.equal(lido.preferencias.idioma, undefined);
  });

  it('as preferências de uma pessoa não aparecem para outra', async () => {
    await ana('PUT', '/api/me/preferencias', { segredo: 'da ana' });
    const doZeca = (await zeca('GET', '/api/me/preferencias')).json();
    assert.equal(doZeca.preferencias.segredo, undefined);
  });

  it('sem estar logado, não lê nem escreve', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/api/me/preferencias' })).statusCode, 401);
    assert.equal(
      (await app.inject({ method: 'PUT', url: '/api/me/preferencias', payload: { a: 1 } })).statusCode,
      401,
    );
  });

  it('recusa o que não é objeto, dizendo por quê', async () => {
    // Enviado como JSON de verdade, e não pelo atalho do teste: mandar um array pelo atalho faz o
    // Fastify recusar antes (415, tipo de conteúdo), e aí o teste provaria o Fastify em vez da
    // validação que este arquivo escreveu.
    for (const corpo of ['[1,2,3]', '"texto solto"', '42', 'null']) {
      const resposta = await app.inject({
        method: 'PUT',
        url: '/api/me/preferencias',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: corpo,
      });
      assert.equal(resposta.statusCode, 400, `aceitou ${corpo}`);
      assert.ok(resposta.json().error, 'recusou sem dizer o motivo');
    }
  });

  it('recusa pacote grande demais: anotação é texto livre e cresce sem limite natural', async () => {
    const { LIMITE_BYTES } = await import('../src/preferencias.js');
    const gigante = { notas: 'a'.repeat(LIMITE_BYTES + 1) };
    const resposta = await ana('PUT', '/api/me/preferencias', gigante);
    assert.equal(resposta.statusCode, 400);
    assert.match(resposta.json().error, /KB/);

    // E o que já estava guardado continua lá: uma recusa não pode apagar nada.
    assert.equal((await ana('GET', '/api/me/preferencias')).json().preferencias.segredo, 'da ana');
  });

  it('excluir a conta apaga as anotações que ela guardava sobre outras pessoas', async () => {
    const db = await import('../src/db.js');
    await zeca('PUT', '/api/me/preferencias', { notas: { ana: 'anotação sobre a Ana' } });
    assert.ok(db.lerPreferencias(zecaId), 'não guardou antes de apagar');

    db.deleteAccount(zecaId);
    assert.equal(db.lerPreferencias(zecaId), null, 'a anotação sobreviveu à exclusão da conta');
  });
});
