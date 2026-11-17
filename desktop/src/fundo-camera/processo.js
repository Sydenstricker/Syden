// @ts-check
/**
 * O processo do fundo da câmera (um `utilityProcess` do Electron). Ver index.js, ao lado.
 *
 * Cada câmera que liga o efeito recebe uma porta (MessagePort) própria, ligada direto à página: o quadro reduzido vem por ela e
 * a máscara volta por ela, sem passar pelo processo principal. A página só manda o próximo quadro depois de receber a máscara
 * do anterior, então nunca há fila aqui.
 *
 * DOIS MODELOS (17/11/2026): o modesto (o "Leve" da tela), no processador, sempre aberto; e o refinado (o "Completo"), pela
 * placa, que abre ao lado, numa thread à parte (placa.js), e só roda quando deve: no Automático, quando o decisor deixa
 * (decisor.js: a placa pronta, nenhum jogo na frente, sem aperto); com a escolha da pessoa, sempre a escolha (nivelDaCamera).
 * Cada resposta diz o tamanho do PRÓXIMO quadro (`pedir`): a página reduz a câmera ao tamanho do modelo da vez. Um quadro que
 * chega no tamanho do outro modelo (a troca aconteceu no meio) é redimensionado aqui, e nenhum quadro fica sem máscara.
 *
 * Sem nenhuma porta aberta por um minuto, o processo sai sozinho, e com ele a memória dos modelos (e a da placa).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const ort = require('onnxruntime-node');
const { MODESTO, abrirModelo, criarSuavizacao, redimensionar } = require('./segmentador');
const { decisorInicial, nivelDaCamera, criarLuz, comPlaca, comJogo, comTempo } = require('./decisor');
const { REFINADO } = require('./modelos');

// Prioridade baixa: quem liga a câmera pode estar jogando, e o jogo vem antes.
try {
  os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  // sem permissão para mudar: segue na normal
}

const [caminhoModesto, caminhoRefinado] = process.argv.slice(2);
const modesto = abrirModelo(ort, MODESTO, caminhoModesto);
let decisor = decisorInicial();
let jogoExe = /** @type {string | null} */ (null);
/** O refinado não roda neste computador (sem o arquivo, sem o DirectML, placa lenta, ou ela caiu): o Completo fica indisponível. */
let semRefinado = !caminhoRefinado || Boolean(process.env.SYDEN_FUNDO_SEM_PLACA);

/**
 * A PLACA (placa.js, numa thread à parte: abrir pelo DirectML trava a thread por ~1,5 s, e o modesto ficaria sem responder).
 * Ela abre o refinado e mede se ele cabe no tempo; sem o DirectML no pacote (o app de antes), sem placa que o rode, ou lenta,
 * o refinado fica de fora até o processo sair, e o modesto segue sozinho.
 */
/** @type {Worker | null} */
let placa = null;
/** @type {Map<number, (r: { prob?: Float32Array, ms?: number, erro?: string }) => void>} */
const pedidos = new Map();
let proximoPedido = 1;
const PRAZO_DA_PLACA_MS = 400;
function perderPlaca() {
  semRefinado = true;
  decisor = comPlaca(decisor, false);
}
function abrirPlaca() {
  if (placa || semRefinado) return;
  placa = new Worker(path.join(__dirname, 'placa.js'));
  placa.on('message', (m) => {
    if (m.tipo === 'pronta') decisor = comPlaca(decisor, true);
    else if (m.tipo === 'falhou') {
      console.error('Fundo da câmera: o refinado ficou de fora;', m.erro);
      perderPlaca();
    } else {
      pedidos.get(m.id)?.(m);
      pedidos.delete(m.id);
    }
  });
  placa.on('error', (erro) => {
    console.error('Fundo da câmera: a thread da placa caiu;', String(erro?.message ?? erro).slice(0, 200));
    perderPlaca();
  });
  placa.on('exit', () => {
    placa = null;
    perderPlaca();
    for (const responder of pedidos.values()) responder({ erro: 'a thread da placa saiu' });
    pedidos.clear();
  });
  placa.postMessage({ tipo: 'abrir', caminho: caminhoRefinado });
}
/** @param {Uint8Array} px @returns {Promise<{ prob?: Float32Array, ms?: number, erro?: string }>} */
function rodarNaPlaca(px) {
  return new Promise((responder) => {
    if (!placa) return responder({ erro: 'sem a placa' });
    const id = proximoPedido++;
    // a placa presa (outro programa segurando a placa inteira) não pode deixar a página sem máscara: em 400 ms, o modesto
    // responde por este quadro, e a demora conta como um quadro lento para o decisor
    const prazo = setTimeout(() => {
      pedidos.delete(id);
      responder({ erro: 'a placa demorou', ms: PRAZO_DA_PLACA_MS });
    }, PRAZO_DA_PLACA_MS);
    pedidos.set(id, (r) => {
      clearTimeout(prazo);
      responder(r);
    });
    placa.postMessage({ tipo: 'rodar', id, px });
  });
}

let abertas = 0;
/** @type {NodeJS.Timeout | null} */
let saida = null;

function talvezSair() {
  if (saida) clearTimeout(saida);
  saida = abertas > 0 ? null : setTimeout(() => process.exit(0), 60_000);
}

const PREFERENCIAS = new Set(['automatico', 'leve', 'completo']);

process.parentPort.on('message', (e) => {
  if (e.data?.tipo === 'jogo') {
    jogoExe = e.data.exe ?? null;
    decisor = comJogo(decisor, Boolean(e.data.exe), performance.now());
    return;
  }
  if (e.data?.tipo !== 'porta' || !e.ports[0]) return;
  /** @type {Electron.MessagePortMain} */
  const porta = e.ports[0];
  const suavizar = criarSuavizacao();
  const luz = criarLuz();
  /** O que esta câmera usou no quadro anterior, e as descidas dela no Automático (numeradas: a página conta cada uma uma vez). */
  let anterior = /** @type {'modesto' | 'refinado' | null} */ (null);
  let descida = /** @type {{ n: number, motivo: string, exe?: string } | null} */ (null);
  abertas++;
  talvezSair();
  porta.on('message', async (m) => {
    const { id, pixels, largura = MODESTO.largura, altura = MODESTO.altura } = m.data ?? {};
    const preferencia = PREFERENCIAS.has(m.data?.preferencia) ? m.data.preferencia : 'automatico';
    try {
      // o Uint8Array pode chegar como Buffer (que é um Uint8Array) ou como a visão de um ArrayBuffer
      const px = pixels instanceof Uint8Array ? pixels : pixels instanceof ArrayBuffer ? new Uint8Array(pixels) : ArrayBuffer.isView(pixels) ? new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength) : pixels;
      if (!(px instanceof Uint8Array) || !Number.isInteger(largura) || !Number.isInteger(altura) || largura > 1024 || altura > 1024 || px.length !== largura * altura * 4) throw new Error('quadro inválido');
      /** @type {Float32Array | null} */
      let prob = null;
      let usado = MODESTO;
      const escuro = luz(px);
      if (nivelDaCamera(decisor, performance.now(), preferencia, escuro) === 'refinado') {
        // chegou no tamanho do outro modelo (a troca foi no meio): redimensiona aqui
        const q = largura === REFINADO.largura && altura === REFINADO.altura ? px : redimensionar(px, largura, altura, REFINADO.largura, REFINADO.altura, 4, Uint8Array);
        const r = await rodarNaPlaca(q);
        if (r.prob) {
          prob = r.prob;
          usado = REFINADO;
        }
        // SYDEN_FUNDO_MEDIR=<arquivo>: o e2e do app guarda o tempo de cada quadro do refinado (fora do teste, nada)
        if (r.ms !== undefined && process.env.SYDEN_FUNDO_MEDIR) fs.appendFileSync(process.env.SYDEN_FUNDO_MEDIR, `${r.ms.toFixed(1)}\n`);
        // o aperto só conta no Automático: a escolha da pessoa não é trocada (decisor.js, nivelDaCamera)
        if (r.ms !== undefined && preferencia === 'automatico') decisor = comTempo(decisor, r.ms, performance.now()).decisor;
        // a placa falhou neste quadro: o modesto responde por ele
      }
      if (!prob) {
        const q = largura === MODESTO.largura && altura === MODESTO.altura ? px : redimensionar(px, largura, altura, MODESTO.largura, MODESTO.altura, 4, Uint8Array);
        prob = await modesto.rodar(q);
      }
      const nivel = usado === REFINADO ? 'refinado' : 'modesto';
      if (preferencia === 'automatico' && anterior === 'refinado' && nivel === 'modesto' && decisor.motivo !== 'placa') {
        const motivo = escuro ? 'escuro' : (decisor.motivo ?? 'aperto');
        descida = { n: (descida?.n ?? 0) + 1, motivo, exe: motivo === 'jogo' ? (jogoExe ?? undefined) : undefined };
      }
      anterior = nivel;
      const mascara = suavizar(prob, usado.largura, usado.altura);
      const proximo = nivelDaCamera(decisor, performance.now(), preferencia, escuro) === 'refinado' ? REFINADO : MODESTO;
      porta.postMessage({ id, mascara, largura: usado.largura, altura: usado.altura, pedir: [proximo.largura, proximo.altura], nivel, descida, semRefinado });
    } catch (erro) {
      porta.postMessage({ id, erro: String(/** @type {any} */ (erro)?.message ?? erro) });
    }
  });
  porta.on('close', () => {
    abertas--;
    talvezSair();
  });
  porta.start();
  // abre os modelos já, para o primeiro quadro não esperar; a placa ao lado, sem segurar o modesto
  modesto.abrir().catch(() => {});
  abrirPlaca();
});

talvezSair();
