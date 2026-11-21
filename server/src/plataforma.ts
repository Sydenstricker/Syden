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
 *
 * OS BICHOS DE PATRULHA (19/11/2026, as três fases novas): o servidor também não os conhece. Encostar de lado volta ao posto
 * (um salto que ele já aceita), e pisar dá um pulinho (dentro da subida que ele já aceita). Quem inventa o caminho pelo console
 * atravessa os bichos como atravessa a parede, com o mesmo ganho pequeno.
 * AS CENOURAS (19/11/2026): contadas À PARTE do tempo; o servidor só aceita as que o caminho passou perto (cenourasDoCaminho).
 * Um caminho inventado pode passar por todas: a dourada "achada" é entre amigos, como o tempo.
 */

/**
 * As fases: as medidas saem de web/src/plataforma/fases.ts, e o teste web/test/plataforma.test.ts confere que batem.
 * `rapidos`: os trechos [x0, x1] onde há plataforma que anda de lado (lá o coelho pode ir mais rápido, levado por ela).
 */
export const FASES_DO_PULO: Record<
  string,
  {
    largada: [number, number];
    chegada: number;
    largura: number;
    postos: [number, number][];
    rapidos: [number, number][];
  }
> = {
  'prado-1': {
    largada: [56, 176],
    chegada: 3392,
    largura: 3584,
    postos: [
      [56, 176],
      [1032, 176],
      [2040, 160],
      [2696, 160],
    ],
    rapidos: [[2432, 2640]],
  },
  'toca-1': {
    largada: [56, 176],
    chegada: 3584,
    largura: 3776,
    postos: [
      [56, 176],
      [1000, 176],
      [1288, 80],
      [2072, 176],
      [2808, 160],
    ],
    rapidos: [[2976, 3184]],
  },
  'copas-1': {
    largada: [56, 160],
    chegada: 3520,
    largura: 3712,
    postos: [
      [56, 160],
      [680, 144],
      [1368, 64],
      [1960, 160],
      [2568, 160],
    ],
    rapidos: [
      [800, 1008],
      [2720, 2928],
    ],
  },
  // as fases com bichos de patrulha (19/11/2026): o servidor não conhece os bichos, como não conhece os blocos
  'corrego-1': {
    largada: [56, 176],
    chegada: 3488,
    largura: 3680,
    postos: [
      [56, 176],
      [1080, 176],
      [1800, 176],
      [2280, 160],
    ],
    rapidos: [[2016, 2224]],
  },
  'mina-1': {
    largada: [56, 176],
    chegada: 3456,
    largura: 3648,
    postos: [
      [56, 176],
      [792, 144],
      [1320, 80],
      [1720, 176],
      [2600, 160],
    ],
    rapidos: [[2336, 2544]],
  },
  'ninho-1': {
    largada: [56, 160],
    chegada: 3424,
    largura: 3616,
    postos: [
      [56, 160],
      [664, 144],
      [1384, 64],
      [1976, 160],
      [2440, 160],
    ],
    rapidos: [
      [832, 1040],
      [2176, 2384],
    ],
  },
  // as fases com um elemento novo (21/11/2026): a corrente de ar sobe no máximo a 220/s (cabe no y da mola), e a pedra que
  // racha e a tábua que pisca só seguram ou deixam cair: o servidor não as conhece, como não conhece os blocos
  'vento-1': {
    largada: [56, 160],
    chegada: 3328,
    largura: 3520,
    postos: [
      [56, 160],
      [456, 144],
      [776, 64],
      [1288, 160],
      [1752, 144],
      [2408, 96],
    ],
    rapidos: [],
  },
  'caverna-1': {
    largada: [56, 176],
    chegada: 3392,
    largura: 3584,
    postos: [
      [56, 176],
      [584, 176],
      [1064, 176],
      [1608, 80],
      [1912, 160],
      [2440, 160],
    ],
    rapidos: [],
  },
  'cachoeira-1': {
    largada: [56, 176],
    chegada: 3328,
    largura: 3552,
    postos: [
      [56, 176],
      [584, 176],
      [1080, 80],
      [1544, 160],
      [2152, 160],
      [2632, 160],
    ],
    rapidos: [[2368, 2576]],
  },
};

/**
 * AS CENOURAS DE CADA FASE (19/11/2026): o meio de cada cenoura para juntar e da dourada escondida, iguais às do site
 * (web/test/plataforma.test.ts confere). Contam À PARTE do tempo: o tempo continua o número de passos.
 */
export const CENOURAS_DO_PULO: Record<string, { dourada: [number, number] | null; cenouras: [number, number][] }> = {
  'prado-1': {
    dourada: [1608, 56],
    cenouras: [
      [104, 166],
      [152, 166],
      [200, 166],
      [248, 166],
      [408, 166],
      [456, 166],
      [504, 166],
      [552, 166],
      [600, 166],
      [1224, 136],
      [1336, 104],
      [1448, 136],
      [1800, 70],
      [1848, 70],
      [1896, 70],
      [1944, 70],
      [2728, 150],
      [2760, 150],
      [2792, 150],
      [3128, 166],
      [3176, 166],
      [3224, 166],
      [3272, 166],
      [3320, 166],
      [3368, 166],
    ],
  },
  'toca-1': {
    dourada: [2424, 56],
    cenouras: [
      [72, 166],
      [120, 166],
      [168, 166],
      [248, 166],
      [280, 166],
      [312, 166],
      [552, 166],
      [584, 166],
      [1320, 70],
      [1368, 70],
      [1416, 70],
      [1464, 70],
      [1864, 104],
      [1960, 136],
      [2168, 166],
      [2200, 166],
      [2232, 166],
      [2264, 166],
      [3208, 150],
      [3240, 150],
      [3272, 150],
      [3352, 150],
      [3400, 150],
      [3448, 150],
      [3496, 150],
      [3544, 150],
    ],
  },
  'copas-1': {
    dourada: [1528, 40],
    cenouras: [
      [104, 150],
      [152, 150],
      [200, 150],
      [296, 136],
      [424, 120],
      [552, 136],
      [648, 134],
      [680, 134],
      [712, 134],
      [1064, 120],
      [1192, 88],
      [1400, 54],
      [1448, 54],
      [1496, 54],
      [1608, 88],
      [1720, 120],
      [1832, 136],
      [1928, 150],
      [1960, 150],
      [1992, 150],
      [3096, 150],
      [3128, 150],
      [3240, 150],
      [3288, 150],
      [3336, 150],
      [3384, 150],
      [3432, 150],
      [3480, 150],
    ],
  },
  'corrego-1': {
    dourada: [1352, 88],
    cenouras: [
      [104, 166],
      [152, 166],
      [200, 166],
      [248, 166],
      [408, 166],
      [456, 166],
      [504, 166],
      [552, 166],
      [600, 166],
      [760, 136],
      [872, 120],
      [984, 136],
      [1064, 88],
      [1160, 88],
      [1256, 88],
      [1832, 166],
      [1880, 166],
      [1928, 166],
      [1976, 166],
      [3144, 166],
      [3192, 166],
      [3240, 166],
      [3288, 166],
      [3336, 166],
      [3384, 166],
      [3432, 166],
    ],
  },
  'mina-1': {
    dourada: [2024, 88],
    cenouras: [
      [88, 166],
      [136, 166],
      [184, 166],
      [232, 166],
      [280, 166],
      [392, 166],
      [424, 166],
      [456, 166],
      [840, 134],
      [888, 134],
      [936, 134],
      [1352, 70],
      [1400, 70],
      [1448, 70],
      [1496, 70],
      [1544, 70],
      [1736, 88],
      [1832, 88],
      [1928, 88],
      [2632, 150],
      [2680, 150],
      [2728, 150],
      [2776, 150],
      [3272, 150],
      [3320, 150],
      [3368, 150],
      [3416, 150],
    ],
  },
  'ninho-1': {
    dourada: [1928, 8],
    cenouras: [
      [104, 150],
      [152, 150],
      [200, 150],
      [296, 136],
      [424, 120],
      [552, 136],
      [680, 134],
      [712, 134],
      [1096, 120],
      [1224, 88],
      [1432, 54],
      [1480, 54],
      [1528, 54],
      [1672, 24],
      [1800, 24],
      [2056, 24],
      [1960, 150],
      [1992, 150],
      [2712, 120],
      [2824, 104],
      [2936, 120],
      [3048, 150],
      [3096, 150],
      [3144, 150],
      [3192, 150],
      [3240, 150],
      [3288, 150],
      [3336, 150],
      [3384, 150],
    ],
  },
  'vento-1': {
    dourada: [2408, 24],
    cenouras: [
      [104, 150], [152, 150], [200, 150], [296, 88], [328, 88], [360, 88], [712, 104], [808, 54], [856, 54], [904, 54],
      [952, 54], [1320, 150], [1368, 150], [1416, 150], [1544, 88], [1640, 88], [1992, 166], [2040, 166], [2088, 166],
      [2136, 166], [2440, 86], [2488, 86], [2536, 86], [2888, 104], [3144, 150], [3192, 150], [3240, 150], [3288, 150],
    ],
  },
  'caverna-1': {
    dourada: [1848, 56],
    cenouras: [
      [88, 166], [136, 166], [184, 166], [232, 166], [280, 166], [392, 152], [488, 136], [808, 168], [888, 168], [968, 168],
      [1128, 166], [1160, 166], [1192, 166], [1224, 166], [1624, 70], [1672, 70], [1720, 70], [1768, 70], [1944, 150],
      [1992, 150], [2040, 150], [2088, 150], [2808, 104], [3176, 150], [3224, 150], [3272, 150], [3320, 150],
    ],
  },
  'cachoeira-1': {
    dourada: [2024, 104],
    cenouras: [
      [104, 166], [152, 166], [200, 166], [248, 166], [392, 152], [488, 152], [616, 166], [664, 166], [712, 166], [1112, 70],
      [1160, 70], [1208, 70], [1256, 70], [1816, 152], [1896, 152], [2056, 152], [2184, 150], [2232, 150], [2280, 150],
      [2328, 150], [3048, 150], [3096, 150], [3144, 150], [3192, 150], [3240, 150], [3288, 150],
    ],
  },
};

/**
 * Quantas cenouras o caminho passou perto, e se passou pela dourada: o servidor não conhece a física, então confere pelo
 * fantasma. O coelho pega a cenoura quando o meio dela fica a menos de ~10 px do meio do corpo dele; aqui, a cenoura vale se
 * algum trecho do caminho (entre duas amostras seguidas, sem a volta ao posto) passa a menos de 16 px dela. Ninguém ganha
 * cenoura que o caminho não passou; quem passou raspando sem pegar pode ganhar uma a mais do que pegou, e por isso a tela manda
 * quantas pegou, e vale o MENOR dos dois.
 */
export function cenourasDoCaminho(fase: string, amostras: number[]): { cenouras: number; dourada: boolean } {
  const def = CENOURAS_DO_PULO[fase];
  if (!def) return { cenouras: 0, dourada: false };
  const perto = ([cx, cy]: [number, number]) => {
    const px = cx * 10;
    const py = cy * 10;
    for (let i = 3; i < amostras.length; i += 3) {
      const ax = amostras[i - 3],
        ay = amostras[i - 2] - 110,
        bx = amostras[i],
        by = amostras[i + 1] - 110;
      if (Math.abs(bx - ax) > 400) continue;
      const dx = bx - ax,
        dy = by - ay;
      const d2 = dx * dx + dy * dy;
      const t = d2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / d2)) : 0;
      const qx = ax + dx * t - px,
        qy = ay + dy * t - py;
      if (qx * qx + qy * qy <= 160 * 160) return true;
    }
    return false;
  };
  return {
    cenouras: def.cenouras.filter(perto).length,
    dourada: def.dourada !== null && perto(def.dourada),
  };
}

/** A copa: as três fases seguidas (o site tem a mesma lista: COPAS_DO_PULO em web/src/plataforma/fases.ts). */
export const COPAS_DO_PULO: Record<string, string[]> = {
  'copa-do-pulo': ['prado-1', 'toca-1', 'copas-1'],
  'copa-dos-bichos': ['corrego-1', 'mina-1', 'ninho-1'],
  'copa-dos-elementos': ['vento-1', 'caverna-1', 'cachoeira-1'],
};

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
/** A mola sobe a 500/s; a queda, no máximo 430/s. Pisar num bicho (19/11/2026) dá no máximo o pulo (310/s): cabe aqui. */
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
  const { passos, amostras } = corpo as {
    passos?: unknown;
    amostras?: unknown;
  };
  if (!Number.isInteger(passos) || (passos as number) < 60 || (passos as number) > FASE_MAXIMA) return invalida;
  const esperado = 3 * (Math.floor(((passos as number) - 1) / AMOSTRA) + 1);
  if (!Array.isArray(amostras) || amostras.length !== esperado || !amostras.every((v) => Number.isInteger(v))) return invalida;
  const a = amostras as number[];
  // a primeira posição é a do primeiro passo, na largada
  if (Math.abs(a[0] - def.largada[0] * 10) > 40 || Math.abs(a[1] - def.largada[1] * 10) > 40) return invalida;
  let maiorX = a[0];
  let andou = 0;
  for (let i = 0; i < a.length; i += 3) {
    const x = a[i],
      y = a[i + 1],
      jeito = a[i + 2];
    if (x < 0 || x > def.largura * 10 || y < -640 || y > 2600 || ![-2, -1, 1, 2].includes(jeito)) return invalida;
    if (i === 0) continue;
    const dx = Math.abs(x - a[i - 3]),
      dy = Math.abs(y - a[i - 2]);
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
  return {
    ok: {
      tempoMs: Math.round(((passos as number) * 1000) / 60),
      passos: passos as number,
      amostras: a,
    },
  };
}
