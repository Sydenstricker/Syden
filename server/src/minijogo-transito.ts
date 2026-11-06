/**
 * O TRÂNSITO DA TOCA (06/11/2026, pedido dele: "um minigame de trânsito, em que o jogador tem 1 minuto para liberar o maior número
 * possível de carros sem fazer com que eles batam"). Só a mecânica do gênero de controlar o cruzamento; a cidade é da Kenney (CC0).
 *
 * A PARTIDA É JOGADA NO COMPUTADOR DE QUEM JOGA (web/src/transito/sim.ts, passos fixos de 1/60 s), e o servidor a REFAZ: ele sorteia
 * a semente, o site joga e, no fim, manda só as liberações ([passo, rua, passo, rua, ...]). O servidor roda a mesma regra
 * (transito-sim.ts, cópia byte a byte da do site) do começo ao fim com elas, e os pontos são os DELE. O que ele confere antes:
 *  - uma vez só por pessoa;
 *  - a lista é de inteiros, em ordem de passo, dentro do minuto, a rua de 0 a 3, e não maior que um carro por rua por passo;
 *  - o minuto inteiro não pode ter passado mais depressa do que o relógio do servidor viu (a janela sem foco e o ESC PAUSAM a
 *    partida no Solo, então pode passar mais tempo, nunca menos).
 * Liberação que a regra recusa (ninguém na fila, cruzamento travado) é só ignorada, como no site. O que continua possível: um
 * programa que jogue perfeito, como o piloto automático dos testes. É jogo entre amigos.
 *
 * Com a turma, todos recebem a MESMA semente (os mesmos carros, na mesma hora), cada um no próprio cruzamento, e os pontos se
 * comparam no fim: os três primeiros vão à estante de troféus (pista 'transito'). No Solo, o RECORDE da pessoa (transito_recordes).
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';
import { PASSOS_DA_PARTIDA, refazer } from './transito-sim.js';

export const DURACAO_MS = (PASSOS_DA_PARTIDA / 60) * 1000;
/** A contagem da largada na tela (3 s) e a rede: o fim pode chegar um tico antes do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 2000;
/** Ninguém volta: a partida fecha sozinha depois disto (a partida pausada tem esse tanto para acabar). */
export const PRAZO_MS = DURACAO_MS + 10 * 60_000;
/** Liberações demais para um minuto (quatro ruas, e nunca chegam mais de uns 80 carros). */
export const LIBERACOES_MAX = 400;

interface Motorista {
  pontos: number | null;
  atravessaram: number | null;
  batidas: number | null;
}

export const transito: Definicao = criarTransito();

export function criarTransito({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const evento = `transito-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      const semente = Math.floor(aleatorio() * 2 ** 31);
      let fase: 'jogando' | 'fim' = 'jogando';
      const motoristas = new Map<number, Motorista>(inscritos.map((id) => [id, { pontos: null, atravessaram: null, batidas: null }]));
      const recordeAntes = solo ? db.recordeDoTransito(inscritos[0]) : null;
      let recordeNovo = false;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      /** Mais pontos primeiro; a posição só de quem mandou (empatados dividem). */
      const placar = () => {
        const linhas = inscritos
          .map((userId) => {
            const m = motoristas.get(userId)!;
            return { userId, username: ctx.nome(userId), pontos: m.pontos, atravessaram: m.atravessaram, batidas: m.batidas, posicao: null as number | null };
          })
          .sort((a, b) => Number(b.pontos !== null) - Number(a.pontos !== null) || (b.pontos ?? 0) - (a.pontos ?? 0) || a.username.localeCompare(b.username));
        for (const l of linhas) if (l.pontos !== null) l.posicao = 1 + linhas.filter((o) => o.pontos !== null && o.pontos > l.pontos!).length;
        return linhas;
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        const terminaram = inscritos.filter((id) => motoristas.get(id)!.pontos !== null);
        if (solo) {
          const m = motoristas.get(inscritos[0])!;
          if (m.pontos !== null && m.pontos > 0) recordeNovo = db.guardarRecordeDoTransito(inscritos[0], m.pontos);
        } else if (terminaram.length >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || !l.pontos) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'transito',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: terminaram.filter((id) => id !== l.userId),
            });
          }
        }
        // ninguém mandou (saíram todos antes do fim): a partida conta como interrompida
        ctx.terminar(terminaram.length > 0);
      };

      /** Quem ainda está na sala já mandou (ou saiu todo mundo): a partida fecha sem esperar o prazo. */
      const conferir = () => {
        if (fase !== 'jogando') return;
        if (presentes().every((id) => motoristas.get(id)!.pontos !== null)) terminar();
      };

      ctx.agendar(PRAZO_MS, () => terminar());

      return {
        publico(quem) {
          const meu = motoristas.get(quem);
          return {
            fase,
            semente,
            duracaoMs: DURACAO_MS,
            meu: meu ? { ...meu } : null,
            placar: placar(),
            recorde: solo ? { antes: recordeAntes, novo: recordeNovo } : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
          const m = motoristas.get(quem);
          if (!m) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando' || m.pontos !== null) return 'Esta rodada já acabou.';
          const lista = corpo.liberacoes;
          if (!Array.isArray(lista) || lista.length % 2 !== 0 || lista.length > LIBERACOES_MAX * 2) return 'Sessão inválida.';
          const vistos = new Set<number>();
          let anterior = 0;
          for (let i = 0; i < lista.length; i += 2) {
            const p = lista[i];
            const rua = lista[i + 1];
            if (!Number.isInteger(p) || !Number.isInteger(rua) || p < anterior || p >= PASSOS_DA_PARTIDA || rua < 0 || rua > 3) return 'Sessão inválida.';
            const chave = p * 4 + rua;
            if (vistos.has(chave)) return 'Sessão inválida.';
            vistos.add(chave);
            anterior = p;
          }
          // ninguém joga o minuto mais depressa do que o relógio deixou (pausar só alonga)
          if (DURACAO_MS > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
          const e = refazer(semente, lista as number[]);
          m.pontos = e.pontos;
          m.atravessaram = e.atravessaram;
          m.batidas = e.batidas;
          conferir();
          ctx.avisar();
          return null;
        },
        conferir,
      };
    },
  };
}
