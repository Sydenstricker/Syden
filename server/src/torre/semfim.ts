import { torreSemFim, type Torre } from './fases.js';
import { novoCoelho, passo, type Coelho, type Comandos } from './fisica.js';

/**
 * A SUBIDA SEM FIM (24/11/2026, o lote E da segunda auditoria): a torre montada pela semente (torreSemFim, em fases.ts) e a
 * ÁGUA QUE SOBE do chão do celeiro. Ela espera uns segundos, sobe devagar e vai apertando; quando passa dos pés do coelho, a
 * subida acaba. A pancada do que cai e do corvo continua levando ao último andar, e é assim que se "erra": a água alcança. Se
 * a pessoa fica muito acima, a água corre até chegar perto (para a subida sempre ter pressa). O RECORDE é o andar mais alto
 * a que se chegou (o posto), e quem conta é o SERVIDOR: o site manda os comandos de cada passo, e o servidor refaz a subida
 * inteira com a mesma torre e a mesma água (refazerSemFim). Mora em DUAS CÓPIAS IGUAIS (web/src/torre/ e server/src/torre/).
 *
 * Os números da água são chute, medidos contra o piloto automático (web/test/torre.test.ts): ninguém jogou com gente.
 */

/** Os passos antes de a água começar a subir (6 s). */
export const AGUA_ESPERA = 360;
/** De onde a água sai: abaixo do chão. */
export const AGUA_ABAIXO = 48;
/** A subida da água, em px por passo: começa em V0 e aperta ACEL a cada passo depois da espera. */
export const AGUA_V0 = 0.3;
export const AGUA_ACEL = 0.0002;
/** Mais longe que isto do último andar alcançado, a água corre RAPIDO vezes mais. */
export const AGUA_LONGE = 240;
export const AGUA_RAPIDO = 4;
/** Os pés do coelho a mais que isto abaixo da água: acabou. */
export const AGUA_FUNDO = 6;
/** Uma subida não passa disto (20 min): o servidor recusa mais passos. */
export const PASSOS_MAXIMOS_SEM_FIM = 20 * 60 * 60;

export interface SubidaSemFim {
  torre: Torre;
  k: Coelho;
  /** O nível da água (o y da superfície, de cima para baixo como o resto). */
  agua: number;
  /** Acabou: a água alcançou, ou chegou ao topo. */
  fim: boolean;
}

export function novaSubidaSemFim(semente: number, torre: Torre = torreSemFim(semente)): SubidaSemFim {
  return { torre, k: novoCoelho(torre), agua: torre.largada.y + AGUA_ABAIXO, fim: false };
}

/** Os andares alcançados (o posto mais alto em que se pisou; o topo conta como mais um). */
export const andaresDaSubida = (s: SubidaSemFim) => s.k.posto + (s.k.terminou ? 1 : 0);

/** Um passo da subida sem fim: a física de sempre e a água. Depois do fim, nada muda. */
export function passoSemFim(s: SubidaSemFim, c: Comandos): void {
  if (s.fim) return;
  const k = s.k;
  passo(k, c, s.torre);
  if (k.passos > AGUA_ESPERA) {
    let v = AGUA_V0 + (k.passos - AGUA_ESPERA) * AGUA_ACEL;
    if (s.agua - s.torre.postos[k.posto].y > AGUA_LONGE) v *= AGUA_RAPIDO;
    s.agua -= v;
  }
  if (k.terminou || k.y - s.agua > AGUA_FUNDO) s.fim = true;
}

/** Os comandos de um passo em 3 bits (esquerda 1, direita 2, pulo 4). */
export const emBits = (c: Comandos) => (c.esquerda ? 1 : 0) | (c.direita ? 2 : 0) | (c.pula ? 4 : 0);
export const deBits = (b: number): Comandos => ({ esquerda: (b & 1) !== 0, direita: (b & 2) !== 0, pula: (b & 4) !== 0 });

/** O gravador: os comandos de cada passo, juntos em pares [quantas vezes, bits]. */
export function gravadorSemFim() {
  const entradas: number[] = [];
  return {
    entradas,
    anotar(c: Comandos) {
      const b = emBits(c);
      const n = entradas.length;
      if (n && entradas[n - 1] === b && entradas[n - 2] < 60000) entradas[n - 2]++;
      else entradas.push(1, b);
    },
  };
}

/**
 * Refaz a subida pelas entradas (o que o servidor faz). Entradas inválidas: null. Os comandos depois do fim não contam; a
 * subida que parou antes do fim (a pessoa saiu) vale até onde chegou.
 */
export function refazerSemFim(semente: number, entradas: unknown, torre?: Torre): { andares: number; passos: number; fim: boolean } | null {
  if (!Number.isInteger(semente) || !Array.isArray(entradas) || entradas.length % 2 !== 0 || entradas.length > 200000) return null;
  let total = 0;
  for (let i = 0; i < entradas.length; i += 2) {
    const n = entradas[i],
      b = entradas[i + 1];
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(b) || b < 0 || b > 7) return null;
    total += n;
    if (total > PASSOS_MAXIMOS_SEM_FIM) return null;
  }
  const s = novaSubidaSemFim(semente, torre);
  for (let i = 0; i < entradas.length && !s.fim; i += 2) {
    const c = deBits(entradas[i + 1]);
    for (let j = 0; j < entradas[i] && !s.fim; j++) passoSemFim(s, c);
  }
  return { andares: andaresDaSubida(s), passos: s.k.passos, fim: s.fim };
}
