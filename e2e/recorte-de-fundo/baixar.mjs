// Baixa os três modelos de recorte de fundo e as imagens de teste (nada disso vai para o git: ver .gitignore).
//   node e2e/recorte-de-fundo/baixar.mjs
// A imagem da Glock (o print da figurinha no WhatsApp, 04/11/2026) veio na conversa e não se baixa: ponha-a à mão em
// imagens/glock-print.png, se quiser repetir aquele caso.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..', '..');

export const MODELOS = {
  // U²-Net pequeno (Apache 2.0, github.com/xuebinqin/U-2-Net), a conversão do rembg
  'u2netp.onnx': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
  // IS-Net de uso geral (Apache 2.0, github.com/xuebinqin/DIS), a conversão do rembg
  'isnet-general-use.onnx': 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx',
  // BiRefNet lite (MIT, github.com/ZhengPeng7/BiRefNet): a conversão da onnx-community, a 1024
  'birefnet-lite.onnx': 'https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx',
  // e a de 512, feita para a placa de vídeo comum (uma conversão de terceiro: para o Syden, converter a nossa)
  'birefnet-lite-512.onnx': 'https://huggingface.co/shozebDev/birefnet-lite-512-onnx/resolve/main/onnx/model.onnx',
  'birefnet-lite-512-fp16.onnx': 'https://huggingface.co/shozebDev/birefnet-lite-512-onnx/resolve/main/onnx/model_fp16.onnx',
};

// Fotos da Wikimedia Commons, só para medir aqui (não vão para o site).
const DA_COMMONS = [
  'Cat03.jpg',
  'Albert_Einstein_Head.jpg',
  'Golden_Retriever_Dukedestiny01_drvd.jpg',
  'Red_Apple.jpg',
  'Sunflower_from_Silesia2.jpg',
  'Coffee_cup_and_saucer.jpg',
];

// Do próprio repositório: a abelha (recortada), o coelho em fundo verde e a pintura do quarto.
const DO_REPOSITORIO = {
  'abelha.png': 'web/public/tamanho/abelha.png',
  'coelho-fundo-verde.jpg': 'imagem/iconeFundoVerde.jpg',
  'quarto.png': 'imagem/Sugestao/home.png',
};

async function baixar(url, destino) {
  if (existsSync(destino)) return;
  const resposta = await fetch(url, { headers: { 'User-Agent': 'SydenTeste/1.0 (recorte de fundo)' } });
  if (!resposta.ok) throw new Error(`${url}: ${resposta.status}`);
  writeFileSync(destino, Buffer.from(await resposta.arrayBuffer()));
  console.log('baixado', destino);
}

mkdirSync(join(AQUI, 'modelos'), { recursive: true });
mkdirSync(join(AQUI, 'imagens'), { recursive: true });
for (const [nome, url] of Object.entries(MODELOS)) await baixar(url, join(AQUI, 'modelos', nome));
for (const nome of DA_COMMONS)
  await baixar(`https://commons.wikimedia.org/wiki/Special:FilePath/${nome}?width=1024`, join(AQUI, 'imagens', nome));
for (const [nome, de] of Object.entries(DO_REPOSITORIO)) {
  const destino = join(AQUI, 'imagens', nome);
  if (!existsSync(destino)) copyFileSync(join(RAIZ, de), destino);
}
