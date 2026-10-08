// A noite da base sem porta, por EDIÇÃO (mesma geometria), como a da pl-512-sem (../teste/noite.mjs). O vidro fica
// para a vista: a noite dele vem da vista de noite, não daqui.
//   node e2e/pixel-art/quarto/novo/janela/noite.mjs   → noite.png
import fs from 'node:fs';
import path from 'node:path';
import { ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const destino = path.join(AQUI, 'noite.png');
if (fs.existsSync(destino)) { console.log('já existe: noite'); process.exit(0); }
const [b] = await chamar('/edit-images-v2', {
  method: 'edit_with_text',
  edit_images: [{ image: { type: 'base64', base64: ler64(path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png')), format: 'png' }, width: 512, height: 512 }],
  image_size: { width: 512, height: 512 },
  // A primeira saiu com manchas grandes na parede da esquerda (falhas/): o pedido agora diz que a parede é lisa.
  description: 'the same empty bedroom at night, the plaster walls smooth and evenly lit with NO stains, NO blotches and NO patches: faint cool moonlight coming through the window onto the windowsill and the floor, the room dim and calm with warm dark tones, no lamps, keep the walls, floor planks, window, glass, curtains and every line exactly the same',
});
gravar64(destino, b);
console.log('noite ok');
