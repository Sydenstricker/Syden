/**
 * O QUARTO MUDOU POR FORA DA PÁGINA DELE (09/11/2026): o Guarda-roupa troca o bicho e o nome dele direto no servidor
 * (PUT /api/quarto/pet), com o quarto aberto atrás das Configurações. Este aviso faz o quarto reler a arrumação — senão ele
 * mostraria o bicho de antes e, na próxima mudança, guardaria a arrumação velha por cima da nova.
 */
const EVENTO = 'syden:quarto-mudou';

export function avisarQuartoMudou() {
  window.dispatchEvent(new Event(EVENTO));
}

export function aoMudarOQuarto(fazer: () => void) {
  window.addEventListener(EVENTO, fazer);
  return () => window.removeEventListener(EVENTO, fazer);
}
