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
  /** Onde o ponto do mapa (em casas, `alto` acima do chão) aparece na caixa, em pixels; null fora da vista (os selos das minas). */
  projetar(x: number, y: number, alto: number): { x: number; y: number } | null;
  destruir(): void;
  selecao: Set<number>;
  fantasma: { tipo: TipoPredio; casas: { x: number; y: number }[]; ok: boolean } | null;
}

/** As cores dos times: a pessoa (azul) e o computador (vermelho). */
export const CORES = ['#3f74d8', '#d8483c'] as const;

/**
 * O TRABALHADOR NA FAZENDA (06/11/2026, pedido dele: "deveria ficar se movimentando em cima da fazenda, para mostrar que está
 * trabalhando nela"). SÓ A TELA: na simulação ele colhe parado na beira; o desenho o leva a andar pelas fileiras do campo,
 * parando um pouco no fim de cada uma (colhendo). `t` é o tempo da tela (que para sem foco), em segundos. Devolve o lugar no
 * mapa (em casas), para onde olha e se está parado colhendo.
 */
export function passeioNaFazenda(gx: number, gy: number, tam: number, t: number): { x: number; y: number; rx: number; ry: number; colhendo: boolean } {
  // as fileiras, de um lado ao outro, descendo (o canto de trás à direita é do moinho, na era 2: a última fileira para antes dele)
  const m = 0.42;
  const a = gx + m;
  const b = gx + tam - m;
  const pontos: [number, number][] = [
    [a, gy + tam - m],
    [b, gy + tam - m],
    [b, gy + tam / 2],
    [a, gy + tam / 2],
    [a, gy + m + 0.1],
    [gx + tam / 2, gy + m + 0.1],
  ];
  const VEL = 0.32;
  const PARADA = 0.9;
  // o caminho de ida e volta (um vaivém, sem atravessar o campo na volta)
  const ida = [...pontos, ...pontos.slice(0, -1).reverse()];
  const trechos = ida.slice(1).map((p, i) => {
    const q = ida[i];
    return { de: q, para: p, dura: Math.hypot(p[0] - q[0], p[1] - q[1]) / VEL };
  });
  const total = trechos.reduce((s, k) => s + k.dura + PARADA, 0);
  let r = ((t % total) + total) % total;
  for (const k of trechos) {
    const dx = k.para[0] - k.de[0];
    const dy = k.para[1] - k.de[1];
    const d = Math.hypot(dx, dy) || 1;
    if (r < k.dura) {
      const f = r / k.dura;
      return { x: k.de[0] + dx * f, y: k.de[1] + dy * f, rx: dx / d, ry: dy / d, colhendo: false };
    }
    r -= k.dura;
    if (r < PARADA) return { x: k.para[0], y: k.para[1], rx: dx / d, ry: dy / d, colhendo: true };
    r -= PARADA;
  }
  const fim = ida[ida.length - 1];
  return { x: fim[0], y: fim[1], rx: 0, ry: 1, colhendo: true };
}

/** O martelo que bate na obra: o ângulo do golpe (0 em pé, ~1,45 deitado sobre o prédio), sobe devagar e desce depressa. */
export function golpeDoMartelo(t: number): number {
  const f = ((t / 0.8) % 1 + 1) % 1;
  const ALTO = 0.15;
  const BATE = 1.45;
  if (f < 0.62) {
    const k = f / 0.62;
    return BATE + (ALTO - BATE) * (1 - (1 - k) * (1 - k));
  }
  if (f < 0.78) {
    const k = (f - 0.62) / 0.16;
    return ALTO + (BATE - ALTO) * k * k;
  }
  // o tranco da batida
  const k = (f - 0.78) / 0.22;
  return BATE - Math.sin(k * Math.PI) * 0.08;
}
