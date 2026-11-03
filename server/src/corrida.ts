/**
 * A CORRIDA DOS COELHOS, do lado do servidor (03/11/2026, degrau 1: contra o relógio, com os fantasmas dos amigos).
 *
 * A corrida roda inteira no computador de quem joga (web/src/corrida/): a física anda em passos fixos de 1/60 s, e o tempo
 * é o NÚMERO DE PASSOS, não o relógio. O servidor só guarda o melhor tempo e o fantasma, e confere o que dá para conferir
 * sem a pista: o fantasma tem uma posição a cada 4 passos, então o tempo declarado e o caminho andam juntos, e nenhuma
 * posição pode estar mais longe da anterior do que o kart anda no turbo. Cortar caminho pela grama continua possível
 * (o servidor não conhece o traçado): é uma corrida entre amigos, e a conferência existe para o console não mandar
 * "0:00.01".
 */

/** As pistas que existem, pelo id com a versão (mudar o traçado é pista nova: os fantasmas da antiga não servem). */
export const PISTAS: Record<string, { voltas: number }> = {
  'horta-1': { voltas: 3 },
};

const AMOSTRA = 4;
/** O turbo é 185 unidades/s: 12,3 por amostra, ×10 no fantasma. Com folga para a batida que empurra. */
const PASSO_MAXIMO = 160;
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
  return { ok: { tempoMs: Math.round((passos * 1000) / 60), voltas: voltas as number[], amostras: amostras as number[] } };
}
