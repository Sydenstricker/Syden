/**
 * A ARENA DA HORTA (lote 5, 05/11/2026): o motor comum dos microjogos de EMPURRA-EMPURRA da Festa (a classe C do levantamento
 * em docs/mario-party-3.md): o canteiro que encolhe, o chão que desmorona, as chaves da porteira. Só a mecânica; o desenho é
 * todo nosso (web/src/festa/arena.tsx).
 *
 * A REDE DECIDE A FORMA (servidor na Alemanha, turma no Brasil, ~200 ms), e as soluções são as já decididas no projeto:
 * - CADA UM ANDA NO PRÓPRIO COMPUTADOR e manda a posição ~15 vezes por segundo; o servidor só confere a velocidade (um balde de
 *   distância, que aguenta a internet que engasga) e repassa a todos no quadro do PASSO dele (20 por segundo).
 * - O EMPURRÃO É UM GOLPE COM AVISO, nunca corpo contra corpo: quem aperta marca no chão, na frente dele, a área do golpe
 *   (todos a veem crescer), e o golpe só é decidido EMPURRAO_PREPARO + EMPURRAO_FOLGA depois de chegar ao servidor, com as
 *   posições que ele conhece naquela hora. "Quem bate tem razão pelo passado": a área fica onde quem bateu estava ao apertar
 *   (como ele viu, se a posição dita estiver perto da conhecida). "Quem leva tem folga": quem saiu da área até a decisão
 *   escapou, e a decisão espera a posição dele chegar.
 * - QUEM CAI QUEM DECIDE É O SERVIDOR: o empurrão leva quem levou EMPURRAO unidades na direção do golpe; se o caminho passa
 *   fora do chão, caiu. O chão que some (a borda do canteiro, a tábua que desmorona) derruba quem está nele, com a folga da
 *   rede de cada um (o chão de `folga` ms atrás).
 * - Os ROBÔS (o Solo do Tabuleiro) são do servidor: andam e empurram no passo.
 *
 * Contas iguais nos dois lados: só + − × ÷ e Math.sqrt (o site refaz o chão e a área do golpe para desenhar).
 */
import { inteiro, numero, type AoVivo, type Conferencia, type PassoAoVivo, type Resultado, type Turma } from './comum.js';

/** O campo, em unidades do desenho (o SVG do site é 300 × 200). */
export const ARENA_L = 300;
export const ARENA_A = 200;
/** O raio de um coelho. */
export const RAIO = 9;
/** A velocidade de andar (unidades por segundo). */
export const VELOCIDADE = 95;
/** O balde de distância: quanto se pode andar de uma vez depois de um engasgo da rede (1 s de caminhada). */
export const BALDE_DE_DISTANCIA = VELOCIDADE;
/** Do aperto (chegada ao servidor) ao golpe. A tela de quem bate mostra a preparação pelo mesmo tempo, mais a ida. */
export const EMPURRAO_PREPARO = 500;
/** Quem leva tem folga: o golpe é decidido este tanto depois, com a posição que chegou até lá. */
export const EMPURRAO_FOLGA = 150;
/** Entre um empurrão e outro. */
export const EMPURRAO_ESPERA = 1000;
/** A área do golpe: um círculo deste raio, com o centro este tanto à frente de quem bate. */
export const EMPURRAO_RAIO = 20;
export const EMPURRAO_ALCANCE = 16;
/** Quanto o empurrão leva quem levou. */
export const EMPURRAO = 55;
/** Depois de levar, a posição pode pular (a tela desliza até onde o servidor pôs) por este tempo. */
const LIVRE_DEPOIS_DE_LEVAR = 900;
/** Quem levou fica sem empurrar por este tempo. */
const TONTO_MS = 450;

export interface CoelhoDaArena {
  id: number;
  x: number;
  y: number;
  /** Para onde olha (normalizado). */
  dx: number;
  dy: number;
  vivo: boolean;
  /** Quando caiu (ms desde o começo). */
  caiuEm: number | null;
  robo: boolean;
  /** O balde de distância e quando foi enchido (relógio do servidor). */
  credito: number;
  em: number;
  livreAte: number;
  prontoEm: number;
  /** Quantos caíram empurrados por ele. */
  derrubou: number;
  /** Pontos próprios do microjogo (as chaves da porteira, por exemplo). */
  pontos: number;
  /** A posição já veio da tela alguma vez (quem nunca mandou não é dono do próprio coelho). */
  mexeu: boolean;
  /** O robô: o golpe de que ele já decidiu fugir (ou não), e o próximo instante em que ele pensa. */
  fugiuDe: Set<number>;
  pensaEm: number;
}

export interface GolpeDaArena {
  id: number;
  dono: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** ms desde o começo, no relógio do servidor. */
  inicio: number;
  bate: number;
  decidido: boolean;
}

export interface MemArena<X = unknown> {
  coelhos: Map<number, CoelhoDaArena>;
  golpes: GolpeDaArena[];
  /** Os eventos do passo (vão no próximo quadro): ['k', alvo, x, y, dono] levou, ['c', alvo, x, y] caiu, e os do jogo. */
  eventos: (string | number)[][];
  proximoId: number;
  /** Quantos começaram. */
  comecaram: number;
  /** O último passo (ms desde o começo), para o dt dos robôs. */
  ultimoPasso: number;
  /** Quando revelar (o último em pé, com um tempo para ver a queda). */
  fimEm: number | null;
  /** O que é de cada microjogo. */
  x: X;
}

/** As regras de um microjogo de arena. */
export interface RegrasDaArena<D, X> {
  /** O chão naquela hora (ms desde o começo): fora dele, cai. */
  chao(dados: D, mem: MemArena<X>, x: number, y: number, t: number): boolean;
  /** O que o microjogo guarda além do comum. */
  extra(dados: D, turma: Turma): X;
  /** Onde cada um começa. */
  largada(dados: D, turma: Turma): Map<number, [number, number]>;
  /** A velocidade de alguém (a de quem carrega a chave é menor). Padrão: VELOCIDADE. */
  velocidade?(mem: MemArena<X>, c: CoelhoDaArena): number;
  /** Anda o que é do jogo, a cada passo (antes dos golpes). */
  aoPasso?(p: PassoAoVivo<D, MemArena<X>>): void;
  /** Alguém levou um empurrão (e caiu, ou não). */
  aoLevar?(mem: MemArena<X>, vitima: CoelhoDaArena, caiu: boolean, passou: number): void;
  /** Para onde o robô quer ir, se não for para cima de alguém (a chave, a porteira); null: atrás do mais perto. */
  metaDoRobo?(dados: D, mem: MemArena<X>, c: CoelhoDaArena, passou: number): [number, number] | null;
  /** Alguém pediu para pegar o objeto i (a chave): o jogo decide, pela posição que o servidor conhece. */
  pegar?(dados: D, mem: MemArena<X>, c: CoelhoDaArena, i: number, passou: number): void;
  /** O que vai no quadro além do comum. */
  quadro?(mem: MemArena<X>): Record<string, unknown>;
  /** Acaba quando sobra um em pé. Padrão: sim. */
  ultimoEmPe?: boolean;
  /** O resultado de alguém no fim. */
  resultado(dados: D, mem: MemArena<X>, c: CoelhoDaArena): Resultado;
}

const comprimento = (x: number, y: number) => Math.sqrt(x * x + y * y);
const normal = (x: number, y: number): [number, number] => {
  const l = comprimento(x, y);
  return l < 1e-6 ? [0, 1] : [x / l, y / l];
};
export const prenderNoCampo = (v: number, max: number) => Math.min(max - RAIO, Math.max(RAIO, v));

/** O centro da área de um golpe (a mesma conta no site). */
export const centroDoGolpe = (g: { x: number; y: number; dx: number; dy: number }): [number, number] => [g.x + g.dx * EMPURRAO_ALCANCE, g.y + g.dy * EMPURRAO_ALCANCE];

/** A memória nova de uma rodada de arena. */
export function memoriaDaArena<D, X>(regras: RegrasDaArena<D, X>, dados: D, turma: Turma | undefined): MemArena<X> {
  const t: Turma = turma ?? { jogadores: [1, 2], robos: [], equipes: null, equipeDe: () => -1 };
  const largada = regras.largada(dados, t);
  const coelhos = new Map<number, CoelhoDaArena>();
  for (const id of t.jogadores) {
    const [x, y] = largada.get(id) ?? [ARENA_L / 2, ARENA_A / 2];
    const [dx, dy] = normal(ARENA_L / 2 - x, ARENA_A / 2 - y);
    coelhos.set(id, {
      id,
      x,
      y,
      dx,
      dy,
      vivo: true,
      caiuEm: null,
      robo: t.robos.includes(id),
      credito: BALDE_DE_DISTANCIA,
      em: 0,
      livreAte: 0,
      prontoEm: 0,
      derrubou: 0,
      pontos: 0,
      mexeu: false,
      fugiuDe: new Set(),
      pensaEm: 0,
    });
  }
  return { coelhos, golpes: [], eventos: [], proximoId: 1, comecaram: coelhos.size, ultimoPasso: -1, fimEm: null, x: regras.extra(dados, t) };
}

/** Derruba alguém (o evento vai no próximo quadro). */
export function derrubar<X>(mem: MemArena<X>, c: CoelhoDaArena, passou: number) {
  if (!c.vivo) return;
  c.vivo = false;
  c.caiuEm = passou;
  mem.eventos.push(['c', c.id, Math.round(c.x), Math.round(c.y)]);
}

/** O canal ao vivo de um microjogo de arena: a posição ('p'), o empurrão ('e'), os robôs, os golpes e as quedas. */
export function arenaAoVivo<D, X>(regras: RegrasDaArena<D, X>): AoVivo<D, MemArena<X>> {
  const vel = (mem: MemArena<X>, c: CoelhoDaArena) => regras.velocidade?.(mem, c) ?? VELOCIDADE;

  const golpear = (mem: MemArena<X>, c: CoelhoDaArena, x: number, y: number, dx: number, dy: number, passou: number, agora: number) => {
    const [nx, ny] = normal(dx, dy);
    c.dx = nx;
    c.dy = ny;
    c.prontoEm = agora + EMPURRAO_ESPERA;
    mem.golpes.push({ id: mem.proximoId++, dono: c.id, x, y, dx: nx, dy: ny, inicio: passou, bate: passou + EMPURRAO_PREPARO, decidido: false });
  };

  const decidir = (p: PassoAoVivo<D, MemArena<X>>, g: GolpeDaArena) => {
    const { mem, dados, agora, passou } = p;
    g.decidido = true;
    const [cx, cy] = centroDoGolpe(g);
    const dono = mem.coelhos.get(g.dono);
    for (const v of mem.coelhos.values()) {
      if (!v.vivo || v.id === g.dono) continue;
      // equipes não se empurram
      if (p.turma.equipes && p.turma.equipeDe(v.id) === p.turma.equipeDe(g.dono)) continue;
      if (comprimento(v.x - cx, v.y - cy) > EMPURRAO_RAIO + RAIO) continue;
      // a direção: a do golpe, puxada para fora do centro (quem está de lado vai de lado)
      const [rx, ry] = normal(v.x - g.x, v.y - g.y);
      const [kx, ky] = normal(g.dx * 0.6 + rx * 0.4, g.dy * 0.6 + ry * 0.4);
      let caiu = false;
      for (let k = 1; k <= 6 && !caiu; k++) {
        const px = v.x + (kx * EMPURRAO * k) / 6;
        const py = v.y + (ky * EMPURRAO * k) / 6;
        if (px < 0 || py < 0 || px > ARENA_L || py > ARENA_A || !regras.chao(dados, mem, px, py, passou)) {
          v.x = px;
          v.y = py;
          caiu = true;
        }
      }
      if (caiu) {
        derrubar(mem, v, passou);
        if (dono) dono.derrubou++;
      } else {
        v.x = prenderNoCampo(v.x + kx * EMPURRAO, ARENA_L);
        v.y = prenderNoCampo(v.y + ky * EMPURRAO, ARENA_A);
        v.livreAte = agora + LIVRE_DEPOIS_DE_LEVAR;
        v.prontoEm = Math.max(v.prontoEm, agora + TONTO_MS);
        v.credito = BALDE_DE_DISTANCIA;
        mem.eventos.push(['k', v.id, Math.round(v.x), Math.round(v.y), g.dono]);
      }
      regras.aoLevar?.(mem, v, caiu, passou);
    }
  };

  /** O robô: foge do golpe que o ameaça (nem sempre), vai à meta do jogo ou atrás do mais perto, e empurra quando dá. */
  const pensar = (p: PassoAoVivo<D, MemArena<X>>, c: CoelhoDaArena, dt: number) => {
    const { mem, dados, agora, passou } = p;
    let alvoX = c.x;
    let alvoY = c.y;
    let fugindo = false;
    for (const g of mem.golpes) {
      if (g.decidido || g.dono === c.id) continue;
      const [cx, cy] = centroDoGolpe(g);
      const d = comprimento(c.x - cx, c.y - cy);
      if (d > EMPURRAO_RAIO + RAIO + 10) continue;
      // decide uma vez por golpe, e só depois de "ver" (a reação de gente)
      if (passou - g.inicio < 220) continue;
      if (!c.fugiuDe.has(g.id) && !c.fugiuDe.has(-g.id)) c.fugiuDe.add(p.aleatorio() < 0.6 ? g.id : -g.id);
      if (c.fugiuDe.has(g.id)) {
        const [fx, fy] = normal(c.x - cx, c.y - cy);
        alvoX = c.x + fx * 40;
        alvoY = c.y + fy * 40;
        fugindo = true;
      }
    }
    let alvo: CoelhoDaArena | null = null;
    if (!fugindo) {
      const meta = regras.metaDoRobo?.(dados, mem, c, passou) ?? null;
      let melhor = Infinity;
      for (const o of mem.coelhos.values()) {
        if (!o.vivo || o.id === c.id || (p.turma.equipes && p.turma.equipeDe(o.id) === p.turma.equipeDe(c.id))) continue;
        const d = comprimento(o.x - c.x, o.y - c.y);
        if (d < melhor) {
          melhor = d;
          alvo = o;
        }
      }
      if (meta) [alvoX, alvoY] = meta;
      else if (alvo) [alvoX, alvoY] = [alvo.x, alvo.y];
      // empurra quem está perto e na frente (pensando de tempos em tempos, como gente)
      // (e nunca parado num chão que vai sumir: a preparação o deixa parado)
      if (alvo && melhor < EMPURRAO_ALCANCE + EMPURRAO_RAIO && agora >= c.prontoEm && agora >= c.pensaEm && regras.chao(dados, mem, c.x, c.y, passou + EMPURRAO_PREPARO + 300)) {
        c.pensaEm = agora + 250 + p.aleatorio() * 350;
        if (p.aleatorio() < 0.55) golpear(mem, c, c.x, c.y, alvo.x - c.x, alvo.y - c.y, passou, agora);
      }
    }
    // parado durante a própria preparação
    if (mem.golpes.some((g) => g.dono === c.id && !g.decidido)) return;
    const dx = alvoX - c.x;
    const dy = alvoY - c.y;
    const d = comprimento(dx, dy);
    const perto = !fugindo && alvo && !regras.metaDoRobo?.(dados, mem, c, passou) ? 14 : 2;
    if (d <= perto) return;
    const passo = Math.min(d - perto, vel(mem, c) * 0.85 * dt);
    // nunca anda para fora do chão (o de daqui a pouco): tenta reto, depois de lado; sem saída, fica
    const [ox, oy] = normal(dx, dy);
    const tentativas: [number, number][] = [[ox, oy], normal(ox + oy, oy - ox), normal(ox - oy, oy + ox), [oy, -ox], [-oy, ox]];
    const livre = tentativas.find(
      ([tx, ty]) => regras.chao(dados, mem, c.x + tx * (passo + 10), c.y + ty * (passo + 10), passou + 400) && regras.chao(dados, mem, c.x + tx * passo, c.y + ty * passo, passou + 400),
    );
    // sem saída: se o lugar de agora também vai sumir, arrisca para a frente; senão, fica
    if (!livre && regras.chao(dados, mem, c.x, c.y, passou + 400)) return;
    const [nx, ny] = livre ?? [ox, oy];
    c.x = prenderNoCampo(c.x + nx * passo, ARENA_L);
    c.y = prenderNoCampo(c.y + ny * passo, ARENA_A);
    c.dx = nx;
    c.dy = ny;
  };

  return {
    passoMs: 50,
    passo(p) {
      const { mem, dados, passou, agora } = p;
      const dt = mem.ultimoPasso < 0 ? 0.05 : Math.min(0.2, (passou - mem.ultimoPasso) / 1000);
      mem.ultimoPasso = passou;
      regras.aoPasso?.(p);
      for (const c of mem.coelhos.values()) if (c.vivo && c.robo) pensar(p, c, dt);
      for (const g of mem.golpes) if (!g.decidido && passou >= g.bate + EMPURRAO_FOLGA) decidir(p, g);
      mem.golpes = mem.golpes.filter((g) => !g.decidido || passou - g.bate < 400);
      // o chão que sumiu derruba quem está nele (o chão de `folga` ms atrás: quem leva tem folga)
      for (const c of mem.coelhos.values()) {
        if (!c.vivo) continue;
        const folga = c.robo ? 0 : Math.min(p.folgaDe(c.id), 700);
        if (!regras.chao(dados, mem, c.x, c.y, passou - folga)) derrubar(mem, c, passou);
      }
      // o último em pé: um tempo para ver a queda, e acabou
      const ultimo = regras.ultimoEmPe ?? true;
      if (ultimo && mem.fimEm === null && mem.comecaram >= 2 && [...mem.coelhos.values()].filter((c) => c.vivo).length <= 1) mem.fimEm = agora + 900;
      const q = {
        j: [...mem.coelhos.values()].map((c) => [c.id, Math.round(c.x), Math.round(c.y), c.vivo ? 1 : 0, Math.round(c.dx * 100), Math.round(c.dy * 100), c.pontos]),
        g: mem.golpes.filter((g) => !g.decidido).map((g) => [g.id, g.dono, Math.round(g.x), Math.round(g.y), Math.round(g.dx * 100), Math.round(g.dy * 100), g.inicio, g.bate]),
        e: mem.eventos,
        ...(regras.quadro?.(mem) ?? {}),
      };
      mem.eventos = [];
      if (mem.fimEm !== null && agora >= mem.fimEm) p.revelar();
      return q;
    },
    receber(c: Conferencia<D, MemArena<X>>) {
      const { mem, quem, corpo, agora, passou } = c;
      const eu = mem.coelhos.get(quem);
      if (!eu || !eu.vivo || eu.robo) return;
      if (corpo.tipo === 'p') {
        const { x, y } = corpo;
        if (!numero(x) || !numero(y)) return;
        // mandou a posição: está jogando (mesmo que esta não valha)
        eu.mexeu = true;
        const nx = prenderNoCampo(x, ARENA_L);
        const ny = prenderNoCampo(y, ARENA_A);
        // o balde de distância: enche com a velocidade, e a internet que engasga gasta o acumulado de uma vez
        eu.credito = Math.min(BALDE_DE_DISTANCIA, eu.credito + (vel(mem, eu) * Math.max(0, agora - eu.em)) / 1000);
        eu.em = agora;
        const d = comprimento(nx - eu.x, ny - eu.y);
        const livre = agora < eu.livreAte ? EMPURRAO + 25 : 0;
        if (d > eu.credito + 8 + livre) return;
        eu.credito = Math.max(0, eu.credito - Math.max(0, d - livre));
        eu.x = nx;
        eu.y = ny;
        if (numero(corpo.dx) && numero(corpo.dy) && (corpo.dx !== 0 || corpo.dy !== 0)) [eu.dx, eu.dy] = normal(corpo.dx, corpo.dy);
      } else if (corpo.tipo === 'e') {
        if (agora < eu.prontoEm || !numero(corpo.dx) || !numero(corpo.dy)) return;
        // quem bate tem razão pelo passado: a área fica onde ele estava ao apertar, se for perto do que o servidor sabe
        let gx = eu.x;
        let gy = eu.y;
        if (numero(corpo.x) && numero(corpo.y) && comprimento(corpo.x - eu.x, corpo.y - eu.y) <= 20) {
          gx = corpo.x;
          gy = corpo.y;
        }
        golpear(mem, eu, gx, gy, corpo.dx, corpo.dy, passou, agora);
      } else if (corpo.tipo === 'pega' && inteiro(corpo.i)) {
        // o que o jogo deixa pegar (a chave): quem decide é o jogo, pelo que o servidor sabe da posição
        regras.pegar?.(c.dados, mem, eu, corpo.i, passou);
      }
    },
  };
}

/** Quem sobreviveu mais (e, no empate, derrubou mais) ganha: o resultado da maioria dos jogos de arena. */
export function porSobrevivencia(duracaoMs: number, c: CoelhoDaArena): Resultado {
  const durou = c.caiuEm ?? duracaoMs;
  return { motivo: null, valor: Math.round(durou), chave: [-Math.round(durou), -c.derrubou] };
}

/** O robô genérico (o teste do registro, ou quem não foi movido ao vivo): sobreviveu um pedaço plausível. */
export function roboDaArena(duracaoMs: number, aleatorio: () => number, passouMs: number): Resultado {
  const durou = Math.round(Math.min(passouMs, duracaoMs) * (0.35 + aleatorio() * 0.65));
  return { motivo: null, valor: durou, chave: [-durou, 0] };
}

/** As posições de largada numa roda em volta do centro (raio rx × ry), na ordem dos jogadores. */
export function largadaEmRoda(jogadores: number[], rx: number, ry: number): Map<number, [number, number]> {
  const n = Math.max(1, jogadores.length);
  // os pontos de uma roda sem seno nem cosseno: o mesmo desenho em qualquer navegador (só a largada; não precisa ser redondo)
  const pontos: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    // um octógono: 8 direções fixas, e daí para frente, no meio delas
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.71, -0.71], [0.71, 0.71], [0.71, -0.71], [-0.71, 0.71]];
    const [dx, dy] = dirs[i % 8];
    const f = i < 8 ? 1 : 0.55;
    pontos.push([Math.round(ARENA_L / 2 + dx * rx * f), Math.round(ARENA_A / 2 + dy * ry * f)]);
  }
  return new Map(jogadores.map((id, i) => [id, pontos[i]]));
}
