// A máscara de cada objeto clicável e de cada peça viva: recorta a caixa do quadro, tira o fundo com o
// PixelLab (modo para fundo complexo, com uma dica do que é o objeto) e grava mascaras/<id>.png — o recorte
// com transparência fora do objeto. Pula o que já existe.
//   node e2e/pixel-art/quarto/hibrido/mascaras.mjs [id,...]
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../imagem.mjs';
import { OBJETOS, VIVOS } from './objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const PASTA = path.join(AQUI, 'mascaras');
fs.mkdirSync(PASTA, { recursive: true });
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}`, 'content-type': 'application/json' };
const so = process.argv[2]?.split(',');

const p = await abrir();
const recortar = (b64, [x0, y0, x1, y1]) =>
  p.evaluate(async ({ b64, x0, y0, x1, y1 }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = x1 - x0; c.height = y1 - y0;
    c.getContext('2d').drawImage(im, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png').split(',')[1];
  }, { b64, x0, y0, x1, y1 });

const cena = ler64(path.join(AQUI, 'noite.png'));
const conceito = ler64(path.join(AQUI, 'conceito-unzoom.png'));
for (const o of [...OBJETOS.map((x) => ({ ...x, de: cena })), ...VIVOS.map((x) => ({ ...x, de: conceito }))]) {
  if (so && !so.includes(o.id)) continue;
  const destino = path.join(PASTA, o.id + '.png');
  if (fs.existsSync(destino)) { console.log('já existe:', o.id); continue; }
  const [x0, y0, x1, y1] = o.caixa;
  const recorte = await recortar(o.de, o.caixa);
  const r = await fetch('https://api.pixellab.ai/v2/remove-background', {
    method: 'POST', headers: cab,
    body: JSON.stringify({ image: { type: 'base64', base64: recorte, format: 'png' }, image_size: { width: x1 - x0, height: y1 - y0 }, background_removal_task: o.modo ?? 'remove_complex_background', text: o.dica }),
  });
  const t = await r.text();
  if (!r.ok) { console.log(o.id, 'ERRO', r.status, t.slice(0, 300)); continue; }
  const j = JSON.parse(t);
  const b64 = j.image?.base64 ?? j.images?.[0]?.base64;
  if (!b64) { console.log(o.id, 'sem imagem:', t.slice(0, 300)); continue; }
  gravar64(destino, b64);
  fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'mascara-' + o.id, usage: j.usage ?? null, quando: new Date().toISOString() }) + '\n');
  console.log(o.id, 'ok', JSON.stringify(j.usage ?? null));
}
await fechar();
