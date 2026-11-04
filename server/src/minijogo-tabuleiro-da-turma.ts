/**
 * O TABULEIRO DA TURMA (03/11/2026): o jogo de tabuleiro de festa, no espírito dos de console — SÓ A MECÂNICA (dado, casas,
 * a cenoura dourada para comprar, um microjogo entre as rodadas), nada de nome, personagem, arte ou som de ninguém. O
 * tabuleiro é desenhado por código no site (JogoTabuleiro.tsx), uma volta de 30 casas numa horta.
 *
 * POR TURNOS, e por isso a rede não pesa: cada um, na sua vez, pede o dado (QUEM SORTEIA É O SERVIDOR), anda, e a casa age
 * (+3 cenouras, −3, um evento). Passar pela cenoura dourada com 20 cenouras deixa comprá-la, e ela muda de casa. Depois que
 * todo mundo andou, a turma joga JUNTA um microjogo da Festa dos coelhos (a mesma rodada, com a mesma conferência:
 * rodadaDeFesta, em minijogo-festa.ts), e a posição dá cenouras (10, 6, 4, 2). Ganha quem tiver mais cenouras douradas;
 * depois, mais cenouras; empatados dividem.
 *
 * NINGUÉM SEGURA A TURMA: a vez tem 20 s, e quem não joga nesse tempo tem o dado jogado por ele (na loja, compra se der). Quem
 * saiu da sala é pulado; com menos de 2 na sala, a partida acaba sem troféu.
 *
 * O QUE O CONSOLE CONSEGUE: no tabuleiro, nada além de jogar na própria vez — o dado, a casa e o evento são do servidor, e a
 * única escolha (comprar ou não) só vale para quem está na vez, na loja. No microjogo, o mesmo que na Festa (ver lá).
 *
 * OS TROFÉUS: o pódio (até o 3º, empatados dividem) de quem esteve na sala em todas as vezes e microjogos até o fim, com 2 ou
 * mais, vai para a estante do quarto (corrida_trofeus, "pista" 'tabuleiro', os pontos são as cenouras douradas).
 */
import * as db from './db.js';
import { rodadaDeFesta, MICROJOGOS, type Microjogo, type RodadaDeFesta } from './minijogo-festa.js';
import { embaralhar, type Definicao } from './minijogo-motor.js';

/** As casas, na ordem da volta: 'i' a largada, '+' ganha 3, '-' perde 3, '?' um evento. */
export const CASAS = 'i++-+?++-+?+++-?++-++?++-+?+-+'.split('') as ('i' | '+' | '-' | '?')[];
export const RODADAS_DO_TABULEIRO = [5, 10, 15];
export const MAXIMO_DO_TABULEIRO = 8;
export const CENOURAS_INICIAIS = 10;
export const PRECO_DA_DOURADA = 20;
export const GANHO = 3;
export const PERDA = 3;
/** Os pontos do microjogo pela posição, em cenouras. */
export const CENOURAS_DO_MICROJOGO = [10, 6, 4, 2];
/** A vez: quem não joga o dado nesse tempo tem o dado jogado por ele. */
export const TEMPO_DA_VEZ = 20_000;
/** A loja: sem resposta, compra (é o que quem pode comprar quer). */
export const TEMPO_DA_LOJA = 12_000;
/** O andar na tela: cada casa, e o efeito no fim. */
export const PASSO_MS = 280;
export const EFEITO_MS = 1800;
/** Os eventos da casa '?'. */
export const EVENTOS = ['chuva', 'troca', 'achado'] as const;
export const CHUVA = 2;
export const ACHADO = 5;

export type Efeito =
  | { tipo: 'mais' | 'menos' | 'chuva' | 'achado'; valor: number }
  | { tipo: 'troca'; com: number }
  | { tipo: 'nada' };

interface Peca {
  userId: number;
  pos: number;
  cenouras: number;
  douradas: number;
}

export interface OpcoesDoTabuleiro {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: as cenouras de cada um no começo, onde está a dourada, e a ordem dos microjogos. */
  cenourasIniciais?: number;
  dourada?: number;
  microjogos?: Microjogo[];
}

export const tabuleiroDaTurma: Definicao = criarTabuleiro();

export function criarTabuleiro({ agora = Date.now, aleatorio = Math.random, cenourasIniciais = CENOURAS_INICIAIS, dourada: douradaDoTeste, microjogos }: OpcoesDoTabuleiro = {}): Definicao {
  return {
    minimo: 2,
    // passando de 8, as rotas deixam jogar os primeiros que aceitaram; o resto assiste e não conta como quem jogou
    maximo: MAXIMO_DO_TABULEIRO,
    comecar(ctx, { naSala, corpo }) {
      if (naSala.length < 2) return 'Ainda falta gente para começar.';
      const rodadas = RODADAS_DO_TABULEIRO.includes(Number(corpo.rodadas)) ? Number(corpo.rodadas) : 10;
      const inteiro = (n: number) => Math.floor(aleatorio() * n);
      // a ordem da vez é sorteada (o corte em 8 já vem das rotas, pelo `maximo`; este é só a garantia)
      const ordem = embaralhar(naSala.slice(0, MAXIMO_DO_TABULEIRO), aleatorio);
      const pecas = new Map<number, Peca>(ordem.map((userId) => [userId, { userId, pos: 0, cenouras: cenourasIniciais, douradas: 0 }]));
      const avatares = new Map(ordem.map((id) => [id, db.findUserById(id)?.avatarPronto ?? null]));
      const evento = `tabuleiro-${ctx.comunidade ?? 0}-${agora()}`;
      /** Uma casa nova para a dourada: nunca a largada, nunca a de agora. */
      const novaDourada = (antes: number) => {
        let c = 1 + inteiro(CASAS.length - 1);
        if (c === antes) c = 1 + (c % (CASAS.length - 1));
        return c;
      };
      let dourada = douradaDoTeste ?? novaDourada(0);
      let rodada = 1;
      let fase: 'vez' | 'loja' | 'andando' | 'minijogo' | 'fim' = 'vez';
      /** Quem está na vez (índice em `ordem`). */
      let indice = 0;
      /** A loja: as casas que faltam andar depois da decisão. */
      let pendente = 0;
      /** A loja já apareceu nesta vez (uma por vez: a dourada que muda para a frente não se compra de novo), e se comprou. */
      let lojaFeita = false;
      let comprou = false;
      /**
       * O último andar. `antes` é o tabuleiro de quando a peça saiu (as contas, as posições e a dourada): a tela mostra isso
       * enquanto a peça anda, e só o resultado quando ela chega (senão o placar e a dourada correriam na frente da peça).
       */
      let ultimo: {
        id: number;
        userId: number;
        dado: number;
        caminho: number[];
        efeito: Efeito | null;
        comprou: boolean;
        antes: { dourada: number; pecas: { userId: number; pos: number; cenouras: number; douradas: number }[] };
      } | null = null;
      let idDoUltimo = 0;
      let mini: RodadaDeFesta | null = null;
      let saco: Microjogo[] = microjogos ? [...microjogos] : [];
      /** Quem esteve na sala em todas as vezes e microjogos: só eles levam troféu. */
      const ficaram = new Set(ordem);
      let interrompida = false;

      const presentes = () => {
        const sala = new Set(ctx.naSala());
        return ordem.filter((id) => sala.has(id));
      };
      const anotarAusentes = (aqui: number[]) => {
        for (const id of [...ficaram]) if (!aqui.includes(id)) ficaram.delete(id);
      };
      /** Com menos de 2 na sala, a partida acaba (sem troféu). Devolve true se acabou. */
      const faltouGente = (aqui: number[]) => {
        if (aqui.length >= 2) return false;
        interrompida = true;
        terminar();
        return true;
      };

      const daVez = () => ordem[indice];

      /** A vez de alguém (o índice já aponta para a pessoa): quem não está na sala é pulado. */
      const comecarVez = () => {
        const aqui = presentes();
        anotarAusentes(aqui);
        if (faltouGente(aqui)) return;
        while (indice < ordem.length && !aqui.includes(ordem[indice])) indice++;
        if (indice >= ordem.length) return comecarMinijogo();
        fase = 'vez';
        lojaFeita = false;
        comprou = false;
        pendente = 0;
        ctx.agendar(TEMPO_DA_VEZ, () => jogarDado(daVez()));
        ctx.avisar();
      };

      const proximaVez = () => {
        indice++;
        comecarVez();
      };

      /** Anda `passos` casas a partir da peça; para na dourada se der para comprar. */
      const andar = (peca: Peca, passos: number, dado: number) => {
        const antes = { dourada, pecas: ordem.map((id) => ({ ...pecas.get(id)! })) };
        const caminho = [peca.pos];
        let resta = passos;
        while (resta > 0) {
          peca.pos = (peca.pos + 1) % CASAS.length;
          caminho.push(peca.pos);
          resta--;
          if (peca.pos === dourada && !lojaFeita && peca.cenouras >= PRECO_DA_DOURADA) {
            pendente = resta;
            ultimo = { id: ++idDoUltimo, userId: peca.userId, dado, caminho, efeito: null, comprou: false, antes };
            fase = 'loja';
            ctx.agendar(caminho.length * PASSO_MS + TEMPO_DA_LOJA, () => decidir(peca.userId, true));
            ctx.avisar();
            return;
          }
        }
        // chegou: a casa age (quem para na casa da dourada, comprando ou não, não ganha nem perde)
        const efeito: Efeito = peca.pos === dourada || (passos === 0 && lojaFeita) ? { tipo: 'nada' } : agirCasa(peca);
        ultimo = { id: ++idDoUltimo, userId: peca.userId, dado, caminho, efeito, comprou, antes };
        fase = 'andando';
        ctx.agendar((caminho.length - 1) * PASSO_MS + EFEITO_MS, proximaVez);
        ctx.avisar();
      };

      const agirCasa = (peca: Peca): Efeito => {
        switch (CASAS[peca.pos]) {
          case '+':
            peca.cenouras += GANHO;
            return { tipo: 'mais', valor: GANHO };
          case '-': {
            const perdeu = Math.min(PERDA, peca.cenouras);
            peca.cenouras -= perdeu;
            // sem cenouras, não há o que perder: nada de "−0" na tela
            return perdeu ? { tipo: 'menos', valor: perdeu } : { tipo: 'nada' };
          }
          case '?': {
            const outros = presentes().filter((id) => id !== peca.userId);
            let e = EVENTOS[inteiro(EVENTOS.length)];
            if (e === 'troca' && !outros.length) e = 'achado';
            if (e === 'chuva') {
              for (const id of presentes()) pecas.get(id)!.cenouras += CHUVA;
              return { tipo: 'chuva', valor: CHUVA };
            }
            if (e === 'troca') {
              const outra = pecas.get(outros[inteiro(outros.length)])!;
              [peca.pos, outra.pos] = [outra.pos, peca.pos];
              return { tipo: 'troca', com: outra.userId };
            }
            peca.cenouras += ACHADO;
            return { tipo: 'achado', valor: ACHADO };
          }
          default:
            return { tipo: 'nada' };
        }
      };

      const jogarDado = (quem: number) => {
        if (fase !== 'vez' || quem !== daVez()) return;
        const dado = 1 + inteiro(6);
        andar(pecas.get(quem)!, dado, dado);
      };

      const decidir = (quem: number, comprar: boolean) => {
        if (fase !== 'loja' || quem !== daVez()) return;
        const peca = pecas.get(quem)!;
        const dado = ultimo?.dado ?? 0;
        lojaFeita = true;
        if (comprar && peca.cenouras >= PRECO_DA_DOURADA) {
          peca.cenouras -= PRECO_DA_DOURADA;
          peca.douradas++;
          comprou = true;
          dourada = novaDourada(dourada);
        }
        // o resto do caminho (a tela diz "comprou" junto do efeito)
        andar(peca, pendente, dado);
      };

      const comecarMinijogo = () => {
        if (!saco.length) saco = embaralhar([...MICROJOGOS], aleatorio);
        const micro = saco.shift()!;
        fase = 'minijogo';
        mini = rodadaDeFesta({
          ctx,
          microjogo: micro,
          inscritos: ordem,
          agora,
          aleatorio,
          pontos: CENOURAS_DO_MICROJOGO,
          aoRevelar: (linhas, sala) => {
            anotarAusentes(ordem.filter((id) => sala.has(id)));
            for (const l of linhas) if (l.pontos) pecas.get(l.userId)!.cenouras += l.pontos;
          },
          aoAcabar: () => {
            mini = null;
            if (rodada >= rodadas) return terminar();
            rodada++;
            indice = 0;
            comecarVez();
          },
        });
      };

      /** A ordem final: mais douradas, depois mais cenouras; empatados dividem a posição. */
      const classificacao = (ids: number[]) => {
        const lista = ids.map((id) => pecas.get(id)!);
        const melhor = (a: Peca, b: Peca) => b.douradas - a.douradas || b.cenouras - a.cenouras;
        return lista
          .map((p) => ({ ...p, posicao: 1 + lista.filter((o) => melhor(o, p) < 0).length }))
          .sort((a, b) => a.posicao - b.posicao || ctx.nome(a.userId).localeCompare(ctx.nome(b.userId)));
      };

      /**
       * A classificação que a tela mostra. No fim, só quem ficou até o fim tem posição (as mesmas dos troféus), e quem saiu
       * vem depois, sem posição; na partida interrompida, ninguém tem posição. Durante a partida, todos.
       */
      const classificacaoPublica = () => {
        // `saiu` é por linha (revisão independente, 03/11/2026): com menos de 2 até o fim, a tela dizia "Saiu antes do fim" de
        // todo mundo, inclusive de quem nunca saiu
        const linha = (l: Peca, posicao: number | null) => ({
          userId: l.userId,
          username: ctx.nome(l.userId),
          douradas: l.douradas,
          cenouras: l.cenouras,
          posicao,
          saiu: fase === 'fim' && !interrompida && !ficaram.has(l.userId),
        });
        if (fase !== 'fim') return classificacao(ordem).map((l) => linha(l, l.posicao));
        // (com menos de 2 que ficaram, não há pódio: o mesmo corte dos troféus)
        const turma = interrompida ? [] : ordem.filter((id) => ficaram.has(id));
        const comPosicao = turma.length >= 2 ? turma : [];
        const ranking = comPosicao.length ? classificacao(comPosicao).map((l) => linha(l, l.posicao)) : [];
        const resto = classificacao(ordem.filter((id) => !comPosicao.includes(id))).map((l) => linha(l, null));
        return [...ranking, ...resto];
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        mini = null;
        if (!interrompida) {
          anotarAusentes(presentes());
          const turma = ordem.filter((id) => ficaram.has(id));
          if (turma.length >= 2) {
            for (const l of classificacao(turma)) {
              if (l.posicao > 3 || (l.douradas <= 0 && l.cenouras <= 0)) continue;
              db.guardarTrofeu({
                userId: l.userId,
                evento,
                communityId: ctx.comunidade ?? 0,
                pista: 'tabuleiro',
                posicao: l.posicao,
                tempoMs: null,
                pontos: l.douradas,
                rivais: turma.filter((id) => id !== l.userId),
              });
            }
          }
        }
        // a interrompida não conta como partida completa no painel de uso
        ctx.terminar(!interrompida);
      };

      comecarVez();

      return {
        publico(quem) {
          const sala = new Set(ctx.naSala());
          return {
            fase,
            rodada,
            rodadas,
            casas: CASAS,
            dourada,
            preco: PRECO_DA_DOURADA,
            vez: fase === 'vez' || fase === 'loja' || fase === 'andando' ? daVez() : null,
            participantes: ordem.map((userId) => {
              const p = pecas.get(userId)!;
              return { userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null, pos: p.pos, cenouras: p.cenouras, douradas: p.douradas, presente: sala.has(userId) };
            }),
            ultimo,
            // o microjogo: a rodada da Festa, com o número da rodada do tabuleiro (a tela é montada de novo a cada uma)
            mini: mini ? { ...mini.publico(quem), rodada } : null,
            classificacao: classificacaoPublica(),
            interrompida,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (!ordem.includes(quem)) return 'Você está assistindo esta partida.';
          // o eco é a medida da rede do microjogo (minijogo-festa.ts): nunca é erro, nem fora dele
          if (corpo.tipo === 'eco') return fase === 'minijogo' && mini ? mini.acao(quem, corpo) : null;
          if (corpo.tipo === 'resultado' || corpo.tipo === 'acerto') {
            if (fase !== 'minijogo' || !mini) return 'Esta rodada já acabou.';
            return mini.acao(quem, corpo);
          }
          if (corpo.tipo === 'dado') {
            if (fase !== 'vez') return 'A partida não está em andamento.';
            if (quem !== daVez()) return 'Espere a sua vez.';
            jogarDado(quem);
            return null;
          }
          if (corpo.tipo === 'comprar') {
            if (fase !== 'loja') return 'A partida não está em andamento.';
            if (quem !== daVez()) return 'Espere a sua vez.';
            decidir(quem, corpo.sim === true);
            return null;
          }
          return 'Ação desconhecida.';
        },
        conferir() {
          if (fase === 'fim') return;
          const aqui = presentes();
          if (faltouGente(aqui)) return;
          if (fase === 'minijogo') return mini?.conferir();
          // quem está na vez saiu da sala: a vez passa (na loja, sem comprar, para não gastar as cenouras de quem não está)
          if ((fase === 'vez' || fase === 'loja') && !aqui.includes(daVez())) {
            ficaram.delete(daVez());
            if (fase === 'loja') decidir(daVez(), false);
            else proximaVez();
          }
        },
      };
    },
  };
}
