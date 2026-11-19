/**
 * O BALDE DO DESENHA E ADIVINHA (19/11/2026): pintar a área fechada onde se clicou, IGUAL EM TODAS AS TELAS.
 *
 * O quadro de cada um tem o tamanho da tela dele, e o navegador suaviza a borda dos traços de um jeito próprio: pintar pelos
 * pixels do canvas daria uma área diferente em cada computador (um vazamento numa tela, nenhum na outra). Por isso a área é
 * achada numa GRADE PRÓPRIA, de 500 × 375 casas (cada casa vale 2 × 2 da medida do quadro, 1000 × 750), em que os traços são
 * refeitos por esta conta, sem suavização, só com + − × ÷: o mesmo resultado em qualquer navegador. A área achada é que se
 * desenha por cima, ampliada.
 *
 * O balde viaja como um traço de UM ponto com a espessura BALDE (o servidor só confere isso), na mesma sequência dos outros:
 * o desfazer e o apagar tudo valem para ele como para um traço.
 */

export const GRADE_L = 500;
export const GRADE_A = 375;
/** Quantas unidades do quadro (1000 × 750) cabem numa casa da grade. */
const CASA = 2;
/** A "espessura" que marca o balde (a mesma de server/src/minijogo-desenho.ts). */
export const BALDE = 9;
/** A cor de fundo na grade: a do índice 1 (o branco, que é também a borracha). */
const FUNDO = 1;

export interface TracoDaGrade {
  t: number;
  c: number;
  e: number;
  /** Os pontos já emendados, na ordem (x, y, x, y…), na medida do quadro. */
  pontos: number[];
}

/** Carimba um disco de raio `r` (em casas) com centro em (cx, cy) (em casas). */
function carimbar(grade: Uint8Array, cx: number, cy: number, r: number, cor: number) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(GRADE_L - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(GRADE_A - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy <= r2) grade[y * GRADE_L + x] = cor;
    }
  }
}

/** Refaz um traço na grade: discos ao longo de cada segmento, de meio em meio raio. */
function riscar(grade: Uint8Array, traco: TracoDaGrade, espessuras: readonly number[]) {
  const r = Math.max(0.75, (espessuras[traco.e] ?? 8) / 2 / CASA);
  const p = traco.pontos;
  if (p.length < 2) return;
  if (p.length === 2) return carimbar(grade, p[0] / CASA, p[1] / CASA, r, traco.c);
  const passo = Math.max(0.5, r / 2);
  for (let k = 2; k < p.length; k += 2) {
    const ax = p[k - 2] / CASA;
    const ay = p[k - 1] / CASA;
    const bx = p[k] / CASA;
    const by = p[k + 1] / CASA;
    const dx = bx - ax;
    const dy = by - ay;
    const n = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / passo));
    for (let s = 0; s <= n; s++) carimbar(grade, ax + (dx * s) / n, ay + (dy * s) / n, r, traco.c);
  }
}

/** Pinta a área de mesma cor em volta de (x, y) (na medida do quadro): devolve as casas pintadas (1) ou null se nada mudou. */
export function encher(grade: Uint8Array, x: number, y: number, cor: number): Uint8Array | null {
  const gx = Math.min(GRADE_L - 1, Math.max(0, Math.floor(x / CASA)));
  const gy = Math.min(GRADE_A - 1, Math.max(0, Math.floor(y / CASA)));
  const alvo = grade[gy * GRADE_L + gx];
  if (alvo === cor) return null;
  const mascara = new Uint8Array(GRADE_L * GRADE_A);
  const fila = new Int32Array(GRADE_L * GRADE_A);
  let ini = 0;
  let fim = 0;
  fila[fim++] = gy * GRADE_L + gx;
  mascara[gy * GRADE_L + gx] = 1;
  while (ini < fim) {
    const i = fila[ini++];
    grade[i] = cor;
    const cx = i % GRADE_L;
    const vizinhos = [cx > 0 ? i - 1 : -1, cx < GRADE_L - 1 ? i + 1 : -1, i >= GRADE_L ? i - GRADE_L : -1, i + GRADE_L < grade.length ? i + GRADE_L : -1];
    for (const v of vizinhos) {
      if (v < 0 || mascara[v] || grade[v] !== alvo) continue;
      mascara[v] = 1;
      fila[fim++] = v;
    }
  }
  return mascara;
}

/**
 * As áreas de cada balde, em ordem: refaz todos os traços na grade e enche onde cada balde caiu. Devolve, por traço de balde
 * (o `t`), a máscara das casas pintadas.
 */
export function areasDosBaldes(tracos: TracoDaGrade[], espessuras: readonly number[]): Map<number, Uint8Array> {
  const grade = new Uint8Array(GRADE_L * GRADE_A).fill(FUNDO);
  const areas = new Map<number, Uint8Array>();
  for (const traco of [...tracos].sort((a, b) => a.t - b.t)) {
    if (traco.e === BALDE) {
      if (traco.pontos.length < 2) continue;
      const area = encher(grade, traco.pontos[0], traco.pontos[1], traco.c);
      if (area) areas.set(traco.t, area);
    } else riscar(grade, traco, espessuras);
  }
  return areas;
}

/** A máscara numa imagem pequena (a grade), com a cor dada: o quadro a desenha ampliada, sem suavizar. */
export function imagemDaArea(area: Uint8Array, hex: string): HTMLCanvasElement {
  const tela = document.createElement('canvas');
  tela.width = GRADE_L;
  tela.height = GRADE_A;
  const ctx = tela.getContext('2d');
  if (!ctx) return tela;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const imagem = ctx.createImageData(GRADE_L, GRADE_A);
  for (let i = 0; i < area.length; i++) {
    if (!area[i]) continue;
    imagem.data[i * 4] = r;
    imagem.data[i * 4 + 1] = g;
    imagem.data[i * 4 + 2] = b;
    imagem.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imagem, 0, 0);
  return tela;
}
