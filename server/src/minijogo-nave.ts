/**
 * A ESQUADRILHA DA TOCA (05/11/2026): a navinha de rolagem vertical. Os coelhos em aviõezinhos de cenoura contra a praga da
 * horta: cinco ondas de corvos, vespas e besouros, e o espantalho mecânico no fim, em uns 3 minutos. Só a mecânica do gênero
 * (nave-sim.ts tem a regra inteira); tudo o que aparece é desenhado por código, no site.
 *
 * A REDE DECIDE O FORMATO, como na Caça às pragas: a turma enfrenta AS MESMAS ondas ao mesmo tempo, cada um na própria tela,
 * e cada um derruba a SUA cópia de cada inimigo. O roteiro sai da semente, igual nas duas pontas (nave-sim.ts, duas cópias
 * byte a byte). Os outros aparecem meio transparentes, pelo tempo real.
 *
 * O SERVIDOR NÃO CONFIA NO "ACERTEI": os eventos vão pelo tempo real, em lotes (~10 por segundo, com o lugar da nave), e cada
 * um passa pela FICHA do piloto (a mesma conta do site): o disparo na cadência e com a arma que a pessoa tinha, a bala no lugar
 * do inimigo no passo do acerto, cada bala uma vez, e a nave sem andar mais rápido do que anda. Aqui se confere também o
 * relógio: nenhum evento à frente do passo do servidor (com a folga da rede), nem velho demais. O que continua possível: o
 * roteiro está no site, e um programa poderia jogar sozinho; e quem leva o tiro é quem diz (como o repolho do kart), então
 * dá para não morrer pelo console. É jogo entre amigos.
 *
 * O PÓDIO: com a turma (2 ou mais que ficaram até o fim), os três primeiros vão para a estante de troféus do quarto (pista
 * 'nave', os pontos), e a tela mostra também o placar da esquadrilha (a soma de todos: é cooperativo). NO SOLO, sem troféu, e a
 * partida pode virar o RECORDE da pessoa (nave_recordes).
 */
import { FIM, Ficha, PASSOS_POR_S, roteiro, type Inimigo } from './nave-sim.js';
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';

/** O "prepare-se" antes da largada. */
export const PREPARO_MS = 3000;
/** O evento não pode estar à frente do passo do servidor mais do que isto (a rede), nem atrás mais que ATRASO. */
export const FOLGA_PASSOS = 30;
export const ATRASO_PASSOS = 300;
/** Quando todos acabaram, o placar espera um pouco pelos últimos lotes. */
export const ESPERA_DO_FIM_MS = 1500;
/** No máximo isto de eventos num lote (honesto: uns 3 por décimo de segundo). */
export const EVENTOS_POR_LOTE = 60;

interface Piloto {
  ficha: Ficha;
  /** As vezes que a ficha recusou um evento (só para o diagnóstico; não pune). */
  recusas: number;
}

export const nave: Definicao = criarNave();

export function criarNave({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: 8,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const evento = `nave-${ctx.comunidade ?? 0}-${agora()}`;
      const semente = Math.floor(aleatorio() * 2147483647);
      const inimigos: Inimigo[] = roteiro(semente);
      let fase: 'preparando' | 'jogando' | 'fim' = 'preparando';
      let inicio = 0;
      const pilotos = new Map<number, Piloto>(inscritos.map((id) => [id, { ficha: new Ficha(inimigos), recusas: 0 }]));
      /** Quem estava na sala no fim: só eles são "a turma" do pódio. */
      let ficaram: Set<number> | null = null;
      let recordeNovo = false;
      const recordeAntes = solo ? db.recordeDaNave(inscritos[0]) : null;
      let fechando = false;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };
      const passoAgora = () => Math.floor(((agora() - inicio) * PASSOS_POR_S) / 1000);

      const placar = (fim: boolean) => {
        const contam = ficaram ?? new Set(presentes());
        const n = fase === 'jogando' ? passoAgora() : FIM;
        const linhas = inscritos
          .map((userId) => {
            const f = pilotos.get(userId)!.ficha;
            return {
              userId,
              username: ctx.nome(userId),
              pontos: f.total(n, fim),
              vidas: f.vidas,
              chefe: f.chefeEm !== null,
              acabou: f.acabou,
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
          if (ficaram.has(inscritos[0]) && l.pontos > 0) recordeNovo = db.guardarRecordeDaNave(inscritos[0], l.pontos);
        } else if (ficaram.size >= 2) {
          for (const l of linhas) {
            if (l.posicao === null || l.posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'nave',
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
            duracaoMs: Math.round((FIM * 1000) / PASSOS_POR_S),
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            jogadores: linhas,
            esquadrilha: linhas.reduce((s, l) => s + l.pontos, 0),
            meu: meu
              ? {
                  vidas: meu.ficha.vidas,
                  bombas: meu.ficha.bombas,
                  escudo: meu.ficha.escudo,
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
         * O LOTE DE CADA UM: o lugar da nave agora ({ p, x, y }) e os eventos desde o último lote (`ev`, ver Ficha.aplicar).
         * O que vai à turma: o lugar, as vidas, os pontos e quem caiu nesta tela (para quem assiste seguir alguém).
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
