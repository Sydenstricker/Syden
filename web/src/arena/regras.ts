/**
 * A ARENA DOS COELHOS NO SITE (17/11/2026; a regra é a do servidor, server/src/arena/motor.ts). Aqui mora o CLIENTE: o coelho de
 * quem joga (anda, faz a arrancada, mira e bate aqui, sem esperar o servidor), a linha do tempo dos quadros (os outros coelhos
 * desenhados ~100 ms atrás, interpolados), as minhas balas (andam aqui; o acerto, como a minha tela mostrou, vai ao servidor,
 * que confere pelo passado do alvo), as zonas marcadas e os suprimentos. A tela (JogoArena.tsx) e o teste
 * (server/test/minijogos-bichos-arena.test.ts) usam o MESMO cliente: o teste joga a partida inteira contra o servidor de verdade.
 */
import {
  ACOES,
  alcanceLivre,
  andar,
  andouABala,
  ARRANCADA,
  balaPassaPerto,
  balasDoGolpe,
  bocaDoGolpe,
  ELEMENTOS_DA_ARENA,
  ESPECIAL_MAX,
  GOLPE_MS,
  KITS,
  PASSO_MS,
  perto,
  PERTO_DO_SUPRIMENTO,
  PONTOS_DE_SUPRIMENTO,
  PV,
  RAIO,
  RAPIDO,
  RECARGA_DA_TROCA,
  seguirVelocidade,
  SUPRIMENTOS,
  TECLAS_DE_GOLPE,
  unitario,
  VEL,
  velDoChao,
  VIDAS,
  type AcaoDoCoelho,
  type Cenario,
  type Golpe,
  type Suprimento,
  type TeclaDeGolpe,
} from './conta';
import { ESPECIES } from '../bichos/regras';

/** O mesmo do servidor (o teste confere): ao voltar, piscando. */
export const INVUL_VOLTA_MS = 2000;
/** A tela desenha os outros ATRASO_MS atrás do quadro mais novo. */
export const ATRASO_MS = 100;
export const ENVIO_MS = 66;
const DOR_MS = 260;

export type FaseDaArena = 'lutando' | 'vitoria' | 'fim';
export type FormatoDaArena = '1x1' | '3x3' | 'todos';

/** O estado que o servidor manda pelo "mudou, busque de novo" (o resto vem no quadro). */
export interface EstadoArena {
  modo: 'arena';
  fase: FaseDaArena;
  formato: FormatoDaArena;
  cenario: Cenario;
  /** A luta de sempre, ou segurar a zona (19/11/2026). */
  objetivo?: 'luta' | 'zona';
  solo: boolean;
  vencedor: number | null;
  jogadores: { userId: number; username: string; avatar: number | string | null; time: number; equipe: string[]; robo: boolean }[];
  /** No fim, por pessoa: o dano causado, os nocautes, o dano levado, os desvios (marcas no chão de onde escapou) e, segurando a zona, os pontos do time. */
  resultado: { userId: number; username: string; time: number; dano: number; quedas: number; vidas: number; levou?: number; desvios?: number; pontos?: number; posicao: number | null; robo: boolean }[] | null;
  partidaId: string;
}

export interface Quadro {
  tipo: 'q';
  n: number;
  f: FaseDaArena;
  /** ms que faltam. */
  r: number;
  /**
   * [id, x, y, mira x ×100, mira y ×100, ação, ms da ação, vidas, vida, estado, time, bicho, especial, ms rápido, ms piscando,
   * último golpe, ms para voltar, escondido]. Escondido (1): no MATO, fora da vista do meu time; o servidor nem manda a posição.
   */
  j: number[][];
  /** [dono, n, k, x0, y0, dx ×1000, dy ×1000, ms desde, elemento, tecla, até onde vai] */
  p: number[][];
  /** [id, x, y, raio, ms até bater, elemento, dono, time, ms do aviso inteiro] */
  z: number[][];
  /** Segurando a zona: [time, pontos], e o time que está nela agora (-1: ninguém, ou disputada). */
  o?: number[][];
  od?: number;
  /** [id, ponto, tipo] */
  s: number[][];
  e: unknown[][];
}

export const ehQuadro = (d: unknown): d is Quadro => {
  const q = d as Quadro | null;
  return !!q && q.tipo === 'q' && typeof q.n === 'number' && Array.isArray(q.j) && Array.isArray(q.p) && Array.isArray(q.z);
};

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  /** O joystick do toque (360°): de -1 a 1; null: as teclas. */
  moverX: number | null;
  moverY: number | null;
  /** Para onde mira (no mundo); null: para onde anda. */
  alvoX: number | null;
  alvoY: number | null;
  /** Segurado: o básico, na recarga dele. */
  atacar: boolean;
  /** Apertos desde o último passo (o passo zera depois de ler). */
  secundario: boolean;
  forte: boolean;
  especial: boolean;
  arrancada: boolean;
  /** Trocar para o bicho i; -1: o próximo. null: nada. */
  trocar: number | null;
}
export const comandosVazios = (): Comandos => ({
  esquerda: false,
  direita: false,
  cima: false,
  baixo: false,
  moverX: null,
  moverY: null,
  alvoX: null,
  alvoY: null,
  atacar: false,
  secundario: false,
  forte: false,
  especial: false,
  arrancada: false,
  trocar: null,
});

export interface CoelhoNaTela {
  id: number;
  x: number;
  y: number;
  mx: number;
  my: number;
  acao: AcaoDoCoelho;
  ms: number;
  vidas: number;
  pv: number;
  estado: number;
  time: number;
  ativo: number;
  especial: number;
  rapido: boolean;
  piscando: boolean;
  voltaMs: number;
  /** No mato, longe da minha vista: a posição não veio (a tela não desenha, a bala não acerta, o piloto não mira). */
  escondido: boolean;
}
export interface BalaNaTela {
  dono: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  elemento: string;
  golpe: Golpe;
}
export interface ZonaNaTela {
  id: number;
  x: number;
  y: number;
  raio: number;
  /** Quanto falta para bater (ms; negativo: já bateu). */
  resta: number;
  /** null: a zona da arena. */
  elemento: string | null;
  dono: number;
  time: number;
  /** Quanto ela avisa, inteiro (ms). */
  aviso: number;
}
export interface Vista {
  passo: number;
  fase: FaseDaArena | null;
  resta: number;
  coelhos: CoelhoNaTela[];
  balas: BalaNaTela[];
  zonas: ZonaNaTela[];
  suprimentos: { id: number; x: number; y: number; tipo: Suprimento }[];
  /** Segurando a zona: os pontos de cada time, e quem está nela. */
  zona: { pontos: Map<number, number>; dono: number } | null;
}

export interface Efeito {
  tipo: 'faisca' | 'fumaca' | 'numero' | 'roda' | 'pegou' | 'caiu' | 'zona';
  x: number;
  y: number;
  em: number;
  elemento?: string | null;
  texto?: string;
  /** No número: 1 o golpe que vale mais, 2 o que vale menos. */
  forca?: number;
  raio?: number;
}
export type Som = 'acerto' | 'erro' | 'tiro' | 'queda' | 'moeda' | 'combo' | 'vez' | 'pulo';

export interface Meu {
  x: number;
  y: number;
  mx: number;
  my: number;
  acao: AcaoDoCoelho;
  t: number;
  piscandoAte: number;
  vidas: number;
  pv: number;
  /** 0 de pé, 1 fora (volta logo), 2 sem vidas. */
  estado: number;
  time: number;
  ativo: number;
  especial: number;
  rapidoAte: number;
  arrancadaAte: number;
  arrancadaEm: number;
  dx: number;
  dy: number;
  trocaEm: number;
  /** Quando cada golpe fica pronto (no relógio da tela). */
  pronto: Record<TeclaDeGolpe, number>;
  /** O recuo de quem levou um golpe: de onde veio e até quando. */
  recuoX: number;
  recuoY: number;
  recuoAte: number;
  /** A velocidade de agora (px/s): no gelo, ela escorrega. */
  vx: number;
  vy: number;
}

interface MinhaBala {
  n: number;
  k: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  golpe: Golpe;
  elemento: string;
  inicio: number;
  andou: number;
  livre: number;
  acertou: boolean;
}

/** A linha do tempo dos quadros (a mesma da Briga: a hora de cada passo sai da chegada mais adiantada). */
export class LinhaDoTempo {
  quadros: Quadro[] = [];
  base = Infinity;
  /** Quando o quadro mais novo chegou (no relógio da tela): o que anda sozinho (as balas, as zonas) conta daqui. */
  ultimoEm = 0;
  chegou(q: Quadro, agora: number) {
    const ultimo = this.quadros.at(-1);
    if (ultimo && q.n <= ultimo.n) return false;
    this.quadros.push(q);
    this.ultimoEm = agora;
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

/**
 * Entre duas linhas do quadro (o mesmo id na coluna 0): as colunas `colunas` andam, o resto é o do mais novo. Quem estava ou
 * está escondido no mato (a coluna 17) não anda: a posição dele não veio.
 */
export function misturar(a: number[][], b: number[][], k: number, colunas: number[]): number[][] {
  const antes = new Map(a.map((l) => [l[0], l]));
  return b.map((l) => {
    const v = antes.get(l[0]);
    if (!v || v[17] || l[17]) return l;
    const r = [...l];
    for (const c of colunas) r[c] = v[c] + (l[c] - v[c]) * k;
    return r;
  });
}

export const elementoDoIndice = (i: number): string | null => ELEMENTOS_DA_ARENA[i] ?? null;

export class Cliente {
  linha = new LinhaDoTempo();
  eu: Meu = {
    x: 0, y: 0, mx: 1, my: 0, acao: 'parado', t: 0, piscandoAte: 0, vidas: VIDAS, pv: PV, estado: 0, time: 0, ativo: 0, especial: 0,
    rapidoAte: 0, arrancadaAte: 0, arrancadaEm: -Infinity, dx: 1, dy: 0, trocaEm: -Infinity, pronto: { b: 0, s: 0, q: 0, e: 0 },
    recuoX: 0, recuoY: 0, recuoAte: 0, vx: 0, vy: 0,
  };
  balas: MinhaBala[] = [];
  efeitos: Efeito[] = [];
  sons: Som[] = [];
  /** Os outros que levaram um golpe agora (id → até quando piscam), e de que lado veio (para o recuo). */
  feridos = new Map<number, { ate: number; dx: number; dy: number }>();
  private proximoTiro = 1;
  private posicionado = false;
  private vistos = new Set<number>();
  private ultimoEnvio = -Infinity;
  private pediuSuprimento = new Map<number, number>();

  constructor(
    readonly id: number,
    readonly cenario: Cenario,
    /** O elemento do bicho da frente de alguém (a equipe vem no estado lento). */
    readonly equipes: Map<number, string[]>,
    private readonly enviar: (dados: unknown) => void,
  ) {}

  /** O elemento do meu bicho da frente. */
  meuElemento(): string {
    return this.elementoDe(this.id, this.eu.ativo);
  }
  elementoDe(id: number, ativo: number): string {
    const e = this.equipes.get(id)?.[ativo];
    return (e && ESPECIES[e]?.elemento) || 'folha';
  }

  chegou(q: Quadro, agora: number) {
    if (!this.linha.chegou(q, agora)) return;
    const meu = q.j.find((l) => l[0] === this.id);
    if (meu) {
      if (!this.posicionado) {
        this.posicionado = true;
        this.eu.x = meu[1];
        this.eu.y = meu[2];
        this.eu.mx = meu[3] / 100;
        this.eu.my = meu[4] / 100;
      }
      this.eu.vidas = meu[7];
      this.eu.pv = meu[8];
      this.eu.estado = meu[9];
      this.eu.time = meu[10];
      // o bicho da frente: o servidor manda, mas a troca que eu acabei de pedir ainda não chegou
      if (agora - this.eu.trocaEm > 600) this.eu.ativo = meu[11];
      this.eu.especial = meu[12];
      this.eu.rapidoAte = meu[13] ? agora + meu[13] : 0;
      if (meu[14] > 0 && meu[9] === 0) this.eu.piscandoAte = Math.max(this.eu.piscandoAte, agora + meu[14]);
      if (meu[15] >= this.proximoTiro) this.proximoTiro = meu[15] + 1;
      if (meu[9] !== 0) this.eu.acao = 'fora';
    }
    for (const e of q.e) {
      const [id, tipo, ...r] = e as [number, string, ...number[]];
      if (this.vistos.has(id)) continue;
      this.vistos.add(id);
      if (this.vistos.size > 600) this.vistos.delete(this.vistos.values().next().value as number);
      if (tipo === 'h') {
        // [alvo, dono, dano, eficácia (0, 1 vale mais, 2 vale menos), elemento]
        const [alvo, dono, dano, efic, el] = r;
        const de = q.j.find((l) => l[0] === dono && !l[17]);
        const quem = alvo === this.id ? this.eu : null;
        const linhaDoAlvo = q.j.find((l) => l[0] === alvo);
        const ax = quem ? quem.x : (linhaDoAlvo?.[1] ?? 0);
        const ay = quem ? quem.y : (linhaDoAlvo?.[2] ?? 0);
        const [ux, uy] = de ? unitario(ax - de[1], ay - de[2]) : [0, 0];
        // o número sobe de quem eu vejo (quem leva um golpe aparece no mato; por garantia)
        if (quem || (linhaDoAlvo && !linhaDoAlvo[17])) this.efeitos.push({ tipo: 'numero', x: ax, y: ay, em: agora + (quem ? 0 : ATRASO_MS), texto: String(dano), forca: efic, elemento: elementoDoIndice(el) });
        if (alvo === this.id) {
          this.eu.acao = 'dor';
          this.eu.t = 0;
          this.eu.recuoX = ux;
          this.eu.recuoY = uy;
          this.eu.recuoAte = agora + 160;
          this.sons.push('erro');
        } else {
          this.feridos.set(alvo, { ate: agora + ATRASO_MS + 220, dx: ux, dy: uy });
          if (dono === this.id) this.sons.push('acerto');
        }
      } else if (tipo === 'k') {
        // [quem, vidas, x, y]: vira estrelinhas e fumaça
        this.efeitos.push({ tipo: 'caiu', x: r[2], y: r[3], em: agora + (r[0] === this.id ? 0 : ATRASO_MS) });
        this.sons.push('queda');
        if (r[0] === this.id) {
          this.eu.estado = r[1] === 0 ? 2 : 1;
          this.eu.acao = 'fora';
        }
      } else if (tipo === 'v' && r[0] === this.id) {
        this.eu.estado = 0;
        this.eu.x = r[1];
        this.eu.y = r[2];
        this.eu.acao = 'parado';
        this.eu.pv = PV;
        this.eu.piscandoAte = agora + INVUL_VOLTA_MS;
        this.balas = [];
      } else if (tipo === 'r') {
        // a roda de alguém: [quem, elemento, tecla]
        const l = q.j.find((x) => x[0] === r[0]);
        const golpeDaRoda = KITS[elementoDoIndice(r[1]) ?? 'folha'][TECLAS_DE_GOLPE[r[2]] ?? 's'];
        if (l && !l[17] && r[0] !== this.id) this.efeitos.push({ tipo: 'roda', x: l[1], y: l[2], em: agora + ATRASO_MS, elemento: elementoDoIndice(r[1]), raio: golpeDaRoda.raio });
      } else if (tipo === 'g') {
        // pegou um suprimento: [quem, tipo, ponto]
        const [px, py] = PONTOS_DE_SUPRIMENTO[r[2]] ?? [0, 0];
        this.efeitos.push({ tipo: 'pegou', x: px, y: py, em: agora });
        if (r[0] === this.id) this.sons.push('moeda');
      } else if (tipo === 's') {
        this.sons.push('vez');
      } else if (tipo === 't' && r[0] === this.id) {
        this.eu.ativo = r[1];
      }
    }
  }

  /** O que a tela mostra agora. */
  vista(agora: number): Vista {
    const ultimo = this.linha.ultimo();
    if (!ultimo) return { passo: 0, fase: null, resta: 0, coelhos: [], balas: [], zonas: [], suprimentos: [], zona: null };
    const p = this.linha.passoNaTela(agora);
    const volta = this.linha.emVolta(p)!;
    // o tempo desde que o quadro mais novo chegou (e não pelo passo: o relógio de 50 ms do servidor atrasa em alguns sistemas)
    const desde = agora - this.linha.ultimoEm;
    const atraso = desde - ATRASO_MS;
    const coelhos = misturar(volta.a.j, volta.b.j, volta.k, [1, 2]).map((l) => ({
      id: l[0],
      x: l[1],
      y: l[2],
      mx: l[3] / 100,
      my: l[4] / 100,
      acao: ACOES[l[5]] ?? 'parado',
      ms: l[6],
      vidas: l[7],
      pv: l[8],
      estado: l[9],
      time: l[10],
      ativo: l[11],
      especial: l[12],
      rapido: l[13] > 0,
      piscando: l[14] > 0,
      voltaMs: l[16],
      escondido: l[17] === 1,
    }));
    const balas: BalaNaTela[] = [];
    for (const b of ultimo.p) {
      if (b[0] === this.id) continue;
      const el = elementoDoIndice(b[8]) ?? 'folha';
      const g = KITS[el][TECLAS_DE_GOLPE[b[9]] ?? 'b'];
      const d = andouABala(g, b[7] + atraso);
      if (d >= b[10] || b[7] + atraso < 0) continue;
      const dx = b[5] / 1000, dy = b[6] / 1000;
      balas.push({ dono: b[0], x: b[3] + dx * d, y: b[4] + dy * d, dx, dy, elemento: el, golpe: g });
    }
    // as zonas: o tempo que falta, contado da chegada do quadro mais novo até agora (sem o atraso da tela: é o relógio delas)
    const agoraNoServidor = desde;
    const zonas = ultimo.z.map((z) => ({ id: z[0], x: z[1], y: z[2], raio: z[3], resta: z[4] - agoraNoServidor, elemento: elementoDoIndice(z[5]), dono: z[6], time: z[7], aviso: z[8] ?? 700 }));
    const suprimentos = ultimo.s.map((s) => {
      const [x, y] = PONTOS_DE_SUPRIMENTO[s[1]] ?? [0, 0];
      return { id: s[0], x, y, tipo: SUPRIMENTOS[s[2]] ?? 'cura' };
    });
    const zona = ultimo.o ? { pontos: new Map(ultimo.o.map(([time, n]) => [time, n] as [number, number])), dono: ultimo.od ?? -1 } : null;
    return { passo: p, fase: ultimo.f, resta: Math.max(0, ultimo.r - agoraNoServidor), coelhos, balas, zonas, suprimentos, zona };
  }

  /** Pode jogar agora (a partida segue e eu estou de pé)? */
  jogando(): boolean {
    return this.linha.ultimo()?.f === 'lutando' && this.eu.estado === 0;
  }

  /** O golpe desta tecla está pronto? */
  pronto(tecla: TeclaDeGolpe, agora: number): boolean {
    return tecla === 'e' ? this.eu.especial >= ESPECIAL_MAX : agora >= this.eu.pronto[tecla];
  }
  /** Quanto falta da recarga (0 a 1). */
  carga(tecla: TeclaDeGolpe, agora: number): number {
    if (tecla === 'e') return Math.min(1, this.eu.especial / ESPECIAL_MAX);
    const g = KITS[this.meuElemento()][tecla];
    return Math.max(0, Math.min(1, 1 - (this.eu.pronto[tecla] - agora) / g.recarga));
  }
  cargaDaTroca(agora: number): number {
    return Math.max(0, Math.min(1, (agora - this.eu.trocaEm) / RECARGA_DA_TROCA));
  }
  cargaDaArrancada(agora: number): number {
    return Math.max(0, Math.min(1, (agora - this.eu.arrancadaEm) / ARRANCADA.recarga));
  }

  /**
   * UM PASSO DO MEU COELHO (dt em segundos; a tela chama a 60 por segundo). Anda, faz a arrancada, mira, bate, troca o bicho,
   * pega o suprimento em que encosta, e confere as minhas balas contra os outros COMO A VISTA OS MOSTRA.
   */
  passo(cmd: Comandos, dt: number, agora: number, v: Vista) {
    const eu = this.eu;
    eu.t += dt * 1000;
    const pedidos = { s: cmd.secundario, q: cmd.forte, e: cmd.especial, arrancada: cmd.arrancada, trocar: cmd.trocar };
    cmd.secundario = cmd.forte = cmd.especial = cmd.arrancada = false;
    cmd.trocar = null;

    // as minhas balas: acertaram alguém como ele está na minha tela?
    for (const b of this.balas) {
      if (b.acertou) continue;
      const d = Math.min(andouABala(b.golpe, agora - b.inicio), b.livre);
      for (const o of v.coelhos) {
        if (o.id === this.id || o.time === eu.time || o.estado !== 0 || o.piscando || o.escondido) continue;
        if (balaPassaPerto(b.x0, b.y0, b.dx, b.dy, b.andou, d, o.x, o.y, RAIO + b.golpe.raio)) {
          b.acertou = true;
          this.enviar({ tipo: 'acerto', n: b.n, k: b.k, alvo: o.id });
          this.efeitos.push({ tipo: 'faisca', x: b.x0 + b.dx * d, y: b.y0 + b.dy * d, em: agora, elemento: b.elemento });
          break;
        }
      }
      b.andou = d;
      if (!b.acertou && d >= b.livre && b.livre < b.golpe.alcance) this.efeitos.push({ tipo: 'faisca', x: b.x0 + b.dx * d, y: b.y0 + b.dy * d, em: agora, elemento: b.elemento });
    }
    this.balas = this.balas.filter((b) => !b.acertou && b.andou < b.livre);
    if (!this.jogando()) return;

    // andar (ou a arrancada)
    if (eu.acao === 'dor' && eu.t >= DOR_MS) eu.acao = 'parado';
    const joystick = cmd.moverX !== null && cmd.moverY !== null && cmd.moverX * cmd.moverX + cmd.moverY * cmd.moverY > 0.04;
    const ix = joystick ? cmd.moverX! : (cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0);
    const iy = joystick ? cmd.moverY! : (cmd.baixo ? 1 : 0) - (cmd.cima ? 1 : 0);
    const anda = ix !== 0 || iy !== 0;
    const [ux, uy] = anda ? unitario(ix, iy) : [0, 0];
    // a mira: o mouse (ou o toque); sem ele, para onde anda
    if (cmd.alvoX !== null && cmd.alvoY !== null) [eu.mx, eu.my] = unitario(cmd.alvoX - eu.x, cmd.alvoY - eu.y);
    else if (anda) [eu.mx, eu.my] = [ux, uy];
    if (pedidos.arrancada && agora - eu.arrancadaEm >= ARRANCADA.recarga) {
      eu.arrancadaEm = agora;
      eu.arrancadaAte = agora + ARRANCADA.ms;
      [eu.dx, eu.dy] = anda ? [ux, uy] : [eu.mx, eu.my];
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'arrancada' });
      this.sons.push('pulo');
    }
    const arrancando = agora < eu.arrancadaAte;
    if (arrancando) {
      [eu.vx, eu.vy] = [eu.dx * ARRANCADA.vel, eu.dy * ARRANCADA.vel];
      [eu.x, eu.y] = andar(this.cenario, eu.x, eu.y, eu.vx * dt, eu.vy * dt);
    } else {
      // o chão (conta.ts): a lama segura, o gelo escorrega, também ao parar
      const vel = anda ? VEL * (agora < eu.rapidoAte ? RAPIDO.mult : 1) * velDoChao(this.cenario, eu.x, eu.y) : 0;
      [eu.vx, eu.vy] = seguirVelocidade(this.cenario, eu.vx, eu.vy, ux * vel, uy * vel, dt);
      if (eu.vx * eu.vx + eu.vy * eu.vy > 1) [eu.x, eu.y] = andar(this.cenario, eu.x, eu.y, eu.vx * dt, eu.vy * dt);
    }
    if (agora < eu.recuoAte) [eu.x, eu.y] = andar(this.cenario, eu.x, eu.y, eu.recuoX * 60 * dt, eu.recuoY * 60 * dt);
    if (eu.acao !== 'dor' && !(eu.acao === 'golpe' && eu.t < GOLPE_MS)) {
      const acao: AcaoDoCoelho = arrancando ? 'arrancada' : anda ? 'andando' : 'parado';
      if (acao !== eu.acao) ((eu.acao = acao), (eu.t = 0));
    }

    // trocar o bicho
    const n = this.equipes.get(this.id)?.length ?? 1;
    if (pedidos.trocar !== null && n > 1 && agora - eu.trocaEm >= RECARGA_DA_TROCA) {
      const i = pedidos.trocar < 0 ? (eu.ativo + 1) % n : pedidos.trocar;
      if (i >= 0 && i < n && i !== eu.ativo) {
        eu.ativo = i;
        eu.trocaEm = agora;
        this.enviar({ tipo: 'trocar', i });
        this.sons.push('vez');
      }
    }

    // os golpes
    const el = this.meuElemento();
    const kit = KITS[el];
    const usar = (tecla: TeclaDeGolpe) => {
      if (!this.pronto(tecla, agora)) return false;
      const g = kit[tecla];
      const [ox, oy] = bocaDoGolpe(eu.x, eu.y, eu.mx, eu.my);
      const x = Math.round(ox * 10) / 10, y = Math.round(oy * 10) / 10;
      const n = this.proximoTiro++;
      const ax = cmd.alvoX ?? eu.x + eu.mx * 120, ay = cmd.alvoY ?? eu.y + eu.my * 120;
      // a posição vai antes: a origem do golpe é conferida contra ela
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'golpe', n, tecla, x, y, dx: Math.round(eu.mx * 1000) / 1000, dy: Math.round(eu.my * 1000) / 1000, ax: Math.round(ax), ay: Math.round(ay) });
      if (tecla === 'e') eu.especial = 0;
      else eu.pronto[tecla] = agora + g.recarga;
      eu.acao = 'golpe';
      eu.t = 0;
      if (g.forma === 'tiro') {
        // a direção como ela foi mandada (arredondada), para a minha bala e a do servidor andarem no mesmo caminho
        const [dx, dy] = unitario(Math.round(eu.mx * 1000) / 1000, Math.round(eu.my * 1000) / 1000);
        balasDoGolpe(dx, dy, g).forEach(([bx, by], k) =>
          this.balas.push({ n, k, x0: x, y0: y, dx: bx, dy: by, golpe: g, elemento: el, inicio: agora, andou: 0, livre: alcanceLivre(this.cenario, x, y, bx, by, g.alcance), acertou: false }),
        );
        this.sons.push('tiro');
      } else if (g.forma === 'roda') {
        this.efeitos.push({ tipo: 'roda', x: eu.x, y: eu.y, em: agora, elemento: el, raio: g.raio });
        this.sons.push('combo');
      } else this.sons.push('pulo');
      return true;
    };
    if (pedidos.e) usar('e');
    if (pedidos.q) usar('q');
    if (pedidos.s) usar('s');
    if (cmd.atacar) usar('b');

    // encostou num suprimento: pega (o servidor confere)
    for (const s of v.suprimentos) {
      if (!perto(eu.x, eu.y, s.x, s.y, PERTO_DO_SUPRIMENTO)) continue;
      if ((this.pediuSuprimento.get(s.id) ?? -Infinity) > agora - 500) continue;
      this.pediuSuprimento.set(s.id, agora);
      this.mandarPosicao(agora);
      this.enviar({ tipo: 'pegar', id: s.id });
    }
    if (agora - this.ultimoEnvio >= ENVIO_MS) this.mandarPosicao(agora);
  }

  private mandarPosicao(agora: number) {
    this.ultimoEnvio = agora;
    this.enviar({
      tipo: 'pos',
      x: Math.round(this.eu.x * 10) / 10,
      y: Math.round(this.eu.y * 10) / 10,
      mx: Math.round(this.eu.mx * 100) / 100,
      my: Math.round(this.eu.my * 100) / 100,
      acao: ACOES.indexOf(this.eu.acao),
      ta: Math.round(this.eu.t),
    });
  }

  /** As minhas balas no ar, onde estão agora (para desenhar). */
  minhasBalas(agora: number): BalaNaTela[] {
    return this.balas.map((b) => {
      const d = Math.min(andouABala(b.golpe, agora - b.inicio), b.livre);
      return { dono: this.id, x: b.x0 + b.dx * d, y: b.y0 + b.dy * d, dx: b.dx, dy: b.dy, elemento: b.elemento, golpe: b.golpe };
    });
  }
}

const MEDALHAS = ['🥇', '🥈', '🥉'];
/** A medalha do fim é a do troféu: fora do Solo, 2 pessoas ou mais, quem venceu. */
export function marcaDoLugar(posicao: number | null, o: { solo: boolean; pessoas: number; maximo: number }): string {
  if (posicao === null) return '–';
  if (!o.solo && o.pessoas >= 2 && posicao <= o.maximo) return MEDALHAS[posicao - 1] ?? `${posicao}.`;
  return `${posicao}.`;
}
