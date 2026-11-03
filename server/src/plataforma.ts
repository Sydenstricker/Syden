/**
 * O PULO DO COELHO, do lado do servidor (03/11/2026): a corrida de plataforma, com a arquitetura da Corrida dos coelhos
 * (corrida.ts). A fase roda inteira no computador de quem joga (web/src/plataforma/), em passos fixos de 1/60 s, e o tempo
 * é o NÚMERO DE PASSOS. O servidor guarda o melhor tempo e o fantasma de cada um, e confere o caminho:
 * - uma posição a cada 4 passos, e o número de posições bate com o tempo declarado;
 * - a primeira na largada e a última no máximo 3 passos (de corrida) antes da chegada da fase;
 * - nenhuma posição mais longe da anterior do que o coelho anda: no x, a corrida (110/s), e onde há plataforma que anda,
 *   a corrida somada à dela; no y, a queda e a mola;
 * - o único salto aceito é a VOLTA AO POSTO depois de cair: exatamente num posto, e num que já se alcançou;
 * - andou, somando, pelo menos a distância da largada à chegada.
 *
 * O QUE CONTINUA POSSÍVEL (escrito de propósito): o servidor não conhece os blocos da fase, então um caminho inventado
 * pelo console pode atravessar parede e buraco em linha reta, na velocidade máxima. O ganho é pouco: a fase é quase toda
 * corrida para a direita, e o tempo de linha reta (a distância a 110/s, ~31 s no prado) fica a uns 2 s do bom tempo de
 * verdade (~33 s). É corrida entre amigos; a conferência existe para o console não mandar um tempo impossível.
 */

/**
 * As fases: as medidas saem de web/src/plataforma/fases.ts, e o teste web/test/plataforma.test.ts confere que batem.
 * `rapidos`: os trechos [x0, x1] onde há plataforma que anda de lado (lá o coelho pode ir mais rápido, levado por ela).
 */
export const FASES_DO_PULO: Record<
  string,
  { largada: [number, number]; chegada: number; largura: number; postos: [number, number][]; rapidos: [number, number][] }
> = {
  'prado-1': { largada: [56, 176], chegada: 3392, largura: 3584, postos: [[56, 176], [1032, 176], [2040, 160], [2696, 160]], rapidos: [[2432, 2640]] },
  'toca-1': {
    largada: [56, 176],
    chegada: 3584,
    largura: 3776,
    postos: [[56, 176], [1000, 176], [1288, 80], [2072, 176], [2808, 160]],
    rapidos: [[2976, 3184]],
  },
  'copas-1': {
    largada: [56, 160],
    chegada: 3520,
    largura: 3712,
    postos: [[56, 160], [680, 144], [1368, 64], [1960, 160], [2568, 160]],
    rapidos: [[800, 1008], [2720, 2928]],
  },
};

/** A copa: as três fases seguidas (o site tem a mesma lista: COPAS_DO_PULO em web/src/plataforma/fases.ts). */
export const COPAS_DO_PULO: Record<string, string[]> = { 'copa-do-pulo': ['prado-1', 'toca-1', 'copas-1'] };

const AMOSTRA = 4;
const VMAX = 110;
/** A plataforma que anda mais depressa vai a ~140/s no meio do caminho. */
const VMOVEL = 145;
/** Por amostra (4 passos), em décimos: a corrida, com uma folga de arredondamento. */
const DX = Math.ceil(((VMAX * AMOSTRA) / 60) * 10) + 2;
const DX_RAPIDO = Math.ceil((((VMAX + VMOVEL) * AMOSTRA) / 60) * 10) + 2;
/**
 * O quanto a última posição pode ficar antes da chegada, em décimos: ela é de no máximo 3 passos antes do passo que cruzou
 * (uma a cada 4), e perto da chegada não há plataforma que anda, então são 3 passos de corrida (~5,5 px) e 1 px de folga.
 * Mais que isso deixaria tirar as últimas amostras de uma corrida honesta e declarar menos passos.
 */
export const ANTES_DA_CHEGADA = 3 * Math.ceil((VMAX * 10) / 60) + 10;
/** A mola sobe a 500/s; a queda, no máximo 430/s. */
const DY = Math.ceil(((500 * AMOSTRA) / 60) * 10) + 2;
/** Uma fase não leva mais de 10 min. */
const FASE_MAXIMA = 10 * 60 * 60;

export interface FaseValidada {
  tempoMs: number;
  passos: number;
  amostras: number[];
}

export function validarPulo(fase: string, corpo: unknown): { ok: FaseValidada } | { erro: string } {
  const def = FASES_DO_PULO[fase];
  if (!def) return { erro: 'Fase desconhecida.' };
  const invalida = { erro: 'Corrida inválida.' };
  if (!corpo || typeof corpo !== 'object') return invalida;
  const { passos, amostras } = corpo as { passos?: unknown; amostras?: unknown };
  if (!Number.isInteger(passos) || (passos as number) < 60 || (passos as number) > FASE_MAXIMA) return invalida;
  const esperado = 3 * (Math.floor(((passos as number) - 1) / AMOSTRA) + 1);
  if (!Array.isArray(amostras) || amostras.length !== esperado || !amostras.every((v) => Number.isInteger(v))) return invalida;
  const a = amostras as number[];
  // a primeira posição é a do primeiro passo, na largada
  if (Math.abs(a[0] - def.largada[0] * 10) > 40 || Math.abs(a[1] - def.largada[1] * 10) > 40) return invalida;
  let maiorX = a[0];
  let andou = 0;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], jeito = a[i + 2];
    if (x < 0 || x > def.largura * 10 || y < -640 || y > 2600 || ![-2, -1, 1, 2].includes(jeito)) return invalida;
    if (i === 0) continue;
    const dx = Math.abs(x - a[i - 3]), dy = Math.abs(y - a[i - 2]);
    const rapido = def.rapidos.some(([x0, x1]) => x >= x0 * 10 && x <= x1 * 10) || def.rapidos.some(([x0, x1]) => a[i - 3] >= x0 * 10 && a[i - 3] <= x1 * 10);
    if (dx > (rapido ? DX_RAPIDO : DX) || dy > DY) {
      // o único salto que vale: a volta a um posto já alcançado (exato, porque é o próprio jogo que o põe lá)
      const posto = def.postos.some(([px, py]) => Math.abs(x - px * 10) <= 10 && Math.abs(y - py * 10) <= 10 && px * 10 <= maiorX + 160);
      if (!posto) return invalida;
      continue;
    }
    andou += dx;
    if (x > maiorX) maiorX = x;
  }
  // a última posição é de no máximo 3 passos antes da chegada (nenhuma fase tem trecho rápido perto dela: o teste confere)
  if (a[a.length - 3] < def.chegada * 10 - ANTES_DA_CHEGADA) return invalida;
  // a distância andada é uma conferência a mais, contra o caminho que vai e volta no lugar; a folga de 2% não abre o
  // corte do fim, que é da conferência de cima
  if (andou < (def.chegada - def.largada[0]) * 10 * 0.98) return invalida;
  return { ok: { tempoMs: Math.round(((passos as number) * 1000) / 60), passos: passos as number, amostras: a } };
}
