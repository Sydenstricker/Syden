/**
 * A LÓGICA DO SUDOKU (20/11/2026, a segunda auditoria dos mini-games): as unidades (com as duas diagonais no Sudoku X), a
 * busca que conta soluções e preenche, e o RESOLVEDOR LÓGICO que diz qual técnica o tabuleiro pede. É por ele que cada
 * dificuldade é a dificuldade: antes, só o número de casas vazias decidia, e um "Difícil" saía inteiro só com singles.
 *
 * As técnicas, em degraus (o nível de um tabuleiro é o MAIS ALTO que o resolvedor precisou usar, tentando sempre a mais simples
 * primeiro):
 *   1 — single nu: a casa onde só um número cabe;
 *   2 — single escondido: o número que só cabe numa casa da linha, da coluna, do bloco (ou da diagonal, no X);
 *   3 — pares e casas travadas: o par nu, o par escondido, e o número de um bloco preso a uma linha (ou o contrário);
 *   4 — X-wing: o número que, em duas linhas, só cabe nas mesmas duas colunas (ou o contrário).
 * Tabuleiro que nada disso resolve pede chute, e o gerador não o usa.
 */

export const NIVEL_NU = 1;
export const NIVEL_ESCONDIDO = 2;
export const NIVEL_PARES = 3;
export const NIVEL_XWING = 4;
/** Não sai com as técnicas acima. */
export const NIVEL_CHUTE = 99;

const linha = (i: number) => Math.floor(i / 9);
const coluna = (i: number) => i % 9;
const bloco = (i: number) => Math.floor(linha(i) / 3) * 3 + Math.floor(coluna(i) / 3);

const LINHAS = Array.from({ length: 9 }, (_, l) => Array.from({ length: 9 }, (_, c) => l * 9 + c));
const COLUNAS = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, l) => l * 9 + c));
const BLOCOS = Array.from({ length: 9 }, (_, b) => [...Array(81).keys()].filter((i) => bloco(i) === b));
/** As duas diagonais do Sudoku X: a que desce da esquerda e a que sobe. */
export const DIAGONAIS = [Array.from({ length: 9 }, (_, k) => k * 9 + k), Array.from({ length: 9 }, (_, k) => k * 9 + (8 - k))];

const UNIDADES = [...LINHAS, ...COLUNAS, ...BLOCOS];
const UNIDADES_X = [...UNIDADES, ...DIAGONAIS];
export const unidadesDe = (x: boolean) => (x ? UNIDADES_X : UNIDADES);
/** Cada bloco com cada linha e coluna que o cruza (nos dois sentidos): o cruzamento, o resto da unidade de dentro e o da de fora. */
const CRUZAMENTOS = (() => {
  const lista: { comum: number[]; dentro: number[]; fora: number[] }[] = [];
  for (const b of BLOCOS)
    for (const l of [...LINHAS, ...COLUNAS]) {
      const comum = b.filter((i) => l.includes(i));
      if (comum.length < 3) continue;
      lista.push({ comum, dentro: b.filter((i) => !comum.includes(i)), fora: l.filter((i) => !comum.includes(i)) });
      lista.push({ comum, dentro: l.filter((i) => !comum.includes(i)), fora: b.filter((i) => !comum.includes(i)) });
    }
  return lista;
})();

/** As casas que "veem" cada casa (dividem uma unidade com ela), sem ela mesma. */
const vizinhosDe = (unidades: number[][]) =>
  Array.from({ length: 81 }, (_, i) => [...new Set(unidades.filter((u) => u.includes(i)).flat())].filter((j) => j !== i));
const VIZINHOS = vizinhosDe(UNIDADES);
const VIZINHOS_X = vizinhosDe(UNIDADES_X);

const TODOS = 0b1111111110;
const quantos = (mascara: number) => {
  let n = 0;
  for (let m = mascara; m; m &= m - 1) n++;
  return n;
};
const unico = (mascara: number) => 31 - Math.clz32(mascara);

/** Os números que cabem na casa `i`, como máscara de bits (o bit d ligado = o número d cabe). */
export function livres(grade: number[], i: number, x = false): number {
  let usados = 0;
  for (const j of (x ? VIZINHOS_X : VIZINHOS)[i]) if (grade[j]) usados |= 1 << grade[j];
  return ~usados & TODOS;
}

/** A casa vazia com menos opções (resolve muito mais rápido do que ir em ordem), ou -1 se não há vazia. */
function maisApertada(grade: number[], x: boolean): { casa: number; mascara: number } {
  let casa = -1;
  let mascara = 0;
  let menor = 10;
  for (let i = 0; i < 81; i++) {
    if (grade[i]) continue;
    const m = livres(grade, i, x);
    const n = quantos(m);
    if (n < menor) {
      casa = i;
      mascara = m;
      menor = n;
      if (n <= 1) break;
    }
  }
  return { casa, mascara };
}

/** Quantas soluções o tabuleiro tem, contando até `limite` (2 basta para saber se é única). */
export function contarSolucoes(grade: number[], limite = 2, x = false): number {
  const { casa, mascara } = maisApertada(grade, x);
  if (casa === -1) return 1;
  let total = 0;
  for (let d = 1; d <= 9 && total < limite; d++) {
    if (!(mascara & (1 << d))) continue;
    grade[casa] = d;
    total += contarSolucoes(grade, limite - total, x);
  }
  grade[casa] = 0;
  return total;
}

/** Preenche a grade (uma solução ao acaso). */
export function preencher(grade: number[], aleatorio: () => number, x = false): boolean {
  const { casa, mascara } = maisApertada(grade, x);
  if (casa === -1) return true;
  const ordem = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  for (const d of ordem) {
    if (!(mascara & (1 << d))) continue;
    grade[casa] = d;
    if (preencher(grade, aleatorio, x)) return true;
  }
  grade[casa] = 0;
  return false;
}

/**
 * O RESOLVEDOR LÓGICO: o nível do tabuleiro (a técnica mais alta que precisou), ou NIVEL_CHUTE se as técnicas não bastam.
 * Sempre a mais simples primeiro: um tabuleiro que sai só com singles nus é nível 1, mesmo que outra técnica também sirva.
 */
export function nivelDoTabuleiro(enigma: number[], x = false): number {
  const unidades = unidadesDe(x);
  const vizinhos = x ? VIZINHOS_X : VIZINHOS;
  const grade = [...enigma];
  const cand = grade.map((n, i) => (n ? 0 : livres(grade, i, x)));
  let vazias = grade.filter((n) => n === 0).length;
  let nivel = 0;

  const por = (i: number, d: number) => {
    grade[i] = d;
    cand[i] = 0;
    vazias--;
    for (const j of vizinhos[i]) cand[j] &= ~(1 << d);
  };

  /** 1: a casa com um número só. */
  const singleNu = () => {
    for (let i = 0; i < 81; i++) if (!grade[i] && quantos(cand[i]) === 1) return por(i, unico(cand[i])), true;
    return false;
  };
  /** 2: o número que só cabe numa casa da unidade. */
  const singleEscondido = () => {
    for (const u of unidades)
      for (let d = 1; d <= 9; d++) {
        let onde = -1;
        let n = 0;
        for (const i of u) if (cand[i] & (1 << d)) (onde = i), n++;
        if (n === 1) return por(onde, d), true;
      }
    return false;
  };
  /** 3a: casas travadas (o número de um bloco preso a uma linha ou coluna, e o de uma linha ou coluna preso a um bloco). */
  const travadas = () => {
    let mudou = false;
    for (const { comum, dentro, fora } of CRUZAMENTOS) {
      let noComum = 0;
      let noDentro = 0;
      for (const i of comum) noComum |= cand[i];
      for (const i of dentro) noDentro |= cand[i];
      // os números que, na unidade de dentro, só cabem no cruzamento: saem do resto da de fora
      const presos = noComum & ~noDentro;
      if (!presos) continue;
      for (const i of fora)
        if (cand[i] & presos) {
          cand[i] &= ~presos;
          mudou = true;
        }
    }
    return mudou;
  };
  /** 3b: o par nu (duas casas com os mesmos dois números) e o par escondido (dois números só nas mesmas duas casas). */
  const pares = () => {
    let mudou = false;
    for (const u of unidades) {
      const vazias = u.filter((i) => !grade[i]);
      for (let a = 0; a < vazias.length; a++) {
        const ma = cand[vazias[a]];
        if (quantos(ma) !== 2) continue;
        for (let b = a + 1; b < vazias.length; b++) {
          if (cand[vazias[b]] !== ma) continue;
          for (const i of vazias) if (i !== vazias[a] && i !== vazias[b] && cand[i] & ma) (cand[i] &= ~ma), (mudou = true);
        }
      }
      const casasDe = (d: number) => vazias.filter((i) => cand[i] & (1 << d));
      for (let d1 = 1; d1 <= 9; d1++) {
        const c1 = casasDe(d1);
        if (c1.length !== 2) continue;
        for (let d2 = d1 + 1; d2 <= 9; d2++) {
          const c2 = casasDe(d2);
          if (c2.length !== 2 || c2[0] !== c1[0] || c2[1] !== c1[1]) continue;
          const par = (1 << d1) | (1 << d2);
          for (const i of c1) if (cand[i] & ~par) (cand[i] &= par), (mudou = true);
        }
      }
    }
    return mudou;
  };
  /** 4: o X-wing, por linhas e por colunas. */
  const xwing = () => {
    let mudou = false;
    for (const porLinha of [true, false]) {
      // a casa da linha (ou coluna) a, posição k
      const casa = (a: number, k: number) => (porLinha ? a * 9 + k : k * 9 + a);
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        // em cada linha (ou coluna), as posições onde d cabe, como máscara, quando são exatamente duas
        const duas: number[] = [];
        for (let a = 0; a < 9; a++) {
          let m = 0;
          for (let k = 0; k < 9; k++) if (cand[casa(a, k)] & bit) m |= 1 << k;
          duas.push(quantos(m) === 2 ? m : 0);
        }
        for (let a = 0; a < 9; a++) {
          if (!duas[a]) continue;
          for (let b = a + 1; b < 9; b++) {
            if (duas[b] !== duas[a]) continue;
            for (let k = 0; k < 9; k++) {
              if (!(duas[a] & (1 << k))) continue;
              for (let r = 0; r < 9; r++) {
                if (r === a || r === b) continue;
                const i = casa(r, k);
                if (cand[i] & bit) {
                  cand[i] &= ~bit;
                  mudou = true;
                }
              }
            }
          }
        }
      }
    }
    return mudou;
  };

  const degraus: [number, () => boolean][] = [
    [NIVEL_NU, singleNu],
    [NIVEL_ESCONDIDO, singleEscondido],
    [NIVEL_PARES, travadas],
    [NIVEL_PARES, pares],
    [NIVEL_XWING, xwing],
  ];
  while (vazias > 0) {
    // uma casa vazia sem candidato: o tabuleiro não tem solução
    if (cand.some((m, i) => !grade[i] && m === 0)) return NIVEL_CHUTE;
    let andou = false;
    for (const [n, tecnica] of degraus) {
      if (tecnica()) {
        nivel = Math.max(nivel, n);
        andou = true;
        break;
      }
    }
    if (!andou) return NIVEL_CHUTE;
  }
  return nivel;
}

/**
 * O que cada dificuldade pede: o nível do resolvedor (de, até) e as casas vazias que o gerador tenta. O "Fácil" sai só com
 * singles nus; o "Médio" pede os escondidos; o "Difícil", pares ou casas travadas; o "Muito difícil", o X-wing.
 */
export const PEDIDO = {
  facil: { de: NIVEL_NU, ate: NIVEL_NU, vazias: 35 },
  medio: { de: NIVEL_ESCONDIDO, ate: NIVEL_ESCONDIDO, vazias: 45 },
  dificil: { de: NIVEL_PARES, ate: NIVEL_PARES, vazias: 52 },
  extremo: { de: NIVEL_XWING, ate: NIVEL_XWING, vazias: 58 },
} as const;
export type Pedido = (typeof PEDIDO)[keyof typeof PEDIDO];

export interface Gerado {
  enigma: number[];
  solucao: number[];
  nivel: number;
}

/**
 * UMA TENTATIVA: uma solução ao acaso, e tira casas (mantendo a solução única) até `vazias`. Se o tabuleiro ainda não pede a
 * técnica, continua tirando até ela aparecer (ou até não dar mais): é assim que o nível sobe.
 */
export function tentativa(aleatorio: () => number, pedido: Pedido, x = false): Gerado {
  const passos = tentativaAosPoucos(aleatorio, pedido, x);
  for (;;) {
    const r = passos.next();
    if (r.done) return r.value;
  }
}

/**
 * A mesma tentativa, AOS POUCOS: para a cada casa conferida, para a reserva encher sem segurar o servidor (os jogos de tempo real
 * dividem o mesmo processo).
 */
export function* tentativaAosPoucos(aleatorio: () => number, pedido: Pedido, x = false): Generator<void, Gerado, void> {
  const solucao = new Array<number>(81).fill(0);
  preencher(solucao, aleatorio, x);
  const enigma = [...solucao];
  const ordem = [...Array(81).keys()];
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }
  let tiradas = 0;
  let nivel = 0;
  // nos níveis altos, o tabuleiro é conferido desde cedo: a casa que o leva além do pedido (ou ao chute) volta, e tenta-se outra
  const conferirDesde = pedido.de >= NIVEL_PARES ? 40 : pedido.vazias;
  for (const i of ordem) {
    yield;
    const guardado = enigma[i];
    enigma[i] = 0;
    if (tiradas + 1 < conferirDesde) {
      if (contarSolucoes([...enigma], 2, x) !== 1) enigma[i] = guardado;
      else tiradas++;
      continue;
    }
    // daqui em diante o RESOLVEDOR decide, e ele já prova a solução única: o que sai só por dedução tem uma solução só, e o que
    // tem mais de uma pede chute (e volta). A busca que conta soluções, no Sudoku X com o tabuleiro vazio, chegava a 100 ms.
    const n = nivelDoTabuleiro(enigma, x);
    if (n > pedido.ate) {
      enigma[i] = guardado;
      continue;
    }
    tiradas++;
    nivel = n;
    if (nivel >= pedido.de && tiradas >= pedido.vazias) break;
  }
  if (!nivel) nivel = nivelDoTabuleiro(enigma, x);
  return { enigma, solucao, nivel };
}

/** O quanto um gerado fica longe do pedido (0 = acertou; o que pede chute fica sempre por último). */
export function distancia(g: Gerado, pedido: Pedido): number {
  if (g.nivel === NIVEL_CHUTE) return 100;
  if (g.nivel < pedido.de) return pedido.de - g.nivel;
  if (g.nivel > pedido.ate) return 10 + g.nivel - pedido.ate;
  return 0;
}

/**
 * Gera pelo PEDIDO, tentando até `prazoMs` (o relógio do servidor) ou `tentativas`; fica com o mais perto. Nunca devolve um que
 * pede chute se houver outro.
 */
export function gerarPelaTecnica(pedido: Pedido, { x = false, aleatorio = Math.random, prazoMs = 200, tentativas = 400, agora = () => performance.now() } = {}): Gerado {
  const fim = agora() + prazoMs;
  let melhor: Gerado | null = null;
  for (let k = 0; k < tentativas; k++) {
    const g = tentativa(aleatorio, pedido, x);
    if (!melhor || distancia(g, pedido) < distancia(melhor, pedido)) melhor = g;
    if (distancia(melhor, pedido) === 0 || agora() > fim) break;
  }
  return melhor!;
}

/**
 * A RESERVA (medido em 20/11/2026, neste computador): o "Fácil" e o "Médio" saem na hora (1 a 2 ms), o "Difícil" em ~20 ms
 * (pior ~65), mas o tabuleiro que PEDE o X-wing é raro: ~1 em 150 tentativas no clássico (~0,7 s de processador, pior 2 s) e
 * ~1 em 50 no X (~0,2 s, pior 0,5). Gerar isso na hora seguraria o servidor inteiro (os jogos de tempo real dividem o processo).
 * Então o Difícil e o Muito difícil saem de uma RESERVA na memória (2 de cada, clássico e X), enchida aos poucos em segundo
 * plano (fatias de ~8 ms com uma folga igual entre elas; cada passo da tentativa leva menos de 3 ms; a reserva inteira enche em
 * ~7 s) e reposta quando alguém tira. Reserva vazia (o servidor acabou de subir, ou muita gente seguida): gera na hora com prazo
 * de 150 ms e fica com o mais perto do pedido (no Muito difícil clássico, quase sempre um que pede pares).
 */
export const NA_RESERVA = 2;
const FATIA_MS = 8;
const reserva = new Map<string, Gerado[]>();
const chaveDaReserva = (pedido: Pedido, x: boolean) => `${pedido.de}:${x ? 'x' : ''}`;
const DA_RESERVA: Pedido[] = [PEDIDO.dificil, PEDIDO.extremo];
let enchendo = false;

/** Tira um tabuleiro pronto da reserva (e manda repor), ou null. */
export function daReserva(pedido: Pedido, x: boolean): Gerado | null {
  const lista = reserva.get(chaveDaReserva(pedido, x));
  const g = lista?.shift() ?? null;
  encherReserva();
  return g;
}

/** Começa a encher a reserva em segundo plano, se ainda não está enchendo. Não segura o processo aberto. */
export function encherReserva(aleatorio = Math.random): void {
  if (enchendo) return;
  enchendo = true;
  let atual: { pedido: Pedido; x: boolean; passos: Generator<void, Gerado, void> } | null = null;
  const fatia = () => {
    const fim = performance.now() + FATIA_MS;
    while (performance.now() < fim) {
      if (!atual) {
        const falta = DA_RESERVA.flatMap((pedido) => [false, true].map((x) => ({ pedido, x }))).find(
          ({ pedido, x }) => (reserva.get(chaveDaReserva(pedido, x))?.length ?? 0) < NA_RESERVA,
        );
        if (!falta) {
          enchendo = false;
          return;
        }
        atual = { ...falta, passos: tentativaAosPoucos(aleatorio, falta.pedido, falta.x) };
      }
      const r = atual.passos.next();
      if (!r.done) continue;
      if (distancia(r.value, atual.pedido) === 0) {
        const chave = chaveDaReserva(atual.pedido, atual.x);
        reserva.set(chave, [...(reserva.get(chave) ?? []), r.value]);
      }
      atual = null;
    }
    // uma folga entre as fatias: o processo fica com metade do tempo livre para o resto
    setTimeout(fatia, FATIA_MS).unref();
  };
  setImmediate(fatia).unref();
}

/** Para o teste: quantos há na reserva. */
export const tamanhoDaReserva = (pedido: Pedido, x: boolean) => reserva.get(chaveDaReserva(pedido, x))?.length ?? 0;
