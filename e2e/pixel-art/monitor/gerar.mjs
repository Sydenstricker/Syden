// A MOLDURA DO MONITOR (pedido dele, 10/11/2026: "quando eu clico no computador do quarto, aparecem os mini-games, só que
// eu clico através de um PC no quarto"): a lista de Mini-games aberta pelo computador do quarto aparece DENTRO da tela de
// um monitor em pixel art. Um monitor de frente, creme, com a tela em MAGENTA puro (a lição do CLAUDE.md: área que vira
// máscara se pede em magenta) — o magenta vira o buraco, e a moldura vira um 9-slice (border-image) em web/src/assets/quarto/.
//   node e2e/pixel-art/monitor/gerar.mjs        → opcoes/monitor-<n>.png (várias opções numa chamada)
//   node e2e/pixel-art/monitor/fatiar.mjs <n>   → web/src/assets/quarto/monitor.png e monitor-pe.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'opcoes');
fs.mkdirSync(SAIDA, { recursive: true });
const API = 'https://api.pixellab.ai/v2';
const cab = { authorization: `Bearer ${process.env.PIXELLAB_KEY}` };
const saldo = async () => (await (await fetch(API + '/balance', { headers: cab })).json()).subscription.generations;

const TEXTO = process.argv[2] === 'b'
  ? 'ONLY ONE old cozy retro computer monitor seen straight from the FRONT, flat front view, not isometric, and nothing else: a thick rounded cream beige plastic bezel frame with softly rounded outer corners, a small round power button and a tiny green light on the bottom edge of the bezel, a short cream neck and a small flat oval stand base under it; the WHOLE SCREEN area inside the bezel is a big flat rectangle filled with SOLID PURE MAGENTA #FF00FF, one flat color with no reflection, no gradient and nothing drawn on it; the bezel is the same thickness on the left, right and top; the monitor is centered with a small empty margin on every side, pixel art, clean dark outline, warm muted palette'
  : 'ONLY ONE cozy retro computer monitor seen straight from the FRONT, flat front view, not isometric, and nothing else: a cream plastic bezel frame with rounded corners, a small round power button on the bottom edge of the bezel, a short neck and a small flat stand base under it; the WHOLE SCREEN area inside the bezel is a big flat rectangle filled with SOLID PURE MAGENTA #FF00FF, one flat color, nothing drawn on the screen; the monitor fills most of the image, centered, pixel art, clean dark outline, warm muted palette';

// A referência de estilo: a cama e o criado-mudo já pintados no quarto (a mesma de avulso.mjs).
const p = await abrir();
const ref = await p.evaluate(async (b) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.getContext('2d').drawImage(im, -128, -150);
  return c.toDataURL('image/png').split(',')[1];
}, ler64(path.join(AQUI, '..', 'quarto', 'novo', 'quarto', 'passos', '2-abajur.png')));
await fechar();
const antes = await saldo();
const imagens = await chamar('/generate-image-v2', {
  description: TEXTO, image_size: { width: 160, height: 144 }, no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette and pixel scale; draw only the requested monitor, seen from the front' }],
});
const ja = fs.readdirSync(SAIDA).filter((f) => /^monitor-\d+\.png$/.test(f)).length;
imagens.forEach((b, i) => gravar64(path.join(SAIDA, `monitor-${ja + i + 1}.png`), b));
const gastas = +(antes - (await saldo())).toFixed(1);
fs.appendFileSync(path.join(AQUI, '..', 'custos.jsonl'), JSON.stringify({ ferramenta: 'pixellab', peca: 'monitor/moldura', geracoes: gastas, quando: new Date().toISOString() }) + '\n');
console.log('monitor →', imagens.length, 'opções,', gastas, 'gerações');
