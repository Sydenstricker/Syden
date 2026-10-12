/**
 * A busca do soundboard também olha os pacotes que a pessoa ainda não instalou (11/10/2026): achar o som
 * num pacote e oferecer instalar ali mesmo. Esta rota entrega só os nomes desses sons, e só dos pacotes que
 * FALTAM — instalou, sai da lista, porque aí o som já está no soundboard.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let db: typeof import('../src/db.js');

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
});

after(async () => {
  await fechar();
});

describe('sons dos pacotes que faltam', () => {
  it('lista o que está nos pacotes não instalados, e para de listar ao instalar', async () => {
    const pessoa = await criarConta(app, 'quembusca');
    const pedido = comToken(app, pessoa.token);
    const pacote = db.createPack('Futebol', 'gritos de gol', '⚽', null, false);
    db.createPackSound(pacote, 'Gol do Brasil', '⚽', 'audio/ogg', Buffer.from('OggS-gol'));

    const antes = (await pedido('GET', '/api/packs/sons-que-faltam')).json() as { name: string; packName: string; packId: number }[];
    const gol = antes.find((s) => s.name === 'Gol do Brasil');
    assert.ok(gol, 'o som do pacote não instalado aparece');
    assert.equal(gol!.packName, 'Futebol');

    assert.equal((await pedido('POST', `/api/packs/${pacote}/install`)).statusCode, 200);
    const depois = (await pedido('GET', '/api/packs/sons-que-faltam')).json() as { name: string }[];
    assert.ok(!depois.some((s) => s.name === 'Gol do Brasil'), 'instalado, ele sai da lista: já está no soundboard');
  });
});
