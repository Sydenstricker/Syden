// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { ipcMain, utilityProcess } = require('electron');

/**
 * O RECORTE DE FUNDO DAS FIGURINHAS (pedido dele, 04/11/2026: "implementa o BiRefNet lite"): o BiRefNet lite (MIT,
 * github.com/ZhengPeng7/BiRefNet), a 512 e em meia precisão, rodando nativo num processo à parte, como a supressão de ruído.
 *
 * SÓ NO APP, por decisão dele (04/11/2026): no site, a rede neural pediria WebAssembly e 'wasm-unsafe-eval' na política de
 * segurança, que ele decidiu não dar. No site fica o recorte do fundo liso, só código (web/src/figurinhaEfeitos.ts).
 *
 * O MODELO VEM DENTRO DO APP (decisão dele, mesmo dia: "pra que esse atrito inicial?"): desktop/recorte-modelo/, fora do asar
 * como o do ruído. Não mora no git (98 MB): desktop/scripts/baixar-recorte.js o põe lá antes de gerar o pacote, conferindo o
 * sha256 do arquivo medido. A IMAGEM NÃO SAI DO COMPUTADOR: a página manda os pixels (512 × 512) ao processo, e ele devolve
 * a máscara.
 *
 * PARA NÃO ATRAPALHAR QUEM JOGA (a regra do tradutor, 19/10/2026): o processo só existe enquanto há figurinha sendo feita
 * (sai sozinho depois de 3 minutos sem uso, e com ele a memória do modelo aberto), roda com prioridade baixa e com metade
 * dos núcleos.
 */

const MODELO = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), '..', '..', 'recorte-modelo', 'birefnet-lite-512-fp16.onnx');
const SEM_USO_MS = 3 * 60_000;

let quedas = 0;

function disponivel() {
  if (process.platform !== 'win32' && !process.env.SYDEN_RECORTE_EM_QUALQUER_SISTEMA) return false;
  // Se o processo caiu muitas vezes, esta máquina não roda o modelo: fica o recorte do fundo liso, e a prévia diz.
  if (quedas >= 3) return false;
  return fs.existsSync(MODELO);
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
  const filho = utilityProcess.fork(path.join(__dirname, 'processo.js'), [MODELO], {
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
    // Saída sem pedido pendente é a de "3 minutos sem uso" (ou o app fechando); com pedido, é queda.
    if (esperando.size) {
      quedas++;
      console.error(`Recorte de fundo: o processo caiu (código ${codigo}), queda nº ${quedas}.`);
    }
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
  ipcMain.handle('recorte:disponivel', () => disponivel());
  // Abre o modelo antes da primeira imagem (abrir leva uns 8 s): a página chama ao abrir as figurinhas.
  ipcMain.handle('recorte:preparar', () => {
    if (!disponivel()) return false;
    return pedir({ tipo: 'abrir' }).then(() => true);
  });
  ipcMain.handle('recorte:recortar', (_event, pixels) => {
    if (!disponivel()) throw new Error('O recorte não está disponível.');
    if (!(pixels instanceof Uint8Array) || pixels.length !== 512 * 512 * 4) throw new Error('Imagem inválida.');
    return pedir({ tipo: 'recortar', pixels });
  });
}

function pararRecorte() {
  processo?.kill();
  processo = null;
}

module.exports = { setupRecorte, pararRecorte };
