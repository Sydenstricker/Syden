import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

// A supressão de ruído do app (src/ruido/dpdfnet.js) refaz em Node o caminho do StreamEnhancer oficial
// do DPDFNet: janela de Vorbis, transformada, rede neural, transformada inversa, soma com sobreposição.
// Um erro ali (a janela trocada, um índice da transformada) não quebra nada — só piora a voz, calado.
// Por isso a saída é comparada com a do pacote oficial, gravada em dpdfnet-referencia.json.

const require = createRequire(import.meta.url);
const ort = require('onnxruntime-node');
const { criarFluxo, janelaVorbis } = require('../src/ruido/dpdfnet.js');
const cfg = require('../ruido/dpdfnet-baseline.json');

describe('supressão de ruído do app (DPDFNet)', () => {
  it('dá a mesma saída que o StreamEnhancer oficial', async () => {
    const ref = JSON.parse(readFileSync(new URL('./dpdfnet-referencia.json', import.meta.url), 'utf8'));
    const sessao = await ort.InferenceSession.create(readFileSync(new URL('../ruido/dpdfnet-baseline.onnx', import.meta.url)), { intraOpNumThreads: 1 });
    // A compensação de volume é do Syden, não do pacote oficial: desligada para comparar.
    const fluxo = criarFluxo(sessao, ort.Tensor, cfg, { compensarVolume: false });

    let semente = 12345;
    const aleatorio = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
    const x = new Float32Array(8000);
    for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) + 0.05 * aleatorio();

    const saida = [];
    for (let i = 0; i < x.length; i += 128) saida.push(...(await fluxo.processar(x.subarray(i, i + 128))));
    let pior = 0;
    ref.amostras.forEach((v, k) => (pior = Math.max(pior, Math.abs(saida[ref.inicio + k] - v))));
    assert.ok(pior < 1e-3, `diferença de ${pior} para o pacote oficial`);
  });

  it('a janela de Vorbis soma 1 com sobreposição de metade — senão a voz sai ondulando', () => {
    const w = janelaVorbis(320);
    for (let n = 0; n < 160; n++) assert.ok(Math.abs(w[n] ** 2 + w[n + 160] ** 2 - 1) < 1e-6, `n=${n}`);
  });

  it('a licença do modelo vai junto com ele', () => {
    assert.match(readFileSync(new URL('../ruido/DPDFNET-LICENSE.txt', import.meta.url), 'utf8'), /Apache License[\s\S]*Version 2\.0/);
  });
});
