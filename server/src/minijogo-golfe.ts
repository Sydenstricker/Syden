/**
 * O MINIGOLFE DA TOCA (03/11/2026): seis buracos curtos vistos de cima, desenhados por código no site (JogoGolfe.tsx). Só a
 * mecânica do minigolfe; nada de nome, arte ou som de ninguém.
 *
 * A REDE DECIDE O FORMATO, como na corrida e na festa: o servidor está na Alemanha e a turma no Brasil (~200 ms). Todo mundo
 * joga o MESMO buraco ao mesmo tempo, cada um na própria tela, sem esperar a vez de ninguém; as bolas dos outros aparecem
 * como pontinhos coloridos, pelo tempo real do motor (só posições, carimbadas com quem mandou). O buraco acaba quando todos
 * terminaram (acertaram, ou chegaram às 6 tacadas) ou no fim do tempo; quem não acertou fica com 7. Seis buracos, e ganha
 * quem somar MENOS tacadas (empatados dividem a posição).
 *
 * O SERVIDOR NÃO CONFIA NO "ACERTEI": cada tacada vem na hora, com o passo do relógio do buraco em que foi dada e o vetor
 * (dx, dy), e o servidor a SIMULA com o mesmo código do site (golfe-fisica.ts, que o site tem byte a byte igual). É a
 * simulação dele que diz onde a bola parou, se caiu na água e se entrou. Ele confere também:
 * - a força e os números (golfe-fisica.ts, tacadaInvalida);
 * - que a bola estava PARADA: o passo da tacada não vem antes do passo em que a tacada anterior parou;
 * - o relógio: o passo dito não está à frente do que o servidor viu passar (com a folga da rede), nem mais de 2,5 s atrás
 *   (assim não dá para escolher depois a posição da tábua da porteira);
 * - no máximo uma tacada a cada 150 ms.
 * O QUE CONTINUA POSSÍVEL (jogo entre amigos, conferência razoável): como a física é conhecida, um programa pode calcular a
 * tacada perfeita e mandá-la pelo console — um "bot de mira". O servidor só garante que a tacada é uma tacada possível, na
 * hora certa, e que o resultado é o da física. O pontinho dos outros (o tempo real) é enfeite: o servidor confere os
 * números e a frequência, mas não que o caminho é o da bola; o lugar em que ela para é sempre o do servidor.
 *
 * OS TROFÉUS: o pódio de uma partida com 2 pessoas ou mais que ficaram até o fim vai para o quarto de quem ficou nele, na
 * mesma estante da corrida e da festa (pista 'golfe', os pontos = o total de tacadas: MENOR é melhor). Só quem acertou
 * algum buraco tem um resultado de verdade. No Solo, sem troféu.
 */
import * as db from './db.js';
import { ALTURA, BURACOS, LARGURA, TACADAS_MAX, acabouOBuraco, bater, novaBola, pontosDoBuraco, rolarAteParar, tacadaInvalida, type Bola } from './golfe-fisica.js';
import type { Definicao } from './minijogo-motor.js';

/** O buraco na tela antes de valer (o "prepare-se"). */
export const PREPARO_MS = 3000;
/** O tempo de cada buraco, com a turma e sozinho. */
export const BURACO_MS = 60_000;
export const BURACO_SOLO_MS = 120_000;
/** O placar entre um buraco e outro. */
export const PLACAR_ENTRE_MS = 6000;
/** A tacada não pode dizer um passo à frente do relógio do servidor, mais isto. */
export const FOLGA_FUTURO_MS = 400;
/** Nem um passo mais atrás do que isto. */
export const ATRASO_MAX_MS = 2500;
export const INTERVALO_MIN_MS = 150;
/** Depois que a última bola para, o tempo de vê-la entrar antes do placar. */
export const DEPOIS_DE_PARAR_MS = 900;
/** O pontinho de cada um, no máximo a cada isto. */
const TEMPO_REAL_MS = 50;

const msDoPasso = (passo: number) => (passo * 1000) / 60;

interface LinhaDoGolfe {
  userId: number;
  username: string;
  /** O total até aqui. */
  pontos: number;
  /** As tacadas do último buraco jogado (null antes do primeiro). */
  buraco: number | null;
}

export const golfe: Definicao = criarGolfe();

export function criarGolfe({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const duracao = solo ? BURACO_SOLO_MS : BURACO_MS;
      const evento = `golfe-${ctx.comunidade ?? 0}-${agora()}`;
      let indice = 0;
      let fase: 'preparando' | 'jogando' | 'placar' | 'fim' = 'preparando';
      let inicio = 0;
      /** O buraco já vai fechar (todos terminaram, ou o tempo acabou): esperando as bolas pararem na tela. */
      let fechando = false;
      let bolas = new Map<number, Bola>();
      const ultimaTacada = new Map<number, number>();
      const ultimoTempoReal = new Map<number, number>();
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      const doBuraco = new Map<number, number>();
      /** Quem acertou ao menos um buraco: só esses têm um resultado de verdade para o pódio. */
      const acertaram = new Set<number>();
      /** Quem estava na sala no fim de TODOS os buracos: só eles são "a turma" do pódio. */
      let ficaram: Set<number> | null = null;

      const presentes = () => {
        const naSalaAgora = new Set(ctx.naSala());
        return inscritos.filter((id) => naSalaAgora.has(id));
      };

      const preparar = () => {
        fase = 'preparando';
        fechando = false;
        bolas = new Map(inscritos.map((id) => [id, novaBola(BURACOS[indice])]));
        ultimaTacada.clear();
        ctx.agendar(PREPARO_MS, jogar);
        ctx.avisar();
      };

      const jogar = () => {
        fase = 'jogando';
        inicio = agora();
        ctx.agendar(duracao, fechar);
        ctx.avisar();
      };

      /**
       * Fecha o buraco quando a última bola PARAR no relógio do buraco: o servidor já sabe onde ela para (simulou a tacada
       * inteira ao recebê-la), mas na tela dela a bola ainda está rolando, e o placar não aparece por cima.
       */
      const fechar = () => {
        if (fase !== 'jogando') return;
        fechando = true;
        const ultimaParada = Math.max(0, ...presentes().map((id) => msDoPasso(bolas.get(id)!.passo)));
        const espera = ultimaParada + DEPOIS_DE_PARAR_MS - (agora() - inicio);
        if (espera > 0) ctx.agendar(espera, contar);
        else contar();
      };

      const contar = () => {
        if (fase !== 'jogando') return;
        const aqui = new Set(presentes());
        ficaram = new Set((ficaram ? [...ficaram] : inscritos).filter((id) => aqui.has(id)));
        doBuraco.clear();
        for (const id of inscritos) {
          const bola = bolas.get(id)!;
          const p = pontosDoBuraco(bola);
          doBuraco.set(id, p);
          pontos.set(id, (pontos.get(id) ?? 0) + p);
          if (bola.dentro) acertaram.add(id);
        }
        if (indice >= BURACOS.length - 1) return terminar();
        fase = 'placar';
        ctx.agendar(PLACAR_ENTRE_MS, () => {
          indice++;
          preparar();
        });
        ctx.avisar();
      };

      /** O placar em ordem: MENOS tacadas primeiro, e o nome desempata. */
      const placar = (): LinhaDoGolfe[] =>
        inscritos
          .map((userId) => ({ userId, username: ctx.nome(userId), pontos: pontos.get(userId) ?? 0, buraco: doBuraco.get(userId) ?? null }))
          .sort((a, b) => a.pontos - b.pontos || a.username.localeCompare(b.username));

      const terminar = () => {
        fase = 'fim';
        const turma = ficaram ?? new Set<number>();
        if (turma.size >= 2) {
          const ordem = placar().filter((l) => turma.has(l.userId));
          for (const l of ordem) {
            // empatados dividem a posição; menos tacadas é melhor
            const posicao = 1 + ordem.filter((o) => o.pontos < l.pontos).length;
            if (posicao > 3 || !acertaram.has(l.userId)) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'golfe',
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      /** Todo mundo que está na sala terminou o buraco: fecha (quem saiu não segura ninguém). */
      const conferir = () => {
        if (fase !== 'jogando' || fechando) return;
        const aqui = presentes();
        if (aqui.length === 0 || aqui.every((id) => acabouOBuraco(bolas.get(id)!))) fechar();
      };

      preparar();

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      return {
        publico(quem) {
          const meu = bolas.get(quem);
          return {
            fase,
            rodada: indice + 1,
            rodadas: BURACOS.length,
            buraco: indice,
            duracaoMs: duracao,
            /** Quanto do buraco já passou (jogando): o relógio da tela de cada um sai daqui. */
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            tacadasMax: TACADAS_MAX,
            bolas: inscritos.map((userId) => {
              const b = bolas.get(userId)!;
              return { userId, username: ctx.nome(userId), x: b.x, y: b.y, tacadas: b.tacadas, dentro: b.dentro, acabou: acabouOBuraco(b) };
            }),
            // a minha bola inteira (parada, como o servidor a simulou): o site se acerta por ela se divergir
            meu: meu ? { ...meu } : null,
            placar: placar(),
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'tacada') return 'Ação desconhecida.';
          if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando' || fechando) return 'Esta rodada já acabou.';
          const bola = bolas.get(quem)!;
          const { passo, dx, dy } = corpo;
          if (!numero(passo) || !numero(dx) || !numero(dy)) return 'Tacada inválida.';
          const tacada = { passo, dx, dy };
          if (tacadaInvalida(bola, tacada)) return 'Tacada inválida.';
          const agoraMs = agora();
          const passou = agoraMs - inicio;
          const quando = msDoPasso(passo);
          if (quando > passou + FOLGA_FUTURO_MS || quando < passou - ATRASO_MAX_MS) return 'Tacada inválida.';
          if (agoraMs - (ultimaTacada.get(quem) ?? -Infinity) < INTERVALO_MIN_MS) return 'Tacada inválida.';
          ultimaTacada.set(quem, agoraMs);
          bater(bola, tacada);
          rolarAteParar(BURACOS[indice], bola);
          conferir();
          ctx.avisar();
          return null;
        },
        /** O pontinho da bola de quem joga, para os outros: só números dentro da mesa, e não mais que 20 por segundo. */
        tempoReal(quem, dados) {
          if (fase !== 'jogando' || !bolas.has(quem) || !dados || typeof dados !== 'object') return null;
          const { x, y } = dados as Record<string, unknown>;
          if (!numero(x) || !numero(y) || x < 0 || y < 0 || x > LARGURA || y > ALTURA) return null;
          const agoraMs = agora();
          if (agoraMs - (ultimoTempoReal.get(quem) ?? -Infinity) < TEMPO_REAL_MS) return null;
          ultimoTempoReal.set(quem, agoraMs);
          return { userId: quem, buraco: indice, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        },
        conferir,
      };
    },
  };
}
