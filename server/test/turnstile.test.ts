// A verificação "isto é uma pessoa?" da Cloudflare.
//
// A decisão que este teste protege: se a Cloudflare NÃO RESPONDER, o cadastro é barrado. É o contrário
// do padrão da indústria, e foi escolha consciente do dono do Syden — deixar passar durante uma queda
// abriria justamente a janela que um enxame de robôs procura.
process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
process.env.TURNSTILE_SITE_KEY = 'chave-de-teste';

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { CONVITE, servidorDeTeste } from './ajuda.js';

let app: FastifyInstance;
let fechar: () => Promise<void>;
const fetchOriginal = globalThis.fetch;

before(async () => {
  process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
  process.env.TURNSTILE_SITE_KEY = 'chave-de-teste';
  ({ app, fechar } = await servidorDeTeste());
});

after(async () => {
  globalThis.fetch = fetchOriginal;
  await fechar();
});

/** Finge a resposta da Cloudflare, para o teste não depender da internet. */
function cloudflareResponde(comportamento: 'aprova' | 'recusa' | 'cai' | 'erro') {
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (!String(url).includes('challenges.cloudflare.com')) return fetchOriginal(url as never);
    if (comportamento === 'cai') throw new Error('sem rede');
    if (comportamento === 'erro') return new Response('ops', { status: 500 });
    return Response.json({ success: comportamento === 'aprova' });
  }) as typeof fetch;
}

const cadastrar = (username: string, turnstile?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password: 'segredo123', inviteCode: CONVITE, turnstile },
  });

describe('verificação de pessoa no cadastro', () => {
  it('a tela recebe a chave pública, para saber que deve mostrar o widget', async () => {
    const inicio = (await app.inject({ method: 'GET', url: '/api/inicio' })).json();
    assert.equal(inicio.turnstileSiteKey, 'chave-de-teste');
  });

  it('sem comprovante nenhum, não cadastra', async () => {
    cloudflareResponde('aprova');
    const r = await cadastrar('sem-prova');
    assert.equal(r.statusCode, 403);
  });

  it('com comprovante aprovado, cadastra normalmente', async () => {
    cloudflareResponde('aprova');
    const r = await cadastrar('gente', 'comprovante-bom');
    assert.equal(r.statusCode, 200);
  });

  it('com comprovante recusado, não cadastra', async () => {
    cloudflareResponde('recusa');
    const r = await cadastrar('robo', 'comprovante-ruim');
    assert.equal(r.statusCode, 403);
    assert.match(r.json().error, /pessoa/);
  });

  it('se a Cloudflare não responder, BARRA — e diz que o problema é nosso', async () => {
    cloudflareResponde('cai');
    const r = await cadastrar('durante-a-queda', 'comprovante-qualquer');
    assert.equal(r.statusCode, 503, 'barrado, e com código de indisponibilidade, não de recusa');
    assert.match(r.json().error, /fora do ar/, 'a pessoa não pode achar que foi confundida com robô');
    assert.doesNotMatch(r.json().error, /pessoa/, 'e não recebe a mensagem de recusa');
  });

  it('se a Cloudflare responder com erro, também barra', async () => {
    cloudflareResponde('erro');
    assert.equal((await cadastrar('durante-o-erro', 'comprovante-qualquer')).statusCode, 503);
  });

  it('a queda vira evento no painel de saúde, para não ficar invisível', async () => {
    const db = await import('../src/db.js');
    const eventos = db.listHealthEvents(20);
    assert.ok(
      JSON.stringify(eventos).includes('turnstile'),
      'sem registro, o dono não descobriria por que ninguém consegue se cadastrar',
    );
  });
});
