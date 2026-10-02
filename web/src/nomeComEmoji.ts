/**
 * NOME COM EMOJI DENTRO.
 *
 * Pôr um emoji no nome da comunidade parece não exigir código nenhum — o campo é texto, o banco é
 * texto, e um emoji é texto. Só que emoji NÃO É UMA LETRA, e dois lugares deste app contavam letras
 * do jeito que o JavaScript conta por padrão: de dois em dois bytes.
 *
 * O ESTRAGO, MEDIDO ANTES DE ESCREVER QUALQUER COISA. As iniciais do ícone da comunidade faziam
 * `nome[0]`, e "🎮 Jogos da firma" devolvia "\ud83cJ" — METADE do emoji, que o navegador desenha
 * como o losango de interrogação. O limite de 40 caracteres tinha o mesmo problema ao contrário:
 * "🇧🇷" ocupa quatro, então o campo parava de aceitar texto bem antes do que a pessoa vê.
 *
 * O que o olho chama de "um caractere" é um GRAFEMA, e grafema não se descobre contando bytes: a
 * família 👨‍👩‍👧 são três bonecos e dois juntadores invisíveis, treze pontos de código, e mesmo
 * assim UM caractere na tela. Quem sabe disso é o `Intl.Segmenter`, que vem no navegador e no Node.
 */

const SEGMENTADOR = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Emoji de verdade, e não "qualquer coisa que não é letra".
 *
 * `Extended_Pictographic` pega os desenhos (🎮 ☕ ♥) e `Regional_Indicator` pega as bandeiras, que
 * são duas letras invisíveis grudadas e não casam com a primeira propriedade. Acento, cedilha,
 * ideograma japonês e letra árabe não entram em nenhuma das duas — eles são escrita, não figura.
 */
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** O texto quebrado em caracteres como quem lê os enxerga. */
export function grafemas(texto: string): string[] {
  return [...SEGMENTADOR.segment(texto)].map((pedaco) => pedaco.segment);
}

/** Quantos caracteres a pessoa vê — que é o número com que qualquer limite deve ser comparado. */
export function tamanhoVisivel(texto: string): number {
  return grafemas(texto).length;
}

/** O primeiro emoji do texto, venha ele no começo ou no meio; `null` se não houver nenhum. */
export function primeiroEmoji(texto: string): string | null {
  return grafemas(texto).find((pedaco) => EMOJI.test(pedaco)) ?? null;
}

/**
 * Até onde o campo pode deixar digitar, em unidades do HTML.
 *
 * O `maxlength` de um `<input>` conta do jeito antigo, e não há como pedir que ele conte grafemas.
 * Então a conta é feita aqui e o atributo é recalculado a cada tecla: o que sobra de limite visível
 * é somado ao tamanho que o texto de hoje já ocupa. O efeito para quem digita é o campo parar
 * exatamente no quadragésimo caractere que ele enxerga, com emoji ou sem.
 */
export function limiteDoCampo(texto: string, limiteVisivel: number): number {
  return texto.length + Math.max(0, limiteVisivel - tamanhoVisivel(texto));
}
