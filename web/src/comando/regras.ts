/**
 * O COMANDO CENOURA NO SITE (16/11/2026; a regra é a do servidor, server/src/comando/motor.ts). Aqui mora o CLIENTE: o coelho
 * de quem joga (corre, pula nas tábuas e atira aqui, sem esperar o servidor), a linha do tempo dos quadros (os bichos e os
 * outros desenhados ~100 ms atrás, interpolados), as minhas balas (voam aqui; o acerto, como a minha tela mostrou, vai ao
 * servidor, que confere pelo passado do bicho), a granada e as gaiolas. A tela (JogoComando.tsx) e o teste
 * (server/test/minijogos-comando.test.ts) usam o MESMO cliente: o teste joga a fase inteira contra o servidor de verdade.
 */
import {
  ACOES,
  andouABala,
  apoiado,
  ARMAS,
  BALA,
  balaNaCaixa,
  balasDoTiro,
  BICHOS,
  bocaDoLanca,
  ESTADOS,
  GRANADA,
  GRAVIDADE,
  INTERVALO,
  PASSO_MS,
  PERTO_DA_GAIOLA,
  pousoEm,
  PULO_VEL,
  REFENS,
  TIPOS,
  VEL,
  VIDA,
  VIDAS,
  type AcaoDoCoelho,
  type Arma,
  type EstadoDoBicho,
  type TipoDoBicho,
} from './conta';

/** O mesmo do servidor (o teste confere): depois de levar um golpe, piscando; e ao voltar. */
export const INVUL_MS = 1200;
export const INVUL_VOLTA_MS = 2200;
/** A tela desenha os bichos e os outros ATRASO_MS atrás do quadro mais novo. */
export const ATRASO_MS = 100;
export const ENVIO_MS = 66;
const DOR_MS = 300;

export type FaseDoComando = 'lutando' | 'avancando' | 'vitoria' | 'derrota' | 'fim';

/** O estado que o servidor manda pelo "mudou, busque de novo" (o resto vem no quadro). */
export interface EstadoComando {
  fase: FaseDoComando;
  onda: number;
  ondas: number;
  venceu: boolean;
  jogadores: { userId: number; username: string; avatar: number | string | null; pontos: number; vidas: number }[];
  resultado: { userId: number; username: string; pontos: number; acertos: number; derrubados: number; posicao: number | null }[] | null;
  partidaId: string;
}

export interface Quadro {
  tipo: 'q';
  n: number;
  f: FaseDoComando;
  o: number;
  a: [number, number];
  /** [id, tipo, x, h, estado, lado, vida %, passos no estado, x da marca] */
  i: number[][];
  /** [id, tipo, x, h, vx, vh] */
  b: number[][];
  /** [id, userId, x0, h0, x, ms até explodir] */
  g: number[][];
  r: number[];
  /** [userId, x, h, lado, ação, ms da ação, mira, vidas, golpes, pontos, estado, avatar, arma, ms de arma, ms piscando, último tiro] */
  j: number[][];
  /** [userId, n, x0, h0, direção, leque, ms desde] */
  p: number[][];
  e: unknown[][];
}

export const ehQuadro = (d: unknown): d is Quadro => {
  const q = d as Quadro | null;
  return !!q && q.tipo === 'q' && typeof q.n === 'number' && Array.isArray(q.i) && Array.isArray(q.j) && Array.isArray(q.a);
};

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  /** Segurado: atira no ritmo da arma. */
  atirar: boolean;
  /** Apertos desde o último passo (o passo zera depois de ler). */
  pulo: boolean;
  granada: boolean;
}
export const comandosVazios = (): Comandos => ({ esquerda: false, direita: false, cima: false, baixo: false, atirar: false, pulo: false, granada: false });

export interface BichoNaTela {
  id: number;
  tipo: TipoDoBicho;
  x: number;
  h: number;
  estado: EstadoDoBicho;
  lado: number;
  hp: number;
  /** Há quanto tempo (ms) está no estado. */
  ms: number;
  alvoX: number;
}
export interface BalaNaTela {
  id: number;
  tipo: number;
  x: number;
  h: number;
  vx: number;
  vh: number;
}
export interface Vista {
  passo: number;
  fase: FaseDoComando | null;
  onda: number;
  arena: [number, number];
  bichos: BichoNaTela[];
  /** As linhas dos coelhos, interpoladas (as mesmas colunas do quadro). */
  coelhos: number[][];
  balas: BalaNaTela[];
  granadas: { id: number; x0: number; h0: number; x: number; resta: number }[];
  gaiolas: number[];
  /** As balas que os OUTROS atiraram, onde estão agora. */
  balasDosOutros: { x: number; h: number; dx: number; dh: number }[];
}

export interface Efeito {
  tipo: 'faisca' | 'fumaca' | 'explosao' | 'pancada' | 'solto' | 'pisao' | 'semente';
  x: number;
  h: number;
  em: number;
  /** Na fumaça, o tamanho do bicho (o chefe faz uma nuvem maior). */
  grande?: boolean;
}
export type Som = 'acerto' | 'erro' | 'tiro' | 'queda' | 'moeda' | 'combo' | 'vez' | 'pulo';

export interface Meu {
  x: number;
  h: number;
  vh: number;
  lado: 1 | -1;
  mira: number;
  acao: AcaoDoCoelho;
  t: number;
  relogio: number;
  piscandoAte: number;
  vidas: number;
  hp: number;
  /** 0 em pé, 1 fora (volta logo), 2 sem vidas. */
  estado: number;
  arma: Arma;
  /** Até quando (no relógio do coelho) dura a arma de reforço. */
  armaAte: number;
  /** Quando (no relógio do coelho) a granada fica pronta. */
  granadaEm: number;
}

interface MinhaBala {
  n: number;
  k: number;
  x0: number;
  h0: number;
  dx: number;
  dh: number;
  inicio: number;
  andou: number;
  acertou: boolean;
}

/** A linha do tempo dos quadros (a mesma da Briga: a hora de cada passo sai da chegada mais adiantada). */
export class LinhaDoTempo {
  quadros: Quadro[] = [];
  base = Infinity;
  chegou(q: Quadro, agora: number) {
    const ultimo = this.quadros.at(-1);
    if (ultimo && q.n <= ultimo.n) return false;
    this.quadros.push(q);
    if (this.quadros.length > 40) this.quadros.shift();
    this.base = Math.min(this.base + 0.5, agora - q.n * PASSO_MS);
    return true;
  }
  passoDoServidor(agora: number) {
    return (agora - this.base) / PASSO_MS;
  }
  passoNaTela(agora: number) {
    return this.passoDoServidor(agora) - ATRASO_MS / PASSO_MS;
  }
  emVolta(p: number): { a: Quadro; b: Quadro; k: number } | null {
    const qs = this.quadros;
    if (!qs.length) return null;
    if (p <= qs[0].n) return { a: qs[0], b: qs[0], k: 0 };
    for (let i = qs.length - 1; i >= 0; i--) {
      if (qs[i].n <= p) {
        const b = qs[i + 1] ?? qs[i];
        const k = b === qs[i] ? 0 : (p - qs[i].n) / (b.n - qs[i].n);
        return { a: qs[i], b, k: Math.max(0, Math.min(1, k)) };
      }
    }
    return { a: qs[0], b: qs[0], k: 0 };
  }
  ultimo() {
    return this.quadros.at(-1) ?? null;
  }
}

/** Entre duas linhas do quadro (o mesmo id na coluna 0): as colunas `colunas` andam, o resto é o do mais novo. */
export function misturar(a: number[][], b: number[][], k: number, colunas: number[]): number[][] {
  const antes = new Map(a.map((l) => [l[0], l]));
  return b.map((l) => {
    const v = antes.get(l[0]);
    if (!v) return l;
    const r = [...l];
    for (const c of colunas) r[c] = v[c] + (l[c] - v[c]) * k;
    return r;
  });
}

/** A direção da mira pelas setas: para cima e na diagonal sempre; para baixo, só no ar. Sem nada, para a frente. */
export function miraDe(cmd: Comandos, lado: 1 | -1, noAr: boolean): number {
  const lx = cmd.direita && !cmd.esquerda ? 1 : cmd.esquerda && !cmd.direita ? -1 : 0;
  if (cmd.cima && !cmd.baixo) return lx > 0 ? 1 : lx < 0 ? 3 : 2;
  if (cmd.baixo && !cmd.cima && noAr) return lx > 0 ? 7 : lx < 0 ? 5 : 6;
  return lado > 0 ? 0 : 4;
}

export class Cliente {
  linha = new LinhaDoTempo();
  eu: Meu = { x: 30, h: 0, vh: 0, lado: 1, mira: 0, acao: 'parado', t: 0, relogio: 0, piscandoAte: 0, vidas: VIDAS, hp: VIDA, estado: 0, arma: 'normal', armaAte: 0, granadaEm: 0 };
  balas: MinhaBala[] = [];
  efeitos: Efeito[] = [];
  sons: Som[] = [];
  /** Quem piscou por levar um golpe (userId → até quando). */
  piscando = new Map<number, number>();
  /** Os bichos que piscam por levar uma bala (id → até quando). */
  bichosPiscando = new Map<number, number>();
  private proximoTiro = 1;
  private posicionado = false;
  private vistos = new Set<number>();
  private ultimoTiroEm = -Infinity;
  private ultimoEnvio = -Infinity;
  private pediuGaiola = new Map<number, number>();

  constructor(
    readonly id: number,
    private readonly enviar: (dados: unknown) => void,
  ) {}

  chegou(q: Quadro, agora: number) {
    if (!this.linha.chegou(q, agora)) return;
    const meu = q.j.find((l) => l[0] === this.id);
    if (meu) {
      if (!this.posicionado) {
        this.posicionado = true;
        this.eu.x = meu[1];
        this.eu.h = meu[2];
      }
      this.eu.vidas = meu[7];
      this.eu.hp = meu[8];
      this.eu.estado = meu[10];
      // a arma de reforço é do servidor (a gaiola que eu abri, e ela acaba com a vida)
      this.eu.arma = ARMAS[meu[12]] ?? 'normal';
      this.eu.armaAte = meu[13] ? this.eu.relogio + meu[13] : 0;
      if (meu[15] >= this.proximoTiro) this.proximoTiro = meu[15] + 1;
      if (meu[10] !== 0) this.eu.acao = 'caido';
    }
    for (const e of q.e) {
      const [id, tipo, ...r] = e as [number, string, ...number[]];
      if (this.vistos.has(id)) continue;
      this.vistos.add(id);
      if (this.vistos.size > 500) this.vistos.delete(this.vistos.values().next().value as number);
      if (tipo === 'p') {
        if (r[0] === this.id) {
          this.eu.hp = r[1];
          this.eu.acao = 'dor';
          this.eu.t = 0;
          this.eu.piscandoAte = this.eu.relogio + INVUL_MS;
          this.sons.push('erro');
          this.efeitos.push({ tipo: 'pancada', x: this.eu.x, h: this.eu.h + 20, em: agora });
        } else this.piscando.set(r[0], agora + INVUL_MS);
      } else if (tipo === 'k' && r[0] === this.id) {
        this.eu.estado = r[1] === 0 ? 2 : 1;
        this.eu.acao = 'caido';
        this.eu.t = 0;
        this.eu.vh = 0;
        this.sons.push('queda');
      } else if (tipo === 'r' && r[0] === this.id) {
        this.eu.estado = 0;
        this.eu.x = r[1];
        this.eu.h = 0;
        this.eu.vh = 0;
        this.eu.acao = 'parado';
        this.eu.hp = VIDA;
        this.eu.piscandoAte = this.eu.relogio + INVUL_VOLTA_MS;
      } else if (tipo === 'h') {
        this.bichosPiscando.set(r[0], agora + ATRASO_MS + 120);
      } else if (tipo === 'x') {
        this.efeitos.push({ tipo: 'fumaca', x: r[1], h: r[2], em: agora + ATRASO_MS, grande: TIPOS[r[3]] === 'dragao' });
        this.sons.push('combo');
      } else if (tipo === 'g') {
        this.efeitos.push({ tipo: 'explosao', x: r[0], h: 0, em: agora });
        this.sons.push('queda');
      } else if (tipo === 'l') {
        const [x] = REFENS[r[0]] ?? [0];
        this.efeitos.push({ tipo: 'solto', x, h: 0, em: agora });
        this.sons.push('moeda');
      } else if (tipo === 't') {
        this.efeitos.push({ tipo: 'pisao', x: r[0], h: 0, em: agora + ATRASO_MS });
        this.sons.push('queda');
      } else if (tipo === 's') {
        this.efeitos.push({ tipo: 'semente', x: r[0], h: 0, em: agora + ATRASO_MS });
      } else if (tipo === 'c') {
        this.sons.push('vez');
      }
    }
  }

  /** O que a tela mostra agora. */
  vista(agora: number): Vista {
    const ultimo = this.linha.ultimo();
    if (!ultimo) return { passo: 0, fase: null, onda: 0, arena: [0, 320], bichos: [], coelhos: [], balas: [], granadas: [], gaiolas: [0, 0, 0], balasDosOutros: [] };
    const p = this.linha.passoNaTela(agora);
    const agoraNoServidor = this.linha.passoDoServidor(agora);
    const volta = this.linha.emVolta(p)!;
    const k = volta.k;
    const bichos = misturar(volta.a.i, volta.b.i, k, [2, 3]).map((l) => ({
      id: l[0],
      tipo: TIPOS[l[1]] ?? 'cogumelo',
      x: l[2],
      h: l[3],
      estado: ESTADOS[l[4]] ?? 'andando',
      lado: l[5],
      hp: l[6],
      ms: (l[7] + (p - volta.b.n)) * PASSO_MS,
      alvoX: l[8],
    }));
    // as balas dos bichos andam em linha: do quadro mais novo, levadas até o passo da tela
    const balas = ultimo.b.map((b) => {
      const s = ((p - ultimo.n) * PASSO_MS) / 1000;
      return { id: b[0], tipo: b[1], x: b[2] + b[4] * s, h: Math.max(0, b[3] + b[5] * s), vx: b[4], vh: b[5] };
    });
    const balasDosOutros: Vista['balasDosOutros'] = [];
    for (const s of ultimo.p) {
      if (s[0] === this.id) continue;
      const ms = s[6] + (p - ultimo.n) * PASSO_MS;
      const d = andouABala(ms);
      if (d >= BALA.alcance || ms < 0) continue;
      for (const [dx, dh] of balasDoTiro(s[4], s[5] ? 'leque' : 'normal')) balasDosOutros.push({ x: s[2] + dx * d, h: s[3] + dh * d, dx, dh });
    }
    return {
      passo: p,
      fase: ultimo.f,
      onda: ultimo.o,
      arena: ultimo.a,
      bichos,
      coelhos: misturar(volta.a.j, volta.b.j, k, [1, 2]),
      balas,
      granadas: ultimo.g.map((g) => ({ id: g[0], x0: g[2], h0: g[3], x: g[4], resta: g[5] - (agoraNoServidor - ultimo.n) * PASSO_MS })),
      gaiolas: ultimo.r,
      balasDosOutros,
    };
  }

  /** Pode jogar agora (a fase segue e eu estou em pé)? */
  jogando(): boolean {
    const f = this.linha.ultimo()?.f;
    return (f === 'lutando' || f === 'avancando') && this.eu.estado === 0;
  }

  /**
   * UM PASSO DO MEU COELHO (dt em segundos; a tela chama a 60 por segundo). Corre, pula, cai nas tábuas, mira, atira, solta
   * a granada, abre a gaiola em que encosta, e confere as minhas balas contra os bichos COMO A VISTA OS MOSTRA.
   */
  passo(cmd: Comandos, dt: number, agora: number, v: Vista) {
    const eu = this.eu;
    const ms = dt * 1000;
    eu.relogio += ms;
    eu.t += ms;
    const pular = cmd.pulo;
    const granada = cmd.granada;
    cmd.pulo = cmd.granada = false;

    // as minhas balas: acertaram um bicho como ele está na minha tela?
    for (const b of this.balas) {
      if (b.acertou) continue;
      const d = andouABala(agora - b.inicio);
      for (const i of v.bichos) {
        if (i.estado === 'morto' || i.hp <= 0) continue;
        const c = BICHOS[i.tipo];
        if (balaNaCaixa(b.x0, b.h0, b.dx, b.dh, b.andou, d, i.x, i.h, c.larg, c.alto, 0)) {
          b.acertou = true;
          this.enviar({ tipo: 'acerto', n: b.n, k: b.k, inimigo: i.id });
          this.efeitos.push({ tipo: 'faisca', x: b.x0 + b.dx * d, h: b.h0 + b.dh * d, em: agora });
          this.sons.push('acerto');
          break;
        }
      }
      b.andou = d;
    }
    this.balas = this.balas.filter((b) => !b.acertou && b.andou < BALA.alcance && b.h0 + b.dh * b.andou > -4);
    if (!this.jogando()) return;

    // correr (dentro da arena da onda: a câmera não deixa sair)
    if (eu.acao === 'dor' && eu.t >= DOR_MS) eu.acao = 'parado';
    const mx = (cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0);
    const [a0, a1] = v.arena;
    eu.x = Math.max(a0 + 8, Math.min(a1 - 8, eu.x + mx * VEL * dt));
    if (mx > 0) eu.lado = 1;
    else if (mx < 0) eu.lado = -1;

    // pular, e cair (nas tábuas só por cima)
    if (pular && apoiado(eu.x, eu.h) && eu.vh <= 0) {
      eu.vh = PULO_VEL;
      this.sons.push('pulo');
    }
    if (eu.vh > 0 || !apoiado(eu.x, eu.h)) {
      const h1 = eu.h + eu.vh * dt;
      eu.vh -= GRAVIDADE * dt;
      const pouso = eu.vh <= 0 ? pousoEm(eu.x, eu.h, h1) : null;
      if (pouso !== null) {
        eu.h = pouso;
        eu.vh = 0;
      } else eu.h = Math.max(0, h1);
    }
    const noAr = !apoiado(eu.x, eu.h) || eu.vh > 0;
    if (eu.acao !== 'dor') {
      const acao: AcaoDoCoelho = noAr ? 'pulo' : mx !== 0 ? 'andando' : 'parado';
      if (acao !== eu.acao) ((eu.acao = acao), (eu.t = 0));
    }

    // a mira e o tiro (segurando, no ritmo da arma)
    eu.mira = miraDe(cmd, eu.lado, noAr);
    if (eu.armaAte && eu.relogio >= eu.armaAte) eu.arma = 'normal';
    if (cmd.atirar && agora - this.ultimoTiroEm >= INTERVALO[eu.arma] + 8) {
      this.ultimoTiroEm = agora;
      const [x0, h0] = bocaDoLanca(eu.x, eu.h, eu.mira);
      const n = this.proximoTiro++;
      // a posição vai antes: a origem do tiro é conferida contra ela
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'tiro', n, x: Math.round(x0 * 10) / 10, h: Math.round(h0 * 10) / 10, dir: eu.mira });
      const x = Math.round(x0 * 10) / 10, h = Math.round(h0 * 10) / 10;
      balasDoTiro(eu.mira, eu.arma).forEach(([dx, dh], k) => this.balas.push({ n, k, x0: x, h0: h, dx, dh, inicio: agora, andou: 0, acertou: false }));
      this.sons.push('tiro');
    }
    if (granada && eu.relogio >= eu.granadaEm) {
      eu.granadaEm = eu.relogio + GRANADA.recarga;
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'granada', x: Math.round(eu.x * 10) / 10, h: Math.round(eu.h * 10) / 10, lado: eu.lado });
      this.sons.push('pulo');
    }

    // encostou numa gaiola fechada: abre (o servidor confere e dá o reforço)
    REFENS.forEach(([gx], k) => {
      if (v.gaiolas[k] || Math.abs(eu.x - gx) > PERTO_DA_GAIOLA || eu.h > 20) return;
      if ((this.pediuGaiola.get(k) ?? -Infinity) > agora - 500) return;
      this.pediuGaiola.set(k, agora);
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'soltar', gaiola: k });
    });
    if (agora - this.ultimoEnvio >= ENVIO_MS) this.mandarPosicao(agora);
  }

  /** A carga da granada (0 a 1). */
  cargaDaGranada(): number {
    return Math.max(0, Math.min(1, 1 - (this.eu.granadaEm - this.eu.relogio) / GRANADA.recarga));
  }

  private mandarPosicao(agora: number) {
    this.ultimoEnvio = agora;
    this.enviar({
      tipo: 'pos',
      x: Math.round(this.eu.x * 10) / 10,
      h: Math.round(this.eu.h * 10) / 10,
      lado: this.eu.lado,
      acao: ACOES.indexOf(this.eu.acao),
      ta: Math.round(this.eu.t),
      mira: this.eu.mira,
    });
  }

  /** As minhas balas no ar, onde estão agora (para desenhar). */
  minhasBalas(agora: number) {
    return this.balas.map((b) => {
      const d = andouABala(agora - b.inicio);
      return { x: b.x0 + b.dx * d, h: b.h0 + b.dh * d, dx: b.dx, dh: b.dh };
    });
  }
}

const MEDALHAS = ['🥇', '🥈', '🥉'];
/** A medalha do fim é a do troféu: a fase vencida, fora do Solo, 2 ou mais que ficaram, até o 3º, com pontos. */
export function marcaDoLugar(posicao: number | null, pontos: number, o: { venceu: boolean; solo: boolean; ficaram: number }): string {
  if (posicao === null) return '–';
  if (o.venceu && !o.solo && o.ficaram >= 2 && posicao <= 3 && pontos > 0) return MEDALHAS[posicao - 1];
  return `${posicao}.`;
}
