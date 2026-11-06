/**
 * BATE QUANDO DER A FLOR (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica): na mesa, as figuras da horta
 * vão aparecendo uma depois da outra (cenoura, repolho, rabanete, cogumelo, e uma flor parecida, de outra cor). Quando sai a
 * flor igual à do quadrinho, bate. Bater em qualquer outra elimina. Vale quantas flores se bateu, e no empate, a soma das
 * reações.
 *
 * COMO O SAQUE, A PRÓXIMA FIGURA SÓ VAI QUANDO SAI: o servidor marca o relógio figura a figura e avisa a sala; a `vista` só
 * mostra as que já saíram. Assim a tela não sabe antes quando vem a flor. A reação conta de quando a flor APARECEU em cada
 * tela: o servidor anota quando serviu cada figura a cada um, e a reação dita não passa do que ele viu desde então (nem fica
 * abaixo disso mais do que a rede da pessoa: aí ele a sobe). Cada batida vai na hora (ação 'acerto').
 */
import { FOLGA_ACIMA, inteiro, microjogo, numero, REACAO_MINIMA, type Conferencia, type Resultado } from './comum.js';

/** As figuras: a flor que vale, a parecida e as outras. */
export const FLOR = 0;
export const PARECIDA = 1;
export const TIPOS_DE_FIGURA = 6;
export const FIGURAS = 26;
export const FLORES = 5;
export const PARECIDAS = 4;
/** Quanto cada figura fica na mesa: começa folgada e encurta. */
export const FIGURA_INICIAL_MS = 1150;
export const FIGURA_FINAL_MS = 700;

export interface DadosFlor {
  /** Cada figura: quando sai (ms desde o começo) e o tipo. */
  figuras: { t: number; tipo: number }[];
  /** Quando a última sai da mesa. */
  fim: number;
}

interface DaPessoa {
  /** Quando o servidor serviu a esta pessoa o estado com cada figura (pelo índice). */
  servidaEm: number[];
  /** As reações às flores batidas (pelo índice da figura). */
  flores: Map<number, number>;
  /** Bateu na figura errada (ou antes de a flor poder ter sido vista). */
  fora: 'errou' | 'cedo' | null;
}
interface Mem {
  /** Quantas figuras já saíram. */
  saiu: number;
  pessoas: Map<number, DaPessoa>;
}

const daPessoa = (mem: Mem, quem: number) => {
  let p = mem.pessoas.get(quem);
  if (!p) mem.pessoas.set(quem, (p = { servidaEm: [], flores: new Map(), fora: null }));
  return p;
};

const pelasFlores = (p: DaPessoa | undefined): Resultado => {
  if (p?.fora) return { motivo: p.fora, valor: null, chave: [] };
  const n = p?.flores.size ?? 0;
  if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
  const soma = [...p!.flores.values()].reduce((a, b) => a + b, 0);
  return { motivo: null, valor: n, chave: [-n, soma] };
};

/** Uma batida: na flor, a reação conta; em outra figura, está fora. */
function bater({ dados, mem, quem, corpo, agora, abaixo }: Conferencia<DadosFlor, Mem>) {
  const i = corpo.i;
  const p = daPessoa(mem, quem);
  if (p.fora || !inteiro(i) || i < 0 || i >= p.servidaEm.length || p.flores.has(i)) return;
  if (dados.figuras[i].tipo !== FLOR) {
    p.fora = 'errou';
    return;
  }
  const r = corpo.reacaoMs;
  if (!numero(r)) return;
  // a flor ainda estava na tela desta pessoa (a seguinte não tinha chegado, com a folga da rede)
  const desde = agora - p.servidaEm[i];
  const naTelaAte = p.servidaEm[i + 1] !== undefined ? p.servidaEm[i + 1] - p.servidaEm[i] + abaixo : Infinity;
  if (r > desde + FOLGA_ACIMA || r > naTelaAte) return;
  if (r < REACAO_MINIMA) {
    p.fora = 'cedo';
    return;
  }
  p.flores.set(i, Math.round(Math.max(r, desde - abaixo)));
}

export default microjogo<DadosFlor, Mem>({
  id: 'flor',
  gerar(aleatorio) {
    // os tipos: as flores e as parecidas espalhadas, nunca duas iguais seguidas, nem flor nas três primeiras
    const tipos: number[] = [];
    for (let i = 0; i < FIGURAS; i++) tipos.push(2 + Math.floor(aleatorio() * (TIPOS_DE_FIGURA - 2)));
    const pode = (i: number, tipo: number) => i >= 3 && tipos[i] >= 2 && tipos[i - 1] !== tipo && tipos[i + 1] !== tipo;
    for (const [tipo, quantas] of [[FLOR, FLORES], [PARECIDA, PARECIDAS]] as const) {
      for (let k = 0; k < quantas; k++) {
        let i = 3 + Math.floor(aleatorio() * (FIGURAS - 3));
        for (let n = 0; n < FIGURAS && !pode(i, tipo); n++) i = 3 + ((i - 3 + 1) % (FIGURAS - 3));
        if (pode(i, tipo)) tipos[i] = tipo;
      }
    }
    // a mesma figura duas vezes seguidas não se vê trocar: muda a de trás
    for (let i = 1; i < FIGURAS; i++) if (tipos[i] === tipos[i - 1] && tipos[i] >= 2) tipos[i] = 2 + ((tipos[i] - 2 + 1) % (TIPOS_DE_FIGURA - 2));
    const figuras: { t: number; tipo: number }[] = [];
    let t = 0;
    for (let i = 0; i < FIGURAS; i++) {
      figuras.push({ t, tipo: tipos[i] });
      t += Math.round(FIGURA_INICIAL_MS - ((FIGURA_INICIAL_MS - FIGURA_FINAL_MS) * i) / (FIGURAS - 1)) + Math.floor(aleatorio() * 150);
    }
    return { figuras, fim: t };
  },
  duracao: (d) => d.fim + 1500,
  memoria: () => ({ saiu: 0, pessoas: new Map() }),
  iniciar({ dados, mem, agendar, avisar, revelar }) {
    // a primeira já está na mesa; as outras saem uma a uma, e a sala é avisada a cada uma
    mem.saiu = 1;
    const proxima = () => {
      if (mem.saiu >= dados.figuras.length) return agendar(dados.fim - dados.figuras[dados.figuras.length - 1].t + 1500, revelar);
      agendar(dados.figuras[mem.saiu].t - dados.figuras[mem.saiu - 1].t, () => {
        mem.saiu++;
        avisar();
        proxima();
      });
    };
    proxima();
  },
  vista({ dados, mem, quem, fase, agora }) {
    if (fase === 'revelando') return { dados };
    if (fase !== 'jogando') return { dados: { figuras: [], fim: dados.fim } };
    // o que saiu até agora, e quando cada figura foi servida a esta pessoa pela primeira vez
    const p = daPessoa(mem, quem);
    while (p.servidaEm.length < mem.saiu) p.servidaEm.push(agora);
    return { dados: { figuras: dados.figuras.slice(0, mem.saiu), fim: dados.fim } };
  },
  acerto: bater,
  // a batida errada vai JUNTO com o fim (separadas, o fim podia chegar antes e valer as flores de quem já estava fora)
  avaliar(c) {
    if (c.corpo.i !== undefined) bater(c);
    return pelasFlores(c.mem.pessoas.get(c.quem));
  },
  *noFim({ mem }) {
    for (const [quem, p] of mem.pessoas) if (p.fora || p.flores.size) yield [quem, pelasFlores(p)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    if (aleatorio() < 0.08) return { motivo: 'errou', valor: null, chave: [] };
    const flores = dados.figuras.filter((f) => f.tipo === FLOR && f.t + 250 <= passouMs).length;
    const n = Math.max(0, flores - (aleatorio() < 0.5 ? 0 : 1));
    if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
    let soma = 0;
    for (let k = 0; k < n; k++) soma += Math.round(260 + aleatorio() * 200);
    return { motivo: null, valor: n, chave: [-n, soma] };
  },
});
