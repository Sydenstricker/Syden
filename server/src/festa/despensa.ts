/**
 * ARRUME A DESPENSA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica): a prateleira aparece com seis
 * potes, eles caem e se embaralham, e cada um põe os potes de volta no lugar, na própria tela. Vale quantos ficaram no lugar
 * certo, e no empate, quem foi mais rápido. Memória, sem reflexo: bom para quem não joga videogame.
 *
 * Como os copos: a prateleira vai pronta ao site (é o que se mostra), e o servidor confere a resposta e o tempo dela pelo
 * relógio dele (não se arruma antes de a prateleira cair, nem se diz que levou mais do que ele viu).
 */
import { FOLGA_ACIMA, invalido, microjogo, numero, REACAO_MINIMA } from './comum.js';

/** Quantos tipos de pote existem (a tela desenha cada um) e quantos vão à prateleira. */
export const TIPOS_DE_POTE = 8;
export const POTES = 6;
/** A prateleira arrumada na tela, e a queda que embaralha. */
export const MOSTRA_MS = 4000;
export const QUEDA_MS = 1200;
export const RESPOSTA_MS = 15000;
/** Pôr um pote leva pelo menos isto: seis em menos não é mão. */
export const POR_POTE_MINIMO = 120;

export interface DadosDespensa {
  /** O tipo de pote em cada lugar da prateleira, da esquerda para a direita. */
  prateleira: number[];
  /** Como os potes ficam embaralhados embaixo (a mesma lista, noutra ordem). */
  monte: number[];
}

export const arrumacao = () => MOSTRA_MS + QUEDA_MS;

/** Uma ordem diferente da dada, pelo sorteio dado. */
function embaralhada(lista: number[], aleatorio: () => number): number[] {
  for (;;) {
    const l = [...lista];
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(aleatorio() * (i + 1));
      [l[i], l[j]] = [l[j], l[i]];
    }
    if (l.some((v, i) => v !== lista[i])) return l;
  }
}

export default microjogo<DadosDespensa>({
  id: 'despensa',
  gerar(aleatorio) {
    const tipos = Array.from({ length: TIPOS_DE_POTE }, (_, i) => i);
    const prateleira = embaralhada(tipos, aleatorio).slice(0, POTES);
    return { prateleira, monte: embaralhada(prateleira, aleatorio) };
  },
  duracao: () => arrumacao() + RESPOSTA_MS + 1500,
  avaliar({ dados, corpo, passou, abaixo }) {
    const ordem = corpo.ordem;
    if (!numero(corpo.ms) || corpo.ms < 0 || !Array.isArray(ordem) || ordem.length !== POTES) return invalido();
    // cada pote da prateleira uma vez (a resposta é uma arrumação dos MESMOS potes)
    const restam = [...dados.prateleira];
    for (const v of ordem) {
      const i = restam.indexOf(v as number);
      if (i < 0) return invalido();
      restam.splice(i, 1);
    }
    // não se arruma antes de a prateleira cair, nem se diz que levou mais do que o servidor viu
    if (arrumacao() + corpo.ms > passou + FOLGA_ACIMA) return invalido();
    const certos = ordem.filter((v, i) => v === dados.prateleira[i]).length;
    if (certos === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const ms = Math.round(Math.max(corpo.ms, POTES * POR_POTE_MINIMO, REACAO_MINIMA, passou - arrumacao() - abaixo));
    return { motivo: null, valor: certos, chave: [-certos, ms] };
  },
  robo(_d, aleatorio, passouMs) {
    // quase sempre acerta quase tudo; às vezes troca dois (4), raramente se perde mais
    const sorte = aleatorio();
    const certos = sorte < 0.45 ? 6 : sorte < 0.8 ? 4 : sorte < 0.95 ? 3 : 2;
    const ms = Math.round(Math.max(POTES * POR_POTE_MINIMO, Math.min(passouMs - arrumacao(), 3500 + aleatorio() * 5000)));
    return { motivo: null, valor: certos, chave: [-certos, ms] };
  },
});
