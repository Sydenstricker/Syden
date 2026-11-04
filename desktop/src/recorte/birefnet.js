// @ts-check
/**
 * A conta do recorte: abrir o BiRefNet e transformar a imagem 512 × 512 (RGBA) na máscara do objeto (512 × 512, um byte por
 * pixel: 255 = objeto, 0 = fundo). Este arquivo não sabe de Electron (como ../ruido/dpdfnet.js): recebe o onnxruntime e o
 * caminho do modelo, e por isso o teste o roda no Node puro (desktop/test/recorte.test.js).
 *
 * Medido nesta máquina (04/11/2026, 8 de 16 núcleos): abrir ~7,7 s, recortar ~2,3 s, pico de ~2 GB de memória com o
 * reservatório de memória do onnxruntime desligado (ligado, 3,8 GB). A mesma conta do teste do navegador
 * (e2e/recorte-de-fundo/pagina.html): ImageNet na entrada, sigmoide e normalização entre o menor e o maior na saída.
 */
const fs = require('node:fs');
const os = require('node:os');

/**
 * @param {typeof import('onnxruntime-node')} ort
 * @param {string} caminho
 */
function criarRecorte(ort, caminho) {
  const LADO = 512;
  const MEDIA = [0.485, 0.456, 0.406];
  const DESVIO = [0.229, 0.224, 0.225];

  /** @type {Promise<import('onnxruntime-common').InferenceSession> | null} */
  let sessao = null;
  function abrir() {
    sessao ??= ort.InferenceSession.create(fs.readFileSync(caminho), {
      intraOpNumThreads: Math.max(1, Math.floor(os.cpus().length / 2)),
      interOpNumThreads: 1,
      executionMode: 'sequential',
      graphOptimizationLevel: 'all',
      // ligado, o pico de memória quase dobra (medido: 3,8 GB contra 2 GB), sem ganho de tempo
      enableCpuMemArena: false,
      logSeverityLevel: 3,
    });
    return sessao;
  }

  /** @param {Uint8Array} px */
  async function recortar(px) {
    const s = await abrir();
    const n = LADO * LADO;
    let maior = 1e-6;
    for (let i = 0; i < px.length; i += 4) maior = Math.max(maior, px[i], px[i + 1], px[i + 2]);
    const entrada = new Float32Array(3 * n);
    for (let p = 0; p < n; p++)
      for (let k = 0; k < 3; k++) entrada[k * n + p] = (px[p * 4 + k] / maior - MEDIA[k]) / DESVIO[k];
    const saidas = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, LADO, LADO]) });
    const valores = /** @type {Float32Array} */ (saidas[s.outputNames[0]].data);
    const v = new Float32Array(n);
    let mi = Infinity;
    let ma = -Infinity;
    for (let p = 0; p < n; p++) {
      const x = 1 / (1 + Math.exp(-valores[p]));
      v[p] = x;
      if (x < mi) mi = x;
      if (x > ma) ma = x;
    }
    const mascara = new Uint8Array(n);
    for (let p = 0; p < n; p++) mascara[p] = Math.round(((v[p] - mi) / (ma - mi || 1)) * 255);
    return mascara;
  }

    return { abrir, recortar };
}

module.exports = { criarRecorte, LADO: 512 };
