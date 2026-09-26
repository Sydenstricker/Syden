import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

before(async () => {
  // Aqui o freio sob teste é o de endereço, então ele vem apertado. Este arquivo roda no seu próprio
  // processo (é assim que o `node --test` trabalha), então o contador não se mistura com o dos outros.
  process.env.FREIO_TENTATIVAS_POR_ENDERECO = '12';
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

describe('enxurrada de pedidos do mesmo lugar', () => {
  it('corta o excesso antes de gastar processador conferindo senha', async () => {
    // Este é o freio que impede que uma enxurrada de tentativas ocupe o servidor inteiro e engasgue a voz
    // de quem está em chamada: conferir uma senha custa ~0,1 s de propósito, e 20 por segundo já doem.
    // Um nome diferente a cada vez, que é como um ataque distribuído se parece — e assim quem barra é
    // mesmo o freio de endereço, não o de conta.
    const situacoes: number[] = [];
    for (let i = 0; i < 20; i++) {
      const r = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: `seja-quem-for-${i}`, password: 'x' } });
      situacoes.push(r.statusCode);
    }

    assert.equal(situacoes.filter((s) => s !== 429).length, 12, 'doze passam, o resto é segurado');
    assert.ok(
      situacoes.slice(12).every((s) => s === 429),
      'depois de estourar, continua segurando até a janela virar',
    );
  });

  it('o freio vale também para o cadastro, não só para o login', async () => {
    // Sem isto, dava para criar conta atrás de conta e encher o banco.
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'depois-da-enxurrada', password: 'segredo123', inviteCode: 'convite-de-teste' },
    });
    assert.equal(r.statusCode, 429);
  });
});
