// @ts-check
/**
 * O processo da supressão de ruído do app (um `utilityProcess` do Electron).
 *
 * POR QUE UM PROCESSO À PARTE, e não no principal: a rede neural roda em código nativo (onnxruntime), e
 * código nativo que quebra derruba o processo inteiro. Aqui, se quebrar, cai só a supressão — a voz
 * segue sem ela, a tela diz que o DPDFNet parou, e a chamada continua. E o processo principal,
 * que desenha a janela e cuida dos atalhos, não divide tempo com a voz.
 *
 * Cada microfone que liga a supressão recebe uma porta (MessagePort) própria, ligada direto à thread de
 * áudio da página: o som não passa pelo processo principal nem pela página, só por aqui e de volta.
 */
const fs = require('node:fs');
const path = require('node:path');

// Empacotado, o onnxruntime mora fora do asar (o Windows só carrega DLL de arquivo de verdade): o
// require normal acha o pacote, e o pacote acha os binários pelo caminho desempacotado.
const ort = require('onnxruntime-node');
const { criarFluxo } = require('./dpdfnet');

// Empacotado, o modelo fica FORA do asar (asarUnpack no package.json), como o onnxruntime: arquivo de
// verdade no disco, que qualquer um lê sem depender do sistema de arquivos especial do Electron.
const PASTA = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', '..', 'ruido');
const cfg = JSON.parse(fs.readFileSync(path.join(PASTA, 'dpdfnet-baseline.json'), 'utf8'));

/** @type {Promise<import('onnxruntime-common').InferenceSession> | null} */
let sessao = null;
function abrirSessao() {
  // O modelo vai como bytes, e não como caminho: dentro do asar, o onnxruntime (que é C++) não
  // enxergaria o arquivo; o fs do Electron enxerga.
  sessao ??= ort.InferenceSession.create(fs.readFileSync(path.join(PASTA, 'dpdfnet-baseline.onnx')), {
    // Uma thread só: medido, duas não aceleram este modelo e dobram o processador gasto.
    intraOpNumThreads: 1,
    interOpNumThreads: 1,
    executionMode: 'sequential',
  });
  return sessao;
}

/** @param {Electron.MessagePortMain} porta */
async function atender(porta) {
  const fluxo = criarFluxo(await abrirSessao(), ort.Tensor, cfg);
  // Uma de cada vez: o estado da rede neural depende da ordem dos quadros.
  let fila = Promise.resolve();
  let ultimoAviso = Date.now();
  porta.on('message', (e) => {
    const pedaco = e.data;
    if (!(pedaco instanceof Float32Array)) return;
    fila = fila.then(async () => {
      const limpo = await fluxo.processar(pedaco);
      if (limpo.length) porta.postMessage(limpo);
      if (Date.now() - ultimoAviso > 5000) {
        ultimoAviso = Date.now();
        porta.postMessage({ custoMsPorQuadro: fluxo.custo(), quadroMs: 10 });
      }
    }).catch((erro) => {
      porta.postMessage({ erro: String(erro?.message ?? erro) });
    });
  });
  porta.on('close', () => {
    fila = Promise.resolve();
  });
  porta.start();
  porta.postMessage({ pronto: true });
}

process.parentPort.on('message', (e) => {
  if (e.data?.tipo === 'porta' && e.ports[0]) {
    atender(e.ports[0]).catch((erro) => {
      e.ports[0].postMessage({ erro: String(erro?.message ?? erro) });
    });
  }
});

// Abre o modelo já na subida: o primeiro "liga a supressão" não espera o carregamento (~100 ms).
abrirSessao().catch(() => {});
