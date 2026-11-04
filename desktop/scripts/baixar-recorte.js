// @ts-check
/**
 * Põe o modelo do recorte de fundo das figurinhas em desktop/recorte-modelo/, para ir DENTRO do app (decisão dele, 04/11/2026:
 * "pra que esse atrito inicial?"). Roda sozinho antes de gerar o pacote (predist e predist:loja), e à mão para testar o app
 * de desenvolvimento: `node scripts/baixar-recorte.js`.
 *
 * O arquivo (98 MB) não mora no git. Vem da revisão FIXA da conversão medida (e2e/recorte-de-fundo/README.md), e só é aceito
 * se o sha256 for exatamente o medido: um arquivo trocado na origem não entra no pacote.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const MODELO = {
  arquivo: 'birefnet-lite-512-fp16.onnx',
  origem: 'https://huggingface.co/shozebDev/birefnet-lite-512-onnx/resolve/a1ef059c89d8982b4b5f801915024d8e2d55ea87/onnx/model_fp16.onnx',
  sha256: 'cdcc278ab17011c8507c83f368935527a7cde826dec4dff7f3dc6e18474f4a81',
};

const destino = path.join(__dirname, '..', 'recorte-modelo', MODELO.arquivo);
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

async function main() {
  if (fs.existsSync(destino) && sha(fs.readFileSync(destino)) === MODELO.sha256) {
    console.log('recorte de fundo: o modelo já está em', path.relative(process.cwd(), destino));
    return;
  }
  console.log('recorte de fundo: baixando o modelo (98 MB)…');
  const resposta = await fetch(MODELO.origem, { headers: { 'User-Agent': 'Syden (build do app)' } });
  if (!resposta.ok) throw new Error(`a origem respondeu ${resposta.status}`);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (sha(bytes) !== MODELO.sha256) throw new Error('o sha256 do modelo baixado não confere: o pacote NÃO foi gerado com ele');
  fs.writeFileSync(destino, bytes);
  console.log('recorte de fundo: modelo conferido e guardado');
}

main().catch((erro) => {
  console.error('recorte de fundo:', erro.message);
  process.exit(1);
});

module.exports = { MODELO };
