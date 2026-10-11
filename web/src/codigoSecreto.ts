/**
 * O EASTER EGG: ↑ ↑ ↓ ↓ ← → ← → B A (pedido de 10/10/2026). Quem acha ganha a insígnia "Código secreto".
 *
 * SÓ NO TECLADO, de propósito: no celular, onde não há setas, uma sequência de toques não faria sentido e ficou
 * de fora ("deixe apenas pelo app", decisão dele, 10/10/2026). É a sequência mais famosa dos videogames, e a
 * graça é a pessoa tentar.
 *
 * Quem decide se a insígnia é nova é o servidor (POST /api/me/codigo-secreto): repetir o código não dá de novo.
 * Quem está digitando numa caixa de texto não dispara nada — as setas também servem para andar no texto.
 */

const SEQUENCIA = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

const escrevendo = (alvo: EventTarget | null) =>
  alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName));

/** Escuta a sequência e chama `achou` quando ela se completa. Devolve a função que para de escutar. */
export function escutarCodigoSecreto(achou: () => void): () => void {
  let posicao = 0;
  const tecla = (evento: KeyboardEvent) => {
    if (escrevendo(evento.target)) return;
    const chave = evento.key.length === 1 ? evento.key.toLowerCase() : evento.key;
    posicao = chave === SEQUENCIA[posicao] ? posicao + 1 : chave === SEQUENCIA[0] ? 1 : 0;
    if (posicao === SEQUENCIA.length) {
      posicao = 0;
      achou();
    }
  };
  window.addEventListener('keydown', tecla);
  return () => window.removeEventListener('keydown', tecla);
}
