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

/*
 * O NAVEGADOR NÃO SABE NÚMERO EM TODAS AS LÍNGUAS — E QUANDO NÃO SABE, ELE NÃO AVISA.
 *
 * O Chrome traz dados de formatação só para parte das línguas. Medido nele, 29 das 77 da lista do
 * Syden não têm dados (birmanês, nepalês, hauçá, iorubá, albanês, georgiano…). Para essas, o
 * `Intl.NumberFormat` não falha: ele cai no idioma DO COMPUTADOR. Numa tela em birmanês, num Windows
 * em português, "43 milhões" saía "43 mi" — abreviação portuguesa — e 1234567 saía "1.234.567" com
 * os algarismos latinos, quando o birmanês escreve ၁,၂၃၄,၅၆၇.
 *
 * O Node tem os dados completos, e por isso a medição da fila (scripts/fila-de-idiomas.mjs) dizia
 * o contrário do que a tela mostrava.
 *
 * A saída: quando o navegador não conhece a língua, o Syden decide — separação de milhar neutra
 * (a do inglês) e os algarismos da própria escrita, que o navegador conhece mesmo sem conhecer a
 * língua. Só duas das 29 não usam 0-9, medido no Node: birmanês e nepalês.
 */
const ALGARISMOS_PROPRIOS: Record<string, string> = {
  my: 'mymr',
  ne: 'deva',
  // O dzongkha entrou depois da medição acima, e é o terceiro: o Chrome não tem dados dele, e a
  // numeração da escrita (CLDR) é a tibetana, ༡༢༣. Medido no Chrome: sem esta linha, 1234567 saía
  // "1.234.567", no formato do computador.
  dz: 'tibt',
};

/** O navegador tem dados de número desta língua? */
function conhecido(idioma: string): boolean {
  try {
    return Intl.NumberFormat.supportedLocalesOf(idioma).length > 0;
  } catch {
    return false;
  }
}

function reserva(idioma: string): string {
  const sistema = ALGARISMOS_PROPRIOS[idioma.split('-')[0]];
  return sistema ? `en-u-nu-${sistema}` : 'en';
}

/** Um número escrito com os algarismos da língua de quem lê. */
export function algarismos(n: number, idioma: string = idiomaAtual()): string {
  try {
    return new Intl.NumberFormat(conhecido(idioma) ? idioma : reserva(idioma)).format(n);
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
  // Sem dados da língua, a abreviação sairia na de outra ("43 mi", "43M"). O número inteiro, nos
  // algarismos dela, é mais comprido e é verdade.
  if (!conhecido(idioma)) return algarismos(milhoes * 1_000_000, idioma);
  try {
    return new Intl.NumberFormat(idioma, { notation: 'compact', maximumFractionDigits: 1 }).format(milhoes * 1_000_000);
  } catch {
    return `${milhoes} mi`;
  }
}
