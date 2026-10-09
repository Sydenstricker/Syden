// Fecha as máscaras: a remoção de fundo deixa furos e falhas (o vão entre o monitor e o teclado; o vidro da janela,
// que ela tira como se fosse fundo), e o contorno de passar o mouse desenha cada furo. Um fechamento (alarga 2 px e
// estreita 2 px) junta as falhas, e todo buraco que não encosta na borda da caixa é preenchido.
//   node e2e/pixel-art/quarto/hibrido/fechar-mascaras.mjs <id,...>   → mascaras/<id>.png (o original vai para mascaras/abertas/)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PASTA = path.join(AQUI, 'mascaras'), ABERTAS = path.join(PASTA, 'abertas');
fs.mkdirSync(ABERTAS, { recursive: true });
const p = await abrir();
for (const id of process.argv[2].split(',')) {
  const original = path.join(ABERTAS, id + '.png');
  if (!fs.existsSync(original)) fs.copyFileSync(path.join(PASTA, id + '.png'), original);
  gravar64(path.join(PASTA, id + '.png'), await p.evaluate(async (b) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
    const W = im.width, H = im.height, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H);
    let m = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) m[k] = d.data[k * 4 + 3] > 127 ? 1 : 0;
    const passo = (src, alarga) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = alarga ? 0 : 1; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; const s = xx >= 0 && yy >= 0 && xx < W && yy < H ? src[yy * W + xx] : 0; if (alarga && s) v = 1; if (!alarga && !s) v = 0; } o[y * W + x] = v; } return o; };
    m = passo(passo(m, true), true); m = passo(passo(m, false), false);
    const fora = new Uint8Array(W * H), fila = [];
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (!m[y * W + x] && !fora[y * W + x]) { fora[y * W + x] = 1; fila.push(y * W + x); }
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (!m[y * W + x] && !fora[y * W + x]) { fora[y * W + x] = 1; fila.push(y * W + x); }
    for (let q = 0; q < fila.length; q++) { const k = fila[q], x = k % W, y = (k / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, n = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !m[n] && !fora[n]) { fora[n] = 1; fila.push(n); } } }
    // O que entrou na máscara sem cor (o furo preenchido) fica cinza: a página só usa o alfa.
    for (let k = 0; k < W * H; k++) { const dentro = !fora[k]; if (dentro && d.data[k * 4 + 3] <= 127) { d.data[k * 4] = d.data[k * 4 + 1] = d.data[k * 4 + 2] = 128; } d.data[k * 4 + 3] = dentro ? 255 : 0; }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, ler64(original)));
  console.log('fechada:', id);
}
await fechar();
