import assert from 'node:assert/strict';
import { test } from 'node:test';
import { epocaDoDia } from '../src/salao3d/epocas';

// AS DATAS COMEMORATIVAS DO SALÃO 3D (06/11/2026): o Natal aparece sozinho de 1º de dezembro ao Dia de Reis (6 de janeiro),
// pelo relógio local do aparelho, e some no dia 7. A conta atravessa a virada do ano.
const dia = (ano: number, mes: number, d: number, h = 12) => new Date(ano, mes - 1, d, h);

test('o Natal vai de 1º de dezembro a 6 de janeiro, os dois inclusive', () => {
  assert.equal(epocaDoDia(dia(2026, 11, 30, 23)), null);
  assert.equal(epocaDoDia(dia(2026, 12, 1, 0)), 'natal');
  assert.equal(epocaDoDia(dia(2026, 12, 25)), 'natal');
  assert.equal(epocaDoDia(dia(2026, 12, 31, 23)), 'natal');
  assert.equal(epocaDoDia(dia(2027, 1, 1)), 'natal');
  assert.equal(epocaDoDia(dia(2027, 1, 6, 23)), 'natal');
  assert.equal(epocaDoDia(dia(2027, 1, 7, 0)), null);
});

test('fora da época, o salão comum', () => {
  for (const [m, d] of [
    [2, 14],
    [6, 24],
    [9, 19],
    [11, 6],
  ])
    assert.equal(epocaDoDia(dia(2026, m, d)), null);
});
