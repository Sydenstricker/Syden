// @ts-check
/**
 * Os dois modelos do fundo da câmera, que moram em desktop/fundo-camera/ (com a ORIGEM.txt e as licenças). Medida e escolha:
 * e2e/fundo-da-camera/README.md.
 *
 * - O MODESTO: o PP-HumanSeg 192 × 192 (OpenCV Zoo), no processador, para todos (segmentador.js, MODESTO).
 * - O REFINADO (17/11/2026): o PP-MattingV2 512 × 512 do PaddleSeg, em meia precisão, pela placa. É um modelo de RECORTE (o
 *   alfa de verdade, fio de cabelo meio transparente), não de segmentação: a borda sai com ~1 px contra os ~5 do modesto.
 *   Pelo DirectML, ~5–7 ms por quadro numa RTX 3070; no processador, ~290 ms (por isso só pela placa). A webcam de 16:9 vai
 *   espremida a 512 × 512, como no modesto (o ONNX dele só sai com lados que as médias adaptativas dividem bem; ver
 *   e2e/fundo-da-camera/converter-paddle.py). NO ESCURO ELE SE PERDE (medido nos vídeos do estudo escurecidos): no Automático,
 *   câmera com pouca luz vai ao modesto (decisor.js, criarLuz).
 */

const ARQUIVO_MODESTO = 'pphumanseg-192.onnx';
const ARQUIVO_REFINADO = 'ppmatting-v2-512-fp16.onnx';

/** @type {import('./segmentador').Modelo} */
const REFINADO = { id: 'refinado', largura: 512, altura: 512, saida: 'alfa', placa: true };

module.exports = { ARQUIVO_MODESTO, ARQUIVO_REFINADO, REFINADO };
