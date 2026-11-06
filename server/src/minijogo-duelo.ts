/**
 * O DUELO DE AVIÕEZINHOS (05/11/2026): a batalha aérea dos jogos de festa, SÓ A MECÂNICA. Coelhos em teco-tecos sobre a horta,
 * numa arena fechada vista de cima, por 75 s: acelera, freia e vira; a ERVILHA é o tiro reto (lento e gordo), e a CENOURA
 * TELEGUIADA, de segurar e soltar, persegue o alvo (uma por vez: a próxima só depois de ela acertar ou sumir). A curva fechada
 * na cerca protege por um instante. Cada um aguenta dois acertos e cai no terceiro; o último no ar ganha, e, acabando o
 * tempo, quem tem mais vida.
 *
 * A REDE, como no Estoura-balão (minijogo-balao.ts): cada um voa no próprio computador e manda a posição a cada 4 passos (as
 * AMOSTRAS); o servidor dá a largada, confere que o avião podia ter ido de uma à outra, e repassa. O relógio é UM SÓ: os passos
 * contam desde o sinal verde do servidor, e não param com a janela sem foco.
 *
 * QUEM DECIDE SE FOI ATINGIDO: a ervilha e a cenoura são contas que os dois lados fazem iguais (duelo-sim.ts), e a cenoura se
 * guia pelas amostras do alvo, que o servidor tem (são as que ele aceitou). Por isso:
 * - quem LEVA avisa na hora ("acertou"), e o servidor confere contra a última posição dela (o caminho rápido, o honesto);
 * - o servidor REFAZ, a cada posição que chega, o caminho que a própria pessoa disse ter feito contra os tiros vivos: quem
 *   passou por uma ervilha ou uma cenoura e não avisou, leva do mesmo jeito;
 * - quem fica CALADO (parou de mandar posição) fica parado, para o servidor, onde estava: vira alvo parado, e a cenoura que o
 *   persegue vai até a última amostra dele.
 * O que sobra possível: mandar posições inventadas que desviam. Elas são o avião que a turma vê, e não andam mais que o avião
 * acelerando; na prática, é desviar de verdade. E quem está colado na cerca pode dizer que fez a curva fechada sem fazer.
 *
 * O SOLO: contra 1 a 3 aviões do computador, a partida inteira roda no navegador (web/src/duelo/), e aqui só se guarda o fim,
 * sem troféu (o troféu é um registro entre amigos).
 */
import * as db from './db.js';
import {
  ARENA,
  caminhoDoMissil,
  DURACAO_PASSOS,
  ervilhaNoPasso,
  GIRO_MAXIMO,
  INVULNERAVEL,
  LARGADAS,
  largada,
  naArena,
  noCaminho,
  PASSOS_POR_SEGUNDO,
  protegido,
  RAIO_DA_ERVILHA,
  RAIO_DO_AVIAO,
  RAIO_DO_MISSIL,
  RECARGA_DA_ERVILHA,
  SEM_TIRO,
  VEL_MAX,
  VIDA_DA_ERVILHA,
  VIDA_DO_MISSIL,
  VIDAS,
  type Missil,
  type Tiro,
} from './duelo-sim.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';
import { idsDosRobos, nomeDoRobo } from './minijogo-robos.js';

/** A contagem da largada: 3 s, mais 1 s para todo mundo abrir a tela. */
export const LARGADA_MS = 4000;
/** Passado o tempo, a partida espera isto pelas últimas posições antes de fechar. */
export const FOLGA_DO_FIM_MS = 1500;
/** A posição pode estar até 1 s à frente do relógio do servidor (a largada de cada um chega com o atraso da rede). */
export const PASSOS_DE_FOLGA = 60;
/** O quanto o avião anda por passo, no máximo (acelerando), com folga. */
const ANDA_POR_PASSO = (VEL_MAX / PASSOS_POR_SEGUNDO) * 1.1;
const FOLGA_DA_POSICAO = 4;
/** Calado há mais que isto, o avião fica parado (para o servidor) onde estava. */
export const SILENCIO_MS = 1500;
const TIQUE_MS = 250;
/** O "acertou" de quem levou: a posição dela estava no máximo a isto do tiro. */
const PERTO_DO_ACERTO = 20;
/** A conferência do próprio servidor usa um raio um pouco MENOR que o do site: entre duas amostras, o caminho é uma reta. */
const RAIO_DO_SERVIDOR = 1.5;
/** Até 3 aviões do computador no Solo. */
export const ROBOS_DO_DUELO = 3;

interface Jogador {
  largada: number;
  vidas: number;
  /** Quantos acertos deu nos outros, e quantos levou. */
  acertos: number;
  levou: number;
  vivo: boolean;
  /** A ordem em que caiu (1 = o primeiro); null enquanto voa. */
  saiuNa: number | null;
  ultimoAcerto: number;
  ultimaErvilha: number;
  /** A cenoura no ar (o id), se houver: uma por vez. */
  missil: string | null;
  /** As amostras aceitas (n, x, y, hx, hy, em ordem): a cenoura que persegue este avião se guia por elas. */
  amostras: number[];
  ultima: { n: number; x: number; y: number; hx: number; hy: number; em: number };
  conferidoAte: number;
}

type TiroVivo = { tipo: 'ervilha'; id: string; dono: number; tiro: Tiro; fim: number } | { tipo: 'missil'; id: string; dono: number; missil: Missil; fim: number };

export interface LinhaDoDuelo {
  userId: number;
  username: string;
  avatar: number | null;
  largada: number;
  vidas: number;
  acertos: number;
  vivo: boolean;
  posicao: number | null;
}

export const dueloDeAvioes: Definicao = criarDueloDeAvioes();

export function criarDueloDeAvioes({ agora = Date.now }: { agora?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: LARGADAS.length,
    comecar(ctx, { naSala }) {
      if (ctx.solo) return comecarSolo(ctx, naSala, agora);
      const inscritos = [...naSala].slice(0, LARGADAS.length);
      const evento = `duelo-${ctx.comunidade ?? 0}-${agora()}`;
      const avatares = new Map(inscritos.map((id) => [id, db.findUserById(id)?.avatarPronto ?? null]));
      const jogadores = new Map<number, Jogador>(
        inscritos.map((id, i) => {
          const a = largada(i);
          return [
            id,
            {
              largada: i,
              vidas: VIDAS,
              acertos: 0,
              levou: 0,
              vivo: true,
              saiuNa: null,
              ultimoAcerto: -Infinity,
              ultimaErvilha: -Infinity,
              missil: null,
              amostras: [],
              ultima: { n: 0, x: a.x, y: a.y, hx: a.hx, hy: a.hy, em: 0 },
              conferidoAte: 0,
            },
          ];
        }),
      );
      let fase: 'largada' | 'jogando' | 'fim' = 'largada';
      let verdeEm = 0;
      let saidas = 0;
      const tiros = new Map<string, TiroVivo>();
      /** Os tiros que já acertaram alguém: somem para todos. */
      const gastos = new Set<string>();
      let ficaram: Set<number> | null = null;
      let tique: ReturnType<typeof setInterval> | null = null;

      const passoAgora = () => Math.floor(((agora() - verdeEm) * PASSOS_POR_SEGUNDO) / 1000);
      const presentes = () => new Set(ctx.naSala());
      const difundir = (dados: unknown) => ctx.difundir?.(dados);

      /** `o` ficou na frente de `l`: quem voa na frente; entre eles, mais vida, depois mais acertos; quem caiu depois, na frente. */
      const naFrente = (o: Jogador, l: Jogador) =>
        o.vivo !== l.vivo
          ? o.vivo
          : o.vivo
            ? o.vidas > l.vidas || (o.vidas === l.vidas && o.acertos > l.acertos)
            : (o.saiuNa ?? 0) > (l.saiuNa ?? 0);

      const classificacao = (): LinhaDoDuelo[] => {
        const contam = ficaram ?? presentes();
        const linhas = inscritos.map((userId) => ({ userId, j: jogadores.get(userId)! }));
        const ficou = linhas.filter((l) => contam.has(l.userId));
        const ordenar = (a: { j: Jogador; userId: number }, b: { j: Jogador; userId: number }) =>
          naFrente(a.j, b.j) ? -1 : naFrente(b.j, a.j) ? 1 : ctx.nome(a.userId).localeCompare(ctx.nome(b.userId));
        const linha = (l: { userId: number; j: Jogador }, posicao: number | null): LinhaDoDuelo => ({
          userId: l.userId,
          username: ctx.nome(l.userId),
          avatar: avatares.get(l.userId) ?? null,
          largada: l.j.largada,
          vidas: l.j.vidas,
          acertos: l.j.acertos,
          vivo: l.j.vivo,
          posicao,
        });
        return [
          ...ficou.sort(ordenar).map((l) => linha(l, 1 + ficou.filter((o) => naFrente(o.j, l.j)).length)),
          ...linhas.filter((l) => !contam.has(l.userId)).sort(ordenar).map((l) => linha(l, null)),
        ];
      };

      const pararTique = () => {
        if (tique) clearInterval(tique);
        tique = null;
      };

      const fechar = () => {
        if (fase === 'fim') return;
        pararTique();
        fase = 'fim';
        ficaram = new Set(inscritos.filter((id) => presentes().has(id)));
        const turma = classificacao().filter((l) => l.posicao !== null);
        if (turma.length >= 2) {
          for (const l of turma) {
            if (l.posicao === null || l.posicao > 3) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'duelo',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.vidas,
              rivais: turma.map((o) => o.userId).filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(true);
      };

      /** Sobrou um (ou ninguém) no ar, entre quem está na sala: acabou. */
      const conferirFim = () => {
        if (fase !== 'jogando') return;
        const aqui = presentes();
        const vivos = inscritos.filter((id) => aqui.has(id) && jogadores.get(id)!.vivo);
        if (vivos.length <= 1) fechar();
      };

      /** O caminho de uma cenoura até o passo `ate`, pelas amostras do alvo que este servidor aceitou. */
      const caminhoDe = (t: Extract<TiroVivo, { tipo: 'missil' }>, ate: number) => caminhoDoMissil(t.missil, jogadores.get(t.missil.alvo)?.amostras ?? [], ate) ?? [];

      /** Onde está o tiro no passo `s`. */
      const ondeEsta = (t: TiroVivo, s: number, caminho?: number[]) =>
        t.tipo === 'ervilha' ? ervilhaNoPasso(t.tiro, s) : noCaminho(caminho ?? caminhoDe(t, s), t.missil.n, s);

      /**
       * A CENOURA AINDA ESTÁ NO AR? Até acertar, acabar a vida, o alvo cair, ou quebrar na cerca — esta última só quando as
       * amostras do alvo já cobrem o passo da quebra (antes disso, o caminho ainda pode mudar).
       */
      const missilNoAr = (id: string | null) => {
        if (!id || gastos.has(id)) return false;
        const t = tiros.get(id);
        if (!t || t.tipo !== 'missil') return false;
        const agoraN = passoAgora();
        if (agoraN > t.missil.n + VIDA_DO_MISSIL) return false;
        const alvo = jogadores.get(t.missil.alvo);
        if (!alvo || !alvo.vivo) return false;
        const caminho = caminhoDe(t, agoraN);
        const quebrou = t.missil.n + caminho.length / 2 - 1;
        const firme = (alvo.amostras.at(-5) ?? 0) + 1;
        return !(quebrou < Math.min(agoraN, t.missil.n + VIDA_DO_MISSIL) && quebrou + 1 <= firme);
      };

      /**
       * O TIRO PEGOU `quem` NO PASSO `s`. Dentro de 1,5 s depois do último acerto, ou na curva fechada na cerca, nada pega (e
       * o tiro segue); senão, uma vida a menos. Todo mundo fica sabendo pelo `difundir` (inclusive quem levou, que pode não
       * ter visto: é assim que a tela dele se acerta).
       */
      const acertar = (quem: number, t: TiroVivo, s: number): boolean => {
        const j = jogadores.get(quem);
        if (!j || !j.vivo || gastos.has(t.id) || t.dono === quem) return false;
        if (s < j.ultimoAcerto + INVULNERAVEL || protegido(j.amostras, s)) return false;
        gastos.add(t.id);
        tiros.delete(t.id);
        j.vidas--;
        j.levou++;
        j.ultimoAcerto = s;
        const dono = jogadores.get(t.dono);
        if (dono) {
          dono.acertos++;
          if (dono.missil === t.id) dono.missil = null;
        }
        if (j.vidas <= 0) {
          j.vidas = 0;
          j.vivo = false;
          j.saiuNa = ++saidas;
        }
        difundir({ tipo: 'acerto', alvo: quem, id: t.id, dono: t.dono, vidas: j.vidas, n: s });
        ctx.avisar();
        conferirFim();
        return true;
      };

      /** Confere o caminho de `quem` entre duas posições (uma reta, passo a passo) contra os tiros vivos. */
      const conferirCaminho = (quem: number, de: { n: number; x: number; y: number }, ate: { n: number; x: number; y: number }) => {
        const j = jogadores.get(quem)!;
        const inicio = Math.max(de.n, j.conferidoAte) + 1;
        if (ate.n < inicio) return;
        j.conferidoAte = ate.n;
        for (const t of [...tiros.values()]) {
          if (t.dono === quem || gastos.has(t.id)) continue;
          const s0 = Math.max(inicio, t.tipo === 'ervilha' ? t.tiro.n : t.missil.n), s1 = Math.min(ate.n, t.fim);
          if (s1 < s0) continue;
          const caminho = t.tipo === 'missil' ? caminhoDe(t, s1) : undefined;
          const raio = (t.tipo === 'ervilha' ? RAIO_DA_ERVILHA : RAIO_DO_MISSIL) - RAIO_DO_SERVIDOR;
          for (let s = s0; s <= s1; s++) {
            const p = ondeEsta(t, s, caminho);
            if (!p) continue;
            const k = ate.n > de.n ? (s - de.n) / (ate.n - de.n) : 1;
            const x = de.x + (ate.x - de.x) * k, y = de.y + (ate.y - de.y) * k;
            const dx = p[0] - x, dy = p[1] - y;
            if (dx * dx + dy * dy < raio * raio && acertar(quem, t, s)) break;
          }
          if (!j.vivo) return;
        }
      };

      /** O tique: quem ficou calado fica parado onde estava (e os tiros o pegam lá); os tiros velhos saem; o tempo acaba. */
      const tiquetaquear = () => {
        if (fase !== 'jogando') return;
        const n = passoAgora();
        for (const [id, t] of tiros) if (t.fim < n - PASSOS_DE_FOLGA) tiros.delete(id);
        for (const [id, j] of jogadores) {
          if (!j.vivo || agora() - j.ultima.em < SILENCIO_MS) continue;
          const parado = { n, x: j.ultima.x, y: j.ultima.y };
          conferirCaminho(id, { ...parado, n: j.conferidoAte }, parado);
        }
        conferirFim();
      };

      const jogar = () => {
        fase = 'jogando';
        verdeEm = agora();
        for (const j of jogadores.values()) j.ultima.em = verdeEm;
        ctx.agendar((DURACAO_PASSOS * 1000) / PASSOS_POR_SEGUNDO + FOLGA_DO_FIM_MS, fechar);
        tique = setInterval(tiquetaquear, TIQUE_MS);
        tique.unref?.();
        ctx.avisar();
      };
      ctx.agendar(LARGADA_MS, jogar);

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      /**
       * A POSIÇÃO TEM DE SER UMA QUE O AVIÃO ALCANÇA: o passo só cresce e não passa do relógio do servidor (mais a folga), a
       * distância desde a anterior cabe no avião acelerando, o ponto está dentro da cerca, a direção é um vetor de tamanho 1, e
       * ela não vira mais depressa que o avião freando — a não ser que ele tenha encostado na cerca, onde ele quica.
       */
      const aceitarPosicao = (quem: number, j: Jogador, x: number, y: number, hx: number, hy: number, n: number): boolean => {
        if (!Number.isInteger(n) || n <= j.ultima.n) return false;
        if (n > passoAgora() + PASSOS_DE_FOLGA) return false;
        if (!naArena(x, y, 0.5)) return false;
        const tam = Math.hypot(hx, hy);
        if (tam < 0.97 || tam > 1.03) return false;
        const u = j.ultima;
        const passos = Math.min(n - u.n, ((agora() - u.em) * PASSOS_POR_SEGUNDO) / 1000 + 60);
        if (Math.hypot(x - u.x, y - u.y) > passos * ANDA_POR_PASSO + FOLGA_DA_POSICAO) return false;
        const virou = Math.acos(Math.max(-1, Math.min(1, (hx * u.hx + hy * u.hy) / tam)));
        const naCerca = (px: number, py: number) =>
          px < ARENA[0] + RAIO_DO_AVIAO + 12 || px > ARENA[2] - RAIO_DO_AVIAO - 12 || py < ARENA[1] + RAIO_DO_AVIAO + 12 || py > ARENA[3] - RAIO_DO_AVIAO - 12;
        if (virou > (n - u.n) * GIRO_MAXIMO * 1.2 + 0.05 && !naCerca(x, y) && !naCerca(u.x, u.y)) return false;
        const antes = j.ultima;
        j.ultima = { n, x, y, hx, hy, em: agora() };
        j.amostras.push(n, x, y, hx, hy);
        conferirCaminho(quem, antes, j.ultima);
        return true;
      };

      return {
        publico: () => ({
          fase,
          partidaId: evento,
          decorridoMs: fase === 'jogando' ? agora() - verdeEm : null,
          duracaoMs: (DURACAO_PASSOS * 1000) / PASSOS_POR_SEGUNDO,
          jogadores: classificacao(),
        }),
        acao: () => 'Ação desconhecida.',
        tempoReal(quem, dados) {
          const j = jogadores.get(quem);
          if (!j || !j.vivo || fase !== 'jogando' || !dados || typeof dados !== 'object') return null;
          const d = dados as Record<string, unknown>;
          // A POSIÇÃO (a amostra)
          if (d.tipo === undefined) {
            const { x, y, hx, hy, n } = d;
            if (!numero(x) || !numero(y) || !numero(hx) || !numero(hy) || !numero(n)) return null;
            if (!aceitarPosicao(quem, j, x, y, hx, hy, n)) return null;
            if (!j.vivo) return null;
            return { userId: quem, n, x, y, hx, hy };
          }
          const u = j.ultima;
          // O "ACERTOU" DE QUEM LEVOU: o tiro existe, não é dela, e a última posição dela estava perto dele
          if (d.tipo === 'acertou') {
            if (typeof d.id !== 'string' || !numero(d.n)) return null;
            const t = tiros.get(d.id);
            if (!t || gastos.has(d.id) || t.dono === quem || Math.abs(u.n - d.n) > 8) return null;
            const p = ondeEsta(t, u.n);
            if (!p || Math.hypot(p[0] - u.x, p[1] - u.y) > PERTO_DO_ACERTO) return null;
            const s = Math.max(t.tipo === 'ervilha' ? t.tiro.n : t.missil.n, Math.round(d.n));
            acertar(quem, t, s);
            return null;
          }
          // UM TIRO: saindo de perto do avião, no relógio, e no ritmo da recarga (a cenoura, uma por vez)
          if (d.tipo !== 'ervilha' && d.tipo !== 'missil') return null;
          const { x, y, dx, dy } = d;
          if (!numero(d.n) || !Number.isInteger(d.n) || !numero(x) || !numero(y) || !numero(dx) || !numero(dy)) return null;
          const n = d.n;
          if (n < SEM_TIRO || n < u.n - 8 || n > passoAgora() + PASSOS_DE_FOLGA) return null;
          if (Math.hypot(x - u.x, y - u.y) > 30 || !naArena(x, y, 2)) return null;
          if (!(Math.hypot(dx, dy) > 1e-6)) return null;
          const id = `${quem}-${n}`;
          if (tiros.has(id) || gastos.has(id)) return null;
          if (d.tipo === 'ervilha') {
            if (n - j.ultimaErvilha < RECARGA_DA_ERVILHA) return null;
            j.ultimaErvilha = n;
            tiros.set(id, { tipo: 'ervilha', id, dono: quem, tiro: { n, x, y, dx, dy }, fim: n + VIDA_DA_ERVILHA });
            return { tipo: 'ervilha', id, dono: quem, n, x, y, dx, dy };
          }
          // a cenoura: um alvo que voa, e a anterior já fora do ar (a carga, segurar meio segundo, é da tela: não se confere)
          const alvo = d.alvo;
          if (typeof alvo !== 'number' || alvo === quem || !jogadores.get(alvo)?.vivo) return null;
          if (missilNoAr(j.missil)) return null;
          j.missil = id;
          tiros.set(id, { tipo: 'missil', id, dono: quem, missil: { n, x, y, dx, dy, alvo }, fim: n + VIDA_DO_MISSIL });
          return { tipo: 'missil', id, dono: quem, n, x, y, dx, dy, alvo };
        },
        conferir: tiquetaquear,
        parar: pararTique,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// O SOLO: a partida roda no navegador, contra aviões do computador; aqui só se confere e se guarda o fim.
// ---------------------------------------------------------------------------------------------------------------------

const PRAZO_DO_SOLO_MS = 10 * 60_000;

function comecarSolo(ctx: Contexto, naSala: number[], agora: () => number): Jogo {
  const quem = naSala[0];
  const inicio = agora();
  const evento = `duelo-solo-${quem}-${inicio}`;
  let fase: 'jogando' | 'fim' = 'jogando';
  let resultado: { posicao: number; total: number; vidas: number; acertos: number } | null = null;
  const terminar = (completa: boolean) => {
    if (fase === 'fim') return;
    fase = 'fim';
    ctx.avisar();
    ctx.terminar(completa);
  };
  ctx.agendar(PRAZO_DO_SOLO_MS, () => terminar(false));
  const robos = idsDosRobos(ROBOS_DO_DUELO).map((id) => ({ userId: id, username: nomeDoRobo(id) }));
  const avatar = db.findUserById(quem)?.avatarPronto ?? null;
  const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
  return {
    publico: () => ({ fase, solo: true, partidaId: evento, username: ctx.nome(quem), avatar, robos, resultadoDoSolo: resultado }),
    acao(autor, c) {
      if (autor !== quem) return 'Você está assistindo esta partida.';
      if (c.tipo !== 'fim') return 'Ação desconhecida.';
      if (fase !== 'jogando') return 'Esta rodada já acabou.';
      const { posicao, total, vidas, acertos, passos } = c;
      if (![posicao, total, vidas, acertos, passos].every(inteiro)) return 'Partida inválida.';
      const t = total as number, p = posicao as number;
      if (t < 2 || t > ROBOS_DO_DUELO + 1 || p < 1 || p > t) return 'Partida inválida.';
      if ((vidas as number) < 0 || (vidas as number) > VIDAS || (acertos as number) < 0 || (acertos as number) > (t - 1) * VIDAS) return 'Partida inválida.';
      if ((passos as number) < 0 || (passos as number) > DURACAO_PASSOS) return 'Partida inválida.';
      if (((passos as number) * 1000) / PASSOS_POR_SEGUNDO > agora() - inicio + 2000) return 'Partida inválida.';
      resultado = { posicao: p, total: t, vidas: vidas as number, acertos: acertos as number };
      terminar(true);
      return null;
    },
  };
}
