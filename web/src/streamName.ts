// O que a pessoa está transmitindo, em palavras que os outros entendam.
//
// O navegador entrega um "rótulo" para a captura de tela, e o que vem ali depende de onde o Syden está
// rodando. No app instalado, o rótulo costuma ser o título da janela escolhida — é assim que "League of
// Legends" aparece. No navegador, quase sempre vem um código interno ("screen:0:0", "window:12345:0"),
// que não diz nada a ninguém: nesse caso é melhor dizer só o tipo do que está sendo mostrado.

/** Onde o rótulo não ajuda: códigos internos do navegador. */
const CODIGOS = [/^screen:\d/i, /^window:\d/i, /^audio:/i, /^web-contents-media-stream:/i, /^[0-9a-f-]{16,}$/i];

/** Rótulos que só querem dizer "a tela inteira", em português e em inglês. */
const TELA_INTEIRA = [/^screen(\s*\d+)?$/i, /^entire screen$/i, /^tela(\s*\d+)?$/i, /^tela inteira$/i, /^display\s*\d+$/i];

/** O nome genérico de cada tipo de compartilhamento, quando não dá para saber mais. */
const GENERICO: Record<string, string> = {
  monitor: 'a tela',
  window: 'uma janela',
  browser: 'uma aba',
};

/** Nome comprido vira reticências: a frase inteira precisa caber numa linha da lista. */
const LIMITE = 38;

/**
 * Traduz o rótulo cru da captura para o nome que vai aparecer para os outros.
 * Devolve `null` quando nem o tipo se sabe — aí quem mostra diz só "Transmitindo".
 */
export function nomeDaTransmissao(rotulo: string | undefined | null, superficie?: 'monitor' | 'window' | 'browser'): string | null {
  const cru = (rotulo ?? '').trim();
  const generico = superficie ? GENERICO[superficie] : null;

  if (!cru || CODIGOS.some((padrao) => padrao.test(cru))) return generico;
  if (TELA_INTEIRA.some((padrao) => padrao.test(cru))) return GENERICO.monitor;

  // Alguns sistemas grudam o nome do programa no fim do título ("Planilha — Excel"). Fica, porque ajuda
  // a reconhecer; o que não pode é estourar a linha.
  const limpo = cru.replace(/\s+/g, ' ');
  return limpo.length > LIMITE ? `${limpo.slice(0, LIMITE - 1).trimEnd()}…` : limpo;
}

/** A frase que aparece na lista: "Transmitindo League of Legends em Sala 1". */
export function fraseDaTransmissao(nome: string | null | undefined, sala: string): string {
  return nome ? `Transmitindo ${nome} em ${sala}` : `Transmitindo em ${sala}`;
}
