// A janela ABERTA, para a janela interativa. A paisagem é uma imagem à parte (../janela/), então o vão aberto precisa
// virar máscara: pede-se o vão pintado de magenta puro, e o magenta é trocado pela vista na página.
//   node e2e/pixel-art/quarto/novo/quarto/janela-aberta.mjs [dia|noite]   → janela-aberta-<quando>.png
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../../imagem.mjs';
import { pintar } from './pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// Só o caixilho e o vidro, sem as cortinas (que ficam abertas como estão).
export const CAIXILHO = [[330, 100], [436, 153], [436, 252], [330, 205]];
const caixa = [330, 100, 436, 252];
const PEDIDO = 'the same wooden window with its two glass casement sashes swung wide OPEN inward toward the room, the empty open window frame shows NOTHING outside: the whole opening is a flat solid pure magenta color (#FF00FF), clean isometric pixel art';
const DE = { dia: path.join(AQUI, '..', 'bases', 'pl-512-janela-1.png'), noite: path.join(AQUI, 'noite.png') };
for (const quando of process.argv.slice(2).length ? process.argv.slice(2) : ['dia']) {
  const destino = path.join(AQUI, `janela-aberta-${quando}.png`);
  if (fs.existsSync(destino)) { console.log('já existe:', quando); continue; }
  gravar64(destino, await pintar(ler64(DE[quando]), { caixa, poligonos: [CAIXILHO], texto: PEDIDO }, null));
  console.log('janela aberta:', quando);
}
await fechar();
