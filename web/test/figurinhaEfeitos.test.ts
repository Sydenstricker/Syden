import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aparar, contornar, type Pixels, tirarFundoLiso } from '../src/figurinhaEfeitos';

/** Uma imagem w×h pintada pela função (x, y) → [r, g, b, a]. */
function imagem(w: number, h: number, cor: (x: number, y: number) => [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(cor(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}
const alfa = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

// Um anel vermelho (de 20 a 40 do centro) sobre branco, com o miolo branco: o miolo não encosta no fundo e tem de ficar.
const anel = () =>
  imagem(100, 100, (x, y) => {
    const d = Math.hypot(x - 50, y - 50);
    return d >= 20 && d <= 40 ? [200, 30, 30, 255] : [250, 250, 248, 255];
  });

test('o fundo liso some, e o branco DENTRO do objeto fica', () => {
  const img = anel();
  assert.equal(tirarFundoLiso(img), 'tirado');
  assert.equal(alfa(img, 0, 0), 0);
  assert.equal(alfa(img, 50, 50), 255, 'o miolo branco não encosta no fundo');
  assert.equal(alfa(img, 50, 20), 255, 'o anel');
});

test('um JPG com o fundo levemente irregular também é liso', () => {
  const img = imagem(60, 60, (x, y) => (x > 20 && x < 40 && y > 20 && y < 40 ? [20, 90, 200, 255] : [245 + ((x * 7 + y * 3) % 9), 244, 240, 255]));
  assert.equal(tirarFundoLiso(img), 'tirado');
  assert.equal(alfa(img, 5, 5), 0);
  assert.equal(alfa(img, 30, 30), 255);
});

test('fundo de foto (sem cor dominante na borda) fica como veio', () => {
  const img = imagem(60, 60, (x, y) => [(x * 37 + y * 11) % 256, (x * 13 + y * 41) % 256, (x * 29) % 256, 255]);
  const antes = img.data.slice();
  assert.equal(tirarFundoLiso(img), 'nao-liso');
  assert.deepEqual(img.data, antes);
});

test('imagem toda de uma cor não é apagada inteira', () => {
  const img = imagem(30, 30, () => [255, 255, 255, 255]);
  assert.equal(tirarFundoLiso(img), 'nao-liso');
  assert.equal(alfa(img, 15, 15), 255);
});

test('imagem que já veio recortada não é mexida', () => {
  const img = imagem(30, 30, (x, y) => (x > 10 && x < 20 && y > 10 && y < 20 ? [10, 10, 10, 255] : [0, 0, 0, 0]));
  assert.equal(tirarFundoLiso(img), 'ja-sem-fundo');
});

test('aparar corta a margem transparente', () => {
  const img = imagem(30, 20, (x, y) => (x >= 5 && x < 15 && y >= 3 && y < 8 ? [1, 2, 3, 255] : [0, 0, 0, 0]));
  const cortada = aparar(img)!;
  assert.equal(cortada.width, 10);
  assert.equal(cortada.height, 5);
  assert.equal(aparar(imagem(4, 4, () => [0, 0, 0, 0])), null);
});

test('o contorno é branco em volta da silhueta, e longe dela é transparente', () => {
  const img = imagem(40, 40, (x, y) => (Math.hypot(x - 20, y - 20) < 15 ? [200, 30, 30, 255] : [0, 0, 0, 0]));
  const raio = 6;
  const com = contornar(img, raio);
  const m = (com.width - 40) / 2;
  assert.ok(m > raio);
  // logo fora do círculo, à direita: branco e opaco
  const i = ((20 + m) * com.width + 20 + m + 15 + 3) * 4;
  assert.deepEqual([...com.data.slice(i, i + 4)], [255, 255, 255, 255]);
  // o centro continua vermelho
  const c = ((20 + m) * com.width + 20 + m) * 4;
  assert.deepEqual([...com.data.slice(c, c + 3)], [200, 30, 30]);
  // o canto, longe: transparente
  assert.equal(com.data[3], 0);
});
