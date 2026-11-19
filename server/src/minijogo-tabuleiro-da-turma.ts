/**
 * O TABULEIRO DA TURMA (03/11/2026): o jogo de tabuleiro de festa, no espírito dos de console — SÓ A MECÂNICA (dado, casas,
 * a cenoura dourada para comprar, um microjogo entre as rodadas), nada de nome, personagem, arte ou som de ninguém. O
 * tabuleiro é desenhado por código no site (JogoTabuleiro.tsx e tabuleiro3d/), uma volta de 30 casas numa horta.
 *
 * POR TURNOS, e por isso a rede não pesa: cada um, na sua vez, pede o dado (QUEM SORTEIA É O SERVIDOR), anda, e a casa age.
 * Passar pela cenoura dourada com 20 cenouras deixa comprá-la, e ela muda de casa. Depois que todo mundo andou, a turma joga
 * JUNTA um microjogo da Festa dos coelhos (a mesma rodada, com a mesma conferência: rodadaDeFesta, em minijogo-festa.ts), e a
 * posição dá cenouras (10, 6, 4, 2). Ganha quem tiver mais cenouras douradas; depois, mais cenouras; empatados dividem.
 *
 * O QUE ENTROU EM 19/11/2026 (pedido dele, a auditoria dos mini-games), tudo do lado do servidor, como o dado:
 * - AS CASAS NOVAS: a LOJA ('$', comprar itens com cenouras) e o DUELO ('d': quem para escolhe alguém, os dois jogam um
 *   microjogo de dois, e quem ganha leva DUELO cenouras do outro — cenouras do jogo, nada de dinheiro, nada apostado: o valor é
 *   fixo). E mais quatro eventos na casa '?': o vento leva a dourada, a praga, o mutirão (a turma divide as cenouras por igual)
 *   e o brinde (um item de graça).
 * - OS ITENS (no máximo MAXIMO_DE_ITENS por pessoa), usados na própria vez, ANTES do dado, um por vez: o dado duplo, o dado
 *   escolhido (1 a 6), a troca de lugar com alguém, o ímã (a dourada vem para 4 casas à frente) e o escudo (sozinho: segura a
 *   próxima perda de uma casa '−' ou da praga). Os robôs compram e usam.
 * - DUAS BIFURCAÇÕES (RAMAIS): passando pela casa `de`, quem anda escolhe seguir a volta ou pegar o ramal, que volta à volta na
 *   casa `ate`. Os dois caminhos têm o mesmo tamanho; muda o que há neles (e onde está a dourada).
 * - O FORMATO DO MICROJOGO pela cor da casa onde cada um parou (só com 4 na partida): a verde ('+') é de um lado, a vermelha
 *   ('−') do outro, e as outras sorteiam. Dois e dois dá o 2 contra 2; um e três dá o 1 contra 3; o resto, todos contra todos.
 *   Os microjogos de equipe já existiam (colheita e remada em duplas; onda e ladeira de um contra três): o servidor impõe as
 *   equipes (OpcoesDaRodada.equipes).
 * - A RETA FINAL: nas 3 últimas rodadas, as casas e os eventos valem o dobro, com o aviso antes.
 * - OS PRÊMIOS BÔNUS, revelados no fim: quem mais ganhou microjogos, quem mais andou e quem mais caiu em evento ganham uma
 *   dourada cada (empatados ganham todos; com zero, ninguém).
 *
 * NINGUÉM SEGURA A TURMA: toda escolha tem tempo (o dado sai sozinho, a loja da dourada compra, o caminho segue a volta, a loja
 * de itens não compra, o duelo sorteia o adversário). Quem saiu da sala é pulado; com menos de 2 na sala, a partida acaba sem
 * troféu.
 *
 * O QUE O CONSOLE CONSEGUE: no tabuleiro, nada além de jogar na própria vez — o dado, as casas, os eventos e o que cada item faz
 * são do servidor, e as escolhas (comprar, o caminho, o item, o adversário) só valem para quem está na vez e só entre as que o
 * servidor oferece. No microjogo e no duelo, o mesmo que na Festa (ver lá).
 *
 * OS TROFÉUS: o pódio (até o 3º, empatados dividem) de quem esteve na sala em todas as vezes e microjogos até o fim, com 2 ou
 * mais, vai para a estante do quarto (corrida_trofeus, "pista" 'tabuleiro', os pontos são as cenouras douradas, já com os
 * prêmios bônus).
 *
 * NO SOLO, CONTRA O COMPUTADOR (pedido dele, 05/11/2026): de 1 a 5 robôs (minijogo-robos.ts). Na vez, o robô usa um item quando
 * ajuda, joga o dado depois de uma pausa curta e compra a dourada sempre que pode; no microjogo, o resultado dele é sorteado
 * numa faixa de quem joga bem (resultadoDoRobo, em minijogo-festa.ts). Contra o computador não há troféu.
 */
import * as db from './db.js';
import { microjogoDe, rodadaDeFesta, MICROJOGOS, type Microjogo, type RodadaDeFesta } from './minijogo-festa.js';
import { embaralhar, type Definicao } from './minijogo-motor.js';
import { comRobos, ehRobo, idsDosRobos, PAUSA_DO_ROBO, quantosRobos } from './minijogo-robos.js';

export type TipoDeCasa = 'i' | '+' | '-' | '?' | '$' | 'd';
/**
 * As casas da VOLTA, na ordem: 'i' a largada, '+' ganha 3, '-' perde 3, '?' um evento, '$' a loja de itens, 'd' o duelo.
 * (As quatro primeiras depois da largada são as de sempre: os testes andam por elas.)
 */
export const CASAS = 'i++-+?+$-+?+d+-?++-$+?+-+?+d-+'.split('') as TipoDeCasa[];
/** O tamanho da volta (as casas dos ramais vêm depois, de VOLTA em diante). */
export const VOLTA = CASAS.length;
/**
 * AS BIFURCAÇÕES: passando por `de`, escolhe-se seguir a volta ou o ramal, que entra de novo na volta em `ate`. O ramal tem o
 * mesmo número de casas que o trecho da volta que ele pula. As casas do ramal são numeradas depois das da volta, na ordem dos
 * ramais (o site desenha cada uma ao lado da casa da volta que ela acompanha).
 */
export const RAMAIS: { de: number; ate: number; casas: TipoDeCasa[] }[] = [
  { de: 5, ate: 10, casas: ['+', '?', '+', '+'] },
  { de: 20, ate: 25, casas: ['-', '$', '+', '-'] },
];
/** Todas as casas: a volta e depois os ramais. */
export const TODAS_AS_CASAS: TipoDeCasa[] = [...CASAS, ...RAMAIS.flatMap((r) => r.casas)];
/** Onde começa cada ramal na numeração de TODAS_AS_CASAS. */
export const INICIO_DOS_RAMAIS = RAMAIS.map((_, k) => VOLTA + RAMAIS.slice(0, k).reduce((s, r) => s + r.casas.length, 0));

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
/** A loja da dourada: sem resposta, compra (é o que quem pode comprar quer). */
export const TEMPO_DA_LOJA = 12_000;
/** A bifurcação: sem resposta, segue a volta. */
export const TEMPO_DO_CAMINHO = 10_000;
/** A loja de itens: sem resposta, não compra. */
export const TEMPO_DOS_ITENS = 12_000;
/** O duelo: sem resposta, o adversário é sorteado. */
export const TEMPO_DO_DUELO = 12_000;
/** O andar na tela: cada casa, e o efeito no fim. */
export const PASSO_MS = 280;
export const EFEITO_MS = 1800;
/** O aviso da reta final, antes da primeira vez dela. */
export const RETA_MS = 3000;
/** As últimas rodadas que valem o dobro. */
export const RODADAS_DA_RETA = 3;
/** A revelação de cada prêmio bônus, e o respiro no fim. */
export const PREMIO_MS = 2500;
export const PREMIOS_FIM_MS = 2000;
/** Os eventos da casa '?'. */
export const EVENTOS = ['chuva', 'troca', 'achado', 'vento', 'praga', 'mutirao', 'brinde'] as const;
export const CHUVA = 2;
export const ACHADO = 5;
export const PRAGA = 5;
/** Quantas cenouras o vencedor do duelo leva do outro (fixo: ninguém escolhe quanto). */
export const DUELO = 5;
/** Os itens e o preço de cada um, em cenouras. */
export const ITENS = ['duplo', 'escolhido', 'troca', 'ima', 'escudo'] as const;
export type Item = (typeof ITENS)[number];
export const PRECOS_DOS_ITENS: Record<Item, number> = { duplo: 6, escolhido: 8, troca: 5, ima: 10, escudo: 4 };
export const MAXIMO_DE_ITENS = 3;
/** Quantas casas à frente o ímã põe a dourada. */
export const IMA_CASAS = 4;
/** Os microjogos de cada formato (os de equipe que já existiam; o teste confere que têm equipes). */
export const MICROJOGOS_2X2 = ['colheita', 'remada'];
export const MICROJOGOS_1X3 = ['onda', 'ladeira'];
export const PREMIOS = ['microjogos', 'andarilho', 'eventos'] as const;
export type Premio = (typeof PREMIOS)[number];

export type Formato = 'todos' | '2x2' | '1x3';

export type Efeito =
  | { tipo: 'mais' | 'menos' | 'chuva' | 'achado' | 'praga' | 'mutirao'; valor: number }
  | { tipo: 'troca'; com: number }
  | { tipo: 'brinde'; item: Item }
  | { tipo: 'vento' | 'escudo' | 'nada' };

interface Peca {
  userId: number;
  pos: number;
  cenouras: number;
  douradas: number;
  itens: Item[];
  /** Para os prêmios bônus. */
  vitorias: number;
  andadas: number;
  eventos: number;
}

export interface OpcoesDoTabuleiro {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: as cenouras de cada um no começo, onde está a dourada, e a ordem dos microjogos. */
  cenourasIniciais?: number;
  dourada?: number;
  microjogos?: Microjogo[];
  /** Para o teste: os itens de cada um no começo. */
  itensIniciais?: Item[];
  /** Para o teste: o microjogo dos duelos. */
  duelos?: Microjogo[];
}

/** O ramal que sai da casa `pos`, se houver. */
export const ramalEm = (pos: number) => RAMAIS.findIndex((r) => r.de === pos);

/** A casa seguinte: na volta, a próxima; no ramal, a próxima dele, e da última volta-se à volta em `ate`. Na bifurcação, `ramal` decide. */
export function proximaCasa(pos: number, ramal = false): number {
  if (pos < VOLTA) {
    const k = ramalEm(pos);
    if (ramal && k >= 0) return INICIO_DOS_RAMAIS[k];
    return (pos + 1) % VOLTA;
  }
  const k = INICIO_DOS_RAMAIS.findLastIndex((i) => pos >= i);
  const fim = INICIO_DOS_RAMAIS[k] + RAMAIS[k].casas.length - 1;
  return pos < fim ? pos + 1 : RAMAIS[k].ate;
}

/** Quantas casas de `de` até `alvo`, seguindo a volta (e o ramal, se `de` está nele); `pelo` decide a primeira bifurcação. */
export function distancia(de: number, alvo: number, pelo: boolean | null = null): number {
  let pos = de;
  let primeira = pelo;
  for (let n = 1; n <= TODAS_AS_CASAS.length * 2; n++) {
    const usar = ramalEm(pos) >= 0 && primeira !== null ? primeira : false;
    if (ramalEm(pos) >= 0) primeira = null;
    pos = proximaCasa(pos, usar);
    if (pos === alvo) return n;
  }
  return Infinity;
}

/**
 * O FORMATO DO MICROJOGO pelas cores (0: a casa verde, 1: a vermelha), uma por pessoa, na ordem: só com 4, dois e dois é o
 * 2 contra 2 e um e três é o 1 contra 3. Devolve o formato e as equipes (no 1 contra 3, o solitário primeiro).
 */
export function formatoDaRodada(ids: number[], cores: number[]): { formato: Formato; equipes: number[][] | null } {
  if (ids.length !== 4 || cores.length !== 4) return { formato: 'todos', equipes: null };
  const verdes = ids.filter((_, i) => cores[i] === 0);
  const vermelhos = ids.filter((_, i) => cores[i] !== 0);
  if (verdes.length === 2) return { formato: '2x2', equipes: [verdes, vermelhos] };
  if (verdes.length === 1) return { formato: '1x3', equipes: [verdes, vermelhos] };
  if (vermelhos.length === 1) return { formato: '1x3', equipes: [vermelhos, verdes] };
  return { formato: 'todos', equipes: null };
}

export const tabuleiroDaTurma: Definicao = criarTabuleiro();

export function criarTabuleiro({
  agora = Date.now,
  aleatorio = Math.random,
  cenourasIniciais = CENOURAS_INICIAIS,
  dourada: douradaDoTeste,
  microjogos,
  itensIniciais = [],
  duelos,
}: OpcoesDoTabuleiro = {}): Definicao {
  return {
    minimo: 2,
    // passando de 8, as rotas deixam jogar os primeiros que aceitaram; o resto assiste e não conta como quem jogou
    maximo: MAXIMO_DO_TABULEIRO,
    comecar(ctxDaSala, { naSala: naSalaDaSala, corpo }) {
      // os robôs só no Solo, e estão sempre na sala
      const robos = idsDosRobos(quantosRobos(ctxDaSala, corpo));
      const ctx = comRobos(ctxDaSala, robos);
      const naSala = [...naSalaDaSala.slice(0, MAXIMO_DO_TABULEIRO - robos.length), ...robos];
      if (naSala.length < 2) return 'Ainda falta gente para começar.';
      const rodadas = RODADAS_DO_TABULEIRO.includes(Number(corpo.rodadas)) ? Number(corpo.rodadas) : 10;
      const inteiro = (n: number) => Math.floor(aleatorio() * n);
      // a ordem da vez é sorteada (o corte em 8 já vem das rotas, pelo `maximo`; este é só a garantia)
      const ordem = embaralhar(naSala.slice(0, MAXIMO_DO_TABULEIRO), aleatorio);
      const pecas = new Map<number, Peca>(
        ordem.map((userId) => [userId, { userId, pos: 0, cenouras: cenourasIniciais, douradas: 0, itens: [...itensIniciais], vitorias: 0, andadas: 0, eventos: 0 }]),
      );
      const avatares = new Map(ordem.map((id) => [id, ehRobo(id) ? null : db.avatarDoJogo(id)]));
      const evento = `tabuleiro-${ctx.comunidade ?? 0}-${agora()}`;
      /** Uma casa nova para a dourada: sempre na volta, nunca a largada, nunca a de agora. */
      const novaDourada = (antes: number) => {
        let c = 1 + inteiro(VOLTA - 1);
        if (c === antes) c = 1 + (c % (VOLTA - 1));
        return c;
      };
      let dourada = douradaDoTeste ?? novaDourada(0);
      let rodada = 1;
      let fase: 'vez' | 'caminho' | 'loja' | 'andando' | 'itens' | 'duelo' | 'duelo-jogo' | 'minijogo' | 'reta' | 'premios' | 'fim' = 'vez';
      /** Quem está na vez (índice em `ordem`). */
      let indice = 0;
      /** As casas que faltam andar depois de uma parada no meio (a loja da dourada, a bifurcação). */
      let pendente = 0;
      /** A loja da dourada já apareceu nesta vez (uma por vez), e se comprou. */
      let lojaFeita = false;
      let comprou = false;
      /** A escolha da bifurcação, para o próximo passo (null: ainda não escolheu). */
      let escolhaDoCaminho: boolean | null = null;
      /** O item usado nesta vez (um por vez), para a tela dizer. */
      let usado: { userId: number; item: Item; alvo?: number; casa?: number } | null = null;
      /** O item comprado na loja desta vez. */
      let compra: Item | null = null;
      /** A casa onde cada um parou nesta rodada (o formato do microjogo). */
      const paradas = new Map<number, TipoDeCasa>();
      /** O duelo desta vez. */
      let duelo: { de: number; contra: number | null; vencedor: number | null; valor: number } | null = null;
      let formato: Formato = 'todos';
      let premios: { tipo: Premio; ganhadores: number[]; valor: number }[] = [];
      /**
       * O último andar. `antes` é o tabuleiro de quando a peça saiu (as contas, as posições e a dourada): a tela mostra isso
       * enquanto a peça anda, e só o resultado quando ela chega (senão o placar e a dourada correriam na frente da peça).
       */
      let ultimo: {
        id: number;
        userId: number;
        dado: number;
        /** Os dados que saíram (dois, no dado duplo). */
        dados: number[];
        /** O dado escolhido (o item). */
        escolhido: boolean;
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

      const reta = () => rodada > rodadas - RODADAS_DA_RETA;
      const dobro = () => (reta() ? 2 : 1);

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
        escolhaDoCaminho = null;
        usado = null;
        compra = null;
        duelo = null;
        const quem = daVez();
        ctx.agendar(ehRobo(quem) ? PAUSA_DO_ROBO : TEMPO_DA_VEZ, () => (ehRobo(quem) ? vezDoRobo(quem) : jogarDado(quem)));
        ctx.avisar();
      };

      const proximaVez = () => {
        indice++;
        comecarVez();
      };

      /** Uma rodada nova do tabuleiro: na primeira da reta final, o aviso antes. */
      const comecarRodada = () => {
        indice = 0;
        paradas.clear();
        if (rodada === rodadas - RODADAS_DA_RETA + 1 && rodada > 1) {
          fase = 'reta';
          ctx.agendar(RETA_MS, comecarVez);
          ctx.avisar();
          return;
        }
        comecarVez();
      };

      const fotografia = () => ({ dourada, pecas: ordem.map((id) => { const p = pecas.get(id)!; return { userId: id, pos: p.pos, cenouras: p.cenouras, douradas: p.douradas }; }) });

      /** Anda `passos` casas a partir da peça; para na bifurcação (a escolha) e na dourada (se der para comprar). */
      const andar = (peca: Peca, passos: number, dado: number, dados: number[] = [dado], escolhido = false) => {
        const antes = fotografia();
        const caminho = [peca.pos];
        let resta = passos;
        const parar = (proxima: typeof fase, espera: number, depois: () => void) => {
          pendente = resta;
          ultimo = { id: ++idDoUltimo, userId: peca.userId, dado, dados, escolhido, caminho, efeito: null, comprou: false, antes };
          fase = proxima;
          ctx.agendar((caminho.length - 1) * PASSO_MS + espera, depois);
          ctx.avisar();
        };
        while (resta > 0) {
          const k = ramalEm(peca.pos);
          if (k >= 0 && escolhaDoCaminho === null) {
            // a bifurcação: o robô decide depois de a peça chegar; quem não escolhe segue a volta
            const robo = ehRobo(peca.userId);
            return parar('caminho', robo ? PAUSA_DO_ROBO : TEMPO_DO_CAMINHO, () => escolher(peca.userId, robo ? caminhoDoRobo(peca) : false));
          }
          peca.pos = proximaCasa(peca.pos, k >= 0 && escolhaDoCaminho === true);
          escolhaDoCaminho = null;
          caminho.push(peca.pos);
          peca.andadas++;
          resta--;
          if (peca.pos === dourada && !lojaFeita && peca.cenouras >= PRECO_DA_DOURADA) {
            // o robô compra sempre que pode, depois de a peça chegar e de uma pausa
            return parar('loja', ehRobo(peca.userId) ? PAUSA_DO_ROBO : TEMPO_DA_LOJA, () => decidir(peca.userId, true));
          }
        }
        // chegou: a casa age (quem para na casa da dourada, comprando ou não, não ganha nem perde)
        const tipo = TODAS_AS_CASAS[peca.pos];
        paradas.set(peca.userId, tipo);
        const efeito: Efeito = peca.pos === dourada || (passos === 0 && lojaFeita) ? { tipo: 'nada' } : agirCasa(peca);
        ultimo = { id: ++idDoUltimo, userId: peca.userId, dado, dados, escolhido, caminho, efeito, comprou, antes };
        const andarMs = (caminho.length - 1) * PASSO_MS;
        const robo = ehRobo(peca.userId);
        if (tipo === '$' && peca.itens.length < MAXIMO_DE_ITENS && peca.cenouras >= Math.min(...Object.values(PRECOS_DOS_ITENS))) {
          fase = 'itens';
          ctx.agendar(andarMs + (robo ? PAUSA_DO_ROBO : TEMPO_DOS_ITENS), () => comprarItem(peca.userId, robo ? itemDoRobo(peca) : null));
        } else if (tipo === 'd' && presentes().some((id) => id !== peca.userId)) {
          fase = 'duelo';
          duelo = { de: peca.userId, contra: null, vencedor: null, valor: 0 };
          ctx.agendar(andarMs + (robo ? PAUSA_DO_ROBO : TEMPO_DO_DUELO), () => desafiar(peca.userId, robo ? adversarioDoRobo(peca.userId) : sortearAdversario(peca.userId)));
        } else {
          fase = 'andando';
          ctx.agendar(andarMs + EFEITO_MS, proximaVez);
        }
        ctx.avisar();
      };

      /** Perder cenouras: o escudo segura (e se gasta). */
      const perder = (peca: Peca, quanto: number, tipo: 'menos' | 'praga'): Efeito => {
        const i = peca.itens.indexOf('escudo');
        if (i >= 0 && peca.cenouras > 0) {
          peca.itens.splice(i, 1);
          return { tipo: 'escudo' };
        }
        const perdeu = Math.min(quanto, peca.cenouras);
        peca.cenouras -= perdeu;
        // sem cenouras, não há o que perder: nada de "−0" na tela
        return perdeu ? { tipo, valor: perdeu } : { tipo: 'nada' };
      };

      const agirCasa = (peca: Peca): Efeito => {
        const x = dobro();
        switch (TODAS_AS_CASAS[peca.pos]) {
          case '+':
            peca.cenouras += GANHO * x;
            return { tipo: 'mais', valor: GANHO * x };
          case '-':
            return perder(peca, PERDA * x, 'menos');
          case '?': {
            peca.eventos++;
            const outros = presentes().filter((id) => id !== peca.userId);
            let e: (typeof EVENTOS)[number] = EVENTOS[inteiro(EVENTOS.length)];
            if (e === 'troca' && !outros.length) e = 'achado';
            if (e === 'brinde' && peca.itens.length >= MAXIMO_DE_ITENS) e = 'achado';
            switch (e) {
              case 'chuva':
                for (const id of presentes()) pecas.get(id)!.cenouras += CHUVA * x;
                return { tipo: 'chuva', valor: CHUVA * x };
              case 'troca': {
                const outra = pecas.get(outros[inteiro(outros.length)])!;
                [peca.pos, outra.pos] = [outra.pos, peca.pos];
                return { tipo: 'troca', com: outra.userId };
              }
              case 'vento':
                dourada = novaDourada(dourada);
                return { tipo: 'vento' };
              case 'praga':
                return perder(peca, PRAGA * x, 'praga');
              case 'mutirao': {
                // a turma (quem está na sala) divide as cenouras por igual; o que sobra da divisão fica com quem caiu aqui
                const turma = presentes().map((id) => pecas.get(id)!);
                const total = turma.reduce((s, p) => s + p.cenouras, 0);
                const cada = Math.floor(total / turma.length);
                for (const p of turma) p.cenouras = cada;
                peca.cenouras += total - cada * turma.length;
                return { tipo: 'mutirao', valor: cada };
              }
              case 'brinde': {
                const item = ITENS[inteiro(ITENS.length)];
                peca.itens.push(item);
                return { tipo: 'brinde', item };
              }
              default:
                peca.cenouras += ACHADO * x;
                return { tipo: 'achado', valor: ACHADO * x };
            }
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
        const u = ultimo!;
        lojaFeita = true;
        if (comprar && peca.cenouras >= PRECO_DA_DOURADA) {
          peca.cenouras -= PRECO_DA_DOURADA;
          peca.douradas++;
          comprou = true;
          dourada = novaDourada(dourada);
        }
        // o resto do caminho (a tela diz "comprou" junto do efeito)
        andar(peca, pendente, u.dado, u.dados, u.escolhido);
      };

      const escolher = (quem: number, ramal: boolean) => {
        if (fase !== 'caminho' || quem !== daVez()) return;
        const u = ultimo!;
        escolhaDoCaminho = ramal;
        andar(pecas.get(quem)!, pendente, u.dado, u.dados, u.escolhido);
      };

      // —————————————————————————————— os itens ——————————————————————————————

      const comprarItem = (quem: number, item: Item | null) => {
        if (fase !== 'itens' || quem !== daVez()) return;
        const peca = pecas.get(quem)!;
        if (item && peca.itens.length < MAXIMO_DE_ITENS && peca.cenouras >= PRECOS_DOS_ITENS[item]) {
          peca.cenouras -= PRECOS_DOS_ITENS[item];
          peca.itens.push(item);
          compra = item;
        }
        fase = 'andando';
        ctx.agendar(EFEITO_MS, proximaVez);
        ctx.avisar();
      };

      /** Usa um item na vez, antes do dado. Devolve o erro (para a tela), ou null. */
      const usar = (quem: number, item: Item, corpo: Record<string, unknown>): string | null => {
        const peca = pecas.get(quem)!;
        const i = peca.itens.indexOf(item);
        if (i < 0) return 'Você não tem esse item.';
        if (usado) return 'Um item por vez.';
        if (item === 'escudo') return 'O escudo funciona sozinho.';
        if (item === 'escolhido') {
          const n = Number(corpo.valor);
          if (!Number.isInteger(n) || n < 1 || n > 6) return 'Escolha de 1 a 6.';
          peca.itens.splice(i, 1);
          usado = { userId: quem, item };
          andar(peca, n, n, [n], true);
          return null;
        }
        if (item === 'duplo') {
          peca.itens.splice(i, 1);
          usado = { userId: quem, item };
          const a = 1 + inteiro(6);
          const b = 1 + inteiro(6);
          andar(peca, a + b, a + b, [a, b]);
          return null;
        }
        if (item === 'troca') {
          const alvo = Number(corpo.alvo);
          if (alvo === quem || !presentes().includes(alvo)) return 'Escolha com quem trocar.';
          peca.itens.splice(i, 1);
          const outra = pecas.get(alvo)!;
          [peca.pos, outra.pos] = [outra.pos, peca.pos];
          usado = { userId: quem, item, alvo };
          ctx.avisar();
          return null;
        }
        // o ímã: a dourada vem para IMA_CASAS casas à frente, seguindo a volta (nunca na largada)
        peca.itens.splice(i, 1);
        let casa = peca.pos;
        for (let n = 0; n < IMA_CASAS; n++) casa = proximaCasa(casa);
        if (casa >= VOLTA) casa = RAMAIS[INICIO_DOS_RAMAIS.findLastIndex((k) => casa >= k)].ate;
        if (casa === 0) casa = 1;
        dourada = casa;
        usado = { userId: quem, item, casa };
        ctx.avisar();
        return null;
      };

      // —————————————————————————————— o duelo ——————————————————————————————

      const sortearAdversario = (quem: number) => {
        const outros = presentes().filter((id) => id !== quem);
        return outros[inteiro(outros.length)];
      };

      const desafiar = (quem: number, contra: number) => {
        if (fase !== 'duelo' || quem !== daVez() || !duelo) return;
        const outros = presentes().filter((id) => id !== quem);
        if (!outros.length) return proximaVez();
        if (!outros.includes(contra)) contra = outros[0];
        duelo.contra = contra;
        // um microjogo de dois, cada um por si (os de equipe ficam de fora)
        const candidatos = MICROJOGOS.filter((id) => !microjogoDe(id).equipes);
        const micro = duelos?.[0] ?? candidatos[inteiro(candidatos.length)];
        const dois = [quem, contra];
        fase = 'duelo-jogo';
        mini = rodadaDeFesta({
          ctx,
          microjogo: micro,
          inscritos: dois,
          agora,
          aleatorio,
          pontos: [1, 0],
          robos: robos.filter((id) => dois.includes(id)),
          aoRevelar: (linhas) => {
            const primeiros = linhas.filter((l) => l.posicao === 1);
            // empate (os dois em primeiro, ou ninguém): ninguém leva nada
            if (primeiros.length !== 1 || !duelo) return;
            const vencedor = primeiros[0].userId;
            const perdedor = vencedor === quem ? contra : quem;
            const p = pecas.get(perdedor)!;
            const valor = Math.min(DUELO, p.cenouras);
            p.cenouras -= valor;
            pecas.get(vencedor)!.cenouras += valor;
            duelo.vencedor = vencedor;
            duelo.valor = valor;
          },
          aoAcabar: () => {
            mini = null;
            proximaVez();
          },
        });
      };

      // —————————————————————————————— os robôs ——————————————————————————————

      /** O robô: um item, se ajudar; depois o dado. */
      const vezDoRobo = (quem: number) => {
        if (fase !== 'vez' || quem !== daVez()) return;
        const peca = pecas.get(quem)!;
        const ate = distancia(peca.pos, dourada);
        const podeComprar = peca.cenouras >= PRECO_DA_DOURADA;
        const tem = (i: Item) => peca.itens.includes(i);
        if (podeComprar && tem('escolhido') && ate >= 1 && ate <= 6 && usar(quem, 'escolhido', { valor: ate }) === null) return;
        if (podeComprar && tem('ima') && ate > 6) usar(quem, 'ima', {});
        else if (tem('duplo') && distancia(peca.pos, dourada) > 6 && usar(quem, 'duplo', {}) === null) return;
        else if (tem('troca')) {
          // troca com quem está mais perto da dourada, se for bem mais perto
          const melhor = presentes()
            .filter((id) => id !== quem)
            .map((id) => ({ id, d: distancia(pecas.get(id)!.pos, dourada) }))
            .sort((a, b) => a.d - b.d)[0];
          if (podeComprar && melhor && melhor.d + 6 < ate) usar(quem, 'troca', { alvo: melhor.id });
        }
        jogarDado(quem);
      };

      /** O caminho do robô: o que chega antes na dourada. */
      const caminhoDoRobo = (peca: Peca) => distancia(peca.pos, dourada, true) < distancia(peca.pos, dourada, false);

      const itemDoRobo = (peca: Peca): Item | null => {
        const sobra = (i: Item) => peca.cenouras - PRECOS_DOS_ITENS[i];
        for (const i of ['ima', 'duplo', 'escudo'] as Item[]) {
          const minimo = i === 'ima' ? PRECO_DA_DOURADA : 4;
          if (sobra(i) >= minimo) return i;
        }
        return null;
      };

      /** O robô desafia quem tem mais cenouras. */
      const adversarioDoRobo = (quem: number) =>
        presentes()
          .filter((id) => id !== quem)
          .sort((a, b) => pecas.get(b)!.cenouras - pecas.get(a)!.cenouras)[0];

      // —————————————————————————————— o microjogo da rodada ——————————————————————————————

      const comecarMinijogo = () => {
        // o formato pela cor da casa de cada um (só com 4, todos na sala)
        const aqui = presentes();
        const cores = ordem.map((id) => {
          const c = paradas.get(id);
          return c === '+' ? 0 : c === '-' ? 1 : inteiro(2);
        });
        const f = aqui.length === ordem.length ? formatoDaRodada(ordem, cores) : { formato: 'todos' as Formato, equipes: null };
        formato = f.formato;
        let micro: Microjogo;
        if (f.formato === '2x2') micro = MICROJOGOS_2X2[inteiro(MICROJOGOS_2X2.length)];
        else if (f.formato === '1x3') micro = MICROJOGOS_1X3[inteiro(MICROJOGOS_1X3.length)];
        else {
          if (!saco.length) saco = embaralhar([...MICROJOGOS], aleatorio);
          micro = saco.shift()!;
        }
        fase = 'minijogo';
        mini = rodadaDeFesta({
          ctx,
          microjogo: micro,
          inscritos: ordem,
          agora,
          aleatorio,
          pontos: CENOURAS_DO_MICROJOGO,
          robos,
          equipes: f.equipes ?? undefined,
          aoRevelar: (linhas, sala) => {
            anotarAusentes(ordem.filter((id) => sala.has(id)));
            for (const l of linhas) {
              if (l.pontos) pecas.get(l.userId)!.cenouras += l.pontos;
              if (l.posicao === 1) pecas.get(l.userId)!.vitorias++;
            }
          },
          aoAcabar: () => {
            mini = null;
            if (rodada >= rodadas) return comecarPremios();
            rodada++;
            comecarRodada();
          },
        });
      };

      // —————————————————————————————— o fim ——————————————————————————————

      /** OS PRÊMIOS BÔNUS: uma dourada para quem mais fez cada coisa (empatados, todos; com zero, ninguém). */
      const comecarPremios = () => {
        const aqui = presentes();
        anotarAusentes(aqui);
        if (faltouGente(aqui)) return;
        const medida: Record<Premio, (p: Peca) => number> = {
          microjogos: (p) => p.vitorias,
          andarilho: (p) => p.andadas,
          eventos: (p) => p.eventos,
        };
        premios = PREMIOS.map((tipo) => {
          const valores = aqui.map((id) => medida[tipo](pecas.get(id)!));
          const maior = Math.max(...valores);
          const ganhadores = maior > 0 ? aqui.filter((_, i) => valores[i] === maior) : [];
          for (const id of ganhadores) pecas.get(id)!.douradas++;
          return { tipo, ganhadores, valor: maior };
        });
        fase = 'premios';
        ctx.agendar(PREMIOS.length * PREMIO_MS + PREMIOS_FIM_MS, terminar);
        ctx.avisar();
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
        mini?.parar();
        mini = null;
        // contra o computador não há troféu: o troféu é um registro de um momento entre amigos
        if (!interrompida && !robos.length) {
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

      /** A vez de quem saiu da sala no meio de uma escolha: a escolha que não gasta nada. */
      const desistir = () => {
        const quem = daVez();
        ficaram.delete(quem);
        if (fase === 'loja') decidir(quem, false);
        else if (fase === 'caminho') escolher(quem, false);
        else if (fase === 'itens') comprarItem(quem, null);
        else proximaVez();
      };

      const naVez = ['vez', 'caminho', 'loja', 'andando', 'itens', 'duelo', 'duelo-jogo'];

      return {
        publico(quem) {
          const sala = new Set(ctx.naSala());
          return {
            fase,
            rodada,
            rodadas,
            casas: TODAS_AS_CASAS,
            volta: VOLTA,
            ramais: RAMAIS.map((r, k) => ({ de: r.de, ate: r.ate, inicio: INICIO_DOS_RAMAIS[k], tamanho: r.casas.length })),
            dourada,
            preco: PRECO_DA_DOURADA,
            precos: PRECOS_DOS_ITENS,
            maximoDeItens: MAXIMO_DE_ITENS,
            retaFinal: reta(),
            vez: naVez.includes(fase) ? daVez() : null,
            participantes: ordem.map((userId) => {
              const p = pecas.get(userId)!;
              return {
                userId,
                username: ctx.nome(userId),
                avatar: avatares.get(userId) ?? null,
                pos: p.pos,
                cenouras: p.cenouras,
                douradas: p.douradas,
                itens: [...p.itens],
                presente: sala.has(userId),
              };
            }),
            ultimo,
            usado,
            compra,
            duelo,
            premios: fase === 'premios' || fase === 'fim' ? premios : null,
            // o microjogo: a rodada da Festa, com o número da rodada do tabuleiro (a tela é montada de novo a cada uma), quem
            // joga (no duelo, só os dois) e o formato
            mini: mini
              ? {
                  ...mini.publico(quem),
                  rodada: fase === 'duelo-jogo' ? rodada * 100 + idDoUltimo : rodada,
                  inscritos: fase === 'duelo-jogo' && duelo ? [duelo.de, duelo.contra] : ordem,
                  formato: fase === 'duelo-jogo' ? 'duelo' : formato,
                }
              : null,
            classificacao: classificacaoPublica(),
            interrompida,
            partidaId: evento,
            // quantos robôs (o "Jogar de novo" do Solo pede os mesmos)
            robos: robos.length,
          };
        },
        acao(quem, corpo) {
          if (!ordem.includes(quem)) return 'Você está assistindo esta partida.';
          const noMicrojogo = (fase === 'minijogo' || fase === 'duelo-jogo') && mini;
          // o eco é a medida da rede do microjogo (minijogo-festa.ts): nunca é erro, nem fora dele
          if (corpo.tipo === 'eco') return noMicrojogo ? mini!.acao(quem, corpo) : null;
          if (corpo.tipo === 'resultado' || corpo.tipo === 'acerto') {
            if (!noMicrojogo) return 'Esta rodada já acabou.';
            return mini!.acao(quem, corpo);
          }
          const minha = (f: typeof fase) => {
            if (fase !== f) return 'A partida não está em andamento.';
            if (quem !== daVez()) return 'Espere a sua vez.';
            return null;
          };
          switch (corpo.tipo) {
            case 'dado':
              return minha('vez') ?? (jogarDado(quem), null);
            case 'usar': {
              const erro = minha('vez');
              if (erro) return erro;
              if (!ITENS.includes(corpo.item as Item)) return 'Você não tem esse item.';
              return usar(quem, corpo.item as Item, corpo);
            }
            case 'comprar':
              return minha('loja') ?? (decidir(quem, corpo.sim === true), null);
            case 'caminho':
              return minha('caminho') ?? (escolher(quem, corpo.ramal === true), null);
            case 'item': {
              const erro = minha('itens');
              if (erro) return erro;
              const item = corpo.item === null || corpo.item === undefined ? null : (corpo.item as Item);
              if (item !== null && !ITENS.includes(item)) return 'Ação desconhecida.';
              if (item && pecas.get(quem)!.cenouras < PRECOS_DOS_ITENS[item]) return 'Cenouras de menos.';
              comprarItem(quem, item);
              return null;
            }
            case 'duelo': {
              const erro = minha('duelo');
              if (erro) return erro;
              const contra = Number(corpo.contra);
              if (contra === quem || !presentes().includes(contra)) return 'Escolha alguém da partida.';
              desafiar(quem, contra);
              return null;
            }
            default:
              return 'Ação desconhecida.';
          }
        },
        conferir() {
          if (fase === 'fim') return;
          const aqui = presentes();
          if (faltouGente(aqui)) return;
          if (fase === 'minijogo' || fase === 'duelo-jogo') return mini?.conferir();
          // quem está na vez saiu da sala: a vez passa (sem gastar as cenouras de quem não está)
          if (['vez', 'loja', 'caminho', 'itens', 'duelo'].includes(fase) && !aqui.includes(daVez())) desistir();
        },
        // o canal ao vivo dos microjogos de contato (festa/rodada.ts, lote 5): só encaminha para o microjogo da vez
        tempoReal(quem, dados) {
          return (fase === 'minijogo' || fase === 'duelo-jogo') && mini ? mini.tempoReal(quem, dados) : null;
        },
        parar() {
          mini?.parar();
        },
      };
    },
  };
}
