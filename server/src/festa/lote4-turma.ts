/**
 * O QUE OS MICROJOGOS DE TURNO E DE EQUIPE DO LOTE 4 USAM (05/11/2026): a turma (quem joga, na ordem de chegada), o sorteio a
 * partir de números já sorteados, e a contagem ao vivo das teclas apertadas (o Cabo e a Torta). NÃO é um microjogo: o
 * registro não o lista.
 *
 * POR QUE A TURMA SE FORMA PELO 'entrar': o `gerar` só tem o sorteio, e a `vista` é chamada também para quem assiste. O que
 * prova que alguém JOGA é a ação 'acerto', que a rodada só aceita de quem está inscrito. Então cada tela manda
 * `{ entrar: 1 }` assim que o jogo começa, e a turma é a ordem de chegada. Os robôs do Solo não entram: o resultado deles vem
 * do `robo`, como em todo microjogo.
 */
import { FOLGA_ACIMA, inteiro, numero, type Conferencia, type Largada, type Turma } from './comum.js';

/**
 * AS EQUIPES IMPOSTAS (20/11/2026): o Tabuleiro da turma manda o 2 contra 2 e o 1 contra 3 pela cor das casas
 * (`OpcoesDaRodada.equipes`). Com elas, os lados (e os papéis) saem delas, e não da ordem de chegada; os robôs da turma jogam
 * pelo próprio microjogo, num ritmo fixo de quem joga bem (sem eles, o lado de um robô ficaria parado). Sem equipes impostas
 * (a Festa), null: tudo como sempre.
 */
export interface Impostas {
  equipes: number[][];
  robos: number[];
}
export const impostas = (turma?: Turma): Impostas | null =>
  turma?.equipes && turma.equipes.length === 2 && turma.equipes.every((e) => e.length > 0)
    ? { equipes: turma.equipes.map((e) => [...e]), robos: [...turma.robos] }
    : null;
/** A equipe de alguém nas impostas, ou −1. */
export const equipeImposta = (im: Impostas, id: number) => im.equipes.findIndex((e) => e.includes(id));
/** Os robôs de uma turma imposta jogam neste ritmo (toques por segundo), a partir de ROBO_COMECA_MS. */
export const RITMO_DO_ROBO = 6;
export const ROBO_COMECA_MS = 600;
/** Quantos toques um robô já deu, `passou` ms depois do começo (com `desde` como o começo da vez dele). */
export const toquesDoRobo = (passou: number, desde = 0, ritmo = RITMO_DO_ROBO) => Math.max(0, Math.floor((ritmo * (passou - desde - ROBO_COMECA_MS)) / 1000));

/** Quanto se espera pelos 'entrar' antes de sortear os papéis (a rede de 600 ms cabe com folga). */
export const JUNTAR_MS = 1200;

/** Põe `quem` na turma (uma vez só) e devolve a posição dele. */
export function entrar(membros: number[], quem: number): number {
  const i = membros.indexOf(quem);
  if (i >= 0) return i;
  membros.push(quem);
  return membros.length - 1;
}

/** Embaralha `lista` com números de 0 a 1 já sorteados no `gerar` (repetível). */
export function embaralhar<T>(lista: readonly T[], sorteios: readonly number[]): T[] {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor((sorteios[i % sorteios.length] ?? 0.5) * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** A largada guardada na memória: o relógio da rodada, para as ações ao vivo marcarem o próximo passo e avisarem a sala. */
export interface ComRelogio {
  l: Largada<unknown, unknown> | null;
}

/** O placar de alguém numa contagem ao vivo: o total aceito e o instante (ms desde o começo) em que foi dito. */
export interface Contagem {
  n: number;
  t: number;
}

/**
 * Confere um total dito ao vivo ('acerto' `{ n, t }`: "já apertei n vezes, e o último foi em t"). Vale se cabe no relógio, se
 * não diminui e se não passa do ritmo máximo de quem aperta muito (`porSegundo`) desde o começo da contagem (`desde`).
 * Devolve se mudou.
 */
export function contar(placar: Map<number, Contagem>, c: Conferencia<unknown, unknown>, porSegundo: number, desde = 0): boolean {
  const { n, t } = c.corpo;
  if (!inteiro(n) || !numero(t) || n < 0 || !c.cabe(t)) return false;
  const antes = placar.get(c.quem) ?? { n: 0, t: desde };
  if (n <= antes.n || t < antes.t) return false;
  // o teto: o ritmo máximo desde o começo, mais dois toques de folga (o arredondamento e o primeiro aperto)
  const teto = Math.floor(((Math.max(0, Math.min(t, c.passou + FOLGA_ACIMA) - desde)) * porSegundo) / 1000) + 2;
  if (n > teto) return false;
  placar.set(c.quem, { n, t });
  return true;
}

/** Avisa a sala, no máximo a cada `ms` (a contagem ao vivo chega muitas vezes por segundo). */
export function avisarComFreio(r: ComRelogio & { avisadoEm?: number }, agora: number, ms = 120) {
  if (!r.l) return;
  if (r.avisadoEm !== undefined && agora - r.avisadoEm < ms) return;
  r.avisadoEm = agora;
  r.l.avisar();
}
