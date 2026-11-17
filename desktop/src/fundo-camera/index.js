// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain, MessageChannelMain, utilityProcess } = require('electron');
const { ARQUIVO_MODESTO, ARQUIVO_REFINADO } = require('./modelos');
const { vigiarJogo } = require('./jogo');

/**
 * O FUNDO DA CÂMERA, como o NVIDIA Broadcast (pedido dele, 14/11/2026; "pode construir", 16/11/2026): desfocar, apagar ou
 * trocar por uma imagem o que está atrás da pessoa, em qualquer placa de vídeo.
 *
 * SÓ NO APP: o site não roda rede neural (pediria WebAssembly e o 'wasm-unsafe-eval' que ele decidiu não dar). Aqui o
 * PP-HumanSeg (Apache 2.0, 6 MB, versionado em desktop/fundo-camera/ como o modelo do ruído) roda nativo pelo
 * onnxruntime-node, num processo à parte: se quebrar, cai só o efeito, e a câmera segue sem ele.
 *
 * DOIS MODELOS (17/11/2026, "pode fazer os 3"): o MODESTO, no processador, para todos, e o REFINADO, pela placa (DirectML),
 * que entra SOZINHO quando ela pode e sai quando um jogo vem para a frente ou a placa aperta (decisor.js, jogo.js). Ninguém
 * escolhe qualidade. Medida e escolha: e2e/fundo-da-camera/README.md, "Os refinados".
 *
 * PARA NÃO ATRAPALHAR QUEM JOGA: 2 núcleos e prioridade baixa, ~0,17 de um núcleo a 15 quadros por segundo (medido em
 * 14–15/11/2026, e2e/fundo-da-camera/README.md); o processo só existe com uma câmera usando o efeito, e sai sozinho um
 * minuto depois da última. A IMAGEM DA CÂMERA NÃO SAI DO COMPUTADOR: o quadro reduzido vai por uma porta direta da página
 * ao processo, e a máscara volta pela mesma porta. A página monta o resultado pela placa (web/src/fundoDaCamera.ts).
 */

const PASTA = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', '..', 'fundo-camera');
const MODELO = path.join(PASTA, ARQUIVO_MODESTO);
const REFINADO = path.join(PASTA, ARQUIVO_REFINADO);

/** @type {Electron.UtilityProcess | null} */
let processo = null;
let quedas = 0;

function disponivel() {
  if (process.platform !== 'win32' && !process.env.SYDEN_FUNDO_EM_QUALQUER_SISTEMA) return false;
  // Se o processo caiu muitas vezes, esta máquina não roda o modelo: a opção some, e a câmera vai como sempre.
  if (quedas >= 3) return false;
  return fs.existsSync(MODELO);
}

/** @type {(() => void) | null} */
let pararDeVigiar = null;

function garantirProcesso() {
  if (processo) return processo;
  // o refinado só vai se estiver no pacote; o processo decide sozinho se a placa o roda (ver decisor.js)
  const filho = utilityProcess.fork(path.join(__dirname, 'processo.js'), [MODELO, fs.existsSync(REFINADO) ? REFINADO : ''], {
    serviceName: 'Syden — fundo da câmera',
    stdio: 'inherit',
  });
  // a janela da frente, enquanto o processo existe: com um jogo na frente, o refinado desce ao modesto (a placa é do jogo)
  pararDeVigiar?.();
  pararDeVigiar = vigiarJogo((exe) => {
    if (processo === filho) filho.postMessage({ tipo: 'jogo', exe });
  });
  filho.on('exit', (codigo) => {
    if (processo === filho) {
      processo = null;
      pararDeVigiar?.();
      pararDeVigiar = null;
    }
    // 0 é a saída de "um minuto sem câmera"; o resto é queda
    if (codigo !== 0) {
      quedas++;
      console.error(`Fundo da câmera: o processo caiu (código ${codigo}), queda nº ${quedas}.`);
    }
  });
  processo = filho;
  return filho;
}

function setupFundoCamera() {
  ipcMain.handle('fundo-camera:disponivel', () => disponivel());
  ipcMain.on('fundo-camera:abrir', (event) => {
    if (!disponivel()) return;
    const { port1, port2 } = new MessageChannelMain();
    garantirProcesso().postMessage({ tipo: 'porta' }, [port1]);
    event.sender.postMessage('fundo-camera:porta', null, [port2]);
  });
}

function pararFundoCamera() {
  pararDeVigiar?.();
  pararDeVigiar = null;
  processo?.kill();
  processo = null;
}

module.exports = { setupFundoCamera, pararFundoCamera };
