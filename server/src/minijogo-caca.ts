/**
 * A CAÇA ÀS PRAGAS DA HORTA (04/11/2026, pedido dele: "temos algum jogo tipo Duck Hunt?"). Corvos e gafanhotos atravessam a
 * horta, e cada um mira e atira com o mouse (ou o dedo). Cinco ondas, cada uma mais cheia e mais rápida, com a munição contada.
 * Só a mecânica dos jogos de mira de fliperama; as pragas, a horta e tudo o que aparece são nossos (caca-voo.ts, JogoCaca.tsx).
 *
 * A REDE DECIDE O FORMATO, como no golfe e na festa: a turma caça AS MESMAS pragas ao mesmo tempo, cada um na própria tela,
 * e cada um abate a sua cópia (a praga que eu acertei some só para mim). Não há disputa pela mesma praga, que seria decidida
 * pela internet de quem está mais perto do servidor.
 *
 * O SERVIDOR NÃO CONFIA NO "ACERTEI": cada tiro vem com o lugar (x, y) e o instante na onda em que foi dado, e o servidor
 * refaz a conta do voo (caca-voo.ts, a mesma do site) para saber se a praga estava lá. Ele confere também o relógio (o
 * instante dito não está à frente do que ele viu passar, com a folga da rede, nem mais de 0,8 s atrás), a munição e um tiro
 * a cada 120 ms no máximo. O que continua possível: as trajetórias vão ao site no começo da onda (é assim que ele as
 * desenha), e um programa poderia mirar sozinho. É jogo entre amigos.
 *
 * O PÓDIO: com a turma (2 ou mais que ficaram até o fim), os três primeiros vão para a estante de troféus do quarto (pista
 * 'caca', os pontos). NO SOLO, sem troféu, e a partida inteira pode virar o RECORDE da pessoa (caca_recordes).
 */
import { ONDAS, fimDaOnda, municaoDaOnda, pontosDoAcerto, pragaAtingida, sortearOnda, type Praga, LARGURA, ALTURA } from './caca-voo.js';
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** A onda na tela antes de valer (o "prepare-se"). */
export const PREPARO_MS = 3000;
/** O placar entre uma onda e outra. */
export const PLACAR_ENTRE_MS = 5000;
/** O instante do tiro não pode estar à frente do relógio do servidor mais do que isto (a rede), nem atrás mais que ATRASO. */
export const FOLGA_FUTURO_MS = 400;
export const ATRASO_MAX_MS = 800;
export const INTERVALO_MIN_MS = 120;

interface Cacador {
  pontos: number;
  /** Na onda de agora: quais pragas eu abati, os tiros que sobram, e os pontos dela. */
  abatidas: Set<number>;
  municao: number;
  daOnda: number;
  ultimoTiro: number;
  /** Quantas pragas abateu na partida inteira, e de quantas. */
  acertos: number;
}

export const caca: Definicao = criarCaca();

export function criarCaca({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const evento = `caca-${ctx.comunidade ?? 0}-${agora()}`;
      let onda = 1;
      let fase: 'preparando' | 'jogando' | 'placar' | 'fim' = 'preparando';
      let inicio = 0;
      let pragas: Praga[] = [];
      const cacadores = new Map<number, Cacador>(
        inscritos.map((id) => [id, { pontos: 0, abatidas: new Set(), municao: 0, daOnda: 0, ultimoTiro: -Infinity, acertos: 0 }]),
      );
      let totalDePragas = 0;
      /** Quem estava na sala no fim de TODAS as ondas: só eles são "a turma" do pódio. */
      let ficaram: Set<number> | null = null;
      /** No Solo: se a partida virou o recorde da pessoa, e o recorde de antes (para a tela comparar). */
      let recordeNovo = false;
      const recordeAntes = solo ? db.recordeDaCaca(inscritos[0]) : null;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      const preparar = () => {
        fase = 'preparando';
        pragas = sortearOnda(onda, aleatorio);
        totalDePragas += pragas.length;
        for (const c of cacadores.values()) {
          c.abatidas = new Set();
          c.municao = municaoDaOnda(onda);
          c.daOnda = 0;
        }
        ctx.agendar(PREPARO_MS, jogar);
        ctx.avisar();
      };

      const jogar = () => {
        fase = 'jogando';
        inicio = agora();
        ctx.agendar(fimDaOnda(pragas) + FOLGA_FUTURO_MS, fechar);
        ctx.avisar();
      };

      const fechar = () => {
        if (fase !== 'jogando') return;
        const aqui = new Set(presentes());
        ficaram = new Set((ficaram ? [...ficaram] : inscritos).filter((id) => aqui.has(id)));
        if (onda >= ONDAS) return terminar();
        fase = 'placar';
        ctx.agendar(PLACAR_ENTRE_MS, () => {
          onda++;
          preparar();
        });
        ctx.avisar();
      };

      /** Mais pontos primeiro; a posição é só de quem ficou (a mesma conta do troféu), e empatados dividem. */
      const placar = () => {
        const contam = ficaram ?? new Set(presentes());
        const linhas = inscritos
          .map((userId) => {
            const c = cacadores.get(userId)!;
            return { userId, username: ctx.nome(userId), pontos: c.pontos, daOnda: c.daOnda, acertos: c.acertos, posicao: null as number | null };
          })
          .sort((a, b) => Number(contam.has(b.userId)) - Number(contam.has(a.userId)) || b.pontos - a.pontos || a.username.localeCompare(b.username));
        for (const l of linhas) if (contam.has(l.userId)) l.posicao = 1 + linhas.filter((o) => contam.has(o.userId) && o.pontos > l.pontos).length;
        return linhas;
      };

      const terminar = () => {
        fase = 'fim';
        const turma = ficaram ?? new Set<number>();
        if (solo) {
          const c = cacadores.get(inscritos[0])!;
          if (turma.has(inscritos[0]) && c.pontos > 0) recordeNovo = db.guardarRecordeDaCaca(inscritos[0], c.pontos);
        } else if (turma.size >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'caca',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      /** Todo mundo que está na sala acabou a munição ou abateu tudo: a onda fecha sem esperar a última praga fugir. */
      const conferir = () => {
        if (fase !== 'jogando') return;
        const aqui = presentes();
        if (aqui.length === 0 || aqui.every((id) => {
          const c = cacadores.get(id)!;
          return c.municao === 0 || c.abatidas.size === pragas.length;
        })) fechar();
      };

      preparar();

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      return {
        publico(quem) {
          const meu = cacadores.get(quem);
          return {
            fase,
            onda,
            ondas: ONDAS,
            // os nomes de sempre, para o topo da estante dizer "Rodada 2 de 5" como nos outros jogos
            rodada: onda,
            rodadas: ONDAS,
            /** As pragas da onda (as trajetórias): o site as desenha com a mesma conta do servidor (caca-voo.ts). */
            pragas: fase === 'preparando' || fase === 'jogando' ? pragas : [],
            duracaoMs: fimDaOnda(pragas),
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            meu: meu ? { pontos: meu.pontos, daOnda: meu.daOnda, municao: meu.municao, abatidas: [...meu.abatidas] } : null,
            placar: placar(),
            totalDePragas,
            recorde: solo ? { antes: recordeAntes, novo: recordeNovo } : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'tiro') return 'Ação desconhecida.';
          const c = cacadores.get(quem);
          if (!c) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          const { x, y, ms } = corpo;
          if (!numero(x) || !numero(y) || !numero(ms) || x < -40 || y < -40 || x > LARGURA + 40 || y > ALTURA + 40) return 'Tiro inválido.';
          const agoraMs = agora();
          const passou = agoraMs - inicio;
          if (ms > passou + FOLGA_FUTURO_MS || ms < passou - ATRASO_MAX_MS) return 'Tiro inválido.';
          if (agoraMs - c.ultimoTiro < INTERVALO_MIN_MS) return 'Tiro inválido.';
          if (c.municao <= 0) return 'Acabou a munição desta onda.';
          c.ultimoTiro = agoraMs;
          c.municao--;
          const i = pragaAtingida(pragas, c.abatidas, x, y, ms);
          if (i >= 0) {
            c.abatidas.add(i);
            const p = pontosDoAcerto(pragas[i], ms);
            c.pontos += p;
            c.daOnda += p;
            c.acertos++;
          }
          conferir();
          ctx.avisar();
          return null;
        },
        conferir,
      };
    },
  };
}
