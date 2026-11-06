/** TIRO AO ALVO: as cenouras aparecem numa grade 3 × 3; cada acerto chega na hora, e o servidor confere no relógio dele
 * (revisão de 03/11/2026: a lista inteira mandada no fim deixava o console acertar todos). */
import { FOLGA_ACIMA, inteiro, microjogo, type Resultado } from './comum.js';

export const ALVO_MS = 20000;
export const ALVO_VIDA_MS = 1100;

export interface DadosAlvo {
  /** Cada alvo: quando aparece (ms), e a casa numa grade 3 × 3 (0 em cima à esquerda). */
  alvos: { t: number; casa: number }[];
}

type Mem = Map<number, Set<number>>;

const pelosAcertos = (n: number): Resultado => (n === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: n, chave: [-n] });

export default microjogo<DadosAlvo, Mem>({
  id: 'alvo',
  gerar(aleatorio) {
    const alvos: { t: number; casa: number }[] = [];
    let t = 600;
    while (t < ALVO_MS - ALVO_VIDA_MS) {
      // nunca na mesma casa de um alvo que ainda está na tela
      const ocupadas = new Set(alvos.filter((a) => a.t + ALVO_VIDA_MS > t).map((a) => a.casa));
      let casa = Math.floor(aleatorio() * 9);
      while (ocupadas.has(casa)) casa = (casa + 1) % 9;
      alvos.push({ t, casa });
      t += 380 + Math.floor(aleatorio() * 420);
    }
    return { alvos };
  },
  duracao: () => ALVO_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, passou, abaixo }) {
    // um acerto vale se o alvo estava na tela AGORA (no relógio do servidor, com a folga da rede)
    const i = corpo.i;
    if (!inteiro(i) || i < 0 || i >= dados.alvos.length) return;
    // a cenoura aparece na tela no instante dela (mais o tempo de o estado ter chegado), e o acerto chega depois: nunca
    // antes do instante, e no máximo a rede da pessoa depois de ela sumir
    if (passou < dados.alvos[i].t - FOLGA_ACIMA || passou > dados.alvos[i].t + ALVO_VIDA_MS + abaixo) return;
    const meus = mem.get(quem) ?? new Set<number>();
    meus.add(i);
    mem.set(quem, meus);
  },
  // o que vale é o que o servidor viu acertar, um a um
  avaliar: ({ mem, quem }) => pelosAcertos(mem.get(quem)?.size ?? 0),
  // quem acertou alguma e não chegou a mandar o fim conta pelo que o servidor viu
  *noFim({ mem }) {
    for (const [quem, acertos] of mem) if (acertos.size) yield [quem, pelosAcertos(acertos.size)] as [number, Resultado];
  },
  robo(dados, aleatorio) {
    const total = dados.alvos.length;
    const n = Math.max(1, Math.round(total * (0.35 + aleatorio() * 0.35)));
    return { motivo: null, valor: n, chave: [-n] };
  },
});
