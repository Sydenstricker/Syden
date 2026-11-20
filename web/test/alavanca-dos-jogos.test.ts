import assert from 'node:assert/strict';
import { test } from 'node:test';
import { direcoesDaAlavanca } from '../src/alavancaDosJogos.ts';

const em = (x: number, y: number) => {
  const d = direcoesDaAlavanca(x, y);
  return (d.cima ? 'C' : '') + (d.baixo ? 'B' : '') + (d.esquerda ? 'E' : '') + (d.direita ? 'D' : '');
};

test('a alavanca: a zona morta, as quatro retas e as quatro diagonais (o y da tela desce)', () => {
  assert.equal(em(0, 0), '');
  assert.equal(em(0.2, -0.1), '', 'dentro da zona morta');
  assert.equal(em(1, 0), 'D');
  assert.equal(em(-1, 0), 'E');
  assert.equal(em(0, -1), 'C');
  assert.equal(em(0, 1), 'B');
  const r = Math.SQRT1_2;
  assert.equal(em(r, -r), 'CD');
  assert.equal(em(-r, -r), 'CE');
  assert.equal(em(r, r), 'BD');
  assert.equal(em(-r, r), 'BE');
  // cada setor tem 45°: a 20° da reta ainda é reta, a 25° já é diagonal
  const a = (g: number) => em(Math.cos((g * Math.PI) / 180), -Math.sin((g * Math.PI) / 180));
  assert.equal(a(20), 'D');
  assert.equal(a(25), 'CD');
  assert.equal(a(70), 'C');
  assert.equal(a(-160), 'E');
  assert.equal(em(NaN, 1), '');
});

test('a alavanca: nunca liga dois lados opostos', () => {
  for (let g = 0; g < 360; g += 1) {
    const d = direcoesDaAlavanca(Math.cos((g * Math.PI) / 180), Math.sin((g * Math.PI) / 180));
    assert.ok(!(d.cima && d.baixo) && !(d.esquerda && d.direita), `${g}°`);
    assert.ok(d.cima || d.baixo || d.esquerda || d.direita, `${g}° liga alguma`);
  }
});
