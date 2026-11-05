import type { Sim, TipoPredio } from './sim';

/**
 * O que a tela de Tocas e Torres pede a quem desenha o mapa: a cena 3D (cena.ts) ou, sem WebGL ou no estilo 2D, o desenho
 * de cima (vista2d.ts). Os dois só LEEM a simulação; o clique, a seleção e os comandos moram em JogoTocas.tsx, que pergunta
 * à vista o que há debaixo do dedo.
 */
export interface Vista {
  montar(): Promise<void>;
  /** Desenha um quadro; `alfa` é quanto do passo atual já passou (0 a 1), para desenhar entre um passo e outro. */
  quadro(alfa: number, dt: number): void;
  /** O ponto do chão (em casas) debaixo de (px, py), relativo à caixa, ou null. */
  chao(px: number, py: number): { x: number; y: number } | null;
  /** O que está debaixo de (px, py): o id de uma unidade, prédio ou fonte, ou null. */
  pegar(px: number, py: number): number | null;
  /** As MINHAS unidades dentro do retângulo da tela. */
  noRetangulo(x0: number, y0: number, x1: number, y1: number): number[];
  /** Arrasta o mapa: o ponto que estava em (de) passa a estar em (para). */
  arrastar(dx: number, dy: number, px: number, py: number): void;
  zoom(fator: number, px: number, py: number): void;
  centrar(x: number, y: number): void;
  /** Os quatro cantos da tela no chão (em casas), para o retângulo do minimapa. */
  cantos(): { x: number; y: number }[];
  /** Um clique de comando: o sinal no chão. */
  sinal(x: number, y: number, ataque: boolean): void;
  /** O que a simulação contou no passo que acabou de andar (os tiros, os escombros). */
  eventos?(sim: Sim): void;
  destruir(): void;
  selecao: Set<number>;
  fantasma: { tipo: TipoPredio; casas: { x: number; y: number }[]; ok: boolean } | null;
}

/** As cores dos times: a pessoa (azul) e o computador (vermelho). */
export const CORES = ['#3f74d8', '#d8483c'] as const;
