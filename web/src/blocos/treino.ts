import { COLUNAS, criar, LINHAS, VAZIO, type Estado } from './sim';

/**
 * O TREINO DA CADEIA (21/11/2026, a segunda auditoria, lote D): situações prontas em que UMA troca solta uma cadeia (o que some
 * faz cair o de cima, que combina de novo). A tela mostra a jogada (a dica) e deixa tentar; tudo roda aqui, com a regra de
 * sempre (sim.ts), sem servidor e sem recorde: é para aprender. Cada lição é conferida no teste (web/test/blocos.test.ts): sem a
 * troca nada some, e com ela a cadeia chega ao número dela.
 *
 * As linhas vão de cima para baixo e ficam encostadas no fundo ('.' vazio, '0' a '5' os legumes); a troca é na horizontal, da
 * casa (l, c) com a (l, c + 1), com `l` contado nas linhas da lição.
 */
export interface LicaoDaCadeia {
  linhas: readonly string[];
  l: number;
  c: number;
  cadeia: number;
}

export const LICOES_DA_CADEIA: readonly LicaoDaCadeia[] = [
  { linhas: ['.1.3..', '.2.1..', '03.3..', '21.133'], l: 0, c: 1, cadeia: 2 },
  { linhas: ['...1..', '...02.', '..200.', '..121.', '..2110'], l: 4, c: 1, cadeia: 2 },
  { linhas: ['.1....', '.2....', '.1.13.', '.21031', '212122'], l: 3, c: 1, cadeia: 2 },
  { linhas: ['.33...', '322...', '0020..'], l: 2, c: 2, cadeia: 3 },
];

/** A partida parada da lição (a pilha não sobe: o modo do quebra-cabeça, com trocas de sobra), e a troca em linhas do tabuleiro. */
export function montarLicao(i: number): { e: Estado; l: number; c: number; cadeia: number } {
  const licao = LICOES_DA_CADEIA[i];
  const e = criar(1, 0, 1, 0);
  e.tipo.fill(VAZIO);
  e.trocas = 99;
  const r0 = LINHAS - licao.linhas.length;
  licao.linhas.forEach((linha, k) => {
    for (let c = 0; c < COLUNAS; c++) {
      const ch = linha.charCodeAt(c) - 48;
      if (ch >= 0 && ch <= 9) e.tipo[(r0 + k) * COLUNAS + c] = ch;
    }
  });
  return { e, l: r0 + licao.l, c: licao.c, cadeia: licao.cadeia };
}
