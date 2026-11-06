/**
 * AS CARTAS DO CELEIRO (05/11/2026; do Stacked Deck do levantamento em docs/mario-party-3.md, só a mecânica): doze cartas
 * viradas para baixo, e a turma vira uma de cada vez, em turnos. Cenoura vale 1, a dourada vale 3, e a raposa leva tudo o que a
 * pessoa juntou e a tira do jogo (nunca na primeira carta de cada um). Na sua vez, dá também para GUARDAR o que já juntou e parar. Ganha quem guardou mais cenouras.
 * Sorte, mas com suspense e uma escolha, o que rende na voz.
 *
 * OS TURNOS, NO FORMATO DE SEMPRE (ver ./lote4-turma.ts): cada tela manda `{ entrar: 1 }` ao começar, e depois de JUNTAR_MS a
 * ordem é sorteada entre quem entrou. O servidor é dono da vez, do relógio de cada vez e do que está debaixo de cada carta: o
 * conteúdo só vai à sala quando a carta é virada.
 */
import { inteiro, microjogo, type Largada, type Resultado } from './comum.js';
import { embaralhar, entrar, JUNTAR_MS } from './lote4-turma.js';

export const CARTAS = 12;
/** O que há debaixo das cartas: 0 é a raposa, e o resto é quantas cenouras ela dá. */
export const RAPOSA = 0;
export const BARALHO = [RAPOSA, RAPOSA, RAPOSA, 1, 1, 1, 1, 1, 1, 1, 3, 3] as const;
/** Quanto cada um tem para decidir na sua vez (depois, guarda sozinho), e quanto a carta virada fica na mesa antes da vez seguinte. */
export const VEZ_MS = 4500;
export const MOSTRA_MS = 1300;
/** O teto do jogo: o que estiver na mão nessa hora vale como guardado. */
export const CELEIRO_MS = 42000;

export interface DadosCeleiro {
  /** O que está debaixo de cada carta (SÓ no servidor: a `vista` nunca o manda). */
  baralho: number[];
  /** Para sortear a ordem da turma. */
  sorteios: number[];
}

/** O que a tela vê. */
export interface VistaCeleiro {
  cartas: number;
  /** As viradas: a carta, o que tinha, e a posição de quem virou na ordem. */
  viradas: { i: number; tipo: number; quem: number }[];
  /** A turma, na ordem das vezes: as cenouras de cada um, e se saiu (a raposa) ou guardou. */
  turma: { cenouras: number; fora: 'raposa' | 'guardou' | null }[];
  /** De quem é a vez (posição na turma), ou -1 (juntando, mostrando a carta, ou acabou). */
  vez: number;
  /** O número da vez (para a tela não mandar a ação de uma vez que já passou). */
  n: number;
  /** A minha posição na turma, ou -1. */
  eu: number;
  /** Quanto falta da vez, quando vista. */
  restaMs: number;
}

interface Pessoa {
  cenouras: number;
  fora: 'raposa' | 'guardou' | null;
}
interface Mem {
  l: Largada<DadosCeleiro, Mem> | null;
  membros: number[];
  ordem: number[] | null;
  /** Posição na ordem de quem está na vez; -1 enquanto a carta virada está na mesa, ou quando acabou. */
  vez: number;
  /** De quem foi a última vez (a seguinte sai dela). */
  ultima: number;
  n: number;
  vezDesde: number;
  viradas: { i: number; tipo: number; quem: number }[];
  pessoas: Map<number, Pessoa>;
  /** O começo do jogo, no relógio do servidor. */
  comeco: number;
}

/** Marca o próximo passo; se ele passaria do teto, marca a revelação no teto. */
function marcar(mem: Mem, ms: number, depois: () => void) {
  const l = mem.l!;
  const resta = CELEIRO_MS - (l.agora() - mem.comeco);
  if (resta <= ms) l.agendar(Math.max(0, resta), l.revelar);
  else l.agendar(ms, depois);
}

const pela = (p: Pessoa | undefined): Resultado => {
  if (!p) return { motivo: 'errou', valor: 0, chave: [] };
  if (p.fora === 'raposa' || p.cenouras === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: p.cenouras, chave: [-p.cenouras] };
};

/** A próxima vez: o seguinte na ordem que ainda joga. Sem ninguém, ou sem carta, acaba. */
function proximaVez(dados: DadosCeleiro, mem: Mem) {
  const l = mem.l!;
  const ordem = mem.ordem ?? [];
  const sobra = dados.baralho.length - mem.viradas.length;
  for (let k = 1; k <= ordem.length && sobra > 0; k++) {
    const pos = (mem.ultima + k) % ordem.length;
    if (mem.pessoas.get(ordem[pos])!.fora === null) {
      mem.vez = pos;
      mem.ultima = pos;
      mem.n++;
      mem.vezDesde = l.agora();
      marcar(mem, VEZ_MS, () => guardar(dados, mem, pos));
      l.avisar();
      return;
    }
  }
  mem.vez = -1;
  l.revelar();
}

function guardar(dados: DadosCeleiro, mem: Mem, pos: number) {
  if (mem.vez !== pos || !mem.ordem) return;
  mem.pessoas.get(mem.ordem[pos])!.fora = 'guardou';
  proximaVez(dados, mem);
}

export default microjogo<DadosCeleiro, Mem>({
  id: 'celeiro',
  gerar(aleatorio) {
    const sorteios = Array.from({ length: 12 }, () => aleatorio());
    return { baralho: embaralhar(BARALHO, Array.from({ length: CARTAS }, () => aleatorio())), sorteios };
  },
  duracao: () => CELEIRO_MS,
  memoria: () => ({ l: null, membros: [], ordem: null, vez: -1, ultima: -1, n: 0, vezDesde: 0, viradas: [], pessoas: new Map(), comeco: 0 }),
  iniciar(l) {
    const { dados, mem } = l;
    mem.l = l;
    mem.comeco = l.agora();
    l.agendar(JUNTAR_MS, () => {
      mem.ordem = embaralhar(mem.membros, dados.sorteios);
      if (mem.ordem.length === 0) {
        // ninguém entrou: o tempo corre até o fim, como em qualquer microjogo
        l.agendar(CELEIRO_MS - JUNTAR_MS, l.revelar);
        return;
      }
      proximaVez(dados, mem);
    });
  },
  vista({ dados, mem, quem, fase }) {
    const ordem = mem.ordem ?? [];
    const v: VistaCeleiro = {
      cartas: dados.baralho.length,
      viradas: mem.viradas,
      turma: ordem.map((id) => ({ ...mem.pessoas.get(id)! })),
      vez: fase === 'jogando' ? mem.vez : -1,
      n: mem.n,
      eu: ordem.indexOf(quem),
      restaMs: mem.vez >= 0 && mem.l ? Math.max(0, VEZ_MS - (mem.l.agora() - mem.vezDesde)) : 0,
    };
    return { dados: v };
  },
  acerto({ dados, mem, quem, corpo, passou }) {
    if (corpo.entrar === 1) {
      if (mem.pessoas.has(quem)) return;
      entrar(mem.membros, quem);
      mem.pessoas.set(quem, { cenouras: 0, fora: null });
      // quem chega depois de sorteada a ordem joga por último
      if (mem.ordem) mem.ordem.push(quem);
      return;
    }
    // só quem está na vez, na vez certa
    if (!mem.ordem || mem.vez < 0 || mem.ordem[mem.vez] !== quem || corpo.n !== mem.n || passou >= CELEIRO_MS) return;
    if (corpo.guarda === 1) return guardar(dados, mem, mem.vez);
    const i = corpo.vira;
    if (!inteiro(i) || i < 0 || i >= dados.baralho.length || mem.viradas.some((v) => v.i === i)) return;
    const p = mem.pessoas.get(quem)!;
    // a PRIMEIRA carta de cada um nunca é a raposa (ninguém sai sem ter jogado): se for, ela troca de lugar, em segredo, com
    // uma cenoura ainda virada para baixo
    if (dados.baralho[i] === RAPOSA && !mem.viradas.some((v) => v.quem === mem.vez)) {
      const j = dados.baralho.findIndex((x, k) => x !== RAPOSA && !mem.viradas.some((v) => v.i === k));
      if (j >= 0) [dados.baralho[i], dados.baralho[j]] = [dados.baralho[j], dados.baralho[i]];
    }
    const tipo = dados.baralho[i];
    mem.viradas.push({ i, tipo, quem: mem.vez });
    if (tipo === RAPOSA) {
      p.cenouras = 0;
      p.fora = 'raposa';
    } else p.cenouras += tipo;
    // a carta fica na mesa um pouco, e só então vem a vez seguinte
    mem.vez = -1;
    mem.n++;
    marcar(mem, MOSTRA_MS, () => proximaVez(dados, mem));
    mem.l!.avisar();
  },
  // o fim é do servidor: um 'resultado' mandado no meio só tira a pessoa do jogo, com o que ela tem
  avaliar: ({ mem, quem }) => pela(mem.pessoas.get(quem)),
  *noFim({ mem }) {
    for (const [quem, p] of mem.pessoas) yield [quem, pela(p)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    if (aleatorio() < 0.3) return { motivo: 'errou', valor: 0, chave: [] };
    // umas três vezes, de 1 a 2 cartas por vez, no tempo que houve
    const viradas = Math.max(1, Math.min(4, Math.floor(passouMs / 7000)));
    let n = 0;
    for (let k = 0; k < viradas; k++) n += aleatorio() < 0.2 ? 3 : 1;
    return { motivo: null, valor: n, chave: [-n] };
  },
});
