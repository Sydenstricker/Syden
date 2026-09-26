/**
 * As rotas de entrar com Google/Discord. O porquê de cada passo está no alto de social.ts.
 *
 * Resumindo o caminho, que tem três idas e vindas:
 *
 *   1. POST /api/auth/social/inicio      o navegador diz o resumo do segredo dele e recebe um endereço
 *   2. GET  /api/auth/social/:p/volta    o provedor devolve o navegador aqui; o servidor resolve tudo
 *                                        e manda o navegador de volta ao site com um comprovante
 *   3. POST /api/auth/social/concluir    o site troca comprovante + segredo pelo token de verdade
 */
import type { FastifyInstance } from 'fastify';
import { signSession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import {
  buscarPerfil,
  ehProvedor,
  enderecoDeEntrada,
  ligado,
  nomeDisponivel,
  resumo,
  sortear,
  type Provedor,
} from './social.js';

/**
 * Quanto tempo uma ida ao Google pode demorar. Trinta minutos é folgado de propósito: a pessoa pode
 * precisar criar a conta do Google, confirmar em duas etapas, achar o celular. O que não pode é ficar
 * valendo para sempre — um comprovante esquecido é uma porta aberta.
 */
const VALIDADE_MS = 30 * 60_000;

function venceu(createdAt: string, agora = Date.now()): boolean {
  return agora - new Date(createdAt).getTime() > VALIDADE_MS;
}

/** Manda o navegador de volta ao site com um recado, quando alguma coisa deu errado no meio. */
function voltarComErro(motivo: string): string {
  return `${config.siteUrl}/?entrada=${encodeURIComponent(motivo)}`;
}

export function registerSocialRoutes(app: FastifyInstance) {
  /** Começa. O navegador manda o RESUMO do segredo dele; o segredo em si nunca sai de lá até o fim. */
  app.post<{ Body: { provedor?: string; desafio?: string } }>('/api/auth/social/inicio', async (request, reply) => {
    const provedor = request.body?.provedor;
    if (!ehProvedor(provedor) || !ligado(provedor)) {
      return reply.code(404).send({ error: 'Esse jeito de entrar não está disponível aqui.' });
    }
    const desafio = request.body?.desafio;
    // 43 é o tamanho de 32 bytes em base64url. Um "desafio" curto seria adivinhável, e aí a proteção
    // toda não valeria nada — é o único número que precisa ser conferido aqui.
    if (typeof desafio !== 'string' || desafio.length < 43 || desafio.length > 128) {
      return reply.code(400).send({ error: 'Pedido inválido.' });
    }

    const estado = sortear();
    db.criarEstadoSocial(estado, provedor, desafio);
    // Aproveita a passagem para varrer o que ficou pelo caminho, em vez de manter um relógio só para isso.
    db.limparEstadosSociais(new Date(Date.now() - VALIDADE_MS).toISOString());
    return { url: enderecoDeEntrada(provedor, estado) };
  });

  /**
   * O provedor devolve o navegador aqui. Esta rota NÃO responde JSON: ela redireciona, porque quem está
   * chegando é uma janela de navegador vinda do Google, e não o nosso app fazendo uma chamada.
   *
   * E ela NÃO ENTREGA O TOKEN. Entregar aqui é o furo do login CSRF: o link desta rota pode ser
   * plantado. O que sai daqui é um comprovante que só serve para quem tem o segredo do começo.
   */
  app.get<{ Params: { provedor: string }; Querystring: { code?: string; state?: string; error?: string } }>(
    '/api/auth/social/:provedor/volta',
    async (request, reply) => {
      const provedor = request.params.provedor;
      if (!ehProvedor(provedor) || !ligado(provedor)) return reply.code(404).send({ error: 'Não existe.' });

      // A pessoa clicou em "cancelar" na tela do Google: não é erro, é desistência.
      if (request.query.error) return reply.redirect(voltarComErro('cancelado'));

      const { code, state } = request.query;
      if (!code || !state) return reply.redirect(voltarComErro('incompleto'));

      const guardado = db.acharEstadoSocial(state);
      if (!guardado || guardado.provedor !== provedor || guardado.entrega || venceu(guardado.createdAt)) {
        // Estado que não existe, de outro provedor, já usado ou vencido. Tudo isso é a mesma resposta:
        // dizer QUAL dos casos é só ajudaria quem está tentando descobrir.
        return reply.redirect(voltarComErro('expirado'));
      }

      const perfil = await buscarPerfil(provedor, code);
      if (!perfil) {
        db.consumirEstadoSocial(state);
        return reply.redirect(voltarComErro('provedor'));
      }

      const userId = acharOuCriarConta(provedor, perfil);
      const entrega = sortear();
      db.guardarEntregaSocial(state, entrega, userId);
      return reply.redirect(`${config.siteUrl}/?entrada=ok&comprovante=${encodeURIComponent(entrega)}`);
    },
  );

  /** O site apresenta o comprovante E o segredo. Só aqui sai um token. */
  app.post<{ Body: { comprovante?: string; segredo?: string } }>('/api/auth/social/concluir', async (request, reply) => {
    const { comprovante, segredo } = request.body ?? {};
    if (typeof comprovante !== 'string' || typeof segredo !== 'string') {
      return reply.code(400).send({ error: 'Pedido inválido.' });
    }

    const guardado = db.acharEntregaSocial(comprovante);
    if (!guardado || guardado.userId === null || venceu(guardado.createdAt)) {
      return reply.code(400).send({ error: 'Essa entrada não vale mais. Tente entrar de novo.' });
    }

    // O CORAÇÃO DA COISA: o segredo tem que bater com o resumo deixado no começo. Quem plantou o link
    // de volta não tem o segredo — ele ficou no navegador de quem começou de verdade.
    if (resumo(segredo) !== guardado.resumo) {
      db.consumirEstadoSocial(guardado.state);
      return reply.code(403).send({ error: 'Essa entrada não é deste navegador.' });
    }

    db.consumirEstadoSocial(guardado.state);
    const user = db.findUserById(guardado.userId);
    if (!user) return reply.code(400).send({ error: 'Essa conta não existe mais.' });

    return { token: await signSession(user, db.sessionVersion(user.id)), user };
  });
}

/**
 * Acha a conta desta pessoa, ou cria uma. Três caminhos, nesta ordem:
 *
 *   1. Já ligou este provedor antes → é ela, sem dúvida nenhuma.
 *   2. O e-mail confirmado dos DOIS LADOS bate com uma conta existente → junta, e liga o provedor.
 *   3. Nada disso → conta nova.
 *
 * O passo 2 é o delicado, e a exigência de e-mail confirmado dos dois lados não é exagero: sem ela,
 * alguém cria uma conta no Syden com o SEU e-mail, nunca confirma, e espera. No dia em que você entra
 * com o Google, você cai dentro da conta dele — que ele também sabe a senha.
 */
function acharOuCriarConta(provedor: Provedor, perfil: { sub: string; email: string | null; emailVerificado: boolean; apelido: string }): number {
  const jaLigada = db.contaSocial(provedor, perfil.sub);
  if (jaLigada) return jaLigada;

  if (perfil.email && perfil.emailVerificado) {
    const existente = db.findUserByEmail(perfil.email);
    if (existente && db.emailDe(existente.id).verifiedAt) {
      db.ligarContaSocial(provedor, perfil.sub, existente.id);
      return existente.id;
    }
  }

  const nome = nomeDisponivel(perfil.apelido, (candidato) => db.findUserByName(candidato) !== undefined);
  // O e-mail só entra na conta nova quando o provedor confirmou: senão seria um endereço não conferido
  // ocupando o lugar, e atrapalhando a recuperação de senha depois.
  const user = db.createUserSemSenha(nome, perfil.emailVerificado ? perfil.email : null);
  db.ligarContaSocial(provedor, perfil.sub, user.id);
  return user.id;
}
