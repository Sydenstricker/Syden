// Todo número que aparece na tela passa por aqui.
//
// POR QUE ISTO NÃO É EXAGERO. Quase toda língua usa 0-9, mas não todas: o bengali escreve
// ০১২৩৪৫৬৭৮৯. A tela da grade de países ficou com "১৯৩টি … 1টি" na mesma frase — o 193 veio da
// tradução, escrito em bengali, e o 1 veio do código, escrito em ocidental. Quem lê bengali vê duas
// grafias de número na mesma linha, e é o tipo de coisa que faz um app parecer mal-acabado sem que
// ninguém saiba apontar por quê.
//
// `Intl.NumberFormat` resolve os algarismos e a separação de milhar de uma vez, nas dezessete línguas
// de hoje e nas que vierem. Escrever `String(n)` é o que parece simples e é o que erra.
//
// O `try` existe porque `Intl` recebe um código de idioma vindo de fora e lança RangeError em código
// malformado. Uma tela não pode sumir por causa de um número.
import { idiomaAtual } from './i18n';

/** Um número escrito com os algarismos da língua de quem lê. */
export function algarismos(n: number, idioma: string = idiomaAtual()): string {
  try {
    return new Intl.NumberFormat(idioma).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Número grande, na unidade que a língua de quem lê usa de verdade.
 *
 * O chinês conta em 亿, que vale CEM MILHÕES. Traduzir "bilhão" à mão teria escrito 150 milhões onde a
 * intenção era 1,5 bilhão, e ninguém da dupla lê chinês para perceber. O `notation: 'compact'` sabe
 * disso em todas as línguas; nós não saberíamos em nenhuma.
 */
export function emGente(milhoes: number, idioma: string = idiomaAtual()): string {
  try {
    return new Intl.NumberFormat(idioma, { notation: 'compact', maximumFractionDigits: 1 }).format(milhoes * 1_000_000);
  } catch {
    return `${milhoes} mi`;
  }
}
