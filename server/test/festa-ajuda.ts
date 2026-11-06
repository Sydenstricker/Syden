import { jogadaHonestaDoLote1 } from './festa-lote1-ajuda.js';
import { jogadaHonestaDoLote2 } from './festa-lote2-ajuda.js';
/**
 * AJUDA PARA TESTAR UM MICROJOGO DA FESTA (05/11/2026): monta UMA rodada (festa/rodada.ts) sem banco e sem servidor, com o
 * relógio e o sorteio de mão, a rede de cada um medida pelo eco como na sala de verdade, e já dá a largada. Veja o guia em
 * server/src/festa/registro.ts e um exemplo em festa-praga.test.ts.
 */
import assert from 'node:assert/strict';
import { PREPARO_MS } from '../src/festa/comum.js';
import { PONTOS_FESTA, rodadaDeFesta, type LinhaDaRodada, type RodadaDeFesta } from '../src/festa/rodada.js';
import { arrumacao, type DadosDespensa } from '../src/festa/despensa.js';
import { FLOR, type DadosFlor } from '../src/festa/flor.js';
import type { DadosPonteiro } from '../src/festa/ponteiro.js';
import type { DadosPraga } from '../src/festa/praga.js';

/** Um sorteio repetível (mulberry32): o mesmo `semente` dá a mesma rodada. */
export function sorteioFixo(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OpcoesDeTeste {
  /** Quem joga, com a ida e volta de cada um (o eco volta esse tanto depois). Padrão: dois, com 200 e 300 ms. */
  rede?: Map<number, number>;
  /** O sorteio (padrão: sempre o meio). */
  aleatorio?: () => number;
  robos?: number[];
  /** Quem está na sala (padrão: os da rede). */
  naSala?: () => number[];
}

export function rodadaDeTeste(id: string, { rede = new Map([[1, 200], [2, 300]]), aleatorio = () => 0.5, robos = [], naSala }: OpcoesDeTeste = {}) {
  let agora = 1_000_000;
  let marcado: { ms: number; depois: () => void } | null = null;
  let acabou = false;
  const inscritos = [...rede.keys(), ...robos];
  const rodada: RodadaDeFesta = rodadaDeFesta({
    ctx: {
      agendar: (ms, depois) => (marcado = { ms, depois }),
      avisar: () => {},
      naSala: naSala ?? (() => inscritos),
      nome: (id) => `p${id}`,
    },
    microjogo: id,
    inscritos,
    agora: () => agora,
    aleatorio,
    pontos: PONTOS_FESTA,
    robos,
    aoAcabar: () => (acabou = true),
  });
  // o "prepare-se": cada eco volta depois da ida e volta daquela pessoa
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
  return {
    rodada,
    largou,
    agora: () => agora,
    /** Põe o relógio em `largou + ms`. */
    em(ms: number) {
      agora = largou + ms;
    },
    avancar(ms: number) {
      agora += ms;
    },
    /** Dispara o que está marcado no relógio da rodada, andando o tempo junto. */
    andar() {
      const r = marcado!;
      marcado = null;
      agora += r.ms;
      r.depois();
    },
    /** Anda o relógio até a revelação. */
    ateRevelar() {
      while (rodada.publico([...rede.keys()][0] ?? 0).fase === 'jogando' && marcado) this.andar();
    },
    acabou: () => acabou,
    linhas: () => rodada.publico([...rede.keys()][0] ?? 0).linhas as LinhaDaRodada[],
    linhaDe: (quem: number) => (rodada.publico(quem).linhas as LinhaDaRodada[]).find((l) => l.userId === quem)!,
  };
}

/**
 * UMA JOGADA HONESTA de quem tem rede rápida, para os testes da partida inteira (a Festa e o Tabuleiro): cada microjogo de
 * festa/ que precisa de mais que um 'resultado' diz aqui como se joga. `andar` dispara o relógio da partida; `avancar` anda o
 * tempo. Começa logo depois da largada.
 */
/**
 * OS LOTES DO MARIO PARA 3 (05/11/2026): cada lote entrega a jogada honesta dos seus microjogos em server/test/festa-loteN-ajuda.ts,
 * `jogadaHonestaDoLoteN(micro, jogo, quem, { andar, avancar }): boolean` (true se o id é dele). Assim nenhum lote mexe aqui.
 */
type JogadaDoLote = (
  micro: string,
  jogo: { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null },
  quem: number,
  relogio: { andar: () => void; avancar: (ms: number) => void },
) => boolean;
const LOTES: JogadaDoLote[] = [jogadaHonestaDoLote1, jogadaHonestaDoLote2];

export function jogadaHonesta(
  micro: string,
  jogo: { publico(quem: number): Record<string, unknown>; acao(quem: number, corpo: Record<string, unknown>): string | null },
  quem: number,
  { andar, avancar }: { andar: () => void; avancar: (ms: number) => void },
) {
  const dados = jogo.publico(quem).dados;
  if (micro === 'praga') {
    const d = dados as DadosPraga;
    const i = d.bichos.findIndex((b) => !b.coelho);
    avancar(d.bichos[i].t + 150);
    jogo.acao(quem, { tipo: 'acerto', i });
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'ponteiro') {
    const d = dados as DadosPonteiro;
    avancar(d.passagens[0] - 150);
    jogo.acao(quem, { tipo: 'acerto', t: d.passagens[0] - 150 });
    avancar(d.passagens[1] - d.passagens[0] + 100);
    jogo.acao(quem, { tipo: 'resultado' });
  } else if (micro === 'despensa') {
    const d = dados as DadosDespensa;
    avancar(arrumacao() + 3000);
    jogo.acao(quem, { tipo: 'resultado', ordem: d.prateleira, ms: 3000 });
  } else if (micro === 'flor') {
    // as figuras saem uma a uma: anda até a primeira flor, olha, e bate
    for (let n = 0; n < 40; n++) {
      const figuras = (jogo.publico(quem).dados as DadosFlor).figuras;
      const i = figuras.length - 1;
      if (figuras[i]?.tipo === FLOR) {
        avancar(300);
        jogo.acao(quem, { tipo: 'acerto', i, reacaoMs: 300 });
        jogo.acao(quem, { tipo: 'resultado' });
        return;
      }
      andar();
    }
    assert.fail('a flor não saiu');
  } else if (!LOTES.some((lote) => lote(micro, jogo, quem, { andar, avancar }))) {
    assert.fail(`sem jogada honesta para ${micro}`);
  }
}
