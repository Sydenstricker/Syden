/**
 * O LINK DA AULA (?aula=…), do lado do site. Ver server/src/aula-routes.ts.
 *
 * Como o ?convite=, ele é lido uma vez e tirado da barra de endereço — mas, ao contrário dele, fica
 * guardado na ABA (sessionStorage) até ser usado: quem abre o link e escolhe "Já tenho conta" passa
 * pela tela de entrada, e o link precisa sobreviver a esse desvio para pôr a pessoa na sala depois.
 *
 * E a aula EM ANDAMENTO também fica na aba: recarregar a página no meio da aula volta ao modo sala,
 * na mesma sala, em vez de largar o aluno no Syden inteiro.
 */
const CHAVE_LINK = 'syden.aula.link';
const CHAVE_EM_CURSO = 'syden.aula.emCurso';

function guardar(chave: string, valor: string | null) {
  try {
    if (valor === null) sessionStorage.removeItem(chave);
    else sessionStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: vale até recarregar
  }
}

function ler(chave: string): string | null {
  try {
    return sessionStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** O token do link, vindo da URL agora ou guardado de antes nesta aba. */
export function lerLinkDaAula(): string | null {
  const url = new URL(window.location.href);
  const daUrl = url.searchParams.get('aula');
  if (daUrl) {
    url.searchParams.delete('aula');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    guardar(CHAVE_LINK, daUrl);
    return daUrl;
  }
  return ler(CHAVE_LINK);
}

/** O link foi usado (ou não vale mais): sai da aba. */
export function esquecerLinkDaAula() {
  guardar(CHAVE_LINK, null);
}

export interface AulaEmCurso {
  communityId: number;
  channelId: number;
}

export function lerAulaEmCurso(): AulaEmCurso | null {
  try {
    const valor = JSON.parse(ler(CHAVE_EM_CURSO) ?? 'null');
    return valor && Number.isInteger(valor.communityId) && Number.isInteger(valor.channelId) ? valor : null;
  } catch {
    return null;
  }
}

export function guardarAulaEmCurso(aula: AulaEmCurso | null) {
  guardar(CHAVE_EM_CURSO, aula ? JSON.stringify(aula) : null);
}

/** O endereço que quem dá a aula manda para a turma. */
export function enderecoDaAula(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?aula=${encodeURIComponent(token)}`;
}
