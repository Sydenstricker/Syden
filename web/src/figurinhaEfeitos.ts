/**
 * OS EFEITOS DA FIGURINHA (pedido dele, 04/11/2026: "que ele remova o fundo e adicione um contorno mais forte, como ocorre no
 * WhatsApp"). Só código, no computador de quem cria, sem modelo e sem download: funciona para o fundo LISO (uma cor só: print
 * de produto, fundo branco, imagem de jogo recortada). Fundo de foto ou desenhado pede um modelo, o passo 2, ainda a medir.
 *
 * Tudo aqui trabalha sobre os pixels crus (RGBA), sem canvas, para os testes rodarem no Node.
 */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Quão longe (distância RGB) uma cor ainda conta como a do fundo. Daí até o dobro, a borda fica meio transparente. */
const TOLERANCIA = 42;
/** A cor mais comum da borda precisa cobrir isto da borda para o fundo contar como liso. */
const BORDA_LISA = 0.6;

const distancia = (d: Uint8ClampedArray, i: number, r: number, g: number, b: number) =>
  Math.sqrt((d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2);

/**
 * O resultado de tirar o fundo: 'tirado'; 'ja-sem-fundo' (a borda já é transparente: a imagem veio recortada); ou 'nao-liso'
 * (a borda não tem uma cor dominante, ou apagá-la levaria a imagem inteira). Nos dois últimos, os pixels não mudam.
 */
export type ResultadoDoFundo = 'tirado' | 'ja-sem-fundo' | 'nao-liso';

export function tirarFundoLiso(img: Pixels): ResultadoDoFundo {
  const { data, width: w, height: h } = img;
  const borda: number[] = [];
  for (let x = 0; x < w; x++) borda.push(x, x + (h - 1) * w);
  for (let y = 1; y < h - 1; y++) borda.push(y * w, y * w + w - 1);

  // A cor dominante da borda, em baldes de 5 bits por canal.
  let transparentes = 0;
  const baldes = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const p of borda) {
    const i = p * 4;
    if (data[i + 3] < 16) {
      transparentes++;
      continue;
    }
    const k = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    const balde = baldes.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    balde.n++;
    balde.r += data[i];
    balde.g += data[i + 1];
    balde.b += data[i + 2];
    baldes.set(k, balde);
  }
  if (transparentes > borda.length / 2) return 'ja-sem-fundo';
  // Baldes vizinhos somam: um gradiente leve de JPG espalha a mesma cor por dois ou três baldes.
  let melhor: { n: number; r: number; g: number; b: number } | null = null;
  for (const balde of baldes.values()) if (!melhor || balde.n > melhor.n) melhor = balde;
  if (!melhor) return 'nao-liso';
  const [r, g, b] = [melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n];
  let parecidos = 0;
  for (const p of borda) if (data[p * 4 + 3] >= 16 && distancia(data, p * 4, r, g, b) <= TOLERANCIA) parecidos++;
  if (parecidos < (borda.length - transparentes) * BORDA_LISA) return 'nao-liso';

  // Do lado de fora para dentro: só o fundo LIGADO à borda some (o branco do olho de um personagem fica).
  const fundo = new Uint8Array(w * h);
  const fila = new Int32Array(w * h);
  let ini = 0;
  let fim = 0;
  for (const p of borda) {
    if (!fundo[p] && (data[p * 4 + 3] < 16 || distancia(data, p * 4, r, g, b) <= TOLERANCIA)) {
      fundo[p] = 1;
      fila[fim++] = p;
    }
  }
  while (ini < fim) {
    const p = fila[ini++];
    const x = p % w;
    const vizinhos = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
    for (const q of vizinhos) {
      if (q < 0 || q >= w * h || fundo[q]) continue;
      if (data[q * 4 + 3] < 16 || distancia(data, q * 4, r, g, b) <= TOLERANCIA) {
        fundo[q] = 1;
        fila[fim++] = q;
      }
    }
  }
  // Apagar quase tudo quer dizer que o objeto é da cor do fundo: melhor não mexer.
  if (fim > w * h * 0.97) return 'nao-liso';

  for (let p = 0; p < w * h; p++) if (fundo[p]) data[p * 4 + 3] = 0;
  // A borda do objeto: quem encosta no fundo e ainda é parecido com ele fica meio transparente (sem o serrilhado).
  for (let p = 0; p < w * h; p++) {
    if (fundo[p]) continue;
    const x = p % w;
    const encosta = (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) || (p >= w && fundo[p - w]) || (p + w < w * h && fundo[p + w]);
    if (!encosta) continue;
    const d = distancia(data, p * 4, r, g, b);
    if (d < TOLERANCIA * 2) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * ((d - TOLERANCIA) / TOLERANCIA) ** 0.5 || 0);
  }
  tirarIlhas(img);
  return 'tirado';
}

/**
 * Os pedacinhos soltos que sobram do fundo (um desenho do papel de parede, um risco, sujeira de JPG): cada pedaço opaco que
 * não encosta em nenhum outro e é menor que 1,5% do maior some. O pingo de um "i" ao lado do texto fica (encosta no contorno
 * depois); o que faz figurinha feia é o calombo na borda, e é ele que sai.
 */
function tirarIlhas(img: Pixels) {
  const { data, width: w, height: h } = img;
  const rotulo = new Int32Array(w * h).fill(-1);
  const tamanhos: number[] = [];
  const fila = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (rotulo[s] >= 0 || data[s * 4 + 3] < 48) continue;
    const id = tamanhos.length;
    let ini = 0;
    let fim = 0;
    fila[fim++] = s;
    rotulo[s] = id;
    while (ini < fim) {
      const p = fila[ini++];
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || rotulo[q] >= 0 || data[q * 4 + 3] < 48) continue;
        rotulo[q] = id;
        fila[fim++] = q;
      }
    }
    tamanhos.push(fim);
  }
  const maior = Math.max(0, ...tamanhos);
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] === 0) continue;
    const id = rotulo[p];
    // os meio transparentes de beirada (rótulo -1) seguem o vizinho que tiver rótulo; sem nenhum, somem com a ilha
    if (id >= 0 ? tamanhos[id] < maior * 0.015 : !vizinhoGrande(p)) data[p * 4 + 3] = 0;
  }
  function vizinhoGrande(p: number) {
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
      if (q >= 0 && q < w * h && rotulo[q] >= 0 && tamanhos[rotulo[q]] >= maior * 0.015) return true;
    return false;
  }
}

/** Corta as margens transparentes. Devolve a mesma imagem se não houver o que cortar, ou null se ela ficou vazia. */
export function aparar(img: Pixels): Pixels | null {
  const { data, width: w, height: h } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) return img;
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  const novo = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) novo.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * nw * 4);
  return { data: novo, width: nw, height: nh };
}

/** A grossura do contorno para uma imagem deste tamanho: forte, como o do WhatsApp (~3% do lado maior). */
export const grossuraDoContorno = (img: Pick<Pixels, 'width' | 'height'>) => Math.max(4, Math.round(Math.max(img.width, img.height) * 0.03));

/**
 * O CONTORNO: a silhueta engrossada, em branco, por baixo da imagem, com uma sombra leve para o branco não sumir numa conversa
 * clara. A imagem cresce a grossura (e mais um pouco da sombra) de cada lado. Imagem sem transparência nenhuma ganha uma
 * moldura branca arredondada, que é o mesmo efeito.
 */
export function contornar(img: Pixels, raio = grossuraDoContorno(img)): Pixels {
  const sombra = Math.max(1, Math.round(raio / 4));
  const m = raio + sombra + 1;
  const w = img.width + m * 2;
  const h = img.height + m * 2;
  const alfa = new Float32Array(w * h);
  const src = img.data;

  // O disco do contorno, com a beirada suave (1 px).
  const disco: [number, number, number][] = [];
  for (let dy = -raio - 1; dy <= raio + 1; dy++)
    for (let dx = -raio - 1; dx <= raio + 1; dx++) {
      const peso = Math.min(1, Math.max(0, raio + 0.5 - Math.hypot(dx, dy)));
      if (peso > 0) disco.push([dx, dy, peso]);
    }

  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const a = src[(y * img.width + x) * 4 + 3] / 255;
      if (a <= 0.03) continue;
      const centro = (y + m) * w + x + m;
      if (a > alfa[centro]) alfa[centro] = a;
      // Só quem está na beirada da silhueta carimba o disco: o miolo já está coberto.
      const naBeirada =
        x === 0 || y === 0 || x === img.width - 1 || y === img.height - 1 ||
        src[(y * img.width + x - 1) * 4 + 3] < 250 || src[(y * img.width + x + 1) * 4 + 3] < 250 ||
        src[((y - 1) * img.width + x) * 4 + 3] < 250 || src[((y + 1) * img.width + x) * 4 + 3] < 250;
      if (!naBeirada) continue;
      for (const [dx, dy, peso] of disco) {
        const q = centro + dy * w + dx;
        const v = a * peso;
        if (v > alfa[q]) alfa[q] = v;
      }
    }

  const out = new Uint8ClampedArray(w * h * 4);
  // A sombra: o contorno deslocado para baixo, preto a 22%.
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const de = y - sombra;
      if (de < 0) continue;
      const a = alfa[de * w + x] * 0.22;
      if (a > 0) out[(y * w + x) * 4 + 3] = Math.round(a * 255);
    }
  // O branco por cima da sombra, e a imagem por cima do branco.
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const ab = alfa[p];
    const as = out[i + 3] / 255;
    // branco sobre a sombra (preta)
    let a = ab + as * (1 - ab);
    let r = a > 0 ? (255 * ab) / a : 0;
    let g = r;
    let b = r;
    const x = (p % w) - m;
    const y = Math.floor(p / w) - m;
    if (x >= 0 && y >= 0 && x < img.width && y < img.height) {
      const j = (y * img.width + x) * 4;
      const ai = src[j + 3] / 255;
      const na = ai + a * (1 - ai);
      if (na > 0) {
        r = (src[j] * ai + r * a * (1 - ai)) / na;
        g = (src[j + 1] * ai + g * a * (1 - ai)) / na;
        b = (src[j + 2] * ai + b * a * (1 - ai)) / na;
      }
      a = na;
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = Math.round(a * 255);
  }
  return { data: out, width: w, height: h };
}
