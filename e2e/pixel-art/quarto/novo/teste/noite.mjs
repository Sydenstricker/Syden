// A noite da base, por EDIÇÃO da mesma imagem (mantém a geometria): o quarto vazio, sem lâmpada acesa. A luz
// do abajur entra depois, por código, porque o abajur é um móvel que pode não estar lá.
//   node e2e/pixel-art/quarto/novo/teste/noite.mjs   → noite.png
import fs from 'node:fs';
import path from 'node:path';
import { ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../../hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const destino = path.join(AQUI, 'noite.png');
if (fs.existsSync(destino)) { console.log('já existe: noite'); process.exit(0); }
const imagens = await chamar('/edit-images-v2', {
  method: 'edit_with_text',
  edit_images: [{ image: { type: 'base64', base64: ler64(path.join(AQUI, '..', 'bases', 'pl-512-sem-1.png')), format: 'png' }, width: 512, height: 512 }],
  image_size: { width: 512, height: 512 },
  description: 'the same empty bedroom at night: dark blue night sky through the window, faint cool moonlight from the window on the floor, the room dim and calm with warm dark tones, no lamps, keep the walls, floor planks, door, window, curtains and every line exactly the same',
});
imagens.forEach((b, i) => gravar64(i ? path.join(AQUI, `noite-${i + 1}.png`) : destino, b));
console.log('noite →', imagens.length);
