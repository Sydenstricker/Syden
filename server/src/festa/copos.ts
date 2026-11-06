/** JOGO DOS COPOS: a cenoura aparece, os copos descem e trocam de lugar, cada vez mais rápido, e escolhe-se um. */
import { FOLGA_ACIMA, invalido, microjogo, numero, REACAO_MINIMA } from './comum.js';

export const COPOS_MOSTRA_MS = 2000;
export const COPOS_RESPOSTA_MS = 6000;

export interface DadosCopos {
  /** Onde a cenoura começa (0, 1 ou 2, da esquerda para a direita). */
  inicial: number;
  /** As trocas, de LUGARES: os copos dos lugares a e b trocam. */
  trocas: [number, number][];
  /** A duração de cada troca. */
  passos: number[];
}

export const animacaoDosCopos = (d: DadosCopos) => COPOS_MOSTRA_MS + d.passos.reduce((a, b) => a + b, 0);

/** Onde a cenoura termina: segue as trocas. */
export function copoFinal(d: DadosCopos): number {
  let p = d.inicial;
  for (const [a, b] of d.trocas) p = p === a ? b : p === b ? a : p;
  return p;
}

export default microjogo<DadosCopos>({
  id: 'copos',
  gerar(aleatorio) {
    const inteiro = (n: number) => Math.floor(aleatorio() * n);
    const trocas: [number, number][] = [];
    const passos: number[] = [];
    const n = 8 + inteiro(4);
    for (let i = 0; i < n; i++) {
      const a = inteiro(3);
      const b = (a + 1 + inteiro(2)) % 3;
      trocas.push([Math.min(a, b), Math.max(a, b)]);
      // começa devagar e acelera
      passos.push(Math.round(650 - (i / Math.max(1, n - 1)) * 330));
    }
    return { inicial: inteiro(3), trocas, passos };
  },
  duracao: (d) => animacaoDosCopos(d) + COPOS_RESPOSTA_MS,
  // a resposta certa só na revelação (as trocas, todo mundo vê)
  vista: ({ dados, fase }) => ({ resposta: fase === 'revelando' ? copoFinal(dados) : null }),
  avaliar({ dados, corpo, passou, abaixo }) {
    const anim = animacaoDosCopos(dados);
    if (!numero(corpo.copo) || !numero(corpo.ms) || corpo.ms < 0) return invalido();
    // não se escolhe antes de os copos pararem, nem se diz que levou mais do que o servidor viu
    if (anim + corpo.ms > passou + FOLGA_ACIMA) return invalido();
    if (corpo.copo !== copoFinal(dados)) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(Math.max(corpo.ms, REACAO_MINIMA, passou - anim - abaixo));
    return { motivo: null, valor: ms, chave: [ms] };
  },
  robo(_d, aleatorio) {
    if (aleatorio() < 0.25) return { motivo: 'errou', valor: null, chave: [] };
    const ms = Math.round(400 + aleatorio() * 1000);
    return { motivo: null, valor: ms, chave: [ms] };
  },
});
