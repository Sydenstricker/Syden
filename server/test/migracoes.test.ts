// As migrações que mexem em DADOS têm que rodar uma vez só. Rodar de novo pode desfazer uma escolha
// que a pessoa fez depois — no caso da medalha, devolver ao perfil uma insígnia que ela escondeu.
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

describe('registro de migrações', () => {
  it('anota o que rodou, com a data', async () => {
    const db = await import('../src/db.js');
    const aplicadas = db.migracoesAplicadas();
    assert.ok(Array.isArray(aplicadas));
    for (const m of aplicadas) {
      assert.ok(m.name, 'toda migração registrada tem nome');
      assert.ok(m.ranAt, 'e a hora em que rodou');
    }
  });

  it('a mesma migração não roda duas vezes', async () => {
    const db = await import('../src/db.js');
    const antes = db.migracoesAplicadas().length;

    // Quem tem a medalha e escolheu escondê-la não pode vê-la voltar sozinha ao perfil.
    const { token, password } = await criarConta(app, 'contribuinte');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();
    db.darItem(eu.id, 'ideia-acolhida', 'teste');
    db.definirVitrine(eu.id, []);
    void password;

    assert.deepEqual((await como('GET', '/api/me')).json().vitrine, [], 'escondeu a medalha');
    assert.equal(db.migracoesAplicadas().length, antes, 'nenhuma migração nova rodou por conta disso');
  });
});
