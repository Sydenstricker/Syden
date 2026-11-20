
/**
 * AS MEDALHAS E A DIFERENÇA POR VOLTA DAS CORRIDAS (20/11/2026, a segunda auditoria), comuns aos Coelhos a jato, à Regata e
 * aos Carrinhos. Só tela: o servidor guarda o tempo, nunca a medalha nem a diferença.
 *
 * - A MEDALHA é a da Torre do Celeiro (torre/fases.ts): ouro, prata e bronze pelo tempo, sobre o do PILOTO AUTOMÁTICO da
 *   pista, em passos (cada jogo guarda o dele, e o teste do jogo confere que é o do piloto).
 * - A DIFERENÇA é a da volta que acabou de fechar contra a mesma volta do fantasma escolhido (o recorde da pessoa, se ele
 *   está na pista, ou o mais rápido dos marcados): verde, à frente; vermelha, atrás. As voltas do fantasma saem do próprio
 *   caminho dele (uma posição a cada 4 passos), sem perguntar nada ao servidor.
 */

export type Medalha = 0 | 1 | 2;

/** O quanto acima do tempo do piloto ainda vale cada medalha (ouro, prata, bronze). Chute, como os da Torre. */
export const FATORES_DAS_CORRIDAS = [1, 1.12, 1.3] as const;

/** 0 ouro, 1 prata, 2 bronze, ou null (mais devagar que o bronze). `base` e `passos` em passos de 1/60 s. */
export function medalhaPelosPassos(base: number, passos: number, fatores: readonly number[] = FATORES_DAS_CORRIDAS): Medalha | null {
  if (!(base > 0)) return null;
  const i = fatores.findIndex((f) => passos <= Math.round(base * f));
  return i < 0 ? null : (i as Medalha);
}

/** A diferença como se lê: "−0.42" (à frente) ou "+1.10" (atrás), em segundos com centésimos. */
export function diferencaLegivel(ms: number): string {
  const cs = Math.round(Math.abs(ms) / 10);
  const s = Math.floor(cs / 100);
  const resto = String(cs % 100).padStart(2, '0');
  return `${ms < 0 ? '−' : '+'}${s}.${resto}`;
}

/** A linha do meio de uma pista (a do jato e a da regata têm a mesma forma). */
export interface LinhaDoMeio {
  lx: Float32Array;
  ly: Float32Array;
  la: Float32Array;
  comprimento: number;
}

/**
 * AS VOLTAS DE UM FANTASMA, tiradas do caminho dele (x e y em décimos, o ângulo, um trio a cada `amostra` passos, o primeiro no
 * passo 1): o passo em que ele fechou cada volta, como `voltas` da nave. A posição na volta é a do ponto mais perto da linha do
 * meio, "desenrolada" de amostra em amostra; a largada fica antes da linha (a posição começa negativa, como o `progresso`). O
 * erro é de menos de uma amostra (interpolado entre as duas da passagem). O caminho acaba na chegada, então a última volta
 * vem de `fim` (o tempo inteiro do fantasma, em passos).
 */
export function voltasDoCaminho(amostras: number[], linha: LinhaDoMeio, voltas: number, fim?: number, amostra = 4): number[] {
  const n = linha.lx.length;
  const total = Math.floor(amostras.length / 3);
  if (!n || total < 2) return [];
  const perto = (x: number, y: number, ultimo: number | null) => {
    let melhor = 0, md = Infinity;
    if (ultimo !== null) {
      for (let k = -60; k <= 60; k++) {
        const i = (((ultimo + k) % n) + n) % n;
        const d = (linha.lx[i] - x) ** 2 + (linha.ly[i] - y) ** 2;
        if (d < md) {
          md = d;
          melhor = i;
        }
      }
      if (md < 80 * 80) return melhor;
    }
    md = Infinity;
    for (let i = 0; i < n; i++) {
      const d = (linha.lx[i] - x) ** 2 + (linha.ly[i] - y) ** 2;
      if (d < md) {
        md = d;
        melhor = i;
      }
    }
    return melhor;
  };
  const resultado: number[] = [];
  let i = perto(amostras[0] / 10, amostras[1] / 10, null);
  let frac = linha.la[i] / linha.comprimento;
  let andou = frac > 0.5 ? frac - 1 : frac;
  for (let k = 1; k < total && resultado.length < voltas; k++) {
    i = perto(amostras[3 * k] / 10, amostras[3 * k + 1] / 10, i);
    const f = linha.la[i] / linha.comprimento;
    let d = f - frac;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    const antes = andou;
    andou += d;
    frac = f;
    const alvo = resultado.length + 1;
    if (antes < alvo && andou >= alvo) {
      const t = (alvo - antes) / (andou - antes);
      resultado.push(Math.round(1 + (k - 1 + t) * amostra));
    }
  }
  // a última volta: o caminho para na linha de chegada, e o fim é o tempo do fantasma (o que o servidor guardou)
  if (fim !== undefined && resultado.length === voltas - 1 && fim > (resultado.at(-1) ?? 0)) resultado.push(fim);
  return resultado;
}
