import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chegaBorrada, resumoDoQueChega } from '../src/oQueChega.js';

// A TRANSMISSÃO QUE CHEGA EMBAÇADA, do lado de quem assiste (oQueChega.ts): borrada é chegar com menos de 60% da altura
// em que aparece; quadro pequeno recebendo a camada pequena é o certo, não defeito.
describe('o que chega para quem assiste', () => {
  it('360p num quadro de 1080 é borrado; 360p num quadro de 400, não', () => {
    assert.equal(chegaBorrada(360, 1080), true);
    assert.equal(chegaBorrada(360, 400), false);
    assert.equal(chegaBorrada(720, 1080), false);
  });
  it('sem imagem ainda (0) não conta', () => {
    assert.equal(chegaBorrada(0, 1080), false);
  });
  it('a linha diz o que chega, onde é mostrada, o que a transmissão tem, a taxa e a perda', () => {
    const linha = resumoDoQueChega(
      { recebida: { largura: 640, altura: 360 }, mostrada: { largura: 1920, altura: 1080 }, publicada: { largura: 1920, altura: 1080 }, fps: 29.6, kbps: 700, perda: 4, economia: false },
      12,
    );
    assert.equal(linha, 'chega embaçada há 12 s · recebe 640×360 a 30 fps, 700 kbps · perda 4% · mostrada em 1920×1080 · a transmissão tem 1920×1080');
    assert.ok(linha.length <= 200);
  });
});
