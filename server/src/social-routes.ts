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
import { requireUser } from './routes.js';
import * as db from './db.js';
import type { User } from './db.js';
import {
  buscarPerfil,
  conferirComASteam,
  ehOAuth,
  ehProvedor,
  enderecoDeEntrada,
  ligado,
  nomeDisponivel,
  perfilDaSteam,
  provedoresLigados,
  resumo,
  sortear,
  type PerfilSocial,
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

/**
 * PARA ONDE A PESSOA VOLTA no fim do caminho — e por que isso não é sempre o site.
 *
 * O segredo do fluxo (o que transforma o comprovante em token) fica guardado na janela que COMEÇOU a
 * entrada. Quando ela começa no app de desktop, devolver a pessoa ao site abre o navegador, que não
 * tem esse segredo: o Syden do app fica esperando para sempre, e o navegador mostra um erro que não
 * explica nada. Foi exatamente o que acontecia — entrar com Google simplesmente não funcionava no app.
 *
 * O `syden://` é um endereço que o Windows sabe entregar ao aplicativo instalado (ver
 * desktop/src/main.js). É o caminho que a norma para aplicativos nativos manda usar: o provedor abre
 * no navegador de verdade — que é o que o Google exige, e por isso não dá para embutir a página dele
 * numa janela nossa — e o resultado volta para o app por aqui.
 *
 * MAS NÃO DIRETO PARA O syden://, E SIM POR UMA PÁGINA NOSSA. Mandar o navegador direto fazia o Windows
 * perguntar "Permitir que https://api.syden.chat abra o link syden com Syden?" — o nome do servidor de
 * API, que ninguém reconhece, no meio de uma pergunta sobre deixar um site abrir um programa. E quando
 * o navegador barrava a tentativa (abrir programa sem clique é coisa que eles barram), sobrava uma aba
 * em branco e o app esperando para sempre. A página do meio resolve as duas: o nome que aparece passa a
 * ser o do site, e existe um botão para o caso de a tentativa automática não passar. Ver
 * web/site/voltar-para-o-app.html.
 *
 * SITE_URL PRECISA APONTAR PARA ONDE O SYDEN MORA (hoje https://syden.chat/app). Quando o app saiu da
 * raiz e ninguém mexeu nesta variável, tudo o que volta por aqui — e também os links dos e-mails de
 * confirmação e de recuperação — passou a cair na página de apresentação, que não faz nada com eles. A
 * página de apresentação hoje reencaminha esses endereços por segurança, mas isso é rede de proteção
 * para links antigos, não o caminho certo.
 */
function paraOndeVoltar(doApp: boolean): string {
  return doApp ? `${config.siteUrl}/voltar-para-o-app.html` : `${config.siteUrl}/`;
}

/** Manda de volta com um recado, quando alguma coisa deu errado no meio. */
function voltarComErro(motivo: string, doApp = false): string {
  return `${paraOndeVoltar(doApp)}?entrada=${encodeURIComponent(motivo)}`;
}

export function registerSocialRoutes(app: FastifyInstance) {
  /** Começa. O navegador manda o RESUMO do segredo dele; o segredo em si nunca sai de lá até o fim. */
  app.post<{ Body: { provedor?: string; desafio?: string; doApp?: boolean } }>(
    '/api/auth/social/inicio',
    async (request, reply) => {
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
    // Guardado AGORA, no começo, e não lido do pedido de volta: quem volta é o provedor, e nada do que
    // ele manda pode decidir para onde a pessoa vai parar.
    db.criarEstadoSocial(estado, provedor, desafio, undefined, request.body?.doApp === true);
    // Aproveita a passagem para varrer o que ficou pelo caminho, em vez de manter um relógio só para isso.
    db.limparEstadosSociais(new Date(Date.now() - VALIDADE_MS).toISOString());
    // O `estado` volta junto porque o app de desktop precisa dele para PERGUNTAR se já terminou (ver
    // /esperar). Não é segredo: ele viaja no endereço do provedor, que este mesmo cliente acabou de
    // receber. O que é segredo continua sendo o segredo, e esse nunca sai de lá.
    return { url: enderecoDeEntrada(provedor, estado), estado };
    },
  );

  /**
   * O provedor devolve o navegador aqui. Esta rota NÃO responde JSON: ela redireciona, porque quem está
   * chegando é uma janela de navegador vinda do Google, e não o nosso app fazendo uma chamada.
   *
   * E ela NÃO ENTREGA O TOKEN. Entregar aqui é o furo do login CSRF: o link desta rota pode ser
   * plantado. O que sai daqui é um comprovante que só serve para quem tem o segredo do começo.
   */
  app.get<{
    Params: { provedor: string };
    // A Steam devolve uma penca de campos "openid.*"; os outros três são do caminho OAuth.
    Querystring: Record<string, string | undefined> & { code?: string; state?: string; error?: string };
  }>(
    '/api/auth/social/:provedor/volta',
    async (request, reply) => {
      const provedor = request.params.provedor;
      if (!ehProvedor(provedor) || !ligado(provedor)) return reply.code(404).send({ error: 'Não existe.' });

      const { code, state } = request.query;

      /**
       * Descobre a origem cedo, para que até a desistência volte para o lugar certo.
       *
       * Sem isto, quem clicasse em "cancelar" na tela do Google dentro do app seria devolvido ao
       * navegador — e ficaria com duas janelas abertas sem entender qual delas é o Syden. O estado
       * ainda não foi validado aqui, e não precisa: só se está lendo de onde o fluxo começou, um dado
       * que o próprio servidor escreveu no início e que o provedor não tem como influenciar.
       */
      const origem = state ? db.acharEstadoSocial(state) : undefined;
      const veioDoApp = origem?.doApp === 1;

      /**
       * O MOTIVO FICA GUARDADO, e não só escrito no endereço de volta.
       *
       * Quem começou pelo app não lê esse endereço: quem lê é o navegador, e o app está do outro lado
       * perguntando ao servidor se já acabou. Sem anotar, a desistência no Google seria, para o app,
       * indistinguível de uma espera que ainda não terminou — e ele esperaria os trinta minutos
       * inteiros por uma resposta que não vem mais.
       */
      const anotarFalha = (motivo: string) => {
        if (origem && state) db.marcarFalhaSocial(state, motivo);
      };

      // A pessoa clicou em "cancelar" na tela do Google: não é erro, é desistência.
      if (request.query.error) {
        anotarFalha('cancelado');
        return reply.redirect(voltarComErro('cancelado', veioDoApp));
      }
      // No caminho OAuth faltar o "code" já é o fim. Na Steam não existe "code" nenhum: o que precisa
      // estar lá são os campos assinados, e quem confere isso é a própria Steam, logo abaixo.
      if (!state || (ehOAuth(provedor) && !code)) return reply.redirect(voltarComErro('incompleto', veioDoApp));

      const guardado = origem;
      // `falha` entra na lista pelo mesmo motivo de `entrega`: estado que já terminou, de um jeito ou
      // de outro, não serve de novo. Sem isso, uma segunda volta com o mesmo estado passaria direto.
      if (!guardado || guardado.provedor !== provedor || guardado.entrega || guardado.falha || venceu(guardado.createdAt)) {
        // Estado que não existe, de outro provedor, já usado ou vencido. Tudo isso é a mesma resposta:
        // dizer QUAL dos casos é só ajudaria quem está tentando descobrir.
        return reply.redirect(voltarComErro('expirado', veioDoApp));
      }

      // O motivo de ter dado errado vai para o registro do servidor. Do lado de quem tentou entrar a
      // mensagem é sempre a mesma e sempre vaga, de propósito; do lado de dentro, precisa ser específica,
      // senão não há como descobrir em qual dos passos parou.
      const anotar = (motivo: string) => request.log.warn({ provedor }, `entrada social falhou: ${motivo}`);
      const doApp = veioDoApp;
      const perfil = ehOAuth(provedor)
        ? await buscarPerfil(provedor, code!, anotar)
        : await perfilDaSteamConferida(request.query, anotar);
      if (!perfil) {
        anotarFalha('provedor');
        return reply.redirect(voltarComErro('provedor', doApp));
      }

      const entrega = sortear();

      if (guardado.ligarUserId !== null) {
        // Ligando numa conta que já existe. A conta do provedor não pode estar pendurada em OUTRA conta
        // do Syden: duas contas com a mesma entrada seria uma porta que ninguém sabe para onde leva.
        const jaEDe = db.donoDaContaSocial(provedor, perfil.sub);
        if (jaEDe && jaEDe.id !== guardado.ligarUserId) {
          anotarFalha('jaligada');
          return reply.redirect(voltarComErro('jaligada', doApp));
        }
        // A ligação em si só acontece lá no "concluir", depois de o segredo bater. Aqui só se anota o
        // que foi descoberto: sem essa espera, quem plantasse o link de volta penduraria a conta DELE
        // na conta de outra pessoa — e passaria a entrar nela para sempre.
        db.guardarEntregaSocial(state, entrega, null, perfil.sub);
        return reply.redirect(`${paraOndeVoltar(doApp)}?entrada=ligar&comprovante=${encodeURIComponent(entrega)}`);
      }

      db.guardarEntregaSocial(state, entrega, acharOuCriarConta(provedor, perfil));
      return reply.redirect(`${paraOndeVoltar(doApp)}?entrada=ok&comprovante=${encodeURIComponent(entrega)}`);
    },
  );

  /** O site apresenta o comprovante E o segredo. Só aqui sai um token. */
  app.post<{ Body: { comprovante?: string; segredo?: string } }>('/api/auth/social/concluir', async (request, reply) => {
    const { comprovante, segredo } = request.body ?? {};
    if (typeof comprovante !== 'string' || typeof segredo !== 'string') {
      return reply.code(400).send({ error: 'Pedido inválido.' });
    }

    const guardado = db.acharEntregaSocial(comprovante);
    if (!guardado || !resolvida(guardado) || venceu(guardado.createdAt)) {
      return reply.code(400).send({ error: 'Essa entrada não vale mais. Tente entrar de novo.' });
    }

    const feito = await trocarPelaSessao(guardado, segredo, 'navegador');
    if (feito.tipo === 'erro') return reply.code(feito.codigo).send({ error: feito.mensagem });
    return feito.corpo;
  });

  /**
   * A ESPERA: o app pergunta se a entrada já terminou, em vez de esperar que o navegador o abra.
   *
   * POR QUE ISTO EXISTE. O caminho anterior devolvia a pessoa por `syden://`, e o Windows perguntava se
   * o site podia abrir o programa. Essa pergunta é do sistema, não nossa, e não tem como ser removida —
   * mas ela só existe porque alguém de FORA precisa abrir o app. Aqui ninguém abre nada: o app, que já
   * está aberto e já tem o segredo, pergunta de tempos em tempos se terminou. Quando terminou, ele
   * entra sozinho e traz a própria janela para frente. Depois do "ok" no Google não sobra pergunta
   * nenhuma, que é como deveria ter sido desde o começo.
   *
   * A SEGURANÇA É EXATAMENTE A DO /concluir, e é por isso que a troca é a mesma função: o que prova ser
   * o mesmo aparelho continua sendo o segredo, que nunca saiu de lá. Quem soubesse o `estado` — ele
   * viaja no endereço do provedor — não conseguiria nada sem ele.
   *
   * E ela não conta o que não precisa: enquanto não terminou, a resposta é sempre "esperando", sem
   * dizer se aquele estado existe, de quem é, ou em que passo está.
   */
  app.post<{ Body: { estado?: string; segredo?: string } }>('/api/auth/social/esperar', async (request, reply) => {
    const { estado, segredo } = request.body ?? {};
    if (typeof estado !== 'string' || typeof segredo !== 'string' || estado.length > 128 || segredo.length > 128) {
      return reply.code(400).send({ error: 'Pedido inválido.' });
    }

    const guardado = db.acharEstadoSocial(estado);
    // Estado que não existe e estado vencido dão a MESMA resposta: um dos dois casos é alguém chutando
    // estados, e dizer qual é seria confirmar o chute.
    if (!guardado || venceu(guardado.createdAt)) return { situacao: 'expirado' };

    // Deu errado no provedor, ou a pessoa desistiu: o motivo ficou guardado esperando esta pergunta.
    if (guardado.falha) {
      db.consumirEstadoSocial(estado);
      return { situacao: guardado.falha };
    }

    if (!guardado.entrega || !resolvida(guardado)) return { situacao: 'esperando' };

    const feito = await trocarPelaSessao(guardado, segredo, 'aparelho');
    if (feito.tipo === 'erro') return reply.code(feito.codigo).send({ error: feito.mensagem });
    return { situacao: feito.corpo.ligado ? 'ligar' : 'ok', ...feito.corpo };
  });

  // ---------- Ligar e desligar, estando dentro ----------

  app.register(async (dentro) => {
    dentro.addHook('preHandler', requireUser);

    /** O que já está ligado, e se ainda existe senha. A tela precisa das duas coisas juntas. */
    dentro.get('/api/me/social', async (request) => ({
      ligados: db.contasSociaisDe(request.user.id),
      possiveis: provedoresLigados(),
      temSenha: db.temSenha(request.user.id),
    }));

    /**
     * Começa a ida ao provedor para LIGAR nesta conta.
     *
     * É este pedido, autenticado, que decide em qual conta a ligação vai cair — e não nada que venha do
     * provedor depois. Deixar isso para a volta seria deixar quem planta um link escolher a conta.
     */
    dentro.post<{ Body: { provedor?: string; desafio?: string } }>('/api/me/social/inicio', async (request, reply) => {
      const provedor = request.body?.provedor;
      if (!ehProvedor(provedor) || !ligado(provedor)) {
        return reply.code(404).send({ error: 'Esse jeito de entrar não está disponível aqui.' });
      }
      const desafio = request.body?.desafio;
      if (typeof desafio !== 'string' || desafio.length < 43 || desafio.length > 128) {
        return reply.code(400).send({ error: 'Pedido inválido.' });
      }
      const estado = sortear();
      db.criarEstadoSocial(estado, provedor, desafio, request.user.id);
      db.limparEstadosSociais(new Date(Date.now() - VALIDADE_MS).toISOString());
      return { url: enderecoDeEntrada(provedor, estado) };
    });

    /**
     * Desliga um provedor.
     *
     * **Nunca o último jeito de entrar.** Sem esta conferência, quem criou a conta pelo Google e nunca
     * pôs senha desligaria o Google e ficaria trancado do lado de fora da própria conta, sem nenhum
     * caminho de volta — nem a recuperação por e-mail resolveria, porque ela devolve uma senha para uma
     * conta que não tem porta de senha.
     */
    dentro.delete<{ Params: { provedor: string } }>('/api/me/social/:provedor', async (request, reply) => {
      const provedor = request.params.provedor;
      if (!ehProvedor(provedor)) return reply.code(404).send({ error: 'Esse jeito de entrar não existe.' });

      const ligados = db.contasSociaisDe(request.user.id);
      if (!ligados.includes(provedor)) return reply.code(404).send({ error: 'Esse jeito de entrar não está ligado nesta conta.' });
      if (!db.temSenha(request.user.id) && ligados.length === 1) {
        return reply.code(409).send({
          error: 'Esse é o seu único jeito de entrar. Defina uma senha, ou ligue outro serviço, antes de desligar este.',
        });
      }

      db.desligarContaSocial(provedor, request.user.id);
      return { ligados: db.contasSociaisDe(request.user.id) };
    });
  });
}

/** O que o provedor já resolveu: uma conta para entrar, ou uma conta de lá para ligar nesta daqui. */
interface Entrega {
  state: string;
  provedor: string;
  resumo: string;
  userId: number | null;
  ligarUserId: number | null;
  sub: string | null;
  createdAt: string;
}

/** O provedor já respondeu e já se sabe de quem é? Antes disso não há o que trocar. */
function resolvida(entrega: Entrega): boolean {
  return entrega.userId !== null || (entrega.ligarUserId !== null && entrega.sub !== null);
}

/**
 * Troca o que o provedor resolveu por uma sessão — apresentando o segredo.
 *
 * É UMA FUNÇÃO SÓ, usada pelo /concluir (navegador) e pelo /esperar (app), e isso é de propósito: são
 * dois jeitos de fazer a mesma pergunta, e a conferência não pode ser parecida nos dois, tem de ser a
 * mesma. Uma cópia com uma linha a menos seria uma porta a mais, e ninguém notaria.
 *
 * `onde` só muda a palavra da mensagem de recusa ("deste navegador" / "deste aparelho"), porque é o que
 * a pessoa reconhece do lado de lá.
 */
async function trocarPelaSessao(
  guardado: Entrega,
  segredo: string,
  onde: 'navegador' | 'aparelho',
): Promise<{ tipo: 'erro'; codigo: number; mensagem: string } | { tipo: 'feito'; corpo: { token?: string; user?: User; ligado?: string } }> {
  // O CORAÇÃO DA COISA: o segredo tem que bater com o resumo deixado no começo. Quem plantou o link de
  // volta não tem o segredo — ele ficou em quem começou de verdade.
  if (resumo(segredo) !== guardado.resumo) {
    db.consumirEstadoSocial(guardado.state);
    return { tipo: 'erro', codigo: 403, mensagem: `Essa entrada não é ${onde === 'navegador' ? 'deste navegador' : 'deste aparelho'}.` };
  }

  db.consumirEstadoSocial(guardado.state);

  // Ligação: a pessoa já está dentro, e o que sai daqui não é token nenhum.
  if (guardado.ligarUserId !== null && guardado.sub !== null) {
    const dono = db.findUserById(guardado.ligarUserId);
    if (!dono) return { tipo: 'erro', codigo: 400, mensagem: 'Essa conta não existe mais.' };
    const jaEDe = db.donoDaContaSocial(guardado.provedor, guardado.sub);
    if (jaEDe && jaEDe.id !== dono.id) {
      return { tipo: 'erro', codigo: 409, mensagem: `Essa conta já está ligada ao usuário ${jaEDe.username} aqui no Syden.` };
    }
    db.ligarContaSocial(guardado.provedor, guardado.sub, dono.id);
    return { tipo: 'feito', corpo: { ligado: guardado.provedor } };
  }

  const user = db.findUserById(guardado.userId!);
  if (!user) return { tipo: 'erro', codigo: 400, mensagem: 'Essa conta não existe mais.' };

  return { tipo: 'feito', corpo: { token: await signSession(user, db.sessionVersion(user.id)), user } };
}

/**
 * A volta da Steam, conferida com ela antes de valer qualquer coisa.
 *
 * A Steam devolve o navegador com o número da conta escrito na própria URL. Aceitar isso de cara seria
 * o mesmo que aceitar um crachá feito em casa: qualquer pessoa monta o endereço à mão dizendo ser
 * qualquer conta. Por isso tudo é mandado de volta para a Steam com a pergunta 'isto saiu de você?',
 * e só a resposta dela vale.
 */
async function perfilDaSteamConferida(
  query: Record<string, string | undefined>,
  anotar: (motivo: string) => void,
): Promise<PerfilSocial | null> {
  const steamId = await conferirComASteam(query);
  if (!steamId) {
    anotar('a Steam não confirmou esta volta');
    return null;
  }
  return perfilDaSteam(steamId);
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
