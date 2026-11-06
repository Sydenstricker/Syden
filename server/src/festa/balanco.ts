/**
 * O PULO DO BALANÇO (05/11/2026; Swinging with Sharks no levantamento em docs/mario-party-3.md, só a mecânica, sem tubarão: é
 * o lago da horta): o coelho vai e vem num balanço na beira do lago e pula no aperto. Onde ele cai depende de onde o balanço
 * estava e para que lado ia: soltar indo para a frente, perto de baixo, vai mais longe. No lago boiam três folhas de
 * vitória-régia; a mais longe é a menor e vale mais. Cair na água não vale nada, e soltar indo para trás é voltar à margem.
 * Três pulos, cada um na sua vez; vale a soma.
 *
 * O balanço não usa seno: o vaivém é a parábola de cada meia volta (`vaivem`), que se parece com ele e dá o mesmo número nos
 * dois lados. A conta (`pulo`) é só + − × ÷, Math.floor e comparação, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const BALANCO_VEZES = 3;
export const BALANCO_VEZ_MS = 5000;
/** Quanto o balanço anda em cada vez (depois disso, ele para e o pulo não sai). */
export const BALANCO_GIRO_MS = 4000;
/** O eixo do balanço (no desenho, x), a beira do lago, e quanto pesa a posição e a velocidade na hora de soltar. */
export const BALANCO_X = 110;
export const BEIRA_DO_LAGO = 128;
export const PESO_DA_POSICAO = 26;
export const PESO_DA_VELOCIDADE = 150;

/** A onda do balanço, sem seno: na primeira meia volta sobe e desce de 0 a 1 (uma parábola), na segunda de 0 a −1. */
export function vaivem(fase: number): number {
  const f = fase - Math.floor(fase);
  if (f < 0.5) return 8 * f * (1 - 2 * f);
  const g = f - 0.5;
  return -8 * g * (1 - 2 * g);
}

export interface Folha {
  /** O meio e a meia largura (no desenho), e quanto vale. */
  x: number;
  meia: number;
  valor: number;
}

export interface DadosBalanco {
  /** Uma ida e volta do balanço, em ms. */
  periodoMs: number;
  /** As folhas de cada vez. */
  folhas: Folha[][];
}

/** Onde o coelho cai, soltando `ms` depois do começo da vez (a posição, e a velocidade pela onda um quarto adiante). */
export function ondeCai(periodoMs: number, ms: number): number {
  const fase = ms / periodoMs;
  return BALANCO_X + PESO_DA_POSICAO * vaivem(fase) + PESO_DA_VELOCIDADE * vaivem(fase + 0.25);
}

/** O pulo: os pontos da folha em que caiu (0 na água ou na margem), e onde caiu. */
export function pulo(d: DadosBalanco, vez: number, ms: number): { x: number; valor: number } {
  if (ms < 0 || ms > BALANCO_GIRO_MS) return { x: BALANCO_X, valor: 0 };
  const x = ondeCai(d.periodoMs, ms);
  for (const f of d.folhas[vez]) if (Math.abs(x - f.x) <= f.meia) return { x, valor: f.valor };
  return { x, valor: 0 };
}

export const vezDoBalanco = (t: number) => ({ vez: Math.floor(t / BALANCO_VEZ_MS), ms: t - Math.floor(t / BALANCO_VEZ_MS) * BALANCO_VEZ_MS });

const pelaSoma = (p: number): Resultado => (p === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: p, chave: [-p] });
const soma = (m: Map<number, number> | undefined) => [...(m?.values() ?? [])].reduce((a, b) => a + b, 0);

export default microjogo<DadosBalanco, Map<number, Map<number, number>>>({
  id: 'balanco',
  gerar(aleatorio) {
    const folhas: Folha[][] = [];
    for (let k = 0; k < BALANCO_VEZES; k++) {
      // todas no trecho em que o pulo cresce depressa com a hora de soltar (o alcance vai uns 150 além do eixo, e passar da
      // última é cair na água): a mais longe é a menor, e a janela dela é a mais curta
      folhas.push([
        { x: 152 + Math.floor(aleatorio() * 10), meia: 20, valor: 1 },
        { x: 188 + Math.floor(aleatorio() * 8), meia: 10, valor: 2 },
        { x: 220 + Math.floor(aleatorio() * 8), meia: 6, valor: 3 },
      ]);
    }
    return { periodoMs: 1300 + Math.floor(aleatorio() * 400), folhas };
  },
  duracao: () => BALANCO_VEZES * BALANCO_VEZ_MS + 1000,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // o pulo é o de agora (com a folga da rede): calcular o perfeito e mandar depois não vale
    if (!numero(t) || t < 0 || !cabe(t)) return;
    const { vez, ms } = vezDoBalanco(Math.round(t));
    if (vez >= BALANCO_VEZES || ms > BALANCO_GIRO_MS) return;
    const meus = mem.get(quem) ?? new Map<number, number>();
    if (meus.has(vez)) return;
    meus.set(vez, pulo(dados, vez, ms).valor);
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelaSoma(soma(mem.get(quem))),
  *noFim({ mem }) {
    for (const [quem, m] of mem) yield [quem, pelaSoma(soma(m))] as [number, Resultado];
  },
  robo(_d, aleatorio, passouMs) {
    // quem joga bem cai quase sempre numa folha, às vezes na do meio, raramente na longe; só nas vezes que já começaram
    let p = 0;
    for (let k = 0; k < BALANCO_VEZES; k++) {
      if (passouMs - k * BALANCO_VEZ_MS < 1500) break;
      const s = aleatorio();
      p += s < 0.15 ? 3 : s < 0.5 ? 2 : s < 0.9 ? 1 : 0;
    }
    return pelaSoma(p);
  },
});
