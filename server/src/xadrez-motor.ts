/**
 * O MOTOR DO ROBÔ DE XADREZ (20/11/2026, pedido dele: "adicione dificuldade no xadrez"). Escrito para o Syden, sem nada de motor
 * de terceiro (o Stockfish é GPL, e o Syden é de código fechado). Medido no mesmo dia: o chess.js gera e desfaz uns 3 mil lances
 * por segundo, e uma busca de verdade pede centenas de milhares; por isso o motor tem o PRÓPRIO gerador de lances (o tabuleiro
 * 0x88), e o chess.js continua sendo quem confere o lance na mesa.
 *
 * O que ele faz: busca alfa-beta (negamax com janela nula) com APROFUNDAMENTO ITERATIVO e LIMITE DE TEMPO; tabela de posições
 * (Zobrist); ordenação dos lances (o da tabela, capturas pelo MVV-LVA, promoções, xeques, os lances "assassinos" e o
 * histórico); lance nulo e redução dos lances tardios; extensão no xeque; busca de QUIESCÊNCIA nas capturas; e a avaliação com o
 * material e as TABELAS DE CASA de cada peça (o rei com uma de meio-jogo e uma de final, misturadas pela fase).
 *
 * Os NÍVEIS (`NIVEIS_DO_MOTOR`) mudam a profundidade, o tempo e o ERRO PROPOSITAL: nos baixos, a raiz avalia todos os lances e
 * sorteia entre os parecidos (o ruído, em centésimos de peão), e às vezes escolhe de propósito um lance pior (o erro).
 *
 * Este arquivo não importa nada: roda dentro do worker (xadrez-robo-worker.ts) e, de reserva, no próprio servidor.
 * As casas de fora são as da mesa: `linha * 8 + coluna`, com a linha 0 na fileira 8.
 */

export type NivelDoMotor = 'iniciante' | 'facil' | 'normal' | 'dificil' | 'mestre';

export interface OpcoesDoNivel {
  /** A profundidade máxima, em meios-lances. */
  profundidade: number;
  /** O tempo que ele pode pensar (ms): passou, joga o melhor da última profundidade completa. */
  tempoMs: number;
  /** O sorteio entre os lances da raiz, em centésimos de peão (0: sempre o melhor). */
  ruido: number;
  /** A chance de escolher de propósito um lance pior (entre a metade de cima da lista). */
  erro: number;
}

export const NIVEIS_DO_MOTOR: Record<NivelDoMotor, OpcoesDoNivel> = {
  iniciante: { profundidade: 1, tempoMs: 150, ruido: 200, erro: 0.35 },
  facil: { profundidade: 2, tempoMs: 250, ruido: 45, erro: 0.08 },
  normal: { profundidade: 3, tempoMs: 400, ruido: 20, erro: 0.03 },
  dificil: { profundidade: 6, tempoMs: 700, ruido: 0, erro: 0 },
  mestre: { profundidade: 40, tempoMs: 1600, ruido: 0, erro: 0 },
};

export interface LanceDoMotor {
  de: number;
  para: number;
  /** A peça da promoção ('q', 'r', 'b', 'n'), quando é promoção. */
  promocao?: string;
}

export interface ResultadoDoMotor {
  lance: LanceDoMotor | null;
  /** A profundidade completa que decidiu o lance. */
  profundidade: number;
  /** Quantas posições ele olhou. */
  nos: number;
  /** A nota do lance para quem joga (centésimos de peão; mate perto de ±30000). */
  valor: number;
  ms: number;
}

// ---------------------------------------------------------------------------------------------------------------------------
// O tabuleiro: 0x88, com a linha 0 na fileira 8 (as brancas sobem: -16)
// ---------------------------------------------------------------------------------------------------------------------------

const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const PRETA = 8;
const VALOR = [0, 100, 320, 330, 500, 900, 0];
const LETRA = ' pnbrqk';

const DESLOCA_N = [-33, -31, -18, -14, 14, 18, 31, 33];
const DESLOCA_B = [-17, -15, 15, 17];
const DESLOCA_R = [-16, -1, 1, 16];
const DESLOCA_K = [-17, -16, -15, -1, 1, 15, 16, 17];

// os direitos de roque: 1 brancas do rei, 2 brancas da dama, 4 pretas do rei, 8 pretas da dama
const MASCARA_DO_ROQUE = new Uint8Array(128).fill(15);
MASCARA_DO_ROQUE[0x74] = 15 & ~3; // e1
MASCARA_DO_ROQUE[0x77] = 15 & ~1; // h1
MASCARA_DO_ROQUE[0x70] = 15 & ~2; // a1
MASCARA_DO_ROQUE[0x04] = 15 & ~12; // e8
MASCARA_DO_ROQUE[0x07] = 15 & ~4; // h8
MASCARA_DO_ROQUE[0x00] = 15 & ~8; // a8

// as marcas do lance (inteiro): de (7 bits) | para (7) << 7 | promoção (3) << 14 | marcas << 17
const CAPTURA = 1, EN_PASSANT = 2, ROQUE = 4, DUPLO = 8;
const de = (m: number) => m & 127;
const para = (m: number) => (m >> 7) & 127;
const promo = (m: number) => (m >> 14) & 7;
const marcas = (m: number) => m >> 17;
const lance = (d: number, p: number, pr: number, f: number) => d | (p << 7) | (pr << 14) | (f << 17);

const paraFora = (sq: number) => ((sq >> 4) << 3) | (sq & 7);
const paraDentro = (i: number) => ((i >> 3) << 4) | (i & 7);

// ---- Zobrist: dois números de 32 bits por chave (o índice da tabela e a conferência)
let semZ = 0x9e3779b9;
const aleZ = () => {
  semZ ^= semZ << 13;
  semZ ^= semZ >>> 17;
  semZ ^= semZ << 5;
  return semZ | 0;
};
const Z_PECA_A = new Int32Array(16 * 128), Z_PECA_B = new Int32Array(16 * 128);
for (let i = 0; i < 16 * 128; i++) {
  Z_PECA_A[i] = aleZ();
  Z_PECA_B[i] = aleZ();
}
const Z_VEZ_A = aleZ(), Z_VEZ_B = aleZ();
const Z_ROQUE_A = Int32Array.from({ length: 16 }, aleZ), Z_ROQUE_B = Int32Array.from({ length: 16 }, aleZ);
const Z_EP_A = Int32Array.from({ length: 8 }, aleZ), Z_EP_B = Int32Array.from({ length: 8 }, aleZ);

// ---- as tabelas de casa (do lado das brancas, com a fileira 8 em cima; as pretas leem espelhado)
// prettier-ignore
const T_PEAO = [
  0, 0, 0, 0, 0, 0, 0, 0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
  5, 5, 10, 25, 25, 10, 5, 5,
  0, 0, 0, 20, 20, 0, 0, 0,
  5, -5, -10, 0, 0, -10, -5, 5,
  5, 10, 10, -20, -20, 10, 10, 5,
  0, 0, 0, 0, 0, 0, 0, 0];
// prettier-ignore
const T_PEAO_FINAL = [
  0, 0, 0, 0, 0, 0, 0, 0,
  100, 100, 100, 100, 100, 100, 100, 100,
  70, 70, 70, 70, 70, 70, 70, 70,
  45, 45, 45, 45, 45, 45, 45, 45,
  28, 28, 28, 28, 28, 28, 28, 28,
  15, 15, 15, 15, 15, 15, 15, 15,
  5, 5, 5, 5, 5, 5, 5, 5,
  0, 0, 0, 0, 0, 0, 0, 0];
// prettier-ignore
const T_CAVALO = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20, 0, 0, 0, 0, -20, -40,
  -30, 0, 10, 15, 15, 10, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30,
  -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 10, 15, 15, 10, 5, -30,
  -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50];
// prettier-ignore
const T_BISPO = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 10, 10, 5, 0, -10,
  -10, 5, 5, 10, 10, 5, 5, -10,
  -10, 0, 10, 10, 10, 10, 0, -10,
  -10, 10, 10, 10, 10, 10, 10, -10,
  -10, 5, 0, 0, 0, 0, 5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20];
// prettier-ignore
const T_TORRE = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 10, 10, 10, 10, 10, 10, 5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  -5, 0, 0, 0, 0, 0, 0, -5,
  0, 0, 0, 5, 5, 0, 0, 0];
// prettier-ignore
const T_DAMA = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10, 0, 0, 0, 0, 0, 0, -10,
  -10, 0, 5, 5, 5, 5, 0, -10,
  -5, 0, 5, 5, 5, 5, 0, -5,
  0, 0, 5, 5, 5, 5, 0, -5,
  -10, 5, 5, 5, 5, 5, 0, -10,
  -10, 0, 5, 0, 0, 0, 0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20];
// prettier-ignore
const T_REI = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20, 20, 0, 0, 0, 0, 20, 20,
  20, 30, 10, 0, 0, 10, 30, 20];
// prettier-ignore
const T_REI_FINAL = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10, 0, 0, -10, -20, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 20, 30, 30, 20, -10, -30,
  -30, -30, 0, 0, 0, 0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50];
const MEIO: number[][] = [[], T_PEAO, T_CAVALO, T_BISPO, T_TORRE, T_DAMA, T_REI];
const FINAL: number[][] = [[], T_PEAO_FINAL, T_CAVALO, T_BISPO, T_TORRE, T_DAMA, T_REI_FINAL];
const FASE = [0, 0, 1, 1, 2, 4, 0];

export const MATE = 30000;
const INF = 32000;
const MAX_PLY = 96;
const MAX_LANCES = 256;

// a tabela de posições: 2^18 entradas (chave B, lance, nota, profundidade e tipo)
const BITS_TT = 18;
const TAM_TT = 1 << BITS_TT;
const TT_CHAVE = new Int32Array(TAM_TT);
const TT_LANCE = new Int32Array(TAM_TT);
const TT_NOTA = new Int16Array(TAM_TT);
const TT_PROF = new Int8Array(TAM_TT);
const TT_TIPO = new Uint8Array(TAM_TT); // 0 vazio, 1 exato, 2 no mínimo (beta), 3 no máximo (alfa)

class Abortou extends Error {}

/** Uma posição com o gerador, a busca e a avaliação. */
export class Motor {
  tab = new Int8Array(128);
  vez = 0; // 0 brancas, 1 pretas
  roque = 0;
  ep = -1;
  meio = 0; // os meios-lances desde a última captura ou lance de peão
  reis = [0, 0];
  hA = 0;
  hB = 0;
  // a pilha (para desfazer e para a repetição)
  private pilha = 0;
  private pCap = new Int8Array(1024);
  private pRoque = new Uint8Array(1024);
  private pEp = new Int16Array(1024);
  private pMeio = new Int16Array(1024);
  private hPilhaA = new Int32Array(1024);
  private hPilhaB = new Int32Array(1024);
  // os lances de cada ply
  private lances = new Int32Array(MAX_PLY * MAX_LANCES);
  private notas = new Int32Array(MAX_PLY * MAX_LANCES);
  private assassinos = new Int32Array(MAX_PLY * 2);
  private historia = new Int32Array(16 * 128);
  nos = 0;
  private fim = Infinity;

  constructor(fen: string) {
    this.carregar(fen);
  }

  carregar(fen: string) {
    const [pos, vez, roque, ep, meio] = fen.trim().split(/\s+/);
    this.tab.fill(0);
    let r = 0, c = 0;
    for (const ch of pos) {
      if (ch === '/') {
        r++;
        c = 0;
      } else if (ch >= '1' && ch <= '8') c += Number(ch);
      else {
        const tipo = LETRA.indexOf(ch.toLowerCase());
        if (tipo <= 0) throw new Error('FEN inválido');
        const sq = (r << 4) | c;
        this.tab[sq] = tipo | (ch === ch.toLowerCase() ? PRETA : 0);
        if (tipo === K) this.reis[ch === ch.toLowerCase() ? 1 : 0] = sq;
        c++;
      }
    }
    this.vez = vez === 'b' ? 1 : 0;
    this.roque = 0;
    if (roque && roque !== '-') {
      if (roque.includes('K')) this.roque |= 1;
      if (roque.includes('Q')) this.roque |= 2;
      if (roque.includes('k')) this.roque |= 4;
      if (roque.includes('q')) this.roque |= 8;
    }
    this.ep = ep && ep !== '-' ? ((8 - Number(ep[1])) << 4) | (ep.charCodeAt(0) - 97) : -1;
    this.meio = Number(meio) || 0;
    this.pilha = 0;
    this.calcularHash();
  }

  private calcularHash() {
    let a = 0, b = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88 || !this.tab[sq]) continue;
      a ^= Z_PECA_A[this.tab[sq] * 128 + sq];
      b ^= Z_PECA_B[this.tab[sq] * 128 + sq];
    }
    if (this.vez) {
      a ^= Z_VEZ_A;
      b ^= Z_VEZ_B;
    }
    a ^= Z_ROQUE_A[this.roque];
    b ^= Z_ROQUE_B[this.roque];
    if (this.ep >= 0) {
      a ^= Z_EP_A[this.ep & 7];
      b ^= Z_EP_B[this.ep & 7];
    }
    this.hA = a;
    this.hB = b;
  }

  /** A casa `sq` está atacada pelo lado `por`? */
  atacada(sq: number, por: number): boolean {
    const t = this.tab;
    const cor = por ? PRETA : 0;
    // peões: o peão branco que ataca `sq` está embaixo dela (+15, +17); o preto, em cima
    if (por === 0) {
      if (!((sq + 15) & 0x88) && t[sq + 15] === P) return true;
      if (!((sq + 17) & 0x88) && t[sq + 17] === P) return true;
    } else {
      if (!((sq - 15) & 0x88) && t[sq - 15] === (P | PRETA)) return true;
      if (!((sq - 17) & 0x88) && t[sq - 17] === (P | PRETA)) return true;
    }
    for (let i = 0; i < 8; i++) {
      const a = sq + DESLOCA_N[i];
      if (!(a & 0x88) && t[a] === (N | cor)) return true;
      const k = sq + DESLOCA_K[i];
      if (!(k & 0x88) && t[k] === (K | cor)) return true;
    }
    for (let i = 0; i < 4; i++) {
      const d = DESLOCA_B[i];
      for (let a = sq + d; !(a & 0x88); a += d) {
        const p = t[a];
        if (p) {
          if (p === (B | cor) || p === (Q | cor)) return true;
          break;
        }
      }
      const e = DESLOCA_R[i];
      for (let a = sq + e; !(a & 0x88); a += e) {
        const p = t[a];
        if (p) {
          if (p === (R | cor) || p === (Q | cor)) return true;
          break;
        }
      }
    }
    return false;
  }

  emXeque(lado = this.vez) {
    return this.atacada(this.reis[lado], lado ^ 1);
  }

  /** Gera os lances (pseudolegais) no ply `ply`; `soCapturas`: só as capturas e as promoções. Devolve quantos. */
  gerar(ply: number, soCapturas: boolean): number {
    const t = this.tab;
    const lista = this.lances;
    let n = ply * MAX_LANCES;
    const base = n;
    const eu = this.vez;
    const minha = eu ? PRETA : 0;
    const frente = eu ? 16 : -16;
    const linhaInicial = eu ? 1 : 6;
    const linhaPromo = eu ? 7 : 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = t[sq];
      if (!p || (p & PRETA) !== minha) continue;
      const tipo = p & 7;
      if (tipo === P) {
        const um = sq + frente;
        if (!(um & 0x88) && !t[um]) {
          if (um >> 4 === linhaPromo) {
            lista[n++] = lance(sq, um, Q, 0);
            lista[n++] = lance(sq, um, N, 0);
            lista[n++] = lance(sq, um, R, 0);
            lista[n++] = lance(sq, um, B, 0);
          } else if (!soCapturas) {
            lista[n++] = lance(sq, um, 0, 0);
            const dois = um + frente;
            if (sq >> 4 === linhaInicial && !t[dois]) lista[n++] = lance(sq, dois, 0, DUPLO);
          }
        }
        for (let lado = frente - 1; lado <= frente + 1; lado += 2) {
          const a = sq + lado;
          if (a & 0x88) continue;
          const alvo = t[a];
          if (alvo && (alvo & PRETA) !== minha) {
            if (a >> 4 === linhaPromo) {
              lista[n++] = lance(sq, a, Q, CAPTURA);
              lista[n++] = lance(sq, a, N, CAPTURA);
              lista[n++] = lance(sq, a, R, CAPTURA);
              lista[n++] = lance(sq, a, B, CAPTURA);
            } else lista[n++] = lance(sq, a, 0, CAPTURA);
          } else if (a === this.ep) lista[n++] = lance(sq, a, 0, CAPTURA | EN_PASSANT);
        }
        continue;
      }
      if (tipo === N || tipo === K) {
        const ds = tipo === N ? DESLOCA_N : DESLOCA_K;
        for (let i = 0; i < 8; i++) {
          const a = sq + ds[i];
          if (a & 0x88) continue;
          const alvo = t[a];
          if (!alvo) {
            if (!soCapturas) lista[n++] = lance(sq, a, 0, 0);
          } else if ((alvo & PRETA) !== minha) lista[n++] = lance(sq, a, 0, CAPTURA);
        }
        if (tipo === K && !soCapturas) n = this.roques(sq, n);
        continue;
      }
      const ds = tipo === B ? DESLOCA_B : tipo === R ? DESLOCA_R : DESLOCA_K;
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        for (let a = sq + d; !(a & 0x88); a += d) {
          const alvo = t[a];
          if (!alvo) {
            if (!soCapturas) lista[n++] = lance(sq, a, 0, 0);
            continue;
          }
          if ((alvo & PRETA) !== minha) lista[n++] = lance(sq, a, 0, CAPTURA);
          break;
        }
      }
    }
    return n - base;
  }

  private roques(sq: number, n: number): number {
    const t = this.tab;
    const lista = this.lances;
    if (this.vez === 0) {
      if (sq !== 0x74) return n;
      if (this.roque & 1 && !t[0x75] && !t[0x76] && t[0x77] === R && !this.atacada(0x74, 1) && !this.atacada(0x75, 1))
        lista[n++] = lance(0x74, 0x76, 0, ROQUE);
      if (this.roque & 2 && !t[0x73] && !t[0x72] && !t[0x71] && t[0x70] === R && !this.atacada(0x74, 1) && !this.atacada(0x73, 1))
        lista[n++] = lance(0x74, 0x72, 0, ROQUE);
    } else {
      if (sq !== 0x04) return n;
      if (this.roque & 4 && !t[0x05] && !t[0x06] && t[0x07] === (R | PRETA) && !this.atacada(0x04, 0) && !this.atacada(0x05, 0))
        lista[n++] = lance(0x04, 0x06, 0, ROQUE);
      if (this.roque & 8 && !t[0x03] && !t[0x02] && !t[0x01] && t[0x00] === (R | PRETA) && !this.atacada(0x04, 0) && !this.atacada(0x03, 0))
        lista[n++] = lance(0x04, 0x02, 0, ROQUE);
    }
    return n;
  }

  private xorPeca(p: number, sq: number) {
    this.hA ^= Z_PECA_A[p * 128 + sq];
    this.hB ^= Z_PECA_B[p * 128 + sq];
  }

  /** Faz o lance. Devolve false (e desfaz) se ele deixa o próprio rei em xeque. */
  fazer(m: number): boolean {
    const t = this.tab;
    const d = de(m), a = para(m), f = marcas(m);
    const p = t[d];
    const k = this.pilha++;
    this.pCap[k] = t[a];
    this.pRoque[k] = this.roque;
    this.pEp[k] = this.ep;
    this.pMeio[k] = this.meio;
    this.hPilhaA[k] = this.hA;
    this.hPilhaB[k] = this.hB;

    if (this.ep >= 0) {
      this.hA ^= Z_EP_A[this.ep & 7];
      this.hB ^= Z_EP_B[this.ep & 7];
    }
    this.hA ^= Z_ROQUE_A[this.roque];
    this.hB ^= Z_ROQUE_B[this.roque];

    if (t[a]) this.xorPeca(t[a], a);
    this.xorPeca(p, d);
    t[a] = p;
    t[d] = 0;
    if (f & EN_PASSANT) {
      const cap = this.vez ? a - 16 : a + 16;
      this.pCap[k] = t[cap];
      this.xorPeca(t[cap], cap);
      t[cap] = 0;
    }
    const pr = promo(m);
    if (pr) t[a] = pr | (p & PRETA);
    this.xorPeca(t[a], a);
    if (f & ROQUE) {
      const [rd, ra] = a === 0x76 ? [0x77, 0x75] : a === 0x72 ? [0x70, 0x73] : a === 0x06 ? [0x07, 0x05] : [0x00, 0x03];
      const torre = t[rd];
      this.xorPeca(torre, rd);
      this.xorPeca(torre, ra);
      t[ra] = torre;
      t[rd] = 0;
    }
    if ((p & 7) === K) this.reis[this.vez] = a;
    this.roque &= MASCARA_DO_ROQUE[d] & MASCARA_DO_ROQUE[a];
    this.ep = -1;
    if (f & DUPLO) {
      const passada = (d + a) >> 1;
      // só vale a casa de en passant que um peão do outro lado pode tomar (como no FEN do chess.js)
      const inimigo = P | (this.vez ? 0 : PRETA);
      if ((!((a - 1) & 0x88) && t[a - 1] === inimigo) || (!((a + 1) & 0x88) && t[a + 1] === inimigo)) this.ep = passada;
    }
    this.meio = (p & 7) === P || this.pCap[k] ? 0 : this.meio + 1;
    this.hA ^= Z_ROQUE_A[this.roque];
    this.hB ^= Z_ROQUE_B[this.roque];
    if (this.ep >= 0) {
      this.hA ^= Z_EP_A[this.ep & 7];
      this.hB ^= Z_EP_B[this.ep & 7];
    }
    this.hA ^= Z_VEZ_A;
    this.hB ^= Z_VEZ_B;
    this.vez ^= 1;
    if (this.atacada(this.reis[this.vez ^ 1], this.vez)) {
      this.desfazer(m);
      return false;
    }
    return true;
  }

  desfazer(m: number) {
    const t = this.tab;
    const k = --this.pilha;
    this.vez ^= 1;
    const d = de(m), a = para(m), f = marcas(m);
    let p = t[a];
    if (promo(m)) p = P | (p & PRETA);
    t[d] = p;
    if (f & EN_PASSANT) {
      t[a] = 0;
      t[this.vez ? a - 16 : a + 16] = this.pCap[k];
    } else t[a] = this.pCap[k];
    if (f & ROQUE) {
      const [rd, ra] = a === 0x76 ? [0x77, 0x75] : a === 0x72 ? [0x70, 0x73] : a === 0x06 ? [0x07, 0x05] : [0x00, 0x03];
      t[rd] = t[ra];
      t[ra] = 0;
    }
    if ((p & 7) === K) this.reis[this.vez] = d;
    this.roque = this.pRoque[k];
    this.ep = this.pEp[k];
    this.meio = this.pMeio[k];
    this.hA = this.hPilhaA[k];
    this.hB = this.hPilhaB[k];
  }

  private fazerNulo() {
    const k = this.pilha++;
    this.pEp[k] = this.ep;
    this.pMeio[k] = this.meio;
    this.hPilhaA[k] = this.hA;
    this.hPilhaB[k] = this.hB;
    if (this.ep >= 0) {
      this.hA ^= Z_EP_A[this.ep & 7];
      this.hB ^= Z_EP_B[this.ep & 7];
    }
    this.ep = -1;
    this.meio++;
    this.hA ^= Z_VEZ_A;
    this.hB ^= Z_VEZ_B;
    this.vez ^= 1;
  }

  private desfazerNulo() {
    const k = --this.pilha;
    this.vez ^= 1;
    this.ep = this.pEp[k];
    this.meio = this.pMeio[k];
    this.hA = this.hPilhaA[k];
    this.hB = this.hPilhaB[k];
  }

  /** As posições de antes desta (da partida), para a repetição: as chaves, da mais antiga à mais nova. */
  historicoDaPartida(fens: string[]) {
    const atual = { tab: this.tab.slice(), vez: this.vez, roque: this.roque, ep: this.ep, meio: this.meio, reis: [...this.reis] };
    const chaves: [number, number][] = [];
    for (const fen of fens) {
      try {
        this.carregar(fen);
        chaves.push([this.hA, this.hB]);
      } catch {
        /* uma posição que não abre não conta */
      }
    }
    this.tab.set(atual.tab);
    Object.assign(this, { vez: atual.vez, roque: atual.roque, ep: atual.ep, meio: atual.meio, reis: atual.reis });
    this.calcularHash();
    // as chaves entram na pilha como se fossem lances já feitos
    this.pilha = 0;
    for (const [a, b] of chaves.slice(-1000)) {
      this.hPilhaA[this.pilha] = a;
      this.hPilhaB[this.pilha] = b;
      this.pilha++;
    }
  }

  private repetiu(): boolean {
    // as posições com a mesma vez, até a última captura ou lance de peão
    const ate = Math.max(0, this.pilha - this.meio);
    for (let i = this.pilha - 2; i >= ate; i -= 2) if (this.hPilhaA[i] === this.hA && this.hPilhaB[i] === this.hB) return true;
    return false;
  }

  /** A nota da posição para quem tem a vez (centésimos de peão). */
  avaliar(): number {
    const t = this.tab;
    let meioJogo = 0, finalJogo = 0, fase = 0;
    let bisposB = 0, bisposP = 0, materialB = 0, materialP = 0, menoresB = 0, menoresP = 0, peoesB = 0, peoesP = 0, grandes = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = t[sq];
      if (!p) continue;
      const tipo = p & 7;
      const i = paraFora(sq);
      if (p & PRETA) {
        const j = i ^ 56; // espelho
        meioJogo -= VALOR[tipo] + MEIO[tipo][j];
        finalJogo -= VALOR[tipo] + FINAL[tipo][j];
        materialP += VALOR[tipo];
        if (tipo === B) bisposP++;
        if (tipo === N || tipo === B) menoresP++;
        if (tipo === P) peoesP++;
      } else {
        meioJogo += VALOR[tipo] + MEIO[tipo][i];
        finalJogo += VALOR[tipo] + FINAL[tipo][i];
        materialB += VALOR[tipo];
        if (tipo === B) bisposB++;
        if (tipo === N || tipo === B) menoresB++;
        if (tipo === P) peoesB++;
      }
      if (tipo === R || tipo === Q) grandes++;
      fase += FASE[tipo];
    }
    // sem peão e com no máximo uma peça menor de cada lado (e nada maior): não dá mate
    if (!peoesB && !peoesP && !grandes && menoresB <= 1 && menoresP <= 1) return 0;
    if (bisposB >= 2) {
      meioJogo += 30;
      finalJogo += 40;
    }
    if (bisposP >= 2) {
      meioJogo -= 30;
      finalJogo -= 40;
    }
    if (fase > 24) fase = 24;
    let nota = Math.trunc((meioJogo * fase + finalJogo * (24 - fase)) / 24);
    // o final ganho: empurrar o rei do outro para a borda e chegar o próprio perto (para dar o mate, e não rodar)
    const dif = materialB - materialP;
    if (fase <= 8 && Math.abs(dif) >= 300) {
      const forte = dif > 0 ? 0 : 1;
      const rf = this.reis[forte], rp = this.reis[forte ^ 1];
      const lr = rp >> 4, cr = rp & 7;
      const centro = Math.max(3 - lr, lr - 4) + Math.max(3 - cr, cr - 4);
      const perto = 14 - (Math.abs((rf >> 4) - lr) + Math.abs((rf & 7) - cr));
      const bonus = centro * 10 + perto * 4;
      nota += forte === 0 ? bonus : -bonus;
    }
    return (this.vez ? -nota : nota) + 10; // +10: a vez vale um pouco
  }

  private relogio() {
    if ((++this.nos & 1023) === 0 && performance.now() > this.fim) throw new Abortou();
  }

  // ---- a ordenação: o da tabela, capturas (MVV-LVA), promoções, assassinos, histórico
  private ordenar(ply: number, n: number, ttLance: number, comXeque: boolean) {
    const base = ply * MAX_LANCES;
    const t = this.tab;
    for (let i = 0; i < n; i++) {
      const m = this.lances[base + i];
      let s = 0;
      if (m === ttLance) s = 10_000_000;
      else if (marcas(m) & CAPTURA) {
        const vitima = marcas(m) & EN_PASSANT ? P : t[para(m)] & 7;
        s = 1_000_000 + VALOR[vitima] * 10 - VALOR[t[de(m)] & 7] / 10;
      } else if (promo(m)) s = promo(m) === Q ? 900_000 : 0;
      else if (m === this.assassinos[ply * 2]) s = 800_000;
      else if (m === this.assassinos[ply * 2 + 1]) s = 790_000;
      else s = this.historia[(t[de(m)]) * 128 + para(m)];
      if (promo(m) === Q) s += 500_000;
      // o lance que dá xeque sobe (só onde a busca é funda: conferir custa fazer o lance)
      if (comXeque && s < 790_000 && this.fazer(m)) {
        if (this.emXeque()) s += 700_000;
        this.desfazer(m);
      }
      this.notas[base + i] = s;
    }
  }

  private escolherProximo(ply: number, i: number, n: number): number {
    const base = ply * MAX_LANCES;
    let melhor = i;
    for (let j = i + 1; j < n; j++) if (this.notas[base + j] > this.notas[base + melhor]) melhor = j;
    if (melhor !== i) {
      const m = this.lances[base + i], s = this.notas[base + i];
      this.lances[base + i] = this.lances[base + melhor];
      this.notas[base + i] = this.notas[base + melhor];
      this.lances[base + melhor] = m;
      this.notas[base + melhor] = s;
    }
    return this.lances[base + i];
  }

  /** A quiescência: só as capturas (e promoções), até a posição ficar quieta. */
  private quieta(alfa: number, beta: number, ply: number): number {
    this.relogio();
    const parado = this.avaliar();
    if (ply >= MAX_PLY - 1) return parado;
    if (parado >= beta) return parado;
    if (parado > alfa) alfa = parado;
    const n = this.gerar(ply, true);
    this.ordenar(ply, n, 0, false);
    let melhor = parado;
    for (let i = 0; i < n; i++) {
      const m = this.escolherProximo(ply, i, n);
      // a poda delta: nem comendo a peça a nota chega perto de alfa
      if (!promo(m) && !(marcas(m) & EN_PASSANT) && parado + VALOR[this.tab[para(m)] & 7] + 200 < alfa) continue;
      if (!this.fazer(m)) continue;
      const v = -this.quieta(-beta, -alfa, ply + 1);
      this.desfazer(m);
      if (v > melhor) melhor = v;
      if (v > alfa) {
        alfa = v;
        if (v >= beta) break;
      }
    }
    return melhor;
  }

  private temPecas(lado: number) {
    const cor = lado ? PRETA : 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = this.tab[sq];
      if (p && (p & PRETA) === cor && (p & 7) !== P && (p & 7) !== K) return true;
    }
    return false;
  }

  private buscar(prof: number, alfa: number, beta: number, ply: number, nuloPode: boolean): number {
    this.relogio();
    if (ply > 0 && (this.meio >= 100 || this.repetiu())) return 0;
    if (ply >= MAX_PLY - 1) return this.avaliar();
    // a distância até o mate
    alfa = Math.max(alfa, -MATE + ply);
    beta = Math.min(beta, MATE - ply - 1);
    if (alfa >= beta) return alfa;
    const xeque = this.emXeque();
    if (xeque) prof++;
    if (prof <= 0) return this.quieta(alfa, beta, ply);

    const idx = this.hA & (TAM_TT - 1);
    let ttLance = 0;
    if (TT_TIPO[idx] && TT_CHAVE[idx] === this.hB) {
      ttLance = TT_LANCE[idx];
      if (ply > 0 && TT_PROF[idx] >= prof) {
        let v = TT_NOTA[idx];
        if (v > MATE - 200) v -= ply;
        else if (v < -MATE + 200) v += ply;
        const tipo = TT_TIPO[idx];
        if (tipo === 1 || (tipo === 2 && v >= beta) || (tipo === 3 && v <= alfa)) return v;
      }
    }
    const janelaNula = beta - alfa === 1;

    // o lance nulo: se nem passando a vez o outro alcança beta, corta
    if (nuloPode && janelaNula && !xeque && prof >= 3 && ply > 0 && this.temPecas(this.vez) && this.avaliar() >= beta) {
      this.fazerNulo();
      const v = -this.buscar(prof - 3, -beta, -beta + 1, ply + 1, false);
      this.desfazerNulo();
      if (v >= beta) return beta;
    }

    const n = this.gerar(ply, false);
    this.ordenar(ply, n, ttLance, prof >= 3);
    let legais = 0;
    let melhor = -INF;
    let melhorLance = 0;
    const alfaAntes = alfa;
    for (let i = 0; i < n; i++) {
      const m = this.escolherProximo(ply, i, n);
      if (!this.fazer(m)) continue;
      legais++;
      const quieto = !(marcas(m) & CAPTURA) && !promo(m);
      let v: number;
      if (legais === 1) v = -this.buscar(prof - 1, -beta, -alfa, ply + 1, true);
      else {
        // os lances tardios e quietos olham um pouco menos fundo, e voltam se surpreendem
        let reduz = 0;
        if (quieto && !xeque && prof >= 3 && legais > 4 && m !== this.assassinos[ply * 2] && m !== this.assassinos[ply * 2 + 1] && !this.emXeque()) reduz = legais > 10 ? 2 : 1;
        v = -this.buscar(prof - 1 - reduz, -alfa - 1, -alfa, ply + 1, true);
        if (v > alfa && reduz) v = -this.buscar(prof - 1, -alfa - 1, -alfa, ply + 1, true);
        if (v > alfa && v < beta) v = -this.buscar(prof - 1, -beta, -alfa, ply + 1, true);
      }
      this.desfazer(m);
      if (v > melhor) {
        melhor = v;
        melhorLance = m;
      }
      if (v > alfa) {
        alfa = v;
        if (v >= beta) {
          if (quieto) {
            if (this.assassinos[ply * 2] !== m) {
              this.assassinos[ply * 2 + 1] = this.assassinos[ply * 2];
              this.assassinos[ply * 2] = m;
            }
            const h = this.tab[de(m)] * 128 + para(m);
            this.historia[h] = Math.min(400_000, this.historia[h] + prof * prof);
          }
          break;
        }
      }
    }
    if (!legais) return xeque ? -MATE + ply : 0;

    let guarda = melhor;
    if (guarda > MATE - 200) guarda += ply;
    else if (guarda < -MATE + 200) guarda -= ply;
    TT_CHAVE[idx] = this.hB;
    TT_LANCE[idx] = melhorLance;
    TT_NOTA[idx] = guarda;
    TT_PROF[idx] = prof;
    TT_TIPO[idx] = melhor >= beta ? 2 : melhor > alfaAntes ? 1 : 3;
    return melhor;
  }

  /** Os lances legais da posição (inteiros do motor). */
  legais(): number[] {
    const n = this.gerar(0, false);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const m = this.lances[i];
      if (this.fazer(m)) {
        this.desfazer(m);
        out.push(m);
      }
    }
    return out;
  }

  /**
   * Pensa e escolhe. `aleatorio`: o sorteio do ruído e do erro (de fora, para o teste repetir).
   */
  pensar(opcoes: OpcoesDoNivel, aleatorio: () => number = Math.random): ResultadoDoMotor {
    const t0 = performance.now();
    this.nos = 0;
    this.assassinos.fill(0);
    this.historia.fill(0);
    TT_TIPO.fill(0);
    const raiz = this.legais();
    if (!raiz.length) return { lance: null, profundidade: 0, nos: 0, valor: this.emXeque() ? -MATE : 0, ms: 0 };
    if (raiz.length === 1) return { lance: paraFora3(raiz[0]), profundidade: 0, nos: 0, valor: 0, ms: performance.now() - t0 };
    this.fim = t0 + opcoes.tempoMs;
    const comSorteio = opcoes.ruido > 0 || opcoes.erro > 0;
    let notas: number[] = raiz.map(() => 0);
    let completa = 0;
    let melhorLance = raiz[0];
    let melhorValor = 0;
    try {
      for (let prof = 1; prof <= opcoes.profundidade; prof++) {
        if (comSorteio) {
          // a raiz inteira com janela aberta: a nota de cada lance, para o sorteio entre os parecidos
          const novas = raiz.map((m) => {
            this.fazer(m);
            try {
              return -this.buscar(prof - 1, -INF, INF, 1, true);
            } finally {
              this.desfazer(m);
            }
          });
          notas = novas;
        } else {
          // a busca normal: o melhor da profundidade anterior primeiro
          const ordem = [melhorLance, ...raiz.filter((m) => m !== melhorLance)];
          let alfa = -INF;
          let melhorAqui = ordem[0];
          for (let i = 0; i < ordem.length; i++) {
            const m = ordem[i];
            this.fazer(m);
            let v: number;
            try {
              if (i === 0) v = -this.buscar(prof - 1, -INF, -alfa, 1, true);
              else {
                v = -this.buscar(prof - 1, -alfa - 1, -alfa, 1, true);
                if (v > alfa) v = -this.buscar(prof - 1, -INF, -alfa, 1, true);
              }
            } finally {
              this.desfazer(m);
            }
            if (v > alfa) {
              alfa = v;
              melhorAqui = m;
            }
          }
          melhorLance = melhorAqui;
          melhorValor = alfa;
        }
        completa = prof;
        // achou o mate: não precisa olhar mais fundo
        if (!comSorteio && Math.abs(melhorValor) > MATE - 200) break;
        // a próxima profundidade custa umas quatro vezes esta: se não cabe no tempo, nem começa
        if (performance.now() - t0 > opcoes.tempoMs * 0.45) break;
      }
    } catch (e) {
      if (!(e instanceof Abortou)) throw e;
      // a busca interrompida já desfez os lances (os finally): fica a última profundidade completa
    }
    this.fim = Infinity;
    if (comSorteio) {
      if (completa === 0) {
        // nem a primeira profundidade coube: a nota parada de cada lance
        notas = raiz.map((m) => {
          this.fazer(m);
          const v = -this.avaliar();
          this.desfazer(m);
          return v;
        });
      }
      const ordem = raiz.map((m, i) => ({ m, v: notas[i] })).sort((a, b) => b.v - a.v);
      let escolhido = ordem[0];
      // com o mate na mão, ele não erra de propósito
      if (ordem[0].v < MATE - 200 && aleatorio() < opcoes.erro) {
        // o erro proposital: um lance qualquer da metade de cima (nunca o que entrega mate na hora)
        const metade = ordem.slice(0, Math.max(2, Math.ceil(ordem.length / 2))).filter((x) => x.v > -MATE + 200);
        if (metade.length) escolhido = metade[Math.floor(aleatorio() * metade.length)];
      } else {
        let melhorSorteado = -Infinity;
        for (const x of ordem) {
          // o mate não se sorteia: achou, dá
          const s = Math.abs(x.v) > MATE - 200 ? x.v : x.v + aleatorio() * opcoes.ruido;
          if (s > melhorSorteado) {
            melhorSorteado = s;
            escolhido = x;
          }
        }
      }
      melhorLance = escolhido.m;
      melhorValor = escolhido.v;
    }
    return { lance: paraFora3(melhorLance), profundidade: completa, nos: this.nos, valor: melhorValor, ms: performance.now() - t0 };
  }
}

const paraFora3 = (m: number): LanceDoMotor => {
  const l: LanceDoMotor = { de: paraFora(de(m)), para: paraFora(para(m)) };
  if (promo(m)) l.promocao = LETRA[promo(m)];
  return l;
};

/** A conta de casas de fora (para os testes). */
export const casaDoMotor = { paraFora, paraDentro };

/**
 * O lance do robô para a posição `fen`, no nível escolhido. `historico`: os FEN das posições de antes (a repetição de três
 * vezes conta as da partida). `semente`: o sorteio (o mesmo número, a mesma escolha, quando o tempo não interrompe).
 */
export function lanceDoMotor(fen: string, nivel: NivelDoMotor | OpcoesDoNivel, historico: string[] = [], semente = 1): ResultadoDoMotor {
  const opcoes = typeof nivel === 'string' ? NIVEIS_DO_MOTOR[nivel] ?? NIVEIS_DO_MOTOR.normal : nivel;
  const motor = new Motor(fen);
  if (historico.length) motor.historicoDaPartida(historico);
  // a semente é misturada antes (o xorshift com semente pequena começa com números perto de zero)
  let s = Math.imul((semente >>> 0) ^ 0x5bd1e995, 0x9e3779b1) >>> 0 || 1;
  const aleatorio = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
  for (let i = 0; i < 4; i++) aleatorio();
  return motor.pensar(opcoes, aleatorio);
}

/** Contar as posições até `prof` (perft): confere o gerador contra os números conhecidos. */
export function perft(fen: string, prof: number): number {
  const motor = new Motor(fen);
  const contar = (p: number, ply: number): number => {
    if (p === 0) return 1;
    const n = motor.gerar(ply, false);
    // os lances do ply ficam no buffer; a recursão usa os do ply seguinte
    const lista = Array.from({ length: n }, (_, i) => (motor as unknown as { lances: Int32Array }).lances[ply * MAX_LANCES + i]);
    let total = 0;
    for (const m of lista) {
      if (!motor.fazer(m)) continue;
      total += contar(p - 1, ply + 1);
      motor.desfazer(m);
    }
    return total;
  };
  return contar(prof, 0);
}
