// A noite do quarto vazio, montada (o mesmo que ../janela/janela.html faz na página, aqui gravado em arquivo): a edição
// da base para a noite manchou a parede da esquerda as duas vezes (../janela/falhas/). O chão (com o luar desenhado) e a
// janela com as cortinas vêm da primeira edição (../janela/noite-pintada.png); as paredes são o dia vezes a luz MÉDIA
// daquela noite, bem borrada e só com os pixels do quarto, o que guarda o degradê e apaga as manchas.
//   node e2e/pixel-art/quarto/novo/quarto/noite.mjs   → noite.png
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { CANTOS } from './chao.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const JANELA = [272, 60, 470, 340]; // a janela com as cortinas e o peitoril: vem da pintura
const p = await abrir();
gravar64(path.join(AQUI, 'noite.png'), await p.evaluate(async ({ dia64, noite64, chao, JANELA }) => {
  const W = 512;
  const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
  const dados = (im) => { const c = document.createElement('canvas'); c.width = W; c.height = W; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, W, W).data; };
  const dia = dados(await carregar(dia64)), pintada = dados(await carregar(noite64));
  // O fundo cinza em volta do quarto: preenchido a partir da borda.
  const fora = new Uint8Array(W * W), fila = [];
  const parecido = (k) => [0, 1, 2].every((c) => Math.abs(dia[k * 4 + c] - dia[c]) < 24);
  for (let i = 0; i < W; i++) for (const k of [i, (W - 1) * W + i, i * W, i * W + W - 1]) if (!fora[k] && parecido(k)) { fora[k] = 1; fila.push(k); }
  for (let q = 0; q < fila.length; q++) {
    const k = fila[q], x = k % W, y = (k / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, b = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < W && !fora[b] && parecido(b)) { fora[b] = 1; fila.push(b); } }
  }
  const borrar = (img) => {
    const c = document.createElement('canvas'); c.width = W; c.height = W;
    const d = new ImageData(new Uint8ClampedArray(img), W, W);
    for (let k = 0; k < W * W; k++) if (fora[k]) d.data[k * 4 + 3] = 0;
    c.getContext('2d').putImageData(d, 0, 0);
    const b = document.createElement('canvas'); b.width = W; b.height = W; const gb = b.getContext('2d'); gb.filter = 'blur(28px)'; gb.drawImage(c, 0, 0);
    return gb.getImageData(0, 0, W, W).data;
  };
  const diaB = borrar(dia), noiteB = borrar(pintada);
  const dentro = (x, y, q) => { let s = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) { const [xi, yi] = q[i], [xj, yj] = q[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  const saida = new ImageData(W, W);
  for (let k = 0; k < W * W; k++) {
    const x = k % W, y = (k / W) | 0;
    const daPintura = fora[k] || dentro(x + 0.5, y + 0.5, chao) || (x >= JANELA[0] && x < JANELA[2] && y >= JANELA[1] && y < JANELA[3]);
    for (let c = 0; c < 3; c++) saida.data[k * 4 + c] = daPintura ? pintada[k * 4 + c] : dia[k * 4 + c] * Math.min(1, noiteB[k * 4 + c] / Math.max(1, diaB[k * 4 + c]));
    saida.data[k * 4 + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = W; c.getContext('2d').putImageData(saida, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
}, {
  dia64: ler64(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png')), noite64: ler64(path.join(AQUI, '..', 'janela', 'noite-pintada.png')),
  chao: [CANTOS.fundo, CANTOS.esquerda, CANTOS.frente, CANTOS.direita], JANELA,
}));
await fechar();
console.log('noite.png ok');
