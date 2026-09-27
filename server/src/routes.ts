import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { Server as IOServer } from 'socket.io';
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import { Freio } from './freio.js';
import { installDefaultPack, seedExpressions } from './expressions.js';
import {
  anunciarPerfil,
  channelRoom,
  communityRoom,
  directRoom,
  disconnectUser,
  emitToUser,
  joinCommunityRoom,
  leaveCommunityRoom,
  removeVoiceChannelMembers,
} from './realtime.js';
import { healthReport, recordClientError } from './health.js';
import { LIMITE_DA_VITRINE, conferirPresentes } from './presentes.js';
import { pessoaDeVerdade, turnstileLigado } from './turnstile.js';
import { providerMetrics } from './provider.js';
import { apagarAviso, avisoDeAgora, avisoGuardado, guardarAviso, lerAviso } from './aviso.js';
import { lerServidor, TETO_POR_COMUNIDADE } from './jogos.js';
import { CATALOGO, podeVestir } from './loja.js';
import { mandarCodigo } from './email-routes.js';
import { provedoresLigados } from './social.js';
import { audiencia } from './audiencia.js';
import { disponibilidade } from './uptime.js';
import { usageSummary } from './usage.js';

/** Cliente de administração do LiveKit: é por ele que o servidor silencia alguém na sala. */
const rooms = new RoomServiceClient(config.livekit.url.replace(/^ws/, 'http'), config.livekit.apiKey, config.livekit.apiSecret);

const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

export function voiceRoomName(channelId: number) {
  return `channel-${channelId}`;
}

/** Canais de texto seguem o padrão do Discord: minúsculas e hífens no lugar de espaços. */
function channelName(raw: string | undefined, type: db.ChannelType): string | null {
  const name = raw?.trim() ?? '';
  if (name.length < 1 || name.length > 50) return null;
  return type === 'text' ? name.toLowerCase().replace(/\s+/g, '-') : name;
}

function communityName(raw: unknown): string | null {
  const name = String(raw ?? '').trim();
  return name.length >= 2 && name.length <= 40 ? name : null;
}

/**
 * Cargo da pessoa NAQUELA comunidade, ou undefined se ela não participa.
 *
 * Quem administra o Syden inteiro NÃO vira administrador das comunidades alheias por tabela. Antes virava,
 * e para um grupo de amigos era só conveniente; num Syden com gente de fora, é o operador do serviço com
 * poder dentro do espaço dos outros — renomear canais, trocar convites, mexer nos emojis de uma comunidade
 * que não é dele. O poder de operador continua existindo, mas só onde precisa mesmo (tirar do ar conteúdo
 * ilegal, excluir conta), é pedido explicitamente por `poderDeOperador` e fica registrado na auditoria.
 */
export function roleIn(user: db.User, communityId: number): db.Role | undefined {
  return db.memberRole(communityId, user.id);
}

/**
 * O poder de quem cuida do Syden, para o que é obrigação de quem opera o serviço e não pode depender do
 * dono de uma comunidade estar acordado. Todo uso é registrado: é isso que separa "moderação" de "abuso".
 */
export function poderDeOperador(user: db.User, action: string, sobre: { target?: string; communityId?: number | null; detail?: string }) {
  if (!user.isAdmin) return false;
  db.registrarAuditoria({ actor: user, action, ...sobre });
  return true;
}

export const manages = (role: db.Role | undefined) => role === 'owner' || role === 'admin';

/** Canal que pertence a uma comunidade (ou seja, não é conversa privada). */
export type CommunityChannel = db.Channel & { communityId: number };

/**
 * Quem pode ler e escrever num canal: nos canais de comunidade, quem participa dela; nas conversas
 * privadas, só quem está na conversa.
 */
export function canUseChannel(user: db.User, channel: db.Channel): boolean {
  return channel.communityId === null ? db.isChannelMember(channel.id, user.id) : roleIn(user, channel.communityId) !== undefined;
}

const NOT_MEMBER = 'Você não participa desta comunidade.';

function removeAccount(io: IOServer, userId: number) {
  db.deleteAccount(userId);
  disconnectUser(io, userId);
  // Os apps tiram a pessoa das listas e apagam as mensagens dela da tela.
  io.emit('user:deleted', { id: userId });
}

declare module 'fastify' {
  interface FastifyRequest {
    user: db.User;
  }
}

/**
 * Já responde 413 e devolve true quando a pessoa encheu a parte dela do disco.
 *
 * Fica numa função só, chamada por toda rota que aceita arquivo, para o teto não valer em umas e em
 * outras não — a conta que quisesse abusar procuraria justamente a que ficou de fora.
 */
export function cotaEsgotada(request: FastifyRequest, reply: FastifyReply): boolean {
  const usado = db.espacoUsado(request.user.id);
  if (usado < config.cotaPorPessoaBytes) return false;
  const mb = Math.round(config.cotaPorPessoaBytes / 1024 / 1024);
  reply.code(413).send({
    error: `Você já usa os ${mb} MB de arquivos que cabem por pessoa. Apague algum anexo, som ou emoji antigo para liberar espaço.`,
  });
  return true;
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  const sessao = await verifySession(token);
  const achado = sessao === null ? undefined : db.findUserForSession(sessao.userId);
  // O número da sessão precisa bater com o do banco: é assim que trocar a senha (ou mandar sair de todos
  // os aparelhos) derruba na hora um token que já está no computador de alguém.
  if (!achado || achado.sessionVersion !== sessao!.sessionVersion) {
    return reply.code(401).send({ error: 'Sessão inválida. Entre novamente.' });
  }
  request.user = achado.user;
}

export function registerRoutes(app: FastifyInstance, io: IOServer) {
  app.decorateRequest('user', null as unknown as db.User);

  /** Endereço com cara de endereço. A conferência de verdade é o link que chega na caixa. */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

  app.get('/api/health', async () => ({ ok: true }));

  /**
   * O que a tela de entrada precisa saber antes de alguém ter conta. Hoje é só uma coisa: se o cadastro
   * está aberto a qualquer pessoa ou se exige convite — sem isso, a tela pediria um código obrigatório
   * num Syden aberto, ou ofereceria cadastro livre num que vai recusar.
   *
   * Não conta nada que já não se descubra tentando criar uma conta.
   */
  app.get('/api/inicio', async () => ({
    cadastroAberto: config.cadastroAberto,
    turnstileSiteKey: config.turnstile.siteKey || null,
    // Quando esta versão do servidor foi construída. Vai na rota pública de propósito: é assim que dá
    // para conferir de fora se o servidor já pegou a atualização, sem entrar nele.
    construidoEm: config.construidoEm || null,
    // O recado geral vai aqui, e não numa rota própria, porque esta é a chamada que a tela de entrada
    // já faz: assim ele chega em quem NÃO CONSEGUE ENTRAR, que é justamente quem mais precisa dele.
    aviso: avisoDeAgora(),
    // Só os que têm as duas chaves configuradas: um botão do Google sem chave levaria a um erro.
    social: provedoresLigados(),
  }));

  // Freios das portas caras. O de endereço protege o SERVIDOR: conferir uma senha custa ~0,1 s de
  // processador de propósito, então uma enxurrada de tentativas engasga a voz de quem está em chamada.
  // O de conta protege UMA PESSOA de quem tenta adivinhar a senha dela a partir de vários lugares —
  // e conta só os erros, para que entrar certo muitas vezes nunca tranque ninguém do lado de fora.
  const freioPorEndereco = new Freio(config.freio.tentativasPorEndereco, 60_000);
  const freioPorConta = new Freio(config.freio.errosPorConta, 15 * 60_000);
  const freioDeCadastro = new Freio(config.freio.cadastrosPorDia, 24 * 60 * 60_000);

  /** Já responde 429 e devolve true quando este endereço está batendo demais. */
  function enderecoFreado(request: FastifyRequest, reply: FastifyReply): boolean {
    const espera = freioPorEndereco.tentar(request.ip);
    if (!espera) return false;
    reply.header('retry-after', String(espera)).code(429).send({
      error: `Muitas tentativas seguidas. Espere ${espera} segundo${espera === 1 ? '' : 's'} e tente de novo.`,
    });
    return true;
  }

  app.post<{ Body: { username?: string; password?: string; email?: string; inviteCode?: string; turnstile?: string } }>(
    '/api/auth/register',
    async (request, reply) => {
      if (enderecoFreado(request, reply)) return reply;
      const username = request.body?.username?.trim() ?? '';
      const password = request.body?.password ?? '';
      const email = request.body?.email?.trim().toLowerCase() ?? '';
      const code = request.body?.inviteCode?.trim() ?? '';
      // Fechado por padrão: ou o código geral do Syden, ou o convite de alguma comunidade. Cadastro aberto
      // para qualquer pessoa da internet só acontece se estiver escrito CADASTRO_ABERTO=sim no .env.
      const convidado =
        config.cadastroAberto || (!!config.inviteCode && code === config.inviteCode) || !!db.findCommunityByInvite(code);
      if (!convidado) return reply.code(403).send({ error: 'Código de convite inválido.' });

      // A prova de que é gente, quando o Turnstile está configurado. Fica antes de gastar processador
      // com a senha e antes de escrever qualquer coisa no banco.
      if (turnstileLigado()) {
        const veredito = await pessoaDeVerdade(request.body?.turnstile, request.ip);
        // Fora do ar é diferente de recusado, e a pessoa merece saber qual dos dois foi: mandar alguém
        // "provar que não é robô de novo" quando o problema é nosso só gera tentativa em vão.
        if (veredito === 'indisponivel') {
          return reply.code(503).send({ error: 'A verificação de segurança está fora do ar. Tente de novo daqui a alguns minutos.' });
        }
        if (veredito === 'recusado') {
          return reply.code(403).send({ error: 'Não deu para confirmar que você é uma pessoa. Recarregue a página e tente de novo.' });
        }
      }

      // Teto diário do endereço. Só é conferido aqui, depois do convite, para quem tem código não ser
      // barrado por causa de um robô que veio da mesma rede.
      if (freioDeCadastro.bloqueado(request.ip)) {
        return reply.code(429).send({ error: 'Muitas contas criadas deste lugar hoje. Tente amanhã ou peça um convite.' });
      }
      if (!USERNAME_RE.test(username)) {
        return reply.code(400).send({ error: 'Nome de usuário deve ter 2 a 32 letras, números, _ . ou -.' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
      }
      if (db.findUserByName(username)) {
        return reply.code(409).send({ error: 'Esse nome de usuário já está em uso.' });
      }
      if (!EMAIL_RE.test(email)) {
        return reply.code(400).send({ error: 'Escreva um e-mail válido: é por ele que você confirma a conta.' });
      }
      // Dois cadastros no mesmo endereço fariam duas contas disputando a mesma recuperação de senha —
      // e a de e-mail confirmado seria juntada ao provedor social, deixando a outra órfã.
      if (db.findUserByEmail(email)) {
        return reply.code(409).send({ error: 'Já existe uma conta com esse e-mail. Entre por ela, ou use "Esqueci a minha senha".' });
      }

      /*
       * DOIS PORTÕES DIFERENTES, e é isso que permite crescer sem abrir a casa dos outros:
       *
       *   1. ter conta no Syden  — pode ser aberto a qualquer pessoa (CADASTRO_ABERTO=sim);
       *   2. entrar numa comunidade — sempre por convite de quem já está lá.
       *
       * É como o Discord funciona, e é o contrário do que o Syden fazia: sem código válido, a pessoa
       * caía na comunidade padrão. Com o cadastro aberto, isso despejaria todo estranho da internet
       * dentro da primeira comunidade — a dos amigos de quem montou o servidor.
       *
       * Quem chega sem convite fica sem comunidade nenhuma e vê a tela de "você ainda não participa de
       * nenhuma": pode criar a sua ou entrar com um código depois.
       */
      const convidadoPara = code ? db.findCommunityByInvite(code) : undefined;
      const temEspaco = convidadoPara && db.countMembers(convidadoPara.id) < config.maxMembersPerCommunity;

      // Nasce PRECISANDO CONFIRMAR: é o que separa "alguém digitou um endereço" de "alguém tem acesso
      // àquela caixa", e é o que garante que toda conta nova tenha recuperação de senha funcionando.
      //
      // Mas só quando o e-mail de fato sai daqui. Sem envio configurado, exigir confirmação trancaria
      // a conta e jogaria fora a chave — ver o comentário em config.email.exigirConfirmacao.
      const exigir = config.email.exigirConfirmacao;
      const user = db.createUser(username, await hashPassword(password), email, exigir);
      installDefaultPack(user.id); // soundboard já começa com o pacote básico do Syden

      if (!db.defaultCommunity()) {
        // Primeiro cadastro do Syden inteiro: ganha a comunidade inicial.
        const community = db.createCommunity('Syden', user.id, config.inviteCode || db.newInviteCode());
        seedExpressions(community.id);
      } else if (temEspaco) {
        db.addMember(convidadoPara.id, user.id);
        io.to(communityRoom(convidadoPara.id)).emit('member:updated', {
          communityId: convidadoPara.id,
          member: { ...user, role: 'member' },
        });
      }
      // Conta só o que deu certo: quem errou o nome de usuário três vezes não gasta o dia inteiro.
      freioDeCadastro.tentar(request.ip);
      conferirPresentes(user); // conta nova entre as 25 primeiras já sai com a insígnia esperando

      // O link de confirmação sai de qualquer jeito: mesmo sem exigência, ter o e-mail confirmado é o
      // que faz a recuperação de senha funcionar no dia em que ela for precisa.
      const { link } = await mandarCodigo(user.id, user.username, email, 'verificar');

      // Exigindo confirmação, NENHUM TOKEN SAI DAQUI: a conta existe, mas só abre depois que a pessoa
      // clicar no link. Sem exigência, o cadastro entra na hora, como antes.
      if (exigir) return { precisaConfirmar: true, email, link };
      return { token: await signSession(user, 1), user, link };
    },
  );

  /**
   * Reenviar o link de confirmação para quem ainda não entrou.
   *
   * Precisa existir sem login: quem não confirmou não consegue entrar, então não teria como pedir de
   * dentro. E precisa ser cuidadosa por isso mesmo — é uma porta que faz o servidor MANDAR E-MAIL a
   * pedido de qualquer um. Por isso: freio por endereço de rede, e a RESPOSTA É SEMPRE A MESMA, exista
   * a conta ou não. Sem isso, a tela viraria um consultório para descobrir quem tem conta no Syden.
   */
  app.post<{ Body: { username?: string } }>('/api/auth/reenviar-confirmacao', async (request, reply) => {
    if (enderecoFreado(request, reply)) return reply;
    const mesmaResposta = { ok: true, aviso: 'Se essa conta existir e ainda não estiver confirmada, o link acabou de sair.' };

    const nome = request.body?.username?.trim() ?? '';
    const achado = nome ? db.findUserByName(nome) : undefined;
    if (!achado || !db.precisaConfirmar(achado.id)) return mesmaResposta;

    const { email } = db.emailDe(achado.id);
    if (!email) return mesmaResposta;

    const { link } = await mandarCodigo(achado.id, achado.username, email, 'verificar');
    return { ...mesmaResposta, link };
  });

  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    if (enderecoFreado(request, reply)) return reply;
    const nome = request.body?.username?.trim() ?? '';
    const chave = nome.toLowerCase();

    const espera = freioPorConta.bloqueado(chave);
    if (espera) {
      const minutos = Math.ceil(espera / 60);
      return reply
        .header('retry-after', String(espera))
        .code(429)
        .send({
          error: `Senha errada vezes demais nesta conta. Tente de novo em ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
        });
    }

    const found = db.findUserByName(nome);
    if (!found || !(await verifyPassword(request.body?.password ?? '', found.passwordHash))) {
      freioPorConta.tentar(chave);
      return reply.code(401).send({ error: 'Usuário ou senha incorretos.' });
    }
    freioPorConta.liberar(chave); // quem sabe a senha não é quem estava tentando adivinhar

    // Cadastrou e não confirmou: a conta existe, a senha está certa, e mesmo assim não entra. Vale só
    // para quem nasceu com a exigência — conta antiga e conta de provedor nunca caem aqui.
    if (db.precisaConfirmar(found.id)) {
      return reply.code(403).send({
        error: 'Falta confirmar o seu e-mail. Abra o link que enviamos para entrar.',
        precisaConfirmar: true,
      });
    }

    const { passwordHash: _, ...user } = found;
    conferirPresentes(user); // ganhou alguma insígnia enquanto estava fora? chega agora
    return { token: await signSession(user, db.sessionVersion(found.id)), user };
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /**
     * O recado geral do Syden, escrito por quem administra e visto por todo mundo — inclusive por quem
     * ainda não entrou. Fica no banco, e não numa variável de ambiente, para poder ser ligado e
     * desligado pela tela: é no meio de uma manutenção que menos se quer reiniciar o servidor de novo.
     */
    const soQuemAdministra = (request: { user: db.User }, reply: FastifyReply) =>
      request.user.isAdmin
        ? null
        : reply.code(403).send({ error: 'Só quem administra o Syden escreve o recado geral.' });

    authed.get('/api/aviso', async (request, reply) => {
      if (soQuemAdministra(request, reply)) return reply;
      // Devolve o GUARDADO, e não o que está valendo: quem vai editar precisa ver o que escreveu
      // antes, mesmo que a hora já tenha passado e o recado tenha sumido da tela dos outros.
      return { aviso: avisoGuardado(), valendo: avisoDeAgora() !== null };
    });

    authed.put('/api/aviso', async (request, reply) => {
      if (soQuemAdministra(request, reply)) return reply;
      const lido = lerAviso(request.body);
      if ('erro' in lido) return reply.code(400).send({ error: lido.erro });
      guardarAviso(lido.aviso);
      poderDeOperador(request.user, 'aviso.escrito', { detail: lido.aviso.texto });
      return { aviso: lido.aviso, valendo: avisoDeAgora() !== null };
    });

    authed.delete('/api/aviso', async (request, reply) => {
      if (soQuemAdministra(request, reply)) return reply;
      apagarAviso();
      poderDeOperador(request.user, 'aviso.apagado', {});
      return { aviso: null, valendo: false };
    });

    // Abrir o Syden também confere: quem já estava logado (o app de desktop fica aberto dias) não fica
    // esperando o próximo login para receber o que passou a ter direito.
    authed.get('/api/me', async (request) => {
      const novos = conferirPresentes(request.user);
      return novos.length ? db.findUserById(request.user.id) : request.user;
    });

    // Enfeites do perfil. O servidor não conhece as cores: guarda o nome da opção e confia no app para
    // desenhar — assim dá para acrescentar cor nova sem tocar no banco. Só limita o tamanho do texto.
    authed.put<{ Body: { nameColor?: string | null; banner?: string | null; moldura?: string | null } }>(
      '/api/me/profile',
      async (request, reply) => {
        const limpa = (valor: unknown) => (typeof valor === 'string' && valor.length > 0 && valor.length <= 24 ? valor : null);
        const nameColor = limpa(request.body?.nameColor);
        const banner = limpa(request.body?.banner);
        const moldura = limpa(request.body?.moldura);

        // Antes a rota aceitava qualquer texto curto e confiava no app para só mandar o que existe.
        // Agora que há item que se GANHA, confiar no app deixou de servir: um pedido feito à mão
        // vestiria a insígnia dos 25 primeiros em quem chegou ontem. Quem decide é o servidor.
        const tem = db.codigosDoInventario(request.user.id);
        const errado =
          (!podeVestir(nameColor, 'cor', tem) && 'cor') ||
          (!podeVestir(banner, 'fundo', tem) && 'fundo') ||
          (!podeVestir(moldura, 'moldura', tem) && 'moldura');
        if (errado) return reply.code(403).send({ error: 'Esse item de ' + errado + ' não é seu.' });

        const user = db.setProfile(request.user.id, { nameColor, banner, moldura });
        io.emit('user:updated', user);
        return user;
      },
    );

    authed.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
      '/api/me/password',
      async (request, reply) => {
        if (enderecoFreado(request, reply)) return reply;
        const newPassword = request.body?.newPassword ?? '';

        // Conta que nasceu pelo Google/GitHub NÃO TEM SENHA ATUAL para conferir. Exigir uma seria
        // exigir o impossível: a pessoa ficaria sem jeito nenhum de criar a primeira, e sem poder
        // desligar o provedor (que é a única porta dela). Aqui ela DEFINE a primeira; a sessão dela,
        // que já está aberta, é a prova de que é ela.
        const primeiraSenha = !db.temSenha(request.user.id);
        if (!primeiraSenha && !(await verifyPassword(request.body?.currentPassword ?? '', db.findPasswordHash(request.user.id)))) {
          return reply.code(400).send({ error: 'A senha atual está incorreta.' });
        }
        if (newPassword.length < 6) {
          return reply.code(400).send({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
        }
        db.updatePassword(request.user.id, await hashPassword(newPassword));
        // Trocar a senha desconecta os outros aparelhos: é exatamente o que alguém espera ao fazer isso
        // depois de desconfiar que a senha vazou. Quem trocou continua logado, com um token novo.
        const token = await signSession(request.user, db.bumpSessionVersion(request.user.id));
        return { ok: true, token };
      },
    );

    // ---------- Inventário: o que a pessoa tem, e o que ela ainda não viu ----------

    /**
     * A loja: o catálogo inteiro mais o que ESTA pessoa já tem e o que está vestindo.
     *
     * Vem tudo numa chamada só porque a loja mostra as três coisas juntas — separar em três daria três
     * idas ao servidor para desenhar uma tela. E vem o catálogo inteiro, inclusive o que ela não tem:
     * a graça de uma loja é ver o que existe. O que o app NÃO pode fazer é decidir o que ela pode
     * vestir a partir disso; quem decide é a rota do perfil, que confere de novo.
     */
    // ---------- Servidores de jogo ----------
    //
    // Uma agenda de endereços da comunidade. O Syden guarda e mostra; não fala com esses servidores
    // (o porquê está em jogos.ts). Ver é de quem é membro; mexer é de quem administra a comunidade —
    // é a mesma régua dos canais, e pela mesma razão: o endereço errado manda a turma para outro lugar.

    authed.get<{ Params: { id: string } }>('/api/communities/:id/jogos', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!roleIn(request.user, communityId)) return reply.code(403).send({ error: 'Você não é desta comunidade.' });
      return db.servidoresDeJogo(communityId);
    });

    authed.post<{ Params: { id: string } }>('/api/communities/:id/jogos', async (request, reply) => {
      const communityId = Number(request.params.id);
      const cargo = roleIn(request.user, communityId);
      if (!cargo) return reply.code(403).send({ error: 'Você não é desta comunidade.' });
      if (cargo === 'member') return reply.code(403).send({ error: 'Só quem administra a comunidade mexe na lista de servidores.' });

      if (db.contarServidoresDeJogo(communityId) >= TETO_POR_COMUNIDADE) {
        return reply
          .code(409)
          .send({ error: `A lista já tem ${TETO_POR_COMUNIDADE} servidores. Apague um antes de pôr outro.` });
      }

      const lido = lerServidor(request.body);
      if ('erro' in lido) return reply.code(400).send({ error: lido.erro });
      return db.criarServidorDeJogo(communityId, request.user.id, lido.servidor);
    });

    authed.put<{ Params: { id: string; jogoId: string } }>('/api/communities/:id/jogos/:jogoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const cargo = roleIn(request.user, communityId);
      if (!cargo) return reply.code(403).send({ error: 'Você não é desta comunidade.' });
      if (cargo === 'member') return reply.code(403).send({ error: 'Só quem administra a comunidade mexe na lista de servidores.' });

      // Confere que o servidor é MESMO desta comunidade: sem isto, quem administra a sua comunidade
      // editaria, pelo número, o servidor de qualquer outra.
      const atual = db.acharServidorDeJogo(Number(request.params.jogoId));
      if (!atual || atual.communityId !== communityId) return reply.code(404).send({ error: 'Esse servidor não existe aqui.' });

      const lido = lerServidor(request.body);
      if ('erro' in lido) return reply.code(400).send({ error: lido.erro });
      return db.atualizarServidorDeJogo(atual.id, lido.servidor);
    });

    authed.delete<{ Params: { id: string; jogoId: string } }>('/api/communities/:id/jogos/:jogoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const cargo = roleIn(request.user, communityId);
      if (!cargo) return reply.code(403).send({ error: 'Você não é desta comunidade.' });
      if (cargo === 'member') return reply.code(403).send({ error: 'Só quem administra a comunidade mexe na lista de servidores.' });

      const atual = db.acharServidorDeJogo(Number(request.params.jogoId));
      if (!atual || atual.communityId !== communityId) return reply.code(404).send({ error: 'Esse servidor não existe aqui.' });
      db.apagarServidorDeJogo(atual.id);
      return { ok: true };
    });

    authed.get('/api/loja', async (request) => {
      const tem = new Set(db.codigosDoInventario(request.user.id));
      return {
        itens: CATALOGO.map((item) => ({ ...item, tenho: item.comoSeGanha === 'livre' || tem.has(item.codigo) })),
        vestindo: {
          cor: request.user.nameColor,
          fundo: request.user.banner,
          moldura: request.user.moldura,
          insignias: request.user.vitrine,
        },
      };
    });

    authed.get('/api/me/itens', async (request) => ({
      itens: db.itensDaPessoa(request.user.id),
      vitrine: request.user.vitrine,
      limite: LIMITE_DA_VITRINE,
    }));

    /** A fila da tela de destaque: o que a pessoa ganhou e ainda não abriu. */
    authed.get('/api/me/itens/novidades', async (request) => db.itensPorRevelar(request.user.id));

    /**
     * Resgatar: é o clique que fecha a tela de destaque. Além de marcar que ela já viu, põe a insígnia no
     * perfil se ainda houver espaço — ganhar e não aparecer em lugar nenhum seria estranho.
     */
    authed.post<{ Params: { code: string } }>('/api/me/itens/:code/resgatar', async (request, reply) => {
      const code = request.params.code;
      if (!db.temItem(request.user.id, code)) return reply.code(404).send({ error: 'Você não tem este item.' });
      db.marcarRevelado(request.user.id, code);
      db.exibirSeCouber(request.user.id, code, LIMITE_DA_VITRINE);
      return { ok: true, user: db.findUserById(request.user.id) };
    });

    /** Quais insígnias exibir no perfil, e em que ordem. Quem escolhe é a dona delas. */
    authed.put<{ Body: { codigos?: string[] } }>('/api/me/vitrine', async (request, reply) => {
      const pedidos = request.body?.codigos;
      if (!Array.isArray(pedidos) || pedidos.some((c) => typeof c !== 'string')) {
        return reply.code(400).send({ error: 'Pedido inválido.' });
      }
      if (pedidos.length > LIMITE_DA_VITRINE) {
        return reply.code(400).send({ error: `Dá para exibir no máximo ${LIMITE_DA_VITRINE} insígnias.` });
      }
      db.definirVitrine(request.user.id, pedidos);
      // A lista de membros mostra as insígnias de todo mundo: quem está junto vê a mudança na hora.
      anunciarPerfil(io, request.user.id);
      return db.findUserById(request.user.id)!;
    });

    /**
     * "Sair de todos os aparelhos": derruba qualquer sessão aberta em outro computador ou celular.
     * Sem isto, um token que vazou continuaria valendo até vencer, e não haveria nada a fazer.
     */
    authed.post('/api/me/sessions/revoke', async (request) => {
      const token = await signSession(request.user, db.bumpSessionVersion(request.user.id));
      disconnectUser(io, request.user.id);
      return { ok: true, token };
    });

    /**
     * Excluir a própria conta. Pede uma confirmação deliberada, para ninguém fazer isso por engano nem
     * com o computador de outra pessoa aberto.
     *
     * **Quem entrou pelo Google/GitHub não tem senha para digitar**, e por isso confirma escrevendo o
     * próprio nome de usuário — o mesmo caminho que o GitHub usa para apagar repositório. Sem isto, uma
     * conta criada por engano no caminho social ficava impossível de apagar, que foi o que aconteceu.
     */
    authed.post<{ Body: { password?: string; confirmacao?: string } }>('/api/me/delete', async (request, reply) => {
      if (enderecoFreado(request, reply)) return reply;

      if (db.temSenha(request.user.id)) {
        if (!(await verifyPassword(request.body?.password ?? '', db.findPasswordHash(request.user.id)))) {
          return reply.code(400).send({ error: 'Senha incorreta.' });
        }
      } else {
        const escrito = (request.body?.confirmacao ?? '').trim();
        if (escrito.toLowerCase() !== request.user.username.toLowerCase()) {
          return reply.code(400).send({ error: `Escreva exatamente ${request.user.username} para confirmar.` });
        }
      }

      removeAccount(io, request.user.id);
      return { ok: true };
    });

    // ---------- Comunidades ----------

    authed.get('/api/communities', async (request) => db.listCommunitiesForUser(request.user.id));

    authed.post<{ Body: { name?: string } }>('/api/communities', async (request, reply) => {
      const name = communityName(request.body?.name);
      if (!name) return reply.code(400).send({ error: 'O nome da comunidade deve ter de 2 a 40 caracteres.' });
      if (db.countCommunitiesCreatedBy(request.user.id) >= config.maxCommunitiesPerUser) {
        return reply
          .code(409)
          .send({ error: `Cada pessoa pode criar até ${config.maxCommunitiesPerUser} comunidades. Apague uma para criar outra.` });
      }
      const community = db.createCommunity(name, request.user.id, db.newInviteCode());
      seedExpressions(community.id);
      joinCommunityRoom(io, request.user.id, community.id);
      return db.listCommunitiesForUser(request.user.id).find((c) => c.id === community.id);
    });

    authed.post<{ Body: { code?: string } }>('/api/communities/join', async (request, reply) => {
      const code = request.body?.code?.trim() ?? '';
      const community = code ? db.findCommunityByInvite(code) : undefined;
      if (!community) return reply.code(404).send({ error: 'Código de convite inválido.' });
      if (db.memberRole(community.id, request.user.id)) {
        return reply.code(409).send({ error: 'Você já participa desta comunidade.' });
      }
      if (db.countMembers(community.id) >= config.maxMembersPerCommunity) {
        return reply.code(409).send({ error: 'Esta comunidade já está cheia.' });
      }
      db.addMember(community.id, request.user.id);
      joinCommunityRoom(io, request.user.id, community.id);
      io.to(communityRoom(community.id)).emit('member:updated', {
        communityId: community.id,
        member: { ...request.user, role: 'member' },
      });
      return db.listCommunitiesForUser(request.user.id).find((c) => c.id === community.id);
    });

    /** Confere que a pessoa participa da comunidade da URL e devolve o cargo dela. */
    const requireRole = (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const communityId = Number(request.params.id);
      const community = db.findCommunity(communityId);
      const role = community && roleIn(request.user, communityId);
      if (!community || !role) {
        // 404, e não 403, de propósito: os números das comunidades são sequenciais, então um "403 - você
        // não participa" contaria a quem estivesse tentando de 1 em 1 quais comunidades existem e quantas
        // são. Para quem está de fora, uma comunidade da qual ele não faz parte simplesmente não existe.
        reply.code(404).send({ error: NOT_MEMBER });
        return null;
      }
      return { community, role };
    };

    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/communities/:id', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode renomeá-la.' });
      const name = communityName(request.body?.name);
      if (!name) return reply.code(400).send({ error: 'O nome da comunidade deve ter de 2 a 40 caracteres.' });
      const community = db.renameCommunity(access.community.id, name);
      io.to(communityRoom(community.id)).emit('community:updated', community);
      return community;
    });

    /** Troca o código de convite: o antigo para de funcionar na hora. */
    authed.post<{ Params: { id: string } }>('/api/communities/:id/invite', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar o convite.' });
      const code = db.newInviteCode();
      db.setCommunityInviteCode(access.community.id, code);
      return { inviteCode: code };
    });

    authed.post<{ Params: { id: string } }>('/api/communities/:id/leave', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (db.memberRole(access.community.id, request.user.id) === 'owner') {
        return reply.code(400).send({ error: 'Quem criou a comunidade não pode sair: passe o cargo de dono ou apague a comunidade.' });
      }
      db.removeMember(access.community.id, request.user.id);
      leaveCommunityRoom(io, request.user.id, access.community.id);
      io.to(communityRoom(access.community.id)).emit('member:removed', { communityId: access.community.id, userId: request.user.id });
      return { ok: true };
    });

    authed.delete<{ Params: { id: string } }>('/api/communities/:id', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (db.memberRole(access.community.id, request.user.id) !== 'owner') {
        return reply.code(403).send({ error: 'Só quem criou a comunidade pode apagá-la.' });
      }
      for (const channel of db.listChannels(access.community.id)) removeVoiceChannelMembers(io, channel.id);
      db.deleteCommunity(access.community.id);
      io.to(communityRoom(access.community.id)).emit('community:deleted', { id: access.community.id });
      return { ok: true };
    });

    // ---------- Membros da comunidade ----------

    authed.get<{ Params: { id: string } }>('/api/communities/:id/members', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      return db.listCommunityMembers(access.community.id);
    });

    /** Dar e tirar o cargo de administrador da comunidade: só quem a criou. */
    authed.put<{ Params: { id: string; userId: string }; Body: { role?: db.Role } }>(
      '/api/communities/:id/members/:userId',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        const role = request.body?.role;
        if (role !== 'admin' && role !== 'member') return reply.code(400).send({ error: 'Cargo inválido.' });
        if (db.memberRole(access.community.id, request.user.id) !== 'owner') {
          return reply.code(403).send({ error: 'Só quem criou a comunidade dá e tira o cargo de administrador.' });
        }
        const targetId = Number(request.params.userId);
        const current = db.memberRole(access.community.id, targetId);
        if (!current) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
        if (current === 'owner') return reply.code(400).send({ error: 'Quem criou a comunidade é sempre administrador.' });
        db.setMemberRole(access.community.id, targetId, role);
        const member = db.listCommunityMembers(access.community.id).find((m) => m.id === targetId);
        io.to(communityRoom(access.community.id)).emit('member:updated', { communityId: access.community.id, member });
        return member;
      },
    );

    authed.delete<{ Params: { id: string; userId: string } }>('/api/communities/:id/members/:userId', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode remover membros.' });
      const targetId = Number(request.params.userId);
      if (targetId === request.user.id) return reply.code(400).send({ error: 'Para sair, use "Sair da comunidade".' });
      const target = db.memberRole(access.community.id, targetId);
      if (!target) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
      if (target === 'owner') return reply.code(403).send({ error: 'Quem criou a comunidade não pode ser removido.' });
      if (target === 'admin' && access.role !== 'owner') {
        return reply.code(403).send({ error: 'Só quem criou a comunidade pode remover um administrador.' });
      }
      db.registrarAuditoria({
        actor: request.user,
        action: 'membro.removido',
        target: db.findUserById(targetId)?.username ?? String(targetId),
        communityId: access.community.id,
        detail: access.community.name,
      });
      db.removeMember(access.community.id, targetId);
      leaveCommunityRoom(io, targetId, access.community.id);
      io.to(communityRoom(access.community.id)).emit('member:removed', { communityId: access.community.id, userId: targetId });
      return { ok: true };
    });

    // ---------- Conta (Syden inteiro) ----------

    authed.delete<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só quem administra o Syden pode excluir contas.' });
      const target = db.findUserById(Number(request.params.id));
      if (!target) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
      if (target.id === request.user.id) {
        return reply.code(400).send({ error: 'Para sair, use "Excluir minha conta" em Minha conta.' });
      }
      if (target.isOwner) return reply.code(403).send({ error: 'O dono do Syden não pode ser removido.' });
      if (target.isAdmin && !request.user.isOwner) {
        return reply.code(403).send({ error: 'Só o dono do Syden pode remover quem também administra.' });
      }
      db.registrarAuditoria({ actor: request.user, action: 'conta.excluida', target: target.username });
      removeAccount(io, target.id);
      return { ok: true };
    });

    // Cargo de administrador do Syden inteiro: só o dono dá e tira, e o dele não sai.
    authed.put<{ Params: { id: string }; Body: { isAdmin?: boolean } }>('/api/users/:id/admin', async (request, reply) => {
      if (!request.user.isOwner) {
        return reply.code(403).send({ error: 'Só o dono do Syden pode dar ou tirar o cargo de administrador.' });
      }
      if (typeof request.body?.isAdmin !== 'boolean') return reply.code(400).send({ error: 'Pedido inválido.' });
      const target = db.findUserById(Number(request.params.id));
      if (!target) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
      if (target.isOwner) return reply.code(400).send({ error: 'O dono do Syden é sempre administrador.' });
      const user = db.setAdmin(target.id, request.body.isAdmin)!;
      db.registrarAuditoria({
        actor: request.user,
        action: request.body.isAdmin ? 'admin.dado' : 'admin.tirado',
        target: target.username,
      });
      io.emit('user:updated', user);
      return user;
    });

    /**
     * Silenciar o microfone de alguém na sala, como o Discord: quem administra a comunidade corta a fala de
     * quem está atrapalhando. É feito no servidor de mídia, então vale mesmo se o app da pessoa não colaborar.
     */
    authed.post<{ Params: { id: string }; Body: { userId?: number; muted?: boolean } }>(
      '/api/channels/:id/mute',
      async (request, reply) => {
        const channel = channelAccess(request, reply, false);
        if (!channel) return reply;
        const role = roleIn(request.user, channel.communityId);
        if (!manages(role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode silenciar alguém.' });
        const targetId = Number(request.body?.userId);
        const muted = request.body?.muted !== false;
        const targetRole = db.memberRole(channel.communityId, targetId);
        if (!targetRole) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
        if (targetRole === 'owner' && role !== 'owner') {
          return reply.code(403).send({ error: 'Quem criou a comunidade não pode ser silenciado.' });
        }

        const room = voiceRoomName(channel.id);
        const participants = await rooms.listParticipants(room).catch(() => []);
        const target = participants.find((p) => p.identity === String(targetId));
        const audio = target?.tracks.find((t) => t.source === TrackSource.MICROPHONE);
        if (!audio) return reply.code(404).send({ error: 'Essa pessoa não está com microfone nesta sala.' });
        await rooms.mutePublishedTrack(room, String(targetId), audio.sid, muted);
        return { ok: true };
      },
    );

    /** Puxar alguém para outra sala de voz da mesma comunidade, como o "mover" do Discord. */
    authed.post<{ Params: { id: string }; Body: { userId?: number; toChannelId?: number } }>(
      '/api/channels/:id/move',
      async (request, reply) => {
        const channel = channelAccess(request, reply, false);
        if (!channel) return reply;
        if (!manages(roleIn(request.user, channel.communityId))) {
          return reply.code(403).send({ error: 'Só quem administra a comunidade pode mover alguém de sala.' });
        }
        const destination = db.findChannel(Number(request.body?.toChannelId));
        if (!destination || destination.type !== 'voice' || destination.communityId !== channel.communityId) {
          return reply.code(400).send({ error: 'Sala de destino inválida.' });
        }
        const targetId = Number(request.body?.userId);
        if (!db.memberRole(channel.communityId, targetId)) {
          return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
        }
        emitToUser(io, targetId, 'voice:move', { channelId: destination.id, channelName: destination.name });
        return { ok: true };
      },
    );

    /** Tirar alguém da chamada (sem removê-lo da comunidade), quando está atrapalhando. */
    authed.post<{ Params: { id: string }; Body: { userId?: number } }>('/api/channels/:id/kick', async (request, reply) => {
      const channel = channelAccess(request, reply, false);
      if (!channel) return reply;
      const role = roleIn(request.user, channel.communityId);
      if (!manages(role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode desconectar alguém.' });
      const targetId = Number(request.body?.userId);
      const targetRole = db.memberRole(channel.communityId, targetId);
      if (!targetRole) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
      if (targetRole === 'owner' && role !== 'owner') {
        return reply.code(403).send({ error: 'Quem criou a comunidade não pode ser desconectado.' });
      }
      await rooms.removeParticipant(voiceRoomName(channel.id), String(targetId)).catch(() => {});
      return { ok: true };
    });

    // Erro no app de alguém (microfone, câmera, conexão): vai para o diário da aba de saúde, para o
    // administrador enxergar problemas que acontecem no computador dos outros.
    authed.post<{ Body: { kind?: string; message?: string } }>('/api/client-errors', async (request, reply) => {
      const kind = String(request.body?.kind ?? '').slice(0, 24) || 'app';
      const message = String(request.body?.message ?? '').trim().slice(0, 200);
      if (!message) return reply.code(400).send({ error: 'Mensagem vazia.' });
      recordClientError(request.user.username, kind, message);
      return { ok: true };
    });

    // Consumo do servidor (tráfego e horas): informação de quem administra o Syden.
    /**
     * O registro de auditoria. Só quem administra o Syden lê — e, quando alguém reclama de uma mensagem
     * apagada ou de uma conta excluída, é aqui que está a resposta, com nome e hora.
     */
    authed.get<{ Querystring: { limite?: string } }>('/api/audit', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o registro.' });
      return db.lerAuditoria(Number(request.query?.limite) || 200);
    });

    authed.get('/api/usage', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o uso do servidor.' });
      return usageSummary();
    });

    // Saúde do servidor: como está agora e o que aconteceu nas últimas 24 horas.
    authed.get('/api/status', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o estado do servidor.' });
      return healthReport();
    });

    // Os mesmos gráficos do painel da Hetzner, quando o token de leitura está configurado.
    authed.get('/api/status/provider', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o estado do servidor.' });
      return (await providerMetrics()) ?? { name: '', series: [] };
    });

    /**
     * Quanto o Syden ficou no ar, visto de fora. Devolve nulo quando não há chave do UptimeRobot — a
     * tela some inteira nesse caso, em vez de mostrar zeros que pareceriam queda.
     */
    authed.get('/api/status/uptime', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o estado do servidor.' });
      return (await disponibilidade()) ?? null;
    });

    /**
     * Quanta gente ABRE o site, e quanto ele demora para abrir na casa dela. Vem da Cloudflare, e some
     * do mesmo jeito que a de cima quando não há chave configurada.
     */
    authed.get('/api/status/audiencia', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o estado do servidor.' });
      return (await audiencia()) ?? null;
    });

    // ---------- Canais ----------

    authed.get<{ Params: { id: string } }>('/api/communities/:id/channels', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      return db.listChannels(access.community.id);
    });

    authed.post<{ Params: { id: string }; Body: { name?: string; type?: db.ChannelType } }>(
      '/api/communities/:id/channels',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        const type = request.body?.type;
        if (type !== 'text' && type !== 'voice') return reply.code(400).send({ error: 'Tipo de canal inválido.' });
        const name = channelName(request.body?.name, type);
        if (!name) return reply.code(400).send({ error: 'O nome do canal deve ter de 1 a 50 caracteres.' });
        const channel = db.createChannel(access.community.id, name, type, request.user.id);
        io.to(communityRoom(access.community.id)).emit("channel:created", channel);
        return channel;
      },
    );

    /** Canal existente: quem criou o canal, ou quem administra a comunidade. */
    const channelAccess = (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, manage: boolean) => {
      const channel = db.findChannel(Number(request.params.id));
      // Conversa privada não é canal de comunidade: quem chega aqui por uma delas recebe "não encontrado".
      const role = channel?.communityId === null ? undefined : channel && roleIn(request.user, channel.communityId!);
      if (!channel || channel.communityId === null || !role) {
        reply.code(404).send({ error: 'Canal não encontrado.' });
        return null;
      }
      if (manage && !manages(role) && channel.createdBy !== request.user.id) {
        reply.code(403).send({ error: 'Só quem criou o canal ou quem administra a comunidade pode alterá-lo.' });
        return null;
      }
      return channel as CommunityChannel;
    };

    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/channels/:id', async (request, reply) => {
      const channel = channelAccess(request, reply, true);
      if (!channel) return reply;
      const name = channelName(request.body?.name, channel.type);
      if (!name) return reply.code(400).send({ error: 'O nome do canal deve ter de 1 a 50 caracteres.' });
      const updated = db.renameChannel(channel.id, name);
      io.to(communityRoom(channel.communityId)).emit('channel:updated', updated);
      return updated;
    });

    authed.delete<{ Params: { id: string } }>('/api/channels/:id', async (request, reply) => {
      const channel = channelAccess(request, reply, true);
      if (!channel) return reply;
      if (channel.type === 'text' && db.countChannels(channel.communityId, 'text') === 1) {
        return reply.code(400).send({ error: 'Precisa existir pelo menos um canal de texto.' });
      }
      db.deleteChannel(channel.id);
      removeVoiceChannelMembers(io, channel.id);
      io.to(communityRoom(channel.communityId)).emit('channel:deleted', { id: channel.id, communityId: channel.communityId });
      return { ok: true };
    });

    authed.get<{ Params: { id: string }; Querystring: { before?: string } }>(
      '/api/channels/:id/messages',
      async (request, reply) => {
        // Vale tanto para canal de texto da comunidade quanto para conversa privada.
        const channel = db.findChannel(Number(request.params.id));
        if (!channel || (channel.type !== 'text' && channel.type !== 'dm') || !canUseChannel(request.user, channel)) {
          return reply.code(404).send({ error: 'Canal não encontrado.' });
        }
        const before = request.query.before ? Number(request.query.before) : undefined;
        return db.listMessages(channel.id, before, request.user.id);
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/messages/:id', async (request, reply) => {
      const message = db.findMessage(Number(request.params.id));
      const channel = message && db.findChannel(message.channelId);
      if (!message || !channel || !canUseChannel(request.user, channel)) {
        return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      }
      // Em conversa privada não existe administrador: só o autor apaga o que escreveu. Quem cuida do Syden
      // alcança qualquer mensagem de comunidade — é obrigação de quem opera o serviço poder tirar do ar
      // conteúdo ilegal —, mas isso fica registrado na auditoria com nome e hora.
      const canManage =
        channel.communityId !== null &&
        (manages(roleIn(request.user, channel.communityId)) ||
          poderDeOperador(request.user, 'moderacao.mensagem', {
            target: `mensagem ${message.id}`,
            communityId: channel.communityId,
            detail: `de ${db.findUserById(message.userId)?.username ?? message.userId} em #${channel.name}`,
          }));
      if (message.userId !== request.user.id && !canManage) {
        return reply.code(403).send({ error: 'Só o autor ou quem administra a comunidade pode apagar a mensagem.' });
      }
      db.deleteMessage(message.id);
      const room = channelRoom(channel);
      io.to(room).emit('message:deleted', {
        id: message.id,
        channelId: message.channelId,
        threadId: message.threadId,
      });
      // Era resposta de um tópico: a contagem embaixo da mensagem-mãe muda.
      if (message.threadId !== null) {
        const thread = db.findThread(message.threadId);
        if (thread) io.to(room).emit('thread:updated', { ...thread, communityId: channel.communityId });
      }
      return { ok: true };
    });

    /**
     * Token só para espiar: entra na sala invisível, sem publicar nada, para mostrar a prévia da tela de quem
     * está transmitindo antes de a pessoa decidir entrar. Ninguém na sala vê quem está espiando.
     */
    authed.post<{ Params: { id: string } }>('/api/channels/:id/peek-token', async (request, reply) => {
      const channel = channelAccess(request, reply, false);
      if (!channel) return reply;
      if (channel.type !== 'voice') return reply.code(404).send({ error: 'Sala de voz não encontrada.' });

      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: `peek-${request.user.id}`,
        name: request.user.username,
        ttl: '10m',
      });
      token.addGrant({
        room: voiceRoomName(channel.id),
        roomJoin: true,
        canPublish: false,
        canPublishData: false,
        canSubscribe: true,
        hidden: true,
      });
      return { url: config.livekit.url, token: await token.toJwt() };
    });

    // Emite o token que autoriza o navegador a entrar na sala do LiveKit correspondente ao canal de voz.
    authed.post<{ Params: { id: string } }>('/api/channels/:id/voice-token', async (request, reply) => {
      const channel = channelAccess(request, reply, false);
      if (!channel) return reply;
      if (channel.type !== 'voice') return reply.code(404).send({ error: 'Sala de voz não encontrada.' });

      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: String(request.user.id),
        name: request.user.username,
        ttl: '6h',
      });
      token.addGrant({
        room: voiceRoomName(channel.id),
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      return { url: config.livekit.url, token: await token.toJwt() };
    });
  });
}
