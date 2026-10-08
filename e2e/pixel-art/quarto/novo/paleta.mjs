// A paleta do quarto novo, TIRADA do conceito (k-médias de 32 cores sobre o conceito convertido), e não
// inventada: a paleta feita à mão no primeiro teste estragou as peças (ver ../README.md).
//   node e2e/pixel-art/quarto/novo/paleta.mjs   → paleta.png (uma faixa de 1 px por cor) e paleta.json
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const p = await abrir();
const { cores, b64 } = await p.evaluate(async (b) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  const K = 32; let cent = Array.from({ length: K }, (_, k) => px[Math.floor((k + 0.5) * px.length / K)].slice());
  for (let it = 0; it < 15; it++) {
    const soma = cent.map(() => [0, 0, 0, 0]);
    for (const q of px) { let m = 0, md = Infinity; for (let k = 0; k < K; k++) { const dd = (q[0] - cent[k][0]) ** 2 + (q[1] - cent[k][1]) ** 2 + (q[2] - cent[k][2]) ** 2; if (dd < md) { md = dd; m = k; } } soma[m][0] += q[0]; soma[m][1] += q[1]; soma[m][2] += q[2]; soma[m][3]++; }
    cent = cent.map((c0, k) => (soma[k][3] ? [soma[k][0] / soma[k][3], soma[k][1] / soma[k][3], soma[k][2] / soma[k][3]] : c0));
  }
  const cores = cent.map((c0) => '#' + c0.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')).sort();
  const f = document.createElement('canvas'); f.width = cores.length; f.height = 1;
  const fg = f.getContext('2d'); cores.forEach((h, i) => { fg.fillStyle = h; fg.fillRect(i, 0, 1, 1); });
  return { cores, b64: f.toDataURL('image/png').split(',')[1] };
}, ler64(path.join(AQUI, '..', 'hibrido', 'conceito-unzoom.png')));
gravar64(path.join(AQUI, 'paleta.png'), b64);
fs.writeFileSync(path.join(AQUI, 'paleta.json'), JSON.stringify(cores, null, 1) + '\n');
console.log(cores.length, 'cores');
await fechar();
