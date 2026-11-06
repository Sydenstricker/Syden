/**
 * A PONTE DA TOCA (06/11/2026, pedido dele: "Jogadores têm 30 segundos para montar a ponte. Aquele que usar menos recursos e
 * conseguir fazer o tráfego atravessar a ponte ganha."). Só a mecânica do gênero de construir ponte.
 *
 * A PONTE É MONTADA NO COMPUTADOR DE QUEM JOGA, e o servidor REFAZ a simulação: o site manda só a lista de peças
 * ([ax, ay, bx, by, tipo, ...]); o servidor confere (inteiros, dentro da grade da fase, o comprimento de cada tipo, nada repetido,
 * tudo ligado a um apoio: `conferir` em ponte-sim.ts, cópia byte a byte de web/src/ponte/sim.ts) e roda a física do começo ao fim
 * (`simular`). Passou, quanto o tráfego andou e o custo são os DELE.
 *
 * O relógio:
 *  - NA SALA, é o do servidor: a contagem (3 s) e os 30 s de montagem valem para todos ao mesmo tempo, e a ponte que chega depois
 *    disso (com uma folga para a rede) é recusada. Quem não mandou fica sem ponte, no fim do placar.
 *  - NO SOLO, o relógio é o do computador (o ESC e a janela sem foco pausam a montagem, como nos outros jogos solo); o servidor só
 *    fecha a partida depois de um prazo largo. O recorde é da pessoa e só ela o vê: pausar para pensar engana só a si mesma.
 *
 * O placar: quem passou, pelo MENOR custo; depois quem não passou, por quanto o tráfego andou; empatados dividem a posição. No fim,
 * as peças de todos vão ao site, para cada um ver as pontes dos outros passando (a vencedora primeiro). Os três primeiros que
 * PASSARAM vão à estante de troféus (pista 'ponte', os pontos são o custo). No Solo, o recorde por fase (ponte_recordes).
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';
import { comparar, conferir, FASES, faseDe, MONTAGEM_PASSOS, simular, type Resultado } from './ponte-sim.js';

export const CONTAGEM_MS = 3000;
export const MONTAGEM_MS = (MONTAGEM_PASSOS / 60) * 1000;
/** A rede: a ponte mandada no último instante chega um pouco depois do relógio do servidor. */
export const FOLGA_MS = 2500;
/** No Solo a montagem pausa; ninguém volta, e a partida fecha sozinha depois disto. */
export const PRAZO_DO_SOLO_MS = 10 * 60_000;
/** Na sala, depois do fim da montagem e da folga, quem não mandou fica sem ponte (e a simulação de todos acontece na tela). */
export const PRAZO_DA_SALA_MS = CONTAGEM_MS + MONTAGEM_MS + FOLGA_MS;

interface Construtor {
  resultado: Resultado | null;
  pecas: number[] | null;
}

export const ponte: Definicao = criarPonte();

export function criarPonte({ agora = Date.now, aleatorio = Math.random }: { agora?: () => number; aleatorio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      const inscritos = [...naSala];
      const solo = ctx.solo === true || inscritos.length === 1;
      const escolhida = faseDe(corpo.fase);
      if (corpo.fase !== undefined && corpo.fase !== 'sortear' && !escolhida) return 'Fase desconhecida.';
      const fase = escolhida ?? FASES[Math.floor(aleatorio() * FASES.length) % FASES.length];
      const evento = `ponte-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      const fimDaMontagem = inicio + CONTAGEM_MS + MONTAGEM_MS;
      let estado: 'montando' | 'fim' = 'montando';
      const construtores = new Map<number, Construtor>(inscritos.map((id) => [id, { resultado: null, pecas: null }]));
      const recordeAntes = solo ? db.recordeDaPonte(inscritos[0], fase.id) : null;
      let recordeNovo = false;

      const presentes = () => {
        const aqui = new Set(ctx.naSala());
        return inscritos.filter((id) => aqui.has(id));
      };

      /** Em ordem: quem passou pelo custo, quem não passou pelo quanto andou; quem não mandou no fim, sem posição. */
      const placar = () => {
        const linhas = inscritos.map((userId) => {
          const r = construtores.get(userId)!.resultado;
          return {
            userId,
            username: ctx.nome(userId),
            mandou: r !== null,
            passou: r?.passou ?? false,
            progresso: r?.progresso ?? 0,
            custo: r?.custo ?? 0,
            posicao: null as number | null,
          };
        });
        linhas.sort((a, b) => Number(b.mandou) - Number(a.mandou) || (a.mandou && b.mandou ? comparar(a, b) : 0) || a.username.localeCompare(b.username));
        for (const l of linhas) if (l.mandou) l.posicao = 1 + linhas.filter((o) => o.mandou && comparar(o, l) < 0).length;
        return linhas;
      };

      const terminar = () => {
        if (estado === 'fim') return;
        estado = 'fim';
        const mandaram = inscritos.filter((id) => construtores.get(id)!.resultado !== null);
        if (solo) {
          const r = construtores.get(inscritos[0])!.resultado;
          if (r?.passou) recordeNovo = db.guardarRecordeDaPonte(inscritos[0], fase.id, r.custo);
        } else if (mandaram.length >= 2) {
          for (const l of placar()) {
            if (l.posicao === null || l.posicao > 3 || !l.passou) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'ponte',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.custo,
              rivais: mandaram.filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(mandaram.length > 0);
      };

      const conferirSala = () => {
        if (estado !== 'montando') return;
        if (presentes().every((id) => construtores.get(id)!.resultado !== null)) terminar();
      };

      ctx.agendar(solo ? PRAZO_DO_SOLO_MS : PRAZO_DA_SALA_MS, () => terminar());

      return {
        publico(quem) {
          const meu = construtores.get(quem);
          return {
            fase: estado,
            faseDaPonte: fase.id,
            solo,
            // na sala, quanto falta da contagem e da montagem pelo relógio do servidor (o site conta a partir de quando recebeu)
            contagemMs: solo ? CONTAGEM_MS : Math.max(0, inicio + CONTAGEM_MS - agora()),
            montagemMs: solo ? MONTAGEM_MS : Math.max(0, fimDaMontagem - Math.max(agora(), inicio + CONTAGEM_MS)),
            meu: meu?.resultado ? { ...meu.resultado } : null,
            placar: placar(),
            // as pontes dos outros só no fim (antes, seria copiar a de quem já mandou)
            pontes: estado === 'fim' ? inscritos.filter((id) => construtores.get(id)!.pecas).map((id) => ({ userId: id, pecas: construtores.get(id)!.pecas })) : [],
            recorde: solo ? { antes: recordeAntes, novo: recordeNovo } : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'ponte') return 'Ação desconhecida.';
          const c = construtores.get(quem);
          if (!c) return 'Você está assistindo esta partida.';
          if (estado !== 'montando' || c.resultado !== null) return 'Esta rodada já acabou.';
          // na sala, a ponte vale só dentro dos 30 s do relógio do servidor (com a folga da rede)
          if (!solo && agora() > fimDaMontagem + FOLGA_MS) return 'Esta rodada já acabou.';
          if (conferir(fase, corpo.pecas) !== null) return 'Sessão inválida.';
          const pecas = (corpo.pecas as number[]).slice();
          c.pecas = pecas;
          c.resultado = simular(fase, pecas);
          if (solo) terminar();
          else conferirSala();
          ctx.avisar();
          return null;
        },
        conferir: conferirSala,
      };
    },
  };
}
