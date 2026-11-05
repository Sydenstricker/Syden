/**
 * A COZINHA DA TOCA (05/11/2026, pedido dele, com os modelos do Restaurant Bits da KayKit, CC0): pegar os ingredientes nos
 * caixotes, picar na tábua, cozinhar no fogão e no forno (no ponto, sem queimar), montar no prato e entregar na janela. Só a
 * mecânica dos jogos de cozinha de festa; a cozinha, o coelho e tudo o que aparece são nossos (web/src/cozinha/).
 *
 * A REDE DECIDE O FORMATO, como na Caça e no golfe: CADA UM NA PRÓPRIA COZINHA. Ninguém divide panela pela internet; a
 * turma recebe OS MESMOS PEDIDOS, na mesma ordem (sorteados aqui, uma vez), e cada um anda na fila no próprio ritmo. Quem
 * entregar mais pratos certos em 3 minutos ganha (os pontos de cada receita desempatam).
 *
 * O SERVIDOR CONFERE O PRATO, não a cozinha: a entrega vem com o pedido e os itens do prato, e ele confere que o pedido está
 * na fila da pessoa e que os itens são os da receita (cozinha-receitas.ts, a mesma conta da tela). Um prato a cada 0,4 s no
 * máximo. O que continua possível: mandar o prato certo pelo console sem cozinhar. É jogo entre amigos.
 *
 * O PÓDIO: com a turma (2 ou mais que ficaram até o fim), os três primeiros vão para a estante de troféus do quarto (pista
 * 'cozinha', os pontos sendo os pratos). No Solo, sem troféu.
 */
import { DURACAO_MS, PEDIDOS_NA_FILA, RECEITAS, confere, normalizarPrato, sortearPedidos, type IdDaReceita } from './cozinha-receitas.js';
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** O "prepare-se" antes de valer. */
export const PREPARO_MS = 3000;
/** Um prato a cada isto, no máximo. */
export const INTERVALO_MIN_MS = 400;
/** Quantos pedidos a partida sorteia (mais do que alguém entrega em 3 minutos). */
export const PEDIDOS_DA_PARTIDA = 120;

interface Cozinheiro {
  /** Os índices da sequência que estão na fila desta pessoa. */
  fila: number[];
  proximo: number;
  pratos: number;
  pontos: number;
  ultimaEntrega: number;
}

export const cozinha: Definicao = criarCozinha();

export function criarCozinha({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = ctx.solo === true || inscritos.length === 1;
      const evento = `cozinha-${ctx.comunidade ?? 0}-${agora()}`;
      const pedidos: IdDaReceita[] = sortearPedidos(aleatorio, PEDIDOS_DA_PARTIDA);
      let fase: 'preparando' | 'jogando' | 'fim' = 'preparando';
      let inicio = 0;
      const cozinheiros = new Map<number, Cozinheiro>(
        inscritos.map((id) => [id, { fila: Array.from({ length: PEDIDOS_NA_FILA }, (_, k) => k), proximo: PEDIDOS_NA_FILA, pratos: 0, pontos: 0, ultimaEntrega: -Infinity }]),
      );

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      /** Mais pratos primeiro, os pontos desempatam; a posição é só de quem está na sala (empatados dividem). */
      const placar = () => {
        const contam = new Set(presentes());
        const linhas = inscritos
          .map((userId) => {
            const c = cozinheiros.get(userId)!;
            return { userId, username: ctx.nome(userId), pratos: c.pratos, pontos: c.pontos, posicao: null as number | null };
          })
          .sort(
            (a, b) =>
              Number(contam.has(b.userId)) - Number(contam.has(a.userId)) || b.pratos - a.pratos || b.pontos - a.pontos || a.username.localeCompare(b.username),
          );
        for (const l of linhas)
          if (contam.has(l.userId))
            l.posicao = 1 + linhas.filter((o) => contam.has(o.userId) && (o.pratos > l.pratos || (o.pratos === l.pratos && o.pontos > l.pontos))).length;
        return linhas;
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        const turma = new Set(presentes());
        if (!solo && turma.size >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || l.pratos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'cozinha',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pratos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      const jogar = () => {
        fase = 'jogando';
        inicio = agora();
        ctx.agendar(DURACAO_MS, () => terminar());
        ctx.avisar();
      };

      ctx.agendar(PREPARO_MS, jogar);

      return {
        publico(quem) {
          const meu = cozinheiros.get(quem);
          return {
            fase,
            duracaoMs: DURACAO_MS,
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            meu: meu ? { fila: meu.fila.map((indice) => ({ indice, receita: pedidos[indice] })), pratos: meu.pratos, pontos: meu.pontos } : null,
            placar: placar(),
            solo,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'entregar') return 'Ação desconhecida.';
          const c = cozinheiros.get(quem);
          if (!c) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          const indice = corpo.pedido;
          const prato = normalizarPrato(corpo.prato);
          if (typeof indice !== 'number' || !c.fila.includes(indice) || !prato || !confere(pedidos[indice], prato)) return 'Este prato não é o pedido.';
          const agoraMs = agora();
          if (agoraMs - c.ultimaEntrega < INTERVALO_MIN_MS) return 'Este prato não é o pedido.';
          c.ultimaEntrega = agoraMs;
          c.fila = c.fila.filter((i) => i !== indice);
          c.fila.push(c.proximo++);
          c.pratos++;
          c.pontos += RECEITAS[pedidos[indice]].pontos;
          ctx.avisar();
          return null;
        },
      };
    },
  };
}
