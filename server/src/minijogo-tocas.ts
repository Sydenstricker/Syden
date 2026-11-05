/**
 * TOCAS E TORRES (05/11/2026): estratégia em tempo real, SÓ A MECÂNICA do gênero, numa partida de 10 a 15 minutos contra o
 * computador. Este é o primeiro degrau: SÓ NO SOLO.
 *
 * A PARTIDA É DO COMPUTADOR DE QUEM JOGA (web/src/tocas/sim.ts, passos fixos de 1/10 s, e o computador adversário em
 * web/src/tocas/ia.ts): o servidor dá a SEMENTE do mapa e, no fim, recebe o resultado, conferido com o bom senso (sem refazer a
 * partida, como no skate):
 *  - uma vez só;
 *  - os passos são inteiros e cabem no teto da partida (20 minutos), e não podem ser mais do que o relógio do servidor viu
 *    passar desde a largada (a janela sem foco PAUSA a partida: pode passar mais tempo, nunca menos);
 *  - ganhar pede tempo de jogo de verdade: derrubar o centro do computador antes de VITORIA_MIN_PASSOS não acontece.
 * O que continua possível: dizer pelo console que ganhou. No Solo não há troféu nem conquista, então isso só engana a pessoa.
 *
 * A simulação é determinística e separada da tela justamente para a SALA DE DUAS PESSOAS depois ("lockstep": só os comandos
 * andam pela rede, e o servidor, com a mesma simulação, poderá refazer a partida inteira e decidir quem ganhou).
 */
import type { Definicao } from './minijogo-motor.js';

/** Os números da simulação do site (web/src/tocas/sim.ts). */
export const PASSOS_POR_SEGUNDO = 10;
export const PASSOS_MAX = 20 * 60 * PASSOS_POR_SEGUNDO;
/** Menos que isto (4 minutos) não dá para derrubar o centro de ninguém. */
export const VITORIA_MIN_PASSOS = 4 * 60 * PASSOS_POR_SEGUNDO;
/** A rede e a largada: os passos podem chegar um tico à frente do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 3000;
/** Ninguém volta: a partida fecha sozinha depois disto (a pausa da janela sem foco tem esse tanto). */
export const PRAZO_MS = 90 * 60_000;

export type Resultado = { venceu: boolean; motivo: 'centro' | 'maravilha' | 'tempo' | 'desistiu'; passos: number };

export const tocas: Definicao = criarTocas();

export function criarTocas({ agora = Date.now, sorteio = Math.random }: { agora?: () => number; sorteio?: () => number } = {}): Definicao {
  return {
    comecar(ctx, { naSala }) {
      // a sala (lockstep, duas pessoas) é o próximo degrau
      if (!ctx.solo || naSala.length !== 1) return 'Este jogo não se joga na sala.';
      const quem = naSala[0];
      const semente = Math.floor(sorteio() * 0x7fffffff) + 1;
      const inicio = agora();
      const partidaId = `tocas-${quem}-${inicio}`;
      let fase: 'jogando' | 'fim' = 'jogando';
      let resultado: Resultado | null = null;

      ctx.agendar(PRAZO_MS, () => {
        if (fase === 'fim') return;
        fase = 'fim';
        ctx.terminar(false);
      });

      return {
        publico() {
          return { fase, semente, partidaId, resultado, passosMax: PASSOS_MAX };
        },
        acao(autor, corpo) {
          if (autor !== quem) return 'Você está assistindo esta partida.';
          if (corpo.tipo !== 'fim' && corpo.tipo !== 'desistir') return 'Ação desconhecida.';
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          const passos = corpo.passos;
          if (typeof passos !== 'number' || !Number.isInteger(passos) || passos < 0 || passos > PASSOS_MAX) return 'Sessão inválida.';
          // a janela sem foco pausa a partida (mais tempo), mas ninguém anda mais passos do que o relógio deixou
          if ((passos / PASSOS_POR_SEGUNDO) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
          if (corpo.tipo === 'desistir') resultado = { venceu: false, motivo: 'desistiu', passos };
          else {
            const motivo = corpo.motivo;
            if (motivo !== 'centro' && motivo !== 'maravilha' && motivo !== 'tempo') return 'Sessão inválida.';
            if (typeof corpo.venceu !== 'boolean') return 'Sessão inválida.';
            if (corpo.venceu && passos < VITORIA_MIN_PASSOS) return 'Sessão inválida.';
            if (motivo === 'tempo' && passos < PASSOS_MAX - 1) return 'Sessão inválida.';
            resultado = { venceu: corpo.venceu, motivo, passos };
          }
          fase = 'fim';
          ctx.avisar();
          ctx.terminar(true);
          return null;
        },
      };
    },
  };
}
