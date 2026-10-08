// Tentativa 3 de esvaziar o quarto do conceito: um móvel (ou um grupo) por vez, com a repintura do PixelLab
// (inpaint-image-pro-flash, 6 gerações) só na área dele, pedindo parede ou chão vazio. A tentativa 1 editou o quarto
// inteiro e ele foi redesenhado; aqui o resto da pintura não é tocado. Foi assim que o pufe saiu do dia (../../grade/).
//   node e2e/pixel-art/quarto/hibrido/vazio/partes/esvaziar.mjs   → <n>-<id>.png, a cada passo partindo do anterior
// As caixas são as de ../codigo/reconstruir.mjs (marcadas à mão, em pixels do quarto de 313 px); a janela fica fora
// de toda máscara, porque é fixa e a cama e a mesa encostam nela.
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64 } from '../../../imagem.mjs';
import { repintar } from '../../pintura.mjs';
import { OBJETOS } from '../../objetos.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const HIB = path.join(AQUI, '..', '..');
const cx = (id) => OBJETOS.find((o) => o.id === id).caixa;
const PAREDE = 'plain empty plaster wall with nothing on it, the same wall color, texture and lamp light as the rest of the wall, cozy isometric pixel art';
const CANTO = 'the empty corner of the room: plain plaster wall, wooden baseboard and warm wooden plank floor continuing, NO furniture, nothing on the floor, same light, cozy isometric pixel art';
const CHAO = 'empty warm wooden plank floor, planks running in the same direction as the rest of the floor, NO rug, nothing on the floor, same light, cozy isometric pixel art';
export const PASSOS = [
  { id: 'parede-esquerda', caixas: [cx('prateleira'), cx('quadro'), cx('poster'), [109, 70, 145, 107]], texto: PAREDE },
  { id: 'parede-direita', caixas: [cx('cortica'), [246, 110, 263, 121], [258, 84, 299, 132]], texto: PAREDE },
  // As duas prateleiras com plantas resistiram ao pedido de parede vazia (o passo 2 as repintou iguais): um passo
  // só para elas, nomeando o que tirar. Entram junto os restos de dois quadrinhos.
  { id: 'prateleiras', caixas: [cx('prateleira'), [258, 84, 299, 132], [80, 95, 112, 112]], texto: `remove the wooden wall shelves, the potted plants, hanging leaves, books, figurine and the small lantern: ${PAREDE}` },
  { id: 'cama', caixas: [[62, 93, 196, 211]], texto: CANTO },
  { id: 'criado', caixas: [[24, 128, 84, 202], cx('abajur'), cx('vaso')], texto: CANTO },
  { id: 'mesinha', caixas: [[19, 182, 86, 244]], texto: CANTO },
  // A prateleira da direita ficou de fora do passo 'prateleiras': a janela de repintura (no máximo 256 px) a cortou.
  { id: 'escrivaninha', caixas: [[191, 114, 298, 222], cx('computador'), cx('fone'), [258, 84, 299, 132]], texto: `remove the desk, computer, chair, headphones, wall shelf, plant and lantern: ${CANTO}` },
  { id: 'armario', caixas: [cx('armario'), [256, 209, 280, 244]], texto: CANTO },
  { id: 'tapete', caixas: [[82, 186, 249, 281]], texto: CHAO },
];

/** A máscara do quarto inteiro: as caixas em branco, menos a janela (com 1 px de folga). Só preto e branco. */
async function mascara(caixas) {
  const p = await abrir();
  return p.evaluate(async ({ caixas, janela, cj }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + janela; await im.decode();
    const j = document.createElement('canvas'); j.width = im.width; j.height = im.height; const gj = j.getContext('2d'); gj.drawImage(im, 0, 0);
    const J = gj.getImageData(0, 0, j.width, j.height).data;
    const c = document.createElement('canvas'); c.width = 313; c.height = 314; const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 313, 314); g.fillStyle = '#fff';
    for (const [x0, y0, x1, y1] of caixas) g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const d = g.getImageData(0, 0, 313, 314);
    for (let y = 0; y < j.height; y++) for (let x = 0; x < j.width; x++) {
      let tem = false;
      for (let dy = -1; dy <= 1 && !tem; dy++) for (let dx = -1; dx <= 1 && !tem; dx++) { const xx = x + dx, yy = y + dy; tem = xx >= 0 && yy >= 0 && xx < j.width && yy < j.height && J[(yy * j.width + xx) * 4 + 3] > 127; }
      if (tem) { const k = ((cj[1] + y) * 313 + cj[0] + x) * 4; d.data[k] = d.data[k + 1] = d.data[k + 2] = 0; }
    }
    for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] > 127 ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1];
  }, { caixas, janela: ler64(path.join(HIB, 'mascaras', 'janela.png')), cj: cx('janela') });
}

const ATE = Number(process.argv[2] ?? Infinity);
let de = 'noite', n = 0;
for (const passo of PASSOS) {
  if (n >= ATE) break;
  const para = `vazio/partes/${++n}-${passo.id}`;
  await repintar(de, para, passo.caixas, passo.texto, { mascara: await mascara(passo.caixas) });
  de = para;
}
await fechar();
