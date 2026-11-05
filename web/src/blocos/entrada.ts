/**
 * HORTA EM CASCATA: as entradas da tela (a troca, o "subir") viram jogadas gravadas na partida, com as regras que o servidor
 * também confere (minijogo-blocos.ts): o ritmo e o intervalo entre trocas. Fica fora do componente para ser testado.
 */
import * as Sim from './sim';

export type Entrada = { tipo: 'troca'; l: number; c: number; vertical?: boolean } | { tipo: 'subir' };

/** No máximo tantas trocas esperando a vez (o intervalo entre trocas, ou o ritmo): mais que isso não é mão de gente. */
export const MAX_NA_FILA = 12;
/** O "subir" só é gravado com menos que isto de jogadas no último segundo: as trocas sempre têm lugar no ritmo. */
const RESERVA_DO_SUBIR = Sim.MAX_JOGADAS_POR_SEGUNDO - Sim.PASSOS_POR_SEGUNDO / Sim.INTERVALO_DA_TROCA;

/** Quantas jogadas no último segundo de passos, até o passo n. */
const noUltimoSegundo = (jogadas: readonly Sim.Jogada[], n: number) => {
  let conta = 0;
  for (let i = jogadas.length - 1; i >= 0 && jogadas[i][0] > n - Sim.PASSOS_POR_SEGUNDO; i--) conta++;
  return conta;
};

/**
 * Grava a entrada no passo n. Devolve false se a troca tem de esperar a vez (o intervalo entre trocas, ou o ritmo): ela fica
 * na fila para o passo seguinte, e não some. O "subir" só é gravado quando faz efeito (segurar o X não enche o ritmo), e
 * só com folga no ritmo: as trocas nunca ficam sem lugar.
 */
export function registrarEntrada(s: Sim.Simulacao, x: Entrada, n: number): boolean {
  if (x.tipo === 'subir') {
    if (Sim.subirFazEfeito(s.e) && noUltimoSegundo(s.jogadas, n) < RESERVA_DO_SUBIR) s.jogadas.push([n, 1, 0, 0]);
    return true;
  }
  // a regra não deixa (a peça está caindo, ou some): não é troca
  if (x.vertical ? !Sim.podeTrocarNaVertical(s.e, x.l, x.c) : !Sim.podeTrocar(s.e, x.l, x.c)) return true;
  if (!Sim.cabeNoRitmo(s.jogadas, n) || !Sim.trocaNoIntervalo(s.jogadas, n)) return false;
  s.jogadas.push([n, x.vertical ? 2 : 0, x.l, x.c]);
  return true;
}
