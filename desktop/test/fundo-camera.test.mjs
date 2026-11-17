import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const AQUI = dirname(fileURLToPath(import.meta.url));
// O modelo mora no git (6 MB), como o do ruído: desktop/fundo-camera/.
const MODELO = join(AQUI, '..', 'fundo-camera', 'pphumanseg-192.onnx');
const { criarSegmentador, LADO } = require('../src/fundo-camera/pphumanseg.js');
const ort = require('onnxruntime-node');

test('o modelo que vai no pacote é o medido (o sha256 da ORIGEM.txt)', () => {
  const origem = readFileSync(join(AQUI, '..', 'fundo-camera', 'ORIGEM.txt'), 'utf8');
  const esperado = origem.match(/sha256 ([0-9a-f]{64})/)[1];
  assert.equal(createHash('sha256').update(readFileSync(MODELO)).digest('hex'), esperado);
});

/** Um quadro: fundo de uma cor com ruído, e no meio um "busto" (cabeça e ombros) de outra. */
function quadro(semente) {
  let s = semente;
  const ruido = () => ((s = (s * 1103515245 + 12345) >>> 0) / 2 ** 32 - 0.5) * 40;
  const px = new Uint8Array(LADO * LADO * 4);
  for (let y = 0; y < LADO; y++)
    for (let x = 0; x < LADO; x++) {
      const cabeca = Math.hypot(x - 96, y - 70) < 32;
      const ombros = y > 110 && Math.abs(x - 96) < 70 - (y - 110) * -0.3;
      const c = cabeca ? [205, 160, 130] : ombros ? [40, 60, 120] : [150, 170, 150];
      px.set([c[0] + ruido(), c[1] + ruido(), c[2] + ruido(), 255], (y * LADO + x) * 4);
    }
  return px;
}

test('a máscara tem o tamanho do quadro e recusa o que não é um quadro de 192 × 192', async () => {
  const segmentar = criarSegmentador(ort, MODELO).fluxo();
  const m = await segmentar(quadro(1));
  assert.ok(m instanceof Uint8Array);
  assert.equal(m.length, LADO * LADO);
  await assert.rejects(segmentar(new Uint8Array(10)), /quadro inválido/);
});

test('a média que se adapta segura o tremor: com o mesmo quadro e ruído novo, a máscara muda menos que a crua', async () => {
  const seg = criarSegmentador(ort, MODELO);
  const suave = seg.fluxo();
  // a crua: um fluxo novo para cada quadro (sem a máscara anterior)
  const cruas = [];
  const suaves = [];
  for (let i = 0; i < 6; i++) {
    cruas.push(await seg.fluxo()(quadro(100 + i)));
    suaves.push(await suave(quadro(100 + i)));
  }
  const tremor = (lista) => {
    let soma = 0;
    for (let i = 1; i < lista.length; i++) for (let p = 0; p < lista[i].length; p++) soma += Math.abs(lista[i][p] - lista[i - 1][p]);
    return soma;
  };
  assert.ok(tremor(suaves) <= tremor(cruas), `suave ${tremor(suaves)} contra crua ${tremor(cruas)}`);
});

test('cada câmera tem a sua memória: um fluxo não suaviza com a máscara do outro', async () => {
  const seg = criarSegmentador(ort, MODELO);
  const a = seg.fluxo();
  const b = seg.fluxo();
  const q = quadro(7);
  await a(quadro(999));
  const deB = await b(q);
  const novo = await seg.fluxo()(q);
  assert.deepEqual(deB, novo);
});
