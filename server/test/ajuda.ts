import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

/** O código de convite que os testes usam para criar contas. */
export const CONVITE = 'convite-de-teste';

/**
 * Sobe o servidor inteiro em memória, com um banco novo em branco, e devolve o `app` para bater nas rotas
 * com `app.inject()` — sem abrir porta, sem LiveKit no ar e sem sujar o banco de desenvolvimento.
 *
 * O banco é escolhido por variável de ambiente ANTES de importar o código do servidor, porque o db.ts abre
 * o arquivo no momento em que é importado. Por isso o import aqui é dinâmico, e por isso cada arquivo de
 * teste ganha o seu próprio processo (é assim que o `node --test` roda) e o seu próprio banco.
 */
export async function servidorDeTeste() {
  const arquivo = join(tmpdir(), `syden-teste-${randomUUID()}.db`);
  process.env.DATABASE_PATH = arquivo;
  process.env.INVITE_CODE = CONVITE;
  process.env.LOG_LEVEL = 'silent';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  // Todos os pedidos de teste chegam do mesmo endereço (127.0.0.1). Sem afrouxar o freio, o próprio
  // arquivo de teste se trancaria do lado de fora no meio do caminho. Quem testa o freio aperta de volta.
  process.env.FREIO_TENTATIVAS_POR_ENDERECO ??= '10000';
  process.env.FREIO_EMAILS_POR_ENDERECO ??= '10000';
  process.env.FREIO_EMAILS_POR_CAIXA ??= '10000';

  const { buildApp } = await import('../src/app.js');
  const { app, io } = await buildApp({ background: false });
  await app.ready();

  return {
    app,
    async fechar() {
      io.close();
      await app.close();
      for (const sufixo of ['', '-wal', '-shm']) {
        try {
          rmSync(arquivo + sufixo);
        } catch {
          // No Windows o arquivo pode continuar preso ao processo; é só lixo em pasta temporária.
        }
      }
    },
  };
}

/** Cria uma conta e devolve o token dela, que é o que as rotas autenticadas pedem. */
export async function criarConta(app: FastifyInstance, username: string, password = 'segredo123') {
  const resposta = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password, inviteCode: CONVITE },
  });
  if (resposta.statusCode !== 200) throw new Error(`não consegui criar ${username}: ${resposta.body}`);
  const { token, user } = resposta.json();
  return { token, user, password };
}

/** Atalho para um pedido autenticado. */
export function comToken(app: FastifyInstance, token: string) {
  return (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload !== undefined && { payload }) });
}
