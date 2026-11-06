/**
 * A PONTE DO RIACHO (05/11/2026; do Frigid Bridges do levantamento em docs/mario-party-3.md, só a mecânica): levar três tábuas
 * da margem até a ponte quebrada, pulando pelas pedras do riacho, que afundam e voltam. Cada um na própria cópia do mesmo
 * riacho; ganha quem leva mais tábuas, e no empate quem terminou primeiro.
 *
 * A REGRA É UM ARQUIVO SÓ, NOS DOIS LADOS (./ponteriacho-sim.ts). Cada passo vai na hora ('acerto' `{ x, y, t }`), com o instante
 * medido na tela; o servidor confere que ele cabe no relógio dele e REFAZ o passo: as quedas e as entregas são as dele. Passo
 * que não vale (não vizinho, fora da hora) é ignorado, e daí em diante os passos de quem trapaceou deixam de encaixar.
 */
import { inteiro, microjogo, type Resultado } from './comum.js';
import { CARGA, inicial, passo, PONTE_MS, riacho, type Coelho, type Riacho } from './ponteriacho-sim.js';

export type DadosPonte = Riacho;
type Mem = Map<number, Coelho>;

const peloCoelho = (c: Coelho | undefined): Resultado =>
  !c || c.entregues === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: c.entregues, chave: [-c.entregues, c.ultima] };

export default microjogo<DadosPonte, Mem>({
  id: 'ponteriacho',
  gerar: (aleatorio) => riacho(aleatorio),
  duracao: () => PONTE_MS + 1200,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const { x, y, t } = corpo;
    if (!inteiro(x) || !inteiro(y) || !inteiro(t) || !cabe(t)) return;
    const novo = passo(dados, mem.get(quem) ?? inicial(), x, y, t);
    if (novo) mem.set(quem, novo);
  },
  // o fim é só "terminei": o que vale é o que o servidor refez, passo a passo
  avaliar: ({ mem, quem }) => peloCoelho(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, c] of mem) yield [quem, peloCoelho(c)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    // uma tábua a cada 8 a 11 s, de quem pula bem, e às vezes cai
    const porTabua = 8000 + Math.floor(aleatorio() * 3000);
    const n = Math.min(CARGA, Math.floor(Math.min(passouMs, PONTE_MS) / porTabua));
    if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
    return { motivo: null, valor: n, chave: [-n, n * porTabua - Math.floor(aleatorio() * 1500)] };
  },
});
