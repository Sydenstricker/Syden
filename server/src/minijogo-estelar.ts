/**
 * A ROTA ESTELAR (16/11/2026): o tiro em trilhos em 3D. Os coelhos em naves pela superfície de um planeta e pelo espaço,
 * contra a frota de lata, com a bifurcação no meio e o polvo de lata no fim, em uns 2 minutos e meio. Só a mecânica do
 * gênero (estelar-sim.ts tem a regra inteira); o que aparece é desenhado no site.
 *
 * A REDE É A DA ESQUADRILHA DA TOCA (minijogo-nave.ts): a turma voa A MESMA rota ao mesmo tempo, cada um na própria tela, e
 * cada um derruba a SUA cópia de cada inimigo; o roteiro sai da semente, igual nas duas pontas (estelar-sim.ts, duas cópias
 * byte a byte). Os outros aparecem como alas meio transparentes, pelo tempo real.
 *
 * O SERVIDOR NÃO CONFIA NO "ACERTEI": os eventos vão em lotes (~10 por segundo, com o lugar da nave), e cada um passa pela
 * FICHA do piloto (a mesma conta do site): o disparo na cadência e com a arma que a pessoa tinha, a bala no lugar do inimigo,
 * o tiro carregado no cone e no passo da chegada, a rota pelo lado da nave na bifurcação (e só os inimigos dela), o anel e o
 * item no lugar deles, e a nave sem andar mais rápido do que anda. Aqui se confere também o relógio. O que continua
 * possível: o roteiro está no site, e um programa poderia jogar sozinho; e o golpe que a nave leva é quem leva que diz.
 *
 * O PÓDIO: com a turma (2 ou mais que ficaram até o fim), os três primeiros vão para a estante de troféus do quarto (pista
 * 'estelar', os pontos). NO SOLO, sem troféu, e a partida pode virar o RECORDE da pessoa (estelar_recordes).
 *
 * A SEGUNDA ROTA (24/11/2026): quem começa escolhe na largada a rota do planeta (a de sempre) ou a do GELO (`corpo.rota`, ver
 * estelar-sim.ts), que vale para a turma toda. O recorde do Solo na do gelo fica na tabela comum (jogo 'estelar', variante
 * 'gelo'); o da do planeta continua em estelar_recordes. O troféu da sala é o mesmo (pista 'estelar').
 */
import { FIM, Ficha, PASSOS_POR_S, ROTA_DO_GELO, roteiro, rotaValida } from './estelar-sim.js';
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** O "prepare-se" antes da largada. */
export const PREPARO_MS = 3000;
/** O evento não pode estar à frente do passo do servidor mais do que isto (a rede), nem atrás mais que ATRASO. */
export const FOLGA_PASSOS = 30;
export const ATRASO_PASSOS = 300;
export const ESPERA_DO_FIM_MS = 1500;
export const EVENTOS_POR_LOTE = 60;

interface Piloto {
  ficha: Ficha;
  recusas: number;
  /** Os disparos que o site diz ter feito (só para a precisão na tela; não muda pontos). */
  disparos: number;
}

export const estelar: Definicao = criarEstelar();

export function criarEstelar({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: 8,
    comecar(ctx, { naSala, corpo }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const evento = `estelar-${ctx.comunidade ?? 0}-${agora()}`;
      const semente = Math.floor(aleatorio() * 2147483647);
      const rota = rotaValida((corpo as Record<string, unknown> | undefined)?.rota);
      const gelo = rota === ROTA_DO_GELO;
      const r = roteiro(semente, rota);
      let fase: 'preparando' | 'jogando' | 'fim' = 'preparando';
      let inicio = 0;
      const pilotos = new Map<number, Piloto>(inscritos.map((id) => [id, { ficha: new Ficha(r), recusas: 0, disparos: 0 }]));
      const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
      let ficaram: Set<number> | null = null;
      let recordeNovo = false;
      const recordeAntes = solo ? (gelo ? (db.recordeDoSolo(inscritos[0], 'estelar', 'gelo')?.valor ?? null) : db.recordeEstelar(inscritos[0])) : null;
      let fechando = false;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };
      const passoAgora = () => Math.floor(((agora() - inicio) * PASSOS_POR_S) / 1000);
      const precisao = (pl: Piloto) => (pl.disparos > 0 ? Math.min(100, Math.round((100 * pl.ficha.acertos) / Math.max(pl.disparos, pl.ficha.acertos))) : 0);

      const placar = (fim: boolean) => {
        const contam = ficaram ?? new Set(presentes());
        const n = fase === 'jogando' ? passoAgora() : FIM;
        const linhas = inscritos
          .map((userId) => {
            const pl = pilotos.get(userId)!;
            const f = pl.ficha;
            return {
              userId,
              username: ctx.nome(userId),
              avatar: avatares.get(userId) ?? null,
              pontos: f.total(n, fim),
              vidas: f.vidas,
              chefe: f.chefeEm !== null,
              acabou: f.acabou,
              precisao: precisao(pl),
              posicao: null as number | null,
            };
          })
          .sort((a, b) => Number(contam.has(b.userId)) - Number(contam.has(a.userId)) || b.pontos - a.pontos || a.username.localeCompare(b.username));
        for (const l of linhas) if (contam.has(l.userId)) l.posicao = 1 + linhas.filter((o) => contam.has(o.userId) && o.pontos > l.pontos).length;
        return linhas;
      };

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        ficaram = new Set(presentes());
        const linhas = placar(true);
        if (solo) {
          const l = linhas[0];
          if (ficaram.has(inscritos[0]) && l.pontos > 0) recordeNovo = gelo ? db.guardarRecordeDoSolo(inscritos[0], 'estelar', 'gelo', l.pontos, false).novo : db.guardarRecordeEstelar(inscritos[0], l.pontos);
        } else if (ficaram.size >= 2) {
          for (const l of linhas) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'estelar',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...ficaram].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      /** Todos os que estão na sala acabaram (sem vidas, ou com o chefe no chão): a partida fecha logo. */
      const conferir = () => {
        if (fase !== 'jogando' || fechando) return;
        const aqui = presentes();
        if (aqui.length === 0 || aqui.every((id) => pilotos.get(id)!.ficha.acabou)) {
          fechando = true;
          ctx.agendar(ESPERA_DO_FIM_MS, terminar);
        }
      };

      ctx.agendar(PREPARO_MS, () => {
        fase = 'jogando';
        inicio = agora();
        ctx.agendar(Math.ceil((FIM * 1000) / PASSOS_POR_S) + ESPERA_DO_FIM_MS, terminar);
        ctx.avisar();
      });

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      return {
        publico(quem) {
          const meu = pilotos.get(quem);
          const linhas = placar(fase === 'fim');
          return {
            fase,
            semente,
            rota,
            duracaoMs: Math.round((FIM * 1000) / PASSOS_POR_S),
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            jogadores: linhas,
            esquadrilha: linhas.reduce((s, l) => s + l.pontos, 0),
            meu: meu
              ? {
                  vidas: meu.ficha.vidas,
                  escudo: meu.ficha.escudo,
                  bombas: meu.ficha.bombas,
                  ramo: meu.ficha.ramo,
                  mortos: [...meu.ficha.mortos.keys()],
                  acabou: meu.ficha.acabou,
                }
              : null,
            recorde: solo ? { antes: recordeAntes, novo: recordeNovo } : null,
            solo,
            partidaId: evento,
          };
        },
        acao() {
          return 'Ação desconhecida.';
        },
        /**
         * O LOTE DE CADA UM: o lugar da nave agora ({ p, x, y }), os eventos desde o último lote (`ev`, ver Ficha.aplicar) e
         * os disparos até agora (`ds`). O que vai à turma: o lugar, as vidas, o escudo, a rota, os pontos e quem caiu.
         */
        tempoReal(quem, dados) {
          const pl = pilotos.get(quem);
          if (!pl || fase !== 'jogando' || !dados || typeof dados !== 'object') return null;
          const d = dados as Record<string, unknown>;
          const n = passoAgora();
          const noRelogio = (q: unknown) => numero(q) && q <= n + FOLGA_PASSOS && q >= n - ATRASO_PASSOS;
          const f = pl.ficha;
          const acabouAntes = f.acabou;
          if (Array.isArray(d.ev)) {
            for (const ev of d.ev.slice(0, EVENTOS_POR_LOTE)) {
              if (!Array.isArray(ev) || !noRelogio(ev[1])) {
                pl.recusas++;
                continue;
              }
              if (f.aplicar(ev) !== null) pl.recusas++;
            }
          }
          // os disparos só sobem, e não mais que um por passo do relógio
          if (numero(d.ds) && d.ds > pl.disparos) pl.disparos = Math.min(Math.floor(d.ds), Math.max(0, n));
          if (noRelogio(d.p) && numero(d.x) && numero(d.y)) f.posicao(d.p as number, d.x, d.y);
          const caiu = f.novos.splice(0);
          if (f.acabou && !acabouAntes) {
            ctx.avisar();
            conferir();
          }
          const ultima = f.posicoes[f.posicoes.length - 1];
          if (!ultima) return null;
          return {
            userId: quem,
            p: ultima.p,
            x: ultima.x,
            y: ultima.y,
            vidas: f.vidas,
            esc: f.escudo,
            ramo: f.ramo,
            pts: f.total(n),
            ...(caiu.length ? { m: caiu } : {}),
            ...(f.acabou ? { fim: 1 } : {}),
          };
        },
        conferir,
      };
    },
  };
}
