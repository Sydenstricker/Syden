// Baixa os modelos do Silero VAD medidos em e2e/vad/README.md para e2e/vad/modelos/ (fora do git), da tag v6.2.3, e confere
// o sha256 de cada um: o que não bater é apagado. Os arquivos são DADOS de terceiro (MIT): só se leem como pesos.
//   node e2e/vad/baixar.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = join(dirname(fileURLToPath(import.meta.url)), 'modelos');
const BASE = 'https://raw.githubusercontent.com/snakers4/silero-vad/v6.2.3/src/silero_vad/data/';
const ARQUIVOS = {
  'silero_vad_16k_op15.onnx': '7ed98ddbad84ccac4cd0aeb3099049280713df825c610a8ed34543318f1b2c49',
  'silero_vad.onnx': '1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3',
  // só para conferir que NÃO é o mesmo modelo (ver README): os pesos diferem do ONNX
  'silero_vad_16k.safetensors': 'c59271c284ae9c8335d795d60e0bfdb71aaaceec578d9bd9ffc1b8153c319ea1',
};
mkdirSync(PASTA, { recursive: true });
for (const [nome, sha] of Object.entries(ARQUIVOS)) {
  const r = await fetch(BASE + nome);
  if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  const h = createHash('sha256').update(b).digest('hex');
  const arq = join(PASTA, nome);
  if (h !== sha) { rmSync(arq, { force: true }); throw new Error(`${nome}: sha256 ${h}, esperado ${sha}`); }
  writeFileSync(arq, b);
  console.log(`${nome}: ${b.length} bytes, sha256 conferido`);
}
