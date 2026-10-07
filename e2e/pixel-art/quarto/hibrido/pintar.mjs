// O quarto híbrido: o conceito convertido (conceito-unzoom.png, 313 px) é o cenário, e o PixelLab repinta
// só o que precisa mudar, no estilo do próprio quadro:
//   1. tira o coelho e o gato da cama (eles viram peças à parte, para poderem se mexer);
//   2. troca o quadro da parede direita por um quadro de cortiça (Caixa de ideias);
//   3. troca a planta da mesinha da frente por um vaso de cenouras (Plantar cenoura);
//   4. faz a versão de DIA do quarto inteiro.
// Cada passo grava a sua imagem e é pulado se ela já existe (é pago).
//   node e2e/pixel-art/quarto/hibrido/pintar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../imagem.mjs';
import { nativo } from './pintar-caixas.mjs';
import { chamar, repintar as repintarNativo } from './pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const W = 313, H = 314;
// As caixas daqui foram marcadas olhando ver-unzoom.png (900 px de largura, 10 px de margem).
const repintar = (de, para, caixas, descricao) => repintarNativo(de, para, caixas.map(nativo), descricao);

await repintar('conceito-unzoom', 'passo1-sem-coelho', [[262, 288, 398, 474], [392, 370, 480, 420]],
  'empty single bed with two cream pillows and a blue-grey plaid blanket, nobody on the bed, cozy pixel art');
await repintar('passo1-sem-coelho', 'passo2-cortica', [[695, 220, 768, 338]],
  'small cork board with a few colorful paper notes pinned on it, hanging on the wall, cozy pixel art');
await repintar('passo2-cortica', 'noite', [[88, 532, 168, 615]],
  'small terracotta flower pot with young carrot plants, green leafy tops and a bit of orange carrot showing, cozy pixel art');

const dia = path.join(AQUI, 'dia.png');
if (!fs.existsSync(dia)) {
  const imagens = await chamar('/edit-images-v2', {
    method: 'edit_with_text',
    edit_images: [{ image: { type: 'base64', base64: ler64(path.join(AQUI, 'noite.png')), format: 'png' }, width: W, height: H }],
    image_size: { width: W, height: H },
    description: 'the same bedroom during a calm sunny afternoon: soft natural daylight from the window, bright blue sky with trees outside, lamps turned off, warm muted colors, keep every object and its position exactly the same',
  });
  imagens.forEach((b, i) => gravar64(path.join(AQUI, i === 0 ? 'dia.png' : `dia-alt${i}.png`), b));
  console.log('dia ←', imagens.length, 'imagem(ns)');
} else console.log('já existe: dia');
await fechar();
