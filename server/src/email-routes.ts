/**
 * Confirmar o e-mail e recuperar a senha.
 *
 * Três cuidados guiam o que está escrito aqui:
 *
 * 1. **"Esqueci a senha" NUNCA conta se a conta existe.** A resposta é a mesma para endereço cadastrado e
 *    para endereço que ninguém usa. Caso contrário, a tela vira um consultório: qualquer um descobre quem
 *    tem conta no Syden só digitando endereços.
 * 2. **O código vai embora com o e-mail e some do servidor.** No banco fica só o resumo dele, como a senha.
 * 3. **Trocar a senha por recuperação derruba as sessões abertas.** É o caso clássico de "alguém entrou na
 *    minha conta": não adianta a senha nova se a sessão do invasor continuar valendo.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { hashPassword } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import { enviarEmail, envioConfigurado, mensagemDeRecuperacao, mensagemDeVerificacao } from './email.js';
import { Freio } from './freio.js';
import { requireUser } from './routes.js';

/** Endereço com cara de endereço. A conferência de verdade é o link que chega na caixa. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const VALIDADE = { verificar: 24 * 60 * 60_000, recuperar: 60 * 60_000 };

const resumo = (codigo: string) => createHash('sha256').update(codigo).digest('hex');

function novoCodigo(userId: number, kind: db.TipoDeCodigo) {
  const codigo = randomBytes(32).toString('base64url');
  db.guardarCodigo(userId, kind, resumo(codigo), new Date(Date.now() + VALIDADE[kind]).toISOString());
  return codigo;
}

const linkDe = (kind: db.TipoDeCodigo, codigo: string) =>
  `${config.siteUrl}/?${kind === 'verificar' ? 'confirmar' : 'recuperar'}=${codigo}`;

export function registerEmailRoutes(app: FastifyInstance) {
  // Mandar e-mail custa dinheiro e incomoda quem recebe: dois freios, por endereço de rede e por conta.
  const freioDeEnvio = new Freio(config.freio.emailsPorEndereco, 15 * 60_000);
  const freioPorAlvo = new Freio(config.freio.emailsPorCaixa, 60 * 60_000);

  /** Monta e manda. Devolve o link só fora de produção, para os testes seguirem o fluxo sem caixa de entrada. */
  async function mandar(userId: number, nome: string, para: string, kind: db.TipoDeCodigo) {
    const codigo = novoCodigo(userId, kind);
    const link = linkDe(kind, codigo);
    const corpo = kind === 'verificar' ? mensagemDeVerificacao(nome, link) : mensagemDeRecuperacao(nome, link);
    const resultado = await enviarEmail({ para, ...corpo });
    return { resultado, link: process.env.NODE_ENV === 'production' ? undefined : link };
  }

  // ---------- Quem já está dentro: pôr e confirmar o endereço ----------

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/me/email', async (request) => ({
      ...db.emailDe(request.user.id),
      /** Falso = os e-mails ficam só no registro do servidor. A tela avisa, em vez de prometer o que não vai. */
      envioLigado: envioConfigurado(),
    }));

    /**
     * Trocar o e-mail pede a senha atual. Sem isso, um computador deixado aberto vira conta perdida: o
     * endereço é a chave da recuperação, então trocá-lo é tão grave quanto trocar a senha.
     */
    authed.put<{ Body: { email?: string; password?: string } }>('/api/me/email', async (request, reply) => {
      const email = (request.body?.email ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return reply.code(400).send({ error: 'Esse endereço de e-mail não parece válido.' });

      const { verifyPassword } = await import('./auth.js');
      if (!(await verifyPassword(request.body?.password ?? '', db.findPasswordHash(request.user.id)))) {
        return reply.code(400).send({ error: 'A senha está incorreta.' });
      }

      const dono = db.findUserByEmail(email);
      if (dono && dono.id !== request.user.id) {
        return reply.code(409).send({ error: 'Esse e-mail já está em outra conta.' });
      }
      if (freioDeEnvio.tentar(request.ip)) {
        return reply.code(429).send({ error: 'Muitos pedidos seguidos. Espere alguns minutos.' });
      }

      db.definirEmail(request.user.id, email);
      const { resultado, link } = await mandar(request.user.id, request.user.username, email, 'verificar');
      return { ok: true, email, enviado: resultado.enviado, rascunho: resultado.rascunho, link };
    });

    /** Pedir o link de confirmação de novo. */
    authed.post('/api/me/email/reenviar', async (request, reply) => {
      const { email, verifiedAt } = db.emailDe(request.user.id);
      if (!email) return reply.code(400).send({ error: 'Você ainda não cadastrou um e-mail.' });
      if (verifiedAt) return { ok: true, jaConfirmado: true };
      if (freioDeEnvio.tentar(request.ip) || freioPorAlvo.tentar(email)) {
        return reply.code(429).send({ error: 'Já mandamos há pouco. Olhe a sua caixa de entrada e o spam.' });
      }
      const { resultado, link } = await mandar(request.user.id, request.user.username, email, 'verificar');
      return { ok: true, enviado: resultado.enviado, rascunho: resultado.rascunho, link };
    });

    authed.delete('/api/me/email', async (request) => {
      db.definirEmail(request.user.id, null);
      return { ok: true };
    });
  });

  // ---------- Sem estar logado: confirmar o endereço e recuperar a senha ----------

  app.post<{ Body: { codigo?: string } }>('/api/auth/confirmar-email', async (request, reply) => {
    const userId = db.usarCodigo('verificar', resumo(String(request.body?.codigo ?? '')));
    if (userId === null) return reply.code(400).send({ error: 'Este link já foi usado ou venceu. Peça outro pelo app.' });
    db.marcarEmailVerificado(userId);
    return { ok: true };
  });

  /**
   * "Esqueci a senha". Responde sempre a mesma coisa, exista ou não a conta.
   * Também não distingue endereço confirmado de não confirmado — mandar para um endereço que a pessoa
   * cadastrou mas não confirmou é justamente o caso de quem esqueceu a senha antes de confirmar.
   */
  app.post<{ Body: { email?: string } }>('/api/auth/esqueci', async (request, reply) => {
    const email = (request.body?.email ?? '').trim().toLowerCase();
    const resposta = { ok: true, aviso: 'Se existir uma conta com esse e-mail, o link de recuperação chegou lá.' };

    if (!EMAIL_RE.test(email)) return resposta;
    if (freioDeEnvio.tentar(request.ip)) {
      return reply.code(429).send({ error: 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.' });
    }
    // O freio por endereço evita usar o Syden para encher a caixa de outra pessoa — e, como a resposta é
    // sempre a mesma, nem isso conta se a conta existe.
    if (freioPorAlvo.tentar(email)) return resposta;

    const user = db.findUserByEmail(email);
    if (!user) return resposta;

    const { link } = await mandar(user.id, user.username, email, 'recuperar');
    return process.env.NODE_ENV === 'production' ? resposta : { ...resposta, link };
  });

  /** Escolher a senha nova com o código do e-mail. */
  app.post<{ Body: { codigo?: string; novaSenha?: string } }>('/api/auth/recuperar', async (request, reply) => {
    const nova = request.body?.novaSenha ?? '';
    if (nova.length < 6) return reply.code(400).send({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });

    const userId = db.usarCodigo('recuperar', resumo(String(request.body?.codigo ?? '')));
    if (userId === null) return reply.code(400).send({ error: 'Este link já foi usado ou venceu. Peça outro.' });

    db.updatePassword(userId, await hashPassword(nova));
    // Quem recupera a senha costuma estar fazendo isso porque perdeu o controle da conta: toda sessão
    // aberta em qualquer aparelho cai junto.
    db.bumpSessionVersion(userId);
    // Quem provou ter acesso à caixa de entrada confirmou o endereço, na prática.
    db.marcarEmailVerificado(userId);
    return { ok: true };
  });
}
