/**
 * Os pacotes de som que vinham de fábrica eram todos áudio de terceiros. Desde 03/10/2026 eles são
 * pacotes da conta de quem cuida do Syden, como qualquer pacote que alguém monta (ver
 * src/expressions.ts). O que este arquivo segura:
 *
 *   1. a entrega acontece uma vez, sem tirar o pacote de quem já tinha instalado;
 *   2. conta nova não ganha pacote nenhum de presente — senão o Syden voltava a ser quem distribui.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
// Dinâmicos: importar o banco antes de servidorDeTeste() abriria o de desenvolvimento (ver ajuda.ts).
let db: typeof import('../src/db.js');
let entregarPacotesDeFabrica: typeof import('../src/expressions.js').entregarPacotesDeFabrica;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  db = await import('../src/db.js');
  ({ entregarPacotesDeFabrica } = await import('../src/expressions.js'));
});

after(async () => {
  await fechar();
});

describe('pacotes que vinham de fábrica', () => {
  it('passam para a conta dona, uma vez só, e quem tinha instalado continua com eles', async () => {
    const dona = await criarConta(app, 'dona');
    const outra = await criarConta(app, 'outra');
    const donaId = db.findOwner()!.id;
    assert.equal(donaId, dona.user.id, 'a primeira conta é a dona');

    const antigo = db.createPack('Meme antigo', 'de fábrica', '😂', null, true);
    db.installPack(antigo, outra.user.id);

    entregarPacotesDeFabrica();
    const depois = db.findPack(antigo, outra.user.id)!;
    assert.equal(depois.builtin, false);
    assert.equal(depois.createdBy, donaId);
    assert.equal(depois.installed, true, 'quem tinha instalado não pode perder o pacote');

    // Rodar de novo (toda subida roda) não mexe em nada.
    entregarPacotesDeFabrica();
    assert.equal(db.findPack(antigo, outra.user.id)!.createdBy, donaId);
  });

  it('conta nova começa sem pacote nenhum instalado', async () => {
    const nova = await criarConta(app, 'novata');
    const instalados = db.listPacks(nova.user.id).filter((p) => p.installed);
    assert.deepEqual(instalados, []);
  });
});
