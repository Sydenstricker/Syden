// As imagens e os modelos da medida (medir.mjs e montar.mjs).
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

export const IMAGENS = [
  ['glock-print.png', 'A Glock (print do WhatsApp)', [930, 615, 1480, 1000]],
  ['Cat03.jpg', 'Gato (foto)'],
  ['Golden_Retriever_Dukedestiny01_drvd.jpg', 'Cachorro (foto)'],
  ['Albert_Einstein_Head.jpg', 'Pessoa com cabelo (foto P&B)'],
  ['Red_Apple.jpg', 'Maçã (foto)'],
  ['Coffee_cup_and_saucer.jpg', 'Xícara (foto)'],
  ['Sunflower_from_Silesia2.jpg', 'Girassol (foto)'],
  ['coelho-fundo-verde.jpg', 'Desenho em fundo verde'],
  ['quarto.png', 'Pintura (o quarto)'],
].filter(([arquivo]) => existsSync(join(AQUI, 'imagens', arquivo)));
export const MODELOS = [
  ['u2netp', 'U²-Net pequeno', 'u2netp.onnx'],
  ['isnet', 'IS-Net geral', 'isnet-general-use.onnx'],
  ['birefnet', 'BiRefNet lite 1024', 'birefnet-lite.onnx'],
  ['birefnet-512', 'BiRefNet lite 512', 'birefnet-lite-512.onnx'],
  ['birefnet-512-meia', 'BiRefNet lite 512 (meia precisão)', 'birefnet-lite-512-fp16.onnx'],
];
