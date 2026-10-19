import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ehAniversarioDoSyden } from '../src/diaDoSyden.ts';

// O aniversário do Syden (diaDoSyden.ts): 19/09, a partir do primeiro ano; no dia em que ele nasceu, não há festa.
test('19/09 de 2027 em diante é festa; 19/09/2026, o nascimento, não é', () => {
  assert.equal(ehAniversarioDoSyden(new Date(2027, 8, 19, 10)), true);
  assert.equal(ehAniversarioDoSyden(new Date(2031, 8, 19, 23, 59)), true);
  assert.equal(ehAniversarioDoSyden(new Date(2026, 8, 19, 12)), false);
  assert.equal(ehAniversarioDoSyden(new Date(2027, 8, 18, 23, 59)), false);
  assert.equal(ehAniversarioDoSyden(new Date(2027, 8, 20, 0, 0)), false);
});
