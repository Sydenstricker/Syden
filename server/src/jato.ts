/**
 * OS COELHOS A JATO, do lado do servidor (05/11/2026): as medidas das pistas e a conferência do fantasma.
 *
 * Como na Corrida dos coelhos (corrida.ts, de onde a conferência foi copiada e ajustada à nave): a corrida roda inteira no
 * computador de quem joga (web/src/jato/), em passos fixos de 1/60 s, e o tempo é o NÚMERO DE PASSOS. O servidor só guarda o
 * melhor tempo e o fantasma, e confere o que dá para conferir sem a pista:
 * - uma posição a cada 4 passos, e o tempo declarado e o caminho andam juntos;
 * - nenhuma posição mais longe da anterior do que a nave anda no turbo (a queda e o resgate pelo trilho andam devagar, de
 *   propósito: o resgate leva a nave de volta ao meio da pista em 36 passos, e não num salto);
 * - cada volta anda pelo menos 70% da pista, passa pelos 10 MARCOS da linha do meio em ordem, e acaba perto da linha.
 * O que continua possível: cortar por dentro de uma curva entre dois marcos (no jogo isso é bater na borda ou cair). É uma
 * corrida entre amigos, e a conferência existe para o console não mandar um tempo impossível.
 */

/** As pistas, pelo id com a versão. As medidas saem de web/src/jato/pista.ts; web/test/jato.test.ts confere que batem. */
export const PISTAS_DO_JATO: Record<
  string,
  { voltas: number; comprimento: number; linha: [number, number]; largada: [number, number]; meiaLargura: number; marcos: [number, number][] }
> = {
  'cidade-1': {
    voltas: 4, comprimento: 2777, linha: [200, 190], largada: [148.7, 274.2], meiaLargura: 38,
    marcos: [[444, 141], [696, 144], [892, 286], [905, 536], [771, 720], [543, 642], [414, 822], [219, 900], [116, 675], [119, 424]],
  },
  'orbita-1': {
    voltas: 4, comprimento: 2606, linha: [170, 300], largada: [123.3, 387.8], meiaLargura: 38,
    marcos: [[358, 161], [591, 127], [817, 194], [912, 399], [800, 599], [834, 816], [635, 924], [414, 859], [233, 717], [115, 523]],
  },
  'nuvens-1': {
    voltas: 5, comprimento: 2258, linha: [240, 220], largada: [183.2, 300.7], meiaLargura: 36,
    marcos: [[437, 172], [641, 183], [808, 291], [813, 477], [779, 663], [688, 825], [491, 861], [308, 777], [202, 602], [161, 403]],
  },
};

export const ANDAR_POR_VOLTA = 0.7;
/** Quão longe da linha de chegada pode estar a posição do fim de cada volta (a nave anda ~7 por passo, mais a meia pista). */
export const PERTO_DA_LINHA = 70;
/** Quanto além da borda a nave pode passar de um marco (a queda num trecho aberto a leva para fora antes do resgate). */
export const MARGEM_DO_MARCO = 40;
export const AMOSTRA = 4;
/**
 * O turbo é 430 unidades/s: 28,7 por amostra, ×10 no fantasma, com folga para o empurrão da borda. O piloto automático
 * honesto, com as placas e o turbo, não passa de ~285 (web/test/jato.test.ts confere).
 */
export const PASSO_MAXIMO = 320;
/** Uma volta não leva menos de 5 s (a mais rápida honesta leva ~7), nem a corrida mais de 10 min. */
export const VOLTA_MINIMA = 5 * 60;
const CORRIDA_MAXIMA = 10 * 60 * 60;
const MUNDO = 10240;

export interface JatoValidado {
  tempoMs: number;
  voltas: number[];
  amostras: number[];
}

export function validarJato(pista: string, corpo: unknown): { ok: JatoValidado } | { erro: string } {
  const def = PISTAS_DO_JATO[pista];
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
