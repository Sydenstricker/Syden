// O SALÃO ISOMÉTRICO (decisão dele, 15/10/2026): substitui o salão de frente (web/src/assets/salao/sala.png) e reaproveita
// as mecânicas do quarto (e2e/pixel-art/quarto/novo/quarto/). Primeiro, a CASCA: o salão vazio, no mesmo ângulo do
// quarto, com o clima do salão de frente (tijolo, madeira escura, luzinhas). Sem janela e sem porta na pintura: a janela
// é peça, como no quarto, e o quarto mostrou que pintura com móvel não se esvazia depois.
//   node e2e/pixel-art/salao/bases.mjs [id,...]   → bases/<id>-<n>.png (pula o que já existe)
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../quarto/imagem.mjs';
import { chamar } from '../quarto/hibrido/pintura.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const SAIDA = path.join(AQUI, 'bases');
fs.mkdirSync(SAIDA, { recursive: true });
const SALA = 'empty isometric cutaway lounge room seen from above at a 2:1 isometric angle, two walls meeting at the back corner, a thick dark wooden trim along the top edge of both walls, a warm dark wooden plank floor, NO furniture, nothing on the floor, no window, no door, clean pixel art with crisp regular diagonal lines';
const PAREDES = 'the left wall is exposed warm red brick, the right wall is warm plaster above dark wooden wainscoting';
export const BASES = [
  { id: 'tarde', lado: 512, texto: `${SALA}, ${PAREDES}, a string of small warm fairy lights along the top of both walls, cozy and calm, soft warm afternoon light` },
  { id: 'noite', lado: 512, texto: `${SALA}, ${PAREDES}, a string of small glowing warm fairy lights along the top of both walls, cozy evening, dim warm light` },
  // O salão de frente como referência de clima e paleta (no quarto, a referência em 512 inventava gente: aqui ela vai
  // pequena e com o pedido de deixar vazio).
  { id: 'ref', lado: 512, ref: true, texto: `${SALA}, ${PAREDES}, a string of small warm fairy lights along the top of both walls, cozy` },
];
const REF = ler64(path.join(AQUI, '..', '..', '..', 'web', 'src', 'assets', 'salao', 'sala.png'));
const so = process.argv[2]?.split(',');
for (const b of BASES.filter((x) => !so || so.includes(x.id))) {
  if (fs.readdirSync(SAIDA).some((f) => f.startsWith(b.id + '-'))) { console.log('já existe:', b.id); continue; }
  try {
    const imagens = await chamar('/generate-image-v2', {
      description: b.texto, image_size: { width: b.lado, height: b.lado }, no_background: false,
      ...(b.ref ? { reference_images: [{ image: { type: 'base64', base64: REF, format: 'png' }, size: { width: 384, height: 266 }, usage_description: 'Match the cozy mood, palette, materials (red brick, dark wood) and fairy lights of this lounge, but draw it as an EMPTY isometric room with no furniture and no people' }] } : {}),
    });
    imagens.forEach((x, i) => gravar64(path.join(SAIDA, `${b.id}-${i + 1}.png`), x));
    console.log(b.id, '→', imagens.length);
  } catch (e) { console.log(b.id, 'ERRO', e.message); }
}
await fechar();
