/**
 * Quem pode convidar. Decidido em 03/10/2026: CONVIDAR É DE TODO MEMBRO, TROCAR O CÓDIGO NÃO.
 *
 * Trocar derruba de uma vez todos os links já espalhados — é a ferramenta de quando o convite vazou,
 * e por isso fica com quem administra.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { comToken, criarConta, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
let dona: ReturnType<typeof comToken>;
let membro: ReturnType<typeof comToken>;
let comunidadeId: number;
let convite: string;

before(async () => {
  ({ app, fechar } = await servidorDeTeste());
  dona = comToken(app, (await criarConta(app, 'dona')).token);
  membro = comToken(app, (await criarConta(app, 'membro')).token);
  const comunidade = (await dona('POST', '/api/communities', { name: 'Clube' })).json();
  comunidadeId = comunidade.id;
  convite = comunidade.inviteCode;
  assert.equal((await membro('POST', '/api/communities/join', { code: convite })).statusCode, 200);
});
after(() => fechar());

const daLista = async (quem: ReturnType<typeof comToken>) =>
  ((await quem('GET', '/api/communities')).json() as { id: number; inviteCode: string | null }[]).find((c) => c.id === comunidadeId);

describe('o convite da comunidade', () => {
  it('um membro comum recebe o código, para poder chamar gente', async () => {
    assert.equal((await daLista(membro))?.inviteCode, convite);
  });

  it('mas trocar o código continua só com quem administra', async () => {
    const resposta = await membro('POST', `/api/communities/${comunidadeId}/invite`);
    assert.equal(resposta.statusCode, 403);
    assert.equal((await daLista(membro))?.inviteCode, convite, 'o código não pode ter mudado');
  });

  it('quando quem administra troca, o membro passa a receber o novo', async () => {
    const novo = (await dona('POST', `/api/communities/${comunidadeId}/invite`)).json().inviteCode;
    assert.notEqual(novo, convite);
    assert.equal((await daLista(membro))?.inviteCode, novo);
  });
});
