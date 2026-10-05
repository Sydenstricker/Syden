// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain, MessageChannelMain, utilityProcess } = require('electron');

/**
 * Supressão de ruído do app: o DPDFNet (Ceva, Apache 2.0) rodando nativo, num processo à parte.
 *
 * POR QUE NO APP, E NÃO NO SITE: no site, rodar rede neural de verdade pede WebAssembly, e WebAssembly
 * pede 'wasm-unsafe-eval' na política de segurança — permissão que o Sydenstricker decidiu não dar
 * (04/10/2026). O site usa o GTCRN em JavaScript puro (web/public/ruido). Aqui no app não há política de
 * página no caminho: o modelo roda em código nativo, fora da página.
 *
 * POR QUE O DPDFNET, e não o DeepFilterNet3 que ganhou a primeira comparação: medido na gravação real
 * de um ventilador, o DPDFNet (que é o DeepFilterNet2 com blocos de RNN de dois caminhos) deu nota
 * geral 3,26 contra 3,17 do DeepFilterNet3, custando o mesmo (~12% de um núcleo). E o DeepFilterNet3
 * só existe pronto para tempo real como plugin LADSPA, que mantém uma thread girando à toa (~40% de
 * um núcleo, medido) e DERRUBA o processo quando acha que o computador não acompanha.
 *
 * O CAMINHO DO SOM: a thread de áudio da página manda o microfone (16 kHz) por uma MessagePort ligada
 * direto ao processo da supressão, e recebe de volta pela mesma porta. Ver web/src/microfone.ts.
 */

const PASTA_DO_MODELO = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', '..', 'ruido');

/** @type {Electron.UtilityProcess | null} */
let processo = null;
let quedas = 0;

function disponivel() {
  if (process.platform !== 'win32' && !process.env.SYDEN_RUIDO_EM_QUALQUER_SISTEMA) return false;
  // Desliga de propósito, para comparar com o caminho do site sem reinstalar nada.
  if (process.env.SYDEN_SEM_RUIDO_NATIVO === '1') return false;
  // Se o processo caiu muitas vezes, esta máquina não roda o modelo: o site segue com o GTCRN.
  if (quedas >= 3) return false;
  return fs.existsSync(path.join(PASTA_DO_MODELO, 'dpdfnet-baseline.onnx'));
}

function garantirProcesso() {
  if (processo) return processo;
  const filho = utilityProcess.fork(path.join(__dirname, 'processo.js'), [], {
    serviceName: 'Syden — supressão de ruído',
    stdio: 'inherit',
  });
  filho.on('exit', (codigo) => {
    if (processo === filho) processo = null;
    // Saída com código 0 é o app fechando; o resto é queda. As portas que estavam abertas morrem
    // junto, e a página percebe pelo silêncio (ver o vigia em ponte.worklet.js) e volta para o GTCRN.
    if (codigo !== 0) {
      quedas++;
      console.error(`Supressão de ruído: o processo caiu (código ${codigo}), queda nº ${quedas}.`);
    }
  });
  processo = filho;
  return filho;
}

function setupRuido() {
  ipcMain.handle('ruido:disponivel', () => disponivel());
  ipcMain.on('ruido:abrir', (event) => {
    if (!disponivel()) return;
    const { port1, port2 } = new MessageChannelMain();
    garantirProcesso().postMessage({ tipo: 'porta' }, [port1]);
    event.sender.postMessage('ruido:porta', null, [port2]);
  });
}

function pararRuido() {
  processo?.kill();
  processo = null;
}

module.exports = { setupRuido, pararRuido };
