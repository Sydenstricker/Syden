// OS OBJETOS DA PAREDE (pedido dele, 15/10/2026: "recheio: plantas, quadros e objetos"; e "os objetos com função: fone,
// quadro…"). Como os tipos de janela (janelas/tipos.mjs): cada um é pintado UMA vez na parede da direita do quarto sem
// janela e vira peça pela diferença; a página o põe em qualquer lugar das duas paredes, e em qualquer altura.
//   node e2e/pixel-art/quarto/novo/quarto/parede/itens.mjs [item...]   → parede/<item>/dia.png
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { pintar } from '../pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
const naParede = (v, h) => { const x = 256 + 27 * v; return [Math.round(x), Math.round(226 + (x - 256) * (114 / 216) - h)]; };
const area = (v0, v1, h0, h1) => [naParede(v0, h0), naParede(v1, h0), naParede(v1, h1), naParede(v0, h1)];
const ESTILO = 'flat against the plain cream plaster wall, nothing else around it, clean isometric pixel art';
export const ITENS = {
  // Com função (a do quarto da home de hoje, Home.tsx): o fone abre as salas, o quadro os amigos, a cortiça as ideias.
  // O fone e o quadro saíram cortados retos do lado direito na área justa (falhas/): áreas largas, outra semente.
  // O fone saiu grande demais para o quarto (relato dele, 15/10/2026): pequeno, do tamanho de um livro.
  fone: { area: area(3.5, 4.7, 100, 150), semente: 23, texto: `ONLY a SMALL pair of over-ear headphones, about the size of a book, hanging from a tiny wooden wall hook, ${ESTILO}` },
  // As fotos eram de PESSOAS, e o universo é de coelhos (relato dele, 15/10/2026): fotos de coelhos.
  quadro: { area: area(2.9, 5.6, 80, 170), semente: 11, texto: `ONLY a wooden picture frame holding a few small instant photos of cute cartoon bunny rabbit friends (white, brown and grey bunnies, no humans) pinned on a string, ${ESTILO}` },
  cortica: { area: area(3.2, 5.0, 80, 150), texto: `ONLY a small cork board in a wooden frame with a few colorful paper notes pinned on it, ${ESTILO}` },
  // Só enfeite.
  prateleira: { area: area(2.9, 5.3, 95, 165), texto: `ONLY a short wooden wall shelf with a few books, a tiny potted succulent and a small ceramic vase on it, ${ESTILO}` },
  pintura: { area: area(3.3, 4.9, 90, 170), texto: `ONLY a framed landscape painting of green hills and a soft sunset sky, in a thin wooden frame, ${ESTILO}` },
};
const base = ler64(path.join(AQUI, '..', 'janelas', 'sem-janela-dia.png'));
for (const item of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ITENS)) {
  const { area: a, texto, semente } = ITENS[item];
  const pasta = path.join(AQUI, item), destino = path.join(pasta, 'dia.png');
  if (fs.existsSync(destino)) { console.log('já existe:', item); continue; }
  fs.mkdirSync(pasta, { recursive: true });
  const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  gravar64(destino, await pintar(base, { caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], poligonos: [a], texto, semente }, null));
  console.log('parede:', item);
}
await fechar();
