// A HÉLICE GIRANDO, POR CÓDIGO (pedido dele, 10/11/2026: o botão direito liga o ventilador; "sem gerar arte"). De cada vista
// parada do ventilador (avulsos/ventilador-giros-limpos) saem os quadros da hélice girando, avulsos/ventilador-girando/<direção>-<f>.png,
// no mesmo enquadramento: a página os troca no lugar da vista, no ritmo de 12 por segundo.
//
// Como: o aro é uma ELIPSE (o círculo da grade visto de lado), achada pelo fecho convexo dos pixels claros da cabeça. Girar a
// hélice é girar NO PLANO DO ARO: p' = centro + A·R(θ)·A⁻¹·(p − centro), com A a forma da elipse. O centro é o do eixo, achado
// pela simetria das três pás (o centro que mais repete a hélice quando ela gira 120°). As VARETAS da grade (os pixels mais claros)
// ficam paradas, e o MOTOR também: na frente da hélice nas vistas de costas, atrás dela nas de frente. O que a pá cobria no
// motor é preenchido pelo vizinho mais perto do motor.
//
// E a CABEÇA OSCILANDO: se avulsos/ventilador-oscilar/<direção>-<n>.png existe (montados por ventilador-oscilacao.mjs, com os
// quadros do meio do PixelLab), cada um ganha a hélice girando, numa elipse achada nele: avulsos/ventilador-oscilando/<direção>-<n>-<f>.png.
// Sem esses, a página faz a oscilação por código (ver montar.mjs).
//
// O QUE A REVISÃO QUADRO A QUADRO DELE ENSINOU (11/11/2026), cada item com o comentário no lugar: o aro achado pelo CONTORNO de fora
// (o brilho fica só em cima); a margem do aro em PIXELS; a ponta da pá cresce na faixa do aro e o contorno dela gira junto; as três pás
// se COMPLETAM (cada uma tem a ponta escondida num lugar diferente); o contorno de DENTRO do aro marcado e parado; a vareta a partir de
// 190 de claridade; a borda do aro de lado parada; o motor atrás da hélice MISTURADO à cor dela, sem pontilhado; o miolo e o círculo
// preto dele parados; e os pontinhos escuros soltos que sobram, apagados.
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
  const pelosClaros = { cx, cy, A: [(a + s) / t, b / t, b / t, (e + s) / t] };
  // (DE LADO, a dos claros: o aro é uma elipse fina e o contorno da cabeça tem o motor e a haste junto; na P5 do noroeste a do
  // contorno desceu até a haste, que passou a girar como pá, relato dele 11/11/2026)
  if (Math.hypot(pelosClaros.A[0], pelosClaros.A[2]) / Math.hypot(pelosClaros.A[1], pelosClaros.A[3]) < 0.55) return pelosClaros;
  const pc = peloContorno(im, { topo, fim });
  // (só vale se não for muito diferente da dos claros: de lado, o motor é metade do contorno, e um ajuste ruim giraria o motor)
  const area = (e) => Math.abs(e.A[0] * e.A[3] - e.A[1] * e.A[2]);
  return pc && area(pc) < 1.6 * area(pelosClaros) && area(pc) > 0.7 * area(pelosClaros) && raioNoPlano(pelosClaros, [pc.cx, pc.cy]) < 0.35 ? pc : pelosClaros;
}

// A ELIPSE PELO CONTORNO DE FORA (11/11/2026): os pixels claros ficam quase todos no lado de cima do aro (o brilho), e a elipse
// que saía deles ficava de pé onde o aro está inclinado, deixando a ponta das pás de baixo fora (paradas). Aqui ela é ajustada à
// borda da silhueta da cabeça (cônica por mínimos quadrados), descartando aos poucos os pontos que mais fogem dela: o motor, que
// sobra para o lado, e o pescoço. A elipse é a de FORA do aro; a margem do aro (MARGEM, em classes) conta a partir dela.
function peloContorno(im, { topo, fim }) {
  const { width: W, data: d } = im, op = (x, y) => x >= 0 && y >= 0 && x < W && y < fim && d[(y * W + x) * 4 + 3] > 0;
  let pts = [];
  for (let y = topo; y < fim; y++) for (let x = 0; x < W; x++) if (op(x, y) && (!op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1))) pts.push([x + 0.5, y + 0.5]);
  if (pts.length < 40) return null;
  let el = null;
  for (let volta = 0; volta < 6; volta++) {
    el = conica(pts); if (!el) return null;
    const res = pts.map((p) => Math.abs(raioNoPlano(el, p) - 1)).sort((a, b) => a - b), corte = res[Math.floor(res.length * 0.8)];
    if (corte < 0.04) break;
    pts = pts.filter((p) => Math.abs(raioNoPlano(el, p) - 1) <= corte);
  }
  return el;
}
const raioNoPlano = (el, [x, y]) => { const Ai = inversa(el.A), dx = x - el.cx, dy = y - el.cy; return Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy); };
// x² + Bxy + Cy² + Dx + Ey + F = 0 pelos mínimos quadrados (coordenadas centradas), e daí o centro e a forma A (simétrica,
// p = centro + A·(u, v) com (u, v) no círculo unitário, como a de antes).
function conica(pts) {
  let mx = 0, my = 0; for (const [x, y] of pts) { mx += x; my += y; } mx /= pts.length; my /= pts.length;
  const N = 5, M = Array.from({ length: N }, () => new Float64Array(N + 1));
  for (const [X, Y] of pts) { const x = X - mx, y = Y - my, r = [x * y, y * y, x, y, 1], b = -x * x; for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) M[i][j] += r[i] * r[j]; M[i][N] += r[i] * b; } }
  for (let i = 0; i < N; i++) { let p = i; for (let k = i + 1; k < N; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; if (Math.abs(M[i][i]) < 1e-9) return null; for (let k = 0; k < N; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= N; j++) M[k][j] -= f * M[i][j]; } }
  const [B, C, D, E, F] = M.map((l, i) => l[N] / l[i]);
  if (4 * C - B * B <= 0) return null; // não é elipse
  const det = 4 * C - B * B, cx = (B * E - 2 * C * D) / det, cy = (B * D - 2 * E) / det;
  const Fc = cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy + F; if (Fc >= 0) return null;
  // Q = [[1, B/2], [B/2, C]] / (−Fc); A = Q^(−1/2)
  const q11 = 1 / -Fc, q12 = B / 2 / -Fc, q22 = C / -Fc, tr = q11 + q22, dt = q11 * q22 - q12 * q12, disc = Math.sqrt(Math.max(0, tr * tr / 4 - dt));
  const l1 = tr / 2 + disc, l2 = tr / 2 - disc; if (l2 <= 0) return null;
  let v1 = Math.abs(q12) > 1e-12 ? [l1 - q22, q12] : q11 >= q22 ? [1, 0] : [0, 1]; const n1 = Math.hypot(...v1); v1 = [v1[0] / n1, v1[1] / n1];
  const v2 = [-v1[1], v1[0]], s1 = 1 / Math.sqrt(l1), s2 = 1 / Math.sqrt(l2);
  const A = [s1 * v1[0] * v1[0] + s2 * v2[0] * v2[0], s1 * v1[0] * v1[1] + s2 * v2[0] * v2[1], s1 * v1[1] * v1[0] + s2 * v2[1] * v2[0], s1 * v1[1] * v1[1] + s2 * v2[1] * v2[1]];
  return { cx: cx + mx, cy: cy + my, A };
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
  // DENTRO DO ARO: a mais de MARGEM px da borda, medidos em pixels na direção do ponto (11/11/2026). Era 86% do raio, e o aro
  // tem largura fixa em pixels: com o aro inclinado, o raio curto é pequeno, e a ponta das pás de baixo caía fora e ficava parada
  // (relato dele: "pedaços da hélice que não estão girando").
  const MARGEM = Number(process.env.MARGEM_DO_ARO ?? 4);
  const dentro = (x, y) => {
    const dx = x + 0.5 - el.cx, dy = y + 0.5 - el.cy, u = Ai[0] * dx + Ai[1] * dy, v = Ai[2] * dx + Ai[3] * dy, r = Math.hypot(u, v);
    if (r >= 1) return false;
    if (r < 1e-6) return true;
    return ((1 - r) * Math.hypot(dx, dy)) / r >= MARGEM; // a distância até a borda, na linha do centro ao ponto
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y)) continue;
    const i = (y * W + x) * 4;
    if (!d[i + 3]) { cls[y * W + x] = 1; continue; }
    const m = media(d, i), sat = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    // (a VARETA a partir de 190, não de 205: as pás vão até ~185 e as varetas começam em ~195, medido nas 7 posições; com 205, a
    // borda menos clara da vareta girava como pá e a vareta aparecia aos pedaços, relato dele)
    cls[y * W + x] = m >= 190 ? 3 : m >= 128 ? 2 : m < 32 ? 5 : sat < 40 ? 4 : 2;
  }
  // A BORDA DO ARO DE LADO (relato dele: "de lado, a haste está sendo cortada"): com o aro de lado (a elipse fina), a borda dele vira
  // uma barra vertical, clara em cima e bege embaixo; o bege girava como pá. Numa elipse fina, a coluna com uma faixa contínua não
  // escura mais longa que 60% da altura do aro é essa borda, e fica parada.
  { const la = Math.hypot(el.A[0], el.A[2]), al = Math.hypot(el.A[1], el.A[3]);
    if (la / al < 0.55) {
      const minimo = 0.6 * 2 * al;
      for (let x = 0; x < W; x++) {
        let ini = -1;
        for (let y = 0; y <= H; y++) {
          const k = y * W + x, ok = y < H && d[k * 4 + 3] && media(d, k * 4) >= 60 && cls[k];
          if (ok && ini < 0) ini = y;
          if (!ok && ini >= 0) { if (y - ini >= minimo) for (let yy = ini; yy < y; yy++) cls[yy * W + x] = 3; ini = -1; }
        }
      }
    }
  }
  // O CONTORNO DE DENTRO DO ARO (relato dele: "contorno comido"): em cada direção, de fora para dentro, o contorno de fora, o
  // corpo claro do aro e o PRIMEIRO escuro depois dele. Esse fica sempre parado; a pá não cresce por cima nem o leva.
  const doAro = new Uint8Array(W * H);
  for (let i = 0; i < 1440; i++) {
    const t = (i * Math.PI) / 720, u = Math.cos(t), v = Math.sin(t), px = Math.hypot(el.A[0] * u + el.A[1] * v, el.A[2] * u + el.A[3] * v), passo = 0.25 / px;
    let estado = 0, marcados = 0;
    for (let rho = 1.15; rho > 0.4 && estado < 4; rho -= passo) {
      const x = Math.floor(el.cx + (el.A[0] * u + el.A[1] * v) * rho), y = Math.floor(el.cy + (el.A[2] * u + el.A[3] * v) * rho);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = y * W + x, op = d[k * 4 + 3], esc = op && media(d, k * 4) < 60;
      if (estado === 0) { if (op) estado = esc ? 1 : 2; }
      else if (estado === 1) { if (op && !esc) estado = 2; else if (!op) break; }
      else if (estado === 2) { if (esc) { estado = 3; doAro[k] = 1; marcados = 1; } else if (!op) break; }
      else if (estado === 3) { if (esc && marcados < 2) { if (!doAro[k]) marcados++; doAro[k] = 1; } else estado = 4; }
    }
  }
  // A FAIXA DO ARO (11/11/2026, relato dele: "ainda existem pedaços da pá estáticos"): nas vistas de frente, as pás quase encostam
  // no aro, e a ponta delas caía na margem e ficava parada. Na faixa, o vazio é vazio (o aro nunca é transparente), e a pá CRESCE
  // para dentro dela pelo bege da própria pá, pixel a pixel; o contorno escuro de dentro do aro segura, e o aro não entra.
  const naFaixa = (x, y) => {
    const dx = x + 0.5 - el.cx, dy = y + 0.5 - el.cy, u = Ai[0] * dx + Ai[1] * dy, v = Ai[2] * dx + Ai[3] * dy, r = Math.hypot(u, v);
    return r < 1 && r > 1e-6 && ((1 - r) * Math.hypot(dx, dy)) / r >= 1 && !dentro(x, y);
  };
  const fila = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (cls[k] === 2) fila.push(k);
    else if (!cls[k] && naFaixa(x, y) && !d[k * 4 + 3]) cls[k] = 1;
  }
  for (let q = 0; q < fila.length; q++) {
    const k = fila[q], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy, j = Y * W + X;
      if (cls[j] || !naFaixa(X, Y) || !d[j * 4 + 3]) continue;
      const m = media(d, j * 4);
      if (m < 100 || m >= 190 || doAro[j]) continue;
      cls[j] = 2; fila.push(j);
    }
  }
  // e o CONTORNO da ponta (relato dele: "pequenos contornos pretos soltos"): na faixa, o escuro que não encosta no corpo claro do
  // aro é o contorno da pá, e gira com ela; o que encosta no aro é o contorno do aro, e fica
  const corpoDoAro = (j) => !cls[j] && d[j * 4 + 3] && media(d, j * 4) >= 100;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x;
    if (cls[k] || doAro[k] || !d[k * 4 + 3] || media(d, k * 4) >= 100 || !naFaixa(x, y)) continue;
    let aro = false, pa = false;
    // (o contorno do aro encosta no corpo dele de LADO; pela diagonal só encostam as pontas das pás)
    for (const j of [k - 1, k + 1, k - W, k + W]) if (corpoDoAro(j)) aro = true;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (cls[k + b * W + a] === 2) pa = true;
    if (!aro && pa) cls[k] = 5;
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
  // (só o escuro a até 2 px do corpo claro do aro: um raio que passa por uma vareta e cai no motor marcava um pixel do motor)
  for (let k = 0; k < W * H; k++) if (doAro[k]) {
    let perto = false;
    for (let b = -2; b <= 2 && !perto; b++) for (let a = -2; a <= 2; a++) { const j = k + b * W + a; if (j >= 0 && j < W * H && d[j * 4 + 3] && media(d, j * 4) >= 100 && !dentro(j % W, (j / W) | 0)) { perto = true; break; } }
    if (!perto) doAro[k] = 0;
  }
  for (let k = 0; k < W * H; k++) if (doAro[k]) cls[k] = 0; // o contorno do aro, parado
  return { cls, dentro, doAro };
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
    // (11/11/2026: pelo RECHEIO do bloco, mais 2 px do contorno; o bloco inteiro traz as varetas coladas, e o raio chegava a 36% do
    // aro, parando a raiz das pás em volta do miolo: relato dele, "ainda tem pá parada")
    const Ai = inversa(el.A), raioMedio = Math.sqrt(Math.abs(el.A[0] * el.A[3] - el.A[1] * el.A[2])); let miolo = 0;
    for (const k of nuc) { const dx = (k % W) + 0.5 - cx, dy = ((k / W) | 0) + 0.5 - cy, u = Ai[0] * dx + Ai[1] * dy, v = Ai[2] * dx + Ai[3] * dy; miolo = Math.max(miolo, Math.hypot(u, v)); }
    return { cx, cy, deCostas: false, miolo: Math.min(0.32, miolo + 2 / raioMedio) };
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
    if (base.fixo[k]) continue; // o miolo e o contorno dele, parados
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
    if (base.fixo[k]) continue;
    let n = 0; const soma = [0, 0, 0];
    for (const M of Ms) {
      const sx = Math.floor(eixo.cx + M[0] * dx + M[1] * dy), sy = Math.floor(eixo.cy + M[2] * dx + M[3] * dy), s = sy * W + sx;
      if (sx >= 0 && sy >= 0 && sx < W && sy < H && pa[s] === 1) { n++; for (let q = 0; q < 3; q++) soma[q] += d[s * 4 + q]; }
    }
    const i = k * 4, cob = n / K, xadrez = ((k % W) + ((k / W) | 0) + f) & 1;
    // (com o MOTOR atrás, a cor da pá misturada à dele, na proporção do tempo em que a pá passa: o pontilhado de pá e motor, e os
    // vãos, viravam pontinhos pretos soltos no meio do rastro, relato dele)
    const temMotor = !deCostas && fundo.tem[k];
    if (temMotor && n) { for (let q = 0; q < 3; q++) out.data[i + q] = Math.round((soma[q] / n) * cob + fundo.fundo[i + q] * (1 - cob)); out.data[i + 3] = 255; }
    else if (!temMotor && (cob >= 0.6 || (cob >= 0.3 && xadrez))) { for (let q = 0; q < 3; q++) out.data[i + q] = Math.round(soma[q] / n); out.data[i + 3] = 255; }
    else if (!deCostas && fundo.tem[k]) for (let q = 0; q < 4; q++) out.data[i + q] = fundo.fundo[i + q];
    else for (let q = 0; q < 4; q++) out.data[i + q] = 0;
  }
  return out;
}

export function prepararHelice(im) {
  const cab = cabecaDe(im), el = elipseDe(im, cab), { cls, doAro } = classes(im, el), eixo = centroDoEixo(im, el, cls), { deCostas } = eixo;
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
  // AS TRÊS PÁS IGUAIS (11/11/2026, relato dele, quadro a quadro: a ponta da pá "parada" junto do aro). No desenho, uma pá tem a
  // ponta à vista e outra a tem escondida (pelo motor, pelo aro, pela espessura do aro por dentro); girada até o lugar da outra, a
  // pá sem ponta chegava sem ponta, e a ponta aparecia num quadro e sumia nos outros. As pás se repetem a cada 120°: o que falta
  // numa se completa com as outras duas giradas. O que esconde a ponta continua escondendo, igual em todos os quadros.
  const completa = Uint8Array.from(pa), dc = new Uint8ClampedArray(d);
  const R = [noPlano(el.A, (2 * Math.PI) / 3), noPlano(el.A, (4 * Math.PI) / 3)];
  for (let k = 0; k < cls.length; k++) {
    if (pa[k] === 1) continue;
    const x = (k % W) + 0.5 - eixo.cx, y = ((k / W) | 0) + 0.5 - eixo.cy;
    for (const M of R) {
      const sx = Math.floor(eixo.cx + M[0] * x + M[1] * y), sy = Math.floor(eixo.cy + M[2] * x + M[3] * y), s = sy * W + sx;
      if (sx < 0 || sy < 0 || sx >= W || sy >= im.height || pa[s] !== 1) continue;
      completa[k] = 1; for (let q = 0; q < 4; q++) dc[k * 4 + q] = d[s * 4 + q];
      break;
    }
  }
  // O MIOLO PARADO E O CÍRCULO PRETO DELE (11/11/2026, relato dele: "senti falta do círculo preto do meio"): o miolo é o raio de
  // antes, mais o contorno escuro colado nele (até 10 px além) e o que fica fechado dentro desse contorno: o centro é puxado para
  // cima pela vareta, e o raio sozinho deixava o fundo do miolo e o contorno girando com o rastro.
  const fixo = new Uint8Array(cls.length);
  if (eixo.miolo) {
    const Ai = inversa(el.A), raio = Math.sqrt(Math.abs(el.A[0] * el.A[3] - el.A[1] * el.A[2]));
    const rE = (k) => { const dx = (k % W) + 0.5 - eixo.cx, dy = ((k / W) | 0) + 0.5 - eixo.cy; return Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy); };
    for (let k = 0; k < cls.length; k++) if (rE(k) <= eixo.miolo) fixo[k] = 1;
    for (let rodada = 0; rodada < 2; rodada++) {
      for (let volta = 0; volta < 8; volta++) {
        const novos = [];
        for (let k = W; k < cls.length - W; k++) {
          if (fixo[k] || !im.data[k * 4 + 3] || media(im.data, k * 4) >= 60 || rE(k) > eixo.miolo + 10 / raio) continue;
          for (let b = -1; b <= 1 && !fixo[k]; b++) for (let a = -1; a <= 1; a++) if (fixo[k + b * W + a]) { novos.push(k); break; }
        }
        for (const k of novos) fixo[k] = 1;
      }
      // o que ficou FECHADO dentro do contorno (a parte de baixo do miolo, que o centro, puxado pela vareta de cima, deixava de fora)
      const H2 = im.height; const bate = (x, y, dx, dy) => { for (let i = 1; i <= 10; i++) { const X = x + dx * i, Y = y + dy * i; if (X < 0 || Y < 0 || X >= W || Y >= H2) return false; if (fixo[Y * W + X]) return true; } return false; };
      const dentroDoContorno = [];
      for (let k = 0; k < cls.length; k++) { const x = k % W, y = (k / W) | 0; if (!fixo[k] && im.data[k * 4 + 3] && rE(k) <= eixo.miolo + 10 / raio && bate(x, y, 1, 0) && bate(x, y, -1, 0) && bate(x, y, 0, 1) && bate(x, y, 0, -1)) dentroDoContorno.push(k); }
      for (const k of dentroDoContorno) fixo[k] = 1;
    }
  }
  // (só o escuro que ENCOSTA no interior claro do miolo é o contorno dele: o contorno de uma pá que sai do miolo não encosta, e gira)
  if (eixo.miolo) {
    const claroFixo = (j) => fixo[j] && im.data[j * 4 + 3] && media(im.data, j * 4) >= 60, solto = [];
    for (let k = W; k < cls.length - W; k++) {
      if (!fixo[k] || !im.data[k * 4 + 3] || media(im.data, k * 4) >= 60) continue;
      let encosta = false; for (let b = -1; b <= 1 && !encosta; b++) for (let a = -1; a <= 1; a++) if (claroFixo(k + b * W + a)) { encosta = true; break; }
      if (!encosta) solto.push(k);
    }
    for (const k of solto) fixo[k] = 0;
  }
  const fundo = deCostas ? { tem: new Uint8Array(cls.length) } : fundoDoMotor(im, cls);
  return { el, cls, eixo, deCostas, fundo, pa: completa, d: dc, contorno, fixo, doAro };
}

export function quadrosDaHelice(im) {
  const base = prepararHelice(im);
  const sentido = base.deCostas ? -1 : 1;
  // (RASTRO=0: as pás giradas, sem o rastro; o quadro 0 é então a vista parada)
  if (process.env.RASTRO === '0') return { base, quadros: Array.from({ length: PASSOS }, (_, f) => (f === 0 ? im : girar(im, base, sentido * f * PASSO))) };
  return { base, quadros: Array.from({ length: PASSOS }, (_, f) => semPontinhos(borrar(im, base, sentido * f * PASSO, f), base)) };
}

// OS PONTINHOS (11/11/2026, relato dele quadro a quadro: "ainda tem artefatos"): dentro do aro, um grupo escuro de até 3 px (resto
// de contorno de ponta, de vareta, de motor) vira a cor dos vizinhos claros. O contorno do aro, o do miolo e o do motor são linhas
// maiores, e não são tocados; o que encosta no miolo também fica.
function semPontinhos(q, { el, eixo, doAro }) {
  const { width: W, height: H, data: d } = q, Ai = inversa(el.A), out = new PNG({ width: W, height: H });
  d.copy(out.data);
  const escuro = (k) => d[k * 4 + 3] && media(d, k * 4) < 60;
  const rAro = (k) => { const dx = (k % W) + 0.5 - el.cx, dy = ((k / W) | 0) + 0.5 - el.cy; return Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy); };
  const rEixo = (k) => { const dx = (k % W) + 0.5 - eixo.cx, dy = ((k / W) | 0) + 0.5 - eixo.cy; return Math.hypot(Ai[0] * dx + Ai[1] * dy, Ai[2] * dx + Ai[3] * dy); };
  const raio = Math.sqrt(Math.abs(el.A[0] * el.A[3] - el.A[1] * el.A[2])), folga = 2 / raio;
  const visto = new Uint8Array(W * H);
  for (let k0 = W; k0 < W * (H - 1); k0++) {
    if (visto[k0] || !escuro(k0) || rAro(k0) >= 0.97 || doAro[k0]) continue;
    // o grupo escuro (até 4 px; maior que isso é linha de verdade: o contorno do aro, do miolo, do motor)
    const g = [k0]; visto[k0] = 1;
    for (let i = 0; i < g.length && g.length <= 4; i++) { const k = g[i]; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const j = k + b * W + a; if (!visto[j] && escuro(j)) { visto[j] = 1; g.push(j); } } }
    if (g.length > 3) continue;
    if (g.some((k) => rEixo(k) <= (eixo.miolo || 0) + folga)) continue; // o contorno do miolo
    for (const k of g) {
      const soma = [0, 0, 0, 0]; let n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const j = k + b * W + a; if ((a || b) && d[j * 4 + 3] && !escuro(j)) { for (let c = 0; c < 4; c++) soma[c] += d[j * 4 + c]; n++; } }
      if (n >= 2) for (let c = 0; c < 4; c++) out.data[k * 4 + c] = Math.round(soma[c] / n); else out.data[k * 4 + 3] = 0;
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'))) {
  const saida = path.join(AQUI, 'avulsos', 'ventilador-girando');
  fs.mkdirSync(saida, { recursive: true });
  for (const dir of DIRECOES) {
    const im = ler(path.join(AQUI, 'avulsos', 'ventilador-giros-limpos', dir + '.png')), { base, quadros } = quadrosDaHelice(im);
    quadros.forEach((q, f) => fs.writeFileSync(path.join(saida, `${dir}-${f}.png`), PNG.sync.write(q)));
    console.log(dir, 'eixo', base.eixo.cx.toFixed(1), base.eixo.cy.toFixed(1), base.deCostas ? 'de costas' : 'de frente');
  }
  const osc = path.join(AQUI, 'avulsos', 'ventilador-oscilar');
  if (fs.existsSync(osc)) {
    const saidaO = path.join(AQUI, 'avulsos', 'ventilador-oscilando');
    fs.mkdirSync(saidaO, { recursive: true });
    for (const dir of DIRECOES) {
      const qs = fs.readdirSync(osc).filter((f) => f.startsWith(dir + '-') && /-\d+\.png$/.test(f)).sort((a, b) => Number(a.match(/-(\d+)\.png$/)[1]) - Number(b.match(/-(\d+)\.png$/)[1]));
      qs.forEach((f, n) => {
        // (os quadros já vêm montados por ventilador-oscilacao.mjs: a cabeça alinhada pelo eixo sobre a base parada)
        const { quadros } = quadrosDaHelice(ler(path.join(osc, f)));
        quadros.forEach((q, g) => fs.writeFileSync(path.join(saidaO, `${dir}-${n}-${g}.png`), PNG.sync.write(q)));
      });
      if (qs.length) console.log(dir, qs.length, 'quadros oscilando');
    }
  }
}
