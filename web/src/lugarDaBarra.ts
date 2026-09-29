// O que ocupa o lugar da barra lateral, a cada momento da entrada.
//
// POR QUE ISTO VIROU UMA FUNÇÃO SEPARADA. A regra é de três linhas e errou de DOIS jeitos diferentes
// em dois dias, os dois vistos por quem usa e nenhum por quem escreveu:
//
//   1. Dizia "você não está em nenhuma comunidade" enquanto a comunidade ainda estava a caminho. Uma
//      frase falsa por um segundo, na primeira tela depois de entrar.
//   2. Corrigido o primeiro, ficou o buraco no lugar da frase: a tela nascia sem barra lateral e ela
//      entrava depois, empurrando a vila inteira para o lado. Quem viu descreveu como travamento.
//
// Os dois têm a mesma forma: a tela mostrando algo que não corresponde ao estado real. Dentro do JSX,
// no meio de um ternário aninhado, isso não se enxerga e não se testa. Aqui é uma tabela de quatro
// casos, e a tabela está no teste.
//
// ENTRAR NO SYDEN TEM DUAS ESPERAS, e é o que torna a regra menos óbvia do que parece:
//
//   1. a LISTA de comunidades (GET /api/communities) — durante ela não se sabe nem se existe alguma;
//   2. o CONTEÚDO da comunidade aberta (canais, membros, primeiras mensagens), que vem numa segunda
//      ida ao servidor de propósito, para a tela trocar de uma vez em vez de aos pedaços.
//
// Em nenhuma das duas se pode dizer que não há comunidades, e em nenhuma das duas o espaço pode ficar
// vazio — senão a tela salta quando o conteúdo chega.

export type LugarDaBarra =
  /** A barra de verdade, com os canais da comunidade que está na tela. */
  | 'barra'
  /** O espaço guardado, da mesma largura, enquanto alguma das duas esperas acontece. */
  | 'esperando'
  /** A pessoa não participa de nenhuma comunidade — e isto já é sabido, não suposto. */
  | 'sem-comunidades';

export function lugarDaBarra({
  /** Existe uma comunidade DESENHADA na tela? Não basta estar na lista: os canais dela têm de ter chegado. */
  comunidadeNaTela,
  /** A lista de comunidades já voltou do servidor? */
  listaChegou,
  /** Quantas comunidades a lista trouxe. Só vale quando ela chegou. */
  quantas,
}: {
  comunidadeNaTela: boolean;
  listaChegou: boolean;
  quantas: number;
}): LugarDaBarra {
  if (comunidadeNaTela) return 'barra';
  if (!listaChegou) return 'esperando';
  return quantas > 0 ? 'esperando' : 'sem-comunidades';
}
