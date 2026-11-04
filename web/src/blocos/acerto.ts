/**
 * A HORTA EM CASCATA: o acerto desta tela com o que o servidor diz (JogoBlocos.tsx), em funções puras para o teste
 * (web/test/blocos.test.ts). Achados da revisão independente de 03/11/2026.
 */
import { cabeNoRitmo, jogadaValida, trocaNoIntervalo, type Jogada } from './sim';

export interface ListaDaTela {
  jogadas: Jogada[];
  /** Quantas jogadas desta lista o servidor já leu, e quantas ele tinha lido (na conta dele) quando elas foram contadas. */
  enviadasIdx: number;
  deBase: number;
  versao: number;
  pronto: boolean;
}

export interface DoServidor {
  recebidas: number;
  versao: number;
  passo: number;
  jogadas: readonly (readonly number[])[] | null;
}

export interface Acerto {
  jogadas: Jogada[];
  enviadasIdx: number;
  deBase: number;
  versao: number;
  pronto: boolean;
  /** A tela diz que uma jogada não valeu (o servidor recusou; o painel aberto de novo não é recusa). */
  recusada: boolean;
  /** A lista mudou: a partida é refeita do começo. */
  refazer: boolean;
}

const igual = (a: Jogada | undefined, b: readonly number[]) => !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

/**
 * O que o servidor leu e aceitou, junto com o que esta tela ainda não mandou. Quando ele recusou alguma jogada, vale a lista
 * DELE; e as trocas feitas AQUI enquanto o lote recusado ia (as que ele ainda não leu) continuam, depois da lista dele, e
 * esperam o próximo lote — antes, sumiam caladas. Só ficam as que ele ainda aceitaria: do passo dele em diante, na ordem,
 * no ritmo de uma mão e no intervalo entre trocas (as mesmas contas do servidor).
 */
export function acertarComOServidor(g: ListaDaTela, meu: DoServidor): Acerto {
  const divergiu = meu.jogadas !== null && (meu.jogadas.length > g.jogadas.length || meu.jogadas.some((j, i) => !igual(g.jogadas[i], j)));
  if (meu.jogadas && (meu.versao > g.versao || divergiu)) {
    const lista = meu.jogadas.map((j) => [...j] as Jogada);
    const aceitas = lista.length;
    if (g.pronto) {
      const lidas = g.enviadasIdx + Math.max(0, meu.recebidas - g.deBase);
      for (const x of g.jogadas.slice(lidas)) {
        const ultima = lista[lista.length - 1];
        const ok =
          jogadaValida(x) &&
          x[0] >= meu.passo &&
          (!ultima || x[0] >= ultima[0]) &&
          cabeNoRitmo(lista, x[0]) &&
          (x[1] !== 0 || trocaNoIntervalo(lista, x[0]));
        if (ok) lista.push([...x] as Jogada);
      }
    }
    return {
      jogadas: lista,
      enviadasIdx: aceitas,
      deBase: meu.recebidas,
      versao: meu.versao,
      pronto: true,
      recusada: g.pronto && meu.versao > g.versao,
      refazer: true,
    };
  }
  const acerto = { ...g, recusada: false, refazer: false };
  if (meu.recebidas > g.deBase) {
    acerto.enviadasIdx = Math.min(g.jogadas.length, g.enviadasIdx + (meu.recebidas - g.deBase));
    acerto.deBase = meu.recebidas;
  }
  return acerto;
}

/**
 * O painel aberto no meio pede a lista ao servidor UMA vez. O modo estrito do React roda o efeito duas vezes, e a segunda
 * sincronia subia a versão de novo: a lista chegava já "pronta", e a tela dizia "Uma jogada não valeu." sem nada recusado.
 */
export function pedirSincroniaUmaVez(g: { pediuSincronia: boolean }, pedir: () => void) {
  if (g.pediuSincronia) return;
  g.pediuSincronia = true;
  pedir();
}

/**
 * O servidor já tirou a pessoa da partida? 'saiu': ela saiu da sala (e a partida seguiu sem ela); 'topo': a pilha dela, na
 * conta do servidor, chegou ao topo. Antes a tela seguia jogando uma partida que não contava mais.
 */
export function foraDoJogo(estado: { meu: { fim: boolean } | null; jogadores: { userId: number; saiu: boolean }[] }, eu: number): 'saiu' | 'topo' | null {
  if (!estado.meu?.fim) return null;
  return estado.jogadores.find((j) => j.userId === eu)?.saiu ? 'saiu' : 'topo';
}
