import * as THREE from 'three';

/**
 * A FORMA DA VOLTA E A PLANTA DA CIDADEZINHA do Tabuleiro da turma em 3D (05/11/2026). Só desenho: o servidor conhece as 30
 * casas pela ordem, nunca pelo lugar, então a volta pode serpentear entre as ruas — a ordem e o número continuam os mesmos
 * (o teste web/test/tabuleiro3d.test.ts confere: 30 casas, igualmente espaçadas, nenhuma encostada noutra e nenhuma casa da
 * cidade em cima do caminho).
 *
 * As coordenadas são do chão (x para a direita, z para a câmera). A volta anda no sentido do relógio visto de cima, como a do
 * desenho em 2D, e começa (a largada, casa 0) no meio da frente.
 */

export const NUMERO_DE_CASAS = 30;
/** O raio do disco de cada casa da volta. */
export const RAIO_DA_CASA = 0.31;

/** Os pontos por onde a volta passa: um "osso" com uma reentrância na frente e outra no fundo, onde a cidade entra. */
const PONTOS: [number, number][] = [
  [0, 1.75],
  [-1.6, 2.65],
  [-3.9, 2.35],
  [-4.75, 0],
  [-3.9, -2.35],
  [-1.6, -2.65],
  [0, -1.75],
  [1.6, -2.65],
  [3.9, -2.35],
  [4.75, 0],
  [3.9, 2.35],
  [1.6, 2.65],
];

export const CURVA_DA_VOLTA = new THREE.CatmullRomCurve3(
  PONTOS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  'centripetal',
);

/** O centro de cada casa (0 a 29), igualmente espaçadas ao longo da volta. */
export const CASAS_DA_VOLTA: { x: number; z: number; /** Para fora da volta (unitário). */ fora: [number, number]; rumo: number }[] = Array.from(
  { length: NUMERO_DE_CASAS },
  (_, i) => {
    const u = i / NUMERO_DE_CASAS;
    const p = CURVA_DA_VOLTA.getPointAt(u);
    const t = CURVA_DA_VOLTA.getTangentAt(u);
    // no sentido do relógio visto de cima, o lado de fora é à esquerda de quem anda: (t.z, -t.x)
    return { x: p.x, z: p.z, fora: [t.z, -t.x], rumo: Math.atan2(t.x, t.z) };
  },
);

/** As ruas: o anel dos carros em volta da volta, e quatro ruas saindo dele para fora (o resto da cidade). */
export const ANEL = { rx: 6.3, rz: 4.4, canto: 1.3, largura: 0.8 };
export const RUAS_PARA_FORA: { x0: number; z0: number; x1: number; z1: number }[] = [
  { x0: -0.4, z0: -11, x1: 0.4, z1: -ANEL.rz },
  { x0: -0.4, z0: ANEL.rz, x1: 0.4, z1: 11 },
  { x0: -13, z0: -0.4, x1: -ANEL.rx, z1: 0.4 },
  { x0: ANEL.rx, z0: -0.4, x1: 13, z1: 0.4 },
];
/** A linha do trem, por fora de tudo. */
export const TRILHO = { rx: 10.4, rz: 8.6, canto: 2.2 };

/** Os pontos de um retângulo de cantos redondos (sentido do relógio visto de cima, ou o contrário). */
export function retanguloCurvo(rx: number, rz: number, canto: number, y = 0, contrario = false): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [];
  const cantos: [number, number, number][] = [
    [rx - canto, -(rz - canto), -Math.PI / 2],
    [rx - canto, rz - canto, 0],
    [-(rx - canto), rz - canto, Math.PI / 2],
    [-(rx - canto), -(rz - canto), Math.PI],
  ];
  for (const [cx, cz, a0] of cantos)
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * canto, y, cz + Math.sin(a) * canto));
    }
  if (contrario) pts.reverse();
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

export type TipoDePredio = 'casa' | 'comercio';
/** Um lote da cidade: onde fica, para onde a frente olha (o ângulo em y; a frente do modelo é o +z) e o tamanho. */
export interface LoteDaCidade {
  x: number;
  z: number;
  rumo: number;
  tipo: TipoDePredio;
  /** Qual modelo da lista (sorteado sempre do mesmo jeito). */
  modelo: number;
  largura: number;
}

/** Os prédios em volta: as casas viradas para o anel, as lojas nas esquinas e uma segunda fileira no fundo. */
export function lotesDaCidade(): LoteDaCidade[] {
  let semente = 11;
  const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const lotes: LoteDaCidade[] = [];
  const fora = ANEL.largura / 2 + 0.95;
  const casa = (x: number, z: number, rumo: number) => lotes.push({ x, z, rumo, tipo: 'casa', modelo: Math.floor(sorte() * 8), largura: 1.15 + sorte() * 0.15 });
  // a fileira do fundo e a da frente (a frente da casa olha a rua); o meio fica para a rua que sai
  for (const x of [-5.1, -3.55, -2.0, 2.0, 3.55, 5.1]) {
    casa(x, -(ANEL.rz + fora), 0);
    casa(x, ANEL.rz + fora, Math.PI);
  }
  // os lados
  for (const z of [-2.85, -1.3, 1.3, 2.85]) {
    casa(-(ANEL.rx + fora), z, Math.PI / 2);
    casa(ANEL.rx + fora, z, -Math.PI / 2);
  }
  // as lojas nas quatro esquinas, de quina para o anel
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    lotes.push({ x: sx * (ANEL.rx + 1.25), z: sz * (ANEL.rz + 1.25), rumo: Math.atan2(-sx, -sz), tipo: 'comercio', modelo: (sx + 1) / 2, largura: 1.55 });
  // a segunda fileira, no fundo e nos lados (de costas para a câmera de fábrica não importa: ela é cenário de longe)
  for (const x of [-7.6, -5.9, -4.2, -2.5, 2.5, 4.2, 5.9, 7.6]) casa(x, -(ANEL.rz + fora + 2.15), 0);
  for (const z of [-4.6, -2.6, 2.6, 4.6]) {
    casa(-(ANEL.rx + fora + 2.0), z, Math.PI / 2);
    casa(ANEL.rx + fora + 2.0, z, -Math.PI / 2);
  }
  for (const x of [-5.9, -4.2, -2.5, 2.5, 4.2, 5.9]) casa(x, ANEL.rz + fora + 2.15, Math.PI);
  return lotes;
}

/** O miolo da volta: a horta à esquerda, a praça à direita e a toca no meio. */
export const HORTA = { x0: -3.75, x1: -1.05, z0: -1.05, z1: 1.05 };
export const PRACA = { x: 2.45, z: 0, raio: 1.15 };
export const TOCA = { x: 0, z: 0, raio: 0.55 };
