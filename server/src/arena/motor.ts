/**
 * A ARENA DOS COELHOS (17/11/2026, pedido dele: o modo de luta em tempo real dos Bichos da Toca, ao lado da mesa de turnos). SÓ A
 * MECÂNICA do gênero das arenas de bichos vistas de cima (andar livre, mirar com o mouse, a arrancada para desviar, o básico, o
 * secundário, o golpe forte e o especial que enche, trocar o bicho da frente, as zonas marcadas no chão e os suprimentos): nada
 * de nome, arte, bicho, som ou tabela de franquia nenhuma.
 *
 * QUEM LUTA SÃO OS COELHOS, cada um com o próprio (a receita do criador, pelo avatarDoJogo). Os BICHOS da equipe dão o ELEMENTO:
 * o da frente decide os golpes (o kit, conta.ts) e a defesa (a roda das vantagens de bichos-regras.ts, amaciada: fatorDaArena).
 * A equipe é a guardada na aventura (os três primeiros); sem ela, a emprestada, como na mesa. O NÍVEL NÃO CONTA na arena: só o
 * elemento (a aventura de um podia passar do 30, e a luta tem de ser de quem joga melhor).
 *
 * OS FORMATOS: 1×1, 3×3 (os times; os robôs de minijogo-robos.ts completam) e cada um por si. No Solo, contra 1 a 5 robôs (cada
 * um por si) ou no 3×3 com dois robôs do lado da pessoa. Vence o time que sobra; em 4 minutos, o que tem mais vida somada.
 *
 * A REDE É A DA BRIGA NA HORTA E DO COMANDO CENOURA (servidor na Alemanha, turma no Brasil, ~200 ms):
 * - CADA COELHO ANDA NO COMPUTADOR DE QUEM JOGA e manda a posição ~15 vezes por segundo; o servidor confere a velocidade (com o
 *   crédito à parte da arrancada e o do suprimento de velocidade), a cerca e os obstáculos, e que nada vem à frente do relógio.
 * - QUEM BATE TEM RAZÃO: cada golpe é anunciado com número, a tecla, a origem e a direção; o servidor confere a recarga do golpe
 *   (e o especial cheio) e que a origem está perto de onde ele viu quem bateu. A bala anda na tela de quem atirou; quando ela
 *   encosta em alguém COMO ELE APARECE NESSA TELA, o acerto vem ao servidor, que confere o caminho dela contra o PASSADO do alvo.
 * - QUEM APANHA TEM FOLGA: o golpe forte, o especial e as zonas da arena são MARCADOS no chão antes, e só são decididos GRACA_MS
 *   depois de bater; a pessoa só leva se TODAS as posições que mandou nessa janela estavam dentro. As balas dos robôs também.
 * - A vida, as zonas e os suprimentos são do servidor; o quadro de 20 por segundo leva tudo a todos pelo `difundir`.
 *
 * O que continua possível pelo console, entre amigos: mentir a posição dentro do limite de velocidade (desviar "perfeito"), e
 * mandar o acerto de uma bala que a tela errou por pouco (a folga é de FOLGA_BALA px e de ~300 ms de caminho). Não dá para bater
 * mais rápido que a recarga, nem usar o especial sem ele cheio, nem acertar quem está do outro lado da arena ou atrás de uma
 * árvore, nem andar mais que o coelho anda.
 *
 * O TROFÉU: fora do Solo, com 2 pessoas ou mais que ficaram até o fim, quem venceu (o time vencedor; cada um por si, até o 3º)
 * vai à estante do quarto ('bichos-arena'), os pontos sendo o dano causado. Contra o computador, nada.
 *
 * Este arquivo não fala com o banco (o avatar, a equipe e o troféu chegam por `servicos`): o teste roda a regra de verdade. O
 * que o Syden registra é server/src/minijogo-arena.ts.
 */
import type { Contexto, Definicao } from '../minijogo-motor.js';
import { eficacia, ESPECIES, EQUIPE_EMPRESTADA, type Elemento } from '../bichos-regras.js';
import { idsDosRobos, nomeDoRobo, ehRobo, MAXIMO_DE_ROBOS } from '../minijogo-robos.js';
import {
  ACOES,
  alcanceLivre,
  alvoDaZona,
  andar,
  andouABala,
  ARRANCADA,
  balaPassaPerto,
  balasDoGolpe,
  bocaDoGolpe,
  CENARIOS,
  CURA,
  dentroDeObstaculo,
  ELEMENTOS_DA_ARENA,
  ENERGIA,
  ESPECIAL_MAX,
  ESPECIAL_POR_DANO,
  ESPECIAL_POR_SEG,
  fatorDaArena,
  foraDosObstaculos,
  KITS,
  NASCER_TIME,
  NASCER_TODOS,
  PASSO_MS,
  perto,
  PERTO_DO_SUPRIMENTO,
  PONTOS_DE_SUPRIMENTO,
  PV,
  RAIO,
  RAPIDO,
  RECARGA_DA_TROCA,
  SUPRIMENTOS,
  TECLAS_DE_GOLPE,
  unitario,
  VEL,
  VIDAS,
  type Cenario,
  type Golpe,
  type Suprimento,
  type TeclaDeGolpe,
} from './conta.js';

// ---------------- O RELÓGIO E AS FOLGAS ----------------
/** Quanto o servidor espera para decidir um golpe que alguém leva (ver o topo). */
export const GRACA_MS = 200;
/** Quanto do passado do alvo vale para um acerto. */
export const HISTORIA_MS = 800;
/** A folga de um acerto (px), além do corpo e da bala. */
export const FOLGA_BALA = 8;
/** Quanto a origem de um golpe pode estar longe de onde o servidor viu quem bateu. */
export const FOLGA_ORIGEM = 36;
/** A folga da recarga (os pacotes que chegam juntos): o golpe pode chegar até isto antes da hora. */
export const FOLGA_RECARGA = 150;
export const FOLGA_VEL = 1.3;
export const ACUMULO = 26;
/** Depois de cair: quanto até voltar, e piscando (sem levar nada) ao voltar e no começo. */
export const VOLTA_MS = 2500;
export const INVUL_VOLTA_MS = 2000;
/** A partida: no máximo 4 minutos. */
export const PARTIDA_MS = 4 * 60_000;
/** O "Vitória!" antes do placar. */
export const FIM_MS = 3500;
/** As zonas da arena: a cada ZONA.cada ms, marcadas ZONA.aviso antes de bater. */
export const ZONA = { raio: 50, aviso: 1500, dano: 14, cada: 7000 };
/** O primeiro suprimento, e depois um a cada… */
export const SUPRIMENTO_PRIMEIRO = 8000;
export const SUPRIMENTO_CADA = 12_000;
/** O robô decide o alvo e a mira a cada… (o reflexo dele). */
export const DECISAO_DO_ROBO = 220;

export const FORMATOS = ['1x1', '3x3', 'todos'] as const;
export type Formato = (typeof FORMATOS)[number];

interface Ponto {
  t: number;
  x: number;
  y: number;
}

interface TiroAceito {
  n: number;
  tecla: TeclaDeGolpe;
  golpe: Golpe;
  elemento: string;
  x0: number;
  y0: number;
  balas: [number, number][];
  /** Até onde cada bala vai antes de bater na árvore ou na cerca. */
  livre: number[];
  em: number;
  /** As balas (pelo índice) que já acertaram ou acabaram. */
  usadas: Set<number>;
  /** Robô: até onde cada bala já foi conferida. */
  andou: number[];
}

interface Zona {
  id: number;
  /** Quem marcou (0: a arena). */
  dono: number;
  time: number;
  x: number;
  y: number;
  raio: number;
  dano: number;
  elemento: string;
  bate: number;
}

interface Pancada {
  em: number;
  chave: string;
  dono: number;
  /** O time de quem bateu (-1: a arena bate em todos). */
  time: number;
  dano: number;
  elemento: string;
  dentro: (p: Ponto) => boolean;
  /** A bala de robô: já acertou alguém, ou acabou? */
  bala?: { tiro: TiroAceito; k: number };
}

interface Balde {
  fichas: number;
  em: number;
  max: number;
  porSeg: number;
}

interface Lutador {
  id: number;
  robo: boolean;
  time: number;
  avatar: number | string | null;
  equipe: string[];
  ativo: number;
  nasce: readonly [number, number];
  x: number;
  y: number;
  mx: number;
  my: number;
  acao: number;
  tAcao: number;
  pv: number;
  vidas: number;
  estado: 'em-pe' | 'fora' | 'sem-vidas';
  voltaEm: number;
  invulAte: number;
  livreAte: number;
  especial: number;
  rapidoAte: number;
  trocaEm: number;
  ultimaEm: number;
  cred: number;
  credArrancada: number;
  arrancadaAte: number;
  arrancadaEm: number;
  historia: Ponto[];
  proximo: Record<TeclaDeGolpe, number>;
  ultimoTiro: number;
  tiros: Map<number, TiroAceito>;
  baldes: { pos: Balde; acao: Balde; acerto: Balde };
  dano: number;
  quedas: number;
  eliminadoEm: number;
  /** O robô: o alvo, a próxima decisão, o lado para onde ronda, e a mira com o erro dele. */
  ia: { alvo: number | null; decide: number; ronda: 1 | -1; rondaAte: number; erro: number };
}

export interface ServicosDaArena {
  /** O avatar da pessoa nos jogos (a receita do coelho, o número do pronto, ou null: o mascote). */
  avatarDe(userId: number): number | string | null;
  /** As espécies da equipe guardada da pessoa, na ordem (a da frente primeiro); vazia, a emprestada. */
  equipeDe(userId: number): string[];
  guardarTrofeu(t: { userId: number; evento: string; communityId: number; pista: string; posicao: number; tempoMs: number | null; pontos: number | null; rivais: number[] }): void;
}

export interface OpcoesDaArena {
  agora?: () => number;
  aleatorio?: () => number;
  /** O relógio do passo (trocável no teste: o teste chama o passo à mão). */
  intervalo?: (passo: () => void, ms: number) => unknown;
  limpar?: (h: unknown) => void;
  servicos?: ServicosDaArena;
}

const SEM_BANCO: ServicosDaArena = { avatarDe: () => null, equipeDe: () => [], guardarTrofeu: () => {} };

/** A equipe que entra na arena: os três primeiros guardados (espécies que existem), ou a emprestada. */
export function equipeDaArena(guardada: string[]): string[] {
  const boas = guardada.filter((e) => ESPECIES[e]).slice(0, 3);
  return boas.length ? boas : EQUIPE_EMPRESTADA.map(([e]) => e);
}

/** A equipe de um robô: três bichos de elementos diferentes, sorteados. */
export function equipeDoRobo(aleatorio: () => number): string[] {
  const porElemento = new Map<string, string[]>();
  for (const [id, e] of Object.entries(ESPECIES)) {
    if (e.taxa <= 0) continue; // os da Nena ficam com ela
    porElemento.set(e.elemento, [...(porElemento.get(e.elemento) ?? []), id]);
  }
  const elementos = [...porElemento.keys()];
  const saida: string[] = [];
  while (saida.length < 3 && elementos.length) {
    const el = elementos.splice(Math.floor(aleatorio() * elementos.length), 1)[0];
    const lista = porElemento.get(el)!;
    saida.push(lista[Math.floor(aleatorio() * lista.length)]);
  }
  return saida;
}

/** Os lugares de quem joga: [id, time]. Os robôs completam os times (ids negativos). */
export function montarTimes(humanos: number[], formato: Formato, robos: number, minimo = 3): [number, number][] {
  if (formato === '3x3') {
    const h = humanos.slice(0, 6);
    const times: [number, number][] = h.map((id, k) => [id, k % 2]);
    const faltam = [3 - times.filter(([, t]) => t === 0).length, 3 - times.filter(([, t]) => t === 1).length];
    const ids = idsDosRobos(faltam[0] + faltam[1]);
    ids.forEach((id, k) => times.push([id, k < faltam[0] ? 0 : 1]));
    return times;
  }
  if (formato === '1x1') {
    const h = humanos.slice(0, 2);
    const ids = idsDosRobos(Math.max(0, 2 - h.length));
    return [...h, ...ids].map((id, k) => [id, k]);
  }
  const h = humanos.slice(0, 6);
  const n = Math.min(6 - h.length, Math.max(robos, minimo - h.length, 0));
  return [...h, ...idsDosRobos(Math.max(0, n))].map((id, k) => [id, k]);
}

export function criarArena({
  agora = Date.now,
  aleatorio = Math.random,
  intervalo = (passo, ms) => {
    const h = setInterval(passo, ms);
    (h as { unref?: () => void }).unref?.();
    return h;
  },
  limpar = (h) => clearInterval(h as ReturnType<typeof setInterval>),
  servicos = SEM_BANCO,
}: OpcoesDaArena = {}): Definicao {
  return {
    minimo: 2,
    // o 3×3 com seis pessoas; quem aceita depois assiste
    maximo: 6,
    comecar(ctx: Contexto, { naSala, corpo }) {
      const solo = ctx.solo ?? (ctx.comunidade === 0 || ctx.comunidade === undefined);
      const humanos = [...naSala].filter((id) => !ehRobo(id));
      if (humanos.length === 0) return 'Ninguém para jogar.';
      let formato: Formato = (FORMATOS as readonly unknown[]).includes(corpo.formato) ? (corpo.formato as Formato) : solo ? 'todos' : humanos.length === 2 ? '1x1' : 'todos';
      const pedidos = solo ? Math.min(MAXIMO_DE_ROBOS, Math.max(1, Math.floor(Number(corpo.robos) || 1))) : 0;
      if (solo && formato === '1x1') formato = 'todos';
      // no Solo, cada um por si com 1 robô é o 1×1
      const lugares = montarTimes(solo ? humanos.slice(0, 1) : humanos, formato, solo ? pedidos : 0, solo ? 2 : 3);
      const cenario: Cenario = (CENARIOS as readonly unknown[]).includes(corpo.cenario) ? (corpo.cenario as Cenario) : CENARIOS[Math.floor(aleatorio() * CENARIOS.length)];
      const evento = `arena-${ctx.comunidade ?? 0}-${agora()}`;
      const inicio = agora();
      let fase: 'lutando' | 'vitoria' | 'fim' = 'lutando';
      let passo = 0;
      let proximoId = 1;
      let proximoEvento = 1;
      let relogio: unknown = null;
      let eventos: unknown[][] = [];
      let ultimoMotivo: string | null = null;
      let vencedor: number | null = null;
      let proximaZona = inicio + ZONA.cada;
      let proximoSuprimento = inicio + SUPRIMENTO_PRIMEIRO;
      const zonas: Zona[] = [];
      const pancadas: Pancada[] = [];
      const levaram = new Map<string, Set<number>>();
      const suprimentos: { id: number; ponto: number; tipo: Suprimento }[] = [];

      const balde = (max: number, porSeg: number): Balde => ({ fichas: max, em: agora(), max, porSeg });
      const gastar = (b: Balde) => {
        const t = agora();
        b.fichas = Math.min(b.max, b.fichas + ((t - b.em) / 1000) * b.porSeg);
        b.em = t;
        if (b.fichas < 1) return false;
        b.fichas -= 1;
        return true;
      };

      const porTime = new Map<number, number>();
      const lutadores = new Map<number, Lutador>(
        lugares.map(([id, time]) => {
          const k = porTime.get(time) ?? 0;
          porTime.set(time, k + 1);
          const nasce = formato === '3x3' ? NASCER_TIME[time][k % 3] : formato === '1x1' ? NASCER_TIME[time][0] : NASCER_TODOS[time % NASCER_TODOS.length];
          const robo = ehRobo(id);
          const [x, y] = foraDosObstaculos(cenario, nasce[0], nasce[1]);
          const t = agora();
          const l: Lutador = {
            id,
            robo,
            time,
            avatar: robo ? ((-id * 5) % 16) + 1 : servicos.avatarDe(id),
            equipe: robo ? equipeDoRobo(aleatorio) : equipeDaArena(servicos.equipeDe(id)),
            ativo: 0,
            nasce,
            x,
            y,
            mx: x < 640 ? 1 : -1,
            my: 0,
            acao: 0,
            tAcao: 0,
            pv: PV,
            vidas: VIDAS,
            estado: 'em-pe',
            voltaEm: 0,
            invulAte: t + INVUL_VOLTA_MS,
            livreAte: t + 1000,
            especial: 0,
            rapidoAte: 0,
            trocaEm: -Infinity,
            ultimaEm: t,
            cred: ACUMULO,
            credArrancada: 0,
            arrancadaAte: 0,
            arrancadaEm: -Infinity,
            historia: [],
            proximo: { b: 0, s: 0, q: 0, e: 0 },
            ultimoTiro: 0,
            tiros: new Map(),
            // a posição vem ~15 por segundo; os golpes têm a recarga deles (conferida à parte)
            baldes: { pos: balde(10, 24), acao: balde(8, 10), acerto: balde(12, 24) },
            dano: 0,
            quedas: 0,
            eliminadoEm: 0,
            ia: { alvo: null, decide: t + 600 + aleatorio() * 400, ronda: aleatorio() < 0.5 ? 1 : -1, rondaAte: t + 1500, erro: 0 },
          };
          return [id, l];
        }),
      );
      const humanosNaPartida = [...lutadores.values()].filter((l) => !l.robo).map((l) => l.id);
      let ficaram = new Set(humanosNaPartida);
      const ctxNome = (id: number) => (ehRobo(id) ? nomeDoRobo(id) : ctx.nome(id));

      const evento_ = (...e: unknown[]) => eventos.push([proximoEvento++, ...e]);
      const presentes = () => new Set(ctx.naSala());
      let naSalaAgora = presentes();
      /** Quem conta: o robô sempre; a pessoa, só na sala. */
      const conta = (l: Lutador) => l.robo || naSalaAgora.has(l.id);
      const emPe = () => [...lutadores.values()].filter((l) => l.estado === 'em-pe' && conta(l));
      const elementoDe = (l: Lutador) => ESPECIES[l.equipe[l.ativo]]?.elemento ?? 'folha';
      const inimigos = (a: number, b: Lutador) => a !== b.time;

      // ---------------- O DANO ----------------
      const ferir = (alvo: Lutador, dono: number, base: number, elemento: string, t: number) => {
        if (alvo.estado !== 'em-pe' || alvo.invulAte > t) return;
        const efic = eficacia(elemento as Elemento, elementoDe(alvo) as Elemento);
        const dano = Math.max(1, Math.round(base * fatorDaArena(efic)));
        alvo.pv = Math.max(0, alvo.pv - dano);
        const atacante = lutadores.get(dono);
        if (atacante) {
          atacante.dano += dano;
          atacante.especial = Math.min(ESPECIAL_MAX, atacante.especial + dano * ESPECIAL_POR_DANO);
        }
        evento_('h', alvo.id, dono, dano, efic >= 2 ? 1 : efic <= 0.5 ? 2 : 0, ELEMENTOS_DA_ARENA.indexOf(elemento as never));
        if (alvo.pv > 0) return;
        alvo.vidas = Math.max(0, alvo.vidas - 1);
        alvo.estado = alvo.vidas === 0 ? 'sem-vidas' : 'fora';
        alvo.voltaEm = t + VOLTA_MS;
        if (alvo.estado === 'sem-vidas') alvo.eliminadoEm = t;
        if (atacante && atacante.id !== alvo.id) atacante.quedas++;
        // vira estrelinhas e fumaça: o site desenha
        evento_('k', alvo.id, alvo.vidas, Math.round(alvo.x), Math.round(alvo.y));
        ctx.avisar();
      };

      // ---------------- OS GOLPES DECIDIDOS COM A FOLGA ----------------
      const decidirPancadas = (t: number) => {
        for (let k = 0; k < pancadas.length; ) {
          const p = pancadas[k];
          if (t < p.em + GRACA_MS) {
            k++;
            continue;
          }
          pancadas.splice(k, 1);
          if (p.bala && p.bala.tiro.usadas.has(p.bala.k)) continue;
          const ja = levaram.get(p.chave) ?? new Set<number>();
          for (const l of emPe()) {
            if (ja.has(l.id) || l.invulAte > p.em || (p.time >= 0 && !inimigos(p.time, l))) continue;
            let janela = l.historia.filter((h) => h.t > p.em - PASSO_MS && h.t <= p.em + GRACA_MS);
            if (janela.length === 0) {
              const antes = l.historia.filter((h) => h.t <= p.em);
              janela = antes.length ? [antes[antes.length - 1]] : [{ t: p.em, x: l.x, y: l.y }];
            }
            if (!janela.every((h) => p.dentro(h))) continue;
            ja.add(l.id);
            ferir(l, p.dono, p.dano, p.elemento, t);
            if (p.bala) {
              // a bala para no primeiro que ela pega
              p.bala.tiro.usadas.add(p.bala.k);
              break;
            }
          }
          levaram.set(p.chave, ja);
        }
        if (levaram.size > 400) for (const k of [...levaram.keys()].slice(0, 200)) levaram.delete(k);
      };

      const marcarZona = (dono: number, time: number, x: number, y: number, raio: number, dano: number, elemento: string, aviso: number) => {
        const z: Zona = { id: proximoId++, dono, time, x, y, raio, dano, elemento, bate: agora() + aviso };
        zonas.push(z);
        pancadas.push({ em: z.bate, chave: `z${z.id}`, dono, time, dano, elemento, dentro: (p) => perto(p.x, p.y, x, y, raio + RAIO * 0.5) });
        return z;
      };

      /** A roda: quem estava perto de quem bateu agora há pouco (quem bate tem razão). */
      const rodar = (l: Lutador, g: Golpe, t: number) => {
        for (const o of emPe()) {
          if (!inimigos(l.time, o)) continue;
          const alcance = g.raio + RAIO + FOLGA_BALA;
          const pontos = o.robo ? [{ t, x: o.x, y: o.y }] : [...o.historia.filter((h) => h.t >= t - 300), { t, x: o.x, y: o.y }];
          if (pontos.some((p) => perto(p.x, p.y, l.x, l.y, alcance))) ferir(o, l.id, g.dano, elementoDe(l), t);
        }
      };

      /** Um golpe aceito: a recarga anda, e a forma dele acontece. Devolve o tiro (na forma tiro). */
      const golpear = (l: Lutador, tecla: TeclaDeGolpe, n: number, ox: number, oy: number, dx: number, dy: number, ax: number, ay: number, t: number) => {
        const elemento = elementoDe(l);
        const g = KITS[elemento][tecla];
        if (tecla === 'e') l.especial = 0;
        else l.proximo[tecla] = Math.max(l.proximo[tecla], t - FOLGA_RECARGA) + g.recarga;
        l.acao = ACOES.indexOf('golpe');
        l.tAcao = 0;
        if (g.forma === 'tiro') {
          const balas = balasDoGolpe(dx, dy, g);
          const s: TiroAceito = { n, tecla, golpe: g, elemento, x0: ox, y0: oy, balas, livre: balas.map(([bx, by]) => alcanceLivre(cenario, ox, oy, bx, by, g.alcance)), em: t, usadas: new Set(), andou: balas.map(() => 0) };
          l.tiros.set(n, s);
          return s;
        }
        if (g.forma === 'roda') {
          evento_('r', l.id, ELEMENTOS_DA_ARENA.indexOf(elemento as never), TECLAS_DE_GOLPE.indexOf(tecla));
          rodar(l, g, t);
          return null;
        }
        const [zx, zy] = alvoDaZona(l.x, l.y, ax, ay, g.alcance);
        marcarZona(l.id, l.time, zx, zy, g.raio, g.dano, elemento, g.aviso);
        return null;
      };

      // ---------------- OS ROBÔS ----------------
      const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
      const prontoParaGolpe = (l: Lutador, tecla: TeclaDeGolpe, t: number) => (tecla === 'e' ? l.especial >= ESPECIAL_MAX : t >= l.proximo[tecla]);

      const passoDoRobo = (l: Lutador, dt: number, t: number) => {
        if (l.estado !== 'em-pe') return;
        const vivos = emPe().filter((o) => inimigos(l.time, o));
        // o alvo e a estratégia, no reflexo dele
        if (t >= l.ia.decide) {
          l.ia.decide = t + DECISAO_DO_ROBO + aleatorio() * 120;
          let melhor: Lutador | null = null;
          let d = Infinity;
          for (const o of vivos) {
            const dd = distancia(l, o) - (o.pv < 40 ? 60 : 0);
            if (dd < d) {
              d = dd;
              melhor = o;
            }
          }
          l.ia.alvo = melhor?.id ?? null;
          l.ia.erro = (aleatorio() - 0.5) * 0.3;
          // trocar o bicho quando o da frente apanha do alvo e outro da equipe não
          const alvo = melhor;
          if (alvo && t - l.trocaEm >= RECARGA_DA_TROCA && aleatorio() < 0.5) {
            const def = elementoDe(alvo) as Elemento;
            const agoraVale = eficacia(elementoDe(l) as Elemento, def);
            if (agoraVale < 1) {
              const outro = l.equipe.findIndex((e, i) => i !== l.ativo && eficacia(ESPECIES[e].elemento, def) >= 1);
              if (outro >= 0) {
                l.ativo = outro;
                l.trocaEm = t;
                evento_('t', l.id, outro);
              }
            }
          }
        }
        const alvo = l.ia.alvo !== null ? lutadores.get(l.ia.alvo) : undefined;
        const kit = KITS[elementoDe(l)];
        let vx = 0,
          vy = 0;
        // o perigo: sair das marcas no chão
        let fugindo = false;
        for (const z of zonas) {
          if (z.dono === l.id || (z.time >= 0 && !inimigos(z.time, l))) continue;
          if (!perto(l.x, l.y, z.x, z.y, z.raio + RAIO + 6)) continue;
          const [ux, uy] = unitario(l.x - z.x, l.y - z.y);
          vx += ux * 2;
          vy += uy * 2;
          fugindo = true;
          if (z.bate - t < 450 && t - l.arrancadaEm >= ARRANCADA.recarga && aleatorio() < 0.5) {
            l.arrancadaEm = t;
            l.arrancadaAte = t + ARRANCADA.ms;
            l.mx = ux;
            l.my = uy;
          }
        }
        // o suprimento: com pouca vida, vai buscar a cura; o resto, se estiver perto
        let rumo: { x: number; y: number } | null = null;
        for (const s of suprimentos) {
          const [px, py] = PONTOS_DE_SUPRIMENTO[s.ponto];
          const d = distancia(l, { x: px, y: py });
          if ((s.tipo === 'cura' && l.pv < 55 && d < 420) || d < 160) rumo = { x: px, y: py };
        }
        if (!fugindo && rumo) {
          const [ux, uy] = unitario(rumo.x - l.x, rumo.y - l.y);
          vx += ux;
          vy += uy;
        } else if (!fugindo && alvo && alvo.estado === 'em-pe') {
          const d = distancia(l, alvo);
          const quer = kit.s.forma === 'roda' ? 70 : 140;
          const [ux, uy] = unitario(alvo.x - l.x, alvo.y - l.y);
          const perto_ = d < quer - 25 ? -1 : d > quer + 25 ? 1 : 0;
          if (t >= l.ia.rondaAte) {
            l.ia.ronda = aleatorio() < 0.5 ? 1 : -1;
            l.ia.rondaAte = t + 1200 + aleatorio() * 1800;
          }
          vx += ux * perto_ + -uy * l.ia.ronda * 0.8;
          vy += uy * perto_ + ux * l.ia.ronda * 0.8;
        }
        // desviar das balas que vêm (de vez em quando: o robô não é perfeito)
        if (t - l.arrancadaEm >= ARRANCADA.recarga) {
          for (const o of lutadores.values()) {
            if (!inimigos(o.time, l)) continue;
            for (const s of o.tiros.values()) {
              if (s.golpe.forma !== 'tiro') continue;
              const d = andouABala(s.golpe, t - s.em);
              const [bx, by] = s.balas[0];
              if (d >= s.livre[0] || !balaPassaPerto(s.x0, s.y0, bx, by, d, d + s.golpe.vel * 0.3, l.x, l.y, RAIO + 10)) continue;
              if (aleatorio() < 0.08) {
                l.arrancadaEm = t;
                l.arrancadaAte = t + ARRANCADA.ms;
                const lado = aleatorio() < 0.5 ? 1 : -1;
                l.mx = -by * lado;
                l.my = bx * lado;
              }
            }
          }
        }
        // andar (ou a arrancada)
        const arrancando = t < l.arrancadaAte;
        const [ux, uy] = arrancando ? [l.mx, l.my] : unitario(vx, vy);
        const mexe = arrancando || vx * vx + vy * vy > 0.01;
        if (mexe) {
          const vel = arrancando ? ARRANCADA.vel : VEL * 0.85 * (t < l.rapidoAte ? RAPIDO.mult : 1);
          [l.x, l.y] = andar(cenario, l.x, l.y, ux * vel * dt, uy * vel * dt);
        }
        if (l.acao !== ACOES.indexOf('golpe') || t - l.tAcao > 300) l.acao = ACOES.indexOf(arrancando ? 'arrancada' : mexe ? 'andando' : 'parado');
        // pegar o suprimento em que encostou
        for (const s of [...suprimentos]) {
          const [px, py] = PONTOS_DE_SUPRIMENTO[s.ponto];
          if (perto(l.x, l.y, px, py, PERTO_DO_SUPRIMENTO)) pegar(l, s.id);
        }
        // os golpes
        if (!alvo || alvo.estado !== 'em-pe' || fugindo) return;
        const d = distancia(l, alvo);
        let [mx, my] = unitario(alvo.x - l.x, alvo.y - l.y);
        [mx, my] = unitario(mx - my * l.ia.erro, my + mx * l.ia.erro);
        if (!arrancando) {
          l.mx = mx;
          l.my = my;
        }
        const visivel = alcanceLivre(cenario, l.x, l.y, mx, my, d) >= d - RAIO - 4;
        const usar = (tecla: TeclaDeGolpe) => {
          const [ox, oy] = bocaDoGolpe(l.x, l.y, mx, my);
          golpear(l, tecla, ++l.ultimoTiro, ox, oy, mx, my, alvo.x, alvo.y, t);
          l.tAcao = t;
        };
        if (prontoParaGolpe(l, 'e', t) && d < kit.e.alcance) return usar('e');
        if (prontoParaGolpe(l, 'q', t) && d < kit.q.alcance && aleatorio() < 0.15) return usar('q');
        const s = kit.s;
        if (prontoParaGolpe(l, 's', t) && aleatorio() < 0.3) {
          if (s.forma === 'roda' && d < s.raio + RAIO) return usar('s');
          if (s.forma === 'zona' && d < s.alcance) return usar('s');
          if (s.forma === 'tiro' && d < s.alcance * 0.9 && visivel) return usar('s');
        }
        if (prontoParaGolpe(l, 'b', t) && d < kit.b.alcance * 0.95 && visivel && aleatorio() < 0.7) usar('b');
      };

      /** As balas dos robôs andam no servidor: cada trecho é uma pancada (decidida com a folga, nas pessoas). */
      const passoDasBalasDosRobos = (t: number) => {
        for (const l of lutadores.values()) {
          if (!l.robo) continue;
          for (const [n, s] of l.tiros) {
            const d1 = andouABala(s.golpe, t - s.em);
            let vivas = 0;
            s.balas.forEach(([bx, by], k) => {
              if (s.usadas.has(k) || s.andou[k] >= s.livre[k]) return;
              const d0 = s.andou[k];
              const fim = Math.min(d1, s.livre[k]);
              s.andou[k] = fim;
              const r = RAIO + s.golpe.raio;
              // nos robôs, na hora (eles não têm internet)
              for (const o of emPe()) {
                if (!o.robo || !inimigos(l.time, o) || o.invulAte > t) continue;
                if (balaPassaPerto(s.x0, s.y0, bx, by, d0, fim, o.x, o.y, r)) {
                  s.usadas.add(k);
                  ferir(o, l.id, s.golpe.dano, s.elemento, t);
                  return;
                }
              }
              const x0 = s.x0, y0 = s.y0;
              pancadas.push({ em: t, chave: `b${l.id}-${n}-${k}`, dono: l.id, time: l.time, dano: s.golpe.dano, elemento: s.elemento, dentro: (p) => balaPassaPerto(x0, y0, bx, by, d0, fim, p.x, p.y, r), bala: { tiro: s, k } });
              if (fim < s.livre[k]) vivas++;
            });
            if (!vivas && t - s.em > 300) l.tiros.delete(n);
          }
        }
      };

      // ---------------- AS ZONAS DA ARENA E OS SUPRIMENTOS ----------------
      const zonaDaArena = (t: number) => {
        if (t < proximaZona) return;
        proximaZona = t + ZONA.cada;
        // perto de alguém (para obrigar a mexer), mas num lugar sorteado em volta
        const vivos = emPe();
        if (!vivos.length) return;
        const quem = vivos[Math.floor(aleatorio() * vivos.length)];
        const [x, y] = foraDosObstaculos(cenario, quem.x + (aleatorio() - 0.5) * 120, quem.y + (aleatorio() - 0.5) * 120, ZONA.raio);
        marcarZona(0, -1, x, y, ZONA.raio, ZONA.dano, 'nenhum', ZONA.aviso);
      };

      const cairSuprimento = (t: number) => {
        if (t < proximoSuprimento) return;
        proximoSuprimento = t + SUPRIMENTO_CADA;
        const livres = PONTOS_DE_SUPRIMENTO.map((_, k) => k).filter((k) => !suprimentos.some((s) => s.ponto === k));
        if (!livres.length) return;
        const ponto = livres[Math.floor(aleatorio() * livres.length)];
        const tipo = SUPRIMENTOS[Math.floor(aleatorio() * SUPRIMENTOS.length)];
        suprimentos.push({ id: proximoId++, ponto, tipo });
        evento_('s', ponto, SUPRIMENTOS.indexOf(tipo));
      };

      const pegar = (l: Lutador, id: number): string | null => {
        const k = suprimentos.findIndex((s) => s.id === id);
        if (k < 0) return 'sem suprimento';
        const s = suprimentos[k];
        const [px, py] = PONTOS_DE_SUPRIMENTO[s.ponto];
        if (!perto(l.x, l.y, px, py, PERTO_DO_SUPRIMENTO + 16)) return 'longe do suprimento';
        suprimentos.splice(k, 1);
        const t = agora();
        if (s.tipo === 'cura') l.pv = Math.min(PV, l.pv + CURA);
        else if (s.tipo === 'energia') l.especial = Math.min(ESPECIAL_MAX, l.especial + ENERGIA);
        else l.rapidoAte = t + RAPIDO.ms;
        evento_('g', l.id, SUPRIMENTOS.indexOf(s.tipo), s.ponto);
        return null;
      };

      // ---------------- O PASSO ----------------
      const tick = () => {
        if (fase !== 'lutando') return;
        const t = agora();
        const dt = PASSO_MS / 1000;
        passo++;
        naSalaAgora = presentes();
        if (!humanosNaPartida.some((id) => naSalaAgora.has(id))) return acabar(null, true);
        for (const l of lutadores.values()) {
          if (l.estado === 'em-pe' && conta(l)) l.especial = Math.min(ESPECIAL_MAX, l.especial + ESPECIAL_POR_SEG * dt);
          if (l.robo) passoDoRobo(l, dt, t);
          if (l.estado === 'fora' && t >= l.voltaEm) {
            l.estado = 'em-pe';
            l.pv = PV;
            [l.x, l.y] = foraDosObstaculos(cenario, l.nasce[0], l.nasce[1]);
            l.invulAte = t + INVUL_VOLTA_MS;
            l.livreAte = t + 1500;
            l.historia = [];
            evento_('v', l.id, Math.round(l.x), Math.round(l.y));
            ctx.avisar();
          }
          if (l.robo && l.estado === 'em-pe') {
            l.historia.push({ t, x: l.x, y: l.y });
            while (l.historia.length && l.historia[0].t < t - 1500) l.historia.shift();
          }
          // os tiros velhos das pessoas saem (os dos robôs saem quando as balas acabam)
          if (!l.robo) for (const [k, s] of l.tiros) if (t - s.em > 2500) l.tiros.delete(k);
        }
        passoDasBalasDosRobos(t);
        zonaDaArena(t);
        cairSuprimento(t);
        decidirPancadas(t);
        for (let k = zonas.length - 1; k >= 0; k--) if (t >= zonas[k].bate + GRACA_MS) zonas.splice(k, 1);
        if (fase !== 'lutando') return;
        // quem ficou: os times com alguém de pé (ou voltando)
        const vivos = new Set([...lutadores.values()].filter((l) => l.estado !== 'sem-vidas' && conta(l)).map((l) => l.time));
        if (vivos.size <= 1) return acabar(vivos.size === 1 ? [...vivos][0] : null);
        if (t - inicio >= PARTIDA_MS) {
          // no tempo: o time com mais vida somada (as vidas que sobram valem a vida cheia)
          const soma = new Map<number, number>();
          for (const l of lutadores.values()) if (conta(l)) soma.set(l.time, (soma.get(l.time) ?? 0) + (l.estado === 'sem-vidas' ? 0 : (l.vidas - 1) * PV + (l.estado === 'em-pe' ? l.pv : 0)));
          const ordem = [...soma.entries()].sort((a, b) => b[1] - a[1]);
          return acabar(ordem.length && (ordem.length === 1 || ordem[0][1] > ordem[1][1]) ? ordem[0][0] : null);
        }
        difundir();
      };

      const difundir = () => {
        const t = agora();
        ctx.difundir?.({
          tipo: 'q',
          n: passo,
          f: fase,
          r: Math.max(0, PARTIDA_MS - (t - inicio)),
          // os coelhos: [id, x, y, mira x ×100, mira y ×100, ação, ms da ação, vidas, vida, estado (0 de pé, 1 fora, 2 sem
          // vidas), time, bicho da frente, especial, ms de velocidade, ms piscando, último golpe aceito, ms para voltar]
          j: [...lutadores.values()].map((l) => [
            l.id,
            Math.round(l.x * 10) / 10,
            Math.round(l.y * 10) / 10,
            Math.round(l.mx * 100),
            Math.round(l.my * 100),
            l.acao,
            l.robo ? Math.max(0, Math.round(t - l.tAcao)) : l.tAcao,
            l.vidas,
            l.pv,
            l.estado === 'em-pe' ? 0 : l.estado === 'fora' ? 1 : 2,
            l.time,
            l.ativo,
            Math.floor(l.especial),
            Math.max(0, Math.round(l.rapidoAte - t)),
            Math.max(0, Math.round(l.invulAte - t)),
            l.ultimoTiro,
            l.estado === 'fora' ? Math.max(0, Math.round(l.voltaEm - t)) : 0,
          ]),
          // as balas no ar (de todos, para cada um desenhar as dos outros): [dono, n, k, x0, y0, dx ×1000, dy ×1000, ms desde,
          // elemento, tecla, até onde vai]
          p: [...lutadores.values()].flatMap((l) =>
            [...l.tiros.values()]
              .filter((s) => t - s.em < 2000)
              .flatMap((s) =>
                s.balas
                  .map(([bx, by], k) => [l.id, s.n, k, Math.round(s.x0), Math.round(s.y0), Math.round(bx * 1000), Math.round(by * 1000), Math.round(t - s.em), ELEMENTOS_DA_ARENA.indexOf(s.elemento as never), TECLAS_DE_GOLPE.indexOf(s.tecla), Math.round(s.livre[k])])
                  .filter((_, k) => !s.usadas.has(k) && andouABala(s.golpe, t - s.em) < s.livre[k]),
              ),
          ),
          // as zonas marcadas: [id, x, y, raio, ms até bater, elemento (-1 a arena), dono, time]
          z: zonas.map((z) => [z.id, Math.round(z.x), Math.round(z.y), z.raio, Math.round(z.bate - t), ELEMENTOS_DA_ARENA.indexOf(z.elemento as never), z.dono, z.time]),
          // os suprimentos no chão: [id, ponto, tipo]
          s: suprimentos.map((s) => [s.id, s.ponto, SUPRIMENTOS.indexOf(s.tipo)]),
          e: eventos,
        });
        eventos = [];
      };

      /** `vazia`: a turma inteira saiu (a partida conta como interrompida). */
      const acabar = (time: number | null, vazia = false) => {
        if (fase !== 'lutando') return;
        fase = 'vitoria';
        vencedor = time;
        difundir();
        ctx.avisar();
        parar();
        ctx.agendar(FIM_MS, () => terminar(!vazia));
      };

      const parar = () => {
        if (relogio !== null) limpar(relogio);
        relogio = null;
      };

      let resultado: { userId: number; username: string; time: number; dano: number; quedas: number; vidas: number; posicao: number | null; robo: boolean }[] | null = null;
      const terminar = (completa = true) => {
        parar();
        fase = 'fim';
        const p = presentes();
        ficaram = new Set([...ficaram].filter((id) => p.has(id)));
        // a posição de cada time: o vencedor primeiro; os outros, de quem caiu por último para quem caiu primeiro
        const fimDoTime = new Map<number, number>();
        for (const l of lutadores.values()) {
          const fim = l.estado === 'sem-vidas' ? l.eliminadoEm : Infinity;
          fimDoTime.set(l.time, Math.max(fimDoTime.get(l.time) ?? -Infinity, l.robo || ficaram.has(l.id) ? fim : -Infinity));
        }
        if (vencedor !== null) fimDoTime.set(vencedor, Number.MAX_VALUE);
        const posicaoDoTime = (time: number) => 1 + [...fimDoTime.entries()].filter(([o, f]) => o !== time && f > fimDoTime.get(time)!).length;
        resultado = [...lutadores.values()]
          .map((l) => ({
            userId: l.id,
            username: ctxNome(l.id),
            time: l.time,
            dano: l.dano,
            quedas: l.quedas,
            vidas: l.vidas,
            posicao: l.robo || ficaram.has(l.id) ? (vencedor === null && fimDoTime.get(l.time) === Infinity ? 1 : posicaoDoTime(l.time)) : null,
            robo: l.robo,
          }))
          .sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99) || b.dano - a.dano || a.username.localeCompare(b.username));
        // O TROFÉU: fora do Solo, 2 pessoas ou mais que ficaram até o fim; até o 3º (no 3×3, só o time vencedor)
        if (!solo && ficaram.size >= 2 && vencedor !== null) {
          for (const l of resultado) {
            if (l.robo || l.posicao === null || l.posicao > (formato === 'todos' ? 3 : 1)) continue;
            servicos.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'bichos-arena',
              posicao: l.posicao,
              tempoMs: null,
              pontos: l.dano,
              rivais: [...ficaram].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar(completa);
      };

      // ---------------- O QUE A PESSOA MANDA (tempo real) ----------------
      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      const posicao = (l: Lutador, d: Record<string, unknown>) => {
        const { x, y, mx, my, acao, ta } = d;
        if (!numero(x) || !numero(y)) return;
        const t = agora();
        let [nx, ny] = [x, y];
        // não mais rápido que o coelho anda (com o suprimento), mais o crédito da arrancada, com um acúmulo pequeno para a rede
        const dt = Math.max(0, (t - l.ultimaEm) / 1000);
        const mult = t < l.rapidoAte + 300 ? RAPIDO.mult : 1;
        l.cred = Math.min(ACUMULO * mult, l.cred + VEL * mult * FOLGA_VEL * dt);
        if (t > l.livreAte) {
          const ddx = nx - l.x, ddy = ny - l.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          const extra = t <= l.arrancadaAte ? l.credArrancada : 0;
          const pode = l.cred + extra;
          if (dist > pode) {
            nx = l.x + (ddx / dist) * pode;
            ny = l.y + (ddy / dist) * pode;
          }
          const andou = Math.min(dist, pode);
          const doCred = Math.min(l.cred, andou);
          l.cred -= doCred;
          if (andou > doCred) l.credArrancada = Math.max(0, l.credArrancada - (andou - doCred));
        }
        // a cerca e os obstáculos: um pouco de folga para o arredondamento; dentro de verdade, para fora
        if (dentroDeObstaculo(cenario, nx, ny, 3)) [nx, ny] = foraDosObstaculos(cenario, nx, ny);
        else [nx, ny] = foraDosObstaculos(cenario, nx, ny, RAIO - 2);
        l.x = nx;
        l.y = ny;
        if (numero(mx) && numero(my)) [l.mx, l.my] = unitario(mx, my);
        l.acao = numero(acao) && acao >= 0 && acao < ACOES.length ? Math.floor(acao) : 0;
        l.tAcao = numero(ta) ? Math.max(0, Math.min(5000, Math.round(ta))) : 0;
        l.ultimaEm = t;
        l.historia.push({ t, x: nx, y: ny });
        while (l.historia.length && l.historia[0].t < t - 1500) l.historia.shift();
      };

      const arrancada = (l: Lutador): string | null => {
        const t = agora();
        if (t - l.arrancadaEm < ARRANCADA.recarga - FOLGA_RECARGA) return 'recarga';
        l.arrancadaEm = t;
        l.arrancadaAte = t + ARRANCADA.ms + 400;
        l.credArrancada = (ARRANCADA.vel * ARRANCADA.ms) / 1000 + 8;
        return null;
      };

      const golpe = (l: Lutador, d: Record<string, unknown>): string | null => {
        const { n: num, x, y, dx, dy, ax, ay } = d;
        const tecla = d.tecla as TeclaDeGolpe;
        if (!numero(num) || !Number.isInteger(num) || num <= l.ultimoTiro || num > l.ultimoTiro + 1000) return 'número';
        if (!(TECLAS_DE_GOLPE as readonly unknown[]).includes(tecla)) return 'tecla';
        if (!numero(x) || !numero(y) || !numero(dx) || !numero(dy)) return 'números';
        if (Math.abs(x - l.x) > FOLGA_ORIGEM || Math.abs(y - l.y) > FOLGA_ORIGEM) return 'longe de si';
        const t = agora();
        if (tecla === 'e' ? l.especial < ESPECIAL_MAX : l.proximo[tecla] > t + FOLGA_RECARGA) return 'recarga';
        const [ux, uy] = unitario(dx, dy);
        l.ultimoTiro = num;
        golpear(l, tecla, num, x, y, ux, uy, numero(ax) ? ax : l.x + ux * 100, numero(ay) ? ay : l.y + uy * 100, t);
        return null;
      };

      const acerto = (l: Lutador, d: Record<string, unknown>): string | null => {
        const s = l.tiros.get(d.n as number);
        if (!s) return 'tiro que não saiu';
        const k = d.k;
        if (!numero(k) || !Number.isInteger(k) || k < 0 || k >= s.balas.length) return 'bala';
        if (s.usadas.has(k)) return 'bala usada';
        const alvo = lutadores.get(d.alvo as number);
        if (!alvo || alvo.estado !== 'em-pe' || !conta(alvo)) return 'alvo fora';
        if (!inimigos(l.time, alvo)) return 'do mesmo time';
        const t = agora();
        const el = t - s.em;
        if (el > (s.golpe.alcance / s.golpe.vel) * 1000 + 700) return 'tiro velho';
        const [dx, dy] = s.balas[k];
        // o caminho da bala (contando ~300 ms de quando ela saiu na tela de quem atirou, e nunca através da árvore) passa por
        // alguma posição do alvo
        const ate = Math.min(andouABala(s.golpe, el + 300), s.livre[k]);
        const r = RAIO + s.golpe.raio + FOLGA_BALA;
        const pontos = alvo.historia.filter((p) => p.t >= t - HISTORIA_MS && p.t >= s.em - 400);
        // parado há tempo (nada novo na janela): a última posição que ele mandou
        if (!pontos.length) pontos.push(alvo.historia.at(-1) ?? { t, x: alvo.x, y: alvo.y });
        if (!pontos.some((p) => balaPassaPerto(s.x0, s.y0, dx, dy, 0, ate, p.x, p.y, r))) return 'longe do alvo';
        s.usadas.add(k);
        ferir(alvo, l.id, s.golpe.dano, s.elemento, t);
        return null;
      };

      const trocar = (l: Lutador, d: Record<string, unknown>): string | null => {
        const i = d.i;
        const t = agora();
        if (!numero(i) || !Number.isInteger(i) || i < 0 || i >= l.equipe.length || i === l.ativo) return 'bicho';
        if (t - l.trocaEm < RECARGA_DA_TROCA - FOLGA_RECARGA) return 'recarga';
        l.ativo = i;
        l.trocaEm = t;
        evento_('t', l.id, i);
        return null;
      };

      relogio = intervalo(tick, PASSO_MS);

      return {
        publico() {
          return {
            modo: 'arena',
            fase,
            formato,
            cenario,
            solo,
            vencedor,
            jogadores: [...lutadores.values()].map((l) => ({
              userId: l.id,
              username: ctxNome(l.id),
              avatar: l.avatar,
              time: l.time,
              equipe: l.equipe,
              robo: l.robo,
            })),
            resultado: fase === 'fim' ? resultado : null,
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          // tudo vem pelo tempo real; a ação HTTP é só para o caso de o socket cair
          if (!lutadores.has(quem)) return 'Você está assistindo esta partida.';
          return corpo.tipo === 'nada' ? null : 'Ação desconhecida.';
        },
        tempoReal(quem, dados) {
          const l = lutadores.get(quem);
          if (!l || l.robo || !dados || typeof dados !== 'object' || fase !== 'lutando' || l.estado !== 'em-pe') return null;
          const d = dados as Record<string, unknown>;
          if (d.tipo === 'pos') {
            if (gastar(l.baldes.pos)) posicao(l, d);
          } else if (d.tipo === 'acerto') {
            ultimoMotivo = gastar(l.baldes.acerto) ? acerto(l, d) : 'depressa demais';
          } else if (d.tipo === 'golpe' || d.tipo === 'arrancada' || d.tipo === 'trocar' || d.tipo === 'pegar') {
            if (!gastar(l.baldes.acao)) ultimoMotivo = 'depressa demais';
            else if (d.tipo === 'golpe') ultimoMotivo = golpe(l, d);
            else if (d.tipo === 'arrancada') ultimoMotivo = arrancada(l);
            else if (d.tipo === 'trocar') ultimoMotivo = trocar(l, d);
            else ultimoMotivo = pegar(l, d.id as number);
          }
          // nada se repassa direto: o quadro de 20 por segundo leva tudo a todos
          return null;
        },
        conferir() {
          if (fase === 'fim') parar();
        },
        parar,
        // para o teste
        ...({ _passo: tick, _lutadores: lutadores, _zonas: zonas, _suprimentos: suprimentos, _pancadas: pancadas, _motivo: () => ultimoMotivo, _cenario: cenario } as object),
      };
    },
  };
}
