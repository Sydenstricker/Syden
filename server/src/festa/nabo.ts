/**
 * O ARREMESSO DO NABO (05/11/2026; Bowser Toss no levantamento em docs/mario-party-3.md, só a mecânica, com o tema nosso): o
 * coelho gira no lugar segurando um nabo gigante pela rama, cada vez mais rápido, e solta no aperto. Só vale soltar com o nabo
 * apontando para o campo (um quarto da volta); quanto mais rápido o giro, mais longe ele vai. Esperar demais deixa o coelho
 * tonto, e o nabo cai ali mesmo. Três arremessos, cada um na sua vez; vale o mais longe.
 *
 * As vezes são FIXAS no relógio (todos giram juntos): cada uma dura NABO_VEZ_MS, com o giro nos primeiros NABO_GIRO_MS. A
 * soltura vai na hora (a ação 'acerto', com o instante dela) e só vale se couber no relógio do servidor; a primeira de cada
 * vez é a que conta. A conta (`arremesso`) é só + − × ÷, Math.floor e Math.abs, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const NABO_VEZES = 3;
export const NABO_VEZ_MS = 6500;
/** Quanto o giro dura em cada vez (depois disso, tonto). */
export const NABO_GIRO_MS = 5000;
/** O meio do campo, como fração da volta (0 é para a direita, e a volta anda no sentido do relógio da tela). */
export const NABO_CAMPO = 0;
/** Metade do setor do campo, em fração da volta (um quarto da volta inteira). */
export const NABO_SETOR = 0.125;

export interface DadosNabo {
  /** A velocidade do giro no começo de cada vez (voltas por segundo), e quanto ela cresce por segundo. */
  giros: { v0: number; a: number }[];
}

/** Quantas voltas o giro deu `ms` depois do começo da vez (ms em segundos: v0·s + a·s²/2). */
export const voltasDoNabo = (g: { v0: number; a: number }, ms: number) => {
  const s = ms / 1000;
  return g.v0 * s + (g.a * s * s) / 2;
};
/** A velocidade do giro, em voltas por segundo, `ms` depois do começo da vez. */
export const velocidadeDoNabo = (g: { v0: number; a: number }, ms: number) => g.v0 + (g.a * ms) / 1000;

/**
 * O ARREMESSO: soltar `ms` depois do começo da vez. Fora do campo, `null` (a falta); no campo, os metros: a velocidade do giro
 * vezes 12, menos até um terço por ter saído da beira do setor.
 */
export function arremesso(g: { v0: number; a: number }, ms: number): number | null {
  if (ms < 0 || ms > NABO_GIRO_MS) return null;
  const v = voltasDoNabo(g, ms);
  const fracao = v - Math.floor(v);
  // a distância (na volta) até o meio do campo
  let desvio = Math.abs(fracao - NABO_CAMPO);
  if (desvio > 0.5) desvio = 1 - desvio;
  if (desvio > NABO_SETOR) return null;
  const q = desvio / NABO_SETOR;
  return Math.round(12 * velocidadeDoNabo(g, ms) * (1 - (q * q) / 3) * 10) / 10;
}

/** A vez de um instante desde o começo do jogo, e quanto dela já passou. */
export const vezDoNabo = (t: number) => ({ vez: Math.floor(t / NABO_VEZ_MS), ms: t - Math.floor(t / NABO_VEZ_MS) * NABO_VEZ_MS });

const peloMelhor = (metros: number[]): Resultado => {
  const m = Math.max(0, ...metros);
  return m === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: m, chave: [-m] };
};

/** De cada pessoa: os metros de cada vez já jogada (0 para a falta). */
type Mem = Map<number, Map<number, number>>;

export default microjogo<DadosNabo, Mem>({
  id: 'nabo',
  gerar(aleatorio) {
    const giros: { v0: number; a: number }[] = [];
    for (let k = 0; k < NABO_VEZES; k++) giros.push({ v0: Math.round((0.5 + aleatorio() * 0.3) * 100) / 100, a: Math.round((0.28 + aleatorio() * 0.12) * 100) / 100 });
    return { giros };
  },
  duracao: () => NABO_VEZES * NABO_VEZ_MS + 1000,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // a soltura é a de agora (com a folga da rede): calcular a perfeita e mandar depois não vale
    if (!numero(t) || t < 0 || !cabe(t)) return;
    const { vez, ms } = vezDoNabo(t);
    if (vez >= NABO_VEZES || ms > NABO_GIRO_MS) return;
    const meus = mem.get(quem) ?? new Map<number, number>();
    if (meus.has(vez)) return;
    meus.set(vez, arremesso(dados.giros[vez], ms) ?? 0);
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => peloMelhor([...(mem.get(quem)?.values() ?? [])]),
  *noFim({ mem }) {
    for (const [quem, vezes] of mem) yield [quem, peloMelhor([...vezes.values()])] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // quem joga bem solta no campo, com o giro já rápido, mas não no limite; e só no tempo que a rodada durou
    const metros: number[] = [];
    for (let k = 0; k < NABO_VEZES; k++) {
      const cabe = Math.min(NABO_GIRO_MS, passouMs - k * NABO_VEZ_MS);
      if (cabe < 800) break;
      const ms = Math.min(cabe, 2500 + aleatorio() * 2000);
      metros.push(Math.round(12 * velocidadeDoNabo(dados.giros[k], ms) * (0.75 + aleatorio() * 0.25) * 10) / 10);
    }
    return peloMelhor(metros);
  },
});
