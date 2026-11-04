/**
 * O VOO DAS PRAGAS DA CAÇA ÀS PRAGAS DA HORTA (04/11/2026). Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/caca-voo.ts e web/src/caca/voo.ts (web/test/caca.test.ts confere). O servidor sorteia as pragas de cada onda e
 * confere cada tiro com esta conta; o site desenha com a mesma conta, e por isso a praga está no mesmo lugar nas duas pontas.
 *
 * Só a mecânica do gênero dos jogos de mira de fliperama (os alvos atravessam a tela, poucos tiros, mais rápido a cada onda);
 * nada de nome, personagem, arte ou som de ninguém. As pragas são nossas: corvos e gafanhotos, inimigos naturais de horta.
 */

/** A tela, em unidades do jogo (o site a amplia em pixels inteiros). O chão da horta começa em CHAO. */
export const LARGURA = 320;
export const ALTURA = 180;
export const CHAO = 138;

export type TipoDePraga = 'corvo' | 'gafanhoto';

/** Uma praga: quando aparece (ms desde o começo da onda), de onde sai, a velocidade e a ondulação, e quanto fica na tela. */
export interface Praga {
  tipo: TipoDePraga;
  t: number;
  x0: number;
  y0: number;
  /** Unidades por segundo. */
  vx: number;
  vy: number;
  /** O sobe e desce do voo (o corvo) ou o pulo (o gafanhoto). */
  amp: number;
  /** Ciclos por segundo. */
  freq: number;
  /** Quanto tempo ela fica na tela antes de fugir (ms). */
  vida: number;
}

/** O raio de acerto, em unidades: o gafanhoto é menor e vale mais. */
export const RAIO: Record<TipoDePraga, number> = { corvo: 12, gafanhoto: 9 };
export const PONTOS: Record<TipoDePraga, number> = { corvo: 100, gafanhoto: 150 };
/** O bônus pela rapidez: até isto a mais, para o tiro logo que ela aparece, caindo até zero no fim da vida dela. */
export const BONUS_RAPIDEZ = 50;

export const ONDAS = 5;

/** Onde a praga está em `ms` (desde o começo da onda), ou null se ainda não apareceu ou já fugiu. */
export function posicao(p: Praga, ms: number): { x: number; y: number } | null {
  if (ms < p.t || ms > p.t + p.vida) return null;
  const s = (ms - p.t) / 1000;
  const onda = p.tipo === 'corvo' ? Math.sin(s * p.freq * 2 * Math.PI) : -Math.abs(Math.sin(s * p.freq * Math.PI));
  return { x: p.x0 + p.vx * s, y: p.y0 + p.vy * s + p.amp * onda };
}

/** Os pontos de um acerto em `ms`: o do bicho, mais a rapidez. */
export function pontosDoAcerto(p: Praga, ms: number): number {
  const fracao = Math.max(0, Math.min(1, 1 - (ms - p.t) / p.vida));
  return PONTOS[p.tipo] + Math.round(BONUS_RAPIDEZ * fracao);
}

/**
 * Qual praga um tiro em (x, y), no instante `ms`, acerta: a mais perto do tiro, entre as que estão na tela e ainda não foram
 * abatidas por quem atirou. -1 se nenhuma.
 */
export function pragaAtingida(pragas: Praga[], abatidas: ReadonlySet<number>, x: number, y: number, ms: number): number {
  let melhor = -1;
  let menor = Infinity;
  for (let i = 0; i < pragas.length; i++) {
    if (abatidas.has(i)) continue;
    const p = posicao(pragas[i], ms);
    if (!p) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= RAIO[pragas[i].tipo] && d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Quantas pragas tem a onda `n` (de 1 a ONDAS), e a munição dela. */
export const pragasDaOnda = (n: number) => 4 + n * 2;
export const municaoDaOnda = (n: number) => Math.ceil(pragasDaOnda(n) * 1.5);

/**
 * As pragas da onda `n`, sorteadas: cada onda mais rápida e mais cheia. Os corvos cruzam o céu de um lado ao outro, com
 * o sobe e desce do voo; os gafanhotos saem da horta e atravessam pulando, mais baixos e mais depressa. Uma praga sai a
 * cada intervalo, às vezes duas juntas.
 */
export function sortearOnda(n: number, aleatorio: () => number = Math.random): Praga[] {
  const quantas = pragasDaOnda(n);
  const ritmo = 1 + (n - 1) * 0.22;
  const pragas: Praga[] = [];
  let t = 600;
  for (let i = 0; i < quantas; i++) {
    const gafanhoto = aleatorio() < Math.min(0.5, 0.15 + n * 0.07);
    const daEsquerda = aleatorio() < 0.5;
    const vida = Math.round((gafanhoto ? 2600 : 3400) / ritmo);
    // a distância que ela anda na vida: a tela inteira, e um pouco mais (para sair por fora)
    const distancia = LARGURA + 40;
    const vx = ((daEsquerda ? 1 : -1) * distancia) / (vida / 1000);
    const x0 = daEsquerda ? -20 : LARGURA + 20;
    if (gafanhoto) {
      const y0 = CHAO - 6 - aleatorio() * 14;
      pragas.push({ tipo: 'gafanhoto', t, x0, y0, vx, vy: 0, amp: 26 + aleatorio() * 22, freq: 1.4 + aleatorio() * 0.8, vida });
    } else {
      const y0 = 26 + aleatorio() * 70;
      const subida = (aleatorio() - 0.5) * 40;
      pragas.push({ tipo: 'corvo', t, x0, y0, vx, vy: subida / (vida / 1000), amp: 6 + aleatorio() * 14, freq: 0.5 + aleatorio() * 0.9, vida });
    }
    // às vezes a próxima sai junto (até duas na tela ao mesmo tempo, como nos fliperamas)
    t += aleatorio() < 0.3 ? 250 : Math.round((900 + aleatorio() * 900) / ritmo);
  }
  return pragas;
}

/** Quando a onda acaba: a última praga fugiu, e mais um respiro. */
export const fimDaOnda = (pragas: Praga[]) => Math.max(0, ...pragas.map((p) => p.t + p.vida)) + 600;
