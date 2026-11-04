/**
 * A CORRIDA DOS COELHOS, do lado do servidor (03/11/2026, degrau 1: contra o relógio, com os fantasmas dos amigos).
 *
 * A corrida roda inteira no computador de quem joga (web/src/corrida/): a física anda em passos fixos de 1/60 s, e o tempo
 * é o NÚMERO DE PASSOS, não o relógio. O servidor só guarda o melhor tempo e o fantasma, e confere o que dá para conferir
 * sem a pista: o fantasma tem uma posição a cada 4 passos, então o tempo declarado e o caminho andam juntos, e nenhuma
 * posição pode estar mais longe da anterior do que o kart anda no turbo. E, desde a revisão de 03/11/2026 (um kart PARADO
 * passava e virava recorde de 0:24): cada volta tem de ANDAR pelo menos 70% do comprimento da pista, e acabar perto da
 * linha de chegada. E, desde a revisão independente de 03/11/2026 (um fantasma em ZIGUE-ZAGUE de ±8 sobre a linha de
 * chegada andava os 70% sem sair do lugar e virava recorde de 0:26, contra 1:00 do piloto automático honesto): cada volta
 * tem de passar, EM ORDEM, perto dos 10 MARCOS da linha do meio (a meia largura do asfalto mais MARGEM_DO_MARCO). O
 * servidor conhece só esses pontos, não o chão: cortar caminho pela grama entre um marco e outro continua possível, e
 * custa o que a grama custa a quem dirige de verdade. É uma corrida entre amigos, e a conferência existe para o console
 * não mandar um tempo impossível.
 */

/** As pistas que existem, pelo id com a versão (mudar o traçado é pista nova: os fantasmas da antiga não servem). */
export const PISTAS: Record<
  string,
  { voltas: number; comprimento: number; linha: [number, number]; caixas: number; meiaLargura: number; marcos: [number, number][] }
> = {
  // o comprimento da linha do meio, o ponto da linha de chegada, a meia largura do asfalto e os marcos (marcosDaPista, 10
  // por volta) saem de web/src/corrida/pista.ts; o teste web/test/corrida.test.ts confere que batem
  'horta-1': {
    voltas: 3, comprimento: 3008, linha: [250, 190], caixas: 2, meiaLargura: 30,
    marcos: [[519, 149], [785, 201], [820, 418], [563, 452], [684, 617], [869, 775], [660, 902], [398, 842], [212, 650], [200, 404]],
  },
  'pomar-1': {
    voltas: 3, comprimento: 2987, linha: [220, 300], caixas: 2, meiaLargura: 30,
    marcos: [[434, 174], [685, 136], [892, 270], [771, 480], [862, 657], [786, 887], [552, 815], [359, 881], [141, 760], [202, 526]],
  },
  'praia-1': {
    voltas: 3, comprimento: 3191, linha: [230, 230], caixas: 2, meiaLargura: 32,
    marcos: [[511, 170], [797, 199], [823, 438], [545, 456], [596, 643], [868, 714], [718, 902], [428, 898], [181, 785], [150, 502]],
  },
  'bosque-1': {
    voltas: 3, comprimento: 2891, linha: [200, 200], caixas: 2, meiaLargura: 26,
    marcos: [[448, 144], [691, 202], [885, 240], [787, 444], [865, 670], [690, 854], [514, 700], [315, 839], [245, 661], [139, 451]],
  },
  'neve-1': {
    voltas: 3, comprimento: 3458, linha: [260, 160], caixas: 2, meiaLargura: 32,
    marcos: [[568, 130], [853, 222], [781, 480], [490, 427], [534, 630], [837, 676], [750, 893], [436, 899], [176, 760], [182, 458]],
  },
  'canion-1': {
    voltas: 3, comprimento: 3204, linha: [220, 180], caixas: 2, meiaLargura: 30,
    marcos: [[505, 214], [774, 155], [893, 386], [648, 417], [738, 620], [824, 851], [547, 872], [299, 873], [145, 674], [190, 427]],
  },
};

/** Quanto de cada volta o kart tem de andar, no mínimo (o resto é o atalho que se aceita). */
export const ANDAR_POR_VOLTA = 0.7;
/** Quão longe da linha de chegada pode estar a posição do fim de cada volta (a meia pista é 30, mais a folga). */
export const PERTO_DA_LINHA = 60;
/** Quanto além da borda do asfalto o kart pode passar de um marco (a grama da curva, a escapada depois de um item). */
export const MARGEM_DO_MARCO = 30;

const AMOSTRA = 4;
/**
 * O turbo é 185 unidades/s: 12,3 por amostra, ×10 no fantasma, com um pouco de folga para a árvore que empurra. Era 160
 * (16 por amostra, 240 por segundo); a revisão independente de 03/11/2026 apertou: o piloto automático honesto, com as
 * placas e a derrapagem, não passa de 124 em nenhuma das seis pistas (web/test/corrida.test.ts confere).
 */
export const PASSO_MAXIMO = 135;
/** Uma volta não leva menos de 8 s, nem a corrida mais de 10 min. */
const VOLTA_MINIMA = 8 * 60;
const CORRIDA_MAXIMA = 10 * 60 * 60;
const MUNDO = 10240;

export interface CorridaValidada {
  tempoMs: number;
  voltas: number[];
  amostras: number[];
}

export function validarCorrida(pista: string, corpo: unknown): { ok: CorridaValidada } | { erro: string } {
  const def = PISTAS[pista];
  if (!def) return { erro: 'Pista desconhecida.' };
  if (!corpo || typeof corpo !== 'object') return { erro: 'Corrida inválida.' };
  const { voltas, amostras } = corpo as { voltas?: unknown; amostras?: unknown };
  if (!Array.isArray(voltas) || voltas.length !== def.voltas || !voltas.every((v) => Number.isInteger(v) && v > 0)) {
    return { erro: 'Corrida inválida.' };
  }
  for (let i = 0; i < voltas.length; i++) {
    if (voltas[i] - (i ? voltas[i - 1] : 0) < VOLTA_MINIMA) return { erro: 'Corrida inválida.' };
  }
  const passos = voltas[voltas.length - 1] as number;
  if (passos > CORRIDA_MAXIMA) return { erro: 'Corrida inválida.' };
  const esperado = 3 * (Math.floor((passos - 1) / AMOSTRA) + 1);
  if (!Array.isArray(amostras) || amostras.length !== esperado || !amostras.every((v) => Number.isInteger(v))) {
    return { erro: 'Corrida inválida.' };
  }
  for (let i = 0; i < amostras.length; i += 3) {
    const x = amostras[i] as number, y = amostras[i + 1] as number;
    if (x < 0 || y < 0 || x > MUNDO || y > MUNDO || Math.abs(amostras[i + 2] as number) > 1e7) return { erro: 'Corrida inválida.' };
    if (i > 0 && Math.hypot(x - (amostras[i - 3] as number), y - (amostras[i - 2] as number)) > PASSO_MAXIMO) {
      return { erro: 'Corrida inválida.' };
    }
  }
  // CADA VOLTA ANDA A PISTA E ACABA NA LINHA: a amostra do passo p é a de índice floor((p - 1) / 4)
  let inicio = 0;
  for (const v of voltas as number[]) {
    const fim = Math.floor((v - 1) / AMOSTRA);
    let andou = 0;
    for (let k = inicio + 1; k <= fim; k++) {
      andou += Math.hypot((amostras[k * 3] as number) - (amostras[k * 3 - 3] as number), (amostras[k * 3 + 1] as number) - (amostras[k * 3 - 2] as number));
    }
    if (andou / 10 < def.comprimento * ANDAR_POR_VOLTA) return { erro: 'Corrida inválida.' };
    const dx = (amostras[fim * 3] as number) / 10 - def.linha[0], dy = (amostras[fim * 3 + 1] as number) / 10 - def.linha[1];
    if (Math.hypot(dx, dy) > PERTO_DA_LINHA) return { erro: 'Corrida inválida.' };
    // OS MARCOS, em ordem: o trecho entre duas amostras seguidas tem de passar perto do próximo marco (o trecho, e não só a
    // amostra, porque no turbo o kart anda 12 unidades entre uma e outra)
    let marco = 0;
    const raio = def.meiaLargura + MARGEM_DO_MARCO;
    for (let k = inicio + 1; k <= fim && marco < def.marcos.length; k++) {
      const ax = (amostras[k * 3 - 3] as number) / 10, ay = (amostras[k * 3 - 2] as number) / 10;
      const bx = (amostras[k * 3] as number) / 10, by = (amostras[k * 3 + 1] as number) / 10;
      while (marco < def.marcos.length && distanciaAoTrecho(def.marcos[marco], ax, ay, bx, by) <= raio) marco++;
    }
    if (marco < def.marcos.length) return { erro: 'Corrida inválida.' };
    inicio = fim;
  }
  return { ok: { tempoMs: Math.round((passos * 1000) / 60), voltas: voltas as number[], amostras: amostras as number[] } };
}

/** A distância de um ponto ao trecho reto entre (ax, ay) e (bx, by). */
function distanciaAoTrecho([px, py]: [number, number], ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}
