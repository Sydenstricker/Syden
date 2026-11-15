// Confere o Silero em JS puro (silero.mjs) contra o onnxruntime-node rodando o ONNX oficial, pedaço a pedaço, e mede o custo
// dos dois. O áudio é sintético (ruído e um sinal com formantes e pitch): aqui importa a CONTA bater, não o veredito.
//   node e2e/vad/conferir.mjs
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarSilero, lerSafetensors, pesosDoOnnx } from './silero.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ort = createRequire(import.meta.url)(join(AQUI, '..', '..', 'node_modules', 'onnxruntime-node'));
const MOD = join(AQUI, 'modelos');

const N = 16000 * 20, a = new Float32Array(N);
let s = 1;
for (let i = 0; i < N; i++) {
  s = (s * 1103515245 + 12345) % 2147483648;
  a[i] = ((s / 2147483648) * 2 - 1) * 0.01;
  const t = i / 16000;
  if (t % 2 < 1) {
    const f0 = 120 + 30 * Math.sin(2 * Math.PI * 3 * t);
    let v = 0;
    for (let k = 1; k < 20; k++) v += (Math.sin(2 * Math.PI * f0 * k * t) / k) * (k * f0 > 500 && k * f0 < 900 ? 3 : 1);
    a[i] += 0.1 * v * (0.5 + 0.5 * Math.sin(2 * Math.PI * 4 * t));
  }
}

async function rodarOrt(arq) {
  const sessao = await ort.InferenceSession.create(join(MOD, arq), { intraOpNumThreads: 1, interOpNumThreads: 1, executionMode: 'sequential' });
  let estado = new ort.Tensor('float32', new Float32Array(256), [2, 1, 128]);
  const sr = new ort.Tensor('int64', BigInt64Array.from([16000n]), []);
  const ctx = new Float32Array(64), probs = [];
  const t0 = performance.now();
  for (let i = 0; i + 512 <= N; i += 512) {
    const ent = new Float32Array(576);
    ent.set(ctx); ent.set(a.subarray(i, i + 512), 64);
    const r = await sessao.run({ input: new ort.Tensor('float32', ent, [1, 576]), state: estado, sr });
    probs.push(r.output.data[0]); estado = r.stateN;
    ctx.set(a.subarray(i + 448, i + 512));
  }
  return { probs, ms: (performance.now() - t0) / probs.length };
}

const ref = await rodarOrt('silero_vad_16k_op15.onnx');
const ref2 = await rodarOrt('silero_vad.onnx');
let d = 0; for (let k = 0; k < ref.probs.length; k++) d = Math.max(d, Math.abs(ref.probs[k] - ref2.probs[k]));
console.log(`onnxruntime-node, 1 thread: silero_vad_16k_op15.onnx ${ref.ms.toFixed(3)} ms por pedaço de 32 ms; silero_vad.onnx ${ref2.ms.toFixed(3)} ms (diferença entre os dois: ${d.toExponential(2)})`);

const onnx = pesosDoOnnx(join(MOD, 'silero_vad_16k_op15.onnx'));
for (const [nome, pesos, stftPorMatriz, desenrolar] of [['onnx', onnx, true, false], ['onnx', onnx, false, false], ['onnx', onnx, false, true], ['safetensors', lerSafetensors(join(MOD, 'silero_vad_16k.safetensors')), false, true]]) {
  const v = criarSilero(pesos, { stftPorMatriz, desenrolar });
  const probs = [];
  for (let i = 0; i + 512 <= N; i += 512) probs.push(v.rodar(a.subarray(i, i + 512)));
  let erro = 0; for (let k = 0; k < ref.probs.length; k++) erro = Math.max(erro, Math.abs(probs[k] - ref.probs[k]));
  for (let r = 0; r < 3; r++) for (let i = 0; i + 512 <= N; i += 512) v.rodar(a.subarray(i, i + 512));
  const voltas = 10, t0 = performance.now();
  let n = 0;
  for (let r = 0; r < voltas; r++) for (let i = 0; i + 512 <= N; i += 512) { v.rodar(a.subarray(i, i + 512)); n++; }
  const ms = (performance.now() - t0) / n;
  console.log(`JS puro, pesos do ${nome} (STFT ${stftPorMatriz ? 'pela matriz do modelo' : 'por FFT'}, conv ${desenrolar ? 'desenrolada' : 'genérica'}): erro máximo contra o onnxruntime ${erro.toExponential(2)}; ` +
    `${ms.toFixed(3)} ms por pedaço de 32 ms = ${(ms / 2).toFixed(3)} ms por quadro de 16 ms; prob. média ${(probs.reduce((x, y) => x + y, 0) / probs.length).toFixed(3)}`);
}
