/**
 * Os Bichos da toca no site (web/src/bichos/regras.ts): as regras são as MESMAS do servidor (server/src/bichos-regras.ts), byte
 * a byte, e o site as usa para dizer ao caderno quantos bichos dá para ter, à lojinha o que já abriu e à mesa da sala qual é a
 * forma crescida. A aventura inteira e a sala moram em server/test/minijogos-bichos.test.ts.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as R from '../src/bichos/regras.ts';

test('as duas cópias das regras são iguais byte a byte', () => {
  const doSite = readFileSync(new URL('../src/bichos/regras.ts', import.meta.url));
  const doServidor = readFileSync(new URL('../../server/src/bichos-regras.ts', import.meta.url));
  assert.ok(doSite.equals(doServidor), 'web/src/bichos/regras.ts e server/src/bichos-regras.ts mudaram separados');
});

test('o caderno fecha: toda espécie é alcançável numa aventura', () => {
  assert.equal(R.alcancaveis().size, Object.keys(R.ESPECIES).length);
});

test('a forma crescida segue a linha até o fim, e quem não cresce é ele mesmo', () => {
  assert.equal(R.formaCrescida('brotel'), 'brotelao');
  assert.equal(R.formaCrescida('brotelao'), 'brotelao');
  assert.equal(R.formaCrescida('ventrolo'), 'ventrolo');
});

test('os golpes novos: o que se aprende ao subir, e ao crescer só o que a forma de antes não tinha', () => {
  assert.deepEqual(R.golpesNovos('tisco', 11, 'tisco', 12), ['calor']);
  assert.deepEqual(R.golpesNovos('tisco', 12, 'tisco', 13), []);
  assert.deepEqual(R.golpesNovos('bolhim', 15, 'bolhao', 16), [], 'crescer no 16 não traz golpe que já sabia');
  assert.deepEqual(R.golpesNovos('brotelao', 11, 'brotelao', 12), ['espinho']);
  // golpesDe continua os últimos 4
  assert.deepEqual(R.golpesDe('tisco', 12), ['fogo', 'sopro', 'vulcao', 'calor']);
});

test('a lojinha: todo item tem preço e degrau, e os de começo abrem sem degrau', () => {
  for (const item of Object.keys(R.PRECOS) as R.ItemDaLoja[]) assert.ok(R.LOJA_ABRE[item] >= 0 && R.LOJA_ABRE[item] <= R.DESAFIANTES.length, item);
  assert.equal(R.LOJA_ABRE.cenoura, 0);
  assert.equal(R.LOJA_ABRE.cha, 0);
  assert.ok(R.curaDoCha(200) > 20 && R.curaDoCha(200, true) > R.curaDoCha(200));
});
