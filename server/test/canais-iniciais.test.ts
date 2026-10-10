/**
 * Os canais que uma comunidade nova ganha nascem no idioma de quem a cria.
 *
 * Eram sempre "geral", "jogos", "Sala 1" e "Sala 2": quem criava uma comunidade com o Syden em inglês ganhava canais
 * em português (relato de 09/10/2026). A tela manda os quatro nomes já traduzidos; o servidor os passa pela mesma
 * regra de qualquer canal (texto em minúsculas e hífens) e, sem nome ou com um inválido, fica o português.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let contas = 0;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
});
after(() => fechar());

// Uma conta nova a cada caso: cada pessoa tem um limite de comunidades criadas.
async function canaisDe(corpo: Record<string, unknown>) {
  const ana = comToken(app, (await criarConta(app, `ana-canais-${++contas}`)).token);
  const comunidade = (await ana('POST', '/api/communities', corpo)).json() as { id: number };
  const canais = (await ana('GET', `/api/communities/${comunidade.id}/channels`)).json() as { name: string; type: string }[];
  return canais.map((c) => `${c.type}:${c.name}`);
}

describe('canais iniciais', () => {
  it('nascem com os nomes que a tela mandou, no idioma de quem cria', async () => {
    assert.deepEqual(await canaisDe({ name: 'Friends', canais: ['general', 'Video Games', 'Room 1', 'Room 2'] }), [
      'text:general',
      'text:video-games',
      'voice:Room 1',
      'voice:Room 2',
    ]);
  });

  it('sem nomes, ficam em português, como antes', async () => {
    assert.deepEqual(await canaisDe({ name: 'Amigos' }), ['text:geral', 'text:jogos', 'voice:Sala 1', 'voice:Sala 2']);
  });

  it('um nome inválido ou que não é texto cai no português daquela posição, sem derrubar os outros', async () => {
    assert.deepEqual(await canaisDe({ name: 'Misto', canais: ['', 42, 'x'.repeat(51), 'Raum 2'] }), [
      'text:geral',
      'text:jogos',
      'voice:Sala 1',
      'voice:Raum 2',
    ]);
  });
});
