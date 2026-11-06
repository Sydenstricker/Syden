/**
 * O ESCONDE-ESCONDE NA HORTA (05/11/2026; do Hide and Sneak do levantamento em docs/mario-party-3.md, só a mecânica): quatro
 * esconderijos (a moita, o toco, o regador e a casinha). Um da turma, sorteado, fica com a LANTERNA; os outros se escondem. Em
 * três rodadas, todos escolhem AO MESMO TEMPO e em segredo: quem se esconde, onde fica; quem procura, onde olha. Aí se revela:
 * quem estava no lugar olhado foi achado e sai. Ganha quem passou pelas três rodadas, ou quem procura, se achou todo mundo. Rende
 * conversa na voz ("eu sabia que você ia no toco!").
 *
 * SOZINHO (o Solo, ou só uma pessoa na sala), quem procura é a RAPOSA: os lugares dela são sorteados no `gerar` e só vão à tela
 * na revelação de cada rodada.
 *
 * A REDE NÃO PESA: as escolhas são simultâneas e secretas, então a que chega um pouco depois do fim (até ESCOLHA_FOLGA_MS)
 * ainda vale, e não dá vantagem a ninguém. A turma e o papel de cada um: ver ./lote4-turma.ts.
 */
import { inteiro, microjogo, sortear, type Largada, type Resultado } from './comum.js';
import { entrar, JUNTAR_MS } from './lote4-turma.js';

export const LUGARES = 4;
export const RODADAS = 3;
export const ESCOLHA_MS = 6000;
/** O servidor ainda aceita a escolha por isto depois do fim (a rede de quem escolheu no último instante). */
export const ESCOLHA_FOLGA_MS = 500;
export const MOSTRA_MS = 2800;
export const RODADA_MS = ESCOLHA_MS + ESCOLHA_FOLGA_MS + MOSTRA_MS;
export const ESCONDE_MS = JUNTAR_MS + RODADAS * RODADA_MS;
/** Quem procura é a raposa (ninguém da turma). */
export const RAPOSA = -1;

export interface DadosEsconde {
  /** Para sortear quem fica com a lanterna. */
  sorteio: number;
  /** Onde a raposa olha em cada rodada, e onde fica quem não escolheu (SÓ no servidor: a `vista` não manda). */
  raposa: number[];
  ao_acaso: number[];
}

export interface VistaEsconde {
  lugares: number;
  /** 'juntando', a escolha da rodada, a revelação dela, ou o fim. */
  etapa: 'juntando' | 'escolha' | 'mostra' | 'fim';
  /** A rodada (0, 1, 2). */
  rodada: number;
  /** Quanto falta da etapa, quando vista. */
  restaMs: number;
  /** A turma, na ordem de chegada: quem procura e, para quem se esconde, em que rodada foi achado (ou null). */
  turma: { busca: boolean; achadoEm: number | null }[];
  /** A minha posição na turma (-1: não estou). Quem procura é a raposa quando ninguém da turma tem a lanterna. */
  eu: number;
  /** A minha escolha nesta rodada, como o servidor a recebeu. */
  minha: number | null;
  /** A última revelação: onde se olhou, e onde cada um da turma estava (null para quem procura ou já tinha saído). */
  mostra: { rodada: number; olhou: number; onde: (number | null)[] } | null;
}

interface Mem {
  l: Largada<DadosEsconde, Mem> | null;
  membros: number[];
  /** Quem procura: um da turma, ou RAPOSA. null enquanto junta. */
  busca: number | null;
  etapa: VistaEsconde['etapa'];
  rodada: number;
  etapaDesde: number;
  /** As escolhas da rodada (de quem procura também). */
  escolhas: Map<number, number>;
  /** Onde cada um ficou na rodada anterior (quem não escolhe fica onde estava). */
  antes: Map<number, number>;
  achados: Map<number, number>;
  mostra: VistaEsconde['mostra'];
}

const escondidos = (mem: Mem) => mem.membros.filter((id) => id !== mem.busca);
const vivos = (mem: Mem) => escondidos(mem).filter((id) => !mem.achados.has(id));

function etapa(mem: Mem, e: VistaEsconde['etapa'], ms: number, depois: () => void) {
  const l = mem.l!;
  mem.etapa = e;
  mem.etapaDesde = l.agora();
  l.agendar(ms, depois);
  l.avisar();
}

function escolher(dados: DadosEsconde, mem: Mem) {
  mem.escolhas = new Map();
  etapa(mem, 'escolha', ESCOLHA_MS + ESCOLHA_FOLGA_MS, () => revelarRodada(dados, mem));
}

function revelarRodada(dados: DadosEsconde, mem: Mem) {
  const r = mem.rodada;
  const busca = mem.busca!;
  const olhou = busca === RAPOSA ? dados.raposa[r] : (mem.escolhas.get(busca) ?? dados.ao_acaso[(r * 7 + 3) % dados.ao_acaso.length]);
  const onde: (number | null)[] = mem.membros.map(() => null);
  for (const id of vivos(mem)) {
    const k = mem.membros.indexOf(id);
    const lugar = mem.escolhas.get(id) ?? mem.antes.get(id) ?? dados.ao_acaso[(k + r * 3) % dados.ao_acaso.length];
    mem.antes.set(id, lugar);
    onde[k] = lugar;
    if (lugar === olhou) mem.achados.set(id, r);
  }
  mem.mostra = { rodada: r, olhou, onde };
  const acabou = r + 1 >= RODADAS || vivos(mem).length === 0;
  etapa(mem, 'mostra', MOSTRA_MS, () => {
    if (acabou) {
      mem.etapa = 'fim';
      mem.l!.revelar();
      return;
    }
    mem.rodada++;
    escolher(dados, mem);
  });
}

/** Os pontos: quem se esconde vale as rodadas por que passou (3 é passar por todas); quem procura, quantos achou, e 4 se achou todos. */
function resultadoDe(mem: Mem, id: number): Resultado {
  if (id === mem.busca) {
    const achados = mem.achados.size;
    const todos = achados > 0 && achados === escondidos(mem).length;
    const s = todos ? RODADAS + 1 : achados;
    return { motivo: null, valor: 100 + achados, chave: [-s] };
  }
  const em = mem.achados.get(id);
  const s = em === undefined ? Math.min(RODADAS, mem.rodada + 1) : em;
  return { motivo: null, valor: s, chave: [-s] };
}

export default microjogo<DadosEsconde, Mem>({
  id: 'esconde',
  gerar(aleatorio) {
    return {
      sorteio: aleatorio(),
      raposa: Array.from({ length: RODADAS }, () => sortear(aleatorio, LUGARES)),
      ao_acaso: Array.from({ length: 16 }, () => sortear(aleatorio, LUGARES)),
    };
  },
  duracao: () => ESCONDE_MS + 300,
  memoria: () => ({
    l: null,
    membros: [],
    busca: null,
    etapa: 'juntando',
    rodada: 0,
    etapaDesde: 0,
    escolhas: new Map(),
    antes: new Map(),
    achados: new Map(),
    mostra: null,
  }),
  iniciar(l) {
    const { dados, mem } = l;
    mem.l = l;
    etapa(mem, 'juntando', JUNTAR_MS, () => {
      if (mem.membros.length === 0) {
        l.agendar(ESCONDE_MS - JUNTAR_MS, l.revelar);
        return;
      }
      // com duas pessoas ou mais, uma da turma fica com a lanterna; sozinho, a raposa procura
      mem.busca = mem.membros.length >= 2 ? mem.membros[Math.floor(dados.sorteio * mem.membros.length)] : RAPOSA;
      escolher(dados, mem);
    });
  },
  vista({ mem, quem }) {
    const v: VistaEsconde = {
      lugares: LUGARES,
      etapa: mem.etapa,
      rodada: mem.rodada,
      restaMs: mem.l ? Math.max(0, (mem.etapa === 'escolha' ? ESCOLHA_MS : mem.etapa === 'mostra' ? MOSTRA_MS : JUNTAR_MS) - (mem.l.agora() - mem.etapaDesde)) : 0,
      turma: mem.membros.map((id) => ({ busca: id === mem.busca, achadoEm: mem.achados.get(id) ?? null })),
      eu: mem.membros.indexOf(quem),
      minha: mem.etapa === 'escolha' ? (mem.escolhas.get(quem) ?? null) : null,
      mostra: mem.mostra,
    };
    return { dados: v };
  },
  acerto({ mem, quem, corpo }) {
    if (corpo.entrar === 1) {
      // quem chega depois de os papéis saírem não entra: a rodada já começou sem ele
      if (mem.etapa === 'juntando') entrar(mem.membros, quem);
      return;
    }
    const { r, lugar } = corpo;
    if (mem.etapa !== 'escolha' || r !== mem.rodada || !inteiro(lugar) || lugar < 0 || lugar >= LUGARES) return;
    if (!mem.membros.includes(quem) || mem.achados.has(quem)) return;
    // vale a última escolha antes do fim (dá para mudar de ideia)
    mem.escolhas.set(quem, lugar);
  },
  // o fim é do servidor: um 'resultado' no meio só congela o que a pessoa tem
  avaliar: ({ mem, quem }) => (mem.membros.includes(quem) && mem.busca !== null ? resultadoDe(mem, quem) : { motivo: 'invalido', valor: null, chave: [] }),
  *noFim({ mem }) {
    if (mem.busca === null) return;
    for (const id of mem.membros) yield [id, resultadoDe(mem, id)] as [number, Resultado];
  },
  robo(_dados, aleatorio, passouMs) {
    // escondendo-se: a chance de passar por cada rodada é de 3 em 4
    const rodadas = Math.min(RODADAS, Math.max(0, Math.floor((passouMs - JUNTAR_MS) / RODADA_MS)));
    let s = 0;
    while (s < rodadas && aleatorio() < 0.75) s++;
    return { motivo: null, valor: s, chave: [-s] };
  },
});
