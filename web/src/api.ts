// `import.meta.env` é invenção do Vite e não existe quando o módulo roda direto no Node, que é como
// os testes rodam. Sem esta proteção, QUALQUER teste que encoste em api.ts — mesmo sem chegar perto da
// rede — estoura na primeira linha, antes da primeira asserção.
const ambiente = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

export const API_URL: string = ambiente?.VITE_API_URL || 'http://localhost:3001';

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
    super(message);
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
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
    });
  } catch {
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
