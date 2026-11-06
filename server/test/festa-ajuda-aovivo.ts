/**
 * AJUDA PARA TESTAR UM MICROJOGO AO VIVO DA FESTA (lote 5, 05/11/2026): como `rodadaDeTeste` (festa-ajuda.ts), com o passo do
 * servidor dado à mão (`passos(n)`) e os quadros do `difundir` guardados. A REDE: cada mensagem de uma pessoa chega ao servidor
 * metade da ida e volta dela depois (`mandar` a põe na fila; `passos` entrega na hora certa).
 */
import assert from 'node:assert/strict';
import { PREPARO_MS } from '../src/festa/comum.js';
import { microjogoDe, PONTOS_FESTA, rodadaDeFesta, type LinhaDaRodada, type RodadaDeFesta } from '../src/festa/rodada.js';

export interface QuadroDeTeste<Q = Record<string, unknown>> {
  festa: string;
  n: number;
  t: number;
  q: Q;
}

export function rodadaAoVivo(
  id: string,
  { rede = new Map([[1, 200], [2, 300]]), aleatorio = () => 0.5, robos = [] as number[] }: { rede?: Map<number, number>; aleatorio?: () => number; robos?: number[] } = {},
) {
  let agora = 1_000_000;
  let marcado: { ms: number; depois: () => void } | null = null;
  let passo: { ms: number; fn: () => void } | null = null;
  const quadros: QuadroDeTeste[] = [];
  const inscritos = [...rede.keys(), ...robos];
  const fila: { chega: number; quem: number; dados: unknown }[] = [];
  const rodada: RodadaDeFesta = rodadaDeFesta({
    ctx: {
      agendar: (ms, depois) => (marcado = { ms, depois }),
      avisar: () => {},
      naSala: () => [...rede.keys()],
      nome: (i) => `p${i}`,
      difundir: (d) => quadros.push(d as QuadroDeTeste),
    },
    microjogo: id,
    inscritos,
    agora: () => agora,
    aleatorio,
    pontos: PONTOS_FESTA,
    robos,
    aoAcabar: () => {},
    aCada: (ms, fn) => {
      passo = { ms, fn };
      return () => (passo = null);
    },
  });
  const t0 = agora;
  const ecos = new Map([...rede.keys()].map((quem) => [quem, rodada.publico(quem).eco]));
  for (const [quem, rtt] of [...rede].sort((a, b) => a[1] - b[1])) {
    agora = t0 + rtt;
    assert.equal(rodada.acao(quem, { tipo: 'eco', eco: ecos.get(quem) }), null);
  }
  agora = t0 + PREPARO_MS;
  const largada = marcado!;
  marcado = null;
  largada.depois();
  const largou = agora;
  const duracao = microjogoDe(id).duracao(rodada.publico([...rede.keys()][0] ?? 0).dados as never);
  const entregar = () => {
    fila.sort((a, b) => a.chega - b.chega);
    while (fila.length && fila[0].chega <= agora) {
      const m = fila.shift()!;
      rodada.tempoReal(m.quem, m.dados);
    }
  };
  return {
    rodada,
    quadros,
    /** Há quanto o jogo começou (no relógio do servidor). */
    passou: () => agora - largou,
    /** Manda uma mensagem ao vivo de `quem`: chega metade da ida e volta depois. */
    mandar(quem: number, dados: Record<string, unknown>) {
      fila.push({ chega: agora + (rede.get(quem) ?? 0) / 2, quem, dados });
      entregar();
    },
    /** Anda `n` passos do servidor (e entrega as mensagens que chegaram nesse meio). Para na revelação. */
    passos(n: number) {
      for (let k = 0; k < n; k++) {
        // depois da revelação o passo está desligado, mas o tempo anda (quem testa num laço por tempo não fica preso)
        agora += passo?.ms ?? 50;
        if (!passo) continue;
        entregar();
        if (marcado && agora - largou >= duracao) {
          const r = marcado;
          marcado = null;
          r.depois();
          break;
        }
        passo?.fn();
      }
    },
    ultimo: () => quadros[quadros.length - 1],
    fase: () => rodada.publico([...rede.keys()][0] ?? 0).fase,
    linhas: () => rodada.publico([...rede.keys()][0] ?? 0).linhas as LinhaDaRodada[],
    linhaDe: (quem: number) => (rodada.publico([...rede.keys()][0] ?? 0).linhas as LinhaDaRodada[]).find((l) => l.userId === quem)!,
    /** Anda até a revelação. */
    ateRevelar() {
      for (let k = 0; k < 2000 && rodada.publico([...rede.keys()][0] ?? 0).fase === 'jogando'; k++) this.passos(1);
    },
  };
}
