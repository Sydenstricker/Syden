// As peças da gente do lobby: copia os personagens escolhidos para pecas/ (montar.mjs os leva ao site), tirando o fundo branco dos
// que vieram com ele (o fliperama: a remoção de fundo do PixelLab não pegou). O fundo sai por preenchimento a
// partir das bordas, só onde a cor é quase branca — o creme do pelo não é tocado, porque não encosta na borda.
//
//   node e2e/pixel-art/lobby/pecas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { abrir, fechar, gravar64, ler64 } from '../quarto/imagem.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// As peças CRUAS: quem as leva ao site, já na grade e na luz do salão, é montar.mjs.
const DESTINO = path.join(AQUI, 'pecas');
fs.mkdirSync(DESTINO, { recursive: true });

/** [arquivo gerado (ou faixa de quadros), nome da peça]. Quem decide onde cada uma fica é montar.mjs. */
const ESCOLHIDOS = [
  // Os do sofá, mexendo no celular: nascem no tamanho do salão (celular-<n>, 40 px) e são FAIXAS — cada um olha a
  // tela quase o tempo todo e levanta os olhos de vez em quando. Os números são quadros de celular-<n>-anim-*.
  [{ base: 'celular-1-anim', quadros: [1, 1, 1, 1, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 1, 1] }, 'sofa-1'],
  [{ base: 'celular-63-anim', quadros: [1, 1, 1, 2, 1, 1, 1, 1, 3, 3, 2, 1, 1, 1, 1, 1] }, 'sofa-2'],
  ['videogame-1', 'tv-1'],
  ['videogame-9', 'tv-2'],
  ['fliperama2-1', 'fliperama'], // no banquinho: sem ele, as mãos não alcançam os botões
  ['balcao-2', 'balcao'],
  ['corpos-1', 'gordinho'],
  ['corpos-2', 'musculoso'],
  ['corpos2-1', 'laco'],
  ['corpos2-3', 'tranca'],
  // Os pares que conversam (de três quartos, virados para a direita; montar.mjs espelha um de cada par).
  ['conversando-1', 'sueter'],
  ['conversando-2', 'regata'],
  ['conversando-3', 'tranca-roxa'],
  ['conversando-4', 'laco-vermelho'],
];

const p = await abrir();
/** Os quadros de uma animação, lado a lado numa faixa, na ordem pedida. */
const juntar = ({ base, quadros }) =>
  p.evaluate(
    async (lista) => {
      const ims = [];
      for (const b of lista) {
        const im = new Image();
        im.src = 'data:image/png;base64,' + b;
        await im.decode();
        ims.push(im);
      }
      const [w, h] = [ims[0].width, ims[0].height];
      const c = document.createElement('canvas');
      c.width = w * ims.length;
      c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      ims.forEach((im, i) => g.drawImage(im, i * w, 0));
      return c.toDataURL('image/png').split(',')[1];
    },
    quadros.map((q) => ler64(path.join(AQUI, `${base}-${q}.png`))),
  );
for (const [de, para] of ESCOLHIDOS) {
  const b64 = await p.evaluate(async (b) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b;
    await im.decode();
    const w = im.width;
    const h = im.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h);
    const a = d.data;
    const branco = (k) => a[k * 4 + 3] > 0 && a[k * 4] > 235 && a[k * 4 + 1] > 235 && a[k * 4 + 2] > 235;
    const fora = new Uint8Array(w * h);
    const fila = [];
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) fila.push(y * w + x);
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) fila.push(y * w + x);
    while (fila.length) {
      const k = fila.pop();
      if (fora[k] || !branco(k)) continue;
      fora[k] = 1;
      const x = k % w;
      const y = (k / w) | 0;
      if (x > 0) fila.push(k - 1);
      if (x < w - 1) fila.push(k + 1);
      if (y > 0) fila.push(k - w);
      if (y < h - 1) fila.push(k + w);
    }
    for (let k = 0; k < w * h; k++) if (fora[k]) a[k * 4 + 3] = 0;
    g.putImageData(d, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  }, typeof de === 'string' ? ler64(path.join(AQUI, de + '.png')) : await juntar(de));
  gravar64(path.join(DESTINO, para + '.png'), b64);
  console.log(`${typeof de === 'string' ? de : de.base} → pecas/${para}.png`);
}
await fechar();
