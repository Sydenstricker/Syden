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
 * 'caca', os pontos). NO SOLO, sem troféu, e a partida inteira pode virar o RECORDE da pessoa.
 *
 * A SEGUNDA AUDITORIA (20/11/2026): a JOANINHA, o bicho amigo que não se atira (acertá-la custa AMIGO_PENA e zera o combo), e a
 * RODADA BÔNUS entre a 3ª e a 4ª onda (cenouras lançadas para cima, sem limite de munição). O bônus muda a escala dos pontos,
 * então o recorde do Solo passou para a tabela comum (jogo 'caca', variante VARIANTE_DO_RECORDE); o de antes (caca_recordes)
 * fica guardado, e não se compara com o novo.
 */
import { AMIGO_PENA, BONUS_DEPOIS_DA_ONDA, BONUS_PERFEITA, ONDAS, ehAmigo, ehPraga, fimDaOnda, multiplicador, municaoDaOnda, pontosDoAcerto, pragaAtingida, sortearBonus, sortearOnda, type Praga, LARGURA, ALTURA } from './caca-voo.js';
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
/** O recorde do Solo na tabela comum desde a rodada bônus (20/11/2026). */
export const VARIANTE_DO_RECORDE = 'bonus';
/** A munição na rodada bônus: sem limite (o site mostra o infinito). */
export const SEM_LIMITE = -1;

interface Cacador {
  pontos: number;
  /** Na onda de agora: quais pragas eu abati, os tiros que sobram, e os pontos dela. */
  abatidas: Set<number>;
  municao: number;
  daOnda: number;
  ultimoTiro: number;
  /** Quantas pragas abateu na partida inteira, e de quantas. */
  acertos: number;
  /** O COMBO (19/11/2026): acertos seguidos sem errar tiro (multiplica os pontos); e se a última onda foi perfeita. */
  combo: number;
  perfeita: boolean;
  perfeitas: number;
  /** Quantas vezes acertou o bicho amigo (20/11/2026). */
  amigos: number;
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
      /** A rodada bônus (20/11/2026), entre a onda BONUS_DEPOIS_DA_ONDA e a seguinte. */
      let bonus = false;
      let fase: 'preparando' | 'jogando' | 'placar' | 'fim' = 'preparando';
      let inicio = 0;
      let pragas: Praga[] = [];
      const cacadores = new Map<number, Cacador>(
        inscritos.map((id) => [id, { pontos: 0, abatidas: new Set(), municao: 0, daOnda: 0, ultimoTiro: -Infinity, acertos: 0, combo: 0, perfeita: false, perfeitas: 0, amigos: 0 }]),
      );
      let totalDePragas = 0;
      /** Quem estava na sala no fim de TODAS as ondas: só eles são "a turma" do pódio. */
      let ficaram: Set<number> | null = null;
      /** No Solo: se a partida virou o recorde da pessoa, e o recorde de antes (para a tela comparar). */
      let recordeNovo = false;
      const recordeAntes = solo ? (db.recordeDoSolo(inscritos[0], 'caca', VARIANTE_DO_RECORDE)?.valor ?? null) : null;
      /** Quantas pragas de verdade (sem o amigo) a onda tem, e quantas dessas cada um abateu. */
      const nDePragas = () => pragas.filter(ehPraga).length;
      const pragasAbatidas = (c: Cacador) => [...c.abatidas].filter((i) => pragas[i] && ehPraga(pragas[i])).length;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      const preparar = () => {
        fase = 'preparando';
        pragas = bonus ? sortearBonus(aleatorio) : sortearOnda(onda, aleatorio);
        if (!bonus) totalDePragas += nDePragas();
        for (const c of cacadores.values()) {
          c.abatidas = new Set();
          c.municao = bonus ? SEM_LIMITE : municaoDaOnda(onda);
          c.daOnda = 0;
          c.perfeita = false;
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
        // A ONDA PERFEITA (19/11/2026): quem abateu todas ganha o bônus (contado aqui, pelas abatidas que o servidor conferiu);
        // desde 20/11/2026, todas as PRAGAS e nenhum tiro no amigo; a rodada bônus não conta
        const n = nDePragas();
        for (const c of cacadores.values()) {
          if (!bonus && n > 0 && pragasAbatidas(c) === n && ![...c.abatidas].some((i) => ehAmigo(pragas[i]))) {
            c.perfeita = true;
            c.perfeitas++;
            c.pontos += BONUS_PERFEITA;
            c.daOnda += BONUS_PERFEITA;
          }
        }
        const aqui = new Set(presentes());
        ficaram = new Set((ficaram ? [...ficaram] : inscritos).filter((id) => aqui.has(id)));
        if (!bonus && onda >= ONDAS) return terminar();
        fase = 'placar';
        const proxima = !bonus && onda === BONUS_DEPOIS_DA_ONDA ? 'bonus' : 'onda';
        ctx.agendar(PLACAR_ENTRE_MS, () => {
          if (proxima === 'bonus') bonus = true;
          else {
            bonus = false;
            onda++;
          }
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
          if (turma.has(inscritos[0]) && c.pontos > 0) recordeNovo = db.guardarRecordeDoSolo(inscritos[0], 'caca', VARIANTE_DO_RECORDE, c.pontos, false, { acertos: c.acertos, perfeitas: c.perfeitas }).novo;
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
          return c.municao === 0 || (bonus ? c.abatidas.size === pragas.length : pragasAbatidas(c) === nDePragas());
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
            meu: meu
              ? { pontos: meu.pontos, daOnda: meu.daOnda, municao: meu.municao, abatidas: [...meu.abatidas], combo: meu.combo, perfeita: meu.perfeita, pragasAbatidas: pragasAbatidas(meu), amigos: meu.amigos }
              : null,
            /** A rodada bônus (20/11/2026): as cenouras, sem limite de munição; no placar, a que acabou de passar. */
            bonus,
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
          if (!bonus && c.municao <= 0) return 'Acabou a munição desta onda.';
          c.ultimoTiro = agoraMs;
          if (!bonus) c.municao--;
          const i = pragaAtingida(pragas, c.abatidas, x, y, ms);
          if (bonus) {
            // a rodada bônus: cada cenoura vale os pontos dela, sem combo, e errar não custa nada
            if (i >= 0) {
              c.abatidas.add(i);
              const p = pontosDoAcerto(pragas[i], ms);
              c.pontos += p;
              c.daOnda += p;
            }
          } else if (i >= 0 && ehAmigo(pragas[i])) {
            // o bicho amigo: some (sai voando assustado), custa a pena e zera o combo; os pontos não ficam abaixo de zero
            c.abatidas.add(i);
            c.combo = 0;
            c.amigos++;
            const tira = Math.min(AMIGO_PENA, c.pontos);
            c.pontos -= tira;
            c.daOnda -= tira;
          } else if (i >= 0) {
            c.abatidas.add(i);
            c.combo++;
            const p = pontosDoAcerto(pragas[i], ms) * multiplicador(c.combo);
            c.pontos += p;
            c.daOnda += p;
            c.acertos++;
          } else c.combo = 0;
          conferir();
          ctx.avisar();
          return null;
        },
        conferir,
      };
    },
  };
}
