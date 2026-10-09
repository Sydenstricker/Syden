// Leva o quarto híbrido para o app (decisão dele em 08/10/2026: ele vira a home enquanto o quarto novo, de móveis
// soltos, evolui em ../novo/). Copia as duas pinturas e grava as máscaras já limpas (só o maior pedaço de cada uma,
// como a página de teste faz), sem a cor: o app só usa o alfa delas. Os vivos (coelho e gato) vão com a cor.
//   node e2e/pixel-art/quarto/hibrido/exportar.mjs   → web/src/assets/quarto/
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';
import { OBJETOS, VIVOS } from './objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const DESTINO = path.join(AQUI, '..', '..', '..', '..', 'web', 'src', 'assets', 'quarto');
fs.mkdirSync(DESTINO, { recursive: true });
const p = await abrir();
// O quadrado escuro em volta do quarto (o fundo do conceito) sai: a página tem o próprio fundo, que muda com o tema, e o
// quadrado ficava ruim nos dois (relato de 09/10/2026). Preenche-se a partir da borda, só onde a cor é praticamente a do
// canto, para não comer o contorno escuro do quarto.
for (const f of ['dia.png', 'noite.png']) gravar64(path.join(DESTINO, f), await p.evaluate(async (b64) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, w, h), a = d.data;
  const [r0, g0, b0] = [a[0], a[1], a[2]];
  const fundo = (k) => Math.abs(a[k * 4] - r0) + Math.abs(a[k * 4 + 1] - g0) + Math.abs(a[k * 4 + 2] - b0) < 14;
  const fora = new Uint8Array(w * h), fila = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const k = y * w + x; if (!fora[k] && fundo(k)) { fora[k] = 1; fila.push(k); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const k = y * w + x; if (!fora[k] && fundo(k)) { fora[k] = 1; fila.push(k); } }
  for (let q = 0; q < fila.length; q++) { const k = fila[q], x = k % w, y = (k / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy, n = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && !fora[n] && fundo(n)) { fora[n] = 1; fila.push(n); } } }
  for (let k = 0; k < w * h; k++) if (fora[k]) a[k * 4 + 3] = 0;
  g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
}, ler64(path.join(AQUI, f))));

const limpar = (b64, comCor) => p.evaluate(async ({ b64, comCor }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
  const w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, w, h), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] < 128 ? 0 : 255;
  // Só o maior pedaço: a remoção de fundo às vezes deixa ilhas soltas, que o contorno desenharia.
  const rot = new Int32Array(w * h).fill(-1), tam = [];
  for (let s = 0; s < w * h; s++) {
    if (rot[s] !== -1 || !a[s * 4 + 3]) continue;
    const id = tam.length, pilha = [s]; let n = 0; rot[s] = id;
    while (pilha.length) {
      const q = pilha.pop(); n++; const x = q % w, y = (q / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nq = ny * w + nx; if (rot[nq] === -1 && a[nq * 4 + 3]) { rot[nq] = id; pilha.push(nq); }
      }
    }
    tam.push(n);
  }
  const fica = tam.indexOf(Math.max(...tam));
  for (let s = 0; s < w * h; s++) {
    if (rot[s] !== fica) a[s * 4 + 3] = 0;
    if (!comCor) a[s * 4] = a[s * 4 + 1] = a[s * 4 + 2] = 0;
  }
  g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
}, { b64, comCor });
for (const o of OBJETOS) gravar64(path.join(DESTINO, `mascara-${o.id}.png`), await limpar(ler64(path.join(AQUI, 'mascaras', o.id + '.png')), false));
for (const v of VIVOS) gravar64(path.join(DESTINO, `${v.id}.png`), await limpar(ler64(path.join(AQUI, 'mascaras', v.id + '.png')), true));
await fechar();
// As caixas, para conferir com as do componente (web/src/Quarto.tsx), que as tem escritas à mão.
console.log(JSON.stringify(Object.fromEntries([...OBJETOS, ...VIVOS].map((o) => [o.id, o.caixa]))));
