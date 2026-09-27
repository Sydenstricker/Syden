/**
 * O selo da comunidade: quatro letras, um ícone e uma cor que os membros exibem.
 *
 * ---------------------------------------------------------------------------------------------------
 * POR QUE ELE NÃO SE COMPRA.
 *
 * O Discord tem isto e destrava com três assinaturas pagas. Funciona, e significa uma coisa só: que
 * alguém pagou. No Syden tudo é livre, então copiar o mecanismo seria copiar justamente a parte que
 * não interessa.
 *
 * Aqui o selo se conquista, e os marcos foram escolhidos para serem **impossíveis de alcançar
 * sozinho**. Cada um exige mais de uma pessoa fazendo alguma coisa ao longo do tempo:
 *
 *   - não basta convidar gente: tem de haver gente CONVERSANDO, de contas diferentes;
 *   - não basta um dia animado: tem de haver conversa em dias diferentes;
 *   - não basta escrever: entrar na sala de voz junto conta como marco próprio.
 *
 * Isso é de propósito. Um marco que uma pessoa cumpre sozinha com contas falsas mede persistência de
 * quem trapaceia, não mérito de um grupo — e um selo assim não significaria nada para quem o vê.
 *
 * O selo APARECE quando o primeiro marco cai. Os outros continuam valendo como história da
 * comunidade, e ficam visíveis para todo mundo: é o que faz alguém querer o próximo.
 */

export interface FatosDaComunidade {
  membros: number;
  /** Quantas contas DIFERENTES já escreveram alguma mensagem ali. */
  pessoasQueEscreveram: number;
  /** Em quantos dias diferentes houve conversa. Mede constância, não volume. */
  diasComConversa: number;
  /** Segundos somados de sala de voz. Só existe a partir de 27/09/2026 (ver db.ts). */
  segundosDeVoz: number;
}

export interface Marco {
  codigo: string;
  nome: string;
  /** Como se ganha, na voz de quem lê: aparece na tela exatamente assim. */
  comoSeGanha: string;
  /** Quanto falta, de 0 a 1, para a barra de progresso. */
  progresso: (f: FatosDaComunidade) => number;
  alcancado: (f: FatosDaComunidade) => boolean;
}

/** Progresso que nunca passa de 1 nem fica negativo, para a barra não vazar. */
const ate1 = (quanto: number, alvo: number) => Math.max(0, Math.min(1, quanto / alvo));

export const MARCOS: readonly Marco[] = [
  {
    codigo: 'turma',
    nome: 'Turma formada',
    comoSeGanha: '5 membros, e pelo menos 3 pessoas diferentes já conversaram',
    // As DUAS condições juntas. Só "5 membros" seria convite; só "3 conversaram" seria um trio. O
    // que se quer dizer com este selo é "aqui tem gente, e a gente se fala".
    progresso: (f) => Math.min(ate1(f.membros, 5), ate1(f.pessoasQueEscreveram, 3)),
    alcancado: (f) => f.membros >= 5 && f.pessoasQueEscreveram >= 3,
  },
  {
    codigo: 'casa-cheia',
    nome: 'Casa cheia',
    comoSeGanha: '15 membros na comunidade',
    progresso: (f) => ate1(f.membros, 15),
    alcancado: (f) => f.membros >= 15,
  },
  {
    codigo: 'constancia',
    nome: 'Não para nunca',
    comoSeGanha: 'conversa em 10 dias diferentes',
    // Dias DIFERENTES, e não quantidade de mensagem: uma tarde muito animada não é constância, e
    // contar mensagem premiaria quem escreve muito em vez do grupo que se encontra sempre.
    progresso: (f) => ate1(f.diasComConversa, 10),
    alcancado: (f) => f.diasComConversa >= 10,
  },
  {
    codigo: 'vozes',
    nome: 'Vozes juntas',
    comoSeGanha: '5 horas somadas de sala de voz',
    progresso: (f) => ate1(f.segundosDeVoz, 5 * 3600),
    alcancado: (f) => f.segundosDeVoz >= 5 * 3600,
  },
];

/** O primeiro marco é o que destrava o selo; os outros são história. */
export const MARCO_QUE_DESTRAVA = MARCOS[0].codigo;

export function marcosAlcancados(fatos: FatosDaComunidade): string[] {
  return MARCOS.filter((m) => m.alcancado(fatos)).map((m) => m.codigo);
}

export function podeUsarSelo(fatos: FatosDaComunidade): boolean {
  return MARCOS[0].alcancado(fatos);
}

// ---------------------------------------------------------------------------------------------------
// O selo em si
// ---------------------------------------------------------------------------------------------------

/**
 * Os ícones disponíveis, por nome.
 *
 * Lista fechada de propósito. Deixar subir uma imagem qualquer transformaria o selo — que aparece do
 * lado do nome das pessoas, no chat inteiro — num espaço de publicidade e, mais cedo do que tarde,
 * em algo que alguém teria de moderar. Um nome escolhido de uma lista não tem esse problema.
 */
export const ICONES = ['estrela', 'coelho', 'coroa', 'fogo', 'folha', 'raio', 'coracao', 'escudo', 'lua', 'trevo'] as const;
export type Icone = (typeof ICONES)[number];

/** As cores, também fechadas: todas legíveis sobre o fundo claro e o escuro. */
export const CORES = ['#5865f2', '#23a55a', '#e67e22', '#d83c3e', '#9b59b6', '#1abc9c', '#e91e63', '#f0b232'] as const;
export type Cor = (typeof CORES)[number];

export interface Selo {
  texto: string;
  icone: Icone;
  cor: Cor;
}

/**
 * Até 4 caracteres, sem espaço e sem emoji.
 *
 * O limite não é capricho: o selo fica colado no nome de cada pessoa, em cada mensagem. Um texto
 * maior empurraria o nome para fora da tela nas janelas estreitas, e um emoji dentro dele mudaria de
 * altura conforme o sistema, desalinhando a linha inteira do chat.
 */
const TEXTO_VALIDO = /^[\p{L}\p{N}!?+\-*#&@]{1,4}$/u;

export function conferirSelo(corpo: unknown): { ok: true; selo: Selo } | { ok: false; erro: string } {
  const c = corpo as Partial<Selo> | null;
  const texto = typeof c?.texto === 'string' ? c.texto.trim() : '';

  if (!TEXTO_VALIDO.test(texto)) {
    return { ok: false, erro: 'O selo tem de ter de 1 a 4 caracteres, sem espaços nem emojis.' };
  }
  if (!ICONES.includes(c?.icone as Icone)) return { ok: false, erro: 'Escolha um dos ícones da lista.' };
  if (!CORES.includes(c?.cor as Cor)) return { ok: false, erro: 'Escolha uma das cores da lista.' };

  return { ok: true, selo: { texto, icone: c!.icone as Icone, cor: c!.cor as Cor } };
}
