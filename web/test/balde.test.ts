/**
 * O balde do desenha e adivinha (web/src/desenho/balde.ts): a área sai de uma grade própria, só com + − × ÷, então é a mesma
 * em toda tela. Um quadrado fechado enche por dentro e não vaza; aberto, vaza para o resto.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areasDosBaldes, BALDE, GRADE_A, GRADE_L } from '../src/desenho/balde';
import { BALDE as BALDE_DO_SERVIDOR } from '../../server/src/minijogo-desenho';

const ESPESSURAS = [4, 10, 24];
const quadrado = (fechado: boolean) => ({
  t: 1,
  c: 0,
  e: 1,
  pontos: fechado ? [200, 200, 400, 200, 400, 400, 200, 400, 200, 200] : [200, 200, 400, 200, 400, 400, 200, 400],
});
const contar = (area: Uint8Array | undefined) => (area ? area.reduce((a, b) => a + b, 0) : 0);

test('balde: o quadrado fechado enche por dentro, o aberto vaza', () => {
  const dentro = contar(areasDosBaldes([quadrado(true), { t: 2, c: 3, e: BALDE, pontos: [300, 300] }], ESPESSURAS).get(2));
  assert.ok(dentro > 8000 && dentro < 10000, `dentro: ${dentro}`);
  const vazou = contar(areasDosBaldes([quadrado(false), { t: 2, c: 3, e: BALDE, pontos: [300, 300] }], ESPESSURAS).get(2));
  assert.ok(vazou > (GRADE_L * GRADE_A) / 2, 'sem a parede, enche o quadro');
});

test('balde: a mesma cor não pinta nada, e a marca é a mesma do servidor', () => {
  assert.equal(areasDosBaldes([{ t: 1, c: 1, e: BALDE, pontos: [10, 10] }], ESPESSURAS).size, 0, 'branco sobre o fundo branco');
  assert.equal(BALDE, BALDE_DO_SERVIDOR);
});
