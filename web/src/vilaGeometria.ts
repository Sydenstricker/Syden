/**
 * A geometria da vila: onde cada coisa fica, e como um ponto do tabuleiro vira um ponto do desenho.
 *
 * Está separada de Vila.tsx por um motivo prático: aquele arquivo importa imagens e componentes, e
 * por isso não pode ser carregado num teste — o Node não sabe abrir um .png. A matemática, que é
 * justamente a parte que dá para errar e conferir, não precisa de nada disso.
 *
 * O Vila.tsx reexporta o que já era público daqui, então nada que usava esses nomes precisou mudar.
 */

/** Meia largura e meia altura de um losango do tabuleiro. */
export const TW = 48;
export const TH = 24;

/** Onde fica a coluna 0, fileira 0 dentro do desenho. */
export const OX = 600;
export const OY = 300;

export const LARGURA = 1200;
export const ALTURA = 740;

/** Quanto o balão sobe acima do telhado da casa a que pertence. */
export const TELHADO = 38;

export interface P {
  x: number;
  y: number;
}

/** Leva um ponto do tabuleiro (coluna, fileira, altura em pixels) para o desenho. */
export function iso(c: number, r: number, h = 0): P {
  return { x: OX + (c - r) * TW, y: OY + (c + r) * TH - h };
}

/** O caminho de volta: de um ponto do desenho para o tabuleiro (usado no clique na grama). */
export function deIso(x: number, y: number) {
  const a = (x - OX) / TW;
  const b = (y - OY) / TH;
  return { c: (a + b) / 2, r: (b - a) / 2 };
}

export const CASAS = {
  salas: { c: -3.6, r: -1.4, w: 3.0, d: 2.4, alt: 58 },
  loja: { c: 1.0, r: -2.4, w: 2.6, d: 2.0, alt: 52 },
  aprender: { c: 4.0, r: -0.6, w: 2.6, d: 2.2, alt: 56 },
  explorar: { c: -4.2, r: 2.4, w: 2.2, d: 1.8, alt: 46 },
};

/**
 * Onde o balão de Amigos se ancora: um ponto livre da praça, ao sul das casas.
 *
 * Não é uma casa — é só uma âncora. Antes ele dividia o ponto com a Loja, e dois balões no mesmo
 * lugar se atravessam, que é exatamente a reclamação que já apareceu nesta tela uma vez. A distância
 * entre todos os balões é conferida por teste, e não pelo olho.
 */
export const PRACA_DOS_AMIGOS = { c: 1.6, r: 2.2, alt: 44 };

/** Onde fica a estátua da praça: a aba dos coelhos aponta para ela. */
export const ESTATUA = { c: -0.4, r: -0.4, alt: 150 };

/** A posição do balão de uma casa, em porcentagem da cena. */
export function balaoDaCasa(casa: { c: number; r: number; alt: number }, telhado = TELHADO) {
  const p = iso(casa.c, casa.r, casa.alt + telhado);
  // O balão cresce para cima a partir daqui; abaixo de 10% ele sairia pela borda de cima da cena.
  return { x: (p.x / LARGURA) * 100, y: Math.max(10, (p.y / ALTURA) * 100) };
}
