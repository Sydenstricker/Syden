/**
 * CANTEIRO QUE ENCOLHE (lote 5, 05/11/2026; a mecânica do "derrube os outros da plataforma", classe C do levantamento em
 * docs/mario-party-3.md): a turma num canteiro elevado da horta, todos contra todos. Cada um anda e EMPURRA (um golpe com aviso:
 * a área aparece no chão antes); quem sai do canteiro cai. De tempos em tempos uma faixa da borda rachada desmorona, e o
 * canteiro fica menor. Ganha quem fica mais tempo em cima (no empate, quem derrubou mais).
 *
 * A rede (o motor em ./arena-da-horta.ts): cada um anda no próprio computador, o servidor decide os empurrões e as quedas. As
 * faixas que caem vão PRONTAS nos dados (iguais para todos), com o aviso de rachar 1,5 s antes; quem está nelas na hora (com a
 * folga da rede dele) cai.
 */
import { invalido, microjogo } from './comum.js';
import { arenaAoVivo, largadaEmRoda, memoriaDaArena, porSobrevivencia, roboDaArena, type MemArena, type RegrasDaArena } from './arena-da-horta.js';

export const CANTEIRO_MS = 25000;
/** O aviso (a borda rachando) antes de cada faixa cair. */
export const CANTEIRO_AVISO_MS = 1500;
/** O canteiro inteiro, no começo. */
export const CANTEIRO_INICIAL = { x0: 20, y0: 14, x1: 280, y1: 186 };

/** Um retângulo do canteiro: de `t` em diante (ms desde o começo), o chão é só isto. */
export interface Etapa {
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface DadosCanteiro {
  etapas: Etapa[];
}

/** O canteiro em vigor no instante `t`. */
export function canteiroEm(d: DadosCanteiro, t: number): Etapa {
  let r: Etapa = { t: 0, ...CANTEIRO_INICIAL };
  for (const e of d.etapas) if (e.t <= t) r = e;
  return r;
}

const regras: RegrasDaArena<DadosCanteiro, null> = {
  chao(d, _mem, x, y, t) {
    const r = canteiroEm(d, t);
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  },
  extra: () => null,
  largada: (_d, turma) => largadaEmRoda(turma.jogadores, 80, 50),
  resultado: (_d, _mem, c) => porSobrevivencia(CANTEIRO_MS, c),
};

export default microjogo<DadosCanteiro, MemArena<null>>({
  id: 'canteiro',
  minimo: 2,
  gerar(aleatorio) {
    // quatro desmoronamentos, cada um de um ou dois lados (sorteados), até sobrar um canteiro de uns 130 × 80
    let r = { ...CANTEIRO_INICIAL };
    const etapas: Etapa[] = [];
    for (const t of [6000, 11000, 16000, 20500]) {
      const lados = [0, 1, 2, 3].sort(() => aleatorio() - 0.5).slice(0, aleatorio() < 0.5 ? 1 : 2);
      for (const lado of lados) {
        if (lado === 0) r = { ...r, x0: r.x0 + 32 };
        else if (lado === 1) r = { ...r, x1: r.x1 - 32 };
        else if (lado === 2) r = { ...r, y0: r.y0 + 22 };
        else r = { ...r, y1: r.y1 - 22 };
      }
      etapas.push({ t, ...r });
    }
    return { etapas };
  },
  duracao: () => CANTEIRO_MS + 1000,
  memoria: (dados, turma) => memoriaDaArena(regras, dados, turma),
  aoVivo: arenaAoVivo(regras),
  // tudo é ao vivo: o 'resultado' mandado pela tela não vale (senão quem o mandasse logo "travaria" em pé)
  avaliar: () => invalido(),
  *noFim({ mem }) {
    // quem nunca mexeu o coelho não jogou: fica com zero ("Sem resposta")
    for (const c of mem.coelhos.values()) if (c.robo || c.mexeu) yield [c.id, regras.resultado(null as never, mem, c)];
  },
  robo: (_d, aleatorio, passouMs) => roboDaArena(CANTEIRO_MS, aleatorio, passouMs),
});
