/**
 * TRÊS FLECHAS NOS BALÕES (05/11/2026; Bobbing Bow-loons no levantamento em docs/mario-party-3.md, só a mecânica): o arco do
 * coelho corre sozinho de um lado a outro, embaixo, e os balões passeiam no alto, cada um no seu vaivém. A flecha sobe reta e
 * fura TODOS os balões que encontra no caminho; o balão pequeno vale mais. Três flechas; vale a soma.
 *
 * O SERVIDOR SORTEIA os balões (a altura, o vaivém, o tamanho) e o arco, e eles vão prontos ao site. Cada flecha vai na hora
 * (a ação 'acerto', com o instante dela) e só vale se couber no relógio do servidor. A conta (`flechada`) é só + − × ÷,
 * Math.abs e o resto da divisão, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

export const FLECHA_MS = 15000;
export const FLECHAS = 3;
/** Entre uma flecha e a seguinte (a flecha no ar, e o arco armando de novo). */
export const FLECHA_RECARGA_MS = 1100;
/** De onde a flecha sai (a altura do arco) e quanto ela sobe por ms. */
export const FLECHA_Y0 = 176;
export const FLECHA_VELOCIDADE = 0.34;
/** Meia largura da ponta da flecha. */
export const FLECHA_PONTA = 2;
/** O arco anda entre estas duas pontas. */
export const ARCO_X0 = 24;
export const ARCO_X1 = 276;

export interface Balao {
  /** A altura, o vaivém (de `xa` a `xb`, num período, começando na fase), o raio e quanto vale. */
  y: number;
  xa: number;
  xb: number;
  periodoMs: number;
  fase: number;
  r: number;
  valor: number;
}

export interface DadosFlecha {
  /** Uma ida e volta do arco, em ms. */
  periodoDoArco: number;
  baloes: Balao[];
}

/** Uma onda triangular no instante t: 0 → 1 → 0 num período. */
export function onda(periodoMs: number, t: number): number {
  const f = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 1 - Math.abs(f * 2 - 1);
}

export const xDoArco = (d: DadosFlecha, t: number) => ARCO_X0 + (ARCO_X1 - ARCO_X0) * onda(d.periodoDoArco, t);
export const xDoBalao = (b: Balao, t: number) => b.xa + (b.xb - b.xa) * onda(b.periodoMs, t + b.fase);

/** A flecha solta no instante t: os balões (índices) que ela fura, dos que ainda estão no ar. */
export function flechada(d: DadosFlecha, t: number, estourados: number[]): number[] {
  const x = xDoArco(d, t);
  const furou: number[] = [];
  for (let i = 0; i < d.baloes.length; i++) {
    if (estourados.includes(i)) continue;
    const b = d.baloes[i];
    // quando a ponta da flecha chega à altura do balão, onde ele está
    const ti = t + (FLECHA_Y0 - b.y) / FLECHA_VELOCIDADE;
    if (Math.abs(x - xDoBalao(b, ti)) <= b.r + FLECHA_PONTA) furou.push(i);
  }
  return furou;
}

export interface Aljava {
  /** Os instantes das flechas que valeram, e os balões furados. */
  flechas: number[];
  estourados: number[];
  pontos: number;
}
export const aljavaNova = (): Aljava => ({ flechas: [], estourados: [], pontos: 0 });

/** Uma flecha no instante t, se ainda há flecha e o arco já armou: a mesma conta na tela e no servidor. Devolve os furados. */
export function atirar(d: DadosFlecha, a: Aljava, t: number): number[] | null {
  const ultima = a.flechas[a.flechas.length - 1];
  if (a.flechas.length >= FLECHAS || (ultima !== undefined && t < ultima + FLECHA_RECARGA_MS) || t < 0 || t > FLECHA_MS) return null;
  a.flechas.push(t);
  const furou = flechada(d, t, a.estourados);
  for (const i of furou) {
    a.estourados.push(i);
    a.pontos += d.baloes[i].valor;
  }
  return furou;
}

const pelosPontos = (p: number): Resultado => (p === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: p, chave: [-p] });

export default microjogo<DadosFlecha, Map<number, Aljava>>({
  id: 'flecha',
  gerar(aleatorio) {
    const baloes: Balao[] = [];
    // de cima para baixo: os de cima (mais longe da flecha, mais tempo para errar) são menores e valem mais
    const alturas = [34, 52, 70, 88, 106, 124, 142];
    for (const [k, y] of alturas.entries()) {
      const pequeno = k < 2 || aleatorio() < 0.2;
      const r = pequeno ? 7 : 10 + Math.floor(aleatorio() * 3);
      const largura = 60 + Math.floor(aleatorio() * 140);
      const xa = 20 + Math.floor(aleatorio() * (260 - largura));
      baloes.push({
        y,
        xa,
        xb: xa + largura,
        periodoMs: 1800 + Math.floor(aleatorio() * 2600),
        fase: Math.floor(aleatorio() * 4000),
        r,
        valor: pequeno ? 3 : r <= 10 ? 2 : 1,
      });
    }
    return { periodoDoArco: 2600 + Math.floor(aleatorio() * 800), baloes };
  },
  duracao: () => FLECHA_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // a flecha é a de agora (com a folga da rede): calcular as perfeitas e mandar depois não vale
    if (!numero(t) || !cabe(t)) return;
    const a = mem.get(quem) ?? aljavaNova();
    atirar(dados, a, Math.round(t));
    mem.set(quem, a);
  },
  avaliar: ({ mem, quem }) => pelosPontos(mem.get(quem)?.pontos ?? 0),
  *noFim({ mem }) {
    for (const [quem, a] of mem) yield [quem, pelosPontos(a.pontos)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // quem joga bem fura um ou dois por flecha, de vez em quando um pequeno; só as flechas que cabiam no tempo
    const cabem = Math.max(0, Math.min(FLECHAS, Math.floor(passouMs / 2500)));
    let p = 0;
    for (let k = 0; k < cabem; k++) p += Math.floor(aleatorio() * 4);
    return pelosPontos(Math.min(p, dados.baloes.reduce((s, b) => s + b.valor, 0)));
  },
});
