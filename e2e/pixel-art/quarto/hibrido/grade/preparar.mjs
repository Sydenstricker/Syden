// Prepara o teste da grade: as duas pinturas sem o pufe (o chão e o tapete repintados onde ele estava) e o
// pufe como peça solta, recortado da pintura de DIA (a luz mais neutra; a da noite vem pelo mapa de luz).
//   node e2e/pixel-art/quarto/hibrido/grade/preparar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { repintar } from '../pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HIB = path.join(AQUI, '..');
// O pufe, em pixels do quarto (medido sobre a grade: ocupa as casas 35, 36, 45 e 46).
export const PUFE = [162, 211, 218, 255];
// Primeira tentativa (07/10/2026), com a caixa inteira como máscara: de noite saiu um pedaço de cama no lugar,
// e de dia, outro pufe. Agora a máscara é a forma do pufe (3 px mais larga, para levar a borda escura junto), e
// a descrição proíbe objetos. Isso resolveu o DIA. A NOITE insistiu em pintar uma cena (abajur e cama) no
// buraco: a escuridão em volta confunde o modelo. Ela sai sem IA: o tapete de dia, escurecido pela luz da
// noite medida no anel em volta do buraco (o mesmo princípio do mapa de luz).
const CHAO = 'flat green rug texture with its soft checkered pattern, seen from above, empty floor covering, no objects, no furniture, no cushion, cozy pixel art';

const destino = path.join(AQUI, 'pufe.png');
if (!fs.existsSync(destino)) {
  const [x0, y0, x1, y1] = PUFE;
  const p = await abrir();
  const recorte = await p.evaluate(async ({ b64, x0, y0, x1, y1 }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
    c.getContext('2d').drawImage(im, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64: ler64(path.join(HIB, 'dia.png')), x0, y0, x1, y1 });
  const r = await fetch('https://api.pixellab.ai/v2/remove-background', {
    method: 'POST', headers: { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ image: { type: 'base64', base64: recorte, format: 'png' }, image_size: { width: x1 - x0, height: y1 - y0 }, background_removal_task: 'remove_complex_background', text: 'round dark grey floor pouf cushion' }),
  });
  const j = await r.json();
  gravar64(destino, j.image.base64);
  console.log('pufe ok', JSON.stringify(j.usage ?? null));
} else console.log('já existe: pufe');

const p = await abrir();
const forma = await p.evaluate(async ({ pufe, x0, y0 }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + pufe; await im.decode();
  const c = document.createElement('canvas'); c.width = 313; c.height = 314;
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 313, 314);
  const t = document.createElement('canvas'); t.width = im.width; t.height = im.height;
  const tg = t.getContext('2d'); tg.drawImage(im, 0, 0); tg.globalCompositeOperation = 'source-in'; tg.fillStyle = '#fff'; tg.fillRect(0, 0, t.width, t.height);
  for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 4; dy++) if (dx * dx + dy * dy <= 13) g.drawImage(t, x0 + dx, y0 + dy);
  const d = g.getImageData(0, 0, 313, 314); for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] > 127 ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  return c.toDataURL('image/png').split(',')[1];
}, { pufe: ler64(destino), x0: PUFE[0], y0: PUFE[1] });
await repintar('dia', 'grade/dia-sem-pufe', [PUFE], CHAO, { mascara: forma });
const noiteSem = path.join(AQUI, 'noite-sem-pufe.png');
if (!fs.existsSync(noiteSem)) {
  const b64 = await p.evaluate(async ({ noite, dia, forma }) => {
    const ler = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)]; };
    const [cn, gn, n] = await ler(noite); const [, , d] = await ler(dia); const [, , m] = await ler(forma);
    const W = cn.width, H = cn.height;
    const buraco = (x, y) => m.data[(y * W + x) * 4] > 127;
    // O anel: pixels fora do buraco a até 4 px dele. Em cada um, a razão noite/dia por canal.
    const anel = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (buraco(x, y)) continue;
      let perto = false;
      for (let dy = -4; dy <= 4 && !perto; dy++) for (let dx = -4; dx <= 4; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && buraco(xx, yy)) { perto = true; break; } }
      if (!perto) continue;
      const i = (y * W + x) * 4;
      anel.push([x, y, [0, 1, 2].map((k) => (n.data[i + k] + 1) / (d.data[i + k] + 1))]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!buraco(x, y)) continue;
      let soma = [0, 0, 0], peso = 0;
      for (const [ax, ay, r] of anel) { const w = 1 / ((ax - x) ** 2 + (ay - y) ** 2 + 1); peso += w; for (let k = 0; k < 3; k++) soma[k] += r[k] * w; }
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) n.data[i + k] = Math.max(0, Math.min(255, Math.round(d.data[i + k] * soma[k] / peso)));
    }
    gn.putImageData(n, 0, 0);
    return cn.toDataURL('image/png').split(',')[1];
  }, { noite: ler64(path.join(HIB, 'noite.png')), dia: ler64(path.join(AQUI, 'dia-sem-pufe.png')), forma });
  gravar64(noiteSem, b64);
  console.log('noite-sem-pufe ← o dia escurecido pela luz da noite');
}

await fechar();
