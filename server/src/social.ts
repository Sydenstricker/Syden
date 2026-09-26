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

export type Provedor = 'google' | 'discord';

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

const PROVEDORES: Record<Provedor, Config> = {
  google: {
    clientId: config.social.google.clientId,
    clientSecret: config.social.google.clientSecret,
    autorizar: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    perfil: 'https://openidconnect.googleapis.com/v1/userinfo',
    escopo: 'openid email profile',
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

export const PROVEDORES_POSSIVEIS = Object.keys(PROVEDORES) as Provedor[];

/** Um provedor só aparece na tela de entrada quando tem as duas chaves configuradas. */
export function ligado(provedor: Provedor): boolean {
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
export async function buscarPerfil(provedor: Provedor, codigo: string): Promise<PerfilSocial | null> {
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
      headers: { authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!perfil.ok) return null;
    return lerPerfil(provedor, await perfil.json());
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
