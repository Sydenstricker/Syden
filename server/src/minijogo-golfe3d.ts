/**
 * O MINIGOLFE 3D (05/11/2026): oito buracos montados com as peças do Minigolf Kit da Kenney (CC0), no site em 3D
 * (web/src/JogoGolfe3D.tsx). É um jogo SEPARADO do Minigolfe da toca (minijogo-golfe.ts), de propósito: os dois ficam na
 * estante para a turma dizer qual prefere. Só a mecânica do minigolfe; nada de nome, arte ou som de ninguém.
 *
 * AS MESMAS REGRAS DO DA TOCA, e pelos mesmos motivos (a rede: o servidor na Alemanha, a turma no Brasil): todo mundo joga o
 * MESMO buraco ao mesmo tempo, cada um na própria tela; as bolas dos outros aparecem pelo tempo real do motor (só posições,
 * carimbadas com quem mandou); o buraco acaba quando todos terminaram ou no fim do tempo, e quem não acertou fica com 7. Ganha
 * quem somar MENOS tacadas (empatados dividem a posição).
 *
 * O SERVIDOR NÃO CONFIA NO "ACERTEI": cada tacada vem com o passo do relógio do buraco e o vetor (dx, dz), e o servidor a
 * SIMULA com o mesmo código do site (golfe3d-fisica.ts, igual byte a byte ao do site). Ele confere a força e os números, que a
 * bola estava parada, o relógio (nem à frente do que ele viu passar, com a folga da rede, nem mais de 0,8 s atrás) e no máximo
 * uma tacada a cada 150 ms. Aqui não há obstáculo que anda, mas a janela para trás fica igual à do da toca: um buraco novo
 * com uma peça que se mexe não abre brecha. O que continua possível: um programa que calcule a tacada perfeita.
 *
 * OS TROFÉUS: o pódio de uma partida com 2 pessoas ou mais que ficaram até o fim vai para o quarto de quem ficou nele (pista
 * 'golfe3d', os pontos = o total de tacadas: MENOR é melhor). Só quem acertou algum buraco. No Solo, sem troféu.
 */
import * as db from './db.js';
import { BURACOS, TACADAS_MAX, acabouOBuraco, bater, montar, novaBola, pontosDoBuraco, rolarAteParar, tacadaInvalida, type Bola } from './golfe3d-fisica.js';
import type { Definicao } from './minijogo-motor.js';

export const PREPARO_MS = 3000;
export const BURACO_MS = 60_000;
export const BURACO_SOLO_MS = 120_000;
export const PLACAR_ENTRE_MS = 6000;
export const FOLGA_FUTURO_MS = 400;
export const ATRASO_MAX_MS = 800;
export const INTERVALO_MIN_MS = 150;
export const DEPOIS_DE_PARAR_MS = 900;
const TEMPO_REAL_MS = 50;

const msDoPasso = (passo: number) => (passo * 1000) / 60;

interface LinhaDoGolfe {
  userId: number;
  username: string;
  pontos: number;
  buraco: number | null;
  posicao: number | null;
}

export const golfe3d: Definicao = criarGolfe3D();

export function criarGolfe3D({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const solo = inscritos.length === 1;
      const duracao = solo ? BURACO_SOLO_MS : BURACO_MS;
      const evento = `golfe3d-${ctx.comunidade ?? 0}-${agora()}`;
      // o coelho de cada um, com as cores do avatar pronto (lido uma vez, na largada)
      const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
      let indice = 0;
      let fase: 'preparando' | 'jogando' | 'placar' | 'fim' = 'preparando';
      let inicio = 0;
      let fechando = false;
      let bolas = new Map<number, Bola>();
      const ultimaTacada = new Map<number, number>();
      const ultimoTempoReal = new Map<number, number>();
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      const doBuraco = new Map<number, number>();
      const acertaram = new Set<number>();
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

      /** Fecha o buraco quando a última bola PARAR no relógio do buraco (na tela dela, a bola ainda rola). */
      const fechar = () => {
        if (fase !== 'jogando') return;
        fechando = true;
        const ultimaParada = Math.max(0, ...presentes().map((id) => msDoPasso(bolas.get(id)!.passo)));
        const espera = ultimaParada + DEPOIS_DE_PARAR_MS - (agora() - inicio);
        if (espera > 0) {
          ctx.agendar(espera, contar);
          ctx.avisar();
        } else contar();
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

      /** O placar em ordem: menos tacadas primeiro; a posição só de quem ficou (a conta do troféu), e quem saiu vem depois. */
      const placar = (): LinhaDoGolfe[] => {
        const contam = ficaram ?? new Set(presentes());
        const linhas = inscritos
          .map((userId) => ({ userId, username: ctx.nome(userId), pontos: pontos.get(userId) ?? 0, buraco: doBuraco.get(userId) ?? null, posicao: null as number | null }))
          .sort((a, b) => Number(contam.has(b.userId)) - Number(contam.has(a.userId)) || a.pontos - b.pontos || a.username.localeCompare(b.username));
        for (const l of linhas) if (contam.has(l.userId)) l.posicao = 1 + linhas.filter((o) => contam.has(o.userId) && o.pontos < l.pontos).length;
        return linhas;
      };

      const terminar = () => {
        fase = 'fim';
        const turma = ficaram ?? new Set<number>();
        if (turma.size >= 2) {
          for (const l of placar()) {
            const posicao = l.posicao;
            if (posicao === null || posicao > 3 || !acertaram.has(l.userId)) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'golfe3d',
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

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
            decorridoMs: fase === 'jogando' ? agora() - inicio : null,
            fechando,
            tacadasMax: TACADAS_MAX,
            bolas: inscritos.map((userId) => {
              const b = bolas.get(userId)!;
              return { userId, username: ctx.nome(userId), avatar: avatares.get(userId) ?? null, x: b.x, z: b.z, tacadas: b.tacadas, dentro: b.dentro, acabou: acabouOBuraco(b) };
            }),
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
          const { passo, dx, dz } = corpo;
          // a parte para o alto (a tacada por cima) é opcional: sem ela, rasteira
          const dy = corpo.dy === undefined ? 0 : corpo.dy;
          if (!numero(passo) || !numero(dx) || !numero(dz) || !numero(dy)) return 'Tacada inválida.';
          const tacada = { passo, dx, dz, dy };
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
        /** A bola de quem joga, para os outros: só números dentro do buraco, e não mais que 20 por segundo. */
        tempoReal(quem, dados) {
          if (fase !== 'jogando' || !bolas.has(quem) || !dados || typeof dados !== 'object') return null;
          const { x, z } = dados as Record<string, unknown>;
          const [x0, z0, x1, z1] = montar(BURACOS[indice]).limites;
          if (!numero(x) || !numero(z) || x < x0 || z < z0 || x > x1 || z > z1) return null;
          const agoraMs = agora();
          if (agoraMs - (ultimoTempoReal.get(quem) ?? -Infinity) < TEMPO_REAL_MS) return null;
          ultimoTempoReal.set(quem, agoraMs);
          return { userId: quem, buraco: indice, x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000 };
        },
        conferir,
      };
    },
  };
}
