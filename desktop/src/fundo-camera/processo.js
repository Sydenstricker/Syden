// @ts-check
/**
 * O processo do fundo da câmera (um `utilityProcess` do Electron). Ver index.js, ao lado.
 *
 * Cada câmera que liga o efeito recebe uma porta (MessagePort) própria, ligada direto à página: o quadro reduzido (192 × 192)
 * vem por ela e a máscara volta por ela, sem passar pelo processo principal. A página só manda o próximo quadro depois de
 * receber a máscara do anterior, então nunca há fila aqui.
 *
 * Sem nenhuma porta aberta por um minuto, o processo sai sozinho, e com ele a memória do modelo.
 */
const os = require('node:os');
const ort = require('onnxruntime-node');
const { criarSegmentador } = require('./pphumanseg');

// Prioridade baixa: quem liga a câmera pode estar jogando, e o jogo vem antes.
try {
  os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // sem permissão para mudar: segue na normal
}

const segmentador = criarSegmentador(ort, process.argv[2]);
let abertas = 0;
/** @type {NodeJS.Timeout | null} */
let saida = null;

function talvezSair() {
  if (saida) clearTimeout(saida);
  saida = abertas > 0 ? null : setTimeout(() => process.exit(0), 60_000);
}

process.parentPort.on('message', (e) => {
  if (e.data?.tipo !== 'porta' || !e.ports[0]) return;
  /** @type {Electron.MessagePortMain} */
  const porta = e.ports[0];
  const segmentar = segmentador.fluxo();
  abertas++;
  talvezSair();
  porta.on('message', async (m) => {
    const { id, pixels } = m.data ?? {};
    try {
      // o Uint8Array pode chegar como Buffer (que é um Uint8Array) ou como a visão de um ArrayBuffer
      const px = pixels instanceof Uint8Array ? pixels : pixels instanceof ArrayBuffer ? new Uint8Array(pixels) : ArrayBuffer.isView(pixels) ? new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength) : pixels;
      const mascara = await segmentar(px);
      porta.postMessage({ id, mascara });
    } catch (erro) {
      porta.postMessage({ id, erro: String(/** @type {any} */ (erro)?.message ?? erro) });
    }
  });
  porta.on('close', () => {
    abertas--;
    talvezSair();
  });
  porta.start();
  // abre o modelo já, para o primeiro quadro não esperar
  segmentador.abrir().catch(() => {});
});

talvezSair();
