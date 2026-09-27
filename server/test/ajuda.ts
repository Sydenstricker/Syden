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
  process.env.FREIO_CADASTROS_POR_DIA ??= '10000';
  // A confirmação de e-mail segue o envio, que nos testes não existe. Aqui ela é FORÇADA, para os
  // testes exercitarem a regra de verdade sem precisar de caixa de entrada — o link volta na resposta.
  process.env.EXIGIR_CONFIRMACAO_EMAIL ??= 'sim';

  const { buildApp } = await import('../src/app.js');

  // PARA-RAIOS. O config.ts lê DATABASE_PATH no PRIMEIRO import de qualquer módulo do servidor e
  // congela o valor. Se o arquivo de teste importou alguma coisa do servidor antes de chamar isto — e
  // basta um import que pareça inofensivo, porque quase todos arrastam o config junto —, o banco aberto
  // é o DE DESENVOLVIMENTO. O teste passa, e só se descobre quando um nome de usuário colide dias
  // depois. Aconteceu de verdade. Melhor estourar aqui, com o motivo escrito.
  const { config } = await import('../src/config.js');
  if (config.databasePath !== arquivo) {
    throw new Error(
      `O banco aberto é ${config.databasePath}, e não o de teste.
` +
        `Alguma coisa do servidor foi importada ANTES de servidorDeTeste(). Ponha o import dele primeiro,
` +
        `e os outros depois — inclusive os que não parecem mexer com banco.`,
    );
  }
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

/**
 * Cria uma conta PRONTA PARA USAR e devolve o token dela.
 *
 * São três passos, e não um, porque cadastro agora exige e-mail confirmado: criar, abrir o link de
 * confirmação e entrar. Fora de produção o servidor devolve o link na própria resposta, justamente
 * para o teste poder seguir o caminho sem caixa de entrada — em produção ele nunca sai de lá.
 *
 * Os testes que querem exercitar a confirmação em si não usam esta função: chamam as rotas na mão.
 */
export async function criarConta(app: FastifyInstance, username: string, password = 'segredo123') {
  const cadastro = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password, email: `${username}@exemplo.teste`, inviteCode: CONVITE },
  });
  if (cadastro.statusCode !== 200) throw new Error(`não consegui criar ${username}: ${cadastro.body}`);

  const codigo = codigoDoLink(cadastro.json().link);
  const confirmada = await app.inject({ method: 'POST', url: '/api/auth/confirmar-email', payload: { codigo } });
  if (confirmada.statusCode !== 200) throw new Error(`não consegui confirmar ${username}: ${confirmada.body}`);

  const entrada = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
  if (entrada.statusCode !== 200) throw new Error(`não consegui entrar como ${username}: ${entrada.body}`);
  const { token, user } = entrada.json();
  return { token, user, password };
}

/** O código dentro do link de confirmação (…/?confirmar=XXXX). */
export function codigoDoLink(link: string | undefined): string {
  const codigo = link ? new URL(link).searchParams.get('confirmar') : null;
  if (!codigo) throw new Error('a resposta não trouxe o link de confirmação: ' + link);
  return codigo;
}

/** Atalho para um pedido autenticado. */
export function comToken(app: FastifyInstance, token: string) {
  return (method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, ...(payload !== undefined && { payload }) });
}
