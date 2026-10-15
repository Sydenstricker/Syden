// OS TIPOS DE JANELA (pedido dele, 14/10/2026: "mudar a janela de lugar, o tipo de janela, e não só o lado de fora").
// Cada tipo é pintado UMA vez, na parede da direita do quarto sem janela (sem-janela.py), e vira peça pela diferença: a
// página o põe em qualquer lugar das duas paredes. O vidro sai em MAGENTA PURO, que vira a máscara da vista (o mesmo
// truque da janela aberta: funcionou de primeira).
//   node e2e/pixel-art/quarto/novo/quarto/janelas/tipos.mjs [tipo...]   → janelas/<tipo>/dia.png
import fs from 'node:fs';
import path from 'node:path';
import { fechar, ler64, gravar64 } from '../../../imagem.mjs';
import { pintar } from '../pintar.mjs';

const AQUI = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1');
// Um ponto da parede da direita (u = 0): v em casas a partir do canto do fundo, h em px acima do chão.
const naParede = (v, h) => { const x = 256 + 27 * v; return [Math.round(x), Math.round(226 + (x - 256) * (114 / 216) - h)]; };
const area = (v0, v1, h0, h1) => [naParede(v0, h0), naParede(v1, h0), naParede(v1, h1), naParede(v0, h1)];
const VIDRO = 'every glass pane is a flat solid pure magenta color (#FF00FF), nothing visible through it';
export const TIPOS = {
  arco: { area: area(3.3, 5.3, 34, 176), texto: `a tall narrow wooden window with a rounded arched top and small square panes, a wooden sill below it, set into the plain cream wall, ${VIDRO}, clean isometric pixel art` },
  // A redonda: na área estreita, saiu cortada reta do lado direito; com "ONLY" numa área larga, com um quarto em miniatura
  // dentro (o defeito conhecido desta base, falhas/). O pedido da primeira, um pouco mais largo e com outra semente.
  redonda: { area: area(3.3, 5.4, 72, 172), semente: 21, texto: `a single round wooden porthole window with a thick circular wooden frame and a cross-shaped muntin, set into the plain cream wall, ${VIDRO}, clean isometric pixel art` },
  floreira: { area: area(3.1, 5.5, 40, 156), texto: `a small square wooden window with four panes and a wooden flower box below it full of small red and yellow flowers, set into the plain cream wall, ${VIDRO}, clean isometric pixel art` },
};
const base = ler64(path.join(AQUI, 'sem-janela-dia.png'));
for (const tipo of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TIPOS)) {
  const { area: a, texto, semente } = TIPOS[tipo];
  const pasta = path.join(AQUI, tipo), destino = path.join(pasta, 'dia.png');
  if (fs.existsSync(destino)) { console.log('já existe:', tipo); continue; }
  fs.mkdirSync(pasta, { recursive: true });
  const xs = a.map((p) => p[0]), ys = a.map((p) => p[1]);
  gravar64(destino, await pintar(base, { caixa: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], poligonos: [a], texto, semente }, null));
  console.log('janela:', tipo);
}
await fechar();
