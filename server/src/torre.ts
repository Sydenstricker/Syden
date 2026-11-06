/**
 * A TORRE DO CELEIRO, do lado do servidor (05/11/2026): a subida vertical no motor do Pulo do coelho, com a mesma
 * arquitetura (plataforma.ts, de onde a conferência foi copiada e virada para cima). A subida roda inteira no computador de
 * quem joga (web/src/torre/), em passos fixos de 1/60 s, e o tempo é o NÚMERO DE PASSOS. O servidor guarda o melhor tempo e
 * o fantasma de cada um (torre_recordes), e confere o caminho:
 * - uma posição a cada 4 passos, e o número de posições bate com o tempo declarado;
 * - a primeira na largada e a última logo depois de passar do assoalho do topo;
 * - nenhuma posição mais longe da anterior do que o coelho anda: de lado, a corrida somada à prateleira mais rápida; para
 *   cima, o pulo (somado à viga que sobe); para baixo, a queda;
 * - o único salto aceito é a VOLTA AO POSTO (a ferramenta ou o corvo acertaram): exatamente num posto, e num andar que já se
 *   alcançou;
 * - em nenhuma janela de 1, 3 e 10 s sobe-se mais do que o piloto automático sobe (com folga), e a torre inteira não leva
 *   menos que 85% do tempo dele;
 * - subiu, somando, pelo menos a altura da torre.
 *
 * O QUE CONTINUA POSSÍVEL (escrito de propósito): o servidor não conhece os blocos nem o roteiro do que cai, então um
 * caminho inventado pelo console pode atravessar fardo e ignorar a pá. O ganho é limitado pelas janelas e pelo mínimo: no
 * máximo uns 15% abaixo do bom tempo do piloto automático. É subida entre amigos; a conferência existe para o console não
 * mandar um tempo impossível.
 */

/**
 * As torres: as medidas saem de web/src/torre/fases.ts, e o teste web/test/torre.test.ts confere que batem. `minimo` é 85%
 * dos passos do piloto automático na torre (o teste confere também isso).
 */
export const TORRES_DO_CELEIRO: Record<
  string,
  { largada: [number, number]; chegada: number; largura: number; altura: number; postos: [number, number][]; minimo: number }
> = {
  'celeiro-1': {
    largada: [56, 2544], chegada: 112, largura: 288, altura: 2560, minimo: 2005,
    postos: [[56, 2544], [72, 2320], [40, 2096], [40, 1840], [200, 1520], [232, 1264], [136, 1104], [136, 848], [168, 624], [104, 304]],
  },
  'paiol-1': {
    largada: [232, 2512], chegada: 112, largura: 288, altura: 2528, minimo: 1927,
    postos: [[232, 2512], [248, 2288], [104, 1968], [56, 1712], [152, 1520], [168, 1264], [200, 944], [168, 720], [72, 592], [104, 272]],
  },
  'silo-1': {
    largada: [136, 2672], chegada: 112, largura: 288, altura: 2688, minimo: 1983,
    postos: [[136, 2672], [56, 2480], [200, 2160], [248, 2000], [216, 1744], [88, 1424], [72, 1200], [40, 944], [248, 784], [216, 592], [152, 272]],
  },
};

export const TORRE_PADRAO = 'celeiro-1';

const AMOSTRA = 4;
/** Por amostra (4 passos), em décimos: a corrida (110/s) e a prateleira mais rápida (~160/s), com folga. */
export const DX = 190;
/** Para cima: o pulo (310/s) e a viga que sobe no mesmo passo. */
export const SOBE = 240;
/** Para baixo: a queda (430/s) e a viga que desce. */
export const DESCE = 380;
/**
 * O quanto se sobe, no máximo, em 15, 45 e 150 amostras (1, 3 e 10 s), em décimos: o piloto automático sobe ~1210, ~2720 e
 * ~7900 (web/test/torre.test.ts confere que ele passa), e a folga é de uns 10 a 20%.
 */
export const JANELAS: [number, number][] = [[15, 1450], [45, 3200], [150, 8700]];
/** A última posição é de no máximo 3 passos antes de passar do topo, subindo (~7 px por passo), mais 1 px. */
export const ANTES_DO_TOPO = 3 * 70 + 10;
const SUBIDA_MAXIMA = 10 * 60 * 60;

export interface SubidaValidada {
  tempoMs: number;
  passos: number;
  amostras: number[];
}

export function validarTorre(torre: string, corpo: unknown): { ok: SubidaValidada } | { erro: string } {
  const def = TORRES_DO_CELEIRO[torre];
  if (!def) return { erro: 'Torre desconhecida.' };
  const invalida = { erro: 'Subida inválida.' };
  if (!corpo || typeof corpo !== 'object') return invalida;
  const { passos, amostras } = corpo as { passos?: unknown; amostras?: unknown };
  if (!Number.isInteger(passos) || (passos as number) < def.minimo || (passos as number) > SUBIDA_MAXIMA) return invalida;
  const esperado = 3 * (Math.floor(((passos as number) - 1) / AMOSTRA) + 1);
  if (!Array.isArray(amostras) || amostras.length !== esperado || !amostras.every((v) => Number.isInteger(v))) return invalida;
  const a = amostras as number[];
  if (Math.abs(a[0] - def.largada[0] * 10) > 40 || Math.abs(a[1] - def.largada[1] * 10) > 40) return invalida;
  let maisAlto = a[1];
  let subiu = 0;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i], y = a[i + 1], jeito = a[i + 2];
    if (x < 0 || x > def.largura * 10 || y < -640 || y > def.altura * 10 || ![-2, -1, 1, 2].includes(jeito)) return invalida;
    if (i === 0) continue;
    const dx = Math.abs(x - a[i - 3]), dy = y - a[i - 2];
    if (dx > DX || -dy > SOBE || dy > DESCE) {
      // o único salto que vale: a volta a um posto já alcançado (exato, porque é o próprio jogo que o põe lá)
      const posto = def.postos.some(([px, py]) => Math.abs(x - px * 10) <= 10 && Math.abs(y - py * 10) <= 10 && py * 10 >= maisAlto - 160);
      if (!posto || dy < 0) return invalida;
      continue;
    }
    if (dy < 0) subiu -= dy;
    if (y < maisAlto) maisAlto = y;
    const n = i / 3;
    for (const [amostras, maximo] of JANELAS) if (n >= amostras && a[(n - amostras) * 3 + 1] - y > maximo) return invalida;
  }
  if (a[a.length - 2] > def.chegada * 10 + ANTES_DO_TOPO) return invalida;
  if (subiu < (def.largada[1] - def.chegada) * 10 * 0.98) return invalida;
  return { ok: { tempoMs: Math.round(((passos as number) * 1000) / 60), passos: passos as number, amostras: a } };
}
