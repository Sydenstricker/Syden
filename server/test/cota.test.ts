// O teto de arquivos por pessoa. Não é defesa contra enxame de robôs — para isso existe o Turnstile —,
// é o limite do estrago que UMA conta sozinha consegue fazer no disco da máquina.
process.env.COTA_POR_PESSOA_MB = '1';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

/** Um PNG de verdade, do tamanho pedido: o servidor confere a assinatura dos bytes antes de aceitar. */
function pngDe(bytes: number): string {
  const cabecalho = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return 'data:image/png;base64,' + Buffer.concat([cabecalho, Buffer.alloc(Math.max(0, bytes - 8), 1)]).toString('base64');
}

before(async () => {
  process.env.COTA_POR_PESSOA_MB = '1';
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('teto de arquivos por pessoa', () => {
  it('conta nova começa sem ocupar nada', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'nova');
    const eu = (await comToken(app, token)('GET', '/api/me')).json();
    assert.equal(db.espacoUsado(eu.id), 0);
  });

  it('o que a pessoa sobe passa a contar contra o teto dela', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'ocupada');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();

    const antes = db.espacoUsado(eu.id);
    await como('PUT', '/api/me/avatar', { image: pngDe(20_000) });
    assert.ok(db.espacoUsado(eu.id) > antes, 'o avatar ocupa espaço da conta');
  });

  it('e o espaço de uma não conta para a outra', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'vizinha');
    const eu = (await comToken(app, token)('GET', '/api/me')).json();
    assert.equal(db.espacoUsado(eu.id), 0, 'o avatar da outra pessoa não pesa aqui');
  });

  it('estourado o teto, o servidor recusa e explica o que fazer', async () => {
    const db = await import('../src/db.js');
    const { token } = await criarConta(app, 'cheia');
    const como = comToken(app, token);
    const eu = (await como('GET', '/api/me')).json();

    // Ocupa mais de 1 MB direto no banco, que é o teto deste teste.
    db.setAvatar(eu.id, { mime: 'image/png', data: Buffer.alloc(1_200_000, 7) });
    assert.ok(db.espacoUsado(eu.id) > 1024 * 1024);

    const recusado = await como('PUT', '/api/me/avatar', { image: pngDe(10_000) });
    assert.equal(recusado.statusCode, 413);
    assert.match(recusado.json().error, /MB/, 'a mensagem diz o tamanho do teto');
    assert.match(recusado.json().error, /liberar espaço/, 'e diz o que fazer a respeito');
  });
});
