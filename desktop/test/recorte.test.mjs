import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');

// O modelo não mora no git: o teste do recorte de verdade só roda depois de `node e2e/recorte-de-fundo/baixar.mjs`.
const MODELO = join(RAIZ, 'e2e', 'recorte-de-fundo', 'modelos', 'birefnet-lite-512-fp16.onnx');

test('o app e o servidor esperam o MESMO arquivo (sha256 e tamanho)', () => {
  const app = readFileSync(join(AQUI, '..', 'src', 'recorte', 'index.js'), 'utf8');
  const servidor = readFileSync(join(RAIZ, 'server', 'src', 'recorte-routes.ts'), 'utf8');
  const sha = (texto) => texto.match(/[0-9a-f]{64}/)?.[0];
  const tamanho = (texto) => texto.match(/(?:TAMANHO_DO_MODELO = |tamanho: )([\d_]+)/)?.[1];
  assert.ok(sha(app));
  assert.equal(sha(app), sha(servidor));
  assert.equal(tamanho(app), tamanho(servidor));
});

test('o BiRefNet acha o objeto e apaga o fundo', { skip: !existsSync(MODELO) && 'sem o modelo baixado' }, async () => {
  const { criarRecorte, LADO } = require('../src/recorte/birefnet.js');
  const { recortar } = criarRecorte(require('onnxruntime-node'), MODELO);
  // uma bola vermelha, com sombra de cima, sobre um fundo cinza claro
  const px = new Uint8Array(LADO * LADO * 4);
  for (let y = 0; y < LADO; y++)
    for (let x = 0; x < LADO; x++) {
      const i = (y * LADO + x) * 4;
      const d = Math.hypot(x - 256, y - 256);
      const luz = Math.max(0, 1 - Math.hypot(x - 210, y - 210) / 260);
      px.set(d < 150 ? [120 + 135 * luz, 20, 20, 255] : [235, 235, 232, 255], i);
    }
  const mascara = await recortar(px);
  assert.equal(mascara.length, LADO * LADO);
  assert.ok(mascara[256 * LADO + 256] > 200, `o meio da bola ficou ${mascara[256 * LADO + 256]}`);
  assert.ok(mascara[10 * LADO + 10] < 30, `o canto ficou ${mascara[10 * LADO + 10]}`);
});
