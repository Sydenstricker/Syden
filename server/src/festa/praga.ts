/**
 * PRAGA NA TOCA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "acerte a toupeira"): as pragas
 * (lagartas) saem das seis tocas da horta e cada um bate nelas, na própria tela. De vez em quando sai um COELHINHO, que não se
 * bate: custa dois pontos. A sequência sai do sorteio do servidor, igual para todos, e cada batida chega na hora, conferida pelo
 * instante no relógio do servidor (como o Tiro ao alvo): a lista inteira mandada no fim não vale nada.
 */
import { FOLGA_ACIMA, inteiro, microjogo, type Resultado } from './comum.js';

export const PRAGA_MS = 20000;
export const TOCAS = 6;
/** Quanto uma praga fica fora da toca: começa folgada e encurta. */
export const VIDA_INICIAL_MS = 1300;
export const VIDA_FINAL_MS = 750;
/** Bater no coelhinho custa isto. */
export const CUSTO_DO_COELHO = 2;

export interface Bicho {
  /** Quando sai (ms desde o começo). */
  t: number;
  /** A toca, de 0 a 5 (duas fileiras de três, da esquerda para a direita, de cima para baixo). */
  toca: number;
  /** Quanto fica fora. */
  vida: number;
  /** É um coelhinho (não se bate). */
  coelho: boolean;
}
export interface DadosPraga {
  bichos: Bicho[];
}

interface Batidas {
  pragas: Set<number>;
  coelhos: Set<number>;
}
type Mem = Map<number, Batidas>;

export const pontosDaPraga = (pragas: number, coelhos: number) => pragas - CUSTO_DO_COELHO * coelhos;

const pelasBatidas = (b: Batidas | undefined): Resultado => {
  const pragas = b?.pragas.size ?? 0;
  if (pragas === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const p = pontosDaPraga(pragas, b!.coelhos.size);
  return { motivo: null, valor: Math.max(0, p), chave: [-p] };
};

export default microjogo<DadosPraga, Mem>({
  id: 'praga',
  gerar(aleatorio) {
    const bichos: Bicho[] = [];
    let t = 700;
    while (t < PRAGA_MS - VIDA_INICIAL_MS) {
      const vida = Math.round(VIDA_INICIAL_MS - ((VIDA_INICIAL_MS - VIDA_FINAL_MS) * t) / PRAGA_MS);
      // nunca numa toca que ainda tem alguém fora
      const ocupadas = new Set(bichos.filter((b) => b.t + b.vida + 150 > t).map((b) => b.toca));
      let toca = Math.floor(aleatorio() * TOCAS);
      for (let i = 0; i < TOCAS && ocupadas.has(toca); i++) toca = (toca + 1) % TOCAS;
      // o coelhinho só depois de umas pragas, e nunca dois seguidos
      const coelho = bichos.length >= 4 && !bichos[bichos.length - 1].coelho && aleatorio() < 0.16;
      if (!ocupadas.has(toca)) bichos.push({ t, toca, vida, coelho });
      t += 330 + Math.floor(aleatorio() * 420);
    }
    return { bichos };
  },
  duracao: () => PRAGA_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, passou, abaixo }) {
    const i = corpo.i;
    if (!inteiro(i) || i < 0 || i >= dados.bichos.length) return;
    const b = dados.bichos[i];
    // o bicho aparece na tela no instante dele, e a batida chega depois: nunca antes, e no máximo a rede da pessoa depois
    // de ele voltar para a toca
    if (passou < b.t - FOLGA_ACIMA || passou > b.t + b.vida + abaixo) return;
    const meus = mem.get(quem) ?? { pragas: new Set<number>(), coelhos: new Set<number>() };
    (b.coelho ? meus.coelhos : meus.pragas).add(i);
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelasBatidas(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, b] of mem) if (b.pragas.size) yield [quem, pelasBatidas(b)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    const pragas = dados.bichos.filter((b) => !b.coelho && b.t + b.vida <= passouMs).length;
    if (pragas === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const n = Math.min(pragas, Math.max(1, Math.round(pragas * (0.4 + aleatorio() * 0.35))));
    const coelhos = aleatorio() < 0.3 ? 1 : 0;
    const p = pontosDaPraga(n, coelhos);
    return { motivo: null, valor: Math.max(0, p), chave: [-p] };
  },
});
