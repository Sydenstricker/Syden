// O quarto vazio: a mesma pintura sem nenhum móvel nem quadro — só paredes, chão, rodapé e a janela, que é
// fixa (é a fonte da luz; ver README). É a base dos móveis soltos: eles passam a ser desenhados por cima, na
// grade do chão e da parede. Uma edição do quarto inteiro, de dia e de noite (25 gerações cada).
//   node e2e/pixel-art/quarto/hibrido/vazio/esvaziar.mjs [dia|noite]
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../../imagem.mjs';
import { chamar } from '../pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HIB = path.join(AQUI, '..');
const W = 313, H = 314;

const VAZIO = 'the same bedroom completely empty: remove ALL furniture and objects (bed, nightstand, lamp, low table, desk, chair, computer, cabinet, rug, pouf, plants, shelves, books, posters, pictures, cork board, headphones). Keep only the bare walls, the wooden plank floor, the baseboards, the wall trim and the window with its curtains and blinds, exactly in the same place, with the same pixel art style';
const PEDIDOS = {
  dia: { de: 'dia.png', luz: 'calm sunny afternoon, soft natural daylight coming from the window onto the floor' },
  noite: { de: 'noite.png', luz: 'night, dim cozy room, dark blue night sky in the window, soft warm light' },
};

const so = process.argv[2];
for (const [nome, pedido] of Object.entries(PEDIDOS)) {
  if (so && so !== nome) continue;
  const destino = path.join(AQUI, nome + '.png');
  if (fs.existsSync(destino)) { console.log('já existe:', nome); continue; }
  const imagens = await chamar('/edit-images-v2', {
    method: 'edit_with_text',
    edit_images: [{ image: { type: 'base64', base64: ler64(path.join(HIB, pedido.de)), format: 'png' }, width: W, height: H }],
    image_size: { width: W, height: H },
    description: `${VAZIO}. ${pedido.luz}`,
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, i === 0 ? nome + '.png' : `${nome}-alt${i}.png`), b));
  console.log(nome, '←', imagens.length, 'imagem(ns)');
}
await fechar();
