// @ts-check
/**
 * O processo do recorte de fundo (um `utilityProcess` do Electron). Ver index.js, ao lado.
 *
 * Recebe os pixels da imagem já reduzida a 512 × 512 (RGBA) e devolve a máscara do objeto, 512 × 512, um byte por pixel
 * (255 = objeto, 0 = fundo). A página aplica a máscara na imagem do tamanho dela.
 *
 * A conta mora em birefnet.js, ao lado.
 */
const os = require('node:os');
const ort = require('onnxruntime-node');
const { criarRecorte } = require('./birefnet');

// Prioridade baixa: quem faz figurinha pode estar jogando, e o jogo vem antes.
try {
  os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // sem permissão para mudar: segue na normal
}

const { abrir, recortar } = criarRecorte(ort, process.argv[2]);

process.parentPort.on('message', async (e) => {
  const { id, tipo, pixels } = e.data ?? {};
  try {
    if (tipo === 'abrir') {
      await abrir();
      process.parentPort.postMessage({ id });
    } else if (tipo === 'recortar') {
      process.parentPort.postMessage({ id, mascara: await recortar(pixels) });
    }
  } catch (erro) {
    process.parentPort.postMessage({ id, erro: String(/** @type {any} */ (erro)?.message ?? erro) });
  }
});
