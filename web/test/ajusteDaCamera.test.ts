/** Os ajustes da imagem da câmera (src/ajusteDaCamera.ts): o recorte, o arrastar e os limites. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AJUSTE_PADRAO, ajusteAtivo, ajusteValido, arrastar, filtroDaLuz, recorteDoAjuste } from '../src/ajusteDaCamera.ts';

test('sem ajuste, o quadro passa inteiro e nada é feito', () => {
  assert.equal(ajusteAtivo(AJUSTE_PADRAO), false);
  assert.deepEqual(recorteDoAjuste(1280, 720, AJUSTE_PADRAO), { sx: 0, sy: 0, sw: 1280, sh: 720, saidaL: 1280, saidaA: 720 });
  assert.equal(filtroDaLuz(AJUSTE_PADRAO), 'none');
});

test('o celular em pé preenchendo 16:9 vira um quadro deitado, do meio, sem ampliar', () => {
  const r = recorteDoAjuste(720, 1280, { ...AJUSTE_PADRAO, formato: '16:9' });
  assert.equal(r.sw, 720);
  assert.equal(r.sh, 405);
  assert.equal(r.sy, (1280 - 405) / 2);
  assert.equal(r.saidaL, 720);
  assert.equal(r.saidaA, 404); // par, como os codificadores pedem
});

test('o zoom recorta o meio e o enquadramento nunca sai da imagem', () => {
  const r = recorteDoAjuste(1280, 720, { ...AJUSTE_PADRAO, zoom: 2 });
  assert.deepEqual([r.sx, r.sy, r.sw, r.sh], [320, 180, 640, 360]);
  const canto = recorteDoAjuste(1280, 720, { ...AJUSTE_PADRAO, zoom: 2, x: 0, y: 1 });
  assert.deepEqual([canto.sx, canto.sy], [0, 360]);
});

test('arrastar para a direita mostra o que estava à esquerda; com o espelho, o contrário; e não acumula além da borda', () => {
  const a = { ...AJUSTE_PADRAO, zoom: 2 };
  assert.ok(arrastar(a, 1280, 720, 0.1, 0).x < 0.5);
  assert.ok(arrastar({ ...a, espelhar: true }, 1280, 720, 0.1, 0).x > 0.5);
  let longe = a;
  for (let i = 0; i < 50; i++) longe = arrastar(longe, 1280, 720, 0.5, 0);
  assert.equal(longe.x, 0.25); // o meio preso na borda (metade do recorte de 640 em 1280)
  assert.ok(arrastar(longe, 1280, 720, -0.1, 0).x > 0.25); // e volta na hora, sem crédito escondido
});

test('o que vem guardado volta para dentro dos limites', () => {
  const v = ajusteValido({ zoom: 9, x: -3, brilho: 5, formato: 'quadrado' as never, espelhar: 'sim' as never });
  assert.equal(v.zoom, 4);
  assert.equal(v.x, 0);
  assert.equal(v.brilho, 1);
  assert.equal(v.formato, 'inteira');
  assert.equal(v.espelhar, false);
  assert.equal(filtroDaLuz({ ...AJUSTE_PADRAO, brilho: 1, contraste: -1 }), 'brightness(1.500) contrast(0.500)');
});
