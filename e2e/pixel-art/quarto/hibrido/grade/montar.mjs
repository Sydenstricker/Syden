// O teste da grade (grade.html): o pufe é uma peça solta que se arrasta pelas casas livres do chão (8×8), e a
// luz em cada casa é CALCULADA, não pintada. O pufe foi recortado da pintura de dia; de noite, ele é
// multiplicado pela razão noite/dia do chão embaixo dele (o mapa de luz: perto do abajur fica quente, longe
// fica escuro, e a cor do próprio chão se cancela na divisão). Mais uma sombra de contato no chão.
//   node e2e/pixel-art/quarto/hibrido/grade/montar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ler64 } from '../../imagem.mjs';
import { CANTOS, N } from './chao.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HIB = path.join(AQUI, '..');
const ESCALA = 3, W = 313, H = 314;

// As casas livres: onde não há móvel pintado (ver ver-grade.png). O pufe ocupa 2×2 casas.
const LIVRES = ['23', '24', '33', '34', '35', '36', '42', '43', '44', '45', '46', '47', '52', '53', '54', '55', '56', '57', '63', '64', '65', '66', '67', '73', '74', '75', '76', '77', '37'];
// Onde o pufe estava na pintura: o vértice da grade no meio das casas 35, 36, 45 e 46, e o canto de cima à
// esquerda do recorte (grade/preparar.mjs).
const ORIGEM = { u: 4, v: 6, recorte: [162, 211] };
// A luz da janela, de dia: o sol entra pela janela da parede direita e cai no chão em frente a ela. É desenhada
// e não medida, porque na pintura de dia não dá para separar a luz da cor do chão (tapete verde × madeira).
// forca: quanto ela soma à luz ambiente no centro; raio: o quanto ela se espalha; cor: levemente quente.
const SOL = { centro: [205, 165], raio: 62, ambiente: 0.8, forca: 0.45, cor: [1.04, 1.0, 0.93], lado: 0.22 };

const dados = {
  W, H, N, k: ESCALA, CANTOS, LIVRES, ORIGEM, SOL,
  noite: ler64(path.join(AQUI, 'noite-sem-pufe.png')),
  dia: ler64(path.join(AQUI, 'dia-sem-pufe.png')),
  noiteOriginal: ler64(path.join(HIB, 'noite.png')),
  diaOriginal: ler64(path.join(HIB, 'dia.png')),
  pufe: ler64(path.join(AQUI, 'pufe.png')),
};

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Quarto do coelho — a grade</title>
<style>
  body { margin:0; background:#1d1a20; color:#efe3d3; font:15px system-ui, sans-serif; display:flex; flex-direction:column; align-items:center; gap:12px; padding:20px; }
  canvas { width:${W * ESCALA}px; height:${H * ESCALA}px; image-rendering:pixelated; touch-action:none; }
  .controles { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; }
  .controles button { background:#4a3442; color:#efe3d3; border:0; border-radius:8px; padding:8px 14px; font:inherit; cursor:pointer; }
  .controles button[aria-pressed="true"] { background:#7a5236; }
  p.nota { max-width:780px; color:#b9afbb; font-size:13px; text-align:center; margin:0; }
</style></head>
<body>
  <div class="controles">
    <button id="luz">Amanhecer</button>
    <button id="arrumar" aria-pressed="false">Arrumar</button>
    <button id="original" aria-pressed="false">Ver o pufe pintado original</button>
  </div>
  <canvas id="tela" width="${W}" height="${H}"></canvas>
  <p class="nota">Teste da grade, fora do Syden. Em "Arrumar", arraste o pufe: ele só para nas casas livres do chão (8×8).
  A luz dele em cada lugar é calculada pelo mapa de luz do quarto, não pintada. "Ver o pufe pintado original" mostra a
  pintura de antes, para comparar.</p>
<script>
const D = ${JSON.stringify(dados)};
const tela = document.getElementById('tela'), g = tela.getContext('2d');
g.imageSmoothingEnabled = false;
const estado = { noite: true, arrumando: false, original: false, pos: { u: D.ORIGEM.u, v: D.ORIGEM.v }, arrastando: null, mira: null, sobre: false };

function ponto(u, v) {
  const { fundo: B, esquerda: L, direita: R, frente: F } = D.CANTOS, a = u / D.N, b = v / D.N;
  return [0, 1].map((k) => B[k] * (1 - a) * (1 - b) + L[k] * a * (1 - b) + R[k] * (1 - a) * b + F[k] * a * b);
}
const livre = new Set(D.LIVRES);
// Um vértice (u, v) serve para o pufe se as quatro casas em volta estão livres.
const cabe = (u, v) => [[u - 1, v - 1], [u - 1, v], [u, v - 1], [u, v]].every(([i, j]) => livre.has('' + i + j));
const vertices = [];
for (let u = 1; u < D.N; u++) for (let v = 1; v < D.N; v++) if (cabe(u, v)) vertices.push({ u, v });

const carregar = (b) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + b; });
const pixels = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };

let img, luz, pufeDados, ancora;
(async () => {
  img = { noite: await carregar(D.noite), dia: await carregar(D.dia), noiteOriginal: await carregar(D.noiteOriginal), diaOriginal: await carregar(D.diaOriginal), pufe: await carregar(D.pufe) };
  // O mapa de luz: razão noite/dia de cada pixel, suavizada (média de 13×13) para tirar a textura do chão.
  const n = pixels(img.noite), d = pixels(img.dia), R = 6;
  const bruto = new Float32Array(D.W * D.H * 3);
  for (let i = 0; i < D.W * D.H; i++) for (let k = 0; k < 3; k++) bruto[i * 3 + k] = (n[i * 4 + k] + 4) / (d[i * 4 + k] + 4);
  luz = new Float32Array(D.W * D.H * 3);
  for (let y = 0; y < D.H; y++) for (let x = 0; x < D.W; x++) {
    let s = [0, 0, 0], c = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= D.W || yy >= D.H) continue;
      const i = (yy * D.W + xx) * 3; s[0] += bruto[i]; s[1] += bruto[i + 1]; s[2] += bruto[i + 2]; c++;
    }
    const i = (y * D.W + x) * 3; for (let k = 0; k < 3; k++) luz[i + k] = Math.min(1.5, s[k] / c);
  }
  // A âncora: o pixel do recorte que estava sobre o vértice original. Ele vai junto para qualquer vértice.
  const [ox, oy] = ponto(D.ORIGEM.u, D.ORIGEM.v);
  ancora = [ox - D.ORIGEM.recorte[0], oy - D.ORIGEM.recorte[1]];
  pufeDados = pixels(img.pufe);
  // Que casa é cada pixel do chão (-1: nenhuma). Cada casa é um quadrilátero; testa-se o pixel no centro.
  casaDe = new Int16Array(D.W * D.H).fill(-1);
  for (let i = 0; i < D.N; i++) for (let j = 0; j < D.N; j++) {
    const q = [ponto(i, j), ponto(i + 1, j), ponto(i + 1, j + 1), ponto(i, j + 1)];
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (x < 0 || y < 0 || x >= D.W || y >= D.H) continue;
      if (dentro(x + 0.5, y + 0.5, q)) casaDe[y * D.W + x] = i * D.N + j;
    }
  }
  desenhar();
})();

let casaDe;
function dentro(px, py, q) {
  let s = false;
  for (let a = 0, b = q.length - 1; a < q.length; b = a++) {
    const [xa, ya] = q[a], [xb, yb] = q[b];
    if ((ya > py) !== (yb > py) && px < ((xb - xa) * (py - ya)) / (yb - ya) + xa) s = !s;
  }
  return s;
}
/** Pinta um conjunto de casas em pixel: o miolo com uma cor, a borda (onde o vizinho é de fora) com outra. */
function pintarCasas(casas, miolo, borda, sombra) {
  const im = g.getImageData(0, 0, D.W, D.H), a = im.data;
  const mistura = (i, [r, gg, b, al]) => { a[i] = a[i] * (1 - al) + r * al; a[i + 1] = a[i + 1] * (1 - al) + gg * al; a[i + 2] = a[i + 2] * (1 - al) + b * al; };
  for (let y = 1; y < D.H - 1; y++) for (let x = 1; x < D.W - 1; x++) {
    const c = casaDe[y * D.W + x]; if (c < 0 || !casas.has(c)) continue;
    const i = (y * D.W + x) * 4;
    const vizinhos = [casaDe[y * D.W + x + 1], casaDe[y * D.W + x - 1], casaDe[(y + 1) * D.W + x], casaDe[(y - 1) * D.W + x]];
    const ehBorda = vizinhos.some((v) => v !== c);
    if (ehBorda) { mistura(i, borda); if (sombra) mistura(i + D.W * 4, sombra); }
    else if (miolo) mistura(i, miolo);
  }
  g.putImageData(im, 0, 0);
}
const canto = (u, v) => { const [x, y] = ponto(u, v); return [Math.round(x - ancora[0]), Math.round(y - ancora[1])]; };

/** O sol num ponto do chão: 1 é a luz ambiente pura; perto da janela passa de 1. */
const sol = (x, y) => { const d2 = (x - D.SOL.centro[0]) ** 2 + (y - D.SOL.centro[1]) ** 2; return D.SOL.ambiente + D.SOL.forca * Math.exp(-d2 / (2 * D.SOL.raio ** 2)); };
/**
 * O pufe iluminado para o lugar (x0, y0). O recorte veio da pintura de dia, já com a luz do lugar ORIGINAL;
 * primeiro essa luz é tirada (divide pelo sol de lá), depois a do lugar novo entra:
 *   dia:   o sol embaixo de cada coluna, mais claro no lado voltado para a janela;
 *   noite: o mesmo, vezes a razão noite/dia medida no chão (o abajur, o monitor, o escuro).
 */
function pufeIluminado(x0, y0) {
  const w = img.pufe.width, h = img.pufe.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); const out = x.createImageData(w, h);
  const pe = Math.min(D.H - 1, Math.round(y0 + h - 4));
  const [ox, oy] = ponto(D.ORIGEM.u, D.ORIGEM.v);
  const solDeLa = sol(ox, oy);
  // De que lado está a janela, visto do pufe: +1 se à direita, -1 se à esquerda.
  const lado = Math.sign(D.SOL.centro[0] - (x0 + w / 2)) || 1;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const i = (py * w + px) * 4; if (!pufeDados[i + 3]) continue;
    const gx = Math.max(0, Math.min(D.W - 1, x0 + px));
    const s = sol(gx, pe);
    const voltado = 1 + D.SOL.lado * (s - D.SOL.ambiente) / D.SOL.forca * lado * ((px - w / 2) / (w / 2));
    for (let k = 0; k < 3; k++) {
      const corDoSol = 1 + (D.SOL.cor[k] - 1) * (s - D.SOL.ambiente) / D.SOL.forca;
      let l = (s / solDeLa) * voltado * corDoSol;
      if (estado.noite) l *= luz[(pe * D.W + gx) * 3 + k];
      out.data[i + k] = Math.max(0, Math.min(255, pufeDados[i + k] * l));
    }
    out.data[i + 3] = 255;
  }
  x.putImageData(out, 0, 0);
  return c;
}

function desenhar() {
  if (!img) return;
  const cena = estado.original ? (estado.noite ? img.noiteOriginal : img.diaOriginal) : (estado.noite ? img.noite : img.dia);
  g.clearRect(0, 0, D.W, D.H);
  g.drawImage(cena, 0, 0);
  if (estado.original) return;
  if (estado.arrumando) {
    // As casas livres: a borda de cada uma em 1 pixel claro com 1 pixel escuro embaixo, para ler tanto no
    // tapete quanto na madeira. O lugar do pufe: o miolo aceso e a borda forte.
    pintarCasas(new Set(D.LIVRES.map((t) => +t[0] * D.N + +t[1])), null, [247, 230, 196, 0.55], [30, 20, 26, 0.35]);
    const alvo = estado.mira ?? estado.pos;
    const ocupa = new Set([[alvo.u - 1, alvo.v - 1], [alvo.u - 1, alvo.v], [alvo.u, alvo.v - 1], [alvo.u, alvo.v]].map(([i, j]) => i * D.N + j));
    pintarCasas(ocupa, [247, 230, 196, 0.18], [247, 230, 196, 0.95], [30, 20, 26, 0.5]);
  }
  const p = estado.mira ?? estado.pos;
  const [x0, y0] = canto(p.u, p.v);
  // A sombra de contato: uma elipse escura no chão, sob o pé.
  const [cx, cy] = ponto(p.u, p.v);
  g.save(); g.fillStyle = estado.noite ? 'rgba(10,6,12,.45)' : 'rgba(40,24,20,.30)';
  g.beginPath(); g.ellipse(Math.round(cx), Math.round(cy + 1), Math.round(img.pufe.width * 0.48), 7, 0, 0, Math.PI * 2); g.fill(); g.restore();
  const pufe = pufeIluminado(x0, y0);
  if (estado.sobre || estado.arrastando) {
    // O mesmo contorno de 1 pixel dos objetos clicáveis.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.save(); g.globalAlpha = 1; g.drawImage(contorno(), x0 + dx, y0 + dy); g.restore(); }
  }
  g.drawImage(pufe, x0, y0);
}
function losango(pts, fundo, linha) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = fundo; g.fill(); g.strokeStyle = linha; g.lineWidth = 1; g.stroke();
}
let _contorno;
function contorno() {
  if (_contorno) return _contorno;
  const c = document.createElement('canvas'); c.width = img.pufe.width; c.height = img.pufe.height;
  const x = c.getContext('2d'); x.drawImage(img.pufe, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#f7e6c4'; x.fillRect(0, 0, c.width, c.height);
  return (_contorno = c);
}

function noPufe(px, py) {
  const [x0, y0] = canto(estado.pos.u, estado.pos.v);
  const x = px - x0, y = py - y0;
  if (x < 0 || y < 0 || x >= img.pufe.width || y >= img.pufe.height) return false;
  return pufeDados[(y * img.pufe.width + x) * 4 + 3] > 0;
}
function naTela(e) { const r = tela.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / D.k), Math.floor((e.clientY - r.top) / D.k)]; }
function verticeMaisPerto(px, py) {
  let melhor = null, dist = Infinity;
  for (const vt of vertices) { const [x, y] = ponto(vt.u, vt.v); const dd = (x - px) ** 2 + (y - py) ** 2; if (dd < dist) { dist = dd; melhor = vt; } }
  return melhor;
}
tela.addEventListener('pointerdown', (e) => {
  if (!img || estado.original) return;
  const [x, y] = naTela(e);
  if (!estado.arrumando || !noPufe(x, y)) return;
  const [vx, vy] = ponto(estado.pos.u, estado.pos.v);
  estado.arrastando = { dx: vx - x, dy: vy - y };
  tela.setPointerCapture(e.pointerId);
  desenhar();
});
tela.addEventListener('pointermove', (e) => {
  if (!img || estado.original) return;
  const [x, y] = naTela(e);
  if (estado.arrastando) { estado.mira = verticeMaisPerto(x + estado.arrastando.dx, y + estado.arrastando.dy); desenhar(); return; }
  const sobre = noPufe(x, y);
  tela.style.cursor = sobre ? (estado.arrumando ? 'grab' : 'pointer') : 'default';
  if (sobre !== estado.sobre) { estado.sobre = sobre; desenhar(); }
});
const soltar = () => { if (!estado.arrastando) return; if (estado.mira) estado.pos = estado.mira; estado.arrastando = null; estado.mira = null; desenhar(); };
tela.addEventListener('pointerup', soltar);
tela.addEventListener('pointercancel', () => { estado.arrastando = null; estado.mira = null; desenhar(); });

const botao = (id, chave, textos) => document.getElementById(id).onclick = (e) => {
  estado[chave] = !estado[chave]; e.target.setAttribute('aria-pressed', estado[chave]);
  if (textos) e.target.textContent = textos[+estado[chave]];
  desenhar();
};
document.getElementById('luz').onclick = (e) => { estado.noite = !estado.noite; e.target.textContent = estado.noite ? 'Amanhecer' : 'Anoitecer'; desenhar(); };
botao('arrumar', 'arrumando', ['Arrumar', 'Pronto']);
botao('original', 'original', ['Ver o pufe pintado original', 'Voltar ao pufe solto']);
// Para o teste automático: põe o pufe num vértice.
window.porPufe = (u, v) => { if (cabe(u, v)) { estado.pos = { u, v }; desenhar(); return true; } return false; };
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'grade.html'), html);
console.log('grade.html', Math.round(html.length / 1024), 'KB');
