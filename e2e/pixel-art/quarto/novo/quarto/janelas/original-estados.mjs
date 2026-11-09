// OS ESTADOS DA JANELA ORIGINAL AVULSA (09/11/2026). Gerados como avulsas próprias (original-avulsa.mjs cortina|aberta),
// a cortina e as folhas saíam com OUTRO desenho (as cortinas em outro lugar, a moldura e o peitoril diferentes), e trocar de
// estado faria a janela pular. Aqui o estado é uma REPINTURA da avulsa escolhida, posta no quarto sem janela, só na parte
// de dentro dela (o vidro e a moldura em volta dele, sem as cortinas, a varão e o peitoril): fora da máscara, os pixels são os
// da avulsa. (A primeira máscara, de colunas inteiras entre as cortinas, deixou vidro à vista e trocou o peitoril por parede.)
//   node janelas/original-estados.mjs <n> cortina|aberta     → original/estado-<estado>.png (a peça inteira, 512 × 512)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { pintar } from '../pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const d = path.join(AQUI, 'original');
const [n, estado] = process.argv.slice(2);
const TEXTOS = {
  cortina: 'the same window with its long soft cream linen curtains CLOSED, drawn together from the curtain rod down to the sill and covering all the glass, the same pixel art style, outline and palette',
  aberta: 'the same wooden window with its two glass casement sashes swung OPEN inward into the room, each open sash showing its small square panes of pale cream glass, the open window gap between the frame is a flat solid pure magenta color (#FF00FF), the same pixel art style, outline and palette',
};
if (!TEXTOS[estado]) throw new Error('estados: ' + Object.keys(TEXTOS).join(', '));
const ref = JSON.parse(fs.readFileSync(path.join(d, 'ref.json'), 'utf8'));
const p = await abrir();
// a cena (o quarto sem janela, com a avulsa no lugar e o vidro em magenta) e a máscara (entre as cortinas, a moldura e o vidro)
const { cena, forma, caixa } = await p.evaluate(async ({ sem, av, x0, y0 }) => {
  const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
  const A = await carregar(av), w = A.width, h = A.height;
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h; const ga = ca.getContext('2d'); ga.drawImage(A, 0, 0);
  const a = ga.getImageData(0, 0, w, h); const D = a.data;
  const op = (k) => D[k * 4 + 3] > 127;
  // o que é cortina (creme e claro) não entra; a máscara vai das colunas sem cortina, de cima a baixo do que é janela
  const creme = (k) => op(k) && (D[k * 4] + D[k * 4 + 1] + D[k * 4 + 2]) / 3 > 170 && Math.max(D[k * 4], D[k * 4 + 1], D[k * 4 + 2]) - Math.min(D[k * 4], D[k * 4 + 1], D[k * 4 + 2]) < 90;
  const colCreme = new Array(w).fill(0); for (let k = 0; k < w * h; k++) if (creme(k)) colCreme[k % w]++;
  // o vidro (buracos dentro da moldura): de fora para dentro, o que o transparente de fora não alcança
  const fora = new Uint8Array(w * h), fila = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const k = y * w + x; if (!op(k)) { fora[k] = 1; fila.push(k); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const k = y * w + x; if (!op(k) && !fora[k]) { fora[k] = 1; fila.push(k); } }
  for (let i = 0; i < fila.length; i++) { const k = fila[i], x = k % w; for (const v of [k - 1, k + 1, k - w, k + w]) { if (v < 0 || v >= w * h || (Math.abs((v % w) - x) > 1)) continue; if (!fora[v] && !op(v)) { fora[v] = 1; fila.push(v); } } }
  // por coluna, do alto do vidro (menos a travessa de cima) ao pé dele (mais a de baixo): o peitoril e a varão ficam de fora
  const vmin = new Array(w).fill(1e9), vmax = new Array(w).fill(-1e9);
  for (let k = 0; k < w * h; k++) if (!op(k) && !fora[k]) { const x = k % w, y = (k / w) | 0; vmin[x] = Math.min(vmin[x], y); vmax[x] = Math.max(vmax[x], y); }
  // (os montantes, colunas sem vidro, pegam o alcance das colunas vizinhas)
  { const a0 = vmin.slice(), a1 = vmax.slice(); for (let x = 0; x < w; x++) for (let dx = -8; dx <= 8; dx++) { const X = x + dx; if (X >= 0 && X < w) { vmin[x] = Math.min(vmin[x], a0[X] + Math.abs(dx) * 0.53 * 0); vmax[x] = Math.max(vmax[x], a1[X]); } } }
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.drawImage(await carregar(sem), 0, 0);
  const cena = g.getImageData(0, 0, 512, 512);
  const f = g.createImageData(512, 512);
  let bx0 = 512, by0 = 512, bx1 = 0, by1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, X = x + x0, Y = y + y0, K = (Y * 512 + X) * 4;
    if (X < 0 || Y < 0 || X >= 512 || Y >= 512) continue;
    const vidro = !op(k) && !fora[k];
    if (op(k)) for (let q = 0; q < 4; q++) cena.data[K + q] = D[k * 4 + q];
    else if (vidro) { cena.data[K] = 255; cena.data[K + 1] = 0; cena.data[K + 2] = 255; }
    if ((vidro || (op(k) && !creme(k))) && y >= vmin[x] - 6 && y <= vmax[x] + 3) { f.data[K + 3] = 255; bx0 = Math.min(bx0, X); by0 = Math.min(by0, Y); bx1 = Math.max(bx1, X); by1 = Math.max(by1, Y); }
  }
  g.putImageData(cena, 0, 0); const cenaB = c.toDataURL('image/png').split(',')[1];
  g.putImageData(f, 0, 0); const formaB = c.toDataURL('image/png').split(',')[1];
  return { cena: cenaB, forma: formaB, caixa: [bx0, by0, bx1 + 1, by1 + 1] };
}, { sem: ler64(path.join(AQUI, 'sem-janela-dia.png')), av: ler64(path.join(d, `avulso-${n}.png`)), x0: ref.x0, y0: ref.y0 });
gravar64(path.join(d, 'estado-cena.png'), cena);
console.log('máscara', caixa);
if (process.env.SECO) { gravar64(path.join(d, 'estado-forma.png'), forma); await fechar(); process.exit(0); } // só a máscara, sem gastar
const novo = await pintar(cena, { caixa, forma, folga: 0, texto: TEXTOS[estado] });
gravar64(path.join(d, `estado-${estado}.png`), novo);
await fechar();
