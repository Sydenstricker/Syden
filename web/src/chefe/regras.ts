/**
 * O CHEFE DA TURMA NO SITE (05/11/2026; a regra é a do servidor, server/src/chefe/motor.ts). Aqui mora o CLIENTE: o coelho de
 * quem joga (que anda aqui, sem esperar o servidor), a linha do tempo dos quadros que o servidor manda (a toupeira e os outros
 * desenhados ~100 ms atrás, interpolados), os torrões que eu atiro (voam aqui; o acerto, como a minha tela mostrou, vai ao
 * servidor, que confere pelo passado dela) e o que pegar e quando. A tela (JogoChefe.tsx) e o teste (web/test/chefe.test.ts)
 * usam o MESMO cliente: o teste joga a partida inteira contra o servidor de verdade.
 */
import {
  ACOES,
  BOMBA,
  distancia,
  ESTADOS,
  MARCAS,
  naArena,
  normalizar,
  PASSO_MS,
  tiroPega,
  TORRAO,
  VEL,
  VIDAS,
  vulneravel,
  type AcaoDoCoelho,
  type EstadoDoChefe,
  type TipoDeMarca,
} from './conta';

/** O mesmo do servidor (o teste confere): depois de levar um golpe, piscando. */
export const INVUL_MS = 2200;
/** A tela desenha a toupeira e os outros ATRASO_MS atrás do quadro mais novo. */
export const ATRASO_MS = 100;
export const ENVIO_MS = 66;
const DOR_MS = 320;
const ATIRANDO_MS = 260;

export type FaseDaLuta = 'lutando' | 'vitoria' | 'derrota' | 'fim';

/** O estado que o servidor manda pelo "mudou, busque de novo" (o resto vem no quadro). */
export interface EstadoChefe {
  fase: FaseDaLuta;
  venceu: boolean;
  faseDoChefe: number;
  fases: number;
  danoDaTurma: number;
  jogadores: { userId: number; username: string; avatar: number | string | null; pontos: number; vidas: number }[];
  resultado: { userId: number; username: string; pontos: number; acertos: number; posicao: number | null }[] | null;
  partidaId: string;
}

export interface Quadro {
  tipo: 'q';
  n: number;
  f: FaseDaLuta;
  /** [x, y, estado, lado, vida da fase %, passos no estado, fase 0–2, destino x, destino y] */
  c: number[];
  /** [id, tipo, x, y, r, x2, y2, ms até o impacto, fria, ms do aviso inteiro] */
  m: number[][];
  /** [id, x, y, ms que faltam] */
  t: number[][];
  /** [userId, x, y, lado, ação, ms da ação, vidas, pontos, estado, avatar, segura, bomba, ms piscando, último tiro] */
  j: number[][];
  /** [id, userId, x0, y0, dx×1000, dy×1000, ms desde o tiro] */
  p: number[][];
  /** [id, userId, x0, y0, x, y, ms até explodir] */
  b: number[][];
  d: number;
  e: unknown[][];
}

export const ehQuadro = (d: unknown): d is Quadro => {
  const q = d as Quadro | null;
  return !!q && q.tipo === 'q' && typeof q.n === 'number' && Array.isArray(q.c) && Array.isArray(q.m) && Array.isArray(q.j);
};

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  cima: boolean;
  baixo: boolean;
  /** Apertos desde o último passo (o passo zera depois de ler). */
  atirar: boolean;
  bomba: boolean;
}
export const comandosVazios = (): Comandos => ({ esquerda: false, direita: false, cima: false, baixo: false, atirar: false, bomba: false });

export interface ChefeNaTela {
  x: number;
  y: number;
  estado: EstadoDoChefe;
  lado: number;
  hp: number;
  passos: number;
  fase: number;
  destino: [number, number];
}
export interface MarcaNaTela {
  id: number;
  tipo: TipoDeMarca;
  x: number;
  y: number;
  r: number;
  x2: number;
  y2: number;
  /** Quanto falta para o impacto (ms; negativo depois dele). */
  resta: number;
  total: number;
  frio: boolean;
}
export interface Vista {
  passo: number;
  fase: FaseDaLuta | null;
  chefe: ChefeNaTela | null;
  /** As linhas dos coelhos, interpoladas (as mesmas colunas do quadro). */
  coelhos: number[][];
  marcas: MarcaNaTela[];
  noChao: { id: number; x: number; y: number; resta: number }[];
  /** Os torrões que os OUTROS atiraram, onde estão agora. */
  tirosDosOutros: { id: number; x: number; y: number }[];
  bombas: { id: number; x0: number; y0: number; x: number; y: number; resta: number }[];
  dano: number;
}

export interface Efeito {
  tipo: 'acerto' | 'explosao' | 'poeira' | 'pancada' | 'fase' | 'pegou';
  x: number;
  y: number;
  em: number;
  texto?: string;
}
export type Som = 'acerto' | 'erro' | 'tiro' | 'queda' | 'moeda' | 'combo' | 'vez' | 'pulo';

export interface Meu {
  x: number;
  y: number;
  lado: 1 | -1;
  acao: AcaoDoCoelho;
  t: number;
  relogio: number;
  piscandoAte: number;
  vidas: number;
  /** 0 em pé, 2 sem vidas. */
  estado: number;
  segura: boolean;
  bomba: boolean;
}

interface MeuTiro {
  n: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  inicio: number;
  acertou: boolean;
}

/** A linha do tempo dos quadros (a mesma ideia da Briga: a hora de cada passo sai da chegada mais adiantada). */
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
  /** O passo (fracionário) do servidor AGORA, pela conta deste computador. */
  passoDoServidor(agora: number) {
    return (agora - this.base) / PASSO_MS;
  }
  /** O passo que a tela mostra (ATRASO_MS atrás). */
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

export class Cliente {
  linha = new LinhaDoTempo();
  eu: Meu = { x: 240, y: 238, lado: 1, acao: 'parado', t: 0, relogio: 0, piscandoAte: 0, vidas: VIDAS, estado: 0, segura: false, bomba: true };
  tiros: MeuTiro[] = [];
  efeitos: Efeito[] = [];
  sons: Som[] = [];
  /** Quem piscou por levar um golpe (userId → até quando). */
  piscando = new Map<number, number>();
  private proximoTiro = 1;
  private posicionado = false;
  private vistos = new Set<number>();
  private pegando = new Map<number, number>();
  private atirouEm = -Infinity;
  private bombaEm = -Infinity;
  private ultimoEnvio = -Infinity;
  private impactos = new Set<number>();
  /** Os passos do servidor em que cada marca cai (o quadro manda "ms até", relativo a ele). */
  private impactoDe = new Map<number, number>();

  constructor(
    readonly id: number,
    private readonly enviar: (dados: unknown) => void,
  ) {}

  chegou(q: Quadro, agora: number) {
    if (!this.linha.chegou(q, agora)) return;
    for (const m of q.m) if (!this.impactoDe.has(m[0])) this.impactoDe.set(m[0], q.n + m[7] / PASSO_MS);
    if (this.impactoDe.size > 300) for (const k of [...this.impactoDe.keys()].slice(0, 150)) this.impactoDe.delete(k);
    const meu = q.j.find((l) => l[0] === this.id);
    if (meu) {
      if (!this.posicionado) {
        this.posicionado = true;
        this.eu.x = meu[1];
        this.eu.y = meu[2];
      }
      this.eu.vidas = meu[6];
      this.eu.estado = meu[8];
      // o servidor diz se seguro um torrão; logo depois de atirar, o quadro ainda é o de antes
      if (agora - this.atirouEm > 600) this.eu.segura = meu[10] === 1;
      if (agora - this.bombaEm > 600) this.eu.bomba = meu[11] === 1;
      if (meu[13] >= this.proximoTiro) this.proximoTiro = meu[13] + 1;
      if (meu[8] !== 0) this.eu.acao = 'caido';
    }
    for (const e of q.e) {
      const [id, tipo, ...r] = e as [number, string, ...number[]];
      if (this.vistos.has(id)) continue;
      this.vistos.add(id);
      if (this.vistos.size > 500) this.vistos.delete(this.vistos.values().next().value as number);
      if (tipo === 'p') {
        if (r[0] === this.id) {
          this.eu.vidas = r[1];
          this.eu.acao = 'dor';
          this.eu.t = 0;
          this.eu.piscandoAte = this.eu.relogio + INVUL_MS;
          this.sons.push('erro');
          this.efeitos.push({ tipo: 'pancada', x: this.eu.x, y: this.eu.y, em: agora });
        } else this.piscando.set(r[0], agora + INVUL_MS);
      } else if (tipo === 'k' && r[0] === this.id) {
        this.eu.estado = 2;
        this.eu.acao = 'caido';
        this.eu.segura = false;
      } else if (tipo === 'h') {
        // o meu acerto eu já mostrei na hora; o número do dano vem daqui (o servidor é quem sabe se ela estava tonta)
        this.efeitos.push({ tipo: 'acerto', x: r[2], y: r[3], em: agora + ATRASO_MS, texto: `${r[1]}` });
        if (r[0] !== this.id) this.sons.push('acerto');
      } else if (tipo === 'x') {
        this.efeitos.push({ tipo: 'explosao', x: r[0], y: r[1], em: agora });
        this.sons.push('combo');
      } else if (tipo === 'f') {
        this.efeitos.push({ tipo: 'fase', x: 240, y: 135, em: agora });
        this.sons.push('vez');
      } else if (tipo === 'c' && r[1] === this.id) {
        this.eu.segura = true;
        this.sons.push('moeda');
        this.efeitos.push({ tipo: 'pegou', x: this.eu.x, y: this.eu.y, em: agora });
      } else if (tipo === 't') {
        this.efeitos.push({ tipo: 'poeira', x: r[0], y: r[1], em: agora + ATRASO_MS });
        this.sons.push('queda');
      }
    }
  }

  /** O que a tela mostra agora. */
  vista(agora: number): Vista {
    const ultimo = this.linha.ultimo();
    const vazia: Vista = { passo: 0, fase: null, chefe: null, coelhos: [], marcas: [], noChao: [], tirosDosOutros: [], bombas: [], dano: 0 };
    if (!ultimo) return vazia;
    const p = this.linha.passoNaTela(agora);
    const agoraNoServidor = this.linha.passoDoServidor(agora);
    const volta = this.linha.emVolta(p)!;
    const ca = volta.a.c, cb = volta.b.c;
    const k = volta.k;
    // a toupeira anda junto; o estado é o do quadro mais novo dos dois (o salto do embaixo para o saindo não interpola)
    const chefe: ChefeNaTela = {
      x: ca[0] + (cb[0] - ca[0]) * k,
      y: ca[1] + (cb[1] - ca[1]) * k,
      estado: ESTADOS[cb[2]] ?? 'parada',
      lado: cb[3],
      hp: cb[4],
      passos: cb[5] + (p - volta.b.n),
      fase: cb[6],
      destino: [cb[7], cb[8]],
    };
    const resta = (passo: number) => (passo - agoraNoServidor) * PASSO_MS;
    return {
      passo: p,
      fase: ultimo.f,
      chefe,
      coelhos: misturar(volta.a.j, volta.b.j, k, [1, 2]),
      marcas: ultimo.m.map((m) => ({
        id: m[0],
        tipo: MARCAS[m[1]] ?? 'pedra',
        x: m[2],
        y: m[3],
        r: m[4],
        x2: m[5],
        y2: m[6],
        resta: resta(this.impactoDe.get(m[0]) ?? ultimo.n + m[7] / PASSO_MS),
        total: m[9],
        frio: m[8] === 1,
      })),
      noChao: ultimo.t.map((c) => ({ id: c[0], x: c[1], y: c[2], resta: c[3] - (agoraNoServidor - ultimo.n) * PASSO_MS })),
      tirosDosOutros: ultimo.p
        .filter((s) => s[1] !== this.id)
        .map((s) => {
          const ms = s[6] + (p - ultimo.n) * PASSO_MS;
          const d = Math.min(TORRAO.alcance, (TORRAO.vel * Math.max(0, ms)) / 1000);
          return { id: s[0], x: s[2] + (s[4] / 1000) * d, y: s[3] + (s[5] / 1000) * d, fora: d >= TORRAO.alcance };
        })
        .filter((s) => !s.fora),
      bombas: ultimo.b.map((b) => ({ id: b[0], x0: b[2], y0: b[3], x: b[4], y: b[5], resta: b[6] - (agoraNoServidor - ultimo.n) * PASSO_MS })),
      dano: ultimo.d,
    };
  }

  /** Pode jogar agora (a luta segue e eu estou em pé)? */
  jogando(): boolean {
    return this.linha.ultimo()?.f === 'lutando' && this.eu.estado === 0;
  }

  /**
   * UM PASSO DO MEU COELHO (dt em segundos; a tela chama a 60 por segundo). Anda, pega o torrão frio em que pisa, atira,
   * solta a bomba, e confere os meus torrões no ar contra a toupeira COMO A VISTA A MOSTRA.
   */
  passo(cmd: Comandos, dt: number, agora: number, v: Vista) {
    const eu = this.eu;
    const ms = dt * 1000;
    eu.relogio += ms;
    eu.t += ms;
    const atirar = cmd.atirar;
    const soltarBomba = cmd.bomba;
    cmd.atirar = cmd.bomba = false;
    // os torrões no ar (os meus): acertou a toupeira como ela está na minha tela?
    const c = v.chefe;
    for (const s of this.tiros) {
      if (s.acertou) continue;
      const el = agora - s.inicio;
      if (c && vulneravel(c.estado) && tiroPega(s.x0, s.y0, s.dx, s.dy, el, c.x, c.y, 0)) {
        s.acertou = true;
        this.enviar({ tipo: 'acerto', n: s.n });
        this.sons.push('acerto');
      }
    }
    this.tiros = this.tiros.filter((s) => !s.acertou && agora - s.inicio < (TORRAO.alcance / TORRAO.vel) * 1000 + 100);
    for (const m of v.marcas) {
      if (m.resta <= 0 && !this.impactos.has(m.id)) {
        this.impactos.add(m.id);
        if (this.impactos.size > 300) this.impactos.delete(this.impactos.values().next().value as number);
        if (m.tipo !== 'investida') this.sons.push('queda');
        if (m.tipo === 'pedra' || m.tipo === 'torrao') this.efeitos.push({ tipo: 'poeira', x: m.tipo === 'torrao' ? m.x2 : m.x, y: m.tipo === 'torrao' ? m.y2 : m.y, em: agora });
      }
    }
    if (!this.jogando()) return;

    // andar
    if (eu.acao === 'dor' && eu.t >= DOR_MS) eu.acao = 'parado';
    if (eu.acao === 'atirando' && eu.t >= ATIRANDO_MS) eu.acao = 'parado';
    const [mx, my] = normalizar((cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0), (cmd.baixo ? 1 : 0) - (cmd.cima ? 1 : 0));
    [eu.x, eu.y] = naArena(eu.x + mx * VEL * dt, eu.y + my * VEL * dt);
    if (mx > 0.1) eu.lado = 1;
    else if (mx < -0.1) eu.lado = -1;
    if (eu.acao === 'parado' || eu.acao === 'andando') {
      const anda = mx !== 0 || my !== 0;
      if (anda && eu.acao !== 'andando') ((eu.acao = 'andando'), (eu.t = 0));
      else if (!anda && eu.acao !== 'parado') ((eu.acao = 'parado'), (eu.t = 0));
    }

    // pisou num torrão frio: pega (o servidor decide quem pegou primeiro)
    if (!eu.segura) {
      for (const t of v.noChao) {
        if (distancia(eu.x, eu.y, t.x, t.y) > TORRAO.pegar) continue;
        if ((this.pegando.get(t.id) ?? -Infinity) > agora - 400) continue;
        this.pegando.set(t.id, agora);
        if (this.pegando.size > 50) this.pegando.delete(this.pegando.keys().next().value as number);
        this.mandarPosicao(agora);
        this.enviar({ tipo: 'pegar', torrao: t.id });
      }
    }

    // atirar: a mira é a toupeira (se ela está fora da terra); senão, para a frente
    if (atirar && eu.segura) {
      const [dx, dy] = c && vulneravel(c.estado) ? normalizar(c.x - eu.x, c.y - eu.y) : [eu.lado, 0];
      const n = this.proximoTiro++;
      this.enviar({ tipo: 'atirar', n, x: Math.round(eu.x * 10) / 10, y: Math.round(eu.y * 10) / 10, dx, dy });
      this.tiros.push({ n, x0: eu.x, y0: eu.y, dx, dy, inicio: agora, acertou: false });
      eu.segura = false;
      this.atirouEm = agora;
      eu.acao = 'atirando';
      eu.t = 0;
      if (dx) eu.lado = dx > 0 ? 1 : -1;
      this.sons.push('tiro');
    }
    if (soltarBomba && eu.bomba) {
      const [ax, ay] = c && vulneravel(c.estado) ? [c.x, c.y] : [eu.x + eu.lado * BOMBA.alcance, eu.y];
      this.enviar({ tipo: 'bomba', x: Math.round(ax), y: Math.round(ay) });
      eu.bomba = false;
      this.bombaEm = agora;
      eu.acao = 'atirando';
      eu.t = 0;
      this.sons.push('pulo');
    }
    if (agora - this.ultimoEnvio >= ENVIO_MS) this.mandarPosicao(agora);
  }

  private mandarPosicao(agora: number) {
    this.ultimoEnvio = agora;
    this.enviar({
      tipo: 'pos',
      x: Math.round(this.eu.x * 10) / 10,
      y: Math.round(this.eu.y * 10) / 10,
      lado: this.eu.lado,
      acao: ACOES.indexOf(this.eu.acao),
      ta: Math.round(this.eu.t),
    });
  }

  /** Os meus torrões no ar, onde estão agora (para desenhar). */
  meusTiros(agora: number) {
    return this.tiros.map((s) => {
      const d = Math.min(TORRAO.alcance, (TORRAO.vel * (agora - s.inicio)) / 1000);
      return { x: s.x0 + s.dx * d, y: s.y0 + s.dy * d };
    });
  }
}

const MEDALHAS = ['🥇', '🥈', '🥉'];
/** A medalha do fim é a do troféu: a toupeira vencida, fora do Solo, 2 ou mais que ficaram, até o 3º, com dano. */
export function marcaDoLugar(posicao: number | null, pontos: number, o: { venceu: boolean; solo: boolean; ficaram: number }): string {
  if (posicao === null) return '–';
  if (o.venceu && !o.solo && o.ficaram >= 2 && posicao <= 3 && pontos > 0) return MEDALHAS[posicao - 1];
  return `${posicao}.`;
}
