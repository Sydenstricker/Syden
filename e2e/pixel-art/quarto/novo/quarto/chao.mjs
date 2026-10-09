// A geometria do chão da base pl-512-janela-1, em pixels dela: os quatro cantos do piso (medidos em ../janela/regua.png) e
// a grade 8×8. Casa (u, v): u anda do fundo para o canto da ESQUERDA (ao longo da parede da esquerda), v do
// fundo para o canto da DIREITA (ao longo da parede da janela).
export const CANTOS = { fundo: [256, 226], esquerda: [40, 340], frente: [256, 456], direita: [472, 340] };
export const N = 8;
/** Ponto do chão nas coordenadas da grade (u, v de 0 a N, contínuas), interpolado entre os quatro cantos. */
export function pontoDoChao(u, v) {
  const { fundo: B, esquerda: L, direita: R, frente: F } = CANTOS;
  const a = u / N, b = v / N;
  return [0, 1].map((k) => B[k] * (1 - a) * (1 - b) + L[k] * a * (1 - b) + R[k] * (1 - a) * b + F[k] * a * b);
}
/** A silhueta de um móvel: o pé [u0, u1, v0, v1] no chão, erguido `alto` px. Devolve os polígonos (o pé
 *  repetido a cada pixel de altura, cuja união é o prisma) e a caixa que os contém. */
export function silhueta([u0, u1, v0, v1], alto) {
  const pe = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]].map(([u, v]) => pontoDoChao(u, v));
  const poligonos = [];
  for (let dy = 0; dy <= alto; dy++) poligonos.push(pe.map(([x, y]) => [x, y - dy]));
  const xs = pe.map((p) => p[0]), ys = pe.map((p) => p[1]);
  return { poligonos, caixa: [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys) - alto), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))] };
}
