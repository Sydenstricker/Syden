/**
 * HORTA EM CASCATA: A SIMULAÇÃO (03/11/2026). Um quebra-cabeça de trocar e combinar com a pilha subindo, no espírito dos
 * jogos de versus de 16 bits — SÓ A MECÂNICA: trocar duas peças vizinhas na horizontal, três ou mais iguais em linha ou em
 * coluna somem, o que está em cima cai, e o que cai e combina de novo é uma CADEIA. Não tem peça caindo do alto nem poço
 * de 10 × 20: a pilha sobe de baixo, numa grade de 6 × 12.
 *
 * ESTE ARQUIVO EXISTE DUAS VEZES, IGUAL BYTE A BYTE: server/src/blocos-sim.ts e web/src/blocos/sim.ts. O site joga com
 * ele, e o servidor refaz a partida com ele, a partir da MESMA semente e das jogadas que o site mandou (minijogo-blocos.ts):
 * é assim que o servidor sabe os pontos, as cadeias, os caixotes que vão para os outros e quando a pilha chegou ao topo,
 * sem acreditar no que o site diz. web/test/blocos.test.ts confere que as duas cópias são iguais. Por isso ele não importa
 * nada, e tudo é inteiro: o mesmo passo dá o mesmo resultado em qualquer computador.
 *
 * O TEMPO É O PASSO: 60 por segundo, como na corrida. As entradas (a troca, o "subir", o caixote que chega) têm o passo em
 * que valem, e o resto é a regra.
 */

export const COLUNAS = 6;
export const LINHAS = 12;
/** Os legumes: 0 cenoura, 1 repolho, 2 tomate, 3 berinjela, 4 milho, 5 nabo. */
export const TIPOS = 6;
export const VAZIO = -1;
/** O caixote (o "lixo" que os outros mandam): não combina; vira legume quando algo some do lado dele. */
export const CAIXA = 6;

export const PASSOS_POR_SEGUNDO = 60;
/** Quanto a pilha sobe até entrar uma linha nova (uma unidade é um pixel da peça de 16). */
export const UNIDADES_POR_LINHA = 16;
/** O brilho de quem combinou, antes de sumir. */
export const LIMPAR_PASSOS = 45;
/** O caixote que vira legume leva um pouco mais. */
export const VIRAR_PASSOS = 60;
/** O que perdeu o apoio fica um instante no ar antes de cair. */
export const FLUTUAR_PASSOS = 10;
/** Caindo, uma casa a cada tantos passos. */
export const QUEDA_PASSOS = 2;
/** Com a pilha no teto, quanto ela aguenta antes de acabar (2 s). */
export const GRACA_PASSOS = 120;
/** O máximo de jogadas num segundo (de passos): mais que isso não é mão de gente. */
export const MAX_JOGADAS_POR_SEGUNDO = 20;
/** O contra o relógio do Solo. */
export const DOIS_MINUTOS = 2 * 60 * PASSOS_POR_SEGUNDO;
/** O caixote maior: 6 de largura, 4 de altura. */
export const MAX_ALTURA_DO_LIXO = 4;

/** O estado de cada casa. */
export const PARADO = 0;
export const CAINDO = 1;
export const LIMPANDO = 2;
export const VIRANDO = 3;

/** Uma jogada: [passo, tipo (0 trocar, 1 subir a pilha), linha, coluna]. A troca é da casa (linha, coluna) com a da direita. */
export type Jogada = [number, number, number, number];
/** Um caixote que chega, no passo dito pelo servidor. */
export interface Lixo {
  id: number;
  n: number;
  largura: number;
  altura: number;
}
/** O que um passo mandou para os outros. */
export interface Ataque {
  largura: number;
  altura: number;
}
export interface ResultadoDoPasso {
  ataques: Ataque[];
  /** A cadeia deste passo (2 ou mais), ou 0. */
  cadeia: number;
  /** Quantas peças combinaram neste passo. */
  combo: number;
  /** Entrou uma linha nova por baixo: tudo subiu uma casa. */
  linhaNova: boolean;
}

export interface Estado {
  semente: number;
  passo: number;
  /** Por casa (linha × COLUNAS + coluna; a linha 0 é a de cima). */
  tipo: number[];
  estado: number[];
  timer: number[];
  /** A marca da cadeia: a peça caiu porque algo sumiu embaixo dela. */
  cadeia: number[];
  /** A peça de caixote de cada casa (0: não é caixote): cada linha de caixote cai inteira. */
  peca: number[];
  pecas: number;
  /** Quanto a pilha já subiu desde a última linha (0 a UNIDADES_POR_LINHA - 1). */
  subida: number;
  /** O "subir" apertado: a pilha sobe depressa até a próxima linha. */
  forcando: boolean;
  /** Depois de uma combinação boa, a pilha para um pouco. */
  parada: number;
  /** Passos com a pilha no teto. */
  perigo: number;
  cadeiaAtual: number;
  maiorCadeia: number;
  pontos: number;
  /** Quantas linhas o gerador já fez (é por ela que ele sorteia). */
  linhasGeradas: number;
  /** A linha que vem por baixo (aparece apagada). */
  proxima: number[];
  /** As duas últimas linhas geradas: a nova não forma trio com elas na vertical. */
  acima: number[][];
  /** Os caixotes esperando lugar no alto. */
  fila: { largura: number; altura: number; c0: number }[];
  conversoes: number;
  lixosRecebidos: number;
  /** O passo em que acaba (0: sem fim). */
  limite: number;
  fim: null | 'topo' | 'tempo';
}

/** O sorteio: um número de 32 bits que depende só da semente e de k (o mesmo em qualquer computador). */
export function sorteio(semente: number, k: number): number {
  let h = (semente ^ Math.imul(k + 0x6d2b79f5, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** A próxima linha do gerador: sem trio na horizontal, nem na vertical com as duas de cima. */
function gerarLinha(e: Estado): number[] {
  const k = e.linhasGeradas++;
  const [a, b] = e.acima;
  const linha: number[] = [];
  for (let c = 0; c < COLUNAS; c++) {
    let t = sorteio(e.semente, k * 8 + c) % TIPOS;
    for (let i = 0; i < TIPOS; i++) {
      const horizontal = c >= 2 && linha[c - 1] === t && linha[c - 2] === t;
      const vertical = a !== undefined && b !== undefined && a[c] === t && b[c] === t;
      if (!horizontal && !vertical) break;
      t = (t + 1) % TIPOS;
    }
    linha.push(t);
  }
  e.acima = a === undefined ? [linha] : [linha, a];
  return linha;
}

/** A partida nova: seis linhas de pilha, com as colunas de alturas diferentes. `limite` em passos (0: sem fim). */
export function criar(semente: number, limite = 0): Estado {
  const n = LINHAS * COLUNAS;
  const e: Estado = {
    semente: semente >>> 0,
    passo: 0,
    tipo: new Array(n).fill(VAZIO),
    estado: new Array(n).fill(PARADO),
    timer: new Array(n).fill(0),
    cadeia: new Array(n).fill(0),
    peca: new Array(n).fill(0),
    pecas: 0,
    subida: 0,
    forcando: false,
    parada: 0,
    perigo: 0,
    cadeiaAtual: 1,
    maiorCadeia: 1,
    pontos: 0,
    linhasGeradas: 0,
    proxima: [],
    acima: [],
    fila: [],
    conversoes: 0,
    lixosRecebidos: 0,
    limite,
    fim: null,
  };
  for (let r = LINHAS - 6; r < LINHAS; r++) {
    const linha = gerarLinha(e);
    for (let c = 0; c < COLUNAS; c++) e.tipo[r * COLUNAS + c] = linha[c];
  }
  // tira de 0 a 2 peças do alto de cada coluna (de cima para baixo: nada fica no ar)
  for (let c = 0; c < COLUNAS; c++) {
    const tirar = sorteio(e.semente, 900 + c) % 3;
    for (let r = LINHAS - 6; r < LINHAS - 6 + tirar; r++) e.tipo[r * COLUNAS + c] = VAZIO;
  }
  e.proxima = gerarLinha(e);
  return e;
}

/** Os passos por unidade de subida: começa devagar e acelera a cada 30 s. */
export function intervaloDaSubida(passo: number): number {
  return Math.max(2, 18 - 2 * Math.floor(passo / (30 * PASSOS_POR_SEGUNDO)));
}

/** Os pontos de uma combinação: 10 por peça, mais o combo (4 ou mais) e a cadeia. */
export function bonusDoCombo(n: number): number {
  return n >= 4 ? 30 + (n - 4) * 20 : 0;
}
const BONUS_DA_CADEIA = [0, 0, 50, 80, 150, 300, 400, 500, 700, 900, 1100, 1300];
export function bonusDaCadeia(c: number): number {
  return c < BONUS_DA_CADEIA.length ? BONUS_DA_CADEIA[c] : 1300 + (c - 11) * 200;
}

/** Os caixotes que uma combinação manda: o combo, um caixote mais estreito; a cadeia, linhas inteiras. */
export function ataquesDe(combo: number, cadeia: number): Ataque[] {
  const ataques: Ataque[] = [];
  if (cadeia >= 2) ataques.push({ largura: COLUNAS, altura: Math.min(MAX_ALTURA_DO_LIXO, cadeia - 1) });
  if (combo >= 4) {
    if (combo <= 7) ataques.push({ largura: combo - 1, altura: 1 });
    else ataques.push({ largura: COLUNAS, altura: Math.min(MAX_ALTURA_DO_LIXO, 1 + Math.floor((combo - 8) / 4)) });
  }
  return ataques;
}

/** Uma jogada bem formada (os números, não se ela faz sentido no tabuleiro: isso a regra decide). */
export function jogadaValida(j: unknown): j is Jogada {
  if (!Array.isArray(j) || j.length !== 4 || !j.every((v) => Number.isInteger(v))) return false;
  const [n, t, l, c] = j as number[];
  return n >= 0 && (t === 0 || t === 1) && l >= 0 && l < LINHAS && c >= 0 && c < COLUNAS - 1;
}

/** Cabe mais uma jogada no passo n, sem passar de MAX_JOGADAS_POR_SEGUNDO no último segundo? (`jogadas` em ordem.) */
export function cabeNoRitmo(jogadas: readonly Jogada[], n: number): boolean {
  let conta = 0;
  for (let i = jogadas.length - 1; i >= 0 && jogadas[i][0] > n - PASSOS_POR_SEGUNDO; i--) conta++;
  return conta < MAX_JOGADAS_POR_SEGUNDO;
}

/** Entre uma troca e a seguinte, no mínimo tantos passos (15 por segundo: mais que isso não é mão de gente). */
export const INTERVALO_DA_TROCA = 4;

/** Uma troca no passo n respeita o intervalo desde a troca anterior? (`jogadas` em ordem.) */
export function trocaNoIntervalo(jogadas: readonly Jogada[], n: number): boolean {
  for (let i = jogadas.length - 1; i >= 0 && jogadas[i][0] > n - INTERVALO_DA_TROCA; i--) if (jogadas[i][1] === 0) return false;
  return true;
}

/** O "subir" faria alguma coisa agora? (Não, se já está subindo, se algo some ou vira, ou se a pilha está no teto.) */
export function subirFazEfeito(e: Estado): boolean {
  if (e.forcando || e.fim) return false;
  let topo = false;
  for (let i = 0; i < e.tipo.length; i++) {
    if (e.estado[i] === LIMPANDO || e.estado[i] === VIRANDO) return false;
    if (i < COLUNAS && e.tipo[i] !== VAZIO) topo = true;
  }
  return !(topo && e.subida >= UNIDADES_POR_LINHA - 1);
}

/** A troca é possível agora? (As duas casas paradas ou vazias, sem caixote, e não as duas vazias.) */
export function podeTrocar(e: Estado, l: number, c: number): boolean {
  if (l < 0 || l >= LINHAS || c < 0 || c >= COLUNAS - 1) return false;
  const i = l * COLUNAS + c;
  const livre = (k: number) => e.tipo[k] === VAZIO || (e.estado[k] === PARADO && e.tipo[k] !== CAIXA);
  if (!livre(i) || !livre(i + 1)) return false;
  if (e.tipo[i] === VAZIO && e.tipo[i + 1] === VAZIO) return false;
  // o que está caindo logo acima de uma casa vazia vai ocupá-la: não se troca por baixo dele
  for (const k of [i, i + 1]) if (e.tipo[k] === VAZIO && l > 0 && e.estado[k - COLUNAS] === CAINDO && e.tipo[k - COLUNAS] !== VAZIO) return false;
  return true;
}

const mover = (e: Estado, de: number, para: number) => {
  e.tipo[para] = e.tipo[de];
  e.estado[para] = e.estado[de];
  e.timer[para] = e.timer[de];
  e.cadeia[para] = e.cadeia[de];
  e.peca[para] = e.peca[de];
  e.tipo[de] = VAZIO;
  e.estado[de] = PARADO;
  e.timer[de] = 0;
  e.cadeia[de] = 0;
  e.peca[de] = 0;
};

const NADA: readonly never[] = [];

/** Um passo da regra. As jogadas e os caixotes são os deste passo. */
export function passo(e: Estado, jogadas: readonly Jogada[] = NADA, lixos: readonly Lixo[] = NADA): ResultadoDoPasso {
  const r: ResultadoDoPasso = { ataques: [], cadeia: 0, combo: 0, linhaNova: false };
  if (e.fim) return r;
  const C = COLUNAS;

  // 1. AS ENTRADAS
  for (const [, t, l, c] of jogadas) {
    if (t === 1) {
      if (!e.forcando) e.forcando = true;
      continue;
    }
    if (!podeTrocar(e, l, c)) continue;
    const i = l * C + c;
    const j = i + 1;
    [e.tipo[i], e.tipo[j]] = [e.tipo[j], e.tipo[i]];
    e.estado[i] = e.estado[j] = PARADO;
    e.timer[i] = e.timer[j] = 0;
    e.cadeia[i] = e.cadeia[j] = 0;
  }
  for (const x of lixos) {
    const largura = Math.max(1, Math.min(C, Math.floor(x.largura)));
    const altura = Math.max(1, Math.min(MAX_ALTURA_DO_LIXO, Math.floor(x.altura)));
    e.fila.push({ largura, altura, c0: e.lixosRecebidos++ % 2 === 0 ? 0 : C - largura });
  }

  // 2. OS RELÓGIOS: o que brilhava some (e marca a cadeia no que estava em cima); o caixote vira legume
  const sumiram: number[] = [];
  for (let i = 0; i < e.tipo.length; i++) {
    if (e.estado[i] === LIMPANDO) {
      if (--e.timer[i] <= 0) sumiram.push(i);
    } else if (e.estado[i] === VIRANDO) {
      if (--e.timer[i] <= 0) {
        e.tipo[i] = sorteio(e.semente, 1_000_000 + e.conversoes++) % TIPOS;
        e.estado[i] = PARADO;
        e.timer[i] = 0;
        e.cadeia[i] = 1;
        e.peca[i] = 0;
      }
    }
  }
  for (const i of sumiram) {
    e.tipo[i] = VAZIO;
    e.estado[i] = PARADO;
    e.timer[i] = 0;
    e.cadeia[i] = 0;
    e.peca[i] = 0;
  }
  for (const i of sumiram) {
    for (let k = i - C; k >= 0 && e.tipo[k] !== VAZIO; k -= C) {
      if (e.estado[k] === PARADO || e.estado[k] === CAINDO) e.cadeia[k] = 1;
    }
  }

  // 3. O CAIXOTE QUE ESPERA entra no alto, uma linha por vez, quando há lugar
  const lixo = e.fila[0];
  if (lixo) {
    let cabe = true;
    for (let c = lixo.c0; c < lixo.c0 + lixo.largura; c++) if (e.tipo[c] !== VAZIO) cabe = false;
    if (cabe) {
      const p = ++e.pecas;
      for (let c = lixo.c0; c < lixo.c0 + lixo.largura; c++) {
        e.tipo[c] = CAIXA;
        e.estado[c] = PARADO;
        e.timer[c] = 0;
        e.cadeia[c] = 0;
        e.peca[c] = p;
      }
      if (--lixo.altura <= 0) e.fila.shift();
    }
  }

  // 4. A GRAVIDADE, de baixo para cima, linha por linha: quem perdeu o apoio flutua um instante e cai, junto com o que está
  // em cima. Cada linha de caixote é uma peça só: ela fica de pé se qualquer casa dela tem apoio, e cai inteira.
  const apoio = new Array<boolean>(LINHAS * C).fill(false);
  for (let l = LINHAS - 1; l >= 0; l--) {
    const base = l * C;
    for (let c = 0; c < C; c++) apoio[base + c] = e.tipo[base + c] !== VAZIO && (l === LINHAS - 1 || apoio[base + c + C]);
    for (let c = 0; c < C; c++) {
      const p = e.peca[base + c];
      if (!p || !apoio[base + c]) continue;
      for (let k = 0; k < C; k++) if (e.peca[base + k] === p) apoio[base + k] = true;
    }
    for (let c = 0; c < C; c++) {
      const i = base + c;
      if (e.tipo[i] === VAZIO) continue;
      if (apoio[i]) {
        if (e.estado[i] === CAINDO) {
          e.estado[i] = PARADO;
          e.timer[i] = 0;
        }
      } else if (e.estado[i] === PARADO) {
        e.estado[i] = CAINDO;
        e.timer[i] = FLUTUAR_PASSOS;
      } else if (e.estado[i] === CAINDO && e.timer[i] > 0) {
        e.timer[i]--;
      }
    }
    if (l === LINHAS - 1) continue;
    for (let c = 0; c < C; c++) {
      const i = base + c;
      if (e.tipo[i] === VAZIO || e.estado[i] !== CAINDO || e.timer[i] > 0) continue;
      const p = e.peca[i];
      if (!p) {
        if (e.tipo[i + C] === VAZIO) {
          mover(e, i, i + C);
          e.timer[i + C] = QUEDA_PASSOS - 1;
        }
        continue;
      }
      // o caixote: só cai se a linha inteira dele tem onde cair
      const casas: number[] = [];
      for (let k = 0; k < C; k++) if (e.peca[base + k] === p) casas.push(base + k);
      if (casas[0] !== i) continue;
      if (!casas.every((k) => e.estado[k] === CAINDO && e.timer[k] === 0 && e.tipo[k + C] === VAZIO)) continue;
      for (const k of casas) {
        mover(e, k, k + C);
        e.timer[k + C] = QUEDA_PASSOS - 1;
      }
    }
  }

  // 5. AS COMBINAÇÕES: três ou mais iguais, paradas, em linha ou em coluna
  const marcadas = new Set<number>();
  const combina = (i: number) => e.estado[i] === PARADO && e.tipo[i] >= 0 && e.tipo[i] < TIPOS;
  for (let l = 0; l < LINHAS; l++) {
    for (let c = 0; c < C; ) {
      const i = l * C + c;
      let fim = c + 1;
      if (combina(i)) while (fim < C && combina(l * C + fim) && e.tipo[l * C + fim] === e.tipo[i]) fim++;
      if (combina(i) && fim - c >= 3) for (let k = c; k < fim; k++) marcadas.add(l * C + k);
      c = fim;
    }
  }
  for (let c = 0; c < C; c++) {
    for (let l = 0; l < LINHAS; ) {
      const i = l * C + c;
      let fim = l + 1;
      if (combina(i)) while (fim < LINHAS && combina(fim * C + c) && e.tipo[fim * C + c] === e.tipo[i]) fim++;
      if (combina(i) && fim - l >= 3) for (let k = l; k < fim; k++) marcadas.add(k * C + c);
      l = fim;
    }
  }
  if (marcadas.size > 0) {
    const n = marcadas.size;
    let ehCadeia = false;
    for (const i of marcadas) if (e.cadeia[i]) ehCadeia = true;
    if (ehCadeia) e.cadeiaAtual++;
    const cadeia = ehCadeia ? e.cadeiaAtual : 0;
    const ordem = [...marcadas].sort((a, b) => a - b);
    for (const i of ordem) {
      e.estado[i] = LIMPANDO;
      e.timer[i] = LIMPAR_PASSOS;
      e.cadeia[i] = 0;
    }
    // os caixotes encostados viram legume (todo o caixote encostado, de uma vez)
    const pilha: number[] = [];
    for (const i of ordem) {
      const l = Math.floor(i / C);
      const c = i % C;
      if (l > 0) pilha.push(i - C);
      if (l < LINHAS - 1) pilha.push(i + C);
      if (c > 0) pilha.push(i - 1);
      if (c < C - 1) pilha.push(i + 1);
    }
    while (pilha.length) {
      const k = pilha.pop()!;
      if (e.tipo[k] !== CAIXA || e.estado[k] !== PARADO) continue;
      e.estado[k] = VIRANDO;
      e.timer[k] = VIRAR_PASSOS;
      const l = Math.floor(k / C);
      const c = k % C;
      if (l > 0) pilha.push(k - C);
      if (l < LINHAS - 1) pilha.push(k + C);
      if (c > 0) pilha.push(k - 1);
      if (c < C - 1) pilha.push(k + 1);
    }
    e.pontos += n * 10 + bonusDoCombo(n) + (cadeia ? bonusDaCadeia(cadeia) : 0);
    if (cadeia > e.maiorCadeia) e.maiorCadeia = cadeia;
    if (n >= 4) e.parada = Math.max(e.parada, 30 + n * 4);
    if (cadeia) e.parada = Math.max(e.parada, 60 + 30 * cadeia);
    e.parada = Math.min(e.parada, 300);
    r.ataques = ataquesDe(n, cadeia);
    r.cadeia = cadeia;
    r.combo = n;
  }
  // a marca da cadeia vale só para a queda: quem parou e não combinou perde
  for (let i = 0; i < e.tipo.length; i++) if (e.cadeia[i] && e.estado[i] === PARADO && !marcadas.has(i)) e.cadeia[i] = 0;
  let ocupado = false;
  let marcada = false;
  for (let i = 0; i < e.tipo.length; i++) {
    if (e.estado[i] === LIMPANDO || e.estado[i] === VIRANDO) ocupado = true;
    if (e.cadeia[i]) marcada = true;
  }
  if (!ocupado && !marcada) e.cadeiaAtual = 1;

  // 6. A PILHA SOBE (parada enquanto algo some, e um pouco depois de uma combinação boa)
  let topo = false;
  for (let c = 0; c < C; c++) if (e.tipo[c] !== VAZIO) topo = true;
  if (!topo) e.perigo = 0;
  if (ocupado) {
    e.forcando = false;
  } else if (e.parada > 0 && !e.forcando) {
    e.parada--;
  } else if (topo && e.subida >= UNIDADES_POR_LINHA - 1) {
    // no teto: a pilha não sobe mais, e o relógio do perigo anda a cada passo
    e.forcando = false;
    if (++e.perigo >= GRACA_PASSOS) e.fim = 'topo';
  } else if (e.forcando || e.passo % intervaloDaSubida(e.passo) === 0) {
    if (e.forcando) e.parada = 0;
    if (e.subida < UNIDADES_POR_LINHA - 1) {
      e.subida++;
    } else {
      // tudo sobe uma casa, e a linha de baixo entra
      for (let i = 0; i < (LINHAS - 1) * C; i++) {
        e.tipo[i] = e.tipo[i + C];
        e.estado[i] = e.estado[i + C];
        e.timer[i] = e.timer[i + C];
        e.cadeia[i] = e.cadeia[i + C];
        e.peca[i] = e.peca[i + C];
      }
      for (let c = 0; c < C; c++) {
        const i = (LINHAS - 1) * C + c;
        e.tipo[i] = e.proxima[c];
        e.estado[i] = PARADO;
        e.timer[i] = 0;
        e.cadeia[i] = 0;
        e.peca[i] = 0;
      }
      e.proxima = gerarLinha(e);
      e.subida = 0;
      e.perigo = 0;
      e.forcando = false;
      r.linhaNova = true;
    }
  }

  e.passo++;
  if (e.limite > 0 && e.passo >= e.limite && !e.fim) e.fim = 'tempo';
  return r;
}

/** Uma partida com as entradas: as jogadas (em ordem de passo) e os caixotes (idem). */
export interface Simulacao {
  e: Estado;
  jogadas: Jogada[];
  lixos: Lixo[];
  /** Até onde as jogadas e os caixotes já foram lidos. */
  ij: number;
  il: number;
}

export function simulacao(semente: number, limite = 0): Simulacao {
  return { e: criar(semente, limite), jogadas: [], lixos: [], ij: 0, il: 0 };
}

/** Anda até o passo `ate` (ou até acabar), com as entradas que estão na simulação. */
export function avancar(s: Simulacao, ate: number, aoPasso?: (r: ResultadoDoPasso, n: number) => void): void {
  while (s.e.passo < ate && !s.e.fim) {
    const n = s.e.passo;
    while (s.ij < s.jogadas.length && s.jogadas[s.ij][0] < n) s.ij++;
    while (s.il < s.lixos.length && s.lixos[s.il].n < n) s.il++;
    let fimJ = s.ij;
    while (fimJ < s.jogadas.length && s.jogadas[fimJ][0] === n) fimJ++;
    let fimL = s.il;
    while (fimL < s.lixos.length && s.lixos[fimL].n === n) fimL++;
    const r = passo(s.e, fimJ > s.ij ? s.jogadas.slice(s.ij, fimJ) : NADA, fimL > s.il ? s.lixos.slice(s.il, fimL) : NADA);
    s.ij = fimJ;
    s.il = fimL;
    aoPasso?.(r, n);
  }
}

/** O tabuleiro em 72 letras, para os outros verem: '.' vazio, '0' a '5' os legumes, 'x' o caixote. */
export function retrato(e: Estado): string {
  let s = '';
  for (let i = 0; i < e.tipo.length; i++) s += e.tipo[i] === VAZIO ? '.' : e.tipo[i] === CAIXA ? 'x' : String(e.tipo[i]);
  return s;
}
