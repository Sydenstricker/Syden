import { AMOSTRA } from './fisica';
import { pontoMaisPerto, type Pista } from './pista';

/**
 * AS PARCIAIS E AS MEDALHAS DO CONTRA O RELÓGIO (20/11/2026, a segunda auditoria). Só tela: nada disto vai ao servidor, e o
 * recorde continua o tempo.
 *
 * AS PARCIAIS: a volta é dividida em PARCIAIS_POR_VOLTA marcos iguais pela linha do meio (o último é a linha de chegada), e a
 * cada marco a tela compara o passo em que eu passei com o passo em que o fantasma de referência passou (o meu recorde, ou o
 * mais rápido dos marcados): verde se estou à frente, vermelho se atrás. Os dois lados são medidos pela MESMA conta, sobre
 * as posições a cada AMOSTRA passos (as minhas, de `aoPosicao`; as do fantasma, as amostras guardadas no servidor).
 */
export const PARCIAIS_POR_VOLTA = 4;

/**
 * Segue um kart (ou um fantasma) pela linha do meio e diz quais marcos ele cruzou. A largada fica um pouco antes da linha: a
 * conta começa a valer quando ele a cruza pela primeira vez. Ir de ré desconta, e o marco só conta uma vez.
 */
export function criarParciais(p: Pista, voltas: number) {
  const n = p.lx.length;
  let indice = n - 3;
  let volta = 0;
  let comecou = false;
  let proximo = 1;
  // a linha de chegada final fica de fora: a chegada não cai numa amostra, e a diferença final é a do tempo, no fim
  const total = voltas * PARCIAIS_POR_VOLTA - 1;
  return {
    /** Anda até (x, y); devolve os marcos (1 … voltas × PARCIAIS_POR_VOLTA − 1) cruzados agora. */
    andar(x: number, y: number): number[] {
      const antes = indice;
      indice = pontoMaisPerto(p, x, y, indice);
      if (antes > n * 0.8 && indice < n * 0.2) {
        if (comecou) volta++;
        comecou = true;
      } else if (antes < n * 0.2 && indice > n * 0.8 && comecou) volta--;
      if (!comecou) return [];
      const andou = (volta + p.la[indice] / p.comprimento) * PARCIAIS_POR_VOLTA;
      const cruzou: number[] = [];
      while (proximo <= total && andou >= proximo) cruzou.push(proximo++);
      return cruzou;
    },
  };
}

/** O passo em que o fantasma cruzou cada marco (o índice 0 fica vazio): a mesma conta do kart, pelas amostras dele. */
export function parciaisDoFantasma(p: Pista, voltas: number, amostras: number[]): number[] {
  const marcos: number[] = [];
  const seguir = criarParciais(p, voltas);
  for (let j = 0; j * 3 < amostras.length; j++) {
    // a amostra j é a do passo 1 + j·AMOSTRA (fisica.ts, amostrar)
    for (const k of seguir.andar(amostras[j * 3] / 10, amostras[j * 3 + 1] / 10)) marcos[k] = 1 + j * AMOSTRA;
  }
  return marcos;
}

/** A diferença, em ms, como se lê: "−0.42" ou "+1.10" (o sinal sempre à vista). */
export function diferencaLegivel(ms: number): string {
  const s = Math.abs(ms) / 1000;
  return `${ms < 0 ? '−' : '+'}${s.toFixed(2)}`;
}

/**
 * AS MEDALHAS DE CADA PISTA, sobre o tempo do PILOTO AUTOMÁTICO derrapando (em passos; web/test/corrida.test.ts confere que é
 * o dele), como na Torre do Celeiro. Ouro: até o tempo dele; prata: até 8% a mais; bronze: até 18% a mais. Os fatores são
 * menores que os da Torre porque a volta do kart é curta e os robôs do Solo já vão de 1:02 a 1:12 na Horta.
 */
export const TEMPO_DO_PILOTO: Record<string, number> = {
  'horta-1': 3630,
  'pomar-1': 3503,
  'praia-1': 3858,
  'bosque-1': 3368,
  'neve-1': 4169,
  'canion-1': 3749,
  'fazenda-1': 3673,
  'brejo-1': 3518,
  'vulcao-1': 3760,
};
export const MEDALHAS_DA_CORRIDA = [1, 1.08, 1.18] as const;

/** 0 ouro, 1 prata, 2 bronze, ou null. */
export function medalhaDaCorrida(pista: string, passos: number): 0 | 1 | 2 | null {
  const base = TEMPO_DO_PILOTO[pista];
  if (!base) return null;
  const i = MEDALHAS_DA_CORRIDA.findIndex((m) => passos <= Math.round(base * m));
  return i < 0 ? null : (i as 0 | 1 | 2);
}
