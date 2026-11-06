/**
 * A REGATA DA TOCA, do lado do servidor (05/11/2026): as medidas das pistas e a conferência do fantasma.
 *
 * Como na Corrida dos coelhos e nos Coelhos a jato (corrida.ts e jato.ts, de onde a conferência foi copiada e ajustada ao
 * barco): a corrida roda inteira no computador de quem joga (web/src/barco/), em passos fixos de 1/60 s, e o tempo é o NÚMERO
 * DE PASSOS. O servidor só guarda o melhor tempo e o fantasma, e confere o que dá para conferir sem a pista:
 * - uma posição a cada 4 passos, e o tempo declarado e o caminho andam juntos;
 * - nenhuma posição mais longe da anterior do que o barco anda no turbo da boia, a favor da correnteza;
 * - cada volta anda pelo menos 70% da pista, passa pelos 10 MARCOS da linha do meio em ordem, e acaba perto da linha.
 * O que continua possível: cortar por dentro de uma curva entre dois marcos (no jogo isso é bater na margem). É uma corrida
 * entre amigos, e a conferência existe para o console não mandar um tempo impossível.
 */

/** As pistas, pelo id com a versão. As medidas saem de web/src/barco/pista.ts; web/test/barco.test.ts confere que batem. */
export const PISTAS_DO_BARCO: Record<
  string,
  { voltas: number; comprimento: number; linha: [number, number]; largada: [number, number]; meiaLargura: number; marcos: [number, number][] }
> = {
  'lago-1': {
    voltas: 3, comprimento: 2348, linha: [230, 250], largada: [188.3, 292.6], meiaLargura: 52,
    marcos: [[430, 180], [643, 178], [824, 282], [837, 475], [872, 674], [777, 840], [571, 857], [385, 759], [216, 629], [145, 438]],
  },
  'riacho-1': {
    voltas: 2, comprimento: 3028, linha: [170, 210], largada: [130.3, 254.5], meiaLargura: 40,
    marcos: [[424, 145], [658, 179], [883, 246], [816, 478], [789, 634], [743, 878], [490, 848], [320, 792], [128, 689], [188, 436]],
  },
  'mangue-1': {
    voltas: 2, comprimento: 2848, linha: [200, 300], largada: [169.8, 351.7], meiaLargura: 44,
    marcos: [[416, 168], [669, 205], [881, 211], [818, 424], [856, 605], [840, 850], [600, 820], [362, 893], [284, 711], [153, 541]],
  },
};

export const ANDAR_POR_VOLTA = 0.7;
/** Quão longe da linha de chegada pode estar a posição do fim de cada volta (o barco anda ~6 por passo, mais a meia pista). */
export const PERTO_DA_LINHA = 80;
/** Quanto além da margem o barco pode passar de um marco (a margem empurra de volta, mas não na hora exata da amostra). */
export const MARGEM_DO_MARCO = 20;
export const AMOSTRA = 4;
/**
 * O turbo da boia leva o barco a ~330 unidades/s, e a correnteza soma até 60: 26 por amostra, ×10 no fantasma, com folga para
 * o empurrão da margem. O piloto automático honesto não passa de ~200 (web/test/barco.test.ts confere).
 */
export const PASSO_MAXIMO = 300;
/** Uma volta não leva menos de 6 s (a mais rápida do piloto automático leva ~18), nem a corrida mais de 10 min. */
export const VOLTA_MINIMA = 6 * 60;
const CORRIDA_MAXIMA = 10 * 60 * 60;
const MUNDO = 10240;

export interface BarcoValidado {
  tempoMs: number;
  voltas: number[];
  amostras: number[];
}

export function validarBarco(pista: string, corpo: unknown): { ok: BarcoValidado } | { erro: string } {
  const def = PISTAS_DO_BARCO[pista];
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
  // a primeira posição é a da largada
  if (Math.hypot((amostras[0] as number) / 10 - def.largada[0], (amostras[1] as number) / 10 - def.largada[1]) > 12) return { erro: 'Corrida inválida.' };
  for (let i = 0; i < amostras.length; i += 3) {
    const x = amostras[i] as number, y = amostras[i + 1] as number;
    if (x < 0 || y < 0 || x > MUNDO || y > MUNDO || Math.abs(amostras[i + 2] as number) > 1e7) return { erro: 'Corrida inválida.' };
    if (i > 0 && Math.hypot(x - (amostras[i - 3] as number), y - (amostras[i - 2] as number)) > PASSO_MAXIMO) return { erro: 'Corrida inválida.' };
  }
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

function distanciaAoTrecho([px, py]: [number, number], ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}
