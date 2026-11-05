/**
 * O FUTEBOL DOS COELHOS (05/11/2026, pedido dele): futebol de campo pequeno, visto de cima, com a turma na sala ou no Solo contra
 * robôs. SÓ A MECÂNICA dos futebóis de fliperama; os jogadores são os da Kenney (Sports Pack, CC0) com orelhas de coelho, e a
 * regra mora em futebol-sim.ts (duas cópias iguais, a do site e esta).
 *
 * NA SALA, A BOLA É DO SERVIDOR (como os inimigos da Briga), e o atraso perceptível no chute foi aceito por ele:
 * - Um passo próprio de 20 por segundo (3 passos da simulação a cada 50 ms) anda a bola e os robôs, e manda o quadro a todos
 *   pelo `difundir`.
 * - CADA COELHO É DE QUEM JOGA: ele anda no computador da pessoa e manda a posição ~20 vezes por segundo; o servidor confere a
 *   velocidade (o que se pode andar se acumula com o tempo, com folga para a rede) e o campo. Quem conduz a bola a leva na
 *   frente da posição que mandou.
 * - QUEM CHUTA TEM RAZÃO, com folga limitada: o site manda o chute com a posição e o vetor; o servidor procura no passado da
 *   bola (os últimos 300 ms) um instante em que ela era de quem chutou, ou estava solta e encostada nele, e em que ninguém a
 *   chutou depois. Achou: a bola sai de lá e anda os passos que passaram desde então (é o que a tela de quem chutou já
 *   mostrou). A posição do chute tem de estar perto de onde o servidor viu a pessoa. O DOMÍNIO da bola solta segue a mesma
 *   ideia: quem encostou nela como a tela dele mostrava, nos últimos 300 ms, fica com ela.
 * - Os times se equilibram com ROBÔS (o número ímpar, ou poucos: no mínimo 2 por time). Quem sai da sala deixa o coelho com o
 *   computador até voltar.
 *
 * O que continua possível pelo console, entre amigos: mirar o chute com precisão de máquina (o vetor é do site) e mentir a
 * posição dentro do limite de velocidade. Não dá para chutar uma bola longe, nem chutar mais forte que o chute carregado.
 *
 * NO SOLO, a partida inteira roda no navegador (a mesma simulação, com os robôs locais, sem rede no meio) e o servidor só
 * recebe o placar no fim, com o tamanho conferido. Contra o computador não há troféu nem conquista.
 *
 * OS TROFÉUS: na sala, com 2 pessoas ou mais que ficaram até o fim, cada uma ganha o dela (pista 'futebol'): 1º quem venceu, 2º
 * quem perdeu; no empate, todos dividem o 1º. Os pontos são os gols do time.
 */
import * as db from './db.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';
import { ehRobo, idsDosRobos, MAXIMO_DE_ROBOS, nomeDoRobo } from './minijogo-robos.js';
import {
  ALCANCE,
  aplicarChute,
  CHUTE_MAX,
  comandoDoRobo,
  CONTAGEM,
  contatos,
  darBola,
  DOMINIO_MAX,
  foraDoCentro,
  frenteDe,
  GOL_PAUSA,
  marcarGol,
  MAXIMO_POR_TIME,
  novoMundo,
  PARTIDA_PASSOS,
  passoDaBola,
  passoDoMundo,
  PASSOS_POR_SEGUNDO,
  prenderNoCampo,
  VEL,
  type Evento,
  type Jogador,
  type Mundo,
} from './futebol-sim.js';

export const PASSO_MS = 50;
export const PASSOS_POR_QUADRO = 3;
/** O passado da bola que vale para o chute e o domínio (300 ms). */
export const HISTORIA_PASSOS = 18;
/** O chute vem de perto de onde o servidor viu quem chutou, e a bola estava perto dele. */
export const FOLGA_POSICAO = 28;
export const FOLGA_ALCANCE = 8;
/** A posição não anda mais que FOLGA_VEL vezes a velocidade, e o que sobra se acumula até ACUMULO (px), para a rede. */
export const FOLGA_VEL = 1.35;
export const ACUMULO = 24;
/** O "Fim de jogo" na tela antes do placar. */
export const FIM_MS = 3000;
/** Uma partida da sala que não acabou nisto (o passo travou) acaba sozinha. */
export const PRAZO_MS = 10 * 60_000;
/** O Solo: 3 minutos de bola rolando, com as pausas e a janela sem foco (que pausa a partida); depois disto, fecha. */
export const PRAZO_DO_SOLO_MS = 30 * 60_000;
export const FOLGA_DO_RELOGIO_MS = 3000;
export const GOLS_MAX = 200;

interface Balde {
  fichas: number;
  em: number;
  max: number;
  porSeg: number;
}

interface Pessoa {
  userId: number;
  avatar: number | null;
  ultimaEm: number;
  credito: number;
  /** O relógio do site (ms) da última posição, devolvido no quadro: o site mede o tempo de ida e volta. */
  eco: number;
  ultimoChute: number;
  baldes: { pos: Balde; chute: Balde };
  /** Em que reinício o site dela está (a posição de antes da volta ao meio não vale). */
  reinicio: number;
}

interface Instante {
  tempo: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dono: number;
  versao: number;
}

export interface OpcoesDoFutebol {
  agora?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
}

export const futebol: Definicao = criarFutebol();

/** Quantos por time: metade da turma (o ímpar ganha um robô), no mínimo 2 e no máximo 4. */
export function tamanhoDoTime(pessoas: number): number {
  return Math.max(2, Math.min(MAXIMO_POR_TIME, Math.ceil(pessoas / 2)));
}

export function criarFutebol({
  agora = Date.now,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    h.unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
}: OpcoesDoFutebol = {}): Definicao {
  return {
    minimo: 2,
    maximo: MAXIMO_POR_TIME * 2,
    comecar(ctx, { naSala, corpo }) {
      if (ctx.solo) return comecarSolo(ctx, naSala, corpo, agora);
      const humanos = [...naSala].slice(0, MAXIMO_POR_TIME * 2);
      if (humanos.length === 0) return 'Ninguém para jogar.';
      const porTime = tamanhoDoTime(humanos.length);
      const times: [number[], number[]] = [[], []];
      humanos.forEach((id, k) => times[k % 2].push(id));
      let proximoRobo = 1;
      for (const t of times) while (t.length < porTime) t.push(-proximoRobo++);
      const m = novoMundo(times);
      for (const j of m.jogadores) if (!ehRobo(j.id)) j.externo = true;
      const evento = `futebol-${ctx.comunidade ?? 0}-${agora()}`;

      const balde = (max: number, porSeg: number): Balde => ({ fichas: max, em: agora(), max, porSeg });
      const gastar = (b: Balde) => {
        const t = agora();
        b.fichas = Math.min(b.max, b.fichas + ((t - b.em) / 1000) * b.porSeg);
        b.em = t;
        if (b.fichas < 1) return false;
        b.fichas -= 1;
        return true;
      };
      const pessoas = new Map<number, Pessoa>(
        humanos.map((userId) => [
          userId,
          {
            userId,
            avatar: db.findUserById(userId)?.avatarPronto ?? null,
            ultimaEm: agora(),
            credito: ACUMULO,
            eco: 0,
            ultimoChute: 0,
            // a posição vem ~20 por segundo; o chute, uns poucos por segundo no máximo
            baldes: { pos: balde(12, 30), chute: balde(4, 6) },
            reinicio: m.reinicios,
          },
        ]),
      );

      let fase: 'jogando' | 'fim' = 'jogando';
      let relogio: unknown = null;
      const historia: Instante[] = [];
      /** Os chutes do site, aceitos ou recusados, para o quadro: [id, número do chute, 1 aceito / 0 recusado]. */
      let respostas: number[][] = [];
      let eventos: Evento[] = [];
      let resultado: Resultado | null = null;
      /** Por que o último chute ou posição não valeu (para o teste). */
      let ultimoMotivo: string | null = null;

      const guardarInstante = () => {
        const b = m.bola;
        historia.push({ tempo: m.tempo, x: b.x, y: b.y, vx: b.vx, vy: b.vy, dono: b.dono, versao: b.versao });
        while (historia.length > HISTORIA_PASSOS + 2) historia.shift();
      };
      guardarInstante();

      const naSalaAgora = () => new Set(ctx.naSala());

      const tick = () => {
        if (fase !== 'jogando') return;
        const aqui = naSalaAgora();
        // quem saiu deixa o coelho com o computador; quem voltou o pega de volta
        for (const j of m.jogadores) {
          if (ehRobo(j.id)) continue;
          const presente = aqui.has(j.id);
          j.externo = presente;
          j.robo = !presente;
        }
        if (!humanos.some((id) => aqui.has(id))) return acabar(false);
        for (let k = 0; k < PASSOS_POR_QUADRO && !m.fim; k++) {
          passoDoMundo(m, (j) => (j.externo ? null : comandoDoRobo(m, j)));
          eventos.push(...m.eventos);
          guardarInstante();
        }
        difundir();
        if (m.fim) acabar(true);
      };

      const r1 = (v: number) => Math.round(v * 10) / 10;
      const r2 = (v: number) => Math.round(v * 100) / 100;
      const difundir = () => {
        const b = m.bola;
        ctx.difundir?.({
          tipo: 'q',
          n: m.tempo,
          p: m.passo,
          pa: m.pausa,
          r: m.reinicios,
          ce: m.centro ? 1 : 0,
          sa: m.saida,
          g: m.placar,
          fim: m.fim ? 1 : 0,
          b: [r1(b.x), r1(b.y), r2(b.vx), r2(b.vy), b.dono, b.versao, b.protege],
          j: m.jogadores.map((j) => [
            j.id,
            r1(j.x),
            r1(j.y),
            r2(j.vx),
            r2(j.vy),
            r2(j.fx),
            r2(j.fy),
            j.carga,
            j.tonto,
            j.externo ? (pessoas.get(j.id)?.eco ?? 0) : 0,
          ]),
          c: respostas,
          e: eventos.map(eventoCurto),
        });
        respostas = [];
        eventos = [];
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      const acabar = (completa: boolean) => {
        if (fase === 'fim') return;
        parar();
        fase = 'fim';
        const aqui = naSalaAgora();
        const ficaram = humanos.filter((id) => aqui.has(id));
        const venceu: 0 | 1 | -1 = m.placar[0] > m.placar[1] ? 0 : m.placar[1] > m.placar[0] ? 1 : -1;
        resultado = {
          placar: [m.placar[0], m.placar[1]],
          venceu,
          jogadores: m.jogadores.map((j) => ({ userId: j.id, username: ctx.nome(j.id), time: j.time, gols: j.gols, robo: ehRobo(j.id) })),
        };
        if (completa && ficaram.length >= 2) {
          for (const id of ficaram) {
            const j = m.jogadores.find((x) => x.id === id)!;
            db.guardarTrofeu({
              userId: id,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'futebol',
              posicao: venceu === -1 || venceu === j.time ? 1 : 2,
              tempoMs: null,
              pontos: m.placar[j.time],
              rivais: ficaram.filter((o) => o !== id),
            });
          }
        }
        ctx.avisar();
        ctx.terminar(completa);
      };

      ctx.agendar(PRAZO_MS, () => acabar(false));

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
      const unitario = (fx: number, fy: number): [number, number] | null => {
        const n = Math.sqrt(fx * fx + fy * fy);
        return n > 0.01 ? [fx / n, fy / n] : null;
      };

      const posicao = (p: Pessoa, j: Jogador, d: Record<string, unknown>): string | null => {
        const { x, y, vx, vy, fx, fy, r, ts } = d;
        if (![x, y].every(numero)) return 'números';
        if (numero(ts)) p.eco = Math.max(0, Math.min(1e9, Math.round(ts)));
        const t = agora();
        const dt = Math.max(0, (t - p.ultimaEm) / 1000);
        p.ultimaEm = t;
        p.credito = Math.min(ACUMULO, p.credito + VEL * PASSOS_POR_SEGUNDO * FOLGA_VEL * dt);
        // o site ainda não viu a volta ao meio: a posição de antes não vale (ele vai pular para a formação)
        if (r !== m.reinicios) return 'reinício';
        if (m.pausa > 0) return 'pausa';
        const alvo = { x: x as number, y: y as number, time: j.time };
        prenderNoCampo(alvo);
        foraDoCentro(m, alvo);
        const dx = alvo.x - j.x;
        const dy = alvo.y - j.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // não mais rápido que o coelho anda: o que passa do crédito fica no caminho
        const anda = Math.min(dist, p.credito);
        if (dist > 0.001) {
          j.x += (dx / dist) * anda;
          j.y += (dy / dist) * anda;
        }
        p.credito -= anda;
        if (numero(vx) && numero(vy)) {
          const v = Math.sqrt((vx as number) ** 2 + (vy as number) ** 2);
          const k = v > VEL * 1.2 ? (VEL * 1.2) / v : 1;
          j.vx = (vx as number) * k;
          j.vy = (vy as number) * k;
        }
        if (numero(fx) && numero(fy)) {
          const u = unitario(fx as number, fy as number);
          if (u) [j.fx, j.fy] = u;
        }
        if (numero(d.c)) j.carga = Math.max(0, Math.min(45, Math.round(d.c as number)));
        // QUEM ENCOSTOU TEM RAZÃO: a bola solta, encostada nele como a tela dele mostrava (os últimos 300 ms), e sem chute desde então
        const b = m.bola;
        if (b.dono === 0 && j.semDominio === 0 && j.tonto === 0 && !(m.centro && j.time !== m.saida)) {
          for (let k = historia.length - 1; k >= 0; k--) {
            const h = historia[k];
            if (m.tempo - h.tempo > HISTORIA_PASSOS) break;
            if (h.versao !== b.versao || h.dono !== 0) continue;
            if (h.vx * h.vx + h.vy * h.vy > DOMINIO_MAX * DOMINIO_MAX) continue;
            const ex = h.x - j.x;
            const ey = h.y - j.y;
            if (ex * ex + ey * ey <= (ALCANCE + 2) * (ALCANCE + 2)) {
              m.eventos = [];
              darBola(m, j);
              contatos(m);
              eventos.push(...m.eventos);
              m.eventos = [];
              break;
            }
          }
        }
        return null;
      };

      const chute = (p: Pessoa, j: Jogador, d: Record<string, unknown>): string | null => {
        const { x, y, vx, vy, fx, fy, s } = d;
        if (![x, y, vx, vy, s].every(numero)) return 'números';
        if (!Number.isInteger(s) || (s as number) <= p.ultimoChute) return 'chute repetido';
        p.ultimoChute = s as number;
        if (m.pausa > 0 || m.fim) return 'pausa';
        if (j.tonto > 0) return 'tonto';
        const v = Math.sqrt((vx as number) ** 2 + (vy as number) ** 2);
        if (v > CHUTE_MAX + 0.01 || v < 0.5) return 'força';
        const ex = (x as number) - j.x;
        const ey = (y as number) - j.y;
        if (ex * ex + ey * ey > FOLGA_POSICAO * FOLGA_POSICAO) return 'longe de si';
        const b = m.bola;
        // o instante do passado em que a bola era dele, ou estava solta e encostada nele, sem chute de ninguém depois
        let achou: Instante | null = null;
        for (let k = historia.length - 1; k >= 0; k--) {
          const h = historia[k];
          if (m.tempo - h.tempo > HISTORIA_PASSOS) break;
          if (h.versao !== b.versao) break;
          if (h.dono === j.id) {
            achou = h;
            break;
          }
          if (h.dono === 0) {
            const bx = h.x - (x as number);
            const by = h.y - (y as number);
            if (bx * bx + by * by <= (ALCANCE + FOLGA_ALCANCE) * (ALCANCE + FOLGA_ALCANCE)) {
              achou = h;
              break;
            }
          }
        }
        if (!achou) return 'longe da bola';
        // valeu: o coelho onde ele disse, a bola de onde estava, e os passos que já passaram desde lá
        j.x = x as number;
        j.y = y as number;
        prenderNoCampo(j);
        if (numero(fx) && numero(fy)) {
          const u = unitario(fx as number, fy as number);
          if (u) [j.fx, j.fy] = u;
        }
        if (achou.dono === j.id) {
          b.dono = j.id;
          const [bx, by] = frenteDe(j);
          b.x = bx;
          b.y = by;
        } else {
          b.dono = 0;
          b.x = achou.x;
          b.y = achou.y;
        }
        m.eventos = [];
        aplicarChute(m, j, vx as number, vy as number, d.passe === true);
        eventos.push(...m.eventos);
        const passaram = Math.min(HISTORIA_PASSOS, m.tempo - achou.tempo);
        for (let k = 0; k < passaram; k++) {
          m.eventos = [];
          const gol = passoDaBola(m, true);
          if (gol >= 0) {
            marcarGol(m, gol as 0 | 1);
            eventos.push(...m.eventos);
            break;
          }
          contatos(m);
          eventos.push(...m.eventos);
          if (m.bola.dono !== 0) break;
        }
        m.eventos = [];
        guardarInstante();
        return null;
      };

      relogio = intervalo(tick, PASSO_MS);

      const jogo: Jogo = {
        publico(quem) {
          const meu = m.jogadores.find((j) => j.id === quem);
          return {
            fase,
            solo: false,
            porTime,
            meuTime: meu ? meu.time : null,
            times: [0, 1].map((time) =>
              m.jogadores
                .filter((j) => j.time === time)
                .map((j) => ({
                  userId: j.id,
                  username: ehRobo(j.id) ? nomeDoRobo(j.id) : ctx.nome(j.id),
                  robo: ehRobo(j.id),
                  avatar: pessoas.get(j.id)?.avatar ?? null,
                  slot: j.slot,
                })),
            ),
            placar: m.placar,
            resultado,
            partidaId: evento,
          };
        },
        acao(quem) {
          // tudo do futebol vem pelo tempo real; a ação HTTP não faz nada
          if (!pessoas.has(quem)) return 'Você está assistindo esta partida.';
          return 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const p = pessoas.get(quem);
          const j = m.jogadores.find((x) => x.id === quem);
          if (!p || !j || fase !== 'jogando' || !dados || typeof dados !== 'object') return null;
          const d = dados as Record<string, unknown>;
          if (!j.externo) return null;
          if (d.tipo === 'pos') {
            if (gastar(p.baldes.pos)) ultimoMotivo = posicao(p, j, d);
          } else if (d.tipo === 'chute') {
            if (!gastar(p.baldes.chute)) ultimoMotivo = 'depressa demais';
            else {
              ultimoMotivo = chute(p, j, d);
              if (numero(d.s)) respostas.push([quem, d.s as number, ultimoMotivo === null ? 1 : 0]);
            }
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
      };
      // para o teste
      Object.assign(jogo, { _passo: tick, _mundo: m, _motivo: () => ultimoMotivo, _historia: historia });
      return jogo;
    },
  };
}

export interface Resultado {
  placar: [number, number];
  /** O time que venceu, ou -1 no empate. */
  venceu: 0 | 1 | -1;
  jogadores: { userId: number; username: string; time: 0 | 1; gols: number; robo: boolean }[];
}

/** Os eventos, curtos, para o quadro (o site os usa para o som e o "Gol!"). */
function eventoCurto(e: Evento): unknown[] {
  switch (e.tipo) {
    case 'chute':
      return ['c', e.id];
    case 'passe':
      return ['p', e.id];
    case 'dominio':
      return ['d', e.id];
    case 'roubo':
      return ['r', e.id, e.de];
    case 'quique':
      return ['q'];
    case 'gol':
      return ['g', e.time, e.autor, e.contra ? 1 : 0];
    case 'reinicio':
      return ['i'];
    case 'fim':
      return ['f'];
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// O SOLO: a partida roda no navegador; aqui só se confere e se guarda o placar do fim.
// ---------------------------------------------------------------------------------------------------------------------

function comecarSolo(ctx: Contexto, naSala: number[], corpo: Record<string, unknown>, agora: () => number): Jogo {
  const quem = naSala[0];
  const pedido = Math.floor(Number(corpo.formato) || 0);
  const formatoInicial = pedido >= 1 && pedido <= 3 ? pedido : null;
  const inicio = agora();
  const evento = `futebol-solo-${quem}-${inicio}`;
  let fase: 'jogando' | 'fim' = 'jogando';
  let resultado: { formato: number; gols: number; contra: number } | null = null;
  const terminar = (completa: boolean) => {
    if (fase === 'fim') return;
    fase = 'fim';
    ctx.avisar();
    ctx.terminar(completa);
  };
  ctx.agendar(PRAZO_DO_SOLO_MS, () => terminar(false));
  const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
  // o site joga a partida com os robôs dele: os nomes vão daqui (os mesmos do resto do Solo), e o avatar de quem joga
  const nomesDosRobos = idsDosRobos(MAXIMO_DE_ROBOS).map((id) => ({ userId: id, username: nomeDoRobo(id) }));
  const avatar = db.findUserById(quem)?.avatarPronto ?? null;
  return {
    publico() {
      return { fase, solo: true, formato: formatoInicial, resultadoDoSolo: resultado, username: ctx.nome(quem), avatar, robos: nomesDosRobos, partidaId: evento };
    },
    acao(autor, c) {
      if (autor !== quem) return 'Você está assistindo esta partida.';
      if (c.tipo !== 'fim') return 'Ação desconhecida.';
      if (fase !== 'jogando') return 'Esta rodada já acabou.';
      const { formato, gols, contra, passos, tempo } = c;
      if (![formato, gols, contra, passos, tempo].every(inteiro)) return 'Partida inválida.';
      if ((formato as number) < 1 || (formato as number) > 3) return 'Partida inválida.';
      if ((gols as number) < 0 || (contra as number) < 0 || (gols as number) > GOLS_MAX || (contra as number) > GOLS_MAX) return 'Partida inválida.';
      if (passos !== PARTIDA_PASSOS) return 'Partida inválida.';
      // o tempo inteiro: a contagem, os 3 minutos e as pausas de cada gol (no máximo uma por gol)
      const minimo = CONTAGEM + PARTIDA_PASSOS;
      const maximo = minimo + ((gols as number) + (contra as number)) * GOL_PAUSA;
      if ((tempo as number) < minimo || (tempo as number) > maximo) return 'Partida inválida.';
      // a janela sem foco pausa a partida (mais tempo), mas ninguém joga mais passos do que o relógio deixou
      if (((tempo as number) / PASSOS_POR_SEGUNDO) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Partida inválida.';
      resultado = { formato: formato as number, gols: gols as number, contra: contra as number };
      terminar(true);
      return null;
    },
  };
}

export type { Mundo };
