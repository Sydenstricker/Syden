// A largura das barras laterais, ajustável por quem usa.
//
// POR QUE ISTO EXISTE, e por que NÃO é "monte a sua interface". A ideia veio de um pedido de layout
// arrastável tipo VS Code, e a conversa chegou numa conclusão melhor: o que pesa não é a posição dos
// painéis, é o TAMANHO da letra e das listas. Quem tem tela pequena quer mais espaço para a conversa;
// quem tem tela grande e vista cansada quer nomes maiores e mais largos. Isso é acessibilidade, e
// acessibilidade se resolve com um número, não com um quebra-cabeça de painéis.
//
// As larguras viram variáveis de CSS no <html>, então o ajuste vale na hora, sem redesenhar nada.

import { chave } from './i18n';

/**
 * Cada barra, com o mínimo e o máximo que fazem sentido.
 *
 * Os nomes vão marcados com chave() porque quem os traduz é a tela, com t(BARRAS[x].nome) — texto que
 * se separa do t() fica invisível para a ferramenta que conta traduções, e ela passa a mandar apagar
 * tradução que funciona.
 */
export const BARRAS = {
  sidebar: { nome: chave('Canais'), padrao: 240, minimo: 160, maximo: 420 },
  membros: { nome: chave('Pessoas'), padrao: 240, minimo: 160, maximo: 420 },
} as const;

export type Barra = keyof typeof BARRAS;

const CHAVE = 'syden.larguras';

export interface Larguras {
  sidebar: number;
  membros: number;
  /**
   * Multiplicador aplicado às duas de uma vez.
   *
   * É o controle "coletivo" que ele pediu, e é mais útil do que ajustar barra por barra: quem precisa
   * de mais espaço costuma precisar em tudo, não numa coluna só.
   */
  escala: number;
}

export const PADRAO: Larguras = { sidebar: BARRAS.sidebar.padrao, membros: BARRAS.membros.padrao, escala: 1 };

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, Math.round(valor)));
}

/**
 * Lê do navegador, consertando o que estiver fora da faixa.
 *
 * Consertar em vez de recusar é deliberado: um valor estragado — ou salvo por uma versão antiga com
 * outros limites — deixaria a barra com 4000px de largura e o Syden inutilizável, sem erro nenhum na
 * tela e sem jeito óbvio de desfazer.
 */
export function lerLarguras(): Larguras {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return PADRAO;
    const salvo = JSON.parse(cru) as Partial<Larguras>;
    return {
      sidebar: limitar(salvo.sidebar ?? PADRAO.sidebar, BARRAS.sidebar.minimo, BARRAS.sidebar.maximo),
      membros: limitar(salvo.membros ?? PADRAO.membros, BARRAS.membros.minimo, BARRAS.membros.maximo),
      escala: Math.min(1.6, Math.max(0.8, salvo.escala ?? 1)),
    };
  } catch {
    return PADRAO;
  }
}

/** Escreve as larguras no <html> como variáveis de CSS. É o que faz o ajuste valer na hora. */
export function aplicarLarguras(larguras: Larguras) {
  const raiz = document.documentElement;
  raiz.style.setProperty('--largura-sidebar', `${Math.round(larguras.sidebar * larguras.escala)}px`);
  raiz.style.setProperty('--largura-membros', `${Math.round(larguras.membros * larguras.escala)}px`);
}

export function guardarLarguras(larguras: Larguras) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(larguras));
  } catch {
    // Navegador sem armazenamento: o ajuste vale para esta sessão, e só.
  }
  aplicarLarguras(larguras);
  for (const ouvinte of ouvintes) ouvinte(larguras);
}

/** Quem quer saber quando mudou (a tela de configurações e as próprias barras). */
const ouvintes = new Set<(l: Larguras) => void>();
export function aoMudarLarguras(ouvinte: (l: Larguras) => void) {
  ouvintes.add(ouvinte);
  // A seta com chaves engole o boolean que delete() devolve: o React exige que a limpeza de um
  // efeito não devolva nada, e devolver algo vira erro de tipo em quem usa isto.
  return () => {
    ouvintes.delete(ouvinte);
  };
}
