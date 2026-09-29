import { api } from './api';

export interface Gif {
  id: string;
  url: string;
  largura: number;
  altura: number;
  previa: string;
  previaLargura: number;
  previaAltura: number;
  descricao: string;
}

export type RespostaDeGifs =
  | { estado: 'ok'; itens: Gif[]; proxima: number | null }
  | { estado: 'desligado' }
  | { estado: 'sem-cota' }
  | { estado: 'indisponivel' }
  | { estado: 'devagar'; segundos: number };

/**
 * Os endereços de onde um GIF pode vir, e por que isto é uma LISTA FECHADA.
 *
 * Uma mensagem que é só um endereço vira imagem na conversa de todo mundo. Se a regra fosse "acaba em
 * .gif", qualquer pessoa colaria um endereço de um servidor qualquer e faria o Syden BUSCAR aquilo do
 * navegador de cada um que abrisse a conversa — o que entrega o endereço de rede de todo mundo a quem
 * colou, e o que aparece na tela deixa de ser escolha nossa. Aqui só entram os domínios do GIPHY, que
 * é de onde o seletor tira os GIFs, e a política de segurança do site (a CSP) só libera esses mesmos.
 *
 * Endereço de fora continua aparecendo como LINK, clicável, que é o comportamento de sempre: quem
 * clica sabe que está indo para outro lugar.
 *
 * A LISTA É EXATAMENTE A DA CSP, nem um host a mais. São duas listas para o mesmo conteúdo, em dois
 * arquivos que ninguém edita junto — então web/test/gifs.test.ts LÊ a política e confere as duas. Sem
 * isso, o jeito de descobrir que elas se separaram seria um GIF quebrado na conversa de alguém.
 */
const CASAS_DE_GIF = /^https:\/\/(media[0-4]?|i)\.giphy\.com\/[\w./-]+\.(gif|webp)(\?[\w=&.-]*)?$/;

/**
 * A mensagem é um GIF sozinho?
 *
 * Só quando o endereço é a mensagem INTEIRA. Endereço no meio de uma frase continua sendo link: quem
 * escreveu "olha isso https://... e me diz" escreveu um texto, não mandou uma figura, e trocar o meio
 * da frase por uma imagem embaralharia o que a pessoa quis dizer.
 */
export function gifDaMensagem(conteudo: string): string | null {
  const texto = conteudo.trim();
  return CASAS_DE_GIF.test(texto) ? texto : null;
}

export async function procurarGifs(termo: string, de: number, idioma: string): Promise<RespostaDeGifs> {
  try {
    const busca = new URLSearchParams({ de: String(de), idioma });
    if (termo.trim()) busca.set('q', termo.trim());
    return await api<RespostaDeGifs>(`/api/gifs?${busca}`);
  } catch {
    return { estado: 'indisponivel' };
  }
}

/**
 * Tem GIF neste Syden?
 *
 * Perguntado UMA VEZ por sessão e guardado, porque a resposta não muda enquanto o servidor não
 * reinicia — e porque a pergunta serve para decidir se o botão existe. Botão que não pode funcionar é
 * pior do que botão nenhum: ele promete uma coisa e depois explica por que não.
 */
let perguntado: Promise<boolean> | null = null;
export function gifsDisponiveis(): Promise<boolean> {
  perguntado ??= procurarGifs('', 0, 'pt').then((r) => r.estado !== 'desligado');
  return perguntado;
}
