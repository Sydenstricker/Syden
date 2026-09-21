export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  if (!response.ok) throw new ApiError(data.error ?? `Erro ${response.status}`, response.status);
  return data as T;
}

/** URLs públicas de arquivos (servidas com cache longo: a URL muda quando o arquivo muda). */
export const mediaUrl = {
  avatar: (userId: number, version: number) => `${API_URL}/api/users/${userId}/avatar?v=${version}`,
  communityIcon: (id: number, version: number) => `${API_URL}/api/communities/${id}/icon?v=${version}`,
  emoji: (id: number) => `${API_URL}/api/emojis/${id}/image`,
  sound: (id: number) => `${API_URL}/api/sounds/${id}/audio`,
  attachment: (id: number, key: string) => `${API_URL}/api/attachments/${id}/${key}`,
};
