/**
 * CHUVA DE CENOURAS (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de descer planando pegando o que
 * aparece e fugindo do que machuca): o coelho desce do alto da árvore pendurado numa folha, de um lado para o outro, pegando as
 * cenouras (a dourada vale três) e fugindo das pedras, que custam duas. A chuva é a mesma para todos; cada um na SUA cópia.
 *
 * A CONFERÊNCIA: cada cenoura vai na hora (ação 'acerto', com o instante e onde o coelho estava), e só vale se o coelho passava
 * por ela naquela hora, estava em cima dela, e dava para ter chegado ali desde a última (a velocidade de lado da folha). A PEDRA
 * É DE QUEM LEVA: a tela diz quando foi acertada, e o servidor confere só o instante (o limite, como no Repolhos no gelo).
 */
import { inteiro, microjogo, numero, type Resultado } from './comum.js';

export const CHUVA_MS = 20000;
/** O coelho anda de lado até isto por segundo, entre as bordas, e sai do meio. */
export const CHUVA_VX = 150;
export const CHUVA_X0 = 22;
export const CHUVA_X1 = 278;
export const CHUVA_INICIO = 150;
/** Quanto antes ou depois do instante dela uma cenoura ainda se pega, e de quão longe de lado. */
export const CHUVA_JANELA_MS = 350;
export const CHUVA_PEGA = 22;
export const CUSTO_DA_PEDRA = 2;

export const CENOURA = 0;
export const DOURADA = 1;
export const PEDRA = 2;
/** Quanto vale cada coisa pega. */
export const VALOR = [1, 3, 0];

export interface Item {
  /** Quando o coelho passa na altura dele (ms), onde, e o que é. */
  t: number;
  x: number;
  tipo: number;
}
export interface DadosChuva {
  itens: Item[];
}

interface Folha {
  pegos: Set<number>;
  pedras: Set<number>;
  t: number;
  x: number;
}
type Mem = Map<number, Folha>;

export const pontosDaChuva = (d: DadosChuva, pegos: Iterable<number>, pedras: number) => {
  let n = 0;
  for (const i of pegos) n += VALOR[d.itens[i].tipo];
  return n - CUSTO_DA_PEDRA * pedras;
};
const pelaChuva = (d: DadosChuva, f: Folha | undefined): Resultado => {
  if (!f || f.pegos.size === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const n = pontosDaChuva(d, f.pegos, f.pedras.size);
  return { motivo: null, valor: Math.max(0, n), chave: [-n] };
};

export default microjogo<DadosChuva, Mem>({
  id: 'chuva',
  gerar(aleatorio) {
    const itens: Item[] = [];
    let x = 150;
    for (let t = 900; t < CHUVA_MS - 400; t += 300 + Math.floor(aleatorio() * 260)) {
      // as cenouras seguem um caminho que dá para fazer (e às vezes pulam para longe); as pedras caem perto dele
      const r = aleatorio();
      const tipo = t > 3000 && r < 0.3 ? PEDRA : r > 0.94 ? DOURADA : CENOURA;
      const passo = tipo === PEDRA ? (aleatorio() - 0.5) * 80 : (aleatorio() - 0.5) * 130 * (aleatorio() < 0.15 ? 1.8 : 1);
      const nx = Math.round(Math.min(CHUVA_X1 - 10, Math.max(CHUVA_X0 + 10, x + passo)));
      itens.push({ t, x: nx, tipo });
      if (tipo !== PEDRA) x = nx;
    }
    return { itens };
  },
  duracao: () => CHUVA_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const f = mem.get(quem) ?? { pegos: new Set<number>(), pedras: new Set<number>(), t: 0, x: CHUVA_INICIO };
    mem.set(quem, f);
    const { t, i } = corpo;
    if (!numero(t) || t < 0 || t > CHUVA_MS || !cabe(t) || !inteiro(i) || i < 0 || i >= dados.itens.length) return;
    const it = dados.itens[i];
    if (Math.abs(t - it.t) > CHUVA_JANELA_MS) return;
    if (it.tipo === PEDRA) {
      // a pedra é de quem leva: só o instante
      if (corpo.pedra === true) f.pedras.add(i);
      return;
    }
    const x = corpo.x;
    if (!numero(x) || f.pegos.has(i) || Math.abs(x - it.x) > CHUVA_PEGA || t < f.t) return;
    // dava para ter chegado ali desde a última posição conferida?
    if (Math.abs(x - f.x) > (CHUVA_VX * (t - f.t)) / 1000 + 6) return;
    f.pegos.add(i);
    f.t = t;
    f.x = x;
  },
  avaliar: ({ dados, mem, quem }) => pelaChuva(dados, mem.get(quem)),
  *noFim({ dados, mem }) {
    for (const [quem, f] of mem) if (f.pegos.size) yield [quem, pelaChuva(dados, f)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // pega de 55% a 85% do que passou, e leva uma pedra ou duas
    const pegos: number[] = [];
    const taxa = 0.55 + aleatorio() * 0.3;
    dados.itens.forEach((it, i) => {
      if (it.tipo !== PEDRA && it.t <= passouMs && aleatorio() < taxa) pegos.push(i);
    });
    if (pegos.length === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const n = pontosDaChuva(dados, pegos, Math.floor(aleatorio() * 3));
    return { motivo: null, valor: Math.max(0, n), chave: [-n] };
  },
});
