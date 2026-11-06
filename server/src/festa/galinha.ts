/**
 * PEGUE A GALINHA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica da galinha que foge quando se chega
 * perto): cada um tem a SUA galinha no cercado, na própria tela. Chegando perto, ela dispara; depois de um tanto correndo, cansa
 * e fica lenta. Encurralar num canto ou esperar o cansaço: pegou, ela volta ao galinheiro e sai outra. Quem pegar mais ganha.
 * Onde cada galinha aparece, para que lado desvia e por onde passeia saem do sorteio, iguais para todos.
 *
 * O SERVIDOR REFAZ A PARTIDA (como na Regar a horta): cada mudança de direção vai na hora, e as galinhas pegas são as da
 * simulação dele (./lote2sim.ts, a mesma conta da tela).
 */
import { microjogo, type Resultado } from './comum.js';
import { CERCA, galinha, GALINHA_MS, GALINHA_PASSOS, type DadosGalinha, type Entrada } from './lote2sim.js';
import { juntarEntrada } from './regar.js';

type Mem = Map<number, Entrada[]>;

const pelasGalinhas = (k: number, ultimo: number): Resultado =>
  k === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: k, chave: [-k, ultimo] };

const ponto = (aleatorio: () => number, margem: number): [number, number] => [
  Math.round(CERCA.x0 + margem + aleatorio() * (CERCA.x1 - CERCA.x0 - 2 * margem)),
  Math.round(CERCA.y0 + margem + aleatorio() * (CERCA.y1 - CERCA.y0 - 2 * margem)),
];

export default microjogo<DadosGalinha, Mem>({
  id: 'galinha',
  gerar(aleatorio) {
    const surgir: [number, number][] = [];
    // as galinhas aparecem longe do canto, e a primeira longe do coelho (que começa embaixo, no meio)
    while (surgir.length < 16) {
      const p = ponto(aleatorio, 40);
      if (surgir.length === 0 && p[1] > 110) continue;
      surgir.push(p);
    }
    const lado = Array.from({ length: 16 }, () => (aleatorio() < 0.5 ? 1 : -1));
    const passeio = Array.from({ length: 12 }, () => ponto(aleatorio, 30));
    return { surgir, lado, passeio };
  },
  duracao: () => GALINHA_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, passou, abaixo }) {
    const lista = mem.get(quem) ?? [];
    juntarEntrada(lista, corpo, passou, abaixo, GALINHA_PASSOS);
    mem.set(quem, lista);
  },
  avaliar: ({ dados, mem, quem }) => {
    const e = mem.get(quem);
    if (!e?.length) return pelasGalinhas(0, 0);
    const s = galinha(dados, e);
    return pelasGalinhas(s.k, s.ultimo);
  },
  *noFim({ dados, mem }) {
    for (const [quem, e] of mem) {
      if (!e.length) continue;
      const s = galinha(dados, e);
      yield [quem, pelasGalinhas(s.k, s.ultimo)] as [number, Resultado];
    }
  },
  robo(_dados, aleatorio, passouMs) {
    // quem joga bem pega uma a cada 3 a 6 s; a primeira leva uns 3 s
    const ms = Math.min(passouMs, GALINHA_MS);
    const k = Math.max(0, Math.floor((ms - 1500) / (3000 + aleatorio() * 3000)));
    return pelasGalinhas(k, Math.floor(ms / 40));
  },
});
