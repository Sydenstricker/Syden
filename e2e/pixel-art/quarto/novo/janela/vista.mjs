// A vista da janela: uma paisagem gerada à parte, posta ATRÁS do vidro (vidro.png), e não pintada nele. Assim ela troca
// com a hora (dia e noite) e, um dia, por tema ou com nuvens andando. A noite é a EDIÇÃO da de dia: o mesmo lugar.
//   node e2e/pixel-art/quarto/novo/janela/vista.mjs   → vista-dia-<n>.png, depois vista-noite.png (da vista-dia-1)
import fs from 'node:fs';
import path from 'node:path';
import { ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const L = 128, A = 160; // o vão da janela tem uns 96 × 140 px; a vista sobra um pouco, para poder deslizar
const ja = (f) => fs.existsSync(path.join(AQUI, f));
if (!ja('vista-dia-1.png')) {
  const imagens = await chamar('/generate-image-v2', {
    description: 'pixel art landscape as seen through a window, NO window frame, NO border: a calm green valley with a few round leafy trees close in front, soft rolling hills behind, the rooftops of a small cozy village far away, blue sky with soft white clouds, warm afternoon light, cozy and calm, muted warm palette, clean pixel art',
    image_size: { width: L, height: A }, no_background: false,
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, `vista-dia-${i + 1}.png`), b));
  console.log('vista de dia →', imagens.length);
}
const escolhida = process.argv[2] ?? 'vista-dia-1.png';
if (!ja('vista-noite.png') && process.argv[2]) {
  const [noite] = await chamar('/edit-images-v2', {
    method: 'edit_with_text',
    edit_images: [{ image: { type: 'base64', base64: ler64(path.join(AQUI, escolhida)), format: 'png' }, width: L, height: A }],
    image_size: { width: L, height: A },
    description: 'the same landscape at night: dark blue night sky with small stars and a soft moon, the trees and hills as dark blue silhouettes, a few warm lit windows in the far village, calm and cozy, keep every shape exactly the same',
  });
  gravar64(path.join(AQUI, 'vista-noite.png'), noite);
  console.log('vista de noite ok, de', escolhida);
}
