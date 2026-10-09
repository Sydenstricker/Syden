// Móveis AVULSOS: gerados inteiros, sem fundo, fora do quarto, e depois postos nele e repintados só na forma (para a
// luz de lá, como as versões do pufe). Ideia dele em 08/10/2026: pintado dentro do quarto, o guarda-roupa saiu com o
// topo cortado pela máscara, e a estante, embutida na parede (falhas/).
//   node e2e/pixel-art/quarto/novo/quarto/avulso.mjs <id>   → avulsos/<id>-<n>.png (várias opções numa chamada)
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'avulsos');
fs.mkdirSync(SAIDA, { recursive: true });
const ANGULO = 'isometric pixel art seen from above at the same 2:1 isometric angle as the reference, clean outline, warm muted palette, soft afternoon light from the right';
export const AVULSOS = {
  'guarda-roupa': { lado: [64, 160], texto: `a tall freestanding wooden wardrobe with two doors and small round knobs, the whole piece visible from the top cornice to the feet, its doors facing to the right-front, the back against a wall on its left side, ${ANGULO}` },
};

const id = process.argv[2];
const a = AVULSOS[id];
if (!a) throw new Error('avulsos: ' + Object.keys(AVULSOS).join(', '));
// A referência de estilo: a cama e o criado-mudo já pintados no quarto (mesma mão, mesma escala de pixel).
const p = await abrir();
const ref = await p.evaluate(async (b) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode();
  const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.getContext('2d').drawImage(im, -128, -150);
  return c.toDataURL('image/png').split(',')[1];
}, ler64(path.join(AQUI, 'passos', '2-abajur.png')));
await fechar();
const imagens = await chamar('/generate-image-v2', {
  description: a.texto, image_size: { width: a.lado[0], height: a.lado[1] }, no_background: true,
  reference_images: [{ image: { type: 'base64', base64: ref, format: 'png' }, size: { width: 160, height: 160 }, usage_description: 'Match this pixel art style, outline, palette, light and pixel scale exactly; draw only the requested piece of furniture' }],
});
imagens.forEach((b, i) => gravar64(path.join(SAIDA, `${id}-${i + 1}.png`), b));
console.log(id, '→', imagens.length);
