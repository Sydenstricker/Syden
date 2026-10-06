import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import type { Server as IOServer } from 'socket.io';
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import { Freio } from './freio.js';
import { seedExpressions } from './expressions.js';
import { salaDaPessoa,
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
import { CATALOGO, podeVestir } from './guardaRoupa.js';
import { mandarCodigo } from './email-routes.js';
import { provedoresLigados } from './social.js';
import { audiencia } from './audiencia.js';
import * as prefs from './preferencias.js';
import * as gifs from './gifs.js';
import { conferirSelo, CORES, ICONES, MARCOS, marcosAlcancados, podeUsarSelo } from './selos.js';
import { disponibilidade } from './uptime.js';
import { usageSummary } from './usage.js';

/** Cliente de administração do LiveKit: é por ele que o servidor silencia alguém na sala. */
const rooms = new RoomServiceClient(config.livekit.url.replace(/^ws/, 'http'), config.livekit.apiKey, config.livekit.apiSecret);

const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

/** Tira alguém de uma chamada pelo LiveKit (o silêncio temporário usa; ver advertencias-routes.ts). */
export async function tirarDaChamada(channelId: number, userId: number) {
  await rooms.removeParticipant(voiceRoomName(channelId), String(userId)).catch(() => {});
}

export function voiceRoomName(channelId: number) {
  return `channel-${channelId}`;
}

/** Canais de texto seguem o padrão do Discord: minúsculas e hífens no lugar de espaços. */
function channelName(raw: string | undefined, type: db.ChannelType): string | null {
  const name = raw?.trim() ?? '';
  if (name.length < 1 || name.length > 50) return null;
  return type === 'text' ? name.toLowerCase().replace(/\s+/g, '-') : name;
}

/**
 * O NOME SE MEDE EM GRAFEMAS, que é o que a pessoa chama de "caractere".
 *
 * Desde que dá para pôr emoji no nome, contar `name.length` passou a mentir: "🇧🇷" ocupa quatro
 * unidades e a família 👨‍👩‍👧 ocupa onze, então um nome que a tela mostra com quinze caracteres
 * seria recusado por passar de quarenta. O `Intl.Segmenter` conta o que se vê, e é a mesma conta
 * que o campo do site faz (ver LETRAS_DO_NOME, em SettingsModal.tsx) — as duas pontas precisam
 * concordar, senão o botão deixa salvar e o servidor devolve erro.
 */
const GRAFEMAS = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function communityName(raw: unknown): string | null {
  const name = String(raw ?? '').trim();
  const letras = [...GRAFEMAS.segment(name)].length;
  return letras >= 2 && letras <= 40 ? name : null;
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

/**
 * Quem entrou só para uma aula (conta temporária, ver aula-routes.ts) faz o que a aula precisa: falar,
 * ouvir e escrever na comunidade dela. Criar comunidade, entrar em outra, abrir conversa privada e
 * pedir amizade ficam de fora — a conta some quando o link vence, e nada disso faria sentido nela.
 * Devolve true quando barrou (e já respondeu).
 */
export function barrarTemporario(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!db.ehTemporario(request.user.id)) return false;
  reply.code(403).send({ error: 'Quem entrou só para a aula não pode fazer isso. Crie uma conta para usar o Syden inteiro.' });
  return true;
}

/**
 * Quanto tempo um canal apagado fica recuperável.
 *
 * Trinta dias é o prazo de quem só percebe a falta quando volta a precisar do canal — "cadê o
 * #combinados do churrasco?" não acontece no mesmo dia. Antes disto o único socorro era o retrato
 * diário da hospedagem, que para desfazer um clique perderia o dia inteiro de todo mundo.
 */
export const DIAS_NA_LIXEIRA = 30;

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
  // O freio dos GIFs protege uma COTA, e não o servidor: são 100 buscas por hora no plano grátis, para
  // o Syden inteiro. Sem ele, uma pessoa digitando letra por letra na caixa de busca gastaria a cota de
  // todo mundo em dois minutos, sem má intenção nenhuma. Quinze por minuto sobra para quem procura de
  // verdade e corta a digitação frenética — e busca repetida nem chega aqui, morre no cache.
  const freioDeGifs = new Freio(15, 60_000);

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
    authed.put<{ Body: { nameColor?: string | null; banner?: string | null; moldura?: string | null; nameEffect?: string | null; nameFont?: string | null } }>(
      '/api/me/profile',
      async (request, reply) => {
        const limpa = (valor: unknown) => (typeof valor === 'string' && valor.length > 0 && valor.length <= 24 ? valor : null);
        const nameColor = limpa(request.body?.nameColor);
        const banner = limpa(request.body?.banner);
        const moldura = limpa(request.body?.moldura);
        const nameEffect = limpa(request.body?.nameEffect);
        // Quem não manda a letra (um site mais velho que o servidor) não a perde: fica a que estava.
        const nameFont = request.body && 'nameFont' in request.body ? limpa(request.body.nameFont) : request.user.nameFont;

        // Antes a rota aceitava qualquer texto curto e confiava no app para só mandar o que existe.
        // Agora que há item que se GANHA, confiar no app deixou de servir: um pedido feito à mão
        // vestiria a insígnia dos 25 primeiros em quem chegou ontem. Quem decide é o servidor.
        const tem = db.codigosDoInventario(request.user.id);
        const errado =
          (!podeVestir(nameColor, 'cor', tem) && 'cor') ||
          (!podeVestir(banner, 'fundo', tem) && 'fundo') ||
          (!podeVestir(moldura, 'moldura', tem) && 'moldura') ||
          (!podeVestir(nameEffect, 'efeito', tem) && 'efeito') ||
          (!podeVestir(nameFont, 'letra', tem) && 'letra');
        if (errado) return reply.code(403).send({ error: 'Esse item de ' + errado + ' não é seu.' });

        const user = db.setProfile(request.user.id, { nameColor, banner, moldura, nameEffect, nameFont });
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
     * O guarda-roupa: o catálogo inteiro mais o que ESTA pessoa já tem e o que está vestindo.
     *
     * Vem tudo numa chamada só porque o guarda-roupa mostra as três coisas juntas — separar em três daria três
     * idas ao servidor para desenhar uma tela. E vem o catálogo inteiro, inclusive o que ela não tem:
     * a graça de um guarda-roupa é ver o que existe. O que o app NÃO pode fazer é decidir o que ela pode
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

    /*
     * A ROTA TEM DOIS NOMES DE PROPÓSITO, E O VELHO VAI EMBORA DEPOIS.
     *
     * O site e o servidor sobem por caminhos separados, então sempre existe uma janela em que um está
     * novo e o outro não. Trocar o nome da rota nos dois no mesmo commit não fecha essa janela: ela é
     * do DEPLOY, não do código. Enquanto o servidor no ar for o antigo, um site novo pedindo
     * /api/guarda-roupa levaria 404 e a aba de Aparência abriria vazia para todo mundo.
     *
     * Por isso são dois: o site pede o nome novo e cai para o velho se tomar 404 (ver Aparencia.tsx);
     * o servidor responde aos dois. Quando o servidor estiver atualizado e ninguém mais tiver uma aba
     * antiga aberta, a linha de baixo e a queda do lado do site saem juntas.
     */
    const guardaRoupa = async (request: { user: db.User }) => {
      const tem = new Set(db.codigosDoInventario(request.user.id));
      return {
        itens: CATALOGO.map((item) => ({ ...item, tenho: item.comoSeGanha === 'livre' || tem.has(item.codigo) })),
        vestindo: {
          cor: request.user.nameColor,
          fundo: request.user.banner,
          moldura: request.user.moldura,
          efeito: request.user.nameEffect,
          letra: request.user.nameFont,
          insignias: request.user.vitrine,
        },
      };
    };

    authed.get('/api/guarda-roupa', guardaRoupa);
    /** O nome antigo, só para a janela do deploy. Sai junto com a queda do lado do site. */
    authed.get('/api/loja', guardaRoupa);

    /**
     * As preferências da pessoa, para seguirem com ela entre navegadores e entre o site e o aplicativo.
     *
     * O servidor GUARDA, não interpreta: quem decide o que sobe é o site, numa lista de chaves
     * permitidas — os ids de microfone e câmera ficam de fora de propósito, porque identificam um
     * aparelho e não a pessoa. Ver preferencias.ts.
     */
    /**
     * Quais selos eu posso vestir, e qual estou vestindo.
     *
     * A escolha é de cada pessoa — como as insígnias do perfil. A comunidade conquista e define o
     * selo; quem é dela decide se quer usá-lo, e qual, quando pertence a mais de uma.
     */
    /**
     * Bloquear alguém.
     *
     * O bloqueio é DIRECIONAL no banco e vale NOS DOIS SENTIDOS no efeito: se eu bloqueio você, nem
     * eu falo com você nem você fala comigo. Um bloqueio que calasse só um lado não protegeria
     * ninguém — quem bloqueou continuaria recebendo mensagem.
     *
     * E ele é INVISÍVEL para quem foi bloqueado. Não há aviso, e as recusas que ele encontra são as
     * mesmas de qualquer outra recusa. Avisar transformaria um ato de defesa num conflito, e é
     * justamente quem mais precisa bloquear que menos pode pagar esse preço.
     */
    authed.get('/api/me/bloqueios', async (request) => db.listarBloqueios(request.user.id));

    authed.post<{ Body: { userId?: number } }>('/api/me/bloqueios', async (request, reply) => {
      const alvo = Number(request.body?.userId);
      if (!Number.isInteger(alvo)) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (alvo === request.user.id) return reply.code(400).send({ error: 'Você não pode bloquear a si mesmo.' });
      if (!db.bloquear(request.user.id, alvo)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });

      // Só quem bloqueou recebe aviso. O outro lado não fica sabendo de nada.
      io.to(salaDaPessoa(request.user.id)).emit('bloqueios:mudou', db.listarBloqueios(request.user.id));
      io.to(salaDaPessoa(request.user.id)).emit('amigos:mudou', db.listarAmizades(request.user.id));
      io.to(salaDaPessoa(alvo)).emit('amigos:mudou', db.listarAmizades(alvo));
      return { ok: true, bloqueios: db.listarBloqueios(request.user.id) };
    });

    authed.delete<{ Params: { id: string } }>('/api/me/bloqueios/:id', async (request, reply) => {
      const alvo = Number(request.params.id);
      if (!Number.isInteger(alvo)) return reply.code(400).send({ error: 'Pedido inválido.' });
      // Desbloquear NÃO devolve a amizade: ela foi desfeita, e refazê-la é escolha das duas pessoas.
      if (!db.desbloquear(request.user.id, alvo)) return reply.code(404).send({ error: 'Essa pessoa não está bloqueada.' });
      io.to(salaDaPessoa(request.user.id)).emit('bloqueios:mudou', db.listarBloqueios(request.user.id));
      return { ok: true, bloqueios: db.listarBloqueios(request.user.id) };
    });

    authed.get('/api/me/selo', async (request) => ({
      podeVestir: db.selosQuePodeVestir(request.user.id),
      vestindo: db.findUserById(request.user.id)?.selo ?? null,
    }));

    authed.put<{ Body: { communityId?: number | null } }>('/api/me/selo', async (request, reply) => {
      const pedido = request.body?.communityId;
      const communityId = pedido === null || pedido === undefined ? null : Number(pedido);
      if (communityId !== null && !Number.isInteger(communityId)) {
        return reply.code(400).send({ error: 'Escolha inválida.' });
      }
      // A conferência é do servidor. A lista de opções sai daqui, mas um pedido feito à mão pediria
      // a camiseta de um time do qual a pessoa nunca fez parte.
      if (!db.vestirSelo(request.user.id, communityId)) {
        return reply.code(403).send({ error: 'Esse selo não é seu para usar.' });
      }
      const user = db.findUserById(request.user.id);
      io.emit('user:updated', user);
      return { vestindo: user?.selo ?? null };
    });

    authed.get('/api/me/preferencias', async (request) => prefs.ler(request.user.id));

    authed.put<{ Body: unknown }>('/api/me/preferencias', async (request, reply) => {
      const conferido = prefs.conferir(request.body);
      // Recusar com o motivo escrito, em vez de engolir em silêncio: preferência que some sem
      // explicação é o defeito que ninguém relata — a pessoa só acha que o Syden esqueceu.
      if (!conferido.ok) return reply.code(400).send({ error: conferido.erro });
      return prefs.guardar(request.user.id, conferido.texto);
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
      if (barrarTemporario(request, reply)) return reply;
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
      if (barrarTemporario(request, reply)) return reply;
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


    /**
     * Os marcos da comunidade e o selo dela.
     *
     * Aberto a QUALQUER MEMBRO, e não só a quem administra: o selo é mérito do grupo, então o grupo
     * tem de poder ver quanto falta para o próximo. Esconder o progresso de quem o está construindo
     * tiraria metade da graça — ninguém se esforça por uma meta que não enxerga.
     */
    authed.get<{ Params: { id: string } }>('/api/communities/:id/selo', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;

      const fatos = db.fatosDaComunidade(access.community.id);
      const alcancados = new Set(marcosAlcancados(fatos));

      return {
        selo: db.lerSelo(access.community.id),
        destravado: podeUsarSelo(fatos),
        podeEditar: manages(access.role),
        fatos,
        marcos: MARCOS.map((m) => ({
          codigo: m.codigo,
          nome: m.nome,
          comoSeGanha: m.comoSeGanha,
          alcancado: alcancados.has(m.codigo),
          progresso: m.progresso(fatos),
        })),
        // A tela não inventa as opções: elas vêm de cá, então acrescentar um ícone é mudança de um
        // lugar só, e nunca aparece na tela uma opção que o servidor recusaria.
        icones: ICONES,
        cores: CORES,
      };
    });

    authed.put<{ Params: { id: string }; Body: unknown }>('/api/communities/:id/selo', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade escolhe o selo.' });

      // A trava do marco fica AQUI, no servidor, e não só no botão desabilitado da tela. Um selo que
      // se consegue com um pedido feito à mão não é conquista nenhuma, e a tela é a parte do Syden
      // que qualquer pessoa consegue contornar.
      if (!podeUsarSelo(db.fatosDaComunidade(access.community.id))) {
        return reply.code(403).send({ error: 'Esta comunidade ainda não alcançou o primeiro marco.' });
      }

      const conferido = conferirSelo(request.body);
      if (!conferido.ok) return reply.code(400).send({ error: conferido.erro });

      db.guardarSelo(access.community.id, conferido.selo);
      db.registrarAuditoria({
        actor: request.user,
        action: 'selo',
        target: conferido.selo.texto,
        communityId: access.community.id,
      });
      io.to(communityRoom(access.community.id)).emit('selo:mudou', {
        communityId: access.community.id,
        selo: conferido.selo,
      });
      return { selo: conferido.selo };
    });

    /**
     * Tirar o selo tem rota própria, e não é "PUT com corpo vazio".
     *
     * Corpo nulo num PUT é ambíguo: o Fastify recusa antes de chegar aqui, e mesmo que chegasse,
     * "não mandei nada" e "quero apagar" viram a mesma coisa. Quem conquistou também pode preferir
     * não exibir, e essa escolha merece ser dita de forma clara.
     */
    authed.delete<{ Params: { id: string } }>('/api/communities/:id/selo', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade escolhe o selo.' });
      db.guardarSelo(access.community.id, null);
      // A comunidade perdeu o selo: quem o vestia para de vesti-lo. Sem isto, a camiseta ficaria no
      // corpo de gente cujo time não tem mais camiseta, e nada daria erro.
      db.despirSeloDaComunidade(access.community.id);
      io.to(communityRoom(access.community.id)).emit('selo:mudou', { communityId: access.community.id, selo: null });
      return { selo: null };
    });

    // ----------------------------------------------------------------------------------------------
    // O ESPAÇO DE BOAS-VINDAS
    // ----------------------------------------------------------------------------------------------

    authed.get<{ Params: { id: string } }>('/api/communities/:id/boas-vindas', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;

      return {
        boasVindas: db.lerBoasVindas(access.community.id),
        podeEditar: manages(access.role),
        // O cliente usa isto para decidir se abre sozinho. A decisão fica aqui porque o servidor é
        // quem sabe — no navegador, entrar pelo computador do trabalho pareceria a primeira vez.
        jaViu: db.jaViuBoasVindas(access.community.id, request.user.id),
      };
    });

    authed.put<{ Params: { id: string }; Body: { titulo?: string; texto?: string; arte?: string } }>(
      '/api/communities/:id/boas-vindas',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) {
          return reply.code(403).send({ error: 'Só quem administra a comunidade monta as boas-vindas.' });
        }

        const titulo = String(request.body?.titulo ?? '').trim().slice(0, 80);
        const texto = String(request.body?.texto ?? '').trim().slice(0, 1000);
        const arte = String(request.body?.arte ?? '').trim().slice(0, 40);

        // Tudo em branco desmonta o espaço, e a comunidade volta a abrir direto nos canais. É a saída
        // para quem experimentou e não gostou — sem ela, montar seria irreversível.
        if (!titulo && !texto) {
          db.guardarBoasVindas(access.community.id, null);
          io.to(communityRoom(access.community.id)).emit('boas-vindas:mudou', { communityId: access.community.id });
          return { boasVindas: null };
        }
        if (titulo.length < 2) {
          return reply.code(400).send({ error: 'O título precisa de pelo menos 2 letras.' });
        }

        // A arte NÃO é validada contra uma lista aqui, e isso é deliberado: o catálogo mora no site
        // (web/src/boasVindas.ts), e um código que a tela não conhece simplesmente cai no padrão em vez
        // de virar erro. É o mesmo acordo do guarda-roupa — arte nova se publica sem mexer no servidor.
        const boasVindas = { titulo, texto, arte: arte || 'aurora' };
        db.guardarBoasVindas(access.community.id, boasVindas);
        io.to(communityRoom(access.community.id)).emit('boas-vindas:mudou', { communityId: access.community.id });
        return { boasVindas };
      },
    );

    /** Marca que esta pessoa já viu. Guarda só a primeira vez (ver db.marcarViuBoasVindas). */
    authed.post<{ Params: { id: string } }>('/api/communities/:id/boas-vindas/visto', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      db.marcarViuBoasVindas(access.community.id, request.user.id);
      return { ok: true };
    });

    /**
     * Troca o código de convite: o antigo para de funcionar na hora.
     *
     * CONVIDAR É DE TODO MEMBRO; TROCAR O CÓDIGO NÃO. Desde 03/10/2026 qualquer membro recebe o código
     * para chamar gente (ver listCommunitiesForUser). Trocar continua com quem administra, porque derruba
     * de uma vez todos os links que já foram espalhados — é a ferramenta de quando o convite vazou.
     * E todo mundo da comunidade recebe o código novo na hora, senão quem estava com o app aberto
     * continuaria compartilhando um link morto.
     */
    authed.post<{ Params: { id: string } }>('/api/communities/:id/invite', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar o convite.' });
      const code = db.newInviteCode();
      db.setCommunityInviteCode(access.community.id, code);
      io.to(communityRoom(access.community.id)).emit('community:invite', { id: access.community.id, inviteCode: code });
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

    /**
     * O panorama das comunidades: quantas existem, de que tamanho e com quanta conversa.
     *
     * Só METADADO — nunca o conteúdo de mensagem nenhuma. A janela vem em dias, porque "mais ativa"
     * depende do período: em 7 dias aparece quem está movimentada agora, em 90 aparece quem tem
     * história. O teto de 365 existe para ninguém pedir uma varredura do banco inteiro sem querer.
     */
    authed.get<{ Querystring: { dias?: string } }>('/api/status/comunidades', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só os administradores veem o estado do servidor.' });
      const pedido = Number(request.query?.dias);
      const dias = Number.isFinite(pedido) ? Math.min(365, Math.max(1, Math.round(pedido))) : 7;
      const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
      return { dias, comunidades: db.panoramaDeComunidades(desde) };
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

      /**
       * APAGAR NÃO É EDITAR, e por isso não basta ter criado o canal.
       *
       * Qualquer pessoa da comunidade pode criar um canal, e o channelAccess deixava quem criou também
       * APAGAR. Renomear é reversível; apagar não: as mensagens caem junto, por cascata no banco. Ou
       * seja, alguém criava o #combinados, a turma conversava ali por um mês, e essa pessoa levava o
       * mês inteiro embora sozinha — sem ser administradora de nada.
       *
       * O conteúdo de um canal é de quem escreveu nele, não de quem digitou o nome. Apagar passa a ser
       * de quem administra a comunidade, que é quem responde por ela.
       */
      if (!manages(roleIn(request.user, channel.communityId))) {
        return reply
          .code(403)
          .send({ error: 'Só quem administra a comunidade pode apagar um canal: com ele vão as mensagens de todo mundo.' });
      }

      if (channel.type === 'text' && db.countChannels(channel.communityId, 'text') === 1) {
        return reply.code(400).send({ error: 'Precisa existir pelo menos um canal de texto.' });
      }
      db.deleteChannel(channel.id);
      // A varredura pega carona aqui: quem apaga um canal é exatamente quem pode estar enchendo a
      // lixeira, e é o momento mais barato de conferir o que já passou dos trinta dias.
      db.varrerCanaisApagados(new Date(Date.now() - DIAS_NA_LIXEIRA * 24 * 60 * 60_000).toISOString());
      removeVoiceChannelMembers(io, channel.id);
      io.to(communityRoom(channel.communityId)).emit('channel:deleted', { id: channel.id, communityId: channel.communityId });
      return { ok: true, diasParaDesfazer: DIAS_NA_LIXEIRA };
    });

    /**
     * GIFs, pelo GIPHY (ver gifs.ts).
     *
     * Passa por aqui, e não direto do navegador, porque a chave é a cota do Syden inteiro: publicada,
     * qualquer pessoa a copia e gasta as 100 buscas por hora de todo mundo.
     *
     * Responde 200 mesmo quando não dá para buscar, com o motivo dentro. Um 503 aqui viraria uma tela
     * de erro vermelha por causa de um GIF, e o estado "sem cota por vinte minutos" não é erro: é uma
     * coisa que passa, e que a pessoa precisa entender em uma frase para tentar de novo mais tarde.
     */
    authed.get<{ Querystring: { q?: string; de?: string; idioma?: string } }>('/api/gifs', async (request, reply) => {
      if (!gifs.ligado()) return { estado: 'desligado' };
      const espera = freioDeGifs.tentar('gif:' + request.user.id);
      if (espera) return reply.code(429).send({ estado: 'devagar', segundos: espera });
      return gifs.buscar({
        termo: request.query.q ?? '',
        de: Number(request.query.de ?? 0) || 0,
        idioma: request.query.idioma ?? 'pt',
      });
    });

    /**
     * A LIXEIRA DA COMUNIDADE: o que foi apagado e ainda dá para trazer de volta.
     *
     * Só para quem administra, pelo mesmo motivo de apagar ser só de quem administra — e porque a
     * lista conta quantas mensagens cada canal apagado tinha, que é informação de dentro dele.
     */
    authed.get<{ Params: { id: string } }>('/api/communities/:id/lixeira', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê a lixeira.' });
      db.varrerCanaisApagados(new Date(Date.now() - DIAS_NA_LIXEIRA * 24 * 60 * 60_000).toISOString());
      return { canais: db.canaisNaLixeira(access.community.id), dias: DIAS_NA_LIXEIRA };
    });

    /** Desfazer. O canal volta com as mensagens, porque elas nunca chegaram a sair. */
    authed.post<{ Params: { id: string; canalId: string } }>(
      '/api/communities/:id/lixeira/:canalId',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade restaura um canal.' });
        if (!db.restaurarCanal(Number(request.params.canalId), access.community.id)) {
          return reply.code(404).send({ error: 'Esse canal não está na lixeira. Pode ter passado dos trinta dias.' });
        }
        const canal = db.findChannel(Number(request.params.canalId));
        io.to(communityRoom(access.community.id)).emit('channel:created', canal);
        return { ok: true, canal };
      },
    );

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
      // O destaque some junto (gatilho no banco); as telas do canal de destaques precisam saber.
      const destaque = db.postDoDestaque(message.id);
      db.deleteMessage(message.id);
      const room = channelRoom(channel);
      const canalDoDestaque = destaque && db.findChannel(destaque.channelId);
      if (destaque && canalDoDestaque) io.to(channelRoom(canalDoDestaque)).emit('message:deleted', { id: destaque.id, channelId: destaque.channelId, threadId: null });
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


    // ----------------------------------------------------------------------------------------------
    // MODO APRESENTAÇÃO: uma pessoa fala, as outras assistem
    // ----------------------------------------------------------------------------------------------

    /**
     * Muda ao vivo o que uma pessoa pode publicar na sala do LiveKit.
     *
     * ISTO É O QUE FAZ A COISA FUNCIONAR DE VERDADE, e é fácil de esquecer: o token é conferido na
     * ENTRADA da sala. Quem já está dentro com canPublish verdadeiro continua podendo publicar para
     * sempre, por mais que o banco diga o contrário — trocar a linha na tabela não tira o microfone de
     * ninguém. Só esta chamada tira.
     *
     * Se ela falhar (LiveKit fora do ar, pessoa que já saiu), engole-se o erro: a permissão volta ao
     * certo na próxima entrada, pelo token, e derrubar a resposta HTTP por causa disso deixaria a tela
     * de quem apresenta parecendo quebrada.
     */
    async function ajustarPermissao(channelId: number, userId: number, podePublicar: boolean) {
      await rooms
        .updateParticipant(voiceRoomName(channelId), String(userId), undefined, {
          canPublish: podePublicar,
          canSubscribe: true,
          canPublishData: true,
        })
        .catch(() => {});
    }

    /** O estado do palco vai para todo mundo da comunidade: a tela de cada um se ajusta sozinha. */
    function avisarPalco(channel: CommunityChannel) {
      io.to(communityRoom(channel.communityId)).emit('palco:mudou', {
        channelId: channel.id,
        apresentacao: db.ehApresentacao(channel.id),
        palco: db.lerPalco(channel.id),
      });
    }

    authed.get<{ Params: { id: string } }>('/api/channels/:id/palco', async (request, reply) => {
      const channel = channelAccess(request, reply, false);
      if (!channel) return reply;
      if (channel.type !== 'voice') return reply.code(404).send({ error: 'Sala de voz não encontrada.' });

      const role = roleIn(request.user, channel.communityId);
      return {
        apresentacao: db.ehApresentacao(channel.id),
        palco: db.lerPalco(channel.id),
        souApresentador: manages(role),
        minhaSituacao: db.situacaoNoPalco(channel.id, request.user.id),
      };
    });

    /** Liga ou desliga a apresentação. Só quem administra. */
    authed.put<{ Params: { id: string }; Body: { ligado?: boolean } }>(
      '/api/channels/:id/palco',
      async (request, reply) => {
        const channel = channelAccess(request, reply, true);
        if (!channel) return reply;
        if (channel.type !== 'voice') return reply.code(404).send({ error: 'Sala de voz não encontrada.' });

        const ligado = Boolean(request.body?.ligado);
        db.definirApresentacao(channel.id, ligado);

        // Quem está na sala AGORA precisa ter a permissão trocada na hora. Ao ligar, cala todo mundo
        // que não administra; ao desligar, devolve a voz a todos — inclusive a quem estava calado.
        const naSala = await rooms.listParticipants(voiceRoomName(channel.id)).catch(() => []);
        for (const participante of naSala) {
          const id = Number(participante.identity);
          if (!Number.isInteger(id)) continue;
          const papel = db.memberRole(channel.communityId, id);
          const podeFalar = !ligado || manages(papel);
          await ajustarPermissao(channel.id, id, podeFalar);
        }
        avisarPalco(channel);
        return { apresentacao: ligado, palco: db.lerPalco(channel.id) };
      },
    );

    /** Levantar ou baixar a mão. Qualquer um da plateia. */
    authed.post<{ Params: { id: string }; Body: { levantada?: boolean } }>(
      '/api/channels/:id/palco/mao',
      async (request, reply) => {
        const channel = channelAccess(request, reply, false);
        if (!channel) return reply;
        if (!db.ehApresentacao(channel.id)) {
          return reply.code(409).send({ error: 'Esta sala não está em apresentação.' });
        }

        const levantada = request.body?.levantada !== false;
        if (levantada) {
          // Quem já está no palco não precisa pedir a palavra: já a tem.
          if (db.situacaoNoPalco(channel.id, request.user.id) === 'palco') return { minhaSituacao: 'palco' };
          db.porNoPalco(channel.id, request.user.id, 'mao');
        } else {
          db.tirarDoPalco(channel.id, request.user.id);
        }
        avisarPalco(channel);
        return { minhaSituacao: db.situacaoNoPalco(channel.id, request.user.id) };
      },
    );

    /** Dá ou tira a palavra de alguém. Só quem administra. */
    authed.post<{ Params: { id: string; userId: string }; Body: { palco?: boolean } }>(
      '/api/channels/:id/palco/:userId',
      async (request, reply) => {
        const channel = channelAccess(request, reply, true);
        if (!channel) return reply;
        if (!db.ehApresentacao(channel.id)) {
          return reply.code(409).send({ error: 'Esta sala não está em apresentação.' });
        }

        const alvo = Number(request.params.userId);
        if (!Number.isInteger(alvo) || !db.memberRole(channel.communityId, alvo)) {
          return reply.code(404).send({ error: 'Pessoa não encontrada nesta comunidade.' });
        }

        const subir = request.body?.palco !== false;
        if (subir) db.porNoPalco(channel.id, alvo, 'palco');
        else db.tirarDoPalco(channel.id, alvo);

        // A permissão muda na hora, sem a pessoa precisar sair e voltar da chamada.
        await ajustarPermissao(channel.id, alvo, subir);
        avisarPalco(channel);
        return { palco: db.lerPalco(channel.id) };
      },
    );

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
      // Em silêncio nesta comunidade, não entra em sala de voz dela (ver advertencias-routes.ts).
      if (channel.communityId !== null && db.silenciadoAte(channel.communityId, request.user.id)) {
        return reply.code(403).send({ error: 'Você está em silêncio nesta comunidade e não pode entrar nas salas por enquanto.' });
      }

      /**
       * EM MODO APRESENTAÇÃO, QUEM NÃO ESTÁ NO PALCO ENTRA SEM PODER PUBLICAR.
       *
       * A trava fica no TOKEN, e não na tela. Um botão de microfone desabilitado no navegador é uma
       * sugestão: quem abrir o console publica assim mesmo. O LiveKit recusa a publicação de quem tem
       * canPublish falso, e é isso que faz a plateia ser plateia de verdade.
       *
       * Quem administra a comunidade publica sempre — precisa poder falar para organizar a sessão sem
       * ter que se dar palco primeiro.
       */
      const apresentando = db.ehApresentacao(channel.id);
      const role = roleIn(request.user, channel.communityId);
      const podeFalar = !apresentando || manages(role) || db.situacaoNoPalco(channel.id, request.user.id) === 'palco';

      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: String(request.user.id),
        name: request.user.username,
        ttl: '6h',
      });
      token.addGrant({
        room: voiceRoomName(channel.id),
        roomJoin: true,
        canPublish: podeFalar,
        canSubscribe: true,
        // Continua verdadeiro na plateia: é por aqui que passam os avisos do próprio LiveKit. Cortar
        // isto mudaria coisas que não têm nada a ver com falar.
        canPublishData: true,
      });
      return { url: config.livekit.url, token: await token.toJwt() };
    });
  });
}
