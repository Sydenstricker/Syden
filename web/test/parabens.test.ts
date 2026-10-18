// A festa de aniversário do Syden (ParabensDoSyden.tsx): hoje é o dia, pelo calendário do aparelho.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ehAniversarioHoje } from '../src/aniversarioHoje';

test('no dia e no mês certos, sim; num dia antes ou depois, não; sem data, não', () => {
  const dia = new Date(2026, 9, 18); // 18 de outubro
  assert.equal(ehAniversarioHoje(10, 18, dia), true);
  assert.equal(ehAniversarioHoje(10, 17, dia), false);
  assert.equal(ehAniversarioHoje(10, 19, dia), false);
  assert.equal(ehAniversarioHoje(9, 18, dia), false);
  assert.equal(ehAniversarioHoje(null, null, dia), false);
});

test('quem nasceu em 29 de fevereiro festeja no dia 28 nos anos que não são bissextos, e no 29 nos que são', () => {
  assert.equal(ehAniversarioHoje(2, 29, new Date(2027, 1, 28)), true);
  assert.equal(ehAniversarioHoje(2, 29, new Date(2028, 1, 28)), false);
  assert.equal(ehAniversarioHoje(2, 29, new Date(2028, 1, 29)), true);
  assert.equal(ehAniversarioHoje(2, 28, new Date(2027, 1, 28)), true);
});
