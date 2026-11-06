/**
 * REPOLHOS NO GELO (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica de desviar do que desliza num rinque):
 * o lago da horta congelou, e repolhos deslizam batendo nas margens, cada vez mais deles. O coelho escorrega (o gelo não freia)
 * pegando as cenouras que aparecem no gelo. Cada repolho que acerta custa duas. Os repolhos e as cenouras são os mesmos para
 * todos; cada um na SUA cópia, na própria tela.
 *
 * A CONFERÊNCIA: cada cenoura vai na hora (ação 'acerto', com o instante e onde o coelho estava), e só vale se ela estava no gelo
 * naquela hora, o coelho estava em cima dela, e dava para ter chegado ali desde a última cenoura (a velocidade máxima do coelho).
 * O GOLPE DO REPOLHO É DE QUEM LEVA: a tela de cada um diz quando foi acertada (ninguém mais vê aquele repolho naquele lugar),
 * e o servidor só confere o instante. Um console que nunca diga "levei" escapa de todos; é o limite, o mesmo do kart.
 */
import { inteiro, microjogo, numero, type Resultado } from './comum.js';

export const GELO_MS = 22000;
/** O rinque (o coelho e os repolhos ficam dentro). */
export const RINQUE = { x0: 20, x1: 280, y0: 22, y1: 182 };
/** A velocidade máxima do coelho no gelo (por segundo), e de onde ele sai. */
export const GELO_VMAX = 115;
export const GELO_INICIO: [number, number] = [150, 102];
/** Quanto uma cenoura fica no gelo, e de quão perto se pega. */
export const CENOURA_VIDA_MS = 4500;
export const CENOURA_PEGA = 20;
/** Depois de um golpe, o coelho pisca e não leva outro por este tempo. */
export const GELO_INVULNERAVEL_MS = 1500;
export const CUSTO_DO_GOLPE = 2;

export interface Repolho {
  /** Quando entra (ms), de onde, com que velocidade (por segundo) e de que tamanho. */
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}
export interface DadosGelo {
  repolhos: Repolho[];
  cenouras: { t: number; x: number; y: number }[];
}

interface Patins {
  cenouras: Set<number>;
  golpes: number[];
  /** A última posição conferida (o instante e onde). */
  t: number;
  x: number;
  y: number;
}
type Mem = Map<number, Patins>;

export const pontosDoGelo = (cenouras: number, golpes: number) => cenouras - CUSTO_DO_GOLPE * golpes;
const peloGelo = (p: Patins | undefined): Resultado => {
  if (!p || p.cenouras.size === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const n = pontosDoGelo(p.cenouras.size, p.golpes.length);
  return { motivo: null, valor: Math.max(0, n), chave: [-n] };
};

export default microjogo<DadosGelo, Mem>({
  id: 'gelo',
  gerar(aleatorio) {
    const repolhos: Repolho[] = [];
    // dois logo de saída, e mais um a cada ~2,4 s, até nove; cada um mais rápido
    for (let k = 0; k < 9; k++) {
      const t = k < 2 ? 600 * k : 1200 + (k - 1) * 2400 + Math.floor(aleatorio() * 600);
      const r = 11 + Math.floor(aleatorio() * 5);
      // entra por uma das margens, indo para dentro
      const lado = Math.floor(aleatorio() * 4);
      const vel = 55 + k * 7 + aleatorio() * 20;
      let vx = aleatorio() * 2 - 1;
      let vy = aleatorio() * 2 - 1;
      if (lado === 0) vx = Math.abs(vx) + 0.4;
      if (lado === 1) vx = -Math.abs(vx) - 0.4;
      if (lado === 2) vy = Math.abs(vy) + 0.4;
      if (lado === 3) vy = -Math.abs(vy) - 0.4;
      const m = Math.sqrt(vx * vx + vy * vy);
      const x = lado === 0 ? RINQUE.x0 + r : lado === 1 ? RINQUE.x1 - r : RINQUE.x0 + r + aleatorio() * (RINQUE.x1 - RINQUE.x0 - 2 * r);
      const y = lado === 2 ? RINQUE.y0 + r : lado === 3 ? RINQUE.y1 - r : RINQUE.y0 + r + aleatorio() * (RINQUE.y1 - RINQUE.y0 - 2 * r);
      repolhos.push({ t, x: Math.round(x), y: Math.round(y), vx: Math.round((vx / m) * vel), vy: Math.round((vy / m) * vel), r });
    }
    const cenouras: { t: number; x: number; y: number }[] = [];
    for (let t = 800; t < GELO_MS - 1500; t += 1700 + Math.floor(aleatorio() * 600)) {
      cenouras.push({
        t,
        x: Math.round(RINQUE.x0 + 20 + aleatorio() * (RINQUE.x1 - RINQUE.x0 - 40)),
        y: Math.round(RINQUE.y0 + 20 + aleatorio() * (RINQUE.y1 - RINQUE.y0 - 40)),
      });
    }
    return { repolhos, cenouras };
  },
  duracao: () => GELO_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const p = mem.get(quem) ?? { cenouras: new Set<number>(), golpes: [], t: 0, x: GELO_INICIO[0], y: GELO_INICIO[1] };
    mem.set(quem, p);
    const t = corpo.t;
    if (!numero(t) || t < 0 || t > GELO_MS || !cabe(t)) return;
    if (corpo.golpe === true) {
      // o golpe é de quem leva: só o instante é conferido, e dois seguidos dentro da piscada contam um
      const ultimo = p.golpes[p.golpes.length - 1];
      if (ultimo === undefined || t >= ultimo + GELO_INVULNERAVEL_MS - 100) p.golpes.push(t);
      return;
    }
    const { i, x, y } = corpo;
    if (!inteiro(i) || i < 0 || i >= dados.cenouras.length || !numero(x) || !numero(y) || p.cenouras.has(i)) return;
    const c = dados.cenouras[i];
    if (t < c.t - 50 || t > c.t + CENOURA_VIDA_MS + 50) return;
    const cx = x - c.x;
    const cy = y - c.y;
    if (cx * cx + cy * cy > CENOURA_PEGA * CENOURA_PEGA) return;
    // dava para ter chegado ali desde a última posição conferida?
    if (t < p.t) return;
    const ax = x - p.x;
    const ay = y - p.y;
    const alcance = (GELO_VMAX * (t - p.t)) / 1000 + 8;
    if (ax * ax + ay * ay > alcance * alcance) return;
    p.cenouras.add(i);
    p.t = t;
    p.x = x;
    p.y = y;
  },
  avaliar: ({ mem, quem }) => peloGelo(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, p] of mem) if (p.cenouras.size) yield [quem, peloGelo(p)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    const sairam = dados.cenouras.filter((c) => c.t + 1500 <= passouMs).length;
    if (sairam === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const n = Math.max(1, Math.round(sairam * (0.55 + aleatorio() * 0.35)));
    const golpes = Math.floor(aleatorio() * 3);
    const p = pontosDoGelo(n, golpes);
    return { motivo: null, valor: Math.max(0, p), chave: [-p] };
  },
});
