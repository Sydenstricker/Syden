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
const { criarFluxo, janelaVorbis, criarDft } = require('../src/ruido/dpdfnet.js');
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

  it('o microfone mudo (zeros) não passa pelo modelo, e a voz que volta passa', async () => {
    const real = await ort.InferenceSession.create(readFileSync(new URL('../ruido/dpdfnet-baseline.onnx', import.meta.url)), { intraOpNumThreads: 1 });
    let chamadas = 0;
    const sessao = { run: (...a) => (chamadas++, real.run(...a)) };
    const fluxo = criarFluxo(sessao, ort.Tensor, cfg);
    const voz = new Float32Array(8000).map((_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000));
    let antes = 0;
    for (let i = 0; i < voz.length; i += 128) for (const v of await fluxo.processar(voz.subarray(i, i + 128))) antes += v * v;
    const comVoz = chamadas;
    assert.ok(comVoz >= 8);
    // 2 s mudo: nenhuma chamada ao modelo depois de a janela esvaziar, e a saída vai a zero
    let ultimo = new Float32Array(0);
    for (let i = 0; i < 32000; i += 128) { const s = await fluxo.processar(new Float32Array(128)); if (s.length) ultimo = s; }
    assert.ok(chamadas - comVoz <= 33, `o modelo rodou ${chamadas - comVoz} vezes no silêncio`);
    assert.ok(ultimo.every((v) => v === 0));
    assert.ok(fluxo.pulados() > 160);
    // um quarto quieto (−70 dBFS de chiado) também para o modelo; o ventilador baixo (−45), não
    for (const [nivel, para] of [[3e-4, true], [5e-3, false]]) {
      const antesDoNivel = chamadas;
      for (let i = 0; i < 32000; i += 128) await fluxo.processar(new Float32Array(128).map(() => nivel * (Math.random() * 2 - 1)));
      const rodou = chamadas - antesDoNivel;
      assert.ok(para ? rodou <= 33 : rodou >= 195, `nível ${nivel}: o modelo rodou ${rodou} vezes em 2 s`);
    }
    fluxo.pulados();
    // a voz volta: o modelo volta, e sai som
    let soma = 0;
    for (let i = 0; i < voz.length; i += 128) for (const v of await fluxo.processar(voz.subarray(i, i + 128))) soma += v * v;
    assert.ok(soma > 0.25 * antes, `saiu quase nada: ${soma} contra ${antes}`);
  });

  it('a FFT de 320 dá o mesmo que a soma direta, e a inversa volta ao sinal', () => {
    const n = 320, b = n / 2 + 1;
    const x = new Float32Array(n).map((_, t) => Math.sin(t * 0.37) + 0.3 * Math.cos(t * 1.9) + (t % 7) / 10);
    const re = new Float32Array(b), im = new Float32Array(b);
    criarDft(n).direta(x, re, im);
    let pior = 0;
    for (let k = 0; k < b; k++) {
      let r = 0, i = 0;
      for (let t = 0; t < n; t++) { r += x[t] * Math.cos((2 * Math.PI * k * t) / n); i -= x[t] * Math.sin((2 * Math.PI * k * t) / n); }
      pior = Math.max(pior, Math.abs(r - re[k]), Math.abs(i - im[k]));
    }
    assert.ok(pior < 1e-3, `direta: ${pior}`);
    const y = new Float32Array(n);
    criarDft(n).inversa(re, im, y);
    pior = 0;
    for (let t = 0; t < n; t++) pior = Math.max(pior, Math.abs(y[t] - x[t]));
    assert.ok(pior < 1e-5, `inversa: ${pior}`);
  });

  it('a janela de Vorbis soma 1 com sobreposição de metade — senão a voz sai ondulando', () => {
    const w = janelaVorbis(320);
    for (let n = 0; n < 160; n++) assert.ok(Math.abs(w[n] ** 2 + w[n + 160] ** 2 - 1) < 1e-6, `n=${n}`);
  });

  it('a licença do modelo vai junto com ele', () => {
    assert.match(readFileSync(new URL('../ruido/DPDFNET-LICENSE.txt', import.meta.url), 'utf8'), /Apache License[\s\S]*Version 2\.0/);
  });
});
