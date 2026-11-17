// A QUALIDADE DA BORDA sem gabarito (17/11/2026; ver README, "O filtro guiado"). Não há máscara "certa" das fotos nem dos vídeos,
// então a borda é julgada contra a PRÓPRIA imagem, em três números, todos na faixa de transição (alfa entre 0,05 e 0,95):
//
// - FRANJA: quanto do que a máscara deixa aparecer na faixa é, na verdade, fundo. Cada pixel da faixa é comparado com a cor do
//   fundo e a da pessoa ali perto (as médias, num raio de 12 px, dos pixels com alfa < 0,02 e > 0,98); o que se parece mais com
//   o fundo e entra com alfa, entra na franja. É a "franja clara em volta do cabelo" do relato: a parede vazando pela borda.
// - CORTE: o contrário, o quanto da pessoa a máscara joga fora na faixa (o que se parece com a pessoa e sai com 1 − alfa).
// - LARGURA: a espessura da faixa, em px do quadro (a área dela pelo comprimento do contorno). Borda macia, larga; nítida, fina.
//
// Os três são proxies: um pixel de cabelo fino SOBRE a parede tem de ficar meio transparente, e conta um pouco nos dois lados.
// Servem para comparar modelos e filtros na mesma foto, não como nota absoluta.

const R = 12;

function caixa(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, k))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s;
      s += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * @param {Uint8Array} quadro L × A, `canais` bytes por pixel
 * @param {Float32Array} alfa L × A, de 0 a 1
 */
export function qualidadeDaBorda(quadro, L, A, canais, alfa) {
  const n = L * A;
  const fundo = new Float32Array(n), pessoa = new Float32Array(n);
  const cf = [0, 1, 2].map(() => new Float32Array(n)), cp = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const f = alfa[i] < 0.02 ? 1 : 0, p = alfa[i] > 0.98 ? 1 : 0;
    fundo[i] = f;
    pessoa[i] = p;
    for (let k = 0; k < 3; k++) {
      cf[k][i] = f * quadro[i * canais + k];
      cp[k][i] = p * quadro[i * canais + k];
    }
  }
  const nf = caixa(fundo, L, A, R), np = caixa(pessoa, L, A, R);
  const mf = cf.map((c) => caixa(c, L, A, R)), mp = cp.map((c) => caixa(c, L, A, R));
  let franja = 0, somaA = 0, corte = 0, soma1A = 0, faixa = 0;
  for (let i = 0; i < n; i++) {
    const a = alfa[i];
    if (a <= 0.05 || a >= 0.95) continue;
    faixa++;
    if (nf[i] < 1 || np[i] < 1) continue; // sem fundo ou sem pessoa por perto, não há com o que comparar
    let df = 0, dp = 0;
    for (let k = 0; k < 3; k++) {
      const c = quadro[i * canais + k];
      df += (c - mf[k][i] / nf[i]) ** 2;
      dp += (c - mp[k][i] / np[i]) ** 2;
    }
    const pareceFundo = df < dp ? 1 : 0;
    franja += a * pareceFundo;
    somaA += a;
    corte += (1 - a) * (1 - pareceFundo);
    soma1A += 1 - a;
  }
  // o comprimento do contorno: pixels com alfa > 0,5 que têm vizinho ≤ 0,5
  let contorno = 0;
  for (let y = 1; y < A - 1; y++)
    for (let x = 1; x < L - 1; x++) {
      const i = y * L + x, v = alfa[i] > 0.5;
      if (v && (alfa[i - 1] <= 0.5 || alfa[i + 1] <= 0.5 || alfa[i - L] <= 0.5 || alfa[i + L] <= 0.5)) contorno++;
    }
  return { franja: somaA ? franja / somaA : 0, corte: soma1A ? corte / soma1A : 0, largura: contorno ? faixa / contorno : 0 };
}

/** A máscara do modelo (mw × mh) ampliada ao quadro L × A, bilinear: o que a página faz sem o filtro guiado. */
export function ampliar(m, mw, mh, L, A) {
  const r = new Float32Array(L * A);
  for (let y = 0; y < A; y++) {
    const fy = Math.min(mh - 1.001, Math.max(0, ((y + 0.5) * mh) / A - 0.5)), y0 = fy | 0, ay = fy - y0;
    for (let x = 0; x < L; x++) {
      const fx = Math.min(mw - 1.001, Math.max(0, ((x + 0.5) * mw) / L - 0.5)), x0 = fx | 0, ax = fx - x0;
      const q = (yy, xx) => m[yy * mw + xx];
      r[y * L + x] = (q(y0, x0) * (1 - ax) + q(y0, x0 + 1) * ax) * (1 - ay) + (q(y0 + 1, x0) * (1 - ax) + q(y0 + 1, x0 + 1) * ax) * ay;
    }
  }
  return r;
}
