// O REALCE DO ESCURO (17/11/2026; ver README, "Mais candidatos"): a pergunta é se o Completo se perde no quarto escuro por
// culpa do MODELO ou da imagem que chega a ele. Aqui o quadro é clareado SÓ NA ENTRADA DO MODELO (a imagem que a pessoa vê não
// muda), e a medida compara a máscara com e sem isso. Um modelo da lista com `realce: '<tipo>'` passa por aqui antes do preparo.
//
// - 'inverso': desfaz exatamente o escurecer da medida (gama 1,8 até 90 de 255). É o teto, o "oráculo": no app não se sabe a
//   conta do escuro de ninguém. O ruído fica (e é ampliado junto).
// - 'auto': o que o app poderia fazer: estica o brilho entre os percentis 1 e 99 do quadro até 0–255 e escolhe a gama que leva o
//   brilho médio a ~0,45 (só clareia: gama entre 0,35 e 1). Um quadro claro quase não muda.
// - 'auto-suave': o 'auto' depois de uma média 3 × 3 (o ruído de quem sobe o ganho no escuro é o que mais engana o modelo).
// - 'temporal' e 'temporal-auto': a média dos quadros no tempo (α 0,75 por pixel, como o filtro de ruído de uma webcam), e
//   o 'auto' depois. Guarda o quadro anterior: só serve para vídeo (medir-video.mjs), e recomeça quando a cena muda inteira.
// O quadro é RGB ou RGBA (`canais`), L × A; devolve uma cópia.
const anteriores = new Map(); // por tipo: dois modelos medidos juntos não dividem a média

function caixa3(q, L, A, canais) {
  const r = new Uint8Array(q.length);
  for (let y = 0; y < A; y++)
    for (let x = 0; x < L; x++)
      for (let k = 0; k < canais; k++) {
        if (k === 3) {
          r[(y * L + x) * canais + 3] = 255;
          continue;
        }
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= A) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= L) continue;
            s += q[(yy * L + xx) * canais + k];
            n++;
          }
        }
        r[(y * L + x) * canais + k] = s / n;
      }
  return r;
}

export function realcar(q, L, A, canais, tipo) {
  if (!tipo) return q;
  if (tipo === 'inverso') {
    const tab = Uint8Array.from({ length: 256 }, (_, v) => Math.min(255, Math.round(255 * Math.pow(v / 90, 1 / 1.8))));
    const r = new Uint8Array(q.length);
    for (let i = 0; i < q.length; i++) r[i] = canais === 4 && i % 4 === 3 ? 255 : tab[q[i]];
    return r;
  }
  if (tipo.startsWith('temporal')) {
    let anterior = anteriores.get(tipo);
    const r = new Uint8Array(q.length);
    let dif = 0;
    if (anterior && anterior.length === q.length) for (let i = 0; i < q.length; i += 97) dif += Math.abs(q[i] - anterior[i]);
    const novo = !anterior || anterior.length !== q.length || dif / (q.length / 97) > 40;
    if (novo) anteriores.set(tipo, (anterior = Float32Array.from(q)));
    else for (let i = 0; i < q.length; i++) anterior[i] = 0.75 * anterior[i] + 0.25 * q[i];
    for (let i = 0; i < q.length; i++) r[i] = anterior[i];
    return tipo === 'temporal' ? r : realcar(r, L, A, canais, 'auto');
  }
  const base = tipo === 'auto-suave' ? caixa3(q, L, A, canais) : q;
  const hist = new Uint32Array(256);
  let soma = 0, n = 0;
  for (let i = 0; i < L * A; i += 3) {
    const o = i * canais, v = Math.round(0.299 * base[o] + 0.587 * base[o + 1] + 0.114 * base[o + 2]);
    hist[v]++;
    n++;
  }
  const pct = (p) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) if ((acc += hist[v]) >= p * n) return v;
    return 255;
  };
  const lo = pct(0.01), hi = Math.max(lo + 16, pct(0.99));
  for (let v = 0; v < 256; v++) soma += hist[v] * Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
  const media = Math.min(0.99, Math.max(0.01, soma / n));
  const gama = Math.min(1, Math.max(0.35, Math.log(0.45) / Math.log(media)));
  const tab = Uint8Array.from({ length: 256 }, (_, v) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, (v - lo) / (hi - lo))), gama)));
  const r = new Uint8Array(q.length);
  for (let i = 0; i < q.length; i++) r[i] = canais === 4 && i % 4 === 3 ? 255 : tab[base[i]];
  return r;
}
