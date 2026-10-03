import { chave } from './i18n';

/**
 * A LETRA DO NOME DA COMUNIDADE.
 *
 * ===================================================================================================
 * NENHUMA DELAS BAIXA FONTE, E ISSO É A DECISÃO, NÃO UMA LIMITAÇÃO.
 *
 * O caminho fácil seria o Google Fonts, e o Syden até já o usa — mas só para a Noto, e só quando a
 * PESSOA escolhe um idioma de escrita não latina. Ou seja: é a escolha dela, sobre o aparelho dela,
 * e quem só usa português nunca fala com o Google.
 *
 * Uma fonte de comunidade inverte isso. Quem administra escolheria, e o navegador de TODO MUNDO que
 * abrisse a comunidade iria buscar o arquivo — gente que hoje nunca encosta no Google passaria a
 * encostar, por decisão de outra pessoa. É a mesma forma do problema que fechou os GIFs numa lista
 * de domínios e que fez a capa ser baixada pelo servidor em vez de apontada.
 *
 * Então são PILHAS QUE TODO SISTEMA JÁ TEM, exatamente como os efeitos de nome (ver profileStyles.ts).
 * Nada para baixar, nada que falhe sem internet, e nada nos termos ou na política de privacidade.
 *
 * E TEM UM GANHO QUE NÃO É ÓBVIO: pilha de sistema não quebra escrita nenhuma. Uma fonte decorativa
 * baixada costuma ter só o alfabeto latino, e o nome de uma comunidade grega, tailandesa ou árabe
 * viraria quadradinho PARA TODO MUNDO — porque o nome é o mesmo para todos, escrito uma vez por quem
 * criou. A pilha termina em `inherit`, então o que o sistema não tiver cai na fonte do idioma.
 * ===================================================================================================
 *
 * As famílias são escolhidas por CONTRASTE entre si: lado a lado, as cinco têm de ser reconhecíveis
 * à primeira vista. Duas variações da mesma ideia seriam duas opções que ninguém sabe diferenciar.
 */
export interface FonteDaComunidade {
  id: string;
  nome: string;
  /** O que entra no `font-family`. Termina sempre numa família genérica, nunca num nome só. */
  pilha: string;
}

export const FONTES_DA_COMUNIDADE: FonteDaComunidade[] = [
  { id: 'padrao', nome: chave('Padrão'), pilha: '' },
  {
    id: 'serifa',
    nome: chave('Com serifa'),
    pilha: "Georgia, 'Times New Roman', 'Noto Serif', serif",
  },
  {
    id: 'mono',
    nome: chave('Máquina de escrever'),
    pilha: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Courier New', monospace",
  },
  {
    id: 'estreita',
    nome: chave('Estreita'),
    // 'Arial Narrow' existe no Windows e no macOS; no Linux a Liberation faz o papel. Sem nenhuma
    // delas, cai no sans-serif comum — mais larga, e nunca quebrada.
    pilha: "'Arial Narrow', 'Liberation Sans Narrow', 'Segoe UI Semibold', sans-serif",
  },
  {
    id: 'redonda',
    nome: chave('Arredondada'),
    // A Rounded vem no Windows 11 e a Varela no macOS; o resto do mundo cai na sans-serif do sistema.
    pilha: "'Segoe UI Variable Display', 'SF Pro Rounded', 'Varela Round', 'Trebuchet MS', sans-serif",
  },
];

const PORID = new Map(FONTES_DA_COMUNIDADE.map((f) => [f.id, f]));

/**
 * A pilha de uma escolha, ou vazio para a fonte de sempre.
 *
 * Escolha que este site não conhece vira a padrão, e não um `font-family` inventado: o servidor pode
 * ser mais novo que o site que a pessoa tem aberto.
 */
export function pilhaDaFonte(escolha: string | null | undefined): string {
  return (escolha && PORID.get(escolha)?.pilha) || '';
}
