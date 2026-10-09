// Monta janela.html: a base sem porta (pl-512-janela-1) com a vista ATRÁS do vidro, de dia e de noite, e as quatro
// paisagens de dia para escolher. A vista entra pixel por pixel (1 px da vista = 1 px do quarto), só onde a máscara
// do vidro (vidro.png) deixa, com um véu leve da cor do vidro para parecer que há vidro.
//   node e2e/pixel-art/quarto/novo/janela/montar.mjs   → janela.html
import fs from 'node:fs';
import path from 'node:path';
import { ler64 } from '../../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const png = (f) => 'data:image/png;base64,' + ler64(path.join(AQUI, f));
const IMAGENS = {
  dia: 'data:image/png;base64,' + ler64(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png')),
  noite: png('noite-pintada.png'), vidro: png('vidro.png'), vistasNoite: [1, 2, 3, 4].map((n) => png(`vista-noite-${n}.png`)),
  vistas: [1, 2, 3, 4].map((n) => png(`vista-dia-${n}.png`)),
};
const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Janela com vista</title>
<style>
  :root { --fundo: #2a2522; --texto: #efe6dc; --suave: #b9ab9c; --botao: #4a3f38; --ativo: #8a6a4a; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 1100px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: var(--suave); max-width: 80ch; }
  .barra { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  button { background: var(--botao); color: var(--texto); border: 0; border-radius: 6px; padding: 8px 14px; font: inherit; cursor: pointer; }
  button[aria-pressed="true"] { background: var(--ativo); }
  button:disabled { opacity: .4; cursor: default; }
  .lado { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; align-items: start; }
  @media (max-width: 760px) { .lado { grid-template-columns: 1fr; } }
  canvas { width: 100%; aspect-ratio: 1; image-rendering: pixelated; display: block; }
  #perto { aspect-ratio: 96 / 140; }
  figcaption { color: var(--suave); font-size: 13px; margin-top: 4px; }
  figure { margin: 0; }
</style></head>
<body><main>
<h1>A janela com vista</h1>
<p>A base sem porta, com uma paisagem atrás do vidro. A vista é uma imagem à parte: troca com a hora e pode trocar por
tema. De noite é a mesma paisagem, editada.</p>
<div class="barra">
  <button id="b-dia" aria-pressed="true">Dia</button><button id="b-noite" aria-pressed="false">Noite</button>
  <span style="width:12px"></span>
  <button data-vista="0" aria-pressed="true">Vista 1</button><button data-vista="1" aria-pressed="false">Vista 2</button>
  <button data-vista="2" aria-pressed="false">Vista 3</button><button data-vista="3" aria-pressed="false">Vista 4</button>
</div>
<div class="lado">
  <figure><canvas id="tela" width="512" height="512" aria-label="O quarto com a janela"></canvas></figure>
  <figure><canvas id="perto" width="96" height="140" aria-label="A janela de perto"></canvas><figcaption>A janela de perto.</figcaption></figure>
</div>
</main>
<script>
const IMAGENS = ${JSON.stringify(IMAGENS)};
const W = 512, CAIXILHO = [336, 106, 432, 246];
// A noite: a edição da base manchou a parede da esquerda as duas vezes (falhas/), mas o chão (com o luar desenhado)
// e a janela com as cortinas saíram bons. Então: chão e janela vêm da pintura; as paredes são o dia vezes a luz
// MÉDIA daquela noite, bem borrada, o que guarda o degradê e apaga as manchas.
const CHAO = [[256, 226], [40, 340], [256, 456], [472, 340]], JANELA = [272, 60, 470, 340];
const carregar = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = src; });
function dados(im, w = W, h = W) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data; }
(async () => {
  const imDia = await carregar(IMAGENS.dia), imNoite = await carregar(IMAGENS.noite);
  const dia = dados(imDia), pintada = dados(imNoite), vidro = dados(await carregar(IMAGENS.vidro));
  // O fundo cinza em volta do quarto fica transparente (preenchido a partir da borda), um para cada versão.
  function fundoDe(img) {
    const fora = new Uint8Array(W * W), fila = [];
    const parecido = (k) => [0, 1, 2].every((c) => Math.abs(img[k * 4 + c] - img[c]) < 24);
    for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!fora[k] && parecido(k)) { fora[k] = 1; fila.push(k); }
    for (let q = 0; q < fila.length; q++) {
      const k = fila[q], x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, b = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < W && !fora[b] && parecido(b)) { fora[b] = 1; fila.push(b); } }
    }
    return fora;
  }
  // Borra só o quarto: o cinza de fora, transparente, não entra na média (senão as pontas do friso clareiam).
  const foraDia0 = fundoDe(dia);
  const borrar = (img) => {
    const c = document.createElement('canvas'); c.width = W; c.height = W; const g = c.getContext('2d');
    const d = new ImageData(new Uint8ClampedArray(img), W, W);
    for (let k = 0; k < W * W; k++) if (foraDia0[k]) d.data[k * 4 + 3] = 0;
    g.putImageData(d, 0, 0);
    const b = document.createElement('canvas'); b.width = W; b.height = W; const gb = b.getContext('2d'); gb.filter = 'blur(28px)'; gb.drawImage(c, 0, 0);
    return gb.getImageData(0, 0, W, W).data;
  };
  const diaB = borrar(dia), noiteB = borrar(pintada);
  const dentro = (x, y, q) => { let s = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  const noite = new Uint8ClampedArray(W * W * 4);
  for (let k = 0; k < W * W; k++) {
    const x = k % W, y = (k / W) | 0;
    const daPintura = dentro(x + 0.5, y + 0.5, CHAO) || (x >= JANELA[0] && x < JANELA[2] && y >= JANELA[1] && y < JANELA[3]);
    for (let c = 0; c < 3; c++) noite[k * 4 + c] = daPintura ? pintada[k * 4 + c] : dia[k * 4 + c] * Math.min(1, noiteB[k * 4 + c] / Math.max(1, diaB[k * 4 + c]));
    noite[k * 4 + 3] = 255;
  }
  const vistas = [];
  for (const v of IMAGENS.vistas) vistas.push(dados(await carregar(v), 128, 160));
  const vistasNoite = [];
  for (const v of IMAGENS.vistasNoite) vistasNoite.push(dados(await carregar(v), 128, 160));
  const foraDia = foraDia0, foraNoite = fundoDe(pintada);
  // Pixels claros soltos na borda de fora do friso viram a cor do contorno (ver ../quarto/montar.mjs).
  function contorno(img, fora) {
    for (let k = 0; k < W * W; k++) {
      if (fora[k] || img[k * 4] + img[k * 4 + 1] + img[k * 4 + 2] <= 360) continue;
      const x = k % W, y = (k / W) | 0, viz = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => (y + dy) * W + x + dx);
      if (viz.filter((n) => fora[n]).length < 2) continue;
      const escuro = viz.filter((n) => !fora[n]).sort((p, q) => img[p * 4] + img[p * 4 + 1] + img[p * 4 + 2] - (img[q * 4] + img[q * 4 + 1] + img[q * 4 + 2]))[0];
      if (escuro !== undefined) for (let c = 0; c < 3; c++) img[k * 4 + c] = img[escuro * 4 + c];
    }
  }
  contorno(dia, foraDia); contorno(noite, foraNoite);
  let modo = 'dia', vista = 0;
  const tela = document.getElementById('tela'), g = tela.getContext('2d');
  const perto = document.getElementById('perto'), gp = perto.getContext('2d');
  function desenhar() {
    const img = modo === 'dia' ? dia : noite, fora = modo === 'dia' ? foraDia : foraNoite;
    const v = (modo === 'dia' ? vistas : vistasNoite)[vista];
    const veu = modo === 'dia' ? [250, 243, 224] : [40, 46, 80], forca = modo === 'dia' ? 0.12 : 0.1;
    const saida = g.createImageData(W, W);
    // A vista centrada no vão: 128 × 160 sobre 96 × 140.
    // Espelhada e deslocada: a lua fica no alto à direita da vista, e ali o vidro começa mais embaixo (a janela segue
    // a inclinação da parede). Espelhada, ela cai nas vidraças de cima, à esquerda. O vidro vai de x 350 a 425 e de
    // y 120 a 236: a vista (128 × 160) cobre tudo com ox entre 297 e 350 e oy entre 76 e 120.
    const ox = 330, oy = 105;
    for (let k = 0; k < W * W; k++) {
      const x = k % W, y = (k / W) | 0;
      for (let c = 0; c < 4; c++) saida.data[k * 4 + c] = img[k * 4 + c];
      if (vidro[k * 4 + 3] > 127) {
        const vx = 127 - (x - ox), vy = y - oy, j = (vy * 128 + vx) * 4;
        for (let c = 0; c < 3; c++) saida.data[k * 4 + c] = v[j + c] * (1 - forca) + veu[c] * forca;
      }
      saida.data[k * 4 + 3] = fora[k] ? 0 : 255;
    }
    g.putImageData(saida, 0, 0);
    gp.imageSmoothingEnabled = false;
    gp.clearRect(0, 0, 96, 140); gp.drawImage(tela, CAIXILHO[0], CAIXILHO[1], 96, 140, 0, 0, 96, 140);
    for (const b of document.querySelectorAll('[data-vista]')) { b.setAttribute('aria-pressed', String(+b.dataset.vista === vista)); }
  }
  const bd = document.getElementById('b-dia'), bn = document.getElementById('b-noite');
  bd.onclick = () => { modo = 'dia'; bd.setAttribute('aria-pressed', 'true'); bn.setAttribute('aria-pressed', 'false'); desenhar(); };
  bn.onclick = () => { modo = 'noite'; bn.setAttribute('aria-pressed', 'true'); bd.setAttribute('aria-pressed', 'false'); desenhar(); };
  for (const b of document.querySelectorAll('[data-vista]')) b.onclick = () => { vista = +b.dataset.vista; desenhar(); };
  desenhar();
})();
</script>
</body></html>
`;
fs.writeFileSync(path.join(AQUI, 'janela.html'), html);
console.log('janela.html', Math.round(html.length / 1024), 'KB');
