import { chave } from './i18n';

/**
 * O MICROFONE QUE A PARTIDA DESLIGA (o Lobisomem, 20/11/2026; ver server/src/silencio-do-jogo.ts). Os textos do botão do
 * microfone (curtos) e do aviso do palco (com quando volta), no lugar do "travado pela moderação", que seria mentira aqui.
 */
export const ROTULO_DO_SILENCIO = {
  noite: chave('Noite: microfones desligados'),
  fora: chave('Fora do jogo: só ouvindo'),
} as const;

export const AVISO_DO_SILENCIO = {
  noite: chave('Noite no Lobisomem: os microfones voltam no amanhecer.'),
  fora: chave('Você saiu do jogo: só ouvindo até o fim da partida.'),
} as const;
