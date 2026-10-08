// A máscara do vidro da janela da base pl-512-janela-1: o vidro foi pintado numa cor só, (250, 243, 224), e é ela que
// se procura, só dentro do caixilho. O vão da janela, ao lado, é creme parecido mas não igual.
//   node e2e/pixel-art/quarto/novo/janela/vidro.mjs   → vidro.png (branco = vidro) e ver-vidro.png
import path from 'node:path';
import { abrir, fechar, ler64, gravar64, foto } from '../../imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
export const VIDRO = [250, 243, 224], CAIXILHO = [336, 106, 432, 246];
const base = ler64(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png'));
const p = await abrir();
const mascara = await p.evaluate(async ({ base, VIDRO, CAIXILHO: [x0, y0, x1, y1] }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + base; await im.decode();
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, 512, 512), m = new ImageData(512, 512);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const k = (y * 512 + x) * 4;
    if (d.data[k] === VIDRO[0] && d.data[k + 1] === VIDRO[1] && d.data[k + 2] === VIDRO[2]) { m.data[k] = m.data[k + 1] = m.data[k + 2] = m.data[k + 3] = 255; }
  }
  g.putImageData(m, 0, 0); return c.toDataURL('image/png').split(',')[1];
}, { base, VIDRO, CAIXILHO });
gravar64(path.join(AQUI, 'vidro.png'), mascara);
await foto(`<body style="margin:0;background:#333"><div style="position:relative;width:600px;height:840px;overflow:hidden"><img src="data:image/png;base64,${base}" style="position:absolute;left:${-320 * 6}px;top:${-100 * 6}px;width:${512 * 6}px;image-rendering:pixelated"><img src="data:image/png;base64,${mascara}" style="position:absolute;left:${-320 * 6}px;top:${-100 * 6}px;width:${512 * 6}px;image-rendering:pixelated;filter:brightness(0) saturate(100%) invert(18%) sepia(98%) saturate(7000%) hue-rotate(0deg)"></div>`, path.join(AQUI, 'ver-vidro.png'), { largura: 600, altura: 840 });
await fechar();
