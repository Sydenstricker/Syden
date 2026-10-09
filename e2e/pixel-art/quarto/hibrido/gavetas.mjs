// A máscara das gavetas embaixo da cama, desenhada pelo polígono de objetos.mjs (a remoção de fundo traria a cama
// junto). Grava mascaras/gavetas.png no tamanho da caixa, opaca dentro do polígono.
//   node e2e/pixel-art/quarto/hibrido/gavetas.mjs
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';
import { OBJETOS } from './objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const o = OBJETOS.find((x) => x.id === 'gavetas');
const p = await abrir();
gravar64(path.join(AQUI, 'mascaras', 'gavetas.png'), await p.evaluate(async ({ cena, caixa: [x0, y0, x1, y1], poligono }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + cena; await im.decode();
  const w = x1 - x0, h = y1 - y0, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, -x0, -y0); const d = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + x0 + 0.5, py = y + y0 + 0.5; let dentro = false;
    for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) { const [xi, yi] = poligono[i], [xj, yj] = poligono[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro; }
    d.data[(y * w + x) * 4 + 3] = dentro ? 255 : 0;
  }
  g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
}, { cena: ler64(path.join(AQUI, 'noite.png')), caixa: o.caixa, poligono: o.poligono }));
await fechar();
console.log('mascaras/gavetas.png ok');
