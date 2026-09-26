// Estes testes não cobrem código novo: cobrem o que o Syden já faz certo hoje e não pode deixar de fazer.
// Controle de acesso é o tipo de coisa que quebra em silêncio, numa refatoração inocente, e só aparece
// quando alguém lê a conversa de outra pessoa. Por isso está escrito aqui.
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;

/** A dona da comunidade, e alguém de fora que não foi convidado para ela. */
let dona: ReturnType<typeof comToken>;
let estranho: ReturnType<typeof comToken>;
let comunidadeId: number;
let canalId: number;
let convite: string;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());

  const ana = await criarConta(app, 'ana');
  const zeca = await criarConta(app, 'zeca');
  dona = comToken(app, ana.token);
  estranho = comToken(app, zeca.token);

  const comunidade = (await dona('POST', '/api/communities', { name: 'Clube da Ana' })).json();
  comunidadeId = comunidade.id;
  convite = comunidade.inviteCode;
  canalId = (await dona('POST', `/api/communities/${comunidadeId}/channels`, { name: 'segredos', type: 'text' })).json().id;
});
after(() => fechar());

describe('quem não é da comunidade', () => {
  it('não lista os canais dela', async () => {
    assert.equal((await estranho('GET', `/api/communities/${comunidadeId}/channels`)).statusCode, 404);
  });

  it('não lê as mensagens de um canal dela', async () => {
    assert.equal((await estranho('GET', `/api/channels/${canalId}/messages`)).statusCode, 404);
  });

  it('não pede token de voz para uma sala dela', async () => {
    const sala = (await dona('POST', `/api/communities/${comunidadeId}/channels`, { name: 'prosa', type: 'voice' })).json();
    assert.equal((await estranho('POST', `/api/channels/${sala.id}/voice-token`)).statusCode, 404);
    assert.equal((await estranho('POST', `/api/channels/${sala.id}/peek-token`)).statusCode, 404, 'nem para espiar');
  });

  it('não renomeia nem apaga canal dos outros', async () => {
    assert.equal((await estranho('PATCH', `/api/channels/${canalId}`, { name: 'invadido' })).statusCode, 404);
    assert.equal((await estranho('DELETE', `/api/channels/${canalId}`)).statusCode, 404);
  });

  it('responde "não encontrado", e não "sem permissão"', async () => {
    // A diferença importa: "sem permissão" confirmaria que a comunidade existe e tem esse canal.
    const resposta = await estranho('GET', `/api/communities/${comunidadeId}/channels`);
    assert.equal(resposta.statusCode, 404);
  });
});

describe('quem é da comunidade mas não manda nela', () => {
  it('entra, lê e escreve, mas não mexe na estrutura', async () => {
    const bia = await criarConta(app, 'bia');
    const membro = comToken(app, bia.token);

    assert.equal((await membro('POST', '/api/communities/join', { code: convite })).statusCode, 200);
    assert.equal((await membro('GET', `/api/communities/${comunidadeId}/channels`)).statusCode, 200, 'agora enxerga');

    const renomear = await membro('PATCH', `/api/channels/${canalId}`, { name: 'renomeado' });
    assert.equal(renomear.statusCode, 403, 'membro comum não renomeia canal que não criou');
  });
});

describe('painéis de dono', () => {
  it('não abrem para quem não administra o Syden', async () => {
    assert.equal((await estranho('GET', '/api/usage')).statusCode, 403);
    assert.equal((await estranho('GET', '/api/status')).statusCode, 403);
  });

  it('não deixam alguém se promover a administrador', async () => {
    const eu = (await estranho('GET', '/api/me')).json();
    assert.equal((await estranho('PUT', `/api/users/${eu.id}/admin`, { isAdmin: true })).statusCode, 403);
    assert.equal((await estranho('GET', '/api/me')).json().isAdmin, false, 'continua sem ser administrador');
  });
});
