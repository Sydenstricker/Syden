// @ts-check
/**
 * A conta do fundo da câmera: abrir um modelo e transformar o quadro da câmera, já reduzido pela página ao tamanho que ele
 * pede (RGBA), na máscara da pessoa (um byte por pixel: 255 = pessoa, 0 = fundo), JÁ SUAVIZADA no tempo. Este arquivo não
 * sabe de Electron (como ../ruido/dpdfnet.js e ../recorte/birefnet.js): recebe o onnxruntime e o caminho do modelo, e por isso
 * o teste o roda no Node puro (desktop/test/fundo-camera.test.mjs).
 *
 * Dois modelos (17/11/2026; e2e/fundo-da-camera/README.md): o MODESTO (o PP-HumanSeg 192 × 192, no processador, para todos) e
 * o REFINADO (pela placa, quando ela pode; ver decisor.js). Os dois são do PaddleSeg: a entrada vai de −1 a 1, e a saída é a
 * probabilidade da pessoa (duas classes, a softmax delas) ou o alfa direto (o recorte com transparência).
 *
 * A MÉDIA QUE SE ADAPTA, por pixel (medida em 14–15/11/2026): segura (α = 0,8) onde a mudança é pequena, que é o tremor do
 * sensor no quarto escuro, e solta (α = 0,2) onde é grande, que é movimento de verdade. No escuro, tira ~55% do tremor e
 * arrasta a mão ~1 px. É ELA QUE FAZ A TROCA DE MODELO NÃO PISCAR: a máscara anterior é ampliada (ou reduzida) ao tamanho da
 * nova, e onde os dois modelos concordam quase nada muda de um quadro para o outro.
 */
const fs = require('node:fs');

/**
 * @typedef {{ id: string, largura: number, altura: number, saida: 'duas-classes' | 'alfa', placa: boolean }} Modelo
 */

/** O modesto: o PP-HumanSeg do OpenCV Zoo, 192 × 192, no processador. */
const MODESTO = /** @type {Modelo} */ ({ id: 'modesto', largura: 192, altura: 192, saida: 'duas-classes', placa: false });

/**
 * @param {typeof import('onnxruntime-node')} ort
 * @param {Modelo} modelo
 * @param {string} caminho
 */
function abrirModelo(ort, modelo, caminho) {
  /** @type {Promise<import('onnxruntime-common').InferenceSession> | null} */
  let sessao = null;
  const opcoes = modelo.placa
    ? {
        executionProviders: ['dml'],
        // o DirectML não aceita o padrão de memória nem a execução em paralelo (a documentação do onnxruntime)
        enableMemPattern: false,
        executionMode: /** @type {const} */ ('sequential'),
        graphOptimizationLevel: /** @type {const} */ ('all'),
        logSeverityLevel: /** @type {const} */ (3),
      }
    : {
        // medido: 2 núcleos dão 10,6 ms, 4 dão 7,9; quem usa a câmera pode estar jogando, e o jogo vem antes
        intraOpNumThreads: 2,
        interOpNumThreads: 1,
        executionMode: /** @type {const} */ ('sequential'),
        graphOptimizationLevel: /** @type {const} */ ('all'),
        logSeverityLevel: /** @type {const} */ (3),
        // entre um quadro e outro (66 ms) as threads do onnxruntime ficavam GIRANDO à espera de trabalho: medido no app, 0,55
        // de um núcleo, contra os 0,17 do estudo (que rodava quadro atrás de quadro, sem esperar)
        extra: { session: { intra_op: { allow_spinning: '0' }, inter_op: { allow_spinning: '0' } } },
      };
  function abrir() {
    sessao ??= ort.InferenceSession.create(fs.readFileSync(caminho), opcoes);
    return sessao;
  }
  const n = modelo.largura * modelo.altura;
  const entrada = new Float32Array(3 * n);
  /**
   * @param {Uint8Array} px RGBA, largura × altura do modelo
   * @returns {Promise<Float32Array>} a probabilidade (ou o alfa) da pessoa, de 0 a 1
   */
  async function rodar(px) {
    if (!(px instanceof Uint8Array) || px.length !== n * 4) throw new Error('quadro inválido');
    const s = await abrir();
    for (let p = 0; p < n; p++) {
      const o = p * 4;
      entrada[p] = px[o] * (2 / 255) - 1;
      entrada[n + p] = px[o + 1] * (2 / 255) - 1;
      entrada[2 * n + p] = px[o + 2] * (2 / 255) - 1;
    }
    const saidas = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, modelo.altura, modelo.largura]) });
    const d = /** @type {Float32Array} */ (saidas[s.outputNames[0]].data);
    const prob = new Float32Array(n);
    if (modelo.saida === 'alfa') {
      for (let p = 0; p < n; p++) prob[p] = Math.min(1, Math.max(0, d[p]));
    } else {
      for (let p = 0; p < n; p++) {
        const fundo = d[p];
        const pessoa = d[n + p];
        // a conversão já pode sair em probabilidade (as do PaddleSeg "with_softmax"); senão, a softmax das duas classes
        prob[p] = fundo >= 0 && pessoa >= 0 && Math.abs(fundo + pessoa - 1) < 0.01 ? pessoa : 1 / (1 + Math.exp(fundo - pessoa));
      }
    }
    return prob;
  }
  return { modelo, abrir, rodar };
}

/**
 * Amostra bilinear de uma imagem de `canais` valores por pixel para outro tamanho (centro do pixel). Serve à máscara anterior
 * (1 canal) na troca de modelo e ao quadro que chegou no tamanho do outro modelo (4 canais).
 * @template {Float32Array | Uint8Array} T
 * @param {T} img @param {number} w @param {number} h @param {number} W @param {number} H @param {number} canais
 * @param {new (n: number) => T} Tipo
 */
function redimensionar(img, w, h, W, H, canais, Tipo) {
  const r = new Tipo(W * H * canais);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / H - 0.5));
    const y0 = Math.min(h - 2, Math.floor(fy));
    const ay = h > 1 ? fy - y0 : 0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / W - 0.5));
      const x0 = Math.min(w - 2, Math.floor(fx));
      const ax = w > 1 ? fx - x0 : 0;
      for (let k = 0; k < canais; k++) {
        const q = (/** @type {number} */ yy, /** @type {number} */ xx) => img[(yy * w + xx) * canais + k];
        r[(y * W + x) * canais + k] = (q(y0, x0) * (1 - ax) + q(y0, x0 + 1) * ax) * (1 - ay) + (q(y0 + 1, x0) * (1 - ax) + q(y0 + 1, x0 + 1) * ax) * ay;
      }
    }
  }
  return r;
}

/** Uma câmera: guarda a máscara anterior (e o tamanho dela), para a média que se adapta. */
function criarSuavizacao() {
  /** @type {Float32Array | null} */
  let anterior = null;
  let la = 0;
  let aa = 0;
  /**
   * @param {Float32Array} atual a probabilidade do quadro, largura × altura
   * @returns {Uint8Array} a máscara suavizada, do mesmo tamanho
   */
  return function suavizar(atual, largura, altura) {
    const n = largura * altura;
    if (anterior && (la !== largura || aa !== altura)) anterior = redimensionar(anterior, la, aa, largura, altura, 1, Float32Array);
    const r = new Float32Array(atual);
    if (anterior) {
      for (let p = 0; p < n; p++) {
        const delta = Math.abs(r[p] - anterior[p]);
        const a = delta < 0.2 ? 0.8 : delta > 0.6 ? 0.2 : 0.8 - ((delta - 0.2) / 0.4) * 0.6;
        r[p] = a * anterior[p] + (1 - a) * r[p];
      }
    }
    anterior = r;
    la = largura;
    aa = altura;
    const mascara = new Uint8Array(n);
    for (let p = 0; p < n; p++) mascara[p] = Math.round(r[p] * 255);
    return mascara;
  };
}

module.exports = { MODESTO, abrirModelo, criarSuavizacao, redimensionar };
