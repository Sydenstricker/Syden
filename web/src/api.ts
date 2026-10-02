// `import.meta.env` é invenção do Vite e não existe quando o módulo roda direto no Node, que é como
// os testes rodam. Sem esta proteção, QUALQUER teste que encoste em api.ts — mesmo sem chegar perto da
// rede — estoura na primeira linha, antes da primeira asserção.
import { t } from './i18n';

const ambiente = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

export const API_URL: string = ambiente?.VITE_API_URL || 'http://localhost:3001';

/**
 * Quanto tempo se espera por uma resposta antes de desistir.
 *
 * Trinta segundos é muito mais do que qualquer resposta legítima do Syden leva — as lentas são as
 * de enviar arquivo, e mesmo essas ficam bem abaixo. E é muito menos do que a paciência de quem
 * está olhando uma tela parada sem nada escrito.
 */
const TEMPO_LIMITE_MS = 30_000;

const TOKEN_KEY = 'janja.token';

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sem localStorage (aba anônima restrita): a sessão só dura até recarregar a página.
  }
}

/**
 * O ERRO DO SERVIDOR, NA LÍNGUA DE QUEM LÊ — e esta é a única linha que precisou mudar para isso.
 *
 * ===================================================================================================
 * AS MENSAGENS DE ERRO ERAM O MAIOR BURACO DE TRADUÇÃO DO SYDEN, e ele passou despercebido por muito
 * tempo porque nada nelas PARECE texto de interface: são `reply.send({ error: '…' })` espalhados pelo
 * servidor. Medido: 197 mensagens diferentes, mostradas em 77 lugares da tela. Quem usa o Syden em
 * japonês acertava a senha errada e recebia "A senha está incorreta." em português.
 *
 * O CONSERTO COUBE NUMA LINHA pela mesma propriedade que salvou o recibo do bot: **a chave é o texto
 * em português**. Traduzindo aqui, no único lugar por onde TODO erro do servidor passa, os 77 pontos
 * de exibição ficam como estão — nenhum deles precisa saber que existe tradução.
 *
 * E a reserva é a de sempre: mensagem que ainda não está nos dicionários sai em português, porque é
 * isso que `t()` faz com uma chave que não conhece. Ou seja, traduzir as 197 virou trabalho que pode
 * ser feito aos poucos, sem nada quebrar no meio do caminho.
 *
 * O QUE **NÃO** PASSA POR AQUI, de propósito: o `corpo` continua cru. Quem decide o que a tela faz
 * lê o campo da resposta, nunca o texto — ler texto traduzido para decidir seria depender da
 * tradução, que é ainda pior do que depender da redação.
 * ===================================================================================================
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /**
     * O corpo inteiro da resposta de erro.
     *
     * Existe porque a mensagem sozinha não basta para decidir o que a tela faz. Entrar sem ter
     * confirmado o e-mail e entrar com a senha errada são as duas coisas mais parecidas que existem do
     * lado de fora, e levam a telas completamente diferentes; quem separa é um campo na resposta, não
     * o texto. Ler o texto para decidir seria depender da redação da mensagem nunca mudar.
     */
    readonly corpo: unknown = undefined,
  ) {
    super(t(message));
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal } = {},
) {
  const token = options.token === undefined ? loadToken() : options.token;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // PRAZO. Sem ele o fetch espera para sempre, e "para sempre" é um estado que acontece de
      // verdade: rede que aceita a conexão e não responde, servidor engasgado, túnel de VPN que
      // caiu no meio. A tela fica carregando sem nada escrito e sem nada a fazer.
      //
      // Ficou urgente quando a entrada passou a esperar as preferências antes de montar a tela: um
      // pedido pendurado ali tranca a pessoa do lado de fora do Syden inteiro, e não só de uma
      // parte dele. Trinta segundos é muito mais do que qualquer resposta legítima leva, e muito
      // menos do que a paciência de quem está olhando.
      signal: options.signal ?? AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    // Desistir por prazo e não conseguir falar com o servidor são coisas diferentes para quem lê:
    // a primeira sugere tentar de novo, a segunda sugere olhar a internet.
    if (erro instanceof DOMException && erro.name === 'TimeoutError') {
      throw new ApiError('O servidor demorou demais para responder. Tente de novo.', 0);
    }
    throw new ApiError('Não foi possível falar com o servidor.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? `Erro ${response.status}`, response.status, data);
  return data as T;
}

/** URLs públicas de arquivos (servidas com cache longo: a URL muda quando o arquivo muda). */
export const mediaUrl = {
  avatar: (userId: number, version: number) => `${API_URL}/api/users/${userId}/avatar?v=${version}`,
  communityIcon: (id: number, version: number) => `${API_URL}/api/communities/${id}/icon?v=${version}`,
  emoji: (id: number) => `${API_URL}/api/emojis/${id}/image`,
  /** O desenho de um emoji que ainda está só no catálogo, antes de alguém instalar o pacote. */
  emojiDoPacote: (id: number) => `${API_URL}/api/emoji-pack-items/${id}/image`,
  sound: (id: number) => `${API_URL}/api/sounds/${id}/audio`,
  karaoke: (id: number) => `${API_URL}/api/karaoke/${id}/audio`,
  attachment: (id: number, key: string) => `${API_URL}/api/attachments/${id}/${key}`,
};
