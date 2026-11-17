// @ts-check
/**
 * O REFINADO, NUMA THREAD À PARTE do processo do fundo da câmera (17/11/2026). Medido: abrir o modelo pelo DirectML trava a
 * thread que abre por ~1,5 s (o onnxruntime-node compila o grafo para a placa sem soltar a thread), e cada quadro a trava pelo
 * tempo dele. Na thread do processo, o modesto ficava sem responder nesse tempo, e a página, que desiste do processo calado por
 * 2 s, desligava o efeito. Aqui, a placa abre e roda sem segurar o modesto.
 *
 * Mensagens: { tipo: 'abrir', caminho } → { tipo: 'pronta', mediana } | { tipo: 'falhou', erro }
 *            { tipo: 'rodar', id, px } → { tipo: 'alfa', id, prob, ms } | { tipo: 'erro', id, erro }
 */
const { parentPort } = require('node:worker_threads');
const ort = require('onnxruntime-node');
const { abrirModelo } = require('./segmentador');
const { REFINADO } = require('./modelos');
const { LIMITE_DA_ABERTURA_MS } = require('./decisor');

if (!parentPort) throw new Error('placa.js roda como worker');
const porta = parentPort;
/** @type {ReturnType<typeof abrirModelo> | null} */
let modelo = null;

porta.on('message', async (m) => {
  if (m?.tipo === 'abrir') {
    try {
      const r = abrirModelo(ort, REFINADO, m.caminho);
      await r.abrir();
      // a placa pode? 3 quadros de aquecimento e 8 medidos; a mediana tem de caber no limite do decisor
      const quadro = new Uint8Array(REFINADO.largura * REFINADO.altura * 4).fill(128);
      for (let i = 0; i < 3; i++) await r.rodar(quadro);
      const tempos = [];
      for (let i = 0; i < 8; i++) {
        const t0 = performance.now();
        await r.rodar(quadro);
        tempos.push(performance.now() - t0);
      }
      const mediana = tempos.sort((a, b) => a - b)[4];
      if (mediana > LIMITE_DA_ABERTURA_MS) {
        porta.postMessage({ tipo: 'falhou', erro: `a placa roda o refinado em ${mediana.toFixed(1)} ms, acima de ${LIMITE_DA_ABERTURA_MS}` });
        return;
      }
      modelo = r;
      porta.postMessage({ tipo: 'pronta', mediana });
    } catch (erro) {
      porta.postMessage({ tipo: 'falhou', erro: String(/** @type {any} */ (erro)?.message ?? erro).slice(0, 200) });
    }
    return;
  }
  if (m?.tipo === 'rodar') {
    try {
      if (!modelo) throw new Error('a placa não está pronta');
      const t0 = performance.now();
      const prob = await modelo.rodar(m.px);
      const ms = performance.now() - t0;
      porta.postMessage({ tipo: 'alfa', id: m.id, prob, ms }, [prob.buffer]);
    } catch (erro) {
      porta.postMessage({ tipo: 'erro', id: m.id, erro: String(/** @type {any} */ (erro)?.message ?? erro).slice(0, 200) });
    }
  }
});
