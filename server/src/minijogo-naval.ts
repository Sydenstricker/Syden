import { duelo, type Lado } from './minijogo-tabuleiro.js';
import type { Definicao, Jogo } from './minijogo-motor.js';

/**
 * BATALHA NAVAL (04/11/2026), o jogo de papel quadriculado: cada um tem um mar de 10 × 10 com cinco navios (5, 4, 3, 3 e
 * 2 casas, retos, e nenhum encostado em outro, nem na diagonal), e atira no mar do outro. Acertou, atira de novo; errou,
 * passa a vez. Vence quem afundar a frota inteira.
 *
 * Roda na mesa de duas pessoas (`duelo`, minijogo-tabuleiro.ts), com a sala assistindo. É o único jogo da mesa com
 * informação ESCONDIDA: cada um vê os próprios navios e, do outro, só o que os tiros revelaram (o navio inteiro só quando
 * afunda). Quem assiste vê os dois mares do mesmo jeito, sem navio escondido nenhum — senão bastava assistir para soprar
 * pela voz. No fim, tudo aparece para todos.
 *
 * O SERVIDOR põe as duas frotas, por sorteio. Enquanto ninguém atirou no seu mar, você sorteia a sua de novo quantas vezes
 * quiser, mesmo fora da vez (`{ tipo: 'livre', acao: 'sortear' }`); depois do primeiro tiro, a frota fica.
 */

export const LADO_DO_MAR = 10;
export const CASAS_DO_MAR = LADO_DO_MAR * LADO_DO_MAR;
export const FROTA = [5, 4, 3, 3, 2] as const;

/** Um mar: os navios (as casas de cada um) e os tiros que ele levou. */
interface Mar {
  navios: number[][];
  /** Por casa: se já levou tiro. */
  tiros: boolean[];
}

export type Resultado = 'agua' | 'acertou' | 'afundou';

export interface EstadoNaval {
  mares: [Mar, Mar];
  ultimo: { lado: Lado; casa: number; resultado: Resultado } | null;
  /** A partida acabou: os navios aparecem para todos. */
  revelado: boolean;
}

/** O que se vê de um mar: os tiros (0 nada, 1 água, 2 fogo) e os navios que quem pede pode ver. */
export interface MarPublico {
  tiros: number[];
  navios: { casas: number[]; afundado: boolean }[];
}

/**
 * Uma frota válida, sorteada: cada navio num lugar livre, e as casas em volta dele (as oito vizinhas) fechadas para os
 * próximos. Começa pelo maior, que é o mais difícil de encaixar; se um não couber (raro), recomeça.
 */
export function sortearFrota(aleatorio: () => number = Math.random): number[][] {
  const n = LADO_DO_MAR;
  for (;;) {
    const fechada = new Array<boolean>(CASAS_DO_MAR).fill(false);
    const navios: number[][] = [];
    let coube = true;
    for (const tamanho of FROTA) {
      let posto: number[] | null = null;
      for (let tentativa = 0; tentativa < 200 && !posto; tentativa++) {
        const deitado = aleatorio() < 0.5;
        const linhas = deitado ? n : n - tamanho + 1;
        const colunas = deitado ? n - tamanho + 1 : n;
        const l0 = Math.min(linhas - 1, Math.floor(aleatorio() * linhas));
        const c0 = Math.min(colunas - 1, Math.floor(aleatorio() * colunas));
        const casas = Array.from({ length: tamanho }, (_, k) => (deitado ? l0 * n + c0 + k : (l0 + k) * n + c0));
        if (casas.every((c) => !fechada[c])) posto = casas;
      }
      if (!posto) {
        coube = false;
        break;
      }
      navios.push(posto);
      for (const c of posto) {
        const l = Math.floor(c / n);
        const col = c % n;
        for (let dl = -1; dl <= 1; dl++) {
          for (let dc = -1; dc <= 1; dc++) {
            const ll = l + dl;
            const cc = col + dc;
            if (ll >= 0 && ll < n && cc >= 0 && cc < n) fechada[ll * n + cc] = true;
          }
        }
      }
    }
    if (coube) return navios;
  }
}

const afundado = (mar: Mar, navio: number[]) => navio.every((c) => mar.tiros[c]);

function marPublico(mar: Mar, verTudo: boolean): MarPublico {
  const fogo = new Set(mar.navios.flat());
  return {
    tiros: mar.tiros.map((t, c) => (!t ? 0 : fogo.has(c) ? 2 : 1)),
    navios: mar.navios
      .map((casas) => ({ casas, afundado: afundado(mar, casas) }))
      .filter((navio) => verTudo || navio.afundado),
  };
}

/** Os tamanhos dos navios que ainda boiam (é o que o jogo de papel conta em voz alta). */
const restam = (mar: Mar) => mar.navios.filter((navio) => !afundado(mar, navio)).map((navio) => navio.length);

export function criarNaval(aleatorio: () => number = Math.random): Definicao {
  return {
    mesa: true,
    comecar(ctx, opcoes) {
      let estado: EstadoNaval | null = null;
      const novoMar = (): Mar => ({ navios: sortearFrota(aleatorio), tiros: new Array<boolean>(CASAS_DO_MAR).fill(false) });
      const mesa = duelo<EstadoNaval>(
        {
          inicio: () => (estado = { mares: [novoMar(), novoMar()], ultimo: null, revelado: false }),
          jogar(e, lado, corpo) {
            const casa = Number(corpo.casa);
            if (!Number.isInteger(casa) || casa < 0 || casa >= CASAS_DO_MAR) return 'Escolha uma casa do mar.';
            const outro: Lado = lado === 0 ? 1 : 0;
            const alvo = e.mares[outro];
            if (alvo.tiros[casa]) return 'Você já atirou nessa casa.';
            alvo.tiros[casa] = true;
            const navio = alvo.navios.find((casas) => casas.includes(casa));
            if (!navio) {
              e.ultimo = { lado, casa, resultado: 'agua' };
              return { proximo: outro };
            }
            e.ultimo = { lado, casa, resultado: afundado(alvo, navio) ? 'afundou' : 'acertou' };
            if (alvo.navios.every((casas) => afundado(alvo, casas))) {
              e.revelado = true;
              return { proximo: lado, vencedor: lado };
            }
            // Acertou: atira de novo.
            return { proximo: lado };
          },
          livre(e, lado, corpo) {
            if (corpo.acao !== 'sortear') return 'Ação desconhecida.';
            const meu = e.mares[lado];
            if (meu.tiros.some(Boolean)) return 'Já atiraram no seu mar: a frota não muda mais.';
            meu.navios = sortearFrota(aleatorio);
            return null;
          },
          publico(e, lado) {
            const mares = [0, 1].map((l) => marPublico(e.mares[l], e.revelado || l === lado));
            return {
              mares,
              restam: [restam(e.mares[0]), restam(e.mares[1])],
              ultimo: e.ultimo,
              podeSortear: lado !== null && !e.revelado && !e.mares[lado].tiros.some(Boolean),
            };
          },
        },
        aleatorio,
      );
      const jogo = mesa.comecar(ctx, opcoes);
      if (typeof jogo === 'string') return jogo;
      // A mesa acaba também pelo prazo e por desistência, que as regras não veem: no fim, qualquer que seja o motivo,
      // os navios aparecem para todos.
      const comFim: Jogo = {
        ...jogo,
        publico(quem) {
          const vista = jogo.publico(quem);
          if (vista.fase === 'fim' && estado && !estado.revelado) {
            estado.revelado = true;
            return jogo.publico(quem);
          }
          return vista;
        },
      };
      return comFim;
    },
  };
}

export const naval = criarNaval();
