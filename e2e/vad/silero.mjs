// O SILERO VAD (v6, 16 kHz) em JAVASCRIPT PURO, escrito à mão, sem interpretador de ONNX: o modelo é pequeno e fixo
// (309 mil pesos), e a conta inteira cabe em ~100 linhas. Feito como o motor.js do site: toda memória reservada na criação,
// e rodar um pedaço não cria objeto nenhum (a thread de áudio não pode esperar o coletor de lixo).
//
// A arquitetura (lida do grafo ONNX e dos pesos do silero_vad_16k.safetensors, MIT, github.com/snakers4/silero-vad):
//   entrada: 512 amostras novas + as 64 últimas do pedaço anterior (o "contexto" do wrapper oficial) = 576
//   STFT: espelha 64 amostras no fim (640), 4 janelas de 256 com passo 128, janela de Hann periódica, só a magnitude (129)
//         — o modelo faz isso como uma Conv1d com a base da DFT; aqui é uma FFT de 256 (a base foi conferida: é Hann × DFT)
//   codificador: 4 Conv1d k=3 (129→128 s1, 128→64 s2, 64→64 s2, 64→128 s1), cada uma com ReLU: 4 → 4 → 2 → 1 → 1 quadros
//   decodificador: LSTMCell(128, 128) com o estado (h, c) vindo do pedaço anterior; ReLU; Conv1d 128→1; sigmoide
//   saída: a probabilidade de voz do pedaço (32 ms)
import { readFileSync } from 'node:fs';
import { lerOnnx } from './onnx-leitor.mjs';

// OS PESOS VÊM DO ONNX OFICIAL (silero_vad_16k_op15.onnx, v6.2.3). O silero_vad_16k.safetensors da mesma pasta do repositório
// tem OUTROS pesos (medido: até 4,0 de diferença na conv1, e as probabilidades erram até 0,2 contra o onnxruntime): não usar.
const NOMES = {
  'model.stft.forward_basis_buffer': 'stft_conv.weight',
  'model.encoder.0.reparam_conv.weight': 'conv1.weight', 'model.encoder.0.reparam_conv.bias': 'conv1.bias',
  'model.encoder.1.reparam_conv.weight': 'conv2.weight', 'model.encoder.1.reparam_conv.bias': 'conv2.bias',
  'model.encoder.2.reparam_conv.weight': 'conv3.weight', 'model.encoder.2.reparam_conv.bias': 'conv3.bias',
  'model.encoder.3.reparam_conv.weight': 'conv4.weight', 'model.encoder.3.reparam_conv.bias': 'conv4.bias',
  'model.decoder.rnn.weight_ih': 'lstm_cell.weight_ih', 'model.decoder.rnn.weight_hh': 'lstm_cell.weight_hh',
  'model.decoder.rnn.bias_ih': 'lstm_cell.bias_ih', 'model.decoder.rnn.bias_hh': 'lstm_cell.bias_hh',
  'model.decoder.decoder.2.weight': 'final_conv.weight', 'model.decoder.decoder.2.bias': 'final_conv.bias',
};
export function pesosDoOnnx(arq) {
  const p = {};
  for (const t of lerOnnx(arq).grafo.pesos) if (NOMES[t.nome]) p[NOMES[t.nome]] = new Float32Array(t.raw.buffer.slice(t.raw.byteOffset, t.raw.byteOffset + t.raw.byteLength));
  return p;
}

export function lerSafetensors(arq) {
  const b = readFileSync(arq);
  const n = Number(b.readBigUInt64LE(0));
  const h = JSON.parse(b.toString('utf8', 8, 8 + n));
  const p = {};
  for (const [k, v] of Object.entries(h)) {
    if (k === '__metadata__') continue;
    const [i, f] = v.data_offsets;
    p[k] = new Float32Array(b.buffer.slice(b.byteOffset + 8 + n + i, b.byteOffset + 8 + n + f));
  }
  return p;
}

const NF = 256, BINS = 129, PASSO = 128, CTX = 64, PEDACO = 512;

export function criarSilero(p, { stftPorMatriz = false, desenrolar = true } = {}) {
  // a FFT de 256 com tabelas prontas
  const bits = new Uint16Array(NF);
  for (let i = 0, j = 0; i < NF; i++) { bits[i] = j; let bit = NF >> 1; while (j & bit) { j ^= bit; bit >>= 1; } j |= bit; }
  const cosT = new Float32Array(NF / 2), senT = new Float32Array(NF / 2);
  for (let i = 0; i < NF / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / NF); senT[i] = Math.sin((2 * Math.PI * i) / NF); }
  const hann = new Float32Array(NF);
  for (let i = 0; i < NF; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NF);
  const re = new Float32Array(NF), im = new Float32Array(NF);
  function fft() {
    for (let i = 0; i < NF; i++) { const j = bits[i]; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= NF; len <<= 1) {
      const meio = len >> 1, salto = NF / len;
      for (let i = 0; i < NF; i += len) for (let k = 0; k < meio; k++) {
        const wr = cosT[k * salto], wi = -senT[k * salto], a = i + k, b = a + meio;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  const base = p['stft_conv.weight'];

  const x = new Float32Array(CTX + PEDACO + CTX); // 640: contexto, pedaço, espelho
  const mag = new Float32Array(BINS * 4); // [129][4]
  const a1 = new Float32Array(128 * 4), a2 = new Float32Array(64 * 2), a3 = new Float32Array(64), a4 = new Float32Array(128);
  const h = new Float32Array(128), c = new Float32Array(128), g = new Float32Array(512);

  // Conv1d k=3, pad 1, com ReLU. ent [ci][ti], sai [co][to]
  // Os quatro casos do modelo, desenrolados (a versão genérica abaixo é a referência e fica para conferir): cada peso e cada
  // entrada lidos uma vez, sem teste de borda no laço de dentro. Medido: ~30% mais rápido no todo.
  function conv(ent, ci, ti, w, b, sai, co, passo) {
    if (!desenrolar) return convGenerica(ent, ci, ti, w, b, sai, co, passo);
    if (ti === 4 && passo === 1) {
      for (let o = 0; o < co; o++) {
        let s0 = b[o], s1 = s0, s2 = s0, s3 = s0;
        for (let i = 0, wi = o * ci * 3, ei = 0; i < ci; i++, wi += 3, ei += 4) {
          const w0 = w[wi], w1 = w[wi + 1], w2 = w[wi + 2], e0 = ent[ei], e1 = ent[ei + 1], e2 = ent[ei + 2], e3 = ent[ei + 3];
          s0 += w1 * e0 + w2 * e1; s1 += w0 * e0 + w1 * e1 + w2 * e2; s2 += w0 * e1 + w1 * e2 + w2 * e3; s3 += w0 * e2 + w1 * e3;
        }
        const q = o * 4;
        sai[q] = s0 > 0 ? s0 : 0; sai[q + 1] = s1 > 0 ? s1 : 0; sai[q + 2] = s2 > 0 ? s2 : 0; sai[q + 3] = s3 > 0 ? s3 : 0;
      }
    } else if (ti === 4 && passo === 2) { // saídas nos tempos 0 e 2
      for (let o = 0; o < co; o++) {
        let s0 = b[o], s1 = s0;
        for (let i = 0, wi = o * ci * 3, ei = 0; i < ci; i++, wi += 3, ei += 4) {
          const w0 = w[wi], w1 = w[wi + 1], w2 = w[wi + 2];
          s0 += w1 * ent[ei] + w2 * ent[ei + 1]; s1 += w0 * ent[ei + 1] + w1 * ent[ei + 2] + w2 * ent[ei + 3];
        }
        sai[o * 2] = s0 > 0 ? s0 : 0; sai[o * 2 + 1] = s1 > 0 ? s1 : 0;
      }
    } else if (ti === 2 && passo === 2) { // saída no tempo 0
      for (let o = 0; o < co; o++) {
        let s = b[o];
        for (let i = 0, wi = o * ci * 3, ei = 0; i < ci; i++, wi += 3, ei += 2) s += w[wi + 1] * ent[ei] + w[wi + 2] * ent[ei + 1];
        sai[o] = s > 0 ? s : 0;
      }
    } else if (ti === 1) { // só o tap do meio
      for (let o = 0; o < co; o++) {
        let s = b[o];
        for (let i = 0, wi = o * ci * 3 + 1; i < ci; i++, wi += 3) s += w[wi] * ent[i];
        sai[o] = s > 0 ? s : 0;
      }
    } else convGenerica(ent, ci, ti, w, b, sai, co, passo);
  }
  function convGenerica(ent, ci, ti, w, b, sai, co, passo) {
    const to = Math.floor((ti - 1) / passo) + 1;
    for (let o = 0; o < co; o++) {
      const wo = o * ci * 3;
      for (let t = 0; t < to; t++) {
        let s = b[o];
        const t0 = t * passo - 1;
        for (let i = 0; i < ci; i++) {
          const wi = wo + i * 3, ei = i * ti;
          if (t0 >= 0) s += w[wi] * ent[ei + t0];
          s += w[wi + 1] * ent[ei + t0 + 1];
          if (t0 + 2 < ti) s += w[wi + 2] * ent[ei + t0 + 2];
        }
        sai[o * to + t] = s > 0 ? s : 0;
      }
    }
  }
  const W1 = p['conv1.weight'], B1 = p['conv1.bias'], W2 = p['conv2.weight'], B2 = p['conv2.bias'];
  const W3 = p['conv3.weight'], B3 = p['conv3.bias'], W4 = p['conv4.weight'], B4 = p['conv4.bias'];
  const Wih = p['lstm_cell.weight_ih'], Whh = p['lstm_cell.weight_hh'], Bih = p['lstm_cell.bias_ih'], Bhh = p['lstm_cell.bias_hh'];
  const Wf = p['final_conv.weight'], Bf = p['final_conv.bias'][0];
  const sig = (v) => 1 / (1 + Math.exp(-v));

  return {
    /** Zera o estado (h, c) e o contexto. */
    zerar() { h.fill(0); c.fill(0); x.fill(0); },
    /** `pedaco`: 512 amostras a 16 kHz. Devolve a probabilidade de voz. */
    rodar(pedaco) {
      x.copyWithin(0, PEDACO, PEDACO + CTX); // o contexto: as 64 últimas do pedaço anterior
      x.set(pedaco, CTX);
      for (let i = 0; i < CTX; i++) x[CTX + PEDACO + i] = x[CTX + PEDACO - 2 - i]; // espelho (reflect) no fim
      for (let f = 0; f < 4; f++) {
        const o = f * PASSO;
        if (stftPorMatriz) {
          for (let k = 0; k < BINS; k++) {
            let r = 0, m = 0;
            const br = k * NF, bm = (BINS + k) * NF;
            for (let j = 0; j < NF; j++) { r += base[br + j] * x[o + j]; m += base[bm + j] * x[o + j]; }
            mag[k * 4 + f] = Math.sqrt(r * r + m * m);
          }
        } else {
          for (let j = 0; j < NF; j++) { re[j] = x[o + j] * hann[j]; im[j] = 0; }
          fft();
          for (let k = 0; k < BINS; k++) mag[k * 4 + f] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
        }
      }
      conv(mag, 129, 4, W1, B1, a1, 128, 1);
      conv(a1, 128, 4, W2, B2, a2, 64, 2);
      conv(a2, 64, 2, W3, B3, a3, 64, 2);
      conv(a3, 64, 1, W4, B4, a4, 128, 1);
      // LSTMCell (ordem do PyTorch: i, f, g, o)
      for (let k = 0; k < 512; k++) {
        let s = Bih[k] + Bhh[k];
        const wi = k * 128;
        for (let j = 0; j < 128; j++) s += Wih[wi + j] * a4[j] + Whh[wi + j] * h[j];
        g[k] = s;
      }
      let saida = Bf;
      for (let k = 0; k < 128; k++) {
        const ig = sig(g[k]), fg = sig(g[128 + k]), gg = Math.tanh(g[256 + k]), og = sig(g[384 + k]);
        c[k] = fg * c[k] + ig * gg;
        h[k] = og * Math.tanh(c[k]);
        saida += Wf[k] * (h[k] > 0 ? h[k] : 0);
      }
      return sig(saida);
    },
  };
}
