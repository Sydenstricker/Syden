/**
 * O ROLÊ DO COELHO (05/11/2026, pedido dele: "um mini Tony Hawk"): um minuto (eram dois até 06/11/2026) numa pista de skate, com pontos por manobra
 * e combos. SÓ A MECÂNICA dos jogos de skate de pontos; a pista, o coelho e tudo o que aparece são nossos ou da Kenney (CC0).
 *
 * A SESSÃO É DE QUEM JOGA, no computador dele (web/src/skate/fisica.ts, passos fixos de 1/60 s, como o contra o relógio do
 * kart): o servidor não vê manobra nenhuma. No fim, o site manda os pontos, quantos passos andou e o melhor combo, e o servidor
 * confere o que dá sem refazer a sessão:
 *  - uma vez só por pessoa;
 *  - os passos são os da sessão inteira (3600, ou um pouco mais: acabado o tempo, o combo no ar ainda fecha), e não podem
 *    ser mais do que o relógio do servidor viu passar desde a largada (a janela sem foco PAUSA a sessão, então pode passar
 *    mais tempo, nunca menos);
 *  - os pontos são inteiros, de 0 a um teto folgado, e o melhor combo não passa do total.
 * O que continua possível: mandar pontos inventados abaixo do teto pelo console. A física não usa seno nem cosseno, para que
 * um dia o servidor possa refazer a sessão a partir dos comandos (como no golfe), e aí isto fecha.
 *
 * Com a turma, cada um anda na SUA cópia da pista (sem batida entre skatistas pela internet, como na caça e no golfe), e os
 * pontos se comparam no fim: os três primeiros vão à estante de troféus (pista 'skate'). No Solo, o RECORDE da pessoa
 * (skate_recordes_1min), sem troféu.
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** Os números da física do site (web/src/skate/fisica.ts): a sessão e a folga para fechar o combo depois do tempo. */
export const PASSOS_DA_SESSAO = 3600;
export const PASSOS_DE_FOLGA = 600;
export const DURACAO_MS = (PASSOS_DA_SESSAO / 60) * 1000;
/** A contagem da largada na tela (3 s) e a rede: os passos podem chegar um tico à frente do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 2000;
/** Ninguém volta: a partida fecha sozinha depois disto (a sessão pausada pela janela sem foco tem esse tanto para acabar). */
export const PRAZO_MS = DURACAO_MS + 10 * 60_000;
/** Pontos demais para um minuto de pista (um combo enorme passa de 100 mil; isto é dez vezes uma sessão excelente). */
export const PONTOS_MAX = 5_000_000;

interface Skatista {
  pontos: number | null;
  melhorCombo: number | null;
}

export const skate: Definicao = criarSkate();

export function criarSkate({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const evento = `skate-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      let fase: 'jogando' | 'fim' = 'jogando';
      const skatistas = new Map<number, Skatista>(inscritos.map((id) => [id, { pontos: null, melhorCombo: null }]));
      const recordeAntes = solo ? db.recordeDoSkate(inscritos[0]) : null;
      let recordeNovo = false;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      /** Mais pontos primeiro; a posição só de quem mandou (empatados dividem). */
      const placar = () => {
        const linhas = inscritos
          .map((userId) => {
            const s = skatistas.get(userId)!;
            return { userId, username: ctx.nome(userId), pontos: s.pontos, melhorCombo: s.melhorCombo, posicao: null as number | null };
          })
          .sort((a, b) => Number(b.pontos !== null) - Number(a.pontos !== null) || (b.pontos ?? 0) - (a.pontos ?? 0) || a.username.localeCompare(b.username));
        for (const l of linhas) if (l.pontos !== null) l.posicao = 1 + linhas.filter((o) => o.pontos !== null && o.pontos > l.pontos!).length;
        return linhas;
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        const terminaram = inscritos.filter((id) => skatistas.get(id)!.pontos !== null);
        if (solo) {
          const s = skatistas.get(inscritos[0])!;
          if (s.pontos !== null && s.pontos > 0) recordeNovo = db.guardarRecordeDoSkate(inscritos[0], s.pontos);
        } else if (terminaram.length >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || !l.pontos) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'skate',
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
        const aqui = presentes();
        if (aqui.every((id) => skatistas.get(id)!.pontos !== null)) terminar();
      };

      ctx.agendar(PRAZO_MS, () => terminar());

      const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

      return {
        publico(quem) {
          const meu = skatistas.get(quem);
          return {
            fase,
            duracaoMs: DURACAO_MS,
            meu: meu ? { pontos: meu.pontos, melhorCombo: meu.melhorCombo } : null,
            placar: placar(),
            recorde: solo ? { antes: recordeAntes, novo: recordeNovo } : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'fim') return 'Ação desconhecida.';
          const s = skatistas.get(quem);
          if (!s) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando' || s.pontos !== null) return 'Esta rodada já acabou.';
          const { pontos, passos, melhorCombo } = corpo;
          if (!inteiro(pontos) || !inteiro(passos) || !inteiro(melhorCombo)) return 'Sessão inválida.';
          if (pontos < 0 || pontos > PONTOS_MAX || melhorCombo < 0 || melhorCombo > pontos) return 'Sessão inválida.';
          if (passos < PASSOS_DA_SESSAO || passos > PASSOS_DA_SESSAO + PASSOS_DE_FOLGA + 1) return 'Sessão inválida.';
          // a janela sem foco pausa a sessão (mais tempo), mas ninguém anda mais passos do que o relógio deixou
          if ((passos / 60) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
          s.pontos = pontos;
          s.melhorCombo = melhorCombo;
          conferir();
          ctx.avisar();
          return null;
        },
        conferir,
      };
    },
  };
}
