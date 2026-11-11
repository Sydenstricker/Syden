// A HÉLICE GIRANDO, POR CÓDIGO (pedido dele, 10/11/2026: o botão direito liga o ventilador; "sem gerar arte"). De cada vista
// parada do ventilador (avulsos/ventilador-giros) saem os quadros da hélice girando, avulsos/ventilador-girando/<direção>-<f>.png,
// no mesmo enquadramento: a página os troca no lugar da vista, no ritmo de 12 por segundo.
//
// Como: o aro é uma ELIPSE (o círculo da grade visto de lado), achada pelo fecho convexo dos pixels claros da cabeça. Girar a
// hélice é girar NO PLANO DO ARO: p' = centro + A·R(θ)·A⁻¹·(p − centro), com A a forma da elipse. O centro é o do eixo, achado
// pela simetria das três pás (o centro que mais repete a hélice quando ela gira 120°). As VARETAS da grade (os pixels mais claros)
// ficam paradas, e o MOTOR também: na frente da hélice nas vistas de costas, atrás dela nas de frente. O que a pá cobria no
// motor é preenchido pelo vizinho mais perto do motor.
//
// E a CABEÇA OSCILANDO (ventilador-oscilar.mjs, PixelLab): se avulsos/ventilador-oscilar/<direção>-<n>.png existe, cada quadro
// tem a cabeça colada sobre o pé e a base da vista parada, e a hélice girando do mesmo jeito, numa elipse achada nele:
// avulsos/ventilador-oscilando/<direção>-<n>-<f>.png. Sem esses, a página faz a oscilação por código (ver montar.mjs).
//
//   node e2e/pixel-art/quarto/novo/quarto/ventilador-quadros.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DIRECOES = ['south-west', 'north-west', 'north-east', 'south-east'];
// três quadros, 40° cada: as pás são três (a hélice se repete a cada 120°), e 40° por quadro lê como um giro num só sentido
export const PASSOS = 3, PASSO = (40 * Math.PI) / 180;

const ler = (f) => PNG.sync.read(fs.readFileSync(f));
const media = (d, i) => (d[i] + d[i + 1] + d[i + 2]) / 3;

// A cabeça: de cima até onde a largura opaca cai abaixo de 16 (o pé).
function cabecaDe(im) {
  const { width: W, height: H, data: d } = im;
  let topo = H, fundo = 0;
  const larg = new Int16Array(H);
  for (let y = 0; y < H; y++) { let a = W, b = -1; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { a = Math.min(a, x); b = Math.max(b, x); } larg[y] = b >= a ? b - a + 1 : 0; if (larg[y]) { topo = Math.min(topo, y); fundo = y; } }
  let fim = topo + 20;
  while (fim < fundo && larg[fim] >= 16) fim++;
  return { topo, fim };
}

// A elipse do aro: o fecho convexo dos pixels claros da cabeça, amostrado igual pelo contorno; o centro é a média e a forma
// sai da covariância (para pontos uniformes num contorno de elipse, Cov = A·Aᵀ/2).
function elipseDe(im, { topo, fim }) {
  const { width: W, data: d } = im, claros = [];
  for (let y = topo; y < fim; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (d[i + 3] && media(d, i) >= 205) claros.push([x, y]); }
  claros.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of claros) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of claros.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  const casco = lo.slice(0, -1).concat(hi.slice(0, -1)), am = [];
  for (let i = 0; i < casco.length; i++) { const a = casco[i], b = casco[(i + 1) % casco.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let k = 0; k < n; k++) am.push([a[0] + ((b[0] - a[0]) * k) / n + 0.5, a[1] + ((b[1] - a[1]) * k) / n + 0.5]); }
  let cx = 0, cy = 0; for (const [x, y] of am) { cx += x; cy += y; } cx /= am.length; cy /= am.length;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of am) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
  const a = (2 * sxx) / am.length, b = (2 * sxy) / am.length, e = (2 * syy) / am.length, s = Math.sqrt(a * e - b * b), t = Math.sqrt(a + e + 2 * s);
  return { cx, cy, A: [(a + s) / t, b / t, b / t, (e + s) / t] };
}
const inversa = ([a, b, c, d]) => { const det = a * d - b * c; return [d / det, -b / det, -c / det, a / det]; };
const vezes = ([a, b, c, d], [e, f, g, h]) => [a * e + b * g, a * f + b * h, c * e + d * g, c * f + d * h];
const giro = (t) => [Math.cos(t), -Math.sin(t), Math.sin(t), Math.cos(t)];
// a transformação do giro de θ no plano do aro
const noPlano = (A, t) => vezes(vezes(A, giro(t)), inversa(A));

// As classes de cada pixel dentro do aro: vareta (o mais claro, parada), motor (escuro e acinzentado), pá (o bege e o contorno
// colado nele), vazio (transparente).
function classes(im, el) {
  const { width: W, height: H, data: d } = im, Ai = inversa(el.A), cls = new Uint8Array(W * H); // 0 fora, 1 vazio, 2 pá, 3 vareta, 4 motor, 5 contorno
  const dentro = (x, y, f) => { const dx = x + 0.5 - el.cx, dy = y + 0.5 - el.cy, u = Ai[0] * dx + Ai[1] * dy, v = Ai[2] * dx + Ai[3] * dy; return u * u + v * v <= f * f; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y, 0.86)) continue;
    const i = (y * W + x) * 4;
    if (!d[i + 3]) { cls[y * W + x] = 1; continue; }
    const m = media(d, i), sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    cls[y * W + x] = m >= 205 ? 3 : m >= 128 ? 2 : m < 32 ? 5 : sat < 40 ? 4 : 2;
  }
  // o contorno escuro é da pá quando encosta numa pá; senão, do motor
  for (let k = 0; k < W * H; k++) if (cls[k] === 5) {
    const x = k % W, y = (k / W) | 0; let pa = 0, mo = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const c = cls[(y + dy) * W + x + dx]; if (c === 2) pa++; if (c === 4) mo++; }
    cls[k] = pa > mo ? 6 : 4; // 6: contorno da pá
  }
  // o MOTOR é o maior pedaço ligado de escuros acinzentados; os pedacinhos soltos no meio das pás são a sombra delas
  const visto = new Uint8Array(W * H); let maior = [];
  for (let k0 = 0; k0 < W * H; k0++) {
    if (cls[k0] !== 4 || visto[k0]) continue;
    const comp = [k0]; visto[k0] = 1;
    for (let q = 0; q < comp.length; q++) { const k = comp[q], x = k % W, y = (k / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = (y + dy) * W + x + dx; if (cls[j] === 4 && !visto[j]) { visto[j] = 1; comp.push(j); } } }
    if (comp.length > maior.length) { for (const k of maior) cls[k] = 2; maior = comp; } else for (const k of comp) cls[k] = 2;
  }
  if (maior.length < 25) for (const k of maior) cls[k] = 2;
  return { cls, dentro };
}

// O centro do eixo. Nas vistas de FRENTE, o miolo da hélice: o maior bloco claro com "recheio" (as varetas são finas e não
// têm). Nas de COSTAS o motor o cobre, e o eixo é o que mais repete as pás quando a hélice gira 120° e 240° (uma pá que cai num
// vão, onde se vê através da grade, conta contra).
function centroDoEixo(im, el, cls) {
  const W = im.width, claro = (k) => cls[k] === 3, visto = new Uint8Array(cls.length);
  let melhor = null;
  for (let k0 = 0; k0 < cls.length; k0++) {
    if (!claro(k0) || visto[k0]) continue;
    const comp = [k0]; visto[k0] = 1;
    for (let q = 0; q < comp.length; q++) for (const j of [comp[q] + 1, comp[q] - 1, comp[q] + W, comp[q] - W]) if (claro(j) && !visto[j]) { visto[j] = 1; comp.push(j); }
    const recheio = comp.filter((k) => claro(k - 1) && claro(k + 1) && claro(k - W) && claro(k + W)).length;
    if (recheio >= 3 && (!melhor || recheio > melhor.recheio)) melhor = { recheio, comp };
  }
  if (melhor) {
    // (o miolo é redondo no plano do aro: o centro é o do menor retângulo em volta do bloco, que a vareta colada não puxa tanto)
    const nuc = melhor.comp.filter((k) => claro(k - 1) && claro(k + 1) && claro(k - W) && claro(k + W));
    let cx = 0, cy = 0; for (const k of nuc) { cx += (k % W) + 0.5; cy += ((k / W) | 0) + 0.5; }
    cx /= nuc.length; cy /= nuc.length;
    // o MIOLO fica parado (ele é redondo: girá-lo não mostra nada, e o contorno dele quebrava): o raio dele no plano do aro
    const Ai = inversa(el.A); let miolo = 0;
    for (const k of melhor.comp) { const dx = (k % W) + 0.5 - cx, dy = ((k / W) | 0) + 0.5 - cy, u = Ai[0] * dx + Ai[1] * dy, v = Ai[2] * dx + Ai[3] * dy; miolo = Math.max(miolo, Math.hypot(u, v)); }
    return { cx, cy, deCostas: false, miolo: Math.min(0.32, miolo) + 0.06 };
  }
  const pas = []; for (let k = 0; k < cls.length; k++) if (cls[k] === 2) pas.push([(k % W) + 0.5, ((k / W) | 0) + 0.5]);
  let achado = null;
  for (let oy = -14; oy <= 14; oy += 0.5) for (let ox = -14; ox <= 14; ox += 0.5) {
    const cx = el.cx + ox, cy = el.cy + oy; let n = 0;
    for (const t of [(2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
      const M = noPlano(el.A, t);
      for (const [x, y] of pas) { const dx = x - cx, dy = y - cy, c = cls[Math.floor(cy + M[2] * dx + M[3] * dy) * W + Math.floor(cx + M[0] * dx + M[1] * dy)]; if (c === 2 || c === 6) n++; else if (c === 1 || c === 0) n -= 2; }
    }
    if (!achado || n > achado.n) achado = { cx, cy, n };
  }
  return { cx: achado.cx, cy: achado.cy, deCostas: true, miolo: 0 };
}

// O que fica atrás das pás (só nas vistas de frente: o motor): o vizinho mais perto que é motor, dentro do fecho do motor.
function fundoDoMotor(im, cls) {
  const { width: W, height: H, data: d } = im, fundo = new Uint8ClampedArray(W * H * 4), tem = new Uint8Array(W * H), fila = [];
  const motor = []; for (let k = 0; k < W * H; k++) if (cls[k] === 4) { motor.push(k); tem[k] = 1; fundo.set(d.subarray(k * 4, k * 4 + 4), k * 4); fila.push(k); }
  if (!motor.length) return { fundo, tem };
  // o fecho convexo do motor visto dentro do aro limita o preenchimento (atrás da pá, o motor continua a forma dele)
  const pts = motor.map((k) => [k % W, (k / W) | 0]);
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (hi.length >= 2 && cr(hi.at(-2), hi.at(-1), p) <= 0) hi.pop(); hi.push(p); }
  const casco = lo.slice(0, -1).concat(hi.slice(0, -1));
  const noCasco = (x, y) => { for (let i = 0; i < casco.length; i++) { const a = casco[i], b = casco[(i + 1) % casco.length]; if (cr(a, b, [x, y]) < -0.5) return false; } return casco.length > 2; };
  for (let q = 0; q < fila.length; q++) {
    const k = fila[q], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy, j = Y * W + X; if (X < 0 || Y < 0 || X >= W || Y >= H || tem[j] || !cls[j] || !noCasco(X, Y)) continue; tem[j] = 1; fundo.set(fundo.subarray(k * 4, k * 4 + 4), j * 4); fila.push(j); }
  }
  return { fundo, tem };
}

// Um quadro da hélice girada de θ. Só o RECHEIO das pás é levado (o pixel de onde ele vem, sem misturar); o contorno escuro é
// redesenhado em volta do que ficou, porque a linha de 1 px, levada ponto a ponto, falha e engrossa.
function girar(im, base, t) {
  const { el, cls, eixo, deCostas, fundo, pa, d, contorno } = base, { width: W, height: H } = im, out = new PNG({ width: W, height: H });
  im.data.copy(out.data);
  const M = noPlano(el.A, -t), Ai = inversa(el.A); // de onde vem cada pixel
  const mexe = new Uint8Array(W * H), cheio = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) {
    const c = cls[k];
    if (!c || c === 3 || (deCostas && c === 4)) continue; // fora do aro, vareta, motor na frente: parados
    const x = k % W + 0.5, y = ((k / W) | 0) + 0.5, dx = x - eixo.cx, dy = y - eixo.cy;
    if (eixo.miolo && Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy) <= eixo.miolo) continue; // o miolo, parado
    mexe[k] = 1;
    const sx = Math.floor(eixo.cx + M[0] * dx + M[1] * dy), sy = Math.floor(eixo.cy + M[2] * dx + M[3] * dy), s = sy * W + sx, i = k * 4;
    if (sx >= 0 && sy >= 0 && sx < W && sy < H && pa[s] === 1) { cheio[k] = 1; for (let q = 0; q < 4; q++) out.data[i + q] = d[s * 4 + q]; continue; }
    // sem pá aqui: o que fica atrás (o motor nas vistas de frente) ou o vazio
    if (!deCostas && fundo.tem[k]) for (let q = 0; q < 4; q++) out.data[i + q] = fundo.fundo[i + q];
    else for (let q = 0; q < 4; q++) out.data[i + q] = 0;
  }
  // o contorno: o que mexe, não é pá e encosta numa pá
  for (let k = 0; k < W * H; k++) if (mexe[k] && !cheio[k] && (cheio[k - 1] || cheio[k + 1] || cheio[k - W] || cheio[k + W])) out.data.set(contorno, k * 4);
  return out;
}

// O RASTRO: o quadro de θ é a média das pás em 6 giros entre θ e θ + 40° (o que elas varreram no tempo de um quadro). Onde a
// pá passou na maior parte do tempo, a cor média dela; na metade, um xadrezinho (alternando a cada quadro) com o que está
// atrás; quase nunca, o de trás. Pixel art não mistura cor com o fundo: o meio-termo é o pontilhado.
function borrar(im, base, t, f) {
  const { el, cls, eixo, deCostas, fundo, pa, d } = base, { width: W, height: H } = im, out = new PNG({ width: W, height: H });
  im.data.copy(out.data);
  const Ai = inversa(el.A), K = 6, Ms = Array.from({ length: K }, (_, i) => noPlano(el.A, -(t + (i * PASSO) / K)));
  for (let k = 0; k < W * H; k++) {
    const c = cls[k];
    if (!c || c === 3 || (deCostas && c === 4)) continue;
    const x = k % W + 0.5, y = ((k / W) | 0) + 0.5, dx = x - eixo.cx, dy = y - eixo.cy;
    if (eixo.miolo && Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy) <= eixo.miolo) continue;
    let n = 0; const soma = [0, 0, 0];
    for (const M of Ms) {
      const sx = Math.floor(eixo.cx + M[0] * dx + M[1] * dy), sy = Math.floor(eixo.cy + M[2] * dx + M[3] * dy), s = sy * W + sx;
      if (sx >= 0 && sy >= 0 && sx < W && sy < H && pa[s] === 1) { n++; for (let q = 0; q < 3; q++) soma[q] += d[s * 4 + q]; }
    }
    const i = k * 4, cob = n / K, xadrez = ((k % W) + ((k / W) | 0) + f) & 1;
    if (cob >= 0.6 || (cob >= 0.3 && xadrez)) { for (let q = 0; q < 3; q++) out.data[i + q] = Math.round(soma[q] / n); out.data[i + 3] = 255; }
    else if (!deCostas && fundo.tem[k]) for (let q = 0; q < 4; q++) out.data[i + q] = fundo.fundo[i + q];
    else for (let q = 0; q < 4; q++) out.data[i + q] = 0;
  }
  return out;
}

export function prepararHelice(im) {
  const cab = cabecaDe(im), el = elipseDe(im, cab), { cls } = classes(im, el), eixo = centroDoEixo(im, el, cls), { deCostas } = eixo;
  // a camada da hélice: 1 = pá (a cor dela), sob as varetas (e o motor da frente) o vizinho mais perto
  const W = im.width, pa = new Uint8Array(cls.length);
  for (let k = 0; k < cls.length; k++) if (cls[k] === 2) pa[k] = 1; else if (cls[k] === 6) pa[k] = 2;
  // a cor do contorno das pás: a mais comum entre os contornos dela
  const conta = new Map(); for (let k = 0; k < cls.length; k++) if (cls[k] === 6) { const c = [...im.data.subarray(k * 4, k * 4 + 4)].join(','); conta.set(c, (conta.get(c) ?? 0) + 1); }
  const contorno = Uint8Array.from(([...conta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '20,16,14,255').split(',').map(Number));
  const d = new Uint8ClampedArray(im.data);
  const debaixo = []; for (let k = 0; k < cls.length; k++) if (cls[k] === 3 || (deCostas && cls[k] === 4)) debaixo.push(k);
  // preenche o que está debaixo de uma vareta (ou do motor da frente) pelo vizinho de pá mais perto, de fora para dentro
  let falta = debaixo.filter((k) => !pa[k]);
  for (let volta = 0; volta < 6 && falta.length; volta++) {
    const agora = [];
    for (const k of falta) {
      const x = k % W, y = (k / W) | 0; let viz = -1, nPa = 0, nVazio = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (pa[j] === 1) { nPa++; if (viz < 0) viz = j; } else if (cls[j] === 1 || pa[j] === 2) nVazio++; }
      if (nPa >= 2 && nPa > nVazio) agora.push([k, viz]);
    }
    if (!agora.length) break;
    for (const [k, j] of agora) { pa[k] = 1; for (let q = 0; q < 4; q++) d[k * 4 + q] = d[j * 4 + q]; }
    falta = falta.filter((k) => !pa[k]);
  }
  const fundo = deCostas ? { tem: new Uint8Array(cls.length) } : fundoDoMotor(im, cls);
  return { el, cls, eixo, deCostas, fundo, pa, d, contorno };
}

export function quadrosDaHelice(im) {
  const base = prepararHelice(im);
  const sentido = base.deCostas ? -1 : 1;
  // (RASTRO=0: as pás giradas, sem o rastro; o quadro 0 é então a vista parada)
  if (process.env.RASTRO === '0') return { base, quadros: Array.from({ length: PASSOS }, (_, f) => (f === 0 ? im : girar(im, base, sentido * f * PASSO))) };
  return { base, quadros: Array.from({ length: PASSOS }, (_, f) => borrar(im, base, sentido * f * PASSO, f)) };
}

// A CABEÇA DE UM QUADRO GERADO SOBRE O PÉ DA VISTA PARADA: abaixo do fim da cabeça (com 4 px de folga), a vista parada.
function colarNoPe(quadro, parada) {
  const { fim } = cabecaDe(parada), out = new PNG({ width: parada.width, height: parada.height });
  const W = parada.width;
  for (let y = 0; y < parada.height; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, de = y < fim - 2 && x < quadro.width && y < quadro.height ? quadro : parada, j = (y * de.width + x) * 4;
    for (let q = 0; q < 4; q++) out.data[i + q] = de.data[j + q];
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const saida = path.join(AQUI, 'avulsos', 'ventilador-girando');
  fs.mkdirSync(saida, { recursive: true });
  for (const dir of DIRECOES) {
    const im = ler(path.join(AQUI, 'avulsos', 'ventilador-giros', dir + '.png')), { base, quadros } = quadrosDaHelice(im);
    quadros.forEach((q, f) => fs.writeFileSync(path.join(saida, `${dir}-${f}.png`), PNG.sync.write(q)));
    console.log(dir, 'eixo', base.eixo.cx.toFixed(1), base.eixo.cy.toFixed(1), base.deCostas ? 'de costas' : 'de frente');
  }
  const osc = path.join(AQUI, 'avulsos', 'ventilador-oscilar');
  if (fs.existsSync(osc)) {
    const saidaO = path.join(AQUI, 'avulsos', 'ventilador-oscilando');
    fs.mkdirSync(saidaO, { recursive: true });
    for (const dir of DIRECOES) {
      const parada = ler(path.join(AQUI, 'avulsos', 'ventilador-giros', dir + '.png'));
      const qs = fs.readdirSync(osc).filter((f) => f.startsWith(dir + '-') && /-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));
      qs.forEach((f, n) => {
        const cabeca = colarNoPe(ler(path.join(osc, f)), parada), { quadros } = quadrosDaHelice(cabeca);
        quadros.forEach((q, g) => fs.writeFileSync(path.join(saidaO, `${dir}-${n}-${g}.png`), PNG.sync.write(q)));
      });
      if (qs.length) console.log(dir, qs.length, 'quadros oscilando');
    }
  }
}
