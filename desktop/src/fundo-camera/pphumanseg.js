// @ts-check
/**
 * A conta do fundo da câmera: abrir o PP-HumanSeg e transformar o quadro da câmera, já reduzido a 192 × 192 (RGBA), na
 * máscara da pessoa (192 × 192, um byte por pixel: 255 = pessoa, 0 = fundo), JÁ SUAVIZADA no tempo. Este arquivo não sabe de
 * Electron (como ../ruido/dpdfnet.js e ../recorte/birefnet.js): recebe o onnxruntime e o caminho do modelo, e por isso o
 * teste o roda no Node puro (desktop/test/fundo-camera.test.js).
 *
 * As escolhas vêm da medida de 14–15/11/2026 (e2e/fundo-da-camera/README.md):
 * - a entrada vai de −1 a 1 (o PaddleSeg normaliza assim) e a saída são duas classes, fundo e pessoa: a probabilidade da
 *   pessoa é a softmax das duas;
 * - 2 núcleos: ~11,6 ms por quadro com o preparo, ~0,17 de um núcleo a 15 quadros por segundo;
 * - A MÉDIA QUE SE ADAPTA, por pixel: segura (α = 0,8) onde a mudança é pequena, que é o tremor do sensor no quarto escuro,
 *   e solta (α = 0,2) onde é grande, que é movimento de verdade. No escuro, tira ~55% do tremor e arrasta a mão ~1 px; a
 *   média fixa de 0,8 deixava um rastro de meia mão por meio segundo, e a histerese deixava pixels presos.
 */
const fs = require('node:fs');

const LADO = 192;

/**
 * @param {typeof import('onnxruntime-node')} ort
 * @param {string} caminho
 */
function criarSegmentador(ort, caminho) {
  /** @type {Promise<import('onnxruntime-common').InferenceSession> | null} */
  let sessao = null;
  function abrir() {
    sessao ??= ort.InferenceSession.create(fs.readFileSync(caminho), {
      // medido: 2 núcleos dão 10,6 ms, 4 dão 7,9; quem usa a câmera pode estar jogando, e o jogo vem antes
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
      executionMode: 'sequential',
      graphOptimizationLevel: 'all',
      logSeverityLevel: 3,
      // entre um quadro e outro (66 ms) as threads do onnxruntime ficavam GIRANDO à espera de trabalho: medido no app, 0,55 de
      // um núcleo, contra os 0,17 do estudo (que rodava quadro atrás de quadro, sem esperar)
      extra: { session: { intra_op: { allow_spinning: '0' }, inter_op: { allow_spinning: '0' } } },
    });
    return sessao;
  }

  const n = LADO * LADO;
  const entrada = new Float32Array(3 * n);

  /** Uma câmera: guarda a máscara anterior, para a média que se adapta. */
  function fluxo() {
    /** @type {Float32Array | null} */
    let anterior = null;
    /** @param {Uint8Array} px RGBA, 192 × 192 */
    return async function segmentar(px) {
      if (!(px instanceof Uint8Array) || px.length !== n * 4) throw new Error('quadro inválido');
      const s = await abrir();
      for (let p = 0; p < n; p++) {
        const o = p * 4;
        entrada[p] = px[o] * (2 / 255) - 1;
        entrada[n + p] = px[o + 1] * (2 / 255) - 1;
        entrada[2 * n + p] = px[o + 2] * (2 / 255) - 1;
      }
      const saidas = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, LADO, LADO]) });
      const d = /** @type {Float32Array} */ (saidas[s.outputNames[0]].data);
      const atual = new Float32Array(n);
      for (let p = 0; p < n; p++) {
        const fundo = d[p];
        const pessoa = d[n + p];
        // a conversão do OpenCV já pode sair em probabilidade; senão, a softmax das duas classes
        atual[p] = fundo >= 0 && pessoa >= 0 && Math.abs(fundo + pessoa - 1) < 0.01 ? pessoa : 1 / (1 + Math.exp(fundo - pessoa));
      }
      if (anterior) {
        for (let p = 0; p < n; p++) {
          const delta = Math.abs(atual[p] - anterior[p]);
          const a = delta < 0.2 ? 0.8 : delta > 0.6 ? 0.2 : 0.8 - ((delta - 0.2) / 0.4) * 0.6;
          atual[p] = a * anterior[p] + (1 - a) * atual[p];
        }
      }
      anterior = atual;
      const mascara = new Uint8Array(n);
      for (let p = 0; p < n; p++) mascara[p] = Math.round(atual[p] * 255);
      return mascara;
    };
  }

  return { abrir, fluxo };
}

module.exports = { criarSegmentador, LADO };
