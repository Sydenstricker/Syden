/**
 * BARRACA DE TIRO DA QUERMESSE (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "atire em quem aparece,
 * sem acertar o inocente"): na barraca, três trilhos levam figuras de madeira de um lado para o outro, cada vez mais depressa.
 * Os corvos (que comem a horta) se acertam; o coelhinho, não: custa dois. Toca-se na figura, ou aperta-se 1, 2 ou 3 para atirar
 * na mira do meio daquele trilho. Diferente da Praga na toca: aqui os alvos ANDAM, e é preciso esperar o certo chegar à mira.
 *
 * Cada tiro certeiro vai na hora (ação 'acerto'), e o servidor confere no relógio dele que a figura estava na barraca naquele
 * instante (como o Tiro ao alvo): a lista inteira mandada no fim não vale nada.
 */
import { FOLGA_ACIMA, inteiro, microjogo, type Resultado } from './comum.js';

export const BARRACA_MS = 20000;
export const TRILHOS = 3;
/** A largura da barraca no desenho, e quanto uma figura anda fora dela até sumir de vez (metade de cada lado). */
export const LARGURA = 300;
export const MARGEM = 24;
/** Acertar o coelhinho custa isto. */
export const CUSTO_DO_COELHO = 2;

export interface Figura {
  /** Quando entra (ms desde o começo). */
  t: number;
  trilho: number;
  /** 1 vai da esquerda para a direita, −1 ao contrário. */
  dir: number;
  /** Quanto anda por segundo (unidades do desenho). */
  vel: number;
  coelho: boolean;
}
export interface DadosBarraca {
  figuras: Figura[];
}

/** Quanto tempo a figura leva para atravessar a barraca. */
export const travessia = (f: Figura) => Math.round(((LARGURA + 2 * MARGEM) * 1000) / f.vel);
/** Onde a figura está no instante `t` (o centro dela; fora de −MARGEM … LARGURA + MARGEM, não está na barraca). */
export const posicaoDaFigura = (f: Figura, t: number) => {
  const andou = ((t - f.t) * f.vel) / 1000;
  return f.dir > 0 ? -MARGEM + andou : LARGURA + MARGEM - andou;
};

interface Tiros {
  corvos: Set<number>;
  coelhos: Set<number>;
}

export const pontosDaBarraca = (corvos: number, coelhos: number) => corvos - CUSTO_DO_COELHO * coelhos;

const pelosTiros = (b: Tiros | undefined): Resultado => {
  const corvos = b?.corvos.size ?? 0;
  if (corvos === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const p = pontosDaBarraca(corvos, b!.coelhos.size);
  return { motivo: null, valor: Math.max(0, p), chave: [-p] };
};

export default microjogo<DadosBarraca, Map<number, Tiros>>({
  id: 'barraca',
  gerar(aleatorio) {
    const figuras: Figura[] = [];
    let t = 300;
    // cada trilho anda sempre para o mesmo lado (o do meio, ao contrário dos outros), como numa barraca de verdade
    const dirs = [1, -1, 1];
    while (t < BARRACA_MS - 1500) {
      const trilho = Math.floor(aleatorio() * TRILHOS);
      const vel = Math.round(110 + (t / BARRACA_MS) * 110 + aleatorio() * 30);
      const nova: Figura = { t, trilho, dir: dirs[trilho], vel, coelho: false };
      // nunca encostada na figura anterior do mesmo trilho (as duas andariam grudadas)
      const antes = [...figuras].reverse().find((f) => f.trilho === trilho);
      const encosta = antes && Math.abs(posicaoDaFigura(antes, t) - posicaoDaFigura(nova, t)) < 70;
      if (!encosta) {
        nova.coelho = figuras.length >= 3 && !figuras[figuras.length - 1].coelho && aleatorio() < 0.22;
        figuras.push(nova);
      }
      t += 260 + Math.floor(aleatorio() * 360);
    }
    return { figuras };
  },
  duracao: () => BARRACA_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, passou, abaixo }) {
    const i = corpo.i;
    if (!inteiro(i) || i < 0 || i >= dados.figuras.length) return;
    const f = dados.figuras[i];
    // a figura entra na tela no instante dela, e o tiro chega depois: nunca antes, e no máximo a rede da pessoa depois de ela
    // sair da barraca
    if (passou < f.t - FOLGA_ACIMA || passou > f.t + travessia(f) + abaixo || passou > BARRACA_MS + abaixo) return;
    const meus = mem.get(quem) ?? { corvos: new Set<number>(), coelhos: new Set<number>() };
    (f.coelho ? meus.coelhos : meus.corvos).add(i);
    mem.set(quem, meus);
  },
  avaliar: ({ mem, quem }) => pelosTiros(mem.get(quem)),
  *noFim({ mem }) {
    for (const [quem, b] of mem) if (b.corvos.size || b.coelhos.size) yield [quem, pelosTiros(b)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    const corvos = dados.figuras.filter((f) => !f.coelho && f.t + travessia(f) <= passouMs).length;
    if (corvos === 0) return { motivo: 'errou', valor: 0, chave: [] };
    const n = Math.min(corvos, Math.max(1, Math.round(corvos * (0.45 + aleatorio() * 0.35))));
    const p = pontosDaBarraca(n, aleatorio() < 0.3 ? 1 : 0);
    return { motivo: null, valor: Math.max(0, p), chave: [-p] };
  },
});
