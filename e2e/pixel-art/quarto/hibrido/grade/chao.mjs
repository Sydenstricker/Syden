// A geometria do chão do quarto, em pixels do quarto (313 px): os quatro cantos do piso e a grade 8×8.
// Casa (i, j): i anda do fundo para a parede da ESQUERDA, j do fundo para a parede da DIREITA.
// O conceito foi pintado a olho, não com isometria exata: o chão não é um paralelogramo perfeito (o canto do
// fundo calculado pelos outros três cairia 12 px fora do canto das paredes). Por isso os quatro cantos são
// medidos e a grade é interpolada entre eles.
export const CANTOS = { fundo: [146, 117], esquerda: [21, 217], frente: [156, 308], direita: [293, 208] };
export const N = 8;
/** Ponto do chão nas coordenadas da grade (u, v de 0 a N, contínuas). */
export function pontoDoChao(u, v) {
  const { fundo: B, esquerda: L, direita: R, frente: F } = CANTOS;
  const a = u / N, b = v / N;
  return [0, 1].map((k) => B[k] * (1 - a) * (1 - b) + L[k] * a * (1 - b) + R[k] * (1 - a) * b + F[k] * a * b);
}
export const centroDaCasa = (i, j) => pontoDoChao(i + 0.5, j + 0.5);
