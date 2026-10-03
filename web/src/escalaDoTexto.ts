// Acessibilidade → Tamanho do texto.
//
// Todo `font-size` de styles.css é `calc(Npx * var(--escala-do-texto))`, então isto muda AS LETRAS e
// nada mais: barras, botões e avatares ficam do tamanho que têm. É o que quem precisa de letra maior
// pede — o zoom do navegador já existe para quem quer a tela inteira maior, e ele empurra a lista de
// canais para fora da janela muito antes de a letra ficar confortável.

export const ESCALA_MINIMA = 0.85;
export const ESCALA_MAXIMA = 1.5;

/** O valor guardado pode vir de outra versão, de outro aparelho ou corrompido: só passa o que cabe. */
export function escalaValida(valor: unknown): number {
  const n = typeof valor === 'number' && Number.isFinite(valor) ? valor : 1;
  return Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, n));
}

export function aplicarEscalaDoTexto(valor: unknown) {
  const escala = escalaValida(valor);
  const raiz = document.documentElement;
  if (escala === 1) raiz.style.removeProperty('--escala-do-texto');
  else raiz.style.setProperty('--escala-do-texto', String(escala));
}
