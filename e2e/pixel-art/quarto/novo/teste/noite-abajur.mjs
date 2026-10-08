// A noite com a luz do abajur PINTADA, não calculada. A luz por código (halo em degradê ou em faixas) ficou abaixo do
// conceito; como o abajur é fixo (fonte de luz, como a janela), a luz dele pode ser pintada uma vez no quarto. Os
// móveis soltos herdam essa luz pela razão noite/dia, como já faziam com o luar.
// Editar o quarto inteiro manchou as paredes e apagou o luar (falhas/noite-abajur-edicao-manchada.png). Aqui só a
// região do abajur é repintada, na noite limpa (noite.png), com o criado-mudo posto nela.
//   node e2e/pixel-art/quarto/novo/teste/noite-abajur.mjs   → noite-abajur.png
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, ler64, gravar64 } from '../../imagem.mjs';
import { pintar } from './pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const destino = path.join(AQUI, 'noite-abajur.png');
if (fs.existsSync(destino)) { console.log('já existe: noite-abajur'); process.exit(0); }
const p = await abrir();
// O criado-mudo de dia, escurecido para a noite, sobre a noite limpa: o ponto de partida da repintura.
const partida = await p.evaluate(async ({ noite, movel }) => {
  const carregar = async (b) => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); return im; };
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.drawImage(await carregar(noite), 0, 0);
  g.filter = 'brightness(0.5)'; g.drawImage(await carregar(movel), 0, 0);
  return c.toDataURL('image/png').split(',')[1];
}, { noite: ler64(path.join(AQUI, 'noite.png')), movel: ler64(path.join(AQUI, 'pecas', 'abajur.png')) });
const caixa = [192, 112, 324, 304];
const [x0, y0, x1, y1] = caixa;
gravar64(destino, await pintar(partida, {
  caixa, poligonos: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]],
  texto: 'the same small wooden nightstand with its table lamp TURNED ON at night: the lampshade glows warm orange, soft warm lamplight falls on the two walls of the corner and on the floor around the nightstand, fading smoothly into the dark night room, isometric pixel art matching the room exactly, same outline and palette',
}, null));
await fechar();
console.log('noite-abajur ok');
