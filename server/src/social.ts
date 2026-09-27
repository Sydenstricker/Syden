/**
 * Entrar no Syden com a conta do Google ou do Discord.
 *
 * ## Por que o caminho é mais comprido do que parece
 *
 * O jeito ingênuo é: o Google volta para o nosso endereço com um código, a gente troca por um perfil e
 * manda o navegador para o site com o token na URL. Isso tem um furo conhecido — **login CSRF**: um
 * atacante começa o fluxo com a conta DELE, guarda o link de volta e faz a vítima abrir esse link. A
 * vítima entra, sem perceber, na conta do atacante — e passa a escrever ali, achando que é a sua.
 *
 * Por isso o fluxo daqui é em duas metades, no mesmo espírito do PKCE:
 *
 * 1. O navegador sorteia um SEGREDO, guarda só com ele, e manda ao servidor apenas o RESUMO (sha256).
 * 2. O Google volta para o servidor. O servidor resolve tudo, mas **não entrega o token**: guarda um
 *    comprovante de uso único e manda o navegador para o site com o número desse comprovante.
 * 3. O site troca o comprovante pelo token — apresentando o segredo. Só o navegador que COMEÇOU tem
 *    esse segredo, então o link de volta não serve para mais ninguém.
 *
 * ## Quando duas contas são a mesma pessoa
 *
 * Só se juntam contas pelo e-mail quando **os dois lados confirmaram esse e-mail**: o Google diz que
 * confirmou o dele, e o Syden precisa ter confirmado o nosso. Sem essa regra existe um ataque bobo e
 * eficaz: alguém cria uma conta no Syden com o SEU e-mail, nunca confirma, e espera. No dia em que você
 * entra com o Google, você cai dentro da conta dele — que ele também sabe a senha. Com a regra, você
 * ganha uma conta nova, que é o certo.
 */
import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

export type Provedor = 'google' | 'discord' | 'github' | 'steam';

/** Os que falam OAuth 2.0. A Steam fica de fora porque usa OpenID 2.0 — ver o comentário mais abaixo. */
export type ProvedorOAuth = Exclude<Provedor, 'steam'>;

/** Estreita o tipo e, de quebra, é a pergunta "este aqui segue o caminho normal?". */
export function ehOAuth(provedor: Provedor): provedor is ProvedorOAuth {
  return provedor !== 'steam';
}

export interface PerfilSocial {
  /** O identificador da pessoa NAQUELE provedor. Nunca muda, mesmo que ela troque de e-mail. */
  sub: string;
  email: string | null;
  /** O provedor confirmou o e-mail? Sem isso, o e-mail não serve para juntar contas. */
  emailVerificado: boolean;
  /** Uma sugestão de nome de usuário. Pode já existir no Syden; quem resolve isso é quem cria a conta. */
  apelido: string;
}

interface Config {
  clientId: string;
  clientSecret: string;
  autorizar: string;
  token: string;
  perfil: string;
  escopo: string;
}

const PROVEDORES: Record<ProvedorOAuth, Config> = {
  google: {
    clientId: config.social.google.clientId,
    clientSecret: config.social.google.clientSecret,
    autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    perfil: 'https://openidconnect.googleapis.com/v1/userinfo',
    escopo: 'openid email profile',
  },
  github: {
    clientId: config.social.github.clientId,
    clientSecret: config.social.github.clientSecret,
    autorizar: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    perfil: 'https://api.github.com/user',
    // "user:email" é o que deixa buscar o e-mail CONFIRMADO. Sem ele, o e-mail do perfil vem só se a
    // pessoa tiver deixado público — e a maioria não deixa, então quase ninguém seria reconhecido.
    escopo: 'read:user user:email',
  },
  discord: {
    clientId: config.social.discord.clientId,
    clientSecret: config.social.discord.clientSecret,
    autorizar: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    perfil: 'https://discord.com/api/users/@me',
    escopo: 'identify email',
  },
};

/**
 * A STEAM NÃO FALA OAUTH. Ela usa OpenID 2.0, que é de 2007 e funciona de outro jeito: não existe
 * "code" para trocar por "token", não existe segredo de cliente, e a resposta volta inteira na URL —
 * que a gente tem que mandar de volta para a Steam perguntando "isto saiu mesmo de você?".
 *
 * Duas consequências que aparecem na tela:
 *
 *  - **Não vem e-mail.** A Steam só diz o número da conta. Então quem entra só pela Steam não tem como
 *    recuperar a senha por e-mail e não é reconhecido como uma conta que já existia — precisa cadastrar
 *    um endereço depois, nas configurações.
 *  - **O nome vem de outra chamada**, com uma chave de API (grátis, feita em segundos). Sem a chave, a
 *    entrada até funcionaria, mas a pessoa nasceria chamada "jogador123456" — por isso a chave é
 *    exigida para o botão aparecer.
 */
const STEAM_LOGIN = 'https://steamcommunity.com/openid/login';
const STEAM_PERFIL = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/';

export const PROVEDORES_POSSIVEIS: Provedor[] = ['google', 'discord', 'github', 'steam'];

/** Um provedor só aparece na tela de entrada quando tem as duas chaves configuradas. */
export function ligado(provedor: Provedor): boolean {
  if (provedor === 'steam') return Boolean(config.social.steamApiKey);
  const c = PROVEDORES[provedor];
  return Boolean(c?.clientId && c?.clientSecret);
}

export function provedoresLigados(): Provedor[] {
  return PROVEDORES_POSSIVEIS.filter(ligado);
}

export function ehProvedor(valor: unknown): valor is Provedor {
  return typeof valor === 'string' && (PROVEDORES_POSSIVEIS as string[]).includes(valor);
}

/** Para onde o provedor devolve o navegador. Tem que bater LETRA POR LETRA com o que foi cadastrado lá. */
export function enderecoDeVolta(provedor: Provedor): string {
  return `${config.social.apiUrl}/api/auth/social/${provedor}/volta`;
}

export function resumo(segredo: string): string {
  return createHash('sha256').update(segredo).digest('base64url');
}

export function sortear(): string {
  return randomBytes(32).toString('base64url');
}

/** O endereço para onde mandar o navegador, já com tudo o que o provedor espera. */
export function enderecoDeEntrada(provedor: Provedor, estado: string): string {
  if (provedor === 'steam') {
    // O OpenID 2.0 não tem campo "state". O jeito de levar o nosso é pendurá-lo no endereço de volta,
    // que a Steam devolve intacto — e é por isso que o `state` continua chegando como query na volta.
    const volta = `${enderecoDeVolta('steam')}?state=${encodeURIComponent(estado)}`;
    const parametros = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': volta,
      'openid.realm': config.social.apiUrl,
      // "identifier_select" é como se diz "não sei quem é, pergunte a ela".
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });
    return `${STEAM_LOGIN}?${parametros}`;
  }

  const c = PROVEDORES[provedor];
  const parametros = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: enderecoDeVolta(provedor),
    response_type: 'code',
    scope: c.escopo,
    state: estado,
    // Pede a tela de escolha de conta em vez de entrar direto na última usada: quem tem duas contas de
    // Google no mesmo navegador precisa poder escolher.
    ...(provedor === 'google' ? { prompt: 'select_account' } : {}),
  });
  return `${c.autorizar}?${parametros}`;
}

/** Troca o código por um perfil. Devolve null quando o provedor recusou ou respondeu torto. */
export async function buscarPerfil(provedor: ProvedorOAuth, codigo: string): Promise<PerfilSocial | null> {
  const c = PROVEDORES[provedor];
  try {
    const resposta = await fetch(c.token, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        code: codigo,
        grant_type: 'authorization_code',
        redirect_uri: enderecoDeVolta(provedor),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) return null;
    const { access_token } = (await resposta.json()) as { access_token?: string };
    if (!access_token) return null;

    const perfil = await fetch(c.perfil, {
      headers: { authorization: `Bearer ${access_token}`, accept: `application/json` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!perfil.ok) return null;
    const lido = lerPerfil(provedor, await perfil.json());
    if (!lido) return null;

    // O GitHub só põe o e-mail no perfil quando a pessoa o deixou PÚBLICO, e a maioria não deixa. O
    // endereço de verdade — e o "este foi confirmado" — mora numa lista à parte.
    if (provedor === 'github') {
      const emails = await fetch(`${c.perfil}/emails`, {
        headers: { authorization: `Bearer ${access_token}`, accept: `application/json` },
        signal: AbortSignal.timeout(10_000),
      });
      if (emails.ok) return { ...lido, ...(emailDoGithub(await emails.json()) ?? {}) };
    }
    return lido;
  } catch {
    // Provedor fora do ar, rede caída, resposta que não é JSON: nada disso vira erro 500 na cara de
    // quem só queria entrar. Vira "não deu, tente pela senha".
    return null;
  }
}

/** A resposta de cada provedor virando o mesmo formato. Separado para dar para testar sem rede. */
export function lerPerfil(provedor: Provedor, corpo: unknown): PerfilSocial | null {
  const c = corpo as Record<string, unknown> | null;
  if (!c || typeof c !== 'object') return null;

  if (provedor === 'google') {
    const sub = typeof c.sub === 'string' ? c.sub : '';
    if (!sub) return null;
    const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : null;
    return {
      sub,
      email,
      // O Google manda como booleano; alguns clientes antigos mandavam a string "true".
      emailVerificado: c.email_verified === true || c.email_verified === 'true',
      apelido: (typeof c.given_name === 'string' && c.given_name) || (typeof c.name === 'string' && c.name) || email?.split('@')[0] || 'pessoa',
    };
  }

  if (provedor === 'github') {
    // O id do GitHub vem como NÚMERO, e não como texto. Guardar ora um ora outro faria a mesma pessoa
    // virar duas contas dependendo do dia.
    const sub = typeof c.id === 'number' ? String(c.id) : typeof c.id === 'string' ? c.id : '';
    if (!sub) return null;
    const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : null;
    return {
      sub,
      email,
      // O e-mail do perfil público do GitHub não vem com selo de confirmado. Quem confirma é a lista
      // de e-mails, lida logo depois em buscarPerfil.
      emailVerificado: false,
      apelido: (typeof c.login === 'string' && c.login) || 'pessoa',
    };
  }

  if (provedor === 'steam') {
    const sub = typeof c.steamid === 'string' ? c.steamid : '';
    if (!sub) return null;
    // A Steam NUNCA manda e-mail. Não é uma falha nossa: ela não tem esse campo para dar.
    return { sub, email: null, emailVerificado: false, apelido: (typeof c.personaname === 'string' && c.personaname) || 'jogador' };
  }

  const id = typeof c.id === 'string' ? c.id : '';
  if (!id) return null;
  const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : null;
  return {
    sub: id,
    email,
    emailVerificado: c.verified === true,
    apelido: (typeof c.username === 'string' && c.username) || email?.split('@')[0] || 'pessoa',
  };
}

/**
 * O e-mail principal E confirmado da lista do GitHub.
 *
 * Só serve o que é primário e confirmado ao mesmo tempo: um e-mail não confirmado juntaria a conta do
 * Syden de outra pessoa com esta, e é exatamente isso que a regra de juntar contas existe para evitar.
 */
export function emailDoGithub(corpo: unknown): { email: string; emailVerificado: true } | null {
  if (!Array.isArray(corpo)) return null;
  const escolhido = corpo.find(
    (e) => e && typeof e === 'object' && (e as Record<string, unknown>).primary === true && (e as Record<string, unknown>).verified === true,
  ) as { email?: unknown } | undefined;
  const email = typeof escolhido?.email === 'string' ? escolhido.email.trim().toLowerCase() : '';
  return email ? { email, emailVerificado: true } : null;
}

/**
 * Confere com a Steam que aquela volta saiu MESMO dela, e devolve o número da conta.
 *
 * Este passo não é opcional nem "por garantia": sem ele, qualquer pessoa monta à mão um endereço de
 * volta dizendo ser a conta 7656119..., e entra como ela. Quem responde "isto é verdade" é a Steam, e
 * a resposta dela é literalmente a linha `is_valid:true`.
 */
export async function conferirComASteam(parametros: Record<string, string | undefined>): Promise<string | null> {
  const corpo = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (chave.startsWith('openid.') && typeof valor === 'string') corpo.set(chave, valor);
  }
  if (!corpo.has('openid.signed') || !corpo.has('openid.sig')) return null;
  // A única troca em relação ao que a Steam mandou: o modo vira a pergunta.
  corpo.set('openid.mode', 'check_authentication');

  try {
    const resposta = await fetch(STEAM_LOGIN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: corpo,
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) return null;
    if (!/is_valid\s*:\s*true/.test(await resposta.text())) return null;
  } catch {
    return null;
  }

  return steamIdDe(parametros[`openid.claimed_id`]);
}

/** O número da conta dentro do endereço que a Steam devolve. Qualquer outro formato é recusado. */
export function steamIdDe(claimedId: string | undefined): string | null {
  const achado = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId ?? '');
  return achado ? achado[1] : null;
}

/** O nome de quem joga, buscado à parte porque o OpenID não manda nada além do número. */
export async function perfilDaSteam(steamId: string): Promise<PerfilSocial> {
  const semNome: PerfilSocial = { sub: steamId, email: null, emailVerificado: false, apelido: 'jogador' };
  if (!config.social.steamApiKey) return semNome;
  try {
    const resposta = await fetch(`${STEAM_PERFIL}?key=${config.social.steamApiKey}&steamids=${steamId}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!resposta.ok) return semNome;
    const corpo = (await resposta.json()) as { response?: { players?: unknown[] } };
    return lerPerfil('steam', corpo.response?.players?.[0]) ?? semNome;
  } catch {
    // Sem o nome a entrada continua funcionando: a pessoa só nasce com um nome mais sem graça.
    return semNome;
  }
}

/**
 * Um nome de usuário que caiba nas regras do Syden, a partir do que o provedor mandou.
 *
 * `existe` responde se um nome já está tomado; a função tenta o limpo, depois numerado. Sem isso, duas
 * pessoas chamadas "Ana" no Google se atropelariam e a segunda não conseguiria entrar nunca.
 */
export function nomeDisponivel(apelido: string, existe: (nome: string) => boolean): string {
  const limpo =
    apelido
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // tira acento: "João" vira "Joao"
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(0, 16) || 'pessoa';

  if (!existe(limpo) && limpo.length >= 3) return limpo;
  const base = limpo.length >= 3 ? limpo : 'pessoa';
  for (let i = 2; i < 1000; i++) {
    const tentativa = `${base.slice(0, 16 - String(i).length)}${i}`;
    if (!existe(tentativa)) return tentativa;
  }
  // Mil nomes tomados é improvável, mas não pode travar a entrada de ninguém.
  return `pessoa${randomBytes(4).toString('hex')}`;
}
