// O FILTRO GUIADO (He, Sun e Tang, "Guided Image Filtering", 2010; a versão rápida, He e Sun 2015), em JavaScript, com a MESMA
// conta que web/src/fundoDaCamera.ts faz na placa: a máscara pequena do modelo ganha a borda do quadro da câmera em resolução
// cheia. É aqui que a medida (medir.mjs, medir-video.mjs) o roda, para comparar antes e depois sem abrir o app.
//
// A conta, num quadro reduzido de `largura` (a "rápida": os coeficientes são lisos, então calculá-los pequenos e ampliar dá quase
// o mesmo, e custa uma fração):
//   I = o brilho da câmera, p = a máscara ampliada; médias numa janela de raio r: mI, mp, mIp, mII
//   a = (mIp − mI·mp) / (mII − mI² + eps),  b = mp − a·mI;  as médias de a e b na mesma janela
//   saída, no quadro cheio: q = A·I + B, com A e B ampliados (bilinear)
// Onde a câmera tem uma borda (o cabelo contra a parede), a ≠ 0 e a máscara segue a borda da imagem; onde a imagem é lisa,
// a ≈ 0 e fica a máscara do modelo. O `eps` diz quão forte uma borda tem de ser para mandar.

/** Os parâmetros escolhidos pela medida de 17/11/2026 (README, "O filtro guiado"). Mudou aqui, mude em fundoDaCamera.ts. */
export const GUIADO = { largura: 320, raio: 4, eps: 0.004 };
// para a varredura dos parâmetros (README): GUIADO_LARGURA, GUIADO_RAIO e GUIADO_EPS trocam os de cima
if (process.env.GUIADO_LARGURA) GUIADO.largura = Number(process.env.GUIADO_LARGURA);
if (process.env.GUIADO_RAIO) GUIADO.raio = Number(process.env.GUIADO_RAIO);
if (process.env.GUIADO_EPS) GUIADO.eps = Number(process.env.GUIADO_EPS);

const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

/** Média numa janela (2r+1)², separável, com a borda repetida (como o CLAMP_TO_EDGE da placa). */
function caixa(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += src[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = s / n;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      out[y * w + x] = s / n;
    }
  return out;
}

/** Amostra bilinear (centro do pixel) de uma imagem w × h no ponto (fx, fy) em pixels dela. */
function bilinear(img, w, h, fx, fy) {
  fx = Math.min(w - 1, Math.max(0, fx));
  fy = Math.min(h - 1, Math.max(0, fy));
  const x0 = Math.min(w - 2, fx | 0), y0 = Math.min(h - 2, fy | 0), ax = fx - x0, ay = fy - y0;
  const q = (yy, xx) => img[yy * w + xx];
  return (q(y0, x0) * (1 - ax) + q(y0, x0 + 1) * ax) * (1 - ay) + (q(y0 + 1, x0) * (1 - ax) + q(y0 + 1, x0 + 1) * ax) * ay;
}

/**
 * @param {Uint8Array} quadro o quadro da câmera, L × A, `canais` bytes por pixel (3 = RGB, 4 = RGBA)
 * @param {Float32Array} mascara a máscara do modelo (0 a 1), mw × mh
 * @returns {Float32Array} a máscara refinada, L × A, de 0 a 1
 */
export function filtroGuiado(quadro, L, A, canais, mascara, mw, mh, { largura = GUIADO.largura, raio = GUIADO.raio, eps = GUIADO.eps } = {}) {
  const w = Math.min(L, largura), h = Math.max(1, Math.round((A * w) / L));
  const n = w * h;
  const I = new Float32Array(n), p = new Float32Array(n), Ip = new Float32Array(n), II = new Float32Array(n);
  // o brilho no quadro pequeno: a média da área que cada pixel pequeno cobre (a placa faz o mesmo com a redução em degraus)
  const sx = L / w, sy = A / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, c = 0;
      for (let yy = Math.floor(y * sy); yy < Math.floor((y + 1) * sy); yy++)
        for (let xx = Math.floor(x * sx); xx < Math.floor((x + 1) * sx); xx++) {
          const o = (yy * L + xx) * canais;
          s += lum(quadro[o], quadro[o + 1], quadro[o + 2]);
          c++;
        }
      const i = y * w + x, v = s / c;
      const m = bilinear(mascara, mw, mh, ((x + 0.5) * mw) / w - 0.5, ((y + 0.5) * mh) / h - 0.5);
      I[i] = v;
      p[i] = m;
      Ip[i] = v * m;
      II[i] = v * v;
    }
  const mI = caixa(I, w, h, raio), mp = caixa(p, w, h, raio), mIp = caixa(Ip, w, h, raio), mII = caixa(II, w, h, raio);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = (mIp[i] - mI[i] * mp[i]) / (mII[i] - mI[i] * mI[i] + eps);
    b[i] = mp[i] - a[i] * mI[i];
  }
  const ma = caixa(a, w, h, raio), mb = caixa(b, w, h, raio);
  const q = new Float32Array(L * A);
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++) {
      const fx = ((x + 0.5) * w) / L - 0.5, fy = ((y + 0.5) * h) / A - 0.5;
      const o = (y * L + x) * canais;
      const v = bilinear(ma, w, h, fx, fy) * lum(quadro[o], quadro[o + 1], quadro[o + 2]) + bilinear(mb, w, h, fx, fy);
      q[y * L + x] = Math.min(1, Math.max(0, v));
    }
  return q;
}
