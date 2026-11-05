/**
 * A ESQUADRILHA DA TOCA (05/11/2026): a regra da navinha. Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/nave-sim.ts e web/src/nave/sim.ts (os dois testes da nave conferem). O roteiro das ondas, o trajeto de cada
 * inimigo, os tiros deles, as balas da nave e a FICHA de cada piloto (vidas, bomba, arma, escudo, pontos) saem daqui; o site
 * joga com esta conta, e o servidor confere com a mesma.
 *
 * Só a mecânica do gênero dos jogos de nave de rolagem vertical (ondas, power-ups, bomba que limpa a tela, um chefe no fim);
 * nada de nome, nave, inimigo, arte ou som de ninguém. Os pilotos são os nossos coelhos em aviõezinhos de cenoura, e os
 * inimigos são a praga da horta: corvos, vespas, besouros e o espantalho mecânico.
 *
 * DETERMINISMO: passos fixos de 1/60 s, e as contas que os dois lados fazem usam só + − × ÷, Math.floor, Math.abs e
 * Math.sqrt (que dão o mesmo número em qualquer navegador). O vaivém das curvas é uma parábola, não o seno. O sorteio é o
 * mulberry32 (inteiros de 32 bits).
 */

/** A tela, em unidades do jogo (o site a amplia em pixels inteiros). */
export const LARGURA = 180;
export const ALTURA = 240;
export const PASSOS_POR_S = 60;

export const ONDAS = 5;
/** Cada onda dura isto, em passos (25 s), e a primeira começa em INICIO_ONDAS. */
export const ONDA_PASSOS = 1500;
export const INICIO_ONDAS = 120;
/** O chefe entra aqui, e a partida acaba em FIM (quem não o derrubou até lá, não derrubou). */
export const CHEFE_T = INICIO_ONDAS + ONDAS * ONDA_PASSOS + 60;
export const FIM = CHEFE_T + 2700;

/** A nave: a velocidade (unidades por passo, já contando a diagonal), o raio que leva dano, e onde nasce. */
export const VEL_NAVE = 2;
export const RAIO_NAVE = 3;
export const NASCER = { x: LARGURA / 2, y: ALTURA - 30 };
export const VIDAS = 3;
/** A piscada depois de perder uma vida, e depois de o escudo segurar um golpe. */
export const INVUL_MORTE = 150;
export const INVUL_ESCUDO = 60;
export const INVUL_BOMBA = 60;

/** Um disparo a cada CADENCIA passos (8,6 por segundo), e só nos passos múltiplos dela. */
export const CADENCIA = 7;
/** A bala some depois disto (já saiu da tela). */
export const VIDA_BALA = 64;
export const RAIO_BALA = 2;
/** O raio dos tiros dos inimigos. */
export const RAIO_TIRO = 2.5;
export const RAIO_ITEM = 9;
/** A bomba tira isto do chefe (os outros, ela derruba). */
export const BOMBA_CHEFE = 40;

export type Arma = 0 | 1 | 2;
/** As armas: 0 é o tiro simples, 1 o duplo, 2 o espalhado. */
export const ARMAS = ['simples', 'duplo', 'espalhado'] as const;
/** As balas de cada disparo: o deslocamento de onde sai, e a velocidade (unidades por passo). */
export const VOLEIAS: readonly (readonly { ox: number; vx: number; vy: number }[])[] = [
  [{ ox: 0, vx: 0, vy: -5 }],
  [
    { ox: -4, vx: 0, vy: -5 },
    { ox: 4, vx: 0, vy: -5 },
  ],
  [
    { ox: 0, vx: 0, vy: -5 },
    { ox: -2, vx: -1.3, vy: -4.8 },
    { ox: 2, vx: 1.3, vy: -4.8 },
  ],
];

export type Item = 'duplo' | 'espalhado' | 'escudo';
export type TipoDeInimigo = 'corvo' | 'vespa' | 'besouro' | 'chefe';
export type Padrao = 'reto' | 'leque3' | 'leque5' | 'roda8' | 'roda12' | 'chuva';

export const RAIO: Record<TipoDeInimigo, number> = { corvo: 7, vespa: 6, besouro: 10, chefe: 20 };
export const PONTOS: Record<TipoDeInimigo, number> = { corvo: 100, vespa: 150, besouro: 400, chefe: 5000 };
/** Cada bala no chefe vale isto, além do abate. */
export const PONTOS_NO_CHEFE = 10;
/** Por onda atravessada com vida, e por vida que sobra no fim. */
export const SOBREVIVER = 500;
export const POR_VIDA = 1000;

/** Um inimigo do roteiro: quando aparece, por quanto tempo (passos), o trajeto, a vida, o item que solta e os tiros. */
export interface Inimigo {
  tipo: TipoDeInimigo;
  t: number;
  dur: number;
  /** Os números do trajeto (o que cada um quer dizer depende do tipo: ver `posicaoInimigo`). */
  rota: number[];
  vida: number;
  item: Item | null;
  /** [passo desde que apareceu, padrão] de cada tiro. */
  tiros: [number, Padrao][];
  /** A velocidade dos tiros dele. */
  vt: number;
}

/** O sorteio: mulberry32, só com inteiros de 32 bits. */
export function sorteio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** O vaivém, sem seno: uma parábola de cada lado, que vai de −1 a 1 e volta em cada ciclo (f em ciclos). */
export function vaivem(f: number): number {
  const g = f - Math.floor(f);
  const x = 2 * g - 1;
  return -4 * x * (1 - Math.abs(x));
}

/** Onde o inimigo está no passo `n`, ou null se ainda não apareceu ou já foi embora. */
export function posicaoInimigo(e: Inimigo, n: number): { x: number; y: number } | null {
  const s = n - e.t;
  if (s < 0 || s > e.dur) return null;
  const r = e.rota;
  if (e.tipo === 'corvo') {
    // a curva de três pontos (entra por um lado, mergulha, sai pelo outro)
    const u = s / e.dur;
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const c = u * u;
    return { x: a * r[0] + b * r[2] + c * r[4], y: a * r[1] + b * r[3] + c * r[5] };
  }
  if (e.tipo === 'vespa') {
    // desce em zigue-zague: [x0, y0, vy, amplitude, período]
    return { x: r[0] + r[3] * vaivem(s / r[4]), y: r[1] + r[2] * s };
  }
  if (e.tipo === 'besouro') {
    // [x0, yAlvo, entrada, pausa, vx]: desce freando, para atirando, e vai embora acelerando
    const [x0, alvo, entrada, pausa, vx] = r;
    if (s < entrada) {
      const u = s / entrada;
      return { x: x0, y: -16 + (alvo + 16) * (1 - (1 - u) * (1 - u)) };
    }
    if (s < entrada + pausa) return { x: x0 + 6 * vaivem((s - entrada) / 160), y: alvo };
    const k = s - entrada - pausa;
    return { x: x0 + vx * k, y: alvo + 0.012 * k * k };
  }
  // o chefe: entra devagar e passeia de um lado para o outro
  if (s < 180) {
    const u = s / 180;
    return { x: LARGURA / 2, y: -40 + 96 * (1 - (1 - u) * (1 - u)) };
  }
  const k = s - 180;
  return { x: LARGURA / 2 + 55 * vaivem(k / 600), y: 56 + 8 * vaivem(k / 300) };
}

/** As direções de cada padrão de tiro (comprimento 1), sem seno: os vetores saem de raízes. */
const R2 = Math.sqrt(0.5);
const R3 = Math.sqrt(3) / 2;
function normal(x: number, y: number): [number, number] {
  const d = Math.sqrt(x * x + y * y);
  return [x / d, y / d];
}
export const DIRECOES: Record<Padrao, [number, number][]> = {
  reto: [[0, 1]],
  leque3: [normal(-0.35, 1), [0, 1], normal(0.35, 1)],
  leque5: [normal(-0.7, 1), normal(-0.35, 1), [0, 1], normal(0.35, 1), normal(0.7, 1)],
  roda8: [
    [1, 0],
    [R2, R2],
    [0, 1],
    [-R2, R2],
    [-1, 0],
    [-R2, -R2],
    [0, -1],
    [R2, -R2],
  ],
  roda12: [
    [1, 0],
    [R3, 0.5],
    [0.5, R3],
    [0, 1],
    [-0.5, R3],
    [-R3, 0.5],
    [-1, 0],
    [-R3, -0.5],
    [-0.5, -R3],
    [0, -1],
    [0.5, -R3],
    [R3, -0.5],
  ],
  chuva: [[0, 1], [0, 1], [0, 1], [0, 1], [0, 1]],
};
/** Na chuva, os tiros saem lado a lado. */
const CHUVA_OX = [-24, -12, 0, 12, 24];

/** Um tiro de inimigo: quando sai, de onde, a velocidade, e de quem é (morto antes disso, não atira). */
export interface TiroInimigo {
  t: number;
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  dono: number;
}

/** Todos os tiros dos inimigos da partida, em ordem de saída. */
export function tirosDosInimigos(inimigos: Inimigo[]): TiroInimigo[] {
  const tiros: TiroInimigo[] = [];
  inimigos.forEach((e, dono) => {
    for (const [s, padrao] of e.tiros) {
      const p = posicaoInimigo(e, e.t + s);
      if (!p) continue;
      DIRECOES[padrao].forEach(([dx, dy], k) => {
        const ox = padrao === 'chuva' ? CHUVA_OX[k] : 0;
        tiros.push({ t: e.t + s, x0: p.x + ox, y0: p.y + 4, vx: dx * e.vt, vy: dy * e.vt, dono });
      });
    }
  });
  return tiros.sort((a, b) => a.t - b.t);
}

/** Onde o tiro do inimigo está no passo `n`, ou null fora da tela (ou antes de sair). */
export function posicaoTiro(b: TiroInimigo, n: number): { x: number; y: number } | null {
  const k = n - b.t;
  if (k < 0) return null;
  const x = b.x0 + b.vx * k;
  const y = b.y0 + b.vy * k;
  if (x < -8 || x > LARGURA + 8 || y < -8 || y > ALTURA + 8) return null;
  return { x, y };
}

/** Onde a bala `b` de um disparo no passo `p`, da nave em (x, y), com a arma `arma`, está no passo `n`. */
export function posicaoBala(p: number, x: number, y: number, arma: Arma, b: number, n: number): { x: number; y: number } | null {
  const v = VOLEIAS[arma]?.[b];
  const k = n - p;
  if (!v || k < 0 || k > VIDA_BALA) return null;
  const bx = x + v.ox + v.vx * k;
  const by = y - 6 + v.vy * k;
  if (bx < -6 || bx > LARGURA + 6 || by < -10) return null;
  return { x: bx, y: by };
}

/** Onde o item de quem caiu no passo `q` está no passo `n` (ele desce devagar), ou null se já saiu por baixo. */
export function posicaoItem(e: Inimigo, q: number, n: number): { x: number; y: number } | null {
  const p = posicaoInimigo(e, q);
  if (!p || n < q) return null;
  const y = p.y + 0.7 * (n - q);
  if (y > ALTURA + 10) return null;
  return { x: Math.max(8, Math.min(LARGURA - 8, p.x)), y };
}

/** O passo em que a onda `k` (de 1 a ONDAS) termina. */
export const fimDaOnda = (k: number) => INICIO_ONDAS + k * ONDA_PASSOS;

/**
 * O ROTEIRO DA PARTIDA, pela semente: cinco ondas, cada uma mais cheia e com mais tiros, e o chefe. Em cada onda, grupos
 * seguidos: uma fila de corvos que mergulha de um lado ao outro, vespas descendo em zigue-zague, ou besouros que param e
 * atiram em leque. Dois inimigos por onda soltam um item (o primeiro da partida é sempre o tiro duplo).
 */
export function roteiro(semente: number): Inimigo[] {
  const r = sorteio(semente);
  const inimigos: Inimigo[] = [];
  let primeiroItem = true;
  for (let n = 1; n <= ONDAS; n++) {
    const base = INICIO_ONDAS + (n - 1) * ONDA_PASSOS;
    const vt = 1 + 0.12 * n;
    const candidatos: number[] = [];
    let t = base + 30;
    while (t < base + ONDA_PASSOS - 220) {
      const g = r();
      if (g < 0.45) {
        const quantos = 4 + Math.floor(r() * 2) + (n >= 3 ? 1 : 0);
        const daEsquerda = r() < 0.5;
        const y0 = 16 + r() * 40;
        const x1 = LARGURA / 2 + (r() - 0.5) * 60;
        const y1 = 130 + r() * 70;
        const y2 = 20 + r() * 60;
        const dur = 230 - n * 12;
        const atira = r() < 0.2 + 0.12 * n;
        const quando = Math.round(dur * (0.3 + r() * 0.2));
        for (let k = 0; k < quantos; k++) {
          inimigos.push({
            tipo: 'corvo',
            t: t + k * 11,
            dur,
            rota: daEsquerda ? [-12, y0, x1, y1, LARGURA + 12, y2] : [LARGURA + 12, y0, x1, y1, -12, y2],
            vida: 1,
            item: null,
            tiros: atira && k % 2 === 0 ? [[quando, 'reto']] : [],
            vt,
          });
        }
        candidatos.push(inimigos.length - 1);
        t += 150 + Math.round(r() * 80) - n * 8 + quantos * 6;
      } else if (g < 0.75) {
        const quantas = 3 + (n >= 4 ? 1 : 0);
        const vy = 0.8 + 0.1 * n;
        for (let k = 0; k < quantas; k++) {
          const x0 = 24 + ((k + 0.5) * (LARGURA - 48)) / quantas + (r() - 0.5) * 16;
          const y0 = -10 - k * 22;
          const tiros: [number, Padrao][] = [];
          for (let s = 50 + Math.round(r() * 30); s < 220; s += 90 - n * 6) if (r() < 0.35 + 0.1 * n) tiros.push([s, 'reto']);
          inimigos.push({
            tipo: 'vespa',
            t,
            dur: Math.ceil((ALTURA + 20 - y0) / vy),
            rota: [x0, y0, vy, 16 + r() * 18, 90 + Math.round(r() * 50)],
            vida: 2,
            item: null,
            tiros,
            vt,
          });
        }
        t += 170 + Math.round(r() * 60) - n * 8;
      } else {
        const dois = n >= 3 && r() < 0.6;
        const xs = dois ? [48 + r() * 12, LARGURA - 48 - r() * 12] : [40 + r() * (LARGURA - 80)];
        const pausa = 180 + 20 * n;
        for (const x0 of xs) {
          const tiros: [number, Padrao][] = [];
          let k = 0;
          for (let s = 60 + 30; s < 60 + pausa; s += 70 - n * 4, k++) {
            const padrao: Padrao = n >= 5 && k % 2 === 1 ? 'roda8' : n >= 3 ? 'leque5' : 'leque3';
            tiros.push([s, padrao]);
          }
          inimigos.push({
            tipo: 'besouro',
            t,
            dur: 60 + pausa + 160,
            rota: [x0, 40 + r() * 30, 60, pausa, r() < 0.5 ? -0.8 : 0.8],
            vida: 7 + n,
            item: null,
            tiros,
            vt,
          });
          candidatos.push(inimigos.length - 1);
        }
        t += 230 + Math.round(r() * 40);
      }
    }
    // os itens da onda: dois dos candidatos (o último corvo de cada fila e os besouros)
    for (let k = 0; k < 2 && candidatos.length > 0; k++) {
      const i = candidatos.splice(Math.floor(r() * candidatos.length), 1)[0];
      const sorte = r();
      inimigos[i].item = primeiroItem ? 'duplo' : sorte < 0.36 ? 'duplo' : sorte < 0.7 ? 'espalhado' : 'escudo';
      primeiroItem = false;
    }
  }
  // o espantalho mecânico: alterna a roda, o leque e a chuva, cada vez mais depressa
  const tiros: [number, Padrao][] = [];
  const ciclo: Padrao[] = ['roda12', 'leque5', 'chuva', 'leque5'];
  let k = 0;
  for (let s = 200; s < FIM - CHEFE_T - 30; s += Math.max(50, 80 - Math.floor(s / 400) * 4), k++) tiros.push([s, ciclo[k % ciclo.length]]);
  inimigos.push({ tipo: 'chefe', t: CHEFE_T, dur: FIM - CHEFE_T, rota: [], vida: 320, item: null, tiros, vt: 1.3 });
  return inimigos;
}

const perto = (a: { x: number; y: number }, x: number, y: number, raio: number) => (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= raio * raio;
const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * A FICHA DE UM PILOTO: o que ele derrubou, a arma, as vidas, a bomba, o escudo e os pontos. O site a usa para jogar (o
 * placar da tela é a mesma conta) e o servidor para conferir: cada evento é recusado se não bate com o roteiro.
 *
 * O que ela confere, sem saber onde a nave estava de verdade: o disparo só nos passos da cadência e com a arma que a pessoa
 * tinha, a bala no lugar do inimigo no passo do acerto, cada bala uma vez, a nave sem andar mais rápido do que anda entre um
 * lugar dito e outro (fora a volta ao começo quando perde uma vida), o item no lugar de onde caiu. Quem leva dano é quem diz
 * (como o repolho do kart): o servidor não sabe onde estavam os tiros na tela de cada um.
 */
export class Ficha {
  vidas = VIDAS;
  bombas = 1;
  escudo = false;
  invulAte = -1;
  /** [passo, arma] a cada troca, em ordem. */
  armas: [number, Arma][] = [[0, 0]];
  /** Quem caiu, e em que passo. */
  mortos = new Map<number, number>();
  /** O dano em quem ainda não caiu. */
  dano = new Map<number, number>();
  /** Os itens já pegos (pelo índice de quem os soltou). */
  pegos = new Set<number>();
  usados = new Set<string>();
  /** Os lugares ditos da nave, em ordem de passo. */
  posicoes: { p: number; x: number; y: number }[] = [];
  /** Os passos em que perdeu uma vida (a nave volta ao começo). */
  mortes: number[] = [];
  pontos = 0;
  morteFinal: number | null = null;
  chefeEm: number | null = null;
  ultimoQ = 0;
  /** Os que caíram desde a última vez que alguém leu (o servidor repassa à turma). */
  novos: number[] = [];

  constructor(readonly inimigos: Inimigo[]) {}

  get acabou() {
    return this.morteFinal !== null || this.chefeEm !== null;
  }
  vivoEm(n: number) {
    return this.morteFinal === null || n < this.morteFinal;
  }
  armaEm(n: number): Arma {
    let a: Arma = 0;
    for (const [p, arma] of this.armas) if (p <= n) a = arma;
    return a;
  }

  /** O lugar dito bate com os outros (a nave não anda mais que VEL_NAVE por passo)? E o guarda, se bater. */
  lugar(p: number, x: number, y: number): boolean {
    if (!numero(x) || !numero(y) || x < -2 || x > LARGURA + 2 || y < -2 || y > ALTURA + 2) return false;
    const ps = this.posicoes;
    let lo = 0;
    let hi = ps.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (ps[m].p < p) lo = m + 1;
      else hi = m;
    }
    if (lo < ps.length && ps[lo].p === p) return Math.abs(ps[lo].x - x) <= 0.02 && Math.abs(ps[lo].y - y) <= 0.02;
    const cabe = (dx: number, dy: number, passos: number) => {
      const max = VEL_NAVE * passos + 2;
      return dx * dx + dy * dy <= max * max;
    };
    // de onde ela veio: o último lugar dito, ou o começo, se perdeu uma vida depois dele (a nave fica no lugar do golpe no
    // passo dele, e já está no começo no seguinte)
    const antes = lo > 0 ? ps[lo - 1] : null;
    let morte: number | null = null;
    for (const m of this.mortes) if (m < p) morte = m;
    if (morte !== null && (!antes || morte >= antes.p)) {
      if (!cabe(x - NASCER.x, y - NASCER.y, p - morte)) return false;
    } else if (antes && !cabe(x - antes.x, y - antes.y, p - antes.p)) return false;
    // para onde ela foi (se uma vida se perdeu no meio, a volta ao começo explica o salto)
    const depois = lo < ps.length ? ps[lo] : null;
    if (depois && !this.mortes.some((m) => m >= p && m < depois.p) && !cabe(depois.x - x, depois.y - y, depois.p - p)) return false;
    ps.splice(lo, 0, { p, x, y });
    return true;
  }

  private tempo(q: unknown): string | null {
    if (!inteiro(q) || q < 0 || q > FIM) return 'Evento inválido.';
    if (q < this.ultimoQ) return 'Evento fora de ordem.';
    return null;
  }

  private derrubar(i: number, q: number) {
    const e = this.inimigos[i];
    this.mortos.set(i, q);
    this.dano.delete(i);
    this.pontos += PONTOS[e.tipo];
    this.novos.push(i);
    if (e.tipo === 'chefe') this.chefeEm = q;
  }

  /** A bala `b` do disparo em `p`, da nave em (x, y), acertou o inimigo `i` no passo `q`. */
  acerto(q: number, i: number, p: number, x: number, y: number, arma: number, b: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (this.chefeEm !== null) return 'Evento inválido.';
    if (!inteiro(i) || !inteiro(p) || !inteiro(b) || !inteiro(arma) || i < 0 || i >= this.inimigos.length) return 'Evento inválido.';
    if (p < 0 || p % CADENCIA !== 0 || q - p < 0 || q - p > VIDA_BALA || !this.vivoEm(p)) return 'Disparo inválido.';
    if (arma !== this.armaEm(p) || b < 0 || b >= VOLEIAS[arma].length) return 'Disparo inválido.';
    if (this.mortos.has(i)) return 'Este já caiu.';
    const chave = `${p}:${b}`;
    if (this.usados.has(chave)) return 'Disparo inválido.';
    const e = this.inimigos[i];
    const alvo = posicaoInimigo(e, q);
    const bala = posicaoBala(p, x, y, arma as Arma, b, q);
    if (!alvo || !bala || !perto(alvo, bala.x, bala.y, RAIO[e.tipo] + RAIO_BALA + 0.5)) return 'Acerto inválido.';
    if (!this.lugar(p, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.usados.add(chave);
    const dano = (this.dano.get(i) ?? 0) + 1;
    if (dano >= e.vida) this.derrubar(i, q);
    else {
      this.dano.set(i, dano);
      if (e.tipo === 'chefe') this.pontos += PONTOS_NO_CHEFE;
    }
    return null;
  }

  /** A nave em (x, y) pegou, no passo `q`, o item que o inimigo `i` soltou. */
  pegar(q: number, i: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || !inteiro(i) || i < 0 || i >= this.inimigos.length) return 'Evento inválido.';
    const e = this.inimigos[i];
    const caiu = this.mortos.get(i);
    if (!e.item || caiu === undefined || q < caiu || this.pegos.has(i)) return 'Item inválido.';
    const item = posicaoItem(e, caiu, q);
    if (!item || !perto(item, x, y, RAIO_ITEM + RAIO_NAVE + 0.5)) return 'Item inválido.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.pegos.add(i);
    if (e.item === 'escudo') this.escudo = true;
    else this.armas.push([q, e.item === 'duplo' ? 1 : 2]);
    return null;
  }

  /** A nave em (x, y) foi atingida no passo `q` (quem leva é quem diz). Piscando, não conta. */
  atingida(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null) return 'Evento inválido.';
    if (q < this.invulAte) return null;
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    if (this.escudo) {
      this.escudo = false;
      this.invulAte = q + INVUL_ESCUDO;
      return null;
    }
    this.vidas--;
    this.mortes.push(q);
    this.armas.push([q, 0]);
    this.bombas = 1;
    this.invulAte = q + INVUL_MORTE;
    if (this.vidas <= 0) this.morteFinal = q;
    return null;
  }

  /** A bomba, no passo `q`: derruba todos os que estão na tela, e tira BOMBA_CHEFE do chefe. */
  bomba(q: number, x: number, y: number): string | null {
    const erro = this.tempo(q);
    if (erro) return erro;
    if (!this.vivoEm(q) || this.chefeEm !== null || this.bombas <= 0) return 'Sem bomba.';
    if (!this.lugar(q, x, y)) return 'Lugar inválido.';
    this.ultimoQ = q;
    this.bombas--;
    this.invulAte = Math.max(this.invulAte, q + INVUL_BOMBA);
    this.inimigos.forEach((e, i) => {
      if (this.mortos.has(i)) return;
      const p = posicaoInimigo(e, q);
      if (!p || p.y < -4 || p.y > ALTURA + 4 || p.x < -4 || p.x > LARGURA + 4) return;
      if (e.tipo !== 'chefe') return this.derrubar(i, q);
      const dano = (this.dano.get(i) ?? 0) + BOMBA_CHEFE;
      if (dano >= e.vida) this.derrubar(i, q);
      else {
        this.dano.set(i, dano);
        this.pontos += PONTOS_NO_CHEFE * 4;
      }
    });
    return null;
  }

  /** Um lugar da nave, mandado de tempos em tempos (só confere e guarda). */
  posicao(q: number, x: number, y: number): string | null {
    if (!inteiro(q) || q < 0 || q > FIM) return 'Evento inválido.';
    if (!this.vivoEm(q)) return null;
    return this.lugar(q, x, y) ? null : 'Lugar inválido.';
  }

  /** Um evento do jeito que vai pela rede: ['a', q, i, p, x, y, arma, b], ['g', q, i, x, y], ['d', q, x, y], ['b', q, x, y]. */
  aplicar(ev: unknown): string | null {
    if (!Array.isArray(ev)) return 'Evento inválido.';
    const [tipo, q] = ev;
    if (tipo === 'a') return this.acerto(q, ev[2], ev[3], ev[4], ev[5], ev[6], ev[7]);
    if (tipo === 'g') return this.pegar(q, ev[2], ev[3], ev[4]);
    if (tipo === 'd') return this.atingida(q, ev[2], ev[3]);
    if (tipo === 'b') return this.bomba(q, ev[2], ev[3]);
    return 'Evento inválido.';
  }

  /** As ondas atravessadas com vida até o passo `n`. */
  ondasVivas(n: number): number {
    const ate = this.morteFinal === null ? n : Math.min(n, this.morteFinal - 1);
    let k = 0;
    for (let o = 1; o <= ONDAS; o++) if (fimDaOnda(o) <= ate) k++;
    return k;
  }

  /** Os pontos no passo `n`: os abates, as ondas com vida e, no fim, as vidas que sobraram. */
  total(n: number, fim = false): number {
    return this.pontos + SOBREVIVER * this.ondasVivas(n) + (fim && this.morteFinal === null ? POR_VIDA * this.vidas : 0);
  }
}
