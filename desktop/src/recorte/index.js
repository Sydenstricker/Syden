// @ts-check
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { app, ipcMain, net, utilityProcess } = require('electron');

/**
 * O RECORTE DE FUNDO DAS FIGURINHAS (pedido dele, 04/11/2026: "implementa o BiRefNet lite"): o BiRefNet lite (MIT,
 * github.com/ZhengPeng7/BiRefNet), a 512 e em meia precisão, rodando nativo num processo à parte, como a supressão de ruído.
 *
 * SÓ NO APP, por decisão dele (04/11/2026): no site, a rede neural pediria WebAssembly e 'wasm-unsafe-eval' na política de
 * segurança, que ele decidiu não dar. No site fica o recorte do fundo liso, só código (web/src/figurinhaEfeitos.ts).
 *
 * O MODELO NÃO VEM NO PACOTE: são 98 MB, e quem não faz figurinha não precisa deles. Ele é baixado do NOSSO servidor
 * (/api/recorte-de-fundo/modelo) quando a pessoa pede, com o tamanho dito antes, e o sha256 é conferido aqui: o arquivo só
 * é usado se for exatamente o que foi medido (e2e/recorte-de-fundo/README.md). Fica nos dados do app, fora do pacote.
 *
 * A IMAGEM NÃO SAI DO COMPUTADOR: a página manda os pixels (512 × 512) ao processo, e ele devolve a máscara.
 *
 * PARA NÃO ATRAPALHAR QUEM JOGA (a regra do tradutor, 19/10/2026): o processo só existe enquanto há figurinha sendo feita
 * (sai sozinho depois de 3 minutos sem uso, e com ele os ~0,5 GB do modelo aberto), roda com prioridade baixa e com
 * metade dos núcleos.
 */

const NOME_DO_MODELO = 'birefnet-lite-512-fp16.onnx';
/** O arquivo medido em 04/11/2026: huggingface.co/shozebDev/birefnet-lite-512-onnx, revisão a1ef059c, onnx/model_fp16.onnx. */
const SHA256_DO_MODELO = 'cdcc278ab17011c8507c83f368935527a7cde826dec4dff7f3dc6e18474f4a81';
const TAMANHO_DO_MODELO = 98_451_949;
const SEM_USO_MS = 3 * 60_000;

const pasta = () => path.join(app.getPath('userData'), 'modelos');
const caminhoDoModelo = () => path.join(pasta(), NOME_DO_MODELO);

function disponivel() {
  return process.platform === 'win32' || !!process.env.SYDEN_RECORTE_EM_QUALQUER_SISTEMA;
}

function baixado() {
  try {
    return fs.statSync(caminhoDoModelo()).size === TAMANHO_DO_MODELO;
  } catch {
    return false;
  }
}

/** @type {Promise<void> | null} */
let baixando = null;

/**
 * Baixa o modelo do endereço que a página dá (o servidor do Syden que ela usa), conferindo o sha256 no caminho.
 * @param {Electron.WebContents} quem
 * @param {string} endereco
 */
function baixar(quem, endereco) {
  if (baixado()) return Promise.resolve();
  baixando ??= (async () => {
    const url = new URL(endereco);
    // Só o endereço do modelo, por https (ou o servidor local, em desenvolvimento). O sha256 decide o resto.
    if (!url.pathname.endsWith('/api/recorte-de-fundo/modelo')) throw new Error('Endereço do modelo inválido.');
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error('Endereço do modelo inválido.');
    fs.mkdirSync(pasta(), { recursive: true });
    const temporario = caminhoDoModelo() + '.baixando';
    const resposta = await net.fetch(url.toString());
    if (!resposta.ok || !resposta.body) throw new Error(`O servidor não entregou o modelo (${resposta.status}).`);
    const hash = crypto.createHash('sha256');
    const arquivo = fs.createWriteStream(temporario);
    let recebido = 0;
    let ultimoAviso = 0;
    const leitor = resposta.body.getReader();
    try {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        hash.update(value);
        recebido += value.length;
        if (!arquivo.write(value)) await new Promise((ok) => arquivo.once('drain', ok));
        if (Date.now() - ultimoAviso > 200 && !quem.isDestroyed()) {
          ultimoAviso = Date.now();
          quem.send('recorte:progresso', Math.min(1, recebido / TAMANHO_DO_MODELO));
        }
      }
    } finally {
      await new Promise((ok) => arquivo.end(ok));
    }
    if (hash.digest('hex') !== SHA256_DO_MODELO) {
      fs.rmSync(temporario, { force: true });
      throw new Error('O modelo baixado não confere. Tente de novo.');
    }
    fs.renameSync(temporario, caminhoDoModelo());
  })().finally(() => {
    baixando = null;
  });
  return baixando;
}

/** @type {Electron.UtilityProcess | null} */
let processo = null;
/** @type {NodeJS.Timeout | null} */
let relogio = null;
let pedidos = 0;
/** @type {Map<number, { ok: (v: any) => void, falha: (e: Error) => void }>} */
const esperando = new Map();

function adiarSaida() {
  if (relogio) clearTimeout(relogio);
  relogio = setTimeout(() => {
    if (esperando.size) return adiarSaida();
    processo?.kill();
    processo = null;
  }, SEM_USO_MS);
}

function garantirProcesso() {
  adiarSaida();
  if (processo) return processo;
  const filho = utilityProcess.fork(path.join(__dirname, 'processo.js'), [caminhoDoModelo()], {
    serviceName: 'Syden — recorte de fundo',
    stdio: 'inherit',
  });
  filho.on('message', (m) => {
    const espera = esperando.get(m?.id);
    if (!espera) return;
    esperando.delete(m.id);
    if (m.erro) espera.falha(new Error(m.erro));
    else espera.ok(m.mascara ?? true);
  });
  filho.on('exit', (codigo) => {
    if (processo === filho) processo = null;
    for (const espera of esperando.values()) espera.falha(new Error(`O recorte parou (código ${codigo}).`));
    esperando.clear();
  });
  processo = filho;
  return filho;
}

/** @param {any} mensagem */
function pedir(mensagem) {
  const id = ++pedidos;
  return new Promise((ok, falha) => {
    esperando.set(id, { ok, falha });
    garantirProcesso().postMessage({ ...mensagem, id });
  });
}

function setupRecorte() {
  ipcMain.handle('recorte:estado', () => ({ disponivel: disponivel(), baixado: baixado(), tamanho: TAMANHO_DO_MODELO }));
  ipcMain.handle('recorte:baixar', (event, endereco) => {
    if (!disponivel()) throw new Error('Indisponível neste sistema.');
    return baixar(event.sender, String(endereco));
  });
  // Abre o modelo antes da primeira imagem (abrir leva uns 8 s): a página chama ao abrir as figurinhas.
  ipcMain.handle('recorte:preparar', () => {
    if (!disponivel() || !baixado()) return false;
    return pedir({ tipo: 'abrir' }).then(() => true);
  });
  ipcMain.handle('recorte:recortar', (_event, pixels) => {
    if (!disponivel() || !baixado()) throw new Error('O recorte não está baixado.');
    if (!(pixels instanceof Uint8Array) || pixels.length !== 512 * 512 * 4) throw new Error('Imagem inválida.');
    return pedir({ tipo: 'recortar', pixels });
  });
}

function pararRecorte() {
  processo?.kill();
  processo = null;
}

module.exports = { setupRecorte, pararRecorte };
