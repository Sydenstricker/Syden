import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));

// O modelo não mora no git: desktop/scripts/baixar-recorte.js o põe em desktop/recorte-modelo/ (o que vai no pacote).
const MODELO = join(AQUI, '..', 'recorte-modelo', 'birefnet-lite-512-fp16.onnx');

test('o modelo que vai no pacote é o medido (o sha256 do script)', { skip: !existsSync(MODELO) && 'rode node scripts/baixar-recorte.js' }, () => {
  const script = readFileSync(join(AQUI, '..', 'scripts', 'baixar-recorte.js'), 'utf8');
  const esperado = script.match(/sha256: '([0-9a-f]{64})'/)[1];
  assert.equal(createHash('sha256').update(readFileSync(MODELO)).digest('hex'), esperado);
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
